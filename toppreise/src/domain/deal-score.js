/**
 * Pure Deal Scoring & State Logic
 * Evaluates deal classification (new record low, matching all-time low, above low)
 * and continuous weighted deal quality scoring.
 */

import { priceToCents } from './price.js';
import { CONFIG } from '../state/config.js';

// Display thresholds (documented in UI: badge titles, heatmap toggle, settings).
// Badge % always answers "how much cheaper, vs what" — never a blended score
// and never the unverified site Differenz once history is verified.
export const HEAT_NEUTRAL_DEADBAND_PCT = 5;
export const MIN_SIGNIFICANT_RECORD_PCT = 2;

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

  const defaultWeight = typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number'
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

/**
 * Display delta (deal EVENT): what the badge shows. Works with minimal stats
 * ({tiefstpreis} + card price); no history-quality gates — those only gate
 * the ranking score, never the displayed truth.
 * - new-low  -> { kind:'new-low', dRecord }  (extra saving vs previous low)
 * - at-low   -> { kind:'at-low' }            (no new saving; badge uses level)
 * - above-low-> { kind:'above-low', markup } (premium vs all-time low)
 */
export function getDisplayDelta(cardPrice, stats) {
  if (!cardPrice || !stats?.tiefstpreis || cardPrice <= 0 || stats.tiefstpreis <= 0) {
    return { kind: 'unknown' };
  }
  const cPrice = priceToCents(cardPrice);
  const cLow = priceToCents(stats.tiefstpreis);
  // Analyzed series include the current price, so a fresh record compares
  // EQUAL in cents — the isNewAllTimeLow flag is authoritative there.
  if (cPrice < cLow || (cPrice === cLow && stats.isNewAllTimeLow)) {
    const prevLow = stats.previousLow;
    let dRecord = 0;
    if (prevLow && prevLow > cardPrice) {
      dRecord = Math.round(((prevLow - cardPrice) / prevLow) * 100);
    } else if (stats.realDiscountVsPrevLow) {
      dRecord = stats.realDiscountVsPrevLow;
    }
    return { kind: 'new-low', dRecord, prevLow: prevLow ?? null };
  }
  if (cPrice === cLow) {
    return { kind: 'at-low', dRecord: 0, prevLow: stats.previousLow ?? null };
  }
  return {
    kind: 'above-low',
    markup: Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100)
  };
}

/** Only records with a meaningful breakthrough earn the "Rekord" badge style;
 *  1-cent micro-dips render as plain "Tiefstpreis". */
export function isSignificantRecord(display) {
  return !!display && display.kind === 'new-low' && (display.dRecord || 0) >= MIN_SIGNIFICANT_RECORD_PCT;
}

/**
 * Price LEVEL vs usual (median): what the heatmap shows. Signed percent:
 * negative = below median (hot/red), positive = above median (cold/blue),
 * null = no median available. Heat is ambient/continuous; the badge owns
 * the precise event number.
 */
export function getPriceLevel(cardPrice, stats) {
  const median = stats?.medianPrice;
  if (!cardPrice || !median || cardPrice <= 0 || median <= 0) return null;
  return Math.round(((cardPrice - median) / median) * 100);
}

/**
 * Single heat driver: the heat IS the badge number. Returns { value, provisional }:
 * - verified new-low  -> -dRecord (record breakthrough the badge shows)
 * - verified at-low   -> -dMedian (same Ø-% the badge shows; null -> neutral)
 * - verified above-low-> +markup (same Aufschlag the badge shows)
 * - unverified        -> site Differenz, flagged provisional (rendered paler)
 * ±5% deadband -> neutral gray.
 */
export function getHeatInput(cardPrice, stats, siteDiff) {
  // Verified: the heat IS the badge number (new-low -> -dRecord, at-low ->
  // the same -dMedian the badge shows, above-low -> +markup). Unverified:
  // site Differenz, flagged provisional (rendered paler).
  if (stats?.tiefstpreis > 0 && cardPrice > 0) {
    const d = getDisplayDelta(cardPrice, stats);
    let v = null;
    if (d.kind === 'new-low') v = -d.dRecord;
    else if (d.kind === 'above-low') v = d.markup;
    else v = getPriceLevel(cardPrice, stats);
    if (v === null || Math.abs(v) < HEAT_NEUTRAL_DEADBAND_PCT) return { value: null, provisional: false };
    return { value: v, provisional: false };
  }
  if (typeof siteDiff === 'number' && !isNaN(siteDiff)) {
    if (Math.abs(siteDiff) < HEAT_NEUTRAL_DEADBAND_PCT) return { value: null, provisional: true };
    return { value: siteDiff, provisional: true };
  }
  return { value: null, provisional: false };
}
