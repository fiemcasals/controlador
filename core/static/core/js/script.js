// === ELEMENTOS ===
const joystick = document.querySelector('.joystick');
const stick    = document.querySelector('.stick');
const barra    = document.getElementById('barra');
const sliderEl = document.getElementById('slider');
const valueEl  = document.getElementById('value');

const B_baja  = document.getElementById('B_baja');
const B_media = document.getElementById('B_media');
const B_alta  = document.getElementById('B_alta');

const encendidoBtn = document.getElementById('encendido');

let webSocket = null;

// === WS URL (incluye puerto si corresponde) ===
const host = window.location.host; // hostname:port
const servidor = (location.protocol === 'https:' ? 'wss://' : 'ws://') + host + '/ws';

// === ESTADO GENERAL ===
let angleDeg = 0;     // -180..180, 0 arriba
let ac = 0;           // 0..100 (final tras escala)
let fondoEscala = 0;  // 0.3/0.6/1 según botón

const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const norm180 = a => ((a + 180) % 360) - 180;

// === WS ===
function connectWebSocket() {
  try {
    const ws = new WebSocket(servidor);
    ws.onopen = () => {
      console.log('WS conectado a', servidor);
      try { ws.send(JSON.stringify({ en: 1 })); } catch {}
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.encendido === true) {
          try { ws.send(JSON.stringify({ en: 1 })); } catch {}
        }
      } catch {}
    };
    ws.onclose = (e) => console.log('WS cerrado', e.code, e.reason || '');
    ws.onerror = (e) => console.log('WS error', e);
    return ws;
  } catch (err) {
    console.error('Error WS:', err);
    return null;
  }
}
function sendIfOpen(obj) {
  if (webSocket && webSocket.readyState === 1) {
    try { webSocket.send(JSON.stringify(obj)); } catch {}
  }
}

// === JOYSTICK (Pointer Events con lock por pointerId) ===
let activeId = null;           // pointerId que “posee” el joystick
let center = { x: 0, y: 0 };   // centro en px (viewport)
let radius = 0;                // radio en px
const SEND_EVERY_MS = 40;
let lastSendTs = 0;
let lastSent = { angle: null, ac: null };

function recalcGeometry() {
  if (!joystick) return;
  const r = joystick.getBoundingClientRect();
  center.x = r.left + r.width / 2;
  center.y = r.top + r.height / 2;
  radius   = Math.min(r.width, r.height) / 2;
}
function getThrottle() {
  const v = valueEl && valueEl.textContent ? parseFloat(valueEl.textContent) : 0;
  return Number.isFinite(v) ? v : 0;
}
function getEnable() {
  if (!encendidoBtn) return 0;
  const txt = (encendidoBtn.textContent || '').toLowerCase();
  return txt.includes('encendido') ? 1 : 0;
}
function placeKnobFromAngle() {
  if (!stick || !joystick) return;
  const r   = joystick.getBoundingClientRect();
  const rad = (angleDeg - 90) * Math.PI / 180;
  const kR  = Math.min(r.width, r.height) * 0.45 * 0.5; // 45% del radio (x0.5 porque r es diámetro/2)
  const dx  = kR * Math.cos(rad);
  const dy  = kR * Math.sin(rad);
  stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function emitIfNeeded() {
  const now = performance.now();
  if (now - lastSendTs < SEND_EVERY_MS) return;
  const payload = { angle: +angleDeg.toFixed(1), ac: ac|0 };
  if (payload.angle !== lastSent.angle || payload.ac !== lastSent.ac) {
    sendIfOpen(payload);
    lastSent = payload;
  }
  lastSendTs = now;
}
function xyFromEvent(e) {
  const x = (e.clientX ?? (e.touches && e.touches[0]?.clientX));
  const y = (e.clientY ?? (e.touches && e.touches[0]?.clientY));
  return { x, y };
}
function onJoyDown(e) {
  // si ya hay un pointer activo, ignorar
  if (activeId !== null) return;
  activeId = e.pointerId ?? 'mouse';
  // capturamos el pointer para seguir recibiendo move/up aunque salga del joystick
  stick?.setPointerCapture?.(e.pointerId);
  updateAngleFromEvent(e);
}
function onJoyMove(e) {
  if ((e.pointerId ?? 'mouse') !== activeId) return;
  updateAngleFromEvent(e);
}
function onJoyUpOrCancel(e) {
  if ((e.pointerId ?? 'mouse') !== activeId) return;
  activeId = null;
  stick?.releasePointerCapture?.(e.pointerId);
  // al soltar, recentrar visual (si querés dejar ángulo, comentá estas dos líneas)
  // angleDeg = 0;
  // placeKnobFromAngle();
  emitIfNeeded();
}
function updateAngleFromEvent(e) {
  e.preventDefault();
  const { x, y } = xyFromEvent(e);
  const dx = x - center.x;
  const dy = y - center.y;

  const dist = Math.hypot(dx, dy);
  const max  = radius * 0.9; // margen
  const clamped = Math.min(dist, max);

  const aRad = Math.atan2(dy, dx);     // -pi..pi (0 hacia derecha, y+ hacia abajo)
  // Convertir a nuestro sistema: 0° arriba
  let aDeg = aRad * 180 / Math.PI + 90;
  aDeg = norm180(aDeg);
  angleDeg = aDeg;

  // mover visual
  const ux = Math.cos(aRad) * clamped;
  const uy = Math.sin(aRad) * clamped;
  stick.style.transform = `translate(calc(-50% + ${ux}px), calc(-50% + ${uy}px))`;

  emitIfNeeded();
}

// listeners SOLO en el joystick (no en window/document)
if (joystick) {
  recalcGeometry();
  window.addEventListener('resize', recalcGeometry, { passive: true });

  if (window.PointerEvent) {
    joystick.addEventListener('pointerdown', onJoyDown);
    joystick.addEventListener('pointermove', onJoyMove);
    joystick.addEventListener('pointerup', onJoyUpOrCancel);
    joystick.addEventListener('pointercancel', onJoyUpOrCancel);
  } else {
    // Fallback mouse/touch (si fuera necesario)
    joystick.addEventListener('mousedown', (e)=>{ activeId='mouse'; onJoyDown(e); });
    joystick.addEventListener('mousemove', onJoyMove);
    joystick.addEventListener('mouseup',   onJoyUpOrCancel);
    joystick.addEventListener('touchstart', (e)=>{ activeId='touch'; onJoyDown(e); }, { passive:false });
    joystick.addEventListener('touchmove', onJoyMove, { passive:false });
    joystick.addEventListener('touchend',  onJoyUpOrCancel);
    joystick.addEventListener('touchcancel', onJoyUpOrCancel);
  }

  // knob inicial
  placeKnobFromAngle();
}

// === BARRA DE ACELERACIÓN ===
let isAcelerando = false;

function starAcelerar(e) {
  isAcelerando = true;
  e.preventDefault();
  e.stopPropagation(); // clave: que no “robe” el joystick
}
function acelerar(e) {
  if (!isAcelerando) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = barra.getBoundingClientRect();
  let p = (e.touches && e.touches.length) ? e.touches[0] : e;
  const raw = ((rect.bottom - p.clientY) / rect.height) * 100;
  const value = clamp(raw, 0, 100);             // 0..100 “visible”
  ac = Math.round(value * fondoEscala);         // escala: Baja/Media/Alta
  sliderEl.style.height = value + '%';
  sliderEl.style.transition = '0.08s';
  valueEl.textContent = String(Math.round(value));
}
function stopAcelerar(e) {
  if (!isAcelerando) return;
  e?.stopPropagation();
  isAcelerando = false;
  valueEl.textContent = '0';
  sliderEl.style.height = '0%';
  ac = 0;
}

if (barra) {
  // Pointer Events si existen
  if (window.PointerEvent) {
    barra.addEventListener('pointerdown', starAcelerar);
    barra.addEventListener('pointermove',  acelerar);
    barra.addEventListener('pointerup',    stopAcelerar);
    barra.addEventListener('pointercancel',stopAcelerar);
  } else {
    // Fallback mouse/touch
    barra.addEventListener('touchstart', starAcelerar, { passive:false });
    barra.addEventListener('touchmove',  acelerar,      { passive:false });
    barra.addEventListener('touchend',   stopAcelerar);
    barra.addEventListener('mousedown',  starAcelerar);
    barra.addEventListener('mousemove',  acelerar);
    window.addEventListener('mouseup',   stopAcelerar);
  }
}

// Botones de escala (Baja/Media/Alta)
if (B_baja && B_media && B_alta) {
  B_baja .addEventListener('click', () => { fondoEscala = 0.3; B_baja.style.backgroundColor="rgb(0,255,8)"; B_media.style.backgroundColor="#f00"; B_alta.style.backgroundColor="#f00"; });
  B_media.addEventListener('click', () => { fondoEscala = 0.6; B_baja.style.backgroundColor="#f00";        B_media.style.backgroundColor="rgb(0,255,8)"; B_alta.style.backgroundColor="#f00"; });
  B_alta .addEventListener('click', () => { fondoEscala = 1.0; B_baja.style.backgroundColor="#f00";        B_media.style.backgroundColor="#f00";         B_alta.style.backgroundColor="rgb(0,255,8)"; });
}

// === ENCENDIDO (conexión WS) ===
if (encendidoBtn) {
  encendidoBtn.addEventListener('click', () => {
    if (webSocket && webSocket.readyState === 1) {
      webSocket.close();
      webSocket = null;
      encendidoBtn.textContent = 'Apagado';
      encendidoBtn.style.backgroundColor = 'rgb(254,10,10)';
    } else {
      webSocket = connectWebSocket();
      encendidoBtn.textContent = 'Encendido';
      encendidoBtn.style.backgroundColor = 'rgb(0,255,38)';
    }
  });
}

// === BUCLE DE ENVÍO (20–25 Hz) ===
setInterval(() => {
  if (!webSocket || webSocket.readyState !== 1) return;
  emitIfNeeded();
}, SEND_EVERY_MS);
