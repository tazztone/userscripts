// ==UserScript==
// @name         Toppreise.ch Suite: Power Filter & Price Alarm Auto-Filler
// @namespace    https://github.com/tazztone/userscripts
// @version      2.18.222
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

/**
 * Shared UI tokens (single source for bar, deal cluster, modal, CTA).
 * Same values as the hardcoded hex they replace — visual no-op on inject.
 * Main doc consumes via :root, shadow modal via :host.
 */
const TP_TOKEN_VARS = `
  --tp-bg: #ffffff;
  --tp-panel: rgba(255,255,255,0.92);
  --tp-line: rgba(15,23,42,0.12);
  --tp-line-soft: rgba(15,23,42,0.16);
  --tp-txt: #0f172a;
  --tp-txt-mid: #1e293b;
  --tp-txt-dim: #334155;
  --tp-mut: #64748b;
  --tp-dim: #64748b;
  --tp-acc: #10b981;
  --tp-acc-deep: #047857;
  --tp-acc-soft: rgba(16, 185, 129, 0.2);
  --tp-acc-line: rgba(16, 185, 129, 0.4);
  --tp-acc-txt: #047857;
  --tp-acc2: #7c3aed;
  --tp-sky: #0369a1;
  --tp-blue: #3b82f6;
  --tp-blue-soft: #2563eb;
  --tp-rose: #f43f5e;
  --tp-warn: #f59e0b;
  --tp-focus: #047857;
  --tp-grad-acc: linear-gradient(135deg, #047857 0%, #065f46 100%);
  --tp-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --tp-r-sm: 6px;
  --tp-r-md: 8px;
  --tp-r-lg: 12px;
  --tp-r-pill: 999px;
  --tp-fs-xs: 10px;
  --tp-fs-sm: 11px;
  --tp-fs-md: 12px;
  --tp-fs-lg: 13px;
`;

const STYLES = `
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
  /* Vortief fallback heat (mode, verified low without blend): subtle outer
  glow only — never the regular inset wash, never a solid border. Inset is
  reserved for verified blend heat. Glow arrives inline via --tp-heat-glow;
  this keeps only the transition. */
  .tp-heat-vortief {
    transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
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
  .tp-filtered, [class*="col-"]:has(> .tp-filtered) {
    display: none !important;
  }
  .tp-dimmed {
    opacity: var(--tp-dim-opacity, 0.25) !important;
    filter: grayscale(40%) !important;
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
  .tp-share-btn.tp-share-done {
    opacity: 1 !important;
    pointer-events: auto !important;
    box-shadow: 0 0 10px var(--tp-acc) !important;
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
     markups stay neutral gray with the +XX% text carrying the signal. */
  .badge.badge-dif.tp-deal-not-low p.tp-markup-val {
    font-size: 13px !important;
    font-weight: 800 !important;
    margin: 0 !important;
    line-height: 1.1 !important;
    color: #ffffff !important;
  }
  /* List-view pills sit on a white capsule, so the +XX% needs the dark
     amber instead of the feed-badge white above. */
  .badge.badge-dif.tp-deal-pill.tp-deal-not-low p.tp-markup-val {
    color: #b45309 !important;
  }
  .badge.badge-dif.tp-deal-not-low .tp-fake-discount {
    font-size: 9.5px !important;
    display: block !important;
    line-height: 1 !important;
    margin-top: 1px !important;
    color: #ffffff !important;
  }
  .tp-card-historical-price {
    font: 500 11px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
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
    color: #065f46 !important;
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
  .tp-show-share button.tp-dealer-name.tp-dealer-btn,
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
  .tp-card-subline-row {
    max-width: none !important;
  }
  .tp-sparkline-container {
    flex-shrink: 0 !important;
  }
  .tp-bar-btn.tp-bestpreise-active {
    /* Opak statt transluzent: der Button sitzt in der dunklen Bar. */
    background: linear-gradient(135deg, #6366f1, #4f46e5) !important;
    border-color: #4338ca !important;
    color: #fff !important;
    box-shadow: 0 1px 4px rgba(79, 70, 229, 0.3) !important;
  }
  #tp-bar-bestpreise-count {
    min-width: 18px !important;
    height: 18px !important;
    padding: 0 5px !important;
    border-radius: var(--tp-r-pill) !important;
    font-size: var(--tp-fs-xs) !important;
    font-weight: 700 !important;
    display: inline-flex;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(255, 255, 255, 0.22) !important;
    color: #fff !important;
    font-variant-numeric: tabular-nums !important;
    box-sizing: border-box !important;
  }
  #tp-suite-filter-bar.tp-bestpreise-bar {
    border-color: rgba(99, 102, 241, 0.45) !important;
    box-shadow: 0 3px 10px rgba(0,0,0,0.2), 0 0 0 1px rgba(99, 102, 241, 0.2) !important;
  }
  /* Deal controls live in the bar deals group; host keeps flex-wrap for the site row. */
  :is(#timeframe-filter, .Plugin_TimePeriod) {
    align-items: center !important;
    gap: 6px 8px !important;
    flex-wrap: wrap !important;
    row-gap: 6px !important;
  }
  #tp-bar-horizon-range {
    width: 84px !important;
    accent-color: #6366f1 !important;
    cursor: pointer !important;
    height: 14px !important;
    margin: 0 !important;
    padding: 0 !important;
    vertical-align: middle !important;
    align-self: center !important;
  }
  .tp-threshold-wrapper {
    position: relative !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    background: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: var(--tp-r-md) !important;
    padding: 0 9px !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
    height: 24px !important;
    box-sizing: border-box !important;
    color: #334155 !important;
    line-height: 1 !important;
    flex-shrink: 0 !important;
  }
  .tp-weight-label, #tp-bar-horizon-label {
    color: #475569 !important;
    font: 600 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    white-space: nowrap !important;
    cursor: default !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 100% !important;
    line-height: 1 !important;
    min-width: 12ch !important;
    text-align: center !important;
    font-variant-numeric: tabular-nums !important;
    vertical-align: middle !important;
  }
  #tp-bar-weight-range {
    width: 56px !important;
    accent-color: #6366f1 !important;
    cursor: pointer !important;
    height: 14px !important;
    margin: 0 !important;
    padding: 0 !important;
    vertical-align: middle !important;
    align-self: center !important;
  }
  .tp-threshold-wrapper .tp-stepper-label {
    font: 600 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    color: #475569 !important;
    display: inline-flex !important;
    align-items: center !important;
    height: 100% !important;
    line-height: 1 !important;
    vertical-align: middle !important;
    margin: 0 !important;
  }
  .tp-threshold-wrapper .tp-mini-switch {
    display: inline-flex !important;
    align-items: center !important;
    height: 100% !important;
    gap: 4px !important;
    margin: 0 !important;
    vertical-align: middle !important;
  }
  .tp-threshold-wrapper .tp-mini-slider {
    width: 26px !important;
    height: 14px !important;
    display: inline-block !important;
    vertical-align: middle !important;
    align-self: center !important;
    margin: 0 !important;
  }
  .tp-threshold-wrapper .tp-mini-slider:before {
    width: 10px !important;
    height: 10px !important;
    top: 1px !important;
    left: 1px !important;
  }
  .tp-threshold-wrapper .tp-mini-switch input:checked + .tp-mini-slider:before {
    transform: translateX(12px) !important;
  }
  .tp-threshold-wrapper .tp-mini-state {
    font-size: 10px !important;
    font-weight: 700 !important;
    min-width: 34px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 100% !important;
    line-height: 1 !important;
    vertical-align: middle !important;
    margin: 0 0 0 2px !important;
    flex-shrink: 0 !important;
    overflow: visible !important;
    text-align: center !important;
    white-space: nowrap !important;
  }
  #tp-bar-minpoints-range {
    width: 56px !important;
    accent-color: #0284c7 !important;
    cursor: pointer !important;
    height: 14px !important;
    margin: 0 !important;
    padding: 0 !important;
    vertical-align: middle !important;
    align-self: center !important;
  }
  #tp-bar-minpoints-label {
    min-width: 10ch !important;
    text-align: center !important;
    font-variant-numeric: tabular-nums !important;
    white-space: nowrap !important;
    color: #475569 !important;
    font: 600 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 100% !important;
    line-height: 1 !important;
    vertical-align: middle !important;
  }
  :is(#timeframe-filter, .Plugin_TimePeriod) #tp-bar-bestpreise-btn {
    background: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    color: #334155 !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
    height: 24px !important;
    padding: 0 9px !important;
    font-size: 11.5px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
  }
  :is(#timeframe-filter, .Plugin_TimePeriod) #tp-bar-bestpreise-btn:hover {
    background: #f8fafc !important;
    border-color: #94a3b8 !important;
    color: #0f172a !important;
  }
  :is(#timeframe-filter, .Plugin_TimePeriod) #tp-bar-bestpreise-btn.tp-bestpreise-active {
    background: linear-gradient(135deg, #6366f1, #4f46e5) !important;
    border-color: #4338ca !important;
    color: #ffffff !important;
    box-shadow: 0 1px 4px rgba(79, 70, 229, 0.3) !important;
  }
  .tp-empty-state-notice {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 12px !important;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(12px) !important;
    border: 1px dashed rgba(15, 23, 42, 0.2) !important;
    border-radius: var(--tp-r-lg) !important;
    padding: 24px 20px !important;
    margin: 16px auto !important;
    width: 100% !important;
    box-sizing: border-box !important;
    color: var(--tp-txt-mid) !important;
    text-align: center !important;
    font: 500 var(--tp-fs-lg) var(--tp-font) !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
  }
  .tp-empty-state-actions {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
    justify-content: center !important;
  }
  .tp-empty-state-btn {
    background: rgba(255, 255, 255, 0.9) !important;
    border: 1px solid var(--tp-line-soft) !important;
    color: var(--tp-txt) !important;
    padding: 6px 12px !important;
    border-radius: var(--tp-r-sm) !important;
    font-size: var(--tp-fs-md) !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
  }
  .tp-empty-state-btn:hover {
    background: #1d4ed8 !important;
    border-color: var(--tp-blue-soft) !important;
    color: #ffffff !important;
  }
  .tp-detail-deal-badge {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 4px 10px !important;
    border-radius: var(--tp-r-md) !important;
    font: 700 12.5px/1.3 var(--tp-font) !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    vertical-align: middle !important;
    margin-left: 10px !important;
    user-select: none !important;
  }
  .tp-detail-deal-badge.tp-is-alltime-low {
    background: linear-gradient(135deg, rgba(4, 120, 87, 0.95) 0%, rgba(6, 95, 70, 0.95) 100%) !important;
    border: 1px solid var(--tp-acc-txt) !important;
    color: #ffffff !important;
    box-shadow: 0 2px 10px rgba(4, 120, 87, 0.45) !important;
  }
  .tp-detail-deal-badge.tp-is-not-low {
    background: linear-gradient(135deg, rgba(180, 83, 9, 0.95) 0%, rgba(146, 64, 14, 0.95) 100%) !important;
    border: 1px solid #b45309 !important;
    color: #ffffff !important;
    box-shadow: 0 2px 10px rgba(180, 83, 9, 0.4) !important;
  }
  .tp-detail-deal-badge.tp-is-severe-markup {
    background: linear-gradient(135deg, rgba(190, 18, 60, 0.95) 0%, rgba(159, 18, 57, 0.95)) !important;
    border: 1px solid var(--tp-rose) !important;
    color: #ffffff !important;
    box-shadow: 0 2px 10px rgba(190, 18, 60, 0.45) !important;
  }

  #tp-suite-filter-bar {
    margin: 8px auto 12px !important;
    width: 100% !important;
    box-sizing: border-box !important;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(14px) !important;
    -webkit-backdrop-filter: blur(14px) !important;
    border: 1px solid var(--tp-line) !important;
    border-radius: var(--tp-r-lg) !important;
    padding: 6px 8px !important;
    color: var(--tp-txt) !important;
    font-family: var(--tp-font) !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12) !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    gap: 6px !important;
    z-index: 30 !important; /* below live header stacking root (z=31, measured 2026-10-13); card chrome ≤5 */
    position: sticky !important;
    top: 8px !important;
  }
  .tp-filter-main-row {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    flex: 1 !important;
    flex-wrap: nowrap !important;
    min-width: 0 !important;
  }
  .tp-group {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    min-width: 0 !important;
  }
  .tp-group-filter {
    flex: 1 1 auto !important;
    min-width: 0 !important;
  }
  .tp-group-view, .tp-group-deals {
    flex: 0 0 auto !important;
  }
  .tp-group-deals {
    margin-left: auto !important;
  }
  .tp-divider {
    width: 1px !important;
    height: 20px !important;
    align-self: center !important;
    background: rgba(15,23,42,0.10) !important;
    border-radius: 1px !important;
    flex-shrink: 0 !important;
  }
  .tp-stepper-label {
    font: 600 var(--tp-fs-sm) -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    color: var(--tp-mut) !important;
    white-space: nowrap !important;
  }
  .tp-input-wrapper {
    flex: 1 1 200px !important;
    max-width: 340px !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    min-width: 0 !important;
  }
  .tp-input-field-box {
    flex: 1 !important;
    min-width: 110px !important;
    position: relative !important;
    display: flex !important;
    align-items: center !important;
  }
  #tp-inline-negative-input {
    width: 100% !important;
    height: 32px !important;
    background: rgba(255,255,255,0.95) !important;
    border: 1px solid var(--tp-line) !important;
    border-radius: var(--tp-r-md) !important;
    color: var(--tp-txt) !important;
    padding: 6px 26px 6px 10px !important;
    font-size: var(--tp-fs-md) !important;
    outline: none !important;
    box-sizing: border-box !important;
  }
  #tp-inline-negative-input:focus { border-color: var(--tp-acc) !important; }
  #tp-clear-neg-btn {
    position: absolute !important;
    right: 8px !important;
    background: transparent !important;
    border: none !important;
    color: var(--tp-dim) !important;
    cursor: pointer !important;
    padding: 2px 6px !important;
  }
  #tp-clear-neg-btn:hover { color: var(--tp-rose) !important; }
  .tp-bar-btn {
    background: rgba(15, 23, 42, 0.05) !important;
    border: 1px solid rgba(15, 23, 42, 0.1) !important;
    color: var(--tp-txt-dim) !important;
    padding: 0 10px !important;
    height: 32px !important;
    border-radius: var(--tp-r-md) !important;
    font-size: var(--tp-fs-sm) !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    line-height: 1 !important;
    gap: 5px !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
    transition: all 0.15s ease !important;
    box-sizing: border-box !important;
  }
  .tp-bar-btn:hover { background: rgba(15, 23, 42, 0.08) !important; color: var(--tp-txt) !important; }
  .tp-bar-btn:focus-visible { outline: 2px solid var(--tp-focus) !important; outline-offset: 2px !important; }
  .tp-bar-btn.tp-active {
    background: var(--tp-acc-soft) !important;
    border-color: var(--tp-acc-line) !important;
    color: var(--tp-acc-txt) !important;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.15) !important;
  }
  .tp-mini-switch {
    position: relative !important;
    display: inline-flex !important;
    align-items: center !important;
    line-height: 1 !important;
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
    border-radius: var(--tp-r-pill) !important;
    background: rgba(100,116,139,0.35) !important;
    border: 1px solid rgba(100,116,139,0.55) !important;
    transition: background 0.2s ease, border-color 0.2s ease !important;
    flex-shrink: 0 !important;
    display: inline-block !important;
    vertical-align: middle !important;
    align-self: center !important;
    margin: 0 !important;
  }
  .tp-mini-slider:before {
    content: "" !important;
    position: absolute !important;
    top: 2px !important;
    left: 2px !important;
    width: 12px !important;
    height: 12px !important;
    border-radius: 50% !important;
    background: var(--tp-mut) !important;
    transition: transform 0.2s ease, background 0.2s ease !important;
  }
  .tp-mini-switch input:checked + .tp-mini-slider {
    background: var(--tp-acc-soft) !important;
    border-color: var(--tp-acc-line) !important;
  }
  .tp-mini-switch input:checked + .tp-mini-slider:before {
    transform: translateX(14px) !important;
    background: #fff !important;
  }
  .tp-mini-switch input:focus-visible + .tp-mini-slider {
    outline: 2px solid var(--tp-focus) !important;
    outline-offset: 2px !important;
  }
  .tp-count-badge {
    min-width: 18px !important;
    height: 18px !important;
    padding: 0 5px !important;
    border-radius: var(--tp-r-pill) !important;
    font-size: var(--tp-fs-xs) !important;
    font-weight: 700 !important;
    display: inline-flex;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(15, 23, 42, 0.08) !important;
    color: var(--tp-txt-dim) !important;
    font-variant-numeric: tabular-nums !important;
    box-sizing: border-box !important;
  }
  .tp-bar-btn.tp-active .tp-count-badge {
    background: var(--tp-acc) !important;
    color: #fff !important;
  }
  .tp-count-badge.tp-count-warn {
    background: var(--tp-warn) !important;
    color: #fff !important;
  }
  /* Dimmed tool: the control a switched-OFF mini-toggle belongs to reads inactive. */
  .tp-tool-dim {
    opacity: 0.45 !important;
    filter: saturate(0.4) !important;
    transition: opacity 0.2s ease !important;
  }
  .tp-calc-wrap {
    position: relative !important;
    display: inline-flex !important;
  }
  #tp-bar-calc-popover {
    position: absolute !important;
    right: 0 !important;
    top: calc(100% + 8px) !important;
    width: 320px !important;
    display: none !important;
    flex-direction: column !important;
    gap: 10px !important;
    background: var(--tp-bg) !important;
    border: 1.5px solid var(--tp-line-soft) !important;
    border-radius: var(--tp-r-lg) !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18) !important;
    padding: 12px !important;
    z-index: 120 !important;
  }
  #tp-bar-calc-popover.tp-show { display: flex !important; }
  #tp-bar-filter-popover {
    position: absolute !important;
    left: 0 !important;
    top: calc(100% + 8px) !important;
    width: 360px !important;
    max-height: min(70vh, 560px) !important;
    overflow-y: auto !important;
    display: none !important;
    flex-direction: column !important;
    gap: 10px !important;
    background: var(--tp-bg) !important;
    backdrop-filter: blur(14px) !important;
    border: 1px solid rgba(15,23,42,0.25) !important;
    border-radius: var(--tp-r-lg) !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18) !important;
    padding: 12px !important;
    z-index: 120 !important;
  }
  #tp-bar-filter-popover.tp-show { display: flex !important; }
  .tp-filter-row {
    display: flex !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    gap: 8px !important;
  }
  .tp-filter-row .tp-filter-label { flex: 1 1 auto !important; }
  .tp-row-inactive { opacity: .55 !important; }
  .tp-filter-mode-btn.tp-active {
    background: var(--tp-acc-soft) !important;
    border-color: var(--tp-acc-line) !important;
    color: var(--tp-acc-txt) !important;
  }
  .tp-calc-head {
    font-weight: 700 !important;
    font-size: var(--tp-fs-lg) !important;
    color: var(--tp-txt) !important;
  }
  .tp-calc-head span {
    display: block !important;
    font-weight: 500 !important;
    font-size: var(--tp-fs-xs) !important;
    color: var(--tp-mut) !important;
  }
  #tp-bar-calc-popover .tp-threshold-wrapper {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    height: auto !important;
    padding: 0 !important;
    justify-content: space-between !important;
    width: 100% !important;
  }
  #tp-bar-calc-popover #tp-bar-outlier-wrapper { justify-content: flex-start !important; }
  #tp-bar-calc-popover .tp-threshold-wrapper input[type="range"] {
    flex: 1 !important;
    width: auto !important;
  }
  #tp-bar-calc-popover #tp-bar-horizon-range { width: auto !important; }
  #tp-bar-calc-popover #tp-bar-weight-range { width: auto !important; }
  .tp-calc-reset { align-self: flex-end !important; }
  #tp-bar-calc-popover { max-height: min(70vh, 560px) !important; overflow-y: auto !important; }
  #tp-calc-preview { border-top: 1px solid var(--tp-line) !important; margin-top: 6px !important; padding-top: 6px !important; display: flex !important; flex-direction: column !important; gap: 4px !important; }
  .tp-preview-select { font-size: 11px !important; max-width: 190px !important; }
  #tp-preview-svg { width: 100% !important; height: auto !important; display: block !important; }
  #tp-preview-legend, #tp-preview-blend, #tp-preview-status { font-size: 11px !important; color: var(--tp-txt-dim) !important; }
  #tp-preview-key { font-size: 11px !important; color: var(--tp-txt-dim) !important; display: flex !important; gap: 10px !important; }
  #tp-preview-key .tp-pv-k-main { color: #3b82f6 !important; font-weight: 700 !important; }
  #tp-preview-key .tp-pv-k-med { color: #64748b !important; font-weight: 700 !important; }
  #tp-preview-key .tp-pv-k-rec { color: #f59e0b !important; font-weight: 700 !important; }
  #tp-preview-key .tp-pv-k-g { color: #f43f5e !important; font-weight: 700 !important; }
  .tp-bar-stepper-group {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    background: rgba(15,23,42,0.04) !important;
    border: 1px solid var(--tp-line) !important;
    padding: 0 6px !important;
    height: 32px !important;
    box-sizing: border-box !important;
    border-radius: var(--tp-r-md) !important;
    font-size: var(--tp-fs-sm) !important;
    color: var(--tp-mut) !important;
    line-height: 1 !important;
  }
  .tp-bar-stepper-group .tp-stepper-label {
    display: inline-flex !important;
    align-items: center !important;
    line-height: 1 !important;
  }
  .tp-stepper-btn {
    width: 22px !important;
    height: 22px !important;
    border-radius: 50% !important;
    background: rgba(15,23,42,0.06) !important;
    border: 1px solid rgba(15,23,42,0.12) !important;
    color: var(--tp-txt) !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    padding: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
  }
  .tp-stepper-btn:hover { background: rgba(16,185,129,0.5) !important; }
  .tp-stepper-btn:focus-visible { outline: 2px solid var(--tp-focus) !important; outline-offset: 2px !important; }
  @media (max-width: 1100px) {
    #tp-suite-filter-bar { flex-wrap: wrap !important; }
    .tp-filter-main-row { flex-wrap: wrap !important; }
    .tp-group-deals { margin-left: 0 !important; }
    .tp-divider { display: none !important; }
    #tp-bar-calc-popover { width: min(320px, 92vw) !important; }
  }
  @media (max-width: 700px) {
    .tp-input-wrapper { flex: 1 1 100% !important; max-width: none !important; }
  }
  /* ─── FLOATING CHECK-DEALS CTA (primary one-click verify action) ─── */
  #tp-floating-check-cta {
    position: fixed !important;
    left: 20px !important;
    bottom: 20px !important;
    z-index: 99990 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    max-width: none !important;
    height: 36px !important;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid var(--tp-line-soft) !important;
    border-radius: 999px !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
    padding: 3px 5px !important;
    font-family: var(--tp-font) !important;
    animation: tp-floating-pulse 2.4s ease-in-out infinite !important;
    transition: left 0.2s ease, bottom 0.2s ease, opacity 0.2s ease, transform 0.2s ease !important;
    box-sizing: border-box !important;
  }
  #tp-floating-check-cta.tp-scanning { animation: none !important; border-color: rgba(245,158,11,0.6) !important; }
  #tp-floating-check-cta.tp-empty {
    animation: none !important;
    border-color: rgba(148,163,184,0.2) !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
    opacity: 0.65 !important;
  }
  #tp-floating-check-cta.tp-empty:hover {
    opacity: 1 !important;
  }
  #tp-floating-check-cta.tp-empty #tp-floating-check-btn {
    background: rgba(15, 23, 42, 0.06) !important;
    color: var(--tp-txt-dim) !important;
    box-shadow: none !important;
  }
  #tp-floating-check-cta.tp-empty #tp-floating-check-btn:hover {
    background: rgba(15, 23, 42, 0.10) !important;
    color: var(--tp-txt) !important;
  }
  #tp-floating-check-cta.tp-empty #tp-floating-check-sub {
    opacity: 0.7 !important;
  }
  #tp-floating-check-cta.tp-hidden { display: none !important; }
  @keyframes tp-floating-pulse {
    0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 0 8px rgba(16,185,129,0.2) !important; }
    50% { box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 0 18px rgba(16,185,129,0.45) !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    #tp-floating-check-cta { animation: none !important; }
    .tp-tool-dim, .tp-mini-slider, .tp-mini-slider:before, .tp-switch .tp-slider, .tp-switch .tp-slider:before { transition: none !important; }
  }
  @media (prefers-contrast: more) {
    .badge-dif, .tp-deal-pill { color: #fff !important; border-width: 2px !important; }
    .tp-tool-dim { opacity: 0.75 !important; }
  }
  #tp-floating-check-col {
    display: inline-flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 4px !important;
  }
  #tp-floating-check-btn {
    background: linear-gradient(135deg, #047857 0%, #065f46 100%) !important;
    border: none !important;
    border-radius: 999px !important;
    color: #fff !important;
    padding: 3px 12px !important;
    cursor: pointer !important;
    display: inline-flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    justify-content: center !important;
    gap: 1px !important;
    line-height: 1.15 !important;
    height: 30px !important;
    box-sizing: border-box !important;
    box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3) !important;
    transition: filter 0.15s ease !important;
  }
  #tp-floating-check-btn:hover { filter: brightness(1.12) !important; }
  #tp-floating-dealer-row {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    padding: 0 8px !important;
    height: 28px !important;
    border-radius: 999px !important;
    background: rgba(15, 23, 42, 0.05) !important;
    border: 1px solid rgba(15, 23, 42, 0.1) !important;
    font-size: 10.5px !important;
    font-weight: 600 !important;
    color: var(--tp-txt-dim) !important;
    cursor: pointer !important;
    white-space: nowrap !important;
    user-select: none !important;
    box-sizing: border-box !important;
  }
  #tp-floating-dealer-row:hover { background: rgba(15, 23, 42, 0.08) !important; color: var(--tp-txt) !important; }
  #tp-floating-dealer-row.tp-active { background: rgba(16, 185, 129, 0.2) !important; border-color: rgba(16, 185, 129, 0.4) !important; color: var(--tp-acc-txt) !important; }
  #tp-floating-dealer-row input { accent-color: var(--tp-acc) !important; margin: 0 !important; cursor: pointer !important; }
  #tp-floating-check-main { font-size: 11.5px !important; font-weight: 800 !important; white-space: nowrap !important; }
  #tp-floating-check-sub { font-size: 9.5px !important; font-weight: 500 !important; white-space: nowrap !important; }
  #tp-floating-threshold-btn {
    background: rgba(15, 23, 42, 0.05) !important;
    border: 1px solid rgba(15, 23, 42, 0.1) !important;
    border-radius: 999px !important;
    color: var(--tp-txt-dim) !important;
    padding: 0 8px !important;
    height: 28px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    white-space: nowrap !important;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box !important;
  }
  #tp-floating-threshold-btn:hover { color: var(--tp-txt) !important; background: rgba(15, 23, 42, 0.08) !important; }
  #tp-floating-threshold-popover {
    position: absolute !important;
    bottom: calc(100% + 8px) !important;
    right: 0 !important;
    background: rgba(255, 255, 255, 0.97) !important;
    backdrop-filter: blur(14px) !important;
    border: 1px solid var(--tp-line-soft) !important;
    border-radius: var(--tp-r-lg) !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25) !important;
    padding: 4px !important;
    display: none;
    flex-direction: column !important;
    gap: 2px !important;
    min-width: 200px !important;
  }
  #tp-floating-threshold-popover.tp-show { display: flex !important; }
  #tp-floating-threshold-popover .tp-floating-hint {
    color: var(--tp-mut) !important;
    padding: 4px 8px 2px !important;
    font-size: 10px !important;
    font-weight: 500 !important;
    cursor: default !important;
  }
  #tp-floating-threshold-popover .tp-floating-option {
    background: transparent !important;
    border: none !important;
    color: var(--tp-txt-dim) !important;
    padding: 5px 8px !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    border-radius: var(--tp-r-sm) !important;
    cursor: pointer !important;
    text-align: left !important;
  }
  #tp-floating-threshold-popover .tp-floating-option:hover { background: rgba(16,185,129,0.25) !important; color: var(--tp-txt) !important; }
  #tp-floating-threshold-popover .tp-floating-option.tp-selected { background: #047857 !important; color: #fff !important; }
  #tp-floating-cta-collapse {
    background: rgba(15, 23, 42, 0.05) !important;
    border: 1px solid rgba(15, 23, 42, 0.1) !important;
    border-radius: 50% !important;
    color: var(--tp-mut) !important;
    width: 28px !important;
    height: 28px !important;
    padding: 0 !important;
    font-size: 12px !important;
    font-weight: 800 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-sizing: border-box !important;
  }
  #tp-floating-cta-collapse:hover { color: var(--tp-txt) !important; background: rgba(15, 23, 42, 0.10) !important; }
  #tp-floating-check-btn:focus-visible, #tp-floating-threshold-btn:focus-visible,
  #tp-floating-cta-collapse:focus-visible, #tp-floating-threshold-popover .tp-floating-option:focus-visible { outline: 2px solid var(--tp-focus) !important; outline-offset: 2px !important; }
  /* Collapsed form: compact count pill — the action stays one click away. */
  #tp-floating-check-count { display: none !important; font-size: 12px !important; font-weight: 800 !important; white-space: nowrap !important; }
  #tp-floating-check-cta.tp-collapsed { border-radius: var(--tp-r-pill) !important; padding: 3px !important; height: 32px !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-btn { border-radius: var(--tp-r-pill) !important; padding: 0 10px !important; height: 26px !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-main,
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-sub,
  #tp-floating-check-cta.tp-collapsed #tp-floating-dealer-row,
  #tp-floating-check-cta.tp-collapsed #tp-floating-threshold-btn { display: none !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-count { display: inline !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-cta-collapse { border-radius: 50% !important; border: 1px solid rgba(15,23,42,0.12) !important; width: 24px !important; height: 24px !important; }
  @media (max-width: 600px) {
    #tp-floating-check-sub { display: none !important; }
    #tp-floating-check-cta { left: 8px !important; bottom: 8px !important; }
  }
`;

const SHADOW_MODAL_STYLES = `
  :host {
    all: initial;
    font-family: var(--tp-font);
    ${TP_TOKEN_VARS}
  }
  #tp-settings-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--tp-line-soft);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tp-txt);
    opacity: 0.6;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  #tp-settings-fab:hover {
    background: rgba(16, 185, 129, 0.95);
    color: #fff;
    transform: scale(1.08);
    opacity: 1;
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.45);
  }
  #tp-settings-fab:focus-visible {
    opacity: 1;
    outline: 2px solid var(--tp-focus);
    outline-offset: 2px;
  }
  #tp-settings-fab svg { width: 24px; height: 24px; }
  dialog#tp-settings-dialog {
    box-sizing: border-box;
    width: 92%;
    max-width: 520px;
    max-height: 85vh;
    background: rgba(255, 255, 255, 0.97);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--tp-line-soft);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border-radius: 16px;
    color: var(--tp-txt);
    padding: 24px;
    margin: auto;
  }
  dialog#tp-settings-dialog::backdrop { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  dialog#tp-settings-dialog h3 {
    margin: 0 0 18px;
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(to right, var(--tp-acc-txt), var(--tp-acc-deep));
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
  .tp-settings-group label { font-size: 13px; font-weight: 600; color: var(--tp-mut); }
  #tp-section-unified-suite { display: flex; flex-direction: column; gap: 12px; }
  #tp-section-unified-suite label[title], #tp-section-unified-suite button[title] { cursor: help; }
  .tp-section-card { background: rgba(255, 255, 255, 0.65); border: 1px solid var(--tp-line-soft); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .tp-section-card.tp-flash { border-color: var(--tp-blue-soft); box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.45); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
  .tp-section-card .tp-settings-group { margin-bottom: 10px; }
  .tp-section-header { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  .tp-section-display { border-color: rgba(16, 185, 129, 0.35); }
  .tp-section-display .tp-section-header { color: var(--tp-acc-txt); }
  .tp-section-deals { border-color: rgba(139, 92, 246, 0.35); }
  .tp-section-deals .tp-section-header { color: var(--tp-acc2); }
  .tp-section-alarm { border-color: rgba(59, 130, 246, 0.35); }
  .tp-section-alarm .tp-section-header { color: var(--tp-blue-soft); }
  .tp-section-discord { border-color: rgba(56, 189, 248, 0.35); }
  .tp-section-discord .tp-section-header { color: var(--tp-sky); }
  .tp-section-data .tp-section-header { color: var(--tp-dim); }
  .tp-field-dark { width: 100%; background: var(--tp-bg); color: var(--tp-txt); border: 1px solid var(--tp-line-soft); border-radius: var(--tp-r-sm); padding: 6px 10px; font-size: var(--tp-fs-md); margin-top: 4px; box-sizing: border-box; }
  select.tp-field-dark { font-size: var(--tp-fs-lg); }
  .tp-field-hint { display: block; margin-top: 4px; font-size: var(--tp-fs-sm); opacity: 0.85; }
  .tp-btn-row { display: flex; flex-direction: row; gap: 8px; }
  .tp-btn-row .tp-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; }
  #tp-discord-layout-preview { white-space: pre-wrap !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
  #tp-discord-layout-preview .tp-md-lg { font-size: 16px !important; font-weight: 800 !important; }
  #tp-discord-layout-preview .tp-md-md { font-size: 14px !important; font-weight: 800 !important; }
  #tp-discord-layout-preview .tp-md-sm { font-size: 12px !important; font-weight: 700 !important; }
  #tp-discord-layout-preview .tp-md-link { font-weight: 700 !important; }
  #tp-discord-layout-preview .tp-md-url { opacity: .65 !important; font-size: 11px !important; }
  #tp-import-config-file { display: none; }
  .tp-cache-row { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
  .tp-cache-row #tp-cache-stats-label { font-size: var(--tp-fs-md); opacity: 0.85; }
  .tp-cache-row #tp-cache-clear-btn { padding: 4px 10px; font-size: var(--tp-fs-md); }
  .tp-segmented-control {
    display: flex;
    background: rgba(255,255,255,0.7);
    border-radius: var(--tp-r-md);
    padding: 2px;
    border: 1px solid var(--tp-line-soft);
  }
  .tp-segmented-control label {
    flex: 1;
    text-align: center;
    padding: 7px 10px;
    cursor: pointer;
    font-size: var(--tp-fs-sm);
    font-weight: 600;
    color: var(--tp-mut);
    border-radius: var(--tp-r-sm);
    transition: all 0.2s ease;
  }
  .tp-segmented-control input[type="radio"] { display: none; }
  .tp-segmented-control label:hover { color: var(--tp-txt); }
  .tp-segmented-control input[type="radio"]:checked + label {
    background: var(--tp-acc);
    color: #fff;
  }
  .tp-segmented-control-blue input[type="radio"]:checked + label { background: var(--tp-blue) !important; }
  .tp-range-container { display: flex; align-items: center; gap: 12px; }
  .tp-range-container input[type="range"] { flex: 1; accent-color: var(--tp-acc); }
  .tp-range-container.tp-blue input[type="range"] { accent-color: var(--tp-blue); }
  .tp-range-container.tp-rose input[type="range"] { accent-color: var(--tp-rose); }
  .tp-range-container input[type="number"] {
    width: 60px;
    padding: 4px 8px;
    background: rgba(255,255,255,0.75);
    border: 1px solid var(--tp-line-soft);
    border-radius: var(--tp-r-sm);
    color: var(--tp-txt);
    font-size: var(--tp-fs-md);
    text-align: center;
  }
  .tp-textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 70px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.75);
    border: 1px solid var(--tp-line-soft);
    border-radius: var(--tp-r-md);
    color: var(--tp-txt);
    font: inherit;
    font-size: var(--tp-fs-md);
  }
  .tp-switch-container { display: flex; align-items: center; justify-content: space-between; }
  .tp-switch-label { display: flex; flex-direction: column; gap: 2px; }
  .tp-switch-desc { font-size: var(--tp-fs-sm); color: var(--tp-dim); }
  .tp-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
  .tp-switch input { opacity: 0; width: 0; height: 0; }
  .tp-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: rgba(15,23,42,0.12);
    border-radius: 24px;
    border: 1px solid var(--tp-line-soft);
    transition: .3s;
  }
  .tp-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: var(--tp-mut);
    border-radius: 50%;
    transition: .3s;
  }
  .tp-switch input:checked + .tp-slider { background-color: var(--tp-acc); }
  .tp-switch.tp-blue input:checked + .tp-slider { background-color: var(--tp-blue); }
  .tp-switch.tp-rose input:checked + .tp-slider { background-color: var(--tp-rose); }
  .tp-switch.tp-purple input:checked + .tp-slider { background-color: var(--tp-acc2); }
  .tp-switch input:checked + .tp-slider:before { transform: translateX(20px); background-color: #fff; }
  .tp-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(15,23,42,0.08);
  }
  .tp-btn {
    padding: 8px 16px;
    border-radius: var(--tp-r-md);
    font-size: var(--tp-fs-lg);
    font-weight: 600;
    cursor: pointer;
    border: none;
  }
  .tp-btn-secondary { background: rgba(15,23,42,0.06); color: var(--tp-mut); }
  .tp-btn-secondary:hover { background: rgba(15,23,42,0.10); color: var(--tp-txt); }
  .tp-btn-primary {
    background: var(--tp-grad-acc);
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
    background: rgba(255,255,255,0.97);
    border: 1px solid rgba(56,189,248,0.3);
    color: var(--tp-txt);
    padding: 9px 14px;
    border-radius: var(--tp-r-md);
    font-size: var(--tp-fs-md);
    font-weight: 600;
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 10px;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .tp-toast.fade-out { opacity: 0; transform: translateY(6px); }
  .tp-btn:focus-visible, .tp-field-dark:focus-visible,
  .tp-switch input:focus-visible + .tp-slider,
  .tp-segmented-control input:focus-visible + label { outline: 2px solid var(--tp-focus) !important; outline-offset: 2px !important; }
  @media (prefers-reduced-motion: reduce) {
    #tp-settings-fab, .tp-switch .tp-slider, .tp-switch .tp-slider:before, .tp-segmented-control label, .tp-toast { transition: none !important; }
  }
  @media (prefers-contrast: more) {
    .tp-switch-desc, .tp-section-header, .tp-cache-row #tp-cache-stats-label { opacity: 1 !important; }
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
  // Canonical discount/markup shapes: every call site already checks direction,
  // so no internal guards. Keep `|| 0` fallbacks at call sites.
  const pctDrop = (base, price) => Math.round(((base - price) / base) * 100);
  const pctRise = (base, price) => Math.round(((price - base) / base) * 100);

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

  function sanitizeTimeSeries(points, band = CONFIG.OUTLIER_DEVIATION_BAND, maxGlitchHours = CONFIG.OUTLIER_MAX_GLITCH_HOURS) {
    if (!(band > 0 && band < 1)) band = 0.60;
    if (!Number.isFinite(maxGlitchHours) || maxGlitchHours <= 0) maxGlitchHours = 48;
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
      // Symmetric glitch band: a point more than `band` off the median is a feed
      // glitch iff it is brief (< maxGlitchHours) with normal neighbours on both
      // sides; a sustained level shifts the regime and is kept. Edges need only
      // the single adjacent neighbour (no duration context).
      const dev = Math.abs(price - rawMedian) / rawMedian;
      if (dev <= band) {
        cleanPoints.push(sorted[i]);
        continue;
      }

      const isNormal = p => Math.abs(p - rawMedian) / rawMedian <= band;
      let isGlitch = false;
      if (i > 0 && i < n - 1) {
        const nextTs = sorted[i + 1][0];
        const durationHours = (nextTs && ts && nextTs > ts) ? (nextTs - ts) / (3600 * 1000) : 24;
        if (durationHours < maxGlitchHours && isNormal(sorted[i - 1][1]) && isNormal(sorted[i + 1][1])) {
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

  function analyzePriceTimeSeries(series, currentPrice = null, horizonOverride = null) {
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

    const horizonDays = typeof horizonOverride === 'number'
      ? horizonOverride
      : (typeof CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS === 'number'
        ? CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS
        : 365);
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
      ? pctDrop(previousLow, curr)
      : 0;

    const realDiscountVsMedian = (medianPrice > curr)
      ? pctDrop(medianPrice, curr)
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
    // Minimum data points in Preishistorie (configurable, default 5), and >2% variance across history
    const pointsCount = stats.dataPointCount ?? (Array.isArray(stats.timeSeries) ? stats.timeSeries.length : (stats.timeSeries ? 0 : 5));
    const minPoints = clampMinPoints(CONFIG.BESTPREISE_MIN_POINTS);
    if (pointsCount < minPoints) return null;
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
      ? pctDrop(stats.medianPrice, cardPrice)
      : (stats.realDiscountVsMedian || 0);

    const prevLow = liveRec.previousLow;
    const dRecord = (isNewRecord && prevLow && prevLow > cardPrice)
      ? pctDrop(prevLow, cardPrice)
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
      markup: pctRise(stats.tiefstpreis, cardPrice)
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
   * Vortief-Abstand: rounded % drop vs the previous low, for verified
   * at-low/new-low cards WITHOUT a blend (thin history, no median). Single
   * source for the fallback ribbon, the mode edge-heat and the mode sort key —
   * all three consume this number so they can never disagree. 0 when there is
   * no previous low to measure against.
   */
  function vortiefDropPct(cardPrice, stats) {
    const display = getDisplayDelta(cardPrice, stats);
    if (display.kind === 'new-low') return display.dRecord || 0;
    if (display.kind === 'at-low' && display.prevLow > cardPrice) {
      return pctDrop(display.prevLow, cardPrice);
    }
    return 0;
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
      return stats.horizonDays === 365 ? '1J' : `${stats.horizonDays}T`;
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
   * - verified but unqualified (thin/flat history, no dealData) -> null in
   *   browse (gray; ribbon number only), Vortief-Abstand edge-heat in the mode
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
      // Unqualified history: no blend to show. In the mode the Vortief-Abstand
      // still heats — edge-feathered by the renderer (kind 'vortief'), so the
      // fallback never passes as a blend. Browse stays gray; the ribbon number
      // is the whole signal there.
      if (!dealData) {
        if (mode === 'bestpreise' && CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false) {
          const vortief = vortiefDropPct(cardPrice, stats);
          if (vortief >= HEAT_NEUTRAL_DEADBAND_PCT) return { value: -vortief, provisional: false, pct: vortief, kind: 'vortief' };
        }
        return { value: null, provisional: false, pct: 0, kind: 'none' };
      }
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
  const DEALER_CACHE_PREFIX = 'tp_dealer_v1_';
  const SHARED_CACHE_PREFIX = 'tp_shared_v1_';
  // Janitor-Funktionen (prune/count/clear) betreuen alle Prefixe: Händlerdaten
  // und Geteilt-Markierungen sind abgeleitete Produktdaten mit derselben TTL
  // wie die Preishistorie.
  const CACHE_PREFIXES = [STATS_CACHE_PREFIX, DEALER_CACHE_PREFIX, SHARED_CACHE_PREFIX];
  const MAX_MEMORY_CACHE_ITEMS = 500;

  function lruSet(map, key, val, cap = MAX_MEMORY_CACHE_ITEMS) {
    map.delete(key);
    map.set(key, val);
    if (map.size > cap) map.delete(map.keys().next().value);
  }

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
        if (key && CACHE_PREFIXES.some(p => key.startsWith(p))) {
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
            lruSet(memoryCache, productId, memData);
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
        lruSet(memoryCache, productId, parsed);
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

    lruSet(memoryCache, productId, payload);

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
          // Geteilt-Markierungen sind keine gecachten Preise: Label zählt nur Historie + Händler.
          if (key && [STATS_CACHE_PREFIX, DEALER_CACHE_PREFIX].some(p => key.startsWith(p))) {
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
          if (key && CACHE_PREFIXES.some(p => key.startsWith(p))) {
            keysToRemove.push(key);
          }
        }
        count = keysToRemove.length;
        keysToRemove.forEach(k => storage.removeItem(k));
      }
    } catch (e) {}
    return count;
  }

  // Horizon-Wechsel ohne Netz: jede gecachte Analyse trägt ihre Rohserie
  // (timeSeries) — der Median wird lokal für den neuen Horizont neu gerechnet.
  // `time` bleibt unangetastet, Einträge bleiben fresh, kein Refetch.
  // Serienlose Einträge (Fallback/negativ) werden übersprungen.
  function recomputeCachedMedians(horizonDays, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    let count = 0;
    const rewrite = entry => {
      if (!entry || !Array.isArray(entry.timeSeries)) return null;
      const fresh = analyzePriceTimeSeries(entry.timeSeries, null, horizonDays);
      if (!fresh) return null;
      return { ...entry, ...fresh };
    };
    const seen = new Set();
    for (const [productId, entry] of memoryCache) {
      const next = rewrite(entry);
      if (!next) continue;
      memoryCache.set(productId, next);
      seen.add(productId);
      try { storage?.setItem(STATS_CACHE_PREFIX + productId, JSON.stringify(next)); } catch (e) {}
      count++;
    }
    try {
      if (storage) {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (!key || !key.startsWith(STATS_CACHE_PREFIX)) continue;
          const productId = key.slice(STATS_CACHE_PREFIX.length);
          if (seen.has(productId)) continue;
          let entry = null;
          try { entry = JSON.parse(storage.getItem(key) || 'null'); } catch (e) { continue; }
          const next = rewrite(entry);
          if (!next) continue;
          memoryCache.set(productId, next);
          try { storage.setItem(key, JSON.stringify(next)); } catch (e) {}
          count++;
        }
      }
    } catch (e) {}
    return count;
  }

  // Händlername + Angebotslink pro Produkt, je Preisbasis (p/s-Slot): wird beim
  // 🏬-Klick zusammen mit dem Produktseiten-Fetch geschrieben und überlebt so
  // Reloads — gleiche TTL wie die Preishistorie (REAL_DEAL_CACHE_HOURS).
  function getCachedDealer(productId, useShipping, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!productId) return null;
    try {
      const raw = storage?.getItem(DEALER_CACHE_PREFIX + productId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!isCacheEntryFresh(parsed)) return null;
      const entry = useShipping ? parsed?.s : parsed?.p;
      if (!entry?.dealer) return null;
      return { dealer: entry.dealer, url: entry.url || '' };
    } catch (e) {}
    return null;
  }

  function setCachedDealer(productId, useShipping, dealer, url, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!productId || !dealer) return;
    try {
      let prev = {};
      try { prev = JSON.parse(storage?.getItem(DEALER_CACHE_PREFIX + productId) || '{}'); } catch (e) { /* korrupt: neu schreiben */ }
      const next = { ...prev, time: Date.now(), [useShipping ? 's' : 'p']: { dealer, url: url || '' } };
      storage?.setItem(DEALER_CACHE_PREFIX + productId, JSON.stringify(next));
    } catch (e) {}
  }

  // Geteilt-Markierung pro Produkt+Preis: pid + Preis-Cents als Identität, damit
  // eine Preisänderung die Markierung löst und der Deal neu scharf wird.
  // TTL via isCacheEntryFresh (REAL_DEAL_CACHE_HOURS); clear/prune laufen über
  // CACHE_PREFIXES mit — kein eigener Lifecycle.
  function getSharedDeal(productId, priceCents, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!productId) return false;
    try {
      const raw = storage?.getItem(SHARED_CACHE_PREFIX + productId);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return isCacheEntryFresh(parsed) && parsed.priceCents === priceCents;
    } catch (e) {}
    return false;
  }

  function setSharedDeal(productId, priceCents, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!productId || priceCents == null) return;
    try {
      storage?.setItem(SHARED_CACHE_PREFIX + productId, JSON.stringify({ priceCents, time: Date.now() }));
    } catch (e) {}
  }

  // ─── MODULE: src/ui/mini-toggle.js ──────────────────────────────────────────
  /**
   * Shared mini-toggle sync (single dialect for checkbox toggles with ON/OFF
   * caption and dimming of the tools they own). Imported by toolbar.js and
   * state/config.js — lives here because toolbar imports config (cycle).
   */

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

  function horizonText(days, style = 'short') {
    const d = (typeof days !== 'number' || isNaN(days) || days < 0) ? 365 : days;
    if (style === 'title') {
      if (d === 0) return 'Median-Berechnungszeitraum: gesamte Historie (Lifetime)';
      if (d === 365) return 'Median-Berechnungszeitraum: 1 Jahr (365 Tage) [Empfohlen]';
      return `Median-Berechnungszeitraum: ${d} Tage`;
    }
    if (d === 0) return 'Lifetime';
    if (d === 365) return '1J';
    return `${d}T`;
  }

  const DEFAULTS = Object.freeze({
    FILTER_NEG_ENABLED: false,
    FILTER_MIN_ENABLED: false,
    FILTER_NEG_MODE: 'dim',
    FILTER_MIN_MODE: 'dim',
    HIDE_UNCHECKED_MODE: 'dim',
    VORTIEF_MODE: 'dim',
    DEALER_MODE: 'dim',
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
    BESTPREISE_INCLUDE_VORTIEF: true,
    BESTPREISE_WEIGHT_RECORD: 0.50,
    BESTPREISE_MIN_POINTS: 5,
    BESTPREISE_MEDIAN_HORIZON_DAYS: 365,
    OUTLIER_REJECTION_ENABLED: true,
    OUTLIER_DEVIATION_BAND: 0.60,
    OUTLIER_MAX_GLITCH_HOURS: 48,
    ENABLE_SPARKLINES: true,
    DEALER_AUTOFETCH: false,
    NEGATIVE_TERMS: '',
    DISCORD_WEBHOOK_URL: '',
    DISCORD_SUPPRESS_DEALER_EMBED: true,
    DISCORD_SUPPRESS_PRODUCT_EMBED: true,
    // mirror of DEFAULT_LAYOUT in features/share-discord.js (drift-checked in share-discord.test.js)
    DISCORD_LAYOUT: `## {title}
  # {price}
  # {dealer} +{offers}
  {spark}
  {prevlow}
  {median}
  {link}`,
    MIN_OFFERS: 0,
    SORT_BY_OFFERS: 'none',
    ALARM_ENABLED: true,
    ALARM_TARGET_PERCENT: 0.60,
    ALARM_DURATION_DAYS: '730',
    ALARM_AUTO_SUBMIT: true,
    OBSERVER_DEBOUNCE_MS: 200,
    SHOW_ADVANCED: false,
    DEBUG: false
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

  // One-time migration: DEBUG default flipped true→false, but stored true
  // persists via _getValue precedence. No settings UI ever wrote DEBUG
  // (modal import/export skips it), so stored true came only from console —
  // silence it once. Marker keeps this a single read per load afterwards.
  function migrateLegacyDebug() {
    if (_getValue('MIGRATED_DEBUG_OFF', false)) return false;
    _setValue('DEBUG', false);
    _setValue('MIGRATED_DEBUG_OFF', true);
    return true;
  }
  // One-time migration: filter-mode defaults flipped hide→dim. Stored 'hide'
  // (silent default or explicit choice) moves to 'dim' once; the toggle stays
  // one click away. Marker keeps this a single pass per profile afterwards.
  function migrateHideToDimDefaults() {
    if (_getValue('MIGRATED_DIM_DEFAULT', false)) return false;
    for (const k of ['FILTER_NEG_MODE', 'FILTER_MIN_MODE', 'HIDE_UNCHECKED_MODE', 'VORTIEF_MODE', 'DEALER_MODE']) {
      if (_getValue(k, DEFAULTS[k]) !== 'dim') _setValue(k, 'dim');
    }
    _setValue('MIGRATED_DIM_DEFAULT', true);
    return true;
  }
  migrateHideToDimDefaults();
  migrateLegacyDebug();
  // One-time migration: MODE (highlight/dim/hide) deleted — Filtern removes,
  // Ansicht paints. Clears the stale stored key once so the mode toast fires
  // exactly once per user (marker-guarded, silent afterwards). The 'MODE'
  // literals below are that intentional cleanup — exempt from the MODE-zero sweep.
  function migrateFilterSplit() {
    if (_getValue('MIGRATED_FILTER_SPLIT', false)) return { hadMode: false, modeWasActive: false };
    let storedMode;
    let hadMode = false;
    if (typeof GM_getValue !== 'undefined') {
      try {
        storedMode = GM_getValue('MODE');
        if (typeof storedMode !== 'undefined') hadMode = true;
      } catch { /* ignore */ }
    }
    if (!hadMode) {
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('tp_suite_v2_MODE') !== null) hadMode = true;
      } catch { /* ignore */ }
    }
    const modeWasActive = _getValue('BESTPREISE_MODE_ACTIVE', false) === true;
    try {
      if (typeof GM_deleteValue !== 'undefined') GM_deleteValue('MODE');
    } catch { /* ignore */ }
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('tp_suite_v2_MODE');
    } catch { /* ignore */ }
    _setValue('MIGRATED_FILTER_SPLIT', true);
    return { hadMode, modeWasActive };
  }
  // Shared clamps: single source for the min-points (1–100 data points) and
  // heatmap-intensity (0.2–1.0) bounds previously copy-pasted across modules.
  const clampMinPoints = v => {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return 5;
    return Math.max(1, Math.min(100, Math.round(n)));
  };
  // Stepped min-points scale: fine 1–5, then tens to 100. Sliders bind the
  // index (0–14), number inputs + stored value stay free 1–100.
  const MIN_POINTS_STEPS = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const minPointsToIndex = v => {
    const n = clampMinPoints(v);
    let best = 0;
    for (let i = 1; i < MIN_POINTS_STEPS.length; i++) {
      if (Math.abs(MIN_POINTS_STEPS[i] - n) < Math.abs(MIN_POINTS_STEPS[best] - n)) best = i;
    }
    return best;
  };
  const minPointsFromIndex = i => MIN_POINTS_STEPS[Math.max(0, Math.min(MIN_POINTS_STEPS.length - 1, parseInt(i, 10) || 0))];
  function paintMinPoints(raw = CONFIG.BESTPREISE_MIN_POINTS, shadowRoot) {
    const num = clampMinPoints(raw);
    const idx = minPointsToIndex(num);
    const shadow = shadowRoot ?? uiShadowRoot ?? (typeof document !== 'undefined' ? document.getElementById('tp-root')?.shadowRoot : null);
    const range = shadow?.getElementById('tp-bestpreise-minpoints-range');
    if (range) range.value = idx;
    const valEl = shadow?.getElementById('tp-bestpreise-minpoints-val');
    if (valEl) valEl.value = num;
    if (typeof document !== 'undefined') {
      const barRange = document.getElementById('tp-bar-minpoints-range');
      if (barRange && document.activeElement !== barRange) barRange.value = idx;
      const barLabel = document.getElementById('tp-bar-minpoints-label');
      if (barLabel) barLabel.textContent = `📊 ${num} Pkt`;
    }
  }
  const clampIntensity01 = v => Math.max(0.2, Math.min(1.0, v));

  // One-time migration: single DISCORD_SUPPRESS_EMBEDS key split into dealer +
  // product keys. Stored old value seeds both new keys once; stale key unread.
  const legacySuppressEmbeds = _getValue('DISCORD_SUPPRESS_EMBEDS', null);
  const _layoutRaw = _getValue('DISCORD_LAYOUT', DEFAULTS.DISCORD_LAYOUT);
  // Filter hide/dim modes: only 'dim' opts into dimming, everything else hides.
  const _modeValue = k => _getValue(k, DEFAULTS[k]) === 'dim' ? 'dim' : 'hide';


  const CONFIG = {
    FILTER_NEG_ENABLED: _getValue('FILTER_NEG_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_NEG_ENABLED)),
    FILTER_MIN_ENABLED: _getValue('FILTER_MIN_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_MIN_ENABLED)),
    FILTER_NEG_MODE: _modeValue('FILTER_NEG_MODE'),
    FILTER_MIN_MODE: _modeValue('FILTER_MIN_MODE'),
    HIDE_UNCHECKED_MODE: _modeValue('HIDE_UNCHECKED_MODE'),
    VORTIEF_MODE: _modeValue('VORTIEF_MODE'),
    DEALER_MODE: _modeValue('DEALER_MODE'),
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
    BESTPREISE_INCLUDE_VORTIEF: _getValue('BESTPREISE_INCLUDE_VORTIEF', DEFAULTS.BESTPREISE_INCLUDE_VORTIEF),
    BESTPREISE_WEIGHT_RECORD: parseFloat(_getValue('BESTPREISE_WEIGHT_RECORD', DEFAULTS.BESTPREISE_WEIGHT_RECORD)),
    BESTPREISE_MIN_POINTS: parseInt(_getValue('BESTPREISE_MIN_POINTS', DEFAULTS.BESTPREISE_MIN_POINTS)),
    BESTPREISE_MEDIAN_HORIZON_DAYS: parseInt(_getValue('BESTPREISE_MEDIAN_HORIZON_DAYS', DEFAULTS.BESTPREISE_MEDIAN_HORIZON_DAYS)),
    OUTLIER_REJECTION_ENABLED: _getValue('OUTLIER_REJECTION_ENABLED', DEFAULTS.OUTLIER_REJECTION_ENABLED),
    OUTLIER_DEVIATION_BAND: parseFloat(_getValue('OUTLIER_DEVIATION_BAND', DEFAULTS.OUTLIER_DEVIATION_BAND)),
    OUTLIER_MAX_GLITCH_HOURS: parseInt(_getValue('OUTLIER_MAX_GLITCH_HOURS', DEFAULTS.OUTLIER_MAX_GLITCH_HOURS)),
    ENABLE_SPARKLINES: _getValue('ENABLE_SPARKLINES', DEFAULTS.ENABLE_SPARKLINES),
    DEALER_AUTOFETCH: _getValue('DEALER_AUTOFETCH', DEFAULTS.DEALER_AUTOFETCH),
    NEGATIVE_TERMS: _getValue('NEGATIVE_TERMS', DEFAULTS.NEGATIVE_TERMS),
    DISCORD_WEBHOOK_URL: _getValue('DISCORD_WEBHOOK_URL', DEFAULTS.DISCORD_WEBHOOK_URL),
    DISCORD_SUPPRESS_DEALER_EMBED: _getValue('DISCORD_SUPPRESS_DEALER_EMBED', legacySuppressEmbeds ?? DEFAULTS.DISCORD_SUPPRESS_DEALER_EMBED),
    DISCORD_SUPPRESS_PRODUCT_EMBED: _getValue('DISCORD_SUPPRESS_PRODUCT_EMBED', legacySuppressEmbeds ?? DEFAULTS.DISCORD_SUPPRESS_PRODUCT_EMBED),
    DISCORD_LAYOUT: (typeof _layoutRaw === 'string' && _layoutRaw.trim()) ? _layoutRaw : DEFAULTS.DISCORD_LAYOUT,
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
  // Corrupt storage must never silently break fills: clamp percent to the
  // modal save bounds, fall back to defaults on NaN/unknown durations.
  if (!Number.isFinite(CONFIG.ALARM_TARGET_PERCENT)) CONFIG.ALARM_TARGET_PERCENT = DEFAULTS.ALARM_TARGET_PERCENT;
  else CONFIG.ALARM_TARGET_PERCENT = Math.min(0.99, Math.max(0.05, CONFIG.ALARM_TARGET_PERCENT));
  if (!['90', '180', '365', '730'].includes(CONFIG.ALARM_DURATION_DAYS)) CONFIG.ALARM_DURATION_DAYS = '730';
  if (!Number.isFinite(CONFIG.OUTLIER_DEVIATION_BAND)) CONFIG.OUTLIER_DEVIATION_BAND = DEFAULTS.OUTLIER_DEVIATION_BAND;
  else CONFIG.OUTLIER_DEVIATION_BAND = Math.min(0.90, Math.max(0.20, CONFIG.OUTLIER_DEVIATION_BAND));
  if (!Number.isFinite(CONFIG.OUTLIER_MAX_GLITCH_HOURS)) CONFIG.OUTLIER_MAX_GLITCH_HOURS = DEFAULTS.OUTLIER_MAX_GLITCH_HOURS;
  else CONFIG.OUTLIER_MAX_GLITCH_HOURS = Math.min(168, Math.max(12, CONFIG.OUTLIER_MAX_GLITCH_HOURS));

  const saveConfigKey = (key, val) => {
    CONFIG[key] = val;
    _setValue(key, val);
  };
  // Bell-decor repaint hook: price-alarm.js registers refreshAlarmBellDecor
  // here (a static import would cycle config ← price-alarm; the concat-IIFE
  // bundler also drops dynamic import()). syncUiControl notifies on alarm keys.
  let alarmConfigListener = null;
  function setAlarmConfigListener(fn) {
    alarmConfigListener = typeof fn === 'function' ? fn : null;
  }
  const notifyAlarmConfig = () => {
    try { alarmConfigListener?.(); } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] alarm repaint error', err);
    }
  };


  function updateBodyClasses() {
    if (typeof document === 'undefined' || !document.body) return;
    document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
  }

  function syncUiControl(key, val) {
    // 1. Sync Settings Modal (Shadow DOM) if open/exists
    const shadow = uiShadowRoot || (typeof document !== 'undefined' ? document.getElementById('tp-root')?.shadowRoot : null);
    if (shadow) {
      try {
        switch (key) {
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
          case 'BESTPREISE_MIN_POINTS': {
            paintMinPoints(val, shadow);
            break;
          }
          case 'BESTPREISE_MEDIAN_HORIZON_DAYS': {
            const stored = val ?? 365;
            const horizonRange = shadow.getElementById('tp-bestpreise-horizon-range');
            if (horizonRange) horizonRange.value = stored === 0 ? 760 : stored;
            const horizonVal = shadow.getElementById('tp-bestpreise-horizon-val');
            if (horizonVal) horizonVal.value = stored;
            const horizonDesc = shadow.getElementById('tp-bestpreise-horizon-desc');
            if (horizonDesc) horizonDesc.textContent = `Ø-Vergleich: ${horizonText(stored)} — Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis`;
            // Toolbar range mirrors the modal control (skip while interacting).
            if (typeof document !== 'undefined') {
              const barRange = document.getElementById('tp-bar-horizon-range');
              if (barRange && document.activeElement !== barRange) {
                barRange.value = stored === 0 ? 760 : stored;
                const barLabel = document.getElementById('tp-bar-horizon-label');
                if (barLabel) {
                  barLabel.textContent = horizonText(stored);
                  barLabel.title = horizonText(stored, 'title');
                }
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
          case 'DEALER_AUTOFETCH': {
            const toggle = shadow.getElementById('tp-dealer-autofetch-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'DISCORD_SUPPRESS_DEALER_EMBED': {
            const toggle = shadow.getElementById('tp-discord-dealer-embed-toggle');
            if (toggle) toggle.checked = val === false;
            break;
          }
          case 'DISCORD_SUPPRESS_PRODUCT_EMBED': {
            const toggle = shadow.getElementById('tp-discord-product-embed-toggle');
            if (toggle) toggle.checked = val === false;
            break;
          }
          case 'ALARM_ENABLED': {
            const toggle = shadow.getElementById('tp-alarm-enabled-toggle');
            if (toggle) toggle.checked = val !== false;
            notifyAlarmConfig();
            break;
          }
          case 'ALARM_TARGET_PERCENT': {
            const pct = Math.round((Number.isFinite(val) ? val : 0.60) * 100);
            const range = shadow.getElementById('tp-alarm-target-range');
            const num = shadow.getElementById('tp-alarm-target-val');
            if (range) range.value = pct;
            if (num) num.value = pct;
            notifyAlarmConfig();
            break;
          }
          case 'ALARM_DURATION_DAYS': {
            const radio = shadow.querySelector(`input[name="tp-alarm-duration"][value="${val}"]`);
            if (radio) radio.checked = true;
            notifyAlarmConfig();
            break;
          }
          case 'ALARM_AUTO_SUBMIT': {
            const toggle = shadow.getElementById('tp-alarm-autosubmit-toggle');
            if (toggle) toggle.checked = val !== false;
            notifyAlarmConfig();
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
              if (heatBtn) {
                heatBtn.classList.toggle('tp-active', val !== false);
                heatBtn.setAttribute('aria-pressed', String(val !== false));
              }
              break;
            }
            case 'BESTPREISE_MODE_ACTIVE': {
              const bpBtn = bar.querySelector('#tp-bar-bestpreise-btn');
              if (bpBtn) bpBtn.classList.toggle('tp-bestpreise-active', val === true);
              bar.classList.toggle('tp-bestpreise-bar', val === true);
              break;
            }
            case 'BESTPREISE_HIDE_UNCHECKED': {
              const toggle = bar.querySelector('#tp-toggle-unchecked');
              if (toggle) toggle.checked = val === true;
              break;
            }
            case 'BESTPREISE_INCLUDE_VORTIEF': {
              const toggle = bar.querySelector('#tp-toggle-vortief');
              if (toggle) toggle.checked = val === false;
              break;
            }
            case 'OUTLIER_REJECTION_ENABLED': {
              syncMiniToggle(bar.querySelector('#tp-bar-outlier-toggle'), val !== false, 'Ausreißer-Filter');
              const dim = val === false;
              for (const id of ['tp-bar-outlier-band-wrapper', 'tp-bar-outlier-hours-wrapper']) {
                const wrap = bar.querySelector('#' + id);
                if (wrap) wrap.classList.toggle('tp-tool-dim', dim);
              }
              break;
            }
            case 'OUTLIER_DEVIATION_BAND': {
              const pct = Math.min(90, Math.max(20, Math.round((val ?? 0.6) * 100)));
              const bandRange = bar.querySelector('#tp-bar-outlier-band-range');
              if (bandRange && document.activeElement !== bandRange) bandRange.value = pct;
              const bandLabel = bar.querySelector('#tp-bar-outlier-band-label');
              if (bandLabel) bandLabel.textContent = `±${pct} %`;
              break;
            }
            case 'OUTLIER_MAX_GLITCH_HOURS': {
              const hrs = Math.min(168, Math.max(12, parseInt(val ?? 48, 10) || 48));
              const hoursRange = bar.querySelector('#tp-bar-outlier-hours-range');
              if (hoursRange && document.activeElement !== hoursRange) hoursRange.value = hrs;
              const hoursLabel = bar.querySelector('#tp-bar-outlier-hours-label');
              if (hoursLabel) hoursLabel.textContent = `${hrs} h`;
              break;
            }
            case 'FILTER_NEG_MODE':
            case 'FILTER_MIN_MODE':
            case 'HIDE_UNCHECKED_MODE':
            case 'VORTIEF_MODE':
            case 'DEALER_MODE': {
              const mode = val === 'dim' ? 'dim' : 'hide';
              bar.querySelectorAll(`[data-mode-key="${key}"]`).forEach(btn => {
                btn.classList.toggle('tp-active', true);
                btn.textContent = mode === 'dim' ? 'Dimmen' : 'Verbergen';
              });
              break;
            }
            case 'FILTER_NEG_ENABLED': {
              const toggle = bar.querySelector('#tp-toggle-neg');
              if (toggle) {
                if (toggle.tagName === 'INPUT') {
                  syncMiniToggle(toggle, !!val, 'Negativ-Filter (Text)');
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
                  syncMiniToggle(toggle, !!val, 'Min-Angebote-Filter');
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

  // Alarm-only changes repaint just the bell (via syncUiControl) — a full
  // processListings() re-render would be wasted work on every settings save.
  const ALARM_ONLY_KEYS = new Set(['ALARM_ENABLED', 'ALARM_TARGET_PERCENT', 'ALARM_DURATION_DAYS', 'ALARM_AUTO_SUBMIT']);
  function updateConfig(key, val, options = {}) {
    saveConfigKey(key, val);
    if (!options.skipUiSync) {
      syncUiControl(key, val);
    }
    if (key === 'DIM_OPACITY') {
      updateBodyClasses();
    }
    if (!options.skipRender && !ALARM_ONLY_KEYS.has(key) && typeof processListings === 'function') {
      processListings();
    }
  }

  function updateConfigs(entries, options = {}) {
    for (const [k, v] of Object.entries(entries)) {
      updateConfig(k, v, { ...options, skipRender: true });
    }
    const needsRender = !options.skipRender && Object.keys(entries).some(k => !ALARM_ONLY_KEYS.has(k));
    if (needsRender && typeof processListings === 'function') {
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
    progress: { completed: 0, total: 0 },
    freshPids: new Set(),
    freshUntil: 0
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
      const match = href.match(/-p(\d+)/i);
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
    { t: 0.50, base: [75, 42, 12],   acc: [170, 62, 10],   border: [251, 115, 36, 0.88] },
    { t: 1.00, base: [98, 14, 32],   acc: [210, 20, 55],   border: [244, 63, 94, 0.95] }
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

  const heatColor = (diff, intensity) => {
    const t = heatT(diff);
    if (t === null) return null;
    return { t, ...heatRamp(t), safeInt: clampIntensity01(intensity) };
  };

  // Fallback (Vortief) signal: subtle OUTER glow, or 'none' below t 0.55 — no
  // background fill, no border. Shallow fallbacks get no glow by design, so a
  // fallback can never pass as a verified blend deal at a glance.
  function getOuterHeatStyle(diffPercent, intensity = 1.0) {
    const c = heatColor(diffPercent, intensity);
    if (!c) return null;
    const { t, acc, safeInt } = c;
    const glow = t >= 0.55 ? `0 4px 18px rgba(${acc.join(',')},${(0.32 * safeInt).toFixed(2)})` : 'none';
    return { glow };
  }
  // Regular (verified blend) signal: prominent INSET wash, no background fill,
  // no border. Inset (never outer): an outer box-shadow paints past the border
  // box and bleeds onto neighboring cards — inset clips at the card's own edge
  // by construction, no per-layout tuning.
  function getInsetHeatStyle(dropPct, intensity = 1.0) {
    const c = heatColor(-Math.abs(dropPct), intensity);
    if (!c) return null;
    const { acc, safeInt } = c;
    return {
      glow: `inset 0 0 30px 10px rgba(${acc.join(',')},${(0.50 * safeInt).toFixed(2)})`
    };
  }

  // Badge reuses the card logic: solid swatch from the same ramp so the badge
  // color always matches the card heat. The provisional flag still yields paler
  // output, but callers now skip heat for unverified cards (tp-is-unverified
  // paints them striped-gray instead). At full intensity verified output is
  // identical to the legacy fixed alphas.
  function getBadgeHeatStyle(diffPercent, provisional = false, intensity = 1.0) {
    const c = heatColor(diffPercent, intensity);
    if (!c) return null;
    const { acc, borderRgb, borderAlpha, safeInt } = c;
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
    // Removal causes are Negativ, Min-Angebote, Händler (set downstream),
    // Ungeprüfte, Fallback-ausgeschlossen. Verified markups are removed nowhere.
    // Ungeprüfte is config-only: it must not depend on scan state, otherwise the
    // first check on a checkless page hides everything as a side effect.
     const kind = cd.displayDelta?.kind;
     const isVortief = !cd.dealScore && (kind === 'at-low' || kind === 'new-low');
     const isVortiefExcluded = CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && isVortief;
    const isUnchecked = CONFIG.BESTPREISE_HIDE_UNCHECKED === true && !cd.stats;
     const isDealerLoser = false;
     const isFiltered = isNeg || isLowOffers || isDealerLoser || isUnchecked || isVortiefExcluded;
     return { isNeg, isLowOffers, isVortiefExcluded, isUnchecked, isDealerLoser, isFiltered };
  }

  function dealerLoserFor(card, activeStores) {
    if (!activeStores || activeStores.length === 0) return false;
    const dealerRows = getCardDealerRows(card);
    if (dealerRows.length === 0) return false;
    let matchedRow = null;
    for (let d = 0; d < dealerRows.length; d++) {
      const item = dealerRows[d];
      if (item.storeName && activeStores.some(store => item.storeName.includes(store) || store.includes(item.storeName))) {
        matchedRow = item.row;
        break;
      }
    }
    if (!matchedRow) return true;
    const priceData = extractCanonicalPrice(card);
    const useShipping = isShippingPriceActive(card);
    const storePriceEl = useShipping
      ? (matchedRow.querySelector('.shippingPrice .Plugin_Price') || matchedRow.querySelector('.productPrice .Plugin_Price'))
      : (matchedRow.querySelector('.productPrice .Plugin_Price') || matchedRow.querySelector('.shippingPrice .Plugin_Price'));
    const storePrice = storePriceEl ? parsePrice(storePriceEl.textContent) : 0;
    const bestPrice = priceData.price > 0 ? priceData.price : (priceData.el ? parsePrice(priceData.el.textContent) : 0);
    if (storePrice > 0 && bestPrice > 0 && storePrice <= bestPrice * (1 + CONFIG.MARGIN_PERCENT / 100)) return false;
    return true;
  }

  function isCardFilteredOut(card, filters = null, opts = null) {
    if (!card) return true;
    const forScan = opts?.forScan === true;
    const causeHit = f => (f.isNeg && CONFIG.FILTER_NEG_MODE !== 'dim')
      || (f.isLowOffers && CONFIG.FILTER_MIN_MODE !== 'dim')
      || (f.isDealerLoser && CONFIG.DEALER_MODE !== 'dim')
      || (forScan ? false : (f.isUnchecked && CONFIG.HIDE_UNCHECKED_MODE !== 'dim'))
      || (f.isVortiefExcluded && CONFIG.VORTIEF_MODE !== 'dim');
    const legacyChecks = () => {
      const tab = card.closest?.('.f_tab');
      if (tab && !tab.classList.contains('selected')) return true;
      if (!forScan) {
        if (card.hidden || card.classList?.contains('d-none') || card.closest?.('.d-none')) return true;
        if (typeof card.checkVisibility === 'function') {
          if (!card.checkVisibility()) return true;
        } else if (card.offsetParent === null && window.getComputedStyle?.(card)?.display === 'none') {
          return true;
        }
      }
      return false;
    };
    if (filters) {
      if (!causeHit(filters)) return legacyChecks();
      return true;
    }
    const f = {
      isNeg: card.classList?.contains('tp-negative-filtered') === true,
      isLowOffers: card.classList?.contains('tp-min-offers-filtered') === true,
      isVortiefExcluded: card.classList?.contains('tp-vortief-excluded') === true,
      isUnchecked: card.classList?.contains('tp-unchecked-hidden') === true,
      isDealerLoser: card.classList?.contains('tp-not-cheapest') === true
        || card.classList?.contains('tp-no-store-offer') === true,
    };
    // ponytail: no page context here; callers with a card list must pass
    // explicit filters built with the real pageHasOffers (feed cards have
    // no offer counts, so assuming true wrongly filters the whole feed).
    const termsList = parseNegativeTerms();
    const offerCount = extractOfferCount(card);
    const pageHasOffers = offerCount > 0 || document.querySelector('.Plugin_DealerRelProdPriceInfo') !== null;
    const recomp = applyCardFilters({ card, offerCount }, termsList, CONFIG.MIN_OFFERS, pageHasOffers);
    f.isNeg = f.isNeg || recomp.isNeg;
    f.isLowOffers = f.isLowOffers || recomp.isLowOffers;
    if (!causeHit(f)) return legacyChecks();
    return true;
  }

  // ─── MODULE: src/ui/sparkline.js ────────────────────────────────────────────
  /**
   * Interactive SVG Sparkline Component
   * Generates lightweight inline SVG sparkline polyline charts from product price history
   * with interactive tooltips. Single neutral color: history samples can be stale
   * relative to the live card price, so trend coloring would mislead.
   */

  function renderSparkline(timeSeries, width, height, opts = {}) {
    if (!timeSeries || !Array.isArray(timeSeries) || timeSeries.length < 2) return null;
    const axes = opts && opts.axes === true;
    const prices = timeSeries.map(p => Array.isArray(p) ? +p[1] : 0).filter(p => p > 0);

    if (prices.length < 2) return null;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.classList.add('tp-sparkline');

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    // ponytail: literal hex here — renderSparklinePng serializes this SVG to a
    // Blob URL, where var() has no page context and would render transparent.
    const strokeColor = '#3b82f6';

    const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleEl.textContent = `Preisverlauf: CHF ${firstPrice.toFixed(2)} → CHF ${lastPrice.toFixed(2)} (Min: ${min.toFixed(2)}, Max: ${max.toFixed(2)})`;
    svg.appendChild(titleEl);

    // Bare mini omits grid/axes only; endpoint dot shared with Discord path.
    const buildPoints = (x0, x1, y0, y1) => prices.map((p, i) => {
      const x = (x0 + (i / (prices.length - 1)) * (x1 - x0)).toFixed(1);
      const y = (y1 - ((p - min) / range) * (y1 - y0)).toFixed(1);
      return `${x},${y}`;
    }).join(' ');

    const line = (x1, y1, x2, y2, opacity) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.setAttribute('x1', String(x1));
      el.setAttribute('y1', String(y1));
      el.setAttribute('x2', String(x2));
      el.setAttribute('y2', String(y2));
      el.setAttribute('stroke', '#334155');
      el.setAttribute('stroke-width', '0.5');
      el.setAttribute('opacity', String(opacity));
      return el;
    };

    const label = (x, y, text, anchor) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      el.setAttribute('x', String(x));
      el.setAttribute('y', String(y));
      el.setAttribute('fill', '#64748b');
      el.setAttribute('font-size', '8.5');
      el.setAttribute('font-family', 'inherit');
      el.setAttribute('text-anchor', anchor);
      el.textContent = text;
      return el;
    };

    const fmtPrice = v => (v >= 100 ? String(Math.round(v)) : v.toFixed(2));

    let points;
    let lastX = 0;
    let lastY = 0;
    if (!axes) {
      const pad = 2.5;
      const usableWidth = width - pad * 2;
      const usableHeight = height - pad * 2;
      points = prices.map((p, i) => {
        const x = (pad + (i / (prices.length - 1)) * usableWidth).toFixed(1);
        const y = (height - pad - ((p - min) / range) * usableHeight).toFixed(1);
        return `${x},${y}`;
      }).join(' ');
    } else {
      const margin = { left: 38, right: 10, top: 6, bottom: 16 };
      const x0 = margin.left;
      const x1 = width - margin.right;
      const y0 = margin.top;
      const y1 = height - margin.bottom;
      points = buildPoints(x0, x1, y0, y1);

      // Y price grid: min / mid / max.
      const mid = (min + max) / 2;
      for (const v of [min, mid, max]) {
        const y = y1 - ((v - min) / range) * (y1 - y0);
        svg.appendChild(line(x0, y, x1, y, 0.8));
        svg.appendChild(label(2, y + 3, `CHF ${fmtPrice(v)}`, 'start'));
      }

      // X time grid from timestamps (ms or s); young listings span < 1 month, so
      // bucket granularity falls back with span: months → weeks → days.
      const tsMs = timeSeries.map(p => {
        const ts = Array.isArray(p) ? +p[0] : NaN;
        if (!Number.isFinite(ts)) return NaN;
        return ts < 1e12 ? ts * 1000 : ts;
      });
      const finiteTs = tsMs.filter(Number.isFinite);
      if (finiteTs.length >= 2) {
        const DAY_MS = 86400000;
        const span = Math.max(...finiteTs) - Math.min(...finiteTs);
        const mode = span >= 60 * DAY_MS ? 'month' : span >= 14 * DAY_MS ? 'week' : 'day';
        const bucketKey = d => mode === 'month'
          ? `${d.getFullYear()}-${d.getMonth()}`
          : mode === 'week'
            ? (() => { const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); return `${mon.getFullYear()}-${mon.getMonth()}-${mon.getDate()}`; })()
            : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const labelFor = date => mode === 'month'
          ? date.toLocaleString('en', { month: 'short' })
          : `${date.getDate()}.${date.getMonth() + 1}`;
        const starts = [];
        let prevKey = null;
        tsMs.forEach((t, i) => {
          if (!Number.isFinite(t)) return;
          const d = new Date(t);
          if (Number.isNaN(d.getTime())) return;
          const key = bucketKey(d);
          if (key !== prevKey) {
            prevKey = key;
            starts.push({ i, date: d });
          }
        });
        if (starts.length >= 2) {
          const maxLabels = 6;
          const step = Math.ceil(starts.length / maxLabels);
          const shown = starts.filter((_, k) => k % step === 0);
          for (const { i, date } of shown) {
            if (i === 0) continue; // edge tick collides with Y labels, carries no info
            const x = x0 + (i / (prices.length - 1)) * (x1 - x0);
            svg.appendChild(line(x, y0, x, y1, 0.6));
            svg.appendChild(label(Math.min(Math.max(x, x0), x1), height - 4, labelFor(date), 'middle'));
          }
        }
      }
    }

    const pts = points.split(' ');
    const last = pts[pts.length - 1].split(',');
    lastX = last[0];
    lastY = last[1];

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', strokeColor);
    polyline.setAttribute('stroke-width', '1.5');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', String(lastX));
    dot.setAttribute('cy', String(lastY));
    dot.setAttribute('r', axes ? '3.2' : '1.8');
    dot.setAttribute('fill', strokeColor);
    dot.setAttribute('stroke', '#ffffff');
    dot.setAttribute('stroke-width', axes ? '1.2' : '0.5');
    svg.appendChild(dot);

    return svg;
  }

  // Discord-identical chart: axes build + light card + heavier line. Single source
  // for the Discord PNG (share-discord.js) and the click-to-expand popout below.
  function renderDiscordChart(timeSeries, width = 360, height = 100) {
    const svg = renderSparkline(timeSeries, width, height, { axes: true });
    if (!svg) return null;
    const NS = 'http://www.w3.org/2000/svg';
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('rx', '8');
    bg.setAttribute('fill', '#f1f5f9');
    svg.insertBefore(bg, svg.firstChild);
    svg.querySelector('polyline')?.setAttribute('stroke-width', '2.5');
    return svg;
  }

  function closeSparklinePopout() {
    if (typeof document === 'undefined') return;
    document.getElementById('tp-sparkline-popout')?.remove();
  }

  // Click on a mini sparkline pops the full Discord-style chart. Backdrop/×/Esc closes.
  function openSparklinePopout(timeSeries) {
    if (typeof document === 'undefined') return null;
    closeSparklinePopout();
    const svg = renderDiscordChart(timeSeries, 560, 220);
    if (!svg) return null;
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
    svg.style.display = 'block';

    const backdrop = document.createElement('div');
    backdrop.id = 'tp-sparkline-popout';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-label', 'Preisverlauf');
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.45);padding:16px;box-sizing:border-box;';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--tp-bg);border-radius:var(--tp-r-lg);padding:16px;max-width:min(608px,94vw);box-shadow:0 20px 60px rgba(0,0,0,0.5);box-sizing:border-box;';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
    const title = document.createElement('div');
    title.textContent = '📈 Preisverlauf';
    title.style.cssText = 'color:var(--tp-txt-mid);font-size:var(--tp-fs-lg);font-weight:600;';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Schliessen');
    closeBtn.style.cssText = 'background:transparent;border:0;color:var(--tp-mut);font-size:16px;cursor:pointer;padding:4px 8px;';
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() { document.removeEventListener('keydown', onKey); closeSparklinePopout(); }
    document.addEventListener('keydown', onKey);
    closeBtn.addEventListener('click', close);
    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    panel.appendChild(svg);
    backdrop.appendChild(panel);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    document.body.appendChild(backdrop);
    closeBtn.focus?.();
    return backdrop;
  }

  // ─── MODULE: src/page/sort.js ───────────────────────────────────────────────
  /**
   * Grid Sorting Engine
   * Handles flex column reparenting and sorting by offer count, discount percent,
   * and continuous weighted difference, with 100% natural DOM order restoration.
   */




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
          } else if ((cd.displayDelta?.kind === 'at-low' || cd.displayDelta?.kind === 'new-low') && CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false) {
            // Verified low without blend: rank by Vortief-Abstand — the same
            // number the ribbon prints and the edge heat burns with.
            // Excluded fallbacks sink with the bad deals (-100).
            weightedDiff = vortiefDropPct(cd.cardPrice, cd.stats);
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
      if (isCardFilteredOut(card, applyCardFilters({ card, offerCount }, termsList, CONFIG.MIN_OFFERS, pageHasOffers), { forScan: true })) continue;
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
    const newlyVerified = [];

    try {
      for (let i = 0; i < targets.length; i++) {
        if (shouldCancelFn()) break;
        const item = targets[i];
        Object.assign(scanState, { currentlyScanningPid: item.pid, progress: { completed, total } });
        triggerProcessListings();

        let stats = null;
        try {
          stats = await fetchSingleProductPriceStats(item.pid, 2, false, shouldCancelFn);
          if (stats) newlyVerified.push({ pid: item.pid, card: item.card });
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
    if (onComplete) onComplete(completed, total, newlyVerified);
    return { completed, total, newlyVerified };
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

  function cancelBestpreiseScan() {
    Object.assign(scanState, { bestpreiseScanCancel: true });
  }

  // ─── MODULE: src/ui/fresh-dismiss.js ────────────────────────────────────────
  /**
   * Fresh-deal glow dismissal.
   * Minimum 5s floor, then the next user input clears the glow.
   */


  let freshTimer = null;
  const freshListeners = [];

  const FRESH_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

  function markFreshVerified(pid) {
    if (pid) scanState.freshPids.add(pid);
  }

  function removeFreshListeners() {
    for (const { type, fn } of freshListeners.splice(0)) {
      document.removeEventListener(type, fn);
    }
  }

  function clearFresh() {
    scanState.freshPids.clear();
    scanState.freshUntil = 0;
    if (freshTimer) {
      clearTimeout(freshTimer);
      freshTimer = null;
    }
    removeFreshListeners();
    if (typeof document !== 'undefined') {
      for (const card of document.querySelectorAll('.tp-deal-fresh')) {
        card.classList.remove('tp-deal-fresh');
      }
    }
  }

  function installFreshListeners() {
    removeFreshListeners();
    for (const type of FRESH_EVENTS) {
      const fn = () => clearFresh();
      freshListeners.push({ type, fn });
      document.addEventListener(type, fn, { once: true, passive: true });
    }
  }

  // Re-arm replaces the old set: call armFreshDismiss() BEFORE marking the new
  // pids, then re-render so the render toggle picks up the fresh set.
  function armFreshDismiss() {
    clearFresh();
    if (typeof document === 'undefined') return;
    scanState.freshUntil = Date.now() + 5000;
    freshTimer = setTimeout(installFreshListeners, 5000);
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

  // Heat is chrome-only (border + glow): the card keeps the site background.

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
  // Single-product verify flow. Reads price at click time and re-verifies it
  // after fetch so a stale or swapped card never paints another product's stats.
  // Händlername (§8 in renderCardEffects): Memory-Map pid:Modus -> Name.
  // Nur echte Namen landen im Cache (leere Treffer nicht: der Button bleibt für
  // Retry). Fetch per 🏬-Klick oder — opt-in via DEALER_AUTOFETCH — automatisch
  // beim Rendern. Persistiert in localStorage (get/setCachedDealer, gleiche TTL
  // wie Preishistorie); pro pid:Modus ein Storage-Read pro Pageload
  // (dealerHydrated-Guard). Modus im Key, weil der günstigste Händler von der
  // Preisbasis abhängt.
  const dealerCache = new Map();
  const dealerPending = new Set();
  const dealerHydrated = new Set();
  // Auto-Fetch (DEALER_AUTOFETCH): einmal pro pid:Modus und Pageload feuern —
  // ohne den Guard würde jeder Render nach einem Fehlschlag neu fetchen.
  const dealerAutoTried = new Set();
  function clearDealerMemory() {
    dealerCache.clear();
    dealerHydrated.clear();
    dealerAutoTried.clear();
  }
  async function runSingleDealCheck(card, badgeDifEl) {
    if (badgeDifEl.classList.contains('tp-deal-loading')) return;
    const currentPid = getCardProductId(card);
    if (!currentPid) return;
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
      armFreshDismiss();
      markFreshVerified(currentPid);
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
    // Unverified site discounts never heat: the badge-level tp-is-unverified
    // ribbon (step 6 below) is their only striped-gray cue; verified cards heat as before.
    const heatMode = CONFIG.BESTPREISE_MODE_ACTIVE ? 'bestpreise' : 'browse';
    const heatInfo = getHeatInput(cardPrice, stats, diffVal, heatMode, dealData);
    const effectiveDiff = heatInfo.value;
    const heatProvisional = heatInfo.provisional;
    const heatIntensity = CONFIG.HEATMAP_INTENSITY;

    // Geprüft vs ungeprüft: only verified stats heat the card/badge. Provisional
    // site Differenzen stay neutral — no heat here, so the state scans without
    // comparing saturation.
    // Regular blend heat (verified): inset inner wash — the prominent signal,
    // clipped to the card's own edges. Vortief fallback heat (mode, verified low
    // without blend): same ramp hue, but only a subtle outer glow-or-none
    // (getOuterHeatStyle yields 'none' below t 0.55 — shallow fallbacks get no
    // glow, by design, so the fallback can't pass as a blended deal).
    // getInsetHeatStyle serves regular here, getOuterHeatStyle the fallback.
    const isVortiefHeat = heatInfo.kind === 'vortief';
    if (CONFIG.HEATMAP_ENABLED && !heatProvisional && effectiveDiff !== null && !isNaN(effectiveDiff)) {
      const heatKey = `${heatInfo.kind}:${effectiveDiff}_${heatIntensity.toFixed(2)}`;
      if (card.dataset.tpAppliedHeat !== heatKey) {
        card.dataset.tpAppliedHeat = heatKey;
        const heat = isVortiefHeat ? getOuterHeatStyle(effectiveDiff, heatIntensity) : getInsetHeatStyle(heatInfo.pct, heatIntensity);
        card.classList.toggle('tp-heat-vortief', isVortiefHeat);
        card.classList.toggle('tp-heat-blend', !isVortiefHeat);
        card.style.setProperty('--tp-heat-glow', heat.glow);
        card.style.setProperty('box-shadow', heat.glow, 'important');
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
      }
    } else if (card.dataset.tpAppliedHeat || card.classList.contains('tp-heat-blend') || card.classList.contains('tp-heat-vortief')) {
      // Tripwire: heat stripped while the badge still claims a verified % means
      // a stats regression slipped through — enable DEBUG to catch it live.
      if (CONFIG.DEBUG && card.querySelector('.tp-deal-alltime-low, .tp-deal-new-record')) {
        console.warn('[Toppreise Suite] heat removed with verified badge present',
          { pid, median: stats?.medianPrice ?? null, tiefstpreis: stats?.tiefstpreis ?? null });
      }
      delete card.dataset.tpAppliedHeat;
      card.style.removeProperty('box-shadow');
      card.classList.remove('tp-heat-blend', 'tp-heat-vortief');
      card.style.removeProperty('--tp-heat-glow');
      // Undo the badge heat coupling from the apply path above
      const heatBadgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
      if (heatBadgeEl) {
        heatBadgeEl.style.removeProperty('background');
        heatBadgeEl.style.removeProperty('border-color');
        heatBadgeEl.style.removeProperty('color');
        heatBadgeEl.style.removeProperty('box-shadow');
      }
    }
    // 1b. Geprüft vs ungeprüft card cue: verified cards carry tp-is-verified.
    // Unchecked cards stay at full opacity — the badge-level striped ribbon
    // (step 6) is the only ungeprüft signal. Loading cards get neither class.
     if (scanState.currentlyScanningPid && scanState.currentlyScanningPid === pid) {
      card.classList.remove('tp-is-verified');
     } else if (stats) {
       card.classList.add('tp-is-verified');
     } else {
      card.classList.remove('tp-is-verified');
     }

    // 2. Filters
    card.classList.toggle('tp-negative-filtered', filters.isNeg);
    card.classList.toggle('tp-min-offers-filtered', filters.isLowOffers);
    card.classList.toggle('tp-vortief-excluded', filters.isVortiefExcluded === true);

    // 3. Toppreis Highlighting (filtered store holds the cheapest offer).
    // Dealer verdict is single-sourced from dealerLoserFor (cards.js) — no
    // price comparison here. Both loser kinds share one presentation, so all
    // losers read tp-not-cheapest; tp-no-store-offer is only ever removed.
    const dealerRows = activeStores.length > 0 ? getCardDealerRows(card) : [];
    if (activeStores.length === 0 || dealerRows.length === 0) {
      card.classList.remove('tp-is-cheapest', 'tp-not-cheapest', 'tp-no-store-offer');
      card.querySelector('.tp-best-price-badge')?.remove();
      filters.isDealerLoser = false;
    } else if (dealerLoserFor(card, activeStores)) {
      card.classList.add('tp-not-cheapest');
      card.classList.remove('tp-is-cheapest', 'tp-no-store-offer');
      card.querySelector('.tp-best-price-badge')?.remove();
      filters.isDealerLoser = true;
    } else {
      card.classList.add('tp-is-cheapest');
      card.classList.remove('tp-not-cheapest', 'tp-no-store-offer');
      if (!card.querySelector('.tp-best-price-badge')) {
        const badge = document.createElement('div');
        badge.className = 'tp-best-price-badge';
        badge.textContent = 'Toppreis';
        card.appendChild(badge);
      }
      filters.isDealerLoser = false;
    }
    const hide = (filters.isNeg && CONFIG.FILTER_NEG_MODE !== 'dim')
      || (filters.isLowOffers && CONFIG.FILTER_MIN_MODE !== 'dim')
      || (filters.isDealerLoser && CONFIG.DEALER_MODE !== 'dim')
      || (filters.isVortiefExcluded && CONFIG.VORTIEF_MODE !== 'dim')
      || (filters.isUnchecked && CONFIG.HIDE_UNCHECKED_MODE !== 'dim');
    const dim = !hide && ((filters.isNeg && CONFIG.FILTER_NEG_MODE === 'dim')
      || (filters.isLowOffers && CONFIG.FILTER_MIN_MODE === 'dim')
      || (filters.isDealerLoser && CONFIG.DEALER_MODE === 'dim')
      || (filters.isVortiefExcluded && CONFIG.VORTIEF_MODE === 'dim')
      || (filters.isUnchecked && CONFIG.HIDE_UNCHECKED_MODE === 'dim'));
    filters.isFiltered = hide;   // narrowed: hidden-only (name kept, all consumers want hidden)
    filters.isDimmed = dim;
    card.classList.toggle('tp-filtered', hide);
    card.classList.toggle('tp-dimmed', dim);

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

      // Single check control: badge handles mouse + keyboard; there is no separate loupe button.
      if (!badgeDifEl.dataset.tpDealBound) {
        badgeDifEl.dataset.tpDealBound = 'true';
        badgeDifEl.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          runSingleDealCheck(card, badgeDifEl);
        });
        badgeDifEl.setAttribute('role', 'button');
        badgeDifEl.setAttribute('tabindex', '0');
        badgeDifEl.setAttribute('aria-label', 'Differenz prüfen');
        badgeDifEl.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            runSingleDealCheck(card, badgeDifEl);
          }
        });
      }

      if (CONFIG.BESTPREISE_MODE_ACTIVE) {
        if (dealData) {
          // Qualified Tiefstpreis! The ribbon prints the Gewichtete Differenz
          // (ADR-0005) — NIE die Site-Differenz. Heat and sort follow the same
          // number, so Zahl und Farbe stimmen immer überein.
          card.classList.remove('tp-unchecked-hidden');
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

          // Tooltip: only what the card doesn't show (outlier count) + action hint.
          // Badge-% and both CHF legs live on ribbon/pill; color legend lives on
          // the heatmap button.
          const outlierTip = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? `ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert\n` : '';
          setTitleIfChanged(badgeDifEl, `${outlierTip}[Klicken zum Aktualisieren]`);

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
          // Verified but no qualifying blend — e.g. minimal fallback stats
          // without median, or above-low. Only a verified MARKUP hides in the
          // mode; a verified low without blend stays visible with Vortief edge
          // heat (never a full wash) unless Fallback-Tiefs are excluded.
          // The badge is ALWAYS repainted from the current stats — never
          // preserved — so a stats regression can't strand a stale verified-%
          // badge on a card whose heat is gone.
          const ddNow = getDisplayDelta(cardPrice, stats);
          card.classList.remove('tp-unchecked-hidden');
          badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');
          card.querySelector('.tp-card-historical-price')?.remove();
          if (ddNow.kind === 'above-low') {
            badgeDifEl.classList.add('tp-deal-not-low', 'tp-deal-badge-interactive');
            // Tooltip: status + hint only — markup sits on the badge, historic low on the pill.
            setTitleIfChanged(badgeDifEl, `⚠️ Kein Tiefstpreis (+${ddNow.markup}% Aufschlag)\n[Klicken zum Aktualisieren]`);
            const fakeNow = sitePctText ? `<span class="tp-fake-discount"><s>${sitePctText}</s></span>` : '';
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>⚠️</span><p class="tp-markup-val">+${ddNow.markup}%</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Aufschlag</div><p class="tp-markup-val">+${ddNow.markup}%</p>${fakeNow}`);
            }
          } else if (ddNow.kind === 'at-low' || ddNow.kind === 'new-low') {
            // At-low without blend (no median / unqualified history): ribbon
            // prints the shared Vortief-Abstand when measurable, else the
            // preserved site-% — never a glyph. Browse stays gray; the mode
            // adds the feathered edge heat for the same number.
            badgeDifEl.classList.add('tp-deal-badge-interactive');
            badgeDifEl.classList.remove('tp-deal-not-low', 'tp-is-severe-markup');
            const prevLowNow = recordRefForPrice(stats, cardPrice).previousLow;
            const dropVsPrev = vortiefDropPct(cardPrice, stats);
            const hasPrevLowBase = prevLowNow && priceToCents(prevLowNow) > priceToCents(cardPrice);
            if (dropVsPrev > 0 && hasPrevLowBase) {
              setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · -${dropVsPrev}% vs. vorheriges Tief (CHF ${prevLowNow.toFixed(2)}) · Fallback: dünne Historie ohne Ø-Vergleich (Kante statt Fläche)\n[Klicken: erneut prüfen]`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>-${dropVsPrev}%</span><p>Tiefstpreis</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>-${dropVsPrev}%</p>`);
              }
            } else if (sitePctText) {
              setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · Shop-Differenz ${sitePctText} (Basis ungeprüft) · Fallback ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>${sitePctText}</span><p>Tiefstpreis</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>${sitePctText}</p>`);
              }
            } else {
              setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt (CHF ${cardPrice.toFixed(2)})\n[Klicken: erneut prüfen]`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>Tiefstpreis</span>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div>`);
              }
            }
          }
          // 'unknown' (no usable price): loupe state stays — nothing truthful to claim.
        } else {
          // Unscanned card (!stats) -> loupe / loading spinner. Hidden only
          // when "Nur Geprüfte" is on; otherwise kept visible for checking.
          card.classList.remove('tp-unchecked-hidden');
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
              setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz (ungeprüft), kein verifizierter Tiefstpreis.\n[Klicken: echten Allzeit-Tiefstpreis prüfen]`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>${sitePctText}</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>${sitePctText}</p><span class="tp-badge-loupe-icon">🔍</span>`);
              }
            } else {
              setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen.`);
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
        card.classList.remove('tp-unchecked-hidden');
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
          const realDropVsPrev = prevLow && prevLow > cardPrice ? pctDrop(prevLow, cardPrice) : (stats.realDiscountVsPrevLow || 0);
          const markupPct = isNonBest ? pctRise(stats.tiefstpreis, cardPrice) : 0;

          // Strictness lives in the mode now: outside it, verified non-deals
          // stay visible with a truthful Aufschlag badge.

          const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;

          if (isAllTimeLow) {
            // 3B: Verified All-Time Low (Glowing Emerald Halo)
            // Ribbon prints the Gewichtete Differenz (ADR-0005); without a
            // blend the Vortief-Abstand, else the preserved site-% — never a
            // glyph. Gray stays: no blend, no heat.
            badgeDifEl.classList.add('tp-deal-alltime-low', 'tp-deal-badge-interactive');
            badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

            // Single source (ADR-0005): the blend is the heat input above.
            const badgePct = dealData ? heatInfo.pct : 0;
            const prevTip = prevLow && priceToCents(prevLow) > priceToCents(cardPrice)
              ? ` vs. vorheriges Tief (CHF ${prevLow.toFixed(2)})` : '';

            if (badgePct > 0) {
              // Tooltip: action hint only — badge + pill carry the verified numbers.
              setTitleIfChanged(badgeDifEl, '[Klicken zum Aktualisieren]');
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>⚖️</span><p>-${badgePct}%</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">⚖️</div><p>-${badgePct}%</p>`);
              }
            } else if (realDropVsPrev > 0) {
              setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · -${realDropVsPrev}%${prevTip} · Fallback: dünne Historie ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>-${realDropVsPrev}%</span><p>Tiefstpreis</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>-${realDropVsPrev}%</p>`);
              }
            } else if (sitePctText) {
              setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · Shop-Differenz ${sitePctText} (Basis ungeprüft) · Fallback ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>${sitePctText}</span><p>Tiefstpreis</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>${sitePctText}</p>`);
              }
            } else {
              setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt (CHF ${cardPrice.toFixed(2)})\n[Klicken: erneut prüfen]`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>Tiefstpreis</span>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div>`);
              }
            }
          } else {
            // 2A: Verified Non-Tiefstpreis (Amber Alert Morph with Shrunken Strikethrough)
            const isSevere = markupPct >= 50;

            badgeDifEl.classList.add('tp-deal-not-low', 'tp-deal-badge-interactive');
            badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-loading');
            if (isSevere) {
              badgeDifEl.classList.add('tp-is-severe-markup');
            } else {
              badgeDifEl.classList.remove('tp-is-severe-markup');
            }

            // Tooltip: status + hint only — markup sits on the badge, historic low on the pill.
            setTitleIfChanged(badgeDifEl, `⚠️ Kein Tiefstpreis (+${markupPct}% Aufschlag)\n[Klicken zum Aktualisieren]`);
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
            setTitleIfChanged(histPriceEl, `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)`);
          } else if (showPrevLow || showMedianLine) {
            histPriceEl = ensureHistPriceEl(card, cardPriceEl);
            const parts = [];
            const dMedBrowse = showMedianLine ? pctDrop(stats.medianPrice, cardPrice) : 0;
            if (showPrevLow) parts.push(`📉 CHF ${prevLow.toFixed(2)}${isNewRecord ? ` (-${realDropVsPrev}%)` : ''}`);
            if (showMedianLine) parts.push(`Ø (${horizonLabel}) CHF ${stats.medianPrice.toFixed(2)} (-${dMedBrowse}%)`);
            histPriceEl.className = 'tp-card-historical-price ' + (isNewRecord && showPrevLow ? 'tp-is-record-low' : 'tp-is-at-low') + (showPrevLow ? ' tp-with-prev' : '');
            setTextIfChanged(histPriceEl, parts.join(' · '));
            if (isNewRecord && showPrevLow) {
              setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)${showMedianLine ? ` · Ø-Preis (${horizonLabel}): CHF ${stats.medianPrice.toFixed(2)}` : ''}`);
            } else {
              const dMedian = dMedBrowse;
              setTitleIfChanged(histPriceEl, `Allzeit-Tiefstpreis!${showPrevLow ? ` Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)}.` : ''}${showMedianLine ? ` Liegt ${dMedian}% unter dem ${horizonLabel}-Median von CHF ${stats.medianPrice.toFixed(2)}.` : ''}`);
            }
          } else if (histPriceEl) {
            histPriceEl.remove();
          }
        } else {
          // 1A: Unchecked State (Subtle Mini Loupe + Hover Scale + Tooltip)
          if (filters.isUnchecked === true) card.classList.add('tp-unchecked-hidden');

          badgeDifEl.classList.add('tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');
          if (isNeueFeed && rawDiscount !== null && !isNaN(rawDiscount)) {
            setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz (z.B. vs UVP, ungeprüft), kein verifizierter Tiefstpreis. Klicken: echten Allzeit-Tiefstpreis prüfen. Grau gestreift = ungeprüft.`);
            setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>${sitePctText}</p><span class="tp-badge-loupe-icon">🔍</span>`);
          } else {
            setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen.`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>Prüfen</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfen</div><p style="font-size: 15px; margin: 0; line-height: 1.1;">🔍</p>`);
            }
          }
        }
      }
    } else {
      card.classList.remove('tp-unchecked-hidden');
      card.querySelector('.tp-card-historical-price')?.remove();
    }

    // 5. Mini Price-Trend Sparkline + history strip (card-level bottom row:
    // pill spans from the share-button zone to the card's right edge, using
    // full card width instead of the narrow price-info column).
    const hasSeries = CONFIG.ENABLE_SPARKLINES && stats && Array.isArray(stats.timeSeries) && stats.timeSeries.length >= 2;
    let sparkContainer = hasSeries ? card.querySelector('.tp-sparkline-container') : null;
    if (hasSeries) {
      if (!sparkContainer) {
        sparkContainer = document.createElement('div');
        sparkContainer.className = 'tp-sparkline-container';
      }
      // Click pops the full Discord-style chart (same series incl. live price).
      sparkContainer._tpSeries = withLivePrice(stats.timeSeries, cardPrice);
      sparkContainer.style.cursor = 'pointer';
      sparkContainer.setAttribute('role', 'button');
      sparkContainer.setAttribute('tabindex', '0');
      sparkContainer.setAttribute('title', 'Preisverlauf vergrössern');
      if (!sparkContainer.dataset.tpPopoutBound) {
        sparkContainer.dataset.tpPopoutBound = 'true';
        sparkContainer.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          openSparklinePopout(sparkContainer._tpSeries);
        });
        sparkContainer.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            openSparklinePopout(sparkContainer._tpSeries);
          }
        });
      }
      if (!sparkContainer.querySelector('.tp-sparkline')) {
        const svg = renderSparkline(sparkContainer._tpSeries, 44, 13);
        if (svg) {
          sparkContainer.replaceChildren();
          sparkContainer.appendChild(svg);
        }
      }
    } else {
      card.querySelector('.tp-sparkline-container')?.remove();
    }
    const histPriceEl = card.querySelector('.tp-card-historical-price');
    if (histPriceEl) {
      let subRow = card.querySelector('.tp-card-subline-row');
      if (!subRow) {
        subRow = document.createElement('div');
        subRow.className = 'tp-card-subline-row';
        card.appendChild(subRow);
        subRow.appendChild(histPriceEl);
      } else if (histPriceEl.parentElement !== subRow) {
        subRow.insertBefore(histPriceEl, subRow.firstChild);
      }
      if (sparkContainer && sparkContainer.parentElement !== subRow) {
        subRow.appendChild(sparkContainer);
      }
    } else {
      card.querySelector('.tp-card-subline-row')?.remove();
      if (sparkContainer) {
        const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                               cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                               cardPriceEl?.parentElement ||
                               card;
        if (sparkContainer.parentElement !== priceContainer) {
          priceContainer.appendChild(sparkContainer);
        }
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
            const { title, url, imageUrl } = extractShareData(card);
            const productDl = imageUrl ? fetchImageBlob(imageUrl).catch(() => null) : null;
            const priceText = cardPrice > 0 ? `CHF ${cardPrice.toFixed(2)}` : '';
            let dealer = extractDealer(card);
            let dealerUrl = extractDealerUrl(card);
            let offers = cd.offerCount || 0;
            if ((!dealer || !dealerUrl || !offers) && url) {
              const info = await fetchProductInfo(url, undefined, isShippingPriceActive(card)).catch(() => null);
              if (info) { dealer = dealer || info.dealer; dealerUrl = dealerUrl || info.dealerUrl; offers = offers || info.offers; }
            }
            const png = await renderSparklinePng(withLivePrice(stats?.timeSeries, cardPrice)).catch(() => null);
            const content = formatDealMessage({
              title, url, priceText,
              dealer, dealerUrl, offerCount: offers,
              spark: png ? '' : sparklineText(stats?.timeSeries),
              ...resolveShareFields(cardPrice, stats),
              suppressDealerEmbed: CONFIG.DISCORD_SUPPRESS_DEALER_EMBED !== false,
              suppressProductEmbed: CONFIG.DISCORD_SUPPRESS_PRODUCT_EMBED !== false
            }, CONFIG.DISCORD_LAYOUT);
            const threadName = buildThreadName(title);
            const flagKey = discordForumFlagKey(hook);
            const forum = _getValue(flagKey, false) === true;
            // Produkt-Bytes laufen parallel zu Händlerfetch + Chart-Render (oben
            // gestartet): gelingt der Download nicht, bleibt das URL-Embed als Fallback.
            const productBlob = (png && productDl) ? await productDl : null;
            const productOpt = productBlob ? { productImageBlob: productBlob } : (imageUrl ? { productImageUrl: imageUrl } : null);
            const postText = withThread => postDealToDiscord(hook, content, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });
            const postImage = withThread => postDealImageToDiscord(hook, content, png, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });
            const tryRound = async withThread => {
              if (png) {
                try { await postImage(withThread); return; }
                catch (imgErr) {
                  if (!isForumThreadError(imgErr)) { /* non-forum image error: fall through to text, same round */ }
                  else if (withThread) { /* threaded image rejected: fall through to threaded text */ }
                  else throw imgErr; // plain image hit forum: skip plain text, outer handler goes threaded
                }
              }
              await postText(withThread);
            };
            for (const withThread of (forum ? [true, false] : [false, true])) {
              try {
                await tryRound(withThread);
                if (withThread !== forum) _setValue(flagKey, withThread);
                break;
              } catch (err) {
                if (!isForumThreadError(err) || withThread) throw err;
                // plain round hit forum → loop continues threaded
              }
            }
            showToast('📤 Deal in Discord geteilt');
            if (pid && cardPrice > 0) { setSharedDeal(pid, priceToCents(cardPrice)); shareBtn.classList.add('tp-share-done'); }
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
      shareBtn.classList.toggle('tp-share-done', !!(pid && cardPrice > 0 && getSharedDeal(pid, priceToCents(cardPrice))));
    } else {
      shareBtn?.remove();
    }
    // 8. Händlername links neben dem Preis: nur geprüfte Karten (stats != null).
    // Katalog löst synchron aus extractDealer (kein Fetch); Feed ohne DOM-Zeile
    // bekommt einen 🏬-Button, der fetchProductInfo einmalig pro pid:Modus holt
    // (dealerCache + dealerPending-Guard) und danach neu rendert — oder bei
    // DEALER_AUTOFETCH denselben Loader ohne Klick (1×/Pageload, max. 3 parallel).
    // Der Name verlinkt direkt aufs Händlerangebot (/ext_de aus dem Fetch bzw.
    // Zeilenlink), Fallback ist die Produktseite — immer neuer Tab.
    const dealerEl = card.querySelector('.tp-dealer-name');
    if (!stats || !pid) {
      dealerEl?.remove();
    } else {
      const useShipping = isShippingPriceActive(card);
      const dKey = `${pid}:${useShipping ? 's' : 'p'}`;
      let dealer = extractDealer(card);
      if (!dealer && !dealerCache.has(dKey) && !dealerHydrated.has(dKey)) {
        dealerHydrated.add(dKey);
        const stored = getCachedDealer(pid, useShipping);
        if (stored?.dealer) lruSet(dealerCache, dKey, stored);
      }
      const cached = dealerCache.get(dKey);
      if (!dealer && cached?.dealer) dealer = cached.dealer;
      const { url: productUrl } = extractShareData(card);
      const directUrl = cached?.url || (dealer ? extractDealerUrl(card) : '');
      const targetUrl = directUrl || productUrl || '';
      const hasUrl = /^https?:\/\//i.test(targetUrl);
      const anchor = (cardPriceEl?.parentElement?.contains(cardPriceEl) && cardPriceEl.parentElement) ||
        card.querySelector('.Plugin_PriceInformation, .price_information_product') || card;
      const place = el => {
        el.dataset.tpDealerPid = dKey;
        // Prepend: links vom "ab CHF"-Prefix. insertBefore(cardPriceEl) landete
        // dahinter (cardPriceEl ist nur die Zahl) und spaltete Prefix von Zahl.
        if (anchor !== card) anchor.insertBefore(el, anchor.firstChild);
        else anchor.appendChild(el);
      };
      if (dealer) {
        let el = dealerEl?.dataset.tpDealerPid === dKey ? dealerEl : null;
        if (el && ((el.tagName === 'A') !== hasUrl)) { el.remove(); el = null; }
        if (!el) {
          dealerEl?.remove();
          el = document.createElement(hasUrl ? 'a' : 'span');
          el.className = 'tp-dealer-name';
          if (hasUrl) { el.href = targetUrl; el.target = '_blank'; el.rel = 'noopener'; el.addEventListener('click', e => e.stopPropagation()); }
          place(el);
        } else if (el.tagName === 'A' && hasUrl && el.getAttribute('href') !== targetUrl) {
          el.href = targetUrl;
        }
        setTextIfChanged(el, `🏬 ${dealer}`);
        setTitleIfChanged(el, directUrl && hasUrl ? `Günstigster Händler: ${dealer} — direkt zum Angebot` : `Günstigster Händler: ${dealer}`);
      } else if (hasUrl && !dealerCache.has(dKey)) {
        // Ein Loader für Klick + Auto-Fetch: Produktseite einmalig pro pid:Modus
        // (dealerPending-Guard), Ergebnis in Memory + localStorage, danach Render.
        const loadDealer = async () => {
          if (dealerPending.has(dKey)) return;
          dealerPending.add(dKey);
          try {
            const info = await fetchProductInfo(productUrl, undefined, isShippingPriceActive(card)).catch(() => null);
            if (info?.dealer) { lruSet(dealerCache, dKey, { dealer: info.dealer, url: info.dealerUrl || '' }); setCachedDealer(pid, useShipping, info.dealer, info.dealerUrl || ''); }
          } finally {
            dealerPending.delete(dKey);
          }
          triggerProcessListings();
        };
        let btn = dealerEl?.dataset.tpDealerPid === dKey && dealerEl.tagName === 'BUTTON' ? dealerEl : null;
        if (!btn) {
          dealerEl?.remove();
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'tp-dealer-name tp-dealer-btn';
          btn.textContent = '🏬';
          btn.setAttribute('aria-label', 'Händler laden');
          btn.title = 'Günstigsten Händler laden (lädt die Produktseite einmalig)';
          btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            btn.disabled = true;
            loadDealer();
          });
          place(btn);
        } else if (!dealerPending.has(dKey) && btn.disabled) {
          btn.disabled = false;
        }
        // Opt-in (aus, Standard): Händler ohne Klick laden. Ein Versuch pro
        // pid:Modus und Pageload (Fehler → Button für manuellen Retry), max. 3
        // parallele Fetches — fertige lösen per triggerProcessListings die
        // nächste Staffel aus (Kaskade statt Request-Sturm).
        if (CONFIG.DEALER_AUTOFETCH === true && !dealerAutoTried.has(dKey) && !dealerPending.has(dKey) && dealerPending.size < 3) {
          dealerAutoTried.add(dKey);
          btn.disabled = true;
          loadDealer();
        }
      } else {
        dealerEl?.remove();
      }
    }
    // Fresh-deal glow: only newly verified good deals pulse. The badge verdict
    // above is the single source of truth for "good deal" — no duplicate math.
    const freshBadge = card.querySelector('.tp-deal-new-record, .tp-deal-alltime-low');
    const isFresh = !!stats && scanState.freshPids.has(pid) && !!freshBadge;
    card.classList.toggle('tp-deal-fresh', isFresh);
  }

  function renderEmptyState(cards, counts) {
    let emptyNotice = document.getElementById('tp-empty-state-notice');

    // If qualifying bestpreise deals exist on page, NEVER render empty state
    if (counts.bestpreiseDeals > 0) {
      if (emptyNotice) emptyNotice.remove();
      return;
    }

    const totalHidden = counts.filteredCount || 0;

    // Filtern removes cards: empty state whenever all cards are removed.
    if (cards.length > 0 && totalHidden >= cards.length) {
      // Static notice: skip rebuild + listener re-bind when nothing changed
      const emptySig = `${cards.length}:${totalHidden}:${counts.uncheckedDeals || 0}:${CONFIG.REAL_DEAL_MIN_DISCOUNT || 30}`;
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
        <div>🚫 <strong>Alle ${cards.length} Angebote auf dieser Seite sind durch aktive Filter ausgeblendet.</strong></div>
        <div class="tp-empty-state-actions">
          ${counts.uncheckedDeals > 0 ? `<button class="tp-empty-state-btn" id="tp-empty-check-deals-btn" style="border-color: #3b82f6; color: #2563eb;" title="Prüft Differenzen ≥ ${minDisc}% (ungeprüft ≠ Tiefstpreis)">🔍 Tiefstpreise prüfen (≥${minDisc}%)</button>` : ''}
          ${(counts.uncheckedDeals || 0) > 0 || CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? `<button class="tp-empty-state-btn" id="tp-empty-hide-unchecked-btn" title="${CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? `✓ Nur geprüfte aktiv (${counts.uncheckedHidden || 0} ausgeblendet) – klicken zum Aufheben` : `Ungeprüfte ausblenden (${counts.uncheckedHidden || 0}) – entfernt sie aus der Liste`}">${CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? 'Alle anzeigen' : 'Nur geprüfte'}</button>` : ''}
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
        showToast(next ? '✓ Nur geprüfte filtern aktiv (Filtergrund, entfernt)' : '✓ Nur geprüfte aus — ungeprüfte werden wieder angezeigt');
      });

      emptyNotice.querySelector('#tp-empty-toggle-filters-btn')?.addEventListener('click', () => {
        updateConfig('FILTER_NEG_ENABLED', false);
        updateConfig('FILTER_MIN_ENABLED', false);
        updateConfig('BESTPREISE_HIDE_UNCHECKED', false);
        updateConfig('BESTPREISE_INCLUDE_VORTIEF', true);
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
   * dual-binding input controls, view paint, import/export, and cache controls.
   */








  function setupUI() {
    const { shadow } = ensureSkeleton();
    let section = shadow.getElementById('tp-section-unified-suite');
    if (!section) {
      const sectionsHolder = shadow.getElementById('tp-settings-sections');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = `
        <div id="tp-section-unified-suite">
        <section id="tp-section-display" class="tp-section-card tp-section-display">
          <div class="tp-section-header">🖥️ Ansicht</div>
          <div class="tp-settings-group" id="tp-dim-opacity-group">
            <label>Deckkraft / Dimmung (Gedimmt & Gefiltert)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-opacity-range" min="0.05" max="0.95" step="0.05" value="0.25">
              <input type="number" id="tp-opacity-val" min="5" max="95" step="5" value="25">
            </div>
          </div>
          <div class="tp-settings-group">
            <label>Heatmap-Intensität (%)</label>
            <div class="tp-range-container tp-rose">
              <input type="range" id="tp-heatmap-intensity-range" min="20" max="100" step="5" value="100">
              <input type="number" id="tp-heatmap-intensity-val" min="20" max="100" step="5" value="100">
            </div>
          </div>
        </section>
        <section id="tp-section-deals" class="tp-section-card tp-section-deals">
          <div class="tp-section-header">💎 Sortieren</div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Zeigt und sortiert verifizierte Tiefstpreise nach echtem Rabatt; sortiert nur, filtert nichts">Tiefstpreise Modus</label>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-bestpreise-mode-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
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
        </section>
        <section id="tp-section-filter" class="tp-section-card tp-section-filter">
          <div class="tp-section-header">🧹 Filtern</div>
          <div class="tp-settings-group">
            <span class="tp-switch-desc tp-field-hint">Negativ-Terme, Min-Angebote, Ungeprüfte, Fallback-Tiefs und Händler stehen im Filter-Popover der Filterleiste.</span>
          </div>
          <div class="tp-settings-group">
            <label>Preis-Toleranz (%)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-margin-range" min="0" max="15" step="0.5" value="0">
              <input type="number" id="tp-margin-val" min="0" max="100" step="0.1" value="0">
            </div>
          </div>
        </section>
        <section id="tp-section-alarm" class="tp-section-card tp-section-alarm">
          <div class="tp-section-header">🔔 Preisalarm</div>
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
              <input type="range" id="tp-alarm-target-range" min="5" max="99" step="5" value="60">
              <input type="number" id="tp-alarm-target-val" min="5" max="99" step="1" value="60">
            </div>
          </div>
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
        </section>
        <section id="tp-section-discord" class="tp-section-card tp-section-discord">
          <div class="tp-section-header">💬 Discord Share</div>
          <div class="tp-settings-group">
            <label title="Webhook-URL deines Discord-Channels (Kanal-Einstellungen → Integrationen → Webhook). Nur lokal gespeichert, nie committet.">📤 Discord Webhook (1-Klick Deals-Share)</label>
            <div id="tp-discord-webhook-collapsed">
              <span id="tp-discord-webhook-status" class="tp-switch-desc"></span>
              <button type="button" id="tp-discord-webhook-reveal" class="tp-btn tp-btn-secondary" aria-expanded="false" aria-controls="tp-discord-webhook-editor">🔑 Webhook anzeigen / ändern</button>
            </div>
            <div id="tp-discord-webhook-editor" style="display: none;">
              <input type="password" id="tp-discord-webhook-input" class="tp-field-dark" placeholder="https://discord.com/api/webhooks/…" autocomplete="new-password" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true">
              <span class="tp-switch-desc tp-field-hint">Ermöglicht den 📤-Button auf verifizierten Tiefstpreis-Karten. Leer = Button meldet fehlende URL.</span>
            </div>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Unterdrückt die automatische Händler-Link-Vorschau (Embed) unter Discord-Posts.">Händler-Link Embed</label>
              <span class="tp-switch-desc">AUS = keine Händler-Vorschau</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-discord-dealer-embed-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Unterdrückt die automatische Produkt-Link-Vorschau (Embed) unter Discord-Posts. Das Preisverlauf-Bild wird weiterhin angehängt.">Toppreise-Link Embed</label>
              <span class="tp-switch-desc">AUS = keine Produkt-Vorschau (Bild bleibt)</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-discord-product-embed-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group">
            <label for="tp-discord-layout-input">Nachrichten-Layout (Baukasten)</label>
            <div>
              <button type="button" id="tp-discord-layout-preset-kompakt" class="tp-btn tp-btn-secondary">Kompakt</button>
              <button type="button" id="tp-discord-layout-preset-ausfuehrlich" class="tp-btn tp-btn-secondary">Ausführlich</button>
              <button type="button" id="tp-discord-layout-preset-minimal" class="tp-btn tp-btn-secondary">Minimal</button>
            </div>
            <div id="tp-discord-layout-chips">
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{title}">Titel {title}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{price}">Preis {price}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{dealer}">Händler {dealer}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{offers}">Angebote {offers}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{spark}">Spark {spark}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{prevlow}">Bisher {prevlow}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{median}">Ø-Preis {median}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{link}">Link {link}</button>
            </div>
            <textarea id="tp-discord-layout-input" class="tp-field-dark" rows="7" style="font-family:monospace" spellcheck="false"></textarea>
            <span class="tp-switch-desc tp-field-hint">Je Zeile ein Baustein. Tokens: {title} {price} {dealer} {offers} {spark} {prevlow} {median} {link}. Größe via # / ## / -# am Zeilenanfang. · / + blenden leere Nachbarn aus. {link} erscheint nur bei aktivem Toppreise-Embed.</span>
            <pre id="tp-discord-layout-preview"></pre>
            <span id="tp-discord-layout-count" class="tp-switch-desc"></span>
            <span id="tp-discord-layout-error" class="tp-switch-desc"></span>
            <button type="button" id="tp-discord-layout-reset" class="tp-btn tp-btn-secondary">Layout zurücksetzen</button>
          </div>
        </section>
        <section id="tp-section-data" class="tp-section-card tp-section-data">
          <div class="tp-section-header">💾 Daten & Cache</div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Lädt den günstigsten Händler pro verifizierter Karte automatisch (statt per 🏬-Klick).">Händler automatisch laden</label>
              <span class="tp-switch-desc">Erfordert zusätzliche Produktseiten-Abfragen (max. 3 parallel)</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-dealer-autofetch-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group" id="tp-bestpreise-weight-group">
            <label>Gewichtete Differenz: Sortierung + Farb-Emphase (Rekord vs Ø)</label>
            <div class="tp-range-container tp-purple">
              <input type="range" id="tp-bestpreise-weight-range" min="0" max="100" step="5" value="50">
              <input type="number" id="tp-bestpreise-weight-val" min="0" max="100" step="5" value="50">
            </div>
            <span class="tp-switch-desc tp-field-hint" id="tp-bestpreise-weight-desc">50% Rekord / 50% Ø-Preis (Sortierung + Farb-Emphase) · z.B. Rek −10% + Ø −25% → Gewichtete Differenz 18</span>
          </div>
          <div class="tp-settings-group" id="tp-bestpreise-minpoints-group">
            <label title="Mindestanzahl Datenpunkte in der Preishistorie für den Ø-Vergleich (Punkte ≈ Tage). Darunter kein Blend — Karte wird Fallback-Tief.">Mindestanzahl Datenpunkte in der Preishistorie</label>
            <div class="tp-range-container tp-purple">
              <input type="range" id="tp-bestpreise-minpoints-range" min="0" max="${MIN_POINTS_STEPS.length - 1}" step="1" value="${minPointsToIndex(DEFAULTS.BESTPREISE_MIN_POINTS)}">
              <input type="number" id="tp-bestpreise-minpoints-val" min="1" max="100" step="1" value="5">
            </div>
            <span class="tp-switch-desc tp-field-hint">Nur Historien ab dieser Punktzahl bekommen einen Ø-Vergleich (Blend). Darunter: Fallback-Tief (Kante statt Fläche).</span>
          </div>
          <div class="tp-settings-group" id="tp-bestpreise-horizon-group">
            <label>Median-Berechnungszeitraum (Ø-Preis)</label>
            <div class="tp-range-container tp-purple">
              <input type="range" id="tp-bestpreise-horizon-range" min="30" max="760" step="30" value="365">
              <input type="number" id="tp-bestpreise-horizon-val" min="0" max="730" step="1" value="365">
            </div>
            <span class="tp-switch-desc tp-field-hint" id="tp-bestpreise-horizon-desc">Ø-Vergleich: 1J — Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis</span>
          </div>
          <div class="tp-settings-group">
            <label>Prüf-Vorauswahl: Mindest-Differenz für Batch-Check (%)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-real-deal-min-range" min="10" max="70" step="5" value="30">
              <input type="number" id="tp-real-deal-min-val" min="5" max="95" step="5" value="30">
            </div>
            <span class="tp-switch-desc tp-field-hint">Nur Differenzen ab diesem Wert (ungeprüft) werden automatisch geprüft. Die Prüfung ersetzt sie durch den echten Rabatt.</span>
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
            <button type="button" id="tp-data-reset-btn" class="tp-btn tp-btn-secondary" title="Löscht Preis- und Händler-Cache und setzt ALLE Einstellungen (inkl. Discord-Webhook) auf Standard zurück.">🧨 Alle Daten löschen</button>
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
          <div class="tp-settings-group tp-btn-row">
            <button type="button" id="tp-export-config-btn" title="Einstellungen als JSON-Datei sichern." class="tp-btn tp-btn-secondary">📥 Export (JSON)</button>
            <button type="button" id="tp-import-config-btn" title="Einstellungen aus einer JSON-Datei wiederherstellen." class="tp-btn tp-btn-secondary">📤 Import (JSON)</button>
            <input type="file" id="tp-import-config-file" accept=".json">
          </div>
        </section>
        </div>
      `;
      section = tempDiv.firstElementChild;
      sectionsHolder.appendChild(section);
    }

    const dialog = shadow.getElementById('tp-settings-dialog');
    const fabButton = shadow.getElementById('tp-settings-fab');
    const btnClose = shadow.getElementById('tp-btn-close');
    const btnSave = shadow.getElementById('tp-btn-save');

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
    const heatmapIntensityRange = shadow.getElementById('tp-heatmap-intensity-range');
    const heatmapIntensityVal = shadow.getElementById('tp-heatmap-intensity-val');
    const bestpreiseModeToggle = shadow.getElementById('tp-bestpreise-mode-toggle');
    const bestpreiseWeightRange = shadow.getElementById('tp-bestpreise-weight-range');
    const bestpreiseWeightVal = shadow.getElementById('tp-bestpreise-weight-val');
    const bestpreiseWeightDesc = shadow.getElementById('tp-bestpreise-weight-desc');
    const bestpreiseMinPointsRange = shadow.getElementById('tp-bestpreise-minpoints-range');
    const bestpreiseMinPointsVal = shadow.getElementById('tp-bestpreise-minpoints-val');
    const bestpreiseHorizonRange = shadow.getElementById('tp-bestpreise-horizon-range');
    const bestpreiseHorizonVal = shadow.getElementById('tp-bestpreise-horizon-val');
    const bestpreiseHorizonDesc = shadow.getElementById('tp-bestpreise-horizon-desc');
    const cacheTtlSelect = shadow.getElementById('tp-cache-ttl-select');
    const cacheNegTtlSelect = shadow.getElementById('tp-cache-neg-ttl-select');
    const cacheStatsLabel = shadow.getElementById('tp-cache-stats-label');
    const cacheClearBtn = shadow.getElementById('tp-cache-clear-btn');
    const dataResetBtn = shadow.getElementById('tp-data-reset-btn');
    const realDealMinRange = shadow.getElementById('tp-real-deal-min-range');
    const realDealMinVal = shadow.getElementById('tp-real-deal-min-val');
    const sparklinesToggle = shadow.getElementById('tp-sparklines-toggle');
    const dealerAutofetchToggle = shadow.getElementById('tp-dealer-autofetch-toggle');
    const discordWebhookInput = shadow.getElementById('tp-discord-webhook-input');
    const discordWebhookReveal = shadow.getElementById('tp-discord-webhook-reveal');
    const discordWebhookEditor = shadow.getElementById('tp-discord-webhook-editor');
    const discordWebhookStatus = shadow.getElementById('tp-discord-webhook-status');
    const discordDealerEmbedToggle = shadow.getElementById('tp-discord-dealer-embed-toggle');
    const discordProductEmbedToggle = shadow.getElementById('tp-discord-product-embed-toggle');
    const discordLayoutInput = shadow.getElementById('tp-discord-layout-input');
    const discordLayoutPreview = shadow.getElementById('tp-discord-layout-preview');
    const discordLayoutCount = shadow.getElementById('tp-discord-layout-count');
    const discordLayoutError = shadow.getElementById('tp-discord-layout-error');
    const discordLayoutReset = shadow.getElementById('tp-discord-layout-reset');
    const LAYOUT_PRESETS = {
      kompakt: DEFAULT_LAYOUT,
      ausfuehrlich: '## {title}\n# {price}\n-# {dealer}\n-# {offers}\n{spark}\n{prevlow}\n{median}\n{link}',
      minimal: '## {title}\n# {price}\n{link}'
    };
    const LAYOUT_SAMPLE = { title: 'URBANISTA Porto, Cloud White', url: 'https://www.toppreise.ch/preisvergleich/x-p802723', priceText: 'CHF 16.85', dealer: 'Amazon.de', dealerUrl: 'https://www.toppreise.ch/ext_de?pid=802723', offerCount: 25, spark: '▁▂▃▄▅▆▇', prevLowText: 'CHF 29.70', prevLowPct: 43, medianText: 'Ø-Preis (90T): CHF 42.90', medianPct: 61 };
    function renderLayoutPreview() {
      if (!discordLayoutInput || !discordLayoutPreview) return;
      const recipe = discordLayoutInput.value;
      if (discordLayoutError) discordLayoutError.textContent = validateLayoutRecipe(recipe) || '';
      const rendered = renderLayout({
        ...LAYOUT_SAMPLE,
        suppressDealerEmbed: discordDealerEmbedToggle ? !discordDealerEmbedToggle.checked : true,
        suppressProductEmbed: discordProductEmbedToggle ? !discordProductEmbedToggle.checked : true
      }, recipe);
      discordLayoutPreview.innerHTML = renderDiscordMarkdownPreview(rendered);
      if (discordLayoutCount) discordLayoutCount.textContent = `Rezept ${recipe.length} Zeichen · Nachricht ${rendered.length}/2000${layoutOverLimitSuffix(rendered.length, recipe)}`;
    }
    let layoutTimer = 0;
    function scheduleLayoutPreview() { clearTimeout(layoutTimer); layoutTimer = setTimeout(renderLayoutPreview, 150); }

    const exportBtn = shadow.getElementById('tp-export-config-btn');
    const importBtn = shadow.getElementById('tp-import-config-btn');
    const importFile = shadow.getElementById('tp-import-config-file');

    function syncFieldsFromConfig() {
      // Every key syncUiControl covers (radios, toggles, weight, min-points,
      // threshold, shipping, sparklines, dealer-autofetch, embeds, alarm) syncs
      // through it — toolbar mirrors included. Only modal-only controls below.
      for (const k of Object.keys(CONFIG)) syncUiControl(k, CONFIG[k]);

      marginRange.value = CONFIG.MARGIN_PERCENT;
      marginVal.value = CONFIG.MARGIN_PERCENT;

      if (CONFIG.SORT_BY_OFFERS === 'desc') sortDesc.checked = true;
      else if (CONFIG.SORT_BY_OFFERS === 'asc') sortAsc.checked = true;
      else if (CONFIG.SORT_BY_OFFERS === 'discount-desc') sortDiscount.checked = true;
      else sortNone.checked = true;

      const heatIntensityPct = Math.round((CONFIG.HEATMAP_INTENSITY ?? 1.0) * 100);
      heatmapIntensityRange.value = heatIntensityPct;
      heatmapIntensityVal.value = heatIntensityPct;

      // Berechnungsparameter shape browse heat too — always visible; mode only drives sort + scan.
      {
        const stored = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365;
        if (bestpreiseHorizonRange) bestpreiseHorizonRange.value = stored === 0 ? 760 : stored;
        if (bestpreiseHorizonVal) bestpreiseHorizonVal.value = stored;
        if (bestpreiseHorizonDesc) bestpreiseHorizonDesc.textContent = `Ø-Vergleich: ${horizonText(stored)} — Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis`;
      }

      if (cacheTtlSelect) cacheTtlSelect.value = String(CONFIG.REAL_DEAL_CACHE_HOURS || 48);
      if (cacheNegTtlSelect) cacheNegTtlSelect.value = String(CONFIG.NEGATIVE_CACHE_HOURS || 2);
      if (cacheStatsLabel) {
        const count = countCachedPriceStats();
        cacheStatsLabel.textContent = `Lokaler Cache: ${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`;
      }

      if (discordWebhookInput) discordWebhookInput.value = '';
      if (discordWebhookEditor) discordWebhookEditor.style.display = 'none';
      if (discordWebhookReveal) { discordWebhookReveal.style.display = ''; discordWebhookReveal.setAttribute('aria-expanded', 'false'); }
      if (discordWebhookStatus) discordWebhookStatus.textContent = CONFIG.DISCORD_WEBHOOK_URL ? '✅ Webhook hinterlegt' : 'Kein Webhook hinterlegt';
      if (discordDealerEmbedToggle) discordDealerEmbedToggle.checked = CONFIG.DISCORD_SUPPRESS_DEALER_EMBED === false;
      if (discordProductEmbedToggle) discordProductEmbedToggle.checked = CONFIG.DISCORD_SUPPRESS_PRODUCT_EMBED === false;
      if (discordLayoutInput) discordLayoutInput.value = CONFIG.DISCORD_LAYOUT;
      renderLayoutPreview();
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
    bindDual(bestpreiseHorizonRange, bestpreiseHorizonVal, (raw) => {
      const v = isNaN(raw) ? 365 : (raw > 730 ? 0 : raw);
      if (bestpreiseHorizonDesc) bestpreiseHorizonDesc.textContent = `Ø-Vergleich: ${horizonText(v)} — Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis`;
      if (v === 0) {
        if (bestpreiseHorizonRange) bestpreiseHorizonRange.value = 760;
        if (bestpreiseHorizonVal && raw > 730) bestpreiseHorizonVal.value = 0;
      }
    });
    if (bestpreiseMinPointsRange && bestpreiseMinPointsVal) {
      bestpreiseMinPointsRange.addEventListener('input', e => {
        bestpreiseMinPointsVal.value = minPointsFromIndex(e.target.value);
      });
      bestpreiseMinPointsVal.addEventListener('input', e => {
        const typed = parseFloat(e.target.value);
        if (!isNaN(typed)) bestpreiseMinPointsRange.value = minPointsToIndex(clampMinPoints(typed));
      });
    }
    cacheClearBtn?.addEventListener('click', () => {
      const removed = clearPriceStatsCache();
      clearDealerMemory();
      if (cacheStatsLabel) cacheStatsLabel.textContent = 'Lokaler Cache: 0 Einträge';
      triggerProcessListings();
      showToast(`Cache geleert (${removed} Produkte entfernt)`);
    });
    discordWebhookReveal?.addEventListener('click', () => {
      if (!discordWebhookEditor || !discordWebhookInput) return;
      discordWebhookInput.value = CONFIG.DISCORD_WEBHOOK_URL || '';
      discordWebhookEditor.style.display = '';
      discordWebhookReveal.style.display = 'none';
      discordWebhookReveal.setAttribute('aria-expanded', 'true');
      discordWebhookInput.focus();
    });
    discordLayoutInput?.addEventListener('input', scheduleLayoutPreview);
    discordDealerEmbedToggle?.addEventListener('change', scheduleLayoutPreview);
    discordProductEmbedToggle?.addEventListener('change', scheduleLayoutPreview);
    for (const [name, recipe] of Object.entries(LAYOUT_PRESETS)) {
      shadow.getElementById(`tp-discord-layout-preset-${name}`)?.addEventListener('click', () => {
        if (!discordLayoutInput) return;
        const current = discordLayoutInput.value;
        if (!Object.values(LAYOUT_PRESETS).includes(current) && !window.confirm('Layout ersetzen?')) return;
        discordLayoutInput.value = recipe;
        scheduleLayoutPreview();
      });
    }
    shadow.getElementById('tp-discord-layout-chips')?.addEventListener('click', e => {
      const token = e.target?.closest?.('button')?.dataset?.token;
      if (!token || !discordLayoutInput) return;
      const { selectionStart = discordLayoutInput.value.length, selectionEnd = discordLayoutInput.value.length } = discordLayoutInput;
      discordLayoutInput.value = discordLayoutInput.value.slice(0, selectionStart) + token + discordLayoutInput.value.slice(selectionEnd);
      discordLayoutInput.focus();
      scheduleLayoutPreview();
    });
    discordLayoutReset?.addEventListener('click', () => {
      if (!discordLayoutInput) return;
      discordLayoutInput.value = DEFAULT_LAYOUT;
      scheduleLayoutPreview();
    });


    dataResetBtn?.addEventListener('click', () => {
      if (!window.confirm('Wirklich ALLE Suite-Daten löschen? Preis-/Händler-Cache und sämtliche Einstellungen (inkl. Discord-Webhook) werden auf Standard zurückgesetzt.')) return;
      const removed = clearPriceStatsCache();
      clearDealerMemory();
      updateConfigs({ ...DEFAULTS });
      updateBodyClasses();
      syncFieldsFromConfig();
      if (cacheStatsLabel) cacheStatsLabel.textContent = 'Lokaler Cache: 0 Einträge';
      showToast(`Alle Daten gelöscht (${removed} Cache-Einträge, Einstellungen zurückgesetzt)`);
    });

    exportBtn?.addEventListener('click', () => {
      const exportData = {
        _meta: {
          version: (typeof GM_info !== 'undefined' && GM_info?.script?.version) || '2.18.190',
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
          triggerProcessListings();
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

      updates.MARGIN_PERCENT = Math.max(0, Math.min(100, parseFloat(marginVal.value) || 0));
      updates.DIM_OPACITY = Math.max(0.05, Math.min(0.95, parseFloat(opacityRange.value) || 0.25));
      // Cached price stats are shipping-mode specific (product vs shipping series
      // share one cache key), so a mode change must invalidate them.
      const shippingChanged = !!shippingToggle && CONFIG.USE_SHIPPING_PRICE !== shippingToggle.checked;
      if (shippingToggle) updates.USE_SHIPPING_PRICE = shippingToggle.checked;
      // Cached analyses bake in the median horizon — recompute them locally
      // from the retained series (no network) before the single repaint below.
      const rawHorizon = bestpreiseHorizonVal ? parseInt(bestpreiseHorizonVal.value, 10)
        : (bestpreiseHorizonRange ? parseInt(bestpreiseHorizonRange.value, 10) : NaN);
      const newHorizon = isNaN(rawHorizon) ? 365 : (rawHorizon <= 0 || rawHorizon > 730 ? 0 : Math.min(730, Math.max(30, rawHorizon)));
      const horizonChanged = !!(bestpreiseHorizonVal || bestpreiseHorizonRange) && CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS !== newHorizon;
      const checkedSort = shadow.querySelector('input[name="tp-sort-offers"]:checked');
      if (checkedSort) updates.SORT_BY_OFFERS = checkedSort.value;

      updates.ALARM_ENABLED = alarmEnabledToggle.checked;
      updates.ALARM_TARGET_PERCENT = Math.max(0.05, Math.min(0.99, (parseInt(alarmTargetVal.value) || 60) / 100));

      const checkedDur = shadow.querySelector('input[name="tp-alarm-duration"]:checked');
      if (checkedDur) updates.ALARM_DURATION_DAYS = String(parseInt(checkedDur.value, 10) || 730);

      updates.ALARM_AUTO_SUBMIT = alarmAutoSubmitToggle.checked;
      updates.HEATMAP_INTENSITY = clampIntensity01((parseInt(heatmapIntensityVal.value) || 100) / 100);

      if (bestpreiseModeToggle) {
        updates.BESTPREISE_MODE_ACTIVE = bestpreiseModeToggle.checked;
        if (bestpreiseWeightVal) {
          const rawW = parseInt(bestpreiseWeightVal.value, 10);
          const weightNum = isNaN(rawW) ? 50 : rawW;
          updates.BESTPREISE_WEIGHT_RECORD = Math.max(0, Math.min(1.0, weightNum / 100));
        }
        if (bestpreiseHorizonVal || bestpreiseHorizonRange) {
          updates.BESTPREISE_MEDIAN_HORIZON_DAYS = newHorizon;
        }
        if (bestpreiseMinPointsVal) {
          updates.BESTPREISE_MIN_POINTS = clampMinPoints(bestpreiseMinPointsVal.value);
        }
      }
      if (cacheTtlSelect) { const rawC = parseInt(cacheTtlSelect.value, 10); updates.REAL_DEAL_CACHE_HOURS = isNaN(rawC) ? 48 : rawC; }
      if (cacheNegTtlSelect) { const rawN = parseInt(cacheNegTtlSelect.value, 10); updates.NEGATIVE_CACHE_HOURS = isNaN(rawN) ? 2 : rawN; }

      if (realDealMinVal) updates.REAL_DEAL_MIN_DISCOUNT = Math.max(5, Math.min(95, parseInt(realDealMinVal.value) || 30));
      if (sparklinesToggle) updates.ENABLE_SPARKLINES = sparklinesToggle.checked;
      if (dealerAutofetchToggle) updates.DEALER_AUTOFETCH = dealerAutofetchToggle.checked;
      if (discordWebhookInput && discordWebhookEditor && discordWebhookEditor.style.display !== 'none') updates.DISCORD_WEBHOOK_URL = String(discordWebhookInput.value || '').trim();
      if (discordDealerEmbedToggle) updates.DISCORD_SUPPRESS_DEALER_EMBED = !discordDealerEmbedToggle.checked;
      if (discordProductEmbedToggle) updates.DISCORD_SUPPRESS_PRODUCT_EMBED = !discordProductEmbedToggle.checked;
      if (discordLayoutInput) {
        const value = String(discordLayoutInput.value || '');
        const err = validateLayoutRecipe(value);
        if (err) {
          if (discordLayoutError) discordLayoutError.textContent = err;
          return;
        }
        updates.DISCORD_LAYOUT = value;
      }
      if (horizonChanged) recomputeCachedMedians(newHorizon);
      updateConfigs(updates);
      if (shippingChanged) { clearPriceStatsCache(); clearDealerMemory(); }
      showToast('Toppreise Suite Einstellungen gespeichert');
      closeModal();
    });
  }

  // Bell-cog entry point: opens settings via the FAB path (identical sync +
  // show behavior), then scrolls to the requested section with a one-shot
  // flash.
  function openSettingsAt(sectionId) {
    const { shadow } = ensureSkeleton();
    shadow.getElementById('tp-settings-fab')?.click();
    const anchor = shadow.getElementById(sectionId);
    if (!anchor) return;
    anchor.scrollIntoView({ block: 'start' });
    anchor.classList.add('tp-flash');
    setTimeout(() => anchor.classList.remove('tp-flash'), 2000);
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

  // ─── MODULE: src/ui/calc-preview.js ─────────────────────────────────────────
  // Generated RLE Presets for calc-preview
  const PRESET_DATA_S26 = [2,1249,3,1188.05,1,1131.8,1,1136.75,1,1188.05,1,1112.1,3,1079.6,1,1042.25,1,1029.35,1,1030.6,1,1021.45,2,1041.75,1,1010.55,1,1030.45,1,1033.1,1,1032.3,1,1012,1,1010.2,2,1025.55,1,1011.65,1,1005.35,1,997.5,1,996.2,1,1008.7,2,1014.35,1,1013.75,1,1012.45,1,989.15,1,987.7,1,987.75,1,987.25,1,1026.5,1,1026.1,1,1027.2,1,1006.9,1,1032.85,1,992.65,2,992.4,1,971,1,1015.65,1,999.4,1,990.15,3,981.7,1,969.4,1,961.75,1,956.6,1,956.75,1,957.3,1,955.45,1,949.3,1,950,1,944.1,1,957.9,1,964.35,1,939.6,1,939.55,1,939.35,1,939.4,1,945.95,1,946.45,1,947.75,3,949.75,1,945.65,1,937.75,1,943.4,1,946.95,3,944.25,1,943.9,1,946.75,1,936.75,1,934.7,4,937.4,1,937.65,1,943.25,1,935.85,3,927.65,1,926.45,2,934,2,933.7,1,933.9,1,935.6,8,934,1,942.25,1,934,1,931.7,2,927.95,1,927.75,1,935.6,1,934.75,1,930.1,1,936.15,1,930.95,1,933.85,1,924.7,1,928.1,2,927,1,924.95,3,923.65,1,924.25,2,925,1,924.35,1,924.4,2,921.95,1,928.5,1,924.85,1,921.7,1,920.5,3,923.5,1,923.95,1,928,1,926.5,4,927.4,1,919.2,1,920.8,1,921.5,1,922.25,2,917.55,1,918.1,1,915.85,1,915.6,1,915.7,1,914.9,3,918.95,1,917.45,1,917.9,1,919.1,1,920.2,1,928.7,1,921.45,1,922.05,1,922.55,1,921.55,5,928.7,1,927,1,928.7,1,928.2,9,928.7,9,929,1,847,3,929,1,960.35,6,929,3,948.65,4,949,4,948.65,1,956.5,1,959,1,956.8,1,955.75,2,953.25,1,959];
  const PRESET_DATA_R5 = [8,4479,17,4478,12,4319,7,4477.09,1,4478,3,4479,1,4478.6,29,4479,21,4478.9,1,4479,3,4478.9,1,3999,8,4477.9,3,4478.9,1,4399,14,4398.9,10,4478.9,65,4479,2,4319,48,4479,1,4528,4,4479,7,4218,2,4298,1,4200,38,4479,2,4031.1,50,4479,54,4478.95,2,4478,13,4478.95,1,4478,5,4478.95,3,4478,4,4478.95,2,4478,1,4478.95,2,4478,1,4478.95,2,4478,18,4477.95,2,3899,1,4477.95,1,3899,6,4477.95,2,3899,4,3898,2,3849,1,4477,61,4477.95,8,4477,2,4199,1,4477,6,4477.95,2,4199,1,4299,2,4031.9,11,4299,3,4477,1,4299,2,3999,1,4099,1,4299,18,4477,7,4476,2,4319,1,3899,6,4476,3,4188.5,4,4476,3,3899,3,4477,4,3990,7,3989.9,1,3910.2,11,3821,2,3210,6,3821,1,3489.9,6,3821,3,3625,5,3699,1,3728,1,3798,4,3899,1,3799,2,3798,6,3897.9,1,3798,2,3795,2,3698,1,3695,1,3698,2,3895,2,3470.1,2,3590,1,3699,2,3498,3,3890,1,3498,2,3890,2,3885,3,3349,2,3625,1,3799,1,3889,1,3888,1,3887,1,3790,1,3885,1,3884,5,3875,1,3869,1,3868,4,3847.05,2,3846,2,3845,1,3844,1,3843,3,3599,2,3501,1,3497,3,3398,6,3497,2,3399,4,3497,1,3399,1,3212,1,3399,2,3395,1,3495,4,3493,1,3395,5,3493,2,3349,5,3493,2,3299.9,1,3298,7,3299.9,1,3438,16,3499,1,3149,15,3499,1,3585,2,3584,3,3580,7,3583,4,3149,4,3547,13,3548,13,3284.9,1,3149,5,3547,1,3546,1,3419.9,2,3545,1,3544,6,3528,2,3546,1,3545,3,3540,2,3544,4,3543,1,3544,1,3543,6,3457,3,3543,1,3542,2,3540,4,3499,3,3498,1,3497,3,3495,1,3494,2,3489,15,3499,11,3498,2,3229.9,2,3428,2,3495,11,3225.6,3,3329.9,1,3328,1,3144.9,1,3144,8,3324,1,3199,2,3324,7,3495,4,3490,1,3349,1,3490,13,3299,12,3399,7,3149.9,1,3020,1,3149.9,5,3148,3,3298,9,3299.9,2,3299,5,3399,1,3114.9,2,3399,6,3360,4,2999.9,4,3149,6,3398,5,3298,2,2969.9,3,3298,1,3198,3,3298,2,2969.9,5,2999,3,2985,4,2999,2,3360,3,3359,1,3348,1,3295,4,3298,1,3240,3,3235,3,3298,1,3295,1,3294,1,3284,16,3370.45,6,3369,3,3358,8,3356,6,3249,3,3194.1,2,3194,1,3099,25,3098,9,2790,1,3079.95,4,2683.95,2,2920,1,3078,1,2920,2,2919,1,2915,1,2988,5,3079,1,3078,56,3078.5,21,3098,22,3194,4,2650,6,3194,79,3189,16,2899,6,3149,1,3148,1,2799,1,2798,2,2749,2,2748,3,2799,4,3144,5,2799,4,2798,9,2499,3,2798,1,2883,3,2949,3,2998,1,2999,9,2799,1,2898,5,2997,10,2949,1,2748,1,2798,18,2795,20,2609.1,1,2519.1,14,2797,23,2795,4,2749,26,2795,1,2749,5,2795,59,2794,1,2498,25,2497,1,2499,1,2676.15,6,2755.45,1,2750,39,2755.45,3,2794,10,2789,1,2519.95,22,2789,1,2491.95,2,2789,5,2198,2,2789,1,1998,2,2794,1,1998,13,1997,3,2788,1,2499,10,2480,8,1998,13,2483.06,1,2496,2,2649.8,4,2556,1,2649.8,12,2299,2,2556,7,2785,1,1899,6,2785,6,2750,14,2298,4,2696,5,2648,1,2485.5,1,2478,4,2399,14,2398,2,2749.95,8,2696,2,2449,6,2696,2,2519.95,11,2696,13,2695,4,2298,10,2695,1,1799,3,1998,24,2695,2,2198,7,1386.75,4,2689.95,16,2679.95,3,1998,1,1649.95,6,1998,4,1948,6,1848,13,1948,5,2678,3,2750,8,1848,4,2678,10,2698,3,2495.5,8,1848];
  const PRESET_DATA_SSD990 = [3,310.1,1,296.2,3,294.75,1,293.4,1,292.9,1,291.25,1,291.5,6,291.65,1,288.4,3,291.65,1,287.9,1,290.2,1,288.5,1,287.75,3,290.5,4,291.65,1,300.9,1,290,1,294.4,1,293.85,1,294.4,1,293.5,1,293.8,3,296.8,1,296.7,1,296.85,1,296.9,21,296.8,2,296.9,2,295.75,1,293,2,292,1,291.6,6,292,1,290,1,291.85,2,292,1,290.3,1,287.35,2,284.95,2,285.2,1,285.25,1,285.2,1,284.95,1,285,6,284.95,1,276.8,1,292.1,1,284.85,2,284.9,1,283.09,1,282.23,1,281.71,1,282.17,4,282.6,1,283.12,1,282.49,1,278.25,1,277.9,1,274.25,6,274.3,1,274.35,3,274.3,1,275.8,1,278.75,5,279,1,277.4,1,277,1,275.7,4,276,1,277,1,275,1,275.35,1,275.4,1,275.35,1,275.05,1,275.5,2,217,1,216.9,2,216.95,1,216.9,1,216.85,6,215.35,1,215,1,215.05,1,212.65,1,212.9,2,212.2,1,212.15,1,211.75,1,212.55,1,211.6,2,212.1,1,212.15,1,212.75,1,212.45,1,207.7,1,206.2,1,205.25,1,205.8,1,205.75,1,205.35,1,205,1,201.25,1,200.95,4,199.65,1,203.5,1,202.31,1,208.78,5,208,4,189,1,208,7,189,2,208,1,207.99,1,207.5,5,205,2,203.65,3,203.1,1,203,1,203.1,1,199.4,1,206.08,1,198.9,1,198.7,1,198.65,1,205.86,1,187.3,1,186.95,1,202,3,188.15,8,178,1,179,2,178.9,12,178,1,177.95,1,178,4,164.75,1,164.46,1,164.25,1,164.6,1,164.65,1,164.5,1,164.35,1,164.2,1,160.4,1,160.35,1,160.9,3,160.25,1,160.45,1,161.6,1,161.35,1,161.3,3,160.14,1,160.17,1,158.25,1,157.8,1,157.75,1,158.55,2,158,1,157.4,1,157.45,1,154.35,1,158.2,3,157.35,1,157.3,1,157.15,1,157,2,149,1,153.1,1,154,1,153.9,1,158,1,156.8,1,156.65,1,156.5,1,156.35,1,156.2,1,156.05,1,156.2,1,155.6,1,154.25,1,152.55,1,152.5,1,152.55,1,152.4,1,149.15,1,149.75,1,149.65,3,149.75,2,150.5,1,152,1,155.02,3,155.33,1,155.76,1,155.15,1,155.05,1,155.5,2,155.63,1,155.4,1,154.85,1,155.13,1,155.44,1,153.05,3,151.1,1,151.6,1,151.3,1,151.25,1,150.95,3,151.3,1,151.2,1,151.45,1,151.3,1,151.85,1,151.5,2,151.6,1,148.55,11,129,2,151,1,150.9,1,151.9,2,151,4,152.9,6,153.9,1,149.5,1,149.75,1,149.6,1,149.85,3,149.75,1,152.71,1,147.24,1,147.62,1,147.32,1,147.23,2,145.96,1,132.87,1,149.9,1,149.75,1,139,1,136.63,2,136.8,1,136.97,1,137.73,1,137.04,1,137.09,1,137.38,2,137.96,1,138.1,1,138.46,1,143.54,1,141.62,1,142.45,1,144.75,1,143.09,1,143.78,1,143.8,1,143.71,1,139.3,1,143.9,1,140.45,1,143.93,2,151,1,153.9,1,152.9,1,122.18,2,122.47,1,122.39,1,122.66,1,133.52,1,133.29,1,138.03,1,139.83,2,153,1,164.99,1,148.33,1,147.26,1,155.65,2,149.77,1,149.88,1,154.04,1,149.15,1,148.85,3,149.4,3,161,1,160.9,1,161,4,161.9,2,152.9,6,151.9,1,152.9,5,149.9,7,150.9,5,156.9,1,165.9,2,161.9,4,162.9,1,167.85,1,168.4,1,168,1,153.71,1,143.46,1,143.18,1,153.32,1,152,1,142.48,1,152,1,142.39,1,152,3,151.9,2,152,1,153.25,1,154.15,1,155.05,1,155.95,1,163.3,1,154.2,1,155.22,1,155.24,1,150.77,2,155.18,1,151.04,1,145.11,1,162,6,163.3,1,155.76,1,159,1,156.3,4,154,1,152.62,5,148.9,2,141.9,1,142.35,3,142.3,1,142.35,2,142.8,1,143.35,3,144.25,1,143.55,1,144.2,1,150.63,1,144.85,4,144,1,143.7,1,144.65,1,144.8,1,169.5,2,168,2,146,12,152.1,1,163,1,169.25,1,170,1,160.54,1,161,2,160.78,1,148.44,1,148.1,2,148.83,1,149.04,1,148.15,1,147.82,1,148.6,1,148.8,1,144.55,1,148.75,4,148.85,1,149.4,2,146.92,1,166.1,1,162,1,164,1,163,1,167.1,1,166.05,1,166.3,3,166,2,165.7,1,165.35,1,164.9,3,163.35,1,163.4,1,161.88,1,161.9,1,161.61,1,158.89,3,166.6,1,157.68,1,157.99,1,158.43,3,156.23,1,156.68,1,157.11,1,157.01,1,157.67,3,157.52,1,158.33,1,157.85,2,157.9,3,159.45,1,155.99,1,156.12,1,156.46,1,156.44,3,156.65,1,156.34,1,156.36,1,156,1,156.41,3,157.8,1,156.51,1,156.61,1,155.52,1,147.63,1,147.73,2,147.62,1,147.69,1,147.83,1,147.62,1,146.12,1,145.98,3,146.35,1,146.41,1,145.81,1,145.89,1,144.57,2,143.86,1,143,1,143.93,1,143.79,1,144.38,1,145.27,2,144.94,1,145.17,1,145.42,1,149.22,1,149.62,1,150.16,2,149.93,1,149.79,1,145.24,1,144.48,2,144.3,2,144.24,1,144.1,2,141.94,1,140.24,1,140.64,1,140.69,1,145.53,1,140.66,3,143.37,1,139.41,1,140.05,1,146.84,1,139.37,1,139.45,1,138.68,1,139.78,1,140.1,2,140.78,1,140.65,1,140,1,139.66,1,139.62,1,139.86,2,140.48,1,140.58,1,139.34,1,139.55,1,140.17,1,140.06,2,138.89,1,139.06,1,142.2,1,140.27,1,138.62,3,140.36,1,140.27,1,152.45,1,153.15,1,143.72,1,143.03,2,146.94,1,147.43,1,144,1,147.24,1,146.97,3,147.3,1,146.97,1,146.74,1,140.42,1,140.55,3,141.05,1,140.82,1,140.85,2,141.22,2,142.9,1,145.74,1,145.48,1,145.36,1,129.48,1,133.52,1,130.83,3,130.5,1,144.62,1,145,1,144.85,3,145.16,1,144.77,1,99.95,1,142.9,1,121.87,3,142.9,1,141.9,6,142.9,1,114.19,1,142.9,2,143.86,3,143.53,1,143.7,1,143.27,1,143.47,1,144.08,1,145.1,2,138.77,2,139,1,145.05,1,144.08,3,143.73,2,147.9,6,148.9,1,149.9,2,148.9,3,150.95,1,152.1,1,152.35,1,152.2,1,155.05,3,152.7,2,153.65,1,156.15,1,155.55,3,155.15,1,153.35,1,153.7,1,153.5,1,153.4,3,151.7,1,152.15,1,151.45,1,151.25,1,151.55,3,151.6,1,147.7,1,147.9,1,151.65,1,151.4,1,151.9,2,153.7,1,150.85,1,150.65,1,150.8,1,151.3,2,150.8,1,151.8,1,151.75,2,151.7,1,151.4,3,148.05,1,147.9,1,147.5,1,147.4,1,146.85,3,146.15,1,147.05,1,147.1,1,151.05,1,153.15,3,149.05,1,151.9,1,152.1,1,152.55,1,147.25,3,146.95,1,147.45,1,147.8,1,148.2,1,152.4,2,152.6,1,152.8,1,152.55,1,149.55,1,149.35,1,148.9,1,149.35,1,150.25,1,150.15,1,149.3,1,150,1,149.55,1,150,3,148.85,1,148.05,1,146.9,1,145.65,1,147.1,1,144.7,1,145.05,1,145.3,1,145.25,1,145,1,145.65,1,145.4,5,145.95,1,146.6,1,147.4,1,147.65,1,145.55,1,145.75,1,141.35,1,140.69,1,144.55,1,144.45,3,144.8,1,144.05,1,143.1,2,139.62,3,139.15,1,139.46,1,139.68,1,139.97,1,140.12,1,139.27,3,139.38,1,139.78,1,138.94,1,139.22,1,139.31,2,137.4,1,143.9,1,143.6,1,144.05,1,144.4,3,141.35,1,141.45,1,141.55,1,140.75,1,110.97,4,139.95,1,140.2,1,140.5,1,140.8,3,139.01,1,139.52,1,136.17,1,136.27,1,136.07,3,136.44,1,136.04,1,135.91,1,135.53,1,135.79,3,135.5,1,135.33,1,134.99,1,135.08,1,139.95,1,140.15,1,140.25,1,140.35,1,140.15,1,135.82,1,126.39,1,126.15,1,126.1,1,139.4,1,139.6,1,139.35,1,139.4,1,138.55,1,138.45,3,138.8,1,138.55,1,138.7,1,135.28,1,138.35,3,138.45,1,138.4,1,137.85,5,137.75,1,126.11,1,138.4,1,138.3,4,128.95,1,129.76,1,129.95,1,143,1,139.6,3,139.35,1,139.7,1,139.35,1,139.25,1,138.85,2,139.2,1,129.46,1,123.78,1,123.38,1,123.23,1,122.9,1,123.3,2,123.26,1,123.32,2,123.46,26,129.47,1,137.1,1,128.38,1,136.84,1,136.89,2,136.7,1,136.57,1,136.29,1,136.23,1,136.47,1,136.55,2,136.16,1,136.3,1,136.17,1,136.06,1,135.69,1,135.45,2,135.36,1,133.67,1,133.31,1,133.44,1,133.55,1,138.41,1,133.63,1,138.58,1,138.64,1,133.71,1,133.49,1,134.12,3,129.95,3,139.95,3,144.95,1,144.5,1,143.5,1,142.5,1,138.97,1,140.08,1,139.5,1,138.5,1,137.5,2,137.3,1,147.1,6,162.8,2,169.95,1,143.24,2,169.95,3,179,5,184.95,1,170.59,1,170.3,1,169.72,1,169.49,2,169.81,1,169.76,1,169.94,1,169.74,1,169.66,1,169.34,1,169.27,1,178.58,1,178.48,7,184.95,1,184.35,1,183.35,1,182.35,1,181.35,1,180.35,1,179.35,1,178.35,7,184.95,1,204.86,2,206,1,184.95,7,206,2,205.53,1,205.14,1,184.95,1,204.41,1,204.1,1,203.85,2,197.16,1,196.48,1,204.55,1,204.07,1,204.1,1,204.19,2,203.98,1,204.1,1,203.1,1,202.39,1,203.56,1,203.25,2,202.82,1,202.83,1,213.61,1,214.05,1,213.64,1,213.82,2,214.1,1,214,1,214.18,1,213.67,1,213.89,1,213.92,1,212.88,1,216.49,1,220.08,1,221.63,1,235.95,1,235.85,6,184.95,1,234.49,1,235.68,1,235.19,3,263,2,235.87,1,237.48,2,237.26,1,237.27,1,237.76,1,240.5,1,248.84,1,238.99,2,241.53,1,241.5,1,240.57,1,242.28,1,243.63,1,243.73,1,244.13,1,243.93,2,243.82,1,243.79,1,243.91,1,244.31,2,244.6,1,244.61,1,243.55,1,242.67,1,242.93,1,243.2,2,242.24,1,242.4,1,241.81,1,241.51,1,242.14,1,242.22,2,242.33,1,242.5,1,242.67,1,243.36,1,251.58,1,249.84,2,249.62,4,264,2,276.15,2,265.93,1,266.52,2,265.49,2,265.17,1,269.99,1,270.02,1,270.12,1,270.49,1,270.11,1,269.78,2,271.36,1,275.3,1,274.85,1,288.35,1,288.7,1,288.4,2,288.65,1,288.4,1,289,1,289.6,1,289.7,3,289.9,1,289.85,2,289.7,1,289.8,16,289.7,1,279.95,5,289.7,2,291.6,1,291.8,1,292.2,5,294.7,1,292,1,293.35,1,294.75,1,294.7,3,293.05,1,294.7,3,189,10,294.7,11,294.65,4,294.95,1,294.65,1,285.5,14,294.65,1,305.55,3,304.8,1,306.85,1,298.7,13,299,2,298.7,2,299,1,298.7,1,299,1,298.7,1,307.15,1,307.9,1,307.45,1,310.25,1,311.45,1,219,2,311.45,6,310.3];


  const DAY_MS = 86400000;

  const PRESET_DATA_SYNTHETIC = [1,425,1,422,1,428,1,419,1,424,1,421,1,427,1,423,1,418,1,426,1,150,1,429,1,424,1,420,1,426,1,2500,1,422,1,419,1,425,1,421,1,427,1,423,1,420];

  function expandRleSeries(flat, now = Date.now()) {
    const pts = [];
    if (!Array.isArray(flat) || flat.length < 2) return pts;
    let total = 0;
    for (let i = 0; i + 1 < flat.length; i += 2) total += Math.max(0, flat[i] | 0);
    let ts = now - (total - 1) * DAY_MS;
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const count = Math.max(0, flat[i] | 0);
      const price = flat[i + 1];
      for (let k = 0; k < count; k++) {
        pts.push([ts, price]);
        ts += DAY_MS;
      }
    }
    return pts;
  }

  const PRESETS = {
    s26: { id: 's26', label: '📱 Galaxy S26 Ultra (230d)', cardPrice: 799, rle: PRESET_DATA_S26 },
    r5: { id: 'r5', label: '📷 Canon EOS R5 (6J)', cardPrice: 1299, rle: PRESET_DATA_R5 },
    ssd990: { id: 'ssd990', label: '💾 Samsung 990 PRO (4J)', cardPrice: 89.95, rle: PRESET_DATA_SSD990 },
    synthetic: { id: 'synthetic', label: '🧪 Glitch-Demo (23 Pkt)', cardPrice: 400, rle: PRESET_DATA_SYNTHETIC },
  };

  function getPreset(id) {
    return PRESETS[id] || PRESETS.s26;
  }

  const fmtPreviewMedian = v => String(Number(v.toFixed(2)));

  function previewStats(points, o) {
    const band = o?.band ?? 0.60;
    const hours = o?.hours ?? 48;
    const enabled = o?.enabled !== false;
    const horizonDays = o?.horizonDays ?? 365;
    const wRaw = o?.weightRecord ?? 0.50;
    const weightRecord = Math.max(0, Math.min(1, wRaw));
    const minPoints = clampMinPoints(o?.minPoints ?? 5);
    const cardPrice = o?.cardPrice ?? 0;
    const now = o?.now ?? Date.now();

    const san = enabled
      ? sanitizeTimeSeries(points, band, hours)
      : { cleanPoints: points || [], filteredOutliers: [] };
    const clean = san.cleanPoints || [];
    const prices = clean.map(p => p[1]);
    const tiefstpreis = prices.length ? Math.min(...prices) : 0;
    const hoechstpreis = prices.length ? Math.max(...prices) : 0;

    let windowPrices = prices;
    let windowCount = prices.length;
    let medianFallback = false;
    if (horizonDays > 0) {
      const cutoff = now - horizonDays * DAY_MS;
      const w = clean.filter(p => p[0] >= cutoff);
      if (w.length >= 3) {
        windowPrices = w.map(p => p[1]);
        windowCount = w.length;
      } else {
        medianFallback = true;
      }
    }
    const sorted = [...windowPrices].sort((a, b) => a - b);
    const n = sorted.length;
    const rawMedian = n === 0 ? 0 : (n % 2 ? sorted[n >> 1] : (sorted[(n >> 1) - 1] + sorted[n >> 1]) / 2);
    const median = Math.round(rawMedian * 100) / 100;

    const dMedian = median > cardPrice ? pctDrop(median, cardPrice) : 0;
    const live = recordRefForPrice({ timeSeries: clean }, cardPrice);
    const dRecord = (live.isNewRecord && live.previousLow > cardPrice) ? pctDrop(live.previousLow, cardPrice) : 0;

    const varianceOk = tiefstpreis > 0 && (hoechstpreis - tiefstpreis) / tiefstpreis >= 0.02;
    const qualifies = clean.length >= minPoints && varianceOk
      && priceToCents(cardPrice) <= priceToCents(tiefstpreis) && (dMedian > 0 || dRecord > 0);
    const badge = qualifies
      ? Math.max(1, Math.round((1 - weightRecord) * dMedian + weightRecord * dRecord))
      : null;
    const recordLow = live.previousLow ?? 0;
    const cutoffTs = horizonDays > 0 && !medianFallback ? now - horizonDays * DAY_MS : null;

    return { median, medianFallback, windowCount, activeCount: clean.length, dropped: san.filteredOutliers || [], tiefstpreis, dMedian, dRecord, badge, qualifies, clean, recordLow, cutoffTs };
  }

  function cropPreviewWindow(clean, dropped, cutoffTs) {
    if (cutoffTs === null || cutoffTs === undefined) return { visible: clean || [], visibleDropped: dropped || [] };
    return {
      visible: (clean || []).filter(p => p[0] >= cutoffTs),
      visibleDropped: (dropped || []).filter(g => g.timestamp >= cutoffTs),
    };
  }

  const PV_MARGIN = { top: 8, right: 10, bottom: 16, left: 34 };

  function previewCoords(clean, o = {}) {
    const w = o.w || 296;
    const h = o.h || 110;
    const m = PV_MARGIN;
    const innerW = w - m.left - m.right;
    const innerH = h - m.top - m.bottom;
    const pts = clean || [];
    const n = pts.length;
    const prices = pts.map(p => p[1]);
    const vals = [...prices];
    for (const g of (o.dropped || [])) if (typeof g.price === 'number' && g.price > 0) vals.push(g.price);
    if (typeof o.cardPrice === 'number' && o.cardPrice > 0) vals.push(o.cardPrice);
    if (typeof o.median === 'number' && o.median > 0) vals.push(o.median);
    let lo = vals.length ? Math.min(...vals) : 0;
    let hi = vals.length ? Math.max(...vals) : 1;
    if (!(hi > lo)) hi = lo + 1;
    const pad = (hi - lo) * 0.05;
    const y = v => m.top + (1 - (v - (lo - pad)) / ((hi + pad) - (lo - pad))) * innerH;
    const x = i => m.left + (n > 1 ? (i / (n - 1)) * innerW : 0);
    const f1 = v => v.toFixed(1);
    const pt = (p, i) => `${f1(x(i))},${f1(y(p[1]))}`;
    const pointsAttr = pts.map(pt).join(' ');
    const recordY = (typeof o.recordLow === 'number' && o.recordLow > 0) ? y(o.recordLow) : null;
    let bandRect = null;
    if (o.band > 0 && o.median > 0) {
      const top = m.top, bot = m.top + innerH;
      const y1 = Math.max(top, Math.min(bot, y(o.median * (1 + o.band))));
      const y2 = Math.max(top, Math.min(bot, y(o.median * (1 - o.band))));
      bandRect = y2 >= y1 ? { x: m.left, y: y1, width: innerW, height: y2 - y1 } : null;
    }
    const medianY = o.median > 0 ? y(o.median) : null;
    const t0 = n ? pts[0][0] : 0;
    const t1 = n ? pts[n - 1][0] : 0;
    const glitchXY = (o.dropped || []).map(g => {
      const frac = t1 > t0 ? Math.max(0, Math.min(1, (g.timestamp - t0) / (t1 - t0))) : 0;
      return { x: m.left + frac * innerW, y: y(g.price) };
    });
    const anchor = (typeof o.cardPrice === 'number' && o.cardPrice > 0)
      ? { x: m.left + innerW, y: y(o.cardPrice) }
      : null;
    const ticks = [{ y: y(hi), label: fmtPreviewMedian(hi) }, { y: y(lo), label: fmtPreviewMedian(lo) }];
    if (o.median > 0) ticks.splice(1, 0, { y: y(o.median), label: fmtPreviewMedian(o.median) });
    return { pointsAttr, bandRect, medianY, glitchXY, anchor, ticks, recordY };
  }

  let activePresetId = 's26';

  function buildCalcPreview() {
    const box = document.createElement('div');
    box.id = 'tp-calc-preview';
    const opts = Object.values(PRESETS).map(p => `<option value="${p.id}"${p.id === 's26' ? ' selected' : ''}>${p.label}</option>`).join('');
    box.innerHTML = `<div class="tp-preview-head"><span>Live-Vorschau</span><select id="tp-preview-preset-select" class="tp-preview-select" title="Demo-Historie für die Vorschau">${opts}</select></div>`
      + `<div id="tp-preview-key"><span><span class="tp-pv-k-main">—</span> Verlauf</span><span><span class="tp-pv-k-med">– –</span> Ø</span><span><span class="tp-pv-k-rec">····</span> Rekord</span><span><span class="tp-pv-k-g">×</span> Glitch</span></div>`
      + `<svg id="tp-preview-svg" viewBox="0 0 296 110" preserveAspectRatio="none" role="img" aria-label="Preisverlauf-Vorschau"></svg>`
      + `<div id="tp-preview-legend"></div><div id="tp-preview-blend"></div><div id="tp-preview-status"></div>`;
    const sel = box.querySelector('#tp-preview-preset-select');
    if (sel) sel.addEventListener('change', () => {
      activePresetId = sel.value || 's26';
      refreshCalcPreview();
    });
    return box;
  }

  function refreshCalcPreview() {
    const svg = document.getElementById('tp-preview-svg');
    const legend = document.getElementById('tp-preview-legend');
    const blend = document.getElementById('tp-preview-blend');
    const status = document.getElementById('tp-preview-status');
    if (!svg || !legend || !blend || !status) return;
    const sel = document.getElementById('tp-preview-preset-select');
    const preset = getPreset(sel ? sel.value : activePresetId);
    activePresetId = preset.id;
    const now = Date.now();
    const points = expandRleSeries(preset.rle, now);
    const num = (id, fb) => {
      const el = document.getElementById(id);
      if (!el) return fb;
      const v = parseInt(el.value, 10);
      return isNaN(v) ? fb : v;
    };
    const weightRecord = Math.max(0, Math.min(1, num('tp-bar-weight-range', 50) / 100));
    const hRaw = num('tp-bar-horizon-range', 365);
    const horizonDays = hRaw > 730 ? 0 : hRaw;
    const rangeEl = document.getElementById('tp-bar-minpoints-range');
    const minPoints = minPointsFromIndex(rangeEl ? rangeEl.value : undefined);
    const toggle = document.getElementById('tp-bar-outlier-toggle');
    const enabled = toggle ? toggle.checked : true;
    const band = Math.min(90, Math.max(20, num('tp-bar-outlier-band-range', 60))) / 100;
    const hours = Math.min(168, Math.max(12, num('tp-bar-outlier-hours-range', 48)));
    const st = previewStats(points, { band, hours, enabled, horizonDays, weightRecord, minPoints, cardPrice: preset.cardPrice, now });
    const { visible, visibleDropped } = cropPreviewWindow(st.clean, st.dropped, st.cutoffTs);
    const co = previewCoords(visible, { median: st.median, band: enabled ? band : 0, cardPrice: preset.cardPrice, dropped: visibleDropped, recordLow: st.recordLow });
    const f1 = v => v.toFixed(1);
    const mainStroke = st.activeCount < minPoints ? '#94a3b8' : '#3b82f6';
    let s = '';
    if (co.bandRect) {
      const r = co.bandRect;
      s += `<rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.width)}" height="${f1(r.height)}" fill="rgba(59,130,246,0.08)" stroke="#3b82f6" stroke-opacity="0.45" stroke-dasharray="3 2"/>`;
    }
    for (const t of co.ticks) {
      s += `<text x="2" y="${f1(t.y + 3)}" font-size="9" fill="#64748b">${t.label}</text>`;
    }
    if (st.recordLow > 0 && st.dRecord > 0 && co.recordY !== null) {
      s += `<line class="tp-pv-rec" x1="${PV_MARGIN.left}" x2="${296 - PV_MARGIN.right}" y1="${f1(co.recordY)}" y2="${f1(co.recordY)}" stroke="#f59e0b" stroke-dasharray="4 3" stroke-width="1" opacity="${0.25 + 0.75 * weightRecord}"/>`;
    }
    if (co.medianY !== null) {
      s += `<line x1="${PV_MARGIN.left}" x2="${296 - PV_MARGIN.right}" y1="${f1(co.medianY)}" y2="${f1(co.medianY)}" stroke="#64748b" stroke-dasharray="4 3" stroke-width="1" opacity="${0.25 + 0.75 * (1 - weightRecord)}"/>`;
    }
    if (co.pointsAttr) {
      s += `<polyline class="tp-pv-main" points="${co.pointsAttr}" fill="none" stroke="${mainStroke}" stroke-width="1.5"/>`;
    }
    for (const g of co.glitchXY) {
      s += `<text x="${f1(g.x)}" y="${f1(g.y - 3)}" font-size="10" fill="#f43f5e" text-anchor="middle">×</text>`;
    }
    if (co.anchor) {
      s += `<line x1="${PV_MARGIN.left}" x2="${f1(co.anchor.x)}" y1="${f1(co.anchor.y)}" y2="${f1(co.anchor.y)}" stroke="${mainStroke}" stroke-dasharray="2 2" stroke-width="1"/>`;
      s += `<circle cx="${f1(co.anchor.x)}" cy="${f1(co.anchor.y)}" r="3" fill="${mainStroke}" stroke="#fff" stroke-width="1"/>`;
    }
    svg.innerHTML = s;
    const n = st.dropped.length;
    legend.textContent = `${n} Glitch${n === 1 ? '' : 'es'} gefiltert (${hours} h, ±${Math.round(band * 100)} %)`;
    blend.textContent = st.qualifies
      ? `Badge \u2212${st.badge}% = \u00d8 \u2212${st.dMedian}% (${100 - Math.round(weightRecord * 100)}%) + Rekord \u2212${st.dRecord}% (${Math.round(weightRecord * 100)}%)`
      : 'kein Tiefstpreis zum Demo-Preis \u2013 kein Badge';
    const windowPart = horizonDays === 0 ? `${st.windowCount} Punkte` : `${st.windowCount} im Fenster`;
    status.textContent = `\u00d8 ${fmtPreviewMedian(st.median)} \u00b7 ${horizonText(horizonDays)} \u00b7 ${windowPart} \u00b7 ${st.activeCount} aktiv (min. ${minPoints} ${st.activeCount >= minPoints ? '\u2713' : '\u2717'})`;
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

  function bindBestpreiseBtn(btn) {
    btn.onclick = () => {
      const next = !CONFIG.BESTPREISE_MODE_ACTIVE;
      cancelBestpreiseScan();
      updateConfig('BESTPREISE_MODE_ACTIVE', next);
      showToast(next ? '💎 Neue Tiefstpreise-Modus aktiviert' : 'Tiefstpreise-Modus deaktiviert');
    };
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
    let deb;
    weightRange.oninput = () => {
      paintWeightLabel();
      clearTimeout(deb);
      deb = setTimeout(() => {
        updateConfig('BESTPREISE_WEIGHT_RECORD', readWeight());
      }, 1000);
    };
    weightRange.onchange = () => {
      clearTimeout(deb);
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
      <span class="tp-stepper-label">Gewichtung</span>
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

  function bindMinPointsControls(wrapper) {
    if (!wrapper) return;
    const range = wrapper.querySelector('#tp-bar-minpoints-range');
    const label = wrapper.querySelector('#tp-bar-minpoints-label');
    if (!range) return;
    const readNum = () => minPointsFromIndex(range.value);
    const paint = () => { if (label) label.textContent = `📊 ${readNum()} Pkt`; };
    paint();
    let deb;
    range.oninput = () => {
      paint();
      clearTimeout(deb);
      deb = setTimeout(() => updateConfig('BESTPREISE_MIN_POINTS', readNum()), 1000);
    };
    range.onchange = () => {
      clearTimeout(deb);
      const n = readNum();
      paint();
      updateConfig('BESTPREISE_MIN_POINTS', n);
      showToast(`Mindestanzahl Datenpunkte in der Preishistorie: ${n} (≈ Tage)`);
    };
  }

  function buildMinPointsWrapper() {
    const cur = clampMinPoints(CONFIG.BESTPREISE_MIN_POINTS);
    const wrapper = document.createElement('div');
    wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
    wrapper.id = 'tp-bar-minpoints-wrapper';
    wrapper.title = 'Mindestanzahl Datenpunkte in der Preishistorie für den Ø-Vergleich (Punkte ≈ Tage). Darunter kein Blend — Karte wird Fallback-Tief.';
    wrapper.innerHTML = `
      <span class="tp-stepper-label">Mindestpunkte</span>
      <span class="tp-weight-label" id="tp-bar-minpoints-label">📊 ${cur} Pkt</span>
      <input type="range" id="tp-bar-minpoints-range" min="0" max="${MIN_POINTS_STEPS.length - 1}" step="1" value="${minPointsToIndex(cur)}" title="Mindestanzahl Datenpunkte: 1–5 fein, dann 10er-Schritte bis 100">`;
    bindMinPointsControls(wrapper);
    return wrapper;
  }

  function bindHorizonControls(wrapper) {
    if (!wrapper) return;
    const range = wrapper.querySelector('#tp-bar-horizon-range');
    const label = wrapper.querySelector('#tp-bar-horizon-label');
    if (!range) return;
    const readHorizon = () => {
      const raw = parseInt(range.value, 10);
      return isNaN(raw) ? 365 : (raw > 730 ? 0 : raw);
    };
    const paintHorizonLabel = () => {
      if (!label) return;
      const v = readHorizon();
      label.textContent = horizonText(v);
      label.title = horizonText(v, 'title');
    };
    paintHorizonLabel();
    let deb;
    range.oninput = () => {
      paintHorizonLabel();
      clearTimeout(deb);
      deb = setTimeout(() => {
        const v = readHorizon();
        recomputeCachedMedians(v);
        updateConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', v);
      }, 1000);
    };
    range.onchange = () => {
      clearTimeout(deb);
      const v = readHorizon();
      paintHorizonLabel();
      recomputeCachedMedians(v);
      updateConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', v);
      showToast(`Ø-Vergleichszeitraum: ${horizonText(v)} — live aktualisiert`);
    };
  }

  function buildHorizonWrapper() {
    const cur = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365;
    const wrapper = document.createElement('div');
    wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
    wrapper.id = 'tp-bar-horizon-wrapper';
    wrapper.title = 'Median-Berechnungszeitraum für den Ø-Preis (Duplikat der Modal-Einstellung). Wechsel rechnet gecachte Mediane lokal neu — ohne Netz.';
    wrapper.innerHTML = `
      <span class="tp-stepper-label">Ø-Zeitraum</span>
      <span class="tp-weight-label" id="tp-bar-horizon-label" title="${horizonText(cur, 'title')}">${horizonText(cur)}</span>
      <input type="range" id="tp-bar-horizon-range" min="30" max="760" step="30" value="${cur === 0 ? 760 : cur}" title="${horizonText(cur, 'title')}">`;
    bindHorizonControls(wrapper);
    return wrapper;
  }

  function bindOutlierControls(wrapper) {
    const toggle = wrapper.querySelector('#tp-bar-outlier-toggle');
    if (!toggle) return;
    syncMiniToggle(toggle, CONFIG.OUTLIER_REJECTION_ENABLED !== false, 'Ausreißer-Filter');
    paintOutlierDim();
    toggle.onchange = () => {
      recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      updateConfig('OUTLIER_REJECTION_ENABLED', toggle.checked);
      syncMiniToggle(toggle, toggle.checked, 'Ausreißer-Filter');
      paintOutlierDim();
      showToast(toggle.checked ? 'Ausreißer-Filter AN — Glitches werden ignoriert' : 'Ausreißer-Filter AUS — Rohhistorie wird verwendet');
    };
  }

  function buildOutlierWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
    wrapper.id = 'tp-bar-outlier-wrapper';
    wrapper.title = 'Kurze Preissprünge (Band und Fenster unten einstellbar) als Feed-Glitches ignorieren. AUS = Rohhistorie verwenden.';
    wrapper.innerHTML = `
      <label class="tp-mini-switch" title="Ausreißer-Filter">
        <input type="checkbox" id="tp-bar-outlier-toggle" ${CONFIG.OUTLIER_REJECTION_ENABLED !== false ? 'checked' : ''}>
        <span class="tp-mini-slider"></span>
      </label>
      <span class="tp-weight-label" id="tp-bar-outlier-label">🧹 Ausreißer filtern</span>`;
    bindOutlierControls(wrapper);
    return wrapper;
  }

  function paintOutlierDim() {
    const dim = CONFIG.OUTLIER_REJECTION_ENABLED === false;
    for (const id of ['tp-bar-outlier-band-wrapper', 'tp-bar-outlier-hours-wrapper']) {
      const wrap = document.getElementById(id);
      if (wrap) wrap.classList.toggle('tp-tool-dim', dim);
    }
  }

  function bindOutlierBandControls(wrapper) {
    if (!wrapper) return;
    const range = wrapper.querySelector('#tp-bar-outlier-band-range');
    const label = wrapper.querySelector('#tp-bar-outlier-band-label');
    if (!range) return;
    const readBandPct = () => {
      const raw = parseInt(range.value, 10);
      return isNaN(raw) ? 60 : Math.min(90, Math.max(20, raw));
    };
    const paintBandLabel = () => { if (label) label.textContent = `±${readBandPct()} %`; };
    paintBandLabel();
    let deb;
    range.oninput = () => {
      paintBandLabel();
      clearTimeout(deb);
      deb = setTimeout(() => {
        recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
        updateConfig('OUTLIER_DEVIATION_BAND', readBandPct() / 100);
      }, 1000);
    };
    range.onchange = () => {
      clearTimeout(deb);
      const pct = readBandPct();
      paintBandLabel();
      recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      updateConfig('OUTLIER_DEVIATION_BAND', pct / 100);
      showToast(`Ausreißer-Band: ±${pct} % — live aktualisiert`);
    };
  }

  function buildOutlierBandWrapper() {
    const cur = typeof CONFIG.OUTLIER_DEVIATION_BAND === 'number' ? Math.round(CONFIG.OUTLIER_DEVIATION_BAND * 100) : 60;
    const wrapper = document.createElement('div');
    wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
    wrapper.id = 'tp-bar-outlier-band-wrapper';
    wrapper.title = 'Abweichung vom Median, ab der ein kurzer Sprung als Glitch gilt.';
    wrapper.innerHTML = `
      <span class="tp-stepper-label">Glitch-Band</span>
      <span class="tp-weight-label" id="tp-bar-outlier-band-label">±${cur} %</span>
      <input type="range" id="tp-bar-outlier-band-range" min="20" max="90" step="5" value="${cur}" title="Abweichung vom Median, ab der ein kurzer Sprung als Glitch gilt.">`;
    bindOutlierBandControls(wrapper);
    return wrapper;
  }

  function bindOutlierHoursControls(wrapper) {
    if (!wrapper) return;
    const range = wrapper.querySelector('#tp-bar-outlier-hours-range');
    const label = wrapper.querySelector('#tp-bar-outlier-hours-label');
    if (!range) return;
    const readHours = () => {
      const raw = parseInt(range.value, 10);
      return isNaN(raw) ? 48 : Math.min(168, Math.max(12, raw));
    };
    const paintHoursLabel = () => { if (label) label.textContent = `${readHours()} h`; };
    paintHoursLabel();
    let deb;
    range.oninput = () => {
      paintHoursLabel();
      clearTimeout(deb);
      deb = setTimeout(() => {
        recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
        updateConfig('OUTLIER_MAX_GLITCH_HOURS', readHours());
      }, 1000);
    };
    range.onchange = () => {
      clearTimeout(deb);
      const hrs = readHours();
      paintHoursLabel();
      recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      updateConfig('OUTLIER_MAX_GLITCH_HOURS', hrs);
      showToast(`Glitch-Fenster: ${hrs} h — live aktualisiert`);
    };
  }

  function buildOutlierHoursWrapper() {
    const cur = typeof CONFIG.OUTLIER_MAX_GLITCH_HOURS === 'number' ? CONFIG.OUTLIER_MAX_GLITCH_HOURS : 48;
    const wrapper = document.createElement('div');
    wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
    wrapper.id = 'tp-bar-outlier-hours-wrapper';
    wrapper.title = 'Maximale Dauer eines Preissprungs, der noch als Glitch verworfen wird.';
    wrapper.innerHTML = `
      <span class="tp-stepper-label">Glitch-Fenster</span>
      <span class="tp-weight-label" id="tp-bar-outlier-hours-label">${cur} h</span>
      <input type="range" id="tp-bar-outlier-hours-range" min="12" max="168" step="12" value="${cur}" title="Maximale Dauer eines Preissprungs, der noch als Glitch verworfen wird.">`;
    bindOutlierHoursControls(wrapper);
    return wrapper;
  }


  function placeBar(bar, placement) {
    if (placement.reference && placement.reference.parentElement === placement.container && placement.reference !== bar) {
      placement.container.insertBefore(bar, placement.reference);
    } else {
      placement.container.appendChild(bar);
    }
  }

  function renderSuiteFilterBar(counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, vortief: 0, uncheckedHidden: 0, dealer: 0, dealerActive: false, filteredCount: 0, dimmed: 0 }, pageHasOffers = false, isDealFeed = false) {
    const placement = getSuiteBarPlacement();
    if (!placement?.container) return;

    let bar = document.getElementById('tp-suite-filter-bar');
    const bestpreiseDeals = counts.bestpreiseDeals || 0;
    const negHidden = counts.neg || 0;
    const minHidden = counts.min || 0;
    const vortiefHidden = counts.vortief || 0;
    const uncheckedHiddenCount = counts.uncheckedHidden || 0;
    const dealerHidden = counts.dealer || 0;

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'tp-suite-filter-bar';
      if (CONFIG.BESTPREISE_MODE_ACTIVE) bar.classList.add('tp-bestpreise-bar');
      bar.innerHTML = `
        <div class="tp-filter-main-row">
        <div class="tp-group tp-group-filter" role="group" aria-label="Filter">
          <div class="tp-calc-wrap">
            <button class="tp-bar-btn" id="tp-bar-filter-btn" aria-expanded="false" aria-haspopup="true" title="Filter – Verbergen oder Dimmen je Ursache"><span class="tp-btn-label">🧹 Filter</span><span class="tp-count-badge" id="tp-filter-count" style="display: none;"></span><span id="tp-filter-dim-count" style="display: none;"></span> ▾</button>
            <div class="tp-calc-popover" id="tp-bar-filter-popover" role="group" aria-label="Filter">
              <div class="tp-filter-row" data-filter-row="neg">
                <label class="tp-mini-switch" title="Negativ-Filter (Text) ${CONFIG.FILTER_NEG_ENABLED ? 'AN' : 'AUS'}">
                  <input type="checkbox" id="tp-toggle-neg" ${CONFIG.FILTER_NEG_ENABLED ? 'checked' : ''}>
                  <span class="tp-mini-slider"></span>
                </label>
                <span class="tp-filter-label" title="Negativ-Begriffe im Produktnamen filtern (Wortgrenzen)">Negativ-Begriffe</span>
                <div class="tp-input-field-box">
                  <input type="text" id="tp-inline-negative-input" aria-label="Negativ-Filter (Text)" placeholder="Wörter ausschließen..." value="">
                  <button id="tp-clear-neg-btn" title="Text leeren" style="display: ${CONFIG.NEGATIVE_TERMS ? 'block' : 'none'};">✕</button>
                </div>
                <span class="tp-count-badge" data-row-count="neg" style="display: ${negHidden > 0 ? 'inline-flex' : 'none'};">${negHidden > 0 ? negHidden : ''}</span>
                <button class="tp-filter-mode-btn tp-active" data-mode-key="FILTER_NEG_MODE" title="Zwischen Verbergen und Dimmen wechseln">${CONFIG.FILTER_NEG_MODE === 'dim' ? 'Dimmen' : 'Verbergen'}</button>
              </div>
              <div class="tp-filter-row" data-filter-row="min" style="display: ${pageHasOffers ? 'flex' : 'none'};">
                <label class="tp-mini-switch" title="Min-Angebote-Filter ${CONFIG.FILTER_MIN_ENABLED ? 'AN' : 'AUS'}" aria-label="Min-Angebote-Filter">
                  <input type="checkbox" id="tp-toggle-min" ${CONFIG.FILTER_MIN_ENABLED ? 'checked' : ''}>
                  <span class="tp-mini-slider"></span>
                </label>
                <span class="tp-filter-label" title="Produkte mit weniger als N Angeboten filtern">Min-Angebote</span>
                <div class="tp-bar-stepper-group" id="tp-bar-min-offers-group" style="display: flex;">
                  <button class="tp-stepper-btn" id="tp-bar-min-minus">-</button>
                  <span id="tp-bar-min-val" style="min-width: 14px; text-align: center;">${CONFIG.MIN_OFFERS}</span>
                  <button class="tp-stepper-btn" id="tp-bar-min-plus">+</button>
                </div>
                <span class="tp-count-badge" data-row-count="min" style="display: ${minHidden > 0 ? 'inline-flex' : 'none'};">${minHidden > 0 ? minHidden : ''}</span>
                <button class="tp-filter-mode-btn tp-active" data-mode-key="FILTER_MIN_MODE" title="Zwischen Verbergen und Dimmen wechseln">${CONFIG.FILTER_MIN_MODE === 'dim' ? 'Dimmen' : 'Verbergen'}</button>
              </div>
              <div class="tp-filter-row" data-filter-row="unchecked" style="display: ${isDealFeed ? 'flex' : 'none'};">
                <label class="tp-mini-switch" title="Nur geprüfte">
                  <input type="checkbox" id="tp-toggle-unchecked" ${CONFIG.BESTPREISE_HIDE_UNCHECKED ? 'checked' : ''}>
                  <span class="tp-mini-slider"></span>
                </label>
                <span class="tp-filter-label" title="Ungeprüfte Deals ohne verifizierten Tiefstpreis filtern">Nur geprüfte</span>
                <span class="tp-count-badge" data-row-count="unchecked" style="display: ${uncheckedHiddenCount > 0 ? 'inline-flex' : 'none'};">${uncheckedHiddenCount > 0 ? uncheckedHiddenCount : ''}</span>
                <button class="tp-filter-mode-btn tp-active" data-mode-key="HIDE_UNCHECKED_MODE" title="Zwischen Verbergen und Dimmen wechseln">${CONFIG.HIDE_UNCHECKED_MODE === 'dim' ? 'Dimmen' : 'Verbergen'}</button>
              </div>
              <div class="tp-filter-row" data-filter-row="vortief" style="display: ${isDealFeed ? 'flex' : 'none'};">
                <label class="tp-mini-switch" title="Fallback-Tiefs">
                  <input type="checkbox" id="tp-toggle-vortief" ${CONFIG.BESTPREISE_INCLUDE_VORTIEF === false ? 'checked' : ''}>
                  <span class="tp-mini-slider"></span>
                </label>
                <span class="tp-filter-label" title="Fallback-Tiefstpreise (Höchstpreis als Ersatz) ausschließen">Fallback-Tiefs</span>
                <span class="tp-count-badge tp-count-warn" data-row-count="vortief" style="display: ${CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && vortiefHidden > 0 ? 'inline-flex' : 'none'};">${CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && vortiefHidden > 0 ? vortiefHidden : ''}</span>
                <button class="tp-filter-mode-btn tp-active" data-mode-key="VORTIEF_MODE" title="Zwischen Verbergen und Dimmen wechseln">${CONFIG.VORTIEF_MODE === 'dim' ? 'Dimmen' : 'Verbergen'}</button>
              </div>
              <div class="tp-filter-row" data-filter-row="dealer">
                <span class="tp-filter-label" title="Produkte des gewählten Händlers filtern">Händler</span>
                <span class="tp-filter-note" data-dealer-note>greift bei gewähltem Händler</span>
                <span class="tp-count-badge" data-row-count="dealer" style="display: ${dealerHidden > 0 ? 'inline-flex' : 'none'};">${dealerHidden > 0 ? dealerHidden : ''}</span>
                <button class="tp-filter-mode-btn tp-active" data-mode-key="DEALER_MODE" title="Zwischen Verbergen und Dimmen wechseln">${CONFIG.DEALER_MODE === 'dim' ? 'Dimmen' : 'Verbergen'}</button>
              </div>
              <button class="tp-bar-btn tp-calc-reset" id="tp-filter-reset">Zurücksetzen</button>
            </div>
          </div>
         </div>
         <span class="tp-divider" aria-hidden="true"></span>
        <div class="tp-group tp-group-view" role="group" aria-label="Ansicht – entfernt nichts">
          <button class="tp-bar-btn ${CONFIG.HEATMAP_ENABLED ? 'tp-active' : ''}" id="tp-bar-heat-btn" aria-pressed="${CONFIG.HEATMAP_ENABLED !== false}" title="Heatmap: Karten- und Badge-Farbe folgt stets der angezeigten Badge-% — Tiefrot = grosser Tiefstpreis, Grau = kein Rabatt. Grau gestreift = ungeprüft (Differenz)." style="display: flex;">🔥 Heatmap</button>
         </div>
         <span class="tp-divider" aria-hidden="true"></span>
        <div class="tp-group tp-group-deals" role="group" aria-label="Sortieren">
          <button class="tp-bar-btn ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'tp-bestpreise-active' : ''}" id="tp-bar-bestpreise-btn" title="Neue Tiefstpreise: sortiert nach Gewichteter Differenz – filtert nichts" style="display: ${isDealFeed ? 'flex' : 'none'};">
            💎 Neue Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline-flex' : 'none'};">${bestpreiseDeals > 0 ? bestpreiseDeals : ''}</span>
          </button>
          <div class="tp-calc-wrap" id="tp-bar-calc-wrap">
            <button class="tp-bar-btn" id="tp-bar-calc-btn" aria-expanded="false" aria-haspopup="true" title="Berechnungsparameter — Sortierung + Farb-Emphase, filtert nichts">⚖️ <span id="tp-bar-calc-summary">50/50 · 1J · 5 Pkt</span> ▾</button>
            <div class="tp-calc-popover" id="tp-bar-calc-popover" role="group" aria-label="Berechnungsparameter">
              <div class="tp-calc-head">Berechnungsparameter<span>Sortierung + Farb-Emphase — filtert nichts</span></div>
              <button class="tp-bar-btn tp-calc-reset" id="tp-bar-calc-reset">Zurücksetzen</button>
            </div>
          </div>
         </div>
        </div>
      `;
      // Deal sliders built once via builders; reset button stays last in the popover.
      {
        const popover = bar.querySelector('#tp-bar-calc-popover');
        const resetBtn = bar.querySelector('#tp-bar-calc-reset');
        const weight = buildWeightWrapper();
        const horizon = buildHorizonWrapper();
        const minpoints = buildMinPointsWrapper();
        const outlier = buildOutlierWrapper();
        const outlierBand = buildOutlierBandWrapper();
        const outlierHours = buildOutlierHoursWrapper();
        if (popover && resetBtn) popover.insertBefore(weight, resetBtn);
        if (popover && resetBtn) popover.insertBefore(horizon, resetBtn);
        if (popover && resetBtn) popover.insertBefore(minpoints, resetBtn);
        if (popover && resetBtn) popover.insertBefore(outlier, resetBtn);
        if (popover && resetBtn) popover.insertBefore(outlierBand, resetBtn);
        if (popover && resetBtn) popover.insertBefore(outlierHours, resetBtn);
        if (popover && resetBtn) popover.insertBefore(buildCalcPreview(), resetBtn);
      }
      // Preview follows slider drags live (DOM values, not debounced CONFIG).
      {
        for (const id of ['tp-bar-weight-range', 'tp-bar-horizon-range', 'tp-bar-minpoints-range', 'tp-bar-outlier-toggle', 'tp-bar-outlier-band-range', 'tp-bar-outlier-hours-range']) {
          const el = bar.querySelector('#' + id);
          if (!el) continue;
          el.addEventListener('input', refreshCalcPreview);
          el.addEventListener('change', refreshCalcPreview);
        }
      }

      placeBar(bar, placement);

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

      const filterBtn = bar.querySelector('#tp-bar-filter-btn');
      const filterPopover = bar.querySelector('#tp-bar-filter-popover');
      if (filterBtn && filterPopover) {
        filterBtn.onclick = e => {
          e.stopPropagation();
          const calcPop = bar.querySelector('#tp-bar-calc-popover');
          if (calcPop) calcPop.classList.remove('tp-show');
          const calcBtnEl = bar.querySelector('#tp-bar-calc-btn');
          if (calcBtnEl) calcBtnEl.setAttribute('aria-expanded', 'false');
          const open = filterPopover.classList.toggle('tp-show');
          filterBtn.setAttribute('aria-expanded', String(open));
        };
        filterPopover.onclick = e => {
          const btn = e.target?.closest?.('.tp-filter-mode-btn');
          if (!btn) return;
          updateConfig(btn.dataset.modeKey, CONFIG[btn.dataset.modeKey] === 'dim' ? 'hide' : 'dim');
        };
        const resetBtn = bar.querySelector('#tp-filter-reset');
        if (resetBtn) {
          resetBtn.onclick = () => {
            updateConfigs({ FILTER_NEG_MODE: 'dim', FILTER_MIN_MODE: 'dim', HIDE_UNCHECKED_MODE: 'dim', VORTIEF_MODE: 'dim', DEALER_MODE: 'dim', FILTER_NEG_ENABLED: true, FILTER_MIN_ENABLED: true, BESTPREISE_HIDE_UNCHECKED: false, BESTPREISE_INCLUDE_VORTIEF: true });
            showToast('Filter zurückgesetzt');
          };
        }
        const uncheckedToggle = bar.querySelector('#tp-toggle-unchecked');
        if (uncheckedToggle) {
          uncheckedToggle.onchange = () => {
            updateConfig('BESTPREISE_HIDE_UNCHECKED', uncheckedToggle.checked);
            showToast(uncheckedToggle.checked ? '✓ Nur geprüfte filtern aktiv (Filtergrund, entfernt)' : '✓ Nur geprüfte aus — ungeprüfte werden wieder angezeigt');
          };
        }
        const vortiefToggle = bar.querySelector('#tp-toggle-vortief');
        if (vortiefToggle) {
          vortiefToggle.onchange = () => {
            updateConfig('BESTPREISE_INCLUDE_VORTIEF', !vortiefToggle.checked);
            showToast(vortiefToggle.checked ? 'Fallback-Tiefs ausgeschlossen (Filtergrund)' : 'Fallback-Tiefs eingeschlossen');
          };
        }
      }

      bar.querySelector('#tp-bar-heat-btn').onclick = () => {
        const nextState = !CONFIG.HEATMAP_ENABLED;
        updateConfig('HEATMAP_ENABLED', nextState);
      };

      const bestpreiseToggleBtn = bar.querySelector('#tp-bar-bestpreise-btn');
      if (bestpreiseToggleBtn) bindBestpreiseBtn(bestpreiseToggleBtn);

      // Calc popover: toggles .tp-show, closes on outside click / Escape.
      const calcBtn = bar.querySelector('#tp-bar-calc-btn');
      const calcPopover = bar.querySelector('#tp-bar-calc-popover');
      // ponytail: document listeners registered once per page (bar can be removed + recreated);
      // handlers re-query by ID so they always hit the live bar, never a detached one.
      if (!window._tpBarCalcDocBound) {
        window._tpBarCalcDocBound = true;
        document.addEventListener('keydown', e => {
          if (e.key !== 'Escape') return;
          if (!e.target || !e.target.closest || !e.target.closest('#tp-suite-filter-bar')) return;
          for (const [popId, btnId] of [['tp-bar-calc-popover', 'tp-bar-calc-btn'], ['tp-bar-filter-popover', 'tp-bar-filter-btn']]) {
            const pop = document.getElementById(popId);
            if (!pop || !pop.classList.contains('tp-show')) continue;
            pop.classList.remove('tp-show');
            const btn = document.getElementById(btnId);
            if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
          }
        });
        document.addEventListener('click', e => {
          if (e.target && e.target.closest && e.target.closest('#tp-suite-filter-bar')) return;
          for (const [popId, btnId] of [['tp-bar-calc-popover', 'tp-bar-calc-btn'], ['tp-bar-filter-popover', 'tp-bar-filter-btn']]) {
            const pop = document.getElementById(popId);
            if (!pop || !pop.classList.contains('tp-show')) continue;
            pop.classList.remove('tp-show');
            const btn = document.getElementById(btnId);
            if (btn) btn.setAttribute('aria-expanded', 'false');
          }
        });
      }
      if (calcBtn && calcPopover) {
        calcBtn.onclick = e => {
          e.stopPropagation();
          const filterPop = bar.querySelector('#tp-bar-filter-popover');
          if (filterPop) filterPop.classList.remove('tp-show');
          const filterBtnEl = bar.querySelector('#tp-bar-filter-btn');
          if (filterBtnEl) filterBtnEl.setAttribute('aria-expanded', 'false');
          const open = calcPopover.classList.toggle('tp-show');
          calcBtn.setAttribute('aria-expanded', String(open));
        };
        const resetBtn = bar.querySelector('#tp-bar-calc-reset');
        if (resetBtn) {
          resetBtn.onclick = () => {
            recomputeCachedMedians(365);
            updateConfigs({ BESTPREISE_WEIGHT_RECORD: 0.50, BESTPREISE_MEDIAN_HORIZON_DAYS: 365, BESTPREISE_MIN_POINTS: 5, OUTLIER_REJECTION_ENABLED: true, OUTLIER_DEVIATION_BAND: 0.60, OUTLIER_MAX_GLITCH_HOURS: 48 });
            const previewSel = document.getElementById('tp-preview-preset-select');
            if (previewSel) previewSel.value = 's26';
            refreshCalcPreview();
            showToast('Berechnungsparameter zurückgesetzt');
          };
        }
      }

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
      placeBar(bar, placement);
    }

    bar.style.display = 'flex';
    bar.classList.toggle('tp-bestpreise-bar', CONFIG.BESTPREISE_MODE_ACTIVE === true);

    const input = bar.querySelector('#tp-inline-negative-input');
    const clearBtn = bar.querySelector('#tp-clear-neg-btn');
    if (input && document.activeElement !== input) {
      input.value = CONFIG.NEGATIVE_TERMS || '';
      if (clearBtn) clearBtn.style.display = CONFIG.NEGATIVE_TERMS ? 'block' : 'none';
    }

    const hiddenTotal = counts.filteredCount || 0;
    const heatBtn = bar.querySelector('#tp-bar-heat-btn');
    if (heatBtn) {
      heatBtn.classList.toggle('tp-active', CONFIG.HEATMAP_ENABLED !== false);
      heatBtn.setAttribute('aria-pressed', String(CONFIG.HEATMAP_ENABLED !== false));
    }
    const dimmedTotal = counts.dimmed || 0;
    const filterBtn = bar.querySelector('#tp-bar-filter-btn');
    if (filterBtn) {
      const filterCount = bar.querySelector('#tp-filter-count');
      if (filterCount) {
        setTextIfChanged(filterCount, hiddenTotal > 0 ? String(hiddenTotal) : '');
        filterCount.style.display = hiddenTotal > 0 ? 'inline-flex' : 'none';
      }
      const dimCount = bar.querySelector('#tp-filter-dim-count');
      if (dimCount) {
        setTextIfChanged(dimCount, dimmedTotal > 0 ? `+${dimmedTotal} gedimmt` : '');
        dimCount.style.display = dimmedTotal > 0 ? 'inline' : 'none';
      }
      filterBtn.classList.toggle('tp-tool-dim', hiddenTotal === 0 && dimmedTotal === 0);
      filterBtn.title = `Filter – Verbergen (${hiddenTotal}) + Gedimmt (${dimmedTotal}) — Neg:${negHidden} Min:${minHidden} Händler:${dealerHidden} Fallback:${vortiefHidden} Ungeprüft:${uncheckedHiddenCount}`;
    }
    const setRowCount = (name, n, show) => {
      const badge = bar.querySelector(`[data-row-count="${name}"]`);
      if (!badge) return;
      setTextIfChanged(badge, show ? String(n) : '');
      badge.style.display = show ? 'inline-flex' : 'none';
    };
    setRowCount('neg', negHidden, negHidden > 0);
    setRowCount('min', minHidden, minHidden > 0);
    setRowCount('unchecked', uncheckedHiddenCount, uncheckedHiddenCount > 0);
    setRowCount('vortief', vortiefHidden, CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && vortiefHidden > 0);
    setRowCount('dealer', dealerHidden, dealerHidden > 0);
    for (const key of ['FILTER_NEG_MODE', 'FILTER_MIN_MODE', 'HIDE_UNCHECKED_MODE', 'VORTIEF_MODE', 'DEALER_MODE']) {
      const mode = CONFIG[key] === 'dim' ? 'dim' : 'hide';
      bar.querySelectorAll(`[data-mode-key="${key}"]`).forEach(btn => {
        btn.classList.toggle('tp-active', true);
        setTextIfChanged(btn, mode === 'dim' ? 'Dimmen' : 'Verbergen');
      });
    }
    const uncheckedToggle = bar.querySelector('#tp-toggle-unchecked');
    if (uncheckedToggle) uncheckedToggle.checked = CONFIG.BESTPREISE_HIDE_UNCHECKED === true;
    const vortiefToggle = bar.querySelector('#tp-toggle-vortief');
    if (vortiefToggle) vortiefToggle.checked = CONFIG.BESTPREISE_INCLUDE_VORTIEF === false;
    const uncheckedRow = bar.querySelector('[data-filter-row="unchecked"]');
    if (uncheckedRow) uncheckedRow.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
    const vortiefRow = bar.querySelector('[data-filter-row="vortief"]');
    if (vortiefRow) vortiefRow.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
    const dealerActive = counts.dealerActive === true;
    const dealerRow = bar.querySelector('[data-filter-row="dealer"]');
    if (dealerRow) {
      dealerRow.classList.toggle('tp-row-inactive', !dealerActive);
      const note = dealerRow.querySelector('[data-dealer-note]');
      if (note) setTextIfChanged(note, dealerActive ? 'greift bei gewähltem Händler' : 'inaktiv – kein Händler gewählt');
      const dealerBtn = dealerRow.querySelector('[data-mode-key="DEALER_MODE"]');
      if (dealerBtn) dealerBtn.disabled = !dealerActive;
    }


    const bestpreiseBtn = document.getElementById('tp-bar-bestpreise-btn');
    if (bestpreiseBtn) {
      bestpreiseBtn.classList.toggle('tp-bestpreise-active', CONFIG.BESTPREISE_MODE_ACTIVE === true);
      bestpreiseBtn.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
      if (!scanState.isBestpreiseScanning) {
        const bpCount = bestpreiseBtn.querySelector('#tp-bar-bestpreise-count');
        if (bpCount) {
          setTextIfChanged(bpCount, bestpreiseDeals > 0 ? String(bestpreiseDeals) : '');
          bpCount.style.display = bestpreiseDeals > 0 ? 'inline-flex' : 'none';
        }
      }
    }

    syncMiniToggle(bar.querySelector('#tp-toggle-neg'), CONFIG.FILTER_NEG_ENABLED, 'Negativ-Filter (Text)');
    syncMiniToggle(bar.querySelector('#tp-toggle-min'), CONFIG.FILTER_MIN_ENABLED, 'Min-Angebote-Filter');
    syncMiniToggle(bar.querySelector('#tp-bar-outlier-toggle'), CONFIG.OUTLIER_REJECTION_ENABLED !== false, 'Ausreißer-Filter');
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
    paintMinPoints();
    const horizonRange = document.getElementById('tp-bar-horizon-range');
    const curHorizon = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365;
    if (horizonRange && document.activeElement !== horizonRange) {
      horizonRange.value = curHorizon === 0 ? 760 : curHorizon;
      const horizonLabel = document.getElementById('tp-bar-horizon-label');
      if (horizonLabel) {
        horizonLabel.textContent = horizonText(curHorizon);
        horizonLabel.title = horizonText(curHorizon, 'title');
      }
    }
    const curBand = typeof CONFIG.OUTLIER_DEVIATION_BAND === 'number' ? CONFIG.OUTLIER_DEVIATION_BAND : 0.60;
    const bandRange = document.getElementById('tp-bar-outlier-band-range');
    if (bandRange && document.activeElement !== bandRange) {
      bandRange.value = Math.round(curBand * 100);
      const bandLabel = document.getElementById('tp-bar-outlier-band-label');
      if (bandLabel) bandLabel.textContent = `±${Math.round(curBand * 100)} %`;
    }
    const curHours = typeof CONFIG.OUTLIER_MAX_GLITCH_HOURS === 'number' ? CONFIG.OUTLIER_MAX_GLITCH_HOURS : 48;
    const hoursRange = document.getElementById('tp-bar-outlier-hours-range');
    if (hoursRange && document.activeElement !== hoursRange) {
      hoursRange.value = curHours;
      const hoursLabel = document.getElementById('tp-bar-outlier-hours-label');
      if (hoursLabel) hoursLabel.textContent = `${curHours} h`;
    }
    paintOutlierDim();
    const calcSummary = document.getElementById('tp-bar-calc-summary');
    if (calcSummary) {
      setTextIfChanged(calcSummary, `${weightText(curWeight, 'short')} · ${horizonText(curHorizon)} · ${clampMinPoints(CONFIG.BESTPREISE_MIN_POINTS)} Pkt`);
    }
    // Berechnungsparameter shape browse heat too — always visible; mode only drives sort + scan.
    const calcWrapEl = document.getElementById('tp-bar-calc-wrap');
    if (calcWrapEl) calcWrapEl.style.setProperty('display', 'inline-flex', 'important');
    // A group left without visible children (option-less groups on catalog pages) hides; a divider shows only between two visible groups.
    for (const group of bar.querySelectorAll('.tp-group')) {
      const hasVisibleChild = [...group.children].some(el => el.style.display !== 'none');
      // Plain inline style loses to .tp-group{display:inline-flex !important} — use priority.
      if (hasVisibleChild) group.style.display = '';
      else group.style.setProperty('display', 'none', 'important');
    }
    for (const sep of bar.querySelectorAll('.tp-divider')) {
      let prev = sep.previousElementSibling;
      while (prev && !prev.classList.contains('tp-group')) prev = prev.previousElementSibling;
      let next = sep.nextElementSibling;
      while (next && !next.classList.contains('tp-group')) next = next.nextElementSibling;
      const between = !!prev && !!next && prev.style.display !== 'none' && next.style.display !== 'none';
      sep.style.display = between ? '' : 'none';
    }

    const minRow = bar.querySelector('[data-filter-row="min"]');
    if (minRow) minRow.style.setProperty('display', pageHasOffers ? 'flex' : 'none', 'important');
    const minVal = bar.querySelector('#tp-bar-min-val');
    if (minVal) minVal.textContent = CONFIG.MIN_OFFERS;
    if (document.getElementById('tp-preview-svg')) refreshCalcPreview();
  }

  // ─── MODULE: src/ui/floating-cta.js ─────────────────────────────────────────
  /**
   * Floating Check-Deals CTA Component
   * Primary one-click entry point for Tiefstpreis verification.
   *
   * Why this exists: the toolbar packs ~8 controls into one row (filter + view
   * + deals groups) and the highest-value action — verifying N unchecked
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
      (completed, total, newlyVerified) => {
        armFreshDismiss();
        for (const item of newlyVerified || []) markFreshVerified(item.pid);
        // Recompute counts → CTA flips to its dimmed empty form when nothing is left.
        triggerProcessListings();
        const fresh = document.querySelectorAll('.tp-deal-fresh').length;
        if (total > 0) showToast(fresh > 0 ? `${fresh} Tiefstpreise verifiziert` : `Keine Tiefstpreise dabei · ${completed} geprüft`);
        else showToast('Keine ungeprüften Deals vorhanden');
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
      <div id="tp-floating-check-col">
        <button type="button" id="tp-floating-check-btn" title="Echte Allzeit-Tiefstpreise prüfen (Toppreise-Rabatt ist ungeprüft)">
          <span id="tp-floating-check-main">🔍 Tiefstpreise prüfen</span>
          <span id="tp-floating-check-sub">Echte Tiefstpreise verifizieren</span>
          <span id="tp-floating-check-count">🔍</span>
        </button>
        <label id="tp-floating-dealer-row" title="Günstigste Händler beim Prüfen automatisch mitladen (max. 3 parallel, auch in den Einstellungen)">
          <input type="checkbox" id="tp-floating-dealer-toggle">
          <span>🏬 Händler laden</span>
        </label>
      </div>
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
    // Scan-Begleiter (gleicher Schalter wie im Feintuning): Händler beim
    // Verifizieren automatisch mitladen — updateConfig syncet das Modal mit.
    el.querySelector('#tp-floating-dealer-toggle').onchange = e => {
      const next = e.target.checked;
      updateConfig('DEALER_AUTOFETCH', next);
      showToast(next ? '🏬 Händler werden beim Prüfen automatisch geladen' : '🏬 Händler nur noch per Klick laden');
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
    const dealerToggle = el.querySelector('#tp-floating-dealer-toggle');
    if (dealerToggle && document.activeElement !== dealerToggle) {
      dealerToggle.checked = CONFIG.DEALER_AUTOFETCH === true;
    }
    el.querySelector('#tp-floating-dealer-row')?.classList.toggle('tp-active', CONFIG.DEALER_AUTOFETCH === true);
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

  // ─── MODULE: src/features/share-discord.js ──────────────────────────────────
  /**
   * Discord Deal-Sharing
   * 1-Klick-Share verifizierter Tiefstpreise in einen Discord-Channel via
   * user-eigenem Webhook (GM-privat gespeichert, nie im Repo/Export/localStorage).
   */





  const isDiscordWebhookUrl = url =>
    typeof url === 'string' &&
    /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/.+/.test(url.trim());
  // Forum-/Media-Channel brauchen thread_name (sonst 405/400, nichts erstellt).
  // Thread-/Channel-Namen: 1-100 Zeichen (Discord Channel-Doku).
  const buildThreadName = title => ((title || '').replace(/\s+/g, ' ').trim() || 'Toppreise-Deal').slice(0, 100);
  const isForumThreadError = err => /^Discord (400|405)$/.test(err?.message || '');
  function discordForumFlagKey(webhookUrl) {
    let h = 5381;
    const s = String(webhookUrl || '').trim();
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return `DISCORD_FORUM:${h.toString(16).padStart(8, '0')}`;
  }

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
  // Historie endet am letzten Sample, nicht am Live-Kartenpreis (kann seitdem
  // gefallen sein). Für den PNG-Chart den Livepreis anhängen, damit Linie und
  // Endpunkt-Markierung am aktuellen Preis enden. Reine Funktion, nie mutierend.
  function withLivePrice(timeSeries, price) {
    if (!Array.isArray(timeSeries) || timeSeries.length === 0) return timeSeries;
    if (!(price > 0)) return timeSeries;
    const last = timeSeries[timeSeries.length - 1];
    if (Array.isArray(last) && +last[1] === price) return timeSeries;
    return [...timeSeries, [Date.now(), price]];
  }
  // Preischart als PNG für Discord: vorhandenes SVG groß rendern, rastern, als
  // Webhook-Attachment hochladen. Reine Browser-APIs — ohne DOM kein Bild (null).
  function renderSparklinePng(timeSeries, width = 360, height = 100) {
    return new Promise(resolve => {
      try {
        if (typeof document === 'undefined') return resolve(null);
        const svg = renderDiscordChart(timeSeries, width, height);
        if (!svg) return resolve(null);
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
  //
  // Produkt-Bytes für den Upload holen (same-origin via GM-Transport, kein CORS-
  // Problem). URL-Embeds verlieren gegen Inline-Attachments in der Thread-
  // Vorschau — darum wird das Produkt als erste Attachment-Datei mitgeschickt.
  function fetchImageBlob(imageUrl, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      try {
        if (typeof imageUrl !== 'string' || !/^https?:\/\//i.test(imageUrl.trim())) return reject(new Error('Ungültige Bild-URL'));
        if (typeof GM_xmlhttpRequest === 'undefined') return reject(new Error('Kein HTTP-Transport verfügbar'));
        GM_xmlhttpRequest({
          method: 'GET',
          url: imageUrl.trim(),
          responseType: 'blob',
          timeout: timeoutMs,
          onload: res => {
            const data = res?.response;
            if (res.status >= 200 && res.status < 300 && data) {
              const blob = data instanceof Blob ? data : new Blob([data]);
              if (!blob.size) return reject(new Error('Leeres Bild'));
              if (blob.type && !blob.type.startsWith('image/')) return reject(new Error('Ungültiges Bild'));
              resolve(blob);
            } else reject(new Error(`Bild-Download ${res.status}`));
          },
          onerror: () => reject(new Error('Netzwerkfehler')),
          ontimeout: () => reject(new Error('Timeout'))
        });
      } catch (err) { reject(err); }
    });
  }

  function gmPost({ url, data, headers, timeoutMs }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url,
        ...(headers ? { headers } : {}),
        data,
        timeout: timeoutMs,
        onload: res => (res.status >= 200 && res.status < 300 ? resolve() : reject(new Error(`Discord ${res.status}`))),
        onerror: () => reject(new Error('Netzwerkfehler')),
        ontimeout: () => reject(new Error('Timeout'))
      });
    });
  }

  function postDealImageToDiscord(webhookUrl, content, pngBlob, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
        if (!(pngBlob instanceof Blob)) return reject(new Error('Ungültige Bilddaten'));
        if (typeof FormData === 'undefined') return reject(new Error('Kein Multipart-Transport'));
        const form = new FormData();
        const body = { content };
        const productBlob = options.productImageBlob instanceof Blob ? options.productImageBlob : null;
        if (productBlob) {
          body.embeds = [{ image: { url: 'attachment://produkt.png' } }, { image: { url: 'attachment://preisverlauf.png' } }];
        } else if (typeof options.productImageUrl === 'string' && options.productImageUrl) {
          body.embeds = [{ image: { url: options.productImageUrl } }];
        }
        if (typeof options.threadName === 'string' && options.threadName) body.thread_name = options.threadName;
        form.append('payload_json', JSON.stringify(body));
        if (productBlob) {
          form.append('files[0]', productBlob, 'produkt.png');
          form.append('files[1]', pngBlob, 'preisverlauf.png');
        } else {
          form.append('file', pngBlob, 'preisverlauf.png');
        }
        const url = webhookUrl.trim();
        if (typeof GM_xmlhttpRequest !== 'undefined') {
          gmPost({ url, data: form, timeoutMs: 20000 }).then(resolve, reject);
        } else if (typeof fetch !== 'undefined') {
          fetch(url, { method: 'POST', body: form })
            .then(res => (res.ok ? resolve() : reject(new Error(`Discord ${res.status}`))))
            .catch(() => reject(new Error('Netzwerkfehler')));
        } else {
          reject(new Error('Kein Multipart-Transport'));
        }
      } catch { reject(new Error('Upload fehlgeschlagen')); }
    });
  }

  // Baukasten-Layout: je Zeile ein Baustein, Größe via # / ## / -# am
  // Zeilenanfang. · blendet leere Nachbarn aus, +{offers} rendert kompakt +N (leer bei 0). {link} nur bei aktivem Embed.
  const DEFAULT_LAYOUT = '## {title}\n# {price}\n# {dealer} +{offers}\n{spark}\n{prevlow}\n{median}\n{link}';
  const LAYOUT_TOKENS = new Set(['title', 'price', 'dealer', 'offers', 'spark', 'prevlow', 'median', 'link']);
  function validateLayoutRecipe(recipe) {
    const value = String(recipe ?? '');
    if (!value.trim()) return 'Layout ist leer';
    const unknown = [...new Set([...value.matchAll(/\{([^}]*)\}/g)].map(m => m[1]))].filter(n => !LAYOUT_TOKENS.has(n));
    return unknown.length ? `Unbekannte Tokens: ${unknown.map(n => `{${n}}`).join(', ')}` : null;
  }

  function layoutOverLimitSuffix(renderedLength, recipe) {
    if (renderedLength <= 2000) return '';
    return String(recipe ?? '').includes('{title}') ? ' — über Limit, Titel wird gekürzt' : ' — über Limit, wird hart auf 2000 gekürzt';
  }
  const escapePreviewHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mdInlineText = text => text
    .replace(/(?<!&lt;)https?:\/\/[^\s<]+?(?=&gt;|[\s<]|$)/g, '<span class="tp-md-url">$&</span>')
    .replace(/&lt;(https?:\/\/\S+?)&gt;/g, '<span class="tp-md-url">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  function renderDiscordMarkdownPreview(markdown) {
    return String(markdown ?? '').replace(/\r/g, '').split('\n').map(rawLine => {
      let line = rawLine;
      let cls = '';
      const prefix = line.match(/^(##|#|-#)\s?/);
      if (prefix) {
        cls = prefix[1] === '##' ? 'tp-md-lg' : prefix[1] === '#' ? 'tp-md-md' : 'tp-md-sm';
        line = line.slice(prefix[0].length);
      }
      const parts = escapePreviewHtml(line).split(/\[([^\]]*)\]\(([^)]+)\)/g);
      let html = '';
      for (let i = 0; i < parts.length; i += 3) {
        html += mdInlineText(parts[i]);
        if (i + 2 < parts.length) html += `<span class="tp-md-link">${parts[i + 1]}</span> <span class="tp-md-url">${parts[i + 2].replace(/^&lt;|&gt;$/g, '')}</span>`;
      }
      return cls ? `<span class="${cls}">${html}</span>` : html;
    }).join('<br>');
  }
  const boldNumbers = s => (s || '').replace(/(CHF [\d.'’]+|-?\d+(?:[.,]\d+)?\s*%)/g, '**$1**');
  const withPct = (text, pct) => pct > 0 ? `${text} -${pct}%` : text;
  const cleanTitleOf = title => (title || 'Toppreise-Deal').replace(/\s+/g, ' ').trim();
  function tokenText(name, ctx) {
    switch (name) {
      case 'title': return ctx.link ? `[${ctx.cleanTitle}](${ctx.titleTarget})` : ctx.cleanTitle;
      case 'price': return ctx.priceText ? `💰 ${ctx.priceText}` : '';
      case 'dealer': return ctx.dealer ? (ctx.dealerTarget ? `🏬 [${ctx.dealer}](${ctx.dealerTarget})` : `🏬 ${ctx.dealer}`) : '';
      case 'offers': return ctx.offerCount ? `🛒 ${ctx.offerCount} Angebote` : '';
      case 'spark': return ctx.spark ? `📊 ${ctx.spark}` : '';
      case 'prevlow': return ctx.prevLowText ? `📉 ${boldNumbers(withPct(ctx.prevLowText, ctx.prevLowPct))}` : '';
      case 'median': return ctx.medianText ? `📈 ${boldNumbers(withPct(ctx.medianText, ctx.medianPct))}` : '';
      case 'link': return (ctx.link && !ctx.suppressProductEmbed) ? ctx.link : '';
      default: return '';
    }
  }
  function renderLayout(fields = {}, recipe = DEFAULT_LAYOUT) {
    recipe = String(recipe || '').replace(/\r/g, '');
    if (!recipe.trim()) recipe = DEFAULT_LAYOUT;
    const link = ((fields || {}).url || '').trim();
    const dealerUrl = (fields || {}).dealerUrl || '';
    const ctx = {
      cleanTitle: cleanTitleOf((fields || {}).title),
      link,
      titleTarget: link ? (((fields || {}).suppressProductEmbed && link) ? `<${link}>` : link) : '',
      priceText: (fields || {}).priceText || '',
      dealer: (fields || {}).dealer || '',
      dealerTarget: dealerUrl ? ((fields || {}).suppressDealerEmbed ? `<${dealerUrl}>` : dealerUrl) : '',
      offerCount: (fields || {}).offerCount || 0,
      spark: (fields || {}).spark || '',
      prevLowText: (fields || {}).prevLowText || '',
      prevLowPct: (fields || {}).prevLowPct || 0,
      medianText: (fields || {}).medianText || '',
      medianPct: (fields || {}).medianPct || 0,
      suppressProductEmbed: (fields || {}).suppressProductEmbed === true,
    };
    const out = [];
    for (const rawLine of recipe.split('\n')) {
      const line = rawLine.replace(/\s*\+\{offers\}/g, ctx.offerCount ? ` +${ctx.offerCount}` : '').replace(/\{([a-z]+)\}/g, (m, name) => LAYOUT_TOKENS.has(name) ? tokenText(name, ctx) : '').replace(/\s*·\s*·\s*/g, ' · ').replace(/^([#-]+)\s*·\s*/g, '$1 ').replace(/^\s*·\s*|\s*·\s*$/g, '').replace(/^([#-]+)\s+/g, '$1 ').replace(/\s\+(?!\d)\s*$/g, '');
      if (line.replace(/^[#\s-]+/, '').trim() === '') continue;
      out.push(line);
    }
    return out.join('\n');
  }
  function formatDealMessage(fields = {}, recipe = DEFAULT_LAYOUT) {
    const full = renderLayout(fields, recipe);
    if (full.length <= 2000) return full;
    const cleanTitle = cleanTitleOf((fields || {}).title);
    const over = full.length - 2000;
    const shrunk = cleanTitle.slice(0, Math.max(20, cleanTitle.length - over));
    return renderLayout({ ...(fields || {}), title: shrunk }, recipe).slice(0, 2000);
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
      prevLowText: prevLowShown ? `CHF ${prevLow.toFixed(2)}` : '',
      prevLowPct: prevLowShown ? (getDisplayDelta(cardPrice, stats).dRecord || 0) : 0,
      medianText: medianShown ? `Ø-Preis (${medianHorizonLabel(stats)}): CHF ${medianVal.toFixed(2)}` : '',
      medianPct: medianShown ? (getLevelPct(cardPrice, stats) || 0) : 0
    };
  }

  // Titel + Produktlink aus der Karte ziehen (alles tolerant, Layout-wechsel-sicher).
  function extractShareData(card) {
    if (!card?.querySelector) return { title: '', url: '', imageUrl: '' };
    const titleEl = card.querySelector('.product-name, .productDetails, .bold, a[title]');
    const title = titleEl?.textContent?.trim() || titleEl?.getAttribute?.('title') || '';
    const linkEl = card.querySelector('a[href*="/preisvergleich/"]')
      || (card.tagName?.toLowerCase() === 'a' ? card : null);
    let url = linkEl?.getAttribute?.('href') || linkEl?.href || '';
    if (url && !/^https?:\/\//i.test(url)) {
      try { url = new URL(url, location.href).href; } catch { /* relativ lassen */ }
    }
    const imgEl = card.querySelector('.product-image img, .productImage img, .image_container img, .Plugin_Product img, img');
    let imageUrl = imgEl?.currentSrc || imgEl?.src
      || imgEl?.getAttribute?.('data-src') || imgEl?.getAttribute?.('data-original') || '';
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      if (/^\s*data:/i.test(imageUrl)) imageUrl = '';
      else try { imageUrl = new URL(imageUrl, location.href).href; } catch { imageUrl = ''; }
    }
    if (!/^https?:\/\//i.test(imageUrl)) imageUrl = '';
    return { title, url, imageUrl };
  }

  // Angezeigten Händler (günstigste Zeile zuerst) als Klartext.
  function extractDealer(card) {
    const el = card?.querySelector?.(`${SELECTORS.cards.dealerRows} .title`);
    return el?.textContent?.replace(/\s+/g, ' ').trim() || '';
  }

  // Direktlink zum Händlerangebot aus der Händlerzeile (Katalog), falls verlinkt.
  function extractDealerUrl(card) {
    const a = card?.querySelector?.(`${SELECTORS.cards.dealerRows} a[href]`);
    let url = a?.getAttribute?.('href') || a?.href || '';
    if (url && !/^https?:\/\//i.test(url)) {
      try { url = new URL(url, location.href).href; } catch { /* relativ lassen */ }
    }
    return url;
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

  // Produktseiten listen Angebote als .Plugin_Offer-Blöcke (Preis-aufsteigend,
  // statisch im HTML, live verifiziert 2026-10-09): Shopname im Logo-alt, je ein
  // Produkt-/Versandpreis. Günstigstes Angebot auf Karten-Basis wählen (Min statt
  // erste Zeile: robust gegen fremde Sortier-Cookies; nur Seite 1 geparst).
  function parseProductOffers(doc) {
    const blocks = Array.from(doc?.querySelectorAll?.('.Plugin_Offer') || []);
    return blocks.map(block => {
      const logo = block.querySelector?.('.Plugin_ShopLogo img[alt], .Plugin_ShopLogo img[title]');
      const dealer = logo?.getAttribute?.('alt') || logo?.getAttribute?.('title') || '';
      const product = parsePrice(block.querySelector?.(SELECTORS.price.fallbackProduct)?.textContent);
      const shipping = parsePrice(block.querySelector?.(SELECTORS.price.fallbackShipping)?.textContent);
      const link = block.querySelector?.('a[href*="ext_de"]');
      const url = link?.getAttribute?.('href') || link?.href || '';
      return { dealer: dealer.replace(/\s+/g, ' ').trim(), product: product || 0, shipping: shipping || 0, url: url || '' };
    }).filter(o => o.dealer || o.product > 0 || o.shipping > 0);
  }

  function pickCheapestOffer(offers, useShipping = false) {
    let best = null;
    for (const o of offers || []) {
      const price = useShipping ? (o.shipping || o.product) : (o.product || o.shipping);
      if (!(price > 0)) continue;
      if (!best || price < best.price) best = { price, dealer: o.dealer || '', url: o.url || '' };
    }
    return best || { price: 0, dealer: '', url: '' };
  }

  // Feed-Karten tragen keine Händlerzeilen: Produktseite nachladen (nur bei Klick,
  // same-origin, kein CORS-Problem). Katalog-Zeilen → .Plugin_Offer-Blöcke (inkl.
  // /ext_de-Direktlink zum günstigsten Angebot) → JSON-LD (nur Count). Händler
  // immer auf Karten-Preisbasis (Versand/Produkt).
  async function fetchProductInfo(productUrl, timeoutMs = 10000, useShipping = false) {
    const out = { dealer: '', offers: 0, dealerUrl: '' };
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
      const offers = parseProductOffers(doc);
      if (offers.length) {
        out.offers = offers.length;
        const best = pickCheapestOffer(offers, useShipping);
        out.dealer = best.dealer;
        if (best.url) {
          try { out.dealerUrl = new URL(best.url, productUrl).href; } catch { out.dealerUrl = best.url; }
        }
        return out;
      }
      const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of scripts) {
        try {
          const found = parseJsonLdOffer(JSON.parse(s.textContent));
          if (found.dealer || found.offers) return { dealer: found.dealer, offers: found.offers, dealerUrl: '' };
        } catch { /* Block einzeln ignorieren */ }
      }
      console.debug('[Toppreise-Suite] Händler-Fallback leer', { htmlBytes: html.length, rowCount: titles.length, jsonLdBlocks: scripts.length });
    } catch { /* Händler unbekannt: Zeile entfällt */ }
    return out;
  }
  function postDealToDiscord(webhookUrl, content, options = {}) {
    return new Promise((resolve, reject) => {
      if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
      const url = webhookUrl.trim();
      const body = { content };
      if (typeof options.productImageUrl === 'string' && options.productImageUrl) body.embeds = [{ image: { url: options.productImageUrl } }];
      if (typeof options.threadName === 'string' && options.threadName) body.thread_name = options.threadName;
      const payload = JSON.stringify(body);
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        gmPost({ url, data: payload, headers: { 'Content-Type': 'application/json' }, timeoutMs: 15000 }).then(resolve, reject);
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
   * Also paints the native bell trigger with the 3-state auto-fill mode
   * (off / fill-only / auto-submit) plus a cog jumping to its settings.
   */




  const ALARM_DURATIONS = ['90', '180', '365', '730'];
  const DURATION_LABELS = { 90: '3 Monate', 180: '6 Monate', 365: '1 Jahr', 730: '2 Jahre' };
  const clampAlarmTarget = v =>
    (Number.isFinite(v) ? Math.min(0.99, Math.max(0.05, v)) : 0.60);
  const normalizeAlarmDuration = v => {
    const s = String(v);
    return ALARM_DURATIONS.includes(s) ? s : '730';
  };
  // Live bell trigger (confirmed 2026-10-11 on search + product pages):
  // `.Plugin_NewInfoMailButton` container, clickable bell is
  // `a.f_showNewInfoMailFormDialog` with a `TPIcons-alarm` icon. Every match
  // is painted: product pages render hidden per-offer bells alongside the
  // visible header bell, and first-match-only left the visible ones unpainted.
  // Silent no-op when absent.
  const ALARM_BELL_SELECTORS = [
    '#mock-alarm-bell',
    '.Plugin_NewInfoMailButton a.f_showNewInfoMailFormDialog',
    '.Plugin_NewInfoMailButton a',
    'a[href*="NewInfoMail"]',
  ];
  const BELL_STYLE_ID = 'tp-alarm-bell-style';

  const alarmBellState = () => {
    if (CONFIG.ALARM_ENABLED === false) return 'off';
    return CONFIG.ALARM_AUTO_SUBMIT === false ? 'fill' : 'auto';
  };

  const findAlarmBells = () => {
    const seen = new Set();
    for (const sel of ALARM_BELL_SELECTORS)
      for (const el of document.querySelectorAll(sel))
        if (!seen.has(el)) seen.add(el);
    return [...seen];
  };

  function ensureAlarmBellStyle() {
    if (document.getElementById(BELL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = BELL_STYLE_ID;
    style.textContent = [
      '.tp-alarm-off{opacity:.45 !important;}',
      '.tp-alarm-fill,.tp-alarm-auto{position:relative !important;outline:2px solid #3b82f6 !important;outline-offset:2px;border-radius:4px;}',
      '.tp-alarm-auto::after{content:"\\26A1";position:absolute;top:-10px;right:-10px;font-size:12px;line-height:1;}',
      '.tp-alarm-cog{margin-left:6px;padding:0 4px;border:none;background:transparent;color:inherit;font-size:14px;line-height:1;cursor:pointer;opacity:.75;}',
      '.tp-alarm-cog:hover{opacity:1;}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureAlarmCog(bell) {
    const next = bell.nextElementSibling;
    if (next?.classList?.contains('tp-alarm-cog')) return next;
    const cog = document.createElement('button');
    cog.type = 'button';
    cog.className = 'tp-alarm-cog';
    cog.textContent = '⚙';
    cog.title = 'Preisalarm-Einstellungen';
    cog.setAttribute('aria-label', 'Preisalarm-Einstellungen');
    cog.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openSettingsAt('tp-section-alarm');
    });
    bell.after(cog);
    return cog;
  }

  function refreshAlarmBellDecor() {
    try {
      if (typeof document === 'undefined') return;
      ensureAlarmBellStyle();
      const bells = findAlarmBells();
      if (!bells.length) return;
      for (const bell of bells) {
        const state = alarmBellState();
        bell.classList.remove('tp-alarm-off', 'tp-alarm-fill', 'tp-alarm-auto');
        bell.classList.add(`tp-alarm-${state}`);
        bell.setAttribute('data-tp-alarm-state', state);
        const pct = Math.round(clampAlarmTarget(CONFIG.ALARM_TARGET_PERCENT) * 100);
        const dur = normalizeAlarmDuration(CONFIG.ALARM_DURATION_DAYS);
        const durLabel = DURATION_LABELS[dur] || dur;
        bell.title = state === 'off'
          ? 'Preisalarm auto-fill AUS — ⚙ für Einstellungen'
          : state === 'fill'
            ? `Preisalarm: füllt Ziel ${pct}% / ${durLabel} an — klicken zum Prüfen`
            : `Preisalarm AUTO: Ziel ${pct}% / ${durLabel}, sendet selbst`;
        ensureAlarmCog(bell);
      }
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] bell decor error', err);
    }
  }

  const clearAlarmTimers = modal => {
    const raw = modal.dataset.tpAlarmTimers;
    if (!raw) return;
    raw.split(',').forEach(id => clearTimeout(Number(id)));
    delete modal.dataset.tpAlarmTimers;
  };

  function processPriceAlarmModal() {
    refreshAlarmBellDecor();
    if (!CONFIG.ALARM_ENABLED) return;
    const modalContainer = document.querySelector('.Plugin_NewInfoMailForm');
    if (!modalContainer || modalContainer.dataset.tpAlarmProcessed === 'true') return;
    clearAlarmTimers(modalContainer);

    const priceEl = modalContainer.querySelector('.shippingPrice .Plugin_Price') ||
                    modalContainer.querySelector('.productPrice .Plugin_Price') ||
                    document.querySelector('.pageContent .priceContainer .Plugin_Price');
    if (!priceEl) return;

    const presentValue = parsePrice(priceEl.textContent);
    if (!(presentValue > 0)) return;
    modalContainer.dataset.tpAlarmProcessed = 'true';

    const targetPrice = (presentValue * clampAlarmTarget(CONFIG.ALARM_TARGET_PERCENT)).toFixed(2);
    const duration = normalizeAlarmDuration(CONFIG.ALARM_DURATION_DAYS);
    const priceInput = modalContainer.querySelector('input#f_NewInfoMailForm_priceFrom') || modalContainer.querySelector('input[name="im_nimf_pvf"]');
    if (priceInput) {
      priceInput.value = targetPrice;
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const durationHidden = modalContainer.querySelector('input[name="im_nimf_du"]');
    if (durationHidden) {
      durationHidden.value = duration;
      durationHidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
    modalContainer.querySelector(`li[data-value="${duration}"]`)?.click();

    if (CONFIG.ALARM_AUTO_SUBMIT) {
      const termsCheckbox = modalContainer.querySelector('input#im_nimf_prtrm');
      if (termsCheckbox) {
        termsCheckbox.checked = true;
        termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }

      try {
        const submitTimer = setTimeout(() => {
          const submitBtn = modalContainer.querySelector('input.f_submitbtn');
          if (!submitBtn) {
            if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Preisalarm: kein Submit-Button gefunden');
            return;
          }
          submitBtn.click();
          // Allow in-flight AJAX request to complete before closing the dialog container
          const closeTimer = setTimeout(() => {
            const closeBtn = modalContainer.closest('.AbstractDialog')?.querySelector('.AbstractDialog_CloseButton') ||
                             document.querySelector('#tmpAbstractDialogContainer .AbstractDialog_CloseButton');
            if (closeBtn) closeBtn.click();
            else if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Preisalarm: kein Close-Button gefunden');
          }, 800);
          modalContainer.dataset.tpAlarmTimers = `${submitTimer},${closeTimer}`;
        }, 300);
        modalContainer.dataset.tpAlarmTimers = String(submitTimer);
      } catch (err) {
        if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Preisalarm submit error', err);
      }
    }
  }

  setAlarmConfigListener(refreshAlarmBellDecor);

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
          const peakDropPct = pctDrop(stats.hoechstpreis, currentPrice);
          peakContext = ` (-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)})`;
        }
        badge.title = `Aktueller Bestpreis (CHF ${currentPrice.toFixed(2)}) ist der historische Allzeit-Tiefstpreis!${peakContext}`;
        badge.textContent = '🌟 Allzeit-Tiefstpreis';
      } else {
        const markupPct = pctRise(stats.tiefstpreis, currentPrice);
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
    const dismissChrome = () => { const staleBar = document.getElementById('tp-suite-filter-bar'); if (staleBar) staleBar.remove(); hideFloatingCTA(); };
    if (isModifyingDOM) return;
    if (isProductDetailPage()) { dismissChrome(); return; }
    isModifyingDOM = true;
    if (mainObserver) mainObserver.disconnect();
    try {
      const cards = getProductCards();
      if (cards.length === 0) { dismissChrome(); return; }

      // --- Extract ---
      const activeStores = extractActiveStores();
      const termsList = parseNegativeTerms();
      const isNeueFeed = isNeueToppreisePage();
      const minDealDiscount = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
      const cardDataList = cards.map(extractCardData);

      // --- Filter ---
      const counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, vortief: 0, uncheckedHidden: 0, dealer: 0, dealerActive: activeStores.length > 0, filteredCount: 0, dimmed: 0 };
      const pageHasOffers = cardDataList.some(cd => cd.offerCount > 0);

      for (const cd of cardDataList) {
        cd.filters = applyCardFilters(cd, termsList, CONFIG.MIN_OFFERS, pageHasOffers);
        if (cd.filters.isNeg) counts.neg++;
        if (cd.filters.isLowOffers) counts.min++;
        if (isNeueFeed) {
          if (cd.pid && !cd.stats && cd.discountVal !== null && cd.discountVal >= minDealDiscount && !isCardFilteredOut(cd.card, cd.filters, { forScan: true })) {
            counts.uncheckedDeals++;
          }
        } else {
          if (cd.pid && !cd.stats && !isCardFilteredOut(cd.card, cd.filters, { forScan: true })) {
            counts.uncheckedDeals++;
          }
        }
        // Verified markups are removed nowhere, so counted nowhere.
        cd.dealScore = cd.dealScore ?? computeDealScore(cd.stats, cd.cardPrice);
        if (cd.filters.isUnchecked) counts.uncheckedHidden++;
        if (cd.filters.isVortiefExcluded) counts.vortief++;
        // bestpreiseDeals feeds the empty-state "deals exist" guard: dealScore blends plus included Vortief lows; excluded-fallback lows count under vortief only.
        if (cd.dealScore) counts.bestpreiseDeals++;
        else if ((cd.displayDelta?.kind === 'at-low' || cd.displayDelta?.kind === 'new-low') && CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false) counts.bestpreiseDeals++;
      }

      // --- Render ---
      for (const cd of cardDataList) {
        renderCardEffects(cd, cd.filters, isNeueFeed, activeStores);
        if (cd.filters.isDealerLoser) counts.dealer++;
        if (cd.filters.isDimmed) counts.dimmed++;
        if (cd.filters.isFiltered) counts.filteredCount++;
      }

      // --- Sort ---
      applySorting(cards, pageHasOffers, cardDataList);

      // --- Empty state, filter bar & floating verify CTA ---
      renderEmptyState(cards, counts);
      renderSuiteFilterBar(counts, pageHasOffers, isNeueFeed);
      renderFloatingCTA(counts, isNeueFeed);
      const mig = migrateFilterSplit();
      if (mig.hadMode || mig.modeWasActive) showToast(mig.modeWasActive ? '💎 sortiert jetzt nur noch — Filtern entfernt, Ansicht dimmt (👁️ zeigt sie)' : 'Neu: Filtern entfernt Karten, Ansicht dimmt nur (👁️ zeigt sie)');
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
        return node.matches?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading, .Plugin_NewInfoMailButton') ||
               !!node.querySelector?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading, .Plugin_NewInfoMailButton');
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
        document.getElementById('tp-bar-filter-popover')?.classList.add('tp-show');
        document.getElementById('tp-bar-filter-btn')?.setAttribute('aria-expanded', 'true');
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
      processPriceAlarmModal,
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
