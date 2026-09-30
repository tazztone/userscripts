import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSingleProductPriceStats } from '../../src/scanner/scanner.js';
import { setCachedPriceStats, memoryCache } from '../../src/scanner/cache.js';

const PID = 'test-pid-refresh';
const now = Date.now();
const dayMs = 86400 * 1000;
const freshSeries = [
  [now - 5 * dayMs, 100],
  [now - 4 * dayMs, 95],
  [now - 3 * dayMs, 90],
  [now - 2 * dayMs, 85],
  [now - 1 * dayMs, 80],
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
});
