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
    z-index: 5 !important;
    box-sizing: border-box !important;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    border: 1px solid var(--tp-line-soft) !important;
    color: var(--tp-txt) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35) !important;
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
    background: rgba(255, 255, 255, 0.95) !important;
    border: 1.5px solid rgba(56, 189, 248, 0.6) !important;
    color: var(--tp-txt) !important;
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
    background: rgba(255, 255, 255, 0.95) !important;
    border-color: #0369a1 !important;
    color: #0369a1 !important;
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
    z-index: 5 !important;
    width: 26px !important;
    height: 26px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 13px !important;
    line-height: 1 !important;
    background: rgba(255, 255, 255, 0.95) !important;
    border: 1px solid rgba(88, 101, 242, 0.7) !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
  :is(.Plugin_Product, .mixedBrowsingListProduct):is(:hover, :focus-within) > .tp-share-btn,
  .tp-share-btn:hover,
  .tp-share-btn:focus-visible {
    opacity: 0.9 !important;
    pointer-events: auto !important;
  }
  .tp-share-btn:disabled {
    opacity: 0.4 !important;
    cursor: wait !important;
  }
  .tp-share-btn.tp-share-done {
    opacity: 1 !important;
    pointer-events: auto !important;
    box-shadow: 0 0 10px var(--tp-acc) !important;
  }
  .tp-review-search-btn {
    display: inline-block !important;
    margin-left: 6px !important;
    font-size: 13px !important;
    line-height: 1 !important;
    cursor: pointer !important;
    text-decoration: none !important;
    opacity: 0 !important;
    pointer-events: none !important;
    transition: opacity 0.15s ease !important;
  }
  :is(.Plugin_Product, .mixedBrowsingListProduct, .Plugin_ProductCollItem, .Plugin_ProductOffers):is(:hover, :focus-within) .tp-review-search-btn,
  .tp-review-search-btn:focus-visible {
    opacity: 0.85 !important;
    pointer-events: auto !important;
  }
  .tp-review-search-btn:hover {
    opacity: 1 !important;
  }
  .badge.badge-dif.tp-deal-badge-interactive:hover,
  .badge-dif.tp-deal-badge-interactive:hover {
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5) !important;
    z-index: 5 !important;
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
  .badge.badge-dif[role="button"]:focus-visible,
  .badge-dif[role="button"]:focus-visible { outline: 2px solid var(--tp-focus) !important; outline-offset: 2px !important; }
  .badge.badge-dif.tp-deal-loading,
  .badge-dif.tp-deal-loading {
    cursor: wait !important;
    opacity: 0.85 !important;
  }
  /* Geprüft vs ungeprüft: unchecked badges read striped-gray + dashed at a
     glance, verified badges stay solid heat. Cards stay at full opacity —
     dimming applies only to .tp-dimmed (per-cause Dimmen-Modus).
     Always on, no heat dependency. */
  .badge.badge-dif.tp-is-unverified,
  .badge-dif.tp-is-unverified {
    background: repeating-linear-gradient(135deg, #e2e8f0 0 6px, #cbd5e1 6px 12px) !important;
    border: 1.5px dashed var(--tp-line-soft) !important;
    color: var(--tp-txt-dim) !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
  }
  .badge.badge-dif.tp-is-verified,
  .badge-dif.tp-is-verified {
    border-style: solid !important;
    border-width: 1.5px !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.45) !important;
  }
  /* 3A/3B/2A retired: record (gold), at-low (emerald) and markup (amber/rose)
     no longer paint. Verified Tiefstpreise get the badge-% heat color inline;
     markups stay completely colorless/neutral: translucent white capsule with
     neutral slate text. Red and amber are strictly reserved for discounts. */
  .badge.badge-dif.tp-deal-not-low,
  .badge-dif.tp-deal-not-low {
    background: rgba(255, 255, 255, 0.95) !important;
    border: 1.5px solid var(--tp-line-soft, #cbd5e1) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
    color: #475569 !important;
  }
  .badge.badge-dif.tp-deal-not-low .text,
  .badge-dif.tp-deal-not-low .text {
    color: #64748b !important;
  }
  .badge.badge-dif.tp-deal-not-low p.tp-markup-val,
  .badge-dif.tp-deal-not-low p.tp-markup-val,
  .badge.badge-dif.tp-deal-pill.tp-deal-not-low p.tp-markup-val,
  .badge.badge-dif.tp-injected-badge.tp-deal-not-low p.tp-markup-val,
  .badge-dif.tp-injected-badge.tp-deal-not-low p.tp-markup-val {
    font-size: 13px !important;
    font-weight: 800 !important;
    margin: 0 !important;
    line-height: 1.1 !important;
    color: #334155 !important;
  }
  .badge.badge-dif.tp-deal-pill.tp-deal-not-low p.tp-markup-val {
    font-size: 11px !important;
    font-weight: 700 !important;
    line-height: 1 !important;
  }
  .badge.badge-dif.tp-injected-badge.tp-deal-not-low .tp-fake-discount,
  .badge-dif.tp-injected-badge.tp-deal-not-low .tp-fake-discount,
  .badge.badge-dif.tp-deal-not-low .tp-fake-discount,
  .badge-dif.tp-deal-not-low .tp-fake-discount {
    font-size: 9.5px !important;
    display: block !important;
    line-height: 1 !important;
    margin-top: 1px !important;
    color: #64748b !important;
  }
  .tp-card-historical-price {
    font: 500 8.8px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    letter-spacing: -0.35px !important;
    color: #64748b !important;
    text-align: right !important;
    margin: 0 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    flex: 1 1 auto !important;
    min-width: 0 !important;
    user-select: none !important;
    pointer-events: auto !important;
  }
  .tp-card-historical-price.tp-is-record-low {
    color: #0f172a !important;
    font-weight: 700 !important;
  }
  .tp-card-historical-price.tp-is-at-low {
    color: #047857 !important;
  }
  .tp-card-historical-price.tp-with-prev {
    font-weight: 700 !important;
  }
  .tp-card-historical-price.tp-is-markup {
    color: #b45309 !important;
  }
  .tp-dealer-name {
    display: inline-block !important;
    vertical-align: baseline !important;
    font: 500 11px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    /* Kein Fix-Farbton: erbt die Containerfarbe ("ab CHF") und bleibt so in
    Light-/Darkmode sowie unter Dark-Reader-Addons lesbar. */
    color: inherit !important;
    opacity: 0.8 !important;
    background: transparent !important;
    text-decoration: none !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 40% !important;
    min-width: 0 !important;
    margin-right: auto !important;
  }
  /* Preiszeile mit Händler als Flex-Row: der Name bekommt den verfügbaren
  Platz (Ellipsis erst bei echtem Platzmangel), der Preis schrumpft nie.
  40%-Cap oben gilt dann nur noch ohne Flex-Container (Fallback). */
  .Plugin_PriceInformation:has(> .tp-dealer-name),
  .price_information_product:has(> .tp-dealer-name),
  .product-price:has(> .tp-dealer-name),
  .priceContainer:has(> .tp-dealer-name) {
    display: flex !important;
    align-items: baseline !important;
    gap: 6px !important;
  }
  .Plugin_PriceInformation:has(> .tp-dealer-name) > .tp-dealer-name,
  .price_information_product:has(> .tp-dealer-name) > .tp-dealer-name,
  .product-price:has(> .tp-dealer-name) > .tp-dealer-name,
  .priceContainer:has(> .tp-dealer-name) > .tp-dealer-name {
    flex: 1 1 auto !important;
    max-width: none !important;
  }
  .Plugin_PriceInformation:has(> .tp-dealer-name) > :not(.tp-dealer-name),
  .price_information_product:has(> .tp-dealer-name) > :not(.tp-dealer-name),
  .product-price:has(> .tp-dealer-name) > :not(.tp-dealer-name),
  .priceContainer:has(> .tp-dealer-name) > :not(.tp-dealer-name) {
    flex-shrink: 0 !important;
  }
  a.tp-dealer-name:hover {
    opacity: 1 !important;
    text-decoration: underline !important;
  }
  button.tp-dealer-name.tp-dealer-btn {
    background: none !important;
    border: none !important;
    cursor: pointer !important;
    padding: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
    flex: 0 0 auto !important;
  }
  :is(.Plugin_Product, .mixedBrowsingListProduct):is(:hover, :focus-within) button.tp-dealer-name.tp-dealer-btn,
  button.tp-dealer-name.tp-dealer-btn:hover,
  button.tp-dealer-name.tp-dealer-btn:focus-visible {
    opacity: 0.75 !important;
    pointer-events: auto !important;
  }
  button.tp-dealer-name.tp-dealer-btn:hover {
    opacity: 1 !important;
  }
  button.tp-dealer-name.tp-dealer-btn:disabled {
    cursor: wait !important;
    opacity: 0.4 !important;
    pointer-events: auto !important;
  }
  .tp-card-subline-row {
    position: absolute !important;
    bottom: 4px !important;
    left: 38px !important;
    right: 6px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    width: auto !important;
    max-width: none !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  /* Reserve strip space inside the card so fixed-height site cards grow
     their padding instead of clipping the overlay. Only fires with strip. */
  #product-list .Plugin_Product.medium-box:has(> .tp-card-subline-row),
  .Plugin_TopPriceReductionProductListFull .Plugin_Product.medium-box:has(> .tp-card-subline-row),
  .Plugin_Product:has(> .tp-card-subline-row) {
    position: relative !important;
    padding-bottom: 30px !important;
  }
  .tp-sparkline-container {
    display: inline-flex !important;
    align-items: center !important;
    vertical-align: middle !important;
    margin: 0 !important;
    line-height: 1 !important;
    overflow: hidden !important;
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
  .tp-sparkline-container {
    flex-shrink: 0 !important;
  }
  /* Touch visibility & hit area expansion for hover-only card actions */
  @media (hover: none), (pointer: coarse) {
    .tp-share-btn:not(.tp-share-done):not(:disabled),
    .tp-review-search-btn,
    button.tp-dealer-name.tp-dealer-btn:not(:disabled) {
      opacity: 0.45 !important;
      pointer-events: auto !important;
      touch-action: manipulation !important;
    }
    .tp-review-search-btn,
    button.tp-dealer-name.tp-dealer-btn {
      position: relative !important;
    }
    .tp-share-btn:not(:disabled):active,
    .tp-review-search-btn:active,
    button.tp-dealer-name.tp-dealer-btn:not(:disabled):active {
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
