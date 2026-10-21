import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  TAVILY_API_ENDPOINT,
  TAVILY_CACHE_KEY_PREFIX,
  TAVILY_CACHE_TTL_MS,
  normalizeTavilyQuery,
  tavilyCacheKey,
  getCachedTavily,
  setCachedTavily,
  clearTavilyCache,
  buildTavilyQuery,
  fetchTavilySummary
} from '../../src/features/tavily-search.js';

describe('tavily-search: query & normalization', () => {
  it('normalizes whitespace and trims', () => {
    assert.equal(normalizeTavilyQuery('  Sony   WH-1000XM5   Test  '), 'Sony WH-1000XM5 Test');
    assert.equal(tavilyCacheKey('  Sony   WH-1000XM5  '), 'sony wh-1000xm5');
  });

  it('builds query with title, keyword and price', () => {
    const q1 = buildTavilyQuery('Roborock S8 Pro Ultra', 'Testbericht - {preis} Preiseinschätzung', 'CHF 899.00');
    assert.ok(q1.includes('Roborock S8 Pro Ultra'));
    assert.ok(q1.includes('CHF 899.00'));
    assert.ok(q1.includes('Deutsch'));

    const q2 = buildTavilyQuery('Apple iPad Air', 'Erfahrungen', '');
    assert.ok(q2.includes('Apple iPad Air'));
    assert.ok(q2.includes('Erfahrungen'));
    assert.ok(q2.includes('Kurzfazit Deutsch'));
  });
});

describe('tavily-search: cache layer', () => {
  beforeEach(() => {
    clearTavilyCache();
  });

  afterEach(() => {
    clearTavilyCache();
  });

  it('stores and retrieves cached verdict', () => {
    const query = 'Logitech MX Master 3S Test';
    assert.equal(getCachedTavily(query), null);

    setCachedTavily(query, 'Hervorragende Ergonomie und leise Klicks.');
    const cached = getCachedTavily(query);
    assert.ok(cached);
    assert.equal(cached.answer, 'Hervorragende Ergonomie und leise Klicks.');
    assert.ok(Date.now() - cached.timestamp < 1000);
  });

  it('respects 48h TTL on cached entries', () => {
    const query = 'Bose QuietComfort Ultra Test';
    setCachedTavily(query, 'Sehr gutes ANC.');
    const entry = getCachedTavily(query);
    assert.ok(entry);

    // Stale timestamp older than 48h
    entry.timestamp = Date.now() - (TAVILY_CACHE_TTL_MS + 5000);
    assert.equal(getCachedTavily(query), null);
  });

  it('clearTavilyCache empties the store', () => {
    setCachedTavily('Product A', 'Fazit A');
    setCachedTavily('Product B', 'Fazit B');
    assert.ok(getCachedTavily('Product A'));
    clearTavilyCache();
    assert.equal(getCachedTavily('Product A'), null);
    assert.equal(getCachedTavily('Product B'), null);
  });
});

describe('tavily-search: fetchTavilySummary', () => {
  let origFetch;
  let origGM;

  beforeEach(() => {
    clearTavilyCache();
    origFetch = globalThis.fetch;
    origGM = globalThis.GM_xmlhttpRequest;
    delete globalThis.GM_xmlhttpRequest;
  });

  afterEach(() => {
    clearTavilyCache();
    globalThis.fetch = origFetch;
    if (origGM !== undefined) globalThis.GM_xmlhttpRequest = origGM;
    else delete globalThis.GM_xmlhttpRequest;
  });

  it('rejects on missing API key or empty query', async () => {
    await assert.rejects(() => fetchTavilySummary('', 'Test'), /Tavily API-Key fehlt/);
    await assert.rejects(() => fetchTavilySummary('tvly-123', '   '), /Suchanfrage ist leer/);
  });

  it('fetches synthesized answer via fetch and caches it', async () => {
    let callCount = 0;
    globalThis.fetch = async (url, opts) => {
      callCount++;
      assert.equal(url, TAVILY_API_ENDPOINT);
      const parsed = JSON.parse(opts.body);
      assert.equal(parsed.api_key, 'tvly-secret');
      assert.equal(parsed.search_depth, 'basic');
      assert.equal(parsed.include_answer, true);

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          answer: 'Sehr empfehlenswert für den aufgerufenen Preis.',
          results: [{ title: 'Review 1', content: 'Details...' }]
        })
      };
    };

    const res1 = await fetchTavilySummary('tvly-secret', 'Asus ROG Ally Test');
    assert.equal(res1, 'Sehr empfehlenswert für den aufgerufenen Preis.');
    assert.equal(callCount, 1);

    // Second call should come straight from cache
    const res2 = await fetchTavilySummary('tvly-secret', 'Asus ROG Ally Test');
    assert.equal(res2, 'Sehr empfehlenswert für den aufgerufenen Preis.');
    assert.equal(callCount, 1);
  });

  it('falls back to results snippet when answer is missing', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        answer: '',
        results: [{ title: 'Snippet', content: 'Ausgezeichnete Akkulaufzeit und Display.' }]
      })
    });

    const res = await fetchTavilySummary('tvly-key', 'Nothing Phone 2a Test');
    assert.equal(res, 'Ausgezeichnete Akkulaufzeit und Display.');
  });

  it('surfaces 401/403 invalid key and 429 quota errors', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    });
    await assert.rejects(() => fetchTavilySummary('bad-key', 'Test'), /Tavily API-Key ungültig/);

    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded'
    });
    await assert.rejects(() => fetchTavilySummary('good-key', 'Test'), /Tavily Monatslimit oder Rate-Limit erreicht/);
  });

  it('deduplicates simultaneous in-flight requests', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 15));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ answer: 'In-Flight Dedupe Success' })
      };
    };

    const [a, b] = await Promise.all([
      fetchTavilySummary('tvly-key', 'Parallel Request'),
      fetchTavilySummary('tvly-key', 'Parallel Request')
    ]);

    assert.equal(a, 'In-Flight Dedupe Success');
    assert.equal(b, 'In-Flight Dedupe Success');
    assert.equal(callCount, 1);
  });
});
