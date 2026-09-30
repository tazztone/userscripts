/**
 * Shadow DOM Shell
 * Owns the shared `#tp-root` shadow host: skeleton markup (FAB, dialog shell,
 * toast container), styles, and the live shadow-root binding. Imported by
 * modal, toast, and config — one-directional, no cycles.
 */

import { SHADOW_MODAL_STYLES } from "./styles.js";

export let uiShadowRoot = null;
export function getUiShadowRoot() {
  return uiShadowRoot;
}

export function ensureSkeleton() {
  let host = document.getElementById('tp-root');
  if (!host) {
    host = document.createElement('div');
    host.id = 'tp-root';
    document.body.appendChild(host);
  }
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  uiShadowRoot = shadow;

  if (!shadow.getElementById('tp-settings-fab')) {
    shadow.innerHTML = `
      <style>${SHADOW_MODAL_STYLES}</style>
      <button id="tp-settings-fab" type="button" title="Toppreise Suite Einstellungen öffnen" aria-label="Toppreise Suite Einstellungen">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      <dialog id="tp-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="tp-settings-title">
        <h3 id="tp-settings-title">Toppreise Suite Einstellungen</h3>
        <div id="tp-settings-sections"></div>
        <div class="tp-modal-actions">
          <button type="button" class="tp-btn tp-btn-secondary" id="tp-btn-close">Abbrechen</button>
          <button type="button" class="tp-btn tp-btn-primary" id="tp-btn-save">Speichern</button>
        </div>
      </dialog>
      <div id="tp-toast-container"></div>
    `;
  }
  return { shadow };
}
