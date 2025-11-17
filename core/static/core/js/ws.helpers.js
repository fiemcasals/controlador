// static/core/js/ws.helpers.js
// Helpers relacionados con el WebSocket compartido en window.webSocket.
// Además, conecta el replay de recorridos con ese mismo WebSocket.

import { isRecording, logPoint } from "./logger.js"; // <-- OJO: ruta relativa

/**
 * Espera a que window.webSocket exista y esté en estado OPEN.
 * Devuelve el WebSocket o null si se vence el timeout.
 */
export async function waitForWS(timeoutMs = 5000) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    if (window.webSocket && window.webSocket.readyState === 1) {
      return window.webSocket;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return window.webSocket || null;
}

/**
 * Parchea ws.send para que, si hay grabación activa,
 * loguee cada payload enviado (usando logPoint).
 */
export function patchWebSocketSend(ws) {
  if (!ws || ws._vaePatched) return;

  const original = ws.send.bind(ws);

  ws.send = function (data) {
    // Enviar normalmente
    original(data);

    // Si estamos grabando, intentar loguear el payload
    if (isRecording()) {
      try {
        let obj = null;
        if (typeof data === "string") {
          obj = JSON.parse(data);
        } else if (data && typeof data === "object") {
          obj = data;
        }
        if (obj) {
          logPoint(obj);
        }
      } catch {
        // Silenciar errores de parseo
      }
    }
  };

  ws._vaePatched = true;
}

/**
 * Enviar un comando al vehículo usando el WebSocket compartido.
 * - payload puede ser objeto (lo convertimos a JSON) o string.
 */
export async function sendVehicleCommand(payload) {
  const ws = await waitForWS();
  if (!ws || ws.readyState !== 1) {
    console.warn("[ws.helpers] WebSocket no disponible para enviar comando.");
    return;
  }

  let data = payload;
  if (typeof payload !== "string") {
    try {
      data = JSON.stringify(payload);
    } catch (err) {
      console.error("[ws.helpers] No se pudo serializar payload:", err);
      return;
    }
  }

  ws.send(data);
}

// Hacemos accesible desde otros scripts (por si no importan este módulo)
window.sendVehicleCommand = sendVehicleCommand;

// Parchear automáticamente el WebSocket apenas esté disponible
(async () => {
  const ws = await waitForWS();
  patchWebSocketSend(ws);
})();

/**
 * Conectar el replay de recorridos:
 * recorder.ui.js dispara un evento "joystick:replay-point"
 * por cada punto; acá lo escuchamos y lo mandamos al vehículo.
 */
window.addEventListener("joystick:replay-point", (ev) => {
  try {
    const payload = ev.detail || {};
    sendVehicleCommand(payload);
  } catch (err) {
    console.error("[ws.helpers] Error enviando punto de replay:", err);
  }
});
