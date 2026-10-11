import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePrice,
  priceToCents,
  extractCanonicalPrice,
  parsePriceStatsFromHtml,
  sanitizeTimeSeries,
  analyzePriceTimeSeries
} from '../../src/domain/price.js';
import { DAY, withConfig } from './helpers.js';

describe('Price Domain Module', () => {
  describe('parsePrice', () => {
    it('handles various European and Swiss separator formats', () => {
      const cases = [
        ['1.385.90', 1385.90],
        ['1,385.90', 1385.90],
        ['1.385,90', 1385.90],
        ['1,385,900', 1385900],
        ['1.385.900', 1385900],
        ['1,385', 1385],
        ["1'385.90", 1385.90],
        ["CHF 1'433.00", 1433.00],
        ['12.-', 12.00],
        ['12.–', 12.00],
        ['99.-', 99.00],
        ['Gratis', 0],
        ['kostenlos', 0],
        ['', 0],
        [null, 0],
        [undefined, 0]
      ];

      for (const [input, expected] of cases) {
        assert.equal(parsePrice(input), expected, `Failed on input: "${input}"`);
      }
    });

    it('handles irregular spacing and currency prefixes', () => {
      assert.equal(parsePrice('  CHF   250.50  '), 250.50);
      assert.equal(parsePrice("CHF 12'999.95"), 12999.95);
      assert.equal(parsePrice('€ 49,99'), 49.99);
    });
  });

  describe('priceToCents', () => {
    it('converts prices to exact integer cents avoiding float rounding issues', () => {
      assert.equal(priceToCents(12.34), 1234);
      assert.equal(priceToCents(19.99), 1999);
      assert.equal(priceToCents(0.1 + 0.2), 30);
      assert.equal(priceToCents('149.95'), 14995);
      assert.equal(priceToCents(0), 0);
      assert.equal(priceToCents(null), 0);
    });
  });

  describe('sanitizeTimeSeries', () => {
    it('returns series untouched when points < 3', () => {
      const smallSeries = [[1000, 50], [2000, 45]];
      const result = sanitizeTimeSeries(smallSeries);
      assert.deepEqual(result.cleanPoints, smallSeries);
      assert.equal(result.filteredOutliers.length, 0);
    });

    it('filters out transient glitch spikes (< 35% median lasting < 48 hours)', () => {
      const now = Date.now();
      const series = [
        [now - 10 * DAY, 1300],
        [now - 9 * DAY, 1250],
        [now - 7 * DAY, 1200],
        [now - 6 * DAY, 15],   // Glitch drop: CHF 15 on a CHF 1200 product
        [now - 5 * DAY, 1200],
        [now - 4 * DAY, 1180],
        [now - 3 * DAY, 1150],
        [now - 2 * DAY, 1100],
        [now - 1 * DAY, 1050],
        [now, 999]              // Real all-time low
      ];

      const result = sanitizeTimeSeries(series);
      assert.equal(result.filteredOutliers.length, 1);
      assert.equal(result.filteredOutliers[0].price, 15);
      assert.equal(result.cleanPoints.length, 9);
      assert.ok(!result.cleanPoints.some(p => p[1] === 15));
    });

    it('does not filter legitimate sustained drops', () => {
      const now = Date.now();
      const series = [
        [now - 5 * DAY, 100],
        [now - 4 * DAY, 100],
        [now - 3 * DAY, 20],   // Sustained price cut lasting 3 days
        [now - 2 * DAY, 20],
        [now - 1 * DAY, 20],
        [now, 20]
      ];

      const result = sanitizeTimeSeries(series);
      // Because price is sustained, surrounding points are not >= 60% of raw median
      assert.ok(result.cleanPoints.some(p => p[1] === 20));
    });

    it('filters out transient upward spikes (> 2.5x median lasting < 48 hours)', () => {
      const now = Date.now();
      const series = [
        [now - 10 * DAY, 1200],
        [now - 9 * DAY, 1180],
        [now - 7 * DAY, 1150],
        [now - 6 * DAY, 5000],  // Glitch spike: CHF 5000 on a CHF 1150 product
        [now - 5 * DAY, 1150],
        [now - 4 * DAY, 1140],
        [now - 3 * DAY, 1130],
        [now - 2 * DAY, 1120],
        [now - 1 * DAY, 1110],
        [now, 1100]
      ];

      const result = sanitizeTimeSeries(series);
      assert.equal(result.filteredOutliers.length, 1);
      assert.equal(result.filteredOutliers[0].price, 5000);
      assert.equal(result.cleanPoints.length, 9);
      assert.ok(!result.cleanPoints.some(p => p[1] === 5000));
    });

    it('does not filter sustained high price levels', () => {
      const now = Date.now();
      const series = [
        [now - 5 * DAY, 1200],
        [now - 4 * DAY, 1200],
        [now - 3 * DAY, 5000],
        [now - 2 * DAY, 5000],
        [now - 1 * DAY, 5000],
        [now, 5000]
      ];

      const result = sanitizeTimeSeries(series);
      // Sustained level shifts the median, so no spike candidates exist
      assert.ok(result.cleanPoints.some(p => p[1] === 5000));
    });
  });

  describe('analyzePriceTimeSeries', () => {
    it('returns null for empty or invalid series', () => {
      assert.equal(analyzePriceTimeSeries([]), null);
      assert.equal(analyzePriceTimeSeries(null), null);
      assert.equal(analyzePriceTimeSeries('invalid'), null);
    });

    it('computes rolling horizon median, previous low, and discount statistics', () => {
      const now = Date.now();
      const series = [
        [now - 700 * DAY, 2000],
        [now - 600 * DAY, 1900],
        [now - 500 * DAY, 1800],
        [now - 120 * DAY, 850],
        [now - 90 * DAY, 800],
        [now - 60 * DAY, 780],
        [now - 30 * DAY, 750],
        [now, 699]
      ];

      const analysis = withConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', 365, () => withConfig('OUTLIER_REJECTION_ENABLED', true, () => analyzePriceTimeSeries(series, 699)));
      assert.ok(analysis);
      assert.equal(analysis.tiefstpreis, 699);
      assert.equal(analysis.isNewAllTimeLow, true);
      assert.equal(analysis.previousLow, 750);
      assert.equal(analysis.medianPrice, 780); // 1-year window median
      assert.equal(analysis.medianFallback, false); // 5 window points, no fallback
      assert.equal(analysis.realDiscountVsPrevLow, 7); // (750 - 699) / 750 = 6.8% -> 7%
    });

    it('uses strict cent comparison for the trailing plateau (no 1% swallow)', () => {
      const now = Date.now();
      // -0.5% micro-dip: previous low must stay the adjacent 100.00,
      // not an older higher level.
      const series = [
        [now - 30 * DAY, 120.00],
        [now - 20 * DAY, 110.00],
        [now - 10 * DAY, 100.00],
        [now, 99.50]
      ];
      const analysis = withConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', 0, () => withConfig('OUTLIER_REJECTION_ENABLED', false, () => analyzePriceTimeSeries(series, 99.50)));
      assert.ok(analysis);
      assert.equal(analysis.previousLow, 100.00);
      assert.equal(analysis.realDiscountVsPrevLow, 1); // honest micro-dip, badge renders "Tiefstpreis"
    });

    it('averages the two middle values for even point counts (no upper-median bias)', () => {
      const now = Date.now();
      const series = [
        [now - 30 * DAY, 100],
        [now - 20 * DAY, 200],
        [now - 10 * DAY, 300],
        [now, 400]
      ];
      const analysis = withConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', 0, () => withConfig('OUTLIER_REJECTION_ENABLED', false, () => analyzePriceTimeSeries(series, 400)));
      assert.ok(analysis);
      assert.equal(analysis.medianPrice, 250); // (200 + 300) / 2, not 300
      assert.equal(analysis.medianFallback, false);
    });

    it('flags lifetime fallback when fewer than 3 points sit inside the horizon', () => {
      const now = Date.now();
      const series = [
        [now - 700 * DAY, 2000],
        [now - 600 * DAY, 1900],
        [now - 10 * DAY, 800],
        [now, 750]
      ];
      const analysis = withConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', 365, () => withConfig('OUTLIER_REJECTION_ENABLED', false, () => analyzePriceTimeSeries(series, 750)));
      assert.ok(analysis);
      assert.equal(analysis.medianFallback, true);
      // Fallback median spans the full history: [750, 800, 1900, 2000] -> (800 + 1900) / 2
      assert.equal(analysis.medianPrice, 1350);
    });

    it('uses the window median without fallback flag once 3+ points qualify', () => {
      const now = Date.now();
      const series = [
        [now - 700 * DAY, 2000],
        [now - 10 * DAY, 800],
        [now - 5 * DAY, 780],
        [now, 750]
      ];
      const analysis = withConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', 365, () => withConfig('OUTLIER_REJECTION_ENABLED', false, () => analyzePriceTimeSeries(series, 750)));
      assert.ok(analysis);
      assert.equal(analysis.medianFallback, false);
      assert.equal(analysis.medianPrice, 780); // [750, 780, 800] window median
    });

    it('accepts an explicit horizon override independent of CONFIG', () => {
      const now = Date.now();
      const series = [
        [now - 500 * DAY, 2000],
        [now - 400 * DAY, 1900],
        [now - 60 * DAY, 800],
        [now - 30 * DAY, 780],
        [now, 750]
      ];
      withConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', 0, () => withConfig('OUTLIER_REJECTION_ENABLED', false, () => {
        const win = analyzePriceTimeSeries(series, null, 90);
        assert.ok(win);
        assert.equal(win.horizonDays, 90);
        assert.equal(win.medianFallback, false);
        assert.equal(win.medianPrice, 780); // [750, 780, 800] window median
        const thin = analyzePriceTimeSeries(series, null, 30);
        assert.ok(thin);
        assert.equal(thin.horizonDays, 30);
        assert.equal(thin.medianFallback, true); // only 2 window points
        assert.equal(thin.medianPrice, 800); // full-history fallback median
        const life = analyzePriceTimeSeries(series, null, 0);
        assert.ok(life);
        assert.equal(life.medianFallback, false);
        assert.equal(life.medianPrice, 800);
        const fromConfig = analyzePriceTimeSeries(series);
        assert.ok(fromConfig);
        assert.equal(fromConfig.horizonDays, 0); // third arg omitted: CONFIG wins
        assert.equal(fromConfig.medianPrice, 800);
      }));
    });
  });

  describe('parsePriceStatsFromHtml', () => {
    it('returns null when input is empty', () => {
      assert.equal(parsePriceStatsFromHtml(''), null);
      assert.equal(parsePriceStatsFromHtml(null), null);
    });

    it('extracts prices from HTML markup via regex fallback', () => {
      const mockHtml = `
        <div class="col-4 title">Tiefstpreis</div>
        <div class="col-4"><span class="Plugin_Price">CHF 129.90</span></div>
        <div class="col-4 title">Höchstpreis</div>
        <div class="col-4"><span class="Plugin_Price">CHF 199.00</span></div>
        <div class="col-4 title">aktueller Toppreis</div>
        <div class="col-4"><span class="Plugin_Price">CHF 149.00</span></div>
      `;

      const stats = parsePriceStatsFromHtml(mockHtml);
      assert.ok(stats);
      assert.equal(stats.tiefstpreis, 129.90);
      assert.equal(stats.hoechstpreis, 199.00);
      assert.equal(stats.aktuellerToppreis, 149.00);
    });
  });

  describe('extractCanonicalPrice', () => {
    it('returns 0 and null element for missing card', () => {
      const res = extractCanonicalPrice(null);
      assert.equal(res.price, 0);
      assert.equal(res.el, null);
    });

    it('uses fallback containers when main price info is absent', () => {
      const mockCard = {
        querySelector: sel => {
          if (sel.includes('.priceContainer.shippingPrice')) return { textContent: 'CHF 45.00' };
          if (sel.includes('.priceContainer.productPrice')) return { textContent: 'CHF 39.00' };
          return null;
        }
      };

      withConfig('USE_SHIPPING_PRICE', true, () => {
        assert.equal(extractCanonicalPrice(mockCard).price, 45.00);

        // Memoized container reset for product mode
        delete mockCard._tpPriceInfo;
        withConfig('USE_SHIPPING_PRICE', false, () => {
          assert.equal(extractCanonicalPrice(mockCard).price, 39.00);
        });
      });
    });
  });
});
