/**
 * Visual Badges & Card Decorator Component
 * Manages card thermal heatmaps, quick-block buttons, deal badges (Allzeit-Tiefstpreis,
 * Neuer Rekord, Differenz loupe, markup alert), score breakdown pills,
 * mini sparklines, and empty-state messaging.
 */

import { CONFIG, updateConfig, updateConfigs } from '../state/config.js';
import {
  getHeatmapStyles,
  getCardDealerRows,
  extractCardDiscount,
  getCardProductId
} from '../page/cards.js';
import { extractCanonicalPrice, parsePrice, priceToCents } from '../domain/price.js';
import { getDealState, computeDealScore } from '../domain/deal-score.js';
import {
  fetchSingleProductPriceStats,
  currentlyScanningPid,
  cancelBestpreiseScan
} from '../scanner/scanner.js';
import { getCachedPriceStats } from '../scanner/cache.js';
import { showToast } from './toast.js';
import { renderSparkline } from './sparkline.js';
import { isShippingPriceActive } from '../page/adapter.js';

export let isBlockedCatsOpen = false;
export function setBlockedCatsOpen(open) {
  isBlockedCatsOpen = open;
}

function triggerProcessListings() {
  if (typeof processListings === 'function') {
    processListings();
  } else if (typeof window !== 'undefined' && window.ToppreiseSuite?.processListings) {
    window.ToppreiseSuite.processListings();
  }
}

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

export function renderCardEffects(cd, filters, isNeueFeed, activeStores) {
  const { card, pid, cardPriceEl, cardPrice, stats, isVerifiedNonBest, discountVal, catName, rootGroup } = cd;

  // 0. Heatmap (driven by Deal-Score when verified or in Bestpreise mode; in unverified feed mode, driven by feed discount)
  const effectiveHeatPercent = isVerifiedNonBest
    ? null
    : (cd.dealScore ? cd.dealScore.score : (CONFIG.BESTPREISE_MODE_ACTIVE ? null : discountVal));

  if (CONFIG.HEATMAP_ENABLED && effectiveHeatPercent !== null && effectiveHeatPercent > 0) {
    const heatKey = `${effectiveHeatPercent}_${CONFIG.HEATMAP_INTENSITY}_${CONFIG.HEATMAP_CURVE}`;
    if (card.dataset.tpAppliedHeat !== heatKey) {
      card.dataset.tpAppliedHeat = heatKey;
      const heatStyles = getHeatmapStyles(effectiveHeatPercent, CONFIG.HEATMAP_INTENSITY, CONFIG.HEATMAP_CURVE);
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

      const subElements = card.querySelectorAll(
        '.row, .col, [class*="col-"], .priceAvailabilityContainer, .price-availability, ' +
        '.offersContainer, .offers, .priceContainer, .Plugin_Price, .productPrice, .shippingPrice, .shippingText, ' +
        '.manufacturer-image, .product-name, .productDetails, .price_information_product, .Plugin_PriceInformation, ' +
        '.f_product_info, .productDescription, .productDetailsDescription, .product-details, .f_product_container, ' +
        '.product-image, .productImage, .image_container, .image, [data-darkreader-inline-bgcolor], [data-darkreader-inline-bgimage]'
      );
      for (let s = 0; s < subElements.length; s++) {
        const sub = subElements[s];
        if (sub.classList.contains('badge') || sub.classList.contains('tp-deal-pill') ||
            sub.classList.contains('tp-best-price-badge') || sub.classList.contains('tp-card-quick-block') ||
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
  }

  // 1. Category extraction & Quick-block
  if (isNeueFeed) {
    if (catName && !card.querySelector('.tp-card-quick-block')) {
      const quickBlockBtn = document.createElement('button');
      quickBlockBtn.type = 'button';
      quickBlockBtn.className = 'tp-card-quick-block';
      quickBlockBtn.title = `Kategorie "${catName}" (${rootGroup}) ausblenden`;
      quickBlockBtn.textContent = '🚫 ';
      const catSpan = document.createElement('span');
      catSpan.textContent = catName;
      quickBlockBtn.appendChild(catSpan);
      quickBlockBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const curr = CONFIG.EXCLUDED_CATEGORIES || [];
        const key = `PATH:${rootGroup}/${catName}`;
        if (!curr.includes(key) && !curr.includes(catName)) {
          isBlockedCatsOpen = true;
          updateConfig('EXCLUDED_CATEGORIES', [...curr, key]);
          showToast(`Kategorie "${catName}" ausgeblendet`, 4000, 'Rückgängig', () => {
            updateConfig('EXCLUDED_CATEGORIES', (CONFIG.EXCLUDED_CATEGORIES || []).filter(c => c !== key && c !== catName));
            showToast(`Kategorie "${catName}" wieder eingeblendet`);
          });
        }
      };
      card.appendChild(quickBlockBtn);
    }
  } else {
    card.querySelector('.tp-card-quick-block')?.remove();
  }

  // 2. Filters
  card.classList.toggle('tp-negative-filtered', filters.isNeg);
  card.classList.toggle('tp-category-filtered', filters.isCatExcluded);
  card.classList.toggle('tp-min-offers-filtered', filters.isLowOffers);

  // 3. Best Price Highlighting
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
          badge.textContent = 'Best Price';
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

  // 3.5 Real Deal & Allzeit-Tiefstpreis Check (Consolidated into Differenz Circle Badge)
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
        // Qualified Bestpreis Deal!
        card.classList.remove('tp-bestpreise-hidden', 'tp-non-bestpreis-filtered');
        badgeDifEl.classList.add('tp-deal-badge-interactive');
        badgeDifEl.classList.remove('tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

        if (dealData.isNewRecord) {
          badgeDifEl.classList.add('tp-deal-new-record');
          badgeDifEl.classList.remove('tp-deal-alltime-low');
        } else {
          badgeDifEl.classList.add('tp-deal-alltime-low');
          badgeDifEl.classList.remove('tp-deal-new-record');
        }

        if (isListView) {
          setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Real Deal -${dealData.score}%</p>`);
        } else {
          setHtmlIfChanged(badgeDifEl, `<div class="text">Real Deal</div><p>-${dealData.score}%</p>`);
        }

        const prevLow = stats?.previousLow;
        const medianVal = stats?.medianPrice;
        const horizonLabel = stats?.horizonDays && stats.horizonDays > 0 ? `${stats.horizonDays >= 365 ? '1J' : stats.horizonDays + 'T'}` : 'Lifetime';
        const outlierText = stats?.filteredOutliers && stats.filteredOutliers.length > 0 ? ` | ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert` : '';

        if (dealData.isNewRecord) {
          setTitleIfChanged(badgeDifEl, `🔥 Neuer Rekord! Score: -${dealData.score}% (Ø ${horizonLabel}: -${dealData.dMedian}%, Rekord: -${dealData.dRecord}% vs CHF ${prevLow ? prevLow.toFixed(2) : '?'})${outlierText} [Klicken zum Aktualisieren]`);
        } else {
          setTitleIfChanged(badgeDifEl, `🌟 Allzeit-Tiefstpreis! Score: -${dealData.score}% (Ø ${horizonLabel}: -${dealData.dMedian}%, kein neuer Rekord)${outlierText} [Klicken zum Aktualisieren]`);
        }

        // Compact dual-score breakdown pill directly underneath the circle badge
        let breakdownEl = card.querySelector('.tp-badge-score-breakdown');
        if (isListView) {
          breakdownEl?.remove();
        } else {
          if (!breakdownEl) {
            breakdownEl = document.createElement('div');
            breakdownEl.className = 'tp-badge-score-breakdown';
            card.appendChild(breakdownEl);
          }
          if (dealData.isNewRecord && dealData.dRecord > 0) {
            setHtmlIfChanged(breakdownEl, `<span class="tp-score-record" title="Neuer Rekord-Rabatt (-${dealData.dRecord}%)">Rek: -${dealData.dRecord}%</span> · <span class="tp-score-median" title="${horizonLabel}-Median-Rabatt (-${dealData.dMedian}%)">Ø: -${dealData.dMedian}%</span>`);
          } else {
            setHtmlIfChanged(breakdownEl, `<span class="tp-score-median" title="${horizonLabel}-Median-Rabatt (-${dealData.dMedian}%)">Ø: -${dealData.dMedian}%</span>`);
          }
        }

        let histPriceEl = card.querySelector('.tp-card-historical-price');
        if (!histPriceEl) {
          histPriceEl = document.createElement('div');
          const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                                 cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                                 cardPriceEl?.parentElement ||
                                 card;
          priceContainer.appendChild(histPriceEl);
        }

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

        if (currentlyScanningPid && currentlyScanningPid === pid) {
          badgeDifEl.classList.add('tp-deal-loading');
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⏳</span><p>Prüfe...</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Prüfe...</div><p>⏳</p>`);
          }
        } else {
          badgeDifEl.classList.remove('tp-deal-loading');
          if (rawDiscount !== null && !isNaN(rawDiscount)) {
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>-${rawDiscount}%</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>-${rawDiscount}%</p><span class="tp-badge-loupe-icon">🔍</span>`);
            }
          } else {
            setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen`);
            if (isListView) {
              setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>Deal</p>`);
            } else {
              setHtmlIfChanged(badgeDifEl, `<div class="text">Deal</div><p style="font-size: 15px; margin: 0; line-height: 1.1;">🔍</p>`);
            }
          }
        }
        card.querySelector('.tp-card-historical-price')?.remove();
      }
    } else {
      card.classList.remove('tp-bestpreise-hidden');
      badgeDifEl.classList.remove('tp-deal-new-record');
      card.querySelector('.tp-badge-score-breakdown')?.remove();

      if (currentlyScanningPid && currentlyScanningPid === pid) {
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
          badgeDifEl.classList.add('tp-deal-alltime-low', 'tp-deal-badge-interactive');
          badgeDifEl.classList.remove('tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

          let peakContext = '';
          if (hasSignificantPeak) {
            const peakDropPct = Math.round(((stats.hoechstpreis - cardPrice) / stats.hoechstpreis) * 100);
            peakContext = ` (-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)})`;
          }

          let prevLowContext = '';
          if (isNewRecord && prevLow) {
            prevLowContext = ` | Bisheriger Rekord: CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)`;
          }
          const avgContext = stats.avgPrice && stats.avgPrice > cardPrice ? ` | Ø-Preis: CHF ${stats.avgPrice.toFixed(2)}` : '';

          setTitleIfChanged(badgeDifEl, `🌟 ${isNewRecord ? 'Neuer Allzeit-Tiefstpreis' : 'Allzeit-Tiefstpreis'} (CHF ${cardPrice.toFixed(2)})!${prevLowContext}${avgContext}${peakContext} (Klicken zum Aktualisieren)`);
          if (isNeueFeed && rawDiscount !== null && !isNaN(rawDiscount)) {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>-${rawDiscount}%</p>`);
          } else {
            const dealPct = cd.dealScore?.score || (stats.realDiscountVsMedian || stats.realDiscountVsAvg || 0);
            if (isListView) {
              if (dealPct > 0) {
                setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Real Deal -${dealPct}%</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<span>🌟</span><p>Tiefstpreis</p>`);
              }
            } else {
              if (dealPct > 0) {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Real Deal</div><p>-${dealPct}%</p>`);
              } else {
                setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>🌟</p>`);
              }
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

          const peakContext = hasSignificantPeak ? ` | Höchstpreis: CHF ${stats.hoechstpreis.toFixed(2)}` : '';
          const fakeDiscContext = (rawDiscount !== null && !isNaN(rawDiscount)) ? ` | Schein-Rabatt: -${rawDiscount}%` : '';
          setTitleIfChanged(badgeDifEl, `⚠️ Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)${fakeDiscContext}${peakContext} (Klicken zum Aktualisieren)`);
          const fakeDiscHtml = (rawDiscount !== null && !isNaN(rawDiscount)) ? `<span class="tp-fake-discount"><s>-${rawDiscount}%</s></span>` : '';
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>⚠️</span><p class="tp-markup-val">+${markupPct}%</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Aufschlag</div><p class="tp-markup-val">+${markupPct}%</p>${fakeDiscHtml}`);
          }
        }

        // 4A: Historical Tiefstpreis line right below current price
        let histPriceEl = card.querySelector('.tp-card-historical-price');
        if (isNonBest) {
          if (!histPriceEl) {
            histPriceEl = document.createElement('div');
            const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                                   cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                                   cardPriceEl?.parentElement ||
                                   card;
            priceContainer.appendChild(histPriceEl);
          }
          histPriceEl.className = 'tp-card-historical-price tp-is-markup';
          setTextIfChanged(histPriceEl, `Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)}`);
          setTitleIfChanged(histPriceEl, `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${Math.round(((cardPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100)}% Aufschlag)`);
        } else if (isNewRecord && prevLow) {
          if (!histPriceEl) {
            histPriceEl = document.createElement('div');
            const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                                   cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                                   cardPriceEl?.parentElement ||
                                   card;
            priceContainer.appendChild(histPriceEl);
          }
          histPriceEl.className = 'tp-card-historical-price tp-is-record-low';
          setTextIfChanged(histPriceEl, `Bisher: CHF ${prevLow.toFixed(2)} (-${realDropVsPrev}%)`);
          setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief lag bei CHF ${prevLow.toFixed(2)}`);
        } else if (!isNeueFeed && stats.medianPrice && stats.medianPrice > cardPrice) {
          if (!histPriceEl) {
            histPriceEl = document.createElement('div');
            const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                                   cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                                   cardPriceEl?.parentElement ||
                                   card;
            priceContainer.appendChild(histPriceEl);
          }
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
          setTitleIfChanged(badgeDifEl, `🔍 Klicken: Echten Allzeit-Tiefstpreis prüfen (-${rawDiscount}% Schein-Rabatt vs Realität)`);
          setHtmlIfChanged(badgeDifEl, `<div class="text">Differenz</div><p>-${rawDiscount}%</p><span class="tp-badge-loupe-icon">🔍</span>`);
        } else {
          setTitleIfChanged(badgeDifEl, `🔍 Klicken: Preishistorie & Allzeit-Tiefstpreis prüfen`);
          if (isListView) {
            setHtmlIfChanged(badgeDifEl, `<span>🔍</span><p>Deal</p>`);
          } else {
            setHtmlIfChanged(badgeDifEl, `<div class="text">Deal</div><p style="font-size: 15px; margin: 0; line-height: 1.1;">🔍</p>`);
          }
        }
      }
    }
  } else {
    card.classList.remove('tp-non-bestpreis-filtered', 'tp-bestpreise-hidden');
    card.querySelector('.tp-card-historical-price')?.remove();
  }

  // 3.6 Mini Price-Trend Sparkline (Beta Feature)
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

  const totalHidden = (counts.neg || 0) + (counts.cat || 0) + (counts.min || 0) + (counts.nonBest || 0) + (counts.bestpreiseHidden || 0);
  const isRevealed = document.body.classList.contains('tp-reveal-filtered');

  if (cards.length > 0 && totalHidden >= cards.length && !isRevealed) {
    if (!emptyNotice) {
      emptyNotice = document.createElement('div');
      emptyNotice.id = 'tp-empty-state-notice';
      emptyNotice.className = 'tp-empty-state-notice';
      const listParent = cards[0]?.parentElement;
      if (listParent) {
        listParent.insertBefore(emptyNotice, listParent.firstChild);
      }
    }
    const isBestpreiseEmpty = CONFIG.BESTPREISE_MODE_ACTIVE && (counts.bestpreiseHidden || 0) > 0;
    const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
    emptyNotice.innerHTML = `
      <div>🚫 <strong>${isBestpreiseEmpty ? 'Keine verifizierten Bestpreise auf dieser Seite gefunden.' : `Alle ${cards.length} Angebote auf dieser Seite sind durch aktive Filter ausgeblendet.`}</strong></div>
      <div class="tp-empty-state-actions">
        ${isBestpreiseEmpty && counts.uncheckedDeals > 0 ? `<button class="tp-empty-state-btn" id="tp-empty-check-deals-btn" style="border-color: #3b82f6; color: #60a5fa;">🔍 Deals prüfen (≥${minDisc}%)</button>` : ''}
        <button class="tp-empty-state-btn" id="tp-empty-reveal-btn">👁️ Ausgeblendete anzeigen</button>
        ${isBestpreiseEmpty ? '<button class="tp-empty-state-btn" id="tp-empty-disable-bestpreise-btn">💎 Bestpreise-Modus ausschalten</button>' : ''}
        <button class="tp-empty-state-btn" id="tp-empty-toggle-filters-btn">⚡ Filter ausschalten</button>
      </div>
    `;
    emptyNotice.querySelector('#tp-empty-check-deals-btn')?.addEventListener('click', () => {
      const batchBtn = document.getElementById('tp-bar-batch-check-btn');
      if (batchBtn) batchBtn.click();
    });
    emptyNotice.querySelector('#tp-empty-reveal-btn')?.addEventListener('click', () => {
      document.body.classList.toggle('tp-reveal-filtered');
      triggerProcessListings();
    });
    emptyNotice.querySelector('#tp-empty-disable-bestpreise-btn')?.addEventListener('click', () => {
      cancelBestpreiseScan();
      updateConfig('BESTPREISE_MODE_ACTIVE', false);
      showToast('Bestpreise-Modus deaktiviert');
    });
    emptyNotice.querySelector('#tp-empty-toggle-filters-btn')?.addEventListener('click', () => {
      updateConfigs({
        FILTER_NEG_ENABLED: false,
        FILTER_CAT_ENABLED: false,
        FILTER_MIN_ENABLED: false,
        FILTER_BESTPREIS_ENABLED: false
      });
      showToast('⏸️ Alle Filter pausiert (alle Angebote sichtbar)');
    });
  } else if (emptyNotice) {
    emptyNotice.remove();
  }
}

