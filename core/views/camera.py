# core/views/camera.py
from __future__ import annotations
import threading, time
from typing import Generator, Optional
from django.http import HttpRequest, StreamingHttpResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.gzip import gzip_page
from django.views.decorators.http import require_GET

try:
    import cv2  # type: ignore
except Exception:
    cv2 = None

_CAM = None
_CAM_LOCK = threading.Lock()
_CAM_INDEX = 0

def _get_shared_camera(index: int = 0) -> Optional["cv2.VideoCapture"]:
    if cv2 is None:
        return None
    global _CAM, _CAM_INDEX
    with _CAM_LOCK:
        if _CAM is not None and _CAM.isOpened() and _CAM_INDEX == index:
            return _CAM
        try:
            if _CAM is not None:
                _CAM.release()
        except Exception:
            pass
        cap = cv2.VideoCapture(index, cv2.CAP_V4L2)
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
    boundary = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
    if cv2 is None:
        while True:
            time.sleep(delay); yield boundary + b"" + b"\r\n"

    cap = _get_shared_camera(cam_index)
    if cap is None:
        while True:
            time.sleep(delay); yield boundary + b"" + b"\r\n"

    try:
        while True:
            with _CAM_LOCK:
                ok, frame = cap.read()
            if not ok:
                time.sleep(0.05); continue
            ok, buf = cv2.imencode(".jpg", frame)
            if not ok: continue
            jpg = buf.tobytes()
            yield (b"--frame\r\nb" + b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n")
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
