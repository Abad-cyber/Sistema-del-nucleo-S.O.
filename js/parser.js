// parser.js — Módulo de lectura y parseo de datos de entrada
// Lee archivos CSV/TXT o la tabla manual del dashboard

const PALETA_COLORES = [
  '#059669', '#0891b2', '#d97706', '#dc2626', '#0d7ea8',
  '#db2777', '#65a30d', '#0284c7', '#ea580c', '#0d9488',
];

export function parsearTexto(texto) {
  const lineas = texto
    .trim()
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('//'));

  const procesos = [];

  for (const linea of lineas) {
    const partes = linea.split(/[,;\t]+/).map(p => p.trim());
    const nombre    = partes[0];
    const llegada   = parseInt(partes[1]);
    const ejecucion = parseInt(partes[2]);
    const tamanioKB = parseInt(partes[3]);

    if (!nombre) continue;
    if (isNaN(llegada) || isNaN(ejecucion) || isNaN(tamanioKB)) continue;
    if (llegada < 0 || ejecucion <= 0 || tamanioKB <= 0) continue;

    procesos.push({
      id:         nombre,
      llegada:    llegada,
      ejecucion:  ejecucion,
      tamanioKB:  tamanioKB,
      color:      PALETA_COLORES[procesos.length % PALETA_COLORES.length],
      tiempoEspera:    0,
      tiempoRetorno:   0,
      tiempoRespuesta: 0,
      inicio:          -1,
      fin:             -1,
    });
  }

  return procesos;
}

export function leerTablaManual() {
  const filas = document.querySelectorAll('#cuerpoTablaEntrada tr');
  const procesos = [];
  const idsVistos = new Set();
  const idsDuplicados = new Set();

  filas.forEach((fila) => {
    const inpNombre    = fila.querySelector('[data-col="id"]');
    const inpLlegada   = fila.querySelector('[data-col="llegada"]');
    const inpEjecucion = fila.querySelector('[data-col="ejecucion"]');
    const inpTamanio   = fila.querySelector('[data-col="tamanio"]');

    if (!inpNombre || !inpLlegada || !inpEjecucion || !inpTamanio) return;

    const nombre    = inpNombre.value.trim();
    let llegada     = parseInt(inpLlegada.value);
    let ejecucion   = parseInt(inpEjecucion.value);
    let tamanioKB   = parseInt(inpTamanio.value);

    if (!nombre) return;
    if (isNaN(llegada) || isNaN(ejecucion) || isNaN(tamanioKB)) return;
    if (llegada < 0 || ejecucion <= 0 || tamanioKB <= 0) return;

    if (idsVistos.has(nombre)) {
      idsDuplicados.add(nombre);
      return;
    }
    idsVistos.add(nombre);

    procesos.push({
      id:         nombre,
      llegada:    llegada,
      ejecucion:  ejecucion,
      tamanioKB:  tamanioKB,
      color:      PALETA_COLORES[procesos.length % PALETA_COLORES.length],
      tiempoEspera:    0,
      tiempoRetorno:   0,
      tiempoRespuesta: 0,
      inicio:          -1,
      fin:             -1,
    });
  });

  if (idsDuplicados.size > 0) {
    const lista = [...idsDuplicados].join(', ');
    window.crearToastGlobo(`IDs duplicados ignorados: ${lista}. Corrige los nombres antes de simular.`, 'error');
  }

  return procesos;
}

export function sincronizarTablaDOM(procesos, onDelete) {
  const cuerpo = document.getElementById('cuerpoTablaEntrada');
  cuerpo.innerHTML = '';
  procesos.forEach((proc, indice) => {
    cuerpo.appendChild(crearFilaTabla(indice, proc.id, proc.llegada, proc.ejecucion, proc.tamanioKB));
  });
  asignarEventosFilas(onDelete);
}

export function crearFilaTabla(indice, id = '', llegada = 0, ejecucion = 1, tamanioKB = 64) {
  const escapeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  const fila = document.createElement('tr');
  fila.dataset.fila = indice;
  fila.innerHTML = `
    <td><input type="text"   class="celda-inp" data-col="id"       value="${escapeHTML(String(id))}"        placeholder="P${indice + 1}" aria-label="Nombre del proceso"/></td>
    <td><input type="number" class="celda-inp" data-col="llegada"  value="${llegada}"   min="0" aria-label="Tiempo de llegada"/></td>
    <td><input type="number" class="celda-inp" data-col="ejecucion" value="${ejecucion}" min="1" aria-label="Tiempo de ejecuci\u00f3n"/></td>
    <td><input type="number" class="celda-inp" data-col="tamanio"  value="${tamanioKB}" min="1" aria-label="Tama\u00f1o en KB"/></td>
    <td><button class="btn-eliminar-fila" title="Eliminar proceso" aria-label="Eliminar proceso">✕</button></td>
  `;
  return fila;
}

export function asignarEventosFilas(onDelete) {
  const cuerpo = document.getElementById('cuerpoTablaEntrada');
  if (!cuerpo) return;
  cuerpo._onDeleteFila = onDelete;
  if (cuerpo._delegadorInstalado) return;
  cuerpo._delegadorInstalado = true;

  cuerpo.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-eliminar-fila');
    if (!btn) return;
    btn.closest('tr').remove();
    if (typeof cuerpo._onDeleteFila === 'function') cuerpo._onDeleteFila();
  });
}

export { PALETA_COLORES };
