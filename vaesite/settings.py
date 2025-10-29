import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'dev-secret-for-vae-demo'  # Cambiar en producción
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'vaesite.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'core' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'vaesite.wsgi.application'
ASGI_APPLICATION = 'vaesite.asgi.application'


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'es-ar'
TIME_ZONE = 'America/Argentina/Buenos_Aires'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'core' / 'static']
# Directorios donde buscar archivos estáticos durante el desarrollo
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'core', 'static'),
]

# Directorio donde se recopilan todos los archivos estáticos (para producción o pruebas locales)
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# En desarrollo, sirve también los archivos subidos por el usuario (si tenés media)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}


# settings.py
LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/'       # o '/camara/' si preferís ir directo a la cámara
LOGOUT_REDIRECT_URL = '/'      # al cerrar sesión, vuelve al inicio


VEHICLE_WS_URL = "ws://192.168.1.21:8000/ws"
VEHICLE_WS_CONNECT_TIMEOUT = 5

# A DÓNDE enviar los comandos (la IP/PUERTO donde corre el monitor_udp.py)
MONITOR_UDP_IP = "192.168.1.21"   # <-- poné la IP de la PC del monitor
MONITOR_UDP_PORT = 9999           # <-- mismo puerto que usás al ejecutar el monitor
