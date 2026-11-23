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
import { triggerDiscordShare } from '../../src/ui/badges/card-share.js';
import { closeSharePreviewModal } from '../../src/ui/modal-share-preview.js';
import { withConfig, createMockNode } from './helpers.js';

describe('Product Detail Page Feature Suite', () => {
  let realDocument;
  let realLocation;

  const mockNode = (tag = 'div') => createMockNode(tag);

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
    assert.ok(subline.textContent.includes('(Ø: 1J)'));
    assert.ok(subline.textContent.includes('📊'));
    assert.equal(subline.querySelectorAll('.tp-subline-pill').length, 2);
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

  it('renderDetailSubline attaches subline to both shipping and product price containers within Plugin_PriceInformation', () => {
    const priceBox = mockNode('div');
    priceBox.className = 'f_priceContainer';
    const priceInfo = mockNode('div');
    priceInfo.className = 'Plugin_PriceInformation price_information_product';

    // Shipping price container (hidden by default on Toppreise)
    const pcShipping = mockNode('div');
    pcShipping.className = 'priceContainer shippingPrice';
    const stShipping = mockNode('div');
    stShipping.className = 'shippingText';
    stShipping.textContent = 'inkl. Versandkosten';
    pcShipping.appendChild(stShipping);

    // Product price container (visible by default on Toppreise)
    const pcProduct = mockNode('div');
    pcProduct.className = 'priceContainer productPrice';
    const stProduct = mockNode('div');
    stProduct.className = 'shippingText';
    stProduct.textContent = 'zzgl. Versandkosten';
    pcProduct.appendChild(stProduct);

    priceInfo.appendChild(pcShipping);
    priceInfo.appendChild(pcProduct);
    priceBox.appendChild(priceInfo);
    document.body.appendChild(priceBox);

    const stats = {
      tiefstpreis: 1000,
      previousLow: 1200,
      medianPrice: 1300,
      horizonDays: 365,
      timeSeries: [[1000, 1200], [2000, 1000]]
    };

    renderDetailSubline(stats, 1000, 'product');

    // Both containers must receive their own subline
    assert.ok(pcShipping.querySelector('.tp-detail-subline'), 'Shipping container has subline');
    assert.ok(pcProduct.querySelector('.tp-detail-subline'), 'Product container has subline (visible below zzgl. Versandkosten)');
  });

  it('renderDetailSparkline signature remains stable even when withLivePrice appends a live point', () => {
    const chartEl = mockNode('div');
    chartEl.className = 'chartProductPrice';
    document.body.appendChild(chartEl);

    const stats = {
      tiefstpreis: 1000,
      medianPrice: 1300,
      time: 123456,
      timeSeries: [[1000, 1200], [2000, 1100]] // Last price is 1100, live is 1000
    };

    // First render creates sparkline and SVG
    renderDetailSparkline('867323', 'Surface Laptop', 1000, stats);
    const spark = document.getElementById('tp-detail-sparkline');
    assert.ok(spark, 'Sparkline created');
    const firstSig = spark.dataset.tpSparkSig;
    const initialSvg = spark.firstElementChild;
    assert.ok(initialSvg, 'Initial SVG rendered');

    // Subsequent call with same stats and price must produce exact same signature and keep same SVG
    renderDetailSparkline('867323', 'Surface Laptop', 1000, stats);
    assert.equal(spark.dataset.tpSparkSig, firstSig, 'Signature must be stable across calls');
    assert.equal(spark.firstElementChild, initialSvg, 'SVG must not be replaced');
  });

  it('renderDetailShareButton updates stored share payload when re-rendered with a new price', () => {
    const bell = mockNode('div');
    bell.className = 'Plugin_NewInfoMailButton';
    document.body.appendChild(bell);

    renderDetailShareButton({
      pid: '1148965',
      currentPrice: 294.90,
      priceBasis: 'shipping',
      stats: { tiefstpreis: 294.90 },
      title: 'MSI Prestige 13 AI',
      url: 'https://www.toppreise.ch/p1148965',
      imageUrl: ''
    });

    const shareBtn = document.getElementById('tp-detail-share-btn');
    assert.equal(shareBtn._tpSharePayload.currentPrice, 294.90);

    renderDetailShareButton({
      pid: '1148965',
      currentPrice: 999.00,
      priceBasis: 'product',
      stats: { tiefstpreis: 999.00 },
      title: 'MSI Prestige 13 AI',
      url: 'https://www.toppreise.ch/p1148965',
      imageUrl: ''
    });

    assert.equal(document.getElementById('tp-detail-share-btn'), shareBtn);
    assert.equal(shareBtn._tpSharePayload.currentPrice, 999.00);
    assert.equal(shareBtn._tpSharePayload.priceBasis, 'product');
  });

  it('renderDetailReviewButton and renderDetailSparkline update stored closures on re-render', () => {
    const heading = mockNode('h1');
    document.body.appendChild(heading);

    renderDetailReviewButton(heading, 'Product A', 100, null, '111');
    const btn = heading.querySelector('.tp-detail-review-btn');
    assert.ok(btn);
    assert.deepEqual(btn._tpReviewPayload, { title: 'Product A', priceText: 'CHF 100.00', pid: '111' });

    renderDetailReviewButton(heading, 'Product B', 200, null, '222');
    assert.deepEqual(btn._tpReviewPayload, { title: 'Product B', priceText: 'CHF 200.00', pid: '222' });

    const chart = mockNode('div');
    chart.className = 'chartProductPrice';
    document.body.appendChild(chart);

    renderDetailSparkline('111', 'Product A', 100, { timeSeries: [[1000, 120], [2000, 100]] });
    const spark = document.getElementById('tp-detail-sparkline');
    assert.equal(spark._tpPid, '111');

    renderDetailSparkline('222', 'Product B', 200, { timeSeries: [[1000, 220], [2000, 200]] });
    assert.equal(spark._tpPid, '222');
  });

  it('records nativeRating telemetry on #tp-root in data-tp-diag during processProductDetailPage', async () => {
    const rootEl = document.createElement('div');
    rootEl.id = 'tp-root';
    document.body.appendChild(rootEl);

    const h1 = mockNode('h1');
    h1.className = 'product-name m-0';
    h1.textContent = 'AirPods Pro';
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

    const ratingWidget = mockNode('div');
    ratingWidget.className = 'Plugin_PriceRating';
    const priceRating = mockNode('div');
    priceRating.className = 'priceRating';
    priceRating.setAttribute('data-rating-level', '2');
    priceRating.setAttribute('aria-label', 'Normaler Preis');
    const label = mockNode('span');
    label.className = 'priceRatingLabel';
    label.textContent = 'Normaler Preis';
    priceRating.appendChild(label);
    ratingWidget.appendChild(priceRating);
    document.body.appendChild(ratingWidget);

    const stats = {
      tiefstpreis: 1000,
      previousLow: 1200,
      medianPrice: 1300,
      horizonDays: 365,
      timeSeries: [[1000, 1200], [2000, 1000]],
      isShippingPrice: false,
      time: Date.now()
    };
    setCachedPriceStats('867323', stats, false, null, false);

    await processProductDetailPage();

    const diagStr = rootEl.getAttribute('data-tp-diag');
    assert.ok(diagStr, 'data-tp-diag should be set');
    const diag = JSON.parse(diagStr);
    assert.equal(diag.pageType, 'detail');
    assert.equal(diag.pid, '867323');
    assert.ok(diag.nativeRating, 'nativeRating should be populated');
    assert.equal(diag.nativeRating.level, 2);
    assert.equal(diag.nativeRating.label, 'Normaler Preis');
  });

  it('renderDetailShareButton re-enables button if triggerDiscordShare returns/rejects without calling onDone', async () => {
    const bell = mockNode('div');
    bell.className = 'Plugin_NewInfoMailButton';
    document.body.appendChild(bell);

    renderDetailShareButton({
      pid: '1148966',
      currentPrice: 199.00,
      priceBasis: 'product',
      stats: { tiefstpreis: 199.00 },
      title: 'Test Product',
      url: 'https://www.toppreise.ch/p1148966',
      imageUrl: ''
    });

    const shareBtn = document.getElementById('tp-detail-share-btn');
    assert.ok(shareBtn);
    const clickHandler = shareBtn._listeners?.click?.[0];
    if (clickHandler) {
      try {
        await clickHandler({ preventDefault() {}, stopPropagation() {} });
      } catch {}
    }
    assert.equal(shareBtn.disabled, false);
    assert.equal(shareBtn.classList.contains('tp-share-loading'), false);
  });

  it('renderDetailSparkline forwards cheapest Amazon dealer and resolved directUrl to popout', () => {
    const chart = mockNode('div');
    chart.className = 'chartProductPrice';
    document.body.appendChild(chart);

    const offer = mockNode('div');
    offer.className = 'Plugin_Offer';
    const logoImg = mockNode('img');
    logoImg.setAttribute('alt', 'Amazon.de');
    const priceSpan = mockNode('span');
    priceSpan.className = 'Plugin_Price';
    priceSpan.textContent = 'CHF 89.00';
    const extLink = mockNode('a');
    extLink.setAttribute('href', '/ext_de?id=999');
    offer.querySelector = sel => {
      if (sel.includes('img[alt]')) return logoImg;
      if (sel.includes('productPrice')) return priceSpan;
      if (sel.includes('/ext_')) return extLink;
      return null;
    };
    document.body.appendChild(offer);

    const stats = {
      timeSeries: [[1000, 120], [2000, 89]]
    };

    withConfig('USE_SHIPPING_PRICE', false, () => {
      renderDetailSparkline('867323', 'Surface Laptop', 89, stats, 'product');
    });

    const spark = document.getElementById('tp-detail-sparkline');
    assert.ok(spark);
    assert.equal(spark._tpDealer, 'Amazon.de');
    assert.equal(spark._tpDirectUrl, 'https://www.toppreise.ch/ext_de?id=999');
  });

  it('triggerDiscordShare on detail page performs zero fetch() calls when .Plugin_Offer is in DOM', async () => {
    const prevFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      return { ok: true, text: async () => '' };
    };

    const offer = mockNode('div');
    offer.className = 'Plugin_Offer';
    const logoImg = mockNode('img');
    logoImg.setAttribute('alt', 'Digitec');
    const priceSpan = mockNode('span');
    priceSpan.className = 'Plugin_Price';
    priceSpan.textContent = 'CHF 199.00';
    const extLink = mockNode('a');
    extLink.setAttribute('href', '/ext_de?id=123');
    offer.querySelector = sel => {
      if (sel.includes('img[alt]')) return logoImg;
      if (sel.includes('productPrice')) return priceSpan;
      if (sel.includes('/ext_')) return extLink;
      return null;
    };
    document.body.appendChild(offer);

    try {
      await withConfig('DISCORD_CHANNELS', [{ id: 'c1', name: 'Deals', url: 'https://discord.com/api/webhooks/123/abc' }], async () => {
        await triggerDiscordShare({
          pid: '867323',
          cardPrice: 199,
          priceBasis: 'product',
          stats: { tiefstpreis: 199, timeSeries: [[1000, 220], [2000, 199]] },
          title: 'Test Product',
          url: 'https://www.toppreise.ch/preisvergleich/Notebooks/Surface-Laptop-p867323',
          imageUrl: '',
          isDetailPage: true
        });
        await new Promise(r => setTimeout(r, 30));
      });
      assert.equal(fetchCount, 0);
    } finally {
      closeSharePreviewModal();
      globalThis.fetch = prevFetch;
    }
  });
});
