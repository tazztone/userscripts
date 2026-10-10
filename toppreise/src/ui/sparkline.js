/**
 * Interactive SVG Sparkline Component
 * Generates lightweight inline SVG sparkline polyline charts from product price history
 * with interactive tooltips. Single neutral color: history samples can be stale
 * relative to the live card price, so trend coloring would mislead.
 */

export function renderSparkline(timeSeries, width, height, opts = {}) {
  if (!timeSeries || !Array.isArray(timeSeries) || timeSeries.length < 2) return null;
  const axes = opts && opts.axes === true;
  const prices = timeSeries.map(p => Array.isArray(p) ? +p[1] : 0).filter(p => p > 0);

  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.classList.add('tp-sparkline');

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  // Single neutral stroke (blue-500: readable on white cards and dark Discord bg).
  const strokeColor = '#3b82f6';

  const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  titleEl.textContent = `Preisverlauf: CHF ${firstPrice.toFixed(2)} → CHF ${lastPrice.toFixed(2)} (Min: ${min.toFixed(2)}, Max: ${max.toFixed(2)})`;
  svg.appendChild(titleEl);

  // Bare mini omits grid/axes only; endpoint dot shared with Discord path.
  const buildPoints = (x0, x1, y0, y1) => prices.map((p, i) => {
    const x = (x0 + (i / (prices.length - 1)) * (x1 - x0)).toFixed(1);
    const y = (y1 - ((p - min) / range) * (y1 - y0)).toFixed(1);
    return `${x},${y}`;
  }).join(' ');

  const line = (x1, y1, x2, y2, opacity) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('x1', String(x1));
    el.setAttribute('y1', String(y1));
    el.setAttribute('x2', String(x2));
    el.setAttribute('y2', String(y2));
    el.setAttribute('stroke', '#334155');
    el.setAttribute('stroke-width', '0.5');
    el.setAttribute('opacity', String(opacity));
    return el;
  };

  const label = (x, y, text, anchor) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.setAttribute('x', String(x));
    el.setAttribute('y', String(y));
    el.setAttribute('fill', '#64748b');
    el.setAttribute('font-size', '8.5');
    el.setAttribute('font-family', 'inherit');
    el.setAttribute('text-anchor', anchor);
    el.textContent = text;
    return el;
  };

  const fmtPrice = v => (v >= 100 ? String(Math.round(v)) : v.toFixed(2));

  let points;
  let lastX = 0;
  let lastY = 0;
  if (!axes) {
    const padding = 2;
    const usableHeight = height - padding * 2;
    points = prices.map((p, i) => {
      const x = ((i / (prices.length - 1)) * width).toFixed(1);
      const y = (height - padding - ((p - min) / range) * usableHeight).toFixed(1);
      return `${x},${y}`;
    }).join(' ');
  } else {
    const margin = { left: 38, right: 10, top: 6, bottom: 16 };
    const x0 = margin.left;
    const x1 = width - margin.right;
    const y0 = margin.top;
    const y1 = height - margin.bottom;
    points = buildPoints(x0, x1, y0, y1);

    // Y price grid: min / mid / max.
    const mid = (min + max) / 2;
    for (const v of [min, mid, max]) {
      const y = y1 - ((v - min) / range) * (y1 - y0);
      svg.appendChild(line(x0, y, x1, y, 0.8));
      svg.appendChild(label(2, y + 3, `CHF ${fmtPrice(v)}`, 'start'));
    }

    // X months grid from timestamps (ms or s); skip when unusable.
    const tsMs = timeSeries.map(p => {
      const ts = Array.isArray(p) ? +p[0] : NaN;
      if (!Number.isFinite(ts)) return NaN;
      return ts < 1e12 ? ts * 1000 : ts;
    });
    const validTs = tsMs.some(t => Number.isFinite(t)) && tsMs.filter(Number.isFinite).length >= 2;
    if (validTs) {
      const monthStarts = [];
      let prevKey = null;
      tsMs.forEach((t, i) => {
        if (!Number.isFinite(t)) return;
        const d = new Date(t);
        if (Number.isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key !== prevKey) {
          prevKey = key;
          if (i > 0 || monthStarts.length === 0) monthStarts.push({ i, date: d });
        }
      });
      if (monthStarts.length >= 2) {
        const maxLabels = 6;
        const step = Math.ceil(monthStarts.length / maxLabels);
        const shown = monthStarts.filter((_, k) => k % step === 0);
        for (const { i, date } of shown) {
          if (i === 0) continue; // edge tick collides with Y labels, carries no info
          const x = x0 + (i / (prices.length - 1)) * (x1 - x0);
          svg.appendChild(line(x, y0, x, y1, 0.6));
          const monthName = date.toLocaleString('en', { month: 'short' });
          svg.appendChild(label(Math.min(Math.max(x, x0), x1), height - 4, monthName, 'middle'));
        }
      }
    }
  }

  const pts = points.split(' ');
  const last = pts[pts.length - 1].split(',');
  lastX = last[0];
  lastY = last[1];

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', points);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', strokeColor);
  polyline.setAttribute('stroke-width', '1.5');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(polyline);

  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', String(lastX));
  dot.setAttribute('cy', String(lastY));
  dot.setAttribute('r', axes ? '3.2' : '1.8');
  dot.setAttribute('fill', strokeColor);
  dot.setAttribute('stroke', '#ffffff');
  dot.setAttribute('stroke-width', axes ? '1.2' : '0.5');
  svg.appendChild(dot);

  return svg;
}

// Discord-identical chart: axes build + dark card + heavier line. Single source
// for the Discord PNG (share-discord.js) and the click-to-expand popout below.
export function renderDiscordChart(timeSeries, width = 360, height = 100) {
  const svg = renderSparkline(timeSeries, width, height, { axes: true });
  if (!svg) return null;
  const NS = 'http://www.w3.org/2000/svg';
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('rx', '8');
  bg.setAttribute('fill', '#1e293b');
  svg.insertBefore(bg, svg.firstChild);
  svg.querySelector('polyline')?.setAttribute('stroke-width', '2.5');
  return svg;
}

export function closeSparklinePopout() {
  if (typeof document === 'undefined') return;
  document.getElementById('tp-sparkline-popout')?.remove();
}

// Click on a mini sparkline pops the full Discord-style chart. Backdrop/×/Esc closes.
export function openSparklinePopout(timeSeries) {
  if (typeof document === 'undefined') return null;
  closeSparklinePopout();
  const svg = renderDiscordChart(timeSeries, 560, 220);
  if (!svg) return null;
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  svg.style.display = 'block';

  const backdrop = document.createElement('div');
  backdrop.id = 'tp-sparkline-popout';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-label', 'Preisverlauf');
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,0.65);padding:16px;box-sizing:border-box;';
  const panel = document.createElement('div');
  panel.style.cssText = 'background:#1e293b;border-radius:12px;padding:16px;max-width:min(608px,94vw);box-shadow:0 20px 60px rgba(0,0,0,0.5);box-sizing:border-box;';
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
  const title = document.createElement('div');
  title.textContent = '📈 Preisverlauf';
  title.style.cssText = 'color:#e2e8f0;font-size:14px;font-weight:600;';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Schliessen');
  closeBtn.style.cssText = 'background:transparent;border:0;color:#94a3b8;font-size:16px;cursor:pointer;padding:4px 8px;';
  const onKey = e => { if (e.key === 'Escape') close(); };
  function close() { document.removeEventListener('keydown', onKey); closeSparklinePopout(); }
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', close);
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);
  panel.appendChild(svg);
  backdrop.appendChild(panel);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.body.appendChild(backdrop);
  closeBtn.focus?.();
  return backdrop;
}

