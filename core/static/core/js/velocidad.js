// Módulo: Velocidad (slider + presets + encendido)
(function () {
  const slider = document.getElementById('slider');
  const value = document.getElementById('value');
  const bBaja = document.getElementById('B_baja');
  const bMedia = document.getElementById('B_media');
  const bAlta = document.getElementById('B_alta');
  const encendido = document.getElementById('encendido');

  if (!slider || !value || !bBaja || !bMedia || !bAlta || !encendido) return;

  let isOn = false;
  let speed = 0; // 0..100

  const emit = () => {
    document.dispatchEvent(new CustomEvent('speed:change', {
      detail: { speed, isOn }
    }));
  };

  const drawSlider = () => {
    value.textContent = speed;
    // Asumimos slider vertical con altura conocida vía CSS
    const h = slider.parentElement.clientHeight || 200;
    const y = h - (speed / 100) * h;
    slider.style.transform = `translateY(${y - (slider.clientHeight / 2)}px)`;
  };

  const setSpeed = (s) => { speed = Math.max(0, Math.min(100, s)); drawSlider(); emit(); };

  // Drag del slider (área contenedora)
  const container = slider.parentElement;
  const toSpeedFromY = (clientY) => {
    const rect = container.getBoundingClientRect();
    const rel = rect.bottom - clientY; // 0..h
    const pct = Math.max(0, Math.min(1, rel / rect.height));
    return Math.round(pct * 100);
  };
  const onDown = (e) => {
    const clientY = (e.touches?.[0]?.clientY ?? e.clientY);
    setSpeed(toSpeedFromY(clientY));
    dragging = true;
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!dragging) return;
    const clientY = (e.touches?.[0]?.clientY ?? e.clientY);
    setSpeed(toSpeedFromY(clientY));
  };
  const onUp = () => { dragging = false; };
  let dragging = false;

  container.addEventListener('mousedown', onDown);
  container.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);

  // Presets
  bBaja.addEventListener('click', () => setSpeed(25));
  bMedia.addEventListener('click', () => setSpeed(50));
  bAlta.addEventListener('click', () => setSpeed(100));

  // Encendido / Apagado
  const toggleOn = () => {
    isOn = !isOn;
    encendido.textContent = isOn ? 'Encendido' : 'Apagado';
    encendido.classList.toggle('is-on', isOn);
    emit();
  };
  encendido.addEventListener('click', toggleOn);

  // Inicial
  drawSlider();
  emit();
})();
