// acceleration.ui.js
// Manejo visual de la "barra de aceleración" y sus botones de nivel.

const sliderEl = document.getElementById("slider");
const valueEl = document.getElementById("value");

/**
 * Setea aceleración 0..100 -> altura % y color.
 * @param {number} val
 * @returns {number} valor normalizado (0..100)
 */
function setAc(val) {
  let v = Number(val);
  if (!Number.isFinite(v)) v = 0;
  v = Math.max(0, Math.min(100, v));

  if (sliderEl) {
    sliderEl.style.height = v + "%";
    // Clase 'is-on' para mostrarlo en verde sólo si v > 0
    sliderEl.classList.toggle("is-on", v > 0);
  }

  if (valueEl) {
    valueEl.textContent = v.toFixed(0);
  }

  return v;
}

// --- ESTADO INICIAL ---
setAc(0); // Importante: que no arranque todo verde

// Botones de aceleración predefinida
const bAlta = document.getElementById("B_alta");
const bMedia = document.getElementById("B_media");
const bBaja = document.getElementById("B_baja");

bAlta?.addEventListener("click", () => setAc(100));
bMedia?.addEventListener("click", () => setAc(60));
bBaja?.addEventListener("click", () => setAc(25));

// Si otro script dispara eventos con payloads { ac: N },
// actualizamos la barra acá.
window.addEventListener("vae-ws-payload", (e) => {
  const p = e.detail || {};
  if (typeof p.ac !== "undefined") {
    setAc(p.ac);
  }
});
