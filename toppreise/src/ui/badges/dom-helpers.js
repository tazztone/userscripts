/**
 * Badges DOM helpers (split from ui/badges.js): idempotent element painters.
 * Zero imports. Names frozen (toolbar, floating-cta import setTextIfChanged).
 */

export function setHtmlIfChanged(el, newHtml) {
  if (el && el.innerHTML !== newHtml) {
    el.innerHTML = newHtml;
  }
}

export function setTextIfChanged(el, newText) {
  if (el && el.textContent !== newText) {
    el.textContent = newText;
  }
}

export function setTitleIfChanged(el, newTitle) {
  if (el && el.title !== newTitle) {
    el.title = newTitle;
  }
}

// Heat is chrome-only (border + glow): the card keeps the site background.

export function ensureHistPriceEl(card, cardPriceEl) {
  let el = card.querySelector('.tp-card-historical-price');
  if (!el) {
    el = document.createElement('div');
    const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                           cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                           cardPriceEl?.parentElement ||
                           card;
    priceContainer.appendChild(el);
  }
  return el;
}
