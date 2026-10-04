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
import { getDealState, computeDealScore, getDisplayDelta, getHeatInput, isSignificantRecord } from '../domain/deal-score.js';
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

  // Heatmap: gray (no deal) -> red (max savings), single hue. The badge reuses
  // the card logic (getBadgeHeatStyle) so badge color always matches card heat.
  // The blended ranking score drives sorting only, never color or badge text.
  // Unverified site discounts render paler so provisional heat reads provisional.
  const heatInfo = getHeatInput(cardPrice, stats, diffVal);
  const effectiveDiff = heatInfo.value;
  const heatProvisional = heatInfo.provisional;
  const heatIntensity = heatProvisional
    ? Math.max(0.2, Math.min(1.0, CONFIG.HEATMAP_INTENSITY * 0.55))
    : CONFIG.HEATMAP_INTENSITY;

  if (CONFIG.HEATMAP_ENABLED && effectiveDiff !== null && !isNaN(effectiveDiff)) {
    const heatKey = `${effectiveDiff}_${heatProvisional ? 'prov' : 'ver'}_${heatIntensity.toFixed(2)}`;
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

      // Badge follows the card heat: same ramp, solid swatch.
      const heatBadgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
      if (heatBadgeEl) {
        const badgeHeat = getBadgeHeatStyle(effectiveDiff, heatProvisional);
        heatBadgeEl.style.setProperty('background', badgeHeat.background, 'important');
        heatBadgeEl.style.setProperty('border-color', badgeHeat.border, 'important');
        heatBadgeEl.style.setProperty('color', '#ffffff', 'important');
        heatBadgeEl.style.setProperty('box-shadow', '0 2px 10px rgba(0,0,0,0.45)', 'important');
        heatBadgeEl.style.setProperty('--darkreader-inline-bgcolor', badgeHeat.background);
      }
    }
  } else if (card.dataset.tpAppliedHeat || card.classList.contains('tp-heatmap-active')) {
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
        // sortiert nur (siehe Tooltip) und treibt keine Farben an.
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
        const horizonLabel = stats?.horizonDays && stats.horizonDays > 0 ? `${stats.horizonDays >= 365 ? '1J' : stats.horizonDays + 'T'}` : 'Lifetime';
        const outlierText = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? ` | ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert` : '';
        const levelPct = (medianVal && medianVal > cardPrice)
          ? Math.round(((medianVal - cardPrice) / medianVal) * 100)
          : 0;
        // Badge-%: Rekord-Rabatt bei neuem Rekord, sonst Ø-Rabatt.
        const badgePct = showRecord ? displayDelta.dRecord : levelPct;
        const badgeKind = showRecord ? 'Rekord' : (badgePct > 0 ? 'Ø-Preis' : '');

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
        if (showRecord) {
          setTitleIfChanged(badgeDifEl, `🔥 Neuer Rekord (CHF ${cardPrice.toFixed(2)}): -${badgePct}% vs Bisher CHF ${prevLow ? prevLow.toFixed(2) : '?'}\nBadge = Rekord-Rabatt · ${colorLegend}\n${scoreFormula}${outlierLine}\n[Klicken zum Aktualisieren]`);
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
          const scoreTail = ` → <span class="tp-score-result">Score: ${dealData.score}</span>`;
          if (dealData.isNewRecord && dealData.dRecord > 0) {
            setHtmlIfChanged(breakdownEl, `<span class="tp-score-record" title="Neuer Rekord-Rabatt (-${dealData.dRecord}%)">Rek: -${dealData.dRecord}%</span> · <span class="tp-score-median" title="${horizonLabel}-Median-Rabatt (-${dealData.dMedian}%)">Ø: -${dealData.dMedian}%</span>${scoreTail}`);
          } else {
            setHtmlIfChanged(breakdownEl, `<span class="tp-score-median" title="${horizonLabel}-Median-Rabatt (-${dealData.dMedian}%)">Ø: -${dealData.dMedian}%</span>${scoreTail}`);
          }
        }

        let histPriceEl = ensureHistPriceEl(card, cardPriceEl);

        if (dealData.isNewRecord && prevLow) {
          histPriceEl.className = 'tp-card-historical-price tp-is-record-low';
          setTextIfChanged(histPriceEl, `Bisher: CHF ${prevLow.toFixed(2)} (-${dealData.dRecord}%)`);
          setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief: CHF ${prevLow.toFixed(2)} (-${dealData.dRecord}%)${outlierText}`);
        } else if (medianVal && medianVal > cardPrice) {
          histPriceEl.className = 'tp-card-historical-price tp-is-at-low';
          setTextIfChanged(histPriceEl, `Ø-Preis (${horizonLabel}): CHF ${medianVal.toFixed(2)} (-${dealData.dMedian}%)`);
          setTitleIfChanged(histPriceEl, `Allzeit-Tiefstpreis! Liegt ${dealData.dMedian}% unter dem ${horizonLabel}-Median von CHF ${medianVal.toFixed(2)}${outlierText}`);
        } else {
          histPriceEl.remove();
        }
      } else if (stats) {
        // Verified NON-Deal (has stats but score <= 0 or not at low) -> HIDE IT if filters enabled!
        if (CONFIG.FILTER_BESTPREIS_ENABLED !== false) {
          card.classList.add('tp-bestpreise-hidden');
        } else {
          card.classList.remove('tp-bestpreise-hidden');
        }
        badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');
        card.querySelector('.tp-card-historical-price')?.remove();
        card.querySelector('.tp-badge-score-breakdown')?.remove();
      } else {
        // Unscanned card (!stats) -> KEEP VISIBLE with interactive loupe / loading spinner!
        card.classList.remove('tp-bestpreise-hidden');
        badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-alltime-low');
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

        if (CONFIG.FILTER_BESTPREIS_ENABLED !== false && isNonBest && CONFIG.REAL_DEAL_FILTER_ACTIVE) {
          card.classList.add('tp-non-bestpreis-filtered');
        } else {
          card.classList.remove('tp-non-bestpreis-filtered');
        }

        const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;

        if (isAllTimeLow) {
          // 3B: Verified All-Time Low (Glowing Emerald Halo)
          // Badge-% = echter Rabatt (Rekord vs Bisher bzw. Ø-Preis) — die
          // Site-Differenz steht nach Prüfung nur noch.Tooltip als Kontext.
          badgeDifEl.classList.add('tp-deal-alltime-low', 'tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

          const showRecord = isSignificantRecord(displayDelta);
          const levelPct = (stats.medianPrice && stats.medianPrice > cardPrice)
            ? Math.round(((stats.medianPrice - cardPrice) / stats.medianPrice) * 100)
            : 0;
          const badgePct = showRecord ? displayDelta.dRecord : levelPct;
          const badgeKind = showRecord ? 'Rekord' : (badgePct > 0 ? 'Ø-Preis' : '');

          const detailParts = [];
          if (isNewRecord && prevLow) {
            detailParts.push(`Bisheriger Rekord: CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)`);
          }
          if (stats.avgPrice && stats.avgPrice > cardPrice) {
            detailParts.push(`Ø-Preis: CHF ${stats.avgPrice.toFixed(2)}`);
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
          setTitleIfChanged(badgeDifEl, `⚠️ Kein Tiefstpreis: CHF ${cardPrice.toFixed(2)} (historisches Tief CHF ${stats.tiefstpreis.toFixed(2)}, +${markupPct}% Aufschlag)${notLowLine}\nFarbe = Rabatt-Tiefe (rot = Deal, grau = kein Rabatt; blass = ungeprüft)\n[Klicken zum Aktualisieren]`);
          const fakeDiscHtml = sitePctText ? `<span class="tp-fake-discount"><s>${sitePctText}</s></span>` : '';
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⚠️</span><p class="tp-markup-val">+${markupPct}%</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Aufschlag</div><p class="tp-markup-val">+${markupPct}%</p>${fakeDiscHtml}`);
          }
        }

        // 4A: Historical Tiefstpreis line right below current price
        // (pre-existing element lookup doubles as the stale-element removal path below)
        let histPriceEl = card.querySelector('.tp-card-historical-price');
        if (isNonBest) {
          histPriceEl = ensureHistPriceEl(card, cardPriceEl);
          histPriceEl.className = 'tp-card-historical-price tp-is-markup';
          setTextIfChanged(histPriceEl, `Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)}`);
          setTitleIfChanged(histPriceEl, `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100)}% Aufschlag)`);
        } else if (isNewRecord && prevLow) {
          histPriceEl = ensureHistPriceEl(card, cardPriceEl);
          histPriceEl.className = 'tp-card-historical-price tp-is-record-low';
          setTextIfChanged(histPriceEl, `Bisher: CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)`);
          setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)}`);
        } else if (!isNeueFeed && stats.medianPrice && stats.medianPrice > cardPrice) {
          histPriceEl = ensureHistPriceEl(card, cardPriceEl);
          const dMedian = Math.round(((stats.medianPrice - cardPrice) / stats.medianPrice) * 100);
          const horizonLabel = stats.horizonDays && stats.horizonDays > 0 ? `${stats.horizonDays >= 365 ? '1J' : stats.horizonDays + 'T'}` : '1J';
          histPriceEl.className = 'tp-card-historical-price tp-is-at-low';
          setTextIfChanged(histPriceEl, `Ø-Preis (${horizonLabel}): CHF ${stats.medianPrice.toFixed(2)} (-${dMedian}%)`);
          setTitleIfChanged(histPriceEl, `Allzeit-Tiefstpreis! Liegt ${dMedian}% unter dem ${horizonLabel}-Median von CHF ${stats.medianPrice.toFixed(2)}`);
        } else if (histPriceEl) {
          histPriceEl.remove();
        }
      } else {
        // 1A: Unchecked State (Subtle Mini Loupe + Hover Scale + Tooltip)
        card.classList.remove('tp-non-bestpreis-filtered');
        card.querySelector('.tp-card-historical-price')?.remove();

        badgeDifEl.classList.add('tp-deal-badge-interactive');
        badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');
        if (isNeueFeed && rawDiscount !== null && !isNaN(rawDiscount)) {
          setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz (z.B. vs UVP, ungeprüft), kein verifizierter Tiefstpreis. Klicken: echten Allzeit-Tiefstpreis prüfen. Blasse Farbe = ungeprüft.`);
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
    const emptySig = `${cards.length}:${totalHidden}:${isBestpreiseEmpty}:${counts.uncheckedDeals || 0}:${CONFIG.REAL_DEAL_MIN_DISCOUNT || 30}`;
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
        <button class="tp-empty-state-btn" id="tp-empty-reveal-btn">👁️ Ausgeblendete anzeigen</button>
        ${isBestpreiseEmpty ? '<button class="tp-empty-state-btn" id="tp-empty-disable-bestpreise-btn">💎 Tiefstpreise-Modus ausschalten</button>' : ''}
        <button class="tp-empty-state-btn" id="tp-empty-toggle-filters-btn">⚡ Filter ausschalten</button>
      </div>
    `;
    emptyNotice.dataset.tpEmptySig = emptySig;
    emptyNotice.querySelector('#tp-empty-check-deals-btn')?.addEventListener('click', () => {
      // Toolbar batch button removed: the floating CTA owns this action now.
      // startBatchCheck works even when the pill is dismissed for the session.
      startBatchCheck();
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
        FILTER_MIN_ENABLED: false,
        FILTER_BESTPREIS_ENABLED: false
      });
      showToast('⏸️ Alle Filter pausiert (alle Angebote sichtbar)');
    });
  } else if (emptyNotice) {
    emptyNotice.remove();
  }
}

