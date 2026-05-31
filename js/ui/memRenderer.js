// ═══════════════════════════════════════════════════════
// ui/memRenderer.js — Renderizador del mapa de memoria vertical
// Dibuja los bloques de memoria: SO arriba, procesos y huecos hacia abajo
// ═══════════════════════════════════════════════════════

/**
 * Renderiza el mapa de memoria en el contenedor #mapaMemo.
 * Los bloques se apilan verticalmente: SO arriba, el resto hacia abajo.
 * La altura de cada bloque es proporcional a su tamaño en KB.
 *
 * @param {Array}  bloques      - Estado actual de la memoria
 * @param {number} memoriaTotal - KB totales (para calcular proporciones)
 * @param {number} indiceResaltado - Índice del bloque a resaltar (-1 = ninguno)
 * @param {boolean} animar      - Si debe animar el bloque resaltado
 */
export function renderizarMapaMemoria(bloques, memoriaTotal, indiceResaltado = -1, animar = false) {
  const contenedor = document.getElementById('mapaMemo');
  if (!contenedor) return;

  // Altura total del contenedor proporcional a la cantidad de bloques
  const alturaContenedor = Math.max(400, bloques.length * 52);
  contenedor.style.height = alturaContenedor + 'px';
  contenedor.innerHTML = '';

  bloques.forEach((bloque, indice) => {
    // Calcular altura proporcional al tamaño del bloque
    const porcentaje = (bloque.tamanio / memoriaTotal) * 100;
    const alturaMin  = 36; // altura mínima para que se pueda leer
    const altura     = Math.max(alturaMin, (porcentaje / 100) * alturaContenedor);

    // Color del bloque según su tipo
    const colorFondo = bloque.tipo === 'so'
      ? 'var(--color-so)'
      : bloque.tipo === 'libre'
        ? 'var(--color-libre)'
        : bloque.color;

    // Crear el elemento del bloque
    const elBloque = document.createElement('div');
    elBloque.className = 'bloque-mem';
    elBloque.style.cssText = `
      background: ${colorFondo};
      height: ${altura}px;
      flex-shrink: 0;
    `;
    elBloque.setAttribute('data-indice', indice);

    // Resaltado del bloque activo (el que se está asignando en este paso)
    if (indice === indiceResaltado) {
      elBloque.classList.add('resaltado');
      if (animar) elBloque.classList.add('entrando');
    }

    // Determinar si hay espacio suficiente para mostrar texto
    const mostrarCompleto = altura >= 52;
    const mostrarMinimo   = altura >= 34;

    // Etiqueta del tipo de bloque
    const etiquetaTipo = bloque.tipo === 'so'
      ? 'S.O.'
      : bloque.tipo === 'libre'
        ? 'Libre'
        : bloque.id;

    // Construir HTML interno del bloque
    let htmlInterno = '';
    if (mostrarMinimo) {
      htmlInterno += `<div class="bloque-nombre">${etiquetaTipo}</div>`;
    }
    if (mostrarCompleto) {
      htmlInterno += `<div class="bloque-tamanio">${bloque.tamanio}KB</div>`;
      if (bloque.inicio !== undefined) {
        htmlInterno += `<div class="bloque-rango">${bloque.inicio}K — ${bloque.inicio + bloque.tamanio - 1}K</div>`;
      }
      // Mostrar fragmentación interna si existe
      if (bloque.tipo === 'proceso' && bloque.fragmentacionInterna > 0) {
        htmlInterno += `<div class="bloque-frag">Frag: ${bloque.fragmentacionInterna}KB</div>`;
      }
    }

    // Tooltip al pasar el mouse
    const tipoLabel = bloque.tipo === 'so'
      ? 'Sistema Operativo'
      : bloque.tipo === 'libre'
        ? 'Libre'
        : 'Proceso';

    htmlInterno += `
      <div class="bloque-tooltip">
        <strong>${etiquetaTipo}</strong><br/>
        Tipo: ${tipoLabel}<br/>
        Tamaño: ${bloque.tamanio}KB<br/>
        Dir. inicio: ${bloque.inicio}KB<br/>
        Dir. fin: ${bloque.inicio + bloque.tamanio - 1}KB
        ${bloque.tipo === 'proceso' && bloque.fragmentacionInterna > 0
          ? `<br/>Frag. interna: ${bloque.fragmentacionInterna}KB`
          : ''}
        ${bloque.tipo === 'proceso' && bloque.tamanioParticion
          ? `<br/>Partición: ${bloque.tamanioParticion}KB`
          : ''}
      </div>
    `;

    elBloque.innerHTML = htmlInterno;
    contenedor.appendChild(elBloque);
  });

  // Actualizar subtítulo con info rápida
  const subTitulo = document.getElementById('subtituloMem');
  if (subTitulo) {
    subTitulo.textContent = `${memoriaTotal}KB · ${bloques.length} bloque(s)`;
  }
}

/**
 * Renderiza la leyenda del mapa de memoria.
 * Muestra un punto de color y nombre por cada proceso + SO + Libre.
 *
 * @param {Array} bloques - Estado actual de la memoria
 */
export function renderizarLeyenda(bloques) {
  const contenedorLeyenda = document.getElementById('leyendaMem');
  if (!contenedorLeyenda) return;

  contenedorLeyenda.innerHTML = '';

  // Mapa para no repetir entradas de la misma categoría
  const entradas = {};

  bloques.forEach(bloque => {
    const clave = bloque.tipo === 'so'
      ? 'SO'
      : bloque.tipo === 'libre'
        ? 'Libre'
        : bloque.id;

    if (entradas[clave]) return; // Ya fue añadida
    entradas[clave] = true;

    const colorPunto = bloque.tipo === 'so'
      ? 'var(--color-so)'
      : bloque.tipo === 'libre'
        ? 'var(--color-libre)'
        : bloque.color;

    const item = document.createElement('div');
    item.className = 'leyenda-item';
    item.innerHTML = `
      <div class="leyenda-punto" style="background:${colorPunto}"></div>
      ${clave}
    `;
    contenedorLeyenda.appendChild(item);
  });
}

/**
 * Actualiza el selector de procesos para liberar memoria.
 * Solo muestra los procesos actualmente asignados en memoria.
 *
 * @param {Array}  bloques    - Estado actual de la memoria
 * @param {string} selectorId - ID del elemento <select>
 */
export function actualizarSelectorLiberar(bloques, selectorId) {
  const selector = document.getElementById(selectorId);
  if (!selector) return;

  selector.innerHTML = '<option value="">Liberar proceso...</option>';

  bloques
    .filter(b => b.tipo === 'proceso')
    .forEach(b => {
      const opcion = document.createElement('option');
      opcion.value       = b.id;
      opcion.textContent = `${b.id} (${b.tamanio}KB)`;
      selector.appendChild(opcion);
    });
}
