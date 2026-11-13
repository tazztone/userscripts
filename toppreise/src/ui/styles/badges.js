/** Badges part (split from ui/styles/cards.js): deal badge/pill, loupe, historical price, dealer, alarm. */

export const STYLES_BADGES = `
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
  :is(.Plugin_Product, .mixedBrowsingListProduct):has(> .tp-share-btn) {
    position: relative !important;
  }
  .tp-share-btn {
    position: absolute !important;
    bottom: 5px !important;
    left: 5px !important;
    z-index: 5 !important;
    width: 28px !important;
    height: 28px !important;
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
  .tp-share-btn.tp-share-loading {
    opacity: 0.85 !important;
    pointer-events: auto !important;
    cursor: wait !important;
    animation: tp-share-pulse 1.2s infinite ease-in-out !important;
  }
  @keyframes tp-share-pulse {
    0%, 100% { opacity: 0.85; transform: scale(1); }
    50% { opacity: 0.45; transform: scale(0.92); }
  }
  .tp-share-btn.tp-share-done {
    opacity: 1 !important;
    pointer-events: auto !important;
    box-shadow: 0 0 10px var(--tp-acc) !important;
  }
  .tp-review-search-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 2px 4px !important;
    vertical-align: middle !important;
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
    display: flex !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 3px !important;
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
  .tp-card-historical-price .tp-subline-pill {
    display: inline-flex !important;
    align-items: center !important;
    padding: 1px 4px !important;
    border-radius: 3px !important;
    white-space: nowrap !important;
    background: rgba(148, 163, 184, 0.12) !important;
    border: 1px solid rgba(148, 163, 184, 0.25) !important;
    color: inherit !important;
    box-sizing: border-box !important;
  }
  .tp-card-historical-price.tp-is-record-low .tp-subline-pill {
    background: rgba(16, 185, 129, 0.12) !important;
    border-color: rgba(16, 185, 129, 0.35) !important;
  }
  .tp-card-historical-price.tp-is-at-low .tp-subline-pill {
    background: rgba(4, 120, 87, 0.1) !important;
    border-color: rgba(4, 120, 87, 0.25) !important;
  }
  .tp-card-historical-price.tp-is-markup .tp-subline-pill {
    background: rgba(245, 158, 11, 0.12) !important;
    border-color: rgba(245, 158, 11, 0.35) !important;
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
  /* Händlerzeile auf eigener Zeile über dem Preis (rechtsbündig). */
  .tp-card-dealer-row {
    display: flex !important;
    justify-content: flex-end !important;
    align-items: center !important;
    width: 100% !important;
    margin-bottom: 2px !important;
    line-height: 1.2 !important;
  }
  .tp-card-dealer-row > .tp-dealer-name {
    display: inline-flex !important;
    justify-content: flex-end !important;
    max-width: none !important;
    margin-right: 0 !important;
    flex: 1 1 auto !important;
    text-align: right !important;
  }
  /* Fallback: Preiszeile mit Händler als direkter Kind-Knoten (Flex-Row). */
  .Plugin_PriceInformation:has(> .tp-dealer-name),
  .price_information_product:has(> .tp-dealer-name),
  .product-price:has(> .tp-dealer-name),
  .priceContainer:has(> .tp-dealer-name) {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: baseline !important;
    justify-content: flex-end !important;
    gap: 2px 6px !important;
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
  :is(.Plugin_Product, .mixedBrowsingList, .mixedBrowsingListProduct, .Plugin_ProductCollItem, .Plugin_TopPriceReductionProductListFull) :is(.Plugin_PriceInformation, .price_information_product, .price_information_product_small, .priceContainer, .product-price):not(:has(> .shippingText)) {
    flex-wrap: nowrap !important;
  }
  :is(.Plugin_Product, .mixedBrowsingList, .mixedBrowsingListProduct, .Plugin_ProductCollItem, .Plugin_TopPriceReductionProductListFull) .priceContainer:has(> .shippingText) {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: baseline !important;
    justify-content: flex-end !important;
  }
  body.showshippingprice .Plugin_PriceInformation:has(.shippingPrice:not([style*="display: none"])) .productPrice:not(.showAsShippingPrice),
  body.showproductprice .Plugin_PriceInformation:has(.productPrice:not([style*="display: none"])) .shippingPrice {
    display: none !important;
  }
  :is(.Plugin_Product, .mixedBrowsingList, .mixedBrowsingListProduct, .Plugin_ProductCollItem, .Plugin_TopPriceReductionProductListFull) .priceContainer > .shippingText {
    width: 100% !important;
    flex: 0 0 100% !important;
    text-align: right !important;
  }
  :is(.mixedBrowsingList, .mixedList, .priceAvailabilityContainer, .price-availability) .shippingText {
    white-space: normal !important;
    text-align: right !important;
  }
  :is(.mixedBrowsingList, .mixedList, .priceAvailabilityContainer, .price-availability) .priceContainer {
    max-width: 100% !important;
    box-sizing: border-box !important;
    justify-content: flex-end !important;
  }
  :is(.mixedBrowsingList, .mixedList, .priceAvailabilityContainer, .price-availability) :is(span.tp-dealer-name, a.tp-dealer-name):not(.tp-card-dealer-row *) {
    max-width: 140px !important;
    flex: 0 1 auto !important;
    margin-right: 4px !important;
  }
  :is(.mixedBrowsingList, .mixedList, .priceAvailabilityContainer, .price-availability) .tp-card-dealer-row :is(span.tp-dealer-name, a.tp-dealer-name) {
    max-width: none !important;
    margin-right: 0 !important;
  }
  a.tp-dealer-name:hover {
    opacity: 1 !important;
    text-decoration: underline !important;
  }
  .tp-action-dealer {
    display: flex !important;
    align-items: center !important;
  }
  .tp-action-dealer button.tp-dealer-btn {
    background: none !important;
    border: none !important;
    cursor: pointer !important;
    font-size: 16px !important;
    line-height: 1 !important;
    padding: 2px 5px !important;
    opacity: 0.75 !important;
    transition: opacity 0.15s ease !important;
  }
  .tp-action-dealer button.tp-dealer-btn:hover {
    opacity: 1 !important;
  }
  .tp-action-dealer button.tp-dealer-btn:disabled {
    cursor: wait !important;
    opacity: 0.4 !important;
  }
  .tp-action-dealer a.tp-dealer-name {
    font: 500 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    color: inherit !important;
    text-decoration: none !important;
    opacity: 0.85 !important;
  }
  .tp-action-dealer a.tp-dealer-name:hover {
    opacity: 1 !important;
    text-decoration: underline !important;
  }
  button.tp-dealer-name.tp-dealer-btn,
  .tp-card-dealer-row > button.tp-dealer-name.tp-dealer-btn,
  .priceContainer:has(> .tp-dealer-name) > button.tp-dealer-name.tp-dealer-btn,
  .Plugin_PriceInformation:has(> .tp-dealer-name) > button.tp-dealer-name.tp-dealer-btn,
  .price_information_product:has(> .tp-dealer-name) > button.tp-dealer-name.tp-dealer-btn,
  .product-price:has(> .tp-dealer-name) > button.tp-dealer-name.tp-dealer-btn {
    background: none !important;
    border: none !important;
    cursor: pointer !important;
    padding: 2px 5px !important;
    opacity: 0.65 !important;
    pointer-events: auto !important;
    flex: 0 0 auto !important;
    width: auto !important;
    max-width: none !important;
    line-height: 1 !important;
    text-align: right !important;
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
  :is(.Plugin_PriceInformation, .price_information_product, .price_information_product_small, .priceContainer) > :is(.tp-card-alarm-group, button.tp-card-alarm-btn) {
    display: inline-flex !important;
    vertical-align: middle !important;
    margin-left: 4px !important;
    flex-shrink: 0 !important;
    white-space: nowrap !important;
    z-index: 4 !important;
  }
  :is(.Plugin_Product, .medium-box, .mixedBrowsingBox):has(.badge-dif:not(.tp-deal-pill)) {
    overflow: hidden !important;
  }
  .mixedBrowsingExpert :is(.Plugin_PriceInformation, .price_information_product, .price_information_product_small) > :is(.tp-card-alarm-group, button.tp-card-alarm-btn),
  .mixedBrowsingExpert .tp-card-alarm-group {
    position: static !important;
    display: inline-flex !important;
    vertical-align: middle !important;
    margin-right: 6px !important;
    margin-bottom: 4px !important;
    z-index: 4 !important;
  }
  .tp-card-alarm-group {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    opacity: 0 !important;
    pointer-events: none !important;
    transition: opacity 0.15s ease !important;
  }
  .tp-card-alarm-group * {
    pointer-events: none !important;
  }
  .tp-card-alarm-group button.tp-alarm-cog {
    position: relative !important;
    margin-left: 0 !important;
    padding: 2px 4px !important;
    border: none !important;
    background: transparent !important;
    color: inherit !important;
    font-size: 13px !important;
    line-height: 1 !important;
    cursor: pointer !important;
    opacity: 0.75 !important;
    transition: opacity 0.1s ease !important;
  }
  .tp-card-alarm-group button.tp-alarm-cog:hover {
    opacity: 1 !important;
  }
  button.tp-card-alarm-btn {
    position: relative !important;
    background: none !important;
    border: none !important;
    cursor: pointer !important;
    padding: 2px 4px !important;
    opacity: 0 !important;
    pointer-events: none !important;
    font-size: 16px !important;
    line-height: 1 !important;
    vertical-align: baseline !important;
    transition: opacity 0.15s ease !important;
  }
  button.tp-card-alarm-btn:not(:focus-visible) {
    outline: none !important;
  }
  button.tp-card-alarm-btn.tp-alarm-auto::after {
    content: "\\26A1" !important;
    position: absolute !important;
    top: -6px !important;
    right: -4px !important;
    font-size: 10px !important;
    line-height: 1 !important;
    pointer-events: none !important;
  }
  :is(.Plugin_Product, .mixedBrowsingList, .mixedBrowsingListProduct, .Plugin_ProductCollItem):is(:hover, :focus-within) :is(.tp-card-alarm-group, button.tp-card-alarm-btn),
  .tp-card-alarm-group:hover,
  .tp-card-alarm-group:focus-within,
  button.tp-card-alarm-btn:hover,
  button.tp-card-alarm-btn:focus-visible {
    opacity: 0.85 !important;
    pointer-events: auto !important;
  }
  :is(.Plugin_Product, .mixedBrowsingList, .mixedBrowsingListProduct, .Plugin_ProductCollItem):is(:hover, :focus-within) .tp-card-alarm-group *,
  .tp-card-alarm-group:is(:hover, :focus-within) * {
    pointer-events: auto !important;
  }
  .tp-card-alarm-group:hover,
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
    bottom: 5px !important;
    left: 40px !important;
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
    padding-bottom: 34px !important;
  }
  .tp-sparkline-container {
    position: relative !important;
    display: inline-flex !important;
    align-items: center !important;
    vertical-align: middle !important;
    margin: 0 !important;
    line-height: 1 !important;
    overflow: visible !important;
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
  @media (max-width: 360px) {
    .tp-card-subline-row .tp-sparkline-container {
      display: none !important;
    }
  }
`;
