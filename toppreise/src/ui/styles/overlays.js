/** Overlays part (split from ui/styles.js): calc/filter popovers, floating CTA, responsive queries. */

export const STYLES_OVERLAYS = `
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
