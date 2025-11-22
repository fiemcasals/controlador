# core/views/camera.py
from __future__ import annotations

import threading
import time
from typing import Generator, Optional
import os
from pathlib import Path

import requests
from django.http import HttpRequest, HttpResponse, StreamingHttpResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.gzip import gzip_page
from django.views.decorators.http import require_GET
from django.shortcuts import render
from django.conf import settings

# ================== CONFIG REMOTA (PC INDUSTRIAL / CONTENEDOR) ==================

# OJO: definir UNA sola vez
STEREO_BASE_URL = "http://172.28.43.60:8080"  # IP de tu máquina industrial

# ================== OPENCV / DNN ==================

try:
    import cv2  # type: ignore
except Exception:
    cv2 = None

# ================== CÁMARA COMPARTIDA ==================

_CAM: Optional["cv2.VideoCapture"] = None
_CAM_LOCK = threading.Lock()
_CAM_INDEX = 0


def _get_shared_camera(index: int = 0) -> Optional["cv2.VideoCapture"]:
    """
    Devuelve una única instancia compartida de VideoCapture para el índice dado.
    """
    if cv2 is None:
        return None

    global _CAM, _CAM_INDEX

    with _CAM_LOCK:
        # Si ya está abierta para ese índice, la reutilizamos
        if _CAM is not None and _CAM.isOpened() and _CAM_INDEX == index:
            return _CAM

        # Si había una cámara abierta para otro índice, la cerramos
        try:
            if _CAM is not None:
                _CAM.release()
        except Exception:
            pass

        # Abrimos la nueva
        cap = cv2.VideoCapture(index)  # sin CAP_V4L2 para evitar problemas
        if not cap.isOpened():
            try:
                cap.release()
            except Exception:
                pass
            return None

        _CAM = cap
        _CAM_INDEX = index
        return _CAM


def _frame_generator(
    cam_index: int = 0,
    fps_limit: float = 25.0
) -> Generator[bytes, None, None]:
    """
    Generador de frames JPEG para la cámara simple (sin detección).
    """
    delay = 1.0 / max(fps_limit, 1.0)
    boundary = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"

    if cv2 is None:
        while True:
            time.sleep(delay)
            yield boundary + b"" + b"\r\n"

    cap = _get_shared_camera(cam_index)
    if cap is None:
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

            yield boundary + jpg + b"\r\n"
            time.sleep(delay)
    except (GeneratorExit, BrokenPipeError):
        # El cliente cerró la conexión
        pass


# ================== VISTA DE VIDEO SIMPLE (PROXY A CONTENEDOR) ==================

@gzip_page
@require_GET
@login_required
def video_feed(request: HttpRequest) -> StreamingHttpResponse:
    """
    Stream MJPEG que proxya /mono_stream del contenedor stereo.
    Esta es la que usan camara.html y mix.html.
    """
    remote_url = f"{STEREO_BASE_URL}/mono_stream"
    return StreamingHttpResponse(
        _proxy_stream(remote_url),
        content_type="multipart/x-mixed-replace; boundary=frame",
    )


# ================== MODELO DNN (MobileNetSSD) ==================

MODEL_DIR = Path(settings.BASE_DIR)

PROTOTXT = MODEL_DIR / "MobileNetSSD_deploy.prototxt.txt"
MODEL = MODEL_DIR / "MobileNetSSD_deploy.caffemodel"

CLASSES = {
    0: "background",
    1: "aeroplane",
    2: "bicycle",
    3: "bird",
    4: "boat",
    5: "bottle",
    6: "bus",
    7: "car",
    8: "cat",
    9: "chair",
    10: "cow",
    11: "diningtable",
    12: "dog",
    13: "horse",
    14: "motorbike",
    15: "person",
    16: "pottedplant",
    17: "sheep",
    18: "sofa",
    19: "train",
    20: "tvmonitor",
}

if cv2 is not None:
    try:
        net = cv2.dnn.readNetFromCaffe(str(PROTOTXT), str(MODEL))
    except Exception:
        net = None
else:
    net = None




# ================== VISTAS HTML / DETECCIÓN ==================
from .detection_state import set_persona_al_frente


@login_required
@require_GET
def deteccion(request: HttpRequest) -> HttpResponse:
    """
    Renderiza la página que muestra el stream con detección de objetos.
    La plantilla incluye un <img> que apunta a la vista object_detection_feed.
    """
    return render(request, "core/deteccion.html", {})

from typing import Generator, Union

def gen_object_detection_frames(
    source: Union[int, str],
    fps_limit: float = 15.0,
    conf_threshold: float = 0.45,
) -> Generator[bytes, None, None]:
    """
    Generador de frames MJPEG con detección de objetos usando MobileNetSSD.

    - `source` puede ser:
        * int  -> índice de cámara local (0, 1, ...)
        * str  -> URL remota (por ejemplo, http://.../mono_stream)
    - Dibuja bounding boxes y etiquetas sobre el frame.
    - Devuelve los frames como un stream MJPEG.
    """
    boundary_header = (
        b"--frame\r\n"
        b"Content-Type: image/jpeg\r\n\r\n"
    )
    delay = 1.0 / max(fps_limit, 1.0)

    # Si no hay OpenCV o no se pudo cargar el modelo, devolvemos frames vacíos
    if cv2 is None or net is None:
        while True:
            time.sleep(delay)
            yield boundary_header + b"" + b"\r\n"

    # Abrimos la fuente de video según el tipo de `source`
    if isinstance(source, int):
        # Cámara local compartida
        cap = _get_shared_camera(source)
    else:
        # URL remota (por ejemplo, el mono_stream de la PC industrial)
        cap = cv2.VideoCapture(source)

    if cap is None or not cap.isOpened():
        print(f"[ERROR] No se pudo abrir la fuente de video: {source}")
        while True:
            time.sleep(delay)
            yield boundary_header + b"" + b"\r\n"

    while True:
        t0 = time.time()

        # Leemos un frame de la cámara / stream
        with _CAM_LOCK:
            ok, frame = cap.read()

        if not ok or frame is None:
            time.sleep(0.05)
            continue

        (h, w) = frame.shape[:2]

        # Preparamos el blob para MobileNetSSD (tamaño 300x300)
        resized = cv2.resize(frame, (300, 300))
        blob = cv2.dnn.blobFromImage(
            resized,
            scalefactor=0.007843,          # 1/127.5
            size=(300, 300),
            mean=(127.5, 127.5, 127.5),
        )

        net.setInput(blob)
        detections = net.forward()  # shape: [1, 1, N, 7]

          # 👉 Por defecto asumimos que NO hay persona
        found_person = False

        # Recorremos las detecciones
        for i in range(detections.shape[2]):
            confidence = float(detections[0, 0, i, 2])
            if confidence < conf_threshold:
                continue

            class_id = int(detections[0, 0, i, 1])
            label = CLASSES.get(class_id, str(class_id))

                        # Si alguna detección es una persona, marcamos el flag
            if label == "person":
                found_person = True

            box = detections[0, 0, i, 3:7] * [w, h, w, h]
            (x1, y1, x2, y2) = box.astype("int")

            # Dibujamos rectángulo y texto
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            text = f"{label} {confidence * 100:.1f}%"
            cv2.putText(
                frame,
                text,
                (x1, max(0, y1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 255),
                2,
            )
        # 👉 Actualizamos la variable compartida
        set_persona_al_frente(found_person)

        ok, buffer = cv2.imencode(".jpg", frame)
        if not ok:
            continue

        jpg_bytes = buffer.tobytes()
        yield boundary_header + jpg_bytes + b"\r\n"

        # Limitamos FPS
        elapsed = time.time() - t0
        if elapsed < delay:
            time.sleep(delay - elapsed)

@gzip_page
@require_GET
@login_required
def object_detection_feed(request: HttpRequest) -> StreamingHttpResponse:
    """
    Stream MJPEG con detección de objetos usando MobileNetSSD.
    El <img> de deteccion.html apunta a esta vista.
    """
    remote_url = f"{STEREO_BASE_URL}/mono_stream"

    return StreamingHttpResponse(
        gen_object_detection_frames(remote_url, fps_limit=10.0),
        content_type="multipart/x-mixed-replace; boundary=frame",
    )




# ================== HELPERS DE PROXY ==================

def _proxy_mjpeg(remote_url: str, fps: float = 5.0) -> Generator[bytes, None, None]:
    """
    Para endpoints que devuelven UNA imagen JPEG por request (ej: /grid, /preview).
    Hacemos GET en loop y armamos un stream MJPEG nosotros.
    """
    delay = 1.0 / max(fps, 1.0)
    boundary = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"

    while True:
        try:
            r = requests.get(remote_url, timeout=3)
            if r.status_code == 200:
                jpg = r.content
                yield boundary + jpg + b"\r\n"
            else:
                yield boundary + b"" + b"\r\n"
        except Exception:
            yield boundary + b"" + b"\r\n"

        time.sleep(delay)


def _proxy_stream(remote_url: str) -> Generator[bytes, None, None]:
    """
    Para endpoints que ya son UN STREAM MJPEG (ej: /mono_stream).
    Simplemente reenviamos los chunks tal cual llegan.
    """
    try:
        r = requests.get(remote_url, stream=True, timeout=5)
    except Exception:
        # Si no se puede conectar, devolvemos un generador vacío
        def empty_gen():
            while True:
                yield b""
                time.sleep(0.1)

        return empty_gen()

    def generate():
        try:
            for chunk in r.iter_content(chunk_size=4096):
                if not chunk:
                    continue
                yield chunk
        finally:
            r.close()

    return generate()


def _proxy_remote_mjpeg(remote_url: str):
    """
    Proxya un stream MJPEG remoto (/mono_stream) y lo reenvía tal cual
    al navegador, devolviendo también el content-type.
    """
    try:
        r = requests.get(remote_url, stream=True, timeout=3)
        content_type = r.headers.get(
            "Content-Type",
            "multipart/x-mixed-replace; boundary=frame"
        )
    except Exception:
        # Si no puedo conectarme, devuelvo un generador de frames vacíos
        def err_gen():
            while True:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + b"" + b"\r\n"
                )
        return "multipart/x-mixed-replace; boundary=frame", err_gen()

    def generate():
        try:
            for chunk in r.iter_content(chunk_size=4096):
                if not chunk:
                    continue
                yield chunk
        finally:
            r.close()

    return content_type, generate()


# ================== FOTO ÚNICA (SNAPSHOT) ==================

@login_required
@require_GET
def mono_snapshot(request: HttpRequest) -> HttpResponse:
    """
    Devuelve UNA sola imagen JPEG de /mono (foto fija).
    """
    remote_url = f"{STEREO_BASE_URL}/mono"
    try:
        r = requests.get(remote_url, timeout=3)
        if r.status_code == 200:
            return HttpResponse(r.content, content_type="image/jpeg")
        return HttpResponse(status=502)
    except Exception as e:
        return HttpResponse(
            f"No se pudo obtener snapshot: {e}",
            status=502,
            content_type="text/plain",
        )


# ================== PÁGINA SIMPLE DE STREAM (OPCIONAL) ==================

@login_required
def stream_page(request: HttpRequest) -> HttpResponse:
    """
    Renderiza una plantilla HTML que muestra la vista de la cámara simple.
    (Útil si usás 'vista/' en urls.py)
    """
    return render(request, "core/video_stream.html", {})
