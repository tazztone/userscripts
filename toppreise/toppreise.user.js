// ==UserScript==
// @name         Toppreise.ch Suite: Power Filter & Price Alarm Auto-Filler
// @namespace    https://github.com/tazztone/userscripts
// @version      2.18.416
// @description  All-in-one suite for Toppreise.ch: Highlights best prices, discount heatmap, excludes negative keywords, sorts/filters by offer count/discount, checks real all-time Tiefstpreise, and automates price alarms.
// @author       tazztone
// @match        https://www.toppreise.ch/*
// @updateURL    https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js
// @downloadURL  https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      discord.com
// @connect      api.tavily.com
// @connect      toppreise.ch
// @connect      amazon.de
// @connect      graph.keepa.com
// @connect      graph2.keepa.com
// @connect      keepa.com
// @noframes
// ==/UserScript==

// ─── GENERATED BUNDLE - DO NOT EDIT DIRECTLY ─────────────────────────────────
// Source modules are located in src/.
// Built with: node tools/build.js
// ─────────────────────────────────────────────────────────────────────────────



// ─── STYLES ──────────────────────────────────────────────────────────────────
/** Tokens part (split from ui/styles.js): shared CSS custom properties. */

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

/** Cards part (split from ui/styles.js): heat/fresh/cheapest/filter-dim primitives, deal-badge core, card harmonize. */


const STYLES_CARDS = `
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
  :is(.mixedBrowsingList, .mixedList, .priceAvailabilityContainer, .price-availability) .tp-dealer-name {
    max-width: 140px !important;
    flex: 0 1 auto !important;
    margin-right: 4px !important;
  }
  a.tp-dealer-name:hover {
    opacity: 1 !important;
    text-decoration: underline !important;
  }
  button.tp-dealer-name.tp-dealer-btn,
  .priceContainer:has(> .tp-dealer-name) > button.tp-dealer-name.tp-dealer-btn,
  .Plugin_PriceInformation:has(> .tp-dealer-name) > button.tp-dealer-name.tp-dealer-btn,
  .price_information_product:has(> .tp-dealer-name) > button.tp-dealer-name.tp-dealer-btn,
  .product-price:has(> .tp-dealer-name) > button.tp-dealer-name.tp-dealer-btn {
    background: none !important;
    border: none !important;
    cursor: pointer !important;
    padding: 0 !important;
    opacity: 0.65 !important;
    pointer-events: auto !important;
    flex: 0 0 auto !important;
    width: auto !important;
    max-width: none !important;
    line-height: 1 !important;
    text-align: left !important;
  }
  :is(.Plugin_Product, .mixedBrowsingList, .mixedBrowsingListProduct, .Plugin_ProductCollItem):is(:hover, :focus-within) button.tp-dealer-name.tp-dealer-btn,
  button.tp-dealer-name.tp-dealer-btn:hover,
  button.tp-dealer-name.tp-dealer-btn:focus-visible {
    opacity: 1 !important;
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
  button.tp-card-alarm-btn {
    background: none !important;
    border: none !important;
    cursor: pointer !important;
    padding: 0 3px !important;
    opacity: 0 !important;
    pointer-events: none !important;
    flex: 0 0 auto !important;
    font-size: 13px !important;
    line-height: 1 !important;
    vertical-align: baseline !important;
    transition: opacity 0.15s ease !important;
  }
  :is(.Plugin_Product, .mixedBrowsingListProduct):is(:hover, :focus-within) button.tp-card-alarm-btn,
  button.tp-card-alarm-btn:hover,
  button.tp-card-alarm-btn:focus-visible {
    opacity: 0.75 !important;
    pointer-events: auto !important;
  }
  button.tp-card-alarm-btn:hover {
    opacity: 1 !important;
  }
  button.tp-card-alarm-btn:disabled {
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
  .tp-sparkline-container.tp-sparkline-amazon {
    box-shadow: 0 0 6px rgba(255, 153, 0, 0.45) !important;
    border-radius: 4px !important;
    border: 1px solid rgba(255, 153, 0, 0.5) !important;
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
    button.tp-dealer-name.tp-dealer-btn:not(:disabled),
    button.tp-card-alarm-btn:not(:disabled) {
      opacity: 0.45 !important;
      pointer-events: auto !important;
      touch-action: manipulation !important;
    }
    .tp-review-search-btn,
    button.tp-dealer-name.tp-dealer-btn,
    button.tp-card-alarm-btn {
      position: relative !important;
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
    button.tp-dealer-name.tp-dealer-btn::after,
    button.tp-card-alarm-btn::after {
      content: "" !important;
      position: absolute !important;
      top: -8px !important;
      bottom: -8px !important;
      left: -8px !important;
      right: -8px !important;
    }
  }
`;

/** Chrome part (split from ui/styles.js): bestpreise controls, empty state, detail badge, filter bar. */

const STYLES_CHROME = `
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
    accent-color: #6366f1 !important;
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
  .tp-bar-btn[aria-expanded="true"] { background: rgba(99,102,241,.12) !important; border-color: rgba(99,102,241,.45) !important; color: #4338ca !important; }
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
    background: var(--tp-acc) !important;
    border-color: var(--tp-acc-deep) !important;
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
  .tp-pill {
    min-width: 18px !important;
    height: 18px !important;
    padding: 0 5px !important;
    border-radius: var(--tp-r-pill) !important;
    font-size: var(--tp-fs-xs) !important;
    font-weight: 700 !important;
    display: inline-flex;
    align-items: center !important;
    justify-content: center !important;
    font-variant-numeric: tabular-nums !important;
    box-sizing: border-box !important;
    line-height: 1 !important;
    margin: 0 2px !important;
  }
  .tp-bar-btn .tp-pill.tp-pill-hide,
  .tp-pill.tp-pill-hide {
    background: #ea580c !important;
    color: #ffffff !important;
  }
  .tp-bar-btn .tp-pill.tp-pill-dim,
  .tp-pill.tp-pill-dim {
    background: #eab308 !important;
    color: #451a03 !important;
  }
  .tp-bar-btn .tp-pill.tp-pill-hl,
  .tp-pill.tp-pill-hl {
    background: #10b981 !important;
    color: #ffffff !important;
  }
  /* Ad & top empty space suppression */
  html.tp-hide-ads :is(#advertising_mobile, #advertising_leaderboard, #advertising_halfpage, .adsFullsizeContainer, .advertising_leaderboard_container, .adsContainer) {
    display: none !important;
  }
  html.tp-hide-ads body.adsFullsize #tpFrame {
    min-height: 0 !important;
  }

  /* Expandable Sidebar Category Tree */
  .tp-cat-search-box {
    position: relative !important;
    margin: 6px 0 10px 0 !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .tp-cat-search-input {
    width: 100% !important;
    height: 28px !important;
    padding: 3px 22px 3px 8px !important;
    font: 500 12px var(--tp-font) !important;
    border-radius: var(--tp-r-sm) !important;
    border: 1px solid var(--tp-line-soft) !important;
    background: rgba(255, 255, 255, 0.8) !important;
    color: var(--tp-txt) !important;
    box-sizing: border-box !important;
    outline: none !important;
  }
  .tp-cat-search-input:focus {
    border-color: var(--tp-blue-soft) !important;
    background: #ffffff !important;
  }
  .tp-cat-search-clear {
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    background: transparent !important;
    border: none !important;
    cursor: pointer !important;
    font-size: 11px !important;
    color: var(--tp-txt-dim) !important;
    padding: 0 !important;
    line-height: 1 !important;
  }
  .tp-cat-search-results {
    max-height: 260px !important;
    overflow-y: auto !important;
    background: #ffffff !important;
    border: 1px solid var(--tp-line-soft) !important;
    border-radius: var(--tp-r-sm) !important;
    margin-top: 4px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    position: absolute !important;
    top: 100% !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 100 !important;
  }
  .tp-cat-result-item {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 3px 6px 3px 8px !important;
    text-decoration: none !important;
    border-bottom: 1px solid rgba(0,0,0,0.05) !important;
    transition: background 0.15s ease !important;
  }
  .tp-cat-result-item:hover {
    background: rgba(59, 130, 246, 0.08) !important;
  }
  .tp-cat-result-link {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 auto !important;
    min-width: 0 !important;
    padding: 3px 0 !important;
    text-decoration: none !important;
  }
  .tp-cat-res-title {
    font-size: 12px !important;
    font-weight: 600 !important;
    color: var(--tp-txt) !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }
  .tp-cat-res-path {
    font-size: 10.5px !important;
    color: var(--tp-txt-dim) !important;
    margin-top: 1px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }
  .tp-cat-result-item .ignoreCategory {
    margin-left: 8px !important;
    flex: 0 0 auto !important;
    cursor: pointer !important;
    font-size: 11px !important;
    padding: 2px 6px !important;
    line-height: 1 !important;
    border-radius: 3px !important;
    border: 1px solid transparent !important;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
  }
  .tp-cat-result-item .ignoreCategory.f_IgnoredCategories_Hide:hover {
    border-color: rgba(239, 68, 68, 0.3) !important;
  }
  .tp-cat-result-item .ignoreCategory.f_IgnoredCategories_Show:hover {
    border-color: rgba(16, 185, 129, 0.3) !important;
  }
  .tp-cat-result-item.ignoredCategoryEntry {
    background: rgba(239, 68, 68, 0.08) !important;
  }
  .tp-cat-result-item.ignoredCategoryEntry .tp-cat-res-title {
    color: #f87171 !important;
    text-decoration: line-through !important;
  }
  .tp-cat-result-item.ignoredCategoryEntry .tp-cat-res-path {
    color: #fca5a5 !important;
  }
  .tp-cat-result-item.ignoredCategoryEntry .tp-cat-result-link {
    opacity: 0.8 !important;
  }
  .tp-cat-no-results {
    padding: 8px !important;
    font-size: 11.5px !important;
    color: var(--tp-txt-dim) !important;
    text-align: center !important;
  }

  /* Node and row hierarchy: vertical stacking prevents horizontal sublist blowout */
  .Plugin_CategoryMainSelectionLeft li.tp-cat-node,
  .tp-cat-sublist li.tp-cat-node {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    justify-content: flex-start !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    box-sizing: border-box !important;
  }
  /* Suppress sublists and disable accordion toggles for ignored categories */
  .Plugin_CategoryMainSelectionLeft li:is(.ignoredCategoryEntry, :has(> .tp-cat-row > .f_IgnoredCategories_Show, > .f_IgnoredCategories_Show)) > .tp-cat-sublist {
    display: none !important;
  }
  .Plugin_CategoryMainSelectionLeft li:is(.ignoredCategoryEntry, :has(> .tp-cat-row > .f_IgnoredCategories_Show, > .f_IgnoredCategories_Show)) > .tp-cat-row .tp-cat-toggle {
    opacity: 0.25 !important;
    pointer-events: none !important;
    cursor: default !important;
  }
  .Plugin_CategoryMainSelectionLeft li:is(.ignoredCategoryEntry, :has(> .tp-cat-row > .f_IgnoredCategories_Show, > .f_IgnoredCategories_Show)) > .tp-cat-row {
    background: rgba(239, 68, 68, 0.08) !important;
    border-radius: var(--tp-r-sm, 4px) !important;
    padding-left: 2px !important;
    padding-right: 2px !important;
  }
  .Plugin_CategoryMainSelectionLeft li:is(.ignoredCategoryEntry, :has(> .tp-cat-row > .f_IgnoredCategories_Show, > .f_IgnoredCategories_Show)) > .tp-cat-row > a {
    color: #f87171 !important;
    text-decoration: line-through !important;
    opacity: 0.8 !important;
  }
  .tp-cat-row {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-between !important;
    width: 100% !important;
    min-height: 22px !important;
    padding: 2px 0 !important;
    box-sizing: border-box !important;
  }
  .tp-cat-row > a {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    text-decoration: none !important;
    color: var(--tp-txt) !important;
    font-size: 12px !important;
    line-height: 1.3 !important;
  }
  .tp-cat-row > a:hover {
    color: var(--tp-blue-soft) !important;
  }
  .tp-cat-toggle {
    background: transparent !important;
    border: none !important;
    cursor: pointer !important;
    padding: 0 !important;
    margin: 0 3px 0 0 !important;
    font-size: 9px !important;
    color: var(--tp-txt-dim) !important;
    width: 14px !important;
    height: 14px !important;
    line-height: 14px !important;
    text-align: center !important;
    flex: 0 0 14px !important;
    transition: transform 0.15s ease !important;
  }
  .tp-cat-toggle:hover {
    color: var(--tp-blue-soft) !important;
  }
  .tp-cat-spacer {
    display: inline-block !important;
    width: 14px !important;
    height: 14px !important;
    margin: 0 3px 0 0 !important;
    flex: 0 0 14px !important;
  }
  .tp-cat-row .ignoreCategory {
    margin-left: 4px !important;
    flex: 0 0 auto !important;
    cursor: pointer !important;
    font-size: 11px !important;
    padding: 1px 4px !important;
    line-height: 1 !important;
    border-radius: 3px !important;
    transition: background 0.15s ease, color 0.15s ease !important;
  }
  .Plugin_CategoryMainSelectionLeft .ignoreCategory.f_IgnoredCategories_Hide {
    color: #ef4444 !important;
    opacity: 0.85 !important;
  }
  .Plugin_CategoryMainSelectionLeft .ignoreCategory.f_IgnoredCategories_Hide:hover {
    color: #dc2626 !important;
    background: rgba(239, 68, 68, 0.16) !important;
    opacity: 1 !important;
  }
  .Plugin_CategoryMainSelectionLeft .ignoreCategory.f_IgnoredCategories_Show {
    color: #10b981 !important;
    opacity: 0.85 !important;
  }
  .Plugin_CategoryMainSelectionLeft .ignoreCategory.f_IgnoredCategories_Show:hover {
    color: #059669 !important;
    background: rgba(16, 185, 129, 0.16) !important;
    opacity: 1 !important;
  }
  .tp-cat-sublist {
    list-style: none !important;
    margin: 1px 0 2px 6px !important;
    padding: 0 0 0 5px !important;
    border-left: 1px solid rgba(148, 163, 184, 0.3) !important;
    width: calc(100% - 6px) !important;
    box-sizing: border-box !important;
  }
  .tp-cat-sublist .tp-cat-row > a {
    font-size: 11.5px !important;
    color: #64748b !important;
  }
  .tp-cat-sublist .tp-cat-row > a:hover {
    color: var(--tp-blue-soft) !important;
  }
  .tp-cat-row.tp-cat-loading,
  .tp-cat-result-item.tp-cat-loading {
    opacity: 0.55 !important;
    pointer-events: none !important;
    transition: opacity 0.2s ease !important;
  }
`;

/** Overlays part (split from ui/styles.js): calc/filter popovers, floating CTA, responsive queries. */

const STYLES_OVERLAYS = `
  /* Dimmed tool: the control a switched-OFF mini-toggle belongs to reads inactive. */
  .tp-tool-dim {
    opacity: 0.45 !important;
    filter: saturate(0.4) !important;
    transition: opacity 0.2s ease !important;
  }
  .tp-bar-btn.tp-filters-paused {
    opacity: 0.55 !important;
    filter: saturate(0.5) !important;
    transition: opacity 0.2s ease !important;
  }
  .tp-bar-btn.tp-filters-paused .tp-count-badge {
    opacity: 0.75 !important;
    filter: grayscale(40%) !important;
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
    width: 390px !important;
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
  .tp-filter-row .tp-filter-label {
    flex: 0 0 95px !important;
    width: 95px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  .tp-filter-row [data-row-count] {
    margin-left: auto !important;
  }
  .tp-filter-row:not(:has([data-row-count]:not([style*="display: none"]))) .tp-filter-mode-btn {
    margin-left: auto !important;
  }
  .tp-filter-row .tp-bar-stepper-group {
    margin-left: auto !important;
  }
  .tp-range-group {
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
  }
  .tp-range-input {
    width: 54px !important;
    height: 22px !important;
    padding: 1px 5px !important;
    font-size: var(--tp-fs-xs) !important;
    font-weight: 500 !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid var(--tp-line-soft) !important;
    border-radius: var(--tp-r-sm) !important;
    color: var(--tp-txt) !important;
    text-align: right !important;
    outline: none !important;
    box-sizing: border-box !important;
  }
  .tp-range-input:focus {
    border-color: var(--tp-pri) !important;
  }
  .tp-range-input::-webkit-inner-spin-button,
  .tp-range-input::-webkit-outer-spin-button {
    -webkit-appearance: none !important;
    margin: 0 !important;
  }
  .tp-range-input {
    -moz-appearance: textfield !important;
  }
  .tp-range-sep {
    font-size: var(--tp-fs-xs) !important;
    color: var(--tp-mut) !important;
    user-select: none !important;
  }
  .tp-glossary-term {
    text-decoration: underline dotted var(--tp-mut) !important;
    text-underline-offset: 3px !important;
    cursor: help !important;
  }
  .tp-row-inactive { opacity: .55 !important; }
  .tp-row-inactive button:disabled { cursor: not-allowed !important; }
  .tp-row-inactive #tp-bar-min-offers-group { display: none !important; }
  .tp-filter-note {
    font-size: var(--tp-fs-xs) !important;
    color: var(--tp-mut) !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    flex: 1 1 auto !important;
  }
  .tp-filter-mode-btn {
    font-size: var(--tp-fs-xs) !important;
    font-weight: 600 !important;
    padding: 2px 7px !important;
    border: 1px solid var(--tp-line) !important;
    border-radius: var(--tp-r-md) !important;
    background: #ffffff !important;
    color: var(--tp-txt-dim, #64748b) !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    line-height: 1.4 !important;
  }
  .tp-filter-mode-btn::after {
    content: " ▾";
    font-size: 9px !important;
    opacity: 0.6 !important;
  }
  .tp-filter-mode-btn.tp-state-normal {
    background: #ffffff !important;
    border-color: var(--tp-line) !important;
    color: var(--tp-txt-dim, #64748b) !important;
  }
  .tp-filter-mode-btn.tp-state-dim {
    background: rgba(234, 179, 8, 0.16) !important;
    border-color: rgba(234, 179, 8, 0.45) !important;
    color: #854d0e !important;
  }
  .tp-filter-mode-btn.tp-state-hide {
    background: rgba(249, 115, 22, 0.16) !important;
    border-color: rgba(249, 115, 22, 0.45) !important;
    color: #9a3412 !important;
  }
  .tp-filter-mode-btn.tp-state-highlight {
    background: rgba(16, 185, 129, 0.15) !important;
    border-color: rgba(16, 185, 129, 0.45) !important;
    color: #047857 !important;
  }
  .tp-calc-head {
    display: flex !important;
    flex-direction: column !important;
    gap: 2px !important;
  }
  .tp-calc-head .tp-glossary-term,
  .tp-threshold-wrapper .tp-stepper-label.tp-glossary-term {
    font-weight: 700 !important;
    font-size: var(--tp-fs-md) !important;
    color: var(--tp-txt) !important;
    line-height: 1.3 !important;
    text-decoration: none !important;
  }
  .tp-threshold-wrapper .tp-stepper-label.tp-glossary-term {
    font-size: 11px !important;
    font-weight: 600 !important;
    color: #475569 !important;
  }
  .tp-calc-head span:not(.tp-glossary-term) {
    display: block !important;
    font-weight: 400 !important;
    font-size: var(--tp-fs-xs) !important;
    color: var(--tp-mut) !important;
    line-height: 1.3 !important;
  }
  #tp-bar-calc-popover .tp-threshold-wrapper {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    height: auto !important;
    padding: 0 !important;
    display: grid !important;
    grid-template-columns: 92px 68px 1fr !important;
    align-items: center !important;
    gap: 8px !important;
  }
  #tp-bar-calc-popover #tp-bar-outlier-wrapper { justify-content: flex-start !important; }
  #tp-bar-outlier-band-range, #tp-bar-outlier-hours-range { accent-color: var(--tp-acc) !important; width: 100% !important; }
  #tp-bar-calc-popover .tp-threshold-wrapper input[type="range"] {
    flex: 1 !important;
    width: auto !important;
  }
  #tp-bar-calc-popover #tp-bar-horizon-range { width: auto !important; }
  #tp-bar-calc-popover #tp-bar-weight-range { width: auto !important; }
  .tp-calc-reset { align-self: flex-end !important; }
  #tp-bar-calc-popover { max-height: min(70vh, 560px) !important; overflow-y: auto !important; }
  #tp-calc-preview { border-top: 1px solid var(--tp-line) !important; margin-top: 6px !important; padding-top: 6px !important; display: flex !important; flex-direction: column !important; gap: 4px !important; }
  .tp-preview-head { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; }
  .tp-preview-select { font-size: 11px !important; max-width: 190px !important; border: 1px solid var(--tp-line) !important; border-radius: var(--tp-r-md) !important; padding: 2px 6px !important; background: transparent !important; color: var(--tp-txt) !important; }
  #tp-preview-svg { width: 100% !important; height: auto !important; display: block !important; }
  #tp-preview-legend, #tp-preview-blend, #tp-preview-status { font-size: 11px !important; color: var(--tp-txt-dim) !important; }
  #tp-preview-key { font-size: 11px !important; color: var(--tp-txt-dim) !important; display: flex !important; gap: 10px !important; }
  #tp-preview-key .tp-pv-k-main { color: #3b82f6 !important; font-weight: 700 !important; }
  #tp-preview-key .tp-pv-k-med { color: #64748b !important; font-weight: 700 !important; }
  #tp-preview-key .tp-pv-k-rec { color: #f59e0b !important; font-weight: 700 !important; }
  #tp-preview-key .tp-pv-k-g { color: #f43f5e !important; font-weight: 700 !important; }
  #tp-preview-key .tp-pv-k-demo { color: #3b82f6 !important; font-weight: 700 !important; }
  #tp-preview-key .tp-pv-k-band { color: #3b82f6 !important; opacity: 0.8 !important; font-weight: 700 !important; }
  #tp-calc-preview[data-focus="weight"] .tp-pv-main { stroke-width: 2.5 !important; }
  #tp-calc-preview[data-focus="weight"] .tp-pv-med, #tp-calc-preview[data-focus="weight"] .tp-pv-rec { opacity: 1 !important; }
  #tp-calc-preview[data-focus="band"] .tp-pv-band { opacity: 0.32 !important; }
  #tp-calc-preview[data-focus="band"] .tp-pv-x { font-weight: 700 !important; }
  #tp-calc-preview[data-focus="window"] .tp-pv-cut { stroke-width: 2 !important; }
  .tp-pv-chip { font-size: 11px !important; border: 1px solid var(--tp-line) !important; border-radius: 999px !important; padding: 0 8px !important; margin-right: 6px !important; white-space: nowrap !important; }
  .tp-pv-formula { display: inline-flex !important; width: 64px !important; height: 8px !important; border-radius: 4px !important; overflow: hidden !important; vertical-align: middle !important; margin-left: 6px !important; }
  .tp-pv-formula > i { background: #64748b !important; display: block !important; }
  .tp-pv-formula > b { background: #f59e0b !important; display: block !important; }
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
    0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 0 8px rgba(16,185,129,0.2); }
    50% { box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 0 18px rgba(16,185,129,0.45); }
  }
  @media (prefers-reduced-motion: reduce) {
    #tp-floating-check-cta { animation: none !important; }
    .tp-tool-dim, .tp-mini-slider, .tp-mini-slider:before, .tp-switch .tp-slider, .tp-switch .tp-slider:before { transition: none !important; }
  }
  @media (prefers-contrast: more) {
    .badge-dif.tp-is-verified, .badge-dif.tp-deal-alltime-low, .badge-dif.tp-deal-new-record { color: #fff !important; border-width: 2px !important; }
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

/**
 * Styles barrel (split into ui/styles/ parts): composes the document
 * stylesheet; app.js and shell.js imports stay untouched.
 */






const STYLES = STYLES_CARDS + STYLES_CHROME + STYLES_OVERLAYS;

/** Shadow-modal part (split from ui/styles.js): isolated Shadow DOM dialog styles. */


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
  .tp-glossary-term {
    text-decoration: underline dotted var(--tp-mut) !important;
    text-underline-offset: 3px !important;
    cursor: help !important;
  }
  .tp-section-card { background: rgba(255, 255, 255, 0.65); border: 1px solid var(--tp-line-soft); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .tp-section-card.tp-flash { border-color: var(--tp-blue-soft); box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.45); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
  .tp-section-card .tp-settings-group { margin-bottom: 10px; }
  .tp-section-header { background:none; border:none; padding:4px 0; margin:0; width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; cursor:pointer; font-size:13px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:var(--tp-txt); font-family:inherit; }
  .tp-section-header:focus-visible { outline:2px solid var(--tp-focus); outline-offset:2px; border-radius:6px; }
  .tp-section-header .tp-chevron { color: var(--tp-mut); font-size: 14px; }
  .tp-section-header .tp-chevron::after { content:"▾"; display:inline-block; transition:transform .15s ease; }
  section.tp-collapsed .tp-section-header .tp-chevron::after { transform:rotate(-90deg); }
  section.tp-collapsed .tp-section-body { display:none; }
  .tp-danger-zone { border:1px solid rgba(239,68,68,.45); border-radius:10px; padding:10px 12px; }
  .tp-btn-danger { border:1px solid rgba(239,68,68,.6); color:#b91c1c; background:rgba(239,68,68,.08); }
  .tp-section-card { border-color: var(--tp-line-soft); }
  .tp-field-dark { width: 100%; background: var(--tp-bg); color: var(--tp-txt); border: 1px solid var(--tp-line-soft); border-radius: var(--tp-r-sm); padding: 6px 10px; font-size: var(--tp-fs-md); margin-top: 4px; box-sizing: border-box; }
  select.tp-field-dark { font-size: var(--tp-fs-lg); }
  .tp-field-hint { display: block; margin-top: 4px; font-size: var(--tp-fs-sm); opacity: 0.85; }
  .tp-btn-row { display: flex; flex-direction: row; gap: 8px; }
  .tp-btn-row .tp-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .tp-discord-channels-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .tp-discord-channel-card { background: rgba(0, 0, 0, 0.03); border: 1px solid var(--tp-line-soft); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
  .tp-discord-channel-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .tp-discord-channel-name { font-weight: 600; font-size: 13px; }
  .tp-discord-extra-collapsed { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  #tp-discord-extra-channels { display: flex; flex-direction: column; gap: 8px; }
  #tp-discord-layout-preview { white-space: pre-wrap !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
  #tp-discord-layout-preview .tp-md-lg { font-size: 16px !important; font-weight: 800 !important; }
  #tp-discord-layout-preview .tp-md-md { font-size: 14px !important; font-weight: 800 !important; }
  #tp-discord-layout-preview .tp-md-sm { font-size: 12px !important; font-weight: 700 !important; }
  #tp-discord-layout-preview .tp-md-link { font-weight: 700 !important; }
  #tp-discord-layout-preview .tp-md-url { opacity: .65 !important; font-size: 11px !important; }
  #tp-discord-layout-preview .tp-md-quote { display: block; border-left: 3px solid #5865f2 !important; padding-left: 8px !important; margin: 2px 0 !important; opacity: .9 !important; }
  .tp-settings-subhead {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--tp-mut);
    margin: 16px 0 10px 0;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--tp-line-soft);
  }
  .tp-search-preview-box {
    margin-top: 8px;
    padding: 8px 12px;
    background: rgba(15, 23, 42, 0.04);
    border: 1px dashed var(--tp-line-soft);
    border-radius: var(--tp-r-sm);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tp-search-preview-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--tp-mut);
  }
  .tp-search-preview-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tp-search-preview-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--tp-mut);
  }
  .tp-search-preview-text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
    color: var(--tp-txt);
    word-break: break-word;
    line-height: 1.4;
    background: rgba(0, 0, 0, 0.03);
    padding: 3px 6px;
    border-radius: 4px;
  }
  .tp-search-preview-text.tp-muted {
    color: var(--tp-dim);
    font-size: 11px;
  }
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
  .tp-segmented-control input[type="radio"] { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; opacity: 0; }
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
    pointer-events: none;
  }
  .tp-toast {
    background: rgba(255,255,255,0.97);
    pointer-events: none;
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

  /* Discord Share Preview Dialog */
  dialog#tp-modal-share-preview {
    box-sizing: border-box;
    width: 92%;
    max-width: 520px;
    max-height: 85vh;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--tp-line-soft);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border-radius: 16px;
    color: var(--tp-txt);
    padding: 20px;
    margin: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  dialog#tp-modal-share-preview::backdrop {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .tp-share-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .tp-share-preview-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
    color: var(--tp-txt);
  }
  .tp-share-preview-close {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    color: var(--tp-mut);
    line-height: 1;
    padding: 0 4px;
  }
  .tp-share-preview-close:hover { color: var(--tp-txt); }
  .tp-share-preview-body {
    max-height: 52vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tp-share-preview-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: var(--tp-mut);
    font-size: 13px;
  }
  .tp-share-preview-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #dc2626;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
  }
  .tp-share-preview-label { font-size: 12px; font-weight: 600; color: var(--tp-mut); margin-bottom: 4px; }
  .tp-share-preview-message {
    background: #2b2d31;
    color: #dbdee1;
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .tp-share-preview-message .tp-md-lg { font-size: 16px; font-weight: 800; }
  .tp-share-preview-message .tp-md-md { font-size: 14px; font-weight: 800; }
  .tp-share-preview-message .tp-md-sm { font-size: 12px; font-weight: 700; }
  .tp-share-preview-message .tp-md-link { font-weight: 700; color: #00a8fc; text-decoration: none; }
  .tp-share-preview-message .tp-md-url { opacity: .65; font-size: 11px; }
  .tp-share-preview-message .tp-md-quote { display: block; border-left: 3px solid #5865f2; padding-left: 8px; margin: 2px 0; opacity: .9; }
  .tp-share-preview-images {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .tp-share-preview-img {
    max-height: 120px;
    max-width: 100%;
    border-radius: 6px;
    border: 1px solid var(--tp-line-soft);
    object-fit: contain;
    background: #fff;
  }
  .tp-share-preview-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding-top: 10px;
    border-top: 1px solid var(--tp-line-soft);
  }
  .tp-share-preview-channels {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tp-share-channel-btn {
    background: #5865f2;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .tp-share-channel-btn:hover:not(:disabled) {
    background: #4752c4;
  }
  .tp-share-channel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

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

  // Absolute CHF savings based on card price and percentage discount
  const computeSavingsChf = (cardPrice, effectiveDiscount) => {
    if (!cardPrice || cardPrice <= 0 || !effectiveDiscount || effectiveDiscount <= 0) return 0;
    if (effectiveDiscount >= 100) return cardPrice;
    const savings = cardPrice * (effectiveDiscount / (100 - effectiveDiscount));
    return Math.round(savings * 100) / 100;
  };

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
    let clean = str.replace(/\.(?:–|-)|\s*[.–\-]\s*$/g, '.00').replace(/[^\d,.]/g, '');

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
    if (!card) return { price: 0, el: null, basis: null };

    if (card._tpPriceInfo) {
      const els = Object.values(card._tpPriceInfo);
      if (els.some(el => el && card.contains?.(el) === false)) delete card._tpPriceInfo;
    }
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

    // Basis follows the winning element: callers comparing against per-mode
    // history must refuse cross-basis prices instead of scoring them.
    const basis = !priceEl ? null
      : (priceEl === mainShipping || priceEl === fallbackShipping) ? 'shipping'
      : (priceEl === mainProduct || priceEl === fallbackProduct) ? 'product' : null;
    return {
      price: priceEl ? parsePrice(priceEl.textContent) : 0,
      el: priceEl,
      basis
    };
  }

  function parsePriceStatsFromHtml(html) {
    if (!html) return null;

    const hasDOMParser = typeof DOMParser !== 'undefined';
    const doc = hasDOMParser ? new DOMParser().parseFromString(html, 'text/html') : null;

    const titleEls = doc ? [...doc.querySelectorAll('.title,.col-12.title'), ...[...doc.querySelectorAll('div')].filter(el => el.children.length === 0)] : [];
    const titleByText = new Map();
    for (const el of titleEls) {
      const key = el.textContent.trim().toLowerCase();
      if (!titleByText.has(key)) titleByText.set(key, el);
    }
    const extractPrice = titleText => {
      if (doc) {
        const found = titleByText.get(titleText.toLowerCase());
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
      const reg = new RegExp(`${escapedTitle}[\\s\\S]{1,400}?class="[^"]*Plugin_Price[^"]*"[^>]*>\\s*(?:[A-Za-z]+\\s*)?(\\d[\\d.,'’]*(?:\\s*[.–\\-])?)(?=[<"'\\s]|$)`, 'i');
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

  function rollingMedians(points) {
    if (!points || !points.length) return [];
    const n = points.length;
    const result = new Array(n);
    const win = [];
    for (let m = 0; m < n; m++) {
      win.length = 0;
      const start = Math.max(0, m - 15);
      const end = Math.min(n - 1, m + 15);
      for (let w = start; w <= end; w++) win.push(points[w][1]);
      win.sort((a, b) => a - b);
      result[m] = medianOf(win);
    }
    return result;
  }

  function sanitizeTimeSeries(points, band = CONFIG.OUTLIER_DEVIATION_BAND, maxGlitchHours = CONFIG.OUTLIER_MAX_GLITCH_HOURS, currentPrice = null) {
    const isLiveAnchored = p => {
      if (typeof currentPrice !== 'number' || !(currentPrice > 0)) return false;
      if (priceToCents(p) === priceToCents(currentPrice)) return true;
      return Math.abs(p - currentPrice) / Math.max(p, currentPrice) <= 0.05;
    };
    if (!(band > 0 && band < 1)) band = 0.50;
    if (!Number.isFinite(maxGlitchHours) || maxGlitchHours <= 0) maxGlitchHours = 48;
    let sorted0;
    if (Array.isArray(points)) {
      let isMonotonic = true;
      for (let i = 1; i < points.length; i++) {
        if (points[i][0] < points[i - 1][0]) {
          isMonotonic = false;
          break;
        }
      }
      sorted0 = isMonotonic ? points : [...points].sort((a, b) => a[0] - b[0]);
    } else {
      sorted0 = [];
    }
    const rawMin = sorted0.length ? Math.min(...sorted0.map(p => p[1])) : 0;
    if (!points || points.length < 3) {
      return { cleanPoints: points || [], filteredOutliers: [], rawMedian: 0, rawMin };
     }

    const sorted = sorted0;
    const prices = sorted.map(p => p[1]).sort((a, b) => a - b);
    const rawMedian = medianOf(prices);

    if (rawMedian <= 0) {
      return { cleanPoints: sorted, filteredOutliers: [], rawMedian: 0, rawMin };
     }
    const cleanPoints = [];
    const filteredOutliers = [];
    const n = sorted.length;
    // Rolling ±15-point local medians: a sustained level (launch prices,
    // regime shifts) is normal against its neighbors even when far from the
    // lifetime median. Edge windows shrink; no padding.
    // ponytail: O(n·31 log 31) scan; fine at n ≈ 4000, no optimization.
    const localMedians = rollingMedians(sorted);
    const isNormalAt = m => localMedians[m] > 0 && Math.abs(sorted[m][1] - localMedians[m]) / localMedians[m] <= band;
    const localThreshold = Math.min(band, 0.05);
    const isLocallySharp = m => {
      const refs = [];
      if (m > 0) refs.push(sorted[m - 1][1]);
      if (m < n - 1) refs.push(sorted[m + 1][1]);
      if (!refs.length) return true;
      const ref = refs.length > 1 ? (refs[0] + refs[1]) / 2 : refs[0];
      return ref > 0 && Math.abs(sorted[m][1] - ref) / ref > localThreshold;
    };
    let i = 0;
    while (i < n) {
      if (isNormalAt(i)) {
        cleanPoints.push(sorted[i]);
        i++;
        continue;
      }
      const j = i;
      let k = j;
      while (k < n && !isNormalAt(k)) k++;
      const startTs = sorted[j - 1]?.[0] ?? sorted[j][0];
      const endTs = sorted[k]?.[0] ?? sorted[k - 1][0];
      const runH = (endTs - startTs) / 3600000;
      let isGlitch = runH <= maxGlitchHours + 0.5;
      if (isGlitch) for (let m = j; m < k; m++) if (!isLocallySharp(m)) { isGlitch = false; break; }
      if (isGlitch && k - j === 1 && (j === 0 || k === n) && n > 1) { const nb = j === 0 ? 1 : n - 2; if (!isNormalAt(nb)) isGlitch = false; }
      if (isGlitch && k === n) for (let m = j; m < k; m++) if (isLiveAnchored(sorted[m][1])) { isGlitch = false; break; }
      for (let m = j; m < k; m++) {
        const [ts, price] = sorted[m];
        if (isGlitch) filteredOutliers.push({ timestamp: ts, price, rawMedian });
        else cleanPoints.push(sorted[m]);
      }
      i = k;
    }

    const useClean = cleanPoints.length >= 2;
    return {
      cleanPoints: useClean ? cleanPoints : sorted,
      filteredOutliers: useClean ? filteredOutliers : [],
      rawMedian,
      rawMin,
      localMedians
    };
  }

  function analyzePriceTimeSeries(series, currentPrice = null, horizonOverride = null, nowMs = Date.now()) {
    if (!series || !Array.isArray(series) || series.length === 0) return null;

    let rawPoints = series;
    if (Array.isArray(series[0]) && series[0].length > 0 && Array.isArray(series[0][0])) {
      rawPoints = series[0];
    }

    const toMs = tsRaw => {
      const ts = typeof tsRaw === 'number' ? tsRaw : parseInt(tsRaw, 10);
      return ts < 1e12 ? ts * 1000 : ts;
    };
    const rawParsedPoints = rawPoints.map(p => {
      if (Array.isArray(p) && p.length >= 2) {
        const ts = toMs(p[0]);
        const pr = typeof p[1] === 'number' ? p[1] : parsePrice(String(p[1]));
        return pr > 0 ? [ts, pr] : null;
      }
      if (p && typeof p.price === 'number' && p.price > 0) {
        return [toMs(p.timestamp || p.time || 0), p.price];
      }
      return null;
    }).filter(Boolean);

    if (rawParsedPoints.length === 0) return null;
    // Normalize regardless of outlier toggle: validate, sort ascending, dedupe
    // duplicate timestamps keeping the LAST occurrence.
    const seen = new Map();
    for (const [ts, pr] of rawParsedPoints) {
      if (!Number.isFinite(ts) || ts <= 0 || ts > nowMs + 86400000) continue;
      if (!Number.isFinite(pr) || pr <= 0) continue;
      seen.set(ts, pr);
    }
    const normPoints = [...seen.entries()].sort((a, b) => a[0] - b[0]);
    if (normPoints.length === 0) return null;

    const outlierRejectionEnabled = (CONFIG.OUTLIER_REJECTION_ENABLED !== false);
    const sanitizeResult = outlierRejectionEnabled
      ? sanitizeTimeSeries(normPoints, CONFIG.OUTLIER_DEVIATION_BAND, CONFIG.OUTLIER_MAX_GLITCH_HOURS, currentPrice)
      : { cleanPoints: normPoints, filteredOutliers: [], rawMin: Math.min(...normPoints.map(p => p[1])) };

    const points = sanitizeResult.cleanPoints;
    const filteredOutliers = sanitizeResult.filteredOutliers;

    const prices = points.map(p => p[1]);
    const curr = (typeof currentPrice === 'number' && currentPrice > 0) ? currentPrice : prices[prices.length - 1];
    const allTimeLow = Math.min(...prices);
    const allTimeHigh = Math.max(...prices);

    // Trailing-plateau walk: only points already AT (or below) the current price
    // belong to the current regime. Strict cent comparison — the old 1% band
    // swallowed sub-1% dips into the plateau and overstated micro-records.
    // When current price is strictly above the historical all-time low, it cannot
    // be a new record; previousLow is the allTimeLow.
    const currCents = priceToCents(curr);
    const allTimeLowCents = priceToCents(allTimeLow);
    let previousLow;
    if (currCents > allTimeLowCents) {
      previousLow = allTimeLow;
    } else {
      let idx = prices.length - 1;
      while (idx > 0 && priceToCents(prices[idx]) <= currCents) {
        idx--;
      }
      const historicalPrices = prices.slice(0, idx + 1);
      previousLow = historicalPrices.length > 0 ? Math.min(...historicalPrices) : allTimeLow;
    }

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
      const cutoffTime = nowMs - horizonDays * 86400 * 1000;
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
      timeSeries: points,
      anchorPrice: curr,
      ...(sanitizeResult.filteredOutliers.length ? { rawTimeSeries: normPoints } : null),
      rawTiefstpreis: sanitizeResult.rawMin ?? Math.min(...normPoints.map(p => p[1]))
    };
  }

  /**
   * Live-anchored record reference for one concrete offer price.
   * The cached analysis anchors its trailing-plateau walk at the series' last
   * point, which lags live offers (daily sampling): a fresh undercut then
   * reports an ancient regime low as "Bisher". Re-running the same walk
   * anchored at the live card price returns exactly what the analysis would
   * have produced had it known the price — same walk, right anchor.
   * Stats without a series (HTML fallback) check for strict undercut of tiefstpreis.
   */
  function recordRefForPrice(stats, cardPrice) {
    const stored = { previousLow: stats?.previousLow ?? null, isNewRecord: !!stats?.isNewAllTimeLow };
    if (!(cardPrice > 0)) return stored;
    const pts = stats?.timeSeries;
    if (!Array.isArray(pts) || pts.length === 0) {
      if (stats?.tiefstpreis && priceToCents(cardPrice) < priceToCents(stats.tiefstpreis)) {
        return { previousLow: stored.previousLow ?? stats.tiefstpreis, isNewRecord: true };
      }
      return stored;
    }
    const cCents = priceToCents(cardPrice);
    const priceOf = p => (Array.isArray(p) ? p[1] : p?.price);
    const allTimeLowCents = Math.min(...pts.map(p => priceToCents(priceOf(p))).filter(c => c > 0));
    if (cCents > allTimeLowCents) {
      return { previousLow: allTimeLowCents / 100, isNewRecord: false };
    }
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
  const HEAT_NEUTRAL_DEADBAND_PCT = 1;
  const MIN_SIGNIFICANT_RECORD_PCT = 2;


  function computeDealScore(stats, cardPrice, opts = {}) {
    if (!stats || stats.unavailable || !stats.tiefstpreis || stats.tiefstpreis <= 0) return null;
    if (!cardPrice || cardPrice <= 0) return null;

    // Explicit options (defaults from CONFIG): tests pass fixed values for
    // determinism instead of mutating global config.
    const minPoints = opts.minPoints ?? clampMinPoints(CONFIG.BESTPREISE_MIN_POINTS);
    const wRecord = typeof opts.weightRecord === 'number' ? opts.weightRecord
      : (typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number' ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50);

    // History Qualification Gate:
    // Requires a rolling median price for the blend. Without median, or if data points are
    // below the threshold, or variance < 2%, the card cannot qualify for a blend and
    // degrades to a Fallback-Tief.
    if (!stats.medianPrice || stats.medianPrice <= 0) return null;

    const pointsCount = stats.dataPointCount ?? (Array.isArray(stats.timeSeries) ? stats.timeSeries.length : 5);
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

    // Qualification is weight-independent: a Tiefstpreis qualifies on real
    // saving in EITHER component. A qualified deal with 0% savings (at-low matching
    // the median) is a neutral 0%-deal (weightedDiff: 0).
    const isZeroMargin = dMedian <= 0 && dRecord <= 0;
    const wMedian = 1 - wRecord;
    const weightedDiff = isZeroMargin ? 0 : Math.max(1, Math.round(wMedian * dMedian + wRecord * dRecord));

    return {
      weightedDiff,
      dMedian: Math.max(0, dMedian),
      dRecord: Math.max(0, dRecord),
      isNewRecord,
      isZeroMargin,
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
   * Blind heat driver (ADR-0005: badge shows the blend, heat/sort follow it).
   * Heat follows the badge % only (blend, Vortief-Abstand, or site-%), never
   * the verification state. Returns { value, provisional, pct, kind }:
   * - verified deal   -> blend % the badge shows (weight-blended Ø-discount +
   *                      record-margin at the slider mix), null inside the ±1%
   *                      deadband (HEAT_NEUTRAL_DEADBAND_PCT) (number still prints, card stays gray)
   * - verified markup -> null (no deal, no color — the +XX% badge text
   *                      carries the markup signal)
   * - verified but unqualified (thin/flat history, no dealData) -> Vortief-Abstand
   *   in every mode (browse included); excluded fallbacks stay null
   * - unverified deal -> site Differenz, provisional always false (blind heat;
   *   the striped-gray cue lives in the badge class, not the heat flag)
   * - unverified markup / unknown -> null (neutral)
   * The optional 5th parameter takes an
   * already-computed dealScore (undefined = not provided, compute inside;
   * null = computed-unqualified, never recompute).
   */
  function getHeatInput(cardPrice, stats, siteDiff, _mode, precomputed = undefined) {
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
      // Unqualified history: no blend to show. The Vortief-Abstand still heats —
      // blind inset wash like every other heat. Heatmap is a dumb view mode:
      // paints whatever the badge % says (Vortief-Abstand or siteDiff).
      if (!dealData) {
        const vortief = vortiefDropPct(cardPrice, stats);
        if (vortief >= HEAT_NEUTRAL_DEADBAND_PCT) {
          return { value: -vortief, provisional: false, pct: vortief, kind: 'vortief' };
        }
        if (typeof siteDiff === 'number' && !isNaN(siteDiff) && siteDiff <= -HEAT_NEUTRAL_DEADBAND_PCT) {
          return { value: siteDiff, provisional: false, pct: -siteDiff, kind: 'unverified' };
        }
        return { value: null, provisional: false, pct: 0, kind: 'none' };
      }
      const pct = dealData.weightedDiff;
      // ±1% deadband (HEAT_NEUTRAL_DEADBAND_PCT noise guard): a tiny blend shows in the
      // badge text but stays gray on the card — decided on the raw blend.
      const rawBlend = (1 - weight) * levelRaw + weight * recordRaw;
      if (!(rawBlend >= HEAT_NEUTRAL_DEADBAND_PCT)) return { value: null, provisional: false, pct, kind: 'blend' };
      return { value: -pct, provisional: false, pct, kind: 'blend' };
    }
    if (typeof siteDiff === 'number' && !isNaN(siteDiff)) {
      // Unverified markup (positive) -> neutral; only real discounts heat.
      // Blind heat: site-% heats with provisional false; deadband-edge keeps
      // value null with provisional false (plain gray, not striped-by-heat).
      if (siteDiff > -HEAT_NEUTRAL_DEADBAND_PCT) {
        const pct = siteDiff < 0 ? -siteDiff : 0;
        return { value: null, provisional: false, pct, kind: siteDiff < 0 ? 'unverified' : 'unknown' };
      }
      return { value: siteDiff, provisional: false, pct: -siteDiff, kind: 'unverified' };
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
  const statsKey = (productId, useShippingOverride) => {
    try { const s = typeof useShippingOverride === 'boolean' ? useShippingOverride : isShippingPriceActive(); return `${STATS_CACHE_PREFIX}${productId}_${s ? 's' : 'p'}`; }
    catch { return `${STATS_CACHE_PREFIX}${productId}_p`; }
  };
  const DEALER_CACHE_PREFIX = 'tp_dealer_v1_';
  const SHARED_CACHE_PREFIX = 'tp_shared_v1_';
  const ASIN_CACHE_PREFIX = 'tp_asin_v1_';
  // Janitor-Funktionen (prune/count/clear) betreuen alle Prefixe: Händlerdaten,
  // ASIN-Zuordnungen und Geteilt-Markierungen sind abgeleitete Produktdaten mit
  // derselben TTL wie die Preishistorie.
  const CACHE_PREFIXES = [STATS_CACHE_PREFIX, DEALER_CACHE_PREFIX, SHARED_CACHE_PREFIX, ASIN_CACHE_PREFIX];
  const MAX_MEMORY_CACHE_ITEMS = 500;

  function lruSet(map, key, val, cap = (CONFIG?.CACHE_MEMORY_LIMIT ?? MAX_MEMORY_CACHE_ITEMS)) {
    map.delete(key);
    map.set(key, val);
    while (map.size > cap) map.delete(map.keys().next().value);
  }

  const memoryCache = new Map();
  // Default-arg `window.localStorage` access itself can throw (blocked
  // third-party storage); resolve lazily inside a guard so persistence
  // absence only disables disk, never the in-memory LRU.
  const resolveStorage = s => { try { return s ?? (typeof window !== 'undefined' ? window.localStorage : null); } catch { return null; } };

  let statsWriteCount = 0;
  // Stale-write guard: every clear/reset/route invalidation bumps the
  // generation; in-flight fetches capture it before network I/O and their
  // writes no-op when a clear landed mid-flight (reset-during-pending).
  let cacheGeneration = 0;
  const currentCacheGen = () => cacheGeneration;
  const bumpCacheGeneration = () => { cacheGeneration++; };
  function currentMedianSig(horizonDays = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS) {
    return `${horizonDays}|${CONFIG.OUTLIER_REJECTION_ENABLED ? 1 : 0}|${CONFIG.OUTLIER_DEVIATION_BAND}|${CONFIG.OUTLIER_MAX_GLITCH_HOURS}`;
  }
  function ensureFreshAnalysis(entry) {
    if (!entry || entry.unavailable || entry.medianSig === currentMedianSig()) return entry;
    const src = fullSeries(entry);
    if (!Array.isArray(src)) return entry;
    try {
      const fresh = analyzePriceTimeSeries(src, entry.anchorPrice ?? null, CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      if (fresh) return { ...entry, ...fresh, time: entry.time, medianSig: currentMedianSig() };
    } catch {}
    return entry;
  }
  function fullSeries(entry) {
    if (!entry) return null;
    if (Array.isArray(entry.rawTimeSeries)) return entry.rawTimeSeries;
    const base = entry.timeSeries;
    if (!Array.isArray(base)) return null;
    const extra = Array.isArray(entry.filteredOutliers) ? entry.filteredOutliers.map(o => [o.timestamp, o.price]) : [];
    if (!extra.length) return base;
    return [...base, ...extra].sort((a, b) => a[0] - b[0]);
  }
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
  const hasUsablePriceStats = stats => !!stats && !stats.unavailable && (Number.isFinite(stats?.tiefstpreis) ? stats.tiefstpreis > 0 : Number.isFinite(stats?.medianPrice) && stats.medianPrice > 0);

  function prunePriceStatsCache(storage = null, forceEvict = false) {
    storage = resolveStorage(storage);
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
            const raw = storage.getItem(key) || '';
            const fastTime = raw.match(/^\{"time":(\d+)/);
            const itemTime = fastTime ? Number(fastTime[1]) : (JSON.parse(raw || '{}').time || 0);
            const age = now - itemTime;
            if (!itemTime || age > maxAgeMs) {
              keysToRemove.push(key);
            } else {
              entries.push({ key, time: itemTime });
            }
          } catch (e) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(k => storage.removeItem(k));

      if (forceEvict && entries.length > 0) {
        entries.sort((a, b) => a.time - b.time);
        const evictCount = Math.max(1, Math.ceil(entries.length * 0.25));
        entries.slice(0, evictCount).forEach(e => storage.removeItem(e.key));
      } else {
        const diskLimit = CONFIG?.CACHE_DISK_LIMIT ?? 300;
        if (entries.length > diskLimit) {
          entries.sort((a, b) => a.time - b.time);
          const target = Math.max(50, Math.round(diskLimit * 0.8));
          entries.slice(0, Math.max(0, entries.length - target)).forEach(e => storage.removeItem(e.key));
        }
      }
    } catch (e) {}
  }

  function getCachedPriceStats(productId, ignoreNegativeCache = false, storage = null, useShippingOverride = null) {
    if (!productId) return null;
    storage = resolveStorage(storage);
    const targetShipping = typeof useShippingOverride === 'boolean'
      ? useShippingOverride
      : (typeof useShippingOverride === 'string' ? useShippingOverride === 'shipping' : isShippingPriceActive());
    // Mode guard: the series is picked per shipping mode at fetch time and the
    // key is bare, so a cross-mode entry would compare the wrong baseline
    // (same wrong-"Bisher" class as a stale series anchor). Legacy entries
    // without the flag pass through; explicit mismatches read as a miss and
    // self-heal via refetch on the next scan.
    const isModeMatch = entry => {
      if (typeof entry?.isShippingPrice !== 'boolean') return true;
      try {
        return entry.isShippingPrice === targetShipping;
      } catch (e) { return true; }
    };
    try {
      const key = statsKey(productId, targetShipping);
      if (memoryCache.has(key)) {
        const memData = memoryCache.get(key);
        if (isCacheEntryFresh(memData, ignoreNegativeCache)) {
          if (!isModeMatch(memData)) {
            memoryCache.delete(key);
          } else {
            const fresh = ensureFreshAnalysis(memData);
            // LRU update
            lruSet(memoryCache, key, fresh);
            return fresh;
          }
        } else {
          memoryCache.delete(key);
        }
      }

      let raw = storage?.getItem(key);
      if (!raw) {
        // Upgrade migration (one read, no refetch storm): pre-suffix entries
        // adopt the current slot when fresh and mode-matching; stale ones go,
        // mode-mismatched ones wait for their mode's next miss.
        try {
          const legacyKey = STATS_CACHE_PREFIX + productId;
          const legacy = storage?.getItem(legacyKey);
          if (legacy) {
            let parsedLegacy = null;
            try { parsedLegacy = JSON.parse(legacy); } catch {}
            if (parsedLegacy && isCacheEntryFresh(parsedLegacy, ignoreNegativeCache) && isModeMatch(parsedLegacy)) { raw = legacy; try { storage?.removeItem(legacyKey); } catch {} }
            else if (!parsedLegacy || !isCacheEntryFresh(parsedLegacy, ignoreNegativeCache)) try { storage?.removeItem(legacyKey); } catch {}
          }
        } catch {}
      }
      if (!raw) return null;
      let parsed = JSON.parse(raw);

      if (isCacheEntryFresh(parsed, ignoreNegativeCache)) {
        // Cross-mode stale entry: evict from storage too, else every render
        // re-parses localStorage for an entry that always misses.
        if (!isModeMatch(parsed)) { try { storage?.removeItem(key); } catch (e) {} return null; }
        // Lazy cold-entry recompute: horizon/outlier change stamps medianSig;
        // stale-sig entries with a series recompute synchronously, no refetch.
        parsed = ensureFreshAnalysis(parsed);
        lruSet(memoryCache, key, parsed);
        try {
          const repersist = (parsed.timeSeries && parsed.rawTimeSeries) ? { ...parsed, rawTimeSeries: undefined } : parsed;
          storage?.setItem(key, JSON.stringify(repersist));
        } catch (e) {}
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  function setCachedPriceStats(productId, stats, isUnavailable = false, storage = null, useShippingOverride, expectedGen = null) {
    if (!productId) return;
    if (expectedGen !== null && expectedGen !== cacheGeneration) return;
    storage = resolveStorage(storage);
    const key = statsKey(productId, useShippingOverride);
    // Upgrade-only: never replace median-bearing stats with median-less
    // fallback stats. A refresh that lands on the HTML fallback (tiefstpreis
    // only) must not regress a full analysis — the badge would keep its old %
    // while the heat goes neutral. Unavailable-markers keep current semantics.
    if (!isUnavailable && stats && !stats.medianPrice && memoryCache.has(key)) {
      const prev = memoryCache.get(key);
      if (prev && !prev.unavailable && prev.medianPrice) return;
    }
    const s = typeof useShippingOverride === 'boolean' ? useShippingOverride : isShippingPriceActive();
    const payload = isUnavailable
      ? { time: Date.now(), unavailable: true, isShippingPrice: s }
      : { time: Date.now(), medianSig: currentMedianSig(), ...stats };

    lruSet(memoryCache, key, payload);

    // Persist stripped: rawTimeSeries duplicates timeSeries bytes on disk;
    // memory keeps the full object for recompute.
    const persistPayload = (!isUnavailable && payload.timeSeries && payload.rawTimeSeries)
      ? { ...payload, rawTimeSeries: undefined }
      : payload;
    try {
      statsWriteCount++;
      if (statsWriteCount === 1 || statsWriteCount % 100 === 0) prunePriceStatsCache(storage);
      storage?.setItem(key, JSON.stringify(persistPayload));
    } catch (e) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        try { prunePriceStatsCache(storage, true); storage?.setItem(key, JSON.stringify(persistPayload)); } catch (_) {}
      }
    }
  }

  function countCachedPriceStats(storage = null) {
    let count = 0;
    storage = resolveStorage(storage);
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


  function clearPriceStatsCache(storage = null, onlyPrefixes = null) {
    const prefixes = Array.isArray(onlyPrefixes) && onlyPrefixes.length > 0 ? onlyPrefixes : CACHE_PREFIXES;
    cacheGeneration++;
    storage = resolveStorage(storage);
    memoryCache.clear();
    let count = 0;
    try {
      if (storage) {
        const keysToRemove = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && prefixes.some(p => key.startsWith(p))) {
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
  function recomputeCachedMedians(horizonDays, storage = null) {
    let count = 0;
    storage = resolveStorage(storage);
    const sig = currentMedianSig(horizonDays);
    const rewrite = entry => {
      const src = fullSeries(entry);
      if (!Array.isArray(src)) return null;
      const fresh = analyzePriceTimeSeries(src, entry?.anchorPrice ?? null, horizonDays);
      if (!fresh) return null;
      return { ...entry, ...fresh, time: entry.time, medianSig: sig, ...(entry.rawTimeSeries && fresh.rawTimeSeries === undefined ? { rawTimeSeries: entry.rawTimeSeries } : {}) };
    };
    for (const [cacheKey, entry] of memoryCache) {
      const next = rewrite(entry);
      if (!next) continue;
      memoryCache.set(cacheKey, next);
      // Write-through for rewritten entries only (no storage sweep): reloads
      // and other tabs see the new window without a refetch.
      try {
        const persist = (next.timeSeries && next.rawTimeSeries) ? { ...next, rawTimeSeries: undefined } : next;
        storage?.setItem(cacheKey, JSON.stringify(persist));
      } catch (e) {}
      count++;
    }
    return count;
  }

  // Händlername + Angebotslink pro Produkt, je Preisbasis (p/s-Slot): wird beim
  // 🏬-Klick zusammen mit dem Produktseiten-Fetch geschrieben und überlebt so
  // Reloads — gleiche TTL wie die Preishistorie (REAL_DEAL_CACHE_HOURS).
  function getCachedDealer(productId, useShipping, storage = null) {
    if (!productId) return null;
    storage = resolveStorage(storage);
    try {
      const raw = storage?.getItem(DEALER_CACHE_PREFIX + productId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const entry = useShipping ? parsed?.s : parsed?.p;
      if (!entry?.dealer) return null;
      // Per-slot expiry; legacy entries carry top-level time only.
      const slotTime = entry.time ?? parsed?.time ?? 0;
      if (!isCacheEntryFresh({ time: slotTime })) return null;
      return { dealer: entry.dealer, url: entry.url || '', offers: entry.offers || 0, totalOffers: entry.totalOffers || 0 };
    } catch (e) {}
    return null;
  }

  function setCachedDealer(productId, useShipping, dealer, url, storage = null, offers = 0, totalOffers = 0) {
    if (!productId || !dealer) return;
    storage = resolveStorage(storage);
    try {
      let prev = {};
      try { prev = JSON.parse(storage?.getItem(DEALER_CACHE_PREFIX + productId) || '{}'); } catch (e) { /* korrupt: neu schreiben */ }
      const slot = useShipping ? 's' : 'p';
      const prevSlot = (prev && typeof prev[slot] === 'object' && prev[slot] !== null) ? prev[slot] : {};
      const now = Date.now();
      const next = { ...prev, time: now, [slot]: { ...prevSlot, dealer, url: url || '', offers: Number.isFinite(+offers) ? Math.round(+offers) : 0, totalOffers: Number.isFinite(+totalOffers) ? Math.round(+totalOffers) : 0, time: now } };
      storage?.setItem(DEALER_CACHE_PREFIX + productId, JSON.stringify(next));
    } catch (e) {}
  }

  // Geteilt-Markierung pro Produkt+Preis: pid + Preis-Cents als Identität, damit
  // eine Preisänderung die Markierung löst und der Deal neu scharf wird.
  // TTL via isCacheEntryFresh (REAL_DEAL_CACHE_HOURS); clear/prune laufen über
  // CACHE_PREFIXES mit — kein eigener Lifecycle.
  function getSharedDeal(productId, priceCents, storage = null) {
    if (!productId) return false;
    storage = resolveStorage(storage);
    try {
      const raw = storage?.getItem(SHARED_CACHE_PREFIX + productId);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return isCacheEntryFresh(parsed) && parsed.priceCents === priceCents;
    } catch (e) {}
    return false;
  }

  function setSharedDeal(productId, priceCents, storage = null) {
    if (!productId || priceCents == null) return;
    storage = resolveStorage(storage);
    try {
      storage?.setItem(SHARED_CACHE_PREFIX + productId, JSON.stringify({ priceCents, time: Date.now() }));
    } catch (e) {}
  }

  function getCachedAsin(productId, storage = null) {
    if (!productId) return null;
    storage = resolveStorage(storage);
    try {
      const raw = storage?.getItem(ASIN_CACHE_PREFIX + productId);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (!entry?.asin) return null;
      if (!isCacheEntryFresh({ time: entry.time ?? 0 })) return null;
      return entry.asin;
    } catch (e) {}
    return null;
  }

  function setCachedAsin(productId, asin, storage = null) {
    if (!productId || !asin) return;
    storage = resolveStorage(storage);
    try {
      storage?.setItem(ASIN_CACHE_PREFIX + productId, JSON.stringify({ asin: String(asin).toUpperCase(), time: Date.now() }));
    } catch (e) {}
  }

  // ─── MODULE: src/ui/mini-toggle.js ──────────────────────────────────────────
  /**
   * Shared mini-toggle sync (single dialect for checkbox toggles with ON/OFF
   * caption). Imported by toolbar.js and state/config.js — lives here because
   * toolbar imports config (cycle).
   */

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
  }

  function paintCycleButton(btn, state) {
    if (!btn) return;
    btn.textContent = state === 'off' ? 'Normal' : state === 'highlight' ? 'Hervorheben' : state === 'dim' ? 'Dimmen' : 'Verbergen';
    btn.classList.toggle('tp-state-normal', state === 'off');
    btn.classList.toggle('tp-state-dim', state === 'dim');
    btn.classList.toggle('tp-state-hide', state === 'hide');
    btn.classList.toggle('tp-state-highlight', state === 'highlight');
    btn.classList.toggle('tp-active', state !== 'off');
  }

  // ─── MODULE: src/state/config-store.js ──────────────────────────────────────
  /**
   * Config storage foundation (split from state/config.js).
   * Pure logic, zero DOM imports: defaults, GM/localStorage mirror,
   * single setting schema + sanitizer.
   */

  const DEFAULTS = Object.freeze({
    FILTER_NEG_ENABLED: false,
    FILTER_MIN_ENABLED: false,
    FILTER_DEAL_DISCOUNT_ENABLED: false,
    FILTER_PRICE_ENABLED: false,
    FILTER_PRICE_MIN: 0,
    FILTER_PRICE_MAX: 0,
    FILTER_SAVINGS_ENABLED: false,
    FILTER_SAVINGS_MIN: 0,
    FILTERS_ENABLED: true,
    FILTER_NEG_MODE: 'dim',
    FILTER_MIN_MODE: 'dim',
    FILTER_DEAL_DISCOUNT_MODE: 'dim',
    FILTER_PRICE_MODE: 'dim',
    FILTER_SAVINGS_MODE: 'dim',
    HIDE_UNCHECKED_MODE: 'dim',
    VORTIEF_MODE: 'dim',
    DEALER_MODE: 'dim',
    MIN_DEAL_DISCOUNT: 0,
    MARGIN_PERCENT: 0.0,
    DIM_OPACITY: 0.25,
    HIDE_ADS: true,
    USE_SHIPPING_PRICE: true,
    HEATMAP_ENABLED: true,
    HEATMAP_INTENSITY: 1.0,
    REAL_DEAL_MIN_DISCOUNT: 30,
    REAL_DEAL_CACHE_HOURS: 48,
    NEGATIVE_CACHE_HOURS: 2,
    CACHE_MEMORY_LIMIT: 500,
    CACHE_DISK_LIMIT: 300,
    BESTPREISE_MODE_ACTIVE: false,
    BESTPREISE_HIDE_UNCHECKED: false,
    BESTPREISE_INCLUDE_VORTIEF: true,
    BESTPREISE_WEIGHT_RECORD: 0.50,
    BESTPREISE_MIN_POINTS: 5,
    BESTPREISE_MEDIAN_HORIZON_DAYS: 365,
    OUTLIER_REJECTION_ENABLED: true,
    OUTLIER_DEVIATION_BAND: 0.50,
    OUTLIER_MAX_GLITCH_HOURS: 48,
    ENABLE_SPARKLINES: true,
    KEEPA_CHART_ENABLED: true,
    REVIEW_SEARCH_ENABLED: true,
    REVIEW_SEARCH_KEYWORD: 'Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.',
    REVIEW_SEARCH_AI_MODE: false,
    TAVILY_ENABLED: false,
    TAVILY_API_KEY: '',
    TAVILY_SEARCH_DEPTH: 'basic',
    TAVILY_MAX_RESULTS: 5,
    DEALER_AUTOFETCH: false,
    NEGATIVE_TERMS: '',
    DISCORD_WEBHOOK_URL: '',
    DISCORD_CHANNELS: [],
    DISCORD_SUPPRESS_DEALER_EMBED: true,
    DISCORD_SUPPRESS_PRODUCT_EMBED: true,
    DISCORD_FORUM_TITLE: false,
    // mirror of DEFAULT_LAYOUT in features/share-discord.js (drift-checked in share-discord.test.js)
    DISCORD_LAYOUT: '## {title}\n# {price}\n# {dealer} +{offers}\n{prevlow}\n{median}\n{ai}\n{link}',
    MIN_OFFERS: 0,
    SORT_BY_OFFERS: 'none',
    ALARM_ENABLED: true,
    ALARM_TARGET_PERCENT: 0.60,
    ALARM_DURATION_DAYS: '730',
    ALARM_AUTO_SUBMIT: false,
    ALARM_FALLBACK_TIMEOUT_MS: 5000,
    OBSERVER_DEBOUNCE_MS: 200,
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
  // Bearer-Secrets (Discord-Webhook, Tavily-API-Key) bleiben GM-privat: nie ins page-lesbare localStorage.
  const SECRET_KEYS = new Set(['DISCORD_WEBHOOK_URL', 'DISCORD_CHANNELS', 'TAVILY_API_KEY']);

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
  // Single config schema: every DEFAULTS key validates/coerces through
  // sanitizeConfigValue (init, updateConfig(s), settings import). Unknown keys
  // are rejected (undefined → caller ignores). Bounds below are authoritative.
  const SETTING_SCHEMA = {
    FILTER_NEG_ENABLED: { type: 'bool', default: false },
    FILTER_MIN_ENABLED: { type: 'bool', default: false },
    FILTER_DEAL_DISCOUNT_ENABLED: { type: 'bool', default: false },
    FILTER_PRICE_ENABLED: { type: 'bool', default: false },
    FILTER_PRICE_MIN: { type: 'float', default: 0, min: 0, max: 1000000 },
    FILTER_PRICE_MAX: { type: 'float', default: 0, min: 0, max: 1000000 },
    FILTER_SAVINGS_ENABLED: { type: 'bool', default: false },
    FILTER_SAVINGS_MIN: { type: 'float', default: 0, min: 0, max: 1000000 },
    FILTERS_ENABLED: { type: 'bool', default: true },
    FILTER_NEG_MODE: { type: 'mode', default: 'dim' },
    FILTER_MIN_MODE: { type: 'mode', default: 'dim' },
    FILTER_DEAL_DISCOUNT_MODE: { type: 'mode', default: 'dim' },
    FILTER_PRICE_MODE: { type: 'mode', default: 'dim' },
    FILTER_SAVINGS_MODE: { type: 'mode', default: 'dim' },
    HIDE_UNCHECKED_MODE: { type: 'mode', default: 'dim' },
    VORTIEF_MODE: { type: 'mode', default: 'dim' },
    DEALER_MODE: { type: 'mode', default: 'dim' },
    MIN_DEAL_DISCOUNT: { type: 'int', default: 0, min: 0, max: 50 },
    MARGIN_PERCENT: { type: 'float', default: 0.0, min: 0, max: 50 },
    DIM_OPACITY: { type: 'float', default: 0.25, min: 0.05, max: 1 },
    HIDE_ADS: { type: 'bool', default: true },
    USE_SHIPPING_PRICE: { type: 'bool', default: true },
    HEATMAP_ENABLED: { type: 'bool', default: true },
    HEATMAP_INTENSITY: { type: 'float', default: 1.0, min: 0.2, max: 1 },
    REAL_DEAL_MIN_DISCOUNT: { type: 'int', default: 30, min: 0, max: 90 },
    REAL_DEAL_CACHE_HOURS: { type: 'int', default: 48, min: 1, max: 336 },
    NEGATIVE_CACHE_HOURS: { type: 'float', default: 2, min: 0.25, max: 24 },
    CACHE_MEMORY_LIMIT: { type: 'int', default: 500, min: 100, max: 2000 },
    CACHE_DISK_LIMIT: { type: 'int', default: 300, min: 100, max: 1000 },
    BESTPREISE_MODE_ACTIVE: { type: 'bool', default: false },
    BESTPREISE_HIDE_UNCHECKED: { type: 'bool', default: false },
    BESTPREISE_INCLUDE_VORTIEF: { type: 'bool', default: true },
    BESTPREISE_WEIGHT_RECORD: { type: 'float', default: 0.50, min: 0, max: 1 },
    BESTPREISE_MIN_POINTS: { type: 'int', default: 5, min: 1, max: 100 },
    BESTPREISE_MEDIAN_HORIZON_DAYS: { type: 'int', default: 365, min: 0, max: 3650 },
    OUTLIER_REJECTION_ENABLED: { type: 'bool', default: true },
    OUTLIER_DEVIATION_BAND: { type: 'float', default: 0.50, min: 0.01, max: 0.50 },
    OUTLIER_MAX_GLITCH_HOURS: { type: 'int', default: 48, min: 24, max: 168 },
    ENABLE_SPARKLINES: { type: 'bool', default: true },
    KEEPA_CHART_ENABLED: { type: 'bool', default: true },
    REVIEW_SEARCH_ENABLED: { type: 'bool', default: true },
    REVIEW_SEARCH_KEYWORD: { type: 'string', default: 'Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.' },
    REVIEW_SEARCH_AI_MODE: { type: 'bool', default: false },
    TAVILY_ENABLED: { type: 'bool', default: false },
    TAVILY_API_KEY: { type: 'string', default: '' },
    TAVILY_SEARCH_DEPTH: { type: 'enum', default: 'basic', allowed: ['basic', 'advanced'] },
    TAVILY_MAX_RESULTS: { type: 'int', default: 5, min: 1, max: 10 },
    DEALER_AUTOFETCH: { type: 'bool', default: false },
    NEGATIVE_TERMS: { type: 'string', default: '' },
    DISCORD_WEBHOOK_URL: { type: 'string', default: '' },
    DISCORD_CHANNELS: { type: 'channels', default: [] },
    DISCORD_SUPPRESS_DEALER_EMBED: { type: 'bool', default: true },
    DISCORD_SUPPRESS_PRODUCT_EMBED: { type: 'bool', default: true },
    DISCORD_FORUM_TITLE: { type: 'bool', default: false },
    DISCORD_LAYOUT: { type: 'string', default: DEFAULTS.DISCORD_LAYOUT },
    MIN_OFFERS: { type: 'int', default: 0, min: 0, max: 99 },
    SORT_BY_OFFERS: { type: 'enum', default: 'none', allowed: ['none', 'desc', 'asc', 'discount-desc'] },
    ALARM_ENABLED: { type: 'bool', default: true },
    ALARM_TARGET_PERCENT: { type: 'float', default: 0.60, min: 0.05, max: 0.99 },
    ALARM_DURATION_DAYS: { type: 'enum', default: '730', allowed: ['90', '180', '365', '730'] },
    ALARM_AUTO_SUBMIT: { type: 'bool', default: false },
    ALARM_FALLBACK_TIMEOUT_MS: { type: 'int', default: 5000, min: 1000, max: 30000 },
    OBSERVER_DEBOUNCE_MS: { type: 'int', default: 200, min: 0, max: 2000 },
    DEBUG: { type: 'bool', default: false }
  };
  const coerceNumber = raw => {
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'boolean') return raw ? 1 : 0;
    if (typeof raw === 'string' && raw.trim() !== '') return Number(raw);
    return NaN;
  };
  const sanitizeChannels = raw => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item, idx) => {
        if (!item || typeof item !== 'object') return null;
        const name = String(item.name || '').trim().slice(0, 50) || `Kanal ${idx + 1}`;
        const url = typeof item.url === 'string' ? item.url.trim() : '';
        const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `ch_${idx + 1}`;
        return { id, name, url };
      })
      .filter(Boolean);
  };
  function sanitizeConfigValue(key, raw) {
    const rule = SETTING_SCHEMA[key];
    if (!rule) {
      try { if (_getValue('DEBUG', false) === true) console.warn('[Toppreise-Suite] unknown config key ignored', key); } catch {}
      return undefined;
    }
    switch (rule.type) {
      case 'bool': return raw === true;
      case 'mode': return (raw === 'dim' || raw === 'highlight' || raw === 'hide') ? raw : rule.default;
      case 'channels': return sanitizeChannels(raw);
      case 'int': {
        const n = coerceNumber(raw);
        if (!Number.isFinite(n)) return rule.default;
        return Math.min(rule.max, Math.max(rule.min, Math.round(n)));
      }
      case 'float': {
        const n = coerceNumber(raw);
        if (!Number.isFinite(n)) return rule.default;
        return Math.min(rule.max, Math.max(rule.min, n));
      }
      case 'enum': {
        if (rule.allowed.includes(raw)) return raw;
        const s = String(raw);
        return rule.allowed.includes(s) ? s : rule.default;
      }
      case 'string': return typeof raw === 'string' ? raw : rule.default;
      default: return rule.default;
    }
  }
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
      return `Gewichtung: ${100 - pctRec}% Ø-Preis / ${pctRec}% Rekord — Badge zeigt die Gewichtete Differenz.`;
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
  // UI↔stored horizon mapping (single source): the range control tops out at
  // 760 as the Lifetime sentinel; anything above 730 days stores 0 (Lifetime).
  const horizonUiToStored = raw => { const n = Number.isFinite(raw) ? raw : 365; return n > 730 ? 0 : n; };
  const horizonStoredToUi = stored => stored === 0 ? 760 : stored;

  // ─── MODULE: src/state/config-migrate.js ────────────────────────────────────
  /**
   * Config one-time migrations (split from state/config.js).
   * Storage helpers live in ./config-store.js; side effects run once at import.
   */


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
  // One-time migration: single DISCORD_WEBHOOK_URL migrated to DISCORD_CHANNELS
  function migrateDiscordChannels() {
    if (_getValue('MIGRATED_DISCORD_CHANNELS', false)) return false;
    const channels = _getValue('DISCORD_CHANNELS', null);
    const legacyHook = (_getValue('DISCORD_WEBHOOK_URL', '') || '').trim();
    if ((!channels || (Array.isArray(channels) && channels.length === 0)) && legacyHook) {
      _setValue('DISCORD_CHANNELS', [{ id: 'default', name: 'Standard', url: legacyHook }]);
    }
    _setValue('MIGRATED_DISCORD_CHANNELS', true);
    return true;
  }
  migrateHideToDimDefaults();
  migrateLegacyDebug();
  migrateDiscordChannels();
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

  // ─── MODULE: src/state/config.js ────────────────────────────────────────────
  /**
   * Configuration & Persistent Settings State Layer
   * Manages defaults, GM_getValue/localStorage synchronization,
   * active configuration object, and bidirectional UI control sync.
   */






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
  // Filter modes: 'dim' dims, 'highlight' highlights, everything else hides.
  const _modeValue = k => {
    const v = _getValue(k, DEFAULTS[k]);
    return (v === 'dim' || v === 'highlight') ? v : 'hide';
  };
  // 4-state filter cycle: each cause row pairs an enable key with a mode key.
  // The cycle button derives Normal/Dimmen/Verbergen/Hervorheben from the pair —
  // storage keys unchanged, no migration. Dealer row excluded (preset).
  const FILTER_CYCLE = Object.freeze({
    FILTER_NEG_MODE: { enable: 'FILTER_NEG_ENABLED', on: true },
    FILTER_MIN_MODE: { enable: 'FILTER_MIN_ENABLED', on: true },
    FILTER_DEAL_DISCOUNT_MODE: { enable: 'FILTER_DEAL_DISCOUNT_ENABLED', on: true },
    FILTER_PRICE_MODE: { enable: 'FILTER_PRICE_ENABLED', on: true },
    FILTER_SAVINGS_MODE: { enable: 'FILTER_SAVINGS_ENABLED', on: true },
    HIDE_UNCHECKED_MODE: { enable: 'BESTPREISE_HIDE_UNCHECKED', on: true },
    VORTIEF_MODE: { enable: 'BESTPREISE_INCLUDE_VORTIEF', on: false },
  });
  const cycleStateOf = modeKey => {
    const pair = FILTER_CYCLE[modeKey];
    if (!pair) return CONFIG[modeKey] || 'dim';
    if (CONFIG[pair.enable] !== pair.on) return 'off';
    return CONFIG[modeKey] || 'dim';
  };
  // Toolbar owns the cycle button element; config owns the state mapping.
  // Text/class paint shared with the toolbar via ui/mini-toggle.js.
  const paintCycleButtons = (bar, modeKey) => {
    const s = cycleStateOf(modeKey);
    bar.querySelectorAll(`[data-mode-key="${modeKey}"]`).forEach(btn => {
      paintCycleButton(btn, s);
      btn.title = s === 'off'
        ? 'Filter: Normal — klicken für Dimmen'
        : s === 'dim'
          ? 'Filter: Dimmen — klicken für Verbergen'
          : s === 'hide'
            ? 'Filter: Verbergen — klicken für Hervorheben'
            : 'Filter: Hervorheben — klicken für Normal';
    });
  };


  const CONFIG = {
    FILTER_NEG_ENABLED: sanitizeConfigValue('FILTER_NEG_ENABLED', _getValue('FILTER_NEG_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_NEG_ENABLED))),
    FILTER_MIN_ENABLED: sanitizeConfigValue('FILTER_MIN_ENABLED', _getValue('FILTER_MIN_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTER_MIN_ENABLED))),
    FILTER_DEAL_DISCOUNT_ENABLED: sanitizeConfigValue('FILTER_DEAL_DISCOUNT_ENABLED', _getValue('FILTER_DEAL_DISCOUNT_ENABLED', DEFAULTS.FILTER_DEAL_DISCOUNT_ENABLED)),
    FILTER_PRICE_ENABLED: sanitizeConfigValue('FILTER_PRICE_ENABLED', _getValue('FILTER_PRICE_ENABLED', DEFAULTS.FILTER_PRICE_ENABLED)),
    FILTER_PRICE_MIN: sanitizeConfigValue('FILTER_PRICE_MIN', _getValue('FILTER_PRICE_MIN', DEFAULTS.FILTER_PRICE_MIN)),
    FILTER_PRICE_MAX: sanitizeConfigValue('FILTER_PRICE_MAX', _getValue('FILTER_PRICE_MAX', DEFAULTS.FILTER_PRICE_MAX)),
    FILTER_SAVINGS_ENABLED: sanitizeConfigValue('FILTER_SAVINGS_ENABLED', _getValue('FILTER_SAVINGS_ENABLED', DEFAULTS.FILTER_SAVINGS_ENABLED)),
    FILTER_SAVINGS_MIN: sanitizeConfigValue('FILTER_SAVINGS_MIN', _getValue('FILTER_SAVINGS_MIN', DEFAULTS.FILTER_SAVINGS_MIN)),
    FILTERS_ENABLED: sanitizeConfigValue('FILTERS_ENABLED', _getValue('FILTERS_ENABLED', DEFAULTS.FILTERS_ENABLED)),
    FILTER_NEG_MODE: _modeValue('FILTER_NEG_MODE'),
    FILTER_MIN_MODE: _modeValue('FILTER_MIN_MODE'),
    FILTER_DEAL_DISCOUNT_MODE: _modeValue('FILTER_DEAL_DISCOUNT_MODE'),
    FILTER_PRICE_MODE: _modeValue('FILTER_PRICE_MODE'),
    FILTER_SAVINGS_MODE: _modeValue('FILTER_SAVINGS_MODE'),
    HIDE_UNCHECKED_MODE: _modeValue('HIDE_UNCHECKED_MODE'),
    VORTIEF_MODE: _modeValue('VORTIEF_MODE'),
    DEALER_MODE: _modeValue('DEALER_MODE'),
    MIN_DEAL_DISCOUNT: sanitizeConfigValue('MIN_DEAL_DISCOUNT', _getValue('MIN_DEAL_DISCOUNT', DEFAULTS.MIN_DEAL_DISCOUNT)),
    MARGIN_PERCENT: sanitizeConfigValue('MARGIN_PERCENT', _getValue('MARGIN_PERCENT', DEFAULTS.MARGIN_PERCENT)),
    DIM_OPACITY: sanitizeConfigValue('DIM_OPACITY', _getValue('DIM_OPACITY', DEFAULTS.DIM_OPACITY)),
    HIDE_ADS: sanitizeConfigValue('HIDE_ADS', _getValue('HIDE_ADS', DEFAULTS.HIDE_ADS)),
    USE_SHIPPING_PRICE: sanitizeConfigValue('USE_SHIPPING_PRICE', _getValue('USE_SHIPPING_PRICE', DEFAULTS.USE_SHIPPING_PRICE)),
    HEATMAP_ENABLED: sanitizeConfigValue('HEATMAP_ENABLED', _getValue('HEATMAP_ENABLED', DEFAULTS.HEATMAP_ENABLED)),
    HEATMAP_INTENSITY: sanitizeConfigValue('HEATMAP_INTENSITY', _getValue('HEATMAP_INTENSITY', DEFAULTS.HEATMAP_INTENSITY)),
    REAL_DEAL_MIN_DISCOUNT: sanitizeConfigValue('REAL_DEAL_MIN_DISCOUNT', _getValue('REAL_DEAL_MIN_DISCOUNT', DEFAULTS.REAL_DEAL_MIN_DISCOUNT)),
    REAL_DEAL_CACHE_HOURS: sanitizeConfigValue('REAL_DEAL_CACHE_HOURS', _getValue('REAL_DEAL_CACHE_HOURS', DEFAULTS.REAL_DEAL_CACHE_HOURS)),
    NEGATIVE_CACHE_HOURS: sanitizeConfigValue('NEGATIVE_CACHE_HOURS', _getValue('NEGATIVE_CACHE_HOURS', DEFAULTS.NEGATIVE_CACHE_HOURS)),
    CACHE_MEMORY_LIMIT: sanitizeConfigValue('CACHE_MEMORY_LIMIT', _getValue('CACHE_MEMORY_LIMIT', DEFAULTS.CACHE_MEMORY_LIMIT)),
    CACHE_DISK_LIMIT: sanitizeConfigValue('CACHE_DISK_LIMIT', _getValue('CACHE_DISK_LIMIT', DEFAULTS.CACHE_DISK_LIMIT)),
    BESTPREISE_MODE_ACTIVE: sanitizeConfigValue('BESTPREISE_MODE_ACTIVE', _getValue('BESTPREISE_MODE_ACTIVE', DEFAULTS.BESTPREISE_MODE_ACTIVE)),
    BESTPREISE_HIDE_UNCHECKED: sanitizeConfigValue('BESTPREISE_HIDE_UNCHECKED', _getValue('BESTPREISE_HIDE_UNCHECKED', DEFAULTS.BESTPREISE_HIDE_UNCHECKED)),
    BESTPREISE_INCLUDE_VORTIEF: sanitizeConfigValue('BESTPREISE_INCLUDE_VORTIEF', _getValue('BESTPREISE_INCLUDE_VORTIEF', DEFAULTS.BESTPREISE_INCLUDE_VORTIEF)),
    BESTPREISE_WEIGHT_RECORD: sanitizeConfigValue('BESTPREISE_WEIGHT_RECORD', _getValue('BESTPREISE_WEIGHT_RECORD', DEFAULTS.BESTPREISE_WEIGHT_RECORD)),
    BESTPREISE_MIN_POINTS: sanitizeConfigValue('BESTPREISE_MIN_POINTS', _getValue('BESTPREISE_MIN_POINTS', DEFAULTS.BESTPREISE_MIN_POINTS)),
    BESTPREISE_MEDIAN_HORIZON_DAYS: sanitizeConfigValue('BESTPREISE_MEDIAN_HORIZON_DAYS', _getValue('BESTPREISE_MEDIAN_HORIZON_DAYS', DEFAULTS.BESTPREISE_MEDIAN_HORIZON_DAYS)),
    OUTLIER_REJECTION_ENABLED: sanitizeConfigValue('OUTLIER_REJECTION_ENABLED', _getValue('OUTLIER_REJECTION_ENABLED', DEFAULTS.OUTLIER_REJECTION_ENABLED)),
    OUTLIER_DEVIATION_BAND: sanitizeConfigValue('OUTLIER_DEVIATION_BAND', _getValue('OUTLIER_DEVIATION_BAND', DEFAULTS.OUTLIER_DEVIATION_BAND)),
    OUTLIER_MAX_GLITCH_HOURS: sanitizeConfigValue('OUTLIER_MAX_GLITCH_HOURS', _getValue('OUTLIER_MAX_GLITCH_HOURS', DEFAULTS.OUTLIER_MAX_GLITCH_HOURS)),
    ENABLE_SPARKLINES: sanitizeConfigValue('ENABLE_SPARKLINES', _getValue('ENABLE_SPARKLINES', DEFAULTS.ENABLE_SPARKLINES)),
    KEEPA_CHART_ENABLED: sanitizeConfigValue('KEEPA_CHART_ENABLED', _getValue('KEEPA_CHART_ENABLED', DEFAULTS.KEEPA_CHART_ENABLED)),
    REVIEW_SEARCH_ENABLED: sanitizeConfigValue('REVIEW_SEARCH_ENABLED', _getValue('REVIEW_SEARCH_ENABLED', DEFAULTS.REVIEW_SEARCH_ENABLED)),
    REVIEW_SEARCH_KEYWORD: sanitizeConfigValue('REVIEW_SEARCH_KEYWORD', _getValue('REVIEW_SEARCH_KEYWORD', DEFAULTS.REVIEW_SEARCH_KEYWORD)),
    REVIEW_SEARCH_AI_MODE: sanitizeConfigValue('REVIEW_SEARCH_AI_MODE', _getValue('REVIEW_SEARCH_AI_MODE', DEFAULTS.REVIEW_SEARCH_AI_MODE)),
    TAVILY_ENABLED: sanitizeConfigValue('TAVILY_ENABLED', _getValue('TAVILY_ENABLED', DEFAULTS.TAVILY_ENABLED)),
    TAVILY_API_KEY: _getValue('TAVILY_API_KEY', DEFAULTS.TAVILY_API_KEY),
    TAVILY_SEARCH_DEPTH: sanitizeConfigValue('TAVILY_SEARCH_DEPTH', _getValue('TAVILY_SEARCH_DEPTH', DEFAULTS.TAVILY_SEARCH_DEPTH)),
    TAVILY_MAX_RESULTS: sanitizeConfigValue('TAVILY_MAX_RESULTS', _getValue('TAVILY_MAX_RESULTS', DEFAULTS.TAVILY_MAX_RESULTS)),
    DEALER_AUTOFETCH: sanitizeConfigValue('DEALER_AUTOFETCH', _getValue('DEALER_AUTOFETCH', DEFAULTS.DEALER_AUTOFETCH)),
    NEGATIVE_TERMS: sanitizeConfigValue('NEGATIVE_TERMS', _getValue('NEGATIVE_TERMS', DEFAULTS.NEGATIVE_TERMS)),
    DISCORD_WEBHOOK_URL: _getValue('DISCORD_WEBHOOK_URL', DEFAULTS.DISCORD_WEBHOOK_URL),
    DISCORD_CHANNELS: sanitizeConfigValue('DISCORD_CHANNELS', _getValue('DISCORD_CHANNELS', DEFAULTS.DISCORD_CHANNELS)),
    DISCORD_SUPPRESS_DEALER_EMBED: sanitizeConfigValue('DISCORD_SUPPRESS_DEALER_EMBED', _getValue('DISCORD_SUPPRESS_DEALER_EMBED', legacySuppressEmbeds ?? DEFAULTS.DISCORD_SUPPRESS_DEALER_EMBED)),
    DISCORD_SUPPRESS_PRODUCT_EMBED: sanitizeConfigValue('DISCORD_SUPPRESS_PRODUCT_EMBED', _getValue('DISCORD_SUPPRESS_PRODUCT_EMBED', legacySuppressEmbeds ?? DEFAULTS.DISCORD_SUPPRESS_PRODUCT_EMBED)),
    DISCORD_FORUM_TITLE: sanitizeConfigValue('DISCORD_FORUM_TITLE', _getValue('DISCORD_FORUM_TITLE', DEFAULTS.DISCORD_FORUM_TITLE)),
    DISCORD_LAYOUT: sanitizeConfigValue('DISCORD_LAYOUT', (typeof _layoutRaw === 'string' && _layoutRaw.trim()) ? _layoutRaw : DEFAULTS.DISCORD_LAYOUT),
    MIN_OFFERS: sanitizeConfigValue('MIN_OFFERS', _getValue('MIN_OFFERS', DEFAULTS.MIN_OFFERS)),
    SORT_BY_OFFERS: sanitizeConfigValue('SORT_BY_OFFERS', _getValue('SORT_BY_OFFERS', DEFAULTS.SORT_BY_OFFERS)),
    ALARM_ENABLED: sanitizeConfigValue('ALARM_ENABLED', _getValue('ALARM_ENABLED', DEFAULTS.ALARM_ENABLED)),
    ALARM_TARGET_PERCENT: sanitizeConfigValue('ALARM_TARGET_PERCENT', _getValue('ALARM_TARGET_PERCENT', DEFAULTS.ALARM_TARGET_PERCENT)),
    ALARM_DURATION_DAYS: sanitizeConfigValue('ALARM_DURATION_DAYS', _getValue('ALARM_DURATION_DAYS', DEFAULTS.ALARM_DURATION_DAYS)),
    ALARM_AUTO_SUBMIT: sanitizeConfigValue('ALARM_AUTO_SUBMIT', _getValue('ALARM_AUTO_SUBMIT', DEFAULTS.ALARM_AUTO_SUBMIT)),
    ALARM_FALLBACK_TIMEOUT_MS: sanitizeConfigValue('ALARM_FALLBACK_TIMEOUT_MS', _getValue('ALARM_FALLBACK_TIMEOUT_MS', DEFAULTS.ALARM_FALLBACK_TIMEOUT_MS)),
    OBSERVER_DEBOUNCE_MS: sanitizeConfigValue('OBSERVER_DEBOUNCE_MS', _getValue('OBSERVER_DEBOUNCE_MS', DEFAULTS.OBSERVER_DEBOUNCE_MS)),
    DEBUG: sanitizeConfigValue('DEBUG', _getValue('DEBUG', DEFAULTS.DEBUG))
  };
  const sanitizeReviewKeyword = raw => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 150) || DEFAULTS.REVIEW_SEARCH_KEYWORD;
  // 0% is a legitimate threshold (check everything): only non-numeric storage
  // falls back to 30 — `|| 30` would silently discard an explicit 0.
  const realDealMinDiscount = () => (Number.isFinite(CONFIG.REAL_DEAL_MIN_DISCOUNT) ? CONFIG.REAL_DEAL_MIN_DISCOUNT : 30);
  // Corrupt storage must never silently break fills: fall back to defaults on
  // NaN/unknown durations.
  if (!['90', '180', '365', '730'].includes(CONFIG.ALARM_DURATION_DAYS)) CONFIG.ALARM_DURATION_DAYS = '730';
  if (CONFIG.REVIEW_SEARCH_KEYWORD === 'KI-Modus') { CONFIG.REVIEW_SEARCH_KEYWORD = DEFAULTS.REVIEW_SEARCH_KEYWORD; CONFIG.REVIEW_SEARCH_AI_MODE = true; }
  // Old defaults bump to new default (KI-Modus precedent above).
  if (
    CONFIG.REVIEW_SEARCH_KEYWORD === 'Testbericht' ||
    CONFIG.REVIEW_SEARCH_KEYWORD === 'Testbericht - {preis} Preiseinschätzung' ||
    CONFIG.REVIEW_SEARCH_KEYWORD === 'Testbericht Erfahrungen. Ist der Preis von {preis} ein guter Deal?' ||
    CONFIG.REVIEW_SEARCH_KEYWORD === 'Testberichte zu: [Produkt]. zum preis: {preis}. Antworte kurz mit Stärken, Schwächen und Deal-Urteil.'
  ) {
    CONFIG.REVIEW_SEARCH_KEYWORD = DEFAULTS.REVIEW_SEARCH_KEYWORD;
  }
  CONFIG.REVIEW_SEARCH_KEYWORD = sanitizeReviewKeyword(CONFIG.REVIEW_SEARCH_KEYWORD);
  if (typeof CONFIG.REVIEW_SEARCH_AI_MODE !== 'boolean') CONFIG.REVIEW_SEARCH_AI_MODE = DEFAULTS.REVIEW_SEARCH_AI_MODE;

  const saveConfigKey = (key, val) => {
    if (SECRET_KEYS.has(key)) return;
    const clean = sanitizeConfigValue(key, val);
    if (clean === undefined) return;
    CONFIG[key] = clean;
    _setValue(key, clean);
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
    document.documentElement.classList.toggle('tp-hide-ads', !!CONFIG.HIDE_ADS);
  }


  // Keys that update chrome/css directly and skip a full processListings() re-render.
  const FAST_SYNC_KEYS = new Set(['ALARM_ENABLED', 'ALARM_TARGET_PERCENT', 'ALARM_DURATION_DAYS', 'ALARM_AUTO_SUBMIT', 'HIDE_ADS']);
  const getDiscordChannels = () => {
    const list = Array.isArray(CONFIG.DISCORD_CHANNELS) ? CONFIG.DISCORD_CHANNELS : [];
    if (list.length > 0) return list;
    const legacy = (CONFIG.DISCORD_WEBHOOK_URL || '').trim();
    if (legacy) return [{ id: 'default', name: 'Standard', url: legacy }];
    return [];
  };
  function updateConfig(key, val, options = {}) {
    if (SECRET_KEYS.has(key)) {
      const clean = key === 'DISCORD_CHANNELS' ? (sanitizeConfigValue(key, val) ?? []) : val;
      CONFIG[key] = clean;
      _setValue(key, clean);
    }
    else {
      const clean = sanitizeConfigValue(key, val);
      if (clean === undefined) return;
      val = clean;
      saveConfigKey(key, val);
    }
    if (!options.skipUiSync) {
      syncUiControl(key, val);
    }
    if (key === 'DIM_OPACITY' || key === 'HIDE_ADS') {
      updateBodyClasses();
    }
    if (!options.skipRender && !FAST_SYNC_KEYS.has(key) && typeof processListings === 'function') {
      processListings();
    }
  }

  function updateConfigs(entries, options = {}) {
    for (const [k, v] of Object.entries(entries)) {
      updateConfig(k, v, { ...options, skipRender: true });
    }
    const needsRender = !options.skipRender && Object.keys(entries).some(k => !FAST_SYNC_KEYS.has(k));
    if (needsRender && typeof processListings === 'function') {
      processListings();
    }
  }
  // Re-exports: storage/schema/migrate symbols moved to siblings — every
  // existing `from './state/config.js'` / `'../state/config.js'` path keeps working.

  // ─── MODULE: src/state/config-sync.js ───────────────────────────────────────
  /**
   * Configuration UI Control Synchronization Layer
   * Synchronizes configuration state changes with modal and toolbar UI controls.
   */





  function syncUiControl(key, val, opts = {}, shadowRoot = null) {
    // 1. Sync Settings Modal (Shadow DOM) if open/exists
    const shadow = shadowRoot ?? opts?.shadowRoot ?? uiShadowRoot ?? (typeof document !== 'undefined' ? document.getElementById('tp-root')?.shadowRoot : null);
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
          case 'HEATMAP_INTENSITY': {
            const range = shadow.getElementById('tp-heatmap-intensity-range');
            const valEl = shadow.getElementById('tp-heatmap-intensity-val');
            const pct = Math.round((val ?? 1.0) * 100);
            if (range) range.value = pct;
            if (valEl) valEl.value = pct;
            break;
          }
          case 'MARGIN_PERCENT': {
            const range = shadow.getElementById('tp-margin-range');
            const valEl = shadow.getElementById('tp-margin-val');
            if (range) range.value = val;
            if (valEl) valEl.value = val;
            break;
          }
          case 'SORT_BY_OFFERS': {
            const radio = shadow.querySelector(`input[name="tp-sort-offers"][value="${val}"]`);
            if (radio) radio.checked = true;
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
            if (horizonRange) horizonRange.value = horizonStoredToUi(stored);
            const horizonVal = shadow.getElementById('tp-bestpreise-horizon-val');
            if (horizonVal) horizonVal.value = stored;
            const horizonDesc = shadow.getElementById('tp-bestpreise-horizon-desc');
            if (horizonDesc) horizonDesc.textContent = `Ø-Vergleich: ${horizonText(stored)} (0 = gesamte Historie / Lifetime, Vorgabe: 1J). Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis.`;
            // Toolbar range mirrors the modal control (skip while interacting).
            if (typeof document !== 'undefined') {
              const barRange = document.getElementById('tp-bar-horizon-range');
              if (barRange && document.activeElement !== barRange) {
                barRange.value = horizonStoredToUi(stored);
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
          case 'CACHE_MEMORY_LIMIT': {
            const range = shadow.getElementById('tp-cache-memory-range');
            const valEl = shadow.getElementById('tp-cache-memory-val');
            if (range) range.value = val;
            if (valEl) valEl.value = val;
            break;
          }
          case 'CACHE_DISK_LIMIT': {
            const range = shadow.getElementById('tp-cache-disk-range');
            const valEl = shadow.getElementById('tp-cache-disk-val');
            if (range) range.value = val;
            if (valEl) valEl.value = val;
            break;
          }
          case 'USE_SHIPPING_PRICE': {
            const toggle = shadow.getElementById('tp-shipping-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'HIDE_ADS': {
            const toggle = shadow.getElementById('tp-hide-ads-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'ENABLE_SPARKLINES': {
            const toggle = shadow.getElementById('tp-sparklines-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'KEEPA_CHART_ENABLED': {
            const toggle = shadow.getElementById('tp-keepa-chart-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'DEALER_AUTOFETCH': {
            const toggle = shadow.getElementById('tp-dealer-autofetch-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'REVIEW_SEARCH_ENABLED': {
            const toggle = shadow.getElementById('tp-review-search-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'REVIEW_SEARCH_KEYWORD': {
            const input = shadow.getElementById('tp-review-keyword-input');
            if (input) input.value = val;
            break;
          }
          case 'REVIEW_SEARCH_AI_MODE': {
            const toggle = shadow.getElementById('tp-review-ai-mode-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'TAVILY_ENABLED': {
            const toggle = shadow.getElementById('tp-tavily-enabled-toggle');
            if (toggle) toggle.checked = !!val;
            break;
          }
          case 'TAVILY_SEARCH_DEPTH': {
            const select = shadow.getElementById('tp-tavily-search-depth');
            if (select) select.value = val || 'basic';
            break;
          }
          case 'TAVILY_MAX_RESULTS': {
            const select = shadow.getElementById('tp-tavily-max-results');
            if (select) select.value = String(val || 5);
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
          case 'DISCORD_FORUM_TITLE': {
            const toggle = shadow.getElementById('tp-discord-forum-title-toggle');
            if (toggle) toggle.checked = val === true;
            break;
          }
          case 'ALARM_ENABLED': {
            const toggle = shadow.getElementById('tp-alarm-enabled-toggle');
            if (toggle) toggle.checked = val !== false;
            if (!opts.silent) notifyAlarmConfig();
            break;
          }
          case 'ALARM_TARGET_PERCENT': {
            const pct = Math.round((Number.isFinite(val) ? val : 0.60) * 100);
            const range = shadow.getElementById('tp-alarm-target-range');
            const num = shadow.getElementById('tp-alarm-target-val');
            if (range) range.value = pct;
            if (num) num.value = pct;
            if (!opts.silent) notifyAlarmConfig();
            break;
          }
          case 'ALARM_DURATION_DAYS': {
            const radio = shadow.querySelector(`input[name="tp-alarm-duration"][value="${val}"]`);
            if (radio) radio.checked = true;
            if (!opts.silent) notifyAlarmConfig();
            break;
          }
          case 'ALARM_AUTO_SUBMIT': {
            const toggle = shadow.getElementById('tp-alarm-autosubmit-toggle');
            if (toggle) toggle.checked = val !== false;
            if (!opts.silent) notifyAlarmConfig();
            break;
          }
        }
      } catch (err) {
        console.warn('[Toppreise-Suite] syncUiControl error', err);
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
            case 'FILTERS_ENABLED': {
              syncMiniToggle(bar.querySelector('#tp-bar-filters-toggle'), val !== false, 'Filter');
              const filterBtn = bar.querySelector('#tp-bar-filter-btn');
              if (filterBtn) {
                filterBtn.classList.toggle('tp-filters-paused', val === false);
              }
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
              paintCycleButtons(bar, 'HIDE_UNCHECKED_MODE');
              break;
            }
            case 'BESTPREISE_INCLUDE_VORTIEF': {
              paintCycleButtons(bar, 'VORTIEF_MODE');
              break;
            }
            case 'OUTLIER_REJECTION_ENABLED': {
              syncMiniToggle(bar.querySelector('#tp-bar-outlier-toggle'), val !== false, 'Ausreisser-Filter');
              const dim = val === false;
              for (const id of ['tp-bar-outlier-band-wrapper', 'tp-bar-outlier-hours-wrapper']) {
                const wrap = bar.querySelector('#' + id);
                if (wrap) wrap.classList.toggle('tp-tool-dim', dim);
              }
              break;
            }
            case 'OUTLIER_DEVIATION_BAND': {
              const pct = Math.min(50, Math.max(1, Math.round((val ?? 0.5) * 100)));
              const bandRange = bar.querySelector('#tp-bar-outlier-band-range');
              if (bandRange && document.activeElement !== bandRange) bandRange.value = pct;
              const bandLabel = bar.querySelector('#tp-bar-outlier-band-label');
              if (bandLabel) bandLabel.textContent = `±${pct} %`;
              break;
            }
            case 'OUTLIER_MAX_GLITCH_HOURS': {
              const hrs = Math.min(168, Math.max(24, parseInt(val ?? 48, 10) || 48));
              const hoursRange = bar.querySelector('#tp-bar-outlier-hours-range');
              if (hoursRange && document.activeElement !== hoursRange) hoursRange.value = hrs;
              const hoursLabel = bar.querySelector('#tp-bar-outlier-hours-label');
              if (hoursLabel) hoursLabel.textContent = `${hrs} h`;
              break;
            }
            case 'FILTER_NEG_MODE':
            case 'FILTER_MIN_MODE':
            case 'FILTER_DEAL_DISCOUNT_MODE':
            case 'FILTER_PRICE_MODE':
            case 'FILTER_SAVINGS_MODE':
            case 'HIDE_UNCHECKED_MODE':
            case 'VORTIEF_MODE': {
              paintCycleButtons(bar, key);
              break;
            }
            case 'DEALER_MODE': {
              const mode = (val === 'dim' || val === 'highlight') ? val : 'hide';
              bar.querySelectorAll(`[data-mode-key="${key}"]`).forEach(btn => {
                paintCycleButton(btn, mode);
              });
              break;
            }
            case 'FILTER_NEG_ENABLED': {
              paintCycleButtons(bar, 'FILTER_NEG_MODE');
              bar.querySelector('.tp-input-field-box')?.classList.toggle('tp-tool-dim', !val);
              break;
            }
            case 'FILTER_MIN_ENABLED': {
              paintCycleButtons(bar, 'FILTER_MIN_MODE');
              bar.querySelector('#tp-bar-min-offers-group')?.classList.toggle('tp-tool-dim', !val);
              break;
            }
            case 'FILTER_DEAL_DISCOUNT_ENABLED': {
              paintCycleButtons(bar, 'FILTER_DEAL_DISCOUNT_MODE');
              bar.querySelector('#tp-bar-deal-disc-group')?.classList.toggle('tp-tool-dim', !val);
              break;
            }
            case 'FILTER_PRICE_ENABLED': {
              paintCycleButtons(bar, 'FILTER_PRICE_MODE');
              bar.querySelector('#tp-bar-price-group')?.classList.toggle('tp-tool-dim', !val);
              break;
            }
            case 'FILTER_SAVINGS_ENABLED': {
              paintCycleButtons(bar, 'FILTER_SAVINGS_MODE');
              bar.querySelector('#tp-bar-savings-group')?.classList.toggle('tp-tool-dim', !val);
              break;
            }
            case 'FILTER_PRICE_MIN': {
              const el = bar.querySelector('#tp-price-min-input');
              if (el && document.activeElement !== el) el.value = val > 0 ? val : '';
              break;
            }
            case 'FILTER_PRICE_MAX': {
              const el = bar.querySelector('#tp-price-max-input');
              if (el && document.activeElement !== el) el.value = val > 0 ? val : '';
              break;
            }
            case 'FILTER_SAVINGS_MIN': {
              const el = bar.querySelector('#tp-savings-min-input');
              if (el && document.activeElement !== el) el.value = val > 0 ? val : '';
              break;
            }
            case 'MIN_OFFERS': {
              const minVal = bar.querySelector('#tp-bar-min-val');
              if (minVal) minVal.textContent = val;
              break;
            }
            case 'MIN_DEAL_DISCOUNT': {
              const discVal = bar.querySelector('#tp-bar-deal-disc-val');
              if (discVal) discVal.textContent = `${val}%`;
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
          console.warn('[Toppreise-Suite] syncUiControl bar error', err);
        }
      }
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
    currentlyScanningPid: null,
    singleScanningPids: new Set(),
    batchScanningPids: new Set(),
    progress: { completed: 0, total: 0 },
    freshPids: new Set(),
    freshUntil: 0
  };

  function isScanningPid(pid) {
    return pid != null && (
      scanState.currentlyScanningPid === pid ||
      scanState.singleScanningPids.has(pid) ||
      scanState.batchScanningPids.has(pid)
    );
  }

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
        const prdContainer = prd.closest ? prd.closest('.productPrice') : null;
        if (shpContainer) {
          if (card.classList?.contains('tp-filtered') && card.offsetParent === null) return true;
          if (shpContainer.style?.display === 'none') return false;
          if (shpContainer.offsetParent === null && prdContainer?.offsetParent !== null) return false;
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
    return (typeof location !== 'undefined' && /(?:neue-toppreise|new-best-prices|nouveaux-meilleurs-prix)/i.test(location.href)) ||
           document.body?.classList.contains('Page_ListTopPriceReductionProducts') ||
           document.body?.classList.contains('Page_ListTop100Products');
  }
  function isSearchPage() {
    const currentUrl = document.body?.getAttribute('data-current_url') ?? document.body?.getAttribute('data-current-url') ?? (typeof location !== 'undefined' ? location.href : '');
    return /(?:produktsuche|productsearch)/i.test(currentUrl || '');
  }

  function getDetailProductId() {
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

  function getDetailLowestPrice() {
    const shipping = isShippingPriceActive();
    const productFirst = ['.productPrice .Plugin_Price', '.product_price .Plugin_Price', '.lowestPrice .Plugin_Price', '.priceComparison .Plugin_Price', '.tableDealerPriceList .Plugin_Price', '.Plugin_Price'];
    const selectors = shipping ? ['.shippingPrice .Plugin_Price'] : productFirst;
    for (const sel of selectors) {
      const priceEl = document.querySelector(sel);
      if (priceEl) return { price: parsePrice(priceEl.textContent), basis: shipping ? 'shipping' : 'product' };
    }
    return { price: 0, basis: null };
  }

  function isProductDetailPage() {
    return (typeof location !== 'undefined' && /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(location.href)) ||
           /\/preisvergleich\/[^/]+\/[^/]+-p(\d+)/i.test(document.body?.getAttribute('data-current_url') || '') ||
           document.body?.classList.contains('Page_Product') ||
           document.body?.classList.contains('Page_DetailProduct') ||
           !!document.querySelector('.Page_DetailProduct, #Page_DetailProduct, .product_detail_page, .Page_Product') ||
           (!!document.querySelector('.Plugin_ProductHeading h1, .productHeading h1, .product_title h1, h1.productTitle') && !!getDetailProductId());
  }


  function triggerProcessListings() {
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
  function scheduleProcessListings() {
    if (tpRenderPending) return;
    tpRenderPending = true;
    setTimeout(() => { tpRenderPending = false; triggerProcessListings(); }, 50);
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
    const count = parseInt(card.textContent.match(/(\d+)\s*(?:Angebote?|offres?|offert[ae]|offers?)/i)?.[1] || card.querySelectorAll('.Plugin_DealerRelProdPriceInfo').length, 10);
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

  const _negReCache = new Map();
  function matchesNegativeTerms(card, termsList) {
    if (!termsList || termsList.length === 0) return false;
    let text = card._tpTextLower;
    if (text === undefined) {
      const nodes = card.querySelectorAll?.('.bold, .product-name, .productDetails, .Plugin_ProductHeading');
      const joined = [...(nodes ?? [])].map(el => {
        if (!el.querySelector?.('[class*="tp-"]')) return el.textContent;
        const clone = el.cloneNode(true);
        clone.querySelectorAll('[class*="tp-"]').forEach(n => n.remove());
        return clone.textContent;
      }).join(' ');
      if (joined.trim()) text = joined.toLowerCase();
      else {
        const single = card.querySelector?.('.bold, .product-name, .productDetails, .Plugin_ProductHeading');
        if (single?.textContent?.trim()) text = single.textContent.toLowerCase();
        else if (typeof card.cloneNode === 'function') {
          const clone = card.cloneNode(true);
          clone.querySelectorAll?.('.tp-injected-badge, .tp-share-btn, .tp-dealer-name, .tp-best-price-badge, [class*="tp-"]').forEach(el => el.remove());
          text = (clone.textContent || '').toLowerCase();
        } else {
          text = (card.textContent || '').toLowerCase();
        }
      }
      card._tpTextLower = text;
    }
    return termsList.some(entry => {
      if (!entry) return false;
      const re = typeof entry === 'string' ? null : entry.re;
      if (re) return re.test(text);
      const term = typeof entry === 'string' ? entry : entry.term;
      if (!term) return false;
      if (term.length <= 3) {
        let shortRe = _negReCache.get(term);
        if (!shortRe) {
          shortRe = new RegExp(`(?<![\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');
          _negReCache.set(term, shortRe);
        }
        return shortRe.test(text);
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
    // Never parse script-painted ribbon text as the site Differenz: after a
    // cache clear the badge still shows our verdict, not the host number.
    // Fall back to the pid-keyed snapshot (tpOriginalDiscount stores the site
    // discount, i.e. -diff) so counting/filtering keep the host number.
    if (badgeEl?.dataset?.tpPainted === 'true') {
      // Host update detection: changed badge text with a live host % voids the
      // snapshot (same pid or not) so counting/filtering re-read the host
      // number below. Paint site stamps tpPaintedText on every script write.
      if (badgeEl.dataset.tpPaintedText !== undefined && badgeEl.textContent !== badgeEl.dataset.tpPaintedText) {
        const hostMatch = badgeEl.textContent.match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);
        if (hostMatch) {
          delete badgeEl.dataset.tpPainted;
          delete badgeEl.dataset.tpOriginalDiscount;
          delete badgeEl.dataset.tpOriginalPid;
          delete badgeEl.dataset.tpPaintedText;
          if (card.dataset) delete card.dataset.tpDiff;
        }
      }
      if (badgeEl.dataset.tpPainted === 'true') {
        const snap = badgeEl.dataset.tpOriginalDiscount;
        const snapPid = badgeEl.dataset.tpOriginalPid ?? '';
        if (snap !== undefined && snap !== '' && snapPid === (getCardProductId(card) ?? '')) {
          const discount = parseFloat(snap);
          if (!isNaN(discount)) return discount === 0 ? 0 : -discount;
        }
        return null;
      }
      /* snapshot voided: fall through to host parse below */
    }
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

  // Deal-Intensität ramp: warm amber (-1% entry discount) -> coral/vermilion
  // (-40% mid discount) -> deep ruby/red (-100% max savings).
  // Markups and 0% deals return null (transparent / no heat effect).
  const HEAT_STOPS = [
    { t: 0.00, base: [65, 38, 10],   acc: [180, 83, 9],    border: [245, 158, 11, 0.75] }, // Warm Amber (-1%)
    { t: 0.40, base: [85, 28, 14],   acc: [200, 50, 15],   border: [234, 88, 12, 0.85] },  // Coral / Vermilion (-40%)
    { t: 1.00, base: [110, 15, 35],  acc: [215, 25, 55],   border: [244, 63, 94, 0.95] }   // Blazing Ruby/Red (-100%)
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

  // Regular (verified blend) signal: prominent INSET wash, no background fill,
  // no border. Inset (never outer): an outer box-shadow paints past the border
  // box and bleeds onto neighboring cards — inset clips at the card's own edge
  // by construction, no per-layout tuning.
  // Non-discounts (dropPct <= 0) return null (transparent / no heat).
  function getInsetHeatStyle(dropPct, intensity = 1.0) {
    const d = typeof dropPct === 'number' ? dropPct : parseFloat(dropPct);
    if (isNaN(d) || d <= 0) return null;
    const c = heatColor(-Math.abs(d), intensity);
    if (!c) return null;
    const { acc, safeInt, t } = c;
    const alpha = (0.18 + 0.42 * t) * safeInt;
    return {
      glow: `inset 0 0 30px 10px rgba(${acc.join(',')},${alpha.toFixed(2)})`,
      color: `rgb(${acc.join(',')})`
    };
  }

  // Badge reuses the card logic: solid swatch from the same ramp so the badge
  // color always matches the card heat. Non-discounts (diffPercent >= 0)
  // return null so badges remain transparent/colorless.
  function getBadgeHeatStyle(diffPercent, provisional = false, intensity = 1.0) {
    const d = typeof diffPercent === 'number' ? diffPercent : parseFloat(diffPercent);
    if (isNaN(d) || d >= 0) return null;
    const c = heatColor(d, intensity);
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

  let _negCacheRaw = null;
  let _negCacheParsed = null;
  function parseNegativeTerms(rawTerms = CONFIG.NEGATIVE_TERMS || '') {
    if (rawTerms === _negCacheRaw && _negCacheParsed) return _negCacheParsed;
    const parsed = (rawTerms || '').split(/[,;\n]/).map(t => t.trim().toLowerCase()).filter(Boolean)
      .map(term => ({ term, re: term.length <= 3 ? new RegExp(`(?<![\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu') : null }));
    _negCacheRaw = rawTerms;
    _negCacheParsed = parsed;
    return parsed;
  }
  // Basis gate rule (single source): a product-only live price must never score
  // against shipping-inclusive history (or vice versa). Legacy cache entries
  // without the boolean flag pass through; mismatches render unverified.
  const basisMatchesFor = (stats, cardPriceBasis) =>
    typeof stats?.isShippingPrice !== 'boolean'
    || stats.isShippingPrice === (cardPriceBasis === 'shipping');
  // Single scan-eligibility resolver (counter + scanner queue share it):
  function getCardStats(pid, cardBasis) {
    if (!pid) return null;
    const specific = getCachedPriceStats(pid, false, null, cardBasis === 'shipping');
    if (specific) return specific;
    const fallback = getCachedPriceStats(pid, false, null, cardBasis !== 'shipping');
    if (!fallback) return null;
    if (!fallback.unavailable) return fallback;
    return basisMatchesFor(fallback, cardBasis) ? fallback : null;
  }

  // usable stats verify, fresh unavailable markers wait out the negative TTL,
  // basis mismatches refetch (no new state), everything else is unchecked.
  function scanEligibility(card) {
    const pid = getCardProductId(card);
    if (!pid) return { state: 'verified', canScan: false, retryAt: null, reason: 'no-pid' };
    const { price: cardPrice, basis: cardBasis } = extractCanonicalPrice(card);
    if (!(cardPrice > 0) || !cardBasis) {
      return { state: 'verified', canScan: false, retryAt: null, reason: 'no-price' };
    }
    const stats = getCardStats(pid, cardBasis);
    if (stats && !basisMatchesFor(stats, cardBasis)) {
      return { state: 'basis-mismatch', canScan: true, retryAt: null, reason: 'basis-mismatch' };
    }
    if (stats && stats.unavailable) {
      return { state: 'unavailable', canScan: false, retryAt: (stats.time || Date.now()) + (CONFIG.NEGATIVE_CACHE_HOURS || 2) * 3600 * 1000, reason: 'negative-cache' };
    }
    if (hasUsablePriceStats(stats)) return { state: 'verified', canScan: false, retryAt: null, reason: null };
    return { state: 'unchecked', canScan: true, retryAt: null, reason: null };
  }
  function extractCardData(card) {
    const pid = getCardProductId(card);
    const priceData = extractCanonicalPrice(card);
    const cardPriceEl = priceData.el;
    const cardPrice = priceData.price;
    const cardPriceBasis = priceData.basis;
    const stats = getCardStats(pid, cardPriceBasis);
    const diffVal = extractCardDiff(card);
    const discountVal = extractCardDiscount(card);
    const basisMatches = basisMatchesFor(stats, cardPriceBasis);
    const dealScore = (basisMatches && hasUsablePriceStats(stats) && cardPrice > 0) ? computeDealScore(stats, cardPrice) : null;
    // Display delta never gates on history quality: with just {tiefstpreis} +
    // card price the badge/heat still tell the verified truth.
    const displayDelta = basisMatches ? getDisplayDelta(cardPrice, stats) : { kind: 'unknown' };
    const offerCount = extractOfferCount(card);
    const effDiscount = getCardEffectiveDiscount({
      basisMatches,
      verifiedStats: basisMatches ? stats : null,
      stats,
      cardPriceBasis,
      dealScore,
      displayDelta,
      discountVal,
      diffVal,
      cardPrice
    });
    const savingsChf = computeSavingsChf(cardPrice, effDiscount);

    return {
      card,
      pid,
      cardPriceEl,
      cardPrice,
      cardPriceBasis,
      basisMatches,
      stats,
      verifiedStats: basisMatches ? stats : null,
      diffVal,
      discountVal,
      dealScore,
      displayDelta,
      offerCount,
      savingsChf
    };
  }

  function getCardEffectiveDiscount(cd) {
    if (!cd) return 0;
    const sortBasisOk = cd.basisMatches ?? basisMatchesFor(cd.stats, cd.cardPriceBasis);
    const vStats = cd.verifiedStats ?? (sortBasisOk ? cd.stats : null);
    const dealData = (cd.dealScore === undefined && vStats && cd.cardPrice > 0) ? computeDealScore(vStats, cd.cardPrice) : (cd.dealScore ?? null);
    if (dealData) return dealData.weightedDiff;
    if (hasUsablePriceStats(vStats)) {
      const displayDelta = cd.displayDelta ?? (vStats ? getDisplayDelta(cd.cardPrice, vStats) : null);
      if (displayDelta?.kind === 'at-low' || displayDelta?.kind === 'new-low') {
        const dropVsPrev = vortiefDropPct(cd.cardPrice, vStats);
        const prevLowNow = recordRefForPrice(vStats, cd.cardPrice)?.previousLow;
        const hasPrevLowBase = prevLowNow && priceToCents(prevLowNow) > priceToCents(cd.cardPrice);
        if (dropVsPrev > 0 && hasPrevLowBase) return dropVsPrev;
        const rawDisc = cd.discountVal ?? (typeof cd.diffVal === 'number' && cd.diffVal < 0 ? -cd.diffVal : 0);
        return rawDisc > 0 ? rawDisc : 0;
      }
      const markup = displayDelta?.markup ?? (vStats?.tiefstpreis ? pctRise(vStats.tiefstpreis, cd.cardPrice) : 0);
      return -Math.max(0, markup || 0);
    }
    const rawDisc = cd.discountVal ?? (typeof cd.diffVal === 'number' && cd.diffVal < 0 ? -cd.diffVal : 0);
    return rawDisc || 0;
  }

  function applyCardFilters(cd, termsList, minOffers, pageHasOffers, isDealFeed = true) {
     const isNeg = CONFIG.FILTER_NEG_ENABLED ? matchesNegativeTerms(cd.card, termsList) : false;
     const isLowOffers = CONFIG.FILTER_MIN_ENABLED ? !!(pageHasOffers && minOffers > 0 && cd.offerCount < minOffers) : false;
     const kind = cd.displayDelta?.kind;
     const isVortief = !cd.dealScore && (kind === 'at-low' || kind === 'new-low');
     const isVortiefExcluded = CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && isVortief;
     const stats = cd.verifiedStats !== undefined ? cd.verifiedStats : cd.stats;
     const isVerified = !!cd.dealScore || hasUsablePriceStats(stats);
     const isUnchecked = CONFIG.BESTPREISE_HIDE_UNCHECKED === true && !hasUsablePriceStats(stats);
     const isBelowMinDiscount = CONFIG.FILTER_DEAL_DISCOUNT_ENABLED && CONFIG.MIN_DEAL_DISCOUNT > 0 && isVerified && getCardEffectiveDiscount(cd) < CONFIG.MIN_DEAL_DISCOUNT;
     const price = cd.cardPrice || 0;
     const minP = CONFIG.FILTER_PRICE_MIN || 0;
     const maxP = CONFIG.FILTER_PRICE_MAX || 0;
     const isOutOfPriceRange = CONFIG.FILTER_PRICE_ENABLED && price > 0 && (
       (minP > 0 && price < minP) || (maxP > 0 && price > maxP)
     );
     const minS = CONFIG.FILTER_SAVINGS_MIN || 0;
     const savings = cd.savingsChf ?? computeSavingsChf(cd.cardPrice, getCardEffectiveDiscount(cd));
     const isBelowMinSavings = CONFIG.FILTER_SAVINGS_ENABLED && isVerified && minS > 0 && savings < minS;
     const isDealerLoser = false;
     return { isNeg, isLowOffers, isBelowMinDiscount, isOutOfPriceRange, isBelowMinSavings, isVortiefExcluded, isUnchecked, isDealerLoser };
  }
  function dealerLoserFor(card, activeStores) {
    if (!activeStores || activeStores.length === 0) return false;
    const dealerRows = getCardDealerRows(card);
    if (dealerRows.length === 0) return false;
    const matchedRows = dealerRows
      .filter(item => item.storeName && activeStores.some(store => item.storeName.includes(store) || store.includes(item.storeName)))
      .map(item => item.row);
    if (matchedRows.length === 0) return true;
    const priceData = extractCanonicalPrice(card);
    const useShipping = isShippingPriceActive(card);
    const bestPrice = priceData.price > 0 ? priceData.price : (priceData.el ? parsePrice(priceData.el.textContent) : 0);
    const limit = bestPrice * (1 + CONFIG.MARGIN_PERCENT / 100);
    // Any qualifying selected dealer keeps the card: rows are evaluated in
    // DOM order but the verdict must not depend on it.
    for (const row of matchedRows) {
      // Rows carry a single offer price (host marks it .productPrice even in
      // shipping mode): prefer the active basis but fall back — a missing
      // wrapper must not disqualify every selected dealer.
      const storePriceEl = useShipping
        ? (row.querySelector('.shippingPrice .Plugin_Price') || row.querySelector('.productPrice .Plugin_Price'))
        : (row.querySelector('.productPrice .Plugin_Price') || row.querySelector('.shippingPrice .Plugin_Price'));
      const storePrice = storePriceEl ? parsePrice(storePriceEl.textContent) : 0;
      if (storePrice > 0 && bestPrice > 0 && storePrice <= limit) return false;
    }
    return true;
  }

  function isCardFilteredOut(card, filters = null, opts = null) {
    if (!card) return true;
    const forScan = opts?.forScan === true;
    const isHide = m => m !== 'dim' && m !== 'highlight';
    const causeHit = f => (f.isNeg && isHide(CONFIG.FILTER_NEG_MODE))
      || (f.isLowOffers && isHide(CONFIG.FILTER_MIN_MODE))
      || (f.isDealerLoser && isHide(CONFIG.DEALER_MODE))
      || (!forScan && f.isBelowMinDiscount && isHide(CONFIG.FILTER_DEAL_DISCOUNT_MODE))
      || (!forScan && f.isOutOfPriceRange && isHide(CONFIG.FILTER_PRICE_MODE))
      || (!forScan && f.isBelowMinSavings && isHide(CONFIG.FILTER_SAVINGS_MODE))
      || (forScan ? false : (f.isUnchecked && isHide(CONFIG.HIDE_UNCHECKED_MODE)))
      || (f.isVortiefExcluded && isHide(CONFIG.VORTIEF_MODE));
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
    if (CONFIG.FILTERS_ENABLED === false) return legacyChecks();
    if (filters) {
      if (!causeHit(filters)) return legacyChecks();
      return true;
    }
    const f = {
      isNeg: card.classList?.contains('tp-negative-filtered') === true,
      isLowOffers: card.classList?.contains('tp-min-offers-filtered') === true,
      isBelowMinDiscount: !!card.classList?.contains('tp-deal-disc-filtered'),
      isOutOfPriceRange: card.classList?.contains('tp-price-filtered') === true,
      isBelowMinSavings: card.classList?.contains('tp-savings-filtered') === true,
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
    let pageHasOffers = typeof opts?.pageHasOffers === 'boolean' ? opts.pageHasOffers : (offerCount > 0);
    if (!pageHasOffers) {
      const doc = card?.ownerDocument || (typeof document !== 'undefined' ? document : null);
      if (doc?.querySelector) {
        const now = Date.now();
        if (doc._tpOffersMemoTime && (now - doc._tpOffersMemoTime) < 500) {
          pageHasOffers = doc._tpHasOffersMemo;
        } else {
          pageHasOffers = doc.querySelector('.Plugin_DealerRelProdPriceInfo') !== null;
          doc._tpOffersMemoTime = now;
          doc._tpHasOffersMemo = pageHasOffers;
        }
      }
    }
    const recomp = applyCardFilters({ card, offerCount }, termsList, CONFIG.MIN_OFFERS, pageHasOffers);
    f.isNeg = f.isNeg || recomp.isNeg;
    f.isLowOffers = f.isLowOffers || recomp.isLowOffers;
    f.isBelowMinDiscount = f.isBelowMinDiscount || recomp.isBelowMinDiscount;
    if (!causeHit(f)) return legacyChecks();
    return true;
  }

  function scanCandidateState(cd, { isFeed = false, minDiscount = 30 } = {}) {
    if (!cd?.pid) return null;
    if (isFeed && (cd.discountVal === null || cd.discountVal < minDiscount)) return null;
    if (isCardFilteredOut(cd.card, cd.filters, { forScan: true })) return null;
    return scanEligibility(cd.card);
  }

  // ─── MODULE: src/page/product-offers.js ─────────────────────────────────────
  /**
   * Product Offers & Dealer Extraction
   * DOM and JSON-LD scrapers for product offers, dealers, and shop links on toppreise.ch.
   */




  const isToppreiseProductUrl = u => {
    try {
      const parsed = new URL(u);
      if (parsed.hostname !== 'toppreise.ch' && parsed.hostname !== 'www.toppreise.ch') return false;
      return parsed.pathname.startsWith('/preisvergleich/');
    } catch { return false; }
  };

  // Titel + Produktlink aus der Karte ziehen (alles tolerant, Layout-wechsel-sicher).
  function extractShareData(card) {
    if (!card?.querySelector) return { title: '', url: '', imageUrl: '' };
    const titleEl = card.querySelector('.product-name, .productDetails, .bold, a[title]');
    // Review-Button (Schritt 9) hängt im Titel-Element: für Titelzwecke ausblenden,
    // sonst frisst sich sein Emoji bei jedem Re-Render in Titel, Query und Share-Text.
    let title = '';
    if (titleEl) {
      const clone = typeof titleEl.cloneNode === 'function' ? titleEl.cloneNode(true) : null;
      clone?.querySelectorAll?.('.tp-review-search-btn')?.forEach(el => el.remove());
      title = (clone?.textContent ?? titleEl.textContent)?.trim() || titleEl.getAttribute?.('title') || '';
    }
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
    if (url && !isToppreiseProductUrl(url)) url = '';
    return { title, url, imageUrl };
  }

  // Günstigste Händlerzeile auf Karten-Basis (Name + Link aus derselben Zeile):
  // ohne parsebaren Basispreis gewinnt die erste Zeile (bisheriges Verhalten).
  function extractCheapestDealerRow(card, useShipping = false) {
    const rows = Array.from(card?.querySelectorAll?.(SELECTORS.cards.dealerRows) || []);
    if (!rows.length) return null;
    const priceSel = useShipping ? '.shippingPrice .Plugin_Price' : '.productPrice .Plugin_Price';
    let best = null;
    for (const row of rows) {
      const price = parsePrice(row.querySelector?.(priceSel)?.textContent);
      if (!(price > 0)) continue;
      if (!best || price < best.price) best = { row, price };
    }
    return best ? best.row : rows[0];
  }

  // Angezeigten Händler (günstigste Zeile zuerst) als Klartext.
  function extractDealer(card, useShipping = false) {
    const row = extractCheapestDealerRow(card, useShipping);
    return row?.querySelector?.('.title')?.textContent?.replace(/\s+/g, ' ').trim() || '';
  }

  // Direktlink zum Händlerangebot aus der Händlerzeile (Katalog), falls verlinkt.
  function extractDealerUrl(card, useShipping = false) {
    const a = extractCheapestDealerRow(card, useShipping)?.querySelector?.('a[href]');
    let url = a?.getAttribute?.('href') || a?.href || '';
    if (url && !/^https?:\/\//i.test(url)) {
      try { url = new URL(url, location.href).href; } catch { /* relativ lassen */ }
    }
    return /^https:/i.test(url) ? url : '';
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
        const agg = list.length === 1 && list[0]?.['@type'] === 'AggregateOffer' ? list[0] : null;
        if (agg) {
          // Nested offer objects beat a bare count: recurse into them so the
          // dealer comes from real rows, not an ID list.
          if (Array.isArray(agg.offers) && agg.offers.length) {
            const nested = parseJsonLdOffer({ '@type': 'Product', offers: agg.offers });
            if (nested.dealer || nested.offers) {
              if (!nested.totalOffers) { const t = Number(agg.offerCount); if (Number.isFinite(t) && t > 0) nested.totalOffers = Math.round(t); }
              return nested;
            }
          }
          // Count-only: no loaded rows (offers 0), but a real total.
          const n = +agg.offerCount;
          return { dealer: '', offers: 0, totalOffers: Number.isFinite(n) && n > 0 ? Math.round(n) : 0 };
        }
        let best = null;
        for (const o of list) {
          // Strict: +null/+'' coerce to 0 and must never win as "cheapest".
          const price = Number(o?.price);
          if (!Number.isFinite(price) || !(price > 0)) continue;
          if (!best || price < best.price) best = { price, dealer: typeof o.seller === 'object' ? (o.seller?.name || '') : (o.seller || '') };
        }
        if (best) return { dealer: best.dealer, offers: list.length, totalOffers: 0 };
      }
    }
    return { dealer: '', offers: 0, totalOffers: 0 };
  }

  // Aggregate total independent of loaded rows: page-1 rows and the JSON-LD
  // offerCount coexist, so the row path must not skip the count scan.
  function jsonLdOfferTotal(doc) {
    let total = 0;
    for (const s of Array.from(doc?.querySelectorAll?.('script[type="application/ld+json"]') || [])) {
      try {
        const found = parseJsonLdOffer(JSON.parse(s.textContent));
        if (Number.isFinite(found?.totalOffers) && found.totalOffers > total) total = Math.round(found.totalOffers);
      } catch { /* Block einzeln ignorieren */ }
    }
    return total;
  }

  // Produktseiten listen Angebote als .Plugin_Offer-Blöcke (Preis-aufsteigend,
  // statisch im HTML, live verifiziert 2026-10-09): Shopname im Logo-alt, je ein
  // Produkt-/Versandpreis. Günstigstes Angebot auf Karten-Basis wählen (Min statt
  // erste Zeile: robust gegen fremde Sortier-Cookies; nur Seite 1 geparst).
  // Feed-Format zusätzlich als .Plugin_DealerRelProdPriceInfo-Zeilen (.title +
  // je ein Produkt-/Versandpreis): gleiches Offer-Shape, gleiche strikte Wahl.
  function parseDealerRows(doc) {
    const rows = Array.from(doc?.querySelectorAll?.(`${SELECTORS.cards.dealerRows}`) || []);
    return rows.map(row => {
      const dealer = row.querySelector?.('.title')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const product = parsePrice(row.querySelector?.('.productPrice .Plugin_Price')?.textContent);
      const shipping = parsePrice(row.querySelector?.('.shippingPrice .Plugin_Price')?.textContent);
      const link = row.querySelector?.('a[href*="ext_de"]');
      const url = link?.getAttribute?.('href') || link?.href || '';
      return { dealer, product: product || 0, shipping: shipping || 0, url: url || '' };
    }).filter(o => o.dealer || o.product > 0 || o.shipping > 0);
  }

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
      // Basis-strict: no cross-basis fallback — a product-only price must never
      // stand in for shipping-inclusive history (or vice versa).
      const price = useShipping ? (o.shipping || 0) : (o.product || 0);
      if (!(price > 0)) continue;
      if (!best || price < best.price) best = { price, dealer: o.dealer || '', url: o.url || '' };
    }
    return best;
  }

  // Feed-Karten tragen keine Händlerzeilen: Produktseite nachladen (nur bei Klick,
  // same-origin, kein CORS-Problem). Katalog-Zeilen → .Plugin_Offer-Blöcke (inkl.
  // /ext_de-Direktlink zum günstigsten Angebot) → JSON-LD (nur Count). Händler
  // immer auf Karten-Preisbasis (Versand/Produkt).
  async function fetchProductInfo(productUrl, timeoutMs = 10000, useShipping = false) {
    // offers = loaded page-1 rows; totalOffers = JSON-LD AggregateOffer count
    // when present (0 otherwise). Callers keep reading `offers` — no migration.
    const out = { dealer: '', offers: 0, dealerUrl: '', totalOffers: 0 };
    try {
      if (typeof fetch === 'undefined' || typeof DOMParser === 'undefined') return out;
      if (!/^https?:\/\//i.test(productUrl || '')) return out;
      if (!isToppreiseProductUrl(productUrl)) return out;
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
      let res;
      let html;
      try {
        res = await fetch(productUrl, { signal: ctrl?.signal });
        if (!res.ok) return out;
        html = await res.text();
      } finally {
        clearTimeout(timer);
      }
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // Single dealer policy: dealer rows first (feed shape), then .Plugin_Offer
      // blocks — both through basis-strict cheapest (row order may follow
      // foreign sort cookies). Basis-strict: no parseable price on the card
      // basis means unknown dealer — never the opposite-basis name.
      const dealerRows = parseDealerRows(doc);
      const offers = dealerRows.length ? dealerRows : parseProductOffers(doc);
      if (offers.length) {
        out.offers = offers.length;
        out.totalOffers = jsonLdOfferTotal(doc);
        const best = pickCheapestOffer(offers, useShipping);
        out.dealer = best ? best.dealer : '';
        if (best?.url) {
          try { out.dealerUrl = new URL(best.url, productUrl).href; } catch { out.dealerUrl = best.url; }
        }
        return out;
      }
      const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of scripts) {
        try {
          const found = parseJsonLdOffer(JSON.parse(s.textContent));
          if (found.dealer || found.offers || found.totalOffers) {
            // Count-only unter Versandbasis: unbekannter Versandpreis kann nie
            // einen Delivered-Preis-Sieger küren — nur die Anzahl übernehmen.
            if (useShipping) return { dealer: '', offers: found.offers, dealerUrl: '', totalOffers: found.totalOffers || 0 };
            return { dealer: found.dealer, offers: found.offers, dealerUrl: '', totalOffers: found.totalOffers || 0 };
          }
        } catch { /* Block einzeln ignorieren */ }
      }
      console.debug('[Toppreise-Suite] Händler-Fallback leer', { htmlBytes: html.length, rowCount: offers.length, jsonLdBlocks: scripts.length });
    } catch { /* Händler unbekannt: Zeile entfällt */ }
    return out;
  }

  // Amazon ASIN parser: captures from standard /dp/, /gp/product/, or query parameters.
  function parseAmazonAsin(url) {
    if (!url || typeof url !== 'string') return null;
    const dpMatch = url.match(/(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})(?:[/?#]|$)/i);
    if (dpMatch) return dpMatch[1].toUpperCase();
    const qMatch = url.match(/[?&](?:creativeASIN|asin)=([A-Z0-9]{10})(?:[&/?#]|$)/i);
    if (qMatch) return qMatch[1].toUpperCase();
    return null;
  }

  // In-memory ASIN cache for active session
  const memoryAsinCache = new Map();

  function clearMemoryAsinCache() {
    memoryAsinCache.clear();
  }

  // Resolves the Amazon ASIN from a direct dealer link or /ext_de redirect URL.
  // Caches persistently per productId in localStorage and memory.
  async function resolveAmazonAsin(directUrl, productId = null, storage = null, fetchFn = null) {
    if (productId) {
      if (memoryAsinCache.has(productId)) return memoryAsinCache.get(productId);
      const cached = getCachedAsin(productId, storage);
      if (cached) {
        memoryAsinCache.set(productId, cached);
        return cached;
      }
    }

    const inlineAsin = parseAmazonAsin(directUrl);
    if (inlineAsin) {
      if (productId) {
        memoryAsinCache.set(productId, inlineAsin);
        setCachedAsin(productId, inlineAsin, storage);
      }
      return inlineAsin;
    }

    if (!directUrl || typeof directUrl !== 'string') return null;
    const target = directUrl.startsWith('http')
      ? directUrl
      : `${(typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch'}${directUrl}`;

    try {
      const urlObj = new URL(target);
      const host = urlObj.hostname.toLowerCase();
      const isToppreise = host === 'toppreise.ch' || host.endsWith('.toppreise.ch');
      const isAmazon = host === 'amazon.de' || host.endsWith('.amazon.de') || host === 'amazon.com' || host.endsWith('.amazon.com');
      if (!isToppreise && !isAmazon) return null;
    } catch {
      return null;
    }

    if (fetchFn) {
      try {
        const res = await fetchFn(target);
        const asin = parseAmazonAsin(res?.url || res?.location || (typeof res === 'string' ? res : ''));
        if (asin && productId) {
          memoryAsinCache.set(productId, asin);
          setCachedAsin(productId, asin, storage);
        }
        return asin || null;
      } catch {
        return null;
      }
    }

    return new Promise(resolve => {
      try {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
          GM_xmlhttpRequest({
            method: 'HEAD',
            url: target,
            headers: { 'Referer': (typeof location !== 'undefined' && location.href) ? location.href : 'https://www.toppreise.ch/' },
            timeout: 6000,
            onload: res => {
              const loc = res.finalUrl || res.responseHeaders?.match(/(?:^|\r?\n)location:\s*([^\r\n]+)/i)?.[1] || '';
              const asin = parseAmazonAsin(loc);
              if (asin && productId) {
                memoryAsinCache.set(productId, asin);
                setCachedAsin(productId, asin, storage);
              }
              resolve(asin || null);
            },
            onerror: () => resolve(null),
            ontimeout: () => resolve(null)
          });
        } else if (typeof fetch !== 'undefined') {
          fetch(target, { method: 'HEAD', redirect: 'follow' })
            .then(res => {
              const asin = parseAmazonAsin(res.url);
              if (asin && productId) {
                memoryAsinCache.set(productId, asin);
                setCachedAsin(productId, asin, storage);
              }
              resolve(asin || null);
            })
            .catch(() => resolve(null));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
  }

  // ─── MODULE: src/features/category-tree.js ──────────────────────────────────
  /**
   * Category Tree & Sidebar Expansion Feature
   * Loads native category hierarchy (c_cm_data_de / /plugins/category/categorymenu),
   * provides in-sidebar fan-out (▸/▾) for #Plugin_CategoryMainSelectionLeft,
   * instant subcategory search, and lazy hydration of native ✕/＋ exclusion tokens.
   */



  const IDENT_STORAGE_KEY = 'tp_vcat_ident_v1';
  const EXPANDED_STORAGE_KEY = 'tp_cat_expanded_branches';

  // Memory cache for the indexed category tree
  let treeIndex = null;
  let treeLoadingPromise = null;

  function getStoredIdents() {
    try {
      const raw = localStorage.getItem(IDENT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveStoredIdents(map) {
    try {
      localStorage.setItem(IDENT_STORAGE_KEY, JSON.stringify(map));
    } catch {}
  }

  function getExpandedBranches() {
    try {
      const raw = sessionStorage.getItem(EXPANDED_STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }

  function saveExpandedBranches(set) {
    try {
      sessionStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }

  function toFeedUrl(catalogUrl, currentFeedPath = '') {
    if (!catalogUrl || typeof catalogUrl !== 'string') return '/neue-toppreise';
    const trimmed = catalogUrl.trim();
    if (!/^\/(?!\/)/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
      return '/neue-toppreise';
    }
    const prefix = currentFeedPath && /(?:new-best-prices|nouveaux-meilleurs-prix)/i.test(currentFeedPath)
      ? currentFeedPath.match(/^\/(?:new-best-prices|nouveaux-meilleurs-prix)/i)[0]
      : '/neue-toppreise';
    return trimmed.replace(/^\/(?:produktsuche|katalog|productsearch|recherche-produits)/i, prefix);
  }

  const ENTITY_MAP = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ouml: 'ö', Ouml: 'Ö', auml: 'ä', Auml: 'Ä', uuml: 'ü', Uuml: 'Ü',
    eacute: 'é', Eacute: 'É', egrave: 'è', Egrave: 'È', ecirc: 'ê', Ecirc: 'Ê',
    agrave: 'à', Agrave: 'À', acirc: 'â', Acirc: 'Â', ccedil: 'ç', Ccedil: 'Ç',
    icirc: 'î', Icirc: 'Î', iuml: 'ï', Iuml: 'Ï',
    ocirc: 'ô', Ocirc: 'Ô',
    ucirc: 'û', Ucirc: 'Û', ugrave: 'ù', Ugrave: 'Ù',
    szlig: 'ß', deg: '°', euro: '€', copy: '©', reg: '®'
  };

  function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string' || !str.includes('&')) return str || '';
    return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        const code = parseInt(entity.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (entity.startsWith('#')) {
        const code = parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITY_MAP[entity] ?? match;
    });
  }

  function indexCategoryData(categories) {
    const byId = new Map();
    const childrenOf = new Map(); // parentID -> array of nodes
    const allNodes = [];

    const visit = (node, parentId = '') => {
      if (!node || !node.id) return;
      const cleanId = String(node.id).trim();
      if (byId.has(cleanId)) return;

      const pid = parentId || String(node.parentID || '').trim() || 'root';
      const entry = {
        id: cleanId,
        numericId: cleanId.replace(/^c/i, ''),
        parentID: pid,
        title: decodeHtmlEntities(node.title || ''),
        url: node.url || '',
        hasChildren: !!node.hasChildren || (Array.isArray(node.children) && node.children.length > 0)
      };
      byId.set(cleanId, entry);
      allNodes.push(entry);
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid).push(entry);

      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          visit(child, cleanId);
        }
      }
    };

    if (Array.isArray(categories)) {
      for (const item of categories) visit(item, String(item.parentID || '').trim());
    }

    // Build breadcrumbs for search
    for (const node of allNodes) {
      const parts = [node.title];
      let curr = node;
      while (curr && curr.parentID && curr.parentID !== 'root' && curr.parentID !== 'start') {
        const p = byId.get(curr.parentID);
        if (p && p.title) {
          parts.unshift(p.title);
          curr = p;
        } else {
          break;
        }
      }
      node.breadcrumb = parts.join(' › ');
    }

    return { byId, childrenOf, allNodes };
  }

  async function loadNativeCategoryTree(doc = (typeof document !== 'undefined' ? document : null)) {
    if (treeIndex) return treeIndex;
    if (treeLoadingPromise) return treeLoadingPromise;

    treeLoadingPromise = (async () => {
      try {
        const menuEl = doc?.querySelector?.('.Plugin_CategoryMenu');
        const lang = menuEl?.getAttribute('data-lang') || 'de';
        const hash = menuEl?.getAttribute('data-hash') || '';

        // Check native Toppreise localStorage cache
        const cachedHash = localStorage.getItem(`c_cm_hash_${lang}`);
        const cachedDataRaw = localStorage.getItem(`c_cm_data_${lang}`);
        if (cachedDataRaw && (!hash || cachedHash === hash)) {
          try {
            const parsed = JSON.parse(cachedDataRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              treeIndex = indexCategoryData(parsed);
              return treeIndex;
            }
          } catch {}
        }

        // Fetch from native endpoint if element exists
        if (menuEl && typeof fetch === 'function') {
          const ajaxUrl = menuEl.getAttribute('data-ajax-url') || '/plugins/category/categorymenu';
          const contextHash = menuEl.getAttribute('data-context-hash') || '';
          const body = new URLSearchParams({
            c_cm_ch: contextHash,
            c_cm_la: lang,
            lang
          });
          const resp = await fetch(ajaxUrl, {
            method: 'POST',
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: body.toString()
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json?.categories) {
              try {
                localStorage.setItem(`c_cm_data_${lang}`, JSON.stringify(json.categories));
                if (json.hash) localStorage.setItem(`c_cm_hash_${lang}`, json.hash);
              } catch {}
              treeIndex = indexCategoryData(json.categories);
              return treeIndex;
            }
          }
        }
      } catch (err) {
        // Graceful fallback: return empty index
      }
      treeIndex = indexCategoryData([]);
      return treeIndex;
    })();

    return treeLoadingPromise;
  }

  function hasIgnoredAncestor(node, tree, ignoredIds) {
    if (!node || !tree?.byId || !ignoredIds) return false;
    const ignoredSet = (ignoredIds instanceof Set) ? ignoredIds : new Set(ignoredIds);
    if (ignoredSet.size === 0) return false;

    let curr = node;
    let depth = 0;
    while (curr && curr.parentID && curr.parentID !== 'root' && curr.parentID !== 'start' && depth < 20) {
      depth++;
      const pid = String(curr.parentID).trim();
      const parentNode = tree.byId.get(pid) ||
                         tree.byId.get(`c${pid}`) ||
                         tree.byId.get(pid.replace(/^c/i, ''));
      if (!parentNode) break;

      const parentNumeric = String(parentNode.numericId || parentNode.id.replace(/^c/i, '')).trim();
      const parentId = String(parentNode.id).trim();

      if (ignoredSet.has(parentNumeric) || ignoredSet.has(parentId) || ignoredSet.has(`c${parentNumeric}`)) {
        return true;
      }
      curr = parentNode;
    }
    return false;
  }

  function searchCategoryTree(tree, query, maxResults = 12, ignoredIds = null) {
    if (!tree || !query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const results = [];
    const hasIgnoredFilter = ignoredIds && ((ignoredIds instanceof Set && ignoredIds.size > 0) || (Array.isArray(ignoredIds) && ignoredIds.length > 0));

    for (const node of tree.allNodes) {
      if (!node.title || node.id === 'start' || node.id === 'root') continue;
      if (hasIgnoredFilter && hasIgnoredAncestor(node, tree, ignoredIds)) continue;

      const titleLower = node.title.toLowerCase();
      const urlLower = node.url.toLowerCase();
      if (titleLower.includes(q) || urlLower.includes(q)) {
        results.push(node);
        if (results.length >= maxResults) break;
      }
    }
    return results;
  }

  function parseCategoryIdentsFromText(text, targetMap = null) {
    const map = targetMap || getStoredIdents();
    if (!text) return map;

    let content = text;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') content = parsed;
      else if (parsed && typeof parsed === 'object') {
        content = parsed.html || parsed.content || parsed.menu || text;
      }
    } catch {}

    const regex = /(?:data-vcat-id=\\?["'\\]*(\d+)\\?["'\\]*[^>]*?data-ident=\\?["'\\]*([^"'\\\s>]+)\\?["'\\]*|data-ident=\\?["'\\]*([^"'\\\s>]+)\\?["'\\]*[^>]*?data-vcat-id=\\?["'\\]*(\d+)\\?["'\\]*)/gi;
    let match;
    let changed = false;
    while ((match = regex.exec(content)) !== null) {
      const vid = match[1] || match[4];
      const idn = match[2] || match[3];
      if (vid && idn && map[vid] !== idn) {
        map[vid] = idn;
        changed = true;
      }
    }
    if (changed) saveStoredIdents(map);
    return map;
  }

  async function hydrateBranchIdents(feedUrl, branchEl) {
    if (!feedUrl || typeof fetch !== 'function') return;
    try {
      const resp = await fetch(feedUrl, { credentials: 'same-origin' });
      if (!resp.ok) return;
      const html = await resp.text();
      const stored = parseCategoryIdentsFromText(html);

      // Update rendered spans in this branch if present
      if (branchEl) {
        branchEl.querySelectorAll?.('.ignoreCategory[data-vcat-id]').forEach(span => {
          const vcatId = span.getAttribute('data-vcat-id');
          if (vcatId && stored[vcatId] && !span.getAttribute('data-ident')) {
            span.setAttribute('data-ident', stored[vcatId]);
          }
        });
      }
    } catch {}
  }

  function harvestExistingIdents(sidebar = (typeof document !== 'undefined' ? document?.querySelector?.('.Plugin_CategoryMainSelectionLeft') : null)) {
    const doc = sidebar?.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const searchRoot = doc?.querySelectorAll ? doc : (sidebar?.querySelectorAll ? sidebar : null);
    if (!searchRoot?.querySelectorAll) return;
    const triggers = searchRoot.querySelectorAll('.ignoreCategory[data-vcat-id][data-ident], .Plugin_IgnoredCategories .ignoredCategory[data-vcat-id][data-ident], .ignoredCategory[data-vcat-id][data-ident]');
    if (triggers.length === 0) return;
    const stored = getStoredIdents();
    let changed = false;
    triggers.forEach(tr => {
      const vcatId = tr.getAttribute('data-vcat-id');
      const ident = tr.getAttribute('data-ident');
      if (vcatId && ident && stored[vcatId] !== ident) {
        stored[vcatId] = ident;
        changed = true;
      }
    });
    if (changed) saveStoredIdents(stored);
  }

  function isCategoryIgnored(li) {
    if (!li) return false;
    if (li.classList?.contains?.('ignoredCategoryEntry')) return true;
    const row = li.querySelector?.(':scope > .tp-cat-row') || li.firstElementChild || li;
    const showBtn = row?.querySelector?.('.f_IgnoredCategories_Show') ||
                    row?.querySelector?.('.ignoreCategory i.TPIcons-plus');
    return !!(showBtn && (!showBtn.closest || showBtn.closest('li') === li));
  }

  function getIgnoredVcatIds(doc = (typeof document !== 'undefined' ? document : null)) {
    const set = new Set();
    const activeDoc = getDoc(doc);
    if (!activeDoc?.querySelectorAll) return set;
    const chips = activeDoc.querySelectorAll('.Plugin_IgnoredCategories .ignoredCategory[data-vcat-id]');
    chips.forEach(chip => {
      const vcatId = chip.getAttribute('data-vcat-id');
      if (vcatId) set.add(String(vcatId).trim());
    });
    return set;
  }

  function getDoc(doc = null) {
    if (doc) return doc;
    if (typeof document !== 'undefined') return document;
    if (typeof globalThis !== 'undefined' && globalThis.document) return globalThis.document;
    return null;
  }

  function updateIgnoredCategoriesBarWithServerHtml(html, bar, doc = null) {
    if (!html || !bar) return;
    const activeDoc = getDoc(doc || bar.ownerDocument);
    parseCategoryIdentsFromText(html);
    try {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(html, 'text/html');
        const newBar = parsed.querySelector('.Plugin_IgnoredCategories');
        const newContainer = parsed.querySelector('.ignoredCategoriesBar');
        if (newBar) {
          const chipCount = newBar.querySelectorAll('.ignoredCategory').length;
          newBar.setAttribute('data-ignored-count', String(chipCount));
          bar.replaceWith(newBar);
          harvestExistingIdents(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft') || newBar);
          syncCategoryTreeIgnoredState(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft'));
        } else if (newContainer) {
          const curContainer = bar.querySelector('.ignoredCategoriesBar');
          if (curContainer) {
            curContainer.replaceWith(newContainer);
          } else {
            bar.appendChild(newContainer);
          }
          const chipCount = bar.querySelectorAll('.ignoredCategory').length;
          bar.setAttribute('data-ignored-count', String(chipCount));
          harvestExistingIdents(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft') || bar);
          syncCategoryTreeIgnoredState(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft'));
        }
      }
    } catch {}
  }

  async function refreshProductFeed(doc = (typeof document !== 'undefined' ? document : null)) {
    if (typeof location === 'undefined' || !/toppreise\.ch$/i.test(location.hostname || '')) return;
    const activeDoc = getDoc(doc);
    const container = activeDoc?.querySelector?.('.Plugin_TopPriceReductionProductListFull') ||
                      activeDoc?.querySelector?.('.standardList');
    if (!container || typeof fetch !== 'function') return;

    try {
      const resp = await fetch(location.href, { credentials: 'same-origin', cache: 'no-cache' });
      if (!resp.ok) return;
      const html = await resp.text();
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const parsedDoc = parser.parseFromString(html, 'text/html');
        const newContainer = parsedDoc.querySelector('.Plugin_TopPriceReductionProductListFull') ||
                             parsedDoc.querySelector('.standardList');
        if (newContainer && container) {
          container.innerHTML = newContainer.innerHTML;
          triggerProcessListings();
        }
      }
    } catch (err) {
      console.error('[Toppreise-Suite] Feed refresh error:', err);
    }
  }

  async function ensureCategoryIdent(item, tree = null, currentPath = '', doc = null) {
    if (!item) return '';
    const vcatId = String(item.numericId || item.vcatId || '').trim();
    if (!vcatId) return '';
    if (item.ident) return item.ident;

    const stored = getStoredIdents();
    if (stored[vcatId]) {
      item.ident = stored[vcatId];
      return item.ident;
    }

    const activeDoc = getDoc(doc);
    // Check active DOM first (chips, sidebar triggers, open menus)
    const domToken = activeDoc?.querySelector?.(`[data-vcat-id="${vcatId}"][data-ident]`)?.getAttribute?.('data-ident');
    if (domToken) {
      stored[vcatId] = domToken;
      saveStoredIdents(stored);
      item.ident = domToken;
      return item.ident;
    }

    if (!tree) {
      tree = await loadNativeCategoryTree(activeDoc);
    }
    if (!tree?.byId) return '';

    const catId = item.id || `c${vcatId}`;
    const node = tree.byId.get(catId) || tree.byId.get(vcatId) || tree.byId.get(`c${vcatId}`);
    if (!node) return '';

    // Helper to query /plugins/filter/IgnoredCategories with product ID (aicatpr)
    const fetchMenuIdents = async (pid) => {
      if (!pid || typeof fetch !== 'function') return false;
      const bar = activeDoc?.querySelector?.('.Plugin_IgnoredCategories');
      const ajaxUrl = bar?.getAttribute?.('data-ajax-url') || '/plugins/filter/IgnoredCategories';
      const menuEl = activeDoc?.querySelector?.('.Plugin_CategoryMenu');
      const lang = menuEl?.getAttribute?.('data-lang') || 'de';
      const contextHash = bar?.getAttribute?.('data-context-hash') ||
                          activeDoc?.querySelector?.('[data-context-hash]')?.getAttribute?.('data-context-hash') || '';

      const body = new URLSearchParams({
        aicatpr: pid,
        fp_ic_ch: contextHash,
        f_ic_ch: contextHash,
        p_ic_ch: contextHash,
        ic_ch: contextHash,
        lang
      });

      try {
        const resp = await fetch(ajaxUrl, {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': '*/*'
          },
          credentials: 'same-origin',
          body: body.toString()
        });
        if (resp.ok) {
          const text = await resp.text();
          const updatedStored = parseCategoryIdentsFromText(text);
          return !!updatedStored[vcatId];
        }
      } catch {}
      return false;
    };

    // 1. Check in-page cards for matching category slug
    const slug = node.url ? (node.url.split('/').pop()?.replace(/-c\d+$/, '') || '') : '';
    if (slug && activeDoc?.querySelectorAll) {
      const matchingCard = activeDoc.querySelector(`.Plugin_Product[href*="/${slug}/"]`);
      if (matchingCard) {
        const pid = matchingCard.getAttribute('data-entity-id') ||
                    (matchingCard.getAttribute('href') || '').match(/-p(\d+)/)?.[1] || '';
        if (pid) {
          await fetchMenuIdents(pid);
          const updatedStored = getStoredIdents();
          if (updatedStored[vcatId]) {
            item.ident = updatedStored[vcatId];
            return item.ident;
          }
        }
      }
    }

    // 2. Candidate URLs (catalog, feeds, siblings and ancestors)
    const candidateUrls = [];
    if (node.url) {
      candidateUrls.push(toFeedUrl(node.url, currentPath));
      candidateUrls.push(node.url);
    }

    // Sibling feed URL: on any sibling's feed page, Toppreise renders node's ident in sidebar
    if (node.parentID && tree.childrenOf?.has(node.parentID)) {
      const siblings = tree.childrenOf.get(node.parentID) || [];
      for (const sib of siblings) {
        if (sib.id !== node.id && sib.url) {
          candidateUrls.push(toFeedUrl(sib.url, currentPath));
          break;
        }
      }
    }

    // First child URL if intermediate node
    if (node.hasChildren && tree.childrenOf?.has(node.id)) {
      const firstChild = tree.childrenOf.get(node.id)?.[0];
      if (firstChild?.url) {
        candidateUrls.push(firstChild.url);
        candidateUrls.push(toFeedUrl(firstChild.url, currentPath));
      }
    }

    let curr = node;
    let depth = 0;
    while (curr && curr.parentID && curr.parentID !== 'root' && curr.parentID !== 'start' && depth < 10) {
      depth++;
      const pid = String(curr.parentID).trim();
      const parentNode = tree.byId.get(pid) ||
                         tree.byId.get(`c${pid}`) ||
                         tree.byId.get(pid.replace(/^c/i, ''));
      if (parentNode?.url) {
        candidateUrls.push(toFeedUrl(parentNode.url, currentPath));
        candidateUrls.push(parentNode.url);
      }
      curr = parentNode;
    }

    if (candidateUrls.length === 0) {
      candidateUrls.push(currentPath || '/neue-toppreise');
    }

    const origin = (typeof location !== 'undefined' && location.origin && /^https?:/.test(location.origin))
      ? location.origin
      : 'https://www.toppreise.ch';

    for (const targetUrl of candidateUrls) {
      if (!targetUrl || typeof fetch !== 'function') continue;
      try {
        const fullUrl = targetUrl.startsWith('http') ? targetUrl : `${origin}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
        // Note: Do NOT send 'X-Requested-With' on full page GETs - Toppreise returns 403 Forbidden
        const resp = await fetch(fullUrl, {
          credentials: 'same-origin',
          headers: {
            'Accept': 'text/html, */*'
          }
        });
        if (resp.ok) {
          const text = await resp.text();
          const updatedStored = parseCategoryIdentsFromText(text);
          if (updatedStored[vcatId]) {
            item.ident = updatedStored[vcatId];
            return item.ident;
          }

          // Extract a product PID from the page
          const pidMatch = text.match(/(?:data-entity-id="(\d+)"|href="[^"]*?-p(\d+)")/);
          const discoveredPid = pidMatch ? (pidMatch[1] || pidMatch[2]) : '';
          if (discoveredPid) {
            await fetchMenuIdents(discoveredPid);
            const finalStored = getStoredIdents();
            if (finalStored[vcatId]) {
              item.ident = finalStored[vcatId];
              return item.ident;
            }
          }
        }
      } catch {}
    }

    return item.ident || '';
  }

  async function executeServerCategoryExclusion(vcatId, initialIdent = '', doc = (typeof document !== 'undefined' ? document : null)) {
    if (typeof location === 'undefined' || !/toppreise\.ch$/i.test(location.hostname || '')) return true;

    const activeDoc = getDoc(doc);
    const bar = activeDoc?.querySelector?.('.Plugin_IgnoredCategories');
    const ajaxUrl = bar?.getAttribute?.('data-ajax-url') || '/plugins/filter/IgnoredCategories';
    const menuEl = activeDoc?.querySelector?.('.Plugin_CategoryMenu');
    const lang = menuEl?.getAttribute?.('data-lang') || 'de';
    const contextHash = bar?.getAttribute?.('data-context-hash') ||
                        activeDoc?.querySelector?.('[data-context-hash]')?.getAttribute?.('data-context-hash') || '';

    if (typeof fetch !== 'function' || !ajaxUrl) return false;

    const currentPath = typeof location !== 'undefined' ? location.pathname : '';
    let ident = initialIdent || getStoredIdents()[vcatId] || '';
    if (!ident) {
      const tree = await loadNativeCategoryTree(activeDoc);
      ident = await ensureCategoryIdent({ numericId: vcatId, vcatId, ident }, tree, currentPath, activeDoc);
    }

    if (!ident) {
      console.info('[Toppreise-Suite] aicat token unavailable on server for category', vcatId);
      showToast('Kategorie-Token konnte nicht geladen werden');
      return false;
    }

    const body = new URLSearchParams({
      lang,
      aicat: ident,
      aicatvc: vcatId,
      fp_ic_ch: contextHash
    });

    try {
      const resp = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        credentials: 'same-origin',
        body: body.toString()
      });
      if (resp.ok) {
        const html = await resp.text();
        const match = html.match(/data-context-hash="([^"]+)"/);
        if (match && match[1] && bar) {
          bar.setAttribute('data-context-hash', match[1]);
        }
        if (html.includes('Plugin_IgnoredCategories') || html.includes('ignoredCategoriesBar') || html.includes('ignoredCategory')) {
          updateIgnoredCategoriesBarWithServerHtml(html, bar, activeDoc);
        }
        await refreshProductFeed(activeDoc);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.error('[Toppreise-Suite] Category exclusion error:', err);
      return false;
    }
  }

  async function executeServerCategoryRestore(vcatId, initialIdent = '', doc = (typeof document !== 'undefined' ? document : null)) {
    if (typeof location === 'undefined' || !/toppreise\.ch$/i.test(location.hostname || '')) return true;

    const activeDoc = getDoc(doc);
    const bar = activeDoc?.querySelector?.('.Plugin_IgnoredCategories');
    const ajaxUrl = bar?.getAttribute?.('data-ajax-url') || '/plugins/filter/IgnoredCategories';
    const menuEl = activeDoc?.querySelector?.('.Plugin_CategoryMenu');
    const lang = menuEl?.getAttribute?.('data-lang') || 'de';
    const contextHash = bar?.getAttribute?.('data-context-hash') ||
                        activeDoc?.querySelector?.('[data-context-hash]')?.getAttribute?.('data-context-hash') || '';

    if (typeof fetch !== 'function' || !ajaxUrl) return false;

    const currentPath = typeof location !== 'undefined' ? location.pathname : '';
    let ident = initialIdent ||
                activeDoc?.querySelector?.(`.Plugin_IgnoredCategories .ignoredCategory[data-vcat-id="${vcatId}"]`)?.getAttribute?.('data-ident') ||
                getStoredIdents()[vcatId] || '';

    if (!ident) {
      const tree = await loadNativeCategoryTree(activeDoc);
      ident = await ensureCategoryIdent({ numericId: vcatId, vcatId, ident }, tree, currentPath, activeDoc);
    }

    if (!ident) {
      console.info('[Toppreise-Suite] aicat token unavailable on server for restoring category', vcatId);
      showToast('Kategorie-Token konnte nicht geladen werden');
      return false;
    }

    const body = new URLSearchParams({
      lang,
      aicat: ident,
      aicatvc: vcatId,
      fp_ic_ch: contextHash
    });

    try {
      const resp = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        credentials: 'same-origin',
        body: body.toString()
      });
      if (resp.ok) {
        const html = await resp.text();
        const match = html.match(/data-context-hash="([^"]+)"/);
        if (match && match[1] && bar) {
          bar.setAttribute('data-context-hash', match[1]);
        }
        if (html.includes('Plugin_IgnoredCategories') || html.includes('ignoredCategoriesBar') || html.includes('ignoredCategory') || html.includes('ignoreCategoryHint')) {
          updateIgnoredCategoriesBarWithServerHtml(html, bar, activeDoc);
        }
        await refreshProductFeed(activeDoc);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Toppreise-Suite] Category restore error:', err);
      return false;
    }
  }

  async function executeServerCategoryReset(doc = (typeof document !== 'undefined' ? document : null)) {
    if (typeof location === 'undefined' || !/toppreise\.ch$/i.test(location.hostname || '')) return true;

    const activeDoc = getDoc(doc);
    const bar = activeDoc?.querySelector?.('.Plugin_IgnoredCategories');
    const ajaxUrl = bar?.getAttribute?.('data-ajax-url') || '/plugins/filter/IgnoredCategories';
    const menuEl = activeDoc?.querySelector?.('.Plugin_CategoryMenu');
    const lang = menuEl?.getAttribute?.('data-lang') || 'de';
    const contextHash = bar?.getAttribute?.('data-context-hash') ||
                        activeDoc?.querySelector?.('[data-context-hash]')?.getAttribute?.('data-context-hash') || '';

    if (typeof fetch !== 'function' || !ajaxUrl) return false;

    const resetIdent = activeDoc?.querySelector?.('.f_IgnoredCategories_ResetConfirm[data-ident], .f_IgnoredCategories_Reset[data-ident]')?.getAttribute?.('data-ident') || 'all';

    const body = new URLSearchParams({
      aicatrs: resetIdent,
      fp_ic_ch: contextHash,
      f_ic_ch: contextHash,
      p_ic_ch: contextHash,
      ic_ch: contextHash,
      lang
    });

    try {
      const resp = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        credentials: 'same-origin',
        body: body.toString()
      });
      if (resp.ok) {
        const html = await resp.text();
        const match = html.match(/data-context-hash="([^"]+)"/);
        if (match && match[1] && bar) {
          bar.setAttribute('data-context-hash', match[1]);
        }
        if (html.includes('Plugin_IgnoredCategories') || html.includes('ignoredCategoriesBar') || html.includes('ignoreCategoryHint')) {
          updateIgnoredCategoriesBarWithServerHtml(html, bar, activeDoc);
        }
        await refreshProductFeed(activeDoc);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Toppreise-Suite] Category reset error:', err);
      return false;
    }
  }

  function syncSearchResultsIgnoredState(resultsBox, doc = null) {
    if (!resultsBox?.querySelectorAll) return;
    const activeDoc = getDoc(doc || resultsBox?.ownerDocument);
    const ignoredIds = getIgnoredVcatIds(activeDoc);

    resultsBox.querySelectorAll('.tp-cat-result-item[data-vcat-id]').forEach(item => {
      const vcatId = item.getAttribute('data-vcat-id');
      if (!vcatId) return;

      const isIgnored = ignoredIds.has(String(vcatId).trim());
      const span = item.querySelector('.ignoreCategory[data-vcat-id]');
      if (!span) return;

      if (isIgnored) {
        item.classList.add('ignoredCategoryEntry');
        span.classList.remove('f_IgnoredCategories_Hide');
        span.classList.add('f_IgnoredCategories_Show');
        span.setAttribute('title', 'Kategorie einblenden');
        const icon = span.querySelector('i');
        if (icon) icon.className = 'TPIcons-plus';
      } else {
        item.classList.remove('ignoredCategoryEntry');
        span.classList.remove('f_IgnoredCategories_Show');
        span.classList.add('f_IgnoredCategories_Hide');
        span.setAttribute('title', 'Kategorie ausblenden');
        const icon = span.querySelector('i');
        if (icon) icon.className = 'TPIcons-cross';
      }
    });
  }

  function syncCategoryTreeIgnoredState(sidebar = (typeof document !== 'undefined' ? document?.querySelector?.('.Plugin_CategoryMainSelectionLeft') : null)) {
    if (!sidebar?.querySelectorAll) return;
    const doc = sidebar.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const ignoredIds = getIgnoredVcatIds(doc);

    sidebar.querySelectorAll('li.tp-cat-node').forEach(li => {
      const row = li.querySelector?.(':scope > .tp-cat-row') || li.firstElementChild || li;
      const span = row?.querySelector?.('.ignoreCategory[data-vcat-id]');
      if (!span || (span.closest && span.closest('li') !== li)) return;
      const vcatId = span.getAttribute('data-vcat-id');
      if (!vcatId) return;

      const isIgnored = ignoredIds.has(String(vcatId).trim());
      const toggle = row.querySelector?.('.tp-cat-toggle');

      if (isIgnored) {
        li.classList.add('ignoredCategoryEntry');
        span.classList.remove('f_IgnoredCategories_Hide');
        span.classList.add('f_IgnoredCategories_Show');
        span.setAttribute('title', 'Kategorie einblenden');
        const icon = span.querySelector('i');
        if (icon) {
          icon.className = 'TPIcons-plus';
        }
        if (toggle) {
          toggle.disabled = true;
          toggle.setAttribute('aria-disabled', 'true');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.textContent = '▸';
          li.querySelector(':scope > .tp-cat-sublist')?.remove();
        }
      } else {
        li.classList.remove('ignoredCategoryEntry');
        span.classList.remove('f_IgnoredCategories_Show');
        span.classList.add('f_IgnoredCategories_Hide');
        span.setAttribute('title', 'Kategorie ausblenden');
        const icon = span.querySelector('i');
        if (icon) {
          icon.className = 'TPIcons-cross';
        }
        if (toggle) {
          toggle.disabled = false;
          toggle.removeAttribute?.('aria-disabled');
        }
      }
    });

    const resultsBox = sidebar.querySelector('.tp-cat-search-results');
    if (resultsBox) {
      syncSearchResultsIgnoredState(resultsBox, doc);
    }
  }

  function renderChildList(children, parentEl, currentPath, expandedBranches) {
    let sublist = parentEl.querySelector(':scope > .tp-cat-sublist');
    if (sublist) {
      sublist.remove();
      return;
    }

    sublist = document.createElement('ul');
    sublist.className = 'tp-cat-sublist';
    const storedIdents = getStoredIdents();
    const doc = parentEl?.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const ignoredIds = getIgnoredVcatIds(doc);

    for (const child of children) {
      const li = document.createElement('li');
      li.className = 'category_level_sub tp-cat-item tp-cat-node';
      li.dataset.catId = child.id;

      const isIgnored = !!(child.numericId && ignoredIds.has(String(child.numericId).trim()));
      if (isIgnored) {
        li.classList.add('ignoredCategoryEntry');
      }

      const row = document.createElement('div');
      row.className = 'tp-cat-row';

      const feedUrl = toFeedUrl(child.url, currentPath);

      // Expand toggle if child has subchildren
      if (child.hasChildren) {
        const toggle = document.createElement('button');
        toggle.className = 'tp-cat-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '▸';
        toggle.title = 'Unterkategorien anzeigen';
        if (isIgnored) {
          toggle.disabled = true;
          toggle.setAttribute('aria-disabled', 'true');
        }
        toggle.onclick = async e => {
          e.preventDefault();
          e.stopPropagation();
          const tree = await loadNativeCategoryTree();
          const subChildren = tree.childrenOf.get(child.id) || [];
          const isExp = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', String(!isExp));
          toggle.textContent = isExp ? '▸' : '▾';
          if (isExp) {
            expandedBranches.delete(child.id);
            saveExpandedBranches(expandedBranches);
            li.querySelector(':scope > .tp-cat-sublist')?.remove();
          } else {
            expandedBranches.add(child.id);
            saveExpandedBranches(expandedBranches);
            renderChildList(subChildren, li, currentPath, expandedBranches);
            hydrateBranchIdents(feedUrl, li);
          }
        };
        row.appendChild(toggle);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'tp-cat-spacer';
        row.appendChild(spacer);
      }

      const a = document.createElement('a');
      a.href = feedUrl;
      a.textContent = child.title;
      a.title = child.title;
      row.appendChild(a);

      // Native mute/unmute button (empty <i> so icon font renders single cross or plus)
      if (child.numericId) {
        const span = document.createElement('span');
        span.className = `ignoreCategory ${isIgnored ? 'f_IgnoredCategories_Show' : 'f_IgnoredCategories_Hide'}`;
        span.setAttribute('data-vcat-id', child.numericId);
        const ident = storedIdents[child.numericId];
        if (ident) span.setAttribute('data-ident', ident);
        span.setAttribute('title', isIgnored ? 'Kategorie einblenden' : 'Kategorie ausblenden');
        const icon = document.createElement('i');
        icon.className = isIgnored ? 'TPIcons-plus' : 'TPIcons-cross';
        span.appendChild(icon);
        row.appendChild(span);
      }

      li.appendChild(row);
      sublist.appendChild(li);

      // Reopen if previously expanded in session (and not ignored)
      if (child.hasChildren && expandedBranches.has(child.id) && !isIgnored) {
        setTimeout(async () => {
          if (typeof document === 'undefined') return;
          const tree = await loadNativeCategoryTree();
          const subChildren = tree.childrenOf.get(child.id) || [];
          const toggle = row.querySelector('.tp-cat-toggle');
          if (toggle) {
            toggle.setAttribute('aria-expanded', 'true');
            toggle.textContent = '▾';
            renderChildList(subChildren, li, currentPath, expandedBranches);
          }
        }, 0);
      }
    }

    parentEl.appendChild(sublist);
  }

  function enhanceCategorySidebar() {
    if (!isNeueToppreisePage()) return;
    const sidebar = document.querySelector('.Plugin_CategoryMainSelectionLeft');
    if (!sidebar || sidebar.classList.contains('tp-tree-enhanced')) return;
    sidebar.classList.add('tp-tree-enhanced');

    // One-time cleanup of obsolete client persistence key if present
    try {
      localStorage.removeItem('tp_cat_ignored_subcategories');
    } catch {}

    harvestExistingIdents(sidebar);

    const currentPath = typeof location !== 'undefined' ? location.pathname : '';
    const expandedBranches = getExpandedBranches();

    // 1. Search Box
    const labelDiv = sidebar.querySelector('.label.bold');
    if (labelDiv) {
      const searchBox = document.createElement('div');
      searchBox.className = 'tp-cat-search-box';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'tp-cat-search-input';
      input.placeholder = '🔍 Kategorie suchen...';
      input.setAttribute('aria-label', 'Kategorie filtern');
      searchBox.appendChild(input);

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'tp-cat-search-clear';
      clearBtn.style.display = 'none';
      clearBtn.title = 'Suche leeren';
      clearBtn.textContent = '✕';
      searchBox.appendChild(clearBtn);

      const resultsBox = document.createElement('div');
      resultsBox.className = 'tp-cat-search-results';
      resultsBox.style.display = 'none';
      searchBox.appendChild(resultsBox);

      const ulList = sidebar.querySelector('ul');

      const renderSearchResults = async () => {
        const val = input.value.trim();
        clearBtn.style.display = val ? 'block' : 'none';

        if (!val) {
          resultsBox.style.display = 'none';
          if (ulList) ulList.style.display = '';
          return;
        }

        const storedIdents = getStoredIdents();
        const doc = sidebar.ownerDocument || (typeof document !== 'undefined' ? document : null);
        const ignoredIds = getIgnoredVcatIds(doc);

        const tree = await loadNativeCategoryTree();
        const hits = searchCategoryTree(tree, val, 15, ignoredIds);

        if (ulList) ulList.style.display = 'none';
        resultsBox.style.display = 'block';

        if (resultsBox.replaceChildren) {
          resultsBox.replaceChildren();
        } else {
          while (resultsBox.firstChild) resultsBox.removeChild(resultsBox.firstChild);
        }

        if (hits.length === 0) {
          const noRes = document.createElement('div');
          noRes.className = 'tp-cat-no-results';
          noRes.textContent = 'Keine Kategorie gefunden';
          resultsBox.appendChild(noRes);
          return;
        }

        const frag = document.createDocumentFragment ? document.createDocumentFragment() : document.createElement('div');
        for (const hit of hits) {
          const vcatId = String(hit.numericId || '').trim();
          const isIgnored = !!(vcatId && ignoredIds.has(vcatId));
          const ident = vcatId ? (storedIdents[vcatId] || '') : '';

          const item = document.createElement('div');
          item.className = `tp-cat-result-item${isIgnored ? ' ignoredCategoryEntry' : ''}`;
          if (hit.id) item.setAttribute('data-cat-id', hit.id);
          if (vcatId) item.setAttribute('data-vcat-id', vcatId);

          const link = document.createElement('a');
          link.className = 'tp-cat-result-link';
          link.href = toFeedUrl(hit.url, currentPath);
          if (hit.title) link.title = hit.title;

          const titleSpan = document.createElement('span');
          titleSpan.className = 'tp-cat-res-title';
          titleSpan.textContent = hit.title || '';

          const pathSpan = document.createElement('span');
          pathSpan.className = 'tp-cat-res-path';
          pathSpan.textContent = hit.breadcrumb || '';

          link.appendChild(titleSpan);
          link.appendChild(pathSpan);
          item.appendChild(link);

          if (vcatId) {
            const actionBtn = document.createElement('span');
            actionBtn.className = `ignoreCategory ${isIgnored ? 'f_IgnoredCategories_Show' : 'f_IgnoredCategories_Hide'}`;
            actionBtn.setAttribute('data-vcat-id', vcatId);
            if (ident) actionBtn.setAttribute('data-ident', ident);
            actionBtn.title = isIgnored ? 'Kategorie einblenden' : 'Kategorie ausblenden';

            const icon = document.createElement('i');
            icon.className = isIgnored ? 'TPIcons-plus' : 'TPIcons-cross';
            actionBtn.appendChild(icon);
            item.appendChild(actionBtn);
          }

          frag.appendChild(item);
        }
        resultsBox.appendChild(frag);
      };

      input.addEventListener('input', () => {
        renderSearchResults();
      });

      input.addEventListener('focus', () => {
        if (input.value.trim()) {
          renderSearchResults();
        }
      });

      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        resultsBox.style.display = 'none';
        if (ulList) ulList.style.display = '';
        input.focus();
      });

      labelDiv.after(searchBox);
    }

    // 2. Attach toggles to existing root li elements
    const rootLis = sidebar.querySelectorAll('ul > li');
    rootLis.forEach(li => {
      const link = li.querySelector('a[href]');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      const match = href.match(/-c(\d+)/i);
      const catId = match ? `c${match[1]}` : '';

      if (!catId) return;
      li.dataset.catId = catId;
      li.classList.add('tp-cat-node');

      // Wrap existing content in .tp-cat-row so nested .tp-cat-sublist renders below it
      let row = li.querySelector(':scope > .tp-cat-row') || li.querySelector('.tp-cat-row');
      if (!row) {
        row = document.createElement('div');
        row.className = 'tp-cat-row';
        while (li.firstChild) {
          row.appendChild(li.firstChild);
        }
        li.appendChild(row);
      }

      const toggle = document.createElement('button');
      toggle.className = 'tp-cat-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '▸';
      toggle.title = 'Unterkategorien anzeigen';

      toggle.onclick = async e => {
        e.preventDefault();
        e.stopPropagation();
        const tree = await loadNativeCategoryTree();
        const children = tree.childrenOf.get(catId) || [];
        const isExp = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!isExp));
        toggle.textContent = isExp ? '▸' : '▾';
        if (isExp) {
          expandedBranches.delete(catId);
          saveExpandedBranches(expandedBranches);
          li.querySelector(':scope > .tp-cat-sublist')?.remove();
        } else {
          expandedBranches.add(catId);
          saveExpandedBranches(expandedBranches);
          renderChildList(children, li, currentPath, expandedBranches);
          hydrateBranchIdents(link.href || href, li);
        }
      };

      if (isCategoryIgnored(li)) {
        toggle.disabled = true;
        toggle.setAttribute('aria-disabled', 'true');
      }

      row.prepend(toggle);

      // Auto-expand if active in session (and not ignored)
      if (expandedBranches.has(catId) && !isCategoryIgnored(li)) {
        setTimeout(async () => {
          if (typeof document === 'undefined') return;
          const tree = await loadNativeCategoryTree();
          const children = tree.childrenOf.get(catId) || [];
          toggle.setAttribute('aria-expanded', 'true');
          toggle.textContent = '▾';
          renderChildList(children, li, currentPath, expandedBranches);
        }, 0);
      }
    });

    // Align any pre-rendered ignored states in sidebar with active chips
    syncCategoryTreeIgnoredState(sidebar);

    // 3. MutationObserver on .Plugin_IgnoredCategories for dynamic sync
    if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
      const ignoredBar = document.querySelector('.Plugin_IgnoredCategories');
      if (ignoredBar) {
        const observer = new MutationObserver(() => {
          syncCategoryTreeIgnoredState(sidebar);
        });
        observer.observe(ignoredBar, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ignored-count'] });
      }
    }

    // 4. Listen for category hide/show/reset to collapse/restore tree branches and sync chips
    if (typeof document !== 'undefined' && document.body?.addEventListener) {
      const isLiveSite = typeof location !== 'undefined' && /toppreise\.ch$/i.test(location.hostname || '');

      document.body.addEventListener('click', async e => {
        const hideBtn = e.target?.closest?.('.f_IgnoredCategories_Hide');
        if (hideBtn) {
          const vcatId = hideBtn.getAttribute?.('data-vcat-id');
          if (!vcatId) return;

          const isSubOrSearch = !!hideBtn.closest?.('.tp-cat-sublist, .tp-cat-search-results, .category_level_sub');
          if (isLiveSite && isSubOrSearch) {
            e.preventDefault?.();
            e.stopPropagation?.();
            e.stopImmediatePropagation?.();
          }

          const cleanVcatId = String(vcatId).trim();
          const ident = hideBtn.getAttribute?.('data-ident') || getStoredIdents()[cleanVcatId] || '';
          const rowEl = hideBtn.closest?.('.tp-cat-row, .tp-cat-result-item') || hideBtn;

          if (isLiveSite && isSubOrSearch) {
            rowEl.classList?.add?.('tp-cat-loading');
            try {
              await executeServerCategoryExclusion(cleanVcatId, ident, document);
            } finally {
              rowEl.classList?.remove?.('tp-cat-loading');
            }
          }
          return;
        }

        const showBtn = e.target?.closest?.('.f_IgnoredCategories_Show');
        if (showBtn) {
          const vcatId = showBtn.getAttribute?.('data-vcat-id');
          if (!vcatId) return;

          const isSubOrSearch = !!showBtn.closest?.('.tp-cat-sublist, .tp-cat-search-results, .category_level_sub');
          if (isLiveSite && isSubOrSearch) {
            e.preventDefault?.();
            e.stopPropagation?.();
            e.stopImmediatePropagation?.();
          }

          const cleanVcatId = String(vcatId).trim();
          const ident = showBtn.getAttribute?.('data-ident') || getStoredIdents()[cleanVcatId] || '';
          const rowEl = showBtn.closest?.('.tp-cat-row, .tp-cat-result-item') || showBtn;

          if (isLiveSite && isSubOrSearch) {
            rowEl.classList?.add?.('tp-cat-loading');
            try {
              await executeServerCategoryRestore(cleanVcatId, ident, document);
            } finally {
              rowEl.classList?.remove?.('tp-cat-loading');
            }
          }
          return;
        }

        const resetBtn = e.target?.closest?.('.f_IgnoredCategories_Reset');
        if (resetBtn) {
          if (isLiveSite) {
            executeServerCategoryReset(document);
          }
        }
      }, { capture: true });
    }

    // 5. Observe native IgnoredCategoriesMenu to harvest authentic breadcrumb tokens
    if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
      const flyoutObserver = new MutationObserver(mutations => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              const menu = node.classList?.contains('IgnoredCategoriesMenu')
                ? node
                : node.querySelector?.('.IgnoredCategoriesMenu');
              if (menu) {
                parseCategoryIdentsFromText(menu.outerHTML);
              }
            }
          }
        }
      });
      flyoutObserver.observe(document.body, { childList: true, subtree: true });
    }
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
    const topPad = (opts && typeof opts.topPad === 'number') ? opts.topPad : 0;
    const valid = timeSeries.filter(p => Array.isArray(p) && +p[1] > 0);
    if (valid.length < 2) return null;
    const prices = valid.map(p => +p[1]);

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
      const margin = { left: 38, right: 10, top: 6 + topPad, bottom: 16 };
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
      const tsMs = valid.map(p => {
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
  function renderDiscordChart(timeSeries, width = 360, height = 100, title = '') {
    const topPad = title ? 22 : 0;
    const svg = renderSparkline(timeSeries, width, height, { axes: true, topPad });
    if (!svg) return null;
    const NS = 'http://www.w3.org/2000/svg';
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('rx', '8');
    bg.setAttribute('fill', '#f1f5f9');
    svg.insertBefore(bg, svg.firstChild);
    if (title) {
      const titleEl = document.createElementNS(NS, 'text');
      titleEl.setAttribute('x', '12');
      titleEl.setAttribute('y', '18');
      titleEl.setAttribute('fill', '#334155');
      titleEl.setAttribute('font-size', '12');
      titleEl.setAttribute('font-weight', '600');
      titleEl.setAttribute('font-family', 'inherit');
      const cleanTitle = String(title).replace(/\s+/g, ' ').trim();
      const maxChars = Math.max(10, Math.floor(width / 8));
      titleEl.textContent = cleanTitle.length > maxChars ? cleanTitle.slice(0, maxChars - 1) + '…' : cleanTitle;
      svg.appendChild(titleEl);
    }
    svg.querySelector('polyline')?.setAttribute('stroke-width', '2.5');
    return svg;
  }

  function buildKeepaUrl(asin, days = 365, width = 560, height = 220) {
    if (!asin || typeof asin !== 'string') return '';
    return `https://graph.keepa.com/pricehistory.png?asin=${encodeURIComponent(asin.trim())}&domain=de&amazon=1&new=1&bb=1&range=${days}&width=${width}&height=${height}`;
  }

  async function copySvgToClipboard(svgEl, width = 560, height = 220) {
    try {
      if (!svgEl || typeof document === 'undefined') return false;
      const svgText = new XMLSerializer().serializeToString(svgEl);
      const svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = svgUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(img, 0, 0, width * 2, height * 2);
      URL.revokeObjectURL(svgUrl);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      if (blob && typeof navigator?.clipboard?.write === 'function') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('📋 Diagramm in Zwischenablage kopiert');
        return true;
      }
    } catch (err) {
      console.debug('[Toppreise-Suite] SVG-Copy-Fehler', err);
    }
    showToast('❌ Kopieren fehlgeschlagen');
    return false;
  }

  async function copyKeepaChartToClipboard(imgEl, titleText, asin, fallbackUrl = '') {
    try {
      let sourceImg = imgEl;
      let objectUrl = null;
      if (typeof GM_xmlhttpRequest !== 'undefined' && fallbackUrl) {
        try {
          const blob = await new Promise((res, rej) => {
            GM_xmlhttpRequest({
              method: 'GET',
              url: fallbackUrl,
              responseType: 'blob',
              onload: r => r.response ? res(r.response) : rej(new Error('no blob')),
              onerror: rej,
              ontimeout: rej
            });
          });
          objectUrl = URL.createObjectURL(blob);
          const tempImg = new Image();
          await new Promise((res, rej) => {
            tempImg.onload = res;
            tempImg.onerror = rej;
            tempImg.src = objectUrl;
          });
          sourceImg = tempImg;
        } catch (e) {}
      }

      const w = sourceImg?.naturalWidth || 560;
      const h = sourceImg?.naturalHeight || 220;
      const bannerHeight = 36;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h + bannerHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, bannerHeight);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textBaseline = 'middle';
      const displayTitle = titleText ? `Amazon.de: ${titleText} (ASIN: ${asin})` : `Amazon.de: ASIN ${asin}`;
      ctx.fillText(displayTitle, 12, bannerHeight / 2, canvas.width - 24);

      if (sourceImg) {
        ctx.drawImage(sourceImg, 0, bannerHeight, w, h);
      }
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch {}
      }

      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      if (blob && typeof navigator?.clipboard?.write === 'function') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('📋 Amazon-Diagramm in Zwischenablage kopiert');
        return true;
      }
    } catch (err) {
      console.debug('[Toppreise-Suite] Keepa-Copy-Fehler', err);
      if (fallbackUrl && typeof navigator?.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(fallbackUrl);
        showToast('📋 Bild-Link kopiert');
        return true;
      }
    }
    showToast('❌ Kopieren fehlgeschlagen');
    return false;
  }

  let activePopoutCleanup = null;

  function closeSparklinePopout() {
    if (typeof document === 'undefined') return;
    if (activePopoutCleanup) { const fn = activePopoutCleanup; activePopoutCleanup = null; fn(); return; }
    document.getElementById('tp-sparkline-popout')?.remove();
  }

  // Click on a mini sparkline pops the full Discord-style chart. Backdrop/×/Esc closes.
  function openSparklinePopout(timeSeries, chartCtx = null) {
    if (typeof document === 'undefined') return null;
    closeSparklinePopout();
    const prevFocus = typeof document.activeElement !== 'undefined' ? document.activeElement : null;
    const productTitle = chartCtx?.title || '';
    const svg = renderDiscordChart(timeSeries, 560, 220, productTitle);
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
    panel.style.cssText = 'background:var(--tp-bg);border-radius:var(--tp-r-lg);padding:16px;max-width:min(608px,94vw);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);box-sizing:border-box;';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;flex-wrap:wrap;';
    const title = document.createElement('div');
    title.textContent = productTitle ? `📈 Preisverlauf: ${productTitle}` : '📈 Preisverlauf';
    title.style.cssText = 'color:var(--tp-txt-mid);font-size:var(--tp-fs-lg);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:380px;';
    if (productTitle) title.title = productTitle;

    const headerActions = document.createElement('div');
    headerActions.style.cssText = 'display:flex;align-items:center;gap:6px;';

    const copyTpBtn = document.createElement('button');
    copyTpBtn.type = 'button';
    copyTpBtn.textContent = '📋 Bild kopieren';
    copyTpBtn.setAttribute('title', 'Toppreise-Diagramm in Zwischenablage kopieren');
    copyTpBtn.style.cssText = 'background:var(--tp-bg-sub);border:1px solid var(--tp-bdr);border-radius:var(--tp-r-sm);color:var(--tp-txt-mid);font-size:12px;padding:3px 8px;cursor:pointer;';
    copyTpBtn.addEventListener('click', () => copySvgToClipboard(svg, 560, 220));

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Schliessen');
    closeBtn.style.cssText = 'background:transparent;border:0;color:var(--tp-mut);font-size:16px;cursor:pointer;padding:4px 8px;';
    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        close();
      }
    };
    function close() {
      document.removeEventListener('keydown', onKey);
      activePopoutCleanup = null;
      closeSparklinePopout();
      try { prevFocus?.focus?.(); } catch {}
    }
    activePopoutCleanup = close;
    document.addEventListener('keydown', onKey);
    closeBtn.addEventListener('click', close);
    headerActions.appendChild(copyTpBtn);
    headerActions.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(headerActions);
    panel.appendChild(header);
    panel.appendChild(svg);

    // Stacked Keepa section for Amazon deals
    const isAmazon = chartCtx?.dealer && /amazon/i.test(chartCtx.dealer) && CONFIG?.KEEPA_CHART_ENABLED !== false;
    if (isAmazon) {
      const keepaSection = document.createElement('div');
      keepaSection.id = 'tp-keepa-section';
      keepaSection.style.cssText = 'margin-top:16px;padding-top:14px;border-top:1px solid var(--tp-bdr);';

      const keepaHeader = document.createElement('div');
      keepaHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;flex-wrap:wrap;';

      const keepaTitle = document.createElement('div');
      keepaTitle.textContent = '🛒 Amazon.de Preisverlauf (Keepa)';
      keepaTitle.style.cssText = 'color:var(--tp-txt-mid);font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px;';

      const keepaToolbar = document.createElement('div');
      keepaToolbar.style.cssText = 'display:flex;align-items:center;gap:4px;';

      const ranges = [
        { label: '90T', days: 90 },
        { label: '180T', days: 180 },
        { label: '365T', days: 365, active: true },
        { label: 'Alle', days: 'all' }
      ];
      let currentDays = 365;
      const rangeBtns = [];

      const keepaBody = document.createElement('div');
      keepaBody.style.cssText = 'min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--tp-bg-sub);border-radius:var(--tp-r-sm);padding:8px;box-sizing:border-box;';

      const loadingIndicator = document.createElement('div');
      loadingIndicator.textContent = '⏳ Lade Amazon.de Keepa-Verlauf...';
      loadingIndicator.style.cssText = 'color:var(--tp-mut);font-size:12px;padding:24px 0;';
      keepaBody.appendChild(loadingIndicator);

      const copyKeepaBtn = document.createElement('button');
      copyKeepaBtn.type = 'button';
      copyKeepaBtn.textContent = '📋 Bild kopieren';
      copyKeepaBtn.style.cssText = 'background:var(--tp-bg-sub);border:1px solid var(--tp-bdr);border-radius:var(--tp-r-sm);color:var(--tp-txt-mid);font-size:12px;padding:3px 8px;cursor:pointer;display:none;';

      ranges.forEach(r => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = r.label;
        const setBtnStyle = active => {
          btn.style.cssText = `background:${active ? 'var(--tp-btn-primary, #3b82f6)' : 'transparent'};border:1px solid var(--tp-bdr);border-radius:var(--tp-r-sm);color:${active ? '#ffffff' : 'var(--tp-txt-mid)'};font-size:11px;padding:2px 6px;cursor:pointer;`;
        };
        setBtnStyle(!!r.active);
        btn.addEventListener('click', () => {
          currentDays = r.days;
          rangeBtns.forEach(b => b.setBtnStyle(b === btn));
          if (keepaBody._tpUpdateRange) keepaBody._tpUpdateRange(r.days);
        });
        btn.setBtnStyle = setBtnStyle;
        rangeBtns.push(btn);
        keepaToolbar.appendChild(btn);
      });
      keepaToolbar.appendChild(copyKeepaBtn);

      keepaHeader.appendChild(keepaTitle);
      keepaHeader.appendChild(keepaToolbar);
      keepaSection.appendChild(keepaHeader);
      keepaSection.appendChild(keepaBody);
      panel.appendChild(keepaSection);

      // Resolve ASIN and display Keepa image
      resolveAmazonAsin(chartCtx.directUrl, chartCtx.pid).then(asin => {
        if (!asin) {
          if (keepaBody.replaceChildren) {
            keepaBody.replaceChildren();
          } else {
            while (keepaBody.firstChild) keepaBody.removeChild(keepaBody.firstChild);
          }
          const errNotice = document.createElement('div');
          errNotice.style.cssText = 'color:var(--tp-mut);font-size:12px;padding:16px;text-align:center;';
          const msgSpan = document.createElement('span');
          msgSpan.textContent = 'Amazon-ASIN konnte nicht ermittelt werden.';
          errNotice.appendChild(msgSpan);
          errNotice.appendChild(document.createElement('br'));
          const safeUrl = /^https?:\/\//i.test(chartCtx.directUrl || '') ? chartCtx.directUrl : '#';
          const a = document.createElement('a');
          a.href = safeUrl;
          a.target = '_blank';
          a.rel = 'noopener';
          a.style.cssText = 'color:var(--tp-link,#3b82f6);text-decoration:underline;margin-top:6px;display:inline-block;';
          a.textContent = 'Zum Amazon-Angebot ↗';
          errNotice.appendChild(a);
          keepaBody.appendChild(errNotice);
          return;
        }

        keepaTitle.textContent = `🛒 Amazon.de: ${productTitle || asin} (ASIN: ${asin})`;
        copyKeepaBtn.style.display = 'inline-block';

        const keepaUrlFor = days => buildKeepaUrl(asin, days);

        const img = document.createElement('img');
        img.style.cssText = 'max-width:100%;height:auto;border-radius:4px;display:block;';
        img.alt = `Keepa Preisverlauf für ${asin}`;
        img.src = keepaUrlFor(currentDays);

        copyKeepaBtn.onclick = () => {
          copyKeepaChartToClipboard(img, productTitle, asin, keepaUrlFor(currentDays));
        };

        keepaBody._tpUpdateRange = days => {
          img.src = keepaUrlFor(days);
        };

        const linksRow = document.createElement('div');
        linksRow.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;width:100%;margin-top:6px;font-size:11px;';
        const keepaLink = document.createElement('a');
        keepaLink.href = `https://keepa.com/#!product/3-${asin}`;
        keepaLink.target = '_blank';
        keepaLink.rel = 'noopener';
        keepaLink.style.cssText = 'color:var(--tp-link, #3b82f6);text-decoration:none;';
        keepaLink.textContent = 'Auf Keepa ansehen ↗';
        const amzLink = document.createElement('a');
        const safeDirect = /^https?:\/\//i.test(chartCtx.directUrl || '') ? chartCtx.directUrl : null;
        amzLink.href = safeDirect || `https://www.amazon.de/dp/${asin}`;
        amzLink.target = '_blank';
        amzLink.rel = 'noopener';
        amzLink.style.cssText = 'color:var(--tp-link, #3b82f6);text-decoration:none;';
        amzLink.textContent = 'Auf Amazon.de ansehen ↗';
        linksRow.appendChild(keepaLink);
        linksRow.appendChild(amzLink);

        keepaBody.replaceChildren();
        keepaBody.appendChild(img);
        keepaBody.appendChild(linksRow);
      }).catch(() => {
        keepaBody.replaceChildren();
        const errNotice = document.createElement('div');
        errNotice.style.cssText = 'color:var(--tp-mut);font-size:12px;padding:16px;text-align:center;';
        errNotice.textContent = 'Amazon Keepa-Verlauf konnte nicht geladen werden.';
        keepaBody.appendChild(errNotice);
      });
    }

    backdrop.appendChild(panel);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    document.body.appendChild(backdrop);
    closeBtn.focus?.();
    return backdrop;
  }

  // ─── MODULE: src/features/discord-recipe.js ─────────────────────────────────
  /**
   * Discord Deal Recipe & Layout Formatter
   * Baukasten-Layout engine, tokens, and markdown preview rendering for Discord deal shares.
   */



  // Baukasten-Layout: je Zeile ein Baustein, Grösse via # / ## / -# am
  // Zeilenanfang. · blendet leere Nachbarn aus, +{offers} rendert kompakt +N (leer bei 0). {link} nur bei aktivem Embed.
  const DEFAULT_LAYOUT = '## {title}\n# {price}\n# {dealer} +{offers}\n{prevlow}\n{median}\n{ai}\n{link}';
  const LAYOUT_TOKENS = new Set(['title', 'price', 'dealer', 'offers', 'spark', 'prevlow', 'median', 'ai', 'link']);

  function validateLayoutRecipe(recipe) {
    const value = String(recipe ?? '');
    if (!value.trim()) return 'Layout ist leer';
    const unknown = [...new Set([...value.matchAll(/\{([^}]*)\}/g)].map(m => m[1]))].filter(n => !LAYOUT_TOKENS.has(n));
    return unknown.length ? `Unbekannte Tokens: ${unknown.map(n => `{${n}}`).join(', ')}` : null;
  }

  function getLayoutRecipeNotice(recipe) {
    const value = String(recipe ?? '');
    if (value.includes('{spark}')) {
      return '⚠️ {spark} ist veraltet: Preischart wird automatisch als Bild-Anhang angehängt.';
    }
    return null;
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
      } else {
        const quote = line.match(/^>\s?/);
        if (quote) {
          cls = 'tp-md-quote';
          line = line.slice(quote[0].length);
        }
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
  const cleanTitleOf = title => (title || 'Toppreise-Deal').replace(/\s+/g, ' ').trim().replace(/\[/g, '(').replace(/\]/g, ')');

  function escapeDiscordMarkdown(s) {
    return String(s ?? '').replace(/\\/g, '\\\\').replace(/[`*_~|>]/g, '\\$&');
  }

  function tokenText(name, ctx) {
    switch (name) {
      case 'title': return ctx.link ? `[${ctx.cleanTitle}](${ctx.titleTarget})` : ctx.cleanTitle;
      case 'price': return ctx.priceText ? `💰 ${ctx.priceText}` : '';
      case 'dealer': return ctx.dealer ? (ctx.dealerTarget ? `🏬 [${ctx.dealer}](${ctx.dealerTarget})` : `🏬 ${ctx.dealer}`) : '';
      case 'offers': return ctx.offerCount ? `🛒 ${ctx.offerCount} Angebote` : '';
      case 'prevlow': return ctx.prevLowText ? `📉 ${boldNumbers(withPct(ctx.prevLowText, ctx.prevLowPct))}` : '';
      case 'median': return ctx.medianText ? `📈 ${boldNumbers(withPct(ctx.medianText, ctx.medianPct))}` : '';
      case 'ai': return ctx.aiText ? `> 💡 ${ctx.aiText}` : '';
      case 'link': return (ctx.link && (!ctx.suppressProductEmbed || ctx.forceLink)) ? ctx.link : '';
      default: return '';
    }
  }

  function renderLayout(fields = {}, recipe = DEFAULT_LAYOUT) {
    recipe = String(recipe || '').replace(/\r/g, '');
    if (!recipe.trim()) recipe = DEFAULT_LAYOUT;
    const escapeUrlParens = u => String(u || '').replace(/\(/g, '%28').replace(/\)/g, '%29');
    const link = escapeUrlParens(((fields || {}).url || '').trim());
    const dealerUrl = escapeUrlParens((fields || {}).dealerUrl || '');
    const ctx = {
      cleanTitle: escapeDiscordMarkdown(cleanTitleOf((fields || {}).title)),
      link,
      titleTarget: link ? (((fields || {}).suppressProductEmbed && link) ? `<${link}>` : link) : '',
      priceText: (fields || {}).priceText || '',
      dealer: escapeDiscordMarkdown(String((fields || {}).dealer || '').replace(/\[/g, '(').replace(/\]/g, ')')),
      dealerTarget: dealerUrl ? ((fields || {}).suppressDealerEmbed ? `<${dealerUrl}>` : dealerUrl) : '',
      offerCount: (fields || {}).offerCount || 0,
      prevLowText: (fields || {}).prevLowText || '',
      prevLowPct: (fields || {}).prevLowPct || 0,
      medianText: (fields || {}).medianText || '',
      medianPct: (fields || {}).medianPct || 0,
      aiText: (fields || {}).aiText || '',
      suppressProductEmbed: (fields || {}).suppressProductEmbed === true,
      forceLink: (fields || {}).forceLink === true,
    };
    const out = [];
    for (const rawLine of recipe.split('\n')) {
      const line = rawLine.replace(/\s*\+\{offers\}/g, ctx.offerCount ? ` +${ctx.offerCount}` : '').replace(/\{([a-z]+)\}/g, (m, name) => LAYOUT_TOKENS.has(name) ? tokenText(name, ctx) : '').replace(/\s*·\s*·\s*/g, ' · ').replace(/^([#-]+)\s*·\s*/g, '$1 ').replace(/^\s*·\s*|\s*·\s*$/g, '').replace(/^([#-]+)\s+/g, '$1 ').replace(/\s\+(?!\d)\s*$/g, '');
      if (line.replace(/^[#> \s-]+/, '').trim() === '') continue;
      out.push(line);
    }
    return out.join('\n');
  }

  function forumRecipeFor(recipe = DEFAULT_LAYOUT) {
    const base = String(recipe || '').trim() ? String(recipe) : DEFAULT_LAYOUT;
    const stripped = base.replace(/\{title\}/g, '');
    return /\{link\}/.test(stripped) ? stripped : `${stripped.replace(/\s+$/, '')}\n{link}`;
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
  // der Click-Handler nutzt nur diese eine Quelle.
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

  // ─── MODULE: src/features/tavily-search.js ──────────────────────────────────
  /**
   * Tavily AI Search Client & Persistent Cache
   * Fast 1-credit basic web search with synthesized verdict (include_answer: true).
   * 48h persistent cache to conserve the 1,000 monthly free tier credits.
   */

  const TAVILY_API_ENDPOINT = 'https://api.tavily.com/search';
  const TAVILY_CACHE_KEY_PREFIX = 'tp_suite_v2_tavily_';
  const TAVILY_CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48h

  const memCache = new Map();
  const inFlight = new Map();

  function normalizeTavilyQuery(query) {
    return String(query ?? '').replace(/\s+/g, ' ').trim();
  }

  function tavilyCacheKey(query) {
    return normalizeTavilyQuery(query).toLowerCase();
  }

  function getCachedTavily(query) {
    const key = tavilyCacheKey(query);
    if (!key) return null;

    const now = Date.now();
    const mem = memCache.get(key);
    if (mem && (now - mem.timestamp < TAVILY_CACHE_TTL_MS)) {
      return mem;
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(TAVILY_CACHE_KEY_PREFIX + key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.answer === 'string' && (now - (parsed.timestamp || 0) < TAVILY_CACHE_TTL_MS)) {
            memCache.set(key, parsed);
            return parsed;
          }
          localStorage.removeItem(TAVILY_CACHE_KEY_PREFIX + key);
        }
      } catch {
        /* ignore storage read error */
      }
    }

    return null;
  }

  function setCachedTavily(query, answer) {
    const key = tavilyCacheKey(query);
    if (!key || typeof answer !== 'string') return;

    const entry = { answer: answer.trim(), timestamp: Date.now() };
    memCache.set(key, entry);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(TAVILY_CACHE_KEY_PREFIX + key, JSON.stringify(entry));
      } catch {
        /* ignore storage full or quota errors */
      }
    }
  }

  function clearTavilyCache() {
    memCache.clear();
    if (typeof localStorage !== 'undefined') {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(TAVILY_CACHE_KEY_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          localStorage.removeItem(k);
        }
      } catch {
        /* ignore storage access error */
      }
    }
  }

  function expandKeywordWithPrice(keyword, priceText = '') {
    let kw = String(keyword || '').replace(/\s+/g, ' ').trim();
    if (!kw.includes('{preis}')) return kw;

    if (priceText) {
      return kw.replace(/\{preis\}/g, priceText).replace(/\s+/g, ' ').trim();
    }

    // Gracefully drop sentence or clause asking about {preis} when no price is available
    return kw
      .replace(/(?:[.,;]\s+)(?:(?:Ist\s+(?:der\s+)?|zum\s+)?(?:Preis(?:\s*von|\s*:)?\s*)?|Ist\s+)?\{preis\}(?:\s*(?:ein\s+guter\s+Deal|angemessen|günstig)\??)?(?:\.|\?|;)(?=\s+\S)/gi, '.')
      .replace(/(?:[.,;]?\s*)?(?:(?:Ist\s+(?:der\s+)?|zum\s+)?(?:Preis(?:\s*von|\s*:)?\s*)?|Ist\s+)?\{preis\}(?:\s*(?:ein\s+guter\s+Deal|angemessen|günstig)\??)?[.,;]?/gi, '')
      .replace(/\s*\.\s*\./g, '.')
      .replace(/^\.\s*/, '')
      .replace(/\s*-\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatSearchQuery(productTitle, keyword, priceText = '') {
    const cleanTitle = String(productTitle || '').replace(/\s+/g, ' ').trim();
    let kw = expandKeywordWithPrice(keyword, priceText);
    if (/\{produkt\}|\[produkt\]/i.test(kw)) {
      return kw.replace(/\{produkt\}|\[produkt\]/gi, cleanTitle).replace(/\s+/g, ' ').trim();
    }
    return `${cleanTitle} ${kw}`.replace(/\s+/g, ' ').trim();
  }

  function buildTavilyQuery(title, keyword = '', priceText = '') {
    let full = formatSearchQuery(title, keyword, priceText);
    if (!/deutsch/i.test(full)) {
      full = `${full} Kurzes Fazit auf Deutsch.`;
    }

    return normalizeTavilyQuery(full);
  }

  function fetchTavilySummary(apiKey, query, options = {}) {
    const trimmedKey = String(apiKey || '').trim();
    if (!trimmedKey) {
      return Promise.reject(new Error('Tavily API-Key fehlt'));
    }

    const normalized = normalizeTavilyQuery(query);
    if (!normalized) {
      return Promise.reject(new Error('Suchanfrage ist leer'));
    }

    // 1. Check persistent/memory cache
    const cached = getCachedTavily(normalized);
    if (cached?.answer) {
      return Promise.resolve(cached.answer);
    }

    // 2. In-flight request deduplication
    const flightKey = `${trimmedKey}:${normalized}`;
    if (inFlight.has(flightKey)) {
      return inFlight.get(flightKey);
    }

    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 60000;
    const searchDepth = options.searchDepth || (typeof CONFIG !== 'undefined' ? CONFIG.TAVILY_SEARCH_DEPTH : 'basic') || 'basic';
    const maxResults = typeof options.maxResults === 'number'
      ? options.maxResults
      : ((typeof CONFIG !== 'undefined' ? CONFIG.TAVILY_MAX_RESULTS : 5) || 5);

    const promise = new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        api_key: trimmedKey,
        query: normalized,
        search_depth: searchDepth,
        include_answer: true,
        language: 'de',
        max_results: maxResults
      });

      const handleSuccess = (rawText) => {
        try {
          const data = JSON.parse(rawText || '{}');
          const answer = (data.answer || '').trim();
          if (answer) {
            setCachedTavily(normalized, answer);
            resolve(answer);
          } else if (Array.isArray(data.results) && data.results.length > 0 && data.results[0].content) {
            const fallbackSnippet = data.results[0].content.trim();
            setCachedTavily(normalized, fallbackSnippet);
            resolve(fallbackSnippet);
          } else {
            reject(new Error('Kein Fazit erhalten'));
          }
        } catch (err) {
          reject(new Error('Antwort von Tavily konnte nicht gelesen werden'));
        }
      };

      if (typeof GM_xmlhttpRequest !== 'undefined') {
        try {
          GM_xmlhttpRequest({
            method: 'POST',
            url: TAVILY_API_ENDPOINT,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            data: payload,
            timeout: timeoutMs,
            onload: (res) => {
              if (res.status >= 200 && res.status < 300) {
                handleSuccess(res.responseText);
              } else if (res.status === 401 || res.status === 403) {
                reject(new Error('Tavily API-Key ungültig'));
              } else if (res.status === 429) {
                reject(new Error('Tavily Monatslimit oder Rate-Limit erreicht'));
              } else {
                reject(new Error(`Tavily HTTP-Fehler ${res.status}`));
              }
            },
            onerror: () => reject(new Error('Netzwerkfehler bei Verbindung zu Tavily')),
            ontimeout: () => reject(new Error('Zeitüberschreitung bei Tavily'))
          });
        } catch (e) {
          reject(e);
        }
      } else if (typeof fetch !== 'undefined') {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        fetch(TAVILY_API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: payload,
          signal: controller?.signal
        })
          .then(async (res) => {
            if (timer) clearTimeout(timer);
            if (res.ok) {
              handleSuccess(await res.text());
            } else if (res.status === 401 || res.status === 403) {
              reject(new Error('Tavily API-Key ungültig'));
            } else if (res.status === 429) {
              reject(new Error('Tavily Monatslimit oder Rate-Limit erreicht'));
            } else {
              reject(new Error(`Tavily HTTP-Fehler ${res.status}`));
            }
          })
          .catch((err) => {
            if (timer) clearTimeout(timer);
            if (err?.name === 'AbortError') {
              reject(new Error('Zeitüberschreitung bei Tavily'));
            } else {
              reject(new Error('Netzwerkfehler bei Verbindung zu Tavily'));
            }
          });
      } else {
        reject(new Error('Kein HTTP-Transport für Tavily verfügbar'));
      }
    }).finally(() => {
      inFlight.delete(flightKey);
    });

    inFlight.set(flightKey, promise);
    return promise;
  }

  // ─── MODULE: src/features/share-discord.js ──────────────────────────────────
  /**
   * Discord Deal-Sharing
   * 1-Klick-Share verifizierter Tiefstpreise in einen Discord-Channel via
   * user-eigenem Webhook (GM-privat gespeichert, nie im Repo/Export/localStorage).
   */



  // Re-export layout, recipe, and offer extraction for backwards compatibility and tests



  const isDiscordWebhookUrl = url =>
    typeof url === 'string' &&
    /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/[\w-]+(?:\?[^\s#]*)?$/.test(url.trim());

  // Forum-/Media-Channel brauchen thread_name (sonst 405/400, nichts erstellt).
  // Thread-/Channel-Namen: 1-100 Zeichen (Discord Channel-Doku).
  const buildThreadName = title => ((title || '').replace(/\s+/g, ' ').trim() || 'Toppreise-Deal').slice(0, 100);
  const isForumThreadError = err => /^Discord (400|405)$/.test(err?.message || '');

  // Definite attachment rejections: the file itself was refused — text fallback
  // is safe. Anything else (429/timeout/network) must never auto-post text.
  const isAttachmentRejection = err => err?.status === 400 || err?.status === 413 || err?.status === 415;

  function discordForumFlagKey(webhookUrl) {
    let h = 5381;
    const s = String(webhookUrl || '').trim();
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return `DISCORD_FORUM:${h.toString(16).padStart(8, '0')}`;
  }

  // Historie endet am letzten Sample, nicht am Live-Kartenpreis (kann seitdem
  // gefallen sein). Für den PNG-Chart den Livepreis anhängen, damit Linie und
  // Endpunkt-Markierung am aktuellen Preis enden. Reine Funktion, nie mutierend.
  function withLivePrice(timeSeries, price) {
    if (!Array.isArray(timeSeries) || timeSeries.length === 0) return timeSeries;
    if (!(price > 0)) return timeSeries;
    const last = timeSeries[timeSeries.length - 1];
    if (Array.isArray(last) && priceToCents(last[1]) === priceToCents(price)) return timeSeries;
    return [...timeSeries, [Date.now(), price]];
  }

  // Preischart als PNG für Discord: vorhandenes SVG gross rendern, rastern, als
  // Webhook-Attachment hochladen. Reine Browser-APIs — ohne DOM kein Bild (null).
  function renderSparklinePng(timeSeries, width = 360, height = 100, title = '') {
    return new Promise(resolve => {
      let done = false;
      let svgUrl = null;
      const finish = v => { if (!done) { done = true; clearTimeout(timer); if (svgUrl) try { URL.revokeObjectURL(svgUrl); } catch {} resolve(v); } };
      const timer = setTimeout(() => finish(null), 3000);
      try {
        if (typeof document === 'undefined') return finish(null);
        const svg = renderDiscordChart(timeSeries, width, height, title);
        if (!svg) return finish(null);
        const svgText = new XMLSerializer().serializeToString(svg);
        svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
        const img = new Image();
        const rasterize = source => () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            canvas.getContext('2d').drawImage(source, 0, 0, width * 2, height * 2);
            canvas.toBlob(b => finish(b || null), 'image/png');
          } catch { finish(null); }
        };
        img.onload = rasterize(img);
        // blob:-URL gescheitert (CSP): data-URI als Rastervorlage retryen.
        img.onerror = () => {
          const retry = new Image();
          retry.onload = rasterize(retry);
          retry.onerror = () => finish(null);
          retry.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
        };
        img.src = svgUrl;
      } catch { finish(null); }
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
        try {
          const h = new URL(imageUrl.trim()).hostname.toLowerCase();
          const own = (typeof location !== 'undefined' && location.hostname ? location.hostname : 'www.toppreise.ch').toLowerCase();
          const isAllowedHost = h === own || h === 'toppreise.ch' || h.endsWith('.toppreise.ch') || h === 'graph.keepa.com' || h.endsWith('.keepa.com');
          if (!isAllowedHost) return reject(new Error('Ungültige Bild-URL'));
        } catch { return reject(new Error('Ungültige Bild-URL')); }
        if (typeof GM_xmlhttpRequest !== 'undefined') {
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
                if (blob.size > 8 * 1024 * 1024) return reject(new Error('Bild zu gross'));
                if (blob.type && !blob.type.startsWith('image/')) return reject(new Error('Ungültiges Bild'));
                resolve(blob);
              } else reject(new Error(`Bild-Download ${res.status}`));
            },
            onerror: () => reject(new Error('Netzwerkfehler')),
            ontimeout: () => reject(new Error('Timeout'))
          });
        } else if (typeof fetch !== 'undefined') {
          fetch(imageUrl.trim())
            .then(async res => {
              if (res.status >= 200 && res.status < 300) {
                const blob = await res.blob();
                if (!blob.size) return reject(new Error('Leeres Bild'));
                if (blob.size > 8 * 1024 * 1024) return reject(new Error('Bild zu gross'));
                if (blob.type && !blob.type.startsWith('image/')) return reject(new Error('Ungültiges Bild'));
                resolve(blob);
              } else reject(new Error(`Bild-Download ${res.status}`));
            })
            .catch(() => reject(new Error('Netzwerkfehler')));
        } else {
          reject(new Error('Kein HTTP-Transport verfügbar'));
        }
      } catch (err) { reject(err); }
    });
  }

  // Enriched rejection: {status, body, retryAfterMs} let the caller tell a
  // definite attachment refusal (safe text fallback) from an ambiguous
  // transport failure (429/timeout/network — never auto-repost, could duplicate).
  const discordBodyExcerpt = body => (typeof body === 'string' ? body : '')?.slice(0, 500) || '';
  const discordHeaderVal = (headers, name) => {
    if (!headers) return null;
    if (typeof headers.get === 'function') return headers.get(name);
    const m = String(headers).match(new RegExp(`^${name}:\\s*(.+)$`, 'im'));
    return m ? m[1].trim() : null;
  };
  const discordRetryAfterMs = headers => {
    const ra = discordHeaderVal(headers, 'Retry-After');
    if (ra != null && ra !== '') {
      const secs = Number(ra);
      if (Number.isFinite(secs)) return Math.max(0, Math.min(60000, secs * 1000));
      const at = Date.parse(ra);
      if (Number.isFinite(at)) return Math.max(0, Math.min(60000, at - Date.now()));
    }
    const resetAfter = Number(discordHeaderVal(headers, 'X-RateLimit-Reset-After'));
    if (Number.isFinite(resetAfter)) return Math.max(0, Math.min(60000, resetAfter * 1000));
    return 0;
  };
  const discordError = (status, body, headers) =>
    Object.assign(new Error(status ? `Discord ${status}` : 'Netzwerkfehler'),
      { status: status ?? 0, body: discordBodyExcerpt(body), retryAfterMs: discordRetryAfterMs(headers) });

  function gmPost({ url, data, headers, timeoutMs }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url,
        ...(headers ? { headers } : {}),
        data,
        timeout: timeoutMs,
        onload: res => (res.status >= 200 && res.status < 300 ? resolve() : reject(discordError(res.status, res?.responseText, res?.responseHeaders))),
        onerror: () => reject(Object.assign(new Error('Netzwerkfehler'), { status: 0, retryAfterMs: 0 })),
        ontimeout: () => reject(Object.assign(new Error('Timeout'), { status: 0, retryAfterMs: 0 }))
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
        const body = { content, allowed_mentions: { parse: [] } };
        const productBlob = options.productImageBlob instanceof Blob ? options.productImageBlob : null;
        const keepaBlob = options.keepaImageBlob instanceof Blob ? options.keepaImageBlob : null;

        const files = [];
        if (productBlob) files.push({ name: 'produkt.png', blob: productBlob });
        files.push({ name: 'preisverlauf.png', blob: pngBlob });
        if (keepaBlob) files.push({ name: 'keepa.png', blob: keepaBlob });

        if (files.length > 1) {
          body.embeds = files.map(f => ({ image: { url: `attachment://${f.name}` } }));
        } else if (typeof options.productImageUrl === 'string' && options.productImageUrl) {
          body.embeds = [{ image: { url: options.productImageUrl } }];
        }
        if (typeof options.threadName === 'string' && options.threadName) body.thread_name = options.threadName;
        form.append('payload_json', JSON.stringify(body));
        if (files.length > 1) {
          files.forEach((f, idx) => {
            form.append(`files[${idx}]`, f.blob, f.name);
          });
        } else {
          form.append('file', pngBlob, 'preisverlauf.png');
        }
        const url = webhookUrl.trim();
        if (typeof GM_xmlhttpRequest !== 'undefined') {
          gmPost({ url, data: form, timeoutMs: 20000 }).then(resolve, reject);
        } else if (typeof fetch !== 'undefined') {
          fetch(url, { method: 'POST', body: form })
            .then(async res => {
              if (res.ok) return resolve();
              reject(discordError(res.status, await res.text().catch(() => ''), res.headers));
            })
            .catch(() => reject(Object.assign(new Error('Netzwerkfehler'), { status: 0, retryAfterMs: 0 })));
        } else {
          reject(new Error('Kein Multipart-Transport'));
        }
      } catch { reject(new Error('Upload fehlgeschlagen')); }
    });
  }

  function postDealToDiscord(webhookUrl, content, options = {}) {
    return new Promise((resolve, reject) => {
      if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
      const url = webhookUrl.trim();
      const body = { content, allowed_mentions: { parse: [] } };
      if (typeof options.productImageUrl === 'string' && options.productImageUrl) body.embeds = [{ image: { url: options.productImageUrl } }];
      if (typeof options.threadName === 'string' && options.threadName) body.thread_name = options.threadName;
      const payload = JSON.stringify(body);
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        gmPost({ url, data: payload, headers: { 'Content-Type': 'application/json' }, timeoutMs: 15000 }).then(resolve, reject);
      } else if (typeof fetch !== 'undefined') {
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
          .then(async res => {
            if (res.ok) return resolve();
            reject(discordError(res.status, await res.text().catch(() => ''), res.headers));
          })
          .catch(() => reject(Object.assign(new Error('Netzwerkfehler'), { status: 0, retryAfterMs: 0 })));
      } else {
        reject(new Error('Kein HTTP-Transport verfügbar'));
      }
    });
  }

  // ─── MODULE: src/page/sort.js ───────────────────────────────────────────────
  /**
   * Grid Sorting Engine
   * Handles flex column reparenting and sorting by offer count, discount percent,
   * and continuous weighted difference, with 100% natural DOM order restoration.
   */





  // Original placement (no synthetic ids on host parents): item → {parent, placeholder}.
  // The placeholder comment marks the exact pre-sort position; restore inserts
  // before it when still connected, else appends, then re-sorts by tpInitialOrder.
  const origPlacement = new WeakMap();
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

  let nextInitialOrder = 0;

  function applySorting(cards, pageHasOffers, cardDataList = null) {
    const list = cards || [];

    const isCustomSortActive = CONFIG.BESTPREISE_MODE_ACTIVE ||
                               CONFIG.SORT_BY_OFFERS === 'discount-desc' ||
                               (pageHasOffers && CONFIG.SORT_BY_OFFERS !== 'none');

    if (isCustomSortActive) {
      // Ordering needs 2+ visible cards; restore below must run regardless.
      if (list.length <= 1) return;
    } else {
      // Restore must run even with zero visible cards: getProductCards filters
      // hidden rows, so staging can hide every sorted card at disable time.
      const wasCustomSorted = list.some(c => {
        const u = getCardSortableUnit(c);
        return u?.style.order || (u && origPlacement.has(u));
      }) || (typeof document?.querySelector === 'function' && !!document.querySelector('.tp-empty-product-row-hidden, [data-tp-initial-order]'));
      if (!wasCustomSorted) return;
    }

    // Record initial order on every card plus the original placement of every
    // sortable item — independent of item identity (item === card included).
    list.forEach(c => {
      if (!c.dataset.tpInitialOrder) {
        c.dataset.tpInitialOrder = String(nextInitialOrder++);
      }
      const item = getCardSortableUnit(c);
      if (item) {
        if (!item.dataset.tpInitialOrder) item.dataset.tpInitialOrder = c.dataset.tpInitialOrder;
        if (!origPlacement.has(item) && item.parentElement) {
          // Non-DOM harnesses (unit tests) have no Comment nodes: record the
          // parent anyway; restore falls back to appendChild order.
          const placeholder = typeof document?.createComment === 'function' ? document.createComment('tp-orig') : null;
          if (placeholder) item.after(placeholder);
          origPlacement.set(item, { parent: item.parentElement, placeholder });
        }
      }
    });

    if (isCustomSortActive) {
      // Rows derive from visible cards — active sort only; restore below re-derives instead.
      const productRows = Array.from(new Set(list.map(c => getCardSortableUnit(c)?.parentElement).filter(r => r && !r.closest('header, nav, footer, .breadcrumb, #tp-suite-filter-bar, .Plugin_ProductHistoryDropdown, .AbstractDropDown, #Plugin_MainHead, .DropDownMenuList'))));
      if (productRows.length === 0) return;

      const primaryRow = productRows[0];

      let sortedEntries = [];

      const byCard = cardDataList ? new Map(cardDataList.map(cd => [cd.card, cd])) : null;
      const cdFor = c => byCard?.get(c) || extractCardData(c);
      if (CONFIG.BESTPREISE_MODE_ACTIVE) {
        const scored = list.map(c => {
          const cd = cdFor(c);
          const sortBasisOk = cd.basisMatches ?? basisMatchesFor(cd.stats, cd.cardPriceBasis);
          const vStats = cd.verifiedStats ?? (sortBasisOk ? cd.stats : null);
          const usable = hasUsablePriceStats(vStats);
          const displayDelta = cd.displayDelta ?? (vStats ? getDisplayDelta(cd.cardPrice, vStats) : null);
          const isDeal = !!cd.dealScore || (usable && (displayDelta?.kind === 'at-low' || displayDelta?.kind === 'new-low'));
          const tier = isDeal ? 2 : (usable ? 0 : 1);
          return {
            card: c,
            item: getCardSortableUnit(c),
            tier,
            badgePct: getCardEffectiveDiscount(cd),
            initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
          };
        });
        scored.sort((a, b) => (b.tier - a.tier) || (b.badgePct - a.badgePct) || (a.initialOrder - b.initialOrder));
        sortedEntries = scored;
      } else if (CONFIG.SORT_BY_OFFERS === 'discount-desc') {
        // Verified level (vs Ø-Preis) first; fallback-tief / unverified site Differenz fallback.
        const scored = list.map(c => {
          const cd = cdFor(c);
          const level = getLevelPct(cd.cardPrice, cd.verifiedStats !== undefined ? cd.verifiedStats : cd.stats, true);
          return {
            card: c,
            item: getCardSortableUnit(c),
            disc: level !== null ? -level : getCardEffectiveDiscount(cd),
            initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
          };
        });
        scored.sort((a, b) => (b.disc - a.disc) || (a.initialOrder - b.initialOrder));
        sortedEntries = scored;
      } else if (pageHasOffers && CONFIG.SORT_BY_OFFERS !== 'none') {
        const scored = list.map(c => ({
          card: c,
          item: getCardSortableUnit(c),
          count: extractOfferCount(c),
          initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
        }));
        scored.sort((a, b) => (CONFIG.SORT_BY_OFFERS === 'desc' ? (b.count - a.count) : (a.count - b.count)) || (a.initialOrder - b.initialOrder));
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
      const trailingAnchor = primaryRow.querySelector?.('.Plugin_ProductOfferSeparator, .Plugin_Offer') || null;
      sortedEntries.forEach((entry, rank) => {
        const item = entry.item;
        if (item) {
          if (item.parentElement !== primaryRow) {
            primaryRow.insertBefore(item, trailingAnchor);
          }
          const flexOrder = String(rank - sortedEntries.length);
          if (item.style.order !== flexOrder) {
            item.style.setProperty('order', flexOrder, 'important');
          }
        }
      });

      // Ensure DOM order inside primaryRow matches sortedEntries order without unnecessary detach/re-attach
      const currentChildren = Array.from(primaryRow.children);
      const targetItems = sortedEntries.map(e => e.item).filter(Boolean);
      const cardIndices = currentChildren.map((c, i) => targetItems.includes(c) ? i : -1).filter(i => i !== -1);
      let domOrderMatches = cardIndices.length === targetItems.length;
      if (domOrderMatches) {
        for (let i = 0; i < targetItems.length; i++) {
          if (currentChildren[cardIndices[i]] !== targetItems[i]) {
            domOrderMatches = false;
            break;
          }
        }
      }
      if (!domOrderMatches) {
        targetItems.forEach((item, idx) => {
          const targetPos = cardIndices[idx];
          if (primaryRow.children[targetPos] !== item) {
            primaryRow.insertBefore(item, primaryRow.children[targetPos] || null);
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
      const itemsToRestore = list.map(c => {
        const item = getCardSortableUnit(c);
        return {
          card: c,
          item,
          initialOrder: parseInt(c.dataset.tpInitialOrder || item?.dataset.tpInitialOrder || '0', 10)
        };
      });
      // cards skips hidden rows (getProductCards filters them), so re-derive
      // hidden previously-sorted units via their tpInitialOrder marker.
      const seenUnits = new Set(itemsToRestore.map(entry => entry.item).filter(Boolean));
      const markedNodes = typeof document?.querySelectorAll === 'function' ? document.querySelectorAll('[data-tp-initial-order]') : [];
      markedNodes.forEach(node => {
        const unit = node.matches?.('.Plugin_Product') ? getCardSortableUnit(node) : node;
        if (!unit || seenUnits.has(unit) || !origPlacement.has(unit)) return;
        seenUnits.add(unit);
        const card = unit.matches?.('.Plugin_Product') ? unit : unit.querySelector?.('.Plugin_Product');
        itemsToRestore.push({
          card: card || node,
          item: unit,
          initialOrder: parseInt(card?.dataset.tpInitialOrder || unit.dataset.tpInitialOrder || '0', 10)
        });
      });

      itemsToRestore.sort((a, b) => a.initialOrder - b.initialOrder);

      const hiddenRows = typeof document?.querySelectorAll === 'function' ? Array.from(document.querySelectorAll('.tp-empty-product-row-hidden')) : [];
      const allOrigParents = Array.from(new Set([...itemsToRestore.map(entry => {
        const saved = entry.item ? origPlacement.get(entry.item) : null;
        return (saved?.parent?.isConnected ? saved.parent : null) || entry.item?.parentElement;
      }), ...hiddenRows.filter(r => r.isConnected)].filter(Boolean)));

      itemsToRestore.forEach(entry => {
        const item = entry.item;
        if (!item) return;
        if (item.style.order) {
          item.style.removeProperty('order');
        }

        const saved = origPlacement.get(item);
        const target = (saved?.parent?.isConnected ? saved.parent : null) || item.parentElement;
        if (target && item.parentElement !== target) {
          if (saved?.placeholder?.isConnected) target.insertBefore(item, saved.placeholder);
          else target.appendChild(item);
        }
      });

      // Ensure each product row has its children in initial order and unhide without redundant re-appends
      allOrigParents.forEach(row => {
        const children = Array.from(row.children).filter(ch => ch.dataset.tpInitialOrder !== undefined);
        const isAlreadySorted = children.every((ch, i) => i === 0 || parseInt(ch.dataset.tpInitialOrder || '0', 10) >= parseInt(children[i - 1].dataset.tpInitialOrder || '0', 10));
        if (!isAlreadySorted) {
          children.sort((a, b) => parseInt(a.dataset.tpInitialOrder || '0', 10) - parseInt(b.dataset.tpInitialOrder || '0', 10));
          const cardIndices = Array.from(row.children).map((c, i) => children.includes(c) ? i : -1).filter(i => i !== -1);
          children.forEach((ch, idx) => {
            const saved = origPlacement.get(ch);
            if (saved?.placeholder?.isConnected && saved.placeholder.parentElement === row) {
              row.insertBefore(ch, saved.placeholder);
            } else {
              const targetPos = cardIndices[idx];
              if (targetPos !== undefined && row.children[targetPos] && row.children[targetPos] !== ch) {
                row.insertBefore(ch, row.children[targetPos]);
              } else {
                row.appendChild(ch);
              }
            }
          });
        }
        // Unhide only script-hidden rows: other inline display:none belongs to the host.
        if (row.classList.contains('tp-empty-product-row-hidden')) {
          row.classList.remove('tp-empty-product-row-hidden');
          row.style.removeProperty('display');
        }
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

  // Single-flight abort for the running batch scan. Next run replaces it.
  let batchController = null;
  // Shared across JSON + HTML paths (same origin): set on 429 exhaustion.
  let originCooldownUntil = 0;
  function resetOriginCooldown() { originCooldownUntil = 0; }

  async function interruptibleSleep(ms, shouldCancelFn = null, signal = null) {
    const step = 100;
    let elapsed = 0;
    while (elapsed < ms) {
      if (signal?.aborted) return;
      if (shouldCancelFn && shouldCancelFn()) break;
      const wait = Math.min(step, ms - elapsed);
      await new Promise(r => setTimeout(r, wait));
      elapsed += wait;
    }
  }

  const backoffMs = (attempt, baseDelayMs = 400) =>
    Math.min(8000, baseDelayMs * 2 ** attempt) + Math.random() * 250;

  const parseRetryAfterMs = (header, baseDelayMs, attempt) => {
    if (header != null && String(header).trim() !== '') {
      const secs = Number(String(header).trim());
      if (Number.isFinite(secs)) return Math.max(0, Math.min(60000, secs * 1000));
      const at = Date.parse(String(header).trim());
      if (Number.isFinite(at)) return Math.max(0, Math.min(60000, at - Date.now()));
    }
    return backoffMs(attempt, baseDelayMs);
  };

  const isCancelled = (signal, shouldCancelFn) => signal?.aborted || shouldCancelFn?.();

  // Central retry: makeRequest(linkedSignal, attempt) must do fetch AND body
  // reads with the linked signal, so the per-attempt timeout below covers body
  // reads too (cleared in finally after makeRequest resolves). Returns the
  // makeRequest value on HTTP 200; returns it on non-429 4xx (caller maps to
  // genuinely-absent); throws transient/cancelled/cooldown otherwise — never
  // writes cache itself.
  async function requestWithRetry(makeRequest, { retries = 1, shouldCancelFn = null, signal = null, baseDelayMs = 400, timeoutMs = 6000 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (isCancelled(signal, shouldCancelFn)) {
        const e = new Error('cancelled');
        e.cancelled = true;
        throw e;
      }
      if (Date.now() < originCooldownUntil) {
        const e = new Error('cooldown');
        e.cooldown = true;
        throw e;
      }
      const ctrl = new AbortController();
      const onAbort = () => ctrl.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const { res, data } = await makeRequest(ctrl.signal, attempt);
        if (res.ok) return { res, data };
        if (res.status === 429) {
          const wait = parseRetryAfterMs(res.headers?.get('Retry-After'), baseDelayMs, attempt);
          if (attempt < retries) {
            await interruptibleSleep(wait, shouldCancelFn, signal);
            continue;
          }
          originCooldownUntil = Date.now() + Math.max(wait, baseDelayMs);
          const e = new Error('429');
          e.transient = true;
          throw e;
        }
        if (res.status >= 500) {
          if (attempt < retries) {
            await interruptibleSleep(backoffMs(attempt, baseDelayMs), shouldCancelFn, signal);
            continue;
          }
          const e = new Error(`HTTP ${res.status}`);
          e.transient = true;
          throw e;
        }
        return { res, data };
      } catch (err) {
        if (err?.cancelled || err?.cooldown || err?.transient) throw err;
        // Parent cancellation (outer signal / predicate) wins over the
        // attempt's own timeout: both abort the linked controller, so check
        // the parent first or every timeout looks like a cancellation.
        if (signal?.aborted || shouldCancelFn?.()) {
          const e = new Error('cancelled');
          e.cancelled = true;
          throw e;
        }
        if (ctrl.signal.aborted) {
          // This attempt's own timer fired: retry like any transient instead
          // of exiting on the first attempt.
          if (attempt < retries) {
            await interruptibleSleep(backoffMs(attempt, baseDelayMs), shouldCancelFn, signal);
            continue;
          }
          const e = new Error('timeout');
          e.timeout = true;
          throw e;
        }
        // Backstop for aborts neither parent nor timer explains (e.g. a fetch
        // implementation aborting without the controller flag).
        if (err?.name === 'AbortError') {
          const e = new Error('timeout');
          e.timeout = true;
          throw e;
        }
        if (err?.name === 'SyntaxError') {
          const e = new Error('invalid-json');
          e.cause = err;
          throw e;
        }
        if (attempt < retries) {
          await interruptibleSleep(backoffMs(attempt, baseDelayMs), shouldCancelFn, signal);
          continue;
        }
        const e = new Error('network');
        e.transient = true;
        e.cause = err;
        throw e;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
    }
    const e = new Error('network');
    e.transient = true;
    throw e;
  }

  async function fetchPriceTimeSeries(productId, retries = 1, shouldCancelFn = null, useShipping = null, signal = null) {
    if (!productId) return null;
    const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
    const postBody = `pcspagdpi=${encodeURIComponent(productId)}&pcspagdfdt=0000-00-00&pcspagdtd=&p_pc_ch=&lang=de`;
    // isShipping true ONLY when shipping was requested AND the data[1] branch
    // was taken; every other shape is basis-unconfirmed → treat as product.
    const pickSeries = data => {
      const shippingActive = typeof useShipping === 'boolean' ? useShipping : isShippingPriceActive();
      if (Array.isArray(data)) {
        if (Array.isArray(data[0]) && data[0].length > 0 && Array.isArray(data[0][0])) {
          if (shippingActive && data.length > 1 && Array.isArray(data[1]) && data[1].length > 0 && Array.isArray(data[1][0])) {
            return { series: data[1], isShipping: true };
          }
          return { series: data[0], isShipping: false }; // Series 0: Produktpreis
        }
        if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
          return { series: data, isShipping: false }; // Raw points [[t1, p1], [t2, p2]]
        }
      }
      if (Array.isArray(data?.series)) return { series: data.series, isShipping: false };
      if (Array.isArray(data?.data)) return { series: data.data, isShipping: false };
      return { series: null, isShipping: false };
    };
    try {
      const { res, data } = await requestWithRetry(async linkedSignal => {
        const res = await fetch(`${baseUrl}/plugins/product/pricechart`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/javascript, */*; q=0.01'
          },
          credentials: 'same-origin',
          body: postBody,
          signal: linkedSignal
        });
        // No .catch swallow: body-read aborts must reach the retry classifier
        // (timeout path), malformed JSON the generic branch (retried, then
        // invalid-response below). 4xx other than 429 arrive here with res.
        const json = res.ok ? await res.json() : null;
        return { res, data: json };
      }, { retries, shouldCancelFn, signal, baseDelayMs: 1500, timeoutMs: 6000 });
      if (res && !res.ok && (res.status === 401 || res.status === 403)) {
        const e = new Error('unauthorized');
        e.unauthorized = true;
        throw e;
      }
      const pick = pickSeries(data);
      if (pick.series) return pick;
    } catch (err) {
      // Typed failures propagate so the caller skips the HTML fallback; only
      // the empty signal (absent/invalid) falls through to it.
      if (err?.cancelled || err?.timeout || err?.cooldown || err?.unauthorized) throw err;
      if (err?.transient && err?.cause?.name !== 'SyntaxError') throw err;
      if (CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching time series for product', productId, err);
    }
    return null;
  }

  // Per-caller cancel over a shared promise: rejects only this caller (typed
  // `cancelled`), never the transport siblings still await.
  function raceSharedRaw(promise, signal, shouldCancelFn) {
    if (signal?.aborted || shouldCancelFn?.()) {
      const e = new Error('cancelled');
      e.cancelled = true;
      return Promise.reject(e);
    }
    if (!signal && !shouldCancelFn) return promise;
    return new Promise((resolve, reject) => {
      let done = false;
      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
        if (timer) clearInterval(timer);
      };
      const cancel = () => {
        if (done) return;
        done = true;
        cleanup();
        const e = new Error('cancelled');
        e.cancelled = true;
        reject(e);
      };
      const onAbort = () => cancel();
      // Event-driven abort via AbortSignal; fallback to polled timer only
      // when legacy shouldCancelFn was supplied without an AbortSignal.
      const timer = (!signal && shouldCancelFn) ? setInterval(() => { if (!done && shouldCancelFn()) cancel(); }, 50) : null;
      signal?.addEventListener('abort', onAbort, { once: true });
      promise.then(
        v => { if (!done) { done = true; cleanup(); resolve(v); } },
        e => { if (!done) { done = true; cleanup(); reject(e); } }
      );
    });
  }
  async function fetchSingleProductPriceStats(productId, retries = 1, forceFresh = false, shouldCancelFn = null, currentPrice = null, signal = null, preferredBasis = null) {
    if (!productId) return null;
    // Snapshot the shipping basis once: a mode toggle mid-fetch must not pick
    // the wrong series into the wrong slot, and each mode dedups independently.
    const useShipping = typeof preferredBasis === 'string'
      ? (preferredBasis === 'shipping')
      : (typeof preferredBasis === 'boolean' ? preferredBasis : isShippingPriceActive());
    const fetchKey = `${productId}_${useShipping ? 's' : 'p'}`;
    // Generation at network start: a clear/reset mid-flight voids every write below.
    const gen = currentCacheGen();
    // Refresh bypass: always hit the network, but keep the good entry in
    // memory/localStorage until the fetch succeeds — a failed refresh must
    // not downgrade a full analysis to an unavailable marker.
    const prev = getCachedPriceStats(productId, false, null, useShipping);
    if (!forceFresh && prev) {
      if (prev.unavailable) return null;
      return prev;
    }

    // Already cancelled: never touch the network (and never join the registry).
    if (isCancelled(signal, shouldCancelFn)) return null;

    // Shared raw history: the entry carries the transport only — no price
    // anchor, no caller signal. Each caller races it with its own cancel, then
    // analyzes with its own currentPrice. The transport aborts only when the
    // last consumer leaves, so one caller's cancel never kills a sibling fetch.
    let entry = activeFetches.get(fetchKey);
    // A clear/reset mid-flight voids the shared transport: never join an
    // entry from an older generation — abort it and start fresh.
    if (entry && entry.gen !== currentCacheGen()) {
      try { entry.abort?.abort(); } catch {}
      if (activeFetches.get(fetchKey) === entry) activeFetches.delete(fetchKey);
      entry = null;
    }
    if (!entry) {
      const abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const promise = fetchPriceTimeSeries(productId, retries, null, useShipping, abort?.signal ?? null);
      entry = { promise, abort, consumers: new Set(), gen: currentCacheGen() };
      activeFetches.set(fetchKey, entry);
      const release = () => { if (activeFetches.get(fetchKey) === entry) activeFetches.delete(fetchKey); };
      promise.then(release, release);
    }
    const consumer = { signal, shouldCancelFn };
    entry.consumers.add(consumer);
    let pick = null;
    try {
      pick = await raceSharedRaw(entry.promise, signal, shouldCancelFn);
    } catch (e) {
      if (e?.cancelled || e?.timeout || e?.cooldown || e?.transient || e?.unauthorized) return null;
      throw e;
    } finally {
      entry.consumers.delete(consumer);
      // An aborted transport must not stay joinable: drop it so the next
      // caller starts a fresh request instead of racing a dead promise.
      if (entry.consumers.size === 0) { try { entry.abort?.abort(); } catch {} if (activeFetches.get(fetchKey) === entry) activeFetches.delete(fetchKey); }
    }

    try {
      const baseUrl = (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';

      // 1. Primary fast route: POST JSON time-series (gives series + all aggregates in 1 request)
      // Only the empty signal (pick null) reaches the HTML fallback; typed
      // failures (cancelled/timeout/cooldown/transient/unauthorized) return
      // immediately — a retry there cannot conjure a series.
      if (pick?.series && Array.isArray(pick.series) && pick.series.length >= 1) {
        // Basis guard: a product-shape series must never land in the shipping
        // slot — fall through to the HTML path (which refuses the shipping
        // slot too and writes a negative entry instead).
        if (pick.isShipping === useShipping) {
          const analysis = analyzePriceTimeSeries(pick.series, currentPrice);
          if (analysis && analysis.tiefstpreis > 0) {
            analysis.isShippingPrice = useShipping;
            setCachedPriceStats(productId, analysis, false, undefined, useShipping, gen);
            return analysis;
          }
        } else if (!pick.isShipping && useShipping) {
          // Opportunistic product slot cache: we received a valid product-basis
          // series while querying in shipping mode. Guard against overwriting
          // existing richer/anchored product stats.
          const existing = getCachedPriceStats(productId, false, null, false);
          if (!existing || !existing.medianPrice) {
            const prodAnalysis = analyzePriceTimeSeries(pick.series, null);
            if (prodAnalysis && prodAnalysis.tiefstpreis > 0) {
              prodAnalysis.isShippingPrice = false;
              setCachedPriceStats(productId, prodAnalysis, false, undefined, false, gen);
            }
          }
        }
      }

      if (isCancelled(signal, shouldCancelFn)) return null;

      if (useShipping) {
        // HTML modal dialog carries no shipping basis: skip request entirely
        if (!prev || !prev.medianPrice) setCachedPriceStats(productId, null, true, undefined, true, gen);
        return null;
      }

      // 2. Fallback route: GET HTML modal dialog (carries no basis info)
      const url = `${baseUrl}/plugins/product/pricechart?p_pc_pid=${encodeURIComponent(productId)}`;
      let resHtml = null;
      let html = null;
      try {
        const out = await requestWithRetry(async linkedSignal => {
          const res = await fetch(url, {
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'text/html, */*; q=0.01'
            },
            credentials: 'same-origin',
            signal: linkedSignal
          });
          const text = res.ok ? await res.text() : null;
          return { res, data: text };
        }, { retries, shouldCancelFn, signal, baseDelayMs: 400, timeoutMs: 7000 });
        resHtml = out.res;
        html = out.data;
      } catch (htmlErr) {
        // Cancelled/timeout/429/5xx/network/cooldown: transient, never a
        // negative entry (a failed refresh must not downgrade prev either).
        return null;
      }
      // Unauthorized HTML (login wall): no negative entry, no prev downgrade.
      if (resHtml && !resHtml.ok && (resHtml.status === 401 || resHtml.status === 403)) return null;
      const stats = parsePriceStatsFromHtml(html);
      if (stats) {
        stats.isShippingPrice = false;
        if (!stats.medianPrice && prev && !prev.unavailable && prev.medianPrice) return prev;
        setCachedPriceStats(productId, stats, false, undefined, false, gen);
        return stats;
      } else {
        if (!prev || !prev.medianPrice) setCachedPriceStats(productId, null, true, undefined, false, gen);
      }
    } catch (err) {
      // Cancelled/timeout: silent, no negative write. Genuine failures keep
      // the no-downgrade rule (prev with median survives).
      if (!err?.cancelled && !err?.timeout && CONFIG.DEBUG) console.warn('[Toppreise Suite] Failed fetching price stats for product', productId, err);
      if (!err?.cancelled && !err?.timeout && (!prev || !prev.medianPrice)) setCachedPriceStats(productId, null, true, undefined, useShipping, gen);
    }
    return null;
  }

  async function runProductScanner(options = {}) {
    const {
      filterFn = null,
      isFeed = undefined,
      minDiscount = 30,
      sortByDiscount = false,
      shouldCancelFn = () => false,
      onProgress = null,
      onComplete = null,
      signal = null
    } = options;

    const cards = getProductCards();
    const targets = [];
    // Same pageHasOffers semantics as the processListings counter: offer-less
    // feeds must not min-offers-filter everything when Min >= 1.
    const pageHasOffers = cards.some(card => extractOfferCount(card) > 0);
    const termsList = parseNegativeTerms();
    const activeStores = extractActiveStores();
    const isDealFeed = typeof isFeed === 'boolean' ? isFeed : isNeueToppreisePage();

    const seenTargets = new Set();
    for (const card of cards) {
      const cd = extractCardData(card);
      if (!cd.pid) continue;
      const targetKey = `${cd.pid}:${cd.cardPriceBasis}`;
      if (seenTargets.has(targetKey)) continue;

      cd.filters = applyCardFilters(cd, termsList, CONFIG.MIN_OFFERS, pageHasOffers, isDealFeed);
      cd.filters.isDealerLoser = dealerLoserFor(card, activeStores);

      const elig = scanCandidateState(cd, { isFeed: isDealFeed, minDiscount });
      if (!elig?.canScan) continue;

      const discount = cd.discountVal ?? 0;
      if (filterFn && !filterFn({ pid: cd.pid, card, discount })) continue;

      seenTargets.add(targetKey);
      targets.push({ pid: cd.pid, card, discount });
    }

    if (sortByDiscount) {
      targets.sort((a, b) => b.discount - a.discount);
    }

    const total = targets.length;
    let completed = 0;
    const newlyVerified = [];
    let nextIdx = 0;

    async function worker() {
      while (!isCancelled(signal, shouldCancelFn)) {
        const idx = nextIdx++;
        if (idx >= targets.length) break;
        const item = targets[idx];
        scanState.batchScanningPids.add(item.pid);
        scanState.currentlyScanningPid = item.pid;
        try {
          const badgeEl = item.card.querySelector('.badge-dif, [class*="badge-dif"]');
          if (badgeEl) {
            badgeEl.classList.add('tp-deal-loading');
            badgeEl.innerHTML = badgeEl.classList.contains('tp-deal-pill')
              ? '<span>⏳</span><p>Prüfe...</p>'
              : '<div class="text">Prüfe...</div><p>⏳</p>';
          }
        } catch {}

        let stats = null;
        try {
          // Pre-fetch identity guard: skip the fetch when the card detached or
          // was reused for another product while queued (post-fetch guard stays).
          if (item.card.isConnected && getCardProductId(item.card) === item.pid) {
            const cardBasis = extractCanonicalPrice(item.card).basis;
            const cardElig = scanEligibility(item.card);
            const forceFresh = cardElig.state === 'basis-mismatch';
            stats = await fetchSingleProductPriceStats(item.pid, 2, forceFresh, shouldCancelFn, (() => { try { const cp = extractCanonicalPrice(item.card).price; return Number.isFinite(cp) && cp > 0 ? cp : null; } catch { return null; } })(), signal, cardBasis);
            // Card-identity guard: reused/detached cards must not collect an
            // earlier request's verification.
            if (!(item.card.isConnected && getCardProductId(item.card) === item.pid)) stats = null;
            else if (stats) newlyVerified.push({ pid: item.pid, card: item.card });
          }
        } finally {
          scanState.batchScanningPids.delete(item.pid);
          if (scanState.currentlyScanningPid === item.pid) {
            scanState.currentlyScanningPid = scanState.batchScanningPids.values().next().value ?? null;
          }
        }

        completed++;
        Object.assign(scanState, { progress: { completed, total } });
        if (onProgress) onProgress(completed, total);
        // Progressive paint per card: renders newly verified deals and ensures
        // failed/null card fetches immediately restore non-loading badge state.
        triggerProcessListings();
        await interruptibleSleep(250, shouldCancelFn, signal);
      }
    }

    try {
      const worker1 = worker();
      const worker2 = (async () => {
        if (targets.length > 1) {
          await interruptibleSleep(125, shouldCancelFn, signal);
        }
        if (!isCancelled(signal, shouldCancelFn)) await worker();
      })();
      await Promise.all([worker1, worker2]);
    } finally {
      scanState.batchScanningPids.clear();
      Object.assign(scanState, { currentlyScanningPid: null });
    }

    triggerProcessListings();
    if (onComplete) onComplete(completed, total, newlyVerified);
    return { completed, total, newlyVerified };
  }

  async function runScan({ minDiscount = 30, onProgress = null, onComplete = null } = {}) {
    if (scanState.isBatchChecking) {
      Object.assign(scanState, { batchCancelRequested: true });
      try { batchController?.abort(); } catch {}
      return;
    }
    Object.assign(scanState, { isBatchChecking: true, batchCancelRequested: false });
    batchController = new AbortController();

    try {
      const isFeed = isNeueToppreisePage();
      await runProductScanner({
        isFeed,
        minDiscount,
        sortByDiscount: false,
        shouldCancelFn: (() => scanState.batchCancelRequested),
        onProgress,
        onComplete,
        signal: batchController.signal
      });
    } finally {
      Object.assign(scanState, { isBatchChecking: false, batchCancelRequested: false });
      triggerProcessListings();
    }
  }

  const runBatchDealCheck = (minDiscount = 30, onProgress = null, onComplete = null) =>
    runScan({ minDiscount, onProgress, onComplete });

  function cancelBatchDealCheck() {
    Object.assign(scanState, { batchCancelRequested: true });
    try { batchController?.abort(); } catch {}
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

  // ─── MODULE: src/ui/badges/dom-helpers.js ───────────────────────────────────
  /**
   * Badges DOM helpers (split from ui/badges.js): idempotent element painters.
   * Zero imports. Names frozen (toolbar, floating-cta import setTextIfChanged).
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

  // ─── MODULE: src/ui/badges/deal-badge.js ────────────────────────────────────
  /**
   * Deal badge (split from ui/badges.js): dealer memory + verify flow, card heat
   * wash (renderHeat) and badge verdict (renderBadgeVerdict, steps 0-4).
   * Both halves take one shared ctx computed once by the card-chrome orchestrator:
   * {card, pid, cardPrice, cardPriceEl, stats, diffVal, dealData, displayDelta,
   * heatInfo, effectiveDiff} — neither half recomputes (ADR-0005 single-source rule).
   */










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
    bumpCacheGeneration();
  }
  function clearDealerAutoTried() {
    dealerAutoTried.clear();
  }
  async function runSingleDealCheck(card, badgeDifEl) {
    if (badgeDifEl.classList.contains('tp-deal-loading')) return;
    const reqPid = getCardProductId(card);
    const cardPriceData = extractCanonicalPrice(card);
    const reqBasis = cardPriceData.basis;
    const reqPrice = cardPriceData.price;
    const reqCents = priceToCents(reqPrice);
    const isListView = badgeDifEl.classList.contains('tp-deal-pill');
    badgeDifEl.classList.add('tp-deal-loading');
    if (isListView) {
      badgeDifEl.innerHTML = `<span>⏳</span><p>Prüfe...</p>`;
    } else {
      badgeDifEl.innerHTML = `<div class="text">Prüfe...</div><p>⏳</p>`;
    }
    scanState.singleScanningPids.add(reqPid);
    let fetchedStats = null;
    try {
      fetchedStats = await fetchSingleProductPriceStats(reqPid, 1, true, null, Number.isFinite(reqPrice) && reqPrice > 0 ? reqPrice : null, null, reqBasis);
    } finally {
      scanState.singleScanningPids.delete(reqPid);
    }
    if (!card.isConnected || !badgeDifEl.isConnected || getCardProductId(card) !== reqPid || extractCanonicalPrice(card).basis !== reqBasis || priceToCents(extractCanonicalPrice(card).price) !== reqCents) {
      badgeDifEl.classList.remove('tp-deal-loading');
      triggerProcessListings();
      return;
    }
    badgeDifEl.classList.remove('tp-deal-loading');
    if (fetchedStats) {
      armFreshDismiss();
      markFreshVerified(reqPid);
      triggerProcessListings();
    } else {
      badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-not-low', 'tp-is-severe-markup');
      if (isListView) {
        badgeDifEl.innerHTML = `<span>⚠️</span><p>n/v</p>`;
      } else {
        badgeDifEl.innerHTML = `<div class="text">Fehler</div><p style="font-size: 13px;">⚠️ n/v</p>`;
      }
      badgeDifEl.title = '⚠️ Preishistorie zurzeit nicht verfügbar (Klicken für erneuten Versuch)';
      setTimeout(() => {
        if (badgeDifEl?.isConnected && !hasUsablePriceStats(getCardStats(reqPid, reqBasis))) {
          triggerProcessListings();
        }
      }, 2500);
    }
  }

  // Heatmap wash (blind): gray (no deal) -> red (max savings). Single hue
  // (ADR-0005: badge shows the blend, heat/sort follow it). heatInfo comes
  // from the orchestrator — never recomputed here.
  function renderHeat(ctx) {
    const { card, pid, stats, heatInfo, effectiveDiff } = ctx;
    const verified = hasUsablePriceStats(stats);
    const heatIntensity = CONFIG.HEATMAP_INTENSITY * (verified ? 1 : 0.35);
    // Blind inset wash: every heatable card gets the same prominent signal,
    // clipped to the card's own edges.
    if (CONFIG.HEATMAP_ENABLED && effectiveDiff !== null && !isNaN(effectiveDiff)) {
      const heatKey = `${effectiveDiff}_${heatIntensity.toFixed(2)}`;
      if (card.dataset.tpAppliedHeat !== heatKey) {
        card.dataset.tpAppliedHeat = heatKey;
        const heat = getInsetHeatStyle(heatInfo.pct, heatIntensity);
        card.classList.toggle('tp-heat-blend', true);
        card.style.setProperty('--tp-heat-glow', heat.glow);
        card.style.setProperty('--tp-heat-color', heat.color);
        card.style.setProperty('box-shadow', heat.glow, 'important');
      }
      // Badge follows the card heat: same ramp, solid swatch. Synced on every
      // render (not only on heatKey change) so re-rendered badge nodes can't
      // desync from the card. Verified-only: unverified cards keep the striped
      // `.tp-is-unverified` cue on the badge while the card body still glows.
      const heatBadgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
      if (heatBadgeEl && hasUsablePriceStats(stats)) {
        const badgeHeat = getBadgeHeatStyle(effectiveDiff, false, CONFIG.HEATMAP_INTENSITY);
        heatBadgeEl.style.setProperty('background', badgeHeat.background, 'important');
        heatBadgeEl.style.setProperty('border-color', badgeHeat.border, 'important');
        heatBadgeEl.style.setProperty('color', '#ffffff', 'important');
        heatBadgeEl.style.setProperty('box-shadow', '0 2px 10px rgba(0,0,0,0.45)', 'important');
      }
      else if (heatBadgeEl) {
        heatBadgeEl.style.removeProperty('background');
        heatBadgeEl.style.removeProperty('border-color');
        heatBadgeEl.style.removeProperty('color');
        heatBadgeEl.style.removeProperty('box-shadow');
      }
    } else if (card.dataset.tpAppliedHeat || card.classList.contains('tp-heat-blend') || card.querySelector('.badge-dif, [class*="badge-dif"]')?.style.background) {
      // Tripwire: heat stripped while the badge still claims a verified % means
      // a stats regression slipped through — enable DEBUG to catch it live.
      if (CONFIG.DEBUG && card.querySelector('.tp-deal-alltime-low, .tp-deal-new-record')) {
        console.warn('[Toppreise Suite] heat removed with verified badge present',
          { pid, median: stats?.medianPrice ?? null, tiefstpreis: stats?.tiefstpreis ?? null });
      }
      delete card.dataset.tpAppliedHeat;
      card.style.removeProperty('box-shadow');
      card.classList.remove('tp-heat-blend');
      card.style.removeProperty('--tp-heat-glow');
      card.style.removeProperty('--tp-heat-color');
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
     if (isScanningPid(pid)) {
      card.classList.remove('tp-is-verified');
     } else if (hasUsablePriceStats(stats)) {
       card.classList.add('tp-is-verified');
     } else {
      card.classList.remove('tp-is-verified');
     }
  }


  // Filter + dealer verdict (steps 2-3): hide/dim flags land on `filters`
  // (isFiltered/isDimmed/isDealerLoser) for the scan counters downstream.
  function renderFilterVerdict(ctx, filters, activeStores) {
    const { card, stats, cardPrice } = ctx;
    const filtersActive = CONFIG.FILTERS_ENABLED !== false;
    // 2. Filters
    card.classList.toggle('tp-negative-filtered', filtersActive && filters.isNeg);
    card.classList.toggle('tp-min-offers-filtered', filtersActive && filters.isLowOffers);
    card.classList.toggle('tp-deal-disc-filtered', filtersActive && !!filters.isBelowMinDiscount);
    card.classList.toggle('tp-price-filtered', filtersActive && !!filters.isOutOfPriceRange);
    card.classList.toggle('tp-savings-filtered', filtersActive && !!filters.isBelowMinSavings);
    card.classList.toggle('tp-vortief-excluded', filtersActive && filters.isVortiefExcluded === true);

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
      card.classList.toggle('tp-not-cheapest', filtersActive);
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
    const isHide = m => m !== 'dim' && m !== 'highlight';
    const wouldHide = (filters.isNeg && isHide(CONFIG.FILTER_NEG_MODE))
      || (filters.isLowOffers && isHide(CONFIG.FILTER_MIN_MODE))
      || (filters.isDealerLoser && isHide(CONFIG.DEALER_MODE))
      || (filters.isBelowMinDiscount && isHide(CONFIG.FILTER_DEAL_DISCOUNT_MODE))
      || (filters.isOutOfPriceRange && isHide(CONFIG.FILTER_PRICE_MODE))
      || (filters.isBelowMinSavings && isHide(CONFIG.FILTER_SAVINGS_MODE))
      || (filters.isVortiefExcluded && isHide(CONFIG.VORTIEF_MODE))
      || (filters.isUnchecked && isHide(CONFIG.HIDE_UNCHECKED_MODE));
    const wouldDim = !wouldHide && ((filters.isNeg && CONFIG.FILTER_NEG_MODE === 'dim')
      || (filters.isLowOffers && CONFIG.FILTER_MIN_MODE === 'dim')
      || (filters.isDealerLoser && CONFIG.DEALER_MODE === 'dim')
      || (filters.isBelowMinDiscount && CONFIG.FILTER_DEAL_DISCOUNT_MODE === 'dim')
      || (filters.isOutOfPriceRange && CONFIG.FILTER_PRICE_MODE === 'dim')
      || (filters.isBelowMinSavings && CONFIG.FILTER_SAVINGS_MODE === 'dim')
      || (filters.isVortiefExcluded && CONFIG.VORTIEF_MODE === 'dim')
      || (filters.isUnchecked && CONFIG.HIDE_UNCHECKED_MODE === 'dim'));
    const wouldHighlight = !wouldHide && !wouldDim && ((filters.isNeg && CONFIG.FILTER_NEG_MODE === 'highlight')
      || (filters.isLowOffers && CONFIG.FILTER_MIN_MODE === 'highlight')
      || (filters.isDealerLoser && CONFIG.DEALER_MODE === 'highlight')
      || (filters.isBelowMinDiscount && CONFIG.FILTER_DEAL_DISCOUNT_MODE === 'highlight')
      || (filters.isOutOfPriceRange && CONFIG.FILTER_PRICE_MODE === 'highlight')
      || (filters.isBelowMinSavings && CONFIG.FILTER_SAVINGS_MODE === 'highlight')
      || (filters.isVortiefExcluded && CONFIG.VORTIEF_MODE === 'highlight')
      || (filters.isUnchecked && CONFIG.HIDE_UNCHECKED_MODE === 'highlight'));

    filters.wouldHide = wouldHide;
    filters.wouldDim = wouldDim;
    filters.wouldHighlight = wouldHighlight;

    const hide = filtersActive && wouldHide;
    const dim = filtersActive && wouldDim;
    const highlight = filtersActive && wouldHighlight;

    filters.isFiltered = hide;   // narrowed: hidden-only (name kept, all consumers want hidden)
    filters.isDimmed = dim;
    filters.isHighlighted = highlight;
    card.classList.toggle('tp-filtered', hide);
    card.classList.toggle('tp-dimmed', dim);
    card.classList.toggle('tp-highlighted', highlight);
    const sortUnit = getCardSortableUnit(card);
    if (sortUnit && sortUnit !== card) sortUnit.classList.toggle('tp-col-filtered', hide);
  }

  // Badge setup (step 4 head): placement, first-render heat catch-up, discount
  // parse, single check-control binding. Returns null when there is no badge
  // node (caller runs the no-badge cleanup instead).
  function renderBadgeSetup(ctx, isNeueFeed) {
    const { card, pid, cardPriceEl, stats, effectiveDiff } = ctx;
    if (!pid) return null;
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
      // Snapshot keyed to product: a reused card node (new pid) must re-read
      // the host badge instead of printing the previous product's number.
      if (badgeDifEl.dataset.tpOriginalPid !== (pid ?? '') || !('tpOriginalDiscount' in badgeDifEl.dataset) || badgeDifEl.dataset.tpOriginalDiscount === '') {
        const initialDiscount = extractCardDiscount(card);
        badgeDifEl.dataset.tpOriginalDiscount = (initialDiscount !== null && !isNaN(initialDiscount)) ? String(initialDiscount) : '';
        badgeDifEl.dataset.tpOriginalPid = pid ?? '';
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
      return { badgeDifEl, isListView, sitePctText, rawDiscount };
    }
    return null;
  }

  // ─── MODULE: src/ui/badges/deal-verdict.js ──────────────────────────────────
  /**
   * Deal verdict (split from ui/badges.js): mode + browse badge verdicts.
   * renderBadgeVerdict runs badge setup (deal-badge.js) then one branch —
   * the blend stays single-sourced from ctx.heatInfo (ADR-0005).
   */








  // Tiefstpreis-mode verdict: ribbon prints the Gewichtete Differenz (blend).
  function renderModeVerdict(ctx, filters, badgeDifEl, isListView, sitePctText, rawDiscount) {
    const { card, pid, cardPrice, cardPriceEl, stats, dealData, displayDelta, heatInfo } = ctx;
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
          // the CHF-anchored split lives in the subline below. Neutral 0%-deals show 0%.
          const pctText = badgePct === 0 ? '0%' : `-${badgePct}%`;
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⚖️</span><p>${pctText}</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">⚖️</div><p>${pctText}</p>`);
          }

          // Tooltip: only what the card doesn't show (outlier count) + action hint.
          // Badge-% and both CHF legs live on ribbon/pill; color legend lives on
          // the heatmap button.
          const outlierTip = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? `ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert\n` : '';
          setTitleIfChanged(badgeDifEl, `${outlierTip}[Klicken: erneut prüfen]`);

          // Merged subline: CHF-anchored split with per-leg % (no blend words —
          // the ribbon above already shows it, so the short CHF tail survives
          // ellipsis on narrow cards).
          const showPrevLow = !!(prevLow && priceToCents(prevLow) > priceToCents(cardPrice));
          const showMedianLine = !!(medianVal && medianVal > cardPrice);
          const hasRecordPart = dealData.isNewRecord && dealData.dRecord > 0;
          let histPriceEl = ensureHistPriceEl(card, cardPriceEl);

          if (showPrevLow || showMedianLine || dealData.isZeroMargin) {
            const parts = [];
            if (showPrevLow) parts.push(`📉 CHF ${prevLow.toFixed(2)}${hasRecordPart ? ` (-${dealData.dRecord}%)` : ''}`);
            if (showMedianLine) parts.push(`Ø${horizonLabel} CHF ${medianVal.toFixed(2)} (-${dealData.dMedian}%)`);
            else if (dealData.isZeroMargin && medianVal) parts.push(`Ø${horizonLabel} CHF ${medianVal.toFixed(2)} (0%)`);
            if (dealData.isNewRecord && showPrevLow) {
              histPriceEl.className = 'tp-card-historical-price tp-is-record-low';
              setTextIfChanged(histPriceEl, parts.join(' · '));
              setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief: CHF ${prevLow.toFixed(2)} (-${dealData.dRecord}%)${showMedianLine ? ` · ${dealData.dMedian}% unter dem ${horizonLabel}-Median (CHF ${medianVal.toFixed(2)})` : ''}${outlierText}`);
            } else {
              histPriceEl.className = 'tp-card-historical-price tp-is-at-low' + (showPrevLow ? ' tp-with-prev' : '');
              setTextIfChanged(histPriceEl, parts.join(' · '));
              const sublineTip = dealData.isZeroMargin
                ? `Allzeit-Tiefstpreis! Entspricht dem ${horizonLabel}-Median von CHF ${medianVal.toFixed(2)} (0% Differenz).${outlierText}`
                : `Allzeit-Tiefstpreis!${showPrevLow ? ` Vorheriges Tief: CHF ${prevLow.toFixed(2)}.` : ''}${showMedianLine ? ` Liegt ${dealData.dMedian}% unter dem ${horizonLabel}-Median von CHF ${medianVal.toFixed(2)}.` : ''}${outlierText}`;
              setTitleIfChanged(histPriceEl, sublineTip);
            }
          } else {
            histPriceEl.remove();
          }
        } else if (hasUsablePriceStats(stats)) {
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
            badgeDifEl.classList.add('tp-deal-badge-interactive', 'tp-deal-alltime-low');
            badgeDifEl.classList.remove('tp-deal-not-low', 'tp-is-severe-markup');
            const prevLowNow = recordRefForPrice(stats, cardPrice).previousLow;
            const dropVsPrev = vortiefDropPct(cardPrice, stats);
            const hasPrevLowBase = prevLowNow && priceToCents(prevLowNow) > priceToCents(cardPrice);
            if (dropVsPrev > 0 && hasPrevLowBase) {
              setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · -${dropVsPrev}% vs. vorheriges Tief (CHF ${prevLowNow.toFixed(2)}) · Fallback-Tief ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>-${dropVsPrev}%</span><p>Tiefstpreis</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>-${dropVsPrev}%</p>`);
              }
            } else if (sitePctText) {
              setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · Differenz ${sitePctText} (ungeprüft) · Fallback-Tief ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
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
          if (filters.isUnchecked === true) card.classList.add('tp-unchecked-hidden');
          badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');

          if (isScanningPid(pid)) {
            badgeDifEl.classList.add('tp-deal-loading');
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>⏳</span><p>Prüfe...</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfe...</div><p>⏳</p>`);
            }
          } else {
            badgeDifEl.classList.remove('tp-deal-loading');
            if (rawDiscount !== null && !isNaN(rawDiscount)) {
              setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz, kein Tiefstpreis.\n[Klicken: echten Tiefstpreis prüfen]`);
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
  }

  // Browse verdict: verified low/markup ribbons + historical line, else loupe.
  function renderBrowseVerdict(ctx, filters, isNeueFeed, badgeDifEl, isListView, sitePctText, rawDiscount) {
    const { card, pid, cardPrice, cardPriceEl, stats, dealData, displayDelta, heatInfo } = ctx;
        card.classList.remove('tp-unchecked-hidden');
        badgeDifEl.classList.remove('tp-deal-new-record');

        if (isScanningPid(pid)) {
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

            if (badgePct > 0 || (dealData && dealData.weightedDiff === 0)) {
              // Tooltip: action hint only — badge + pill carry the verified numbers.
              setTitleIfChanged(badgeDifEl, '[Klicken: erneut prüfen]');
              const pctText = (dealData && dealData.weightedDiff === 0) ? '0%' : `-${badgePct}%`;
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>⚖️</span><p>${pctText}</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">⚖️</div><p>${pctText}</p>`);
              }
            } else if (realDropVsPrev > 0) {
              setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · -${realDropVsPrev}%${prevTip} · Fallback-Tief ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
              if (isListView) {
                setHtmlIfChanged(badgeDifEl, `<span>-${realDropVsPrev}%</span><p>Tiefstpreis</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>-${realDropVsPrev}%</p>`);
              }
            } else if (sitePctText) {
              setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · Differenz ${sitePctText} (ungeprüft) · Fallback-Tief ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
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
          const showMedianLine = !!(stats.medianPrice && stats.medianPrice > cardPrice);
          const horizonLabel = medianHorizonLabel(stats);
          let histPriceEl = card.querySelector('.tp-card-historical-price');
          if (isNonBest) {
            histPriceEl = ensureHistPriceEl(card, cardPriceEl);
            histPriceEl.className = 'tp-card-historical-price tp-is-markup';
            setTextIfChanged(histPriceEl, `Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)}`);
            setTitleIfChanged(histPriceEl, `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)`);
          } else if (showPrevLow || showMedianLine || dealData?.isZeroMargin) {
            histPriceEl = ensureHistPriceEl(card, cardPriceEl);
            const parts = [];
            const dMedBrowse = showMedianLine ? pctDrop(stats.medianPrice, cardPrice) : 0;
            if (showPrevLow) parts.push(`📉 CHF ${prevLow.toFixed(2)}${isNewRecord ? ` (-${realDropVsPrev}%)` : ''}`);
            if (showMedianLine) parts.push(`Ø${horizonLabel} CHF ${stats.medianPrice.toFixed(2)} (-${dMedBrowse}%)`);
            else if (dealData?.isZeroMargin && stats?.medianPrice) parts.push(`Ø${horizonLabel} CHF ${stats.medianPrice.toFixed(2)} (0%)`);
            histPriceEl.className = 'tp-card-historical-price ' + (isNewRecord && showPrevLow ? 'tp-is-record-low' : 'tp-is-at-low') + (showPrevLow ? ' tp-with-prev' : '');
            setTextIfChanged(histPriceEl, parts.join(' · '));
            if (isNewRecord && showPrevLow) {
              setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)${showMedianLine ? ` · Ø-Preis (${horizonLabel}): CHF ${stats.medianPrice.toFixed(2)}` : ''}`);
            } else {
              const sublineTip = dealData?.isZeroMargin
                ? `Allzeit-Tiefstpreis! Entspricht dem ${horizonLabel}-Median von CHF ${stats.medianPrice.toFixed(2)} (0% Differenz).`
                : `Allzeit-Tiefstpreis!${showPrevLow ? ` Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)}.` : ''}${showMedianLine ? ` Liegt ${dMedBrowse}% unter dem ${horizonLabel}-Median von CHF ${stats.medianPrice.toFixed(2)}.` : ''}`;
              setTitleIfChanged(histPriceEl, sublineTip);
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
            setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz, kein Tiefstpreis (grau gestreift).\n[Klicken: echten Tiefstpreis prüfen]`);
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

  // Step-4 orchestrator: setup first, then the mode/browse branch — the
  // no-badge cleanup mirrors the original else path.
  function renderBadgeVerdict(ctx, filters, isNeueFeed) {
    const { card, pid } = ctx;
    const setup = renderBadgeSetup(ctx, isNeueFeed);
    if (!setup) {
      card.classList.remove('tp-unchecked-hidden');
      card.querySelector('.tp-card-historical-price')?.remove();
      return;
    }
    const { badgeDifEl, isListView, sitePctText, rawDiscount } = setup;
    if (CONFIG.BESTPREISE_MODE_ACTIVE) renderModeVerdict(ctx, filters, badgeDifEl, isListView, sitePctText, rawDiscount);
    else renderBrowseVerdict(ctx, filters, isNeueFeed, badgeDifEl, isListView, sitePctText, rawDiscount);
    // Script paint marker: extractCardDiff must never re-parse our ribbon text
    // as the site Differenz after a cache clear (dedicated script-owned badge
    // replacing host-badge rewrites is out of scope).
    if (badgeDifEl.isConnected) {
      badgeDifEl.dataset.tpPainted = 'true';
      badgeDifEl.dataset.tpOriginalPid = pid ?? '';
      badgeDifEl.dataset.tpPaintedText = badgeDifEl.textContent ?? '';
    }
  }

  // ─── MODULE: src/ui/badges/card-share.js ────────────────────────────────────
  /**
   * Card Share Button
   * Discord 1-Click share button, click-time freshness validation, payload construction,
   * image/forum transport orchestration, and feedback toasts.
   */














  async function sendDealToChannel(channel, payload, stillFresh) {
    const hook = channel.url.trim();
    const flagKey = discordForumFlagKey(hook);
    const forum = _getValue(flagKey, false) === true;
    const { content, forumContent, threadName, png, productOpt } = payload;

    const postText = withThread => postDealToDiscord(hook, withThread ? forumContent : content, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });
    const postImage = withThread => postDealImageToDiscord(hook, withThread ? forumContent : content, png, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });

    const tryRound = async withThread => {
      if (!stillFresh()) throw Object.assign(new Error('stale-before-post'), { stale: true });
      if (png) {
        try {
          await postImage(withThread);
          return;
        } catch (imgErr) {
          if (isForumThreadError(imgErr)) {
            if (!withThread) throw imgErr;
          } else if (!isAttachmentRejection(imgErr)) {
            throw imgErr;
          }
        }
      }
      if (!stillFresh()) throw Object.assign(new Error('stale-before-post'), { stale: true });
      await postText(withThread);
    };

    for (const withThread of (forum ? [true, false] : [false, true])) {
      try {
        await tryRound(withThread);
        if (withThread !== forum) _setValue(flagKey, withThread);
        break;
      } catch (err) {
        if (!isForumThreadError(err) || withThread) throw err;
      }
    }
  }

  // Share dedupe surviving button re-renders: duplicate clicks for the same
  // pid:basis:price post once (button disabled alone is not enough).
  const shareInFlight = new Set();

  // Discord 1-click share (step 7): verified lows only.
  function renderShareButton(ctx, cd) {
    const { card } = ctx;
    // 7. Discord 1-Klick-Share (nur verifizierte Tiefstpreise, nie Schein-Rabatte).
    // Render-time gate from the basis-guarded ctx; the click handler below
    // re-resolves everything from the live card — never from this closure.
    const basisOk = cd?.basisMatches ?? basisMatchesFor(ctx.stats, cd?.cardPriceBasis);
    const kindNow = ctx.displayDelta?.kind ?? (basisOk ? getDisplayDelta(ctx.cardPrice, ctx.stats).kind : 'unknown');
    const isShareable = !!(ctx.dealData || kindNow === 'new-low' || kindNow === 'at-low');
    let shareBtn = card.querySelector(':scope > .tp-share-btn');
    if (isShareable) {
      if (!shareBtn) {
        shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'tp-share-btn';
        shareBtn.textContent = '📤';
        shareBtn.title = 'Tiefstpreis in Discord teilen';
        shareBtn.addEventListener('click', async e => {
          e.preventDefault();
          e.stopPropagation();
          const channels = getDiscordChannels().filter(c => isDiscordWebhookUrl(c.url));
          if (channels.length === 0) {
            showToast('Discord-Webhook fehlt – in den Einstellungen (⚙️) eintragen');
            return;
          }
          // Click-time resolve: the card may have been reused or repainted
          // since render — shareability is re-derived from the live card.
          const fresh = extractCardData(card);
          const freshKind = fresh.displayDelta?.kind;
          if (!(fresh.dealScore || freshKind === 'new-low' || freshKind === 'at-low')) {
            showToast('Kein verifizierter Tiefstpreis mehr – Karte wird neu geprüft');
            scheduleProcessListings();
            return;
          }
          const snap = { pid: fresh.pid, priceCents: priceToCents(fresh.cardPrice), basis: fresh.cardPriceBasis };
          const stillFresh = () => {
            if (!card.isConnected) return false;
            const cur = extractCardData(card);
            if (cur.pid !== snap.pid || cur.cardPriceBasis !== snap.basis
              || priceToCents(cur.cardPrice) !== snap.priceCents) return false;
            // Shareability can lapse while price/pid/basis hold (cache
            // eviction): re-derive the click-time verdict so the green paint
            // never rewards a deal that is no longer verifiable.
            const curKind = cur.displayDelta?.kind;
            return !!(cur.dealScore || curKind === 'new-low' || curKind === 'at-low');
          };
          const abortStale = () => {
            showToast('Karte hat sich geändert – erneut prüfen');
            scheduleProcessListings();
          };
          const shareKey = `${snap.pid}:${snap.basis}:${snap.priceCents}`;
          if (shareInFlight.has(shareKey)) { showToast('Teilen läuft bereits'); return; }
          shareInFlight.add(shareKey);
          shareBtn.disabled = true;

          let preview = null;
          let readyPayload = null;

          const onCancel = () => {
            shareInFlight.delete(shareKey);
            shareBtn.disabled = false;
          };

          const onSend = async (targetChannel, controller) => {
            if (!readyPayload) return;
            try {
              await sendDealToChannel(targetChannel, readyPayload, stillFresh);
              controller.close();
              shareInFlight.delete(shareKey);
              shareBtn.disabled = false;
              if (snap.pid && snap.priceCents > 0) setSharedDeal(snap.pid, snap.priceCents);
              showToast(`📤 Deal in #${targetChannel.name} geteilt`);
              if (stillFresh()) shareBtn.classList.add('tp-share-done');
              else { showToast('📤 Deal geteilt – Karte hat sich danach geändert'); scheduleProcessListings(); }
            } catch (err) {
              if (err?.stale) {
                controller.close();
                shareInFlight.delete(shareKey);
                shareBtn.disabled = false;
                abortStale();
              } else if (err?.status === 429) {
                controller.setError('⏳ Discord-Limit – später erneut versuchen');
              } else if (!err?.status) {
                controller.setError('⚠️ Übermittlung nicht bestätigt — bitte Verbindung prüfen');
              } else {
                controller.setError(err?.message ? `Fehler: ${err.message}` : 'Teilen fehlgeschlagen');
              }
            }
          };

          const { title, url, imageUrl } = extractShareData(card);
          const priceText = fresh.cardPrice > 0 ? `CHF ${fresh.cardPrice.toFixed(2)}` : '';

          preview = openSharePreviewModal({
            channels,
            onSend,
            onCancel
          });

          // Background asset preparation runs in parallel with preview display
          (async () => {
            try {
              const productDl = imageUrl ? fetchImageBlob(imageUrl).catch(() => null) : null;
              let aiPromise = null;
              if (CONFIG.TAVILY_ENABLED && String(CONFIG.DISCORD_LAYOUT || '').includes('{ai}') && CONFIG.TAVILY_API_KEY && CONFIG.TAVILY_API_KEY.trim()) {
                const query = buildTavilyQuery(title, CONFIG.REVIEW_SEARCH_KEYWORD, priceText);
                const cached = getCachedTavily(query);
                if (cached?.answer) {
                  aiPromise = Promise.resolve(cached.answer);
                } else {
                  aiPromise = fetchTavilySummary(CONFIG.TAVILY_API_KEY, query, { timeoutMs: 4000 }).catch(() => '');
                }
              }
              const useShipping = snap.basis ? snap.basis === 'shipping' : isShippingPriceActive(card);
              let dealer = extractDealer(card, useShipping);
              let dealerUrl = extractDealerUrl(card, useShipping);
              const cachedDealer = getCachedDealer(snap.pid, useShipping);
              let loadedOffers = fresh.offerCount || cachedDealer?.offers || 0;
              let totalOffers = cachedDealer?.totalOffers || 0;
              let offers = totalOffers || loadedOffers;
              if ((!dealer || !dealerUrl || !offers) && url) {
                const info = await fetchProductInfo(url, undefined, useShipping).catch(() => null);
                if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
                if (info) {
                  dealer = dealer || info.dealer;
                  dealerUrl = dealerUrl || info.dealerUrl;
                  loadedOffers = loadedOffers || info.offers || 0;
                  totalOffers = totalOffers || info.totalOffers || 0;
                  offers = totalOffers || loadedOffers;
                  if (info.dealer) {
                    const dKey = `${snap.pid}:${useShipping ? 's' : 'p'}`;
                    lruSet(dealerCache, dKey, { dealer: info.dealer, url: info.dealerUrl || '', offers: loadedOffers, totalOffers });
                    setCachedDealer(snap.pid, useShipping, info.dealer, info.dealerUrl || '', undefined, loadedOffers, totalOffers);
                  }
                }
              }
              const isAmazon = ((dealer && /amazon/i.test(dealer)) || (dealerUrl && /amazon\./i.test(dealerUrl))) && CONFIG.KEEPA_CHART_ENABLED !== false;
              let keepaDl = null;
              if (isAmazon) {
                keepaDl = (async () => {
                  const asin = await resolveAmazonAsin(dealerUrl, snap.pid).catch(() => null);
                  if (!asin) return null;
                  const keepaUrl = buildKeepaUrl(asin);
                  return keepaUrl ? fetchImageBlob(keepaUrl).catch(() => null) : null;
                })();
              }
              const png = await renderSparklinePng(withLivePrice(fresh.verifiedStats?.timeSeries, fresh.cardPrice), 360, 100, title).catch(() => null);
              if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
              const keepaBlob = keepaDl ? await keepaDl : null;
              if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
              const aiText = aiPromise ? (await aiPromise) : '';
              if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
              const fields = {
                title, url, priceText,
                dealer, dealerUrl, offerCount: offers,
                aiText,
                ...resolveShareFields(fresh.cardPrice, fresh.verifiedStats),
                suppressDealerEmbed: CONFIG.DISCORD_SUPPRESS_DEALER_EMBED !== false,
                suppressProductEmbed: CONFIG.DISCORD_SUPPRESS_PRODUCT_EMBED !== false
              };
              const content = formatDealMessage(fields, CONFIG.DISCORD_LAYOUT);
              const forumContent = CONFIG.DISCORD_FORUM_TITLE ? content : formatDealMessage({ ...fields, forceLink: true }, forumRecipeFor(CONFIG.DISCORD_LAYOUT));
              const threadName = buildThreadName(title);
              const productBlob = (png && productDl) ? await productDl : null;
              if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
              const productOpt = {
                ...(productBlob ? { productImageBlob: productBlob } : null),
                ...(imageUrl ? { productImageUrl: imageUrl } : null),
                ...(keepaBlob ? { keepaImageBlob: keepaBlob } : null)
              };
              readyPayload = {
                content,
                forumContent,
                threadName,
                png,
                productBlob,
                keepaBlob,
                productOpt
              };
              preview?.updateContent({
                formattedContent: content,
                chartBlob: png,
                productBlob,
                keepaBlob
              });
            } catch (err) {
              preview?.setError('Vorbereitung fehlgeschlagen');
            }
          })();
        });
        // Eigener Positioning-Kontext: Host-CSS garantiert kein relative (ausser .tp-is-cheapest).
        if (card.style.position === '' && getComputedStyle(card).position === 'static') card.style.position = 'relative';
        card.appendChild(shareBtn);
      }
      shareBtn.style.display = '';
      shareBtn.classList.toggle('tp-share-done', !!(ctx.pid && ctx.cardPrice > 0 && getSharedDeal(ctx.pid, priceToCents(ctx.cardPrice))));
    } else {
      shareBtn?.remove();
    }
  }

  // ─── MODULE: src/ui/badges/card-ai-popover.js ───────────────────────────────
  /**
   * On-Card AI Verdict Popover Component
   * Renders an accessible floating modal (#tp-ai-popout) displaying a synthesized
   * Tavily test report verdict and quick-action buttons (Google, Copy, Discord).
   */




  function formatVerdictHtml(text) {
    if (!text) return '';
    const escaped = String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    return escaped
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/(^|\n)[ \t]*[-*][ \t]+/g, '$1• ');
  }

  let activeAiPopoverCleanup = null;

  function closeAiPopover() {
    if (typeof activeAiPopoverCleanup === 'function') {
      const fn = activeAiPopoverCleanup;
      activeAiPopoverCleanup = null;
      fn();
      return;
    }
    const el = typeof document !== 'undefined' ? document.getElementById('tp-ai-popout') : null;
    el?.remove();
  }

  function openAiPopover(options = {}) {
    if (typeof document === 'undefined') return null;
    closeAiPopover();

    const { title = '', priceText = '', googleUrl = '', card = null } = options;
    const prevFocus = typeof document.activeElement !== 'undefined' ? document.activeElement : null;

    const query = buildTavilyQuery(title, CONFIG.REVIEW_SEARCH_KEYWORD, priceText);
    const cached = getCachedTavily(query);

    const backdrop = document.createElement('div');
    backdrop.id = 'tp-ai-popout';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'KI-Fazit und Preiseinschätzung');
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.45);backdrop-filter:blur(2px);padding:16px;box-sizing:border-box;';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--tp-bg, #1e293b);color:var(--tp-txt, #f8fafc);border:1px solid var(--tp-line-soft, #334155);border-radius:var(--tp-r-lg, 12px);padding:18px 20px;max-width:min(520px,94vw);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);box-sizing:border-box;display:flex;flex-direction:column;gap:12px;';

    // Header row
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--tp-line-soft, #334155);padding-bottom:10px;';

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:var(--tp-txt-mid, #cbd5e1);';
    titleRow.innerHTML = '<span>🤖 KI-Kurzfazit & Preiseinschätzung</span>';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Schliessen');
    closeBtn.style.cssText = 'background:transparent;border:0;color:var(--tp-mut, #94a3b8);font-size:16px;cursor:pointer;padding:4px 8px;border-radius:4px;line-height:1;';
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#fff'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = 'var(--tp-mut, #94a3b8)'; });

    header.appendChild(titleRow);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Subheader: Product title & price
    const subheader = document.createElement('div');
    subheader.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:10px;';

    const prodName = document.createElement('div');
    prodName.style.cssText = 'font-size:14px;font-weight:600;color:var(--tp-txt, #f8fafc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
    prodName.textContent = title;
    prodName.title = title;

    subheader.appendChild(prodName);
    if (priceText) {
      const priceBadge = document.createElement('span');
      priceBadge.style.cssText = 'font-size:13px;font-weight:700;color:#10b981;white-space:nowrap;background:rgba(16,185,129,0.12);padding:2px 6px;border-radius:4px;';
      priceBadge.textContent = priceText;
      subheader.appendChild(priceBadge);
    }
    panel.appendChild(subheader);

    // Body content: loading / result / error
    const contentEl = document.createElement('div');
    contentEl.style.cssText = 'font-size:13px;line-height:1.55;color:var(--tp-txt-mid, #cbd5e1);min-height:56px;max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,0.18);padding:12px;border-radius:8px;border-left:3px solid #5865f2;';

    let currentVerdict = '';
    let statusTimers = [];
    const clearTimers = () => {
      statusTimers.forEach(t => clearTimeout(t));
      statusTimers = [];
    };

    const renderVerdict = (text) => {
      clearTimers();
      currentVerdict = text;
      contentEl.style.borderLeftColor = '#5865f2';
      contentEl.innerHTML = formatVerdictHtml(text);
      copyBtn.disabled = false;
      retryBtn.style.display = 'none';
    };

    const renderError = (msg) => {
      clearTimers();
      contentEl.style.borderLeftColor = '#ef4444';
      contentEl.innerHTML = `<span style="color:#ef4444;font-weight:600;">⚠️ ${msg}</span><br><span style="font-size:12px;opacity:0.85;margin-top:4px;display:inline-block;">Du kannst stattdessen direkt die Google-Suche öffnen.</span>`;
      copyBtn.disabled = true;
      retryBtn.style.display = 'inline-flex';
    };

    if (cached?.answer) {
      renderVerdict(cached.answer);
    } else {
      contentEl.innerHTML = '<span style="opacity:0.75;">🤖 Analysiere Testberichte & Preiseinschätzung...</span>';
    }
    panel.appendChild(contentEl);

    // Footer action buttons
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:4px;';

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'tp-btn tp-btn-secondary';
    retryBtn.style.cssText = 'padding:6px 12px;font-size:12px;display:none;align-items:center;gap:4px;border-radius:6px;cursor:pointer;';
    retryBtn.textContent = '🔄 Erneut versuchen';

    const fetchSummary = () => {
      clearTimers();
      retryBtn.style.display = 'none';
      contentEl.style.borderLeftColor = '#5865f2';
      contentEl.innerHTML = '<span style="opacity:0.75;">🤖 Analysiere Testberichte & Preiseinschätzung...</span>';

      statusTimers.push(setTimeout(() => {
        if (backdrop.isConnected && !currentVerdict) {
          contentEl.innerHTML = '<span style="opacity:0.85;">🤖 Websuche läuft noch (Testberichte werden analysiert)...</span>';
        }
      }, 5000));

      statusTimers.push(setTimeout(() => {
        if (backdrop.isConnected && !currentVerdict) {
          contentEl.innerHTML = '<span style="opacity:0.85;">⏳ Synthese dauert etwas länger, läuft im Hintergrund weiter...<br><span style="font-size:12px;opacity:0.75;margin-top:4px;display:inline-block;">Antwort erscheint hier automatisch sobald fertig.</span></span>';
        }
      }, 12000));

      fetchTavilySummary(CONFIG.TAVILY_API_KEY, query, {
        timeoutMs: 60000,
        searchDepth: CONFIG.TAVILY_SEARCH_DEPTH,
        maxResults: CONFIG.TAVILY_MAX_RESULTS
      })
        .then(answer => {
          if (backdrop.isConnected) {
            renderVerdict(answer);
          }
        })
        .catch(err => {
          if (backdrop.isConnected) {
            renderError(err?.message || 'Fehler beim Laden des Fazits');
          }
        });
    };

    retryBtn.addEventListener('click', fetchSummary);

    const googleBtn = document.createElement('a');
    googleBtn.href = googleUrl || ('https://www.google.com/search?q=' + encodeURIComponent(query));
    googleBtn.target = '_blank';
    googleBtn.rel = 'noopener';
    googleBtn.className = 'tp-btn tp-btn-secondary';
    googleBtn.style.cssText = 'padding:6px 12px;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;border-radius:6px;';
    googleBtn.textContent = '↗ Google-Suche';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'tp-btn tp-btn-secondary';
    copyBtn.style.cssText = 'padding:6px 12px;font-size:12px;display:inline-flex;align-items:center;gap:4px;border-radius:6px;cursor:pointer;';
    copyBtn.textContent = '📋 Fazit kopieren';
    copyBtn.disabled = !cached?.answer;

    copyBtn.addEventListener('click', () => {
      if (!currentVerdict) return;
      if (typeof navigator?.clipboard?.writeText === 'function') {
        navigator.clipboard.writeText(currentVerdict).then(() => {
          copyBtn.textContent = '✅ Kopiert!';
          setTimeout(() => { copyBtn.textContent = '📋 Fazit kopieren'; }, 1800);
        }).catch(() => {
          showToast('Kopieren fehlgeschlagen');
        });
      }
    });

    const discordBtn = document.createElement('button');
    discordBtn.type = 'button';
    discordBtn.className = 'tp-btn tp-btn-secondary';
    discordBtn.style.cssText = 'padding:6px 12px;font-size:12px;display:inline-flex;align-items:center;gap:4px;border-radius:6px;cursor:pointer;';
    discordBtn.textContent = '📤 In Discord teilen';

    discordBtn.addEventListener('click', () => {
      const shareBtn = card?.querySelector('.tp-share-btn');
      if (shareBtn && typeof shareBtn.click === 'function') {
        close();
        shareBtn.click();
      } else {
        showToast('Deals können nur bei verifizierten Tiefstpreisen geteilt werden');
      }
    });

    footer.appendChild(retryBtn);
    footer.appendChild(googleBtn);
    footer.appendChild(copyBtn);
    footer.appendChild(discordBtn);
    panel.appendChild(footer);

    // Close handlers
    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        close();
      }
    };

    function close() {
      clearTimers();
      document.removeEventListener('keydown', onKey);
      activeAiPopoverCleanup = null;
      backdrop.remove();
      try { prevFocus?.focus?.(); } catch {}
    }

    activeAiPopoverCleanup = close;
    document.addEventListener('keydown', onKey);
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close();
    });

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    closeBtn.focus?.();

    // If not cached, trigger fetch now
    if (!cached?.answer) {
      fetchSummary();
    }

    return backdrop;
  }

  // ─── MODULE: src/ui/badges/card-chrome.js ───────────────────────────────────
  /**
   * Card chrome (split from ui/badges.js): sparkline row, verified cue, share
   * button, dealer name, review button, fresh glow, empty state — plus the
   * renderCardEffects orchestrator (signature frozen, app.js untouched).
   */





















  // Mini price-trend sparkline + history strip (step 5).
  function renderSparklineRow(ctx) {
    const { card, pid: rawPid, cardPrice, cardPriceEl, stats } = ctx;
    const pid = rawPid || card?.dataset?.tpProductId || null;
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
      // Revision-aware: same length/price/median with refreshed points (new
      // fetch, recomputed median) must rebuild instead of showing stale art.
      const lastTs = stats.timeSeries.length ? +stats.timeSeries[stats.timeSeries.length - 1][0] || 0 : 0;
      const sig = [stats.timeSeries.length, priceToCents(cardPrice), priceToCents(stats.medianPrice ?? 0), stats.time || 0, lastTs].join(':');
      const useShipping = isShippingPriceActive(card);
      const cachedDealer = getCachedDealer(pid, useShipping);
      const dealerName = cachedDealer?.dealer || extractDealer(card, useShipping) || '';
      const isAmazon = /amazon/i.test(dealerName) && CONFIG.KEEPA_CHART_ENABLED !== false;
      sparkContainer.classList.toggle('tp-sparkline-amazon', isAmazon);
      sparkContainer.style.cursor = 'pointer';
      sparkContainer.setAttribute('role', 'button');
      sparkContainer.setAttribute('tabindex', '0');
      sparkContainer.setAttribute('title', isAmazon ? 'Preisverlauf vergrössern (inkl. Amazon / Keepa)' : 'Preisverlauf vergrössern');
      if (!sparkContainer.dataset.tpPopoutBound) {
        sparkContainer.dataset.tpPopoutBound = 'true';
        const openPopout = () => {
          const shareData = extractShareData(card);
          const title = shareData?.title || '';
          const currentCached = getCachedDealer(pid, useShipping);
          const currentDealer = currentCached?.dealer || extractDealer(card, useShipping) || '';
          const directUrl = currentCached?.url || (currentDealer ? extractDealerUrl(card, useShipping) : '');
          openSparklinePopout(sparkContainer._tpSeries, { title, pid, directUrl, dealer: currentDealer });
        };
        sparkContainer.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          openPopout();
        });
        sparkContainer.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            openPopout();
          }
        });
      }
      if (sparkContainer.dataset.tpSparkSig !== sig) {
        sparkContainer.dataset.tpSparkSig = sig;
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
  }

  // Badge verified/unverified cue (step 6).
  function applyVerifiedCue(ctx) {
    const { card, stats } = ctx;
    // 6. Badge geprüft/ungeprüft cue (always on): striped-gray ribbon when
    // unchecked, solid heat ribbon when verified. Loading badge gets neither.
    const badgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
    if (badgeEl) {
      if (badgeEl.classList.contains('tp-deal-loading')) {
        badgeEl.classList.remove('tp-is-unverified', 'tp-is-verified');
      } else if (!hasUsablePriceStats(stats)) {
        // Negative markers ({unavailable:true}) and thin histories are not
        // verified — truthiness of the stats object must not imply quality.
        badgeEl.classList.add('tp-is-unverified');
        badgeEl.classList.remove('tp-is-verified');
      } else {
        badgeEl.classList.add('tp-is-verified');
        badgeEl.classList.remove('tp-is-unverified');
      }
    }
  }



  // Dealer name left of price (step 8). Owns the loadDealer closure.
  function renderDealerName(ctx, filters) {
    const { card, pid, cardPriceEl, stats, heatInfo } = ctx;
    // 8. Händlername links neben dem Preis: nur geprüfte Karten (stats != null).
    // Katalog löst synchron aus extractDealer (kein Fetch); Feed ohne DOM-Zeile
    // bekommt einen 🏬-Button, der fetchProductInfo einmalig pro pid:Modus holt
    // (dealerCache + dealerPending-Guard) und danach neu rendert — oder bei
    // DEALER_AUTOFETCH denselben Loader ohne Klick (1×/Pageload, max. 3 parallel).
    // Der Name verlinkt direkt aufs Händlerangebot (/ext_de aus dem Fetch bzw.
    // Zeilenlink), Fallback ist die Produktseite — immer neuer Tab.
    const dealerEl = card.querySelector('.tp-dealer-name');
    if (!hasUsablePriceStats(stats) || !pid) {
      dealerEl?.remove();
    } else {
      const useShipping = isShippingPriceActive(card);
      const dKey = `${pid}:${useShipping ? 's' : 'p'}`;
      let dealer = extractDealer(card, useShipping);
      if (!dealer && !dealerCache.has(dKey) && !dealerHydrated.has(dKey)) {
        if (dealerHydrated.size > 1000) dealerHydrated.clear();
        dealerHydrated.add(dKey);
        const stored = getCachedDealer(pid, useShipping);
        if (stored?.dealer) lruSet(dealerCache, dKey, stored);
      }
      const cached = dealerCache.get(dKey);
      if (!dealer && cached?.dealer) dealer = cached.dealer;
      const { url: productUrl } = extractShareData(card);
      const directUrl = cached?.url || (dealer ? extractDealerUrl(card, useShipping) : '');
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
          // Stale-write guard: a clear/reset mid-flight voids the write; the
          // basis snapshot avoids resolving the live mode after the await.
          const reqGen = currentCacheGen();
          const reqShipping = useShipping;
          const reqKey = dKey;
          try {
            const info = await fetchProductInfo(productUrl, undefined, reqShipping).catch(() => null);
            if (reqGen !== currentCacheGen()) return;
            if (info?.dealer) { lruSet(dealerCache, reqKey, { dealer: info.dealer, url: info.dealerUrl || '', offers: info.offers || 0, totalOffers: info.totalOffers || 0 }); setCachedDealer(pid, reqShipping, info.dealer, info.dealerUrl || '', undefined, info.offers || 0, info.totalOffers || 0); }
          } finally {
            dealerPending.delete(dKey);
          }
          scheduleProcessListings();
        };
        let btn = dealerEl?.dataset.tpDealerPid === dKey && dealerEl.tagName === 'BUTTON' ? dealerEl : null;
        if (!btn) {
          dealerEl?.remove();
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'tp-dealer-name tp-dealer-btn';
          btn.textContent = '🏬';
          btn.setAttribute('aria-label', 'Händler laden');
          btn.title = 'Günstigsten Händler laden (eine Abfrage je Produkt)';
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
        // Nur ausführen, wenn die effektive Badge-% die gesetzte Schwelle erreicht.
        const isMarkup = ctx.displayDelta?.kind === 'above-low' || heatInfo?.kind === 'markup';
        const effectivePct = !isMarkup
          ? (heatInfo?.pct ?? ctx.dealData?.weightedDiff ?? 0)
          : 0;
        const meetsDealThreshold = effectivePct >= realDealMinDiscount();
        if (!filters?.isFiltered && CONFIG.DEALER_AUTOFETCH === true && meetsDealThreshold && !dealerAutoTried.has(dKey) && !dealerPending.has(dKey) && dealerPending.size < 3) {
          dealerAutoTried.add(dKey);
          btn.disabled = true;
          loadDealer();
        }
      } else {
        dealerEl?.remove();
      }
    }
  }

  // Review search on product name (step 9).
  function renderReviewButton(ctx) {
    const { card } = ctx;
    // 9. Review-Suche (🌐) am Produktnamen: Ansicht, immer wenn aktiviert.
    // Titelquelle ist extractShareData (single source of truth, kein 2. Parser).
    const reviewName = (extractShareData(card).title || '').replace(/\s+/g, ' ').trim();
    if (CONFIG.REVIEW_SEARCH_ENABLED !== false && reviewName) {
      const rawKw = sanitizeReviewKeyword(CONFIG.REVIEW_SEARCH_KEYWORD);
      const priceText = (ctx.cardPrice > 0 && hasUsablePriceStats(ctx.stats)) ? `CHF ${ctx.cardPrice.toFixed(2)}` : '';
      const fullQuery = formatSearchQuery(reviewName, rawKw, priceText);
      const aiMode = CONFIG.REVIEW_SEARCH_AI_MODE === true;
      const hasTavily = !!(CONFIG.TAVILY_ENABLED && CONFIG.TAVILY_API_KEY && CONFIG.TAVILY_API_KEY.trim());
      let reviewBtn = card.querySelector('.tp-review-search-btn');
      if (!reviewBtn) {
        reviewBtn = document.createElement('a');
        reviewBtn.className = 'tp-review-search-btn';
        reviewBtn.textContent = '🌐';
        reviewBtn.target = '_blank';
        reviewBtn.rel = 'noopener';
        reviewBtn.addEventListener('click', e => {
          e.stopPropagation();
          if (CONFIG.TAVILY_ENABLED) {
            if (CONFIG.TAVILY_API_KEY && CONFIG.TAVILY_API_KEY.trim()) {
              e.preventDefault();
              const aiCtx = reviewBtn._tpAiCtx || {};
              openAiPopover({
                title: aiCtx.title || reviewName,
                priceText: aiCtx.priceText || '',
                googleUrl: reviewBtn.href,
                card: aiCtx.card || card,
                pid: aiCtx.pid || ctx.pid
              });
            } else {
              showToast('💡 Tipp: Kostenlosen Tavily-Key in den Einstellungen (⚙️) hinterlegen für Direkt-Fazit auf der Karte');
            }
          }
        });
      }
      reviewBtn._tpAiCtx = { title: reviewName, priceText, card, pid: ctx.pid };
      reviewBtn.href = 'https://www.google.com/search?q=' + encodeURIComponent(fullQuery) + (aiMode ? '&udm=50' : '');
      const tipText = hasTavily
        ? `KI-Fazit & Google-Suche: ${fullQuery}`
        : `Google-Suche: ${fullQuery}${aiMode ? ' (KI-Modus)' : ''}`;
      setTitleIfChanged(reviewBtn, tipText);
      reviewBtn.setAttribute('aria-label', tipText);
      const titleEl = card.querySelector('.product-name, .productDetails, .bold, a[title]');
      if (titleEl && titleEl.tagName !== 'A' && reviewBtn.parentElement !== titleEl) titleEl.appendChild(reviewBtn);
      else if (titleEl && titleEl.tagName === 'A') {
        // The variant deal pill owns the slot directly after the title
        // (.bold + .tp-deal-pill); park the review button behind it so the
        // two inserters settle instead of ping-ponging every render pass.
        const anchor = titleEl.nextElementSibling?.classList?.contains('tp-deal-pill') ? titleEl.nextElementSibling : titleEl;
        if (reviewBtn.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', reviewBtn);
      }
      else if (!titleEl && reviewBtn.parentElement !== card) card.appendChild(reviewBtn);
    } else {
      card.querySelector('.tp-review-search-btn')?.remove();
    }
  }

  // Preisalarm bell trigger next to price (step 10).
  function renderAlarmBell(ctx) {
    const { card, pid, cardPriceEl } = ctx;
    if (!pid) {
      card.querySelector('.tp-card-alarm-btn')?.remove();
      return;
    }
    // If card already has native bell (e.g. catalog cards), don't inject a second bell
    if (card.querySelector('.Plugin_NewInfoMailButton')) {
      card.querySelector('.tp-card-alarm-btn')?.remove();
      return;
    }
    let bell = card.querySelector('.tp-card-alarm-btn');
    if (!bell) {
      bell = document.createElement('button');
      bell.type = 'button';
      bell.className = 'tp-card-alarm-btn';
      bell.textContent = '🔔';
      bell.setAttribute('aria-label', 'Preisalarm');
      bell.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        openPriceAlarmForProduct(pid, card);
      });
      const priceInfo = card.querySelector('.Plugin_PriceInformation, .price_information_product, .price_information_product_small');
      if (priceInfo) {
        priceInfo.appendChild(bell);
      } else {
        const anchor = (cardPriceEl?.parentElement?.contains(cardPriceEl) && cardPriceEl.parentElement) || card;
        if (anchor !== card) anchor.appendChild(bell);
        else card.appendChild(bell);
      }
    }
    refreshAlarmBellDecor();
  }

  // Fresh-deal glow for newly verified good deals.
  function applyFreshGlow(ctx) {
    const { card, pid, stats } = ctx;
    // Fresh-deal glow: only newly verified good deals pulse. The badge verdict
    // above is the single source of truth for "good deal" — no duplicate math.
    const freshBadge = card.querySelector('.tp-deal-new-record, .tp-deal-alltime-low');
    const isFresh = hasUsablePriceStats(stats) && scanState.freshPids.has(pid) && !!freshBadge;
    card.classList.toggle('tp-deal-fresh', isFresh);
  }

  function renderEmptyState(cards, counts) {
    let emptyNotice = document.getElementById('tp-empty-state-notice');

    const totalHidden = counts.filteredCount || 0;

    // Filtern removes cards: empty state whenever all cards are removed.
    if (cards.length > 0 && totalHidden >= cards.length) {
      // Static notice: skip rebuild + listener re-bind when nothing changed
      const emptySig = `${cards.length}:${totalHidden}:${counts.uncheckedDeals || 0}:${realDealMinDiscount()}`;
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
      const minDisc = realDealMinDiscount();
      emptyNotice.innerHTML = `
        <div>🚫 <strong>Alle ${cards.length} Angebote auf dieser Seite sind durch aktive Filter ausgeblendet.</strong></div>
        <div class="tp-empty-state-actions">
          ${counts.uncheckedDeals > 0 ? `<button class="tp-empty-state-btn" id="tp-empty-check-deals-btn" style="border-color: #3b82f6; color: #2563eb;" title="Prüft Differenzen ≥ ${minDisc}% (ungeprüft ≠ Tiefstpreis)">🔍 Tiefstpreise prüfen (≥${minDisc}%)</button>` : ''}
          ${CONFIG.BESTPREISE_HIDE_UNCHECKED === true && CONFIG.HIDE_UNCHECKED_MODE === 'hide' ? `<button class="tp-empty-state-btn" id="tp-empty-hide-unchecked-btn" title="Ungeprüfte wieder einblenden (${counts.uncheckedHidden || 0})">Ungeprüfte einblenden</button>` : ''}
          <button class="tp-empty-state-btn" id="tp-empty-toggle-filters-btn" title="Alle Filter pausieren (alles anzeigen)">⚡ Filter ausschalten</button>
        </div>
      `;

      emptyNotice.dataset.tpEmptySig = emptySig;
      emptyNotice.querySelector('#tp-empty-check-deals-btn')?.addEventListener('click', () => {
        // Toolbar batch button removed: the floating CTA owns this action now.
        // startBatchCheck works even when the pill is collapsed or auto-hidden.
        startBatchCheck();
      });
      emptyNotice.querySelector('#tp-empty-hide-unchecked-btn')?.addEventListener('click', () => {
        updateConfig('BESTPREISE_HIDE_UNCHECKED', false);
        showToast('✓ Ungeprüfte aus — alle werden wieder angezeigt');
      });

      emptyNotice.querySelector('#tp-empty-toggle-filters-btn')?.addEventListener('click', () => {
        updateConfigs({ FILTER_NEG_ENABLED: false, FILTER_MIN_ENABLED: false, FILTER_DEAL_DISCOUNT_ENABLED: false, BESTPREISE_HIDE_UNCHECKED: false, BESTPREISE_INCLUDE_VORTIEF: true, DEALER_MODE: 'dim' });
        showToast('⏸️ Alle Filter pausiert (alle Angebote sichtbar)');
      });
    } else if (emptyNotice) {
      emptyNotice.remove();
    }
  }

  // Orchestrator (signature frozen — app.js untouched): builds ctx once,
  // paints heat + verdict, then chrome steps in the original order.
  function renderCardEffects(cd, filters, isNeueFeed, activeStores) {
    const { card, pid, cardPriceEl, cardPrice, cardPriceBasis, basisMatches, stats, diffVal } = cd;
    // Rejected verdicts (null) stay rejected: only an uncalculated verdict
    // (undefined, e.g. a partial struct) may compute — and only on a matching basis.
    const basisOk = basisMatches ?? basisMatchesFor(stats, cardPriceBasis);
    const vStats = cd.verifiedStats ?? (basisOk ? stats : null);
    const displayDelta = cd.displayDelta ?? (vStats ? getDisplayDelta(cardPrice, vStats) : { kind: 'unknown' });
    const dealData = cd.dealScore === undefined && vStats ? computeDealScore(vStats, cardPrice) : (cd.dealScore ?? null);
    const heatMode = CONFIG.BESTPREISE_MODE_ACTIVE ? 'bestpreise' : 'browse';
    const heatInfo = getHeatInput(cardPrice, vStats, diffVal, heatMode, dealData);
    const effectiveDiff = heatInfo.value;
    const ctx = { card, pid, cardPrice, cardPriceEl, stats: vStats, diffVal, dealData, displayDelta, heatInfo, effectiveDiff };
    renderBadgeVerdict(ctx, filters, isNeueFeed);
    renderHeat(ctx);
    renderFilterVerdict(ctx, filters, activeStores);
    renderSparklineRow(ctx);
    applyVerifiedCue(ctx);
    renderShareButton(ctx, cd);
    renderDealerName(ctx, filters);
    renderAlarmBell(ctx);
    renderReviewButton(ctx);
    applyFreshGlow(ctx);
  }

  // ─── MODULE: src/ui/badges.js ───────────────────────────────────────────────
  /**
   * Badges barrel (split into ui/badges/ parts): every existing
   * `from './ui/badges.js'` path keeps working.
   */

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

  // ─── MODULE: src/ui/modal-template-sections.js ──────────────────────────────
  /**
   * Modal Template Sub-Sections
   * Extracted from modal-template.js to respect module size limits.
   */


  function renderDiscordSection() {
    return `
        <section id="tp-section-discord" class="tp-section-card tp-section-discord">
  <button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-discord-body" data-collapse="tp-section-discord"><span class="tp-section-title">💬 Discord Share</span><span class="tp-chevron" aria-hidden="true"></span></button>
  <div class="tp-section-body" id="tp-section-discord-body">
          <div class="tp-settings-group">
            <label title="Webhooks deiner Discord-Kanäle (Kanal-Einstellungen → Integrationen → Webhook). Nur lokal gespeichert, nie exportiert.">📤 Discord Kanäle & Webhooks (Deals-Share)</label>
            <div id="tp-discord-channels-list" class="tp-discord-channels-list">
              <div class="tp-discord-channel-card" data-channel-id="default">
                <div class="tp-discord-channel-header">
                  <input type="text" id="tp-discord-primary-name" class="tp-field-dark tp-discord-channel-name" value="Standard" placeholder="Kanalname (z.B. Standard)" title="Name des Discord-Kanals">
                </div>
                <div id="tp-discord-webhook-collapsed">
                  <span id="tp-discord-webhook-status" class="tp-switch-desc"></span>
                  <button type="button" id="tp-discord-webhook-reveal" class="tp-btn tp-btn-secondary" aria-expanded="false" aria-controls="tp-discord-webhook-editor">🔑 Webhook ersetzen / entfernen</button>
                </div>
                <div id="tp-discord-webhook-editor" style="display: none;">
                  <input type="password" id="tp-discord-webhook-input" class="tp-field-dark" placeholder="https://discord.com/api/webhooks/…" autocomplete="new-password" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true">
                  <span class="tp-switch-desc tp-field-hint">Ermöglicht den 📤-Button auf verifizierten Tiefstpreis-Karten. Leer = Webhook entfernen.</span>
                </div>
              </div>
              <div id="tp-discord-extra-channels"></div>
            </div>
            <button type="button" id="tp-discord-add-channel-btn" class="tp-btn tp-btn-secondary" style="margin-top: 6px;">➕ Weiteren Kanal hinzufügen</button>
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
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Zeigt den Deal-Titel auch im Body von Forenposts (sonst nur als Thread-Titel).">Titel im Foren-Body</label>
              <span class="tp-switch-desc">AN = Titel auch im Foren-Body</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-discord-forum-title-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group">
            <label for="tp-discord-layout-input" title="Aufbau der Discord-Nachricht (eine Zeile je Baustein)">Nachrichten-Layout (Baukasten)</label>
            <div>
              <button type="button" id="tp-discord-layout-preset-kompakt" class="tp-btn tp-btn-secondary" title="Layout: kompakt einsetzen">Kompakt</button>
              <button type="button" id="tp-discord-layout-preset-ausfuehrlich" class="tp-btn tp-btn-secondary" title="Layout: ausführlich einsetzen">Ausführlich</button>
              <button type="button" id="tp-discord-layout-preset-minimal" class="tp-btn tp-btn-secondary" title="Layout: minimal einsetzen">Minimal</button>
            </div>
            <div id="tp-discord-layout-chips">
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{title}">Titel {title}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{price}">Preis {price}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{dealer}">Händler {dealer}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{offers}">Angebote {offers}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{prevlow}">Bisher {prevlow}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{median}">Ø-Preis {median}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{ai}">KI-Fazit {ai}</button>
              <button type="button" class="tp-btn tp-btn-secondary" data-token="{link}">Link {link}</button>
            </div>
            <textarea id="tp-discord-layout-input" class="tp-field-dark" rows="7" style="font-family:monospace" spellcheck="false"></textarea>
            <span class="tp-switch-desc tp-field-hint">Je Zeile ein Baustein. Tokens: {title} {price} {dealer} {offers} {prevlow} {median} {ai} {link}. Grösse via # / ## / -# am Zeilenanfang. · / + blenden leere Nachbarn aus. Preischarts werden als Bild angehängt.</span>
            <pre id="tp-discord-layout-preview"></pre>
            <span id="tp-discord-layout-count" class="tp-switch-desc"></span>
            <span id="tp-discord-layout-error" class="tp-switch-desc"></span>
            <button type="button" id="tp-discord-layout-reset" class="tp-btn tp-btn-secondary" title="Layout auf Standard zurücksetzen">Layout zurücksetzen</button>
          </div>
  </div>
        </section>
    `;
  }

  function renderDataSection() {
    return `
        <section id="tp-section-data" class="tp-section-card tp-section-data">
  <button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-data-body" data-collapse="tp-section-data"><span class="tp-section-title">💾 Daten & Cache</span><span class="tp-chevron" aria-hidden="true"></span></button>
  <div class="tp-section-body" id="tp-section-data-body">
          <div class="tp-settings-group">
            <span class="tp-switch-desc tp-field-hint">Ausreisser-Filter (Glitch-Erkennung): siehe ⚖️-Popover in der Filterleiste.</span>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Lädt den günstigsten Händler für Deals ab Schwelle automatisch (statt per 🏬-Klick).">Händler automatisch laden</label>
              <span class="tp-switch-desc">Erfordert zusätzliche Produktseiten-Abfragen (max. 3 parallel)</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-dealer-autofetch-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group" id="tp-bestpreise-weight-group">
            <label><span class="tp-glossary-term" title="Kombiniert Rekord-Tiefstpreis und Durchschnittsrabatt im gewählten Mix für Badge, Farbe und Platzierung.">Gewichtete Differenz</span>: Sortierung + Farb-Emphase (Rekord vs Ø)</label>
            <div class="tp-range-container tp-purple">
              <input type="range" id="tp-bestpreise-weight-range" min="0" max="100" step="5" value="50">
              <input type="number" id="tp-bestpreise-weight-val" min="0" max="100" step="5" value="50">
            </div>
            <span class="tp-switch-desc tp-field-hint" id="tp-bestpreise-weight-desc">50% Rekord / 50% Ø-Preis (Sortierung + Farb-Emphase) · z.B. Rek −10% + Ø −25% → Gewichtete Differenz 18</span>
          </div>
          <div class="tp-settings-group" id="tp-bestpreise-minpoints-group">
            <label title="Ø-Vergleich erst ab so vielen Punkten (Punkte ≈ Tage). Darunter: Fallback-Tief.">Mindestanzahl Datenpunkte in der Preishistorie</label>
            <div class="tp-range-container tp-purple">
              <input type="range" id="tp-bestpreise-minpoints-range" min="0" max="${MIN_POINTS_STEPS.length - 1}" step="1" value="${minPointsToIndex(DEFAULTS.BESTPREISE_MIN_POINTS)}">
              <input type="number" id="tp-bestpreise-minpoints-val" min="1" max="100" step="1" value="5">
            </div>
            <span class="tp-switch-desc tp-field-hint">Nur Historien ab dieser Punktzahl bekommen einen gewichteten Ø-Vergleich (⚖️/💎). Darunter: <span class="tp-glossary-term" title="Verifizierter Tiefstpreis mit zu wenigen Datenpunkten für einen Ø-Vergleich. Zeigt ersatzweise den Abstand zum Vortief.">Fallback-Tief</span> (Abstand zum Vortief, ohne Ø-Vergleich).</span>
          </div>
          <div class="tp-settings-group" id="tp-bestpreise-horizon-group">
            <label title="Zeitraum für den Ø-Preis-Vergleich">Median-Berechnungszeitraum (Ø-Preis)</label>
            <div class="tp-range-container tp-purple">
              <input type="range" id="tp-bestpreise-horizon-range" min="30" max="760" step="30" value="365">
              <input type="number" id="tp-bestpreise-horizon-val" min="0" max="3650" step="1" value="365">
            </div>
            <span class="tp-switch-desc tp-field-hint" id="tp-bestpreise-horizon-desc">Ø-Vergleich: 1J (0 = gesamte Historie / Lifetime, Vorgabe: 1J). Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis.</span>
          </div>
          <div class="tp-settings-group">
            <label title="Nur Differenzen ab diesem Wert automatisch prüfen">Prüf-Vorauswahl: Mindest-Differenz für Batch-Check (%)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-real-deal-min-range" min="10" max="70" step="5" value="30">
              <input type="number" id="tp-real-deal-min-val" min="0" max="90" step="5" value="30">
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
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label>Amazon Keepa-Verlauf im Preisverlauf</label>
              <span class="tp-switch-desc">Zeigt bei Amazon.de-Deals den detaillierten Keepa-Verlauf (Buy Box, Amazon, Neu) im Preisverlauf-Diagramm an</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-keepa-chart-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group tp-cache-row">
            <div id="tp-cache-stats-label">Lokaler Cache: 0 Einträge</div>
            <button type="button" id="tp-cache-clear-btn" class="tp-btn tp-btn-secondary">🗑️ Cache leeren</button>
          </div>
          <div class="tp-settings-group">
            <label title="Maximale Anzahl an Preishistorien im Arbeitsspeicher (LRU)">RAM-Cache Limit (Einträge)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-cache-memory-range" min="100" max="2000" step="50" value="500">
              <input type="number" id="tp-cache-memory-val" min="100" max="2000" step="50" value="500">
            </div>
            <span class="tp-switch-desc tp-field-hint">Hält bis zu N Einträge im Arbeitsspeicher (Standard: 500). Ältere Einträge weichen per LRU.</span>
          </div>
          <div class="tp-settings-group">
            <label title="Maximale Anzahl an Preishistorien im Browser-Speicher (localStorage)">Festplatten-Cache Limit (Einträge)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-cache-disk-range" min="100" max="1000" step="50" value="300">
              <input type="number" id="tp-cache-disk-val" min="100" max="1000" step="50" value="300">
            </div>
            <span class="tp-switch-desc tp-field-hint">Maximaler lokaler Browser-Speicher (Standard: 300). Bei Überschreitung wird auf 80% bereinigt.</span>
          </div>
          <div class="tp-settings-group tp-danger-zone">
            <span class="tp-switch-desc">Gefahrenzone: löscht Cache und setzt alle Einstellungen zurück.</span>
            <button type="button" id="tp-data-reset-btn" class="tp-btn tp-btn-danger" title="Löscht Preis- und Händler-Cache und setzt ALLE Einstellungen (inkl. Discord-Webhook) auf Standard zurück.">🧨 Alle Daten löschen</button>
          </div>
          <div class="tp-settings-group">
            <label title="So lange bleiben Preisdaten lokal gespeichert">Cache-Dauer für Preishistorie (Gültige Daten)</label>
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
            <label title="So lange werden leere Ergebnisse zwischengespeichert">Negativ-Cache Dauer (Nicht verfügbare Daten)</label>
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
  </div>
        </section>
    `;
  }

  // ─── MODULE: src/ui/modal-template.js ───────────────────────────────────────
  /**
   * Modal template (split from ui/modal.js): settings section HTML + collapse state.
   */


  // Injects the settings sections on first open; later calls are a no-op.
  function ensureModalSection(shadow) {
    let section = shadow.getElementById('tp-section-unified-suite');
    if (!section) {
      const sectionsHolder = shadow.getElementById('tp-settings-sections');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = `
        <div id="tp-section-unified-suite">
        <section id="tp-section-display" class="tp-section-card tp-section-display">
  <button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-display-body" data-collapse="tp-section-display"><span class="tp-section-title">🖥️ Ansicht</span><span class="tp-chevron" aria-hidden="true"></span></button>
  <div class="tp-section-body" id="tp-section-display-body">
          <div class="tp-settings-group" id="tp-dim-opacity-group">
            <label title="Deckkraft gedimmter Karten (Filter-Modus Dimmen)">Deckkraft / Dimmung (Gedimmt & Gefiltert)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-opacity-range" min="0.05" max="1" step="0.05" value="0.25">
              <input type="number" id="tp-opacity-val" min="5" max="100" step="5" value="25">
            </div>
          </div>
          <div class="tp-settings-group">
            <label title="Stärke der Karten- und Badge-Farbe (subtil bei kleinen Rabatten, intensiv bei Top-Deals; 0% und Aufschläge bleiben farblos)">Deal-Intensität / Heatmap (%)</label>
            <div class="tp-range-container tp-rose">
              <input type="range" id="tp-heatmap-intensity-range" min="20" max="100" step="5" value="100">
              <input type="number" id="tp-heatmap-intensity-val" min="20" max="100" step="5" value="100">
            </div>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Entfernt leere Werbeflächen und Banner oben und im Layout">Werbeplätze / Banner ausblenden</label>
              <span class="tp-switch-desc">Entfernt leeren Platz über der Kopfzeile und Werbebanner</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-hide-ads-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
  </div>
        </section>
        <section id="tp-section-review" class="tp-section-card tp-section-review">
  <button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-review-body" data-collapse="tp-section-review"><span class="tp-section-title">🌐 Web-Suche</span><span class="tp-chevron" aria-hidden="true"></span></button>
  <div class="tp-section-body" id="tp-section-review-body">
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Hängt ans Ende jedes Produktnamens ein 🌐-Icon für die Web-Suche.">Web-Suche (🌐) anzeigen</label>
              <span class="tp-switch-desc">Zeigt auf jeder Produktkarte ein Icon für die externe Web- und KI-Suche</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-review-search-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group">
            <label title="Dieser Begriff wird für die Google- und KI-Suche verwendet.">Suchbegriff / Prompt</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" id="tp-review-keyword-input" class="tp-field-dark" value="Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch." maxlength="150" placeholder="Suchbegriff eingeben…" spellcheck="false" autocomplete="off" style="flex:1;margin-top:0;">
              <button type="button" id="tp-review-keyword-reset" class="tp-btn tp-btn-secondary" style="padding:6px 10px;font-size:var(--tp-fs-sm);height:32px;white-space:nowrap;" title="Auf Standard-Suchbegriff zurücksetzen">↺ Standard</button>
            </div>
            <span class="tp-switch-desc tp-field-hint">Wird für Web- und KI-Suche verwendet. Platzhalter: <code>[Produkt]</code> (wird sonst vorangestellt) und <code>{preis}</code> (ohne Preisdaten automatisch entfernt).</span>
            <div class="tp-search-preview-box">
              <div class="tp-search-preview-title">Live-Vorschau (Beispiel: Sony WH-1000XM5)</div>
              <div class="tp-search-preview-row">
                <span class="tp-search-preview-badge">Mit Deal-Preis:</span>
                <span id="tp-review-keyword-preview" class="tp-search-preview-text"></span>
              </div>
              <div class="tp-search-preview-row" id="tp-review-keyword-preview-noprice-row">
                <span class="tp-search-preview-badge">Ohne Preis:</span>
                <span id="tp-review-keyword-preview-noprice" class="tp-search-preview-text tp-muted"></span>
              </div>
            </div>
          </div>

          <div class="tp-settings-subhead">Google-Suche</div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Öffnet die Suche in Googles KI-Modus (Parameter &udm=50).">Im Google KI-Modus öffnen</label>
              <span class="tp-switch-desc">Google AI Overview Modus (&udm=50) statt klassischer Trefferliste</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-review-ai-mode-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>

          <div class="tp-settings-subhead">Tavily KI-Suche (Direkt-Fazit & Discord)</div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Aktiviert Tavily KI-Zusammenfassungen für Direkt-Fazit auf der Karte und {ai} in Discord.">Tavily KI-Suche aktivieren</label>
              <span class="tp-switch-desc">AUS = 🌐 öffnet Websuche direkt, kein KI-Fazit auf Karte & in Discord</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-tavily-enabled-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group">
            <label title="Kostenloser Tavily API Key (tavily.com, 1'000 Anfragen/Monat). Ermöglicht KI-Kurzfazit direkt auf der Karte (🌐) und im Discord-Share ({ai}).">API-Schlüssel</label>
            <div id="tp-tavily-api-key-collapsed">
              <span id="tp-tavily-api-key-status" class="tp-switch-desc"></span>
              <button type="button" id="tp-tavily-api-key-reveal" class="tp-btn tp-btn-secondary" aria-expanded="false" aria-controls="tp-tavily-api-key-editor">🔑 Key ersetzen / entfernen</button>
            </div>
            <div id="tp-tavily-api-key-editor" style="display: none;">
              <input type="password" id="tp-tavily-api-key-input" class="tp-field-dark" placeholder="tvly-…" autocomplete="new-password" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true">
              <span class="tp-switch-desc tp-field-hint">Kostenloser Key von <a href="https://tavily.com" target="_blank" rel="noopener">tavily.com</a> (1'000 Anfragen/Monat). Ermöglicht KI-Kurzfazit per 1-Klick auf der Karte und <code>{ai}</code> im Discord-Post. Bleibt lokal im Browser.</span>
            </div>
          </div>
          <div class="tp-settings-group" style="display:flex;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;min-width:140px;">
              <label title="Suchtiefe: Basic ist schnell (~1-2s). Advanced durchsucht mehr Webquellen (~2-4s).">Tavily Suchtiefe</label>
              <select id="tp-tavily-search-depth" class="tp-select tp-field-dark">
                <option value="basic">Basic (schnell, Standard)</option>
                <option value="advanced">Advanced (gründlich)</option>
              </select>
            </div>
            <div style="flex:1;min-width:140px;">
              <label title="Anzahl der Webseiten, die Tavily für die Antwort analysiert.">Max. Quellen (Ergebnisse)</label>
              <select id="tp-tavily-max-results" class="tp-select tp-field-dark">
                <option value="3">3 Quellen</option>
                <option value="5" selected>5 Quellen (Standard)</option>
                <option value="8">8 Quellen</option>
                <option value="10">10 Quellen</option>
              </select>
            </div>
          </div>
  </div>
        </section>
        <section id="tp-section-deals" class="tp-section-card tp-section-deals">
  <button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-deals-body" data-collapse="tp-section-deals"><span class="tp-section-title">💎 Sortieren</span><span class="tp-chevron" aria-hidden="true"></span></button>
  <div class="tp-section-body" id="tp-section-deals-body">
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label><span class="tp-glossary-term" title="Sortiert Angebote nach echter Tiefstpreis-Qualität (Gewichtete Differenz). Entfernt keine Angebote.">Tiefstpreis-Sortierung</span></label>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-bestpreise-mode-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group">
            <label title="Angebotsanzahl- oder Rabatt-Sortierung (Toppreise-Liste)">Sortierung nach Angeboten / Rabatt</label>
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
  </div>
        </section>
        <section id="tp-section-filter" class="tp-section-card tp-section-filter">
  <button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-filter-body" data-collapse="tp-section-filter"><span class="tp-section-title">🧹 Filtern</span><span class="tp-chevron" aria-hidden="true"></span></button>
  <div class="tp-section-body" id="tp-section-filter-body">
          <div class="tp-settings-group">
            <span class="tp-switch-desc tp-field-hint">Negativ-Terme, Min-Angebote, <span class="tp-glossary-term" title="Angebote ohne geprüfte Preishistorie. Der Rabatt basiert nur auf UVP oder Toppreis.">Ungeprüfte</span>, <span class="tp-glossary-term" title="Verifizierter Tiefstpreis mit zu wenigen Datenpunkten für einen Ø-Vergleich. Zeigt ersatzweise den Abstand zum Vortief.">Fallback-Tiefs</span> und Händler stehen im Filter-Popover der Filterleiste.</span>
          </div>
          <div class="tp-settings-group">
            <label title="So viel teurer darf der gewählte Händler als der Bestpreis sein">Preis-Toleranz (%)</label>
            <div class="tp-range-container">
              <input type="range" id="tp-margin-range" min="0" max="50" step="0.5" value="0">
              <input type="number" id="tp-margin-val" min="0" max="50" step="0.1" value="0">
            </div>
          </div>
  </div>
        </section>
        <section id="tp-section-alarm" class="tp-section-card tp-section-alarm">
  <button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-alarm-body" data-collapse="tp-section-alarm"><span class="tp-section-title">🔔 Preisalarm</span><span class="tp-chevron" aria-hidden="true"></span></button>
  <div class="tp-section-body" id="tp-section-alarm-body">
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
            <label title="Zielpreis als Prozent des aktuellen Preises für den Preisalarm.">Preisalarm Zielpreis (%)</label>
            <div class="tp-range-container tp-blue">
              <input type="range" id="tp-alarm-target-range" min="5" max="99" step="5" value="60">
              <input type="number" id="tp-alarm-target-val" min="5" max="99" step="1" value="60">
            </div>
          </div>
          <div class="tp-settings-group">
            <label title="Laufzeit des Preisalarms">Laufzeit</label>
            <div class="tp-segmented-control tp-segmented-control-blue">
              <input type="radio" id="tp-dur-90" name="tp-alarm-duration" value="90"><label for="tp-dur-90">3 Monate</label>
              <input type="radio" id="tp-dur-180" name="tp-alarm-duration" value="180"><label for="tp-dur-180">6 Monate</label>
              <input type="radio" id="tp-dur-365" name="tp-alarm-duration" value="365"><label for="tp-dur-365">1 Jahr</label>
              <input type="radio" id="tp-dur-730" name="tp-alarm-duration" value="730"><label for="tp-dur-730">2 Jahre</label>
            </div>
          </div>
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Alarmformular sofort einreichen und schliessen">Automatisch Absenden & Schliessen</label>
              <span class="tp-switch-desc">Formular direkt einreichen und Dialog schliessen</span>
            </div>
            <label class="tp-switch tp-blue">
              <input type="checkbox" id="tp-alarm-autosubmit-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
  </div>
        </section>
        ${renderDiscordSection()}
        ${renderDataSection()}

        </div>
      `;
      section = tempDiv.firstElementChild;
      sectionsHolder.appendChild(section);
    }
    return section;
  }

  // Independent per-section collapse, remembered outside CONFIG so it never
  // leaks into export/import/reset. GM primary, localStorage mirror.
  const COLLAPSE_KEY = 'tp_modal_collapsed';
  const COLLAPSE_IDS = ['tp-section-display', 'tp-section-review', 'tp-section-deals', 'tp-section-filter', 'tp-section-alarm', 'tp-section-discord', 'tp-section-data'];
  function readCollapsed() {
      try {
        if (typeof GM_getValue !== 'undefined') {
          const gv = GM_getValue('tp_suite_v2_' + COLLAPSE_KEY);
          if (Array.isArray(gv)) return gv.filter(id => COLLAPSE_IDS.includes(id));
        }
      } catch {}
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('tp_suite_v2_' + COLLAPSE_KEY);
          if (raw !== null) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.filter(id => COLLAPSE_IDS.includes(id));
          }
        }
      } catch {}
      return [];
    };
  function writeCollapsed(ids) {
      const clean = ids.filter(id => COLLAPSE_IDS.includes(id));
      try { if (typeof GM_setValue !== 'undefined') GM_setValue('tp_suite_v2_' + COLLAPSE_KEY, clean); } catch {}
      try { if (typeof localStorage !== 'undefined') localStorage.setItem('tp_suite_v2_' + COLLAPSE_KEY, JSON.stringify(clean)); } catch {}
    };
  function applyCollapsed(shadow) {
      for (const id of readCollapsed()) {
        const card = shadow.getElementById(id);
        if (!card) continue;
        card.classList.add('tp-collapsed');
        card.querySelector('[data-collapse]')?.setAttribute('aria-expanded', 'false');
      }
    };

  function initCollapse(shadow) {
    applyCollapsed(shadow);
    const sectionsEl = shadow.getElementById('tp-settings-sections');
    if (sectionsEl && !sectionsEl.dataset.collapseBound) {
      sectionsEl.dataset.collapseBound = '1';
      sectionsEl.addEventListener('click', (e) => {
        const header = e.target?.closest?.('[data-collapse]');
        if (!header || !sectionsEl.contains(header)) return;
        const card = shadow.getElementById(header.dataset.collapse);
        if (!card) return;
        const collapsed = card.classList.toggle('tp-collapsed');
        header.setAttribute('aria-expanded', String(!collapsed));
        writeCollapsed([...sectionsEl.querySelectorAll('section.tp-collapsed')].map(s => s.id));
      });
    }
  }

  // ─── MODULE: src/ui/modal-bindings.js ───────────────────────────────────────
  /**
   * Modal bindings (split from ui/modal.js): element table, layout preview,
   * field sync, dual control pairs. The els record replaces closure locals.
   */






  // Element-lookup table: one record, shared by sync/bind/actions.
  function collectModalElements(shadow) {
    const dialog = shadow.getElementById('tp-settings-dialog');
    const fabButton = shadow.getElementById('tp-settings-fab');
    const btnClose = shadow.getElementById('tp-btn-close');
    const btnSave = shadow.getElementById('tp-btn-save');

    const marginRange = shadow.getElementById('tp-margin-range');
    const marginVal = shadow.getElementById('tp-margin-val');
    const opacityRange = shadow.getElementById('tp-opacity-range');
    const opacityVal = shadow.getElementById('tp-opacity-val');
    const hideAdsToggle = shadow.getElementById('tp-hide-ads-toggle');
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
    const cacheMemoryRange = shadow.getElementById('tp-cache-memory-range');
    const cacheMemoryVal = shadow.getElementById('tp-cache-memory-val');
    const cacheDiskRange = shadow.getElementById('tp-cache-disk-range');
    const cacheDiskVal = shadow.getElementById('tp-cache-disk-val');
    const cacheStatsLabel = shadow.getElementById('tp-cache-stats-label');
    const cacheClearBtn = shadow.getElementById('tp-cache-clear-btn');
    const dataResetBtn = shadow.getElementById('tp-data-reset-btn');
    const realDealMinRange = shadow.getElementById('tp-real-deal-min-range');
    const realDealMinVal = shadow.getElementById('tp-real-deal-min-val');
    const sparklinesToggle = shadow.getElementById('tp-sparklines-toggle');
    const keepaChartToggle = shadow.getElementById('tp-keepa-chart-toggle');
    const reviewSearchToggle = shadow.getElementById('tp-review-search-toggle');
    const reviewKeywordInput = shadow.getElementById('tp-review-keyword-input');
    const reviewKeywordReset = shadow.getElementById('tp-review-keyword-reset');
    const reviewKeywordPreview = shadow.getElementById('tp-review-keyword-preview');
    const reviewKeywordPreviewNoPrice = shadow.getElementById('tp-review-keyword-preview-noprice');
    const reviewKeywordPreviewNoPriceRow = shadow.getElementById('tp-review-keyword-preview-noprice-row');
    const reviewAiModeToggle = shadow.getElementById('tp-review-ai-mode-toggle');
    const tavilyEnabledToggle = shadow.getElementById('tp-tavily-enabled-toggle');
    const tavilyApiKeyInput = shadow.getElementById('tp-tavily-api-key-input');
    const tavilyApiKeyReveal = shadow.getElementById('tp-tavily-api-key-reveal');
    const tavilyApiKeyEditor = shadow.getElementById('tp-tavily-api-key-editor');
    const tavilyApiKeyStatus = shadow.getElementById('tp-tavily-api-key-status');
    const tavilySearchDepth = shadow.getElementById('tp-tavily-search-depth');
    const tavilyMaxResults = shadow.getElementById('tp-tavily-max-results');
    const dealerAutofetchToggle = shadow.getElementById('tp-dealer-autofetch-toggle');
    const discordPrimaryName = shadow.getElementById('tp-discord-primary-name');
    const discordChannelsList = shadow.getElementById('tp-discord-channels-list');
    const discordExtraChannels = shadow.getElementById('tp-discord-extra-channels');
    const discordAddChannelBtn = shadow.getElementById('tp-discord-add-channel-btn');
    const discordWebhookInput = shadow.getElementById('tp-discord-webhook-input');
    const discordWebhookReveal = shadow.getElementById('tp-discord-webhook-reveal');
    const discordWebhookEditor = shadow.getElementById('tp-discord-webhook-editor');
    const discordWebhookStatus = shadow.getElementById('tp-discord-webhook-status');
    const discordDealerEmbedToggle = shadow.getElementById('tp-discord-dealer-embed-toggle');
    const discordProductEmbedToggle = shadow.getElementById('tp-discord-product-embed-toggle');
    const discordForumTitleToggle = shadow.getElementById('tp-discord-forum-title-toggle');
    const discordLayoutInput = shadow.getElementById('tp-discord-layout-input');
    const discordLayoutPreview = shadow.getElementById('tp-discord-layout-preview');
    const discordLayoutCount = shadow.getElementById('tp-discord-layout-count');
    const discordLayoutError = shadow.getElementById('tp-discord-layout-error');
    const discordLayoutReset = shadow.getElementById('tp-discord-layout-reset');
    const exportBtn = shadow.getElementById('tp-export-config-btn');
    const importBtn = shadow.getElementById('tp-import-config-btn');
    const importFile = shadow.getElementById('tp-import-config-file');
    return { shadow, dialog, fabButton, btnClose, btnSave, marginRange, marginVal, opacityRange, opacityVal, hideAdsToggle, shippingToggle, sortNone, sortDesc, sortAsc, sortDiscount, alarmEnabledToggle, alarmTargetRange, alarmTargetVal, alarmAutoSubmitToggle, heatmapIntensityRange, heatmapIntensityVal, bestpreiseModeToggle, bestpreiseWeightRange, bestpreiseWeightVal, bestpreiseWeightDesc, bestpreiseMinPointsRange, bestpreiseMinPointsVal, bestpreiseHorizonRange, bestpreiseHorizonVal, bestpreiseHorizonDesc, cacheTtlSelect, cacheNegTtlSelect, cacheMemoryRange, cacheMemoryVal, cacheDiskRange, cacheDiskVal, cacheStatsLabel, cacheClearBtn, dataResetBtn, realDealMinRange, realDealMinVal, sparklinesToggle, keepaChartToggle, reviewSearchToggle, reviewKeywordInput, reviewKeywordReset, reviewKeywordPreview, reviewKeywordPreviewNoPrice, reviewKeywordPreviewNoPriceRow, reviewAiModeToggle, tavilyEnabledToggle, tavilyApiKeyInput, tavilyApiKeyReveal, tavilyApiKeyEditor, tavilyApiKeyStatus, tavilySearchDepth, tavilyMaxResults, dealerAutofetchToggle, discordPrimaryName, discordChannelsList, discordExtraChannels, discordAddChannelBtn, discordWebhookInput, discordWebhookReveal, discordWebhookEditor, discordWebhookStatus, discordDealerEmbedToggle, discordProductEmbedToggle, discordForumTitleToggle, discordLayoutInput, discordLayoutPreview, discordLayoutCount, discordLayoutError, discordLayoutReset, exportBtn, importBtn, importFile, layoutTimer: 0 };
  }

  // Built lazily (was setupUI-local): kompakt reads DEFAULT_LAYOUT, which
  // initializes later in bundle concat order (features/share-discord.js).
  function getLayoutPresets() {
    return {
      kompakt: DEFAULT_LAYOUT,
      ausfuehrlich: '## {title}\n# {price}\n-# {dealer}\n-# {offers}\n{prevlow}\n{median}\n{link}',
      minimal: '## {title}\n# {price}\n{link}'
    };
  }
  const LAYOUT_SAMPLE = { title: 'URBANISTA Porto, Cloud White', url: 'https://www.toppreise.ch/preisvergleich/x-p802723', priceText: 'CHF 16.85', dealer: 'Amazon.de', dealerUrl: 'https://www.toppreise.ch/ext_de?pid=802723', offerCount: 25, prevLowText: 'CHF 29.70', prevLowPct: 43, medianText: 'Ø-Preis (90T): CHF 42.90', medianPct: 61 };
  function renderLayoutPreview(els) {
      if (!els.discordLayoutInput || !els.discordLayoutPreview) return;
      const recipe = els.discordLayoutInput.value;
      const error = validateLayoutRecipe(recipe);
      const notice = !error ? getLayoutRecipeNotice(recipe) : null;
      if (els.discordLayoutError) {
        els.discordLayoutError.textContent = error || notice || '';
        els.discordLayoutError.style.color = error ? '#ef4444' : notice ? '#d97706' : '';
      }
      const rendered = renderLayout({
        ...LAYOUT_SAMPLE,
        suppressDealerEmbed: els.discordDealerEmbedToggle ? !els.discordDealerEmbedToggle.checked : true,
        suppressProductEmbed: els.discordProductEmbedToggle ? !els.discordProductEmbedToggle.checked : true
      }, recipe);
      els.discordLayoutPreview.innerHTML = renderDiscordMarkdownPreview(rendered);
      if (els.discordLayoutCount) els.discordLayoutCount.textContent = `Rezept ${recipe.length} Zeichen · Nachricht ${rendered.length}/2000${layoutOverLimitSuffix(rendered.length, recipe)}`;
  }
  function scheduleLayoutPreview(els) { clearTimeout(els.layoutTimer); els.layoutTimer = setTimeout(() => renderLayoutPreview(els), 150); }

  const escapeHtmlAttr = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function renderExtraChannelsList(container, extras) {
    if (!container) return;
    container.innerHTML = '';
    for (const ch of extras) {
      const card = document.createElement('div');
      card.className = 'tp-discord-channel-card tp-discord-extra-card';
      card.dataset.channelId = ch.id;
      card.innerHTML = `
        <div class="tp-discord-channel-header">
          <input type="text" class="tp-field-dark tp-discord-channel-name" value="${escapeHtmlAttr(ch.name || '')}" placeholder="Kanalname (z.B. Gaming)" style="flex:1;">
          <button type="button" class="tp-btn tp-btn-danger tp-discord-remove-channel-btn" title="Kanal entfernen" style="padding:4px 8px;">🗑️</button>
        </div>
        <div class="tp-discord-extra-collapsed">
          <span class="tp-switch-desc tp-discord-extra-status">${isDiscordWebhookUrl(ch.url) ? '✅ Webhook hinterlegt' : 'Kein Webhook hinterlegt'}</span>
          <button type="button" class="tp-btn tp-btn-secondary tp-discord-extra-reveal" aria-expanded="false">🔑 Webhook ersetzen</button>
        </div>
        <div class="tp-discord-extra-editor" style="display: none;">
          <input type="password" class="tp-field-dark tp-discord-extra-url" placeholder="https://discord.com/api/webhooks/…" autocomplete="new-password">
          <span class="tp-switch-desc tp-field-hint">Leer = bisherigen Webhook behalten.</span>
        </div>
      `;
      container.appendChild(card);
    }
  }

  function addExtraChannelRow(container) {
    if (!container) return null;
    const card = document.createElement('div');
    const id = `ch_${Date.now()}`;
    card.className = 'tp-discord-channel-card tp-discord-extra-card';
    card.dataset.channelId = id;
    card.innerHTML = `
      <div class="tp-discord-channel-header">
        <input type="text" class="tp-field-dark tp-discord-channel-name" value="" placeholder="Kanalname (z.B. Gaming)" style="flex:1;">
        <button type="button" class="tp-btn tp-btn-danger tp-discord-remove-channel-btn" title="Kanal entfernen" style="padding:4px 8px;">🗑️</button>
      </div>
      <div class="tp-discord-extra-editor">
        <input type="password" class="tp-field-dark tp-discord-extra-url" placeholder="https://discord.com/api/webhooks/…" autocomplete="new-password">
      </div>
    `;
    container.appendChild(card);
    const nameInput = card.querySelector('.tp-discord-channel-name');
    nameInput?.focus();
    return card;
  }

  function syncFieldsFromConfig(els) {
      // Every key syncUiControl covers (radios, toggles, weight, min-points,
      // threshold, shipping, sparklines, dealer-autofetch, embeds, alarm) syncs
      // through it — toolbar mirrors included. Only modal-only controls below.
      for (const k of Object.keys(CONFIG)) syncUiControl(k, CONFIG[k], { silent: true });

      els.marginRange.value = CONFIG.MARGIN_PERCENT;
      els.marginVal.value = CONFIG.MARGIN_PERCENT;

      if (CONFIG.SORT_BY_OFFERS === 'desc') els.sortDesc.checked = true;
      else if (CONFIG.SORT_BY_OFFERS === 'asc') els.sortAsc.checked = true;
      else if (CONFIG.SORT_BY_OFFERS === 'discount-desc') els.sortDiscount.checked = true;
      else els.sortNone.checked = true;

      const heatIntensityPct = Math.round((CONFIG.HEATMAP_INTENSITY ?? 1.0) * 100);
      els.heatmapIntensityRange.value = heatIntensityPct;
      els.heatmapIntensityVal.value = heatIntensityPct;

      // Berechnungsparameter shape browse heat too — always visible; mode only drives sort + scan.
      {
        const stored = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365;
        if (els.bestpreiseHorizonRange) els.bestpreiseHorizonRange.value = horizonStoredToUi(stored);
        if (els.bestpreiseHorizonVal) els.bestpreiseHorizonVal.value = stored;
        if (els.bestpreiseHorizonDesc) els.bestpreiseHorizonDesc.textContent = `Ø-Vergleich: ${horizonText(stored)} (0 = gesamte Historie / Lifetime, Vorgabe: 1J). Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis.`;
      }

      if (els.cacheTtlSelect) els.cacheTtlSelect.value = String(CONFIG.REAL_DEAL_CACHE_HOURS || 48);
      if (els.cacheNegTtlSelect) els.cacheNegTtlSelect.value = String(CONFIG.NEGATIVE_CACHE_HOURS || 2);
      if (els.cacheMemoryRange) els.cacheMemoryRange.value = CONFIG.CACHE_MEMORY_LIMIT ?? 500;
      if (els.cacheMemoryVal) els.cacheMemoryVal.value = CONFIG.CACHE_MEMORY_LIMIT ?? 500;
      if (els.cacheDiskRange) els.cacheDiskRange.value = CONFIG.CACHE_DISK_LIMIT ?? 300;
      if (els.cacheDiskVal) els.cacheDiskVal.value = CONFIG.CACHE_DISK_LIMIT ?? 300;
      if (els.cacheStatsLabel) {
        const count = countCachedPriceStats();
        els.cacheStatsLabel.textContent = `Lokaler Cache: ${count} / ${CONFIG.CACHE_DISK_LIMIT || 300} Einträge`;
      }

      if (els.tavilyEnabledToggle) els.tavilyEnabledToggle.checked = !!CONFIG.TAVILY_ENABLED;
      if (els.tavilyApiKeyInput) els.tavilyApiKeyInput.value = '';
      if (els.tavilyApiKeyEditor) els.tavilyApiKeyEditor.style.display = 'none';
      if (els.tavilyApiKeyReveal) { els.tavilyApiKeyReveal.style.display = ''; els.tavilyApiKeyReveal.setAttribute('aria-expanded', 'false'); }
      if (els.tavilyApiKeyStatus) els.tavilyApiKeyStatus.textContent = (CONFIG.TAVILY_API_KEY && CONFIG.TAVILY_API_KEY.trim()) ? '✅ Key hinterlegt' : 'Kein Key hinterlegt';
      if (els.tavilySearchDepth) els.tavilySearchDepth.value = CONFIG.TAVILY_SEARCH_DEPTH || 'basic';
      if (els.tavilyMaxResults) els.tavilyMaxResults.value = String(CONFIG.TAVILY_MAX_RESULTS || 5);

      const channels = Array.isArray(CONFIG.DISCORD_CHANNELS) && CONFIG.DISCORD_CHANNELS.length > 0
        ? CONFIG.DISCORD_CHANNELS
        : (CONFIG.DISCORD_WEBHOOK_URL ? [{ id: 'default', name: 'Standard', url: CONFIG.DISCORD_WEBHOOK_URL }] : []);
      const primary = channels[0] || { id: 'default', name: 'Standard', url: CONFIG.DISCORD_WEBHOOK_URL || '' };
      if (els.discordPrimaryName) els.discordPrimaryName.value = primary.name || 'Standard';
      if (els.discordWebhookInput) els.discordWebhookInput.value = '';
      if (els.discordWebhookEditor) els.discordWebhookEditor.style.display = 'none';
      if (els.discordWebhookReveal) { els.discordWebhookReveal.style.display = ''; els.discordWebhookReveal.setAttribute('aria-expanded', 'false'); }
      if (els.discordWebhookStatus) els.discordWebhookStatus.textContent = isDiscordWebhookUrl(primary.url) ? '✅ Webhook hinterlegt' : 'Kein Webhook hinterlegt';

      if (els.discordExtraChannels) {
        renderExtraChannelsList(els.discordExtraChannels, channels.slice(1));
      }

      if (els.discordDealerEmbedToggle) els.discordDealerEmbedToggle.checked = CONFIG.DISCORD_SUPPRESS_DEALER_EMBED === false;
      if (els.discordProductEmbedToggle) els.discordProductEmbedToggle.checked = CONFIG.DISCORD_SUPPRESS_PRODUCT_EMBED === false;
      if (els.discordForumTitleToggle) els.discordForumTitleToggle.checked = CONFIG.DISCORD_FORUM_TITLE === true;
      if (els.discordLayoutInput) els.discordLayoutInput.value = CONFIG.DISCORD_LAYOUT;
      renderLayoutPreview(els);
      updateKeywordPreview(els);
  }

  function updateKeywordPreview(els) {
    if (!els.reviewKeywordInput || !els.reviewKeywordPreview) return;
    const kw = els.reviewKeywordInput.value.trim();
    const sampleProduct = 'Sony WH-1000XM5';
    const samplePrice = 'CHF 279.00';
    const expandedWithPrice = formatSearchQuery(sampleProduct, kw, samplePrice);
    const expandedNoPrice = formatSearchQuery(sampleProduct, kw, '');

    els.reviewKeywordPreview.textContent = expandedWithPrice;
    if (els.reviewKeywordPreviewNoPrice) {
      els.reviewKeywordPreviewNoPrice.textContent = expandedNoPrice;
    }
    if (els.reviewKeywordPreviewNoPriceRow) {
      els.reviewKeywordPreviewNoPriceRow.style.display = kw.includes('{preis}') ? '' : 'none';
    }
  }

  function bindDual(rangeEl, numEl, onInput = null) {
      if (!rangeEl || !numEl) return;
      rangeEl.addEventListener('input', e => {
        numEl.value = e.target.value;
        onInput?.(parseFloat(e.target.value), { source: 'range' });
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
        onInput?.(parseFloat(e.target.value), { source: 'number' });
      });
  }

  function updateWeightDesc(els, val) {
    if (els.bestpreiseWeightDesc) {
      els.bestpreiseWeightDesc.textContent = weightText(val / 100, 'desc');
    }
  }

  function bindControlPairs(els) {
    bindDual(els.marginRange, els.marginVal);
    if (els.opacityRange && els.opacityVal) {
      els.opacityRange.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        els.opacityVal.value = Math.round(v * 100);
        document.documentElement.style.setProperty('--tp-dim-opacity', v);
      });
      els.opacityVal.addEventListener('input', e => {
        const v = Math.min(1, Math.max(0.05, (parseFloat(e.target.value) || 0) / 100));
        els.opacityRange.value = v;
        document.documentElement.style.setProperty('--tp-dim-opacity', v);
      });
    }
    bindDual(els.alarmTargetRange, els.alarmTargetVal);
    bindDual(els.heatmapIntensityRange, els.heatmapIntensityVal);
    bindDual(els.realDealMinRange, els.realDealMinVal);
    bindDual(els.cacheMemoryRange, els.cacheMemoryVal);
    bindDual(els.cacheDiskRange, els.cacheDiskVal, () => {
      if (els.cacheStatsLabel && els.cacheDiskVal) {
        const count = countCachedPriceStats();
        els.cacheStatsLabel.textContent = `Lokaler Cache: ${count} / ${els.cacheDiskVal.value || 300} Einträge`;
      }
    });

    bindDual(els.bestpreiseWeightRange, els.bestpreiseWeightVal, v => updateWeightDesc(els, v));
    bindDual(els.bestpreiseHorizonRange, els.bestpreiseHorizonVal, (raw, meta) => {
      // Range tops out at the 760 Lifetime sentinel (>730 → 0); a typed number
      // is literal so values like 1000 round-trip through the schema (max 3650).
      const fromNumber = meta?.source === 'number';
      const v = fromNumber ? (isNaN(raw) ? 365 : raw) : horizonUiToStored(raw);
      if (els.bestpreiseHorizonDesc) els.bestpreiseHorizonDesc.textContent = `Ø-Vergleich: ${horizonText(v)} (0 = gesamte Historie / Lifetime, Vorgabe: 1J). Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis.`;
      if (v === 0) {
        if (els.bestpreiseHorizonRange) els.bestpreiseHorizonRange.value = 760;
        if (els.bestpreiseHorizonVal && meta?.source !== 'number') els.bestpreiseHorizonVal.value = 0;
      }
    });
    if (els.bestpreiseMinPointsRange && els.bestpreiseMinPointsVal) {
      els.bestpreiseMinPointsRange.addEventListener('input', e => {
        els.bestpreiseMinPointsVal.value = minPointsFromIndex(e.target.value);
      });
      els.bestpreiseMinPointsVal.addEventListener('input', e => {
        const typed = parseFloat(e.target.value);
        if (!isNaN(typed)) els.bestpreiseMinPointsRange.value = minPointsToIndex(clampMinPoints(typed));
      });
    }
  }

  // ─── MODULE: src/ui/modal-actions.js ────────────────────────────────────────
  /**
   * Modal actions (split from ui/modal.js): cache/webhook/layout/data/export/
   * import/open-close/save handlers + openSettingsAt entry point.
   */













  function snapshotModalState(dialog) {
    if (!dialog) return null;
    const state = new Map();
    const fields = dialog.querySelectorAll('input:not([type="file"]), select, textarea');
    for (const el of fields) {
      if (!el.id) continue;
      if (el.type === 'checkbox' || el.type === 'radio') {
        state.set(el.id, el.checked);
      } else {
        state.set(el.id, el.value);
      }
    }
    return state;
  }

  function hasPendingChanges(dialog, initialSnapshot) {
    if (!dialog || !initialSnapshot) return false;
    const current = snapshotModalState(dialog);
    if (!current) return false;
    for (const [id, val] of initialSnapshot.entries()) {
      if (current.get(id) !== val) {
        return true;
      }
    }
    return false;
  }

  function wireModalActions(els) {
    els.cacheClearBtn?.addEventListener('click', () => {
      const removed = clearPriceStatsCache();
      clearDealerMemory();
      const diskLimit = (els.cacheDiskVal && parseInt(els.cacheDiskVal.value, 10)) || CONFIG.CACHE_DISK_LIMIT || 300;
      if (els.cacheStatsLabel) els.cacheStatsLabel.textContent = `Lokaler Cache: 0 / ${diskLimit} Einträge`;
      triggerProcessListings();
      showToast(`Cache geleert (${removed} Produkte entfernt)`);
    });

    els.tavilyApiKeyReveal?.addEventListener('click', e => {
      if (e && !e.isTrusted) return;
      if (!els.tavilyApiKeyEditor || !els.tavilyApiKeyInput) return;
      els.tavilyApiKeyInput.value = '';
      els.tavilyApiKeyEditor.style.display = '';
      els.tavilyApiKeyReveal.style.display = 'none';
      els.tavilyApiKeyReveal.setAttribute('aria-expanded', 'true');
      els.tavilyApiKeyInput.focus();
    });

    els.discordWebhookReveal?.addEventListener('click', e => {
      // Replace, never reveal: the secret is write-only. The status line is
      // the only configured indicator — Shadow DOM is not a security boundary.
      if (e && !e.isTrusted) return;
      if (!els.discordWebhookEditor || !els.discordWebhookInput) return;
      els.discordWebhookInput.value = '';
      els.discordWebhookEditor.style.display = '';
      els.discordWebhookReveal.style.display = 'none';
      els.discordWebhookReveal.setAttribute('aria-expanded', 'true');
      els.discordWebhookInput.focus();
    });

    els.discordAddChannelBtn?.addEventListener('click', () => {
      if (els.discordExtraChannels) {
        addExtraChannelRow(els.discordExtraChannels);
      }
    });

    els.discordExtraChannels?.addEventListener('click', e => {
      const removeBtn = e.target.closest('.tp-discord-remove-channel-btn');
      if (removeBtn) {
        const card = removeBtn.closest('.tp-discord-extra-card');
        card?.remove();
        return;
      }
      const revealBtn = e.target.closest('.tp-discord-extra-reveal');
      if (revealBtn) {
        const card = revealBtn.closest('.tp-discord-extra-card');
        const editor = card?.querySelector('.tp-discord-extra-editor');
        const input = card?.querySelector('.tp-discord-extra-url');
        if (editor && input) {
          input.value = '';
          editor.style.display = '';
          revealBtn.style.display = 'none';
          revealBtn.setAttribute('aria-expanded', 'true');
          input.focus();
        }
      }
    });

    els.discordLayoutInput?.addEventListener('input', () => scheduleLayoutPreview(els));
    els.discordDealerEmbedToggle?.addEventListener('change', () => scheduleLayoutPreview(els));
    els.discordProductEmbedToggle?.addEventListener('change', () => scheduleLayoutPreview(els));
    for (const [name, recipe] of Object.entries(getLayoutPresets())) {
      els.shadow.getElementById(`tp-discord-layout-preset-${name}`)?.addEventListener('click', () => {
        if (!els.discordLayoutInput) return;
        const current = els.discordLayoutInput.value;
        if (!Object.values(getLayoutPresets()).includes(current) && !window.confirm('Layout ersetzen?')) return;
        els.discordLayoutInput.value = recipe;
        scheduleLayoutPreview(els);
      });
    }
    els.shadow.getElementById('tp-discord-layout-chips')?.addEventListener('click', e => {
      const token = e.target?.closest?.('button')?.dataset?.token;
      if (!token || !els.discordLayoutInput) return;
      const { selectionStart = els.discordLayoutInput.value.length, selectionEnd = els.discordLayoutInput.value.length } = els.discordLayoutInput;
      els.discordLayoutInput.value = els.discordLayoutInput.value.slice(0, selectionStart) + token + els.discordLayoutInput.value.slice(selectionEnd);
      els.discordLayoutInput.focus();
      scheduleLayoutPreview(els);
    });
    els.reviewKeywordInput?.addEventListener('input', () => updateKeywordPreview(els));
    els.reviewKeywordReset?.addEventListener('click', () => {
      if (!els.reviewKeywordInput) return;
      els.reviewKeywordInput.value = DEFAULTS.REVIEW_SEARCH_KEYWORD;
      updateKeywordPreview(els);
      els.reviewKeywordInput.focus();
    });
    els.discordLayoutReset?.addEventListener('click', () => {
      if (!els.discordLayoutInput) return;
      els.discordLayoutInput.value = DEFAULT_LAYOUT;
      scheduleLayoutPreview(els);
    });

    els.dataResetBtn?.addEventListener('click', () => {
      if (!window.confirm('Wirklich ALLE Suite-Daten löschen? Preis-/Händler-Cache und sämtliche Einstellungen (inkl. Discord-Webhook) werden auf Standard zurückgesetzt.')) return;
      const removed = clearPriceStatsCache();
      clearDealerMemory();
      getProductCards().forEach(clearCardCache);
      try {
        const dead = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.includes('DISCORD_FORUM:')) dead.push(k);
        }
        dead.forEach(k => localStorage.removeItem(k));
      } catch (e) {}
      try {
        const hook = (CONFIG.DISCORD_WEBHOOK_URL || '').trim();
        if (hook && typeof GM_deleteValue !== 'undefined') GM_deleteValue(discordForumFlagKey(hook));
      } catch (e) {}
      updateConfigs({ ...DEFAULTS });
      updateBodyClasses();
      syncFieldsFromConfig(els);
      if (els.cacheStatsLabel) els.cacheStatsLabel.textContent = `Lokaler Cache: 0 / ${CONFIG.CACHE_DISK_LIMIT || 300} Einträge`;
      showToast(`Alle Daten gelöscht (${removed} Cache-Einträge, Einstellungen zurückgesetzt)`);
    });

    els.exportBtn?.addEventListener('click', () => {
      const exportData = {
        _meta: {
          version: (typeof GM_info !== 'undefined' && GM_info?.script?.version) || 'dev',
          exported: new Date().toISOString()
        },
        // Bearer-Secret nie exportieren (JSON.stringify droppt undefined).
        config: { ...CONFIG, DISCORD_WEBHOOK_URL: undefined, DISCORD_CHANNELS: undefined, TAVILY_API_KEY: undefined },
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

    els.importBtn?.addEventListener('click', () => {
      els.importFile?.click();
    });

    els.importFile?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const importConfig = data.config || data;
          const prevShipping = CONFIG.USE_SHIPPING_PRICE;
          const prevHorizon = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS;
          const prevOutlierOn = CONFIG.OUTLIER_REJECTION_ENABLED;
          const prevOutlierBand = CONFIG.OUTLIER_DEVIATION_BAND;
          const prevOutlierHours = CONFIG.OUTLIER_MAX_GLITCH_HOURS;
          let count = 0;
          for (const [key, val] of Object.entries(importConfig)) {
            if (!(key in DEFAULTS) || key === 'DEBUG' || SECRET_KEYS.has(key)) continue;
            // Single schema: sanitize each imported key, drop unknowns/invalid.
            if (key === 'DISCORD_LAYOUT' && validateLayoutRecipe(String(val))) continue;
            const clean = sanitizeConfigValue(key, val);
            if (clean === undefined) continue;
            saveConfigKey(key, clean);
            count++;
          }
          if (CONFIG.USE_SHIPPING_PRICE !== prevShipping) { getProductCards().forEach(clearCardCache); }
          if (CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS !== prevHorizon || CONFIG.OUTLIER_REJECTION_ENABLED !== prevOutlierOn || CONFIG.OUTLIER_DEVIATION_BAND !== prevOutlierBand || CONFIG.OUTLIER_MAX_GLITCH_HOURS !== prevOutlierHours) recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
          updateBodyClasses();
          triggerProcessListings();
          syncFieldsFromConfig(els);
          showToast(`${count} Einstellungen importiert`);
        } catch (err) {
          showToast('Import fehlgeschlagen: Ungültige JSON-Datei');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    let initialSnapshot = null;

    const openModal = () => {
      syncFieldsFromConfig(els);
      initialSnapshot = snapshotModalState(els.dialog);
      if (typeof els.dialog.showModal === 'function') els.dialog.showModal();
      else els.dialog.setAttribute('open', '');
    };

    // Never leave a typed secret in the editor across sessions of the dialog.
    const clearWebhookEditor = () => {
      if (els.discordWebhookInput) els.discordWebhookInput.value = '';
      if (els.tavilyApiKeyInput) els.tavilyApiKeyInput.value = '';
      els.shadow?.querySelectorAll('.tp-discord-extra-url')?.forEach(input => { input.value = ''; });
    };
    const closeModal = () => {
      initialSnapshot = null;
      clearWebhookEditor();
      document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
      if (typeof els.dialog.close === 'function') els.dialog.close();
      else els.dialog.removeAttribute('open');
    };

    els.fabButton.addEventListener('click', openModal);
    els.btnClose.addEventListener('click', closeModal);
    // Native `close` (Escape on backdrop/frame, cancel event) bypasses both
    // closeModal and the els.shadow keydown handler — reset the preview anyway.
    els.dialog.addEventListener('close', () => {
      initialSnapshot = null;
      clearWebhookEditor();
      document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
      document.documentElement.classList.toggle('tp-hide-ads', !!CONFIG.HIDE_ADS);
    });

    els.hideAdsToggle?.addEventListener('change', e => {
      document.documentElement.classList.toggle('tp-hide-ads', e.target.checked);
    });

    els.btnSave.addEventListener('click', () => {
      const updates = {};

      updates.MARGIN_PERCENT = Math.max(0, Math.min(50, parseFloat(els.marginVal.value) || 0));
      updates.DIM_OPACITY = Math.max(0.05, Math.min(1, parseFloat(els.opacityRange.value) || 0.25));
      // Cache entries are keyed per shipping basis, so a mode change only needs
      // fresh card memos (below) — the other slot stays warm for toggling back.
      const shippingChanged = !!els.shippingToggle && CONFIG.USE_SHIPPING_PRICE !== els.shippingToggle.checked;
      if (els.shippingToggle) updates.USE_SHIPPING_PRICE = els.shippingToggle.checked;
      // Cached analyses bake in the median horizon — recompute them locally
      // from the retained series (no network) before the single repaint below.
      // Single schema: bounds live in config-store (min 0, max 3650), not here.
      const rawHorizon = els.bestpreiseHorizonVal ? parseInt(els.bestpreiseHorizonVal.value, 10)
        : (els.bestpreiseHorizonRange ? parseInt(els.bestpreiseHorizonRange.value, 10) : NaN);
      const newHorizon = sanitizeConfigValue('BESTPREISE_MEDIAN_HORIZON_DAYS', rawHorizon);
      const horizonChanged = !!(els.bestpreiseHorizonVal || els.bestpreiseHorizonRange) && CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS !== newHorizon;
      const checkedSort = els.shadow.querySelector('input[name="tp-sort-offers"]:checked');
      if (checkedSort) updates.SORT_BY_OFFERS = checkedSort.value;

      updates.ALARM_ENABLED = els.alarmEnabledToggle.checked;
      updates.ALARM_TARGET_PERCENT = Math.max(0.05, Math.min(0.99, (parseInt(els.alarmTargetVal.value) || 60) / 100));

      const checkedDur = els.shadow.querySelector('input[name="tp-alarm-duration"]:checked');
      if (checkedDur) updates.ALARM_DURATION_DAYS = String(parseInt(checkedDur.value, 10) || 730);

      updates.ALARM_AUTO_SUBMIT = els.alarmAutoSubmitToggle.checked;
      updates.HEATMAP_INTENSITY = clampIntensity01((parseInt(els.heatmapIntensityVal.value) || 100) / 100);

      if (els.bestpreiseModeToggle) updates.BESTPREISE_MODE_ACTIVE = els.bestpreiseModeToggle.checked;
      if (els.bestpreiseWeightVal) {
        const rawW = parseInt(els.bestpreiseWeightVal.value, 10);
        const weightNum = isNaN(rawW) ? 50 : rawW;
        updates.BESTPREISE_WEIGHT_RECORD = Math.max(0, Math.min(1.0, weightNum / 100));
      }
      if (els.bestpreiseHorizonVal || els.bestpreiseHorizonRange) {
        updates.BESTPREISE_MEDIAN_HORIZON_DAYS = newHorizon;
      }
      if (els.bestpreiseMinPointsVal) {
        updates.BESTPREISE_MIN_POINTS = clampMinPoints(els.bestpreiseMinPointsVal.value);
      }
      if (els.cacheTtlSelect) { const rawC = parseInt(els.cacheTtlSelect.value, 10); updates.REAL_DEAL_CACHE_HOURS = isNaN(rawC) ? 48 : rawC; }
      if (els.cacheNegTtlSelect) { const rawN = parseFloat(els.cacheNegTtlSelect.value); updates.NEGATIVE_CACHE_HOURS = isNaN(rawN) ? 2 : rawN; }
      if (els.cacheMemoryVal) { const rawM = parseInt(els.cacheMemoryVal.value, 10); updates.CACHE_MEMORY_LIMIT = isNaN(rawM) ? 500 : rawM; }
      if (els.cacheDiskVal) { const rawD = parseInt(els.cacheDiskVal.value, 10); updates.CACHE_DISK_LIMIT = isNaN(rawD) ? 300 : rawD; }
      if (els.realDealMinVal) { const rawMin = parseInt(els.realDealMinVal.value, 10); updates.REAL_DEAL_MIN_DISCOUNT = Number.isFinite(rawMin) ? Math.max(0, Math.min(90, rawMin)) : 30; }
      if (els.hideAdsToggle) updates.HIDE_ADS = els.hideAdsToggle.checked;
      if (els.sparklinesToggle) updates.ENABLE_SPARKLINES = els.sparklinesToggle.checked;
      if (els.keepaChartToggle) updates.KEEPA_CHART_ENABLED = els.keepaChartToggle.checked;
      if (els.dealerAutofetchToggle) updates.DEALER_AUTOFETCH = els.dealerAutofetchToggle.checked;
      if (els.reviewSearchToggle) updates.REVIEW_SEARCH_ENABLED = els.reviewSearchToggle.checked;
      if (els.reviewKeywordInput) updates.REVIEW_SEARCH_KEYWORD = sanitizeReviewKeyword(els.reviewKeywordInput.value);
      if (els.reviewAiModeToggle) updates.REVIEW_SEARCH_AI_MODE = els.reviewAiModeToggle.checked;
      if (els.tavilyEnabledToggle) updates.TAVILY_ENABLED = els.tavilyEnabledToggle.checked;
      if (els.tavilyApiKeyInput && els.tavilyApiKeyEditor && els.tavilyApiKeyEditor.style.display !== 'none') {
        updates.TAVILY_API_KEY = String(els.tavilyApiKeyInput.value || '').trim();
      }
      if (els.tavilySearchDepth) updates.TAVILY_SEARCH_DEPTH = els.tavilySearchDepth.value === 'advanced' ? 'advanced' : 'basic';
      if (els.tavilyMaxResults) {
        const rawMax = parseInt(els.tavilyMaxResults.value, 10);
        updates.TAVILY_MAX_RESULTS = Number.isFinite(rawMax) ? Math.max(1, Math.min(10, rawMax)) : 5;
      }
      let primaryUrl = CONFIG.DISCORD_CHANNELS?.[0]?.url || CONFIG.DISCORD_WEBHOOK_URL || '';
      if (els.discordWebhookInput && els.discordWebhookEditor && els.discordWebhookEditor.style.display !== 'none') {
        const rawWebhook = String(els.discordWebhookInput.value || '').trim();
        if (rawWebhook && !isDiscordWebhookUrl(rawWebhook)) {
          els.shadow.getElementById('tp-section-discord')?.classList.remove('tp-collapsed');
          els.shadow.querySelector('#tp-section-discord [data-collapse]')?.setAttribute('aria-expanded', 'true');
          els.discordWebhookInput.focus();
          showToast('Ungültige Discord-Webhook-URL');
          return;
        }
        primaryUrl = rawWebhook;
      }
      const primaryName = els.discordPrimaryName ? String(els.discordPrimaryName.value || '').trim() || 'Standard' : 'Standard';

      const channels = [];
      if (primaryUrl) {
        channels.push({ id: 'default', name: primaryName, url: primaryUrl });
      }

      if (els.discordExtraChannels) {
        const extraCards = els.discordExtraChannels.querySelectorAll('.tp-discord-extra-card');
        for (const card of extraCards) {
          const cId = card.dataset.channelId || `ch_${Date.now()}`;
          const cName = String(card.querySelector('.tp-discord-channel-name')?.value || '').trim() || 'Kanal';
          const existing = (CONFIG.DISCORD_CHANNELS || []).find(c => c.id === cId);
          const urlInput = card.querySelector('.tp-discord-extra-url');
          const editor = card.querySelector('.tp-discord-extra-editor');
          let cUrl = existing?.url || '';
          if (editor && editor.style.display !== 'none') {
            const typed = String(urlInput?.value || '').trim();
            if (typed) {
              if (!isDiscordWebhookUrl(typed)) {
                els.shadow.getElementById('tp-section-discord')?.classList.remove('tp-collapsed');
                els.shadow.querySelector('#tp-section-discord [data-collapse]')?.setAttribute('aria-expanded', 'true');
                urlInput?.focus();
                showToast('Ungültige Discord-Webhook-URL');
                return;
              }
              cUrl = typed;
            }
          }
          if (cUrl) {
            channels.push({ id: cId, name: cName, url: cUrl });
          }
        }
      }
      updates.DISCORD_CHANNELS = channels;
      updates.DISCORD_WEBHOOK_URL = channels[0]?.url || '';
      if (els.discordDealerEmbedToggle) updates.DISCORD_SUPPRESS_DEALER_EMBED = !els.discordDealerEmbedToggle.checked;
      if (els.discordProductEmbedToggle) updates.DISCORD_SUPPRESS_PRODUCT_EMBED = !els.discordProductEmbedToggle.checked;
      if (els.discordForumTitleToggle) updates.DISCORD_FORUM_TITLE = els.discordForumTitleToggle.checked;
      if (els.discordLayoutInput) {
        const value = String(els.discordLayoutInput.value || '');
        const err = validateLayoutRecipe(value);
        if (err) {
          if (els.discordLayoutError) els.discordLayoutError.textContent = err;
          els.shadow.getElementById('tp-section-discord')?.classList.remove('tp-collapsed');
          els.shadow.querySelector('#tp-section-discord [data-collapse]')?.setAttribute('aria-expanded', 'true');
          els.discordLayoutInput.focus();
          return;
        }
        updates.DISCORD_LAYOUT = value;
      }
      // Basis toggle keeps both cache slots (entries are keyed per basis): only
      // card memos clear + repaint, no whole-cache wipe, no generation bump.
      if (shippingChanged) {
        cancelBatchDealCheck();
        getProductCards().forEach(clearCardCache);
      }
      updateConfigs(updates, { skipRender: true });
      if (horizonChanged) recomputeCachedMedians(newHorizon);
      triggerProcessListings();
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
    if (anchor.classList.contains('tp-collapsed')) {
      anchor.classList.remove('tp-collapsed');
      anchor.querySelector('[data-collapse]')?.setAttribute('aria-expanded', 'true');
      const current = [...shadow.querySelectorAll('#tp-settings-sections section.tp-collapsed')].map(s => s.id);
      writeCollapsed(current);
    }
    anchor.scrollIntoView({ block: 'start' });
    anchor.classList.add('tp-flash');
    setTimeout(() => anchor.classList.remove('tp-flash'), 2000);
  }

  // ─── MODULE: src/ui/modal.js ────────────────────────────────────────────────
  /**
   * Settings modal orchestrator (split into modal-template/bindings/actions):
   * setupUI wires section inject -> elements -> collapse -> pairs -> actions.
   */





  function setupUI() {
    const { shadow } = ensureSkeleton();
    ensureModalSection(shadow);
    const els = collectModalElements(shadow);
    initCollapse(shadow);
    bindControlPairs(els);
    wireModalActions(els);
  }

  // ─── MODULE: src/ui/modal-share-preview.js ──────────────────────────────────
  /**
   * Discord Share Preview Modal
   * Displays deal preview (rendered markdown + chart/product images)
   * and channel action buttons for 1-click sharing.
   */



  const escapeHtml = s => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function openSharePreviewModal({ channels = [], onSend, onCancel }) {
    ensureSkeleton();
    const shadow = uiShadowRoot;
    if (!shadow) return null;

    // Clean up any stale preview dialog
    shadow.getElementById('tp-modal-share-preview')?.remove();

    const dialog = document.createElement('dialog');
    dialog.id = 'tp-modal-share-preview';
    dialog.className = 'tp-share-preview-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'tp-share-preview-title');

    const channelButtonsHtml = channels.map(ch => `
      <button type="button" class="tp-btn tp-share-channel-btn" data-channel-id="${escapeHtml(ch.id)}" disabled>
        📤 ${escapeHtml(ch.name)}
      </button>
    `).join('');

    dialog.innerHTML = `
      <div class="tp-share-preview-header">
        <h3 id="tp-share-preview-title" class="tp-share-preview-title">Discord Deal-Share</h3>
        <button type="button" class="tp-share-preview-close" aria-label="Schliessen">&times;</button>
      </div>

      <div class="tp-share-preview-body">
        <div class="tp-share-preview-loading" id="tp-share-preview-loading">
          <span class="tp-share-preview-spinner">⏳</span>
          <span>Vorschau wird vorbereitet…</span>
        </div>
        <div class="tp-share-preview-error" id="tp-share-preview-error" style="display: none;"></div>

        <div class="tp-share-preview-content-wrap" id="tp-share-preview-content-wrap" style="display: none;">
          <div class="tp-share-preview-label">Discord-Vorschau:</div>
          <div class="tp-share-preview-message" id="tp-share-preview-message"></div>
          <div class="tp-share-preview-images" id="tp-share-preview-images"></div>
        </div>
      </div>

      <div class="tp-share-preview-footer">
        <div class="tp-share-preview-channels" id="tp-share-preview-channels">
          ${channelButtonsHtml}
        </div>
        <button type="button" class="tp-btn tp-btn-secondary tp-share-cancel-btn">Abbrechen</button>
      </div>
    `;

    shadow.appendChild(dialog);

    const loadingEl = dialog.querySelector('#tp-share-preview-loading');
    const errorEl = dialog.querySelector('#tp-share-preview-error');
    const contentWrap = dialog.querySelector('#tp-share-preview-content-wrap');
    const messageEl = dialog.querySelector('#tp-share-preview-message');
    const imagesEl = dialog.querySelector('#tp-share-preview-images');
    const channelBtns = dialog.querySelectorAll('.tp-share-channel-btn');
    const closeBtn = dialog.querySelector('.tp-share-preview-close');
    const cancelBtn = dialog.querySelector('.tp-share-cancel-btn');

    const createdUrls = [];

    const cleanup = () => {
      while (createdUrls.length > 0) {
        const u = createdUrls.pop();
        try { URL.revokeObjectURL(u); } catch {}
      }
    };

    const close = () => {
      cleanup();
      if (typeof dialog.close === 'function') {
        try { dialog.close(); } catch {}
      }
      dialog.remove();
    };

    const handleCancel = () => {
      close();
      onCancel?.();
    };

    closeBtn?.addEventListener('click', handleCancel);
    cancelBtn?.addEventListener('click', handleCancel);

    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isBackdrop = (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
      if (isBackdrop) handleCancel();
    });

    dialog.addEventListener('cancel', e => {
      e.preventDefault();
      handleCancel();
    });

    const controller = {
      dialog,
      updateContent({ formattedContent, chartBlob, productBlob, keepaBlob }) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';

        if (messageEl) {
          messageEl.innerHTML = renderDiscordMarkdownPreview(formattedContent || '');
        }

        if (imagesEl) {
          imagesEl.innerHTML = '';
          if (productBlob instanceof Blob) {
            try {
              const prodUrl = URL.createObjectURL(productBlob);
              createdUrls.push(prodUrl);
              const prodImg = document.createElement('img');
              prodImg.className = 'tp-share-preview-img tp-share-preview-prod-img';
              prodImg.src = prodUrl;
              prodImg.alt = 'Produktbild';
              prodImg.title = 'Produktbild (wird als Bildanhang gesendet)';
              imagesEl.appendChild(prodImg);
            } catch {}
          }
          if (chartBlob instanceof Blob) {
            try {
              const chartUrl = URL.createObjectURL(chartBlob);
              createdUrls.push(chartUrl);
              const chartImg = document.createElement('img');
              chartImg.className = 'tp-share-preview-img tp-share-preview-chart-img';
              chartImg.src = chartUrl;
              chartImg.alt = 'Preisverlauf';
              chartImg.title = 'Preisverlauf (wird als Bildanhang gesendet)';
              imagesEl.appendChild(chartImg);
            } catch {}
          }
          if (keepaBlob instanceof Blob) {
            try {
              const keepaUrl = URL.createObjectURL(keepaBlob);
              createdUrls.push(keepaUrl);
              const keepaImg = document.createElement('img');
              keepaImg.className = 'tp-share-preview-img tp-share-preview-keepa-img';
              keepaImg.src = keepaUrl;
              keepaImg.alt = 'Amazon Keepa-Preisverlauf';
              keepaImg.title = 'Amazon Keepa-Preisverlauf (wird als Bildanhang gesendet)';
              imagesEl.appendChild(keepaImg);
            } catch {}
          }
        }

        if (contentWrap) contentWrap.style.display = '';

        channelBtns.forEach(btn => {
          btn.disabled = false;
        });
      },

      setError(errorMessage) {
        if (errorEl) {
          errorEl.textContent = errorMessage || 'Fehler beim Senden';
          errorEl.style.display = '';
        }
        channelBtns.forEach(btn => {
          btn.disabled = false;
          const ch = channels.find(c => c.id === btn.dataset.channelId);
          btn.textContent = `📤 ${ch?.name || 'Kanal'}`;
        });
      },

      setSending(channelId) {
        if (errorEl) errorEl.style.display = 'none';
        channelBtns.forEach(btn => {
          btn.disabled = true;
          if (btn.dataset.channelId === channelId) {
            btn.textContent = '⏳ Senden…';
          }
        });
      },

      close
    };

    channelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const channelId = btn.dataset.channelId;
        const targetChannel = channels.find(c => c.id === channelId);
        if (!targetChannel) return;
        controller.setSending(channelId);
        onSend?.(targetChannel, controller);
      });
    });

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    return controller;
  }

  // ─── MODULE: src/ui/toast.js ────────────────────────────────────────────────
  /**
   * Toast Notification Component
   * Renders glassmorphic notifications inside Shadow DOM.
   */


  let lastToastMessage = '';

  function getLastToastMessage() {
    return lastToastMessage;
  }

  function showToast(message) {
    lastToastMessage = message;
    if (typeof document === 'undefined') return;
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

  // ─── MODULE: src/ui/calc-preset-data.js ─────────────────────────────────────
  /** Calc preset data (split from ui/calc-preview.js): RLE history tables + expansion. Pure data, zero DOM imports. */

  // Generated RLE Presets for calc-preview
  const PRESET_DATA_S26 = [2,1249,3,1188.05,1,1131.8,1,1136.75,1,1188.05,1,1112.1,3,1079.6,1,1042.25,1,1029.35,1,1030.6,1,1021.45,2,1041.75,1,1010.55,1,1030.45,1,1033.1,1,1032.3,1,1012,1,1010.2,2,1025.55,1,1011.65,1,1005.35,1,997.5,1,996.2,1,1008.7,2,1014.35,1,1013.75,1,1012.45,1,989.15,1,987.7,1,987.75,1,987.25,1,1026.5,1,1026.1,1,1027.2,1,1006.9,1,1032.85,1,992.65,2,992.4,1,971,1,1015.65,1,999.4,1,990.15,3,981.7,1,969.4,1,961.75,1,956.6,1,956.75,1,957.3,1,955.45,1,949.3,1,950,1,944.1,1,957.9,1,964.35,1,939.6,1,939.55,1,939.35,1,939.4,1,945.95,1,946.45,1,947.75,3,949.75,1,945.65,1,937.75,1,943.4,1,946.95,3,944.25,1,943.9,1,946.75,1,936.75,1,934.7,4,937.4,1,937.65,1,943.25,1,935.85,3,927.65,1,926.45,2,934,2,933.7,1,933.9,1,935.6,8,934,1,942.25,1,934,1,931.7,2,927.95,1,927.75,1,935.6,1,934.75,1,930.1,1,936.15,1,930.95,1,933.85,1,924.7,1,928.1,2,927,1,924.95,3,923.65,1,924.25,2,925,1,924.35,1,924.4,2,921.95,1,928.5,1,924.85,1,921.7,1,920.5,3,923.5,1,923.95,1,928,1,926.5,4,927.4,1,919.2,1,920.8,1,921.5,1,922.25,2,917.55,1,918.1,1,915.85,1,915.6,1,915.7,1,914.9,3,918.95,1,917.45,1,917.9,1,919.1,1,920.2,1,928.7,1,921.45,1,922.05,1,922.55,1,921.55,5,928.7,1,927,1,928.7,1,928.2,9,928.7,9,929,1,847,3,929,1,960.35,6,929,3,948.65,4,949,4,948.65,1,956.5,1,959,1,956.8,1,955.75,2,953.25,1,959];
  const PRESET_DATA_R5 = [8,4479,17,4478,12,4319,7,4477.09,1,4478,3,4479,1,4478.6,29,4479,21,4478.9,1,4479,3,4478.9,1,3999,8,4477.9,3,4478.9,1,4399,14,4398.9,10,4478.9,65,4479,2,4319,48,4479,1,4528,4,4479,7,4218,2,4298,1,4200,38,4479,2,4031.1,50,4479,54,4478.95,2,4478,13,4478.95,1,4478,5,4478.95,3,4478,4,4478.95,2,4478,1,4478.95,2,4478,1,4478.95,2,4478,18,4477.95,2,3899,1,4477.95,1,3899,6,4477.95,2,3899,4,3898,2,3849,1,4477,61,4477.95,8,4477,2,4199,1,4477,6,4477.95,2,4199,1,4299,2,4031.9,11,4299,3,4477,1,4299,2,3999,1,4099,1,4299,18,4477,7,4476,2,4319,1,3899,6,4476,3,4188.5,4,4476,3,3899,3,4477,4,3990,7,3989.9,1,3910.2,11,3821,2,3210,6,3821,1,3489.9,6,3821,3,3625,5,3699,1,3728,1,3798,4,3899,1,3799,2,3798,6,3897.9,1,3798,2,3795,2,3698,1,3695,1,3698,2,3895,2,3470.1,2,3590,1,3699,2,3498,3,3890,1,3498,2,3890,2,3885,3,3349,2,3625,1,3799,1,3889,1,3888,1,3887,1,3790,1,3885,1,3884,5,3875,1,3869,1,3868,4,3847.05,2,3846,2,3845,1,3844,1,3843,3,3599,2,3501,1,3497,3,3398,6,3497,2,3399,4,3497,1,3399,1,3212,1,3399,2,3395,1,3495,4,3493,1,3395,5,3493,2,3349,5,3493,2,3299.9,1,3298,7,3299.9,1,3438,16,3499,1,3149,15,3499,1,3585,2,3584,3,3580,7,3583,4,3149,4,3547,13,3548,13,3284.9,1,3149,5,3547,1,3546,1,3419.9,2,3545,1,3544,6,3528,2,3546,1,3545,3,3540,2,3544,4,3543,1,3544,1,3543,6,3457,3,3543,1,3542,2,3540,4,3499,3,3498,1,3497,3,3495,1,3494,2,3489,15,3499,11,3498,2,3229.9,2,3428,2,3495,11,3225.6,3,3329.9,1,3328,1,3144.9,1,3144,8,3324,1,3199,2,3324,7,3495,4,3490,1,3349,1,3490,13,3299,12,3399,7,3149.9,1,3020,1,3149.9,5,3148,3,3298,9,3299.9,2,3299,5,3399,1,3114.9,2,3399,6,3360,4,2999.9,4,3149,6,3398,5,3298,2,2969.9,3,3298,1,3198,3,3298,2,2969.9,5,2999,3,2985,4,2999,2,3360,3,3359,1,3348,1,3295,4,3298,1,3240,3,3235,3,3298,1,3295,1,3294,1,3284,16,3370.45,6,3369,3,3358,8,3356,6,3249,3,3194.1,2,3194,1,3099,25,3098,9,2790,1,3079.95,4,2683.95,2,2920,1,3078,1,2920,2,2919,1,2915,1,2988,5,3079,1,3078,56,3078.5,21,3098,22,3194,4,2650,6,3194,79,3189,16,2899,6,3149,1,3148,1,2799,1,2798,2,2749,2,2748,3,2799,4,3144,5,2799,4,2798,9,2499,3,2798,1,2883,3,2949,3,2998,1,2999,9,2799,1,2898,5,2997,10,2949,1,2748,1,2798,18,2795,20,2609.1,1,2519.1,14,2797,23,2795,4,2749,26,2795,1,2749,5,2795,59,2794,1,2498,25,2497,1,2499,1,2676.15,6,2755.45,1,2750,39,2755.45,3,2794,10,2789,1,2519.95,22,2789,1,2491.95,2,2789,5,2198,2,2789,1,1998,2,2794,1,1998,13,1997,3,2788,1,2499,10,2480,8,1998,13,2483.06,1,2496,2,2649.8,4,2556,1,2649.8,12,2299,2,2556,7,2785,1,1899,6,2785,6,2750,14,2298,4,2696,5,2648,1,2485.5,1,2478,4,2399,14,2398,2,2749.95,8,2696,2,2449,6,2696,2,2519.95,11,2696,13,2695,4,2298,10,2695,1,1799,3,1998,24,2695,2,2198,7,1386.75,4,2689.95,16,2679.95,3,1998,1,1649.95,6,1998,4,1948,6,1848,13,1948,5,2678,3,2750,8,1848,4,2678,10,2698,3,2495.5,8,1848];
  const PRESET_DATA_SSD990 = [3,310.1,1,296.2,3,294.75,1,293.4,1,292.9,1,291.25,1,291.5,6,291.65,1,288.4,3,291.65,1,287.9,1,290.2,1,288.5,1,287.75,3,290.5,4,291.65,1,300.9,1,290,1,294.4,1,293.85,1,294.4,1,293.5,1,293.8,3,296.8,1,296.7,1,296.85,1,296.9,21,296.8,2,296.9,2,295.75,1,293,2,292,1,291.6,6,292,1,290,1,291.85,2,292,1,290.3,1,287.35,2,284.95,2,285.2,1,285.25,1,285.2,1,284.95,1,285,6,284.95,1,276.8,1,292.1,1,284.85,2,284.9,1,283.09,1,282.23,1,281.71,1,282.17,4,282.6,1,283.12,1,282.49,1,278.25,1,277.9,1,274.25,6,274.3,1,274.35,3,274.3,1,275.8,1,278.75,5,279,1,277.4,1,277,1,275.7,4,276,1,277,1,275,1,275.35,1,275.4,1,275.35,1,275.05,1,275.5,2,217,1,216.9,2,216.95,1,216.9,1,216.85,6,215.35,1,215,1,215.05,1,212.65,1,212.9,2,212.2,1,212.15,1,211.75,1,212.55,1,211.6,2,212.1,1,212.15,1,212.75,1,212.45,1,207.7,1,206.2,1,205.25,1,205.8,1,205.75,1,205.35,1,205,1,201.25,1,200.95,4,199.65,1,203.5,1,202.31,1,208.78,5,208,4,189,1,208,7,189,2,208,1,207.99,1,207.5,5,205,2,203.65,3,203.1,1,203,1,203.1,1,199.4,1,206.08,1,198.9,1,198.7,1,198.65,1,205.86,1,187.3,1,186.95,1,202,3,188.15,8,178,1,179,2,178.9,12,178,1,177.95,1,178,4,164.75,1,164.46,1,164.25,1,164.6,1,164.65,1,164.5,1,164.35,1,164.2,1,160.4,1,160.35,1,160.9,3,160.25,1,160.45,1,161.6,1,161.35,1,161.3,3,160.14,1,160.17,1,158.25,1,157.8,1,157.75,1,158.55,2,158,1,157.4,1,157.45,1,154.35,1,158.2,3,157.35,1,157.3,1,157.15,1,157,2,149,1,153.1,1,154,1,153.9,1,158,1,156.8,1,156.65,1,156.5,1,156.35,1,156.2,1,156.05,1,156.2,1,155.6,1,154.25,1,152.55,1,152.5,1,152.55,1,152.4,1,149.15,1,149.75,1,149.65,3,149.75,2,150.5,1,152,1,155.02,3,155.33,1,155.76,1,155.15,1,155.05,1,155.5,2,155.63,1,155.4,1,154.85,1,155.13,1,155.44,1,153.05,3,151.1,1,151.6,1,151.3,1,151.25,1,150.95,3,151.3,1,151.2,1,151.45,1,151.3,1,151.85,1,151.5,2,151.6,1,148.55,11,129,2,151,1,150.9,1,151.9,2,151,4,152.9,6,153.9,1,149.5,1,149.75,1,149.6,1,149.85,3,149.75,1,152.71,1,147.24,1,147.62,1,147.32,1,147.23,2,145.96,1,132.87,1,149.9,1,149.75,1,139,1,136.63,2,136.8,1,136.97,1,137.73,1,137.04,1,137.09,1,137.38,2,137.96,1,138.1,1,138.46,1,143.54,1,141.62,1,142.45,1,144.75,1,143.09,1,143.78,1,143.8,1,143.71,1,139.3,1,143.9,1,140.45,1,143.93,2,151,1,153.9,1,152.9,1,122.18,2,122.47,1,122.39,1,122.66,1,133.52,1,133.29,1,138.03,1,139.83,2,153,1,164.99,1,148.33,1,147.26,1,155.65,2,149.77,1,149.88,1,154.04,1,149.15,1,148.85,3,149.4,3,161,1,160.9,1,161,4,161.9,2,152.9,6,151.9,1,152.9,5,149.9,7,150.9,5,156.9,1,165.9,2,161.9,4,162.9,1,167.85,1,168.4,1,168,1,153.71,1,143.46,1,143.18,1,153.32,1,152,1,142.48,1,152,1,142.39,1,152,3,151.9,2,152,1,153.25,1,154.15,1,155.05,1,155.95,1,163.3,1,154.2,1,155.22,1,155.24,1,150.77,2,155.18,1,151.04,1,145.11,1,162,6,163.3,1,155.76,1,159,1,156.3,4,154,1,152.62,5,148.9,2,141.9,1,142.35,3,142.3,1,142.35,2,142.8,1,143.35,3,144.25,1,143.55,1,144.2,1,150.63,1,144.85,4,144,1,143.7,1,144.65,1,144.8,1,169.5,2,168,2,146,12,152.1,1,163,1,169.25,1,170,1,160.54,1,161,2,160.78,1,148.44,1,148.1,2,148.83,1,149.04,1,148.15,1,147.82,1,148.6,1,148.8,1,144.55,1,148.75,4,148.85,1,149.4,2,146.92,1,166.1,1,162,1,164,1,163,1,167.1,1,166.05,1,166.3,3,166,2,165.7,1,165.35,1,164.9,3,163.35,1,163.4,1,161.88,1,161.9,1,161.61,1,158.89,3,166.6,1,157.68,1,157.99,1,158.43,3,156.23,1,156.68,1,157.11,1,157.01,1,157.67,3,157.52,1,158.33,1,157.85,2,157.9,3,159.45,1,155.99,1,156.12,1,156.46,1,156.44,3,156.65,1,156.34,1,156.36,1,156,1,156.41,3,157.8,1,156.51,1,156.61,1,155.52,1,147.63,1,147.73,2,147.62,1,147.69,1,147.83,1,147.62,1,146.12,1,145.98,3,146.35,1,146.41,1,145.81,1,145.89,1,144.57,2,143.86,1,143,1,143.93,1,143.79,1,144.38,1,145.27,2,144.94,1,145.17,1,145.42,1,149.22,1,149.62,1,150.16,2,149.93,1,149.79,1,145.24,1,144.48,2,144.3,2,144.24,1,144.1,2,141.94,1,140.24,1,140.64,1,140.69,1,145.53,1,140.66,3,143.37,1,139.41,1,140.05,1,146.84,1,139.37,1,139.45,1,138.68,1,139.78,1,140.1,2,140.78,1,140.65,1,140,1,139.66,1,139.62,1,139.86,2,140.48,1,140.58,1,139.34,1,139.55,1,140.17,1,140.06,2,138.89,1,139.06,1,142.2,1,140.27,1,138.62,3,140.36,1,140.27,1,152.45,1,153.15,1,143.72,1,143.03,2,146.94,1,147.43,1,144,1,147.24,1,146.97,3,147.3,1,146.97,1,146.74,1,140.42,1,140.55,3,141.05,1,140.82,1,140.85,2,141.22,2,142.9,1,145.74,1,145.48,1,145.36,1,129.48,1,133.52,1,130.83,3,130.5,1,144.62,1,145,1,144.85,3,145.16,1,144.77,1,99.95,1,142.9,1,121.87,3,142.9,1,141.9,6,142.9,1,114.19,1,142.9,2,143.86,3,143.53,1,143.7,1,143.27,1,143.47,1,144.08,1,145.1,2,138.77,2,139,1,145.05,1,144.08,3,143.73,2,147.9,6,148.9,1,149.9,2,148.9,3,150.95,1,152.1,1,152.35,1,152.2,1,155.05,3,152.7,2,153.65,1,156.15,1,155.55,3,155.15,1,153.35,1,153.7,1,153.5,1,153.4,3,151.7,1,152.15,1,151.45,1,151.25,1,151.55,3,151.6,1,147.7,1,147.9,1,151.65,1,151.4,1,151.9,2,153.7,1,150.85,1,150.65,1,150.8,1,151.3,2,150.8,1,151.8,1,151.75,2,151.7,1,151.4,3,148.05,1,147.9,1,147.5,1,147.4,1,146.85,3,146.15,1,147.05,1,147.1,1,151.05,1,153.15,3,149.05,1,151.9,1,152.1,1,152.55,1,147.25,3,146.95,1,147.45,1,147.8,1,148.2,1,152.4,2,152.6,1,152.8,1,152.55,1,149.55,1,149.35,1,148.9,1,149.35,1,150.25,1,150.15,1,149.3,1,150,1,149.55,1,150,3,148.85,1,148.05,1,146.9,1,145.65,1,147.1,1,144.7,1,145.05,1,145.3,1,145.25,1,145,1,145.65,1,145.4,5,145.95,1,146.6,1,147.4,1,147.65,1,145.55,1,145.75,1,141.35,1,140.69,1,144.55,1,144.45,3,144.8,1,144.05,1,143.1,2,139.62,3,139.15,1,139.46,1,139.68,1,139.97,1,140.12,1,139.27,3,139.38,1,139.78,1,138.94,1,139.22,1,139.31,2,137.4,1,143.9,1,143.6,1,144.05,1,144.4,3,141.35,1,141.45,1,141.55,1,140.75,1,110.97,4,139.95,1,140.2,1,140.5,1,140.8,3,139.01,1,139.52,1,136.17,1,136.27,1,136.07,3,136.44,1,136.04,1,135.91,1,135.53,1,135.79,3,135.5,1,135.33,1,134.99,1,135.08,1,139.95,1,140.15,1,140.25,1,140.35,1,140.15,1,135.82,1,126.39,1,126.15,1,126.1,1,139.4,1,139.6,1,139.35,1,139.4,1,138.55,1,138.45,3,138.8,1,138.55,1,138.7,1,135.28,1,138.35,3,138.45,1,138.4,1,137.85,5,137.75,1,126.11,1,138.4,1,138.3,4,128.95,1,129.76,1,129.95,1,143,1,139.6,3,139.35,1,139.7,1,139.35,1,139.25,1,138.85,2,139.2,1,129.46,1,123.78,1,123.38,1,123.23,1,122.9,1,123.3,2,123.26,1,123.32,2,123.46,26,129.47,1,137.1,1,128.38,1,136.84,1,136.89,2,136.7,1,136.57,1,136.29,1,136.23,1,136.47,1,136.55,2,136.16,1,136.3,1,136.17,1,136.06,1,135.69,1,135.45,2,135.36,1,133.67,1,133.31,1,133.44,1,133.55,1,138.41,1,133.63,1,138.58,1,138.64,1,133.71,1,133.49,1,134.12,3,129.95,3,139.95,3,144.95,1,144.5,1,143.5,1,142.5,1,138.97,1,140.08,1,139.5,1,138.5,1,137.5,2,137.3,1,147.1,6,162.8,2,169.95,1,143.24,2,169.95,3,179,5,184.95,1,170.59,1,170.3,1,169.72,1,169.49,2,169.81,1,169.76,1,169.94,1,169.74,1,169.66,1,169.34,1,169.27,1,178.58,1,178.48,7,184.95,1,184.35,1,183.35,1,182.35,1,181.35,1,180.35,1,179.35,1,178.35,7,184.95,1,204.86,2,206,1,184.95,7,206,2,205.53,1,205.14,1,184.95,1,204.41,1,204.1,1,203.85,2,197.16,1,196.48,1,204.55,1,204.07,1,204.1,1,204.19,2,203.98,1,204.1,1,203.1,1,202.39,1,203.56,1,203.25,2,202.82,1,202.83,1,213.61,1,214.05,1,213.64,1,213.82,2,214.1,1,214,1,214.18,1,213.67,1,213.89,1,213.92,1,212.88,1,216.49,1,220.08,1,221.63,1,235.95,1,235.85,6,184.95,1,234.49,1,235.68,1,235.19,3,263,2,235.87,1,237.48,2,237.26,1,237.27,1,237.76,1,240.5,1,248.84,1,238.99,2,241.53,1,241.5,1,240.57,1,242.28,1,243.63,1,243.73,1,244.13,1,243.93,2,243.82,1,243.79,1,243.91,1,244.31,2,244.6,1,244.61,1,243.55,1,242.67,1,242.93,1,243.2,2,242.24,1,242.4,1,241.81,1,241.51,1,242.14,1,242.22,2,242.33,1,242.5,1,242.67,1,243.36,1,251.58,1,249.84,2,249.62,4,264,2,276.15,2,265.93,1,266.52,2,265.49,2,265.17,1,269.99,1,270.02,1,270.12,1,270.49,1,270.11,1,269.78,2,271.36,1,275.3,1,274.85,1,288.35,1,288.7,1,288.4,2,288.65,1,288.4,1,289,1,289.6,1,289.7,3,289.9,1,289.85,2,289.7,1,289.8,16,289.7,1,279.95,5,289.7,2,291.6,1,291.8,1,292.2,5,294.7,1,292,1,293.35,1,294.75,1,294.7,3,293.05,1,294.7,3,189,10,294.7,11,294.65,4,294.95,1,294.65,1,285.5,14,294.65,1,305.55,3,304.8,1,306.85,1,298.7,13,299,2,298.7,2,299,1,298.7,1,299,1,298.7,1,307.15,1,307.9,1,307.45,1,310.25,1,311.45,1,219,2,311.45,6,310.3];
  const DAY_MS = 86400000;
  const PRESET_DATA_SYNTHETIC = [37,429,1,425,1,422,1,428,1,419,1,424,1,421,1,427,1,423,1,418,1,426,1,150,1,429,1,424,1,420,1,426,1,890,1,422,1,419,1,425,1,421,1,427,1,423,1,420];
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
    synthetic: { id: 'synthetic', label: '🧪 Glitch-Demo (60 Pkt)', cardPrice: 400, rle: PRESET_DATA_SYNTHETIC },
  };

  function getPreset(id) {
    return PRESETS[id] || PRESETS.s26;
  }

  // ─── MODULE: src/ui/calc-preview.js ─────────────────────────────────────────
  const fmtPreviewMedian = v => String(Number(v.toFixed(2)));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function previewStats(points, o) {
    const band = o?.band ?? 0.50;
    const hours = o?.hours ?? 48;
    const enabled = o?.enabled !== false;
    const horizonDays = o?.horizonDays ?? 365;
    const wRaw = o?.weightRecord ?? 0.50;
    const weightRecord = Math.max(0, Math.min(1, wRaw));
    const minPoints = clampMinPoints(o?.minPoints ?? 5);
    const cardPrice = o?.cardPrice ?? 0;
    const now = o?.now ?? Date.now();

    const san = enabled
      ? sanitizeTimeSeries(points, band, hours, o?.cardPrice > 0 ? o.cardPrice : null)
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
      && priceToCents(cardPrice) <= priceToCents(tiefstpreis) && median > 0;
    const isZeroMargin = dMedian <= 0 && dRecord <= 0;
    const badge = qualifies
      ? (isZeroMargin ? 0 : Math.max(1, Math.round((1 - weightRecord) * dMedian + weightRecord * dRecord)))
      : null;
    const recordLow = live.previousLow ?? 0;
    const cutoffTs = horizonDays > 0 && !medianFallback ? now - horizonDays * DAY_MS : null;

    return { median, medianFallback, windowCount, activeCount: clean.length, dropped: san.filteredOutliers || [], tiefstpreis, dMedian, dRecord, badge, qualifies, clean, localMedians: ((san.filteredOutliers || []).length === 0 && san.localMedians) ? san.localMedians : rollingMedians(clean), recordLow, cutoffTs, filterMedian: enabled ? (san.rawMedian || 0) : 0 };
  }

  function cropPreviewWindow(clean, dropped, cutoffTs) {
    if (cutoffTs === null || cutoffTs === undefined) return { visibleDropped: dropped || [] };
    return {
      visibleDropped: (dropped || []).filter(g => g.timestamp >= cutoffTs),
    };
  }

  const PV_MARGIN = { top: 8, right: 10, bottom: 16, left: 40 };

  function computeXAxisTicks(t0, t1, fracX) {
    const span = t1 - t0;
    if (span <= 0) return [];
    const DAY = 86400000;
    const spanDays = span / DAY;
    let stepDays, labelFn;
    if (spanDays <= 3) {
      stepDays = 0.5;
      labelFn = (d) => d === 0 ? 'Jetzt' : `-${Math.round(d * 24)}h`;
    } else if (spanDays <= 14) {
      stepDays = 2;
      labelFn = (d) => d === 0 ? 'Heute' : `-${d}T`;
    } else if (spanDays <= 35) {
      stepDays = 7;
      labelFn = (d) => d === 0 ? 'Heute' : `-${Math.round(d / 7)}W`;
    } else if (spanDays <= 120) {
      stepDays = 30;
      labelFn = (d) => d === 0 ? 'Heute' : `-${Math.round(d / 30)}M`;
    } else if (spanDays <= 450) {
      stepDays = 90;
      labelFn = (d) => d === 0 ? 'Heute' : `-${Math.round(d / 30)}M`;
    } else if (spanDays <= 1200) {
      stepDays = 365;
      labelFn = (d) => d === 0 ? 'Heute' : `-${Math.round(d / 365)}J`;
    } else {
      stepDays = 730;
      labelFn = (d) => d === 0 ? 'Heute' : `-${Math.round(d / 365)}J`;
    }

    const ticks = [];
    for (let d = 0; d <= spanDays + 0.001; d += stepDays) {
      const ts = t1 - d * DAY;
      if (ts < t0 - 1000) break;
      const x = fracX(ts);
      ticks.push({ x, label: labelFn(d), ts });
    }
    return ticks;
  }

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
    const t0 = n ? pts[0][0] : 0;
    const t1 = n ? pts[n - 1][0] : 0;
    const f1 = v => v.toFixed(1);
    const fracX = ts => m.left + (t1 > t0 ? Math.max(0, Math.min(1, (ts - t0) / (t1 - t0))) * innerW : 0);
    const pt = p => `${f1(fracX(p[0]))},${f1(y(p[1]))}`;
    const pointsAttr = pts.map(pt).join(' ');
    const recordY = (typeof o.recordLow === 'number' && o.recordLow > 0) ? y(o.recordLow) : null;
    let ribbonAttr = null, ribbonTopAttr = null, ribbonBotAttr = null;
    if (o.band > 0 && Array.isArray(o.localMedians) && o.localMedians.length === n && n > 0 && o.localMedians.every(v => v > 0)) {
      const tops = [], bots = [];
      for (let q = 0; q < n; q++) {
        const med = o.localMedians[q];
        tops.push(`${f1(fracX(pts[q][0]))},${f1(Math.max(m.top, Math.min(h - m.bottom, y(med * (1 + o.band)))))}`);
        bots.push(`${f1(fracX(pts[q][0]))},${f1(Math.max(m.top, Math.min(h - m.bottom, y(med * (1 - o.band)))))}`);
      }
      ribbonTopAttr = tops.join(' ');
      ribbonBotAttr = bots.join(' ');
      ribbonAttr = ribbonTopAttr + ' ' + [...bots].reverse().join(' ');
    }
    const medianY = o.median > 0 ? y(o.median) : null;
    const glitchXY = (o.dropped || []).map(g => ({ x: fracX(g.timestamp), y: y(g.price) }));
    const anchor = (typeof o.cardPrice === 'number' && o.cardPrice > 0)
      ? { x: m.left + innerW, y: y(o.cardPrice) }
      : null;
    let anchorLink = null;
    if (n > 0 && anchor) {
      const y1 = y(pts[n - 1][1]);
      if (Math.abs(y1 - anchor.y) >= 0.5) anchorLink = { x1: anchor.x, y1, x2: anchor.x, y2: anchor.y };
    }
    const rawAttr = o.raw?.length ? o.raw.map(p => `${f1(fracX(p[0]))},${f1(y(p[1]))}`).join(' ') : null;
    const ticks = [{ y: y(hi), label: fmtPreviewMedian(hi) }, { y: y(lo), label: fmtPreviewMedian(lo) }];
    if (o.median > 0) { const my = y(o.median); if (Math.abs(my - y(hi)) >= 10 && Math.abs(my - y(lo)) >= 10) ticks.splice(1, 0, { y: my, label: fmtPreviewMedian(o.median) }); }
    const xTicks = n >= 2 ? computeXAxisTicks(t0, t1, fracX) : [];
    return { pointsAttr, ribbonAttr, ribbonTopAttr, ribbonBotAttr, medianY, glitchXY, anchor, anchorLink, ticks, xTicks, recordY, rawAttr, fracX };
  }

  let activePresetId = 's26';

  function buildCalcPreview() {
    const box = document.createElement('div');
    box.id = 'tp-calc-preview';
    const opts = `<optgroup label="Beispiel-Historien">${Object.values(PRESETS).map(p => `<option value="${p.id}"${p.id === 's26' ? ' selected' : ''}>${p.label}</option>`).join('')}</optgroup>`;
    box.innerHTML = `<div class="tp-preview-head"><span>Live-Vorschau</span><select id="tp-preview-preset-select" class="tp-preview-select" title="Beispiel-Historie für die Vorschau">${opts}</select></div>`
      + `<div id="tp-preview-key"><span><span class="tp-pv-k-main">—</span> Verlauf</span><span><span class="tp-pv-k-med">– –</span> Ø</span><span><span class="tp-pv-k-rec">····</span> Rekord</span><span><span class="tp-pv-k-band">▉</span> Band</span><span><span class="tp-pv-k-demo">···</span> Demo</span><span><span class="tp-pv-k-g">×</span> Glitch</span></div>`
      + `<svg id="tp-preview-svg" viewBox="0 0 296 110" role="img" aria-label="Preisverlauf-Vorschau"></svg>`
      + `<div id="tp-preview-legend"></div><div id="tp-preview-blend"></div><div id="tp-preview-status"></div>`;
    const sel = box.querySelector('#tp-preview-preset-select');
    if (sel) sel.addEventListener('change', () => {
      activePresetId = sel.value || 's26';
      refreshCalcPreview();
    });
    return box;
  }

  function getPageProductOptions(limit = 30) {
    const out = [];
    const seen = new Set();
    let cards = [];
    try {
      cards = Array.from(document.querySelectorAll(SELECTORS.cards.standard));
    } catch (e) { return out; }
    if (!cards.length) {
      try { cards = Array.from(document.querySelectorAll('a.Plugin_Product, .mixedBrowsingListProduct')); } catch (e) { return out; }
    }
    for (const card of cards) {
      if (out.length >= limit) break;
      const pid = getCardProductId(card) || card.dataset?.entityId || card.dataset?.tpProductId;
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      const canonical = extractCanonicalPrice(card);
      let entry = null;
      try { entry = getCardStats(pid, canonical?.basis); } catch (e) { continue; }
      if (!entry || entry.unavailable || !Array.isArray(entry.timeSeries) || !entry.timeSeries.length) continue;
      const title = (extractShareData(card).title || card.querySelector('.title')?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const med = typeof entry.medianPrice === 'number' && entry.medianPrice > 0 ? ` · Ø ${fmtPreviewMedian(entry.medianPrice)}` : '';
      out.push({ pid, label: esc(`${title || `pid ${pid}`}${med}`), card });
    }
    return out;
  }

  function refreshCalcPreview() {
    const svg = document.getElementById('tp-preview-svg');
    const legend = document.getElementById('tp-preview-legend');
    const blend = document.getElementById('tp-preview-blend');
    const status = document.getElementById('tp-preview-status');
    if (!svg || !legend || !blend || !status) return;
    const sel = document.getElementById('tp-preview-preset-select');
    const pageOpts = getPageProductOptions();
    const prevVal = sel ? sel.value : activePresetId;
    if (sel) {
      sel.innerHTML = `<optgroup label="Beispiel-Historien">${Object.values(PRESETS).map(p => `<option value="${p.id}">${p.label}</option>`).join('')}</optgroup>`
        + (pageOpts.length ? `<optgroup label="Geprüfte Produkte auf dieser Seite">${pageOpts.map(o => `<option value="page:${esc(o.pid)}">${o.label}</option>`).join('')}</optgroup>` : '');
      sel.value = (PRESETS[prevVal] || (typeof prevVal === 'string' && prevVal.startsWith('page:') && pageOpts.some(o => `page:${o.pid}` === prevVal))) ? prevVal : activePresetId;
    }
    const selVal = sel ? sel.value : activePresetId;
    const now = Date.now();
    let points;
    let cardPrice;
    const pageHit = typeof selVal === 'string' && selVal.startsWith('page:') ? pageOpts.find(o => `page:${o.pid}` === selVal) : null;
    if (pageHit) {
      activePresetId = selVal;
      const canonical = extractCanonicalPrice(pageHit.card);
      const entry = getCardStats(pageHit.pid, canonical?.basis) || {};
      const raw = fullSeries(entry);
      points = Array.isArray(raw) ? raw : [];
      const live = canonical?.price;
      cardPrice = (typeof live === 'number' && live > 0) ? live : (entry.anchorPrice || 0);
    } else {
      const preset = getPreset(selVal);
      activePresetId = preset.id;
      points = expandRleSeries(preset.rle, now);
      cardPrice = preset.cardPrice;
    }
    const num = (id, fb) => {
      const el = document.getElementById(id);
      if (!el) return fb;
      const v = parseInt(el.value, 10);
      return isNaN(v) ? fb : v;
    };
    const weightRecord = Math.max(0, Math.min(1, num('tp-bar-weight-range', 50) / 100));
    const hRaw = num('tp-bar-horizon-range', 365);
    const horizonDays = horizonUiToStored(hRaw);
    const rangeEl = document.getElementById('tp-bar-minpoints-range');
    const minPoints = minPointsFromIndex(rangeEl ? rangeEl.value : undefined);
    const toggle = document.getElementById('tp-bar-outlier-toggle');
    const enabled = toggle ? toggle.checked : true;
    const band = Math.min(50, Math.max(1, num('tp-bar-outlier-band-range', 50))) / 100;
    const hours = Math.min(168, Math.max(24, num('tp-bar-outlier-hours-range', 48)));
    const st = previewStats(points, { band, hours, enabled, horizonDays, weightRecord, minPoints, cardPrice, now });
    const { visibleDropped } = cropPreviewWindow(st.clean, st.dropped, st.cutoffTs);
    const visibleRaw = (enabled && visibleDropped.length > 0) ? (st.cutoffTs ? points.filter(p => p[0] >= st.cutoffTs) : points) : null;
    const co = previewCoords(st.clean, { median: st.median, localMedians: st.localMedians, band: enabled ? band : 0, cardPrice, dropped: visibleDropped, recordLow: st.recordLow, raw: visibleRaw });
    const f1 = v => v.toFixed(1);
    const mainStroke = st.activeCount < minPoints ? '#94a3b8' : '#3b82f6';
    let s = '';
    if (co.rawAttr) s += `<polyline class="tp-pv-raw" points="${co.rawAttr}" fill="none" stroke="#94a3b8" stroke-width="1" opacity="0.45" vector-effect="non-scaling-stroke"/>`;
    if (st.cutoffTs != null) {
      const cx = co.fracX(st.cutoffTs);
      s += `<rect x="${PV_MARGIN.left}" y="${PV_MARGIN.top}" width="${f1(Math.max(0, cx - PV_MARGIN.left))}" height="${110 - PV_MARGIN.top - PV_MARGIN.bottom}" fill="#64748b" opacity="0.22"/>`;
      s += `<line class="tp-pv-cut" x1="${f1(cx)}" x2="${f1(cx)}" y1="${PV_MARGIN.top}" y2="${110 - PV_MARGIN.bottom}" stroke="#64748b" stroke-dasharray="3 2" stroke-width="1"/>`;
      s += `<text x="${f1(cx + 3)}" y="${PV_MARGIN.top + 8}" font-size="8" fill="#64748b">${horizonText(horizonDays)}</text>`;
    }
    if (Array.isArray(co.xTicks)) {
      for (const xt of co.xTicks) {
        s += `<line class="tp-pv-xgrid" x1="${f1(xt.x)}" x2="${f1(xt.x)}" y1="${PV_MARGIN.top}" y2="${110 - PV_MARGIN.bottom}" stroke="#475569" stroke-opacity="0.22" stroke-dasharray="2 2" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`;
        s += `<text class="tp-pv-xlabel" x="${f1(xt.x)}" y="${110 - PV_MARGIN.bottom + 11}" font-size="8" fill="#64748b" text-anchor="middle">${xt.label}</text>`;
      }
    }
    if (co.ribbonAttr != null) s += `<polygon class="tp-pv-band" points="${co.ribbonAttr}" fill="#3b82f6" opacity="0.08"/>`;
    for (const edge of [co.ribbonTopAttr, co.ribbonBotAttr]) {
      if (edge != null) s += `<polyline class="tp-pv-band-edge" points="${edge}" fill="none" stroke="#3b82f6" stroke-width="1" opacity="0.45" vector-effect="non-scaling-stroke"/>`;
    }
    for (const t of co.ticks) {
      s += `<line class="tp-pv-ygrid" x1="${PV_MARGIN.left}" x2="${296 - PV_MARGIN.right}" y1="${f1(t.y)}" y2="${f1(t.y)}" stroke="#475569" stroke-opacity="0.18" stroke-dasharray="2 2" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`;
      s += `<text x="36" y="${f1(t.y + 3)}" font-size="9" fill="#64748b" text-anchor="end">${t.label}</text>`;
    }
    if (st.recordLow > 0 && st.dRecord > 0 && co.recordY !== null) {
      s += `<line class="tp-pv-rec" x1="${PV_MARGIN.left}" x2="${296 - PV_MARGIN.right}" y1="${f1(co.recordY)}" y2="${f1(co.recordY)}" stroke="#f59e0b" stroke-dasharray="4 3" stroke-width="1" vector-effect="non-scaling-stroke" opacity="${0.25 + 0.75 * weightRecord}"/>`;
    }
    if (co.medianY !== null) {
      s += `<line class="tp-pv-med" x1="${PV_MARGIN.left}" x2="${296 - PV_MARGIN.right}" y1="${f1(co.medianY)}" y2="${f1(co.medianY)}" stroke="#64748b" stroke-dasharray="4 3" stroke-width="1" vector-effect="non-scaling-stroke" opacity="${0.25 + 0.75 * (1 - weightRecord)}"/>`;
    }
    if (co.pointsAttr) {
      s += `<polyline class="tp-pv-main" points="${co.pointsAttr}" fill="none" stroke="${mainStroke}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
    }
    for (const g of co.glitchXY) {
      s += `<text class="tp-pv-x" x="${f1(g.x)}" y="${f1(g.y - 3)}" font-size="10" fill="#f43f5e" text-anchor="middle">×</text>`;
    }
    if (co.anchor) {
      if (co.anchorLink) s += `<line class="tp-pv-anchor-link" x1="${f1(co.anchorLink.x1)}" y1="${f1(co.anchorLink.y1)}" x2="${f1(co.anchorLink.x2)}" y2="${f1(co.anchorLink.y2)}" stroke="${mainStroke}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
      s += `<line x1="${PV_MARGIN.left}" x2="${f1(co.anchor.x)}" y1="${f1(co.anchor.y)}" y2="${f1(co.anchor.y)}" stroke="${mainStroke}" stroke-dasharray="2 2" stroke-width="1"/>`;
      s += `<circle cx="${f1(co.anchor.x)}" cy="${f1(co.anchor.y)}" r="3" fill="${mainStroke}" stroke="#fff" stroke-width="1"/>`;
    }
    svg.innerHTML = s;
    const n = visibleDropped.length;
    if (!enabled) {
      legend.textContent = 'Ausreisser-Filter aus — Rohhistorie';
    } else {
      legend.innerHTML = `<span class="tp-pv-chip">🧹 ${n} Glitch${n === 1 ? '' : 'es'}</span><span class="tp-pv-chip">📊 ${st.windowCount} Pkt ${st.activeCount >= minPoints ? '✓' : '✗'}</span>`;
    }
    if (st.qualifies) {
      const w = Math.round(weightRecord * 100);
      const pctText = st.badge === 0 ? '0%' : `−${st.badge}%`;
      blend.innerHTML = `<span class="badge-dif tp-deal-alltime-low">⚖️ ${pctText}</span><span class="tp-pv-formula"><i style="width:${100 - w}%"></i><b style="width:${w}%"></b></span>`;
    } else {
      blend.textContent = 'kein Tiefstpreis zum Demo-Preis – kein Badge';
    }
    const windowPart = horizonDays === 0 ? `${st.windowCount} Punkte` : `${st.windowCount} im Fenster`;
    status.textContent = `\u00d8 ${fmtPreviewMedian(st.median)} \u00b7 ${horizonText(horizonDays)} \u00b7 ${windowPart} \u00b7 ${st.activeCount} aktiv (min. ${minPoints} ${st.activeCount >= minPoints ? '\u2713' : '\u2717'})`;
  }

  // ─── MODULE: src/ui/toolbar-calc.js ─────────────────────────────────────────
  /**
   * Toolbar calc controls (split from ui/toolbar.js): weight/min-points/horizon/
   * outlier slider pairs, calc popover assembly + reset, live sync.
   * Sections re-query the live bar by ID (bar can be removed + recreated).
   */








  function pokePreviewFocus(kind) {
    const box = document.getElementById('tp-calc-preview');
    if (!box) return;
    box.dataset.focus = kind;
    clearTimeout(box._tpFocusT);
    box._tpFocusT = setTimeout(() => { if (box.dataset.focus === kind) delete box.dataset.focus; }, 600);
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
      pokePreviewFocus('weight');
      clearTimeout(deb);
      deb = setTimeout(() => {
        updateConfig('BESTPREISE_WEIGHT_RECORD', readWeight());
      }, 175);
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
      <span class="tp-stepper-label tp-glossary-term" title="Kombiniert Rekord-Tiefstpreis und Durchschnittsrabatt im gewählten Mix für Badge, Farbe und Platzierung.">Gewichtung</span>
      <span class="tp-weight-label" id="tp-bar-weight-label">⚖️ 50/50</span>
      <input type="range" id="tp-bar-weight-range" min="0" max="100" step="5" value="50" title="Gewichtung: links Ø-Schnäppchen, rechts Rekord-Jagd">`;
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
      deb = setTimeout(() => updateConfig('BESTPREISE_MIN_POINTS', readNum()), 175);
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
    wrapper.title = 'Ø-Vergleich erst ab so vielen Punkten (Punkte ≈ Tage). Darunter: Fallback-Tief.';
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
      return horizonUiToStored(raw);
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
      pokePreviewFocus('window');
      clearTimeout(deb);
      deb = setTimeout(() => {
        const v = readHorizon();
        recomputeCachedMedians(v);
        updateConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', v);
      }, 175);
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
    wrapper.title = 'Ø-Zeitraum für den Median (ändert auch die Modal-Einstellung).';
    wrapper.innerHTML = `
      <span class="tp-stepper-label">Ø-Zeitraum</span>
      <span class="tp-weight-label" id="tp-bar-horizon-label" title="${horizonText(cur, 'title')}">${horizonText(cur)}</span>
      <input type="range" id="tp-bar-horizon-range" min="30" max="760" step="30" value="${horizonStoredToUi(cur)}" title="${horizonText(cur, 'title')}">`;
    bindHorizonControls(wrapper);
    return wrapper;
  }

  function bindOutlierControls(wrapper) {
    const toggle = wrapper.querySelector('#tp-bar-outlier-toggle');
    if (!toggle) return;
    syncMiniToggle(toggle, CONFIG.OUTLIER_REJECTION_ENABLED !== false, 'Ausreisser-Filter');
    paintOutlierDim();
    toggle.onchange = () => {
      const v = toggle.checked;
      updateConfig('OUTLIER_REJECTION_ENABLED', v, { skipRender: true });
      recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      triggerProcessListings();
      syncMiniToggle(toggle, toggle.checked, 'Ausreisser-Filter');
      paintOutlierDim();
      showToast(toggle.checked ? 'Ausreisser-Filter AN — Glitches werden ignoriert' : 'Ausreisser-Filter AUS — Rohhistorie wird verwendet');
    };
  }

  function buildOutlierWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
    wrapper.id = 'tp-bar-outlier-wrapper';
    wrapper.title = 'Kurze Preissprünge (Band und Fenster unten einstellbar) als Feed-Glitches ignorieren. AUS = Rohhistorie verwenden.';
    wrapper.innerHTML = `
      <label class="tp-mini-switch" title="Ausreisser-Filter">
        <input type="checkbox" id="tp-bar-outlier-toggle" ${CONFIG.OUTLIER_REJECTION_ENABLED !== false ? 'checked' : ''}>
        <span class="tp-mini-slider"></span>
      </label>
      <span class="tp-weight-label" id="tp-bar-outlier-label">🧹 Ausreisser filtern</span>`;
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
      return isNaN(raw) ? 50 : Math.min(50, Math.max(1, raw));
    };
    const paintBandLabel = () => { if (label) label.textContent = `±${readBandPct()} %`; };
    paintBandLabel();
    let deb;
    range.oninput = () => {
      paintBandLabel();
      pokePreviewFocus('band');
      clearTimeout(deb);
      deb = setTimeout(() => {
        const pct = readBandPct();
        updateConfig('OUTLIER_DEVIATION_BAND', pct / 100, { skipRender: true });
        recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
        triggerProcessListings();
      }, 175);
    };
    range.onchange = () => {
      clearTimeout(deb);
      const pct = readBandPct();
      paintBandLabel();
      updateConfig('OUTLIER_DEVIATION_BAND', pct / 100, { skipRender: true });
      recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      triggerProcessListings();
      showToast(`Ausreisser-Band: ±${pct} % — live aktualisiert`);
    };
  }

  function buildOutlierBandWrapper() {
    const cur = typeof CONFIG.OUTLIER_DEVIATION_BAND === 'number' ? Math.round(CONFIG.OUTLIER_DEVIATION_BAND * 100) : 50;
    const wrapper = document.createElement('div');
    wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
    wrapper.id = 'tp-bar-outlier-band-wrapper';
    wrapper.title = 'Glitch-Band: Abweichung ab der gefiltert wird';
    wrapper.innerHTML = `
      <span class="tp-stepper-label">Glitch-Band</span>
      <span class="tp-weight-label" id="tp-bar-outlier-band-label">±${cur} %</span>
      <input type="range" id="tp-bar-outlier-band-range" min="1" max="50" step="1" value="${cur}" title="Abweichung vom Median, ab der ein kurzer Sprung als Glitch gilt.">`;
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
      return isNaN(raw) ? 48 : Math.min(168, Math.max(24, raw));
    };
    const paintHoursLabel = () => { if (label) label.textContent = `${readHours()} h`; };
    paintHoursLabel();
    let deb;
    range.oninput = () => {
      paintHoursLabel();
      pokePreviewFocus('band');
      clearTimeout(deb);
      deb = setTimeout(() => {
        const hrs = readHours();
        updateConfig('OUTLIER_MAX_GLITCH_HOURS', hrs, { skipRender: true });
        recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
        triggerProcessListings();
      }, 175);
    };
    range.onchange = () => {
      clearTimeout(deb);
      const hrs = readHours();
      paintHoursLabel();
      updateConfig('OUTLIER_MAX_GLITCH_HOURS', hrs, { skipRender: true });
      recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      triggerProcessListings();
      showToast(`Glitch-Fenster: ${hrs} h — live aktualisiert`);
    };
  }

  function buildOutlierHoursWrapper() {
    const cur = typeof CONFIG.OUTLIER_MAX_GLITCH_HOURS === 'number' ? CONFIG.OUTLIER_MAX_GLITCH_HOURS : 48;
    const wrapper = document.createElement('div');
    wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
    wrapper.id = 'tp-bar-outlier-hours-wrapper';
    wrapper.title = 'Glitch-Fenster: maximale Dauer eines Glitches';
    wrapper.innerHTML = `
      <span class="tp-stepper-label">Glitch-Fenster</span>
      <span class="tp-weight-label" id="tp-bar-outlier-hours-label">${cur} h</span>
      <input type="range" id="tp-bar-outlier-hours-range" min="24" max="168" step="24" value="${cur}" title="Maximale Dauer eines Preissprungs, der noch als Glitch verworfen wird.">`;
    bindOutlierHoursControls(wrapper);
    return wrapper;
  }

  function buildCalcControls(popover, resetBtn) {
    if (!popover || !resetBtn) return;
    // Deal sliders built once via builders; reset button stays last in the popover.
    popover.insertBefore(buildWeightWrapper(), resetBtn);
    popover.insertBefore(buildHorizonWrapper(), resetBtn);
    popover.insertBefore(buildMinPointsWrapper(), resetBtn);
    popover.insertBefore(buildOutlierWrapper(), resetBtn);
    popover.insertBefore(buildOutlierBandWrapper(), resetBtn);
    popover.insertBefore(buildOutlierHoursWrapper(), resetBtn);
    popover.insertBefore(buildCalcPreview(), resetBtn);
    // Preview follows slider drags live (DOM values, not debounced CONFIG).
    for (const id of ['tp-bar-weight-range', 'tp-bar-horizon-range', 'tp-bar-minpoints-range', 'tp-bar-outlier-toggle', 'tp-bar-outlier-band-range', 'tp-bar-outlier-hours-range']) {
      const el = popover.querySelector('#' + id);
      if (!el) continue;
      el.addEventListener('input', refreshCalcPreview);
      el.addEventListener('change', refreshCalcPreview);
    }
    resetBtn.onclick = () => {
      updateConfigs({ BESTPREISE_WEIGHT_RECORD: 0.50, BESTPREISE_MEDIAN_HORIZON_DAYS: 365, BESTPREISE_MIN_POINTS: 5, OUTLIER_REJECTION_ENABLED: true, OUTLIER_DEVIATION_BAND: 0.50, OUTLIER_MAX_GLITCH_HOURS: 48 }, { skipRender: true });
      recomputeCachedMedians(365);
      triggerProcessListings();
      const previewSel = document.getElementById('tp-preview-preset-select');
      if (previewSel) previewSel.value = 's26';
      refreshCalcPreview();
      showToast('Berechnungsparameter zurückgesetzt');
    };
  }

  function syncCalcControls() {
    syncMiniToggle(document.getElementById('tp-bar-outlier-toggle'), CONFIG.OUTLIER_REJECTION_ENABLED !== false, 'Ausreisser-Filter');
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
      horizonRange.value = horizonStoredToUi(curHorizon);
      const horizonLabel = document.getElementById('tp-bar-horizon-label');
      if (horizonLabel) {
        horizonLabel.textContent = horizonText(curHorizon);
        horizonLabel.title = horizonText(curHorizon, 'title');
      }
    }
    const curBand = typeof CONFIG.OUTLIER_DEVIATION_BAND === 'number' ? CONFIG.OUTLIER_DEVIATION_BAND : 0.50;
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
  }

  // ─── MODULE: src/ui/toolbar-filter.js ───────────────────────────────────────
  /**
   * Toolbar filter row (split from ui/toolbar.js): cycle buttons, negative-input/
   * stepper wiring, filter popover, row-count badges, dealer-row paint.
   */





  const CYCLE_TITLE = {
    off: 'Filter: Normal — klicken für Dimmen',
    dim: 'Filter: Dimmen — klicken für Verbergen',
    hide: 'Filter: Verbergen — klicken für Hervorheben',
    highlight: 'Filter: Hervorheben — klicken für Normal'
  };
  const CYCLE_TOASTS = {
    FILTER_NEG_MODE: { dim: '📝 Begriffe: Dimmen', hide: '📝 Begriffe: Verbergen', highlight: '📝 Begriffe: Hervorheben', off: '📝 Begriffe: Normal' },
    FILTER_MIN_MODE: { dim: '🔢 Min-Angebote: Dimmen', hide: '🔢 Min-Angebote: Verbergen', highlight: '🔢 Min-Angebote: Hervorheben', off: '🔢 Min-Angebote: Normal' },
    FILTER_PRICE_MODE: { dim: '💵 Preis: Dimmen', hide: '💵 Preis: Verbergen', highlight: '💵 Preis: Hervorheben', off: '💵 Preis: Normal' },
    FILTER_DEAL_DISCOUNT_MODE: { dim: '📉 Min-Rabatt: Dimmen', hide: '📉 Min-Rabatt: Verbergen', highlight: '📉 Min-Rabatt: Hervorheben', off: '📉 Min-Rabatt: Normal' },
    FILTER_SAVINGS_MODE: { dim: '💰 Min-Ersparnis: Dimmen', hide: '💰 Min-Ersparnis: Verbergen', highlight: '💰 Min-Ersparnis: Hervorheben', off: '💰 Min-Ersparnis: Normal' },
    HIDE_UNCHECKED_MODE: { dim: '✓ Ungeprüfte: Dimmen', hide: '✓ Ungeprüfte: Verbergen', highlight: '✓ Ungeprüfte: Hervorheben', off: '✓ Ungeprüfte: Normal — alle werden angezeigt' },
    VORTIEF_MODE: { dim: 'Fallback-Tiefs werden gedimmt', hide: 'Fallback-Tiefs ausgeschlossen (Filtergrund)', highlight: 'Fallback-Tiefs werden hervorgehoben', off: 'Fallback-Tiefs eingeschlossen' },
  };
  function paintCycleModeButton(btn, modeKey) {
    const s = cycleStateOf(modeKey);
    paintCycleButton(btn, s);
    btn.title = CYCLE_TITLE[s];
  }
  function cycleFilter(modeKey) {
    const pair = FILTER_CYCLE[modeKey];
    if (!pair) return;
    const toasts = CYCLE_TOASTS[modeKey];
    const s = cycleStateOf(modeKey);
    if (s === 'off') {
      updateConfigs({ [pair.enable]: pair.on, [modeKey]: 'dim' });
      showToast(toasts.dim);
    } else if (s === 'dim') {
      updateConfig(modeKey, 'hide');
      showToast(toasts.hide);
    } else if (s === 'hide') {
      updateConfig(modeKey, 'highlight');
      showToast(toasts.highlight);
    } else {
      updateConfig(pair.enable, !pair.on);
      showToast(toasts.off);
    }
  }

  function wireFilterPopover(bar) {
    const input = bar.querySelector('#tp-inline-negative-input');
    const clearBtn = bar.querySelector('#tp-clear-neg-btn');

    input.onkeydown = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        input.blur();
      }
    };

    let negDeb;
    input.oninput = e => {
      const val = e.target.value;
      clearTimeout(negDeb);
      negDeb = setTimeout(() => {
        updateConfigs({ NEGATIVE_TERMS: val, FILTER_NEG_ENABLED: val.trim() !== '' });
      }, 150);
    };
    clearBtn.onclick = () => {
      clearTimeout(negDeb);
      updateConfigs({ NEGATIVE_TERMS: '', FILTER_NEG_ENABLED: false });
    };

    const filterBtn = bar.querySelector('#tp-bar-filter-btn');
    const filterPopover = bar.querySelector('#tp-bar-filter-popover');
    const filtersToggle = bar.querySelector('#tp-bar-filters-toggle');
    if (filtersToggle) {
      filtersToggle.onchange = e => {
        updateConfig('FILTERS_ENABLED', e.target.checked);
      };
    }
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
        const modeKey = btn.dataset.modeKey;
        if (modeKey in FILTER_CYCLE) {
          cycleFilter(modeKey);
          return;
        }
        const cur = CONFIG[modeKey] || 'dim';
        const next = cur === 'dim' ? 'hide' : cur === 'hide' ? 'highlight' : 'dim';
        updateConfig(modeKey, next);
      };
      const resetBtn = bar.querySelector('#tp-filter-reset');
      if (resetBtn) {
        resetBtn.onclick = () => {
          updateConfigs({
            FILTER_NEG_MODE: 'dim',
            FILTER_MIN_MODE: 'dim',
            FILTER_DEAL_DISCOUNT_MODE: 'dim',
            FILTER_PRICE_MODE: 'dim',
            FILTER_SAVINGS_MODE: 'dim',
            HIDE_UNCHECKED_MODE: 'dim',
            VORTIEF_MODE: 'dim',
            DEALER_MODE: 'dim',
            FILTER_NEG_ENABLED: false,
            FILTER_MIN_ENABLED: false,
            FILTER_DEAL_DISCOUNT_ENABLED: false,
            FILTER_PRICE_ENABLED: false,
            FILTER_SAVINGS_ENABLED: false,
            BESTPREISE_HIDE_UNCHECKED: false,
            BESTPREISE_INCLUDE_VORTIEF: true,
            MIN_OFFERS: 0,
            MIN_DEAL_DISCOUNT: 0,
            FILTER_PRICE_MIN: 0,
            FILTER_PRICE_MAX: 0,
            FILTER_SAVINGS_MIN: 0,
            NEGATIVE_TERMS: '',
            FILTERS_ENABLED: true
          });
          const pMin = bar.querySelector('#tp-price-min-input');
          if (pMin) pMin.value = '';
          const pMax = bar.querySelector('#tp-price-max-input');
          if (pMax) pMax.value = '';
          const sMin = bar.querySelector('#tp-savings-min-input');
          if (sMin) sMin.value = '';
          showToast('Filter zurückgesetzt');
        };
      }
    }

    let priceDeb;
    const priceMinInput = bar.querySelector('#tp-price-min-input');
    const priceMaxInput = bar.querySelector('#tp-price-max-input');
    const onPriceChange = () => {
      clearTimeout(priceDeb);
      priceDeb = setTimeout(() => {
        const min = Math.max(0, parseFloat(priceMinInput?.value) || 0);
        const max = Math.max(0, parseFloat(priceMaxInput?.value) || 0);
        updateConfigs({
          FILTER_PRICE_MIN: min,
          FILTER_PRICE_MAX: max,
          FILTER_PRICE_ENABLED: (min > 0 || max > 0)
        });
      }, 150);
    };
    priceMinInput?.addEventListener('input', onPriceChange);
    priceMaxInput?.addEventListener('input', onPriceChange);

    let savingsDeb;
    const savingsMinInput = bar.querySelector('#tp-savings-min-input');
    const onSavingsChange = () => {
      clearTimeout(savingsDeb);
      savingsDeb = setTimeout(() => {
        const min = Math.max(0, parseFloat(savingsMinInput?.value) || 0);
        updateConfigs({
          FILTER_SAVINGS_MIN: min,
          FILTER_SAVINGS_ENABLED: min > 0
        });
      }, 150);
    };
    savingsMinInput?.addEventListener('input', onSavingsChange);

    const updateMinOffers = delta => {
      const next = Math.max(0, CONFIG.MIN_OFFERS + delta);
      if (next !== CONFIG.MIN_OFFERS) {
        updateConfigs({ MIN_OFFERS: next, FILTER_MIN_ENABLED: next > 0 });
      }
    };

    bar.querySelector('#tp-bar-min-minus').onclick = () => updateMinOffers(-1);
    bar.querySelector('#tp-bar-min-plus').onclick = () => updateMinOffers(1);

    const updateMinDiscount = delta => {
      const next = Math.max(0, Math.min(50, CONFIG.MIN_DEAL_DISCOUNT + delta));
      if (next !== CONFIG.MIN_DEAL_DISCOUNT) {
        updateConfigs({ MIN_DEAL_DISCOUNT: next, FILTER_DEAL_DISCOUNT_ENABLED: next > 0 });
      }
    };

    bar.querySelector('#tp-bar-deal-disc-minus')?.addEventListener('click', () => updateMinDiscount(-5));
    bar.querySelector('#tp-bar-deal-disc-plus')?.addEventListener('click', () => updateMinDiscount(5));
  }

  function syncFilterRow(bar, counts, flags) {
    const { isDealFeed = false, pageHasOffers = false } = flags || {};
    const negHidden = counts.neg || 0;
    const minHidden = counts.min || 0;
    const priceHidden = counts.price || 0;
    const dealDiscHidden = counts.dealDisc || 0;
    const savingsHidden = counts.savings || 0;
    const vortiefHidden = counts.vortief || 0;
    const uncheckedHiddenCount = counts.uncheckedHidden || 0;
    const dealerHidden = counts.dealer || 0;

    const input = bar.querySelector('#tp-inline-negative-input');
    const clearBtn = bar.querySelector('#tp-clear-neg-btn');
    if (input && document.activeElement !== input) {
      input.value = CONFIG.NEGATIVE_TERMS || '';
      if (clearBtn) clearBtn.style.display = CONFIG.NEGATIVE_TERMS ? 'block' : 'none';
    }

    const pMin = bar.querySelector('#tp-price-min-input');
    if (pMin && document.activeElement !== pMin) {
      pMin.value = CONFIG.FILTER_PRICE_MIN > 0 ? CONFIG.FILTER_PRICE_MIN : '';
    }
    const pMax = bar.querySelector('#tp-price-max-input');
    if (pMax && document.activeElement !== pMax) {
      pMax.value = CONFIG.FILTER_PRICE_MAX > 0 ? CONFIG.FILTER_PRICE_MAX : '';
    }
    const sMin = bar.querySelector('#tp-savings-min-input');
    if (sMin && document.activeElement !== sMin) {
      sMin.value = CONFIG.FILTER_SAVINGS_MIN > 0 ? CONFIG.FILTER_SAVINGS_MIN : '';
    }

    const filtersToggle = bar.querySelector('#tp-bar-filters-toggle');
    if (filtersToggle) {
      syncMiniToggle(filtersToggle, CONFIG.FILTERS_ENABLED !== false, 'Filter');
    }

    const isPaused = CONFIG.FILTERS_ENABLED === false;
    const hiddenTotal = isPaused ? (counts.potentialFiltered || 0) : (counts.filteredCount || 0);
    const dimmedTotal = isPaused ? (counts.potentialDimmed || 0) : (counts.dimmed || 0);
    const highlightedTotal = isPaused ? (counts.potentialHighlighted || 0) : (counts.highlighted || 0);
    const filterBtn = bar.querySelector('#tp-bar-filter-btn');
    if (filterBtn) {
      const filterCount = bar.querySelector('#tp-filter-count');
      if (filterCount) {
        setTextIfChanged(filterCount, hiddenTotal > 0 ? String(hiddenTotal) : '');
        filterCount.style.display = hiddenTotal > 0 ? 'inline-flex' : 'none';
      }
      const dimCount = bar.querySelector('#tp-filter-dim-count');
      if (dimCount) {
        setTextIfChanged(dimCount, dimmedTotal > 0 ? String(dimmedTotal) : '');
        dimCount.style.display = dimmedTotal > 0 ? 'inline-flex' : 'none';
      }
      const hlCount = bar.querySelector('#tp-filter-hl-count');
      if (hlCount) {
        setTextIfChanged(hlCount, highlightedTotal > 0 ? String(highlightedTotal) : '');
        hlCount.style.display = highlightedTotal > 0 ? 'inline-flex' : 'none';
      }
      filterBtn.classList.toggle('tp-filters-paused', isPaused);
      filterBtn.classList.toggle('tp-tool-dim', !isPaused && hiddenTotal === 0 && dimmedTotal === 0 && highlightedTotal === 0);
      const hlText = highlightedTotal > 0 ? ` + Hervorgehoben (${highlightedTotal})` : '';
      const prefix = isPaused ? 'Filter (pausiert)' : 'Filter';
      filterBtn.title = `${prefix} – Verbergen (${hiddenTotal}) + Gedimmt (${dimmedTotal})${hlText} — Neg:${negHidden} Min:${minHidden} Preis:${priceHidden} Rabatt:${dealDiscHidden} Ersparnis:${savingsHidden} Händler:${dealerHidden} Fallback:${vortiefHidden} Ungeprüft:${uncheckedHiddenCount}`;
    }
    const setRowCount = (name, n, show) => {
      const badge = bar.querySelector(`[data-row-count="${name}"]`);
      if (!badge) return;
      setTextIfChanged(badge, show ? String(n) : '');
      badge.style.display = show ? 'inline-flex' : 'none';
    };
    setRowCount('neg', negHidden, negHidden > 0);
    setRowCount('min', minHidden, minHidden > 0);
    setRowCount('price', priceHidden, priceHidden > 0);
    setRowCount('deal-disc', dealDiscHidden, dealDiscHidden > 0);
    setRowCount('savings', savingsHidden, savingsHidden > 0);
    setRowCount('unchecked', uncheckedHiddenCount, uncheckedHiddenCount > 0);
    setRowCount('vortief', vortiefHidden, vortiefHidden > 0);
    setRowCount('dealer', dealerHidden, dealerHidden > 0);
    for (const key of ['FILTER_NEG_MODE', 'FILTER_MIN_MODE', 'FILTER_PRICE_MODE', 'FILTER_DEAL_DISCOUNT_MODE', 'FILTER_SAVINGS_MODE', 'HIDE_UNCHECKED_MODE', 'VORTIEF_MODE']) {
      bar.querySelectorAll(`[data-mode-key="${key}"]`).forEach(btn => paintCycleModeButton(btn, key));
    }
    {
      const dealerActive = counts.dealerActive === true;
      const mode = CONFIG.DEALER_MODE || 'dim';
      bar.querySelectorAll('[data-mode-key="DEALER_MODE"]').forEach(btn => {
        paintCycleButton(btn, dealerActive ? mode : 'off');
        btn.title = !dealerActive
          ? 'Filter: Normal — kein Händler gewählt'
          : mode === 'dim'
            ? 'Modus: Dimmen — klicken für Verbergen'
            : mode === 'hide'
              ? 'Modus: Verbergen — klicken für Hervorheben'
              : 'Modus: Hervorheben — klicken für Dimmen';
      });
    }
    const dealerRow = bar.querySelector('[data-filter-row="dealer"]');
    if (dealerRow) {
      dealerRow.classList.toggle('tp-row-inactive', !(counts.dealerActive === true));
      const note = dealerRow.querySelector('[data-dealer-note]');
      if (note) setTextIfChanged(note, counts.dealerActive === true ? 'greift bei gewähltem Händler' : 'inaktiv – kein Händler gewählt');
      const dealerBtn = dealerRow.querySelector('[data-mode-key="DEALER_MODE"]');
      if (dealerBtn) dealerBtn.disabled = !(counts.dealerActive === true);
    }

    const minRow = bar.querySelector('[data-filter-row="min"]');
    if (minRow) {
      minRow.classList.toggle('tp-row-inactive', !pageHasOffers);
      const note = minRow.querySelector('[data-min-note]');
      const stepper = minRow.querySelector('#tp-bar-min-offers-group');
      if (note) setTextIfChanged(note, pageHasOffers ? '' : 'inaktiv – keine Angebote auf Seite');
      if (stepper) stepper.style.display = pageHasOffers ? 'inline-flex' : 'none';
      minRow.querySelectorAll('button').forEach(btn => { btn.disabled = !pageHasOffers; });
    }

    bar.querySelector('.tp-input-field-box')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_NEG_ENABLED);
    bar.querySelector('#tp-bar-min-offers-group')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_MIN_ENABLED);
    bar.querySelector('#tp-bar-price-group')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_PRICE_ENABLED);
    bar.querySelector('#tp-bar-deal-disc-group')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_DEAL_DISCOUNT_ENABLED);
    bar.querySelector('#tp-bar-savings-group')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_SAVINGS_ENABLED);

    const minVal = bar.querySelector('#tp-bar-min-val');
    if (minVal) minVal.textContent = CONFIG.MIN_OFFERS;
    const dealDiscVal = bar.querySelector('#tp-bar-deal-disc-val');
    if (dealDiscVal) dealDiscVal.textContent = `${CONFIG.MIN_DEAL_DISCOUNT}%`;
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
      updateConfig('BESTPREISE_MODE_ACTIVE', next);
      showToast(next ? '💎 Tiefstpreis-Sortierung aktiviert' : 'Tiefstpreis-Sortierung deaktiviert');
    };
  }




  function placeBar(bar, placement) {
    if (placement.reference && placement.reference.parentElement === placement.container && placement.reference !== bar) {
      placement.container.insertBefore(bar, placement.reference);
    } else {
      placement.container.appendChild(bar);
    }
  }

  function renderSuiteFilterBar(counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, vortief: 0, uncheckedHidden: 0, dealer: 0, dealerActive: false, filteredCount: 0, dimmed: 0 }, pageHasOffers = false, isDealFeed = false, isSortPage = isDealFeed) {
    const placement = getSuiteBarPlacement();
    if (!placement?.container) return;

    let bar = document.getElementById('tp-suite-filter-bar');
    const bestpreiseDeals = counts.bestpreiseDeals || 0;
    const negHidden = counts.neg || 0;
    const minHidden = counts.min || 0;
    const priceHidden = counts.price || 0;
    const dealDiscHidden = counts.dealDisc || 0;
    const savingsHidden = counts.savings || 0;
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
            <button class="tp-bar-btn" id="tp-bar-filter-btn" aria-expanded="false" aria-haspopup="true" title="Filter – Verbergen oder Dimmen je Ursache"><span class="tp-btn-label">🧹 Filter</span><span class="tp-count-badge tp-pill tp-pill-hide" id="tp-filter-count" style="display: none;"></span><span class="tp-count-badge tp-pill tp-pill-dim" id="tp-filter-dim-count" style="display: none;"></span><span class="tp-count-badge tp-pill tp-pill-hl" id="tp-filter-hl-count" style="display: none;"></span> ▾</button>
            <div class="tp-calc-popover" id="tp-bar-filter-popover" role="group" aria-label="Filter">
              <div class="tp-filter-row" data-filter-row="neg">
                <span class="tp-filter-label" title="Namen mit diesen Wörtern dimmen/verbergen (kommagetrennt, Wortgrenzen)">Begriffe</span>
                <div class="tp-input-field-box">
                  <input type="text" id="tp-inline-negative-input" aria-label="Negativ-Filter (Text)" placeholder="Wörter ausschliessen..." value="">
                  <button id="tp-clear-neg-btn" title="Text leeren" style="display: ${CONFIG.NEGATIVE_TERMS ? 'block' : 'none'};">✕</button>
                </div>
                <span class="tp-count-badge" data-row-count="neg" style="display: ${negHidden > 0 ? 'inline-flex' : 'none'};">${negHidden > 0 ? negHidden : ''}</span>
                <button class="tp-filter-mode-btn" data-mode-key="FILTER_NEG_MODE">Normal</button>
              </div>
              <div class="tp-filter-row" data-filter-row="min">
                <span class="tp-filter-label" title="Karten mit weniger als N Angeboten dimmen/verbergen">Min-Angebote</span>
                <span class="tp-filter-note" data-min-note></span>
                <div class="tp-bar-stepper-group" id="tp-bar-min-offers-group" style="display: flex;">
                  <button class="tp-stepper-btn" id="tp-bar-min-minus" title="Weniger Angebote fordern">-</button>
                  <span id="tp-bar-min-val" style="min-width: 14px; text-align: center;">${CONFIG.MIN_OFFERS}</span>
                  <button class="tp-stepper-btn" id="tp-bar-min-plus" title="Mehr Angebote fordern">+</button>
                </div>
                <span class="tp-count-badge" data-row-count="min" style="display: ${minHidden > 0 ? 'inline-flex' : 'none'};">${minHidden > 0 ? minHidden : ''}</span>
                <button class="tp-filter-mode-btn" data-mode-key="FILTER_MIN_MODE">Normal</button>
              </div>
              <div class="tp-filter-row" data-filter-row="unchecked">
                <span class="tp-filter-label tp-glossary-term" title="Angebote ohne geprüfte Preishistorie. Der Rabatt basiert nur auf UVP oder Toppreis.">Ungeprüfte</span>
                <span class="tp-count-badge" data-row-count="unchecked" style="display: ${uncheckedHiddenCount > 0 ? 'inline-flex' : 'none'};">${uncheckedHiddenCount > 0 ? uncheckedHiddenCount : ''}</span>
                <button class="tp-filter-mode-btn" data-mode-key="HIDE_UNCHECKED_MODE">Normal</button>
              </div>
              <div class="tp-filter-row" data-filter-row="vortief">
                <span class="tp-filter-label tp-glossary-term" title="Verifizierter Tiefstpreis mit zu wenigen Datenpunkten für einen Ø-Vergleich. Zeigt ersatzweise den Abstand zum Vortief.">Fallback-Tiefs</span>
                <span class="tp-count-badge" data-row-count="vortief" style="display: ${vortiefHidden > 0 ? 'inline-flex' : 'none'};">${vortiefHidden > 0 ? vortiefHidden : ''}</span>
                <button class="tp-filter-mode-btn" data-mode-key="VORTIEF_MODE">Normal</button>
              </div>
              <div class="tp-filter-row" data-filter-row="price">
                <span class="tp-filter-label tp-glossary-term" title="Preisbereich in CHF. Angebote ausserhalb des Bereichs werden gefiltert.">Preis (CHF)</span>
                <div class="tp-range-group" id="tp-bar-price-group">
                  <input type="number" id="tp-price-min-input" class="tp-range-input" placeholder="Min" min="0" step="any" value="${CONFIG.FILTER_PRICE_MIN > 0 ? CONFIG.FILTER_PRICE_MIN : ''}">
                  <span class="tp-range-sep">–</span>
                  <input type="number" id="tp-price-max-input" class="tp-range-input" placeholder="Max" min="0" step="any" value="${CONFIG.FILTER_PRICE_MAX > 0 ? CONFIG.FILTER_PRICE_MAX : ''}">
                </div>
                <span class="tp-count-badge" data-row-count="price" style="display: ${priceHidden > 0 ? 'inline-flex' : 'none'};">${priceHidden > 0 ? priceHidden : ''}</span>
                <button class="tp-filter-mode-btn" data-mode-key="FILTER_PRICE_MODE">Normal</button>
              </div>
              <div class="tp-filter-row" data-filter-row="deal-disc">
                <span class="tp-filter-label tp-glossary-term" title="Mindest-Rabatt in Prozent. Geprüfte Angebote mit weniger Rabatt oder Aufschlägen werden gefiltert; ungeprüfte bleiben sichtbar.">Min-Rabatt</span>
                <div class="tp-bar-stepper-group" id="tp-bar-deal-disc-group">
                  <button class="tp-stepper-btn" id="tp-bar-deal-disc-minus" title="Geringeren Rabatt fordern">-</button>
                  <span id="tp-bar-deal-disc-val" style="min-width: 28px; text-align: center;">${CONFIG.MIN_DEAL_DISCOUNT}%</span>
                  <button class="tp-stepper-btn" id="tp-bar-deal-disc-plus" title="Höheren Rabatt fordern">+</button>
                </div>
                <span class="tp-count-badge" data-row-count="deal-disc" style="display: none;"></span>
                <button class="tp-filter-mode-btn" data-mode-key="FILTER_DEAL_DISCOUNT_MODE">Normal</button>
              </div>
              <div class="tp-filter-row" data-filter-row="savings">
                <span class="tp-filter-label tp-glossary-term" title="Mindest-Ersparnis in CHF. Geprüfte Angebote mit weniger Ersparnis werden gefiltert; ungeprüfte bleiben sichtbar.">Min-Ersparnis</span>
                <div class="tp-range-group" id="tp-bar-savings-group">
                  <input type="number" id="tp-savings-min-input" class="tp-range-input" placeholder="Min" min="0" step="any" value="${CONFIG.FILTER_SAVINGS_MIN > 0 ? CONFIG.FILTER_SAVINGS_MIN : ''}">
                </div>
                <span class="tp-count-badge" data-row-count="savings" style="display: ${savingsHidden > 0 ? 'inline-flex' : 'none'};">${savingsHidden > 0 ? savingsHidden : ''}</span>
                <button class="tp-filter-mode-btn" data-mode-key="FILTER_SAVINGS_MODE">Normal</button>
              </div>
              <div class="tp-filter-row" data-filter-row="dealer">
                <span class="tp-filter-label" title="Karten, deren günstigstes Angebot nicht vom gewählten Händler kommt, dimmen/verbergen — nur aktiv wenn Händler gewählt">Händler</span>
                <span class="tp-filter-note" data-dealer-note>greift bei gewähltem Händler</span>
                <span class="tp-count-badge" data-row-count="dealer" style="display: ${dealerHidden > 0 ? 'inline-flex' : 'none'};">${dealerHidden > 0 ? dealerHidden : ''}</span>
                <button class="tp-filter-mode-btn tp-active" data-mode-key="DEALER_MODE">Normal</button>
              </div>
              <button class="tp-bar-btn tp-calc-reset" id="tp-filter-reset" title="Filter zurücksetzen">Zurücksetzen</button>
            </div>
          </div>
          <label class="tp-mini-switch" id="tp-bar-filters-toggle-label" title="Filter ${CONFIG.FILTERS_ENABLED !== false ? 'AN' : 'AUS'}">
            <input type="checkbox" id="tp-bar-filters-toggle" ${CONFIG.FILTERS_ENABLED !== false ? 'checked' : ''}>
            <span class="tp-mini-slider"></span>
          </label>
         </div>
         <span class="tp-divider" aria-hidden="true"></span>
        <div class="tp-group tp-group-view" role="group" aria-label="Ansicht – entfernt nichts">
          <button class="tp-bar-btn ${CONFIG.HEATMAP_ENABLED ? 'tp-active' : ''}" id="tp-bar-heat-btn" aria-pressed="${CONFIG.HEATMAP_ENABLED !== false}" title="Deal-Intensität (Heatmap): Farbe folgt dem Rabatt (bernstein bis tiefrot = Ersparnis, farblos = kein Rabatt/Aufschlag, gestreift = ungeprüft)" style="display: flex;">🔥 Heatmap</button>
         </div>
         <span class="tp-divider" aria-hidden="true"></span>
        <div class="tp-group tp-group-deals" role="group" aria-label="Sortieren">
          <button class="tp-bar-btn ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'tp-bestpreise-active' : ''}" id="tp-bar-bestpreise-btn" title="Sortiert Angebote nach echter Tiefstpreis-Qualität (Gewichtete Differenz). Entfernt keine Angebote." style="display: ${isSortPage ? 'flex' : 'none'};">
            💎 <span class="tp-glossary-term" title="Sortiert Angebote nach echter Tiefstpreis-Qualität (Gewichtete Differenz). Entfernt keine Angebote.">Tiefstpreis-Sortierung</span> <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline-flex' : 'none'};">${bestpreiseDeals > 0 ? bestpreiseDeals : ''}</span>
          </button>
          <div class="tp-calc-wrap" id="tp-bar-calc-wrap">
            <button class="tp-bar-btn" id="tp-bar-calc-btn" aria-expanded="false" aria-haspopup="true" title="Regler für Gewichtung, Zeitraum und Mindestdaten zur Berechnung der Gewichteten Differenz. Filtert nichts.">⚖️ <span id="tp-bar-calc-summary">50/50 · 1J · 5 Pkt</span> ▾</button>
            <div class="tp-calc-popover" id="tp-bar-calc-popover" role="group" aria-label="Berechnungsparameter">
              <div class="tp-calc-head"><span class="tp-glossary-term" title="Regler für Gewichtung, Zeitraum und Mindestdaten zur Berechnung der Gewichteten Differenz. Filtert nichts.">Berechnungsparameter</span><span>Formel für Deal-Score & Preishistorie</span></div>
              <button class="tp-bar-btn tp-calc-reset" id="tp-bar-calc-reset" title="Berechnungsparameter zurücksetzen">Zurücksetzen</button>
            </div>
          </div>
         </div>
        </div>
      `;
      // Calc sliders + live preview listeners + reset live in toolbar-calc.js.
      buildCalcControls(bar.querySelector('#tp-bar-calc-popover'), bar.querySelector('#tp-bar-calc-reset'));

      placeBar(bar, placement);

      wireFilterPopover(bar);

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
          for (const [popId, btnId] of [['tp-bar-calc-popover', 'tp-bar-calc-btn'], ['tp-bar-filter-popover', 'tp-bar-filter-btn'], ['tp-floating-threshold-popover', 'tp-floating-threshold-btn']]) {
            const pop = document.getElementById(popId);
            if (!pop || !pop.classList.contains('tp-show')) continue;
            pop.classList.remove('tp-show');
            const btn = document.getElementById(btnId);
            if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
          }
        });
        document.addEventListener('click', e => {
          if (!e.isTrusted) return; // Synthetic clicks (price-alarm auto-submit) must not dismiss the popover.
          for (const [popId, btnId] of [['tp-bar-calc-popover', 'tp-bar-calc-btn'], ['tp-bar-filter-popover', 'tp-bar-filter-btn'], ['tp-floating-threshold-popover', 'tp-floating-threshold-btn']]) {
            const pop = document.getElementById(popId);
            if (!pop || !pop.classList.contains('tp-show')) continue;
            const btn = document.getElementById(btnId);
            if (pop.contains(e.target) || btn?.contains(e.target)) continue;
            pop.classList.remove('tp-show');
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
          if (open) refreshCalcPreview();
        };
        // Calc reset lives in toolbar-calc.js (wired by buildCalcControls).
      }

    } else if (bar.parentElement !== placement.container || (bar.nextSibling !== placement.reference && placement.reference !== bar)) {
      placeBar(bar, placement);
    }

    bar.style.display = 'flex';
    bar.classList.toggle('tp-bestpreise-bar', CONFIG.BESTPREISE_MODE_ACTIVE === true);

    syncFilterRow(bar, counts, { isDealFeed, pageHasOffers });


    const bestpreiseBtn = document.getElementById('tp-bar-bestpreise-btn');
    if (bestpreiseBtn) {
      bestpreiseBtn.classList.toggle('tp-bestpreise-active', CONFIG.BESTPREISE_MODE_ACTIVE === true);
      bestpreiseBtn.style.setProperty('display', isSortPage ? 'flex' : 'none', 'important');
      const bpCount = bestpreiseBtn.querySelector('#tp-bar-bestpreise-count');
      if (bpCount) {
        setTextIfChanged(bpCount, bestpreiseDeals > 0 ? String(bestpreiseDeals) : '');
        bpCount.style.display = bestpreiseDeals > 0 ? 'inline-flex' : 'none';
      }
    }

    syncCalcControls();
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

    if (document.getElementById('tp-bar-calc-popover')?.classList.contains('tp-show')) refreshCalcPreview();
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
    return { mode: 'done', mainLabel: '🔍 0 Tiefstpreise prüfen', subLabel: 'Alle geprüft' };
  }

  /**
   * Pure completion toast message generator (no DOM).
   * Formats verified vs rejected counts after a batch check.
   * Unit-tested in tests/unit/floating-cta.test.js.
   */
  function batchCompletionToast({ completed = 0, total = 0, fresh = 0, checked = 0, unchecked = 0, minDisc = 30 } = {}) {
    const scanned = completed > 0 ? completed : total;
    if (scanned > 0) {
      const rejected = Math.max(0, scanned - fresh);
      if (fresh > 0) {
        if (rejected > 0) {
          return `${fresh} verifiziert · ${rejected} verworfen`;
        }
        return fresh === 1 ? '1 Tiefstpreis verifiziert' : `${fresh} Tiefstpreise verifiziert`;
      }
      return checked > 0 ? `Keine Tiefstpreise dabei · ${scanned} verworfen` : 'Keine Prüfung möglich';
    }
    return unchecked > 0 ? `Keine Deals ab ≥${minDisc}% zum Prüfen` : 'Keine ungeprüften Deals vorhanden';
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
    const minDisc = realDealMinDiscount();
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
        const fresh = new Set(Array.from(document.querySelectorAll('.tp-deal-fresh'), el => getCardProductId(el)).filter(Boolean)).size;
        const checked = (newlyVerified || []).length;
        showToast(batchCompletionToast({ completed, total, fresh, checked, unchecked, minDisc }));
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
        <button type="button" id="tp-floating-check-btn" title="Differenzen anhand der Historie prüfen (ungeprüft ≠ Tiefstpreis)">
          <span id="tp-floating-check-main">🔍 Tiefstpreise prüfen</span>
          <span id="tp-floating-check-sub">Echte Tiefstpreise verifizieren</span>
          <span id="tp-floating-check-count">🔍</span>
        </button>
        <label id="tp-floating-dealer-row" title="Günstigste Händler für Deals ab Schwelle mitladen (max. 3 parallel)">
          <input type="checkbox" id="tp-floating-dealer-toggle">
          <span>🏬 Händler laden</span>
        </label>
      </div>
      <button type="button" id="tp-floating-threshold-btn" title="Nur Differenzen ab Schwelle prüfen">≥30% ▾</button>
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
        triggerProcessListings();
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

    const minDisc = realDealMinDiscount();
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
      ? `Nur Differenzen ≥ ${minDisc}% prüfen (ungeprüft ≠ Tiefstpreis)`
      : `Nur Produkte mit Differenz ≥ ${minDisc}% prüfen`;
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
    '.tp-card-alarm-btn',
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
    // One cog per bell: the site may insert nodes between bell and cog on
    // re-render, so a next-sibling check alone stacks duplicates flanking
    // the newcomer. Scan to the next bell, keep the first cog, drop extras.
    const BELL_SEL = ALARM_BELL_SELECTORS.join(',');
    let first = null;
    let sib = bell.nextElementSibling;
    while (sib && !sib.matches?.(BELL_SEL)) {
      const nxt = sib.nextElementSibling;
      if (sib.classList?.contains('tp-alarm-cog')) {
        if (!first) first = sib;
        else sib.remove();
      }
      sib = nxt;
    }
    if (first) {
      if (first !== bell.nextElementSibling) bell.after(first);
      return first;
    }
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
        // Idempotent paint: the observer ignores [data-tp-alarm-state] owners,
        // but conditional writes keep unrelated attribute loops quiet too.
        const nextClass = `tp-alarm-${state}`;
        if (!bell.classList.contains(nextClass)) {
          bell.classList.remove('tp-alarm-off', 'tp-alarm-fill', 'tp-alarm-auto');
          bell.classList.add(nextClass);
        }
        if (bell.getAttribute('data-tp-alarm-state') !== state) bell.setAttribute('data-tp-alarm-state', state);
        const pct = Math.round(clampAlarmTarget(CONFIG.ALARM_TARGET_PERCENT) * 100);
        const dur = normalizeAlarmDuration(CONFIG.ALARM_DURATION_DAYS);
        const durLabel = DURATION_LABELS[dur] || dur;
        const nextTitle = state === 'off'
          ? 'Preisalarm AUS — ⚙ für Einstellungen'
          : state === 'fill'
            ? `Preisalarm: trägt Ziel ${pct}% / ${durLabel} ein — klicken zum Prüfen`
            : `Preisalarm AUTO: Ziel ${pct}% / ${durLabel}, sendet selbst`;
        if (bell.title !== nextTitle) bell.title = nextTitle;
        if (!bell.classList.contains('tp-card-alarm-btn')) ensureAlarmCog(bell);
      }
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] bell decor error', err);
    }
  }

  const clearAlarmTimers = modal => {
    const raw = modal.dataset.tpAlarmTimers;
    if (raw) raw.split(',').forEach(id => clearTimeout(Number(id)));
    delete modal.dataset.tpAlarmTimers;
    try { modal._tpAlarmObserver?.disconnect(); } catch {}
    modal._tpAlarmObserver = null;
  };
  let alarmAttemptSeq = 0;

  const ensureAlarmStatus = modal => {
    let el = modal.querySelector('.tp-alarm-status');
    if (!el) {
      el = document.createElement('div');
      el.className = 'tp-alarm-status';
      modal.appendChild(el);
    }
    return el;
  };

  function processPriceAlarmModal() {
    refreshAlarmBellDecor();
    if (!CONFIG.ALARM_ENABLED) return;
    const modalContainer = document.querySelector('.Plugin_NewInfoMailForm');
    if (!modalContainer) return;
    // Attempt machine: a fresh fill only from idle-like states — in-flight
    // (filled/scheduled/submitted) or confirmed attempts never refill, so a
    // replaced modal can never paint another attempt's status.
    const alarmState = modalContainer.dataset.tpAlarmState;
    if (alarmState === 'filled' || alarmState === 'scheduled' || alarmState === 'submitted' || alarmState === 'confirmed') return;
    clearAlarmTimers(modalContainer);

    const shippingFirst = modalContainer.querySelector('.shippingPrice .Plugin_Price');
    const productFirst = modalContainer.querySelector('.productPrice .Plugin_Price');
    // Basis-strict: no opposite-basis fallback — a foreign price must never be
    // filled into this product's alarm (missing controls retry next pass).
    const priceEl = isShippingPriceActive() ? shippingFirst : productFirst;
    if (!priceEl) return;

    const presentValue = parsePrice(priceEl.textContent);
    if (!(presentValue > 0)) return;
    // Full snapshot: the 300ms submit revalidates every field below — a basis
    // toggle, route change, or foreign fill mid-wait aborts silently.
    const snapshot = {
      url: location.href,
      basis: isShippingPriceActive(),
      priceText: priceEl.textContent,
      target: (presentValue * clampAlarmTarget(CONFIG.ALARM_TARGET_PERCENT)).toFixed(2),
      duration: normalizeAlarmDuration(CONFIG.ALARM_DURATION_DAYS)
    };
    const targetPrice = snapshot.target;
    const duration = snapshot.duration;
    const priceInput = modalContainer.querySelector('input#f_NewInfoMailForm_priceFrom') || modalContainer.querySelector('input[name="im_nimf_pvf"]');
    const durationHidden = modalContainer.querySelector('input[name="im_nimf_du"]');
    const durationLi = modalContainer.querySelector(`li[data-value="${duration}"]`);
    // Missing-controls: no submission, no attempt stamp — next DOM pass retries.
    if (!priceInput || (!durationHidden && !durationLi)) return;
    // Refill must not clobber a focused manual edit.
    if (document.activeElement === priceInput && priceInput.value !== snapshot.target) return;
    priceInput.value = targetPrice;
    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    priceInput.dispatchEvent(new Event('change', { bubbles: true }));
    if (durationHidden) {
      durationHidden.value = duration;
      durationHidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
    durationLi?.click();
    // Read-back revalidation: partial fills retry on the next observer pass.
    if (priceInput.value !== targetPrice || (durationHidden && durationHidden.value !== duration)) return;
    modalContainer.dataset.tpAlarmProcessed = 'true';
    modalContainer.dataset.tpAlarmState = 'filled';
    modalContainer.dataset.tpAlarmAttempt = String(++alarmAttemptSeq);

    if (CONFIG.ALARM_AUTO_SUBMIT === true) {
      const reqModal = modalContainer;
      const reqSnap = snapshot;
      const reqAttempt = modalContainer.dataset.tpAlarmAttempt;
      const unconfirmedMsg = '⚠️ Übermittlung nicht bestätigt — bitte prüfen';
      let fallbackTimer = 0;
      let observer = null;
      // Any validation failure cancels this attempt: timers die, no submit,
      // no status paint — a newer attempt (if any) is untouched.
      const cancelAttempt = () => {
        clearTimeout(fallbackTimer);
        try { observer?.disconnect(); } catch {}
        reqModal._tpAlarmObserver = null;
        if (reqModal.dataset.tpAlarmAttempt === reqAttempt) reqModal.dataset.tpAlarmState = 'cancelled';
      };
      const flagUnconfirmed = () => {
        // Attempt-scoped paint: a replaced modal never gets another
        // attempt's status — no document-wide query.
        if (!reqModal.isConnected || reqModal.dataset.tpAlarmAttempt !== reqAttempt) return;
        reqModal.dataset.tpAlarmState = 'unconfirmed';
        const el = ensureAlarmStatus(reqModal);
        // Guarded write: the observer watches this subtree, so an unguarded
        // textContent assignment would re-trigger it into a microtask loop.
        if (el.textContent !== unconfirmedMsg) el.textContent = unconfirmedMsg;
      };
      try {
        const dialogRoot = modalContainer.closest('.AbstractDialog') || document.querySelector('#tmpAbstractDialogContainer') || document.body;
        // Observe BEFORE submit: close only on a success signal — button/form
        // detachment alone never closes.
        observer = new MutationObserver(() => {
          if (reqModal.querySelector('.success,.confirmation,[class*="success" i],[class*="confirm" i]')) {
            try { observer.disconnect(); } catch {}
            clearTimeout(fallbackTimer);
            reqModal._tpAlarmObserver = null;
            if (reqModal.dataset.tpAlarmAttempt === reqAttempt) reqModal.dataset.tpAlarmState = 'confirmed';
            const closeBtn = reqModal.closest('.AbstractDialog')?.querySelector('.AbstractDialog_CloseButton') ||
                             document.querySelector('#tmpAbstractDialogContainer .AbstractDialog_CloseButton');
            if (closeBtn) closeBtn.click();
            else if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Preisalarm: kein Close-Button gefunden');
          } else if (!document.querySelector('.Plugin_NewInfoMailForm')) {
            try { observer.disconnect(); } catch {}
            clearTimeout(fallbackTimer);
            reqModal._tpAlarmObserver = null;
            if (reqModal.dataset.tpAlarmAttempt === reqAttempt) reqModal.dataset.tpAlarmState = 'cancelled';
          }
        });
        observer.observe(dialogRoot, { childList: true, subtree: true });
        reqModal._tpAlarmObserver = observer;
        fallbackTimer = setTimeout(() => {
          try { observer.disconnect(); } catch {}
          reqModal._tpAlarmObserver = null;
          flagUnconfirmed();
        }, CONFIG.ALARM_FALLBACK_TIMEOUT_MS || 5000);
        const submitTimer = setTimeout(() => {
          // Pre-submit revalidation: basis/route/config/price may have changed mid-wait.
          if (reqModal.dataset.tpAlarmAttempt !== reqAttempt) return cancelAttempt();
          if (!reqModal.isConnected || !CONFIG.ALARM_ENABLED || CONFIG.ALARM_AUTO_SUBMIT !== true) return cancelAttempt();
          if (location.href !== reqSnap.url || isShippingPriceActive() !== reqSnap.basis) return cancelAttempt();
          if (!priceEl.isConnected || priceEl.textContent !== reqSnap.priceText) return cancelAttempt();
          if (priceInput.value !== reqSnap.target) return cancelAttempt();
          const durHidden = reqModal.querySelector('input[name="im_nimf_du"]');
          if (durHidden && durHidden.value !== reqSnap.duration) return cancelAttempt();
          const submitBtn = reqModal.querySelector('input.f_submitbtn');
          if (!submitBtn) return cancelAttempt();
          const termsCheckbox = reqModal.querySelector('input#im_nimf_prtrm');
          if (termsCheckbox) {
            termsCheckbox.checked = true;
            termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
          }
          submitBtn.click();
          if (reqModal.dataset.tpAlarmAttempt === reqAttempt) reqModal.dataset.tpAlarmState = 'submitted';
        }, 300);
        modalContainer.dataset.tpAlarmTimers = `${submitTimer},${fallbackTimer}`;
        modalContainer.dataset.tpAlarmState = 'scheduled';
      } catch (err) {
        if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Preisalarm submit error', err);
      }
    }
  }

  /**
   * Triggers or fetches the native Preisalarm dialog for a given product ID.
   * If a native dialog trigger is in the card or document, it clicks it.
   * Otherwise, fetches the form from Toppreise backend and opens via AbstractDialog_show.
   */
  async function openPriceAlarmForProduct(pid, card = null) {
    if (!pid) return;
    // 1. Check if card or nearby DOM already has a native bell anchor
    const localBell = card?.querySelector?.('.Plugin_NewInfoMailButton a.f_showNewInfoMailFormDialog, a[href*="NewInfoMail"]');
    if (localBell) {
      localBell.click();
      return;
    }

    // 2. If test mock dialog exists, display it directly
    const mockDialog = document.querySelector('#mock-alarm-dialog');
    if (mockDialog) {
      mockDialog.style.display = 'block';
      delete mockDialog.querySelector?.('.Plugin_NewInfoMailForm')?.dataset?.tpAlarmProcessed;
      delete mockDialog.querySelector?.('.Plugin_NewInfoMailForm')?.dataset?.tpAlarmState;
      processPriceAlarmModal();
      return;
    }

    // 3. Native host interaction: check if Toppreise global helper exists
    if (typeof window !== 'undefined' && typeof window.openInfoMailForm === 'function') {
      // If there is any trigger button element created or available
      const tempTrigger = document.createElement('a');
      tempTrigger.className = 'f_showNewInfoMailFormDialog';
      tempTrigger.setAttribute('data-ajax-form-url', `/plugins/infomails/NewInfoMailForm?im_nimf_pid=${pid}&im_nimf_cks=`);
      const wrap = document.createElement('div');
      wrap.className = 'Plugin_NewInfoMailButton';
      wrap.appendChild(tempTrigger);
      document.body.appendChild(wrap);
      try {
        window.openInfoMailForm(tempTrigger, false);
        return;
      } catch {
        wrap.remove();
      }
    }

    // 4. Fallback: Fetch NewInfoMailButton or NewInfoMailForm HTML and materialize
    try {
      const postBody = new URLSearchParams({
        im_nimb_ch: '1',
        im_nimb_pid: String(pid),
        im_nimb_tmpl: 'btn',
        lang: 'de'
      });
      const res = await fetch('/plugins/infomails/NewInfoMailButton', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: postBody
      });
      if (res.ok) {
        const html = await res.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const tpl = tempDiv.querySelector('template.f_lazyDialog');
        const dialogNode = tpl ? (tpl.content ? tpl.content.firstElementChild : tpl.firstElementChild) : tempDiv.querySelector('.AbstractDialog_NewInfoMailFormDialog');
        const dialogId = dialogNode?.id;
        const dialogHash = dialogNode?.getAttribute('data-instance-hash') || '1';
        const formUrl = tempDiv.querySelector('a')?.getAttribute('data-ajax-form-url');

        if (dialogNode) {
          document.body.appendChild(dialogNode);
          if (formUrl) {
            const formRes = await fetch(`${formUrl}&im_nimf_ch=${dialogHash}&lang=de`, {
              headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (formRes.ok) {
              const formHtml = await formRes.text();
              const content = dialogNode.querySelector('.AbstractDialog_Content');
              if (content) content.innerHTML = formHtml;
            }
          }
          if (typeof window !== 'undefined' && typeof window.AbstractDialog_show === 'function') {
            window.AbstractDialog_show(dialogId);
          } else {
            dialogNode.style.display = 'block';
            dialogNode.classList.add('show');
          }
          processPriceAlarmModal();
          return;
        }
      }
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Failed to open price alarm modal', err);
    }

    // 5. Ultimate fallback if AJAX fails: direct URL navigation in new tab
    if (typeof window !== 'undefined') {
      window.open(`/neue-infomail?im_nimf_pid=${pid}`, '_blank', 'noopener');
    }
  }

  setAlarmConfigListener(() => {
    // A settings change invalidates pending auto-submits: cancel timers so a
    // stale snapshot can never submit under new settings. Both flags go so
    // the next pass refills under the new settings (never over a focused edit).
    const live = typeof document !== 'undefined' ? document.querySelector('.Plugin_NewInfoMailForm') : null;
    if (live) {
      clearAlarmTimers(live);
      delete live.dataset.tpAlarmState;
      delete live.dataset.tpAlarmProcessed;
    }
    refreshAlarmBellDecor();
  });

  // ─── MODULE: src/features/product-detail.js ─────────────────────────────────
  /**
   * Product Detail Page Feature
   * Injects Tiefstpreis status badge and peak context
   * into the main product detail heading.
   */






  // Stale-request guard: overlapping observer triggers race the fetch — only
  // the latest run may paint. A generation token (not pid comparison alone)
  // also covers same-product reprices and basis toggles mid-flight.
  let detailRun = 0;
  const removeDetailBadge = () => document.getElementById('tp-detail-deal-badge')?.remove();
  async function processProductDetailPage() {
    const run = ++detailRun;
    const pid = getDetailProductId();
    if (!pid) { removeDetailBadge(); return; }

    // Ordered single queries (see getDetailLowestPrice): grouped selectors match
    // in document order, so the bare h1 fallback must never outrank its scopes.
    const headingSelectors = ['.Plugin_ProductHeading h1', '.productHeading h1', '.product_title h1', 'h1.productTitle', 'h1'];
    let headingEl = null;
    for (const sel of headingSelectors) {
      headingEl = document.querySelector(sel);
      if (headingEl) break;
    }
    if (!headingEl) { removeDetailBadge(); return; }

    const { price: currentPrice, basis: priceBasis } = getDetailLowestPrice();
    if (!(currentPrice > 0)) { removeDetailBadge(); return; }

    let badge = document.getElementById('tp-detail-deal-badge');
    let stats = getCardStats(pid, priceBasis);
    if (!stats) {
      await fetchSingleProductPriceStats(pid, 1, false, null, currentPrice, null, priceBasis);
      // Stale: a newer run started, the route changed, or the heading died.
      if (run !== detailRun || pid !== getDetailProductId() || !headingEl.isConnected) {
        if (pid !== getDetailProductId()) removeDetailBadge();
        return;
      }
      // Reprice/basis-toggle mid-flight: never paint a verdict for dead inputs.
      const fresh = getDetailLowestPrice();
      if (fresh.price !== currentPrice || fresh.basis !== priceBasis) return;
      stats = getCardStats(pid, priceBasis);
    }
    if (stats && stats.tiefstpreis > 0) {
      // Basis gate (same rule as extractCardData): a live price on the other
      // basis than the cached history renders no badge. A refetch cannot fix
      // a missing DOM basis, so drop the badge instead of re-requesting.
      if (typeof stats.isShippingPrice === 'boolean' && stats.isShippingPrice !== (priceBasis === 'shipping')) {
        document.getElementById('tp-detail-deal-badge')?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'tp-detail-deal-badge';
        headingEl.appendChild(badge);
      }
      const displayKind = getDisplayDelta(currentPrice, stats).kind;
      const isAllTimeLow = (displayKind === 'new-low' || displayKind === 'at-low');
      const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;
      if (isAllTimeLow) {
        const nextClass = 'tp-detail-deal-badge tp-is-alltime-low';
        if (badge.className !== nextClass) badge.className = nextClass;
        let peakContext = '';
        if (hasSignificantPeak) {
          const peakDropPct = pctDrop(stats.hoechstpreis, currentPrice);
          peakContext = ` (-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)})`;
        }
        const nextTitle = `Aktueller Preis (CHF ${currentPrice.toFixed(2)}) ist der Allzeit-Tiefstpreis!${peakContext}`;
        if (badge.title !== nextTitle) badge.title = nextTitle;
        if (badge.textContent !== '🌟 Allzeit-Tiefstpreis') badge.textContent = '🌟 Allzeit-Tiefstpreis';
      } else {
        const markupPct = pctRise(stats.tiefstpreis, currentPrice);
        const isSevere = markupPct >= 50;
        const nextClass = `tp-detail-deal-badge tp-is-not-low ${isSevere ? 'tp-is-severe-markup' : ''}`;
        if (badge.className !== nextClass) badge.className = nextClass;
        const peakContext = hasSignificantPeak ? ` | Höchstpreis: CHF ${stats.hoechstpreis.toFixed(2)}` : '';
        const nextTitle = `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)${peakContext}`;
        if (badge.title !== nextTitle) badge.title = nextTitle;
        const nextText = `⚠️ Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}%)`;
        if (badge.textContent !== nextText) badge.textContent = nextText;
      }
    } else {
      document.getElementById('tp-detail-deal-badge')?.remove();
      return;
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
      if (cards.length === 0) { try { applySorting([], false, []); } catch {} dismissChrome(); return; }

      // --- Extract ---
      const activeStores = extractActiveStores();
      const termsList = parseNegativeTerms();
      const isNeueFeed = isNeueToppreisePage();
      const isSortPage = isNeueFeed || isSearchPage();
      const minDealDiscount = realDealMinDiscount();
      const cardDataList = cards.map(extractCardData);

      // --- Filter ---
      const counts = { neg: 0, min: 0, dealDisc: 0, price: 0, savings: 0, uncheckedDeals: 0, unavailableDeals: 0, bestpreiseDeals: 0, vortief: 0, uncheckedHidden: 0, dealer: 0, dealerActive: activeStores.length > 0, filteredCount: 0, dimmed: 0 };
      const pageHasOffers = cardDataList.some(cd => cd.offerCount > 0);

      for (const cd of cardDataList) {
        cd.filters = applyCardFilters(cd, termsList, CONFIG.MIN_OFFERS, pageHasOffers, isNeueFeed);
        // Dealer verdict before counting: scanner and counter must agree.
        cd.filters.isDealerLoser = dealerLoserFor(cd.card, activeStores);
        // Scan bucket from the shared resolver: fresh unavailable markers
        // wait out the negative TTL (counted aside, CTA ignores them).
        const elig = scanCandidateState(cd, { isFeed: isNeueFeed, minDiscount: minDealDiscount });
        if (elig?.canScan) counts.uncheckedDeals++;
        else if (elig?.state === 'unavailable') counts.unavailableDeals++;
        // Verified markups are removed nowhere, so counted nowhere.
        // (No recompute here: extractCardData already scored with identical inputs.)
        if (cd.dealScore) counts.bestpreiseDeals++;
        else if ((cd.displayDelta?.kind === 'at-low' || cd.displayDelta?.kind === 'new-low') && CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false) counts.bestpreiseDeals++;
      }

      // --- Render ---
      for (const cd of cardDataList) {
        renderCardEffects(cd, cd.filters, isNeueFeed, activeStores);
        if (cd.filters.isDimmed) counts.dimmed++;
        if (cd.filters.isHighlighted) counts.highlighted = (counts.highlighted || 0) + 1;
        if (cd.filters.isFiltered) counts.filteredCount++;
        if (cd.filters.wouldHide) counts.potentialFiltered = (counts.potentialFiltered || 0) + 1;
        if (cd.filters.wouldDim) counts.potentialDimmed = (counts.potentialDimmed || 0) + 1;
        if (cd.filters.wouldHighlight) counts.potentialHighlighted = (counts.potentialHighlighted || 0) + 1;
        if (cd.filters.isNeg) counts.neg++;
        if (cd.filters.isLowOffers) counts.min++;
        if (cd.filters.isBelowMinDiscount) counts.dealDisc++;
        if (cd.filters.isOutOfPriceRange) counts.price++;
        if (cd.filters.isBelowMinSavings) counts.savings++;
        if (cd.filters.isUnchecked) counts.uncheckedHidden++;
        if (cd.filters.isVortiefExcluded) counts.vortief++;
        if (cd.filters.isDealerLoser) counts.dealer++;
      }

      // --- Sort (deferred mid-scan: final passes sort once with flag cleared) ---
      if (!scanState.isBatchChecking) applySorting(cards, pageHasOffers, cardDataList);

      // --- Empty state, filter bar & floating verify CTA ---
      renderEmptyState(cards, counts);
      renderSuiteFilterBar(counts, pageHasOffers, isNeueFeed, isSortPage);
      renderFloatingCTA(counts, isNeueFeed);
      if (isNeueFeed) enhanceCategorySidebar();
      const mig = migrateFilterSplit();
      if (mig.hadMode || mig.modeWasActive) showToast(mig.modeWasActive ? '💎 sortiert jetzt nur noch — Filtern entfernt, Ansicht dimmt (👁️ zeigt sie)' : 'Neu: Filtern entfernt Karten, Ansicht dimmt nur (👁️ zeigt sie)');
    } finally {
      isModifyingDOM = false;
      if (mainObserver) {
        mainObserver.takeRecords();
        mainObserver.observe(document.documentElement, OBSERVE_OPTS);
      }
    }
  }

  // ─── OBSERVER & INITIALIZATION ───────────────────────────────────────────────
  let debounceTimer = null;
  const OBSERVE_OPTS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'href', 'data-entity-id', 'data-tp-product-id', 'data-current_url', 'data-current-url'] };
  const TP_OWNED_SEL = '#tp-root,#tp-suite-filter-bar,#tp-floating-check-cta,#tp-sparkline-popout,#tp-empty-state-notice,.tp-injected-badge,.tp-best-price-badge,.tp-card-subline-row,.tp-sparkline-container,.tp-card-historical-price,.tp-share-btn,.tp-dealer-name,.tp-review-search-btn,#tp-detail-deal-badge,.tp-alarm-cog,.tp-alarm-status,[data-tp-alarm-state]';
  const TP_CARD_SEL = '.Plugin_Product,.mixedBrowsingListProduct';
  const isOwnedNode = n => n?.nodeType === 1 && !!n.closest?.(TP_OWNED_SEL);
  const cardOf = n => {
    if (n?.nodeType !== 1) return null;
    if (typeof n.matches === 'function' && n.matches(TP_CARD_SEL)) return n;
    return n.closest?.(TP_CARD_SEL) ?? null;
  };
  mainObserver = new MutationObserver(mutations => {
    if (isModifyingDOM) return;

    let dirtyCard = false;
    let structural = false;
    // Outside cards the interesting changes are text/attribute swaps (detail
    // price, alarm controls, active filters, route attrs) — records without
    // added/removed nodes. OBSERVE_OPTS.attributeFilter stays tight on purpose.
    const NON_CARD_SEL = '.Plugin_ProductHeading, .productHeading, .product_title, h1, .priceContainer, .Plugin_Price, .Plugin_NewInfoMailForm, .AbstractDialog, .Plugin_NewInfoMailButton, .filters, .f_remove_filter, [data-tp-product-id]';
    const checkNode = node => {
      if (!node) return false;
      if (node.nodeType === 3) node = node.parentElement;
      if (!node || node.nodeType !== 1) return false;
      if (isOwnedNode(node)) return false;
      if (node.id === 'tp-root' || node.id === 'tp-suite-filter-bar' || node.id === 'tp-empty-state-notice' || node.id === 'tp-floating-check-cta') return false;
      if (node.classList?.contains('tp-card-subline-row') ||
          node.classList?.contains('tp-sparkline-container') ||
          node.classList?.contains('tp-best-price-badge') ||
          node.classList?.contains('tp-empty-state-notice')) {
        return false;
      }
      return node.matches?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading, .Plugin_Price, .priceContainer, .Plugin_NewInfoMailButton, .filters, .f_remove_filter') ||
             !!node.querySelector?.('.Plugin_Product, .mixedBrowsingListProduct, .Plugin_TopPriceReductionProductListFull, .standardList, .f_browsingListContainer, #Plugin_MixedBrowsingList, #product-list, .Plugin_NewInfoMailForm, .AbstractDialog, .Page_DetailProduct, .Plugin_ProductHeading, .Plugin_Price, .priceContainer, .Plugin_NewInfoMailButton, .filters, .f_remove_filter');
    };

    for (const m of mutations) {
      // Route-attribute swap on body matches no card selector: handle
      // explicitly so SPA navigation always schedules a pass.
      if (m.type === 'attributes' && (m.attributeName === 'data-current_url' || m.attributeName === 'data-current-url')) structural = true;
      const target = m.target;
      if (!target) continue;
      const targetEl = target.nodeType === 1 ? target : target.parentElement;
      // In-card host mutation (price text/attribute swap, node replacement):
      // invalidate the card memo so re-render rebuilds instead of repainting stale data.
      const hit = cardOf(targetEl);
      if (hit) {
        if ((m.type === 'attributes' || m.type === 'characterData') && isOwnedNode(targetEl)) continue;
        // All-changes-owned skips only pure self-paint: a mixed record (own
        // badge plus a genuine host replacement) still invalidates, or the
        // host update is lost with the badge.
        const changes = [...m.addedNodes, ...m.removedNodes].filter(n => n?.nodeType === 1);
        if (changes.length > 0 && changes.every(isOwnedNode)) continue;
        clearCardCache(hit);
        dirtyCard = true;
        continue;
      }

      for (let i = 0; i < m.addedNodes.length; i++) {
        if (checkNode(m.addedNodes[i])) { structural = true; break; }
      }
      if (!structural) for (let i = 0; i < m.removedNodes.length; i++) {
        if (checkNode(m.removedNodes[i])) { structural = true; break; }
      }
      // Attribute/characterData records carry no added/removed nodes: match
      // the target itself so detail-price text swaps, alarm controls,
      // active-filter changes and route-attribute swaps schedule a pass.
      // childList targets cover textContent writes and price-element
      // replacement where the container itself is the mutation target.
      if (!structural && targetEl && (m.type === 'childList' || m.type === 'characterData' || m.type === 'attributes')) {
        if (!isOwnedNode(targetEl) && (targetEl.matches?.(NON_CARD_SEL) || targetEl.closest?.(NON_CARD_SEL))) structural = true;
      }
      if (dirtyCard && structural) break;
    }

    if (!dirtyCard && !structural) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      triggerProcessListings();
    }, CONFIG.OBSERVER_DEBOUNCE_MS);
  });

  mainObserver.observe(document.documentElement, OBSERVE_OPTS);

  // Host price-basis toggle (product vs shipping): attribute-only observer on
  // body, separate from the main subtree observer. Rare event, no debounce.
  let lastPriceBasis = document.body?.classList.contains('showproductprice') ? 'p'
    : document.body?.classList.contains('showshippingprice') ? 's' : 'x';
  new MutationObserver(() => {
    const cur = document.body?.classList.contains('showproductprice') ? 'p'
      : document.body?.classList.contains('showshippingprice') ? 's' : 'x';
    if (cur === lastPriceBasis) return;
    lastPriceBasis = cur;
    cancelBatchDealCheck();
    getProductCards().forEach(clearCardCache);
    triggerProcessListings();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('keydown', e => {
    // Skip if modifier keys other than none
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Escape always leaves the negative-input first, even while typing.
    if (e.key === 'Escape') {
      const negInput = document.getElementById('tp-inline-negative-input');
      if (negInput && document.activeElement === negInput) negInput.blur();
      return;
    }
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
    }
  });

  function handleRouteTransition() {
    cancelBatchDealCheck();
    clearDealerAutoTried();
    triggerProcessListings();
  }
  if (self.navigation?.addEventListener) {
    self.navigation.addEventListener('navigatesuccess', handleRouteTransition);
  }
  window.addEventListener('popstate', handleRouteTransition);
  window.addEventListener('hashchange', handleRouteTransition);

  setupUI();
  triggerProcessListings();

  if (typeof window !== 'undefined') {
    const suiteVersion = (typeof GM_info !== 'undefined' && GM_info?.script?.version) || '2.18.416';
    const isDebugHost = CONFIG.DEBUG === true || (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname || ''));
    if (isDebugHost) {
      window.ToppreiseSuite = {
        processListings,
        processPriceAlarmModal,
        processProductDetailPage,
        updateConfig,
        openSettingsAt,
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
        // Live view on CONFIG (test harness mutates flags through it), with the
        // secrets masked: page JS reads '' and cannot overwrite secrets.
        CONFIG: new Proxy(CONFIG, {
          get: (t, k) => (SECRET_KEYS.has(k) ? '' : Reflect.get(t, k)),
          set: (t, k, v) => (SECRET_KEYS.has(k) ? true : Reflect.set(t, k, v)),
          getOwnPropertyDescriptor: (t, k) => { const d = Reflect.getOwnPropertyDescriptor(t, k); return (d && SECRET_KEYS.has(k)) ? { ...d, value: '' } : d; },
          defineProperty: (t, k, desc) => (SECRET_KEYS.has(k) ? true : Reflect.defineProperty(t, k, desc)),
          deleteProperty: (t, k) => (SECRET_KEYS.has(k) ? true : Reflect.deleteProperty(t, k)),
        }),
        memoryCache,
        statsKey,
        showToast,
        lastToast: getLastToastMessage
      };
    } else {
      // Production: frozen minimal handle. processListings stays — async
      // re-renders fall through to window.ToppreiseSuite.processListings.
      window.ToppreiseSuite = Object.freeze({
        version: suiteVersion,
        processListings,
        snapshot: () => ({
          checkedCount: scanState.progress.completed,
          queueLength: Math.max(0, scanState.progress.total - scanState.progress.completed),
          shippingActive: (() => { try { return isShippingPriceActive(); } catch { return false; } })()
        })
      });
    }
  }
})();
