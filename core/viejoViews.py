# core/views.py
from __future__ import annotations

import threading
import os
import json
import time
from pathlib import Path
from typing import Generator, Optional

from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.http import (
    HttpRequest, HttpResponse, JsonResponse, StreamingHttpResponse
)
from django.views.decorators.gzip import gzip_page
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt

# --- Form de registro (si lo usás en /registrarse/) ---
from .forms import RegisterForm

# --- OpenCV (para /video_feed/) ---
try:
    import cv2  # type: ignore
except Exception:
    cv2 = None

# Cámara global compartida
_CAM = None
_CAM_LOCK = threading.Lock()
_CAM_INDEX = 0  # por defecto; podés tomarlo de settings o query

# -----------------------------------------------------------------------------
# PÁGINAS BÁSICAS
# -----------------------------------------------------------------------------
def home(request: HttpRequest) -> HttpResponse:
    return render(request, "core/home.html")

def register(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data["password"])
            user.save()
            login(request, user)
            return redirect("home")
    else:
        form = RegisterForm()
    return render(request, "registration/register.html", {"form": form})

@login_required
def camara(request: HttpRequest) -> HttpResponse:
    return render(request, "core/camara.html")

@login_required
def controlador(request: HttpRequest) -> HttpResponse:
    # Ajustá al template que uses realmente
    return render(request, "core/controlador.html")

@login_required
def mix_view(request: HttpRequest) -> HttpResponse:
    return render(request, "core/mix.html")

def _get_shared_camera(index: int = 0) -> Optional["cv2.VideoCapture"]:
    if cv2 is None:
        return None
    global _CAM, _CAM_INDEX
    with _CAM_LOCK:
        # Si ya existe y está abierta, la reutilizamos
        if _CAM is not None and _CAM.isOpened() and _CAM_INDEX == index:
            return _CAM
        # Si el índice cambió o estaba cerrada, (re)abrimos
        try:
            if _CAM is not None:
                _CAM.release()
        except Exception:
            pass
        cap = cv2.VideoCapture(index, cv2.CAP_V4L2)  # en Linux suele ayudar CAP_V4L2
        if not cap.isOpened():
            try:
                cap.release()
            except Exception:
                pass
            return None
        _CAM = cap
        _CAM_INDEX = index
        return _CAM


def _frame_generator(cam_index: int = 0, fps_limit: float = 25.0) -> Generator[bytes, None, None]:
    delay = 1.0 / max(fps_limit, 1.0)

    if cv2 is None:
        boundary = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
        while True:
            time.sleep(delay)
            yield boundary + b"" + b"\r\n"

    cap = _get_shared_camera(cam_index)
    if cap is None:
        # No podemos abrir la cámara: devolvemos frames vacíos (o mejor: 503 en la vista)
        boundary = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
        while True:
            time.sleep(delay)
            yield boundary + b"" + b"\r\n"

    try:
        while True:
            with _CAM_LOCK:
                ok, frame = cap.read()
            if not ok:
                time.sleep(0.05)
                continue
            ok, buf = cv2.imencode(".jpg", frame)
            if not ok:
                continue
            jpg = buf.tobytes()
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n")
            time.sleep(delay)
    except (GeneratorExit, BrokenPipeError):
        pass


@gzip_page
@require_GET
@login_required
def video_feed(request: HttpRequest) -> StreamingHttpResponse:
    cam_index = 0
    try:
        cam_index = int(request.GET.get("cam", "0"))
    except ValueError:
        pass
    return StreamingHttpResponse(
        _frame_generator(cam_index=cam_index, fps_limit=25.0),
        content_type="multipart/x-mixed-replace; boundary=frame",
    )

# -----------------------------------------------------------------------------
# RECORRIDOS (API + página)
# Almacena en: <BASE>/data/recorridos/
# - _counter.txt   -> lleva el próximo ID
# - _active.json   -> {"id":..., "name":"...", "ts":...}
# - <id>.ndjson    -> cada línea es un punto JSON ({"angle":...} o {"ac":...})
# - <id>.meta.json -> {"id":..., "name":"...", "ts":...}
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
REC_DIR  = BASE_DIR / "data" / "recorridos"
REC_DIR.mkdir(parents=True, exist_ok=True)

COUNTER_FILE = REC_DIR / "_counter.txt"
ACTIVE_FILE  = REC_DIR / "_active.json"

def _next_id() -> int:
    if not COUNTER_FILE.exists():
        COUNTER_FILE.write_text("1", encoding="utf-8")
        return 1
    try:
        n = int(COUNTER_FILE.read_text(encoding="utf-8").strip() or "0")
    except ValueError:
        n = 0
    n += 1
    COUNTER_FILE.write_text(str(n), encoding="utf-8")
    return n

def _load_active() -> dict | None:
    if not ACTIVE_FILE.exists():
        return None
    try:
        return json.loads(ACTIVE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None

def _save_active(d: dict | None) -> None:
    if d is None:
        if ACTIVE_FILE.exists():
            ACTIVE_FILE.unlink(missing_ok=True)
        return
    ACTIVE_FILE.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")

@login_required
def recorridos_page(request: HttpRequest) -> HttpResponse:
    # Template opcional: templates/core/recorridos.html
    # Si no lo tenés aún, podés hacer uno simple o devolver un mensaje.
    tpl = "core/recorridos.html"
    return render(request, tpl)

@csrf_exempt
@login_required
def api_recorridos_start(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        data = {}
    name = (data.get("name") or "").strip()
    if not name:
        return JsonResponse({"ok": False, "error": "name requerido"}, status=400)

    # Cerrar activo anterior si hubiese
    _save_active(None)

    traj_id = _next_id()
    ts = int(time.time())

    # meta
    meta = {"id": traj_id, "name": name, "ts": ts}
    (REC_DIR / f"{traj_id}.meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    # crear archivo de puntos (vacío)
    (REC_DIR / f"{traj_id}.ndjson").touch()

    # marcar activo
    _save_active(meta)

    return JsonResponse({"ok": True, "id": traj_id, "name": name})

@csrf_exempt
@login_required
def api_recorridos_point(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)

    active = _load_active()
    if not active:
        return JsonResponse({"ok": False, "error": "no hay recorrido activo"}, status=400)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        payload = {}

    # Enriquecer con timestamp
    payload["_ts"] = int(time.time())

    f = REC_DIR / f"{active['id']}.ndjson"
    with f.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, ensure_ascii=False) + "\n")

    return JsonResponse({"ok": True})

@csrf_exempt
@login_required
def api_recorridos_stop(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)
    _save_active(None)
    return JsonResponse({"ok": True})

@login_required
def api_recorridos_list(request: HttpRequest) -> JsonResponse:
    # Lista por metadatos presentes
    items = []
    for meta_path in sorted(REC_DIR.glob("*.meta.json")):
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            items.append(meta)
        except Exception:
            continue
    # Si no hay meta (caso raro), intentar deducir
    if not items:
        for nd in sorted(REC_DIR.glob("*.ndjson")):
            try:
                tid = int(nd.stem)
            except ValueError:
                continue
            items.append({"id": tid, "name": f"recorrido {tid}", "ts": int(nd.stat().st_mtime)})
    return JsonResponse({"ok": True, "items": items})

@login_required
def api_recorridos_points(request: HttpRequest, traj_id: int) -> JsonResponse:
    f = REC_DIR / f"{traj_id}.ndjson"
    if not f.exists():
        return JsonResponse({"ok": False, "error": "no existe recorrido"}, status=404)
    pts = []
    with f.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                pts.append(json.loads(line))
            except Exception:
                continue
    return JsonResponse({"ok": True, "points": pts})

@login_required
def controlador_embed(request):
    return render(request, "core/joystick.html")