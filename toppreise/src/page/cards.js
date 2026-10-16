/**
 * Page & Card Extraction Layer
 * Manages card discovery, ID extraction, DOM query memoization,
 * discount extraction and heatmap styling.
 */

import { SELECTORS } from './selectors.js';
import { CONFIG, clampIntensity01 } from '../state/config.js';
import { extractCanonicalPrice, parsePrice } from '../domain/price.js';
import { computeDealScore, getDisplayDelta } from '../domain/deal-score.js';
import { getCachedPriceStats, hasUsablePriceStats } from '../scanner/cache.js';
import { isShippingPriceActive } from './adapter.js';

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
    const match = href.match(/-p(\d+)/i);
    if (match && match[1]) {
      if (card.dataset) card.dataset.tpProductId = match[1];
      return match[1];
    }
  }
  return null;
}

const _negReCache = new Map();
export function matchesNegativeTerms(card, termsList) {
  if (!termsList || termsList.length === 0) return false;
  let text = card._tpTextLower;
  if (text === undefined) {
    const nodes = card.querySelectorAll?.('.bold, .product-name, .productDetails, .Plugin_ProductHeading');
    const joined = [...(nodes ?? [])].map(el => el.textContent).join(' ');
    if (joined.trim()) text = joined.toLowerCase();
    else {
      const single = card.querySelector?.('.bold, .product-name, .productDetails, .Plugin_ProductHeading');
      if (single?.textContent?.trim()) text = single.textContent.toLowerCase();
      else if (typeof card.cloneNode === 'function') {
        const clone = card.cloneNode(true);
        clone.querySelectorAll?.('.tp-injected-badge, .tp-share-btn, .tp-dealer-name, .tp-best-price-badge, [class*="tp-"]').forEach(el => el.remove());
        text = (clone.textContent || '').toLowerCase();
      } else {
        text = (card.textContent || '').toLowerCase();
      }
    }
    card._tpTextLower = text;
  }
  return termsList.some(entry => {
    if (!entry) return false;
    const re = typeof entry === 'string' ? null : entry.re;
    if (re) return re.test(text);
    const term = typeof entry === 'string' ? entry : entry.term;
    if (!term) return false;
    if (term.length <= 3) {
      let shortRe = _negReCache.get(term);
      if (!shortRe) {
        shortRe = new RegExp(`(?<![\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');
        _negReCache.set(term, shortRe);
      }
      return shortRe.test(text);
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
  { t: 0.50, base: [75, 42, 12],   acc: [170, 62, 10],   border: [251, 115, 36, 0.88] },
  { t: 1.00, base: [98, 14, 32],   acc: [210, 20, 55],   border: [244, 63, 94, 0.95] }
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
export function getInsetHeatStyle(dropPct, intensity = 1.0) {
  const c = heatColor(-Math.abs(dropPct), intensity);
  if (!c) return null;
  const { acc, safeInt } = c;
  return {
    glow: `inset 0 0 30px 10px rgba(${acc.join(',')},${(0.50 * safeInt).toFixed(2)})`,
    color: `rgb(${acc.join(',')})`
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

let _negCacheRaw = null;
let _negCacheParsed = null;
export function parseNegativeTerms(rawTerms = CONFIG.NEGATIVE_TERMS || '') {
  if (rawTerms === _negCacheRaw && _negCacheParsed) return _negCacheParsed;
  const parsed = (rawTerms || '').split(/[,;\n]/).map(t => t.trim().toLowerCase()).filter(Boolean)
    .map(term => ({ term, re: term.length <= 3 ? new RegExp(`(?<![\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu') : null }));
  _negCacheRaw = rawTerms;
  _negCacheParsed = parsed;
  return parsed;
}
// Basis gate rule (single source): a product-only live price must never score
// against shipping-inclusive history (or vice versa). Legacy cache entries
// without the boolean flag pass through; mismatches render unverified.
export const basisMatchesFor = (stats, cardPriceBasis) =>
  typeof stats?.isShippingPrice !== 'boolean'
  || stats.isShippingPrice === (cardPriceBasis === 'shipping');
// Single scan-eligibility resolver (counter + scanner queue share it):
export function getCardStats(pid, cardBasis) {
  if (!pid) return null;
  const specific = getCachedPriceStats(pid, false, null, cardBasis === 'shipping');
  if (specific) return specific;
  const fallback = getCachedPriceStats(pid);
  if (!fallback) return null;
  if (!fallback.unavailable) return fallback;
  return basisMatchesFor(fallback, cardBasis) ? fallback : null;
}

// usable stats verify, fresh unavailable markers wait out the negative TTL,
// basis mismatches refetch (no new state), everything else is unchecked.
export function scanEligibility(card) {
  const pid = getCardProductId(card);
  if (!pid) return { state: 'verified', canScan: false, retryAt: null, reason: 'no-pid' };
  const cardBasis = extractCanonicalPrice(card).basis;
  const stats = getCardStats(pid, cardBasis);
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
    offerCount
  };
}

export function applyCardFilters(cd, termsList, minOffers, pageHasOffers, isDealFeed = true) {
   const isNeg = CONFIG.FILTER_NEG_ENABLED ? matchesNegativeTerms(cd.card, termsList) : false;
   const isLowOffers = CONFIG.FILTER_MIN_ENABLED ? !!(pageHasOffers && minOffers > 0 && cd.offerCount < minOffers) : false;
  // Removal causes are Negativ, Min-Angebote, Händler (set downstream),
  // Ungeprüfte, Fallback-ausgeschlossen. Verified markups are removed nowhere.
  // Ungeprüfte is config-only: it must not depend on scan state, otherwise the
  // first check on a checkless page hides everything as a side effect.
  // Fallback exclusion is deal-feed-only: the toolbar row (the only control)
  // renders solely there, so browse pages must never dim/hide with no switch.
   const kind = cd.displayDelta?.kind;
   const isVortief = !cd.dealScore && (kind === 'at-low' || kind === 'new-low');
   const isVortiefExcluded = isDealFeed && CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && isVortief;
  const isUnchecked = isDealFeed && CONFIG.BESTPREISE_HIDE_UNCHECKED === true && !hasUsablePriceStats(cd.verifiedStats !== undefined ? cd.verifiedStats : cd.stats);
  const isDealerLoser = false;
  return { isNeg, isLowOffers, isVortiefExcluded, isUnchecked, isDealerLoser };
}
export function dealerLoserFor(card, activeStores) {
  if (!activeStores || activeStores.length === 0) return false;
  const dealerRows = getCardDealerRows(card);
  if (dealerRows.length === 0) return false;
  const matchedRows = dealerRows
    .filter(item => item.storeName && activeStores.some(store => item.storeName.includes(store) || store.includes(item.storeName)))
    .map(item => item.row);
  if (matchedRows.length === 0) return true;
  const priceData = extractCanonicalPrice(card);
  const useShipping = isShippingPriceActive(card);
  const bestPrice = priceData.price > 0 ? priceData.price : (priceData.el ? parsePrice(priceData.el.textContent) : 0);
  const limit = bestPrice * (1 + CONFIG.MARGIN_PERCENT / 100);
  // Any qualifying selected dealer keeps the card: rows are evaluated in
  // DOM order but the verdict must not depend on it.
  for (const row of matchedRows) {
    // Rows carry a single offer price (host marks it .productPrice even in
    // shipping mode): prefer the active basis but fall back — a missing
    // wrapper must not disqualify every selected dealer.
    const storePriceEl = useShipping
      ? (row.querySelector('.shippingPrice .Plugin_Price') || row.querySelector('.productPrice .Plugin_Price'))
      : (row.querySelector('.productPrice .Plugin_Price') || row.querySelector('.shippingPrice .Plugin_Price'));
    const storePrice = storePriceEl ? parsePrice(storePriceEl.textContent) : 0;
    if (storePrice > 0 && bestPrice > 0 && storePrice <= limit) return false;
  }
  return true;
}

export function isCardFilteredOut(card, filters = null, opts = null) {
  if (!card) return true;
  const forScan = opts?.forScan === true;
  const isHide = m => m !== 'dim' && m !== 'highlight';
  const causeHit = f => (f.isNeg && isHide(CONFIG.FILTER_NEG_MODE))
    || (f.isLowOffers && isHide(CONFIG.FILTER_MIN_MODE))
    || (f.isDealerLoser && isHide(CONFIG.DEALER_MODE))
    || (forScan ? false : (f.isUnchecked && isHide(CONFIG.HIDE_UNCHECKED_MODE)))
    || (f.isVortiefExcluded && isHide(CONFIG.VORTIEF_MODE));
  const legacyChecks = () => {
    const tab = card.closest?.('.f_tab');
    if (tab && !tab.classList.contains('selected')) return true;
    if (!forScan) {
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
    return true;
  }
  const f = {
    isNeg: card.classList?.contains('tp-negative-filtered') === true,
    isLowOffers: card.classList?.contains('tp-min-offers-filtered') === true,
    isVortiefExcluded: card.classList?.contains('tp-vortief-excluded') === true,
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
  return true;
}

export function scanCandidateState(cd, { isFeed = false, minDiscount = 30 } = {}) {
  if (!cd?.pid) return null;
  if (isFeed && (cd.discountVal === null || cd.discountVal < minDiscount)) return null;
  if (isCardFilteredOut(cd.card, cd.filters, { forScan: true })) return null;
  return scanEligibility(cd.card);
}
