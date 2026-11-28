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
  pruneTavilyCache,
  buildTavilyQuery,
  expandKeywordWithPrice,
  formatSearchQuery,
  fetchTavilySummary
} from '../../src/features/tavily-search.js';

describe('tavily-search: query & normalization', () => {
  it('normalizes whitespace and trims', () => {
    assert.equal(normalizeTavilyQuery('  Sony   WH-1000XM5   Test  '), 'Sony WH-1000XM5 Test');
    assert.equal(tavilyCacheKey('  Sony   WH-1000XM5  '), 'sony wh-1000xm5');
  });

  it('expands price when present and cleans up question clause when absent', () => {
    const template = 'Testbericht Erfahrungen. Ist der Preis von {preis} ein guter Deal?';
    assert.equal(
      expandKeywordWithPrice(template, 'CHF 13.95'),
      'Testbericht Erfahrungen. Ist der Preis von CHF 13.95 ein guter Deal?'
    );
    assert.equal(
      expandKeywordWithPrice(template, ''),
      'Testbericht Erfahrungen'
    );
    assert.equal(
      expandKeywordWithPrice('Preiseinschätzung {preis}', ''),
      'Preiseinschätzung'
    );
    const newTemplate = 'Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.';
    assert.equal(
      expandKeywordWithPrice(newTemplate, 'CHF 13.95'),
      'Testberichte zu: [Produkt]. Ist der Preis von CHF 13.95 ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.'
    );
    assert.equal(
      expandKeywordWithPrice(newTemplate, ''),
      'Testberichte zu: [Produkt]. Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.'
    );
    assert.equal(
      expandKeywordWithPrice('Testberichte zu: [Produkt]. Ist {preis} ein guter Deal? Bewerte Stärken und Schwächen.', ''),
      'Testberichte zu: [Produkt]. Bewerte Stärken und Schwächen.'
    );
  });

  it('formats search query with product and price tokens', () => {
    const template = 'Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.';
    assert.equal(
      formatSearchQuery('MUSE M-272 BT', template, 'CHF 13.95'),
      'Testberichte zu: MUSE M-272 BT. Ist der Preis von CHF 13.95 ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.'
    );
    assert.equal(
      formatSearchQuery('MUSE M-272 BT', template, ''),
      'Testberichte zu: MUSE M-272 BT. Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.'
    );
    assert.equal(
      formatSearchQuery('MUSE M-272 BT', 'Testbericht', ''),
      'MUSE M-272 BT Testbericht'
    );
  });

  it('builds query with title, keyword and price', () => {
    const q1 = buildTavilyQuery('Roborock S8 Pro Ultra', 'Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.', 'CHF 899.00');
    assert.ok(q1.includes('Roborock S8 Pro Ultra'));
    assert.ok(q1.includes('CHF 899.00'));
    assert.ok(q1.includes('Preis-Leistung'));
    assert.ok(q1.includes('Deutsch'));

    const q2 = buildTavilyQuery('Apple iPad Air', 'Testbericht Erfahrungen. Ist der Preis von {preis} ein guter Deal?', '');
    assert.ok(q2.includes('Apple iPad Air'));
    assert.ok(q2.includes('Testbericht Erfahrungen'));
    assert.ok(!q2.includes('{preis}'));
    assert.ok(!q2.includes('Ist der Preis'));
    assert.ok(q2.includes('Deutsch'));

    assert.equal(expandKeywordWithPrice('Preis {Preis} gut?', 'CHF 42'), 'Preis CHF 42 gut?');
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

  it('pruneTavilyCache removes malformed/expired entries and evicts oldest beyond maxEntries', () => {
    const m = new Map();
    const store = {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => { m.set(k, String(v)); },
      removeItem: k => { m.delete(k); },
      key: i => [...m.keys()][i] ?? null,
      get length() { return m.size; },
    };
    const now = Date.now();
    store.setItem(`${TAVILY_CACHE_KEY_PREFIX}malformed`, '{bad json');
    store.setItem(`${TAVILY_CACHE_KEY_PREFIX}expired`, JSON.stringify({ answer: 'old', timestamp: now - TAVILY_CACHE_TTL_MS - 1000 }));
    store.setItem(`${TAVILY_CACHE_KEY_PREFIX}oldest`, JSON.stringify({ answer: '1', timestamp: now - 3000 }));
    store.setItem(`${TAVILY_CACHE_KEY_PREFIX}middle`, JSON.stringify({ answer: '2', timestamp: now - 2000 }));
    store.setItem(`${TAVILY_CACHE_KEY_PREFIX}newest`, JSON.stringify({ answer: '3', timestamp: now - 1000 }));
    store.setItem('unrelated_key', 'keep-me');

    const removed = pruneTavilyCache(2, store);
    assert.equal(removed, 3);
    assert.equal(store.getItem(`${TAVILY_CACHE_KEY_PREFIX}malformed`), null);
    assert.equal(store.getItem(`${TAVILY_CACHE_KEY_PREFIX}expired`), null);
    assert.equal(store.getItem(`${TAVILY_CACHE_KEY_PREFIX}oldest`), null);
    assert.ok(store.getItem(`${TAVILY_CACHE_KEY_PREFIX}middle`));
    assert.ok(store.getItem(`${TAVILY_CACHE_KEY_PREFIX}newest`));
    assert.equal(store.getItem('unrelated_key'), 'keep-me');
  });

  it('setCachedTavily retries with pruneTavilyCache(50) on QuotaExceededError', () => {
    const m = new Map();
    const now = Date.now();
    for (let i = 0; i < 60; i++) {
      m.set(`${TAVILY_CACHE_KEY_PREFIX}old_${i}`, JSON.stringify({ answer: `a${i}`, timestamp: now - (60 - i) * 1000 }));
    }
    let quotaThrown = false;
    const store = {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => {
        if (!quotaThrown) {
          quotaThrown = true;
          const e = new Error('quota');
          e.name = 'QuotaExceededError';
          throw e;
        }
        m.set(k, String(v));
      },
      removeItem: k => { m.delete(k); },
      key: i => [...m.keys()][i] ?? null,
      get length() { return m.size; },
    };
    setCachedTavily('New Query', 'New Answer', store);
    assert.equal(quotaThrown, true);
    assert.ok(store.getItem(`${TAVILY_CACHE_KEY_PREFIX}new query`));
    assert.equal(m.size, 51);
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
      assert.equal(opts.headers['Authorization'], 'Bearer tvly-secret');
      assert.equal(parsed.api_key, undefined);
      assert.equal(parsed.search_depth, 'basic');
      assert.equal(parsed.include_answer, true);
      assert.equal(parsed.language, 'de');

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

  it('passes customized searchDepth and maxResults in request payload', async () => {
    let capturedBody = null;
    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ answer: 'Antwort' })
      };
    };

    await fetchTavilySummary('tvly-secret', 'Custom Query', { searchDepth: 'advanced', maxResults: 8 });
    assert.equal(capturedBody.search_depth, 'advanced');
    assert.equal(capturedBody.max_results, 8);
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

  it('does not share shorter-timeout or different-depth in-flight requests', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 15));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ answer: `Answer ${callCount}` })
      };
    };

    const [a, b] = await Promise.all([
      fetchTavilySummary('tvly-key', 'Isolated Timeout', { timeoutMs: 4000, searchDepth: 'basic' }),
      fetchTavilySummary('tvly-key', 'Isolated Timeout', { timeoutMs: 60000, searchDepth: 'basic' })
    ]);

    assert.equal(callCount, 2);
    assert.ok(a.startsWith('Answer '));
    assert.ok(b.startsWith('Answer '));
  });

  it('formatSearchQuery preserves $ patterns in title and priceText', async () => {
    const { formatSearchQuery } = await import('../../src/features/tavily-search.js');
    const out = formatSearchQuery('Phone $$ $& $1', 'Preis {preis} für {produkt}', 'CHF $100');
    assert.ok(out.includes('Phone $$ $& $1'));
    assert.ok(out.includes('CHF $100'));
  });

  it('fetchTavilySummary isolates cache across searchDepth and maxResults', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return { ok: true, status: 200, text: async () => JSON.stringify({ answer: `Depth ${calls}` }) };
    };
    const r1 = await fetchTavilySummary('tvly-key', 'Cache Depth Isolation', { searchDepth: 'basic', maxResults: 5 });
    const r2 = await fetchTavilySummary('tvly-key', 'Cache Depth Isolation', { searchDepth: 'advanced', maxResults: 10 });
    assert.equal(calls, 2);
    assert.notEqual(r1, r2);
  });

  it('rejects whitespace-only fallback snippet instead of caching empty string', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ answer: '   ', results: [{ content: '   \n\t  ' }] })
    });
    await assert.rejects(() => fetchTavilySummary('tvly-key', 'Whitespace Snippet'), /Kein Fazit erhalten/);
    assert.equal(getCachedTavily('Whitespace Snippet'), null);
  });
});
