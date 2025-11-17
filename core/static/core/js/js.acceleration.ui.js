// static/core/js/js.acceleration.ui.js
// Barra de aceleración + botones de escala (baja, media, alta).

import { obstaculoAlFrente } from "./seguridad.js";
import { sendPayload } from "./ws.client.js";

window.addEventListener("DOMContentLoaded", () => {
  const byId = (id) => document.getElementById(id);

  const slider = byId("slider");
  const barra = byId("barra");
  const valueElement = byId("value");

  // Escala inicial: alta (1.0) para que, si no tocan botones, algo acelere
  let fondoEscala = 1.0;
  let isAcelerando = false;
  let accelTimer = null;   // timer que reenvía mientras está presionado

  const _Acelerar = { ac: 0 };

  function enviarAceleracion() {
    if (!isAcelerando) return;
    if (obstaculoAlFrente()) return;

    // Mandamos con un throttle interno de ws.client.js (ej: 50ms)
    sendPayload(_Acelerar, 50);
  }

  function startAccelTimer() {
    if (accelTimer !== null) return;  // ya está corriendo
    accelTimer = setInterval(enviarAceleracion, 100); // cada 100 ms
  }

  function stopAccelTimer() {
    if (accelTimer !== null) {
      clearInterval(accelTimer);
      accelTimer = null;
    }
  }

  function acelerar(ev) {
    if (!isAcelerando || !barra || !slider || !valueElement) return;

    const rect = barra.getBoundingClientRect();
    const t0 = ev.touches && ev.touches[0] ? ev.touches[0] : null;
    if (!t0) return;

    let value = ((rect.bottom - t0.clientY) / rect.height) * 100;
    if (value > 100) value = 100;
    if (value < 0) value = 0;

    console.log("valor de aceleracion UI (0..100): ", value);

    _Acelerar.ac = value * fondoEscala;
    console.log("ac (con escala): ", _Acelerar.ac);

    slider.style.height = value + "%";
    slider.style.transition = "0.1s";
    valueElement.textContent = Math.round(value) + "%";

    // Enviamos una vez para reacción rápida
    if (!obstaculoAlFrente()) {
      sendPayload(_Acelerar, 50);
    }
  }

  function startAcelerar(ev) {
    isAcelerando = true;
    ev.preventDefault();

    // Por si el usuario toca pero no mueve el dedo: arrancamos el timer
    startAccelTimer();
  }

  function stopAcelerar() {
    isAcelerando = false;
    stopAccelTimer();

    if (valueElement) valueElement.textContent = "0%";
    if (slider) slider.style.height = "0%";

    _Acelerar.ac = 0;
    // Mandamos ac=0 para que el auto "suelte el acelerador"
    sendPayload(_Acelerar, 50);
  }

  if (barra) {
    barra.addEventListener("touchstart", startAcelerar, { passive: false });
    barra.addEventListener("touchmove", acelerar, { passive: false });
    barra.addEventListener("touchend", stopAcelerar);
    barra.addEventListener("touchcancel", stopAcelerar);
  }

  // ---- Botones de escala ----
  const B_baja = byId("B_baja");
  const B_media = byId("B_media");
  const B_alta = byId("B_alta");

  // Helper para setear colores
  function setEscalaButtons(activa) {
    if (B_baja)  B_baja.style.backgroundColor  = (activa === "baja"  ? "rgb(0, 255, 8)" : "#f00");
    if (B_media) B_media.style.backgroundColor = (activa === "media" ? "rgb(0, 255, 8)" : "#f00");
    if (B_alta)  B_alta.style.backgroundColor  = (activa === "alta"  ? "rgb(0, 255, 8)" : "#f00");
  }

  if (B_baja) {
    B_baja.addEventListener("click", () => {
      fondoEscala = 0.3;
      setEscalaButtons("baja");
    });
  }
  if (B_media) {
    B_media.addEventListener("click", () => {
      fondoEscala = 0.6;
      setEscalaButtons("media");
    });
  }
  if (B_alta) {
    B_alta.addEventListener("click", () => {
      fondoEscala = 1.0;
      setEscalaButtons("alta");
    });
  }

  // Estado inicial: alta seleccionada
  setEscalaButtons("alta");
});
