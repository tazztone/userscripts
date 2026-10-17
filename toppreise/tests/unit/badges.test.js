import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setTextIfChanged, renderEmptyState } from '../../src/ui/badges.js';
describe('Badges helpers', () => {
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
    const notice = { dataset: { tpEmptySig: '2:2:0:30' } };
    const created = [];
    fakeDoc(notice, created);
    renderEmptyState(cards, counts);
    assert.equal(created.length, 0);
    assert.equal(notice.dataset.tpEmptySig, '2:2:0:30');
  });

  it('builds notice and stamps signature on first render', () => {
    const { cards, counts } = setup();
    const created = [];
    fakeDoc(null, created);
    renderEmptyState(cards, counts);
    assert.equal(created.length, 1);
    assert.equal(created[0].dataset.tpEmptySig, '2:2:0:30');
  });

  it('builds notice whenever all cards are removed (no display-mode gate)', () => {
    const { cards, counts } = setup();
    const created = [];
    fakeDoc(null, created);
    renderEmptyState(cards, counts);
    assert.equal(created.length, 1);
    assert.equal(created[0].dataset.tpEmptySig, '2:2:0:30');
  });
});

describe('renderCardEffects median line + sparkline signature', () => {
  let realDocument;

  const mockEl = (tag = 'div') => {
    const el = {
      tagName: tag.toUpperCase(),
      children: [],
      dataset: {},
      attributes: {},
      className: '',
      textContent: '',
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
      querySelector: sel => (sel === '.tp-dealer-name' ? dealerEl : (sel.includes('tp-deal-new-record') ? {} : null)),
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

  it('renderBadgeSetup returns null early when pid is null', async () => {
    const { renderBadgeSetup } = await import('../../src/ui/badges/deal-badge.js');
    const card = { querySelector: () => null };
    const res = renderBadgeSetup({ card, pid: null }, false);
    assert.equal(res, null);
  });
});
