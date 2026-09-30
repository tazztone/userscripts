import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDealState, computeDealScore, getDisplayDelta, getPriceLevel, getHeatInput, isSignificantRecord } from '../../src/domain/deal-score.js';

describe('Deal Score Domain Module', () => {
  describe('getDealState', () => {
    it('returns "unknown" for missing or non-positive inputs', () => {
      assert.equal(getDealState(null, 100), 'unknown');
      assert.equal(getDealState(100, null), 'unknown');
      assert.equal(getDealState(0, 100), 'unknown');
      assert.equal(getDealState(-10, 100), 'unknown');
    });

    it('classifies new all-time low correctly', () => {
      assert.equal(getDealState(99.95, 100.00), 'new-low');
      assert.equal(getDealState(50, 100), 'new-low');
    });

    it('classifies at all-time low with integer cent precision', () => {
      assert.equal(getDealState(100.00, 100.00), 'at-low');
      assert.equal(getDealState(19.99, 19.99), 'at-low');
    });

    it('classifies above all-time low', () => {
      assert.equal(getDealState(100.05, 100.00), 'above-low');
      assert.equal(getDealState(150, 100), 'above-low');
    });
  });

  describe('computeDealScore', () => {
    const validStats = {
      tiefstpreis: 100,
      hoechstpreis: 200,
      previousLow: 120,
      medianPrice: 150,
      isNewAllTimeLow: true,
      dataPointCount: 10,
      timeSeries: new Array(10).fill([0, 150])
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

    it('calculates weighted score based on median discount and record drop', () => {
      // cardPrice = 90
      // prevLow = 120 -> dRecord = (120 - 90)/120 = 25%
      // medianPrice = 150 -> dMedian = (150 - 90)/150 = 40%
      // With weight 50/50: score = 0.5 * 40 + 0.5 * 25 = 32.5 -> 33
      const result = computeDealScore(validStats, 90, { weightRecord: 0.50 });
      assert.ok(result);
      assert.equal(result.dRecord, 25);
      assert.equal(result.dMedian, 40);
      assert.equal(result.score, 33);
      assert.equal(result.isNewRecord, true);
    });

    it('adjusts score with custom record weight slider', () => {
      // Weight 0.80 record: 0.2 * 40 + 0.8 * 25 = 8 + 20 = 28
      const result = computeDealScore(validStats, 90, { weightRecord: 0.80 });
      assert.ok(result);
      assert.equal(result.score, 28);
    });

    it('returns null if calculated deal score is 0%', () => {
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
  });

  describe('getPriceLevel & getHeatInput (heatmap = badge number)', () => {
    it('heats new records by record size, not by median level', () => {
      // GEDORE screenshot case: -8% badge must be faint warm, even though
      // the price sits far below its median.
      const heat = getHeatInput(30.92, { tiefstpreis: 30.92, medianPrice: 60.00, previousLow: 33.79, isNewAllTimeLow: true }, -51);
      assert.equal(heat.provisional, false);
      assert.equal(heat.value, -8);
    });

    it('heats matched lows by the same O-% the badge shows', () => {
      const heat = getHeatInput(1100, { tiefstpreis: 1100, medianPrice: 1500 }, -35);
      assert.deepEqual(heat, { value: -27, provisional: false });
    });

    it('applies a ±5% neutral deadband (at-low near the median, micro-dips)', () => {
      assert.equal(getHeatInput(90, { tiefstpreis: 90, medianPrice: 93 }, 0).value, null);
      assert.equal(getHeatInput(90, { tiefstpreis: 90, medianPrice: 87 }, 0).value, null);
      assert.equal(getHeatInput(90, { tiefstpreis: 90, medianPrice: 100 }, 0).value, -10);
    });

    it('heats nothing above-low (markup lives in the badge text, not the color)', () => {
      assert.equal(getHeatInput(103, { tiefstpreis: 90, medianPrice: 100 }, 5).value, null);
      assert.equal(getHeatInput(409, { tiefstpreis: 121.90, medianPrice: 400 }, 236).value, null);
    });

    it('heats nothing for unverified markups (positive site Differenz)', () => {
      assert.deepEqual(getHeatInput(0, {}, 53), { value: null, provisional: false });
    });

    it('heats record breakthroughs without a median (HTML fallback)', () => {
      const heat = getHeatInput(1800, { tiefstpreis: 1800, previousLow: 2000, isNewAllTimeLow: true }, -35);
      assert.deepEqual(heat, { value: -10, provisional: false });
    });

    it('heats nothing above-low without a median (POLK HTML fallback)', () => {
      const heat = getHeatInput(341.93, { tiefstpreis: 309.00 }, 11);
      assert.deepEqual(heat, { value: null, provisional: false });
    });

    it('marks unverified site diffs as provisional (rendered paler)', () => {
      const heat = getHeatInput(100, null, -51);
      assert.deepEqual(heat, { value: -51, provisional: true });
      assert.equal(getHeatInput(100, null, 2).value, null); // deadband
    });
  });
});
