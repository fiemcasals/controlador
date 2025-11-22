// static/core/js/ws.client.js

import { logPoint } from "./logger.js";

let webSocket = null;
let lastSampleTs = 0;
const SAMPLE_INTERVAL_MS = 80;

// Estado de control "canónico": lo que realmente se manda / graba
let currentState = {
  angle: null,
  ac: 0,
  en: null,
};

const MICROCONTROLLER_IP = "192.168.4.1";
const WEBSOCKET_PATH = "/ws";
const servidor = `ws://${MICROCONTROLLER_IP}${WEBSOCKET_PATH}`;

console.log("WS servidor =", servidor);

export function getWebSocket() {
  return webSocket;
}

// 🔹 Función interna: aplica gate y envía el snapshot
function _sendCurrentState() {
  const now = performance.now();
  if (now - lastSampleTs < SAMPLE_INTERVAL_MS) {
    return; // gate de tiempo
  }
  lastSampleTs = now;

  const ws = webSocket;
  const payload = { ...currentState };      // clon del estado actual
  const data = JSON.stringify(payload);

  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(data);
    } catch (e) {
      console.error("WS send error:", e);
    }
  }

  console.log("[cmd]", data);
  logPoint(payload); // guarda exactamente el mismo snapshot
}

/**
 * Esta es la API que deben usar joystick, acelerador y replay:
 * actualiza el estado parcial, y dispara el envío con gate de tiempo.
 */
export function updateControlState(partial) {
  currentState = {
    ...currentState,
    ...(partial || {}),
  };
  _sendCurrentState();
}

export function connectWebSocket() {
  try {
    const socket = new WebSocket(servidor);

    socket.onopen = () => {
      console.log("WS: Conexión establecida");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data || "{}");
      if (message.encendido === true) {
        // el auto pide confirmación de encendido → actualizamos 'en'
        updateControlState({ en: 1 });
      }
    };

    socket.onclose = (ev) => {
      console.log("WS: Conexión cerrada", ev.code, ev.reason || "");
    };

    socket.onerror = (err) => {
      console.error("WS: Error", err);
    };

    webSocket = socket;
    window.webSocket = socket; // para ws.helpers si lo necesitás

    return socket;
  } catch (e) {
    console.error("WS: No se pudo crear", e);
    return null;
  }
}

export function disconnectWebSocket() {
  if (webSocket) {
    try {
      webSocket.close();
    } catch {}
    webSocket = null;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const encendido = document.getElementById("encendido");
  if (!encendido) return;

  encendido.addEventListener("click", () => {
    const ws = getWebSocket();

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
      encendido.style.backgroundColor = "rgb(0, 255, 38)";
      encendido.textContent = "Encendido";
    } else {
      disconnectWebSocket();
      encendido.textContent = "Apagado";
      encendido.style.backgroundColor = "rgb(254, 10, 10)";
      // opcional: updateControlState({ ac: 0, en: 0 });
    }
  });
});

