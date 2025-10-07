from django.dispatch import receiver
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.db.models.signals import post_migrate
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import SessionLog

@receiver(user_logged_in)
def on_login(sender, request, user, **kwargs):
    if not request.session.session_key:
        request.session.save()
    SessionLog.objects.create(user=user, session_key=request.session.session_key)

@receiver(user_logged_out)
def on_logout(sender, request, user, **kwargs):
    sk = getattr(request.session, 'session_key', None)
    if user and sk:
        try:
            log = SessionLog.objects.filter(user=user, session_key=sk, logout_at__isnull=True).latest("login_at")
            log.logout_at = timezone.now()
            log.save(update_fields=["logout_at"])
        except SessionLog.DoesNotExist:
            pass

@receiver(post_migrate)
def ensure_admin_user(sender, **kwargs):
    # Crear/asegurar superusuario luego de migraciones
    User = get_user_model()
    if not User.objects.filter(username="VAEcontrolador").exists():
        try:
            User.objects.create_superuser(username="VAEcontrolador", password="micontroladorVAE", email="")
            print(">> Superusuario 'VAEcontrolador' creado.")
        except Exception as e:
            print("Aviso creando superusuario:", e)
