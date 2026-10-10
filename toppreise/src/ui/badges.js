/**
 * Visual Badges & Card Decorator Component
 * Manages card thermal heatmaps, deal badges (Allzeit-Tiefstpreis,
 * Neuer Rekord, Differenz loupe, markup alert), score breakdown pills,
 * mini sparklines, and empty-state messaging.
 */

import { CONFIG, updateConfig } from '../state/config.js';
import {
  getBadgeHeatStyle,
  getHeatmapStyles,
  getEdgeHeatStyle,
  getCardDealerRows,
  extractCardDiscount,
  getCardProductId
} from '../page/cards.js';
import { isDiscordWebhookUrl, formatDealMessage, resolveShareFields, extractShareData, extractDealer, extractDealerUrl, sparklineText, withLivePrice, fetchProductInfo, renderSparklinePng, postDealImageToDiscord, postDealToDiscord } from '../features/share-discord.js';
import { extractCanonicalPrice, parsePrice, priceToCents, recordRefForPrice } from '../domain/price.js';
import { computeDealScore, getDisplayDelta, getHeatInput, isSignificantRecord, medianHorizonLabel, vortiefDropPct } from '../domain/deal-score.js';
import {
  fetchSingleProductPriceStats,
  cancelBestpreiseScan
} from '../scanner/scanner.js';
import { startBatchCheck } from './floating-cta.js';
import { scanState } from '../state/store.js';
import { getCachedPriceStats, getCachedDealer, setCachedDealer, MAX_MEMORY_CACHE_ITEMS } from '../scanner/cache.js';
import { showToast } from './toast.js';
import { renderSparkline } from './sparkline.js';
import { isShippingPriceActive, triggerProcessListings } from '../page/adapter.js';

function setHtmlIfChanged(el, newHtml) {
  if (el && el.innerHTML !== newHtml) {
    el.innerHTML = newHtml;
  }
}

export function setTextIfChanged(el, newText) {
  if (el && el.textContent !== newText) {
    el.textContent = newText;
  }
}

function setTitleIfChanged(el, newTitle) {
  if (el && el.title !== newTitle) {
    el.title = newTitle;
  }
}

// Sub-elements the heatmap touches (apply + removal must use the same set)
const HEAT_SUB_SELECTOR =
  '.row, .col, [class*="col-"], .priceAvailabilityContainer, .price-availability, ' +
  '.offersContainer, .offers, .priceContainer, .Plugin_Price, .productPrice, .shippingPrice, .shippingText, ' +
  '.manufacturer-image, .product-name, .productDetails, .price_information_product, .Plugin_PriceInformation, ' +
  '.f_product_info, .productDescription, .productDetailsDescription, .product-details, .f_product_container, ' +
  '.product-image, .productImage, .image_container, .image, [data-darkreader-inline-bgcolor], [data-darkreader-inline-bgimage]';

function ensureHistPriceEl(card, cardPriceEl) {
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
// Single-product verify flow, shared by the badge click and its keyboard twin,
// the adjacent .tp-loupe button. Reads price at click time and re-verifies it
// after fetch so a stale or swapped card never paints another product's stats.
const loupeBtnByBadge = new WeakMap();
// Händlername-Anzeige (§8 in renderCardEffects): Memory-Map pid:Modus -> Name.
// Nur echte Namen landen im Cache (leere Treffer nicht: der Button bleibt für
// Retry). Fetch per 🏬-Klick oder — opt-in via DEALER_AUTOFETCH — automatisch
// beim Rendern. Persistiert in localStorage (get/setCachedDealer, gleiche TTL
// wie Preishistorie); pro pid:Modus ein Storage-Read pro Pageload
// (dealerHydrated-Guard). Modus im Key, weil der günstigste Händler von der
// Preisbasis abhängt.
const dealerCache = new Map();
const dealerPending = new Set();
const dealerHydrated = new Set();
// Auto-Fetch (DEALER_AUTOFETCH): einmal pro pid:Modus und Pageload feuern —
// ohne den Guard würde jeder Render nach einem Fehlschlag neu fetchen.
const dealerAutoTried = new Set();
export const dealerCacheKey = (pid, useShipping) => `${pid}:${useShipping ? 's' : 'p'}`;
function rememberDealer(dKey, value) {
  dealerCache.delete(dKey);
  dealerCache.set(dKey, value);
  if (dealerCache.size > MAX_MEMORY_CACHE_ITEMS) dealerCache.delete(dealerCache.keys().next().value);
}
export function clearDealerMemory() {
  dealerCache.clear();
  dealerHydrated.clear();
  dealerAutoTried.clear();
}
async function runSingleDealCheck(card, badgeDifEl) {
  if (badgeDifEl.classList.contains('tp-deal-loading')) return;
  const currentPid = getCardProductId(card);
  if (!currentPid) return;
  loupeBtnByBadge.get(badgeDifEl)?.remove();
  badgeDifEl.classList.add('tp-deal-loading');
  badgeDifEl.innerHTML = `<div class="text">Prüfe...</div><p>⏳</p>`;
  const requestTimePrice = extractCanonicalPrice(card).price;
  const fetchedStats = await fetchSingleProductPriceStats(currentPid, 1, true);
  const currentTimePrice = extractCanonicalPrice(card).price;
  if (!requestTimePrice || !currentTimePrice || priceToCents(requestTimePrice) !== priceToCents(currentTimePrice)) {
    badgeDifEl.classList.remove('tp-deal-loading');
    triggerProcessListings();
    return;
  }
  badgeDifEl.classList.remove('tp-deal-loading');
  if (fetchedStats) {
    triggerProcessListings();
  } else {
    badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-not-low', 'tp-is-severe-markup');
    badgeDifEl.innerHTML = `<div class="text">Fehler</div><p style="font-size: 13px;">⚠️ n/v</p>`;
    badgeDifEl.title = '⚠️ Preishistorie zurzeit nicht verfügbar (Klicken für erneuten Versuch)';
    setTimeout(() => {
      if (badgeDifEl && !getCachedPriceStats(currentPid)) {
        triggerProcessListings();
      }
    }, 2500);
  }
}

export function renderCardEffects(cd, filters, isNeueFeed, activeStores) {
  const { card, pid, cardPriceEl, cardPrice, stats, diffVal } = cd;
  const displayDelta = cd.displayDelta || getDisplayDelta(cardPrice, stats);
  const dealData = cd.dealScore ?? computeDealScore(stats, cardPrice);

  // Heatmap: gray (no deal) -> red (max savings), single hue (ADR-0005: badge
  // shows the blend, heat/sort follow it). One computation (getHeatInput)
  // feeds BOTH the card heat here and the badge number below, so the ribbon
  // number always matches its color. The blend sorts too.
  // Unverified site discounts never heat: they read striped-gray via
  // tp-is-unverified (step 1b/6 below), verified cards heat as before.
  const heatMode = CONFIG.BESTPREISE_MODE_ACTIVE ? 'bestpreise' : 'browse';
  const heatInfo = getHeatInput(cardPrice, stats, diffVal, heatMode, dealData);
  const effectiveDiff = heatInfo.value;
  const heatProvisional = heatInfo.provisional;
  const heatIntensity = CONFIG.HEATMAP_INTENSITY;

  // Geprüft vs ungeprüft: only verified stats heat the card/badge. Provisional
  // site Differenzen stay neutral — the tp-is-unverified class below paints
  // them gray-striped instead, so the state scans without comparing saturation.
  // Vortief heat (mode, verified low without blend): same ramp hue, but the
  // signal lives in an inset inner glow — never a full wash, never past the
  // card's own edges — so the fallback can't pass as a blended deal.
  const isVortiefHeat = heatInfo.kind === 'vortief';
  if (CONFIG.HEATMAP_ENABLED && !heatProvisional && effectiveDiff !== null && !isNaN(effectiveDiff)) {
    const heatKey = `${heatInfo.kind}:${effectiveDiff}_${heatIntensity.toFixed(2)}`;
    if (card.dataset.tpAppliedHeat !== heatKey) {
      card.dataset.tpAppliedHeat = heatKey;
      card.classList.toggle('tp-heat-vortief', isVortiefHeat);
      const edge = isVortiefHeat ? getEdgeHeatStyle(heatInfo.pct, heatIntensity) : null;
      const heatStyles = getHeatmapStyles(effectiveDiff, heatIntensity);
      if (edge) { heatStyles.border = edge.border; heatStyles.glow = edge.glow; }
      if (!edge) card.style.setProperty('--tp-heat-bg', heatStyles.bg);
      card.style.setProperty('--tp-heat-border', heatStyles.border);
      card.style.setProperty('--tp-heat-glow', heatStyles.glow);

      // DarkReader Dynamic Theme compatibility:
      if (!edge) card.style.setProperty('--darkreader-inline-bgimage', heatStyles.bg);
      card.style.setProperty('--darkreader-inline-bgcolor', 'transparent');
      card.style.setProperty('--darkreader-inline-border', heatStyles.border);
      card.style.setProperty('--darkreader-inline-border-top', heatStyles.border);
      card.style.setProperty('--darkreader-inline-border-right', heatStyles.border);
      card.style.setProperty('--darkreader-inline-border-bottom', heatStyles.border);
      card.style.setProperty('--darkreader-inline-border-left', heatStyles.border);
      if (!edge) card.style.setProperty('background', heatStyles.bg, 'important');
      if (!edge) card.style.setProperty('background-image', heatStyles.bg, 'important');
      card.style.setProperty('border-color', heatStyles.border, 'important');
      if (edge) card.style.setProperty('box-shadow', edge.glow, 'important');

      if (card.hasAttribute('data-darkreader-inline-bgcolor')) card.removeAttribute('data-darkreader-inline-bgcolor');
      if (card.hasAttribute('data-darkreader-inline-bgimage')) card.removeAttribute('data-darkreader-inline-bgimage');

      // Edge heat keeps the site background: bleaching sub-elements would erase it.
      const subElements = !edge ? card.querySelectorAll(HEAT_SUB_SELECTOR) : [];
      for (let s = 0; s < subElements.length; s++) {
        const sub = subElements[s];
        if (sub.classList.contains('badge') || sub.classList.contains('tp-deal-pill') ||
            sub.classList.contains('tp-best-price-badge') ||
            sub.classList.contains('tp-sparkline-container') || sub.tagName === 'BUTTON') {
          continue;
        }
        if (sub.hasAttribute('data-darkreader-inline-bgcolor')) sub.removeAttribute('data-darkreader-inline-bgcolor');
        if (sub.hasAttribute('data-darkreader-inline-bgimage')) sub.removeAttribute('data-darkreader-inline-bgimage');
        sub.style.setProperty('background-color', 'transparent', 'important');
        sub.style.setProperty('background', 'transparent', 'important');
        sub.style.setProperty('--darkreader-inline-bgcolor', 'transparent');
        sub.style.setProperty('--darkreader-inline-bgimage', 'none');
      }

      if (!edge) card.classList.add('tp-heatmap-active');
    }
    // Badge follows the card heat: same ramp, solid swatch. Synced on every
    // render (not only on heatKey change) so re-rendered badge nodes can't
    // desync from the card. Provisional input never reaches this path (see
    // the !heatProvisional gate above) — unverified ribbons are class-painted.
    const heatBadgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
    if (heatBadgeEl) {
      const badgeHeat = getBadgeHeatStyle(effectiveDiff, heatProvisional, CONFIG.HEATMAP_INTENSITY);
      heatBadgeEl.style.setProperty('background', badgeHeat.background, 'important');
      heatBadgeEl.style.setProperty('border-color', badgeHeat.border, 'important');
      heatBadgeEl.style.setProperty('color', '#ffffff', 'important');
      heatBadgeEl.style.setProperty('box-shadow', '0 2px 10px rgba(0,0,0,0.45)', 'important');
      heatBadgeEl.style.setProperty('--darkreader-inline-bgcolor', badgeHeat.background);
    }
  } else if (card.dataset.tpAppliedHeat || card.classList.contains('tp-heatmap-active') || card.classList.contains('tp-heat-vortief')) {
    // Tripwire: heat stripped while the badge still claims a verified % means
    // a stats regression slipped through — enable DEBUG to catch it live.
    if (CONFIG.DEBUG && card.querySelector('.tp-deal-alltime-low, .tp-deal-new-record')) {
      console.warn('[Toppreise Suite] heat removed with verified badge present',
        { pid, median: stats?.medianPrice ?? null, tiefstpreis: stats?.tiefstpreis ?? null });
    }
    delete card.dataset.tpAppliedHeat;
    if (card.classList.contains('tp-heat-vortief')) card.style.removeProperty('box-shadow');
    card.classList.remove('tp-heatmap-active', 'tp-heat-vortief');
    card.style.removeProperty('--tp-heat-bg');
    card.style.removeProperty('--tp-heat-border');
    card.style.removeProperty('--tp-heat-glow');
    card.style.removeProperty('--darkreader-inline-bgimage');
    card.style.removeProperty('--darkreader-inline-bgcolor');
    card.style.removeProperty('--darkreader-inline-border');
    card.style.removeProperty('--darkreader-inline-border-top');
    card.style.removeProperty('--darkreader-inline-border-right');
    card.style.removeProperty('--darkreader-inline-border-bottom');
    card.style.removeProperty('--darkreader-inline-border-left');
    card.style.removeProperty('background');
    card.style.removeProperty('background-image');
    card.style.removeProperty('background-color');
    card.style.removeProperty('border-color');
    // Undo the badge heat coupling from the apply path above
    const heatBadgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
    if (heatBadgeEl) {
      heatBadgeEl.style.removeProperty('background');
      heatBadgeEl.style.removeProperty('border-color');
      heatBadgeEl.style.removeProperty('color');
      heatBadgeEl.style.removeProperty('box-shadow');
      heatBadgeEl.style.removeProperty('--darkreader-inline-bgcolor');
    }
    // Undo the per-subelement overrides from the apply path above
    for (const sub of card.querySelectorAll(HEAT_SUB_SELECTOR)) {
      sub.style.removeProperty('background-color');
      sub.style.removeProperty('background');
      sub.style.removeProperty('--darkreader-inline-bgcolor');
      sub.style.removeProperty('--darkreader-inline-bgimage');
    }
  }
  // 1b. Geprüft vs ungeprüft card cue (always on, independent of Heatmap):
  // no stats = never checked. Loading cards get neither class.
  if (scanState.currentlyScanningPid && scanState.currentlyScanningPid === pid) {
    card.classList.remove('tp-is-unverified', 'tp-is-verified');
  } else if (!stats) {
    card.classList.add('tp-is-unverified');
    card.classList.remove('tp-is-verified');
  } else {
    card.classList.add('tp-is-verified');
    card.classList.remove('tp-is-unverified');
  }

  // 2. Filters
  card.classList.toggle('tp-negative-filtered', filters.isNeg);
  card.classList.toggle('tp-min-offers-filtered', filters.isLowOffers);

  // 3. Toppreis Highlighting (filtered store holds the cheapest offer).
  // Dealer verdict is single-sourced from dealerLoserFor (cards.js) — no
  // price comparison here. Both loser kinds share one presentation, so all
  // losers read tp-not-cheapest; tp-no-store-offer is only ever removed.
  const dealerRows = activeStores.length > 0 ? getCardDealerRows(card) : [];
  if (activeStores.length === 0 || dealerRows.length === 0) {
    card.classList.remove('tp-is-cheapest', 'tp-not-cheapest', 'tp-no-store-offer');
    card.querySelector('.tp-best-price-badge')?.remove();
    filters.isDealerLoser = false;
  } else if (dealerLoserFor(card, activeStores, isNeueFeed)) {
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
  filters.isFiltered = filters.isNeg || filters.isLowOffers || filters.isDealerLoser || filters.isBadDeal || filters.isUnchecked;
  card.classList.toggle('tp-filtered', filters.isFiltered);

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

    if (!badgeDifEl.dataset.tpOriginalDiscount) {
      const initialDiscount = extractCardDiscount(card);
      badgeDifEl.dataset.tpOriginalDiscount = (initialDiscount !== null && !isNaN(initialDiscount)) ? String(initialDiscount) : '';
    }
    const rawDiscount = badgeDifEl.dataset.tpOriginalDiscount !== '' ? parseFloat(badgeDifEl.dataset.tpOriginalDiscount) : null;
    // rawDiscount is the site DISCOUNT (positive = "-X%" deal, negative = "+X%"
    // markup). Render it sign-aware so markup badges never print "--X%".
    const sitePctText = (rawDiscount !== null && !isNaN(rawDiscount))
      ? (rawDiscount >= 0 ? `-${rawDiscount}%` : `+${-rawDiscount}%`)
      : '';

    // Bind single click handler on badge (mouse path; keyboard users get the
    // adjacent .tp-loupe button running the same runSingleDealCheck flow).
    if (!badgeDifEl.dataset.tpDealBound) {
      badgeDifEl.dataset.tpDealBound = 'true';
      badgeDifEl.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        runSingleDealCheck(card, badgeDifEl);
      });
    }

    if (CONFIG.BESTPREISE_MODE_ACTIVE) {
      if (dealData) {
        // Qualified Tiefstpreis! The ribbon prints the Gewichtete Differenz
        // (ADR-0005) — NIE die Site-Differenz. Heat and sort follow the same
        // number, so Zahl und Farbe stimmen immer überein.
        card.classList.remove('tp-baddeal-hidden', 'tp-unchecked-hidden');
        badgeDifEl.classList.add('tp-deal-badge-interactive');
        badgeDifEl.classList.remove('tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

        const showRecord = dealData.isNewRecord && isSignificantRecord(displayDelta);
        if (showRecord) {
          badgeDifEl.classList.add('tp-deal-new-record');
          badgeDifEl.classList.remove('tp-deal-alltime-low');
        } else {
          badgeDifEl.classList.add('tp-deal-alltime-low');
          badgeDifEl.classList.remove('tp-deal-new-record');
        }

        const prevLow = recordRefForPrice(stats, cardPrice).previousLow;
        const medianVal = stats?.medianPrice;
        const horizonLabel = medianHorizonLabel(stats);
        const outlierText = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? ` | ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert` : '';
        // Single source (ADR-0005): the blend is the heat input computed
        // above — ribbon number always matches its color.
        const badgePct = heatInfo.pct;

        // Ribbon carries the blend (ADR-0005): emoji + number, no words —
        // the CHF-anchored split lives in the subline below.
        if (isListView) {
          setHtmlIfChanged(badgeDifEl, `<span>⚖️</span><p>-${badgePct}%</p>`);
        } else {
          setHtmlIfChanged(badgeDifEl, `<div class="text">⚖️</div><p>-${badgePct}%</p>`);
        }

        // Tooltip: only what the card doesn't show (outlier count) + action hint.
        // Badge-% and both CHF legs live on ribbon/pill; color legend lives on
        // the heatmap button.
        const outlierTip = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? `ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert\n` : '';
        setTitleIfChanged(badgeDifEl, `${outlierTip}[Klicken zum Aktualisieren]`);

        // Merged subline: CHF-anchored split with per-leg % (no blend words —
        // the ribbon above already shows it, so the short CHF tail survives
        // ellipsis on narrow cards).
        const showPrevLow = !!(prevLow && priceToCents(prevLow) > priceToCents(cardPrice));
        const showMedianLine = !!(medianVal && medianVal > cardPrice);
        const hasRecordPart = dealData.isNewRecord && dealData.dRecord > 0;
        let histPriceEl = ensureHistPriceEl(card, cardPriceEl);

        if (showPrevLow || showMedianLine) {
          const parts = [];
          if (showPrevLow) parts.push(`📉 CHF ${prevLow.toFixed(2)}${hasRecordPart ? ` (-${dealData.dRecord}%)` : ''}`);
          if (showMedianLine) parts.push(`Ø (${horizonLabel}) CHF ${medianVal.toFixed(2)} (-${dealData.dMedian}%)`);
          if (dealData.isNewRecord && showPrevLow) {
            histPriceEl.className = 'tp-card-historical-price tp-is-record-low';
            setTextIfChanged(histPriceEl, parts.join(' · '));
            setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief: CHF ${prevLow.toFixed(2)} (-${dealData.dRecord}%)${showMedianLine ? ` · ${dealData.dMedian}% unter dem ${horizonLabel}-Median (CHF ${medianVal.toFixed(2)})` : ''}${outlierText}`);
          } else {
            histPriceEl.className = 'tp-card-historical-price tp-is-at-low' + (showPrevLow ? ' tp-with-prev' : '');
            setTextIfChanged(histPriceEl, parts.join(' · '));
            setTitleIfChanged(histPriceEl, `Allzeit-Tiefstpreis!${showPrevLow ? ` Vorheriges Tief: CHF ${prevLow.toFixed(2)}.` : ''}${showMedianLine ? ` Liegt ${dealData.dMedian}% unter dem ${horizonLabel}-Median von CHF ${medianVal.toFixed(2)}.` : ''}${outlierText}`);
          }
        } else {
          histPriceEl.remove();
        }
      } else if (stats) {
        // Verified but no qualifying blend — e.g. minimal fallback stats
        // without median, or above-low. Only a verified MARKUP hides in the
        // mode; a verified low without blend stays visible with Vortief edge
        // heat (never a full wash). The badge is ALWAYS repainted from the
        // current stats — never preserved — so a stats regression can't
        // strand a stale verified-% badge on a card whose heat is gone.
        const ddNow = getDisplayDelta(cardPrice, stats);
        if (CONFIG.BESTPREISE_MODE_ACTIVE === true && ddNow.kind !== 'at-low' && ddNow.kind !== 'new-low') {
          card.classList.add('tp-baddeal-hidden');
        } else {
          card.classList.remove('tp-baddeal-hidden', 'tp-unchecked-hidden');
        }
        badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');
        card.querySelector('.tp-card-historical-price')?.remove();
        if (ddNow.kind === 'above-low') {
          badgeDifEl.classList.add('tp-deal-not-low', 'tp-deal-badge-interactive');
          // Tooltip: status + hint only — markup sits on the badge, historic low on the pill.
          setTitleIfChanged(badgeDifEl, `⚠️ Kein Tiefstpreis (+${ddNow.markup}% Aufschlag)\n[Klicken zum Aktualisieren]`);
          const fakeNow = sitePctText ? `<span class="tp-fake-discount"><s>${sitePctText}</s></span>` : '';
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⚠️</span><p class="tp-markup-val">+${ddNow.markup}%</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Aufschlag</div><p class="tp-markup-val">+${ddNow.markup}%</p>${fakeNow}`);
          }
        } else if (ddNow.kind === 'at-low' || ddNow.kind === 'new-low') {
          // At-low without blend (no median / unqualified history): ribbon
          // prints the shared Vortief-Abstand when measurable, else the
          // preserved site-% — never a glyph. Browse stays gray; the mode
          // adds the feathered edge heat for the same number.
          badgeDifEl.classList.add('tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-not-low', 'tp-is-severe-markup');
          const prevLowNow = recordRefForPrice(stats, cardPrice).previousLow;
          const dropVsPrev = vortiefDropPct(cardPrice, stats);
          const hasPrevLowBase = prevLowNow && priceToCents(prevLowNow) > priceToCents(cardPrice);
          if (dropVsPrev > 0 && hasPrevLowBase) {
            setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · -${dropVsPrev}% vs. vorheriges Tief (CHF ${prevLowNow.toFixed(2)})\n[Klicken: erneut prüfen]`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>-${dropVsPrev}%</span><p>Tiefstpreis</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>-${dropVsPrev}%</p>`);
            }
          } else if (sitePctText) {
            setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · Shop-Differenz ${sitePctText} (Basis ungeprüft)\n[Klicken: erneut prüfen]`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>${sitePctText}</span><p>Tiefstpreis</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>${sitePctText}</p>`);
            }
          } else {
            setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt (CHF ${cardPrice.toFixed(2)})\n[Klicken: erneut prüfen]`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>Tiefstpreis</span>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div>`);
            }
          }
        }
        // 'unknown' (no usable price): loupe state stays — nothing truthful to claim.
      } else {
        // Unscanned card (!stats) -> loupe / loading spinner. Hidden only
        // when "Nur Geprüfte" is on; otherwise kept visible for checking.
        card.classList.remove('tp-baddeal-hidden', 'tp-unchecked-hidden');
        if (CONFIG.BESTPREISE_HIDE_UNCHECKED === true) card.classList.add('tp-unchecked-hidden');
        badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');

        if (scanState.currentlyScanningPid && scanState.currentlyScanningPid === pid) {
          badgeDifEl.classList.add('tp-deal-loading');
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⏳</span><p>Prüfe...</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfe...</div><p>⏳</p>`);
          }
        } else {
          badgeDifEl.classList.remove('tp-deal-loading');
          if (rawDiscount !== null && !isNaN(rawDiscount)) {
            setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz (ungeprüft), kein verifizierter Tiefstpreis.\n[Klicken: echten Allzeit-Tiefstpreis prüfen]`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>${sitePctText}</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>${sitePctText}</p><span class="tp-badge-loupe-icon">🔍</span>`);
            }
          } else {
            setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen.`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>Prüfen</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfen</div><p style="font-size: 15px; margin: 0; line-height: 1.1;">🔍</p>`);
            }
          }
        }
        card.querySelector('.tp-card-historical-price')?.remove();
      }
    } else {
      card.classList.remove('tp-baddeal-hidden', 'tp-unchecked-hidden');
      badgeDifEl.classList.remove('tp-deal-new-record');

      if (scanState.currentlyScanningPid && scanState.currentlyScanningPid === pid) {
        badgeDifEl.classList.add('tp-deal-loading');
        if (isListView) {
          setHtmlIfChanged(badgeDifEl, `<span>⏳</span><p>Prüfe...</p>`);
        } else {
          setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfe...</div><p>⏳</p>`);
        }
      } else {
        badgeDifEl.classList.remove('tp-deal-loading');
      }

      const displayKind = getDisplayDelta(cardPrice, stats).kind;

      if (displayKind !== 'unknown') {
        const isAllTimeLow = (displayKind === 'new-low' || displayKind === 'at-low');
        const isNonBest = (displayKind === 'above-low');
        const liveRec = recordRefForPrice(stats, cardPrice);
        const isNewRecord = (displayKind === 'new-low') || (isAllTimeLow && liveRec.isNewRecord);
        const prevLow = liveRec.previousLow;
        const realDropVsPrev = prevLow && prevLow > cardPrice ? Math.round(((prevLow - cardPrice) / prevLow) * 100) : (stats.realDiscountVsPrevLow || 0);

        // Strictness lives in the mode now: outside it, verified non-deals
        // stay visible with a truthful Aufschlag badge.

        const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;

        if (isAllTimeLow) {
          // 3B: Verified All-Time Low (Glowing Emerald Halo)
          // Ribbon prints the Gewichtete Differenz (ADR-0005); without a
          // blend the Vortief-Abstand, else the preserved site-% — never a
          // glyph. Gray stays: no blend, no heat.
          badgeDifEl.classList.add('tp-deal-alltime-low', 'tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

          // Single source (ADR-0005): the blend is the heat input above.
          const badgePct = dealData ? heatInfo.pct : 0;
          const prevTip = prevLow && priceToCents(prevLow) > priceToCents(cardPrice)
            ? ` vs. vorheriges Tief (CHF ${prevLow.toFixed(2)})` : '';

          if (badgePct > 0) {
            // Tooltip: action hint only — badge + pill carry the verified numbers.
            setTitleIfChanged(badgeDifEl, '[Klicken zum Aktualisieren]');
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>⚖️</span><p>-${badgePct}%</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">⚖️</div><p>-${badgePct}%</p>`);
            }
          } else if (realDropVsPrev > 0) {
            setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · -${realDropVsPrev}%${prevTip}\n[Klicken: erneut prüfen]`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>-${realDropVsPrev}%</span><p>Tiefstpreis</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>-${realDropVsPrev}%</p>`);
            }
          } else if (sitePctText) {
            setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · Shop-Differenz ${sitePctText} (Basis ungeprüft)\n[Klicken: erneut prüfen]`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>${sitePctText}</span><p>Tiefstpreis</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>${sitePctText}</p>`);
            }
          } else {
            setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt (CHF ${cardPrice.toFixed(2)})\n[Klicken: erneut prüfen]`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>Tiefstpreis</span>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div>`);
            }
          }
        } else {
          // 2A: Verified Non-Tiefstpreis (Amber Alert Morph with Shrunken Strikethrough)
          const markupPct = Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100);
          const isSevere = markupPct >= 50;

          badgeDifEl.classList.add('tp-deal-not-low', 'tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-loading');
          if (isSevere) {
            badgeDifEl.classList.add('tp-is-severe-markup');
          } else {
            badgeDifEl.classList.remove('tp-is-severe-markup');
          }

          // Tooltip: status + hint only — markup sits on the badge, historic low on the pill.
          setTitleIfChanged(badgeDifEl, `⚠️ Kein Tiefstpreis (+${markupPct}% Aufschlag)\n[Klicken zum Aktualisieren]`);
          const fakeDiscHtml = sitePctText ? `<span class="tp-fake-discount"><s>${sitePctText}</s></span>` : '';
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⚠️</span><p class="tp-markup-val">+${markupPct}%</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Aufschlag</div><p class="tp-markup-val">+${markupPct}%</p>${fakeDiscHtml}`);
          }
        }

        // 4A: Historical Tiefstpreis line right below current price
        // (pre-existing element lookup doubles as the stale-element removal path below)
        // The previous low is always shown when known & distinct — never
        // dropped in favour of the Ø line.
        const showPrevLow = !!(prevLow && priceToCents(prevLow) > priceToCents(cardPrice));
        const showMedianLine = !isNeueFeed && stats.medianPrice && stats.medianPrice > cardPrice;
        const horizonLabel = medianHorizonLabel(stats);
        let histPriceEl = card.querySelector('.tp-card-historical-price');
        if (isNonBest) {
          histPriceEl = ensureHistPriceEl(card, cardPriceEl);
          histPriceEl.className = 'tp-card-historical-price tp-is-markup';
          setTextIfChanged(histPriceEl, `Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)}`);
          setTitleIfChanged(histPriceEl, `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100)}% Aufschlag)`);
        } else if (showPrevLow || showMedianLine) {
          histPriceEl = ensureHistPriceEl(card, cardPriceEl);
          const parts = [];
          const dMedBrowse = showMedianLine ? Math.round(((stats.medianPrice - cardPrice) / stats.medianPrice) * 100) : 0;
          if (showPrevLow) parts.push(`📉 CHF ${prevLow.toFixed(2)}${isNewRecord ? ` (-${realDropVsPrev}%)` : ''}`);
          if (showMedianLine) parts.push(`Ø (${horizonLabel}) CHF ${stats.medianPrice.toFixed(2)} (-${dMedBrowse}%)`);
          histPriceEl.className = 'tp-card-historical-price ' + (isNewRecord && showPrevLow ? 'tp-is-record-low' : 'tp-is-at-low') + (showPrevLow ? ' tp-with-prev' : '');
          setTextIfChanged(histPriceEl, parts.join(' · '));
          if (isNewRecord && showPrevLow) {
            setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)${showMedianLine ? ` · Ø-Preis (${horizonLabel}): CHF ${stats.medianPrice.toFixed(2)}` : ''}`);
          } else {
            const dMedian = showMedianLine ? Math.round(((stats.medianPrice - cardPrice) / stats.medianPrice) * 100) : 0;
            setTitleIfChanged(histPriceEl, `Allzeit-Tiefstpreis!${showPrevLow ? ` Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)}.` : ''}${showMedianLine ? ` Liegt ${dMedian}% unter dem ${horizonLabel}-Median von CHF ${stats.medianPrice.toFixed(2)}.` : ''}`);
          }
        } else if (histPriceEl) {
          histPriceEl.remove();
        }
      } else {
        // 1A: Unchecked State (Subtle Mini Loupe + Hover Scale + Tooltip)
        if (CONFIG.BESTPREISE_HIDE_UNCHECKED === true) card.classList.add('tp-unchecked-hidden');

        badgeDifEl.classList.add('tp-deal-badge-interactive');
        badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');
        if (isNeueFeed && rawDiscount !== null && !isNaN(rawDiscount)) {
          setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz (z.B. vs UVP, ungeprüft), kein verifizierter Tiefstpreis. Klicken: echten Allzeit-Tiefstpreis prüfen. Grau gestreift = ungeprüft.`);
          setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>${sitePctText}</p><span class="tp-badge-loupe-icon">🔍</span>`);
        } else {
          setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen.`);
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>Prüfen</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfen</div><p style="font-size: 15px; margin: 0; line-height: 1.1;">🔍</p>`);
          }
        }
      }
    }
    // Loupe button: keyboard-operable twin of the badge click. The badge keeps
    // its content and mouse click untouched; the button runs the same
    // runSingleDealCheck flow. Shown only for unscanned cards (loupe states),
    // never inside the badge. Reused across renders so focus survives.
    const showLoupe = !!pid && !stats && !badgeDifEl.classList.contains('tp-deal-loading');
    let loupeBtn = loupeBtnByBadge.get(badgeDifEl);
    if (showLoupe) {
      if (!loupeBtn?.isConnected || loupeBtn.previousElementSibling !== badgeDifEl) {
        loupeBtn?.remove();
        loupeBtn = document.createElement('button');
        loupeBtn.type = 'button';
        loupeBtn.className = 'tp-loupe';
        loupeBtn.setAttribute('aria-label', 'Differenz prüfen');
        loupeBtn.textContent = '🔍';
        loupeBtn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          runSingleDealCheck(card, badgeDifEl);
        });
        loupeBtnByBadge.set(badgeDifEl, loupeBtn);
        badgeDifEl.insertAdjacentElement('afterend', loupeBtn);
      }
      loupeBtn.style.display = '';
    } else {
      loupeBtn?.remove();
      loupeBtnByBadge.delete(badgeDifEl);
    }
  } else {
    card.classList.remove('tp-baddeal-hidden', 'tp-unchecked-hidden');
    card.querySelector('.tp-card-historical-price')?.remove();
    card.querySelectorAll('button.tp-loupe').forEach(b => b.remove());
  }

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
    if (!sparkContainer.querySelector('.tp-sparkline')) {
      const svg = renderSparkline(withLivePrice(stats.timeSeries, cardPrice), 44, 13);
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
  // 6. Badge geprüft/ungeprüft cue (always on): striped-gray ribbon when
  // unchecked, solid heat ribbon when verified. Loading badge gets neither.
  const badgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
  if (badgeEl) {
    if (badgeEl.classList.contains('tp-deal-loading')) {
      badgeEl.classList.remove('tp-is-unverified', 'tp-is-verified');
    } else if (!stats) {
      badgeEl.classList.add('tp-is-unverified');
      badgeEl.classList.remove('tp-is-verified');
    } else {
      badgeEl.classList.add('tp-is-verified');
      badgeEl.classList.remove('tp-is-unverified');
    }
  }
  // 7. Discord 1-Klick-Share (nur verifizierte Tiefstpreise, nie Schein-Rabatte)
  const kindNow = (displayDelta && displayDelta.kind) || getDisplayDelta(cardPrice, stats).kind;
  const isShareable = !!(dealData || kindNow === 'new-low' || kindNow === 'at-low');
  let shareBtn = card.querySelector(':scope > .tp-share-btn');
  if (!card.dataset.tpShareHoverBound) {
    card.dataset.tpShareHoverBound = 'true';
    card.addEventListener('mouseenter', () => card.classList.add('tp-show-share'));
    card.addEventListener('mouseleave', () => card.classList.remove('tp-show-share'));
  }
  if (isShareable) {
    if (!shareBtn) {
      shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'tp-share-btn';
      shareBtn.textContent = '📤';
      shareBtn.title = 'Deal in Discord teilen';
      shareBtn.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();
        const hook = (CONFIG.DISCORD_WEBHOOK_URL || '').trim();
        if (!isDiscordWebhookUrl(hook)) {
          showToast('Discord-Webhook fehlt – in den Einstellungen (⚙️) eintragen');
          return;
        }
        shareBtn.disabled = true;
        try {
          const { title, url } = extractShareData(card);
          const priceText = cardPrice > 0 ? `CHF ${cardPrice.toFixed(2)}` : '';
          let dealer = extractDealer(card);
          let offers = cd.offerCount || 0;
          if ((!dealer || !offers) && url) {
            const info = await fetchProductInfo(url, undefined, isShippingPriceActive(card)).catch(() => null);
            if (info) { dealer = dealer || info.dealer; offers = offers || info.offers; }
          }
          const png = await renderSparklinePng(withLivePrice(stats?.timeSeries, cardPrice)).catch(() => null);
          const content = formatDealMessage({
            title, url, priceText,
            dealer, offerCount: offers,
            spark: png ? '' : sparklineText(stats?.timeSeries),
            ...resolveShareFields(cardPrice, stats)
          });
          let shared = false;
          if (png) {
            try { await postDealImageToDiscord(hook, content, png); shared = true; }
            catch { /* Text-Fallback unten */ }
          }
          if (!shared) await postDealToDiscord(hook, content);
          showToast('📤 Deal in Discord geteilt');
        } catch {
          showToast('📤 Teilen fehlgeschlagen');
        }
        shareBtn.disabled = false;
      });
      // Eigener Positioning-Kontext: Host-CSS garantiert kein relative (ausser .tp-is-cheapest).
      if (card.style.position === '' && getComputedStyle(card).position === 'static') card.style.position = 'relative';
      card.appendChild(shareBtn);
    }
    shareBtn.style.display = '';
  } else {
    shareBtn?.remove();
  }
  // 8. Händlername links neben dem Preis: nur geprüfte Karten (stats != null).
  // Katalog löst synchron aus extractDealer (kein Fetch); Feed ohne DOM-Zeile
  // bekommt einen 🏬-Button, der fetchProductInfo einmalig pro pid:Modus holt
  // (dealerCache + dealerPending-Guard) und danach neu rendert — oder bei
  // DEALER_AUTOFETCH denselben Loader ohne Klick (1×/Pageload, max. 3 parallel).
  // Der Name verlinkt direkt aufs Händlerangebot (/ext_de aus dem Fetch bzw.
  // Zeilenlink), Fallback ist die Produktseite — immer neuer Tab.
  const dealerEl = card.querySelector('.tp-dealer-name');
  if (!stats || !pid) {
    dealerEl?.remove();
  } else {
    const useShipping = isShippingPriceActive(card);
    const dKey = dealerCacheKey(pid, useShipping);
    let dealer = extractDealer(card);
    if (!dealer && !dealerCache.has(dKey) && !dealerHydrated.has(dKey)) {
      dealerHydrated.add(dKey);
      const stored = getCachedDealer(pid, useShipping);
      if (stored?.dealer) rememberDealer(dKey, stored);
    }
    const cached = dealerCache.get(dKey);
    if (!dealer && cached?.dealer) dealer = cached.dealer;
    const { url: productUrl } = extractShareData(card);
    const directUrl = cached?.url || (dealer ? extractDealerUrl(card) : '');
    const targetUrl = directUrl || productUrl || '';
    const hasUrl = /^https?:\/\//i.test(targetUrl);
    const anchor = (cardPriceEl?.parentElement?.contains(cardPriceEl) && cardPriceEl.parentElement) ||
      card.querySelector('.Plugin_PriceInformation, .price_information_product') || card;
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
        try {
          const info = await fetchProductInfo(productUrl, undefined, isShippingPriceActive(card)).catch(() => null);
          if (info?.dealer) { rememberDealer(dKey, { dealer: info.dealer, url: info.dealerUrl || '' }); setCachedDealer(pid, useShipping, info.dealer, info.dealerUrl || ''); }
        } finally {
          dealerPending.delete(dKey);
        }
        triggerProcessListings();
      };
      let btn = dealerEl?.dataset.tpDealerPid === dKey && dealerEl.tagName === 'BUTTON' ? dealerEl : null;
      if (!btn) {
        dealerEl?.remove();
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tp-dealer-name tp-dealer-btn';
        btn.textContent = '🏬';
        btn.setAttribute('aria-label', 'Händler laden');
        btn.title = 'Günstigsten Händler laden (lädt die Produktseite einmalig)';
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
      if (CONFIG.DEALER_AUTOFETCH === true && !dealerAutoTried.has(dKey) && !dealerPending.has(dKey) && dealerPending.size < 3) {
        dealerAutoTried.add(dKey);
        btn.disabled = true;
        loadDealer();
      }
    } else {
      dealerEl?.remove();
    }
  }
}

export function renderEmptyState(cards, counts) {
  let emptyNotice = document.getElementById('tp-empty-state-notice');

  // If qualifying bestpreise deals exist on page, NEVER render empty state
  if (counts.bestpreiseDeals > 0) {
    if (emptyNotice) emptyNotice.remove();
    return;
  }

  const bodyCls = document.body.classList;
  const revealAll = bodyCls.contains('tp-reveal-all');
  const totalHidden = revealAll ? 0 : (counts.filteredCount || 0);

  const isBestpreiseEmpty = CONFIG.BESTPREISE_MODE_ACTIVE && (counts.bestpreiseHidden || 0) > 0;
  // Anzeige decides display: only a full collapse (hide) empties the page.
  if (CONFIG.MODE === 'hide' && cards.length > 0 && totalHidden >= cards.length) {
    // Static notice: skip rebuild + listener re-bind when nothing changed
    const emptySig = `${cards.length}:${totalHidden}:${isBestpreiseEmpty}:${counts.uncheckedDeals || 0}:${CONFIG.REAL_DEAL_MIN_DISCOUNT || 30}:${revealAll}`;
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
    const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
    emptyNotice.innerHTML = `
      <div>🚫 <strong>${isBestpreiseEmpty ? 'Keine verifizierten Tiefstpreise auf dieser Seite gefunden.' : `Alle ${cards.length} Angebote auf dieser Seite sind durch aktive Filter ausgeblendet.`}</strong></div>
      <div class="tp-empty-state-actions">
        ${isBestpreiseEmpty && counts.uncheckedDeals > 0 ? `<button class="tp-empty-state-btn" id="tp-empty-check-deals-btn" style="border-color: #3b82f6; color: #60a5fa;" title="Prüft Differenzen ≥ ${minDisc}% (ungeprüft ≠ Tiefstpreis)">🔍 Tiefstpreise prüfen (≥${minDisc}%)</button>` : ''}
        ${(counts.uncheckedDeals || 0) > 0 || CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? `<button class="tp-empty-state-btn" id="tp-empty-hide-unchecked-btn" title="✓ Nur geprüfte: ungeprüfte filtern (Ursache, folgt der Anzeige)">✓ ${CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? 'Alle anzeigen' : 'Nur geprüfte'}</button>` : ''}
        <button class="tp-empty-state-btn" id="tp-empty-reveal-btn">👁️ Gefilterte anzeigen</button>
        ${isBestpreiseEmpty ? '<button class="tp-empty-state-btn" id="tp-empty-disable-bestpreise-btn">💎 Tiefstpreise-Modus ausschalten</button>' : ''}
        <button class="tp-empty-state-btn" id="tp-empty-toggle-filters-btn">⚡ Filter ausschalten</button>
      </div>
    `;

    emptyNotice.dataset.tpEmptySig = emptySig;
    emptyNotice.querySelector('#tp-empty-check-deals-btn')?.addEventListener('click', () => {
      // Toolbar batch button removed: the floating CTA owns this action now.
      // startBatchCheck works even when the pill is collapsed or auto-hidden.
      startBatchCheck();
    });
    emptyNotice.querySelector('#tp-empty-hide-unchecked-btn')?.addEventListener('click', () => {
      const next = !CONFIG.BESTPREISE_HIDE_UNCHECKED;
      updateConfig('BESTPREISE_HIDE_UNCHECKED', next);
      showToast(next ? '✓ Nur geprüfte filtern aktiv (Ursache, folgt der Anzeige)' : '✓ Nur geprüfte aus — ungeprüfte werden wieder angezeigt');
    });

    emptyNotice.querySelector('#tp-empty-reveal-btn')?.addEventListener('click', () => {
      document.body.classList.toggle('tp-reveal-all');
      triggerProcessListings();
    });
    emptyNotice.querySelector('#tp-empty-disable-bestpreise-btn')?.addEventListener('click', () => {
      cancelBestpreiseScan();
      updateConfig('BESTPREISE_MODE_ACTIVE', false);
      showToast('Tiefstpreise-Modus deaktiviert');
    });
    emptyNotice.querySelector('#tp-empty-toggle-filters-btn')?.addEventListener('click', () => {
      updateConfig('FILTER_NEG_ENABLED', false);
      updateConfig('FILTER_MIN_ENABLED', false);
      updateConfig('BESTPREISE_HIDE_UNCHECKED', false);
      document.body.classList.add('tp-reveal-all');
      showToast('⏸️ Alle Filter pausiert (alle Angebote sichtbar)');
    });
  } else if (emptyNotice) {
    emptyNotice.remove();
  }
}

