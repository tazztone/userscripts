/**
 * Product Detail Page Feature
 * Injects Tiefstpreis status badge and peak context
 * into the main product detail heading.
 */

import { getDetailProductId, getDetailLowestPrice } from '../page/adapter.js';
import { getCachedPriceStats } from '../scanner/cache.js';
import { getDisplayDelta } from '../domain/deal-score.js';
import { activeFetches, fetchSingleProductPriceStats } from '../scanner/scanner.js';
import { pctDrop, pctRise } from '../domain/price.js';


export async function processProductDetailPage() {
  const pid = getDetailProductId();
  if (!pid) return;

  // Ordered single queries (see getDetailLowestPrice): grouped selectors match
  // in document order, so the bare h1 fallback must never outrank its scopes.
  const headingSelectors = ['.Plugin_ProductHeading h1', '.productHeading h1', '.product_title h1', 'h1.productTitle', 'h1'];
  let headingEl = null;
  for (const sel of headingSelectors) {
    headingEl = document.querySelector(sel);
    if (headingEl) break;
  }
  if (!headingEl) return;

  const currentPrice = getDetailLowestPrice();
  if (currentPrice <= 0) return;

  let badge = document.getElementById('tp-detail-deal-badge');
  const stats = getCachedPriceStats(pid);

  if (stats && stats.tiefstpreis > 0) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'tp-detail-deal-badge';
      headingEl.appendChild(badge);
    }

    const displayKind = getDisplayDelta(currentPrice, stats).kind;
    const isAllTimeLow = (displayKind === 'new-low' || displayKind === 'at-low');
    const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;

    if (isAllTimeLow) {
      badge.className = 'tp-detail-deal-badge tp-is-alltime-low';
      let peakContext = '';
      if (hasSignificantPeak) {
        const peakDropPct = pctDrop(stats.hoechstpreis, currentPrice);
        peakContext = ` (-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)})`;
      }
      badge.title = `Aktueller Bestpreis (CHF ${currentPrice.toFixed(2)}) ist der historische Allzeit-Tiefstpreis!${peakContext}`;
      badge.textContent = '🌟 Allzeit-Tiefstpreis';
    } else {
      const markupPct = pctRise(stats.tiefstpreis, currentPrice);
      const isSevere = markupPct >= 50;
      badge.className = `tp-detail-deal-badge tp-is-not-low ${isSevere ? 'tp-is-severe-markup' : ''}`;
      const peakContext = hasSignificantPeak ? ` | Höchstpreis: CHF ${stats.hoechstpreis.toFixed(2)}` : '';
      badge.title = `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)${peakContext}`;
      badge.textContent = `⚠️ Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}%)`;
    }
  } else if (!activeFetches.has(pid)) {
    await fetchSingleProductPriceStats(pid);
    const fetchedStats = getCachedPriceStats(pid);
    if (fetchedStats && !fetchedStats.unavailable && fetchedStats.tiefstpreis > 0) {
      processProductDetailPage();
    }
  }
}

