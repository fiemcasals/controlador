// static/core/js/sensores.js                                           // Ruta del archivo, útil para identificar logs
// Actualiza la vista de sensores consultando /api/sensores/ periódicamente.   // Descripción funcional

// Referencias a elementos del DOM donde se mostrarán los valores de sensores
const rollEl   = document.getElementById("roll-value");   // Valor de roll (inclinación lateral)
const pitchEl  = document.getElementById("pitch-value");  // Valor de pitch (inclinación frontal)
const yawEl    = document.getElementById("yaw-value");    // Rotación (rumbo del vehículo)

const axEl     = document.getElementById("ax-value");     // Aceleración eje X
const ayEl     = document.getElementById("ay-value");     // Aceleración eje Y
const azEl     = document.getElementById("az-value");     // Aceleración eje Z

const latEl    = document.getElementById("lat-value");    // Latitud GPS
const lonEl    = document.getElementById("lon-value");    // Longitud GPS
const altEl    = document.getElementById("alt-value");    // Altitud GPS

const rumboEl  = document.getElementById("rumbo-value");  // Rumbo estimado (brújula)
const updatedEl= document.getElementById("updated-at");   // Elemento que muestra hora de última actualización

// Función principal: consulta datos del backend y actualiza la UI
async function fetchSensores() {
  try {
    const resp = await fetch("/api/sensores/");           // Llama al endpoint que devuelve valores de sensores

    if (!resp.ok) throw new Error("HTTP " + resp.status); // Si hay error HTTP → lanzar excepción

    const data = await resp.json();                       // Convertimos respuesta en JSON

    // Actualizamos valores numéricos IMU
    if (rollEl)  rollEl.textContent  = data.roll?.toFixed?.(2)  ?? data.roll  ?? "--";  // Muestra valor con 2 decimales si existe
    if (pitchEl) pitchEl.textContent = data.pitch?.toFixed?.(2) ?? data.pitch ?? "--";
    if (yawEl)   yawEl.textContent   = data.yaw?.toFixed?.(2)   ?? data.yaw   ?? "--";

    // Aceleración XYZ
    if (axEl) axEl.textContent = data.ax?.toFixed?.(2) ?? data.ax ?? "--";
    if (ayEl) ayEl.textContent = data.ay?.toFixed?.(2) ?? data.ay ?? "--";
    if (azEl) azEl.textContent = data.az?.toFixed?.(2) ?? data.az ?? "--";

    // GPS
    if (latEl) latEl.textContent = data.lat ?? "--";     // Si el backend manda null, muestra "--"
    if (lonEl) lonEl.textContent = data.lon ?? "--";
    if (altEl) altEl.textContent = data.alt ?? "--";
    if (rumboEl) rumboEl.textContent = data.rumbo?.toFixed?.(2) ?? data.rumbo ?? "--";

    // Marca la hora local de la última actualización
    if (updatedEl) {
      const now = new Date();
      updatedEl.textContent = now.toLocaleTimeString();   // Formato HH:MM:SS según idioma del navegador
    }

    // TODO futuro: actualizar mapa aquí cuando lo implementes.
    // if (data.lat && data.lon) { ... mover marker en el mapa ... }    // Lugar reservado para GPS visual

  } catch (err) {
    console.error("Error al obtener /api/sensores/:", err);   // Captura fallos de red o parseo
  }
}

// Polling cada 500 ms (ajustá según rendimiento o frecuencia del hardware)
setInterval(fetchSensores, 500);     // Llama periódicamente la función
fetchSensores();                     // Llama una vez al cargar la página para no esperar al primer intervalo
