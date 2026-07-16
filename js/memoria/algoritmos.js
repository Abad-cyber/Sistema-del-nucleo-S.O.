// memoria/algoritmos.js — Algoritmos de gestión de memoria
// First Fit, Best Fit, Worst Fit y Buddy System

export const COLOR_SO   = '#334155';
export const COLOR_LIBRE = '#e2e8f0';

export function construirMemoriaInicial(memoriaTotal, memoriaSOReservado, politica, tamaniosFijos = [], algoMem = '') {
  const bloques = [];

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
    let libre = memoriaTotal - memoriaSOReservado;
    if (algoMem === 'buddy') {
      let p = 1;
      while (p <= libre) p *= 2;
      if (p / 2 < libre) {
        console.warn(`Buddy System: solo se gestionan ${p/2}KB de ${libre}KB disponibles (${libre - p/2}KB no utilizables).`);
      }
      libre = p / 2;
    }
    bloques.push({
      id:      'H1',
      tipo:    'libre',
      inicio:  memoriaSOReservado,
      tamanio: libre,
      color:   COLOR_LIBRE,
    });
  }

  return bloques;
}

// ═══════════════════════════════════════════════════════
// FIRST FIT
// ═══════════════════════════════════════════════════════
export function firstFit(proceso, memoria) {
  for (let i = 0; i < memoria.length; i++) {
    const bloque = memoria[i];
    if (bloque.tipo !== 'libre') continue;
    if (bloque.tamanio < proceso.tamanioKB) continue;
    return asignarEnBloque(proceso, memoria, i);
  }

  return {
    exito:       false,
    descripcion: `No hay hueco libre \u2265 ${proceso.tamanioKB}KB. Proceso ${proceso.id} rechazado.`,
    fragmentacionInterna: 0,
  };
}

// ═══════════════════════════════════════════════════════
// BEST FIT
// ═══════════════════════════════════════════════════════
export function bestFit(proceso, memoria) {
  const candidatos = memoria
    .map((b, indice) => ({ ...b, indice }))
    .filter(b => b.tipo === 'libre' && b.tamanio >= proceso.tamanioKB);

  if (candidatos.length === 0) {
    return {
      exito:       false,
      descripcion: `No hay hueco libre \u2265 ${proceso.tamanioKB}KB. Proceso ${proceso.id} rechazado.`,
      fragmentacionInterna: 0,
    };
  }

  const mejor = candidatos.reduce((min, b) => b.tamanio < min.tamanio ? b : min);
  return asignarEnBloque(proceso, memoria, mejor.indice);
}

// ═══════════════════════════════════════════════════════
// WORST FIT
// ═══════════════════════════════════════════════════════
export function worstFit(proceso, memoria) {
  const candidatos = memoria
    .map((b, indice) => ({ ...b, indice }))
    .filter(b => b.tipo === 'libre' && b.tamanio >= proceso.tamanioKB);

  if (candidatos.length === 0) {
    return {
      exito:       false,
      descripcion: `No hay hueco libre \u2265 ${proceso.tamanioKB}KB. Proceso ${proceso.id} rechazado.`,
      fragmentacionInterna: 0,
    };
  }

  const peor = candidatos.reduce((max, b) => b.tamanio > max.tamanio ? b : max);
  return asignarEnBloque(proceso, memoria, peor.indice);
}

function siguientePotencia2(n) {
  let potencia = 1;
  while (potencia < n) potencia *= 2;
  return potencia;
}

export function buddySystem(proceso, memoria, pasos = []) {
  const tamanioNecesario = siguientePotencia2(proceso.tamanioKB);

  const candidatos = memoria
    .map((b, indice) => ({ ...b, indice }))
    .filter(b => b.tipo === 'libre' && b.tamanio >= tamanioNecesario)
    .sort((a, b) => a.tamanio - b.tamanio);

  if (candidatos.length === 0) {
    return {
      exito:       false,
      descripcion: `Buddy: necesita ${tamanioNecesario}KB (2^n \u2265 ${proceso.tamanioKB}KB). Sin espacio. ${proceso.id} rechazado.`,
      fragmentacionInterna: 0,
    };
  }

  let objetivo = candidatos[0];

  while (objetivo.tamanio > tamanioNecesario && objetivo.tamanio / 2 >= tamanioNecesario) {
    const mitad = objetivo.tamanio / 2;
    const idx   = memoria.findIndex(b => b.inicio === objetivo.inicio && b.tipo === 'libre');

    const gemelo1 = { id: `H${objetivo.inicio}`,        tipo: 'libre', inicio: objetivo.inicio,        tamanio: mitad, color: COLOR_LIBRE };
    const gemelo2 = { id: `H${objetivo.inicio + mitad}`, tipo: 'libre', inicio: objetivo.inicio + mitad, tamanio: mitad, color: COLOR_LIBRE };
    memoria.splice(idx, 1, gemelo1, gemelo2);

    pasos.push({
      tipo:        'buddy',
      descripcion: `Divisi\u00f3n: bloque de ${objetivo.tamanio}KB \u2192 2 gemelos de ${mitad}KB (@${objetivo.inicio}KB y @${objetivo.inicio + mitad}KB).`,
    });

    objetivo = { ...gemelo1 };
  }

  const idxFinal = memoria.findIndex(b => b.inicio === objetivo.inicio && b.tipo === 'libre');
  return asignarEnBloque(proceso, memoria, idxFinal, false);
}

export function buddyLiberar(idProceso, memoria, pasos = []) {
  const idx = memoria.findIndex(b => b.id === idProceso && b.tipo === 'proceso');
  if (idx === -1) return { exito: false, descripcion: 'Proceso no encontrado.' };

  const bloque = memoria[idx];
  memoria[idx] = { id: `H${bloque.inicio}`, tipo: 'libre', inicio: bloque.inicio, tamanio: bloque.tamanio, color: COLOR_LIBRE };

  pasos.push({ tipo: 'libre', descripcion: `${idProceso} liberado. Bloque de ${bloque.tamanio}KB en @${bloque.inicio}KB marcado libre.` });

  let fusionado = true;
  while (fusionado) {
    fusionado = false;
    for (let i = 0; i < memoria.length - 1; i++) {
      const a = memoria[i];
      const b = memoria[i + 1];
      if (a.tipo !== 'libre' || b.tipo !== 'libre') continue;
      if (a.tamanio !== b.tamanio) continue;
      if (a.inicio % (a.tamanio * 2) !== 0) continue;
      if (a.inicio + a.tamanio !== b.inicio) continue;

      const bloqueUnido = { id: `H${a.inicio}`, tipo: 'libre', inicio: a.inicio, tamanio: a.tamanio * 2, color: COLOR_LIBRE };
      memoria.splice(i, 2, bloqueUnido);
      pasos.push({ tipo: 'compact', descripcion: `Fusi\u00f3n: gemelos @${a.inicio}KB (${a.tamanio}KB) + @${b.inicio}KB (${b.tamanio}KB) \u2192 ${bloqueUnido.tamanio}KB.` });
      fusionado = true;
      break;
    }
  }

  return { exito: true, descripcion: `Proceso ${idProceso} liberado correctamente.` };
}

function asignarEnBloque(proceso, memoria, indice, crearRemanente = true) {
  const bloque = memoria[indice];
  const tamanioAsignado = crearRemanente ? proceso.tamanioKB : bloque.tamanio;
  const fragmentacionInterna = bloque.tamanio - proceso.tamanioKB;

  const bloqueAsignado = {
    id:                   proceso.id,
    tipo:                 'proceso',
    inicio:               bloque.inicio,
    tamanio:              tamanioAsignado,
    tamanioParticion:     bloque.tamanio,
    color:                proceso.color,
    fragmentacionInterna: fragmentacionInterna,
  };

  const reemplazo = [bloqueAsignado];
  if (crearRemanente && fragmentacionInterna > 0) {
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
    fragEsInterna:        !crearRemanente,
    descripcion: `${proceso.id} asignado en @${bloqueAsignado.inicio}KB (partici\u00f3n ${bloque.tamanio}KB, usa ${bloqueAsignado.tamanio}KB). Fragmentaci\u00f3n interna: ${fragmentacionInterna}KB.`,
  };
}

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

  fusionarHuecosAdyacentes(memoria);

  return {
    exito:       true,
    descripcion: `Proceso ${idProceso} liberado. ${bloque.tamanio}KB en @${bloque.inicio}KB ahora libre.`,
  };
}

function fusionarHuecosAdyacentes(memoria) {
  let i = 0;
  while (i < memoria.length - 1) {
    const a = memoria[i];
    const b = memoria[i + 1];
    if (a.tipo === 'libre' && b.tipo === 'libre' && a.inicio + a.tamanio === b.inicio) {
      const fusionado = {
        id:      `H${a.inicio}`,
        tipo:    'libre',
        inicio:  a.inicio,
        tamanio: a.tamanio + b.tamanio,
        color:   COLOR_LIBRE,
      };
      memoria.splice(i, 2, fusionado);
    } else {
      i++;
    }
  }
}

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
