import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { applySorting } from '../../src/page/sort.js';
import { withConfig } from './helpers.js';

describe('applySorting fallback-tief order', () => {
  let realDocument;

  beforeEach(() => {
    realDocument = globalThis.document;
    globalThis.document = { body: {} };
  });

  afterEach(() => {
    if (realDocument === undefined) delete globalThis.document;
    else globalThis.document = realDocument;
  });

  const makeRow = () => {
    const row = {
      id: 'product-list',
      children: [],
      closest: () => null,
      querySelector: (sel) => {
        if (!sel) return null;
        return row.children.find(c => {
          if (c.matches?.(sel)) return true;
          if (typeof c.classList?.contains === 'function') {
            return sel.split(',').map(s => s.trim().replace(/^\./, '')).some(cls => c.classList.contains(cls));
          }
          return false;
        }) || null;
      },
      classList: { add() {}, remove() {}, contains: () => false },
      style: { setProperty() {} },
      appendChild(el) {
        row.children = row.children.filter(x => x !== el);
        row.children.push(el);
        el.parentElement = row;
      },
      insertBefore(el, ref) {
        row.children = row.children.filter(x => x !== el);
        const idx = ref ? row.children.indexOf(ref) : -1;
        if (idx === -1) row.children.push(el);
        else row.children.splice(idx, 0, el);
        el.parentElement = row;
      },
    };
    return row;
  };

  const makeCard = (row, idx) => {
    const card = {
      dataset: { tpInitialOrder: String(idx) },
      parentElement: row,
      closest: () => null,
      classList: { contains: () => false },
      style: {
        order: '',
        setProperty(k, v) { this[k] = v; },
        removeProperty(k) { delete this[k]; },
      },
    };
    row.children.push(card);
    return card;
  };

  const setup = () => {
    const row = makeRow();
    const cardA = makeCard(row, 0);
    const cardB = makeCard(row, 1);
    const data = [
      // -63%: measurable vortief, thin history → no blend, new-low fallback
      { card: cardA, cardPrice: 74, stats: { tiefstpreis: 100, previousLow: 200, dataPointCount: 3 }, displayDelta: { kind: 'new-low' }, dealScore: null },
      // -23%: same shape, smaller drop
      { card: cardB, cardPrice: 77, stats: { tiefstpreis: 100, previousLow: 100, dataPointCount: 3 }, displayDelta: { kind: 'new-low' }, dealScore: null },
    ];
    return { row, cardA, cardB, data };
  };

  const run = (fixture, includeVortief) =>
    withConfig('BESTPREISE_MODE_ACTIVE', true, () =>
      withConfig('BESTPREISE_INCLUDE_VORTIEF', includeVortief, () =>
        withConfig('SORT_BY_OFFERS', 'none', () =>
          applySorting([fixture.cardA, fixture.cardB], false, fixture.data))));

  it('ranks excluded fallbacks by badge % when filter is off (Dimmen)', () => {
    const f = setup();
    // B starts first in DOM to prove sort (not initial order) decides
    f.row.children = [f.cardB, f.cardA];
    run(f, false);
    assert.equal(f.row.children[0], f.cardA);
    assert.equal(f.cardA.style.order, '-2');
    assert.equal(f.cardB.style.order, '-1');
  });

  it('keeps badge-% order when filter is on (Aus)', () => {
    const f = setup();
    f.row.children = [f.cardB, f.cardA];
    run(f, true);
    assert.equal(f.row.children[0], f.cardA);
  });

  it('keeps site-%-only fallback at 0, above -100 markup cards', () => {
    const row = makeRow();
    const cardA = makeCard(row, 0);
    const cardB = makeCard(row, 1);
    const cardC = makeCard(row, 2);
    const cardD = makeCard(row, 3);
    const data = [
      { card: cardA, cardPrice: 74, stats: { tiefstpreis: 100, previousLow: 200, dataPointCount: 3 }, displayDelta: { kind: 'new-low' }, dealScore: null },
      { card: cardB, cardPrice: 77, stats: { tiefstpreis: 100, previousLow: 100, dataPointCount: 3 }, displayDelta: { kind: 'new-low' }, dealScore: null },
      // No previousLow → vortiefDropPct 0, tied with unchecked
      { card: cardC, cardPrice: 90, stats: { tiefstpreis: 100, dataPointCount: 3 }, displayDelta: { kind: 'at-low' }, dealScore: null },
      // Verified markup sinks at -100
      { card: cardD, cardPrice: 120, stats: { tiefstpreis: 100, dataPointCount: 3 }, displayDelta: { kind: 'above-low', markup: 20 }, dealScore: null },
    ];
    row.children = [cardD, cardC, cardB, cardA];
    withConfig('BESTPREISE_MODE_ACTIVE', true, () =>
      withConfig('BESTPREISE_INCLUDE_VORTIEF', false, () =>
        withConfig('SORT_BY_OFFERS', 'none', () =>
          applySorting([cardA, cardB, cardC, cardD], false, data))));
    assert.deepEqual(row.children, [cardA, cardB, cardC, cardD]);
    assert.equal(cardC.style.order, '-2');
  });

  it('strictly ranks tiers: verified deals > fallback-tiefs > unchecked/unavailable > markups', () => {
    const row = makeRow();
    const cardDeal0 = makeCard(row, 0); // tier 3: verified 0% deal
    const cardFallback0 = makeCard(row, 1); // tier 2: 0% fallback-tief
    const cardUnchecked = makeCard(row, 2); // tier 1: unchecked card
    const cardUnavailable = makeCard(row, 3); // tier 1: unavailable card
    const cardMarkup = makeCard(row, 4); // tier 0: verified markup
    const data = [
      { card: cardDeal0, cardPrice: 100, stats: { tiefstpreis: 100, medianPrice: 100, dataPointCount: 10 }, dealScore: { weightedDiff: 0, dMedian: 0, dRecord: 0 } },
      { card: cardFallback0, cardPrice: 100, stats: { tiefstpreis: 100, dataPointCount: 3 }, displayDelta: { kind: 'at-low' }, dealScore: null },
      { card: cardUnchecked, cardPrice: 100, stats: null, displayDelta: null, dealScore: null },
      { card: cardUnavailable, cardPrice: 100, stats: { unavailable: true }, displayDelta: null, dealScore: null },
      { card: cardMarkup, cardPrice: 150, stats: { tiefstpreis: 100, dataPointCount: 10 }, displayDelta: { kind: 'above-low', markup: 50 }, dealScore: null },
    ];
    // Start shuffled
    row.children = [cardMarkup, cardUnavailable, cardUnchecked, cardFallback0, cardDeal0];
    withConfig('BESTPREISE_MODE_ACTIVE', true, () =>
      withConfig('SORT_BY_OFFERS', 'none', () =>
        applySorting([cardDeal0, cardFallback0, cardUnchecked, cardUnavailable, cardMarkup], false, data)));
    assert.equal(row.children[0], cardDeal0, 'tier 3 verified deal must rank first');
    assert.equal(row.children[1], cardFallback0, 'tier 2 fallback-tief must rank second');
    assert.equal(row.children[2], cardUnchecked, 'tier 1 unchecked must rank ahead of markup');
    assert.equal(row.children[3], cardUnavailable, 'tier 1 unavailable must rank ahead of markup');
    assert.equal(row.children[4], cardMarkup, 'tier 0 markup must rank last');
  });

  it('breaks offer count ties deterministically using initialOrder', () => {
    const row = makeRow();
    const cardA = makeCard(row, 0);
    const cardB = makeCard(row, 1);
    cardA.textContent = '3 Angebote';
    cardB.textContent = '3 Angebote';
    // Start inverted
    row.children = [cardB, cardA];
    withConfig('BESTPREISE_MODE_ACTIVE', false, () =>
      withConfig('SORT_BY_OFFERS', 'desc', () =>
        applySorting([cardA, cardB], true)));
    assert.deepEqual(row.children, [cardA, cardB]);
  });

  it('restores natural order without displacing non-card elements', () => {
    const row = makeRow();
    const notice = { id: 'tp-empty-state-notice', parentElement: row, dataset: {} };
    row.children.push(notice);
    const cardA = makeCard(row, 0);
    const cardB = makeCard(row, 1);
    // Sort to re-order cards
    withConfig('BESTPREISE_MODE_ACTIVE', true, () =>
      withConfig('SORT_BY_OFFERS', 'none', () =>
        applySorting([cardA, cardB], false, [
          { card: cardA, cardPrice: 100, stats: null, displayDelta: null, dealScore: null },
          { card: cardB, cardPrice: 50, stats: { tiefstpreis: 100, previousLow: 100, dataPointCount: 3 }, displayDelta: { kind: 'new-low' }, dealScore: null }
        ])));
    // Restore: when custom sort is disabled
    withConfig('BESTPREISE_MODE_ACTIVE', false, () =>
      withConfig('SORT_BY_OFFERS', 'none', () =>
        applySorting([cardA, cardB], false)));
    assert.equal(row.children[0], notice, 'non-card element should remain in place');
    assert.equal(row.children[1], cardA);
    assert.equal(row.children[2], cardB);
  });

  it('keeps cards strictly ahead of untracked trailing non-card siblings', () => {
    const row1 = makeRow();
    const row2 = makeRow();
    const cardA = makeCard(row1, 0);
    const cardB = makeCard(row2, 1);
    const separator = {
      classList: { contains: cls => cls === 'Plugin_ProductOfferSeparator' },
      parentElement: row1,
      style: { order: '' },
      dataset: {}
    };
    const offer = {
      classList: { contains: cls => cls === 'Plugin_Offer' },
      parentElement: row1,
      style: { order: '' },
      dataset: {}
    };
    row1.children = [cardA, separator, offer];
    row2.children = [cardB];

    const data = [
      { card: cardA, cardPrice: 100, stats: null, displayDelta: null, dealScore: null },
      { card: cardB, cardPrice: 50, stats: { tiefstpreis: 100, dataPointCount: 10 }, displayDelta: { kind: 'new-low' }, dealScore: { weightedDiff: 10, dMedian: 10, dRecord: 10 } }
    ];

    withConfig('BESTPREISE_MODE_ACTIVE', true, () =>
      withConfig('SORT_BY_OFFERS', 'none', () =>
        applySorting([cardA, cardB], false, data)));

    assert.deepEqual(row1.children, [cardB, cardA, separator, offer]);
    assert.equal(cardB.style.order, '-2');
    assert.equal(cardA.style.order, '-1');
    assert.equal(separator.style.order, '');
    assert.equal(offer.style.order, '');
  });
});
