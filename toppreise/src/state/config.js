/**
 * Configuration & Persistent Settings State Layer
 * Manages defaults, GM_getValue/localStorage synchronization,
 * active configuration object, and bidirectional UI control sync.
 */

import { uiShadowRoot } from '../ui/shell.js';
import { paintCycleButton } from '../ui/mini-toggle.js';
import { SECRET_KEYS, _getValue, _setValue, DEFAULTS, sanitizeConfigValue, weightText, horizonText, horizonUiToStored, horizonStoredToUi } from './config-store.js';
import { migrateLegacyDebug, migrateHideToDimDefaults, migrateFilterSplit, migrateDiscordChannels } from './config-migrate.js';
import { syncUiControl } from './config-sync.js';


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
  FILTER_DEAL_DISCOUNT_MODE: { enable: 'FILTER_DEAL_DISCOUNT_ENABLED', on: true },
  FILTER_PRICE_MODE: { enable: 'FILTER_PRICE_ENABLED', on: true },
  FILTER_SAVINGS_MODE: { enable: 'FILTER_SAVINGS_ENABLED', on: true },
  HIDE_UNCHECKED_MODE: { enable: 'BESTPREISE_HIDE_UNCHECKED', on: true },
  VORTIEF_MODE: { enable: 'BESTPREISE_INCLUDE_VORTIEF', on: false },
});
export const cycleStateOf = modeKey => {
  const pair = FILTER_CYCLE[modeKey];
  if (!pair) return CONFIG[modeKey] || 'dim';
  if (CONFIG[pair.enable] !== pair.on) return 'off';
  return CONFIG[modeKey] || 'dim';
};
export const CYCLE_TITLE = Object.freeze({
  off: 'Filter: Normal — klicken für Dimmen',
  dim: 'Filter: Dimmen — klicken für Verbergen',
  hide: 'Filter: Verbergen — klicken für Hervorheben',
  highlight: 'Filter: Hervorheben — klicken für Normal'
});

export function paintCycleModeButton(btn, modeKey) {
  if (!btn) return;
  const s = cycleStateOf(modeKey);
  paintCycleButton(btn, s);
  btn.title = CYCLE_TITLE[s] || '';
}

// Toolbar owns the cycle button element; config owns the state mapping.
// Text/class paint shared with the toolbar via ui/mini-toggle.js.
export const paintCycleButtons = (bar, modeKey) => {
  if (!bar) return;
  bar.querySelectorAll(`[data-mode-key="${modeKey}"]`).forEach(btn => paintCycleModeButton(btn, modeKey));
};

export const CONFIG = Object.fromEntries(
  Object.entries(DEFAULTS).map(([k, defaultVal]) => {
    let val;
    if (k.endsWith('_MODE') && k !== 'REVIEW_SEARCH_AI_MODE') {
      val = _modeValue(k);
    } else if (k === 'FILTER_NEG_ENABLED' || k === 'FILTER_MIN_ENABLED') {
      val = _getValue(k, _getValue('FILTERS_ENABLED', defaultVal));
    } else if (k === 'DISCORD_SUPPRESS_DEALER_EMBED' || k === 'DISCORD_SUPPRESS_PRODUCT_EMBED') {
      val = _getValue(k, legacySuppressEmbeds ?? defaultVal);
    } else if (k === 'DISCORD_LAYOUT') {
      val = (typeof _layoutRaw === 'string' && _layoutRaw.trim()) ? _layoutRaw : defaultVal;
    } else {
      val = _getValue(k, defaultVal);
    }
    return [k, sanitizeConfigValue(k, val)];
  })
);
export const sanitizeReviewKeyword = raw => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 150) || DEFAULTS.REVIEW_SEARCH_KEYWORD;
// 0% is a legitimate threshold (check everything): only non-numeric storage
// falls back to 30 — `|| 30` would silently discard an explicit 0.
export const realDealMinDiscount = () => (Number.isFinite(CONFIG.REAL_DEAL_MIN_DISCOUNT) ? CONFIG.REAL_DEAL_MIN_DISCOUNT : 30);
// Corrupt storage must never silently break fills: fall back to defaults on
// NaN/unknown durations.
if (!['90', '180', '365', '730'].includes(CONFIG.ALARM_DURATION_DAYS)) CONFIG.ALARM_DURATION_DAYS = '730';
if (CONFIG.REVIEW_SEARCH_KEYWORD === 'KI-Modus') { CONFIG.REVIEW_SEARCH_KEYWORD = DEFAULTS.REVIEW_SEARCH_KEYWORD; CONFIG.REVIEW_SEARCH_AI_MODE = true; }
// Old defaults bump to new default (KI-Modus precedent above).
if (
  CONFIG.REVIEW_SEARCH_KEYWORD === 'Testbericht' ||
  CONFIG.REVIEW_SEARCH_KEYWORD === 'Testbericht - {preis} Preiseinschätzung' ||
  CONFIG.REVIEW_SEARCH_KEYWORD === 'Testbericht Erfahrungen. Ist der Preis von {preis} ein guter Deal?' ||
  CONFIG.REVIEW_SEARCH_KEYWORD === 'Testberichte zu: [Produkt]. zum preis: {preis}. Antworte kurz mit Stärken, Schwächen und Deal-Urteil.'
) {
  CONFIG.REVIEW_SEARCH_KEYWORD = DEFAULTS.REVIEW_SEARCH_KEYWORD;
}
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
export const notifyAlarmConfig = () => {
  try { alarmConfigListener?.(); } catch (err) {
    if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] alarm repaint error', err);
  }
};


export function updateBodyClasses() {
  if (typeof document === 'undefined' || !document.body) return;
  document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
  document.documentElement.classList.toggle('tp-hide-ads', !!CONFIG.HIDE_ADS);
}

export { syncUiControl };

// Keys that update chrome/css directly and skip a full processListings() re-render.
const FAST_SYNC_KEYS = new Set(['ALARM_ENABLED', 'ALARM_TARGET_PERCENT', 'ALARM_DURATION_DAYS', 'ALARM_AUTO_SUBMIT', 'HIDE_ADS']);
export const getDiscordChannels = () => {
  const list = Array.isArray(CONFIG.DISCORD_CHANNELS) ? CONFIG.DISCORD_CHANNELS : [];
  if (list.length > 0) return list;
  const legacy = (CONFIG.DISCORD_WEBHOOK_URL || '').trim();
  if (legacy) return [{ id: 'default', name: 'Standard', url: legacy }];
  return [];
};
export function updateConfig(key, val, options = {}) {
  if (SECRET_KEYS.has(key)) {
    const clean = key === 'DISCORD_CHANNELS' ? (sanitizeConfigValue(key, val) ?? []) : val;
    CONFIG[key] = clean;
    _setValue(key, clean);
  }
  else {
    const clean = sanitizeConfigValue(key, val);
    if (clean === undefined) return;
    val = clean;
    saveConfigKey(key, val);
  }
  if (!options.skipUiSync) {
    syncUiControl(key, val);
  }
  if (key === 'DIM_OPACITY' || key === 'HIDE_ADS') {
    updateBodyClasses();
  }
  if (!options.skipRender && !FAST_SYNC_KEYS.has(key) && typeof processListings === 'function') {
    processListings();
  }
}

export function updateConfigs(entries, options = {}) {
  for (const [k, v] of Object.entries(entries)) {
    updateConfig(k, v, { ...options, skipRender: true });
  }
  const needsRender = !options.skipRender && Object.keys(entries).some(k => !FAST_SYNC_KEYS.has(k));
  if (needsRender && typeof processListings === 'function') {
    processListings();
  }
}
// Re-exports: storage/schema/migrate symbols moved to siblings — every
// existing `from './state/config.js'` / `'../state/config.js'` path keeps working.
import { SETTING_SCHEMA, sanitizeChannels } from './config-store.js';
export { SECRET_KEYS, _getValue, _setValue, DEFAULTS, SETTING_SCHEMA, sanitizeConfigValue, sanitizeChannels, weightText, horizonText, horizonUiToStored, horizonStoredToUi };
export { migrateLegacyDebug, migrateHideToDimDefaults, migrateFilterSplit, migrateDiscordChannels };

