// ═══════════════════════════════════════════════════════
// memoria/algoritmos.js — Algoritmos de gestión de memoria
// Incluye: First Fit, Best Fit, Worst Fit y Buddy System
// ═══════════════════════════════════════════════════════

// Colores fijos para SO y huecos libres
const COLOR_SO   = '#374151';
const COLOR_LIBRE = '#f8b4b4'; // rosa salmón (como en la imagen de referencia)

/**
 * Construye el estado INICIAL de la memoria según la política elegida.
 * El SO ocupa la parte superior (inicio), seguido de los huecos libres.
 *
 * @param {number}   memoriaTotal     - KB totales de la RAM
 * @param {number}   memoriaSOReservado - KB reservados para el SO
 * @param {string}   politica         - 'dinamica' o 'fija'
 * @param {number[]} tamaniosFijos    - Tamaños de particiones fijas (solo para 'fija')
 * @returns {Array} Lista de bloques iniciales de memoria
 */
export function construirMemoriaInicial(memoriaTotal, memoriaSOReservado, politica, tamaniosFijos = []) {
  const bloques = [];

  // Bloque del Sistema Operativo (siempre al inicio / arriba)
  if (memoriaSOReservado > 0) {
    bloques.push({
      id:     'SO',
      tipo:   'so',
      inicio: 0,
      tamanio: memoriaSOReservado,
      color:  COLOR_SO,
    });
  }

  if (politica === 'fija') {
    // Particiones de tamaño predefinido
    let cursor = memoriaSOReservado;
    tamaniosFijos.forEach((tam, i) => {
      bloques.push({
        id:      `H${i + 1}`,
        tipo:    'libre',
        inicio:  cursor,
        tamanio: tam,
        color:   COLOR_LIBRE,
      });
      cursor += tam;
    });
    // Si sobra espacio después de las particiones fijas
    const restante = memoriaTotal - cursor;
    if (restante > 0) {
      bloques.push({
        id:      `H${tamaniosFijos.length + 1}`,
        tipo:    'libre',
        inicio:  cursor,
        tamanio: restante,
        color:   COLOR_LIBRE,
      });
    }
  } else {
    // Política dinámica: un solo bloque libre grande
    bloques.push({
      id:      'H1',
      tipo:    'libre',
      inicio:  memoriaSOReservado,
      tamanio: memoriaTotal - memoriaSOReservado,
      color:   COLOR_LIBRE,
    });
  }

  return bloques;
}

// ───────────────────────────────────────────────────────
// FIRST FIT — Primer Ajuste
// ───────────────────────────────────────────────────────

/**
 * Asigna memoria usando First Fit:
 * recorre los bloques de arriba hacia abajo y asigna el PRIMERO
 * que sea suficientemente grande.
 *
 * @param {Object} proceso  - Proceso a asignar {id, tamanioKB, color}
 * @param {Array}  memoria  - Estado actual de la memoria (se muta)
 * @returns {Object} { exito, descripcion, fragmentacionInterna }
 */
export function firstFit(proceso, memoria) {
  for (let i = 0; i < memoria.length; i++) {
    const bloque = memoria[i];
    if (bloque.tipo !== 'libre') continue;
    if (bloque.tamanio < proceso.tamanioKB) continue;

    // Hueco encontrado — asignar
    return asignarEnBloque(proceso, memoria, i);
  }

  return {
    exito:       false,
    descripcion: `No hay hueco libre ≥ ${proceso.tamanioKB}KB. Proceso ${proceso.id} rechazado.`,
    fragmentacionInterna: 0,
  };
}

// ───────────────────────────────────────────────────────
// BEST FIT — Mejor Ajuste
// ───────────────────────────────────────────────────────

/**
 * Asigna memoria usando Best Fit:
 * busca el hueco libre MÁS PEQUEÑO que sea suficiente.
 * Minimiza la fragmentación interna por asignación.
 *
 * @param {Object} proceso  - Proceso a asignar
 * @param {Array}  memoria  - Estado actual de la memoria
 * @returns {Object} Resultado de la asignación
 */
export function bestFit(proceso, memoria) {
  // Filtrar huecos válidos y seleccionar el más pequeño
  const candidatos = memoria
    .map((b, indice) => ({ ...b, indice }))
    .filter(b => b.tipo === 'libre' && b.tamanio >= proceso.tamanioKB);

  if (candidatos.length === 0) {
    return {
      exito:       false,
      descripcion: `No hay hueco libre ≥ ${proceso.tamanioKB}KB. Proceso ${proceso.id} rechazado.`,
      fragmentacionInterna: 0,
    };
  }

  // El mejor ajuste es el hueco con menor tamaño suficiente
  const mejor = candidatos.reduce((min, b) => b.tamanio < min.tamanio ? b : min);
  return asignarEnBloque(proceso, memoria, mejor.indice);
}

// ───────────────────────────────────────────────────────
// WORST FIT — Peor Ajuste
// ───────────────────────────────────────────────────────

/**
 * Asigna memoria usando Worst Fit:
 * asigna el hueco libre MÁS GRANDE disponible.
 * El residuo que deja es el más grande posible.
 *
 * @param {Object} proceso  - Proceso a asignar
 * @param {Array}  memoria  - Estado actual de la memoria
 * @returns {Object} Resultado de la asignación
 */
export function worstFit(proceso, memoria) {
  const candidatos = memoria
    .map((b, indice) => ({ ...b, indice }))
    .filter(b => b.tipo === 'libre' && b.tamanio >= proceso.tamanioKB);

  if (candidatos.length === 0) {
    return {
      exito:       false,
      descripcion: `No hay hueco libre ≥ ${proceso.tamanioKB}KB. Proceso ${proceso.id} rechazado.`,
      fragmentacionInterna: 0,
    };
  }

  // El peor ajuste es el hueco con mayor tamaño
  const peor = candidatos.reduce((max, b) => b.tamanio > max.tamanio ? b : max);
  return asignarEnBloque(proceso, memoria, peor.indice);
}

// ───────────────────────────────────────────────────────
// BUDDY SYSTEM — Algoritmo de los Gemelos
// ───────────────────────────────────────────────────────

/**
 * Calcula la siguiente potencia de 2 mayor o igual a n.
 * Ejemplo: nextPow2(70) → 128, nextPow2(128) → 128
 */
function siguientePotencia2(n) {
  let potencia = 1;
  while (potencia < n) potencia *= 2;
  return potencia;
}

/**
 * Asigna memoria usando el Buddy System.
 * La memoria disponible es una potencia de 2.
 * Divide bloques en mitades hasta llegar al tamaño exacto necesario.
 *
 * @param {Object} proceso   - Proceso a asignar
 * @param {Array}  memoria   - Estado actual de la memoria
 * @param {Array}  pasos     - Array donde se registran los pasos de división
 * @returns {Object} Resultado de la asignación
 */
export function buddySystem(proceso, memoria, pasos = []) {
  // Calcular tamaño requerido redondeado a potencia de 2
  const tamanioNecesario = siguientePotencia2(proceso.tamanioKB);

  // Buscar el bloque libre más pequeño que sea ≥ tamanioNecesario
  const candidatos = memoria
    .map((b, indice) => ({ ...b, indice }))
    .filter(b => b.tipo === 'libre' && b.tamanio >= tamanioNecesario)
    .sort((a, b) => a.tamanio - b.tamanio);

  if (candidatos.length === 0) {
    return {
      exito:       false,
      descripcion: `Buddy: necesita ${tamanioNecesario}KB (2^n ≥ ${proceso.tamanioKB}KB). Sin espacio. ${proceso.id} rechazado.`,
      fragmentacionInterna: 0,
    };
  }

  let objetivo = candidatos[0];

  // Dividir el bloque en gemelos hasta llegar al tamaño exacto
  while (objetivo.tamanio > tamanioNecesario) {
    const mitad = objetivo.tamanio / 2;
    const idx   = memoria.findIndex(b => b.inicio === objetivo.inicio && b.tipo === 'libre');

    // Reemplazar el bloque por dos gemelos de la mitad
    const gemelo1 = { id: `H${objetivo.inicio}`,        tipo: 'libre', inicio: objetivo.inicio,        tamanio: mitad, color: COLOR_LIBRE };
    const gemelo2 = { id: `H${objetivo.inicio + mitad}`, tipo: 'libre', inicio: objetivo.inicio + mitad, tamanio: mitad, color: COLOR_LIBRE };
    memoria.splice(idx, 1, gemelo1, gemelo2);

    pasos.push({
      tipo:        'buddy',
      descripcion: `División: bloque de ${objetivo.tamanio}KB → 2 gemelos de ${mitad}KB (@${objetivo.inicio}KB y @${objetivo.inicio + mitad}KB).`,
    });

    // Continuar con el primer gemelo
    objetivo = { ...gemelo1, indice: idx };
  }

  // Asignar el bloque exacto
  const idxFinal = memoria.findIndex(b => b.inicio === objetivo.inicio && b.tipo === 'libre');
  return asignarEnBloque(proceso, memoria, idxFinal);
}

/**
 * Libera el bloque de un proceso y fusiona gemelos adyacentes (solo Buddy).
 *
 * @param {string} idProceso - ID del proceso a liberar
 * @param {Array}  memoria   - Estado actual de la memoria
 * @param {Array}  pasos     - Registro de pasos
 * @returns {Object} { exito, descripcion }
 */
export function buddyLiberar(idProceso, memoria, pasos = []) {
  const idx = memoria.findIndex(b => b.id === idProceso && b.tipo === 'proceso');
  if (idx === -1) return { exito: false, descripcion: 'Proceso no encontrado.' };

  const bloque = memoria[idx];
  memoria[idx] = { id: `H${bloque.inicio}`, tipo: 'libre', inicio: bloque.inicio, tamanio: bloque.tamanio, color: COLOR_LIBRE };

  pasos.push({ tipo: 'libre', descripcion: `${idProceso} liberado. Bloque de ${bloque.tamanio}KB en @${bloque.inicio}KB marcado libre.` });

  // Fusionar gemelos mientras sea posible
  let fusionado = true;
  while (fusionado) {
    fusionado = false;
    for (let i = 0; i < memoria.length - 1; i++) {
      const a = memoria[i];
      const b = memoria[i + 1];
      if (a.tipo !== 'libre' || b.tipo !== 'libre') continue;
      if (a.tamanio !== b.tamanio) continue;
      // Son gemelos si a.inicio es múltiplo de 2*tamanio
      if (a.inicio % (a.tamanio * 2) !== 0) continue;
      if (a.inicio + a.tamanio !== b.inicio) continue;

      const bloqueUnido = { id: `H${a.inicio}`, tipo: 'libre', inicio: a.inicio, tamanio: a.tamanio * 2, color: COLOR_LIBRE };
      memoria.splice(i, 2, bloqueUnido);
      pasos.push({ tipo: 'compact', descripcion: `Fusión: gemelos @${a.inicio}KB (${a.tamanio}KB) + @${b.inicio}KB (${b.tamanio}KB) → ${bloqueUnido.tamanio}KB.` });
      fusionado = true;
      break;
    }
  }

  return { exito: true, descripcion: `Proceso ${idProceso} liberado correctamente.` };
}

// ───────────────────────────────────────────────────────
// FUNCIONES COMPARTIDAS
// ───────────────────────────────────────────────────────

/**
 * Asigna el proceso en el bloque indicado por índice.
 * Si sobra espacio, crea un hueco libre con el residuo.
 *
 * @param {Object} proceso  - Proceso a asignar
 * @param {Array}  memoria  - Estado actual de la memoria (se muta)
 * @param {number} indice   - Índice del bloque donde asignar
 * @returns {Object} Resultado de la asignación con métricas
 */
function asignarEnBloque(proceso, memoria, indice) {
  const bloque = memoria[indice];
  const fragmentacionInterna = bloque.tamanio - proceso.tamanioKB;

  // Crear bloque asignado al proceso
  const bloqueAsignado = {
    id:                   proceso.id,
    tipo:                 'proceso',
    inicio:               bloque.inicio,
    tamanio:              proceso.tamanioKB,
    tamanioParticion:     bloque.tamanio,
    color:                proceso.color,
    fragmentacionInterna: fragmentacionInterna,
  };

  // Si hay fragmentación interna, crear hueco libre con el residuo
  const reemplazo = [bloqueAsignado];
  if (fragmentacionInterna > 0) {
    reemplazo.push({
      id:      `H${bloque.inicio + proceso.tamanioKB}`,
      tipo:    'libre',
      inicio:  bloque.inicio + proceso.tamanioKB,
      tamanio: fragmentacionInterna,
      color:   COLOR_LIBRE,
    });
  }

  memoria.splice(indice, 1, ...reemplazo);

  return {
    exito:                true,
    inicio:               bloqueAsignado.inicio,
    tamanioParticion:     bloque.tamanio,
    fragmentacionInterna: fragmentacionInterna,
    descripcion: `${proceso.id} asignado en @${bloqueAsignado.inicio}KB (partición ${bloque.tamanio}KB). Fragmentación interna: ${fragmentacionInterna}KB.`,
  };
}

/**
 * Libera un proceso de memoria (para FF, BF, WF).
 * Deja su bloque como libre y fusiona huecos adyacentes.
 *
 * @param {string} idProceso - ID del proceso a liberar
 * @param {Array}  memoria   - Estado actual de la memoria
 * @returns {Object} { exito, descripcion }
 */
export function liberarProceso(idProceso, memoria) {
  const idx = memoria.findIndex(b => b.id === idProceso && b.tipo === 'proceso');
  if (idx === -1) return { exito: false, descripcion: `Proceso ${idProceso} no encontrado.` };

  const bloque = memoria[idx];
  memoria[idx] = {
    id:      `H${bloque.inicio}`,
    tipo:    'libre',
    inicio:  bloque.inicio,
    tamanio: bloque.tamanio,
    color:   COLOR_LIBRE,
  };

  // Fusionar huecos libres adyacentes (coalescencia)
  fusionarHuecosAdyacentes(memoria);

  return {
    exito:       true,
    descripcion: `Proceso ${idProceso} liberado. ${bloque.tamanio}KB en @${bloque.inicio}KB ahora libre.`,
  };
}

/**
 * Fusiona bloques libres adyacentes en la memoria.
 * Se aplica después de liberar un proceso.
 *
 * @param {Array} memoria - Estado de la memoria (se muta)
 */
function fusionarHuecosAdyacentes(memoria) {
  let i = 0;
  while (i < memoria.length - 1) {
    if (memoria[i].tipo === 'libre' && memoria[i + 1].tipo === 'libre') {
      const fusionado = {
        id:      `H${memoria[i].inicio}`,
        tipo:    'libre',
        inicio:  memoria[i].inicio,
        tamanio: memoria[i].tamanio + memoria[i + 1].tamanio,
        color:   COLOR_LIBRE,
      };
      memoria.splice(i, 2, fusionado);
      // No incrementar i para revisar nuevamente
    } else {
      i++;
    }
  }
}

/**
 * Compactación de memoria: mueve todos los procesos al inicio
 * (después del SO) y deja un único bloque libre al final.
 *
 * @param {Array} memoria - Estado actual de la memoria
 * @returns {Object} { nuevaMemoria, kbCompactados }
 */
export function compactarMemoria(memoria) {
  const bloquesSO      = memoria.filter(b => b.tipo === 'so');
  const bloquesProceso = memoria.filter(b => b.tipo === 'proceso');
  const bloquesLibres  = memoria.filter(b => b.tipo === 'libre');

  const kbLibresTotales = bloquesLibres.reduce((s, b) => s + b.tamanio, 0);
  const finSO = bloquesSO.reduce((s, b) => s + b.tamanio, 0);

  // Reubicar procesos consecutivamente después del SO
  let cursor = finSO;
  const procesosCompactados = bloquesProceso.map(b => {
    const nuevoProceso = { ...b, inicio: cursor };
    cursor += b.tamanio;
    return nuevoProceso;
  });

  // Un solo bloque libre al final
  const nuevaMemoria = [
    ...bloquesSO,
    ...procesosCompactados,
  ];

  if (kbLibresTotales > 0) {
    nuevaMemoria.push({
      id:      `H${cursor}`,
      tipo:    'libre',
      inicio:  cursor,
      tamanio: kbLibresTotales,
      color:   COLOR_LIBRE,
    });
  }

  return { nuevaMemoria, kbCompactados: kbLibresTotales };
}

/**
 * Calcula las métricas del estado actual de la memoria.
 *
 * @param {Array}  memoria      - Estado actual de la memoria
 * @param {number} memoriaTotal - KB totales de la RAM
 * @returns {Object} Métricas de memoria
 */
export function calcularMetricasMemoria(memoria, memoriaTotal) {
  const bloquesProceso = memoria.filter(b => b.tipo === 'proceso');
  const bloquesLibres  = memoria.filter(b => b.tipo === 'libre');
  const bloquesSO      = memoria.filter(b => b.tipo === 'so');

  const kbUsados      = bloquesProceso.reduce((s, b) => s + b.tamanio, 0);
  const fragInterna   = bloquesProceso.reduce((s, b) => s + (b.fragmentacionInterna || 0), 0);
  const fragExterna   = bloquesLibres.reduce((s, b)  => s + b.tamanio, 0);
  const kbSO          = bloquesSO.reduce((s, b) => s + b.tamanio, 0);
  const memoriaUsable = memoriaTotal - kbSO;
  const porcentajeUso = memoriaUsable > 0
    ? ((kbUsados / memoriaUsable) * 100).toFixed(1)
    : '0.0';

  return {
    kbUsados,
    fragInterna,
    fragExterna,
    porcentajeUso,
    procesosAsignados:  bloquesProceso.length,
    huecos:             bloquesLibres.length,
  };
}
