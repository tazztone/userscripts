/**
 * Toast Notification Component
 * Renders glassmorphic notifications inside Shadow DOM.
 */

import { ensureSkeleton } from './shell.js';

export function showToast(message) {
  const { shadow } = ensureSkeleton();
  const container = shadow?.getElementById('tp-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'tp-toast';
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}
