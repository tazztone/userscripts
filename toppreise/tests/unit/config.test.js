import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { _getValue, _setValue, weightDescText } from '../../src/state/config.js';

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
});

describe('weightDescText (worked example moves with the slider)', () => {
  it('shows Score 18 at 50/50 for the demo Rek -10% + O -25%', () => {
    const text = weightDescText(0.50);
    assert.ok(text.includes('Score 18'));
    assert.ok(text.includes('nur Sortierung'));
  });

  it('moves the demo score with the weight (pure Rekord / pure O)', () => {
    assert.ok(weightDescText(1.00).includes('Score 10'));
    assert.ok(weightDescText(0.00).includes('Score 25'));
  });
});
