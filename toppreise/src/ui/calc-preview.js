import { sanitizeTimeSeries, recordRefForPrice, pctDrop, priceToCents, parsePrice, rollingMedians } from "../domain/price.js";
import { horizonText, horizonUiToStored, minPointsFromIndex, clampMinPoints } from "../state/config.js";
import { getCachedPriceStats } from "../scanner/cache.js";
import { SELECTORS } from "../page/selectors.js";
import { DAY_MS, PRESET_DATA_S26, PRESET_DATA_R5, PRESET_DATA_SSD990, PRESET_DATA_SYNTHETIC, expandRleSeries, PRESETS, getPreset } from './calc-preset-data.js';
export { DAY_MS, PRESET_DATA_S26, PRESET_DATA_R5, PRESET_DATA_SSD990, PRESET_DATA_SYNTHETIC, expandRleSeries, PRESETS, getPreset };


export const fmtPreviewMedian = v => String(Number(v.toFixed(2)));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function previewStats(points, o) {
  const band = o?.band ?? 0.50;
  const hours = o?.hours ?? 48;
  const enabled = o?.enabled !== false;
  const horizonDays = o?.horizonDays ?? 365;
  const wRaw = o?.weightRecord ?? 0.50;
  const weightRecord = Math.max(0, Math.min(1, wRaw));
  const minPoints = clampMinPoints(o?.minPoints ?? 5);
  const cardPrice = o?.cardPrice ?? 0;
  const now = o?.now ?? Date.now();

  const san = enabled
    ? sanitizeTimeSeries(points, band, hours, o?.cardPrice > 0 ? o.cardPrice : null)
    : { cleanPoints: points || [], filteredOutliers: [] };
  const clean = san.cleanPoints || [];
  const prices = clean.map(p => p[1]);
  const tiefstpreis = prices.length ? Math.min(...prices) : 0;
  const hoechstpreis = prices.length ? Math.max(...prices) : 0;

  let windowPrices = prices;
  let windowCount = prices.length;
  let medianFallback = false;
  if (horizonDays > 0) {
    const cutoff = now - horizonDays * DAY_MS;
    const w = clean.filter(p => p[0] >= cutoff);
    if (w.length >= 3) {
      windowPrices = w.map(p => p[1]);
      windowCount = w.length;
    } else {
      medianFallback = true;
    }
  }
  const sorted = [...windowPrices].sort((a, b) => a - b);
  const n = sorted.length;
  const rawMedian = n === 0 ? 0 : (n % 2 ? sorted[n >> 1] : (sorted[(n >> 1) - 1] + sorted[n >> 1]) / 2);
  const median = Math.round(rawMedian * 100) / 100;

  const dMedian = median > cardPrice ? pctDrop(median, cardPrice) : 0;
  const live = recordRefForPrice({ timeSeries: clean }, cardPrice);
  const dRecord = (live.isNewRecord && live.previousLow > cardPrice) ? pctDrop(live.previousLow, cardPrice) : 0;

  const varianceOk = tiefstpreis > 0 && (hoechstpreis - tiefstpreis) / tiefstpreis >= 0.02;
  const qualifies = clean.length >= minPoints && varianceOk
    && priceToCents(cardPrice) <= priceToCents(tiefstpreis) && (dMedian > 0 || dRecord > 0);
  const badge = qualifies
    ? Math.max(1, Math.round((1 - weightRecord) * dMedian + weightRecord * dRecord))
    : null;
  const recordLow = live.previousLow ?? 0;
  const cutoffTs = horizonDays > 0 && !medianFallback ? now - horizonDays * DAY_MS : null;

  return { median, medianFallback, windowCount, activeCount: clean.length, dropped: san.filteredOutliers || [], tiefstpreis, dMedian, dRecord, badge, qualifies, clean, localMedians: ((san.filteredOutliers || []).length === 0 && san.localMedians) ? san.localMedians : rollingMedians(clean), recordLow, cutoffTs, filterMedian: enabled ? (san.rawMedian || 0) : 0 };
}

export function cropPreviewWindow(clean, dropped, cutoffTs) {
  if (cutoffTs === null || cutoffTs === undefined) return { visibleDropped: dropped || [] };
  return {
    visibleDropped: (dropped || []).filter(g => g.timestamp >= cutoffTs),
  };
}

const PV_MARGIN = { top: 8, right: 10, bottom: 16, left: 40 };

export function previewCoords(clean, o = {}) {
  const w = o.w || 296;
  const h = o.h || 110;
  const m = PV_MARGIN;
  const innerW = w - m.left - m.right;
  const innerH = h - m.top - m.bottom;
  const pts = clean || [];
  const n = pts.length;
  const prices = pts.map(p => p[1]);
  const vals = [...prices];
  for (const g of (o.dropped || [])) if (typeof g.price === 'number' && g.price > 0) vals.push(g.price);
  if (typeof o.cardPrice === 'number' && o.cardPrice > 0) vals.push(o.cardPrice);
  if (typeof o.median === 'number' && o.median > 0) vals.push(o.median);
  let lo = vals.length ? Math.min(...vals) : 0;
  let hi = vals.length ? Math.max(...vals) : 1;
  if (!(hi > lo)) hi = lo + 1;
  const pad = (hi - lo) * 0.05;
  const y = v => m.top + (1 - (v - (lo - pad)) / ((hi + pad) - (lo - pad))) * innerH;
  const t0 = n ? pts[0][0] : 0;
  const t1 = n ? pts[n - 1][0] : 0;
  const f1 = v => v.toFixed(1);
  const fracX = ts => m.left + (t1 > t0 ? Math.max(0, Math.min(1, (ts - t0) / (t1 - t0))) * innerW : 0);
  const pt = p => `${f1(fracX(p[0]))},${f1(y(p[1]))}`;
  const pointsAttr = pts.map(pt).join(' ');
  const recordY = (typeof o.recordLow === 'number' && o.recordLow > 0) ? y(o.recordLow) : null;
  let ribbonAttr = null, ribbonTopAttr = null, ribbonBotAttr = null;
  if (o.band > 0 && Array.isArray(o.localMedians) && o.localMedians.length === n && n > 0 && o.localMedians.every(v => v > 0)) {
    const tops = [], bots = [];
    for (let q = 0; q < n; q++) {
      const med = o.localMedians[q];
      tops.push(`${f1(fracX(pts[q][0]))},${f1(Math.max(m.top, Math.min(h - m.bottom, y(med * (1 + o.band)))))}`);
      bots.push(`${f1(fracX(pts[q][0]))},${f1(Math.max(m.top, Math.min(h - m.bottom, y(med * (1 - o.band)))))}`);
    }
    ribbonTopAttr = tops.join(' ');
    ribbonBotAttr = bots.join(' ');
    ribbonAttr = ribbonTopAttr + ' ' + [...bots].reverse().join(' ');
  }
  const medianY = o.median > 0 ? y(o.median) : null;
  const glitchXY = (o.dropped || []).map(g => ({ x: fracX(g.timestamp), y: y(g.price) }));
  const anchor = (typeof o.cardPrice === 'number' && o.cardPrice > 0)
    ? { x: m.left + innerW, y: y(o.cardPrice) }
    : null;
  let anchorLink = null;
  if (n > 0 && anchor) {
    const y1 = y(pts[n - 1][1]);
    if (Math.abs(y1 - anchor.y) >= 0.5) anchorLink = { x1: anchor.x, y1, x2: anchor.x, y2: anchor.y };
  }
  const rawAttr = o.raw?.length ? o.raw.map(p => `${f1(fracX(p[0]))},${f1(y(p[1]))}`).join(' ') : null;
  const ticks = [{ y: y(hi), label: fmtPreviewMedian(hi) }, { y: y(lo), label: fmtPreviewMedian(lo) }];
  if (o.median > 0) { const my = y(o.median); if (Math.abs(my - y(hi)) >= 10 && Math.abs(my - y(lo)) >= 10) ticks.splice(1, 0, { y: my, label: fmtPreviewMedian(o.median) }); }
  return { pointsAttr, ribbonAttr, ribbonTopAttr, ribbonBotAttr, medianY, glitchXY, anchor, anchorLink, ticks, recordY, rawAttr, fracX };
}

let activePresetId = 's26';

export function buildCalcPreview() {
  const box = document.createElement('div');
  box.id = 'tp-calc-preview';
  const opts = `<optgroup label="Beispiel-Historien">${Object.values(PRESETS).map(p => `<option value="${p.id}"${p.id === 's26' ? ' selected' : ''}>${p.label}</option>`).join('')}</optgroup>`;
  box.innerHTML = `<div class="tp-preview-head"><span>Live-Vorschau</span><select id="tp-preview-preset-select" class="tp-preview-select" title="Beispiel-Historie für die Vorschau">${opts}</select></div>`
    + `<div id="tp-preview-key"><span><span class="tp-pv-k-main">—</span> Verlauf</span><span><span class="tp-pv-k-med">– –</span> Ø</span><span><span class="tp-pv-k-rec">····</span> Rekord</span><span><span class="tp-pv-k-band">▉</span> Band</span><span><span class="tp-pv-k-demo">···</span> Demo</span><span><span class="tp-pv-k-g">×</span> Glitch</span></div>`
    + `<svg id="tp-preview-svg" viewBox="0 0 296 110" role="img" aria-label="Preisverlauf-Vorschau"></svg>`
    + `<div id="tp-preview-legend"></div><div id="tp-preview-blend"></div><div id="tp-preview-status"></div>`;
  const sel = box.querySelector('#tp-preview-preset-select');
  if (sel) sel.addEventListener('change', () => {
    activePresetId = sel.value || 's26';
    refreshCalcPreview();
  });
  return box;
}

export function getPageProductOptions(limit = 30) {
  const out = [];
  const seen = new Set();
  let cards = [];
  try {
    cards = Array.from(document.querySelectorAll(SELECTORS.cards.standard));
  } catch (e) { return out; }
  if (!cards.length) {
    try { cards = Array.from(document.querySelectorAll('a.Plugin_Product, .mixedBrowsingListProduct')); } catch (e) { return out; }
  }
  for (const card of cards) {
    if (out.length >= limit) break;
    const pid = card.dataset?.entityId || card.dataset?.tpProductId;
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    let entry = null;
    try { entry = getCachedPriceStats(pid); } catch (e) { continue; }
    if (!entry || entry.unavailable || !Array.isArray(entry.timeSeries) || !entry.timeSeries.length) continue;
    const title = (card.querySelector('.title')?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const med = typeof entry.medianPrice === 'number' && entry.medianPrice > 0 ? ` · Ø ${fmtPreviewMedian(entry.medianPrice)}` : '';
    out.push({ pid, label: esc(`${title || `pid ${pid}`}${med}`), card });
  }
  return out;
}

export function refreshCalcPreview() {
  const svg = document.getElementById('tp-preview-svg');
  const legend = document.getElementById('tp-preview-legend');
  const blend = document.getElementById('tp-preview-blend');
  const status = document.getElementById('tp-preview-status');
  if (!svg || !legend || !blend || !status) return;
  const sel = document.getElementById('tp-preview-preset-select');
  const pageOpts = getPageProductOptions();
  const prevVal = sel ? sel.value : activePresetId;
  if (sel) {
    sel.innerHTML = `<optgroup label="Beispiel-Historien">${Object.values(PRESETS).map(p => `<option value="${p.id}">${p.label}</option>`).join('')}</optgroup>`
      + (pageOpts.length ? `<optgroup label="Geprüfte Produkte auf dieser Seite">${pageOpts.map(o => `<option value="page:${esc(o.pid)}">${o.label}</option>`).join('')}</optgroup>` : '');
    sel.value = (PRESETS[prevVal] || (typeof prevVal === 'string' && prevVal.startsWith('page:') && pageOpts.some(o => `page:${o.pid}` === prevVal))) ? prevVal : activePresetId;
  }
  const selVal = sel ? sel.value : activePresetId;
  const now = Date.now();
  let points;
  let cardPrice;
  const pageHit = typeof selVal === 'string' && selVal.startsWith('page:') ? pageOpts.find(o => `page:${o.pid}` === selVal) : null;
  if (pageHit) {
    activePresetId = selVal;
    const entry = getCachedPriceStats(pageHit.pid) || {};
    points = Array.isArray(entry.timeSeries) ? entry.timeSeries : [];
    const live = parsePrice(pageHit.card.querySelector('.productPrice .Plugin_Price')?.textContent || '');
    cardPrice = live > 0 ? live : (entry.anchorPrice || 0);
  } else {
    const preset = getPreset(selVal);
    activePresetId = preset.id;
    points = expandRleSeries(preset.rle, now);
    cardPrice = preset.cardPrice;
  }
  const num = (id, fb) => {
    const el = document.getElementById(id);
    if (!el) return fb;
    const v = parseInt(el.value, 10);
    return isNaN(v) ? fb : v;
  };
  const weightRecord = Math.max(0, Math.min(1, num('tp-bar-weight-range', 50) / 100));
  const hRaw = num('tp-bar-horizon-range', 365);
  const horizonDays = horizonUiToStored(hRaw);
  const rangeEl = document.getElementById('tp-bar-minpoints-range');
  const minPoints = minPointsFromIndex(rangeEl ? rangeEl.value : undefined);
  const toggle = document.getElementById('tp-bar-outlier-toggle');
  const enabled = toggle ? toggle.checked : true;
  const band = Math.min(50, Math.max(1, num('tp-bar-outlier-band-range', 50))) / 100;
  const hours = Math.min(168, Math.max(24, num('tp-bar-outlier-hours-range', 48)));
  const st = previewStats(points, { band, hours, enabled, horizonDays, weightRecord, minPoints, cardPrice, now });
  const { visibleDropped } = cropPreviewWindow(st.clean, st.dropped, st.cutoffTs);
  const visibleRaw = (enabled && visibleDropped.length > 0) ? (st.cutoffTs ? points.filter(p => p[0] >= st.cutoffTs) : points) : null;
  const co = previewCoords(st.clean, { median: st.median, localMedians: st.localMedians, band: enabled ? band : 0, cardPrice, dropped: visibleDropped, recordLow: st.recordLow, raw: visibleRaw });
  const f1 = v => v.toFixed(1);
  const mainStroke = st.activeCount < minPoints ? '#94a3b8' : '#3b82f6';
  let s = '';
  if (co.rawAttr) s += `<polyline class="tp-pv-raw" points="${co.rawAttr}" fill="none" stroke="#94a3b8" stroke-width="1" opacity="0.45" vector-effect="non-scaling-stroke"/>`;
  if (st.cutoffTs != null) {
    const cx = co.fracX(st.cutoffTs);
    s += `<rect x="${PV_MARGIN.left}" y="${PV_MARGIN.top}" width="${f1(Math.max(0, cx - PV_MARGIN.left))}" height="${110 - PV_MARGIN.top - PV_MARGIN.bottom}" fill="#64748b" opacity="0.22"/>`;
    s += `<line class="tp-pv-cut" x1="${f1(cx)}" x2="${f1(cx)}" y1="${PV_MARGIN.top}" y2="${110 - PV_MARGIN.bottom}" stroke="#64748b" stroke-dasharray="3 2" stroke-width="1"/>`;
    s += `<text x="${f1(cx + 3)}" y="${PV_MARGIN.top + 8}" font-size="8" fill="#64748b">${horizonText(horizonDays)}</text>`;
  }
  if (co.ribbonAttr != null) s += `<polygon class="tp-pv-band" points="${co.ribbonAttr}" fill="#3b82f6" opacity="0.08"/>`;
  for (const edge of [co.ribbonTopAttr, co.ribbonBotAttr]) {
    if (edge != null) s += `<polyline class="tp-pv-band-edge" points="${edge}" fill="none" stroke="#3b82f6" stroke-width="1" opacity="0.45" vector-effect="non-scaling-stroke"/>`;
  }
  for (const t of co.ticks) {
    s += `<text x="36" y="${f1(t.y + 3)}" font-size="9" fill="#64748b" text-anchor="end">${t.label}</text>`;
  }
  if (st.recordLow > 0 && st.dRecord > 0 && co.recordY !== null) {
    s += `<line class="tp-pv-rec" x1="${PV_MARGIN.left}" x2="${296 - PV_MARGIN.right}" y1="${f1(co.recordY)}" y2="${f1(co.recordY)}" stroke="#f59e0b" stroke-dasharray="4 3" stroke-width="1" vector-effect="non-scaling-stroke" opacity="${0.25 + 0.75 * weightRecord}"/>`;
  }
  if (co.medianY !== null) {
    s += `<line class="tp-pv-med" x1="${PV_MARGIN.left}" x2="${296 - PV_MARGIN.right}" y1="${f1(co.medianY)}" y2="${f1(co.medianY)}" stroke="#64748b" stroke-dasharray="4 3" stroke-width="1" vector-effect="non-scaling-stroke" opacity="${0.25 + 0.75 * (1 - weightRecord)}"/>`;
  }
  if (co.pointsAttr) {
    s += `<polyline class="tp-pv-main" points="${co.pointsAttr}" fill="none" stroke="${mainStroke}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  }
  for (const g of co.glitchXY) {
    s += `<text class="tp-pv-x" x="${f1(g.x)}" y="${f1(g.y - 3)}" font-size="10" fill="#f43f5e" text-anchor="middle">×</text>`;
  }
  if (co.anchor) {
    if (co.anchorLink) s += `<line class="tp-pv-anchor-link" x1="${f1(co.anchorLink.x1)}" y1="${f1(co.anchorLink.y1)}" x2="${f1(co.anchorLink.x2)}" y2="${f1(co.anchorLink.y2)}" stroke="${mainStroke}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
    s += `<line x1="${PV_MARGIN.left}" x2="${f1(co.anchor.x)}" y1="${f1(co.anchor.y)}" y2="${f1(co.anchor.y)}" stroke="${mainStroke}" stroke-dasharray="2 2" stroke-width="1"/>`;
    s += `<circle cx="${f1(co.anchor.x)}" cy="${f1(co.anchor.y)}" r="3" fill="${mainStroke}" stroke="#fff" stroke-width="1"/>`;
  }
  svg.innerHTML = s;
  const n = visibleDropped.length;
  if (!enabled) {
    legend.textContent = 'Ausreißer-Filter aus — Rohhistorie';
  } else {
    legend.innerHTML = `<span class="tp-pv-chip">🧹 ${n} Glitch${n === 1 ? '' : 'es'}</span><span class="tp-pv-chip">📊 ${st.windowCount} Pkt ${st.activeCount >= minPoints ? '✓' : '✗'}</span>`;
  }
  if (st.qualifies) {
    const w = Math.round(weightRecord * 100);
    blend.innerHTML = `<span class="badge-dif tp-deal-alltime-low">⚖️ −${st.badge}%</span><span class="tp-pv-formula"><i style="width:${100 - w}%"></i><b style="width:${w}%"></b></span>`;
  } else {
    blend.textContent = 'kein Tiefstpreis zum Demo-Preis – kein Badge';
  }
  const windowPart = horizonDays === 0 ? `${st.windowCount} Punkte` : `${st.windowCount} im Fenster`;
  status.textContent = `\u00d8 ${fmtPreviewMedian(st.median)} \u00b7 ${horizonText(horizonDays)} \u00b7 ${windowPart} \u00b7 ${st.activeCount} aktiv (min. ${minPoints} ${st.activeCount >= minPoints ? '\u2713' : '\u2717'})`;
}
