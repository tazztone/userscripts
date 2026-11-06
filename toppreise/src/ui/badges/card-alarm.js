/**
 * Card Preisalarm bell trigger next to price.
 * Split from ui/badges/card-chrome.js to satisfy module size budget.
 */

import { openPriceAlarmForProduct, refreshAlarmBellDecor } from '../../features/price-alarm.js';

export function renderAlarmBell(ctx) {
  const { card, pid, cardPriceEl } = ctx;
  if (!pid || card.querySelector('.Plugin_NewInfoMailButton, .f_showNewInfoMailFormDialog, a[href*="NewInfoMail"], a[href*="infomail"]')) {
    card.querySelector('.tp-card-alarm-group')?.remove();
    card.querySelector('.tp-card-alarm-btn')?.remove();
    return;
  }
  let bell = card.querySelector('.tp-card-alarm-btn');
  let group = card.querySelector('.tp-card-alarm-group');
  if (!bell) {
    if (!group) {
      group = document.createElement('div');
      group.className = 'tp-card-alarm-group';
    }
    bell = document.createElement('button');
    bell.type = 'button';
    bell.className = 'tp-card-alarm-btn';
    bell.textContent = '🔔';
    bell.setAttribute('aria-label', 'Preisalarm');
    bell.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openPriceAlarmForProduct(pid, card);
    });
    group.appendChild(bell);
  }
  if (group) {
    const targetAnchor = (cardPriceEl?.parentElement?.contains(cardPriceEl) && cardPriceEl) ||
                         card.querySelector('.Plugin_PriceInformation, .price_information_product, .price_information_product_small') ||
                         card;
    if (targetAnchor === cardPriceEl) {
      if (group.previousElementSibling !== cardPriceEl) {
        cardPriceEl.insertAdjacentElement('afterend', group);
      }
    } else if (targetAnchor !== card) {
      const pill = targetAnchor.querySelector('.tp-deal-pill');
      if (pill && card.classList?.contains('mixedBrowsingExpert')) {
        if (group.nextElementSibling !== pill) targetAnchor.insertBefore(group, pill);
      } else if (group.parentElement !== targetAnchor) {
        targetAnchor.appendChild(group);
      }
    } else if (group.parentElement !== card) {
      card.appendChild(group);
    }
  }
  refreshAlarmBellDecor();
}
