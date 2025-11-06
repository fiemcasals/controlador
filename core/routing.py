from django.urls import re_path
from .consumers import JoystickConsumer, MonitorConsumer

websocket_urlpatterns = [
    # Compatibilidad hacia atrás: el joystick que ya existe
    re_path(r"^ws/?$", JoystickConsumer.as_asgi()),

    # Nuevas rutas explícitas
    re_path(r"^ws/joystick/?$", JoystickConsumer.as_asgi()),
    re_path(r"^ws/monitor/?$", MonitorConsumer.as_asgi()),
]
