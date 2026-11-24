/** Overlays part (split from ui/styles.js): calc/filter popovers, floating CTA, responsive queries. */

export const STYLES_OVERLAYS = `
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
    height: 26px !important;
    padding: 2px 6px !important;
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
    border-color: var(--tp-focus) !important;
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
    min-height: 26px !important;
    padding: 3px 8px !important;
    border: 1px solid var(--tp-line) !important;
    border-radius: var(--tp-r-md) !important;
    background: #ffffff !important;
    color: var(--tp-txt-dim, #64748b) !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    line-height: 1.4 !important;
    box-sizing: border-box !important;
  }
  .tp-filter-mode-btn:focus-visible { outline: 2px solid var(--tp-focus) !important; outline-offset: 2px !important; }
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
    height: 26px !important;
    cursor: pointer !important;
  }
  #tp-bar-calc-popover .tp-threshold-wrapper input[type="range"]::-webkit-slider-thumb {
    width: 16px !important;
    height: 16px !important;
  }
  #tp-bar-calc-popover .tp-threshold-wrapper input[type="range"]::-moz-range-thumb {
    width: 16px !important;
    height: 16px !important;
  }
  #tp-bar-calc-popover #tp-bar-horizon-range { width: auto !important; }
  #tp-bar-calc-popover #tp-bar-weight-range { width: auto !important; }
  .tp-calc-reset { align-self: flex-end !important; }
  #tp-bar-calc-popover { max-height: min(70vh, 560px) !important; overflow-y: auto !important; }
  #tp-calc-preview { border-top: 1px solid var(--tp-line) !important; margin-top: 6px !important; padding-top: 6px !important; display: flex !important; flex-direction: column !important; gap: 4px !important; }
  .tp-preview-head { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; }
  .tp-preview-select { font-size: 11px !important; max-width: 190px !important; min-height: 28px !important; border: 1px solid var(--tp-line) !important; border-radius: var(--tp-r-md) !important; padding: 3px 8px !important; background: transparent !important; color: var(--tp-txt) !important; }
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
    width: 26px !important;
    height: 26px !important;
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
  @media (hover: none), (pointer: coarse) {
    .tp-bar-btn,
    #tp-inline-negative-input {
      height: 36px !important;
      min-height: 36px !important;
      touch-action: manipulation !important;
    }
    .tp-empty-state-btn {
      min-height: 38px !important;
      touch-action: manipulation !important;
    }
    #tp-clear-neg-btn {
      min-width: 32px !important;
      min-height: 32px !important;
      right: 2px !important;
      touch-action: manipulation !important;
    }
    #tp-bar-filters-toggle-label,
    #tp-bar-calc-popover .tp-mini-switch {
      min-height: 34px !important;
      touch-action: manipulation !important;
    }
    .tp-stepper-btn {
      width: 32px !important;
      height: 32px !important;
      touch-action: manipulation !important;
    }
    .tp-filter-mode-btn,
    .tp-preview-select {
      min-height: 34px !important;
      padding: 4px 10px !important;
      touch-action: manipulation !important;
    }
    .tp-range-input {
      height: 32px !important;
    }
    #tp-bar-calc-popover .tp-threshold-wrapper input[type="range"] {
      height: 34px !important;
    }
    #tp-bar-calc-popover .tp-threshold-wrapper input[type="range"]::-webkit-slider-thumb {
      width: 22px !important;
      height: 22px !important;
    }
    #tp-bar-calc-popover .tp-threshold-wrapper input[type="range"]::-moz-range-thumb {
      width: 22px !important;
      height: 22px !important;
    }
  }
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

  /* Light-DOM Popouts (#tp-sparkline-popout, #tp-ai-popout) */
  .tp-popout-backdrop {
    position: fixed !important;
    inset: 0 !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(15, 23, 42, 0.45) !important;
    backdrop-filter: blur(2px) !important;
    padding: 16px !important;
    box-sizing: border-box !important;
    font-family: var(--tp-font) !important;
  }
  .tp-popout-panel {
    background: var(--tp-bg) !important;
    color: var(--tp-txt) !important;
    border: 1px solid var(--tp-line-soft) !important;
    border-radius: var(--tp-r-lg) !important;
    padding: 16px 18px !important;
    max-width: min(608px, 94vw) !important;
    width: 100% !important;
    max-height: 90vh !important;
    overflow-y: auto !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45) !important;
    box-sizing: border-box !important;
  }
  .tp-popout-panel.tp-ai-panel {
    max-width: min(520px, 94vw) !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    padding: 18px 20px !important;
  }
  .tp-popout-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: 8px !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
  }
  .tp-ai-panel > .tp-popout-header {
    border-bottom: 1px solid var(--tp-line-soft) !important;
    padding-bottom: 10px !important;
    margin-bottom: 0 !important;
  }
  .tp-popout-title {
    color: var(--tp-txt-mid) !important;
    font-size: var(--tp-fs-lg) !important;
    font-weight: 700 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    flex: 1 1 auto !important;
    min-width: 0 !important;
  }
  .tp-popout-actions {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    flex-shrink: 0 !important;
  }
  .tp-popout-footer {
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: flex-end !important;
    gap: 8px !important;
    margin-top: 4px !important;
  }
  .tp-popout-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
    min-height: 28px !important;
    padding: 4px 12px !important;
    background: var(--tp-bg-sub) !important;
    border: 1px solid var(--tp-bdr) !important;
    border-radius: var(--tp-r-sm) !important;
    color: var(--tp-txt-mid) !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    line-height: 1.2 !important;
    text-decoration: none !important;
    cursor: pointer !important;
    box-sizing: border-box !important;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
  }
  .tp-popout-btn[hidden],
  .tp-popout-chip[hidden] {
    display: none !important;
  }
  .tp-popout-btn:hover:not(:disabled) {
    background: rgba(15, 23, 42, 0.09) !important;
    border-color: var(--tp-line-soft) !important;
    color: var(--tp-txt) !important;
  }
  .tp-popout-btn:disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
  }
  .tp-popout-close {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 28px !important;
    min-height: 28px !important;
    padding: 4px 8px !important;
    background: transparent !important;
    border: 1px solid transparent !important;
    border-radius: var(--tp-r-sm) !important;
    color: var(--tp-mut) !important;
    font-size: 16px !important;
    line-height: 1 !important;
    cursor: pointer !important;
    box-sizing: border-box !important;
    transition: color 0.15s ease, background 0.15s ease !important;
  }
  .tp-popout-close:hover {
    color: var(--tp-txt) !important;
    background: var(--tp-bg-sub) !important;
  }
  .tp-popout-chip {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 38px !important;
    min-height: 26px !important;
    padding: 3px 8px !important;
    background: transparent !important;
    border: 1px solid var(--tp-bdr) !important;
    border-radius: var(--tp-r-sm) !important;
    color: var(--tp-txt-mid) !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    box-sizing: border-box !important;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
  }
  .tp-popout-chip:hover:not(.tp-active) {
    background: var(--tp-bg-sub) !important;
    color: var(--tp-txt) !important;
  }
  .tp-popout-chip.tp-active {
    background: var(--tp-btn-primary, #047857) !important;
    border-color: var(--tp-btn-primary, #047857) !important;
    color: #ffffff !important;
  }
  .tp-popout-link {
    display: inline-flex !important;
    align-items: center !important;
    min-height: 24px !important;
    padding: 2px 4px !important;
    color: var(--tp-link, var(--tp-blue-soft, #2563eb)) !important;
    text-decoration: none !important;
    border-radius: 4px !important;
    box-sizing: border-box !important;
  }
  .tp-popout-link:hover {
    text-decoration: underline !important;
  }
  .tp-popout-btn:focus-visible,
  .tp-popout-close:focus-visible,
  .tp-popout-chip:focus-visible,
  .tp-popout-link:focus-visible {
    outline: 2px solid var(--tp-focus) !important;
    outline-offset: 2px !important;
  }
  .tp-keepa-section {
    margin-top: 16px !important;
    padding-top: 14px !important;
    border-top: 1px solid var(--tp-bdr) !important;
  }
  .tp-keepa-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: 8px !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
  }
  .tp-keepa-title {
    color: var(--tp-txt-mid) !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 100% !important;
    flex: 1 1 200px !important;
    min-width: 0 !important;
  }
  .tp-keepa-toolbar {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
  }
  .tp-keepa-body {
    min-height: 120px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    background: var(--tp-bg-sub) !important;
    border-radius: var(--tp-r-sm) !important;
    padding: 8px !important;
    box-sizing: border-box !important;
  }
  .tp-keepa-status {
    color: var(--tp-mut) !important;
    font-size: 12px !important;
    padding: 16px !important;
    text-align: center !important;
  }
  .tp-keepa-img {
    max-width: 100% !important;
    height: auto !important;
    border-radius: 4px !important;
    display: block !important;
  }
  .tp-keepa-links {
    display: flex !important;
    justify-content: flex-end !important;
    flex-wrap: wrap !important;
    gap: 12px !important;
    width: 100% !important;
    margin-top: 6px !important;
    font-size: 11px !important;
  }
  .tp-ai-sub {
    display: flex !important;
    align-items: baseline !important;
    justify-content: space-between !important;
    gap: 10px !important;
  }
  .tp-ai-prod {
    font-size: 14px !important;
    font-weight: 600 !important;
    color: var(--tp-txt) !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    flex: 1 1 auto !important;
    min-width: 0 !important;
  }
  .tp-ai-price {
    font-size: 13px !important;
    font-weight: 700 !important;
    color: var(--tp-acc-deep, #047857) !important;
    white-space: nowrap !important;
    background: rgba(16, 185, 129, 0.12) !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    flex-shrink: 0 !important;
  }
  .tp-ai-body {
    font-size: 13px !important;
    line-height: 1.55 !important;
    color: var(--tp-txt-mid) !important;
    min-height: 56px !important;
    max-height: 300px !important;
    overflow-y: auto !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
    background: var(--tp-bg-sub) !important;
    padding: 12px !important;
    border-radius: var(--tp-r-md) !important;
    border-left: 3px solid #5865f2 !important;
    box-sizing: border-box !important;
  }
  .tp-ai-body.tp-ai-error {
    border-left-color: #ef4444 !important;
  }
  .tp-ai-error-msg {
    color: #ef4444 !important;
    font-weight: 600 !important;
  }
  .tp-ai-error-help {
    display: inline-block !important;
    margin-top: 4px !important;
    font-size: 12px !important;
    opacity: 0.85 !important;
  }
  .tp-ai-citations {
    margin-top: 10px !important;
    padding-top: 8px !important;
    border-top: 1px solid var(--tp-line) !important;
    font-size: 12px !important;
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
    align-items: center !important;
  }
  .tp-ai-citations-label {
    opacity: 0.75 !important;
  }
  .tp-ai-citation-link {
    color: var(--tp-blue-soft, #2563eb) !important;
    text-decoration: underline !important;
    max-width: 220px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    display: inline-block !important;
  }
  .tp-ai-status {
    opacity: 0.75 !important;
  }
  .tp-ai-status-delayed {
    opacity: 0.85 !important;
  }
  .tp-ai-status-sub {
    font-size: 12px !important;
    opacity: 0.75 !important;
    margin-top: 4px !important;
    display: inline-block !important;
  }
  @media (max-width: 480px) {
    .tp-popout-backdrop { padding: 10px !important; }
    .tp-popout-panel,
    .tp-popout-panel.tp-ai-panel { padding: 12px !important; max-width: 96vw !important; }
    .tp-popout-footer > .tp-popout-btn { flex: 1 1 auto !important; }
  }
  @media (hover: none), (pointer: coarse) {
    .tp-popout-btn {
      min-height: 36px !important;
      padding: 6px 12px !important;
      touch-action: manipulation !important;
    }
    .tp-popout-close {
      min-width: 36px !important;
      min-height: 36px !important;
      touch-action: manipulation !important;
    }
    .tp-popout-chip {
      min-width: 44px !important;
      min-height: 34px !important;
      padding: 4px 10px !important;
      touch-action: manipulation !important;
    }
    .tp-popout-link {
      min-height: 34px !important;
      padding: 4px 6px !important;
      touch-action: manipulation !important;
    }
  }
`;
