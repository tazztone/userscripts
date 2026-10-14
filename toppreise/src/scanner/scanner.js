/**
 * Price History & Product Scanner Engine
 * Handles background batch checking, live price history retrieval,
 * adaptive 429 rate-limit backoff, interruptible delays, and scan progress tracking.
 */

import { getCachedPriceStats, setCachedPriceStats } from './cache.js';
import { analyzePriceTimeSeries, parsePriceStatsFromHtml, extractCanonicalPrice } from '../domain/price.js';
import { getProductCards, getCardProductId, extractCardDiscount, applyCardFilters, isCardFilteredOut, parseNegativeTerms, extractOfferCount } from '../page/cards.js';
import { isShippingPriceActive, isNeueToppreisePage, triggerProcessListings } from '../page/adapter.js';
import { CONFIG } from '../state/config.js';
import { scanState } from '../state/store.js';

export const activeFetches = new Map();

async function interruptibleSleep(ms, shouldCancelFn = null) {
  const step = 100;
  let elapsed = 0;
  while (elapsed < ms) {
    if (shouldCancelFn && shouldCancelFn()) break;
    const wait = Math.min(step, ms - elapsed);
    await new Promise(r => setTimeout(r, wait));
    elapsed += wait;
  }
}

async function fetchPriceTimeSeries(productId, retries = 1, shouldCancelFn = null, useShipping = null) {
  if (!productId) return null;
  const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
  const postBody = `pcspagdpi=${encodeURIComponent(productId)}&pcspagdfdt=0000-00-00&pcspagdtd=&p_pc_ch=&lang=de`;
  const pickSeries = data => {
    const shippingActive = typeof useShipping === 'boolean' ? useShipping : isShippingPriceActive();
    if (Array.isArray(data)) {
      if (Array.isArray(data[0]) && data[0].length > 0 && Array.isArray(data[0][0])) {
        if (shippingActive && data.length > 1 && Array.isArray(data[1]) && data[1].length > 0 && Array.isArray(data[1][0])) {
          return data[1];
        }
        return data[0]; // Series 0: Produktpreis
      }
      if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
        return data; // Raw points [[t1, p1], [t2, p2]]
      }
    }
    if (Array.isArray(data?.series)) return data.series;
    if (Array.isArray(data?.data)) return data.data;
    return null;
  };
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (shouldCancelFn && shouldCancelFn()) return null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${baseUrl}/plugins/product/pricechart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        credentials: 'same-origin',
        body: postBody,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const series = pickSeries(await res.json());
        if (series) return series;
      } else if (res.status === 429) {
        const retryAfterHeader = res.headers?.get('Retry-After');
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
        if (attempt < retries) await interruptibleSleep((retryAfterSec && !isNaN(retryAfterSec)) ? retryAfterSec * 1000 : (1500 + attempt * 1000), shouldCancelFn);
      } else if (attempt < retries) {
        await interruptibleSleep(400 + attempt * 400, shouldCancelFn);
      }
    } catch (err) {
      if (attempt < retries) {
        await interruptibleSleep(400 + attempt * 400, shouldCancelFn);
      } else if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching time series for product', productId, err);
    }
  }
  return null;
}

export async function fetchSingleProductPriceStats(productId, retries = 1, forceFresh = false, shouldCancelFn = null, currentPrice = null) {
  if (!productId) return null;
  // Snapshot the shipping basis once: a mode toggle mid-fetch must not pick
  // the wrong series into the wrong slot, and each mode dedups independently.
  const useShipping = isShippingPriceActive();
  const fetchKey = `${productId}_${useShipping ? 's' : 'p'}`;
  // Refresh bypass: always hit the network, but keep the good entry in
  // memory/localStorage until the fetch succeeds — a failed refresh must
  // not downgrade a full analysis to an unavailable marker.
  const prev = getCachedPriceStats(productId);
  if (!forceFresh && prev) {
    if (prev.unavailable) return null;
    return prev;
  }

  if (activeFetches.has(fetchKey)) {
    return activeFetches.get(fetchKey);
  }

  const fetchPromise = (async () => {
    try {
      const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
      
      // 1. Primary fast route: POST JSON time-series (gives series + all aggregates in 1 request)
      try {
        const timeSeries = await fetchPriceTimeSeries(productId, retries, shouldCancelFn, useShipping);
        if (timeSeries && Array.isArray(timeSeries) && timeSeries.length >= 1) {
          const analysis = analyzePriceTimeSeries(timeSeries, currentPrice);
          if (analysis && analysis.tiefstpreis > 0) {
            analysis.isShippingPrice = useShipping;
            setCachedPriceStats(productId, analysis, false, undefined, useShipping);
            return analysis;
          }
        }
      } catch (seriesErr) {}

      // 2. Fallback route: GET HTML modal dialog
      const url = `${baseUrl}/plugins/product/pricechart?p_pc_pid=${encodeURIComponent(productId)}`;
      let resHtml = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (shouldCancelFn && shouldCancelFn()) return null;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 7000);
          resHtml = await fetch(url, {
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'text/html, */*; q=0.01'
            },
            credentials: 'same-origin',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (resHtml.ok) break;

          if (resHtml.status === 429) {
            const retryAfterHeader = resHtml.headers?.get('Retry-After');
            const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
            const backoffMs = (retryAfterSec && !isNaN(retryAfterSec)) ? retryAfterSec * 1000 : (1500 + attempt * 1000);
            if (attempt < retries) {
              await interruptibleSleep(backoffMs, shouldCancelFn);
            }
          } else if (attempt < retries) {
            await interruptibleSleep(400 + attempt * 400, shouldCancelFn);
          }
        } catch (fetchErr) {
          if (attempt < retries) {
            await interruptibleSleep(400 + attempt * 400, shouldCancelFn);
          } else {
            throw fetchErr;
          }
        }
      }

      if (!resHtml || !resHtml.ok) {
        if (!prev || !prev.medianPrice) setCachedPriceStats(productId, null, true, undefined, useShipping);
        return null;
      }
      const html = await resHtml.text();
      const stats = parsePriceStatsFromHtml(html);
      if (stats) {
        stats.isShippingPrice = useShipping;
        if (!stats.medianPrice && prev && !prev.unavailable && prev.medianPrice) return prev;
        setCachedPriceStats(productId, stats, false, undefined, useShipping);
        return stats;
      } else {
        if (!prev || !prev.medianPrice) setCachedPriceStats(productId, null, true, undefined, useShipping);
      }
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching price stats for product', productId, err);
      if (!prev || !prev.medianPrice) setCachedPriceStats(productId, null, true, undefined, useShipping);
    } finally {
      activeFetches.delete(fetchKey);
    }
    return null;
  })();

  activeFetches.set(fetchKey, fetchPromise);
  return fetchPromise;
}

export async function runProductScanner(options = {}) {
  const {
    filterFn = () => true,
    sortByDiscount = false,
    shouldCancelFn = () => false,
    onProgress = null,
    onComplete = null
  } = options;

  const cards = getProductCards();
  const targets = [];
  // Same pageHasOffers semantics as the processListings counter: offer-less
  // feeds must not min-offers-filter everything when Min >= 1.
  const pageHasOffers = cards.some(card => extractOfferCount(card) > 0);
  const termsList = parseNegativeTerms();

  for (const card of cards) {
    const pid = getCardProductId(card);
    if (!pid) continue;
    const cached = getCachedPriceStats(pid);
    if (cached) continue;
    const offerCount = extractOfferCount(card);
    if (isCardFilteredOut(card, applyCardFilters({ card, offerCount }, termsList, CONFIG.MIN_OFFERS, pageHasOffers), { forScan: true })) continue;
    const discount = extractCardDiscount(card) ?? 0;
    if (filterFn({ pid, card, discount })) {
      targets.push({ pid, card, discount });
    }
  }

  if (sortByDiscount) {
    targets.sort((a, b) => b.discount - a.discount);
  }

  const total = targets.length;
  let completed = 0;
  const newlyVerified = [];

  try {
    for (let i = 0; i < targets.length; i++) {
      if (shouldCancelFn()) break;
      const item = targets[i];
      Object.assign(scanState, { currentlyScanningPid: item.pid, progress: { completed, total } });
      try {
        const badgeEl = item.card.querySelector('.badge-dif, [class*="badge-dif"]');
        if (badgeEl) {
          badgeEl.classList.add('tp-deal-loading');
          badgeEl.innerHTML = badgeEl.classList.contains('tp-deal-pill')
            ? '<span>⏳</span><p>Prüfe...</p>'
            : '<div class="text">Prüfe...</div><p>⏳</p>';
        }
      } catch {}

      let stats = null;
      try {
        stats = await fetchSingleProductPriceStats(item.pid, 2, false, shouldCancelFn, (() => { try { const cp = extractCanonicalPrice(item.card).price; return Number.isFinite(cp) && cp > 0 ? cp : null; } catch { return null; } })());
        if (stats) newlyVerified.push({ pid: item.pid, card: item.card });
      } finally {
        Object.assign(scanState, { currentlyScanningPid: null });
      }

      completed++;
      Object.assign(scanState, { progress: { completed, total } });
      if (onProgress) onProgress(completed, total);
      // ponytail: progressive paint per verified card (batch CTA asserts
      // badges mid-scan); the pre-fetch full rescan stays removed.
      if (stats) triggerProcessListings();
      await interruptibleSleep(250, shouldCancelFn);
    }
  } finally {
    Object.assign(scanState, { currentlyScanningPid: null });
  }

  triggerProcessListings();
  if (onComplete) onComplete(completed, total, newlyVerified);
  return { completed, total, newlyVerified };
}

async function runScan({ minDiscount = 30, onProgress = null, onComplete = null } = {}) {
  if (scanState.isBatchChecking) {
    Object.assign(scanState, { batchCancelRequested: true });
    return;
  }
  Object.assign(scanState, { isBatchChecking: true, batchCancelRequested: false });

  try {
    const isFeed = isNeueToppreisePage();
    await runProductScanner({
      filterFn: (item => isFeed ? (item.discount >= minDiscount) : true),
      sortByDiscount: false,
      shouldCancelFn: (() => scanState.batchCancelRequested),
      onProgress,
      onComplete
    });
  } finally {
    Object.assign(scanState, { isBatchChecking: false, batchCancelRequested: false });
    triggerProcessListings();
  }
}

export const runBatchDealCheck = (minDiscount = 30, onProgress = null, onComplete = null) =>
  runScan({ minDiscount, onProgress, onComplete });

export function cancelBatchDealCheck() {
  Object.assign(scanState, { batchCancelRequested: true });
}
