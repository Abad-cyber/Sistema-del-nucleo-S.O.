// ═══════════════════════════════════════════════════════
// parser.js — Módulo de lectura y parseo de datos de entrada
// Lee archivos CSV/TXT o la tabla manual del dashboard
// ═══════════════════════════════════════════════════════

// Paleta de colores para asignar a cada proceso
const PALETA_COLORES = [
  '#5c2d91', '#e05c1a', '#1a7a4a', '#2563eb', '#b91c1c',
  '#0891b2', '#7c3aed', '#c2410c', '#059669', '#1d4ed8',
  '#9333ea', '#ea580c', '#10b981', '#3b82f6', '#ef4444',
  '#06b6d4', '#8b5cf6', '#f97316', '#34d399', '#60a5fa',
];

/**
 * Parsea texto plano CSV o TXT y retorna un array de procesos.
 * Formato esperado por línea: proceso, llegada, ejecucion, tamaño_KB
 * Separadores aceptados: coma, punto y coma, tabulación
 *
 * @param {string} texto - Contenido del archivo como string
 * @returns {Array} Lista de objetos proceso
 */
export function parsearTexto(texto) {
  const lineas = texto
    .trim()
    .split(/\r?\n/)
    .map(l => l.trim())
    // Ignorar líneas vacías y comentarios (#, //)
    .filter(l => l && !l.startsWith('#') && !l.startsWith('//'));

  const procesos = [];

  for (const linea of lineas) {
    // Separar por coma, punto y coma o tabulación
    const partes = linea.split(/[,;\t]+/).map(p => p.trim());

    const nombre   = partes[0];
    const llegada  = parseInt(partes[1]);
    const ejecucion = parseInt(partes[2]);
    const tamanioKB = parseInt(partes[3]);

    // Validar que los campos numéricos sean válidos
    if (!nombre) continue;
    if (isNaN(llegada) || isNaN(ejecucion) || isNaN(tamanioKB)) continue;
    if (ejecucion <= 0 || tamanioKB <= 0) continue;

    procesos.push({
      id:         nombre,
      llegada:    llegada,
      ejecucion:  ejecucion,
      tamanioKB:  tamanioKB,
      color:      PALETA_COLORES[procesos.length % PALETA_COLORES.length],
      // Campos que se calcularán después por los algoritmos
      tiempoEspera:    0,
      tiempoRetorno:   0,
      tiempoRespuesta: 0,
      inicio:          -1,
      fin:             -1,
    });
  }

  return procesos;
}

/**
 * Lee la tabla de procesos editable del DOM y retorna el array de procesos.
 * Se usa cuando el usuario ingresa los datos manualmente.
 * Detecta IDs duplicados y muestra un toast de advertencia.
 *
 * @returns {Array} Lista de objetos proceso
 */
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
    const llegada   = parseInt(inpLlegada.value);
    const ejecucion = parseInt(inpEjecucion.value);
    const tamanioKB = parseInt(inpTamanio.value);

    // Validaciones básicas
    if (!nombre) return;
    if (isNaN(llegada) || isNaN(ejecucion) || isNaN(tamanioKB)) return;
    if (ejecucion <= 0 || tamanioKB <= 0) return;

    // Detectar ID duplicado
    if (idsVistos.has(nombre)) {
      idsDuplicados.add(nombre);
      return; // Ignorar la fila duplicada
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

  // Avisar al usuario si había IDs duplicados
  if (idsDuplicados.size > 0) {
    const lista = [...idsDuplicados].join(', ');
    // Usar el toast global si está disponible, si no, console.warn
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = `⚠️ IDs duplicados ignorados: ${lista}. Corrige los nombres antes de simular.`;
      toast.className = 'visible error';
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => { toast.className = ''; }, 4500);
    } else {
      console.warn(`IDs duplicados ignorados: ${lista}`);
    }
  }

  return procesos;
}

/**
 * Sincroniza la tabla editable del DOM con un array de procesos.
 * Se usa cuando se carga un archivo para llenar la tabla visual.
 *
 * @param {Array}    procesos  - Lista de procesos parseados
 * @param {Function} [onDelete] - Callback opcional para el botón ✕ de cada fila
 */
export function sincronizarTablaDOM(procesos, onDelete) {
  const cuerpo = document.getElementById('cuerpoTablaEntrada');
  cuerpo.innerHTML = '';

  procesos.forEach((proc, indice) => {
    cuerpo.appendChild(crearFilaTabla(indice, proc.id, proc.llegada, proc.ejecucion, proc.tamanioKB));
  });

  // Actualizar el callback del delegador (ya instalado por asignarEventosFilas)
  // Si por algún motivo aún no se instaló (llamada fuera de orden), instalarlo ahora.
  asignarEventosFilas(onDelete);
}

/**
 * Crea una fila <tr> para la tabla de entrada de procesos.
 *
 * @param {number} indice     - Índice de la fila
 * @param {string} id         - Nombre del proceso
 * @param {number} llegada    - Tiempo de llegada
 * @param {number} ejecucion  - Tiempo de ejecución
 * @param {number} tamanioKB  - Tamaño en KB
 * @returns {HTMLElement} Elemento <tr>
 */
export function crearFilaTabla(indice, id = '', llegada = 0, ejecucion = 1, tamanioKB = 64) {
  const fila = document.createElement('tr');
  fila.dataset.fila = indice;
  fila.innerHTML = `
    <td><input type="text"   class="celda-inp" data-col="id"       value="${id}"        placeholder="P${indice + 1}"/></td>
    <td><input type="number" class="celda-inp" data-col="llegada"  value="${llegada}"   min="0"/></td>
    <td><input type="number" class="celda-inp" data-col="ejecucion" value="${ejecucion}" min="1"/></td>
    <td><input type="number" class="celda-inp" data-col="tamanio"  value="${tamanioKB}" min="1"/></td>
    <td><button class="btn-eliminar-fila" title="Eliminar">✕</button></td>
  `;
  return fila;
}

/**
 * Inicializa la delegación de eventos en el tbody para los botones de eliminar fila.
 * Se llama UNA SOLA VEZ al arrancar la tabla (no por cada fila añadida),
 * evitando listeners duplicados y memory leaks.
 *
 * @param {Function} [onDelete] - Callback opcional llamado tras eliminar una fila.
 */
export function asignarEventosFilas(onDelete) {
  const cuerpo = document.getElementById('cuerpoTablaEntrada');
  if (!cuerpo) return;

  // Guardar el callback en el elemento para que la delegación lo use
  // sin necesidad de volver a registrar un listener nuevo cada vez.
  cuerpo._onDeleteFila = onDelete;

  // Si ya tiene el delegador instalado, no añadir otro
  if (cuerpo._delegadorInstalado) return;
  cuerpo._delegadorInstalado = true;

  cuerpo.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-eliminar-fila');
    if (!btn) return;
    btn.closest('tr').remove();
    if (typeof cuerpo._onDeleteFila === 'function') cuerpo._onDeleteFila();
  });
}

// Exportar paleta para uso en otros módulos
export { PALETA_COLORES };
