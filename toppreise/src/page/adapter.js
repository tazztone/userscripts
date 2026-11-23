/**
 * Semantic Page Adapter Layer
 * Encapsulates host-page context detection, semantic DOM element resolution,
 * price extraction from detail views, and cache invalidation.
 */

import { CONFIG } from '../state/config.js';
import { parsePrice } from '../domain/price.js';
import { SELECTORS } from './selectors.js';

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
    if (!shp && prd) {
      card._tpUseShipping = false;
      return false;
    }
    if (shp && prd) {
      const shpContainer = shp.closest ? shp.closest('.shippingPrice') : null;
      const prdContainer = prd.closest ? prd.closest('.productPrice') : null;
      if (shpContainer) {
        if (shpContainer.style?.display === 'none' || shpContainer.classList?.contains('d-none')) {
          card._tpUseShipping = false;
          return false;
        }
        if (typeof shpContainer.offsetParent !== 'undefined') {
          if (shpContainer.offsetParent === null && prdContainer?.offsetParent !== null) {
            card._tpUseShipping = false;
            return false;
          }
          if (shpContainer.isConnected && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            try {
              if (window.getComputedStyle(shpContainer).display === 'none') {
                card._tpUseShipping = false;
                return false;
              }
            } catch { /* ignore */ }
          }
        } else if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
          try {
            if (window.getComputedStyle(shpContainer).display === 'none') {
              card._tpUseShipping = false;
              return false;
            }
          } catch { /* ignore */ }
        }
        if (card.classList?.contains('tp-filtered') && card.offsetParent === null) return true;
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

export function getPageProfileType(url = null) {
  if (typeof url === 'string' && url) {
    if (/(?:produktsuche|katalog|search|suche)/i.test(url)) return 'search';
    if (/(?:neue-toppreise|new-best-prices|nouveaux-meilleurs-prix)/i.test(url)) return 'neue';
    return 'search';
  }
  return isNeueToppreisePage() ? 'neue' : 'search';
}

export function getPageProfileLabel(type = getPageProfileType()) {
  return type === 'neue' ? '⚡ Neue Toppreise' : '🔍 Suche & Katalog';
}

export function getDetailProductId() {
  const currentUrl = typeof document !== 'undefined'
    ? (document.body?.getAttribute('data-current_url') || document.body?.getAttribute('data-current-url') || '')
    : '';
  const match = (typeof location !== 'undefined' && location.href.match(/-p(\d+)(?:[/?#]|$)/i)) || currentUrl.match(/-p(\d+)(?:[/?#]|$)/i);
  if (match) return match[1];
  if (typeof document === 'undefined') return null;
  const chartLink = document.querySelector('a[href*="pricechart"], a[href*="p_pc_pid="]');
  if (chartLink) {
    const m = chartLink.href.match(/p_pc_pid=(\d+)/i);
    if (m) return m[1];
  }
  const chartForm = document.querySelector('form[action*="pricechart"] input[name*="pid"], input[name="p_pc_pid"]');
  if (chartForm && chartForm.value) return chartForm.value;
  return null;
}

const DETAIL_EXCLUDED_PARENTS = `${SELECTORS.cards.excludedParents}, .Plugin_Product, .mixedBrowsingListProduct, .price_information_product_small, .small-box`;

function queryDetailPriceEl(sel, { skipShipping = false } = {}) {
  if (typeof document.querySelectorAll === 'function') {
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest?.(DETAIL_EXCLUDED_PARENTS)) continue;
      if (skipShipping && el.closest?.('.shippingPrice')) continue;
      if (parsePrice(el.textContent) > 0) return el;
    }
    return null;
  }
  const el = document.querySelector(sel);
  if (!el || el.closest?.(DETAIL_EXCLUDED_PARENTS) || (skipShipping && el.closest?.('.shippingPrice'))) return null;
  return el;
}

export function getDetailLowestPrice() {
  const shipping = isShippingPriceActive();
  const productFirst = [
    '.f_productHeadPrice .productPrice .Plugin_Price',
    '.Plugin_ProductDetailsInfo .productPrice .Plugin_Price',
    '.price_information_product .productPrice .Plugin_Price',
    '.productPrice .Plugin_Price',
    '.product_price .Plugin_Price',
    '.lowestPrice .Plugin_Price',
    '.priceComparison .Plugin_Price',
    '.tableDealerPriceList .Plugin_Price',
    '.Plugin_Price'
  ];
  const shippingFirst = [
    '.f_productHeadPrice .shippingPrice .Plugin_Price',
    '.Plugin_ProductDetailsInfo .shippingPrice .Plugin_Price',
    '.price_information_product .shippingPrice .Plugin_Price',
    '.shippingPrice .Plugin_Price'
  ];
  const passes = shipping
    ? [{ selectors: shippingFirst, basis: 'shipping', skipShipping: false }, { selectors: productFirst, basis: 'product', skipShipping: true }]
    : [{ selectors: productFirst, basis: 'product', skipShipping: true }, { selectors: shippingFirst, basis: 'shipping', skipShipping: false }];
  for (const pass of passes) {
    for (const sel of pass.selectors) {
      const priceEl = queryDetailPriceEl(sel, { skipShipping: pass.skipShipping });
      if (priceEl) {
        const price = parsePrice(priceEl.textContent);
        if (price > 0) return { price, basis: pass.basis };
      }
    }
  }
  return { price: 0, basis: null };
}

export function isProductDetailPage() {
  if (typeof document === 'undefined') return false;
  const currentUrl = document.body?.getAttribute('data-current_url') || document.body?.getAttribute('data-current-url') || '';
  return (typeof location !== 'undefined' && /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(location.href)) ||
         /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(currentUrl) ||
         document.body?.classList.contains('Page_Product') ||
         document.body?.classList.contains('Page_DetailProduct') ||
         !!document.querySelector('.Page_DetailProduct, #Page_DetailProduct, .product_detail_page, .Page_Product') ||
         (!!document.querySelector('.Plugin_ProductHeading h1, .productHeading h1, .product_title h1, h1.productTitle') && !!getDetailProductId());
}

function extractPeriod(text) {
  const match = text.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : null;
}

/**
 * Extracts native Toppreise price rating widget data (Plugin_PriceRating) when present on detail page.
 */
export function extractNativePriceRating(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root?.querySelector) return null;
  const ratingEl = root.querySelector(`${SELECTORS.rating.container} ${SELECTORS.rating.widget}`);
  if (!ratingEl) return null;

  const rawLevel = ratingEl.getAttribute('data-rating-level');
  const level = rawLevel != null && String(rawLevel).trim() !== '' && !Number.isNaN(Number(rawLevel)) ? Number(rawLevel) : null;
  const label = ratingEl.querySelector(SELECTORS.rating.label)?.textContent?.trim() || ratingEl.getAttribute('aria-label') || '';

  let usualPrice = null;
  let usualPeriod = null;
  let lowestPriceRecent = null;
  let lowestPeriod = null;

  const factsDl = ratingEl.querySelector(SELECTORS.rating.facts);
  if (factsDl) {
    const dts = factsDl.querySelectorAll('dt');
    const dds = factsDl.querySelectorAll('dd');
    for (let i = 0; i < dts.length; i++) {
      const dtText = dts[i]?.textContent?.trim() || '';
      const ddText = dds[i]?.textContent?.trim() || '';
      if (/üblicher preis/i.test(dtText)) {
        usualPrice = parsePrice(ddText);
        usualPeriod = extractPeriod(dtText);
      } else if (/tiefster preis/i.test(dtText)) {
        lowestPriceRecent = parsePrice(ddText);
        lowestPeriod = extractPeriod(dtText);
      }
    }
  }

  const highlightEl = ratingEl.querySelector(SELECTORS.rating.highlight);
  const highlight = highlightEl?.textContent?.trim() || null;

  const rangeLis = ratingEl.querySelectorAll(SELECTORS.rating.ranges);
  const ranges = [];
  for (let i = 0; i < rangeLis.length; i++) {
    const li = rangeLis[i];
    const nameEl = li.querySelector(SELECTORS.rating.rangeName);
    const pricesEl = li.querySelector(SELECTORS.rating.rangePrices);
    const levelMatch = li.className.match(/priceRatingLevel(\d+)/);
    const rLevel = levelMatch ? Number(levelMatch[1]) : i;
    const isCurrent = li.classList.contains('current') || (level !== null && rLevel === level);
    ranges.push({
      level: rLevel,
      name: nameEl?.textContent?.trim() || '',
      priceRangeText: pricesEl?.textContent?.trim() || '',
      current: isCurrent
    });
  }

  return {
    level,
    label,
    usualPrice,
    usualPeriod,
    lowestPriceRecent,
    lowestPeriod,
    highlight,
    ranges
  };
}


export function triggerProcessListings() {
  if (typeof document === 'undefined') return;
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

