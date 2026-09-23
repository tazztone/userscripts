import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDealState, computeDealScore } from '../../src/domain/deal-score.js';

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
});
