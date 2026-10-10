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
  let clean = str.replace(/[.–\-]\s*$/g, '.00');
  clean = clean.replace(/[^\d,.]/g, '').replace(/['’\s]/g, '');

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
  if (!card) return { price: 0, el: null };

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

  return {
    price: priceEl ? parsePrice(priceEl.textContent) : 0,
    el: priceEl
  };
}

export function parsePriceStatsFromHtml(html) {
  if (!html) return null;

  const hasDOMParser = typeof DOMParser !== 'undefined';
  const doc = hasDOMParser ? new DOMParser().parseFromString(html, 'text/html') : null;

  const extractPrice = titleText => {
    if (doc) {
      const titleEls = Array.from(doc.querySelectorAll('.title, .col-12.title, div'));
      const found = titleEls.find(el => el.textContent.trim().toLowerCase() === titleText.toLowerCase());
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

export function sanitizeTimeSeries(points) {
  if (!points || points.length < 3) {
    return { cleanPoints: points || [], filteredOutliers: [] };
  }

  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  const prices = sorted.map(p => p[1]).sort((a, b) => a - b);
  const rawMedian = prices[Math.floor(prices.length / 2)];

  if (rawMedian <= 0) {
    return { cleanPoints: sorted, filteredOutliers: [] };
  }

  const cleanPoints = [];
  const filteredOutliers = [];
  const n = sorted.length;

  for (let i = 0; i < n; i++) {
    const [ts, price] = sorted[i];
    // Symmetric glitch band: a point >60% off the median is a feed glitch
    // iff it is brief (<48h) with normal neighbours on both sides; a
    // sustained level shifts the regime and is kept. Edges need only the
    // single adjacent neighbour (no duration context).
    const dev = Math.abs(price - rawMedian) / rawMedian;
    if (dev <= 0.6) {
      cleanPoints.push(sorted[i]);
      continue;
    }

    const isNormal = p => Math.abs(p - rawMedian) / rawMedian <= 0.6;
    let isGlitch = false;
    if (i > 0 && i < n - 1) {
      const nextTs = sorted[i + 1][0];
      const durationHours = (nextTs && ts && nextTs > ts) ? (nextTs - ts) / (3600 * 1000) : 24;
      if (durationHours < 48 && isNormal(sorted[i - 1][1]) && isNormal(sorted[i + 1][1])) {
        isGlitch = true;
      }
    } else if (i === 0 && n > 1) {
      if (isNormal(sorted[1][1])) isGlitch = true;
    } else if (i === n - 1 && n > 1) {
      if (isNormal(sorted[n - 2][1])) isGlitch = true;
    }

    if (isGlitch) {
      filteredOutliers.push({ timestamp: ts, price, rawMedian });
    } else {
      cleanPoints.push(sorted[i]);
    }
  }

  return {
    cleanPoints: cleanPoints.length >= 2 ? cleanPoints : sorted,
    filteredOutliers
  };
}

export function analyzePriceTimeSeries(series, currentPrice = null) {
  if (!series || !Array.isArray(series) || series.length === 0) return null;

  let rawPoints = series;
  if (Array.isArray(series[0]) && series[0].length > 0 && Array.isArray(series[0][0])) {
    rawPoints = series[0];
  }

  const rawParsedPoints = rawPoints.map(p => {
    if (Array.isArray(p) && p.length >= 2) {
      const ts = typeof p[0] === 'number' ? p[0] : parseInt(p[0], 10);
      const pr = typeof p[1] === 'number' ? p[1] : parsePrice(String(p[1]));
      return pr > 0 ? [ts, pr] : null;
    }
    if (p && typeof p.price === 'number' && p.price > 0) {
      return [p.timestamp || p.time || 0, p.price];
    }
    return null;
  }).filter(Boolean);

  if (rawParsedPoints.length === 0) return null;

  const outlierRejectionEnabled = (CONFIG.OUTLIER_REJECTION_ENABLED !== false);
  const sanitizeResult = outlierRejectionEnabled
    ? sanitizeTimeSeries(rawParsedPoints)
    : { cleanPoints: rawParsedPoints, filteredOutliers: [] };

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

  const horizonDays = typeof CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS === 'number'
    ? CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS
    : 365;
  // Thin windows (< 3 points) fall back to the full history — flagged via
  // medianFallback so labels stay honest ("Lifetime", never "1J").
  let windowPrices = prices;
  let medianFallback = false;
  if (horizonDays > 0) {
    const now = Date.now();
    const cutoffTime = now - horizonDays * 86400 * 1000;
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
    timeSeries: points
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
