# VAE Site (Django + Channels + OpenCV)

## Requisitos
- Python 3.10+
- pip, venv
- (Opcional) MobileNetSSD_deploy.caffemodel y MobileNetSSD_deploy.prototxt.txt en la raíz del proyecto para detección.

## Instalación (Linux/Mac)
```bash
cd vaesite
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
Admin: `VAEcontrolador` / `micontroladorVAE`

## Instalación (Windows)
```powershell
cd vaesite
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

## Rutas
- `/` inicio
- `/accounts/login/` y `/accounts/logout/`
- `/registrarse/` registro de nuevos usuarios
- `/camara/` (requiere login) muestra el stream (`/video_feed/`)
- `/controlador/` (requiere login) joystick (tu HTML dentro de un iframe)
- `/mix/` (requiere login) cámara + joystick
- `/ws` WebSocket (Channels). Envía mensaje inicial `{"encendido": true}` y responde con `{"ack": ...}`.

## Notas
- Si no se encuentran los archivos MobileNetSSD, se mostrará solo el video sin detección.
- En producción, cambiá SECRET_KEY, deshabilitá DEBUG y configurá ALLOWED_HOSTS y staticfiles.

## migraciones
python manage.py migrate
python manage.py makemigrations

python manage.py migrate core
python manage.py makemigration core

## para correrlo
 daphne -b 0.0.0.0 -p 8000 vaesite.asgi:application

 cree la funcion de obstaculo pero no la integre
 el promt tiene que ser algo que genere un bucle paralizando todo, no solo no enviando el mjs pq cuando se siga una rutina se perderian pasos pero larutirna seguiria mandando los pasos

 