/**
 * Interactive SVG Sparkline Component
 * Generates lightweight inline SVG sparkline polyline charts from product price history
 * with interactive tooltips. Single neutral color: history samples can be stale
 * relative to the live card price, so trend coloring would mislead.
 */

import { CONFIG } from '../state/config.js';
import { resolveAmazonAsin } from '../page/product-offers.js';
import { showToast } from './toast.js';
import { createPopoutDialog } from './popout-dialog.js';
import { gmRequestWithTimeout } from '../state/net.js';

export function renderSparkline(timeSeries, width, height, opts = {}) {
  if (!timeSeries || !Array.isArray(timeSeries) || timeSeries.length < 2) return null;
  const axes = opts && opts.axes === true;
  const topPad = (opts && typeof opts.topPad === 'number') ? opts.topPad : 0;
  const valid = timeSeries.filter(p => Array.isArray(p) && +p[1] > 0);
  if (valid.length < 2) return null;
  const prices = valid.map(p => +p[1]);

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
  // ponytail: literal hex here — renderSparklinePng serializes this SVG to a
  // Blob URL, where var() has no page context and would render transparent.
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
    const pad = 2.5;
    const usableWidth = width - pad * 2;
    const usableHeight = height - pad * 2;
    points = prices.map((p, i) => {
      const x = (pad + (i / (prices.length - 1)) * usableWidth).toFixed(1);
      const y = (height - pad - ((p - min) / range) * usableHeight).toFixed(1);
      return `${x},${y}`;
    }).join(' ');
  } else {
    const margin = { left: 38, right: 10, top: 6 + topPad, bottom: 16 };
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

    // X time grid from timestamps (ms or s); young listings span < 1 month, so
    // bucket granularity falls back with span: months → weeks → days.
    const tsMs = valid.map(p => {
      const ts = Array.isArray(p) ? +p[0] : NaN;
      if (!Number.isFinite(ts)) return NaN;
      return ts < 1e12 ? ts * 1000 : ts;
    });
    const finiteTs = tsMs.filter(Number.isFinite);
    if (finiteTs.length >= 2) {
      const DAY_MS = 86400000;
      const span = Math.max(...finiteTs) - Math.min(...finiteTs);
      const mode = span >= 60 * DAY_MS ? 'month' : span >= 14 * DAY_MS ? 'week' : 'day';
      const bucketKey = d => mode === 'month'
        ? `${d.getFullYear()}-${d.getMonth()}`
        : mode === 'week'
          ? (() => { const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); return `${mon.getFullYear()}-${mon.getMonth()}-${mon.getDate()}`; })()
          : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const labelFor = date => mode === 'month'
        ? date.toLocaleString('en', { month: 'short' })
        : `${date.getDate()}.${date.getMonth() + 1}`;
      const starts = [];
      let prevKey = null;
      tsMs.forEach((t, i) => {
        if (!Number.isFinite(t)) return;
        const d = new Date(t);
        if (Number.isNaN(d.getTime())) return;
        const key = bucketKey(d);
        if (key !== prevKey) {
          prevKey = key;
          starts.push({ i, date: d });
        }
      });
      if (starts.length >= 2) {
        const maxLabels = 6;
        const step = Math.ceil(starts.length / maxLabels);
        const shown = starts.filter((_, k) => k % step === 0);
        for (const { i, date } of shown) {
          if (i === 0) continue; // edge tick collides with Y labels, carries no info
          const x = x0 + (i / (prices.length - 1)) * (x1 - x0);
          svg.appendChild(line(x, y0, x, y1, 0.6));
          svg.appendChild(label(Math.min(Math.max(x, x0), x1), height - 4, labelFor(date), 'middle'));
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

// Discord-identical chart: axes build + light card + heavier line. Single source
// for the Discord PNG (share-discord.js) and the click-to-expand popout below.
export function renderDiscordChart(timeSeries, width = 360, height = 100, title = '') {
  const topPad = title ? 22 : 0;
  const svg = renderSparkline(timeSeries, width, height, { axes: true, topPad });
  if (!svg) return null;
  const NS = 'http://www.w3.org/2000/svg';
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('rx', '8');
  bg.setAttribute('fill', '#f1f5f9');
  svg.insertBefore(bg, svg.firstChild);
  if (title) {
    const titleEl = document.createElementNS(NS, 'text');
    titleEl.setAttribute('x', '12');
    titleEl.setAttribute('y', '18');
    titleEl.setAttribute('fill', '#334155');
    titleEl.setAttribute('font-size', '12');
    titleEl.setAttribute('font-weight', '600');
    titleEl.setAttribute('font-family', 'inherit');
    const cleanTitle = String(title).replace(/\s+/g, ' ').trim();
    const maxChars = Math.max(10, Math.floor(width / 8));
    titleEl.textContent = cleanTitle.length > maxChars ? cleanTitle.slice(0, maxChars - 1) + '…' : cleanTitle;
    svg.appendChild(titleEl);
  }
  svg.querySelector('polyline')?.setAttribute('stroke-width', '2.5');
  return svg;
}

export function buildKeepaUrl(asin, days = 365, width = 560, height = 220) {
  if (!asin || typeof asin !== 'string') return '';
  return `https://graph.keepa.com/pricehistory.png?asin=${encodeURIComponent(asin.trim())}&domain=de&amazon=1&new=1&bb=1&range=${days}&width=${width}&height=${height}`;
}

export async function copySvgToClipboard(svgEl, width = 560, height = 220) {
  try {
    if (!svgEl || typeof document === 'undefined') return false;
    const svgText = new XMLSerializer().serializeToString(svgEl);
    const svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = svgUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(img, 0, 0, width * 2, height * 2);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      if (blob && typeof navigator?.clipboard?.write === 'function') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('📋 Diagramm in Zwischenablage kopiert');
        return true;
      }
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch (err) {
    console.debug('[Toppreise-Suite] SVG-Copy-Fehler', err);
  }
  showToast('❌ Kopieren fehlgeschlagen');
  return false;
}

export async function copyKeepaChartToClipboard(imgEl, titleText, asin, fallbackUrl = '') {
  let objectUrl = null;
  try {
    let sourceImg = imgEl;
    if (typeof GM_xmlhttpRequest !== 'undefined' && fallbackUrl) {
      try {
        const r = await gmRequestWithTimeout({
          method: 'GET',
          url: fallbackUrl,
          responseType: 'blob'
        }, { timeoutMs: 8000, source: 'sparkline', label: 'keepa' });
        if (!r?.response) throw new Error('no blob');
        const blob = r.response;
        objectUrl = URL.createObjectURL(blob);
        const tempImg = new Image();
        await new Promise((res, rej) => {
          tempImg.onload = res;
          tempImg.onerror = rej;
          tempImg.src = objectUrl;
        });
        sourceImg = tempImg;
      } catch (e) {}
    }

    const w = sourceImg?.naturalWidth || 560;
    const h = sourceImg?.naturalHeight || 220;
    const bannerHeight = 36;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h + bannerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, bannerHeight);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    const displayTitle = titleText ? `Amazon.de: ${titleText} (ASIN: ${asin})` : `Amazon.de: ASIN ${asin}`;
    ctx.fillText(displayTitle, 12, bannerHeight / 2, canvas.width - 24);

    if (sourceImg) {
      ctx.drawImage(sourceImg, 0, bannerHeight, w, h);
    }

    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (blob && typeof navigator?.clipboard?.write === 'function') {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('📋 Amazon-Diagramm in Zwischenablage kopiert');
      return true;
    }
  } catch (err) {
    console.debug('[Toppreise-Suite] Keepa-Copy-Fehler', err);
    if (fallbackUrl && typeof navigator?.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(fallbackUrl);
      showToast('📋 Bild-Link kopiert');
      return true;
    }
  } finally {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch {}
    }
  }
  showToast('❌ Kopieren fehlgeschlagen');
  return false;
}

let activePopoutCleanup = null;

export function closeSparklinePopout() {
  if (typeof document === 'undefined') return;
  if (activePopoutCleanup) { const fn = activePopoutCleanup; activePopoutCleanup = null; fn(); return; }
  document.getElementById('tp-sparkline-popout')?.remove();
}

// Click on a mini sparkline pops the full Discord-style chart. Backdrop/×/Esc closes.
export function openSparklinePopout(timeSeries, chartCtx = null) {
  if (typeof document === 'undefined') return null;
  closeSparklinePopout();
  const productTitle = chartCtx?.title || '';
  const svg = renderDiscordChart(timeSeries, 560, 220, productTitle);
  if (!svg) return null;
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  svg.style.display = 'block';

  const copyTpBtn = document.createElement('button');
  copyTpBtn.type = 'button';
  copyTpBtn.className = 'tp-popout-btn';
  copyTpBtn.textContent = '📋 Bild kopieren';
  copyTpBtn.setAttribute('title', 'Toppreise-Diagramm in Zwischenablage kopieren');
  copyTpBtn.addEventListener('click', () => copySvgToClipboard(svg, 560, 220));

  const { panel, mount, close } = createPopoutDialog({
    id: 'tp-sparkline-popout',
    label: 'Preisverlauf',
    title: productTitle ? `📈 Preisverlauf: ${productTitle}` : '📈 Preisverlauf',
    actions: [copyTpBtn],
    onClose: () => { activePopoutCleanup = null; }
  });
  activePopoutCleanup = close;
  panel.appendChild(svg);

  // Stacked Keepa section for Amazon deals
  const isAmazon = chartCtx?.dealer && /amazon/i.test(chartCtx.dealer) && CONFIG?.KEEPA_CHART_ENABLED !== false;
  if (isAmazon) {
    const keepaSection = document.createElement('div');
    keepaSection.id = 'tp-keepa-section';
    keepaSection.className = 'tp-keepa-section';

    const keepaHeader = document.createElement('div');
    keepaHeader.className = 'tp-keepa-header';

    const keepaTitle = document.createElement('div');
    keepaTitle.className = 'tp-keepa-title';
    keepaTitle.textContent = '🛒 Amazon.de Preisverlauf (Keepa)';

    const keepaToolbar = document.createElement('div');
    keepaToolbar.className = 'tp-keepa-toolbar';

    const ranges = [
      { label: '90T', days: 90 },
      { label: '180T', days: 180 },
      { label: '365T', days: 365, active: true },
      { label: 'Alle', days: 'all' }
    ];
    let currentDays = 365;
    const rangeBtns = [];

    const keepaBody = document.createElement('div');
    keepaBody.className = 'tp-keepa-body';

    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'tp-keepa-status';
    loadingIndicator.textContent = '⏳ Lade Amazon.de Keepa-Verlauf...';
    keepaBody.appendChild(loadingIndicator);

    const copyKeepaBtn = document.createElement('button');
    copyKeepaBtn.type = 'button';
    copyKeepaBtn.className = 'tp-popout-btn';
    copyKeepaBtn.textContent = '📋 Bild kopieren';
    copyKeepaBtn.hidden = true;

    ranges.forEach(r => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = r.label;
      const setBtnStyle = active => {
        btn.className = active ? 'tp-popout-chip tp-active' : 'tp-popout-chip';
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      };
      setBtnStyle(!!r.active);
      btn.addEventListener('click', () => {
        currentDays = r.days;
        rangeBtns.forEach(b => b.setBtnStyle(b === btn));
        if (keepaBody._tpUpdateRange) keepaBody._tpUpdateRange(r.days);
      });
      btn.setBtnStyle = setBtnStyle;
      rangeBtns.push(btn);
      keepaToolbar.appendChild(btn);
    });
    keepaToolbar.appendChild(copyKeepaBtn);

    keepaHeader.appendChild(keepaTitle);
    keepaHeader.appendChild(keepaToolbar);
    keepaSection.appendChild(keepaHeader);
    keepaSection.appendChild(keepaBody);
    panel.appendChild(keepaSection);

    // Resolve ASIN and display Keepa image
    resolveAmazonAsin(chartCtx.directUrl, chartCtx.pid).then(asin => {
      if (!asin) {
        if (keepaBody.replaceChildren) {
          keepaBody.replaceChildren();
        } else {
          while (keepaBody.firstChild) keepaBody.removeChild(keepaBody.firstChild);
        }
        const errNotice = document.createElement('div');
        errNotice.className = 'tp-keepa-status';
        const msgSpan = document.createElement('span');
        msgSpan.textContent = 'Amazon-ASIN konnte nicht ermittelt werden.';
        errNotice.appendChild(msgSpan);
        errNotice.appendChild(document.createElement('br'));
        const safeUrl = /^https?:\/\//i.test(chartCtx.directUrl || '') ? chartCtx.directUrl : '#';
        const a = document.createElement('a');
        a.href = safeUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'tp-popout-link';
        a.textContent = 'Zum Amazon-Angebot ↗';
        errNotice.appendChild(a);
        keepaBody.appendChild(errNotice);
        return;
      }

      keepaTitle.textContent = `🛒 Amazon.de: ${productTitle || asin} (ASIN: ${asin})`;
      copyKeepaBtn.hidden = false;

      const keepaUrlFor = days => buildKeepaUrl(asin, days);

      const img = document.createElement('img');
      img.className = 'tp-keepa-img';
      img.alt = `Keepa Preisverlauf für ${asin}`;
      img.src = keepaUrlFor(currentDays);

      copyKeepaBtn.onclick = () => {
        copyKeepaChartToClipboard(img, productTitle, asin, keepaUrlFor(currentDays));
      };

      keepaBody._tpUpdateRange = days => {
        img.src = keepaUrlFor(days);
      };

      const linksRow = document.createElement('div');
      linksRow.className = 'tp-keepa-links';
      const keepaLink = document.createElement('a');
      keepaLink.href = `https://keepa.com/#!product/3-${asin}`;
      keepaLink.target = '_blank';
      keepaLink.rel = 'noopener';
      keepaLink.className = 'tp-popout-link';
      keepaLink.textContent = 'Auf Keepa ansehen ↗';
      const amzLink = document.createElement('a');
      const safeDirect = /^https?:\/\//i.test(chartCtx.directUrl || '') ? chartCtx.directUrl : null;
      amzLink.href = safeDirect || `https://www.amazon.de/dp/${asin}`;
      amzLink.target = '_blank';
      amzLink.rel = 'noopener';
      amzLink.className = 'tp-popout-link';
      amzLink.textContent = 'Auf Amazon.de ansehen ↗';
      linksRow.appendChild(keepaLink);
      linksRow.appendChild(amzLink);

      keepaBody.replaceChildren();
      keepaBody.appendChild(img);
      keepaBody.appendChild(linksRow);
    }).catch(() => {
      keepaBody.replaceChildren();
      const errNotice = document.createElement('div');
      errNotice.className = 'tp-keepa-status';
      errNotice.textContent = 'Amazon Keepa-Verlauf konnte nicht geladen werden.';
      keepaBody.appendChild(errNotice);
    });
  }

  return mount();
}

