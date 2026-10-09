/**
 * CSS Stylesheets for Toppreise.ch Suite
 * Contains main document styles (heatmap, badges, pills, filter bar, toasts)
 * and isolated Shadow DOM modal dialog styles.
 */

export const STYLES = `
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
  /* Vortief edge heat (mode, verified low without blend): no fill — the card
  keeps the site background. Same ramp hue as blended heat, but the signal is
  an inset inner glow + tinted border, so the fallback never reads as a
  blended deal. Inset never leaves the card's own edges. Border color + glow
  arrive inline; this sets the edge. */
  .tp-heat-vortief {
    border-width: 2px !important;
    border-style: solid !important;
    transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
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
  /* Heat fill is dark by construction (near-opaque base stops, all L < 0.05):
  light text carries suite microcopy + titles + the site price on filled cards.
  Edge/vortief keeps the site background and never gets .tp-heatmap-active, so
  light fills (peach site cards) stay untouched by construction - no luminance
  JS needed. The "ab" prefix is a bare text node in .priceContainer, covered by
  inheritance; the dealer <button> needs element-qualified specificity to beat
  its own opacity rule. */
  .tp-heatmap-active .tp-dealer-name,
  .tp-heatmap-active .tp-card-historical-price,
  .tp-heatmap-active .tp-card-historical-price.tp-is-record-low,
  .tp-heatmap-active .tp-card-historical-price.tp-is-at-low,
  .tp-heatmap-active .tp-card-historical-price.tp-is-markup,
  .tp-heatmap-active .product-name,
  .tp-heatmap-active .productDetails,
  .tp-heatmap-active .priceContainer,
  .tp-heatmap-active .priceContainer a,
  .tp-heatmap-active .priceContainer .currency,
  .tp-heatmap-active .Plugin_Price,
  .tp-heatmap-active .productPrice,
  .tp-heatmap-active .shippingPrice,
  .tp-heatmap-active .shippingText {
    color: #f1f5f9 !important;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6) !important;
  }
  .tp-heatmap-active .tp-dealer-name,
  .tp-heatmap-active button.tp-dealer-name.tp-dealer-btn {
    opacity: 1 !important;
  }
  /* Sparkline blue-500 dies on brown fill: light-blue stroke+dot on heated cards. */
  .tp-heatmap-active .tp-sparkline polyline {
    stroke: #93c5fd !important;
  }
  .tp-heatmap-active .tp-sparkline circle {
    fill: #93c5fd !important;
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
  body.tp-mode-hide .tp-filtered,
  body.tp-mode-hide [class*="col-"]:has(> .tp-filtered) {
    display: none !important;
  }
  body.tp-mode-dim .tp-filtered,
  body.tp-mode-dim [class*="col-"]:has(> .tp-filtered) {
    opacity: var(--tp-dim-opacity, 0.25) !important;
    filter: grayscale(40%) !important;
    transition: opacity 0.3s ease, filter 0.3s ease !important;
  }
  body.tp-mode-dim .tp-filtered:hover,
  body.tp-mode-dim [class*="col-"]:has(> .tp-filtered):hover {
    opacity: 0.6 !important;
    filter: grayscale(10%) !important;
  }
  body.tp-reveal-all .tp-filtered,
  body.tp-reveal-all [class*="col-"]:has(> .tp-filtered) {
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
    opacity: 0.75 !important;
    flex: 0 0 auto !important;
  }
  button.tp-dealer-name.tp-dealer-btn:hover {
    opacity: 1 !important;
  }
  button.tp-dealer-name.tp-dealer-btn:disabled {
    cursor: wait !important;
    opacity: 0.4 !important;
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
  .tp-bar-btn.tp-batch-active {
    background: rgba(245, 158, 11, 0.25) !important;
    border-color: rgba(245, 158, 11, 0.5) !important;
    color: #fbbf24 !important;
  }
  .tp-bar-btn.tp-bestpreise-active {
    /* Opak statt transluzent: der Button hängt auf Feeds in der weißen
    #timeframe-filter-Zeile (toolbar.js ensureDealControlsPlacement), nicht nur in der dunklen Bar. */
    background: linear-gradient(135deg, #8b5cf6, #f59e0b) !important;
    border-color: #8b5cf6 !important;
    color: #fff !important;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.3) !important;
  }
  #tp-bar-bestpreise-count {
    opacity: 1 !important;
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

export const SHADOW_MODAL_STYLES = `
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

