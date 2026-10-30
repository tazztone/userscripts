/**
 * Semantic Page Adapter Layer
 * Encapsulates host-page context detection, semantic DOM element resolution,
 * price extraction from detail views, and cache invalidation.
 */

import { CONFIG } from '../state/config.js';
import { parsePrice } from '../domain/price.js';

export function clearCardCache(card) {
  if (!card) return;
  delete card._tpDealerRows;
  delete card._tpTextLower;
  delete card._tpPriceInfo;
  delete card._tpUseShipping;
  if (card.dataset) {
    delete card.dataset.tpOfferCount;
    delete card.dataset.tpDiff;
    delete card.dataset.tpDiscount;
    delete card.dataset.tpProductId;
    delete card.dataset.tpAppliedHeat;
  }
}

export function isShippingPriceActive(card = null) {
  if (!CONFIG.USE_SHIPPING_PRICE) return false;
  if (typeof document !== 'undefined' && document.body?.classList?.contains('showproductprice')) {
    return false;
  }
  if (card) {
    if (typeof card._tpUseShipping === 'boolean') {
      return card._tpUseShipping;
    }
    const shp = card._tpPriceInfo?.mainShipping || card._tpPriceInfo?.fallbackShipping || card.querySelector?.('.priceContainer.shippingPrice');
    const prd = card._tpPriceInfo?.mainProduct || card._tpPriceInfo?.fallbackProduct || card.querySelector?.('.priceContainer.productPrice');
    if (shp && prd) {
      const shpContainer = shp.closest ? shp.closest('.shippingPrice') : null;
      const prdContainer = prd.closest ? prd.closest('.productPrice') : null;
      if (shpContainer) {
        if (card.classList?.contains('tp-filtered') && card.offsetParent === null) return true;
        if (shpContainer.style?.display === 'none' || shpContainer.classList?.contains('d-none')) {
          card._tpUseShipping = false;
          return false;
        }
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
          try {
            if (window.getComputedStyle(shpContainer).display === 'none') {
              card._tpUseShipping = false;
              return false;
            }
          } catch { /* ignore */ }
        }
        if (shpContainer.offsetParent === null && prdContainer?.offsetParent !== null) {
          card._tpUseShipping = false;
          return false;
        }
      }
    }
    card._tpUseShipping = true;
    return true;
  }
  if (typeof document !== 'undefined' && document.body?.classList?.contains('showshippingprice')) {
    return true;
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
  return (typeof location !== 'undefined' && /(?:neue-toppreise|new-best-prices|nouveaux-meilleurs-prix)/i.test(location.href)) ||
         document.body?.classList.contains('Page_ListTopPriceReductionProducts') ||
         document.body?.classList.contains('Page_ListTop100Products');
}
export function isSearchPage() {
  const currentUrl = document.body?.getAttribute('data-current_url') ?? document.body?.getAttribute('data-current-url') ?? (typeof location !== 'undefined' ? location.href : '');
  return /(?:produktsuche|productsearch)/i.test(currentUrl || '');
}

export function getDetailProductId() {
  const match = (typeof location !== 'undefined' && location.href.match(/-p(\d+)/i)) || (document.body?.getAttribute('data-current_url') || '').match(/-p(\d+)/i);
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
  const shipping = isShippingPriceActive();
  const productFirst = ['.productPrice .Plugin_Price', '.product_price .Plugin_Price', '.lowestPrice .Plugin_Price', '.priceComparison .Plugin_Price', '.tableDealerPriceList .Plugin_Price', '.Plugin_Price'];
  const selectors = shipping ? ['.shippingPrice .Plugin_Price'] : productFirst;
  for (const sel of selectors) {
    const priceEl = document.querySelector(sel);
    if (priceEl) return { price: parsePrice(priceEl.textContent), basis: shipping ? 'shipping' : 'product' };
  }
  return { price: 0, basis: null };
}

export function isProductDetailPage() {
  return (typeof location !== 'undefined' && /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(location.href)) ||
         /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(document.body?.getAttribute('data-current_url') || '') ||
         document.body?.classList.contains('Page_Product') ||
         document.body?.classList.contains('Page_DetailProduct') ||
         !!document.querySelector('.Page_DetailProduct, #Page_DetailProduct, .product_detail_page, .Page_Product') ||
         (!!document.querySelector('.Plugin_ProductHeading h1, .productHeading h1, .product_title h1, h1.productTitle') && !!getDetailProductId());
}


export function triggerProcessListings() {
  // Suite handle first so spies observe observer-triggered renders; in
  // production both references resolve to the same function.
  if (typeof window !== 'undefined' && typeof window.ToppreiseSuite?.processListings === 'function') {
    window.ToppreiseSuite.processListings();
  } else if (typeof processListings === 'function') {
    processListings();
  }
  if (isProductDetailPage()) {
    if (typeof window !== 'undefined' && typeof window.ToppreiseSuite?.processProductDetailPage === 'function') {
      window.ToppreiseSuite.processProductDetailPage();
    } else if (typeof processProductDetailPage === 'function') {
      processProductDetailPage();
    }
  }
  if (typeof window !== 'undefined' && typeof window.ToppreiseSuite?.processPriceAlarmModal === 'function') {
    window.ToppreiseSuite.processPriceAlarmModal();
  } else if (typeof processPriceAlarmModal === 'function') {
    processPriceAlarmModal();
  }
}

// Trailing 50 ms debounce (not rAF: rAF stalls in background tabs). Parallel
// completions (dealer autofetch) collapse into one render.
let tpRenderPending = false;
export function scheduleProcessListings() {
  if (tpRenderPending) return;
  tpRenderPending = true;
  setTimeout(() => { tpRenderPending = false; triggerProcessListings(); }, 50);
}

