/**
 * Shadow-modal secondary styles (split from ui/styles/shadow-modal.js):
 * Discord share preview dialog, AI prompt editors, token chips & live previews.
 */

export const SHADOW_SECTION_STYLES = `
  .tp-prompt-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .tp-prompt-textarea {
    flex: 1;
    margin-top: 0 !important;
    font-family: inherit;
    resize: vertical;
  }
  .tp-prompt-reset-btn {
    padding: 6px 10px !important;
    font-size: var(--tp-fs-sm) !important;
    height: 32px;
    white-space: nowrap;
  }
  .tp-ai-split-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .tp-ai-split-col {
    flex: 1;
    min-width: 140px;
  }
  .tp-ai-split-col-wide {
    flex: 1;
    min-width: 150px;
  }
  .tp-token-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
  }
  .tp-token-chip {
    padding: 2px 7px !important;
    font-size: 11px !important;
    line-height: 1.4;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
  .tp-search-preview-text.tp-preview-pre {
    white-space: pre-wrap;
    max-height: 130px;
    overflow-y: auto;
  }
  .tp-preview-warn {
    font-size: 11px;
    color: #b45309;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.35);
    border-radius: 4px;
    padding: 4px 8px;
  }

  /* Discord Share Preview Dialog */
  dialog#tp-modal-share-preview {
    box-sizing: border-box;
    width: 92%;
    max-width: 520px;
    max-height: 85vh;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--tp-line-soft);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border-radius: 16px;
    color: var(--tp-txt);
    padding: 20px;
    margin: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }
  dialog#tp-modal-share-preview:not([open]) { display: none; }
  dialog#tp-modal-share-preview::backdrop {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .tp-share-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .tp-share-preview-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
    color: var(--tp-txt);
  }
  .tp-share-preview-close {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    color: var(--tp-mut);
    line-height: 1;
    padding: 4px 6px;
    min-width: 28px;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
  }
  .tp-share-preview-close:hover { color: var(--tp-txt); }
  .tp-share-preview-close:focus-visible { outline: 2px solid var(--tp-focus); outline-offset: 2px; }
  .tp-share-preview-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tp-share-preview-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: var(--tp-mut);
    font-size: 13px;
  }
  .tp-share-preview-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #dc2626;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
  }
  .tp-share-preview-label { font-size: 12px; font-weight: 600; color: var(--tp-mut); margin-bottom: 4px; }
  .tp-share-preview-message {
    background: #2b2d31;
    color: #dbdee1;
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .tp-share-preview-message .tp-md-lg { font-size: 16px; font-weight: 800; }
  .tp-share-preview-message .tp-md-md { font-size: 14px; font-weight: 800; }
  .tp-share-preview-message .tp-md-sm { font-size: 12px; font-weight: 700; }
  .tp-share-preview-message .tp-md-link { font-weight: 700; color: #00a8fc; text-decoration: none; }
  .tp-share-preview-message .tp-md-url { opacity: .65; font-size: 11px; }
  .tp-share-preview-message .tp-md-quote { display: block; border-left: 3px solid #5865f2; padding-left: 8px; margin: 2px 0; opacity: .9; }
  .tp-share-comment-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
  }
  .tp-share-comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tp-share-comment-count {
    font-size: 11px;
    color: var(--tp-mut);
    font-variant-numeric: tabular-nums;
  }
  .tp-share-comment-input {
    width: 100%;
    box-sizing: border-box;
    min-height: 48px;
    max-height: 120px;
    resize: vertical;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
    line-height: 1.4;
    border: 1px solid var(--tp-line-soft);
    background: var(--tp-bg, #ffffff);
    color: var(--tp-txt, #1e293b);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .tp-share-comment-input:focus {
    outline: none;
    border-color: #5865f2;
    box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.2);
  }
  .tp-share-reply-preview-wrap {
    margin-top: 6px;
  }
  #tp-share-reply-preview {
    max-height: 150px;
    overflow-y: auto;
  }
  .tp-share-preview-images {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .tp-share-preview-img {
    max-height: 120px;
    max-width: 100%;
    border-radius: 6px;
    border: 1px solid var(--tp-line-soft);
    object-fit: contain;
    background: #fff;
  }
  .tp-share-preview-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    flex-shrink: 0;
    padding-top: 10px;
    border-top: 1px solid var(--tp-line-soft);
  }
  .tp-share-preview-channels {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tp-share-channel-btn {
    background: #5865f2;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .tp-share-channel-btn:hover:not(:disabled) {
    background: #4752c4;
  }
  .tp-share-channel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
