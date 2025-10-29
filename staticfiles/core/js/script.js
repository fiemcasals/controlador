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

// === ESTADO ===
let isDragging = false;
let angleDeg = 0;     // -180..180, 0 arriba
let ac = 0;           // 0..100
let fondoEscala = 0;  // 0.3/0.6/1 según botón
let lastSent = { angle: null, ac: null };
const SEND_EVERY_MS = 50;

// === UTILS ===
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const norm180 = a => ((a + 180) % 360) - 180;

// === WS ===
function connectWebSocket() {
  try {
    const ws = new WebSocket(servidor);
    ws.onopen = () => {
      console.log('WS conectado a', servidor);
      // Envía en=1 al conectar
      try { ws.send(JSON.stringify({ en: 1 })); } catch {}
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.encendido === true) {
          // conf del server, podemos reenviar en=1 si querés:
          try { ws.send(JSON.stringify({ en: 1 })); } catch {}
        }
        // console.log('<<', msg);
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

// === JOYSTICK: mouse + touch ===
function canvasCenter() {
  const rect = joystick.getBoundingClientRect();
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, r: rect.width / 2 };
}

function pointFromEvent(e) {
  if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function posToAngle(e) {
  const { cx, cy } = canvasCenter();
  const p = pointFromEvent(e);
  const dx = p.x - cx;
  const dy = p.y - cy;
  const a = Math.atan2(dy, dx) * 180 / Math.PI + 90; // 0° arriba
  return norm180(a);
}

function placeKnob() {
  const rect = joystick.getBoundingClientRect();
  const r = rect.width / 2;
  const rad = (angleDeg - 90) * Math.PI / 180;
  const kR = r * 0.45;
  const x = kR * Math.cos(rad);
  const y = kR * Math.sin(rad);
  // Suponiendo que .stick está centrado con transform-origin centro,
  // sumamos -50% para mantener centrado y le aplicamos el delta:
  stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

function startDragging(e) {
  e.preventDefault();
  isDragging = true;
  stick.style.transition = 'none';
  angleDeg = posToAngle(e);
  placeKnob();
}
function drag(e) {
  if (!isDragging) return;
  angleDeg = posToAngle(e);
  placeKnob();
}
function stopDragging() {
  if (!isDragging) return;
  isDragging = false;
  stick.style.transition = 'all 0.1s ease';
  // si querés que vuelva al centro, descomentá:
  // angleDeg = 0; placeKnob();
}

// Pointer Events (si están), sino mouse/touch
if (window.PointerEvent) {
  joystick.addEventListener('pointerdown', startDragging);
  window.addEventListener('pointermove', drag);
  window.addEventListener('pointerup', stopDragging);
} else {
  // mouse
  joystick.addEventListener('mousedown', startDragging);
  window.addEventListener('mousemove', drag);
  window.addEventListener('mouseup', stopDragging);
  // touch
  joystick.addEventListener('touchstart', startDragging, { passive:false });
  window.addEventListener('touchmove', drag, { passive:false });
  window.addEventListener('touchend', stopDragging);
}

// === BARRA DE ACELERACIÓN ===
let isAcelerando = false;

function starAcelerar(e) {
  isAcelerando = true;
  e.preventDefault();
}
function acelerar(e) {
  if (!isAcelerando) return;
  const rect = barra.getBoundingClientRect();
  let p = (e.touches && e.touches.length) ? e.touches[0] : e;
  const raw = ((rect.bottom - p.clientY) / rect.height) * 100;
  let value = clamp(raw, 0, 100);             // 0..100 base
  ac = Math.round(value * fondoEscala);       // escala Baja/Media/Alta
  sliderEl.style.height = value + '%';
  sliderEl.style.transition = '0.1s';
  valueEl.textContent = String(Math.round(value));
}
function stopAcelerar() {
  isAcelerando = false;
  valueEl.textContent = '0';
  sliderEl.style.height = '0%';
  ac = 0;
}

barra.addEventListener('touchstart', starAcelerar, { passive:false });
barra.addEventListener('touchmove',  acelerar,      { passive:false });
barra.addEventListener('touchend',   stopAcelerar);

barra.addEventListener('mousedown', starAcelerar);
barra.addEventListener('mousemove', acelerar);
window.addEventListener('mouseup',  stopAcelerar);

// Botones de escala (Baja/Media/Alta)
B_baja .addEventListener('click', () => { fondoEscala = 0.3; B_baja.style.backgroundColor="rgb(0,255,8)"; B_media.style.backgroundColor="#f00"; B_alta.style.backgroundColor="#f00"; });
B_media.addEventListener('click', () => { fondoEscala = 0.6; B_baja.style.backgroundColor="#f00";        B_media.style.backgroundColor="rgb(0,255,8)"; B_alta.style.backgroundColor="#f00"; });
B_alta .addEventListener('click', () => { fondoEscala = 1.0; B_baja.style.backgroundColor="#f00";        B_media.style.backgroundColor="#f00";         B_alta.style.backgroundColor="rgb(0,255,8)"; });

// === ENCENDIDO (conexión WS) ===
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

// === LOOP DE ENVÍO (20 Hz) SOLO SI CAMBIÓ ===
setInterval(() => {
  if (!webSocket || webSocket.readyState !== 1) return;
  const payload = { angle: +angleDeg.toFixed(1), ac: ac|0 };
  if (payload.angle !== lastSent.angle || payload.ac !== lastSent.ac) {
    sendIfOpen(payload);
    lastSent = payload;
  }
}, SEND_EVERY_MS);

// Knob inicial
placeKnob();
