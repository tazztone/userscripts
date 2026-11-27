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

import { CONFIG, updateConfig, realDealMinDiscount } from "../state/config.js";
import { scanState } from "../state/store.js";
import {
  runBatchDealCheck,
  cancelBatchDealCheck
} from "../scanner/scanner.js";
import { setTextIfChanged, setHtmlIfChanged } from "./badges.js";
import { showToast } from "./toast.js";
import { triggerProcessListings } from "../page/adapter.js";
import { markFreshVerified } from "./fresh-glow.js";
import { getCardProductId } from "../page/cards.js";
import { refreshFeed, isFeedRefreshing, cancelFeedRefresh, getFeedRefreshState } from "../page/feed-refresh.js";
import { getBatchScopeCounts } from "../features/batch-actions.js";
import { getActiveBatchJob } from "../features/batch-runners.js";
import { toggleBatchPopover, closeBatchPopover, syncBatchPopover } from "./batch-popover.js";

export const FLOATING_CTA_ID = 'tp-floating-check-cta';

let collapsedForSession = false;
let lastCounts = { uncheckedDeals: 0 };
let lastIsDealFeed = false;
let lastBatchCounts = null;

/**
 * Pure label state machine (no DOM): idle → scanning → refreshing → done (empty).
 * The done state keeps the action name with a 0 count so the CTA never
 * disappears — syncFloatingCTA dims it via the .tp-empty class instead.
 * Unit-tested in tests/unit/floating-cta.test.js.
 */
export function ctaStateFor({
  unchecked = 0,
  isScanning = false,
  isRefreshing = false,
  completed = 0,
  total = 0,
  refreshStage = null,
  refreshElapsedSec = 0,
} = {}) {
  if (isScanning) {
    const progress = total > 0 ? ` (${completed}/${total})` : '';
    return { mode: 'scanning', mainLabel: `⏳ Prüfe${progress}`, subLabel: 'Klicken = Abbrechen' };
  }
  if (isRefreshing) {
    if (refreshStage == null && refreshElapsedSec === 0) {
      return { mode: 'refreshing', mainLabel: '⏳ Suche neue Deals...', subLabel: 'Feed wird aktualisiert' };
    }
    const mainLabel = refreshElapsedSec >= 1 ? `⏳ Suche… (${refreshElapsedSec}s)` : '⏳ Suche neue Deals...';
    const stageLabel = refreshStage === 'parsing'
      ? 'Verarbeite...'
      : refreshStage === 'reconciling'
        ? 'Gleiche ab...'
        : 'Feed wird aktualisiert';
    return { mode: 'refreshing', mainLabel, subLabel: `${stageLabel} · Klicken = Abbrechen` };
  }
  if (unchecked > 0) {
    const obj = unchecked === 1 ? 'Tiefstpreis' : 'Tiefstpreise';
    return { mode: 'idle', mainLabel: `🔍 ${unchecked} ${obj} prüfen`, subLabel: 'Echte Tiefstpreise verifizieren' };
  }
  return { mode: 'done', mainLabel: '🔍 0 Tiefstpreise prüfen', subLabel: 'Alle geprüft' };
}

/**
 * Pure completion toast message generator (no DOM).
 * Formats verified vs rejected counts after a batch check.
 * Unit-tested in tests/unit/floating-cta.test.js.
 */
export function batchCompletionToast({ completed = 0, total = 0, fresh = 0, checked = 0, unchecked = 0, minDisc = 30 } = {}) {
  const scanned = completed > 0 ? completed : total;
  if (scanned > 0) {
    const rejected = Math.max(0, scanned - fresh);
    if (fresh > 0) {
      if (rejected > 0) {
        return `${fresh} verifiziert · ${rejected} verworfen`;
      }
      return fresh === 1 ? '1 Tiefstpreis verifiziert' : `${fresh} Tiefstpreise verifiziert`;
    }
    return checked > 0 ? `Keine Tiefstpreise dabei · ${scanned} verworfen` : 'Keine Prüfung möglich';
  }
  return unchecked > 0 ? `Keine Deals ab ≥${minDisc}% zum Prüfen` : 'Keine ungeprüften Deals vorhanden';
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
  closeBatchPopover();
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
  if (isFeedRefreshing()) {
    cancelFeedRefresh();
    showToast('Feed-Aktualisierung abgebrochen');
    syncFloatingCTA();
    return;
  }
  const unchecked = lastCounts.uncheckedDeals || 0;
  if (unchecked <= 0) {
    if (!lastIsDealFeed) {
      showToast('Keine ungeprüften Produkte auf dieser Seite');
      return;
    }
    refreshFeed({ onStart: syncFloatingCTA, onProgress: syncFloatingCTA, onEnd: syncFloatingCTA });
    return;
  }
  const minDisc = realDealMinDiscount();
  // Progress + cancel live in the expanded form — a check always expands.
  setCollapsed(false);
  runBatchDealCheck(
    minDisc,
    () => syncFloatingCTA(),
    (completed, total, newlyVerified, meta) => {
      for (const item of newlyVerified || []) markFreshVerified(item.pid);
      // Recompute counts → CTA flips to its dimmed empty form when nothing is left.
      triggerProcessListings();
      if (meta?.abortedByCooldown) return;
      const fresh = new Set(Array.from(document.querySelectorAll('.tp-deal-fresh'), el => getCardProductId(el)).filter(Boolean)).size;
      const checked = (newlyVerified || []).length;
      showToast(batchCompletionToast({ completed, total, fresh, checked, unchecked, minDisc }));
    }
  );
  syncFloatingCTA();
}

function setCollapsed(collapsed) {
  collapsedForSession = !!collapsed;
  if (collapsedForSession) closeBatchPopover();
  if (typeof document === 'undefined') return;
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
      <button type="button" id="tp-floating-check-btn" title="Differenzen anhand der Historie prüfen (ungeprüft ≠ Tiefstpreis)">
        <span id="tp-floating-check-labels">
          <span id="tp-floating-check-main">🔍 Tiefstpreise prüfen</span>
          <span id="tp-floating-check-sub">Echte Tiefstpreise verifizieren</span>
        </span>
        <span id="tp-floating-check-count">🔍</span>
      </button>
    </div>
    <button type="button" id="tp-floating-batch-btn" aria-expanded="false" aria-haspopup="true" title="Batch-Aktionen für gelistete Angebote">⚡ <span id="tp-floating-batch-count">0</span> <span class="tp-batch-caret">▴</span></button>
    <button type="button" id="tp-floating-refresh-btn" class="tp-floating-refresh-btn" title="Feed nach neuen Deals durchsuchen" aria-label="Feed aktualisieren">🔄</button>
    <input type="text" id="tp-floating-threshold-input" inputmode="numeric" size="4" title="Nur Differenzen ab Schwelle prüfen (z.B. 20%)" aria-label="Mindestrabatt in Prozent" autocomplete="off" spellcheck="false">
    <button type="button" id="tp-floating-cta-collapse" title="Minimieren">«</button>
  `;

  el.querySelector('#tp-floating-check-btn').onclick = onMainClick;
  el.querySelector('#tp-floating-cta-collapse').onclick = onCollapseToggle;
  const refreshBtnEl = el.querySelector('#tp-floating-refresh-btn');
  if (refreshBtnEl) {
    refreshBtnEl.onclick = () => {
      refreshFeed({ onStart: syncFloatingCTA, onProgress: syncFloatingCTA, onEnd: syncFloatingCTA });
    };
  }

  const threshInput = el.querySelector('#tp-floating-threshold-input');
  if (threshInput) {
    const commitThreshold = () => {
      const raw = threshInput.value.trim();
      const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10);
      const current = realDealMinDiscount();
      if (Number.isFinite(parsed)) {
        const nextVal = Math.max(0, Math.min(90, parsed));
        if (nextVal !== current) {
          updateConfig('REAL_DEAL_MIN_DISCOUNT', nextVal);
          showToast(`Nur Differenzen ab ${nextVal}% werden geprüft`);
          triggerProcessListings();
          syncFloatingCTA();
          return;
        }
      }
      threshInput.value = `≥${current}%`;
    };

    threshInput.onfocus = () => {
      threshInput.select();
    };
    threshInput.onkeydown = e => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        threshInput.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        threshInput.value = `≥${realDealMinDiscount()}%`;
        threshInput.blur();
      }
    };
    threshInput.onkeyup = e => e.stopPropagation();
    threshInput.onchange = () => commitThreshold();
    threshInput.onblur = () => commitThreshold();
  }
  el.querySelector('#tp-floating-batch-btn').onclick = () => toggleBatchPopover();

  document.body.appendChild(el);
  return el;
}

function syncFloatingCTA(precomputedBatchCounts = undefined) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(FLOATING_CTA_ID);
  if (!el) return;
  const state = scanState;
  const unchecked = lastCounts.uncheckedDeals || 0;
  const refreshing = isFeedRefreshing();
  const refreshState = refreshing ? getFeedRefreshState() : null;
  const { mainLabel, subLabel, mode } = ctaStateFor({
    unchecked,
    isScanning: state.isBatchChecking,
    isRefreshing: refreshing,
    completed: state.progress?.completed || 0,
    total: state.progress?.total || 0,
    refreshStage: refreshState?.stage ?? null,
    refreshElapsedSec: refreshState?.elapsedSec ?? 0,
  });

  const countMatch = mainLabel.match(/^🔍\s*(\d+)\s+Tiefstpreis/);
  if (countMatch) {
    const count = countMatch[1];
    setHtmlIfChanged(
      el.querySelector('#tp-floating-check-main'),
      `<span class="tp-label-full">${mainLabel}</span><span class="tp-label-short">🔍 ${count} prüfen</span>`
    );
  } else {
    setTextIfChanged(el.querySelector('#tp-floating-check-main'), mainLabel);
  }
  const subEl = el.querySelector('#tp-floating-check-sub');
  setTextIfChanged(subEl, subLabel);
  subEl.style.display = subLabel ? 'block' : 'none';
  el.classList.toggle('tp-scanning', mode === 'scanning');
  el.classList.toggle('tp-refreshing', mode === 'refreshing');
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
    mode === 'scanning'
      ? (total > 0 ? `⏳${completed}/${total}` : '⏳')
      : (mode === 'refreshing'
        ? (refreshState?.elapsedSec >= 1 ? `⏳${refreshState.elapsedSec}s` : '⏳')
        : `🔍 ${unchecked}`)
  );
  const refreshBtn = el.querySelector('#tp-floating-refresh-btn');
  if (refreshBtn) {
    refreshBtn.classList.toggle('tp-spinning', refreshing);
    refreshBtn.disabled = refreshing;
    refreshBtn.style.setProperty('display', lastIsDealFeed ? '' : 'none', 'important');
  }
  const collapseBtn = el.querySelector('#tp-floating-cta-collapse');
  setTextIfChanged(collapseBtn, collapsedForSession ? '»' : '«');
  collapseBtn.title = collapsedForSession ? 'Erweitern' : 'Minimieren';

  const minDisc = realDealMinDiscount();
  const threshInput = el.querySelector('#tp-floating-threshold-input');
  if (threshInput) {
    // Threshold is a deal-feed concept (mirrors the old toolbar behavior):
    // on catalog pages only the check action itself is offered.
    if (lastIsDealFeed) {
      threshInput.style.removeProperty('display');
    } else {
      threshInput.style.setProperty('display', 'none', 'important');
    }
    if (document.activeElement !== threshInput) {
      threshInput.value = `≥${minDisc}%`;
    }
    threshInput.title = lastIsDealFeed
      ? `Nur Differenzen ≥ ${minDisc}% prüfen (ungeprüft ≠ Tiefstpreis)`
      : `Nur Produkte mit Differenz ≥ ${minDisc}% prüfen`;
  }
  const counts = (precomputedBatchCounts && typeof precomputedBatchCounts['non-dimmed'] === 'number')
    ? precomputedBatchCounts
    : (lastBatchCounts || getBatchScopeCounts());
  const batchBtnEl = el.querySelector('#tp-floating-batch-btn');
  const batchCountEl = el.querySelector('#tp-floating-batch-count');
  const activeBatch = getActiveBatchJob();
  if (batchBtnEl) batchBtnEl.classList.toggle('tp-batch-running', !!activeBatch);
  if (batchCountEl) {
    if (activeBatch) {
      setTextIfChanged(batchCountEl, `⏳ ${activeBatch.done}/${activeBatch.total}`);
    } else {
      const scopeKey = CONFIG.BATCH_SCOPE_DEFAULT || 'non-dimmed';
      setTextIfChanged(batchCountEl, String(counts[scopeKey] ?? 0));
    }
  }
  syncBatchPopover(counts);
}

/**
 * Create-once, then sync. The pill always stays visible on listing pages —
 * with 0 deals left it renders dimmed (see .tp-empty), never hidden.
 * hideFloatingCTA is reserved for non-list contexts (product detail,
 * zero cards). Collapse state is sticky within the session.
 */
export function renderFloatingCTA(counts = {}, isDealFeed = false, batchCounts = null) {
  if (typeof document === 'undefined') return;
  lastCounts = counts || { uncheckedDeals: 0 };
  lastIsDealFeed = !!isDealFeed;
  lastBatchCounts = batchCounts || null;
  ensureCta();
  syncFloatingCTA(batchCounts);
}
