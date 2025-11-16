// static/core/js/script.js
import { obstaculoAlFrente } from './seguridad.js';
import {
  logPoint,
  startRecording,
  stopRecording,
  isRecording,
  replayTrajectory,
  listTrajectories,
} from './logger.js';

window.addEventListener('DOMContentLoaded', () => {
  // Helpers
  const byId = (id) => document.getElementById(id);
  const qs   = (sel) => document.querySelector(sel);

  // ---------------- Joystick ----------------
  const joystick = qs('.joystick');   // contenedor
  const stick    = qs('.stick');      // palito móvil
  let isDragging = false;
  const angulo   = { angle: 90 };

  function startDragging(ev) {
    ev.preventDefault();
    isDragging = true;
    if (stick) stick.style.transition = 'none';
  }

  function stopDragging() {
    if (!isDragging) return;
    isDragging = false;
    if (stick) {
      stick.style.transition = 'all 0.1s ease';
      // Volver al centro visual del joystick
      stick.style.transform = 'translate(-50%, -50%)';
    }
  }

  function drag(ev) {
    if (!isDragging || !joystick || !stick) return;

    const joystickRect = joystick.getBoundingClientRect();
    const stickRect    = stick.getBoundingClientRect();

    // Primer dedo
    const touch = ev.touches && ev.touches[0] ? ev.touches[0] : null;
    if (!touch) return;

    const offsetX = touch.clientX - joystickRect.left - joystickRect.width / 2;
    const offsetY = touch.clientY - joystickRect.top  - joystickRect.height / 2;

    const maxOffset = joystickRect.width / 2 - stickRect.width / 2;
    const distance  = Math.min(Math.hypot(offsetX, offsetY), maxOffset);

    const angleRad = Math.atan2(offsetY, offsetX);
    const angleDeg = angleRad * (180 / Math.PI);

    // Ajuste original
    angulo.angle   = angleDeg * (-1) - 17;

    const x = distance * Math.cos(angleRad);
    const y = distance * Math.sin(angleRad);

    // Movimiento relativo al centro
    stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    // Enviar ángulo
    sendPayload(angulo);
  }

  if (joystick && stick) {
    joystick.addEventListener('touchstart', startDragging, { passive: false });
    window.addEventListener('touchend',   stopDragging);
    window.addEventListener('touchmove',  drag, { passive: false });
  }

  // ---------------- WebSocket + sendPayload ----------------
  const servidor  = `ws://192.168.4.1/ws`; // ajustá si tu ruta Channels es otra
  let   webSocket = null;
  let   lastSend  = 0;  // throttle envío

  /**
   * Único punto de envío al auto:
   * - Hace WebSocket.send(JSON.stringify(payload)) con throttle
   * - Llama a logPoint(payload) para registrar el punto si hay grabación
   */
  function sendPayload(payload, minIntervalMs = 30) {
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) return;

    const now = performance.now();
    if (now - lastSend < minIntervalMs) return; // throttle simple
    lastSend = now;

    try {
      webSocket.send(JSON.stringify(payload));
      console.log(JSON.stringify(payload));
      
    } catch (e) {
      console.error('WS send error:', e);
    }

    // Registrar en el logger (si está en modo grabación)
    logPoint(payload);
  }

  function connectWebSocket() {
    try {
      const socket = new WebSocket(servidor);

      socket.onopen = () => {
        console.log('WS: Conexión establecida');
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data || '{}');
        if (message.encendido === true) {
          if (socket.readyState === WebSocket.OPEN) {
            // mando "en:1" y lo registro
            sendPayload({ en: 1 });
          }
        }
      };

      socket.onclose = (ev) => {
        console.log('WS: Conexión cerrada', ev.code, ev.reason || '');
      };

      socket.onerror = (err) => {
        console.error('WS: Error', err);
      };

      return socket;
    } catch (e) {
      console.error('WS: No se pudo crear', e);
      return null;
    }
  }

  // ---------------- Aceleración ----------------
  const slider       = byId('slider');
  const barra        = byId('barra');
  const valueElement = byId('value');

  let fondoEscala   = 0;
  let isAcelerando  = false;
  const _Acelerar   = { ac: 0 };

  function acelerar(ev) {
    if (!isAcelerando || !barra || !slider || !valueElement) return;

    const rect = barra.getBoundingClientRect();
    const t0   = ev.touches && ev.touches[0] ? ev.touches[0] : null;
    if (!t0) return;

    let value = ((rect.bottom - t0.clientY) / rect.height) * 100;
    if (value > 100) value = 100;
    if (value < 0)   value = 0;
    console.log("valor de aceleracion: ", value);
    _Acelerar.ac = value * fondoEscala;

    slider.style.height      = value + '%';
    slider.style.transition  = '0.1s';
    valueElement.textContent = Math.round(value) + '%';

    if (webSocket && webSocket.readyState === WebSocket.OPEN && !obstaculoAlFrente()) {
      sendPayload(_Acelerar);
    }
  }

  function startAcelerar(ev) {
    isAcelerando = true;
    ev.preventDefault();
  }

  function stopAcelerar() {
    isAcelerando = false;
    if (valueElement) valueElement.textContent = '0%';
    if (slider) slider.style.height = '0%';
    _Acelerar.ac = 0;
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      sendPayload(_Acelerar);
    }
  }

  if (barra) {
    barra.addEventListener('touchstart', startAcelerar, { passive: false });
    barra.addEventListener('touchmove',  acelerar,      { passive: false });
    barra.addEventListener('touchend',   stopAcelerar);
  }

  // ---------------- Botón encendido ----------------
  const encendido = byId('encendido');
  if (encendido) {
    encendido.addEventListener('click', () => {
      if (!webSocket) {
        webSocket = connectWebSocket();
        encendido.style.backgroundColor = 'rgb(0, 255, 38)';
        encendido.textContent = 'Encendido';
        return;
      }
      if (encendido.textContent === 'Encendido') {
        webSocket.close();
        webSocket = null;
        encendido.textContent = 'Apagado';
        encendido.style.backgroundColor = 'rgb(254, 10, 10)';
      } else {
        webSocket = connectWebSocket();
        encendido.style.backgroundColor = 'rgb(0, 255, 38)';
        encendido.textContent = 'Encendido';
      }
    });
  }

  // ---------------- Botones de escala ----------------
  const B_baja  = byId('B_baja');
  const B_media = byId('B_media');
  const B_alta  = byId('B_alta');

  if (B_baja) {
    B_baja.addEventListener('click', () => {
      fondoEscala = 0.3;
      B_baja.style.backgroundColor  = 'rgb(0, 255, 8)';
      if (B_media) B_media.style.backgroundColor = '#f00';
      if (B_alta)  B_alta.style.backgroundColor  = '#f00';
    });
  }
  if (B_media) {
    B_media.addEventListener('click', () => {
      fondoEscala = 0.6;
      if (B_baja)  B_baja.style.backgroundColor  = '#f00';
      B_media.style.backgroundColor = 'rgb(0, 255, 8)';
      if (B_alta)  B_alta.style.backgroundColor  = '#f00';
    });
  }
  if (B_alta) {
    B_alta.addEventListener('click', () => {
      fondoEscala = 1;
      if (B_baja)  B_baja.style.backgroundColor  = '#f00';
      if (B_media) B_media.style.backgroundColor = '#f00';
      B_alta.style.backgroundColor = 'rgb(0, 255, 8)';
    });
  }

  // ---------------- Grabación / Reproducción ----------------
  const btnStart        = byId('btnStartRec');
  const btnStop         = byId('btnStopRec');
  const btnReplayPrompt = byId('btnReplay');
  const select          = byId('recorridoSelect');

  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      const name = prompt('Nombre del recorrido:');
      if (!name) return;
      const r = await startRecording(name);
      alert(r.ok ? 'Grabando recorrido...' : 'No se pudo iniciar');
    });
  }

  if (btnStop) {
    btnStop.addEventListener('click', async () => {
      if (!isRecording()) return;
      const r = await stopRecording();
      if (r.ok) alert('Grabación detenida.');
    });
  }

  async function handleReplay(getId) {
    const id = getId();
    if (!Number.isFinite(id)) return;
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
      alert('Conectá el WebSocket primero');
      return;
    }
    // Usamos sendPayload como función de envío
    await replayTrajectory(id, sendPayload, {
      respectTimestamps: true,
      intervalMs: 80,
    });
  }

  if (btnReplayPrompt && !select) {
    btnReplayPrompt.addEventListener('click', async () => {
      await handleReplay(() => parseInt(prompt('ID de recorrido a reproducir:'), 10));
    });
  }

  if (select) {
    (async () => {
      const data = await listTrajectories();
      if (data.ok) {
        for (const r of data.items) {
          const opt = document.createElement('option');
          opt.value = r.id;
          opt.textContent = `${r.id} - ${r.name}`;
          select.appendChild(opt);
        }
      }
    })();

    if (btnReplayPrompt) {
      btnReplayPrompt.addEventListener('click', async () => {
        await handleReplay(() => parseInt(select.value, 10));
      });
    }
  }
});
