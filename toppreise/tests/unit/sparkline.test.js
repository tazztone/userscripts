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

  it('renders SVG polyline with trend color for price drop (green)', () => {
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

    const polyline = svg.children[0];
    assert.ok(polyline);
    assert.equal(polyline.getAttribute('stroke'), '#10b981'); // Green for downward price
    assert.ok(svg.getAttribute('title').includes('120.00'));
    assert.ok(svg.getAttribute('title').includes('99.00'));
  });

  it('renders red stroke when price increases', () => {
    const timeSeries = [
      [1700000000, 80.00],
      [1700100000, 95.00]
    ];
    const svg = renderSparkline(timeSeries, 60, 20);
    assert.ok(svg);
    const polyline = svg.children[0];
    assert.equal(polyline.getAttribute('stroke'), '#ef4444'); // Red for upward price
  });
});

