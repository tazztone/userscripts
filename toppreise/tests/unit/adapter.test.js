import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCardCache,
  isShippingPriceActive,
  isNeueToppreisePage,
  isProductDetailPage,
  getDetailProductId,
  getDetailLowestPrice
} from '../../src/page/adapter.js';
import { CONFIG } from '../../src/state/config.js';

describe('Page Adapter Layer', () => {
  describe('clearCardCache', () => {
    it('safely handles null/undefined cards', () => {
      assert.doesNotThrow(() => clearCardCache(null));
      assert.doesNotThrow(() => clearCardCache(undefined));
    });

    it('clears memoized properties on card element', () => {
      const card = {
        _tpDealerRows: [{ storeName: 'Galaxus' }],
        _tpTextLower: 'iphone 15 pro',
        _tpPriceInfo: { mainProduct: {} },
        dataset: {}
      };
      clearCardCache(card);
      assert.equal(card._tpDealerRows, undefined);
      assert.equal(card._tpTextLower, undefined);
      assert.equal(card._tpPriceInfo, undefined);
    });
  });

  describe('isShippingPriceActive', () => {
    it('returns false when CONFIG.USE_SHIPPING_PRICE is disabled', () => {
      const prev = CONFIG.USE_SHIPPING_PRICE;
      CONFIG.USE_SHIPPING_PRICE = false;
      try {
        assert.equal(isShippingPriceActive(), false);
      } finally {
        CONFIG.USE_SHIPPING_PRICE = prev;
      }
    });
  });

  describe('Page detection & URL patterns', () => {
    beforeEach(() => {
      globalThis.document = {
        body: {
          classList: { contains: () => false },
          getAttribute: () => null
        },
        querySelector: () => null,
        querySelectorAll: () => []
      };
      globalThis.location = { href: 'https://www.toppreise.ch/katalog' };
    });

    it('identifies standard listing pages via predicates', () => {
      assert.equal(isProductDetailPage(), false);
    });

    it('identifies product detail URL as detail page', () => {
      globalThis.location = { href: 'https://www.toppreise.ch/preisvergleich/Smartphones/APPLE-iPhone-16-Pro-p789012' };
      assert.equal(isProductDetailPage(), true);
      assert.equal(isNeueToppreisePage(), false);
      assert.equal(getDetailProductId(), '789012');
    });

    it('identifies Neue Toppreise feed pages correctly', () => {
      globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise' };
      assert.equal(isNeueToppreisePage(), true);
      assert.equal(isProductDetailPage(), false);
    });
  });

  describe('getDetailLowestPrice selector priority', () => {
    it('prefers scoped product-price selectors over a stray early generic match', () => {
      const queried = [];
      globalThis.document = {
        querySelector: sel => {
          queried.push(sel);
          // Simulate document order winning a grouped query: the generic
          // match appears first in the DOM, the scoped one is correct.
          if (sel.includes(',')) return { textContent: 'CHF 999.–' };
          if (sel === '.productPrice .Plugin_Price') return { textContent: 'CHF 899.–' };
          return null;
        }
      };
      assert.equal(getDetailLowestPrice(), 899);
      assert.ok(queried.length >= 1);
      assert.ok(queried.every(sel => !sel.includes(',')));
    });

    it('falls back through the selector list and returns 0 when nothing matches', () => {
      globalThis.document = { querySelector: () => null };
      assert.equal(getDetailLowestPrice(), 0);
    });
  });
});

