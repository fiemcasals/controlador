// recorder.ui.js
// Manejo de UI para grabar, listar y reproducir recorridos.

import {
  startRecording,
  stopRecording,
  isRecording,
  logPoint,
  listTrajectories,
  replayTrajectory,
} from "/static/core/js/logger.js"; // ajustá si tu STATIC_URL difiere

import { waitForWS } from "./ws.helpers.js";

// ---- Referencias UI de la barra de recorridos ----
const $name = document.getElementById("recName");
const $start = document.getElementById("btnStartRec");
const $stop = document.getElementById("btnStopRec");
const $sel = document.getElementById("recorridoSelect");
const $play = document.getElementById("btnReplay");

/**
 * Recarga el <select> con la lista de trayectorias disponibles.
 */
async function reloadList() {
  const data = await listTrajectories();

  if ($sel) {
    $sel.innerHTML = `<option value="">Seleccioná un recorrido…</option>`;
  }

  if (!data.ok || !$sel) return;

  const items = (data.items || []).sort(
    (a, b) => (b.ts || 0) - (a.ts || 0)
  );

  for (const r of items) {
    const dt = r.ts ? new Date(r.ts * 1000).toLocaleString() : "";
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = `#${r.id} · ${r.name}${dt ? ` (${dt})` : ""}`;
    $sel.appendChild(opt);
  }
}

// Cargar lista al abrir la página
reloadList();

// Exportar helper global por si otra parte del código lo necesita
window.vaeReplay = { reloadList };

// ---- Handlers de botones ----

// Start Recording
$start?.addEventListener("click", async () => {
  const nm = ($name?.value || "").trim();

  if (!nm) {
    alert("Poné un nombre para el recorrido.");
    $name?.focus();
    return;
  }

  const r = await startRecording(nm);

  if (r.ok) {
    if ($start) $start.disabled = true;
    if ($stop) $stop.disabled = true;

    const ws = await waitForWS();

    if (!ws || ws.readyState !== 1) {
      alert("Grabando, pero el WebSocket todavía no está listo.");
    }

    if ($stop) $stop.disabled = false;
  } else {
    alert(r.error || "No se pudo iniciar la grabación.");
  }
});

// Stop Recording
$stop?.addEventListener("click", async () => {
  const r = await stopRecording();

  if (r.ok) {
    if ($start) $start.disabled = false;
    if ($stop) $stop.disabled = true;
    await reloadList();
  }
});

// Replay
$play?.addEventListener("click", async () => {
  if (!$sel) {
    alert("No se encontró el selector de recorridos.");
    return;
  }

  const id = parseInt($sel.value, 10);
  if (!id) {
    alert("Elegí un recorrido.");
    return;
  }

  const ws = await waitForWS();
  if (!ws || ws.readyState !== 1) {
    alert("WS no listo");
    return;
  }

  const sendPayload = (p) => {
    try {
      ws.send(JSON.stringify(p));
    } catch {
      // Ignorar errores de envío
    }
    // Si estás grabando otra vez durante el replay, esto también lo loguea
    return logPoint(p);
  };

  await replayTrajectory(id, sendPayload, {
    respectTimestamps: true,
    intervalMs: 80,
  });
});
