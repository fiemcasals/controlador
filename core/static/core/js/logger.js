// static/core/js/logger.js
// Módulo para grabar y reproducir recorridos usando tus endpoints de /api/recorridos/*

let _recording = false;
let _lastPostTs = 0;           // para rate-limit de /point
const POST_EVERY_MS = 100;     // no spamear al servidor

function _getCsrf() {
  // Para llamadas no-exentas; tus vistas están csrf_exempt, pero lo dejo por si migrás
  const el = document.querySelector('meta[name="csrf-token"]');
  return el ? el.getAttribute('content') : '';
}

async function _post(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'X-CSRFToken': _getCsrf(), // si quitás csrf_exempt
    },
    body: JSON.stringify(payload || {})
  });
  return await res.json();
}

async function _get(url) {
  const res = await fetch(url);
  return await res.json();
}

// ---- API pública ----

export async function startRecording(name) {
  if (!name || !name.trim()) return { ok: false, error: 'name vacío' };
  const r = await _post('/api/recorridos/start/', { name: name.trim() });
  if (r.ok) _recording = true;
  return r;
}

export async function stopRecording() {
  const r = await _post('/api/recorridos/stop/', {});
  if (r.ok) _recording = false;
  return r;
}

export function isRecording() {
  return _recording;
}

/**
 * Llamala cada vez que envíes un paquete al auto.
 * Hace POST /api/recorridos/point (throttleado).
 * payload puede tener: {angle, ac, en} u otros campos; se agrega _ts en el server.
 */
export async function logPoint(payload) {
  if (!_recording) return;
  const now = performance.now();
  if (now - _lastPostTs < POST_EVERY_MS) return; // throttle
  _lastPostTs = now;
  try {
    await _post('/api/recorridos/point', payload || {});
  } catch (e) {
    // silencioso; no frenamos el control por un fallo de log
  }
}

export async function listTrajectories() {
  const js = await _get('/api/recorridos/');
  // normalizar estructura por si agregás ORM a futuro
  if (!js.ok) return { ok: false, items: [] };
  return js;
}

/**
 * Reproduce un recorrido ID: descarga puntos y llama a sendFn(punto) con timing.
 * - sendFn: función que debería hacer tu webSocket.send(JSON.stringify(...))
 * - opts:
 *    {intervalMs} fijo entre puntos, si NO querés respetar timestamps
 *    {respectTimestamps} si true, usa diferencias de _ts grabadas (en segundos)
 */
export async function replayTrajectory(trajId, sendFn, opts = {}) {
  const { intervalMs = 80, respectTimestamps = true } = opts;
  const resp = await _get(`/api/recorridos/${trajId}/points`);
  if (!resp.ok) return { ok: false, error: resp.error || 'sin puntos' };

  const pts = resp.points || [];
  if (pts.length === 0) return { ok: false, error: 'recorrido vacío' };

  // calcular deltas en ms usando _ts (unix seg)
  let prevTs = pts[0]._ts || null;
  for (let i = 0; i < pts.length; i++) {
    const p = { ...pts[i] };
    // limpiamos campos internos si hiciera falta
    delete p._ts;

    await sendFn(p);

    if (i < pts.length - 1) {
      let waitMs = intervalMs;
      if (respectTimestamps && prevTs != null) {
        const nextTs = pts[i + 1]._ts || prevTs;
        const deltaSec = Math.max(0, nextTs - prevTs);
        waitMs = Math.min(1000, Math.max(5, deltaSec * 1000)); // límites sanos
        prevTs = nextTs;
      }
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  return { ok: true, count: pts.length };
}
