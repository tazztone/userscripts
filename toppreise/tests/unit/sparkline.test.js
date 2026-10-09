import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderSparkline } from '../../src/ui/sparkline.js';

describe('Interactive SVG Sparkline Component', () => {
  beforeEach(() => {
    // Mock document.createElementNS for Node environment
    globalThis.document = {
      createElementNS: (ns, tag) => {
        const el = {
          namespaceURI: ns,
          tagName: tag,
          attributes: {},
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            contains(c) { return this.classes.has(c); }
          },
          children: [],
          setAttribute(k, v) { this.attributes[k] = v; },
          getAttribute(k) { return this.attributes[k]; },
          appendChild(ch) { this.children.push(ch); return ch; }
        };
        return el;
      }
    };
  });

  it('returns null for insufficient data points (< 2)', () => {
    assert.equal(renderSparkline(null), null);
    assert.equal(renderSparkline([]), null);
    assert.equal(renderSparkline([[1700000000, 100]]), null);
  });

  it('renders SVG polyline with single neutral color for price drop', () => {
    const timeSeries = [
      [1700000000, 120.00],
      [1700100000, 110.00],
      [1700200000, 99.00]
    ];
    const svg = renderSparkline(timeSeries, 60, 20);
    assert.ok(svg);
    assert.equal(svg.getAttribute('width'), '60');
    assert.equal(svg.getAttribute('height'), '20');
    assert.ok(svg.classList.contains('tp-sparkline'));

    const titleEl = svg.children[0];
    assert.equal(titleEl.tagName, 'title');
    assert.ok(!svg.getAttribute('title'));
    const polyline = svg.children[1];
    assert.ok(polyline);
    assert.equal(polyline.getAttribute('stroke'), '#3b82f6'); // Single color, no trend coding
    assert.ok(titleEl.textContent.includes('120.00'));
    assert.ok(titleEl.textContent.includes('99.00'));
  });

  it('renders the same single color when price increases', () => {
    const timeSeries = [
      [1700000000, 80.00],
      [1700100000, 95.00]
    ];
    const svg = renderSparkline(timeSeries, 60, 20);
    assert.ok(svg);
    const polyline = svg.children[1];
    assert.equal(polyline.getAttribute('stroke'), '#3b82f6'); // Same color regardless of direction
  });

  it('bare path renders only title + polyline (no grid/dot)', () => {
    const timeSeries = [
      [1700000000, 120.00],
      [1700100000, 110.00],
      [1700200000, 99.00]
    ];
    const svg = renderSparkline(timeSeries, 360, 100);
    assert.equal(svg.children.length, 2);
    assert.equal(svg.children[0].tagName, 'title');
    assert.equal(svg.children[1].tagName, 'polyline');
    assert.ok(!svg.children.some(c => c.tagName === 'line' || c.tagName === 'circle' || c.tagName === 'text'));
  });

  it('axes:true draws Y grid + month grid + endpoint dot', () => {
    const day = 86400;
    const start = Date.UTC(2025, 0, 1) / 1000; // Jan 1 2025 (s timestamps)
    const timeSeries = Array.from({ length: 100 }, (_, i) => [start + i * day, 100 - i * 0.2 + (i % 7)]);
    const svg = renderSparkline(timeSeries, 360, 100, { axes: true });
    assert.ok(svg);
    const lines = svg.children.filter(c => c.tagName === 'line');
    const yLines = lines.filter(l => l.getAttribute('opacity') === '0.8');
    const xLines = lines.filter(l => l.getAttribute('opacity') === '0.6');
    assert.ok(yLines.length >= 2, `expected >=2 Y lines, got ${yLines.length}`);
    assert.ok(xLines.length >= 1, `expected >=1 X month line, got ${xLines.length}`);
    const circles = svg.children.filter(c => c.tagName === 'circle');
    assert.equal(circles.length, 1);
    const polyline = svg.children.find(c => c.tagName === 'polyline');
    assert.equal(circles[0].getAttribute('fill'), polyline.getAttribute('stroke'));
    // Dot sits at last polyline point
    const pts = polyline.getAttribute('points').split(' ');
    const [lx, ly] = pts[pts.length - 1].split(',');
    assert.equal(circles[0].getAttribute('cx'), lx);
    assert.equal(circles[0].getAttribute('cy'), ly);
  });

  it('axes:true on single-month series draws Y grid + dot, no X lines', () => {
    const day = 86400;
    const start = Date.UTC(2025, 0, 1) / 1000;
    const timeSeries = Array.from({ length: 10 }, (_, i) => [start + i * day, 50 + i]);
    const svg = renderSparkline(timeSeries, 360, 100, { axes: true });
    assert.ok(svg);
    const lines = svg.children.filter(c => c.tagName === 'line');
    assert.ok(lines.filter(l => l.getAttribute('opacity') === '0.8').length >= 2);
    assert.equal(lines.filter(l => l.getAttribute('opacity') === '0.6').length, 0);
    assert.equal(svg.children.filter(c => c.tagName === 'circle').length, 1);
  });
});

