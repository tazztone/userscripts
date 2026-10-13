/**
 * Fresh-deal glow dismissal.
 * Minimum 5s floor, then the next user input clears the glow.
 */

import { scanState } from '../state/store.js';

let freshTimer = null;
const freshListeners = [];

const FRESH_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

export function markFreshVerified(pid) {
  if (pid) scanState.freshPids.add(pid);
}

function removeFreshListeners() {
  for (const { type, fn } of freshListeners.splice(0)) {
    document.removeEventListener(type, fn);
  }
}

export function clearFresh() {
  scanState.freshPids.clear();
  scanState.freshUntil = 0;
  if (freshTimer) {
    clearTimeout(freshTimer);
    freshTimer = null;
  }
  removeFreshListeners();
  if (typeof document !== 'undefined') {
    for (const card of document.querySelectorAll('.tp-deal-fresh')) {
      card.classList.remove('tp-deal-fresh');
    }
  }
}

function installFreshListeners() {
  removeFreshListeners();
  for (const type of FRESH_EVENTS) {
    const fn = () => clearFresh();
    freshListeners.push({ type, fn });
    document.addEventListener(type, fn, { once: true, passive: true });
  }
}

// Re-arm replaces the old set: call armFreshDismiss() BEFORE marking the new
// pids, then re-render so the render toggle picks up the fresh set.
export function armFreshDismiss() {
  clearFresh();
  if (typeof document === 'undefined') return;
  scanState.freshUntil = Date.now() + 5000;
  freshTimer = setTimeout(installFreshListeners, 5000);
}
