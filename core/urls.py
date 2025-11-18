# core/urls.py
from django.urls import path
from . import views
from .views.camera import (
    video_feed,
    object_detection_feed,
    deteccion,
)
from .views.pages import stereo_grid_feed, stereo_depth_feed, stereo_detect

urlpatterns = [
    # Páginas principales
    path("", views.home, name="home"),

    # Cámara: vista normal + variantes
    path("camara/", views.camara, name="camara"),
    path("camara/grid/", views.camara_grid, name="camara_grid"),
    path("camara/depth/", views.camara_depth, name="camara_depth"),

    # Controlador y mixto
    path("controlador/", views.controlador, name="controlador"),
    path("controlador/embed/", views.controlador_embed, name="controlador_embed"),
    path("mix/", views.mix_view, name="mix"),

    # Nueva sección: Sensores
    path("sensores/", views.sensores, name="sensores"),
    path("api/sensores/", views.api_sensores, name="api_sensores"),

    # Vista de detección de objetos
    path("deteccion/", views.deteccion, name="deteccion"),
    path("video/deteccion/", views.object_detection_feed, name="object_detection_feed"),

    # Recorridos
    path("recorridos/", views.recorridos_page, name="recorridos_page"),
    path("api/recorridos/start/", views.api_recorridos_start, name="api_recorridos_start"),
    path("api/recorridos/stop/", views.api_recorridos_stop, name="api_recorridos_stop"),
    path("api/recorridos/", views.api_recorridos_list, name="api_recorridos_list"),
    path("api/recorridos/<int:traj_id>/points", views.api_recorridos_points, name="api_recorridos_points"),
    path("api/recorridos/point", views.api_recorridos_point, name="api_recorridos_point"),

    path("video_grid/", stereo_grid_feed, name="video_grid"),
    path("video_depth/", stereo_depth_feed, name="video_depth"),
    path("api/stereo/detect/", stereo_detect, name="stereo_detect"),
]
