/**
 * Price History & Product Scanner Engine
 * Handles background batch checking, live price history retrieval,
 * adaptive 429 rate-limit backoff, interruptible delays, and scan progress tracking.
 */

import { getCachedPriceStats, setCachedPriceStats } from './cache.js';
import { analyzePriceTimeSeries, parsePriceStatsFromHtml } from '../domain/price.js';
import { getProductCards, getCardProductId, extractCardDiscount } from '../page/cards.js';
import { CONFIG } from '../state/config.js';
import { setScanState } from '../state/store.js';

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
    const shippingActive = typeof isShippingPriceActive === 'function' ? isShippingPriceActive() : false;
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

export async function fetchSingleProductPriceStats(productId, retries = 1, forceFresh = false, onThrottle = null, shouldCancelFn = null) {
  if (!productId) return null;
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
            analysis.isShippingPrice = typeof isShippingPriceActive === 'function' ? isShippingPriceActive() : false;
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
            if (onThrottle) {
              onThrottle({ productId, attempt, backoffMs, status: resHtml.status });
            }
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
        stats.isShippingPrice = typeof isShippingPriceActive === 'function' ? isShippingPriceActive() : false;
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

export let currentlyScanningPid = null;

export async function runProductScanner(options = {}) {
  const {
    filterFn = () => true,
    sortFn = null,
    delayMs = 200,
    shouldCancelFn = () => false,
    onProgress = null,
    onComplete = null,
    onStatus = null
  } = options;

  const cards = getProductCards();
  const targets = [];

  for (const card of cards) {
    const pid = getCardProductId(card);
    if (!pid) continue;
    const cached = getCachedPriceStats(pid);
    if (cached) continue;
    if (typeof isCardIgnoredOrInvisible === 'function' && isCardIgnoredOrInvisible(card)) continue;
    const discount = extractCardDiscount(card) ?? 0;
    if (filterFn({ pid, card, discount })) {
      targets.push({ pid, card, discount });
    }
  }

  if (sortFn) {
    targets.sort(sortFn);
  }

  const total = targets.length;
  let completed = 0;

  try {
    for (let i = 0; i < targets.length; i++) {
      if (shouldCancelFn()) break;
      const item = targets[i];
      currentlyScanningPid = item.pid;
      setScanState({ currentlyScanningPid: item.pid, progress: { completed, total } });
      if (typeof processListings === 'function') processListings();

      try {
        await fetchSingleProductPriceStats(
          item.pid,
          2,
          false,
          throttleInfo => {
            const secs = Math.ceil(throttleInfo.backoffMs / 1000);
            if (onStatus) {
              onStatus(`⏳ Rate-Limit (${secs}s Pause)...`);
            }
          },
          shouldCancelFn
        );
      } finally {
        currentlyScanningPid = null;
        setScanState({ currentlyScanningPid: null });
      }

      completed++;
      setScanState({ progress: { completed, total } });
      if (onProgress) onProgress(completed, total);
      if (typeof processListings === 'function') processListings();
      const delay = typeof delayMs === 'function' ? delayMs() : delayMs;
      await interruptibleSleep(delay, shouldCancelFn);
    }
  } finally {
    currentlyScanningPid = null;
    setScanState({ currentlyScanningPid: null });
  }

  if (typeof processListings === 'function') processListings();
  if (onComplete) onComplete(completed, total);
  return { completed, total };
}

export let isBatchChecking = false;
export let batchCancelRequested = false;

export async function runBatchDealCheck(minDiscount = 30, onProgress = null, onComplete = null, onStatus = null) {
  if (isBatchChecking) {
    batchCancelRequested = true;
    setScanState({ batchCancelRequested: true });
    return;
  }
  isBatchChecking = true;
  batchCancelRequested = false;
  setScanState({ isBatchChecking: true, batchCancelRequested: false });

  try {
    const isFeed = typeof isNeueToppreisePage === 'function' ? isNeueToppreisePage() : false;
    await runProductScanner({
      filterFn: item => isFeed ? (item.discount >= minDiscount) : true,
      delayMs: () => 250 + Math.floor(Math.random() * 100),
      shouldCancelFn: () => batchCancelRequested,
      onProgress,
      onComplete,
      onStatus
    });
  } finally {
    isBatchChecking = false;
    batchCancelRequested = false;
    setScanState({ isBatchChecking: false, batchCancelRequested: false });
    if (typeof processListings === 'function') processListings();
  }
}

export function cancelBatchDealCheck() {
  batchCancelRequested = true;
  setScanState({ batchCancelRequested: true });
}

export let isBestpreiseScanning = false;
export let bestpreiseScanCancel = false;

export async function runBestpreiseScan(onProgress = null, onComplete = null) {
  if (isBestpreiseScanning) {
    bestpreiseScanCancel = true;
    setScanState({ bestpreiseScanCancel: true });
    return;
  }
  isBestpreiseScanning = true;
  bestpreiseScanCancel = false;
  setScanState({ isBestpreiseScanning: true, bestpreiseScanCancel: false });

  try {
    await runProductScanner({
      filterFn: () => true,
      sortFn: (a, b) => b.discount - a.discount,
      delayMs: 200,
      shouldCancelFn: () => bestpreiseScanCancel || !CONFIG.BESTPREISE_MODE_ACTIVE,
      onProgress,
      onComplete
    });
  } finally {
    isBestpreiseScanning = false;
    bestpreiseScanCancel = false;
    setScanState({ isBestpreiseScanning: false, bestpreiseScanCancel: false });
    if (typeof processListings === 'function') processListings();
  }
}

export function cancelBestpreiseScan() {
  bestpreiseScanCancel = true;
  setScanState({ bestpreiseScanCancel: true });
}
