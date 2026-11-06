/**
 * Floating check-deals CTA styles.
 * Split from ui/styles/overlays.js to satisfy module size budget.
 */

export const STYLES_FLOATING_CTA = `
  /* ─── FLOATING CHECK-DEALS CTA (primary one-click verify action) ─── */
  #tp-floating-check-cta {
    position: fixed !important;
    left: 20px !important;
    bottom: 20px !important;
    z-index: 99990 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    max-width: none !important;
    height: 30px !important;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid var(--tp-line-soft) !important;
    border-radius: 999px !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
    padding: 2px 4px !important;
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
    background: rgba(15, 23, 42, 0.12) !important;
    color: var(--tp-txt) !important;
  }
  #tp-floating-check-cta.tp-hidden { display: none !important; }
  @keyframes tp-floating-pulse {
    0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    50% { box-shadow: 0 4px 22px rgba(16, 185, 129, 0.35); }
  }
  #tp-floating-check-btn {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 999px !important;
    padding: 2px 8px !important;
    height: 24px !important;
    font-family: inherit !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    line-height: 1 !important;
    cursor: pointer !important;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35) !important;
    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease !important;
    white-space: nowrap !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
    box-sizing: border-box !important;
  }
  #tp-floating-check-btn:hover {
    filter: brightness(1.08) !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.45) !important;
  }
  #tp-floating-check-btn:active {
    transform: translateY(0) !important;
  }
  #tp-floating-check-cta.tp-scanning #tp-floating-check-btn {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35) !important;
  }
  #tp-floating-check-labels {
    display: inline-flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    line-height: 1.1 !important;
  }
  #tp-floating-check-main {
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: -0.01em !important;
  }
  #tp-floating-check-sub {
    font-size: 8.5px !important;
    font-weight: 500 !important;
    opacity: 0.85 !important;
    letter-spacing: -0.01em !important;
  }
  #tp-floating-dealer-row {
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    padding: 0 5px !important;
    height: 24px !important;
    background: rgba(15, 23, 42, 0.05) !important;
    border-radius: 999px !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    color: var(--tp-txt-dim) !important;
    cursor: pointer !important;
    user-select: none !important;
    transition: background 0.15s ease, color 0.15s ease !important;
    box-sizing: border-box !important;
  }
  #tp-floating-dealer-row:hover {
    background: rgba(15, 23, 42, 0.1) !important;
    color: var(--tp-txt) !important;
  }
  #tp-floating-dealer-toggle {
    accent-color: #10b981 !important;
    cursor: pointer !important;
    margin: 0 !important;
  }
  #tp-floating-threshold-btn {
    display: inline-flex !important;
    align-items: center !important;
    gap: 2px !important;
    background: rgba(15, 23, 42, 0.05) !important;
    border: none !important;
    border-radius: 999px !important;
    padding: 0 5px !important;
    height: 24px !important;
    font-family: inherit !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    color: var(--tp-txt-dim) !important;
    cursor: pointer !important;
    transition: background 0.15s ease, color 0.15s ease !important;
    box-sizing: border-box !important;
  }
  #tp-floating-threshold-btn:hover {
    background: rgba(15, 23, 42, 0.1) !important;
    color: var(--tp-txt) !important;
  }
  #tp-floating-threshold-menu {
    position: absolute !important;
    bottom: calc(100% + 8px) !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background: rgba(255, 255, 255, 0.98) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid var(--tp-line-soft) !important;
    border-radius: var(--tp-r-md) !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18) !important;
    padding: 6px !important;
    display: none !important;
    flex-direction: column !important;
    gap: 2px !important;
    min-width: 140px !important;
    z-index: 99992 !important;
  }
  #tp-floating-threshold-menu.tp-show { display: flex !important; }
  .tp-threshold-item {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 5px 8px !important;
    border-radius: var(--tp-r-sm) !important;
    border: none !important;
    background: transparent !important;
    color: var(--tp-txt) !important;
    font-family: inherit !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    transition: background 0.12s ease !important;
    text-align: left !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .tp-threshold-item:hover { background: rgba(16, 185, 129, 0.12) !important; color: #059669 !important; }
  .tp-threshold-item.tp-active { background: #10b981 !important; color: #ffffff !important; font-weight: 700 !important; }
  #tp-floating-refresh-btn,
  #tp-floating-cta-collapse {
    background: transparent !important;
    border: none !important;
    color: var(--tp-txt-dim) !important;
    cursor: pointer !important;
    font-size: 12px !important;
    padding: 2px 4px !important;
    line-height: 1 !important;
    border-radius: 4px !important;
    transition: color 0.15s ease, transform 0.15s ease !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  #tp-floating-refresh-btn:hover,
  #tp-floating-cta-collapse:hover {
    color: var(--tp-txt) !important;
    background: rgba(15, 23, 42, 0.06) !important;
  }
  #tp-floating-refresh-btn.tp-spinning {
    animation: tp-spin 0.9s linear infinite !important;
  }
  @keyframes tp-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  #tp-floating-check-count { display: none !important; font-size: 12px !important; font-weight: 800 !important; white-space: nowrap !important; }
  #tp-floating-check-cta.tp-collapsed { border-radius: var(--tp-r-pill) !important; padding: 2px !important; height: 26px !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-btn { border-radius: var(--tp-r-pill) !important; padding: 0 8px !important; height: 22px !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-main,
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-sub,
  #tp-floating-check-cta.tp-collapsed #tp-floating-dealer-row,
  #tp-floating-check-cta.tp-collapsed #tp-floating-refresh-btn,
  #tp-floating-check-cta.tp-collapsed #tp-floating-threshold-btn { display: none !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-count { display: inline !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-cta-collapse { border-radius: 50% !important; border: 1px solid rgba(15,23,42,0.12) !important; width: 20px !important; height: 20px !important; }
  .tp-label-short { display: none !important; }
  .tp-label-full { display: inline !important; }
  @media (max-width: 600px) {
    #tp-floating-check-sub { display: none !important; }
    #tp-floating-check-cta {
      left: 8px !important;
      bottom: 8px !important;
      max-width: calc(100vw - 52px) !important;
      gap: 2px !important;
    }
    #tp-floating-check-btn { padding: 2px 6px !important; }
    #tp-floating-dealer-row { padding: 0 4px !important; }
    #tp-floating-threshold-btn { padding: 0 4px !important; }
    .tp-label-full { display: none !important; }
    .tp-label-short { display: inline !important; }
  }
`;
