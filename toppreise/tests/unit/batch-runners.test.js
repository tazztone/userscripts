import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startBatchJob,
  cancelActiveBatchJob,
  getActiveBatchJob,
  runBatchDealerFetch,
  runBatchPriceAlarms,
  runBatchAiIndividual,
  runBatchComparisonAi,
  runBatchOpenTabs,
  runBatchDiscordShare,
  runBatchNativeCompare
} from '../../src/features/batch-runners.js';
import { CONFIG } from '../../src/state/config.js';
import { setSharedDeal } from '../../src/scanner/cache.js';

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
});
