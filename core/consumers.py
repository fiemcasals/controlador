import json
from channels.generic.websocket import AsyncWebsocketConsumer

class JoystickConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send(json.dumps({"encendido": True}))

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data) if text_data else None
        except Exception:
            data = {"raw": text_data}
        # Aquí podrías encaminar a tu backend físico
        await self.send(json.dumps({"ack": data}))

    async def disconnect(self, close_code):
        pass
