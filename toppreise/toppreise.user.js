// ==UserScript==
// @name         Toppreise.ch Suite: Power Filter & Price Alarm Auto-Filler
// @namespace    https://github.com/tazztone/userscripts
// @version      2.18.107
// @description  All-in-one suite for Toppreise.ch: Highlights best prices, discount heatmap, excludes negative keywords, sorts/filters by offer count/discount, checks real all-time Tiefstpreise, and automates price alarms.
// @author       tazztone
// @match        https://www.toppreise.ch/*
// @updateURL    https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js
// @downloadURL  https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      discord.com
// @noframes
// ==/UserScript==

// ─── GENERATED BUNDLE - DO NOT EDIT DIRECTLY ─────────────────────────────────
// Source modules are located in src/.
// Built with: node tools/build.js
// ─────────────────────────────────────────────────────────────────────────────



// ─── STYLES ──────────────────────────────────────────────────────────────────
/**
 * CSS Stylesheets for Toppreise.ch Suite
 * Contains main document styles (heatmap, badges, pills, filter bar, toasts)
 * and isolated Shadow DOM modal dialog styles.
 */

const STYLES = `
  /* ─── HEATMAP CARD STYLES & DARKREADER DYNAMIC COMPATIBILITY ─── */
  html body .tp-heatmap-active,
  html body .Plugin_Product.tp-heatmap-active,
  html body .mixedBrowsingListProduct.tp-heatmap-active,
  html body a.Plugin_Product.tp-heatmap-active,
  .tp-heatmap-active,
  .Plugin_Product.tp-heatmap-active,
  .mixedBrowsingListProduct.tp-heatmap-active,
  .tp-heatmap-active[data-darkreader-inline-bgcolor],
  .Plugin_Product.tp-heatmap-active[data-darkreader-inline-bgcolor],
  .mixedBrowsingListProduct.tp-heatmap-active[data-darkreader-inline-bgcolor],
  .tp-heatmap-active[data-darkreader-inline-bgimage],
  .Plugin_Product.tp-heatmap-active[data-darkreader-inline-bgimage],
  .mixedBrowsingListProduct.tp-heatmap-active[data-darkreader-inline-bgimage] {
    background: var(--tp-heat-bg) !important;
    background-image: var(--tp-heat-bg) !important;
    border: 1.5px solid var(--tp-heat-border) !important;
    border-color: var(--tp-heat-border) !important;
    box-shadow: var(--tp-heat-glow, 0 2px 8px rgba(0,0,0,0.25)) !important;
    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease !important;
    --darkreader-inline-bgcolor: transparent !important;
    --darkreader-inline-bgimage: var(--tp-heat-bg) !important;
    --darkreader-inline-border: var(--tp-heat-border) !important;
    --darkreader-inline-border-top: var(--tp-heat-border) !important;
    --darkreader-inline-border-right: var(--tp-heat-border) !important;
    --darkreader-inline-border-bottom: var(--tp-heat-border) !important;
    --darkreader-inline-border-left: var(--tp-heat-border) !important;
  }
  .tp-heatmap-active:hover,
  .Plugin_Product.tp-heatmap-active:hover,
  .mixedBrowsingListProduct.tp-heatmap-active:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.45), var(--tp-heat-glow, none) !important;
  }
  .tp-heatmap-active .badge.badge-dif,
  .Plugin_Product.tp-heatmap-active .badge.badge-dif {
    box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 10px var(--tp-heat-border) !important;
  }
  .tp-heatmap-active .row,
  .tp-heatmap-active .col,
  .tp-heatmap-active [class*="col-"],
  .tp-heatmap-active .priceAvailabilityContainer,
  .tp-heatmap-active .price-availability,
  .tp-heatmap-active .offersContainer,
  .tp-heatmap-active .offers,
  .tp-heatmap-active .priceContainer,
  .tp-heatmap-active .Plugin_Price,
  .tp-heatmap-active .productPrice,
  .tp-heatmap-active .shippingPrice,
  .tp-heatmap-active .shippingText,
  .tp-heatmap-active .manufacturer-image,
  .tp-heatmap-active .product-name,
  .tp-heatmap-active .product-name[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .productDetails,
  .tp-heatmap-active .productDetails[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .price_information_product,
  .tp-heatmap-active .price_information_product[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .Plugin_PriceInformation,
  .tp-heatmap-active .Plugin_PriceInformation[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .f_product_info,
  .tp-heatmap-active .f_product_info[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .productDescription,
  .tp-heatmap-active .productDescription[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .productDetailsDescription,
  .tp-heatmap-active .productDetailsDescription[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .product-details,
  .tp-heatmap-active .product-details[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .f_product_container,
  .tp-heatmap-active .f_product_container[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .product-image,
  .tp-heatmap-active .product-image[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .productImage,
  .tp-heatmap-active .productImage[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .image_container,
  .tp-heatmap-active .image_container[data-darkreader-inline-bgcolor],
  .tp-heatmap-active .image,
  .tp-heatmap-active [data-darkreader-inline-bgcolor],
  .tp-heatmap-active [data-darkreader-inline-bgimage] {
    background: transparent !important;
    background-color: transparent !important;
    --darkreader-inline-bgcolor: transparent !important;
    --darkreader-inline-bgimage: none !important;
  }
  .tp-heatmap-active div:not(.badge):not(.tp-deal-pill):not(.tp-best-price-badge):not(.tp-sparkline-container),
  .tp-heatmap-active a:not(.badge):not(.tp-deal-pill):not(.tp-best-price-badge):not(.tp-sparkline-container),
  .tp-heatmap-active p,
  .tp-heatmap-active span:not(.badge *):not(.tp-deal-pill *):not(.tp-best-price-badge *):not(.tp-sparkline-container *) {
    background: transparent !important;
    background-color: transparent !important;
    --darkreader-inline-bgcolor: transparent !important;
    --darkreader-inline-bgimage: none !important;
  }
  .Plugin_Product.mixedBrowsingList.tp-is-cheapest,
  .Plugin_Product.mixedBrowsingList.tp-is-cheapest[data-darkreader-inline-border-top],
  .Plugin_Product.mixedBrowsingList.tp-is-cheapest[data-darkreader-inline-border-right],
  .Plugin_Product.mixedBrowsingList.tp-is-cheapest[data-darkreader-inline-border-bottom],
  .Plugin_Product.mixedBrowsingList.tp-is-cheapest[data-darkreader-inline-border-left] {
    border: 2px solid #10b981 !important;
    border-color: #10b981 !important;
    border-radius: 8px !important;
    position: relative !important;
    box-shadow: 0 4px 20px rgba(16,185,129,0.15) !important;
    transition: all 0.3s ease !important;
    --darkreader-inline-border: #10b981 !important;
    --darkreader-inline-border-top: #10b981 !important;
    --darkreader-inline-border-right: #10b981 !important;
    --darkreader-inline-border-bottom: #10b981 !important;
    --darkreader-inline-border-left: #10b981 !important;
  }
  .Plugin_Product.mixedBrowsingList.tp-is-cheapest.tp-heatmap-active {
    box-shadow: 0 4px 20px rgba(16,185,129,0.25), var(--tp-heat-glow, none) !important;
  }
  .tp-best-price-badge {
    position: absolute;
    top: 13px;
    right: 68px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #fff;
    font: 700 11px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 4px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(16,185,129,0.4);
    letter-spacing: 0.5px;
    pointer-events: none;
  }
  .tp-mode-dim .Plugin_Product.mixedBrowsingList.tp-not-cheapest,
  .tp-mode-dim .Plugin_Product.mixedBrowsingList.tp-no-store-offer {
    opacity: var(--tp-dim-opacity, 0.25) !important;
    filter: grayscale(40%) !important;
    transition: opacity 0.3s ease, filter 0.3s ease !important;
  }
  .tp-mode-dim .Plugin_Product.mixedBrowsingList.tp-not-cheapest:hover,
  .tp-mode-dim .Plugin_Product.mixedBrowsingList.tp-no-store-offer:hover {
    opacity: 0.6 !important;
    filter: grayscale(10%) !important;
  }
  .tp-mode-hide .Plugin_Product.mixedBrowsingList.tp-not-cheapest,
  .tp-mode-hide .Plugin_Product.mixedBrowsingList.tp-no-store-offer,
  .tp-negative-filtered, .tp-min-offers-filtered, .tp-baddeal-hidden, .tp-unchecked-hidden,
  [class*="col-"]:has(> .tp-negative-filtered),
  [class*="col-"]:has(> .tp-min-offers-filtered),
  [class*="col-"]:has(> .tp-baddeal-hidden),
  [class*="col-"]:has(> .tp-unchecked-hidden) {
    display: none !important;
  }
  body.tp-reveal-neg .tp-negative-filtered,
  body.tp-reveal-neg [class*="col-"]:has(> .tp-negative-filtered),
  body.tp-reveal-min .tp-min-offers-filtered,
  body.tp-reveal-min [class*="col-"]:has(> .tp-min-offers-filtered),
  body.tp-reveal-baddeals .tp-baddeal-hidden,
  body.tp-reveal-baddeals [class*="col-"]:has(> .tp-baddeal-hidden),
  body.tp-reveal-unchecked .tp-unchecked-hidden,
  body.tp-reveal-unchecked [class*="col-"]:has(> .tp-unchecked-hidden) {
    display: block !important;
    opacity: var(--tp-dim-opacity, 0.25) !important;
    filter: grayscale(40%) !important;
    outline: 2px dashed #f59e0b !important;
    outline-offset: -2px !important;
  }
  /* ─── REAL DEAL & ALLZEIT-TIEFSTPREIS STYLES ─── */
  /* ─── NATIVE DIFFERENZ BADGE REAL DEAL INTEGRATION ─── */
  .badge.badge-dif.tp-injected-badge,
  .badge-dif.tp-injected-badge {
    position: absolute !important;
    top: 10px !important;
    right: 10px !important;
    width: 50px !important;
    height: 50px !important;
    border-radius: 50% !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    text-align: center !important;
    z-index: 15 !important;
    box-sizing: border-box !important;
    background: rgba(30, 41, 59, 0.88) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    color: #f1f5f9 !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35) !important;
  }
  .badge.badge-dif.tp-injected-badge .text,
  .badge-dif.tp-injected-badge .text {
    font-size: 9px !important;
    line-height: 12px !important;
    margin-top: 2px !important;
  }
  .badge.badge-dif.tp-injected-badge p,
  .badge-dif.tp-injected-badge p {
    margin: 0 !important;
    font-size: 13px !important;
    font-weight: bold !important;
    line-height: 1.1 !important;
  }
  /* ─── INLINE DEAL PILL FOR LIST VIEWS ─── */
  .badge.badge-dif.tp-deal-pill,
  .badge-dif.tp-deal-pill {
    position: static !important;
    display: inline-flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    justify-content: center !important;
    width: auto !important;
    min-width: 74px !important;
    height: 26px !important;
    border-radius: 13px !important;
    padding: 3px 10px !important;
    margin-bottom: 4px !important;
    margin-left: auto !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
    cursor: pointer !important;
    text-align: center !important;
    gap: 4px !important;
    background: rgba(15, 23, 42, 0.95) !important;
    border: 1.5px solid rgba(56, 189, 248, 0.6) !important;
    color: #f1f5f9 !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 6px rgba(56, 189, 248, 0.25) !important;
    transform: none !important;
  }
  .badge.badge-dif.tp-deal-pill .text,
  .badge-dif.tp-deal-pill .text {
    display: none !important;
  }
  .badge.badge-dif.tp-deal-pill span {
    display: inline-flex !important;
    align-items: center !important;
    font-size: 11px !important;
    line-height: 1 !important;
    margin: 0 !important;
  }
  .badge.badge-dif.tp-deal-pill p,
  .badge-dif.tp-deal-pill p {
    display: inline-flex !important;
    align-items: center !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    margin: 0 !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }
  .badge.badge-dif.tp-deal-pill p.tp-markup-val {
    font-size: 11px !important;
    font-weight: 700 !important;
    line-height: 1 !important;
  }
  .badge.badge-dif.tp-deal-pill .tp-badge-loupe-icon {
    display: none !important;
  }
  /* Single color language: color always = badge-% heat (applied inline by the
     heat block), text always = kind. The event-kind classes below stay in the
     DOM as logic hooks but must not paint — otherwise a -3% at-low glows the
     same green as a -60% one and depth stops being readable. */
  .badge.badge-dif.tp-deal-pill.tp-deal-loading {
    background: rgba(30, 41, 59, 0.9) !important;
    border-color: #38bdf8 !important;
    color: #38bdf8 !important;
  }
  .price-availability {
    align-items: center !important;
    max-width: 100% !important;
    padding-right: 8px !important;
  }
  .price-availability a.col,
  .price-availability .col {
    min-width: 0 !important;
  }
  .price-availability .col-auto {
    flex-shrink: 0 !important;
    padding-right: 0 !important;
  }
  .Plugin_Product.f_collection .tp-deal-pill,
  .Plugin_ProductCollItem .tp-deal-pill {
    margin-left: 8px !important;
    margin-bottom: 0 !important;
    margin-top: 0 !important;
    vertical-align: middle !important;
    display: inline-flex !important;
    flex-direction: row !important;
  }
  .badge.badge-dif.tp-deal-badge-interactive,
  .badge-dif.tp-deal-badge-interactive {
    cursor: pointer !important;
    user-select: none !important;
    touch-action: manipulation !important;
    transform-origin: center center !important;
    transition: box-shadow 0.15s ease-out, border-color 0.15s ease-out !important;
  }
  .badge.badge-dif.tp-deal-badge-interactive *,
  .badge-dif.tp-deal-badge-interactive * {
    pointer-events: none !important;
  }
  .tp-share-btn {
    position: absolute !important;
    bottom: 6px !important;
    left: 6px !important;
    z-index: 6 !important;
    width: 26px !important;
    height: 26px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 13px !important;
    line-height: 1 !important;
    background: rgba(15, 23, 42, 0.92) !important;
    border: 1px solid rgba(88, 101, 242, 0.7) !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
  .tp-show-share > .tp-share-btn,
  .tp-share-btn:hover,
  .tp-share-btn:focus-visible {
    opacity: 0.9 !important;
    pointer-events: auto !important;
  }
  .tp-share-btn:disabled {
    opacity: 0.4 !important;
    cursor: wait !important;
  }
  .badge.badge-dif.tp-deal-badge-interactive:hover,
  .badge-dif.tp-deal-badge-interactive:hover {
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5) !important;
    z-index: 30 !important;
  }
  .badge.badge-dif.tp-deal-badge-interactive:active,
  .badge-dif.tp-deal-badge-interactive:active {
    opacity: 0.9 !important;
  }
  .tp-badge-loupe-icon {
    position: absolute !important;
    bottom: -2px !important;
    right: -2px !important;
    font-size: 11px !important;
    line-height: 1 !important;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.8)) !important;
    pointer-events: none !important;
  }
  /* Loupe check button: keyboard twin of the badge click. Corner badges are
     absolute overlays, so the button overlays too (same offset parent as the
     badge: directly below its 50px box) — never a new layout row. Inline
     deal pills get an inline button joining the pill row instead. */
  button.tp-loupe {
    position: absolute !important;
    top: 64px !important;
    right: 10px !important;
    z-index: 31 !important;
    min-width: 24px !important;
    min-height: 24px !important;
    padding: 2px 4px !important;
    font-size: 13px !important;
    line-height: 1 !important;
    background: rgba(51,65,85,0.85) !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    cursor: pointer !important;
  }
  .tp-deal-pill + button.tp-loupe {
    position: static !important;
    margin-left: 8px !important;
  }
  button.tp-loupe:hover { background: #334155 !important; }
  button.tp-loupe:focus-visible { outline: 2px solid #34d399 !important; outline-offset: 2px !important; }
  .badge.badge-dif.tp-deal-loading,
  .badge-dif.tp-deal-loading {
    cursor: wait !important;
    opacity: 0.85 !important;
  }
  /* Geprüft vs ungeprüft: unchecked ribbons read striped-gray + dashed at a
     glance, verified ribbons stay solid heat. Always on, no heat dependency. */
  .badge.badge-dif.tp-is-unverified,
  .badge-dif.tp-is-unverified {
    background: repeating-linear-gradient(135deg, #475569 0 6px, #334155 6px 12px) !important;
    border: 1.5px dashed #94a3b8 !important;
    color: #ffffff !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
  }
  .badge.badge-dif.tp-is-verified,
  .badge-dif.tp-is-verified {
    border-style: solid !important;
    border-width: 1.5px !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.45) !important;
  }
  .Plugin_Product.tp-is-unverified,
  a.Plugin_Product.tp-is-unverified,
  .mixedBrowsingListProduct.tp-is-unverified {
    filter: saturate(0.55) brightness(0.97) !important;
    border-style: dashed !important;
  }

  /* 3A/3B/2A retired: record (gold), at-low (emerald) and markup (amber/rose)
     no longer paint. Verified Tiefstpreise get the badge-% heat color inline;
     markups stay neutral gray with the +XX% text carrying the signal. */
  .badge.badge-dif.tp-deal-not-low p.tp-markup-val {
    font-size: 13px !important;
    font-weight: 800 !important;
    margin: 0 !important;
    line-height: 1.1 !important;
    color: #ffffff !important;
  }
  .badge.badge-dif.tp-deal-not-low .tp-fake-discount {
    font-size: 9.5px !important;
    opacity: 0.75 !important;
    display: block !important;
    line-height: 1 !important;
    margin-top: 1px !important;
    color: #fde68a !important;
  }
  .tp-card-historical-price {
    font: 500 10px/1.15 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    color: #94a3b8 !important;
    text-align: right !important;
    margin: 0 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    user-select: none !important;
    pointer-events: auto !important;
  }
  .tp-card-historical-price.tp-is-record-low {
    color: #34d399 !important;
    font-weight: 700 !important;
    background: rgba(52, 211, 153, 0.12) !important;
    border: 1px solid rgba(52, 211, 153, 0.35) !important;
    border-radius: 4px !important;
    padding: 1px 5px !important;
  }
  .tp-card-historical-price.tp-is-at-low {
    color: #10b981 !important;
  }
  .tp-card-historical-price.tp-with-prev {
    font-weight: 700 !important;
  }
  .tp-card-historical-price.tp-is-markup {
    color: #fbbf24 !important;
  }
  .tp-card-subline-row {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 4px !important;
    margin-top: 1px !important;
    width: 100% !important;
  }
  .tp-sparkline-container {
    display: inline-flex !important;
    align-items: center !important;
    vertical-align: middle !important;
    margin: 0 !important;
    line-height: 1 !important;
  }
  .tp-sparkline {
    opacity: 0.85;
    transition: opacity 0.2s ease;
    overflow: visible;
  }
  .tp-sparkline:hover {
    opacity: 1 !important;
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
  .tp-card-subline-row {
    max-width: 100% !important;
  }
  .tp-sparkline-container {
    flex-shrink: 0 !important;
  }
  .tp-bar-btn.tp-batch-active {
    background: rgba(245, 158, 11, 0.25) !important;
    border-color: rgba(245, 158, 11, 0.5) !important;
    color: #fbbf24 !important;
  }
  .tp-bar-btn.tp-bestpreise-active {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.35), rgba(245, 158, 11, 0.25)) !important;
    border-color: rgba(139, 92, 246, 0.6) !important;
    color: #e9d5ff !important;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.3) !important;
  }
  #tp-suite-filter-bar.tp-bestpreise-bar {
    border-color: rgba(139, 92, 246, 0.45) !important;
    box-shadow: 0 3px 10px rgba(0,0,0,0.2), 0 0 0 1px rgba(139, 92, 246, 0.2) !important;
  }
  #timeframe-filter {
    align-items: center !important;
  }
  #timeframe-filter #tp-bar-bestpreise-btn {
    margin-right: 8px !important;
    flex-shrink: 0 !important;
  }
  #timeframe-filter #tp-bar-weight-wrapper {
    margin-right: auto !important;
    flex-shrink: 0 !important;
  }
  .tp-bar-btn.tp-disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
  }
  .tp-threshold-wrapper {
    position: relative !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
  }
  .tp-weight-label {
    color: #c4b5fd !important;
    font: 600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    white-space: nowrap !important;
    cursor: default !important;
    display: inline-block !important;
    min-width: 11ch !important; /* widest text: "⚖️ 100% Med" — keeps the slider still while dragging */
    text-align: center !important;
    font-variant-numeric: tabular-nums !important;
  }
  #tp-bar-weight-range {
    width: 92px !important;
    accent-color: #a855f7 !important;
    cursor: pointer !important;
  }
  .tp-empty-state-notice {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 12px !important;
    background: rgba(30, 41, 59, 0.85) !important;
    backdrop-filter: blur(12px) !important;
    border: 1px dashed rgba(255, 255, 255, 0.2) !important;
    border-radius: 12px !important;
    padding: 24px 20px !important;
    margin: 16px auto !important;
    width: 100% !important;
    box-sizing: border-box !important;
    color: #e2e8f0 !important;
    text-align: center !important;
    font: 500 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
  }
  .tp-empty-state-actions {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
    justify-content: center !important;
  }
  .tp-empty-state-btn {
    background: rgba(15, 23, 42, 0.8) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    color: #f1f5f9 !important;
    padding: 6px 12px !important;
    border-radius: 6px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
  }
  .tp-empty-state-btn:hover {
    background: #3b82f6 !important;
    border-color: #60a5fa !important;
    color: #ffffff !important;
  }
  .tp-detail-deal-badge {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 4px 10px !important;
    border-radius: 8px !important;
    font: 700 12.5px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    vertical-align: middle !important;
    margin-left: 10px !important;
    user-select: none !important;
  }
  .tp-detail-deal-badge.tp-is-alltime-low {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%) !important;
    border: 1px solid #34d399 !important;
    color: #ffffff !important;
    box-shadow: 0 2px 10px rgba(16, 185, 129, 0.45) !important;
  }
  .tp-detail-deal-badge.tp-is-not-low {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(217, 119, 6, 0.95) 100%) !important;
    border: 1px solid #fbbf24 !important;
    color: #ffffff !important;
    box-shadow: 0 2px 10px rgba(245, 158, 11, 0.4) !important;
  }
  .tp-detail-deal-badge.tp-is-severe-markup {
    background: linear-gradient(135deg, rgba(225, 29, 72, 0.95) 0%, rgba(190, 18, 60, 0.95)) !important;
    border: 1px solid #f43f5e !important;
    color: #ffffff !important;
    box-shadow: 0 2px 10px rgba(225, 29, 72, 0.45) !important;
  }
  #tp-suite-filter-bar {
    margin: 8px auto 12px !important;
    width: 100% !important;
    box-sizing: border-box !important;
    background: #1e293b !important;
    border: 1px solid #334155 !important;
    border-radius: 10px !important;
    padding: 8px 12px !important;
    color: #f8fafc !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    box-shadow: 0 3px 10px rgba(0,0,0,0.2) !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    z-index: 10 !important;
    position: relative !important;
  }
  .tp-filter-main-row {
    display: flex !important;
    align-items: stretch !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
  }
  .tp-group {
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
    background: rgba(15,23,42,0.35) !important;
    border: 1px solid rgba(255,255,255,0.07) !important;
    border-radius: 10px !important;
    padding: 4px 8px !important;
    min-width: 0 !important;
  }
  .tp-group-filter {
    flex: 1 1 340px !important;
    flex-wrap: wrap !important;
    row-gap: 6px !important;
  }
  .tp-group-view, .tp-group-deals {
    flex: 0 1 auto !important;
    flex-wrap: wrap !important;
    row-gap: 6px !important;
  }
  .tp-group-label {
    font-size: 9px !important;
    font-weight: 800 !important;
    letter-spacing: 0.8px !important;
    text-transform: uppercase !important;
    color: #64748b !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }
  .tp-divider {
    width: 1px !important;
    align-self: stretch !important;
    background: rgba(255,255,255,0.10) !important;
    border-radius: 1px !important;
    flex-shrink: 0 !important;
    margin: 2px 0 !important;
  }
  .tp-btn-sub {
    font-size: 10px !important;
    font-weight: 500 !important;
    opacity: 0.65 !important;
  }
  .tp-mini-caption {
    font-size: 10px !important;
    font-weight: 700 !important;
    color: #94a3b8 !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }
  .tp-join {
    display: inline-flex !important;
    align-items: center !important;
    flex-shrink: 0 !important;
  }
  .tp-stepper-label {
    font-weight: 700 !important;
    color: #94a3b8 !important;
    white-space: nowrap !important;
  }
  @media (max-width: 900px) {
    .tp-btn-sub { display: none !important; }
    .tp-divider { display: none !important; }
    .tp-group { width: 100% !important; }
  }
  .tp-input-wrapper {
    flex: 1 1 200px !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    min-width: 0 !important;
  }
  .tp-input-label-inline {
    font-size: 12px !important;
    font-weight: 700 !important;
    color: #94a3b8 !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }
  .tp-input-field-box {
    flex: 1 !important;
    min-width: 0 !important;
    position: relative !important;
    display: flex !important;
    align-items: center !important;
  }
  #tp-inline-negative-input {
    width: 100% !important;
    background: rgba(15,23,42,0.8) !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    color: #fff !important;
    padding: 6px 26px 6px 10px !important;
    font-size: 12px !important;
    outline: none !important;
    box-sizing: border-box !important;
  }
  #tp-inline-negative-input:focus { border-color: #10b981 !important; }
  #tp-clear-neg-btn {
    position: absolute !important;
    right: 8px !important;
    background: transparent !important;
    border: none !important;
    color: #64748b !important;
    cursor: pointer !important;
    padding: 2px 6px !important;
  }
  #tp-clear-neg-btn:hover { color: #f43f5e !important; }
  .tp-bar-btn {
    background: rgba(51,65,85,0.6) !important;
    border: 1px solid #334155 !important;
    color: #cbd5e1 !important;
    padding: 5px 10px !important;
    border-radius: 8px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }
  .tp-bar-btn:hover { background: #334155 !important; color: #fff !important; }
  .tp-bar-btn:focus-visible { outline: 2px solid #34d399 !important; outline-offset: 2px !important; }
  .tp-bar-btn.tp-active {
    background: rgba(16,185,129,0.2) !important;
    border-color: rgba(16,185,129,0.4) !important;
    color: #34d399 !important;
  }
  .tp-reveal-menu-wrapper { position: relative !important; }
  #tp-bar-reveal-popover {
    position: absolute !important;
    top: calc(100% + 6px) !important;
    left: 0 !important;
    background: rgba(15, 23, 42, 0.97) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 10px !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
    padding: 4px !important;
    display: none;
    flex-direction: column !important;
    gap: 2px !important;
    min-width: 220px !important;
    z-index: 50 !important;
  }
  #tp-bar-reveal-popover.tp-show { display: flex !important; }
  #tp-bar-reveal-popover .tp-bar-btn { justify-content: flex-start !important; width: 100% !important; }
  #tp-bar-reveal-popover .tp-reveal-hint { color: #94a3b8 !important; padding: 5px 10px 3px !important; font-size: 11px !important; }
  .tp-mini-switch {
    position: relative !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    cursor: pointer !important;
    flex-shrink: 0 !important;
    user-select: none !important;
  }
  .tp-mini-switch input {
    position: absolute !important;
    opacity: 0 !important;
    width: 0 !important;
    height: 0 !important;
    margin: 0 !important;
  }
  .tp-mini-slider {
    position: relative !important;
    width: 32px !important;
    height: 18px !important;
    border-radius: 999px !important;
    background: rgba(100,116,139,0.35) !important;
    border: 1px solid rgba(100,116,139,0.55) !important;
    transition: background 0.2s ease, border-color 0.2s ease !important;
    flex-shrink: 0 !important;
  }
  .tp-mini-slider:before {
    content: "" !important;
    position: absolute !important;
    top: 2px !important;
    left: 2px !important;
    width: 12px !important;
    height: 12px !important;
    border-radius: 50% !important;
    background: #94a3b8 !important;
    transition: transform 0.2s ease, background 0.2s ease !important;
  }
  .tp-mini-switch input:checked + .tp-mini-slider {
    background: rgba(16,185,129,0.4) !important;
    border-color: rgba(16,185,129,0.6) !important;
  }
  .tp-mini-switch input:checked + .tp-mini-slider:before {
    transform: translateX(14px) !important;
    background: #fff !important;
  }
  .tp-mini-switch input:focus-visible + .tp-mini-slider {
    outline: 2px solid #34d399 !important;
    outline-offset: 2px !important;
  }
  .tp-mini-state {
    font-size: 10px !important;
    font-weight: 700 !important;
    min-width: 22px !important;
    color: #64748b !important;
  }
  .tp-mini-switch input:checked ~ .tp-mini-state { color: #34d399 !important; }
  /* Dimmed tool: the control a switched-OFF mini-toggle belongs to reads inactive. */
  .tp-tool-dim {
    opacity: 0.45 !important;
    filter: saturate(0.4) !important;
    transition: opacity 0.2s ease !important;
  }
  .tp-bar-stepper-group {
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    background: rgba(15,23,42,0.6) !important;
    border: 1px solid #334155 !important;
    padding: 2px 6px !important;
    border-radius: 8px !important;
    font-size: 11px !important;
    color: #94a3b8 !important;
  }
  .tp-stepper-btn {
    width: 24px !important;
    height: 24px !important;
    border-radius: 50% !important;
    background: rgba(255,255,255,0.1) !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    color: #fff !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    padding: 0 !important;
  }
  .tp-stepper-btn:hover { background: rgba(16,185,129,0.5) !important; }
  .tp-stepper-btn:focus-visible { outline: 2px solid #34d399 !important; outline-offset: 2px !important; }
  /* ─── FLOATING CHECK-DEALS CTA (primary one-click verify action) ─── */
  #tp-floating-check-cta {
    position: fixed !important;
    left: 16px !important;
    bottom: 16px !important;
    z-index: 99990 !important;
    display: flex !important;
    align-items: stretch !important;
    gap: 0 !important;
    background: rgba(15, 23, 42, 0.96) !important;
    backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(16, 185, 129, 0.55) !important;
    border-radius: 14px !important;
    box-shadow: 0 8px 28px rgba(0,0,0,0.5), 0 0 16px rgba(16,185,129,0.25) !important;
    padding: 6px !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    animation: tp-floating-pulse 2.4s ease-in-out infinite !important;
  }
  #tp-floating-check-cta.tp-scanning { animation: none !important; border-color: rgba(245,158,11,0.6) !important; }
  #tp-floating-check-cta.tp-empty { animation: none !important; border-color: rgba(148,163,184,0.35) !important; box-shadow: 0 8px 28px rgba(0,0,0,0.5) !important; }
  #tp-floating-check-cta.tp-empty #tp-floating-check-btn { background: linear-gradient(135deg, #475569 0%, #334155 100%) !important; color: #cbd5e1 !important; }
  #tp-floating-check-cta.tp-empty #tp-floating-check-btn:hover { filter: brightness(1.08) !important; }
  #tp-floating-check-cta.tp-hidden { display: none !important; }
  @keyframes tp-floating-pulse {
    0%, 100% { box-shadow: 0 8px 28px rgba(0,0,0,0.5), 0 0 10px rgba(16,185,129,0.18) !important; }
    50% { box-shadow: 0 8px 28px rgba(0,0,0,0.5), 0 0 22px rgba(16,185,129,0.4) !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    #tp-floating-check-cta { animation: none !important; }
    .tp-tool-dim, .tp-mini-slider, .tp-mini-slider:before, .tp-switch .tp-slider, .tp-switch .tp-slider:before { transition: none !important; }
  }
  @media (prefers-contrast: more) {
    .badge-dif, .tp-deal-pill { color: #fff !important; border-width: 2px !important; }
    .tp-tool-dim { opacity: 0.75 !important; }
  }
  #tp-floating-check-btn {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
    border: none !important;
    border-radius: 10px 0 0 10px !important;
    color: #fff !important;
    padding: 8px 14px !important;
    cursor: pointer !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 1px !important;
    line-height: 1.2 !important;
  }
  #tp-floating-check-btn:hover { filter: brightness(1.12) !important; }
  #tp-floating-check-main { font-size: 13px !important; font-weight: 800 !important; white-space: nowrap !important; }
  #tp-floating-check-sub { font-size: 10px !important; font-weight: 500 !important; opacity: 0.85 !important; white-space: nowrap !important; }
  #tp-floating-threshold-btn {
    background: rgba(51,65,85,0.7) !important;
    border: none !important;
    border-left: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 0 10px 10px 0 !important;
    color: #cbd5e1 !important;
    padding: 8px 10px !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    white-space: nowrap !important;
  }
  #tp-floating-threshold-btn:hover { color: #fff !important; background: rgba(51,65,85,1) !important; }
  #tp-floating-threshold-popover .tp-floating-filter-row {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    color: #cbd5e1 !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    padding: 6px 10px !important;
    cursor: pointer !important;
    white-space: nowrap !important;
    border-radius: 6px !important;
  }
  #tp-floating-threshold-popover .tp-floating-filter-row:hover { background: rgba(51,65,85,1) !important; color: #fff !important; }
  #tp-floating-threshold-popover .tp-floating-filter-row.tp-active { background: rgba(16,185,129,0.25) !important; color: #34d399 !important; }
  #tp-floating-threshold-popover .tp-floating-filter-row input { accent-color: #10b981 !important; }
  #tp-floating-threshold-popover {
    position: absolute !important;
    bottom: calc(100% + 6px) !important;
    right: 0 !important;
    background: rgba(15, 23, 42, 0.97) !important;
    backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 10px !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
    padding: 4px !important;
    display: none;
    flex-direction: column !important;
    gap: 2px !important;
    min-width: 220px !important;
  }
  #tp-floating-threshold-popover.tp-show { display: flex !important; }
  #tp-floating-threshold-popover .tp-floating-hint {
    color: #94a3b8 !important;
    padding: 5px 10px 3px !important;
    font-size: 10.5px !important;
    font-weight: 500 !important;
    cursor: default !important;
  }
  #tp-floating-threshold-popover .tp-floating-option {
    background: transparent !important;
    border: none !important;
    color: #cbd5e1 !important;
    padding: 6px 10px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    text-align: left !important;
  }
  #tp-floating-threshold-popover .tp-floating-option:hover { background: rgba(16,185,129,0.25) !important; color: #fff !important; }
  #tp-floating-threshold-popover .tp-floating-option.tp-selected { background: #10b981 !important; color: #fff !important; }
  #tp-floating-cta-collapse {
    background: rgba(51,65,85,0.7) !important;
    border: none !important;
    border-left: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 0 10px 10px 0 !important;
    color: #94a3b8 !important;
    padding: 8px 10px !important;
    font-size: 13px !important;
    font-weight: 800 !important;
    cursor: pointer !important;
    line-height: 1.2 !important;
  }
  #tp-floating-cta-collapse:hover { color: #fff !important; background: rgba(51,65,85,1) !important; }
  #tp-floating-check-btn:focus-visible, #tp-floating-threshold-btn:focus-visible,
  #tp-floating-cta-collapse:focus-visible, #tp-floating-threshold-popover .tp-floating-option:focus-visible { outline: 2px solid #34d399 !important; outline-offset: 2px !important; }
  #tp-floating-threshold-popover .tp-floating-filter-row:focus-within { outline: 2px solid #34d399 !important; outline-offset: -2px !important; }
  /* Collapsed form: compact count pill — the action stays one click away. */
  #tp-floating-check-count { display: none !important; font-size: 13px !important; font-weight: 800 !important; white-space: nowrap !important; }
  #tp-floating-check-cta.tp-collapsed { border-radius: 999px !important; padding: 4px !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-btn { border-radius: 999px !important; padding: 6px 12px !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-main,
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-sub,
  #tp-floating-check-cta.tp-collapsed #tp-floating-threshold-btn { display: none !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-count { display: inline !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-cta-collapse { border-radius: 999px !important; border: none !important; margin-left: 2px !important; }
  @media (max-width: 600px) {
    #tp-floating-check-sub { display: none !important; }
    #tp-floating-check-cta { left: 8px !important; bottom: 8px !important; }
  }
`;

const SHADOW_MODAL_STYLES = `
  :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  #tp-settings-fab {
    position: fixed;
    bottom: 14px;
    right: 14px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(30,41,59,0.85);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.15);
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    cursor: pointer;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f1f5f9;
    opacity: 0.5;
    transition: all 0.3s ease;
  }
  #tp-settings-fab:hover {
    background: rgba(16,185,129,0.9);
    transform: scale(1.05);
    opacity: 1;
  }
  #tp-settings-fab:focus-visible {
    opacity: 1;
    outline: 2px solid #34d399;
    outline-offset: 2px;
  }
  #tp-settings-fab svg { width: 24px; height: 24px; }
  dialog#tp-settings-dialog {
    box-sizing: border-box;
    width: 92%;
    max-width: 500px;
    max-height: 85vh;
    background: rgba(30,41,59,0.95);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 20px 25px rgba(0,0,0,0.5);
    border-radius: 16px;
    color: #f8fafc;
    padding: 24px;
    margin: auto;
  }
  dialog#tp-settings-dialog::backdrop { background: rgba(15,23,42,0.5); backdrop-filter: blur(6px); }
  dialog#tp-settings-dialog h3 {
    margin: 0 0 18px;
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(to right, #34d399, #059669);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  #tp-settings-sections {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 55vh;
    overflow-y: auto;
  }
  .tp-settings-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
  .tp-settings-group label { font-size: 13px; font-weight: 600; color: #94a3b8; }
  #tp-basic-settings { display: flex; flex-direction: column; gap: 8px; }
  #tp-basic-settings .tp-settings-group { margin-bottom: 10px; }
  #tp-basic-settings label[title], #tp-basic-settings button[title] { cursor: help; }
  #tp-advanced-panel { background: rgba(139,92,246,0.07); border: 1px solid rgba(139,92,246,0.35); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  #tp-advanced-details { margin-top: 4px; }
  #tp-advanced-details > summary { display: flex; align-items: center; gap: 8px; background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.45); border-radius: 10px; padding: 10px 12px; margin-bottom: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
  #tp-advanced-details > summary:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
  .tp-field-dark { width: 100%; background: #1e293b; color: #f8fafc; border: 1px solid #475569; border-radius: 6px; padding: 6px 10px; font-size: 12px; margin-top: 4px; box-sizing: border-box; }
  select.tp-field-dark { font-size: 13px; }
  .tp-field-hint { display: block; margin-top: 4px; font-size: 11px; opacity: 0.85; }
  .tp-btn-row { display: flex; flex-direction: row; gap: 8px; }
  .tp-btn-row .tp-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; }
  #tp-import-config-file { display: none; }
  .tp-cache-row { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
  .tp-cache-row #tp-cache-stats-label { font-size: 12px; opacity: 0.85; }
  .tp-cache-row #tp-cache-clear-btn { padding: 4px 10px; font-size: 12px; }
  .tp-advanced-subheader { color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 6px; }
  .tp-segmented-control {
    display: flex;
    background: rgba(15,23,42,0.6);
    border-radius: 8px;
    padding: 2px;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .tp-segmented-control label {
    flex: 1;
    text-align: center;
    padding: 7px 10px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    border-radius: 6px;
    transition: all 0.2s ease;
  }
  .tp-segmented-control input[type="radio"] { display: none; }
  .tp-segmented-control label:hover { color: #f1f5f9; }
  .tp-segmented-control input[type="radio"]:checked + label {
    background: #10b981;
    color: #fff;
  }
  .tp-segmented-control-blue input[type="radio"]:checked + label { background: #3b82f6 !important; }
  .tp-range-container { display: flex; align-items: center; gap: 12px; }
  .tp-range-container input[type="range"] { flex: 1; accent-color: #10b981; }
  .tp-range-container.tp-blue input[type="range"] { accent-color: #3b82f6; }
  .tp-range-container.tp-rose input[type="range"] { accent-color: #f43f5e; }
  .tp-range-container input[type="number"] {
    width: 60px;
    padding: 4px 8px;
    background: rgba(15,23,42,0.6);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: #fff;
    font-size: 12px;
    text-align: center;
  }
  .tp-textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 70px;
    padding: 8px 10px;
    background: rgba(15,23,42,0.6);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: #f8fafc;
    font: inherit;
    font-size: 12px;
  }
  .tp-switch-container { display: flex; align-items: center; justify-content: space-between; }
  .tp-switch-label { display: flex; flex-direction: column; gap: 2px; }
  .tp-switch-desc { font-size: 11px; color: #64748b; }
  .tp-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
  .tp-switch input { opacity: 0; width: 0; height: 0; }
  .tp-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: rgba(15,23,42,0.6);
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,0.1);
    transition: .3s;
  }
  .tp-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: #94a3b8;
    border-radius: 50%;
    transition: .3s;
  }
  .tp-switch input:checked + .tp-slider { background-color: #10b981; }
  .tp-switch.tp-blue input:checked + .tp-slider { background-color: #3b82f6; }
  .tp-switch.tp-rose input:checked + .tp-slider { background-color: #f43f5e; }
  .tp-switch.tp-purple input:checked + .tp-slider { background-color: #8b5cf6; }
  .tp-switch input:checked + .tp-slider:before { transform: translateX(20px); background-color: #fff; }
  .tp-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .tp-btn {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }
  .tp-btn-secondary { background: rgba(255,255,255,0.08); color: #94a3b8; }
  .tp-btn-secondary:hover { background: rgba(255,255,255,0.15); color: #fff; }
  .tp-btn-primary {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #fff;
    box-shadow: 0 4px 12px rgba(16,185,129,0.3);
  }
  #tp-toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100000;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
  }
  .tp-toast {
    background: rgba(15,23,42,0.96);
    border: 1px solid rgba(56,189,248,0.3);
    color: #f8fafc;
    padding: 9px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 6px 20px rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    gap: 10px;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .tp-toast.fade-out { opacity: 0; transform: translateY(6px); }
  .tp-btn:focus-visible, .tp-field-dark:focus-visible,
  .tp-switch input:focus-visible + .tp-slider,
  .tp-segmented-control input:focus-visible + label { outline: 2px solid #a78bfa !important; outline-offset: 2px !important; }
  @media (prefers-reduced-motion: reduce) {
    #tp-settings-fab, .tp-switch .tp-slider, .tp-switch .tp-slider:before, .tp-segmented-control label, .tp-toast { transition: none !important; }
  }
  @media (prefers-contrast: more) {
    .tp-switch-desc, .tp-advanced-subheader, .tp-cache-row #tp-cache-stats-label { opacity: 1 !important; }
    .tp-field-dark { border-width: 2px !important; }
  }
`;

(() => {
  'use strict';

  // ─── MODULE: src/page/selectors.js ──────────────────────────────────────────
  /**
   * Immutable Central Selector Registry for Toppreise.ch DOM Elements
   */
  const SELECTORS = Object.freeze({
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

  // ─── MODULE: src/domain/price.js ────────────────────────────────────────────
  /**
   * Pure Price Domain Logic
   * Handles number formatting, integer cent conversions, canonical price resolution,
   * HTML price extraction, time-series anomaly sanitization, and rolling horizon statistics.
   */



  const priceToCents = p => Math.round((parseFloat(p) || 0) * 100);

  // True median: odd n takes the middle, even n averages the two middle
  // values (no upper-median bias from floor(n/2) indexing).
  const medianOf = sorted => {
    const n = sorted.length;
    if (n === 0) return 0;
    const mid = n >> 1;
    return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const parsePrice = str => {
    if (!str) return 0;
    let clean = str.replace(/[.–\-]\s*$/g, '.00');
    clean = clean.replace(/[^\d,.]/g, '').replace(/['’\s]/g, '');

    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    const lastSeparator = Math.max(lastComma, lastDot);

    if (lastSeparator === -1) {
      return parseFloat(clean) || 0;
    }

    const digitsAfterSeparator = clean.length - lastSeparator - 1;

    if (digitsAfterSeparator === 3) {
      clean = clean.replace(/[.,]/g, '');
    } else {
      const before = clean.substring(0, lastSeparator).replace(/[.,]/g, '');
      const after = clean.substring(lastSeparator + 1);
      clean = before + '.' + after;
    }

    return parseFloat(clean) || 0;
  };

  function extractCanonicalPrice(card) {
    if (!card) return { price: 0, el: null };

    if (!card._tpPriceInfo) {
      const mainPriceInfo = card.querySelector?.('.Plugin_PriceInformation, .price_information_product') || null;
      let fallbackShipping = null;
      let fallbackProduct = null;
      if (!mainPriceInfo && card.querySelector) {
        fallbackShipping = card.querySelector('.priceContainer.shippingPrice .Plugin_Price');
        fallbackProduct = card.querySelector('.priceContainer.productPrice .Plugin_Price');
      }
      card._tpPriceInfo = {
        mainPriceInfo,
        mainShipping: mainPriceInfo?.querySelector?.('.shippingPrice .Plugin_Price') || null,
        mainProduct: mainPriceInfo?.querySelector?.('.productPrice .Plugin_Price') || null,
        fallbackShipping,
        fallbackProduct
      };
    }

    const { mainPriceInfo, mainShipping, mainProduct, fallbackShipping, fallbackProduct } = card._tpPriceInfo;

    const useShipping = isShippingPriceActive(card);

    let priceEl = null;
    if (mainPriceInfo) {
      priceEl = useShipping
        ? (mainShipping || mainProduct)
        : (mainProduct || mainShipping);
    }

    if (!priceEl) {
      priceEl = useShipping
        ? (fallbackShipping || fallbackProduct)
        : (fallbackProduct || fallbackShipping);
    }

    return {
      price: priceEl ? parsePrice(priceEl.textContent) : 0,
      el: priceEl
    };
  }

  function parsePriceStatsFromHtml(html) {
    if (!html) return null;

    const hasDOMParser = typeof DOMParser !== 'undefined';
    const doc = hasDOMParser ? new DOMParser().parseFromString(html, 'text/html') : null;

    const extractPrice = titleText => {
      if (doc) {
        const titleEls = Array.from(doc.querySelectorAll('.title, .col-12.title, div'));
        const found = titleEls.find(el => el.textContent.trim().toLowerCase() === titleText.toLowerCase());
        if (found) {
          if (found.nextElementSibling?.classList.contains('Plugin_Price')) {
            const val = parsePrice(found.nextElementSibling.textContent);
            if (val > 0) return val;
          }
          const nextPrice = found.nextElementSibling?.querySelector?.('.chartProductPrice .Plugin_Price, .Plugin_Price');
          if (nextPrice) {
            const val = parsePrice(nextPrice.textContent);
            if (val > 0) return val;
          }
          const parentCol = found.closest?.('.col-4, .col-md-3, .col-md, .cell') ||
                            (found.parentElement && !found.parentElement.classList.contains('title') ? found.parentElement : null) ||
                            found.parentElement?.parentElement;
          const priceEl = parentCol?.querySelector?.('.chartProductPrice .Plugin_Price, .Plugin_Price');
          if (priceEl) {
            const val = parsePrice(priceEl.textContent);
            if (val > 0) return val;
          }
        }
      }
      const escapedTitle = titleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`${escapedTitle}[\\s\\S]{1,400}?class="[^"]*Plugin_Price[^"]*"[^>]*>\\s*(?:[A-Za-z]+\\s*)?([\\d.,'\\s]+)`, 'i');
      const match = html.match(reg);
      if (match && match[1]) {
        const val = parsePrice(match[1]);
        if (val > 0) return val;
      }
      return null;
    };

    const tiefstpreis = extractPrice('Tiefstpreis') ??
                        extractPrice('Prix le plus bas') ??
                        extractPrice('Prezzo più basso') ??
                        extractPrice('Lowest price');
    const hoechstpreis = extractPrice('Höchstpreis') ??
                         extractPrice('Prix le plus haut') ??
                         extractPrice('Prezzo più alto') ??
                         extractPrice('Highest price');
    const aktuellerToppreis = extractPrice('aktueller Toppreis') ??
                              extractPrice('Meilleur prix actuel') ??
                              extractPrice('Miglior prezzo attuale') ??
                              extractPrice('Current best price');

    if (tiefstpreis !== null) {
      return { tiefstpreis, hoechstpreis, aktuellerToppreis };
    }
    return null;
  }

  function sanitizeTimeSeries(points) {
    if (!points || points.length < 3) {
      return { cleanPoints: points || [], filteredOutliers: [] };
    }

    const sorted = [...points].sort((a, b) => a[0] - b[0]);
    const prices = sorted.map(p => p[1]).sort((a, b) => a - b);
    const rawMedian = prices[Math.floor(prices.length / 2)];

    if (rawMedian <= 0) {
      return { cleanPoints: sorted, filteredOutliers: [] };
    }

    const cleanPoints = [];
    const filteredOutliers = [];
    const n = sorted.length;

    for (let i = 0; i < n; i++) {
      const [ts, price] = sorted[i];
      // Symmetric glitch band: a point >60% off the median is a feed glitch
      // iff it is brief (<48h) with normal neighbours on both sides; a
      // sustained level shifts the regime and is kept. Edges need only the
      // single adjacent neighbour (no duration context).
      const dev = Math.abs(price - rawMedian) / rawMedian;
      if (dev <= 0.6) {
        cleanPoints.push(sorted[i]);
        continue;
      }

      const isNormal = p => Math.abs(p - rawMedian) / rawMedian <= 0.6;
      let isGlitch = false;
      if (i > 0 && i < n - 1) {
        const nextTs = sorted[i + 1][0];
        const durationHours = (nextTs && ts && nextTs > ts) ? (nextTs - ts) / (3600 * 1000) : 24;
        if (durationHours < 48 && isNormal(sorted[i - 1][1]) && isNormal(sorted[i + 1][1])) {
          isGlitch = true;
        }
      } else if (i === 0 && n > 1) {
        if (isNormal(sorted[1][1])) isGlitch = true;
      } else if (i === n - 1 && n > 1) {
        if (isNormal(sorted[n - 2][1])) isGlitch = true;
      }

      if (isGlitch) {
        filteredOutliers.push({ timestamp: ts, price, rawMedian });
      } else {
        cleanPoints.push(sorted[i]);
      }
    }

    return {
      cleanPoints: cleanPoints.length >= 2 ? cleanPoints : sorted,
      filteredOutliers
    };
  }

  function analyzePriceTimeSeries(series, currentPrice = null) {
    if (!series || !Array.isArray(series) || series.length === 0) return null;

    let rawPoints = series;
    if (Array.isArray(series[0]) && series[0].length > 0 && Array.isArray(series[0][0])) {
      rawPoints = series[0];
    }

    const rawParsedPoints = rawPoints.map(p => {
      if (Array.isArray(p) && p.length >= 2) {
        const ts = typeof p[0] === 'number' ? p[0] : parseInt(p[0], 10);
        const pr = typeof p[1] === 'number' ? p[1] : parsePrice(String(p[1]));
        return pr > 0 ? [ts, pr] : null;
      }
      if (p && typeof p.price === 'number' && p.price > 0) {
        return [p.timestamp || p.time || 0, p.price];
      }
      return null;
    }).filter(Boolean);

    if (rawParsedPoints.length === 0) return null;

    const outlierRejectionEnabled = (CONFIG.OUTLIER_REJECTION_ENABLED !== false);
    const sanitizeResult = outlierRejectionEnabled
      ? sanitizeTimeSeries(rawParsedPoints)
      : { cleanPoints: rawParsedPoints, filteredOutliers: [] };

    const points = sanitizeResult.cleanPoints;
    const filteredOutliers = sanitizeResult.filteredOutliers;

    const prices = points.map(p => p[1]);
    const curr = (typeof currentPrice === 'number' && currentPrice > 0) ? currentPrice : prices[prices.length - 1];
    const allTimeLow = Math.min(...prices);
    const allTimeHigh = Math.max(...prices);

    // Trailing-plateau walk: only points already AT (or below) the current price
    // belong to the current regime. Strict cent comparison — the old 1% band
    // swallowed sub-1% dips into the plateau and overstated micro-records.
    const currCents = priceToCents(curr);
    let idx = prices.length - 1;
    while (idx > 0 && priceToCents(prices[idx]) <= currCents) {
      idx--;
    }
    const historicalPrices = prices.slice(0, idx + 1);
    const previousLow = historicalPrices.length > 0 ? Math.min(...historicalPrices) : allTimeLow;

    const horizonDays = typeof CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS === 'number'
      ? CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS
      : 365;
    // Thin windows (< 3 points) fall back to the full history — flagged via
    // medianFallback so labels stay honest ("Lifetime", never "1J").
    let windowPrices = prices;
    let medianFallback = false;
    if (horizonDays > 0) {
      const now = Date.now();
      const cutoffTime = now - horizonDays * 86400 * 1000;
      const windowPoints = points.filter(p => p[0] >= cutoffTime);
      if (windowPoints.length >= 3) {
        windowPrices = windowPoints.map(p => p[1]);
      } else {
        medianFallback = true;
      }
    }

    // Chart sampling is daily & uniform (verified live: 607–3825 pts per
    // product, max gap 1.0d) — equal-weight median == time-weighted median,
    // so no duration weighting is needed.
    const sortedWindow = [...windowPrices].sort((a, b) => a - b);
    const medianPrice = medianOf(sortedWindow);

    const isNewAllTimeLow = previousLow > 0 && priceToCents(curr) < priceToCents(previousLow);

    const realDiscountVsPrevLow = (previousLow > 0 && isNewAllTimeLow)
      ? Math.round(((previousLow - curr) / previousLow) * 100)
      : 0;

    const realDiscountVsMedian = (medianPrice > curr)
      ? Math.round(((medianPrice - curr) / medianPrice) * 100)
      : 0;

    return {
      tiefstpreis: allTimeLow,
      hoechstpreis: allTimeHigh,
      previousLow: previousLow > 0 ? previousLow : null,
      medianPrice: Math.round(medianPrice * 100) / 100,
      medianFallback,
      horizonDays,
      filteredOutliers,
      isNewAllTimeLow,
      realDiscountVsPrevLow,
      realDiscountVsMedian,
      dataPointCount: points.length,
      timeSeries: points
    };
  }

  /**
   * Live-anchored record reference for one concrete offer price.
   * The cached analysis anchors its trailing-plateau walk at the series' last
   * point, which lags live offers (daily sampling): a fresh undercut then
   * reports an ancient regime low as "Bisher". Re-running the same walk
   * anchored at the live card price returns exactly what the analysis would
   * have produced had it known the price — same walk, right anchor.
   * Stats without a series (HTML fallback) keep their stored values.
   */
  function recordRefForPrice(stats, cardPrice) {
    const stored = { previousLow: stats?.previousLow ?? null, isNewRecord: !!stats?.isNewAllTimeLow };
    const pts = stats?.timeSeries;
    if (!(cardPrice > 0) || !Array.isArray(pts) || pts.length === 0) return stored;
    const cCents = priceToCents(cardPrice);
    const priceOf = p => (Array.isArray(p) ? p[1] : p?.price);
    let idx = pts.length - 1;
    while (idx > 0 && priceToCents(priceOf(pts[idx])) <= cCents) idx--;
    const hist = pts.slice(0, idx + 1).map(priceOf).filter(p => typeof p === 'number' && p > 0);
    if (hist.length === 0) return stored;
    const prevLow = Math.min(...hist);
    return { previousLow: prevLow, isNewRecord: prevLow > 0 && cCents < priceToCents(prevLow) };
  }

  // ─── MODULE: src/domain/deal-score.js ───────────────────────────────────────
  /**
   * Pure Deal Scoring & State Logic
   * Evaluates deal classification (new record low, matching all-time low, above low)
   * and continuous weighted deal quality scoring.
   */



  // Display thresholds (documented in UI: badge titles, heatmap toggle, settings).
  // Badge % is the Gewichtete Differenz (weight-blended Ø-discount +
  // record-margin) — never the unverified site Differenz once history is verified.
  const HEAT_NEUTRAL_DEADBAND_PCT = 5;
  const MIN_SIGNIFICANT_RECORD_PCT = 2;


  function computeDealScore(stats, cardPrice) {
    if (!stats || stats.unavailable || !stats.tiefstpreis || stats.tiefstpreis <= 0) return null;
    if (!cardPrice || cardPrice <= 0) return null;

    // History Qualification Gate:
    // Minimum 5 historical points if timeSeries is present, and >2% variance across history
    const pointsCount = stats.dataPointCount ?? (Array.isArray(stats.timeSeries) ? stats.timeSeries.length : (stats.timeSeries ? 0 : 5));
    if (pointsCount < 5) return null;
    if (stats.hoechstpreis && stats.tiefstpreis > 0 &&
        ((stats.hoechstpreis - stats.tiefstpreis) / stats.tiefstpreis) < 0.02) {
      return null;
    }

    const isAtLow = priceToCents(cardPrice) <= priceToCents(stats.tiefstpreis);
    if (!isAtLow) return null; // Auto-hide non-bestpreise

    // Live-anchored: the stored flag is relative to the (lagging) series-last
    // point, not to this offer — re-derive it per card (fallback stats without
    // a series keep their stored values).
    const liveRec = recordRefForPrice(stats, cardPrice);
    const isNewRecord = liveRec.isNewRecord;
    // Defensive fallback chain: series stats always carry a median; only
    // exotic hand-built stats fall through to the mean (or 0 = unscorable).
    const dMedian = (stats.medianPrice && stats.medianPrice > cardPrice)
      ? Math.round(((stats.medianPrice - cardPrice) / stats.medianPrice) * 100)
      : (stats.realDiscountVsMedian || 0);

    const prevLow = liveRec.previousLow;
    const dRecord = (isNewRecord && prevLow && prevLow > cardPrice)
      ? Math.round(((prevLow - cardPrice) / prevLow) * 100)
      : (isNewRecord ? (stats.realDiscountVsPrevLow || 0) : 0);

    const wRecord = typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number'
      ? CONFIG.BESTPREISE_WEIGHT_RECORD
      : 0.50;
    // Qualification is weight-independent: a Tiefstpreis qualifies on real
    // saving in EITHER component. Gating on the blend hid every
    // non-record at 100% Rek (0×Ø + 1×0 = 0) although the slider only promises
    // "Sortierung + Farb-Emphase", never filtering. Clamp to >= 1 so qualified
    // deals keep sorting above unchecked cards (0) and hidden non-deals (-100).
    if (dMedian <= 0 && dRecord <= 0) return null;
    const wMedian = 1 - wRecord;
    const weightedDiff = Math.max(1, Math.round(wMedian * dMedian + wRecord * dRecord));

    return {
      weightedDiff,
      dMedian,
      dRecord,
      isNewRecord,
      prevLow,
      medianPrice: stats.medianPrice
    };
  }

  /**
   * Display delta (deal EVENT): new-low / at-low / above-low classification.
   * Works with minimal stats ({tiefstpreis} + card price); no
   * history-quality gates — those only gate the ranking blend, never the event.
   * - new-low  -> { kind:'new-low', dRecord }  (extra saving vs previous low)
   * - at-low   -> { kind:'at-low' }            (no new saving)
   * - above-low-> { kind:'above-low', markup } (premium vs all-time low)
   */
  function getDisplayDelta(cardPrice, stats) {
    if (!cardPrice || !stats?.tiefstpreis || cardPrice <= 0 || stats.tiefstpreis <= 0) {
      return { kind: 'unknown' };
    }
    const cPrice = priceToCents(cardPrice);
    const cLow = priceToCents(stats.tiefstpreis);
    // Live-anchored like the blend: the series lags the offer, so the stored
    // regime low/flag (relative to series-last) is re-derived per card price.
    // Series-less fallback stats keep their stored values.
    const liveRec = recordRefForPrice(stats, cardPrice);
    if (cPrice < cLow || (cPrice === cLow && liveRec.isNewRecord)) {
      const prevLow = liveRec.previousLow;
      // dRecordRaw drives the significance decision; the rounded dRecord is
      // display only — a true 1.96% dip must not flip the 2% gate by rounding.
      let dRecord = 0;
      let dRecordRaw = 0;
      if (prevLow && prevLow > cardPrice) {
        dRecordRaw = ((prevLow - cardPrice) / prevLow) * 100;
        dRecord = Math.round(dRecordRaw);
      } else if (stats.realDiscountVsPrevLow) {
        dRecord = stats.realDiscountVsPrevLow;
        dRecordRaw = stats.realDiscountVsPrevLow;
      }
      return { kind: 'new-low', dRecord, dRecordRaw, prevLow: prevLow ?? null };
    }
    if (cPrice === cLow) {
      return { kind: 'at-low', dRecord: 0, dRecordRaw: 0, prevLow: liveRec.previousLow };
    }
    return {
      kind: 'above-low',
      markup: Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100)
    };
  }

  /** Only records with a meaningful breakthrough earn the "Rekord" badge style;
   *  1-cent micro-dips render as plain "Tiefstpreis". Decided on the raw value
   *  (inclusive 2.0 boundary), never the rounded display number. */
  function isSignificantRecord(display) {
    return !!display && display.kind === 'new-low'
      && (typeof display.dRecordRaw === 'number' ? display.dRecordRaw : (display.dRecord || 0)) >= MIN_SIGNIFICANT_RECORD_PCT;
  }

  /**
   * Ø discount vs median, positive = below median (deal), 0 = at/above median
   * or no median. The exact formula the badge headline uses — shared by the
   * heat driver so both always consume the same number (ADR-0002).
   * With signed=true returns the signed level vs median (negative = below
   * median, positive = above, null = no median) for discount-desc sorting.
   */
  function getLevelPct(cardPrice, stats, signed = false) {
    const median = stats?.medianPrice;
    if (!cardPrice || !median || cardPrice <= 0 || median <= 0) return signed ? null : 0;
    if (signed) return Math.round(((cardPrice - median) / median) * 100);
    if (median <= cardPrice) return 0;
    return Math.round(((median - cardPrice) / median) * 100);
  }

  /**
   * Honest horizon label for the Ø line. The window label (1J / 180T / …) is
   * only shown when the median really comes from that window — lifetime
   * fallbacks (thin history) and the lifetime setting both read "Lifetime".
   * Legacy cache entries predate medianFallback and keep the old window label
   * until they refresh.
   */
  function medianHorizonLabel(stats) {
    if (stats && stats.horizonDays > 0 && !stats.medianFallback) {
      return stats.horizonDays >= 365 ? '1J' : `${stats.horizonDays}T`;
    }
    return 'Lifetime';
  }

  /**
   * Single heat driver (ADR-0005: badge shows the blend, heat/sort follow it).
   * One computation feeds BOTH the card heat and the badge number, so the
   * ribbon number always matches its color. Returns
   * { value, provisional, pct, kind }:
   * - verified deal   -> blend % the badge shows (weight-blended Ø-discount +
   *                      record-margin at the slider mix), null inside the ±5%
   *                      deadband (number still prints, card stays gray)
   * - verified markup -> null (no deal, no color — the +XX% badge text
   *                      carries the markup signal)
   * - verified but unqualified (thin/flat history, no dealData) -> null
   * - unverified deal -> site Differenz, flagged provisional (striped-gray via tp-is-unverified, never heated)
   * - unverified markup / unknown -> null (neutral)
   * Callers pass the mode positionally so the heat reuses the exact mode of the
   * badge branch (no parallel formulas). The optional 5th parameter takes an
   * already-computed dealScore (undefined = not provided, compute inside;
   * null = computed-unqualified, never recompute).
   */
  function getHeatInput(cardPrice, stats, siteDiff, mode, precomputed = undefined) {
    const verified = !!stats && stats.tiefstpreis > 0 && cardPrice > 0;
    if (verified) {
      const display = getDisplayDelta(cardPrice, stats);
      if (display.kind !== 'new-low' && display.kind !== 'at-low') {
        return { value: null, provisional: false, pct: 0, kind: 'markup' };
      }
      const weight = typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number' ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50;
      const levelRaw = (stats && stats.medianPrice > 0 && cardPrice > 0 && stats.medianPrice > cardPrice)
        ? ((stats.medianPrice - cardPrice) / stats.medianPrice) * 100 : 0;
      const recordRaw = (display && typeof display.dRecordRaw === 'number')
        ? display.dRecordRaw : (display.dRecord || 0);
      const dealData = precomputed === undefined ? computeDealScore(stats, cardPrice) : precomputed;
      // Unqualified history: no blend to show — heat stays neutral to match.
      if (!dealData) return { value: null, provisional: false, pct: 0, kind: 'none' };
      const pct = dealData.weightedDiff;
      // ±5% deadband (documented noise guard): a tiny blend shows in the
      // badge text but stays gray on the card — decided on the raw blend.
      const rawBlend = (1 - weight) * levelRaw + weight * recordRaw;
      if (!(rawBlend >= HEAT_NEUTRAL_DEADBAND_PCT)) return { value: null, provisional: false, pct, kind: 'blend' };
      return { value: -pct, provisional: false, pct, kind: 'blend' };
    }
    if (typeof siteDiff === 'number' && !isNaN(siteDiff)) {
      // Unverified markup (positive) -> neutral; only real discounts heat.
      if (siteDiff > -HEAT_NEUTRAL_DEADBAND_PCT) {
        const pct = siteDiff < 0 ? -siteDiff : 0;
        return { value: null, provisional: siteDiff < 0, pct, kind: siteDiff < 0 ? 'unverified' : 'unknown' };
      }
      return { value: siteDiff, provisional: true, pct: -siteDiff, kind: 'unverified' };
    }
    return { value: null, provisional: false, pct: 0, kind: 'unknown' };
  }

  // ─── MODULE: src/scanner/cache.js ───────────────────────────────────────────
  /**
   * Bounded Price History Cache Contract
   * Provides in-memory LRU cache (capped at MAX_MEMORY_CACHE_ITEMS = 500)
   * backed by localStorage with configurable TTL and auto-pruning.
   */



  const STATS_CACHE_PREFIX = 'tp_hist_v1_';
  const MAX_MEMORY_CACHE_ITEMS = 500;

  const memoryCache = new Map();

  function isCacheEntryFresh(parsed, ignoreNegativeCache = false) {
    if (!parsed) return false;
    const ageMs = Date.now() - (parsed.time || 0);

    if (parsed.unavailable) {
      if (ignoreNegativeCache) return false;
      const negHours = CONFIG.NEGATIVE_CACHE_HOURS;
      const negTtlMs = (negHours || 2) * 3600 * 1000;
      return ageMs < negTtlMs;
    }

    const realHours = CONFIG.REAL_DEAL_CACHE_HOURS;
    const ttlMs = (realHours || 48) * 3600 * 1000;
    return ageMs < ttlMs;
  }

  function prunePriceStatsCache(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!storage) return;
    try {
      const now = Date.now();
      const maxAgeMs = 14 * 24 * 3600 * 1000;
      const entries = [];
      const keysToRemove = [];

      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(STATS_CACHE_PREFIX)) {
          try {
            const val = JSON.parse(storage.getItem(key) || '{}');
            const age = now - (val.time || 0);
            if (!val.time || age > maxAgeMs) {
              keysToRemove.push(key);
            } else {
              entries.push({ key, time: val.time });
            }
          } catch (e) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(k => storage.removeItem(k));

      if (entries.length > 300) {
        entries.sort((a, b) => a.time - b.time);
        entries.slice(0, entries.length - 250).forEach(e => storage.removeItem(e.key));
      }
    } catch (e) {}
  }

  function evictIfFull() {
    if (memoryCache.size > MAX_MEMORY_CACHE_ITEMS) {
      memoryCache.delete(memoryCache.keys().next().value);
    }
  }

  function getCachedPriceStats(productId, ignoreNegativeCache = false, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!productId) return null;
    // Mode guard: the series is picked per shipping mode at fetch time and the
    // key is bare, so a cross-mode entry would compare the wrong baseline
    // (same wrong-"Bisher" class as a stale series anchor). Legacy entries
    // without the flag pass through; explicit mismatches read as a miss and
    // self-heal via refetch on the next scan.
    const isModeMatch = entry => {
      if (typeof entry?.isShippingPrice !== 'boolean') return true;
      try {
        return entry.isShippingPrice === isShippingPriceActive();
      } catch (e) { return true; }
    };
    try {
      if (memoryCache.has(productId)) {
        const memData = memoryCache.get(productId);
        if (isCacheEntryFresh(memData, ignoreNegativeCache)) {
          if (!isModeMatch(memData)) {
            memoryCache.delete(productId);
          } else {
            // LRU update
            memoryCache.delete(productId);
            memoryCache.set(productId, memData);
            return memData;
          }
        } else {
          memoryCache.delete(productId);
        }
      }

      const raw = storage?.getItem(STATS_CACHE_PREFIX + productId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      if (isCacheEntryFresh(parsed, ignoreNegativeCache)) {
        if (!isModeMatch(parsed)) return null;
        memoryCache.set(productId, parsed);
        evictIfFull();
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  function setCachedPriceStats(productId, stats, isUnavailable = false, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!productId) return;
    // Upgrade-only: never replace median-bearing stats with median-less
    // fallback stats. A refresh that lands on the HTML fallback (tiefstpreis
    // only) must not regress a full analysis — the badge would keep its old %
    // while the heat goes neutral. Unavailable-markers keep current semantics.
    if (!isUnavailable && stats && !stats.medianPrice && memoryCache.has(productId)) {
      const prev = memoryCache.get(productId);
      if (prev && !prev.unavailable && prev.medianPrice) return;
    }
    const payload = isUnavailable
      ? { unavailable: true, time: Date.now() }
      : { ...stats, time: Date.now() };

    memoryCache.set(productId, payload);
    evictIfFull();

    try {
      prunePriceStatsCache(storage);
      storage?.setItem(STATS_CACHE_PREFIX + productId, JSON.stringify(payload));
    } catch (e) {}
  }

  function countCachedPriceStats(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    let count = 0;
    try {
      if (storage) {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith(STATS_CACHE_PREFIX)) {
            count++;
          }
        }
      }
    } catch (e) {}
    return count;
  }


  function clearPriceStatsCache(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    memoryCache.clear();
    let count = 0;
    try {
      if (storage) {
        const keysToRemove = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith(STATS_CACHE_PREFIX)) {
            keysToRemove.push(key);
          }
        }
        count = keysToRemove.length;
        keysToRemove.forEach(k => storage.removeItem(k));
      }
    } catch (e) {}
    return count;
  }

  // ─── MODULE: src/state/config.js ────────────────────────────────────────────
  /**
   * Configuration & Persistent Settings State Layer
   * Manages defaults, GM_getValue/localStorage synchronization,
   * active configuration object, and bidirectional UI control sync.
   */


  // One vocabulary everywhere: the Gewichtete Differenz (weight-blended
  // Ø-discount + record margin) prints on the badge and drives color + order.
  // The worked example uses fixed demo numbers so dragging the slider visibly
  // moves the result (Rek −10%, Ø −25%).
  function weightText(weightRecord, style) {
    const w = weightRecord ?? 0.50;
    if (style === 'short') {
      const n = Math.round(w * 20) / 20;
      if (n === 1.00) return '100% Rek';
      if (n === 0.70) return '70/30';
      if (n === 0.50) return '50/50';
      if (n === 0.30) return '30/70';
      if (n === 0.00) return '100% Med';
      return `${Math.round(w * 100)}% Rek`;
    }
    if (style === 'title') {
      const pctRec = Math.round(w * 100);
      return `Tiefstpreis-Gewichtung: ${100 - pctRec}% Ø-Preis / ${pctRec}% Rekord — Reihenfolge + Farb-Emphase, Badge zeigt die Gewichtete Differenz.`;
    }
    const pct = Math.round(w * 100);
    const weightedDiff = Math.round(((100 - pct) * 25 + pct * 10) / 100);
    const base = pct === 100 ? 'Rekord-Sortierung (100% Rekord / 0% Ø-Preis)'
      : pct === 0 ? 'Ø-Sortierung (0% Rekord / 100% Ø-Preis)'
      : `${pct}% Rekord / ${100 - pct}% Ø-Preis`;
    return `${base} (Sortierung + Farb-Emphase) · z.B. Rek −10% + Ø −25% → Gewichtete Differenz ${weightedDiff}`;
  }

  const DEFAULTS = Object.freeze({
    FILTER_NEG_ENABLED: true,
    FILTER_MIN_ENABLED: true,
    MODE: 'dim',
    MARGIN_PERCENT: 0.0,
    DIM_OPACITY: 0.25,
    USE_SHIPPING_PRICE: true,
    HEATMAP_ENABLED: true,
    HEATMAP_INTENSITY: 1.0,
    REAL_DEAL_MIN_DISCOUNT: 30,
    REAL_DEAL_CACHE_HOURS: 48,
    NEGATIVE_CACHE_HOURS: 2,
    BESTPREISE_MODE_ACTIVE: false,
    BESTPREISE_HIDE_UNCHECKED: false,
    BESTPREISE_WEIGHT_RECORD: 0.50,
    BESTPREISE_MEDIAN_HORIZON_DAYS: 365,
    OUTLIER_REJECTION_ENABLED: true,
    ENABLE_SPARKLINES: true,
    NEGATIVE_TERMS: '',
    DISCORD_WEBHOOK_URL: '',
    MIN_OFFERS: 0,
    SORT_BY_OFFERS: 'none',
    ALARM_ENABLED: true,
    ALARM_TARGET_PERCENT: 0.60,
    ALARM_DURATION_DAYS: '730',
    ALARM_AUTO_SUBMIT: true,
    OBSERVER_DEBOUNCE_MS: 200,
    SHOW_ADVANCED: false,
    DEBUG: true
  });

  // Compact GM_getValue + localStorage mirror. Writes go to both layers so a
  // domain backup survives script reinstalls; reads prefer GM, fall back to
  // the backup (reinstall recovery), then def. Corrupt JSON never throws.
  const safeJsonParse = (raw, fallback) => {
    try {
      const v = JSON.parse(raw ?? 'null');
      return v ?? fallback;
    } catch {
      return fallback;
    }
  };
  // Bearer-Secrets (Discord-Webhook) bleiben GM-privat: nie ins page-lesbare localStorage.
  const SECRET_KEYS = new Set(['DISCORD_WEBHOOK_URL']);

  const _getValue = (k, def) => {
    try {
      if (typeof GM_getValue !== 'undefined') {
        const gv = GM_getValue(k);
        if (gv !== undefined && gv !== null) return gv;
      }
    } catch { /* fall through to domain backup */ }
    try {
      if (!SECRET_KEYS.has(k) && typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tp_suite_v2_' + k);
        if (raw !== null) return safeJsonParse(raw, def);
      }
    } catch { /* fall through to def */ }
    return def;
  };
  const _setValue = (k, v) => {
    try { if (typeof GM_setValue !== 'undefined') GM_setValue(k, v); } catch { /* ignore */ }
    // Secrets nie ins page-lesbare localStorage spiegeln (GM bleibt privat).
    if (!SECRET_KEYS.has(k)) try { if (typeof localStorage !== 'undefined') localStorage.setItem('tp_suite_v2_' + k, JSON.stringify(v)); } catch { /* storage full/private mode */ }
  };

  const CONFIG = {
    FILTER_NEG_ENABLED: _getValue('FILTER_NEG_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_NEG_ENABLED)),
    FILTER_MIN_ENABLED: _getValue('FILTER_MIN_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_MIN_ENABLED)),
    MODE: _getValue('MODE', DEFAULTS.MODE),
    MARGIN_PERCENT: parseFloat(_getValue('MARGIN_PERCENT', DEFAULTS.MARGIN_PERCENT)),
    DIM_OPACITY: parseFloat(_getValue('DIM_OPACITY', DEFAULTS.DIM_OPACITY)),
    USE_SHIPPING_PRICE: _getValue('USE_SHIPPING_PRICE', DEFAULTS.USE_SHIPPING_PRICE),
    HEATMAP_ENABLED: _getValue('HEATMAP_ENABLED', DEFAULTS.HEATMAP_ENABLED),
    HEATMAP_INTENSITY: parseFloat(_getValue('HEATMAP_INTENSITY', DEFAULTS.HEATMAP_INTENSITY)),
    REAL_DEAL_MIN_DISCOUNT: parseInt(_getValue('REAL_DEAL_MIN_DISCOUNT', DEFAULTS.REAL_DEAL_MIN_DISCOUNT)),
    REAL_DEAL_CACHE_HOURS: parseInt(_getValue('REAL_DEAL_CACHE_HOURS', DEFAULTS.REAL_DEAL_CACHE_HOURS)),
    NEGATIVE_CACHE_HOURS: parseInt(_getValue('NEGATIVE_CACHE_HOURS', DEFAULTS.NEGATIVE_CACHE_HOURS)),
    BESTPREISE_MODE_ACTIVE: _getValue('BESTPREISE_MODE_ACTIVE', DEFAULTS.BESTPREISE_MODE_ACTIVE),
    BESTPREISE_HIDE_UNCHECKED: _getValue('BESTPREISE_HIDE_UNCHECKED', DEFAULTS.BESTPREISE_HIDE_UNCHECKED),
    BESTPREISE_WEIGHT_RECORD: parseFloat(_getValue('BESTPREISE_WEIGHT_RECORD', DEFAULTS.BESTPREISE_WEIGHT_RECORD)),
    BESTPREISE_MEDIAN_HORIZON_DAYS: parseInt(_getValue('BESTPREISE_MEDIAN_HORIZON_DAYS', DEFAULTS.BESTPREISE_MEDIAN_HORIZON_DAYS)),
    OUTLIER_REJECTION_ENABLED: _getValue('OUTLIER_REJECTION_ENABLED', DEFAULTS.OUTLIER_REJECTION_ENABLED),
    ENABLE_SPARKLINES: _getValue('ENABLE_SPARKLINES', DEFAULTS.ENABLE_SPARKLINES),
    NEGATIVE_TERMS: _getValue('NEGATIVE_TERMS', DEFAULTS.NEGATIVE_TERMS),
    DISCORD_WEBHOOK_URL: _getValue('DISCORD_WEBHOOK_URL', DEFAULTS.DISCORD_WEBHOOK_URL),
    MIN_OFFERS: parseInt(_getValue('MIN_OFFERS', DEFAULTS.MIN_OFFERS)),
    SORT_BY_OFFERS: _getValue('SORT_BY_OFFERS', DEFAULTS.SORT_BY_OFFERS),
    ALARM_ENABLED: _getValue('ALARM_ENABLED', DEFAULTS.ALARM_ENABLED),
    ALARM_TARGET_PERCENT: parseFloat(_getValue('ALARM_TARGET_PERCENT', DEFAULTS.ALARM_TARGET_PERCENT)),
    ALARM_DURATION_DAYS: String(_getValue('ALARM_DURATION_DAYS', DEFAULTS.ALARM_DURATION_DAYS)),
    ALARM_AUTO_SUBMIT: _getValue('ALARM_AUTO_SUBMIT', DEFAULTS.ALARM_AUTO_SUBMIT),
    OBSERVER_DEBOUNCE_MS: parseInt(_getValue('OBSERVER_DEBOUNCE_MS', DEFAULTS.OBSERVER_DEBOUNCE_MS)),
    SHOW_ADVANCED: _getValue('SHOW_ADVANCED', DEFAULTS.SHOW_ADVANCED),
    DEBUG: _getValue('DEBUG', DEFAULTS.DEBUG)
  };

  const saveConfigKey = (key, val) => {
    CONFIG[key] = val;
    _setValue(key, val);
  };


  function updateBodyClasses() {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.classList.remove('tp-mode-dim', 'tp-mode-hide', 'tp-mode-highlight-only');
    document.body.classList.add(`tp-mode-${CONFIG.MODE}`);
    document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
  }

  function syncUiControl(key, val) {
    // 1. Sync Settings Modal (Shadow DOM) if open/exists
    const shadow = uiShadowRoot || (typeof document !== 'undefined' ? document.getElementById('tp-root')?.shadowRoot : null);
    if (shadow) {
      try {
        switch (key) {
          case 'MODE': {
            const el = shadow.querySelector(`input[name="tp-mode"][value="${val}"]`);
            if (el) el.checked = true;
            break;
          }
          case 'DIM_OPACITY': {
            const range = shadow.getElementById('tp-opacity-range');
            const label = shadow.getElementById('tp-opacity-val');
            if (range) range.value = val;
            if (label) label.value = Math.round(val * 100);
            break;
          }
          case 'HEATMAP_ENABLED': {
            const toggle = shadow.getElementById('tp-heatmap-enabled-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'BESTPREISE_MODE_ACTIVE': {
            const toggle = shadow.getElementById('tp-bestpreise-mode-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'BESTPREISE_HIDE_UNCHECKED': {
            const toggle = shadow.getElementById('tp-hide-unchecked-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'BESTPREISE_WEIGHT_RECORD': {
            const range = shadow.getElementById('tp-bestpreise-weight-range');
            const valEl = shadow.getElementById('tp-bestpreise-weight-val');
            const descEl = shadow.getElementById('tp-bestpreise-weight-desc');
            const pct = Math.round((val ?? 0.5) * 100);
            if (range) range.value = pct;
            if (valEl) valEl.value = pct;
            if (descEl) {
              descEl.textContent = weightText(val, 'desc');
            }
            // Toolbar slider mirrors the modal control (skip while dragging).
            if (typeof document !== 'undefined') {
              const barRange = document.getElementById('tp-bar-weight-range');
              if (barRange && document.activeElement !== barRange) barRange.value = pct;
              const barLabel = document.getElementById('tp-bar-weight-label');
              if (barLabel) {
                barLabel.textContent = `⚖️ ${weightText(val, 'short')}`;
                barLabel.title = weightText(val, 'title');
              }
            }
            break;
          }
          case 'REAL_DEAL_MIN_DISCOUNT': {
            const range = shadow.getElementById('tp-real-deal-min-range');
            const valEl = shadow.getElementById('tp-real-deal-min-val');
            if (range) range.value = val;
            if (valEl) valEl.value = val;
            break;
          }
          case 'USE_SHIPPING_PRICE': {
            const toggle = shadow.getElementById('tp-shipping-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'ENABLE_SPARKLINES': {
            const toggle = shadow.getElementById('tp-sparklines-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'SHOW_ADVANCED': {
            const details = shadow.getElementById('tp-advanced-details');
            if (details) details.open = !!val;
            break;
          }
        }
      } catch (err) {
        if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] syncUiControl error', err);
      }
    }

    // 2. Sync Inline Filter Bar if present
    if (typeof document !== 'undefined') {
      const bar = document.getElementById('tp-suite-filter-bar') || document.getElementById('tp-inline-filter-bar');
      if (bar) {
        try {
          switch (key) {
            case 'NEGATIVE_TERMS': {
              const input = bar.querySelector('#tp-inline-negative-input');
              const clearBtn = bar.querySelector('#tp-clear-neg-btn');
              if (input && document.activeElement !== input && input.value !== val) {
                input.value = val || '';
              }
              if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
              break;
            }
            case 'HEATMAP_ENABLED': {
              const heatBtn = bar.querySelector('#tp-bar-heat-btn');
              if (heatBtn) heatBtn.classList.toggle('tp-active', val !== false);
              break;
            }
            case 'BESTPREISE_MODE_ACTIVE': {
              const bpBtn = bar.querySelector('#tp-bar-bestpreise-btn');
              if (bpBtn) bpBtn.classList.toggle('tp-bestpreise-active', val === true);
              bar.classList.toggle('tp-bestpreise-bar', val === true);
              break;
            }
            case 'FILTER_NEG_ENABLED': {
              const toggle = bar.querySelector('#tp-toggle-neg');
              if (toggle) {
                if (toggle.tagName === 'INPUT') {
                  toggle.checked = !!val;
                  const title = `Negativ-Filter (Text) ${val ? 'AN' : 'AUS'}`;
                  const label = toggle.closest?.('.tp-mini-switch');
                  if (label) label.title = title;
                  const state = label?.querySelector('.tp-mini-state');
                  if (state) state.textContent = val ? 'ON' : 'OFF';
                  const scope = toggle.closest?.('.tp-bar-stepper-group, .tp-threshold-wrapper, .tp-input-wrapper, .tp-group');
                  const caption = scope?.querySelector('.tp-mini-caption');
                  if (caption) caption.title = title;
                } else {
                  toggle.classList.toggle('tp-active', !!val);
                  toggle.classList.toggle('tp-filter-off', !val);
                  toggle.title = `Negativ-Filter (Text) ${val ? 'AN' : 'AUS'}`;
                }
              }
              break;
            }
            case 'FILTER_MIN_ENABLED': {
              const toggle = bar.querySelector('#tp-toggle-min');
              if (toggle) {
                if (toggle.tagName === 'INPUT') {
                  toggle.checked = !!val;
                  const title = `Min-Angebote-Filter ${val ? 'AN' : 'AUS'}`;
                  const label = toggle.closest?.('.tp-mini-switch');
                  if (label) label.title = title;
                  const state = label?.querySelector('.tp-mini-state');
                  if (state) state.textContent = val ? 'ON' : 'OFF';
                  const scope = toggle.closest?.('.tp-bar-stepper-group, .tp-threshold-wrapper, .tp-input-wrapper, .tp-group');
                  const caption = scope?.querySelector('.tp-mini-caption');
                  if (caption) caption.title = title;
                } else {
                  toggle.classList.toggle('tp-active', !!val);
                  toggle.classList.toggle('tp-filter-off', !val);
                  toggle.title = `Min-Angebote-Filter ${val ? 'AN' : 'AUS'}`;
                }
              }
              break;
            }
            case 'MIN_OFFERS': {
              const minVal = bar.querySelector('#tp-bar-min-val');
              if (minVal) minVal.textContent = val;
              break;
            }
            case 'REAL_DEAL_MIN_DISCOUNT': {
              // Threshold lives only in the floating CTA (toolbar copy removed).
              const floatingThresh = document.getElementById('tp-floating-threshold-btn');
              if (floatingThresh) floatingThresh.textContent = `≥${val}% ▾`;
              document.querySelectorAll('#tp-floating-threshold-popover .tp-floating-option').forEach(btn => {
                btn.classList.toggle('tp-selected', parseInt(btn.dataset.val, 10) === val);
              });
              break;
            }
          }
        } catch (err) {
          if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] syncUiControl bar error', err);
        }
      }
    }
  }

  function updateConfig(key, val, options = {}) {
    saveConfigKey(key, val);
    if (!options.skipUiSync) {
      syncUiControl(key, val);
    }
    if (key === 'MODE' || key === 'DIM_OPACITY') {
      updateBodyClasses();
    }
    if (!options.skipRender && typeof processListings === 'function') {
      processListings();
    }
  }

  function updateConfigs(entries, options = {}) {
    for (const [k, v] of Object.entries(entries)) {
      updateConfig(k, v, { ...options, skipRender: true });
    }
    if (!options.skipRender && typeof processListings === 'function') {
      processListings();
    }
  }

  // ─── MODULE: src/state/store.js ─────────────────────────────────────────────
  /**
   * Runtime Session State Store
   * Tracks active scanner status and cancellation flags for reactive UI updates.
   */

  const scanState = {
    isBatchChecking: false,
    batchCancelRequested: false,
    isBestpreiseScanning: false,
    bestpreiseScanCancel: false,
    currentlyScanningPid: null,
    progress: { completed: 0, total: 0 }
  };

  // ─── MODULE: src/page/adapter.js ────────────────────────────────────────────
  /**
   * Semantic Page Adapter Layer
   * Encapsulates host-page context detection, semantic DOM element resolution,
   * price extraction from detail views, and cache invalidation.
   */



  function clearCardCache(card) {
    if (!card) return;
    delete card._tpDealerRows;
    delete card._tpTextLower;
    delete card._tpPriceInfo;
    if (card.dataset) {
      delete card.dataset.tpOfferCount;
      delete card.dataset.tpDiff;
      delete card.dataset.tpDiscount;
      delete card.dataset.tpProductId;
      delete card.dataset.tpAppliedHeat;
    }
  }

  function isShippingPriceActive(card = null) {
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

  function isNeueToppreisePage() {
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

  function getDetailProductId() {
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

  function getDetailLowestPrice() {
    // Ordered single queries: a grouped selector would return the first match in
    // document order, not priority order, so a stray early .Plugin_Price could win.
    const selectors = ['.productPrice .Plugin_Price', '.product_price .Plugin_Price', '.lowestPrice .Plugin_Price', '.priceComparison .Plugin_Price', '.tableDealerPriceList .Plugin_Price', '.Plugin_Price'];
    for (const sel of selectors) {
      const priceEl = document.querySelector(sel);
      if (priceEl) return parsePrice(priceEl.textContent);
    }
    return 0;
  }

  function isProductDetailPage() {
    return /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(location.href) ||
           /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(document.body?.getAttribute('data-current_url') || '') ||
           document.body?.classList.contains('Page_Product') ||
           document.body?.classList.contains('Page_DetailProduct') ||
           !!document.querySelector('.Page_DetailProduct, #Page_DetailProduct, .product_detail_page, .Page_Product') ||
           (!!document.querySelector('.Plugin_ProductHeading h1, .productHeading h1, .product_title h1, h1.productTitle') && !!getDetailProductId());
  }


  function triggerProcessListings() {
    if (typeof processListings === 'function') {
      processListings();
    } else if (typeof window !== 'undefined' && window.ToppreiseSuite?.processListings) {
      window.ToppreiseSuite.processListings();
    }
  }

  // ─── MODULE: src/page/cards.js ──────────────────────────────────────────────
  /**
   * Page & Card Extraction Layer
   * Manages card discovery, ID extraction, DOM query memoization,
   * discount extraction and heatmap styling.
   */






  const normalizeName = name => name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  function getCardDealerRows(card) {
    if (!card._tpDealerRows) {
      card._tpDealerRows = Array.from(card.querySelectorAll(SELECTORS.cards.dealerRows)).map(row => ({
        row,
        storeName: normalizeName(row.querySelector('.title')?.textContent || '')
      }));
    }
    return card._tpDealerRows;
  }

  function getDistinctProductIds(el) {
    if (!el || !el.querySelectorAll) return [];
    const ids = new Set();
    const links = [el.tagName?.toLowerCase() === 'a' ? el : null, ...Array.from(el.querySelectorAll('a[href]'))].filter(Boolean);
    for (const a of links) {
      const href = a.getAttribute('href') || a.href || '';
      const m = href.match(/-p(\d+)/i);
      if (m) ids.add(m[1]);
    }
    return Array.from(ids);
  }

  function getProductCards() {
    const rawCards = Array.from(document.querySelectorAll(SELECTORS.cards.standard));
    const standardCards = rawCards.filter(c => {
      if (c.closest(SELECTORS.cards.excludedParents)) return false;
      if (c.closest(SELECTORS.cards.hiddenStyles)) return false;
      if (getDistinctProductIds(c).length > 1) return false;
      return true;
    });
    if (standardCards.length > 0) {
      const leafCards = standardCards.filter(c => !c.querySelector(SELECTORS.cards.nestedCards));
      if (leafCards.length > 0) return leafCards;
    }

    const gridCards = new Set();
    document.querySelectorAll(SELECTORS.cards.productLinks).forEach(link => {
      if (link.closest(SELECTORS.cards.excludedParents)) return;
      let container = link.parentElement;
      while (container && container !== document.body && container.parentElement !== document.body) {
        if (container.matches && container.matches('.tab-content, .tab-pane, #FrameContent, .standardList, #product-list, main, section')) {
          break;
        }
        if (getDistinctProductIds(container).length > 1) {
          break;
        }
        if (container.querySelector(SELECTORS.price.genericPriceMatch) || container.querySelector(SELECTORS.price.genericDiffMatch)) {
          gridCards.add(container);
          break;
        }
        container = container.parentElement;
      }
    });
    return Array.from(gridCards);
  }


  function extractOfferCount(card) {
    if (card.dataset?.tpOfferCount) return parseInt(card.dataset.tpOfferCount, 10);
    const count = parseInt(card.textContent.match(/(\d+)\s*(?:Angebote|Angebot)/i)?.[1] || card.querySelectorAll('.Plugin_DealerRelProdPriceInfo').length, 10);
    if (card.dataset) card.dataset.tpOfferCount = String(count);
    return count;
  }

  function getCardProductId(card) {
    if (!card) return null;
    if (card.dataset?.entityId) return card.dataset.entityId;
    if (card.dataset?.tpProductId) return card.dataset.tpProductId;

    const linkEls = [card.tagName?.toLowerCase() === 'a' ? card : null, card.closest?.('a[href]'), ...(card.querySelectorAll ? card.querySelectorAll('a[href]') : [])];
    const hrefs = Array.from(new Set(linkEls.filter(el => el && !el.closest('header, nav, footer, .breadcrumb, #tp-suite-filter-bar')).map(el => el.getAttribute('href') || el.href || ''))).filter(Boolean);
    for (const href of hrefs) {
      const match = href.match(/-p(\d+)/);
      if (match && match[1]) {
        if (card.dataset) card.dataset.tpProductId = match[1];
        return match[1];
      }
    }
    return null;
  }

  function matchesNegativeTerms(card, termsList) {
    if (!termsList || termsList.length === 0) return false;
    let text = card._tpTextLower;
    if (text === undefined) {
      text = (card.textContent || '').toLowerCase();
      card._tpTextLower = text;
    }
    return termsList.some(term => {
      if (!term) return false;
      if (term.length <= 3) {
        return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
      }
      return text.includes(term);
    });
  }

  function extractCardDiff(card) {
    if (card.dataset?.tpDiff !== undefined && card.dataset.tpDiff !== '') {
      const cached = parseFloat(card.dataset.tpDiff);
      return isNaN(cached) ? null : (cached === 0 ? 0 : cached);
    }
    const badgeEl = card.querySelector('.badge-dif:not(.tp-injected-badge), .badge:not(.tp-injected-badge), [class*="badge-dif"]:not(.tp-injected-badge)');
    // Never parse our own injected badge text as the site Differenz: when only
    // our badge exists there is no unverified site number to read.
    const text = badgeEl ? badgeEl.textContent
      : (card.querySelector?.('.tp-injected-badge') ? '' : (card.textContent || ''));
    const match = text.match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);
    if (match) {
      let val = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(val)) {
        if (card.dataset) {
          card.dataset.tpDiff = val;
        }
        return val;
      }
    }
    if (card.dataset) {
      card.dataset.tpDiff = '';
    }
    return null;
  }

  function extractCardDiscount(card) {
    const diff = extractCardDiff(card);
    return diff === null ? null : (diff === 0 ? 0 : -diff);
  }

  // Single-hue deal ramp: neutral slate (0% = no deal) -> warm amber -> deep ruby
  // (-100% = max savings). Markups render no color (neutral gray card); the
  // badge TEXT (+XX%) carries the markup signal instead.
  const HEAT_STOPS = [
    { t: 0.00, base: [24, 32, 44],   acc: [45, 58, 76],    border: [71, 85, 105, 0.50] },
    { t: 0.50, base: [75, 42, 12],   acc: [215, 85, 18],   border: [251, 115, 36, 0.88] },
    { t: 1.00, base: [98, 14, 32],   acc: [238, 25, 65],   border: [244, 63, 94, 0.95] }
  ];

  function heatRamp(t) {
    const clampedT = Math.max(0, Math.min(1, t));
    let i = HEAT_STOPS.findIndex((s, idx) => idx < HEAT_STOPS.length - 1 && clampedT >= s.t && clampedT <= HEAT_STOPS[idx + 1].t);
    if (i < 0) i = HEAT_STOPS.length - 2;
    const s0 = HEAT_STOPS[i], s1 = HEAT_STOPS[i + 1], factor = (clampedT - s0.t) / (s1.t - s0.t || 1);
    const lerp = (a, b) => Math.round(a + (b - a) * factor);
    return {
      base: [lerp(s0.base[0], s1.base[0]), lerp(s0.base[1], s1.base[1]), lerp(s0.base[2], s1.base[2])],
      acc: [lerp(s0.acc[0], s1.acc[0]), lerp(s0.acc[1], s1.acc[1]), lerp(s0.acc[2], s1.acc[2])],
      borderRgb: [lerp(s0.border[0], s1.border[0]), lerp(s0.border[1], s1.border[1]), lerp(s0.border[2], s1.border[2])],
      borderAlpha: (s0.border[3] + (s1.border[3] - s0.border[3]) * factor)
    };
  }

  // 0% (or any markup) -> 0, -100% -> 1. NaN -> null.
  function heatT(diffPercent) {
    const diff = typeof diffPercent === 'number' ? diffPercent : parseFloat(diffPercent);
    if (isNaN(diff)) return null;
    return Math.max(0, Math.min(1, -Math.min(0, Math.max(-100, diff)) / 100));
  }

  function getHeatmapStyles(diffPercent, intensity = 1.0) {
    const t = heatT(diffPercent);
    if (t === null) return null;
    const { base, acc, borderRgb, borderAlpha } = heatRamp(t);
    const safeInt = Math.max(0.2, Math.min(1.0, intensity));
    const bg = `linear-gradient(135deg, rgba(${base.join(',')},${(0.92 + 0.04 * t).toFixed(2)}) 0%, rgba(${acc.join(',')},${((0.75 + 0.20 * t) * safeInt).toFixed(2)}) 100%)`;
    const border = `rgba(${borderRgb.join(',')},${(borderAlpha * safeInt).toFixed(2)})`;
    const glow = t >= 0.55 ? `0 4px 18px rgba(${acc.join(',')},${(0.32 * safeInt).toFixed(2)})` : 'none';
    return { bg, border, glow };
  }

  // Badge reuses the card logic: solid swatch from the same ramp so the badge
  // color always matches the card heat. The provisional flag still yields paler
  // output, but callers now skip heat for unverified cards (tp-is-unverified
  // paints them striped-gray instead). At full intensity verified output is
  // identical to the legacy fixed alphas.
  function getBadgeHeatStyle(diffPercent, provisional = false, intensity = 1.0) {
    const t = heatT(diffPercent);
    if (t === null) return null;
    const { acc, borderRgb, borderAlpha } = heatRamp(t);
    const safeInt = Math.max(0.2, Math.min(1.0, intensity));
    const alpha = (provisional ? 0.55 : 0.95) * safeInt;
    return {
      background: `rgba(${acc.join(',')},${alpha.toFixed(2)})`,
      border: `rgba(${borderRgb.join(',')},${(borderAlpha * safeInt).toFixed(2)})`
    };
  }

  function extractActiveStores() {
    const filterElements = document.querySelectorAll(SELECTORS.layout.activeStoreFilters);
    return Array.from(filterElements).map(el => {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.icon-close, .f_remove_icon, .close, span').forEach(i => i.remove());
      return normalizeName(clone.textContent);
    }).filter(name => name.length > 0);
  }

  function parseNegativeTerms(rawTerms = CONFIG.NEGATIVE_TERMS || '') {
    return (rawTerms || '').split(/[,;\n]/).map(t => t.trim().toLowerCase()).filter(Boolean);
  }

  function extractCardData(card) {
    const pid = getCardProductId(card);
    const priceData = extractCanonicalPrice(card);
    const cardPriceEl = priceData.el;
    const cardPrice = priceData.price;
    const stats = pid ? getCachedPriceStats(pid) : null;
    const isVerifiedNonBest = !!(stats && cardPrice > 0 && stats.tiefstpreis > 0 && priceToCents(cardPrice) > priceToCents(stats.tiefstpreis));
    const diffVal = extractCardDiff(card);
    const discountVal = extractCardDiscount(card);
    const dealScore = (stats && cardPrice > 0) ? computeDealScore(stats, cardPrice) : null;
    // Display delta never gates on history quality: with just {tiefstpreis} +
    // card price the badge/heat still tell the verified truth.
    const displayDelta = getDisplayDelta(cardPrice, stats);
    const offerCount = extractOfferCount(card);

    return {
      card,
      pid,
      cardPriceEl,
      cardPrice,
      stats,
      isVerifiedNonBest,
      diffVal,
      discountVal,
      dealScore,
      displayDelta,
      offerCount
    };
  }

  function applyCardFilters(cd, termsList, minOffers, pageHasOffers) {
    const isNeg = CONFIG.FILTER_NEG_ENABLED ? matchesNegativeTerms(cd.card, termsList) : false;
    const isLowOffers = CONFIG.FILTER_MIN_ENABLED ? !!(pageHasOffers && minOffers > 0 && cd.offerCount < minOffers) : false;
    return { isNeg, isLowOffers };
  }

  function isCardFilteredOut(card, filters = null) {
    if (!card) return true;
    const bodyCls = document.body?.classList;
    const revealNeg = bodyCls?.contains('tp-reveal-neg') === true;
    const revealMin = bodyCls?.contains('tp-reveal-min') === true;
    const revealBad = bodyCls?.contains('tp-reveal-baddeals') === true;
    const revealUnchecked = bodyCls?.contains('tp-reveal-unchecked') === true;
    if (filters) {
      if ((filters.isNeg && !revealNeg) || (filters.isLowOffers && !revealMin)) return true;
    } else {
      if ((card.classList?.contains('tp-negative-filtered') && !revealNeg) ||
          (card.classList?.contains('tp-min-offers-filtered') && !revealMin) ||
          (card.classList?.contains('tp-baddeal-hidden') && !revealBad) ||
          (card.classList?.contains('tp-unchecked-hidden') && !revealUnchecked)) {
        return true;
      }
      // ponytail: no page context here; callers with a card list must pass
      // explicit filters built with the real pageHasOffers (feed cards have
      // no offer counts, so assuming true wrongly filters the whole feed).
      const termsList = parseNegativeTerms();
      const offerCount = extractOfferCount(card);
      const pageHasOffers = offerCount > 0 || document.querySelector('.Plugin_DealerRelProdPriceInfo') !== null;
      const f = applyCardFilters({ card, offerCount }, termsList, CONFIG.MIN_OFFERS, pageHasOffers);
      if ((f.isNeg && !revealNeg) || (f.isLowOffers && !revealMin)) return true;
    }
    const tab = card.closest?.('.f_tab');
    if (tab && !tab.classList.contains('selected')) return true;

    if (card.hidden || card.classList?.contains('d-none') || card.closest?.('.d-none')) return true;
    if (typeof card.checkVisibility === 'function') {
      if (!card.checkVisibility()) return true;
    } else if (card.offsetParent === null && window.getComputedStyle?.(card)?.display === 'none') {
      return true;
    }
    return false;
  }

  function getCardSortableUnit(card) {
    if (!card) return null;
    const collItem = card.closest('.Plugin_ProductCollItem');
    if (collItem) return collItem;
    const parent = card.parentElement;
    if (parent && parent !== document.body && parent.id !== 'product-list' && parent.id !== 'main-content' && !parent.classList?.contains('main-content-col') && !parent.classList?.contains('product-grid') && !parent.classList?.contains('row')) {
      if (Array.from(parent.classList || []).some(c => c.startsWith('col-') || c === 'cell')) {
        return parent;
      }
    }
    return card;
  }

  // ─── MODULE: src/ui/sparkline.js ────────────────────────────────────────────
  /**
   * Interactive SVG Sparkline Component
   * Generates lightweight inline SVG sparkline polyline charts from product price history
   * with color-coded trend indicators and interactive tooltips.
   */

  function renderSparkline(timeSeries, width, height) {
    if (!timeSeries || !Array.isArray(timeSeries) || timeSeries.length < 2) return null;
    const prices = timeSeries.map(p => Array.isArray(p) ? +p[1] : 0).filter(p => p > 0);

    if (prices.length < 2) return null;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const padding = 2;
    const usableHeight = height - padding * 2;

    const points = prices.map((p, i) => {
      const x = ((i / (prices.length - 1)) * width).toFixed(1);
      const y = (height - padding - ((p - min) / range) * usableHeight).toFixed(1);
      return `${x},${y}`;
    }).join(' ');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.classList.add('tp-sparkline');

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const isTrendingDown = lastPrice <= firstPrice;
    const strokeColor = isTrendingDown ? '#10b981' : '#ef4444';

    const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleEl.textContent = `Preisverlauf: CHF ${firstPrice.toFixed(2)} → CHF ${lastPrice.toFixed(2)} (Min: ${min.toFixed(2)}, Max: ${max.toFixed(2)})`;
    svg.appendChild(titleEl);

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', strokeColor);
    polyline.setAttribute('stroke-width', '1.5');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);

    return svg;
  }

  // ─── MODULE: src/page/sort.js ───────────────────────────────────────────────
  /**
   * Grid Sorting Engine
   * Handles flex column reparenting and sorting by offer count, discount percent,
   * and continuous weighted difference, with 100% natural DOM order restoration.
   */




  function applySorting(cards, pageHasOffers, cardDataList = null) {
    if (!cards || cards.length <= 1) return;

    const isCustomSortActive = CONFIG.BESTPREISE_MODE_ACTIVE ||
                               CONFIG.SORT_BY_OFFERS === 'discount-desc' ||
                               (pageHasOffers && CONFIG.SORT_BY_OFFERS !== 'none');

    if (!isCustomSortActive) {
      const wasCustomSorted = cards.some(c => {
        const u = getCardSortableUnit(c);
        return u?.style.order || u?.dataset.tpOrigParentId;
      });
      if (!wasCustomSorted) return;
    }

    // Ensure initial order and original parent IDs are recorded on all cards/columns
    cards.forEach((c, idx) => {
      if (!c.dataset.tpInitialOrder) {
        c.dataset.tpInitialOrder = String(idx);
      }
      const item = getCardSortableUnit(c);
      if (item && !item.dataset.tpInitialOrder) {
        item.dataset.tpInitialOrder = String(idx);
        const parent = item.parentElement;
        if (parent) {
          if (!parent.id && !parent.dataset.tpParentId) {
            parent.dataset.tpParentId = 'tp-p-' + Math.random().toString(36).slice(2, 9);
          }
          item.dataset.tpOrigParentId = parent.id || parent.dataset.tpParentId;
        }
      }
    });

    // Find all rows that actually contain product cards (strictly scopes to product rows, never sidebar/tabs/header)
    const productRows = Array.from(new Set(cards.map(c => getCardSortableUnit(c)?.parentElement).filter(r => r && !r.closest('header, nav, footer, .breadcrumb, #tp-suite-filter-bar, .Plugin_ProductHistoryDropdown, .AbstractDropDown, #Plugin_MainHead, .DropDownMenuList'))));
    if (productRows.length === 0) return;

    const primaryRow = productRows[0];

    if (isCustomSortActive) {
      let sortedEntries = [];

      const byCard = cardDataList ? new Map(cardDataList.map(cd => [cd.card, cd])) : null;
      const cdFor = c => byCard?.get(c) || extractCardData(c);
      if (CONFIG.BESTPREISE_MODE_ACTIVE) {
        const scored = cards.map(c => {
          const cd = cdFor(c);
          const dealData = cd.dealScore ?? computeDealScore(cd.stats, cd.cardPrice);
          let weightedDiff = -100;
          if (dealData) {
            // Badge = heat = sort key (ADR-0005): the ribbon prints the blend
            // and the card burns with it, so the feed ranks by it too.
            weightedDiff = dealData.weightedDiff;
          } else if (!cd.stats) {
            weightedDiff = 0;
          }
          return {
            card: c,
            item: getCardSortableUnit(c),
            weightedDiff,
            dMed: dealData ? dealData.dMedian : 0,
            initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
          };
        });
        scored.sort((a, b) => (b.weightedDiff - a.weightedDiff) || (b.dMed - a.dMed) || (a.initialOrder - b.initialOrder));
        sortedEntries = scored;
      } else if (CONFIG.SORT_BY_OFFERS === 'discount-desc') {
        // Verified level (vs Ø-Preis) first; unverified site Differenz is fallback only.
        const scored = cards.map(c => {
          const cd = cdFor(c);
          const level = getLevelPct(cd.cardPrice, cd.stats, true);
          return {
            card: c,
            item: getCardSortableUnit(c),
            disc: level !== null ? -level : (extractCardDiscount(c) ?? -1),
            initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
          };
        });
        scored.sort((a, b) => (b.disc - a.disc) || (a.initialOrder - b.initialOrder));
        sortedEntries = scored;
      } else if (pageHasOffers && CONFIG.SORT_BY_OFFERS !== 'none') {
        const scored = cards.map(c => ({
          card: c,
          item: getCardSortableUnit(c),
          count: extractOfferCount(c),
          initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
        }));
        scored.sort((a, b) => CONFIG.SORT_BY_OFFERS === 'desc' ? (b.count - a.count) : (a.count - b.count));
        sortedEntries = scored;
      }

      // Deduplicate by item so grouped collection items appearing for multiple child cards are only moved once
      const seenItems = new Set();
      const uniqueEntries = [];
      for (const entry of sortedEntries) {
        if (entry.item && !seenItems.has(entry.item)) {
          seenItems.add(entry.item);
          uniqueEntries.push(entry);
        }
      }
      sortedEntries = uniqueEntries;

      // Move sortable items into primaryRow and apply CSS flex order
      sortedEntries.forEach((entry, rank) => {
        const item = entry.item;
        if (item) {
          if (item.parentElement !== primaryRow) {
            primaryRow.appendChild(item);
          }
          if (item.style.order !== String(rank)) {
            item.style.setProperty('order', String(rank), 'important');
          }
        }
      });

      // Ensure DOM order inside primaryRow matches sortedEntries order without unnecessary detach/re-attach
      const currentChildren = Array.from(primaryRow.children);
      const targetItems = sortedEntries.map(e => e.item).filter(Boolean);
      let domOrderMatches = true;
      for (let i = 0; i < targetItems.length; i++) {
        if (currentChildren[i] !== targetItems[i]) {
          domOrderMatches = false;
          break;
        }
      }
      if (!domOrderMatches) {
        targetItems.forEach((item, idx) => {
          if (primaryRow.children[idx] !== item) {
            primaryRow.insertBefore(item, primaryRow.children[idx] || null);
          }
        });
      }

      // Hide empty secondary product rows
      if (productRows.length > 1) {
        productRows.slice(1).forEach(r => {
          if (!r.querySelector('.Plugin_Product, .mixedBrowsingListProduct')) {
            r.style.setProperty('display', 'none', 'important');
            r.classList.add('tp-empty-product-row-hidden');
          }
        });
      }
    } else {
      // Natural order restoration: return items to original parents in initial order
      const itemsToRestore = cards.map(c => {
        const item = getCardSortableUnit(c);
        return {
          card: c,
          item,
          initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10),
          origParentId: item?.dataset.tpOrigParentId
        };
      });

      itemsToRestore.sort((a, b) => a.initialOrder - b.initialOrder);

      const allOrigParents = Array.from(new Set(itemsToRestore.map(entry => {
        if (!entry.origParentId) return entry.item?.parentElement;
        return document.getElementById(entry.origParentId) ||
               document.querySelector(`[data-tp-parent-id="${entry.origParentId}"]`) ||
               entry.item?.parentElement;
      }).filter(Boolean)));

      itemsToRestore.forEach(entry => {
        const item = entry.item;
        if (!item) return;
        if (item.style.order) {
          item.style.removeProperty('order');
        }

        if (entry.origParentId) {
          let origParent = document.getElementById(entry.origParentId) ||
                           document.querySelector(`[data-tp-parent-id="${entry.origParentId}"]`);
          if (origParent && item.parentElement !== origParent) {
            origParent.appendChild(item);
          }
        }
      });

      // Ensure each product row has its children in initial order and unhide without redundant re-appends
      allOrigParents.forEach(row => {
        const children = Array.from(row.children).filter(ch => ch.dataset.tpInitialOrder !== undefined);
        const isAlreadySorted = children.every((ch, i) => i === 0 || parseInt(ch.dataset.tpInitialOrder || '0', 10) >= parseInt(children[i - 1].dataset.tpInitialOrder || '0', 10));
        if (!isAlreadySorted) {
          children.sort((a, b) => parseInt(a.dataset.tpInitialOrder || '0', 10) - parseInt(b.dataset.tpInitialOrder || '0', 10));
          children.forEach((ch, idx) => {
            if (row.children[idx] !== ch) {
              row.insertBefore(ch, row.children[idx] || null);
            }
          });
        }
        if (row.style.display === 'none') {
          row.style.removeProperty('display');
        }
        row.classList.remove('tp-empty-product-row-hidden');
      });
    }
  }

  // ─── MODULE: src/scanner/scanner.js ─────────────────────────────────────────
  /**
   * Price History & Product Scanner Engine
   * Handles background batch checking, live price history retrieval,
   * adaptive 429 rate-limit backoff, interruptible delays, and scan progress tracking.
   */







  const activeFetches = new Map();

  async function interruptibleSleep(ms, shouldCancelFn = null) {
    const step = 100;
    let elapsed = 0;
    while (elapsed < ms) {
      if (shouldCancelFn && shouldCancelFn()) break;
      const wait = Math.min(step, ms - elapsed);
      await new Promise(r => setTimeout(r, wait));
      elapsed += wait;
    }
  }

  async function fetchPriceTimeSeries(productId) {
    if (!productId) return null;
    try {
      const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const postBody = `pcspagdpi=${encodeURIComponent(productId)}&pcspagdfdt=0000-00-00&pcspagdtd=&p_pc_ch=&lang=de`;
      const res = await fetch(`${baseUrl}/plugins/product/pricechart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        credentials: 'same-origin',
        body: postBody,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      const shippingActive = isShippingPriceActive();
      if (Array.isArray(data)) {
        if (Array.isArray(data[0]) && data[0].length > 0 && Array.isArray(data[0][0])) {
          if (shippingActive && data.length > 1 && Array.isArray(data[1]) && data[1].length > 0 && Array.isArray(data[1][0])) {
            return data[1];
          }
          return data[0]; // Series 0: Produktpreis
        }
        if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
          return data; // Raw points [[t1, p1], [t2, p2]]
        }
      }
      if (Array.isArray(data?.series)) return data.series;
      if (Array.isArray(data?.data)) return data.data;
      return null;
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching time series for product', productId, err);
      return null;
    }
  }

  async function fetchSingleProductPriceStats(productId, retries = 1, forceFresh = false, shouldCancelFn = null) {
    if (!productId) return null;
    // Refresh bypass: evict any cached entry (positive or negative) so the
    // manual "Aktualisieren" click always hits the network. Without this,
    // forceFresh only skipped negative entries and served stale positives.
    if (forceFresh) { memoryCache.delete(productId); try { if (typeof localStorage !== 'undefined') localStorage.removeItem(STATS_CACHE_PREFIX + productId); } catch (e) {} }
    const cached = getCachedPriceStats(productId, forceFresh);
    if (cached) {
      if (cached.unavailable) return null;
      return cached;
    }

    if (activeFetches.has(productId)) {
      return activeFetches.get(productId);
    }

    const fetchPromise = (async () => {
      try {
        const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
      
        // 1. Primary fast route: POST JSON time-series (gives series + all aggregates in 1 request)
        try {
          const timeSeries = await fetchPriceTimeSeries(productId);
          if (timeSeries && Array.isArray(timeSeries) && timeSeries.length >= 1) {
            const analysis = analyzePriceTimeSeries(timeSeries);
            if (analysis && analysis.tiefstpreis > 0) {
              analysis.isShippingPrice = isShippingPriceActive();
              setCachedPriceStats(productId, analysis);
              return analysis;
            }
          }
        } catch (seriesErr) {}

        // 2. Fallback route: GET HTML modal dialog
        const url = `${baseUrl}/plugins/product/pricechart?p_pc_pid=${encodeURIComponent(productId)}`;
        let resHtml = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
          if (shouldCancelFn && shouldCancelFn()) return null;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);
            resHtml = await fetch(url, {
              headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'text/html, */*; q=0.01'
              },
              credentials: 'same-origin',
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (resHtml.ok) break;

            if (resHtml.status === 429) {
              const retryAfterHeader = resHtml.headers?.get('Retry-After');
              const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
              const backoffMs = (retryAfterSec && !isNaN(retryAfterSec)) ? retryAfterSec * 1000 : (1500 + attempt * 1000);
              if (attempt < retries) {
                await interruptibleSleep(backoffMs, shouldCancelFn);
              }
            } else if (attempt < retries) {
              await interruptibleSleep(400 + attempt * 400, shouldCancelFn);
            }
          } catch (fetchErr) {
            if (attempt < retries) {
              await interruptibleSleep(400 + attempt * 400, shouldCancelFn);
            } else {
              throw fetchErr;
            }
          }
        }

        if (!resHtml || !resHtml.ok) {
          setCachedPriceStats(productId, null, true);
          return null;
        }
        const html = await resHtml.text();
        const stats = parsePriceStatsFromHtml(html);
        if (stats) {
          stats.isShippingPrice = isShippingPriceActive();
          setCachedPriceStats(productId, stats);
          return stats;
        } else {
          setCachedPriceStats(productId, null, true);
        }
      } catch (err) {
        if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching price stats for product', productId, err);
        setCachedPriceStats(productId, null, true);
      } finally {
        activeFetches.delete(productId);
      }
      return null;
    })();

    activeFetches.set(productId, fetchPromise);
    return fetchPromise;
  }

  async function runProductScanner(options = {}) {
    const {
      filterFn = () => true,
      sortByDiscount = false,
      shouldCancelFn = () => false,
      onProgress = null,
      onComplete = null
    } = options;

    const cards = getProductCards();
    const targets = [];
    // Same pageHasOffers semantics as the processListings counter: offer-less
    // feeds must not min-offers-filter everything when Min >= 1.
    const pageHasOffers = cards.some(card => extractOfferCount(card) > 0);
    const termsList = parseNegativeTerms();

    for (const card of cards) {
      const pid = getCardProductId(card);
      if (!pid) continue;
      const cached = getCachedPriceStats(pid);
      if (cached) continue;
      const offerCount = extractOfferCount(card);
      if (isCardFilteredOut(card, applyCardFilters({ card, offerCount }, termsList, CONFIG.MIN_OFFERS, pageHasOffers))) continue;
      const discount = extractCardDiscount(card) ?? 0;
      if (filterFn({ pid, card, discount })) {
        targets.push({ pid, card, discount });
      }
    }

    if (sortByDiscount) {
      targets.sort((a, b) => b.discount - a.discount);
    }

    const total = targets.length;
    let completed = 0;

    try {
      for (let i = 0; i < targets.length; i++) {
        if (shouldCancelFn()) break;
        const item = targets[i];
        Object.assign(scanState, { currentlyScanningPid: item.pid, progress: { completed, total } });
        triggerProcessListings();

        try {
          await fetchSingleProductPriceStats(item.pid, 2, false, shouldCancelFn);
        } finally {
          Object.assign(scanState, { currentlyScanningPid: null });
        }

        completed++;
        Object.assign(scanState, { progress: { completed, total } });
        if (onProgress) onProgress(completed, total);
        triggerProcessListings();
        await interruptibleSleep(250, shouldCancelFn);
      }
    } finally {
      Object.assign(scanState, { currentlyScanningPid: null });
    }

    triggerProcessListings();
    if (onComplete) onComplete(completed, total);
    return { completed, total };
  }

  async function runScan(mode, { minDiscount = 30, onProgress = null, onComplete = null } = {}) {
    const isBatch = mode === 'batch';
    if (isBatch ? scanState.isBatchChecking : scanState.isBestpreiseScanning) {
      Object.assign(scanState, isBatch ? { batchCancelRequested: true } : { bestpreiseScanCancel: true });
      return;
    }
    Object.assign(scanState, isBatch
      ? { isBatchChecking: true, batchCancelRequested: false }
      : { isBestpreiseScanning: true, bestpreiseScanCancel: false });

    try {
      const isFeed = isBatch && isNeueToppreisePage();
      await runProductScanner({
        filterFn: isBatch ? (item => isFeed ? (item.discount >= minDiscount) : true) : (() => true),
        sortByDiscount: !isBatch,
        shouldCancelFn: isBatch
          ? (() => scanState.batchCancelRequested)
          : (() => scanState.bestpreiseScanCancel || !CONFIG.BESTPREISE_MODE_ACTIVE),
        onProgress,
        onComplete
      });
    } finally {
      Object.assign(scanState, isBatch
        ? { isBatchChecking: false, batchCancelRequested: false }
        : { isBestpreiseScanning: false, bestpreiseScanCancel: false });
      triggerProcessListings();
    }
  }

  const runBatchDealCheck = (minDiscount = 30, onProgress = null, onComplete = null) =>
    runScan('batch', { minDiscount, onProgress, onComplete });

  function cancelBatchDealCheck() {
    Object.assign(scanState, { batchCancelRequested: true });
  }

  const runBestpreiseScan = (onProgress = null, onComplete = null) =>
    runScan('bestpreise', { onProgress, onComplete });

  function cancelBestpreiseScan() {
    Object.assign(scanState, { bestpreiseScanCancel: true });
  }

  // ─── MODULE: src/ui/badges.js ───────────────────────────────────────────────
  /**
   * Visual Badges & Card Decorator Component
   * Manages card thermal heatmaps, deal badges (Allzeit-Tiefstpreis,
   * Neuer Rekord, Differenz loupe, markup alert), score breakdown pills,
   * mini sparklines, and empty-state messaging.
   */













  function setHtmlIfChanged(el, newHtml) {
    if (el && el.innerHTML !== newHtml) {
      el.innerHTML = newHtml;
    }
  }

  function setTextIfChanged(el, newText) {
    if (el && el.textContent !== newText) {
      el.textContent = newText;
    }
  }

  function setTitleIfChanged(el, newTitle) {
    if (el && el.title !== newTitle) {
      el.title = newTitle;
    }
  }

  // Sub-elements the heatmap touches (apply + removal must use the same set)
  const HEAT_SUB_SELECTOR =
    '.row, .col, [class*="col-"], .priceAvailabilityContainer, .price-availability, ' +
    '.offersContainer, .offers, .priceContainer, .Plugin_Price, .productPrice, .shippingPrice, .shippingText, ' +
    '.manufacturer-image, .product-name, .productDetails, .price_information_product, .Plugin_PriceInformation, ' +
    '.f_product_info, .productDescription, .productDetailsDescription, .product-details, .f_product_container, ' +
    '.product-image, .productImage, .image_container, .image, [data-darkreader-inline-bgcolor], [data-darkreader-inline-bgimage]';

  function ensureHistPriceEl(card, cardPriceEl) {
    let el = card.querySelector('.tp-card-historical-price');
    if (!el) {
      el = document.createElement('div');
      const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                             cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                             cardPriceEl?.parentElement ||
                             card;
      priceContainer.appendChild(el);
    }
    return el;
  }
  // Single-product verify flow, shared by the badge click and its keyboard twin,
  // the adjacent .tp-loupe button. Reads price at click time and re-verifies it
  // after fetch so a stale or swapped card never paints another product's stats.
  const loupeBtnByBadge = new WeakMap();
  async function runSingleDealCheck(card, badgeDifEl) {
    if (badgeDifEl.classList.contains('tp-deal-loading')) return;
    const currentPid = getCardProductId(card);
    if (!currentPid) return;
    loupeBtnByBadge.get(badgeDifEl)?.remove();
    badgeDifEl.classList.add('tp-deal-loading');
    badgeDifEl.innerHTML = `<div class="text">Prüfe...</div><p>⏳</p>`;
    const requestTimePrice = extractCanonicalPrice(card).price;
    const fetchedStats = await fetchSingleProductPriceStats(currentPid, 1, true);
    const currentTimePrice = extractCanonicalPrice(card).price;
    if (!requestTimePrice || !currentTimePrice || priceToCents(requestTimePrice) !== priceToCents(currentTimePrice)) {
      badgeDifEl.classList.remove('tp-deal-loading');
      triggerProcessListings();
      return;
    }
    badgeDifEl.classList.remove('tp-deal-loading');
    if (fetchedStats) {
      triggerProcessListings();
    } else {
      badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-not-low', 'tp-is-severe-markup');
      badgeDifEl.innerHTML = `<div class="text">Fehler</div><p style="font-size: 13px;">⚠️ n/v</p>`;
      badgeDifEl.title = '⚠️ Preishistorie zurzeit nicht verfügbar (Klicken für erneuten Versuch)';
      setTimeout(() => {
        if (badgeDifEl && !getCachedPriceStats(currentPid)) {
          triggerProcessListings();
        }
      }, 2500);
    }
  }

  function renderCardEffects(cd, filters, isNeueFeed, activeStores) {
    const { card, pid, cardPriceEl, cardPrice, stats, diffVal } = cd;
    const displayDelta = cd.displayDelta || getDisplayDelta(cardPrice, stats);
    const dealData = cd.dealScore ?? computeDealScore(stats, cardPrice);

    // Heatmap: gray (no deal) -> red (max savings), single hue (ADR-0005: badge
    // shows the blend, heat/sort follow it). One computation (getHeatInput)
    // feeds BOTH the card heat here and the badge number below, so the ribbon
    // number always matches its color. The blend sorts too.
    // Unverified site discounts never heat: they read striped-gray via
    // tp-is-unverified (step 1b/6 below), verified cards heat as before.
    const heatMode = CONFIG.BESTPREISE_MODE_ACTIVE ? 'bestpreise' : 'browse';
    const heatInfo = getHeatInput(cardPrice, stats, diffVal, heatMode, dealData);
    const effectiveDiff = heatInfo.value;
    const heatProvisional = heatInfo.provisional;
    const heatIntensity = CONFIG.HEATMAP_INTENSITY;

    // Geprüft vs ungeprüft: only verified stats heat the card/badge. Provisional
    // site Differenzen stay neutral — the tp-is-unverified class below paints
    // them gray-striped instead, so the state scans without comparing saturation.
    if (CONFIG.HEATMAP_ENABLED && !heatProvisional && effectiveDiff !== null && !isNaN(effectiveDiff)) {
      const heatKey = `${effectiveDiff}_${heatIntensity.toFixed(2)}`;
      if (card.dataset.tpAppliedHeat !== heatKey) {
        card.dataset.tpAppliedHeat = heatKey;
        const heatStyles = getHeatmapStyles(effectiveDiff, heatIntensity);
        card.style.setProperty('--tp-heat-bg', heatStyles.bg);
        card.style.setProperty('--tp-heat-border', heatStyles.border);
        card.style.setProperty('--tp-heat-glow', heatStyles.glow);

        // DarkReader Dynamic Theme compatibility:
        card.style.setProperty('--darkreader-inline-bgimage', heatStyles.bg);
        card.style.setProperty('--darkreader-inline-bgcolor', 'transparent');
        card.style.setProperty('--darkreader-inline-border', heatStyles.border);
        card.style.setProperty('--darkreader-inline-border-top', heatStyles.border);
        card.style.setProperty('--darkreader-inline-border-right', heatStyles.border);
        card.style.setProperty('--darkreader-inline-border-bottom', heatStyles.border);
        card.style.setProperty('--darkreader-inline-border-left', heatStyles.border);
        card.style.setProperty('background', heatStyles.bg, 'important');
        card.style.setProperty('background-image', heatStyles.bg, 'important');
        card.style.setProperty('border-color', heatStyles.border, 'important');

        if (card.hasAttribute('data-darkreader-inline-bgcolor')) card.removeAttribute('data-darkreader-inline-bgcolor');
        if (card.hasAttribute('data-darkreader-inline-bgimage')) card.removeAttribute('data-darkreader-inline-bgimage');

        const subElements = card.querySelectorAll(HEAT_SUB_SELECTOR);
        for (let s = 0; s < subElements.length; s++) {
          const sub = subElements[s];
          if (sub.classList.contains('badge') || sub.classList.contains('tp-deal-pill') ||
              sub.classList.contains('tp-best-price-badge') ||
              sub.classList.contains('tp-sparkline-container') || sub.tagName === 'BUTTON') {
            continue;
          }
          if (sub.hasAttribute('data-darkreader-inline-bgcolor')) sub.removeAttribute('data-darkreader-inline-bgcolor');
          if (sub.hasAttribute('data-darkreader-inline-bgimage')) sub.removeAttribute('data-darkreader-inline-bgimage');
          sub.style.setProperty('background-color', 'transparent', 'important');
          sub.style.setProperty('background', 'transparent', 'important');
          sub.style.setProperty('--darkreader-inline-bgcolor', 'transparent');
          sub.style.setProperty('--darkreader-inline-bgimage', 'none');
        }

        card.classList.add('tp-heatmap-active');
      }
      // Badge follows the card heat: same ramp, solid swatch. Synced on every
      // render (not only on heatKey change) so re-rendered badge nodes can't
      // desync from the card. Provisional input never reaches this path (see
      // the !heatProvisional gate above) — unverified ribbons are class-painted.
      const heatBadgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
      if (heatBadgeEl) {
        const badgeHeat = getBadgeHeatStyle(effectiveDiff, heatProvisional, CONFIG.HEATMAP_INTENSITY);
        heatBadgeEl.style.setProperty('background', badgeHeat.background, 'important');
        heatBadgeEl.style.setProperty('border-color', badgeHeat.border, 'important');
        heatBadgeEl.style.setProperty('color', '#ffffff', 'important');
        heatBadgeEl.style.setProperty('box-shadow', '0 2px 10px rgba(0,0,0,0.45)', 'important');
        heatBadgeEl.style.setProperty('--darkreader-inline-bgcolor', badgeHeat.background);
      }
    } else if (card.dataset.tpAppliedHeat || card.classList.contains('tp-heatmap-active')) {
      // Tripwire: heat stripped while the badge still claims a verified % means
      // a stats regression slipped through — enable DEBUG to catch it live.
      if (CONFIG.DEBUG && card.querySelector('.tp-deal-alltime-low, .tp-deal-new-record')) {
        console.warn('[Toppreise Suite] heat removed with verified badge present',
          { pid, median: stats?.medianPrice ?? null, tiefstpreis: stats?.tiefstpreis ?? null });
      }
      delete card.dataset.tpAppliedHeat;
      card.classList.remove('tp-heatmap-active');
      card.style.removeProperty('--tp-heat-bg');
      card.style.removeProperty('--tp-heat-border');
      card.style.removeProperty('--tp-heat-glow');
      card.style.removeProperty('--darkreader-inline-bgimage');
      card.style.removeProperty('--darkreader-inline-bgcolor');
      card.style.removeProperty('--darkreader-inline-border');
      card.style.removeProperty('--darkreader-inline-border-top');
      card.style.removeProperty('--darkreader-inline-border-right');
      card.style.removeProperty('--darkreader-inline-border-bottom');
      card.style.removeProperty('--darkreader-inline-border-left');
      card.style.removeProperty('background');
      card.style.removeProperty('background-image');
      card.style.removeProperty('background-color');
      card.style.removeProperty('border-color');
      // Undo the badge heat coupling from the apply path above
      const heatBadgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
      if (heatBadgeEl) {
        heatBadgeEl.style.removeProperty('background');
        heatBadgeEl.style.removeProperty('border-color');
        heatBadgeEl.style.removeProperty('color');
        heatBadgeEl.style.removeProperty('box-shadow');
        heatBadgeEl.style.removeProperty('--darkreader-inline-bgcolor');
      }
      // Undo the per-subelement overrides from the apply path above
      for (const sub of card.querySelectorAll(HEAT_SUB_SELECTOR)) {
        sub.style.removeProperty('background-color');
        sub.style.removeProperty('background');
        sub.style.removeProperty('--darkreader-inline-bgcolor');
        sub.style.removeProperty('--darkreader-inline-bgimage');
      }
    }
    // 1b. Geprüft vs ungeprüft card cue (always on, independent of Heatmap):
    // no stats = never checked. Loading cards get neither class.
    if (scanState.currentlyScanningPid && scanState.currentlyScanningPid === pid) {
      card.classList.remove('tp-is-unverified', 'tp-is-verified');
    } else if (!stats) {
      card.classList.add('tp-is-unverified');
      card.classList.remove('tp-is-verified');
    } else {
      card.classList.add('tp-is-verified');
      card.classList.remove('tp-is-unverified');
    }

    // 2. Filters
    card.classList.toggle('tp-negative-filtered', filters.isNeg);
    card.classList.toggle('tp-min-offers-filtered', filters.isLowOffers);

    // 3. Toppreis Highlighting (filtered store holds the cheapest offer)
    const dealerRows = activeStores.length > 0 ? getCardDealerRows(card) : [];
    if (activeStores.length === 0 || (!isNeueFeed && dealerRows.length === 0)) {
      card.classList.remove('tp-is-cheapest', 'tp-not-cheapest', 'tp-no-store-offer');
      card.querySelector('.tp-best-price-badge')?.remove();
    } else {
      let matchedRow = null;
      for (let d = 0; d < dealerRows.length; d++) {
        const item = dealerRows[d];
        if (item.storeName && activeStores.some(store => item.storeName.includes(store) || store.includes(item.storeName))) {
          matchedRow = item.row;
          break;
        }
      }

      if (matchedRow) {
        const useShipping = isShippingPriceActive(card);
        const storePriceEl = useShipping
          ? (matchedRow.querySelector('.shippingPrice .Plugin_Price') || matchedRow.querySelector('.productPrice .Plugin_Price'))
          : (matchedRow.querySelector('.productPrice .Plugin_Price') || matchedRow.querySelector('.shippingPrice .Plugin_Price'));
        const storePrice = storePriceEl ? parsePrice(storePriceEl.textContent) : 0;
        const bestPrice = cardPrice > 0 ? cardPrice : (cardPriceEl ? parsePrice(cardPriceEl.textContent) : 0);

        if (storePrice > 0 && bestPrice > 0 && storePrice <= bestPrice * (1 + CONFIG.MARGIN_PERCENT / 100)) {
          card.classList.add('tp-is-cheapest');
          card.classList.remove('tp-not-cheapest', 'tp-no-store-offer');
          if (!card.querySelector('.tp-best-price-badge')) {
            const badge = document.createElement('div');
            badge.className = 'tp-best-price-badge';
            badge.textContent = 'Toppreis';
            card.appendChild(badge);
          }
        } else {
          card.classList.add(storePrice > 0 && bestPrice > 0 ? 'tp-not-cheapest' : 'tp-no-store-offer');
          card.classList.remove('tp-is-cheapest', storePrice > 0 && bestPrice > 0 ? 'tp-no-store-offer' : 'tp-not-cheapest');
          card.querySelector('.tp-best-price-badge')?.remove();
        }
      } else {
        card.classList.add('tp-no-store-offer');
        card.classList.remove('tp-is-cheapest', 'tp-not-cheapest');
        card.querySelector('.tp-best-price-badge')?.remove();
      }
    }

    // 4. Tiefstpreis-Check (Consolidated into Differenz Circle Badge)
    let badgeDifEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
    // Remove any legacy floating wrappers if present
    card.querySelector('.tp-real-deal-wrapper')?.remove();

    const isListView = !isNeueFeed && (
      card.classList.contains('mixedBrowsingList') ||
      card.classList.contains('mixedBrowsingListProduct') ||
      !!card.querySelector('.priceAvailabilityContainer, .price-availability') ||
      !!card.closest('#Page_Browsing, .Page_Browsing')
    );
    const isSubcard = card.classList.contains('f_collection') || !!card.closest('.Plugin_ProductCollectionRelProductsList');

    if (!badgeDifEl && pid) {
      badgeDifEl = document.createElement('div');
      badgeDifEl.className = 'badge badge-dif tp-injected-badge';
    }

    if (badgeDifEl) {
      if (isListView) {
        badgeDifEl.classList.add('tp-deal-pill');
        if (isSubcard) {
          const titleContainer = card.querySelector('.bold') || card.querySelector('.product-name');
          if (titleContainer) {
            if (badgeDifEl.parentElement !== titleContainer.parentNode || badgeDifEl.previousElementSibling !== titleContainer) {
              titleContainer.insertAdjacentElement('afterend', badgeDifEl);
            }
          } else if (badgeDifEl.parentElement !== card) {
            card.appendChild(badgeDifEl);
          }
        } else {
          const priceInfo = card.querySelector('.Plugin_PriceInformation, .price_information_product');
          if (priceInfo) {
            if (badgeDifEl.parentElement !== priceInfo) {
              priceInfo.insertBefore(badgeDifEl, priceInfo.firstChild);
            }
          } else if (badgeDifEl.parentElement !== card) {
            card.appendChild(badgeDifEl);
          }
        }
      } else {
        badgeDifEl.classList.remove('tp-deal-pill');
        if (badgeDifEl.parentElement !== card) {
          card.appendChild(badgeDifEl);
        }
      }

      if (!badgeDifEl.dataset.tpOriginalDiscount) {
        const initialDiscount = extractCardDiscount(card);
        badgeDifEl.dataset.tpOriginalDiscount = (initialDiscount !== null && !isNaN(initialDiscount)) ? String(initialDiscount) : '';
      }
      const rawDiscount = badgeDifEl.dataset.tpOriginalDiscount !== '' ? parseFloat(badgeDifEl.dataset.tpOriginalDiscount) : null;
      // rawDiscount is the site DISCOUNT (positive = "-X%" deal, negative = "+X%"
      // markup). Render it sign-aware so markup badges never print "--X%".
      const sitePctText = (rawDiscount !== null && !isNaN(rawDiscount))
        ? (rawDiscount >= 0 ? `-${rawDiscount}%` : `+${-rawDiscount}%`)
        : '';

      // Bind single click handler on badge (mouse path; keyboard users get the
      // adjacent .tp-loupe button running the same runSingleDealCheck flow).
      if (!badgeDifEl.dataset.tpDealBound) {
        badgeDifEl.dataset.tpDealBound = 'true';
        badgeDifEl.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          runSingleDealCheck(card, badgeDifEl);
        });
      }

      if (CONFIG.BESTPREISE_MODE_ACTIVE) {
        if (dealData) {
          // Qualified Tiefstpreis! The ribbon prints the Gewichtete Differenz
          // (ADR-0005) — NIE die Site-Differenz. Heat and sort follow the same
          // number, so Zahl und Farbe stimmen immer überein.
          card.classList.remove('tp-baddeal-hidden', 'tp-unchecked-hidden');
          badgeDifEl.classList.add('tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

          const showRecord = dealData.isNewRecord && isSignificantRecord(displayDelta);
          if (showRecord) {
            badgeDifEl.classList.add('tp-deal-new-record');
            badgeDifEl.classList.remove('tp-deal-alltime-low');
          } else {
            badgeDifEl.classList.add('tp-deal-alltime-low');
            badgeDifEl.classList.remove('tp-deal-new-record');
          }

          const prevLow = recordRefForPrice(stats, cardPrice).previousLow;
          const medianVal = stats?.medianPrice;
          const horizonLabel = medianHorizonLabel(stats);
          const outlierText = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? ` | ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert` : '';
          // Single source (ADR-0005): the blend is the heat input computed
          // above — ribbon number always matches its color.
          const badgePct = heatInfo.pct;

          // Ribbon carries the blend (ADR-0005): emoji + number, no words —
          // the CHF-anchored split lives in the subline below.
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⚖️</span><p>-${badgePct}%</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">⚖️</div><p>-${badgePct}%</p>`);
          }

          const colorLegend = `Farbe = Rabatt-Tiefe (tiefrot = grosser Tiefstpreis, grau = kein Rabatt)`;
          const wRec = (typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number') ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50;
          const wMed = 1 - wRec;
          const fmtW = w => String(Math.round(w * 100) / 100);
          const blendFormula = `Gewichtete Differenz -${dealData.weightedDiff}% = ${fmtW(wMed)}×Ø(-${dealData.dMedian}%) + ${fmtW(wRec)}×Rek(-${dealData.dRecord}%)`;
          const outlierLine = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? `\nℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert` : '';
          if (showRecord) {
            setTitleIfChanged(badgeDifEl, `${blendFormula}\n🔥 Neuer Rekord (CHF ${cardPrice.toFixed(2)}): -${dealData.dRecord}% vs Bisher CHF ${prevLow ? prevLow.toFixed(2) : '?'} · ${colorLegend}${outlierLine}\n[Klicken zum Aktualisieren]`);
          } else {
            setTitleIfChanged(badgeDifEl, `${blendFormula}\n🌟 Allzeit-Tiefstpreis (CHF ${cardPrice.toFixed(2)})!${dealData.isNewRecord ? '' : ' Kein neuer Rekord.'}${medianVal ? ` Ø ${horizonLabel} CHF ${medianVal.toFixed(2)}.` : ''} · ${colorLegend}${outlierLine}\n[Klicken zum Aktualisieren]`);
          }

          // Merged subline: CHF-anchored split with per-leg % (no blend words —
          // the ribbon above already shows it, so the short CHF tail survives
          // ellipsis on narrow cards).
          const showPrevLow = !!(prevLow && priceToCents(prevLow) > priceToCents(cardPrice));
          const showMedianLine = !!(medianVal && medianVal > cardPrice);
          const hasRecordPart = dealData.isNewRecord && dealData.dRecord > 0;
          let histPriceEl = ensureHistPriceEl(card, cardPriceEl);

          if (showPrevLow || showMedianLine) {
            const parts = [];
            if (showPrevLow) parts.push(`📉 CHF ${prevLow.toFixed(2)}${hasRecordPart ? ` (-${dealData.dRecord}%)` : ''}`);
            if (showMedianLine) parts.push(`Ø (${horizonLabel}) CHF ${medianVal.toFixed(2)} (-${dealData.dMedian}%)`);
            if (dealData.isNewRecord && showPrevLow) {
              histPriceEl.className = 'tp-card-historical-price tp-is-record-low';
              setTextIfChanged(histPriceEl, parts.join(' · '));
              setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief: CHF ${prevLow.toFixed(2)} (-${dealData.dRecord}%)${showMedianLine ? ` · ${dealData.dMedian}% unter dem ${horizonLabel}-Median (CHF ${medianVal.toFixed(2)})` : ''}${outlierText}`);
            } else {
              histPriceEl.className = 'tp-card-historical-price tp-is-at-low' + (showPrevLow ? ' tp-with-prev' : '');
              setTextIfChanged(histPriceEl, parts.join(' · '));
              setTitleIfChanged(histPriceEl, `Allzeit-Tiefstpreis!${showPrevLow ? ` Vorheriges Tief: CHF ${prevLow.toFixed(2)}.` : ''}${showMedianLine ? ` Liegt ${dealData.dMedian}% unter dem ${horizonLabel}-Median von CHF ${medianVal.toFixed(2)}.` : ''}${outlierText}`);
            }
          } else {
            histPriceEl.remove();
          }
        } else if (stats) {
          // Verified NON-Deal (stats but no qualifying score — e.g. minimal
          // fallback stats without median, or above-low). Strictness lives in
          // the mode now. The badge is ALWAYS repainted from the current stats
          // — never preserved — so a stats regression can't strand a stale
          // verified-% badge on a card whose heat is gone.
          if (CONFIG.BESTPREISE_MODE_ACTIVE === true) {
            card.classList.add('tp-baddeal-hidden');
          } else {
            card.classList.remove('tp-baddeal-hidden', 'tp-unchecked-hidden');
          }
          badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');
          card.querySelector('.tp-card-historical-price')?.remove();
          const ddNow = getDisplayDelta(cardPrice, stats);
          if (ddNow.kind === 'above-low') {
            badgeDifEl.classList.add('tp-deal-not-low', 'tp-deal-badge-interactive');
            setTitleIfChanged(badgeDifEl, `⚠️ Kein Tiefstpreis: CHF ${cardPrice.toFixed(2)} (historisches Tief CHF ${stats.tiefstpreis.toFixed(2)}, +${ddNow.markup}% Aufschlag)\nFarbe = Rabatt-Tiefe (grau = kein Rabatt)\n[Klicken zum Aktualisieren]`);
            const fakeNow = sitePctText ? `<span class="tp-fake-discount"><s>${sitePctText}</s></span>` : '';
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>⚠️</span><p class="tp-markup-val">+${ddNow.markup}%</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Aufschlag</div><p class="tp-markup-val">+${ddNow.markup}%</p>${fakeNow}`);
            }
          } else if (ddNow.kind === 'at-low' || ddNow.kind === 'new-low') {
            // At-low without median (or unscored record): plain Tiefstpreis,
            // no % claimed — the heat stays neutral gray to match.
            badgeDifEl.classList.add('tp-deal-badge-interactive');
            badgeDifEl.classList.remove('tp-deal-not-low', 'tp-is-severe-markup');
            setTitleIfChanged(badgeDifEl, `🌟 Tiefstpreis (CHF ${cardPrice.toFixed(2)}) — ohne Median kein %-Wert, daher grau statt farbig.\n[Klicken zum Aktualisieren]`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Tiefstpreis</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>🌟</p>`);
            }
          }
          // 'unknown' (no usable price): loupe state stays — nothing truthful to claim.
        } else {
          // Unscanned card (!stats) -> loupe / loading spinner. Hidden only
          // when "Nur Geprüfte" is on; otherwise kept visible for checking.
          card.classList.remove('tp-baddeal-hidden', 'tp-unchecked-hidden');
          if (CONFIG.BESTPREISE_HIDE_UNCHECKED === true) card.classList.add('tp-unchecked-hidden');
          badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');

          if (scanState.currentlyScanningPid && scanState.currentlyScanningPid === pid) {
            badgeDifEl.classList.add('tp-deal-loading');
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>⏳</span><p>Prüfe...</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfe...</div><p>⏳</p>`);
            }
          } else {
            badgeDifEl.classList.remove('tp-deal-loading');
            if (rawDiscount !== null && !isNaN(rawDiscount)) {
              setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz (z.B. vs UVP, ungeprüft), kein verifizierter Tiefstpreis. Klicken: echten Allzeit-Tiefstpreis prüfen. Grau gestreift = ungeprüft; nach Prüfung folgt die Farbe der Badge-% (rot = Deal, grau = kein Rabatt).`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>${sitePctText}</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>${sitePctText}</p><span class="tp-badge-loupe-icon">🔍</span>`);
              }
            } else {
              setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen. Badge-% nach Prüfung = Gewichtete Differenz (Ø-Rabatt + Rekord-Marge). Grau gestreift = ungeprüft; nach Prüfung folgt die Farbe der Badge-% (rot = Deal, grau = kein Rabatt).`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>Prüfen</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfen</div><p style="font-size: 15px; margin: 0; line-height: 1.1;">🔍</p>`);
              }
            }
          }
          card.querySelector('.tp-card-historical-price')?.remove();
        }
      } else {
        card.classList.remove('tp-baddeal-hidden', 'tp-unchecked-hidden');
        badgeDifEl.classList.remove('tp-deal-new-record');

        if (scanState.currentlyScanningPid && scanState.currentlyScanningPid === pid) {
          badgeDifEl.classList.add('tp-deal-loading');
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⏳</span><p>Prüfe...</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfe...</div><p>⏳</p>`);
          }
        } else {
          badgeDifEl.classList.remove('tp-deal-loading');
        }

        const displayKind = getDisplayDelta(cardPrice, stats).kind;

        if (displayKind !== 'unknown') {
          const isAllTimeLow = (displayKind === 'new-low' || displayKind === 'at-low');
          const isNonBest = (displayKind === 'above-low');
          const liveRec = recordRefForPrice(stats, cardPrice);
          const isNewRecord = (displayKind === 'new-low') || (isAllTimeLow && liveRec.isNewRecord);
          const prevLow = liveRec.previousLow;
          const realDropVsPrev = prevLow && prevLow > cardPrice ? Math.round(((prevLow - cardPrice) / prevLow) * 100) : (stats.realDiscountVsPrevLow || 0);

          // Strictness lives in the mode now: outside it, verified non-deals
          // stay visible with a truthful Aufschlag badge.

          const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;

          if (isAllTimeLow) {
            // 3B: Verified All-Time Low (Glowing Emerald Halo)
            // Ribbon prints the Gewichtete Differenz (ADR-0005); unqualified
            // history (no dealData) renders plain Tiefstpreis, gray, no number.
            // Site-Differenz steht nach Prüfung nur noch im Tooltip als Kontext.
            badgeDifEl.classList.add('tp-deal-alltime-low', 'tp-deal-badge-interactive');
            badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

            const showRecord = isSignificantRecord(displayDelta);
            // Single source (ADR-0005): the blend is the heat input above.
            const badgePct = dealData ? heatInfo.pct : 0;

            const detailParts = [];
            if (isNewRecord && prevLow) {
              detailParts.push(`Bisheriger Rekord: CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)`);
            }
            if (hasSignificantPeak) {
              const peakDropPct = Math.round(((stats.hoechstpreis - cardPrice) / stats.hoechstpreis) * 100);
              detailParts.push(`-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)}`);
            }
            if (sitePctText) {
              detailParts.push(`Differenz: ${sitePctText} (ungeprüft, z.B. UVP)`);
            }
            const detailLine = detailParts.length > 0 ? `\n${detailParts.join(' · ')}` : '';
            const colorLegend = `Farbe = Rabatt-Tiefe (tiefrot = grosser Tiefstpreis, grau = kein Rabatt)`;

            if (dealData) {
              const wRecB = (typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number') ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50;
              const wMedB = 1 - wRecB;
              const fmtWB = w => String(Math.round(w * 100) / 100);
              setTitleIfChanged(badgeDifEl, `🌟 ${showRecord ? 'Neuer Allzeit-Tiefstpreis' : 'Allzeit-Tiefstpreis'} (CHF ${cardPrice.toFixed(2)})!\nGewichtete Differenz -${dealData.weightedDiff}% = ${fmtWB(wMedB)}×Ø(-${dealData.dMedian}%) + ${fmtWB(wRecB)}×Rek(-${dealData.dRecord}%) · ${colorLegend}${detailLine}\n[Klicken zum Aktualisieren]`);
            } else {
              setTitleIfChanged(badgeDifEl, `🌟 ${showRecord ? 'Neuer Allzeit-Tiefstpreis' : 'Allzeit-Tiefstpreis'} (CHF ${cardPrice.toFixed(2)})!\n${colorLegend}${detailLine}\n[Klicken zum Aktualisieren]`);
            }
            if (isListView) {
              if (badgePct > 0) {
                setHtmlIfChanged(badgeDifEl, `<span>⚖️</span><p>-${badgePct}%</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Tiefstpreis</p>`);
              }
            } else {
              if (badgePct > 0) {
                setHtmlIfChanged(badgeDifEl, `<div class="text">⚖️</div><p>-${badgePct}%</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>🌟</p>`);
              }
            }
          } else {
            // 2A: Verified Non-Tiefstpreis (Amber Alert Morph with Shrunken Strikethrough)
            const markupPct = Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100);
            const isSevere = markupPct >= 50;

            badgeDifEl.classList.add('tp-deal-not-low', 'tp-deal-badge-interactive');
            badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-loading');
            if (isSevere) {
              badgeDifEl.classList.add('tp-is-severe-markup');
            } else {
              badgeDifEl.classList.remove('tp-is-severe-markup');
            }

            const notLowParts = [];
            if (sitePctText) {
              notLowParts.push(`Differenz: ${sitePctText} (ungeprüft, z.B. UVP)`);
            }
            if (hasSignificantPeak) {
              notLowParts.push(`Höchstpreis: CHF ${stats.hoechstpreis.toFixed(2)}`);
            }
            const notLowLine = notLowParts.length > 0 ? `\n${notLowParts.join(' · ')}` : '';
            setTitleIfChanged(badgeDifEl, `⚠️ Kein Tiefstpreis: CHF ${cardPrice.toFixed(2)} (historisches Tief CHF ${stats.tiefstpreis.toFixed(2)}, +${markupPct}% Aufschlag)${notLowLine}\nFarbe = Rabatt-Tiefe (rot = Deal, grau = kein Rabatt)\n[Klicken zum Aktualisieren]`);
            const fakeDiscHtml = sitePctText ? `<span class="tp-fake-discount"><s>${sitePctText}</s></span>` : '';
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>⚠️</span><p class="tp-markup-val">+${markupPct}%</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Aufschlag</div><p class="tp-markup-val">+${markupPct}%</p>${fakeDiscHtml}`);
            }
          }

          // 4A: Historical Tiefstpreis line right below current price
          // (pre-existing element lookup doubles as the stale-element removal path below)
          // The previous low is always shown when known & distinct — never
          // dropped in favour of the Ø line.
          const showPrevLow = !!(prevLow && priceToCents(prevLow) > priceToCents(cardPrice));
          const showMedianLine = !isNeueFeed && stats.medianPrice && stats.medianPrice > cardPrice;
          const horizonLabel = medianHorizonLabel(stats);
          let histPriceEl = card.querySelector('.tp-card-historical-price');
          if (isNonBest) {
            histPriceEl = ensureHistPriceEl(card, cardPriceEl);
            histPriceEl.className = 'tp-card-historical-price tp-is-markup';
            setTextIfChanged(histPriceEl, `Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)}`);
            setTitleIfChanged(histPriceEl, `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100)}% Aufschlag)`);
          } else if (showPrevLow || showMedianLine) {
            histPriceEl = ensureHistPriceEl(card, cardPriceEl);
            const parts = [];
            const dMedBrowse = showMedianLine ? Math.round(((stats.medianPrice - cardPrice) / stats.medianPrice) * 100) : 0;
            if (showPrevLow) parts.push(`📉 CHF ${prevLow.toFixed(2)}${isNewRecord ? ` (-${realDropVsPrev}%)` : ''}`);
            if (showMedianLine) parts.push(`Ø (${horizonLabel}) CHF ${stats.medianPrice.toFixed(2)} (-${dMedBrowse}%)`);
            histPriceEl.className = 'tp-card-historical-price ' + (isNewRecord && showPrevLow ? 'tp-is-record-low' : 'tp-is-at-low') + (showPrevLow ? ' tp-with-prev' : '');
            setTextIfChanged(histPriceEl, parts.join(' · '));
            if (isNewRecord && showPrevLow) {
              setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)${showMedianLine ? ` · Ø-Preis (${horizonLabel}): CHF ${stats.medianPrice.toFixed(2)}` : ''}`);
            } else {
              const dMedian = showMedianLine ? Math.round(((stats.medianPrice - cardPrice) / stats.medianPrice) * 100) : 0;
              setTitleIfChanged(histPriceEl, `Allzeit-Tiefstpreis!${showPrevLow ? ` Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)}.` : ''}${showMedianLine ? ` Liegt ${dMedian}% unter dem ${horizonLabel}-Median von CHF ${stats.medianPrice.toFixed(2)}.` : ''}`);
            }
          } else if (histPriceEl) {
            histPriceEl.remove();
          }
        } else {
          // 1A: Unchecked State (Subtle Mini Loupe + Hover Scale + Tooltip)
          if (CONFIG.BESTPREISE_HIDE_UNCHECKED === true) card.classList.add('tp-unchecked-hidden');

          badgeDifEl.classList.add('tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');
          if (isNeueFeed && rawDiscount !== null && !isNaN(rawDiscount)) {
            setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz (z.B. vs UVP, ungeprüft), kein verifizierter Tiefstpreis. Klicken: echten Allzeit-Tiefstpreis prüfen. Grau gestreift = ungeprüft.`);
            setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>${sitePctText}</p><span class="tp-badge-loupe-icon">🔍</span>`);
          } else {
            setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen. Badge-% nach Prüfung = echter Rabatt (Rekord vs Bisher bzw. Ø-Preis); die Kartenfarbe folgt der Badge-% (rot = Deal, grau = kein Rabatt).`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>Prüfen</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfen</div><p style="font-size: 15px; margin: 0; line-height: 1.1;">🔍</p>`);
            }
          }
        }
      }
      // Loupe button: keyboard-operable twin of the badge click. The badge keeps
      // its content and mouse click untouched; the button runs the same
      // runSingleDealCheck flow. Shown only for unscanned cards (loupe states),
      // never inside the badge. Reused across renders so focus survives.
      const showLoupe = !!pid && !stats && !badgeDifEl.classList.contains('tp-deal-loading');
      let loupeBtn = loupeBtnByBadge.get(badgeDifEl);
      if (showLoupe) {
        if (!loupeBtn?.isConnected || loupeBtn.previousElementSibling !== badgeDifEl) {
          loupeBtn?.remove();
          loupeBtn = document.createElement('button');
          loupeBtn.type = 'button';
          loupeBtn.className = 'tp-loupe';
          loupeBtn.setAttribute('aria-label', 'Differenz prüfen');
          loupeBtn.textContent = '🔍';
          loupeBtn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            runSingleDealCheck(card, badgeDifEl);
          });
          loupeBtnByBadge.set(badgeDifEl, loupeBtn);
          badgeDifEl.insertAdjacentElement('afterend', loupeBtn);
        }
        loupeBtn.style.display = '';
      } else {
        loupeBtn?.remove();
        loupeBtnByBadge.delete(badgeDifEl);
      }
    } else {
      card.classList.remove('tp-baddeal-hidden', 'tp-unchecked-hidden');
      card.querySelector('.tp-card-historical-price')?.remove();
      card.querySelectorAll('button.tp-loupe').forEach(b => b.remove());
    }

    // 5. Mini Price-Trend Sparkline
    if (CONFIG.ENABLE_SPARKLINES && stats && Array.isArray(stats.timeSeries) && stats.timeSeries.length >= 2) {
      let sparkContainer = card.querySelector('.tp-sparkline-container');
      if (!sparkContainer) {
        sparkContainer = document.createElement('div');
        sparkContainer.className = 'tp-sparkline-container';
      }
      if (!sparkContainer.querySelector('.tp-sparkline')) {
        const svg = renderSparkline(stats.timeSeries, 44, 13);
        if (svg) {
          sparkContainer.replaceChildren();
          sparkContainer.appendChild(svg);
        }
      }
      const histPriceEl = card.querySelector('.tp-card-historical-price');
      if (histPriceEl) {
        let subRow = card.querySelector('.tp-card-subline-row');
        if (!subRow) {
          subRow = document.createElement('div');
          subRow.className = 'tp-card-subline-row';
          histPriceEl.parentElement?.insertBefore(subRow, histPriceEl);
          subRow.appendChild(histPriceEl);
        }
        if (sparkContainer.parentElement !== subRow) {
          subRow.appendChild(sparkContainer);
        }
      } else {
        const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                               cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                               cardPriceEl?.parentElement ||
                               card;
        if (sparkContainer.parentElement !== priceContainer) {
          priceContainer.appendChild(sparkContainer);
        }
      }
    } else {
      card.querySelector('.tp-sparkline-container')?.remove();
      const subRow = card.querySelector('.tp-card-subline-row');
      if (subRow) {
        const hist = subRow.querySelector('.tp-card-historical-price');
        if (hist) {
          subRow.parentElement?.insertBefore(hist, subRow);
        }
        subRow.remove();
      }
    }
    // 6. Badge geprüft/ungeprüft cue (always on): striped-gray ribbon when
    // unchecked, solid heat ribbon when verified. Loading badge gets neither.
    const badgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
    if (badgeEl) {
      if (badgeEl.classList.contains('tp-deal-loading')) {
        badgeEl.classList.remove('tp-is-unverified', 'tp-is-verified');
      } else if (!stats) {
        badgeEl.classList.add('tp-is-unverified');
        badgeEl.classList.remove('tp-is-verified');
      } else {
        badgeEl.classList.add('tp-is-verified');
        badgeEl.classList.remove('tp-is-unverified');
      }
    }
    // 7. Discord 1-Klick-Share (nur verifizierte Tiefstpreise, nie Schein-Rabatte)
    const kindNow = (displayDelta && displayDelta.kind) || getDisplayDelta(cardPrice, stats).kind;
    const isShareable = !!(dealData || kindNow === 'new-low' || kindNow === 'at-low');
    let shareBtn = card.querySelector(':scope > .tp-share-btn');
    if (!card.dataset.tpShareHoverBound) {
      card.dataset.tpShareHoverBound = 'true';
      card.addEventListener('mouseenter', () => card.classList.add('tp-show-share'));
      card.addEventListener('mouseleave', () => card.classList.remove('tp-show-share'));
    }
    if (isShareable) {
      if (!shareBtn) {
        shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'tp-share-btn';
        shareBtn.textContent = '📤';
        shareBtn.title = 'Deal in Discord teilen';
        shareBtn.addEventListener('click', async e => {
          e.preventDefault();
          e.stopPropagation();
          const hook = (CONFIG.DISCORD_WEBHOOK_URL || '').trim();
          if (!isDiscordWebhookUrl(hook)) {
            showToast('Discord-Webhook fehlt – in den Einstellungen (⚙️) eintragen');
            return;
          }
          shareBtn.disabled = true;
          try {
            const { title, url } = extractShareData(card);
            const priceText = cardPrice > 0 ? `CHF ${cardPrice.toFixed(2)}` : '';
            let dealer = extractDealer(card);
            let offers = cd.offerCount || 0;
            if ((!dealer || !offers) && url) {
              const info = await fetchProductInfo(url).catch(() => null);
              if (info) { dealer = dealer || info.dealer; offers = offers || info.offers; }
            }
            const png = await renderSparklinePng(stats?.timeSeries).catch(() => null);
            const content = formatDealMessage({
              title, url, priceText,
              dealer, offerCount: offers,
              spark: png ? '' : sparklineText(stats?.timeSeries),
              ...resolveShareFields(cardPrice, stats)
            });
            let shared = false;
            if (png) {
              try { await postDealImageToDiscord(hook, content, png); shared = true; }
              catch { /* Text-Fallback unten */ }
            }
            if (!shared) await postDealToDiscord(hook, content);
            showToast('📤 Deal in Discord geteilt');
          } catch {
            showToast('📤 Teilen fehlgeschlagen');
          }
          shareBtn.disabled = false;
        });
        // Eigener Positioning-Kontext: Host-CSS garantiert kein relative (ausser .tp-is-cheapest).
        if (card.style.position === '' && getComputedStyle(card).position === 'static') card.style.position = 'relative';
        card.appendChild(shareBtn);
      }
      shareBtn.style.display = '';
    } else {
      shareBtn?.remove();
    }
  }

  function renderEmptyState(cards, counts) {
    let emptyNotice = document.getElementById('tp-empty-state-notice');

    // If qualifying bestpreise deals exist on page, NEVER render empty state
    if (counts.bestpreiseDeals > 0) {
      if (emptyNotice) emptyNotice.remove();
      return;
    }

    const bodyCls = document.body.classList;
    const revealNeg = bodyCls.contains('tp-reveal-neg');
    const revealMin = bodyCls.contains('tp-reveal-min');
    const revealBad = bodyCls.contains('tp-reveal-baddeals');
    const revealUnchecked = bodyCls.contains('tp-reveal-unchecked');
    // Effective hidden count: each cause counts only while its own reveal flag is off.
    const totalHidden = (revealNeg ? 0 : (counts.neg || 0)) + (revealMin ? 0 : (counts.min || 0)) + (revealBad ? 0 : (counts.badDeals || 0)) + (revealUnchecked ? 0 : (counts.uncheckedHidden || 0));

    const isBestpreiseEmpty = CONFIG.BESTPREISE_MODE_ACTIVE && (counts.bestpreiseHidden || 0) > 0;
    if (cards.length > 0 && totalHidden >= cards.length) {
      // Static notice: skip rebuild + listener re-bind when nothing changed
      const emptySig = `${cards.length}:${totalHidden}:${isBestpreiseEmpty}:${counts.uncheckedDeals || 0}:${CONFIG.REAL_DEAL_MIN_DISCOUNT || 30}:${CONFIG.BESTPREISE_HIDE_UNCHECKED === true}:${revealNeg}:${revealMin}:${revealBad}:${revealUnchecked}`;
      if (emptyNotice?.dataset.tpEmptySig === emptySig) return;
      if (!emptyNotice) {
        emptyNotice = document.createElement('div');
        emptyNotice.id = 'tp-empty-state-notice';
        emptyNotice.className = 'tp-empty-state-notice';
        const listParent = cards[0]?.parentElement;
        if (listParent) {
          listParent.insertBefore(emptyNotice, listParent.firstChild);
        }
      }
      const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
      emptyNotice.innerHTML = `
        <div>🚫 <strong>${isBestpreiseEmpty ? 'Keine verifizierten Tiefstpreise auf dieser Seite gefunden.' : `Alle ${cards.length} Angebote auf dieser Seite sind durch aktive Filter ausgeblendet.`}</strong></div>
        <div class="tp-empty-state-actions">
          ${isBestpreiseEmpty && counts.uncheckedDeals > 0 ? `<button class="tp-empty-state-btn" id="tp-empty-check-deals-btn" style="border-color: #3b82f6; color: #60a5fa;" title="Prüft Differenzen ≥ ${minDisc}% (ungeprüft ≠ Tiefstpreis)">🔍 Tiefstpreise prüfen (≥${minDisc}%)</button>` : ''}
          ${(counts.uncheckedDeals || 0) > 0 || CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? `<button class="tp-empty-state-btn" id="tp-empty-hide-unchecked-btn" title="Ungeprüfte Deals aus-/einblenden">👁️ ${CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? 'Alle anzeigen' : 'Nur geprüfte'}</button>` : ''}
          <button class="tp-empty-state-btn" id="tp-empty-reveal-btn">👁️ Ausgeblendete anzeigen</button>
          ${isBestpreiseEmpty ? '<button class="tp-empty-state-btn" id="tp-empty-disable-bestpreise-btn">💎 Tiefstpreise-Modus ausschalten</button>' : ''}
          <button class="tp-empty-state-btn" id="tp-empty-toggle-filters-btn">⚡ Filter ausschalten</button>
        </div>
      `;

      emptyNotice.dataset.tpEmptySig = emptySig;
      emptyNotice.querySelector('#tp-empty-check-deals-btn')?.addEventListener('click', () => {
        // Toolbar batch button removed: the floating CTA owns this action now.
        // startBatchCheck works even when the pill is collapsed or auto-hidden.
        startBatchCheck();
      });
      emptyNotice.querySelector('#tp-empty-hide-unchecked-btn')?.addEventListener('click', () => {
        const next = !CONFIG.BESTPREISE_HIDE_UNCHECKED;
        updateConfig('BESTPREISE_HIDE_UNCHECKED', next);
        showToast(next ? '👁️ Nur geprüfte Deals werden angezeigt' : '👁️ Ungeprüfte Deals werden wieder angezeigt');
      });

      emptyNotice.querySelector('#tp-empty-reveal-btn')?.addEventListener('click', () => {
        const cls = document.body.classList;
        const flags = ['tp-reveal-neg', 'tp-reveal-min', 'tp-reveal-baddeals', 'tp-reveal-unchecked'];
        if (flags.every(f => cls.contains(f))) flags.forEach(f => cls.remove(f));
        else flags.forEach(f => cls.add(f));
        triggerProcessListings();
      });
      emptyNotice.querySelector('#tp-empty-disable-bestpreise-btn')?.addEventListener('click', () => {
        cancelBestpreiseScan();
        updateConfig('BESTPREISE_MODE_ACTIVE', false);
        showToast('Tiefstpreise-Modus deaktiviert');
      });
      emptyNotice.querySelector('#tp-empty-toggle-filters-btn')?.addEventListener('click', () => {
        updateConfig('FILTER_NEG_ENABLED', false);
        updateConfig('FILTER_MIN_ENABLED', false);
        showToast('⏸️ Alle Filter pausiert (alle Angebote sichtbar)');
      });
    } else if (emptyNotice) {
      emptyNotice.remove();
    }
  }

  // ─── MODULE: src/ui/shell.js ────────────────────────────────────────────────
  /**
   * Shadow DOM Shell
   * Owns the shared `#tp-root` shadow host: skeleton markup (FAB, dialog shell,
   * toast container), styles, and the live shadow-root binding. Imported by
   * modal, toast, and config — one-directional, no cycles.
   */


  let uiShadowRoot = null;

  function ensureSkeleton() {
    let host = document.getElementById('tp-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'tp-root';
      document.body.appendChild(host);
    }
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    uiShadowRoot = shadow;

    if (!shadow.getElementById('tp-settings-fab')) {
      shadow.innerHTML = `
        <style>${SHADOW_MODAL_STYLES}</style>
        <button id="tp-settings-fab" type="button" title="Toppreise Suite Einstellungen öffnen" aria-label="Toppreise Suite Einstellungen">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <dialog id="tp-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="tp-settings-title">
          <h3 id="tp-settings-title">Toppreise Suite Einstellungen</h3>
          <div id="tp-settings-sections"></div>
          <div class="tp-modal-actions">
            <button type="button" class="tp-btn tp-btn-secondary" id="tp-btn-close">Abbrechen</button>
            <button type="button" class="tp-btn tp-btn-primary" id="tp-btn-save">Speichern</button>
          </div>
        </dialog>
        <div id="tp-toast-container"></div>
      `;
    }
    return { shadow };
  }

  // ─── MODULE: src/ui/modal.js ────────────────────────────────────────────────
  /**
   * Settings Modal & Shadow DOM Component
   * Manages the floating action button, single-page settings dialog,
   * dual-binding input controls, theme selection, import/export, and cache controls.
   */





  function setupUI() {
    const { shadow } = ensureSkeleton();
    let section = shadow.getElementById('tp-section-unified-suite');
    if (!section) {
      const sectionsHolder = shadow.getElementById('tp-settings-sections');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = `
        <div id="tp-section-unified-suite">
        <div id="tp-basic-settings">
          <div class="tp-settings-group">
            <label title="So werden gefilterte Angebote dargestellt: farbig markieren, abdunkeln oder ausblenden.">Anzeige</label>
            <div class="tp-segmented-control">
              <input type="radio" id="tp-mode-highlight-only" name="tp-mode" value="highlight-only">
              <label for="tp-mode-highlight-only">Highlight</label>
              <input type="radio" id="tp-mode-dim" name="tp-mode" value="dim">
              <label for="tp-mode-dim">Dimmen</label>
              <input type="radio" id="tp-mode-hide" name="tp-mode" value="hide">
              <label for="tp-mode-hide">Verbergen</label>
            </div>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label"><label title="Versandkosten in den Preisvergleich einrechnen.">inkl. Versand</label></div>
            <label class="tp-switch">
              <input type="checkbox" id="tp-shipping-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Färbt Karten und Badges nach Rabatt-Tiefe: Rot = hoher Rabatt, Grau = kein Rabatt.">Heatmap</label>
            </div>
            <label class="tp-switch tp-rose">
              <input type="checkbox" id="tp-heatmap-enabled-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Zeigt und sortiert verifizierte Tiefstpreise nach echtem Rabatt; versteckt schlechte Deals. Ungeprüfte blendet der Schalter Nur geprüfte aus.">Tiefstpreise Modus</label>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-bestpreise-mode-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Blendet alle noch ungeprüften Angebote aus (grau gestreifte Ribbons). Nur geprüfte Tiefstpreise bleiben sichtbar.">Nur geprüfte anzeigen</label>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-hide-unchecked-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Füllt beim Klick auf die Glocke das Preisalarm-Formular automatisch aus.">Preisalarm auto-fill</label>
            </div>
            <label class="tp-switch tp-blue">
              <input type="checkbox" id="tp-alarm-enabled-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group">
            <label title="Zielpreis als Prozent des aktuellen Preises für den Preisalarm.">Preisalarm Zielpreis</label>
            <div class="tp-range-container tp-blue">
              <input type="range" id="tp-alarm-target-range" min="10" max="95" step="5" value="60">
              <input type="number" id="tp-alarm-target-val" min="1" max="99" step="1" value="60">
            </div>
          </div>
          <div class="tp-settings-group">
            <label title="Webhook-URL deines Discord-Channels (Kanal-Einstellungen → Integrationen → Webhook). Nur lokal gespeichert, nie committet.">📤 Discord Webhook (1-Klick Deals-Share)</label>
            <input type="password" id="tp-discord-webhook-input" class="tp-field-dark" placeholder="https://discord.com/api/webhooks/…" autocomplete="off" spellcheck="false">
            <span class="tp-switch-desc tp-field-hint">Ermöglicht den 📤-Button auf verifizierten Tiefstpreis-Karten. Leer = Button meldet fehlende URL.</span>
          </div>
          <div class="tp-settings-group tp-btn-row">
            <button type="button" id="tp-export-config-btn" title="Einstellungen als JSON-Datei sichern." class="tp-btn tp-btn-secondary">📥 Export (JSON)</button>
            <button type="button" id="tp-import-config-btn" title="Einstellungen aus einer JSON-Datei wiederherstellen." class="tp-btn tp-btn-secondary">📤 Import (JSON)</button>
            <input type="file" id="tp-import-config-file" accept=".json">
          </div>
        </div>
        <details id="tp-advanced-details">
          <summary>⚙️ Feintuning</summary>
        <div id="tp-advanced-panel">
          <div class="tp-advanced-subheader">Anzeige & Sortierung</div>
          <div class="tp-settings-group">
            <label>Sortierung nach Angeboten / Rabatt</label>
            <div class="tp-segmented-control">
              <input type="radio" id="tp-sort-none" name="tp-sort-offers" value="none">
              <label for="tp-sort-none">Standard</label>
              <input type="radio" id="tp-sort-desc" name="tp-sort-offers" value="desc">
              <label for="tp-sort-desc">Meiste ⬇</label>
              <input type="radio" id="tp-sort-asc" name="tp-sort-offers" value="asc">
              <label for="tp-sort-asc">Wenigste ⬆</label>
              <input type="radio" id="tp-sort-discount" name="tp-sort-offers" value="discount-desc">
              <label for="tp-sort-discount">% Rabatt ⬇</label>
            </div>
          </div>
          <div class="tp-settings-group">
            <label>Preis-Toleranz (%)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-margin-range" min="0" max="15" step="0.5" value="0">
              <input type="number" id="tp-margin-val" min="0" max="100" step="0.1" value="0">
            </div>
          </div>
          <div class="tp-settings-group" id="tp-dim-opacity-group">
            <label>Deckkraft / Dimmung (Gedimmt & Gefiltert)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-opacity-range" min="0.05" max="0.95" step="0.05" value="0.25">
              <input type="number" id="tp-opacity-val" min="5" max="95" step="5" value="25">
            </div>
          </div>
          <div class="tp-advanced-subheader">Heatmap & Deals</div>
          <div class="tp-settings-group">
            <label>Heatmap-Intensität (%)</label>
            <div class="tp-range-container tp-rose">
              <input type="range" id="tp-heatmap-intensity-range" min="20" max="100" step="5" value="100">
              <input type="number" id="tp-heatmap-intensity-val" min="20" max="100" step="5" value="100">
            </div>
          </div>
          <div class="tp-settings-group" id="tp-bestpreise-weight-group" style="display: none;">
            <label>Gewichtete Differenz: Sortierung + Farb-Emphase (Rekord vs Ø)</label>
            <div class="tp-range-container tp-purple">
              <input type="range" id="tp-bestpreise-weight-range" min="0" max="100" step="5" value="50">
              <input type="number" id="tp-bestpreise-weight-val" min="0" max="100" step="5" value="50">
            </div>
            <span class="tp-switch-desc tp-field-hint" id="tp-bestpreise-weight-desc">50% Rekord / 50% Ø-Preis (Sortierung + Farb-Emphase) · z.B. Rek −10% + Ø −25% → Gewichtete Differenz 18</span>
          </div>
          <div class="tp-settings-group" id="tp-bestpreise-horizon-group" style="display: none;">
            <label>Median-Berechnungszeitraum (Ø-Preis)</label>
            <select id="tp-bestpreise-horizon-select" class="tp-select tp-purple tp-field-dark">
              <option value="365">1 Jahr (365 Tage) [Empfohlen]</option>
              <option value="180">6 Monate (180 Tage)</option>
              <option value="90">3 Monate (90 Tage)</option>
              <option value="0">Gesamte Historie (Lifetime)</option>
            </select>
            <span class="tp-switch-desc tp-field-hint">Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis</span>
          </div>
          <div class="tp-settings-group">
            <label>Prüf-Vorauswahl: Mindest-Differenz für Batch-Check (%)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-real-deal-min-range" min="10" max="70" step="5" value="30">
              <input type="number" id="tp-real-deal-min-val" min="5" max="95" step="5" value="30">
            </div>
            <span class="tp-switch-desc tp-field-hint">Nur Differenzen ab diesem Wert (ungeprüft) werden automatisch geprüft. Die Prüfung ersetzt sie durch den echten Rabatt.</span>
          </div>
          <div class="tp-advanced-subheader">Preisalarm</div>
          <div class="tp-settings-group">
            <label>Laufzeit Dauer</label>
            <div class="tp-segmented-control tp-segmented-control-blue">
              <input type="radio" id="tp-dur-90" name="tp-alarm-duration" value="90"><label for="tp-dur-90">3 Monate</label>
              <input type="radio" id="tp-dur-180" name="tp-alarm-duration" value="180"><label for="tp-dur-180">6 Monate</label>
              <input type="radio" id="tp-dur-365" name="tp-alarm-duration" value="365"><label for="tp-dur-365">1 Jahr</label>
              <input type="radio" id="tp-dur-730" name="tp-alarm-duration" value="730"><label for="tp-dur-730">2 Jahre</label>
            </div>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label>Automatisch Absenden & Schließen</label>
              <span class="tp-switch-desc">Formular direkt einreichen und Dialog schließen</span>
            </div>
            <label class="tp-switch tp-blue">
              <input type="checkbox" id="tp-alarm-autosubmit-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-advanced-subheader">Darstellung & Cache</div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label>Mini-Preiskurven (Sparklines) anzeigen</label>
              <span class="tp-switch-desc">Erfordert zusätzliche Server-Abfragen pro Produkt</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-sparklines-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group tp-cache-row">
            <div id="tp-cache-stats-label">Lokaler Cache: 0 Einträge</div>
            <button type="button" id="tp-cache-clear-btn" class="tp-btn tp-btn-secondary">🗑️ Cache leeren</button>
          </div>
          <div class="tp-settings-group">
            <label>Cache-Dauer für Preishistorie (Gültige Daten)</label>
            <select id="tp-cache-ttl-select" class="tp-select tp-field-dark">
              <option value="24">24 Stunden (1 Tag)</option>
              <option value="48">48 Stunden (2 Tage) [Standard]</option>
              <option value="72">72 Stunden (3 Tage)</option>
              <option value="168">7 Tage (1 Woche)</option>
              <option value="336">14 Tage (2 Wochen)</option>
            </select>
            <span class="tp-switch-desc tp-field-hint">Bestimmt, wie lange abgefragte Preisstatistiken lokal gespeichert bleiben</span>
          </div>
          <div class="tp-settings-group">
            <label>Negativ-Cache Dauer (Nicht verfügbare Daten)</label>
            <select id="tp-cache-neg-ttl-select" class="tp-select tp-field-dark">
              <option value="1">1 Stunde</option>
              <option value="2">2 Stunden [Standard]</option>
              <option value="6">6 Stunden</option>
              <option value="12">12 Stunden</option>
              <option value="24">24 Stunden</option>
            </select>
            <span class="tp-switch-desc tp-field-hint">Verhindert wiederholte Server-Anfragen bei Produkten ohne Preiskurve</span>
          </div>
        </div>
        </details>
        </div>
      `;
      section = tempDiv.firstElementChild;
      sectionsHolder.appendChild(section);
    }

    const dialog = shadow.getElementById('tp-settings-dialog');
    const fabButton = shadow.getElementById('tp-settings-fab');
    const btnClose = shadow.getElementById('tp-btn-close');
    const btnSave = shadow.getElementById('tp-btn-save');

    const modeHighlight = shadow.getElementById('tp-mode-highlight-only');
    const modeDim = shadow.getElementById('tp-mode-dim');
    const modeHide = shadow.getElementById('tp-mode-hide');
    const marginRange = shadow.getElementById('tp-margin-range');
    const marginVal = shadow.getElementById('tp-margin-val');
    const opacityRange = shadow.getElementById('tp-opacity-range');
    const opacityVal = shadow.getElementById('tp-opacity-val');
    const shippingToggle = shadow.getElementById('tp-shipping-toggle');
    const sortNone = shadow.getElementById('tp-sort-none');
    const sortDesc = shadow.getElementById('tp-sort-desc');
    const sortAsc = shadow.getElementById('tp-sort-asc');
    const sortDiscount = shadow.getElementById('tp-sort-discount');
    const alarmEnabledToggle = shadow.getElementById('tp-alarm-enabled-toggle');
    const alarmTargetRange = shadow.getElementById('tp-alarm-target-range');
    const alarmTargetVal = shadow.getElementById('tp-alarm-target-val');
    const alarmAutoSubmitToggle = shadow.getElementById('tp-alarm-autosubmit-toggle');
    const heatmapEnabledToggle = shadow.getElementById('tp-heatmap-enabled-toggle');
    const heatmapIntensityRange = shadow.getElementById('tp-heatmap-intensity-range');
    const heatmapIntensityVal = shadow.getElementById('tp-heatmap-intensity-val');
    const bestpreiseModeToggle = shadow.getElementById('tp-bestpreise-mode-toggle');
    const hideUncheckedToggle = shadow.getElementById('tp-hide-unchecked-toggle');
    const bestpreiseWeightGroup = shadow.getElementById('tp-bestpreise-weight-group');
    const bestpreiseWeightRange = shadow.getElementById('tp-bestpreise-weight-range');
    const bestpreiseWeightVal = shadow.getElementById('tp-bestpreise-weight-val');
    const bestpreiseWeightDesc = shadow.getElementById('tp-bestpreise-weight-desc');
    const bestpreiseHorizonGroup = shadow.getElementById('tp-bestpreise-horizon-group');
    const bestpreiseHorizonSelect = shadow.getElementById('tp-bestpreise-horizon-select');
    const cacheTtlSelect = shadow.getElementById('tp-cache-ttl-select');
    const cacheNegTtlSelect = shadow.getElementById('tp-cache-neg-ttl-select');
    const cacheStatsLabel = shadow.getElementById('tp-cache-stats-label');
    const cacheClearBtn = shadow.getElementById('tp-cache-clear-btn');
    const realDealMinRange = shadow.getElementById('tp-real-deal-min-range');
    const realDealMinVal = shadow.getElementById('tp-real-deal-min-val');
    const sparklinesToggle = shadow.getElementById('tp-sparklines-toggle');
    const dur90 = shadow.getElementById('tp-dur-90');
    const dur180 = shadow.getElementById('tp-dur-180');
    const dur365 = shadow.getElementById('tp-dur-365');
    const dur730 = shadow.getElementById('tp-dur-730');
    const advancedDetails = shadow.getElementById('tp-advanced-details');
    const discordWebhookInput = shadow.getElementById('tp-discord-webhook-input');

    const exportBtn = shadow.getElementById('tp-export-config-btn');
    const importBtn = shadow.getElementById('tp-import-config-btn');
    const importFile = shadow.getElementById('tp-import-config-file');

    function syncFieldsFromConfig() {
      if (advancedDetails) advancedDetails.open = CONFIG.SHOW_ADVANCED === true;
      if (CONFIG.MODE === 'highlight-only') modeHighlight.checked = true;
      else if (CONFIG.MODE === 'hide') modeHide.checked = true;
      else modeDim.checked = true;

      marginRange.value = CONFIG.MARGIN_PERCENT;
      marginVal.value = CONFIG.MARGIN_PERCENT;
      opacityRange.value = CONFIG.DIM_OPACITY;
      opacityVal.value = Math.round(CONFIG.DIM_OPACITY * 100);
      if (shippingToggle) shippingToggle.checked = CONFIG.USE_SHIPPING_PRICE;

      if (CONFIG.SORT_BY_OFFERS === 'desc') sortDesc.checked = true;
      else if (CONFIG.SORT_BY_OFFERS === 'asc') sortAsc.checked = true;
      else if (CONFIG.SORT_BY_OFFERS === 'discount-desc') sortDiscount.checked = true;
      else sortNone.checked = true;

      alarmEnabledToggle.checked = CONFIG.ALARM_ENABLED !== false;
      const targetPct = Math.round(CONFIG.ALARM_TARGET_PERCENT * 100);
      alarmTargetRange.value = targetPct;
      alarmTargetVal.value = targetPct;

      const dur = String(CONFIG.ALARM_DURATION_DAYS);
      if (dur === '90') dur90.checked = true;
      else if (dur === '180') dur180.checked = true;
      else if (dur === '365') dur365.checked = true;
      else dur730.checked = true;

      alarmAutoSubmitToggle.checked = CONFIG.ALARM_AUTO_SUBMIT !== false;

      heatmapEnabledToggle.checked = CONFIG.HEATMAP_ENABLED !== false;
      const heatIntensityPct = Math.round((CONFIG.HEATMAP_INTENSITY ?? 1.0) * 100);
      heatmapIntensityRange.value = heatIntensityPct;
      heatmapIntensityVal.value = heatIntensityPct;

      if (bestpreiseModeToggle) bestpreiseModeToggle.checked = CONFIG.BESTPREISE_MODE_ACTIVE === true;
      if (hideUncheckedToggle) hideUncheckedToggle.checked = CONFIG.BESTPREISE_HIDE_UNCHECKED === true;
      if (bestpreiseWeightGroup) {
        bestpreiseWeightGroup.style.display = (CONFIG.BESTPREISE_MODE_ACTIVE === true) ? 'block' : 'none';
      }
      if (bestpreiseHorizonGroup) {
        bestpreiseHorizonGroup.style.display = (CONFIG.BESTPREISE_MODE_ACTIVE === true) ? 'block' : 'none';
      }
      if (bestpreiseHorizonSelect) {
        bestpreiseHorizonSelect.value = String(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365);
      }
      const weightPct = Math.round((CONFIG.BESTPREISE_WEIGHT_RECORD ?? 0.50) * 100);
      if (bestpreiseWeightRange) bestpreiseWeightRange.value = weightPct;
      if (bestpreiseWeightVal) bestpreiseWeightVal.value = weightPct;
      if (bestpreiseWeightDesc) {
        bestpreiseWeightDesc.textContent = weightText((CONFIG.BESTPREISE_WEIGHT_RECORD ?? 0.50), 'desc');
      }

      if (cacheTtlSelect) cacheTtlSelect.value = String(CONFIG.REAL_DEAL_CACHE_HOURS || 48);
      if (cacheNegTtlSelect) cacheNegTtlSelect.value = String(CONFIG.NEGATIVE_CACHE_HOURS || 2);
      if (cacheStatsLabel) {
        const count = countCachedPriceStats();
        cacheStatsLabel.textContent = `Lokaler Cache: ${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`;
      }

      if (realDealMinRange) realDealMinRange.value = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
      if (realDealMinVal) realDealMinVal.value = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
      if (sparklinesToggle) sparklinesToggle.checked = CONFIG.ENABLE_SPARKLINES === true;
      if (discordWebhookInput) discordWebhookInput.value = CONFIG.DISCORD_WEBHOOK_URL || '';
    }

    const bindDual = (rangeEl, numEl, onInput = null) => {
      if (!rangeEl || !numEl) return;
      rangeEl.addEventListener('input', e => {
        numEl.value = e.target.value;
        onInput?.(parseFloat(e.target.value));
      });
      numEl.addEventListener('input', e => {
        // Clamp typed values into the slider's range so the pair can't desync.
        const min = parseFloat(rangeEl.min);
        const max = parseFloat(rangeEl.max);
        const typed = parseFloat(e.target.value);
        if (!isNaN(min) && !isNaN(max) && !isNaN(typed)) {
          rangeEl.value = Math.min(max, Math.max(min, typed));
        } else {
          rangeEl.value = e.target.value;
        }
        onInput?.(parseFloat(e.target.value));
      });
    };

    bindDual(marginRange, marginVal);
    if (opacityRange && opacityVal) {
      opacityRange.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        opacityVal.value = Math.round(v * 100);
        document.documentElement.style.setProperty('--tp-dim-opacity', v);
      });
      opacityVal.addEventListener('input', e => {
        const v = Math.min(0.95, Math.max(0.05, (parseFloat(e.target.value) || 0) / 100));
        opacityRange.value = v;
        document.documentElement.style.setProperty('--tp-dim-opacity', v);
      });
    }
    bindDual(alarmTargetRange, alarmTargetVal);
    bindDual(heatmapIntensityRange, heatmapIntensityVal);
    bindDual(realDealMinRange, realDealMinVal);

    const updateWeightDesc = (val) => {
      if (bestpreiseWeightDesc) {
        bestpreiseWeightDesc.textContent = weightText(val / 100, 'desc');
      }
    };
    bindDual(bestpreiseWeightRange, bestpreiseWeightVal, updateWeightDesc);

    bestpreiseModeToggle?.addEventListener('change', () => {
      if (bestpreiseWeightGroup) {
        bestpreiseWeightGroup.style.display = bestpreiseModeToggle.checked ? 'block' : 'none';
      }
      if (bestpreiseHorizonGroup) {
        bestpreiseHorizonGroup.style.display = bestpreiseModeToggle.checked ? 'block' : 'none';
      }
    });

    // The toggle event is queued async; predict from the pre-click state in the
    // click itself so SHOW_ADVANCED persists synchronously (as the old switch did).
    advancedDetails?.querySelector('summary')?.addEventListener('click', () => { saveConfigKey('SHOW_ADVANCED', !advancedDetails.open); });

    cacheClearBtn?.addEventListener('click', () => {
      const removed = clearPriceStatsCache();
      if (cacheStatsLabel) cacheStatsLabel.textContent = 'Lokaler Cache: 0 Einträge';
      processListings();
      showToast(`Cache geleert (${removed} Produkte entfernt)`);
    });

    exportBtn?.addEventListener('click', () => {
      const exportData = {
        _meta: {
          version: (typeof GM_info !== 'undefined' && GM_info?.script?.version) || '2.18.20',
          exported: new Date().toISOString()
        },
        // Bearer-Secret nie exportieren (JSON.stringify droppt undefined).
        config: { ...CONFIG, DISCORD_WEBHOOK_URL: undefined },
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `toppreise-suite-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Einstellungen exportiert');
    });

    importBtn?.addEventListener('click', () => {
      importFile?.click();
    });

    importFile?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const importConfig = data.config || data;
          let count = 0;
          for (const [key, val] of Object.entries(importConfig)) {
            if (!(key in DEFAULTS) || key === 'DEBUG') continue;
            if (!(key in DEFAULTS) || key === 'DEBUG' || key === 'DISCORD_WEBHOOK_URL') continue;
            // Coerce to the DEFAULTS type: save clamps, import must not store
            // NaN/garbage (or legacy numeric strings) raw.
            const def = DEFAULTS[key];
            let coerced = val;
            if (typeof def === 'number') {
              coerced = typeof val === 'number' ? val : parseFloat(val);
              if (!Number.isFinite(coerced)) continue;
            } else if (typeof def === 'boolean') {
              if (val === true || val === 'true') coerced = true;
              else if (val === false || val === 'false') coerced = false;
              else continue;
            } else if (typeof def === 'string') {
              coerced = String(val);
            } else {
              continue;
            }
            saveConfigKey(key, coerced);
            count++;
          }
          updateBodyClasses();
          processListings();
          syncFieldsFromConfig();
          showToast(`${count} Einstellungen importiert`);
        } catch (err) {
          showToast('Import fehlgeschlagen: Ungültige JSON-Datei');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    const openModal = () => {
      syncFieldsFromConfig();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    };

    const closeModal = () => {
      document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    };

    fabButton.addEventListener('click', openModal);
    btnClose.addEventListener('click', closeModal);
    shadow.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    btnSave.addEventListener('click', () => {
      const updates = {};
      const checkedModeEl = shadow.querySelector('input[name="tp-mode"]:checked');
      if (checkedModeEl) updates.MODE = checkedModeEl.value;

      updates.MARGIN_PERCENT = Math.max(0, Math.min(100, parseFloat(marginVal.value) || 0));
      updates.DIM_OPACITY = Math.max(0.05, Math.min(0.95, parseFloat(opacityRange.value) || 0.25));
      // Cached price stats are shipping-mode specific (product vs shipping series
      // share one cache key), so a mode change must invalidate them.
      const shippingChanged = !!shippingToggle && CONFIG.USE_SHIPPING_PRICE !== shippingToggle.checked;
      if (shippingToggle) updates.USE_SHIPPING_PRICE = shippingToggle.checked;

      const checkedSort = shadow.querySelector('input[name="tp-sort-offers"]:checked');
      if (checkedSort) updates.SORT_BY_OFFERS = checkedSort.value;

      updates.ALARM_ENABLED = alarmEnabledToggle.checked;
      updates.ALARM_TARGET_PERCENT = Math.max(0.05, Math.min(0.99, (parseInt(alarmTargetVal.value) || 60) / 100));

      const checkedDur = shadow.querySelector('input[name="tp-alarm-duration"]:checked');
      if (checkedDur) updates.ALARM_DURATION_DAYS = parseInt(checkedDur.value, 10) || 730;

      updates.ALARM_AUTO_SUBMIT = alarmAutoSubmitToggle.checked;
      updates.HEATMAP_ENABLED = heatmapEnabledToggle.checked;
      updates.HEATMAP_INTENSITY = Math.max(0.2, Math.min(1.0, (parseInt(heatmapIntensityVal.value) || 100) / 100));

      if (bestpreiseModeToggle) {
        updates.BESTPREISE_MODE_ACTIVE = bestpreiseModeToggle.checked;
        if (bestpreiseWeightVal) {
          const rawW = parseInt(bestpreiseWeightVal.value, 10);
          const weightNum = isNaN(rawW) ? 50 : rawW;
          updates.BESTPREISE_WEIGHT_RECORD = Math.max(0, Math.min(1.0, weightNum / 100));
        }
        if (bestpreiseHorizonSelect) {
          const rawH = parseInt(bestpreiseHorizonSelect.value, 10);
          updates.BESTPREISE_MEDIAN_HORIZON_DAYS = isNaN(rawH) ? 0 : rawH;
        }
      }
      if (hideUncheckedToggle) updates.BESTPREISE_HIDE_UNCHECKED = hideUncheckedToggle.checked;
      if (cacheTtlSelect) { const rawC = parseInt(cacheTtlSelect.value, 10); updates.REAL_DEAL_CACHE_HOURS = isNaN(rawC) ? 48 : rawC; }
      if (cacheNegTtlSelect) { const rawN = parseInt(cacheNegTtlSelect.value, 10); updates.NEGATIVE_CACHE_HOURS = isNaN(rawN) ? 2 : rawN; }

      if (realDealMinVal) updates.REAL_DEAL_MIN_DISCOUNT = Math.max(5, Math.min(95, parseInt(realDealMinVal.value) || 30));
      if (sparklinesToggle) updates.ENABLE_SPARKLINES = sparklinesToggle.checked;
      if (discordWebhookInput) updates.DISCORD_WEBHOOK_URL = String(discordWebhookInput.value || '').trim();
      updates.SHOW_ADVANCED = !!advancedDetails?.open;

      updateConfigs(updates);
      if (shippingChanged) clearPriceStatsCache();
      showToast('Toppreise Suite Einstellungen gespeichert');
      closeModal();
    });
  }

  // ─── MODULE: src/ui/toast.js ────────────────────────────────────────────────
  /**
   * Toast Notification Component
   * Renders glassmorphic notifications inside Shadow DOM.
   */


  function showToast(message) {
    const { shadow } = ensureSkeleton();
    const container = shadow?.getElementById('tp-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'tp-toast';
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  // ─── MODULE: src/ui/toolbar.js ──────────────────────────────────────────────
  /**
   * Suite Filter Toolbar Component
   * Manages the inline/floating contextual filter bar, quick filters,
   * deal thresholds, and scan progress.
   */








  function getSuiteBarPlacement() {
    const bar = document.getElementById('tp-suite-filter-bar');
    const isSafe = el => el && !el.closest('.header, [class*="MainTopHead"], [class*="MainHead"], .f_filter_plugin, .filters, .filterBox, #tp-root, dialog');
    const targets = ['#Page_ListTopPriceReductionProducts', '#Page_ListTop100Products', '[id^="Page_List"]', '#Page_Browsing', '.f_browsingListContainer', '#Plugin_MixedBrowsingList', '.standardList', '#product-list'];
    for (const sel of targets) {
      const el = document.querySelector(sel);
      if (el?.parentElement && isSafe(el.parentElement) && el !== bar) return { container: el.parentElement, reference: el };
    }
    const containers = SELECTORS.layout.containers.map(sel => document.querySelector(sel)).filter(Boolean);
    for (const c of containers) {
      if (c && isSafe(c) && c !== bar) {
        let ref = c.firstElementChild;
        while (ref && (ref === bar || !isSafe(ref))) ref = ref.nextElementSibling;
        return { container: c, reference: ref || null };
      }
    }
    return { container: document.body, reference: document.body.firstElementChild };
  }

  // Tools dimmed when their mini-toggle is OFF (the toggle itself stays bright).
  const DIM_TARGETS_BY_TOGGLE = {
    'tp-toggle-neg': ['.tp-input-field-box'],
    'tp-toggle-min': ['.tp-stepper-btn', '#tp-bar-min-val', '.tp-stepper-label'],
  };
  function syncMiniToggle(input, enabled, titleBase) {
    if (!input) return;
    input.checked = !!enabled;
    const label = input.closest?.('.tp-mini-switch');
    const title = `${titleBase} ${enabled ? 'AN' : 'AUS'}`;
    if (label) label.title = title;
    const state = label?.querySelector('.tp-mini-state');
    if (state) state.textContent = enabled ? 'ON' : 'OFF';
    const scope = input.closest?.('.tp-bar-stepper-group, .tp-threshold-wrapper, .tp-input-wrapper, .tp-group');
    const caption = scope?.querySelector('.tp-mini-caption');
    if (caption) caption.title = title;
    for (const sel of (DIM_TARGETS_BY_TOGGLE[input.id] || [])) {
      scope?.querySelectorAll(sel).forEach(node => node.classList.toggle('tp-tool-dim', !enabled));
    }
  }
  function bindBestpreiseBtn(btn) {
    btn.onclick = () => {
      const next = !CONFIG.BESTPREISE_MODE_ACTIVE;
      cancelBestpreiseScan();
      updateConfig('BESTPREISE_MODE_ACTIVE', next);
      showToast(next ? '💎 Neue Tiefstpreise-Modus aktiviert' : 'Tiefstpreise-Modus deaktiviert');
    };
  }

  function ensureDealControlsPlacement(isDealFeed) {
    const tf = document.querySelector('#timeframe-filter') || document.querySelector('.Plugin_TimePeriod');
    const home = document.querySelector('#tp-suite-filter-bar .tp-group-deals');
    let btn = document.getElementById('tp-bar-bestpreise-btn');
    let weight = document.getElementById('tp-bar-weight-wrapper');
    if (!isDealFeed || !tf) {
      if (home) {
        if (btn && btn.parentElement !== home) home.prepend(btn);
        if (weight && weight.parentElement !== home) home.append(weight);
      }
      return;
    }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'tp-bar-bestpreise-btn';
      btn.type = 'button';
      btn.className = 'tp-bar-btn';
      btn.title = 'Neue Tiefstpreise Modus: Verifizierte Tiefstpreise nach echtem Rabatt filtern und sortieren';
      bindBestpreiseBtn(btn);
    }
    if (!weight) weight = buildWeightWrapper();
    if (btn.parentElement !== tf) tf.prepend(btn);
    if (weight.parentElement !== tf || weight.previousElementSibling !== btn) btn.after(weight);
  }

  function bindWeightControls(wrapper) {
    const weightRange = wrapper.querySelector('#tp-bar-weight-range');
    const weightLabel = wrapper.querySelector('#tp-bar-weight-label');
    if (!weightRange) return;
    const readWeight = () => Math.max(0, Math.min(1, (parseInt(weightRange.value, 10) || 0) / 100));
    const paintWeightLabel = () => {
      if (!weightLabel) return;
      const w = readWeight();
      weightLabel.textContent = `⚖️ ${weightText(w, 'short')}`;
      weightLabel.title = weightText(w, 'title');
    };
    paintWeightLabel();
    weightRange.oninput = () => {
      paintWeightLabel();
      clearTimeout(window._tpWeightDeb);
      window._tpWeightDeb = setTimeout(() => {
        updateConfig('BESTPREISE_WEIGHT_RECORD', readWeight());
      }, 150);
    };
    weightRange.onchange = () => {
      clearTimeout(window._tpWeightDeb);
      const w = readWeight();
      paintWeightLabel();
      updateConfig('BESTPREISE_WEIGHT_RECORD', w);
      showToast(`Sortier-Gewichtung: ${Math.round((1 - w) * 100)}% Ø-Preis / ${Math.round(w * 100)}% Rekord (Reihenfolge + Farb-Emphase)`);
    };
  }

  function buildWeightWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'tp-threshold-wrapper';
    wrapper.id = 'tp-bar-weight-wrapper';
    wrapper.title = 'Reihenfolge + Farb-Emphase — Badge zeigt die Gewichtete Differenz.';
    wrapper.innerHTML = `
      <span class="tp-weight-label" id="tp-bar-weight-label">⚖️ 50/50</span>
      <input type="range" id="tp-bar-weight-range" min="0" max="100" step="5" value="50" list="tp-bar-weight-ticks" title="Tiefstpreis-Gewichtung stufenlos: links Ø-Schnäppchen, rechts Rekord-Jagd">
      <datalist id="tp-bar-weight-ticks">
        <option value="0" label="Ø"></option>
        <option value="30"></option>
        <option value="50"></option>
        <option value="70"></option>
        <option value="100" label="Rek"></option>
      </datalist>`;
    bindWeightControls(wrapper);
    return wrapper;
  }


  function renderSuiteFilterBar(counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, bestpreiseHidden: 0, badDeals: 0, uncheckedHidden: 0 }, pageHasOffers = false, isDealFeed = false) {
    const placement = getSuiteBarPlacement();
    if (!placement?.container) return;

    let bar = document.getElementById('tp-suite-filter-bar');
    const bestpreiseDeals = counts.bestpreiseDeals || 0;
    const revealNeg = document.body.classList.contains('tp-reveal-neg');
    const revealMin = document.body.classList.contains('tp-reveal-min');
    const revealBad = document.body.classList.contains('tp-reveal-baddeals');
    const revealUnchecked = document.body.classList.contains('tp-reveal-unchecked');
    const negHidden = counts.neg || 0;
    const minHidden = counts.min || 0;
    const badHidden = counts.badDeals || 0;
    const uncheckedHiddenCount = counts.uncheckedHidden || 0;

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'tp-suite-filter-bar';
      if (CONFIG.BESTPREISE_MODE_ACTIVE) bar.classList.add('tp-bestpreise-bar');
      bar.innerHTML = `
        <div class="tp-filter-main-row">
         <div class="tp-group tp-group-filter" role="group" aria-label="Filter">
          <span class="tp-group-label" aria-hidden="true">Filter</span>
          <div class="tp-input-wrapper" title="Kommagetrennte Begriffe eingeben">
            <span class="tp-input-label-inline">🚫 Negativ-Filter:</span>
            <div class="tp-input-field-box">
              <input type="text" id="tp-inline-negative-input" placeholder="Wörter ausschließen..." value="${CONFIG.NEGATIVE_TERMS || ''}">
              <button id="tp-clear-neg-btn" title="Text leeren" style="display: ${CONFIG.NEGATIVE_TERMS ? 'block' : 'none'};">✕</button>
            </div>
            <label class="tp-mini-switch" title="Negativ-Filter (Text) ${CONFIG.FILTER_NEG_ENABLED ? 'AN' : 'AUS'}">
              <input type="checkbox" id="tp-toggle-neg" ${CONFIG.FILTER_NEG_ENABLED ? 'checked' : ''}>
              <span class="tp-mini-slider"></span>
              <span class="tp-mini-state">${CONFIG.FILTER_NEG_ENABLED ? 'ON' : 'OFF'}</span>
            </label>
          </div>
          <div class="tp-reveal-menu-wrapper">
            <button class="tp-bar-btn" id="tp-bar-reveal-menu" title="Ausgeblendete Produkte anzeigen — klicken zum Öffnen">👁️ Ausgeblendete (0)</button>
            <div id="tp-bar-reveal-popover" role="menu" aria-label="Ausgeblendete Produkte">
              <button class="tp-bar-btn ${revealNeg ? 'tp-active' : ''}" id="tp-bar-reveal-neg" title="Durch Negativ-Filter ausgeblendete Produkte (${negHidden}) anzeigen — klicken zum Ein-/Ausblenden">Gefilterte (${negHidden})</button>
              <button class="tp-bar-btn ${revealMin ? 'tp-active' : ''}" id="tp-bar-reveal-min" title="Produkte mit zu wenigen Angeboten (${minHidden}) anzeigen — klicken zum Ein-/Ausblenden">Wenig Angebote (${minHidden})</button>
              <button class="tp-bar-btn ${revealBad ? 'tp-active' : ''}" id="tp-bar-reveal-baddeals" title="Verifizierte Nicht-Deals mit Aufschlag (${badHidden}) anzeigen — klicken zum Ein-/Ausblenden">Schlechte Deals (${badHidden})</button>
              <button class="tp-bar-btn ${revealUnchecked ? 'tp-active' : ''}" id="tp-bar-reveal-unchecked" title="Noch ungeprüfte Deals (${uncheckedHiddenCount}) anzeigen — klicken zum Ein-/Ausblenden">Ungeprüfte (${uncheckedHiddenCount})</button>
              <div class="tp-reveal-hint" id="tp-bar-reveal-hint">Keine ausgeblendeten Produkte</div>
            </div>
          </div>
          <div class="tp-bar-stepper-group" id="tp-bar-min-offers-group" style="display: ${pageHasOffers ? 'flex' : 'none'};" title="Produkte mit weniger als N Angeboten ausblenden">
            <span class="tp-stepper-label">Min-Angebote:</span>
            <button class="tp-stepper-btn" id="tp-bar-min-minus">-</button>
            <span id="tp-bar-min-val" style="min-width: 14px; text-align: center;">${CONFIG.MIN_OFFERS}</span>
            <button class="tp-stepper-btn" id="tp-bar-min-plus">+</button>
            <span class="tp-mini-caption" title="Min-Angebote-Filter ${CONFIG.FILTER_MIN_ENABLED ? 'AN' : 'AUS'}">Aktiv</span>
            <label class="tp-mini-switch" title="Min-Angebote-Filter ${CONFIG.FILTER_MIN_ENABLED ? 'AN' : 'AUS'}">
              <input type="checkbox" id="tp-toggle-min" ${CONFIG.FILTER_MIN_ENABLED ? 'checked' : ''}>
              <span class="tp-mini-slider"></span>
              <span class="tp-mini-state">${CONFIG.FILTER_MIN_ENABLED ? 'ON' : 'OFF'}</span>
            </label>
          </div>
         </div>
         <span class="tp-divider" aria-hidden="true"></span>
         <div class="tp-group tp-group-view" role="group" aria-label="Ansicht">
          <span class="tp-group-label" aria-hidden="true">Ansicht</span>
          <button class="tp-bar-btn ${CONFIG.HEATMAP_ENABLED ? 'tp-active' : ''}" id="tp-bar-heat-btn" title="Heatmap: Karten- und Badge-Farbe folgt stets der angezeigten Badge-% — Tiefrot = grosser Tiefstpreis, Grau = kein Rabatt. Grau gestreift = ungeprüft (Differenz)." style="display: flex;">🔥 Heatmap</button>
         </div>
         <span class="tp-divider" aria-hidden="true"></span>
         <div class="tp-group tp-group-deals" role="group" aria-label="Tiefstpreise">
          <button class="tp-bar-btn ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'tp-bestpreise-active' : ''}" id="tp-bar-bestpreise-btn" title="Neue Tiefstpreise Modus: Verifizierte Tiefstpreise nach echtem Rabatt filtern und sortieren" style="display: ${isDealFeed ? 'flex' : 'none'};">
            💎 Neue Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>
          </button>
          <div class="tp-threshold-wrapper" id="tp-bar-weight-wrapper" style="display: ${isDealFeed && CONFIG.BESTPREISE_MODE_ACTIVE ? 'inline-flex' : 'none'};" title="Reihenfolge + Farb-Emphase — Badge zeigt Rekord & Ø.">
            <span class="tp-weight-label" id="tp-bar-weight-label">⚖️ 50/50</span>
            <input type="range" id="tp-bar-weight-range" min="0" max="100" step="5" value="50" list="tp-bar-weight-ticks" title="Tiefstpreis-Gewichtung stufenlos: links Ø-Schnäppchen, rechts Rekord-Jagd">
            <datalist id="tp-bar-weight-ticks">
              <option value="0" label="Ø"></option>
              <option value="30"></option>
              <option value="50"></option>
              <option value="70"></option>
              <option value="100" label="Rek"></option>
            </datalist>
          </div>
         </div>
        </div>
      `;

      if (placement.reference && placement.reference.parentElement === placement.container && placement.reference !== bar) {
        placement.container.insertBefore(bar, placement.reference);
      } else {
        placement.container.appendChild(bar);
      }

      const input = bar.querySelector('#tp-inline-negative-input');
      const clearBtn = bar.querySelector('#tp-clear-neg-btn');

      input.onkeydown = e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          input.blur();
        }
      };

      input.oninput = e => {
        updateConfig('NEGATIVE_TERMS', e.target.value);
      };

      clearBtn.onclick = () => {
        updateConfig('NEGATIVE_TERMS', '');
      };

      const bindReveal = (id, flag) => {
        bar.querySelector('#' + id).onclick = () => {
          document.body.classList.toggle(flag);
          triggerProcessListings();
        };
      };
      bindReveal('tp-bar-reveal-neg', 'tp-reveal-neg');
      bindReveal('tp-bar-reveal-min', 'tp-reveal-min');
      bindReveal('tp-bar-reveal-baddeals', 'tp-reveal-baddeals');
      bindReveal('tp-bar-reveal-unchecked', 'tp-reveal-unchecked');
      const revealMenuBtn = bar.querySelector('#tp-bar-reveal-menu');
      const revealPopover = bar.querySelector('#tp-bar-reveal-popover');
      if (revealMenuBtn && revealPopover) {
        revealMenuBtn.onclick = e => {
          e.stopPropagation();
          revealPopover.classList.toggle('tp-show');
        };
        if (!window._tpRevealMenuDocBound) {
          window._tpRevealMenuDocBound = true;
          document.addEventListener('click', e => {
            if (!e.isTrusted) return; // Synthetic clicks (price-alarm auto-submit) must not dismiss the popover.
            const b = document.getElementById('tp-suite-filter-bar');
            if (b && !b.contains(e.target)) {
              b.querySelector('#tp-bar-reveal-popover')?.classList.remove('tp-show');
            }
          });
        }
      }

      bar.querySelector('#tp-bar-heat-btn').onclick = () => {
        const nextState = !CONFIG.HEATMAP_ENABLED;
        updateConfig('HEATMAP_ENABLED', nextState);
      };

      const bestpreiseToggleBtn = bar.querySelector('#tp-bar-bestpreise-btn');
      if (bestpreiseToggleBtn) bindBestpreiseBtn(bestpreiseToggleBtn);


      // Weight slider: live label on drag, debounced config write (each write
      // re-sorts the feed), immediate flush + toast on release.
      const weightWrapperInit = bar.querySelector('#tp-bar-weight-wrapper');
      if (weightWrapperInit) bindWeightControls(weightWrapperInit);

      const updateMinOffers = delta => {
        const next = Math.max(0, CONFIG.MIN_OFFERS + delta);
        if (next !== CONFIG.MIN_OFFERS) {
          updateConfig('MIN_OFFERS', next);
        }
      };

      bar.querySelector('#tp-bar-min-minus').onclick = () => updateMinOffers(-1);
      bar.querySelector('#tp-bar-min-plus').onclick = () => updateMinOffers(1);
      const bindMiniToggle = (id, key, titleBase, onMsg, offMsg) => {
        const el = bar.querySelector('#' + id);
        if (!el) return;
        syncMiniToggle(el, CONFIG[key], titleBase);
        el.onchange = () => {
          updateConfig(key, el.checked);
          syncMiniToggle(el, el.checked, titleBase);
          showToast(el.checked ? onMsg : offMsg);
        };
      };
      bindMiniToggle('tp-toggle-neg', 'FILTER_NEG_ENABLED', 'Negativ-Filter (Text)', '📝 Negativ-Filter AN', '📝 Negativ-Filter AUS');
      bindMiniToggle('tp-toggle-min', 'FILTER_MIN_ENABLED', 'Min-Angebote-Filter', '🔢 Min-Angebote-Filter AN', '🔢 Min-Angebote-Filter AUS');
    } else if (bar.parentElement !== placement.container || (bar.nextSibling !== placement.reference && placement.reference !== bar)) {
      if (placement.reference && placement.reference.parentElement === placement.container && placement.reference !== bar) {
        placement.container.insertBefore(bar, placement.reference);
      } else {
        placement.container.appendChild(bar);
      }
    }

    bar.style.display = 'flex';
    bar.classList.toggle('tp-bestpreise-bar', CONFIG.BESTPREISE_MODE_ACTIVE === true);

    const input = bar.querySelector('#tp-inline-negative-input');
    const clearBtn = bar.querySelector('#tp-clear-neg-btn');
    if (input && document.activeElement !== input) {
      input.value = CONFIG.NEGATIVE_TERMS || '';
      if (clearBtn) clearBtn.style.display = CONFIG.NEGATIVE_TERMS ? 'block' : 'none';
    }

    const syncRevealBtn = (id, label, count, flag, titleBase) => {
      const b = bar.querySelector('#' + id);
      if (!b) return;
      b.style.setProperty('display', count > 0 ? 'flex' : 'none', 'important');
      b.classList.toggle('tp-active', document.body.classList.contains(flag));
      b.textContent = `${label} (${count})`;
      b.title = `${titleBase} (${count}) anzeigen — klicken zum Ein-/Ausblenden`;
    };
    syncRevealBtn('tp-bar-reveal-neg', '👁 Gefilterte', negHidden, 'tp-reveal-neg', 'Durch Negativ-Filter ausgeblendete Produkte');
    syncRevealBtn('tp-bar-reveal-min', '👁 Wenig Angebote', minHidden, 'tp-reveal-min', 'Produkte mit zu wenigen Angeboten');
    syncRevealBtn('tp-bar-reveal-baddeals', '👁 Schlechte Deals', badHidden, 'tp-reveal-baddeals', 'Verifizierte Nicht-Deals mit Aufschlag');
    syncRevealBtn('tp-bar-reveal-unchecked', '👁 Ungeprüfte', uncheckedHiddenCount, 'tp-reveal-unchecked', 'Noch ungeprüfte Deals');
    const hiddenTotal = negHidden + minHidden + badHidden + uncheckedHiddenCount;
    const revealMenuBtnSync = bar.querySelector('#tp-bar-reveal-menu');
    if (revealMenuBtnSync) {
      setTextIfChanged(revealMenuBtnSync, `👁️ Ausgeblendete (${hiddenTotal})`);
      revealMenuBtnSync.classList.toggle('tp-tool-dim', hiddenTotal === 0);
      revealMenuBtnSync.title = hiddenTotal > 0 ? `Ausgeblendete Produkte (${hiddenTotal}) anzeigen — klicken zum Öffnen` : 'Keine ausgeblendeten Produkte';
    }
    const revealHint = bar.querySelector('#tp-bar-reveal-hint');
    if (revealHint) revealHint.style.setProperty('display', hiddenTotal === 0 ? 'block' : 'none', 'important');

    const heatBtn = bar.querySelector('#tp-bar-heat-btn');
    if (heatBtn) {
      heatBtn.classList.toggle('tp-active', CONFIG.HEATMAP_ENABLED !== false);
      heatBtn.style.setProperty('display', 'flex', 'important');
    }

    // Place first so the state sync below also covers nodes recreated after a native AJAX wipe.
    ensureDealControlsPlacement(isDealFeed);

    const bestpreiseBtn = document.getElementById('tp-bar-bestpreise-btn');
    if (bestpreiseBtn) {
      bestpreiseBtn.classList.toggle('tp-bestpreise-active', CONFIG.BESTPREISE_MODE_ACTIVE === true);
      bestpreiseBtn.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
      if (scanState.isBestpreiseScanning) {
        // Leave dynamic text during scan
      } else if (CONFIG.BESTPREISE_MODE_ACTIVE) {
        bestpreiseBtn.innerHTML = `💎 Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>`;
      } else {
        bestpreiseBtn.innerHTML = `💎 Neue Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>`;
      }
    }

    syncMiniToggle(bar.querySelector('#tp-toggle-neg'), CONFIG.FILTER_NEG_ENABLED, 'Negativ-Filter (Text)');
    syncMiniToggle(bar.querySelector('#tp-toggle-min'), CONFIG.FILTER_MIN_ENABLED, 'Min-Angebote-Filter');
    // Strictness lives in the Tiefstpreise mode now — no separate toggle to sync.

    const curWeight = typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number' ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50;
    const weightRange = document.getElementById('tp-bar-weight-range');
    // Skip while dragging: the input handler owns the label mid-drag.
    if (weightRange && document.activeElement !== weightRange) {
      weightRange.value = Math.round(curWeight * 100);
    }
    const weightLabel = document.getElementById('tp-bar-weight-label');
    if (weightLabel) {
      weightLabel.textContent = `⚖️ ${weightText(curWeight, 'short')}`;
      weightLabel.title = weightText(curWeight, 'title');
    }
    const weightWrapper = document.getElementById('tp-bar-weight-wrapper');
    if (weightWrapper) {
      weightWrapper.style.setProperty('display', (isDealFeed && CONFIG.BESTPREISE_MODE_ACTIVE) ? 'inline-flex' : 'none', 'important');
    }

    const minGroup = bar.querySelector('#tp-bar-min-offers-group');
    if (minGroup) minGroup.style.display = pageHasOffers ? 'flex' : 'none';
    const minVal = bar.querySelector('#tp-bar-min-val');
    if (minVal) minVal.textContent = CONFIG.MIN_OFFERS;
  }

  // ─── MODULE: src/ui/floating-cta.js ─────────────────────────────────────────
  /**
   * Floating Check-Deals CTA Component
   * Primary one-click entry point for Tiefstpreis verification.
   *
   * Why this exists: the toolbar packs ~8 controls into one row (FILTER |
   * ANSICHT | DEALS) and the highest-value action — verifying N unchecked
   * deals — drowns at the far right as just another small button. This
   * floating pill (bottom-left, thumb-reachable, above page content but clear
   * of the bottom-right settings FAB) carries that single action with live
   * progress, threshold selection, and session collapse (minimizable, never
   * fully closable — the primary action must stay one click away). The pill
   * never auto-hides on empty: with 0 deals left it stays visible in dimmed
   * form (grey instead of green) so users always find it in the same spot.
   *
   * Architecture: create-once + sync. The node is built and bound exactly
   * once (listeners never re-attached); every render only updates textContent
   * / classes when changed, so focus and in-flight scan callbacks survive
   * re-renders. Pure label logic lives in ctaStateFor() for unit testing
   * without a DOM.
   */







  const FLOATING_CTA_ID = 'tp-floating-check-cta';
  const THRESHOLD_OPTIONS = [20, 30, 40, 50, 60];

  let collapsedForSession = false;
  let lastCounts = { uncheckedDeals: 0 };
  let lastIsDealFeed = false;

  /**
   * Pure label state machine (no DOM): idle → scanning → done (empty).
   * The done state keeps the action name with a 0 count so the CTA never
   * disappears — syncFloatingCTA dims it via the .tp-empty class instead.
   * Unit-tested in tests/unit/floating-cta.test.js.
   */
  function ctaStateFor({ unchecked = 0, isScanning = false, completed = 0, total = 0 } = {}) {
    if (isScanning) {
      const progress = total > 0 ? ` (${completed}/${total})` : '';
      return { mode: 'scanning', mainLabel: `⏳ Prüfe${progress}`, subLabel: 'Klicken = Abbrechen' };
    }
    if (unchecked > 0) {
      const obj = unchecked === 1 ? 'Tiefstpreis' : 'Tiefstpreise';
      return { mode: 'idle', mainLabel: `🔍 ${unchecked} ${obj} prüfen`, subLabel: 'Echte Tiefstpreise verifizieren' };
    }
    return { mode: 'done', mainLabel: '🔍 0 Tiefstpreise prüfen', subLabel: 'Alle Deals verifiziert' };
  }


  function hideFloatingCTA() {
    if (typeof document === 'undefined') return;
    // Stylesheet pins display:flex !important (host-site override convention),
    // so hiding must go through the .tp-hidden class, not an inline style.
    // The scanning marker is cleared too: hidden implies nothing to show, and
    // syncFloatingCTA re-applies it whenever a scan is actually running.
    const el = document.getElementById(FLOATING_CTA_ID);
    if (!el) return;
    el.classList.add('tp-hidden');
    el.classList.remove('tp-scanning');
  }

  /**
   * Entry point for starting (or cancelling) a batch check from any UI surface:
   * the CTA main button, the empty-state notice, or tests. Clicking the dimmed
   * empty CTA toasts instead of scanning (unchecked <= 0 guard below).
   */
  function startBatchCheck() {
    const { isBatchChecking } = scanState;
    if (isBatchChecking) {
      cancelBatchDealCheck();
      showToast('Batch-Prüfung abgebrochen');
      syncFloatingCTA();
      return;
    }
    const unchecked = lastCounts.uncheckedDeals || 0;
    if (unchecked <= 0) {
      showToast('Keine ungeprüften Deals vorhanden');
      return;
    }
    const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
    // Progress + cancel live in the expanded form — a check always expands.
    setCollapsed(false);
    runBatchDealCheck(
      minDisc,
      () => syncFloatingCTA(),
      (completed, total) => {
        if (total > 0) showToast(`${completed} Tiefstpreise verifiziert`);
        else showToast('Keine ungeprüften Deals vorhanden');
        // Recompute counts → CTA flips to its dimmed empty form when nothing is left.
        triggerProcessListings();
      }
    );
    syncFloatingCTA();
  }

  function setCollapsed(collapsed) {
    collapsedForSession = !!collapsed;
    if (typeof document === 'undefined') return;
    if (collapsedForSession) {
      document.getElementById(FLOATING_CTA_ID)
        ?.querySelector('#tp-floating-threshold-popover')?.classList.remove('tp-show');
    }
    syncFloatingCTA();
  }

  function onMainClick() {
    // The collapsed pill is an expand affordance, never a check trigger:
    // the primary action must stay deliberate, not accidental.
    if (collapsedForSession) {
      setCollapsed(false);
      return;
    }
    startBatchCheck();
  }

  function onCollapseToggle() {
    setCollapsed(!collapsedForSession);
  }

  function ensureCta() {
    let el = document.getElementById(FLOATING_CTA_ID);
    if (el) {
      el.classList.remove('tp-hidden');
      return el;
    }
    el = document.createElement('div');
    el.id = FLOATING_CTA_ID;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Tiefstpreise prüfen');
    el.innerHTML = `
      <button type="button" id="tp-floating-check-btn" title="Echte Allzeit-Tiefstpreise prüfen (Toppreise-Rabatt ist ungeprüft)">
        <span id="tp-floating-check-main">🔍 Tiefstpreise prüfen</span>
        <span id="tp-floating-check-sub">Echte Tiefstpreise verifizieren</span>
        <span id="tp-floating-check-count">🔍</span>
      </button>
      <button type="button" id="tp-floating-threshold-btn" title="Nur Differenzen ab diesem Wert prüfen">≥30% ▾</button>
      <div id="tp-floating-threshold-popover" role="menu">
        <div class="tp-floating-hint">Nur Differenz ≥ … wird geprüft</div>
      </div>
      <button type="button" id="tp-floating-cta-collapse" title="Minimieren">«</button>
    `;
    const popover = el.querySelector('#tp-floating-threshold-popover');
    for (const val of THRESHOLD_OPTIONS) {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'tp-floating-option';
      opt.dataset.val = String(val);
      opt.setAttribute('role', 'menuitem');
      opt.textContent = `≥ ${val}%`;
      opt.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        popover.classList.remove('tp-show');
        updateConfig('REAL_DEAL_MIN_DISCOUNT', val);
        showToast(`Nur Differenzen ab ${val}% werden geprüft`);
        syncFloatingCTA();
      };
      popover.appendChild(opt);
    }

    el.querySelector('#tp-floating-check-btn').onclick = onMainClick;
    el.querySelector('#tp-floating-cta-collapse').onclick = onCollapseToggle;

    const threshBtn = el.querySelector('#tp-floating-threshold-btn');
    threshBtn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      popover.classList.toggle('tp-show');
    };
    const filterRow = document.createElement('label');
    filterRow.className = 'tp-floating-filter-row';
    filterRow.title = 'Nur geprüfte anzeigen (ungeprüfte ausblenden)';
    filterRow.innerHTML = '<input type="checkbox" id="tp-floating-hide-unchecked-toggle"><span>Nur geprüfte</span>';
    popover.appendChild(filterRow);
    filterRow.querySelector('input').onchange = e => {
      const next = e.target.checked;
      updateConfig('BESTPREISE_HIDE_UNCHECKED', next);
      showToast(next ? '👁️ Nur geprüfte Deals werden angezeigt' : '👁️ Ungeprüfte Deals werden wieder angezeigt');
    };

    if (!window._tpFloatingCtaDocBound) {
      window._tpFloatingCtaDocBound = true;
      document.addEventListener('click', e => {
        if (!e.isTrusted) return; // Synthetic clicks (price-alarm auto-submit) must not dismiss the popover.
        const cta = document.getElementById(FLOATING_CTA_ID);
        if (cta && !cta.contains(e.target)) {
          cta.querySelector('#tp-floating-threshold-popover')?.classList.remove('tp-show');
        }
      });
    }

    document.body.appendChild(el);
    return el;
  }

  function syncFloatingCTA() {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(FLOATING_CTA_ID);
    if (!el) return;
    const state = scanState;
    const unchecked = lastCounts.uncheckedDeals || 0;
    const { mainLabel, subLabel, mode } = ctaStateFor({
      unchecked,
      isScanning: state.isBatchChecking,
      completed: state.progress?.completed || 0,
      total: state.progress?.total || 0
    });

    setTextIfChanged(el.querySelector('#tp-floating-check-main'), mainLabel);
    const subEl = el.querySelector('#tp-floating-check-sub');
    setTextIfChanged(subEl, subLabel);
    subEl.style.display = subLabel ? 'block' : 'none';
    el.classList.toggle('tp-scanning', mode === 'scanning');
    // Empty (0 deals) stays visible but dimmed via .tp-empty (grey instead of
    // green) — the CTA must never disappear, only de-emphasize.
    el.classList.toggle('tp-empty', mode === 'done');
    // Collapsed form: compact count instead of labels, flipped chevron.
    // The count keeps working as a progress signal mid-scan.
    el.classList.toggle('tp-collapsed', collapsedForSession);
    const completed = state.progress?.completed || 0;
    const total = state.progress?.total || 0;
    setTextIfChanged(
      el.querySelector('#tp-floating-check-count'),
      mode === 'scanning' ? (total > 0 ? `⏳${completed}/${total}` : '⏳') : `🔍 ${unchecked}`
    );
    const collapseBtn = el.querySelector('#tp-floating-cta-collapse');
    setTextIfChanged(collapseBtn, collapsedForSession ? '»' : '«');
    collapseBtn.title = collapsedForSession ? 'Erweitern' : 'Minimieren';

    const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
    const threshBtn = el.querySelector('#tp-floating-threshold-btn');
    // Threshold is a deal-feed concept (mirrors the old toolbar behavior):
    // on catalog pages only the check action itself is offered.
    if (lastIsDealFeed) {
      threshBtn.style.display = '';
    } else {
      threshBtn.style.display = 'none';
      el.querySelector('#tp-floating-threshold-popover')?.classList.remove('tp-show');
    }
    setTextIfChanged(threshBtn, `≥${minDisc}% ▾`);
    threshBtn.title = lastIsDealFeed
      ? `Nur Differenzen ≥ ${minDisc}% werden geprüft (ungeprüft ≠ Tiefstpreis)`
      : `Nur Produkte mit Differenz ≥ ${minDisc}% werden geprüft`;
    el.querySelectorAll('.tp-floating-option').forEach(opt => {
      opt.classList.toggle('tp-selected', parseInt(opt.dataset.val, 10) === minDisc);
    });
    const hideToggleSync = el.querySelector('#tp-floating-hide-unchecked-toggle');
    if (hideToggleSync && document.activeElement !== hideToggleSync) {
      hideToggleSync.checked = CONFIG.BESTPREISE_HIDE_UNCHECKED === true;
    }
    const filterRowSync = el.querySelector('.tp-floating-filter-row');
    if (filterRowSync) {
      filterRowSync.classList.toggle('tp-active', CONFIG.BESTPREISE_HIDE_UNCHECKED === true);
      filterRowSync.title = CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? 'Nur geprüfte aktiv — klicken zum Anzeigen aller' : 'Nur geprüfte anzeigen (ungeprüfte ausblenden)';
    }
  }

  /**
   * Create-once, then sync. The pill always stays visible on listing pages —
   * with 0 deals left it renders dimmed (see .tp-empty), never hidden.
   * hideFloatingCTA is reserved for non-list contexts (product detail,
   * zero cards). Collapse state is sticky within the session.
   */
  function renderFloatingCTA(counts = {}, isDealFeed = false) {
    if (typeof document === 'undefined') return;
    lastCounts = counts || { uncheckedDeals: 0 };
    lastIsDealFeed = !!isDealFeed;
    ensureCta();
    syncFloatingCTA();
  }
  // ─── MODULE: src/features/share-discord.js ────────────────────────────────
  /**
   * Discord Deal-Sharing
   * 1-Klick-Share verifizierter Tiefstpreise in einen Discord-Channel via
   * user-eigenem Webhook (GM-privat gespeichert, nie im Repo/Export/localStorage).
   */





  const isDiscordWebhookUrl = url =>
    typeof url === 'string' &&
    /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/.+/.test(url.trim());

  // Geprüfte Preishistorie als Text-Sparkline (SVG geht nicht nach Discord).
  const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  function sparklineText(timeSeries, width = 20) {
    if (!Array.isArray(timeSeries)) return '';
    const all = timeSeries.map(p => (Array.isArray(p) ? +p[1] : 0)).filter(p => p > 0);
    if (all.length < 2) return '';
    // Gleichmäßig über die gesamte Historie, nicht nur das letzte Fenster
    // (ein lange stabiler Tiefpreis sähe sonst fälschlich flach aus).
    const prices = all.length <= width ? all : Array.from({ length: width }, (_, i) => all[Math.floor((i * all.length) / width)]);
    const min = Math.min(...prices);
    const range = Math.max(...prices) - min || 1;
    return prices.map(p => SPARK_CHARS[Math.min(7, Math.floor(((p - min) / range) * 8))]).join('');
  }
  // Preischart als PNG für Discord: vorhandenes SVG groß rendern, rastern, als
  // Webhook-Attachment hochladen. Reine Browser-APIs — ohne DOM kein Bild (null).
  function renderSparklinePng(timeSeries, width = 360, height = 100) {
    return new Promise(resolve => {
      try {
        if (typeof document === 'undefined') return resolve(null);
        const svg = renderSparkline(timeSeries, width, height);
        if (!svg) return resolve(null);
        const NS = 'http://www.w3.org/2000/svg';
        const bg = document.createElementNS(NS, 'rect');
        bg.setAttribute('width', String(width));
        bg.setAttribute('height', String(height));
        bg.setAttribute('rx', '8');
        bg.setAttribute('fill', '#1e293b');
        svg.insertBefore(bg, svg.firstChild);
        svg.querySelector('polyline')?.setAttribute('stroke-width', '2.5');
        const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            canvas.getContext('2d').drawImage(img, 0, 0, width * 2, height * 2);
            URL.revokeObjectURL(svgUrl);
            canvas.toBlob(b => resolve(b), 'image/png');
          } catch { resolve(null); }
        };
        img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(null); };
        img.src = svgUrl;
      } catch { resolve(null); }
    });
  }

  // PNG als Attachment (multipart mit payload_json). Scheitert der Upload,
  // postet der Caller ohne Bild nach (Text-Sparkline trägt den Trend).
  function postDealImageToDiscord(webhookUrl, content, pngBlob) {
    return new Promise((resolve, reject) => {
      try {
        if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
        if (!(pngBlob instanceof Blob)) return reject(new Error('Ungültige Bilddaten'));
        if (typeof GM_xmlhttpRequest === 'undefined' || typeof FormData === 'undefined') return reject(new Error('Kein Multipart-Transport'));
        const form = new FormData();
        form.append('payload_json', JSON.stringify({ content }));
        form.append('file', pngBlob, 'preisverlauf.png');
        GM_xmlhttpRequest({
          method: 'POST',
          url: webhookUrl.trim(),
          data: form,
          timeout: 20000,
          onload: res => (res.status >= 200 && res.status < 300 ? resolve() : reject(new Error(`Discord ${res.status}`))),
          onerror: () => reject(new Error('Netzwerkfehler')),
          ontimeout: () => reject(new Error('Timeout'))
        });
      } catch { reject(new Error('Upload fehlgeschlagen')); }
    });
  }

  // Ein Wert pro Zeile (scannbar, Zahlen fett): Link zuerst (unantastbar), dann
  // Titel, Preis, Händler, Verlauf. Rabatte stehen je Referenzzeile (Bisher /
  // Ø-Preis), nicht gebündelt in der Preiszeile.
  const boldNumbers = s => (s || '').replace(/(CHF [\d.'’]+|-?\d+(?:[.,]\d+)?\s*%)/g, '**$1**');
  const withPct = (text, pct) => pct > 0 ? `${text} -${pct}%` : text;
  function formatDealMessage({ title, url, priceText, dealer, offerCount, spark, prevLowText, prevLowPct, medianText, medianPct }) {
    const link = (url || '').trim();
    let cleanTitle = (title || 'Toppreise-Deal').replace(/\s+/g, ' ').trim();
    const rest = [
      priceText ? `💰 ${boldNumbers(priceText)}` : '',
      dealer ? `🏬 Händler: **${dealer}**` : '',
      offerCount ? `🛒 Angebote: **${offerCount}**` : '',
      spark ? `📊 ${spark}` : '',
      prevLowText ? `📉 ${boldNumbers(withPct(prevLowText, prevLowPct))}` : '',
      medianText ? `📈 ${boldNumbers(withPct(medianText, medianPct))}` : ''
    ].filter(Boolean).join('\n');
    const maxTitle = Math.max(20, 2000 - link.length - rest.length - 32);
    cleanTitle = cleanTitle.slice(0, maxTitle);
    return [link, `🔥 **${cleanTitle}**`, rest].filter(Boolean).join('\n').slice(0, 2000);
  }

  // Reine Abbildung Kartenpreis + Stats → Discord-Referenzzeilen (Bisher / Ø-Preis
  // je mit eigenem Rabatt-%). Einzeln testbar, damit vertauschte % auffallen;
  // der Click-Handler in ui/badges.js nutzt nur diese eine Quelle.
  function resolveShareFields(cardPrice, stats) {
    const prevLow = recordRefForPrice(stats, cardPrice).previousLow;
    const medianVal = stats?.medianPrice;
    const prevLowShown = prevLow && priceToCents(prevLow) > priceToCents(cardPrice);
    const medianShown = medianVal && priceToCents(medianVal) > priceToCents(cardPrice);
    return {
      prevLowText: prevLowShown ? `Bisher: CHF ${prevLow.toFixed(2)}` : '',
      prevLowPct: prevLowShown ? (getDisplayDelta(cardPrice, stats).dRecord || 0) : 0,
      medianText: medianShown ? `Ø-Preis (${medianHorizonLabel(stats)}): CHF ${medianVal.toFixed(2)}` : '',
      medianPct: medianShown ? (getLevelPct(cardPrice, stats) || 0) : 0
    };
  }

  // Titel + Produktlink aus der Karte ziehen (alles tolerant, Layout-wechsel-sicher).
  function extractShareData(card) {
    if (!card?.querySelector) return { title: '', url: '' };
    const titleEl = card.querySelector('.product-name, .productDetails, .bold, a[title]');
    const title = titleEl?.textContent?.trim() || titleEl?.getAttribute?.('title') || '';
    const linkEl = card.querySelector('a[href*="/preisvergleich/"]')
      || (card.tagName?.toLowerCase() === 'a' ? card : null);
    let url = linkEl?.getAttribute?.('href') || linkEl?.href || '';
    if (url && !/^https?:\/\//i.test(url)) {
      try { url = new URL(url, location.href).href; } catch { /* relativ lassen */ }
    }
    return { title, url };
  }

  // Angezeigten Händler (günstigste Zeile zuerst) als Klartext.
  function extractDealer(card) {
    const el = card?.querySelector?.(`${SELECTORS.cards.dealerRows} .title`);
    return el?.textContent?.replace(/\s+/g, ' ').trim() || '';
  }

  // Schema.org-JSON-LD aus statischem HTML lesen: Händlerzeilen sind AJAX-gerendert
  // und fehlen im Fetch-HTML, `offers` steht dagegen schon in der Rohseite.
  function parseJsonLdOffer(json) {
    const roots = Array.isArray(json) ? json : [json];
    for (const root of roots) {
      const items = Array.isArray(root?.['@graph']) ? root['@graph'] : [root];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (!types.includes('Product')) continue;
        const list = Array.isArray(item.offers) ? item.offers : (item.offers ? [item.offers] : null);
        if (!list) continue;
        if (list.length === 1 && list[0]?.['@type'] === 'AggregateOffer' && !Array.isArray(list[0].offers)) {
          const n = +list[0].offerCount; // kein Verkäufer, aber echte Angebotszahl
          return { dealer: '', offers: Number.isFinite(n) ? Math.round(n) : 0 };
        }
        let best = null;
        for (const o of list) {
          const price = +o?.price;
          if (!Number.isFinite(price)) continue; // fehlendes price: Angebot überspringen
          if (!best || price < best.price) best = { price, dealer: typeof o.seller === 'object' ? (o.seller?.name || '') : (o.seller || '') };
        }
        if (best) return { dealer: best.dealer, offers: list.length };
      }
    }
    return { dealer: '', offers: 0 };
  }

  // Feed-Karten tragen keine Händlerzeilen: Produktseite nachladen (nur bei Klick,
  // same-origin, kein CORS-Problem). Erste Zeile = günstigstes Angebot, sonst JSON-LD.
  async function fetchProductInfo(productUrl, timeoutMs = 10000) {
    const out = { dealer: '', offers: 0 };
    try {
      if (typeof fetch === 'undefined' || typeof DOMParser === 'undefined') return out;
      if (!/^https?:\/\//i.test(productUrl || '')) return out;
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
      const res = await fetch(productUrl, { signal: ctrl?.signal });
      clearTimeout(timer);
      if (!res.ok) return out;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const titles = Array.from(doc.querySelectorAll(`${SELECTORS.cards.dealerRows} .title`));
      // ponytail: first row is the cheapest offer on Toppreise listings
      out.dealer = titles[0]?.textContent?.replace(/\s+/g, ' ').trim() || '';
      out.offers = titles.length;
      if (out.dealer || out.offers) return out;
      const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of scripts) {
        try {
          const found = parseJsonLdOffer(JSON.parse(s.textContent));
          if (found.dealer || found.offers) return found;
        } catch { /* Block einzeln ignorieren */ }
      }
      console.debug('[Toppreise-Suite] Händler-Fallback leer', { htmlBytes: html.length, rowCount: titles.length, jsonLdBlocks: scripts.length });
    } catch { /* Händler unbekannt: Zeile entfällt */ }
    return out;
  }

  // GM_xmlhttpRequest umgeht CORS (Violentmonkey), fetch ist Fallback.
  function postDealToDiscord(webhookUrl, content) {
    return new Promise((resolve, reject) => {
      if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
      const url = webhookUrl.trim();
      const payload = JSON.stringify({ content });
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'POST',
          url,
          headers: { 'Content-Type': 'application/json' },
          data: payload,
          timeout: 15000,
          onload: res => (res.status >= 200 && res.status < 300 ? resolve() : reject(new Error(`Discord ${res.status}`))),
          onerror: () => reject(new Error('Netzwerkfehler')),
          ontimeout: () => reject(new Error('Timeout'))
        });
      } else if (typeof fetch !== 'undefined') {
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
          .then(res => (res.ok ? resolve() : reject(new Error(`Discord ${res.status}`))))
          .catch(() => reject(new Error('Netzwerkfehler')));
      } else {
        reject(new Error('Kein HTTP-Transport verfügbar'));
      }
    });
  }


  // ─── MODULE: src/features/price-alarm.js ────────────────────────────────────
  /**
   * Price Alarm Automation Feature
   * Automates the Toppreise price alarm popup dialog:
   * calculates discount target, configures alert duration, accepts terms,
   * and submits automatically when configured.
   */



  function processPriceAlarmModal() {
    if (!CONFIG.ALARM_ENABLED) return;
    const modalContainer = document.querySelector('.Plugin_NewInfoMailForm');
    if (!modalContainer || modalContainer.dataset.tpAlarmProcessed === 'true') return;
    modalContainer.dataset.tpAlarmProcessed = 'true';

    const priceEl = modalContainer.querySelector('.shippingPrice .Plugin_Price') ||
                    modalContainer.querySelector('.productPrice .Plugin_Price') ||
                    document.querySelector('.pageContent .priceContainer .Plugin_Price');
    if (!priceEl) return;

    const presentValue = parsePrice(priceEl.textContent);
    if (presentValue <= 0) return;

    const targetPrice = (presentValue * CONFIG.ALARM_TARGET_PERCENT).toFixed(2);
    const priceInput = modalContainer.querySelector('input#f_NewInfoMailForm_priceFrom') || modalContainer.querySelector('input[name="im_nimf_pvf"]');
    if (priceInput) {
      priceInput.value = targetPrice;
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const durationHidden = modalContainer.querySelector('input[name="im_nimf_du"]');
    if (durationHidden) {
      durationHidden.value = CONFIG.ALARM_DURATION_DAYS;
      durationHidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
    modalContainer.querySelector(`li[data-value="${CONFIG.ALARM_DURATION_DAYS}"]`)?.click();

    const termsCheckbox = modalContainer.querySelector('input#im_nimf_prtrm');
    if (termsCheckbox) {
      termsCheckbox.checked = true;
      termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (CONFIG.ALARM_AUTO_SUBMIT) {
      setTimeout(() => {
        const submitBtn = modalContainer.querySelector('input.f_submitbtn');
        if (submitBtn) {
          submitBtn.click();
          // Allow in-flight AJAX request to complete before closing the dialog container
          setTimeout(() => {
            const closeBtn = modalContainer.closest('.AbstractDialog')?.querySelector('.AbstractDialog_CloseButton') ||
                             document.querySelector('#tmpAbstractDialogContainer .AbstractDialog_CloseButton');
            if (closeBtn) closeBtn.click();
          }, 800);
        }
      }, 300);
    }
  }

  // ─── MODULE: src/features/product-detail.js ─────────────────────────────────
  /**
   * Product Detail Page Feature
   * Injects Tiefstpreis status badge and peak context
   * into the main product detail heading.
   */





  async function processProductDetailPage() {
    const pid = getDetailProductId();
    if (!pid) return;

    // Ordered single queries (see getDetailLowestPrice): grouped selectors match
    // in document order, so the bare h1 fallback must never outrank its scopes.
    const headingSelectors = ['.Plugin_ProductHeading h1', '.productHeading h1', '.product_title h1', 'h1.productTitle', 'h1'];
    let headingEl = null;
    for (const sel of headingSelectors) {
      headingEl = document.querySelector(sel);
      if (headingEl) break;
    }
    if (!headingEl) return;

    const currentPrice = getDetailLowestPrice();
    if (currentPrice <= 0) return;

    let badge = document.getElementById('tp-detail-deal-badge');
    const stats = getCachedPriceStats(pid);

    if (stats && stats.tiefstpreis > 0) {
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'tp-detail-deal-badge';
        headingEl.appendChild(badge);
      }

      const displayKind = getDisplayDelta(currentPrice, stats).kind;
      const isAllTimeLow = (displayKind === 'new-low' || displayKind === 'at-low');
      const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;

      if (isAllTimeLow) {
        badge.className = 'tp-detail-deal-badge tp-is-alltime-low';
        let peakContext = '';
        if (hasSignificantPeak) {
          const peakDropPct = Math.round(((stats.hoechstpreis - currentPrice) / stats.hoechstpreis) * 100);
          peakContext = ` (-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)})`;
        }
        badge.title = `Aktueller Bestpreis (CHF ${currentPrice.toFixed(2)}) ist der historische Allzeit-Tiefstpreis!${peakContext}`;
        badge.textContent = '🌟 Allzeit-Tiefstpreis';
      } else {
        const markupPct = Math.round(((currentPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100);
        const isSevere = markupPct >= 50;
        badge.className = `tp-detail-deal-badge tp-is-not-low ${isSevere ? 'tp-is-severe-markup' : ''}`;
        const peakContext = hasSignificantPeak ? ` | Höchstpreis: CHF ${stats.hoechstpreis.toFixed(2)}` : '';
        badge.title = `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)${peakContext}`;
        badge.textContent = `⚠️ Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}%)`;
      }
    } else if (!activeFetches.has(pid)) {
      await fetchSingleProductPriceStats(pid);
      const fetchedStats = getCachedPriceStats(pid);
      if (fetchedStats && !fetchedStats.unavailable && fetchedStats.tiefstpreis > 0) {
        processProductDetailPage();
      }
    }
  }

  // ─── APPLICATION & LIFECYCLE LOGIC ──────────────────────────────────────────
const log = (...args) => { if (CONFIG.DEBUG) console.log('[Toppreise-Suite]', ...args); };

  if (!document.getElementById('tp-unified-settings-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'tp-unified-settings-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  updateBodyClasses();

  let isModifyingDOM = false;
  let mainObserver = null;

  function processListings() {
    if (isModifyingDOM) return;
    if (isProductDetailPage()) {
      const staleBar = document.getElementById('tp-suite-filter-bar');
      if (staleBar) staleBar.remove();
      hideFloatingCTA();
      return;
    }
    isModifyingDOM = true;
    if (mainObserver) mainObserver.disconnect();
    try {
      const cards = getProductCards();
      if (cards.length === 0) {
        const staleBar = document.getElementById('tp-suite-filter-bar');
        if (staleBar) staleBar.remove();
        hideFloatingCTA();
        return;
      }

      // --- Extract ---
      const activeStores = extractActiveStores();
      const termsList = parseNegativeTerms();
      const isNeueFeed = isNeueToppreisePage();
      const minDealDiscount = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
      const cardDataList = cards.map(extractCardData);

      // --- Filter ---
      const counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, bestpreiseHidden: 0, badDeals: 0, uncheckedHidden: 0 };
      const pageHasOffers = cardDataList.some(cd => cd.offerCount > 0);

      for (const cd of cardDataList) {
        cd.filters = applyCardFilters(cd, termsList, CONFIG.MIN_OFFERS, pageHasOffers);
        const isStandardFiltered = cd.filters.isNeg || cd.filters.isLowOffers;
        if (cd.filters.isNeg) counts.neg++;
        if (cd.filters.isLowOffers) counts.min++;
        if (isNeueFeed) {
          if (cd.pid && !cd.stats && cd.discountVal !== null && cd.discountVal >= minDealDiscount && !isCardFilteredOut(cd.card, cd.filters)) {
            counts.uncheckedDeals++;
          }
        } else {
          if (cd.pid && !cd.stats && !isCardFilteredOut(cd.card, cd.filters)) {
            counts.uncheckedDeals++;
          }
        }
        // nonBest is retired with the removed strictness toggles: outside the
        // mode nothing hides as non-best (truthful Aufschlag badge instead),
        // inside the mode it counts as bestpreiseHidden below. Never double-count.
        cd.dealScore = cd.dealScore ?? computeDealScore(cd.stats, cd.cardPrice);
        if (cd.dealScore) {
          counts.bestpreiseDeals++;
        } else if (CONFIG.BESTPREISE_MODE_ACTIVE === true && cd.stats && !isStandardFiltered) {
          counts.bestpreiseHidden++;
          counts.badDeals++;
        } else if (CONFIG.BESTPREISE_HIDE_UNCHECKED === true && !cd.stats && !isStandardFiltered) {
          // "Nur Geprüfte" hides never-checked cards via tp-unchecked-hidden —
          // count them so empty-state + reveal counts stay truthful.
          counts.bestpreiseHidden++;
          counts.uncheckedHidden++;
        }
      }

      // --- Render ---
      for (const cd of cardDataList) {
        renderCardEffects(cd, cd.filters, isNeueFeed, activeStores);
      }

      // --- Sort ---
      applySorting(cards, pageHasOffers, cardDataList);

      // --- Empty state, filter bar & floating verify CTA ---
      renderEmptyState(cards, counts);
      renderSuiteFilterBar(counts, pageHasOffers, isNeueFeed);
      renderFloatingCTA(counts, isNeueFeed);
    } finally {
      isModifyingDOM = false;
      if (mainObserver) {
        mainObserver.takeRecords();
        mainObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
    }
  }

  // ─── OBSERVER & INITIALIZATION ───────────────────────────────────────────────
  let debounceTimer = null;
  mainObserver = new MutationObserver(mutations => {
    if (isModifyingDOM) return;

    const hasRelevantMutation = mutations.some(m => {
      const target = m.target;
      if (!target) return false;

      // Ignore mutations inside our own root UI, filter bar, or floating CTA
      if (target.id === 'tp-root' || target.closest?.('#tp-root')) return false;
      if (target.id === 'tp-suite-filter-bar' || target.closest?.('#tp-suite-filter-bar')) return false;
      if (target.id === 'tp-floating-check-cta' || target.closest?.('#tp-floating-check-cta')) return false;

      // Ignore mutations inside document.head (DarkReader dynamic styles, font loading, etc.)
      if (target === document.head || target.closest?.('head')) return false;

      // If the mutation target is inside an existing card, ignore it (image lazyloads, badges, tooltips)
      if (target.closest?.('.Plugin_Product, .mixedBrowsingListProduct')) return false;

      const checkNode = node => {
        if (!node || node.nodeType !== 1) return false;
        if (node.id === 'tp-root' || node.id === 'tp-suite-filter-bar' || node.id === 'tp-empty-state-notice' || node.id === 'tp-floating-check-cta') return false;
        if (node.classList?.contains('tp-card-subline-row') ||
            node.classList?.contains('tp-sparkline-container') ||
            node.classList?.contains('tp-best-price-badge') ||
            node.classList?.contains('tp-empty-state-notice')) {
          return false;
        }
        return node.matches?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading') ||
               !!node.querySelector?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading');
      };

      for (let i = 0; i < m.addedNodes.length; i++) {
        if (checkNode(m.addedNodes[i])) return true;
      }
      for (let i = 0; i < m.removedNodes.length; i++) {
        if (checkNode(m.removedNodes[i])) return true;
      }
      return false;
    });

    if (!hasRelevantMutation) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processListings();
      processPriceAlarmModal();
      if (isProductDetailPage()) {
        processProductDetailPage();
      }
    }, CONFIG.OBSERVER_DEBOUNCE_MS);
  });

  mainObserver.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('keydown', e => {
    // Skip if modifier keys other than none
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Skip if user is typing in an input/textarea/select or contenteditable
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;
    // Skip if inside shadow root (settings modal)
    if (document.activeElement?.shadowRoot || uiShadowRoot?.activeElement) return;

    if (e.key === '/') {
      const input = document.getElementById('tp-inline-negative-input');
      if (input) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    } else if (e.key === 'Escape') {
      const input = document.getElementById('tp-inline-negative-input');
      if (input && document.activeElement === input) {
        input.blur();
      }
    }
  });

  if (self.navigation?.addEventListener) {
    self.navigation.addEventListener('navigatesuccess', () => {
      processListings();
      processPriceAlarmModal();
      if (isProductDetailPage()) {
        processProductDetailPage();
      }
    });
  }

  setupUI();
  processListings();
  processPriceAlarmModal();
  if (isProductDetailPage()) {
    processProductDetailPage();
  }

  if (typeof window !== 'undefined') {
    window.ToppreiseSuite = {
      processListings,
      processProductDetailPage,
      updateConfig,
      saveConfigKey,
      startBatchCheck,
      runBatchDealCheck,
      cancelBatchDealCheck,
      getCardDealerRows,
      isCardFilteredOut,
      clearCardCache,
      computeDealScore,
      analyzePriceTimeSeries,
      parsePrice,
      isShippingPriceActive,
      CONFIG,
      memoryCache
    };
  }
})();
