# core/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("recorridos/", views.recorridos_page, name="recorridos_page"),
    path("api/recorridos/start", views.api_recorridos_start, name="api_recorridos_start"),
    path("api/recorridos/stop", views.api_recorridos_stop, name="api_recorridos_stop"),
    path("api/recorridos", views.api_recorridos_list, name="api_recorridos_list"),
    path("api/recorridos/<int:traj_id>/points", views.api_recorridos_points, name="api_recorridos_points"),
    path("api/recorridos/point", views.api_recorridos_point, name="api_recorridos_point"),
    path("", views.home, name="home"),
]
