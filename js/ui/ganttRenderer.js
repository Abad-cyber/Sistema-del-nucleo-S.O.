// ui/ganttRenderer.js — Renderizador del diagrama de Gantt
// Vistas: "Compacto" (una fila CPU) y "Por proceso" (fila por proceso)

const CFG = {
  alturaFila:     46,
  alturaCompacto: 64,
  alturaTick:     22,
  paddingIzq:     72,
  paddingDer:     20,
  paddingArr:     12,
  anchoTickMin:   28,
  radio:           6,
};

export function dibujarGantt(eventosGantt, procesos, pasoActual, modoOscuro = false, vistaActual = 'compacto', tiempoActual) {
  const canvas = document.getElementById('canvasGantt');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (tiempoActual == null) tiempoActual = 0;

  const col = {
    fondo:    modoOscuro ? '#1a1917' : '#ffffff',
    texto:    modoOscuro ? '#f0ede8' : '#0f172a',
    rejilla:  modoOscuro ? '#2e2c2a' : '#e8edf5',
    ejeX:     modoOscuro ? '#5a5753' : '#94a3b8',
    idle:     modoOscuro ? '#2e2c2a' : '#e2e8f0',
    idleText: modoOscuro ? '#6b6760' : '#94a3b8',
    cursor:   '#0d7ea8',
  };

  const tiempoTotal = eventosGantt.length > 0
    ? Math.max(...eventosGantt.map(e => e.fin))
    : 10;

  const idsProcesos = [...new Set(procesos.map(p => p.id))];

  const wrap = document.getElementById('ganttWrap');
  const anchoDisponible = wrap
    ? wrap.clientWidth - CFG.paddingIzq - CFG.paddingDer - 20
    : 600;
  const anchoTick  = Math.max(CFG.anchoTickMin, anchoDisponible / tiempoTotal);
  const anchoPista = tiempoTotal * anchoTick;
  const anchoTotal = CFG.paddingIzq + anchoPista + CFG.paddingDer;

  const altoCuerpo = vistaActual === 'compacto'
    ? CFG.alturaCompacto
    : idsProcesos.length * CFG.alturaFila;
  const altoTotal = CFG.paddingArr + altoCuerpo + CFG.alturaTick + 8;

  canvas.width  = anchoTotal;
  canvas.height = altoTotal;

  ctx.fillStyle = col.fondo;
  ctx.fillRect(0, 0, anchoTotal, altoTotal);

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

  if (vistaActual === 'proceso') {
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle    = col.texto;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    idsProcesos.forEach((id, i) => {
      const y = CFG.paddingArr + i * CFG.alturaFila + CFG.alturaFila / 2;
      ctx.fillText(id, CFG.paddingIzq - 10, y);
    });
  } else {
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle    = col.texto;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('CPU', CFG.paddingIzq - 10, CFG.paddingArr + CFG.alturaCompacto / 2);
  }

  const eventosVisibles = eventosGantt.filter(ev => ev.inicio <= tiempoActual);

  eventosVisibles.forEach(evento => {
    const finEfectivo = Math.min(evento.fin, tiempoActual);
    const x = CFG.paddingIzq + evento.inicio * anchoTick;
    const w = (finEfectivo - evento.inicio) * anchoTick;
    if (w <= 0) return;

    if (vistaActual === 'compacto') {
      const y    = CFG.paddingArr;
      const alto = CFG.alturaCompacto;

      if (evento.proceso === 'IDLE') {
        ctx.fillStyle = col.idle;
        dibujarBarra(ctx, x, y, w, alto, CFG.radio);
        dibujarTexto(ctx, 'IDLE', x, y, w, alto, col.idleText, 10);
        return;
      }
      ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.fillStyle = evento.color;
      dibujarBarra(ctx, x + 1, y + 2, w - 2, alto - 4, CFG.radio);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      dibujarTexto(ctx, evento.proceso, x, y, w, alto, '#fff', w > 40 ? 13 : 10);
      if (w > 70) {
        ctx.font = '400 9px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${evento.inicio}\u2013${evento.fin}`, x + w / 2, y + alto / 2 + 13);
      }
    } else {
      if (evento.proceso === 'IDLE') {
        ctx.fillStyle = col.idle;
        dibujarBarra(ctx, x, CFG.paddingArr, w, altoCuerpo, 3);
        dibujarTexto(ctx, 'IDLE', x, CFG.paddingArr, w, altoCuerpo, col.idleText, 9);
        return;
      }
      const filaIdx = idsProcesos.indexOf(evento.proceso);
      if (filaIdx === -1) return;
      const y    = CFG.paddingArr + filaIdx * CFG.alturaFila + 2;
      const alto = CFG.alturaFila - 4;
      ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
      ctx.fillStyle = evento.color;
      dibujarBarra(ctx, x + 1, y, w - 2, alto, CFG.radio);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      dibujarTexto(ctx, evento.proceso, x, y, w, alto, '#fff', w > 40 ? 12 : 9);
      if (w > 70) {
        ctx.font = '400 8px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${evento.inicio}\u2013${evento.fin}`, x + w / 2, y + alto / 2 + 12);
      }
    }
  });

  const yEje = CFG.paddingArr + altoCuerpo;
  ctx.strokeStyle = col.ejeX; ctx.lineWidth = 1.5; ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(CFG.paddingIzq, yEje);
  ctx.lineTo(CFG.paddingIzq + anchoPista, yEje);
  ctx.stroke();

  ctx.font = '400 9px "JetBrains Mono", monospace';
  ctx.fillStyle = col.ejeX; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const intervaloTicks = Math.max(1, Math.ceil(tiempoTotal / 20));
  for (let t = 0; t <= tiempoTotal; t += intervaloTicks) {
    const x = CFG.paddingIzq + t * anchoTick;
    ctx.strokeStyle = col.ejeX; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, yEje); ctx.lineTo(x, yEje + 4); ctx.stroke();
    ctx.fillText(t === 0 ? 't=0' : String(t), x, yEje + 6);
  }
  ctx.fillText(String(tiempoTotal), CFG.paddingIzq + tiempoTotal * anchoTick, yEje + 6);

  if (tiempoActual > 0) {
    const xCursor = CFG.paddingIzq + tiempoActual * anchoTick;
    ctx.strokeStyle = col.cursor;
    ctx.lineWidth   = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(xCursor, CFG.paddingArr);
    ctx.lineTo(xCursor, yEje);
    ctx.stroke();
    ctx.setLineDash([]);

    if (wrap) {
      const centroDelWrap = wrap.clientWidth / 2;
      const scrollIdeal = xCursor - centroDelWrap;
      const scrollMax   = wrap.scrollWidth - wrap.clientWidth;
      const scrollTarget = Math.max(0, Math.min(scrollIdeal, scrollMax));
      if (Math.abs(wrap.scrollLeft - scrollTarget) > 5) {
        wrap.scrollTo({ left: scrollTarget, behavior: 'smooth' });
      }
    }
  }

  const sub = document.getElementById('subtituloGantt');
  if (sub) sub.textContent = `T=${tiempoActual} / ${tiempoTotal} \u00b7 ${eventosVisibles.length} evento(s)`;
}

export function renderizarLeyendaGantt(procesos) {
  const cont = document.getElementById('ganttLeyenda');
  if (!cont) return;
  cont.innerHTML = '';
  procesos.forEach(p => {
    const item = document.createElement('div');
    item.className = 'gantt-leyenda-item';
    item.innerHTML = `
      <div class="gantt-leyenda-punto" style="background:${p.color}"></div>
      <span>${p.id}</span>
    `;
    cont.appendChild(item);
  });
}

// ═══════════════════════════════════════════════════════
// HELPERS DE DIBUJO (canvas)
// ═══════════════════════════════════════════════════════
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

function dibujarTexto(ctx, texto, x, y, w, h, color, size) {
  if (w < 16) return;
  ctx.font = `700 ${size}px "JetBrains Mono", monospace`;
  ctx.fillStyle    = color;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x + w / 2, y + h / 2);
}
