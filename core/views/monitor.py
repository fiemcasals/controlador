# core/views/monitor.py
import json

from django.http import JsonResponse, HttpRequest, HttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET

from core.monitor import add_log, get_logs


@require_GET
def monitor_page(request: HttpRequest) -> HttpResponse:
    """
    Página HTML con el monitor web.
    """
    return render(request, "core/monitor.html")


@csrf_exempt
@require_POST
def monitor_telemetry(request: HttpRequest) -> JsonResponse:
    """
    Recibe comandos desde el frontend (ws.client.js) y los guarda en memoria.
    """
    try:
        body = request.body.decode("utf-8") or "{}"
        payload = json.loads(body)
        if not isinstance(payload, dict):
            raise ValueError("Expected JSON object")
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)

    add_log(payload)
    return JsonResponse({"ok": True})


@require_GET
def monitor_stream(request: HttpRequest) -> JsonResponse:
    """
    Devuelve la lista de últimos comandos guardados.
    """
    logs = get_logs()
    return JsonResponse({"ok": True, "items": logs})
