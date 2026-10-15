import { STYLES } from './ui/styles.js';
import {
  parsePrice,
  analyzePriceTimeSeries
} from './domain/price.js';
import { computeDealScore } from './domain/deal-score.js';
import { memoryCache, statsKey, hasUsablePriceStats } from './scanner/cache.js';
import {
  getProductCards,
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
  isSearchPage,
  isProductDetailPage,
  clearCardCache
} from './page/adapter.js';
import { applySorting } from './page/sort.js';
import {
  renderCardEffects,
  renderEmptyState,
  clearDealerAutoTried
} from './ui/badges.js';
import { renderSuiteFilterBar } from './ui/toolbar.js';
import { renderFloatingCTA, hideFloatingCTA, startBatchCheck } from './ui/floating-cta.js';
import { setupUI, openSettingsAt } from './ui/modal.js';
import { showToast } from './ui/toast.js';
import { uiShadowRoot } from './ui/shell.js';
import {
  CONFIG,
  saveConfigKey,
  updateConfig,
  updateBodyClasses,
  migrateFilterSplit
} from './state/config.js';
import {
  runBatchDealCheck,
  cancelBatchDealCheck
} from './scanner/scanner.js';
import { scanState } from './state/store.js';
import { processPriceAlarmModal } from './features/price-alarm.js';
import { processProductDetailPage } from './features/product-detail.js';

// ==UserScript==
// @name         Toppreise.ch Suite: Power Filter & Price Alarm Auto-Filler
// @namespace    https://github.com/tazztone/userscripts
// @version      2.18.265
// @description  All-in-one suite for Toppreise.ch: Highlights best prices, discount heatmap, excludes negative keywords, sorts/filters by offer count/discount, checks real all-time Tiefstpreise, and automates price alarms.
// @author       tazztone
// @match        https://www.toppreise.ch/*
// @updateURL    https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js
// @downloadURL  https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      discord.com
// @connect      toppreise.ch
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
    const dismissChrome = () => { const staleBar = document.getElementById('tp-suite-filter-bar'); if (staleBar) staleBar.remove(); hideFloatingCTA(); };
    if (isModifyingDOM) return;
    if (isProductDetailPage()) { dismissChrome(); return; }
    isModifyingDOM = true;
    if (mainObserver) mainObserver.disconnect();
    try {
      const cards = getProductCards();
      if (cards.length === 0) { dismissChrome(); return; }

      // --- Extract ---
      const activeStores = extractActiveStores();
      const termsList = parseNegativeTerms();
      const isNeueFeed = isNeueToppreisePage();
      const isSortPage = isNeueFeed || isSearchPage();
      const minDealDiscount = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
      const cardDataList = cards.map(extractCardData);

      // --- Filter ---
      const counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, vortief: 0, uncheckedHidden: 0, dealer: 0, dealerActive: activeStores.length > 0, filteredCount: 0, dimmed: 0 };
      const pageHasOffers = cardDataList.some(cd => cd.offerCount > 0);

      for (const cd of cardDataList) {
        cd.filters = applyCardFilters(cd, termsList, CONFIG.MIN_OFFERS, pageHasOffers, isNeueFeed);
        if (isNeueFeed) {
          if (cd.pid && !hasUsablePriceStats(cd.stats) && cd.discountVal !== null && cd.discountVal >= minDealDiscount && !isCardFilteredOut(cd.card, cd.filters, { forScan: true })) {
            counts.uncheckedDeals++;
          }
        } else {
          if (cd.pid && !hasUsablePriceStats(cd.stats) && !isCardFilteredOut(cd.card, cd.filters, { forScan: true })) {
            counts.uncheckedDeals++;
          }
        }
        // Verified markups are removed nowhere, so counted nowhere.
        cd.dealScore = cd.dealScore ?? computeDealScore(cd.stats, cd.cardPrice);
        // bestpreiseDeals feeds the empty-state "deals exist" guard: dealScore blends plus included Vortief lows; excluded-fallback lows count under vortief only.
        if (cd.dealScore) counts.bestpreiseDeals++;
        else if ((cd.displayDelta?.kind === 'at-low' || cd.displayDelta?.kind === 'new-low') && CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false) counts.bestpreiseDeals++;
      }

      // --- Render ---
      for (const cd of cardDataList) {
        renderCardEffects(cd, cd.filters, isNeueFeed, activeStores);
        if (cd.filters.isDimmed) counts.dimmed++;
        if (cd.filters.isFiltered) counts.filteredCount++;
        if (cd.filters.isNeg) counts.neg++;
        if (cd.filters.isLowOffers) counts.min++;
        if (cd.filters.isUnchecked) counts.uncheckedHidden++;
        if (cd.filters.isVortiefExcluded) counts.vortief++;
        if (cd.filters.isDealerLoser) counts.dealer++;
      }

      // --- Sort (deferred mid-scan: final passes sort once with flag cleared) ---
      if (!scanState.isBatchChecking) applySorting(cards, pageHasOffers, cardDataList);

      // --- Empty state, filter bar & floating verify CTA ---
      renderEmptyState(cards, counts);
      renderSuiteFilterBar(counts, pageHasOffers, isNeueFeed, isSortPage);
      renderFloatingCTA(counts, isNeueFeed);
      const mig = migrateFilterSplit();
      if (mig.hadMode || mig.modeWasActive) showToast(mig.modeWasActive ? '💎 sortiert jetzt nur noch — Filtern entfernt, Ansicht dimmt (👁️ zeigt sie)' : 'Neu: Filtern entfernt Karten, Ansicht dimmt nur (👁️ zeigt sie)');
    } finally {
      isModifyingDOM = false;
      if (mainObserver) {
        mainObserver.takeRecords();
        mainObserver.observe(document.documentElement, OBSERVE_OPTS);
      }
    }
  }

  // ─── OBSERVER & INITIALIZATION ───────────────────────────────────────────────
  let debounceTimer = null;
  const OBSERVE_OPTS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'href'] };
  const TP_OWNED_SEL = '#tp-root,#tp-suite-filter-bar,#tp-floating-check-cta,.tp-injected-badge,.tp-best-price-badge,.tp-card-subline-row,.tp-sparkline-container,.tp-card-historical-price';
  const TP_CARD_SEL = '.Plugin_Product,.mixedBrowsingListProduct';
  const isOwnedNode = n => n?.nodeType === 1 && !!n.closest?.(TP_OWNED_SEL);
  const cardOf = n => {
    if (n?.nodeType !== 1) return null;
    if (typeof n.matches === 'function' && n.matches(TP_CARD_SEL)) return n;
    return n.closest?.(TP_CARD_SEL) ?? null;
  };
  mainObserver = new MutationObserver(mutations => {
    if (isModifyingDOM) return;

    let dirtyCard = false;
    let structural = false;
    const checkNode = node => {
      if (!node || node.nodeType !== 1) return false;
      if (isOwnedNode(node)) return false;
      if (node.id === 'tp-root' || node.id === 'tp-suite-filter-bar' || node.id === 'tp-empty-state-notice' || node.id === 'tp-floating-check-cta') return false;
      if (node.classList?.contains('tp-card-subline-row') ||
          node.classList?.contains('tp-sparkline-container') ||
          node.classList?.contains('tp-best-price-badge') ||
          node.classList?.contains('tp-empty-state-notice')) {
        return false;
      }
      return node.matches?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading, .Plugin_NewInfoMailButton, .filters, .f_remove_filter') ||
             !!node.querySelector?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading, .Plugin_NewInfoMailButton, .filters, .f_remove_filter');
    };

    for (const m of mutations) {
      const target = m.target;
      if (!target) continue;
      // Ignore mutations inside document.head (DarkReader dynamic styles, font loading, etc.)
      if (target === document.head || target.closest?.('head')) continue;
      const targetEl = target.nodeType === 1 ? target : target.parentElement;
      // Ignore script-owned paint (own root UI, filter bar, CTA, badges).
      if (targetEl?.closest?.(TP_OWNED_SEL)) continue;

      // In-card host mutation (price text/attribute swap, node replacement):
      // invalidate the card memo so re-render rebuilds instead of repainting stale data.
      const hit = cardOf(targetEl);
      if (hit) {
        let self = false;
        for (const n of [...m.addedNodes, ...m.removedNodes]) {
          if (isOwnedNode(n)) { self = true; break; }
          if (cardOf(n)) continue;
        }
        if (self) continue;
        clearCardCache(hit);
        dirtyCard = true;
        continue;
      }

      for (let i = 0; i < m.addedNodes.length; i++) {
        if (checkNode(m.addedNodes[i])) { structural = true; break; }
      }
      if (!structural) for (let i = 0; i < m.removedNodes.length; i++) {
        if (checkNode(m.removedNodes[i])) { structural = true; break; }
      }
      if (dirtyCard && structural) break;
    }

    if (!dirtyCard && !structural) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processListings();
      processPriceAlarmModal();
      if (isProductDetailPage()) {
        processProductDetailPage();
      }
    }, CONFIG.OBSERVER_DEBOUNCE_MS);
  });

  mainObserver.observe(document.documentElement, OBSERVE_OPTS);

  // Host price-basis toggle (product vs shipping): attribute-only observer on
  // body, separate from the main subtree observer. Rare event, no debounce.
  let lastPriceBasis = document.body?.classList.contains('showproductprice') ? 'p'
    : document.body?.classList.contains('showshippingprice') ? 's' : 'x';
  new MutationObserver(() => {
    const cur = document.body?.classList.contains('showproductprice') ? 'p'
      : document.body?.classList.contains('showshippingprice') ? 's' : 'x';
    if (cur === lastPriceBasis) return;
    lastPriceBasis = cur;
    getProductCards().forEach(clearCardCache);
    processListings();
    if (isProductDetailPage()) processProductDetailPage();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('keydown', e => {
    // Skip if modifier keys other than none
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Escape always leaves the negative-input first, even while typing.
    if (e.key === 'Escape') {
      const negInput = document.getElementById('tp-inline-negative-input');
      if (negInput && document.activeElement === negInput) negInput.blur();
      return;
    }
    // Skip if user is typing in an input/textarea/select or contenteditable
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;
    // Skip if inside shadow root (settings modal)
    if (document.activeElement?.shadowRoot || uiShadowRoot?.activeElement) return;

    if (e.key === '/') {
      const input = document.getElementById('tp-inline-negative-input');
      if (input) {
        e.preventDefault();
        document.getElementById('tp-bar-filter-popover')?.classList.add('tp-show');
        document.getElementById('tp-bar-filter-btn')?.setAttribute('aria-expanded', 'true');
        input.focus();
        input.select();
      }
    }
  });

  if (self.navigation?.addEventListener) {
    self.navigation.addEventListener('navigatesuccess', () => {
      cancelBatchDealCheck();
      clearDealerAutoTried();
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
    const suiteVersion = (typeof GM_info !== 'undefined' && GM_info?.script?.version) || '2.18.258';
    const isDebugHost = CONFIG.DEBUG === true || (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname || ''));
    if (isDebugHost) {
      window.ToppreiseSuite = {
        processListings,
        processPriceAlarmModal,
        processProductDetailPage,
        updateConfig,
        openSettingsAt,
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
        // Live view on CONFIG (test harness mutates flags through it), with the
        // webhook masked: page JS reads '' and cannot overwrite the secret.
        CONFIG: new Proxy(CONFIG, {
          get: (t, k) => (k === 'DISCORD_WEBHOOK_URL' ? '' : Reflect.get(t, k)),
          set: (t, k, v) => (k === 'DISCORD_WEBHOOK_URL' ? true : Reflect.set(t, k, v)),
          getOwnPropertyDescriptor: (t, k) => { const d = Reflect.getOwnPropertyDescriptor(t, k); return (d && k === 'DISCORD_WEBHOOK_URL') ? { ...d, value: '' } : d; },
          defineProperty: (t, k, desc) => (k === 'DISCORD_WEBHOOK_URL' ? true : Reflect.defineProperty(t, k, desc)),
          deleteProperty: (t, k) => (k === 'DISCORD_WEBHOOK_URL' ? true : Reflect.deleteProperty(t, k)),
        }),
        memoryCache,
        statsKey
      };
    } else {
      // Production: frozen minimal handle. processListings stays — async
      // re-renders fall through to window.ToppreiseSuite.processListings.
      window.ToppreiseSuite = Object.freeze({
        version: suiteVersion,
        processListings,
        snapshot: () => ({
          checkedCount: scanState.progress.completed,
          queueLength: Math.max(0, scanState.progress.total - scanState.progress.completed),
          shippingActive: (() => { try { return isShippingPriceActive(); } catch { return false; } })()
        })
      });
    }
  }
})();
