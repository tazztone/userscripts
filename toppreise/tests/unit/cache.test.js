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
  statsKey,
  hasUsablePriceStats,
  ensureFreshAnalysis,
  currentCacheGen,
  bumpCacheGeneration,
} from '../../src/scanner/cache.js';
import { analyzePriceTimeSeries } from '../../src/domain/price.js';
import { DAY, HOUR, withConfig } from './helpers.js';

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
      assert.equal(memoryCache.has(statsKey('p1')), false);
      assert.equal(memoryCache.has(statsKey('p5')), false);
      assert.equal(memoryCache.has(statsKey('p6')), true);
      assert.equal(memoryCache.has(statsKey('p505')), true);
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
      assert.equal(memoryCache.has(statsKey('p1')), true);  // Promoted, so kept
      assert.equal(memoryCache.has(statsKey('p2')), false); // Oldest, evicted
      assert.equal(memoryCache.has(statsKey('p501')), true);
    });
  });

  describe('isCacheEntryFresh', () => {
    it('enforces regular cache TTL (default 48h)', () => {
      withConfig('REAL_DEAL_CACHE_HOURS', 48, () => {
        const now = Date.now();
        const freshEntry = { tiefstpreis: 100, time: now - 40 * HOUR };
        const expiredEntry = { tiefstpreis: 100, time: now - 50 * HOUR };

        assert.equal(isCacheEntryFresh(freshEntry), true);
        assert.equal(isCacheEntryFresh(expiredEntry), false);
      });
    });

    it('enforces negative cache TTL (default 2h)', () => {
      withConfig('NEGATIVE_CACHE_HOURS', 2, () => {
        const now = Date.now();
        const freshNeg = { unavailable: true, time: now - 1 * HOUR };
        const expiredNeg = { unavailable: true, time: now - 3 * HOUR };

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

  describe('cache generation (stale-write guard)', () => {
    it('drops writes stamped with a pre-clear generation', () => {
      const gen = currentCacheGen();
      clearPriceStatsCache(null);
      setCachedPriceStats('stale-write', { tiefstpreis: 50 }, false, null, undefined, gen);
      assert.equal(getCachedPriceStats('stale-write', false, null), null);
    });

    it('accepts writes stamped with the current generation', () => {
      setCachedPriceStats('fresh-write', { tiefstpreis: 50 }, false, null, undefined, currentCacheGen());
      assert.equal(getCachedPriceStats('fresh-write', false, null).tiefstpreis, 50);
    });

    it('unstamped writes always go through (legacy callers)', () => {
      bumpCacheGeneration();
      setCachedPriceStats('unstamped', { tiefstpreis: 60 }, false, null);
      assert.equal(getCachedPriceStats('unstamped', false, null).tiefstpreis, 60);
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

  describe('recompute horizon', () => {
    it('recomputes cross-mode entries instead of skipping them (F-07)', () => {
      withConfig('USE_SHIPPING_PRICE', false, () => {
        const now = Date.now();
        const series = [[now - 3 * DAY, 100], [now - 2 * DAY, 100], [now - 1 * DAY, 90], [now, 90]];
        const stats = analyzePriceTimeSeries(series, 90, 365);
        stats.isShippingPrice = true;
        setCachedPriceStats('xmode', stats, false, null, true);
        recomputeCachedMedians(30);
        const after = memoryCache.get(statsKey('xmode', true));
        assert.equal(after.horizonDays, 30);
      });
      memoryCache.delete(statsKey('xmode', true));
    });
    it('heals stale-sig memory hits on read without recomputeCachedMedians', () => {
      const now = Date.now();
      const series = [
        [now - 500 * DAY, 2000],
        [now - 400 * DAY, 1900],
        [now - 60 * DAY, 800],
        [now - 30 * DAY, 780],
        [now, 750]
      ];
      withConfig('OUTLIER_REJECTION_ENABLED', false, () => {
        const seed = analyzePriceTimeSeries(series, null, 0);
        assert.equal(seed.medianPrice, 800);
        withConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', 0, () => setCachedPriceStats('heal1', seed, false, null));
        const healed = withConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', 90, () => getCachedPriceStats('heal1', false, null));
        assert.equal(healed.medianPrice, 780);
        assert.equal(healed.horizonDays, 90);
      });
      memoryCache.delete(statsKey('heal1'));
    });
  });

  describe('dealer persistence', () => {
    it('round-trips dealer + url + offers per price basis', () => {
      const s = memStorage();
      setCachedDealer('p1', false, 'Galaxus', 'https://www.toppreise.ch/ext_de?oid=1', s);
      setCachedDealer('p1', true, 'Brack', '', s, 7);
      assert.deepEqual(getCachedDealer('p1', false, s), { dealer: 'Galaxus', url: 'https://www.toppreise.ch/ext_de?oid=1', offers: 0, totalOffers: 0 });
      assert.deepEqual(getCachedDealer('p1', true, s), { dealer: 'Brack', url: '', offers: 7, totalOffers: 0 });
      assert.equal(getCachedDealer('p2', false, s), null);
    });

    it('keeps loaded rows and aggregate total apart (legacy: total 0)', () => {
      const s = memStorage();
      setCachedDealer('p9', false, 'Digitec', '', s, 10, 43);
      assert.deepEqual(getCachedDealer('p9', false, s), { dealer: 'Digitec', url: '', offers: 10, totalOffers: 43 });
      s.setItem(DEALER_CACHE_PREFIX + 'legacy', JSON.stringify({ time: Date.now(), p: { dealer: 'Galaxus', url: '', offers: 5 } }));
      assert.deepEqual(getCachedDealer('legacy', false, s), { dealer: 'Galaxus', url: '', offers: 5, totalOffers: 0 });
    });

    it('expires with the price-history TTL', () => {
      const s = memStorage();
      withConfig('REAL_DEAL_CACHE_HOURS', 48, () => {
        s.setItem(DEALER_CACHE_PREFIX + 'old', JSON.stringify({ time: Date.now() - 50 * HOUR, p: { dealer: 'Galaxus', url: '' } }));
        assert.equal(getCachedDealer('old', false, s), null);
        setCachedDealer('fresh', false, 'Galaxus', '', s);
        assert.equal(getCachedDealer('fresh', false, s).dealer, 'Galaxus');
      });
    });

    it('expires per slot: a stale sibling never kills the fresh slot', () => {
      const s = memStorage();
      withConfig('REAL_DEAL_CACHE_HOURS', 48, () => {
        setCachedDealer('p1', false, 'Galaxus', '', s);
        setCachedDealer('p1', true, 'Brack', '', s);
        const raw = JSON.parse(s.getItem(DEALER_CACHE_PREFIX + 'p1'));
        raw.p.time = Date.now() - 50 * HOUR;
        s.setItem(DEALER_CACHE_PREFIX + 'p1', JSON.stringify(raw));
        assert.equal(getCachedDealer('p1', false, s), null);
        assert.equal(getCachedDealer('p1', true, s).dealer, 'Brack');
      });
    });

    it('reads legacy top-level-time entries through either slot', () => {
      const s = memStorage();
      withConfig('REAL_DEAL_CACHE_HOURS', 48, () => {
        s.setItem(DEALER_CACHE_PREFIX + 'legacy', JSON.stringify({ time: Date.now(), p: { dealer: 'Galaxus', url: '' } }));
        assert.equal(getCachedDealer('legacy', false, s).dealer, 'Galaxus');
      });
    });

    it('prune retains fresh dealer entries', () => {
      const s = memStorage();
      setCachedDealer('p1', false, 'Galaxus', '', s);
      prunePriceStatsCache(s);
      assert.equal(getCachedDealer('p1', false, s).dealer, 'Galaxus');
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
  describe('hasUsablePriceStats', () => {
    it('rejects negative markers, zero/partial stats and nulls', () => {
      assert.equal(hasUsablePriceStats(null), false);
      assert.equal(hasUsablePriceStats(undefined), false);
      assert.equal(hasUsablePriceStats({ unavailable: true, time: Date.now() }), false);
      assert.equal(hasUsablePriceStats({ tiefstpreis: 0, time: Date.now() }), false);
      assert.equal(hasUsablePriceStats({ medianPrice: 0 }), false);
      assert.equal(hasUsablePriceStats({}), false);
    });
    it('accepts tiefstpreis hits and median-only fallback stats', () => {
      assert.equal(hasUsablePriceStats({ tiefstpreis: 50 }), true);
      assert.equal(hasUsablePriceStats({ medianPrice: 100 }), true);
      assert.equal(hasUsablePriceStats({ tiefstpreis: 50, unavailable: false }), true);
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
        s.setItem(SHARED_CACHE_PREFIX + 'old', JSON.stringify({ priceCents: 1000, time: Date.now() - 49 * HOUR }));
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
      s.setItem(SHARED_CACHE_PREFIX + 'old', JSON.stringify({ priceCents: 1000, time: Date.now() - 15 * DAY }));
      setSharedDeal('fresh', 1000, s);
      prunePriceStatsCache(s);
      assert.equal(getSharedDeal('old', 1000, s), false);
      assert.equal(getSharedDeal('fresh', 1000, s), true);
    });

    it('forceEvict drops the oldest quarter even under the size threshold', () => {
      const s = memStorage();
      for (let i = 0; i < 100; i++) {
        s.setItem('tp_hist_v1_e' + i, JSON.stringify({ time: Date.now() - (100 - i) * 1000, tiefstpreis: i }));
      }
      prunePriceStatsCache(s, true);
      assert.equal(s.getItem('tp_hist_v1_e0'), null);
      assert.equal(s.getItem('tp_hist_v1_e24'), null);
      assert.notEqual(s.getItem('tp_hist_v1_e25'), null);
      assert.notEqual(s.getItem('tp_hist_v1_e99'), null);
    });

    it('prunes entries using fast regex and falls back to JSON.parse for legacy keys', () => {
      const s = memStorage();
      const now = Date.now();
      // Fast format (time first)
      s.setItem('tp_hist_v1_fast_old', `{"time":${now - 15 * DAY},"tiefstpreis":50}`);
      s.setItem('tp_hist_v1_fast_new', `{"time":${now - 1 * DAY},"tiefstpreis":60}`);
      // Legacy format (time not first)
      s.setItem('tp_hist_v1_leg_old', JSON.stringify({ tiefstpreis: 70, time: now - 15 * DAY }));
      s.setItem('tp_hist_v1_leg_new', JSON.stringify({ tiefstpreis: 80, time: now - 1 * DAY }));

      prunePriceStatsCache(s);
      assert.equal(s.getItem('tp_hist_v1_fast_old'), null);
      assert.notEqual(s.getItem('tp_hist_v1_fast_new'), null);
      assert.equal(s.getItem('tp_hist_v1_leg_old'), null);
      assert.notEqual(s.getItem('tp_hist_v1_leg_new'), null);
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
        const fixedTime = now - HOUR;
        setCachedPriceStats('p1', seedStats, false, null);
        memoryCache.get(statsKey('p1')).time = fixedTime;
        setCachedPriceStats('p2', { tiefstpreis: 100 }, false, null);
        const s = memStorage();
        s.setItem(statsKey('p3'), JSON.stringify({ ...seedStats, time: fixedTime }));
        // Memory-only: cold storage entries recompute lazily on read.
        const rewritten = recomputeCachedMedians(90, s);
        assert.equal(rewritten, 1);
        const e1 = memoryCache.get(statsKey('p1'));
        assert.equal(e1.medianPrice, 780);
        assert.equal(e1.horizonDays, 90);
        assert.equal(e1.medianFallback, false);
        assert.equal(e1.time, fixedTime); // TTL untouched: no refetch
        assert.equal(memoryCache.get(statsKey('p2')).tiefstpreis, 100);
        assert.equal(memoryCache.get(statsKey('p2')).medianPrice, undefined);
        assert.equal(memoryCache.has(statsKey('p3')), false);
        const e3 = withConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', 90, () => getCachedPriceStats('p3', false, s));
        assert.equal(e3.horizonDays, 90);
        assert.equal(e3.medianPrice, 780);
        assert.equal(e3.time, fixedTime);
      });
    });

    it('restores filtered points via rawTimeSeries when rejection is off', () => {
      const now = Date.now();
      const glitchy = [
        [now - 10 * DAY, 1300],
        [now - 9 * DAY, 1250],
        [now - 7 * DAY, 1200],
        [now - 6 * DAY, 15],
        [now - 5 * DAY, 1200],
        [now - 4 * DAY, 1180],
        [now - 3 * DAY, 1150],
        [now - 2 * DAY, 1100],
        [now - 1 * DAY, 1050],
        [now, 999]
      ];
      const seed = withConfig('OUTLIER_REJECTION_ENABLED', true, () => analyzePriceTimeSeries(glitchy, null, 0));
      assert.equal(seed.filteredOutliers.length, 1);
      assert.ok(Array.isArray(seed.rawTimeSeries));
      const fixedTime = now - HOUR;
      setCachedPriceStats('raw1', seed, false, null);
      memoryCache.get(statsKey('raw1')).time = fixedTime;
      withConfig('OUTLIER_REJECTION_ENABLED', false, () => {
        assert.equal(recomputeCachedMedians(0, null), 1);
      });
      const e = memoryCache.get(statsKey('raw1'));
      assert.equal(e.filteredOutliers.length, 0);
      assert.equal(e.timeSeries.length, glitchy.length);
      assert.equal(e.time, fixedTime);
      assert.ok(Array.isArray(e.rawTimeSeries));
    });

    it('falls back to timeSeries for entries without rawTimeSeries', () => {
      const now = Date.now();
      const series = [
        [now - 500 * DAY, 2000],
        [now - 400 * DAY, 1900],
        [now - 60 * DAY, 800],
        [now - 30 * DAY, 780],
        [now, 750]
      ];
      withConfig('OUTLIER_REJECTION_ENABLED', false, () => {
        const seed = analyzePriceTimeSeries(series, null, 0);
        assert.equal(seed.rawTimeSeries, undefined);
        setCachedPriceStats('legacy', seed, false, null);
        assert.equal(recomputeCachedMedians(90, null), 1);
        assert.equal(memoryCache.get(statsKey('legacy')).medianPrice, 780);
      });
    });

    it('recomputes both _s and _p cache entries regardless of active basis (F-07)', () => {
      const now = Date.now();
      const series = [
        [now - 500 * DAY, 2000],
        [now - 400 * DAY, 1900],
        [now - 60 * DAY, 800],
        [now - 30 * DAY, 780],
        [now, 750]
      ];
      withConfig('USE_SHIPPING_PRICE', false, () => {
        const seedProduct = analyzePriceTimeSeries(series, null, 0);
        const seedShipping = analyzePriceTimeSeries(series, null, 0);
        setCachedPriceStats('both1', seedProduct, false, null, false);
        setCachedPriceStats('both1', seedShipping, false, null, true);
        assert.equal(recomputeCachedMedians(90, null), 2);
        assert.equal(memoryCache.get(statsKey('both1', false)).medianPrice, 780);
        assert.equal(memoryCache.get(statsKey('both1', true)).medianPrice, 780);
      });
      memoryCache.delete(statsKey('both1', false));
      memoryCache.delete(statsKey('both1', true));
    });

    it('writes every entry while prune is throttled', () => {
      const s = memStorage();
      let setCalls = 0;
      const counting = {
        ...s,
        setItem: (k, v) => { setCalls++; s.setItem(k, v); },
      };
      for (let i = 0; i < 50; i++) {
        setCachedPriceStats('w' + i, { tiefstpreis: 100 + i, timeSeries: [[Date.now(), 100 + i]] }, false, counting);
      }
      assert.equal(setCalls, 50);
      assert.equal(counting.getItem(statsKey('w0')) !== null, true);
      assert.equal(counting.getItem(statsKey('w49')) !== null, true);
    });

    it('prunes once and retries on quota error', () => {
      const s = memStorage();
      let attempts = 0;
      const flaky = {
        ...s,
        setItem: (k, v) => {
          attempts++;
          if (attempts === 1) {
            const e = new Error('quota');
            e.name = 'QuotaExceededError';
            throw e;
          }
          s.setItem(k, v);
        },
      };
      setCachedPriceStats('q1', { tiefstpreis: 100, timeSeries: [[Date.now(), 100]] }, false, flaky);
      assert.equal(flaky.getItem(statsKey('q1')) !== null, true);
    });

    it('survives a throwing storage getter: memory LRU keeps working', () => {
      const prev = Object.getOwnPropertyDescriptor(globalThis, 'window');
      Object.defineProperty(globalThis, 'window', { configurable: true, get() { throw new Error('denied'); } });
      try {
        setCachedPriceStats('throw-pid', { tiefstpreis: 50 });
        assert.equal(getCachedPriceStats('throw-pid')?.tiefstpreis, 50);
        assert.equal(countCachedPriceStats(), 0);
      } finally {
        if (prev) Object.defineProperty(globalThis, 'window', prev);
        else delete globalThis.window;
      }
    });
  });
});
