import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCardCache,
  isShippingPriceActive,
  isNeueToppreisePage,
  isProductDetailPage,
  getDetailProductId,
  getDetailLowestPrice,
  triggerProcessListings
} from '../../src/page/adapter.js';
import { withConfig } from './helpers.js';

describe('Page Adapter Layer', () => {
  describe('clearCardCache', () => {
    it('safely handles null/undefined cards', () => {
      assert.equal(clearCardCache(null), undefined);
      assert.equal(clearCardCache(undefined), undefined);
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
      withConfig('USE_SHIPPING_PRICE', false, () => {
        assert.equal(isShippingPriceActive(), false);
      });
    });
  });

  describe('Page detection & URL patterns', () => {
    let realDocument;
    let realLocation;
    beforeEach(() => {
      realDocument = globalThis.document;
      realLocation = globalThis.location;
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
    afterEach(() => {
      if (realDocument === undefined) delete globalThis.document; else globalThis.document = realDocument;
      if (realLocation === undefined) delete globalThis.location; else globalThis.location = realLocation;
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
      withConfig('USE_SHIPPING_PRICE', false, () => {
        assert.deepEqual(getDetailLowestPrice(), { price: 899, basis: 'product' });
      });
      assert.ok(queried.length >= 1);
      assert.ok(queried.every(sel => !sel.includes(',')));
    });

    it('falls back through the selector list and returns 0 when nothing matches', () => {
      globalThis.document = { querySelector: () => null };
      withConfig('USE_SHIPPING_PRICE', false, () => {
        assert.deepEqual(getDetailLowestPrice(), { price: 0, basis: null });
      });
    });

    it('never falls back to product prices when shipping is active', () => {
      const queried = [];
      globalThis.document = {
        querySelector: sel => {
          queried.push(sel);
          if (sel === '.productPrice .Plugin_Price') return { textContent: 'CHF 39.00' };
          return null;
        }
      };
      withConfig('USE_SHIPPING_PRICE', true, () => {
        assert.deepEqual(getDetailLowestPrice(), { price: 0, basis: null });
      });
      assert.ok(queried.every(sel => !sel.includes('.productPrice')));
    });

    it('returns the shipping basis when shipping is active', () => {
      globalThis.document = {
        querySelector: sel => (sel === '.shippingPrice .Plugin_Price' ? { textContent: 'CHF 45.00' } : null)
      };
      withConfig('USE_SHIPPING_PRICE', true, () => {
        assert.deepEqual(getDetailLowestPrice(), { price: 45, basis: 'shipping' });
      });
      delete globalThis.document;
    });
  });

  describe('triggerProcessListings', () => {
    let origWindow;
    let origLocation;
    let origDoc;

    beforeEach(() => {
      origWindow = globalThis.window;
      origLocation = globalThis.location;
      origDoc = globalThis.document;
    });

    afterEach(() => {
      if (origWindow === undefined) delete globalThis.window; else globalThis.window = origWindow;
      if (origLocation === undefined) delete globalThis.location; else globalThis.location = origLocation;
      if (origDoc === undefined) delete globalThis.document; else globalThis.document = origDoc;
    });

    it('triggers processListings and priceAlarmModal on search/feed pages', () => {
      let listingsCalled = 0;
      let detailCalled = 0;
      let alarmCalled = 0;
      globalThis.window = {
        ToppreiseSuite: {
          processListings: () => { listingsCalled++; },
          processProductDetailPage: () => { detailCalled++; },
          processPriceAlarmModal: () => { alarmCalled++; }
        }
      };
      globalThis.location = { href: 'https://www.toppreise.ch/katalog' };
      globalThis.document = {
        body: { classList: { contains: () => false }, getAttribute: () => null },
        querySelector: () => null,
        querySelectorAll: () => []
      };

      triggerProcessListings();

      assert.equal(listingsCalled, 1);
      assert.equal(detailCalled, 0);
      assert.equal(alarmCalled, 1);
    });

    it('triggers processListings, processProductDetailPage, and priceAlarmModal on detail pages', () => {
      let listingsCalled = 0;
      let detailCalled = 0;
      let alarmCalled = 0;
      globalThis.window = {
        ToppreiseSuite: {
          processListings: () => { listingsCalled++; },
          processProductDetailPage: () => { detailCalled++; },
          processPriceAlarmModal: () => { alarmCalled++; }
        }
      };
      globalThis.location = { href: 'https://www.toppreise.ch/preisvergleich/Smartphones/APPLE-iPhone-16-Pro-p789012' };
      globalThis.document = {
        body: { classList: { contains: () => false }, getAttribute: () => null },
        querySelector: () => null,
        querySelectorAll: () => []
      };

      triggerProcessListings();

      assert.equal(listingsCalled, 1);
      assert.equal(detailCalled, 1);
      assert.equal(alarmCalled, 1);
    });
  });
});

