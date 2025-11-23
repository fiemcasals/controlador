// static/core/js/monitor.page.js

function updateUIFromLast(last) {
  const angleEl = document.getElementById("angleValue");
  const needleEl = document.getElementById("angleNeedle");
  const acValueEl = document.getElementById("acValue");
  const acBarFillEl = document.getElementById("acBarFill");
  const enValueEl = document.getElementById("enValue");

  if (!angleEl || !needleEl || !acValueEl || !acBarFillEl || !enValueEl) {
    return;
  }

  // ---- Ángulo ----
  const angle =
    typeof last.angle === "number" && Number.isFinite(last.angle)
      ? last.angle
      : null;

  if (angle !== null) {
    angleEl.textContent = angle.toFixed(1) + "°";
    // Rotamos la aguja. Ajustá el offset si tu 0° no coincide con la vertical.
    needleEl.style.transform = `translateX(-50%) rotate(${angle}deg)`;
  } else {
    angleEl.textContent = "—";
  }

  // ---- Aceleración ----
  let ac =
    typeof last.ac === "number" && Number.isFinite(last.ac) ? last.ac : null;

  if (ac === null) {
    acValueEl.textContent = "—";
    acBarFillEl.style.height = "0%";
  } else {
    // Si tu ac está en 0..30, lo escalamos a 0..100 para la barra
    let acNorm = ac;
    if (ac > 30) {
      acNorm = ac; // si ya manejás 0..100, dejalo así
    } else {
      acNorm = (ac / 30) * 100;
    }
    acNorm = Math.max(0, Math.min(100, acNorm));

    acValueEl.textContent = ac.toFixed(2);
    acBarFillEl.style.height = acNorm.toFixed(0) + "%";
  }

  // ---- Encendido ----
  const en = last.en;
  const isOn = en === 1 || en === true || en === "1";

  enValueEl.textContent = isOn ? "ON" : "OFF";
  enValueEl.classList.toggle("monitor-en-on", isOn);
  enValueEl.classList.toggle("monitor-en-off", !isOn);
}

async function fetchLogs() {
  try {
    const res = await fetch("/api/monitor/stream/");
    const data = await res.json();
    if (!data.ok) return;

    const items = data.items || [];
    if (items.length === 0) {
      return;
    }

    const last = items[items.length - 1];
    updateUIFromLast(last);
  } catch (e) {
    // Silencioso: si falla un poll, no rompemos la página
  }
}

// Refrescamos cada 300 ms
setInterval(fetchLogs, 300);
fetchLogs();
