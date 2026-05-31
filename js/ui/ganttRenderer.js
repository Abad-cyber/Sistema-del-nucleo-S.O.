// ═══════════════════════════════════════════════════════
// ui/ganttRenderer.js — Renderizador del diagrama de Gantt
// Soporta dos vistas: "Por proceso" (fila por proceso) y "Compacto" (una fila CPU)
// ═══════════════════════════════════════════════════════

// Configuración visual del Gantt
const CFG = {
  alturaFila:   46,   // Altura de cada fila de proceso
  alturaCompacto: 64, // Altura de la única barra en modo compacto
  alturaTick:   22,   // Altura del eje de tiempo inferior
  paddingIzq:   72,   // Espacio para nombres de proceso a la izquierda
  paddingDer:   20,   // Margen derecho
  paddingArr:   12,   // Margen superior
  anchoTickMin: 28,   // Ancho mínimo por unidad de tiempo
  radio:         6,   // Radio de esquinas redondeadas
};

/**
 * Dibuja el diagrama de Gantt en el canvas.
 * Soporta dos modos: 'proceso' (fila por proceso) y 'compacto' (una sola fila CPU).
 *
 * @param {Array}   eventosGantt - Eventos {proceso, inicio, fin, color}
 * @param {Array}   procesos     - Lista de procesos para ordenar filas
 * @param {number}  pasoActual   - Paso actual (para compatibilidad backwards o tiempo)
 * @param {boolean} modoOscuro   - Tema actual
 * @param {string}  vistaActual  - 'proceso' o 'compacto'
 * @param {number}  tiempoActual - Tiempo actual en la simulación (opcional)
 */
export function dibujarGantt(eventosGantt, procesos, pasoActual, modoOscuro = false, vistaActual = 'proceso', tiempoActual = null) {
  const canvas = document.getElementById('canvasGantt');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Si no hay tiempoActual, calcular basándose en pasoActual (para compatibilidad)
  if (tiempoActual === null) {
    // Contar eventos hasta pasoActual
    let contador = 0;
    for (const evento of eventosGantt) {
      contador++;
      if (contador === pasoActual) {
        tiempoActual = evento.fin;
        break;
      }
    }
    if (tiempoActual === null) tiempoActual = 0;
  }

  // Paleta de colores según tema
  const col = {
    fondo:   modoOscuro ? '#1a1917' : '#f5f4f0',
    texto:   modoOscuro ? '#f0ede8' : '#1a1816',
    rejilla: modoOscuro ? '#2e2c2a' : '#e8e5e0',
    ejeX:    modoOscuro ? '#5a5753' : '#a09b93',
    idle:    modoOscuro ? '#2e2c2a' : '#dedad4',
    idleText:modoOscuro ? '#6b6760' : '#9a9591',
  };

  // Tiempo total de la simulación
  const tiempoTotal = eventosGantt.length > 0
    ? Math.max(...eventosGantt.map(e => e.fin))
    : 10;

  // IDs únicos de procesos (sin IDLE), en orden de llegada
  const idsProcesos = [...new Set(procesos.map(p => p.id))];

  // Ancho por tick, adaptado al contenedor
  const contenedor = document.getElementById('ganttWrap');
  const anchoDisponible = contenedor ? contenedor.clientWidth - CFG.paddingIzq - CFG.paddingDer - 20 : 600;
  const anchoTick  = Math.max(CFG.anchoTickMin, anchoDisponible / tiempoTotal);
  const anchoPista = tiempoTotal * anchoTick;
  const anchoTotal = CFG.paddingIzq + anchoPista + CFG.paddingDer;

  // Alto según la vista
  const altoCuerpo = vistaActual === 'compacto'
    ? CFG.alturaCompacto
    : idsProcesos.length * CFG.alturaFila;
  const altoTotal  = CFG.paddingArr + altoCuerpo + CFG.alturaTick + 8;

  canvas.width  = anchoTotal;
  canvas.height = altoTotal;

  // ── Fondo ──
  ctx.fillStyle = col.fondo;
  ctx.fillRect(0, 0, anchoTotal, altoTotal);

  // ── Rejilla vertical ──
  ctx.strokeStyle = col.rejilla;
  ctx.lineWidth   = 1;
  const intervaloRejilla = Math.max(1, Math.ceil(tiempoTotal / 30));
  for (let t = 0; t <= tiempoTotal; t += intervaloRejilla) {
    const x = CFG.paddingIzq + t * anchoTick;
    ctx.beginPath();
    ctx.moveTo(x, CFG.paddingArr);
    ctx.lineTo(x, CFG.paddingArr + altoCuerpo);
    ctx.stroke();
  }

  // ── Etiquetas del eje Y (solo en vista por proceso) ──
  if (vistaActual === 'proceso') {
    ctx.font      = '600 11px "IBM Plex Mono", monospace';
    ctx.fillStyle = col.texto;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    idsProcesos.forEach((id, i) => {
      const y = CFG.paddingArr + i * CFG.alturaFila + CFG.alturaFila / 2;
      ctx.fillText(id, CFG.paddingIzq - 10, y);
    });
  } else {
    // En modo compacto mostrar "CPU" a la izquierda
    ctx.font      = '700 12px "IBM Plex Mono", monospace';
    ctx.fillStyle = col.texto;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('CPU', CFG.paddingIzq - 10, CFG.paddingArr + CFG.alturaCompacto / 2);
  }

  // ── Dibujar barras hasta tiempoActual ──
  // Mostrar solo eventos cuyo fin <= tiempoActual
  const eventosVisibles = eventosGantt.filter(evento => evento.fin <= tiempoActual);

  eventosVisibles.forEach(evento => {
    const x = CFG.paddingIzq + evento.inicio * anchoTick;
    const w = (evento.fin - evento.inicio) * anchoTick;
    if (w <= 0) return;

    if (vistaActual === 'compacto') {
      // ── Modo compacto: todos los procesos en una sola fila ──
      const y    = CFG.paddingArr;
      const alto = CFG.alturaCompacto;

      if (evento.proceso === 'IDLE') {
        ctx.fillStyle = col.idle;
        dibujarBarra(ctx, x, y, w, alto, CFG.radio);
        dibujarTextoEnBarra(ctx, 'IDLE', x, y, w, alto, col.idleText, 10);
        return;
      }

      // Sombra sutil
      ctx.shadowColor   = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur    = 6;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = evento.color;
      dibujarBarra(ctx, x + 1, y + 2, w - 2, alto - 4, CFG.radio);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      // Texto: ID grande + rango si hay espacio
      dibujarTextoEnBarra(ctx, evento.proceso, x, y, w, alto, '#fff', w > 40 ? 13 : 10);
      if (w > 70) {
        ctx.font         = '400 9px "IBM Plex Mono", monospace';
        ctx.fillStyle    = 'rgba(255,255,255,0.75)';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${evento.inicio}–${evento.fin}`, x + w / 2, y + alto / 2 + 13);
      }

    } else {
      // ── Modo por proceso: fila individual por proceso ──
      if (evento.proceso === 'IDLE') {
        ctx.fillStyle = col.idle;
        dibujarBarra(ctx, x, CFG.paddingArr, w, altoCuerpo, 3);
        dibujarTextoEnBarra(ctx, 'IDLE', x, CFG.paddingArr, w, altoCuerpo, col.idleText, 9);
        return;
      }

      const filaIdx = idsProcesos.indexOf(evento.proceso);
      if (filaIdx === -1) return;

      const y    = CFG.paddingArr + filaIdx * CFG.alturaFila + 2;
      const alto = CFG.alturaFila - 4;

      ctx.shadowColor   = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur    = 5;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = evento.color;
      dibujarBarra(ctx, x + 1, y, w - 2, alto, CFG.radio);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      dibujarTextoEnBarra(ctx, evento.proceso, x, y, w, alto, '#fff', w > 40 ? 12 : 9);
      if (w > 70) {
        ctx.font         = '400 8px "IBM Plex Mono", monospace';
        ctx.fillStyle    = 'rgba(255,255,255,0.75)';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${evento.inicio}–${evento.fin}`, x + w / 2, y + alto / 2 + 12);
      }
    }
  });

  // ── Eje de tiempo inferior ──
  const yEje = CFG.paddingArr + altoCuerpo;
  ctx.strokeStyle  = col.ejeX;
  ctx.lineWidth    = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(CFG.paddingIzq, yEje);
  ctx.lineTo(CFG.paddingIzq + anchoPista, yEje);
  ctx.stroke();

  // Marcas y números en el eje X
  ctx.font         = '400 9px "IBM Plex Mono", monospace';
  ctx.fillStyle    = col.ejeX;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  const intervaloTicks = Math.max(1, Math.ceil(tiempoTotal / 20));
  for (let t = 0; t <= tiempoTotal; t += intervaloTicks) {
    const x = CFG.paddingIzq + t * anchoTick;
    ctx.strokeStyle = col.ejeX;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x, yEje);
    ctx.lineTo(x, yEje + 4);
    ctx.stroke();
    ctx.fillText(t === 0 ? 't=0' : String(t), x, yEje + 6);
  }
  // Siempre marcar el tiempo final
  const xFinal = CFG.paddingIzq + tiempoTotal * anchoTick;
  ctx.fillText(String(tiempoTotal), xFinal, yEje + 6);

  // ── Línea indicadora del tiempo actual (línea punteada morada) ──
  if (tiempoActual > 0) {
    const xInd = CFG.paddingIzq + tiempoActual * anchoTick;
    ctx.strokeStyle = '#7c4dbd';
    ctx.lineWidth   = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(xInd, CFG.paddingArr);
    ctx.lineTo(xInd, yEje);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Actualizar subtítulo ──
  const sub = document.getElementById('subtituloGantt');
  if (sub) sub.textContent = `T=${tiempoActual} / ${tiempoTotal} · ${eventosVisibles.length} evento(s)`;
}

/**
 * Renderiza la leyenda de colores del Gantt (puntos de color + nombre).
 *
 * @param {Array} procesos - Lista de procesos con id y color
 */
export function renderizarLeyendaGantt(procesos) {
  const contenedor = document.getElementById('ganttLeyenda');
  if (!contenedor) return;
  contenedor.innerHTML = '';
  procesos.forEach(p => {
    const item = document.createElement('div');
    item.className = 'gantt-leyenda-item';
    item.innerHTML = `
      <div class="gantt-leyenda-punto" style="background:${p.color}"></div>
      <span>${p.id}</span>
    `;
    contenedor.appendChild(item);
  });
}

// ── Helpers de dibujo ──

/**
 * Dibuja un rectángulo con esquinas redondeadas.
 */
function dibujarBarra(ctx, x, y, w, h, r) {
  if (w <= 0 || h <= 0) return;
  const radio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.lineTo(x + w - radio, y);
  ctx.arcTo(x + w, y, x + w, y + radio, radio);
  ctx.lineTo(x + w, y + h - radio);
  ctx.arcTo(x + w, y + h, x + w - radio, y + h, radio);
  ctx.lineTo(x + radio, y + h);
  ctx.arcTo(x, y + h, x, y + h - radio, radio);
  ctx.lineTo(x, y + radio);
  ctx.arcTo(x, y, x + radio, y, radio);
  ctx.closePath();
  ctx.fill();
}

/**
 * Dibuja texto centrado dentro de una barra si hay suficiente espacio.
 */
function dibujarTextoEnBarra(ctx, texto, x, y, w, h, color, size) {
  if (w < 16) return;
  ctx.font         = `700 ${size}px "IBM Plex Mono", monospace`;
  ctx.fillStyle    = color;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x + w / 2, y + h / 2);
}
