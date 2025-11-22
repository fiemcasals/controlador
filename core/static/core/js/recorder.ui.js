// static/core/js/recorder.ui.js                                                // Ruta del archivo (utilidad para debugging)
// -----------------------------------------------------------------------------
// UI para grabar y reproducir recorridos (botones + <select>).                  // Descripción funcional
// - NO usa prompt para pedir nombre.                                           // Aclaración
// - Genera nombres automáticos: "Recorrido 1", "Recorrido 2", ...              // Lógica automática de nombres
// - Para el replay, no habla directo con el WebSocket:                         // Diseño modular
//   emite eventos "joystick:replay-point" y otro módulo (ws.helpers.js)        // Comunicación indirecta
//   se encarga de mandarlos por el WebSocket.                                  // Delegación de responsabilidades
// -----------------------------------------------------------------------------

// Importamos funciones del módulo de lógica de grabación logger.js            // Importación de API interna
import {
  startRecording,      // Función para iniciar una grabación en el backend
  stopRecording,       // Función para detener grabación activa
  isRecording,         // Función para saber si estamos grabando (booleano)
  listTrajectories,    // Función para obtener lista de recorridos guardados
  replayTrajectory,    // Función que reproduce un recorrido punto a punto
} from "./logger.js";

import { updateControlState } from "./ws.client.js"; // Importa función que envía datos al WebSocket durante replay

// Función simplificada para buscar elementos por ID
function byId(id) {
  return document.getElementById(id);  // Retorna el elemento o null si no existe
}

// Esperamos a que el DOM cargue antes de manipular elementos
window.addEventListener("DOMContentLoaded", () => {

  // ---------------------------------------------------------------------------
  // 1) Referencias a elementos del HTML
  // ---------------------------------------------------------------------------

  const btnStartRec = byId("btnStartRec");        // Botón "Grabar"
  const btnStopRec = byId("btnStopRec");          // Botón "Detener"
  const btnReplay = byId("btnReplay");            // Botón "Reproducir"
  const recorridoSelect = byId("recorridoSelect"); // Select donde se listan recorridos guardados

  let autoRecCounter = 1;                         // Contador usado para generar nombres automáticos

  // ---------------------------------------------------------------------------
  // 2) Actualiza los botones segun el estado "recording"
  // ---------------------------------------------------------------------------
  function updateRecButtons() {
    if (!btnStartRec || !btnStopRec) return;      // Si botones no existen → salir

    if (isRecording()) {                          // Si estamos grabando...
      btnStartRec.disabled = true;                // Bloqueamos iniciar (ya está)
      btnStopRec.disabled = false;                // Habilitamos detener
    } else {                                      // Si NO estamos grabando...
      btnStartRec.disabled = false;               // Se puede iniciar grabación
      btnStopRec.disabled = true;                // No se puede detener nada
    }
  }

  // ---------------------------------------------------------------------------
  // 3) Obtiene lista de recorridos desde backend y llena el <select>
  // ---------------------------------------------------------------------------
  async function refreshTrajectories() {
    if (!recorridoSelect) return;                 // Si no existe select, no hacemos nada

    recorridoSelect.innerHTML = `<option value="">Seleccioná un recorrido…</option>`;  // Limpia y deja opción inicial

    const resp = await listTrajectories();        // Llama al backend
    console.log("[recorder.ui] listTrajectories:", resp);

    if (!resp.ok) return;                         // Si backend responde error → salir

    (resp.items || []).forEach((r) => {           // Iteramos recorridos obtenidos
      const opt = document.createElement("option");// Creamos <option>
      opt.value = r.id;                           // ID interno
      opt.textContent = r.name || `Recorrido #${r.id}`; // Texto visible
      recorridoSelect.appendChild(opt);           // Lo agregamos al select
    });
  }

  // ---------------------------------------------------------------------------
  // 4) Inicia grabación con nombre automático
  // ---------------------------------------------------------------------------
  async function handleStart() {
    if (isRecording()) {                          // Si ya está grabando, ignoramos
      console.warn("[recorder.ui] Ya está grabando, se ignora el nuevo start.");
      return;
    }

    const name = `Recorrido ${autoRecCounter++}`; // Creamos nombre automático
    console.log("[recorder.ui] startRecording con nombre:", name);

    const resp = await startRecording(name);      // Llamamos a logger.js para iniciar grabación
    console.log("[recorder.ui] respuesta:", resp);

    if (!resp.ok) {                               // Si error → informar usuario
      alert("Error al iniciar la grabación.");
      return;
    }

    updateRecButtons();                           // Refrescamos estado UI
    console.log(`🎥 Grabando: ${name}`);          // Log informativo
  }

  // ---------------------------------------------------------------------------
  // 5) Detener grabación actual
  // ---------------------------------------------------------------------------
  async function handleStop() {
    try {
      const resp = await stopRecording();         // Pedimos backend que detenga grabación
      console.log("[recorder.ui] stop:", resp);

      if (!resp.ok) {                             // Validación error
        alert("Error al detener.");
        return;
      }

      updateRecButtons();                         // Actualiza botones
      await refreshTrajectories();                // Recarga lista incluyendo la nueva grabación

      console.log("⏹ Grabación detenida.");       // Log visual
    } catch (err) {
      console.error("[recorder.ui] ERROR:", err); // Error inesperado
      alert("Error inesperado al detener la grabación.");
    }
  }

  // ---------------------------------------------------------------------------
  // 6) Reproducir recorrido seleccionado
  // ---------------------------------------------------------------------------
  async function handleReplay() {
    if (!recorridoSelect) return;                 // Si select no existe → salir

    const id = recorridoSelect.value;             // Obtenemos ID seleccionado
    if (!id) {                                    // Validación
      alert("Seleccioná un recorrido.");
      return;
    }

    const resp = await replayTrajectory(          // Llamamos a logger.js para reproducción
      id,
      (pt) => {                                   // Función callback por cada punto
        updateControlState(pt);                     // Reenvía al WebSocket (simula joystick real)
      },
      {
        respectTimestamps: false,                 // No usa tiempo real original
        intervalMs: 80,                          // Intervalo fijo entre puntos
      }
    );

    console.log("[recorder.ui] replay:", resp);

    if (resp.ok) {                                // Finalizado correctamente
      console.log(`⏪ Reproducción completa (${resp.count} puntos).`);
    } else {
      alert(`Error reproduciendo: ${resp.error}`);// Error → aviso
    }
  }

  // ---------------------------------------------------------------------------
  // 7) Conectar botones a sus handlers
  // ---------------------------------------------------------------------------
  if (btnStartRec) {
    btnStartRec.addEventListener("click", (ev) => {
      ev.preventDefault();                        // Previene submit accidental
      handleStart();                              // Ejecuta función
    });
  }

  if (btnStopRec) {
    btnStopRec.addEventListener("click", (ev) => {
      ev.preventDefault();
      handleStop();
    });
  }

  if (btnReplay) {
    btnReplay.addEventListener("click", (ev) => {
      ev.preventDefault();
      handleReplay();
    });
  }

  // ---------------------------------------------------------------------------
  // 8) Inicialización visual al cargar
  // ---------------------------------------------------------------------------

  updateRecButtons();                             // Ajusta UI según estado actual
  refreshTrajectories();                          // Carga lista de recorridos existentes
});
