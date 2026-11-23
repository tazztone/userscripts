/**
 * Card dealer extraction, background fetching, and UI rendering.
 * Split from ui/badges/card-chrome.js to satisfy module size budget.
 */

import { CONFIG, realDealMinDiscount } from '../../state/config.js';
import { getOriginCooldownUntil } from '../../state/net.js';
import { getCachedDealer, setCachedDealer, lruSet, hasUsablePriceStats, currentCacheGen } from '../../scanner/cache.js';
import { extractShareData, extractDealer, extractDealerUrl, fetchProductInfoDetailed } from '../../page/product-offers.js';
import { isShippingPriceActive, scheduleProcessListings } from '../../page/adapter.js';
import { setTextIfChanged, setTitleIfChanged } from './dom-helpers.js';
import { dealerCache, dealerPending, dealerHydrated, dealerAutoTries, boundedSetAdd, boundedMapSet } from './deal-badge.js';

const dealerPromises = new Map();

export async function ensureDealerInfo(card, pid, useShipping) {
  if (!pid || !card) return null;
  const dKey = `${pid}:${useShipping ? 's' : 'p'}`;
  let dealer = extractDealer(card, useShipping);
  if (!dealer && !dealerCache.has(dKey) && !dealerHydrated.has(dKey)) {
    boundedSetAdd(dealerHydrated, dKey, 500);
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
      const { info, transient } = await fetchProductInfoDetailed(productUrl, undefined, reqShipping).catch(() => ({ info: null, transient: true }));
      if (reqGen !== currentCacheGen()) return null;
      if (info?.dealer) {
        const entry = { dealer: info.dealer, url: info.dealerUrl || '', offers: info.offers || 0, totalOffers: info.totalOffers || 0 };
        lruSet(dealerCache, reqKey, entry);
        setCachedDealer(pid, reqShipping, info.dealer, info.dealerUrl || '', undefined, info.offers || 0, info.totalOffers || 0);
        return entry;
      }
      const tryState = dealerAutoTries.get(reqKey);
      if (tryState) {
        if (transient && tryState.count < 2) {
          const cooldownLeft = Math.max(0, getOriginCooldownUntil() - Date.now());
          const delay = Math.max(1500, cooldownLeft + 250);
          tryState.nextTryAt = Date.now() + delay;
          setTimeout(() => scheduleProcessListings(), delay);
        } else {
          tryState.exhausted = true;
        }
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
  const dealerEl = card.querySelector('.tp-card-dealer-row .tp-dealer-name');
  if (!hasUsablePriceStats(stats) || !pid) {
    dealerEl?.remove();
    card.querySelector('.tp-card-dealer-row')?.remove();
    card.querySelector('.tp-action-dealer')?.remove();
  } else {
    const useShipping = isShippingPriceActive(card);
    const dKey = `${pid}:${useShipping ? 's' : 'p'}`;
    let dealer = extractDealer(card, useShipping);
    if (!dealer && !dealerCache.has(dKey) && !dealerHydrated.has(dKey)) {
      boundedSetAdd(dealerHydrated, dKey, 500);
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
      if (el.classList?.contains('shippingPrice') && !isShippingPriceActive(card)) return false;
      if (el.classList?.contains('productPrice') && isShippingPriceActive(card)) {
        const hasActiveShipping = !!card.querySelector?.('.priceContainer.shippingPrice:not(.d-none)');
        if (hasActiveShipping) return false;
      }
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

    card.querySelector('.tp-action-dealer')?.remove();

    const loadDealer = async () => {
      card.querySelectorAll('.tp-dealer-btn').forEach(b => { b.disabled = true; });
      try {
        return await ensureDealerInfo(card, pid, useShipping);
      } finally {
        if (!dealerPending.has(dKey)) {
          card.querySelectorAll('.tp-dealer-btn').forEach(b => {
            if (b.dataset.tpDealerPid === dKey) b.disabled = false;
          });
        }
      }
    };

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
      const tryState = dealerAutoTries.get(dKey);
      const canAutoTry = !tryState || (!tryState.exhausted && tryState.count < 2 && Date.now() >= (tryState.nextTryAt || 0));
      if (!filters?.isFiltered && CONFIG.DEALER_AUTOFETCH === true && meetsDealThreshold && canAutoTry && !dealerPending.has(dKey) && dealerPending.size < 3) {
        boundedMapSet(dealerAutoTries, dKey, { count: (tryState?.count || 0) + 1, nextTryAt: 0, exhausted: false }, 500);
        btn.disabled = true;
        loadDealer();
      }
    } else {
      dealerEl?.remove();
      card.querySelector('.tp-card-dealer-row')?.remove();
    }
  }
}
