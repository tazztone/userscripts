import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractShareData,
  extractCheapestDealerRow,
  isAllowedAmazonUrl,
  resolveAmazonAsin,
  parseJsonLdOffer,
  parseProductOffers,
  fetchProductInfo,
} from '../../src/page/product-offers.js';
import { resetOriginCooldown } from '../../src/state/net.js';

describe('product-offers module', () => {
  it('extractShareData skips data: image src and resolves relative URLs with toppreise fallback', () => {
    const prevLoc = globalThis.location;
    delete globalThis.location;
    try {
      const card = {
        querySelector: (sel) => {
          if (sel.includes('img')) {
            return {
              currentSrc: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
              src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
              getAttribute: (k) => (k === 'data-src' ? '/img/prod.jpg' : null),
            };
          }
          if (sel.includes('a[')) {
            return { getAttribute: () => '/preisvergleich/Cat/Prod-p123', textContent: 'Prod 123' };
          }
          return null;
        },
        querySelectorAll: () => [],
      };
      const data = extractShareData(card);
      assert.equal(data.imageUrl, 'https://www.toppreise.ch/img/prod.jpg');
      assert.equal(data.url, 'https://www.toppreise.ch/preisvergleich/Cat/Prod-p123');
    } finally {
      if (prevLoc !== undefined) globalThis.location = prevLoc;
    }
  });

  it('extractCheapestDealerRow picks lowest priced row or falls back to first row', () => {
    const row1 = { querySelector: () => ({ textContent: 'CHF 120.00' }) };
    const row2 = { querySelector: () => ({ textContent: 'CHF 99.00' }) };
    const card = { querySelectorAll: () => [row1, row2] };
    assert.equal(extractCheapestDealerRow(card), row2);
  });

  it('isAllowedAmazonUrl and resolveAmazonAsin gate inline ASINs on allowed Amazon hosts', async () => {
    assert.equal(isAllowedAmazonUrl('https://www.amazon.de/dp/B08N5WRWNW'), true);
    assert.equal(isAllowedAmazonUrl('http://amazon.de/dp/B08N5WRWNW'), true);
    assert.equal(isAllowedAmazonUrl('https://evil.example.com/dp/B08N5WRWNW'), false);
    assert.equal(isAllowedAmazonUrl('javascript:alert(1)'), false);
    assert.equal(isAllowedAmazonUrl('ftp://amazon.de/dp/B08N5WRWNW'), false);
    assert.equal(isAllowedAmazonUrl('data:text/html,<script>1</script>'), false);
    assert.equal(isAllowedAmazonUrl('amazon.de/dp/B08N5WRWNW'), false);
    const blocked = await resolveAmazonAsin('https://evil.example.com/dp/B08N5WRWNW', 'p-blocked');
    assert.equal(blocked, null);
  });

  it('parseJsonLdOffer handles single-object AggregateOffer.offers and empty @graph AggregateOffer', () => {
    const single = parseJsonLdOffer({
      '@type': 'Product',
      offers: {
        '@type': 'AggregateOffer',
        offerCount: 5,
        offers: { '@type': 'Offer', price: 42, seller: { name: 'Digitec' } },
      },
    });
    assert.equal(single.dealer, 'Digitec');
    assert.equal(single.totalOffers, 5);

    const graph = parseJsonLdOffer({
      '@graph': [
        { '@type': 'Product', offers: { '@type': 'AggregateOffer', offerCount: 0 } },
        { '@type': 'Product', offers: [{ '@type': 'Offer', price: 50, seller: 'Galaxus' }] },
      ],
    });
    assert.equal(graph.dealer, 'Galaxus');
  });

  it('extractShareData supports /price-comparison/, /comparateur-de-prix/, and data-link fallback', () => {
    const prevLoc = globalThis.location;
    delete globalThis.location;
    try {
      for (const path of ['/price-comparison/Mice/Prod-p123', '/comparateur-de-prix/Souris/Prod-p123']) {
        const card = {
          getAttribute: (k) => (k === 'data-link' ? path : null),
          querySelector: () => null,
          querySelectorAll: () => [],
        };
        const data = extractShareData(card);
        assert.equal(data.url, `https://www.toppreise.ch${path}`);
      }
    } finally {
      if (prevLoc !== undefined) globalThis.location = prevLoc;
    }
  });

  it('parseProductOffers falls back to shop link/tooltip text and data-link when img[alt] is absent', () => {
    const doc = {
      querySelectorAll: (sel) => {
        if (sel !== '.Plugin_Offer') return [];
        return [{
          getAttribute: (k) => (k === 'data-link' ? '/ext_de-shop1' : null),
          querySelector: (s) => {
            if (s === '.AbstractTooltip_ShopRatingDetailsTooltip[title]') {
              return { getAttribute: () => 'Shopbewertungen für Brack.ch' };
            }
            if (s.includes('productPrice')) return { textContent: 'CHF 49.00' };
            if (s.includes('shippingPrice')) return { textContent: 'CHF 55.00' };
            return null;
          },
        }];
      },
    };
    const offers = parseProductOffers(doc);
    assert.equal(offers.length, 1);
    assert.equal(offers[0].dealer, 'Brack.ch');
    assert.equal(offers[0].url, '/ext_de-shop1');
    assert.equal(offers[0].product, 49);
    assert.equal(offers[0].shipping, 55);
  });

  it('fetchProductInfo retries on 429/5xx, does not retry on 404, and preserves return shape', async () => {
    const prevFetch = globalThis.fetch;
    const prevParser = globalThis.DOMParser;
    resetOriginCooldown();
    globalThis.DOMParser = class {
      parseFromString() {
        return {
          querySelectorAll: (sel) => {
            if (sel === 'script[type="application/ld+json"]') {
              return [{
                textContent: JSON.stringify({
                  '@type': 'Product',
                  offers: [{ '@type': 'Offer', price: 88, seller: { name: 'Digitec' } }],
                }),
              }];
            }
            return [];
          },
        };
      }
    };
    try {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        if (calls === 1) return { ok: false, status: 429, headers: { get: () => '0' }, text: async () => '' };
        return { ok: true, status: 200, text: async () => '<html></html>' };
      };
      const res429 = await fetchProductInfo('https://www.toppreise.ch/preisvergleich/Cat/Prod-p1', 2000, false);
      assert.equal(calls, 2);
      assert.deepEqual(res429, { dealer: 'Digitec', offers: 1, dealerUrl: '', totalOffers: 0 });

      calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return { ok: false, status: 404, text: async () => '' };
      };
      const res404 = await fetchProductInfo('https://www.toppreise.ch/preisvergleich/Cat/Prod-p2', 2000, false);
      assert.equal(calls, 1);
      assert.deepEqual(res404, { dealer: '', offers: 0, dealerUrl: '', totalOffers: 0 });
    } finally {
      resetOriginCooldown();
      globalThis.fetch = prevFetch;
      if (prevParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = prevParser;
    }
  });
});
