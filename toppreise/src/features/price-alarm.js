/**
 * Price Alarm Automation Feature
 * Automates the Toppreise price alarm popup dialog:
 * calculates discount target, configures alert duration, accepts terms,
 * and submits automatically when configured.
 * Also paints the native bell trigger with the 3-state auto-fill mode
 * (off / fill-only / auto-submit) plus a cog jumping to its settings.
 */

import { CONFIG, setAlarmConfigListener } from '../state/config.js';
import { openSettingsAt } from '../ui/modal.js';
import { parsePrice } from '../domain/price.js';
import { isShippingPriceActive } from '../page/adapter.js';

const ALARM_DURATIONS = ['90', '180', '365', '730'];
const DURATION_LABELS = { 90: '3 Monate', 180: '6 Monate', 365: '1 Jahr', 730: '2 Jahre' };
export const clampAlarmTarget = v =>
  (Number.isFinite(v) ? Math.min(0.99, Math.max(0.05, v)) : 0.60);
export const normalizeAlarmDuration = v => {
  const s = String(v);
  return ALARM_DURATIONS.includes(s) ? s : '730';
};
// Live bell trigger (confirmed 2026-10-11 on search + product pages):
// `.Plugin_NewInfoMailButton` container, clickable bell is
// `a.f_showNewInfoMailFormDialog` with a `TPIcons-alarm` icon. Every match
// is painted: product pages render hidden per-offer bells alongside the
// visible header bell, and first-match-only left the visible ones unpainted.
// Silent no-op when absent.
const ALARM_BELL_SELECTORS = [
  '#mock-alarm-bell',
  '.Plugin_NewInfoMailButton a.f_showNewInfoMailFormDialog',
  '.Plugin_NewInfoMailButton a',
  'a[href*="NewInfoMail"]',
  '.tp-card-alarm-btn',
];
const BELL_STYLE_ID = 'tp-alarm-bell-style';

const alarmBellState = () => {
  if (CONFIG.ALARM_ENABLED === false) return 'off';
  return CONFIG.ALARM_AUTO_SUBMIT === false ? 'fill' : 'auto';
};

const findAlarmBells = () => {
  const seen = new Set();
  for (const sel of ALARM_BELL_SELECTORS)
    for (const el of document.querySelectorAll(sel))
      if (!seen.has(el)) seen.add(el);
  return [...seen];
};

function ensureAlarmBellStyle() {
  if (document.getElementById(BELL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BELL_STYLE_ID;
  style.textContent = [
    '.tp-alarm-off{opacity:.45 !important;}',
    '.tp-alarm-fill,.tp-alarm-auto{position:relative !important;outline:2px solid #3b82f6 !important;outline-offset:2px;border-radius:4px;}',
    '.tp-alarm-auto::after{content:"\\26A1";position:absolute;top:-10px;right:-10px;font-size:12px;line-height:1;}',
    '.tp-alarm-cog{margin-left:6px;padding:0 4px;border:none;background:transparent;color:inherit;font-size:14px;line-height:1;cursor:pointer;opacity:.75;}',
    '.tp-alarm-cog:hover{opacity:1;}',
  ].join('\n');
  document.head.appendChild(style);
}

function ensureAlarmCog(bell) {
  // One cog per bell: the site may insert nodes between bell and cog on
  // re-render, so a next-sibling check alone stacks duplicates flanking
  // the newcomer. Scan to the next bell, keep the first cog, drop extras.
  const BELL_SEL = ALARM_BELL_SELECTORS.join(',');
  let first = null;
  let sib = bell.nextElementSibling;
  while (sib && !sib.matches?.(BELL_SEL)) {
    const nxt = sib.nextElementSibling;
    if (sib.classList?.contains('tp-alarm-cog')) {
      if (!first) first = sib;
      else sib.remove();
    }
    sib = nxt;
  }
  if (first) {
    if (first !== bell.nextElementSibling) bell.after(first);
    return first;
  }
  const cog = document.createElement('button');
  cog.type = 'button';
  cog.className = 'tp-alarm-cog';
  cog.textContent = '⚙';
  cog.title = 'Preisalarm-Einstellungen';
  cog.setAttribute('aria-label', 'Preisalarm-Einstellungen');
  cog.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    openSettingsAt('tp-section-alarm');
  });
  bell.after(cog);
  return cog;
}

export function refreshAlarmBellDecor() {
  try {
    if (typeof document === 'undefined') return;
    ensureAlarmBellStyle();
    const bells = findAlarmBells();
    if (!bells.length) return;
    for (const bell of bells) {
      const state = alarmBellState();
      // Idempotent paint: the observer ignores [data-tp-alarm-state] owners,
      // but conditional writes keep unrelated attribute loops quiet too.
      const nextClass = `tp-alarm-${state}`;
      if (!bell.classList.contains(nextClass)) {
        bell.classList.remove('tp-alarm-off', 'tp-alarm-fill', 'tp-alarm-auto');
        bell.classList.add(nextClass);
      }
      if (bell.getAttribute('data-tp-alarm-state') !== state) bell.setAttribute('data-tp-alarm-state', state);
      const pct = Math.round(clampAlarmTarget(CONFIG.ALARM_TARGET_PERCENT) * 100);
      const dur = normalizeAlarmDuration(CONFIG.ALARM_DURATION_DAYS);
      const durLabel = DURATION_LABELS[dur] || dur;
      const nextTitle = state === 'off'
        ? 'Preisalarm AUS — ⚙ für Einstellungen'
        : state === 'fill'
          ? `Preisalarm: trägt Ziel ${pct}% / ${durLabel} ein — klicken zum Prüfen`
          : `Preisalarm AUTO: Ziel ${pct}% / ${durLabel}, sendet selbst`;
      if (bell.title !== nextTitle) bell.title = nextTitle;
      if (!bell.classList.contains('tp-card-alarm-btn')) ensureAlarmCog(bell);
    }
  } catch (err) {
    if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] bell decor error', err);
  }
}

const clearAlarmTimers = modal => {
  const raw = modal.dataset.tpAlarmTimers;
  if (raw) raw.split(',').forEach(id => clearTimeout(Number(id)));
  delete modal.dataset.tpAlarmTimers;
  try { modal._tpAlarmObserver?.disconnect(); } catch {}
  modal._tpAlarmObserver = null;
};
let alarmAttemptSeq = 0;

const ensureAlarmStatus = modal => {
  let el = modal.querySelector('.tp-alarm-status');
  if (!el) {
    el = document.createElement('div');
    el.className = 'tp-alarm-status';
    modal.appendChild(el);
  }
  return el;
};

export function processPriceAlarmModal() {
  refreshAlarmBellDecor();
  if (!CONFIG.ALARM_ENABLED) return;
  const modalContainer = document.querySelector('.Plugin_NewInfoMailForm');
  if (!modalContainer) return;
  // Attempt machine: a fresh fill only from idle-like states — in-flight
  // (filled/scheduled/submitted) or confirmed attempts never refill, so a
  // replaced modal can never paint another attempt's status.
  const alarmState = modalContainer.dataset.tpAlarmState;
  if (alarmState === 'filled' || alarmState === 'scheduled' || alarmState === 'submitted' || alarmState === 'confirmed') return;
  clearAlarmTimers(modalContainer);

  const shippingFirst = modalContainer.querySelector('.shippingPrice .Plugin_Price');
  const productFirst = modalContainer.querySelector('.productPrice .Plugin_Price');
  // Basis-strict: no opposite-basis fallback — a foreign price must never be
  // filled into this product's alarm (missing controls retry next pass).
  const priceEl = isShippingPriceActive() ? shippingFirst : productFirst;
  if (!priceEl) return;

  const presentValue = parsePrice(priceEl.textContent);
  if (!(presentValue > 0)) return;
  // Full snapshot: the 300ms submit revalidates every field below — a basis
  // toggle, route change, or foreign fill mid-wait aborts silently.
  const snapshot = {
    url: location.href,
    basis: isShippingPriceActive(),
    priceText: priceEl.textContent,
    target: (presentValue * clampAlarmTarget(CONFIG.ALARM_TARGET_PERCENT)).toFixed(2),
    duration: normalizeAlarmDuration(CONFIG.ALARM_DURATION_DAYS)
  };
  const targetPrice = snapshot.target;
  const duration = snapshot.duration;
  const priceInput = modalContainer.querySelector('input#f_NewInfoMailForm_priceFrom') || modalContainer.querySelector('input[name="im_nimf_pvf"]');
  const durationHidden = modalContainer.querySelector('input[name="im_nimf_du"]');
  const durationLi = modalContainer.querySelector(`li[data-value="${duration}"]`);
  // Missing-controls: no submission, no attempt stamp — next DOM pass retries.
  if (!priceInput || (!durationHidden && !durationLi)) return;
  // Refill must not clobber a focused manual edit.
  if (document.activeElement === priceInput && priceInput.value !== snapshot.target) return;
  priceInput.value = targetPrice;
  priceInput.dispatchEvent(new Event('input', { bubbles: true }));
  priceInput.dispatchEvent(new Event('change', { bubbles: true }));
  if (durationHidden) {
    durationHidden.value = duration;
    durationHidden.dispatchEvent(new Event('change', { bubbles: true }));
  }
  durationLi?.click();
  // Read-back revalidation: partial fills retry on the next observer pass.
  if (priceInput.value !== targetPrice || (durationHidden && durationHidden.value !== duration)) return;
  modalContainer.dataset.tpAlarmProcessed = 'true';
  modalContainer.dataset.tpAlarmState = 'filled';
  modalContainer.dataset.tpAlarmAttempt = String(++alarmAttemptSeq);

  if (CONFIG.ALARM_AUTO_SUBMIT === true) {
    const reqModal = modalContainer;
    const reqSnap = snapshot;
    const reqAttempt = modalContainer.dataset.tpAlarmAttempt;
    const unconfirmedMsg = '⚠️ Übermittlung nicht bestätigt — bitte prüfen';
    let fallbackTimer = 0;
    let observer = null;
    // Any validation failure cancels this attempt: timers die, no submit,
    // no status paint — a newer attempt (if any) is untouched.
    const cancelAttempt = () => {
      clearTimeout(fallbackTimer);
      try { observer?.disconnect(); } catch {}
      reqModal._tpAlarmObserver = null;
      if (reqModal.dataset.tpAlarmAttempt === reqAttempt) reqModal.dataset.tpAlarmState = 'cancelled';
    };
    const flagUnconfirmed = () => {
      // Attempt-scoped paint: a replaced modal never gets another
      // attempt's status — no document-wide query.
      if (!reqModal.isConnected || reqModal.dataset.tpAlarmAttempt !== reqAttempt) return;
      reqModal.dataset.tpAlarmState = 'unconfirmed';
      const el = ensureAlarmStatus(reqModal);
      // Guarded write: the observer watches this subtree, so an unguarded
      // textContent assignment would re-trigger it into a microtask loop.
      if (el.textContent !== unconfirmedMsg) el.textContent = unconfirmedMsg;
    };
    try {
      const dialogRoot = modalContainer.closest('.AbstractDialog') || document.querySelector('#tmpAbstractDialogContainer') || document.body;
      // Observe BEFORE submit: close only on a success signal — button/form
      // detachment alone never closes.
      observer = new MutationObserver(() => {
        if (reqModal.querySelector('.success,.confirmation,[class*="success" i],[class*="confirm" i]')) {
          try { observer.disconnect(); } catch {}
          clearTimeout(fallbackTimer);
          reqModal._tpAlarmObserver = null;
          if (reqModal.dataset.tpAlarmAttempt === reqAttempt) reqModal.dataset.tpAlarmState = 'confirmed';
          const closeBtn = reqModal.closest('.AbstractDialog')?.querySelector('.AbstractDialog_CloseButton') ||
                           document.querySelector('#tmpAbstractDialogContainer .AbstractDialog_CloseButton');
          if (closeBtn) closeBtn.click();
          else if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Preisalarm: kein Close-Button gefunden');
        } else if (!document.querySelector('.Plugin_NewInfoMailForm')) {
          try { observer.disconnect(); } catch {}
          clearTimeout(fallbackTimer);
          reqModal._tpAlarmObserver = null;
          if (reqModal.dataset.tpAlarmAttempt === reqAttempt) reqModal.dataset.tpAlarmState = 'cancelled';
        }
      });
      observer.observe(dialogRoot, { childList: true, subtree: true });
      reqModal._tpAlarmObserver = observer;
      fallbackTimer = setTimeout(() => {
        try { observer.disconnect(); } catch {}
        reqModal._tpAlarmObserver = null;
        flagUnconfirmed();
      }, CONFIG.ALARM_FALLBACK_TIMEOUT_MS || 5000);
      const submitTimer = setTimeout(() => {
        // Pre-submit revalidation: basis/route/config/price may have changed mid-wait.
        if (reqModal.dataset.tpAlarmAttempt !== reqAttempt) return cancelAttempt();
        if (!reqModal.isConnected || !CONFIG.ALARM_ENABLED || CONFIG.ALARM_AUTO_SUBMIT !== true) return cancelAttempt();
        if (location.href !== reqSnap.url || isShippingPriceActive() !== reqSnap.basis) return cancelAttempt();
        if (!priceEl.isConnected || priceEl.textContent !== reqSnap.priceText) return cancelAttempt();
        if (priceInput.value !== reqSnap.target) return cancelAttempt();
        const durHidden = reqModal.querySelector('input[name="im_nimf_du"]');
        if (durHidden && durHidden.value !== reqSnap.duration) return cancelAttempt();
        const submitBtn = reqModal.querySelector('input.f_submitbtn');
        if (!submitBtn) return cancelAttempt();
        const termsCheckbox = reqModal.querySelector('input#im_nimf_prtrm');
        if (termsCheckbox) {
          termsCheckbox.checked = true;
          termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
        submitBtn.click();
        if (reqModal.dataset.tpAlarmAttempt === reqAttempt) reqModal.dataset.tpAlarmState = 'submitted';
      }, 300);
      modalContainer.dataset.tpAlarmTimers = `${submitTimer},${fallbackTimer}`;
      modalContainer.dataset.tpAlarmState = 'scheduled';
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Preisalarm submit error', err);
    }
  }
}

/**
 * Triggers or fetches the native Preisalarm dialog for a given product ID.
 * If a native dialog trigger is in the card or document, it clicks it.
 * Otherwise, fetches the form from Toppreise backend and opens via AbstractDialog_show.
 */
export async function openPriceAlarmForProduct(pid, card = null) {
  if (!pid) return;
  // 1. Check if card or nearby DOM already has a native bell anchor
  const localBell = card?.querySelector?.('.Plugin_NewInfoMailButton a.f_showNewInfoMailFormDialog, a[href*="NewInfoMail"]');
  if (localBell) {
    localBell.click();
    return;
  }

  // 2. If test mock dialog exists, display it directly
  const mockDialog = document.querySelector('#mock-alarm-dialog');
  if (mockDialog) {
    mockDialog.style.display = 'block';
    delete mockDialog.querySelector?.('.Plugin_NewInfoMailForm')?.dataset?.tpAlarmProcessed;
    delete mockDialog.querySelector?.('.Plugin_NewInfoMailForm')?.dataset?.tpAlarmState;
    processPriceAlarmModal();
    return;
  }

  // 3. Native host interaction: check if Toppreise global helper exists
  if (typeof window !== 'undefined' && typeof window.openInfoMailForm === 'function') {
    // If there is any trigger button element created or available
    const tempTrigger = document.createElement('a');
    tempTrigger.className = 'f_showNewInfoMailFormDialog';
    tempTrigger.setAttribute('data-ajax-form-url', `/plugins/infomails/NewInfoMailForm?im_nimf_pid=${pid}&im_nimf_cks=`);
    const wrap = document.createElement('div');
    wrap.className = 'Plugin_NewInfoMailButton';
    wrap.appendChild(tempTrigger);
    document.body.appendChild(wrap);
    try {
      window.openInfoMailForm(tempTrigger, false);
      return;
    } catch {
      wrap.remove();
    }
  }

  // 4. Fallback: Fetch NewInfoMailButton or NewInfoMailForm HTML and materialize
  try {
    const postBody = new URLSearchParams({
      im_nimb_ch: '1',
      im_nimb_pid: String(pid),
      im_nimb_tmpl: 'btn',
      lang: 'de'
    });
    const res = await fetch('/plugins/infomails/NewInfoMailButton', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: postBody
    });
    if (res.ok) {
      const html = await res.text();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const tpl = tempDiv.querySelector('template.f_lazyDialog');
      const dialogNode = tpl ? (tpl.content ? tpl.content.firstElementChild : tpl.firstElementChild) : tempDiv.querySelector('.AbstractDialog_NewInfoMailFormDialog');
      const dialogId = dialogNode?.id;
      const dialogHash = dialogNode?.getAttribute('data-instance-hash') || '1';
      const formUrl = tempDiv.querySelector('a')?.getAttribute('data-ajax-form-url');

      if (dialogNode) {
        const dismissDialog = () => {
          if (typeof window !== 'undefined' && typeof window.AbstractDialog_hide === 'function') {
            try { window.AbstractDialog_hide(dialogId); } catch {}
          }
          dialogNode.style.display = 'none';
          dialogNode.classList.remove('show');
          dialogNode.remove();
          if (typeof document !== 'undefined') document.removeEventListener('keydown', handleKeydown);
        };
        const handleKeydown = e => {
          if (e.key === 'Escape') dismissDialog();
        };
        if (typeof document !== 'undefined') document.addEventListener('keydown', handleKeydown);
        dialogNode.querySelector('.AbstractDialog_CloseButton')?.addEventListener('click', e => {
          e.preventDefault();
          dismissDialog();
        });
        dialogNode.querySelector('.modal')?.addEventListener('click', e => {
          if (e.target === e.currentTarget) dismissDialog();
        });

        document.body.appendChild(dialogNode);
        if (formUrl) {
          const formRes = await fetch(`${formUrl}&im_nimf_ch=${dialogHash}&lang=de`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (formRes.ok) {
            const formHtml = await formRes.text();
            const content = dialogNode.querySelector('.AbstractDialog_Content');
            if (content) content.innerHTML = formHtml;
          }
        }
        if (typeof window !== 'undefined' && typeof window.AbstractDialog_show === 'function') {
          window.AbstractDialog_show(dialogId);
        } else {
          dialogNode.style.display = 'block';
          dialogNode.classList.add('show');
        }
        processPriceAlarmModal();
        return;
      }
    }
  } catch (err) {
    if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Failed to open price alarm modal', err);
  }

  // 5. Ultimate fallback if AJAX fails: direct URL navigation in new tab
  if (typeof window !== 'undefined') {
    window.open(`/neue-infomail?im_nimf_pid=${pid}`, '_blank', 'noopener');
  }
}

setAlarmConfigListener(() => {
  // A settings change invalidates pending auto-submits: cancel timers so a
  // stale snapshot can never submit under new settings. Both flags go so
  // the next pass refills under the new settings (never over a focused edit).
  const live = typeof document !== 'undefined' ? document.querySelector('.Plugin_NewInfoMailForm') : null;
  if (live) {
    clearAlarmTimers(live);
    delete live.dataset.tpAlarmState;
    delete live.dataset.tpAlarmProcessed;
  }
  refreshAlarmBellDecor();
});
