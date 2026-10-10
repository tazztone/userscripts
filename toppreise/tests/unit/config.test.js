import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { _getValue, _setValue, weightText, DEFAULTS, migrateLegacyDebug } from '../../src/state/config.js';

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

  it('one-time migration silences stored DEBUG=true without clobbering re-enable', () => {
    gmStore['DEBUG'] = true;
    assert.equal(migrateLegacyDebug(), true);
    assert.equal(gmStore['DEBUG'], false);
    assert.equal(gmStore['MIGRATED_DEBUG_OFF'], true);
    gmStore['DEBUG'] = true;
    assert.equal(migrateLegacyDebug(), false);
    assert.equal(gmStore['DEBUG'], true);
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
