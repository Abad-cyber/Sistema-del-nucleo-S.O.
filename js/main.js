// ═══════════════════════════════════════════════════════
// main.js — Orquestador principal del Simulador Unificado
// Coordina CPU + memoria + animación sincronizada
// ═══════════════════════════════════════════════════════

import { parsearTexto, leerTablaManual, sincronizarTablaDOM, crearFilaTabla, asignarEventosFilas } from './parser.js';
import { fcfs, sjf, roundRobin, srt } from './planificadores/algoritmos.js';
import {
  construirMemoriaInicial,
  firstFit, bestFit, worstFit,
  buddySystem, liberarProceso, buddyLiberar,
  compactarMemoria, calcularMetricasMemoria,
} from './memoria/algoritmos.js';
import { renderizarMapaMemoria, renderizarLeyenda, actualizarSelectorLiberar } from './ui/memRenderer.js';
import { dibujarGantt, renderizarLeyendaGantt } from './ui/ganttRenderer.js';
import { actualizarMetricasCPU, actualizarMetricasMemoria, renderizarTablaCPU, renderizarTablaMemoria, renderizarAnalisisFragmentacion } from './ui/metricsRenderer.js';
import { agregarPasoLog, limpiarLog, rerenderizarLog, agregarItemCola, limpiarListaColas, rerenderizarColas, generarEstadosCola } from './ui/stepLog.js';

// ═══════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════
let procesos           = [];          // Lista de procesos actuales
let eventosGantt       = [];
let procesosResultado  = [];
let estadosMemoria     = [];
let pasosMem           = [];          // Pasos de memoria para el log
let estadosCola        = [];          // Estados de la cola por paso
let mapaPasosATiempos  = [];          // Mapea paso (índice) a tiempo de reloj
let memoriaActual      = [];
let pasoActual         = 0;
let totalPasos         = 0;
let estaReproduciendo  = false;
let timerAnimacion     = null;
let memoriaTotal       = 400;
let memoriaSOReservado = 0;
let politicaParticion  = 'dinamica';
let algoMemActual      = 'ff';
let contadorFilas      = 0;

// Procesos de ejemplo cargados al inicio
const porDefecto = [
  { id: 'P1', llegada: 0, ejecucion: 5, tamanioKB: 50 },
  { id: 'P2', llegada: 1, ejecucion: 3, tamanioKB: 30 },
  { id: 'P3', llegada: 2, ejecucion: 8, tamanioKB: 80 },
  { id: 'P4', llegada: 4, ejecucion: 2, tamanioKB: 20 },
  { id: 'P5', llegada: 5, ejecucion: 4, tamanioKB: 40 },
  { id: 'P6', llegada: 6, ejecucion: 6, tamanioKB: 60 },
];
let vistaGantt         = 'proceso';   // 'proceso' o 'compacto'


const VELOCIDADES = { 1: 2000, 2: 1200, 3: 700, 4: 350, 5: 60 };
const NOMBRES_VEL = { 1: 'Muy lento', 2: 'Lento', 3: 'Normal', 4: 'Rápido', 5: 'Máximo' };

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
  inicializarBotonesOperaciones();
  inicializarBotonesAdicionales();
});

// ═══════════════════════════════════════════════════════
// BOTONES ADICIONALES (Sidebar)
// ═══════════════════════════════════════════════════════
function inicializarBotonesAdicionales() {
  document.getElementById('btnEjecutarSidebar')?.addEventListener('click', ejecutarSimulacion);
}

// ═══════════════════════════════════════════════════════
// NAVEGACIÓN SPA — sin reload, sin scroll automático
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
  document.getElementById(`pagina${idPagina.charAt(0).toUpperCase() + idPagina.slice(1)}`)?.classList.add('activa');
  // ── Sin scrollIntoView: la página NO se mueve ──
}

// ═══════════════════════════════════════════════════════
// VISTAS DEL GANTT — Compacto / Por proceso / Repetir
// ═══════════════════════════════════════════════════════
function inicializarVistasGantt() {
  document.getElementById('btnVistaProceso')?.addEventListener('click', () => {
    vistaGantt = 'proceso';
    document.getElementById('btnVistaProceso')?.classList.add('activo');
    document.getElementById('btnVistaCompacto')?.classList.remove('activo');
    redibujarGantt();
  });

  document.getElementById('btnVistaCompacto')?.addEventListener('click', () => {
    vistaGantt = 'compacto';
    document.getElementById('btnVistaCompacto')?.classList.add('activo');
    document.getElementById('btnVistaProceso')?.classList.remove('activo');
    redibujarGantt();
  });

  document.getElementById('btnRepetir')?.addEventListener('click', () => {
    // Reiniciar y volver a reproducir desde el paso 0
    detenerAutoPlay();
    pasoActual = 0;
    limpiarLog();
    limpiarListaColas();
    redibujarGantt();
    actualizarBarraProgreso(0);
    document.getElementById('contadorPaso').textContent = `Paso 0 / ${totalPasos}`;
    // Restaurar estado inicial de memoria
    if (estadosMemoria.length > 0) {
      memoriaActual = JSON.parse(JSON.stringify(estadosMemoria[0]));
      renderizarMapaMemoria(memoriaActual, memoriaTotal, -1, false);
      renderizarLeyenda(memoriaActual);
    }
    setTimeout(() => iniciarAutoPlay(), 150);
  });
}

/**
 * Redibuja el Gantt con el estado y vista actuales.
 * NO mueve la página.
 */
function redibujarGantt() {
  if (!eventosGantt.length) return;
  const tiempoActual = mapaPasosATiempos[Math.max(0, pasoActual - 1)] || 0;
  dibujarGantt(eventosGantt, procesos, pasoActual, false, vistaGantt, tiempoActual);
}

// ═══════════════════════════════════════════════════════
// TABLA MANUAL DE PROCESOS
// ═══════════════════════════════════════════════════════

/** Recalcula contadorFilas según las filas reales del DOM tras una eliminación. */
function sincronizarContadorFilas() {
  contadorFilas = document.querySelectorAll('#cuerpoTablaEntrada tr').length;
}

function inicializarTablaEntrada() {

  const cuerpo = document.getElementById('cuerpoTablaEntrada');
  porDefecto.forEach((p, i) => cuerpo.appendChild(crearFilaTabla(i, p.id, p.llegada, p.ejecucion, p.tamanioKB)));
  contadorFilas = porDefecto.length;
  // Instalar el delegador de eventos una sola vez para todos los botones ✕
  asignarEventosFilas(sincronizarContadorFilas);

  document.getElementById('btnAgregarFila')?.addEventListener('click', () => {
    const c = document.getElementById('cuerpoTablaEntrada');
    c.appendChild(crearFilaTabla(contadorFilas++));
    // No llamar asignarEventosFilas aquí: la delegación ya cubre las filas nuevas
    c.lastElementChild?.querySelector('.celda-inp')?.focus();
  });
}

// ═══════════════════════════════════════════════════════
// ARCHIVO DRAG & DROP
// ═══════════════════════════════════════════════════════
function inicializarArchivoArrastre() {
  const zona  = document.getElementById('zonaArrastre');
  const input = document.getElementById('inputArchivo');
  input?.addEventListener('change', e => manejarArchivo(e.target.files[0]));
  zona?.addEventListener('dragover',  e => { e.preventDefault(); zona.classList.add('arrastrando'); });
  zona?.addEventListener('dragleave', () => zona.classList.remove('arrastrando'));
  zona?.addEventListener('drop', e => {
    e.preventDefault();
    zona.classList.remove('arrastrando');
    manejarArchivo(e.dataTransfer.files[0]);
  });
}

function manejarArchivo(archivo) {
  if (!archivo) return;
  const ext = archivo.name.split('.').pop().toLowerCase();
  if (!['csv','txt'].includes(ext)) { mostrarToast('Solo .csv o .txt', 'error'); return; }
  const lector = new FileReader();
  lector.onload = e => {
    const ps = parsearTexto(e.target.result);
    if (!ps.length) { mostrarToast('No se encontraron procesos válidos.', 'error'); return; }
    sincronizarTablaDOM(ps, sincronizarContadorFilas);
    contadorFilas = ps.length;
    document.getElementById('nombreArchivo').textContent = `📂 ${archivo.name}  (${ps.length} proceso(s))`;
    mostrarToast(`✓ ${ps.length} proceso(s) cargados`, 'exito');
  };
  lector.readAsText(archivo);
}

// ═══════════════════════════════════════════════════════
// CONTROLES DE SELECCIÓN DE ALGORITMO
// ═══════════════════════════════════════════════════════
function inicializarControlesAlgoritmo() {
  const cardsCPU = { fcfs:'cardFCFS', sjf:'cardSJF', rr:'cardRR', srt:'cardSRT' };
  document.querySelectorAll('input[name="algoCPU"]').forEach(r => {
    r.addEventListener('change', function () {
      Object.entries(cardsCPU).forEach(([v,id]) =>
        document.getElementById(id)?.classList.toggle('seleccionado', v === this.value));
      document.getElementById('cajaQuantum')?.classList.toggle('inactivo', this.value !== 'rr');
    });
  });

  const cardsMem = { ff:'cardFF', bf:'cardBF', wf:'cardWF', buddy:'cardBuddy' };
  document.querySelectorAll('input[name="algoMem"]').forEach(r => {
    r.addEventListener('change', function () {
      Object.entries(cardsMem).forEach(([v,id]) =>
        document.getElementById(id)?.classList.toggle('seleccionado', v === this.value));
      algoMemActual = this.value;
    });
  });
}

// ═══════════════════════════════════════════════════════
// CONTROLES DE MEMORIA Y QUANTUM
// ═══════════════════════════════════════════════════════
function inicializarControlesMemoria() {
  document.getElementById('btnQuantumMenos')?.addEventListener('click', () => {
    const inp = document.getElementById('inputQuantum');
    if (inp) inp.value = Math.max(1, parseInt(inp.value) - 1);
  });
  document.getElementById('btnQuantumMas')?.addEventListener('click', () => {
    const inp = document.getElementById('inputQuantum');
    if (inp) inp.value = parseInt(inp.value) + 1;
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
  // 1. Leer procesos
  procesos = leerTablaManual();
  if (!procesos.length) { mostrarToast('Ingresa al menos un proceso.', 'error'); return; }

  // 2. Leer parámetros
  memoriaTotal       = parseInt(document.getElementById('memoriaTotal')?.value)       || 400;
  memoriaSOReservado = parseInt(document.getElementById('memoriaSOReservado')?.value) || 0;
  const algoCPU      = document.querySelector('input[name="algoCPU"]:checked')?.value || 'fcfs';
  algoMemActual      = document.querySelector('input[name="algoMem"]:checked')?.value || 'ff';
  const quantum      = parseInt(document.getElementById('inputQuantum')?.value)       || 2;

  if (memoriaSOReservado >= memoriaTotal) {
    mostrarToast('El SO reservado debe ser menor que la memoria total.', 'error'); return;
  }

  // 3. Ejecutar planificador CPU
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

  // 4. Construir memoria inicial
  let tamaniosFijos = [];
  if (politicaParticion === 'fija') {
    tamaniosFijos = (document.getElementById('particionesFijas')?.value || '')
      .split(',').map(s => parseInt(s.trim())).filter(n => n > 0);
    const suma = tamaniosFijos.reduce((s,n) => s+n, 0);
    if (suma + memoriaSOReservado > memoriaTotal) {
      mostrarToast(`Particiones (${suma}KB) + SO (${memoriaSOReservado}KB) superan la memoria total.`, 'error'); return;
    }
  }
  const memoriaInicial = construirMemoriaInicial(memoriaTotal, memoriaSOReservado, politicaParticion, tamaniosFijos);

  // 5. Simular memoria sincronizada con el Gantt
  const { snapshotsMemoria, registroPasos, mapeoTiempos, ticksOrdenados } = simularMemoriaSincronizada(
    eventosGantt, procesosResultado, memoriaInicial, algoMemActual
  );
  estadosMemoria = snapshotsMemoria;
  pasosMem       = registroPasos;
  mapaPasosATiempos = mapeoTiempos;

  // 6. Generar estados de la cola de procesos por paso
  // Ahora se generan estados para cada tick importante (no solo para eventos del Gantt)
  estadosCola = generarEstadosCola(ticksOrdenados, procesosResultado, eventosGantt);

  // 7. Preparar animación
  // totalPasos = cantidad de snapshots generados (por ticks importantes + inicial + final)
  totalPasos    = estadosMemoria.length;
  pasoActual    = 0;
  memoriaActual = JSON.parse(JSON.stringify(memoriaInicial));

  limpiarLog();
  limpiarListaColas();
  reiniciarControlesAnimacion();

  // 8. Renderizar tablas y leyendas
  renderizarTablaCPU(procesosResultado);
  renderizarTablaMemoria(procesos, pasosMem);
  renderizarLeyendaGantt(procesos);

  // 9. Renderizar estado inicial del mapa de memoria
  renderizarMapaMemoria(memoriaActual, memoriaTotal, -1, false);
  renderizarLeyenda(memoriaActual);

  // 10. Actualizar pills del header
  const nombresCPU = { fcfs:'FCFS', sjf:'SJF', rr:`RR Q=${quantum}`, srt:'SRT' };
  const nombresMem = { ff:'First Fit', bf:'Best Fit', wf:'Worst Fit', buddy:'Buddy' };
  const pillCPU = document.getElementById('pillCPU');
  const pillMem = document.getElementById('pillMem');
  if (pillCPU) { pillCPU.textContent = `CPU: ${nombresCPU[algoCPU]}`; pillCPU.classList.add('activo'); }
  if (pillMem) { pillMem.textContent = `MEM: ${nombresMem[algoMemActual]}`; pillMem.classList.add('activo'); }

  // 11. Navegar a Gráfica — SIN scroll automático
  navegarA('grafica');

  // 12. Iniciar auto-play con delay breve para que el DOM se actualice
  setTimeout(() => iniciarAutoPlay(), 200);
  mostrarToast(`Simulación ${nombresCPU[algoCPU]} + ${nombresMem[algoMemActual]} lista — ${totalPasos} paso(s)`, 'exito');
}

// ═══════════════════════════════════════════════════════
// SINCRONIZACIÓN CPU ↔ MEMORIA
// ═══════════════════════════════════════════════════════

/**
 * Simula la asignación/liberación de memoria tick a tick.
 *
 * MODELO:
 * - Cada tick del tiempo es un paso de animación.
 * - En cada tick se asignan los procesos que acaban de llegar (llegada === tick).
 * - En cada tick se liberan los procesos que acaban de terminar (finReal === tick).
 * - Los snapshots reflejan el estado de memoria EN ESE TICK exacto.
 * - Al final se garantiza un snapshot con todo libre.
 */
function simularMemoriaSincronizada(eventosGantt, procesosRes, memoriaInicial, algoMem) {
  const snapshotsMemoria   = [];
  const registroPasos      = [];
  const procesosEnMemoria  = new Set();
  const procesosTerminados = new Set();

  // Tiempo total de la simulación
  const tiempoTotal = eventosGantt.length > 0
    ? Math.max(...eventosGantt.map(e => e.fin))
    : 0;

  // Fin real de cada proceso = tick en que termina su último segmento en el Gantt
  const finRealPorProceso = {};
  eventosGantt.forEach(ev => {
    if (ev.proceso === 'IDLE') return;
    if (!finRealPorProceso[ev.proceso] || ev.fin > finRealPorProceso[ev.proceso]) {
      finRealPorProceso[ev.proceso] = ev.fin;
    }
  });

  let estadoMem = JSON.parse(JSON.stringify(memoriaInicial));

  // ── Asigna memoria a un proceso ──
  function asignarMemoria(proceso) {
    if (procesosEnMemoria.has(proceso.id)) return;
    procesosEnMemoria.add(proceso.id);
    let resultado;
    const pasosBuddy = [];
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
    registroPasos.push({
      proceso:              proceso.id,
      tipo:                 resultado.exito ? 'ok' : 'error',
      exito:                resultado.exito,
      descripcion:          resultado.descripcion,
      inicio:               resultado.inicio,
      tamanioParticion:     resultado.tamanioParticion,
      fragmentacionInterna: resultado.fragmentacionInterna,
    });
  }

  // ── Libera memoria de un proceso ──
  function liberarMemoria(proceso) {
    if (procesosTerminados.has(proceso.id)) return;
    if (!procesosEnMemoria.has(proceso.id)) return;
    procesosTerminados.add(proceso.id);
    if (algoMem === 'buddy') {
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

  // ── Snapshot inicial t=0 antes de cualquier evento ──
  snapshotsMemoria.push(JSON.parse(JSON.stringify(estadoMem)));
  const mapeoTiempos = [0]; // Snapshot inicial en t=0

  // ── Recopilar todos los ticks importantes (llegadas y cambios de evento) ──
  const ticksImportantes = new Set();
  eventosGantt.forEach(ev => {
    ticksImportantes.add(ev.inicio);
    ticksImportantes.add(ev.fin);
  });
  procesosRes.forEach(p => {
    if (p.llegada > 0) ticksImportantes.add(p.llegada);
  });
  const ticksOrdenados = Array.from(ticksImportantes).sort((a, b) => a - b);

  // ── Recorrer cada tick importante ──
  // Genera snapshots cuando llega un nuevo proceso o cambia el evento del Gantt
  ticksOrdenados.forEach((tick) => {
    // Asignar procesos que llegan EN este tick
    procesosRes.forEach(p => {
      if (p.llegada === tick && !procesosEnMemoria.has(p.id)) {
        asignarMemoria(p);
      }
    });

    // Liberar procesos que terminan EN este tick
    procesosRes.forEach(p => {
      if (finRealPorProceso[p.id] === tick) {
        liberarMemoria(p);
      }
    });

    // Generar snapshot después de asignaciones/liberaciones
    snapshotsMemoria.push(JSON.parse(JSON.stringify(estadoMem)));
    mapeoTiempos.push(tick);
  });

  // ── Snapshot FINAL: después de liberar el último proceso ──
  // Garantiza que al terminar la animación el mapa quede todo libre
  snapshotsMemoria.push(JSON.parse(JSON.stringify(estadoMem)));
  mapeoTiempos.push(ticksOrdenados.length > 0 ? Math.max(...ticksOrdenados) : 0);

  return { snapshotsMemoria, registroPasos, mapeoTiempos, ticksOrdenados };
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
    limpiarLog();
    limpiarListaColas();
    if (estadosMemoria.length > 0) {
      memoriaActual = JSON.parse(JSON.stringify(estadosMemoria[0]));
      renderizarMapaMemoria(memoriaActual, memoriaTotal, -1, false);
      renderizarLeyenda(memoriaActual);
    }
    redibujarGantt();
    actualizarBarraProgreso(0);
    document.getElementById('contadorPaso').textContent = `Paso 0 / ${totalPasos}`;
    setTimeout(() => iniciarAutoPlay(), 200);
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
  if (btn) { btn.textContent = '⏸ Pausar'; btn.classList.add('activo'); }
  reproducirSiguientePaso();
}

function detenerAutoPlay() {
  estaReproduciendo = false;
  clearTimeout(timerAnimacion);
  const btn = document.getElementById('btnPlayPausa');
  if (btn) { btn.textContent = '▶ Auto'; btn.classList.remove('activo'); }
}

function reproducirSiguientePaso() {
  if (!estaReproduciendo) return;
  if (pasoActual >= totalPasos) {
    detenerAutoPlay();
    mostrarToast('Simulación completada ✓', 'exito');
    return;
  }
  mostrarPaso(pasoActual + 1);
  const nivel = parseInt(document.getElementById('sliderVelocidad')?.value) || 3;
  timerAnimacion = setTimeout(reproducirSiguientePaso, VELOCIDADES[nivel] || 700);
}

/**
 * Renderiza el estado de la simulación en el paso indicado.
 * NO hace scrollIntoView para no mover la página.
 *
 * @param {number} indice - Paso a mostrar (1-based)
 */
function mostrarPaso(indice) {
  if (indice < 0 || indice > totalPasos) return;
  const esAvance = indice > pasoActual;
  pasoActual = indice;

  // ── Calcular tiempo actual desde el mapeo de pasos ──
  const tiempoActual = mapaPasosATiempos[Math.max(0, pasoActual - 1)] || 0;

  // ── 1. Gantt ──
  // Pasar tiempo actual en lugar de pasoActual para que muestre eventos hasta ese tiempo
  dibujarGantt(eventosGantt, procesos, pasoActual, false, vistaGantt, tiempoActual);

  // ── 2. Mapa de memoria ──
  if (estadosMemoria[pasoActual]) {
    memoriaActual = JSON.parse(JSON.stringify(estadosMemoria[pasoActual]));
    renderizarMapaMemoria(memoriaActual, memoriaTotal, -1, true);
    renderizarLeyenda(memoriaActual);
    actualizarSelectorLiberar(memoriaActual, 'selectLiberarProceso');
    actualizarSelectorLiberar(memoriaActual, 'selectLiberarTablas');
  }

  // ── 3. Métricas ──
  // Usar tiempoActual en lugar de calcular desde eventosGantt
  const procVis = procesosResultado.filter(p => p.fin !== undefined && p.fin <= tiempoActual);
  if (procVis.length > 0) actualizarMetricasCPU(procVis, tiempoActual);
  const metMem = calcularMetricasMemoria(memoriaActual, memoriaTotal);
  actualizarMetricasMemoria(metMem, procesos.length);

  // ── 4. Log de pasos de memoria ──
  if (esAvance) {
    // Solo añadir el paso correspondiente a este índice
    const pasoMem = pasosMem[pasoActual - 1];
    if (pasoMem) agregarPasoLog(pasoMem, pasoActual);
  } else {
    // Retroceso: re-renderizar todo hasta aquí
    rerenderizarLog(pasosMem, pasoActual - 1);
  }

  // ── 5. Lista de colas ──
  const estadoCola = estadosCola[pasoActual - 1];
  if (estadoCola) {
    if (esAvance) {
      agregarItemCola(estadoCola, pasoActual);
    } else {
      rerenderizarColas(estadosCola, pasoActual - 1);
    }
  }

  // ── 6. Fragmentación ──
  renderizarAnalisisFragmentacion(memoriaActual, memoriaTotal);

  // ── 7. Barra de progreso y contador ──
  actualizarBarraProgreso((pasoActual / totalPasos) * 100);
  document.getElementById('contadorPaso').textContent = `Paso ${pasoActual} / ${totalPasos} (t=${tiempoActual})`;

  // ── SIN scrollIntoView — la página NO se mueve ──
}

function actualizarBarraProgreso(pct) {
  const barra = document.getElementById('barraProgresoFill');
  if (barra) barra.style.width = `${pct}%`;
}

// ═══════════════════════════════════════════════════════
// OPERACIONES DE MEMORIA (Liberar / Compactar)
// ═══════════════════════════════════════════════════════
function inicializarBotonesOperaciones() {
  document.getElementById('btnLiberar')?.addEventListener('click',       () => ejecutarLiberar('selectLiberarProceso'));
  document.getElementById('btnLiberarTablas')?.addEventListener('click', () => ejecutarLiberar('selectLiberarTablas'));
  document.getElementById('btnCompactar')?.addEventListener('click',       ejecutarCompactar);
  document.getElementById('btnCompactarTablas')?.addEventListener('click', ejecutarCompactar);
}

function ejecutarLiberar(idSel) {
  const idProceso = document.getElementById(idSel)?.value;
  if (!idProceso) { mostrarToast('Selecciona un proceso para liberar.', 'error'); return; }
  if (!memoriaActual.length) { mostrarToast('Ejecuta la simulación primero.', 'error'); return; }
  detenerAutoPlay();

  let res;
  if (algoMemActual === 'buddy') {
    const pasos = [];
    res = buddyLiberar(idProceso, memoriaActual, pasos);
    pasos.forEach((p,i) => { pasosMem.push({ tipo:p.tipo, descripcion:p.descripcion }); agregarPasoLog({ tipo:p.tipo, descripcion:p.descripcion }, pasosMem.length); });
  } else {
    res = liberarProceso(idProceso, memoriaActual);
    if (res.exito) { pasosMem.push({ tipo:'libre', descripcion:res.descripcion }); agregarPasoLog({ tipo:'libre', descripcion:res.descripcion }, pasosMem.length); }
  }
  if (!res.exito) { mostrarToast(res.descripcion, 'error'); return; }

  actualizarVistaMemoria();
  mostrarToast(`Proceso ${idProceso} liberado.`, 'info');
}

function ejecutarCompactar() {
  if (!memoriaActual.length) { mostrarToast('Ejecuta la simulación primero.', 'error'); return; }
  if (algoMemActual === 'buddy') { mostrarToast('Buddy System usa fusión de gemelos, no compactación.', 'info'); return; }
  const fragExt = memoriaActual.filter(b => b.tipo === 'libre').reduce((s,b) => s+b.tamanio, 0);
  if (fragExt === 0) { mostrarToast('No hay fragmentación externa que compactar.', 'info'); return; }
  detenerAutoPlay();

  const { nuevaMemoria, kbCompactados } = compactarMemoria(memoriaActual);
  memoriaActual = nuevaMemoria;
  const desc = `Compactación: ${kbCompactados}KB consolidados en un único bloque libre al final.`;
  pasosMem.push({ tipo:'compact', descripcion:desc });
  agregarPasoLog({ tipo:'compact', descripcion:desc }, pasosMem.length);

  actualizarVistaMemoria();
  mostrarToast(`Compactación completada. ${kbCompactados}KB consolidados.`, 'exito');
}

/** Actualiza todos los elementos visuales de memoria tras una operación manual. */
function actualizarVistaMemoria() {
  renderizarMapaMemoria(memoriaActual, memoriaTotal, -1, false);
  renderizarLeyenda(memoriaActual);
  actualizarSelectorLiberar(memoriaActual, 'selectLiberarProceso');
  actualizarSelectorLiberar(memoriaActual, 'selectLiberarTablas');
  const met = calcularMetricasMemoria(memoriaActual, memoriaTotal);
  actualizarMetricasMemoria(met, procesos.length);
  renderizarAnalisisFragmentacion(memoriaActual, memoriaTotal);
}

// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════
let timerToast = null;
function mostrarToast(msg, tipo = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = `visible ${tipo}`;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { el.className = ''; }, 3500);
}
