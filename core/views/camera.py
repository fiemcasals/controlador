# core/views/camera.py
from __future__ import annotations
import threading
import time
from typing import Generator, Optional

import os
import requests
from django.http import JsonResponse

from django.http import HttpRequest, StreamingHttpResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.gzip import gzip_page
from django.views.decorators.http import require_GET
from django.shortcuts import render
from django.conf import settings
from pathlib import Path

STEREO_BASE_URL = os.getenv(
    "STEREO_BASE_URL",
    "http://192.168.1.82:8080"  #  IP real del equipo que tiene el contenedor
).rstrip("/")


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


def _frame_generator(cam_index: int = 0, fps_limit: float = 25.0) -> Generator[bytes, None, None]:
    """
    Generador de frames JPEG para el stream de la cámara simple.
    """
    delay = 1.0 / max(fps_limit, 1.0)

    if cv2 is None:
        # Si no hay OpenCV, devolvemos frames vacíos
        boundary = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
        while True:
            time.sleep(delay)
            yield boundary + b"" + b"\r\n"

    cap = _get_shared_camera(cam_index)
    if cap is None:
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

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
            )

            time.sleep(delay)
    except (GeneratorExit, BrokenPipeError):
        # El cliente cerró la conexión
        pass


@gzip_page
@require_GET
@login_required
def video_feed(request: HttpRequest) -> StreamingHttpResponse:
    """
    Stream MJPEG de la cámara simple (sin detección).
    """
    cam_index = 0
    try:
        cam_index = int(request.GET.get("cam", "0"))
    except ValueError:
        pass

    return StreamingHttpResponse(
        _frame_generator(cam_index=cam_index, fps_limit=25.0),
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
    net = cv2.dnn.readNetFromCaffe(str(PROTOTXT), str(MODEL))
else:
    net = None


def gen_object_detection_frames() -> Generator[bytes, None, None]:
    """
    Generador de frames con detección de objetos.
    Usa la misma cámara compartida.
    """
    if cv2 is None or net is None:
        # Sin OpenCV o sin modelo, devolvemos frames vacíos
        while True:
            time.sleep(0.1)
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + b"" + b"\r\n"
            )

    cap = _get_shared_camera(0)
    if cap is None:
        while True:
            time.sleep(0.1)
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + b"" + b"\r\n"
            )

    while True:
        with _CAM_LOCK:
            ret, frame = cap.read()
        if not ret:
            time.sleep(0.05)
            continue

        height, width, _ = frame.shape

        # Redimensionamos para el DNN
        frame_resized = cv2.resize(frame, (800, 800))

        blob = cv2.dnn.blobFromImage(
            frame_resized,
            0.007843,
            (300, 300),
            (127.5, 127.5, 127.5),
        )

        net.setInput(blob)
        detections = net.forward()

        for detection in detections[0][0]:
            if detection[2] > 0.45:
                class_id = int(detection[1])
                label = CLASSES.get(class_id, str(class_id))
                box = detection[3:7] * [width, height, width, height]
                x_start, y_start, x_end, y_end = (
                    int(box[0]), int(box[1]), int(box[2]), int(box[3])
                )

                cv2.rectangle(frame, (x_start, y_start), (x_end, y_end), (0, 255, 0), 2)
                cv2.putText(
                    frame,
                    f"{label} {detection[2] * 100:.1f}%",
                    (x_start, max(0, y_start - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 255),
                    2,
                )

        ok, buffer = cv2.imencode(".jpg", frame)
        if not ok:
            continue

        jpg_bytes = buffer.tobytes()
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpg_bytes + b"\r\n"
        )


def object_detection_feed(request: HttpRequest) -> StreamingHttpResponse:
    """
    Streaming de la cámara con detección de objetos.
    """
    return StreamingHttpResponse(
        gen_object_detection_frames(),
        content_type="multipart/x-mixed-replace; boundary=frame",
    )


def deteccion(request: HttpRequest):
    """
    Página que muestra el <img> consumiendo object_detection_feed.
    """
    return render(request, "core/deteccion.html", {})


def _proxy_mjpeg(remote_url: str, fps: float = 10.0):
    """
    Pide una imagen JPEG a remote_url en bucle y la expone como stream MJPEG.
    """
    delay = 1.0 / max(fps, 1.0)

    while True:
        try:
            r = requests.get(remote_url, timeout=2)
            if r.status_code == 200:
                jpg = r.content
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
                )
            else:
                # Si falla, mandamos un frame vacío (para no cortar el stream)
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + b"" + b"\r\n"
                )
        except Exception as e:
            # Podés loguear 'e' si querés
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + b"" + b"\r\n"
            )

        time.sleep(delay)
