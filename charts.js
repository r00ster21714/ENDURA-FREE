/* ENDURA charts: dependency-free canvas renderer */

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function lineChart(canvas, opts = {}) {
  const state = {
    points: opts.points || [],
    color: opts.color || css('--accent') || '#B8F45B',
    format: opts.format || ((v) => String(v)),
    label: opts.label || '',
    height: opts.height || 150,
  };
  let ro;

  function draw() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    if (!w) { setTimeout(draw, 60); return; }
    const h = state.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pts = state.points;
    const padL = 6, padR = 6, padT = 14, padB = 18;
    const plotW = Math.max(1, w - padL - padR);
    const plotH = Math.max(1, h - padT - padB);

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padT + (plotH / 3) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    }

    if (!pts.length) {
      ctx.fillStyle = 'rgba(141,162,166,0.65)';
      ctx.font = '12px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', w / 2, padT + plotH / 2);
      return;
    }

    const vals = pts.map((p) => p.y);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    min -= span * 0.12;
    max += span * 0.12;

    const xAt = (i) => padL + (pts.length === 1 ? plotW / 2 : (plotW * i) / (pts.length - 1));
    const yAt = (v) => padT + plotH - ((v - min) / (max - min)) * plotH;

    // area
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, hexA(state.color, 0.28));
    grad.addColorStop(1, hexA(state.color, 0.01));
    ctx.beginPath();
    ctx.moveTo(xAt(0), padT + plotH);
    pts.forEach((p, i) => ctx.lineTo(xAt(i), yAt(p.y)));
    ctx.lineTo(xAt(pts.length - 1), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(xAt(i), yAt(p.y)) : ctx.moveTo(xAt(i), yAt(p.y))));
    ctx.strokeStyle = state.color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // dots
    if (pts.length <= 40) {
      pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(xAt(i), yAt(p.y), 2.6, 0, Math.PI * 2);
        ctx.fillStyle = '#0B1013';
        ctx.fill();
        ctx.strokeStyle = state.color;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });
    }

    // last value callout
    const last = pts[pts.length - 1];
    const lx = xAt(pts.length - 1);
    const ly = yAt(last.y);
    ctx.fillStyle = state.color;
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();

    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = css('--txt') || '#E9F1F0';
    const text = state.format(last.y);
    const tw = ctx.measureText(text).width;
    const tx = Math.min(w - padR - tw, Math.max(padL, lx - tw / 2));
    ctx.textAlign = 'left';
    ctx.fillText(text, tx, Math.max(11, ly - 9));

    // x labels
    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(141,162,166,0.8)';
    ctx.textAlign = 'left';
    if (pts[0].label) ctx.fillText(pts[0].label, padL, h - 3);
    if (pts.length > 1 && last.label) {
      ctx.textAlign = 'right';
      ctx.fillText(last.label, w - padR, h - 3);
    }
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${a})`;
  }

  draw();
  if (window.ResizeObserver) {
    ro = new ResizeObserver(() => draw());
    ro.observe(canvas.parentElement);
  }
  return {
    update(points) { state.points = points; draw(); },
    destroy() { if (ro) ro.disconnect(); },
    draw,
  };
}
