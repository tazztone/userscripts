import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setTextIfChanged, setHtmlIfChanged, renderEmptyState } from '../../src/ui/badges.js';
import { renderShareButton } from '../../src/ui/badges/card-share.js';
describe('Badges helpers', () => {
  describe('setHtmlIfChanged', () => {
    it('sets html when different', () => {
      const el = { innerHTML: 'old' };
      setHtmlIfChanged(el, '<span>new</span>');
      assert.equal(el.innerHTML, '<span>new</span>');
      assert.equal(el._tpLastHtml, '<span>new</span>');
    });

    it('skips innerHTML read and write when cached html is identical', () => {
      let reads = 0;
      let writes = 0;
      const el = { _tpLastHtml: '<span>same</span>' };
      Object.defineProperty(el, 'innerHTML', {
        get: () => { reads++; return '<span>same</span>'; },
        set: () => { writes++; },
        configurable: true
      });
      setHtmlIfChanged(el, '<span>same</span>');
      assert.equal(reads, 0);
      assert.equal(writes, 0);
    });

    it('ignores null element', () => {
      assert.equal(setHtmlIfChanged(null, '<span>x</span>'), undefined);
    });
  });

  describe('setTextIfChanged', () => {
    it('sets text when different', () => {
      const el = { textContent: 'old' };
      setTextIfChanged(el, 'new');
      assert.equal(el.textContent, 'new');
    });

    it('skips the write when text is identical', () => {
      let writes = 0;
      const el = {};
      Object.defineProperty(el, 'textContent', {
        get: () => 'same',
        set: () => { writes++; },
        configurable: true
      });
      setTextIfChanged(el, 'same');
      assert.equal(writes, 0);
    });

    it('ignores null element', () => {
      assert.equal(setTextIfChanged(null, 'x'), undefined);
    });
  });
});

describe('renderEmptyState signature skip', () => {
  let realDocument;

  const fakeDoc = (notice, created) => {
    globalThis.document = {
      getElementById: id => (id === 'tp-empty-state-notice' ? notice : null),
      createElement: () => {
        const el = { dataset: {}, querySelector: () => null };
        created.push(el);
        return el;
      },
      body: { classList: { contains: () => false } }
    };
  };

  // Two cards, both hidden → sig '2:2:0:30'.
  const setup = () => ({
    cards: [{ parentElement: { insertBefore: () => {} } }, {}],
    counts: { bestpreiseDeals: 0, filteredCount: 2, uncheckedHidden: 0, uncheckedDeals: 0 }
  });

  beforeEach(() => {
    realDocument = globalThis.document;
  });

  afterEach(() => {
    if (realDocument === undefined) delete globalThis.document; else globalThis.document = realDocument;
  });

  it('skips rebuild when signature matches', () => {
    const { cards, counts } = setup();
    const notice = { dataset: { tpEmptySig: '2:2:0:30:false:dim:0' } };
    const created = [];
    fakeDoc(notice, created);
    renderEmptyState(cards, counts);
    assert.equal(created.length, 0);
    assert.equal(notice.dataset.tpEmptySig, '2:2:0:30:false:dim:0');
  });

  it('builds notice and stamps signature on first render', () => {
    const { cards, counts } = setup();
    const created = [];
    fakeDoc(null, created);
    renderEmptyState(cards, counts);
    assert.equal(created.length, 1);
    assert.equal(created[0].dataset.tpEmptySig, '2:2:0:30:false:dim:0');
  });

  it('builds notice whenever all cards are removed (no display-mode gate)', () => {
    const { cards, counts } = setup();
    const created = [];
    fakeDoc(null, created);
    renderEmptyState(cards, counts);
    assert.equal(created.length, 1);
    assert.equal(created[0].dataset.tpEmptySig, '2:2:0:30:false:dim:0');
  });
});

describe('renderCardEffects median line + sparkline signature', () => {
  let realDocument;

  const mockEl = (tag = 'div') => {
    let _text = '';
    const el = {
      tagName: tag.toUpperCase(),
      children: [],
      dataset: {},
      attributes: {},
      className: '',
      get textContent() {
        if (el.children.length > 0) return el.children.map(c => c.textContent).join(' ');
        return _text;
      },
      set textContent(val) {
        _text = String(val ?? '');
      },
      get innerHTML() {
        return el.children.map(c => `<${c.tagName.toLowerCase()}${c.className ? ` class="${c.className}"` : ''}>${c.textContent}</${c.tagName.toLowerCase()}>`).join('');
      },
      set innerHTML(html) {
        el.children = [];
        const matches = [...String(html).matchAll(/<([a-z0-9]+)(?: class="([^"]*)")?>([^<]*)<\/\1>/gi)];
        for (const m of matches) {
          const child = mockEl(m[1]);
          if (m[2]) child.className = m[2];
          child.textContent = m[3];
          child.parentElement = el;
          el.children.push(child);
        }
        _text = el.children.length > 0 ? el.children.map(c => c.textContent).join(' ') : String(html).replace(/<[^>]+>/g, '');
      },
      title: '',
      parentElement: null,
      style: { position: '', setProperty() {}, removeProperty() {} },
      classList: {
        add: (...cs) => { el.className += ' ' + cs.join(' '); },
        remove: () => {},
        toggle: () => {},
        contains: () => false,
      },
      setAttribute(k, v) { el.attributes[k] = v; },
      getAttribute(k) { return el.attributes[k] ?? null; },
      addEventListener() {},
      appendChild(ch) { ch.parentElement = el; el.children.push(ch); return ch; },
      insertBefore(ch) { ch.parentElement = el; el.children.unshift(ch); return ch; },
      replaceChildren(...chs) { el.children = []; for (const ch of chs) el.appendChild(ch); },
      remove() { if (el.parentElement) el.parentElement.children = el.parentElement.children.filter(c => c !== el); },
      closest: () => null,
      contains: () => false,
      querySelectorAll: () => [],
      querySelector(sel) {
        const toks = String(sel).split(',').map(s => s.trim()).filter(s => s.startsWith('.') || s.startsWith(':scope') || s.startsWith('['));
        const pool = [];
        const walk = n => { for (const c of n.children) { pool.push(c); walk(c); } };
        walk(el);
        for (const t of toks) {
          const m = t.match(/\.([A-Za-z0-9_-]+)/);
          if (!m) continue;
          const hit = pool.find(c => ` ${c.className} `.includes(` ${m[1]} `) || ` ${c.className} `.includes(` ${m[1].replace(/\]$/, '')} `));
          if (hit) return hit;
          const sub = pool.find(c => (c.className || '').includes(m[1]));
          if (sub) return sub;
        }
        return null;
      },
    };
    return el;
  };

  const mockCard = () => {
    const card = mockEl('div');
    card.textContent = 'Test Product CHF 1’000.00';
    return card;
  };

  const T0 = 1_700_000_000_000;
  const stats = medianPrice => ({
    tiefstpreis: 900,
    hoechstpreis: 1500,
    previousLow: 1100,
    medianPrice,
    realDiscountVsPrevLow: 0,
    timeSeries: [[T0 - 86400000, 1100], [T0, 1000]],
  });

  const cd = medianPrice => ({
    card: mockCard(),
    pid: '123',
    cardPriceEl: mockEl('span'),
    cardPrice: 900,
    stats: stats(medianPrice),
    diffVal: 0,
    dealScore: false,
  });

  beforeEach(() => {
    realDocument = globalThis.document;
    globalThis.document = {
      createElement: tag => mockEl(tag),
      createElementNS: (ns, tag) => mockEl(tag),
      getElementById: () => null,
      body: { classList: { contains: () => false } },
    };
    globalThis.getComputedStyle = () => ({ position: 'static' });
  });

  afterEach(() => {
    if (realDocument === undefined) delete globalThis.document; else globalThis.document = realDocument;
    delete globalThis.getComputedStyle;
  });

  it('renders the Ø subline on feed cards when the median beats the price', async () => {
    const { renderCardEffects } = await import('../../src/ui/badges.js');
    const c = cd(1200);
    renderCardEffects(c, {}, true, []);
    const hist = c.card.querySelector('.tp-card-historical-price');
    assert.ok(hist);
    assert.ok(hist.textContent.includes('Ø'));
    assert.ok(hist.textContent.includes('1200.00'));
  });

  it('re-renders the sparkline SVG when the series/price/median signature changes', async () => {
    const { renderCardEffects } = await import('../../src/ui/badges.js');
    const c = cd(1200);
    renderCardEffects(c, {}, true, []);
    const box = c.card.querySelector('.tp-sparkline-container');
    assert.ok(box);
    const first = box.children[0];
    assert.ok(first);
    renderCardEffects({ ...c, stats: stats(1200) }, {}, true, []);
    assert.equal(box.children[0], first);
    renderCardEffects({ ...c, stats: stats(1100) }, {}, true, []);
    assert.notEqual(box.children[0], first);
  });

  it('rebuilds on refreshed series with identical length/price/median (revision-aware sig)', async () => {
    const { renderCardEffects } = await import('../../src/ui/badges.js');
    const c = cd(1200);
    renderCardEffects(c, {}, true, []);
    const box = c.card.querySelector('.tp-sparkline-container');
    const first = box.children[0];
    // Same shape, one fresh point: length/price/median equal, lastTs newer.
    const refreshed = { ...c.stats, timeSeries: [[1700000000000 - 86400000, 1100], [1700000000000 + 3600000, 1000]] };
    renderCardEffects({ ...c, stats: refreshed }, {}, true, []);
    assert.notEqual(box.children[0], first);
  });
});

describe('Verdict badges F-03 & F-04', () => {
  it('isScanningPid recognizes both batch and single scanning PIDs (F-03)', async () => {
    const { scanState, isScanningPid } = await import('../../src/state/store.js');
    scanState.currentlyScanningPid = null;
    scanState.singleScanningPids.clear();

    assert.equal(isScanningPid('p1'), false);
    scanState.currentlyScanningPid = 'p1';
    assert.equal(isScanningPid('p1'), true);
    assert.equal(isScanningPid('p2'), false);

    scanState.currentlyScanningPid = null;
    scanState.singleScanningPids.add('p2');
    assert.equal(isScanningPid('p1'), false);
    assert.equal(isScanningPid('p2'), true);
    scanState.singleScanningPids.clear();

    scanState.batchScanningPids.add('p3');
    assert.equal(isScanningPid('p3'), true);
    scanState.batchScanningPids.clear();
    assert.equal(isScanningPid('p3'), false);
  });

  it('renderModeVerdict adds .tp-deal-alltime-low to fallback lows (F-04)', async () => {
    const { renderModeVerdict } = await import('../../src/ui/badges/deal-verdict.js');
    const badgeEl = {
      classList: new Set(),
      className: '',
      title: '',
      textContent: ''
    };
    badgeEl.classList.add = function (...cls) { cls.forEach(c => this.classList.add(c)); };
    badgeEl.classList.remove = function (...cls) { cls.forEach(c => this.classList.delete(c)); };
    badgeEl.classList.contains = function (c) { return this.classList.has(c); };

    const classes = new Set();
    const mockBadge = {
      classList: {
        add: (...cls) => cls.forEach(c => classes.add(c)),
        remove: (...cls) => cls.forEach(c => classes.delete(c)),
        contains: c => classes.has(c)
      },
      setAttribute: () => {},
      removeAttribute: () => {}
    };

    const ctx = {
      card: { classList: { remove: () => {} }, querySelector: () => null },
      pid: 'pFallback',
      cardPrice: 100,
      cardPriceEl: null,
      stats: { tiefstpreis: 100, medianPrice: 0 },
      dealData: null,
      displayDelta: null,
      heatInfo: { pct: 0 }
    };

    renderModeVerdict(ctx, {}, mockBadge, false, '', null);
    assert.ok(classes.has('tp-deal-alltime-low'), 'Fallback low in mode verdict must have .tp-deal-alltime-low');
  });

  it('renderDealerName and applyFreshGlow suppress chrome on negative cache markers', async () => {
    const { renderDealerName, applyFreshGlow } = await import('../../src/ui/badges/card-chrome.js');
    const { scanState } = await import('../../src/state/store.js');

    let removed = false;
    const dealerEl = { remove: () => { removed = true; } };
    const card = {
      querySelector: sel => (sel === '.tp-card-dealer-row .tp-dealer-name' || sel === '.tp-dealer-name' ? dealerEl : (sel.includes('tp-deal-new-record') ? {} : null)),
      classList: { toggle: (cls, on) => { if (cls === 'tp-deal-fresh') freshToggled = on; } }
    };
    let freshToggled = null;
    scanState.freshPids.add('neg-pid');

    const ctx = {
      card,
      pid: 'neg-pid',
      stats: { unavailable: true, time: Date.now() },
      cardPrice: 50,
      cardPriceEl: null
    };

    renderDealerName(ctx, {});
    assert.equal(removed, true, 'dealerEl must be removed for unavailable stats');

    applyFreshGlow(ctx);
    assert.equal(freshToggled, false, 'fresh deal glow must not apply for unavailable stats');
    scanState.freshPids.clear();
  });

  it('applyFreshGlow keeps the glow for a verified record pid in the fresh set', async () => {
    const { applyFreshGlow } = await import('../../src/ui/badges/card-chrome.js');
    const { scanState } = await import('../../src/state/store.js');

    let freshToggled = null;
    const card = {
      querySelector: sel => (sel.includes('tp-deal-new-record') ? {} : null),
      classList: { toggle: (cls, on) => { if (cls === 'tp-deal-fresh') freshToggled = on; } }
    };
    scanState.freshPids.add('fresh-pid');

    try {
      applyFreshGlow({
        card,
        pid: 'fresh-pid',
        stats: { tiefstpreis: 100, medianPrice: 120 },
        cardPrice: 100,
        cardPriceEl: null
      });
      assert.equal(freshToggled, true, 'verified record pid must keep the fresh glow');
    } finally {
      scanState.freshPids.delete('fresh-pid');
    }
  });

  it('renderBadgeSetup returns null early when pid is null', async () => {
    const { renderBadgeSetup } = await import('../../src/ui/badges/deal-badge.js');
    const card = { querySelector: () => null };
    const res = renderBadgeSetup({ card, pid: null }, false);
    assert.equal(res, null);
  });

  it('ensureDealerInfo returns cached dealer immediately', async () => {
    const { ensureDealerInfo } = await import('../../src/ui/badges/card-chrome.js');
    const { dealerCache } = await import('../../src/ui/badges/deal-badge.js');
    dealerCache.set('pid-test-dealer:p', { dealer: 'Amazon.de', url: 'https://www.amazon.de/dp/B012345678' });

    const card = { querySelector: () => null };
    const res = await ensureDealerInfo(card, 'pid-test-dealer', false);
    assert.ok(res);
    assert.equal(res.dealer, 'Amazon.de');
    assert.equal(res.url, 'https://www.amazon.de/dp/B012345678');
  });

  it('ensureDealerInfo fetches dealer when un-cached', async () => {
    const { ensureDealerInfo } = await import('../../src/ui/badges/card-chrome.js');
    const prevFetch = globalThis.fetch;
    const prevParser = globalThis.DOMParser;
    const prevDoc = globalThis.document;
    try {
      globalThis.document = {
        querySelectorAll: () => [],
        querySelector: () => null,
        body: {
          getAttribute: () => null,
          classList: { contains: () => false }
        }
      };
      globalThis.fetch = async () => ({
        ok: true,
        text: async () => '<html></html>'
      });
      globalThis.DOMParser = class {
        parseFromString() {
          return {
            querySelectorAll(sel) {
              if (sel === 'script[type="application/ld+json"]') {
                return [{
                  textContent: JSON.stringify({
                    '@type': 'Product',
                    offers: [{
                      '@type': 'Offer',
                      price: 150,
                      seller: { name: 'Amazon.de' }
                    }]
                  })
                }];
              }
              return [];
            }
          };
        }
      };
      const card = {
        querySelector: sel => {
          if (sel === 'a[href*="/preisvergleich/"]') return { getAttribute: () => 'https://www.toppreise.ch/preisvergleich/Prod-p999', href: 'https://www.toppreise.ch/preisvergleich/Prod-p999' };
          return null;
        }
      };
      const res = await ensureDealerInfo(card, 'p999', false);
      assert.ok(res);
      assert.equal(res.dealer, 'Amazon.de');
      await new Promise(r => setTimeout(r, 60));
    } finally {
      globalThis.fetch = prevFetch;
      if (prevParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = prevParser;
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });

  it('renderHeat respects HEATMAP_ENABLED: true, verified-only, and false', async () => {
    const { renderHeat } = await import('../../src/ui/badges/deal-badge.js');
    const { CONFIG } = await import('../../src/state/config.js');
    const prevHeat = CONFIG.HEATMAP_ENABLED;

    const createMockCard = () => {
      const card = {
        dataset: {},
        className: '',
        style: {
          properties: {},
          setProperty(k, v) { card.style.properties[k] = v; },
          removeProperty(k) { delete card.style.properties[k]; }
        },
        classList: {
          add(c) { if (!card.classList.contains(c)) card.className += ' ' + c; },
          remove(c) { card.className = card.className.split(' ').filter(x => x !== c).join(' '); },
          toggle(c, f) { if (f) card.classList.add(c); else card.classList.remove(c); },
          contains(c) { return card.className.split(' ').includes(c); }
        },
        querySelector: () => null
      };
      return card;
    };

    try {
      const verifiedStats = { tiefstpreis: 100, medianPrice: 150 };
      const blendCtx = {
        card: createMockCard(),
        pid: '1',
        stats: verifiedStats,
        heatInfo: { pct: 33, kind: 'blend' },
        effectiveDiff: -33,
        dealData: { weightedDiff: 33 }
      };
      const fallbackCtx = {
        card: createMockCard(),
        pid: '2',
        stats: verifiedStats,
        heatInfo: { pct: 20, kind: 'vortief' },
        effectiveDiff: -20,
        dealData: null
      };
      const unverifiedCtx = {
        card: createMockCard(),
        pid: '3',
        stats: null,
        heatInfo: { pct: 15, kind: 'unverified' },
        effectiveDiff: -15,
        dealData: null
      };

      // 1. CONFIG.HEATMAP_ENABLED = true: all 3 heat
      CONFIG.HEATMAP_ENABLED = true;
      renderHeat(blendCtx);
      renderHeat(fallbackCtx);
      renderHeat(unverifiedCtx);
      assert.equal(blendCtx.card.classList.contains('tp-heat-blend'), true);
      assert.equal(fallbackCtx.card.classList.contains('tp-heat-blend'), true);
      assert.equal(unverifiedCtx.card.classList.contains('tp-heat-blend'), true);

      // 2. CONFIG.HEATMAP_ENABLED = 'verified': only verified blend heats
      CONFIG.HEATMAP_ENABLED = 'verified';
      renderHeat(blendCtx);
      renderHeat(fallbackCtx);
      renderHeat(unverifiedCtx);
      assert.equal(blendCtx.card.classList.contains('tp-heat-blend'), true);
      assert.equal(fallbackCtx.card.classList.contains('tp-heat-blend'), false);
      assert.equal(unverifiedCtx.card.classList.contains('tp-heat-blend'), false);

      // 3. CONFIG.HEATMAP_ENABLED = false: none heat
      CONFIG.HEATMAP_ENABLED = false;
      renderHeat(blendCtx);
      renderHeat(fallbackCtx);
      renderHeat(unverifiedCtx);
      assert.equal(blendCtx.card.classList.contains('tp-heat-blend'), false);
      assert.equal(fallbackCtx.card.classList.contains('tp-heat-blend'), false);
      assert.equal(unverifiedCtx.card.classList.contains('tp-heat-blend'), false);
    } finally {
      CONFIG.HEATMAP_ENABLED = prevHeat;
    }
  });
});

describe('renderShareButton UX and positioning', () => {
  it('renders share button without mutating card.style.position inline', () => {
    const card = {
      style: {},
      children: [],
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        toggle(c, v) { if (v) this.classes.add(c); else this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      querySelector(sel) {
        if (sel === ':scope > .tp-share-btn') return this.children.find(c => c.className === 'tp-share-btn') || null;
        return null;
      },
      appendChild(ch) { this.children.push(ch); return ch; }
    };

    const origDoc = globalThis.document;
    globalThis.document = {
      createElement(tag) {
        return {
          tagName: tag.toUpperCase(),
          className: '',
          style: {},
          title: '',
          type: '',
          textContent: '',
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            toggle(c, v) { if (v) this.classes.add(c); else this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
          },
          addEventListener() {},
          removeEventListener() {},
          remove() {}
        };
      }
    };

    try {
      const ctx = {
        card,
        pid: '999',
        cardPrice: 49.90,
        dealData: { kind: 'new-low' },
        stats: { tiefstpreis: 59.90 }
      };
      renderShareButton(ctx, { basisMatches: true, cardPriceBasis: 'shipping' });

      const shareBtn = card.querySelector(':scope > .tp-share-btn');
      assert.ok(shareBtn);
      assert.equal(shareBtn.className, 'tp-share-btn');
      // style.position should NOT be set inline (handled by CSS :has())
      assert.equal(card.style.position, undefined);
    } finally {
      globalThis.document = origDoc;
    }
  });
});

describe('dom-helpers setHtmlIfChanged / setTextIfChanged', () => {
  it('restores identical HTML after setTextIfChanged overwrote textContent', async () => {
    const { setHtmlIfChanged, setTextIfChanged } = await import('../../src/ui/badges/dom-helpers.js');
    const badgeEl = { innerHTML: '', textContent: '' };
    const verdictHtml = '<span>🏆</span><p>-20%</p>';

    setHtmlIfChanged(badgeEl, verdictHtml);
    assert.equal(badgeEl.innerHTML, verdictHtml);

    setTextIfChanged(badgeEl, '⏳ Prüfe...');
    assert.equal(badgeEl.textContent, '⏳ Prüfe...');
    assert.equal(badgeEl._tpLastHtml, undefined);

    // Even if textContent happened to match newText, hadHtml forces update & clears cache
    setHtmlIfChanged(badgeEl, verdictHtml);
    assert.equal(badgeEl.innerHTML, verdictHtml);
    assert.equal(badgeEl._tpLastHtml, verdictHtml);
  });

  it('getLayoutPresets returns DEFAULT_LAYOUT in ESM without ReferenceError', async () => {
    const { getLayoutPresets } = await import('../../src/ui/modal-bindings.js');
    const { DEFAULT_LAYOUT } = await import('../../src/features/discord-recipe.js');
    const presets = getLayoutPresets();
    assert.equal(presets.kompakt, DEFAULT_LAYOUT);
    assert.ok(typeof presets.ausfuehrlich === 'string');
    assert.ok(typeof presets.minimal === 'string');
  });

  it('card-dealer replaces <a> with <span> when hasUrl transitions true -> false', async () => {
    const { renderDealerName } = await import('../../src/ui/badges/card-dealer.js');
    const { dealerCache } = await import('../../src/ui/badges/deal-badge.js');
    dealerCache.set('p-dealer-url:p', { dealer: 'Digitec', url: '' });
    dealerCache.set('p-dealer-url:s', { dealer: 'Digitec', url: '' });
    const linkEl = { tagName: 'A', className: 'tp-dealer-name', dataset: { tpDealerPid: 'p-dealer-url:p' }, getAttribute: () => 'https://example.com', href: 'https://example.com', textContent: '', title: '', remove: () => {} };
    const dealerRow = {
      className: 'tp-card-dealer-row',
      replaceChildren: (n) => { dealerRow._replaced = n; },
    };
    const card = {
      querySelector: (sel) => {
        if (sel === '.tp-card-dealer-row .tp-dealer-name') return linkEl;
        if (sel === '.tp-card-dealer-row') return dealerRow;
        return null;
      },
      querySelectorAll: () => [],
      appendChild: () => {},
    };
    const prevDoc = globalThis.document;
    globalThis.document = {
      createElement: (tag) => ({ tagName: tag.toUpperCase(), className: '', textContent: '', title: '', style: {}, dataset: {}, addEventListener: () => {}, replaceChildren: () => {} }),
    };
    try {
      renderDealerName({ card, pid: 'p-dealer-url', cardPriceEl: null, stats: { tiefstpreis: 100 } }, {});
      assert.ok(dealerRow._replaced);
      assert.equal(dealerRow._replaced.tagName, 'SPAN');
    } finally {
      dealerCache.delete('p-dealer-url:p');
      dealerCache.delete('p-dealer-url:s');
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });

  it('card-dealer removes stale .tp-action-dealer across list, box, and expert layouts', async () => {
    const { renderDealerName } = await import('../../src/ui/badges/card-dealer.js');
    const { dealerCache } = await import('../../src/ui/badges/deal-badge.js');
    dealerCache.set('p-box:p', { dealer: 'Digitec', url: 'https://example.com' });
    const prevDoc = globalThis.document;
    globalThis.document = {
      createElement: (tag) => ({
        tagName: tag.toUpperCase(), className: '', textContent: '', title: '',
        style: {}, dataset: {}, addEventListener: () => {}, replaceChildren: () => {},
      }),
    };
    try {
      for (const layoutCls of ['mixedBrowsingList', 'mixedBrowsingBox', 'mixedBrowsingExpert']) {
        let removed = false;
        const staleActionEl = { remove: () => { removed = true; } };
        const card = {
          classList: { contains: (cls) => cls === layoutCls },
          closest: () => null,
          querySelector: (sel) => (sel === '.tp-action-dealer' ? staleActionEl : null),
          querySelectorAll: () => [],
          appendChild: () => {},
        };
        renderDealerName({ card, pid: 'p-box', cardPriceEl: null, stats: { tiefstpreis: 100 } }, {});
        assert.equal(removed, true, `expected stale .tp-action-dealer removed for ${layoutCls}`);
      }
    } finally {
      dealerCache.delete('p-box:p');
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });

  it('card-dealer re-enables .tp-dealer-btn when ensureDealerInfo returns early on missing URL', async () => {
    const { renderDealerName } = await import('../../src/ui/badges/card-dealer.js');
    const prevDoc = globalThis.document;
    const btnListeners = {};
    let currentUrl = 'https://www.toppreise.ch/preisvergleich/Cat/Prod-p-miss';
    const createdBtn = {
      tagName: 'BUTTON',
      type: 'button',
      className: '',
      textContent: '',
      title: '',
      disabled: false,
      style: {},
      dataset: {},
      setAttribute: () => {},
      addEventListener: (ev, fn) => { btnListeners[ev] = fn; },
    };
    const dealerRow = {
      className: 'tp-card-dealer-row',
      replaceChildren: () => {},
    };
    globalThis.document = {
      createElement: (tag) => (tag === 'button' ? createdBtn : dealerRow),
    };
    const card = {
      querySelector: (sel) => {
        if (sel === '.tp-card-dealer-row') return dealerRow;
        if (sel.includes('a[href*="/preisvergleich/"]') && currentUrl) {
          return { getAttribute: () => currentUrl, href: currentUrl };
        }
        return null;
      },
      querySelectorAll: (sel) => (sel === '.tp-dealer-btn' ? [createdBtn] : []),
      appendChild: () => {},
    };
    try {
      renderDealerName({ card, pid: 'p-miss', cardPriceEl: null, stats: { tiefstpreis: 100 } }, {});
      assert.equal(typeof btnListeners.click, 'function');
      currentUrl = ''; // simulate DOM link disappearing before click completes
      await btnListeners.click({ preventDefault: () => {}, stopPropagation: () => {} });
      assert.equal(createdBtn.disabled, false);
    } finally {
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });

  it('DEALER_AUTOFETCH schedules 1 delayed retry on transient 503 and stops after 200 empty', async () => {
    const { renderDealerName } = await import('../../src/ui/badges/card-dealer.js');
    const { dealerAutoTries, clearDealerAutoTried } = await import('../../src/ui/badges/deal-badge.js');
    const { CONFIG } = await import('../../src/state/config.js');
    const prevAuto = CONFIG.DEALER_AUTOFETCH;
    const prevMin = CONFIG.REAL_DEAL_MIN_DISCOUNT;
    const prevFetch = globalThis.fetch;
    const prevParser = globalThis.DOMParser;
    const prevDoc = globalThis.document;
    clearDealerAutoTried();
    CONFIG.DEALER_AUTOFETCH = true;
    CONFIG.REAL_DEAL_MIN_DISCOUNT = 0;

    let fetchCount = 0;
    let mode = '503';
    globalThis.fetch = async () => {
      fetchCount++;
      if (mode === '503') return { ok: false, status: 503, text: async () => '' };
      return { ok: true, status: 200, text: async () => '<html></html>' };
    };
    globalThis.DOMParser = class {
      parseFromString() { return { querySelectorAll: () => [] }; }
    };
    const btn = {
      tagName: 'BUTTON', type: 'button', className: '', textContent: '', title: '',
      disabled: false, style: {}, dataset: {}, setAttribute: () => {}, addEventListener: () => {},
    };
    const dealerRow = { className: 'tp-card-dealer-row', replaceChildren: () => {} };
    globalThis.document = {
      body: { getAttribute: () => null, classList: { contains: () => false } },
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: (tag) => (tag === 'button' ? btn : dealerRow),
    };
    const makeCard = (pid) => ({
      querySelector: (sel) => {
        if (sel === '.tp-card-dealer-row') return dealerRow;
        if (sel === 'a[href*="/preisvergleich/"]') {
          return { getAttribute: () => `https://www.toppreise.ch/preisvergleich/Cat/Prod-${pid}`, href: `https://www.toppreise.ch/preisvergleich/Cat/Prod-${pid}` };
        }
        return null;
      },
      querySelectorAll: (sel) => (sel === '.tp-dealer-btn' ? [btn] : []),
      appendChild: () => {},
    });

    try {
      // Transient 503: 1st auto-try fails (with 1 internal retry = 2 fetches), nextTryAt set > now
      renderDealerName({ card: makeCard('p-trans'), pid: 'p-trans', cardPriceEl: null, stats: { tiefstpreis: 100 }, heatInfo: { pct: 20 } }, {});
      await new Promise(r => setTimeout(r, 750));
      assert.equal(fetchCount, 2);
      const stTrans = dealerAutoTries.get('p-trans:s') || dealerAutoTries.get('p-trans:p');
      assert.ok(stTrans && stTrans.count === 1 && stTrans.nextTryAt > Date.now() && !stTrans.exhausted);

      // 200 empty: marks exhausted immediately (no delayed retry)
      fetchCount = 0;
      mode = '200';
      renderDealerName({ card: makeCard('p-empty'), pid: 'p-empty', cardPriceEl: null, stats: { tiefstpreis: 100 }, heatInfo: { pct: 20 } }, {});
      await new Promise(r => setTimeout(r, 50));
      assert.equal(fetchCount, 1);
      const stEmpty = dealerAutoTries.get('p-empty:s') || dealerAutoTries.get('p-empty:p');
      assert.ok(stEmpty && stEmpty.exhausted === true);
    } finally {
      clearDealerAutoTried();
      CONFIG.DEALER_AUTOFETCH = prevAuto;
      CONFIG.REAL_DEAL_MIN_DISCOUNT = prevMin;
      globalThis.fetch = prevFetch;
      if (prevParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = prevParser;
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });

  it('renderDealerName checks anchor visibility via DOM/CSS state without reading offsetParent', async () => {
    const { renderDealerName } = await import('../../src/ui/badges/card-chrome.js');
    const { dealerCache } = await import('../../src/ui/badges/deal-badge.js');
    const { CONFIG } = await import('../../src/state/config.js');
    const prevShipping = CONFIG.USE_SHIPPING_PRICE;
    const prevDoc = globalThis.document;
    CONFIG.USE_SHIPPING_PRICE = true;
    dealerCache.set('p-vis:s', { dealer: 'Digitec', url: 'https://www.digitec.ch/1' });

    const createRow = () => ({ className: '', dataset: {}, parentElement: null, nextElementSibling: null, replaceChildren() {} });
    const dealerRow = createRow();
    const linkEl = { tagName: 'A', className: '', dataset: {}, style: {}, setAttribute() {}, addEventListener() {}, parentElement: null };
    globalThis.document = {
      body: { classList: { contains: c => c === 'showshippingprice' } },
      createElement: (tag) => (tag === 'a' ? linkEl : dealerRow),
    };

    const makeHidden = (cls) => {
      const el = {
        classList: { contains: c => c === cls || c === 'priceContainer' },
        style: {},
        hidden: false,
        parentElement: null,
        contains: () => true,
      };
      Object.defineProperty(el, 'offsetParent', {
        get() { throw new Error('forced layout read: offsetParent accessed'); }
      });
      return el;
    };

    const pp = makeHidden('productPrice');
    const sp = makeHidden('shippingPrice');
    const priceSpan = { parentElement: pp };
    const inserted = [];
    const card = {
      querySelector: (sel) => {
        if (sel === '.priceContainer.productPrice') return pp;
        if (sel === '.priceContainer.shippingPrice') return sp;
        if (sel === '.priceContainer.shippingPrice:not(.d-none)') return sp;
        if (sel === '.tp-card-dealer-row') return dealerRow;
        return null;
      },
      querySelectorAll: () => [],
    };
    const parentInfo = {
      insertBefore(row, ref) { inserted.push(ref); row.nextElementSibling = ref; },
    };
    pp.parentElement = parentInfo;
    sp.parentElement = parentInfo;

    try {
      renderDealerName({ card, pid: 'p-vis', cardPriceEl: priceSpan, stats: { tiefstpreis: 100 }, heatInfo: { pct: 20 } }, {});
      assert.equal(inserted[0], sp);
    } finally {
      dealerCache.delete('p-vis:s');
      CONFIG.USE_SHIPPING_PRICE = prevShipping;
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });

  it('renderEmptyState inserts notice into getCardSortableUnit(cards[0]).parentElement instead of wrapper column', async () => {
    const { renderEmptyState } = await import('../../src/ui/badges/card-chrome.js');
    const prevDoc = globalThis.document;
    const notice = { id: 'tp-empty-state-notice', className: '', dataset: {}, style: {}, innerHTML: '', querySelector: () => null };
    const listRow = {
      id: 'product-list',
      classList: { contains: c => c === 'row' },
      firstChild: null,
      inserted: [],
      insertBefore(el, ref) { this.inserted.push({ el, ref }); }
    };
    const colCls = new Set(['col-6']);
    colCls.contains = c => colCls.has(c);
    const colWrap = {
      classList: colCls,
      parentElement: listRow,
      closest: () => null,
      inserted: [],
      insertBefore(el, ref) { this.inserted.push({ el, ref }); }
    };
    const card = {
      parentElement: colWrap,
      closest: () => null,
    };
    globalThis.document = {
      getElementById: () => null,
      createElement: () => notice,
      body: null
    };
    try {
      renderEmptyState([card], { filteredCount: 1 });
      assert.equal(listRow.inserted.length, 1);
      assert.equal(colWrap.inserted.length, 0);
    } finally {
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });
});
