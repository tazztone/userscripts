import { STYLES, SHADOW_MODAL_STYLES } from './ui/styles.js';
import { SELECTORS } from './page/selectors.js';
import {
  parsePrice,
  priceToCents,
  extractCanonicalPrice,
  parsePriceStatsFromHtml,
  sanitizeTimeSeries,
  analyzePriceTimeSeries
} from './domain/price.js';
import {
  getDealState,
  computeDealScore
} from './domain/deal-score.js';
import {
  STATS_CACHE_PREFIX,
  MAX_MEMORY_CACHE_ITEMS,
  memoryCache,
  isCacheEntryFresh,
  prunePriceStatsCache,
  getCachedPriceStats,
  setCachedPriceStats,
  countCachedPriceStats,
  getCachedProductCount,
  clearPriceStatsCache
} from './scanner/cache.js';
import {
  ROOT_SLUG_MAP,
  GROUP_EMOJIS,
  getGroupEmoji,
  normalizeName,
  normalizeRootSlug,
  extractCategoryDisplay,
  BRAND_RULES,
  resolveCategoryGroup,
  isPathExcluded
} from './domain/category.js';
import {
  getCardDealerRows,
  getProductCards,
  formatCategorySlug,
  getCardHrefs,
  extractCardCategory,
  extractOfferCount,
  getCardProductId,
  matchesNegativeTerms,
  extractCardDiscount,
  getHeatmapStyles,
  extractActiveStores,
  parseNegativeTerms,
  extractCardData,
  getCardSortableUnit
} from './page/cards.js';
import { showToast } from './ui/toast.js';
import { getSuiteBarPlacement, renderSuiteFilterBar } from './ui/toolbar.js';
import { uiShadowRoot, ensureSkeleton, setupUI } from './ui/modal.js';

// ==UserScript==
// @name         Toppreise.ch Suite: Power Filter & Price Alarm Auto-Filler
// @namespace    https://github.com/tazztone/scripts
// @version      2.18.39
// @description  All-in-one suite for Toppreise.ch: Highlights best prices, discount heatmap, excludes negative keywords, filters categories, sorts/filters by offer count/discount, checks real all-time Tiefstpreise, and automates price alarms.
// @author       tazztone
// @match        https://www.toppreise.ch/*
// @updateURL    https://raw.githubusercontent.com/tazztone/scripts/main/userscripts/toppreise/toppreise.user.js
// @downloadURL  https://raw.githubusercontent.com/tazztone/scripts/main/userscripts/toppreise/toppreise.user.js
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @noframes
// ==/UserScript==

// ─── CONFIG DEFAULT VALUES ───────────────────────────────────────────────────
const DEFAULTS = {
  FILTER_NEG_ENABLED: true,
  FILTER_CAT_ENABLED: true,
  FILTER_MIN_ENABLED: true,
  FILTER_BESTPREIS_ENABLED: true,
  MODE: 'dim',
  MARGIN_PERCENT: 0.0,
  DIM_OPACITY: 0.25,
  USE_SHIPPING_PRICE: true,
  HEATMAP_ENABLED: true,
  HEATMAP_INTENSITY: 1.0,
  HEATMAP_CURVE: 'calibrated',
  REAL_DEAL_FILTER_ACTIVE: false,
  REAL_DEAL_MIN_DISCOUNT: 30,
  REAL_DEAL_CACHE_HOURS: 48,
  NEGATIVE_CACHE_HOURS: 2,
  BESTPREISE_MODE_ACTIVE: false,
  BESTPREISE_WEIGHT_RECORD: 0.50,
  BESTPREISE_MEDIAN_HORIZON_DAYS: 365,
  OUTLIER_REJECTION_ENABLED: true,
  ENABLE_SPARKLINES: false,
  NEGATIVE_TERMS: '',
  EXCLUDED_CATEGORIES: [],
  MIN_OFFERS: 0,
  SORT_BY_OFFERS: 'none',
  ALARM_ENABLED: true,
  ALARM_TARGET_PERCENT: 0.60,
  ALARM_DURATION_DAYS: "730",
  ALARM_AUTO_SUBMIT: true,
  ALARM_SUBMIT_DELAY_MS: 300,
  ALARM_CLOSE_DELAY_MS: 800,
  OBSERVER_DEBOUNCE_MS: 200,
  DEBUG: true
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
(() => {
  'use strict';

  // Compact GM_getValue + localStorage Fallback
  const _getValue = (k, def) => (typeof GM_getValue !== 'undefined' ? GM_getValue(k, def) : JSON.parse(localStorage.getItem('tp_suite_v2_' + k) ?? 'null')) ?? def;
  const _setValue = (k, v) => (typeof GM_setValue !== 'undefined' ? GM_setValue(k, v) : localStorage.setItem('tp_suite_v2_' + k, JSON.stringify(v)));

  const CONFIG = {
    FILTER_NEG_ENABLED: _getValue('FILTER_NEG_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_NEG_ENABLED)),
    FILTER_CAT_ENABLED: _getValue('FILTER_CAT_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_CAT_ENABLED)),
    FILTER_MIN_ENABLED: _getValue('FILTER_MIN_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_MIN_ENABLED)),
    FILTER_BESTPREIS_ENABLED: _getValue('FILTER_BESTPREIS_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_BESTPREIS_ENABLED)),
    MODE: _getValue('MODE', DEFAULTS.MODE),
    MARGIN_PERCENT: parseFloat(_getValue('MARGIN_PERCENT', DEFAULTS.MARGIN_PERCENT)),
    DIM_OPACITY: parseFloat(_getValue('DIM_OPACITY', DEFAULTS.DIM_OPACITY)),
    USE_SHIPPING_PRICE: _getValue('USE_SHIPPING_PRICE', DEFAULTS.USE_SHIPPING_PRICE),
    HEATMAP_ENABLED: _getValue('HEATMAP_ENABLED', DEFAULTS.HEATMAP_ENABLED),
    HEATMAP_INTENSITY: parseFloat(_getValue('HEATMAP_INTENSITY', DEFAULTS.HEATMAP_INTENSITY)),
    HEATMAP_CURVE: _getValue('HEATMAP_CURVE', DEFAULTS.HEATMAP_CURVE),
    REAL_DEAL_FILTER_ACTIVE: _getValue('REAL_DEAL_FILTER_ACTIVE', DEFAULTS.REAL_DEAL_FILTER_ACTIVE),
    REAL_DEAL_MIN_DISCOUNT: parseInt(_getValue('REAL_DEAL_MIN_DISCOUNT', DEFAULTS.REAL_DEAL_MIN_DISCOUNT)),
    BESTPREISE_MODE_ACTIVE: _getValue('BESTPREISE_MODE_ACTIVE', DEFAULTS.BESTPREISE_MODE_ACTIVE),
    BESTPREISE_WEIGHT_RECORD: parseFloat(_getValue('BESTPREISE_WEIGHT_RECORD', DEFAULTS.BESTPREISE_WEIGHT_RECORD)),
    ENABLE_SPARKLINES: _getValue('ENABLE_SPARKLINES', DEFAULTS.ENABLE_SPARKLINES),
    NEGATIVE_TERMS: _getValue('NEGATIVE_TERMS', DEFAULTS.NEGATIVE_TERMS),
    EXCLUDED_CATEGORIES: _getValue('EXCLUDED_CATEGORIES', DEFAULTS.EXCLUDED_CATEGORIES),
    MIN_OFFERS: parseInt(_getValue('MIN_OFFERS', DEFAULTS.MIN_OFFERS)),
    SORT_BY_OFFERS: _getValue('SORT_BY_OFFERS', DEFAULTS.SORT_BY_OFFERS),
    ALARM_ENABLED: _getValue('ALARM_ENABLED', DEFAULTS.ALARM_ENABLED),
    ALARM_TARGET_PERCENT: parseFloat(_getValue('ALARM_TARGET_PERCENT', DEFAULTS.ALARM_TARGET_PERCENT)),
    ALARM_DURATION_DAYS: String(_getValue('ALARM_DURATION_DAYS', DEFAULTS.ALARM_DURATION_DAYS)),
    ALARM_AUTO_SUBMIT: _getValue('ALARM_AUTO_SUBMIT', DEFAULTS.ALARM_AUTO_SUBMIT),
    ALARM_SUBMIT_DELAY_MS: parseInt(_getValue('ALARM_SUBMIT_DELAY_MS', DEFAULTS.ALARM_SUBMIT_DELAY_MS)),
    ALARM_CLOSE_DELAY_MS: parseInt(_getValue('ALARM_CLOSE_DELAY_MS', DEFAULTS.ALARM_CLOSE_DELAY_MS)),
    OBSERVER_DEBOUNCE_MS: parseInt(_getValue('OBSERVER_DEBOUNCE_MS', DEFAULTS.OBSERVER_DEBOUNCE_MS)),
    DEBUG: _getValue('DEBUG', DEFAULTS.DEBUG)
  };


  const saveConfigKey = (key, val) => {
    CONFIG[key] = val;
    _setValue(key, val);
  };

  const CONFIG_BODY_KEYS = new Set(['MODE', 'DIM_OPACITY']);

  function syncUiControl(key, val) {
    // 1. Sync Settings Modal (Shadow DOM) if open/exists
    if (uiShadowRoot) {
      try {
        switch (key) {
          case 'MODE': {
            const el = uiShadowRoot.querySelector(`input[name="tp-mode"][value="${val}"]`);
            if (el) el.checked = true;
            break;
          }
          case 'DIM_OPACITY': {
            const range = uiShadowRoot.getElementById('tp-opacity-range');
            const label = uiShadowRoot.getElementById('tp-opacity-val');
            if (range) range.value = val;
            if (label) label.textContent = `${Math.round(val * 100)}%`;
            break;
          }
          case 'NEGATIVE_TERMS': {
            const input = uiShadowRoot.getElementById('tp-negative-terms-input');
            if (input && input.value !== val) input.value = val || '';
            break;
          }
          case 'MIN_OFFERS': {
            const input = uiShadowRoot.getElementById('tp-min-offers-val');
            const range = uiShadowRoot.getElementById('tp-min-offers-range');
            if (input) input.value = val;
            if (range) range.value = val;
            break;
          }
          case 'HEATMAP_ENABLED': {
            const toggle = uiShadowRoot.getElementById('tp-heatmap-enabled-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'BESTPREISE_MODE_ACTIVE': {
            const toggle = uiShadowRoot.getElementById('tp-bestpreise-mode-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'BESTPREISE_WEIGHT_RECORD': {
            const range = uiShadowRoot.getElementById('tp-bestpreise-weight-range');
            const valEl = uiShadowRoot.getElementById('tp-bestpreise-weight-val');
            const descEl = uiShadowRoot.getElementById('tp-bestpreise-weight-desc');
            const pct = Math.round((val ?? 0.5) * 100);
            if (range) range.value = pct;
            if (valEl) valEl.textContent = `${pct}%`;
            if (descEl) {
              if (pct === 100) descEl.textContent = 'Nur Rekorde (100% Rekord / 0% Median)';
              else if (pct === 0) descEl.textContent = 'Nur Marktpreis (0% Rekord / 100% Median)';
              else descEl.textContent = `${pct}% Rekord / ${100 - pct}% Median`;
            }
            break;
          }
          case 'REAL_DEAL_MIN_DISCOUNT': {
            const range = uiShadowRoot.getElementById('tp-real-deal-min-range');
            const valEl = uiShadowRoot.getElementById('tp-real-deal-min-val');
            if (range) range.value = val;
            if (valEl) valEl.value = val;
            break;
          }
          case 'REAL_DEAL_FILTER_ACTIVE': {
            const toggle = uiShadowRoot.getElementById('tp-real-deal-filter-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'USE_SHIPPING_PRICE': {
            const toggle = uiShadowRoot.getElementById('tp-use-shipping-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'ENABLE_SPARKLINES': {
            const toggle = uiShadowRoot.getElementById('tp-sparklines-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
        }
      } catch (err) {
        if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] syncUiControl error', err);
      }
    }

    // 2. Sync Inline Filter Bar if present
    const bar = document.getElementById('tp-suite-filter-bar') || document.getElementById('tp-inline-filter-bar');
    if (bar) {
      try {
        switch (key) {
          case 'NEGATIVE_TERMS': {
            const input = bar.querySelector('#tp-inline-negative-input');
            const clearBtn = bar.querySelector('#tp-clear-neg-btn');
            if (input && document.activeElement !== input && input.value !== val) {
              input.value = val || '';
            }
            if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
            break;
          }
          case 'HEATMAP_ENABLED': {
            const heatBtn = bar.querySelector('#tp-bar-heat-btn');
            if (heatBtn) heatBtn.classList.toggle('tp-active', val !== false);
            break;
          }
          case 'BESTPREISE_MODE_ACTIVE': {
            const bpBtn = bar.querySelector('#tp-bar-bestpreise-btn');
            if (bpBtn) bpBtn.classList.toggle('tp-bestpreise-active', val === true);
            bar.classList.toggle('tp-bestpreise-bar', val === true);
            break;
          }
          case 'FILTER_NEG_ENABLED': {
            const toggle = bar.querySelector('#tp-toggle-neg');
            if (toggle) {
              toggle.classList.toggle('tp-active', !!val);
              toggle.classList.toggle('tp-filter-off', !val);
              toggle.title = `Negativ-Filter (Text) ${val ? 'AN' : 'AUS'}`;
            }
            break;
          }
          case 'FILTER_CAT_ENABLED': {
            const toggle = bar.querySelector('#tp-toggle-cat');
            if (toggle) {
              toggle.classList.toggle('tp-active', !!val);
              toggle.classList.toggle('tp-filter-off', !val);
              toggle.title = `Kategorien-Filter ${val ? 'AN' : 'AUS'}`;
            }
            break;
          }
          case 'FILTER_MIN_ENABLED': {
            const toggle = bar.querySelector('#tp-toggle-min');
            if (toggle) {
              toggle.classList.toggle('tp-active', !!val);
              toggle.classList.toggle('tp-filter-off', !val);
              toggle.title = `Min-Angebote-Filter ${val ? 'AN' : 'AUS'}`;
            }
            break;
          }
          case 'FILTER_BESTPREIS_ENABLED': {
            const toggle = bar.querySelector('#tp-toggle-bestpreis');
            if (toggle) {
              toggle.classList.toggle('tp-active', !!val);
              toggle.classList.toggle('tp-filter-off', !val);
              toggle.title = `Deal-Filter ${val ? 'AN' : 'AUS'}`;
            }
            break;
          }
          case 'MIN_OFFERS': {
            const minVal = bar.querySelector('#tp-bar-min-val');
            if (minVal) minVal.textContent = val;
            break;
          }
          case 'REAL_DEAL_MIN_DISCOUNT': {
            const threshBtn = bar.querySelector('#tp-bar-threshold-btn');
            if (threshBtn) threshBtn.textContent = `≥${val}% ▾`;
            bar.querySelectorAll('#tp-threshold-popover .tp-threshold-option').forEach(btn => {
              btn.classList.toggle('tp-selected', parseInt(btn.dataset.val, 10) === val);
            });
            break;
          }
          case 'EXCLUDED_CATEGORIES': {
            const catsCount = bar.querySelector('#tp-bar-cats-count');
            const catsToggle = bar.querySelector('#tp-bar-cats-toggle');
            const count = (val || []).length;
            if (catsCount) catsCount.textContent = count;
            if (catsToggle) catsToggle.style.display = count > 0 ? 'flex' : 'none';
            break;
          }
        }
      } catch (err) {
        if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] syncUiControl bar error', err);
      }
    }
  }

  function updateConfig(key, val, options = {}) {
    saveConfigKey(key, val);
    if (!options.skipUiSync) {
      syncUiControl(key, val);
    }
    if (CONFIG_BODY_KEYS.has(key)) {
      updateBodyClasses();
    }
    if (!options.skipRender) {
      processListings();
    }
  }

  function updateConfigs(entries, options = {}) {
    let requiresBodyUpdate = false;
    for (const [k, v] of Object.entries(entries)) {
      saveConfigKey(k, v);
      if (!options.skipUiSync) {
        syncUiControl(k, v);
      }
      if (CONFIG_BODY_KEYS.has(k)) {
        requiresBodyUpdate = true;
      }
    }
    if (requiresBodyUpdate) {
      updateBodyClasses();
    }
    if (!options.skipRender) {
      processListings();
    }
  }

  // ─── DOM QUERY MEMOIZATION ──────────────────────────────────────────────────

  function clearCardCache(card) {
    if (!card) return;
    delete card._tpDealerRows;
    delete card._tpTextLower;
    delete card._tpPriceInfo;
  }

  const log = (...args) => { if (CONFIG.DEBUG) console.log('[Toppreise-Suite]', ...args); };

  if (!document.getElementById('tp-unified-settings-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'tp-unified-settings-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  let isBlockedCatsOpen = false;

  function updateBodyClasses() {
    document.body.classList.remove('tp-mode-dim', 'tp-mode-hide', 'tp-mode-highlight-only');
    document.body.classList.add(`tp-mode-${CONFIG.MODE}`);
    document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
  }
  updateBodyClasses();




  function isShippingPriceActive(card = null) {
    if (!CONFIG.USE_SHIPPING_PRICE) return false;
    if (typeof document !== 'undefined' && document.body) {
      if (document.body.classList.contains('showproductprice')) return false;
      if (document.body.classList.contains('showshippingprice')) return true;
    }
    if (card) {
      const shp = card._tpPriceInfo?.mainShipping || card._tpPriceInfo?.fallbackShipping || card.querySelector?.('.priceContainer.shippingPrice');
      const prd = card._tpPriceInfo?.mainProduct || card._tpPriceInfo?.fallbackProduct || card.querySelector?.('.priceContainer.productPrice');
      if (shp && prd) {
        const shpContainer = shp.closest ? shp.closest('.shippingPrice') : null;
        if (shpContainer && (shpContainer.offsetParent === null || shpContainer.style.display === 'none')) {
          return false;
        }
      }
    }
    return true;
  }

  // ─── REAL DEAL & PRICE HISTORY ENGINE ───────────────────────────────────────

  async function fetchPriceTimeSeries(productId) {
    if (!productId) return null;
    try {
      const baseUrl = (location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const postBody = `pcspagdpi=${encodeURIComponent(productId)}&pcspagdfdt=0000-00-00&pcspagdtd=&p_pc_ch=&lang=de`;
      const res = await fetch(`${baseUrl}/plugins/product/pricechart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        credentials: 'same-origin',
        body: postBody,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data)) {
        // If 2D array of series [[series0], [series1]]
        if (Array.isArray(data[0]) && data[0].length > 0 && Array.isArray(data[0][0])) {
          // If shipping price is active and the shipping series exists, use it
          if (isShippingPriceActive() && data.length > 1 && Array.isArray(data[1]) && data[1].length > 0 && Array.isArray(data[1][0])) {
            return data[1];
          }
          return data[0]; // Series 0: Produktpreis
        }
        if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
          return data; // Raw points [[t1, p1], [t2, p2]]
        }
      }
      if (Array.isArray(data?.series)) return data.series;
      if (Array.isArray(data?.data)) return data.data;
      return null;
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching time series for product', productId, err);
      return null;
    }
  }

  const activeFetches = new Map();

  async function interruptibleSleep(ms, shouldCancelFn = null) {
    const step = 100;
    let elapsed = 0;
    while (elapsed < ms) {
      if (shouldCancelFn && shouldCancelFn()) break;
      const wait = Math.min(step, ms - elapsed);
      await new Promise(r => setTimeout(r, wait));
      elapsed += wait;
    }
  }

  async function fetchSingleProductPriceStats(productId, retries = 1, forceFresh = false, onThrottle = null, shouldCancelFn = null) {
    if (!productId) return null;
    const cached = getCachedPriceStats(productId, forceFresh);
    if (cached) {
      if (cached.unavailable) return null;
      return cached;
    }

    if (activeFetches.has(productId)) {
      return activeFetches.get(productId);
    }

    const fetchPromise = (async () => {
      try {
        const baseUrl = (location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
        
        // 1. Primary fast route: POST JSON time-series (gives series + all aggregates in 1 request)
        try {
          const timeSeries = await fetchPriceTimeSeries(productId);
          if (timeSeries && Array.isArray(timeSeries) && timeSeries.length >= 1) {
            const analysis = analyzePriceTimeSeries(timeSeries);
            if (analysis && analysis.tiefstpreis > 0) {
              analysis.isShippingPrice = isShippingPriceActive();
              setCachedPriceStats(productId, analysis);
              return analysis;
            }
          }
        } catch (seriesErr) {}

        // 2. Fallback route: GET HTML modal dialog
        const url = `${baseUrl}/plugins/product/pricechart?p_pc_pid=${encodeURIComponent(productId)}`;
        let resHtml = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
          if (shouldCancelFn && shouldCancelFn()) return null;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);
            resHtml = await fetch(url, {
              headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'text/html, */*; q=0.01'
              },
              credentials: 'same-origin',
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (resHtml.ok) break;

            if (resHtml.status === 429) {
              const retryAfterHeader = resHtml.headers?.get('Retry-After');
              const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
              const backoffMs = (retryAfterSec && !isNaN(retryAfterSec)) ? retryAfterSec * 1000 : (1500 + attempt * 1000);
              if (onThrottle) {
                onThrottle({ productId, attempt, backoffMs, status: resHtml.status });
              }
              if (attempt < retries) {
                await interruptibleSleep(backoffMs, shouldCancelFn);
              }
            } else if (attempt < retries) {
              await interruptibleSleep(400 + attempt * 400, shouldCancelFn);
            }
          } catch (fetchErr) {
            if (attempt < retries) {
              await interruptibleSleep(400 + attempt * 400, shouldCancelFn);
            } else {
              throw fetchErr;
            }
          }
        }

        if (!resHtml || !resHtml.ok) {
          setCachedPriceStats(productId, null, true);
          return null;
        }
        const html = await resHtml.text();
        const stats = parsePriceStatsFromHtml(html);
        if (stats) {
          stats.isShippingPrice = isShippingPriceActive();
          setCachedPriceStats(productId, stats);
          return stats;
        } else {
          setCachedPriceStats(productId, null, true);
        }
      } catch (err) {
        if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching price stats for product', productId, err);
        setCachedPriceStats(productId, null, true);
      } finally {
        activeFetches.delete(productId);
      }
      return null;
    })();

    activeFetches.set(productId, fetchPromise);
    return fetchPromise;
  }

  let currentlyScanningPid = null;

  async function runProductScanner(options = {}) {
    const {
      filterFn = () => true,
      sortFn = null,
      delayMs = 200,
      shouldCancelFn = () => false,
      onProgress = null,
      onComplete = null,
      onStatus = null
    } = options;

    const cards = getProductCards();
    const targets = [];

    for (const card of cards) {
      const pid = getCardProductId(card);
      if (!pid) continue;
      const cached = getCachedPriceStats(pid);
      if (cached) continue;
      if (isCardIgnoredOrInvisible(card)) continue;
      const discount = extractCardDiscount(card) ?? 0;
      if (filterFn({ pid, card, discount })) {
        targets.push({ pid, card, discount });
      }
    }

    if (sortFn) {
      targets.sort(sortFn);
    }

    const total = targets.length;
    let completed = 0;

    try {
      for (let i = 0; i < targets.length; i++) {
        if (shouldCancelFn()) break;
        const item = targets[i];
        currentlyScanningPid = item.pid;
        processListings();

        try {
          await fetchSingleProductPriceStats(
            item.pid,
            2,
            false,
            throttleInfo => {
              const secs = Math.ceil(throttleInfo.backoffMs / 1000);
              if (onStatus) {
                onStatus(`⏳ Rate-Limit (${secs}s Pause)...`);
              }
            },
            shouldCancelFn
          );
        } finally {
          currentlyScanningPid = null;
        }

        completed++;
        if (onProgress) onProgress(completed, total);
        processListings();
        const delay = typeof delayMs === 'function' ? delayMs() : delayMs;
        await interruptibleSleep(delay, shouldCancelFn);
      }
    } finally {
      currentlyScanningPid = null;
    }

    processListings();
    if (onComplete) onComplete(completed, total);
    return { completed, total };
  }

  let isBatchChecking = false;
  let batchCancelRequested = false;

  async function runBatchDealCheck(minDiscount = 30, onProgress = null, onComplete = null, onStatus = null) {
    if (isBatchChecking) {
      batchCancelRequested = true;
      return;
    }
    isBatchChecking = true;
    batchCancelRequested = false;

    try {
      const isFeed = isNeueToppreisePage();
      await runProductScanner({
        filterFn: item => isFeed ? (item.discount >= minDiscount) : true,
        delayMs: () => 250 + Math.floor(Math.random() * 100),
        shouldCancelFn: () => batchCancelRequested,
        onProgress,
        onComplete,
        onStatus
      });
    } finally {
      isBatchChecking = false;
      batchCancelRequested = false;
      processListings();
    }
  }

  function cancelBatchDealCheck() {
    batchCancelRequested = true;
  }

  let isBestpreiseScanning = false;
  let bestpreiseScanCancel = false;

  async function runBestpreiseScan(onProgress = null, onComplete = null) {
    if (isBestpreiseScanning) {
      bestpreiseScanCancel = true;
      return;
    }
    isBestpreiseScanning = true;
    bestpreiseScanCancel = false;

    try {
      await runProductScanner({
        filterFn: () => true,
        sortFn: (a, b) => b.discount - a.discount,
        delayMs: 200,
        shouldCancelFn: () => bestpreiseScanCancel || !CONFIG.BESTPREISE_MODE_ACTIVE,
        onProgress,
        onComplete
      });
    } finally {
      isBestpreiseScanning = false;
      bestpreiseScanCancel = false;
      processListings();
    }
  }

  function cancelBestpreiseScan() {
    bestpreiseScanCancel = true;
  }


  function isNeueToppreisePage() {
    if (document.body?.classList.contains('Page_Browsing') || document.body?.classList.contains('Page_ProductSearch')) {
      return false;
    }
    const currentUrl = document.body?.getAttribute('data-current_url') ?? document.body?.getAttribute('data-current-url');
    if (currentUrl !== undefined && currentUrl !== null) {
      if (/(?:produktsuche|katalog|search|suche)/i.test(currentUrl)) return false;
      if (/(?:neue-toppreise|new-best-prices|nouveaux-meilleurs-prix)/i.test(currentUrl)) return true;
    }
    return /(?:neue-toppreise|new-best-prices|nouveaux-meilleurs-prix)/i.test(location.href) ||
           document.body?.classList.contains('Page_ListTopPriceReductionProducts') ||
           document.body?.classList.contains('Page_ListTop100Products');
  }

  function getPageType() {
    if (isProductDetailPage()) return 'detail';
    if (isNeueToppreisePage()) return 'deal-feed';
    return 'list';
  }

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

  function renderSparkline(timeSeries, width = 60, height = 18) {
    if (!timeSeries || !Array.isArray(timeSeries) || timeSeries.length < 2) return null;
    const prices = timeSeries.map(p => {
      if (Array.isArray(p)) return typeof p[1] === 'number' ? p[1] : parsePrice(String(p[1]));
      if (typeof p === 'number') return p;
      if (p && typeof p.price === 'number') return p.price;
      if (p && p.price) return parsePrice(String(p.price));
      if (p && p.y) return typeof p.y === 'number' ? p.y : parsePrice(String(p.y));
      return 0;
    }).filter(p => p > 0);

    if (prices.length < 2) return null;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const padding = 2;
    const usableHeight = height - padding * 2;

    const points = prices.map((p, i) => {
      const x = ((i / (prices.length - 1)) * width).toFixed(1);
      const y = (height - padding - ((p - min) / range) * usableHeight).toFixed(1);
      return `${x},${y}`;
    }).join(' ');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.classList.add('tp-sparkline');

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const isTrendingDown = lastPrice <= firstPrice;
    const strokeColor = isTrendingDown ? '#10b981' : '#ef4444';

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', strokeColor);
    polyline.setAttribute('stroke-width', '1.5');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);

    svg.setAttribute('title', `Preisverlauf: CHF ${firstPrice.toFixed(2)} → CHF ${lastPrice.toFixed(2)} (Min: ${min.toFixed(2)}, Max: ${max.toFixed(2)})`);

    return svg;
  }

  function setHtmlIfChanged(el, newHtml) {
    if (el && el.innerHTML !== newHtml) {
      el.innerHTML = newHtml;
    }
  }

  function setTextIfChanged(el, newText) {
    if (el && el.textContent !== newText) {
      el.textContent = newText;
    }
  }

  function setTitleIfChanged(el, newTitle) {
    if (el && el.title !== newTitle) {
      el.title = newTitle;
    }
  }

  function renderCardEffects(cd, filters, isNeueFeed, activeStores) {
    const { card, pid, cardPriceEl, cardPrice, stats, isVerifiedNonBest, discountVal, catName, rootGroup } = cd;

    // 0. Heatmap (driven by Deal-Score when verified or in Bestpreise mode; in unverified feed mode, driven by feed discount)
    const effectiveHeatPercent = isVerifiedNonBest
      ? null
      : (cd.dealScore ? cd.dealScore.score : (CONFIG.BESTPREISE_MODE_ACTIVE ? null : discountVal));

    if (CONFIG.HEATMAP_ENABLED && effectiveHeatPercent !== null && effectiveHeatPercent > 0) {
      const heatKey = `${effectiveHeatPercent}_${CONFIG.HEATMAP_INTENSITY}_${CONFIG.HEATMAP_CURVE}`;
      if (card.dataset.tpAppliedHeat !== heatKey) {
        card.dataset.tpAppliedHeat = heatKey;
        const heatStyles = getHeatmapStyles(effectiveHeatPercent, CONFIG.HEATMAP_INTENSITY, CONFIG.HEATMAP_CURVE);
        card.style.setProperty('--tp-heat-bg', heatStyles.bg);
        card.style.setProperty('--tp-heat-border', heatStyles.border);
        card.style.setProperty('--tp-heat-glow', heatStyles.glow);

        // DarkReader Dynamic Theme compatibility:
        card.style.setProperty('--darkreader-inline-bgimage', heatStyles.bg);
        card.style.setProperty('--darkreader-inline-bgcolor', 'transparent');
        card.style.setProperty('--darkreader-inline-border', heatStyles.border);
        card.style.setProperty('--darkreader-inline-border-top', heatStyles.border);
        card.style.setProperty('--darkreader-inline-border-right', heatStyles.border);
        card.style.setProperty('--darkreader-inline-border-bottom', heatStyles.border);
        card.style.setProperty('--darkreader-inline-border-left', heatStyles.border);
        card.style.setProperty('background', heatStyles.bg, 'important');
        card.style.setProperty('background-image', heatStyles.bg, 'important');
        card.style.setProperty('background-color', 'transparent', 'important');
        card.style.setProperty('border-color', heatStyles.border, 'important');

        if (card.hasAttribute('data-darkreader-inline-bgcolor')) card.removeAttribute('data-darkreader-inline-bgcolor');
        if (card.hasAttribute('data-darkreader-inline-bgimage')) card.removeAttribute('data-darkreader-inline-bgimage');

        const subElements = card.querySelectorAll('.product-name, .productDetails, .price_information_product, .Plugin_PriceInformation, .f_product_info, .productDescription, .productDetailsDescription');
        for (let s = 0; s < subElements.length; s++) {
          const sub = subElements[s];
          if (sub.hasAttribute('data-darkreader-inline-bgcolor')) sub.removeAttribute('data-darkreader-inline-bgcolor');
          if (sub.hasAttribute('data-darkreader-inline-bgimage')) sub.removeAttribute('data-darkreader-inline-bgimage');
          sub.style.setProperty('background-color', 'transparent', 'important');
          sub.style.setProperty('background', 'transparent', 'important');
          sub.style.setProperty('--darkreader-inline-bgcolor', 'transparent');
          sub.style.setProperty('--darkreader-inline-bgimage', 'none');
        }

        card.classList.add('tp-heatmap-active');
      }
    } else if (card.dataset.tpAppliedHeat || card.classList.contains('tp-heatmap-active')) {
      delete card.dataset.tpAppliedHeat;
      card.classList.remove('tp-heatmap-active');
      card.style.removeProperty('--tp-heat-bg');
      card.style.removeProperty('--tp-heat-border');
      card.style.removeProperty('--tp-heat-glow');
      card.style.removeProperty('--darkreader-inline-bgimage');
      card.style.removeProperty('--darkreader-inline-bgcolor');
      card.style.removeProperty('--darkreader-inline-border');
      card.style.removeProperty('--darkreader-inline-border-top');
      card.style.removeProperty('--darkreader-inline-border-right');
      card.style.removeProperty('--darkreader-inline-border-bottom');
      card.style.removeProperty('--darkreader-inline-border-left');
      card.style.removeProperty('background');
      card.style.removeProperty('background-image');
      card.style.removeProperty('background-color');
      card.style.removeProperty('border-color');
    }

    // 1. Category extraction & Quick-block
    if (isNeueFeed) {
      if (catName && !card.querySelector('.tp-card-quick-block')) {
        const quickBlockBtn = document.createElement('button');
        quickBlockBtn.type = 'button';
        quickBlockBtn.className = 'tp-card-quick-block';
        quickBlockBtn.title = `Kategorie "${catName}" (${rootGroup}) ausblenden`;
        quickBlockBtn.textContent = '🚫 ';
        const catSpan = document.createElement('span');
        catSpan.textContent = catName;
        quickBlockBtn.appendChild(catSpan);
        quickBlockBtn.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const curr = CONFIG.EXCLUDED_CATEGORIES || [];
          const key = `PATH:${rootGroup}/${catName}`;
          if (!curr.includes(key) && !curr.includes(catName)) {
            isBlockedCatsOpen = true;
            updateConfig('EXCLUDED_CATEGORIES', [...curr, key]);
            showToast(`Kategorie "${catName}" ausgeblendet`, 4000, 'Rückgängig', () => {
              updateConfig('EXCLUDED_CATEGORIES', (CONFIG.EXCLUDED_CATEGORIES || []).filter(c => c !== key && c !== catName));
              showToast(`Kategorie "${catName}" wieder eingeblendet`);
            });
          }
        };
        card.appendChild(quickBlockBtn);
      }
    } else {
      card.querySelector('.tp-card-quick-block')?.remove();
    }

    // 2. Filters
    card.classList.toggle('tp-negative-filtered', filters.isNeg);
    card.classList.toggle('tp-category-filtered', filters.isCatExcluded);
    card.classList.toggle('tp-min-offers-filtered', filters.isLowOffers);

    // 3. Best Price Highlighting
    const dealerRows = activeStores.length > 0 ? getCardDealerRows(card) : [];
    if (activeStores.length === 0 || (!isNeueFeed && dealerRows.length === 0)) {
      card.classList.remove('tp-is-cheapest', 'tp-not-cheapest', 'tp-no-store-offer');
      card.querySelector('.tp-best-price-badge')?.remove();
    } else {
      let matchedRow = null;
      for (let d = 0; d < dealerRows.length; d++) {
        const item = dealerRows[d];
        if (item.storeName && activeStores.some(store => item.storeName.includes(store) || store.includes(item.storeName))) {
          matchedRow = item.row;
          break;
        }
      }

      if (matchedRow) {
        const useShipping = isShippingPriceActive(card);
        const storePriceEl = useShipping
          ? (matchedRow.querySelector('.shippingPrice .Plugin_Price') || matchedRow.querySelector('.productPrice .Plugin_Price'))
          : (matchedRow.querySelector('.productPrice .Plugin_Price') || matchedRow.querySelector('.shippingPrice .Plugin_Price'));
        const storePrice = storePriceEl ? parsePrice(storePriceEl.textContent) : 0;
        const bestPrice = cardPrice > 0 ? cardPrice : (cardPriceEl ? parsePrice(cardPriceEl.textContent) : 0);

        if (storePrice > 0 && bestPrice > 0 && storePrice <= bestPrice * (1 + CONFIG.MARGIN_PERCENT / 100)) {
          card.classList.add('tp-is-cheapest');
          card.classList.remove('tp-not-cheapest', 'tp-no-store-offer');
          if (!card.querySelector('.tp-best-price-badge')) {
            const badge = document.createElement('div');
            badge.className = 'tp-best-price-badge';
            badge.textContent = 'Best Price';
            card.appendChild(badge);
          }
        } else {
          card.classList.add(storePrice > 0 && bestPrice > 0 ? 'tp-not-cheapest' : 'tp-no-store-offer');
          card.classList.remove('tp-is-cheapest', storePrice > 0 && bestPrice > 0 ? 'tp-no-store-offer' : 'tp-not-cheapest');
          card.querySelector('.tp-best-price-badge')?.remove();
        }
      } else {
        card.classList.add('tp-no-store-offer');
        card.classList.remove('tp-is-cheapest', 'tp-not-cheapest');
        card.querySelector('.tp-best-price-badge')?.remove();
      }
    }

    // 3.5 Real Deal & Allzeit-Tiefstpreis Check (Consolidated into Differenz Circle Badge)
    let badgeDifEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
    // Remove any legacy floating wrappers if present
    card.querySelector('.tp-real-deal-wrapper')?.remove();

    const isListView = !isNeueFeed && (
      card.classList.contains('mixedBrowsingList') ||
      card.classList.contains('mixedBrowsingListProduct') ||
      !!card.querySelector('.priceAvailabilityContainer, .price-availability') ||
      !!card.closest('#Page_Browsing, .Page_Browsing')
    );
    const isSubcard = card.classList.contains('f_collection') || !!card.closest('.Plugin_ProductCollectionRelProductsList');

    if (!badgeDifEl && pid) {
      badgeDifEl = document.createElement('div');
      badgeDifEl.className = 'badge badge-dif tp-injected-badge';
    }

    if (badgeDifEl) {
      if (isListView) {
        badgeDifEl.classList.add('tp-deal-pill');
        if (isSubcard) {
          const titleContainer = card.querySelector('.bold') || card.querySelector('.product-name');
          if (titleContainer) {
            if (badgeDifEl.parentElement !== titleContainer.parentNode || badgeDifEl.previousElementSibling !== titleContainer) {
              titleContainer.insertAdjacentElement('afterend', badgeDifEl);
            }
          } else if (badgeDifEl.parentElement !== card) {
            card.appendChild(badgeDifEl);
          }
        } else {
          const priceInfo = card.querySelector('.Plugin_PriceInformation, .price_information_product');
          if (priceInfo) {
            if (badgeDifEl.parentElement !== priceInfo) {
              priceInfo.insertBefore(badgeDifEl, priceInfo.firstChild);
            }
          } else if (badgeDifEl.parentElement !== card) {
            card.appendChild(badgeDifEl);
          }
        }
      } else {
        badgeDifEl.classList.remove('tp-deal-pill');
        if (badgeDifEl.parentElement !== card) {
          card.appendChild(badgeDifEl);
        }
      }

      if (!badgeDifEl.dataset.tpOriginalDiscount) {
        const initialDiscount = extractCardDiscount(card);
        badgeDifEl.dataset.tpOriginalDiscount = (initialDiscount !== null && !isNaN(initialDiscount)) ? String(initialDiscount) : '';
      }
      const rawDiscount = badgeDifEl.dataset.tpOriginalDiscount !== '' ? parseFloat(badgeDifEl.dataset.tpOriginalDiscount) : null;

      // Bind single click handler on badge
      if (!badgeDifEl.dataset.tpDealBound) {
        badgeDifEl.dataset.tpDealBound = 'true';
        badgeDifEl.addEventListener('click', async e => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (badgeDifEl.classList.contains('tp-deal-loading')) return;
          const currentPid = getCardProductId(card);
          if (!currentPid) return;

          badgeDifEl.classList.add('tp-deal-loading');
          badgeDifEl.innerHTML = `<div class="text">Prüfe...</div><p>⏳</p>`;
          const requestTimePrice = extractCanonicalPrice(card).price;
          const fetchedStats = await fetchSingleProductPriceStats(currentPid, 1, true);

          // Re-verify the card's price hasn't changed underneath us (e.g. dynamic sorting/reactivity)
          const currentTimePrice = extractCanonicalPrice(card).price;

          if (!requestTimePrice || !currentTimePrice || priceToCents(requestTimePrice) !== priceToCents(currentTimePrice)) {
            // Price changed or is missing during fetch, fetch might be stale or product swapped
            badgeDifEl.classList.remove('tp-deal-loading');
            processListings();
            return;
          }

          badgeDifEl.classList.remove('tp-deal-loading');
          if (fetchedStats) {
            processListings();
          } else {
            badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-not-low', 'tp-is-severe-markup');
            badgeDifEl.innerHTML = `<div class="text">Fehler</div><p style="font-size: 13px;">⚠️ n/v</p>`;
            badgeDifEl.title = '⚠️ Preishistorie zurzeit nicht verfügbar (Klicken für erneuten Versuch)';
            setTimeout(() => {
              if (badgeDifEl && !getCachedPriceStats(currentPid)) {
                processListings();
              }
            }, 2500);
          }
        });
      }

      if (CONFIG.BESTPREISE_MODE_ACTIVE) {
        const dealData = cd.dealScore || computeDealScore(stats, cardPrice);
        if (dealData) {
          // Qualified Bestpreis Deal!
          card.classList.remove('tp-bestpreise-hidden', 'tp-non-bestpreis-filtered');
          badgeDifEl.classList.add('tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

          if (dealData.isNewRecord) {
            badgeDifEl.classList.add('tp-deal-new-record');
            badgeDifEl.classList.remove('tp-deal-alltime-low');
          } else {
            badgeDifEl.classList.add('tp-deal-alltime-low');
            badgeDifEl.classList.remove('tp-deal-new-record');
          }

          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Real Deal -${dealData.score}%</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Real Deal</div><p>-${dealData.score}%</p>`);
          }

          const prevLow = stats?.previousLow;
          const medianVal = stats?.medianPrice;
          const horizonLabel = stats?.horizonDays && stats.horizonDays > 0 ? `${stats.horizonDays >= 365 ? '1J' : stats.horizonDays + 'T'}` : 'Lifetime';
          const outlierText = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? ` | ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert` : '';

          if (dealData.isNewRecord) {
            setTitleIfChanged(badgeDifEl, `🔥 Neuer Rekord! Score: -${dealData.score}% (Ø ${horizonLabel}: -${dealData.dMedian}%, Rekord: -${dealData.dRecord}% vs CHF ${prevLow ? prevLow.toFixed(2) : '?'})${outlierText} [Klicken zum Aktualisieren]`);
          } else {
            setTitleIfChanged(badgeDifEl, `🌟 Allzeit-Tiefstpreis! Score: -${dealData.score}% (Ø ${horizonLabel}: -${dealData.dMedian}%, kein neuer Rekord)${outlierText} [Klicken zum Aktualisieren]`);
          }

          // Compact dual-score breakdown pill directly underneath the circle badge
          let breakdownEl = card.querySelector('.tp-badge-score-breakdown');
          if (isListView) {
            breakdownEl?.remove();
          } else {
            if (!breakdownEl) {
              breakdownEl = document.createElement('div');
              breakdownEl.className = 'tp-badge-score-breakdown';
              card.appendChild(breakdownEl);
            }
            if (dealData.isNewRecord && dealData.dRecord > 0) {
              setHtmlIfChanged(breakdownEl, `<span class="tp-score-record" title="Neuer Rekord-Rabatt (-${dealData.dRecord}%)">Rek: -${dealData.dRecord}%</span> · <span class="tp-score-median" title="${horizonLabel}-Median-Rabatt (-${dealData.dMedian}%)">Ø: -${dealData.dMedian}%</span>`);
            } else {
              setHtmlIfChanged(breakdownEl, `<span class="tp-score-median" title="${horizonLabel}-Median-Rabatt (-${dealData.dMedian}%)">Ø: -${dealData.dMedian}%</span>`);
            }
          }

          let histPriceEl = card.querySelector('.tp-card-historical-price');
          if (!histPriceEl) {
            histPriceEl = document.createElement('div');
            const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                                   cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                                   cardPriceEl?.parentElement ||
                                   card;
            priceContainer.appendChild(histPriceEl);
          }

          if (dealData.isNewRecord && prevLow) {
            histPriceEl.className = 'tp-card-historical-price tp-is-record-low';
            setTextIfChanged(histPriceEl, `Bisher: CHF ${prevLow.toFixed(2)} (-${dealData.dRecord}%)`);
            setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief: CHF ${prevLow.toFixed(2)} (-${dealData.dRecord}%)${outlierText}`);
          } else if (medianVal && medianVal > cardPrice) {
            histPriceEl.className = 'tp-card-historical-price tp-is-at-low';
            setTextIfChanged(histPriceEl, `Ø-Preis (${horizonLabel}): CHF ${medianVal.toFixed(2)} (-${dealData.dMedian}%)`);
            setTitleIfChanged(histPriceEl, `Allzeit-Tiefstpreis! Liegt ${dealData.dMedian}% unter dem ${horizonLabel}-Median von CHF ${medianVal.toFixed(2)}${outlierText}`);
          } else {
            histPriceEl.remove();
          }
        } else if (stats) {
          // Verified NON-Deal (has stats but score <= 0 or not at low) -> HIDE IT if filters enabled!
          if (CONFIG.FILTER_BESTPREIS_ENABLED !== false) {
            card.classList.add('tp-bestpreise-hidden');
          } else {
            card.classList.remove('tp-bestpreise-hidden');
          }
          badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');
          card.querySelector('.tp-card-historical-price')?.remove();
          card.querySelector('.tp-badge-score-breakdown')?.remove();
        } else {
          // Unscanned card (!stats) -> KEEP VISIBLE with interactive loupe / loading spinner!
          card.classList.remove('tp-bestpreise-hidden');
          badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');
          card.querySelector('.tp-badge-score-breakdown')?.remove();

          if (currentlyScanningPid && currentlyScanningPid === pid) {
            badgeDifEl.classList.add('tp-deal-loading');
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>⏳</span><p>Prüfe...</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfe...</div><p>⏳</p>`);
            }
          } else {
            badgeDifEl.classList.remove('tp-deal-loading');
            if (rawDiscount !== null && !isNaN(rawDiscount)) {
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>-${rawDiscount}%</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>-${rawDiscount}%</p><span class="tp-badge-loupe-icon">🔍</span>`);
              }
            } else {
              setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>Deal</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Deal</div><p style="font-size: 15px; margin: 0; line-height: 1.1;">🔍</p>`);
              }
            }
          }
          card.querySelector('.tp-card-historical-price')?.remove();
        }
      } else {
        card.classList.remove('tp-bestpreise-hidden');
        badgeDifEl.classList.remove('tp-deal-new-record');
        card.querySelector('.tp-badge-score-breakdown')?.remove();

        if (currentlyScanningPid && currentlyScanningPid === pid) {
          badgeDifEl.classList.add('tp-deal-loading');
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⏳</span><p>Prüfe...</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfe...</div><p>⏳</p>`);
          }
        } else {
          badgeDifEl.classList.remove('tp-deal-loading');
        }

        const state = getDealState(cardPrice, stats?.tiefstpreis);

        if (state !== 'unknown') {
          const isAllTimeLow = (state === 'new-low' || state === 'at-low');
          const isNonBest = (state === 'above-low');
          const isNewRecord = (state === 'new-low') || !!(stats.isNewAllTimeLow || (isAllTimeLow && stats.previousLow && priceToCents(stats.previousLow) > priceToCents(cardPrice)));
          const prevLow = stats.previousLow;
          const realDropVsPrev = prevLow && prevLow > cardPrice ? Math.round(((prevLow - cardPrice) / prevLow) * 100) : (stats.realDiscountVsPrevLow || 0);

          if (CONFIG.FILTER_BESTPREIS_ENABLED !== false && isNonBest && CONFIG.REAL_DEAL_FILTER_ACTIVE) {
            card.classList.add('tp-non-bestpreis-filtered');
          } else {
            card.classList.remove('tp-non-bestpreis-filtered');
          }

          const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;

          if (isAllTimeLow) {
            // 3B: Verified All-Time Low (Glowing Emerald Halo)
            badgeDifEl.classList.add('tp-deal-alltime-low', 'tp-deal-badge-interactive');
            badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

            let peakContext = '';
            if (hasSignificantPeak) {
              const peakDropPct = Math.round(((stats.hoechstpreis - cardPrice) / stats.hoechstpreis) * 100);
              peakContext = ` (-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)})`;
            }

            let prevLowContext = '';
            if (isNewRecord && prevLow) {
              prevLowContext = ` | Bisheriger Rekord: CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)`;
            }
            const avgContext = stats.avgPrice && stats.avgPrice > cardPrice ? ` | Ø-Preis: CHF ${stats.avgPrice.toFixed(2)}` : '';

            setTitleIfChanged(badgeDifEl, `🌟 ${isNewRecord ? 'Neuer Allzeit-Tiefstpreis' : 'Allzeit-Tiefstpreis'} (CHF ${cardPrice.toFixed(2)})!${prevLowContext}${avgContext}${peakContext} (Klicken zum Aktualisieren)`);
            if (isNeueFeed && rawDiscount !== null && !isNaN(rawDiscount)) {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>-${rawDiscount}%</p>`);
            } else {
              const dealPct = cd.dealScore?.score || (stats.realDiscountVsMedian || stats.realDiscountVsAvg || 0);
              if (isListView) {
                if (dealPct > 0) {
                  setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Real Deal -${dealPct}%</p>`);
                } else {
                  setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Tiefstpreis</p>`);
                }
              } else {
                if (dealPct > 0) {
                  setHtmlIfChanged(badgeDifEl, `<div class="text">Real Deal</div><p>-${dealPct}%</p>`);
                } else {
                  setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>🌟</p>`);
                }
              }
            }
          } else {
            // 2A: Verified Non-Tiefstpreis (Amber Alert Morph with Shrunken Strikethrough)
            const markupPct = Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100);
            const isSevere = markupPct >= 50;

            badgeDifEl.classList.add('tp-deal-not-low', 'tp-deal-badge-interactive');
            badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-loading');
            if (isSevere) {
              badgeDifEl.classList.add('tp-is-severe-markup');
            } else {
              badgeDifEl.classList.remove('tp-is-severe-markup');
            }

            const peakContext = hasSignificantPeak ? ` | Höchstpreis: CHF ${stats.hoechstpreis.toFixed(2)}` : '';
            const fakeDiscContext = (rawDiscount !== null && !isNaN(rawDiscount)) ? ` | Schein-Rabatt: -${rawDiscount}%` : '';
            setTitleIfChanged(badgeDifEl, `⚠️ Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)${fakeDiscContext}${peakContext} (Klicken zum Aktualisieren)`);
            const fakeDiscHtml = (rawDiscount !== null && !isNaN(rawDiscount)) ? `<span class="tp-fake-discount"><s>-${rawDiscount}%</s></span>` : '';
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>⚠️</span><p class="tp-markup-val">+${markupPct}%</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Aufschlag</div><p class="tp-markup-val">+${markupPct}%</p>${fakeDiscHtml}`);
            }
          }

          // 4A: Historical Tiefstpreis line right below current price
          let histPriceEl = card.querySelector('.tp-card-historical-price');
          if (isNonBest) {
            if (!histPriceEl) {
              histPriceEl = document.createElement('div');
              const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                                     cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                                     cardPriceEl?.parentElement ||
                                     card;
              priceContainer.appendChild(histPriceEl);
            }
            histPriceEl.className = 'tp-card-historical-price tp-is-markup';
            setTextIfChanged(histPriceEl, `Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)}`);
            setTitleIfChanged(histPriceEl, `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100)}% Aufschlag)`);
          } else if (isNewRecord && prevLow) {
            if (!histPriceEl) {
              histPriceEl = document.createElement('div');
              const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                                     cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                                     cardPriceEl?.parentElement ||
                                     card;
              priceContainer.appendChild(histPriceEl);
            }
            histPriceEl.className = 'tp-card-historical-price tp-is-record-low';
            setTextIfChanged(histPriceEl, `Bisher: CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)`);
            setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)}`);
          } else if (!isNeueFeed && stats.medianPrice && stats.medianPrice > cardPrice) {
            if (!histPriceEl) {
              histPriceEl = document.createElement('div');
              const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                                     cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                                     cardPriceEl?.parentElement ||
                                     card;
              priceContainer.appendChild(histPriceEl);
            }
            const dMedian = Math.round(((stats.medianPrice - cardPrice) / stats.medianPrice) * 100);
            const horizonLabel = stats.horizonDays && stats.horizonDays > 0 ? `${stats.horizonDays >= 365 ? '1J' : stats.horizonDays + 'T'}` : '1J';
            histPriceEl.className = 'tp-card-historical-price tp-is-at-low';
            setTextIfChanged(histPriceEl, `Ø-Preis (${horizonLabel}): CHF ${stats.medianPrice.toFixed(2)} (-${dMedian}%)`);
            setTitleIfChanged(histPriceEl, `Allzeit-Tiefstpreis! Liegt ${dMedian}% unter dem ${horizonLabel}-Median von CHF ${stats.medianPrice.toFixed(2)}`);
          } else if (histPriceEl) {
            histPriceEl.remove();
          }
        } else {
          // 1A: Unchecked State (Subtle Mini Loupe + Hover Scale + Tooltip)
          card.classList.remove('tp-non-bestpreis-filtered');
          card.querySelector('.tp-card-historical-price')?.remove();

          badgeDifEl.classList.add('tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');
          if (isNeueFeed && rawDiscount !== null && !isNaN(rawDiscount)) {
            setTitleIfChanged(badgeDifEl, `🔍 Klicken: Echten Allzeit-Tiefstpreis prüfen (-${rawDiscount}% Schein-Rabatt vs Realität)`);
            setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>-${rawDiscount}%</p><span class="tp-badge-loupe-icon">🔍</span>`);
          } else {
            setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>Deal</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Deal</div><p style="font-size: 15px; margin: 0; line-height: 1.1;">🔍</p>`);
            }
          }
        }
      }
    } else {
      card.classList.remove('tp-non-bestpreis-filtered', 'tp-bestpreise-hidden');
      card.querySelector('.tp-card-historical-price')?.remove();
    }

    // 3.6 Mini Price-Trend Sparkline (Beta Feature)
    if (CONFIG.ENABLE_SPARKLINES && stats && Array.isArray(stats.timeSeries) && stats.timeSeries.length >= 2) {
      let sparkContainer = card.querySelector('.tp-sparkline-container');
      if (!sparkContainer) {
        sparkContainer = document.createElement('div');
        sparkContainer.className = 'tp-sparkline-container';
      }
      if (!sparkContainer.querySelector('.tp-sparkline')) {
        const svg = renderSparkline(stats.timeSeries, 44, 13);
        if (svg) {
          sparkContainer.replaceChildren();
          sparkContainer.appendChild(svg);
        }
      }
      const histPriceEl = card.querySelector('.tp-card-historical-price');
      if (histPriceEl) {
        let subRow = card.querySelector('.tp-card-subline-row');
        if (!subRow) {
          subRow = document.createElement('div');
          subRow.className = 'tp-card-subline-row';
          histPriceEl.parentElement?.insertBefore(subRow, histPriceEl);
          subRow.appendChild(histPriceEl);
        }
        if (sparkContainer.parentElement !== subRow) {
          subRow.appendChild(sparkContainer);
        }
      } else {
        const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                               cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                               cardPriceEl?.parentElement ||
                               card;
        if (sparkContainer.parentElement !== priceContainer) {
          priceContainer.appendChild(sparkContainer);
        }
      }
    } else {
      card.querySelector('.tp-sparkline-container')?.remove();
      const subRow = card.querySelector('.tp-card-subline-row');
      if (subRow) {
        const hist = subRow.querySelector('.tp-card-historical-price');
        if (hist) {
          subRow.parentElement?.insertBefore(hist, subRow);
        }
        subRow.remove();
      }
    }
  }


  function applySorting(cards, pageHasOffers) {
    if (!cards || cards.length <= 1) return;

    const isCustomSortActive = CONFIG.BESTPREISE_MODE_ACTIVE ||
                               CONFIG.SORT_BY_OFFERS === 'discount-desc' ||
                               (pageHasOffers && CONFIG.SORT_BY_OFFERS !== 'none');

    if (!isCustomSortActive) {
      const wasCustomSorted = cards.some(c => {
        const u = getCardSortableUnit(c);
        return u?.style.order || u?.dataset.tpOrigParentId;
      });
      if (!wasCustomSorted) return;
    }

    // Ensure initial order and original parent IDs are recorded on all cards/columns
    cards.forEach((c, idx) => {
      if (!c.dataset.tpInitialOrder) {
        c.dataset.tpInitialOrder = String(idx);
      }
      const item = getCardSortableUnit(c);
      if (item && !item.dataset.tpInitialOrder) {
        item.dataset.tpInitialOrder = String(idx);
        const parent = item.parentElement;
        if (parent) {
          if (!parent.id && !parent.dataset.tpParentId) {
            parent.dataset.tpParentId = 'tp-p-' + Math.random().toString(36).slice(2, 9);
          }
          item.dataset.tpOrigParentId = parent.id || parent.dataset.tpParentId;
        }
      }
    });

    // Find all rows that actually contain product cards (strictly scopes to product rows, never sidebar/tabs/header)
    const productRows = Array.from(new Set(cards.map(c => getCardSortableUnit(c)?.parentElement).filter(r => r && !r.closest('header, nav, footer, .breadcrumb, #tp-suite-filter-bar, .Plugin_ProductHistoryDropdown, .AbstractDropDown, #Plugin_MainHead, .DropDownMenuList'))));
    if (productRows.length === 0) return;

    const primaryRow = productRows[0];

    if (isCustomSortActive) {
      let sortedEntries = [];

      if (CONFIG.BESTPREISE_MODE_ACTIVE) {
        const scored = cards.map(c => {
          const cd = extractCardData(c);
          const dealData = computeDealScore(cd.stats, cd.cardPrice);
          let score = -100;
          if (dealData) {
            score = dealData.score;
          } else if (!cd.stats) {
            score = 0;
          }
          return {
            card: c,
            item: getCardSortableUnit(c),
            score,
            initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
          };
        });
        scored.sort((a, b) => (b.score - a.score) || (a.initialOrder - b.initialOrder));
        sortedEntries = scored;
      } else if (CONFIG.SORT_BY_OFFERS === 'discount-desc') {
        const scored = cards.map(c => ({
          card: c,
          item: getCardSortableUnit(c),
          disc: extractCardDiscount(c) ?? -1,
          initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
        }));
        scored.sort((a, b) => (b.disc - a.disc) || (a.initialOrder - b.initialOrder));
        sortedEntries = scored;
      } else if (pageHasOffers && CONFIG.SORT_BY_OFFERS !== 'none') {
        const scored = cards.map(c => ({
          card: c,
          item: getCardSortableUnit(c),
          count: extractOfferCount(c),
          initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
        }));
        scored.sort((a, b) => CONFIG.SORT_BY_OFFERS === 'desc' ? (b.count - a.count) : (a.count - b.count));
        sortedEntries = scored;
      }

      // Deduplicate by item so grouped collection items appearing for multiple child cards are only moved once
      const seenItems = new Set();
      const uniqueEntries = [];
      for (const entry of sortedEntries) {
        if (entry.item && !seenItems.has(entry.item)) {
          seenItems.add(entry.item);
          uniqueEntries.push(entry);
        }
      }
      sortedEntries = uniqueEntries;

      // Move sortable items into primaryRow and apply CSS flex order
      sortedEntries.forEach((entry, rank) => {
        const item = entry.item;
        if (item) {
          if (item.parentElement !== primaryRow) {
            primaryRow.appendChild(item);
          }
          if (item.style.order !== String(rank)) {
            item.style.setProperty('order', String(rank), 'important');
          }
        }
      });

      // Ensure DOM order inside primaryRow matches sortedEntries order without unnecessary detach/re-attach
      const currentChildren = Array.from(primaryRow.children);
      const targetItems = sortedEntries.map(e => e.item).filter(Boolean);
      let domOrderMatches = true;
      for (let i = 0; i < targetItems.length; i++) {
        if (currentChildren[i] !== targetItems[i]) {
          domOrderMatches = false;
          break;
        }
      }
      if (!domOrderMatches) {
        targetItems.forEach((item, idx) => {
          if (primaryRow.children[idx] !== item) {
            primaryRow.insertBefore(item, primaryRow.children[idx] || null);
          }
        });
      }

      // Hide empty secondary product rows
      if (productRows.length > 1) {
        productRows.slice(1).forEach(r => {
          if (!r.querySelector('.Plugin_Product, .mixedBrowsingListProduct')) {
            r.style.setProperty('display', 'none', 'important');
            r.classList.add('tp-empty-product-row-hidden');
          }
        });
      }
    } else {
      // Natural order restoration: return items to original parents in initial order
      const itemsToRestore = cards.map(c => {
        const item = getCardSortableUnit(c);
        return {
          card: c,
          item,
          initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10),
          origParentId: item?.dataset.tpOrigParentId
        };
      });

      itemsToRestore.sort((a, b) => a.initialOrder - b.initialOrder);

      const allOrigParents = Array.from(new Set(itemsToRestore.map(entry => {
        if (!entry.origParentId) return entry.item?.parentElement;
        return document.getElementById(entry.origParentId) ||
               document.querySelector(`[data-tp-parent-id="${entry.origParentId}"]`) ||
               entry.item?.parentElement;
      }).filter(Boolean)));

      itemsToRestore.forEach(entry => {
        const item = entry.item;
        if (!item) return;
        if (item.style.order) {
          item.style.removeProperty('order');
        }

        if (entry.origParentId) {
          let origParent = document.getElementById(entry.origParentId) ||
                           document.querySelector(`[data-tp-parent-id="${entry.origParentId}"]`);
          if (origParent && item.parentElement !== origParent) {
            origParent.appendChild(item);
          }
        }
      });

      // Ensure each product row has its children in initial order and unhide without redundant re-appends
      allOrigParents.forEach(row => {
        const children = Array.from(row.children).filter(ch => ch.dataset.tpInitialOrder !== undefined);
        const isAlreadySorted = children.every((ch, i) => i === 0 || parseInt(ch.dataset.tpInitialOrder || '0', 10) >= parseInt(children[i - 1].dataset.tpInitialOrder || '0', 10));
        if (!isAlreadySorted) {
          children.sort((a, b) => parseInt(a.dataset.tpInitialOrder || '0', 10) - parseInt(b.dataset.tpInitialOrder || '0', 10));
          children.forEach((ch, idx) => {
            if (row.children[idx] !== ch) {
              row.insertBefore(ch, row.children[idx] || null);
            }
          });
        }
        if (row.style.display === 'none') {
          row.style.removeProperty('display');
        }
        row.classList.remove('tp-empty-product-row-hidden');
      });
    }
  }

  function renderEmptyState(cards, counts) {
    let emptyNotice = document.getElementById('tp-empty-state-notice');

    // If qualifying bestpreise deals exist on page, NEVER render empty state
    if (counts.bestpreiseDeals > 0) {
      if (emptyNotice) emptyNotice.remove();
      return;
    }

    const totalHidden = (counts.neg || 0) + (counts.cat || 0) + (counts.min || 0) + (counts.nonBest || 0) + (counts.bestpreiseHidden || 0);
    const isRevealed = document.body.classList.contains('tp-reveal-filtered');

    if (cards.length > 0 && totalHidden >= cards.length && !isRevealed) {
      if (!emptyNotice) {
        emptyNotice = document.createElement('div');
        emptyNotice.id = 'tp-empty-state-notice';
        emptyNotice.className = 'tp-empty-state-notice';
        const listParent = cards[0]?.parentElement;
        if (listParent) {
          listParent.insertBefore(emptyNotice, listParent.firstChild);
        }
      }
      const isBestpreiseEmpty = CONFIG.BESTPREISE_MODE_ACTIVE && (counts.bestpreiseHidden || 0) > 0;
      const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
      emptyNotice.innerHTML = `
        <div>🚫 <strong>${isBestpreiseEmpty ? 'Keine verifizierten Bestpreise auf dieser Seite gefunden.' : `Alle ${cards.length} Angebote auf dieser Seite sind durch aktive Filter ausgeblendet.`}</strong></div>
        <div class="tp-empty-state-actions">
          ${isBestpreiseEmpty && counts.uncheckedDeals > 0 ? `<button class="tp-empty-state-btn" id="tp-empty-check-deals-btn" style="border-color: #3b82f6; color: #60a5fa;">🔍 Deals prüfen (≥${minDisc}%)</button>` : ''}
          <button class="tp-empty-state-btn" id="tp-empty-reveal-btn">👁️ Ausgeblendete anzeigen</button>
          ${isBestpreiseEmpty ? '<button class="tp-empty-state-btn" id="tp-empty-disable-bestpreise-btn">💎 Bestpreise-Modus ausschalten</button>' : ''}
          <button class="tp-empty-state-btn" id="tp-empty-toggle-filters-btn">⚡ Filter ausschalten</button>
        </div>
      `;
      emptyNotice.querySelector('#tp-empty-check-deals-btn')?.addEventListener('click', () => {
        const batchBtn = document.getElementById('tp-bar-batch-check-btn');
        if (batchBtn) batchBtn.click();
      });
      emptyNotice.querySelector('#tp-empty-reveal-btn')?.addEventListener('click', () => {
        document.body.classList.toggle('tp-reveal-filtered');
        processListings();
      });
      emptyNotice.querySelector('#tp-empty-disable-bestpreise-btn')?.addEventListener('click', () => {
        cancelBestpreiseScan();
        updateConfig('BESTPREISE_MODE_ACTIVE', false);
        showToast('Bestpreise-Modus deaktiviert');
      });
      emptyNotice.querySelector('#tp-empty-toggle-filters-btn')?.addEventListener('click', () => {
        updateConfigs({
          FILTER_NEG_ENABLED: false,
          FILTER_CAT_ENABLED: false,
          FILTER_MIN_ENABLED: false,
          FILTER_BESTPREIS_ENABLED: false
        });
        showToast('⏸️ Alle Filter pausiert (alle Angebote sichtbar)');
      });
    } else if (emptyNotice) {
      emptyNotice.remove();
    }
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

  // ─── PRODUCT DETAIL PAGE REAL DEAL ──────────────────────────────────────────
  function isProductDetailPage() {
    return /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(location.href) ||
           /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(document.body?.getAttribute('data-current_url') || '') ||
           document.body?.classList.contains('Page_Product') ||
           document.body?.classList.contains('Page_DetailProduct') ||
           !!document.querySelector('.Page_DetailProduct, #Page_DetailProduct, .product_detail_page, .Page_Product') ||
           (!!document.querySelector('.Plugin_ProductHeading h1, .productHeading h1, .product_title h1, h1.productTitle') && !!getDetailProductId());
  }

  function getDetailProductId() {
    const match = location.href.match(/-p(\d+)/i) || (document.body?.getAttribute('data-current_url') || '').match(/-p(\d+)/i);
    if (match) return match[1];
    const chartLink = document.querySelector('a[href*="pricechart"], a[href*="p_pc_pid="]');
    if (chartLink) {
      const m = chartLink.href.match(/p_pc_pid=(\d+)/i);
      if (m) return m[1];
    }
    const chartForm = document.querySelector('form[action*="pricechart"] input[name*="pid"], input[name="p_pc_pid"]');
    if (chartForm && chartForm.value) return chartForm.value;
    return null;
  }

  function getDetailLowestPrice() {
    const priceEl = document.querySelector('.productPrice .Plugin_Price, .product_price .Plugin_Price, .lowestPrice .Plugin_Price, .priceComparison .Plugin_Price, .tableDealerPriceList .Plugin_Price, .Plugin_Price');
    return priceEl ? parsePrice(priceEl.textContent) : 0;
  }

  let isProcessingDetail = false;
  async function processProductDetailPage() {
    if (isProcessingDetail) return;
    const pid = getDetailProductId();
    if (!pid) return;

    const headingEl = document.querySelector('.Plugin_ProductHeading h1, .productHeading h1, .product_title h1, h1.productTitle, h1');
    if (!headingEl) return;

    const currentPrice = getDetailLowestPrice();
    if (currentPrice <= 0) return;

    let badge = document.getElementById('tp-detail-deal-badge');
    const stats = getCachedPriceStats(pid);

    if (stats && stats.tiefstpreis > 0) {
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'tp-detail-deal-badge';
        headingEl.appendChild(badge);
      }

      const state = getDealState(currentPrice, stats.tiefstpreis);
      const isAllTimeLow = (state === 'new-low' || state === 'at-low');
      const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;

      if (isAllTimeLow) {
        badge.className = 'tp-detail-deal-badge tp-is-alltime-low';
        let peakContext = '';
        if (hasSignificantPeak) {
          const peakDropPct = Math.round(((stats.hoechstpreis - currentPrice) / stats.hoechstpreis) * 100);
          peakContext = ` (-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)})`;
        }
        badge.title = `Aktueller Bestpreis (CHF ${currentPrice.toFixed(2)}) ist der historische Allzeit-Tiefstpreis!${peakContext}`;
        badge.textContent = '🌟 Allzeit-Tiefstpreis';
      } else {
        const markupPct = Math.round(((currentPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100);
        const isSevere = markupPct >= 50;
        badge.className = `tp-detail-deal-badge tp-is-not-low ${isSevere ? 'tp-is-severe-markup' : ''}`;
        const peakContext = hasSignificantPeak ? ` | Höchstpreis: CHF ${stats.hoechstpreis.toFixed(2)}` : '';
        badge.title = `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)${peakContext}`;
        badge.textContent = `⚠️ Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}%)`;
      }
    } else if (!activeFetches.has(pid)) {
      isProcessingDetail = true;
      try {
        await fetchSingleProductPriceStats(pid);
      } finally {
        isProcessingDetail = false;
      }
      const fetchedStats = getCachedPriceStats(pid);
      if (fetchedStats && !fetchedStats.unavailable && fetchedStats.tiefstpreis > 0) {
        processProductDetailPage();
      }
    }
  }

  // ─── PRICE ALARM AUTOMATION ─────────────────────────────────────────────────
  function processPriceAlarmModal() {
    if (!CONFIG.ALARM_ENABLED) return;
    const modalContainer = document.querySelector('.Plugin_NewInfoMailForm');
    if (!modalContainer || modalContainer.dataset.tpAlarmProcessed === 'true') return;
    modalContainer.dataset.tpAlarmProcessed = 'true';

    const priceEl = modalContainer.querySelector('.shippingPrice .Plugin_Price') ||
                    modalContainer.querySelector('.productPrice .Plugin_Price') ||
                    document.querySelector('.pageContent .priceContainer .Plugin_Price');
    if (!priceEl) return;

    const presentValue = parsePrice(priceEl.textContent);
    if (presentValue <= 0) return;

    const targetPrice = (presentValue * CONFIG.ALARM_TARGET_PERCENT).toFixed(2);
    const priceInput = modalContainer.querySelector('input#f_NewInfoMailForm_priceFrom') || modalContainer.querySelector('input[name="im_nimf_pvf"]');
    if (priceInput) {
      priceInput.value = targetPrice;
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const durationHidden = modalContainer.querySelector('input[name="im_nimf_du"]');
    if (durationHidden) {
      durationHidden.value = CONFIG.ALARM_DURATION_DAYS;
      durationHidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
    modalContainer.querySelector(`li[data-value="${CONFIG.ALARM_DURATION_DAYS}"]`)?.click();

    const termsCheckbox = modalContainer.querySelector('input#im_nimf_prtrm');
    if (termsCheckbox) {
      termsCheckbox.checked = true;
      termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (CONFIG.ALARM_AUTO_SUBMIT) {
      const submitDelay = Math.max(0, CONFIG.ALARM_SUBMIT_DELAY_MS ?? 300);
      const closeDelay = Math.max(0, CONFIG.ALARM_CLOSE_DELAY_MS ?? 800);
      setTimeout(() => {
        const submitBtn = modalContainer.querySelector('input.f_submitbtn');
        if (submitBtn) {
          submitBtn.click();
          // Allow in-flight AJAX request to complete before closing the dialog container
          setTimeout(() => {
            const closeBtn = modalContainer.closest('.AbstractDialog')?.querySelector('.AbstractDialog_CloseButton') ||
                             document.querySelector('#tmpAbstractDialogContainer .AbstractDialog_CloseButton');
            if (closeBtn) closeBtn.click();
          }, closeDelay);
        }
      }, submitDelay);
    }
  }

  // ─── UNIFIED SETTINGS UI IN SHADOW DOM ─────────────────────────────────────


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
