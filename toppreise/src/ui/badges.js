/**
 * Visual Badges & Card Decorator Component
 * Manages card thermal heatmaps, deal badges (Allzeit-Tiefstpreis,
 * Neuer Rekord, Differenz loupe, markup alert), score breakdown pills,
 * mini sparklines, and empty-state messaging.
 */

import { CONFIG, updateConfig, updateConfigs } from '../state/config.js';
import {
  getBadgeHeatStyle,
  getHeatmapStyles,
  getCardDealerRows,
  extractCardDiscount,
  getCardProductId
} from '../page/cards.js';
import { extractCanonicalPrice, parsePrice, priceToCents } from '../domain/price.js';
import { getDealState, computeDealScore, getDisplayDelta, getHeatInput, getLevelPct, isSignificantRecord, medianHorizonLabel } from '../domain/deal-score.js';
import {
  fetchSingleProductPriceStats,
  cancelBestpreiseScan
} from '../scanner/scanner.js';
import { startBatchCheck } from './floating-cta.js';
import { getScanState } from '../state/store.js';
import { getCachedPriceStats } from '../scanner/cache.js';
import { showToast } from './toast.js';
import { renderSparkline } from './sparkline.js';
import { isShippingPriceActive, triggerProcessListings } from '../page/adapter.js';

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

export function renderCardEffects(cd, filters, isNeueFeed, activeStores) {
  const { card, pid, cardPriceEl, cardPrice, stats, diffVal } = cd;
  const displayDelta = cd.displayDelta || getDisplayDelta(cardPrice, stats);

  // Heatmap: gray (no deal) -> red (max savings), single hue (ADR-0002: color
  // always = badge-% heat, text = kind). One computation (getHeatInput) feeds
  // BOTH the card heat here and the badge headline below, so the ribbon
  // number always matches its color. The ranking score sorts only.
  // Unverified site discounts never heat: they read striped-gray via
  // tp-is-unverified (step 1b/6 below), verified cards heat as before.
  const emphasizeMedian = (typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number'
    ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50) < 0.5;
  const heatMode = CONFIG.BESTPREISE_MODE_ACTIVE ? 'bestpreise' : 'browse';
  const heatOpts = {
    display: displayDelta,
    mode: heatMode,
    weightRecord: (typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number'
      ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50)
  };
  if (heatMode === 'bestpreise') {
    heatOpts.dealScore = (stats && cardPrice > 0)
      ? (cd.dealScore || computeDealScore(stats, cardPrice)) : null;
  }
  const heatInfo = getHeatInput(cardPrice, stats, diffVal, heatOpts);
  const effectiveDiff = heatInfo.value;
  const heatProvisional = heatInfo.provisional;
  const heatIntensity = CONFIG.HEATMAP_INTENSITY;

  // Geprüft vs ungeprüft: only verified stats heat the card/badge. Provisional
  // site Differenzen stay neutral — the tp-is-unverified class below paints
  // them gray-striped instead, so the state scans without comparing saturation.
  if (CONFIG.HEATMAP_ENABLED && !heatProvisional && effectiveDiff !== null && !isNaN(effectiveDiff)) {
    const heatKey = `${effectiveDiff}_${heatIntensity.toFixed(2)}`;
    if (card.dataset.tpAppliedHeat !== heatKey) {
      card.dataset.tpAppliedHeat = heatKey;
      const heatStyles = getHeatmapStyles(effectiveDiff, heatIntensity);
      card.style.setProperty('--tp-heat-bg', heatStyles.bg);
      card.style.setProperty('--tp-heat-border', heatStyles.border);
      card.style.setProperty('--tp-heat-glow', heatStyles.glow);

      // DarkReader Dynamic Theme compatibility:
      card.style.setProperty('--darkreader-inline-bgimage', heatStyles.bg);
      card.style.setProperty('--darkreader-inline-bgcolor', 'transparent');
      card.style.setProperty('--darkreader-inline-border', heatStyles.border);
      card.style.setProperty('--darkreader-inline-border-top', heatStyles.border);
      card.style.setProperty('--darkreader-inline-border-right', heatStyles.border);
      card.style.setProperty('--darkreader-inline-border-bottom', heatStyles.border);
      card.style.setProperty('--darkreader-inline-border-left', heatStyles.border);
      card.style.setProperty('background', heatStyles.bg, 'important');
      card.style.setProperty('background-image', heatStyles.bg, 'important');
      card.style.setProperty('border-color', heatStyles.border, 'important');

      if (card.hasAttribute('data-darkreader-inline-bgcolor')) card.removeAttribute('data-darkreader-inline-bgcolor');
      if (card.hasAttribute('data-darkreader-inline-bgimage')) card.removeAttribute('data-darkreader-inline-bgimage');

      const subElements = card.querySelectorAll(HEAT_SUB_SELECTOR);
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

      card.classList.add('tp-heatmap-active');
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
  } else if (card.dataset.tpAppliedHeat || card.classList.contains('tp-heatmap-active')) {
    // Tripwire: heat stripped while the badge still claims a verified % means
    // a stats regression slipped through — enable DEBUG to catch it live.
    if (CONFIG.DEBUG && card.querySelector('.tp-deal-alltime-low, .tp-deal-new-record')) {
      console.warn('[Toppreise Suite] heat removed with verified badge present',
        { pid, median: stats?.medianPrice ?? null, tiefstpreis: stats?.tiefstpreis ?? null });
    }
    delete card.dataset.tpAppliedHeat;
    card.classList.remove('tp-heatmap-active');
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
  if (getScanState().currentlyScanningPid && getScanState().currentlyScanningPid === pid) {
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

  // 3. Toppreis Highlighting (filtered store holds the cheapest offer)
  const dealerRows = activeStores.length > 0 ? getCardDealerRows(card) : [];
  if (activeStores.length === 0 || (!isNeueFeed && dealerRows.length === 0)) {
    card.classList.remove('tp-is-cheapest', 'tp-not-cheapest', 'tp-no-store-offer');
    card.querySelector('.tp-best-price-badge')?.remove();
  } else {
    let matchedRow = null;
    for (let d = 0; d < dealerRows.length; d++) {
      const item = dealerRows[d];
      if (item.storeName && activeStores.some(store => item.storeName.includes(store) || store.includes(item.storeName))) {
        matchedRow = item.row;
        break;
      }
    }

    if (matchedRow) {
      const useShipping = isShippingPriceActive(card);
      const storePriceEl = useShipping
        ? (matchedRow.querySelector('.shippingPrice .Plugin_Price') || matchedRow.querySelector('.productPrice .Plugin_Price'))
        : (matchedRow.querySelector('.productPrice .Plugin_Price') || matchedRow.querySelector('.shippingPrice .Plugin_Price'));
      const storePrice = storePriceEl ? parsePrice(storePriceEl.textContent) : 0;
      const bestPrice = cardPrice > 0 ? cardPrice : (cardPriceEl ? parsePrice(cardPriceEl.textContent) : 0);

      if (storePrice > 0 && bestPrice > 0 && storePrice <= bestPrice * (1 + CONFIG.MARGIN_PERCENT / 100)) {
        card.classList.add('tp-is-cheapest');
        card.classList.remove('tp-not-cheapest', 'tp-no-store-offer');
        if (!card.querySelector('.tp-best-price-badge')) {
          const badge = document.createElement('div');
          badge.className = 'tp-best-price-badge';
          badge.textContent = 'Toppreis';
          card.appendChild(badge);
        }
      } else {
        card.classList.add(storePrice > 0 && bestPrice > 0 ? 'tp-not-cheapest' : 'tp-no-store-offer');
        card.classList.remove('tp-is-cheapest', storePrice > 0 && bestPrice > 0 ? 'tp-no-store-offer' : 'tp-not-cheapest');
        card.querySelector('.tp-best-price-badge')?.remove();
      }
    } else {
      card.classList.add('tp-no-store-offer');
      card.classList.remove('tp-is-cheapest', 'tp-not-cheapest');
      card.querySelector('.tp-best-price-badge')?.remove();
    }
  }

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

    // Bind single click handler on badge
    if (!badgeDifEl.dataset.tpDealBound) {
      badgeDifEl.dataset.tpDealBound = 'true';
      badgeDifEl.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (badgeDifEl.classList.contains('tp-deal-loading')) return;
        const currentPid = getCardProductId(card);
        if (!currentPid) return;

        badgeDifEl.classList.add('tp-deal-loading');
        badgeDifEl.innerHTML = `<div class="text">Prüfe...</div><p>⏳</p>`;
        const requestTimePrice = extractCanonicalPrice(card).price;
        const fetchedStats = await fetchSingleProductPriceStats(currentPid, 1, true);

        // Re-verify the card's price hasn't changed underneath us (e.g. dynamic sorting/reactivity)
        const currentTimePrice = extractCanonicalPrice(card).price;

        if (!requestTimePrice || !currentTimePrice || priceToCents(requestTimePrice) !== priceToCents(currentTimePrice)) {
          // Price changed or is missing during fetch, fetch might be stale or product swapped
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
      });
    }

    if (CONFIG.BESTPREISE_MODE_ACTIVE) {
      const dealData = cd.dealScore || computeDealScore(stats, cardPrice);
      if (dealData) {
        // Qualified Tiefstpreis! Badge-% = echter Rabatt (Rekord vs Bisher
        // bzw. Ø-Preis), NIE der Score und NIE die Site-Differenz. Der Score
        // sortiert; die Gewichtung setzt zusätzlich die Emphase: Unter 50%
        // Rekord führt das Badge den Ø-Rabatt (Farbe folgt mit — Zahl und
        // Farbe stimmen immer überein, Rek/Ø stehen beide in der Pille).
        card.classList.remove('tp-bestpreise-hidden', 'tp-non-bestpreis-filtered');
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

        const prevLow = stats?.previousLow;
        const medianVal = stats?.medianPrice;
        const horizonLabel = medianHorizonLabel(stats);
        const outlierText = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? ` | ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert` : '';
        const levelPct = getLevelPct(cardPrice, stats);
        // Single source (ADR-0002): the headline % is the heat input computed
        // above — ribbon number always matches its color. medianHeadline and
        // showRecord stay for classes + tooltips.
        const medianHeadline = emphasizeMedian && levelPct > 0;
        const badgePct = heatInfo.pct;
        const badgeKind = heatInfo.kind === 'rekord' ? 'Rekord' : (badgePct > 0 ? 'Ø-Preis' : '');

        if (isListView) {
          if (badgePct > 0) {
            setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Tiefstpreis -${badgePct}% (${badgeKind})</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Tiefstpreis</p>`);
          }
        } else {
          if (badgePct > 0) {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis · ${badgeKind}</div><p>-${badgePct}%</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>🌟</p>`);
          }
        }

        const colorLegend = `Farbe = Rabatt-Tiefe (tiefrot = grosser Tiefstpreis, grau = kein Rabatt)`;
        const wRec = (typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number') ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50;
        const wMed = 1 - wRec;
        const fmtW = w => String(Math.round(w * 100) / 100);
        const scoreFormula = `Tiefstpreis-Score ${dealData.score} = ${fmtW(wMed)}×Ø(${dealData.dMedian}) + ${fmtW(wRec)}×Rek(${dealData.dRecord}) (nur Feed-Sortierung)`;
        const outlierLine = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? `\nℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert` : '';
        if (showRecord && !medianHeadline) {
          setTitleIfChanged(badgeDifEl, `🔥 Neuer Rekord (CHF ${cardPrice.toFixed(2)}): -${badgePct}% vs Bisher CHF ${prevLow ? prevLow.toFixed(2) : '?'}\nBadge = Rekord-Rabatt · ${colorLegend}\n${scoreFormula}${outlierLine}\n[Klicken zum Aktualisieren]`);
        } else if (showRecord) {
          setTitleIfChanged(badgeDifEl, `🌟 Allzeit-Tiefstpreis (CHF ${cardPrice.toFixed(2)}) — Ø-Emphase: Badge = Ø-Rabatt -${badgePct}% (Rekord -${displayDelta.dRecord}% steht in der Pille) · ${colorLegend}\n${scoreFormula}${outlierLine}\n[Klicken zum Aktualisieren]`);
        } else {
          setTitleIfChanged(badgeDifEl, `🌟 Allzeit-Tiefstpreis (CHF ${cardPrice.toFixed(2)})!\n${badgePct > 0 ? `Badge = Ø-Rabatt -${badgePct}% (Ø ${horizonLabel}${medianVal ? ` CHF ${medianVal.toFixed(2)}` : ''}, kein neuer Rekord) · ${colorLegend}` : `Kein neuer Rekord · ${colorLegend}`}\n${scoreFormula}${outlierLine}\n[Klicken zum Aktualisieren]`);
        }

        // Score pill: inputs + weights + result in one glance (teaches the formula).
        // (Container has pointer-events:none, so the formula lives in the badge title above.)
        let breakdownEl = card.querySelector('.tp-badge-score-breakdown');
        if (isListView) {
          breakdownEl?.remove();
        } else {
          if (!breakdownEl) {
            breakdownEl = document.createElement('div');
            breakdownEl.className = 'tp-badge-score-breakdown';
            card.appendChild(breakdownEl);
          }
          // The Score result only prints when it says something new: under
          // Ø-Emphase Score == Ø by construction (same number thrice). The
          // formula itself stays documented in the badge tooltip.
          const shownInputs = (dealData.isNewRecord && dealData.dRecord > 0)
            ? [dealData.dRecord, dealData.dMedian] : [dealData.dMedian];
          const scoreTail = shownInputs.includes(dealData.score)
            ? '' : ` → <span class="tp-score-result">Score: ${dealData.score}</span>`;
          if (dealData.isNewRecord && dealData.dRecord > 0) {
            setHtmlIfChanged(breakdownEl, `<span class="tp-score-record" title="Neuer Rekord-Rabatt (-${dealData.dRecord}%)">Rek: -${dealData.dRecord}%</span> · <span class="tp-score-median" title="${horizonLabel}-Median-Rabatt (-${dealData.dMedian}%)">Ø: -${dealData.dMedian}%</span>${scoreTail}`);
          } else {
            setHtmlIfChanged(breakdownEl, `<span class="tp-score-median" title="${horizonLabel}-Median-Rabatt (-${dealData.dMedian}%)">Ø: -${dealData.dMedian}%</span>${scoreTail}`);
          }
        }

        // Bisher-line: the previous low is the single most decision-relevant
        // number on the card — always shown when known & distinct from the
        // current price, never dropped in favour of the Ø line.
        const showPrevLow = !!(prevLow && priceToCents(prevLow) > priceToCents(cardPrice));
        const showMedianLine = !!(medianVal && medianVal > cardPrice);
        let histPriceEl = ensureHistPriceEl(card, cardPriceEl);

        if (showPrevLow || showMedianLine) {
          const parts = [];
          if (showPrevLow) parts.push(`Bisher: CHF ${prevLow.toFixed(2)}`);
          if (showMedianLine) parts.push(`Ø-Preis (${horizonLabel}): CHF ${medianVal.toFixed(2)}`);
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
        // Verified NON-Deal (stats but no qualifying score — e.g. minimal
        // fallback stats without median, or above-low). Strictness lives in
        // the mode now. The badge is ALWAYS repainted from the current stats
        // — never preserved — so a stats regression can't strand a stale
        // verified-% badge on a card whose heat is gone.
        if (CONFIG.BESTPREISE_MODE_ACTIVE === true) {
          card.classList.add('tp-bestpreise-hidden');
        } else {
          card.classList.remove('tp-bestpreise-hidden');
        }
        badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');
        card.querySelector('.tp-card-historical-price')?.remove();
        card.querySelector('.tp-badge-score-breakdown')?.remove();
        const ddNow = getDisplayDelta(cardPrice, stats);
        if (ddNow.kind === 'above-low') {
          badgeDifEl.classList.add('tp-deal-not-low', 'tp-deal-badge-interactive');
          setTitleIfChanged(badgeDifEl, `⚠️ Kein Tiefstpreis: CHF ${cardPrice.toFixed(2)} (historisches Tief CHF ${stats.tiefstpreis.toFixed(2)}, +${ddNow.markup}% Aufschlag)\nFarbe = Rabatt-Tiefe (grau = kein Rabatt)\n[Klicken zum Aktualisieren]`);
          const fakeNow = sitePctText ? `<span class="tp-fake-discount"><s>${sitePctText}</s></span>` : '';
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⚠️</span><p class="tp-markup-val">+${ddNow.markup}%</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Aufschlag</div><p class="tp-markup-val">+${ddNow.markup}%</p>${fakeNow}`);
          }
        } else if (ddNow.kind === 'at-low' || ddNow.kind === 'new-low') {
          // At-low without median (or unscored record): plain Tiefstpreis,
          // no % claimed — the heat stays neutral gray to match.
          badgeDifEl.classList.add('tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-not-low', 'tp-is-severe-markup');
          setTitleIfChanged(badgeDifEl, `🌟 Tiefstpreis (CHF ${cardPrice.toFixed(2)}) — ohne Median kein %-Wert, daher grau statt farbig.\n[Klicken zum Aktualisieren]`);
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Tiefstpreis</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>🌟</p>`);
          }
        }
        // 'unknown' (no usable price): loupe state stays — nothing truthful to claim.
      } else {
        // Unscanned card (!stats) -> loupe / loading spinner. Hidden only
        // when "Nur Geprüfte" is on; otherwise kept visible for checking.
        card.classList.remove('tp-bestpreise-hidden');
        if (CONFIG.BESTPREISE_HIDE_UNCHECKED === true) card.classList.add('tp-bestpreise-hidden');
        badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');

        if (getScanState().currentlyScanningPid && getScanState().currentlyScanningPid === pid) {
          badgeDifEl.classList.add('tp-deal-loading');
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⏳</span><p>Prüfe...</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfe...</div><p>⏳</p>`);
          }
        } else {
          badgeDifEl.classList.remove('tp-deal-loading');
          if (rawDiscount !== null && !isNaN(rawDiscount)) {
            setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz (z.B. vs UVP, ungeprüft), kein verifizierter Tiefstpreis. Klicken: echten Allzeit-Tiefstpreis prüfen.`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>${sitePctText}</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>${sitePctText}</p><span class="tp-badge-loupe-icon">🔍</span>`);
            }
          } else {
            setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen. Badge-% nach Prüfung = echter Rabatt (Rekord vs Bisher bzw. Ø-Preis).`);
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
      card.classList.remove('tp-bestpreise-hidden');
      badgeDifEl.classList.remove('tp-deal-new-record');
      card.querySelector('.tp-badge-score-breakdown')?.remove();

      if (getScanState().currentlyScanningPid && getScanState().currentlyScanningPid === pid) {
        badgeDifEl.classList.add('tp-deal-loading');
        if (isListView) {
          setHtmlIfChanged(badgeDifEl, `<span>⏳</span><p>Prüfe...</p>`);
        } else {
          setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfe...</div><p>⏳</p>`);
        }
      } else {
        badgeDifEl.classList.remove('tp-deal-loading');
      }

      const state = getDealState(cardPrice, stats?.tiefstpreis);

      if (state !== 'unknown') {
        const isAllTimeLow = (state === 'new-low' || state === 'at-low');
        const isNonBest = (state === 'above-low');
        const isNewRecord = (state === 'new-low') || !!(stats.isNewAllTimeLow || (isAllTimeLow && stats.previousLow && priceToCents(stats.previousLow) > priceToCents(cardPrice)));
        const prevLow = stats.previousLow;
        const realDropVsPrev = prevLow && prevLow > cardPrice ? Math.round(((prevLow - cardPrice) / prevLow) * 100) : (stats.realDiscountVsPrevLow || 0);

        // Strictness lives in the mode now: outside it, verified non-deals
        // stay visible with a truthful Aufschlag badge. Always drop the
        // legacy hiding class (mode hiding uses tp-bestpreise-hidden).
        card.classList.remove('tp-non-bestpreis-filtered');

        const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;

        if (isAllTimeLow) {
          // 3B: Verified All-Time Low (Glowing Emerald Halo)
          // Badge-% = echter Rabatt (Rekord vs Bisher bzw. Ø-Preis) — die
          // Site-Differenz steht nach Prüfung nur noch.Tooltip als Kontext.
          badgeDifEl.classList.add('tp-deal-alltime-low', 'tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

          const showRecord = isSignificantRecord(displayDelta);
          const levelPct = getLevelPct(cardPrice, stats);
          // Single source (ADR-0002): headline % is the heat input above.
          const badgePct = heatInfo.pct;
          const badgeKind = heatInfo.kind === 'rekord' ? 'Rekord' : (badgePct > 0 ? 'Ø-Preis' : '');

          const detailParts = [];
          if (isNewRecord && prevLow) {
            detailParts.push(`Bisheriger Rekord: CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)`);
          }
          if (stats.avgPrice && stats.avgPrice > cardPrice) {
            detailParts.push(`Durchschnitt: CHF ${stats.avgPrice.toFixed(2)}`);
          }
          if (hasSignificantPeak) {
            const peakDropPct = Math.round(((stats.hoechstpreis - cardPrice) / stats.hoechstpreis) * 100);
            detailParts.push(`-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)}`);
          }
          if (sitePctText) {
            detailParts.push(`Differenz: ${sitePctText} (ungeprüft, z.B. UVP)`);
          }
          const detailLine = detailParts.length > 0 ? `\n${detailParts.join(' · ')}` : '';
          const colorLegend = `Farbe = Rabatt-Tiefe (tiefrot = grosser Tiefstpreis, grau = kein Rabatt)`;

          setTitleIfChanged(badgeDifEl, `🌟 ${showRecord ? 'Neuer Allzeit-Tiefstpreis' : 'Allzeit-Tiefstpreis'} (CHF ${cardPrice.toFixed(2)})!\n${badgePct > 0 ? `Badge −${badgePct}% (${badgeKind}) · ${colorLegend}` : `${colorLegend}`}${detailLine}\n[Klicken zum Aktualisieren]`);
          if (isListView) {
            if (badgePct > 0) {
              setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Tiefstpreis -${badgePct}% (${badgeKind})</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Tiefstpreis</p>`);
            }
          } else {
            if (badgePct > 0) {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis · ${badgeKind}</div><p>-${badgePct}%</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>🌟</p>`);
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

          const notLowParts = [];
          if (sitePctText) {
            notLowParts.push(`Differenz: ${sitePctText} (ungeprüft, z.B. UVP)`);
          }
          if (hasSignificantPeak) {
            notLowParts.push(`Höchstpreis: CHF ${stats.hoechstpreis.toFixed(2)}`);
          }
          const notLowLine = notLowParts.length > 0 ? `\n${notLowParts.join(' · ')}` : '';
          setTitleIfChanged(badgeDifEl, `⚠️ Kein Tiefstpreis: CHF ${cardPrice.toFixed(2)} (historisches Tief CHF ${stats.tiefstpreis.toFixed(2)}, +${markupPct}% Aufschlag)${notLowLine}\nFarbe = Rabatt-Tiefe (rot = Deal, grau = kein Rabatt)\n[Klicken zum Aktualisieren]`);
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
          if (showPrevLow) parts.push(`Bisher: CHF ${prevLow.toFixed(2)}`);
          if (showMedianLine) parts.push(`Ø-Preis (${horizonLabel}): CHF ${stats.medianPrice.toFixed(2)}`);
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
        card.classList.remove('tp-non-bestpreis-filtered');
        if (CONFIG.BESTPREISE_HIDE_UNCHECKED === true) card.classList.add('tp-bestpreise-hidden');

        badgeDifEl.classList.add('tp-deal-badge-interactive');
        badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');
        if (isNeueFeed && rawDiscount !== null && !isNaN(rawDiscount)) {
          setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz (z.B. vs UVP, ungeprüft), kein verifizierter Tiefstpreis. Klicken: echten Allzeit-Tiefstpreis prüfen. Grau gestreift = ungeprüft.`);
          setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>${sitePctText}</p><span class="tp-badge-loupe-icon">🔍</span>`);
        } else {
          setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen. Badge-% nach Prüfung = echter Rabatt (Rekord vs Bisher bzw. Ø-Preis); die Kartenfarbe folgt der Badge-% (rot = Deal, grau = kein Rabatt).`);
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>Prüfen</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfen</div><p style="font-size: 15px; margin: 0; line-height: 1.1;">🔍</p>`);
          }
        }
      }
    }
  } else {
    card.classList.remove('tp-non-bestpreis-filtered', 'tp-bestpreise-hidden');
    card.querySelector('.tp-card-historical-price')?.remove();
  }

  // 5. Mini Price-Trend Sparkline
  if (CONFIG.ENABLE_SPARKLINES && stats && Array.isArray(stats.timeSeries) && stats.timeSeries.length >= 2) {
    let sparkContainer = card.querySelector('.tp-sparkline-container');
    if (!sparkContainer) {
      sparkContainer = document.createElement('div');
      sparkContainer.className = 'tp-sparkline-container';
    }
    if (!sparkContainer.querySelector('.tp-sparkline')) {
      const svg = renderSparkline(stats.timeSeries, 44, 13);
      if (svg) {
        sparkContainer.replaceChildren();
        sparkContainer.appendChild(svg);
      }
    }
    const histPriceEl = card.querySelector('.tp-card-historical-price');
    if (histPriceEl) {
      let subRow = card.querySelector('.tp-card-subline-row');
      if (!subRow) {
        subRow = document.createElement('div');
        subRow.className = 'tp-card-subline-row';
        histPriceEl.parentElement?.insertBefore(subRow, histPriceEl);
        subRow.appendChild(histPriceEl);
      }
      if (sparkContainer.parentElement !== subRow) {
        subRow.appendChild(sparkContainer);
      }
    } else {
      const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                             cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                             cardPriceEl?.parentElement ||
                             card;
      if (sparkContainer.parentElement !== priceContainer) {
        priceContainer.appendChild(sparkContainer);
      }
    }
  } else {
    card.querySelector('.tp-sparkline-container')?.remove();
    const subRow = card.querySelector('.tp-card-subline-row');
    if (subRow) {
      const hist = subRow.querySelector('.tp-card-historical-price');
      if (hist) {
        subRow.parentElement?.insertBefore(hist, subRow);
      }
      subRow.remove();
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
}

export function renderEmptyState(cards, counts) {
  let emptyNotice = document.getElementById('tp-empty-state-notice');

  // If qualifying bestpreise deals exist on page, NEVER render empty state
  if (counts.bestpreiseDeals > 0) {
    if (emptyNotice) emptyNotice.remove();
    return;
  }

  const totalHidden = (counts.neg || 0) + (counts.min || 0) + (counts.nonBest || 0) + (counts.bestpreiseHidden || 0);
  const isRevealed = document.body.classList.contains('tp-reveal-filtered');

  const isBestpreiseEmpty = CONFIG.BESTPREISE_MODE_ACTIVE && (counts.bestpreiseHidden || 0) > 0;
  if (cards.length > 0 && totalHidden >= cards.length && !isRevealed) {
    // Static notice: skip rebuild + listener re-bind when nothing changed
    const emptySig = `${cards.length}:${totalHidden}:${isBestpreiseEmpty}:${counts.uncheckedDeals || 0}:${CONFIG.REAL_DEAL_MIN_DISCOUNT || 30}:${CONFIG.BESTPREISE_HIDE_UNCHECKED === true}`;
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
        ${(counts.uncheckedDeals || 0) > 0 || CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? `<button class="tp-empty-state-btn" id="tp-empty-hide-unchecked-btn" title="Ungeprüfte Deals aus-/einblenden">👁️ ${CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? 'Alle anzeigen' : 'Nur geprüfte'}</button>` : ''}
        <button class="tp-empty-state-btn" id="tp-empty-reveal-btn">👁️ Ausgeblendete anzeigen</button>
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
      showToast(next ? '👁️ Nur geprüfte Deals werden angezeigt' : '👁️ Ungeprüfte Deals werden wieder angezeigt');
    });

    emptyNotice.querySelector('#tp-empty-reveal-btn')?.addEventListener('click', () => {
      document.body.classList.toggle('tp-reveal-filtered');
      triggerProcessListings();
    });
    emptyNotice.querySelector('#tp-empty-disable-bestpreise-btn')?.addEventListener('click', () => {
      cancelBestpreiseScan();
      updateConfig('BESTPREISE_MODE_ACTIVE', false);
      showToast('Tiefstpreise-Modus deaktiviert');
    });
    emptyNotice.querySelector('#tp-empty-toggle-filters-btn')?.addEventListener('click', () => {
      updateConfigs({
        FILTER_NEG_ENABLED: false,
        FILTER_MIN_ENABLED: false
      });
      showToast('⏸️ Alle Filter pausiert (alle Angebote sichtbar)');
    });
  } else if (emptyNotice) {
    emptyNotice.remove();
  }
}

