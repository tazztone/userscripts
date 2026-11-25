/**
 * Price History & Product Scanner Engine
 * Handles background batch checking, live price history retrieval,
 * adaptive 429 rate-limit backoff, interruptible delays, and scan progress tracking.
 */

import { getCachedPriceStats, setCachedPriceStats, currentCacheGen } from './cache.js';
import { analyzePriceTimeSeries, parsePriceStatsFromHtml, extractCanonicalPrice } from '../domain/price.js';
import { getProductCards, getCardProductId, extractCardDiscount, extractCardData, extractActiveStores, dealerLoserFor, applyCardFilters, isCardFilteredOut, parseNegativeTerms, extractOfferCount, scanEligibility, scanCandidateState } from '../page/cards.js';
import { isShippingPriceActive, isNeueToppreisePage, triggerProcessListings } from '../page/adapter.js';
import { CONFIG } from '../state/config.js';
import { scanState } from '../state/store.js';
import { setHtmlIfChanged } from '../ui/badges/dom-helpers.js';
import { showToast } from '../ui/toast.js';
import { logActivity } from '../state/activity-log.js';
import { getOriginCooldownUntil, resetOriginCooldown } from '../state/net.js';

import { interruptibleSleep, isCancelled, requestWithRetry, fetchPriceTimeSeries } from './transport.js';

export const activeFetches = new Map();
export { resetOriginCooldown, requestWithRetry };

// Single-flight abort for the running batch scan. Next run replaces it.
let batchController = null;

// Per-caller cancel over a shared promise: rejects only this caller (typed
// `cancelled`), never the transport siblings still await.
function raceSharedRaw(promise, signal, shouldCancelFn) {
  if (signal?.aborted || shouldCancelFn?.()) {
    const e = new Error('cancelled');
    e.cancelled = true;
    return Promise.reject(e);
  }
  if (!signal && !shouldCancelFn) return promise;
  return new Promise((resolve, reject) => {
    let done = false;
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
      if (timer) clearInterval(timer);
    };
    const cancel = () => {
      if (done) return;
      done = true;
      cleanup();
      const e = new Error('cancelled');
      e.cancelled = true;
      reject(e);
    };
    const onAbort = () => cancel();
    // Event-driven abort via AbortSignal; fallback to polled timer only
    // when legacy shouldCancelFn was supplied without an AbortSignal.
    const timer = shouldCancelFn ? setInterval(() => { if (!done && shouldCancelFn()) cancel(); }, 50) : null;
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      v => { if (!done) { done = true; cleanup(); resolve(v); } },
      e => { if (!done) { done = true; cleanup(); reject(e); } }
    );
  });
}
export async function fetchSingleProductPriceStats(productId, retries = 1, forceFresh = false, shouldCancelFn = null, currentPrice = null, signal = null, preferredBasis = null) {
  if (!productId) return null;
  // Snapshot the shipping basis once: a mode toggle mid-fetch must not pick
  // the wrong series into the wrong slot, and each mode dedups independently.
  const useShipping = typeof preferredBasis === 'string'
    ? (preferredBasis === 'shipping')
    : (typeof preferredBasis === 'boolean' ? preferredBasis : isShippingPriceActive());
  const fetchKey = `${productId}_${useShipping ? 's' : 'p'}`;
  // Generation at network start: a clear/reset mid-flight voids every write below.
  const gen = currentCacheGen();
  // Refresh bypass: always hit the network, but keep the good entry in
  // memory/localStorage until the fetch succeeds — a failed refresh must
  // not downgrade a full analysis to an unavailable marker.
  const prev = getCachedPriceStats(productId, false, null, useShipping);
  if (!forceFresh && prev) {
    if (prev.unavailable) return null;
    return prev;
  }

  // Already cancelled: never touch the network (and never join the registry).
  if (isCancelled(signal, shouldCancelFn)) return null;

  // Shared raw history: the entry carries the transport only — no price
  // anchor, no caller signal. Each caller races it with its own cancel, then
  // analyzes with its own currentPrice. The transport aborts only when the
  // last consumer leaves, so one caller's cancel never kills a sibling fetch.
  let entry = activeFetches.get(fetchKey);
  // A clear/reset mid-flight voids the shared transport: never join an
  // entry from an older generation — abort it and start fresh.
  if (entry && entry.gen !== currentCacheGen()) {
    try { entry.abort?.abort(); } catch {}
    if (activeFetches.get(fetchKey) === entry) activeFetches.delete(fetchKey);
    entry = null;
  }
  if (!entry) {
    const abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const promise = fetchPriceTimeSeries(productId, retries, null, useShipping, abort?.signal ?? null);
    entry = { promise, abort, consumers: new Set(), gen: currentCacheGen() };
    activeFetches.set(fetchKey, entry);
    const release = () => { if (activeFetches.get(fetchKey) === entry) activeFetches.delete(fetchKey); };
    promise.then(release, release);
  }
  const consumer = { signal, shouldCancelFn };
  entry.consumers.add(consumer);
  let pick = null;
  try {
    pick = await raceSharedRaw(entry.promise, signal, shouldCancelFn);
  } catch (e) {
    if (e?.cancelled || e?.timeout || e?.cooldown || e?.transient || e?.unauthorized) return null;
    throw e;
  } finally {
    entry.consumers.delete(consumer);
    // An aborted transport must not stay joinable: drop it so the next
    // caller starts a fresh request instead of racing a dead promise.
    if (entry.consumers.size === 0) { try { entry.abort?.abort(); } catch {} if (activeFetches.get(fetchKey) === entry) activeFetches.delete(fetchKey); }
  }

  try {
    const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';

    // 1. Primary fast route: POST JSON time-series (gives series + all aggregates in 1 request)
    // Only the empty signal (pick null) reaches the HTML fallback; typed
    // failures (cancelled/timeout/cooldown/transient/unauthorized) return
    // immediately — a retry there cannot conjure a series.
    if (pick?.series && Array.isArray(pick.series) && pick.series.length >= 1) {
      if (Array.isArray(pick.altSeries) && pick.altSeries.length >= 1 && typeof pick.altIsShipping === 'boolean') {
        const altExisting = getCachedPriceStats(productId, false, null, pick.altIsShipping);
        if (!altExisting || !altExisting.medianPrice) {
          const altAnalysis = analyzePriceTimeSeries(pick.altSeries, null);
          if (altAnalysis && altAnalysis.tiefstpreis > 0) {
            altAnalysis.isShippingPrice = pick.altIsShipping;
            setCachedPriceStats(productId, altAnalysis, false, undefined, pick.altIsShipping, gen);
          }
        }
      }
      // Basis guard: a product-shape series must never land in the shipping
      // slot — fall through to the HTML path (which refuses the shipping
      // slot too and writes a negative entry instead).
      if (pick.isShipping === useShipping) {
        const analysis = analyzePriceTimeSeries(pick.series, currentPrice);
        if (analysis && analysis.tiefstpreis > 0) {
          analysis.isShippingPrice = useShipping;
          setCachedPriceStats(productId, analysis, false, undefined, useShipping, gen);
          return analysis;
        }
      } else if (!pick.isShipping && useShipping) {
        // Opportunistic product slot cache: we received a valid product-basis
        // series while querying in shipping mode. Guard against overwriting
        // existing richer/anchored product stats.
        const existing = getCachedPriceStats(productId, false, null, false);
        if (!existing || !existing.medianPrice) {
          const prodAnalysis = analyzePriceTimeSeries(pick.series, null);
          if (prodAnalysis && prodAnalysis.tiefstpreis > 0) {
            prodAnalysis.isShippingPrice = false;
            setCachedPriceStats(productId, prodAnalysis, false, undefined, false, gen);
          }
        }
      }
    }

    if (isCancelled(signal, shouldCancelFn)) return null;

    if (useShipping) {
      // HTML modal dialog carries no shipping basis: skip request entirely
      if (!prev || !prev.medianPrice) setCachedPriceStats(productId, null, true, undefined, true, gen);
      return null;
    }

    // 2. Fallback route: GET HTML modal dialog (carries no basis info)
    const url = `${baseUrl}/plugins/product/pricechart?p_pc_pid=${encodeURIComponent(productId)}`;
    let resHtml = null;
    let html = null;
    try {
      const out = await requestWithRetry(async linkedSignal => {
        const res = await fetch(url, {
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'text/html, */*; q=0.01'
          },
          credentials: 'same-origin',
          signal: linkedSignal
        });
        const text = res.ok ? await res.text() : null;
        return { res, data: text };
      }, { retries, shouldCancelFn, signal, baseDelayMs: 400, timeoutMs: 7000 });
      resHtml = out.res;
      html = out.data;
    } catch (htmlErr) {
      // Cancelled/timeout/429/5xx/network/cooldown: transient, never a
      // negative entry (a failed refresh must not downgrade prev either).
      return null;
    }
    // Unauthorized HTML (login wall): no negative entry, no prev downgrade.
    if (resHtml && !resHtml.ok && (resHtml.status === 401 || resHtml.status === 403)) return null;
    const stats = parsePriceStatsFromHtml(html);
    if (stats) {
      stats.isShippingPrice = false;
      if (!stats.medianPrice && prev && !prev.unavailable && prev.medianPrice) return prev;
      setCachedPriceStats(productId, stats, false, undefined, false, gen);
      return stats;
    } else {
      if (!prev || !prev.medianPrice) setCachedPriceStats(productId, null, true, undefined, false, gen);
    }
  } catch (err) {
    // Cancelled/timeout: silent, no negative write. Genuine failures keep
    // the no-downgrade rule (prev with median survives).
    if (!err?.cancelled && !err?.timeout && CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching price stats for product', productId, err);
    if (!err?.cancelled && !err?.timeout && (!prev || !prev.medianPrice)) setCachedPriceStats(productId, null, true, undefined, useShipping, gen);
  }
  return null;
}

export async function runProductScanner(options = {}) {
  const {
    filterFn = null,
    isFeed = undefined,
    minDiscount = 30,
    sortByDiscount = false,
    shouldCancelFn = () => false,
    onProgress = null,
    onComplete = null,
    signal = null
  } = options;

  const cards = getProductCards();
  const targets = [];
  // Same pageHasOffers semantics as the processListings counter: offer-less
  // feeds must not min-offers-filter everything when Min >= 1.
  const pageHasOffers = cards.some(card => extractOfferCount(card) > 0);
  const termsList = parseNegativeTerms();
  const activeStores = extractActiveStores();
  const isDealFeed = typeof isFeed === 'boolean' ? isFeed : isNeueToppreisePage();

  const seenTargets = new Set();
  for (const card of cards) {
    const cd = extractCardData(card);
    if (!cd.pid) continue;
    const targetKey = `${cd.pid}:${cd.cardPriceBasis}`;
    if (seenTargets.has(targetKey)) continue;

    cd.filters = applyCardFilters(cd, termsList, CONFIG.MIN_OFFERS, pageHasOffers, isDealFeed);
    cd.filters.isDealerLoser = dealerLoserFor(card, activeStores);

    const elig = scanCandidateState(cd, { isFeed: isDealFeed, minDiscount });
    if (!elig?.canScan) continue;

    const discount = cd.discountVal ?? 0;
    if (filterFn && !filterFn({ pid: cd.pid, card, discount })) continue;

    seenTargets.add(targetKey);
    targets.push({ pid: cd.pid, card, discount });
  }

  if (sortByDiscount) {
    targets.sort((a, b) => b.discount - a.discount);
  }

  const total = targets.length;
  let completed = 0;
  const newlyVerified = [];
  const pendingIndices = targets.map((_, i) => i);
  let abortedByCooldown = false;
  const effectiveCancel = () => abortedByCooldown || isCancelled(signal, shouldCancelFn);
  let cooldownToastShown = false;
  const pidInFlightCount = new Map();
  let lastRenderAt = 0;

  async function worker() {
    while (!abortedByCooldown && !isCancelled(signal, shouldCancelFn)) {
      if (pendingIndices.length === 0) break;
      const preCooldownMs = getOriginCooldownUntil() - Date.now();
      if (preCooldownMs > 15000) {
        abortedByCooldown = true;
        if (!cooldownToastShown) {
          cooldownToastShown = true;
          showToast('⏳ Rate-Limit erreicht – Prüfung pausiert');
        }
        break;
      }
      if (preCooldownMs > 0) {
        await interruptibleSleep(preCooldownMs + 250, () => abortedByCooldown || isCancelled(signal, shouldCancelFn), signal);
        continue;
      }
      const idx = pendingIndices.shift();
      if (idx === undefined) break;
      const item = targets[idx];
      pidInFlightCount.set(item.pid, (pidInFlightCount.get(item.pid) || 0) + 1);
      scanState.batchScanningPids.add(item.pid);
      scanState.currentlyScanningPid = item.pid;
      try {
        const badgeEl = item.card.querySelector('.badge-dif, [class*="badge-dif"]');
        if (badgeEl) {
          badgeEl.classList.add('tp-deal-loading');
          setHtmlIfChanged(
            badgeEl,
            badgeEl.classList.contains('tp-deal-pill')
              ? '<span>⏳</span><p>Prüfe...</p>'
              : '<div class="text">Prüfe...</div><p>⏳</p>'
          );
        }
      } catch {}

      let stats = null;
      let cardValid = false;
      try {
        // Pre-fetch identity guard: skip the fetch when the card detached or
        // was reused for another product while queued (post-fetch guard stays).
        if (item.card.isConnected && getCardProductId(item.card) === item.pid) {
          cardValid = true;
          const { price: cardPrice, basis: cardBasis } = extractCanonicalPrice(item.card);
          const cardElig = scanEligibility(item.card, { pid: item.pid, cardPrice, cardPriceBasis: cardBasis });
          const forceFresh = cardElig.state === 'basis-mismatch';
          const cp = Number.isFinite(cardPrice) && cardPrice > 0 ? cardPrice : null;
          stats = await fetchSingleProductPriceStats(item.pid, 2, forceFresh, effectiveCancel, cp, signal, cardBasis);
          // Card-identity guard: reused/detached cards must not collect an
          // earlier request's verification.
          if (!(item.card.isConnected && getCardProductId(item.card) === item.pid)) {
            stats = null;
            cardValid = false;
          } else if (stats) {
            newlyVerified.push({ pid: item.pid, card: item.card });
          }
        }
      } finally {
        const remaining = (pidInFlightCount.get(item.pid) || 1) - 1;
        if (remaining <= 0) {
          pidInFlightCount.delete(item.pid);
          scanState.batchScanningPids.delete(item.pid);
        } else {
          pidInFlightCount.set(item.pid, remaining);
        }
        if (scanState.currentlyScanningPid === item.pid) {
          scanState.currentlyScanningPid = scanState.batchScanningPids.values().next().value ?? null;
        }
      }

      const postCooldownMs = getOriginCooldownUntil() - Date.now();
      if (!stats && cardValid && postCooldownMs > 0) {
        triggerProcessListings();
        if (postCooldownMs > 15000) {
          abortedByCooldown = true;
          if (!cooldownToastShown) {
            cooldownToastShown = true;
            showToast('⏳ Rate-Limit erreicht – Prüfung pausiert');
          }
          break;
        }
        pendingIndices.unshift(idx);
        await interruptibleSleep(postCooldownMs + 250, () => abortedByCooldown || isCancelled(signal, shouldCancelFn), signal);
        continue;
      }

      completed++;
      Object.assign(scanState, { progress: { completed, total } });
      if (onProgress) onProgress(completed, total);
      // Progressive paint throttled during batch scan; completion always flushes.
      const now = Date.now();
      if (now - lastRenderAt >= 250) {
        lastRenderAt = now;
        triggerProcessListings();
      }
      const paceMs = (typeof document !== 'undefined' && document.visibilityState === 'hidden') ? 500 : 250;
      await interruptibleSleep(paceMs, () => abortedByCooldown || isCancelled(signal, shouldCancelFn), signal);
    }
  }

  try {
    const worker1 = worker();
    const worker2 = (async () => {
      if (targets.length > 1) {
        await interruptibleSleep(125, () => abortedByCooldown || isCancelled(signal, shouldCancelFn), signal);
      }
      if (!abortedByCooldown && !isCancelled(signal, shouldCancelFn)) await worker();
    })();
    await Promise.all([worker1, worker2]);
  } finally {
    scanState.batchScanningPids.clear();
    Object.assign(scanState, { currentlyScanningPid: null });
  }

  triggerProcessListings();
  const meta = { abortedByCooldown };
  if (onComplete) onComplete(completed, total, newlyVerified, meta);
  return { completed, total, newlyVerified, abortedByCooldown };
}

async function runScan({ minDiscount = 30, onProgress = null, onComplete = null } = {}) {
  if (scanState.isBatchChecking) {
    Object.assign(scanState, { batchCancelRequested: true });
    try { batchController?.abort(); } catch {}
    return;
  }
  Object.assign(scanState, { isBatchChecking: true, batchCancelRequested: false });
  batchController = new AbortController();

  try {
    const isFeed = isNeueToppreisePage();
    const res = await runProductScanner({
      isFeed,
      minDiscount,
      sortByDiscount: false,
      shouldCancelFn: (() => scanState.batchCancelRequested),
      onProgress,
      onComplete,
      signal: batchController.signal
    });
    if (res?.abortedByCooldown) scanState.batchCancelRequested = true;
  } finally {
    Object.assign(scanState, { isBatchChecking: false, batchCancelRequested: false });
    triggerProcessListings();
  }
}

export const runBatchDealCheck = (minDiscount = 30, onProgress = null, onComplete = null) =>
  runScan({ minDiscount, onProgress, onComplete });

export function cancelBatchDealCheck() {
  Object.assign(scanState, { batchCancelRequested: true });
  logActivity('info', 'scanner', 'Batch-Prüfung abgebrochen');
  try { batchController?.abort(); } catch {}
}
