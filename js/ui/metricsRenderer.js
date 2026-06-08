// ui/metricsRenderer.js — Renderizador de métricas y tablas

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function max3(n) {
  if (typeof n !== 'number' || isNaN(n)) return '\u2014';
  return parseFloat(n.toFixed(3)).toString();
}

export function actualizarMetricasCPU(todosProcesos, tiempoActual, eventosGantt) {
  const completados = todosProcesos.filter(p => p.fin !== undefined && p.fin > -1 && p.fin <= tiempoActual);
  const totalProcStr = String(completados.length);

  let tePromedioStr = '\u2014';
  if (completados.length > 0) {
    const te = completados.reduce((s, p) => s + (p.tiempoEspera || 0), 0) / completados.length;
    tePromedioStr = te.toFixed(2);
  }

  let trPromedioStr = '\u2014';
  if (completados.length > 0) {
    const tr = completados.reduce((s, p) => s + (p.tiempoRetorno || 0), 0) / completados.length;
    trPromedioStr = tr.toFixed(2);
  }

  let usoCPUStr = '0.0';
  if (tiempoActual > 0) {
    const tiempoUtil = eventosGantt && eventosGantt.length
      ? eventosGantt
          .filter(ev => ev.proceso !== 'IDLE' && ev.inicio < tiempoActual)
          .reduce((s, ev) => s + (Math.min(ev.fin, tiempoActual) - ev.inicio), 0)
      : completados.reduce((s, p) => s + (p.ejecucion || 0), 0);
    usoCPUStr = ((tiempoUtil / tiempoActual) * 100).toFixed(1);
  }

  const throughputStr = tiempoActual > 0
    ? (completados.length / tiempoActual).toFixed(2)
    : '0.00';

  actualizarCajaMetrica('mvTotalProc',  totalProcStr,    'cmTotalProc');
  actualizarCajaMetrica('mvUsoCPU',     usoCPUStr + '%', 'cmUsoCPU');
  actualizarCajaMetrica('mvTEPromedio', tePromedioStr,   'cmTEPromedio');
  actualizarCajaMetrica('mvTRPromedio', trPromedioStr,   'cmTRPromedio');
  actualizarCajaMetrica('mvThroughput', throughputStr,   'cmThroughput');
}

export function actualizarMetricasMemoria(metricas, totalProcesos) {
  const memoriaLibreKB = metricas.fragExterna || 0;
  const memoriaLibreStr = memoriaLibreKB + ' KB';

  actualizarCajaMetrica('mvUsoMem',   metricas.porcentajeUso + '%',                          'cmUsoMem');
  actualizarCajaMetrica('mvMemLibre', memoriaLibreStr,                                        'cmMemLibre');
  actualizarCajaMetrica('mvFragInt',  max3(metricas.fragInterna) + 'KB',                       'cmFragInt');
  actualizarCajaMetrica('mvFragExt',  max3(metricas.fragExterna) + 'KB',                       'cmFragExt');
  actualizarCajaMetrica('mvProcMem',  metricas.procesosAsignados + '/' + totalProcesos,       'cmProcMem');
}

function actualizarCajaMetrica(idValor, valor, idCaja) {
  const elValor = document.getElementById(idValor);
  const elCaja  = document.getElementById(idCaja);
  if (!elValor || !elCaja) return;
  elValor.textContent = valor;
  elCaja.classList.add('cargado');
}

export function renderizarTablaCPU(procesosResultado) {
  const cuerpo = document.getElementById('cuerpoTablaCPU');
  if (!cuerpo) return;
  cuerpo.innerHTML = '';

  procesosResultado.forEach((proc, indice) => {
    const terminado = proc.fin > -1;
    const fila = document.createElement('tr');
    fila.style.animation = `aparecer 0.3s ease both ${indice * 25}ms`;
    fila.innerHTML = `
      <td><span class="badge-proc" style="background:${esc(proc.color)}">${esc(proc.id)}</span></td>
      <td>${proc.llegada}</td>
      <td>${proc.ejecucion}</td>
      <td>${terminado ? proc.inicio   : '\u2014'}</td>
      <td>${terminado ? proc.fin      : '\u2014'}</td>
      <td>${terminado ? proc.tiempoEspera    : '\u2014'}</td>
      <td>${terminado ? proc.tiempoRetorno   : '\u2014'}</td>
      <td>${terminado ? proc.tiempoRespuesta : '\u2014'}</td>
      <td>${terminado
        ? '<span class="badge-ok">✓ Completado</span>'
        : '<span class="badge-fail">✗ Pendiente</span>'}</td>
    `;
    cuerpo.appendChild(fila);
  });
}

export function renderizarTablaMemoria(procesos, pasosMem) {
  const cuerpo = document.getElementById('cuerpoTablaMemoria');
  if (!cuerpo) return;
  cuerpo.innerHTML = '';

  const mapaResultados = {};
  const mapaEstadoFinal = {};
  pasosMem.forEach(paso => {
    if (!paso.proceso) return;
    if (paso.tipo === 'ok' && paso.exito) {
      mapaResultados[paso.proceso] = paso;
      mapaEstadoFinal[paso.proceso] = 'asignado';
    } else if (paso.tipo === 'error') {
      if (!mapaResultados[paso.proceso]) mapaResultados[paso.proceso] = paso;
      mapaEstadoFinal[paso.proceso] = 'rechazado';
    } else if (paso.tipo === 'libre') {
      mapaEstadoFinal[paso.proceso] = 'liberado';
    }
  });

  procesos.forEach((proc, indice) => {
    const resultado = mapaResultados[proc.id];
    const estado    = mapaEstadoFinal[proc.id];
    const tuvoExito = estado === 'asignado' || estado === 'liberado';
    const fila      = document.createElement('tr');
    fila.style.animation = `aparecer 0.3s ease both ${indice * 25}ms`;

    let tamanioParticion = '\u2014';
    let dirInicio = '\u2014';
    let dirFin = '\u2014';
    let fragInterna = '\u2014';

    if (tuvoExito && resultado) {
      tamanioParticion = (resultado.tamanioParticion !== undefined) ? resultado.tamanioParticion + ' KB' : '\u2014';
      dirInicio = (resultado.inicio !== undefined) ? resultado.inicio + ' KB' : '\u2014';
      dirFin = (resultado.inicio !== undefined) ? (resultado.inicio + proc.tamanioKB - 1) + ' KB' : '\u2014';

      if (resultado.fragmentacionInterna !== undefined) {
        fragInterna = resultado.fragmentacionInterna > 0
          ? `<span class="badge-frag">${max3(resultado.fragmentacionInterna)} KB</span>`
          : `<span class="badge-cero">0 KB</span>`;
      }
    }

    fila.innerHTML = `
      <td><span class="badge-proc" style="background:${esc(proc.color)}">${esc(proc.id)}</span></td>
      <td>${proc.tamanioKB} KB</td>
      <td>${tamanioParticion}</td>
      <td>${dirInicio}</td>
      <td>${dirFin}</td>
      <td>${fragInterna}</td>
      <td>${estado === 'asignado'
        ? '<span class="badge-ok">✓ Asignado</span>'
        : estado === 'liberado'
        ? '<span class="badge-fail" style="background:var(--amber);color:#fff">↻ Liberado</span>'
        : '<span class="badge-fail">✗ Rechazado</span>'}</td>
    `;
    cuerpo.appendChild(fila);
  });
}

