/**
 * Floating Check-Deals CTA Component
 * Primary one-click entry point for Tiefstpreis verification.
 *
 * Why this exists: the toolbar packs ~8 controls into one row (filter + view
 * + deals groups) and the highest-value action — verifying N unchecked
 * deals — drowns at the far right as just another small button. This
 * floating pill (bottom-left, thumb-reachable, above page content but clear
 * of the bottom-right settings FAB) carries that single action with live
 * progress, threshold selection, and session collapse (minimizable, never
 * fully closable — the primary action must stay one click away). The pill
 * never auto-hides on empty: with 0 deals left it stays visible in dimmed
 * form (grey instead of green) so users always find it in the same spot.
 *
 * Architecture: create-once + sync. The node is built and bound exactly
 * once (listeners never re-attached); every render only updates textContent
 * / classes when changed, so focus and in-flight scan callbacks survive
 * re-renders. Pure label logic lives in ctaStateFor() for unit testing
 * without a DOM.
 */

import { CONFIG, updateConfig } from "../state/config.js";
import { scanState } from "../state/store.js";
import {
  runBatchDealCheck,
  cancelBatchDealCheck
} from "../scanner/scanner.js";
import { setTextIfChanged } from "./badges.js";
import { showToast } from "./toast.js";
import { triggerProcessListings } from "../page/adapter.js";

export const FLOATING_CTA_ID = 'tp-floating-check-cta';
export const THRESHOLD_OPTIONS = [20, 30, 40, 50, 60];

let collapsedForSession = false;
let lastCounts = { uncheckedDeals: 0 };
let lastIsDealFeed = false;

/**
 * Pure label state machine (no DOM): idle → scanning → done (empty).
 * The done state keeps the action name with a 0 count so the CTA never
 * disappears — syncFloatingCTA dims it via the .tp-empty class instead.
 * Unit-tested in tests/unit/floating-cta.test.js.
 */
export function ctaStateFor({ unchecked = 0, isScanning = false, completed = 0, total = 0 } = {}) {
  if (isScanning) {
    const progress = total > 0 ? ` (${completed}/${total})` : '';
    return { mode: 'scanning', mainLabel: `⏳ Prüfe${progress}`, subLabel: 'Klicken = Abbrechen' };
  }
  if (unchecked > 0) {
    const obj = unchecked === 1 ? 'Tiefstpreis' : 'Tiefstpreise';
    return { mode: 'idle', mainLabel: `🔍 ${unchecked} ${obj} prüfen`, subLabel: 'Echte Tiefstpreise verifizieren' };
  }
  return { mode: 'done', mainLabel: '🔍 0 Tiefstpreise prüfen', subLabel: 'Alle Deals verifiziert' };
}


export function hideFloatingCTA() {
  if (typeof document === 'undefined') return;
  // Stylesheet pins display:flex !important (host-site override convention),
  // so hiding must go through the .tp-hidden class, not an inline style.
  // The scanning marker is cleared too: hidden implies nothing to show, and
  // syncFloatingCTA re-applies it whenever a scan is actually running.
  const el = document.getElementById(FLOATING_CTA_ID);
  if (!el) return;
  el.classList.add('tp-hidden');
  el.classList.remove('tp-scanning');
}

/**
 * Entry point for starting (or cancelling) a batch check from any UI surface:
 * the CTA main button, the empty-state notice, or tests. Clicking the dimmed
 * empty CTA toasts instead of scanning (unchecked <= 0 guard below).
 */
export function startBatchCheck() {
  const { isBatchChecking } = scanState;
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
  // Progress + cancel live in the expanded form — a check always expands.
  setCollapsed(false);
  runBatchDealCheck(
    minDisc,
    () => syncFloatingCTA(),
    (completed, total) => {
      if (total > 0) showToast(`${completed} Tiefstpreise verifiziert`);
      else showToast('Keine ungeprüften Deals vorhanden');
      // Recompute counts → CTA flips to its dimmed empty form when nothing is left.
      triggerProcessListings();
    }
  );
  syncFloatingCTA();
}

function setCollapsed(collapsed) {
  collapsedForSession = !!collapsed;
  if (typeof document === 'undefined') return;
  if (collapsedForSession) {
    document.getElementById(FLOATING_CTA_ID)
      ?.querySelector('#tp-floating-threshold-popover')?.classList.remove('tp-show');
  }
  syncFloatingCTA();
}

function onMainClick() {
  // The collapsed pill is an expand affordance, never a check trigger:
  // the primary action must stay deliberate, not accidental.
  if (collapsedForSession) {
    setCollapsed(false);
    return;
  }
  startBatchCheck();
}

function onCollapseToggle() {
  setCollapsed(!collapsedForSession);
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
    <div id="tp-floating-check-col">
      <button type="button" id="tp-floating-check-btn" title="Echte Allzeit-Tiefstpreise prüfen (Toppreise-Rabatt ist ungeprüft)">
        <span id="tp-floating-check-main">🔍 Tiefstpreise prüfen</span>
        <span id="tp-floating-check-sub">Echte Tiefstpreise verifizieren</span>
        <span id="tp-floating-check-count">🔍</span>
      </button>
      <div id="tp-floating-action-row">
        <label id="tp-floating-dealer-row" title="Günstigste Händler beim Prüfen automatisch mitladen (max. 3 parallel, auch in den Einstellungen)">
          <input type="checkbox" id="tp-floating-dealer-toggle">
          <span>🏬 Händler laden</span>
        </label>
        <button type="button" id="tp-floating-threshold-btn" title="Nur Differenzen ab diesem Wert prüfen">≥30% ▾</button>
        <button type="button" id="tp-floating-cta-collapse" title="Minimieren">«</button>
      </div>
    </div>
    <div id="tp-floating-threshold-popover" role="menu">
      <div class="tp-floating-hint">Nur Differenz ≥ … wird geprüft</div>
    </div>
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
      showToast(`Nur Differenzen ab ${val}% werden geprüft`);
      syncFloatingCTA();
    };
    popover.appendChild(opt);
  }

  el.querySelector('#tp-floating-check-btn').onclick = onMainClick;
  el.querySelector('#tp-floating-cta-collapse').onclick = onCollapseToggle;

  const threshBtn = el.querySelector('#tp-floating-threshold-btn');
  threshBtn.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    popover.classList.toggle('tp-show');
  };
  // Scan-Begleiter (gleicher Schalter wie im Feintuning): Händler beim
  // Verifizieren automatisch mitladen — updateConfig syncet das Modal mit.
  el.querySelector('#tp-floating-dealer-toggle').onchange = e => {
    const next = e.target.checked;
    updateConfig('DEALER_AUTOFETCH', next);
    showToast(next ? '🏬 Händler werden beim Prüfen automatisch geladen' : '🏬 Händler nur noch per Klick laden');
  };

  if (!window._tpFloatingCtaDocBound) {
    window._tpFloatingCtaDocBound = true;
    document.addEventListener('click', e => {
      if (!e.isTrusted) return; // Synthetic clicks (price-alarm auto-submit) must not dismiss the popover.
      const cta = document.getElementById(FLOATING_CTA_ID);
      if (cta && !cta.contains(e.target)) {
        cta.querySelector('#tp-floating-threshold-popover')?.classList.remove('tp-show');
      }
    });
  }

  document.body.appendChild(el);
  return el;
}

function syncFloatingCTA() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(FLOATING_CTA_ID);
  if (!el) return;
  const state = scanState;
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
  // Empty (0 deals) stays visible but dimmed via .tp-empty (grey instead of
  // green) — the CTA must never disappear, only de-emphasize.
  el.classList.toggle('tp-empty', mode === 'done');
  // Collapsed form: compact count instead of labels, flipped chevron.
  // The count keeps working as a progress signal mid-scan.
  el.classList.toggle('tp-collapsed', collapsedForSession);
  const completed = state.progress?.completed || 0;
  const total = state.progress?.total || 0;
  setTextIfChanged(
    el.querySelector('#tp-floating-check-count'),
    mode === 'scanning' ? (total > 0 ? `⏳${completed}/${total}` : '⏳') : `🔍 ${unchecked}`
  );
  const collapseBtn = el.querySelector('#tp-floating-cta-collapse');
  setTextIfChanged(collapseBtn, collapsedForSession ? '»' : '«');
  collapseBtn.title = collapsedForSession ? 'Erweitern' : 'Minimieren';

  const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
  const threshBtn = el.querySelector('#tp-floating-threshold-btn');
  // Threshold is a deal-feed concept (mirrors the old toolbar behavior):
  // on catalog pages only the check action itself is offered.
  if (lastIsDealFeed) {
    threshBtn.style.display = '';
  } else {
    threshBtn.style.display = 'none';
    el.querySelector('#tp-floating-threshold-popover')?.classList.remove('tp-show');
  }
  setTextIfChanged(threshBtn, `≥${minDisc}% ▾`);
  threshBtn.title = lastIsDealFeed
    ? `Nur Differenzen ≥ ${minDisc}% werden geprüft (ungeprüft ≠ Tiefstpreis)`
    : `Nur Produkte mit Differenz ≥ ${minDisc}% werden geprüft`;
  el.querySelectorAll('.tp-floating-option').forEach(opt => {
    opt.classList.toggle('tp-selected', parseInt(opt.dataset.val, 10) === minDisc);
  });
  const dealerToggle = el.querySelector('#tp-floating-dealer-toggle');
  if (dealerToggle && document.activeElement !== dealerToggle) {
    dealerToggle.checked = CONFIG.DEALER_AUTOFETCH === true;
  }
  el.querySelector('#tp-floating-dealer-row')?.classList.toggle('tp-active', CONFIG.DEALER_AUTOFETCH === true);
}

/**
 * Create-once, then sync. The pill always stays visible on listing pages —
 * with 0 deals left it renders dimmed (see .tp-empty), never hidden.
 * hideFloatingCTA is reserved for non-list contexts (product detail,
 * zero cards). Collapse state is sticky within the session.
 */
export function renderFloatingCTA(counts = {}, isDealFeed = false) {
  if (typeof document === 'undefined') return;
  lastCounts = counts || { uncheckedDeals: 0 };
  lastIsDealFeed = !!isDealFeed;
  ensureCta();
  syncFloatingCTA();
}
