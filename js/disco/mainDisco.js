// mainDisco.js — Orquestador del Simulador de Disco
// Enlaza eventos del DOM, parsea entrada, ejecuta algoritmos y controla animación

import {
  construirDiscoInicial,
  simularAsignacionContigua,
  simularAsignacionEnlazada,
  simularAsignacionIndexada,
  calcularMetricasDisco,
  PALETA_ARCHIVOS,
} from './algoritmos.js';

import {
  renderizarGrillaDisco,
  renderizarLeyendaDisco,
  actualizarMetricasDisco,
  renderizarTablaMetadatos,
  agregarPasoLogDisco,
  limpiarLogDisco,
  limpiarGrillaDisco,
} from '../ui/discoRenderer.js';

// ═══════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════
let metodoActual     = 'contigua';
let varianteContigua = 'manual'; // manual, ff, bf
let snapshots       = [];
let pasos           = [];
let metadatos       = [];
let metricasGlobal  = null;
let pasoActual      = 0;
let totalPasos      = 0;
let estaReproduciendo = false;
let timerAnimacion  = null;
let contadorFilasDisco = 0;

const VELOCIDADES   = { 1: 2000, 2: 1200, 3: 700, 4: 350, 5: 60 };
const NOMBRES_VEL   = { 1: 'Muy lento', 2: 'Lento', 3: 'Normal', 4: 'Rápido', 5: 'Máximo' };

// ═══════════════════════════════════════════════════════
// CONFIGURACIONES DE COLUMNAS POR MÉTODO
// ═══════════════════════════════════════════════════════
const COLUMNAS = {
  contigua_manual: ['Archivo', 'Inicio', 'Longitud'],
  contigua_dinamica: ['Archivo', 'Longitud'],
  enlazada:  ['Archivo', 'Secuencia de Bloques'],
  indexada:  ['Archivo', 'Bloque Índice', 'Bloques de Datos'],
};

const HINT_FORMATO = {
  contigua_manual: {
    titulo: 'Formato (Contigua - Manual)',
    lineas: ['archivo, inicio, longitud', 'AA, 1, 3', 'BB, 14, 2'],
    sub: 'archivo, inicio, longitud',
  },
  contigua_dinamica: {
    titulo: 'Formato (Contigua - FF/BF)',
    lineas: ['archivo, longitud', 'AA, 3', 'BB, 2'],
    sub: 'archivo, longitud',
  },
  enlazada: {
    titulo: 'Formato (Enlazada)',
    lineas: ['archivo, bloque1, bloque2, ...', 'AA, 6, 14, 26, 119, 8'],
    sub: 'archivo, secuencia de bloques',
  },
  indexada: {
    titulo: 'Formato (Indexada)',
    lineas: ['archivo, bloque_indice, dato1, dato2, ...', 'AA, 10, 1, 7, 3'],
    sub: 'archivo, bloque_índice, bloques_datos',
  },
};

// ═══════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════
export function inicializarSimuladorDisco() {
  inicializarSelectorMetodo();
  inicializarTablaEntradaDisco();
  inicializarArchivoArrastreDisco();
  inicializarControlesAnimacionDisco();
  actualizarInterfazMetodo();
}

// ═══════════════════════════════════════════════════════
// SELECTOR DE MÉTODO
// ═══════════════════════════════════════════════════════
function inicializarSelectorMetodo() {
  const cards = { contigua: 'cardContigua', enlazada: 'cardEnlazada', indexada: 'cardIndexada' };
  document.querySelectorAll('input[name="algoDisco"]').forEach(r => {
    r.addEventListener('change', function () {
      Object.entries(cards).forEach(([v, id]) =>
        document.getElementById(id)?.classList.toggle('seleccionado', v === this.value));
      metodoActual = this.value;
      actualizarInterfazMetodo();

      // Deshabilitar/habilitar puntero
      const grupoPuntero = document.getElementById('grupoPuntero');
      if (grupoPuntero) {
        grupoPuntero.style.opacity = metodoActual === 'contigua' ? '.35' : '1';
        const inp = grupoPuntero.querySelector('input');
        if (inp) inp.disabled = metodoActual === 'contigua';
      }
    });
  });

  // Variante Contigua
  document.querySelectorAll('#grupoVarianteContigua .btn-politica').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#grupoVarianteContigua .btn-politica').forEach(b => b.classList.remove('activo'));
      this.classList.add('activo');
      varianteContigua = this.dataset.variante;
      actualizarInterfazMetodo();
    });
  });
}

function actualizarInterfazMetodo() {
  // Mostrar u ocultar selector de variante contigua
  const grupoVariante = document.getElementById('grupoVarianteContigua');
  if (grupoVariante) {
    grupoVariante.style.display = metodoActual === 'contigua' ? 'block' : 'none';
  }
  // Actualizar columnas de la tabla
  actualizarColumnasTabla();
  // Actualizar hint de formato
  actualizarHintFormato();
  // Limpiar tabla y agregar fila por defecto
  limpiarTablaEntradaDisco();
  agregarFilaDisco();
}

function actualizarColumnasTabla() {
  const thead = document.getElementById('theadEntradaDisco');
  if (!thead) return;
  let key = metodoActual;
  if (metodoActual === 'contigua') {
    key = varianteContigua === 'manual' ? 'contigua_manual' : 'contigua_dinamica';
  }
  const cols = COLUMNAS[key] || COLUMNAS.contigua_manual;
  thead.innerHTML = '<tr>' + cols.map(c => `<th scope="col">${c}</th>`).join('') + '<th scope="col"></th></tr>';
}

function actualizarHintFormato() {
  const hint = document.getElementById('hintFormatoDisco');
  const sub = document.getElementById('zaSubDisco');
  if (!hint) return;
  let key = metodoActual;
  if (metodoActual === 'contigua') {
    key = varianteContigua === 'manual' ? 'contigua_manual' : 'contigua_dinamica';
  }
  const cfg = HINT_FORMATO[key] || HINT_FORMATO.contigua_manual;
  hint.innerHTML = `<div class="hint-titulo">${cfg.titulo}</div>` +
    cfg.lineas.map(l => `<code>${l}</code>`).join('');
  if (sub) sub.textContent = cfg.sub;
}

// ═══════════════════════════════════════════════════════
// TABLA DE ENTRADA DINÁMICA
// ═══════════════════════════════════════════════════════
function inicializarTablaEntradaDisco() {
  document.getElementById('btnAgregarFilaDisco')?.addEventListener('click', () => {
    agregarFilaDisco();
  });
}

function limpiarTablaEntradaDisco() {
  const cuerpo = document.getElementById('cuerpoTablaEntradaDisco');
  if (cuerpo) cuerpo.innerHTML = '';
  contadorFilasDisco = 0;
}

function agregarFilaDisco(datos = null) {
  const cuerpo = document.getElementById('cuerpoTablaEntradaDisco');
  if (!cuerpo) return;
  const tr = document.createElement('tr');
  tr.style.animation = 'entradaFila .28s ease both';

  let key = metodoActual;
  if (metodoActual === 'contigua') {
    key = varianteContigua === 'manual' ? 'contigua_manual' : 'contigua_dinamica';
  }
  const cols = COLUMNAS[key] || COLUMNAS.contigua_manual;
  const valores = datos || [];

  cols.forEach((col, i) => {
    const td = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'celda-inp';
    inp.value = valores[i] || '';
    inp.placeholder = col;
    inp.setAttribute('aria-label', col);
    td.appendChild(inp);
    tr.appendChild(td);
  });

  // Botón eliminar
  const tdDel = document.createElement('td');
  const btnDel = document.createElement('button');
  btnDel.className = 'btn-eliminar-fila';
  btnDel.innerHTML = '×';
  btnDel.title = 'Eliminar fila';
  btnDel.addEventListener('click', () => {
    tr.remove();
    contadorFilasDisco--;
  });
  tdDel.appendChild(btnDel);
  tr.appendChild(tdDel);

  cuerpo.appendChild(tr);
  contadorFilasDisco++;
  tr.querySelector('.celda-inp')?.focus();
}

function leerTablaEntradaDisco() {
  const filas = document.querySelectorAll('#cuerpoTablaEntradaDisco tr');
  const archivos = [];

  filas.forEach(fila => {
    const celdas = fila.querySelectorAll('.celda-inp');
    const vals = Array.from(celdas).map(c => c.value.trim());

    if (!vals[0]) return; // sin nombre

    switch (metodoActual) {
      case 'contigua': {
        const nombre = vals[0];
        if (varianteContigua === 'manual') {
          const inicio = parseInt(vals[1]);
          const longitud = parseInt(vals[2]);
          if (!isNaN(inicio) && !isNaN(longitud) && longitud > 0) {
            archivos.push({ nombre, inicio, longitud });
          }
        } else {
          const longitud = parseInt(vals[1]);
          if (!isNaN(longitud) && longitud > 0) {
            archivos.push({ nombre, longitud }); // inicio se calculará dinámicamente
          }
        }
        break;
      }
      case 'enlazada': {
        const nombre = vals[0];
        const secStr = vals[1] || '';
        const secuencia = secStr.split(/[,;\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (secuencia.length > 0) {
          archivos.push({ nombre, secuencia });
        }
        break;
      }
      case 'indexada': {
        const nombre = vals[0];
        const bloqueIndice = parseInt(vals[1]);
        const datosStr = vals[2] || '';
        const bloquesDatos = datosStr.split(/[,;\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (!isNaN(bloqueIndice)) {
          archivos.push({ nombre, bloqueIndice, bloquesDatos });
        }
        break;
      }
    }
  });

  return archivos;
}

// ═══════════════════════════════════════════════════════
// ARRASTRE DE ARCHIVO
// ═══════════════════════════════════════════════════════
function inicializarArchivoArrastreDisco() {
  const zona = document.getElementById('zonaArrastreDisco');
  const input = document.getElementById('inputArchivoDisco');
  if (!zona || !input) return;

  input.addEventListener('change', e => {
    if (e.target.files?.length > 0) manejarArchivoDisco(e.target.files[0]);
  });

  zona.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); zona.classList.add('arrastrando'); });
  zona.addEventListener('dragleave', e => { e.preventDefault(); e.stopPropagation(); zona.classList.remove('arrastrando'); });
  zona.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation(); zona.classList.remove('arrastrando');
    if (e.dataTransfer?.files?.length > 0) manejarArchivoDisco(e.dataTransfer.files[0]);
  });
}

function manejarArchivoDisco(archivo) {
  if (!archivo) return;
  const zona = document.getElementById('zonaArrastreDisco');
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
    mostrarToast('Solo se permiten archivos .csv o .txt', 'error');
    return;
  }

  const lector = new FileReader();
  lector.onerror = () => { animarZona('error-anim'); mostrarToast('Error al leer el archivo', 'error'); };
  lector.onload = e => {
    try {
      const contenido = e.target.result;
      if (!contenido?.trim()) { animarZona('error-anim'); mostrarToast('El archivo está vacío', 'error'); return; }

      const lineas = contenido.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && !l.startsWith('//'));

      if (!lineas.length) { animarZona('error-anim'); mostrarToast('No se encontraron datos válidos', 'error'); return; }

      limpiarTablaEntradaDisco();

      lineas.forEach(linea => {
        const partes = linea.split(/[,;]/).map(s => s.trim());
        if (!partes[0]) return;

        switch (metodoActual) {
          case 'contigua':
            if (varianteContigua === 'manual') {
              agregarFilaDisco([partes[0], partes[1] || '', partes[2] || '']);
            } else {
              agregarFilaDisco([partes[0], partes[1] || '']);
            }
            break;
          case 'enlazada':
            // Todo después del nombre es la secuencia
            agregarFilaDisco([partes[0], partes.slice(1).join(', ')]);
            break;
          case 'indexada':
            // Nombre, bloque índice, resto son datos
            agregarFilaDisco([partes[0], partes[1] || '', partes.slice(2).join(', ')]);
            break;
        }
      });

      const nombreEl = document.getElementById('nombreArchivoDisco');
      if (nombreEl) {
        const span = document.createElement('span');
        span.textContent = archivo.name;
        nombreEl.innerHTML = `📂 ${span.innerHTML}  (${lineas.length} archivo(s))`;
      }
      animarZona('exito');
      mostrarToast(`✓ ${lineas.length} archivo(s) cargados`, 'exito');
    } catch (err) {
      animarZona('error-anim');
      mostrarToast(`Error al procesar: ${err.message}`, 'error');
    }
  };
  lector.readAsText(archivo);
}

// ═══════════════════════════════════════════════════════
// EJECUCIÓN DE LA SIMULACIÓN
// ═══════════════════════════════════════════════════════
export function ejecutarSimulacionDisco() {
  const archivos = leerTablaEntradaDisco();
  if (!archivos.length) {
    mostrarToast('Ingresa al menos un archivo para simular.', 'error');
    return;
  }

  const totalBloques    = Math.max(8, parseInt(document.getElementById('discoBloques')?.value) || 120);
  const tamanioBloque   = Math.max(32, parseInt(document.getElementById('discoTamanioBloque')?.value) || 512);
  const tamanioPuntero  = Math.max(1, parseInt(document.getElementById('discoTamanioPuntero')?.value) || 4);

  let resultado;
  const nombreMetodo = { contigua: 'Contigua', enlazada: 'Enlazada', indexada: 'Indexada' };

  try {
    switch (metodoActual) {
      case 'contigua':
        resultado = simularAsignacionContigua(archivos, totalBloques, varianteContigua);
        break;
      case 'enlazada':
        resultado = simularAsignacionEnlazada(archivos, totalBloques, tamanioPuntero, tamanioBloque);
        break;
      case 'indexada':
        resultado = simularAsignacionIndexada(archivos, totalBloques, tamanioPuntero, tamanioBloque);
        break;
      default:
        resultado = simularAsignacionContigua(archivos, totalBloques);
    }
  } catch (err) {
    mostrarToast(`Error en simulación: ${err.message}`, 'error');
    return;
  }

  snapshots      = resultado.snapshots;
  pasos          = resultado.pasos;
  metadatos      = resultado.metadatos;
  metricasGlobal = resultado.metricas;
  totalPasos     = snapshots.length - 1;
  pasoActual     = 0;

  // Mostrar contenido, ocultar empty state
  document.getElementById('discoEmpty')?.classList.add('oculto');
  document.getElementById('discoContenido')?.classList.remove('oculto');

  // Pill en header
  const pillDisco = document.getElementById('pillDisco');
  if (pillDisco) {
    pillDisco.classList.remove('oculto');
    pillDisco.classList.add('activo');
    pillDisco.innerHTML = `<span class="pill-pulse" style="background:#7c3aed"></span>DISCO: ${nombreMetodo[metodoActual]}`;
  }

  // Subtítulo
  const sub = document.getElementById('subtituloDisco');
  if (sub) sub.textContent = `${nombreMetodo[metodoActual]} · ${totalBloques} bloques`;

  // Limpiar y renderizar estado inicial
  limpiarLogDisco();
  limpiarGrillaDisco();
  reiniciarControlesAnimacionDisco();

  renderizarGrillaDisco(snapshots[0], totalBloques, metodoActual, 0);

  // Leyenda
  const archivosUnicos = [];
  const vistos = new Set();
  snapshots[snapshots.length - 1].forEach(b => {
    if (b.archivo && !vistos.has(b.archivo)) {
      vistos.add(b.archivo);
      archivosUnicos.push({ nombre: b.archivo, color: b.color });
    }
  });
  renderizarLeyendaDisco(archivosUnicos);

  // Métricas
  const metInicial = calcularMetricasDisco(snapshots[0], totalBloques);
  actualizarMetricasDisco({ ...metInicial, opsLectura: 0, opsEscritura: 0 });

  // Tabla de metadatos
  renderizarTablaMetadatos(metadatos, metodoActual);

  // Navegar a la pestaña de simulación
  if (window.navegarA) window.navegarA('graficaDisco');

  // Iniciar autoplay
  timerAnimacion = setTimeout(() => iniciarAutoPlayDisco(), 300);
  mostrarToast(`Simulación ${nombreMetodo[metodoActual]} lista — ${totalPasos} paso(s)`, 'exito');
}

// ═══════════════════════════════════════════════════════
// CONTROLES DE ANIMACIÓN
// ═══════════════════════════════════════════════════════
function inicializarControlesAnimacionDisco() {
  document.getElementById('btnPlayPausaDisco')?.addEventListener('click', () => {
    if (estaReproduciendo) detenerAutoPlayDisco();
    else iniciarAutoPlayDisco();
  });
  document.getElementById('btnPasoSiguienteDisco')?.addEventListener('click', () => {
    detenerAutoPlayDisco();
    mostrarPasoDisco(pasoActual + 1);
  });
  document.getElementById('btnPasoAnteriorDisco')?.addEventListener('click', () => {
    detenerAutoPlayDisco();
    if (pasoActual > 0) mostrarPasoDisco(pasoActual - 1);
  });
  document.getElementById('btnReiniciarDisco')?.addEventListener('click', () => {
    detenerAutoPlayDisco();
    pasoActual = 0;
    limpiarLogDisco();
    if (snapshots.length > 0) {
      const totalBloques = snapshots[0].length;
      renderizarGrillaDisco(snapshots[0], totalBloques, metodoActual, 0);
      const metInicial = calcularMetricasDisco(snapshots[0], totalBloques);
      actualizarMetricasDisco({ ...metInicial, opsLectura: 0, opsEscritura: 0 });
    }
    actualizarBarraProgresoDisco(0);
    document.getElementById('contadorPasoDisco').textContent = `Paso 0 / ${totalPasos}`;
    setTimeout(() => iniciarAutoPlayDisco(), 200);
  });
  document.getElementById('sliderVelocidadDisco')?.addEventListener('input', function () {
    document.getElementById('textoVelocidadDisco').textContent = NOMBRES_VEL[this.value];
    if (estaReproduciendo) { clearTimeout(timerAnimacion); reproducirSiguientePasoDisco(); }
  });
}

function reiniciarControlesAnimacionDisco() {
  detenerAutoPlayDisco();
  pasoActual = 0;
  actualizarBarraProgresoDisco(0);
  document.getElementById('contadorPasoDisco').textContent = `Paso 0 / ${totalPasos}`;
}

function iniciarAutoPlayDisco() {
  if (estaReproduciendo || totalPasos === 0) return;
  estaReproduciendo = true;
  const btn = document.getElementById('btnPlayPausaDisco');
  if (btn) { btn.textContent = '⏸ Pausar'; btn.classList.add('activo'); }
  reproducirSiguientePasoDisco();
}

function detenerAutoPlayDisco() {
  estaReproduciendo = false;
  clearTimeout(timerAnimacion);
  const btn = document.getElementById('btnPlayPausaDisco');
  if (btn) { btn.textContent = '▶ Auto'; btn.classList.remove('activo'); }
}

function reproducirSiguientePasoDisco() {
  if (!estaReproduciendo) return;
  if (pasoActual >= totalPasos) {
    detenerAutoPlayDisco();
    mostrarToast('Simulación de disco completada ✓', 'exito');
    return;
  }
  mostrarPasoDisco(pasoActual + 1);
  const nivel = parseInt(document.getElementById('sliderVelocidadDisco')?.value) || 3;
  timerAnimacion = setTimeout(reproducirSiguientePasoDisco, VELOCIDADES[nivel] || 700);
}

function mostrarPasoDisco(indice) {
  if (indice < 0 || indice > totalPasos) return;
  const esAvance = indice > pasoActual;
  pasoActual = indice;

  const totalBloques = snapshots[0].length;
  const snapshot = snapshots[pasoActual];
  if (snapshot) {
    renderizarGrillaDisco(snapshot, totalBloques, metodoActual, pasoActual);
  }

  // Métricas
  const met = calcularMetricasDisco(snapshot, totalBloques);
  // Acumular E/S hasta este paso
  let lecturas = 0, escrituras = 0;
  for (let i = 0; i < pasoActual && i < pasos.length; i++) {
    lecturas += pasos[i].lecturas || 0;
    escrituras += pasos[i].escrituras || 0;
  }
  actualizarMetricasDisco({ ...met, opsLectura: lecturas, opsEscritura: escrituras });

  // Log de pasos
  if (esAvance && pasoActual > 0 && pasos[pasoActual - 1]) {
    agregarPasoLogDisco(pasos[pasoActual - 1], pasoActual);
  } else if (!esAvance) {
    // Re-renderizar log hasta paso actual
    limpiarLogDisco();
    for (let i = 0; i < pasoActual && i < pasos.length; i++) {
      agregarPasoLogDisco(pasos[i], i + 1);
    }
  }

  actualizarBarraProgresoDisco(totalPasos > 0 ? (pasoActual / totalPasos) * 100 : 0);
  document.getElementById('contadorPasoDisco').textContent =
    `Paso ${pasoActual} / ${totalPasos}`;
}

function actualizarBarraProgresoDisco(pct) {
  const barra = document.getElementById('barraProgresoFillDisco');
  if (barra) barra.style.width = `${pct}%`;
}

// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════
function mostrarToast(msg, tipo = '') {
  if (window.crearToastGlobo) window.crearToastGlobo(msg, tipo || 'info');
}
