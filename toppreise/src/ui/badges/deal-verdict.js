/**
 * Deal verdict (split from ui/badges.js): mode + browse badge verdicts.
 * renderBadgeVerdict runs badge setup (deal-badge.js) then unified verdict —
 * the blend stays single-sourced from ctx.heatInfo (ADR-0005).
 */

import { CONFIG } from '../../state/config.js';
import { pctDrop, pctRise, priceToCents, recordRefForPrice } from '../../domain/price.js';
import { getDisplayDelta, isSignificantRecord, medianHorizonLabel, vortiefDropPct } from '../../domain/deal-score.js';
import { hasUsablePriceStats } from '../../scanner/cache.js';
import { isScanningPid } from '../../state/store.js';
import { setHtmlIfChanged, setTextIfChanged, setTitleIfChanged, ensureHistPriceEl } from './dom-helpers.js';
import { renderBadgeSetup } from './deal-badge.js';

// Unified Deal Verdict Renderer (Mode & Browse)
export function renderDealVerdict(ctx, filters, isNeueFeed, badgeDifEl, isListView, sitePctText, rawDiscount, isMode) {
  const { card, pid, cardPrice, cardPriceEl, stats, dealData, heatInfo } = ctx;
  card.classList.remove('tp-unchecked-hidden');
  badgeDifEl.classList.remove('tp-deal-new-record');

  if (isScanningPid(pid)) {
    badgeDifEl.classList.add('tp-deal-loading');
    if (isListView) {
      setHtmlIfChanged(badgeDifEl, '<span>⏳</span><p>Prüfe...</p>');
    } else {
      setHtmlIfChanged(badgeDifEl, '<div class="text">Prüfe...</div><p>⏳</p>');
    }
    return;
  }
  badgeDifEl.classList.remove('tp-deal-loading');

  const displayDelta = ctx.displayDelta || getDisplayDelta(cardPrice, stats);
  const displayKind = displayDelta.kind;

  if (displayKind !== 'unknown' && hasUsablePriceStats(stats)) {
    const isAllTimeLow = (displayKind === 'new-low' || displayKind === 'at-low');
    const isNonBest = (displayKind === 'above-low');
    const liveRec = recordRefForPrice(stats, cardPrice);
    const isNewRecord = (displayKind === 'new-low') || (isAllTimeLow && liveRec.isNewRecord);
    const prevLow = liveRec.previousLow;
    const realDropVsPrev = vortiefDropPct(cardPrice, stats);
    const markupPct = displayDelta.markup ?? (isNonBest && stats.tiefstpreis > 0 ? pctRise(stats.tiefstpreis, cardPrice) : 0);

    if (isAllTimeLow) {
      badgeDifEl.classList.add('tp-deal-alltime-low', 'tp-deal-badge-interactive');
      badgeDifEl.classList.remove('tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

      const showRecord = isMode && dealData?.isNewRecord && isSignificantRecord(displayDelta);
      if (showRecord) {
        badgeDifEl.classList.add('tp-deal-new-record');
        badgeDifEl.classList.remove('tp-deal-alltime-low');
      }

      const badgePct = dealData ? heatInfo?.pct : 0;
      const outlierTip = stats?.filteredOutliers?.length > 0 ? `ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert\n` : '';
      const hasBlend = dealData && (badgePct > 0 || dealData.weightedDiff === 0);

      if (hasBlend) {
        const pctText = dealData.weightedDiff === 0 ? '0%' : `-${badgePct}%`;
        setTitleIfChanged(badgeDifEl, `${outlierTip}[Klicken: erneut prüfen]`);
        if (isListView) {
          setHtmlIfChanged(badgeDifEl, `<span>⚖️</span><p>${pctText}</p>`);
        } else {
          setHtmlIfChanged(badgeDifEl, `<div class="text">⚖️</div><p>${pctText}</p>`);
        }
      } else if (realDropVsPrev > 0) {
        const prevTip = prevLow && priceToCents(prevLow) > priceToCents(cardPrice)
          ? ` vs. vorheriges Tief (CHF ${prevLow.toFixed(2)})` : '';
        setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · -${realDropVsPrev}%${prevTip} · Fallback-Tief ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
        if (isListView) {
          setHtmlIfChanged(badgeDifEl, `<span>-${realDropVsPrev}%</span><p>Tiefstpreis</p>`);
        } else {
          setHtmlIfChanged(badgeDifEl, `<div class="text">Tiefstpreis</div><p>-${realDropVsPrev}%</p>`);
        }
      } else if (sitePctText) {
        setTitleIfChanged(badgeDifEl, `Tiefstpreis bestätigt · Differenz ${sitePctText} (ungeprüft) · Fallback-Tief ohne Ø-Vergleich\n[Klicken: erneut prüfen]`);
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
      // Verified Non-Tiefstpreis (Markup)
      const isSevere = markupPct >= 50;
      badgeDifEl.classList.add('tp-deal-not-low', 'tp-deal-badge-interactive');
      badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-loading');
      badgeDifEl.classList.toggle('tp-is-severe-markup', isSevere);

      setTitleIfChanged(badgeDifEl, `⚠️ Kein Tiefstpreis (+${markupPct}% Aufschlag)\n[Klicken zum Aktualisieren]`);
      const fakeDiscHtml = sitePctText ? `<span class="tp-fake-discount"><s>${sitePctText}</s></span>` : '';
      if (isListView) {
        setHtmlIfChanged(badgeDifEl, `<span>⚠️</span><p class="tp-markup-val">+${markupPct}%</p>`);
      } else {
        setHtmlIfChanged(badgeDifEl, `<div class="text">Aufschlag</div><p class="tp-markup-val">+${markupPct}%</p>${fakeDiscHtml}`);
      }
    }

    // Historical price line below current price
    const showPrevLow = !!(prevLow && priceToCents(prevLow) > priceToCents(cardPrice));
    const showMedianLine = !!(stats.medianPrice && stats.medianPrice > cardPrice);
    const horizonLabel = medianHorizonLabel(stats);
    const outlierText = stats?.filteredOutliers?.length > 0 ? ` | ℹ️ ${stats.filteredOutliers.length} Ausreisser ignoriert` : '';
    let histPriceEl = card.querySelector('.tp-card-historical-price');

    if (isNonBest) {
      if (!isMode && stats.tiefstpreis > 0) {
        histPriceEl = ensureHistPriceEl(card, cardPriceEl);
        histPriceEl.className = 'tp-card-historical-price tp-is-markup';
        setTextIfChanged(histPriceEl, `Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)}`);
        setTitleIfChanged(histPriceEl, `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)`);
      } else if (histPriceEl) {
        histPriceEl.remove();
      }
    } else if (showPrevLow || showMedianLine || dealData?.isZeroMargin) {
      histPriceEl = ensureHistPriceEl(card, cardPriceEl);
      const parts = [];
      const dMed = dealData ? dealData.dMedian : (showMedianLine ? pctDrop(stats.medianPrice, cardPrice) : 0);
      const dRec = dealData ? dealData.dRecord : (showPrevLow ? pctDrop(prevLow, cardPrice) : 0);
      const hasRecPart = isNewRecord && dRec > 0;
      if (showPrevLow) parts.push(`📉 CHF ${prevLow.toFixed(2)}${hasRecPart ? ` (-${dRec}%)` : ''}`);
      if (showMedianLine) parts.push(`Ø${horizonLabel} CHF ${stats.medianPrice.toFixed(2)} (-${dMed}%)`);
      else if (dealData?.isZeroMargin && stats?.medianPrice) parts.push(`Ø${horizonLabel} CHF ${stats.medianPrice.toFixed(2)} (0%)`);

      if (isNewRecord && showPrevLow) {
        histPriceEl.className = 'tp-card-historical-price tp-is-record-low';
        setTextIfChanged(histPriceEl, parts.join(' · '));
        setTitleIfChanged(histPriceEl, `Neuer Rekord-Tiefstpreis! Vorheriges Tief: CHF ${prevLow.toFixed(2)}${hasRecPart ? ` (-${dRec}%)` : ''}${showMedianLine ? ` · ${dMed}% unter dem ${horizonLabel}-Median (CHF ${stats.medianPrice.toFixed(2)})` : ''}${outlierText}`);
      } else {
        histPriceEl.className = 'tp-card-historical-price tp-is-at-low' + (showPrevLow ? ' tp-with-prev' : '');
        setTextIfChanged(histPriceEl, parts.join(' · '));
        const sublineTip = dealData?.isZeroMargin
          ? `Allzeit-Tiefstpreis! Entspricht dem ${horizonLabel}-Median von CHF ${stats.medianPrice.toFixed(2)} (0% Differenz).${outlierText}`
          : `Allzeit-Tiefstpreis!${showPrevLow ? ` Vorheriges Tief: CHF ${prevLow.toFixed(2)}.` : ''}${showMedianLine ? ` Liegt ${dMed}% unter dem ${horizonLabel}-Median von CHF ${stats.medianPrice.toFixed(2)}.` : ''}${outlierText}`;
        setTitleIfChanged(histPriceEl, sublineTip);
      }
    } else if (histPriceEl) {
      histPriceEl.remove();
    }
  } else {
    // Unchecked State
    if (filters.isUnchecked === true) card.classList.add('tp-unchecked-hidden');
    badgeDifEl.classList.add('tp-deal-badge-interactive');
    badgeDifEl.classList.remove('tp-deal-alltime-low', 'tp-deal-new-record', 'tp-deal-not-low', 'tp-is-severe-markup', 'tp-deal-loading');

    if (rawDiscount !== null && !isNaN(rawDiscount)) {
      setTitleIfChanged(badgeDifEl, `🔍 Ungeprüft: ${sitePctText} ist die Differenz, kein Tiefstpreis.\n[Klicken: echten Tiefstpreis prüfen]`);
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
    card.querySelector('.tp-card-historical-price')?.remove();
  }
}

// Tiefstpreis-mode verdict wrapper
export function renderModeVerdict(ctx, filters, badgeDifEl, isListView, sitePctText, rawDiscount) {
  renderDealVerdict(ctx, filters, false, badgeDifEl, isListView, sitePctText, rawDiscount, true);
}

// Browse verdict wrapper
export function renderBrowseVerdict(ctx, filters, isNeueFeed, badgeDifEl, isListView, sitePctText, rawDiscount) {
  renderDealVerdict(ctx, filters, isNeueFeed, badgeDifEl, isListView, sitePctText, rawDiscount, false);
}

// Step-4 orchestrator: setup first, then unified deal verdict
export function renderBadgeVerdict(ctx, filters, isNeueFeed) {
  const { card, pid } = ctx;
  const setup = renderBadgeSetup(ctx, isNeueFeed);
  if (!setup) {
    card.classList.remove('tp-unchecked-hidden');
    card.querySelector('.tp-card-historical-price')?.remove();
    return;
  }
  const { badgeDifEl, isListView, sitePctText, rawDiscount } = setup;
  renderDealVerdict(ctx, filters, isNeueFeed, badgeDifEl, isListView, sitePctText, rawDiscount, !!CONFIG.BESTPREISE_MODE_ACTIVE);

  if (badgeDifEl.isConnected) {
    badgeDifEl.dataset.tpPainted = 'true';
    badgeDifEl.dataset.tpOriginalPid = pid ?? '';
    badgeDifEl.dataset.tpPaintedText = badgeDifEl.textContent ?? '';
  }
}
