// mainDisco.js — Orquestador del Simulador de Disco
// Enlaza eventos del DOM, parsea entrada, ejecuta algoritmos y controla animación

import {
  construirDiscoInicial,
  simularAsignacionContigua,
  simularAsignacionEnlazada,
  simularAsignacionIndexada,
  simularAsignacionFAT,
  simularAsignacionIndexadaMultiNivel,
  simularAsignacionExtensiones,
  simularAsignacionBitmap,
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
  renderizarBitmapDisco,
  limpiarBitmapDisco,
  renderizarFlechasDisco,
  limpiarFlechasDisco,
} from '../ui/discoRenderer.js';

// ═══════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════
let metodoActual     = 'contigua';
let varianteContigua = 'manual'; // manual, ff, bf, wf
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
  contigua_manual:   ['Archivo', 'Inicio', 'Longitud'],
  contigua_dinamica: ['Archivo', 'Longitud (Bloques)'],
  enlazada_dinamica: ['Archivo', 'Longitud (Bloques)'],
  enlazada_manual:   ['Archivo', 'Punteros (ej: 2,5,9)'],
  indexada_dinamica: ['Archivo', 'Longitud (Bloques)'],
  indexada_manual:   ['Archivo', 'Bloque Índice', 'Datos (ej: 4,6)'],
  fat_dinamica:      ['Archivo', 'Longitud (Bloques)'],
  fat_manual:        ['Archivo', 'Punteros (ej: 1,8,15)'],
  'indexada-ml_dinamica': ['Archivo', 'Longitud (Bloques)'],
  'indexada-ml_manual':   ['Archivo', 'Raíz', 'Subíndices', 'Datos (ej: 2)'],
  extensiones_dinamica: ['Archivo', 'Longitud (Bloques)'],
  extensiones_manual:   ['Archivo', 'Exts (ini,lon; ini,lon)'],
  bitmap_dinamica:   ['Archivo', 'Longitud (Bloques)'],
  bitmap_manual:     ['Archivo', 'Longitud (Bloques)'], // Bitmap solo usa dinámica en realidad
};

const HINT_FORMATO = {
  contigua_manual: {
    titulo: 'Formato (Contigua - Manual)',
    lineas: ['archivo, inicio, longitud', 'AA, 1, 3', 'BB, 14, 2'],
    sub: 'archivo, inicio, longitud',
  },
  contigua_dinamica: {
    titulo: 'Formato (Contigua - FF / BF / WF)',
    lineas: ['archivo, longitud', 'AA, 3', 'BB, 2'],
    sub: 'archivo, longitud',
  },
  enlazada_dinamica: {
    titulo: 'Formato (Enlazada - Dinámica)',
    lineas: ['archivo, longitud', 'AA, 5', 'BB, 3'],
    sub: 'archivo, longitud (el sistema enlazará los bloques libres)',
  },
  enlazada_manual: {
    titulo: 'Formato (Enlazada - Manual)',
    lineas: ['archivo, bloque1, bloque2...', 'AA, 2, 5, 9'],
    sub: 'archivo, secuencia exacta de punteros',
  },
  indexada_dinamica: {
    titulo: 'Formato (Indexada - Dinámica)',
    lineas: ['archivo, longitud', 'AA, 5', 'BB, 2'],
    sub: 'archivo, longitud (el sistema creará el bloque índice automáticamente)',
  },
  indexada_manual: {
    titulo: 'Formato (Indexada - Manual)',
    lineas: ['archivo, indice, dato1, dato2...', 'AA, 10, 4, 6'],
    sub: 'archivo, bloque índice, secuencia exacta de datos',
  },
  fat_dinamica: {
    titulo: 'Formato (FAT - Dinámica)',
    lineas: ['archivo, longitud', 'AA, 4', 'BB, 6'],
    sub: 'archivo, longitud (el sistema asignará y actualizará la tabla FAT)',
  },
  fat_manual: {
    titulo: 'Formato (FAT - Manual)',
    lineas: ['archivo, bloque1, bloque2...', 'AA, 1, 8, 15'],
    sub: 'archivo, secuencia exacta de punteros en FAT',
  },
  'indexada-ml_dinamica': {
    titulo: 'Formato (Ind. Multi-nivel - Dinámica)',
    lineas: ['archivo, longitud', 'AA, 12', 'BB, 15'],
    sub: 'archivo, longitud (el sistema calculará y armará el árbol de índices)',
  },
  'indexada-ml_manual': {
    titulo: 'Formato (Ind. Multi-nivel - Manual)',
    lineas: ['archivo, raiz, sub1, sub2, |, d1, d2...', 'AA, 0, 1, 2, |, 5, 6, 7, 8'],
    sub: 'archivo, índice raíz, subíndices, separador |, bloques de datos',
  },
  extensiones_dinamica: {
    titulo: 'Formato (Extensiones - Dinámica)',
    lineas: ['archivo, longitud', 'AA, 10', 'BB, 7'],
    sub: 'archivo, longitud (el sistema agrupará el archivo en extensiones libres)',
  },
  extensiones_manual: {
    titulo: 'Formato (Extensiones - Manual)',
    lineas: ['archivo, ini1, lon1, ini2, lon2...', 'AA, 2, 3, 10, 2'],
    sub: 'archivo, pares de inicio y longitud (extensión 1, extensión 2...)',
  },
  bitmap_dinamica: {
    titulo: 'Formato (Bitmap - Automático)',
    lineas: ['archivo, longitud', 'AA, 8', 'BB, 5'],
    sub: 'archivo, longitud (el bitmap buscará los espacios libres)',
  },
  bitmap_manual: {
    titulo: 'Formato (Bitmap - Automático)',
    lineas: ['archivo, longitud', 'AA, 8', 'BB, 5'],
    sub: 'archivo, longitud (el bitmap buscará los espacios libres)',
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
  const cards = {
    contigua:       'cardContigua',
    enlazada:       'cardEnlazada',
    indexada:       'cardIndexada',
    fat:            'cardFAT',
    'indexada-ml':  'cardIndexadaML',
    extensiones:    'cardExtensiones',
    bitmap:         'cardBitmap',
  };
  document.querySelectorAll('input[name="algoDisco"]').forEach(r => {
    r.addEventListener('change', function () {
      Object.entries(cards).forEach(([v, id]) =>
        document.getElementById(id)?.classList.toggle('seleccionado', v === this.value));
      metodoActual = this.value;
      actualizarInterfazMetodo();

      // Deshabilitar/habilitar puntero (no aplica en contigua, FAT, extensiones ni bitmap)
      const grupoPuntero = document.getElementById('grupoPuntero');
      if (grupoPuntero) {
        const sinPuntero = ['contigua', 'fat', 'extensiones', 'bitmap'].includes(metodoActual);
        grupoPuntero.style.opacity = sinPuntero ? '.35' : '1';
        const inp = grupoPuntero.querySelector('input');
        if (inp) inp.disabled = sinPuntero;
      }
    });
  });

  // Variante / Modalidad Global
  document.querySelectorAll('#grupoModalidadDisco .btn-politica').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#grupoModalidadDisco .btn-politica').forEach(b => b.classList.remove('activo'));
      this.classList.add('activo');
      varianteContigua = this.dataset.variante;
      actualizarInterfazMetodo();
    });
  });
}

function actualizarInterfazMetodo() {
  const gCont = document.getElementById('grupoModalidadDisco');
  if (gCont) {
    if (metodoActual === 'bitmap') {
      gCont.style.display = 'none';
      varianteContigua = 'dinamica';
    } else {
      gCont.style.display = 'block';
      const btnDinamica = document.getElementById('btnVarDinamica');
      
      // Mostrar u ocultar botones exclusivos de Contigua
      if (metodoActual === 'contigua') {
        if (btnDinamica) btnDinamica.style.display = 'none';
        document.querySelectorAll('#grupoModalidadDisco .contigua-only').forEach(b => b.style.display = 'inline-block');
        
        // Si estaba en dinámica, forzar First Fit (ff)
        if (varianteContigua === 'dinamica') {
          varianteContigua = 'ff';
          document.querySelectorAll('#grupoModalidadDisco .btn-politica').forEach(b => b.classList.remove('activo'));
          document.getElementById('btnVarFF')?.classList.add('activo');
        }
      } else {
        if (btnDinamica) btnDinamica.style.display = 'inline-block';
        document.querySelectorAll('#grupoModalidadDisco .contigua-only').forEach(b => b.style.display = 'none');
        
        // Si estaba en una variante que no existe para el método actual, resetear
        if (['ff', 'bf', 'wf'].includes(varianteContigua)) {
          varianteContigua = 'dinamica';
          document.querySelectorAll('#grupoModalidadDisco .btn-politica').forEach(b => b.classList.remove('activo'));
          document.getElementById('btnVarDinamica')?.classList.add('activo');
        }
      }
    }
  }

  actualizarColumnasTabla();
  actualizarHintFormato();
  limpiarTablaEntradaDisco();
  agregarFilaDisco();
}

function actualizarColumnasTabla() {
  const thead = document.getElementById('theadEntradaDisco');
  if (!thead) return;
  let key = metodoActual + '_' + (['ff', 'bf', 'wf'].includes(varianteContigua) ? 'dinamica' : varianteContigua);
  if (key === 'bitmap_manual') key = 'bitmap_dinamica';
  const cols = COLUMNAS[key] || COLUMNAS.contigua_dinamica;
  thead.innerHTML = '<tr>' + cols.map(c => `<th scope="col">${c}</th>`).join('') + '<th scope="col"></th></tr>';
}

function actualizarHintFormato() {
  const hint = document.getElementById('hintFormatoDisco');
  const sub = document.getElementById('zaSubDisco');
  if (!hint) return;
  
  // Construir la clave usando el método actual y la modalidad (dinamica/manual)
  let key = `${metodoActual}_${varianteContigua}`;
  
  // Si por alguna razón la clave no existe en HINT_FORMATO, usamos contigua_manual por defecto
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

  let key = metodoActual + '_' + (['ff', 'bf', 'wf'].includes(varianteContigua) ? 'dinamica' : varianteContigua);
  if (key === 'bitmap_manual') key = 'bitmap_dinamica'; // fallback
  const cols = COLUMNAS[key] || COLUMNAS.contigua_dinamica;
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
          archivos.push({ nombre, inicio, longitud });
        } else {
          const longitud = parseInt(vals[1]);
          archivos.push({ nombre, longitud });
        }
        break;
      }
      case 'enlazada':
      case 'fat': {
        const nombre = vals[0];
        if (varianteContigua === 'manual') {
          const secuencia = vals[1] ? vals[1].split(/[,;]/).map(s => parseInt(s.trim())) : [];
          archivos.push({ nombre, secuencia, longitud: secuencia.length });
        } else {
          const longitud = parseInt(vals[1]);
          archivos.push({ nombre, longitud });
        }
        break;
      }
      case 'indexada': {
        const nombre = vals[0];
        if (varianteContigua === 'manual') {
          const indice = parseInt(vals[1]);
          const datos = vals[2] ? vals[2].split(/[,;]/).map(s => parseInt(s.trim())) : [];
          archivos.push({ nombre, indice, datos, longitud: datos.length });
        } else {
          const longitud = parseInt(vals[1]);
          archivos.push({ nombre, longitud });
        }
        break;
      }
      case 'indexada-ml': {
        const nombre = vals[0];
        if (varianteContigua === 'manual') {
          const raiz = parseInt(vals[1]);
          const subindices = vals[2] ? vals[2].split(/[,;]/).map(s => parseInt(s.trim())) : [];
          const datos = vals[3] ? vals[3].split(/[,;]/).map(s => parseInt(s.trim())) : [];
          archivos.push({ nombre, raiz, subindices, datos, longitud: datos.length });
        } else {
          const longitud = parseInt(vals[1]);
          archivos.push({ nombre, longitud });
        }
        break;
      }
      case 'extensiones': {
        const nombre = vals[0];
        if (varianteContigua === 'manual') {
          const extStrs = vals[1] ? vals[1].split(/[,;]/).map(s => parseInt(s.trim())) : [];
          const extensiones = [];
          let totalLen = 0;
          for (let i = 0; i < extStrs.length; i += 2) {
             if (i + 1 < extStrs.length) {
               extensiones.push({ inicio: extStrs[i], longitud: extStrs[i+1] });
               if (!isNaN(extStrs[i+1])) totalLen += extStrs[i+1];
             }
          }
          archivos.push({ nombre, extensiones, longitud: totalLen });
        } else {
          const longitud = parseInt(vals[1]);
          archivos.push({ nombre, longitud });
        }
        break;
      }
      case 'bitmap': {
        const nombre = vals[0];
        const longitud = parseInt(vals[1]);
        archivos.push({ nombre, numBloques: longitud });
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

      // ── VALIDACIÓN ESTRICTA DE FORMATO SEGÚN MÉTODO ──
      let formatoInvalido = false;
      let errorMsg = '';
      for (let i = 0; i < lineas.length; i++) {
        const partes = lineas[i].split(/[,;]/).map(s => s.trim()).filter(s => s !== '');
        if (partes.length < 2) { formatoInvalido = true; errorMsg = `Línea ${i+1}: Faltan parámetros.`; break; }
        
        if (metodoActual === 'contigua' && varianteContigua === 'manual') {
          if (partes.length < 3) {
            formatoInvalido = true; errorMsg = `Línea ${i+1}: Contigua Manual exige al menos 3 valores (Nombre, Inicio, Longitud).`; break;
          }
          if (isNaN(parseInt(partes[1])) || isNaN(parseInt(partes[2]))) {
            formatoInvalido = true; errorMsg = `Línea ${i+1}: Inicio y Longitud deben ser numéricos.`; break;
          }
        } else if (varianteContigua === 'manual') {
          // Manual general: solo aseguramos que haya al menos nombre y algo más
          if (partes.length < 2) {
            formatoInvalido = true; errorMsg = `Línea ${i+1}: Faltan parámetros para modo manual.`; break;
          }
        } else {
          // Para métodos dinámicos, exigimos al menos 2 parámetros
          if (partes.length < 2) {
            formatoInvalido = true; errorMsg = `Línea ${i+1}: Se exigen al menos 2 valores (Nombre, Longitud).`; break;
          }
        }
      }

      if (formatoInvalido) {
        animarZona('error-anim');
        mostrarToast('Formato incorrecto: ' + errorMsg, 'error');
        return;
      }

      limpiarTablaEntradaDisco();

      lineas.forEach(linea => {
        const partes = linea.split(/[,;]/).map(s => s.trim()).filter(s => s !== '');
        if (!partes[0]) return;

        if (metodoActual === 'contigua' && varianteContigua === 'manual') {
          agregarFilaDisco([partes[0], partes[1], partes[2]]);
        } else if (varianteContigua === 'manual') {
          // Llenamos las columnas exactamente con lo que viniera en el TXT
          switch (metodoActual) {
            case 'indexada':
              agregarFilaDisco([partes[0], partes[1], partes.slice(2).join(', ')]);
              break;
            case 'indexada-ml': {
              const str = linea.substring(linea.indexOf(','));
              const pipeParts = str.split('|');
              const idxParts = pipeParts[0].split(/[,;]/).map(s=>s.trim()).filter(s=>s!=='');
              agregarFilaDisco([
                partes[0], 
                idxParts[0] || '', 
                idxParts.slice(1).join(', '), 
                (pipeParts[1] || '').trim()
              ]);
              break;
            }
            default:
              agregarFilaDisco([partes[0], partes.slice(1).join(', ')]);
          }
        } else {
          let longitud = 0;
          if (partes.length === 2) {
            // Formato nuevo: Nombre, Longitud
            longitud = parseInt(partes[1]);
          } else {
            // Formato viejo (legacy soporte)
            switch (metodoActual) {
              case 'enlazada':
              case 'fat':
                longitud = partes.length - 1; // cantidad de punteros = longitud
                break;
              case 'indexada':
                longitud = partes.length - 2; // restamos nombre y bloque índice, queda longitud de datos
                break;
              case 'indexada-ml': {
                // contar cuántos elementos hay después del '|'
                const str = linea.substring(linea.indexOf(','));
                const pipeParts = str.split('|');
                if (pipeParts.length > 1) {
                   longitud = pipeParts[1].split(/[,;]/).map(s => s.trim()).filter(s => s !== '').length;
                } else {
                   longitud = partes.length - 2;
                }
                break;
              }
              case 'extensiones': {
                longitud = 0;
                for (let k = 2; k < partes.length; k += 2) {
                  const len = parseInt(partes[k]);
                  if (!isNaN(len)) longitud += len;
                }
                break;
              }
              default:
                longitud = parseInt(partes[1]);
            }
          }
          if (isNaN(longitud) || longitud <= 0) longitud = 1;
          agregarFilaDisco([partes[0], longitud]);
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

  const totalBloques = Math.min(1024, Math.max(8, parseInt(document.getElementById('discoBloques')?.value) || 120));
  const tamanioBloque   = Math.max(32, parseInt(document.getElementById('discoTamanioBloque')?.value) || 512);
  const tamanioPuntero  = Math.min(tamanioBloque - 1, Math.max(1, parseInt(document.getElementById('discoTamanioPuntero')?.value) || 4));

  let resultado;
  const nombreMetodo = { contigua: 'Contigua', enlazada: 'Enlazada', indexada: 'Indexada', fat: 'FAT', 'indexada-ml': 'Indexada Multi-Nivel' };

  try {
    switch (metodoActual) {
      case 'contigua':
        resultado = simularAsignacionContigua(archivos, totalBloques, varianteContigua);
        break;
      case 'enlazada':
        resultado = simularAsignacionEnlazada(archivos, totalBloques, tamanioPuntero, tamanioBloque, varianteContigua);
        break;
      case 'indexada':
        resultado = simularAsignacionIndexada(archivos, totalBloques, tamanioPuntero, tamanioBloque, varianteContigua);
        break;
      case 'fat':
        resultado = simularAsignacionFAT(archivos, totalBloques, tamanioBloque, varianteContigua);
        break;
      case 'indexada-ml':
        resultado = simularAsignacionIndexadaMultiNivel(archivos, totalBloques, tamanioPuntero, tamanioBloque, varianteContigua);
        break;
      case 'extensiones':
        resultado = simularAsignacionExtensiones(archivos, totalBloques, varianteContigua);
        break;
      case 'bitmap':
        resultado = simularAsignacionBitmap(archivos, totalBloques);
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

  // Navegar PRIMERO a la página de simulación (antes de manipular DOM de esa página)
  if (window.navegarA) window.navegarA('graficaDisco');

  // Pill en header
  const pillDisco = document.getElementById('pillDisco');
  if (pillDisco) {
    pillDisco.classList.remove('oculto');
    pillDisco.classList.add('activo');
    const varLabel = metodoActual === 'contigua' ? ` (${varianteContigua.toUpperCase()})` : '';
    pillDisco.innerHTML = `<span class="pill-pulse" style="background:#7c3aed"></span>DISCO: ${nombreMetodo[metodoActual] || metodoActual}${varLabel}`;
  }

  // Subtítulo
  const sub = document.getElementById('subtituloDisco');
  if (sub) sub.textContent = `${nombreMetodo[metodoActual] || metodoActual} · ${totalBloques} bloques`;

  // Limpiar y renderizar estado inicial
  limpiarLogDisco();
  limpiarGrillaDisco();
  limpiarBitmapDisco();
  limpiarFlechasDisco();
  reiniciarControlesAnimacionDisco();

  renderizarGrillaDisco(snapshots[0], totalBloques, metodoActual, 0);
  
  if (metodoActual === 'bitmap') {
    document.getElementById('grillaDisco')?.setAttribute('style', 'display:none');
    document.getElementById('panelBitmapWrapper')?.setAttribute('style', 'display:block');
    renderizarBitmapDisco(snapshots[0], totalBloques);
  } else {
    document.getElementById('grillaDisco')?.setAttribute('style', 'display:flex');
    document.getElementById('panelBitmapWrapper')?.setAttribute('style', 'display:none');
  }

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

  // Iniciar autoplay
  timerAnimacion = setTimeout(() => iniciarAutoPlayDisco(), 300);
  mostrarToast(`Simulación ${nombreMetodo[metodoActual] || metodoActual} lista — ${totalPasos} paso(s)`, 'exito');
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
      if (metodoActual === 'bitmap') renderizarBitmapDisco(snapshots[0], totalBloques);
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
  const contEl = document.getElementById('contadorPasoDisco');
  if (contEl) contEl.textContent = `Paso 0 / ${totalPasos}`;
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
    if (metodoActual === 'bitmap') {
      renderizarBitmapDisco(snapshot, totalBloques);
    } else {
      // Obtener el bloque activo del paso actual para dibujar solo su flecha
      const pasoIdx = pasoActual > 0 ? pasoActual - 1 : 0;
      const paso = pasos[pasoIdx];
      // Si estamos en el paso final, ocultamos las flechas
      const bloqueActivo = (pasoActual === totalPasos) ? undefined : paso?.bloquesAfectados?.[0];
      renderizarFlechasDisco(snapshot, metodoActual, bloqueActivo);
    }
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
    agregarPasoLogDisco(pasos[pasoActual - 1], pasoActual, metadatos);
  } else if (!esAvance) {
    // Re-renderizar log hasta paso actual
    limpiarLogDisco();
    for (let i = 0; i < pasoActual && i < pasos.length; i++) {
      agregarPasoLogDisco(pasos[i], i + 1, metadatos);
    }
  }

  actualizarBarraProgresoDisco(totalPasos > 0 ? (pasoActual / totalPasos) * 100 : 0);
  const contador = document.getElementById('contadorPasoDisco');
  if (contador) contador.textContent = `Paso ${pasoActual} / ${totalPasos}`;
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
