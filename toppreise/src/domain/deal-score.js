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

  // Ein Tiefstpreis muss echte Ersparnis liefern (Score > 0%)
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
 * Price LEVEL vs usual (median). Signed percent: negative = below median
 * (hot/red), positive = above median, null = no median available.
 * Sorting helper (discount-desc); the badge/heat headline uses getLevelPct.
 */
export function getPriceLevel(cardPrice, stats) {
  const median = stats?.medianPrice;
  if (!cardPrice || !median || cardPrice <= 0 || median <= 0) return null;
  return Math.round(((cardPrice - median) / median) * 100);
}

/**
 * Ø discount vs median, positive = below median (deal), 0 = at/above median
 * or no median. The exact formula the badge headline uses — shared by the
 * heat driver so both always consume the same number (ADR-0002).
 */
export function getLevelPct(cardPrice, stats) {
  const median = stats?.medianPrice;
  if (!cardPrice || !median || cardPrice <= 0 || median <= 0) return 0;
  if (median <= cardPrice) return 0;
  return Math.round(((median - cardPrice) / median) * 100);
}

/**
 * Honest horizon label for the Ø line. The window label (1J / 180T / …) is
 * only shown when the median really comes from that window — lifetime
 * fallbacks (thin history) and the lifetime setting both read "Lifetime".
 * Legacy cache entries predate medianFallback and keep the old window label
 * until they refresh.
 */
export function medianHorizonLabel(stats) {
  if (stats && stats.horizonDays > 0 && !stats.medianFallback) {
    return stats.horizonDays >= 365 ? '1J' : `${stats.horizonDays}T`;
  }
  return 'Lifetime';
}

/**
 * Single heat driver (ADR-0002: color always = badge-% heat, text = kind).
 * One computation feeds BOTH the card heat and the badge headline, so the
 * ribbon number always matches its color. Returns
 * { value, provisional, pct, kind }:
 * - verified deal   -> headline % the badge shows (Rekord vs Ø per mode +
 *                      weight, ADR-0003), null inside the ±5% deadband
 * - verified markup -> null (no deal, no color — the +XX% badge text
 *                      carries the markup signal)
 * - verified but unqualified in Tiefstpreise mode (thin/flat history, the
 *                      badge shows a plain star with no %) -> null
 * - unverified deal -> site Differenz, flagged provisional (rendered paler)
 * - unverified markup / unknown -> null (neutral)
 * Callers may pass { display, dealScore, mode, weightRecord } so the heat
 * reuses the exact inputs of the badge branch (no parallel formulas).
 */
export function getHeatInput(cardPrice, stats, siteDiff, options = {}) {
  const verified = !!stats && stats.tiefstpreis > 0 && cardPrice > 0;
  if (verified) {
    const display = options.display || getDisplayDelta(cardPrice, stats);
    if (display.kind !== 'new-low' && display.kind !== 'at-low') {
      return { value: null, provisional: false, pct: 0, kind: 'markup' };
    }
    const mode = options.mode
      || (CONFIG.BESTPREISE_MODE_ACTIVE ? 'bestpreise' : 'browse');
    const weight = typeof options.weightRecord === 'number' ? options.weightRecord
      : (typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number' ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50);
    const levelPct = getLevelPct(cardPrice, stats);
    let pct = 0;
    let kind = 'none';
    if (mode === 'bestpreise') {
      const dealScore = ('dealScore' in options) ? options.dealScore
        : computeDealScore(stats, cardPrice);
      // Unqualified history: the badge shows a plain star with no % — heat
      // stays neutral to match instead of heating an unshown number.
      if (!dealScore) return { value: null, provisional: false, pct: 0, kind: 'none' };
      const showRecord = !!dealScore.isNewRecord && isSignificantRecord(display);
      const medianHeadline = weight < 0.5 && levelPct > 0;
      if (showRecord && !medianHeadline) { pct = display.dRecord; kind = 'rekord'; }
      else if (levelPct > 0) { pct = levelPct; kind = 'median'; }
    } else {
      const showRecord = isSignificantRecord(display);
      if (showRecord) { pct = display.dRecord; kind = 'rekord'; }
      else if (levelPct > 0) { pct = levelPct; kind = 'median'; }
    }
    if (!(pct > 0)) return { value: null, provisional: false, pct: 0, kind: 'none' };
    // ±5% deadband (documented noise guard): a tiny verified % shows in the
    // badge text but stays gray on the card.
    if (pct < HEAT_NEUTRAL_DEADBAND_PCT) return { value: null, provisional: false, pct, kind };
    return { value: -pct, provisional: false, pct, kind };
  }
  if (typeof siteDiff === 'number' && !isNaN(siteDiff)) {
    // Unverified markup (positive) -> neutral; only real discounts heat.
    if (siteDiff > -HEAT_NEUTRAL_DEADBAND_PCT) {
      const pct = siteDiff < 0 ? -siteDiff : 0;
      return { value: null, provisional: siteDiff < 0, pct, kind: siteDiff < 0 ? 'unverified' : 'unknown' };
    }
    return { value: siteDiff, provisional: true, pct: -siteDiff, kind: 'unverified' };
  }
  return { value: null, provisional: false, pct: 0, kind: 'unknown' };
}
