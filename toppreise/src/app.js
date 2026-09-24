import { STYLES } from './ui/styles.js';
import {
  parsePrice,
  priceToCents,
  sanitizeTimeSeries,
  analyzePriceTimeSeries
} from './domain/price.js';
import { computeDealScore } from './domain/deal-score.js';
import { memoryCache } from './scanner/cache.js';
import {
  resolveCategoryGroup,
  isPathExcluded
} from './domain/category.js';
import {
  getProductCards,
  extractCardCategory,
  extractOfferCount,
  matchesNegativeTerms,
  parseNegativeTerms,
  extractCardData,
  extractActiveStores,
  getCardDealerRows
} from './page/cards.js';
import {
  isShippingPriceActive,
  isNeueToppreisePage,
  isProductDetailPage,
  clearCardCache
} from './page/adapter.js';
import { applySorting } from './page/sort.js';
import {
  renderCardEffects,
  renderEmptyState
} from './ui/badges.js';
import { renderSuiteFilterBar } from './ui/toolbar.js';
import { uiShadowRoot, setupUI } from './ui/modal.js';
import {
  CONFIG,
  saveConfigKey,
  updateConfig,
  updateConfigs,
  updateBodyClasses
} from './state/config.js';
import {
  runBestpreiseScan,
  cancelBestpreiseScan,
  runBatchDealCheck,
  cancelBatchDealCheck
} from './scanner/scanner.js';
import { processPriceAlarmModal } from './features/price-alarm.js';
import { processProductDetailPage } from './features/product-detail.js';

// ==UserScript==
// @name         Toppreise.ch Suite: Power Filter & Price Alarm Auto-Filler
// @namespace    https://github.com/tazztone/userscripts
// @version      2.18.49
// @description  All-in-one suite for Toppreise.ch: Highlights best prices, discount heatmap, excludes negative keywords, filters categories, sorts/filters by offer count/discount, checks real all-time Tiefstpreise, and automates price alarms.
// @author       tazztone
// @match        https://www.toppreise.ch/*
// @updateURL    https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js
// @downloadURL  https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @noframes
// ==/UserScript==

// ─── STYLES ──────────────────────────────────────────────────────────────────
(() => {
  'use strict';

  const log = (...args) => { if (CONFIG.DEBUG) console.log('[Toppreise-Suite]', ...args); };

  if (!document.getElementById('tp-unified-settings-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'tp-unified-settings-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  updateBodyClasses();

  let isModifyingDOM = false;
  let mainObserver = null;

  function applyCardFilters(cd, termsList, excludedCats, minOffers, pageHasOffers) {
    const isNeg = CONFIG.FILTER_NEG_ENABLED ? matchesNegativeTerms(cd.card, termsList) : false;
    const isCatExcluded = CONFIG.FILTER_CAT_ENABLED ? !!(cd.catName && isPathExcluded(cd.catName, cd.rootGroup, excludedCats)) : false;
    const isLowOffers = CONFIG.FILTER_MIN_ENABLED ? !!(pageHasOffers && minOffers > 0 && cd.offerCount < minOffers) : false;
    return { isNeg, isCatExcluded, isLowOffers };
  }

  function isCardIgnoredOrInvisible(card, filters = null) {
    if (!card) return true;
    const isRevealed = document.body?.classList.contains('tp-reveal-filtered');
    if (!isRevealed) {
      if (filters) {
        if (filters.isNeg || filters.isCatExcluded || filters.isLowOffers) return true;
      } else {
        if (card.classList?.contains('tp-negative-filtered') ||
            card.classList?.contains('tp-category-filtered') ||
            card.classList?.contains('tp-min-offers-filtered') ||
            card.classList?.contains('tp-non-bestpreis-filtered') ||
            card.classList?.contains('tp-bestpreise-hidden')) {
          return true;
        }
        const termsList = parseNegativeTerms();
        const excludedCats = CONFIG.EXCLUDED_CATEGORIES || [];
        const catName = extractCardCategory(card);
        const rootGroup = resolveCategoryGroup(catName, card);
        const offerCount = extractOfferCount(card);
        const f = applyCardFilters({ card, catName, rootGroup, offerCount }, termsList, excludedCats, CONFIG.MIN_OFFERS, true);
        if (f.isNeg || f.isCatExcluded || f.isLowOffers) return true;
      }
    }
    const tab = card.closest?.('.f_tab');
    if (tab && !tab.classList.contains('selected')) return true;

    if (card.hidden || card.classList?.contains('d-none') || card.closest?.('.d-none')) return true;
    if (typeof card.checkVisibility === 'function') {
      if (!card.checkVisibility()) return true;
    } else if (card.offsetParent === null && window.getComputedStyle?.(card)?.display === 'none') {
      return true;
    }
    return false;
  }

  function processListings() {
    if (isModifyingDOM) return;
    if (isProductDetailPage()) {
      const staleBar = document.getElementById('tp-suite-filter-bar');
      if (staleBar) staleBar.remove();
      return;
    }
    isModifyingDOM = true;
    if (mainObserver) mainObserver.disconnect();
    try {
      const cards = getProductCards();
      if (cards.length === 0) {
        const staleBar = document.getElementById('tp-suite-filter-bar');
        if (staleBar) staleBar.remove();
        return;
      }

      // --- Extract ---
      const activeStores = extractActiveStores();
      const termsList = parseNegativeTerms();
      const excludedCats = CONFIG.EXCLUDED_CATEGORIES || [];
      const isNeueFeed = isNeueToppreisePage();
      const minDealDiscount = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
      const cardDataList = cards.map(extractCardData);

      // --- Filter ---
      const counts = { neg: 0, cat: 0, min: 0, nonBest: 0, uncheckedDeals: 0, bestpreiseDeals: 0, bestpreiseHidden: 0 };
      const pageHasOffers = cardDataList.some(cd => cd.offerCount > 0);

      for (const cd of cardDataList) {
        cd.filters = applyCardFilters(cd, termsList, excludedCats, CONFIG.MIN_OFFERS, pageHasOffers);
        const isStandardFiltered = cd.filters.isNeg || cd.filters.isCatExcluded || cd.filters.isLowOffers;
        if (cd.filters.isNeg) counts.neg++;
        if (cd.filters.isCatExcluded) counts.cat++;
        if (cd.filters.isLowOffers) counts.min++;
        if (isNeueFeed) {
          if (cd.pid && !cd.stats && cd.discountVal !== null && cd.discountVal >= minDealDiscount && !isCardIgnoredOrInvisible(cd.card, cd.filters)) {
            counts.uncheckedDeals++;
          }
        } else {
          if (cd.pid && !cd.stats && !isCardIgnoredOrInvisible(cd.card, cd.filters)) {
            counts.uncheckedDeals++;
          }
        }
        if (CONFIG.FILTER_BESTPREIS_ENABLED !== false && cd.isVerifiedNonBest && CONFIG.REAL_DEAL_FILTER_ACTIVE) {
          counts.nonBest++;
        }
        cd.dealScore = computeDealScore(cd.stats, cd.cardPrice);
        if (cd.dealScore) {
          counts.bestpreiseDeals++;
        } else if (CONFIG.FILTER_BESTPREIS_ENABLED !== false && CONFIG.BESTPREISE_MODE_ACTIVE && cd.stats && !isStandardFiltered) {
          counts.bestpreiseHidden++;
        }
      }

      // --- Render ---
      for (const cd of cardDataList) {
        renderCardEffects(cd, cd.filters, isNeueFeed, activeStores);
      }

      // --- Sort ---
      applySorting(cards, pageHasOffers);

      // --- Empty state & filter bar ---
      renderEmptyState(cards, counts);
      renderSuiteFilterBar(counts, pageHasOffers, isNeueFeed);
    } finally {
      isModifyingDOM = false;
      if (mainObserver) {
        mainObserver.takeRecords();
        mainObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
    }
  }

  // ─── OBSERVER & INITIALIZATION ───────────────────────────────────────────────
  let debounceTimer = null;
  mainObserver = new MutationObserver(mutations => {
    if (isModifyingDOM) return;

    const hasRelevantMutation = mutations.some(m => {
      const target = m.target;
      if (!target) return false;

      // Ignore mutations inside our own root UI or filter bar
      if (target.id === 'tp-root' || target.closest?.('#tp-root')) return false;
      if (target.id === 'tp-suite-filter-bar' || target.closest?.('#tp-suite-filter-bar')) return false;

      // Ignore mutations inside document.head (DarkReader dynamic styles, font loading, etc.)
      if (target === document.head || target.closest?.('head')) return false;

      // If the mutation target is inside an existing card, ignore it (image lazyloads, badges, tooltips)
      if (target.closest?.('.Plugin_Product, .mixedBrowsingListProduct')) return false;

      const checkNode = node => {
        if (!node || node.nodeType !== 1) return false;
        if (node.id === 'tp-root' || node.id === 'tp-suite-filter-bar' || node.id === 'tp-empty-state-notice') return false;
        if (node.classList?.contains('tp-card-subline-row') ||
            node.classList?.contains('tp-badge-score-breakdown') ||
            node.classList?.contains('tp-sparkline-container') ||
            node.classList?.contains('tp-best-price-badge') ||
            node.classList?.contains('tp-card-quick-block') ||
            node.classList?.contains('tp-empty-state-notice')) {
          return false;
        }
        return node.matches?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading') ||
               !!node.querySelector?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading');
      };

      for (let i = 0; i < m.addedNodes.length; i++) {
        if (checkNode(m.addedNodes[i])) return true;
      }
      for (let i = 0; i < m.removedNodes.length; i++) {
        if (checkNode(m.removedNodes[i])) return true;
      }
      return false;
    });

    if (!hasRelevantMutation) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processListings();
      processPriceAlarmModal();
      if (isProductDetailPage()) {
        processProductDetailPage();
      }
    }, CONFIG.OBSERVER_DEBOUNCE_MS);
  });

  mainObserver.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('keydown', e => {
    // Skip if modifier keys other than none
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Skip if user is typing in an input/textarea/select or contenteditable
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;
    // Skip if inside shadow root (settings modal)
    if (document.activeElement?.shadowRoot || uiShadowRoot?.activeElement) return;

    if (e.key === '/') {
      const input = document.getElementById('tp-inline-negative-input');
      if (input) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    } else if (e.key === 'Escape') {
      const input = document.getElementById('tp-inline-negative-input');
      if (input && document.activeElement === input) {
        input.blur();
      }
    }
  });

  if (self.navigation?.addEventListener) {
    self.navigation.addEventListener('navigatesuccess', () => {
      processListings();
      processPriceAlarmModal();
      if (isProductDetailPage()) {
        processProductDetailPage();
      }
    });
  }

  setupUI();
  processListings();
  processPriceAlarmModal();
  if (isProductDetailPage()) {
    processProductDetailPage();
  }

  if (typeof window !== 'undefined') {
    window.ToppreiseSuite = {
      processListings,
      processProductDetailPage,
      processPriceAlarmModal,
      applySorting,
      computeDealScore,
      analyzePriceTimeSeries,
      sanitizeTimeSeries,
      runBestpreiseScan,
      cancelBestpreiseScan,
      runBatchDealCheck,
      cancelBatchDealCheck,
      isCardIgnoredOrInvisible,
      saveConfigKey,
      updateConfig,
      updateConfigs,
      getCardDealerRows,
      clearCardCache,
      parsePrice,
      isShippingPriceActive,
      CONFIG,
      memoryCache
    };
  }
})();
