/**
 * Toast Notification Component
 * Renders glassmorphic notifications with optional undo actions inside Shadow DOM.
 */

import { ensureSkeleton, getUiShadowRoot } from './modal.js';

export function showToast(message, durationMs = 2500, actionLabel = null, onAction = null) {
  ensureSkeleton();
  const shadow = getUiShadowRoot?.() || (typeof uiShadowRoot !== 'undefined' ? uiShadowRoot : null);
  const container = shadow?.getElementById('tp-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'tp-toast';
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (actionLabel && typeof onAction === 'function') {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'tp-toast-undo';
    actionBtn.textContent = actionLabel;
    actionBtn.onclick = e => {
      e.stopPropagation();
      toast.remove();
      onAction();
    };
    toast.appendChild(actionBtn);
  }

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, durationMs);
}
