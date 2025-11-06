// Módulo: Dirección (joystick)
(function () {
  const joy = document.getElementById('joy');
  const stick = document.getElementById('stick');

  if (!joy || !stick) return;

  const radius = Math.min(joy.clientWidth, joy.clientHeight) / 2;
  const center = { x: joy.offsetLeft + radius, y: joy.offsetTop + radius };

  let dragging = false;

  const setStick = (dx, dy) => {
    // Limitar al círculo
    const dist = Math.hypot(dx, dy);
    const max = radius - stick.clientWidth / 2;
    const scale = dist > max ? max / dist : 1;
    const x = dx * scale;
    const y = dy * scale;
    stick.style.transform = `translate(${x}px, ${y}px)`;

    // Ángulo (−180..+180), y magnitud (0..1)
    const angle = Math.atan2(y, x) * (180 / Math.PI);
    const mag = Math.min(1, Math.hypot(x, y) / max);

    // Emitir evento para quien lo necesite
    document.dispatchEvent(new CustomEvent('direction:change', {
      detail: { angle, magnitude: mag }
    }));
  };

  const resetStick = () => {
    stick.style.transform = 'translate(0, 0)';
    document.dispatchEvent(new CustomEvent('direction:change', {
      detail: { angle: 0, magnitude: 0 }
    }));
  };

  const getLocalOffset = (evt) => {
    const rect = joy.getBoundingClientRect();
    const clientX = (evt.touches?.[0]?.clientX ?? evt.clientX);
    const clientY = (evt.touches?.[0]?.clientY ?? evt.clientY);
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    return { dx, dy };
  };

  const start = (e) => { dragging = true; e.preventDefault(); };
  const move = (e) => {
    if (!dragging) return;
    const { dx, dy } = getLocalOffset(e);
    setStick(dx, dy);
  };
  const end = () => { dragging = false; resetStick(); };

  joy.addEventListener('mousedown', start);
  joy.addEventListener('touchstart', start, { passive: false });

  window.addEventListener('mousemove', move);
  window.addEventListener('touchmove', move, { passive: false });

  window.addEventListener('mouseup', end);
  window.addEventListener('touchend', end);
})();
