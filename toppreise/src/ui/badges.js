/**
 * Visual Badges & Card Decorator Component
 * Manages card thermal heatmaps, deal badges (Allzeit-Tiefstpreis,
 * Neuer Rekord, Differenz loupe, markup alert), score breakdown pills,
 * mini sparklines, and empty-state messaging.
 */

import { CONFIG, updateConfig, updateConfigs, _getValue, _setValue, sanitizeReviewKeyword } from '../state/config.js';
import {
  getBadgeHeatStyle,
  getInsetHeatStyle,
  getCardDealerRows,
  extractCardDiscount,
  getCardProductId
} from '../page/cards.js';
import { getCardSortableUnit } from '../page/sort.js';
import { isDiscordWebhookUrl, formatDealMessage, forumRecipeFor, resolveShareFields, extractShareData, extractDealer, extractDealerUrl, sparklineText, withLivePrice, fetchProductInfo, fetchImageBlob, renderSparklinePng, postDealImageToDiscord, postDealToDiscord, buildThreadName, isForumThreadError, discordForumFlagKey } from '../features/share-discord.js';
import { extractCanonicalPrice, parsePrice, pctDrop, pctRise, priceToCents, recordRefForPrice } from '../domain/price.js';
import { computeDealScore, getDisplayDelta, getHeatInput, isSignificantRecord, medianHorizonLabel, vortiefDropPct } from '../domain/deal-score.js';
import {
  fetchSingleProductPriceStats
} from '../scanner/scanner.js';
import { startBatchCheck } from './floating-cta.js';
import { scanState } from '../state/store.js';
import { getCachedPriceStats, getCachedDealer, setCachedDealer, lruSet, getSharedDeal, setSharedDeal } from '../scanner/cache.js';
import { showToast } from './toast.js';
import { renderSparkline, openSparklinePopout } from './sparkline.js';
import { isShippingPriceActive, triggerProcessListings, scheduleProcessListings } from '../page/adapter.js';
import { markFreshVerified, armFreshDismiss } from './fresh-dismiss.js';

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

// Heat is chrome-only (border + glow): the card keeps the site background.

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
// Single-product verify flow. Reads price at click time and re-verifies it
// after fetch so a stale or swapped card never paints another product's stats.
// Händlername (§8 in renderCardEffects): Memory-Map pid:Modus -> Name.
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
export function clearDealerMemory() {
  dealerCache.clear();
  dealerHydrated.clear();
  dealerAutoTried.clear();
}
export function clearDealerAutoTried() {
  dealerAutoTried.clear();
}
async function runSingleDealCheck(card, badgeDifEl) {
  if (badgeDifEl.classList.contains('tp-deal-loading')) return;
  const currentPid = getCardProductId(card);
  if (!currentPid) return;
  badgeDifEl.classList.add('tp-deal-loading');
  badgeDifEl.innerHTML = `<div class="text">Prüfe...</div><p>⏳</p>`;
  const requestTimePrice = extractCanonicalPrice(card).price;
  const fetchedStats = await fetchSingleProductPriceStats(currentPid, 1, true, null, Number.isFinite(requestTimePrice) && requestTimePrice > 0 ? requestTimePrice : null);
  const currentTimePrice = extractCanonicalPrice(card).price;
  if (!requestTimePrice || !currentTimePrice || priceToCents(requestTimePrice) !== priceToCents(currentTimePrice)) {
    badgeDifEl.classList.remove('tp-deal-loading');
    triggerProcessListings();
    return;
  }
  badgeDifEl.classList.remove('tp-deal-loading');
  if (fetchedStats) {
    armFreshDismiss();
    markFreshVerified(currentPid);
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

  // Heatmap (blind): gray (no deal) -> red (max savings), single hue
  // (ADR-0005: badge shows the blend, heat/sort follow it). One computation
  // (getHeatInput) feeds BOTH the card heat here and the badge number below,
  // so the ribbon number always matches its color. The blend sorts too.
  // Blind rule: heat follows the badge % only — blend, Vortief-Abstand, or
  // unverified site-%. Verified-state differentiation lives in badge
  // text/tooltip + Verbergen/Dimmen, never in the card wash. The badge paint
  // below is verified-only, so heated unverified badges keep the striped
  // `.tp-is-unverified` cue while the card body still glows.
  const heatMode = CONFIG.BESTPREISE_MODE_ACTIVE ? 'bestpreise' : 'browse';
  const heatInfo = getHeatInput(cardPrice, stats, diffVal, heatMode, dealData);
  const effectiveDiff = heatInfo.value;
  const heatIntensity = CONFIG.HEATMAP_INTENSITY;

  // Blind inset wash: every heatable card gets the same prominent signal,
  // clipped to the card's own edges.
  if (CONFIG.HEATMAP_ENABLED && effectiveDiff !== null && !isNaN(effectiveDiff)) {
    const heatKey = `${effectiveDiff}_${heatIntensity.toFixed(2)}`;
    if (card.dataset.tpAppliedHeat !== heatKey) {
      card.dataset.tpAppliedHeat = heatKey;
      const heat = getInsetHeatStyle(heatInfo.pct, heatIntensity);
      card.classList.toggle('tp-heat-blend', true);
      card.style.setProperty('--tp-heat-glow', heat.glow);
      card.style.setProperty('box-shadow', heat.glow, 'important');
    }
    // Badge follows the card heat: same ramp, solid swatch. Synced on every
    // render (not only on heatKey change) so re-rendered badge nodes can't
    // desync from the card. Verified-only: unverified cards keep the striped
    // `.tp-is-unverified` cue on the badge while the card body still glows.
    const heatBadgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
    if (heatBadgeEl && stats) {
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
  } else if (card.dataset.tpAppliedHeat || card.classList.contains('tp-heat-blend')) {
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
   if (scanState.currentlyScanningPid && scanState.currentlyScanningPid === pid) {
    card.classList.remove('tp-is-verified');
   } else if (stats) {
     card.classList.add('tp-is-verified');
   } else {
    card.classList.remove('tp-is-verified');
   }

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
  const hide = (filters.isNeg && CONFIG.FILTER_NEG_MODE !== 'dim')
    || (filters.isLowOffers && CONFIG.FILTER_MIN_MODE !== 'dim')
    || (filters.isDealerLoser && CONFIG.DEALER_MODE !== 'dim')
    || (filters.isVortiefExcluded && CONFIG.VORTIEF_MODE !== 'dim')
    || (filters.isUnchecked && CONFIG.HIDE_UNCHECKED_MODE !== 'dim');
  const dim = !hide && ((filters.isNeg && CONFIG.FILTER_NEG_MODE === 'dim')
    || (filters.isLowOffers && CONFIG.FILTER_MIN_MODE === 'dim')
    || (filters.isDealerLoser && CONFIG.DEALER_MODE === 'dim')
    || (filters.isVortiefExcluded && CONFIG.VORTIEF_MODE === 'dim')
    || (filters.isUnchecked && CONFIG.HIDE_UNCHECKED_MODE === 'dim'));
  filters.isFiltered = hide;   // narrowed: hidden-only (name kept, all consumers want hidden)
  filters.isDimmed = dim;
  card.classList.toggle('tp-filtered', hide);
  card.classList.toggle('tp-dimmed', dim);
  const sortUnit = getCardSortableUnit(card);
  if (sortUnit && sortUnit !== card) sortUnit.classList.toggle('tp-col-filtered', hide);

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
    if (stats && CONFIG.HEATMAP_ENABLED && effectiveDiff !== null && !isNaN(effectiveDiff)) {
      const badgeHeat = getBadgeHeatStyle(effectiveDiff, false, CONFIG.HEATMAP_INTENSITY);
      if (badgeHeat) {
        badgeDifEl.style.setProperty('background', badgeHeat.background, 'important');
        badgeDifEl.style.setProperty('border-color', badgeHeat.border, 'important');
        badgeDifEl.style.setProperty('color', '#ffffff', 'important');
        badgeDifEl.style.setProperty('box-shadow', '0 2px 10px rgba(0,0,0,0.45)', 'important');
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

    if (CONFIG.BESTPREISE_MODE_ACTIVE) {
      if (dealData) {
        // Qualified Tiefstpreis! The ribbon prints the Gewichtete Differenz
        // (ADR-0005) — NIE die Site-Differenz. Heat and sort follow the same
        // number, so Zahl und Farbe stimmen immer überein.
        card.classList.remove('tp-unchecked-hidden');
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
        // heat (never a full wash) unless Fallback-Tiefs are excluded.
        // The badge is ALWAYS repainted from the current stats — never
        // preserved — so a stats regression can't strand a stale verified-%
        // badge on a card whose heat is gone.
        const ddNow = getDisplayDelta(cardPrice, stats);
        card.classList.remove('tp-unchecked-hidden');
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
            setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · -${dropVsPrev}% vs. vorheriges Tief (CHF ${prevLowNow.toFixed(2)}) · Fallback: dünne Historie ohne Ø-Vergleich (einfache Fläche, kein Blend)\n[Klicken: erneut prüfen]`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>-${dropVsPrev}%</span><p>Tiefstpreis</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>-${dropVsPrev}%</p>`);
            }
          } else if (sitePctText) {
            setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · Shop-Differenz ${sitePctText} (Basis ungeprüft) · Fallback ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
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
        card.classList.remove('tp-unchecked-hidden');
        if (filters.isUnchecked === true) card.classList.add('tp-unchecked-hidden');
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
      card.classList.remove('tp-unchecked-hidden');
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
        const realDropVsPrev = prevLow && prevLow > cardPrice ? pctDrop(prevLow, cardPrice) : (stats.realDiscountVsPrevLow || 0);
        const markupPct = isNonBest ? pctRise(stats.tiefstpreis, cardPrice) : 0;

        // Strictness lives in the mode now: outside it, verified non-deals
        // stay visible with a truthful Aufschlag badge.

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
            setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · -${realDropVsPrev}%${prevTip} · Fallback: dünne Historie ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>-${realDropVsPrev}%</span><p>Tiefstpreis</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>-${realDropVsPrev}%</p>`);
            }
          } else if (sitePctText) {
            setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · Shop-Differenz ${sitePctText} (Basis ungeprüft) · Fallback ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
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
        const showMedianLine = stats.medianPrice && stats.medianPrice > cardPrice;
        const horizonLabel = medianHorizonLabel(stats);
        let histPriceEl = card.querySelector('.tp-card-historical-price');
        if (isNonBest) {
          histPriceEl = ensureHistPriceEl(card, cardPriceEl);
          histPriceEl.className = 'tp-card-historical-price tp-is-markup';
          setTextIfChanged(histPriceEl, `Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)}`);
          setTitleIfChanged(histPriceEl, `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)`);
        } else if (showPrevLow || showMedianLine) {
          histPriceEl = ensureHistPriceEl(card, cardPriceEl);
          const parts = [];
          const dMedBrowse = showMedianLine ? pctDrop(stats.medianPrice, cardPrice) : 0;
          if (showPrevLow) parts.push(`📉 CHF ${prevLow.toFixed(2)}${isNewRecord ? ` (-${realDropVsPrev}%)` : ''}`);
          if (showMedianLine) parts.push(`Ø (${horizonLabel}) CHF ${stats.medianPrice.toFixed(2)} (-${dMedBrowse}%)`);
          histPriceEl.className = 'tp-card-historical-price ' + (isNewRecord && showPrevLow ? 'tp-is-record-low' : 'tp-is-at-low') + (showPrevLow ? ' tp-with-prev' : '');
          setTextIfChanged(histPriceEl, parts.join(' · '));
          if (isNewRecord && showPrevLow) {
            setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)${showMedianLine ? ` · Ø-Preis (${horizonLabel}): CHF ${stats.medianPrice.toFixed(2)}` : ''}`);
          } else {
            const dMedian = dMedBrowse;
            setTitleIfChanged(histPriceEl, `Allzeit-Tiefstpreis!${showPrevLow ? ` Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)}.` : ''}${showMedianLine ? ` Liegt ${dMedian}% unter dem ${horizonLabel}-Median von CHF ${stats.medianPrice.toFixed(2)}.` : ''}`);
          }
        } else if (histPriceEl) {
          histPriceEl.remove();
        }
      } else {
        // 1A: Unchecked State (Subtle Mini Loupe + Hover Scale + Tooltip)
        if (filters.isUnchecked === true) card.classList.add('tp-unchecked-hidden');

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
  } else {
    card.classList.remove('tp-unchecked-hidden');
    card.querySelector('.tp-card-historical-price')?.remove();
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
    // Click pops the full Discord-style chart (same series incl. live price).
    sparkContainer._tpSeries = withLivePrice(stats.timeSeries, cardPrice);
    const sig = stats.timeSeries.length + ':' + priceToCents(cardPrice) + ':' + priceToCents(stats.medianPrice ?? 0);
    sparkContainer.style.cursor = 'pointer';
    sparkContainer.setAttribute('role', 'button');
    sparkContainer.setAttribute('tabindex', '0');
    sparkContainer.setAttribute('title', 'Preisverlauf vergrössern');
    if (!sparkContainer.dataset.tpPopoutBound) {
      sparkContainer.dataset.tpPopoutBound = 'true';
      sparkContainer.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        openSparklinePopout(sparkContainer._tpSeries);
      });
      sparkContainer.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          openSparklinePopout(sparkContainer._tpSeries);
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
          try {
            const { title, url, imageUrl } = extractShareData(card);
            const productDl = imageUrl ? fetchImageBlob(imageUrl).catch(() => null) : null;
            const priceText = cardPrice > 0 ? `CHF ${cardPrice.toFixed(2)}` : '';
            let dealer = extractDealer(card);
            let dealerUrl = extractDealerUrl(card);
            let offers = cd.offerCount || getCachedDealer(pid, isShippingPriceActive(card))?.offers || 0;
            if ((!dealer || !dealerUrl || !offers) && url) {
              const info = await fetchProductInfo(url, undefined, isShippingPriceActive(card)).catch(() => null);
              if (info) { dealer = dealer || info.dealer; dealerUrl = dealerUrl || info.dealerUrl; offers = offers || info.offers; }
            }
            const png = await renderSparklinePng(withLivePrice(stats?.timeSeries, cardPrice)).catch(() => null);
            const fields = {
              title, url, priceText,
              dealer, dealerUrl, offerCount: offers,
              spark: png ? '' : sparklineText(stats?.timeSeries),
              ...resolveShareFields(cardPrice, stats),
              suppressDealerEmbed: CONFIG.DISCORD_SUPPRESS_DEALER_EMBED !== false,
              suppressProductEmbed: CONFIG.DISCORD_SUPPRESS_PRODUCT_EMBED !== false
            };
            const content = formatDealMessage(fields, CONFIG.DISCORD_LAYOUT);
            const forumContent = formatDealMessage({ ...fields, forceLink: true }, forumRecipeFor(CONFIG.DISCORD_LAYOUT));
            const threadName = buildThreadName(title);
            const flagKey = discordForumFlagKey(hook);
            const forum = _getValue(flagKey, false) === true;
            // Produkt-Bytes laufen parallel zu Händlerfetch + Chart-Render (oben
            // gestartet): gelingt der Download nicht, bleibt das URL-Embed als Fallback.
            const productBlob = (png && productDl) ? await productDl : null;
            const productOpt = productBlob ? { productImageBlob: productBlob } : (imageUrl ? { productImageUrl: imageUrl } : null);
            const postText = withThread => postDealToDiscord(hook, withThread ? forumContent : content, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });
            const postImage = withThread => postDealImageToDiscord(hook, withThread ? forumContent : content, png, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });
            const tryRound = async withThread => {
              if (png) {
                try { await postImage(withThread); return; }
                catch (imgErr) {
                  if (!isForumThreadError(imgErr)) { /* non-forum image error: fall through to text, same round */ }
                  else if (withThread) { /* threaded image rejected: fall through to threaded text */ }
                  else throw imgErr; // plain image hit forum: skip plain text, outer handler goes threaded
                }
              }
              await postText(withThread);
            };
            for (const withThread of (forum ? [true, false] : [false, true])) {
              try {
                await tryRound(withThread);
                if (withThread !== forum) _setValue(flagKey, withThread);
                break;
              } catch (err) {
                if (!isForumThreadError(err) || withThread) throw err;
                // plain round hit forum → loop continues threaded
              }
            }
            showToast('📤 Deal in Discord geteilt');
            if (pid && cardPrice > 0) { setSharedDeal(pid, priceToCents(cardPrice)); shareBtn.classList.add('tp-share-done'); }
          } catch {
            showToast('📤 Teilen fehlgeschlagen');
          }
        } finally {
          shareBtn.disabled = false;
        }
      });
      // Eigener Positioning-Kontext: Host-CSS garantiert kein relative (ausser .tp-is-cheapest).
      if (card.style.position === '' && getComputedStyle(card).position === 'static') card.style.position = 'relative';
      card.appendChild(shareBtn);
    }
    shareBtn.style.display = '';
    shareBtn.classList.toggle('tp-share-done', !!(pid && cardPrice > 0 && getSharedDeal(pid, priceToCents(cardPrice))));
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
    const dKey = `${pid}:${useShipping ? 's' : 'p'}`;
    let dealer = extractDealer(card);
    if (!dealer && !dealerCache.has(dKey) && !dealerHydrated.has(dKey)) {
      if (dealerHydrated.size > 1000) dealerHydrated.clear();
      dealerHydrated.add(dKey);
      const stored = getCachedDealer(pid, useShipping);
      if (stored?.dealer) lruSet(dealerCache, dKey, stored);
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
          if (info?.dealer) { lruSet(dealerCache, dKey, { dealer: info.dealer, url: info.dealerUrl || '', offers: info.offers || 0 }); setCachedDealer(pid, useShipping, info.dealer, info.dealerUrl || '', undefined, info.offers || 0); }
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
      if (!filters?.isFiltered && CONFIG.DEALER_AUTOFETCH === true && !dealerAutoTried.has(dKey) && !dealerPending.has(dKey) && dealerPending.size < 3) {
        dealerAutoTried.add(dKey);
        btn.disabled = true;
        loadDealer();
      }
    } else {
      dealerEl?.remove();
    }
  }
  // 9. Review-Suche (🌐) am Produktnamen: Ansicht, immer wenn aktiviert.
  // Titelquelle ist extractShareData (single source of truth, kein 2. Parser).
  const reviewName = (extractShareData(card).title || '').replace(/\s+/g, ' ').trim();
  if (CONFIG.REVIEW_SEARCH_ENABLED !== false && reviewName) {
    const reviewKw = sanitizeReviewKeyword(CONFIG.REVIEW_SEARCH_KEYWORD);
    const aiMode = CONFIG.REVIEW_SEARCH_AI_MODE === true;
    let reviewBtn = card.querySelector('.tp-review-search-btn');
    if (!reviewBtn) {
      reviewBtn = document.createElement('a');
      reviewBtn.className = 'tp-review-search-btn';
      reviewBtn.textContent = '🌐';
      reviewBtn.target = '_blank';
      reviewBtn.rel = 'noopener';
      reviewBtn.addEventListener('click', e => e.stopPropagation());
    }
    reviewBtn.href = 'https://www.google.com/search?q=' + encodeURIComponent(`${reviewName} ${reviewKw}`) + (aiMode ? '&udm=50' : '');
    setTitleIfChanged(reviewBtn, `Google-Suche: ${reviewName} ${reviewKw}${aiMode ? ' (KI-Modus)' : ''}`);
    reviewBtn.setAttribute('aria-label', `Google-Suche: ${reviewName} ${reviewKw}${aiMode ? ' (KI-Modus)' : ''}`);
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
  // Fresh-deal glow: only newly verified good deals pulse. The badge verdict
  // above is the single source of truth for "good deal" — no duplicate math.
  const freshBadge = card.querySelector('.tp-deal-new-record, .tp-deal-alltime-low');
  const isFresh = !!stats && scanState.freshPids.has(pid) && !!freshBadge;
  card.classList.toggle('tp-deal-fresh', isFresh);
}

export function renderEmptyState(cards, counts) {
  let emptyNotice = document.getElementById('tp-empty-state-notice');

  const totalHidden = counts.filteredCount || 0;

  // Filtern removes cards: empty state whenever all cards are removed.
  if (cards.length > 0 && totalHidden >= cards.length) {
    // Static notice: skip rebuild + listener re-bind when nothing changed
    const emptySig = `${cards.length}:${totalHidden}:${counts.uncheckedDeals || 0}:${CONFIG.REAL_DEAL_MIN_DISCOUNT || 30}`;
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
      <div>🚫 <strong>Alle ${cards.length} Angebote auf dieser Seite sind durch aktive Filter ausgeblendet.</strong></div>
      <div class="tp-empty-state-actions">
        ${counts.uncheckedDeals > 0 ? `<button class="tp-empty-state-btn" id="tp-empty-check-deals-btn" style="border-color: #3b82f6; color: #2563eb;" title="Prüft Differenzen ≥ ${minDisc}% (ungeprüft ≠ Tiefstpreis)">🔍 Tiefstpreise prüfen (≥${minDisc}%)</button>` : ''}
        ${(counts.uncheckedDeals || 0) > 0 || CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? `<button class="tp-empty-state-btn" id="tp-empty-hide-unchecked-btn" title="${CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? `✓ Ungeprüfte aktiv ausgeblendet (${counts.uncheckedHidden || 0}) – klicken zum Aufheben` : `Ungeprüfte ausblenden (${counts.uncheckedHidden || 0}) – entfernt sie aus der Liste`}">${CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? 'Alle anzeigen' : 'Ungeprüfte ausblenden'}</button>` : ''}
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
      showToast(next ? '✓ Ungeprüfte werden ausgeblendet (Filtergrund, entfernt)' : '✓ Ungeprüfte aus — alle werden wieder angezeigt');
    });

    emptyNotice.querySelector('#tp-empty-toggle-filters-btn')?.addEventListener('click', () => {
      updateConfigs({ FILTER_NEG_ENABLED: false, FILTER_MIN_ENABLED: false, BESTPREISE_HIDE_UNCHECKED: false, BESTPREISE_INCLUDE_VORTIEF: true, DEALER_MODE: 'dim' });
      showToast('⏸️ Alle Filter pausiert (alle Angebote sichtbar)');
    });
  } else if (emptyNotice) {
    emptyNotice.remove();
  }
}

