/**
 * Product Detail Page Feature
 * Injects Tiefstpreis status badge and peak context
 * into the main product detail heading.
 */

import { getDetailProductId, getDetailLowestPrice } from '../page/adapter.js';
import { getCachedPriceStats } from '../scanner/cache.js';
import { getDisplayDelta } from '../domain/deal-score.js';
import { fetchSingleProductPriceStats } from '../scanner/scanner.js';
import { pctDrop, pctRise } from '../domain/price.js';

// Stale-request guard: overlapping observer triggers race the fetch — only
// the latest run may paint. A generation token (not pid comparison alone)
// also covers same-product reprices and basis toggles mid-flight.
let detailRun = 0;
const removeDetailBadge = () => document.getElementById('tp-detail-deal-badge')?.remove();
export async function processProductDetailPage() {
  const run = ++detailRun;
  const pid = getDetailProductId();
  if (!pid) { removeDetailBadge(); return; }

  // Ordered single queries (see getDetailLowestPrice): grouped selectors match
  // in document order, so the bare h1 fallback must never outrank its scopes.
  const headingSelectors = ['.Plugin_ProductHeading h1', '.productHeading h1', '.product_title h1', 'h1.productTitle', 'h1'];
  let headingEl = null;
  for (const sel of headingSelectors) {
    headingEl = document.querySelector(sel);
    if (headingEl) break;
  }
  if (!headingEl) { removeDetailBadge(); return; }

  const { price: currentPrice, basis: priceBasis } = getDetailLowestPrice();
  if (!(currentPrice > 0)) { removeDetailBadge(); return; }

  let badge = document.getElementById('tp-detail-deal-badge');
  let stats = getCachedPriceStats(pid);
  if (!stats || !stats.tiefstpreis) {
    await fetchSingleProductPriceStats(pid, 1, false, null, currentPrice);
    // Stale: a newer run started, the route changed, or the heading died.
    if (run !== detailRun || pid !== getDetailProductId() || !headingEl.isConnected) {
      if (pid !== getDetailProductId()) removeDetailBadge();
      return;
    }
    // Reprice/basis-toggle mid-flight: never paint a verdict for dead inputs.
    const fresh = getDetailLowestPrice();
    if (fresh.price !== currentPrice || fresh.basis !== priceBasis) return;
    stats = getCachedPriceStats(pid);
  }
  if (stats && stats.tiefstpreis > 0) {
    // Basis gate (same rule as extractCardData): a live price on the other
    // basis than the cached history renders no badge. A refetch cannot fix
    // a missing DOM basis, so drop the badge instead of re-requesting.
    if (typeof stats.isShippingPrice === 'boolean' && stats.isShippingPrice !== (priceBasis === 'shipping')) {
      document.getElementById('tp-detail-deal-badge')?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'tp-detail-deal-badge';
      headingEl.appendChild(badge);
    }
    const displayKind = getDisplayDelta(currentPrice, stats).kind;
    const isAllTimeLow = (displayKind === 'new-low' || displayKind === 'at-low');
    const hasSignificantPeak = stats.hoechstpreis && stats.hoechstpreis > stats.tiefstpreis * 1.02;
    if (isAllTimeLow) {
      const nextClass = 'tp-detail-deal-badge tp-is-alltime-low';
      if (badge.className !== nextClass) badge.className = nextClass;
      let peakContext = '';
      if (hasSignificantPeak) {
        const peakDropPct = pctDrop(stats.hoechstpreis, currentPrice);
        peakContext = ` (-${peakDropPct}% vom Höchstpreis CHF ${stats.hoechstpreis.toFixed(2)})`;
      }
      const nextTitle = `Aktueller Preis (CHF ${currentPrice.toFixed(2)}) ist der Allzeit-Tiefstpreis!${peakContext}`;
      if (badge.title !== nextTitle) badge.title = nextTitle;
      if (badge.textContent !== '🌟 Allzeit-Tiefstpreis') badge.textContent = '🌟 Allzeit-Tiefstpreis';
    } else {
      const markupPct = pctRise(stats.tiefstpreis, currentPrice);
      const isSevere = markupPct >= 50;
      const nextClass = `tp-detail-deal-badge tp-is-not-low ${isSevere ? 'tp-is-severe-markup' : ''}`;
      if (badge.className !== nextClass) badge.className = nextClass;
      const peakContext = hasSignificantPeak ? ` | Höchstpreis: CHF ${stats.hoechstpreis.toFixed(2)}` : '';
      const nextTitle = `Historischer Tiefstpreis lag bei CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)${peakContext}`;
      if (badge.title !== nextTitle) badge.title = nextTitle;
      const nextText = `⚠️ Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}%)`;
      if (badge.textContent !== nextText) badge.textContent = nextText;
    }
  } else {
    document.getElementById('tp-detail-deal-badge')?.remove();
    return;
  }
}

