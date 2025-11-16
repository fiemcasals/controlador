// ws.helpers.js
// Helpers relacionados con el WebSocket compartido en window.webSocket.

import { isRecording, logPoint } from "/static/core/js/logger.js"; // ajustá si tu STATIC_URL difiere

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

// Parchear automáticamente el WebSocket apenas esté disponible
(async () => {
  const ws = await waitForWS();
  patchWebSocketSend(ws);
})();
