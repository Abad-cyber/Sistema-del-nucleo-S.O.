// ui/discoRenderer.js — Renderizador del simulador de disco
// Maneja toda la representación DOM de la grilla de bloques,
// leyenda de archivos, métricas, tabla de metadatos y log de pasos.
// NO importa nada de otros módulos — es un módulo de renderizado puro.

// ═══════════════════════════════════════════════════════
// UTILIDADES INTERNAS
// ═══════════════════════════════════════════════════════

/** Escapa caracteres HTML para evitar inyecciones XSS */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Umbral de animación — bloques más allá de este índice no animan */
const ANIM_THRESHOLD = 80;

/** Estado previo de la grilla para detectar cambios entre renders */
let _snapshotAnterior = null;

// ═══════════════════════════════════════════════════════
// RENDERIZADO DE LA GRILLA DE BLOQUES DE DISCO
// ═══════════════════════════════════════════════════════

/**
 * Renderiza la grilla de bloques de disco en #grillaDisco.
 * Distribución: filas de 10 bloques cada una (0-9, 10-19, …).
 *
 * @param {Array}  snapshot    - Array de objetos bloque con { tipo, archivo, color, puntero, bloquesDatos, … }
 * @param {number} totalBloques - Cantidad total de bloques en el disco
 * @param {string} metodo      - Método de asignación: 'contigua' | 'enlazada' | 'indexada'
 * @param {number} pasoActual  - Número del paso actual (para animaciones)
 */
export function renderizarGrillaDisco(snapshot, totalBloques, metodo, pasoActual) {
  const contenedor = document.getElementById('grillaDisco');
  if (!contenedor) return;

  const fragment = document.createDocumentFragment();
  const bloquesPorFila = 10;
  const totalFilas = Math.ceil(totalBloques / bloquesPorFila);

  // Detectar bloques que cambiaron respecto al render anterior
  const bloquesModificados = new Set();
  if (_snapshotAnterior && _snapshotAnterior.length === snapshot.length) {
    for (let i = 0; i < snapshot.length; i++) {
      const prev = _snapshotAnterior[i];
      const curr = snapshot[i];
      if (prev.tipo !== curr.tipo || prev.archivo !== curr.archivo || prev.color !== curr.color) {
        bloquesModificados.add(i);
      }
    }
  } else {
    // Primera carga — marcar todos como modificados
    for (let i = 0; i < snapshot.length; i++) bloquesModificados.add(i);
  }

  for (let fila = 0; fila < totalFilas; fila++) {
    const filaDiv = document.createElement('div');
    filaDiv.className = 'fila-disco';

    const inicio = fila * bloquesPorFila;
    const fin = Math.min(inicio + bloquesPorFila, totalBloques);

    for (let i = inicio; i < fin; i++) {
      const bloque = snapshot[i] || { tipo: 'libre', archivo: null, color: null };
      const esLibre = bloque.tipo === 'libre';
      const esIndice = (metodo === 'indexada' || metodo === 'indexada-ml') && (bloque.tipo === 'indice' || bloque.tipo === 'indice2');
      const esFAT   = metodo === 'fat' && bloque.tipo === 'fat';

      // ── Determinar color de fondo ──
      let colorFondo = esLibre ? 'var(--color-libre)' : (bloque.color || '#e2e8f0');
      // Bloques FAT usan un tono más oscuro para distinguirse
      if (esFAT) colorFondo = bloque.color ? bloque.color + 'cc' : '#6d28d9';

      // ── Determinar contenido textual según método ──
      let contenidoTexto = '';
      if (!esLibre) {
        switch (metodo) {
          case 'contigua':
            contenidoTexto = bloque.archivo || '';
            break;
          case 'enlazada':
          case 'fat':
            contenidoTexto = (bloque.puntero !== undefined && bloque.puntero !== null)
              ? String(bloque.puntero)
              : (bloque.archivo || '');
            break;
          case 'indexada':
          case 'indexada-ml':
            if (esIndice && Array.isArray(bloque.indices)) {
              // Mostrar máx. 4 índices para no desbordar la celda
              const vis = bloque.indices.slice(0, 4);
              contenidoTexto = vis.join(',') + (bloque.indices.length > 4 ? '…' : '');
            } else {
              contenidoTexto = bloque.archivo || '';
            }
            break;
          default:
            contenidoTexto = bloque.archivo || '';
        }
      }

      // ── Crear celda del bloque ──
      const celda = document.createElement('div');
      let clases = 'bloque-disco bloque-disco-' + (esLibre ? 'libre' : bloque.tipo);
      if (esIndice) clases += ' bloque-disco-indice';
      if (esFAT)    clases += ' bloque-disco-fat';
      if (bloque.tipo === 'indice2') clases += ' bloque-disco-indice2';
      // Extensiones: bordes de inicio y fin
      if (!esLibre && bloque.esInicioExt) clases += ' bloque-disco-ext-inicio';
      if (!esLibre && bloque.esFinExt)    clases += ' bloque-disco-ext-fin';
      celda.className = clases;

      celda.setAttribute('data-index', i);
      if (bloque.archivo) celda.setAttribute('data-archivo', bloque.archivo);

      // Estilo de fondo y borde especial
      let estiloInline = `background:${colorFondo};`;
      if (esIndice && bloque.tipo === 'indice')  estiloInline += 'border:2px dashed rgba(255,255,255,0.7);';
      if (bloque.tipo === 'indice2')             estiloInline += 'border:2px dotted rgba(255,255,255,0.5);';
      if (esFAT)                                 estiloInline += 'border:2px solid rgba(255,255,255,0.8);';
      celda.style.cssText = estiloInline;

      // ── Contenido interno ──
      const spanNumero = document.createElement('span');
      spanNumero.className = 'bd-numero';
      spanNumero.textContent = i;

      const spanContenido = document.createElement('span');
      spanContenido.className = 'bd-contenido';
      spanContenido.textContent = contenidoTexto;

      celda.appendChild(spanNumero);
      celda.appendChild(spanContenido);

      // Badge de número de extensión (solo en asignación por extensiones)
      if (!esLibre && bloque.extension !== undefined && bloque.extension !== null) {
        const extBadge = document.createElement('span');
        extBadge.className = 'bd-ext-badge';
        extBadge.textContent = `E${bloque.extension}`;
        celda.appendChild(extBadge);
      }

      // ── Tooltip ──
      const tooltip = document.createElement('div');
      tooltip.className = 'bloque-tooltip';
      let htmlTooltip = `<strong>Bloque ${i}</strong><br/>`;
      htmlTooltip += `Tipo: ${esLibre ? 'Libre' : esc(bloque.tipo)}<br/>`;
      if (!esLibre) {
        htmlTooltip += `Archivo: ${esc(bloque.archivo || '—')}<br/>`;
        if ((metodo === 'enlazada' || metodo === 'fat') && bloque.puntero !== undefined) {
          htmlTooltip += `Puntero: ${bloque.puntero}<br/>`;
        }
        if ((esIndice || bloque.tipo === 'indice2') && Array.isArray(bloque.indices)) {
          htmlTooltip += `Índices: [${bloque.indices.join(', ')}]<br/>`;
        }
        if (esFAT) {
          htmlTooltip += `Tipo: Entrada FAT<br/>`;
          htmlTooltip += `Siguiente: ${bloque.puntero}<br/>`;
        }
        // Extensiones: info del número de extensión
        if (bloque.extension !== undefined && bloque.extension !== null) {
          htmlTooltip += `Extensión: ${bloque.extension}/${bloque.totalExtensiones || '?'}<br/>`;
          if (bloque.esInicioExt) htmlTooltip += `◄ Inicio de extensión<br/>`;
          if (bloque.esFinExt)    htmlTooltip += `► Fin de extensión<br/>`;
        }
        // Bitmap: posición en el mapa de bits
        if (bloque.bitmapPos !== undefined) {
          htmlTooltip += `Bitmap[${bloque.bitmapPos}]: 1 (ocupado)<br/>`;
        }
      }
      tooltip.innerHTML = htmlTooltip;
      celda.appendChild(tooltip);

      // ── Eventos de hover — resaltar todos los bloques del mismo archivo ──
      if (!esLibre && bloque.archivo) {
        celda.addEventListener('mouseenter', () => {
          const archivoActual = celda.getAttribute('data-archivo');
          const todos = contenedor.querySelectorAll(`.bloque-disco[data-archivo="${archivoActual}"]`);
          todos.forEach(el => el.classList.add('bloque-disco-resaltado'));
        });
        celda.addEventListener('mouseleave', () => {
          const archivoActual = celda.getAttribute('data-archivo');
          const todos = contenedor.querySelectorAll(`.bloque-disco[data-archivo="${archivoActual}"]`);
          todos.forEach(el => el.classList.remove('bloque-disco-resaltado'));
        });
      }

      // ── Animación para bloques que cambiaron ──
      if (bloquesModificados.has(i)) {
        requestAnimationFrame(() => {
          celda.classList.add('entrando');
          celda.addEventListener('animationend', () => {
            celda.classList.remove('entrando');
          }, { once: true });
        });
      }

      filaDiv.appendChild(celda);
    }

    fragment.appendChild(filaDiv);
  }

  contenedor.replaceChildren(fragment);

  // Guardar snapshot actual para la próxima comparación
  _snapshotAnterior = snapshot.map(b => ({
    tipo: b.tipo,
    archivo: b.archivo,
    color: b.color
  }));
}

// ═══════════════════════════════════════════════════════
// LEYENDA DE COLORES DE ARCHIVOS
// ═══════════════════════════════════════════════════════

/**
 * Renderiza la leyenda de colores de archivos en #leyendaDisco.
 * Cada archivo muestra un punto con su color y su nombre.
 * Se incluye una entrada "Libre" con el color de bloques libres.
 *
 * @param {Array} archivos - Array de objetos { nombre, color }
 */
export function renderizarLeyendaDisco(archivos) {
  const contenedor = document.getElementById('leyendaDisco');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  // Entradas de archivos activos
  archivos.forEach(archivo => {
    const item = document.createElement('div');
    item.className = 'leyenda-item';
    item.innerHTML = `
      <span class="leyenda-punto" style="background:${esc(archivo.color)};box-shadow:0 1px 3px ${esc(archivo.color)}55"></span>
      ${esc(archivo.nombre)}
    `;
    contenedor.appendChild(item);
  });

  // Entrada especial para bloques libres
  const itemLibre = document.createElement('div');
  itemLibre.className = 'leyenda-item';
  itemLibre.innerHTML = `
    <span class="leyenda-punto" style="background:var(--color-libre);box-shadow:0 1px 3px #e2e8f055"></span>
    Libre
  `;
  contenedor.appendChild(itemLibre);
}

// ═══════════════════════════════════════════════════════
// ACTUALIZACIÓN DE MÉTRICAS DE DISCO
// ═══════════════════════════════════════════════════════

/**
 * Actualiza las cajas de métricas del simulador de disco.
 * Busca el elemento .cm-valor dentro de cada contenedor
 * y añade la clase 'cargado' a la .caja-metrica padre.
 *
 * @param {Object} metricas - Objeto con las métricas calculadas:
 *   { totalBloques, bloquesOcupados, bloquesLibres, archivosActivos,
 *     fragmentacionExterna, opsLectura, opsEscritura }
 */
export function actualizarMetricasDisco(metricas) {
  // Porcentaje de uso del disco
  const usoPorc = metricas.totalBloques > 0
    ? Math.round((metricas.bloquesOcupados / metricas.totalBloques) * 100) + '%'
    : '0%';

  // Operaciones de E/S formateadas
  const lecturas = metricas.opsLectura || 0;
  const escrituras = metricas.opsEscritura || 0;
  const opsESStr = `R:${lecturas} W:${escrituras}`;

  _actualizarCajaMetrica('mvUsoDisco',       usoPorc);
  _actualizarCajaMetrica('mvBloquesLibres',  metricas.bloquesLibres);
  _actualizarCajaMetrica('mvBloquesOcupados', metricas.bloquesOcupados);
  _actualizarCajaMetrica('mvArchivosActivos', metricas.archivosActivos);
  _actualizarCajaMetrica('mvFragExtDisco',   metricas.fragmentacionExterna);
  _actualizarCajaMetrica('mvOpsES',          opsESStr);
}

/**
 * Función auxiliar para actualizar una caja de métrica individual.
 * Busca el elemento con el ID dado, actualiza el texto del .cm-valor,
 * y marca la caja padre con la clase 'cargado'.
 *
 * @param {string}       id    - ID del elemento que contiene .cm-valor
 * @param {string|number} valor - Valor a mostrar
 */
function _actualizarCajaMetrica(id, valor) {
  const elValor = document.getElementById(id);
  if (!elValor) return;

  // El elemento con el ID es el .cm-valor mismo
  elValor.textContent = valor;

  // Buscar la caja métrica padre y marcarla como cargada
  const cajaMetrica = elValor.closest('.caja-metrica');
  if (cajaMetrica) {
    cajaMetrica.classList.add('cargado');
  }
}

// ═══════════════════════════════════════════════════════
// TABLA DE METADATOS / DIRECTORIO
// ═══════════════════════════════════════════════════════

/**
 * Renderiza la tabla de metadatos (directorio) del disco.
 * Los encabezados y columnas varían según el método de asignación.
 *
 * @param {Array}  metadatos - Array de objetos con info de cada archivo
 * @param {string} metodo    - Método de asignación: 'contigua' | 'enlazada' | 'indexada'
 */
export function renderizarTablaMetadatos(metadatos, metodo) {
  const thead = document.getElementById('theadMetadatos');
  const cuerpo = document.getElementById('cuerpoTablaMetadatos');
  if (!thead || !cuerpo) return;

  // ── Encabezados según método ──
  let encabezados = [];
  switch (metodo) {
    case 'contigua':
      encabezados = ['Archivo', 'Inicio', 'Longitud'];
      break;
    case 'enlazada':
      encabezados = ['Archivo', 'Inicio', 'Final'];
      break;
    case 'indexada':
      encabezados = ['Archivo', 'Bloque Índice'];
      break;
    case 'fat':
      encabezados = ['Archivo', 'Inicio', 'Final', 'Bloques', 'FAT'];
      break;
    case 'indexada-ml':
      encabezados = ['Archivo', 'Índice Raíz', 'Índices Niv. 2', 'Bloques Datos'];
      break;
    case 'extensiones':
      encabezados = ['Archivo', 'Total Bloques', 'Extensiones'];
      break;
    case 'bitmap':
      encabezados = ['Archivo', 'Bloques Requeridos', 'Bloques Asignados', 'Bits Libres Globales'];
      break;
    default:
      encabezados = ['Archivo', 'Inicio', 'Longitud'];
  }

  thead.innerHTML = `<tr>${encabezados.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;

  // ── Cuerpo de la tabla ──
  cuerpo.innerHTML = '';

  metadatos.forEach((meta, indice) => {
    const fila = document.createElement('tr');
    fila.style.animation = `aparecer 0.3s ease both ${indice * 25}ms`;

    // Celda del nombre con badge de color
    const colorBadge = meta.color || 'var(--acento)';
    let htmlFila = `<td><span class="badge-proc" style="background:${esc(colorBadge)}">${esc(meta.nombre || meta.archivo || '—')}</span></td>`;

    switch (metodo) {
      case 'contigua':
        htmlFila += `<td>${meta.inicio !== undefined ? meta.inicio : '—'}</td>`;
        htmlFila += `<td>${meta.longitud !== undefined ? meta.longitud : '—'}</td>`;
        break;
      case 'enlazada':
        htmlFila += `<td>${meta.inicio !== undefined ? meta.inicio : '—'}</td>`;
        htmlFila += `<td>${meta.final !== undefined ? meta.final : '—'}</td>`;
        break;
      case 'indexada':
        htmlFila += `<td>${meta.bloqueIndice !== undefined ? meta.bloqueIndice : '—'}</td>`;
        break;
      case 'fat': {
        // Mostrar la FAT como cadena compacta: bloque→siguiente
        const fatStr = Array.isArray(meta.fat)
          ? meta.fat.map(e => `${e.bloque}→${e.siguiente}`).join(', ')
          : '—';
        htmlFila += `<td>${meta.inicio !== undefined ? meta.inicio : '—'}</td>`;
        htmlFila += `<td>${meta.final !== undefined ? meta.final : '—'}</td>`;
        htmlFila += `<td>${meta.bloques !== undefined ? meta.bloques : '—'}</td>`;
        htmlFila += `<td style="font-size:0.72rem;color:var(--texto-sec)">${esc(fatStr)}</td>`;
        break;
      }
      case 'indexada-ml':
        htmlFila += `<td>${meta.bloqueIndice !== undefined ? meta.bloqueIndice : '—'}</td>`;
        htmlFila += `<td>${Array.isArray(meta.bloqueIndice2) ? meta.bloqueIndice2.join(', ') : '—'}</td>`;
        htmlFila += `<td>${meta.totalBloquesDatos !== undefined ? meta.totalBloquesDatos : '—'}</td>`;
        break;
      case 'extensiones': {
        const extStr = Array.isArray(meta.extensiones)
          ? meta.extensiones.map(e => `[${e.inicio}..${e.fin}] (${e.longitud})`).join(', ')
          : '—';
        htmlFila += `<td>${meta.totalBloques !== undefined ? meta.totalBloques : '—'}</td>`;
        htmlFila += `<td style="font-size:0.75rem;color:var(--texto-sec)">${esc(extStr)}</td>`;
        break;
      }
      case 'bitmap':
        htmlFila += `<td>${meta.numBloques !== undefined ? meta.numBloques : '—'}</td>`;
        htmlFila += `<td>${Array.isArray(meta.bloques) ? meta.bloques.join(', ') : '—'}</td>`;
        htmlFila += `<td>${meta.bitsLibres !== undefined ? meta.bitsLibres : '—'}</td>`;
        break;
      default:
        htmlFila += `<td>—</td><td>—</td>`;
    }

    fila.innerHTML = htmlFila;
    cuerpo.appendChild(fila);
  });
}

// ═══════════════════════════════════════════════════════
// LOG DE PASOS DEL SIMULADOR DE DISCO
// ═══════════════════════════════════════════════════════

/**
 * Mapeo de tipos de paso a clases CSS y etiquetas.
 * Reutiliza los mismos nombres del proyecto existente.
 */
function _claseTipoDisco(tipo) {
  const mapa = {
    ok:       'paso-ok',
    error:    'paso-error',
    libre:    'paso-libre',
    escritura: 'paso-ok',
    lectura:  'paso-buddy',
    borrado:  'paso-libre',
    creacion: 'paso-ok',
    indice:   'paso-buddy',
    indice2:  'paso-buddy',
    fat:      'paso-cola',
    puntero:  'paso-ok',
  };
  return mapa[tipo] || 'paso-ok';
}

function _etiquetaTipoDisco(tipo) {
  const mapa = {
    ok:       'Asignado',
    error:    'Error',
    libre:    'Liberado',
    escritura: 'Escritura',
    lectura:  'Lectura',
    borrado:  'Borrado',
    creacion: 'Creación',
    indice:   'Índice',
    indice2:  'Índice Niv.2',
    fat:      'FAT',
    puntero:  'Enlazado',
  };
  return mapa[tipo] || 'Evento';
}

/**
 * Convierte la descripción técnica de un paso en un mensaje amigable y fácil de entender.
 */
function _mensajeAmigable(paso, numeroPaso) {
  const { tipo, archivo, descripcion } = paso;
  const nom = archivo || '?';

  // Extraer primer número de la descripción (número de bloque)
  const numMatch = descripcion ? descripcion.match(/(\d+)/) : null;
  const blk = numMatch ? numMatch[1] : '?';

  // Extraer segundo número (destino del puntero)
  const nums = descripcion ? [...descripcion.matchAll(/(\d+)/g)] : [];
  const blkDest = nums.length > 1 ? nums[1][1] : null;

  switch (tipo) {
    case 'ok':
      if (descripcion && descripcion.includes('Completado')) {
        return `El archivo "${nom}" quedó completamente guardado en el disco.`;
      }
      return `El archivo "${nom}" ocupa el bloque número ${blk}.`;

    case 'puntero':
      if (blkDest) {
        return `Bloque ${blk} guardado. Su puntero apunta al siguiente bloque (${blkDest}).`;
      }
      return `Bloque ${blk} guardado. Este es el último bloque del archivo "${nom}" (EOF).`;

    case 'indice':
      return `Se creó el Índice del archivo "${nom}" en el bloque ${blk}. Desde ahí se llega a todos sus datos.`;

    case 'indice2':
      return `Índice secundario en bloque ${blk} — apunta a los datos del archivo "${nom}".`;

    case 'fat':
      if (blkDest && descripcion.includes('EOF')) {
        return `Tabla FAT: bloque ${blk} marcado como el último del archivo "${nom}" (fin de cadena).`;
      }
      return `Tabla FAT: bloque ${blk} → siguiente bloque ${blkDest || '?'}. Se actualiza la tabla central.`;

    case 'bitmap':
      if (descripcion && descripcion.includes('escaneando')) {
        return `El sistema revisa el mapa de bits para encontrar bloques libres para el archivo "${nom}".`;
      }
      return `Bit[${blk}] cambia de 0 a 1. El bloque ${blk} ahora pertenece al archivo "${nom}".`;

    case 'creacion':
      return `Iniciando almacenamiento del archivo "${nom}" en el disco...`;

    case 'error':
      if (descripcion && descripcion.includes('No hay espacio')) {
        return `No hay espacio suficiente en el disco para el archivo "${nom}". Intenta con menos bloques.`;
      }
      if (descripcion && descripcion.includes('ya ocupados')) {
        return `No se puede guardar "${nom}": algunos bloques elegidos ya están en uso por otro archivo.`;
      }
      if (descripcion && descripcion.includes('fuera del rango')) {
        return `Los bloques para "${nom}" están fuera del disco. Revisa los números de bloque.`;
      }
      return `Error al guardar el archivo "${nom}".`;

    default:
      return descripcion || `Paso ${numeroPaso} — ${nom}`;
  }
}

/**
 * Agrega una entrada de paso al log de disco (#logPasosDisco).
 * Sigue la misma estructura .paso-item del proyecto existente.
 *
 * @param {Object} paso       - Objeto del paso { tipo, archivo, descripcion, lecturas, escrituras }
 * @param {number} numeroPaso - Número secuencial del paso
 */
export function agregarPasoLogDisco(paso, numeroPaso, metadatos = []) {
  const contenedor = document.getElementById('logPasosDisco');
  if (!contenedor) return;

  const tipo = paso.tipo || 'ok';
  const claseTipo = _claseTipoDisco(tipo);
  const etiqueta = _etiquetaTipoDisco(tipo);
  const lecturas = paso.lecturas || 0;
  const escrituras = paso.escrituras || 0;
  const mensajeAmigable = _mensajeAmigable(paso, numeroPaso);

  const el = document.createElement('div');
  const i = contenedor.children.length;

  // Animación condicional — desactivar para muchos elementos
  if (i < ANIM_THRESHOLD) {
    el.className = `paso-item ${claseTipo}`;
    el.style.animationDelay = `${Math.min((i + 1) * 0.02, 0.35)}s`;
  } else {
    el.className = `paso-item ${claseTipo} no-anim`;
  }

  // E/S solo se muestra si hay operaciones
  const esInfo = lecturas === 0 && escrituras === 0;
  const ioHtml = esInfo
    ? ''
    : `<div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
        <span style="display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; color: #0f766e; background: #f0fdfa; padding: 3px 6px; border-radius: 6px; border: 1px solid #ccfbf1; box-shadow: 0 1px 2px rgba(0,0,0,0.02)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          LECTURAS: ${lecturas}
        </span>
        <span style="display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; color: #9f1239; background: #fff1f2; padding: 3px 6px; border-radius: 6px; border: 1px solid #ffe4e6; box-shadow: 0 1px 2px rgba(0,0,0,0.02)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          ESCRITURAS: ${escrituras}
        </span>
       </div>`;

  const bloquesTags = paso.bloquesAfectados && paso.bloquesAfectados.length > 0 
    ? paso.bloquesAfectados.map(b => `<span style="background:var(--surface2); border: 1px solid var(--borde-claro); padding:2px 6px; border-radius:4px; font-family:'JetBrains Mono', monospace; font-size:10px; font-weight:700; color:var(--txt2);">Bloque ${b}</span>`).join(' ')
    : '';

  // Determinar color real del archivo
  let colorArchivo = 'var(--acento)';
  if (paso.archivo && metadatos.length > 0) {
    const meta = metadatos.find(m => m.archivo === paso.archivo);
    if (meta && meta.color) colorArchivo = meta.color;
  }

  const archivoEtiqueta = paso.archivo 
    ? `<span style="font-size:12px; font-weight:600; color:var(--txt); display:flex; align-items:center; gap:6px;">Archivo: <span style="color:#ffffff; background-color:${colorArchivo}; font-family:'JetBrains Mono', monospace; padding: 2px 8px; border-radius: 6px; box-shadow: 0 2px 4px ${colorArchivo}66; letter-spacing:0.5px;">${esc(paso.archivo)}</span></span>` 
    : '';

  // Icono vectorial premium según el tipo de paso
  let badgeIcon = '';
  switch (tipo) {
    case 'ok':
      badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      break;
    case 'error':
      badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      break;
    case 'puntero':
      badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
      break;
    case 'indice':
    case 'indice2':
      badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`;
      break;
    case 'fat':
      badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`;
      break;
    case 'bitmap':
      badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg>`;
      break;
    case 'creacion':
      badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`;
      break;
  }

  el.innerHTML = `
    <span class="paso-num">${numeroPaso}</span>
    <div class="paso-desc" style="display:flex; flex-direction:column; gap:5px;">
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
        ${archivoEtiqueta}
        <div>${bloquesTags}</div>
      </div>
      <div style="line-height:1.4;">${esc(mensajeAmigable)}</div>
      ${ioHtml}
    </div>
    <span class="paso-badge ${claseTipo}" style="display:inline-flex;align-items:center;gap:4px; margin-left:auto; padding:3px 8px;">
      ${badgeIcon}
      ${esc(etiqueta)}
    </span>
  `;

  contenedor.appendChild(el);
}

// ═══════════════════════════════════════════════════════
// LIMPIEZA DE CONTENEDORES
// ═══════════════════════════════════════════════════════

/**
 * Limpia el contenido del log de pasos del disco.
 */
export function limpiarLogDisco() {
  const el = document.getElementById('logPasosDisco');
  if (el) el.innerHTML = '';
}

/**
 * Limpia el contenido de la grilla de bloques de disco
 * y reinicia el snapshot anterior.
 */
export function limpiarGrillaDisco() {
  const el = document.getElementById('grillaDisco');
  if (el) el.innerHTML = '';
  _snapshotAnterior = null;
}

// ═══════════════════════════════════════════════════════
// VISUALIZACIÓN DEL BITMAP
// ═══════════════════════════════════════════════════════

/** Estado anterior del bitmap para detectar bits que cambiaron */
let _bitmapAnterior = null;

/**
 * Renderiza el panel de bitmap en #bitmapDisplay.
 * Muestra el bitmap organizado en filas de 32 bits (4 bytes por fila).
 * Los bits se agrupan en bytes (grupos de 8) para mayor legibilidad.
 * Bits coloreados = ocupados (color del archivo), gris = libre.
 *
 * @param {Array} snapshot    - Array de bloques (mismo formato que renderizarGrillaDisco)
 * @param {number} totalBloques - Total de bloques del disco
 */
export function renderizarBitmapDisco(snapshot, totalBloques) {
  const contenedor = document.getElementById('bitmapDisplay');
  if (!contenedor) return;

  const BITS_POR_FILA = 32; // 4 bytes por fila
  const BITS_POR_BYTE = 8;

  // 1. Construir DOM solo si está vacío
  if (contenedor.children.length === 0) {
    const fragment = document.createDocumentFragment();
    const totalFilas = Math.ceil(totalBloques / BITS_POR_FILA);

    for (let fila = 0; fila < totalFilas; fila++) {
      const filaDiv = document.createElement('div');
      filaDiv.className = 'bitmap-fila';

      const label = document.createElement('span');
      label.className = 'bitmap-label';
      label.textContent = fila * BITS_POR_FILA;
      filaDiv.appendChild(label);

      for (let byte = 0; byte < BITS_POR_FILA / BITS_POR_BYTE; byte++) {
        const byteGrupo = document.createElement('div');
        byteGrupo.className = 'bitmap-byte-grupo';

        for (let bit = 0; bit < BITS_POR_BYTE; bit++) {
          const idx = fila * BITS_POR_FILA + byte * BITS_POR_BYTE + bit;
          if (idx >= totalBloques) break;

          const bitEl = document.createElement('span');
          bitEl.className = 'bitmap-bit bitmap-bit-0';
          bitEl.id = `bitmap-bit-${idx}`;
          bitEl.textContent = '0';
          byteGrupo.appendChild(bitEl);
        }
        filaDiv.appendChild(byteGrupo);
      }
      fragment.appendChild(filaDiv);
    }
    contenedor.appendChild(fragment);
  }

  // 2. Detectar bits que cambiaron respecto al render anterior
  const bitsModificados = new Set();
  if (_bitmapAnterior && _bitmapAnterior.length === totalBloques) {
    for (let i = 0; i < totalBloques; i++) {
      const prevLibre = _bitmapAnterior[i] === 0;
      const currLibre = snapshot[i].tipo === 'libre';
      if (prevLibre !== currLibre) bitsModificados.add(i);
    }
  } else {
    for (let i = 0; i < totalBloques; i++) {
      if (snapshot[i].tipo !== 'libre') bitsModificados.add(i);
    }
  }

  // 3. Actualizar DOM existente
  for (let idx = 0; idx < totalBloques; idx++) {
    const bloque = snapshot[idx];
    const estaLibre = bloque.tipo === 'libre';
    const valor = estaLibre ? 0 : 1;
    const color = !estaLibre && bloque.color ? bloque.color : null;
    
    const bitEl = document.getElementById(`bitmap-bit-${idx}`);
    if (!bitEl) continue;

    bitEl.className = `bitmap-bit bitmap-bit-${valor}`;
    bitEl.textContent = valor;
    
    if (color) {
      bitEl.style.background = color;
      bitEl.style.boxShadow = `0 2px 6px ${color}55`;
    } else {
      bitEl.style.background = '';
      bitEl.style.boxShadow = '';
    }

    const archivoNom = bloque.archivo ? bloque.archivo.replace(/"/g, '&quot;') : '?';
    bitEl.title = `Bit[${idx}] = ${valor}  |  Bloque ${idx}: ${estaLibre ? 'Libre' : archivoNom}`;

    // Animación para bits que cambiaron (forzar reflow para reiniciar la animación)
    if (bitsModificados.has(idx)) {
      bitEl.classList.remove('recien-cambiado');
      void bitEl.offsetWidth; // trigger reflow
      bitEl.classList.add('recien-cambiado');
    }
  }

  // Guardar estado actual del bitmap para la siguiente comparación
  _bitmapAnterior = snapshot.map(b => (b.tipo === 'libre' ? 0 : 1));
}


/**
 * Limpia el panel de bitmap y reinicia el estado anterior.
 */
export function limpiarBitmapDisco() {
  const el = document.getElementById('bitmapDisplay');
  if (el) el.innerHTML = '';
  _bitmapAnterior = null;
}

// ═══════════════════════════════════════════════════════
// FLECHAS SVG DINÁMICAS DE PUNTEROS
// Solo muestra la flecha del bloque activo del paso actual.
// ═══════════════════════════════════════════════════════

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Obtiene el rect de un bloque relativo a su contenedor wrap */
function _rect(celda, wrap) {
  const c = celda.getBoundingClientRect();
  const w = wrap.getBoundingClientRect();
  return {
    left:   c.left   - w.left,
    right:  c.right  - w.left,
    top:    c.top    - w.top,
    bottom: c.bottom - w.top,
    cx:     c.left   - w.left + c.width  / 2,
    cy:     c.top    - w.top  + c.height / 2,
    w: c.width,
    h: c.height,
  };
}

/**
 * Dibuja una flecha curva elegante entre dos bloques.
 * Las flechas pasan por FUERA de los bloques (de borde a borde),
 * sin tapar el texto interno.
 */
function _flecha(svg, rSrc, rDst, color) {
  // ── Calcular puntos de salida/entrada en los bordes ──
  const dx = rDst.cx - rSrc.cx;
  const dy = rDst.cy - rSrc.cy;
  const mismaFila = Math.abs(dy) < rSrc.h * 0.6;

  let x1, y1, x2, y2;

  if (mismaFila) {
    // Salida por el lado derecho del origen, entrada por el izquierdo del destino
    x1 = dx >= 0 ? rSrc.right  : rSrc.left;
    y1 = rSrc.cy;
    x2 = dx >= 0 ? rDst.left   : rDst.right;
    y2 = rDst.cy;
  } else {
    // Salida por la parte inferior/superior
    x1 = rSrc.cx;
    y1 = dy >= 0 ? rSrc.bottom : rSrc.top;
    x2 = rDst.cx;
    y2 = dy >= 0 ? rDst.top    : rDst.bottom;
  }

  const dist = Math.hypot(x2 - x1, y2 - y1);
  if (dist < 4) return; // bloques superpuestos, no dibujar

  // ── Curva cuadrática ──
  let cx, cy;
  if (mismaFila) {
    cx = (x1 + x2) / 2;
    cy = y1 - Math.min(28, dist * 0.35); // arco hacia arriba
  } else {
    const sign = dx >= 0 ? 1 : -1;
    cx = (x1 + x2) / 2 + sign * Math.min(22, Math.abs(dy) * 0.25);
    cy = (y1 + y2) / 2;
  }

  // ── Marcador de punta (único por SVG) ──
  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS(SVG_NS, 'defs'); svg.appendChild(defs); }

  const mid = `m${Math.round(rSrc.cx)}-${Math.round(rSrc.cy)}`;
  const markId = `ah-${mid}`;
  if (!defs.querySelector(`#${markId}`)) {
    const mk = document.createElementNS(SVG_NS, 'marker');
    mk.setAttribute('id', markId);
    mk.setAttribute('markerWidth', '8');
    mk.setAttribute('markerHeight', '8');
    mk.setAttribute('refX', '7');
    mk.setAttribute('refY', '4');
    mk.setAttribute('orient', 'auto-start-reverse');
    const pg = document.createElementNS(SVG_NS, 'polygon');
    pg.setAttribute('points', '0 0, 8 4, 0 8, 1.5 4');
    pg.setAttribute('fill', color);
    mk.appendChild(pg);
    defs.appendChild(mk);
  }

  // ── Halo blanco (para legibilidad sobre bloques de colores) ──
  const halo = document.createElementNS(SVG_NS, 'path');
  halo.setAttribute('d', `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  halo.setAttribute('fill', 'none');
  halo.setAttribute('stroke', 'rgba(255,255,255,0.55)');
  halo.setAttribute('stroke-width', '4');
  halo.setAttribute('stroke-linecap', 'round');
  svg.appendChild(halo);

  // ── Línea principal ──
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-opacity', '0.9');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('marker-end', `url(#${markId})`);

  // Animación de dibujado: calcular longitud aproximada del path
  const pathLen = dist * 1.2;
  path.style.cssText = `stroke-dasharray:${pathLen};stroke-dashoffset:${pathLen};animation:dibujarFlecha 0.45s cubic-bezier(.4,0,.2,1) forwards`;

  svg.appendChild(path);

  // ── Punto de origen (inicio de la flecha) ──
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', x1.toFixed(1));
  dot.setAttribute('cy', y1.toFixed(1));
  dot.setAttribute('r', '3');
  dot.setAttribute('fill', color);
  dot.setAttribute('opacity', '0.85');
  svg.appendChild(dot);
}

/**
 * Renderiza la flecha del bloque activo del paso actual.
 * Solo dibuja UNA flecha (el enlace del bloque recién asignado),
 * posicionada entre los bordes de los bloques (no encima del texto).
 *
 * @param {Array}   snapshot      - Estado actual del disco
 * @param {string}  metodo        - Método de asignación
 * @param {number}  [bloqueActivo] - Índice del bloque del paso actual
 */
export function renderizarFlechasDisco(snapshot, metodo, bloqueActivo) {
  const wrap   = document.querySelector('.grilla-disco-wrap');
  const grilla = document.getElementById('grillaDisco');
  if (!wrap || !grilla) return;

  // Limpiar flecha anterior
  wrap.querySelector('.disco-flechas-svg')?.remove();

  const metodosConFlechas = ['enlazada', 'fat', 'indexada', 'indexada-ml'];
  if (!metodosConFlechas.includes(metodo)) return;

  wrap.style.position = 'relative';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'disco-flechas-svg');
  svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;overflow:visible;';

  requestAnimationFrame(() => {
    wrap.appendChild(svg);

    // Determinar el bloque origen a conectar
    const bloqueSrc = bloqueActivo !== undefined
      ? snapshot[bloqueActivo]
      : null;

    if (!bloqueSrc || bloqueSrc.tipo === 'libre') return;

    const color = bloqueSrc.color || '#f59e0b';
    const celdaSrc = grilla.querySelector(`[data-index="${bloqueSrc.index}"]`);
    if (!celdaSrc) return;
    const rSrc = _rect(celdaSrc, wrap);

    // ── Enlazada / FAT: flecha al siguiente bloque ──
    if ((metodo === 'enlazada' || metodo === 'fat') && bloqueSrc.puntero !== null && bloqueSrc.puntero !== -1) {
      const celdaDst = grilla.querySelector(`[data-index="${bloqueSrc.puntero}"]`);
      if (celdaDst) {
        _flecha(svg, rSrc, _rect(celdaDst, wrap), color);
      }
    }

    // ── Indexada: flechas del bloque índice a sus datos ──
    if ((metodo === 'indexada' || metodo === 'indexada-ml') && bloqueSrc.tipo === 'indice' && Array.isArray(bloqueSrc.indices)) {
      bloqueSrc.indices.forEach((destIdx, i) => {
        const celdaDst = grilla.querySelector(`[data-index="${destIdx}"]`);
        if (celdaDst) {
          // Pequeño retraso escalonado para efecto en cascada
          setTimeout(() => {
            _flecha(svg, rSrc, _rect(celdaDst, wrap), color);
          }, i * 60);
        }
      });
    }

    // ── Indexada-ML nivel 2 ──
    if (metodo === 'indexada-ml' && bloqueSrc.tipo === 'indice2' && Array.isArray(bloqueSrc.indices)) {
      bloqueSrc.indices.forEach((destIdx, i) => {
        const celdaDst = grilla.querySelector(`[data-index="${destIdx}"]`);
        if (celdaDst) {
          setTimeout(() => {
            _flecha(svg, rSrc, _rect(celdaDst, wrap), color + 'bb');
          }, i * 60);
        }
      });
    }
  });
}

/**
 * Elimina las flechas SVG de la grilla de disco.
 */
export function limpiarFlechasDisco() {
  document.querySelector('.grilla-disco-wrap .disco-flechas-svg')?.remove();
}
