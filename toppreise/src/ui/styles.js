/**
 * CSS Stylesheets for Toppreise.ch Suite
 * Contains main document styles (heatmap, badges, pills, filter bar, toasts)
 * and isolated Shadow DOM modal dialog styles.
 */

export const STYLES = `
  /* ─── HEATMAP CARD STYLES & DARKREADER DYNAMIC COMPATIBILITY ─── */
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
    background-color: transparent !important;
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
  .tp-heatmap-active .image_container[data-darkreader-inline-bgcolor] {
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
  .tp-negative-filtered, .tp-category-filtered, .tp-min-offers-filtered, .tp-non-bestpreis-filtered, .tp-bestpreise-hidden,
  [class*="col-"]:has(> .tp-negative-filtered),
  [class*="col-"]:has(> .tp-category-filtered),
  [class*="col-"]:has(> .tp-min-offers-filtered),
  [class*="col-"]:has(> .tp-non-bestpreis-filtered),
  [class*="col-"]:has(> .tp-bestpreise-hidden) {
    display: none !important;
  }
  body.tp-reveal-filtered .tp-negative-filtered,
  body.tp-reveal-filtered .tp-category-filtered,
  body.tp-reveal-filtered .tp-min-offers-filtered,
  body.tp-reveal-filtered .tp-non-bestpreis-filtered,
  body.tp-reveal-filtered .tp-bestpreise-hidden,
  body.tp-reveal-filtered [class*="col-"]:has(> .tp-negative-filtered),
  body.tp-reveal-filtered [class*="col-"]:has(> .tp-category-filtered),
  body.tp-reveal-filtered [class*="col-"]:has(> .tp-min-offers-filtered),
  body.tp-reveal-filtered [class*="col-"]:has(> .tp-non-bestpreis-filtered),
  body.tp-reveal-filtered [class*="col-"]:has(> .tp-bestpreise-hidden) {
    display: block !important;
    opacity: var(--tp-dim-opacity, 0.25) !important;
    filter: grayscale(40%) !important;
    outline: 2px dashed #f59e0b !important;
    outline-offset: -2px !important;
  }
  /* ─── REAL DEAL & ALLZEIT-TIEFSTPREIS STYLES ─── */
  .tp-real-deal-wrapper {
    margin-top: 4px !important;
    display: inline-flex !important;
    flex-direction: column !important;
    align-items: flex-end !important;
    gap: 3px !important;
    z-index: 25 !important;
    pointer-events: auto !important;
  }
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
    min-width: 62px !important;
    height: 22px !important;
    border-radius: 11px !important;
    padding: 2px 8px !important;
    margin-bottom: 4px !important;
    margin-left: auto !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
    cursor: pointer !important;
    text-align: center !important;
    gap: 4px !important;
    background: rgba(30, 41, 59, 0.9) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    color: #f1f5f9 !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25) !important;
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
  .badge.badge-dif.tp-deal-pill.tp-deal-alltime-low {
    background: rgba(6, 78, 59, 0.92) !important;
    border: 1.5px solid #10b981 !important;
    color: #6ee7b7 !important;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.4) !important;
  }
  .badge.badge-dif.tp-deal-pill.tp-deal-not-low {
    background: rgba(120, 53, 15, 0.92) !important;
    border: 1.5px solid #f59e0b !important;
    color: #fde68a !important;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.35) !important;
  }
  .badge.badge-dif.tp-deal-pill.tp-is-severe-markup {
    background: rgba(136, 19, 55, 0.92) !important;
    border: 1.5px solid #f43f5e !important;
    color: #fecdd3 !important;
    box-shadow: 0 0 8px rgba(244, 63, 94, 0.35) !important;
  }
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
  .badge.badge-dif.tp-deal-loading,
  .badge-dif.tp-deal-loading {
    cursor: wait !important;
    opacity: 0.85 !important;
  }
  /* 3A: Verified New Record Low: Radiant Solid Golden Diamond Halo */
  .badge.badge-dif.tp-deal-new-record,
  .badge-dif.tp-deal-new-record {
    background: linear-gradient(135deg, #78350f 0%, #b45309 50%, #f59e0b 100%) !important;
    border: 1.5px solid #fbbf24 !important;
    box-shadow: 0 0 0 2px #f59e0b, 0 0 14px rgba(245, 158, 11, 0.6) !important;
    color: #ffffff !important;
  }
  /* 3B: Verified All-Time Low: Emerald Halo */
  .badge.badge-dif.tp-deal-alltime-low,
  .badge-dif.tp-deal-alltime-low {
    background: linear-gradient(135deg, #064e3b 0%, #047857 100%) !important;
    border: 1.5px solid #10b981 !important;
    box-shadow: 0 0 0 2px #10b981, 0 0 12px rgba(16, 185, 129, 0.5) !important;
    color: #ffffff !important;
  }
  /* 2A: Verified Non-Tiefstpreis: Amber Alert Morph with Shrunken Strikethrough */
  .badge.badge-dif.tp-deal-not-low,
  .badge-dif.tp-deal-not-low {
    background: linear-gradient(135deg, #78350f 0%, #b45309 100%) !important;
    border: 1.5px solid #f59e0b !important;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.45) !important;
    color: #ffffff !important;
  }
  .badge.badge-dif.tp-deal-not-low.tp-is-severe-markup,
  .badge-dif.tp-deal-not-low.tp-is-severe-markup {
    background: linear-gradient(135deg, #881337 0%, #be123c 100%) !important;
    border-color: #f43f5e !important;
    box-shadow: 0 0 14px rgba(244, 63, 94, 0.55) !important;
  }
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
  .tp-badge-score-breakdown {
    position: absolute !important;
    top: 64px !important;
    right: 10px !important;
    font: 600 9px/1.1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    background: rgba(15, 23, 42, 0.92) !important;
    backdrop-filter: blur(6px) !important;
    color: #cbd5e1 !important;
    border: 1px solid rgba(255, 255, 255, 0.18) !important;
    border-radius: 4px !important;
    padding: 2px 4px !important;
    white-space: nowrap !important;
    pointer-events: none !important;
    z-index: 20 !important;
    text-align: center !important;
    box-shadow: 0 2px 6px rgba(0,0,0,0.35) !important;
  }
  .tp-badge-score-breakdown .tp-score-record {
    color: #fbbf24 !important;
  }
  .tp-badge-score-breakdown .tp-score-median {
    color: #34d399 !important;
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
    font-weight: 600 !important;
  }
  .tp-card-historical-price.tp-is-at-low {
    color: #10b981 !important;
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
  .tp-bar-btn.tp-disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
  }
  .tp-threshold-wrapper {
    position: relative !important;
    display: inline-flex !important;
    align-items: center !important;
  }
  .tp-threshold-btn {
    background: rgba(15, 23, 42, 0.6) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    border-left: none !important;
    color: #94a3b8 !important;
    padding: 5px 8px !important;
    border-radius: 0 8px 8px 0 !important;
    font: 600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
  }
  .tp-threshold-btn:hover, .tp-threshold-btn.tp-open {
    color: #f8fafc !important;
    background: rgba(30, 41, 59, 0.9) !important;
  }
  .tp-threshold-popover {
    position: absolute !important;
    top: calc(100% + 4px) !important;
    left: 0 !important;
    background: rgba(15, 23, 42, 0.96) !important;
    backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 8px !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
    padding: 4px !important;
    display: none;
    flex-direction: column !important;
    gap: 2px !important;
    z-index: 100000 !important;
    min-width: 84px !important;
  }
  .tp-threshold-popover.tp-show { display: flex !important; }
  .tp-threshold-option {
    background: transparent !important;
    border: none !important;
    color: #cbd5e1 !important;
    padding: 5px 10px !important;
    font: 600 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    border-radius: 5px !important;
    cursor: pointer !important;
    text-align: left !important;
    transition: all 0.15s ease !important;
  }
  .tp-threshold-option:hover {
    background: rgba(59, 130, 246, 0.25) !important;
    color: #60a5fa !important;
  }
  .tp-threshold-option.tp-selected {
    background: #3b82f6 !important;
    color: #ffffff !important;
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
  .tp-card-quick-block {
    position: absolute !important;
    bottom: 6px !important;
    left: 8px !important;
    background: rgba(15,23,42,0.92) !important;
    backdrop-filter: blur(8px) !important;
    border: 1px solid rgba(244,63,94,0.5) !important;
    color: #fda4af !important;
    font: 600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    padding: 2px 7px !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    opacity: 0 !important;
    transition: all 0.2s ease !important;
    z-index: 9999 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    max-width: 160px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
  }
  .Plugin_Product:hover .tp-card-quick-block,
  .mixedBrowsingListProduct:hover .tp-card-quick-block { opacity: 1 !important; }
  .tp-card-quick-block:hover {
    background: #e11d48 !important;
    color: #fff !important;
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
    z-index: 9990 !important;
    position: relative !important;
  }
  .tp-filter-main-row {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
  }
  .tp-filter-badge {
    font-size: 13px !important;
    font-weight: 700 !important;
    color: #10b981 !important;
    flex-shrink: 0 !important;
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
  .tp-bar-btn.tp-active {
    background: rgba(16,185,129,0.2) !important;
    border-color: rgba(16,185,129,0.4) !important;
    color: #34d399 !important;
  }
  .tp-filter-toggle-btn.tp-active {
    background: rgba(16,185,129,0.2) !important;
    border-color: rgba(16,185,129,0.4) !important;
    color: #34d399 !important;
  }
  .tp-filter-toggle-btn.tp-filter-off {
    background: rgba(245,158,11,0.15) !important;
    border-color: rgba(245,158,11,0.35) !important;
    color: #fbbf24 !important;
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
    width: 20px !important;
    height: 20px !important;
    border-radius: 50% !important;
    background: rgba(255,255,255,0.1) !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    color: #fff !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    padding: 0 !important;
  }
  .tp-stepper-btn:hover { background: rgba(16,185,129,0.5) !important; }
  .tp-blocked-cats-row {
    border-top: 1px solid rgba(255,255,255,0.08) !important;
    padding-top: 6px !important;
    align-items: center !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
    max-height: 140px !important;
    overflow-y: auto !important;
  }
  .tp-blocked-cats-row.tp-collapsed {
    display: none !important;
  }
  .tp-blocked-cats-row.tp-expanded {
    display: flex !important;
  }
  .tp-blocked-cats-label {
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #f43f5e !important;
  }
  .tp-blocked-chip {
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    padding: 2px 8px !important;
    border-radius: 10px !important;
    font: 600 11px inherit !important;
    background: rgba(239,68,68,0.18) !important;
    border: 1px solid rgba(239,68,68,0.4) !important;
    color: #fca5a5 !important;
  }
  .tp-blocked-chip-remove { cursor: pointer !important; font-weight: 700 !important; }
  .tp-blocked-clear-all {
    font-size: 10px !important;
    color: #94a3b8 !important;
    background: transparent !important;
    border: none !important;
    text-decoration: underline !important;
    cursor: pointer !important;
  }
`;

export const SHADOW_MODAL_STYLES = `
  :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  #tp-settings-fab {
    position: fixed;
    bottom: 14px;
    right: 14px;
    width: 50px;
    height: 50px;
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
    transition: all 0.3s ease;
  }
  #tp-settings-fab:hover {
    background: rgba(16,185,129,0.9);
    transform: scale(1.1);
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
  .tp-section-header {
    margin: 14px 0 10px;
    color: #10b981;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    padding-bottom: 4px;
  }
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
  .tp-toast-undo {
    background: rgba(56,189,248,0.18);
    border: 1px solid rgba(56,189,248,0.5);
    color: #38bdf8;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
`;

