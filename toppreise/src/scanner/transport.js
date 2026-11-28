/**
 * Scanner Transport
 * Retry/backoff HTTP layer and price time-series fetch used by the scanner.
 */

import { isShippingPriceActive, getPageLang } from '../page/adapter.js';
import { CONFIG } from '../state/config.js';
import { logActivity } from '../state/activity-log.js';
import { getOriginCooldownUntil, setOriginCooldownUntil, parseRetryAfterMs, backoffMs } from '../state/net.js';

export async function interruptibleSleep(ms, shouldCancelFn = null, signal = null) {
  if (!(ms > 0)) return;
  const deadline = Date.now() + ms;
  while (true) {
    if (signal?.aborted || shouldCancelFn?.()) return;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    const wait = shouldCancelFn ? Math.min(100, remaining) : remaining;
    await new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, wait);
      signal?.addEventListener('abort', finish, { once: true });
    });
  }
}

export const isCancelled = (signal, shouldCancelFn) => signal?.aborted || shouldCancelFn?.();

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
    if (Date.now() < getOriginCooldownUntil()) {
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
        if (attempt === 0 && retries > 0 && wait <= 5000) {
          setOriginCooldownUntil(Date.now() + wait);
          logActivity('warn', 'scanner', `429 Cooldown aktiviert (${wait}ms) — Retry (1/${retries})`);
          const sleepMs = Math.max(wait, getOriginCooldownUntil() - Date.now()) + 25;
          await interruptibleSleep(sleepMs, shouldCancelFn, signal);
          continue;
        }
        const cooldownMs = Math.max(wait, baseDelayMs);
        setOriginCooldownUntil(Date.now() + cooldownMs);
        logActivity('warn', 'scanner', `429 Cooldown aktiviert (${cooldownMs}ms)`);
        const e = new Error('429');
        e.transient = true;
        throw e;
      }
      if (res.status >= 500) {
        if (attempt < retries) {
          logActivity('warn', 'scanner', `HTTP ${res.status} — Retry (${attempt + 1}/${retries})`);
          await interruptibleSleep(backoffMs(attempt, baseDelayMs), shouldCancelFn, signal);
          continue;
        }
        logActivity('warn', 'scanner', `HTTP ${res.status} nach ${retries + 1} Versuchen`);
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
          logActivity('warn', 'scanner', `Timeout (${timeoutMs}ms) — Retry (${attempt + 1}/${retries})`);
          await interruptibleSleep(backoffMs(attempt, baseDelayMs), shouldCancelFn, signal);
          continue;
        }
        logActivity('warn', 'scanner', `Timeout nach ${timeoutMs}ms (${retries + 1} Versuche)`);
        const e = new Error('timeout');
        e.timeout = true;
        throw e;
      }
      // Backstop for aborts neither parent nor timer explains (e.g. a fetch
      // implementation aborting without the controller flag).
      if (err?.name === 'AbortError') {
        logActivity('warn', 'scanner', `AbortError/Timeout (${err?.message || 'aborted'})`);
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
        logActivity('warn', 'scanner', `Netzwerkfehler — Retry (${attempt + 1}/${retries})`, err?.message || '');
        await interruptibleSleep(backoffMs(attempt, baseDelayMs), shouldCancelFn, signal);
        continue;
      }
      logActivity('warn', 'scanner', `Netzwerkfehler nach ${retries + 1} Versuchen`, err?.message || '');
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

export async function fetchPriceTimeSeries(productId, retries = 1, shouldCancelFn = null, useShipping = null, signal = null) {
  if (!productId) return null;
  const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
  const postBody = `pcspagdpi=${encodeURIComponent(productId)}&pcspagdfdt=0000-00-00&pcspagdtd=&p_pc_ch=&lang=${encodeURIComponent(getPageLang())}`;
  // isShipping true ONLY when shipping was requested AND the data[1] branch
  // was taken; every other shape is basis-unconfirmed → treat as product.
  const pickSeries = data => {
    const shippingActive = typeof useShipping === 'boolean' ? useShipping : isShippingPriceActive();
    if (Array.isArray(data)) {
      const hasShip = data.length > 1 && Array.isArray(data[1]) && data[1].length > 0 && Array.isArray(data[1][0]);
      const hasProd = Array.isArray(data[0]) && data[0].length > 0 && Array.isArray(data[0][0]);
      if (shippingActive && hasShip) {
        return { series: data[1], isShipping: true, ...(hasProd ? { altSeries: data[0], altIsShipping: false } : {}) };
      }
      if (hasProd) {
        return { series: data[0], isShipping: false, ...(hasShip ? { altSeries: data[1], altIsShipping: true } : {}) };
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
      // (timeout path), malformed JSON maps to invalid-json (not retried).
      // 4xx other than 429 arrive here with res.
      const json = res.ok ? await res.json() : null;
      return { res, data: json };
    }, { retries, shouldCancelFn, signal, baseDelayMs: 1500, timeoutMs: 6000 });
    if (res && !res.ok && (res.status === 401 || res.status === 403)) {
      logActivity('warn', 'scanner', `HTTP ${res.status} für ${productId}`);
      const e = new Error('unauthorized');
      e.unauthorized = true;
      throw e;
    }
    const pick = pickSeries(data);
    if (pick.series) return pick;
  } catch (err) {
    // Typed failures propagate so the caller skips the HTML fallback; only
    // the empty signal (absent/invalid) falls through to it.
    if (err?.cancelled || err?.timeout || err?.cooldown || err?.unauthorized || err?.transient) throw err;
    if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching time series for product', productId, err);
  }
  return null;
}
