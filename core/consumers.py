import json, socket, logging
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

logger = logging.getLogger(__name__)
_UDP_SOCK = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

class JoystickConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send(json.dumps({"encendido": True}))

    async def receive(self, text_data=None, bytes_data=None):
        ack = text_data if text_data is not None else f"<{len(bytes_data)} bytes>" if bytes_data else None
        await self.send(json.dumps({"ack": ack}))

        try:
            MON_IP   = getattr(settings, "MONITOR_UDP_IP", "127.0.0.1")
            MON_PORT = int(getattr(settings, "MONITOR_UDP_PORT", 9999))
            MON_ADDR = (MON_IP, MON_PORT)

            if text_data is not None:
                logger.info(f"[UDP] -> {MON_ADDR} : {text_data}")
                _UDP_SOCK.sendto(text_data.encode("utf-8"), MON_ADDR)
            elif bytes_data is not None:
                logger.info(f"[UDP] -> {MON_ADDR} : <{len(bytes_data)} bytes>")
                _UDP_SOCK.sendto(bytes_data, MON_ADDR)
        except Exception as e:
            logger.exception("Error enviando UDP")
            await self.send(json.dumps({"udp_error": str(e)}))
