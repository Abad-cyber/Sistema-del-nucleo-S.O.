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
      const esIndice = metodo === 'indexada' && bloque.tipo === 'indice';

      // ── Determinar color de fondo ──
      const colorFondo = esLibre
        ? 'var(--color-libre)'
        : (bloque.color || '#e2e8f0');

      // ── Determinar contenido textual según método ──
      let contenidoTexto = '';
      if (!esLibre) {
        switch (metodo) {
          case 'contigua':
            contenidoTexto = bloque.archivo || '';
            break;
          case 'enlazada':
            contenidoTexto = (bloque.puntero !== undefined && bloque.puntero !== null)
              ? String(bloque.puntero)
              : '';
            break;
          case 'indexada':
            if (esIndice && Array.isArray(bloque.bloquesDatos)) {
              contenidoTexto = bloque.bloquesDatos.join(',');
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
      celda.className = clases;

      celda.setAttribute('data-index', i);
      if (bloque.archivo) celda.setAttribute('data-archivo', bloque.archivo);

      // Estilo de fondo y borde especial para bloques índice
      let estiloInline = `background:${colorFondo};`;
      if (esIndice) {
        estiloInline += 'border:2px dashed rgba(255,255,255,0.6);';
      }
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

      // ── Tooltip ──
      const tooltip = document.createElement('div');
      tooltip.className = 'bloque-tooltip';
      let htmlTooltip = `<strong>Bloque ${i}</strong><br/>`;
      htmlTooltip += `Tipo: ${esLibre ? 'Libre' : esc(bloque.tipo)}<br/>`;
      if (!esLibre) {
        htmlTooltip += `Archivo: ${esc(bloque.archivo || '—')}<br/>`;
        if (metodo === 'enlazada' && bloque.puntero !== undefined) {
          htmlTooltip += `Puntero: ${bloque.puntero === -1 ? 'FIN (-1)' : bloque.puntero}<br/>`;
        }
        if (esIndice && Array.isArray(bloque.bloquesDatos)) {
          htmlTooltip += `Bloques datos: [${bloque.bloquesDatos.join(', ')}]<br/>`;
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
  };
  return mapa[tipo] || 'Evento';
}

/**
 * Agrega una entrada de paso al log de disco (#logPasosDisco).
 * Sigue la misma estructura .paso-item del proyecto existente.
 *
 * @param {Object} paso       - Objeto del paso { tipo, archivo, descripcion, lecturas, escrituras }
 * @param {number} numeroPaso - Número secuencial del paso
 */
export function agregarPasoLogDisco(paso, numeroPaso) {
  const contenedor = document.getElementById('logPasosDisco');
  if (!contenedor) return;

  const tipo = paso.tipo || 'ok';
  const claseTipo = _claseTipoDisco(tipo);
  const etiqueta = _etiquetaTipoDisco(tipo);
  const lecturas = paso.lecturas || 0;
  const escrituras = paso.escrituras || 0;

  const el = document.createElement('div');
  const i = contenedor.children.length;

  // Animación condicional — desactivar para muchos elementos
  if (i < ANIM_THRESHOLD) {
    el.className = `paso-item ${claseTipo}`;
    el.style.animationDelay = `${Math.min((i + 1) * 0.02, 0.35)}s`;
  } else {
    el.className = `paso-item ${claseTipo} no-anim`;
  }

  el.innerHTML = `
    <span class="paso-num">${numeroPaso}<br><span class="paso-tick">${esc(paso.archivo || '')}</span></span>
    <span class="paso-desc">${esc(paso.descripcion || '')}<br><strong>E/S:</strong> R:${lecturas} W:${escrituras}</span>
    <span class="paso-badge ${claseTipo}" style="display:inline-flex;align-items:center;gap:3px">
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
