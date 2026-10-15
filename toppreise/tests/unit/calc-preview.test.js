import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_DATA_R5, expandRleSeries, previewStats, previewCoords } from '../../src/ui/calc-preview.js';

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
