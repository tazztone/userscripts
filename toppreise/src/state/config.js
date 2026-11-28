/**
 * Configuration & Persistent Settings State Layer
 * Manages defaults, GM_getValue/localStorage synchronization,
 * active configuration object, and bidirectional UI control sync.
 */

import { uiShadowRoot } from '../ui/shell.js';
import { paintCycleButton } from '../ui/mini-toggle.js';
import { SECRET_KEYS, _getValue, _setValue, DEFAULTS, DEFAULT_OPENROUTER_MODEL, PAGE_SCOPED_KEYS, sanitizeConfigValue, weightText, horizonText, horizonUiToStored, horizonStoredToUi } from './config-store.js';
import { migrateLegacyDebug, migrateHideToDimDefaults, migrateFilterSplit, migrateDiscordChannels } from './config-migrate.js';
import { syncUiControl } from './config-sync.js';
import { triggerProcessListings, getPageProfileType } from '../page/adapter.js';


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
export const clampIntensity01 = v => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0.2, Math.min(1.0, n)) : 1.0;
};

// One-time migration: single DISCORD_SUPPRESS_EMBEDS key split into dealer +
// product keys. Stored old value seeds both new keys once; stale key unread.
const legacySuppressEmbeds = _getValue('DISCORD_SUPPRESS_EMBEDS', null);
const _layoutRaw = _getValue('DISCORD_LAYOUT', DEFAULTS.DISCORD_LAYOUT);
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
    if (k === 'DISCORD_SUPPRESS_DEALER_EMBED' || k === 'DISCORD_SUPPRESS_PRODUCT_EMBED') {
      val = _getValue(k, legacySuppressEmbeds ?? defaultVal);
    } else if (k === 'DISCORD_LAYOUT') {
      val = (typeof _layoutRaw === 'string' && _layoutRaw.trim()) ? _layoutRaw : defaultVal;
    } else {
      val = _getValue(k, defaultVal);
    }
    return [k, sanitizeConfigValue(k, val)];
  })
);
export const sanitizeReviewKeyword = raw => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 500) || DEFAULTS.REVIEW_SEARCH_KEYWORD;
// 0% is a legitimate threshold (check everything): only non-numeric storage
// falls back to 30 — `|| 30` would silently discard an explicit 0.
export const realDealMinDiscount = () => (Number.isFinite(CONFIG.REAL_DEAL_MIN_DISCOUNT) ? CONFIG.REAL_DEAL_MIN_DISCOUNT : 30);
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

let activeProfileType = null;
export function getActiveProfileType() {
  return activeProfileType || getPageProfileType();
}

export function initPageProfiles(forceType = null) {
  if (!CONFIG.FILTER_REMEMBER_PER_PAGE_TYPE) return;
  const profileType = forceType || getPageProfileType();
  activeProfileType = profileType;
  let profiles = _getValue('PAGE_PROFILES', null);

  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    const initialSeed = {};
    for (const k of PAGE_SCOPED_KEYS) {
      if (CONFIG[k] !== undefined) initialSeed[k] = CONFIG[k];
    }
    profiles = {
      neue: { ...initialSeed },
      search: { ...initialSeed }
    };
    _setValue('PAGE_PROFILES', profiles);
    return;
  }

  let modified = false;
  const initialSeed = {};
  for (const k of PAGE_SCOPED_KEYS) {
    if (CONFIG[k] !== undefined) initialSeed[k] = CONFIG[k];
  }
  if (!profiles.neue || typeof profiles.neue !== 'object' || Array.isArray(profiles.neue)) {
    profiles.neue = { ...initialSeed };
    modified = true;
  }
  if (!profiles.search || typeof profiles.search !== 'object' || Array.isArray(profiles.search)) {
    profiles.search = { ...initialSeed };
    modified = true;
  }
  if (modified) {
    _setValue('PAGE_PROFILES', profiles);
  }

  const activeData = profiles[profileType];
  if (activeData) {
    for (const k of PAGE_SCOPED_KEYS) {
      if (k in activeData) {
        CONFIG[k] = sanitizeConfigValue(k, activeData[k]);
      }
    }
  }
}

export const saveConfigKey = (key, val, options = {}) => {
  if (SECRET_KEYS.has(key)) return undefined;
  const clean = sanitizeConfigValue(key, val);
  if (clean === undefined) return undefined;
  CONFIG[key] = clean;
  _setValue(key, clean);

  if (!options.deferProfileSave && CONFIG.FILTER_REMEMBER_PER_PAGE_TYPE && PAGE_SCOPED_KEYS.has(key)) {
    const profileType = getActiveProfileType();
    const rawProfiles = _getValue('PAGE_PROFILES', null);
    const profiles = (rawProfiles && typeof rawProfiles === 'object' && !Array.isArray(rawProfiles))
      ? rawProfiles
      : { neue: {}, search: {} };
    if (!profiles[profileType] || typeof profiles[profileType] !== 'object' || Array.isArray(profiles[profileType])) {
      profiles[profileType] = {};
    }
    profiles[profileType][key] = clean;
    _setValue('PAGE_PROFILES', profiles);
  }
  return clean;
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

let cacheLimitListener = null;
export function setCacheLimitListener(fn) {
  cacheLimitListener = typeof fn === 'function' ? fn : null;
}


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
    const clean = sanitizeConfigValue(key, val);
    if (clean === undefined) return;
    val = clean;
    CONFIG[key] = clean;
    _setValue(key, clean);
  } else {
    const clean = saveConfigKey(key, val, options);
    if (clean === undefined) return;
    val = clean;
  }
  if (!options.skipUiSync) {
    syncUiControl(key, val);
  }
  if (key === 'FILTER_REMEMBER_PER_PAGE_TYPE') {
    if (val === false) {
      for (const k of PAGE_SCOPED_KEYS) {
        _setValue(k, CONFIG[k]);
      }
    } else {
      initPageProfiles();
      if (!options.skipUiSync) {
        for (const k of PAGE_SCOPED_KEYS) syncUiControl(k, CONFIG[k]);
      }
    }
  }
  if (key === 'DIM_OPACITY' || key === 'HIDE_ADS') {
    updateBodyClasses();
  }
  if (key === 'CACHE_MEMORY_LIMIT') {
    cacheLimitListener?.(val);
  }
  if (!options.skipRender && !FAST_SYNC_KEYS.has(key)) {
    triggerProcessListings();
  }
}

export function updateConfigs(entries, options = {}) {
  const ordered = Object.entries(entries);
  const idx = ordered.findIndex(([k]) => k === 'FILTER_REMEMBER_PER_PAGE_TYPE');
  if (idx > 0) {
    const [pair] = ordered.splice(idx, 1);
    ordered.unshift(pair);
  }
  for (const [k, v] of ordered) {
    updateConfig(k, v, { ...options, skipRender: true, deferProfileSave: true });
  }
  if (CONFIG.FILTER_REMEMBER_PER_PAGE_TYPE) {
    const touchedScoped = ordered.filter(([k]) => PAGE_SCOPED_KEYS.has(k) && !SECRET_KEYS.has(k));
    if (touchedScoped.length > 0) {
      const profileType = getActiveProfileType();
      const rawProfiles = _getValue('PAGE_PROFILES', null);
      const profiles = (rawProfiles && typeof rawProfiles === 'object' && !Array.isArray(rawProfiles))
        ? rawProfiles
        : { neue: {}, search: {} };
      if (!profiles[profileType] || typeof profiles[profileType] !== 'object' || Array.isArray(profiles[profileType])) {
        profiles[profileType] = {};
      }
      for (const [k] of touchedScoped) {
        profiles[profileType][k] = CONFIG[k];
      }
      _setValue('PAGE_PROFILES', profiles);
    }
  }
  const needsRender = !options.skipRender && ordered.some(([k]) => !FAST_SYNC_KEYS.has(k));
  if (needsRender) {
    triggerProcessListings();
  }
}

export function resetConfigToDefaults({ includeSecrets = false, skipRender = false } = {}) {
  for (const [k, defaultVal] of Object.entries(DEFAULTS)) {
    if (!includeSecrets && SECRET_KEYS.has(k)) continue;
    const clean = SECRET_KEYS.has(k)
      ? (k === 'DISCORD_CHANNELS' ? (sanitizeConfigValue(k, defaultVal) ?? []) : defaultVal)
      : sanitizeConfigValue(k, defaultVal);
    if (clean === undefined) continue;
    CONFIG[k] = clean;
    _setValue(k, clean);
  }

  if (CONFIG.FILTER_REMEMBER_PER_PAGE_TYPE) {
    const seed = {};
    for (const k of PAGE_SCOPED_KEYS) {
      if (CONFIG[k] !== undefined) seed[k] = CONFIG[k];
    }
    _setValue('PAGE_PROFILES', { neue: { ...seed }, search: { ...seed } });
    activeProfileType = typeof document !== 'undefined' ? getPageProfileType() : null;
  } else {
    _setValue('PAGE_PROFILES', null);
    activeProfileType = null;
  }

  for (const k of Object.keys(DEFAULTS)) {
    if (!includeSecrets && SECRET_KEYS.has(k)) continue;
    syncUiControl(k, CONFIG[k]);
  }
  updateBodyClasses();
  cacheLimitListener?.(CONFIG.CACHE_MEMORY_LIMIT);
  if (!skipRender) {
    triggerProcessListings();
  }
}
// Re-exports: storage/schema/migrate symbols moved to siblings — every
// existing `from './state/config.js'` / `'../state/config.js'` path keeps working.
import { SETTING_SCHEMA, sanitizeChannels, RESET_GROUPS, effectiveAiProvider } from './config-store.js';
export { SECRET_KEYS, _getValue, _setValue, DEFAULTS, DEFAULT_OPENROUTER_MODEL, PAGE_SCOPED_KEYS, RESET_GROUPS, SETTING_SCHEMA, sanitizeConfigValue, sanitizeChannels, effectiveAiProvider, weightText, horizonText, horizonUiToStored, horizonStoredToUi };
export { migrateLegacyDebug, migrateHideToDimDefaults, migrateFilterSplit, migrateDiscordChannels };

