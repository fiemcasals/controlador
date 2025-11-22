# core/urls.py
from django.urls import path
from . import views
from .views.camera import (
    video_feed,
    object_detection_feed,
    mono_snapshot,
    deteccion,
    stream_page,
)
from .views.pages import stereo_grid_feed, stereo_depth_feed, stereo_detect
from .views.recorridos import (
    recorridos_page,
    api_recorridos_start,
    api_recorridos_stop,
    api_recorridos_list,
    api_recorridos_points,
    api_recorridos_point,
)

urlpatterns = [
    # Páginas principales
    path("", views.home, name="home"),

    # Cámara: vista normal + variantes
    path("camara/", views.camara, name="camara"),
    path("camara/grid/", views.camara_grid, name="camara_grid"),
    path("camara/depth/", views.camara_depth, name="camara_depth"),

    # Fuente MJPEG normal (proxy al contenedor)
    path("video_feed/", video_feed, name="video_feed"),

    # Controlador y mixto
    path("controlador/", views.controlador, name="controlador"),
    path("controlador/embed/", views.controlador_embed, name="controlador_embed"),
    path("mix/", views.mix_view, name="mix"),

    # Nueva sección: Sensores
    path("sensores/", views.sensores, name="sensores"),
    path("api/sensores/", views.api_sensores, name="api_sensores"),

    # Vista de detección de objetos (HTML + feed)
    path("deteccion/", deteccion, name="deteccion"),
    path("deteccion/feed/", object_detection_feed, name="object_detection_feed"),

    # Recorridos
    path("recorridos/", recorridos_page, name="recorridos_page"),
    path("api/recorridos/start/", api_recorridos_start, name="api_recorridos_start"),
    path("api/recorridos/stop/", api_recorridos_stop, name="api_recorridos_stop"),
    path("api/recorridos/", api_recorridos_list, name="api_recorridos_list"),
    path(
        "api/recorridos/<int:traj_id>/points",
        api_recorridos_points,
        name="api_recorridos_points",
    ),
    path(
        "api/recorridos/point",
        api_recorridos_point,
        name="api_recorridos_point",
    ),

    # Stereo remoto (grid / depth / detect)
    path("video_grid/", stereo_grid_feed, name="video_grid"),
    path("video_depth/", stereo_depth_feed, name="video_depth"),
    path("api/stereo/detect/", stereo_detect, name="stereo_detect"),
    path("foto/", mono_snapshot, name="mono_snapshot"),

    # Página simple de stream (opcional)
    path("vista/", stream_page, name="stream_page"),
]
