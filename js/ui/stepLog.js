// ═══════════════════════════════════════════════════════
// ui/stepLog.js — Log de pasos de memoria + Lista de colas del planificador
// ═══════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────
// LOG DE PASOS DE MEMORIA
// ──────────────────────────────────────────────────────

/**
 * Agrega un ítem al log de pasos de memoria (#logPasos).
 *
 * @param {Object} paso       - { tipo, descripcion }
 * @param {number} numeroPaso - Número de paso para el label #N
 */
export function agregarPasoLog(paso, numeroPaso) {
  const contenedor = document.getElementById('logPasos');
  if (!contenedor) return;

  const config = obtenerConfigTipo(paso.tipo);
  const el = document.createElement('div');
  el.className = `paso-item ${config.clase}`;
  el.innerHTML = `
    <span class="paso-num">#${numeroPaso}</span>
    <span class="paso-desc">${paso.descripcion}</span>
    <span class="paso-badge ${config.badge}">${config.texto}</span>
  `;
  contenedor.appendChild(el);
  // Scroll interno del panel — NO mueve la página
  contenedor.scrollTop = contenedor.scrollHeight;
}

/**
 * Limpia el log de pasos de memoria.
 */
export function limpiarLog() {
  const el = document.getElementById('logPasos');
  if (el) el.innerHTML = '';
}

/**
 * Re-renderiza el log completo hasta el paso indicado (para retroceso).
 *
 * @param {Array}  todosPasos - Todos los pasos registrados
 * @param {number} hasta      - Índice hasta el cual mostrar (0-based)
 */
export function rerenderizarLog(todosPasos, hasta) {
  limpiarLog();
  todosPasos.slice(0, hasta + 1).forEach((paso, i) => {
    agregarPasoLog(paso, i + 1);
  });
}

// ──────────────────────────────────────────────────────
// LISTA DE COLAS DEL PLANIFICADOR
// ──────────────────────────────────────────────────────

/**
 * Agrega un ítem a la lista de colas del planificador (#listaColas).
 * Muestra en cada tick: qué proceso tiene la CPU, qué procesos esperan, quién terminó.
 *
 * @param {Object} estadoCola - Estado de la cola en este tick
 *   { tick, enCPU, enCola, terminados, tipo }
 * @param {number} numero     - Número del ítem
 */
export function agregarItemCola(estadoCola, numero) {
  const contenedor = document.getElementById('listaColas');
  if (!contenedor) return;

  // Construir descripción legible de la cola
  const enCPU      = estadoCola.enCPU     ? ` CPU: <strong>${estadoCola.enCPU}</strong>` : ' CPU: <em>IDLE</em>';
  const enCola     = estadoCola.enCola.length > 0
    ? `⏳ Cola: [${estadoCola.enCola.join(', ')}]`
    : '⏳ Cola: vacía';
  const terminados = estadoCola.terminados.length > 0
    ? `✓ Fin: ${estadoCola.terminados.join(', ')}`
    : '';

  const el = document.createElement('div');
  el.className = 'paso-item paso-cola';
  el.innerHTML = `
    <span class="paso-num">t=${estadoCola.tick}</span>
    <span class="paso-desc">
      ${enCPU} &nbsp;·&nbsp; ${enCola}
      ${terminados ? `<br/><span style="color:var(--verde);font-size:10px">${terminados}</span>` : ''}
    </span>
    <span class="paso-badge cola">#${numero}</span>
  `;
  contenedor.appendChild(el);
  // Scroll interno del panel — NO mueve la página
  contenedor.scrollTop = contenedor.scrollHeight;
}

/**
 * Limpia la lista de colas.
 */
export function limpiarListaColas() {
  const el = document.getElementById('listaColas');
  if (el) el.innerHTML = '';
}

/**
 * Re-renderiza la lista de colas hasta el paso indicado.
 *
 * @param {Array}  todosEstados - Todos los estados de cola
 * @param {number} hasta        - Índice hasta el cual mostrar (0-based)
 */
export function rerenderizarColas(todosEstados, hasta) {
  limpiarListaColas();
  todosEstados.slice(0, hasta + 1).forEach((estado, i) => {
    agregarItemCola(estado, i + 1);
  });
}

/**
 * Genera todos los estados de la cola de procesos a partir de los ticks de la simulación.
 * Para cada tick determina: quién está en CPU, quién espera, quién terminó.
 *
 * @param {Array} ticksOrdenados       - Ticks importantes en orden (llegadas y cambios de evento)
 * @param {Array} procesosResultado    - Procesos con métricas calculadas
 * @param {Array} eventosGantt         - Eventos del Gantt para determinar quién está en CPU
 * @returns {Array} Lista de estados de cola, uno por tick
 */
export function generarEstadosCola(ticksOrdenados, procesosResultado, eventosGantt) {
  const estados = [];
  const terminados = new Set();

  // Agregar estado inicial en t=0
  estados.push({
    tick:       0,
    enCPU:      null,
    enCola:     [],
    terminados: [],
  });

  // Generar estado para cada tick importante
  ticksOrdenados.forEach((tick) => {
    // Determinar quién está en CPU en este tick
    let enCPU = null;
    for (const evento of eventosGantt) {
      if (tick >= evento.inicio && tick < evento.fin) {
        enCPU = evento.proceso === 'IDLE' ? null : evento.proceso;
        break;
      }
    }

    // Procesos que ya terminaron EN O ANTES de este tick
    procesosResultado.forEach(p => {
      if (p.fin !== undefined && p.fin <= tick && p.fin > 0) {
        terminados.add(p.id);
      }
    });

    // Procesos en cola: llegaron, no están en CPU y no terminaron
    const enCola = procesosResultado
      .filter(p =>
        p.llegada <= tick &&          // ya llegaron
        p.id !== enCPU &&             // no están en CPU ahora
        !terminados.has(p.id)         // no terminaron aún
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
// HELPER COMPARTIDO
// ──────────────────────────────────────────────────────

/**
 * Retorna la configuración visual (clase CSS, badge, texto) según el tipo de paso.
 */
function obtenerConfigTipo(tipo) {
  const mapa = {
    ok:      { clase: 'paso-ok',      badge: 'ok',      texto: 'Asignado'   },
    error:   { clase: 'paso-error',   badge: 'error',   texto: 'Rechazado'  },
    libre:   { clase: 'paso-libre',   badge: 'libre',   texto: 'Liberado'   },
    buddy:   { clase: 'paso-buddy',   badge: 'buddy',   texto: 'División'   },
    compact: { clase: 'paso-compact', badge: 'compact', texto: 'Compactado' },
  };
  return mapa[tipo] || { clase: 'paso-ok', badge: 'ok', texto: 'Evento' };
}
