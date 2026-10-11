/**
 * Price Alarm Automation Feature
 * Automates the Toppreise price alarm popup dialog:
 * calculates discount target, configures alert duration, accepts terms,
 * and submits automatically when configured.
 * Also paints the native bell trigger with the 3-state auto-fill mode
 * (off / fill-only / auto-submit) plus a cog jumping to its settings.
 */

import { CONFIG, setAlarmConfigListener } from '../state/config.js';
import { parsePrice } from '../domain/price.js';
import { openSettingsAt } from '../ui/modal.js';

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
// `a.f_showNewInfoMailFormDialog` with a `TPIcons-alarm` icon. First entry
// is the test fixture. Silent no-op when absent.
const ALARM_BELL_SELECTORS = [
  '#mock-alarm-bell',
  '.Plugin_NewInfoMailButton a.f_showNewInfoMailFormDialog',
  '.Plugin_NewInfoMailButton a',
  'a[href*="NewInfoMail"]',
];
const BELL_STYLE_ID = 'tp-alarm-bell-style';

const alarmBellState = () => {
  if (CONFIG.ALARM_ENABLED === false) return 'off';
  return CONFIG.ALARM_AUTO_SUBMIT === false ? 'fill' : 'auto';
};

const findAlarmBell = () => {
  for (const sel of ALARM_BELL_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
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
  let cog = bell.nextElementSibling;
  if (!cog || !cog.classList?.contains('tp-alarm-cog')) {
    cog = document.querySelector('.tp-alarm-cog');
    if (!cog) {
      cog = document.createElement('button');
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
    }
    bell.after(cog);
  }
  return cog;
}

export function refreshAlarmBellDecor() {
  try {
    if (typeof document === 'undefined') return;
    ensureAlarmBellStyle();
    const bell = findAlarmBell();
    if (!bell) return;
    const state = alarmBellState();
    bell.classList.remove('tp-alarm-off', 'tp-alarm-fill', 'tp-alarm-auto');
    bell.classList.add(`tp-alarm-${state}`);
    bell.setAttribute('data-tp-alarm-state', state);
    const pct = Math.round(clampAlarmTarget(CONFIG.ALARM_TARGET_PERCENT) * 100);
    const dur = normalizeAlarmDuration(CONFIG.ALARM_DURATION_DAYS);
    const durLabel = DURATION_LABELS[dur] || dur;
    bell.title = state === 'off'
      ? 'Preisalarm auto-fill AUS — ⚙ für Einstellungen'
      : state === 'fill'
        ? `Preisalarm: füllt Ziel ${pct}% / ${durLabel} an — klicken zum Prüfen`
        : `Preisalarm AUTO: Ziel ${pct}% / ${durLabel}, sendet selbst`;
    ensureAlarmCog(bell);
  } catch (err) {
    if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] bell decor error', err);
  }
}

const clearAlarmTimers = modal => {
  const raw = modal.dataset.tpAlarmTimers;
  if (!raw) return;
  raw.split(',').forEach(id => clearTimeout(Number(id)));
  delete modal.dataset.tpAlarmTimers;
};

export function processPriceAlarmModal() {
  refreshAlarmBellDecor();
  if (!CONFIG.ALARM_ENABLED) return;
  const modalContainer = document.querySelector('.Plugin_NewInfoMailForm');
  if (!modalContainer || modalContainer.dataset.tpAlarmProcessed === 'true') return;
  clearAlarmTimers(modalContainer);

  const priceEl = modalContainer.querySelector('.shippingPrice .Plugin_Price') ||
                  modalContainer.querySelector('.productPrice .Plugin_Price') ||
                  document.querySelector('.pageContent .priceContainer .Plugin_Price');
  if (!priceEl) return;

  const presentValue = parsePrice(priceEl.textContent);
  if (!(presentValue > 0)) return;
  modalContainer.dataset.tpAlarmProcessed = 'true';

  const targetPrice = (presentValue * clampAlarmTarget(CONFIG.ALARM_TARGET_PERCENT)).toFixed(2);
  const duration = normalizeAlarmDuration(CONFIG.ALARM_DURATION_DAYS);
  const priceInput = modalContainer.querySelector('input#f_NewInfoMailForm_priceFrom') || modalContainer.querySelector('input[name="im_nimf_pvf"]');
  if (priceInput) {
    priceInput.value = targetPrice;
    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    priceInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const durationHidden = modalContainer.querySelector('input[name="im_nimf_du"]');
  if (durationHidden) {
    durationHidden.value = duration;
    durationHidden.dispatchEvent(new Event('change', { bubbles: true }));
  }
  modalContainer.querySelector(`li[data-value="${duration}"]`)?.click();

  if (CONFIG.ALARM_AUTO_SUBMIT) {
    const termsCheckbox = modalContainer.querySelector('input#im_nimf_prtrm');
    if (termsCheckbox) {
      termsCheckbox.checked = true;
      termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }

    try {
      const submitTimer = setTimeout(() => {
        const submitBtn = modalContainer.querySelector('input.f_submitbtn');
        if (!submitBtn) {
          if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Preisalarm: kein Submit-Button gefunden');
          return;
        }
        submitBtn.click();
        // Allow in-flight AJAX request to complete before closing the dialog container
        const closeTimer = setTimeout(() => {
          const closeBtn = modalContainer.closest('.AbstractDialog')?.querySelector('.AbstractDialog_CloseButton') ||
                           document.querySelector('#tmpAbstractDialogContainer .AbstractDialog_CloseButton');
          if (closeBtn) closeBtn.click();
          else if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Preisalarm: kein Close-Button gefunden');
        }, 800);
        modalContainer.dataset.tpAlarmTimers = String(closeTimer);
      }, 300);
      modalContainer.dataset.tpAlarmTimers = String(submitTimer);
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[Toppreise-Suite] Preisalarm submit error', err);
    }
  }
}

setAlarmConfigListener(refreshAlarmBellDecor);
