import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSingleProductPriceStats, activeFetches } from '../../src/scanner/scanner.js';
import { setCachedPriceStats, getCachedPriceStats, memoryCache, statsKey, hasUsablePriceStats } from '../../src/scanner/cache.js';
import { CONFIG } from '../../src/state/config.js';
import { DAY } from './helpers.js';

const PID = 'test-pid-refresh';
const now = Date.now();
const freshSeries = [
  [now - 5 * DAY, 100],
  [now - 4 * DAY, 95],
  [now - 3 * DAY, 90],
  [now - 2 * DAY, 85],
  [now - 1 * DAY, 80],
  [now, 75]
];

describe('fetchSingleProductPriceStats refresh semantics', () => {
  let fetchCalls;
  const realFetch = globalThis.fetch;
  let prevShipping;

  beforeEach(() => {
    fetchCalls = 0;
    memoryCache.clear();
    activeFetches.clear();
    // Product-shape stubs below verify on the product basis.
    prevShipping = CONFIG.USE_SHIPPING_PRICE;
    CONFIG.USE_SHIPPING_PRICE = false;
    globalThis.fetch = async () => {
      fetchCalls++;
      return { ok: true, json: async () => freshSeries };
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    CONFIG.USE_SHIPPING_PRICE = prevShipping;
    memoryCache.clear();
    activeFetches.clear();
  });

  it('serves fresh positive cache without network by default', async () => {
    setCachedPriceStats(PID, { tiefstpreis: 50, hoechstpreis: 120 });
    const stats = await fetchSingleProductPriceStats(PID);
    assert.equal(fetchCalls, 0);
    assert.equal(stats.tiefstpreis, 50);
  });

  it('forceFresh bypasses positive cache and refetches ("Aktualisieren" click)', async () => {
    setCachedPriceStats(PID, { tiefstpreis: 50, hoechstpreis: 120 });
    const stats = await fetchSingleProductPriceStats(PID, 1, true);
    assert.equal(fetchCalls, 1);
    assert.equal(stats.tiefstpreis, 75);
  });

  it('forceFresh refetches past negative entries', async () => {
    setCachedPriceStats(PID, null, true);
    const stats = await fetchSingleProductPriceStats(PID, 1, true);
    assert.equal(fetchCalls, 1);
    assert.equal(stats.tiefstpreis, 75);
  });

  it('forceFresh keeps the good entry when the refresh fails', async () => {
    setCachedPriceStats(PID, { tiefstpreis: 50, medianPrice: 100, hoechstpreis: 120 });
    globalThis.fetch = async () => { fetchCalls++; throw new Error('offline'); };
    const stats = await fetchSingleProductPriceStats(PID, 1, true);
    assert.equal(stats, null);
    assert.ok(fetchCalls > 0);
    const kept = getCachedPriceStats(PID);
    assert.equal(kept.medianPrice, 100);
    assert.ok(!kept.unavailable);
  });

  it('median-less HTML fallback returns the median-bearing cached entry', async () => {
    setCachedPriceStats(PID, { tiefstpreis: 50, medianPrice: 100, hoechstpreis: 120 });
    globalThis.fetch = async (url, opts) => {
      fetchCalls++;
      // Empty primary (not a 5xx): transients skip the HTML fallback, only
      // the empty signal falls through to it.
      if (opts?.method === 'POST') return { ok: true, json: async () => [] };
      return { ok: true, text: async () => '<div>Tiefstpreis</div><span class="Plugin_Price">CHF 49.00</span>' };
    };
    const stats = await fetchSingleProductPriceStats(PID, 1, true);
    assert.equal(stats.medianPrice, 100);
  });

  it('product-shape series never lands in the shipping slot (negative shipping entry instead)', async () => {
    CONFIG.USE_SHIPPING_PRICE = true;
    const pid = 'test-pid-ship-mismatch';
    globalThis.fetch = async (url, opts) => {
      fetchCalls++;
      if (opts?.method === 'POST') return { ok: true, json: async () => freshSeries };
      return { ok: false, status: 404, headers: { get: () => null } };
    };
    const stats = await fetchSingleProductPriceStats(pid, 0, true);
    assert.equal(stats, null);
    // Shipping slot reads unavailable/retry-later …
    const shipEntry = getCachedPriceStats(pid);
    assert.ok(shipEntry?.unavailable);
    assert.equal(hasUsablePriceStats(shipEntry), false);
    // … and the product slot stays untouched.
    assert.equal(memoryCache.has(statsKey(pid, false)), false);
  });

  it('cancelled fetches return null and write no negative entry', async () => {
    const pid = 'test-pid-cancelled';
    const viaFlag = await fetchSingleProductPriceStats(pid, 1, true, () => true);
    assert.equal(viaFlag, null);
    assert.equal(fetchCalls, 0);
    assert.equal(getCachedPriceStats(pid), null);
    const ctrl = new AbortController();
    ctrl.abort();
    const viaSignal = await fetchSingleProductPriceStats(pid, 1, true, null, null, ctrl.signal);
    assert.equal(viaSignal, null);
    assert.equal(getCachedPriceStats(pid), null);
  });

  it('genuinely-absent history writes a negative entry', async () => {
    const pid = 'test-pid-absent';
    globalThis.fetch = async (url, opts) => {
      fetchCalls++;
      if (opts?.method === 'POST') return { ok: true, json: async () => [] };
      return { ok: true, text: async () => '<div>Kein Tiefstpreis gefunden</div>' };
    };
    const stats = await fetchSingleProductPriceStats(pid, 0, true);
    assert.equal(stats, null);
    assert.equal(getCachedPriceStats(pid)?.unavailable, true);
  });

  it('5xx / network failures write no negative entry', async () => {
    for (const [name, stub] of [
      ['5xx', async () => ({ ok: false, status: 503, headers: { get: () => null } })],
      ['network', async () => { throw new Error('offline'); }],
    ]) {
      const pid = `test-pid-transient-${name}`;
      fetchCalls = 0;
      globalThis.fetch = async (...a) => { fetchCalls++; return stub(...a); };
      const stats = await fetchSingleProductPriceStats(pid, 0, true);
      assert.equal(stats, null, name);
      assert.ok(fetchCalls > 0, name);
      assert.equal(getCachedPriceStats(pid), null, `${name} must not write a negative entry`);
    }
  });

  it('honours Retry-After HTTP-dates', async () => {
    const pid = 'test-pid-retry-date';
    // HTTP-dates resolve to whole seconds: +1100ms leaves a 100–1100ms wait,
    // cleanly below the ~1500ms numeric fallback.
    const fireAt = new Date(Date.now() + 1100).toUTCString();
    let n = 0;
    globalThis.fetch = async (url, opts) => {
      n++;
      if (opts?.method === 'POST' && n === 1) return { ok: false, status: 429, headers: { get: () => fireAt } };
      if (opts?.method === 'POST') return { ok: true, json: async () => freshSeries };
      return { ok: false, status: 404, headers: { get: () => null } };
    };
    const t0 = Date.now();
    const stats = await fetchSingleProductPriceStats(pid, 1, true);
    const elapsed = Date.now() - t0;
    assert.equal(stats?.tiefstpreis, 75);
    assert.ok(elapsed < 1400, `elapsed ${elapsed}ms exceeds HTTP-date wait`);
    assert.ok(elapsed >= 50, `elapsed ${elapsed}ms skipped the Retry-After wait`);
  });

  // Fires the first >=6s timer instantly (the attempt-1 timeout), so timeout
  // paths are exercised without real 6s waits. Later timers run for real
  // but are cleared on success.
  const fireFirstSlowTimerInstantly = () => {
    const realSetTimeout = globalThis.setTimeout;
    let armed = true;
    globalThis.setTimeout = (fn, ms, ...args) => {
      if (armed && ms >= 6000) { armed = false; return realSetTimeout(fn, 0, ...args); }
      return realSetTimeout(fn, ms, ...args);
    };
    // Stubs must yield a macrotask before failing: microtask rejections
    // would otherwise beat the 0ms abort timer and misclassify as backstop.
    const tick = () => new Promise(r => realSetTimeout(r, 10));
    return { restore: () => { globalThis.setTimeout = realSetTimeout; }, tick };
  };
  const abortErr = () => Object.assign(new Error('aborted'), { name: 'AbortError' });

  it('attempt timeout retries the primary route and then succeeds', async () => {
    const pid = 'test-pid-timeout-retry';
    const { restore, tick } = fireFirstSlowTimerInstantly();
    try {
      let n = 0;
      globalThis.fetch = async (url, opts) => {
        fetchCalls++;
        if (opts?.method === 'POST' && n++ === 0) { await tick(); throw abortErr(); }
        return { ok: true, json: async () => freshSeries };
      };
      const stats = await fetchSingleProductPriceStats(pid, 1, true);
      assert.equal(stats?.tiefstpreis, 75);
      assert.equal(fetchCalls, 2);
    } finally { restore(); }
  });

  it('timeout during the body read retries and then succeeds', async () => {
    const pid = 'test-pid-timeout-body';
    const { restore, tick } = fireFirstSlowTimerInstantly();
    try {
      globalThis.fetch = async (url, opts) => {
        fetchCalls++;
        const sig = opts?.signal;
        return { ok: true, json: async () => {
          await tick();
          if (sig?.aborted) throw abortErr();
          return freshSeries;
        } };
      };
      const stats = await fetchSingleProductPriceStats(pid, 1, true);
      assert.equal(stats?.tiefstpreis, 75);
      assert.equal(fetchCalls, 2);
    } finally { restore(); }
  });

  it('parent cancellation mid-flight performs no retry and writes nothing', async () => {
    const pid = 'test-pid-parent-cancel';
    globalThis.fetch = (url, opts) => {
      fetchCalls++;
      return new Promise((_, reject) => {
        const s = opts?.signal;
        if (s?.aborted) reject(abortErr());
        else s?.addEventListener('abort', () => reject(abortErr()), { once: true });
      });
    };
    const ctrl = new AbortController();
    const p = fetchSingleProductPriceStats(pid, 1, true, null, null, ctrl.signal);
    ctrl.abort();
    const stats = await p;
    assert.equal(stats, null);
    assert.equal(fetchCalls, 1);
    assert.equal(getCachedPriceStats(pid), null);
  });

  it('malformed JSON falls back to HTML and absent HTML writes a negative entry', async () => {
    const pid = 'test-pid-bad-json';
    globalThis.fetch = async (url, opts) => {
      fetchCalls++;
      if (opts?.method === 'POST') return { ok: true, json: async () => { throw new SyntaxError('bad json'); } };
      return { ok: true, text: async () => '<div>Kein Tiefstpreis gefunden</div>' };
    };
    const stats = await fetchSingleProductPriceStats(pid, 0, true);
    assert.equal(stats, null);
    assert.equal(fetchCalls, 2);
    assert.equal(getCachedPriceStats(pid)?.unavailable, true);
  });

  it('401/403 writes no negative entry and skips the HTML fallback', async () => {
    for (const status of [401, 403]) {
      const pid = `test-pid-auth-${status}`;
      fetchCalls = 0;
      globalThis.fetch = async () => { fetchCalls++; return { ok: false, status, headers: { get: () => null } }; };
      const stats = await fetchSingleProductPriceStats(pid, 0, true);
      assert.equal(stats, null, `status ${status}`);
      assert.equal(fetchCalls, 1, `status ${status} must skip the HTML fallback`);
      assert.equal(getCachedPriceStats(pid), null, `status ${status} must not write a negative entry`);
    }
  });

  it('429 exhaustion on the primary route skips the HTML fallback', async () => {
    // Before the cooldown-setting 429 test below: exhaustion cools the
    // origin down, and that test still passes short-circuited (it asserts
    // no fetch count, only null stats and no negative entry).
    const pid = 'test-pid-429-no-fallback';
    fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls++; return { ok: false, status: 429, headers: { get: () => '0' } }; };
    const stats = await fetchSingleProductPriceStats(pid, 0, true);
    assert.equal(stats, null);
    assert.equal(fetchCalls, 1);
    assert.equal(getCachedPriceStats(pid), null);
  });

  it('429 exhaustion writes no negative entry and cools the origin down', async () => {
    const pid = 'test-pid-429';
    globalThis.fetch = async () => ({ ok: false, status: 429, headers: { get: () => '0' } });
    const stats = await fetchSingleProductPriceStats(pid, 0, true);
    assert.equal(stats, null);
    assert.equal(getCachedPriceStats(pid), null);
  });
});
