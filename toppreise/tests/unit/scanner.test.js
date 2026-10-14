import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSingleProductPriceStats } from '../../src/scanner/scanner.js';
import { setCachedPriceStats, getCachedPriceStats, memoryCache } from '../../src/scanner/cache.js';
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

  beforeEach(() => {
    fetchCalls = 0;
    memoryCache.clear();
    globalThis.fetch = async () => {
      fetchCalls++;
      return { ok: true, json: async () => freshSeries };
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    memoryCache.clear();
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
});
