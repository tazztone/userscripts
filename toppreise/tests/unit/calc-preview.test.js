import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_DATA_R5, expandRleSeries, previewStats, previewCoords } from '../../src/ui/calc-preview.js';

describe('calc-preview band anchor', () => {
  it('centers the band on the horizon median, not the lifetime median (R5 @ 90T)', () => {
    const now = Date.now();
    const points = expandRleSeries(PRESET_DATA_R5, now);
    assert.ok(points.length > 365, `expected multi-year preset, got ${points.length}`);
    const st = previewStats(points, { band: 0.10, hours: 48, enabled: true, horizonDays: 90, weightRecord: 0.5, minPoints: 1, cardPrice: 1299, now });
    assert.ok(Math.abs(st.median - st.filterMedian) > 1, `medians must diverge for this fixture (median=${st.median}, filterMedian=${st.filterMedian})`);
    const co = previewCoords(st.clean, { median: st.median, refMedian: st.median, band: 0.10, cardPrice: 1299, dropped: st.dropped, recordLow: st.recordLow });
    const center = (co.bandEdges.top + co.bandEdges.bot) / 2;
    assert.ok(Math.abs(center - co.medianY) / co.medianY < 0.05, `band center ${center} must sit on median line ${co.medianY}`);
  });
});
