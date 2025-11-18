// static/core/js/sensores.js
// Actualiza la vista de sensores consultando /api/sensores/ periódicamente.

const rollEl   = document.getElementById("roll-value");
const pitchEl  = document.getElementById("pitch-value");
const yawEl    = document.getElementById("yaw-value");
const axEl     = document.getElementById("ax-value");
const ayEl     = document.getElementById("ay-value");
const azEl     = document.getElementById("az-value");
const latEl    = document.getElementById("lat-value");
const lonEl    = document.getElementById("lon-value");
const altEl    = document.getElementById("alt-value");
const rumboEl  = document.getElementById("rumbo-value");
const updatedEl= document.getElementById("updated-at");

async function fetchSensores() {
  try {
    const resp = await fetch("/api/sensores/");
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();

    if (rollEl)  rollEl.textContent  = data.roll?.toFixed?.(2)  ?? data.roll  ?? "--";
    if (pitchEl) pitchEl.textContent = data.pitch?.toFixed?.(2) ?? data.pitch ?? "--";
    if (yawEl)   yawEl.textContent   = data.yaw?.toFixed?.(2)   ?? data.yaw   ?? "--";

    if (axEl) axEl.textContent = data.ax?.toFixed?.(2) ?? data.ax ?? "--";
    if (ayEl) ayEl.textContent = data.ay?.toFixed?.(2) ?? data.ay ?? "--";
    if (azEl) azEl.textContent = data.az?.toFixed?.(2) ?? data.az ?? "--";

    if (latEl) latEl.textContent = data.lat ?? "--";
    if (lonEl) lonEl.textContent = data.lon ?? "--";
    if (altEl) altEl.textContent = data.alt ?? "--";
    if (rumboEl) rumboEl.textContent = data.rumbo?.toFixed?.(2) ?? data.rumbo ?? "--";

    if (updatedEl) {
      const now = new Date();
      updatedEl.textContent = now.toLocaleTimeString();
    }

    // TODO futuro: actualizar mapa aquí cuando lo implementes.
    // if (data.lat && data.lon) { ... mover marker en el mapa ... }

  } catch (err) {
    console.error("Error al obtener /api/sensores/:", err);
  }
}

// Polling cada 500 ms (ajustá a gusto)
setInterval(fetchSensores, 500);
fetchSensores();
