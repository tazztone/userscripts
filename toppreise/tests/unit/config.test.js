import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { _getValue, _setValue, weightText, horizonUiToStored, horizonStoredToUi, DEFAULTS, CONFIG, SECRET_KEYS, migrateLegacyDebug, migrateHideToDimDefaults, migrateDiscordChannels, getDiscordChannels, sanitizeChannels, realDealMinDiscount, sanitizeConfigValue, FILTER_CYCLE, cycleStateOf, syncUiControl } from '../../src/state/config.js';
import { SETTING_SCHEMA } from '../../src/state/config-store.js';

describe('Config dual-layer storage', () => {
  let realGMGet, realGMSet, realLS;
  let gmStore, lsStore;

  beforeEach(() => {
    realGMGet = globalThis.GM_getValue;
    realGMSet = globalThis.GM_setValue;
    realLS = globalThis.localStorage;
    gmStore = {};
    lsStore = {};
    globalThis.GM_getValue = k => gmStore[k];
    globalThis.GM_setValue = (k, v) => { gmStore[k] = v; };
    globalThis.localStorage = {
      getItem: k => (k in lsStore ? lsStore[k] : null),
      setItem: (k, v) => { lsStore[k] = String(v); },
      removeItem: k => { delete lsStore[k]; }
    };
  });

  afterEach(() => {
    if (realGMGet === undefined) delete globalThis.GM_getValue; else globalThis.GM_getValue = realGMGet;
    if (realGMSet === undefined) delete globalThis.GM_setValue; else globalThis.GM_setValue = realGMSet;
    if (realLS === undefined) delete globalThis.localStorage; else globalThis.localStorage = realLS;
  });

  it('corrupt domain backup returns default instead of throwing', () => {
    lsStore['tp_suite_v2_NEGATIVE_TERMS'] = '{broken json';
    assert.equal(_getValue('NEGATIVE_TERMS', 'fallback'), 'fallback');
  });

  it('writes mirror to both layers', () => {
    _setValue('MIN_OFFERS', 5);
    assert.equal(gmStore['MIN_OFFERS'], 5);
    assert.equal(lsStore['tp_suite_v2_MIN_OFFERS'], '5');
  });

  it('recovers domain backup when GM is empty (reinstall)', () => {
    lsStore['tp_suite_v2_NEGATIVE_TERMS'] = JSON.stringify('lego,playmobil');
    assert.equal(_getValue('NEGATIVE_TERMS', ''), 'lego,playmobil');
  });

  it('hide-unchecked defaults to false and round-trips through both layers', () => {
    assert.equal(DEFAULTS.BESTPREISE_HIDE_UNCHECKED, false);
    assert.equal(_getValue('BESTPREISE_HIDE_UNCHECKED', DEFAULTS.BESTPREISE_HIDE_UNCHECKED), false);
    _setValue('BESTPREISE_HIDE_UNCHECKED', true);
    assert.equal(_getValue('BESTPREISE_HIDE_UNCHECKED', false), true);
  });

  it('tavily-enabled defaults to false and round-trips through both layers', () => {
    assert.equal(DEFAULTS.TAVILY_ENABLED, false);
    assert.equal(_getValue('TAVILY_ENABLED', DEFAULTS.TAVILY_ENABLED), false);
    _setValue('TAVILY_ENABLED', true);
    assert.equal(_getValue('TAVILY_ENABLED', false), true);
  });

  it('has no display-mode key (filter-split removed MODE)', () => {
    assert.ok(!('MODE' in DEFAULTS));
    assert.ok(!('MODE' in CONFIG));
  });

  it('one-time migration silences stored DEBUG=true without clobbering re-enable', () => {
    gmStore['DEBUG'] = true;
    assert.equal(migrateLegacyDebug(), true);
    assert.equal(gmStore['DEBUG'], false);
    assert.equal(gmStore['MIGRATED_DEBUG_OFF'], true);
    gmStore['DEBUG'] = true;
    assert.equal(migrateLegacyDebug(), false);
    assert.equal(gmStore['DEBUG'], true);
  });
  it('one-time migration moves stored hide modes to dim once', () => {
    gmStore['FILTER_NEG_MODE'] = 'hide';
    gmStore['VORTIEF_MODE'] = 'hide';
    assert.equal(migrateHideToDimDefaults(), true);
    assert.equal(gmStore['FILTER_NEG_MODE'], 'dim');
    assert.equal(gmStore['VORTIEF_MODE'], 'dim');
    assert.equal(gmStore['MIGRATED_DIM_DEFAULT'], true);
    gmStore['FILTER_NEG_MODE'] = 'hide';
    assert.equal(migrateHideToDimDefaults(), false);
    assert.equal(gmStore['FILTER_NEG_MODE'], 'hide');
  });

  it('migrates legacy DISCORD_WEBHOOK_URL to DISCORD_CHANNELS', () => {
    gmStore['MIGRATED_DISCORD_CHANNELS'] = false;
    gmStore['DISCORD_WEBHOOK_URL'] = 'https://discord.com/api/webhooks/999/xyz';
    delete gmStore['DISCORD_CHANNELS'];

    assert.equal(migrateDiscordChannels(), true);
    assert.deepEqual(gmStore['DISCORD_CHANNELS'], [{
      id: 'default',
      name: 'Standard',
      url: 'https://discord.com/api/webhooks/999/xyz'
    }]);
    assert.equal(gmStore['MIGRATED_DISCORD_CHANNELS'], true);
  });

  it('filter modes default to dim fresh', () => {
    for (const k of ['FILTER_NEG_MODE', 'FILTER_MIN_MODE', 'HIDE_UNCHECKED_MODE', 'VORTIEF_MODE', 'DEALER_MODE']) {
      assert.equal(DEFAULTS[k], 'dim');
    }
  });

  it('accepts highlight mode in schema sanitization', () => {
    assert.equal(sanitizeConfigValue('VORTIEF_MODE', 'highlight'), 'highlight');
    assert.equal(sanitizeConfigValue('FILTER_NEG_MODE', 'highlight'), 'highlight');
    assert.equal(sanitizeConfigValue('VORTIEF_MODE', 'dim'), 'dim');
    assert.equal(sanitizeConfigValue('VORTIEF_MODE', 'hide'), 'hide');
    assert.equal(sanitizeConfigValue('VORTIEF_MODE', 'invalid'), 'dim');
    assert.equal(sanitizeConfigValue('TAVILY_ENABLED', true), true);
    assert.equal(sanitizeConfigValue('TAVILY_ENABLED', false), false);
    assert.equal(sanitizeConfigValue('TAVILY_ENABLED', 'invalid'), false);
  });

});

describe('weightText desc (worked example moves with the slider)', () => {
  it('shows Gewichtete Differenz 18 at 50/50 for the demo Rek -10% + O -25%', () => {
    const text = weightText(0.50, 'desc');
    assert.ok(text.includes('Gewichtete Differenz 18'));
    assert.ok(text.includes('Farb-Emphase'));
  });

  it('moves the demo blend with the weight (pure Rekord / pure O)', () => {
    assert.ok(weightText(1.00, 'desc').includes('Gewichtete Differenz 10'));
    assert.ok(weightText(0.00, 'desc').includes('Gewichtete Differenz 25'));
  });
});

describe('weightText short (endpoint and detent labels)', () => {
  it('names the endpoints and detents exactly', () => {
    assert.equal(weightText(1, 'short'), '100% Rek');
    assert.equal(weightText(0.7, 'short'), '70/30');
    assert.equal(weightText(0.5, 'short'), '50/50');
    assert.equal(weightText(0.3, 'short'), '30/70');
    assert.equal(weightText(0, 'short'), '100% Med');
  });

  it('falls back to N% Rek off-detent and tolerates float noise', () => {
    assert.equal(weightText(0.95, 'short'), '95% Rek');
    assert.equal(weightText(0.69999999, 'short'), '70/30');
  });
});

describe('realDealMinDiscount (explicit 0% survives)', () => {
  const prev = CONFIG.REAL_DEAL_MIN_DISCOUNT;
  const restore = () => { CONFIG.REAL_DEAL_MIN_DISCOUNT = prev; };

  it('preserves an explicit 0 instead of falling back to 30', () => {
    CONFIG.REAL_DEAL_MIN_DISCOUNT = 0;
    try {
      assert.equal(realDealMinDiscount(), 0);
    } finally { restore(); }
  });

  it('passes ordinary values through, falls back on garbage', () => {
    try {
      CONFIG.REAL_DEAL_MIN_DISCOUNT = 25;
      assert.equal(realDealMinDiscount(), 25);
      CONFIG.REAL_DEAL_MIN_DISCOUNT = NaN;
      assert.equal(realDealMinDiscount(), 30);
      CONFIG.REAL_DEAL_MIN_DISCOUNT = undefined;
      assert.equal(realDealMinDiscount(), 30);
    } finally { restore(); }
  });
});

describe('horizon UI mapping (range sentinel + typed values)', () => {
  it('maps range values above 730 days to Lifetime (0)', () => {
    assert.equal(horizonUiToStored(760), 0);
    assert.equal(horizonUiToStored(731), 0);
    assert.equal(horizonUiToStored(730), 730);
    assert.equal(horizonUiToStored(365), 365);
    assert.equal(horizonUiToStored(NaN), 365);
  });

  it('round-trips the Lifetime sentinel to the range top', () => {
    assert.equal(horizonStoredToUi(0), 760);
    assert.equal(horizonStoredToUi(365), 365);
  });
});

describe('FILTER_CYCLE deal discount mapping', () => {
  it('registers FILTER_DEAL_DISCOUNT_MODE in FILTER_CYCLE', () => {
    assert.deepEqual(FILTER_CYCLE.FILTER_DEAL_DISCOUNT_MODE, { enable: 'FILTER_DEAL_DISCOUNT_ENABLED', on: true });
  });

  it('cycleStateOf derives off when disabled, mode when enabled', () => {
    const prevEn = CONFIG.FILTER_DEAL_DISCOUNT_ENABLED;
    const prevMode = CONFIG.FILTER_DEAL_DISCOUNT_MODE;
    try {
      CONFIG.FILTER_DEAL_DISCOUNT_ENABLED = false;
      CONFIG.FILTER_DEAL_DISCOUNT_MODE = 'dim';
      assert.equal(cycleStateOf('FILTER_DEAL_DISCOUNT_MODE'), 'off');

      CONFIG.FILTER_DEAL_DISCOUNT_ENABLED = true;
      CONFIG.FILTER_DEAL_DISCOUNT_MODE = 'hide';
      assert.equal(cycleStateOf('FILTER_DEAL_DISCOUNT_MODE'), 'hide');
    } finally {
      CONFIG.FILTER_DEAL_DISCOUNT_ENABLED = prevEn;
      CONFIG.FILTER_DEAL_DISCOUNT_MODE = prevMode;
    }
  });

  it('sanitizes MIN_DEAL_DISCOUNT bounds (0..50)', () => {
    assert.equal(sanitizeConfigValue('MIN_DEAL_DISCOUNT', -10), 0);
    assert.equal(sanitizeConfigValue('MIN_DEAL_DISCOUNT', 25), 25);
    assert.equal(sanitizeConfigValue('MIN_DEAL_DISCOUNT', 75), 50);
    assert.equal(sanitizeConfigValue('MIN_DEAL_DISCOUNT', 'garbage'), 0);
  });

  it('HIDE_ADS defaults to true and validates via schema', () => {
    assert.equal(DEFAULTS.HIDE_ADS, true);
    assert.equal(sanitizeConfigValue('HIDE_ADS', true), true);
    assert.equal(sanitizeConfigValue('HIDE_ADS', false), false);
    assert.equal(sanitizeConfigValue('HIDE_ADS', 'foo'), false);
  });

  it('syncUiControl synchronizes DISCORD_FORUM_TITLE checkbox', () => {
    const shadow = {
      getElementById(id) {
        if (id === 'tp-discord-forum-title-toggle') return this._toggle;
        return null;
      },
      _toggle: { checked: false }
    };
    syncUiControl('DISCORD_FORUM_TITLE', true, {}, shadow);
    assert.equal(shadow._toggle.checked, true);
    syncUiControl('DISCORD_FORUM_TITLE', false, {}, shadow);
    assert.equal(shadow._toggle.checked, false);
  });

  it('sanitizes CACHE_MEMORY_LIMIT (100..2000, default 500)', () => {
    assert.equal(DEFAULTS.CACHE_MEMORY_LIMIT, 500);
    assert.equal(sanitizeConfigValue('CACHE_MEMORY_LIMIT', 50), 100);
    assert.equal(sanitizeConfigValue('CACHE_MEMORY_LIMIT', 750), 750);
    assert.equal(sanitizeConfigValue('CACHE_MEMORY_LIMIT', 5000), 2000);
    assert.equal(sanitizeConfigValue('CACHE_MEMORY_LIMIT', 'invalid'), 500);
  });

  it('sanitizes CACHE_DISK_LIMIT (100..1000, default 300)', () => {
    assert.equal(DEFAULTS.CACHE_DISK_LIMIT, 300);
    assert.equal(sanitizeConfigValue('CACHE_DISK_LIMIT', 20), 100);
    assert.equal(sanitizeConfigValue('CACHE_DISK_LIMIT', 450), 450);
    assert.equal(sanitizeConfigValue('CACHE_DISK_LIMIT', 2500), 1000);
    assert.equal(sanitizeConfigValue('CACHE_DISK_LIMIT', 'invalid'), 300);
  });

  it('syncUiControl synchronizes CACHE_MEMORY_LIMIT and CACHE_DISK_LIMIT inputs', () => {
    const elements = {};
    const shadow = {
      getElementById(id) {
        if (!elements[id]) elements[id] = { value: null };
        return elements[id];
      }
    };
    syncUiControl('CACHE_MEMORY_LIMIT', 750, {}, shadow);
    assert.equal(elements['tp-cache-memory-range'].value, 750);
    assert.equal(elements['tp-cache-memory-val'].value, 750);

    syncUiControl('CACHE_DISK_LIMIT', 450, {}, shadow);
    assert.equal(elements['tp-cache-disk-range'].value, 450);
    assert.equal(elements['tp-cache-disk-val'].value, 450);
  });

  it('sanitizes TAVILY_SEARCH_DEPTH and TAVILY_MAX_RESULTS', () => {
    assert.equal(DEFAULTS.TAVILY_SEARCH_DEPTH, 'basic');
    assert.equal(DEFAULTS.TAVILY_MAX_RESULTS, 5);
    assert.equal(sanitizeConfigValue('TAVILY_SEARCH_DEPTH', 'advanced'), 'advanced');
    assert.equal(sanitizeConfigValue('TAVILY_SEARCH_DEPTH', 'invalid'), 'basic');
    assert.equal(sanitizeConfigValue('TAVILY_MAX_RESULTS', 8), 8);
    assert.equal(sanitizeConfigValue('TAVILY_MAX_RESULTS', 0), 1);
    assert.equal(sanitizeConfigValue('TAVILY_MAX_RESULTS', 50), 10);
    assert.equal(sanitizeConfigValue('TAVILY_MAX_RESULTS', 'not-a-num'), 5);
  });

  it('syncUiControl synchronizes Tavily parameters in shadow DOM', () => {
    const elements = {};
    const shadow = {
      getElementById(id) {
        if (!elements[id]) elements[id] = { value: null };
        return elements[id];
      }
    };
    syncUiControl('TAVILY_SEARCH_DEPTH', 'advanced', {}, shadow);
    assert.equal(elements['tp-tavily-search-depth'].value, 'advanced');

    syncUiControl('TAVILY_MAX_RESULTS', 8, {}, shadow);
    assert.equal(elements['tp-tavily-max-results'].value, '8');
  });

  it('sanitizes FILTER_PRICE_* and FILTER_SAVINGS_* settings and registers them in FILTER_CYCLE', () => {
    assert.equal(DEFAULTS.FILTER_PRICE_ENABLED, false);
    assert.equal(DEFAULTS.FILTER_PRICE_MIN, 0);
    assert.equal(DEFAULTS.FILTER_PRICE_MAX, 0);
    assert.equal(DEFAULTS.FILTER_PRICE_MODE, 'dim');
    assert.equal(DEFAULTS.FILTER_SAVINGS_ENABLED, false);
    assert.equal(DEFAULTS.FILTER_SAVINGS_MIN, 0);
    assert.equal(DEFAULTS.FILTER_SAVINGS_MAX, 0);
    assert.equal(DEFAULTS.FILTER_SAVINGS_MODE, 'dim');

    assert.equal(sanitizeConfigValue('FILTER_PRICE_MIN', 49.90), 49.90);
    assert.equal(sanitizeConfigValue('FILTER_PRICE_MIN', -10), 0);
    assert.equal(sanitizeConfigValue('FILTER_PRICE_MAX', '500'), 500);
    assert.equal(sanitizeConfigValue('FILTER_SAVINGS_MIN', 20), 20);
    assert.equal(sanitizeConfigValue('FILTER_SAVINGS_MODE', 'hide'), 'hide');
    assert.equal(sanitizeConfigValue('FILTER_SAVINGS_MODE', 'invalid'), 'dim');

    assert.ok('FILTER_PRICE_MODE' in FILTER_CYCLE);
    assert.ok('FILTER_SAVINGS_MODE' in FILTER_CYCLE);
  });

  it('keeps DISCORD_CHANNELS secret and sanitizes channel items', () => {
    assert.ok(SECRET_KEYS.has('DISCORD_CHANNELS'));
    assert.ok(SECRET_KEYS.has('DISCORD_WEBHOOK_URL'));

    assert.deepEqual(sanitizeChannels(null), []);
    assert.deepEqual(sanitizeChannels('not-array'), []);

    const raw = [
      { id: 'c1', name: '  Deals  ', url: 'https://discord.com/api/webhooks/1/abc  ' },
      { id: '', name: '', url: 'https://discord.com/api/webhooks/2/def' },
      null,
      'invalid'
    ];
    const cleaned = sanitizeChannels(raw);
    assert.equal(cleaned.length, 2);
    assert.deepEqual(cleaned[0], { id: 'c1', name: 'Deals', url: 'https://discord.com/api/webhooks/1/abc' });
    assert.equal(cleaned[1].name, 'Kanal 2');
    assert.equal(cleaned[1].url, 'https://discord.com/api/webhooks/2/def');
    assert.ok(cleaned[1].id.startsWith('ch_'));
  });

  it('aligns SETTING_SCHEMA defaults with DEFAULTS for all schema keys', () => {
    for (const [key, schema] of Object.entries(SETTING_SCHEMA)) {
      if (schema && 'default' in schema && key in DEFAULTS) {
        assert.deepEqual(schema.default, DEFAULTS[key], `mismatched default for ${key}`);
      }
    }
  });
});

