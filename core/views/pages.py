# core/views/pages.py
from __future__ import annotations
from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse
from ..forms import RegisterForm

def home(request: HttpRequest) -> HttpResponse:
    return render(request, "core/home.html")

def register(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data["password"])
            user.save()
            login(request, user)
            return redirect("home")
    else:
        form = RegisterForm()
    return render(request, "registration/register.html", {"form": form})

@login_required
def camara(request: HttpRequest) -> HttpResponse:
    return render(request, "core/camara.html")

@login_required
def controlador(request: HttpRequest) -> HttpResponse:
    return render(request, "core/controlador.html")

@login_required
def mix_view(request: HttpRequest) -> HttpResponse:
    return render(request, "core/mix.html")

@login_required
def controlador_embed(request: HttpRequest) -> HttpResponse:
    return render(request, "core/joystick.html")
