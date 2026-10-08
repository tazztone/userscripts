import { STYLES } from './ui/styles.js';
import {
  parsePrice,
  priceToCents,
  analyzePriceTimeSeries
} from './domain/price.js';
import { computeDealScore } from './domain/deal-score.js';
import { memoryCache } from './scanner/cache.js';
import {
  getProductCards,
  extractOfferCount,
  matchesNegativeTerms,
  parseNegativeTerms,
  extractCardData,
  extractActiveStores,
  getCardDealerRows,
  applyCardFilters,
  isCardFilteredOut
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
import { renderFloatingCTA, hideFloatingCTA, startBatchCheck } from './ui/floating-cta.js';
import { setupUI } from './ui/modal.js';
import { uiShadowRoot } from './ui/shell.js';
import {
  CONFIG,
  saveConfigKey,
  updateConfig,
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
// @version      2.18.108
// @description  All-in-one suite for Toppreise.ch: Highlights best prices, discount heatmap, excludes negative keywords, sorts/filters by offer count/discount, checks real all-time Tiefstpreise, and automates price alarms.
// @author       tazztone
// @match        https://www.toppreise.ch/*
// @updateURL    https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js
// @downloadURL  https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      discord.com
// @noframes
// ==/UserScript==

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

  function processListings() {
    if (isModifyingDOM) return;
    if (isProductDetailPage()) {
      const staleBar = document.getElementById('tp-suite-filter-bar');
      if (staleBar) staleBar.remove();
      hideFloatingCTA();
      return;
    }
    isModifyingDOM = true;
    if (mainObserver) mainObserver.disconnect();
    try {
      const cards = getProductCards();
      if (cards.length === 0) {
        const staleBar = document.getElementById('tp-suite-filter-bar');
        if (staleBar) staleBar.remove();
        hideFloatingCTA();
        return;
      }

      // --- Extract ---
      const activeStores = extractActiveStores();
      const termsList = parseNegativeTerms();
      const isNeueFeed = isNeueToppreisePage();
      const minDealDiscount = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
      const cardDataList = cards.map(extractCardData);

      // --- Filter ---
      const counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, bestpreiseHidden: 0, badDeals: 0, uncheckedHidden: 0 };
      const pageHasOffers = cardDataList.some(cd => cd.offerCount > 0);

      for (const cd of cardDataList) {
        cd.filters = applyCardFilters(cd, termsList, CONFIG.MIN_OFFERS, pageHasOffers);
        const isStandardFiltered = cd.filters.isNeg || cd.filters.isLowOffers;
        if (cd.filters.isNeg) counts.neg++;
        if (cd.filters.isLowOffers) counts.min++;
        if (isNeueFeed) {
          if (cd.pid && !cd.stats && cd.discountVal !== null && cd.discountVal >= minDealDiscount && !isCardFilteredOut(cd.card, cd.filters)) {
            counts.uncheckedDeals++;
          }
        } else {
          if (cd.pid && !cd.stats && !isCardFilteredOut(cd.card, cd.filters)) {
            counts.uncheckedDeals++;
          }
        }
        // nonBest is retired with the removed strictness toggles: outside the
        // mode nothing hides as non-best (truthful Aufschlag badge instead),
        // inside the mode it counts as bestpreiseHidden below. Never double-count.
        cd.dealScore = cd.dealScore ?? computeDealScore(cd.stats, cd.cardPrice);
        if (cd.dealScore) {
          counts.bestpreiseDeals++;
        } else if (CONFIG.BESTPREISE_MODE_ACTIVE === true && cd.stats && !isStandardFiltered) {
          counts.bestpreiseHidden++;
          counts.badDeals++;
        } else if (CONFIG.BESTPREISE_HIDE_UNCHECKED === true && !cd.stats && !isStandardFiltered) {
          // "Nur Geprüfte" hides never-checked cards via tp-unchecked-hidden —
          // count them so empty-state + reveal counts stay truthful.
          counts.bestpreiseHidden++;
          counts.uncheckedHidden++;
        }
      }

      // --- Render ---
      for (const cd of cardDataList) {
        renderCardEffects(cd, cd.filters, isNeueFeed, activeStores);
      }

      // --- Sort ---
      applySorting(cards, pageHasOffers, cardDataList);

      // --- Empty state, filter bar & floating verify CTA ---
      renderEmptyState(cards, counts);
      renderSuiteFilterBar(counts, pageHasOffers, isNeueFeed);
      renderFloatingCTA(counts, isNeueFeed);
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

      // Ignore mutations inside our own root UI, filter bar, or floating CTA
      if (target.id === 'tp-root' || target.closest?.('#tp-root')) return false;
      if (target.id === 'tp-suite-filter-bar' || target.closest?.('#tp-suite-filter-bar')) return false;
      if (target.id === 'tp-floating-check-cta' || target.closest?.('#tp-floating-check-cta')) return false;

      // Ignore mutations inside document.head (DarkReader dynamic styles, font loading, etc.)
      if (target === document.head || target.closest?.('head')) return false;

      // If the mutation target is inside an existing card, ignore it (image lazyloads, badges, tooltips)
      if (target.closest?.('.Plugin_Product, .mixedBrowsingListProduct')) return false;

      const checkNode = node => {
        if (!node || node.nodeType !== 1) return false;
        if (node.id === 'tp-root' || node.id === 'tp-suite-filter-bar' || node.id === 'tp-empty-state-notice' || node.id === 'tp-floating-check-cta') return false;
        if (node.classList?.contains('tp-card-subline-row') ||
            node.classList?.contains('tp-sparkline-container') ||
            node.classList?.contains('tp-best-price-badge') ||
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
      updateConfig,
      saveConfigKey,
      startBatchCheck,
      runBatchDealCheck,
      cancelBatchDealCheck,
      getCardDealerRows,
      isCardFilteredOut,
      clearCardCache,
      computeDealScore,
      analyzePriceTimeSeries,
      parsePrice,
      isShippingPriceActive,
      CONFIG,
      memoryCache
    };
  }
})();
