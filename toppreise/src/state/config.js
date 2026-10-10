/**
 * Configuration & Persistent Settings State Layer
 * Manages defaults, GM_getValue/localStorage synchronization,
 * active configuration object, and bidirectional UI control sync.
 */

import { uiShadowRoot } from '../ui/shell.js';

// One vocabulary everywhere: the Gewichtete Differenz (weight-blended
// Ø-discount + record margin) prints on the badge and drives color + order.
// The worked example uses fixed demo numbers so dragging the slider visibly
// moves the result (Rek −10%, Ø −25%).
export function weightText(weightRecord, style) {
  const w = weightRecord ?? 0.50;
  if (style === 'short') {
    const n = Math.round(w * 20) / 20;
    if (n === 1.00) return '100% Rek';
    if (n === 0.70) return '70/30';
    if (n === 0.50) return '50/50';
    if (n === 0.30) return '30/70';
    if (n === 0.00) return '100% Med';
    return `${Math.round(w * 100)}% Rek`;
  }
  if (style === 'title') {
    const pctRec = Math.round(w * 100);
    return `Tiefstpreis-Gewichtung: ${100 - pctRec}% Ø-Preis / ${pctRec}% Rekord — Reihenfolge + Farb-Emphase, Badge zeigt die Gewichtete Differenz.`;
  }
  const pct = Math.round(w * 100);
  const weightedDiff = Math.round(((100 - pct) * 25 + pct * 10) / 100);
  const base = pct === 100 ? 'Rekord-Sortierung (100% Rekord / 0% Ø-Preis)'
    : pct === 0 ? 'Ø-Sortierung (0% Rekord / 100% Ø-Preis)'
    : `${pct}% Rekord / ${100 - pct}% Ø-Preis`;
  return `${base} (Sortierung + Farb-Emphase) · z.B. Rek −10% + Ø −25% → Gewichtete Differenz ${weightedDiff}`;
}

export const DEFAULTS = Object.freeze({
  FILTER_NEG_ENABLED: true,
  FILTER_MIN_ENABLED: true,
  MODE: 'dim',
  MARGIN_PERCENT: 0.0,
  DIM_OPACITY: 0.25,
  USE_SHIPPING_PRICE: true,
  HEATMAP_ENABLED: true,
  HEATMAP_INTENSITY: 1.0,
  REAL_DEAL_MIN_DISCOUNT: 30,
  REAL_DEAL_CACHE_HOURS: 48,
  NEGATIVE_CACHE_HOURS: 2,
  BESTPREISE_MODE_ACTIVE: false,
  BESTPREISE_HIDE_UNCHECKED: false,
  BESTPREISE_INCLUDE_VORTIEF: true,
  BESTPREISE_WEIGHT_RECORD: 0.50,
  BESTPREISE_MIN_POINTS: 5,
  BESTPREISE_MEDIAN_HORIZON_DAYS: 365,
  OUTLIER_REJECTION_ENABLED: true,
  ENABLE_SPARKLINES: true,
  DEALER_AUTOFETCH: false,
  NEGATIVE_TERMS: '',
  DISCORD_WEBHOOK_URL: '',
  MIN_OFFERS: 0,
  SORT_BY_OFFERS: 'none',
  ALARM_ENABLED: true,
  ALARM_TARGET_PERCENT: 0.60,
  ALARM_DURATION_DAYS: '730',
  ALARM_AUTO_SUBMIT: true,
  OBSERVER_DEBOUNCE_MS: 200,
  SHOW_ADVANCED: false,
  DEBUG: false
});

// Compact GM_getValue + localStorage mirror. Writes go to both layers so a
// domain backup survives script reinstalls; reads prefer GM, fall back to
// the backup (reinstall recovery), then def. Corrupt JSON never throws.
const safeJsonParse = (raw, fallback) => {
  try {
    const v = JSON.parse(raw ?? 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
// Bearer-Secrets (Discord-Webhook) bleiben GM-privat: nie ins page-lesbare localStorage.
const SECRET_KEYS = new Set(['DISCORD_WEBHOOK_URL']);

export const _getValue = (k, def) => {
  try {
    if (typeof GM_getValue !== 'undefined') {
      const gv = GM_getValue(k);
      if (gv !== undefined && gv !== null) return gv;
    }
  } catch { /* fall through to domain backup */ }
  try {
    if (!SECRET_KEYS.has(k) && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('tp_suite_v2_' + k);
      if (raw !== null) return safeJsonParse(raw, def);
    }
  } catch { /* fall through to def */ }
  return def;
};
export const _setValue = (k, v) => {
  try { if (typeof GM_setValue !== 'undefined') GM_setValue(k, v); } catch { /* ignore */ }
  // Secrets nie ins page-lesbare localStorage spiegeln (GM bleibt privat).
  if (!SECRET_KEYS.has(k)) try { if (typeof localStorage !== 'undefined') localStorage.setItem('tp_suite_v2_' + k, JSON.stringify(v)); } catch { /* storage full/private mode */ }
};

// One-time migration: DEBUG default flipped true→false, but stored true
// persists via _getValue precedence. No settings UI ever wrote DEBUG
// (modal import/export skips it), so stored true came only from console —
// silence it once. Marker keeps this a single read per load afterwards.
export function migrateLegacyDebug() {
  if (_getValue('MIGRATED_DEBUG_OFF', false)) return false;
  _setValue('DEBUG', false);
  _setValue('MIGRATED_DEBUG_OFF', true);
  return true;
}
migrateLegacyDebug();

export const CONFIG = {
  FILTER_NEG_ENABLED: _getValue('FILTER_NEG_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_NEG_ENABLED)),
  FILTER_MIN_ENABLED: _getValue('FILTER_MIN_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_MIN_ENABLED)),
  MODE: _getValue('MODE', DEFAULTS.MODE),
  MARGIN_PERCENT: parseFloat(_getValue('MARGIN_PERCENT', DEFAULTS.MARGIN_PERCENT)),
  DIM_OPACITY: parseFloat(_getValue('DIM_OPACITY', DEFAULTS.DIM_OPACITY)),
  USE_SHIPPING_PRICE: _getValue('USE_SHIPPING_PRICE', DEFAULTS.USE_SHIPPING_PRICE),
  HEATMAP_ENABLED: _getValue('HEATMAP_ENABLED', DEFAULTS.HEATMAP_ENABLED),
  HEATMAP_INTENSITY: parseFloat(_getValue('HEATMAP_INTENSITY', DEFAULTS.HEATMAP_INTENSITY)),
  REAL_DEAL_MIN_DISCOUNT: parseInt(_getValue('REAL_DEAL_MIN_DISCOUNT', DEFAULTS.REAL_DEAL_MIN_DISCOUNT)),
  REAL_DEAL_CACHE_HOURS: parseInt(_getValue('REAL_DEAL_CACHE_HOURS', DEFAULTS.REAL_DEAL_CACHE_HOURS)),
  NEGATIVE_CACHE_HOURS: parseInt(_getValue('NEGATIVE_CACHE_HOURS', DEFAULTS.NEGATIVE_CACHE_HOURS)),
  BESTPREISE_MODE_ACTIVE: _getValue('BESTPREISE_MODE_ACTIVE', DEFAULTS.BESTPREISE_MODE_ACTIVE),
  BESTPREISE_HIDE_UNCHECKED: _getValue('BESTPREISE_HIDE_UNCHECKED', DEFAULTS.BESTPREISE_HIDE_UNCHECKED),
  BESTPREISE_INCLUDE_VORTIEF: _getValue('BESTPREISE_INCLUDE_VORTIEF', DEFAULTS.BESTPREISE_INCLUDE_VORTIEF),
  BESTPREISE_WEIGHT_RECORD: parseFloat(_getValue('BESTPREISE_WEIGHT_RECORD', DEFAULTS.BESTPREISE_WEIGHT_RECORD)),
  BESTPREISE_MIN_POINTS: parseInt(_getValue('BESTPREISE_MIN_POINTS', DEFAULTS.BESTPREISE_MIN_POINTS)),
  BESTPREISE_MEDIAN_HORIZON_DAYS: parseInt(_getValue('BESTPREISE_MEDIAN_HORIZON_DAYS', DEFAULTS.BESTPREISE_MEDIAN_HORIZON_DAYS)),
  OUTLIER_REJECTION_ENABLED: _getValue('OUTLIER_REJECTION_ENABLED', DEFAULTS.OUTLIER_REJECTION_ENABLED),
  ENABLE_SPARKLINES: _getValue('ENABLE_SPARKLINES', DEFAULTS.ENABLE_SPARKLINES),
  DEALER_AUTOFETCH: _getValue('DEALER_AUTOFETCH', DEFAULTS.DEALER_AUTOFETCH),
  NEGATIVE_TERMS: _getValue('NEGATIVE_TERMS', DEFAULTS.NEGATIVE_TERMS),
  DISCORD_WEBHOOK_URL: _getValue('DISCORD_WEBHOOK_URL', DEFAULTS.DISCORD_WEBHOOK_URL),
  MIN_OFFERS: parseInt(_getValue('MIN_OFFERS', DEFAULTS.MIN_OFFERS)),
  SORT_BY_OFFERS: _getValue('SORT_BY_OFFERS', DEFAULTS.SORT_BY_OFFERS),
  ALARM_ENABLED: _getValue('ALARM_ENABLED', DEFAULTS.ALARM_ENABLED),
  ALARM_TARGET_PERCENT: parseFloat(_getValue('ALARM_TARGET_PERCENT', DEFAULTS.ALARM_TARGET_PERCENT)),
  ALARM_DURATION_DAYS: String(_getValue('ALARM_DURATION_DAYS', DEFAULTS.ALARM_DURATION_DAYS)),
  ALARM_AUTO_SUBMIT: _getValue('ALARM_AUTO_SUBMIT', DEFAULTS.ALARM_AUTO_SUBMIT),
  OBSERVER_DEBOUNCE_MS: parseInt(_getValue('OBSERVER_DEBOUNCE_MS', DEFAULTS.OBSERVER_DEBOUNCE_MS)),
  SHOW_ADVANCED: _getValue('SHOW_ADVANCED', DEFAULTS.SHOW_ADVANCED),
  DEBUG: _getValue('DEBUG', DEFAULTS.DEBUG)
};

export const saveConfigKey = (key, val) => {
  CONFIG[key] = val;
  _setValue(key, val);
};


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
          if (label) label.value = Math.round(val * 100);
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
        case 'BESTPREISE_HIDE_UNCHECKED': {
          const toggle = shadow.getElementById('tp-hide-unchecked-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'BESTPREISE_INCLUDE_VORTIEF': {
          const toggle = shadow.getElementById('tp-include-vortief-toggle');
          if (toggle) toggle.checked = val !== false;
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
          const num = Math.max(5, Math.min(100, parseInt(val, 10) || 5));
          const range = shadow.getElementById('tp-bestpreise-minpoints-range');
          const valEl = shadow.getElementById('tp-bestpreise-minpoints-val');
          if (range) range.value = num;
          if (valEl) valEl.value = num;
          if (typeof document !== 'undefined') {
            const barRange = document.getElementById('tp-bar-minpoints-range');
            if (barRange && document.activeElement !== barRange) barRange.value = num;
            const barLabel = document.getElementById('tp-bar-minpoints-label');
            if (barLabel) barLabel.textContent = `📊 ${num} Pkt`;
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
        case 'SHOW_ADVANCED': {
          const details = shadow.getElementById('tp-advanced-details');
          if (details) details.open = !!val;
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
            const uncheckedBtn = bar.querySelector('#tp-bar-unchecked-btn');
            if (uncheckedBtn) {
              uncheckedBtn.classList.toggle('tp-active', val === true);
              uncheckedBtn.setAttribute('aria-pressed', String(val === true));
              uncheckedBtn.title = val === true ? '✓ Nur geprüfte aktiv — klicken zum Aufheben (Ursache, folgt der Anzeige)' : '✓ Nur geprüfte: ungeprüfte filtern (Ursache, folgt der Anzeige)';
            }
            break;
          }
          case 'FILTER_NEG_ENABLED': {
            const toggle = bar.querySelector('#tp-toggle-neg');
            if (toggle) {
              if (toggle.tagName === 'INPUT') {
                toggle.checked = !!val;
                const title = `Negativ-Filter (Text) ${val ? 'AN' : 'AUS'}`;
                const label = toggle.closest?.('.tp-mini-switch');
                if (label) label.title = title;
                const state = label?.querySelector('.tp-mini-state');
                if (state) state.textContent = val ? 'ON' : 'OFF';
              } else {
                toggle.classList.toggle('tp-active', !!val);
                toggle.classList.toggle('tp-filter-off', !val);
                toggle.title = `Negativ-Filter (Text) ${val ? 'AN' : 'AUS'}`;
              }
            }
            break;
          }
          case 'FILTER_MIN_ENABLED': {
            const toggle = bar.querySelector('#tp-toggle-min');
            if (toggle) {
              if (toggle.tagName === 'INPUT') {
                toggle.checked = !!val;
                const title = `Min-Angebote-Filter ${val ? 'AN' : 'AUS'}`;
                const label = toggle.closest?.('.tp-mini-switch');
                if (label) label.title = title;
                const state = label?.querySelector('.tp-mini-state');
                if (state) state.textContent = val ? 'ON' : 'OFF';
              } else {
                toggle.classList.toggle('tp-active', !!val);
                toggle.classList.toggle('tp-filter-off', !val);
                toggle.title = `Min-Angebote-Filter ${val ? 'AN' : 'AUS'}`;
              }
            }
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
  if (key === 'MODE' || key === 'DIM_OPACITY') {
    updateBodyClasses();
  }
  if (!options.skipRender && typeof processListings === 'function') {
    processListings();
  }
}

export function updateConfigs(entries, options = {}) {
  for (const [k, v] of Object.entries(entries)) {
    updateConfig(k, v, { ...options, skipRender: true });
  }
  if (!options.skipRender && typeof processListings === 'function') {
    processListings();
  }
}

