import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCardCache,
  isShippingPriceActive,
  isNeueToppreisePage,
  isProductDetailPage,
  getPageType,
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
      CONFIG.USE_SHIPPING_PRICE = false;
      assert.equal(isShippingPriceActive(), false);
      CONFIG.USE_SHIPPING_PRICE = true;
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

    it('identifies standard listing pages as list type', () => {
      assert.equal(getPageType(), 'list');
    });

    it('identifies product detail URL as detail page', () => {
      globalThis.location = { href: 'https://www.toppreise.ch/preisvergleich/Smartphones/APPLE-iPhone-16-Pro-p789012' };
      assert.equal(isProductDetailPage(), true);
      assert.equal(getPageType(), 'detail');
      assert.equal(getDetailProductId(), '789012');
    });

    it('identifies Neue Toppreise feed pages correctly', () => {
      globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise' };
      assert.equal(isNeueToppreisePage(), true);
      assert.equal(getPageType(), 'deal-feed');
    });
  });
});

