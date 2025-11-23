// static/core/js/js.acceleration.ui.js
// Barra de aceleración + botones de escala (baja, media, alta).

import { obstaculoAlFrente } from "./seguridad.js";
import { updateControlState  } from "./ws.client.js";

window.addEventListener("DOMContentLoaded", () => {
  const byId = (id) => document.getElementById(id);

  const slider = byId("slider");      // barra interna
  const barra  = byId("barra");       // contenedor táctil
  const valueElement = byId("value"); // texto porcentaje

  // Escala inicial: alta (1.0)
  let fondoEscala = 1.0;

  let isAcelerando = false;
  let accelTimer = null;
  let accelTouchId = null; // ← identificador del dedo que controla la barra

  const _Acelerar = { ac: 0 };

  function enviarAceleracion() {
    if (!isAcelerando) return;
    if (obstaculoAlFrente()) return; // no avanzar si hay persona

    updateControlState({ ac: _Acelerar.ac });
  }

  function startAccelTimer() {
    if (accelTimer !== null) return;
    accelTimer = setInterval(enviarAceleracion, 50);
  }

  function stopAccelTimer() {
    if (accelTimer !== null) {
      clearInterval(accelTimer);
      accelTimer = null;
    }
  }

  // Busca el touch con el identificador que nos interesa
  function findTouchById(ev, id) {
    if (!ev.touches || ev.touches.length === 0) return null;
    if (id == null) return ev.touches[0];

    for (let i = 0; i < ev.touches.length; i++) {
      const t = ev.touches[i];
      if (t.identifier === id) return t;
    }
    // Si no lo encontramos, devolvemos el primero para no reventar
    return ev.touches[0];
  }

  function acelerar(ev) {
    if (!isAcelerando || !barra || !slider || !valueElement) return;

    const rect = barra.getBoundingClientRect();
    const touch = findTouchById(ev, accelTouchId);
    if (!touch) return;

    let value =
      ((rect.bottom - touch.clientY) / rect.height) * 100;

    if (value > 100) value = 100;
    if (value < 0) value = 0;

    //console.log("valor de aceleracion UI (0..100): ", value);

    _Acelerar.ac = value * fondoEscala;
    //console.log("ac (con escala): ", _Acelerar.ac);

    slider.style.height = value + "%";
    slider.style.transition = "0.1s";

    valueElement.textContent = Math.round(value) + "%";

    if (!obstaculoAlFrente()) {
      updateControlState(_Acelerar);
    }
  }

  function startAcelerar(ev) {
    if (!barra) return;

    isAcelerando = true;
    ev.preventDefault();

    const t0 =
      (ev.changedTouches && ev.changedTouches[0]) ||
      (ev.touches && ev.touches[0]) ||
      null;

    accelTouchId = t0 ? t0.identifier : null;

    startAccelTimer();
    if (t0) {
      // Ajustamos una vez inicial
      acelerar(ev);
    }
  }

  function stopAcelerar() {
  isAcelerando = false;
  accelTouchId = null;
  stopAccelTimer(); // ← frena interval

  if (valueElement) valueElement.textContent = "0%";
  if (slider) slider.style.height = "0%";

  _Acelerar.ac = 0;

  // 🚨 frenar siempre, aunque haya obstáculo
  updateControlState({ ac: 0 });
}


  if (barra) {
    barra.addEventListener("touchstart", startAcelerar, {
      passive: false,
    });
    barra.addEventListener("touchmove", acelerar, {
      passive: false,
    });
    barra.addEventListener("touchend", stopAcelerar);
    barra.addEventListener("touchcancel", stopAcelerar);
  }

  // Botones de escala
  const B_baja  = byId("B_baja");
  const B_media = byId("B_media");
  const B_alta  = byId("B_alta");

  function setEscalaButtons(activa) {
    if (B_baja)
      B_baja.style.backgroundColor =
        activa === "baja" ? "rgb(0, 255, 8)" : "#f00";
    if (B_media)
      B_media.style.backgroundColor =
        activa === "media" ? "rgb(0, 255, 8)" : "#f00";
    if (B_alta)
      B_alta.style.backgroundColor =
        activa === "alta" ? "rgb(0, 255, 8)" : "#f00";
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

  setEscalaButtons("alta");
});

ws.onclose = () => {
  console.warn("WS cerrado → freno de seguridad");
  updateControlState({ ac: 0 });
};

window.addEventListener("blur", () => {
  stopAcelerar();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopAcelerar();
});

