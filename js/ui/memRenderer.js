// ui/memRenderer.js — Renderizador del mapa de memoria vertical
// Rediseño: colores claros para bloques libres, gradientes vivos para procesos
// Optimizado: usa DocumentFragment para evitar reflows por bloque

export const PALETA_GRADIENTES = [
  ['#059669','#34d399'],
  ['#0891b2','#22d3ee'],
  ['#d97706','#fbbf24'],
  ['#dc2626','#f87171'],
  ['#0d7ea8','#38bdf8'],
  ['#db2777','#f472b6'],
  ['#65a30d','#a3e635'],
  ['#0284c7','#60a5fa'],
  ['#ea580c','#fb923c'],
  ['#0d9488','#2dd4bf'],
];

export const PALETA_SOLIDA = PALETA_GRADIENTES.map(p => p[0]);

const mapaGradientes = new Map();
let contadorGrad = 0;

export function obtenerColorSolido(id) {
  if (!mapaGradientes.has(id)) {
    mapaGradientes.set(id, contadorGrad % PALETA_GRADIENTES.length);
    contadorGrad++;
  }
  return PALETA_SOLIDA[mapaGradientes.get(id)];
}

function obtenerGradienteCSS(id) {
  if (!mapaGradientes.has(id)) {
    mapaGradientes.set(id, contadorGrad % PALETA_GRADIENTES.length);
    contadorGrad++;
  }
  const [c1, c2] = PALETA_GRADIENTES[mapaGradientes.get(id)];
  return `linear-gradient(135deg,${c1},${c2})`;
}

export function resetColoresMemoria() {
  mapaGradientes.clear();
  contadorGrad = 0;
}

export function renderizarMapaMemoria(bloques, memoriaTotal, indiceResaltado = -1, animar = false) {
  const contenedor = document.getElementById('mapaMemo');
  if (!contenedor) return;

  const alturaContenedor = Math.max(460, bloques.length * 56);
  contenedor.style.height = alturaContenedor + 'px';

  const fragment = document.createDocumentFragment();

  bloques.forEach((bloque, indice) => {
    const porcentaje = (bloque.tamanio / memoriaTotal) * 100;
    const alturaMin  = 40;
    const altura     = Math.max(alturaMin, (porcentaje / 100) * alturaContenedor);

    let colorFondo;
    if (bloque.tipo === 'so') {
      colorFondo = 'linear-gradient(135deg,#334155,#1e293b)';
    } else if (bloque.tipo === 'libre') {
      colorFondo = 'linear-gradient(135deg,#f0f4f8,#e2e8f0)';
    } else {
      colorFondo = obtenerGradienteCSS(bloque.id);
    }

    const elBloque = document.createElement('div');
    elBloque.className = 'bloque-mem';

    const borderStyle = bloque.tipo === 'libre'
      ? 'border: 1.5px dashed #cbd5e1;'
      : '';

    elBloque.style.cssText = `
      background: ${colorFondo};
      height: ${altura}px;
      flex-shrink: 0;
      ${borderStyle}
    `;
    elBloque.setAttribute('data-indice', indice);

    if (indice === indiceResaltado) {
      elBloque.classList.add('resaltado');
      if (animar) elBloque.classList.add('entrando');
    }

    const mostrarCompleto = altura >= 58;
    const mostrarMinimo   = altura >= 38;

    const esLibre = bloque.tipo === 'libre';
    const esSO    = bloque.tipo === 'so';

    const etiquetaTipo = esSO ? 'S.O.' : esLibre ? 'Libre' : bloque.id;
    const textColor    = esLibre ? '#64748b' : '#fff';
    const textShadow   = esLibre ? 'none' : '0 1px 4px rgba(0,0,0,.4)';

    let htmlInterno = '';
    if (mostrarMinimo) {
      htmlInterno += `
        <div class="bloque-nombre" style="font-size:${altura > 80 ? 18 : 14}px;color:${textColor};text-shadow:${textShadow}">
          ${esc(etiquetaTipo)}
        </div>
      `;
    }
    if (mostrarCompleto) {
      htmlInterno += `
        <div class="bloque-tamanio" style="color:${esLibre ? '#64748b' : 'rgba(255,255,255,.9)'}">
          ${bloque.tamanio}KB
        </div>
      `;
      if (bloque.inicio !== undefined) {
        htmlInterno += `
          <div class="bloque-rango" style="color:${esLibre ? '#94a3b8' : 'rgba(255,255,255,.7)'}">
            ${bloque.inicio}K\u2013${bloque.inicio + bloque.tamanio - 1}K
          </div>
        `;
      }
      if (bloque.tipo === 'proceso' && bloque.fragmentacionInterna > 0) {
        htmlInterno += `<div class="bloque-frag">Frag: ${bloque.fragmentacionInterna}KB</div>`;
      }
    }

    const tipoLabel = esSO ? 'Sistema Operativo' : esLibre ? 'Libre' : 'Proceso';
    htmlInterno += `
      <div class="bloque-tooltip">
        <strong>${esc(etiquetaTipo)}</strong><br/>
        Tipo: ${esc(tipoLabel)}<br/>
        Tama\u00f1o: ${bloque.tamanio}KB<br/>
        Dir. inicio: ${bloque.inicio}KB<br/>
        Dir. fin: ${bloque.inicio + (bloque.tamanioParticion || bloque.tamanio) - 1}KB
        ${bloque.tipo === 'proceso' && bloque.fragmentacionInterna > 0
          ? `<br/>Frag. interna: ${bloque.fragmentacionInterna}KB`
          : ''}
        ${bloque.tipo === 'proceso' && bloque.tamanioParticion
          ? `<br/>Partici\u00f3n: ${bloque.tamanioParticion}KB`
          : ''}
      </div>
    `;

    elBloque.innerHTML = htmlInterno;
    fragment.appendChild(elBloque);
  });

  contenedor.replaceChildren(fragment);

  const subTitulo = document.getElementById('subtituloMem');
  if (subTitulo) {
    subTitulo.textContent = `${memoriaTotal}KB \u00b7 ${bloques.length} bloque(s)`;
  }
}

export function renderizarLeyenda(bloques) {
  const contenedorLeyenda = document.getElementById('leyendaMem');
  if (!contenedorLeyenda) return;

  contenedorLeyenda.innerHTML = '';
  const entradas = {};

  bloques.forEach(bloque => {
    const clave = bloque.tipo === 'so' ? 'SO' : bloque.tipo === 'libre' ? 'Libre' : bloque.id;
    if (entradas[clave]) return;
    entradas[clave] = true;

    let colorPunto;
    if (bloque.tipo === 'so') {
      colorPunto = '#334155';
    } else if (bloque.tipo === 'libre') {
      colorPunto = '#cbd5e1';
    } else {
      const grad = obtenerGradienteCSS(bloque.id);
      const match = grad.match(/#[0-9a-f]{6}/i);
      colorPunto = match ? match[0] : '#4f46e5';
    }

    const item = document.createElement('div');
    item.className = 'leyenda-item';
    item.innerHTML = `
      <div class="leyenda-punto" style="background:${colorPunto};box-shadow:0 1px 3px ${colorPunto}55"></div>
      ${esc(clave)}
    `;
    contenedorLeyenda.appendChild(item);
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
