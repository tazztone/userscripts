import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MEMORY_CACHE_ITEMS,
  memoryCache,
  isCacheEntryFresh,
  getCachedPriceStats,
  setCachedPriceStats,
  clearPriceStatsCache
} from '../../src/scanner/cache.js';

describe('Bounded Cache Module', () => {
  beforeEach(() => {
    clearPriceStatsCache();
  });

  describe('Capacity Bounds & LRU Eviction', () => {
    it('enforces MAX_MEMORY_CACHE_ITEMS = 500', () => {
      assert.equal(MAX_MEMORY_CACHE_ITEMS, 500);

      // Insert 505 items
      for (let i = 1; i <= 505; i++) {
        setCachedPriceStats(`p${i}`, { tiefstpreis: 100 + i }, false, null);
      }

      assert.equal(memoryCache.size, 500);
      // Items 1..5 should have been evicted by FIFO/LRU
      assert.equal(memoryCache.has('p1'), false);
      assert.equal(memoryCache.has('p5'), false);
      assert.equal(memoryCache.has('p6'), true);
      assert.equal(memoryCache.has('p505'), true);
    });

    it('promotes accessed items in LRU order', () => {
      for (let i = 1; i <= 500; i++) {
        setCachedPriceStats(`p${i}`, { tiefstpreis: 100 }, false, null);
      }

      // Access item 'p1' to promote it to the most-recently-used position
      const hit = getCachedPriceStats('p1', false, null);
      assert.ok(hit);

      // Now insert 1 more item, which triggers eviction of the oldest (p2, not p1)
      setCachedPriceStats('p501', { tiefstpreis: 200 }, false, null);

      assert.equal(memoryCache.size, 500);
      assert.equal(memoryCache.has('p1'), true);  // Promoted, so kept
      assert.equal(memoryCache.has('p2'), false); // Oldest, evicted
      assert.equal(memoryCache.has('p501'), true);
    });
  });

  describe('isCacheEntryFresh', () => {
    it('enforces regular cache TTL (default 48h)', () => {
      const now = Date.now();
      const freshEntry = { tiefstpreis: 100, time: now - 40 * 3600 * 1000 };
      const expiredEntry = { tiefstpreis: 100, time: now - 50 * 3600 * 1000 };

      assert.equal(isCacheEntryFresh(freshEntry, false, { realDealCacheHours: 48 }), true);
      assert.equal(isCacheEntryFresh(expiredEntry, false, { realDealCacheHours: 48 }), false);
    });

    it('enforces negative cache TTL (default 2h)', () => {
      const now = Date.now();
      const freshNeg = { unavailable: true, time: now - 1 * 3600 * 1000 };
      const expiredNeg = { unavailable: true, time: now - 3 * 3600 * 1000 };

      assert.equal(isCacheEntryFresh(freshNeg, false, { negativeCacheHours: 2 }), true);
      assert.equal(isCacheEntryFresh(expiredNeg, false, { negativeCacheHours: 2 }), false);
      // ignoreNegative bypasses cache freshness for negative entries
      assert.equal(isCacheEntryFresh(freshNeg, true, { negativeCacheHours: 2 }), false);
    });
  });

  describe('clearPriceStatsCache', () => {
    it('wipes all memory entries cleanly', () => {
      setCachedPriceStats('p10', { tiefstpreis: 50 }, false, null);
      setCachedPriceStats('p20', { tiefstpreis: 60 }, false, null);
      assert.equal(memoryCache.size, 2);

      clearPriceStatsCache(null);
      assert.equal(memoryCache.size, 0);
    });
  });
});
