import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDistinctProductIds, extractCardDiff, extractCardDiscount, getInsetHeatStyle, getBadgeHeatStyle, applyCardFilters, isCardFilteredOut, parseNegativeTerms, matchesNegativeTerms, extractOfferCount, extractCardData, dealerLoserFor, scanEligibility } from '../../src/page/cards.js';
import { setCachedPriceStats, memoryCache, statsKey } from '../../src/scanner/cache.js';
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

    it('reads the pid-keyed snapshot on script-painted badges, ignores foreign pids', () => {
      const painted = (pid, snapPid, snap) => ({
        dataset: { entityId: pid },
        querySelector: () => ({ textContent: '⏳ Prüfe…', dataset: { tpPainted: 'true', tpOriginalPid: snapPid, tpOriginalDiscount: snap } }),
        textContent: ''
      });
      // Snapshot discount 67 → diff -67, discount 67.
      assert.strictEqual(extractCardDiff(painted('p1', 'p1', '67')), -67);
      assert.strictEqual(extractCardDiscount(painted('p1', 'p1', '67')), 67);
      // Reused node, snapshot from previous product: ignore (null, not wrong).
      assert.strictEqual(extractCardDiff(painted('p2', 'p1', '67')), null);
      assert.strictEqual(extractCardDiscount(painted('p2', 'p1', '67')), null);
    });
    it('voids the snapshot on same-product host badge updates', () => {
      const badge = { textContent: '-50%', dataset: { tpPainted: 'true', tpOriginalPid: 'p1', tpOriginalDiscount: '30', tpPaintedText: '⏳ Prüfe…' } };
      const card = { dataset: { entityId: 'p1' }, querySelector: () => badge, textContent: '' };
      assert.strictEqual(extractCardDiff(card), -50);
    });
  });

  describe('scanEligibility', () => {
    it('buckets no-pid, unavailable, verified and unchecked cards', () => {
      withConfig('USE_SHIPPING_PRICE', false, () => {
        const noPid = scanEligibility({ dataset: {} });
        assert.equal(noPid.canScan, false);
        assert.equal(noPid.state, 'verified');
        assert.equal(noPid.reason, 'no-pid');
        setCachedPriceStats('neg1', {}, true);
        const neg = scanEligibility({ dataset: { entityId: 'neg1' } });
        assert.equal(neg.canScan, false);
        assert.equal(neg.state, 'unavailable');
        assert.ok(neg.retryAt > Date.now());
        setCachedPriceStats('ok1', { tiefstpreis: 100 });
        const ok = scanEligibility({ dataset: { entityId: 'ok1' } });
        assert.equal(ok.canScan, false);
        assert.equal(ok.state, 'verified');
        const fresh = scanEligibility({ dataset: { entityId: 'new1' } });
        assert.equal(fresh.canScan, true);
        assert.equal(fresh.state, 'unchecked');
      });
      withConfig('USE_SHIPPING_PRICE', false, () => {
        for (const pid of ['neg1', 'ok1']) memoryCache.delete(statsKey(pid));
      });
    });
    it('marks basis mismatches as scannable', () => {
      withConfig('USE_SHIPPING_PRICE', true, () => {
        setCachedPriceStats('mm1', { tiefstpreis: 100, isShippingPrice: true });
        const card = {
          dataset: { entityId: 'mm1' },
          _tpPriceInfo: { mainPriceInfo: null, mainShipping: null, mainProduct: null, fallbackShipping: null, fallbackProduct: { textContent: 'CHF 100' } }
        };
        const elig = scanEligibility(card);
        assert.equal(elig.canScan, true);
        assert.equal(elig.state, 'basis-mismatch');
        memoryCache.delete(statsKey('mm1'));
      });
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
    assert.deepEqual(Object.keys(f).sort(), ['isDealerLoser', 'isLowOffers', 'isNeg', 'isUnchecked', 'isVortiefExcluded']);
  });

  it('excludes at-low fallback instead when Fallback-Tiefs are off', () => {
    const f = quietFlags(() => withConfig('BESTPREISE_INCLUDE_VORTIEF', false, () =>
      applyCardFilters(base({ displayDelta: { kind: 'at-low' } }), [], 0, false)));
    assert.equal(f.isVortiefExcluded, true);
  });

  it('never excludes fallbacks off the deal feed (no switch there)', () => {
    const f = quietFlags(() => withConfig('BESTPREISE_INCLUDE_VORTIEF', false, () =>
      applyCardFilters(base({ displayDelta: { kind: 'at-low' } }), [], 0, false, false)));
    assert.equal(f.isVortiefExcluded, false);
  });

  it('filters unchecked cards when Ungeprüfte is on', () => {
    const f = quietFlags(() => withConfig('BESTPREISE_HIDE_UNCHECKED', true, () =>
      applyCardFilters(base({ stats: null }), [], 0, false)));
    assert.equal(f.isUnchecked, true);
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

  it('dealer-loser filters with forScan in remove mode, not in dim mode', () => {
    const f = { isNeg: false, isLowOffers: false, isDealerLoser: true, isUnchecked: false, isVortiefExcluded: false };
    withConfig('DEALER_MODE', 'remove', () => {
      assert.equal(isCardFilteredOut(fakeCard(), f, { forScan: true }), true);
    });
    withConfig('DEALER_MODE', 'dim', () => {
      assert.equal(isCardFilteredOut(fakeCard(), f, { forScan: true }), false);
    });
  });

  it('highlight mode keeps cards visible and not filtered out', () => {
    const fVortief = { isNeg: false, isLowOffers: false, isDealerLoser: false, isUnchecked: false, isVortiefExcluded: true };
    withConfig('VORTIEF_MODE', 'highlight', () => {
      assert.equal(isCardFilteredOut(fakeCard(), fVortief), false);
    });
    const fNeg = { isNeg: true, isLowOffers: false, isDealerLoser: false, isUnchecked: false, isVortiefExcluded: false };
    withConfig('FILTER_NEG_MODE', 'highlight', () => {
      assert.equal(isCardFilteredOut(fakeCard(), fNeg), false);
    });
    const fDealer = { isNeg: false, isLowOffers: false, isDealerLoser: true, isUnchecked: false, isVortiefExcluded: false };
    withConfig('DEALER_MODE', 'highlight', () => {
      assert.equal(isCardFilteredOut(fakeCard(), fDealer, { forScan: true }), false);
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

describe('extractCardData basis gate', () => {
  const PID = 'basis-pid';
  const basisCard = ({ shippingPrice, productPrice }) => ({
    dataset: { entityId: PID },
    textContent: '',
    querySelector: sel => {
      if (sel.includes('.priceContainer.shippingPrice')) return shippingPrice ? { textContent: shippingPrice } : null;
      if (sel.includes('.priceContainer.productPrice')) return productPrice ? { textContent: productPrice } : null;
      return null;
    },
    querySelectorAll: () => []
  });

  beforeEach(() => { memoryCache.clear(); });

  it('product-only price against shipping history renders unverified', () => {
    withConfig('USE_SHIPPING_PRICE', true, () => {
      setCachedPriceStats(PID, { tiefstpreis: 45, hoechstpreis: 60, isShippingPrice: true });
      const cd = extractCardData(basisCard({ productPrice: 'CHF 39.00' }));
      assert.equal(cd.cardPrice, 39);
      assert.equal(cd.cardPriceBasis, 'product');
      assert.equal(cd.verifiedStats, null);
      assert.equal(cd.dealScore, null);
      assert.equal(cd.displayDelta.kind, 'unknown');
    });
  });

  it('shipping-only price against product history renders unverified', () => {
    withConfig('USE_SHIPPING_PRICE', false, () => {
      setCachedPriceStats(PID, { tiefstpreis: 39, hoechstpreis: 60, isShippingPrice: false });
      const cd = extractCardData(basisCard({ shippingPrice: 'CHF 45.00' }));
      assert.equal(cd.cardPrice, 45);
      assert.equal(cd.cardPriceBasis, 'shipping');
      assert.equal(cd.verifiedStats, null);
      assert.equal(cd.dealScore, null);
      assert.equal(cd.displayDelta.kind, 'unknown');
    });
  });

  it('matching basis still scores', () => {
    withConfig('USE_SHIPPING_PRICE', true, () => {
      setCachedPriceStats(PID, { tiefstpreis: 45, hoechstpreis: 60, medianPrice: 55, isShippingPrice: true });
      const cd = extractCardData(basisCard({ shippingPrice: 'CHF 45.00', productPrice: 'CHF 39.00' }));
      assert.equal(cd.cardPriceBasis, 'shipping');
      assert.ok(cd.verifiedStats !== null);
      assert.ok(cd.dealScore !== null);
      assert.equal(cd.displayDelta.kind, 'at-low');
    });
  });

  it('legacy history without the basis flag passes through', () => {
    withConfig('USE_SHIPPING_PRICE', true, () => {
      setCachedPriceStats(PID, { tiefstpreis: 45, hoechstpreis: 60, medianPrice: 55 });
      const cd = extractCardData(basisCard({ productPrice: 'CHF 39.00' }));
      assert.ok(cd.dealScore !== null);
      assert.notEqual(cd.displayDelta.kind, 'unknown');
    });
  });
});

describe('dealerLoserFor any-match', () => {
  const dealerRow = (store, price) => ({
    querySelector: sel => {
      if (sel === '.title') return { textContent: store };
      if (sel === '.productPrice .Plugin_Price') return price ? { textContent: price } : null;
      return null;
    }
  });
  // Product mode: canonical price comes from the fallback product container.
  const dealerCard = rows => ({
    dataset: {},
    textContent: '',
    querySelector: sel => {
      if (sel.includes('.priceContainer.productPrice')) return { textContent: 'CHF 100.00' };
      return null;
    },
    querySelectorAll: sel => (String(sel).includes('DealerRelProdPriceInfo') ? rows : [])
  });

  it('keeps the card when a later selected dealer qualifies', () => {
    withConfig('USE_SHIPPING_PRICE', false, () => {
      const card = dealerCard([dealerRow('Teuer AG', 'CHF 150.00'), dealerRow('Billig AG', 'CHF 100.00')]);
      assert.equal(dealerLoserFor(card, ['teuerag', 'billigag']), false);
    });
  });

  it('verdict is independent of DOM order', () => {
    withConfig('USE_SHIPPING_PRICE', false, () => {
      const card = dealerCard([dealerRow('Billig AG', 'CHF 100.00'), dealerRow('Teuer AG', 'CHF 150.00')]);
      assert.equal(dealerLoserFor(card, ['teuerag', 'billigag']), false);
    });
  });

  it('loses only when every selected dealer is over margin', () => {
    withConfig('USE_SHIPPING_PRICE', false, () => {
      const card = dealerCard([dealerRow('A AG', 'CHF 150.00'), dealerRow('B AG', 'CHF 130.00')]);
      assert.equal(dealerLoserFor(card, ['aag', 'bbg']), true);
    });
  });

  it('no matching store is still a loss, no selected stores is not', () => {
    withConfig('USE_SHIPPING_PRICE', false, () => {
      const card = dealerCard([dealerRow('Fremd AG', 'CHF 90.00')]);
      assert.equal(dealerLoserFor(card, ['aag']), true);
      assert.equal(dealerLoserFor(card, []), false);
    });
  });

  it('productPrice-wrapped rows qualify in shipping mode (host row shape)', () => {
    withConfig('USE_SHIPPING_PRICE', true, () => {
      const card = {
        dataset: {},
        textContent: '',
        querySelector: sel => {
          if (sel.includes('.priceContainer.shippingPrice')) return { textContent: 'CHF 100.00' };
          return null;
        },
        querySelectorAll: sel => (String(sel).includes('DealerRelProdPriceInfo') ? [dealerRow('Billig AG', 'CHF 100.00')] : [])
      };
      assert.equal(dealerLoserFor(card, ['billigag']), false);
    });
  });
});

describe('unchecked counter parity', () => {
  it('fresh negative markers are truthy: scanner skips and counter excludes', () => {
    withConfig('USE_SHIPPING_PRICE', false, () => {
      const pid = 'neg-counter-pid';
      setCachedPriceStats(pid, null, true);
      const card = {
        dataset: { entityId: pid },
        textContent: '',
        querySelector: sel => (sel.includes('.priceContainer.productPrice') ? { textContent: 'CHF 39.00' } : null),
        querySelectorAll: () => []
      };
      const cd = extractCardData(card);
      assert.ok(cd.stats?.unavailable);
      assert.equal(cd.pid && !cd.stats, false);
    });
  });
});
