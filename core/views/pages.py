
from django.views.decorators.gzip import gzip_page
from django.views.decorators.http import require_GET   
import time
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.utils.timezone import now
from django.http import StreamingHttpResponse


from ..forms import RegisterForm


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
    return render(
        request,
        "core/controlador.html",
        {
            "timestamp": now().timestamp(),
            "vehicle_ws_url": settings.VEHICLE_WS_URL,
        },
    )


@login_required
def controlador_embed(request: HttpRequest) -> HttpResponse:
    return render(
        request,
        "core/joystick.html",
        {
            "timestamp": now().timestamp(),
            "vehicle_ws_url": settings.VEHICLE_WS_URL,
        },
    )


@login_required
def mix_view(request: HttpRequest) -> HttpResponse:
    return render(request, "core/mix.html")


@login_required
def camara_grid(request):
    """
    Página HTML que muestra la vista GRID del stereo (líneas horizontales).
    """
    grid_url = reverse("video_grid")  # apunta a /video_grid/
    return render(request, "core/camara_grid.html", {"grid_url": grid_url})


@login_required
def camara_depth(request):
    """
    Página HTML que muestra el mapa de profundidad.
    """
    depth_url = reverse("video_depth")  # apunta a /video_depth/
    return render(request, "core/camara_depth.html", {"depth_url": depth_url})
@login_required
def sensores(request: HttpRequest) -> HttpResponse:
    """
    Página de dashboard de sensores (inclinación, aceleración, GPS, etc.).
    """
    return render(request, "core/sensores.html", {})


@login_required
def api_sensores(request: HttpRequest) -> JsonResponse:
    """
    API JSON sencilla para entregar los sensores al frontend.
    Por ahora datos dummy; después conectalo a tus fuentes reales:
    IMU, GPS, diccionario 'datos', etc.
    """
    # TODO: reemplazar por valores reales
    dummy = {
        "roll": 1.23,
        "pitch": -0.5,
        "yaw": 45.0,  # heading en grados

        "ax": 0.01,
        "ay": -0.02,
        "az": 9.81,

        "lat": -34.5743,
        "lon": -58.4359,
        "alt": 25.0,
        "rumbo": 45.0,  # podés usar tu cálculo de rumbo deseado/actual
        "ts": time.time(),
    }
    return JsonResponse(dummy)


@gzip_page
@require_GET
@login_required
def stereo_grid_feed(request: HttpRequest) -> StreamingHttpResponse:
    """
    Stream MJPEG del endpoint /grid del contenedor stereo.
    """
    remote_url = f"{STEREO_BASE_URL}/grid"
    return StreamingHttpResponse(
        _proxy_mjpeg(remote_url, fps=5.0),
        content_type="multipart/x-mixed-replace; boundary=frame",
    )


@gzip_page
@require_GET
@login_required
def stereo_depth_feed(request: HttpRequest) -> StreamingHttpResponse:
    """
    Stream MJPEG del endpoint /preview (mapa de profundidad coloreado).
    """
    remote_url = f"{STEREO_BASE_URL}/preview"
    return StreamingHttpResponse(
        _proxy_mjpeg(remote_url, fps=5.0),
        content_type="multipart/x-mixed-replace; boundary=frame",
    )


@login_required
def stereo_detect(request: HttpRequest) -> JsonResponse:
    """
    Proxya el JSON de /detect del contenedor stereo.
    """
    remote_url = f"{STEREO_BASE_URL}/detect"
    try:
        r = requests.get(remote_url, timeout=2)
        data = r.json()
        return JsonResponse(data, status=r.status_code, safe=False)
    except Exception as e:
        return JsonResponse(
            {"error": f"No se pudo conectar al servicio stereo: {e}"},
            status=502,
        )


