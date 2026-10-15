/**
 * Deal verdict (split from ui/badges.js): mode + browse badge verdicts.
 * renderBadgeVerdict runs badge setup (deal-badge.js) then one branch —
 * the blend stays single-sourced from ctx.heatInfo (ADR-0005).
 */

import { CONFIG } from '../../state/config.js';
import { parsePrice, pctDrop, pctRise, priceToCents, recordRefForPrice } from '../../domain/price.js';
import { getDisplayDelta, isSignificantRecord, medianHorizonLabel, vortiefDropPct } from '../../domain/deal-score.js';
import { hasUsablePriceStats } from '../../scanner/cache.js';
import { scanState } from '../../state/store.js';
import { setHtmlIfChanged, setTextIfChanged, setTitleIfChanged, ensureHistPriceEl } from './dom-helpers.js';
import { renderBadgeSetup } from './deal-badge.js';

// Tiefstpreis-mode verdict: ribbon prints the Gewichtete Differenz (blend).
export function renderModeVerdict(ctx, filters, badgeDifEl, isListView, sitePctText, rawDiscount) {
  const { card, pid, cardPrice, cardPriceEl, stats, dealData, displayDelta, heatInfo } = ctx;
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
      } else if (hasUsablePriceStats(stats)) {
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
}

// Browse verdict: verified low/markup ribbons + historical line, else loupe.
export function renderBrowseVerdict(ctx, filters, isNeueFeed, badgeDifEl, isListView, sitePctText, rawDiscount) {
  const { card, pid, cardPrice, cardPriceEl, stats, dealData, displayDelta, heatInfo } = ctx;
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

// Step-4 orchestrator: setup first, then the mode/browse branch — the
// no-badge cleanup mirrors the original else path.
export function renderBadgeVerdict(ctx, filters, isNeueFeed) {
  const { card } = ctx;
  const setup = renderBadgeSetup(ctx, isNeueFeed);
  if (!setup) {
    card.classList.remove('tp-unchecked-hidden');
    card.querySelector('.tp-card-historical-price')?.remove();
    return;
  }
  const { badgeDifEl, isListView, sitePctText, rawDiscount } = setup;
  if (CONFIG.BESTPREISE_MODE_ACTIVE) renderModeVerdict(ctx, filters, badgeDifEl, isListView, sitePctText, rawDiscount);
  else renderBrowseVerdict(ctx, filters, isNeueFeed, badgeDifEl, isListView, sitePctText, rawDiscount);
}
