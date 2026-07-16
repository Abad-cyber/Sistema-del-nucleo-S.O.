// ═══════════════════════════════════════════════════════════════════════════════
// algoritmos.js — Lógica pura de simulación de asignación de bloques en disco
// Sin dependencias del DOM. Módulo ES6.
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// Paleta de colores para archivos (se cicla si hay más archivos que colores)
// ═══════════════════════════════════════════════════════════════════════════════
export const PALETA_ARCHIVOS = [
  '#0d7ea8', '#e11d48', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#ea580c', '#2563eb', '#be123c', '#15803d'
];

// ═══════════════════════════════════════════════════════════════════════════════
// Utilidades internas
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clonar profundamente un snapshot de disco para evitar mutaciones.
 * @param {Array} snapshot - Estado actual del disco (array de bloques)
 * @returns {Array} Copia profunda del snapshot
 */
function clonarSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

/**
 * Obtener el color de la paleta para un archivo dado su índice.
 * @param {Number} indiceArchivo - Índice del archivo en la lista
 * @returns {String} Color hexadecimal
 */
function obtenerColor(indiceArchivo) {
  return PALETA_ARCHIVOS[indiceArchivo % PALETA_ARCHIVOS.length];
}

/**
 * Crear una entrada de paso (StepLog).
 * @param {String} archivo - Nombre del archivo
 * @param {String} tipo - 'ok' | 'error' | 'indice' | 'puntero'
 * @param {String} descripcion - Descripción del paso
 * @param {Array<Number>} bloquesAfectados - Bloques involucrados
 * @param {Number} lecturas - Operaciones de lectura
 * @param {Number} escrituras - Operaciones de escritura
 * @returns {Object} Entrada de StepLog
 */
function crearPaso(archivo, tipo, descripcion, bloquesAfectados, lecturas, escrituras) {
  return {
    archivo,
    tipo,
    descripcion,
    bloquesAfectados,
    lecturas,
    escrituras
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Construcción del disco inicial
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Construir un disco vacío con todos los bloques libres.
 * @param {Number} totalBloques - Número total de bloques en el disco
 * @returns {Array} Array de objetos Block, todos libres
 */
export function construirDiscoInicial(totalBloques) {
  const disco = [];
  for (let i = 0; i < totalBloques; i++) {
    disco.push({
      index: i,
      tipo: 'libre',
      archivo: null,
      puntero: null,
      indices: null,
      color: null
    });
  }
  return disco;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cálculo de métricas del disco
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcular métricas a partir de un snapshot del disco.
 * @param {Array} snapshot - Estado actual del disco
 * @param {Number} totalBloques - Número total de bloques
 * @returns {Object} DiskMetrics con estadísticas del disco
 */
export function calcularMetricasDisco(snapshot, totalBloques) {
  let bloquesOcupados = 0;
  let bloquesLibres = 0;
  const archivosSet = new Set();

  for (const bloque of snapshot) {
    if (bloque.tipo === 'libre') {
      bloquesLibres++;
    } else {
      bloquesOcupados++;
      if (bloque.archivo) {
        archivosSet.add(bloque.archivo);
      }
    }
  }

  // Fragmentación externa: contar grupos no contiguos de bloques libres
  // (cada "hueco" separado por bloques ocupados cuenta como fragmentación)
  let fragmentacionExterna = 0;
  let enHuecoLibre = false;

  for (const bloque of snapshot) {
    if (bloque.tipo === 'libre') {
      if (!enHuecoLibre) {
        fragmentacionExterna++;
        enHuecoLibre = true;
      }
    } else {
      enHuecoLibre = false;
    }
  }

  return {
    totalBloques,
    bloquesOcupados,
    bloquesLibres,
    archivosActivos: archivosSet.size,
    fragmentacionExterna,
    opsLectura: 0,
    opsEscritura: 0
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Simulación de asignación CONTIGUA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simular la asignación contigua de bloques en disco.
 * Cada archivo ocupa un rango continuo de bloques [inicio, inicio + longitud - 1].
 *
 * @param {Array<{nombre: String, inicio: Number, longitud: Number}>} archivos
 * @param {Number} totalBloques - Tamaño del disco en bloques
 * @returns {{ snapshots: Array, pasos: Array, metadatos: Array, metricas: Object }}
 */
export function simularAsignacionContigua(archivos, totalBloques, variante = 'manual') {
  const snapshots = [];
  const pasos = [];
  const metadatos = [];
  let totalLecturas = 0;
  let totalEscrituras = 0;

  // Estado inicial del disco (todos los bloques libres)
  let discoActual = construirDiscoInicial(totalBloques);

  // Guardar snapshot inicial (disco vacío)
  snapshots.push(clonarSnapshot(discoActual));

  // Procesar cada archivo
  archivos.forEach((archivo, indiceArchivo) => {
    let { nombre, inicio, longitud } = archivo;
    const color = obtenerColor(indiceArchivo);
    
    // Si la variante es First Fit o Best Fit, calcular el 'inicio'
    if (variante === 'ff' || variante === 'bf') {
      const huecos = [];
      let inicioHueco = -1;
      let tamHueco = 0;
      for (let i = 0; i < totalBloques; i++) {
        if (discoActual[i].tipo === 'libre') {
          if (inicioHueco === -1) inicioHueco = i;
          tamHueco++;
        } else {
          if (tamHueco > 0) {
            huecos.push({ inicio: inicioHueco, tamaño: tamHueco });
            inicioHueco = -1;
            tamHueco = 0;
          }
        }
      }
      if (tamHueco > 0) {
        huecos.push({ inicio: inicioHueco, tamaño: tamHueco });
      }

      const huecosSuficientes = huecos.filter(h => h.tamaño >= longitud);
      
      if (huecosSuficientes.length === 0) {
        pasos.push(crearPaso(
          nombre,
          'error',
          `Error: No hay espacio contiguo suficiente para el archivo "${nombre}" (${longitud} bloques). Variante: ${variante.toUpperCase()}.`,
          [],
          0,
          0
        ));
        snapshots.push(clonarSnapshot(discoActual));
        return; // Saltar este archivo
      }

      if (variante === 'ff') {
        inicio = huecosSuficientes[0].inicio;
      } else if (variante === 'bf') {
        huecosSuficientes.sort((a, b) => a.tamaño - b.tamaño);
        inicio = huecosSuficientes[0].inicio;
      }
    }

    const bloquesRequeridos = [];

    // Generar lista de bloques que se necesitan
    for (let i = inicio; i < inicio + longitud; i++) {
      bloquesRequeridos.push(i);
    }

    // ── Validación: rango fuera de los límites del disco ──
    const fueraDeRango = bloquesRequeridos.some(b => b < 0 || b >= totalBloques);
    if (fueraDeRango) {
      pasos.push(crearPaso(
        nombre,
        'error',
        `Error: El archivo "${nombre}" requiere bloques fuera del rango del disco (bloques ${inicio}–${inicio + longitud - 1}, disco tiene ${totalBloques} bloques).`,
        bloquesRequeridos.filter(b => b < 0 || b >= totalBloques),
        0,
        0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return; // Saltar este archivo
    }

    // ── Validación: bloques ya ocupados ──
    const bloquesOcupados = bloquesRequeridos.filter(b => discoActual[b].tipo !== 'libre');
    if (bloquesOcupados.length > 0) {
      const ocupadosPor = bloquesOcupados.map(b => `${b} (${discoActual[b].archivo})`).join(', ');
      pasos.push(crearPaso(
        nombre,
        'error',
        `Error: El archivo "${nombre}" no puede asignarse. Bloques ya ocupados: ${ocupadosPor}.`,
        bloquesOcupados,
        0,
        0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return; // Saltar este archivo
    }

    // ── Asignar bloques (Paso a paso) ──
    for (let i = 0; i < bloquesRequeridos.length; i++) {
      const bloqueIdx = bloquesRequeridos[i];
      discoActual[bloqueIdx] = {
        index: bloqueIdx,
        tipo: 'datos',
        archivo: nombre,
        puntero: null,
        indices: null,
        color
      };

      totalEscrituras += 1;

      const esUltimo = (i === bloquesRequeridos.length - 1);
      const desc = esUltimo 
        ? `Archivo "${nombre}" completado: bloque ${bloqueIdx} asignado contiguamente.`
        : `Archivo "${nombre}": asignando bloque contiguo ${bloqueIdx} de ${longitud}...`;
      
      pasos.push(crearPaso(
        nombre,
        'ok',
        desc,
        [bloqueIdx],
        0,
        1
      ));
      
      snapshots.push(clonarSnapshot(discoActual));
    }

    // Registrar metadatos
    metadatos.push({
      archivo: nombre,
      inicio,
      longitud
    });
  });

  // Calcular métricas finales
  const metricas = calcularMetricasDisco(discoActual, totalBloques);
  metricas.opsLectura = totalLecturas;
  metricas.opsEscritura = totalEscrituras;

  return { snapshots, pasos, metadatos, metricas };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Simulación de asignación ENLAZADA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simular la asignación enlazada de bloques en disco.
 * Cada archivo es una cadena de bloques donde cada uno apunta al siguiente.
 *
 * @param {Array<{nombre: String, secuencia: Array<Number>}>} archivos
 * @param {Number} totalBloques - Tamaño del disco en bloques
 * @param {Number} tamanioPuntero - Tamaño del puntero en bytes
 * @param {Number} tamanioBloque - Tamaño de cada bloque en bytes
 * @returns {{ snapshots: Array, pasos: Array, metadatos: Array, metricas: Object }}
 */
export function simularAsignacionEnlazada(archivos, totalBloques, tamanioPuntero, tamanioBloque) {
  const snapshots = [];
  const pasos = [];
  const metadatos = [];
  let totalLecturas = 0;
  let totalEscrituras = 0;

  // Datos útiles por bloque (espacio restante después del puntero)
  const datosUtilesPorBloque = tamanioBloque - tamanioPuntero;

  // Estado inicial del disco
  let discoActual = construirDiscoInicial(totalBloques);

  // Guardar snapshot inicial (disco vacío)
  snapshots.push(clonarSnapshot(discoActual));

  // Procesar cada archivo
  archivos.forEach((archivo, indiceArchivo) => {
    const { nombre, secuencia } = archivo;
    const color = obtenerColor(indiceArchivo);

    // ── Validación: secuencia vacía ──
    if (!secuencia || secuencia.length === 0) {
      pasos.push(crearPaso(
        nombre,
        'error',
        `Error: El archivo "${nombre}" tiene una secuencia vacía.`,
        [],
        0,
        0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    // ── Validación: bloques fuera de rango ──
    const fueraDeRango = secuencia.filter(b => b < 0 || b >= totalBloques);
    if (fueraDeRango.length > 0) {
      pasos.push(crearPaso(
        nombre,
        'error',
        `Error: El archivo "${nombre}" referencia bloques fuera del rango del disco: ${fueraDeRango.join(', ')}.`,
        fueraDeRango,
        0,
        0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    // ── Validación: bloques ya ocupados ──
    const bloquesOcupados = secuencia.filter(b => discoActual[b].tipo !== 'libre');
    if (bloquesOcupados.length > 0) {
      const ocupadosPor = bloquesOcupados.map(b => `${b} (${discoActual[b].archivo})`).join(', ');
      pasos.push(crearPaso(
        nombre,
        'error',
        `Error: El archivo "${nombre}" no puede asignarse. Bloques ya ocupados: ${ocupadosPor}.`,
        bloquesOcupados,
        0,
        0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    // ── Asignar bloques con punteros encadenados (Paso a paso) ──
    for (let i = 0; i < secuencia.length; i++) {
      const bloqueIdx = secuencia[i];
      const siguienteBloque = (i < secuencia.length - 1) ? secuencia[i + 1] : -1;

      discoActual[bloqueIdx] = {
        index: bloqueIdx,
        tipo: 'datos',
        archivo: nombre,
        puntero: siguienteBloque,
        indices: null,
        color
      };

      totalEscrituras += 1;

      const textoPuntero = siguienteBloque !== -1 ? `apunta al bloque ${siguienteBloque}` : `apunta a fin de archivo`;
      const esUltimo = (i === secuencia.length - 1);
      const extras = esUltimo ? ` (Datos útiles/bloque: ${datosUtilesPorBloque}B)` : '';
      const desc = `Archivo "${nombre}": asignando bloque enlazado ${bloqueIdx} (${textoPuntero}).${extras}`;
      
      pasos.push(crearPaso(
        nombre,
        'puntero',
        desc,
        [bloqueIdx],
        0,
        1
      ));
      
      snapshots.push(clonarSnapshot(discoActual));
    }

    // Registrar metadatos
    metadatos.push({
      archivo: nombre,
      inicio: secuencia[0],
      final: secuencia[secuencia.length - 1]
    });
  });

  // Calcular métricas finales
  const metricas = calcularMetricasDisco(discoActual, totalBloques);
  metricas.opsLectura = totalLecturas;
  metricas.opsEscritura = totalEscrituras;

  return { snapshots, pasos, metadatos, metricas };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Simulación de asignación INDEXADA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simular la asignación indexada de bloques en disco.
 * Cada archivo tiene un bloque índice que contiene punteros a sus bloques de datos.
 *
 * @param {Array<{nombre: String, bloqueIndice: Number, bloquesDatos: Array<Number>}>} archivos
 * @param {Number} totalBloques - Tamaño del disco en bloques
 * @param {Number} tamanioPuntero - Tamaño de cada puntero en bytes
 * @param {Number} tamanioBloque - Tamaño de cada bloque en bytes
 * @returns {{ snapshots: Array, pasos: Array, metadatos: Array, metricas: Object }}
 */
export function simularAsignacionIndexada(archivos, totalBloques, tamanioPuntero, tamanioBloque) {
  const snapshots = [];
  const pasos = [];
  const metadatos = [];
  let totalLecturas = 0;
  let totalEscrituras = 0;

  // Capacidad máxima de índices por bloque
  const maxIndicesPorBloque = Math.floor(tamanioBloque / tamanioPuntero);

  // Estado inicial del disco
  let discoActual = construirDiscoInicial(totalBloques);

  // Guardar snapshot inicial (disco vacío)
  snapshots.push(clonarSnapshot(discoActual));

  // Procesar cada archivo
  archivos.forEach((archivo, indiceArchivo) => {
    const { nombre, bloqueIndice, bloquesDatos } = archivo;
    const color = obtenerColor(indiceArchivo);

    // Todos los bloques involucrados (índice + datos)
    const todosLosBloques = [bloqueIndice, ...bloquesDatos];

    // ── Validación: bloques fuera de rango ──
    const fueraDeRango = todosLosBloques.filter(b => b < 0 || b >= totalBloques);
    if (fueraDeRango.length > 0) {
      pasos.push(crearPaso(
        nombre,
        'error',
        `Error: El archivo "${nombre}" referencia bloques fuera del rango del disco: ${fueraDeRango.join(', ')}.`,
        fueraDeRango,
        0,
        0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    // ── Validación: bloques ya ocupados ──
    const bloquesOcupados = todosLosBloques.filter(b => discoActual[b].tipo !== 'libre');
    if (bloquesOcupados.length > 0) {
      const ocupadosPor = bloquesOcupados.map(b => `${b} (${discoActual[b].archivo})`).join(', ');
      pasos.push(crearPaso(
        nombre,
        'error',
        `Error: El archivo "${nombre}" no puede asignarse. Bloques ya ocupados: ${ocupadosPor}.`,
        bloquesOcupados,
        0,
        0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    // ── Validación: capacidad del bloque índice ──
    if (bloquesDatos.length > maxIndicesPorBloque) {
      pasos.push(crearPaso(
        nombre,
        'error',
        `Error: El archivo "${nombre}" requiere ${bloquesDatos.length} punteros en el bloque índice, pero la capacidad máxima es ${maxIndicesPorBloque} (bloque: ${tamanioBloque} bytes / puntero: ${tamanioPuntero} bytes).`,
        [bloqueIndice],
        0,
        0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    // ── Asignar bloque índice (Paso 1) ──
    discoActual[bloqueIndice] = {
      index: bloqueIndice,
      tipo: 'indice',
      archivo: nombre,
      puntero: null,
      indices: [...bloquesDatos],
      color
    };

    totalEscrituras += 1;
    const espacioDesperdiciado = tamanioBloque - (bloquesDatos.length * tamanioPuntero);
    pasos.push(crearPaso(
      nombre,
      'indice',
      `Archivo "${nombre}": asignando bloque índice ${bloqueIndice} con ${bloquesDatos.length}/${maxIndicesPorBloque} punteros usados (desperdicia ${espacioDesperdiciado}B).`,
      [bloqueIndice],
      0,
      1
    ));
    snapshots.push(clonarSnapshot(discoActual));

    // ── Asignar bloques de datos (Paso a paso) ──
    for (let i = 0; i < bloquesDatos.length; i++) {
      const bloqueIdx = bloquesDatos[i];
      discoActual[bloqueIdx] = {
        index: bloqueIdx,
        tipo: 'datos',
        archivo: nombre,
        puntero: null,
        indices: null,
        color
      };

      totalEscrituras += 1;
      const esUltimo = (i === bloquesDatos.length - 1);
      const desc = `Archivo "${nombre}": asignando bloque de datos ${bloqueIdx}.` + (esUltimo ? ' (Completado)' : '');
      
      pasos.push(crearPaso(
        nombre,
        'ok',
        desc,
        [bloqueIdx],
        0,
        1
      ));
      snapshots.push(clonarSnapshot(discoActual));
    }

    // Registrar metadatos
    metadatos.push({
      archivo: nombre,
      bloqueIndice
    });

    // Guardar snapshot después de la asignación
    snapshots.push(clonarSnapshot(discoActual));
  });

  // Calcular métricas finales
  const metricas = calcularMetricasDisco(discoActual, totalBloques);
  metricas.opsLectura = totalLecturas;
  metricas.opsEscritura = totalEscrituras;

  return { snapshots, pasos, metadatos, metricas };
}
