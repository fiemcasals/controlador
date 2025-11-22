# core/detection_state.py
import threading

# Estado interno (no se exporta directamente)
_persona_al_frente = False
_state_lock = threading.Lock()


def set_persona_al_frente(value: bool) -> None:
    """
    Actualiza el estado global de si hay una persona al frente o no.
    """
    global _persona_al_frente
    with _state_lock:
        _persona_al_frente = bool(value)


def get_persona_al_frente() -> bool:
    """
    Devuelve el estado actual (True = hay persona al frente).
    """
    with _state_lock:
        return _persona_al_frente
