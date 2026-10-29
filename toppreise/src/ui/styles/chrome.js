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
