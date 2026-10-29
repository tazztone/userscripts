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
// Toolbar owns the cycle button element; config owns the state mapping.
// Text/class paint shared with the toolbar via ui/mini-toggle.js.
export const paintCycleButtons = (bar, modeKey) => {
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
  FILTER_DEAL_DISCOUNT_ENABLED: sanitizeConfigValue('FILTER_DEAL_DISCOUNT_ENABLED', _getValue('FILTER_DEAL_DISCOUNT_ENABLED', DEFAULTS.FILTER_DEAL_DISCOUNT_ENABLED)),
  FILTER_PRICE_ENABLED: sanitizeConfigValue('FILTER_PRICE_ENABLED', _getValue('FILTER_PRICE_ENABLED', DEFAULTS.FILTER_PRICE_ENABLED)),
  FILTER_PRICE_MIN: sanitizeConfigValue('FILTER_PRICE_MIN', _getValue('FILTER_PRICE_MIN', DEFAULTS.FILTER_PRICE_MIN)),
  FILTER_PRICE_MAX: sanitizeConfigValue('FILTER_PRICE_MAX', _getValue('FILTER_PRICE_MAX', DEFAULTS.FILTER_PRICE_MAX)),
  FILTER_SAVINGS_ENABLED: sanitizeConfigValue('FILTER_SAVINGS_ENABLED', _getValue('FILTER_SAVINGS_ENABLED', DEFAULTS.FILTER_SAVINGS_ENABLED)),
  FILTER_SAVINGS_MIN: sanitizeConfigValue('FILTER_SAVINGS_MIN', _getValue('FILTER_SAVINGS_MIN', DEFAULTS.FILTER_SAVINGS_MIN)),
  FILTER_SAVINGS_MAX: sanitizeConfigValue('FILTER_SAVINGS_MAX', _getValue('FILTER_SAVINGS_MAX', DEFAULTS.FILTER_SAVINGS_MAX)),
  FILTER_NEG_MODE: _modeValue('FILTER_NEG_MODE'),
  FILTER_MIN_MODE: _modeValue('FILTER_MIN_MODE'),
  FILTER_DEAL_DISCOUNT_MODE: _modeValue('FILTER_DEAL_DISCOUNT_MODE'),
  FILTER_PRICE_MODE: _modeValue('FILTER_PRICE_MODE'),
  FILTER_SAVINGS_MODE: _modeValue('FILTER_SAVINGS_MODE'),
  HIDE_UNCHECKED_MODE: _modeValue('HIDE_UNCHECKED_MODE'),
  VORTIEF_MODE: _modeValue('VORTIEF_MODE'),
  DEALER_MODE: _modeValue('DEALER_MODE'),
  MIN_DEAL_DISCOUNT: sanitizeConfigValue('MIN_DEAL_DISCOUNT', _getValue('MIN_DEAL_DISCOUNT', DEFAULTS.MIN_DEAL_DISCOUNT)),
  MARGIN_PERCENT: sanitizeConfigValue('MARGIN_PERCENT', _getValue('MARGIN_PERCENT', DEFAULTS.MARGIN_PERCENT)),
  DIM_OPACITY: sanitizeConfigValue('DIM_OPACITY', _getValue('DIM_OPACITY', DEFAULTS.DIM_OPACITY)),
  HIDE_ADS: sanitizeConfigValue('HIDE_ADS', _getValue('HIDE_ADS', DEFAULTS.HIDE_ADS)),
  USE_SHIPPING_PRICE: sanitizeConfigValue('USE_SHIPPING_PRICE', _getValue('USE_SHIPPING_PRICE', DEFAULTS.USE_SHIPPING_PRICE)),
  HEATMAP_ENABLED: sanitizeConfigValue('HEATMAP_ENABLED', _getValue('HEATMAP_ENABLED', DEFAULTS.HEATMAP_ENABLED)),
  HEATMAP_INTENSITY: sanitizeConfigValue('HEATMAP_INTENSITY', _getValue('HEATMAP_INTENSITY', DEFAULTS.HEATMAP_INTENSITY)),
  REAL_DEAL_MIN_DISCOUNT: sanitizeConfigValue('REAL_DEAL_MIN_DISCOUNT', _getValue('REAL_DEAL_MIN_DISCOUNT', DEFAULTS.REAL_DEAL_MIN_DISCOUNT)),
  REAL_DEAL_CACHE_HOURS: sanitizeConfigValue('REAL_DEAL_CACHE_HOURS', _getValue('REAL_DEAL_CACHE_HOURS', DEFAULTS.REAL_DEAL_CACHE_HOURS)),
  NEGATIVE_CACHE_HOURS: sanitizeConfigValue('NEGATIVE_CACHE_HOURS', _getValue('NEGATIVE_CACHE_HOURS', DEFAULTS.NEGATIVE_CACHE_HOURS)),
  CACHE_MEMORY_LIMIT: sanitizeConfigValue('CACHE_MEMORY_LIMIT', _getValue('CACHE_MEMORY_LIMIT', DEFAULTS.CACHE_MEMORY_LIMIT)),
  CACHE_DISK_LIMIT: sanitizeConfigValue('CACHE_DISK_LIMIT', _getValue('CACHE_DISK_LIMIT', DEFAULTS.CACHE_DISK_LIMIT)),
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
  KEEPA_CHART_ENABLED: sanitizeConfigValue('KEEPA_CHART_ENABLED', _getValue('KEEPA_CHART_ENABLED', DEFAULTS.KEEPA_CHART_ENABLED)),
  REVIEW_SEARCH_ENABLED: sanitizeConfigValue('REVIEW_SEARCH_ENABLED', _getValue('REVIEW_SEARCH_ENABLED', DEFAULTS.REVIEW_SEARCH_ENABLED)),
  REVIEW_SEARCH_KEYWORD: sanitizeConfigValue('REVIEW_SEARCH_KEYWORD', _getValue('REVIEW_SEARCH_KEYWORD', DEFAULTS.REVIEW_SEARCH_KEYWORD)),
  REVIEW_SEARCH_AI_MODE: sanitizeConfigValue('REVIEW_SEARCH_AI_MODE', _getValue('REVIEW_SEARCH_AI_MODE', DEFAULTS.REVIEW_SEARCH_AI_MODE)),
  TAVILY_ENABLED: sanitizeConfigValue('TAVILY_ENABLED', _getValue('TAVILY_ENABLED', DEFAULTS.TAVILY_ENABLED)),
  TAVILY_API_KEY: _getValue('TAVILY_API_KEY', DEFAULTS.TAVILY_API_KEY),
  TAVILY_SEARCH_DEPTH: sanitizeConfigValue('TAVILY_SEARCH_DEPTH', _getValue('TAVILY_SEARCH_DEPTH', DEFAULTS.TAVILY_SEARCH_DEPTH)),
  TAVILY_MAX_RESULTS: sanitizeConfigValue('TAVILY_MAX_RESULTS', _getValue('TAVILY_MAX_RESULTS', DEFAULTS.TAVILY_MAX_RESULTS)),
  DEALER_AUTOFETCH: sanitizeConfigValue('DEALER_AUTOFETCH', _getValue('DEALER_AUTOFETCH', DEFAULTS.DEALER_AUTOFETCH)),
  NEGATIVE_TERMS: sanitizeConfigValue('NEGATIVE_TERMS', _getValue('NEGATIVE_TERMS', DEFAULTS.NEGATIVE_TERMS)),
  DISCORD_WEBHOOK_URL: _getValue('DISCORD_WEBHOOK_URL', DEFAULTS.DISCORD_WEBHOOK_URL),
  DISCORD_CHANNELS: sanitizeConfigValue('DISCORD_CHANNELS', _getValue('DISCORD_CHANNELS', DEFAULTS.DISCORD_CHANNELS)),
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

