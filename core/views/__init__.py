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

from .camera import (
    video_feed,
    object_detection_feed,
    mono_snapshot,
    stream_page,
    deteccion,
)

from .recorridos import (
    recorridos_page,
    api_recorridos_start,
    api_recorridos_stop,
    api_recorridos_list,
    api_recorridos_points,
    api_recorridos_point,
)

from .api import (
    api_estado_persona,
)

from .detection_state import (
    set_persona_al_frente,
    get_persona_al_frente,
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
    "mono_snapshot",
    "stream_page",
    "deteccion",

    # recorridos
    "recorridos_page",
    "api_recorridos_start",
    "api_recorridos_stop",
    "api_recorridos_list",
    "api_recorridos_points",
    "api_recorridos_point",

    # api
    "api_estado_persona",

    # detection_state
    "set_persona_al_frente",
    "get_persona_al_frente",
]
