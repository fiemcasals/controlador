from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class SessionLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="session_logs")
    session_key = models.CharField(max_length=64, db_index=True)
    login_at = models.DateTimeField(auto_now_add=True)
    logout_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user} [{self.session_key}]"



class Trajectory(models.Model):
    name = models.CharField(max_length=120)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        fin = self.ended_at.strftime("%Y-%m-%d %H:%M:%S") if self.ended_at else "en curso"
        return f"{self.name} ({self.started_at:%Y-%m-%d %H:%M} → {fin})"

    @property
    def is_active(self):
        return self.ended_at is None


class TrajectoryPoint(models.Model):
    trajectory = models.ForeignKey(Trajectory, on_delete=models.CASCADE, related_name="points")
    ts = models.DateTimeField(default=timezone.now)
    angle = models.FloatField(null=True, blank=True)
    ac = models.FloatField(null=True, blank=True)
    en = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["ts"]
