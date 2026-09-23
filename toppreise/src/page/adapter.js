/**
 * Semantic Page Adapter Layer
 * Encapsulates host-page context detection, semantic DOM element resolution,
 * price extraction from detail views, and cache invalidation.
 */

import { CONFIG } from '../state/config.js';
import { parsePrice } from '../domain/price.js';
import { getProductCards } from './cards.js';

export function clearCardCache(card) {
  if (!card) return;
  delete card._tpDealerRows;
  delete card._tpTextLower;
  delete card._tpPriceInfo;
}

export function isShippingPriceActive(card = null) {
  if (!CONFIG.USE_SHIPPING_PRICE) return false;
  if (typeof document !== 'undefined' && document.body) {
    if (document.body.classList.contains('showproductprice')) return false;
    if (document.body.classList.contains('showshippingprice')) return true;
  }
  if (card) {
    const shp = card._tpPriceInfo?.mainShipping || card._tpPriceInfo?.fallbackShipping || card.querySelector?.('.priceContainer.shippingPrice');
    const prd = card._tpPriceInfo?.mainProduct || card._tpPriceInfo?.fallbackProduct || card.querySelector?.('.priceContainer.productPrice');
    if (shp && prd) {
      const shpContainer = shp.closest ? shp.closest('.shippingPrice') : null;
      if (shpContainer && (shpContainer.offsetParent === null || shpContainer.style.display === 'none')) {
        return false;
      }
    }
  }
  return true;
}

export function isNeueToppreisePage() {
  if (document.body?.classList.contains('Page_Browsing') || document.body?.classList.contains('Page_ProductSearch')) {
    return false;
  }
  const currentUrl = document.body?.getAttribute('data-current_url') ?? document.body?.getAttribute('data-current-url');
  if (currentUrl !== undefined && currentUrl !== null) {
    if (/(?:produktsuche|katalog|search|suche)/i.test(currentUrl)) return false;
    if (/(?:neue-toppreise|new-best-prices|nouveaux-meilleurs-prix)/i.test(currentUrl)) return true;
  }
  return /(?:neue-toppreise|new-best-prices|nouveaux-meilleurs-prix)/i.test(location.href) ||
         document.body?.classList.contains('Page_ListTopPriceReductionProducts') ||
         document.body?.classList.contains('Page_ListTop100Products');
}

export function getDetailProductId() {
  const match = location.href.match(/-p(\d+)/i) || (document.body?.getAttribute('data-current_url') || '').match(/-p(\d+)/i);
  if (match) return match[1];
  const chartLink = document.querySelector('a[href*="pricechart"], a[href*="p_pc_pid="]');
  if (chartLink) {
    const m = chartLink.href.match(/p_pc_pid=(\d+)/i);
    if (m) return m[1];
  }
  const chartForm = document.querySelector('form[action*="pricechart"] input[name*="pid"], input[name="p_pc_pid"]');
  if (chartForm && chartForm.value) return chartForm.value;
  return null;
}

export function getDetailLowestPrice() {
  const priceEl = document.querySelector('.productPrice .Plugin_Price, .product_price .Plugin_Price, .lowestPrice .Plugin_Price, .priceComparison .Plugin_Price, .tableDealerPriceList .Plugin_Price, .Plugin_Price');
  return priceEl ? parsePrice(priceEl.textContent) : 0;
}

export function isProductDetailPage() {
  return /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(location.href) ||
         /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(document.body?.getAttribute('data-current_url') || '') ||
         document.body?.classList.contains('Page_Product') ||
         document.body?.classList.contains('Page_DetailProduct') ||
         !!document.querySelector('.Page_DetailProduct, #Page_DetailProduct, .product_detail_page, .Page_Product') ||
         (!!document.querySelector('.Plugin_ProductHeading h1, .productHeading h1, .product_title h1, h1.productTitle') && !!getDetailProductId());
}

export function getPageType() {
  if (isProductDetailPage()) return 'detail';
  if (isNeueToppreisePage()) return 'deal-feed';
  return 'list';
}

export function getListingCards() {
  return getProductCards();
}

export function getResultContainer() {
  return document.querySelector('#Page_ListTopPriceReductionProducts, #Page_ListTop100Products, [id^="Page_List"], #Page_Browsing, .f_browsingListContainer, #Plugin_MixedBrowsingList, .standardList, #product-list');
}

