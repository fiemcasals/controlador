# core/views/__init__.py

from .pages import (
    home,
    register,
    camara,
    controlador,
    mix_view,
    controlador_embed,
    camara_grid,
    camara_depth,
    sensores,
    api_sensores,
)
from .camera import video_feed, object_detection_feed, deteccion
from .recorridos import (
    recorridos_page,
    api_recorridos_start,
    api_recorridos_stop,
    api_recorridos_list,
    api_recorridos_points,
    api_recorridos_point,
)

__all__ = [
    # pages
    "home",
    "register",
    "camara",
    "controlador",
    "mix_view",
    "controlador_embed",
    "camara_grid",
    "camara_depth",
    "sensores",
    "api_sensores",

    # camera
    "video_feed",
    "object_detection_feed",
    "deteccion",

    # recorridos
    "recorridos_page",
    "api_recorridos_start",
    "api_recorridos_stop",
    "api_recorridos_list",
    "api_recorridos_points",
    "api_recorridos_point",
]
