/**
 * Price Alarm Automation Feature
 * Automates the Toppreise price alarm popup dialog:
 * calculates discount target, configures alert duration, accepts terms,
 * and submits automatically when configured.
 */

import { CONFIG } from '../state/config.js';
import { parsePrice } from '../domain/price.js';

export function processPriceAlarmModal() {
  if (!CONFIG.ALARM_ENABLED) return;
  const modalContainer = document.querySelector('.Plugin_NewInfoMailForm');
  if (!modalContainer || modalContainer.dataset.tpAlarmProcessed === 'true') return;
  modalContainer.dataset.tpAlarmProcessed = 'true';

  const priceEl = modalContainer.querySelector('.shippingPrice .Plugin_Price') ||
                  modalContainer.querySelector('.productPrice .Plugin_Price') ||
                  document.querySelector('.pageContent .priceContainer .Plugin_Price');
  if (!priceEl) return;

  const presentValue = parsePrice(priceEl.textContent);
  if (presentValue <= 0) return;

  const targetPrice = (presentValue * CONFIG.ALARM_TARGET_PERCENT).toFixed(2);
  const priceInput = modalContainer.querySelector('input#f_NewInfoMailForm_priceFrom') || modalContainer.querySelector('input[name="im_nimf_pvf"]');
  if (priceInput) {
    priceInput.value = targetPrice;
    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    priceInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const durationHidden = modalContainer.querySelector('input[name="im_nimf_du"]');
  if (durationHidden) {
    durationHidden.value = CONFIG.ALARM_DURATION_DAYS;
    durationHidden.dispatchEvent(new Event('change', { bubbles: true }));
  }
  modalContainer.querySelector(`li[data-value="${CONFIG.ALARM_DURATION_DAYS}"]`)?.click();

  const termsCheckbox = modalContainer.querySelector('input#im_nimf_prtrm');
  if (termsCheckbox) {
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (CONFIG.ALARM_AUTO_SUBMIT) {
    const submitDelay = Math.max(0, CONFIG.ALARM_SUBMIT_DELAY_MS ?? 300);
    const closeDelay = Math.max(0, CONFIG.ALARM_CLOSE_DELAY_MS ?? 800);
    setTimeout(() => {
      const submitBtn = modalContainer.querySelector('input.f_submitbtn');
      if (submitBtn) {
        submitBtn.click();
        // Allow in-flight AJAX request to complete before closing the dialog container
        setTimeout(() => {
          const closeBtn = modalContainer.closest('.AbstractDialog')?.querySelector('.AbstractDialog_CloseButton') ||
                           document.querySelector('#tmpAbstractDialogContainer .AbstractDialog_CloseButton');
          if (closeBtn) closeBtn.click();
        }, closeDelay);
      }
    }, submitDelay);
  }
}

