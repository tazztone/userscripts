/**
 * Floating Check-Deals CTA Component
 * Primary one-click entry point for Tiefstpreis verification.
 *
 * Why this exists: the toolbar packs ~8 controls into one row (FILTER |
 * ANSICHT | DEALS) and the highest-value action — verifying N unchecked
 * deals — drowns at the far right as just another small button. This
 * floating pill (bottom-left, thumb-reachable, above page content but clear
 * of the bottom-right settings FAB) carries that single action with live
 * progress, threshold selection, and session dismiss + undo.
 *
 * Architecture: create-once + sync. The node is built and bound exactly
 * once (listeners never re-attached); every render only updates textContent
 * / classes when changed, so focus and in-flight scan callbacks survive
 * re-renders. Pure label logic lives in ctaStateFor() for unit testing
 * without a DOM.
 */

import { CONFIG, updateConfig } from "../state/config.js";
import { getScanState } from "../state/store.js";
import {
  runBatchDealCheck,
  cancelBatchDealCheck
} from "../scanner/scanner.js";
import { showToast } from "./toast.js";
import { triggerProcessListings } from "../page/adapter.js";

export const FLOATING_CTA_ID = 'tp-floating-check-cta';
export const THRESHOLD_OPTIONS = [20, 30, 40, 50, 60];

let dismissedForSession = false;
let lastCounts = { uncheckedDeals: 0 };
let lastIsDealFeed = false;

/**
 * Pure label state machine (no DOM): idle → scanning → done.
 * Unit-tested in tests/unit/floating-cta.test.js.
 */
export function ctaStateFor({ unchecked = 0, isScanning = false, completed = 0, total = 0 } = {}) {
  if (isScanning) {
    const progress = total > 0 ? ` (${completed}/${total})` : '';
    return { mode: 'scanning', mainLabel: `⏳ Prüfe${progress}`, subLabel: 'Klicken = Abbrechen' };
  }
  if (unchecked > 0) {
    const plural = unchecked === 1 ? 'Deal' : 'Deals';
    return { mode: 'idle', mainLabel: `🔍 ${unchecked} ${plural} prüfen`, subLabel: 'Echte Tiefstpreise verifizieren' };
  }
  return { mode: 'done', mainLabel: '✅ Alle geprüft', subLabel: '' };
}

export function isFloatingCtaDismissed() {
  return dismissedForSession;
}

export function hideFloatingCTA() {
  if (typeof document === 'undefined') return;
  // Stylesheet pins display:flex !important (host-site override convention),
  // so hiding must go through the .tp-hidden class, not an inline style.
  document.getElementById(FLOATING_CTA_ID)?.classList.add('tp-hidden');
}

function setTextIfChanged(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function onMainClick() {
  const { isBatchChecking } = getScanState();
  if (isBatchChecking) {
    cancelBatchDealCheck();
    showToast('Batch-Prüfung abgebrochen');
    syncFloatingCTA();
    return;
  }
  const unchecked = lastCounts.uncheckedDeals || 0;
  if (unchecked <= 0) {
    showToast('Keine ungeprüften Deals vorhanden');
    return;
  }
  const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
  runBatchDealCheck(
    minDisc,
    () => syncFloatingCTA(),
    (completed, total) => {
      if (total > 0) showToast(`${completed} Deal-Tiefstpreise verifiziert`);
      else showToast('Keine ungeprüften Deals vorhanden');
      // Recompute counts → auto-hides the CTA when nothing is left.
      triggerProcessListings();
    },
    () => syncFloatingCTA()
  );
  syncFloatingCTA();
}

function onDismiss() {
  dismissedForSession = true;
  hideFloatingCTA();
  showToast('Check-Deals-Button ausgeblendet', 4000, 'Rückgängig', () => {
    dismissedForSession = false;
    renderFloatingCTA(lastCounts, lastIsDealFeed);
  });
}

function ensureCta() {
  let el = document.getElementById(FLOATING_CTA_ID);
  if (el) {
    el.classList.remove('tp-hidden');
    return el;
  }
  el = document.createElement('div');
  el.id = FLOATING_CTA_ID;
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Tiefstpreise prüfen');
  el.innerHTML = `
    <button type="button" id="tp-floating-check-btn" title="Echte Allzeit-Tiefstpreise prüfen (Toppreise-Rabatt ist ungeprüft)">
      <span id="tp-floating-check-main">🔍 Deals prüfen</span>
      <span id="tp-floating-check-sub">Echte Tiefstpreise verifizieren</span>
    </button>
    <button type="button" id="tp-floating-threshold-btn" title="Nur Deals ab diesem Toppreise-Rabatt prüfen">≥30% ▾</button>
    <div id="tp-floating-threshold-popover" role="menu">
      <div class="tp-floating-hint">Nur Toppreise-Rabatt ≥ … wird geprüft</div>
    </div>
    <button type="button" id="tp-floating-cta-dismiss" title="Ausblenden (bis Seiten-Reload)">✕</button>
  `;
  const popover = el.querySelector('#tp-floating-threshold-popover');
  for (const val of THRESHOLD_OPTIONS) {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'tp-floating-option';
    opt.dataset.val = String(val);
    opt.setAttribute('role', 'menuitem');
    opt.textContent = `≥ ${val}%`;
    opt.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      popover.classList.remove('tp-show');
      updateConfig('REAL_DEAL_MIN_DISCOUNT', val);
      showToast(`Nur Deals ab ${val}% Toppreise-Rabatt werden geprüft`);
      syncFloatingCTA();
    };
    popover.appendChild(opt);
  }

  el.querySelector('#tp-floating-check-btn').onclick = onMainClick;
  el.querySelector('#tp-floating-cta-dismiss').onclick = onDismiss;

  const threshBtn = el.querySelector('#tp-floating-threshold-btn');
  threshBtn.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    popover.classList.toggle('tp-show');
  };

  if (!window._tpFloatingCtaDocBound) {
    window._tpFloatingCtaDocBound = true;
    document.addEventListener('click', e => {
      const cta = document.getElementById(FLOATING_CTA_ID);
      if (cta && !cta.contains(e.target)) {
        cta.querySelector('#tp-floating-threshold-popover')?.classList.remove('tp-show');
      }
    });
  }

  document.body.appendChild(el);
  return el;
}

export function syncFloatingCTA() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(FLOATING_CTA_ID);
  if (!el) return;
  const state = getScanState();
  const unchecked = lastCounts.uncheckedDeals || 0;
  const { mainLabel, subLabel, mode } = ctaStateFor({
    unchecked,
    isScanning: state.isBatchChecking,
    completed: state.progress?.completed || 0,
    total: state.progress?.total || 0
  });

  setTextIfChanged(el.querySelector('#tp-floating-check-main'), mainLabel);
  const subEl = el.querySelector('#tp-floating-check-sub');
  setTextIfChanged(subEl, subLabel);
  subEl.style.display = subLabel ? 'block' : 'none';
  el.classList.toggle('tp-scanning', mode === 'scanning');

  const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
  const threshBtn = el.querySelector('#tp-floating-threshold-btn');
  setTextIfChanged(threshBtn, `≥${minDisc}% ▾`);
  threshBtn.title = lastIsDealFeed
    ? `Nur Deals mit Toppreise-Rabatt ≥ ${minDisc}% werden geprüft (ungeprüft ≠ Tiefstpreis)`
    : `Nur Produkte mit Toppreise-Rabatt ≥ ${minDisc}% werden geprüft`;
  el.querySelectorAll('.tp-floating-option').forEach(opt => {
    opt.classList.toggle('tp-selected', parseInt(opt.dataset.val, 10) === minDisc);
  });
}

/**
 * Create-once, then sync. Hides itself when dismissed for the session or
 * when there is nothing left to check (and no scan is running).
 */
export function renderFloatingCTA(counts = {}, isDealFeed = false) {
  if (typeof document === 'undefined') return;
  lastCounts = counts || { uncheckedDeals: 0 };
  lastIsDealFeed = !!isDealFeed;
  if (dismissedForSession) {
    hideFloatingCTA();
    return;
  }
  const { isBatchChecking } = getScanState();
  if (!isBatchChecking && (lastCounts.uncheckedDeals || 0) <= 0) {
    hideFloatingCTA();
    return;
  }
  ensureCta();
  syncFloatingCTA();
}
