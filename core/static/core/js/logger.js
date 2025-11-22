// static/core/js/logger.js                                 // Ruta del archivo (útil para debugging)
// Módulo para grabar y reproducir recorridos usando tus endpoints de /api/recorridos/*   // Descripción

import { obstaculoAlFrente } from "./seguridad.js";

                                 // Intervalo mínimo entre envíos para evitar saturar el servidor

function _getCsrf() {                                       // Función opcional para obtener token CSRF (por si quitas csrf_exempt)
  const el = document.querySelector('meta[name="csrf-token"]'); // Busca meta tag con CSRF
  return el ? el.getAttribute('content') : '';              // Devuelve el token o string vacío si no existe
}

async function _post(url, payload) {                        // Función interna para hacer POST al servidor
  const res = await fetch(url, {                            // Llamada HTTP con fetch
    method: 'POST',                                         // Método POST
    headers: {
      'Content-Type': 'application/json',                   // Indicamos JSON
      // 'X-CSRFToken': _getCsrf(),                         // Línea opcional si activas CSRF
    },
    body: JSON.stringify(payload || {})                     // Convertimos el objeto en JSON
  });
  return await res.json();                                  // Devolvemos la respuesta parseada como JSON
}

async function _get(url) {                                  // Función interna para hacer GET al servidor
  const res = await fetch(url);                             // Llamada GET simple
  return await res.json();                                  // Parseamos y retornamos JSON
}

// ---- API pública ----                                     // Hasta acá era interno; ahora vienen funciones exportadas

export async function startRecording(name) {                // Inicia una grabación con un nombre dado
  if (!name || !name.trim()) return { ok: false, error: 'name vacío' }; // Validamos que tenga nombre
  const r = await _post('/api/recorridos/start/', { name: name.trim() }); // Enviamos el nombre al endpoint de inicio
  if (r.ok) _recording = true;                              // Si responde ok, marcamos que estamos grabando
  return r;                                                 // Devolvemos la respuesta del servidor
}

export async function stopRecording() {                     // Finaliza grabación activa
  const r = await _post('/api/recorridos/stop/', {});       // Llama al endpoint de stop
  if (r.ok) _recording = false;                             // Si finaliza bien, desactivamos flag
  return r;                                                 // Retornamos estado
}

export function isRecording() {                             // Función auxiliar para consultar estado externo
  return _recording;                                        // Devuelve true/false si se está grabando
}

let _recording = false;
// _lastPostTs y POST_EVERY_MS ya no se usan

export async function logPoint(payload) {
  // Solo guarda si se está grabando, sin más filtros de tiempo
  if (!_recording) return;

  try {
    await _post("/api/recorridos/point", payload || {});
  } catch (e) {
    // No frenamos el control por un fallo de log
  }
}


export async function listTrajectories() {                 // Lista los recorridos existentes
  const js = await _get('/api/recorridos/');                // GET al endpoint
  if (!js.ok) return { ok: false, items: [] };              // Si algo falla devolvemos respuesta vacía controlada
  return js;                                                // Retornamos el JSON normalizado
}

/**
 * Reproduce un recorrido ID: descarga puntos y llama sendFn(punto) con timing.   // Comentario largo explicativo
 * - sendFn: función que debería hacer tu webSocket.send(JSON.stringify(...))     // Explica argumento
 * - opts:                                                                         // Explica configuración
 *    {intervalMs} fijo entre puntos, si NO querés respetar timestamps            // Modo simple
 *    {respectTimestamps} si true, usa diferencias reales grabadas                // Modo realista
 */
export async function replayTrajectory(trajId, sendFn, opts = {}) {   // Función para replay
  const { intervalMs = 80, respectTimestamps = true } = opts;         // Valores por defecto de opciones
  const resp = await _get(`/api/recorridos/${trajId}/points`);        // Descarga puntos de ese recorrido
  if (!resp.ok) return { ok: false, error: resp.error || 'sin puntos' }; // Si falla, devolvemos error

  const pts = resp.points || [];                                      // Lista de puntos
  if (pts.length === 0) return { ok: false, error: 'recorrido vacío' }; // Nada que reproducir

  let prevTs = pts[0]._ts || null;                                    // Guardamos timestamp inicial para diferencias

  for (let i = 0; i < pts.length; i++) {                              // Recorrido punto por punto
    const p = { ...pts[i] };                                          // Copiamos punto para no modificar original
    delete p._ts;                                                     // Quitamos campo interno timestamp

        // --- NUEVO: si hay persona al frente, pausar aquí ---
    if (typeof obstaculoAlFrente === "function") {
      while (obstaculoAlFrente()) {
        // Esperamos 100 ms y volvemos a chequear
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    // ----------------------------------------------------
    await sendFn(p);       // Enviamos punto al servidor/control (websocket)

    if (i < pts.length - 1) {                                         // Si no es el último punto calculamos espera
      let waitMs = intervalMs;                                        // Base fija

      if (respectTimestamps && prevTs != null) {                      // Si queremos respetar tiempos reales
        const nextTs = pts[i + 1]._ts || prevTs;                      // Timestamp siguiente o repetimos
        const deltaSec = Math.max(0, nextTs - prevTs);                // Diferencia en segundos (nunca negativa)
        waitMs = Math.min(1000, Math.max(5, deltaSec * 1000));        // Limitar entre 5ms y 1000ms
        prevTs = nextTs;                                              // Actualizar referencia
      }

      await new Promise(r => setTimeout(r, waitMs));                  // Espera simulada (mismo ritmo del recorrido original)
    }
  }

  return { ok: true, count: pts.length };                             // Replay finalizado correctamente
}
