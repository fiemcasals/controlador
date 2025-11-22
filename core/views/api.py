# core/views/api.py (o donde manejes vistas API)
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required

from .detection_state import get_persona_al_frente


@require_GET
@login_required  # si querés que solo usuarios logueados puedan ver esto
def api_estado_persona(request):
    """
    Devuelve el estado actual de persona al frente.

    Respuesta JSON:
    { "personaAlFrente": true/false }
    """
    estado = get_persona_al_frente()
    return JsonResponse({"personaAlFrente": estado})
