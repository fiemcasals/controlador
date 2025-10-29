from django.urls import re_path
from .consumers import JoystickConsumer

websocket_urlpatterns = [
    # Acepta /ws y /ws/
    re_path(r"^ws/?$", JoystickConsumer.as_asgi()),
]
