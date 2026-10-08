/**
 * Pure Deal Scoring & State Logic
 * Evaluates deal classification (new record low, matching all-time low, above low)
 * and continuous weighted deal quality scoring.
 */

import { priceToCents, recordRefForPrice } from './price.js';
import { CONFIG } from '../state/config.js';

// Display thresholds (documented in UI: badge titles, heatmap toggle, settings).
// Badge % is the Gewichtete Differenz (weight-blended Ø-discount +
// record-margin) — never the unverified site Differenz once history is verified.
export const HEAT_NEUTRAL_DEADBAND_PCT = 5;
export const MIN_SIGNIFICANT_RECORD_PCT = 2;


export function computeDealScore(stats, cardPrice) {
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

  // Live-anchored: the stored flag is relative to the (lagging) series-last
  // point, not to this offer — re-derive it per card (fallback stats without
  // a series keep their stored values).
  const liveRec = recordRefForPrice(stats, cardPrice);
  const isNewRecord = liveRec.isNewRecord;
  // Defensive fallback chain: series stats always carry a median; only
  // exotic hand-built stats fall through to the mean (or 0 = unscorable).
  const dMedian = (stats.medianPrice && stats.medianPrice > cardPrice)
    ? Math.round(((stats.medianPrice - cardPrice) / stats.medianPrice) * 100)
    : (stats.realDiscountVsMedian || 0);

  const prevLow = liveRec.previousLow;
  const dRecord = (isNewRecord && prevLow && prevLow > cardPrice)
    ? Math.round(((prevLow - cardPrice) / prevLow) * 100)
    : (isNewRecord ? (stats.realDiscountVsPrevLow || 0) : 0);

  const wRecord = typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number'
    ? CONFIG.BESTPREISE_WEIGHT_RECORD
    : 0.50;
  // Qualification is weight-independent: a Tiefstpreis qualifies on real
  // saving in EITHER component. Gating on the blend hid every
  // non-record at 100% Rek (0×Ø + 1×0 = 0) although the slider only promises
  // "Sortierung + Farb-Emphase", never filtering. Clamp to >= 1 so qualified
  // deals keep sorting above unchecked cards (0) and hidden non-deals (-100).
  if (dMedian <= 0 && dRecord <= 0) return null;
  const wMedian = 1 - wRecord;
  const weightedDiff = Math.max(1, Math.round(wMedian * dMedian + wRecord * dRecord));

  return {
    weightedDiff,
    dMedian,
    dRecord,
    isNewRecord,
    prevLow,
    medianPrice: stats.medianPrice
  };
}

/**
 * Display delta (deal EVENT): new-low / at-low / above-low classification.
 * Works with minimal stats ({tiefstpreis} + card price); no
 * history-quality gates — those only gate the ranking blend, never the event.
 * - new-low  -> { kind:'new-low', dRecord }  (extra saving vs previous low)
 * - at-low   -> { kind:'at-low' }            (no new saving)
 * - above-low-> { kind:'above-low', markup } (premium vs all-time low)
 */
export function getDisplayDelta(cardPrice, stats) {
  if (!cardPrice || !stats?.tiefstpreis || cardPrice <= 0 || stats.tiefstpreis <= 0) {
    return { kind: 'unknown' };
  }
  const cPrice = priceToCents(cardPrice);
  const cLow = priceToCents(stats.tiefstpreis);
  // Live-anchored like the blend: the series lags the offer, so the stored
  // regime low/flag (relative to series-last) is re-derived per card price.
  // Series-less fallback stats keep their stored values.
  const liveRec = recordRefForPrice(stats, cardPrice);
  if (cPrice < cLow || (cPrice === cLow && liveRec.isNewRecord)) {
    const prevLow = liveRec.previousLow;
    // dRecordRaw drives the significance decision; the rounded dRecord is
    // display only — a true 1.96% dip must not flip the 2% gate by rounding.
    let dRecord = 0;
    let dRecordRaw = 0;
    if (prevLow && prevLow > cardPrice) {
      dRecordRaw = ((prevLow - cardPrice) / prevLow) * 100;
      dRecord = Math.round(dRecordRaw);
    } else if (stats.realDiscountVsPrevLow) {
      dRecord = stats.realDiscountVsPrevLow;
      dRecordRaw = stats.realDiscountVsPrevLow;
    }
    return { kind: 'new-low', dRecord, dRecordRaw, prevLow: prevLow ?? null };
  }
  if (cPrice === cLow) {
    return { kind: 'at-low', dRecord: 0, dRecordRaw: 0, prevLow: liveRec.previousLow };
  }
  return {
    kind: 'above-low',
    markup: Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100)
  };
}

/** Only records with a meaningful breakthrough earn the "Rekord" badge style;
 *  1-cent micro-dips render as plain "Tiefstpreis". Decided on the raw value
 *  (inclusive 2.0 boundary), never the rounded display number. */
export function isSignificantRecord(display) {
  return !!display && display.kind === 'new-low'
    && (typeof display.dRecordRaw === 'number' ? display.dRecordRaw : (display.dRecord || 0)) >= MIN_SIGNIFICANT_RECORD_PCT;
}

/**
 * Ø discount vs median, positive = below median (deal), 0 = at/above median
 * or no median. The exact formula the badge headline uses — shared by the
 * heat driver so both always consume the same number (ADR-0002).
 * With signed=true returns the signed level vs median (negative = below
 * median, positive = above, null = no median) for discount-desc sorting.
 */
export function getLevelPct(cardPrice, stats, signed = false) {
  const median = stats?.medianPrice;
  if (!cardPrice || !median || cardPrice <= 0 || median <= 0) return signed ? null : 0;
  if (signed) return Math.round(((cardPrice - median) / median) * 100);
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
 * Single heat driver (ADR-0005: badge shows the blend, heat/sort follow it).
 * One computation feeds BOTH the card heat and the badge number, so the
 * ribbon number always matches its color. Returns
 * { value, provisional, pct, kind }:
 * - verified deal   -> blend % the badge shows (weight-blended Ø-discount +
 *                      record-margin at the slider mix), null inside the ±5%
 *                      deadband (number still prints, card stays gray)
 * - verified markup -> null (no deal, no color — the +XX% badge text
 *                      carries the markup signal)
 * - verified but unqualified (thin/flat history, no dealData) -> null
 * - unverified deal -> site Differenz, flagged provisional (striped-gray via tp-is-unverified, never heated)
 * - unverified markup / unknown -> null (neutral)
 * Callers pass the mode positionally so the heat reuses the exact mode of the
 * badge branch (no parallel formulas). The optional 5th parameter takes an
 * already-computed dealScore (undefined = not provided, compute inside;
 * null = computed-unqualified, never recompute).
 */
export function getHeatInput(cardPrice, stats, siteDiff, mode, precomputed = undefined) {
  const verified = !!stats && stats.tiefstpreis > 0 && cardPrice > 0;
  if (verified) {
    const display = getDisplayDelta(cardPrice, stats);
    if (display.kind !== 'new-low' && display.kind !== 'at-low') {
      return { value: null, provisional: false, pct: 0, kind: 'markup' };
    }
    const weight = typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number' ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50;
    const levelRaw = (stats && stats.medianPrice > 0 && cardPrice > 0 && stats.medianPrice > cardPrice)
      ? ((stats.medianPrice - cardPrice) / stats.medianPrice) * 100 : 0;
    const recordRaw = (display && typeof display.dRecordRaw === 'number')
      ? display.dRecordRaw : (display.dRecord || 0);
    const dealData = precomputed === undefined ? computeDealScore(stats, cardPrice) : precomputed;
    // Unqualified history: no blend to show — heat stays neutral to match.
    if (!dealData) return { value: null, provisional: false, pct: 0, kind: 'none' };
    const pct = dealData.weightedDiff;
    // ±5% deadband (documented noise guard): a tiny blend shows in the
    // badge text but stays gray on the card — decided on the raw blend.
    const rawBlend = (1 - weight) * levelRaw + weight * recordRaw;
    if (!(rawBlend >= HEAT_NEUTRAL_DEADBAND_PCT)) return { value: null, provisional: false, pct, kind: 'blend' };
    return { value: -pct, provisional: false, pct, kind: 'blend' };
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
