import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDistinctProductIds, extractCardDiff, extractCardDiscount, getInsetHeatStyle, getBadgeHeatStyle, applyCardFilters, isCardFilteredOut, parseNegativeTerms, matchesNegativeTerms, extractOfferCount } from '../../src/page/cards.js';
import { withConfig } from './helpers.js';

describe('Page & Card Layer - Container Defense & Heatmap', () => {
  describe('getDistinctProductIds', () => {
    it('returns empty array for invalid inputs', () => {
      assert.deepStrictEqual(getDistinctProductIds(null), []);
      assert.deepStrictEqual(getDistinctProductIds({}), []);
    });

    it('extracts single product ID across duplicate links on the same card', () => {
      const card = {
        tagName: 'DIV',
        querySelectorAll: () => [
          { getAttribute: () => '/preisvergleich/Test-Product-p12345', href: '/preisvergleich/Test-Product-p12345', closest: () => null },
          { getAttribute: () => '/preisvergleich/Test-Product-p12345', href: '/preisvergleich/Test-Product-p12345', closest: () => null }
        ]
      };
      const ids = getDistinctProductIds(card);
      assert.deepStrictEqual(ids, ['12345']);
    });

    it('detects multiple distinct product IDs in container element', () => {
      const container = {
        tagName: 'DIV',
        querySelectorAll: () => [
          { getAttribute: () => '/preisvergleich/Prod-A-p100', href: '/preisvergleich/Prod-A-p100', closest: () => null },
          { getAttribute: () => '/preisvergleich/Prod-B-p200', href: '/preisvergleich/Prod-B-p200', closest: () => null }
        ]
      };
      const ids = getDistinctProductIds(container);
      assert.strictEqual(ids.length, 2);
      assert.ok(ids.includes('100'));
      assert.ok(ids.includes('200'));
    });
  });

  describe('extractCardDiff & extractCardDiscount', () => {
    it('parses negative percentage as discount', () => {
      const card = {
        dataset: {},
        querySelector: () => ({ textContent: '-42%' }),
        textContent: '-42%'
      };
      assert.strictEqual(extractCardDiff(card), -42);
      assert.strictEqual(extractCardDiscount(card), 42);
    });

    it('parses positive percentage as markup and normalizes zero', () => {
      const card1 = {
        dataset: {},
        querySelector: () => ({ textContent: '+15%' }),
        textContent: '+15%'
      };
      assert.strictEqual(extractCardDiff(card1), 15);
      assert.strictEqual(extractCardDiscount(card1), -15);

      const card2 = {
        dataset: {},
        querySelector: () => ({ textContent: '0%' }),
        textContent: '0%'
      };
      assert.strictEqual(extractCardDiff(card2), 0);
      assert.strictEqual(extractCardDiscount(card2), 0);
      assert.strictEqual(Object.is(extractCardDiff(card2), -0), false);
    });
  });

  // Blind heatmap: no fallback-specific visual remains — every heatable card
  // gets the inset wash (getInsetHeatStyle); kind only labels the badge source.
  describe('getInsetHeatStyle regular-deal signal (prominent inset wash, no fill, no border)', () => {
    it('returns an inset glow for a deep drop (positive magnitude)', () => {
      const styles = getInsetHeatStyle(50);
      assert.ok(!('border' in styles));
      assert.ok(styles.glow.startsWith('inset'));
    });
  });

  describe('getBadgeHeatStyle (badge reuses the card ramp)', () => {
    it('returns a solid swatch matching the card heat', () => {
      const badge = getBadgeHeatStyle(-58);
      assert.ok(badge.background.startsWith('rgba('));
      assert.ok(!badge.background.includes('gradient'));
      assert.ok(badge.border.startsWith('rgba('));
    });

    it('steps visibly with deal size', () => {
      assert.notEqual(getBadgeHeatStyle(-58).background, getBadgeHeatStyle(-8).background);
    });

    it('returns a paler swatch for provisional input', () => {
      assert.notEqual(getBadgeHeatStyle(-58, true).background, getBadgeHeatStyle(-58, false).background);
    });

    it('scales with intensity exactly like the card (default unchanged)', () => {
      assert.deepEqual(getBadgeHeatStyle(-58), getBadgeHeatStyle(-58, false, 1.0));
      assert.deepEqual(getBadgeHeatStyle(-58, true), getBadgeHeatStyle(-58, true, 1.0));
      const full = getBadgeHeatStyle(-58, false, 1.0);
      const faint = getBadgeHeatStyle(-58, false, 0.5);
      assert.notEqual(full.background, faint.background);
      // Provisional ratio survives intensity scaling.
      assert.notEqual(getBadgeHeatStyle(-58, true, 0.5).background, getBadgeHeatStyle(-58, false, 0.5).background);
    });
  });

  describe('matchesNegativeTerms (suite-injected text is never matched)', () => {
    it('ignores .tp-injected-badge text, matches native title text', () => {
      const terms = parseNegativeTerms('refurbished');
      const injectedOnly = {
        querySelector: () => ({ textContent: 'Apple iPhone 15 Pro' }),
        textContent: 'Apple iPhone 15 Pro Allzeit-Tiefstpreis refurbished',
      };
      assert.equal(matchesNegativeTerms(injectedOnly, terms), false);
      const nativeHit = {
        querySelector: () => ({ textContent: 'Apple iPhone refurbished 12' }),
        textContent: 'Apple iPhone refurbished 12',
      };
      assert.equal(matchesNegativeTerms(nativeHit, terms), true);
    });
  });
});

describe('applyCardFilters split', () => {
  const base = overrides => ({
    card: {},
    stats: { tiefstpreis: 100 },
    displayDelta: { kind: 'above-low', markup: 20 },
    dealScore: null,
    offerCount: 0,
    ...overrides,
  });
  const quietFlags = fn => withConfig('FILTER_NEG_ENABLED', false, () =>
    withConfig('FILTER_MIN_ENABLED', false, () =>
      withConfig('BESTPREISE_HIDE_UNCHECKED', false, () =>
        withConfig('BESTPREISE_INCLUDE_VORTIEF', true, fn))));

  it('never removes verified markups and exposes the five removal causes only', () => {
    const f = quietFlags(() => applyCardFilters(base({}), [], 0, false));
    assert.equal(f.isExcluded, false);
    assert.deepEqual(Object.keys(f).sort(), ['isDealerLoser', 'isExcluded', 'isLowOffers', 'isNeg', 'isUnchecked', 'isVortiefExcluded']);
  });

  it('excludes at-low fallback instead when Fallback-Tiefs are off', () => {
    const f = quietFlags(() => withConfig('BESTPREISE_INCLUDE_VORTIEF', false, () =>
      applyCardFilters(base({ displayDelta: { kind: 'at-low' } }), [], 0, false)));
    assert.equal(f.isVortiefExcluded, true);
    assert.equal(f.isExcluded, true);
  });

  it('never excludes fallbacks off the deal feed (no switch there)', () => {
    const f = quietFlags(() => withConfig('BESTPREISE_INCLUDE_VORTIEF', false, () =>
      applyCardFilters(base({ displayDelta: { kind: 'at-low' } }), [], 0, false, false)));
    assert.equal(f.isVortiefExcluded, false);
    assert.equal(f.isExcluded, false);
  });

  it('filters unchecked cards when Ungeprüfte is on', () => {
    const f = quietFlags(() => withConfig('BESTPREISE_HIDE_UNCHECKED', true, () =>
      applyCardFilters(base({ stats: null }), [], 0, false)));
    assert.equal(f.isUnchecked, true);
    assert.equal(f.isExcluded, true);
  });

});

describe('isCardFilteredOut forScan', () => {
  const fakeCard = () => ({
    hidden: false,
    offsetParent: undefined,
    classList: { contains: () => false },
    closest: () => null,
  });
  const uncheckedOnly = { isNeg: false, isLowOffers: false, isDealerLoser: false, isUnchecked: true, isVortiefExcluded: false };

  it('unchecked-only is scan target with forScan, filtered without', () => {
    assert.equal(isCardFilteredOut(fakeCard(), uncheckedOnly, { forScan: true }), false);
    withConfig('HIDE_UNCHECKED_MODE', 'hide', () => {
      assert.equal(isCardFilteredOut(fakeCard(), uncheckedOnly), true);
    });
  });

  it('neg-only filters even with forScan', () => {
    withConfig('FILTER_NEG_MODE', 'hide', () => {
      assert.equal(isCardFilteredOut(fakeCard(), { ...uncheckedOnly, isNeg: true, isUnchecked: false }, { forScan: true }), true);
    });
  });

  it('neg+unchecked mixed filters with forScan', () => {
    withConfig('FILTER_NEG_MODE', 'hide', () => {
      assert.equal(isCardFilteredOut(fakeCard(), { ...uncheckedOnly, isNeg: true }, { forScan: true }), true);
    });
  });

  it('vortief-excluded filters with forScan', () => {
    withConfig('VORTIEF_MODE', 'hide', () => {
      assert.equal(isCardFilteredOut(fakeCard(), { ...uncheckedOnly, isUnchecked: false, isVortiefExcluded: true }, { forScan: true }), true);
    });
  });

  it('neg-hit with dim mode is not filtered out (scan or not)', () => {
    const f = { ...uncheckedOnly, isNeg: true, isUnchecked: false };
    withConfig('FILTER_NEG_MODE', 'dim', () => {
      assert.equal(isCardFilteredOut(fakeCard(), f), false);
      assert.equal(isCardFilteredOut(fakeCard(), f, { forScan: true }), false);
    });
  });

  it('neg-hit with hide mode is filtered out', () => {
    const f = { ...uncheckedOnly, isNeg: true, isUnchecked: false };
    withConfig('FILTER_NEG_MODE', 'hide', () => {
      assert.equal(isCardFilteredOut(fakeCard(), f), true);
    });
  });

  it('unchecked-hit with dim mode is not filtered out (non-scan)', () => {
    withConfig('HIDE_UNCHECKED_MODE', 'dim', () => {
      assert.equal(isCardFilteredOut(fakeCard(), uncheckedOnly), false);
    });
  });
});

describe('extractOfferCount languages', () => {
  const fakeOfferCard = text => ({ textContent: text, dataset: {}, querySelectorAll: () => [] });

  it('parses DE/FR/IT/EN offer labels', () => {
    assert.equal(extractOfferCount(fakeOfferCard('7 Angebote vergleichen')), 7);
    assert.equal(extractOfferCount(fakeOfferCard('1 Angebot')), 1);
    assert.equal(extractOfferCount(fakeOfferCard('3 offres')), 3);
    assert.equal(extractOfferCount(fakeOfferCard('12 offerta')), 12);
    assert.equal(extractOfferCount(fakeOfferCard('9 offerte')), 9);
    assert.equal(extractOfferCount(fakeOfferCard('5 offers')), 5);
    assert.equal(extractOfferCount(fakeOfferCard('2 offer')), 2);
  });

  it('falls back to the dealer-row count', () => {
    assert.equal(extractOfferCount({ textContent: 'kein Treffer', dataset: {}, querySelectorAll: () => [1, 2, 3] }), 3);
  });
});
