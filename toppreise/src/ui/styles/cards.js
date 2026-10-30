/** Cards part (split from ui/styles.js): heat/fresh/cheapest/filter-dim primitives, deal-badge core, card harmonize. */

import { TP_TOKEN_VARS } from './tokens.js';

export const STYLES_CARDS = `
  :root {
    ${TP_TOKEN_VARS}
  }
  /* ─── GLOW-ONLY DEAL HEAT (no border, no fill: card keeps the site background, signal is box-shadow only) ─── */
  html body .tp-heat-blend,
  html body .Plugin_Product.tp-heat-blend,
  html body .mixedBrowsingListProduct.tp-heat-blend,
  html body a.Plugin_Product.tp-heat-blend,
  .tp-heat-blend,
  .Plugin_Product.tp-heat-blend,
  .mixedBrowsingListProduct.tp-heat-blend {
    box-shadow: var(--tp-heat-glow, 0 2px 8px rgba(0,0,0,0.25)) !important;
  }
  .tp-heat-blend .product-name,
  .tp-heat-blend .product-name a,
  .tp-heat-blend a.product-name,
  .tp-heat-blend .Plugin_ProductName,
  .tp-heat-blend .Plugin_ProductName a {
    color: #0f172a !important;
  }
  /* Fresh-deal glow (transient, post-verification): outline-only so the heat
  box-shadow underneath keeps showing the deal color. "Neu" pill is a
  pseudo-element — zero DOM bookkeeping, auto-cleans with the class. */
  .tp-deal-fresh {
    position: relative;
    outline: 2px solid var(--tp-acc) !important;
    outline-offset: -2px;
    animation: tp-fresh-pulse 1.2s ease-in-out infinite;
  }
  @keyframes tp-fresh-pulse {
    0%, 100% { outline-width: 2px; outline-color: var(--tp-acc); }
    50% { outline-width: 4px; outline-color: var(--tp-acc-deep); }
  }
  .tp-deal-fresh::after {
    content: "Neu";
    position: absolute;
    top: 6px;
    left: 6px;
    background: var(--tp-grad-acc);
    color: #fff;
    font: 700 var(--tp-fs-xs)/1.4 var(--tp-font);
    padding: 2px 8px;
    border-radius: var(--tp-r-pill);
    pointer-events: none;
    z-index: 5;
  }
  @media (prefers-reduced-motion: reduce) {
    .tp-deal-fresh { animation: none; }
  }
  .Plugin_Product.mixedBrowsingList.tp-is-cheapest {
    border: 2px solid var(--tp-acc) !important;
    border-color: var(--tp-acc) !important;
    border-radius: 8px !important;
    position: relative !important;
    box-shadow: 0 4px 20px rgba(16,185,129,0.15) !important;
    transition: all 0.3s ease !important;
  }
  .Plugin_Product.mixedBrowsingList.tp-is-cheapest.tp-heat-blend {
    box-shadow: 0 4px 20px rgba(16,185,129,0.25), var(--tp-heat-glow, none) !important;
  }
  .tp-best-price-badge {
    position: absolute;
    top: 13px;
    right: 68px;
    background: var(--tp-grad-acc);
    color: #fff;
    font: 700 11px/1.2 var(--tp-font);
    padding: 4px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    z-index: 5;
    box-shadow: 0 2px 8px rgba(16,185,129,0.4);
    letter-spacing: 0.5px;
    pointer-events: none;
  }
  .tp-filtered, .tp-col-filtered {
    display: none !important;
  }
  .tp-dimmed {
    opacity: var(--tp-dim-opacity, 0.25) !important;
    filter: grayscale(40%) !important;
  }
  .tp-highlighted {
    outline: 2px dotted var(--tp-acc, #10b981) !important;
    outline-offset: -4px !important;
  }
  /* Harmonize product card column contents on feed pages without distorting category browsing or subcards */
  #product-list .Plugin_Product.medium-box,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product.medium-box {
    padding: 10px 12px !important;
  }
  #product-list .Plugin_Product > .row.h-100,
  #product-list .Plugin_Product > .row,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product > .row.h-100,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product > .row {
    flex-wrap: nowrap !important;
  }
  #product-list .Plugin_Product .col-auto,
  #product-list .Plugin_Product .product-image,
  #product-list .Plugin_Product .image_container,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .col-auto,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .product-image,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .image_container {
    flex-shrink: 0 !important;
  }
  #product-list .Plugin_Product.medium-box .image_container img,
  #product-list .Plugin_Product.medium-box .productImage img,
  #product-list .Plugin_Product.medium-box .product-image img,
  #product-list .Plugin_Product.medium-box img,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product.medium-box .image_container img,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product.medium-box .productImage img,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product.medium-box .product-image img,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product.medium-box img {
    max-height: 75px !important;
    max-width: 75px !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
  }
  #product-list .Plugin_Product > .row > .col,
  #product-list .Plugin_Product > .row.h-100 > .col,
  #product-list .Plugin_Product .col.d-flex.flex-column,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product > .row > .col,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product > .row.h-100 > .col,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .col.d-flex.flex-column {
    min-width: 0 !important;
    flex: 1 1 auto !important;
  }
  #product-list .Plugin_Product .col > .row,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .col > .row {
    display: flex !important;
    flex-direction: column !important;
    flex-wrap: nowrap !important;
    justify-content: space-between !important;
    min-width: 0 !important;
    width: 100% !important;
    height: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  #product-list .Plugin_Product .col > .row > [class*="col-"],
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .col > .row > [class*="col-"] {
    max-width: 100% !important;
    width: 100% !important;
    flex: 0 0 auto !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  #product-list .Plugin_Product .product-name,
  #product-list .Plugin_Product .productDetails,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .product-name,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .productDetails {
    overflow-wrap: break-word !important;
    word-break: break-word !important;
  }
  #product-list .Plugin_Product .Plugin_PriceInformation,
  #product-list .Plugin_Product .price_information_product,
  #product-list .Plugin_Product .product-price,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .Plugin_PriceInformation,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .price_information_product,
  .Plugin_TopPriceReductionProductListFull .Plugin_Product .product-price {
    margin-top: auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }
  .tp-sparkline-container {
    flex-shrink: 0 !important;
  }
  /* Touch visibility & hit area expansion for hover-only card actions */
  @media (hover: none), (pointer: coarse) {
    .tp-share-btn:not(.tp-share-done):not(:disabled),
    .tp-review-search-btn,
    button.tp-dealer-name.tp-dealer-btn:not(:disabled),
    button.tp-card-alarm-btn:not(:disabled) {
      opacity: 0.45 !important;
      pointer-events: auto !important;
      touch-action: manipulation !important;
    }
    .tp-review-search-btn,
    button.tp-dealer-name.tp-dealer-btn {
      position: relative !important;
    }
    button.tp-card-alarm-btn {
      min-width: 26px !important;
      min-height: 22px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    .tp-share-btn:not(:disabled):active,
    .tp-review-search-btn:active,
    button.tp-dealer-name.tp-dealer-btn:not(:disabled):active,
    button.tp-card-alarm-btn:not(:disabled):active {
      opacity: 1 !important;
    }
    .tp-share-btn::after {
      content: "" !important;
      position: absolute !important;
      top: -7px !important;
      bottom: -7px !important;
      left: -7px !important;
      right: -7px !important;
    }
    .tp-review-search-btn::after,
    button.tp-dealer-name.tp-dealer-btn::after {
      content: "" !important;
      position: absolute !important;
      top: -8px !important;
      bottom: -8px !important;
      left: -8px !important;
      right: -8px !important;
    }
  }
`;
