from django.contrib import admin
from .models import SessionLog

@admin.register(SessionLog)
class SessionLogAdmin(admin.ModelAdmin):
    list_display = ("user","session_key","login_at","logout_at")
    list_filter = ("login_at","logout_at")
    search_fields = ("user__username","session_key")
