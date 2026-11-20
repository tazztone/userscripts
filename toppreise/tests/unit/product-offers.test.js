import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractShareData,
  extractCheapestDealerRow,
  isAllowedAmazonUrl,
  resolveAmazonAsin,
  parseJsonLdOffer,
} from '../../src/page/product-offers.js';

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
    assert.equal(isAllowedAmazonUrl('https://evil.example.com/dp/B08N5WRWNW'), false);
    const blocked = await resolveAmazonAsin('p-blocked', 'https://evil.example.com/dp/B08N5WRWNW');
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
});
