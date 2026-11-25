/**
 * Page Card Filtering & Scan Candidacy
 * Evaluates negative keywords, offer/price/discount/savings/dealer filters,
 * visibility/scan exclusions, and candidate readiness.
 */

import { CONFIG } from '../state/config.js';
import { extractCanonicalPrice, parsePrice, computeSavingsChf } from '../domain/price.js';
import { hasUsablePriceStats, lruSet } from '../scanner/cache.js';
import { isShippingPriceActive } from './adapter.js';
import {
  getCardDealerRows,
  extractOfferCount,
  getCardEffectiveDiscount,
  scanEligibility
} from './cards.js';

const _negReCache = new Map();

export function matchesNegativeTerms(card, termsList) {
  if (!termsList || termsList.length === 0) return false;
  let text = card._tpTextLower;
  if (text === undefined) {
    const nodes = card.querySelectorAll?.('.bold, .product-name, .productDetails, .Plugin_ProductHeading');
    const joined = [...(nodes ?? [])].map(el => {
      if (!el.querySelector?.('[class*="tp-"]')) return el.textContent;
      const clone = el.cloneNode(true);
      clone.querySelectorAll('[class*="tp-"]').forEach(n => n.remove());
      return clone.textContent;
    }).join(' ');
    if (joined.trim()) text = joined.toLowerCase();
    else {
      const single = card.querySelector?.('.bold, .product-name, .productDetails, .Plugin_ProductHeading');
      if (single?.textContent?.trim()) text = single.textContent.toLowerCase();
      else if (typeof card.cloneNode === 'function') {
        const clone = card.cloneNode(true);
        clone.querySelectorAll?.('.tp-injected-badge, .tp-share-btn, .tp-dealer-name, [class*="tp-"]').forEach(el => el.remove());
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
        lruSet(_negReCache, term, shortRe, 100);
      }
      return shortRe.test(text);
    }
    return text.includes(term);
  });
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

export function applyCardFilters(cd, termsList, minOffers, pageHasOffers, isDealFeed = true) {
  const isNeg = CONFIG.FILTER_NEG_ENABLED ? matchesNegativeTerms(cd.card, termsList) : false;
  const isLowOffers = CONFIG.FILTER_MIN_ENABLED ? !!(pageHasOffers && minOffers > 0 && cd.offerCount < minOffers) : false;
  const kind = cd.displayDelta?.kind;
  const isVortief = !cd.dealScore && (kind === 'at-low' || kind === 'new-low');
  const isVortiefExcluded = CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && isVortief;
  const stats = cd.verifiedStats !== undefined ? cd.verifiedStats : cd.stats;
  const isVerified = !!cd.dealScore || hasUsablePriceStats(stats);
  const isUnchecked = CONFIG.BESTPREISE_HIDE_UNCHECKED === true && !hasUsablePriceStats(stats);
  const isBelowMinDiscount = CONFIG.FILTER_DEAL_DISCOUNT_ENABLED && CONFIG.MIN_DEAL_DISCOUNT > 0 && isVerified && getCardEffectiveDiscount(cd) < CONFIG.MIN_DEAL_DISCOUNT;
  const price = cd.cardPrice || 0;
  const minP = CONFIG.FILTER_PRICE_MIN || 0;
  const maxP = CONFIG.FILTER_PRICE_MAX || 0;
  const isOutOfPriceRange = CONFIG.FILTER_PRICE_ENABLED && price > 0 && (
    (minP > 0 && price < minP) || (maxP > 0 && price > maxP)
  );
  const minS = CONFIG.FILTER_SAVINGS_MIN || 0;
  const savings = cd.savingsChf ?? computeSavingsChf(cd.cardPrice, getCardEffectiveDiscount(cd));
  const isBelowMinSavings = CONFIG.FILTER_SAVINGS_ENABLED && isVerified && minS > 0 && savings < minS;
  const isDealerLoser = false;
  return { isNeg, isLowOffers, isBelowMinDiscount, isOutOfPriceRange, isBelowMinSavings, isVortiefExcluded, isUnchecked, isDealerLoser };
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
  if (!(bestPrice > 0)) return false;
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

export const FILTER_CAUSE_DEFS = [
  { flag: 'isNeg', modeKey: 'FILTER_NEG_MODE', enableKey: 'FILTER_NEG_ENABLED', scanExempt: false },
  { flag: 'isLowOffers', modeKey: 'FILTER_MIN_MODE', enableKey: 'FILTER_MIN_ENABLED', scanExempt: false },
  { flag: 'isDealerLoser', modeKey: 'DEALER_MODE', enableKey: null, scanExempt: false, resetMode: 'dim' },
  { flag: 'isBelowMinDiscount', modeKey: 'FILTER_DEAL_DISCOUNT_MODE', enableKey: 'FILTER_DEAL_DISCOUNT_ENABLED', scanExempt: true },
  { flag: 'isOutOfPriceRange', modeKey: 'FILTER_PRICE_MODE', enableKey: 'FILTER_PRICE_ENABLED', scanExempt: false },
  { flag: 'isBelowMinSavings', modeKey: 'FILTER_SAVINGS_MODE', enableKey: 'FILTER_SAVINGS_ENABLED', scanExempt: true },
  { flag: 'isUnchecked', modeKey: 'HIDE_UNCHECKED_MODE', enableKey: 'BESTPREISE_HIDE_UNCHECKED', scanExempt: true },
  { flag: 'isVortiefExcluded', modeKey: 'VORTIEF_MODE', enableKey: 'BESTPREISE_INCLUDE_VORTIEF', scanExempt: false, resetVal: true },
];

export function isCardFilteredOut(card, filters = null, opts = null) {
  if (!card) return true;
  const forScan = opts?.forScan === true;
  const isHide = m => m !== 'dim' && m !== 'highlight';
  const causeHit = f => FILTER_CAUSE_DEFS.some(def => (!forScan || !def.scanExempt) && f[def.flag] && isHide(CONFIG[def.modeKey]));
  const legacyChecks = () => {
    const tab = card.closest?.('.f_tab');
    if (tab && !tab.classList.contains('selected')) return true;
    if (!forScan) {
      if (card.hidden || card.classList?.contains('d-none') || card.closest?.('.d-none')) return true;
      if (typeof card.checkVisibility === 'function') {
        if (!card.checkVisibility()) return true;
      } else if (card.offsetParent === null && typeof window !== 'undefined' && window.getComputedStyle?.(card)?.display === 'none') {
        return true;
      }
    }
    return false;
  };
  if (CONFIG.FILTERS_ENABLED === false) return legacyChecks();
  if (filters) {
    if (!causeHit(filters)) return legacyChecks();
    return true;
  }
  const f = {
    isNeg: card.classList?.contains('tp-negative-filtered') === true,
    isLowOffers: card.classList?.contains('tp-min-offers-filtered') === true,
    isBelowMinDiscount: !!card.classList?.contains('tp-deal-disc-filtered'),
    isOutOfPriceRange: card.classList?.contains('tp-price-filtered') === true,
    isBelowMinSavings: card.classList?.contains('tp-savings-filtered') === true,
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
  let pageHasOffers = typeof opts?.pageHasOffers === 'boolean' ? opts.pageHasOffers : (offerCount > 0);
  if (!pageHasOffers) {
    const doc = card?.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (doc?.querySelector) {
      const now = Date.now();
      if (doc._tpOffersMemoTime && (now - doc._tpOffersMemoTime) < 500) {
        pageHasOffers = doc._tpHasOffersMemo;
      } else {
        pageHasOffers = doc.querySelector('.Plugin_DealerRelProdPriceInfo') !== null;
        doc._tpOffersMemoTime = now;
        doc._tpHasOffersMemo = pageHasOffers;
      }
    }
  }
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
  return scanEligibility(cd.card, cd);
}
