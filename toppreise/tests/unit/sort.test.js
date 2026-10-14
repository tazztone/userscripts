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
      querySelector: () => null,
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
    assert.equal(f.cardA.style.order, '0');
    assert.equal(f.cardB.style.order, '1');
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
    assert.equal(cardC.style.order, '2');
  });
});
