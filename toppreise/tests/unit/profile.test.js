import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { _getValue, _setValue, DEFAULTS, CONFIG, PAGE_SCOPED_KEYS, updateConfig, saveConfigKey, initPageProfiles } from '../../src/state/config.js';
import { getPageProfileType, getPageProfileLabel } from '../../src/page/adapter.js';

describe('Page Profiles Engine', () => {
  let realGMGet, realGMSet, realLS, realLocation, realDocument;
  let gmStore, lsStore;

  beforeEach(() => {
    realGMGet = globalThis.GM_getValue;
    realGMSet = globalThis.GM_setValue;
    realLS = globalThis.localStorage;
    realLocation = globalThis.location;
    realDocument = globalThis.document;

    gmStore = {};
    lsStore = {};
    globalThis.GM_getValue = k => gmStore[k];
    globalThis.GM_setValue = (k, v) => { gmStore[k] = v; };
    globalThis.localStorage = {
      getItem: k => (k in lsStore ? lsStore[k] : null),
      setItem: (k, v) => { lsStore[k] = String(v); },
      removeItem: k => { delete lsStore[k]; }
    };
    globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise' };
    globalThis.document = {
      body: {
        classList: { contains: () => false },
        getAttribute: () => null
      },
      getElementById: () => null,
      querySelector: () => null
    };

    // Reset relevant config keys to defaults
    CONFIG.FILTER_REMEMBER_PER_PAGE_TYPE = true;
    CONFIG.MIN_OFFERS = 0;
    CONFIG.HEATMAP_INTENSITY = 1.0;
    CONFIG.BESTPREISE_MODE_ACTIVE = false;
    CONFIG.NEGATIVE_TERMS = '';
  });

  afterEach(() => {
    if (realGMGet === undefined) delete globalThis.GM_getValue; else globalThis.GM_getValue = realGMGet;
    if (realGMSet === undefined) delete globalThis.GM_setValue; else globalThis.GM_setValue = realGMSet;
    if (realLS === undefined) delete globalThis.localStorage; else globalThis.localStorage = realLS;
    if (realLocation === undefined) delete globalThis.location; else globalThis.location = realLocation;
    if (realDocument === undefined) delete globalThis.document; else globalThis.document = realDocument;
  });

  it('detects page profile types correctly', () => {
    assert.equal(getPageProfileType('https://www.toppreise.ch/neue-toppreise'), 'neue');
    assert.equal(getPageProfileType('https://www.toppreise.ch/produktsuche?q=rtx'), 'search');
    assert.equal(getPageProfileType('https://www.toppreise.ch/katalog/Hardware-c1'), 'search');
    assert.equal(getPageProfileLabel('neue'), '⚡ Neue Toppreise');
    assert.equal(getPageProfileLabel('search'), '🔍 Suche & Katalog');
  });

  it('seeds both profiles from current CONFIG on first run', () => {
    CONFIG.MIN_OFFERS = 3;
    CONFIG.HEATMAP_INTENSITY = 0.8;
    initPageProfiles('neue');

    const storedProfiles = _getValue('PAGE_PROFILES', null);
    assert.ok(storedProfiles, 'PAGE_PROFILES should be created');
    assert.equal(storedProfiles.neue.MIN_OFFERS, 3);
    assert.equal(storedProfiles.search.MIN_OFFERS, 3);
    assert.equal(storedProfiles.neue.HEATMAP_INTENSITY, 0.8);
    assert.equal(storedProfiles.search.HEATMAP_INTENSITY, 0.8);
  });

  it('modifying scoped keys persists to active profile without altering other profile', () => {
    // Seed initial profiles
    initPageProfiles('neue');

    // On Neue Toppreise: change MIN_OFFERS to 5
    globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise' };
    updateConfig('MIN_OFFERS', 5, { skipRender: true });

    let stored = _getValue('PAGE_PROFILES', null);
    assert.equal(stored.neue.MIN_OFFERS, 5);
    assert.equal(stored.search.MIN_OFFERS, 0);

    // Switch context to search: change HEATMAP_INTENSITY to 0.4
    globalThis.location = { href: 'https://www.toppreise.ch/produktsuche?q=iphone' };
    initPageProfiles('search');
    assert.equal(CONFIG.MIN_OFFERS, 0, 'Search profile should retain original 0 min offers');

    updateConfig('HEATMAP_INTENSITY', 0.4, { skipRender: true });
    stored = _getValue('PAGE_PROFILES', null);
    assert.equal(stored.search.HEATMAP_INTENSITY, 0.4);
    assert.equal(stored.neue.HEATMAP_INTENSITY, 1.0);
    assert.equal(stored.neue.MIN_OFFERS, 5);
  });

  it('switching page profiles loads respective profile values into CONFIG', () => {
    _setValue('PAGE_PROFILES', {
      neue: { MIN_OFFERS: 7, BESTPREISE_MODE_ACTIVE: true, NEGATIVE_TERMS: 'refurbished' },
      search: { MIN_OFFERS: 1, BESTPREISE_MODE_ACTIVE: false, NEGATIVE_TERMS: 'bulk' }
    });

    initPageProfiles('neue');
    assert.equal(CONFIG.MIN_OFFERS, 7);
    assert.equal(CONFIG.BESTPREISE_MODE_ACTIVE, true);
    assert.equal(CONFIG.NEGATIVE_TERMS, 'refurbished');

    initPageProfiles('search');
    assert.equal(CONFIG.MIN_OFFERS, 1);
    assert.equal(CONFIG.BESTPREISE_MODE_ACTIVE, false);
    assert.equal(CONFIG.NEGATIVE_TERMS, 'bulk');
  });

  it('disabling FILTER_REMEMBER_PER_PAGE_TYPE saves active profile values to global storage', () => {
    CONFIG.FILTER_REMEMBER_PER_PAGE_TYPE = true;
    _setValue('PAGE_PROFILES', {
      neue: { MIN_OFFERS: 9 },
      search: { MIN_OFFERS: 2 }
    });

    initPageProfiles('neue');
    assert.equal(CONFIG.MIN_OFFERS, 9);

    // Turn off setting
    updateConfig('FILTER_REMEMBER_PER_PAGE_TYPE', false, { skipRender: true });
    assert.equal(_getValue('MIN_OFFERS', null), 9);
    assert.equal(CONFIG.FILTER_REMEMBER_PER_PAGE_TYPE, false);

    // Mutations while disabled go directly to global storage and skip PAGE_PROFILES
    updateConfig('MIN_OFFERS', 4, { skipRender: true });
    assert.equal(_getValue('MIN_OFFERS', null), 4);
    const profiles = _getValue('PAGE_PROFILES', null);
    assert.equal(profiles.neue.MIN_OFFERS, 9, 'PAGE_PROFILES should not be updated while disabled');
  });
});
