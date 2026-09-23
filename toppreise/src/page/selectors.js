/**
 * Immutable Central Selector Registry for Toppreise.ch DOM Elements
 */
export const SELECTORS = Object.freeze({
  cards: Object.freeze({
    standard: 'a.Plugin_Product, .Plugin_Product.medium-box, .Plugin_Product.mixedBrowsingList, .mixedBrowsingListProduct, .Plugin_Product',
    collections: '.Plugin_ProductCollItem',
    variants: '.f_collection',
    nestedCards: '.Plugin_Product, .mixedBrowsingListProduct',
    excludedParents: 'header, nav, footer, .breadcrumb, #tp-suite-filter-bar, .Plugin_ProductHistoryDropdown, .AbstractDropDown, #Plugin_MainHead, .DropDownMenuList',
    hiddenStyles: '.d-none, [style*="display: none"], [style*="display:none"]',
    productLinks: 'a[href*="/preisvergleich/"]',
    dealerRows: '.Plugin_DealerRelProdPriceInfo',
    diffBadge: '.badge-dif, .badge, [class*="badge-dif"]',
    categoryChip: '.subCategory, .productCategory, .categoryLink, [class*="Category"], [data-category]',
    availabilityIcon: '.Plugin_AvailabilityInformation'
  }),
  price: Object.freeze({
    mainInfo: '.Plugin_PriceInformation, .price_information_product',
    shipping: '.shippingPrice .Plugin_Price',
    product: '.productPrice .Plugin_Price',
    fallbackShipping: '.priceContainer.shippingPrice .Plugin_Price',
    fallbackProduct: '.priceContainer.productPrice .Plugin_Price',
    shippingContainer: '.priceContainer.shippingPrice',
    productContainer: '.priceContainer.productPrice',
    chartPrice: '.chartProductPrice .Plugin_Price, .Plugin_Price',
    genericPriceMatch: '.Plugin_Price, [class*="Price"], [class*="price"]',
    genericDiffMatch: '[class*="Differenz"], [class*="differenz"]'
  }),
  layout: Object.freeze({
    containers: Object.freeze([
      '#FrameContent',
      '#tpContent .pageContent',
      '.pageContent',
      '#browseContent',
      'main',
      '#content'
    ]),
    breadcrumbs: '.breadcrumb a:last-of-type, [class*="breadcrumb"] a:last-of-type',
    activeStoreFilters: '.filters .f_remove_filter[data-target-type="df"]'
  })
});
