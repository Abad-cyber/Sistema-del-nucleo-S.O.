const ANIM_THRESHOLD = 40;

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

let PALETA_SOLIDA = [
  '#059669','#0891b2','#d97706','#dc2626','#7c3aed',
  '#db2777','#65a30d','#0284c7','#ea580c','#0d9488',
];

const mapaColoresProcesos = new Map();
let contadorColor = 0;

export function setPaletaExterna(paletaGradientes) {
  PALETA_SOLIDA = paletaGradientes.map(p => p[0]);
}

export function resetColoresProcesos() {
  mapaColoresProcesos.clear();
  contadorColor = 0;
}

function obtenerColorProceso(id) {
  if (!mapaColoresProcesos.has(id)) {
    mapaColoresProcesos.set(id, PALETA_SOLIDA[contadorColor % PALETA_SOLIDA.length]);
    contadorColor++;
  }
  return mapaColoresProcesos.get(id);
}

function iconoEvento(tipo) {
  const iconos = {
    ok:      '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error:   '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    libre:   '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1.5V5H8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/><circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>',
    buddy:   '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5H9M5 1V9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    compact: '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 3H9M1 5H7M1 7H5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    cola:    '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="3" cy="5" r="1.5" fill="currentColor"/><circle cx="6" cy="5" r="1.5" fill="currentColor"/><circle cx="9" cy="5" r="1.5" fill="currentColor"/></svg>',
  };
  return iconos[tipo] || iconos.ok;
}

function descripcionTipo(tipo) {
  const mapa = {
    ok:      'Asignado',
    error:   'Rechazado',
    libre:   'Liberado',
    buddy:   'División',
    compact: 'Compactado',
    cola:    'Evento',
  };
  return mapa[tipo] || 'Evento';
}

function claseTipo(tipo) {
  const mapa = {
    ok:      'paso-ok',
    error:   'paso-error',
    libre:   'paso-libre',
    buddy:   'paso-buddy',
    compact: 'paso-compact',
    cola:    'paso-cola',
  };
  return mapa[tipo] || 'paso-ok';
}

function estiloItem(indice) {
  if (indice < ANIM_THRESHOLD) {
    return `style="animation-delay:${Math.min((indice + 1) * 0.015, 0.3)}s"`;
  }
  return `class="no-anim"`;
}

function actualizarSubLog(n) {
  const sub = document.getElementById('subtituloLogPasos');
  if (!sub) return;
  const dot = '<span class="live-dot"></span>';
  sub.innerHTML = n > 0 ? `${dot} ${n} pasos` : 'Memoria';
}

function actualizarSubCola(n) {
  const sub = document.getElementById('subtituloListaColas');
  if (!sub) return;
  const dot = '<span class="live-dot"></span>';
  sub.innerHTML = n > 0 ? `${dot} ${n} ticks` : 'CPU';
}

// ──────────────────────────────────────────────────────
// LOG DE PASOS DE MEMORIA
// ──────────────────────────────────────────────────────

export function agregarPasoLog(paso, numeroPaso, sinScroll = false) {
  const contenedor = document.getElementById('logPasos');
  if (!contenedor) return;

  actualizarSubLog(contenedor.children.length + 1);

  const tipo = paso.tipo || 'ok';
  const descColoreada = colorearProcesosEnTexto(paso.descripcion);

  const el = document.createElement('div');
  const i = contenedor.children.length;
  if (i < ANIM_THRESHOLD) {
    el.className = `paso-item ${claseTipo(tipo)}`;
    el.style.animationDelay = `${Math.min((i + 1) * 0.02, 0.35)}s`;
  } else {
    el.className = `paso-item ${claseTipo(tipo)} no-anim`;
  }
  el.innerHTML = `
    <span class="paso-num">#${numeroPaso}</span>
    <span class="paso-desc">${descColoreada}</span>
    <span class="paso-badge ${claseTipo(tipo)}" style="display:inline-flex;align-items:center;gap:3px">
      ${iconoEvento(tipo)} ${descripcionTipo(tipo)}
    </span>
  `;
  contenedor.appendChild(el);
}

export function limpiarLog() {
  const el = document.getElementById('logPasos');
  if (el) el.innerHTML = '';
  actualizarSubLog(0);
}

export function rerenderizarLog(todosPasos, hasta) {
  const contenedor = document.getElementById('logPasos');
  if (!contenedor) return;

  let html = '';
  const count = Math.min(hasta + 1, todosPasos.length);
  for (let i = 0; i < count; i++) {
    const paso = todosPasos[i];
    const tipo = paso.tipo || 'ok';
    const descColoreada = colorearProcesosEnTexto(paso.descripcion);
    const anim = i < ANIM_THRESHOLD
      ? `style="animation-delay:${Math.min((i + 1) * 0.012, 0.25)}s"`
      : 'class="no-anim"';
    html += `
      <div class="paso-item ${claseTipo(tipo)}" ${anim}>
        <span class="paso-num">#${i + 1}</span>
        <span class="paso-desc">${descColoreada}</span>
        <span class="paso-badge ${claseTipo(tipo)}" style="display:inline-flex;align-items:center;gap:3px">
          ${iconoEvento(tipo)} ${descripcionTipo(tipo)}
        </span>
      </div>
    `;
  }
  contenedor.innerHTML = html;
  actualizarSubLog(count);
}

// ──────────────────────────────────────────────────────
// LISTA DE COLAS DEL PLANIFICADOR
// ──────────────────────────────────────────────────────

function renderColaItemHTML(estado, i) {
  let cpuHtml = '';
  if (estado.enCPU) {
    const color = obtenerColorProceso(estado.enCPU);
    cpuHtml = `
      <div class="cola-section">
        <span class="cola-section-label cpu">CPU</span>
        <span class="cola-proceso-chip running" style="background:${color}">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="3" fill="currentColor" opacity=".5"/></svg>
          ${esc(estado.enCPU)}
        </span>
      </div>`;
  } else {
    cpuHtml = `
      <div class="cola-section">
        <span class="cola-section-label cpu">CPU</span>
        <span class="chip-idle">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>
          IDLE
        </span>
      </div>`;
  }

  let waitHtml = '';
  if (estado.enCola.length > 0) {
    const chips = estado.enCola.map(pid => {
      const color = obtenerColorProceso(pid);
      return `<span class="cola-proceso-chip waiting" style="background:${color}15;color:${color};border:1px solid ${color}50">${esc(pid)}</span>`;
    }).join('');
    waitHtml = `
      <div class="cola-section">
        <span class="cola-section-label wait">Cola</span>
        ${chips}
      </div>`;
  } else {
    waitHtml = `
      <div class="cola-section">
        <span class="cola-section-label wait">Cola</span>
        <span style="font-size:9px;color:var(--txt4);opacity:.5;font-style:italic">vacía</span>
      </div>`;
  }

  let doneHtml = '';
  if (estado.terminados && estado.terminados.length > 0) {
    const chips = estado.terminados.map(pid => {
      const color = obtenerColorProceso(pid);
      return `<span class="cola-proceso-chip done" style="background:${color}10;color:${color};border:1px solid ${color}25">${esc(pid)}</span>`;
    }).join('');
    doneHtml = `
      <div class="cola-done-group">
        <span class="cola-section-label done">✓ Hechos</span>
        ${chips}
      </div>`;
  }

  return `
    <div class="paso-item paso-cola" ${estiloItem(i)}>
      <span class="paso-num" style="background:transparent;padding:2px 4px">
        <span class="paso-tick">t=${estado.tick}</span>
      </span>
      <div class="paso-desc" style="display:flex;flex-direction:column;gap:5px">
        ${cpuHtml}
        ${waitHtml}
        ${doneHtml}
      </div>
    </div>`;
}

export function agregarItemCola(estadoCola, numero, sinScroll = false) {
  const contenedor = document.getElementById('listaColas');
  if (!contenedor) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderColaItemHTML(estadoCola, contenedor.children.length);
  const el = wrapper.firstElementChild;
  if (contenedor.children.length >= ANIM_THRESHOLD) {
    el.classList.add('no-anim');
  }
  contenedor.appendChild(el);

  actualizarSubCola(contenedor.children.length);
}

export function limpiarListaColas() {
  const el = document.getElementById('listaColas');
  if (el) el.innerHTML = '';
  actualizarSubCola(0);
}

export function rerenderizarColas(todosEstados, hasta) {
  const contenedor = document.getElementById('listaColas');
  if (!contenedor) return;

  let html = '';
  const count = Math.min(hasta + 1, todosEstados.length);
  for (let i = 0; i < count; i++) {
    html += renderColaItemHTML(todosEstados[i], i);
  }
  contenedor.innerHTML = html;
  actualizarSubCola(count);
}

export function generarEstadosCola(ticksOrdenados, procesosResultado, eventosGantt) {
  const estados = [];
  const terminados = new Set();

  estados.push({
    tick:       0,
    enCPU:      null,
    enCola:     [],
    terminados: [],
  });

  ticksOrdenados.forEach((tick) => {
    let enCPU = null;
    for (const evento of eventosGantt) {
      if (tick >= evento.inicio && tick < evento.fin) {
        enCPU = evento.proceso === 'IDLE' ? null : evento.proceso;
        break;
      }
    }

    procesosResultado.forEach(p => {
      if (p.fin !== undefined && p.fin <= tick && p.fin > 0) {
        terminados.add(p.id);
      }
    });

    const enCola = procesosResultado
      .filter(p =>
        p.llegada <= tick &&
        p.id !== enCPU &&
        !terminados.has(p.id)
      )
      .sort((a, b) => a.llegada - b.llegada || a.id.localeCompare(b.id))
      .map(p => p.id);

    estados.push({
      tick:       tick,
      enCPU:      enCPU,
      enCola:     enCola,
      terminados: [...terminados],
    });
  });

  return estados;
}

// ──────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────

function colorearProcesosEnTexto(texto) {
  const escapado = esc(texto);
  return escapado.replace(/\b([A-Za-z]\w*\d+)\b/g, (match) => {
    const color = obtenerColorProceso(match);
    return `<span style="font-weight:700;color:${color}">${match}</span>`;
  });
}
