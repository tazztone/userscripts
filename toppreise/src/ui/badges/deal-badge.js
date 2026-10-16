/**
 * Deal badge (split from ui/badges.js): dealer memory + verify flow, card heat
 * wash (renderHeat) and badge verdict (renderBadgeVerdict, steps 0-4).
 * Both halves take one shared ctx computed once by the card-chrome orchestrator:
 * {card, pid, cardPrice, cardPriceEl, stats, diffVal, dealData, displayDelta,
 * heatInfo, effectiveDiff} — neither half recomputes (ADR-0005 single-source rule).
 */

import { CONFIG } from '../../state/config.js';
import { getBadgeHeatStyle, getInsetHeatStyle, getCardDealerRows, extractCardDiscount, getCardProductId, dealerLoserFor } from '../../page/cards.js';
import { getCardSortableUnit } from '../../page/sort.js';
import { extractCanonicalPrice, parsePrice, priceToCents } from '../../domain/price.js';
import { fetchSingleProductPriceStats } from '../../scanner/scanner.js';
import { getCachedPriceStats, hasUsablePriceStats, bumpCacheGeneration } from '../../scanner/cache.js';
import { isShippingPriceActive, triggerProcessListings } from '../../page/adapter.js';
import { markFreshVerified, armFreshDismiss } from '../fresh-dismiss.js';
import { scanState, isScanningPid } from '../../state/store.js';

// Single-product verify flow. Reads price at click time and re-verifies it
// after fetch so a stale or swapped card never paints another product's stats.
// Händlername (§8 in renderCardEffects): Memory-Map pid:Modus -> Name.
// Nur echte Namen landen im Cache (leere Treffer nicht: der Button bleibt für
// Retry). Fetch per 🏬-Klick oder — opt-in via DEALER_AUTOFETCH — automatisch
// beim Rendern. Persistiert in localStorage (get/setCachedDealer, gleiche TTL
// wie Preishistorie); pro pid:Modus ein Storage-Read pro Pageload
// (dealerHydrated-Guard). Modus im Key, weil der günstigste Händler von der
// Preisbasis abhängt.
export const dealerCache = new Map();
export const dealerPending = new Set();
export const dealerHydrated = new Set();
// Auto-Fetch (DEALER_AUTOFETCH): einmal pro pid:Modus und Pageload feuern —
// ohne den Guard würde jeder Render nach einem Fehlschlag neu fetchen.
export const dealerAutoTried = new Set();
export function clearDealerMemory() {
  dealerCache.clear();
  dealerHydrated.clear();
  dealerAutoTried.clear();
  bumpCacheGeneration();
}
export function clearDealerAutoTried() {
  dealerAutoTried.clear();
}
async function runSingleDealCheck(card, badgeDifEl) {
  if (badgeDifEl.classList.contains('tp-deal-loading')) return;
  const reqPid = getCardProductId(card);
  const cardPriceData = extractCanonicalPrice(card);
  const reqBasis = cardPriceData.basis;
  const reqPrice = cardPriceData.price;
  const reqCents = priceToCents(reqPrice);
  const isListView = badgeDifEl.classList.contains('tp-deal-pill');
  badgeDifEl.classList.add('tp-deal-loading');
  if (isListView) {
    badgeDifEl.innerHTML = `<span>⏳</span><p>Prüfe...</p>`;
  } else {
    badgeDifEl.innerHTML = `<div class="text">Prüfe...</div><p>⏳</p>`;
  }
  scanState.singleScanningPids.add(reqPid);
  let fetchedStats = null;
  try {
    fetchedStats = await fetchSingleProductPriceStats(reqPid, 1, true, null, Number.isFinite(reqPrice) && reqPrice > 0 ? reqPrice : null, null, reqBasis);
  } finally {
    scanState.singleScanningPids.delete(reqPid);
  }
  if (!card.isConnected || !badgeDifEl.isConnected || getCardProductId(card) !== reqPid || extractCanonicalPrice(card).basis !== reqBasis || priceToCents(extractCanonicalPrice(card).price) !== reqCents) {
    badgeDifEl.classList.remove('tp-deal-loading');
    triggerProcessListings();
    return;
  }
  badgeDifEl.classList.remove('tp-deal-loading');
  if (fetchedStats) {
    armFreshDismiss();
    markFreshVerified(reqPid);
    triggerProcessListings();
  } else {
    badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-not-low', 'tp-is-severe-markup');
    if (isListView) {
      badgeDifEl.innerHTML = `<span>⚠️</span><p>n/v</p>`;
    } else {
      badgeDifEl.innerHTML = `<div class="text">Fehler</div><p style="font-size: 13px;">⚠️ n/v</p>`;
    }
    badgeDifEl.title = '⚠️ Preishistorie zurzeit nicht verfügbar (Klicken für erneuten Versuch)';
    setTimeout(() => {
      if (badgeDifEl?.isConnected && !hasUsablePriceStats(getCachedPriceStats(reqPid, false, null, reqBasis ? reqBasis === 'shipping' : null))) {
        triggerProcessListings();
      }
    }, 2500);
  }
}

// Heatmap wash (blind): gray (no deal) -> red (max savings). Single hue
// (ADR-0005: badge shows the blend, heat/sort follow it). heatInfo comes
// from the orchestrator — never recomputed here.
export function renderHeat(ctx) {
  const { card, pid, stats, heatInfo, effectiveDiff } = ctx;
  const verified = hasUsablePriceStats(stats);
  const heatIntensity = CONFIG.HEATMAP_INTENSITY * (verified ? 1 : 0.35);
  // Blind inset wash: every heatable card gets the same prominent signal,
  // clipped to the card's own edges.
  if (CONFIG.HEATMAP_ENABLED && effectiveDiff !== null && !isNaN(effectiveDiff)) {
    const heatKey = `${effectiveDiff}_${heatIntensity.toFixed(2)}`;
    if (card.dataset.tpAppliedHeat !== heatKey) {
      card.dataset.tpAppliedHeat = heatKey;
      const heat = getInsetHeatStyle(heatInfo.pct, heatIntensity);
      card.classList.toggle('tp-heat-blend', true);
      card.style.setProperty('--tp-heat-glow', heat.glow);
      card.style.setProperty('--tp-heat-color', heat.color);
      card.style.setProperty('box-shadow', heat.glow, 'important');
    }
    // Badge follows the card heat: same ramp, solid swatch. Synced on every
    // render (not only on heatKey change) so re-rendered badge nodes can't
    // desync from the card. Verified-only: unverified cards keep the striped
    // `.tp-is-unverified` cue on the badge while the card body still glows.
    const heatBadgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
    if (heatBadgeEl && hasUsablePriceStats(stats)) {
      const badgeHeat = getBadgeHeatStyle(effectiveDiff, false, CONFIG.HEATMAP_INTENSITY);
      heatBadgeEl.style.setProperty('background', badgeHeat.background, 'important');
      heatBadgeEl.style.setProperty('border-color', badgeHeat.border, 'important');
      heatBadgeEl.style.setProperty('color', '#ffffff', 'important');
      heatBadgeEl.style.setProperty('box-shadow', '0 2px 10px rgba(0,0,0,0.45)', 'important');
    }
    else if (heatBadgeEl) {
      heatBadgeEl.style.removeProperty('background');
      heatBadgeEl.style.removeProperty('border-color');
      heatBadgeEl.style.removeProperty('color');
      heatBadgeEl.style.removeProperty('box-shadow');
    }
  } else if (card.dataset.tpAppliedHeat || card.classList.contains('tp-heat-blend') || card.querySelector('.badge-dif, [class*="badge-dif"]')?.style.background) {
    // Tripwire: heat stripped while the badge still claims a verified % means
    // a stats regression slipped through — enable DEBUG to catch it live.
    if (CONFIG.DEBUG && card.querySelector('.tp-deal-alltime-low, .tp-deal-new-record')) {
      console.warn('[Toppreise Suite] heat removed with verified badge present',
        { pid, median: stats?.medianPrice ?? null, tiefstpreis: stats?.tiefstpreis ?? null });
    }
    delete card.dataset.tpAppliedHeat;
    card.style.removeProperty('box-shadow');
    card.classList.remove('tp-heat-blend');
    card.style.removeProperty('--tp-heat-glow');
    card.style.removeProperty('--tp-heat-color');
    // Undo the badge heat coupling from the apply path above
    const heatBadgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
    if (heatBadgeEl) {
      heatBadgeEl.style.removeProperty('background');
      heatBadgeEl.style.removeProperty('border-color');
      heatBadgeEl.style.removeProperty('color');
      heatBadgeEl.style.removeProperty('box-shadow');
    }
  }
  // 1b. Geprüft vs ungeprüft card cue: verified cards carry tp-is-verified.
  // Unchecked cards stay at full opacity — the badge-level striped ribbon
  // (step 6) is the only ungeprüft signal. Loading cards get neither class.
   if (isScanningPid(pid)) {
    card.classList.remove('tp-is-verified');
   } else if (hasUsablePriceStats(stats)) {
     card.classList.add('tp-is-verified');
   } else {
    card.classList.remove('tp-is-verified');
   }
}


// Filter + dealer verdict (steps 2-3): hide/dim flags land on `filters`
// (isFiltered/isDimmed/isDealerLoser) for the scan counters downstream.
export function renderFilterVerdict(ctx, filters, activeStores) {
  const { card, stats, cardPrice } = ctx;
  // 2. Filters
  card.classList.toggle('tp-negative-filtered', filters.isNeg);
  card.classList.toggle('tp-min-offers-filtered', filters.isLowOffers);
  card.classList.toggle('tp-vortief-excluded', filters.isVortiefExcluded === true);

  // 3. Toppreis Highlighting (filtered store holds the cheapest offer).
  // Dealer verdict is single-sourced from dealerLoserFor (cards.js) — no
  // price comparison here. Both loser kinds share one presentation, so all
  // losers read tp-not-cheapest; tp-no-store-offer is only ever removed.
  const dealerRows = activeStores.length > 0 ? getCardDealerRows(card) : [];
  if (activeStores.length === 0 || dealerRows.length === 0) {
    card.classList.remove('tp-is-cheapest', 'tp-not-cheapest', 'tp-no-store-offer');
    card.querySelector('.tp-best-price-badge')?.remove();
    filters.isDealerLoser = false;
  } else if (dealerLoserFor(card, activeStores)) {
    card.classList.add('tp-not-cheapest');
    card.classList.remove('tp-is-cheapest', 'tp-no-store-offer');
    card.querySelector('.tp-best-price-badge')?.remove();
    filters.isDealerLoser = true;
  } else {
    card.classList.add('tp-is-cheapest');
    card.classList.remove('tp-not-cheapest', 'tp-no-store-offer');
    if (!card.querySelector('.tp-best-price-badge')) {
      const badge = document.createElement('div');
      badge.className = 'tp-best-price-badge';
      badge.textContent = 'Toppreis';
      card.appendChild(badge);
    }
    filters.isDealerLoser = false;
  }
  const isHide = m => m !== 'dim' && m !== 'highlight';
  const hide = (filters.isNeg && isHide(CONFIG.FILTER_NEG_MODE))
    || (filters.isLowOffers && isHide(CONFIG.FILTER_MIN_MODE))
    || (filters.isDealerLoser && isHide(CONFIG.DEALER_MODE))
    || (filters.isVortiefExcluded && isHide(CONFIG.VORTIEF_MODE))
    || (filters.isUnchecked && isHide(CONFIG.HIDE_UNCHECKED_MODE));
  const dim = !hide && ((filters.isNeg && CONFIG.FILTER_NEG_MODE === 'dim')
    || (filters.isLowOffers && CONFIG.FILTER_MIN_MODE === 'dim')
    || (filters.isDealerLoser && CONFIG.DEALER_MODE === 'dim')
    || (filters.isVortiefExcluded && CONFIG.VORTIEF_MODE === 'dim')
    || (filters.isUnchecked && CONFIG.HIDE_UNCHECKED_MODE === 'dim'));
  const highlight = !hide && !dim && ((filters.isNeg && CONFIG.FILTER_NEG_MODE === 'highlight')
    || (filters.isLowOffers && CONFIG.FILTER_MIN_MODE === 'highlight')
    || (filters.isDealerLoser && CONFIG.DEALER_MODE === 'highlight')
    || (filters.isVortiefExcluded && CONFIG.VORTIEF_MODE === 'highlight')
    || (filters.isUnchecked && CONFIG.HIDE_UNCHECKED_MODE === 'highlight'));
  filters.isFiltered = hide;   // narrowed: hidden-only (name kept, all consumers want hidden)
  filters.isDimmed = dim;
  filters.isHighlighted = highlight;
  card.classList.toggle('tp-filtered', hide);
  card.classList.toggle('tp-dimmed', dim);
  card.classList.toggle('tp-highlighted', highlight);
  const sortUnit = getCardSortableUnit(card);
  if (sortUnit && sortUnit !== card) sortUnit.classList.toggle('tp-col-filtered', hide);
}

// Badge setup (step 4 head): placement, first-render heat catch-up, discount
// parse, single check-control binding. Returns null when there is no badge
// node (caller runs the no-badge cleanup instead).
export function renderBadgeSetup(ctx, isNeueFeed) {
  const { card, pid, cardPriceEl, stats, effectiveDiff } = ctx;
  if (!pid) return null;
  // 4. Tiefstpreis-Check (Consolidated into Differenz Circle Badge)
  let badgeDifEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
  // Remove any legacy floating wrappers if present
  card.querySelector('.tp-real-deal-wrapper')?.remove();

  const isListView = !isNeueFeed && (
    card.classList.contains('mixedBrowsingList') ||
    card.classList.contains('mixedBrowsingListProduct') ||
    !!card.querySelector('.priceAvailabilityContainer, .price-availability') ||
    !!card.closest('#Page_Browsing, .Page_Browsing')
  );
  const isSubcard = card.classList.contains('f_collection') || !!card.closest('.Plugin_ProductCollectionRelProductsList');

  if (!badgeDifEl && pid) {
    badgeDifEl = document.createElement('div');
    badgeDifEl.className = 'badge badge-dif tp-injected-badge';
  }

  if (badgeDifEl) {
    if (isListView) {
      badgeDifEl.classList.add('tp-deal-pill');
      if (isSubcard) {
        const titleContainer = card.querySelector('.bold') || card.querySelector('.product-name');
        if (titleContainer) {
          if (badgeDifEl.parentElement !== titleContainer.parentNode || badgeDifEl.previousElementSibling !== titleContainer) {
            titleContainer.insertAdjacentElement('afterend', badgeDifEl);
          }
        } else if (badgeDifEl.parentElement !== card) {
          card.appendChild(badgeDifEl);
        }
      } else {
        const priceInfo = card.querySelector('.Plugin_PriceInformation, .price_information_product');
        if (priceInfo) {
          if (badgeDifEl.parentElement !== priceInfo) {
            priceInfo.insertBefore(badgeDifEl, priceInfo.firstChild);
          }
        } else if (badgeDifEl.parentElement !== card) {
          card.appendChild(badgeDifEl);
        }
      }
    } else {
      badgeDifEl.classList.remove('tp-deal-pill');
      if (badgeDifEl.parentElement !== card) {
        card.appendChild(badgeDifEl);
      }
    }
    // Fresh-injected node missed the heat pass above (it didn't exist yet):
    // re-apply the same badge swatch so first render matches.
    if (hasUsablePriceStats(stats) && CONFIG.HEATMAP_ENABLED && effectiveDiff !== null && !isNaN(effectiveDiff)) {
      const badgeHeat = getBadgeHeatStyle(effectiveDiff, false, CONFIG.HEATMAP_INTENSITY);
      if (badgeHeat) {
        badgeDifEl.style.setProperty('background', badgeHeat.background, 'important');
        badgeDifEl.style.setProperty('border-color', badgeHeat.border, 'important');
        badgeDifEl.style.setProperty('color', '#ffffff', 'important');
        badgeDifEl.style.setProperty('box-shadow', '0 2px 10px rgba(0,0,0,0.45)', 'important');
      }
    }
    // Snapshot keyed to product: a reused card node (new pid) must re-read
    // the host badge instead of printing the previous product's number.
    if (badgeDifEl.dataset.tpOriginalPid !== (pid ?? '') || !('tpOriginalDiscount' in badgeDifEl.dataset) || badgeDifEl.dataset.tpOriginalDiscount === '') {
      const initialDiscount = extractCardDiscount(card);
      badgeDifEl.dataset.tpOriginalDiscount = (initialDiscount !== null && !isNaN(initialDiscount)) ? String(initialDiscount) : '';
      badgeDifEl.dataset.tpOriginalPid = pid ?? '';
    }
    const rawDiscount = badgeDifEl.dataset.tpOriginalDiscount !== '' ? parseFloat(badgeDifEl.dataset.tpOriginalDiscount) : null;
    // rawDiscount is the site DISCOUNT (positive = "-X%" deal, negative = "+X%"
    // markup). Render it sign-aware so markup badges never print "--X%".
    const sitePctText = (rawDiscount !== null && !isNaN(rawDiscount))
      ? (rawDiscount >= 0 ? `-${rawDiscount}%` : `+${-rawDiscount}%`)
      : '';

    // Single check control: badge handles mouse + keyboard; there is no separate loupe button.
    if (!badgeDifEl.dataset.tpDealBound) {
      badgeDifEl.dataset.tpDealBound = 'true';
      badgeDifEl.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        runSingleDealCheck(card, badgeDifEl);
      });
      badgeDifEl.setAttribute('role', 'button');
      badgeDifEl.setAttribute('tabindex', '0');
      badgeDifEl.setAttribute('aria-label', 'Differenz prüfen');
      badgeDifEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          runSingleDealCheck(card, badgeDifEl);
        }
      });
    }
    return { badgeDifEl, isListView, sitePctText, rawDiscount };
  }
  return null;
}
