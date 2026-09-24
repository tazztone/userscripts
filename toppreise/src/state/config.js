/**
 * Configuration & Persistent Settings State Layer
 * Manages defaults, GM_getValue/localStorage synchronization,
 * active configuration object, and bidirectional UI control sync.
 */

import { uiShadowRoot } from '../ui/modal.js';

export const DEFAULTS = Object.freeze({
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
  REAL_DEAL_FILTER_ACTIVE: false,
  REAL_DEAL_MIN_DISCOUNT: 30,
  REAL_DEAL_CACHE_HOURS: 48,
  NEGATIVE_CACHE_HOURS: 2,
  BESTPREISE_MODE_ACTIVE: false,
  BESTPREISE_WEIGHT_RECORD: 0.50,
  BESTPREISE_MEDIAN_HORIZON_DAYS: 365,
  OUTLIER_REJECTION_ENABLED: true,
  ENABLE_SPARKLINES: true,
  NEGATIVE_TERMS: '',
  EXCLUDED_CATEGORIES: [],
  MIN_OFFERS: 0,
  SORT_BY_OFFERS: 'none',
  ALARM_ENABLED: true,
  ALARM_TARGET_PERCENT: 0.60,
  ALARM_DURATION_DAYS: '730',
  ALARM_AUTO_SUBMIT: true,
  ALARM_SUBMIT_DELAY_MS: 300,
  ALARM_CLOSE_DELAY_MS: 800,
  OBSERVER_DEBOUNCE_MS: 200,
  DEBUG: true
});

// Compact GM_getValue + localStorage Fallback
export const _getValue = (k, def) => (typeof GM_getValue !== 'undefined' ? GM_getValue(k, def) : (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('tp_suite_v2_' + k) ?? 'null') : null)) ?? def;
export const _setValue = (k, v) => (typeof GM_setValue !== 'undefined' ? GM_setValue(k, v) : (typeof localStorage !== 'undefined' ? localStorage.setItem('tp_suite_v2_' + k, JSON.stringify(v)) : null));

export const CONFIG = {
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

export const saveConfigKey = (key, val) => {
  CONFIG[key] = val;
  _setValue(key, val);
};

export const CONFIG_BODY_KEYS = new Set(['MODE', 'DIM_OPACITY']);

export function updateBodyClasses() {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.remove('tp-mode-dim', 'tp-mode-hide', 'tp-mode-highlight-only');
  document.body.classList.add(`tp-mode-${CONFIG.MODE}`);
  document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
}

export function syncUiControl(key, val) {
  // 1. Sync Settings Modal (Shadow DOM) if open/exists
  const shadow = uiShadowRoot || (typeof document !== 'undefined' ? document.getElementById('tp-root')?.shadowRoot : null);
  if (shadow) {
    try {
      switch (key) {
        case 'MODE': {
          const el = shadow.querySelector(`input[name="tp-mode"][value="${val}"]`);
          if (el) el.checked = true;
          break;
        }
        case 'DIM_OPACITY': {
          const range = shadow.getElementById('tp-opacity-range');
          const label = shadow.getElementById('tp-opacity-val');
          if (range) range.value = val;
          if (label) label.textContent = `${Math.round(val * 100)}%`;
          break;
        }
        case 'HEATMAP_ENABLED': {
          const toggle = shadow.getElementById('tp-heatmap-enabled-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'BESTPREISE_MODE_ACTIVE': {
          const toggle = shadow.getElementById('tp-bestpreise-mode-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'BESTPREISE_WEIGHT_RECORD': {
          const range = shadow.getElementById('tp-bestpreise-weight-range');
          const valEl = shadow.getElementById('tp-bestpreise-weight-val');
          const descEl = shadow.getElementById('tp-bestpreise-weight-desc');
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
          const range = shadow.getElementById('tp-real-deal-min-range');
          const valEl = shadow.getElementById('tp-real-deal-min-val');
          if (range) range.value = val;
          if (valEl) valEl.value = val;
          break;
        }
        case 'REAL_DEAL_FILTER_ACTIVE': {
          const toggle = shadow.getElementById('tp-real-deal-filter-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'USE_SHIPPING_PRICE': {
          const toggle = shadow.getElementById('tp-use-shipping-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'ENABLE_SPARKLINES': {
          const toggle = shadow.getElementById('tp-sparklines-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
      }
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] syncUiControl error', err);
    }
  }

  // 2. Sync Inline Filter Bar if present
  if (typeof document !== 'undefined') {
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
}

export function updateConfig(key, val, options = {}) {
  saveConfigKey(key, val);
  if (!options.skipUiSync) {
    syncUiControl(key, val);
  }
  if (CONFIG_BODY_KEYS.has(key)) {
    updateBodyClasses();
  }
  if (!options.skipRender && typeof processListings === 'function') {
    processListings();
  }
}

export function updateConfigs(entries, options = {}) {
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
  if (!options.skipRender && typeof processListings === 'function') {
    processListings();
  }
}
