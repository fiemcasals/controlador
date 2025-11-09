# core/views/recorridos.py (versión DB)
from __future__ import annotations
import json
from typing import Optional, List
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from django.utils import timezone

from ..models import Trajectory, TrajectoryPoint

# Clave de sesión para “recorrido activo”
_ACTIVE_KEY = "active_trajectory_id"

@login_required
def recorridos_page(request: HttpRequest) -> HttpResponse:
    return render(request, "core/recorridos.html")

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

    # Cerrar cualquier activo anterior de esta sesión
    request.session.pop(_ACTIVE_KEY, None)

    t = Trajectory.objects.create(
        name=name,
        started_at=timezone.now(),
        ended_at=None,
    )
    request.session[_ACTIVE_KEY] = t.id
    request.session.modified = True

    return JsonResponse({"ok": True, "id": t.id, "name": t.name})

@csrf_exempt
@login_required
def api_recorridos_point(request: HttpRequest) -> JsonResponse:
    """Recibe UN punto por POST y lo asocia al activo de la sesión.
       Payload típico: {"angle": 90, "ac": 40, "en": 1, "ts": "2025-11-09T12:34:56Z" (opcional)}"""
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)

    traj_id = request.session.get(_ACTIVE_KEY)
    if not traj_id:
        return JsonResponse({"ok": False, "error": "no hay recorrido activo"}, status=400)

    try:
        t = Trajectory.objects.get(id=traj_id)
    except Trajectory.DoesNotExist:
        request.session.pop(_ACTIVE_KEY, None)
        return JsonResponse({"ok": False, "error": "recorrido activo inválido"}, status=400)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        payload = {}

    # Timestamp opcional (ISO). Si no viene, usamos ahora.
    ts = payload.get("ts")
    if ts:
        try:
            # fromisoformat acepta 'YYYY-MM-DDTHH:MM:SS[.ffffff][+HH:MM]'
            # Si tu frontend manda Zulu, podés normalizar aquí si hace falta.
            ts_dt = timezone.make_aware(timezone.datetime.fromisoformat(ts)) if "Z" not in ts else timezone.datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            ts_dt = timezone.now()
    else:
        ts_dt = timezone.now()

    TrajectoryPoint.objects.create(
        trajectory=t,
        ts=ts_dt,
        angle=payload.get("angle"),
        ac=payload.get("ac"),
        en=payload.get("en"),
    )
    return JsonResponse({"ok": True})

@csrf_exempt
@login_required
def api_recorridos_stop(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)

    traj_id = request.session.get(_ACTIVE_KEY)
    if traj_id:
        try:
            t = Trajectory.objects.get(id=traj_id)
            if t.ended_at is None:
                t.ended_at = timezone.now()
                t.save(update_fields=["ended_at"])
        except Trajectory.DoesNotExist:
            pass
        request.session.pop(_ACTIVE_KEY, None)
        request.session.modified = True

    return JsonResponse({"ok": True})

@login_required
def api_recorridos_list(request: HttpRequest) -> JsonResponse:
    """Devuelve mismo formato que tu versión anterior para no romper el front."""
    qs = (Trajectory.objects
          .order_by("-started_at")
          .values("id", "name", "started_at"))

    items = []
    for r in qs:
        # compatibilidad: 'ts' en epoch segundos (antes venía del archivo)
        ts = int(r["started_at"].timestamp()) if r["started_at"] else None
        items.append({"id": r["id"], "name": r["name"], "ts": ts})
    return JsonResponse({"ok": True, "items": items})

@login_required
def api_recorridos_points(request: HttpRequest, traj_id: int) -> JsonResponse:
    """Devuelve todos los puntos del trayecto (ordenados por ts)"""
    pts_qs = (TrajectoryPoint.objects
              .filter(trajectory_id=traj_id)
              .order_by("ts")
              .values("ts", "angle", "ac", "en"))

    pts = []
    for p in pts_qs:
        # compatibilidad: devolvemos _ts en epoch para tu replayer, y mantenemos campos.
        pts.append({
            "_ts": int(p["ts"].timestamp()) if p["ts"] else None,
            "angle": p["angle"],
            "ac": p["ac"],
            "en": p["en"],
        })
    return JsonResponse({"ok": True, "points": pts})
