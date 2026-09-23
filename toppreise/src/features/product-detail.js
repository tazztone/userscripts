/**
 * Product Detail Page Feature
 * Injects Real Deal & Allzeit-Tiefstpreis status badge and peak context
 * into the main product detail heading.
 */

import { getDetailProductId, getDetailLowestPrice } from '../page/adapter.js';
import { getCachedPriceStats } from '../scanner/cache.js';
import { getDealState } from '../domain/deal-score.js';
import { activeFetches, fetchSingleProductPriceStats } from '../scanner/scanner.js';

let isProcessingDetail = false;

export async function processProductDetailPage() {
  if (isProcessingDetail) return;
  const pid = getDetailProductId();
  if (!pid) return;

  const headingEl = document.querySelector('.Plugin_ProductHeading h1, .productHeading h1, .product_title h1, h1.productTitle, h1');
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

    const state = getDealState(currentPrice, stats.tiefstpreis);
    const isAllTimeLow = (state === 'new-low' || state === 'at-low');
    const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;

    if (isAllTimeLow) {
      badge.className = 'tp-detail-deal-badge tp-is-alltime-low';
      let peakContext = '';
      if (hasSignificantPeak) {
        const peakDropPct = Math.round(((stats.hoechstpreis - currentPrice) / stats.hoechstpreis) * 100);
        peakContext = ` (-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)})`;
      }
      badge.title = `Aktueller Bestpreis (CHF ${currentPrice.toFixed(2)}) ist der historische Allzeit-Tiefstpreis!${peakContext}`;
      badge.textContent = '🌟 Allzeit-Tiefstpreis';
    } else {
      const markupPct = Math.round(((currentPrice - stats.tiefstpreis) / stats.tiefstpreis) * 100);
      const isSevere = markupPct >= 50;
      badge.className = `tp-detail-deal-badge tp-is-not-low ${isSevere ? 'tp-is-severe-markup' : ''}`;
      const peakContext = hasSignificantPeak ? ` | Höchstpreis: CHF ${stats.hoechstpreis.toFixed(2)}` : '';
      badge.title = `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)${peakContext}`;
      badge.textContent = `⚠️ Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}%)`;
    }
  } else if (!activeFetches.has(pid)) {
    isProcessingDetail = true;
    try {
      await fetchSingleProductPriceStats(pid);
    } finally {
      isProcessingDetail = false;
    }
    const fetchedStats = getCachedPriceStats(pid);
    if (fetchedStats && !fetchedStats.unavailable && fetchedStats.tiefstpreis > 0) {
      processProductDetailPage();
    }
  }
}

