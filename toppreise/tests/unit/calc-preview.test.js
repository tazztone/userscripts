import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandRleSeries,
  getPreset,
  previewStats,
  previewCoords,
  cropPreviewWindow,
  PRESETS,
} from '../../src/ui/calc-preview.js';

const NOW = 1789142400000; // fixed anchor: deterministic windows
const DEF = { band: 0.60, hours: 48, enabled: true, horizonDays: 365, weightRecord: 0.5, minPoints: 5, now: NOW };

describe('calc-preview', () => {
  it('expands RLE to exact point counts ending at now', () => {
    assert.equal(expandRleSeries(PRESETS.s26.rle, NOW).length, 230);
    assert.equal(expandRleSeries(PRESETS.r5.rle, NOW).length, 2139);
    assert.equal(expandRleSeries(PRESETS.ssd990.rle, NOW).length, 1499);
    assert.equal(expandRleSeries(PRESETS.synthetic.rle, NOW).length, 23);
    const pts = expandRleSeries(PRESETS.s26.rle, NOW);
    assert.equal(pts[pts.length - 1][0], NOW);
    assert.equal(pts[1][0] - pts[0][0], 86400000);
  });

  it('falls back to s26 for unknown preset ids', () => {
    assert.equal(getPreset('nope').id, 's26');
    assert.equal(getPreset('').id, 's26');
  });

  it('pins measured medians and badges at defaults', () => {
    const s26 = previewStats(expandRleSeries(PRESETS.s26.rle, NOW), { ...DEF, cardPrice: 799 });
    assert.equal(s26.median, 935.18);
    assert.equal(s26.badge, 11);
    assert.equal(s26.dropped.length, 0);

    const r5 = previewStats(expandRleSeries(PRESETS.r5.rle, NOW), { ...DEF, cardPrice: 1299 });
    assert.equal(r5.median, 2648);
    assert.equal(r5.badge, 29);

    const ssd = previewStats(expandRleSeries(PRESETS.ssd990.rle, NOW), { ...DEF, cardPrice: 89.95 });
    assert.equal(ssd.median, 242.67);
    assert.equal(ssd.badge, 37);

    const syn = previewStats(expandRleSeries(PRESETS.synthetic.rle, NOW), { ...DEF, cardPrice: 400 });
    assert.equal(syn.median, 423);
    assert.equal(syn.badge, 5);
    assert.equal(syn.dropped.length, 2);
  });

  it('orders medians across horizons (regime shifts, not constants)', () => {
    const r5pts = expandRleSeries(PRESETS.r5.rle, NOW);
    const r5life = previewStats(r5pts, { ...DEF, horizonDays: 0, cardPrice: 1299 });
    assert.equal(r5life.median, 3298);
    assert.ok(r5life.median > 2648);

    const ssdpts = expandRleSeries(PRESETS.ssd990.rle, NOW);
    const ssdlife = previewStats(ssdpts, { ...DEF, horizonDays: 0, cardPrice: 89.95 });
    assert.equal(ssdlife.median, 155.63);
    assert.ok(ssdlife.median < 242.67);
  });

  it('filters fewer glitches with a wider band (r5: 3 at 40%, 0 at 60%)', () => {
    const pts = expandRleSeries(PRESETS.r5.rle, NOW);
    const narrow = previewStats(pts, { ...DEF, band: 0.40, cardPrice: 1299 });
    const wide = previewStats(pts, { ...DEF, band: 0.60, cardPrice: 1299 });
    assert.equal(narrow.dropped.length, 3);
    assert.equal(wide.dropped.length, 0);
  });

  it('disqualifies the synthetic demo when the filter is off (dip becomes the low)', () => {
    const pts = expandRleSeries(PRESETS.synthetic.rle, NOW);
    const on = previewStats(pts, { ...DEF, cardPrice: 400 });
    assert.equal(on.qualifies, true);
    const off = previewStats(pts, { ...DEF, enabled: false, cardPrice: 400 });
    assert.equal(off.qualifies, false);
    assert.equal(off.badge, null);
    assert.equal(off.activeCount, 23);
  });

  it('keeps all coords inside the 296x110 viewBox with a visible anchor', () => {
    const pts = expandRleSeries(PRESETS.synthetic.rle, NOW);
    const st = previewStats(pts, { ...DEF, cardPrice: 400 });
    const co = previewCoords(st.clean, { median: st.median, band: 0.60, cardPrice: 400, dropped: st.dropped });
    assert.ok(co.bandRect !== null);
    assert.ok(co.anchor.x >= 34 && co.anchor.x <= 286);
    assert.ok(co.anchor.y >= 8 && co.anchor.y <= 102);
    assert.equal(co.glitchXY.length, 2);
    for (const g of co.glitchXY) {
      assert.ok(g.x >= 34 && g.x <= 286);
      assert.ok(g.y >= 8 && g.y <= 102);
    }
    assert.equal(co.ticks.length, 3);
  });

  it('omits the band rect when the filter is off', () => {
    const pts = expandRleSeries(PRESETS.synthetic.rle, NOW);
    const st = previewStats(pts, { ...DEF, enabled: false, cardPrice: 400 });
    const co = previewCoords(st.clean, { median: st.median, band: 0, cardPrice: 400, dropped: st.dropped });
    assert.equal(co.bandRect, null);
  });
  it('crops to the window via cropPreviewWindow, full history at null', () => {
    const pts = expandRleSeries(PRESETS.s26.rle, NOW);
    const st = previewStats(pts, { ...DEF, cardPrice: 799 });
    const { visible, visibleDropped } = cropPreviewWindow(st.clean, st.dropped, NOW - 30 * 86400000);
    assert.equal(visible.length, 31);
    assert.ok(visibleDropped.every(g => g.timestamp >= NOW - 30 * 86400000));
    const full = cropPreviewWindow(st.clean, st.dropped, null);
    assert.equal(full.visible.length, st.clean.length);
    assert.equal(full.visibleDropped.length, st.dropped.length);
  });

  it('keeps the y-domain invariant under band changes', () => {
    const pts = expandRleSeries(PRESETS.s26.rle, NOW);
    const st = previewStats(pts, { ...DEF, cardPrice: 799 });
    const a = previewCoords(st.clean, { median: st.median, band: 0.20, cardPrice: 799, dropped: st.dropped });
    const b = previewCoords(st.clean, { median: st.median, band: 0.90, cardPrice: 799, dropped: st.dropped });
    assert.deepEqual(a.ticks, b.ticks);
  });

  it('maps recordLow onto the price scale', () => {
    const pts = expandRleSeries(PRESETS.s26.rle, NOW);
    const st = previewStats(pts, { ...DEF, cardPrice: 799 });
    const withRec = previewCoords(st.clean, { median: st.median, band: 0.60, cardPrice: 799, dropped: st.dropped, recordLow: st.median });
    assert.equal(withRec.recordY, withRec.medianY);
  });

  it('exposes recordLow and cutoffTs additively', () => {
    const pts = expandRleSeries(PRESETS.s26.rle, NOW);
    const st = previewStats(pts, { ...DEF, cardPrice: 799 });
    assert.ok(st.recordLow > 0);
    assert.equal(st.cutoffTs, NOW - 365 * 86400000);
    const life = previewStats(pts, { ...DEF, horizonDays: 0, cardPrice: 799 });
    assert.equal(life.cutoffTs, null);
    const tiny = previewStats(pts, { ...DEF, horizonDays: 1, cardPrice: 799 });
    assert.equal(tiny.medianFallback, true);
    assert.equal(tiny.cutoffTs, null);
  });
  it('keeps the band rect visible when the median sits below the window', () => {
    // median joins the domain (previewCoords pushes o.median into vals), so the
    // rect never collapses; the y2 > y1 guard is defense-in-depth only.
    const pts = expandRleSeries(PRESETS.s26.rle, NOW);
    const st = previewStats(pts, { ...DEF, cardPrice: 799 });
    const co = previewCoords(st.clean, { median: 100, band: 0.20, cardPrice: 799, dropped: st.dropped });
    assert.ok(co.bandRect !== null && co.bandRect.height > 0);
  });
});
