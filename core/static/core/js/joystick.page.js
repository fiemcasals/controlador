// joystick.page.js
import {
  startRecording, stopRecording, isRecording,
  logPoint, listTrajectories, replayTrajectory
} from "/static/core/js/logger.js"; // ajustá si tu STATIC_URL difiere

// ---- Referencias UI
const $name = document.getElementById('recName');
const $start = document.getElementById('btnStartRec');
const $stop  = document.getElementById('btnStopRec');
const $sel   = document.getElementById('recorridoSelect');
const $play  = document.getElementById('btnReplay');

// ---- Espera de WebSocket creado por tu script.js
async function waitForWS(timeoutMs = 5000) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    if (window.webSocket && window.webSocket.readyState === 1) return window.webSocket;
    await new Promise(r => setTimeout(r, 100));
  }
  return window.webSocket || null;
}

// Opcional: parchear ws.send para loguear al grabar sin tocar script.js
function patchWebSocketSend(ws) {
  if (!ws || ws._vaePatched) return;
  const original = ws.send.bind(ws);
  ws.send = function(data) {
    original(data);
    if (isRecording()) {
      try {
        let obj = null;
        if (typeof data === 'string') obj = JSON.parse(data);
        else if (data && typeof data === 'object') obj = data;
        if (obj) logPoint(obj);
      } catch {}
    }
  };
  ws._vaePatched = true;
}

// Intentamos parchear cuando aparezca el WS
(async () => {
  const ws = await waitForWS();
  patchWebSocketSend(ws);
})();

// ---- Lógica de la barra
async function reloadList() {
  const data = await listTrajectories();
  $sel.innerHTML = `<option value="">Seleccioná un recorrido…</option>`;
  if (!data.ok) return;
  const items = (data.items || []).sort((a,b) => (b.ts||0)-(a.ts||0));
  for (const r of items) {
    const dt = r.ts ? new Date(r.ts*1000).toLocaleString() : '';
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `#${r.id} · ${r.name}${dt ? ` (${dt})` : ''}`;
    $sel.appendChild(opt);
  }
}

$start?.addEventListener('click', async () => {
  const nm = ($name?.value || '').trim();
  if (!nm) { alert('Poné un nombre para el recorrido.'); $name?.focus(); return; }
  const r = await startRecording(nm);
  if (r.ok) {
    $start.disabled = true;
    $stop.disabled = true;
    const ws = await waitForWS();
    if (!ws || ws.readyState !== 1) {
      alert('Grabando, pero el WebSocket todavía no está listo.');
    }
    $stop.disabled = false;
  } else {
    alert(r.error || 'No se pudo iniciar la grabación.');
  }
});

$stop?.addEventListener('click', async () => {
  const r = await stopRecording();
  if (r.ok) {
    $start.disabled = false;
    $stop.disabled  = true;
    await reloadList();
  }
});

$play?.addEventListener('click', async () => {
  const id = parseInt($sel.value, 10);
  if (!id) { alert('Elegí un recorrido.'); return; }
  // Reenvía cada punto a tu WS respetando timing o a intervalos fijos
  const ws = await waitForWS();
  if (!ws || ws.readyState !== 1) { alert('WS no listo'); return; }

  const sendPayload = (p) => {
    try { ws.send(JSON.stringify(p)); } catch {}
    return logPoint(p); // si estás grabando, esto lo toma
  };

  await replayTrajectory(id, sendPayload, { respectTimestamps: true, intervalMs: 80 });
});

// Cargar lista al abrir
reloadList();

// Exportar helpers por si otra página los quiere
window.vaeReplay = { reloadList };

// Referencias de la barra
const sliderEl = document.getElementById('slider');
const valueEl  = document.getElementById('value');

/** Setea aceleración 0..100 -> altura % y color */
function setAc(val) {
  let v = Number(val);
  if (!Number.isFinite(v)) v = 0;
  v = Math.max(0, Math.min(100, v));
  if (sliderEl) {
    sliderEl.style.height = v + '%';
    sliderEl.classList.toggle('is-on', v > 0);   // verde solo si > 0
  }
  if (valueEl) valueEl.textContent = v.toFixed(0);
  return v;
}

// --- ESTADO INICIAL ---
setAc(0); // ¡Clave!: que no arranque todo verde

// Si tu lógica ya recibe “ac” desde botones o WebSocket, llamá setAc(nuevoValor)
// Ejemplos de botones:
const bAlta  = document.getElementById('B_alta');
const bMedia = document.getElementById('B_media');
const bBaja  = document.getElementById('B_baja');

bAlta?.addEventListener('click',  () => setAc(100));
bMedia?.addEventListener('click', () => setAc(60));
bBaja?.addEventListener('click',  () => setAc(25));

// Si tu WebSocket trae payloads con { ac: N }, actualizá así:
window.addEventListener('vae-ws-payload', (e) => {
  const p = e.detail || {};
  if (typeof p.ac !== 'undefined') setAc(p.ac);
});
