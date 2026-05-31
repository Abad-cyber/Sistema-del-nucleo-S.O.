// ═══════════════════════════════════════════════════════
// ui/metricsRenderer.js — Renderizador de métricas y tablas
// Actualiza las stat-boxes, tablas de CPU y memoria, y el análisis de fragmentación
// ═══════════════════════════════════════════════════════

/**
 * Actualiza las cajas de métricas de CPU en la interfaz.
 *
 * @param {Array}  procesosResultado - Procesos con métricas calculadas
 * @param {number} tiempoTotal       - Tiempo total de la simulación
 */
export function actualizarMetricasCPU(procesosResultado, tiempoTotal) {
  const procesosCompletados = procesosResultado.filter(p => p.fin > -1);

  if (procesosCompletados.length === 0) return;

  // Tiempo de espera promedio
  const tePromedio = procesosCompletados.reduce((s, p) => s + p.tiempoEspera, 0) / procesosCompletados.length;

  // Tiempo de retorno promedio
  const trPromedio = procesosCompletados.reduce((s, p) => s + p.tiempoRetorno, 0) / procesosCompletados.length;

  // Tiempo útil de CPU (excluyendo IDLE)
  const tiempoUtil = procesosCompletados.reduce((s, p) => s + p.ejecucion, 0);
  const usoCPU     = tiempoTotal > 0 ? ((tiempoUtil / tiempoTotal) * 100).toFixed(1) : '0.0';

  // Throughput: procesos por unidad de tiempo
  const throughput = tiempoTotal > 0 ? (procesosCompletados.length / tiempoTotal).toFixed(2) : '0';

  // Actualizar elementos del DOM con animación
  actualizarCajaMetrica('mvUsoCPU',    usoCPU + '%',        'cmUsoCPU');
  actualizarCajaMetrica('mvTEPromedio', tePromedio.toFixed(2), 'cmTEPromedio');
  actualizarCajaMetrica('mvTRPromedio', trPromedio.toFixed(2), 'cmTRPromedio');
  actualizarCajaMetrica('mvThroughput', throughput,            'cmThroughput');
}

/**
 * Actualiza las cajas de métricas de memoria en la interfaz.
 *
 * @param {Object} metricas        - Objeto con métricas de memoria
 * @param {number} totalProcesos   - Total de procesos intentados
 */
export function actualizarMetricasMemoria(metricas, totalProcesos) {
  actualizarCajaMetrica('mvUsoMem',  metricas.porcentajeUso + '%',                              'cmUsoMem');
  actualizarCajaMetrica('mvFragInt', metricas.fragInterna + 'KB',                              'cmFragInt');
  actualizarCajaMetrica('mvFragExt', metricas.fragExterna + 'KB',                              'cmFragExt');
  actualizarCajaMetrica('mvProcMem', metricas.procesosAsignados + '/' + totalProcesos,         'cmProcMem');
}

/**
 * Actualiza el valor de una caja de métrica con animación.
 *
 * @param {string} idValor - ID del elemento donde se muestra el valor
 * @param {string} valor   - Valor a mostrar
 * @param {string} idCaja  - ID de la caja (para la animación del borde)
 */
function actualizarCajaMetrica(idValor, valor, idCaja) {
  const elValor = document.getElementById(idValor);
  const elCaja  = document.getElementById(idCaja);
  if (!elValor || !elCaja) return;

  elValor.textContent = valor;
  elCaja.classList.add('cargado');
}

/**
 * Renderiza la tabla de planificación de CPU con todas las métricas por proceso.
 *
 * @param {Array} procesosResultado - Procesos con métricas calculadas
 */
export function renderizarTablaCPU(procesosResultado) {
  const cuerpo = document.getElementById('cuerpoTablaCPU');
  if (!cuerpo) return;
  cuerpo.innerHTML = '';

  procesosResultado.forEach((proc, indice) => {
    const terminado = proc.fin > -1;
    const fila = document.createElement('tr');
    fila.style.animationDelay = `${indice * 25}ms`;
    fila.style.animation      = 'aparecer 0.3s ease both';
    fila.innerHTML = `
      <td><span class="badge-proc" style="background:${proc.color}">${proc.id}</span></td>
      <td>${proc.llegada}</td>
      <td>${proc.ejecucion}</td>
      <td>${terminado ? proc.inicio   : '—'}</td>
      <td>${terminado ? proc.fin      : '—'}</td>
      <td>${terminado ? proc.tiempoEspera    : '—'}</td>
      <td>${terminado ? proc.tiempoRetorno   : '—'}</td>
      <td>${terminado ? proc.tiempoRespuesta : '—'}</td>
      <td>${terminado
        ? '<span class="badge-ok">✓ Completado</span>'
        : '<span class="badge-fail">✗ Pendiente</span>'}</td>
    `;
    cuerpo.appendChild(fila);
  });
}

/**
 * Renderiza la tabla de gestión de memoria con el estado de cada proceso.
 *
 * @param {Array} procesos  - Lista original de procesos
 * @param {Array} pasosMem  - Pasos de asignación de memoria generados
 */
export function renderizarTablaMemoria(procesos, pasosMem) {
  const cuerpo = document.getElementById('cuerpoTablaMemoria');
  if (!cuerpo) return;
  cuerpo.innerHTML = '';

  // Construir mapa de resultados por proceso (solo exitosos)
  const mapaResultados = {};
  pasosMem.forEach(paso => {
    // Solo procesar pasos de tipo 'ok' (asignación exitosa)
    if (paso.proceso && paso.tipo === 'ok' && paso.exito) {
      // Guardar solo la primera asignación exitosa para cada proceso
      if (!mapaResultados[paso.proceso]) {
        mapaResultados[paso.proceso] = paso;
      }
    }
  });

  procesos.forEach((proc, indice) => {
    const resultado = mapaResultados[proc.id];
    const asignado  = resultado && resultado.exito;
    const fila      = document.createElement('tr');
    fila.style.animationDelay = `${indice * 25}ms`;
    fila.style.animation      = 'aparecer 0.3s ease both';
    
    let tamanioParticion = '—';
    let dirInicio = '—';
    let dirFin = '—';
    let fragInterna = '—';
    
    if (asignado) {
      tamanioParticion = (resultado.tamanioParticion !== undefined) ? resultado.tamanioParticion + ' KB' : '—';
      dirInicio = (resultado.inicio !== undefined) ? resultado.inicio + ' KB' : '—';
      dirFin = (resultado.inicio !== undefined) ? (resultado.inicio + proc.tamanioKB - 1) + ' KB' : '—';
      
      if (resultado.fragmentacionInterna !== undefined) {
        fragInterna = resultado.fragmentacionInterna > 0
          ? `<span class="badge-frag">${resultado.fragmentacionInterna} KB</span>`
          : `<span class="badge-cero">0 KB</span>`;
      }
    }
    
    fila.innerHTML = `
      <td><span class="badge-proc" style="background:${proc.color}">${proc.id}</span></td>
      <td>${proc.tamanioKB} KB</td>
      <td>${tamanioParticion}</td>
      <td>${dirInicio}</td>
      <td>${dirFin}</td>
      <td>${fragInterna}</td>
      <td>${asignado
        ? '<span class="badge-ok">✓ Asignado</span>'
        : '<span class="badge-fail">✗ Rechazado</span>'}</td>
    `;
    cuerpo.appendChild(fila);
  });
}

/**
 * Renderiza el análisis de fragmentación interna y externa.
 *
 * @param {Array}  bloques     - Estado actual de la memoria
 * @param {number} memoriaTotal - KB totales
 */
export function renderizarAnalisisFragmentacion(bloques, memoriaTotal) {
  const contenedor = document.getElementById('analisisFragmentacion');
  if (!contenedor) return;

  const bloquesProceso = bloques.filter(b => b.tipo === 'proceso');
  const bloquesLibres  = bloques.filter(b => b.tipo === 'libre');
  const fragInterna    = bloquesProceso.reduce((s, b) => s + (b.fragmentacionInterna || 0), 0);
  const fragExterna    = bloquesLibres.reduce((s, b)  => s + b.tamanio, 0);

  // Lista de fragmentación interna por proceso
  const itemsFragInt = bloquesProceso
    .filter(b => b.fragmentacionInterna > 0)
    .map(b => `
      <div class="frag-item">
        <span>${b.id}</span>
        <span style="color:var(--rojo);font-weight:700">+${b.fragmentacionInterna}KB</span>
      </div>
    `).join('') || '<div class="frag-item" style="color:var(--texto-suave)">Sin fragmentación interna</div>';

  // Lista de huecos libres
  const itemsFragExt = bloquesLibres
    .map(b => `
      <div class="frag-item">
        <span>${b.id} @${b.inicio}KB</span>
        <span style="color:var(--acento2);font-weight:700">${b.tamanio}KB</span>
      </div>
    `).join('') || '<div class="frag-item" style="color:var(--texto-suave)">Sin huecos libres</div>';

  contenedor.innerHTML = `
    <div class="grilla-frag">
      <div class="card-frag">
        <div class="card-frag-titulo">Fragmentación Interna</div>
        <div class="card-frag-valor" style="color:var(--rojo)">${fragInterna} KB</div>
        <div class="card-frag-desc">Espacio asignado a procesos pero no utilizado dentro de sus particiones.</div>
        <div class="lista-frag">${itemsFragInt}</div>
      </div>
      <div class="card-frag">
        <div class="card-frag-titulo">Fragmentación Externa</div>
        <div class="card-frag-valor" style="color:var(--acento2)">${fragExterna} KB</div>
        <div class="card-frag-desc">Huecos libres dispersos que no pueden usarse juntos sin compactación.</div>
        <div class="lista-frag">${itemsFragExt}</div>
      </div>
    </div>
  `;
}
