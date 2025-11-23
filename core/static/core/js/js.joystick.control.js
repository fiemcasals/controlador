// static/core/js/js.joystick.control.js
// Control del joystick táctil: calcula ángulo y lo envía al auto.

import { updateControlState } from "./ws.client.js";

window.addEventListener("DOMContentLoaded", () => {
  const joystick = document.querySelector(".joystick");
  const stick    = document.querySelector(".stick");

  let isDragging = false;
  let joystickTouchId = null; // ← identificador del dedo del joystick

  const angulo = { angle: 90 };

  function findTouchById(ev, id) {
    if (!ev.touches || ev.touches.length === 0) return null;
    if (id == null) return ev.touches[0];

    for (let i = 0; i < ev.touches.length; i++) {
      const t = ev.touches[i];
      if (t.identifier === id) return t;
    }
    return ev.touches[0];
  }

  function startDragging(ev) {
    ev.preventDefault();
    isDragging = true;

    const t0 =
      (ev.changedTouches && ev.changedTouches[0]) ||
      (ev.touches && ev.touches[0]) ||
      null;
    joystickTouchId = t0 ? t0.identifier : null;

    if (stick) stick.style.transition = "none";

    // Actualizamos una vez para no tener que esperar a touchmove
    drag(ev);
  }

  function stopDragging(ev) {
    if (!isDragging) return;

    // Si tenemos id de touch, aseguramos que el evento que llega
    // corresponde a ese dedo (para no cortar por el otro dedo).
    if (ev && ev.changedTouches && joystickTouchId != null) {
      let esNuestro = false;
      for (let i = 0; i < ev.changedTouches.length; i++) {
        if (ev.changedTouches[i].identifier === joystickTouchId) {
          esNuestro = true;
          break;
        }
      }
      if (!esNuestro) return; // se levantó el otro dedo, seguimos arrastrando
    }

    isDragging = false;
    joystickTouchId = null;

    if (stick) {
      stick.style.transition = "all 0.1s ease";
      stick.style.transform = "translate(-50%, -50%)"; // vuelve al centro
    }
  }

  function drag(ev) {
    if (!isDragging || !joystick || !stick) return;

    const joystickRect = joystick.getBoundingClientRect();
    const stickRect    = stick.getBoundingClientRect();

    const touch = findTouchById(ev, joystickTouchId);
    if (!touch) return;

    const offsetX =
      touch.clientX - joystickRect.left - joystickRect.width / 2;
    const offsetY =
      touch.clientY - joystickRect.top - joystickRect.height / 2;

    const maxOffset = joystickRect.width / 2 - stickRect.width / 2;
    const distance = Math.min(
      Math.hypot(offsetX, offsetY),
      maxOffset
    );

    const angleRad = Math.atan2(offsetY, offsetX);
    const angleDeg = angleRad * (180 / Math.PI);

    // --- CÁLCULO DE ÁNGULO MODIFICADO: 0° ARRIBA, CRECE HORARIO ---
    
    // 1. Sumar 90 grados: esto rota el 0° (que estaba a la derecha) hacia la parte superior.
    //    Como el eje Y está invertido en la pantalla, esta suma hace que el ángulo aumente en sentido horario.
    let adjustedAngle = angleDeg + 100; 

    // 2. Ajustar al rango de 0 a 360 grados
    adjustedAngle = adjustedAngle % 360;
    if (adjustedAngle < 0) {
        adjustedAngle += 360;
    }

    // 3. Aplicar el ajuste final de -17 grados
    angulo.angle = adjustedAngle - 17;
    
    // --- FIN CÁLCULO DE ÁNGULO MODIFICADO ---

    const x = distance * Math.cos(angleRad);
    const y = distance * Math.sin(angleRad);

    stick.style.transform =
      `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    updateControlState({ angle: angulo.angle });
  }

  if (joystick && stick) {
    joystick.addEventListener("touchstart", startDragging, {
      passive: false,
    });
    window.addEventListener("touchend", stopDragging);
    window.addEventListener("touchcancel", stopDragging);
    window.addEventListener("touchmove", drag, {
      passive: false,
    });
  }
});