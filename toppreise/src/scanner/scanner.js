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

export const activeFetches = new Map();

// Single-flight abort for the running batch scan. Next run replaces it.
let batchController = null;
// Shared across JSON + HTML paths (same origin): set on 429 exhaustion.
let originCooldownUntil = 0;
export function resetOriginCooldown() { originCooldownUntil = 0; }

async function interruptibleSleep(ms, shouldCancelFn = null, signal = null) {
  const step = 100;
  let elapsed = 0;
  while (elapsed < ms) {
    if (signal?.aborted) return;
    if (shouldCancelFn && shouldCancelFn()) break;
    const wait = Math.min(step, ms - elapsed);
    await new Promise(r => setTimeout(r, wait));
    elapsed += wait;
  }
}

const backoffMs = (attempt, baseDelayMs = 400) =>
  Math.min(8000, baseDelayMs * 2 ** attempt) + Math.random() * 250;

const parseRetryAfterMs = (header, baseDelayMs, attempt) => {
  if (header != null && String(header).trim() !== '') {
    const secs = Number(String(header).trim());
    if (Number.isFinite(secs)) return Math.max(0, Math.min(60000, secs * 1000));
    const at = Date.parse(String(header).trim());
    if (Number.isFinite(at)) return Math.max(0, Math.min(60000, at - Date.now()));
  }
  return backoffMs(attempt, baseDelayMs);
};

const isCancelled = (signal, shouldCancelFn) => signal?.aborted || shouldCancelFn?.();

// Central retry: makeRequest(linkedSignal, attempt) must do fetch AND body
// reads with the linked signal, so the per-attempt timeout below covers body
// reads too (cleared in finally after makeRequest resolves). Returns the
// makeRequest value on HTTP 200; returns it on non-429 4xx (caller maps to
// genuinely-absent); throws transient/cancelled/cooldown otherwise — never
// writes cache itself.
export async function requestWithRetry(makeRequest, { retries = 1, shouldCancelFn = null, signal = null, baseDelayMs = 400, timeoutMs = 6000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (isCancelled(signal, shouldCancelFn)) {
      const e = new Error('cancelled');
      e.cancelled = true;
      throw e;
    }
    if (Date.now() < originCooldownUntil) {
      const e = new Error('cooldown');
      e.cooldown = true;
      throw e;
    }
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const { res, data } = await makeRequest(ctrl.signal, attempt);
      if (res.ok) return { res, data };
      if (res.status === 429) {
        const wait = parseRetryAfterMs(res.headers?.get('Retry-After'), baseDelayMs, attempt);
        if (attempt < retries) {
          await interruptibleSleep(wait, shouldCancelFn, signal);
          continue;
        }
        originCooldownUntil = Date.now() + Math.max(wait, baseDelayMs);
        const e = new Error('429');
        e.transient = true;
        throw e;
      }
      if (res.status >= 500) {
        if (attempt < retries) {
          await interruptibleSleep(backoffMs(attempt, baseDelayMs), shouldCancelFn, signal);
          continue;
        }
        const e = new Error(`HTTP ${res.status}`);
        e.transient = true;
        throw e;
      }
      return { res, data };
    } catch (err) {
      if (err?.cancelled || err?.cooldown || err?.transient) throw err;
      // Parent cancellation (outer signal / predicate) wins over the
      // attempt's own timeout: both abort the linked controller, so check
      // the parent first or every timeout looks like a cancellation.
      if (signal?.aborted || shouldCancelFn?.()) {
        const e = new Error('cancelled');
        e.cancelled = true;
        throw e;
      }
      if (ctrl.signal.aborted) {
        // This attempt's own timer fired: retry like any transient instead
        // of exiting on the first attempt.
        if (attempt < retries) {
          await interruptibleSleep(backoffMs(attempt, baseDelayMs), shouldCancelFn, signal);
          continue;
        }
        const e = new Error('timeout');
        e.timeout = true;
        throw e;
      }
      // Backstop for aborts neither parent nor timer explains (e.g. a fetch
      // implementation aborting without the controller flag).
      if (err?.name === 'AbortError') {
        const e = new Error('timeout');
        e.timeout = true;
        throw e;
      }
      if (err?.name === 'SyntaxError') {
        const e = new Error('invalid-json');
        e.cause = err;
        throw e;
      }
      if (attempt < retries) {
        await interruptibleSleep(backoffMs(attempt, baseDelayMs), shouldCancelFn, signal);
        continue;
      }
      const e = new Error('network');
      e.transient = true;
      e.cause = err;
      throw e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  const e = new Error('network');
  e.transient = true;
  throw e;
}

async function fetchPriceTimeSeries(productId, retries = 1, shouldCancelFn = null, useShipping = null, signal = null) {
  if (!productId) return null;
  const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
  const postBody = `pcspagdpi=${encodeURIComponent(productId)}&pcspagdfdt=0000-00-00&pcspagdtd=&p_pc_ch=&lang=de`;
  // isShipping true ONLY when shipping was requested AND the data[1] branch
  // was taken; every other shape is basis-unconfirmed → treat as product.
  const pickSeries = data => {
    const shippingActive = typeof useShipping === 'boolean' ? useShipping : isShippingPriceActive();
    if (Array.isArray(data)) {
      if (Array.isArray(data[0]) && data[0].length > 0 && Array.isArray(data[0][0])) {
        if (shippingActive && data.length > 1 && Array.isArray(data[1]) && data[1].length > 0 && Array.isArray(data[1][0])) {
          return { series: data[1], isShipping: true };
        }
        return { series: data[0], isShipping: false }; // Series 0: Produktpreis
      }
      if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
        return { series: data, isShipping: false }; // Raw points [[t1, p1], [t2, p2]]
      }
    }
    if (Array.isArray(data?.series)) return { series: data.series, isShipping: false };
    if (Array.isArray(data?.data)) return { series: data.data, isShipping: false };
    return { series: null, isShipping: false };
  };
  try {
    const { res, data } = await requestWithRetry(async linkedSignal => {
      const res = await fetch(`${baseUrl}/plugins/product/pricechart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        credentials: 'same-origin',
        body: postBody,
        signal: linkedSignal
      });
      // No .catch swallow: body-read aborts must reach the retry classifier
      // (timeout path), malformed JSON the generic branch (retried, then
      // invalid-response below). 4xx other than 429 arrive here with res.
      const json = res.ok ? await res.json() : null;
      return { res, data: json };
    }, { retries, shouldCancelFn, signal, baseDelayMs: 1500, timeoutMs: 6000 });
    if (res && !res.ok && (res.status === 401 || res.status === 403)) {
      const e = new Error('unauthorized');
      e.unauthorized = true;
      throw e;
    }
    const pick = pickSeries(data);
    if (pick.series) return pick;
  } catch (err) {
    // Typed failures propagate so the caller skips the HTML fallback; only
    // the empty signal (absent/invalid) falls through to it.
    if (err?.cancelled || err?.timeout || err?.cooldown || err?.unauthorized) throw err;
    if (err?.transient && err?.cause?.name !== 'SyntaxError') throw err;
    if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching time series for product', productId, err);
  }
  return null;
}

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
    const cleanup = () => { signal?.removeEventListener('abort', onAbort); clearInterval(timer); };
    const cancel = () => {
      if (done) return;
      done = true;
      cleanup();
      const e = new Error('cancelled');
      e.cancelled = true;
      reject(e);
    };
    const onAbort = () => cancel();
    // ponytail: polled predicate; the shared transport cannot wire N caller
    // predicates into one abort without one caller killing its siblings.
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
      stats.isShippingPrice = useShipping;
      if (!stats.medianPrice && prev && !prev.unavailable && prev.medianPrice) return prev;
      if (useShipping) {
        // HTML carries no basis: never substitute a product comparison
        // into the shipping slot — slot reads unavailable/retry later.
        setCachedPriceStats(productId, null, true, undefined, true, gen);
        return null;
      }
      setCachedPriceStats(productId, stats, false, undefined, useShipping, gen);
      return stats;
    } else {
      if (!prev || !prev.medianPrice) setCachedPriceStats(productId, null, true, undefined, useShipping, gen);
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

  try {
    for (let i = 0; i < targets.length; i++) {
      if (isCancelled(signal, shouldCancelFn)) break;
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
        // Pre-fetch identity guard: skip the fetch when the card detached or
        // was reused for another product while queued (post-fetch guard stays).
        if (item.card.isConnected && getCardProductId(item.card) === item.pid) {
          const cardBasis = extractCanonicalPrice(item.card).basis;
          const cardElig = scanEligibility(item.card);
          const forceFresh = cardElig.state === 'basis-mismatch';
          stats = await fetchSingleProductPriceStats(item.pid, 2, forceFresh, shouldCancelFn, (() => { try { const cp = extractCanonicalPrice(item.card).price; return Number.isFinite(cp) && cp > 0 ? cp : null; } catch { return null; } })(), signal, cardBasis);
          // Card-identity guard: reused/detached cards must not collect an
          // earlier request's verification.
          if (!(item.card.isConnected && getCardProductId(item.card) === item.pid)) stats = null;
          else if (stats) newlyVerified.push({ pid: item.pid, card: item.card });
        }
      } finally {
        Object.assign(scanState, { currentlyScanningPid: null });
      }

      completed++;
      Object.assign(scanState, { progress: { completed, total } });
      if (onProgress) onProgress(completed, total);
      // ponytail: progressive paint per verified card (batch CTA asserts
      // badges mid-scan); the pre-fetch full rescan stays removed.
      if (stats) triggerProcessListings();
      await interruptibleSleep(250, shouldCancelFn, signal);
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
    try { batchController?.abort(); } catch {}
    return;
  }
  Object.assign(scanState, { isBatchChecking: true, batchCancelRequested: false });
  batchController = new AbortController();

  try {
    const isFeed = isNeueToppreisePage();
    await runProductScanner({
      isFeed,
      minDiscount,
      sortByDiscount: false,
      shouldCancelFn: (() => scanState.batchCancelRequested),
      onProgress,
      onComplete,
      signal: batchController.signal
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
  try { batchController?.abort(); } catch {}
}
