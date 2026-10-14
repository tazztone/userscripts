/**
 * Configuration & Persistent Settings State Layer
 * Manages defaults, GM_getValue/localStorage synchronization,
 * active configuration object, and bidirectional UI control sync.
 */

import { uiShadowRoot } from '../ui/shell.js';
import { syncMiniToggle } from '../ui/mini-toggle.js';

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

export function horizonText(days, style = 'short') {
  const d = (typeof days !== 'number' || isNaN(days) || days < 0) ? 365 : days;
  if (style === 'title') {
    if (d === 0) return 'Median-Berechnungszeitraum: gesamte Historie (Lifetime)';
    if (d === 365) return 'Median-Berechnungszeitraum: 1 Jahr (365 Tage) [Empfohlen]';
    return `Median-Berechnungszeitraum: ${d} Tage`;
  }
  if (d === 0) return 'Lifetime';
  if (d === 365) return '1J';
  return `${d}T`;
}

export const DEFAULTS = Object.freeze({
  FILTER_NEG_ENABLED: false,
  FILTER_MIN_ENABLED: false,
  FILTER_NEG_MODE: 'dim',
  FILTER_MIN_MODE: 'dim',
  HIDE_UNCHECKED_MODE: 'dim',
  VORTIEF_MODE: 'dim',
  DEALER_MODE: 'dim',
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
  OUTLIER_DEVIATION_BAND: 0.60,
  OUTLIER_MAX_GLITCH_HOURS: 48,
  ENABLE_SPARKLINES: true,
  DEALER_AUTOFETCH: false,
  NEGATIVE_TERMS: '',
  DISCORD_WEBHOOK_URL: '',
  DISCORD_SUPPRESS_DEALER_EMBED: true,
  DISCORD_SUPPRESS_PRODUCT_EMBED: true,
  // mirror of DEFAULT_LAYOUT in features/share-discord.js (drift-checked in share-discord.test.js)
  DISCORD_LAYOUT: '## {title}\n# {price}\n# {dealer} +{offers}\n{spark}\n{prevlow}\n{median}\n{link}',
  MIN_OFFERS: 0,
  SORT_BY_OFFERS: 'none',
  ALARM_ENABLED: true,
  ALARM_TARGET_PERCENT: 0.60,
  ALARM_DURATION_DAYS: '730',
  ALARM_AUTO_SUBMIT: true,
  OBSERVER_DEBOUNCE_MS: 200,
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
// One-time migration: filter-mode defaults flipped hide→dim. Stored 'hide'
// (silent default or explicit choice) moves to 'dim' once; the toggle stays
// one click away. Marker keeps this a single pass per profile afterwards.
export function migrateHideToDimDefaults() {
  if (_getValue('MIGRATED_DIM_DEFAULT', false)) return false;
  for (const k of ['FILTER_NEG_MODE', 'FILTER_MIN_MODE', 'HIDE_UNCHECKED_MODE', 'VORTIEF_MODE', 'DEALER_MODE']) {
    if (_getValue(k, DEFAULTS[k]) !== 'dim') _setValue(k, 'dim');
  }
  _setValue('MIGRATED_DIM_DEFAULT', true);
  return true;
}
migrateHideToDimDefaults();
migrateLegacyDebug();
// One-time migration: MODE (highlight/dim/hide) deleted — Filtern removes,
// Ansicht paints. Clears the stale stored key once so the mode toast fires
// exactly once per user (marker-guarded, silent afterwards). The 'MODE'
// literals below are that intentional cleanup — exempt from the MODE-zero sweep.
export function migrateFilterSplit() {
  if (_getValue('MIGRATED_FILTER_SPLIT', false)) return { hadMode: false, modeWasActive: false };
  let storedMode;
  let hadMode = false;
  if (typeof GM_getValue !== 'undefined') {
    try {
      storedMode = GM_getValue('MODE');
      if (typeof storedMode !== 'undefined') hadMode = true;
    } catch { /* ignore */ }
  }
  if (!hadMode) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('tp_suite_v2_MODE') !== null) hadMode = true;
    } catch { /* ignore */ }
  }
  const modeWasActive = _getValue('BESTPREISE_MODE_ACTIVE', false) === true;
  try {
    if (typeof GM_deleteValue !== 'undefined') GM_deleteValue('MODE');
  } catch { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('tp_suite_v2_MODE');
  } catch { /* ignore */ }
  _setValue('MIGRATED_FILTER_SPLIT', true);
  return { hadMode, modeWasActive };
}
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
// Filter hide/dim modes: only 'dim' opts into dimming, everything else hides.
const _modeValue = k => _getValue(k, DEFAULTS[k]) === 'dim' ? 'dim' : 'hide';
// 3-state filter cycle: each cause row pairs an enable key with a dim/hide
// mode key. The cycle button derives Aus/Dimmen/Verbergen from the pair —
// storage keys unchanged, no migration. Dealer row excluded (2-state preset).
export const FILTER_CYCLE = Object.freeze({
  FILTER_NEG_MODE: { enable: 'FILTER_NEG_ENABLED', on: true },
  FILTER_MIN_MODE: { enable: 'FILTER_MIN_ENABLED', on: true },
  HIDE_UNCHECKED_MODE: { enable: 'BESTPREISE_HIDE_UNCHECKED', on: true },
  VORTIEF_MODE: { enable: 'BESTPREISE_INCLUDE_VORTIEF', on: false },
});
export const cycleStateOf = modeKey => {
  const pair = FILTER_CYCLE[modeKey];
  if (!pair) return CONFIG[modeKey] === 'hide' ? 'hide' : 'dim';
  if (CONFIG[pair.enable] !== pair.on) return 'off';
  return CONFIG[modeKey] === 'hide' ? 'hide' : 'dim';
};
// Toolbar owns the cycle button element; config owns the state mapping.
// Duplicate of the toolbar paint (config→toolbar imports only, never reverse).
const paintCycleButtons = (bar, modeKey) => {
  const s = cycleStateOf(modeKey);
  bar.querySelectorAll(`[data-mode-key="${modeKey}"]`).forEach(btn => {
    btn.textContent = s === 'off' ? 'Aus' : s === 'dim' ? 'Dimmen' : 'Verbergen';
    btn.classList.toggle('tp-active', s !== 'off');
    btn.title = s === 'off' ? 'Filter: Aus — klicken für Dimmen' : s === 'dim' ? 'Filter: Dimmen — klicken für Verbergen' : 'Filter: Verbergen — klicken für Aus';
  });
};


export const CONFIG = {
  FILTER_NEG_ENABLED: _getValue('FILTER_NEG_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_NEG_ENABLED)),
  FILTER_MIN_ENABLED: _getValue('FILTER_MIN_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_MIN_ENABLED)),
  FILTER_NEG_MODE: _modeValue('FILTER_NEG_MODE'),
  FILTER_MIN_MODE: _modeValue('FILTER_MIN_MODE'),
  HIDE_UNCHECKED_MODE: _modeValue('HIDE_UNCHECKED_MODE'),
  VORTIEF_MODE: _modeValue('VORTIEF_MODE'),
  DEALER_MODE: _modeValue('DEALER_MODE'),
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
  OUTLIER_DEVIATION_BAND: parseFloat(_getValue('OUTLIER_DEVIATION_BAND', DEFAULTS.OUTLIER_DEVIATION_BAND)),
  OUTLIER_MAX_GLITCH_HOURS: parseInt(_getValue('OUTLIER_MAX_GLITCH_HOURS', DEFAULTS.OUTLIER_MAX_GLITCH_HOURS)),
  ENABLE_SPARKLINES: _getValue('ENABLE_SPARKLINES', DEFAULTS.ENABLE_SPARKLINES),
  DEALER_AUTOFETCH: _getValue('DEALER_AUTOFETCH', DEFAULTS.DEALER_AUTOFETCH),
  NEGATIVE_TERMS: _getValue('NEGATIVE_TERMS', DEFAULTS.NEGATIVE_TERMS),
  DISCORD_WEBHOOK_URL: _getValue('DISCORD_WEBHOOK_URL', DEFAULTS.DISCORD_WEBHOOK_URL),
  DISCORD_SUPPRESS_DEALER_EMBED: _getValue('DISCORD_SUPPRESS_DEALER_EMBED', legacySuppressEmbeds ?? DEFAULTS.DISCORD_SUPPRESS_DEALER_EMBED),
  DISCORD_SUPPRESS_PRODUCT_EMBED: _getValue('DISCORD_SUPPRESS_PRODUCT_EMBED', legacySuppressEmbeds ?? DEFAULTS.DISCORD_SUPPRESS_PRODUCT_EMBED),
  DISCORD_LAYOUT: (typeof _layoutRaw === 'string' && _layoutRaw.trim()) ? _layoutRaw : DEFAULTS.DISCORD_LAYOUT,
  MIN_OFFERS: parseInt(_getValue('MIN_OFFERS', DEFAULTS.MIN_OFFERS)),
  SORT_BY_OFFERS: _getValue('SORT_BY_OFFERS', DEFAULTS.SORT_BY_OFFERS),
  ALARM_ENABLED: _getValue('ALARM_ENABLED', DEFAULTS.ALARM_ENABLED),
  ALARM_TARGET_PERCENT: parseFloat(_getValue('ALARM_TARGET_PERCENT', DEFAULTS.ALARM_TARGET_PERCENT)),
  ALARM_DURATION_DAYS: String(_getValue('ALARM_DURATION_DAYS', DEFAULTS.ALARM_DURATION_DAYS)),
  ALARM_AUTO_SUBMIT: _getValue('ALARM_AUTO_SUBMIT', DEFAULTS.ALARM_AUTO_SUBMIT),
  OBSERVER_DEBOUNCE_MS: parseInt(_getValue('OBSERVER_DEBOUNCE_MS', DEFAULTS.OBSERVER_DEBOUNCE_MS)),
  DEBUG: _getValue('DEBUG', DEFAULTS.DEBUG)
};
// Corrupt storage must never silently break fills: clamp percent to the
// modal save bounds, fall back to defaults on NaN/unknown durations.
if (!Number.isFinite(CONFIG.ALARM_TARGET_PERCENT)) CONFIG.ALARM_TARGET_PERCENT = DEFAULTS.ALARM_TARGET_PERCENT;
else CONFIG.ALARM_TARGET_PERCENT = Math.min(0.99, Math.max(0.05, CONFIG.ALARM_TARGET_PERCENT));
if (!['90', '180', '365', '730'].includes(CONFIG.ALARM_DURATION_DAYS)) CONFIG.ALARM_DURATION_DAYS = '730';
if (!Number.isFinite(CONFIG.OUTLIER_DEVIATION_BAND)) CONFIG.OUTLIER_DEVIATION_BAND = DEFAULTS.OUTLIER_DEVIATION_BAND;
else CONFIG.OUTLIER_DEVIATION_BAND = Math.min(0.90, Math.max(0.20, CONFIG.OUTLIER_DEVIATION_BAND));
if (!Number.isFinite(CONFIG.OUTLIER_MAX_GLITCH_HOURS)) CONFIG.OUTLIER_MAX_GLITCH_HOURS = DEFAULTS.OUTLIER_MAX_GLITCH_HOURS;
else CONFIG.OUTLIER_MAX_GLITCH_HOURS = Math.min(168, Math.max(12, CONFIG.OUTLIER_MAX_GLITCH_HOURS));

export const saveConfigKey = (key, val) => {
  CONFIG[key] = val;
  _setValue(key, val);
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

export function syncUiControl(key, val) {
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
          if (horizonRange) horizonRange.value = stored === 0 ? 760 : stored;
          const horizonVal = shadow.getElementById('tp-bestpreise-horizon-val');
          if (horizonVal) horizonVal.value = stored;
          const horizonDesc = shadow.getElementById('tp-bestpreise-horizon-desc');
          if (horizonDesc) horizonDesc.textContent = `Ø-Vergleich: ${horizonText(stored)} — Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis`;
          // Toolbar range mirrors the modal control (skip while interacting).
          if (typeof document !== 'undefined') {
            const barRange = document.getElementById('tp-bar-horizon-range');
            if (barRange && document.activeElement !== barRange) {
              barRange.value = stored === 0 ? 760 : stored;
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
          notifyAlarmConfig();
          break;
        }
        case 'ALARM_TARGET_PERCENT': {
          const pct = Math.round((Number.isFinite(val) ? val : 0.60) * 100);
          const range = shadow.getElementById('tp-alarm-target-range');
          const num = shadow.getElementById('tp-alarm-target-val');
          if (range) range.value = pct;
          if (num) num.value = pct;
          notifyAlarmConfig();
          break;
        }
        case 'ALARM_DURATION_DAYS': {
          const radio = shadow.querySelector(`input[name="tp-alarm-duration"][value="${val}"]`);
          if (radio) radio.checked = true;
          notifyAlarmConfig();
          break;
        }
        case 'ALARM_AUTO_SUBMIT': {
          const toggle = shadow.getElementById('tp-alarm-autosubmit-toggle');
          if (toggle) toggle.checked = val !== false;
          notifyAlarmConfig();
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
            const pct = Math.min(90, Math.max(20, Math.round((val ?? 0.6) * 100)));
            const bandRange = bar.querySelector('#tp-bar-outlier-band-range');
            if (bandRange && document.activeElement !== bandRange) bandRange.value = pct;
            const bandLabel = bar.querySelector('#tp-bar-outlier-band-label');
            if (bandLabel) bandLabel.textContent = `±${pct} %`;
            break;
          }
          case 'OUTLIER_MAX_GLITCH_HOURS': {
            const hrs = Math.min(168, Math.max(12, parseInt(val ?? 48, 10) || 48));
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
            const mode = val === 'dim' ? 'dim' : 'hide';
            bar.querySelectorAll(`[data-mode-key="${key}"]`).forEach(btn => {
              btn.classList.toggle('tp-active', true);
              btn.textContent = mode === 'dim' ? 'Dimmen' : 'Verbergen';
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
        if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] syncUiControl bar error', err);
      }
    }
  }
}

// Alarm-only changes repaint just the bell (via syncUiControl) — a full
// processListings() re-render would be wasted work on every settings save.
const ALARM_ONLY_KEYS = new Set(['ALARM_ENABLED', 'ALARM_TARGET_PERCENT', 'ALARM_DURATION_DAYS', 'ALARM_AUTO_SUBMIT']);
export function updateConfig(key, val, options = {}) {
  saveConfigKey(key, val);
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

