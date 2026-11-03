/**
 * Product Detail Page Feature
 * Injects Tiefstpreis status badge, peak context, 1-click Discord share,
 * inline Web/AI search, deal subline, and mini sparkline with interactive modal.
 */

import { getDetailProductId, getDetailLowestPrice, isShippingPriceActive } from '../page/adapter.js';
import { getCardStats } from '../page/cards.js';
import { getDisplayDelta, medianHorizonLabel, vortiefDropPct, getLevelPct } from '../domain/deal-score.js';
import { fetchSingleProductPriceStats } from '../scanner/scanner.js';
import { pctDrop, pctRise, priceToCents, recordRefForPrice } from '../domain/price.js';
import { withLivePrice } from './share-discord.js';
import { CONFIG, sanitizeReviewKeyword } from '../state/config.js';
import { formatSearchQuery } from './tavily-search.js';
import { openAiPopover } from '../ui/badges/card-ai-popover.js';
import { openSparklinePopout, renderSparkline } from '../ui/sparkline.js';
import { extractShareData } from '../page/product-offers.js';
import { triggerDiscordShare } from '../ui/badges/card-share.js';
import { getSharedDeal } from '../scanner/cache.js';
import { setTextIfChanged, setTitleIfChanged } from '../ui/badges/dom-helpers.js';

let detailRun = 0;

export const removeDetailDecorations = () => {
  document.getElementById('tp-detail-deal-badge')?.remove();
  document.getElementById('tp-detail-subline')?.remove();
  document.getElementById('tp-detail-share-btn')?.remove();
  document.getElementById('tp-detail-sparkline')?.remove();
  document.querySelector('.Plugin_ProductHeading .tp-review-search-btn, h1 .tp-review-search-btn')?.remove();
};

export function renderDetailReviewButton(headingEl, title, currentPrice, stats, pid) {
  if (!headingEl || !title) return;
  let btn = headingEl.querySelector('.tp-review-search-btn');
  if (CONFIG.REVIEW_SEARCH_ENABLED === false) {
    btn?.remove();
    return;
  }
  const rawKw = sanitizeReviewKeyword(CONFIG.REVIEW_SEARCH_KEYWORD);
  const priceText = currentPrice > 0 ? `CHF ${currentPrice.toFixed(2)}` : '';
  const fullQuery = formatSearchQuery(title, rawKw, priceText);
  const aiMode = CONFIG.REVIEW_SEARCH_AI_MODE === true;
  const hasTavily = !!(CONFIG.TAVILY_ENABLED && CONFIG.TAVILY_API_KEY && CONFIG.TAVILY_API_KEY.trim());

  if (!btn) {
    btn = document.createElement('a');
    btn.className = 'tp-review-search-btn tp-detail-review-btn';
    btn.textContent = '🌐';
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (CONFIG.TAVILY_ENABLED && CONFIG.TAVILY_API_KEY && CONFIG.TAVILY_API_KEY.trim()) {
        e.preventDefault();
        openAiPopover({
          title,
          priceText,
          googleUrl: btn.href,
          card: headingEl,
          pid
        });
      }
    });
    headingEl.appendChild(btn);
  }
  btn.href = 'https://www.google.com/search?q=' + encodeURIComponent(fullQuery) + (aiMode ? '&udm=50' : '');
  const tipText = hasTavily
    ? `KI-Fazit & Google-Suche: ${fullQuery}`
    : `Google-Suche: ${fullQuery}${aiMode ? ' (KI-Modus)' : ''}`;
  setTitleIfChanged(btn, tipText);
  btn.setAttribute('aria-label', tipText);
}

export function renderDetailSubline(stats, currentPrice, priceBasis) {
  let subline = document.getElementById('tp-detail-subline');
  if (!stats || !(currentPrice > 0) || !(stats.tiefstpreis > 0)) {
    subline?.remove();
    return;
  }
  if (!subline) {
    subline = document.createElement('div');
    subline.id = 'tp-detail-subline';
    const target = document.querySelector('.shippingText')
      || document.querySelector('.priceContainer')
      || document.querySelector('.Plugin_PriceInformation')
      || document.querySelector('.Plugin_Price');
    if (target?.parentElement) {
      if (target.nextElementSibling) target.parentElement.insertBefore(subline, target.nextElementSibling);
      else target.parentElement.appendChild(subline);
    } else {
      document.body.appendChild(subline);
    }
  }

  const displayKind = getDisplayDelta(currentPrice, stats).kind;
  const isAllTimeLow = (displayKind === 'new-low' || displayKind === 'at-low');
  const prevLow = recordRefForPrice(stats, currentPrice).previousLow;
  const showPrevLow = !!(prevLow && priceToCents(prevLow) > priceToCents(currentPrice));
  const showMedian = !!(stats.medianPrice && stats.medianPrice > currentPrice);
  const horizon = medianHorizonLabel(stats);

  if (isAllTimeLow) {
    subline.className = 'tp-detail-subline tp-is-record-low';
    const parts = [];
    if (showPrevLow) {
      const dRec = vortiefDropPct(currentPrice, stats);
      parts.push(`📉 Vor-Tief: CHF ${prevLow.toFixed(2)}${dRec > 0 ? ` (-${dRec}%)` : ''}`);
    }
    if (showMedian) {
      const dMed = getLevelPct(currentPrice, stats);
      parts.push(`Ø (${horizon}): CHF ${stats.medianPrice.toFixed(2)}${dMed > 0 ? ` (-${dMed}%)` : ''}`);
    }
    if (parts.length === 0) {
      parts.push('🌟 Allzeit-Tiefstpreis');
    }
    setTextIfChanged(subline, parts.join(' · '));
    setTitleIfChanged(subline, 'Allzeit-Tiefstpreis! Historischer Tiefstwert für dieses Produkt.');
  } else {
    subline.className = 'tp-detail-subline tp-is-markup';
    const markupPct = pctRise(stats.tiefstpreis, currentPrice);
    const parts = [`⚠️ Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)`];
    if (stats.medianPrice) {
      parts.push(`Ø (${horizon}): CHF ${stats.medianPrice.toFixed(2)}`);
    }
    setTextIfChanged(subline, parts.join(' · '));
    setTitleIfChanged(subline, `Aktueller Preis liegt über dem historischen Tiefstpreis von CHF ${stats.tiefstpreis.toFixed(2)}.`);
  }
}

export function renderDetailShareButton({ pid, currentPrice, priceBasis, stats, title, url, imageUrl }) {
  let shareBtn = document.getElementById('tp-detail-share-btn');
  if (!(currentPrice > 0)) {
    shareBtn?.remove();
    return;
  }
  if (!shareBtn) {
    shareBtn = document.createElement('button');
    shareBtn.id = 'tp-detail-share-btn';
    shareBtn.type = 'button';
    shareBtn.className = 'tp-detail-share-btn';
    shareBtn.textContent = '📤';
    shareBtn.title = 'Deal / Preis in Discord teilen';
    shareBtn.setAttribute('aria-label', 'Deal in Discord teilen');

    shareBtn.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      shareBtn.disabled = true;
      await triggerDiscordShare({
        pid,
        cardPrice: currentPrice,
        priceBasis,
        stats,
        title,
        url,
        imageUrl,
        isDetailPage: true,
        onDone: stillFresh => {
          shareBtn.disabled = false;
          if (stillFresh) shareBtn.classList.add('tp-share-done');
        }
      });
    });

    const bellEl = document.querySelector('.Plugin_NewInfoMailButton, a.f_showNewInfoMailFormDialog, a[href*="infomail"]:not(.tp-review-search-btn), #mock-alarm-bell');
    const anchor = bellEl?.nextElementSibling?.classList?.contains('tp-alarm-cog')
      ? bellEl.nextElementSibling
      : (bellEl || document.querySelector('.Plugin_Price') || document.querySelector('.priceContainer'));
    if (anchor?.after) anchor.after(shareBtn);
    else if (anchor?.parentElement) anchor.parentElement.appendChild(shareBtn);
    else document.body.appendChild(shareBtn);
  }
  shareBtn.classList.toggle('tp-share-done', !!(pid && currentPrice > 0 && getSharedDeal(pid, priceToCents(currentPrice))));
}

export function renderDetailSparkline(pid, title, currentPrice, stats) {
  let sparkContainer = document.getElementById('tp-detail-sparkline');
  const hasSeries = CONFIG.ENABLE_SPARKLINES !== false && stats && Array.isArray(stats.timeSeries) && stats.timeSeries.length >= 2;
  if (!hasSeries) {
    sparkContainer?.remove();
    return;
  }

  const chartEl = document.querySelector('.chartProductPrice, a[href*="pricechart"], img[src*="pricechart"], .Plugin_PriceChart');
  if (!sparkContainer) {
    sparkContainer = document.createElement('div');
    sparkContainer.id = 'tp-detail-sparkline';
    sparkContainer.className = 'tp-sparkline-container tp-detail-sparkline';
    sparkContainer.style.cursor = 'pointer';
    sparkContainer.setAttribute('role', 'button');
    sparkContainer.setAttribute('tabindex', '0');
    sparkContainer.setAttribute('title', 'Interaktiven Preisverlauf öffnen (inkl. Keepa)');

    const target = chartEl || document.querySelector('.shippingText') || document.querySelector('.priceContainer');
    if (target?.after) target.after(sparkContainer);
    else if (target?.parentElement) target.parentElement.appendChild(sparkContainer);
    else document.body.appendChild(sparkContainer);
  }

  const series = withLivePrice(stats.timeSeries, currentPrice);
  sparkContainer._tpSeries = series;

  if (!sparkContainer.dataset.tpPopoutBound) {
    sparkContainer.dataset.tpPopoutBound = 'true';
    const openPopout = () => {
      openSparklinePopout(sparkContainer._tpSeries, { title, pid, directUrl: (typeof location !== 'undefined' ? location.href : '') });
    };
    sparkContainer.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openPopout();
    });
    sparkContainer.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        openPopout();
      }
    });
  }

  const svg = renderSparkline(series, 64, 18);
  if (svg) {
    sparkContainer.replaceChildren(svg);
  }
}

export async function processProductDetailPage() {
  const run = ++detailRun;
  const pid = getDetailProductId();
  if (!pid) { removeDetailDecorations(); return; }

  const headingSelectors = ['.Plugin_ProductHeading h1', '.productHeading h1', '.product_title h1', 'h1.productTitle', 'h1'];
  let headingEl = null;
  for (const sel of headingSelectors) {
    headingEl = document.querySelector(sel);
    if (headingEl) break;
  }
  if (!headingEl) { removeDetailDecorations(); return; }

  const { price: currentPrice, basis: priceBasis } = getDetailLowestPrice();
  if (!(currentPrice > 0)) { removeDetailDecorations(); return; }

  const shareData = extractShareData(document.body || headingEl);
  const title = shareData.title || headingEl.textContent?.trim() || '';
  const url = shareData.url || (typeof location !== 'undefined' ? location.href : '');
  const imageUrl = shareData.imageUrl || '';

  // Render Web Search / AI Review next to H1 title
  renderDetailReviewButton(headingEl, title, currentPrice, null, pid);

  let badge = document.getElementById('tp-detail-deal-badge');
  let stats = getCardStats(pid, priceBasis);
  if (!stats) {
    await fetchSingleProductPriceStats(pid, 1, false, null, currentPrice, null, priceBasis);
    if (run !== detailRun || pid !== getDetailProductId() || !headingEl.isConnected) {
      if (pid !== getDetailProductId()) removeDetailDecorations();
      return;
    }
    const fresh = getDetailLowestPrice();
    if (fresh.price !== currentPrice || fresh.basis !== priceBasis) return;
    stats = getCardStats(pid, priceBasis);
  }

  if (stats && stats.tiefstpreis > 0) {
    if (typeof stats.isShippingPrice === 'boolean' && stats.isShippingPrice !== (priceBasis === 'shipping')) {
      removeDetailDecorations();
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

    // Render Deal Subline
    renderDetailSubline(stats, currentPrice, priceBasis);

    // Render Discord Share Button next to price alarm bell
    renderDetailShareButton({ pid, currentPrice, priceBasis, stats, title, url, imageUrl });

    // Render Mini Sparkline below chart thumbnail
    renderDetailSparkline(pid, title, currentPrice, stats);

    // Update Web Search / AI review button with stats
    renderDetailReviewButton(headingEl, title, currentPrice, stats, pid);
  } else {
    removeDetailDecorations();
  }
}
