/**
 * Price History & Product Scanner Engine
 * Handles background batch checking, live price history retrieval,
 * adaptive 429 rate-limit backoff, interruptible delays, and scan progress tracking.
 */

import { getCachedPriceStats, setCachedPriceStats, memoryCache, STATS_CACHE_PREFIX } from './cache.js';
import { analyzePriceTimeSeries, parsePriceStatsFromHtml } from '../domain/price.js';
import { getProductCards, getCardProductId, extractCardDiscount, applyCardFilters, isCardFilteredOut, parseNegativeTerms, extractOfferCount } from '../page/cards.js';
import { isShippingPriceActive, isNeueToppreisePage, triggerProcessListings } from '../page/adapter.js';
import { CONFIG } from '../state/config.js';
import { scanState } from '../state/store.js';

export const activeFetches = new Map();

export async function interruptibleSleep(ms, shouldCancelFn = null) {
  const step = 100;
  let elapsed = 0;
  while (elapsed < ms) {
    if (shouldCancelFn && shouldCancelFn()) break;
    const wait = Math.min(step, ms - elapsed);
    await new Promise(r => setTimeout(r, wait));
    elapsed += wait;
  }
}

export async function fetchPriceTimeSeries(productId) {
  if (!productId) return null;
  try {
    const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const postBody = `pcspagdpi=${encodeURIComponent(productId)}&pcspagdfdt=0000-00-00&pcspagdtd=&p_pc_ch=&lang=de`;
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
    if (!res.ok) return null;
    const data = await res.json();
    const shippingActive = isShippingPriceActive();
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
  } catch (err) {
    if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching time series for product', productId, err);
    return null;
  }
}

export async function fetchSingleProductPriceStats(productId, retries = 1, forceFresh = false, shouldCancelFn = null) {
  if (!productId) return null;
  // Refresh bypass: evict any cached entry (positive or negative) so the
  // manual "Aktualisieren" click always hits the network. Without this,
  // forceFresh only skipped negative entries and served stale positives.
  if (forceFresh) { memoryCache.delete(productId); try { if (typeof localStorage !== 'undefined') localStorage.removeItem(STATS_CACHE_PREFIX + productId); } catch (e) {} }
  const cached = getCachedPriceStats(productId, forceFresh);
  if (cached) {
    if (cached.unavailable) return null;
    return cached;
  }

  if (activeFetches.has(productId)) {
    return activeFetches.get(productId);
  }

  const fetchPromise = (async () => {
    try {
      const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
      
      // 1. Primary fast route: POST JSON time-series (gives series + all aggregates in 1 request)
      try {
        const timeSeries = await fetchPriceTimeSeries(productId);
        if (timeSeries && Array.isArray(timeSeries) && timeSeries.length >= 1) {
          const analysis = analyzePriceTimeSeries(timeSeries);
          if (analysis && analysis.tiefstpreis > 0) {
            analysis.isShippingPrice = isShippingPriceActive();
            setCachedPriceStats(productId, analysis);
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
        setCachedPriceStats(productId, null, true);
        return null;
      }
      const html = await resHtml.text();
      const stats = parsePriceStatsFromHtml(html);
      if (stats) {
        stats.isShippingPrice = isShippingPriceActive();
        setCachedPriceStats(productId, stats);
        return stats;
      } else {
        setCachedPriceStats(productId, null, true);
      }
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching price stats for product', productId, err);
      setCachedPriceStats(productId, null, true);
    } finally {
      activeFetches.delete(productId);
    }
    return null;
  })();

  activeFetches.set(productId, fetchPromise);
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
    if (isCardFilteredOut(card, applyCardFilters({ card, offerCount }, termsList, CONFIG.MIN_OFFERS, pageHasOffers), { includeHiddenUnchecked: true })) continue;
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

  try {
    for (let i = 0; i < targets.length; i++) {
      if (shouldCancelFn()) break;
      const item = targets[i];
      Object.assign(scanState, { currentlyScanningPid: item.pid, progress: { completed, total } });
      triggerProcessListings();

      try {
        await fetchSingleProductPriceStats(item.pid, 2, false, shouldCancelFn);
      } finally {
        Object.assign(scanState, { currentlyScanningPid: null });
      }

      completed++;
      Object.assign(scanState, { progress: { completed, total } });
      if (onProgress) onProgress(completed, total);
      triggerProcessListings();
      await interruptibleSleep(250, shouldCancelFn);
    }
  } finally {
    Object.assign(scanState, { currentlyScanningPid: null });
  }

  triggerProcessListings();
  if (onComplete) onComplete(completed, total);
  return { completed, total };
}

async function runScan(mode, { minDiscount = 30, onProgress = null, onComplete = null } = {}) {
  const isBatch = mode === 'batch';
  if (isBatch ? scanState.isBatchChecking : scanState.isBestpreiseScanning) {
    Object.assign(scanState, isBatch ? { batchCancelRequested: true } : { bestpreiseScanCancel: true });
    return;
  }
  Object.assign(scanState, isBatch
    ? { isBatchChecking: true, batchCancelRequested: false }
    : { isBestpreiseScanning: true, bestpreiseScanCancel: false });

  try {
    const isFeed = isBatch && isNeueToppreisePage();
    await runProductScanner({
      filterFn: isBatch ? (item => isFeed ? (item.discount >= minDiscount) : true) : (() => true),
      sortByDiscount: !isBatch,
      shouldCancelFn: isBatch
        ? (() => scanState.batchCancelRequested)
        : (() => scanState.bestpreiseScanCancel || !CONFIG.BESTPREISE_MODE_ACTIVE),
      onProgress,
      onComplete
    });
  } finally {
    Object.assign(scanState, isBatch
      ? { isBatchChecking: false, batchCancelRequested: false }
      : { isBestpreiseScanning: false, bestpreiseScanCancel: false });
    triggerProcessListings();
  }
}

export const runBatchDealCheck = (minDiscount = 30, onProgress = null, onComplete = null) =>
  runScan('batch', { minDiscount, onProgress, onComplete });

export function cancelBatchDealCheck() {
  Object.assign(scanState, { batchCancelRequested: true });
}

export const runBestpreiseScan = (onProgress = null, onComplete = null) =>
  runScan('bestpreise', { onProgress, onComplete });

export function cancelBestpreiseScan() {
  Object.assign(scanState, { bestpreiseScanCancel: true });
}
