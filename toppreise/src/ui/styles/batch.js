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
  #tp-floating-batch-btn.tp-batch-running {
    background: rgba(245, 158, 11, 0.16) !important;
    border-color: rgba(217, 119, 6, 0.5) !important;
    color: #92400e !important;
  }
  #tp-floating-batch-btn .tp-batch-caret {
    display: inline-block !important;
    transition: transform 0.15s ease !important;
  }
  #tp-floating-batch-btn[aria-expanded="true"] .tp-batch-caret {
    transform: rotate(180deg) !important;
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
    width: 324px !important;
    max-width: calc(100vw - 24px) !important;
    max-height: calc(100vh - 84px) !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
    background: rgba(255, 255, 255, 0.97) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    color: var(--tp-txt, #0f172a) !important;
    border: 1px solid var(--tp-line-soft, rgba(15, 23, 42, 0.14)) !important;
    border-radius: 14px !important;
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18) !important;
    padding: 10px 12px !important;
    font-family: var(--tp-font) !important;
    font-size: 12px !important;
    display: none !important;
    flex-direction: column !important;
    gap: 8px !important;
    box-sizing: border-box !important;
  }
  #tp-batch-popover.tp-open {
    display: flex !important;
    animation: tp-bp-in 0.14s ease-out !important;
  }
  @keyframes tp-bp-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .tp-bp-header {
    display: flex !important;
    flex-direction: column !important;
    gap: 7px !important;
    border-bottom: 1px solid rgba(15, 23, 42, 0.1) !important;
    padding-bottom: 8px !important;
  }
  .tp-bp-title-row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
  }
  .tp-bp-title {
    font-weight: 700 !important;
    font-size: 13px !important;
    color: var(--tp-txt, #0f172a) !important;
  }
  .tp-bp-close {
    width: 24px !important;
    height: 24px !important;
    border-radius: 6px !important;
    border: 1px solid transparent !important;
    background: transparent !important;
    color: var(--tp-txt-soft, #64748b) !important;
    font-size: 13px !important;
    line-height: 1 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .tp-bp-close:hover {
    background: rgba(15, 23, 42, 0.06) !important;
    color: var(--tp-txt, #0f172a) !important;
  }
  .tp-bp-scopes {
    display: grid !important;
    grid-template-columns: 1.35fr 0.85fr 0.85fr !important;
    gap: 2px !important;
    background: var(--tp-bg-sub, #f1f5f9) !important;
    padding: 2px !important;
    border-radius: 9px !important;
    border: 1px solid rgba(15, 23, 42, 0.08) !important;
  }
  .tp-bp-scope {
    padding: 5px 4px !important;
    border-radius: 7px !important;
    border: none !important;
    background: transparent !important;
    color: var(--tp-txt-mid, #475569) !important;
    font-family: inherit !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    white-space: nowrap !important;
    text-align: center !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    transition: background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease !important;
  }
  .tp-bp-scope.tp-active {
    background: #ffffff !important;
    color: var(--tp-acc2, #6d28d9) !important;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12) !important;
  }
  .tp-bp-group {
    display: flex !important;
    flex-direction: column !important;
    gap: 3px !important;
  }
  .tp-bp-group-label {
    font-size: 10px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
    color: var(--tp-txt-soft, #64748b) !important;
    font-weight: 700 !important;
    padding: 2px 2px 1px !important;
  }
  .tp-bp-row {
    display: flex !important;
    gap: 6px !important;
    align-items: center !important;
  }
  .tp-bp-row[hidden] { display: none !important; }
  .tp-bp-item {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    min-height: 34px !important;
    padding: 6px 9px !important;
    border-radius: 8px !important;
    border: 1px solid rgba(15, 23, 42, 0.1) !important;
    background: rgba(255, 255, 255, 0.72) !important;
    color: var(--tp-txt, #0f172a) !important;
    font-family: inherit !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
    text-align: left !important;
    white-space: nowrap !important;
    transition: background 0.12s ease, border-color 0.12s ease !important;
  }
  .tp-bp-item:hover:not(:disabled) {
    background: rgba(124, 58, 237, 0.08) !important;
    border-color: rgba(124, 58, 237, 0.32) !important;
  }
  .tp-bp-item:disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
  }
  .tp-bp-item-main {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  .tp-bp-meta {
    flex: 0 0 auto !important;
    font-size: 10.5px !important;
    font-weight: 600 !important;
    color: var(--tp-txt-soft, #64748b) !important;
    background: rgba(15, 23, 42, 0.05) !important;
    padding: 2px 6px !important;
    border-radius: 999px !important;
    white-space: nowrap !important;
  }
  .tp-bp-mini-btn {
    flex: 0 0 auto !important;
    min-height: 34px !important;
    padding: 0 10px !important;
    border-radius: 8px !important;
    border: 1px solid rgba(15, 23, 42, 0.12) !important;
    background: var(--tp-bg-sub, #f1f5f9) !important;
    color: var(--tp-txt, #0f172a) !important;
    font-family: inherit !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    white-space: nowrap !important;
  }
  .tp-bp-mini-btn:hover:not(:disabled) {
    background: rgba(124, 58, 237, 0.1) !important;
    border-color: rgba(124, 58, 237, 0.35) !important;
    color: var(--tp-acc2, #6d28d9) !important;
  }
  .tp-bp-auto-label {
    flex: 0 0 auto !important;
    min-height: 34px !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    padding: 0 9px !important;
    border-radius: 8px !important;
    border: 1px solid rgba(15, 23, 42, 0.12) !important;
    background: var(--tp-bg-sub, #f1f5f9) !important;
    color: var(--tp-txt-mid, #334155) !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    user-select: none !important;
    box-sizing: border-box !important;
  }
  .tp-bp-auto-label input {
    accent-color: #10b981 !important;
    margin: 0 !important;
    cursor: pointer !important;
  }
  .tp-bp-footer {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
    padding-top: 6px !important;
    border-top: 1px solid rgba(15, 23, 42, 0.1) !important;
    font-size: 11px !important;
    color: var(--tp-txt-soft, #64748b) !important;
  }
  .tp-bp-footer[hidden] { display: none !important; }
  .tp-bp-settings-btn {
    width: 26px !important;
    height: 26px !important;
    border-radius: 7px !important;
    border: 1px solid rgba(15, 23, 42, 0.12) !important;
    background: var(--tp-bg-sub, #f1f5f9) !important;
    color: var(--tp-txt, #0f172a) !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 13px !important;
  }
  .tp-bp-settings-btn:hover {
    background: rgba(124, 58, 237, 0.1) !important;
    border-color: rgba(124, 58, 237, 0.35) !important;
  }
  .tp-bp-item:focus-visible,
  .tp-bp-mini-btn:focus-visible,
  .tp-bp-scope:focus-visible,
  .tp-bp-close:focus-visible,
  .tp-bp-settings-btn:focus-visible,
  .tp-bp-auto-label input:focus-visible {
    outline: 2px solid var(--tp-focus, #7c3aed) !important;
    outline-offset: 1px !important;
  }
  .tp-bp-progress {
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
    padding-top: 6px !important;
    border-top: 1px solid rgba(15, 23, 42, 0.1) !important;
    font-size: 11.5px !important;
    color: #92400e !important;
    font-weight: 600 !important;
  }
  .tp-bp-progress[hidden] { display: none !important; }
  .tp-bp-progress-head {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
  }
  .tp-bp-progress-track {
    height: 5px !important;
    width: 100% !important;
    border-radius: 999px !important;
    background: rgba(15, 23, 42, 0.08) !important;
    overflow: hidden !important;
  }
  .tp-bp-progress-fill {
    height: 100% !important;
    width: 0% !important;
    background: linear-gradient(90deg, #7c3aed, #f59e0b) !important;
    border-radius: 999px !important;
    transition: width 0.2s ease !important;
  }

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
  .tp-popout-panel.tp-batch-ai-panel { max-width: min(680px, 94vw) !important; }
  .tp-batch-ai-body { max-height: 55vh !important; overflow-y: auto !important; }
  .tp-batch-alarm-preview {
    margin: 0 !important;
    padding: 6px 8px !important;
    border-radius: 8px !important;
    background: var(--tp-bg-sub, #f1f5f9) !important;
    border: 1px solid rgba(15, 23, 42, 0.1) !important;
    font-size: 12px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
  }
  .tp-batch-alarm-preview-row {
    display: flex !important;
    justify-content: space-between !important;
    gap: 8px !important;
  }
  .tp-batch-alarm-preview-title {
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    font-weight: 600 !important;
  }
  .tp-ai-h {
    display: block !important;
    margin: 8px 0 3px !important;
    font-weight: 700 !important;
    color: var(--tp-txt, #0f172a) !important;
  }
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
  .tp-batch-paste-preview {
    margin: 8px 0 0 !important;
    padding: 8px 10px !important;
    max-height: 220px !important;
    overflow: auto !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
    font-size: 11px !important;
    line-height: 1.4 !important;
    background: var(--tp-bg-sub, #f1f5f9) !important;
    border: 1px solid rgba(15, 23, 42, 0.12) !important;
    border-radius: 8px !important;
    color: var(--tp-txt, #0f172a) !important;
  }

  @media (max-width: 600px) {
    #tp-batch-popover { left: 8px !important; bottom: 54px !important; width: calc(100vw - 16px) !important; }
    #tp-floating-batch-btn { padding: 0 6px !important; }
  }
  @media (hover: none), (pointer: coarse) {
    #tp-floating-batch-btn { height: 34px !important; touch-action: manipulation !important; }
  }

  /* ─── UNIVERSAL AI LAUNCHER POPOVER (#tp-ai-launcher-popover) ─── */
  #tp-ai-launcher-popover {
    position: fixed !important;
    z-index: 99993 !important;
    width: 304px !important;
    max-width: calc(100vw - 16px) !important;
    max-height: calc(100vh - 16px) !important;
    overflow-y: auto !important;
    background: rgba(255, 255, 255, 0.98) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    color: var(--tp-txt, #0f172a) !important;
    border: 1px solid var(--tp-line-soft, rgba(15, 23, 42, 0.16)) !important;
    border-radius: 14px !important;
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.22) !important;
    padding: 10px 12px !important;
    font-family: var(--tp-font) !important;
    font-size: 12px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 9px !important;
    box-sizing: border-box !important;
    animation: tp-bp-in 0.12s ease-out !important;
  }
  .tp-launcher-head {
    display: flex !important;
    align-items: flex-start !important;
    justify-content: space-between !important;
    gap: 8px !important;
    border-bottom: 1px solid rgba(15, 23, 42, 0.1) !important;
    padding-bottom: 7px !important;
  }
  .tp-launcher-title-wrap {
    min-width: 0 !important;
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 2px !important;
  }
  .tp-launcher-title {
    font-weight: 700 !important;
    font-size: 13px !important;
    color: var(--tp-txt, #0f172a) !important;
  }
  .tp-launcher-sub {
    font-size: 11px !important;
    color: var(--tp-txt-soft, #64748b) !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  .tp-launcher-group {
    display: flex !important;
    flex-direction: column !important;
    gap: 5px !important;
  }
  .tp-launcher-btn-full {
    width: 100% !important;
  }
  .tp-launcher-or-box {
    padding: 8px !important;
    border-radius: 10px !important;
    background: var(--tp-bg-sub, #f8fafc) !important;
    border: 1px solid rgba(15, 23, 42, 0.08) !important;
  }
  .tp-launcher-or-head {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 6px !important;
  }
  .tp-launcher-cache-badge {
    font-size: 10px !important;
    font-weight: 700 !important;
    color: #047857 !important;
    background: rgba(16, 185, 129, 0.14) !important;
    border: 1px solid rgba(16, 185, 129, 0.32) !important;
    border-radius: 999px !important;
    padding: 1px 6px !important;
    white-space: nowrap !important;
  }
  .tp-launcher-cache-badge[hidden] { display: none !important; }
  .tp-launcher-select,
  .tp-launcher-input {
    width: 100% !important;
    min-height: 30px !important;
    padding: 4px 8px !important;
    border-radius: 7px !important;
    border: 1px solid rgba(15, 23, 42, 0.16) !important;
    background: #ffffff !important;
    color: var(--tp-txt, #0f172a) !important;
    font-family: inherit !important;
    font-size: 11.5px !important;
    box-sizing: border-box !important;
  }
  .tp-launcher-input[hidden] { display: none !important; }
  .tp-launcher-btn {
    min-height: 32px !important;
    padding: 6px 10px !important;
    border-radius: 8px !important;
    border: 1px solid rgba(15, 23, 42, 0.14) !important;
    background: #ffffff !important;
    color: var(--tp-txt, #0f172a) !important;
    font-family: inherit !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 5px !important;
    transition: background 0.12s ease, border-color 0.12s ease !important;
  }
  .tp-launcher-btn:hover {
    background: rgba(124, 58, 237, 0.08) !important;
    border-color: rgba(124, 58, 237, 0.35) !important;
  }
  .tp-launcher-btn-primary {
    width: 100% !important;
    background: #7c3aed !important;
    border-color: #6d28d9 !important;
    color: #ffffff !important;
  }
  .tp-launcher-btn-primary:hover {
    background: #6d28d9 !important;
    border-color: #5b21b6 !important;
  }
  .tp-launcher-btn-setup {
    width: 100% !important;
    background: rgba(245, 158, 11, 0.12) !important;
    border-color: rgba(217, 119, 6, 0.45) !important;
    color: #92400e !important;
  }
  .tp-launcher-btn-subtle {
    width: 100% !important;
    background: var(--tp-bg-sub, #f1f5f9) !important;
    font-size: 11px !important;
  }
  .tp-launcher-limit-row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
  }
  .tp-launcher-limit-row input[type="number"] {
    width: 72px !important;
    padding: 3px 6px !important;
    border-radius: 6px !important;
    border: 1px solid rgba(15, 23, 42, 0.18) !important;
    background: #ffffff !important;
    color: var(--tp-txt, #0f172a) !important;
    font-size: 12px !important;
  }
  .tp-launcher-warn { font-size: 11px !important; padding: 6px 8px !important; }
  .tp-launcher-ext-row {
    display: flex !important;
    gap: 5px !important;
    flex-wrap: wrap !important;
  }
  .tp-launcher-pill {
    flex: 1 1 auto !important;
    padding: 4px 8px !important;
    border-radius: 999px !important;
    border: 1px solid rgba(15, 23, 42, 0.14) !important;
    background: var(--tp-bg-sub, #f1f5f9) !important;
    color: var(--tp-txt-mid, #334155) !important;
    font-family: inherit !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
  }
  .tp-launcher-pill:hover {
    background: rgba(124, 58, 237, 0.1) !important;
    border-color: rgba(124, 58, 237, 0.35) !important;
  }
  .tp-ai-model-bar {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    margin: 6px 0 2px !important;
    font-size: 11.5px !important;
  }
  .tp-ai-model-bar label {
    font-weight: 600 !important;
    color: var(--tp-txt-soft, #64748b) !important;
    white-space: nowrap !important;
  }
  .tp-ai-model-bar select,
  .tp-ai-model-bar input {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    padding: 3px 7px !important;
    border-radius: 6px !important;
    border: 1px solid var(--tp-bdr, rgba(15, 23, 42, 0.18)) !important;
    background: var(--tp-bg, #ffffff) !important;
    color: var(--tp-txt, #0f172a) !important;
    font-family: inherit !important;
    font-size: 11.5px !important;
  }
  .tp-ai-model-bar input[hidden] { display: none !important; }
`;
