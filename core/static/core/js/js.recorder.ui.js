// static/core/js/recorder.ui.js
// UI para grabar y reproducir recorridos (botones + select).

import {
  startRecording,
  stopRecording,
  isRecording,
  replayTrajectory,
  listTrajectories,
} from "./logger.js";

import { sendPayload, getWebSocket } from "./ws.client.js";

window.addEventListener("DOMContentLoaded", () => {
  const byId = (id) => document.getElementById(id);

  const btnStart = byId("btnStartRec");
  const btnStop = byId("btnStopRec");
  const btnReplayPrompt = byId("btnReplay");
  const select = byId("recorridoSelect");

  // ---- Start Recording ----
  if (btnStart) {
    btnStart.addEventListener("click", async () => {
      const name = prompt("Nombre del recorrido:");
      if (!name) return;
      const r = await startRecording(name);
      alert(r.ok ? "Grabando recorrido..." : "No se pudo iniciar");
    });
  }

  // ---- Stop Recording ----
  if (btnStop) {
    btnStop.addEventListener("click", async () => {
      if (!isRecording()) return;
      const r = await stopRecording();
      if (r.ok) alert("Grabación detenida.");
    });
  }

  // ---- Helper para replay ----
  async function handleReplay(getId) {
    const id = getId();
    if (!Number.isFinite(id)) return;

    const ws = getWebSocket();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert("Conectá el WebSocket primero");
      return;
    }

    // Usamos sendPayload como función de envío
    await replayTrajectory(id, sendPayload, {
      respectTimestamps: true,
      intervalMs: 80,
    });
  }

  // Caso 1: no hay <select>, pedimos ID por prompt
  if (btnReplayPrompt && !select) {
    btnReplayPrompt.addEventListener("click", async () => {
      await handleReplay(() =>
        parseInt(prompt("ID de recorrido a reproducir:"), 10)
      );
    });
  }

  // Caso 2: hay <select> con recorridos
  if (select) {
    (async () => {
      const data = await listTrajectories();
      if (data.ok) {
        for (const r of data.items) {
          const opt = document.createElement("option");
          opt.value = r.id;
          opt.textContent = `${r.id} - ${r.name}`;
          select.appendChild(opt);
        }
      }
    })();

    if (btnReplayPrompt) {
      btnReplayPrompt.addEventListener("click", async () => {
        await handleReplay(() => parseInt(select.value, 10));
      });
    }
  }
});
