import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENROUTER_API_ENDPOINT,
  OPENROUTER_CACHE_KEY_PREFIX,
  openRouterCacheKey,
  extractOpenRouterCitations,
  getCachedOpenRouter,
  setCachedOpenRouter,
  pruneOpenRouterCache,
  clearOpenRouterCache,
  fetchOpenRouterWebSearch,
  isConfiguredAiActive,
  fetchConfiguredAiSummary
} from '../../src/features/openrouter-search.js';
import { gmRequestWithTimeout } from '../../src/state/net.js';
import { CONFIG } from '../../src/state/config.js';

function makeStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key: i => Array.from(map.keys())[i] ?? null,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); }
  };
}

describe('openrouter-search: citations', () => {
  it('extracts valid https citations and deduplicates by URL', () => {
    const out = extractOpenRouterCitations([
      { type: 'url_citation', url_citation: { url: 'https://example.com/a', title: 'Review A' } },
      { type: 'url_citation', url_citation: { url: 'https://example.com/a', title: 'Duplicate' } },
      { type: 'url_citation', url_citation: { url: 'javascript:alert(1)', title: 'Bad' } },
      { type: 'other', url_citation: { url: 'https://example.com/b', title: 'Ignored' } },
      { type: 'url_citation', url_citation: { url: 'http://example.com/c', title: '' } }
    ]);
    assert.deepEqual(out, [
      { url: 'https://example.com/a', title: 'Review A' },
      { url: 'http://example.com/c', title: 'http://example.com/c' }
    ]);
  });
});

describe('openrouter-search: cache & fetch', () => {
  let realLS, realFetch, realGM, savedConfig;

  beforeEach(() => {
    realLS = globalThis.localStorage;
    realFetch = globalThis.fetch;
    realGM = globalThis.GM_xmlhttpRequest;
    delete globalThis.GM_xmlhttpRequest;
    globalThis.localStorage = makeStorage();
    clearOpenRouterCache();
    savedConfig = { ...CONFIG };
  });

  afterEach(() => {
    clearOpenRouterCache();
    Object.assign(CONFIG, savedConfig);
    if (realLS === undefined) delete globalThis.localStorage; else globalThis.localStorage = realLS;
    if (realFetch === undefined) delete globalThis.fetch; else globalThis.fetch = realFetch;
    if (realGM === undefined) delete globalThis.GM_xmlhttpRequest; else globalThis.GM_xmlhttpRequest = realGM;
  });

  it('rejects missing API key or empty prompt', async () => {
    await assert.rejects(() => fetchOpenRouterWebSearch('', 'test'), /API-Key fehlt/);
    await assert.rejects(() => fetchOpenRouterWebSearch('sk-or-test', '   '), /leer/);
  });

  it('sends openrouter:web_search tool payload, extracts citations, and caches result', async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{
            message: {
              content: 'Sehr solides Preis-Leistungs-Verhältnis.',
              annotations: [
                { type: 'url_citation', url_citation: { url: 'https://notebookcheck.com/1', title: 'Notebookcheck' } }
              ]
            }
          }]
        })
      };
    };

    const res1 = await fetchOpenRouterWebSearch('sk-or-123', 'Sony WH-1000XM5 Test', {
      model: 'google/gemini-2.5-flash',
      engine: 'exa',
      maxResults: 4
    });
    assert.equal(res1.answer, 'Sehr solides Preis-Leistungs-Verhältnis.');
    assert.deepEqual(res1.citations, [{ url: 'https://notebookcheck.com/1', title: 'Notebookcheck' }]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, OPENROUTER_API_ENDPOINT);
    assert.deepEqual(calls[0].body.tools, [{
      type: 'openrouter:web_search',
      parameters: { engine: 'exa', max_results: 4, search_context_size: 'medium' }
    }]);

    // Second call hits cache
    const res2 = await fetchOpenRouterWebSearch('sk-or-123', 'Sony WH-1000XM5 Test', {
      model: 'google/gemini-2.5-flash',
      engine: 'exa',
      maxResults: 4
    });
    assert.equal(calls.length, 1);
    assert.equal(res2.answer, res1.answer);
  });

  it('surfaces 401, 402 and 429 HTTP errors cleanly', async () => {
    for (const [status, rx] of [[401, /ungültig/], [402, /Guthaben/], [429, /Rate-Limit/]]) {
      globalThis.fetch = async () => ({ ok: false, status, text: async () => '' });
      await assert.rejects(() => fetchOpenRouterWebSearch('sk-or-123', `prompt-${status}`), rx);
    }
  });

  it('dispatches unified facade to OpenRouter when configured', async () => {
    CONFIG.AI_SEARCH_PROVIDER = 'openrouter';
    CONFIG.OPENROUTER_API_KEY = 'sk-or-facade';
    CONFIG.OPENROUTER_MODEL = 'openai/gpt-4o-mini';
    CONFIG.OPENROUTER_SEARCH_ENGINE = 'auto';
    CONFIG.OPENROUTER_MAX_RESULTS = 3;
    assert.equal(isConfiguredAiActive(CONFIG), true);

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { content: 'Top Deal!', annotations: [] } }]
      })
    });

    const res = await fetchConfiguredAiSummary('OLED Monitor', 'Testbericht', 'CHF 499.00');
    assert.equal(res.answer, 'Top Deal!');
    assert.deepEqual(res.citations, []);
  });

  it('stores and clears cache entries via clearOpenRouterCache', () => {
    const store = makeStorage();
    setCachedOpenRouter('k1', { answer: 'ok', citations: [] }, store);
    assert.ok(store.getItem(OPENROUTER_CACHE_KEY_PREFIX + 'k1'));
    const mem = getCachedOpenRouter('k1');
    assert.equal(mem?.answer, 'ok');
    clearOpenRouterCache();
    assert.equal(getCachedOpenRouter('k1'), null);
  });

  it('produces compact hashed cache keys that vary by searchContextSize', () => {
    const longPrompt = 'Vergleiche ' + 'Produkt '.repeat(600);
    const kMed = openRouterCacheKey(longPrompt, 'google/gemini-2.5-flash', 'auto', 5, 'medium');
    const kHigh = openRouterCacheKey(longPrompt, 'google/gemini-2.5-flash', 'auto', 5, 'high');
    assert.ok(kMed.length < 90, `expected short key, got ${kMed.length}`);
    assert.notEqual(kMed, kHigh);
  });

  it('gmRequestWithTimeout aborts handle and rejects cancelled:true via AbortController', async () => {
    let aborted = false;
    globalThis.GM_xmlhttpRequest = () => ({
      abort: () => { aborted = true; }
    });
    const ac = new AbortController();
    const p = gmRequestWithTimeout({ url: 'https://openrouter.ai/api/v1/chat/completions' }, {
      timeoutMs: 5000,
      signal: ac.signal,
      source: 'openrouter'
    });
    ac.abort();
    await assert.rejects(() => p, err => err?.cancelled === true);
    assert.equal(aborted, true);
  });

  it('deduplicates simultaneous identical fetchOpenRouterWebSearch calls via orInFlight', async () => {
    let fetchCount = 0;
    let resolveFetch;
    globalThis.fetch = () => {
      fetchCount++;
      return new Promise(r => { resolveFetch = r; });
    };
    const p1 = fetchOpenRouterWebSearch('sk-or-dedup', 'Same Prompt');
    const p2 = fetchOpenRouterWebSearch('sk-or-dedup', 'Same Prompt');
    resolveFetch({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: 'Deduplicated!', annotations: [] } }] })
    });
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(fetchCount, 1);
    assert.equal(r1.answer, 'Deduplicated!');
    assert.equal(r2.answer, 'Deduplicated!');
  });

  it('concatenates array message.content parts cleanly', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{
          message: {
            content: [{ type: 'text', text: 'Part 1 ' }, { text: 'Part 2' }],
            annotations: []
          }
        }]
      })
    });
    const res = await fetchOpenRouterWebSearch('sk-or-arr', 'Array content test');
    assert.equal(res.answer, 'Part 1 Part 2');
  });

  it('pruneOpenRouterCache removes expired entries and evicts oldest valid entries past maxEntries', () => {
    const store = makeStorage();
    const now = Date.now();
    store.setItem(OPENROUTER_CACHE_KEY_PREFIX + 'expired', JSON.stringify({ answer: 'old', timestamp: now - (49 * 3600 * 1000) }));
    store.setItem(OPENROUTER_CACHE_KEY_PREFIX + 'v1', JSON.stringify({ answer: 'v1', timestamp: now - 3000 }));
    store.setItem(OPENROUTER_CACHE_KEY_PREFIX + 'v2', JSON.stringify({ answer: 'v2', timestamp: now - 2000 }));
    store.setItem(OPENROUTER_CACHE_KEY_PREFIX + 'v3', JSON.stringify({ answer: 'v3', timestamp: now - 1000 }));

    const removed = pruneOpenRouterCache(2, store);
    assert.equal(removed, 2);
    assert.equal(store.getItem(OPENROUTER_CACHE_KEY_PREFIX + 'expired'), null);
    assert.equal(store.getItem(OPENROUTER_CACHE_KEY_PREFIX + 'v1'), null);
    assert.ok(store.getItem(OPENROUTER_CACHE_KEY_PREFIX + 'v2'));
    assert.ok(store.getItem(OPENROUTER_CACHE_KEY_PREFIX + 'v3'));
  });

  it('fetchConfiguredAiSummary rejects when provider is google and forwards searchContextSize', async () => {
    CONFIG.AI_SEARCH_PROVIDER = 'google';
    CONFIG.OPENROUTER_API_KEY = '';
    CONFIG.TAVILY_API_KEY = '';
    await assert.rejects(() => fetchConfiguredAiSummary('Prod', 'Test', 'CHF 50'), /Kein KI-Anbieter/);

    CONFIG.AI_SEARCH_PROVIDER = 'openrouter';
    CONFIG.OPENROUTER_API_KEY = 'sk-or-ctx';
    let sentBody = null;
    globalThis.fetch = async (_url, init) => {
      sentBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: 'High ctx', annotations: [] } }] })
      };
    };
    const res = await fetchConfiguredAiSummary('Prod', 'Test', 'CHF 50', { searchContextSize: 'high' });
    assert.equal(res.answer, 'High ctx');
    assert.equal(sentBody.tools[0].parameters.search_context_size, 'high');
  });
});
