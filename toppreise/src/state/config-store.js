/**
 * Config storage foundation (split from state/config.js).
 * Pure logic, zero DOM imports: defaults, GM/localStorage mirror,
 * single setting schema + sanitizer.
 */

export const DEFAULTS = Object.freeze({
  FILTER_NEG_ENABLED: false,
  FILTER_MIN_ENABLED: false,
  FILTER_DEAL_DISCOUNT_ENABLED: false,
  FILTER_PRICE_ENABLED: false,
  FILTER_PRICE_MIN: 0,
  FILTER_PRICE_MAX: 0,
  FILTER_SAVINGS_ENABLED: false,
  FILTER_SAVINGS_MIN: 0,
  FILTER_SAVINGS_MAX: 0,
  FILTER_NEG_MODE: 'dim',
  FILTER_MIN_MODE: 'dim',
  FILTER_DEAL_DISCOUNT_MODE: 'dim',
  FILTER_PRICE_MODE: 'dim',
  FILTER_SAVINGS_MODE: 'dim',
  HIDE_UNCHECKED_MODE: 'dim',
  VORTIEF_MODE: 'dim',
  DEALER_MODE: 'dim',
  MIN_DEAL_DISCOUNT: 0,
  MARGIN_PERCENT: 0.0,
  DIM_OPACITY: 0.25,
  HIDE_ADS: true,
  USE_SHIPPING_PRICE: true,
  HEATMAP_ENABLED: true,
  HEATMAP_INTENSITY: 1.0,
  REAL_DEAL_MIN_DISCOUNT: 30,
  REAL_DEAL_CACHE_HOURS: 48,
  NEGATIVE_CACHE_HOURS: 2,
  CACHE_MEMORY_LIMIT: 500,
  CACHE_DISK_LIMIT: 300,
  BESTPREISE_MODE_ACTIVE: false,
  BESTPREISE_HIDE_UNCHECKED: false,
  BESTPREISE_INCLUDE_VORTIEF: true,
  BESTPREISE_WEIGHT_RECORD: 0.50,
  BESTPREISE_MIN_POINTS: 5,
  BESTPREISE_MEDIAN_HORIZON_DAYS: 365,
  OUTLIER_REJECTION_ENABLED: true,
  OUTLIER_DEVIATION_BAND: 0.50,
  OUTLIER_MAX_GLITCH_HOURS: 48,
  ENABLE_SPARKLINES: true,
  KEEPA_CHART_ENABLED: true,
  REVIEW_SEARCH_ENABLED: true,
  REVIEW_SEARCH_KEYWORD: 'Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.',
  REVIEW_SEARCH_AI_MODE: false,
  TAVILY_API_KEY: '',
  TAVILY_SEARCH_DEPTH: 'basic',
  TAVILY_MAX_RESULTS: 5,
  DEALER_AUTOFETCH: false,
  NEGATIVE_TERMS: '',
  DISCORD_WEBHOOK_URL: '',
  DISCORD_CHANNELS: [],
  DISCORD_SUPPRESS_DEALER_EMBED: true,
  DISCORD_SUPPRESS_PRODUCT_EMBED: true,
  DISCORD_FORUM_TITLE: false,
  // mirror of DEFAULT_LAYOUT in features/share-discord.js (drift-checked in share-discord.test.js)
  DISCORD_LAYOUT: '## {title}\n# {price}\n# {dealer} +{offers}\n{prevlow}\n{median}\n{ai}\n{link}',
  MIN_OFFERS: 0,
  SORT_BY_OFFERS: 'none',
  ALARM_ENABLED: true,
  ALARM_TARGET_PERCENT: 0.60,
  ALARM_DURATION_DAYS: '730',
  ALARM_AUTO_SUBMIT: false,
  ALARM_FALLBACK_TIMEOUT_MS: 5000,
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
// Bearer-Secrets (Discord-Webhook, Tavily-API-Key) bleiben GM-privat: nie ins page-lesbare localStorage.
export const SECRET_KEYS = new Set(['DISCORD_WEBHOOK_URL', 'DISCORD_CHANNELS', 'TAVILY_API_KEY']);

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
// Single config schema: every DEFAULTS key validates/coerces through
// sanitizeConfigValue (init, updateConfig(s), settings import). Unknown keys
// are rejected (undefined → caller ignores). Bounds below are authoritative.
export const SETTING_SCHEMA = {
  FILTER_NEG_ENABLED: { type: 'bool', default: false },
  FILTER_MIN_ENABLED: { type: 'bool', default: false },
  FILTER_DEAL_DISCOUNT_ENABLED: { type: 'bool', default: false },
  FILTER_PRICE_ENABLED: { type: 'bool', default: false },
  FILTER_PRICE_MIN: { type: 'float', default: 0, min: 0, max: 1000000 },
  FILTER_PRICE_MAX: { type: 'float', default: 0, min: 0, max: 1000000 },
  FILTER_SAVINGS_ENABLED: { type: 'bool', default: false },
  FILTER_SAVINGS_MIN: { type: 'float', default: 0, min: 0, max: 1000000 },
  FILTER_SAVINGS_MAX: { type: 'float', default: 0, min: 0, max: 1000000 },
  FILTER_NEG_MODE: { type: 'mode', default: 'dim' },
  FILTER_MIN_MODE: { type: 'mode', default: 'dim' },
  FILTER_DEAL_DISCOUNT_MODE: { type: 'mode', default: 'dim' },
  FILTER_PRICE_MODE: { type: 'mode', default: 'dim' },
  FILTER_SAVINGS_MODE: { type: 'mode', default: 'dim' },
  HIDE_UNCHECKED_MODE: { type: 'mode', default: 'dim' },
  VORTIEF_MODE: { type: 'mode', default: 'dim' },
  DEALER_MODE: { type: 'mode', default: 'dim' },
  MIN_DEAL_DISCOUNT: { type: 'int', default: 0, min: 0, max: 50 },
  MARGIN_PERCENT: { type: 'float', default: 0.0, min: 0, max: 50 },
  DIM_OPACITY: { type: 'float', default: 0.25, min: 0.05, max: 1 },
  HIDE_ADS: { type: 'bool', default: true },
  USE_SHIPPING_PRICE: { type: 'bool', default: true },
  HEATMAP_ENABLED: { type: 'bool', default: true },
  HEATMAP_INTENSITY: { type: 'float', default: 1.0, min: 0.2, max: 1 },
  REAL_DEAL_MIN_DISCOUNT: { type: 'int', default: 30, min: 0, max: 90 },
  REAL_DEAL_CACHE_HOURS: { type: 'int', default: 48, min: 1, max: 336 },
  NEGATIVE_CACHE_HOURS: { type: 'float', default: 2, min: 0.25, max: 24 },
  CACHE_MEMORY_LIMIT: { type: 'int', default: 500, min: 100, max: 2000 },
  CACHE_DISK_LIMIT: { type: 'int', default: 300, min: 100, max: 1000 },
  BESTPREISE_MODE_ACTIVE: { type: 'bool', default: false },
  BESTPREISE_HIDE_UNCHECKED: { type: 'bool', default: false },
  BESTPREISE_INCLUDE_VORTIEF: { type: 'bool', default: true },
  BESTPREISE_WEIGHT_RECORD: { type: 'float', default: 0.50, min: 0, max: 1 },
  BESTPREISE_MIN_POINTS: { type: 'int', default: 5, min: 1, max: 100 },
  BESTPREISE_MEDIAN_HORIZON_DAYS: { type: 'int', default: 365, min: 0, max: 3650 },
  OUTLIER_REJECTION_ENABLED: { type: 'bool', default: true },
  OUTLIER_DEVIATION_BAND: { type: 'float', default: 0.50, min: 0.01, max: 0.50 },
  OUTLIER_MAX_GLITCH_HOURS: { type: 'int', default: 48, min: 24, max: 168 },
  ENABLE_SPARKLINES: { type: 'bool', default: true },
  KEEPA_CHART_ENABLED: { type: 'bool', default: true },
  REVIEW_SEARCH_ENABLED: { type: 'bool', default: true },
  REVIEW_SEARCH_KEYWORD: { type: 'string', default: 'Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.' },
  REVIEW_SEARCH_AI_MODE: { type: 'bool', default: false },
  TAVILY_API_KEY: { type: 'string', default: '' },
  TAVILY_SEARCH_DEPTH: { type: 'enum', default: 'basic', allowed: ['basic', 'advanced'] },
  TAVILY_MAX_RESULTS: { type: 'int', default: 5, min: 1, max: 10 },
  DEALER_AUTOFETCH: { type: 'bool', default: false },
  NEGATIVE_TERMS: { type: 'string', default: '' },
  DISCORD_WEBHOOK_URL: { type: 'string', default: '' },
  DISCORD_CHANNELS: { type: 'channels', default: [] },
  DISCORD_SUPPRESS_DEALER_EMBED: { type: 'bool', default: true },
  DISCORD_SUPPRESS_PRODUCT_EMBED: { type: 'bool', default: true },
  DISCORD_FORUM_TITLE: { type: 'bool', default: false },
  DISCORD_LAYOUT: { type: 'string', default: '## {title}\n# {price}\n# {dealer} +{offers}\n{prevlow}\n{median}\n{link}' },
  MIN_OFFERS: { type: 'int', default: 0, min: 0, max: 99 },
  SORT_BY_OFFERS: { type: 'enum', default: 'none', allowed: ['none', 'desc', 'asc', 'discount-desc'] },
  ALARM_ENABLED: { type: 'bool', default: true },
  ALARM_TARGET_PERCENT: { type: 'float', default: 0.60, min: 0.05, max: 0.99 },
  ALARM_DURATION_DAYS: { type: 'enum', default: '730', allowed: ['90', '180', '365', '730'] },
  ALARM_AUTO_SUBMIT: { type: 'bool', default: false },
  ALARM_FALLBACK_TIMEOUT_MS: { type: 'int', default: 5000, min: 1000, max: 30000 },
  OBSERVER_DEBOUNCE_MS: { type: 'int', default: 200, min: 0, max: 2000 },
  DEBUG: { type: 'bool', default: false }
};
const coerceNumber = raw => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  if (typeof raw === 'string' && raw.trim() !== '') return Number(raw);
  return NaN;
};
export const sanitizeChannels = raw => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const name = String(item.name || '').trim().slice(0, 50) || `Kanal ${idx + 1}`;
      const url = typeof item.url === 'string' ? item.url.trim() : '';
      const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `ch_${idx + 1}`;
      return { id, name, url };
    })
    .filter(Boolean);
};
export function sanitizeConfigValue(key, raw) {
  const rule = SETTING_SCHEMA[key];
  if (!rule) {
    try { if (_getValue('DEBUG', false) === true) console.warn('[Toppreise-Suite] unknown config key ignored', key); } catch {}
    return undefined;
  }
  switch (rule.type) {
    case 'bool': return raw === true;
    case 'mode': return (raw === 'dim' || raw === 'highlight' || raw === 'hide') ? raw : rule.default;
    case 'channels': return sanitizeChannels(raw);
    case 'int': {
      const n = coerceNumber(raw);
      if (!Number.isFinite(n)) return rule.default;
      return Math.min(rule.max, Math.max(rule.min, Math.round(n)));
    }
    case 'float': {
      const n = coerceNumber(raw);
      if (!Number.isFinite(n)) return rule.default;
      return Math.min(rule.max, Math.max(rule.min, n));
    }
    case 'enum': {
      if (rule.allowed.includes(raw)) return raw;
      const s = String(raw);
      return rule.allowed.includes(s) ? s : rule.default;
    }
    case 'string': return typeof raw === 'string' ? raw : rule.default;
    default: return rule.default;
  }
}
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
    return `Gewichtung: ${100 - pctRec}% Ø-Preis / ${pctRec}% Rekord — Badge zeigt die Gewichtete Differenz.`;
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
// UI↔stored horizon mapping (single source): the range control tops out at
// 760 as the Lifetime sentinel; anything above 730 days stores 0 (Lifetime).
export const horizonUiToStored = raw => { const n = Number.isFinite(raw) ? raw : 365; return n > 730 ? 0 : n; };
export const horizonStoredToUi = stored => stored === 0 ? 760 : stored;
