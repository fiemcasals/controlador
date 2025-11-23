// static/core/js/ws.client.js

import { logPoint } from "./logger.js";

let webSocket = null;
let lastSampleTs = 0;
const SAMPLE_INTERVAL_MS = 80;

const ANGULO_NEUTRO = 90;  // ajustá al “recto” de tu protocolo

let currentState = {
  angle: ANGULO_NEUTRO,
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

// 🔹 Función interna: aplica gate, envía al auto y al monitor
async function _sendCurrentState() {
  const now = performance.now();
  if (now - lastSampleTs < SAMPLE_INTERVAL_MS) {
    return; // gate de tiempo
  }
  lastSampleTs = now;

  const ws = webSocket;
  const payload = { ...currentState };
  const data = JSON.stringify(payload);

  // 1) Enviar al microcontrolador por WebSocket
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(data);
    } catch (e) {
      console.error("WS send error:", e);
    }
  }

 



  // 2) Log para debug: solo los comandos "oficiales"
  console.log("[cmd]", data);

  // 3) Guardar en trayectoria (si está grabando)
  logPoint(payload);

  // 4) Enviar al monitor (via Django → UDP)
  //    No esperamos la respuesta; es "fire and forget".
  try {
    fetch("/api/monitor/telemetry/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
      keepalive: true, // ayuda a que no se corte al cerrar pestaña
    }).catch(() => {});
  } catch (e) {
    // no hacemos nada, la conducción no depende del monitor
  }
}

// API pública: joystick, acelerador y replay llaman a esto
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

