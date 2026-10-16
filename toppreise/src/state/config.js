/**
 * Configuration & Persistent Settings State Layer
 * Manages defaults, GM_getValue/localStorage synchronization,
 * active configuration object, and bidirectional UI control sync.
 */

import { uiShadowRoot } from '../ui/shell.js';
import { syncMiniToggle, paintCycleButton } from '../ui/mini-toggle.js';
import { SECRET_KEYS, _getValue, _setValue, DEFAULTS, sanitizeConfigValue, weightText, horizonText, horizonUiToStored, horizonStoredToUi } from './config-store.js';
import { migrateLegacyDebug, migrateHideToDimDefaults, migrateFilterSplit } from './config-migrate.js';


// Shared clamps: single source for the min-points (1–100 data points) and
// heatmap-intensity (0.2–1.0) bounds previously copy-pasted across modules.
export const clampMinPoints = v => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return 5;
  return Math.max(1, Math.min(100, Math.round(n)));
};
// Stepped min-points scale: fine 1–5, then tens to 100. Sliders bind the
// index (0–14), number inputs + stored value stay free 1–100.
export const MIN_POINTS_STEPS = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
export const minPointsToIndex = v => {
  const n = clampMinPoints(v);
  let best = 0;
  for (let i = 1; i < MIN_POINTS_STEPS.length; i++) {
    if (Math.abs(MIN_POINTS_STEPS[i] - n) < Math.abs(MIN_POINTS_STEPS[best] - n)) best = i;
  }
  return best;
};
export const minPointsFromIndex = i => MIN_POINTS_STEPS[Math.max(0, Math.min(MIN_POINTS_STEPS.length - 1, parseInt(i, 10) || 0))];
export function paintMinPoints(raw = CONFIG.BESTPREISE_MIN_POINTS, shadowRoot) {
  const num = clampMinPoints(raw);
  const idx = minPointsToIndex(num);
  const shadow = shadowRoot ?? uiShadowRoot ?? (typeof document !== 'undefined' ? document.getElementById('tp-root')?.shadowRoot : null);
  const range = shadow?.getElementById('tp-bestpreise-minpoints-range');
  if (range) range.value = idx;
  const valEl = shadow?.getElementById('tp-bestpreise-minpoints-val');
  if (valEl) valEl.value = num;
  if (typeof document !== 'undefined') {
    const barRange = document.getElementById('tp-bar-minpoints-range');
    if (barRange && document.activeElement !== barRange) barRange.value = idx;
    const barLabel = document.getElementById('tp-bar-minpoints-label');
    if (barLabel) barLabel.textContent = `📊 ${num} Pkt`;
  }
}
export const clampIntensity01 = v => Math.max(0.2, Math.min(1.0, v));

// One-time migration: single DISCORD_SUPPRESS_EMBEDS key split into dealer +
// product keys. Stored old value seeds both new keys once; stale key unread.
const legacySuppressEmbeds = _getValue('DISCORD_SUPPRESS_EMBEDS', null);
const _layoutRaw = _getValue('DISCORD_LAYOUT', DEFAULTS.DISCORD_LAYOUT);
// Filter modes: 'dim' dims, 'highlight' highlights, everything else hides.
const _modeValue = k => {
  const v = _getValue(k, DEFAULTS[k]);
  return (v === 'dim' || v === 'highlight') ? v : 'hide';
};
// 4-state filter cycle: each cause row pairs an enable key with a mode key.
// The cycle button derives Normal/Dimmen/Verbergen/Hervorheben from the pair —
// storage keys unchanged, no migration. Dealer row excluded (preset).
export const FILTER_CYCLE = Object.freeze({
  FILTER_NEG_MODE: { enable: 'FILTER_NEG_ENABLED', on: true },
  FILTER_MIN_MODE: { enable: 'FILTER_MIN_ENABLED', on: true },
  HIDE_UNCHECKED_MODE: { enable: 'BESTPREISE_HIDE_UNCHECKED', on: true },
  VORTIEF_MODE: { enable: 'BESTPREISE_INCLUDE_VORTIEF', on: false },
});
export const cycleStateOf = modeKey => {
  const pair = FILTER_CYCLE[modeKey];
  if (!pair) return CONFIG[modeKey] || 'dim';
  if (CONFIG[pair.enable] !== pair.on) return 'off';
  return CONFIG[modeKey] || 'dim';
};
// Toolbar owns the cycle button element; config owns the state mapping.
// Text/class paint shared with the toolbar via ui/mini-toggle.js.
const paintCycleButtons = (bar, modeKey) => {
  const s = cycleStateOf(modeKey);
  bar.querySelectorAll(`[data-mode-key="${modeKey}"]`).forEach(btn => {
    paintCycleButton(btn, s);
    btn.title = s === 'off'
      ? 'Filter: Normal — klicken für Dimmen'
      : s === 'dim'
        ? 'Filter: Dimmen — klicken für Verbergen'
        : s === 'hide'
          ? 'Filter: Verbergen — klicken für Hervorheben'
          : 'Filter: Hervorheben — klicken für Normal';
  });
};


export const CONFIG = {
  FILTER_NEG_ENABLED: sanitizeConfigValue('FILTER_NEG_ENABLED', _getValue('FILTER_NEG_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_NEG_ENABLED))),
  FILTER_MIN_ENABLED: sanitizeConfigValue('FILTER_MIN_ENABLED', _getValue('FILTER_MIN_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_MIN_ENABLED))),
  FILTER_NEG_MODE: _modeValue('FILTER_NEG_MODE'),
  FILTER_MIN_MODE: _modeValue('FILTER_MIN_MODE'),
  HIDE_UNCHECKED_MODE: _modeValue('HIDE_UNCHECKED_MODE'),
  VORTIEF_MODE: _modeValue('VORTIEF_MODE'),
  DEALER_MODE: _modeValue('DEALER_MODE'),
  MARGIN_PERCENT: sanitizeConfigValue('MARGIN_PERCENT', _getValue('MARGIN_PERCENT', DEFAULTS.MARGIN_PERCENT)),
  DIM_OPACITY: sanitizeConfigValue('DIM_OPACITY', _getValue('DIM_OPACITY', DEFAULTS.DIM_OPACITY)),
  USE_SHIPPING_PRICE: sanitizeConfigValue('USE_SHIPPING_PRICE', _getValue('USE_SHIPPING_PRICE', DEFAULTS.USE_SHIPPING_PRICE)),
  HEATMAP_ENABLED: sanitizeConfigValue('HEATMAP_ENABLED', _getValue('HEATMAP_ENABLED', DEFAULTS.HEATMAP_ENABLED)),
  HEATMAP_INTENSITY: sanitizeConfigValue('HEATMAP_INTENSITY', _getValue('HEATMAP_INTENSITY', DEFAULTS.HEATMAP_INTENSITY)),
  REAL_DEAL_MIN_DISCOUNT: sanitizeConfigValue('REAL_DEAL_MIN_DISCOUNT', _getValue('REAL_DEAL_MIN_DISCOUNT', DEFAULTS.REAL_DEAL_MIN_DISCOUNT)),
  REAL_DEAL_CACHE_HOURS: sanitizeConfigValue('REAL_DEAL_CACHE_HOURS', _getValue('REAL_DEAL_CACHE_HOURS', DEFAULTS.REAL_DEAL_CACHE_HOURS)),
  NEGATIVE_CACHE_HOURS: sanitizeConfigValue('NEGATIVE_CACHE_HOURS', _getValue('NEGATIVE_CACHE_HOURS', DEFAULTS.NEGATIVE_CACHE_HOURS)),
  BESTPREISE_MODE_ACTIVE: sanitizeConfigValue('BESTPREISE_MODE_ACTIVE', _getValue('BESTPREISE_MODE_ACTIVE', DEFAULTS.BESTPREISE_MODE_ACTIVE)),
  BESTPREISE_HIDE_UNCHECKED: sanitizeConfigValue('BESTPREISE_HIDE_UNCHECKED', _getValue('BESTPREISE_HIDE_UNCHECKED', DEFAULTS.BESTPREISE_HIDE_UNCHECKED)),
  BESTPREISE_INCLUDE_VORTIEF: sanitizeConfigValue('BESTPREISE_INCLUDE_VORTIEF', _getValue('BESTPREISE_INCLUDE_VORTIEF', DEFAULTS.BESTPREISE_INCLUDE_VORTIEF)),
  BESTPREISE_WEIGHT_RECORD: sanitizeConfigValue('BESTPREISE_WEIGHT_RECORD', _getValue('BESTPREISE_WEIGHT_RECORD', DEFAULTS.BESTPREISE_WEIGHT_RECORD)),
  BESTPREISE_MIN_POINTS: sanitizeConfigValue('BESTPREISE_MIN_POINTS', _getValue('BESTPREISE_MIN_POINTS', DEFAULTS.BESTPREISE_MIN_POINTS)),
  BESTPREISE_MEDIAN_HORIZON_DAYS: sanitizeConfigValue('BESTPREISE_MEDIAN_HORIZON_DAYS', _getValue('BESTPREISE_MEDIAN_HORIZON_DAYS', DEFAULTS.BESTPREISE_MEDIAN_HORIZON_DAYS)),
  OUTLIER_REJECTION_ENABLED: sanitizeConfigValue('OUTLIER_REJECTION_ENABLED', _getValue('OUTLIER_REJECTION_ENABLED', DEFAULTS.OUTLIER_REJECTION_ENABLED)),
  OUTLIER_DEVIATION_BAND: sanitizeConfigValue('OUTLIER_DEVIATION_BAND', _getValue('OUTLIER_DEVIATION_BAND', DEFAULTS.OUTLIER_DEVIATION_BAND)),
  OUTLIER_MAX_GLITCH_HOURS: sanitizeConfigValue('OUTLIER_MAX_GLITCH_HOURS', _getValue('OUTLIER_MAX_GLITCH_HOURS', DEFAULTS.OUTLIER_MAX_GLITCH_HOURS)),
  ENABLE_SPARKLINES: sanitizeConfigValue('ENABLE_SPARKLINES', _getValue('ENABLE_SPARKLINES', DEFAULTS.ENABLE_SPARKLINES)),
  REVIEW_SEARCH_ENABLED: sanitizeConfigValue('REVIEW_SEARCH_ENABLED', _getValue('REVIEW_SEARCH_ENABLED', DEFAULTS.REVIEW_SEARCH_ENABLED)),
  REVIEW_SEARCH_KEYWORD: sanitizeConfigValue('REVIEW_SEARCH_KEYWORD', _getValue('REVIEW_SEARCH_KEYWORD', DEFAULTS.REVIEW_SEARCH_KEYWORD)),
  REVIEW_SEARCH_AI_MODE: sanitizeConfigValue('REVIEW_SEARCH_AI_MODE', _getValue('REVIEW_SEARCH_AI_MODE', DEFAULTS.REVIEW_SEARCH_AI_MODE)),
  DEALER_AUTOFETCH: sanitizeConfigValue('DEALER_AUTOFETCH', _getValue('DEALER_AUTOFETCH', DEFAULTS.DEALER_AUTOFETCH)),
  NEGATIVE_TERMS: sanitizeConfigValue('NEGATIVE_TERMS', _getValue('NEGATIVE_TERMS', DEFAULTS.NEGATIVE_TERMS)),
  DISCORD_WEBHOOK_URL: _getValue('DISCORD_WEBHOOK_URL', DEFAULTS.DISCORD_WEBHOOK_URL),
  DISCORD_SUPPRESS_DEALER_EMBED: sanitizeConfigValue('DISCORD_SUPPRESS_DEALER_EMBED', _getValue('DISCORD_SUPPRESS_DEALER_EMBED', legacySuppressEmbeds ?? DEFAULTS.DISCORD_SUPPRESS_DEALER_EMBED)),
  DISCORD_SUPPRESS_PRODUCT_EMBED: sanitizeConfigValue('DISCORD_SUPPRESS_PRODUCT_EMBED', _getValue('DISCORD_SUPPRESS_PRODUCT_EMBED', legacySuppressEmbeds ?? DEFAULTS.DISCORD_SUPPRESS_PRODUCT_EMBED)),
  DISCORD_FORUM_TITLE: sanitizeConfigValue('DISCORD_FORUM_TITLE', _getValue('DISCORD_FORUM_TITLE', DEFAULTS.DISCORD_FORUM_TITLE)),
  DISCORD_LAYOUT: sanitizeConfigValue('DISCORD_LAYOUT', (typeof _layoutRaw === 'string' && _layoutRaw.trim()) ? _layoutRaw : DEFAULTS.DISCORD_LAYOUT),
  MIN_OFFERS: sanitizeConfigValue('MIN_OFFERS', _getValue('MIN_OFFERS', DEFAULTS.MIN_OFFERS)),
  SORT_BY_OFFERS: sanitizeConfigValue('SORT_BY_OFFERS', _getValue('SORT_BY_OFFERS', DEFAULTS.SORT_BY_OFFERS)),
  ALARM_ENABLED: sanitizeConfigValue('ALARM_ENABLED', _getValue('ALARM_ENABLED', DEFAULTS.ALARM_ENABLED)),
  ALARM_TARGET_PERCENT: sanitizeConfigValue('ALARM_TARGET_PERCENT', _getValue('ALARM_TARGET_PERCENT', DEFAULTS.ALARM_TARGET_PERCENT)),
  ALARM_DURATION_DAYS: sanitizeConfigValue('ALARM_DURATION_DAYS', _getValue('ALARM_DURATION_DAYS', DEFAULTS.ALARM_DURATION_DAYS)),
  ALARM_AUTO_SUBMIT: sanitizeConfigValue('ALARM_AUTO_SUBMIT', _getValue('ALARM_AUTO_SUBMIT', DEFAULTS.ALARM_AUTO_SUBMIT)),
  ALARM_FALLBACK_TIMEOUT_MS: sanitizeConfigValue('ALARM_FALLBACK_TIMEOUT_MS', _getValue('ALARM_FALLBACK_TIMEOUT_MS', DEFAULTS.ALARM_FALLBACK_TIMEOUT_MS)),
  OBSERVER_DEBOUNCE_MS: sanitizeConfigValue('OBSERVER_DEBOUNCE_MS', _getValue('OBSERVER_DEBOUNCE_MS', DEFAULTS.OBSERVER_DEBOUNCE_MS)),
  DEBUG: sanitizeConfigValue('DEBUG', _getValue('DEBUG', DEFAULTS.DEBUG))
};
export const sanitizeReviewKeyword = raw => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || DEFAULTS.REVIEW_SEARCH_KEYWORD;
// 0% is a legitimate threshold (check everything): only non-numeric storage
// falls back to 30 — `|| 30` would silently discard an explicit 0.
export const realDealMinDiscount = () => (Number.isFinite(CONFIG.REAL_DEAL_MIN_DISCOUNT) ? CONFIG.REAL_DEAL_MIN_DISCOUNT : 30);
// Corrupt storage must never silently break fills: fall back to defaults on
// NaN/unknown durations.
if (!['90', '180', '365', '730'].includes(CONFIG.ALARM_DURATION_DAYS)) CONFIG.ALARM_DURATION_DAYS = '730';
if (CONFIG.REVIEW_SEARCH_KEYWORD === 'KI-Modus') { CONFIG.REVIEW_SEARCH_KEYWORD = DEFAULTS.REVIEW_SEARCH_KEYWORD; CONFIG.REVIEW_SEARCH_AI_MODE = true; }
CONFIG.REVIEW_SEARCH_KEYWORD = sanitizeReviewKeyword(CONFIG.REVIEW_SEARCH_KEYWORD);
if (typeof CONFIG.REVIEW_SEARCH_AI_MODE !== 'boolean') CONFIG.REVIEW_SEARCH_AI_MODE = DEFAULTS.REVIEW_SEARCH_AI_MODE;

export const saveConfigKey = (key, val) => {
  if (SECRET_KEYS.has(key)) return;
  const clean = sanitizeConfigValue(key, val);
  if (clean === undefined) return;
  CONFIG[key] = clean;
  _setValue(key, clean);
};
// Bell-decor repaint hook: price-alarm.js registers refreshAlarmBellDecor
// here (a static import would cycle config ← price-alarm; the concat-IIFE
// bundler also drops dynamic import()). syncUiControl notifies on alarm keys.
let alarmConfigListener = null;
export function setAlarmConfigListener(fn) {
  alarmConfigListener = typeof fn === 'function' ? fn : null;
}
const notifyAlarmConfig = () => {
  try { alarmConfigListener?.(); } catch (err) {
    if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] alarm repaint error', err);
  }
};


export function updateBodyClasses() {
  if (typeof document === 'undefined' || !document.body) return;
  document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
}

export function syncUiControl(key, val, opts = {}) {
  // 1. Sync Settings Modal (Shadow DOM) if open/exists
  const shadow = uiShadowRoot || (typeof document !== 'undefined' ? document.getElementById('tp-root')?.shadowRoot : null);
  if (shadow) {
    try {
      switch (key) {
        case 'DIM_OPACITY': {
          const range = shadow.getElementById('tp-opacity-range');
          const label = shadow.getElementById('tp-opacity-val');
          if (range) range.value = val;
          if (label) label.value = Math.round(val * 100);
          break;
        }
        case 'HEATMAP_INTENSITY': {
          const range = shadow.getElementById('tp-heatmap-intensity-range');
          const valEl = shadow.getElementById('tp-heatmap-intensity-val');
          const pct = Math.round((val ?? 1.0) * 100);
          if (range) range.value = pct;
          if (valEl) valEl.value = pct;
          break;
        }
        case 'MARGIN_PERCENT': {
          const range = shadow.getElementById('tp-margin-range');
          const valEl = shadow.getElementById('tp-margin-val');
          if (range) range.value = val;
          if (valEl) valEl.value = val;
          break;
        }
        case 'SORT_BY_OFFERS': {
          const radio = shadow.querySelector(`input[name="tp-sort-offers"][value="${val}"]`);
          if (radio) radio.checked = true;
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
          if (valEl) valEl.value = pct;
          if (descEl) {
            descEl.textContent = weightText(val, 'desc');
          }
          // Toolbar slider mirrors the modal control (skip while dragging).
          if (typeof document !== 'undefined') {
            const barRange = document.getElementById('tp-bar-weight-range');
            if (barRange && document.activeElement !== barRange) barRange.value = pct;
            const barLabel = document.getElementById('tp-bar-weight-label');
            if (barLabel) {
              barLabel.textContent = `⚖️ ${weightText(val, 'short')}`;
              barLabel.title = weightText(val, 'title');
            }
          }
          break;
        }
        case 'BESTPREISE_MIN_POINTS': {
          paintMinPoints(val, shadow);
          break;
        }
        case 'BESTPREISE_MEDIAN_HORIZON_DAYS': {
          const stored = val ?? 365;
          const horizonRange = shadow.getElementById('tp-bestpreise-horizon-range');
          if (horizonRange) horizonRange.value = horizonStoredToUi(stored);
          const horizonVal = shadow.getElementById('tp-bestpreise-horizon-val');
          if (horizonVal) horizonVal.value = stored;
          const horizonDesc = shadow.getElementById('tp-bestpreise-horizon-desc');
          if (horizonDesc) horizonDesc.textContent = `Ø-Vergleich: ${horizonText(stored)} — Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis`;
          // Toolbar range mirrors the modal control (skip while interacting).
          if (typeof document !== 'undefined') {
            const barRange = document.getElementById('tp-bar-horizon-range');
            if (barRange && document.activeElement !== barRange) {
              barRange.value = horizonStoredToUi(stored);
              const barLabel = document.getElementById('tp-bar-horizon-label');
              if (barLabel) {
                barLabel.textContent = horizonText(stored);
                barLabel.title = horizonText(stored, 'title');
              }
            }
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
        case 'USE_SHIPPING_PRICE': {
          const toggle = shadow.getElementById('tp-shipping-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'ENABLE_SPARKLINES': {
          const toggle = shadow.getElementById('tp-sparklines-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'DEALER_AUTOFETCH': {
          const toggle = shadow.getElementById('tp-dealer-autofetch-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'REVIEW_SEARCH_ENABLED': {
          const toggle = shadow.getElementById('tp-review-search-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'REVIEW_SEARCH_KEYWORD': {
          const input = shadow.getElementById('tp-review-keyword-input');
          if (input) input.value = val;
          break;
        }
        case 'REVIEW_SEARCH_AI_MODE': {
          const toggle = shadow.getElementById('tp-review-ai-mode-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'DISCORD_SUPPRESS_DEALER_EMBED': {
          const toggle = shadow.getElementById('tp-discord-dealer-embed-toggle');
          if (toggle) toggle.checked = val === false;
          break;
        }
        case 'DISCORD_SUPPRESS_PRODUCT_EMBED': {
          const toggle = shadow.getElementById('tp-discord-product-embed-toggle');
          if (toggle) toggle.checked = val === false;
          break;
        }
        case 'ALARM_ENABLED': {
          const toggle = shadow.getElementById('tp-alarm-enabled-toggle');
          if (toggle) toggle.checked = val !== false;
          if (!opts.silent) notifyAlarmConfig();
          break;
        }
        case 'ALARM_TARGET_PERCENT': {
          const pct = Math.round((Number.isFinite(val) ? val : 0.60) * 100);
          const range = shadow.getElementById('tp-alarm-target-range');
          const num = shadow.getElementById('tp-alarm-target-val');
          if (range) range.value = pct;
          if (num) num.value = pct;
          if (!opts.silent) notifyAlarmConfig();
          break;
        }
        case 'ALARM_DURATION_DAYS': {
          const radio = shadow.querySelector(`input[name="tp-alarm-duration"][value="${val}"]`);
          if (radio) radio.checked = true;
          if (!opts.silent) notifyAlarmConfig();
          break;
        }
        case 'ALARM_AUTO_SUBMIT': {
          const toggle = shadow.getElementById('tp-alarm-autosubmit-toggle');
          if (toggle) toggle.checked = val !== false;
          if (!opts.silent) notifyAlarmConfig();
          break;
        }
      }
    } catch (err) {
      console.warn('[Toppreise-Suite] syncUiControl error', err);
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
            if (heatBtn) {
              heatBtn.classList.toggle('tp-active', val !== false);
              heatBtn.setAttribute('aria-pressed', String(val !== false));
            }
            break;
          }
          case 'BESTPREISE_MODE_ACTIVE': {
            const bpBtn = bar.querySelector('#tp-bar-bestpreise-btn');
            if (bpBtn) bpBtn.classList.toggle('tp-bestpreise-active', val === true);
            bar.classList.toggle('tp-bestpreise-bar', val === true);
            break;
          }
          case 'BESTPREISE_HIDE_UNCHECKED': {
            paintCycleButtons(bar, 'HIDE_UNCHECKED_MODE');
            break;
          }
          case 'BESTPREISE_INCLUDE_VORTIEF': {
            paintCycleButtons(bar, 'VORTIEF_MODE');
            break;
          }
          case 'OUTLIER_REJECTION_ENABLED': {
            syncMiniToggle(bar.querySelector('#tp-bar-outlier-toggle'), val !== false, 'Ausreißer-Filter');
            const dim = val === false;
            for (const id of ['tp-bar-outlier-band-wrapper', 'tp-bar-outlier-hours-wrapper']) {
              const wrap = bar.querySelector('#' + id);
              if (wrap) wrap.classList.toggle('tp-tool-dim', dim);
            }
            break;
          }
          case 'OUTLIER_DEVIATION_BAND': {
            const pct = Math.min(50, Math.max(1, Math.round((val ?? 0.5) * 100)));
            const bandRange = bar.querySelector('#tp-bar-outlier-band-range');
            if (bandRange && document.activeElement !== bandRange) bandRange.value = pct;
            const bandLabel = bar.querySelector('#tp-bar-outlier-band-label');
            if (bandLabel) bandLabel.textContent = `±${pct} %`;
            break;
          }
          case 'OUTLIER_MAX_GLITCH_HOURS': {
            const hrs = Math.min(168, Math.max(24, parseInt(val ?? 48, 10) || 48));
            const hoursRange = bar.querySelector('#tp-bar-outlier-hours-range');
            if (hoursRange && document.activeElement !== hoursRange) hoursRange.value = hrs;
            const hoursLabel = bar.querySelector('#tp-bar-outlier-hours-label');
            if (hoursLabel) hoursLabel.textContent = `${hrs} h`;
            break;
          }
          case 'FILTER_NEG_MODE':
          case 'FILTER_MIN_MODE':
          case 'HIDE_UNCHECKED_MODE':
          case 'VORTIEF_MODE': {
            paintCycleButtons(bar, key);
            break;
          }
          case 'DEALER_MODE': {
            const mode = (val === 'dim' || val === 'highlight') ? val : 'hide';
            bar.querySelectorAll(`[data-mode-key="${key}"]`).forEach(btn => {
              btn.classList.toggle('tp-active', true);
              btn.classList.toggle('tp-state-highlight', mode === 'highlight');
              btn.textContent = mode === 'highlight' ? 'Hervorheben' : mode === 'dim' ? 'Dimmen' : 'Verbergen';
            });
            break;
          }
          case 'FILTER_NEG_ENABLED': {
            paintCycleButtons(bar, 'FILTER_NEG_MODE');
            bar.querySelector('.tp-input-field-box')?.classList.toggle('tp-tool-dim', !val);
            break;
          }
          case 'FILTER_MIN_ENABLED': {
            paintCycleButtons(bar, 'FILTER_MIN_MODE');
            bar.querySelector('#tp-bar-min-offers-group')?.classList.toggle('tp-tool-dim', !val);
            break;
          }
          case 'MIN_OFFERS': {
            const minVal = bar.querySelector('#tp-bar-min-val');
            if (minVal) minVal.textContent = val;
            break;
          }
          case 'REAL_DEAL_MIN_DISCOUNT': {
            // Threshold lives only in the floating CTA (toolbar copy removed).
            const floatingThresh = document.getElementById('tp-floating-threshold-btn');
            if (floatingThresh) floatingThresh.textContent = `≥${val}% ▾`;
            document.querySelectorAll('#tp-floating-threshold-popover .tp-floating-option').forEach(btn => {
              btn.classList.toggle('tp-selected', parseInt(btn.dataset.val, 10) === val);
            });
            break;
          }
        }
      } catch (err) {
        console.warn('[Toppreise-Suite] syncUiControl bar error', err);
      }
    }
  }
}

// Alarm-only changes repaint just the bell (via syncUiControl) — a full
// processListings() re-render would be wasted work on every settings save.
const ALARM_ONLY_KEYS = new Set(['ALARM_ENABLED', 'ALARM_TARGET_PERCENT', 'ALARM_DURATION_DAYS', 'ALARM_AUTO_SUBMIT']);
export function updateConfig(key, val, options = {}) {
  if (SECRET_KEYS.has(key)) { CONFIG[key] = val; _setValue(key, val); }
  else {
    const clean = sanitizeConfigValue(key, val);
    if (clean === undefined) return;
    val = clean;
    saveConfigKey(key, val);
  }
  if (!options.skipUiSync) {
    syncUiControl(key, val);
  }
  if (key === 'DIM_OPACITY') {
    updateBodyClasses();
  }
  if (!options.skipRender && !ALARM_ONLY_KEYS.has(key) && typeof processListings === 'function') {
    processListings();
  }
}

export function updateConfigs(entries, options = {}) {
  for (const [k, v] of Object.entries(entries)) {
    updateConfig(k, v, { ...options, skipRender: true });
  }
  const needsRender = !options.skipRender && Object.keys(entries).some(k => !ALARM_ONLY_KEYS.has(k));
  if (needsRender && typeof processListings === 'function') {
    processListings();
  }
}
// Re-exports: storage/schema/migrate symbols moved to siblings — every
// existing `from './state/config.js'` / `'../state/config.js'` path keeps working.
import { SETTING_SCHEMA } from './config-store.js';
export { SECRET_KEYS, _getValue, _setValue, DEFAULTS, SETTING_SCHEMA, sanitizeConfigValue, weightText, horizonText, horizonUiToStored, horizonStoredToUi };
export { migrateLegacyDebug, migrateHideToDimDefaults, migrateFilterSplit };

