import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmazonAsin, resolveAmazonAsin, clearMemoryAsinCache } from '../../src/page/product-offers.js';
import { getCachedAsin, setCachedAsin, clearPriceStatsCache, ASIN_CACHE_PREFIX } from '../../src/scanner/cache.js';

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
  });
});
