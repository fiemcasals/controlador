from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.http import StreamingHttpResponse
from .forms import RegisterForm

import time
import cv2
import os
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROTOTXT = os.path.join(BASE_DIR, "MobileNetSSD_deploy.prototxt.txt")
MODEL = os.path.join(BASE_DIR, "MobileNetSSD_deploy.caffemodel")

CLASSES = {0:"background",1:"aeroplane",2:"bicycle",3:"bird",4:"boat",5:"bottle",6:"bus",7:"car",
           8:"cat",9:"chair",10:"cow",11:"diningtable",12:"dog",13:"horse",14:"motorbike",15:"person",
           16:"pottedplant",17:"sheep",18:"sofa",19:"train",20:"tvmonitor"}

USE_DETECT = os.path.exists(PROTOTXT) and os.path.exists(MODEL)
NET = None
if USE_DETECT:
    try:
        NET = cv2.dnn.readNetFromCaffe(PROTOTXT, MODEL)
    except Exception as e:
        print("No se pudo cargar MobileNetSSD:", e)
        NET = None

def home(request):
    return render(request, "core/home.html")

def register(request):
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
def camara(request):
    return render(request, "core/camara.html")

@login_required
def controlador(request):
    return render(request, "core/control_panel.html")

@login_required
def mix_view(request):
    return render(request, "core/mix.html")

def generate_frames():
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FPS, 30)
    prev_time = 0
    target_fps = 25
    frame_time = 1 / target_fps
    while True:
        time_elapsed = time.time() - prev_time
        if time_elapsed < frame_time:
            time.sleep(frame_time - time_elapsed)
        success, frame = cap.read()
        if not success:
            break
        prev_time = time.time()

        h, w = frame.shape[:2]
        left_half = frame[:, :w//2]
        frame_out = cv2.resize(left_half, (w, h*2))

        if NET is not None:
            blob = cv2.dnn.blobFromImage(cv2.resize(left_half, (300, 300)), 0.007843, (300, 300), (127.5,127.5,127.5))
            NET.setInput(blob)
            detections = NET.forward()
            H, W = frame_out.shape[:2]
            for det in detections[0][0]:
                conf = det[2]
                if conf > 0.45:
                    class_id = int(det[1])
                    label = CLASSES.get(class_id,"unknown")
                    box = det[3:7] * np.array([W,H,W,H])
                    x1,y1,x2,y2 = box.astype(int)
                    cv2.rectangle(frame_out,(x1,y1),(x2,y2),(0,255,0),2)
                    cv2.putText(frame_out, label, (x1, y1 - 25), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,255,255), 2)
                    cv2.putText(frame_out, f"Conf: {conf*100:.2f}%", (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,0,0), 2)

        ret, buffer = cv2.imencode(".jpg", frame_out)
        if not ret:
            continue
        frame_bytes = buffer.tobytes()
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")

@login_required
def video_feed(request):
    return StreamingHttpResponse(generate_frames(), content_type="multipart/x-mixed-replace; boundary=frame")



@login_required
def monitor_view(request):
    return render(request, "core/monitor.html")
    
 


@login_required
def controlador_embed(request):
    # versión sin navbar para iframes en /mix
    return render(request, "core/controlador_embed.html")
