from django.contrib import admin
from .models import SessionLog
from .models import Trajectory, TrajectoryPoint

@admin.register(SessionLog)
class SessionLogAdmin(admin.ModelAdmin):
    list_display = ("user","session_key","login_at","logout_at")
    list_filter = ("login_at","logout_at")
    search_fields = ("user__username","session_key")


@admin.register(Trajectory)
class TrajectoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "started_at", "ended_at", "is_active")
    search_fields = ("name",)
    list_filter = ("ended_at",)
    readonly_fields = ("started_at", "ended_at")

@admin.register(TrajectoryPoint)
class TrajectoryPointAdmin(admin.ModelAdmin):
    list_display = ("id", "trajectory", "ts", "angle", "ac", "en")
    list_filter = ("trajectory",)
    search_fields = ("trajectory__name",)
    readonly_fields = ("ts",)
