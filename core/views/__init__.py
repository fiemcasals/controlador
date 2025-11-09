# core/views/__init__.py
from .pages import home, register, camara, controlador, mix_view, controlador_embed
from .camera import video_feed
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
    "home", "register", "camara", "controlador", "mix_view", "controlador_embed",
    # camera
    "video_feed",
    # recorridos
    "recorridos_page", "api_recorridos_start", "api_recorridos_stop",
    "api_recorridos_list", "api_recorridos_points", "api_recorridos_point",
]
