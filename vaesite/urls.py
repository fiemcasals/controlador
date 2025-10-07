from django.contrib import admin
from django.urls import path, include
from core import views as core_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('django.contrib.auth.urls')),
    path('registrarse/', core_views.register, name='register'),
    path('', core_views.home, name='home'),
    path('camara/', core_views.camara, name='camara'),
    path('video_feed/', core_views.video_feed, name='video_feed'),
    path('controlador/', core_views.controlador, name='controlador'),
    path('mix/', core_views.mix_view, name='mix'),
]
