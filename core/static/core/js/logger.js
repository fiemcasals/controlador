//Este módulo maneja: iniciar/detener grabación (pide nombre), enviar puntos al backend, y reproducir.

// core/static/core/js/logger.js
let recording = false;
let csrfToken = null;

function getCSRFToken() {
  if (csrfToken) return csrfToken;
  // Intenta desde cookie "csrftoken"
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  if (match) {
    csrfToken = match[1];
    return csrfToken;
  }
  // O desde meta tag (incluimos uno en la template)
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) {
    csrfToken = meta.getAttribute("content");
    return csrfToken;
  }
  return null;
}

export async function startRecording(name) {
  const form = new FormData();
  form.append("name", name);
  const r = await fetch("/api/recorridos/start", {
    method: "POST",
    headers: { "X-CSRFToken": getCSRFToken() || "" },
    body: form,
  });
  const data = await r.json();
  if (data.ok) {
    recording = true;
  }
  return data;
}

export async function stopRecording() {
  const r = await fetch("/api/recorridos/stop", {
    method: "POST",
    headers: { "X-CSRFToken": getCSRFToken() || "" },
  });
  const data = await r.json();
  if (data.ok) recording = false;
  return data;
}

export function isRecording() {
  return recording;
}

export async function logPoint(payload) {
  // payload puede ser { angle: X } o { ac: Y } o { en: 1 } o combinaciones
  if (!recording) return;
  const form = new FormData();
  if (payload.angle !== undefined) form.append("angle", payload.angle);
  if (payload.ac !== undefined) form.append("ac", payload.ac);
  if (payload.en !== undefined) form.append("en", payload.en);

  // Para que no bloquee el hilo, no esperamos el fetch (fire-and-forget):
  fetch("/api/recorridos/point", {
    method: "POST",
    headers: { "X-CSRFToken": getCSRFToken() || "" },
    body: form,
    keepalive: true, // ayuda si la página se cierra
  }).catch(() => {});
}

export async function listTrajectories() {
  const r = await fetch("/api/recorridos");
  return r.json();
}

export async function fetchTrajectoryPoints(id) {
  const r = await fetch(`/api/recorridos/${id}/points`);
  return r.json();
}

/**
 * Reproduce un recorrido: baja los puntos y los envía por el WebSocket provisto.
 * delayMs controla la cadencia entre puntos (por defecto 50ms).
 */
export async function replayTrajectory(id, webSocket, delayMs = 50) {
  const data = await fetchTrajectoryPoints(id);
  if (!data.ok) return;
  for (const p of data.points) {
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) break;
    const msg = {};
    if (p.angle !== null && p.angle !== undefined) msg.angle = p.angle;
    if (p.ac !== null && p.ac !== undefined) msg.ac = p.ac;
    if (p.en !== null && p.en !== undefined) msg.en = p.en;
    if (Object.keys(msg).length) {
      webSocket.send(JSON.stringify(msg));
    }
    await new Promise(res => setTimeout(res, delayMs));
  }
}
