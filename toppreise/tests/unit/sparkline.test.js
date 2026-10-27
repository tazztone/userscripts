import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderSparkline, renderDiscordChart, openSparklinePopout, closeSparklinePopout } from '../../src/ui/sparkline.js';

const DAY_S = 86400; // seconds, not helpers.js DAY (ms) — do not "fix"

describe('Interactive SVG Sparkline Component', () => {
  beforeEach(() => {
    // Mock document.createElementNS for Node environment
    globalThis.document = {
      body: {
        children: [],
        appendChild(ch) { this.children.push(ch); return ch; }
      },
      createElement(tag) {
        return {
          tagName: tag.toUpperCase(),
          id: '',
          style: {},
          attributes: {},
          children: [],
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            contains(c) { return this.classes.has(c); }
          },
          setAttribute(k, v) { this.attributes[k] = v; },
          getAttribute(k) { return this.attributes[k]; },
          appendChild(ch) { this.children.push(ch); return ch; },
          replaceChildren(...items) { this.children = [...items]; },
          remove() {
            const idx = globalThis.document.body.children.indexOf(this);
            if (idx >= 0) globalThis.document.body.children.splice(idx, 1);
          },
          addEventListener() {},
          removeEventListener() {},
          focus() {}
        };
      },
      createElementNS: (ns, tag) => {
        const el = {
          namespaceURI: ns,
          tagName: tag,
          style: {},
          attributes: {},
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            contains(c) { return this.classes.has(c); }
          },
          children: [],
          setAttribute(k, v) { this.attributes[k] = v; },
          getAttribute(k) { return this.attributes[k]; },
          appendChild(ch) { this.children.push(ch); return ch; },
          insertBefore(ch, ref) {
            const idx = this.children.indexOf(ref);
            if (idx >= 0) this.children.splice(idx, 0, ch);
            else this.children.unshift(ch);
            return ch;
          },
          querySelector(sel) {
            if (sel === 'polyline') return this.children.find(c => c.tagName === 'polyline');
            return null;
          }
        };
        return el;
      },
      getElementById(id) {
        if (id === 'tp-sparkline-popout') return globalThis.document.body.children.find(c => c.id === 'tp-sparkline-popout') || null;
        return null;
      },
      addEventListener() {},
      removeEventListener() {}
    };
  });

  it('renderDiscordChart embeds title text when provided', () => {
    const timeSeries = [
      [1700000000, 100],
      [1700100000, 90]
    ];
    const svgNoTitle = renderDiscordChart(timeSeries, 560, 220);
    assert.ok(svgNoTitle);
    assert.ok(!svgNoTitle.children.some(c => c.tagName === 'text' && c.getAttribute('font-size') === '12'));

    const svgWithTitle = renderDiscordChart(timeSeries, 560, 220, 'Thermaltake View 390');
    assert.ok(svgWithTitle);
    const titleText = svgWithTitle.children.find(c => c.tagName === 'text' && c.getAttribute('font-size') === '12');
    assert.ok(titleText, 'expected title text element in SVG');
    assert.ok(titleText.textContent.includes('Thermaltake View 390'));
  });

  it('openSparklinePopout stacks Keepa section for Amazon deals and includes copy buttons', () => {
    const timeSeries = [
      [1700000000, 100],
      [1700100000, 90]
    ];
    const popout = openSparklinePopout(timeSeries, {
      title: 'Thermaltake View 390',
      pid: '12345',
      dealer: 'Amazon.de',
      directUrl: 'https://www.amazon.de/dp/B0FHWR36F6'
    });
    assert.ok(popout);
    const panel = popout.children[0];
    assert.ok(panel);
    assert.ok(panel.style.cssText.includes('max-height:90vh'));

    // Check header title contains product title
    const header = panel.children[0];
    const titleEl = header.children[0];
    assert.ok(titleEl.textContent.includes('Thermaltake View 390'));

    // Check copy button in header
    const headerActions = header.children[1];
    const copyBtn = headerActions.children.find(c => c.textContent.includes('Bild kopieren'));
    assert.ok(copyBtn, 'expected Toppreise copy button');

    // Check Keepa section was appended
    const keepaSection = panel.children.find(c => c.id === 'tp-keepa-section');
    assert.ok(keepaSection, 'expected #tp-keepa-section for Amazon deal');

    closeSparklinePopout();
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

  it('bare path renders title + polyline + endpoint dot (no grid)', () => {
    const timeSeries = [
      [1700000000, 120.00],
      [1700100000, 110.00],
      [1700200000, 99.00]
    ];
    const svg = renderSparkline(timeSeries, 44, 13);
    assert.equal(svg.children.length, 3);
    assert.equal(svg.children[0].tagName, 'title');
    assert.equal(svg.children[1].tagName, 'polyline');
    assert.equal(svg.children[2].tagName, 'circle');
    assert.ok(!svg.children.some(c => c.tagName === 'line' || c.tagName === 'text'));
    const polyline = svg.children[1];
    const pts = polyline.getAttribute('points').split(' ');
    const [lx, ly] = pts[pts.length - 1].split(',');
    assert.equal(svg.children[2].getAttribute('cx'), lx);
    assert.equal(svg.children[2].getAttribute('cy'), ly);
  });

  it('axes:true draws Y grid + month grid + endpoint dot', () => {
    const start = Date.UTC(2025, 0, 1) / 1000; // Jan 1 2025 (s timestamps)
    const timeSeries = Array.from({ length: 100 }, (_, i) => [start + i * DAY_S, 100 - i * 0.2 + (i % 7)]);
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

  it('axes:true on young series falls back to day labels', () => {
    const start = Date.UTC(2025, 0, 1) / 1000;
    const timeSeries = Array.from({ length: 10 }, (_, i) => [start + i * DAY_S, 50 + i]);
    const svg = renderSparkline(timeSeries, 360, 100, { axes: true });
    assert.ok(svg);
    const lines = svg.children.filter(c => c.tagName === 'line');
    assert.ok(lines.filter(l => l.getAttribute('opacity') === '0.8').length >= 2);
    assert.ok(lines.filter(l => l.getAttribute('opacity') === '0.6').length >= 1);
    const xLabels = svg.children.filter(c => c.tagName === 'text' && !c.textContent.startsWith('CHF'));
    assert.ok(xLabels.length >= 1, `expected day labels like 5.1, got ${JSON.stringify(xLabels.map(t => t.textContent))}`);
    assert.equal(svg.children.filter(c => c.tagName === 'circle').length, 1);
  });

  it('axes:true on few-weeks series falls back to week labels', () => {
    const start = Date.UTC(2025, 0, 6) / 1000; // a Monday
    const timeSeries = Array.from({ length: 21 }, (_, i) => [start + i * DAY_S, 50 + (i % 5)]);
    const svg = renderSparkline(timeSeries, 360, 100, { axes: true });
    assert.ok(svg);
    const lines = svg.children.filter(c => c.tagName === 'line');
    assert.ok(lines.filter(l => l.getAttribute('opacity') === '0.6').length >= 1);
  });
});

