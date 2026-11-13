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
    height: 34px !important;
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
    background: linear-gradient(135deg, #047857 0%, #065f46 100%) !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 999px !important;
    padding: 2px 8px !important;
    height: 28px !important;
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
    height: 28px !important;
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
    width: 15px !important;
    height: 15px !important;
    cursor: pointer !important;
    margin: 0 !important;
  }
  #tp-floating-threshold-input {
    width: 44px !important;
    height: 28px !important;
    padding: 0 4px !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid rgba(255, 255, 255, 0.16) !important;
    border-radius: 999px !important;
    font-family: inherit !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    color: var(--tp-txt-dim) !important;
    text-align: center !important;
    box-sizing: border-box !important;
    outline: none !important;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
  }
  #tp-floating-threshold-input:hover {
    background: rgba(255, 255, 255, 0.14) !important;
    color: var(--tp-txt) !important;
  }
  #tp-floating-threshold-input:focus {
    background: rgba(255, 255, 255, 0.2) !important;
    border-color: #10b981 !important;
    color: #fff !important;
  }
  #tp-floating-refresh-btn,
  #tp-floating-cta-collapse {
    background: transparent !important;
    border: none !important;
    color: var(--tp-txt-dim) !important;
    cursor: pointer !important;
    font-size: 12px !important;
    min-width: 26px !important;
    min-height: 26px !important;
    padding: 2px 5px !important;
    line-height: 1 !important;
    border-radius: 4px !important;
    transition: color 0.15s ease, transform 0.15s ease !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-sizing: border-box !important;
  }
  #tp-floating-check-btn:focus-visible,
  #tp-floating-dealer-row:focus-within,
  #tp-floating-threshold-input:focus-visible,
  #tp-floating-refresh-btn:focus-visible,
  #tp-floating-cta-collapse:focus-visible {
    outline: 2px solid var(--tp-focus) !important;
    outline-offset: 2px !important;
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
  #tp-floating-check-cta.tp-collapsed { border-radius: var(--tp-r-pill) !important; padding: 2px !important; height: 30px !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-btn { border-radius: var(--tp-r-pill) !important; padding: 0 8px !important; height: 24px !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-main,
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-sub,
  #tp-floating-check-cta.tp-collapsed #tp-floating-dealer-row,
  #tp-floating-check-cta.tp-collapsed #tp-floating-refresh-btn,
  #tp-floating-check-cta.tp-collapsed #tp-floating-threshold-input { display: none !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-check-count { display: inline !important; }
  #tp-floating-check-cta.tp-collapsed #tp-floating-cta-collapse { border-radius: 50% !important; border: 1px solid rgba(15,23,42,0.12) !important; width: 24px !important; height: 24px !important; min-width: 24px !important; min-height: 24px !important; padding: 0 !important; }
  .tp-label-short { display: none !important; }
  .tp-label-full { display: inline !important; }
  @media (max-width: 600px) {
    #tp-floating-check-sub { display: none !important; }
    #tp-floating-check-cta {
      left: 8px !important;
      bottom: 8px !important;
      max-width: calc(100vw - 62px) !important;
      gap: 2px !important;
    }
    #tp-floating-check-btn { padding: 2px 6px !important; }
    #tp-floating-dealer-row { padding: 0 4px !important; }
    #tp-floating-threshold-input { width: 38px !important; padding: 0 2px !important; }
    .tp-label-full { display: none !important; }
    .tp-label-short { display: inline !important; }
  }
  @media (hover: none), (pointer: coarse) {
    #tp-floating-check-cta { height: 40px !important; }
    #tp-floating-check-cta.tp-collapsed { height: 36px !important; }
    #tp-floating-check-btn,
    #tp-floating-dealer-row,
    #tp-floating-threshold-input {
      height: 34px !important;
      touch-action: manipulation !important;
    }
    #tp-floating-refresh-btn,
    #tp-floating-cta-collapse {
      min-width: 34px !important;
      min-height: 34px !important;
      touch-action: manipulation !important;
    }
    #tp-floating-check-cta.tp-collapsed #tp-floating-cta-collapse {
      width: 30px !important;
      height: 30px !important;
      min-width: 30px !important;
      min-height: 30px !important;
    }
  }
  @media (max-width: 768px) {
    .Plugin_LastSearchTerms {
      margin-bottom: calc(48px + env(safe-area-inset-bottom, 0px)) !important;
    }
  }
`;
