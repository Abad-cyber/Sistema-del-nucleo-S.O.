// ═══════════════════════════════════════════════════════
// planificadores/sjf.js — Shortest Job First (No expulsivo)
// Selecciona el proceso con MENOR tiempo de ráfaga entre
// los que ya han llegado. Una vez iniciado, no se interrumpe.
// ═══════════════════════════════════════════════════════

/**
 * Ejecuta el algoritmo SJF no expulsivo.
 *
 * @param {Array} procesos - Lista de procesos
 * @returns {Object} { eventosGantt, procesosResultado, tiempoTotal }
 */
export function sjf(procesos) {
  const lista = procesos.map(p => ({ ...p, completado: false }));
  const eventosGantt = [];
  let tiempoActual = 0;
  let completados  = 0;
  const total = lista.length;

  while (completados < total) {
    // Obtener procesos que ya llegaron y no han terminado
    const disponibles = lista.filter(p =>
      !p.completado && p.llegada <= tiempoActual
    );

    if (disponibles.length === 0) {
      // CPU ociosa: avanzar al próximo proceso que llega
      const proximoLlegada = Math.min(...lista.filter(p => !p.completado).map(p => p.llegada));
      eventosGantt.push({ proceso: 'IDLE', inicio: tiempoActual, fin: proximoLlegada, color: '#d1cfc8' });
      tiempoActual = proximoLlegada;
      continue;
    }

    // Seleccionar el de menor tiempo de ejecución (criterio SJF)
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
// planificadores/roundRobin.js — Round Robin (Expulsivo)
// Cada proceso recibe un quantum de tiempo. Si no termina,
// va al final de la cola y espera su turno de nuevo.
// ═══════════════════════════════════════════════════════

/**
 * Ejecuta el algoritmo Round Robin.
 *
 * @param {Array}  procesos - Lista de procesos
 * @param {number} quantum  - Quantum de tiempo configurable
 * @returns {Object} { eventosGantt, procesosResultado, tiempoTotal }
 */
export function roundRobin(procesos, quantum) {
  // Copia con tiempo restante para ir descontando
  const lista = procesos.map(p => ({
    ...p,
    tiempoRestante: p.ejecucion,
    primerEjecucion: -1, // Para calcular tiempo de respuesta
    completado: false,
  }));

  // Ordenar por llegada inicialmente
  lista.sort((a, b) => a.llegada - b.llegada);

  const eventosGantt = [];
  const cola = [];           // Cola de listos
  let tiempoActual = 0;
  let indice = 0;            // Siguiente proceso a revisar según llegada
  let completados = 0;

  // Agregar procesos que llegan en t=0
  while (indice < lista.length && lista[indice].llegada <= tiempoActual) {
    cola.push(lista[indice]);
    indice++;
  }

  while (completados < lista.length) {
    if (cola.length === 0) {
      // CPU ociosa
      const proxLlegada = lista[indice]?.llegada ?? tiempoActual + 1;
      eventosGantt.push({ proceso: 'IDLE', inicio: tiempoActual, fin: proxLlegada, color: '#d1cfc8' });
      tiempoActual = proxLlegada;
      // Agregar procesos que llegaron durante la espera
      while (indice < lista.length && lista[indice].llegada <= tiempoActual) {
        cola.push(lista[indice]);
        indice++;
      }
      continue;
    }

    // Tomar el primero de la cola
    const proceso = cola.shift();

    // Registrar primera ejecución para tiempo de respuesta
    if (proceso.primerEjecucion === -1) {
      proceso.primerEjecucion = tiempoActual;
    }

    // Calcular cuánto ejecuta en este quantum
    const tiempoEjecutado = Math.min(quantum, proceso.tiempoRestante);
    const tiempoInicio    = tiempoActual;
    const tiempoFin       = tiempoActual + tiempoEjecutado;

    eventosGantt.push({ proceso: proceso.id, inicio: tiempoInicio, fin: tiempoFin, color: proceso.color });

    proceso.tiempoRestante -= tiempoEjecutado;
    tiempoActual = tiempoFin;

    // Agregar procesos que llegaron durante este quantum
    while (indice < lista.length && lista[indice].llegada <= tiempoActual) {
      cola.push(lista[indice]);
      indice++;
    }

    if (proceso.tiempoRestante === 0) {
      // Proceso terminado — calcular métricas finales
      proceso.fin             = tiempoFin;
      proceso.inicio          = proceso.primerEjecucion;
      proceso.tiempoRetorno   = tiempoFin              - proceso.llegada;
      proceso.tiempoRespuesta = proceso.primerEjecucion - proceso.llegada;
      proceso.tiempoEspera    = proceso.tiempoRetorno  - proceso.ejecucion;
      proceso.completado = true;
      completados++;
    } else {
      // Proceso no terminado — vuelve al final de la cola
      cola.push(proceso);
    }
  }

  return { eventosGantt, procesosResultado: lista, tiempoTotal: tiempoActual };
}


// ═══════════════════════════════════════════════════════
// planificadores/srt.js — Shortest Remaining Time (Expulsivo)
// Variante expulsiva de SJF. En cada tick, si llega un proceso
// con menor tiempo restante que el actual, lo expulsa.
// ═══════════════════════════════════════════════════════

/**
 * Ejecuta el algoritmo SRT (Shortest Remaining Time First).
 * Simula tick a tick para detectar expulsiones en el momento exacto.
 *
 * @param {Array} procesos - Lista de procesos
 * @returns {Object} { eventosGantt, procesosResultado, tiempoTotal }
 */
export function srt(procesos) {
  const lista = procesos.map(p => ({
    ...p,
    tiempoRestante:  p.ejecucion,
    primerEjecucion: -1,
    completado:      false,
  }));

  const eventosGantt = [];
  let tiempoActual = 0;
  let completados  = 0;
  let procesoActual = null;   // Proceso que está ejecutándose ahora
  let inicioSegmento = 0;     // Inicio del segmento actual del Gantt

  // Calcular tiempo máximo (suma de todas las ejecuciones + llegada máxima)
  const tiempoMaximo = lista.reduce((s, p) => s + p.ejecucion, 0) +
                       Math.max(...lista.map(p => p.llegada));

  while (completados < lista.length && tiempoActual <= tiempoMaximo) {
    // Procesos disponibles en este tick
    const disponibles = lista.filter(p => !p.completado && p.llegada <= tiempoActual);

    // Seleccionar el de menor tiempo restante
    let siguiente = null;
    if (disponibles.length > 0) {
      siguiente = disponibles.reduce((min, p) =>
        p.tiempoRestante < min.tiempoRestante ? p : min
      );
    }

    // Detectar cambio de proceso (expulsión o nuevo proceso)
    if (siguiente !== procesoActual) {
      // Cerrar segmento anterior si había uno corriendo
      if (procesoActual !== null) {
        eventosGantt.push({
          proceso: procesoActual.id,
          inicio:  inicioSegmento,
          fin:     tiempoActual,
          color:   procesoActual.color,
        });
      } else if (siguiente === null) {
        // CPU ociosa
        eventosGantt.push({ proceso: 'IDLE', inicio: tiempoActual, fin: tiempoActual + 1, color: '#d1cfc8' });
      }

      procesoActual  = siguiente;
      inicioSegmento = tiempoActual;

      // Registrar primera ejecución
      if (procesoActual && procesoActual.primerEjecucion === -1) {
        procesoActual.primerEjecucion = tiempoActual;
        procesoActual.inicio          = tiempoActual;
      }
    }

    // Avanzar un tick
    if (procesoActual !== null) {
      procesoActual.tiempoRestante--;

      if (procesoActual.tiempoRestante === 0) {
        // Proceso terminado
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

  // Fusionar segmentos consecutivos del mismo proceso para limpiar el Gantt
  const ganttFusionado = fusionarSegmentos(eventosGantt);

  return { eventosGantt: ganttFusionado, procesosResultado: lista, tiempoTotal: tiempoActual };
}

/**
 * Fusiona segmentos consecutivos del mismo proceso en el Gantt.
 * Evita barras fragmentadas cuando no hubo expulsión real.
 *
 * @param {Array} eventos - Lista de eventos del Gantt sin fusionar
 * @returns {Array} Lista de eventos fusionados
 */
function fusionarSegmentos(eventos) {
  if (eventos.length === 0) return [];
  const resultado = [{ ...eventos[0] }];

  for (let i = 1; i < eventos.length; i++) {
    const ultimo   = resultado[resultado.length - 1];
    const actual   = eventos[i];
    // Fusionar si es el mismo proceso y son consecutivos en el tiempo
    if (ultimo.proceso === actual.proceso && ultimo.fin === actual.inicio) {
      ultimo.fin = actual.fin;
    } else {
      resultado.push({ ...actual });
    }
  }
  return resultado;
}


// ═══════════════════════════════════════════════════════
// FCFS — First Come First Served (añadido al módulo unificado)
// ═══════════════════════════════════════════════════════
export function fcfs(procesos) {
  const lista = procesos.map(p => ({ ...p, tiempoRestante: p.ejecucion }));
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
