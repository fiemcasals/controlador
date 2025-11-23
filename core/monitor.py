# core/monitor.py
from collections import deque
from typing import Deque, Dict, Any, List

# Guardamos solo los últimos N comandos para no explotar memoria
_MAX_LOGS = 300

# Deque global en memoria (mientras el proceso de Django viva)
_logs: Deque[Dict[str, Any]] = deque(maxlen=_MAX_LOGS)


def add_log(payload: Dict[str, Any]) -> None:
    """
    Agrega un comando al buffer en memoria.
    payload debería ser algo tipo {"angle": ..., "ac": ..., "en": ...}
    """
    if not isinstance(payload, dict):
        return
    _logs.append(payload)


def get_logs() -> List[Dict[str, Any]]:
    """
    Devuelve una copia de la lista de logs (para serializar a JSON).
    """
    return list(_logs)
