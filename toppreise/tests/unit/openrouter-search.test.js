import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENROUTER_API_ENDPOINT,
  OPENROUTER_CACHE_KEY_PREFIX,
  extractOpenRouterCitations,
  getCachedOpenRouter,
  setCachedOpenRouter,
  clearOpenRouterCache,
  fetchOpenRouterWebSearch,
  isConfiguredAiActive,
  fetchConfiguredAiSummary
} from '../../src/features/openrouter-search.js';
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
});
