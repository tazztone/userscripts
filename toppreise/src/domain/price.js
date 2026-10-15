/**
 * Pure Price Domain Logic
 * Handles number formatting, integer cent conversions, canonical price resolution,
 * HTML price extraction, time-series anomaly sanitization, and rolling horizon statistics.
 */

import { CONFIG } from '../state/config.js';
import { isShippingPriceActive } from '../page/adapter.js';

export const priceToCents = p => Math.round((parseFloat(p) || 0) * 100);
// Canonical discount/markup shapes: every call site already checks direction,
// so no internal guards. Keep `|| 0` fallbacks at call sites.
export const pctDrop = (base, price) => Math.round(((base - price) / base) * 100);
export const pctRise = (base, price) => Math.round(((price - base) / base) * 100);

// True median: odd n takes the middle, even n averages the two middle
// values (no upper-median bias from floor(n/2) indexing).
const medianOf = sorted => {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const parsePrice = str => {
  if (!str) return 0;
  let clean = str.replace(/\.(?:–|-)|\s*[.–\-]\s*$/g, '.00').replace(/[^\d,.]/g, '');

  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  const lastSeparator = Math.max(lastComma, lastDot);

  if (lastSeparator === -1) {
    return parseFloat(clean) || 0;
  }

  const digitsAfterSeparator = clean.length - lastSeparator - 1;

  if (digitsAfterSeparator === 3) {
    clean = clean.replace(/[.,]/g, '');
  } else {
    const before = clean.substring(0, lastSeparator).replace(/[.,]/g, '');
    const after = clean.substring(lastSeparator + 1);
    clean = before + '.' + after;
  }

  return parseFloat(clean) || 0;
};

export function extractCanonicalPrice(card) {
  if (!card) return { price: 0, el: null, basis: null };

  if (card._tpPriceInfo) {
    const els = Object.values(card._tpPriceInfo);
    if (els.some(el => el && card.contains?.(el) === false)) delete card._tpPriceInfo;
  }
  if (!card._tpPriceInfo) {
     const mainPriceInfo = card.querySelector?.('.Plugin_PriceInformation, .price_information_product') || null;
     let fallbackShipping = null;
     let fallbackProduct = null;
     if (!mainPriceInfo && card.querySelector) {
       fallbackShipping = card.querySelector('.priceContainer.shippingPrice .Plugin_Price');
       fallbackProduct = card.querySelector('.priceContainer.productPrice .Plugin_Price');
     }
     card._tpPriceInfo = {
       mainPriceInfo,
       mainShipping: mainPriceInfo?.querySelector?.('.shippingPrice .Plugin_Price') || null,
       mainProduct: mainPriceInfo?.querySelector?.('.productPrice .Plugin_Price') || null,
       fallbackShipping,
       fallbackProduct
     };
   }

  const { mainPriceInfo, mainShipping, mainProduct, fallbackShipping, fallbackProduct } = card._tpPriceInfo;

  const useShipping = isShippingPriceActive(card);

  let priceEl = null;
  if (mainPriceInfo) {
    priceEl = useShipping
      ? (mainShipping || mainProduct)
      : (mainProduct || mainShipping);
  }

  if (!priceEl) {
    priceEl = useShipping
      ? (fallbackShipping || fallbackProduct)
      : (fallbackProduct || fallbackShipping);
  }

  // Basis follows the winning element: callers comparing against per-mode
  // history must refuse cross-basis prices instead of scoring them.
  const basis = !priceEl ? null
    : (priceEl === mainShipping || priceEl === fallbackShipping) ? 'shipping'
    : (priceEl === mainProduct || priceEl === fallbackProduct) ? 'product' : null;
  return {
    price: priceEl ? parsePrice(priceEl.textContent) : 0,
    el: priceEl,
    basis
  };
}

export function parsePriceStatsFromHtml(html) {
  if (!html) return null;

  const hasDOMParser = typeof DOMParser !== 'undefined';
  const doc = hasDOMParser ? new DOMParser().parseFromString(html, 'text/html') : null;

  const titleEls = doc ? [...doc.querySelectorAll('.title,.col-12.title'), ...[...doc.querySelectorAll('div')].filter(el => el.children.length === 0)] : [];
  const titleByText = new Map();
  for (const el of titleEls) {
    const key = el.textContent.trim().toLowerCase();
    if (!titleByText.has(key)) titleByText.set(key, el);
  }
  const extractPrice = titleText => {
    if (doc) {
      const found = titleByText.get(titleText.toLowerCase());
      if (found) {
        if (found.nextElementSibling?.classList.contains('Plugin_Price')) {
          const val = parsePrice(found.nextElementSibling.textContent);
          if (val > 0) return val;
        }
        const nextPrice = found.nextElementSibling?.querySelector?.('.chartProductPrice .Plugin_Price, .Plugin_Price');
        if (nextPrice) {
          const val = parsePrice(nextPrice.textContent);
          if (val > 0) return val;
        }
        const parentCol = found.closest?.('.col-4, .col-md-3, .col-md, .cell') ||
                          (found.parentElement && !found.parentElement.classList.contains('title') ? found.parentElement : null) ||
                          found.parentElement?.parentElement;
        const priceEl = parentCol?.querySelector?.('.chartProductPrice .Plugin_Price, .Plugin_Price');
        if (priceEl) {
          const val = parsePrice(priceEl.textContent);
          if (val > 0) return val;
        }
      }
    }
    const escapedTitle = titleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reg = new RegExp(`${escapedTitle}[\\s\\S]{1,400}?class="[^"]*Plugin_Price[^"]*"[^>]*>\\s*(?:[A-Za-z]+\\s*)?([\\d.,'\\s]+)`, 'i');
    const match = html.match(reg);
    if (match && match[1]) {
      const val = parsePrice(match[1]);
      if (val > 0) return val;
    }
    return null;
  };

  const tiefstpreis = extractPrice('Tiefstpreis') ??
                      extractPrice('Prix le plus bas') ??
                      extractPrice('Prezzo più basso') ??
                      extractPrice('Lowest price');
  const hoechstpreis = extractPrice('Höchstpreis') ??
                       extractPrice('Prix le plus haut') ??
                       extractPrice('Prezzo più alto') ??
                       extractPrice('Highest price');
  const aktuellerToppreis = extractPrice('aktueller Toppreis') ??
                            extractPrice('Meilleur prix actuel') ??
                            extractPrice('Miglior prezzo attuale') ??
                            extractPrice('Current best price');

  if (tiefstpreis !== null) {
    return { tiefstpreis, hoechstpreis, aktuellerToppreis };
  }
  return null;
}

export function rollingMedians(points) {
  const n = (points || []).length;
  return (points || []).map((_, m) => {
    const win = [];
    for (let w = Math.max(0, m - 15); w <= Math.min(n - 1, m + 15); w++) win.push(points[w][1]);
    return medianOf(win.sort((a, b) => a - b));
  });
}

export function sanitizeTimeSeries(points, band = CONFIG.OUTLIER_DEVIATION_BAND, maxGlitchHours = CONFIG.OUTLIER_MAX_GLITCH_HOURS, currentPrice = null) {
  const isLiveAnchored = p => typeof currentPrice === 'number' && currentPrice > 0 && priceToCents(p) === priceToCents(currentPrice);
  if (!(band > 0 && band < 1)) band = 0.50;
  if (!Number.isFinite(maxGlitchHours) || maxGlitchHours <= 0) maxGlitchHours = 48;
  const sorted0 = Array.isArray(points) ? [...points].sort((a, b) => a[0] - b[0]) : [];
  const rawMin = sorted0.length ? Math.min(...sorted0.map(p => p[1])) : 0;
  if (!points || points.length < 3) {
    return { cleanPoints: points || [], filteredOutliers: [], rawMedian: 0, rawMin };
   }

  const sorted = sorted0;
  const prices = sorted.map(p => p[1]).sort((a, b) => a - b);
  const rawMedian = medianOf(prices);

  if (rawMedian <= 0) {
    return { cleanPoints: sorted, filteredOutliers: [], rawMedian: 0, rawMin };
   }
  const cleanPoints = [];
  const filteredOutliers = [];
  const n = sorted.length;
  // Rolling ±15-point local medians: a sustained level (launch prices,
  // regime shifts) is normal against its neighbors even when far from the
  // lifetime median. Edge windows shrink; no padding.
  // ponytail: O(n·31 log 31) scan; fine at n ≈ 4000, no optimization.
  const localMedians = rollingMedians(sorted);
  const isNormalAt = m => localMedians[m] > 0 && Math.abs(sorted[m][1] - localMedians[m]) / localMedians[m] <= band;
  const localThreshold = Math.min(band, 0.05);
  const isLocallySharp = m => {
    const refs = [];
    if (m > 0) refs.push(sorted[m - 1][1]);
    if (m < n - 1) refs.push(sorted[m + 1][1]);
    if (!refs.length) return true;
    const ref = refs.length > 1 ? (refs[0] + refs[1]) / 2 : refs[0];
    return ref > 0 && Math.abs(sorted[m][1] - ref) / ref > localThreshold;
  };
  let i = 0;
  while (i < n) {
    if (isNormalAt(i)) {
      cleanPoints.push(sorted[i]);
      i++;
      continue;
    }
    const j = i;
    let k = j;
    while (k < n && !isNormalAt(k)) k++;
    const startTs = sorted[j - 1]?.[0] ?? sorted[j][0];
    const endTs = sorted[k]?.[0] ?? sorted[k - 1][0];
    const runH = (endTs - startTs) / 3600000;
    let isGlitch = runH <= maxGlitchHours + 0.5;
    if (isGlitch) for (let m = j; m < k; m++) if (!isLocallySharp(m)) { isGlitch = false; break; }
    if (isGlitch && k - j === 1 && (j === 0 || k === n) && n > 1) { const nb = j === 0 ? 1 : n - 2; if (!isNormalAt(nb)) isGlitch = false; }
    if (isGlitch && k === n) for (let m = j; m < k; m++) if (isLiveAnchored(sorted[m][1])) { isGlitch = false; break; }
    for (let m = j; m < k; m++) {
      const [ts, price] = sorted[m];
      if (isGlitch) filteredOutliers.push({ timestamp: ts, price, rawMedian });
      else cleanPoints.push(sorted[m]);
    }
    i = k;
  }

  return {
    cleanPoints: cleanPoints.length >= 2 ? cleanPoints : sorted,
    filteredOutliers,
    rawMedian,
    rawMin,
    localMedians
  };
}

export function analyzePriceTimeSeries(series, currentPrice = null, horizonOverride = null, nowMs = Date.now()) {
  if (!series || !Array.isArray(series) || series.length === 0) return null;

  let rawPoints = series;
  if (Array.isArray(series[0]) && series[0].length > 0 && Array.isArray(series[0][0])) {
    rawPoints = series[0];
  }

  const toMs = tsRaw => {
    const ts = typeof tsRaw === 'number' ? tsRaw : parseInt(tsRaw, 10);
    return ts < 1e12 ? ts * 1000 : ts;
  };
  const rawParsedPoints = rawPoints.map(p => {
    if (Array.isArray(p) && p.length >= 2) {
      const ts = toMs(p[0]);
      const pr = typeof p[1] === 'number' ? p[1] : parsePrice(String(p[1]));
      return pr > 0 ? [ts, pr] : null;
    }
    if (p && typeof p.price === 'number' && p.price > 0) {
      return [toMs(p.timestamp || p.time || 0), p.price];
    }
    return null;
  }).filter(Boolean);

  if (rawParsedPoints.length === 0) return null;
  // Normalize regardless of outlier toggle: validate, sort ascending, dedupe
  // duplicate timestamps keeping the LAST occurrence.
  const seen = new Map();
  for (const [ts, pr] of rawParsedPoints) {
    if (!Number.isFinite(ts) || ts <= 0 || ts > nowMs + 86400000) continue;
    if (!Number.isFinite(pr) || pr <= 0) continue;
    seen.set(ts, pr);
  }
  const normPoints = [...seen.entries()].sort((a, b) => a[0] - b[0]);
  if (normPoints.length === 0) return null;

  const outlierRejectionEnabled = (CONFIG.OUTLIER_REJECTION_ENABLED !== false);
  const sanitizeResult = outlierRejectionEnabled
    ? sanitizeTimeSeries(normPoints, CONFIG.OUTLIER_DEVIATION_BAND, CONFIG.OUTLIER_MAX_GLITCH_HOURS, currentPrice)
    : { cleanPoints: normPoints, filteredOutliers: [], rawMin: Math.min(...normPoints.map(p => p[1])) };

  const points = sanitizeResult.cleanPoints;
  const filteredOutliers = sanitizeResult.filteredOutliers;

  const prices = points.map(p => p[1]);
  const curr = (typeof currentPrice === 'number' && currentPrice > 0) ? currentPrice : prices[prices.length - 1];
  const allTimeLow = Math.min(...prices);
  const allTimeHigh = Math.max(...prices);

  // Trailing-plateau walk: only points already AT (or below) the current price
  // belong to the current regime. Strict cent comparison — the old 1% band
  // swallowed sub-1% dips into the plateau and overstated micro-records.
  const currCents = priceToCents(curr);
  let idx = prices.length - 1;
  while (idx > 0 && priceToCents(prices[idx]) <= currCents) {
    idx--;
  }
  const historicalPrices = prices.slice(0, idx + 1);
  const previousLow = historicalPrices.length > 0 ? Math.min(...historicalPrices) : allTimeLow;

  const horizonDays = typeof horizonOverride === 'number'
    ? horizonOverride
    : (typeof CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS === 'number'
      ? CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS
      : 365);
  // Thin windows (< 3 points) fall back to the full history — flagged via
  // medianFallback so labels stay honest ("Lifetime", never "1J").
  let windowPrices = prices;
  let medianFallback = false;
  if (horizonDays > 0) {
    const cutoffTime = nowMs - horizonDays * 86400 * 1000;
    const windowPoints = points.filter(p => p[0] >= cutoffTime);
    if (windowPoints.length >= 3) {
      windowPrices = windowPoints.map(p => p[1]);
    } else {
      medianFallback = true;
    }
  }

  // Chart sampling is daily & uniform (verified live: 607–3825 pts per
  // product, max gap 1.0d) — equal-weight median == time-weighted median,
  // so no duration weighting is needed.
  const sortedWindow = [...windowPrices].sort((a, b) => a - b);
  const medianPrice = medianOf(sortedWindow);

  const isNewAllTimeLow = previousLow > 0 && priceToCents(curr) < priceToCents(previousLow);

  const realDiscountVsPrevLow = (previousLow > 0 && isNewAllTimeLow)
    ? pctDrop(previousLow, curr)
    : 0;

  const realDiscountVsMedian = (medianPrice > curr)
    ? pctDrop(medianPrice, curr)
    : 0;

  return {
    tiefstpreis: allTimeLow,
    hoechstpreis: allTimeHigh,
    previousLow: previousLow > 0 ? previousLow : null,
    medianPrice: Math.round(medianPrice * 100) / 100,
    medianFallback,
    horizonDays,
    filteredOutliers,
    isNewAllTimeLow,
    realDiscountVsPrevLow,
    realDiscountVsMedian,
    dataPointCount: points.length,
    timeSeries: points,
    anchorPrice: curr,
    ...(sanitizeResult.filteredOutliers.length ? { rawTimeSeries: normPoints } : null),
    rawTiefstpreis: sanitizeResult.rawMin ?? Math.min(...normPoints.map(p => p[1]))
  };
}

/**
 * Live-anchored record reference for one concrete offer price.
 * The cached analysis anchors its trailing-plateau walk at the series' last
 * point, which lags live offers (daily sampling): a fresh undercut then
 * reports an ancient regime low as "Bisher". Re-running the same walk
 * anchored at the live card price returns exactly what the analysis would
 * have produced had it known the price — same walk, right anchor.
 * Stats without a series (HTML fallback) keep their stored values.
 */
export function recordRefForPrice(stats, cardPrice) {
  const stored = { previousLow: stats?.previousLow ?? null, isNewRecord: !!stats?.isNewAllTimeLow };
  const pts = stats?.timeSeries;
  if (!(cardPrice > 0) || !Array.isArray(pts) || pts.length === 0) return stored;
  const cCents = priceToCents(cardPrice);
  const priceOf = p => (Array.isArray(p) ? p[1] : p?.price);
  let idx = pts.length - 1;
  while (idx > 0 && priceToCents(priceOf(pts[idx])) <= cCents) idx--;
  const hist = pts.slice(0, idx + 1).map(priceOf).filter(p => typeof p === 'number' && p > 0);
  if (hist.length === 0) return stored;
  const prevLow = Math.min(...hist);
  return { previousLow: prevLow, isNewRecord: prevLow > 0 && cCents < priceToCents(prevLow) };
}
