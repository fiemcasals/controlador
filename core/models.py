from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class SessionLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="session_logs")
    session_key = models.CharField(max_length=64, db_index=True)
    login_at = models.DateTimeField(auto_now_add=True)
    logout_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user} [{self.session_key}]"
