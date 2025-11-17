// static/core/js/recorder.ui.js
// -----------------------------------------------------------------------------
// UI para grabar y reproducir recorridos (botones + <select>).
// - NO usa prompt para pedir nombre.
// - Genera nombres automáticos: "Recorrido 1", "Recorrido 2", ...
// - Para el replay, no habla directo con el WebSocket:
//   emite eventos "joystick:replay-point" y otro módulo (ws.helpers.js)
//   se encarga de mandarlos por el WebSocket.
// -----------------------------------------------------------------------------

// Importamos funciones del módulo de lógica de grabación logger.js
import {
  startRecording,      // inicia grabación en el backend
  stopRecording,       // detiene la grabación actual en el backend
  isRecording,         // indica si estamos grabando (true/false)
  listTrajectories,    // lista de recorridos guardados en el backend
  replayTrajectory,    // reproduce un recorrido punto por punto
} from "./logger.js";

import { sendPayload } from "./ws.client.js";

// Función de ayuda: buscar un elemento por id en el DOM
function byId(id) {
  // document.getElementById devuelve el elemento o null si no existe
  return document.getElementById(id);
}

// Ejecutamos este código cuando el DOM ya está listo
window.addEventListener("DOMContentLoaded", () => {
  // ---------------------------------------------------------------------------
  // 1) Referencias a elementos del HTML
  // ---------------------------------------------------------------------------

  // Botón "Grabar"
  const btnStartRec = byId("btnStartRec");
  // Botón "Detener"
  const btnStopRec = byId("btnStopRec");
  // Botón "Reproducir"
  const btnReplay = byId("btnReplay");
  // <select> que contiene la lista de recorridos
  const recorridoSelect = byId("recorridoSelect");

  // Contador interno para generar nombres automáticos de recorridos
  // Ejemplo: "Recorrido 1", "Recorrido 2", etc.
  let autoRecCounter = 1;

  // ---------------------------------------------------------------------------
  // 2) Función para actualizar el estado de los botones según isRecording()
  // ---------------------------------------------------------------------------
  function updateRecButtons() {
    // Si faltan los botones, salimos
    if (!btnStartRec || !btnStopRec) return;

    // Si logger.js indica que estamos grabando...
    if (isRecording()) {
      // no permitimos iniciar otra grabación
      btnStartRec.disabled = true;
      // pero sí permitir detener
      btnStopRec.disabled = false;
    } else {
      // si NO estamos grabando, habilitamos "Grabar"
      btnStartRec.disabled = false;
      // y bloqueamos "Detener" (no hay nada que detener)
      btnStopRec.disabled = true;
    }
  }

  // ---------------------------------------------------------------------------
  // 3) Función para pedir al backend la lista de recorridos y llenar el <select>
  // ---------------------------------------------------------------------------
  async function refreshTrajectories() {
    // Si el <select> no existe, no hacemos nada
    if (!recorridoSelect) return;

    // Dejamos una opción por defecto
    recorridoSelect.innerHTML = `<option value="">Seleccioná un recorrido…</option>`;

    // Pedimos los recorridos al backend
    const resp = await listTrajectories();
    console.log("[recorder.ui] listTrajectories:", resp);

    // Si la respuesta no es OK, cortamos
    if (!resp.ok) return;

    // Recorremos la lista de items (recorridos)
    (resp.items || []).forEach((r) => {
      // Creamos una opción <option> para el <select>
      const opt = document.createElement("option");
      // id numérico del recorrido
      opt.value = r.id;
      // texto visible: nombre, o "Recorrido #id" si no trae nombre
      opt.textContent = r.name || `Recorrido #${r.id}`;
      // agregamos la opción al <select>
      recorridoSelect.appendChild(opt);
    });
  }

  // ---------------------------------------------------------------------------
  // 4) Función para iniciar una nueva grabación (handleStart)
  // ---------------------------------------------------------------------------
  async function handleStart() {
    // Si ya estamos grabando, ignoramos el intento
    if (isRecording()) {
      console.warn("[recorder.ui] Ya está grabando, se ignora el nuevo start.");
      return;
    }

    // Generamos un nombre automático: "Recorrido 1", "Recorrido 2", ...
    const name = `Recorrido ${autoRecCounter++}`;
    console.log("[recorder.ui] startRecording con nombre automático:", name);

    // Llamamos a logger.js para iniciar la grabación en el backend
    const resp = await startRecording(name);
    console.log("[recorder.ui] startRecording respuesta:", resp);

    // Si algo salió mal, avisamos al usuario
    if (!resp.ok) {
      alert("Error al iniciar la grabación.");
      return;
    }

    // Actualizamos el estado de los botones (Grabar/Detener)
    updateRecButtons();

    console.log(`🎥 Grabando: ${name}`);
  }

  // ---------------------------------------------------------------------------
  // 5) Función para detener la grabación actual (handleStop)
  // ---------------------------------------------------------------------------
  async function handleStop() {
    try {
      // Pedimos al backend que detenga la grabación
      const resp = await stopRecording();
      console.log("[recorder.ui] stopRecording respuesta:", resp);

      // Si hubo error, avisamos
      if (!resp.ok) {
        alert("Error al detener.");
        return;
      }

      // Ya no estamos grabando → actualizar botones
      updateRecButtons();
      // Recargar la lista de recorridos (para que aparezca el nuevo)
      await refreshTrajectories();

      console.log("⏹ Grabación detenida.");
    } catch (err) {
      // Si algo raro revienta el try, lo mostramos en consola
      console.error("[recorder.ui] Error en handleStop:", err);
      // y avisamos con un alert genérico
      alert("Error inesperado al detener la grabación.");
    }
  }

  // ---------------------------------------------------------------------------
  // 6) Función para reproducir el recorrido seleccionado (handleReplay)
  // ---------------------------------------------------------------------------
async function handleReplay() {
  if (!recorridoSelect) return;

  const id = recorridoSelect.value;
  if (!id) {
    alert("Seleccioná un recorrido.");
    return;
  }

  const resp = await replayTrajectory(
    id,
    (pt) => {
      // Reutilizamos el mismo camino que el joystick manual:
      //  - manda al WS
      //  - llama a logPoint (aunque si no está grabando, logger lo ignora)
      sendPayload(pt, 200);
    },
    {
      respectTimestamps: false,
      intervalMs: 200,
    }
  );

  console.log("[recorder.ui] replayTrajectory:", resp);

  if (resp.ok) {
    console.log(`⏪ Reproducción completa (${resp.count} puntos).`);
  } else {
    alert(`Error reproduciendo: ${resp.error}`);
  }
}


  // ---------------------------------------------------------------------------
  // 7) Enlazar eventos a los botones (si existen)
  // ---------------------------------------------------------------------------

  // Click en "Grabar" → handleStart
  if (btnStartRec) {
    btnStartRec.addEventListener("click", (ev) => {
      // prevenimos comportamiento por defecto (por ejemplo submit de form)
      ev.preventDefault();
      // ejecutamos la lógica de inicio de grabación
      handleStart();
    });
  }

  // Click en "Detener" → handleStop
  if (btnStopRec) {
    btnStopRec.addEventListener("click", (ev) => {
      ev.preventDefault();
      handleStop();
    });
  }

  // Click en "Reproducir" → handleReplay
  if (btnReplay) {
    btnReplay.addEventListener("click", (ev) => {
      ev.preventDefault();
      handleReplay();
    });
  }

  // ---------------------------------------------------------------------------
  // 8) Inicialización al cargar el módulo
  // ---------------------------------------------------------------------------

  // Ajustamos botones según si ya se estaba grabando o no
  updateRecButtons();
  // Cargamos la lista de recorridos existentes desde el backend
  refreshTrajectories();
});
