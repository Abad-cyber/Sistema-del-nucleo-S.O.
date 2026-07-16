// planificadores/algoritmos.js — FCFS, SJF, Round Robin, SRT

export function fcfs(procesos) {
  if (!procesos.length) return { eventosGantt: [], procesosResultado: [], tiempoTotal: 0 };
  const lista = procesos.map(p => ({ ...p }));
  lista.sort((a, b) => a.llegada - b.llegada);
  const eventosGantt = [];
  let tiempoActual = 0;
  for (const proceso of lista) {
    if (tiempoActual < proceso.llegada) {
      eventosGantt.push({ proceso: 'IDLE', inicio: tiempoActual, fin: proceso.llegada, color: '#d1cfc8' });
      tiempoActual = proceso.llegada;
    }
    const tiempoInicio = tiempoActual;
    const tiempoFin    = tiempoActual + proceso.ejecucion;
    eventosGantt.push({ proceso: proceso.id, inicio: tiempoInicio, fin: tiempoFin, color: proceso.color });
    proceso.inicio          = tiempoInicio;
    proceso.fin             = tiempoFin;
    proceso.tiempoEspera    = tiempoInicio - proceso.llegada;
    proceso.tiempoRetorno   = tiempoFin    - proceso.llegada;
    proceso.tiempoRespuesta = tiempoInicio - proceso.llegada;
    tiempoActual = tiempoFin;
  }
  return { eventosGantt, procesosResultado: lista, tiempoTotal: tiempoActual };
}

// ═══════════════════════════════════════════════════════
// SJF (Shortest Job First)
// ═══════════════════════════════════════════════════════
export function sjf(procesos) {
  if (!procesos.length) return { eventosGantt: [], procesosResultado: [], tiempoTotal: 0 };
  const lista = procesos.map(p => ({ ...p, completado: false }));
  const eventosGantt = [];
  let tiempoActual = 0;
  let completados  = 0;
  const total = lista.length;

  while (completados < total) {
    const disponibles = lista.filter(p => !p.completado && p.llegada <= tiempoActual);

    if (disponibles.length === 0) {
      const proximoLlegada = Math.min(...lista.filter(p => !p.completado).map(p => p.llegada));
      eventosGantt.push({ proceso: 'IDLE', inicio: tiempoActual, fin: proximoLlegada, color: '#d1cfc8' });
      tiempoActual = proximoLlegada;
      continue;
    }

    disponibles.sort((a, b) => a.ejecucion - b.ejecucion || a.llegada - b.llegada);
    const proceso = disponibles[0];

    const tiempoInicio = tiempoActual;
    const tiempoFin    = tiempoActual + proceso.ejecucion;

    eventosGantt.push({ proceso: proceso.id, inicio: tiempoInicio, fin: tiempoFin, color: proceso.color });

    proceso.inicio          = tiempoInicio;
    proceso.fin             = tiempoFin;
    proceso.tiempoEspera    = tiempoInicio - proceso.llegada;
    proceso.tiempoRetorno   = tiempoFin    - proceso.llegada;
    proceso.tiempoRespuesta = tiempoInicio - proceso.llegada;
    proceso.completado = true;

    tiempoActual = tiempoFin;
    completados++;
  }

  return { eventosGantt, procesosResultado: lista, tiempoTotal: tiempoActual };
}

// ═══════════════════════════════════════════════════════
// ROUND ROBIN
// ═══════════════════════════════════════════════════════
export function roundRobin(procesos, quantum) {
  if (!procesos.length) return { eventosGantt: [], procesosResultado: [], tiempoTotal: 0 };
  const lista = procesos.map(p => ({
    ...p,
    tiempoRestante: p.ejecucion,
    primerEjecucion: -1,
    completado: false,
  }));

  lista.sort((a, b) => a.llegada - b.llegada);

  const eventosGantt = [];
  const cola = [];
  let tiempoActual = 0;
  let indice = 0;
  let completados = 0;

  while (indice < lista.length && lista[indice].llegada <= tiempoActual) {
    cola.push(lista[indice]);
    indice++;
  }

  while (completados < lista.length) {
    if (cola.length === 0) {
      const proxLlegada = lista[indice]?.llegada ?? tiempoActual + 1;
      eventosGantt.push({ proceso: 'IDLE', inicio: tiempoActual, fin: proxLlegada, color: '#d1cfc8' });
      tiempoActual = proxLlegada;
      while (indice < lista.length && lista[indice].llegada <= tiempoActual) {
        cola.push(lista[indice]);
        indice++;
      }
      continue;
    }

    const proceso = cola.shift();

    if (proceso.primerEjecucion === -1) {
      proceso.primerEjecucion = tiempoActual;
    }

    const tiempoEjecutado = Math.min(quantum, proceso.tiempoRestante);
    const tiempoInicio    = tiempoActual;
    const tiempoFin       = tiempoActual + tiempoEjecutado;

    eventosGantt.push({ proceso: proceso.id, inicio: tiempoInicio, fin: tiempoFin, color: proceso.color });

    proceso.tiempoRestante -= tiempoEjecutado;
    tiempoActual = tiempoFin;

    while (indice < lista.length && lista[indice].llegada <= tiempoActual) {
      cola.push(lista[indice]);
      indice++;
    }

    if (proceso.tiempoRestante === 0) {
      proceso.fin             = tiempoFin;
      proceso.inicio          = proceso.primerEjecucion;
      proceso.tiempoRetorno   = tiempoFin              - proceso.llegada;
      proceso.tiempoRespuesta = proceso.primerEjecucion - proceso.llegada;
      proceso.tiempoEspera    = proceso.tiempoRetorno  - proceso.ejecucion;
      proceso.completado = true;
      completados++;
    } else {
      cola.push(proceso);
    }
  }

  return { eventosGantt, procesosResultado: lista, tiempoTotal: tiempoActual };
}

// ═══════════════════════════════════════════════════════
// SRT (Shortest Remaining Time)
// ═══════════════════════════════════════════════════════
export function srt(procesos) {
  if (!procesos.length) return { eventosGantt: [], procesosResultado: [], tiempoTotal: 0 };
  const lista = procesos.map(p => ({
    ...p,
    tiempoRestante:  p.ejecucion,
    primerEjecucion: -1,
    completado:      false,
  }));

  const eventosGantt = [];
  let tiempoActual = 0;
  let completados  = 0;
  let procesoActual = null;
  let inicioSegmento = 0;

  const tiempoMaximo = lista.reduce((s, p) => s + p.ejecucion, 0) +
                       Math.max(...lista.map(p => p.llegada));

  while (completados < lista.length && tiempoActual <= tiempoMaximo) {
    const disponibles = lista.filter(p => !p.completado && p.llegada <= tiempoActual);

    let siguiente = null;
    if (disponibles.length > 0) {
      siguiente = disponibles.reduce((min, p) =>
        p.tiempoRestante < min.tiempoRestante ? p : min
      );
    }

    if (siguiente !== procesoActual) {
      if (procesoActual !== null) {
        eventosGantt.push({
          proceso: procesoActual.id,
          inicio:  inicioSegmento,
          fin:     tiempoActual,
          color:   procesoActual.color,
        });
      } else if (tiempoActual > inicioSegmento) {
        eventosGantt.push({ proceso: 'IDLE', inicio: inicioSegmento, fin: tiempoActual, color: '#d1cfc8' });
      }

      procesoActual  = siguiente;
      inicioSegmento = tiempoActual;

      if (procesoActual && procesoActual.primerEjecucion === -1) {
        procesoActual.primerEjecucion = tiempoActual;
        procesoActual.inicio          = tiempoActual;
      }
    }

    if (procesoActual !== null) {
      procesoActual.tiempoRestante--;

      if (procesoActual.tiempoRestante === 0) {
        eventosGantt.push({
          proceso: procesoActual.id,
          inicio:  inicioSegmento,
          fin:     tiempoActual + 1,
          color:   procesoActual.color,
        });

        procesoActual.fin             = tiempoActual + 1;
        procesoActual.tiempoRetorno   = procesoActual.fin             - procesoActual.llegada;
        procesoActual.tiempoRespuesta = procesoActual.primerEjecucion - procesoActual.llegada;
        procesoActual.tiempoEspera    = procesoActual.tiempoRetorno   - procesoActual.ejecucion;
        procesoActual.completado = true;
        completados++;
        procesoActual  = null;
        inicioSegmento = tiempoActual + 1;
      }
    }

    tiempoActual++;
  }

  const ganttFusionado = fusionarSegmentos(eventosGantt);

  return { eventosGantt: ganttFusionado, procesosResultado: lista, tiempoTotal: tiempoActual };
}

function fusionarSegmentos(eventos) {
  if (eventos.length === 0) return [];
  const resultado = [{ ...eventos[0] }];

  for (let i = 1; i < eventos.length; i++) {
    const ultimo   = resultado[resultado.length - 1];
    const actual   = eventos[i];
    if (ultimo.proceso === actual.proceso && ultimo.fin === actual.inicio) {
      ultimo.fin = actual.fin;
    } else {
      resultado.push({ ...actual });
    }
  }
  return resultado;
}
