// main.js — Orquestador principal del Simulador Unificado
// Coordina CPU + memoria + animación sincronizada

import { parsearTexto, leerTablaManual, sincronizarTablaDOM, crearFilaTabla, asignarEventosFilas } from './parser.js';
import { fcfs, sjf, roundRobin, srt } from './planificadores/algoritmos.js';
import {
  construirMemoriaInicial,
  firstFit, bestFit, worstFit,
  buddySystem, liberarProceso, buddyLiberar,
  calcularMetricasMemoria,
  COLOR_LIBRE,
} from './memoria/algoritmos.js';
import { renderizarMapaMemoria, renderizarLeyenda, resetColoresMemoria, PALETA_GRADIENTES } from './ui/memRenderer.js';
import { dibujarGantt, renderizarLeyendaGantt } from './ui/ganttRenderer.js';
import { actualizarMetricasCPU, actualizarMetricasMemoria, renderizarTablaCPU, renderizarTablaMemoria } from './ui/metricsRenderer.js';
import { agregarPasoLog, limpiarLog, rerenderizarLog, agregarItemCola, limpiarListaColas, rerenderizarColas, generarEstadosCola, resetColoresProcesos, setPaletaExterna } from './ui/stepLog.js';

// ═══════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════
let procesos           = [];
let eventosGantt       = [];
let procesosResultado  = [];
let estadosMemoria     = [];
let pasosMem           = [];
let estadosCola        = [];
let mapaPasosATiempos  = [];
let limitePasosPorTick = [];
let memoriaActual      = [];
let pasoActual         = 0;
let totalPasos         = 0;
let estaReproduciendo  = false;
let timerAnimacion     = null;
let timerReinicio      = null;
let memoriaTotal       = 400;
let memoriaSOReservado = 0;
let politicaParticion  = 'dinamica';
let algoMemActual      = 'ff';
let contadorFilas      = 0;

const porDefecto = [
  { id: 'P1', llegada: 0, ejecucion: 5, tamanioKB: 50 },
  { id: 'P2', llegada: 1, ejecucion: 3, tamanioKB: 30 },
  { id: 'P3', llegada: 2, ejecucion: 8, tamanioKB: 80 },
  { id: 'P4', llegada: 4, ejecucion: 2, tamanioKB: 20 },
  { id: 'P5', llegada: 5, ejecucion: 4, tamanioKB: 40 },
  { id: 'P6', llegada: 6, ejecucion: 6, tamanioKB: 60 },
];
let vistaGantt = 'compacto';

const VELOCIDADES = { 1: 2000, 2: 1200, 3: 700, 4: 350, 5: 60 };
const NOMBRES_VEL = { 1: 'Muy lento', 2: 'Lento', 3: 'Normal', 4: 'R\u00e1pido', 5: 'M\u00e1ximo' };

// ═══════════════════════════════════════════════════════
// INICIO
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  inicializarTablaEntrada();
  inicializarNavegacion();
  inicializarArchivoArrastre();
  inicializarControlesAlgoritmo();
  inicializarControlesMemoria();
  inicializarControlesAnimacion();
  inicializarVistasGantt();
  inicializarBotonesAdicionales();
});

// ═══════════════════════════════════════════════════════
// BOTONES ADICIONALES
// ═══════════════════════════════════════════════════════
function inicializarBotonesAdicionales() {
  document.getElementById('btnEjecutarSidebar')?.addEventListener('click', ejecutarSimulacion);
}

// ═══════════════════════════════════════════════════════
// NAVEGACIÓN SPA
// ═══════════════════════════════════════════════════════
function inicializarNavegacion() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', function () {
      navegarA(this.dataset.pagina);
    });
  });
}

function navegarA(idPagina) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('activo'));
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa'));
  document.querySelector(`[data-pagina="${idPagina}"]`)?.classList.add('activo');
  const target = document.getElementById(`pagina${idPagina.charAt(0).toUpperCase() + idPagina.slice(1)}`);
  if (target) {
    target.classList.add('activa');
    target.classList.add('visito');
  }
}

// ═══════════════════════════════════════════════════════
// VISTAS DEL GANTT
// ═══════════════════════════════════════════════════════
function inicializarVistasGantt() {
  document.getElementById('btnVistaCompacto')?.classList.add('activo');
  document.getElementById('btnVistaProceso')?.classList.remove('activo');

  document.getElementById('btnVistaCompacto')?.addEventListener('click', () => {
    vistaGantt = 'compacto';
    document.getElementById('btnVistaCompacto')?.classList.add('activo');
    document.getElementById('btnVistaProceso')?.classList.remove('activo');
    if (eventosGantt.length) redibujarGantt();
  });

  document.getElementById('btnVistaProceso')?.addEventListener('click', () => {
    vistaGantt = 'proceso';
    document.getElementById('btnVistaProceso')?.classList.add('activo');
    document.getElementById('btnVistaCompacto')?.classList.remove('activo');
    if (eventosGantt.length) redibujarGantt();
  });
}

function redibujarGantt() {
  if (!eventosGantt.length) return;
  const tiempoActual = mapaPasosATiempos[pasoActual] ?? 0;
  dibujarGantt(eventosGantt, procesos, pasoActual, false, vistaGantt, tiempoActual);
}

// ═══════════════════════════════════════════════════════
// TABLA MANUAL
// ═══════════════════════════════════════════════════════
function sincronizarContadorFilas() {
  contadorFilas = document.querySelectorAll('#cuerpoTablaEntrada tr').length;
}

function inicializarTablaEntrada() {
  const cuerpo = document.getElementById('cuerpoTablaEntrada');
  porDefecto.forEach((p, i) => cuerpo.appendChild(crearFilaTabla(i, p.id, p.llegada, p.ejecucion, p.tamanioKB)));
  contadorFilas = porDefecto.length;
  asignarEventosFilas(sincronizarContadorFilas);

  document.getElementById('btnAgregarFila')?.addEventListener('click', () => {
    const c = document.getElementById('cuerpoTablaEntrada');
    c.appendChild(crearFilaTabla(contadorFilas++));
    c.lastElementChild?.querySelector('.celda-inp')?.focus();
  });
}

// ═══════════════════════════════════════════════════════
// ARRASTRE DE ARCHIVO
// ═══════════════════════════════════════════════════════
function inicializarArchivoArrastre() {
  const zona  = document.getElementById('zonaArrastre');
  const input = document.getElementById('inputArchivo');

  if (!zona || !input) return;

  input.addEventListener('change', e => {
    if (e.target.files && e.target.files.length > 0) {
      manejarArchivo(e.target.files[0]);
    }
  });

  zona.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    zona.classList.add('arrastrando');
  });

  zona.addEventListener('dragleave', e => {
    e.preventDefault();
    e.stopPropagation();
    zona.classList.remove('arrastrando');
  });

  zona.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    zona.classList.remove('arrastrando');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      manejarArchivo(e.dataTransfer.files[0]);
    }
  });
}

function manejarArchivo(archivo) {
  if (!archivo) return;
  const zona = document.getElementById('zonaArrastre');

  const animarZona = (clase) => {
    if (!zona) return;
    zona.classList.remove('arrastrando', 'exito', 'error-anim');
    void zona.offsetWidth;
    zona.classList.add(clase);
    setTimeout(() => zona.classList.remove(clase), 900);
  };

  const ext = archivo.name.split('.').pop().toLowerCase();
  if (!['csv', 'txt'].includes(ext)) {
    animarZona('error-anim');
    mostrarToast('\u274c Solo se permiten archivos .csv o .txt', 'error');
    return;
  }

  const maxSize = 5 * 1024 * 1024;
  if (archivo.size > maxSize) {
    animarZona('error-anim');
    mostrarToast('\u274c El archivo es muy grande (m\u00e1ximo 5MB)', 'error');
    return;
  }

  const lector = new FileReader();

  lector.onerror = () => {
    animarZona('error-anim');
    mostrarToast('\u274c Error al leer el archivo', 'error');
  };

  lector.onabort = () => {
    animarZona('error-anim');
    mostrarToast('\u26a0\ufe0f Lectura de archivo cancelada', 'error');
  };

  lector.onload = e => {
    try {
      const contenido = e.target.result;
      if (!contenido || contenido.trim().length === 0) {
        animarZona('error-anim');
        mostrarToast('\u274c El archivo est\u00e1 vac\u00edo', 'error');
        return;
      }

      const ps = parsearTexto(contenido);
      if (!ps.length) {
        animarZona('error-anim');
        mostrarToast('\u274c No se encontraron procesos v\u00e1lidos', 'error');
        return;
      }

      sincronizarTablaDOM(ps, sincronizarContadorFilas);
      contadorFilas = ps.length;

      const nombreEscapado = document.createElement('span');
      nombreEscapado.textContent = archivo.name;
      document.getElementById('nombreArchivo').innerHTML = `\ud83d\udcc2 ${nombreEscapado.innerHTML}  (${ps.length} proceso(s))`;
      animarZona('exito');
      mostrarToast(`\u2713 ${ps.length} proceso(s) cargados correctamente`, 'exito');
    } catch (error) {
      animarZona('error-anim');
      mostrarToast(`\u274c Error al procesar el archivo: ${error.message}`, 'error');
    }
  };

  lector.readAsText(archivo);
}

// ═══════════════════════════════════════════════════════
// CONTROLES ALGORITMOS
// ═══════════════════════════════════════════════════════
function inicializarControlesAlgoritmo() {
  const cardsCPU = { fcfs: 'cardFCFS', sjf: 'cardSJF', rr: 'cardRR', srt: 'cardSRT' };
  document.querySelectorAll('input[name="algoCPU"]').forEach(r => {
    r.addEventListener('change', function () {
      Object.entries(cardsCPU).forEach(([v, id]) =>
        document.getElementById(id)?.classList.toggle('seleccionado', v === this.value));
      document.getElementById('cajaQuantum')?.classList.toggle('inactivo', this.value !== 'rr');
    });
  });

  const cardsMem = { ff: 'cardFF', bf: 'cardBF', wf: 'cardWF', buddy: 'cardBuddy' };
  document.querySelectorAll('input[name="algoMem"]').forEach(r => {
    r.addEventListener('change', function () {
      Object.entries(cardsMem).forEach(([v, id]) =>
        document.getElementById(id)?.classList.toggle('seleccionado', v === this.value));
      algoMemActual = this.value;
    });
  });
}

function inicializarControlesMemoria() {
  document.getElementById('btnQuantumMenos')?.addEventListener('click', () => {
    const inp = document.getElementById('inputQuantum');
    if (!inp) return;
    const val = parseInt(inp.value) || 2;
    inp.value = Math.max(1, val - 1);
  });
  document.getElementById('btnQuantumMas')?.addEventListener('click', () => {
    const inp = document.getElementById('inputQuantum');
    if (!inp) return;
    const val = parseInt(inp.value) || 2;
    inp.value = val + 1;
  });

  document.querySelectorAll('.btn-politica').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.btn-politica').forEach(b => b.classList.remove('activo'));
      this.classList.add('activo');
      politicaParticion = this.dataset.politica;
      document.getElementById('configParticionesFijas')?.classList.toggle('oculto', politicaParticion !== 'fija');
    });
  });
}

// ═══════════════════════════════════════════════════════
// EJECUCIÓN DE LA SIMULACIÓN
// ═══════════════════════════════════════════════════════
function ejecutarSimulacion() {
  const btnEjecutar = document.getElementById('btnEjecutarSidebar');
  if (!btnEjecutar) return;

  procesos = leerTablaManual();
  if (!procesos.length) { mostrarToast('Ingresa al menos un proceso.', 'error'); return; }

  memoriaTotal       = Math.max(64, parseInt(document.getElementById('memoriaTotal')?.value)       || 400);
  memoriaSOReservado = Math.max(0, parseInt(document.getElementById('memoriaSOReservado')?.value) || 0);
  const algoCPU      = document.querySelector('input[name="algoCPU"]:checked')?.value || 'fcfs';
  algoMemActual      = document.querySelector('input[name="algoMem"]:checked')?.value || 'ff';
  const quantum      = parseInt(document.getElementById('inputQuantum')?.value)       || 2;

  if (memoriaSOReservado >= memoriaTotal) {
    mostrarToast('El SO reservado debe ser menor que la memoria total.', 'error'); return;
  }

  // Loading state
  const textoOriginal = btnEjecutar.innerHTML;
  btnEjecutar.disabled = true;
  btnEjecutar.innerHTML = '<span class="btn-ej-icono" aria-hidden="true"><span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spinLogo .6s linear infinite"></span></span><span class="btn-ej-texto">Simulando\u2026</span>';

  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        ejecutarSimulacionInterna(algoCPU, quantum);
      } finally {
        btnEjecutar.disabled = false;
        btnEjecutar.innerHTML = textoOriginal;
      }
    }, 50);
  });
}

function ejecutarSimulacionInterna(algoCPU, quantum) {
  let resCPU;
  switch (algoCPU) {
    case 'fcfs': resCPU = fcfs(procesos);                break;
    case 'sjf':  resCPU = sjf(procesos);                 break;
    case 'rr':   resCPU = roundRobin(procesos, quantum); break;
    case 'srt':  resCPU = srt(procesos);                 break;
    default:     resCPU = fcfs(procesos);
  }
  eventosGantt      = resCPU.eventosGantt;
  procesosResultado = resCPU.procesosResultado;

  let tamaniosFijos = [];
  if (politicaParticion === 'fija') {
    tamaniosFijos = (document.getElementById('particionesFijas')?.value || '')
      .split(',').map(s => parseInt(s.trim())).filter(n => n > 0);
    const suma = tamaniosFijos.reduce((s, n) => s + n, 0);
    if (suma + memoriaSOReservado > memoriaTotal) {
      mostrarToast(`Particiones (${suma}KB) + SO (${memoriaSOReservado}KB) superan la memoria total.`, 'error'); return;
    }
  }

  const memoriaInicial = construirMemoriaInicial(memoriaTotal, memoriaSOReservado, politicaParticion, tamaniosFijos, algoMemActual);

  const { snapshotsMemoria, registroPasos, mapeoTiempos, ticksOrdenados, acumPasos } = simularMemoriaSincronizada(
    eventosGantt, procesosResultado, memoriaInicial, algoMemActual, politicaParticion, tamaniosFijos
  );
  estadosMemoria = snapshotsMemoria;
  pasosMem       = registroPasos;
  mapaPasosATiempos = mapeoTiempos;

  estadosCola = generarEstadosCola(ticksOrdenados, procesosResultado, eventosGantt);
  limitePasosPorTick = acumPasos;

  totalPasos    = estadosMemoria.length - 1;
  pasoActual    = 0;
  memoriaActual = estadosMemoria[0];

  document.getElementById('graficaEmpty')?.classList.add('oculto');
  document.getElementById('graficaContenido')?.classList.remove('oculto');
  document.getElementById('tablasEmpty')?.classList.add('oculto');
  document.getElementById('tablasContenido')?.classList.remove('oculto');

  resetColoresMemoria();
  resetColoresProcesos();
  setPaletaExterna(PALETA_GRADIENTES);

  limpiarLog();
  limpiarListaColas();
  reiniciarControlesAnimacion();

  renderizarTablaCPU(procesosResultado);
  renderizarTablaMemoria(procesos, pasosMem);
  renderizarLeyendaGantt(procesos);

  renderizarMapaMemoria(memoriaActual, memoriaTotal, -1, false);
  renderizarLeyenda(memoriaActual);

  const metMemInicial = calcularMetricasMemoria(memoriaActual, memoriaTotal);
  actualizarMetricasCPU(procesosResultado, 0, eventosGantt);
  actualizarMetricasMemoria(metMemInicial, procesos.length);

  const nombresCPU = { fcfs: 'FCFS', sjf: 'SJF', rr: `RR Q=${quantum}`, srt: 'SRT' };
  const nombresMem = { ff: 'First Fit', bf: 'Best Fit', wf: 'Worst Fit', buddy: 'Buddy' };
  const pillCPU = document.getElementById('pillCPU');
  const pillMem = document.getElementById('pillMem');
  if (pillCPU) { pillCPU.innerHTML = `<span class="pill-pulse"></span>CPU: ${nombresCPU[algoCPU]}`; pillCPU.classList.add('activo'); }
  if (pillMem) { pillMem.innerHTML = `<span class="pill-pulse" style="background:#f59e0b"></span>MEM: ${nombresMem[algoMemActual]}`; pillMem.classList.add('activo'); }

  navegarA('grafica');

  timerAnimacion = setTimeout(() => iniciarAutoPlay(), 200);
  mostrarToast(`Simulaci\u00f3n ${nombresCPU[algoCPU]} + ${nombresMem[algoMemActual]} lista \u2014 ${totalPasos} paso(s)`, 'exito');
}

// ═══════════════════════════════════════════════════════
// SINCRONIZACIÓN CPU ↔ MEMORIA
// ═══════════════════════════════════════════════════════

function simularMemoriaSincronizada(eventosGantt, procesosRes, memoriaInicial, algoMem, politicaParticion, tamaniosFijos) {
  const snapshotsMemoria   = [];
  const registroPasos      = [];
  const procesosEnMemoria  = new Set();
  const procesosTerminados = new Set();

  const finRealPorProceso = {};
  eventosGantt.forEach(ev => {
    if (ev.proceso === 'IDLE') return;
    if (!finRealPorProceso[ev.proceso] || ev.fin > finRealPorProceso[ev.proceso]) {
      finRealPorProceso[ev.proceso] = ev.fin;
    }
  });

  let estadoMem = JSON.parse(JSON.stringify(memoriaInicial));
  const acumPasos = [0];

  function asignarMemoria(proceso) {
    if (procesosEnMemoria.has(proceso.id)) return;
    procesosEnMemoria.add(proceso.id);
    let resultado;
    const pasosBuddy = [];

    if (politicaParticion === 'fija') {
      resultado = asignarEnParticionFija(proceso, estadoMem);
    } else {
      switch (algoMem) {
        case 'ff':    resultado = firstFit(proceso, estadoMem);                break;
        case 'bf':    resultado = bestFit(proceso, estadoMem);                 break;
        case 'wf':    resultado = worstFit(proceso, estadoMem);                break;
        case 'buddy': resultado = buddySystem(proceso, estadoMem, pasosBuddy); break;
        default:      resultado = firstFit(proceso, estadoMem);
      }
      pasosBuddy.forEach(p =>
        registroPasos.push({ proceso: proceso.id, tipo: 'buddy', exito: true, descripcion: p.descripcion })
      );
    }

    registroPasos.push({
      proceso:              proceso.id,
      tipo:                 resultado.exito ? 'ok' : 'error',
      exito:                resultado.exito,
      descripcion:          resultado.descripcion,
      inicio:               resultado.inicio,
      tamanioParticion:     resultado.tamanioParticion,
      fragmentacionInterna: resultado.fragmentacionInterna,
      fragEsInterna:        resultado.fragEsInterna,
    });
  }

  function asignarEnParticionFija(proceso, memoria) {
    for (let i = 0; i < memoria.length; i++) {
      const bloque = memoria[i];
      if (bloque.tipo === 'libre' && bloque.tamanio >= proceso.tamanioKB) {
        const fragmentacion = bloque.tamanio - proceso.tamanioKB;
        const bloqueAsignado = {
          id:                   proceso.id,
          tipo:                 'proceso',
          inicio:               bloque.inicio,
          tamanio:              proceso.tamanioKB,
          tamanioParticion:     bloque.tamanio,
          color:                proceso.color,
          fragmentacionInterna: fragmentacion,
        };
        memoria.splice(i, 1, bloqueAsignado);
        return {
          exito:                true,
          inicio:               bloqueAsignado.inicio,
          tamanioParticion:     bloque.tamanio,
          fragmentacionInterna: fragmentacion,
          fragEsInterna:        true,
          descripcion: `${proceso.id} asignado en partici\u00f3n @${bloqueAsignado.inicio}KB (${bloque.tamanio}KB). Usa ${proceso.tamanioKB}KB, fragmentaci\u00f3n interna: ${fragmentacion}KB.`,
        };
      }
    }
    return { exito: false, descripcion: `No hay partici\u00f3n libre \u2265 ${proceso.tamanioKB}KB. Proceso ${proceso.id} rechazado.`, fragmentacionInterna: 0 };
  }

  function liberarMemoria(proceso) {
    if (procesosTerminados.has(proceso.id)) return;
    if (!procesosEnMemoria.has(proceso.id)) return;
    procesosTerminados.add(proceso.id);

    if (politicaParticion === 'fija') {
      const idx = estadoMem.findIndex(b => b.id === proceso.id && b.tipo === 'proceso');
      if (idx !== -1) {
        const bloque = estadoMem[idx];
        estadoMem[idx] = {
          id:      `H${bloque.inicio}`,
          tipo:    'libre',
          inicio:  bloque.inicio,
          tamanio: bloque.tamanioParticion,
          color:   COLOR_LIBRE,
        };
        registroPasos.push({
          proceso: proceso.id,
          tipo:    'libre',
          exito:   true,
          descripcion: `${proceso.id} liberado. Partici\u00f3n completa de ${bloque.tamanioParticion}KB en @${bloque.inicio}KB marcada libre.`
        });
      }
    } else if (algoMem === 'buddy') {
      const pb = [];
      buddyLiberar(proceso.id, estadoMem, pb);
      pb.forEach(p =>
        registroPasos.push({ proceso: proceso.id, tipo: p.tipo, exito: true, descripcion: p.descripcion })
      );
    } else {
      const r = liberarProceso(proceso.id, estadoMem);
      if (r.exito) {
        registroPasos.push({ proceso: proceso.id, tipo: 'libre', exito: true, descripcion: r.descripcion });
      }
    }
  }

  snapshotsMemoria.push(JSON.parse(JSON.stringify(estadoMem)));
  const mapeoTiempos = [0];

  const ticksImportantes = new Set();
  eventosGantt.forEach(ev => {
    ticksImportantes.add(ev.inicio);
    ticksImportantes.add(ev.fin);
  });
  procesosRes.forEach(p => {
    ticksImportantes.add(p.llegada);
  });
  const ticksOrdenados = Array.from(ticksImportantes).sort((a, b) => a - b);

  const primerTick = ticksOrdenados[0] ?? 0;
  procesosRes.forEach(p => {
    if (p.llegada < primerTick && !procesosEnMemoria.has(p.id)) {
      asignarMemoria(p);
    }
  });

  ticksOrdenados.forEach((tick) => {
    procesosRes.forEach(p => {
      if (finRealPorProceso[p.id] === tick) {
        liberarMemoria(p);
      }
    });

    procesosRes.forEach(p => {
      if (p.llegada === tick && !procesosEnMemoria.has(p.id)) {
        asignarMemoria(p);
      }
    });

    acumPasos.push(registroPasos.length);
    snapshotsMemoria.push(JSON.parse(JSON.stringify(estadoMem)));
    mapeoTiempos.push(tick);
  });

  return { snapshotsMemoria, registroPasos, mapeoTiempos, ticksOrdenados, acumPasos };
}

// ═══════════════════════════════════════════════════════
// CONTROLES DE ANIMACIÓN
// ═══════════════════════════════════════════════════════
function inicializarControlesAnimacion() {
  document.getElementById('btnPlayPausa')?.addEventListener('click', () => {
    if (estaReproduciendo) detenerAutoPlay();
    else iniciarAutoPlay();
  });
  document.getElementById('btnPasoSiguiente')?.addEventListener('click', () => {
    detenerAutoPlay();
    mostrarPaso(pasoActual + 1);
  });
  document.getElementById('btnPasoAnterior')?.addEventListener('click', () => {
    detenerAutoPlay();
    if (pasoActual > 0) mostrarPaso(pasoActual - 1);
  });
  document.getElementById('btnReiniciar')?.addEventListener('click', () => {
    detenerAutoPlay();
    pasoActual = 0;
    resetColoresMemoria();
    resetColoresProcesos();
    setPaletaExterna(PALETA_GRADIENTES);
    limpiarLog();
    limpiarListaColas();
    if (estadosMemoria.length > 0) {
      memoriaActual = estadosMemoria[0];
      renderizarMapaMemoria(memoriaActual, memoriaTotal, -1, false);
      renderizarLeyenda(memoriaActual);
    }
    redibujarGantt();
    actualizarBarraProgreso(0);
    document.getElementById('contadorPaso').textContent = `Paso 0 / ${totalPasos}`;
    clearTimeout(timerReinicio);
    timerReinicio = setTimeout(() => iniciarAutoPlay(), 200);
  });
  document.getElementById('sliderVelocidad')?.addEventListener('input', function () {
    document.getElementById('textoVelocidad').textContent = NOMBRES_VEL[this.value];
    if (estaReproduciendo) { clearTimeout(timerAnimacion); reproducirSiguientePaso(); }
  });
}

function reiniciarControlesAnimacion() {
  detenerAutoPlay();
  pasoActual = 0;
  actualizarBarraProgreso(0);
  document.getElementById('contadorPaso').textContent = `Paso 0 / ${totalPasos}`;
}

function iniciarAutoPlay() {
  if (estaReproduciendo || totalPasos === 0) return;
  estaReproduciendo = true;
  const btn = document.getElementById('btnPlayPausa');
  if (btn) { btn.textContent = '\u23f8 Pausar'; btn.classList.add('activo'); }
  reproducirSiguientePaso();
}

function detenerAutoPlay() {
  estaReproduciendo = false;
  clearTimeout(timerAnimacion);
  const btn = document.getElementById('btnPlayPausa');
  if (btn) { btn.textContent = '\u25b6 Auto'; btn.classList.remove('activo'); }
}

function reproducirSiguientePaso() {
  if (!estaReproduciendo) return;
  if (pasoActual >= totalPasos) {
    detenerAutoPlay();
    mostrarToast('Simulaci\u00f3n completada \u2713', 'exito');
    return;
  }
  mostrarPaso(pasoActual + 1);
  const nivel = parseInt(document.getElementById('sliderVelocidad')?.value) || 3;
  timerAnimacion = setTimeout(reproducirSiguientePaso, VELOCIDADES[nivel] || 700);
}

function mostrarPaso(indice) {
  if (indice < 0 || indice > totalPasos) return;
  const esAvance = indice > pasoActual;
  pasoActual = indice;

  const tiempoActual = mapaPasosATiempos[pasoActual] ?? 0;

  dibujarGantt(eventosGantt, procesos, pasoActual, false, vistaGantt, tiempoActual);

  // Usar referencia directa al snapshot — evita deep copy innecesaria
  const snapshot = estadosMemoria[pasoActual];
  if (snapshot) {
    memoriaActual = snapshot;
    renderizarMapaMemoria(memoriaActual, memoriaTotal, -1, true);
    renderizarLeyenda(memoriaActual);
  }

  actualizarMetricasCPU(procesosResultado, tiempoActual, eventosGantt);
  const metMem = calcularMetricasMemoria(memoriaActual, memoriaTotal);
  actualizarMetricasMemoria(metMem, procesos.length);

  if (esAvance) {
    if (pasoActual > 0 && limitePasosPorTick.length > pasoActual) {
      const limite = limitePasosPorTick[pasoActual];
      const inicio = limitePasosPorTick[pasoActual - 1];
      for (let i = inicio; i < limite; i++) {
        if (pasosMem[i]) agregarPasoLog(pasosMem[i], pasoActual);
      }
    }
  } else {
    const hasta = (pasoActual > 0 && limitePasosPorTick[pasoActual] !== undefined)
      ? limitePasosPorTick[pasoActual] - 1 : -1;
    rerenderizarLog(pasosMem, hasta);
  }

  if (pasoActual > 0) {
    const estadoCola = estadosCola[pasoActual];
    if (estadoCola) {
      if (esAvance) agregarItemCola(estadoCola, pasoActual);
      else rerenderizarColas(estadosCola, pasoActual);
    }
  } else if (!esAvance) {
    rerenderizarColas(estadosCola, -1);
  }



  actualizarBarraProgreso(totalPasos > 0 ? (pasoActual / totalPasos) * 100 : 0);
  document.getElementById('contadorPaso').textContent =
    `Paso ${pasoActual} / ${totalPasos}  (t = ${tiempoActual})`;
}

function actualizarBarraProgreso(pct) {
  const barra = document.getElementById('barraProgresoFill');
  if (barra) barra.style.width = `${pct}%`;
}

// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════
function mostrarToast(msg, tipo = '') {
  window.crearToastGlobo(msg, tipo || 'info');
}
