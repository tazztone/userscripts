import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmazonAsin, resolveAmazonAsin, clearMemoryAsinCache } from '../../src/page/product-offers.js';
import { getCachedAsin, setCachedAsin, clearPriceStatsCache, ASIN_CACHE_PREFIX } from '../../src/scanner/cache.js';
import { clearActivityLog, getActivityLog } from '../../src/state/activity-log.js';

function memStorage() {
  const map = new Map();
  return {
    getItem: k => map.has(k) ? map.get(k) : null,
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    clear: () => map.clear(),
    key: i => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; }
  };
}

describe('Amazon ASIN resolution and caching', () => {
  beforeEach(() => {
    clearMemoryAsinCache();
  });

  describe('parseAmazonAsin', () => {
    it('extracts ASIN from standard /dp/ URL', () => {
      assert.equal(parseAmazonAsin('https://www.amazon.de/dp/B0FHWR36F6/'), 'B0FHWR36F6');
      assert.equal(parseAmazonAsin('https://www.amazon.de/dp/b0fhwr36f6'), 'B0FHWR36F6');
      assert.equal(parseAmazonAsin('https://www.amazon.de/Thermaltake-Chassis/dp/B0FHWR36F6?ref=xyz'), 'B0FHWR36F6');
    });

    it('extracts ASIN from /gp/product/ URL', () => {
      assert.equal(parseAmazonAsin('https://www.amazon.de/gp/product/B0FPDFZKMH?tag=tp'), 'B0FPDFZKMH');
    });

    it('extracts ASIN from creativeASIN query parameter', () => {
      assert.equal(parseAmazonAsin('https://www.amazon.de/?creative=22662&creativeASIN=B0FHWR36F6&language=de_DE'), 'B0FHWR36F6');
    });

    it('extracts ASIN from asin query parameter', () => {
      assert.equal(parseAmazonAsin('https://www.amazon.de/deal?asin=B0FHWR36F6&tag=tp'), 'B0FHWR36F6');
    });

    it('returns null on invalid or non-Amazon URLs', () => {
      assert.equal(parseAmazonAsin(''), null);
      assert.equal(parseAmazonAsin(null), null);
      assert.equal(parseAmazonAsin('https://www.galaxus.ch/de/s1/product/12345'), null);
      assert.equal(parseAmazonAsin('/ext_de?pid=802723&did=150'), null);
    });
  });

  describe('ASIN cache storage', () => {
    it('sets and gets cached ASIN in storage', () => {
      const s = memStorage();
      assert.equal(getCachedAsin('p123', s), null);
      setCachedAsin('p123', 'B0FHWR36F6', s);
      assert.equal(getCachedAsin('p123', s), 'B0FHWR36F6');
    });

    it('clears ASIN cache on clearPriceStatsCache', () => {
      const s = memStorage();
      setCachedAsin('p123', 'B0FHWR36F6', s);
      assert.equal(getCachedAsin('p123', s), 'B0FHWR36F6');
      clearPriceStatsCache(s);
      assert.equal(getCachedAsin('p123', s), null);
    });
  });

  describe('resolveAmazonAsin', () => {
    it('returns immediately if directUrl contains inline ASIN', async () => {
      const s = memStorage();
      const asin = await resolveAmazonAsin('https://www.amazon.de/dp/B0FHWR36F6', 'p100', s);
      assert.equal(asin, 'B0FHWR36F6');
      assert.equal(getCachedAsin('p100', s), 'B0FHWR36F6');
    });

    it('uses cached ASIN if already present without hitting fetch', async () => {
      const s = memStorage();
      setCachedAsin('p200', 'B0FPDFZKMH', s);
      let fetchCalled = false;
      const fakeFetch = () => { fetchCalled = true; throw new Error('should not call'); };
      const asin = await resolveAmazonAsin('/ext_de?pid=200', 'p200', s, fakeFetch);
      assert.equal(asin, 'B0FPDFZKMH');
      assert.equal(fetchCalled, false);
    });

    it('resolves ASIN via redirect and caches result', async () => {
      const s = memStorage();
      const fakeFetch = async url => {
        assert.ok(url.includes('/ext_de?pid=300'));
        return {
          url: 'https://www.amazon.de/dp/B0FHWR36F6/ref=asc_df?tag=tp&creativeASIN=B0FHWR36F6'
        };
      };
      const asin = await resolveAmazonAsin('/ext_de?pid=300', 'p300', s, fakeFetch);
      assert.equal(asin, 'B0FHWR36F6');
      assert.equal(getCachedAsin('p300', s), 'B0FHWR36F6');
    });

    it('handles redirect failure gracefully', async () => {
      const s = memStorage();
      const fakeFetch = async () => { throw new Error('network down'); };
      const asin = await resolveAmazonAsin('/ext_de?pid=400', 'p400', s, fakeFetch);
      assert.equal(asin, null);
    });

    it('rejects targets on arbitrary external domains without fetching', async () => {
      const s = memStorage();
      let fetchCalled = false;
      const fakeFetch = () => { fetchCalled = true; return { url: 'https://evil.com/fake' }; };
      const asin = await resolveAmazonAsin('https://evil.com/ext_de?pid=500', 'p500', s, fakeFetch);
      assert.equal(asin, null);
      assert.equal(fetchCalled, false);
    });

    it('rejects redirect destinations on non-Amazon domains', async () => {
      const s = memStorage();
      const fakeFetch = async () => ({
        url: 'https://evil-tracker.com/redirect?asin=B0FHWR36F6'
      });
      const asin = await resolveAmazonAsin('/ext_de?pid=550', 'p550', s, fakeFetch);
      assert.equal(asin, null);
      assert.equal(getCachedAsin('p550', s), null);
    });

    it('deduplicates simultaneous in-flight ASIN lookups for the same product', async () => {
      const s = memStorage();
      let fetchCount = 0;
      const delayedFetch = async () => {
        fetchCount++;
        await new Promise(r => setTimeout(r, 20));
        return { url: 'https://www.amazon.de/dp/B0DEDUPAS1' };
      };
      const [res1, res2] = await Promise.all([
        resolveAmazonAsin('/ext_de?pid=600', 'p600', s, delayedFetch),
        resolveAmazonAsin('/ext_de?pid=600', 'p600', s, delayedFetch)
      ]);
      assert.equal(res1, 'B0DEDUPAS1');
      assert.equal(res2, 'B0DEDUPAS1');
      assert.equal(fetchCount, 1);
    });

    it('accepts amazon.fr targets and resolves ASIN', async () => {
      const s = memStorage();
      const res = await resolveAmazonAsin(
        'https://www.amazon.fr/dp/B0FRTEST12',
        'p601',
        s,
        async () => ({ url: 'https://www.amazon.fr/dp/B0FRTEST12' })
      );
      assert.equal(res, 'B0FRTEST12');
    });

    it('resolves ASIN via gmRequestWithTimeout when GM_xmlhttpRequest is available', async () => {
      const s = memStorage();
      const prevGM = globalThis.GM_xmlhttpRequest;
      let gmCalled = false;
      globalThis.GM_xmlhttpRequest = (opts) => {
        gmCalled = true;
        opts.onload({
          status: 200,
          finalUrl: 'https://www.amazon.de/dp/B0GMREQ123',
          responseHeaders: '',
        });
        return { abort() {} };
      };
      try {
        const res = await resolveAmazonAsin('/ext_de?pid=700', 'p700', s);
        assert.equal(gmCalled, true);
        assert.equal(res, 'B0GMREQ123');
        assert.equal(getCachedAsin('p700', s), 'B0GMREQ123');
      } finally {
        if (prevGM === undefined) delete globalThis.GM_xmlhttpRequest; else globalThis.GM_xmlhttpRequest = prevGM;
      }
    });

    it('treats GM_xmlhttpRequest 405 on redirected Amazon URL as non-warning and resolves ASIN', async () => {
      const s = memStorage();
      const prevGM = globalThis.GM_xmlhttpRequest;
      clearActivityLog();
      globalThis.GM_xmlhttpRequest = (opts) => {
        opts.onload({
          status: 405,
          finalUrl: 'https://www.amazon.de/dp/B0HEAD405X',
          responseHeaders: '',
        });
        return { abort() {} };
      };
      try {
        const res = await resolveAmazonAsin('/ext_de?pid=701', 'p701', s);
        assert.equal(res, 'B0HEAD405X');
        assert.equal(getCachedAsin('p701', s), 'B0HEAD405X');
        const warns = getActivityLog().filter(e => e.source === 'asin' && e.level === 'warn');
        assert.equal(warns.length, 0);
      } finally {
        clearActivityLog();
        if (prevGM === undefined) delete globalThis.GM_xmlhttpRequest; else globalThis.GM_xmlhttpRequest = prevGM;
      }
    });

    it('still logs warn when GM_xmlhttpRequest 405 does not redirect to an allowed Amazon domain', async () => {
      const s = memStorage();
      const prevGM = globalThis.GM_xmlhttpRequest;
      clearActivityLog();
      globalThis.GM_xmlhttpRequest = (opts) => {
        opts.onload({
          status: 405,
          finalUrl: 'https://www.toppreise.ch/ext_de?pid=702',
          responseHeaders: '',
        });
        return { abort() {} };
      };
      try {
        const res = await resolveAmazonAsin('/ext_de?pid=702', 'p702', s);
        assert.equal(res, null);
        const warns = getActivityLog().filter(e => e.source === 'asin' && e.level === 'warn');
        assert.equal(warns.length, 1);
      } finally {
        clearActivityLog();
        if (prevGM === undefined) delete globalThis.GM_xmlhttpRequest; else globalThis.GM_xmlhttpRequest = prevGM;
      }
    });

    it('resolves ASIN via fetch fallback on 405 Amazon redirect without logging warn', async () => {
      const s = memStorage();
      const prevGM = globalThis.GM_xmlhttpRequest;
      const prevFetch = globalThis.fetch;
      delete globalThis.GM_xmlhttpRequest;
      clearActivityLog();
      globalThis.fetch = async () => ({
        ok: false,
        status: 405,
        url: 'https://www.amazon.de/dp/B0FETCH405',
      });
      try {
        const res = await resolveAmazonAsin('/ext_de?pid=703', 'p703', s);
        assert.equal(res, 'B0FETCH405');
        assert.equal(getCachedAsin('p703', s), 'B0FETCH405');
        const warns = getActivityLog().filter(e => e.source === 'asin' && e.level === 'warn');
        assert.equal(warns.length, 0);
      } finally {
        clearActivityLog();
        if (prevGM === undefined) delete globalThis.GM_xmlhttpRequest; else globalThis.GM_xmlhttpRequest = prevGM;
        if (prevFetch === undefined) delete globalThis.fetch; else globalThis.fetch = prevFetch;
      }
    });
  });
});
