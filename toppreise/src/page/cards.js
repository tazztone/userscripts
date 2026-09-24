/**
 * Page & Card Extraction Layer
 * Manages card discovery, ID extraction, DOM query memoization,
 * discount extraction, category resolution, and heatmap styling.
 */

import { SELECTORS } from './selectors.js';
import { extractCanonicalPrice, parsePrice, priceToCents } from '../domain/price.js';
import { computeDealScore } from '../domain/deal-score.js';
import { getCachedPriceStats } from '../scanner/cache.js';
import { normalizeName, resolveCategoryGroup } from '../domain/category.js';

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

export function formatCategorySlug(slug) {
  if (!slug) return '';
  const clean = decodeURIComponent(slug).replace(/-/g, ' ').trim();
  if (!clean || clean.length < 2 || (clean.toLowerCase().startsWith('p') && !isNaN(clean.slice(1)))) return '';
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function getCardHrefs(card) {
  if (!card) return [];
  const elements = [card.tagName?.toLowerCase() === 'a' ? card : null, card.closest?.('a[href]'), ...(card.querySelectorAll ? card.querySelectorAll('a[href]') : [])];
  return Array.from(new Set(elements.filter(el => el && !el.closest('header, nav, footer, .breadcrumb, #tp-suite-filter-bar')).map(el => el.getAttribute('href') || el.href || ''))).filter(Boolean);
}

export function extractCardCategory(card) {
  if (!card) return '';
  if (card.dataset?.tpCategory) return card.dataset.tpCategory;

  let extracted = '';
  for (const href of getCardHrefs(card)) {
    const match = href.match(/\/(?:preisvergleich|produktsuche)\/(.+?)(?:\/[^\/]+-p\d+|-c\d+)/i);
    if (match && match[1]) {
      const segments = match[1].split('/').filter(Boolean);
      const subCat = segments[segments.length - 1];
      const formatted = formatCategorySlug(subCat);
      if (formatted) { extracted = formatted; break; }
    }
  }

  if (!extracted && card.querySelector) {
    const catEl = card.querySelector(SELECTORS.cards.categoryChip);
    if (catEl) {
      const text = (catEl.getAttribute('data-category') || catEl.textContent).trim().replace(/\(\d+\)/g, '').trim();
      if (text && text.length > 1 && !text.includes('CHF') && !text.includes('Angebot') && !text.includes('%')) extracted = text;
    }
  }

  if (!extracted) {
    const activeBreadcrumb = document.querySelector(SELECTORS.layout.breadcrumbs);
    if (activeBreadcrumb) {
      const text = activeBreadcrumb.textContent.trim().replace(/\(\d+\)/g, '').trim();
      if (text && text.length > 1 && !['home', 'toppreise', 'neue toppreise', 'startseite'].includes(text.toLowerCase())) extracted = text;
    }
  }

  if (extracted && card.dataset) card.dataset.tpCategory = extracted;
  return extracted;
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

  const hrefs = getCardHrefs(card);
  for (const href of hrefs) {
    const match = href.match(/-p(\d+)/);
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
  const badgeEl = card.querySelector('.badge-dif, .badge, [class*="badge-dif"]');
  const text = badgeEl ? badgeEl.textContent : (card.textContent || '');
  const match = text.match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);
  if (match) {
    let val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val)) {
      if (card.dataset) {
        card.dataset.tpDiff = val;
        card.dataset.tpDiscount = val ? -val : 0;
      }
      return val;
    }
  }
  if (card.dataset) {
    card.dataset.tpDiff = '';
    card.dataset.tpDiscount = '';
  }
  return null;
}

export function extractCardDiscount(card) {
  const diff = extractCardDiff(card);
  return diff === null ? null : (diff === 0 ? 0 : -diff);
}

export function getHeatmapStyles(diffPercent, intensity = 1.0) {
  const diff = typeof diffPercent === 'number' ? diffPercent : parseFloat(diffPercent);
  if (isNaN(diff)) return null;
  const clamped = Math.max(-100, Math.min(100, diff));
  const t = (100 - clamped) / 200; // 0.0 (Cold, +100%) to 1.0 (Hot, -100%)
  const stops = [
    { t: 0.00, base: [14, 38, 74],   acc: [24, 100, 185],  border: [56, 140, 248, 0.70] },
    { t: 0.25, base: [12, 50, 60],   acc: [16, 130, 125],  border: [20, 210, 190, 0.75] },
    { t: 0.50, base: [24, 32, 44],   acc: [45, 58, 76],    border: [71, 85, 105, 0.50] },
    { t: 0.75, base: [75, 42, 12],   acc: [215, 85, 18],   border: [251, 115, 36, 0.88] },
    { t: 1.00, base: [98, 14, 32],   acc: [238, 25, 65],   border: [244, 63, 94, 0.95] }
  ];
  let i = stops.findIndex((s, idx) => idx < stops.length - 1 && t >= s.t && t <= stops[idx + 1].t);
  if (i < 0) i = stops.length - 2;
  const s0 = stops[i], s1 = stops[i + 1], factor = (t - s0.t) / (s1.t - s0.t || 1);
  const lerp = (a, b) => Math.round(a + (b - a) * factor);
  const base = [lerp(s0.base[0], s1.base[0]), lerp(s0.base[1], s1.base[1]), lerp(s0.base[2], s1.base[2])];
  const acc = [lerp(s0.acc[0], s1.acc[0]), lerp(s0.acc[1], s1.acc[1]), lerp(s0.acc[2], s1.acc[2])];
  const borderRgb = [lerp(s0.border[0], s1.border[0]), lerp(s0.border[1], s1.border[1]), lerp(s0.border[2], s1.border[2])];
  const borderAlpha = (s0.border[3] + (s1.border[3] - s0.border[3]) * factor);
  const safeInt = Math.max(0.2, Math.min(1.0, intensity));
  const bg = `linear-gradient(135deg, rgba(${base.join(',')},${(0.92 + 0.04 * t).toFixed(2)}) 0%, rgba(${acc.join(',')},${((0.75 + 0.20 * t) * safeInt).toFixed(2)}) 100%)`;
  const border = `rgba(${borderRgb.join(',')},${(borderAlpha * safeInt).toFixed(2)})`;
  const glow = (t >= 0.70 || t <= 0.15) ? `0 4px 18px rgba(${acc.join(',')},${(0.32 * safeInt).toFixed(2)})` : 'none';
  return { bg, border, glow };
}

export function extractActiveStores() {
  const filterElements = document.querySelectorAll(SELECTORS.layout.activeStoreFilters);
  return Array.from(filterElements).map(el => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.icon-close, .f_remove_icon, .close, span').forEach(i => i.remove());
    return normalizeName(clone.textContent);
  }).filter(name => name.length > 0);
}

export function parseNegativeTerms(rawTerms = (typeof CONFIG !== 'undefined' ? CONFIG.NEGATIVE_TERMS : '')) {
  return (rawTerms || '').split(/[,;\n]/).map(t => t.trim().toLowerCase()).filter(Boolean);
}

export function extractCardData(card) {
  const pid = getCardProductId(card);
  const priceData = extractCanonicalPrice(card);
  const cardPriceEl = priceData.el;
  const cardPrice = priceData.price;
  const stats = pid ? getCachedPriceStats(pid) : null;
  const isVerifiedNonBest = !!(stats && cardPrice > 0 && stats.tiefstpreis > 0 && priceToCents(cardPrice) > priceToCents(stats.tiefstpreis));
  const diffVal = extractCardDiff(card);
  const discountVal = extractCardDiscount(card);
  const dealScore = (stats && cardPrice > 0) ? computeDealScore(stats, cardPrice) : null;
  const catName = extractCardCategory(card);
  const rootGroup = resolveCategoryGroup(catName, card, getCardHrefs);
  const offerCount = extractOfferCount(card);

  return {
    card,
    pid,
    cardPriceEl,
    cardPrice,
    stats,
    isVerifiedNonBest,
    diffVal,
    discountVal,
    dealScore,
    catName,
    rootGroup,
    offerCount
  };
}

export function getCardSortableUnit(card) {
  if (!card) return null;
  const collItem = card.closest('.Plugin_ProductCollItem');
  if (collItem) return collItem;
  const parent = card.parentElement;
  if (parent && parent !== document.body && parent.id !== 'product-list' && parent.id !== 'main-content' && !parent.classList?.contains('main-content-col') && !parent.classList?.contains('product-grid') && !parent.classList?.contains('row')) {
    if (Array.from(parent.classList || []).some(c => c.startsWith('col-') || c === 'cell')) {
      return parent;
    }
  }
  return card;
}
