import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderDetailReviewButton,
  renderDetailSubline,
  renderDetailShareButton,
  renderDetailSparkline,
  removeDetailDecorations,
  processProductDetailPage
} from '../../src/features/product-detail.js';
import { setCachedPriceStats, clearPriceStatsCache } from '../../src/scanner/cache.js';
import { withConfig } from './helpers.js';

describe('Product Detail Page Feature Suite', () => {
  let realDocument;
  let realLocation;

  const mockNode = (tag = 'div') => {
    let classes = new Set();
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      textContent: '',
      title: '',
      href: '',
      style: {},
      dataset: {},
      children: [],
      parentElement: null,
      isConnected: true,
      get className() {
        return [...classes].join(' ');
      },
      set className(val) {
        classes = new Set(String(val || '').split(/\s+/).filter(Boolean));
      },
      classList: {
        add(...cls) { for (const c of cls) if (c) classes.add(c); },
        remove(...cls) { for (const c of cls) classes.delete(c); },
        contains(c) { return classes.has(c); },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) this.add(c); else this.remove(c);
            return force;
          }
          if (this.contains(c)) { this.remove(c); return false; }
          this.add(c); return true;
        }
      },
      setAttribute(k, v) { el[k] = v; },
      getAttribute(k) { return el[k] ?? null; },
      get firstElementChild() {
        return el.children[0] || null;
      },
      appendChild(child) {
        if (!child) return;
        child.parentElement = el;
        el.children.push(child);
        return child;
      },
      insertBefore(child, ref) {
        if (!child) return;
        child.parentElement = el;
        const idx = el.children.indexOf(ref);
        if (idx >= 0) el.children.splice(idx, 0, child);
        else el.children.push(child);
        return child;
      },
      after(sibling) {
        if (el.parentElement) el.parentElement.insertBefore(sibling, el.nextElementSibling);
      },
      replaceChildren(...nodes) {
        el.children = [];
        for (const n of nodes) el.appendChild(n);
      },
      remove() {
        if (el.parentElement) {
          const idx = el.parentElement.children.indexOf(el);
          if (idx >= 0) el.parentElement.children.splice(idx, 1);
          el.parentElement = null;
        }
      },
      addEventListener: () => {},
      querySelector: sel => {
        const pool = [...el.children];
        for (let i = 0; i < pool.length; i++) pool.push(...pool[i].children);
        const parts = sel.split(',').map(s => s.trim());
        for (const part of parts) {
          const lastPart = part.trim().split(/\s+/).pop();
          if (lastPart.startsWith('#')) {
            const id = lastPart.slice(1);
            const found = pool.find(c => c.id === id) || (el.id === id ? el : null);
            if (found) return found;
          } else if (lastPart.startsWith('.')) {
            const cls = lastPart.slice(1).split(/[\s.:>+]/)[0];
            const found = pool.find(c => c.classList.contains(cls)) || (el.classList.contains(cls) ? el : null);
            if (found) return found;
          } else {
            const tagMatch = lastPart.split(/[\s.:>+]/)[0].toLowerCase();
            const found = pool.find(c => c.tagName.toLowerCase() === tagMatch) || (el.tagName.toLowerCase() === tagMatch ? el : null);
            if (found) return found;
          }
        }
        return null;
      },
      querySelectorAll: sel => {
        const pool = [...el.children];
        for (let i = 0; i < pool.length; i++) pool.push(...pool[i].children);
        const parts = sel.split(',').map(s => s.trim());
        const results = [];
        for (const node of pool) {
          for (const part of parts) {
            const lastPart = part.trim().split(/\s+/).pop();
            if (lastPart.startsWith('.')) {
              const cls = lastPart.slice(1).split(/[\s.:>+[]/)[0];
              if (node.classList.contains(cls) && !results.includes(node)) results.push(node);
            } else if (lastPart.startsWith('#')) {
              const id = lastPart.slice(1);
              if (node.id === id && !results.includes(node)) results.push(node);
            } else {
              const tagMatch = lastPart.split(/[\s.:>+[]/)[0].toLowerCase();
              if (node.tagName.toLowerCase() === tagMatch && !results.includes(node)) results.push(node);
            }
          }
        }
        return results;
      }
    };
    return el;
  };

  let elementsMap = new Map();

  beforeEach(() => {
    realDocument = globalThis.document;
    realLocation = globalThis.location;
    clearPriceStatsCache();
    elementsMap.clear();

    const body = mockNode('body');
    globalThis.document = {
      body,
      createElement: tag => mockNode(tag),
      createElementNS: (ns, tag) => mockNode(tag),
      getElementById: id => elementsMap.get(id) || null,
      querySelector: sel => {
        if (sel.startsWith('#')) return elementsMap.get(sel.slice(1)) || null;
        return body.querySelector(sel);
      },
      querySelectorAll: sel => body.querySelectorAll(sel)
    };

    // Override createElement to register IDs in map
    const origCreate = globalThis.document.createElement;
    globalThis.document.createElement = tag => {
      const node = origCreate(tag);
      let realId = '';
      Object.defineProperty(node, 'id', {
        get: () => realId,
        set: v => {
          if (realId) elementsMap.delete(realId);
          realId = v;
          if (v) elementsMap.set(v, node);
        }
      });
      const origRemove = node.remove;
      node.remove = function() {
        if (realId) elementsMap.delete(realId);
        origRemove.call(this);
      };
      return node;
    };

    globalThis.location = { href: 'https://www.toppreise.ch/preisvergleich/Notebooks/Surface-Laptop-p867323' };
  });

  afterEach(() => {
    if (realDocument === undefined) delete globalThis.document; else globalThis.document = realDocument;
    if (realLocation === undefined) delete globalThis.location; else globalThis.location = realLocation;
  });

  it('renders Web Search button (🌐) next to H1 heading', () => {
    const heading = mockNode('h1');
    heading.textContent = 'MICROSOFT Surface Laptop 8';
    document.body.appendChild(heading);

    renderDetailReviewButton(heading, 'MICROSOFT Surface Laptop 8', 1059.95, null, '867323');
    const btn = heading.querySelector('.tp-review-search-btn');
    assert.ok(btn, 'Review button should exist inside heading');
    assert.equal(btn.textContent, '🌐');
    assert.ok(btn.href.includes('google.com/search'));
    assert.ok(decodeURIComponent(btn.href).includes('Surface Laptop'));
  });

  it('removes Web Search button when REVIEW_SEARCH_ENABLED is false', () => {
    const heading = mockNode('h1');
    document.body.appendChild(heading);
    renderDetailReviewButton(heading, 'Test Product', 100, null, '123');
    assert.ok(heading.querySelector('.tp-review-search-btn'));

    withConfig('REVIEW_SEARCH_ENABLED', false, () => {
      renderDetailReviewButton(heading, 'Test Product', 100, null, '123');
      assert.equal(heading.querySelector('.tp-review-search-btn'), null);
    });
  });

  it('renders deal subline with Vor-Tief and median savings for all-time low', () => {
    const priceBox = mockNode('div');
    priceBox.className = 'priceContainer';
    document.body.appendChild(priceBox);

    const stats = {
      tiefstpreis: 1000,
      previousLow: 1200,
      medianPrice: 1300,
      horizonDays: 365,
      timeSeries: [[1000, 1200], [2000, 1000]]
    };

    renderDetailSubline(stats, 1000, 'product');
    const subline = document.getElementById('tp-detail-subline');
    assert.ok(subline, 'Subline element should exist');
    assert.ok(subline.classList.contains('tp-is-record-low'));
    assert.ok(subline.textContent.includes('Vor-Tief'));
    assert.ok(subline.textContent.includes('Ø (1J)'));
  });

  it('renders deal subline with markup warning when price is above historical low', () => {
    const priceBox = mockNode('div');
    priceBox.className = 'priceContainer';
    document.body.appendChild(priceBox);

    const stats = {
      tiefstpreis: 800,
      previousLow: 800,
      medianPrice: 950,
      medianHorizonDays: 365,
      timeSeries: [[1000, 800], [2000, 1000]]
    };

    renderDetailSubline(stats, 1000, 'product');
    const subline = document.getElementById('tp-detail-subline');
    assert.ok(subline, 'Subline element should exist');
    assert.ok(subline.classList.contains('tp-is-markup'));
    assert.ok(subline.textContent.includes('Tiefstpreis: CHF 800.00'));
    assert.ok(subline.textContent.includes('+25% Aufschlag'));
  });

  it('renders Discord share button (📤) next to price alarm bell', () => {
    const bell = mockNode('div');
    bell.className = 'Plugin_NewInfoMailButton';
    document.body.appendChild(bell);

    renderDetailShareButton({
      pid: '867323',
      currentPrice: 1059.95,
      priceBasis: 'product',
      stats: { tiefstpreis: 1059.95 },
      title: 'Surface Laptop',
      url: 'https://toppreise.ch/p867323',
      imageUrl: ''
    });

    const shareBtn = document.getElementById('tp-detail-share-btn');
    assert.ok(shareBtn, 'Share button should exist');
    assert.equal(shareBtn.textContent, '📤');
    assert.equal(shareBtn.className, 'tp-detail-share-btn');
  });

  it('renders mini sparkline and binds popout modal trigger', () => {
    const chart = mockNode('div');
    chart.className = 'chartProductPrice';
    document.body.appendChild(chart);

    const stats = {
      timeSeries: [[1000, 1200], [2000, 1050], [3000, 1000]]
    };

    renderDetailSparkline('867323', 'Surface Laptop', 1000, stats);
    const spark = document.getElementById('tp-detail-sparkline');
    assert.ok(spark, 'Sparkline container should exist');
    assert.ok(spark.classList.contains('tp-sparkline-container'));
    assert.equal(spark.dataset.tpPopoutBound, 'true');
    assert.equal(chart.dataset.tpChartBound, undefined, 'Native chart click should remain untouched');
  });

  it('renders mini sparkline with all real data points including outliers', () => {
    const chart = mockNode('div');
    chart.className = 'chartProductPrice';
    document.body.appendChild(chart);

    const stats = {
      timeSeries: [[1000, 1200], [3000, 1000]],
      filteredOutliers: [[2000, 500]]
    };

    renderDetailSparkline('867323', 'Surface Laptop', 1000, stats);
    const spark = document.getElementById('tp-detail-sparkline');
    assert.ok(spark);
    assert.equal(spark._tpSeries.length, 3);
    assert.deepEqual(spark._tpSeries.slice(0, 3).map(p => p[1]), [1200, 500, 1000]);
  });

  it('does NOT re-render sparkline SVG on repeated passes with identical data', () => {
    const chart = mockNode('div');
    chart.className = 'chartProductPrice';
    document.body.appendChild(chart);

    const stats = {
      timeSeries: [[1000, 1200], [2000, 1050], [3000, 1000]],
      medianPrice: 1100,
      time: 12345
    };

    // First render creates container and SVG child
    renderDetailSparkline('867323', 'Surface Laptop', 1000, stats);
    const spark = document.getElementById('tp-detail-sparkline');
    assert.ok(spark);
    const initialSvg = spark.firstElementChild;
    assert.ok(initialSvg, 'Initial SVG child must exist');
    const initialSig = spark.dataset.tpSparkSig;
    assert.ok(initialSig, 'tpSparkSig must be recorded on container');

    // Run 10 consecutive identical passes (simulating mutation observer or interval passes)
    for (let i = 0; i < 10; i++) {
      renderDetailSparkline('867323', 'Surface Laptop', 1000, stats);
      assert.equal(spark.firstElementChild, initialSvg, `Pass ${i + 1} must preserve exact SVG node identity without replacement`);
      assert.equal(spark.dataset.tpSparkSig, initialSig);
    }

    // Changing price MUST update signature and replace SVG with updated data
    renderDetailSparkline('867323', 'Surface Laptop', 950, stats);
    assert.notEqual(spark.firstElementChild, initialSvg, 'Price change must trigger an updated SVG render');
    assert.notEqual(spark.dataset.tpSparkSig, initialSig);
  });

  it('cleans up decorations via removeDetailDecorations', () => {
    const subline = mockNode('div');
    subline.id = 'tp-detail-subline';
    document.body.appendChild(subline);

    const shareBtn = mockNode('button');
    shareBtn.id = 'tp-detail-share-btn';
    document.body.appendChild(shareBtn);

    const spark = mockNode('div');
    spark.id = 'tp-detail-sparkline';
    document.body.appendChild(spark);

    removeDetailDecorations();

    assert.equal(document.getElementById('tp-detail-subline'), null);
    assert.equal(document.getElementById('tp-detail-share-btn'), null);
    assert.equal(document.getElementById('tp-detail-sparkline'), null);
  });

  it('decorates both mobile and desktop headings and price blocks', () => {
    // Mobile heading and desktop heading
    const mobileH1 = mockNode('h1');
    mobileH1.className = 'product-name m-0';
    document.body.appendChild(mobileH1);

    const desktopH1 = mockNode('h1');
    desktopH1.className = 'product-name m-0 d-none d-lg-block';
    document.body.appendChild(desktopH1);

    // Mobile price container and desktop price container
    const mobilePriceBox = mockNode('div');
    mobilePriceBox.className = 'f_priceContainerFixIE';
    const mobilePriceInfo = mockNode('div');
    mobilePriceInfo.className = 'Plugin_PriceInformation price_information_product';
    const mobileShipping = mockNode('div');
    mobileShipping.className = 'shippingText';
    mobilePriceInfo.appendChild(mobileShipping);
    const mobileBell = mockNode('div');
    mobileBell.className = 'Plugin_NewInfoMailButton hoverBox';
    const mobileBellLink = mockNode('a');
    mobileBellLink.className = 'f_showNewInfoMailFormDialog';
    mobileBell.appendChild(mobileBellLink);
    mobilePriceBox.appendChild(mobilePriceInfo);
    mobilePriceBox.appendChild(mobileBell);
    document.body.appendChild(mobilePriceBox);

    const desktopPriceBox = mockNode('div');
    desktopPriceBox.className = 'row f_priceContainer';
    const desktopPriceInfo = mockNode('div');
    desktopPriceInfo.className = 'Plugin_PriceInformation price_information_product';
    const desktopShipping = mockNode('div');
    desktopShipping.className = 'shippingText';
    desktopPriceInfo.appendChild(desktopShipping);
    const desktopBell = mockNode('div');
    desktopBell.className = 'Plugin_NewInfoMailButton hoverBox';
    const desktopBellLink = mockNode('a');
    desktopBellLink.className = 'f_showNewInfoMailFormDialog';
    desktopBell.appendChild(desktopBellLink);
    desktopPriceBox.appendChild(desktopPriceInfo);
    desktopPriceBox.appendChild(desktopBell);
    document.body.appendChild(desktopPriceBox);

    const stats = {
      tiefstpreis: 1000,
      previousLow: 1200,
      medianPrice: 1300,
      horizonDays: 365,
      timeSeries: [[1000, 1200], [2000, 1000]]
    };

    // Review buttons and deal badges in both headings
    renderDetailReviewButton(mobileH1, 'Surface Laptop', 1000, stats, '867323');
    renderDetailReviewButton(desktopH1, 'Surface Laptop', 1000, stats, '867323');
    assert.ok(mobileH1.querySelector('.tp-review-search-btn'), 'Mobile H1 has review button');
    assert.ok(desktopH1.querySelector('.tp-review-search-btn'), 'Desktop H1 has review button');

    // Sublines in both price blocks
    renderDetailSubline(stats, 1000, 'product');
    assert.ok(mobilePriceInfo.querySelector('.tp-detail-subline'), 'Mobile price block has subline');
    assert.ok(desktopPriceInfo.querySelector('.tp-detail-subline'), 'Desktop price block has subline');

    // Share buttons in both bell blocks
    renderDetailShareButton({
      pid: '867323',
      currentPrice: 1000,
      priceBasis: 'product',
      stats,
      title: 'Surface Laptop',
      url: 'https://toppreise.ch/p867323',
      imageUrl: ''
    });
    assert.ok(mobileBell.querySelector('.tp-detail-share-btn'), 'Mobile bell has share button');
    assert.ok(desktopBell.querySelector('.tp-detail-share-btn'), 'Desktop bell has share button');
  });

  it('processProductDetailPage preserves sparkline DOM identity and popout handler across repeated calls', async () => {
    const h1 = mockNode('h1');
    h1.className = 'product-name m-0';
    h1.textContent = 'Surface Laptop';
    document.body.appendChild(h1);

    const priceBox = mockNode('div');
    priceBox.className = 'f_priceContainer';
    const priceInfo = mockNode('div');
    priceInfo.className = 'Plugin_PriceInformation price_information_product';
    const priceEl = mockNode('div');
    priceEl.className = 'Plugin_Price';
    priceEl.textContent = '1000';
    priceInfo.appendChild(priceEl);
    priceBox.appendChild(priceInfo);
    document.body.appendChild(priceBox);

    const stats = {
      tiefstpreis: 1000,
      previousLow: 1200,
      medianPrice: 1300,
      horizonDays: 365,
      timeSeries: [[1000, 1200], [2000, 1000]],
      isShippingPrice: true,
      time: Date.now()
    };
    setCachedPriceStats('867323', stats, false, null, true);

    await processProductDetailPage();

    const spark = document.getElementById('tp-detail-sparkline');
    assert.ok(spark, 'Sparkline element should be created');
    const initialSvg = spark.firstElementChild;
    assert.ok(initialSvg, 'Initial SVG child must exist');

    for (let i = 0; i < 5; i++) {
      await processProductDetailPage();
      assert.equal(spark.firstElementChild, initialSvg, `Pass ${i + 1} must not replace SVG child`);
    }
  });
});
