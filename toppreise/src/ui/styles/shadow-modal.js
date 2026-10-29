/** Shadow-modal part (split from ui/styles.js): isolated Shadow DOM dialog styles. */

import { TP_TOKEN_VARS } from './tokens.js';

export const SHADOW_MODAL_STYLES = `
  :host {
    all: initial;
    font-family: var(--tp-font);
    ${TP_TOKEN_VARS}
  }
  #tp-settings-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--tp-line-soft);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tp-txt);
    opacity: 0.6;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  #tp-settings-fab:hover {
    background: rgba(16, 185, 129, 0.95);
    color: #fff;
    transform: scale(1.08);
    opacity: 1;
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.45);
  }
  #tp-settings-fab:focus-visible {
    opacity: 1;
    outline: 2px solid var(--tp-focus);
    outline-offset: 2px;
  }
  #tp-settings-fab svg { width: 24px; height: 24px; }
  dialog#tp-settings-dialog {
    box-sizing: border-box;
    width: 92%;
    max-width: 520px;
    max-height: 85vh;
    background: rgba(255, 255, 255, 0.97);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--tp-line-soft);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border-radius: 16px;
    color: var(--tp-txt);
    padding: 24px;
    margin: auto;
  }
  dialog#tp-settings-dialog::backdrop { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  dialog#tp-settings-dialog h3 {
    margin: 0 0 18px;
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(to right, var(--tp-acc-txt), var(--tp-acc-deep));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  #tp-settings-sections {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 55vh;
    overflow-y: auto;
  }
  .tp-settings-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
  .tp-settings-group label { font-size: 13px; font-weight: 600; color: var(--tp-mut); }
  #tp-section-unified-suite { display: flex; flex-direction: column; gap: 12px; }
  #tp-section-unified-suite label[title], #tp-section-unified-suite button[title] { cursor: help; }
  .tp-glossary-term {
    text-decoration: underline dotted var(--tp-mut) !important;
    text-underline-offset: 3px !important;
    cursor: help !important;
  }
  .tp-section-card { background: rgba(255, 255, 255, 0.65); border: 1px solid var(--tp-line-soft); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .tp-section-card.tp-flash { border-color: var(--tp-blue-soft); box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.45); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
  .tp-section-card .tp-settings-group { margin-bottom: 10px; }
  .tp-section-header { background:none; border:none; padding:4px 0; margin:0; width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; cursor:pointer; font-size:13px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:var(--tp-txt); font-family:inherit; }
  .tp-section-header:focus-visible { outline:2px solid var(--tp-focus); outline-offset:2px; border-radius:6px; }
  .tp-section-header .tp-chevron { color: var(--tp-mut); font-size: 14px; }
  .tp-section-header .tp-chevron::after { content:"▾"; display:inline-block; transition:transform .15s ease; }
  section.tp-collapsed .tp-section-header .tp-chevron::after { transform:rotate(-90deg); }
  section.tp-collapsed .tp-section-body { display:none; }
  .tp-danger-zone { border:1px solid rgba(239,68,68,.45); border-radius:10px; padding:10px 12px; }
  .tp-btn-danger { border:1px solid rgba(239,68,68,.6); color:#b91c1c; background:rgba(239,68,68,.08); }
  .tp-section-card { border-color: var(--tp-line-soft); }
  .tp-field-dark { width: 100%; background: var(--tp-bg); color: var(--tp-txt); border: 1px solid var(--tp-line-soft); border-radius: var(--tp-r-sm); padding: 6px 10px; font-size: var(--tp-fs-md); margin-top: 4px; box-sizing: border-box; }
  select.tp-field-dark { font-size: var(--tp-fs-lg); }
  .tp-field-hint { display: block; margin-top: 4px; font-size: var(--tp-fs-sm); opacity: 0.85; }
  .tp-btn-row { display: flex; flex-direction: row; gap: 8px; }
  .tp-btn-row .tp-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .tp-discord-channels-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .tp-discord-channel-card { background: rgba(0, 0, 0, 0.03); border: 1px solid var(--tp-line-soft); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
  .tp-discord-channel-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .tp-discord-channel-name { font-weight: 600; font-size: 13px; }
  .tp-discord-extra-collapsed { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  #tp-discord-extra-channels { display: flex; flex-direction: column; gap: 8px; }
  #tp-discord-layout-preview { white-space: pre-wrap !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
  #tp-discord-layout-preview .tp-md-lg { font-size: 16px !important; font-weight: 800 !important; }
  #tp-discord-layout-preview .tp-md-md { font-size: 14px !important; font-weight: 800 !important; }
  #tp-discord-layout-preview .tp-md-sm { font-size: 12px !important; font-weight: 700 !important; }
  #tp-discord-layout-preview .tp-md-link { font-weight: 700 !important; }
  #tp-discord-layout-preview .tp-md-url { opacity: .65 !important; font-size: 11px !important; }
  #tp-discord-layout-preview .tp-md-quote { display: block; border-left: 3px solid #5865f2 !important; padding-left: 8px !important; margin: 2px 0 !important; opacity: .9 !important; }
  .tp-settings-subhead {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--tp-mut);
    margin: 16px 0 10px 0;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--tp-line-soft);
  }
  .tp-search-preview-box {
    margin-top: 8px;
    padding: 8px 12px;
    background: rgba(15, 23, 42, 0.04);
    border: 1px dashed var(--tp-line-soft);
    border-radius: var(--tp-r-sm);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tp-search-preview-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--tp-mut);
  }
  .tp-search-preview-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tp-search-preview-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--tp-mut);
  }
  .tp-search-preview-text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
    color: var(--tp-txt);
    word-break: break-word;
    line-height: 1.4;
    background: rgba(0, 0, 0, 0.03);
    padding: 3px 6px;
    border-radius: 4px;
  }
  .tp-search-preview-text.tp-muted {
    color: var(--tp-dim);
    font-size: 11px;
  }
  #tp-import-config-file { display: none; }
  .tp-cache-row { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
  .tp-cache-row #tp-cache-stats-label { font-size: var(--tp-fs-md); opacity: 0.85; }
  .tp-cache-row #tp-cache-clear-btn { padding: 4px 10px; font-size: var(--tp-fs-md); }
  .tp-segmented-control {
    display: flex;
    background: rgba(255,255,255,0.7);
    border-radius: var(--tp-r-md);
    padding: 2px;
    border: 1px solid var(--tp-line-soft);
  }
  .tp-segmented-control label {
    flex: 1;
    text-align: center;
    padding: 7px 10px;
    cursor: pointer;
    font-size: var(--tp-fs-sm);
    font-weight: 600;
    color: var(--tp-mut);
    border-radius: var(--tp-r-sm);
    transition: all 0.2s ease;
  }
  .tp-segmented-control input[type="radio"] { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; opacity: 0; }
  .tp-segmented-control label:hover { color: var(--tp-txt); }
  .tp-segmented-control input[type="radio"]:checked + label {
    background: var(--tp-acc);
    color: #fff;
  }
  .tp-segmented-control-blue input[type="radio"]:checked + label { background: var(--tp-blue) !important; }
  .tp-range-container { display: flex; align-items: center; gap: 12px; }
  .tp-range-container input[type="range"] { flex: 1; accent-color: var(--tp-acc); }
  .tp-range-container.tp-blue input[type="range"] { accent-color: var(--tp-blue); }
  .tp-range-container.tp-rose input[type="range"] { accent-color: var(--tp-rose); }
  .tp-range-container input[type="number"] {
    width: 60px;
    padding: 4px 8px;
    background: rgba(255,255,255,0.75);
    border: 1px solid var(--tp-line-soft);
    border-radius: var(--tp-r-sm);
    color: var(--tp-txt);
    font-size: var(--tp-fs-md);
    text-align: center;
  }
  .tp-textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 70px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.75);
    border: 1px solid var(--tp-line-soft);
    border-radius: var(--tp-r-md);
    color: var(--tp-txt);
    font: inherit;
    font-size: var(--tp-fs-md);
  }
  .tp-switch-container { display: flex; align-items: center; justify-content: space-between; }
  .tp-switch-label { display: flex; flex-direction: column; gap: 2px; }
  .tp-switch-desc { font-size: var(--tp-fs-sm); color: var(--tp-dim); }
  .tp-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
  .tp-switch input { opacity: 0; width: 0; height: 0; }
  .tp-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: rgba(15,23,42,0.12);
    border-radius: 24px;
    border: 1px solid var(--tp-line-soft);
    transition: .3s;
  }
  .tp-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: var(--tp-mut);
    border-radius: 50%;
    transition: .3s;
  }
  .tp-switch input:checked + .tp-slider { background-color: var(--tp-acc); }
  .tp-switch.tp-blue input:checked + .tp-slider { background-color: var(--tp-blue); }
  .tp-switch.tp-rose input:checked + .tp-slider { background-color: var(--tp-rose); }
  .tp-switch.tp-purple input:checked + .tp-slider { background-color: var(--tp-acc2); }
  .tp-switch input:checked + .tp-slider:before { transform: translateX(20px); background-color: #fff; }
  .tp-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(15,23,42,0.08);
  }
  .tp-btn {
    padding: 8px 16px;
    border-radius: var(--tp-r-md);
    font-size: var(--tp-fs-lg);
    font-weight: 600;
    cursor: pointer;
    border: none;
  }
  .tp-btn-secondary { background: rgba(15,23,42,0.06); color: var(--tp-mut); }
  .tp-btn-secondary:hover { background: rgba(15,23,42,0.10); color: var(--tp-txt); }
  .tp-btn-primary {
    background: var(--tp-grad-acc);
    color: #fff;
    box-shadow: 0 4px 12px rgba(16,185,129,0.3);
  }
  #tp-toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100000;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    pointer-events: none;
  }
  .tp-toast {
    background: rgba(255,255,255,0.97);
    pointer-events: none;
    border: 1px solid rgba(56,189,248,0.3);
    color: var(--tp-txt);
    padding: 9px 14px;
    border-radius: var(--tp-r-md);
    font-size: var(--tp-fs-md);
    font-weight: 600;
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 10px;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .tp-toast.fade-out { opacity: 0; transform: translateY(6px); }
  .tp-btn:focus-visible, .tp-field-dark:focus-visible,
  .tp-switch input:focus-visible + .tp-slider,
  .tp-segmented-control input:focus-visible + label { outline: 2px solid var(--tp-focus) !important; outline-offset: 2px !important; }
  @media (prefers-reduced-motion: reduce) {
    #tp-settings-fab, .tp-switch .tp-slider, .tp-switch .tp-slider:before, .tp-segmented-control label, .tp-toast { transition: none !important; }
  }
  @media (prefers-contrast: more) {
    .tp-switch-desc, .tp-section-header, .tp-cache-row #tp-cache-stats-label { opacity: 1 !important; }
    .tp-field-dark { border-width: 2px !important; }
  }
`;

