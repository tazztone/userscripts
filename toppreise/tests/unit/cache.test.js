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
import { CONFIG } from '../../src/state/config.js';

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
      const prev = CONFIG.REAL_DEAL_CACHE_HOURS;
      CONFIG.REAL_DEAL_CACHE_HOURS = 48;
      try {
        const now = Date.now();
        const freshEntry = { tiefstpreis: 100, time: now - 40 * 3600 * 1000 };
        const expiredEntry = { tiefstpreis: 100, time: now - 50 * 3600 * 1000 };

        assert.equal(isCacheEntryFresh(freshEntry), true);
        assert.equal(isCacheEntryFresh(expiredEntry), false);
      } finally {
        CONFIG.REAL_DEAL_CACHE_HOURS = prev;
      }
    });

    it('enforces negative cache TTL (default 2h)', () => {
      const prev = CONFIG.NEGATIVE_CACHE_HOURS;
      CONFIG.NEGATIVE_CACHE_HOURS = 2;
      try {
        const now = Date.now();
        const freshNeg = { unavailable: true, time: now - 1 * 3600 * 1000 };
        const expiredNeg = { unavailable: true, time: now - 3 * 3600 * 1000 };

        assert.equal(isCacheEntryFresh(freshNeg), true);
        assert.equal(isCacheEntryFresh(expiredNeg), false);
        // ignoreNegativeCache bypasses cache freshness for negative entries
        assert.equal(isCacheEntryFresh(freshNeg, true), false);
      } finally {
        CONFIG.NEGATIVE_CACHE_HOURS = prev;
      }
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

  describe('upgrade-only stats writes', () => {
    it('never replaces median-bearing stats with median-less fallback stats', () => {
      setCachedPriceStats('p1', { tiefstpreis: 100, medianPrice: 150 }, false, null);
      // A refresh landing on the HTML fallback (tiefstpreis only) must not regress.
      setCachedPriceStats('p1', { tiefstpreis: 90 }, false, null);
      const kept = getCachedPriceStats('p1', false, null);
      assert.equal(kept.tiefstpreis, 100);
      assert.equal(kept.medianPrice, 150);
    });

    it('accepts fallback stats when nothing cached, and upgrades afterwards', () => {
      setCachedPriceStats('p2', { tiefstpreis: 90 }, false, null);
      assert.equal(getCachedPriceStats('p2', false, null).tiefstpreis, 90);
      setCachedPriceStats('p2', { tiefstpreis: 90, medianPrice: 150 }, false, null);
      assert.equal(getCachedPriceStats('p2', false, null).medianPrice, 150);
    });

    it('unavailable markers keep current semantics (still overwrite)', () => {
      setCachedPriceStats('p3', { tiefstpreis: 100, medianPrice: 150 }, false, null);
      setCachedPriceStats('p3', null, true, null);
      const marked = getCachedPriceStats('p3', false, null);
      assert.equal(marked.unavailable, true);
    });
  });
});
