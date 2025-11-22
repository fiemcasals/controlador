// static/core/js/seguridad.js
// ----------------------------------------------------
// Consulta periódica al backend para saber si hay
// una persona delante del vehículo.
//   GET /api/estado/persona/  -> { "personaAlFrente": true/false }
// ----------------------------------------------------

// URL del backend. Mejor relativa para que funcione en el mismo host/puerto.
const PERSONA_API_URL =
  window.PERSONA_API_URL || "/api/estado/persona/";

// Último estado conocido
let personaAlFrente = false;

// Solo para debug opcional
let _ultimoUpdateMs = 0;

// Función interna: consulta la API y actualiza el flag
async function _actualizarEstadoPersona() {
  try {
    const resp = await fetch(PERSONA_API_URL, {
      method: "GET",
      cache: "no-store",
    });

    if (!resp.ok) {
      console.warn(
        "[seguridad] Respuesta no OK de persona:",
        resp.status
      );
      return;
    }

    const data = await resp.json() || {};

    // Aceptamos varias claves por si el backend cambia de nombre
    const valor =
      data.personaAlFrente ??
      data.persona_al_frente ??
      data.persona ??
      false;

    personaAlFrente = !!valor;
    _ultimoUpdateMs = performance.now();

    // Debug opcional:
    // console.log("[seguridad] personaAlFrente =", personaAlFrente);
  } catch (err) {
    console.error("[seguridad] Error consultando API persona:", err);
    // En caso de error, mantenemos el último valor conocido
  }
}

// Arrancamos el polling
// Primer consulta inmediata, luego cada 500 ms
_actualizarEstadoPersona();
setInterval(_actualizarEstadoPersona, 500);

/**
 * Devuelve true si la última lectura indica que hay
 * una persona/obstáculo delante del vehículo.
 */
export function obstaculoAlFrente() {
  return personaAlFrente;
}

// EXTRAS DE DEBUG (opcionales, no son necesarios):
window.obstaculoAlFrente = obstaculoAlFrente;
