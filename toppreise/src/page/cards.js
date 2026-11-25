/**
 * Page & Card Extraction Layer
 * Manages card discovery, ID extraction, DOM query memoization,
 * discount extraction and heatmap styling.
 */

import { SELECTORS } from './selectors.js';
import { CONFIG, clampIntensity01 } from '../state/config.js';
import { extractCanonicalPrice, pctRise, priceToCents, recordRefForPrice, computeSavingsChf } from '../domain/price.js';
import { computeDealScore, getDisplayDelta, vortiefDropPct } from '../domain/deal-score.js';
import { getCachedPriceStats, hasUsablePriceStats } from '../scanner/cache.js';

const normalizeName = name => name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

export function getCardDealerRows(card) {
  if (!card._tpDealerRows) {
    card._tpDealerRows = Array.from(card.querySelectorAll(SELECTORS.cards.dealerRows)).map(row => ({
      row,
      storeName: normalizeName(row.querySelector('.title')?.textContent || '')
    }));
  }
  return card._tpDealerRows;
}

export function getDistinctProductIds(el) {
  if (!el || !el.querySelectorAll) return [];
  const ids = new Set();
  const links = [el.tagName?.toLowerCase() === 'a' ? el : null, ...Array.from(el.querySelectorAll('a[href]'))].filter(Boolean);
  for (const a of links) {
    const href = a.getAttribute('href') || a.href || '';
    const m = href.match(/-p(\d+)(?:[/?#]|$)/i);
    if (m) ids.add(m[1]);
  }
  return Array.from(ids);
}

export function getProductCards(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root || !root.querySelectorAll) return [];
  const bodyEl = root.body || (root.ownerDocument ? root.ownerDocument.body : root);
  const rawCards = Array.from(root.querySelectorAll(SELECTORS.cards.standard));
  const standardCards = rawCards.filter(c => {
    if (c.closest(SELECTORS.cards.excludedParents)) return false;
    if (c.closest(SELECTORS.cards.hiddenStyles)) return false;
    if (getDistinctProductIds(c).length > 1) return false;
    return true;
  });
  if (standardCards.length > 0) {
    const leafCards = standardCards.filter(c => !c.querySelector(SELECTORS.cards.nestedCards));
    if (leafCards.length > 0) return leafCards;
  }

  const gridCards = new Set();
  root.querySelectorAll(SELECTORS.cards.productLinks).forEach(link => {
    if (link.closest(SELECTORS.cards.excludedParents)) return;
    let container = link.parentElement;
    while (container && container !== bodyEl && container.parentElement !== bodyEl) {
      if (container.matches && container.matches('.tab-content, .tab-pane, #FrameContent, .standardList, #product-list, main, section')) {
        break;
      }
      if (getDistinctProductIds(container).length > 1) {
        break;
      }
      if (container.querySelector(SELECTORS.price.genericPriceMatch) || container.querySelector(SELECTORS.price.genericDiffMatch)) {
        gridCards.add(container);
        break;
      }
      container = container.parentElement;
    }
  });
  return Array.from(gridCards);
}


export function extractOfferCount(card) {
  if (card.dataset?.tpOfferCount) return parseInt(card.dataset.tpOfferCount, 10);
  const count = parseInt(card.textContent.match(/(\d+)\s*(?:Angebote?|offres?|offert[ae]|offers?)/i)?.[1] || card.querySelectorAll('.Plugin_DealerRelProdPriceInfo').length, 10);
  if (card.dataset) card.dataset.tpOfferCount = String(count);
  return count;
}

export function getCardProductId(card) {
  if (!card) return null;
  if (card.dataset?.entityId) return card.dataset.entityId;
  if (card.dataset?.tpProductId) return card.dataset.tpProductId;

  const linkEls = [card.tagName?.toLowerCase() === 'a' ? card : null, card.closest?.('a[href]'), ...(card.querySelectorAll ? card.querySelectorAll('a[href]') : [])];
  const hrefs = Array.from(new Set(linkEls.filter(el => el && !el.closest('header, nav, footer, .breadcrumb, #tp-suite-filter-bar')).map(el => el.getAttribute('href') || el.href || ''))).filter(Boolean);
  for (const href of hrefs) {
    const match = href.match(/-p(\d+)(?:[/?#]|$)/i);
    if (match && match[1]) {
      if (card.dataset) card.dataset.tpProductId = match[1];
      return match[1];
    }
  }
  return null;
}

export function extractCardDiff(card) {
  if (card.dataset?.tpDiff !== undefined && card.dataset.tpDiff !== '') {
    const cached = parseFloat(card.dataset.tpDiff);
    return isNaN(cached) ? null : (cached === 0 ? 0 : cached);
  }
  const badgeEl = card.querySelector('.badge-dif:not(.tp-injected-badge), .badge:not(.tp-injected-badge), [class*="badge-dif"]:not(.tp-injected-badge)');
  // Never parse script-painted ribbon text as the site Differenz: after a
  // cache clear the badge still shows our verdict, not the host number.
  // Fall back to the pid-keyed snapshot (tpOriginalDiscount stores the site
  // discount, i.e. -diff) so counting/filtering keep the host number.
  if (badgeEl?.dataset?.tpPainted === 'true') {
    // Host update detection: changed badge text with a live host % voids the
    // snapshot (same pid or not) so counting/filtering re-read the host
    // number below. Paint site stamps tpPaintedText on every script write.
    if (badgeEl.dataset.tpPaintedText !== undefined && badgeEl.textContent !== badgeEl.dataset.tpPaintedText) {
      const hostMatch = badgeEl.textContent.match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);
      if (hostMatch) {
        delete badgeEl.dataset.tpPainted;
        delete badgeEl.dataset.tpOriginalDiscount;
        delete badgeEl.dataset.tpOriginalPid;
        delete badgeEl.dataset.tpPaintedText;
        if (card.dataset) delete card.dataset.tpDiff;
      }
    }
    if (badgeEl.dataset.tpPainted === 'true') {
      const snap = badgeEl.dataset.tpOriginalDiscount;
      const snapPid = badgeEl.dataset.tpOriginalPid ?? '';
      if (snap !== undefined && snap !== '' && snapPid === (getCardProductId(card) ?? '')) {
        const discount = parseFloat(snap);
        if (!isNaN(discount)) return discount === 0 ? 0 : -discount;
      }
      return null;
    }
    /* snapshot voided: fall through to host parse below */
  }
  // Never parse our own injected badge text as the site Differenz, and never
  // fall back to full card.textContent (specs like "40% Vol." or "99% sRGB"
  // would become phantom discounts).
  if (!badgeEl) {
    if (card.dataset) card.dataset.tpDiff = '';
    return null;
  }
  const text = badgeEl.textContent || '';
  const match = text.match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);
  if (match) {
    let val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val)) {
      if (card.dataset) {
        card.dataset.tpDiff = val;
      }
      return val;
    }
  }
  if (card.dataset) {
    card.dataset.tpDiff = '';
  }
  return null;
}

export function extractCardDiscount(card) {
  const diff = extractCardDiff(card);
  return diff === null ? null : (diff === 0 ? 0 : -diff);
}

// Deal-Intensität ramp: warm amber (-1% entry discount) -> coral/vermilion
// (-40% mid discount) -> deep ruby/red (-100% max savings).
// Markups and 0% deals return null (transparent / no heat effect).
const HEAT_STOPS = [
  { t: 0.00, base: [65, 38, 10],   acc: [180, 83, 9],    border: [245, 158, 11, 0.75] }, // Warm Amber (-1%)
  { t: 0.40, base: [85, 28, 14],   acc: [200, 50, 15],   border: [234, 88, 12, 0.85] },  // Coral / Vermilion (-40%)
  { t: 1.00, base: [110, 15, 35],  acc: [215, 25, 55],   border: [244, 63, 94, 0.95] }   // Blazing Ruby/Red (-100%)
];

function heatRamp(t) {
  const clampedT = Math.max(0, Math.min(1, t));
  let i = HEAT_STOPS.findIndex((s, idx) => idx < HEAT_STOPS.length - 1 && clampedT >= s.t && clampedT <= HEAT_STOPS[idx + 1].t);
  if (i < 0) i = HEAT_STOPS.length - 2;
  const s0 = HEAT_STOPS[i], s1 = HEAT_STOPS[i + 1], factor = (clampedT - s0.t) / (s1.t - s0.t || 1);
  const lerp = (a, b) => Math.round(a + (b - a) * factor);
  return {
    base: [lerp(s0.base[0], s1.base[0]), lerp(s0.base[1], s1.base[1]), lerp(s0.base[2], s1.base[2])],
    acc: [lerp(s0.acc[0], s1.acc[0]), lerp(s0.acc[1], s1.acc[1]), lerp(s0.acc[2], s1.acc[2])],
    borderRgb: [lerp(s0.border[0], s1.border[0]), lerp(s0.border[1], s1.border[1]), lerp(s0.border[2], s1.border[2])],
    borderAlpha: (s0.border[3] + (s1.border[3] - s0.border[3]) * factor)
  };
}

// 0% (or any markup) -> 0, -100% -> 1. NaN -> null.
function heatT(diffPercent) {
  const diff = typeof diffPercent === 'number' ? diffPercent : parseFloat(diffPercent);
  if (isNaN(diff)) return null;
  return Math.max(0, Math.min(1, -Math.min(0, Math.max(-100, diff)) / 100));
}

const heatColor = (diff, intensity) => {
  const t = heatT(diff);
  if (t === null) return null;
  return { t, ...heatRamp(t), safeInt: clampIntensity01(intensity) };
};

// Regular (verified blend) signal: prominent INSET wash, no background fill,
// no border. Inset (never outer): an outer box-shadow paints past the border
// box and bleeds onto neighboring cards — inset clips at the card's own edge
// by construction, no per-layout tuning.
// Non-discounts (dropPct <= 0) return null (transparent / no heat).
export function getInsetHeatStyle(dropPct, intensity = 1.0) {
  const d = typeof dropPct === 'number' ? dropPct : parseFloat(dropPct);
  if (isNaN(d) || d <= 0) return null;
  const c = heatColor(-Math.abs(d), intensity);
  if (!c) return null;
  const { acc, safeInt, t } = c;
  const alpha = (0.18 + 0.42 * t) * safeInt;
  return {
    glow: `inset 0 0 30px 10px rgba(${acc.join(',')},${alpha.toFixed(2)})`,
    color: `rgb(${acc.join(',')})`
  };
}

// Badge reuses the card logic: solid swatch from the same ramp so the badge
// color always matches the card heat. Non-discounts (diffPercent >= 0)
// return null so badges remain transparent/colorless.
export function getBadgeHeatStyle(diffPercent, provisional = false, intensity = 1.0) {
  const d = typeof diffPercent === 'number' ? diffPercent : parseFloat(diffPercent);
  if (isNaN(d) || d >= 0) return null;
  const c = heatColor(d, intensity);
  if (!c) return null;
  const { acc, borderRgb, borderAlpha, safeInt } = c;
  const alpha = (provisional ? 0.55 : 0.95) * safeInt;
  return {
    background: `rgba(${acc.join(',')},${alpha.toFixed(2)})`,
    border: `rgba(${borderRgb.join(',')},${(borderAlpha * safeInt).toFixed(2)})`
  };
}

export function extractActiveStores() {
  const filterElements = document.querySelectorAll(SELECTORS.layout.activeStoreFilters);
  return Array.from(filterElements).map(el => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.icon-close, .f_remove_icon, .close, span').forEach(i => i.remove());
    return normalizeName(clone.textContent);
  }).filter(name => name.length > 0);
}

// Basis gate rule (single source): a product-only live price must never score
// against shipping-inclusive history (or vice versa). Legacy cache entries
// without the boolean flag pass through; mismatches render unverified.
export const basisMatchesFor = (stats, cardPriceBasis) =>
  typeof stats?.isShippingPrice !== 'boolean'
  || stats.isShippingPrice === (cardPriceBasis === 'shipping');
// Single scan-eligibility resolver (counter + scanner queue share it):
export function getCardStats(pid, cardBasis, allowCrossBasis = false) {
  if (!pid) return null;
  const specific = getCachedPriceStats(pid, false, null, cardBasis === 'shipping');
  if (specific) return specific;
  const fallback = getCachedPriceStats(pid, false, null, cardBasis !== 'shipping');
  if (!fallback || fallback.unavailable) return null;
  if (typeof fallback.isShippingPrice !== 'boolean' || allowCrossBasis) {
    return fallback;
  }
  return null;
}

// usable stats verify, fresh unavailable markers wait out the negative TTL,
// basis mismatches refetch (no new state), everything else is unchecked.
export function scanEligibility(card, pre = null) {
  const pid = pre?.pid ?? getCardProductId(card);
  if (!pid) return { state: 'verified', canScan: false, retryAt: null, reason: 'no-pid' };
  const hasPrePrice = pre && 'cardPrice' in pre && 'cardPriceBasis' in pre;
  const { price: cardPrice, basis: cardBasis } = hasPrePrice
    ? { price: pre.cardPrice, basis: pre.cardPriceBasis }
    : extractCanonicalPrice(card);
  if (!(cardPrice > 0) || !cardBasis) {
    return { state: 'verified', canScan: false, retryAt: null, reason: 'no-price' };
  }
  const preStats = pre?.stats;
  if (preStats && !preStats.unavailable && basisMatchesFor(preStats, cardBasis) && hasUsablePriceStats(preStats)) {
    return { state: 'verified', canScan: false, retryAt: null, reason: null };
  }
  if (preStats && preStats.unavailable && basisMatchesFor(preStats, cardBasis)) {
    return { state: 'unavailable', canScan: false, retryAt: (preStats.time || Date.now()) + (CONFIG.NEGATIVE_CACHE_HOURS || 2) * 3600 * 1000, reason: 'negative-cache' };
  }
  const stats = getCardStats(pid, cardBasis, true);
  if (stats && !basisMatchesFor(stats, cardBasis)) {
    return { state: 'basis-mismatch', canScan: true, retryAt: null, reason: 'basis-mismatch' };
  }
  if (stats && stats.unavailable) {
    return { state: 'unavailable', canScan: false, retryAt: (stats.time || Date.now()) + (CONFIG.NEGATIVE_CACHE_HOURS || 2) * 3600 * 1000, reason: 'negative-cache' };
  }
  if (hasUsablePriceStats(stats)) return { state: 'verified', canScan: false, retryAt: null, reason: null };
  return { state: 'unchecked', canScan: true, retryAt: null, reason: null };
}
export function extractCardData(card) {
  const pid = getCardProductId(card);
  const priceData = extractCanonicalPrice(card);
  const cardPriceEl = priceData.el;
  const cardPrice = priceData.price;
  const cardPriceBasis = priceData.basis;
  const stats = getCardStats(pid, cardPriceBasis);
  const diffVal = extractCardDiff(card);
  const discountVal = extractCardDiscount(card);
  const basisMatches = basisMatchesFor(stats, cardPriceBasis);
  const dealScore = (basisMatches && hasUsablePriceStats(stats) && cardPrice > 0) ? computeDealScore(stats, cardPrice) : null;
  // Display delta never gates on history quality: with just {tiefstpreis} +
  // card price the badge/heat still tell the verified truth.
  const displayDelta = basisMatches ? getDisplayDelta(cardPrice, stats) : { kind: 'unknown' };
  const offerCount = extractOfferCount(card);
  const effDiscount = getCardEffectiveDiscount({
    basisMatches,
    verifiedStats: basisMatches ? stats : null,
    stats,
    cardPriceBasis,
    dealScore,
    displayDelta,
    discountVal,
    diffVal,
    cardPrice
  });
  const savingsChf = computeSavingsChf(cardPrice, effDiscount);

  return {
    card,
    pid,
    cardPriceEl,
    cardPrice,
    cardPriceBasis,
    basisMatches,
    stats,
    verifiedStats: basisMatches ? stats : null,
    diffVal,
    discountVal,
    dealScore,
    displayDelta,
    offerCount,
    effDiscount,
    savingsChf
  };
}

export function getCardEffectiveDiscount(cd) {
  if (!cd) return 0;
  if (typeof cd.effDiscount === 'number') return cd.effDiscount;
  const sortBasisOk = cd.basisMatches ?? basisMatchesFor(cd.stats, cd.cardPriceBasis);
  const vStats = cd.verifiedStats ?? (sortBasisOk ? cd.stats : null);
  const dealData = (cd.dealScore === undefined && vStats && cd.cardPrice > 0) ? computeDealScore(vStats, cd.cardPrice) : (cd.dealScore ?? null);
  if (dealData) return dealData.weightedDiff;
  if (hasUsablePriceStats(vStats)) {
    const displayDelta = cd.displayDelta ?? (vStats ? getDisplayDelta(cd.cardPrice, vStats) : null);
    if (displayDelta?.kind === 'at-low' || displayDelta?.kind === 'new-low') {
      const dropVsPrev = vortiefDropPct(cd.cardPrice, vStats);
      const prevLowNow = recordRefForPrice(vStats, cd.cardPrice)?.previousLow;
      const hasPrevLowBase = prevLowNow && priceToCents(prevLowNow) > priceToCents(cd.cardPrice);
      if (dropVsPrev > 0 && hasPrevLowBase) return dropVsPrev;
      const rawDisc = cd.discountVal ?? (typeof cd.diffVal === 'number' && cd.diffVal < 0 ? -cd.diffVal : 0);
      return rawDisc > 0 ? rawDisc : 0;
    }
    const markup = displayDelta?.markup ?? (vStats?.tiefstpreis ? pctRise(vStats.tiefstpreis, cd.cardPrice) : 0);
    return -Math.max(0, markup || 0);
  }
  const rawDisc = cd.discountVal ?? (typeof cd.diffVal === 'number' && cd.diffVal < 0 ? -cd.diffVal : 0);
  return rawDisc || 0;
}
