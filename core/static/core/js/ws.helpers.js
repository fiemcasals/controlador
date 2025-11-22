// static/core/js/ws.helpers.js                                              // Ruta del archivo (referencia para debugging)
// Helpers relacionados con el WebSocket compartido en window.webSocket.     // Descripción general del módulo
// Además, conecta el replay de recorridos con ese mismo WebSocket.          // Explica su integración con el replay

import { isRecording, logPoint } from "./logger.js"; // <-- OJO: ruta relativa // Importamos funciones del módulo logger

/**
 * Espera a que window.webSocket exista y esté en estado OPEN.               // Función asincrónica
 * Devuelve el WebSocket o null si se vence el timeout.                      // Devuelve conexión o null
 */
export async function waitForWS(timeoutMs = 5000) {                          // Espera hasta timeout configurable
  const t0 = performance.now();                                              // Marca tiempo inicial
  while (performance.now() - t0 < timeoutMs) {                               // Loop mientras no expire timeout
    if (window.webSocket && window.webSocket.readyState === 1) {             // Si WS existe y está OPEN (readyState===1)
      return window.webSocket;                                               // Devolvemos la conexión
    }
    await new Promise((r) => setTimeout(r, 100));                            // Espera 100ms antes de volver a probar
  }
  return window.webSocket || null;                                           // Si no se logró abrir, devolver WS o null
}

/**
 * Parchea ws.send para que, si hay grabación activa,
 * loguee cada payload enviado (usando logPoint).                            // Decorador aplicado al método send del WS
 */
export function patchWebSocketSend(ws) {
  if (!ws || ws._vaePatched) return;
  ws._vaePatched = true;
}


/**
 * Enviar un comando al vehículo usando el WebSocket compartido.             // Función pública de envío
 * - payload puede ser objeto (lo convertimos a JSON) o string.              // Acepta objeto o string
 */
export async function sendVehicleCommand(payload) {
  const ws = await waitForWS();                                              // Esperamos a que el WS esté listo
  if (!ws || ws.readyState !== 1) {                                          // Si no está conectado → warning
    console.warn("[ws.helpers] WebSocket no disponible para enviar comando.");
    return;
  }

  let data = payload;                                                        // Preparamos contenido final a enviar

  if (typeof payload !== "string") {                                         // Si no es string → intentamos serializarlo
    try {
      data = JSON.stringify(payload);                                        // Convertimos a JSON
    } catch (err) {
      console.error("[ws.helpers] No se pudo serializar payload:", err);     // Error serializando → abortar
      return;
    }
  }

  ws.send(data);                                                             // Enviamos al WebSocket
}

// Hacemos accesible desde otros scripts (por si no importan este módulo)
window.sendVehicleCommand = sendVehicleCommand;                              // Permite usar sendVehicleCommand sin import

// Parchear automáticamente el WebSocket apenas esté disponible
(async () => {                                                               // IIFE (función autoejecutable)
  const ws = await waitForWS();                                              // Esperamos conexión
  patchWebSocketSend(ws);                                                    // Parcheamos send() automáticamente
})();

/**
 * Conectar el replay de recorridos:
 * recorder.ui.js dispara un evento "joystick:replay-point"                  // Protocolo del replay
 * por cada punto; acá lo escuchamos y lo mandamos al vehículo.              // Este módulo se encarga de enviarlo al WS
 */
window.addEventListener("joystick:replay-point", (ev) => {                   // Escucha eventos globales del replay
  try {
    const payload = ev.detail || {};                                         // Tomamos el payload del evento
    sendVehicleCommand(payload);                                             // Lo mandamos al vehículo vía WebSocket
  } catch (err) {
    console.error("[ws.helpers] Error enviando punto de replay:", err);     // Problema inesperado
  }
});
