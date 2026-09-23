/**
 * Pure Deal Scoring & State Logic
 * Evaluates deal classification (new record low, matching all-time low, above low)
 * and continuous weighted deal quality scoring.
 */

import { priceToCents } from './price.js';

export function getDealState(cardPrice, tiefstpreis) {
  if (!cardPrice || !tiefstpreis || cardPrice <= 0 || tiefstpreis <= 0) return 'unknown';
  const cPrice = priceToCents(cardPrice);
  const cTiefstpreis = priceToCents(tiefstpreis);
  if (cPrice < cTiefstpreis) return 'new-low';
  if (cPrice === cTiefstpreis) return 'at-low';
  return 'above-low';
}

export function computeDealScore(stats, cardPrice, options = {}) {
  if (!stats || stats.unavailable || !stats.tiefstpreis || stats.tiefstpreis <= 0) return null;
  if (!cardPrice || cardPrice <= 0) return null;

  // History Qualification Gate:
  // Minimum 5 historical points if timeSeries is present, and >2% variance across history
  const pointsCount = stats.dataPointCount ?? (Array.isArray(stats.timeSeries) ? stats.timeSeries.length : (stats.timeSeries ? 0 : 5));
  if (pointsCount < 5) return null;
  if (stats.hoechstpreis && stats.tiefstpreis > 0 &&
      ((stats.hoechstpreis - stats.tiefstpreis) / stats.tiefstpreis) < 0.02) {
    return null;
  }

  const isAtLow = priceToCents(cardPrice) <= priceToCents(stats.tiefstpreis);
  if (!isAtLow) return null; // Auto-hide non-bestpreise

  const isNewRecord = !!stats.isNewAllTimeLow;
  const dMedian = (stats.medianPrice && stats.medianPrice > cardPrice)
    ? Math.round(((stats.medianPrice - cardPrice) / stats.medianPrice) * 100)
    : (stats.realDiscountVsMedian || stats.realDiscountVsAvg || 0);

  const prevLow = stats.previousLow;
  const dRecord = (isNewRecord && prevLow && prevLow > cardPrice)
    ? Math.round(((prevLow - cardPrice) / prevLow) * 100)
    : (isNewRecord ? (stats.realDiscountVsPrevLow || 0) : 0);

  const defaultWeight = typeof CONFIG !== 'undefined' && typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number'
    ? CONFIG.BESTPREISE_WEIGHT_RECORD
    : 0.50;
  const wRecord = typeof options.weightRecord === 'number' ? options.weightRecord : defaultWeight;
  const wMedian = 1 - wRecord;
  const score = Math.max(0, Math.round(wMedian * dMedian + wRecord * dRecord));

  // A Real Deal must deliver genuine real savings (Score > 0%)
  if (score <= 0) return null;

  return {
    score,
    dMedian,
    dRecord,
    isNewRecord,
    prevLow,
    medianPrice: stats.medianPrice
  };
}
