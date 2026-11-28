import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startBatchJob,
  cancelActiveBatchJob,
  getActiveBatchJob,
  runSingleBatchAlarm,
  runBatchDealerFetch,
  runBatchPriceAlarms,
  runBatchAiIndividual,
  runBatchComparisonAi,
  runBatchOpenTabs,
  runBatchDiscordShare,
  runBatchNativeCompare
} from '../../src/features/batch-runners.js';
import { CONFIG } from '../../src/state/config.js';
import { setOriginCooldownUntil, resetOriginCooldown } from '../../src/state/net.js';
import { setSharedDeal } from '../../src/scanner/cache.js';
import { buildTavilyQuery } from '../../src/features/tavily-search.js';
import { openRouterCacheKey, setCachedOpenRouter, clearOpenRouterCache } from '../../src/features/openrouter-search.js';

describe('batch-runners: single-flight job controller', () => {
  afterEach(() => { cancelActiveBatchJob(); });

  it('cancels previous job when a new job starts', () => {
    const j1 = startBatchJob('first', 5);
    assert.equal(getActiveBatchJob().label, 'first');
    const j2 = startBatchJob('second', 3);
    assert.equal(j1.signal.aborted, true);
    assert.equal(j2.signal.aborted, false);
    assert.equal(getActiveBatchJob().label, 'second');
    j2.updateProgress(1, 0, 2);
    assert.equal(getActiveBatchJob().total, 2);
    j2.finish();
    assert.equal(getActiveBatchJob(), null);
  });

  it('runBatchComparisonAi returns missing-key when openrouter key is unset', async () => {
    const prevKey = CONFIG.OPENROUTER_API_KEY;
    CONFIG.OPENROUTER_API_KEY = '';
    try {
      const res = await runBatchComparisonAi([{ title: 'A', priceText: 'CHF 10' }], { target: 'openrouter' });
      assert.equal(res.mode, 'missing-key');
      assert.equal(res.target, 'openrouter');
    } finally {
      CONFIG.OPENROUTER_API_KEY = prevKey;
    }
  });
});

describe('batch-runners: price alarms sequential runner', () => {
  it('runs sequentially and aborts early after 3 consecutive failures', async () => {
    const seen = [];
    const items = [1, 2, 3, 4, 5].map(pid => ({ pid: String(pid), card: {} }));
    const res = await runBatchPriceAlarms(items, {
      targetPct: 0.6,
      durationDays: '730',
      alarmFn: async (pid) => {
        seen.push(pid);
        return { status: 'error' };
      }
    });
    assert.deepEqual(seen, ['1', '2', '3']);
    assert.equal(res.abortedEarly, true);
    assert.equal(res.failed, 3);
    assert.equal(res.confirmed, 0);
  });

  it('stops on external AbortSignal', async () => {
    const ac = new AbortController();
    const seen = [];
    const items = [1, 2, 3].map(pid => ({ pid: String(pid), card: {} }));
    const res = await runBatchPriceAlarms(items, {
      targetPct: 0.6,
      durationDays: '730',
      signal: ac.signal,
      alarmFn: async (pid) => {
        seen.push(pid);
        ac.abort();
        return { status: 'confirmed' };
      }
    });
    assert.deepEqual(seen, ['1']);
    assert.equal(res.confirmed, 1);
    assert.equal(res.cancelled, true);
  });
});

describe('batch-runners: Google AI tabs & fallback', () => {
  it('opens Google AI (&udm=50) tabs and collects blocked items', async () => {
    const openedUrls = [];
    const items = [
      { title: 'Prod A', priceText: 'CHF 100.00' },
      { title: 'Prod B', priceText: 'CHF 200.00' }
    ];
    const res = await runBatchAiIndividual(items, {
      provider: 'google',
      openTabFn: (url) => {
        openedUrls.push(url);
        return openedUrls.length === 1; // 2nd blocked
      }
    });
    assert.equal(res.opened, 1);
    assert.equal(res.blockedItems.length, 1);
    assert.equal(res.blockedItems[0].title, 'Prod B');
    assert.match(openedUrls[0], /&udm=50$/);
  });

  it('runBatchOpenTabs prefers dealerUrl over product url', () => {
    const urls = [];
    const res = runBatchOpenTabs([
      { title: 'A', url: 'https://tp.ch/a', dealerUrl: 'https://shop.ch/a' },
      { title: 'B', url: 'https://tp.ch/b', dealerUrl: '' }
    ], { openTabFn: u => { urls.push(u); return true; } });
    assert.equal(res.opened, 2);
    assert.deepEqual(urls, ['https://shop.ch/a', 'https://tp.ch/b']);
  });
});

describe('batch-runners: native comparison guard', () => {
  it('clicks only inactive buttons and caps at 4 total active', () => {
    const clicked = [];
    const mkBtn = (action, id) => ({
      getAttribute: k => (k === 'data-ser-plgn-data' ? JSON.stringify({ pc_atpcbc_action: action }) : null),
      click: () => clicked.push(id)
    });
    const bActive = mkBtn('rm', 'existing');
    const b1 = mkBtn('ad', 'p1');
    const b2 = mkBtn('ad', 'p2');
    const b3 = mkBtn('ad', 'p3');
    const b4 = mkBtn('ad', 'p4');
    const doc = { querySelectorAll: () => [bActive, b1, b2, b3, b4] };
    const items = [b1, b2, b3, b4].map(btn => ({
      card: { querySelector: () => btn }
    }));
    const res = runBatchNativeCompare(items, doc);
    assert.equal(res.alreadyActive, 1);
    assert.equal(res.clicked, 3);
    assert.equal(res.activeCount, 4);
    assert.equal(res.cappedAt4, true);
    assert.deepEqual(clicked, ['p1', 'p2', 'p3']);
  });
});

describe('batch-runners: Discord share duplicate skip', () => {
  let realLS, realWin, lsStore;
  beforeEach(() => {
    realLS = globalThis.localStorage;
    realWin = globalThis.window;
    lsStore = {};
    const mockLS = {
      getItem: k => (k in lsStore ? lsStore[k] : null),
      setItem: (k, v) => { lsStore[k] = String(v); },
      removeItem: k => { delete lsStore[k]; }
    };
    globalThis.localStorage = mockLS;
    globalThis.window = { localStorage: mockLS };
  });
  afterEach(() => {
    if (realLS === undefined) delete globalThis.localStorage; else globalThis.localStorage = realLS;
    if (realWin === undefined) delete globalThis.window; else globalThis.window = realWin;
  });

  it('skips already-shared deals via getSharedDeal', async () => {
    setSharedDeal('111', 9900);
    const items = [
      { pid: '111', cardPrice: 99, isVerifiedDeal: true },
      { pid: '222', cardPrice: 50, isVerifiedDeal: false }
    ];
    const res = await runBatchDiscordShare(items, { url: 'https://discord.com/api/webhooks/1/a' });
    assert.equal(res.skippedDuplicates, 1);
    assert.equal(res.total, 0);
    assert.equal(res.shared, 0);
  });

  it('rejects invalid webhook URL', async () => {
    const res = await runBatchDiscordShare(
      [{ pid: '333', cardPrice: 50, isVerifiedDeal: true }],
      { url: 'http://invalid.example.com/hook' }
    );
    assert.equal(res.total, 0);
    assert.equal(res.shared, 0);
  });
});

describe('batch-runners: dealer fetch bounded concurrency', () => {
  it('fetches missing dealers with max 3 concurrency', async () => {
    let active = 0;
    let maxActive = 0;
    const items = [1, 2, 3, 4, 5].map(i => ({
      pid: String(i),
      card: { querySelector: () => null, querySelectorAll: () => [] }
    }));
    const res = await runBatchDealerFetch(items, {
      fetchFn: async () => {
        active++;
        if (active > maxActive) maxActive = active;
        await new Promise(r => setTimeout(r, 10));
        active--;
        return { dealer: 'Shop' };
      }
    });
    assert.equal(res.loaded, 5);
    assert.ok(maxActive <= 3 && maxActive >= 1);
  });

  it('exits early with stoppedByCooldown when origin cooldown is active', async () => {
    setOriginCooldownUntil(Date.now() + 5000);
    let fetchCalls = 0;
    try {
      const items = [1, 2].map(i => ({
        pid: String(i),
        card: { querySelector: () => null, querySelectorAll: () => [] }
      }));
      const res = await runBatchDealerFetch(items, {
        fetchFn: async () => {
          fetchCalls++;
          return { dealer: 'Shop' };
        }
      });
      assert.equal(res.stoppedByCooldown, true);
      assert.equal(fetchCalls, 0);
    } finally {
      resetOriginCooldown();
    }
  });

  it('returns total: 0 when all cards already have DOM dealer info', async () => {
    const cardWithDealer = {
      querySelector: sel => (sel.includes('Plugin_DealerRelProdPriceInfo') ? { textContent: 'Digitec' } : null),
      querySelectorAll: sel => (sel.includes('Plugin_DealerRelProdPriceInfo')
        ? [{ querySelector: () => ({ textContent: 'Digitec' }) }]
        : [])
    };
    const res = await runBatchDealerFetch([{ pid: '10', card: cardWithDealer }]);
    assert.equal(res.total, 0);
    assert.equal(res.loaded, 0);
  });
});

describe('batch-runners: runSingleBatchAlarm error & abort guards', () => {
  it('returns cancelled immediately when signal is aborted or pid is missing', async () => {
    const ac = new AbortController();
    ac.abort();
    const r1 = await runSingleBatchAlarm('123', null, { signal: ac.signal });
    assert.deepEqual(r1, { status: 'cancelled' });
    const r2 = await runSingleBatchAlarm('', null, {});
    assert.deepEqual(r2, { status: 'cancelled' });
  });

  it('returns fetch-failed when fetched HTML lacks alarm dialog (login wall)', async () => {
    const prevDoc = globalThis.document;
    const prevFetch = globalThis.fetch;
    const prevDOMParser = globalThis.DOMParser;
    globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => '<html><body>Login</body></html>' });
    globalThis.DOMParser = class {
      parseFromString() { return { querySelector: () => null }; }
    };
    try {
      const res = await runSingleBatchAlarm('555', null, { targetPct: 0.6, durationDays: '730' });
      assert.equal(res.status, 'error');
      assert.equal(res.reason, 'fetch-failed');
    } finally {
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
      if (prevFetch === undefined) delete globalThis.fetch; else globalThis.fetch = prevFetch;
      if (prevDOMParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = prevDOMParser;
    }
  });
});

describe('batch-runners: OpenRouter individual & comparison runners', () => {
  it('runBatchAiIndividual runs with bounded concurrency <= 3, handles mixed errors and aborts mid-run', async () => {
    const prevConfig = { ...CONFIG };
    CONFIG.OPENROUTER_API_KEY = 'sk-or-test';
    CONFIG.OPENROUTER_MODEL = 'google/gemini-2.5-flash';
    CONFIG.OPENROUTER_SEARCH_ENGINE = 'auto';
    CONFIG.OPENROUTER_MAX_RESULTS = 3;
    try {
      let active = 0;
      let maxActive = 0;
      const items = [1, 2, 3, 4, 5].map(i => ({ title: `Item ${i}`, priceText: `CHF ${i}0` }));
      const res = await runBatchAiIndividual(items, {
        provider: 'openrouter',
        searchFn: async (_key, prompt) => {
          active++;
          if (active > maxActive) maxActive = active;
          await new Promise(r => setTimeout(r, 10));
          active--;
          if (prompt.includes('Item 3')) throw new Error('Item 3 failed');
          return { answer: `Fazit for ${prompt}`, citations: [{ url: 'https://example.com', title: 'Ex' }] };
        }
      });
      assert.equal(res.mode, 'openrouter');
      assert.equal(res.total, 5);
      assert.equal(res.done, 5);
      assert.equal(res.failed, 1);
      assert.ok(maxActive <= 3 && maxActive >= 1);
      assert.equal(res.results[2].error, 'Item 3 failed');
      assert.match(res.results[0].answer, /Fazit/);

      const ac = new AbortController();
      const abortedRes = await runBatchAiIndividual(items, {
        provider: 'openrouter',
        signal: ac.signal,
        searchFn: async () => {
          ac.abort();
          throw Object.assign(new Error('Aborted'), { cancelled: true });
        }
      });
      assert.equal(abortedRes.cancelled, true);
    } finally {
      Object.assign(CONFIG, prevConfig);
    }
  });

  it('runBatchComparisonAi passes searchContextSize: high for openrouter and copies long chatgpt prompt', async () => {
    const prevKey = CONFIG.OPENROUTER_API_KEY;
    const prevNav = globalThis.navigator;
    CONFIG.OPENROUTER_API_KEY = 'sk-or-cmp';
    try {
      let capturedOpts = null;
      const orRes = await runBatchComparisonAi([{ title: 'Prod 1', priceText: 'CHF 99' }], {
        target: 'openrouter',
        searchFn: async (_key, _prompt, opts) => {
          capturedOpts = opts;
          return { answer: 'Comparison verdict', citations: [{ url: 'https://test.ch/r', title: 'Test' }] };
        }
      });
      assert.equal(orRes.mode, 'openrouter');
      assert.equal(capturedOpts.searchContextSize, 'high');
      assert.equal(orRes.citations.length, 1);

      let copiedText = '';
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { clipboard: { writeText: async t => { copiedText = t; } } }
      });
      const realisticTen = Array.from({ length: 10 }, (_, i) => ({
        title: `ASUS ROG Monitor ${i + 1} 27 Zoll`,
        priceText: `CHF ${350 + i}.00`,
        discountText: '-25%',
        lowText: `CHF ${380 + i}.00`,
        medianText: 'Ø-Preis (1J): CHF 450.00',
        dealer: 'Digitec',
        specs: '27 Zoll · 240 Hz · OLED · USB-C'
      }));
      let googleOpenOpts = null;
      let googleOpenUrl = '';
      const gRes = await runBatchComparisonAi(realisticTen, {
        target: 'google-ai',
        openTabFn: (url, opts) => { googleOpenUrl = url; googleOpenOpts = opts; return true; }
      });
      assert.equal(gRes.mode, 'external');
      assert.equal(gRes.needsPaste, false);
      assert.equal(gRes.opened, true);
      assert.equal(googleOpenOpts?.active, true);
      assert.match(googleOpenUrl, /^https:\/\/www\.google\.com\/search\?q=.+&udm=50$/);

      const longItems = Array.from({ length: 45 }, (_, i) => ({
        title: `Very Long Product Title Number ${i} with Extra Details`,
        priceText: 'CHF 199.00',
        specs: '16 GB RAM · 1 TB SSD · OLED Display'
      }));
      let hugeOpened = false;
      const extRes = await runBatchComparisonAi(longItems, {
        target: 'chatgpt',
        openTabFn: () => { hugeOpened = true; return true; }
      });
      assert.equal(extRes.mode, 'external');
      assert.equal(extRes.needsPaste, true);
      assert.equal(extRes.opened, false);
      assert.equal(hugeOpened, false);
      assert.equal(extRes.copied, true);
      assert.ok(copiedText.length > 1500);
    } finally {
      CONFIG.OPENROUTER_API_KEY = prevKey;
      if (prevNav === undefined) delete globalThis.navigator;
      else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: prevNav });
    }
  });
});

describe('batch-runners: Discord share {ai} injection & 429 retry', () => {
  let realLS, realWin, realFetch, realGM, lsStore, savedConfig;
  beforeEach(() => {
    realLS = globalThis.localStorage;
    realWin = globalThis.window;
    realFetch = globalThis.fetch;
    realGM = globalThis.GM_xmlhttpRequest;
    delete globalThis.GM_xmlhttpRequest;
    lsStore = {};
    const mockLS = {
      getItem: k => (k in lsStore ? lsStore[k] : null),
      setItem: (k, v) => { lsStore[k] = String(v); },
      removeItem: k => { delete lsStore[k]; },
      get length() { return Object.keys(lsStore).length; },
      key: i => Object.keys(lsStore)[i] ?? null
    };
    globalThis.localStorage = mockLS;
    globalThis.window = { localStorage: mockLS };
    savedConfig = { ...CONFIG };
    clearOpenRouterCache();
  });
  afterEach(() => {
    clearOpenRouterCache();
    Object.assign(CONFIG, savedConfig);
    if (realLS === undefined) delete globalThis.localStorage; else globalThis.localStorage = realLS;
    if (realWin === undefined) delete globalThis.window; else globalThis.window = realWin;
    if (realFetch === undefined) delete globalThis.fetch; else globalThis.fetch = realFetch;
    if (realGM === undefined) delete globalThis.GM_xmlhttpRequest; else globalThis.GM_xmlhttpRequest = realGM;
  });

  it('injects cached {ai} summary and retries once on 429 Retry-After', async () => {
    CONFIG.DISCORD_LAYOUT = '{title} | {price} | {ai}';
    CONFIG.DISCORD_FORUM_TITLE = true;
    CONFIG.AI_SEARCH_PROVIDER = 'openrouter';
    CONFIG.OPENROUTER_API_KEY = 'sk-or-disc';
    CONFIG.OPENROUTER_MODEL = 'google/gemini-2.5-flash';
    CONFIG.OPENROUTER_SEARCH_ENGINE = 'auto';
    CONFIG.OPENROUTER_MAX_RESULTS = 5;

    const query = buildTavilyQuery('OLED TV', CONFIG.REVIEW_SEARCH_KEYWORD, 'CHF 999.00');
    const cKey = openRouterCacheKey(query, CONFIG.OPENROUTER_MODEL, CONFIG.OPENROUTER_SEARCH_ENGINE, CONFIG.OPENROUTER_MAX_RESULTS, 'medium');
    setCachedOpenRouter(cKey, { answer: 'Hervorragender Kontrast', citations: [] });

    const postedPayloads = [];
    let attempt = 0;
    globalThis.fetch = async (_url, init) => {
      attempt++;
      postedPayloads.push(JSON.parse(init.body));
      if (attempt === 1) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '0.5' }),
          text: async () => 'rate limited'
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'msg-1' })
      };
    };

    const res = await runBatchDiscordShare([{
      pid: '777',
      title: 'OLED TV',
      priceText: 'CHF 999.00',
      cardPrice: 999,
      dealer: 'Digitec',
      dealerUrl: 'https://digitec.ch/1',
      offerCount: 3,
      url: 'https://www.toppreise.ch/preisvergleich/TV/OLED-TV-p777',
      isVerifiedDeal: true
    }], { url: 'https://discord.com/api/webhooks/123/abc' });

    assert.equal(res.shared, 1);
    assert.equal(res.failed, 0);
    assert.equal(attempt, 2);
    assert.match(postedPayloads[0].content, /Hervorragender Kontrast/);
  });

  it('does not retry HTTP 400 even when X-RateLimit-Reset-After is present', async () => {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      return {
        ok: false,
        status: 400,
        headers: new Headers({ 'X-RateLimit-Reset-After': '10' }),
        text: async () => '{"message":"bad payload"}'
      };
    };
    const res = await runBatchDiscordShare([{
      pid: '778',
      title: 'Monitor',
      priceText: 'CHF 199.00',
      cardPrice: 199,
      isVerifiedDeal: true
    }], { url: 'https://discord.com/api/webhooks/123/abc' });
    assert.equal(attempts, 1);
    assert.equal(res.failed, 1);
  });

  it('runBatchAiIndividual returns missing-key upfront and skips done count on abort', async () => {
    CONFIG.OPENROUTER_API_KEY = '   ';
    const mk = await runBatchAiIndividual([{ title: 'A', priceText: 'CHF 10' }], { provider: 'openrouter' });
    assert.equal(mk.mode, 'missing-key');

    CONFIG.OPENROUTER_API_KEY = 'sk-or-test';
    const ac = new AbortController();
    const aborted = await runBatchAiIndividual([{ title: 'A', priceText: 'CHF 10' }], {
      provider: 'openrouter',
      signal: ac.signal,
      searchFn: async () => {
        ac.abort();
        throw Object.assign(new Error('Aborted'), { cancelled: true });
      }
    });
    assert.equal(aborted.done, 0);
    assert.equal(aborted.cancelled, true);
  });
});
