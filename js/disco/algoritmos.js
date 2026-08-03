// ═══════════════════════════════════════════════════════════════════════════════
// algoritmos.js — Lógica pura de simulación de asignación de bloques en disco
// Sin dependencias del DOM. Módulo ES6.
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// Paleta de colores para archivos (se cicla si hay más archivos que colores)
// ═══════════════════════════════════════════════════════════════════════════════
export const PALETA_ARCHIVOS = [
  '#0d7ea8', '#e11d48', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#ea580c', '#2563eb', '#be123c', '#15803d',
  '#0f766e', '#9333ea', '#ca8a04', '#1d4ed8', '#dc2626'
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

    if (isNaN(longitud) || longitud <= 0) {
      pasos.push(crearPaso(nombre, 'error', `Error: Parámetros inválidos para "${nombre}". Longitud debe ser un número mayor a 0.`, [], 0, 0));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    if (variante === 'manual' && isNaN(inicio)) {
      pasos.push(crearPaso(nombre, 'error', `Error: Parámetros inválidos para "${nombre}". Inicio debe ser numérico.`, [], 0, 0));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }
    
    // Si la variante es First Fit, Best Fit o Worst Fit, calcular el 'inicio'
    if (variante === 'ff' || variante === 'bf' || variante === 'wf') {
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
      } else if (variante === 'wf') {
        // Worst Fit: elegir el hueco MÁS GRANDE disponible
        huecosSuficientes.sort((a, b) => b.tamaño - a.tamaño);
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
      color,
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
export function simularAsignacionEnlazada(archivos, totalBloques, tamanioPuntero, tamanioBloque, variante = 'dinamica') {
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
    const { nombre, longitud } = archivo;
    const color = obtenerColor(indiceArchivo);

    if (isNaN(longitud) || longitud <= 0) {
      pasos.push(crearPaso(
        nombre, 'error', `Error: El archivo "${nombre}" requiere una longitud mayor a 0.`, [], 0, 0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    let secuencia = [];

    if (variante === 'manual') {
      secuencia = archivo.secuencia || [];
      if (secuencia.length === 0 || secuencia.some(isNaN)) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" requiere una secuencia de bloques numéricos válida.`, [], 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      // Validar rango y ocupados
      const fueraRango = secuencia.filter(b => b < 0 || b >= totalBloques);
      if (fueraRango.length > 0) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" usa bloques fuera de rango: ${fueraRango.join(', ')}.`, fueraRango, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      const ocupados = secuencia.filter(b => discoActual[b].tipo !== 'libre');
      if (ocupados.length > 0) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" intenta usar bloques ocupados: ${ocupados.join(', ')}.`, ocupados, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      pasos.push(crearPaso(nombre, 'creacion', `Asignación manual para "${nombre}" en bloques: [${secuencia.join(', ')}].`, secuencia, 0, 0));
    } else {
      // Escanear disco para encontrar N bloques libres
      let todosLibres = [];
      for (let i = 0; i < totalBloques; i++) {
        if (discoActual[i].tipo === 'libre') todosLibres.push(i);
      }

      todosLibres.sort(() => Math.random() - 0.5);
      secuencia = todosLibres.slice(0, longitud);

      // Validación: No hay espacio suficiente
      if (secuencia.length < longitud) {
        pasos.push(crearPaso(
          nombre, 'error',
          `Error: No hay espacio suficiente en disco para "${nombre}" (${longitud} bloques). Libres encontrados: ${secuencia.length}.`,
          secuencia, 0, 0
        ));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }

      pasos.push(crearPaso(
        nombre, 'creacion',
        `Buscando ${longitud} bloques libres para "${nombre}"... Encontrados: [${secuencia.join(', ')}].`,
        secuencia, 0, 0
      ));
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
      // Lectura del bloque anterior para actualizar su puntero (costo de enlazada)
      if (i > 0) totalLecturas += 1;

      const textoPuntero = siguienteBloque !== -1 ? `apunta al bloque ${siguienteBloque}` : `apunta a fin de archivo (EOF)`;
      const esUltimo = (i === secuencia.length - 1);
      const extras = esUltimo ? ` | Datos útiles/bloque: ${datosUtilesPorBloque}B` : '';
      const desc = `Archivo "${nombre}": bloque enlazado ${bloqueIdx} (${textoPuntero}).${extras}`;
      
      pasos.push(crearPaso(
        nombre,
        'puntero',
        desc,
        [bloqueIdx],
        i > 0 ? 1 : 0,
        1
      ));
      
      snapshots.push(clonarSnapshot(discoActual));
    }

    // Registrar metadatos
    metadatos.push({
      archivo: nombre,
      color,
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
export function simularAsignacionIndexada(archivos, totalBloques, tamanioPuntero, tamanioBloque, variante = 'dinamica') {
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
    const { nombre, longitud } = archivo;
    const color = obtenerColor(indiceArchivo);

    if (isNaN(longitud) || longitud <= 0) {
      pasos.push(crearPaso(
        nombre, 'error', `Error: El archivo "${nombre}" requiere una longitud mayor a 0.`, [], 0, 0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    // ── Validación: capacidad del bloque índice ──
    if (longitud > maxIndicesPorBloque) {
      pasos.push(crearPaso(
        nombre,
        'error',
        `Error: El archivo "${nombre}" requiere ${longitud} punteros, pero la capacidad máxima del índice es ${maxIndicesPorBloque} (bloque: ${tamanioBloque}B / puntero: ${tamanioPuntero}B).`,
        [], 0, 0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    let bloqueIndice = null;
    let bloquesDatos = [];
    let todosLosBloques = [];

    if (variante === 'manual') {
      bloqueIndice = archivo.indice;
      bloquesDatos = archivo.datos || [];
      todosLosBloques = [bloqueIndice, ...bloquesDatos];
      
      if (bloqueIndice === undefined || isNaN(bloqueIndice) || bloquesDatos.length === 0 || bloquesDatos.some(isNaN)) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" requiere un índice y datos en modo manual.`, [], 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      
      const fueraRango = todosLosBloques.filter(b => b < 0 || b >= totalBloques);
      if (fueraRango.length > 0) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" usa bloques fuera de rango: ${fueraRango.join(', ')}.`, fueraRango, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      const ocupados = todosLosBloques.filter(b => discoActual[b].tipo !== 'libre');
      if (ocupados.length > 0) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" intenta usar bloques ocupados: ${ocupados.join(', ')}.`, ocupados, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      pasos.push(crearPaso(nombre, 'creacion', `Asignación manual para "${nombre}" en bloque índice ${bloqueIndice} y datos: [${bloquesDatos.join(', ')}].`, todosLosBloques, 0, 0));
    } else {
      // Buscar todos los bloques libres
      let todosLibres = [];
      for (let i = 0; i < totalBloques; i++) {
        if (discoActual[i].tipo === 'libre') todosLibres.push(i);
      }

      if (todosLibres.length < longitud + 1) {
        pasos.push(crearPaso(
          nombre, 'error',
          `Error: No hay espacio suficiente en disco para "${nombre}" (requiere 1 índice + ${longitud} datos). Libres encontrados: ${todosLibres.length}.`,
          todosLibres, 0, 0
        ));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }

      // Aleatorizar para esparcir por el disco
      todosLibres.sort(() => Math.random() - 0.5);
      const bloquesLibres = todosLibres.slice(0, longitud + 1);

      pasos.push(crearPaso(
        nombre, 'creacion',
        `Buscando ${longitud + 1} bloques libres para "${nombre}"... Encontrados.`,
        bloquesLibres, 0, 0
      ));

      bloqueIndice = bloquesLibres[0];
      bloquesDatos = bloquesLibres.slice(1);
      todosLosBloques = bloquesLibres;
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
    // Lectura del bloque índice al acceder al archivo (costo de indexada)
    totalLecturas += 1;
    const espacioDesperdiciado = tamanioBloque - (bloquesDatos.length * tamanioPuntero);
    pasos.push(crearPaso(
      nombre,
      'indice',
      `Archivo "${nombre}": asignando bloque índice ${bloqueIndice} con ${bloquesDatos.length}/${maxIndicesPorBloque} punteros usados (espacio desperdiciado: ${espacioDesperdiciado}B).`,
      [bloqueIndice],
      1,
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
      color,
      bloqueIndice
    });
    // NOTA: NO se agrega snapshot extra aquí — el último bloque de datos ya lo hizo
  });

  // Calcular métricas finales
  const metricas = calcularMetricasDisco(discoActual, totalBloques);
  metricas.opsLectura = totalLecturas;
  metricas.opsEscritura = totalEscrituras;

  return { snapshots, pasos, metadatos, metricas };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Simulación de asignación FAT (File Allocation Table)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simular la asignación enlazada con FAT.
 * La FAT es una tabla centralizada que almacena los punteros.
 * Los bloques de datos no tienen puntero interno (más espacio para datos).
 *
 * @param {Array<{nombre: String, secuencia: Array<Number>}>} archivos
 * @param {Number} totalBloques - Tamaño del disco en bloques
 * @param {Number} tamanioBloque - Tamaño de cada bloque en bytes
 * @returns {{ snapshots, pasos, metadatos, metricas }}
 */
export function simularAsignacionFAT(archivos, totalBloques, tamanioBloque, variante = 'dinamica') {
  const snapshots  = [];
  const pasos      = [];
  const metadatos  = [];
  let totalLecturas  = 0;
  let totalEscrituras = 0;

  // La FAT se representa como array paralelo al disco: fat[i] = índice siguiente o -1 (EOF) o null (libre)
  const fat = new Array(totalBloques).fill(null);

  let discoActual = construirDiscoInicial(totalBloques);
  snapshots.push(clonarSnapshot(discoActual));

  archivos.forEach((archivo, indiceArchivo) => {
    const { nombre, longitud } = archivo;
    const color = obtenerColor(indiceArchivo);

    if (isNaN(longitud) || longitud <= 0) {
      pasos.push(crearPaso(
        nombre, 'error', `Error: El archivo "${nombre}" requiere una longitud mayor a 0.`, [], 0, 0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    let secuencia = [];

    if (variante === 'manual') {
      secuencia = archivo.secuencia || [];
      if (secuencia.length === 0 || secuencia.some(isNaN)) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" requiere una secuencia de bloques numéricos válida.`, [], 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      // Validar rango y ocupados
      const fueraRango = secuencia.filter(b => b < 0 || b >= totalBloques);
      if (fueraRango.length > 0) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" usa bloques fuera de rango: ${fueraRango.join(', ')}.`, fueraRango, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      const ocupados = secuencia.filter(b => discoActual[b].tipo !== 'libre');
      if (ocupados.length > 0) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" intenta usar bloques ocupados: ${ocupados.join(', ')}.`, ocupados, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      pasos.push(crearPaso(nombre, 'creacion', `Asignación manual para "${nombre}" en bloques: [${secuencia.join(', ')}].`, secuencia, 0, 0));
    } else {
      // Escanear disco para encontrar N bloques libres
      let todosLibres = [];
      for (let i = 0; i < totalBloques; i++) {
        if (discoActual[i].tipo === 'libre') todosLibres.push(i);
      }

      todosLibres.sort(() => Math.random() - 0.5);
      secuencia = todosLibres.slice(0, longitud);

      // Validación: No hay espacio suficiente
      if (secuencia.length < longitud) {
        pasos.push(crearPaso(
          nombre, 'error',
          `Error: No hay espacio suficiente en disco para "${nombre}" (${longitud} bloques). Libres encontrados: ${secuencia.length}.`,
          secuencia, 0, 0
        ));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }

      pasos.push(crearPaso(
        nombre, 'creacion',
        `Buscando ${longitud} bloques libres para "${nombre}"... Encontrados: [${secuencia.join(', ')}].`,
        secuencia, 0, 0
      ));
    }

    // Asignar bloques y actualizar FAT
    secuencia.forEach((bloqueIdx, i) => {
      const siguiente = i < secuencia.length - 1 ? secuencia[i + 1] : -1;
      fat[bloqueIdx] = siguiente;

      // Los bloques de datos NO tienen puntero interno en la realidad (reside en la FAT).
      // Sin embargo, para la SIMULACIÓN VISUAL (dibujo de flechas), guardamos el puntero aquí.
      discoActual[bloqueIdx] = {
        index: bloqueIdx, tipo: 'datos', archivo: nombre,
        puntero: siguiente, indices: null, color
      };

      totalEscrituras += 1;
      // Lectura de FAT para seguir la cadena
      if (i > 0) totalLecturas += 1;

      const esUltimo = i === secuencia.length - 1;
      const fatEntry = siguiente === -1 ? '-1' : String(siguiente);
      const desc = `Archivo "${nombre}": bloque ${bloqueIdx} → FAT[${bloqueIdx}]=${fatEntry}.` +
                   (esUltimo ? ` | Datos útiles/bloque: ${tamanioBloque}B (sin puntero interno)` : '');

      pasos.push(crearPaso(nombre, 'fat', desc, [bloqueIdx], i > 0 ? 1 : 0, 1));
      snapshots.push(clonarSnapshot(discoActual));
    });

    metadatos.push({
      archivo: nombre,
      color,
      inicio: secuencia[0],
      final: secuencia[secuencia.length - 1],
      bloques: secuencia.length,
      fat: secuencia.map((b, i) => ({ bloque: b, siguiente: i < secuencia.length - 1 ? secuencia[i + 1] : -1 }))
    });
  });

  const metricas = calcularMetricasDisco(discoActual, totalBloques);
  metricas.opsLectura  = totalLecturas;
  metricas.opsEscritura = totalEscrituras;

  return { snapshots, pasos, metadatos, metricas };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Simulación de asignación INDEXADA MULTI-NIVEL (2 niveles)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simular la asignación indexada con 2 niveles de índice.
 * El bloque índice raíz apunta a bloques índice secundarios,
 * que a su vez apuntan a los bloques de datos reales.
 *
 * @param {Array<{nombre, bloqueIndice, bloqueIndice2: Array<Number>, bloquesDatos: Array<Number>}>} archivos
 * @param {Number} totalBloques
 * @param {Number} tamanioPuntero - Bytes por puntero
 * @param {Number} tamanioBloque  - Bytes por bloque
 * @returns {{ snapshots, pasos, metadatos, metricas }}
 */
export function simularAsignacionIndexadaMultiNivel(archivos, totalBloques, tamanioPuntero, tamanioBloque, variante = 'dinamica') {
  const snapshots  = [];
  const pasos      = [];
  const metadatos  = [];
  let totalLecturas  = 0;
  let totalEscrituras = 0;

  const maxPtrsBloque = Math.floor(tamanioBloque / tamanioPuntero);

  let discoActual = construirDiscoInicial(totalBloques);
  snapshots.push(clonarSnapshot(discoActual));

  archivos.forEach((archivo, indiceArchivo) => {
    const { nombre, longitud } = archivo;
    const color = obtenerColor(indiceArchivo);

    if (isNaN(longitud) || longitud <= 0) {
      pasos.push(crearPaso(
        nombre, 'error', `Error: El archivo "${nombre}" requiere una longitud mayor a 0.`, [], 0, 0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    const numIndicesL2 = Math.ceil(longitud / maxPtrsBloque);

    // Capacidad máxima del índice raíz (apunta a N bloques índice secundarios)
    if (numIndicesL2 > maxPtrsBloque) {
      pasos.push(crearPaso(nombre, 'error',
        `Error: "${nombre}" requiere ${numIndicesL2} índices secundarios para ${longitud} datos, pero la raíz solo soporta ${maxPtrsBloque}.`,
        [], 0, 0));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    let bloqueIndice = null;
    let bloqueIndice2 = [];
    let bloquesDatos = [];
    let todosLosBloques = [];

    if (variante === 'manual') {
      bloqueIndice = archivo.raiz;
      bloqueIndice2 = archivo.subindices || [];
      bloquesDatos = archivo.datos || [];
      todosLosBloques = [bloqueIndice, ...bloqueIndice2, ...bloquesDatos];
      
      if (bloqueIndice === undefined || isNaN(bloqueIndice) || bloqueIndice2.length === 0 || bloquesDatos.length === 0 || todosLosBloques.some(isNaN)) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" requiere raíz, subíndices y datos numéricos válidos en modo manual.`, [], 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }

      if (bloqueIndice2.length > maxPtrsBloque) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" excede la capacidad de la raíz (máx ${maxPtrsBloque} subíndices, provistos ${bloqueIndice2.length}).`, [], 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }

      if (bloqueIndice2.length < numIndicesL2) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" requiere al menos ${numIndicesL2} subíndices para mapear ${longitud} datos (solo se proveyeron ${bloqueIndice2.length}).`, [], 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      
      const fueraRango = todosLosBloques.filter(b => b < 0 || b >= totalBloques);
      if (fueraRango.length > 0) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" usa bloques fuera de rango: ${fueraRango.join(', ')}.`, fueraRango, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      const ocupados = todosLosBloques.filter(b => discoActual[b].tipo !== 'libre');
      if (ocupados.length > 0) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" intenta usar bloques ocupados: ${ocupados.join(', ')}.`, ocupados, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      pasos.push(crearPaso(nombre, 'creacion', `Asignación manual para "${nombre}" en raíz ${bloqueIndice}, subíndices [${bloqueIndice2.join(', ')}] y datos [${bloquesDatos.join(', ')}].`, todosLosBloques, 0, 0));
    } else {
      const totalRequeridos = 1 + numIndicesL2 + longitud; // 1 raíz + N subíndices + datos
      let todosLibres = [];
      for (let i = 0; i < totalBloques; i++) {
        if (discoActual[i].tipo === 'libre') todosLibres.push(i);
      }

      if (todosLibres.length < totalRequeridos) {
        pasos.push(crearPaso(nombre, 'error',
          `Error: No hay espacio suficiente para "${nombre}" (requiere ${totalRequeridos} bloques en total). Libres: ${todosLibres.length}.`,
          todosLibres, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }

      todosLibres.sort(() => Math.random() - 0.5);
      const bloquesLibres = todosLibres.slice(0, totalRequeridos);

      pasos.push(crearPaso(
        nombre, 'creacion',
        `Buscando ${totalRequeridos} bloques libres para "${nombre}" (1 raíz + ${numIndicesL2} índices L2 + ${longitud} datos)... Encontrados.`,
        bloquesLibres, 0, 0
      ));

      bloqueIndice = bloquesLibres[0];
      bloqueIndice2 = bloquesLibres.slice(1, 1 + numIndicesL2);
      bloquesDatos = bloquesLibres.slice(1 + numIndicesL2);
      todosLosBloques = bloquesLibres;
    }

    // ── Asignar bloque índice RAÍZ (nivel 1) ──
    discoActual[bloqueIndice] = {
      index: bloqueIndice, tipo: 'indice', archivo: nombre,
      puntero: null, indices: [...(bloqueIndice2 || [])], color
    };
    totalEscrituras += 1;
    totalLecturas   += 1; // lectura para acceso

    pasos.push(crearPaso(
      nombre, 'indice',
      `Archivo "${nombre}": bloque índice raíz ${bloqueIndice} apunta a índices secundarios [${(bloqueIndice2||[]).join(', ')}].`,
      [bloqueIndice], 1, 1
    ));
    snapshots.push(clonarSnapshot(discoActual));

    // ── Asignar bloques índice SECUNDARIOS (nivel 2) ──
    // Distribuir bloques de datos entre los índices secundarios
    const datosRestantes = [...(bloquesDatos || [])];
    const datosPartes = [];
    if (bloqueIndice2 && bloqueIndice2.length > 0) {
      const datosParaIdx = Math.ceil(datosRestantes.length / bloqueIndice2.length);
      for (let idx = 0; idx < bloqueIndice2.length; idx++) {
        datosPartes.push(datosRestantes.splice(0, datosParaIdx));
      }
    }

    (bloqueIndice2 || []).forEach((bloqueIdx2, i) => {
      const datosDeEste = datosPartes[i] || [];
      discoActual[bloqueIdx2] = {
        index: bloqueIdx2, tipo: 'indice2', archivo: nombre,
        puntero: null, indices: [...datosDeEste], color
      };
      totalEscrituras += 1;
      totalLecturas   += 1;

      pasos.push(crearPaso(
        nombre, 'indice2',
        `Archivo "${nombre}": índice secundario ${bloqueIdx2} (nivel 2) apunta a datos [${datosDeEste.join(', ')}].`,
        [bloqueIdx2], 1, 1
      ));
      snapshots.push(clonarSnapshot(discoActual));
    });

    // ── Asignar bloques de DATOS ──
    (bloquesDatos || []).forEach((bloqueIdx, i) => {
      discoActual[bloqueIdx] = {
        index: bloqueIdx, tipo: 'datos', archivo: nombre,
        puntero: null, indices: null, color
      };
      totalEscrituras += 1;
      const esUltimo = i === bloquesDatos.length - 1;
      pasos.push(crearPaso(
        nombre, 'ok',
        `Archivo "${nombre}": datos en bloque ${bloqueIdx}.` + (esUltimo ? ' (Completado)' : ''),
        [bloqueIdx], 0, 1
      ));
      snapshots.push(clonarSnapshot(discoActual));
    });

    metadatos.push({
      archivo: nombre,
      color,
      bloqueIndice,
      bloqueIndice2: bloqueIndice2 || [],
      totalBloquesDatos: (bloquesDatos || []).length
    });
  });

  const metricas = calcularMetricasDisco(discoActual, totalBloques);
  metricas.opsLectura  = totalLecturas;
  metricas.opsEscritura = totalEscrituras;

  return { snapshots, pasos, metadatos, metricas };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Simulación de asignación BASADA EN EXTENSIONES (Extent-Based)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simular asignación basada en extensiones.
 * Un archivo puede ocupar múltiples regiones contiguas (extensiones).
 * Cada extensión es un par {inicio, longitud} de bloques contiguos.
 *
 * @param {Array<{nombre, extensiones: Array<{inicio,longitud}>}>} archivos
 * @param {Number} totalBloques
 * @returns {{ snapshots, pasos, metadatos, metricas }}
 */
export function simularAsignacionExtensiones(archivos, totalBloques, variante = 'dinamica') {
  const snapshots  = [];
  const pasos      = [];
  const metadatos  = [];
  let totalLecturas  = 0;
  let totalEscrituras = 0;

  let discoActual = construirDiscoInicial(totalBloques);
  snapshots.push(clonarSnapshot(discoActual));

  archivos.forEach((archivo, indiceArchivo) => {
    const { nombre, longitud } = archivo;
    const color = obtenerColor(indiceArchivo);

    if (isNaN(longitud) || longitud <= 0) {
      pasos.push(crearPaso(
        nombre, 'error', `Error: El archivo "${nombre}" requiere una longitud mayor a 0.`, [], 0, 0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    let extensiones = [];
    const todosLosBloques = [];
    let bloquesAsignados = 0;
    
    if (variante === 'manual') {
      const extEntrada = archivo.extensiones || [];
      if (extEntrada.length === 0 || extEntrada.some(e => isNaN(e.inicio) || isNaN(e.longitud))) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" requiere extensiones válidas numéricas en modo manual.`, [], 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      
      extEntrada.forEach(ext => {
        extensiones.push(ext);
        for (let i = 0; i < ext.longitud; i++) {
          todosLosBloques.push(ext.inicio + i);
        }
      });

      const fueraRango = todosLosBloques.filter(b => b < 0 || b >= totalBloques);
      if (fueraRango.length > 0) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" usa bloques fuera de rango: ${fueraRango.join(', ')}.`, fueraRango, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      const ocupados = todosLosBloques.filter(b => discoActual[b].tipo !== 'libre');
      if (ocupados.length > 0) {
        pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" intenta usar bloques ocupados: ${ocupados.join(', ')}.`, ocupados, 0, 0));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
      bloquesAsignados = todosLosBloques.length;
    } else {
      let inicioHueco = -1;
      let tamHueco = 0;

      for (let i = 0; i < totalBloques && bloquesAsignados < longitud; i++) {
        if (discoActual[i].tipo === 'libre') {
          if (inicioHueco === -1) inicioHueco = i;
          tamHueco++;
          todosLosBloques.push(i);
          bloquesAsignados++;

          if (bloquesAsignados === longitud) {
            extensiones.push({ inicio: inicioHueco, longitud: tamHueco });
            inicioHueco = -1;
            tamHueco = 0;
          }
        } else {
          if (tamHueco > 0) {
            extensiones.push({ inicio: inicioHueco, longitud: tamHueco });
            inicioHueco = -1;
            tamHueco = 0;
          }
        }
      }

      if (bloquesAsignados < longitud) {
        pasos.push(crearPaso(
          nombre, 'error',
          `Error: No hay espacio suficiente en disco para "${nombre}" (${longitud} bloques). Libres encontrados: ${bloquesAsignados}.`,
          todosLosBloques, 0, 0
        ));
        snapshots.push(clonarSnapshot(discoActual));
        return;
      }
    }

    // Paso de inicio del archivo (encabezado)
    const tablaExt = extensiones.map((e, i) => `Ext${i+1}:[${e.inicio}..${e.inicio+e.longitud-1}]`).join(', ');
    pasos.push(crearPaso(
      nombre, 'creacion',
      `Archivo "${nombre}": ${extensiones.length} extensión(es) → ${tablaExt}. Total: ${todosLosBloques.length} bloques.`,
      [], 0, 0
    ));

    // Asignar bloque a bloque dentro de cada extensión
    extensiones.forEach((ext, extIdx) => {
      for (let i = 0; i < ext.longitud; i++) {
        const bloqueIdx = ext.inicio + i;
        const esInicioExt = i === 0;
        const esFinExt    = i === ext.longitud - 1;
        const esUltimaExt = extIdx === extensiones.length - 1;

        discoActual[bloqueIdx] = {
          index:    bloqueIdx,
          tipo:     'datos',
          archivo:  nombre,
          puntero:  null,
          indices:  null,
          color,
          extension:       extIdx + 1,       // número de extensión (1-based)
          totalExtensiones: extensiones.length,
          esInicioExt,
          esFinExt,
        };
        totalEscrituras += 1;

        const esUltimo = esUltimaExt && esFinExt;
        const desc = `"${nombre}" Ext.${extIdx+1}/${extensiones.length}: bloque ${bloqueIdx}` +
                     (esInicioExt ? ' ◄ inicio ext.' : '') +
                     (esFinExt    ? ' ► fin ext.' : '') +
                     (esUltimo    ? '  ✓ Completado' : '');

        pasos.push(crearPaso(nombre, 'ok', desc, [bloqueIdx], 0, 1));
        snapshots.push(clonarSnapshot(discoActual));
      }
    });

    metadatos.push({
      archivo: nombre,
      color,
      extensiones: extensiones.map((e, i) => ({ numero: i+1, inicio: e.inicio, longitud: e.longitud, fin: e.inicio + e.longitud - 1 })),
      totalBloques: todosLosBloques.length,
    });
  });

  const metricas = calcularMetricasDisco(discoActual, totalBloques);
  metricas.opsLectura  = totalLecturas;
  metricas.opsEscritura = totalEscrituras;

  return { snapshots, pasos, metadatos, metricas };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Simulación de asignación BITMAP (Mapa de bits para espacio libre)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simular asignación de bloques usando bitmap.
 * El sistema escanea el bitmap bit a bit para encontrar bloques libres.
 * Los bloques no necesitan ser contiguos — el bitmap localiza cualquier bloque libre.
 * Se registra el estado del bitmap ANTES y DESPUÉS de cada asignación.
 *
 * @param {Array<{nombre, numBloques}>} archivos
 * @param {Number} totalBloques
 * @returns {{ snapshots, pasos, metadatos, metricas }}
 */
export function simularAsignacionBitmap(archivos, totalBloques) {
  const snapshots  = [];
  const pasos      = [];
  const metadatos  = [];
  let totalLecturas  = 0;
  let totalEscrituras = 0;

  // El bitmap es un array paralelo: bitmap[i] = 0 libre, 1 ocupado
  const bitmap = new Array(totalBloques).fill(0);

  let discoActual = construirDiscoInicial(totalBloques);
  snapshots.push(clonarSnapshot(discoActual));

  archivos.forEach((archivo, indiceArchivo) => {
    const { nombre, numBloques } = archivo;
    const color = obtenerColor(indiceArchivo);

    if (!numBloques || numBloques <= 0) {
      pasos.push(crearPaso(nombre, 'error', `Error: "${nombre}" requiere al menos 1 bloque.`, [], 0, 0));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    // Escanear bitmap para encontrar bloques libres (escaneado lineal)
    const bloqLibres = [];
    for (let i = 0; i < totalBloques && bloqLibres.length < numBloques; i++) {
      if (bitmap[i] === 0) bloqLibres.push(i);
    }

    if (bloqLibres.length < numBloques) {
      pasos.push(crearPaso(
        nombre, 'error',
        `Error: No hay suficientes bloques libres para "${nombre}" (requeridos: ${numBloques}, disponibles: ${bloqLibres.length}).`,
        [], 0, 0
      ));
      snapshots.push(clonarSnapshot(discoActual));
      return;
    }

    // Paso de escaneo del bitmap
    totalLecturas += Math.ceil(totalBloques / 8); // costo de leer el bitmap (bytes)
    const primerBit = bloqLibres[0];
    const ultimoBit = bloqLibres[bloqLibres.length - 1];
    pasos.push(crearPaso(
      nombre, 'bitmap',
      `Bitmap: escaneando ${totalBloques} bits → ${bloqLibres.length} libres encontrados. Asignando bloques [${bloqLibres.join(', ')}] a "${nombre}".`,
      bloqLibres, Math.ceil(totalBloques / 8), 0
    ));
    snapshots.push(clonarSnapshot(discoActual));

    // Asignar bloque a bloque, actualizando bitmap en cada paso
    bloqLibres.forEach((bloqueIdx, i) => {
      const bitmapAntes = bitmap[bloqueIdx]; // siempre 0 aquí
      bitmap[bloqueIdx] = 1;

      discoActual[bloqueIdx] = {
        index:   bloqueIdx,
        tipo:    'datos',
        archivo: nombre,
        puntero: null,
        indices: null,
        color,
        bitmapPos: bloqueIdx, // posición en el bitmap
      };
      totalEscrituras += 1;

      const esUltimo = i === bloqLibres.length - 1;
      const desc = `Bitmap[${bloqueIdx}]: 0 → 1 ✔  Bloque ${bloqueIdx} asignado a "${nombre}".` +
                   (esUltimo ? `  ✓ Asignación completa (${numBloques} bloques)` : '');

      pasos.push(crearPaso(nombre, 'bitmap', desc, [bloqueIdx], 1, 1));
      snapshots.push(clonarSnapshot(discoActual));
    });

    metadatos.push({
      archivo: nombre,
      color,
      numBloques,
      bloques: bloqLibres,
      bitsOcupados: bitmap.filter(b => b === 1).length,
      bitsLibres: bitmap.filter(b => b === 0).length,
    });
  });

  const metricas = calcularMetricasDisco(discoActual, totalBloques);
  metricas.opsLectura  = totalLecturas;
  metricas.opsEscritura = totalEscrituras;

  // Incluir estado final del bitmap en metadatos globales
  metricas.bitmap = [...bitmap];

  return { snapshots, pasos, metadatos, metricas };
}
