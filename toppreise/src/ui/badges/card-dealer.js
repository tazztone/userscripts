/**
 * Card dealer extraction, background fetching, and UI rendering.
 * Split from ui/badges/card-chrome.js to satisfy module size budget.
 */

import { CONFIG, realDealMinDiscount } from '../../state/config.js';
import { getCachedDealer, setCachedDealer, lruSet, hasUsablePriceStats, currentCacheGen } from '../../scanner/cache.js';
import { extractShareData, extractDealer, extractDealerUrl, fetchProductInfo } from '../../page/product-offers.js';
import { isShippingPriceActive, scheduleProcessListings } from '../../page/adapter.js';
import { setTextIfChanged, setTitleIfChanged } from './dom-helpers.js';
import { dealerCache, dealerPending, dealerHydrated, dealerAutoTried } from './deal-badge.js';

const dealerPromises = new Map();

export async function ensureDealerInfo(card, pid, useShipping) {
  if (!pid || !card) return null;
  const dKey = `${pid}:${useShipping ? 's' : 'p'}`;
  let dealer = extractDealer(card, useShipping);
  if (!dealer && !dealerCache.has(dKey) && !dealerHydrated.has(dKey)) {
    if (dealerHydrated.size > 1000) dealerHydrated.clear();
    dealerHydrated.add(dKey);
    const stored = getCachedDealer(pid, useShipping);
    if (stored?.dealer) lruSet(dealerCache, dKey, stored);
  }
  let cached = dealerCache.get(dKey);
  if (dealer || cached?.dealer) {
    return {
      dealer: dealer || cached.dealer,
      url: cached?.url || (dealer ? extractDealerUrl(card, useShipping) : '')
    };
  }

  const { url: productUrl } = extractShareData(card);
  if (!productUrl || !/^https?:\/\//i.test(productUrl)) return null;

  if (dealerPromises.has(dKey)) {
    try {
      await dealerPromises.get(dKey);
    } catch {}
    cached = dealerCache.get(dKey);
    return cached?.dealer ? { dealer: cached.dealer, url: cached.url || '' } : null;
  }

  dealerPending.add(dKey);
  const reqGen = currentCacheGen();
  const reqShipping = useShipping;
  const reqKey = dKey;

  const promise = (async () => {
    try {
      const info = await fetchProductInfo(productUrl, undefined, reqShipping).catch(() => null);
      if (reqGen !== currentCacheGen()) return null;
      if (info?.dealer) {
        const entry = { dealer: info.dealer, url: info.dealerUrl || '', offers: info.offers || 0, totalOffers: info.totalOffers || 0 };
        lruSet(dealerCache, reqKey, entry);
        setCachedDealer(pid, reqShipping, info.dealer, info.dealerUrl || '', undefined, info.offers || 0, info.totalOffers || 0);
        return entry;
      }
      return null;
    } finally {
      dealerPending.delete(dKey);
      dealerPromises.delete(dKey);
    }
  })();

  dealerPromises.set(dKey, promise);
  const res = await promise;
  scheduleProcessListings();
  return res ? { dealer: res.dealer, url: res.url || '' } : null;
}

export function renderDealerName(ctx, filters) {
  const { card, pid, cardPriceEl, stats, heatInfo } = ctx;
  // 8. Händlername links neben dem Preis: nur geprüfte Karten (stats != null).
  // Katalog löst synchron aus extractDealer (kein Fetch); Feed ohne DOM-Zeile
  // bekommt einen 🏬-Button, der fetchProductInfo einmalig pro pid:Modus holt
  // (dealerCache + dealerPending-Guard) und danach neu rendert — oder bei
  // DEALER_AUTOFETCH denselben Loader ohne Klick (1×/Pageload, max. 3 parallel).
  // Der Name verlinkt direkt aufs Händlerangebot (/ext_de aus dem Fetch bzw.
  // Zeilenlink), Fallback ist die Produktseite — immer neuer Tab.
  const dealerEl = card.querySelector('.tp-dealer-name');
  if (!hasUsablePriceStats(stats) || !pid) {
    dealerEl?.remove();
    card.querySelector('.tp-card-dealer-row')?.remove();
  } else {
    const useShipping = isShippingPriceActive(card);
    const dKey = `${pid}:${useShipping ? 's' : 'p'}`;
    let dealer = extractDealer(card, useShipping);
    if (!dealer && !dealerCache.has(dKey) && !dealerHydrated.has(dKey)) {
      if (dealerHydrated.size > 1000) dealerHydrated.clear();
      dealerHydrated.add(dKey);
      const stored = getCachedDealer(pid, useShipping);
      if (stored?.dealer) lruSet(dealerCache, dKey, stored);
    }
    const cached = dealerCache.get(dKey);
    if (!dealer && cached?.dealer) dealer = cached.dealer;
    const { url: productUrl } = extractShareData(card);
    const directUrl = cached?.url || (dealer ? extractDealerUrl(card, useShipping) : '');
    const targetUrl = directUrl || productUrl || '';
    const hasUrl = /^https?:\/\//i.test(targetUrl);
    const isVisibleEl = el => {
      if (!el) return false;
      if (el.style?.display === 'none' || el.hidden || el.classList?.contains('d-none')) return false;
      if (el.offsetParent === null && !el.classList?.contains('tp-filtered')) return false;
      return true;
    };
    let anchor = (cardPriceEl?.parentElement?.contains(cardPriceEl) && cardPriceEl.parentElement) || null;
    if (!anchor || !isVisibleEl(anchor)) {
      const pp = card.querySelector('.priceContainer.productPrice');
      const sp = card.querySelector('.priceContainer.shippingPrice');
      if (pp && isVisibleEl(pp)) anchor = pp;
      else if (sp && isVisibleEl(sp)) anchor = sp;
      else anchor = card.querySelector('.Plugin_PriceInformation, .price_information_product') || card;
    }
    const place = el => {
      el.dataset.tpDealerPid = dKey;
      let row = card.querySelector('.tp-card-dealer-row');
      if (!row) {
        row = document.createElement('div');
        row.className = 'tp-card-dealer-row';
      }
      if (anchor !== card && anchor?.parentElement) {
        if (row.nextElementSibling !== anchor) {
          anchor.parentElement.insertBefore(row, anchor);
        }
      } else if (anchor && anchor !== card) {
        if (row.parentElement !== anchor) anchor.insertBefore(row, anchor.firstChild);
      } else if (card) {
        if (row.parentElement !== card) card.appendChild(row);
      }
      if (el.parentElement !== row) {
        row.replaceChildren(el);
      }
    };

    const actionRow = card.querySelector('.row.action, .action');
    const actionMailBtn = actionRow?.querySelector('.Plugin_NewInfoMailButton')?.closest?.('.col-auto') || actionRow?.querySelector('.Plugin_NewInfoMailButton');
    let actionEl = card.querySelector('.tp-action-dealer');

    const loadDealer = async () => {
      card.querySelectorAll('.tp-dealer-btn').forEach(b => { b.disabled = true; });
      await ensureDealerInfo(card, pid, useShipping);
    };

    if (actionRow && actionMailBtn) {
      if (!actionEl) {
        actionEl = document.createElement('div');
        actionEl.className = 'col-auto tp-action-dealer';
        actionMailBtn.insertAdjacentElement('beforebegin', actionEl);
      }
      if (dealer) {
        let link = actionEl.querySelector('a.tp-dealer-name');
        if (!link) {
          actionEl.innerHTML = '';
          link = document.createElement(hasUrl ? 'a' : 'span');
          link.className = 'tp-dealer-name';
          if (hasUrl) { link.href = targetUrl; link.target = '_blank'; link.rel = 'noopener'; link.addEventListener('click', e => e.stopPropagation()); }
          actionEl.appendChild(link);
        } else if (hasUrl && link.getAttribute('href') !== targetUrl) {
          link.href = targetUrl;
        }
        setTextIfChanged(link, `🏬 ${dealer}`);
        setTitleIfChanged(link, directUrl && hasUrl ? `Günstigster Händler: ${dealer} — direkt zum Angebot` : `Günstigster Händler: ${dealer}`);
      } else if (hasUrl && !dealerCache.has(dKey)) {
        let actionBtn = actionEl.querySelector('button.tp-dealer-btn');
        if (!actionBtn) {
          actionEl.innerHTML = '';
          actionBtn = document.createElement('button');
          actionBtn.type = 'button';
          actionBtn.className = 'tp-dealer-name tp-dealer-btn';
          actionBtn.textContent = '🏬';
          actionBtn.setAttribute('aria-label', 'Händler laden');
          actionBtn.title = 'Günstigsten Händler laden (eine Abfrage je Produkt)';
          actionBtn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            loadDealer();
          });
          actionEl.appendChild(actionBtn);
        } else if (!dealerPending.has(dKey) && actionBtn.disabled) {
          actionBtn.disabled = false;
        }
      } else {
        actionEl.remove();
      }
    } else {
      actionEl?.remove();
    }

    if (dealer) {
      let el = dealerEl?.dataset.tpDealerPid === dKey ? dealerEl : null;
      if (el && ((el.tagName === 'A') !== hasUrl)) { el.remove(); el = null; }
      if (!el) {
        dealerEl?.remove();
        el = document.createElement(hasUrl ? 'a' : 'span');
        el.className = 'tp-dealer-name';
        if (hasUrl) { el.href = targetUrl; el.target = '_blank'; el.rel = 'noopener'; el.addEventListener('click', e => e.stopPropagation()); }
        place(el);
      } else {
        place(el);
        if (el.tagName === 'A' && hasUrl && el.getAttribute('href') !== targetUrl) {
          el.href = targetUrl;
        }
      }
      setTextIfChanged(el, `🏬 ${dealer}`);
      setTitleIfChanged(el, directUrl && hasUrl ? `Günstigster Händler: ${dealer} — direkt zum Angebot` : `Günstigster Händler: ${dealer}`);
    } else if (hasUrl && !dealerCache.has(dKey)) {
      // Ein Loader für Klick + Auto-Fetch: Produktseite einmalig pro pid:Modus
      // (dealerPending-Guard), Ergebnis in Memory + localStorage, danach Render.
      let btn = dealerEl?.dataset.tpDealerPid === dKey && dealerEl.tagName === 'BUTTON' ? dealerEl : null;
      if (!btn) {
        dealerEl?.remove();
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tp-dealer-name tp-dealer-btn';
        btn.textContent = '🏬';
        btn.setAttribute('aria-label', 'Händler laden');
        btn.title = 'Günstigsten Händler laden (eine Abfrage je Produkt)';
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          loadDealer();
        });
        place(btn);
      } else {
        place(btn);
        if (!dealerPending.has(dKey) && btn.disabled) {
          btn.disabled = false;
        }
      }
      // Opt-in (aus, Standard): Händler ohne Klick laden. Ein Versuch pro
      // pid:Modus und Pageload (Fehler → Button für manuellen Retry), max. 3
      // parallele Fetches — fertige lösen per triggerProcessListings die
      // nächste Staffel aus (Kaskade statt Request-Sturm).
      // Nur ausführen, wenn die effektive Badge-% die gesetzte Schwelle erreicht.
      const isMarkup = ctx.displayDelta?.kind === 'above-low' || heatInfo?.kind === 'markup';
      const effectivePct = !isMarkup
        ? (heatInfo?.pct ?? ctx.dealData?.weightedDiff ?? 0)
        : 0;
      const meetsDealThreshold = effectivePct >= realDealMinDiscount();
      if (!filters?.isFiltered && CONFIG.DEALER_AUTOFETCH === true && meetsDealThreshold && !dealerAutoTried.has(dKey) && !dealerPending.has(dKey) && dealerPending.size < 3) {
        dealerAutoTried.add(dKey);
        btn.disabled = true;
        loadDealer();
      }
    } else {
      dealerEl?.remove();
      card.querySelector('.tp-card-dealer-row')?.remove();
    }
  }
}
