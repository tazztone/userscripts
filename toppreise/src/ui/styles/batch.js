/**
 * Batch Popover, Trigger Button & Dialog Styles
 */

export const STYLES_BATCH = `
  /* ─── FLOATING CTA BATCH TRIGGER & UPWARD POPOVER ─── */
  #tp-floating-batch-btn {
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    height: 28px !important;
    padding: 0 8px !important;
    background: rgba(15, 23, 42, 0.06) !important;
    border: 1px solid rgba(15, 23, 42, 0.14) !important;
    border-radius: 999px !important;
    color: var(--tp-txt) !important;
    font-family: inherit !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
    transition: background 0.15s ease, border-color 0.15s ease !important;
  }
  #tp-floating-batch-btn:hover,
  #tp-floating-batch-btn[aria-expanded="true"] {
    background: rgba(139, 92, 246, 0.14) !important;
    border-color: rgba(139, 92, 246, 0.45) !important;
  }
  #tp-floating-batch-btn:focus-visible {
    outline: 2px solid var(--tp-focus) !important;
    outline-offset: 2px !important;
  }
  #tp-floating-check-cta.tp-collapsed #tp-floating-batch-btn {
    display: none !important;
  }

  #tp-batch-popover {
    position: fixed !important;
    left: 20px !important;
    bottom: 62px !important;
    z-index: 99991 !important;
    width: 340px !important;
    max-width: calc(100vw - 24px) !important;
    background: var(--tp-bg-elev, #0f172a) !important;
    color: var(--tp-txt-inv, #f8fafc) !important;
    border: 1px solid rgba(148, 163, 184, 0.28) !important;
    border-radius: 12px !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38) !important;
    padding: 10px 12px !important;
    font-family: var(--tp-font) !important;
    font-size: 12px !important;
    display: none !important;
    flex-direction: column !important;
    gap: 10px !important;
    box-sizing: border-box !important;
  }
  #tp-batch-popover.tp-open {
    display: flex !important;
  }
  .tp-bp-header {
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
    border-bottom: 1px solid rgba(148, 163, 184, 0.18) !important;
    padding-bottom: 8px !important;
  }
  .tp-bp-title {
    font-weight: 700 !important;
    font-size: 12.5px !important;
    color: #f8fafc !important;
  }
  .tp-bp-scopes {
    display: flex !important;
    gap: 4px !important;
    flex-wrap: wrap !important;
  }
  .tp-bp-scope {
    flex: 1 1 auto !important;
    padding: 4px 6px !important;
    border-radius: 999px !important;
    border: 1px solid rgba(148, 163, 184, 0.25) !important;
    background: rgba(255, 255, 255, 0.05) !important;
    color: #cbd5e1 !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    white-space: nowrap !important;
  }
  .tp-bp-scope.tp-active {
    background: #7c3aed !important;
    border-color: #8b5cf6 !important;
    color: #ffffff !important;
  }
  .tp-bp-group {
    display: flex !important;
    flex-direction: column !important;
    gap: 5px !important;
  }
  .tp-bp-group-label {
    font-size: 10px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
    color: #94a3b8 !important;
    font-weight: 700 !important;
  }
  .tp-bp-row {
    display: flex !important;
    gap: 6px !important;
    align-items: center !important;
  }
  .tp-bp-btn,
  .tp-bp-mini-btn {
    padding: 6px 8px !important;
    border-radius: 7px !important;
    border: 1px solid rgba(148, 163, 184, 0.22) !important;
    background: rgba(255, 255, 255, 0.07) !important;
    color: #f1f5f9 !important;
    font-family: inherit !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    text-align: left !important;
    white-space: nowrap !important;
  }
  .tp-bp-btn { flex: 1 1 0 !important; }
  .tp-bp-mini-btn { flex: 0 0 auto !important; }
  .tp-bp-btn:hover,
  .tp-bp-mini-btn:hover {
    background: rgba(255, 255, 255, 0.14) !important;
  }
  .tp-bp-btn[hidden] { display: none !important; }
  .tp-bp-auto-label {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    padding: 5px 8px !important;
    border-radius: 7px !important;
    border: 1px solid rgba(148, 163, 184, 0.22) !important;
    background: rgba(255, 255, 255, 0.05) !important;
    color: #cbd5e1 !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    user-select: none !important;
  }
  .tp-bp-auto-label input {
    accent-color: #10b981 !important;
    margin: 0 !important;
    cursor: pointer !important;
  }
  .tp-bp-progress {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
    padding-top: 6px !important;
    border-top: 1px solid rgba(148, 163, 184, 0.18) !important;
    font-size: 11.5px !important;
    color: #fbbf24 !important;
  }
  .tp-bp-progress[hidden] { display: none !important; }

  /* ─── BATCH DIALOGS (#tp-batch-confirm-popout, #tp-batch-ai-popout) ─── */
  .tp-batch-dialog-body {
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
    padding: 12px 0 !important;
    font-size: 13px !important;
  }
  .tp-batch-dialog-summary { margin: 0 !important; font-weight: 600 !important; }
  .tp-batch-dialog-warn {
    padding: 8px 10px !important;
    border-radius: 8px !important;
    background: rgba(245, 158, 11, 0.12) !important;
    border: 1px solid rgba(217, 119, 6, 0.45) !important;
    color: #92400e !important;
    font-size: 12px !important;
  }
  .tp-batch-dialog-row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 10px !important;
    flex-wrap: wrap !important;
  }
  .tp-batch-dialog-row input[type="number"],
  .tp-batch-dialog-row select {
    padding: 4px 8px !important;
    border-radius: 6px !important;
    border: 1px solid var(--tp-bdr, rgba(15, 23, 42, 0.2)) !important;
    background: var(--tp-bg, #ffffff) !important;
    color: var(--tp-txt, #0f172a) !important;
    min-width: 90px !important;
  }
  .tp-batch-dur-pills { display: flex !important; gap: 4px !important; }
  .tp-batch-pill {
    padding: 4px 8px !important;
    border-radius: 6px !important;
    border: 1px solid var(--tp-bdr, rgba(15, 23, 42, 0.2)) !important;
    background: var(--tp-bg-sub, #f1f5f9) !important;
    color: var(--tp-txt-mid, #334155) !important;
    cursor: pointer !important;
    font-size: 12px !important;
  }
  .tp-batch-pill.tp-active {
    background: #7c3aed !important;
    border-color: #8b5cf6 !important;
    color: #ffffff !important;
  }
  .tp-batch-dialog-hint { font-size: 12px !important; opacity: 0.8 !important; }
  .tp-batch-btn-primary {
    background: #7c3aed !important;
    border-color: #8b5cf6 !important;
    color: #ffffff !important;
  }
  .tp-batch-ai-body { max-height: 55vh !important; overflow-y: auto !important; }
  .tp-batch-ai-item {
    padding: 8px 0 !important;
    border-bottom: 1px solid rgba(148, 163, 184, 0.16) !important;
  }
  .tp-batch-ai-item-title { font-weight: 700 !important; margin-bottom: 4px !important; }
  .tp-batch-citations {
    margin-top: 6px !important;
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
    font-size: 12px !important;
  }
  .tp-batch-citations a,
  .tp-batch-blocked-list a { color: var(--tp-blue-soft, #2563eb) !important; text-decoration: underline !important; }
  .tp-batch-blocked-list { margin: 8px 0 0 18px !important; padding: 0 !important; }

  @media (max-width: 600px) {
    #tp-batch-popover { left: 8px !important; bottom: 54px !important; width: calc(100vw - 16px) !important; }
    #tp-floating-batch-btn { padding: 0 6px !important; }
  }
  @media (hover: none), (pointer: coarse) {
    #tp-floating-batch-btn { height: 34px !important; touch-action: manipulation !important; }
  }
`;
