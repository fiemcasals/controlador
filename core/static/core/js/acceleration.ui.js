// acceleration.ui.js
// Manejo visual de la "barra de aceleración" y sus botones de nivel.

// Obtenemos la referencia al elemento que dibuja la barra de aceleración (el "slider").
const sliderEl = document.getElementById("slider");
// Obtenemos la referencia al elemento donde se mostrará el valor numérico de la aceleración.
const valueEl = document.getElementById("value");

/**
 * Setea aceleración 0..100 -> altura % y color.
 * @param {number} val  Valor de aceleración solicitado (en rango 0 a 100).
 * @returns {number}    Valor normalizado (forzado al rango 0..100).
 */
function setAc(val) {
  // Convertimos el valor recibido a número, por si viene como string.
  let v = Number(val);

  // Si el valor no es un número finito (NaN, Infinity, etc.), lo forzamos a 0.
  if (!Number.isFinite(v)) v = 0;

  // Limitamos el valor al rango 0..100 (si es menor que 0 se vuelve 0, si es mayor que 100 se vuelve 100).
  v = Math.max(0, Math.min(100, v));

  // Si el elemento de la barra existe en el DOM...
  if (sliderEl) {
    // Ajustamos la altura de la barra en porcentaje según la aceleración normalizada.
    sliderEl.style.height = v + "%";

    // Clase 'is-on' para mostrarlo en verde sólo si v > 0.
    // Si v > 0 se agrega la clase, si v == 0 se quita.
    sliderEl.classList.toggle("is-on", v > 0);
  }

  // Si el elemento de texto del valor existe...
  if (valueEl) {
    // Mostramos el valor numérico redondeado a entero (sin decimales).
    valueEl.textContent = v.toFixed(0);
  }

  // Devolvemos el valor normalizado, ya corregido al rango 0..100.
  return v;
}

// --- ESTADO INICIAL ---
// Llamamos a setAc(0) para iniciar en 0% de aceleración.
// Importante: que no arranque todo verde (sin aceleración hasta que el usuario haga algo).
setAc(0); // Importante: que no arranque todo verde

// Botones de aceleración predefinida
// Obtenemos el botón que setea la aceleración alta (por ejemplo, 100%).
const bAlta = document.getElementById("B_alta");
// Obtenemos el botón que setea la aceleración media (por ejemplo, 60%).
const bMedia = document.getElementById("B_media");
// Obtenemos el botón que setea la aceleración baja (por ejemplo, 25%).
const bBaja = document.getElementById("B_baja");

// Si el botón de aceleración alta existe, le agregamos un listener.
// El operador ?. evita error si bAlta es null (no existe en el DOM).
bAlta?.addEventListener("click", () => setAc(100));

// Si el botón de aceleración media existe, le agregamos un listener
// que pone la barra en 60% cuando se hace clic.
bMedia?.addEventListener("click", () => setAc(60));

// Si el botón de aceleración baja existe, le agregamos un listener
// que pone la barra en 25% cuando se hace clic.
bBaja?.addEventListener("click", () => setAc(25));

// Si otro script dispara eventos personalizados con payloads { ac: N },
// actualizamos la barra acá.
window.addEventListener("vae-ws-payload", (e) => {
  // Obtenemos el detalle del evento. Si no hay detail, usamos un objeto vacío.
  const p = e.detail || {};

  // Si el payload tiene una propiedad 'ac' (aceleración) definida...
  if (typeof p.ac !== "undefined") {
    // Actualizamos la barra usando ese valor de aceleración.
    setAc(p.ac);
  }
});
