import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_DATA_R5, PRESET_DATA_SYNTHETIC, expandRleSeries, previewStats, previewCoords } from '../../src/ui/calc-preview.js';

describe('calc-preview rolling ribbon', () => {
  it('draws a 2n-vertex corridor tracking local medians that contains the Ø line (R5 @ 90T)', () => {
    const now = Date.now();
    const points = expandRleSeries(PRESET_DATA_R5, now);
    assert.ok(points.length > 365, `expected multi-year preset, got ${points.length}`);
    const st = previewStats(points, { band: 0.10, hours: 48, enabled: true, horizonDays: 90, weightRecord: 0.5, minPoints: 1, cardPrice: 1299, now });
    assert.ok(Math.abs(st.median - st.filterMedian) > 1, `medians must diverge for this fixture (median=${st.median}, filterMedian=${st.filterMedian})`);
    const co = previewCoords(st.clean, { median: st.median, localMedians: st.localMedians, band: 0.10, cardPrice: 1299, dropped: st.dropped, recordLow: st.recordLow });
    assert.ok(co.ribbonAttr, 'expected a ribbon polygon');
    assert.equal(co.ribbonAttr.split(' ').length, 2 * st.clean.length);
    const ys = co.ribbonAttr.split(' ').map(v => parseFloat(v.split(',')[1]));
    const tops = ys.slice(0, st.clean.length);
    const bots = ys.slice(st.clean.length);
    assert.ok(Math.min(...tops) <= co.medianY && co.medianY <= Math.max(...bots), `corridor must contain the Ø line ${co.medianY}`);
    assert.equal(co.ribbonTopAttr + ' ' + co.ribbonBotAttr.split(' ').reverse().join(' '), co.ribbonAttr, 'edge paths must reconstruct the ribbon polygon');
  });
});

describe('calc-preview anchor link', () => {
  it('connects curve end to anchor when demo price differs (synthetic @ 400)', () => {
    const now = Date.now();
    const points = expandRleSeries(PRESET_DATA_SYNTHETIC, now);
    const st = previewStats(points, { band: 0.10, hours: 48, enabled: true, horizonDays: 0, weightRecord: 0.5, minPoints: 1, cardPrice: 400, now });
    const co = previewCoords(st.clean, { median: st.median, localMedians: st.localMedians, band: 0.10, cardPrice: 400, dropped: st.dropped, recordLow: st.recordLow });
    assert.ok(co.anchor, 'expected an anchor point');
    assert.ok(co.anchorLink, 'expected a connector segment');
    assert.ok(Math.abs(co.anchorLink.x1 - co.anchorLink.x2) < 1e-9, 'connector must be vertical');
    assert.ok(Math.abs(co.anchorLink.x1 - (296 - 10)) < 1e-9, `connector must sit at right edge, got ${co.anchorLink.x1}`);
    assert.notEqual(co.anchorLink.y1, co.anchorLink.y2);
  });
  it('omits the connector when anchor matches curve end', () => {
    const now = Date.now();
    const points = expandRleSeries(PRESET_DATA_SYNTHETIC, now);
    const st = previewStats(points, { band: 0.10, hours: 48, enabled: true, horizonDays: 0, weightRecord: 0.5, minPoints: 1, cardPrice: 400, now });
    const lastPrice = st.clean[st.clean.length - 1][1];
    const co = previewCoords(st.clean, { median: st.median, localMedians: st.localMedians, band: 0.10, cardPrice: lastPrice, dropped: st.dropped, recordLow: st.recordLow });
    assert.equal(co.anchorLink, null);
  });
});

describe('calc-preview getPageProductOptions', () => {
  it('extracts canonical PID and share title from catalog cards (F-06)', async () => {
    const { getPageProductOptions } = await import('../../src/ui/calc-preview.js');
    const { setCachedPriceStats } = await import('../../src/scanner/cache.js');
    const prevDoc = globalThis.document;

    const dummyStats = {
      tiefstpreis: 100,
      medianPrice: 120,
      timeSeries: [[Date.now() - 86400000, 120], [Date.now(), 100]]
    };
    setCachedPriceStats('p999', dummyStats, false, null, false);
    setCachedPriceStats('p999', dummyStats, false, null, true);

    const mockCard = {
      dataset: { entityId: 'p999' },
      querySelector: sel => {
        if (sel === 'a[href*="/p/"]') return { getAttribute: () => '/de/p/p999', textContent: 'Canon EOS R5' };
        if (sel.includes('.product-name') || sel.includes('.title')) return { textContent: 'Canon EOS R5' };
        return null;
      },
      querySelectorAll: () => []
    };

    globalThis.document = {
      querySelectorAll: sel => (sel.includes('.Plugin_Product, .mixedBrowsingListProduct') ? [mockCard] : [])
    };

    try {
      const opts = getPageProductOptions();
      assert.equal(opts.length, 1);
      assert.equal(opts[0].pid, 'p999');
      assert.ok(opts[0].label.includes('Canon EOS R5'));
    } finally {
      if (prevDoc) globalThis.document = prevDoc;
      else delete globalThis.document;
    }
  });
});
