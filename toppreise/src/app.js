import { STYLES } from './ui/styles.js';
import {
  parsePrice,
  analyzePriceTimeSeries
} from './domain/price.js';
import { computeDealScore } from './domain/deal-score.js';
import { memoryCache, statsKey } from './scanner/cache.js';
import {
  getProductCards,
  parseNegativeTerms,
  extractCardData,
  extractActiveStores,
  getCardDealerRows,
  applyCardFilters,
  isCardFilteredOut,
  dealerLoserFor,
  scanEligibility,
  scanCandidateState
} from './page/cards.js';
import {
  isShippingPriceActive,
  isNeueToppreisePage,
  isSearchPage,
  isProductDetailPage,
  clearCardCache,
  triggerProcessListings
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
import { showToast, getLastToastMessage } from './ui/toast.js';
import { uiShadowRoot } from './ui/shell.js';
import {
  CONFIG,
  SECRET_KEYS,
  saveConfigKey,
  updateConfig,
  updateBodyClasses,
  migrateFilterSplit,
  realDealMinDiscount
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
// @version      2.18.367
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
// @connect      api.tavily.com
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
      if (cards.length === 0) { try { applySorting([], false, []); } catch {} dismissChrome(); return; }

      // --- Extract ---
      const activeStores = extractActiveStores();
      const termsList = parseNegativeTerms();
      const isNeueFeed = isNeueToppreisePage();
      const isSortPage = isNeueFeed || isSearchPage();
      const minDealDiscount = realDealMinDiscount();
      const cardDataList = cards.map(extractCardData);

      // --- Filter ---
      const counts = { neg: 0, min: 0, dealDisc: 0, price: 0, savings: 0, uncheckedDeals: 0, unavailableDeals: 0, bestpreiseDeals: 0, vortief: 0, uncheckedHidden: 0, dealer: 0, dealerActive: activeStores.length > 0, filteredCount: 0, dimmed: 0 };
      const pageHasOffers = cardDataList.some(cd => cd.offerCount > 0);

      for (const cd of cardDataList) {
        cd.filters = applyCardFilters(cd, termsList, CONFIG.MIN_OFFERS, pageHasOffers, isNeueFeed);
        // Dealer verdict before counting: scanner and counter must agree.
        cd.filters.isDealerLoser = dealerLoserFor(cd.card, activeStores);
        // Scan bucket from the shared resolver: fresh unavailable markers
        // wait out the negative TTL (counted aside, CTA ignores them).
        const elig = scanCandidateState(cd, { isFeed: isNeueFeed, minDiscount: minDealDiscount });
        if (elig?.canScan) counts.uncheckedDeals++;
        else if (elig?.state === 'unavailable') counts.unavailableDeals++;
        // Verified markups are removed nowhere, so counted nowhere.
        // (No recompute here: extractCardData already scored with identical inputs.)
        if (cd.dealScore) counts.bestpreiseDeals++;
        else if ((cd.displayDelta?.kind === 'at-low' || cd.displayDelta?.kind === 'new-low') && CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false) counts.bestpreiseDeals++;
      }

      // --- Render ---
      for (const cd of cardDataList) {
        renderCardEffects(cd, cd.filters, isNeueFeed, activeStores);
        if (cd.filters.isDimmed) counts.dimmed++;
        if (cd.filters.isHighlighted) counts.highlighted = (counts.highlighted || 0) + 1;
        if (cd.filters.isFiltered) counts.filteredCount++;
        if (cd.filters.isNeg) counts.neg++;
        if (cd.filters.isLowOffers) counts.min++;
        if (cd.filters.isBelowMinDiscount) counts.dealDisc++;
        if (cd.filters.isOutOfPriceRange) counts.price++;
        if (cd.filters.isBelowMinSavings) counts.savings++;
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
  const OBSERVE_OPTS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'href', 'data-entity-id', 'data-tp-product-id', 'data-current_url', 'data-current-url'] };
  const TP_OWNED_SEL = '#tp-root,#tp-suite-filter-bar,#tp-floating-check-cta,#tp-sparkline-popout,#tp-empty-state-notice,.tp-injected-badge,.tp-best-price-badge,.tp-card-subline-row,.tp-sparkline-container,.tp-card-historical-price,.tp-share-btn,.tp-dealer-name,.tp-review-search-btn,#tp-detail-deal-badge,.tp-alarm-cog,.tp-alarm-status,[data-tp-alarm-state]';
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
    // Outside cards the interesting changes are text/attribute swaps (detail
    // price, alarm controls, active filters, route attrs) — records without
    // added/removed nodes. OBSERVE_OPTS.attributeFilter stays tight on purpose.
    const NON_CARD_SEL = '.Plugin_ProductHeading, .productHeading, .product_title, h1, .priceContainer, .Plugin_Price, .Plugin_NewInfoMailForm, .AbstractDialog, .Plugin_NewInfoMailButton, .filters, .f_remove_filter, [data-tp-product-id]';
    const checkNode = node => {
      if (!node) return false;
      if (node.nodeType === 3) node = node.parentElement;
      if (!node || node.nodeType !== 1) return false;
      if (isOwnedNode(node)) return false;
      if (node.id === 'tp-root' || node.id === 'tp-suite-filter-bar' || node.id === 'tp-empty-state-notice' || node.id === 'tp-floating-check-cta') return false;
      if (node.classList?.contains('tp-card-subline-row') ||
          node.classList?.contains('tp-sparkline-container') ||
          node.classList?.contains('tp-best-price-badge') ||
          node.classList?.contains('tp-empty-state-notice')) {
        return false;
      }
      return node.matches?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading, .Plugin_Price, .priceContainer, .Plugin_NewInfoMailButton, .filters, .f_remove_filter') ||
             !!node.querySelector?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading, .Plugin_Price, .priceContainer, .Plugin_NewInfoMailButton, .filters, .f_remove_filter');
    };

    for (const m of mutations) {
      // Route-attribute swap on body matches no card selector: handle
      // explicitly so SPA navigation always schedules a pass.
      if (m.type === 'attributes' && (m.attributeName === 'data-current_url' || m.attributeName === 'data-current-url')) structural = true;
      const target = m.target;
      if (!target) continue;
      const targetEl = target.nodeType === 1 ? target : target.parentElement;
      // In-card host mutation (price text/attribute swap, node replacement):
      // invalidate the card memo so re-render rebuilds instead of repainting stale data.
      const hit = cardOf(targetEl);
      if (hit) {
        if ((m.type === 'attributes' || m.type === 'characterData') && isOwnedNode(targetEl)) continue;
        // All-changes-owned skips only pure self-paint: a mixed record (own
        // badge plus a genuine host replacement) still invalidates, or the
        // host update is lost with the badge.
        const changes = [...m.addedNodes, ...m.removedNodes].filter(n => n?.nodeType === 1);
        if (changes.length > 0 && changes.every(isOwnedNode)) continue;
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
      // Attribute/characterData records carry no added/removed nodes: match
      // the target itself so detail-price text swaps, alarm controls,
      // active-filter changes and route-attribute swaps schedule a pass.
      // childList targets cover textContent writes and price-element
      // replacement where the container itself is the mutation target.
      if (!structural && targetEl && (m.type === 'childList' || m.type === 'characterData' || m.type === 'attributes')) {
        if (!isOwnedNode(targetEl) && (targetEl.matches?.(NON_CARD_SEL) || targetEl.closest?.(NON_CARD_SEL))) structural = true;
      }
      if (dirtyCard && structural) break;
    }

    if (!dirtyCard && !structural) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      triggerProcessListings();
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
    cancelBatchDealCheck();
    getProductCards().forEach(clearCardCache);
    triggerProcessListings();
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

  function handleRouteTransition() {
    cancelBatchDealCheck();
    clearDealerAutoTried();
    triggerProcessListings();
  }
  if (self.navigation?.addEventListener) {
    self.navigation.addEventListener('navigatesuccess', handleRouteTransition);
  }
  window.addEventListener('popstate', handleRouteTransition);
  window.addEventListener('hashchange', handleRouteTransition);

  setupUI();
  triggerProcessListings();

  if (typeof window !== 'undefined') {
    const suiteVersion = (typeof GM_info !== 'undefined' && GM_info?.script?.version) || '2.18.367';
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
        // secrets masked: page JS reads '' and cannot overwrite secrets.
        CONFIG: new Proxy(CONFIG, {
          get: (t, k) => (SECRET_KEYS.has(k) ? '' : Reflect.get(t, k)),
          set: (t, k, v) => (SECRET_KEYS.has(k) ? true : Reflect.set(t, k, v)),
          getOwnPropertyDescriptor: (t, k) => { const d = Reflect.getOwnPropertyDescriptor(t, k); return (d && SECRET_KEYS.has(k)) ? { ...d, value: '' } : d; },
          defineProperty: (t, k, desc) => (SECRET_KEYS.has(k) ? true : Reflect.defineProperty(t, k, desc)),
          deleteProperty: (t, k) => (SECRET_KEYS.has(k) ? true : Reflect.deleteProperty(t, k)),
        }),
        memoryCache,
        statsKey,
        showToast,
        lastToast: getLastToastMessage
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
