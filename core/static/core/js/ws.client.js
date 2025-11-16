// static/core/js/ws.client.js
// WebSocket al auto + botón "Encendido" + helper sendPayload.

import { logPoint } from "./logger.js";

let webSocket = null;
let lastSend = 0;

// Armamos la URL del WS en base a dónde está corriendo la página.
// Ajustá "/ws" si tu ruta de Channels es otra.
const servidor =
  window?.VEHICLE_WS_URL
    ? window.VEHICLE_WS_URL
    : (location.protocol === "https:"
        ? `wss://${location.host}/ws`
        : `ws://${location.host}/ws`);
        
console.log("WS servidor =", servidor);

/**
 * Devuelve el WebSocket actual (puede ser null).
 */
export function getWebSocket() {
  return webSocket;
}

/**
 * Único punto de envío al auto:
 * - Hace WebSocket.send(JSON.stringify(payload)) con throttle
 * - Llama a logPoint(payload) para registrar el punto si hay grabación
 */
export function sendPayload(payload, minIntervalMs = 30) {
  const ws = webSocket;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const now = performance.now();
  if (now - lastSend < minIntervalMs) return; // throttle simple
  lastSend = now;

  try {
    ws.send(JSON.stringify(payload));
    console.log(JSON.stringify(payload));
  } catch (e) {
    console.error("WS send error:", e);
  }

  // Registrar en el logger (si está en modo grabación)
  logPoint(payload);
}

/**
 * Crea la conexión WebSocket y setea los handlers básicos.
 */
export function connectWebSocket() {
  try {
    const socket = new WebSocket(servidor);

    socket.onopen = () => {
      console.log("WS: Conexión establecida");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data || "{}");
      if (message.encendido === true) {
        if (socket.readyState === WebSocket.OPEN) {
          // mando "en:1" y lo registro
          sendPayload({ en: 1 });
        }
      }
    };

    socket.onclose = (ev) => {
      console.log("WS: Conexión cerrada", ev.code, ev.reason || "");
    };

    socket.onerror = (err) => {
      console.error("WS: Error", err);
    };

    webSocket = socket;
    return socket;
  } catch (e) {
    console.error("WS: No se pudo crear", e);
    return null;
  }
}

/**
 * Cierra el WebSocket actual (si existe).
 */
export function disconnectWebSocket() {
  if (webSocket) {
    try {
      webSocket.close();
    } catch {
      // ignorar
    }
    webSocket = null;
  }
}

// --- Botón Encendido / Apagado ---
// Respetamos al máximo lo que ya tenías, pero usando helpers.

window.addEventListener("DOMContentLoaded", () => {
  const encendido = document.getElementById("encendido");
  if (!encendido) return;

  // Estado inicial lo toma del DOM (texto / color que ya tengas)
  encendido.addEventListener("click", () => {
    const ws = getWebSocket();

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // No hay WS → conectar
      connectWebSocket();
      encendido.style.backgroundColor = "rgb(0, 255, 38)";
      encendido.textContent = "Encendido";
    } else {
      // Ya está conectado → desconectar
      disconnectWebSocket();
      encendido.textContent = "Apagado";
      encendido.style.backgroundColor = "rgb(254, 10, 10)";
    }
  });
});
