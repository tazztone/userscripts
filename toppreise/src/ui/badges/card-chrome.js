/**
 * Card chrome (split from ui/badges.js): sparkline row, verified cue, share
 * button, dealer name, review button, fresh glow, empty state — plus the
 * renderCardEffects orchestrator (signature frozen, app.js untouched).
 */

import { CONFIG, updateConfig, updateConfigs, sanitizeReviewKeyword, realDealMinDiscount } from '../../state/config.js';
import { getDisplayDelta, getHeatInput, computeDealScore } from '../../domain/deal-score.js';
import { basisMatchesFor, FILTER_CAUSE_DEFS } from '../../page/cards.js';
import { getCachedDealer, setCachedDealer, lruSet, hasUsablePriceStats, currentCacheGen } from '../../scanner/cache.js';
import { priceToCents } from '../../domain/price.js';
import { withLivePrice } from '../../features/share-discord.js';
import { extractShareData, extractDealer, extractDealerUrl, fetchProductInfo } from '../../page/product-offers.js';
import { showToast } from '../toast.js';
import { renderSparkline, openSparklinePopout } from '../sparkline.js';
import { isShippingPriceActive, scheduleProcessListings } from '../../page/adapter.js';
import { scanState } from '../../state/store.js';
import { startBatchCheck } from '../floating-cta.js';
import { setTextIfChanged, setTitleIfChanged } from './dom-helpers.js';
import { dealerCache, dealerPending, dealerHydrated, dealerAutoTried, renderHeat, renderFilterVerdict } from './deal-badge.js';
import { renderBadgeVerdict } from './deal-verdict.js';
import { renderShareButton } from './card-share.js';
import { openAiPopover } from './card-ai-popover.js';
import { expandKeywordWithPrice, formatSearchQuery } from '../../features/tavily-search.js';
import { openPriceAlarmForProduct, refreshAlarmBellDecor } from '../../features/price-alarm.js';

export { renderShareButton };

// Mini price-trend sparkline + history strip (step 5).
export function renderSparklineRow(ctx) {
  const { card, pid: rawPid, cardPrice, cardPriceEl, stats } = ctx;
  const pid = rawPid || card?.dataset?.tpProductId || null;
  // 5. Mini Price-Trend Sparkline + history strip (card-level bottom row:
  // pill spans from the share-button zone to the card's right edge, using
  // full card width instead of the narrow price-info column).
  const hasSeries = CONFIG.ENABLE_SPARKLINES && stats && Array.isArray(stats.timeSeries) && stats.timeSeries.length >= 2;
  let sparkContainer = hasSeries ? card.querySelector('.tp-sparkline-container') : null;
  if (hasSeries) {
    if (!sparkContainer) {
      sparkContainer = document.createElement('div');
      sparkContainer.className = 'tp-sparkline-container';
    }
    // Click pops the full Discord-style chart (same series incl. live price).
    sparkContainer._tpSeries = withLivePrice(stats.timeSeries, cardPrice);
    // Revision-aware: same length/price/median with refreshed points (new
    // fetch, recomputed median) must rebuild instead of showing stale art.
    const lastTs = stats.timeSeries.length ? +stats.timeSeries[stats.timeSeries.length - 1][0] || 0 : 0;
    const sig = [stats.timeSeries.length, priceToCents(cardPrice), priceToCents(stats.medianPrice ?? 0), stats.time || 0, lastTs].join(':');
    const useShipping = isShippingPriceActive(card);
    const cachedDealer = getCachedDealer(pid, useShipping);
    const dealerName = cachedDealer?.dealer || extractDealer(card, useShipping) || '';
    const isAmazon = /amazon/i.test(dealerName) && CONFIG.KEEPA_CHART_ENABLED !== false;
    sparkContainer.classList.toggle('tp-sparkline-amazon', isAmazon);
    sparkContainer.style.cursor = 'pointer';
    sparkContainer.setAttribute('role', 'button');
    sparkContainer.setAttribute('tabindex', '0');
    sparkContainer.setAttribute('title', isAmazon ? 'Preisverlauf vergrössern (inkl. Amazon / Keepa)' : 'Preisverlauf vergrössern');
    if (!sparkContainer.dataset.tpPopoutBound) {
      sparkContainer.dataset.tpPopoutBound = 'true';
      const openPopout = () => {
        const shareData = extractShareData(card);
        const title = shareData?.title || '';
        const currentCached = getCachedDealer(pid, useShipping);
        const currentDealer = currentCached?.dealer || extractDealer(card, useShipping) || '';
        const directUrl = currentCached?.url || (currentDealer ? extractDealerUrl(card, useShipping) : '');
        openSparklinePopout(sparkContainer._tpSeries, { title, pid, directUrl, dealer: currentDealer });
      };
      sparkContainer.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        openPopout();
      });
      sparkContainer.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          openPopout();
        }
      });
    }
    if (sparkContainer.dataset.tpSparkSig !== sig) {
      sparkContainer.dataset.tpSparkSig = sig;
      const svg = renderSparkline(sparkContainer._tpSeries, 44, 13);
      if (svg) {
        sparkContainer.replaceChildren();
        sparkContainer.appendChild(svg);
      }
    }
  } else {
    card.querySelector('.tp-sparkline-container')?.remove();
  }
  const histPriceEl = card.querySelector('.tp-card-historical-price');
  if (histPriceEl) {
    let subRow = card.querySelector('.tp-card-subline-row');
    if (!subRow) {
      subRow = document.createElement('div');
      subRow.className = 'tp-card-subline-row';
      card.appendChild(subRow);
      subRow.appendChild(histPriceEl);
    } else if (histPriceEl.parentElement !== subRow) {
      subRow.insertBefore(histPriceEl, subRow.firstChild);
    }
    if (sparkContainer && sparkContainer.parentElement !== subRow) {
      subRow.appendChild(sparkContainer);
    }
  } else {
    card.querySelector('.tp-card-subline-row')?.remove();
    if (sparkContainer) {
      const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                             cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                             cardPriceEl?.parentElement ||
                             card;
      if (sparkContainer.parentElement !== priceContainer) {
        priceContainer.appendChild(sparkContainer);
      }
    }
  }
}

// Badge verified/unverified cue (step 6).
export function applyVerifiedCue(ctx) {
  const { card, stats } = ctx;
  // 6. Badge geprüft/ungeprüft cue (always on): striped-gray ribbon when
  // unchecked, solid heat ribbon when verified. Loading badge gets neither.
  const badgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
  if (badgeEl) {
    if (badgeEl.classList.contains('tp-deal-loading')) {
      badgeEl.classList.remove('tp-is-unverified', 'tp-is-verified');
    } else if (!hasUsablePriceStats(stats)) {
      // Negative markers ({unavailable:true}) and thin histories are not
      // verified — truthiness of the stats object must not imply quality.
      badgeEl.classList.add('tp-is-unverified');
      badgeEl.classList.remove('tp-is-verified');
    } else {
      badgeEl.classList.add('tp-is-verified');
      badgeEl.classList.remove('tp-is-unverified');
    }
  }
}



// Dealer name left of price (step 8). Owns the loadDealer closure.
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
      if (el.style?.display === 'none') return false;
      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        try {
          const cs = window.getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        } catch { /* ignore */ }
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
      // Prepend: links vom "ab CHF"-Prefix. insertBefore(cardPriceEl) landete
      // dahinter (cardPriceEl ist nur die Zahl) und spaltete Prefix von Zahl.
      if (anchor !== card) anchor.insertBefore(el, anchor.firstChild);
      else anchor.appendChild(el);
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
      } else if (el.tagName === 'A' && hasUrl && el.getAttribute('href') !== targetUrl) {
        el.href = targetUrl;
      }
      setTextIfChanged(el, `🏬 ${dealer}`);
      setTitleIfChanged(el, directUrl && hasUrl ? `Günstigster Händler: ${dealer} — direkt zum Angebot` : `Günstigster Händler: ${dealer}`);
    } else if (hasUrl && !dealerCache.has(dKey)) {
      // Ein Loader für Klick + Auto-Fetch: Produktseite einmalig pro pid:Modus
      // (dealerPending-Guard), Ergebnis in Memory + localStorage, danach Render.
      const loadDealer = async () => {
        if (dealerPending.has(dKey)) return;
        dealerPending.add(dKey);
        // Stale-write guard: a clear/reset mid-flight voids the write; the
        // basis snapshot avoids resolving the live mode after the await.
        const reqGen = currentCacheGen();
        const reqShipping = useShipping;
        const reqKey = dKey;
        try {
          const info = await fetchProductInfo(productUrl, undefined, reqShipping).catch(() => null);
          if (reqGen !== currentCacheGen()) return;
          if (info?.dealer) { lruSet(dealerCache, reqKey, { dealer: info.dealer, url: info.dealerUrl || '', offers: info.offers || 0, totalOffers: info.totalOffers || 0 }); setCachedDealer(pid, reqShipping, info.dealer, info.dealerUrl || '', undefined, info.offers || 0, info.totalOffers || 0); }
        } finally {
          dealerPending.delete(dKey);
        }
        scheduleProcessListings();
      };
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
          btn.disabled = true;
          loadDealer();
        });
        place(btn);
      } else if (!dealerPending.has(dKey) && btn.disabled) {
        btn.disabled = false;
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
    }
  }
}

// Review search on product name (step 9).
export function renderReviewButton(ctx) {
  const { card } = ctx;
  // 9. Review-Suche (🌐) am Produktnamen: Ansicht, immer wenn aktiviert.
  // Titelquelle ist extractShareData (single source of truth, kein 2. Parser).
  const reviewName = (extractShareData(card).title || '').replace(/\s+/g, ' ').trim();
  if (CONFIG.REVIEW_SEARCH_ENABLED !== false && reviewName) {
    const rawKw = sanitizeReviewKeyword(CONFIG.REVIEW_SEARCH_KEYWORD);
    const priceText = (ctx.cardPrice > 0 && hasUsablePriceStats(ctx.stats)) ? `CHF ${ctx.cardPrice.toFixed(2)}` : '';
    const fullQuery = formatSearchQuery(reviewName, rawKw, priceText);
    const aiMode = CONFIG.REVIEW_SEARCH_AI_MODE === true;
    const hasTavily = !!(CONFIG.TAVILY_ENABLED && CONFIG.TAVILY_API_KEY && CONFIG.TAVILY_API_KEY.trim());
    let reviewBtn = card.querySelector('.tp-review-search-btn');
    if (!reviewBtn) {
      reviewBtn = document.createElement('a');
      reviewBtn.className = 'tp-review-search-btn';
      reviewBtn.textContent = '🌐';
      reviewBtn.target = '_blank';
      reviewBtn.rel = 'noopener';
      reviewBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (CONFIG.TAVILY_ENABLED) {
          if (CONFIG.TAVILY_API_KEY && CONFIG.TAVILY_API_KEY.trim()) {
            e.preventDefault();
            const aiCtx = reviewBtn._tpAiCtx || {};
            openAiPopover({
              title: aiCtx.title || reviewName,
              priceText: aiCtx.priceText || '',
              googleUrl: reviewBtn.href,
              card: aiCtx.card || card,
              pid: aiCtx.pid || ctx.pid
            });
          } else {
            showToast('💡 Tipp: Kostenlosen Tavily-Key in den Einstellungen (⚙️) hinterlegen für Direkt-Fazit auf der Karte');
          }
        }
      });
    }
    reviewBtn._tpAiCtx = { title: reviewName, priceText, card, pid: ctx.pid };
    reviewBtn.href = 'https://www.google.com/search?q=' + encodeURIComponent(fullQuery) + (aiMode ? '&udm=50' : '');
    const tipText = hasTavily
      ? `KI-Fazit & Google-Suche: ${fullQuery}`
      : `Google-Suche: ${fullQuery}${aiMode ? ' (KI-Modus)' : ''}`;
    setTitleIfChanged(reviewBtn, tipText);
    reviewBtn.setAttribute('aria-label', tipText);
    const titleEl = card.querySelector('.product-name, .productDetails, .bold, a[title]');
    if (titleEl && titleEl.tagName !== 'A' && reviewBtn.parentElement !== titleEl) titleEl.appendChild(reviewBtn);
    else if (titleEl && titleEl.tagName === 'A') {
      // The variant deal pill owns the slot directly after the title
      // (.bold + .tp-deal-pill); park the review button behind it so the
      // two inserters settle instead of ping-ponging every render pass.
      const anchor = titleEl.nextElementSibling?.classList?.contains('tp-deal-pill') ? titleEl.nextElementSibling : titleEl;
      if (reviewBtn.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', reviewBtn);
    }
    else if (!titleEl && reviewBtn.parentElement !== card) card.appendChild(reviewBtn);
  } else {
    card.querySelector('.tp-review-search-btn')?.remove();
  }
}

// Preisalarm bell trigger next to price (step 10).
export function renderAlarmBell(ctx) {
  const { card, pid, cardPriceEl } = ctx;
  if (!pid) {
    card.querySelector('.tp-card-alarm-btn')?.remove();
    return;
  }
  // If card already has native bell (e.g. catalog cards), don't inject a second bell
  if (card.querySelector('.Plugin_NewInfoMailButton')) {
    card.querySelector('.tp-card-alarm-btn')?.remove();
    return;
  }
  let bell = card.querySelector('.tp-card-alarm-btn');
  if (!bell) {
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
    const priceInfo = card.querySelector('.Plugin_PriceInformation, .price_information_product, .price_information_product_small');
    if (priceInfo) {
      priceInfo.appendChild(bell);
    } else {
      const anchor = (cardPriceEl?.parentElement?.contains(cardPriceEl) && cardPriceEl.parentElement) || card;
      if (anchor !== card) anchor.appendChild(bell);
      else card.appendChild(bell);
    }
  }
  refreshAlarmBellDecor();
}

// Fresh-deal glow for newly verified good deals.
export function applyFreshGlow(ctx) {
  const { card, pid, stats } = ctx;
  // Fresh-deal glow: only newly verified good deals pulse. The badge verdict
  // above is the single source of truth for "good deal" — no duplicate math.
  const freshBadge = card.querySelector('.tp-deal-new-record, .tp-deal-alltime-low');
  const isFresh = hasUsablePriceStats(stats) && scanState.freshPids.has(pid) && !!freshBadge;
  card.classList.toggle('tp-deal-fresh', isFresh);
}

export function renderEmptyState(cards, counts) {
  let emptyNotice = document.getElementById('tp-empty-state-notice');

  const totalHidden = counts.filteredCount || 0;

  // Filtern removes cards: empty state whenever all cards are removed.
  if (cards.length > 0 && totalHidden >= cards.length) {
    // Static notice: skip rebuild + listener re-bind when nothing changed
    const emptySig = `${cards.length}:${totalHidden}:${counts.uncheckedDeals || 0}:${realDealMinDiscount()}`;
    if (emptyNotice?.dataset.tpEmptySig === emptySig) return;
    if (!emptyNotice) {
      emptyNotice = document.createElement('div');
      emptyNotice.id = 'tp-empty-state-notice';
      emptyNotice.className = 'tp-empty-state-notice';
      const listParent = cards[0]?.parentElement;
      if (listParent) {
        listParent.insertBefore(emptyNotice, listParent.firstChild);
      }
    }
    const minDisc = realDealMinDiscount();
    emptyNotice.innerHTML = `
      <div>🚫 <strong>Alle ${cards.length} Angebote auf dieser Seite sind durch aktive Filter ausgeblendet.</strong></div>
      <div class="tp-empty-state-actions">
        ${counts.uncheckedDeals > 0 ? `<button class="tp-empty-state-btn" id="tp-empty-check-deals-btn" style="border-color: #3b82f6; color: #2563eb;" title="Prüft Differenzen ≥ ${minDisc}% (ungeprüft ≠ Tiefstpreis)">🔍 Tiefstpreise prüfen (≥${minDisc}%)</button>` : ''}
        ${CONFIG.BESTPREISE_HIDE_UNCHECKED === true && CONFIG.HIDE_UNCHECKED_MODE === 'hide' ? `<button class="tp-empty-state-btn" id="tp-empty-hide-unchecked-btn" title="Ungeprüfte wieder einblenden (${counts.uncheckedHidden || 0})">Ungeprüfte einblenden</button>` : ''}
        <button class="tp-empty-state-btn" id="tp-empty-toggle-filters-btn" title="Alle Filter pausieren (alles anzeigen)">⚡ Filter ausschalten</button>
      </div>
    `;

    emptyNotice.dataset.tpEmptySig = emptySig;
    emptyNotice.querySelector('#tp-empty-check-deals-btn')?.addEventListener('click', () => {
      // Toolbar batch button removed: the floating CTA owns this action now.
      // startBatchCheck works even when the pill is collapsed or auto-hidden.
      startBatchCheck();
    });
    emptyNotice.querySelector('#tp-empty-hide-unchecked-btn')?.addEventListener('click', () => {
      updateConfig('BESTPREISE_HIDE_UNCHECKED', false);
      showToast('✓ Ungeprüfte aus — alle werden wieder angezeigt');
    });

    emptyNotice.querySelector('#tp-empty-toggle-filters-btn')?.addEventListener('click', () => {
      const updates = {};
      for (const def of FILTER_CAUSE_DEFS) {
        if (def.enableKey) updates[def.enableKey] = def.resetVal ?? false;
        if (def.resetMode) updates[def.modeKey] = def.resetMode;
      }
      updateConfigs(updates);
      showToast('⏸️ Alle Filter pausiert (alle Angebote sichtbar)');
    });
  } else if (emptyNotice) {
    emptyNotice.remove();
  }
}

// Orchestrator (signature frozen — app.js untouched): builds ctx once,
// paints heat + verdict, then chrome steps in the original order.
export function renderCardEffects(cd, filters, isNeueFeed, activeStores) {
  const { card, pid, cardPriceEl, cardPrice, cardPriceBasis, basisMatches, stats, diffVal } = cd;
  // Rejected verdicts (null) stay rejected: only an uncalculated verdict
  // (undefined, e.g. a partial struct) may compute — and only on a matching basis.
  const basisOk = basisMatches ?? basisMatchesFor(stats, cardPriceBasis);
  const vStats = cd.verifiedStats ?? (basisOk ? stats : null);
  const displayDelta = cd.displayDelta ?? (vStats ? getDisplayDelta(cardPrice, vStats) : { kind: 'unknown' });
  const dealData = cd.dealScore === undefined && vStats ? computeDealScore(vStats, cardPrice) : (cd.dealScore ?? null);
  const heatMode = CONFIG.BESTPREISE_MODE_ACTIVE ? 'bestpreise' : 'browse';
  const heatInfo = getHeatInput(cardPrice, vStats, diffVal, heatMode, dealData);
  const effectiveDiff = heatInfo.value;
  const ctx = { card, pid, cardPrice, cardPriceEl, stats: vStats, diffVal, dealData, displayDelta, heatInfo, effectiveDiff };
  renderBadgeVerdict(ctx, filters, isNeueFeed);
  renderHeat(ctx);
  renderFilterVerdict(ctx, filters, activeStores);
  renderSparklineRow(ctx);
  applyVerifiedCue(ctx);
  renderShareButton(ctx, cd);
  renderDealerName(ctx, filters);
  renderAlarmBell(ctx);
  renderReviewButton(ctx);
  applyFreshGlow(ctx);
}
