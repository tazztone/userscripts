import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MEMORY_CACHE_ITEMS,
  memoryCache,
  isCacheEntryFresh,
  getCachedPriceStats,
  setCachedPriceStats,
  clearPriceStatsCache,
  countCachedPriceStats,
  prunePriceStatsCache,
  recomputeCachedMedians,
  DEALER_CACHE_PREFIX,
  SHARED_CACHE_PREFIX,
  getCachedDealer,
  setCachedDealer,
  getSharedDeal,
  setSharedDeal,
} from '../../src/scanner/cache.js';
import { analyzePriceTimeSeries } from '../../src/domain/price.js';
import { DAY, withConfig } from './helpers.js';

const memStorage = () => {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
};

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
      withConfig('REAL_DEAL_CACHE_HOURS', 48, () => {
        const now = Date.now();
        const freshEntry = { tiefstpreis: 100, time: now - 40 * 3600 * 1000 };
        const expiredEntry = { tiefstpreis: 100, time: now - 50 * 3600 * 1000 };

        assert.equal(isCacheEntryFresh(freshEntry), true);
        assert.equal(isCacheEntryFresh(expiredEntry), false);
      });
    });

    it('enforces negative cache TTL (default 2h)', () => {
      withConfig('NEGATIVE_CACHE_HOURS', 2, () => {
        const now = Date.now();
        const freshNeg = { unavailable: true, time: now - 1 * 3600 * 1000 };
        const expiredNeg = { unavailable: true, time: now - 3 * 3600 * 1000 };

        assert.equal(isCacheEntryFresh(freshNeg), true);
        assert.equal(isCacheEntryFresh(expiredNeg), false);
        // ignoreNegativeCache bypasses cache freshness for negative entries
        assert.equal(isCacheEntryFresh(freshNeg, true), false);
      });
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

  describe('shipping-mode guard', () => {
    it('serves same-mode entries and legacy entries without a flag', () => {
      withConfig('USE_SHIPPING_PRICE', true, () => { // Node: no document -> mode is the flag
        setCachedPriceStats('m1', { tiefstpreis: 100, isShippingPrice: true }, false, null);
        setCachedPriceStats('m2', { tiefstpreis: 100 }, false, null); // legacy, no flag
        assert.equal(getCachedPriceStats('m1', false, null).tiefstpreis, 100);
        assert.equal(getCachedPriceStats('m2', false, null).tiefstpreis, 100);
      });
    });

    it('reads cross-mode entries as a miss so the next scan refetches', () => {
      withConfig('USE_SHIPPING_PRICE', false, () => { // product-price mode, entry is shipping
        setCachedPriceStats('m3', { tiefstpreis: 100, isShippingPrice: true }, false, null);
        assert.equal(getCachedPriceStats('m3', false, null), null);
      });
    });
  });

  describe('dealer persistence', () => {
    it('round-trips dealer + url per price basis', () => {
      const s = memStorage();
      setCachedDealer('p1', false, 'Galaxus', 'https://www.toppreise.ch/ext_de?oid=1', s);
      setCachedDealer('p1', true, 'Brack', '', s);
      assert.deepEqual(getCachedDealer('p1', false, s), { dealer: 'Galaxus', url: 'https://www.toppreise.ch/ext_de?oid=1' });
      assert.deepEqual(getCachedDealer('p1', true, s), { dealer: 'Brack', url: '' });
      assert.equal(getCachedDealer('p2', false, s), null);
    });

    it('expires with the price-history TTL', () => {
      const s = memStorage();
      withConfig('REAL_DEAL_CACHE_HOURS', 48, () => {
        s.setItem(DEALER_CACHE_PREFIX + 'old', JSON.stringify({ time: Date.now() - 50 * 3600 * 1000, p: { dealer: 'Galaxus', url: '' } }));
        assert.equal(getCachedDealer('old', false, s), null);
        setCachedDealer('fresh', false, 'Galaxus', '', s);
        assert.equal(getCachedDealer('fresh', false, s).dealer, 'Galaxus');
      });
    });

    it('tolerates corrupt entries and needs no storage', () => {
      const s = memStorage();
      s.setItem(DEALER_CACHE_PREFIX + 'broken', 'kein json{{');
      assert.equal(getCachedDealer('broken', false, s), null);
      assert.equal(getCachedDealer('p1', false, null), null);
      setCachedDealer('', false, 'Galaxus', '', s);
      setCachedDealer('p1', false, '', '', s);
      assert.equal(getCachedDealer('p1', false, s), null);
    });

    it('clearPriceStatsCache wipes dealer keys too', () => {
      const s = memStorage();
      setCachedDealer('p1', false, 'Galaxus', '', s);
      s.setItem('tp_hist_v1_p1', JSON.stringify({ time: Date.now() }));
      assert.equal(clearPriceStatsCache(s), 2);
      assert.equal(getCachedDealer('p1', false, s), null);
    });
  });
  describe('shared-deal memory', () => {
    it('round-trips same price, re-arms on price change', () => {
      const s = memStorage();
      setSharedDeal('p1', 9999, s);
      assert.equal(getSharedDeal('p1', 9999, s), true);
      assert.equal(getSharedDeal('p1', 8999, s), false);
    });

    it('forgets with pricing data (48h TTL)', () => {
      const s = memStorage();
      withConfig('REAL_DEAL_CACHE_HOURS', 48, () => {
        s.setItem(SHARED_CACHE_PREFIX + 'old', JSON.stringify({ priceCents: 1000, time: Date.now() - 49 * 3600 * 1000 }));
        assert.equal(getSharedDeal('old', 1000, s), false);
        setSharedDeal('fresh', 1000, s);
        assert.equal(getSharedDeal('fresh', 1000, s), true);
      });
    });

    it('tolerates missing/corrupt/falsy keys, set never throws', () => {
      const s = memStorage();
      assert.equal(getSharedDeal('missing', 1000, s), false);
      s.setItem(SHARED_CACHE_PREFIX + 'broken', 'kein json{{');
      assert.equal(getSharedDeal('broken', 1000, s), false);
      assert.equal(getSharedDeal('', 1000, s), false);
      assert.equal(getSharedDeal(null, 1000, s), false);
      setSharedDeal(null, 1000, s);
      setSharedDeal('', 1000, s);
      setSharedDeal('p1', null, s);
      assert.equal(s.length, 1); // only 'broken' written above
    });

    it('clearPriceStatsCache forgets shared marks', () => {
      const s = memStorage();
      setSharedDeal('p1', 1000, s);
      assert.equal(clearPriceStatsCache(s), 1);
      assert.equal(getSharedDeal('p1', 1000, s), false);
    });

    it('countCachedPriceStats ignores shared marks', () => {
      const s = memStorage();
      setSharedDeal('p1', 1000, s);
      s.setItem('tp_hist_v1_p1', JSON.stringify({ time: Date.now() }));
      assert.equal(countCachedPriceStats(s), 1);
    });

    it('prunePriceStatsCache removes shared entries older than 14 days', () => {
      const s = memStorage();
      s.setItem(SHARED_CACHE_PREFIX + 'old', JSON.stringify({ priceCents: 1000, time: Date.now() - 15 * 24 * 3600 * 1000 }));
      setSharedDeal('fresh', 1000, s);
      prunePriceStatsCache(s);
      assert.equal(getSharedDeal('old', 1000, s), false);
      assert.equal(getSharedDeal('fresh', 1000, s), true);
    });
  });

  describe('recomputeCachedMedians', () => {
    it('recomputes medians locally, preserves TTL, skips series-less entries', () => {
      const now = Date.now();
      const series = [
        [now - 500 * DAY, 2000],
        [now - 400 * DAY, 1900],
        [now - 60 * DAY, 800],
        [now - 30 * DAY, 780],
        [now, 750]
      ];
      withConfig('OUTLIER_REJECTION_ENABLED', false, () => {
        const seedStats = analyzePriceTimeSeries(series, null, 0);
        assert.equal(seedStats.medianPrice, 800);
        const fixedTime = now - 3600 * 1000;
        setCachedPriceStats('p1', seedStats, false, null);
        memoryCache.get('p1').time = fixedTime;
        setCachedPriceStats('p2', { tiefstpreis: 100 }, false, null);
        const s = memStorage();
        s.setItem('tp_hist_v1_p3', JSON.stringify({ ...seedStats, time: fixedTime }));
        const rewritten = recomputeCachedMedians(90, s);
        assert.equal(rewritten, 2);
        const e1 = memoryCache.get('p1');
        assert.equal(e1.medianPrice, 780);
        assert.equal(e1.horizonDays, 90);
        assert.equal(e1.medianFallback, false);
        assert.equal(e1.time, fixedTime); // TTL untouched: no refetch
        assert.equal(memoryCache.get('p2').tiefstpreis, 100);
        assert.equal(memoryCache.get('p2').medianPrice, undefined);
        const e3 = memoryCache.get('p3');
        assert.equal(e3.horizonDays, 90);
        assert.equal(JSON.parse(s.getItem('tp_hist_v1_p3')).horizonDays, 90);
        assert.equal(JSON.parse(s.getItem('tp_hist_v1_p1')).medianPrice, 780);
      });
    });
  });
});
