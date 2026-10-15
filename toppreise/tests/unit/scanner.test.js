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
      if (opts?.method === 'POST') return { ok: false, status: 500 };
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

  it('429 exhaustion writes no negative entry and cools the origin down', async () => {
    const pid = 'test-pid-429';
    globalThis.fetch = async () => ({ ok: false, status: 429, headers: { get: () => '0' } });
    const stats = await fetchSingleProductPriceStats(pid, 0, true);
    assert.equal(stats, null);
    assert.equal(getCachedPriceStats(pid), null);
  });
});
