/** Chrome part (split from ui/styles.js): bestpreise controls, empty state, detail badge, filter bar. */

export const STYLES_CHROME = `
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

`;
