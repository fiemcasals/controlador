// static/core/js/js.joystick.control.js
// Control del joystick táctil: calcula ángulo y lo envía al auto.

import { sendPayload } from "./ws.client.js";

window.addEventListener("DOMContentLoaded", () => {
  const joystick = document.querySelector(".joystick"); // contenedor
  const stick = document.querySelector(".stick"); // palito móvil

  let isDragging = false;
  const angulo = { angle: 90 };

  function startDragging(ev) {
    ev.preventDefault();
    isDragging = true;
    if (stick) stick.style.transition = "none";
  }

  function stopDragging() {
    if (!isDragging) return;
    isDragging = false;
    if (stick) {
      stick.style.transition = "all 0.1s ease";
      // Volver al centro visual del joystick
      stick.style.transform = "translate(-50%, -50%)";
    }
  }

  function drag(ev) {
    if (!isDragging || !joystick || !stick) return;

    const joystickRect = joystick.getBoundingClientRect();
    const stickRect = stick.getBoundingClientRect();

    // Primer dedo
    const touch = ev.touches && ev.touches[0] ? ev.touches[0] : null;
    if (!touch) return;

    const offsetX = touch.clientX - joystickRect.left - joystickRect.width / 2;
    const offsetY = touch.clientY - joystickRect.top - joystickRect.height / 2;

    const maxOffset = joystickRect.width / 2 - stickRect.width / 2;
    const distance = Math.min(Math.hypot(offsetX, offsetY), maxOffset);

    const angleRad = Math.atan2(offsetY, offsetX);
    const angleDeg = angleRad * (180 / Math.PI);

    // Ajuste original que ya tenías
    angulo.angle = angleDeg * -1 - 17;

    const x = distance * Math.cos(angleRad);
    const y = distance * Math.sin(angleRad);

    // Movimiento relativo al centro
    stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    // Enviar ángulo
    sendPayload(angulo);
  }

  if (joystick && stick) {
    joystick.addEventListener("touchstart", startDragging, { passive: false });
    window.addEventListener("touchend", stopDragging);
    window.addEventListener("touchmove", drag, { passive: false });
  }
});
