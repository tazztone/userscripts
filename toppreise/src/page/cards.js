/**
 * Page & Card Extraction Layer
 * Manages card discovery, ID extraction, DOM query memoization,
 * discount extraction and heatmap styling.
 */

import { SELECTORS } from './selectors.js';
import { CONFIG, clampIntensity01 } from '../state/config.js';
import { extractCanonicalPrice, parsePrice } from '../domain/price.js';
import { computeDealScore, getDisplayDelta } from '../domain/deal-score.js';
import { getCachedPriceStats } from '../scanner/cache.js';
import { isShippingPriceActive } from './adapter.js';

export const normalizeName = name => name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

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
    const m = href.match(/-p(\d+)/i);
    if (m) ids.add(m[1]);
  }
  return Array.from(ids);
}

export function getProductCards() {
  const rawCards = Array.from(document.querySelectorAll(SELECTORS.cards.standard));
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
  document.querySelectorAll(SELECTORS.cards.productLinks).forEach(link => {
    if (link.closest(SELECTORS.cards.excludedParents)) return;
    let container = link.parentElement;
    while (container && container !== document.body && container.parentElement !== document.body) {
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
  const count = parseInt(card.textContent.match(/(\d+)\s*(?:Angebote|Angebot)/i)?.[1] || card.querySelectorAll('.Plugin_DealerRelProdPriceInfo').length, 10);
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
    const match = href.match(/-p(\d+)/i);
    if (match && match[1]) {
      if (card.dataset) card.dataset.tpProductId = match[1];
      return match[1];
    }
  }
  return null;
}

export function matchesNegativeTerms(card, termsList) {
  if (!termsList || termsList.length === 0) return false;
  let text = card._tpTextLower;
  if (text === undefined) {
    text = (card.textContent || '').toLowerCase();
    card._tpTextLower = text;
  }
  return termsList.some(term => {
    if (!term) return false;
    if (term.length <= 3) {
      return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
    }
    return text.includes(term);
  });
}

export function extractCardDiff(card) {
  if (card.dataset?.tpDiff !== undefined && card.dataset.tpDiff !== '') {
    const cached = parseFloat(card.dataset.tpDiff);
    return isNaN(cached) ? null : (cached === 0 ? 0 : cached);
  }
  const badgeEl = card.querySelector('.badge-dif:not(.tp-injected-badge), .badge:not(.tp-injected-badge), [class*="badge-dif"]:not(.tp-injected-badge)');
  // Never parse our own injected badge text as the site Differenz: when only
  // our badge exists there is no unverified site number to read.
  const text = badgeEl ? badgeEl.textContent
    : (card.querySelector?.('.tp-injected-badge') ? '' : (card.textContent || ''));
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

// Single-hue deal ramp: neutral slate (0% = no deal) -> warm amber -> deep ruby
// (-100% = max savings). Markups render no color (neutral gray card); the
// badge TEXT (+XX%) carries the markup signal instead.
const HEAT_STOPS = [
  { t: 0.00, base: [24, 32, 44],   acc: [45, 58, 76],    border: [71, 85, 105, 0.50] },
  { t: 0.50, base: [75, 42, 12],   acc: [215, 85, 18],   border: [251, 115, 36, 0.88] },
  { t: 1.00, base: [98, 14, 32],   acc: [238, 25, 65],   border: [244, 63, 94, 0.95] }
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

export function getHeatmapStyles(diffPercent, intensity = 1.0) {
  const c = heatColor(diffPercent, intensity);
  if (!c) return null;
  const { t, base, acc, borderRgb, borderAlpha, safeInt } = c;
  const bg = `linear-gradient(135deg, rgba(${base.join(',')},${(0.92 + 0.04 * t).toFixed(2)}) 0%, rgba(${acc.join(',')},${((0.75 + 0.20 * t) * safeInt).toFixed(2)}) 100%)`;
  const border = `rgba(${borderRgb.join(',')},${(borderAlpha * safeInt).toFixed(2)})`;
  const glow = t >= 0.55 ? `0 4px 18px rgba(${acc.join(',')},${(0.32 * safeInt).toFixed(2)})` : 'none';
  return { bg, border, glow };
}
// Feathered INNER-edge variant for Vortief heat (mode only): NO background
// fill — the card keeps the site background. Same ramp hue, but the signal
// lives in an inset glow + tinted border, so a fallback low can never pass
// as a blended deal at a glance. Inset (never outer): an outer box-shadow
// paints past the border box and bleeds onto neighboring cards — inset
// clips at the card's own edge by construction, no per-layout tuning.
export function getEdgeHeatStyle(dropPct, intensity = 1.0) {
  const c = heatColor(-Math.abs(dropPct), intensity);
  if (!c) return null;
  const { acc, borderRgb, borderAlpha, safeInt } = c;
  return {
    border: `rgba(${borderRgb.join(',')},${(borderAlpha * safeInt).toFixed(2)})`,
    glow: `inset 0 0 30px 10px rgba(${acc.join(',')},${(0.50 * safeInt).toFixed(2)})`
  };
}

// Badge reuses the card logic: solid swatch from the same ramp so the badge
// color always matches the card heat. The provisional flag still yields paler
// output, but callers now skip heat for unverified cards (tp-is-unverified
// paints them striped-gray instead). At full intensity verified output is
// identical to the legacy fixed alphas.
export function getBadgeHeatStyle(diffPercent, provisional = false, intensity = 1.0) {
  const c = heatColor(diffPercent, intensity);
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

export function parseNegativeTerms(rawTerms = CONFIG.NEGATIVE_TERMS || '') {
  return (rawTerms || '').split(/[,;\n]/).map(t => t.trim().toLowerCase()).filter(Boolean);
}

export function extractCardData(card) {
  const pid = getCardProductId(card);
  const priceData = extractCanonicalPrice(card);
  const cardPriceEl = priceData.el;
  const cardPrice = priceData.price;
  const stats = pid ? getCachedPriceStats(pid) : null;
  const diffVal = extractCardDiff(card);
  const discountVal = extractCardDiscount(card);
  const dealScore = (stats && cardPrice > 0) ? computeDealScore(stats, cardPrice) : null;
  // Display delta never gates on history quality: with just {tiefstpreis} +
  // card price the badge/heat still tell the verified truth.
  const displayDelta = getDisplayDelta(cardPrice, stats);
  const offerCount = extractOfferCount(card);

  return {
    card,
    pid,
    cardPriceEl,
    cardPrice,
    stats,
    diffVal,
    discountVal,
    dealScore,
    displayDelta,
    offerCount
  };
}

export function applyCardFilters(cd, termsList, minOffers, pageHasOffers) {
  const isNeg = CONFIG.FILTER_NEG_ENABLED ? matchesNegativeTerms(cd.card, termsList) : false;
  const isLowOffers = CONFIG.FILTER_MIN_ENABLED ? !!(pageHasOffers && minOffers > 0 && cd.offerCount < minOffers) : false;
  // "Bad deal" in the mode is a VERIFIED markup only. A verified low without
  // blend (at-low/new-low, thin history) stays visible with Vortief edge
  // heat unless Fallback-Tiefs are excluded — then it follows Anzeige like
  // any bad deal. Unknown kind (no displayDelta on this path, e.g. scanner
  // targets) keeps the old strictness so the scanner can't waste passes on junk.
  const kind = cd.displayDelta?.kind;
  const isVortief = !cd.dealScore && (kind === 'at-low' || kind === 'new-low');
  const vortiefExcluded = CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && isVortief;
  const isBadDeal = CONFIG.BESTPREISE_MODE_ACTIVE === true && !!cd.stats && !cd.dealScore && (vortiefExcluded || (kind !== 'at-low' && kind !== 'new-low'));
  const isUnchecked = CONFIG.BESTPREISE_HIDE_UNCHECKED === true && !cd.stats;
  const isDealerLoser = false;
  const isFiltered = isNeg || isLowOffers || isDealerLoser || isBadDeal || isUnchecked;
  return { isNeg, isLowOffers, isBadDeal, isUnchecked, isDealerLoser, isFiltered };
}

export function dealerLoserFor(card, activeStores, isNeueFeed) {
  if (!activeStores || activeStores.length === 0) return false;
  const dealerRows = getCardDealerRows(card);
  if (dealerRows.length === 0) return false;
  let matchedRow = null;
  for (let d = 0; d < dealerRows.length; d++) {
    const item = dealerRows[d];
    if (item.storeName && activeStores.some(store => item.storeName.includes(store) || store.includes(item.storeName))) {
      matchedRow = item.row;
      break;
    }
  }
  if (!matchedRow) return true;
  const priceData = extractCanonicalPrice(card);
  const useShipping = isShippingPriceActive(card);
  const storePriceEl = useShipping
    ? (matchedRow.querySelector('.shippingPrice .Plugin_Price') || matchedRow.querySelector('.productPrice .Plugin_Price'))
    : (matchedRow.querySelector('.productPrice .Plugin_Price') || matchedRow.querySelector('.shippingPrice .Plugin_Price'));
  const storePrice = storePriceEl ? parsePrice(storePriceEl.textContent) : 0;
  const bestPrice = priceData.price > 0 ? priceData.price : (priceData.el ? parsePrice(priceData.el.textContent) : 0);
  if (storePrice > 0 && bestPrice > 0 && storePrice <= bestPrice * (1 + CONFIG.MARGIN_PERCENT / 100)) return false;
  return true;
}

export function isCardFilteredOut(card, filters = null, opts = null) {
  if (!card) return true;
  // "Nur geprüfte" is cause-marker-only here: unchecked cards carry
  // tp-filtered + tp-unchecked-hidden and Anzeige decides display;
  // scans + counters opt in via includeHiddenUnchecked below.
  const includeHiddenUnchecked = opts?.includeHiddenUnchecked === true
    && card.classList?.contains('tp-unchecked-hidden') === true;
  const causeHit = f => f.isNeg || f.isLowOffers || f.isDealerLoser || f.isBadDeal
  // Display collapses only in Anzeige=hide outside tp-reveal-all.
  const displayHidden = f => (CONFIG.MODE === 'hide')
    && document.body?.classList?.contains('tp-reveal-all') !== true;
  const legacyChecks = () => {
    const tab = card.closest?.('.f_tab');
    if (tab && !tab.classList.contains('selected')) return true;
    if (!includeHiddenUnchecked) {
      if (card.hidden || card.classList?.contains('d-none') || card.closest?.('.d-none')) return true;
      if (typeof card.checkVisibility === 'function') {
        if (!card.checkVisibility()) return true;
      } else if (card.offsetParent === null && window.getComputedStyle?.(card)?.display === 'none') {
        return true;
      }
    }
    return false;
  };
  if (filters) {
    if (!causeHit(filters)) return legacyChecks();
    // Cause-based path: scanner and counters ignore MODE/reveal.
    if (opts?.includeHiddenUnchecked === true) return true;
    return displayHidden(filters);
  }
  const f = {
    isNeg: card.classList?.contains('tp-negative-filtered') === true,
    isLowOffers: card.classList?.contains('tp-min-offers-filtered') === true,
    isBadDeal: card.classList?.contains('tp-baddeal-hidden') === true,
    isUnchecked: card.classList?.contains('tp-unchecked-hidden') === true,
    isDealerLoser: card.classList?.contains('tp-not-cheapest') === true
      || card.classList?.contains('tp-no-store-offer') === true,
  };
  // ponytail: no page context here; callers with a card list must pass
  // explicit filters built with the real pageHasOffers (feed cards have
  // no offer counts, so assuming true wrongly filters the whole feed).
  const termsList = parseNegativeTerms();
  const offerCount = extractOfferCount(card);
  const pageHasOffers = offerCount > 0 || document.querySelector('.Plugin_DealerRelProdPriceInfo') !== null;
  const recomp = applyCardFilters({ card, offerCount }, termsList, CONFIG.MIN_OFFERS, pageHasOffers);
  f.isNeg = f.isNeg || recomp.isNeg;
  f.isLowOffers = f.isLowOffers || recomp.isLowOffers;
  if (!causeHit(f)) return legacyChecks();
  if (opts?.includeHiddenUnchecked === true) return true;
  return displayHidden(f);
}

