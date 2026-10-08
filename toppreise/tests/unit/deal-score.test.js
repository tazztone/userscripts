import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePriceTimeSeries, recordRefForPrice } from '../../src/domain/price.js';
import { computeDealScore, getDisplayDelta, getLevelPct, getHeatInput, isSignificantRecord, medianHorizonLabel } from '../../src/domain/deal-score.js';
import { CONFIG } from '../../src/state/config.js';

describe('Gewichtete Differenz Domain Module', () => {

  describe('computeDealScore', () => {
    const validStats = {
      tiefstpreis: 100,
      hoechstpreis: 200,
      previousLow: 120,
      medianPrice: 150,
      isNewAllTimeLow: true,
      dataPointCount: 10
    };

    it('returns null when product history does not qualify (< 5 points)', () => {
      const unqualifiedStats = { ...validStats, dataPointCount: 3, timeSeries: [[0, 100], [1, 150]] };
      assert.equal(computeDealScore(unqualifiedStats, 100), null);
    });

    it('returns null when historical price variance is <= 2%', () => {
      const flatStats = { ...validStats, tiefstpreis: 100, hoechstpreis: 101, dataPointCount: 10 };
      assert.equal(computeDealScore(flatStats, 100), null);
    });

    it('returns null when cardPrice is above tiefstpreis (non-bestpreis)', () => {
      assert.equal(computeDealScore(validStats, 105), null);
    });

    it('calculates the blend from median discount and record drop', () => {
      // cardPrice = 90
      // prevLow = 120 -> dRecord = (120 - 90)/120 = 25%
      // medianPrice = 150 -> dMedian = (150 - 90)/150 = 40%
      // With weight 50/50: weightedDiff = 0.5 * 40 + 0.5 * 25 = 32.5 -> 33
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
      try {
        const result = computeDealScore(validStats, 90);
        assert.ok(result);
        assert.equal(result.dRecord, 25);
        assert.equal(result.dMedian, 40);
        assert.equal(result.weightedDiff, 33);
        assert.equal(result.isNewRecord, true);
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('adjusts the blend with custom record weight slider', () => {
      // Weight 0.80 record: 0.2 * 40 + 0.8 * 25 = 8 + 20 = 28
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.80;
      try {
        const result = computeDealScore(validStats, 90);
        assert.ok(result);
        assert.equal(result.weightedDiff, 28);
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('returns null if the calculated blend is 0%', () => {
      const zeroSavingsStats = {
        tiefstpreis: 100,
        hoechstpreis: 200,
        previousLow: 100,
        medianPrice: 100,
        isNewAllTimeLow: false,
        dataPointCount: 10,
        timeSeries: new Array(10).fill([0, 100])
      };
      assert.equal(computeDealScore(zeroSavingsStats, 100), null);
    });

    it('keeps at-low non-records qualified at 100% Rek (weight never filters)', () => {
      // At-low, no new record: dRecord = 0, dMedian = (150-100)/150 = 33%.
      // Blend at w=1 is 0 — must still qualify, slider is sort-only.
      const atLow = { ...validStats, isNewAllTimeLow: false };
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 1.00;
      try {
        const result = computeDealScore(atLow, 100);
        assert.ok(result);
        assert.equal(result.dRecord, 0);
        assert.ok(result.weightedDiff >= 1);
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('keeps new records qualified at 0% Rek (mirrored endpoint)', () => {
      // dMedian = 0 (price == median) but dRecord = 17% (120 -> 100).
      // Blend at w=0 is 0 — must still qualify.
      const noMedianEdge = { ...validStats, medianPrice: 100 };
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.00;
      try {
        const result = computeDealScore(noMedianEdge, 100);
        assert.ok(result);
        assert.equal(result.dMedian, 0);
        assert.ok(result.weightedDiff >= 1);
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });
  });

  describe('getDisplayDelta (badge event, no history gates)', () => {
    it('reports new-low with record discount vs previous low', () => {
      // GEDORE screenshot case: CHF 30.92 vs previous low 33.79 -> -8% (not -51% site)
      const d = getDisplayDelta(30.92, { tiefstpreis: 30.92, previousLow: 33.79, isNewAllTimeLow: true });
      assert.equal(d.kind, 'new-low');
      assert.equal(d.dRecord, 8);
      assert.equal(isSignificantRecord(d), true);
    });

    it('detects fresh records via the analyzed-series flag when cents are equal', () => {
      const d = getDisplayDelta(1800, { tiefstpreis: 1800, previousLow: 2200, isNewAllTimeLow: true });
      assert.equal(d.kind, 'new-low');
      assert.equal(d.dRecord, 18);
    });

    it('treats equal prices without the flag as plain at-low', () => {
      const d = getDisplayDelta(1100, { tiefstpreis: 1100, medianPrice: 1500 });
      assert.equal(d.kind, 'at-low');
      assert.equal(isSignificantRecord(d), false);
    });

    it('reports markup for above-low prices', () => {
      // POLK screenshot case: 341.93 vs low 309 -> +11%
      const d = getDisplayDelta(341.93, { tiefstpreis: 309.00 });
      assert.equal(d.kind, 'above-low');
      assert.equal(d.markup, 11);
    });

    it('flags 1-cent micro-dips as insignificant records', () => {
      const d = getDisplayDelta(33.78, { tiefstpreis: 33.78, previousLow: 33.79, isNewAllTimeLow: true });
      assert.equal(d.kind, 'new-low');
      assert.equal(d.dRecord, 0);
      assert.equal(isSignificantRecord(d), false);
    });

    it('works with minimal HTML-fallback stats (only tiefstpreis)', () => {
      assert.equal(getDisplayDelta(25.00, { tiefstpreis: 21.70 }).kind, 'above-low');
      assert.equal(getDisplayDelta(21.70, { tiefstpreis: 21.70 }).kind, 'at-low');
      assert.equal(getDisplayDelta(10.37, { tiefstpreis: 21.70 }).kind, 'new-low');
      assert.equal(getDisplayDelta(0, { tiefstpreis: 21.70 }).kind, 'unknown');
      assert.equal(getDisplayDelta(10, null).kind, 'unknown');
    });

    it('re-anchors the previous low at the live price when the series lags (ACER case)', () => {
      // Series ends high again (272) after an old 319+ era and a 218 low era;
      // the live offer (169.47) undercuts the series low (218). The stored
      // previousLow (319, walked at the stale series-last point) must not
      // leak into badge or score — true record is -22% vs 218, not -47%.
      const now = Date.now();
      const day = 86400 * 1000;
      const series = [
        [now - 400 * day, 319], [now - 380 * day, 325], [now - 360 * day, 332], [now - 340 * day, 328],
        [now - 90 * day, 218], [now - 80 * day, 225], [now - 70 * day, 220],
        [now - 30 * day, 250], [now - 20 * day, 260], [now - 10 * day, 272]
      ];
      const prevHorizon = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS;
      const prevOutlier = CONFIG.OUTLIER_REJECTION_ENABLED;
      const prevWeight = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS = 0;
      CONFIG.OUTLIER_REJECTION_ENABLED = false;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
      try {
        const stats = analyzePriceTimeSeries(series); // production path: no live price
        assert.ok(stats);
        assert.equal(stats.tiefstpreis, 218);
        assert.equal(stats.previousLow, 319); // stale-anchored at series-last — the trap
        assert.equal(recordRefForPrice(stats, 169.47).previousLow, 218);
        const d = getDisplayDelta(169.47, stats);
        assert.equal(d.kind, 'new-low');
        assert.equal(d.prevLow, 218);
        assert.equal(d.dRecord, 22);
        const deal = computeDealScore(stats, 169.47);
        assert.ok(deal);
        assert.equal(deal.isNewRecord, true);
        assert.equal(deal.dRecord, 22);
      } finally {
        CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS = prevHorizon;
        CONFIG.OUTLIER_REJECTION_ENABLED = prevOutlier;
        CONFIG.BESTPREISE_WEIGHT_RECORD = prevWeight;
      }
    });
  });

  describe('getLevelPct signed & getHeatInput (heatmap = badge blend)', () => {
    it('heats new records by the blend, not by the record event', () => {
      // GEDORE screenshot case: dMedian 48 + dRecord 8 at 50/50 -> blend 28.
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
      try {
        const heat = getHeatInput(30.92, { tiefstpreis: 30.92, medianPrice: 60.00, previousLow: 33.79, isNewAllTimeLow: true }, -51);
        assert.equal(heat.provisional, false);
        assert.equal(heat.pct, 28);
        assert.equal(heat.value, -28);
        assert.equal(heat.kind, 'blend');
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('blends Rek −7 + Ø −23 at 50/50 to weightedDiff 15 (feed screenshot)', () => {
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
      try {
        const stats = {
          tiefstpreis: 77,
          hoechstpreis: 120,
          previousLow: 82.80,
          medianPrice: 100,
          isNewAllTimeLow: true,
          dataPointCount: 10
        };
        const deal = computeDealScore(stats, 77);
        assert.ok(deal);
        assert.equal(deal.dMedian, 23);
        assert.equal(deal.dRecord, 7);
        assert.equal(deal.weightedDiff, 15);
        const heat = getHeatInput(77, stats, -23, 'bestpreise', deal);
        assert.deepEqual(heat, { value: -15, provisional: false, pct: 15, kind: 'blend' });
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('heats matched lows by the blend the badge shows', () => {
      // dMedian 27, no record -> blend 14 at 50/50.
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
      try {
        const heat = getHeatInput(1100, { tiefstpreis: 1100, medianPrice: 1500 }, -35);
        assert.deepEqual(heat, { value: -14, provisional: false, pct: 14, kind: 'blend' });
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('applies a ±5% neutral deadband on the raw blend (number prints, card stays gray)', () => {
      assert.equal(getHeatInput(90, { tiefstpreis: 90, medianPrice: 93 }, 0).value, null);
      assert.equal(getHeatInput(90, { tiefstpreis: 90, medianPrice: 87 }, 0).value, null);
      assert.equal(getHeatInput(90, { tiefstpreis: 90, medianPrice: 100 }, 0).value, -5);
    });

    it('heats nothing above-low (markup lives in the badge text, not the color)', () => {
      assert.equal(getHeatInput(103, { tiefstpreis: 90, medianPrice: 100 }, 5).value, null);
      assert.equal(getHeatInput(409, { tiefstpreis: 121.90, medianPrice: 400 }, 236).value, null);
    });

    it('heats nothing for unverified markups (positive site Differenz)', () => {
      assert.deepEqual(getHeatInput(0, {}, 53), { value: null, provisional: false, pct: 0, kind: 'unknown' });
    });

    it('blends record breakthroughs without a median (HTML fallback)', () => {
      // dRecord 10, no median -> blend 5 at 50/50, raw blend exactly 5 -> heated.
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
      try {
        const heat = getHeatInput(1800, { tiefstpreis: 1800, previousLow: 2000, isNewAllTimeLow: true }, -35);
        assert.deepEqual(heat, { value: -5, provisional: false, pct: 5, kind: 'blend' });
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('heats nothing above-low without a median (POLK HTML fallback)', () => {
      assert.deepEqual(getHeatInput(341.93, { tiefstpreis: 309.00 }, 11), { value: null, provisional: false, pct: 0, kind: 'markup' });
    });

    it('marks unverified site diffs as provisional (striped-gray, never heated)', () => {
      const heat = getHeatInput(100, null, -51);
      assert.deepEqual(heat, { value: -51, provisional: true, pct: 51, kind: 'unverified' });
      assert.equal(getHeatInput(100, null, 2).value, null); // deadband
    });
  });

  describe('getLevelPct (Ø discount vs median)', () => {
    it('reports the Ø discount as a positive percent', () => {
      assert.equal(getLevelPct(49, { medianPrice: 100 }), 51);
      assert.equal(getLevelPct(1100, { medianPrice: 1500 }), 27);
    });

    it('returns 0 at/above median or without data', () => {
      assert.equal(getLevelPct(100, { medianPrice: 100 }), 0);
      assert.equal(getLevelPct(110, { medianPrice: 100 }), 0);
      assert.equal(getLevelPct(90, {}), 0);
      assert.equal(getLevelPct(0, { medianPrice: 100 }), 0);
    });

    it('returns the signed level vs median when signed=true (sort helper)', () => {
      assert.equal(getLevelPct(49, { medianPrice: 100 }, true), -51);
      assert.equal(getLevelPct(110, { medianPrice: 100 }, true), 10);
      assert.equal(getLevelPct(90, {}, true), null);
    });
  });

  describe('getHeatInput blend parity (ADR-0005: badge = heat = sort key)', () => {
    // Screenshot case (DJI vs KEZZEL): a 1-cent micro-record far below the
    // median. The badge prints the blend (dMedian 51 + dRecord 0 at 50/50
    // -> 26), so the heat must be -26 — never gray under a numbered ribbon.
    const microStats = {
      tiefstpreis: 23.56,
      medianPrice: 48.56,
      previousLow: 23.57,
      isNewAllTimeLow: true,
      hoechstpreis: 60,
      dataPointCount: 10,
      // Self-consistent micro-record history: nine points at 48, then the
      // 23.57 low the card undercuts by 1 cent (a flat 48-only series would
      // contradict the stored previous low).
      timeSeries: [...new Array(9).fill([0, 48]), [0, 23.57]]
    };

    it('heats micro-records by the blend (Tiefstpreise mode)', () => {
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
      try {
        const heat = getHeatInput(23.56, microStats, -51, 'bestpreise');
        assert.equal(heat.pct, 26);
        assert.equal(heat.kind, 'blend');
        assert.equal(heat.value, -26);
        assert.equal(heat.provisional, false);
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('heats micro-records by the blend (browse mode)', () => {
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
      try {
        const heat = getHeatInput(23.56, microStats, -51, 'browse');
        assert.deepEqual(heat, { value: -26, provisional: false, pct: 26, kind: 'blend' });
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('stays neutral when Tiefstpreise mode cannot qualify the history', () => {
      // Thin history: no blend to print — heat matches.
      const thinStats = { ...microStats, dataPointCount: 3, timeSeries: [[0, 48], [1, 49]] };
      const heat = getHeatInput(23.56, thinStats, -51, 'bestpreise');
      assert.deepEqual(heat, { value: null, provisional: false, pct: 0, kind: 'none' });
    });

    it('honors an explicitly passed blend instead of recomputing', () => {
      // Same thin history as above (computes to null), but the caller already
      // qualified this card — the passed blend must win over the recompute.
      const thinStats = { ...microStats, dataPointCount: 3, timeSeries: [[0, 48], [1, 49]] };
      const heat = getHeatInput(23.56, thinStats, -51, 'bestpreise',
        { weightedDiff: 26, dMedian: 51, dRecord: 0, isNewRecord: false, prevLow: null, medianPrice: 48 });
      assert.deepEqual(heat, { value: -26, provisional: false, pct: 26, kind: 'blend' });
    });

    it('follows the weight in every mode (browse prints the blend too)', () => {
      // dMedian 40 + dRecord 25: w=0.3 -> 36, w=0.5 -> 33, w=0.8 -> 28.
      const stats = { tiefstpreis: 90, medianPrice: 150, previousLow: 120, isNewAllTimeLow: true };
      for (const [weightRecord, blend] of [[0.30, 36], [0.50, 33], [0.80, 28]]) {
        const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
        CONFIG.BESTPREISE_WEIGHT_RECORD = weightRecord;
        try {
          const heat = getHeatInput(90, stats, -40, 'browse');
          assert.deepEqual(heat, { value: -blend, provisional: false, pct: blend, kind: 'blend' });
        } finally {
          CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
        }
      }
    });

    it('follows the weight inside the feed (blend moves with the slider)', () => {
      const stats = { tiefstpreis: 90, medianPrice: 150, previousLow: 120, isNewAllTimeLow: true };
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      try {
        CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
        const balanced = getHeatInput(90, stats, -40, 'bestpreise');
        assert.deepEqual(balanced, { value: -33, provisional: false, pct: 33, kind: 'blend' });
        CONFIG.BESTPREISE_WEIGHT_RECORD = 0.30;
        const medianHeavy = getHeatInput(90, stats, -40, 'bestpreise');
        assert.deepEqual(medianHeavy, { value: -36, provisional: false, pct: 36, kind: 'blend' });
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('keeps a tiny blend in the badge text but gray on the card (±5% guard)', () => {
      const heat = getHeatInput(90, { tiefstpreis: 90, medianPrice: 93 }, 0, 'browse');
      assert.equal(heat.pct, 2);
      assert.equal(heat.kind, 'blend');
      assert.equal(heat.value, null);
    });
  });

  describe('medianHorizonLabel (honest Ø horizon)', () => {
    it('labels the configured window when the median really comes from it', () => {
      assert.equal(medianHorizonLabel({ horizonDays: 365, medianFallback: false }), '1J');
      assert.equal(medianHorizonLabel({ horizonDays: 180, medianFallback: false }), '180T');
      assert.equal(medianHorizonLabel({ horizonDays: 90, medianFallback: false }), '90T');
    });

    it('reads Lifetime on lifetime fallback, lifetime setting, or missing horizon', () => {
      assert.equal(medianHorizonLabel({ horizonDays: 365, medianFallback: true }), 'Lifetime');
      assert.equal(medianHorizonLabel({ horizonDays: 0, medianFallback: false }), 'Lifetime');
      assert.equal(medianHorizonLabel({}), 'Lifetime');
      assert.equal(medianHorizonLabel(null), 'Lifetime');
    });

    it('keeps the old window label for legacy cache entries without the flag', () => {
      assert.equal(medianHorizonLabel({ horizonDays: 365 }), '1J');
    });
  });

  describe('raw-value thresholds (no rounding flips)', () => {
    it('treats a 1.96% record as insignificant though it displays as 2%', () => {
      // (51 - 50) / 51 = 1.9608% -> dRecord 2, but raw < 2.0
      const d = getDisplayDelta(50.00, { tiefstpreis: 50.00, previousLow: 51.00, isNewAllTimeLow: true });
      assert.equal(d.kind, 'new-low');
      assert.equal(d.dRecord, 2);
      assert.equal(isSignificantRecord(d), false);
    });

    it('treats an exact 2.0% record as significant (inclusive boundary)', () => {
      const d = getDisplayDelta(49.00, { tiefstpreis: 49.00, previousLow: 50.00, isNewAllTimeLow: true });
      assert.equal(d.dRecord, 2);
      assert.equal(isSignificantRecord(d), true);
    });

    it('keeps a tiny blend in the badge text but gray on the card (raw blend < 5)', () => {
      // dMedian 5, no record -> blend 3 at 50/50, raw blend 2.45 < 5 deadband
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
      try {
        const heat = getHeatInput(190.20, { tiefstpreis: 190.20, medianPrice: 200 }, 0, 'browse');
        assert.deepEqual(heat, { value: null, provisional: false, pct: 3, kind: 'blend' });
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });

    it('heats a large blend even when the record leg alone is below the deadband', () => {
      // dMedian 52 + dRecord 5 -> blend 29, raw blend 28.7 -> heated.
      const prev = CONFIG.BESTPREISE_WEIGHT_RECORD;
      CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
      try {
        const stats = { tiefstpreis: 190.20, medianPrice: 400, previousLow: 200, isNewAllTimeLow: true };
        const heat = getHeatInput(190.20, stats, 0, 'browse');
        assert.deepEqual(heat, { value: -29, provisional: false, pct: 29, kind: 'blend' });
      } finally {
        CONFIG.BESTPREISE_WEIGHT_RECORD = prev;
      }
    });
  });
});
