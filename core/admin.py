# core/admin.py
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.db.models import Count, Q, F, ExpressionWrapper, DurationField
from django.http import HttpResponse
import csv

from .models import SessionLog, Trajectory, TrajectoryPoint


# =========================
#  Utilidades y filtros
# =========================

class ActiveTrajectoryFilter(admin.SimpleListFilter):
    """Filtro Sí/No para trayectorias activas (sin ended_at)."""
    title = "activa"
    parameter_name = "is_active"

    def lookups(self, request, model_admin):
        return (("1", "Sí (en curso)"), ("0", "No (finalizada)"))

    def queryset(self, request, queryset):
        if self.value() == "1":
            return queryset.filter(ended_at__isnull=True)
        if self.value() == "0":
            return queryset.filter(ended_at__isnull=False)
        return queryset


class ActiveSessionFilter(admin.SimpleListFilter):
    """Filtro Sí/No para sesiones abiertas (sin logout_at)."""
    title = "sesión abierta"
    parameter_name = "is_open"

    def lookups(self, request, model_admin):
        return (("1", "Sí (abierta)"), ("0", "No (cerrada)"))

    def queryset(self, request, queryset):
        if self.value() == "1":
            return queryset.filter(logout_at__isnull=True)
        if self.value() == "0":
            return queryset.filter(logout_at__isnull=False)
        return queryset


# =========================
#  Inlines
# =========================

class TrajectoryPointInline(admin.TabularInline):
    model = TrajectoryPoint
    extra = 0
    ordering = ("ts",)
    fields = ("ts", "angle", "ac", "en")
    # Podés volver 'ts' de solo-lectura si lo deseás:
    # readonly_fields = ("ts",)
    # Evita consultas N+1
    autocomplete_fields = ("trajectory",)  # no se muestra, pero ayuda si lo habilitás en el admin independiente


# =========================
#  SessionLog Admin
# =========================

@admin.register(SessionLog)
class SessionLogAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "short_session_key",
        "login_at",
        "logout_at",
        "is_open",
        "duration_human",
    )
    list_filter = (ActiveSessionFilter, "login_at", "logout_at")
    date_hierarchy = "login_at"
    search_fields = (
        "session_key",
        "user__username",
        "user__first_name",
        "user__last_name",
        "user__email",
    )
    list_select_related = ("user",)
    # Si tu User admin no tiene search_fields para autocomplete, cambiá por raw_id_fields = ('user',)
    autocomplete_fields = ("user",)
    # raw_id_fields = ("user",)

    @admin.display(description="clave (…últimos 8)", ordering="session_key")
    def short_session_key(self, obj: SessionLog):
        return f"…{obj.session_key[-8:]}" if obj.session_key else "—"

    @admin.display(boolean=True, description="abierta")
    def is_open(self, obj: SessionLog):
        return obj.logout_at is None

    @admin.display(description="duración")
    def duration_human(self, obj: SessionLog):
        end = obj.logout_at or timezone.now()
        delta = end - obj.login_at
        # Formato breve hh:mm:ss
        total_seconds = int(delta.total_seconds())
        h, r = divmod(total_seconds, 3600)
        m, s = divmod(r, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"


# =========================
#  Trajectory Admin
# =========================

@admin.register(Trajectory)
class TrajectoryAdmin(admin.ModelAdmin):
    inlines = [TrajectoryPointInline]

    list_display = (
        "name",
        "started_at",
        "ended_at",
        "is_active_bool",
        "points_count",
        "duration_human",
    )
    list_filter = (ActiveTrajectoryFilter, "started_at", "ended_at")
    search_fields = ("name",)
    date_hierarchy = "started_at"
    ordering = ("-started_at",)
    actions = ("end_now", "export_csv")
    # Optimiza conteo de points
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Anota cantidad de puntos y duración (si existe ended_at)
        duration_expr = ExpressionWrapper(
            F("ended_at") - F("started_at"),
            output_field=DurationField()
        )
        return (
            qs.annotate(_points_count=Count("points"))
              .annotate(_duration=duration_expr)
        )

    @admin.display(boolean=True, description="activa", ordering="ended_at")
    def is_active_bool(self, obj: Trajectory):
        return obj.ended_at is None

    @admin.display(description="puntos", ordering="_points_count")
    def points_count(self, obj: Trajectory):
        # Si no vino anotado, fallback rápido
        return getattr(obj, "_points_count", obj.points.count())

    @admin.display(description="duración")
    def duration_human(self, obj: Trajectory):
        end = obj.ended_at or timezone.now()
        delta = end - obj.started_at
        total_seconds = int(delta.total_seconds())
        h, r = divmod(total_seconds, 3600)
        m, s = divmod(r, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    # ----- Acciones -----

    @admin.action(description="Finalizar ahora las trayectorias seleccionadas")
    def end_now(self, request, queryset):
        updated = queryset.filter(ended_at__isnull=True).update(ended_at=timezone.now())
        self.message_user(request, f"Se finalizaron {updated} trayectorias.")

    @admin.action(description="Exportar a CSV (nombre, inicio, fin, activa, puntos)")
    def export_csv(self, request, queryset):
        # Genera un CSV simple con columnas útiles
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="trayectorias.csv"'
        writer = csv.writer(response)
        writer.writerow(["name", "started_at", "ended_at", "is_active", "points"])
        # Para evitar N+1 en conteo
        qs = queryset.annotate(points_total=Count("points"))
        for t in qs:
            writer.writerow([
                t.name,
                t.started_at.isoformat(),
                t.ended_at.isoformat() if t.ended_at else "",
                "1" if t.ended_at is None else "0",
                t.points_total,
            ])
        return response


# =========================
#  TrajectoryPoint Admin
# =========================

@admin.register(TrajectoryPoint)
class TrajectoryPointAdmin(admin.ModelAdmin):
    list_display = ("trajectory", "ts", "angle", "ac", "en")
    list_filter = ("trajectory", "ts")
    date_hierarchy = "ts"
    search_fields = ("trajectory__name",)
    ordering = ("-ts",)
    list_select_related = ("trajectory",)
    # Para trayectorias grandes, esto agiliza la selección
    autocomplete_fields = ("trajectory",)
    # Alternativa si no tenés autocomplete en TrajectoryAdmin: 
    # raw_id_fields = ("trajectory",)
