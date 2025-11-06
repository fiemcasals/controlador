import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.layers import get_channel_layer
import asyncio
import websockets
from django.conf import settings

log = logging.getLogger("joystick")
GROUP = "joystick_stream"

class JoystickConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.accept()
        log.info("[WS] joystick conectado")

    async def receive_json(self, content, **kwargs):
        """
        Espera mensajes del frontend joystick, ej:
        {"angle": 15, "ac": 42} (+ opcionalmente en)
        """
        try:
            # Log en consola del servidor
            log.info(f"[WS] recv joystick: {content}")
            print(f"[WS] recv joystick: {content}")  # extra por si el logger no estuviera

            # 1) Reenviar a todos los monitores
            channel_layer = get_channel_layer()
            await channel_layer.group_send(
                GROUP,
                {"type": "joystick.event", "payload": content}
            )

            # 2) (opcional) reenviar al vehículo por WebSocket desde el servidor
            asyncio.create_task(send_to_vehicle_ws(content))
        except Exception as e:
            log.exception(f"[WS] error en receive_json: {e}")

    async def disconnect(self, code):
        log.info(f"[WS] joystick desconectado ({code})")


class MonitorConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(GROUP, self.channel_name)
        await self.accept()
        log.info("[WS] monitor conectado")

    async def disconnect(self, code):
        await self.channel_layer.group_discard(GROUP, self.channel_name)
        log.info(f"[WS] monitor desconectado ({code})")

    async def joystick_event(self, event):
        await self.send_json(event["payload"])


async def send_to_vehicle_ws(payload: dict):
    """Conecta al vehículo y envía el comando (simple, reintentos mínimos)."""
    url = getattr(settings, "VEHICLE_WS_URL", None)
    if not url:
        return
    msg = json.dumps(payload)
    try:
        async with websockets.connect(url, open_timeout=settings.VEHICLE_WS_CONNECT_TIMEOUT) as ws:
            await ws.send(msg)
    except Exception as e:
        # No frenes el flujo si falla; solo logueá.
        logging.getLogger("joystick").warning(f"[vehicle_ws] error: {e}")
