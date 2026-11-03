/**
 * Product Detail Page Feature
 * Injects 1-click Discord share, inline Web/AI search, deal subline,
 * and mini sparkline with interactive modal.
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
import { getSharedDeal, fullSeries } from '../scanner/cache.js';
import { setTextIfChanged, setTitleIfChanged } from '../ui/badges/dom-helpers.js';

let detailRun = 0;

export const removeDetailDecorations = () => {
  document.querySelectorAll('#tp-detail-subline, .tp-detail-subline').forEach(el => el.remove());
  document.querySelectorAll('#tp-detail-share-btn, .tp-detail-share-btn').forEach(el => el.remove());
  document.querySelectorAll('#tp-detail-sparkline, .tp-detail-sparkline').forEach(el => el.remove());
  document.querySelectorAll('.tp-detail-review-btn').forEach(el => el.remove());
};

export function getDetailHeadings() {
  const candidates = [
    ...document.querySelectorAll('.Plugin_ProductDetailsInfo h1'),
    ...document.querySelectorAll('h1.product-name'),
    ...document.querySelectorAll('.Plugin_ProductHeading h1'),
    ...document.querySelectorAll('.productHeading h1'),
    ...document.querySelectorAll('.product_title h1'),
    ...document.querySelectorAll('h1.productTitle'),
    ...document.querySelectorAll('h1')
  ];
  const unique = [];
  for (const el of candidates) {
    if (el && !unique.includes(el)) unique.push(el);
  }
  return unique;
}

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
  if (!stats || !(currentPrice > 0) || !(stats.tiefstpreis > 0)) {
    document.querySelectorAll('#tp-detail-subline, .tp-detail-subline').forEach(el => el.remove());
    return;
  }

  const targets = [];
  const priceInfoBlocks = document.querySelectorAll(
    '.Plugin_PriceInformation.price_information_product, .f_priceContainer .Plugin_PriceInformation, .f_priceContainerFixIE .Plugin_PriceInformation'
  );
  for (const block of priceInfoBlocks) {
    const shipping = block.querySelector('.shippingText');
    const pc = block.querySelector('.priceContainer');
    targets.push(shipping || pc || block);
  }
  if (targets.length === 0) {
    const fallback = document.querySelector('.shippingText')
      || document.querySelector('.priceContainer')
      || document.querySelector('.Plugin_PriceInformation')
      || document.querySelector('.Plugin_Price');
    if (fallback) targets.push(fallback);
  }

  const displayKind = getDisplayDelta(currentPrice, stats).kind;
  const isAllTimeLow = (displayKind === 'new-low' || displayKind === 'at-low');
  const prevLow = recordRefForPrice(stats, currentPrice).previousLow;
  const showPrevLow = !!(prevLow && priceToCents(prevLow) > priceToCents(currentPrice));
  const showMedian = !!(stats.medianPrice && stats.medianPrice > currentPrice);
  const horizon = medianHorizonLabel(stats);

  let sublineText = '';
  let sublineTitle = '';
  let sublineClass = '';

  if (isAllTimeLow) {
    sublineClass = 'tp-detail-subline tp-is-record-low';
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
      parts.push('Allzeit-Tiefstpreis bestätigt');
    }
    sublineText = parts.join(' · ');
    sublineTitle = 'Allzeit-Tiefstpreis! Historischer Tiefstwert für dieses Produkt.';
  } else {
    sublineClass = 'tp-detail-subline tp-is-markup';
    const markupPct = pctRise(stats.tiefstpreis, currentPrice);
    const parts = [`⚠️ Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)`];
    if (stats.medianPrice) {
      parts.push(`Ø (${horizon}): CHF ${stats.medianPrice.toFixed(2)}`);
    }
    sublineText = parts.join(' · ');
    sublineTitle = `Aktueller Preis liegt über dem historischen Tiefstpreis von CHF ${stats.tiefstpreis.toFixed(2)}.`;
  }

  if (targets.length === 0) {
    let subline = document.getElementById('tp-detail-subline');
    if (!subline) {
      subline = document.createElement('div');
      subline.id = 'tp-detail-subline';
      subline.className = sublineClass;
      document.body?.appendChild(subline);
    }
    subline.className = sublineClass;
    setTextIfChanged(subline, sublineText);
    setTitleIfChanged(subline, sublineTitle);
    return;
  }

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const parent = target.parentElement || target;
    let subline = parent.querySelector?.('.tp-detail-subline');
    if (!subline) {
      subline = document.createElement('div');
      if (i === 0 && !document.getElementById('tp-detail-subline')) {
        subline.id = 'tp-detail-subline';
      }
      subline.className = sublineClass;
      if (target.after) target.after(subline);
      else if (target.nextElementSibling) target.parentElement.insertBefore(subline, target.nextElementSibling);
      else parent.appendChild(subline);
    }
    subline.className = sublineClass;
    setTextIfChanged(subline, sublineText);
    setTitleIfChanged(subline, sublineTitle);
  }
}

function createDetailShareBtn({ pid, currentPrice, priceBasis, stats, title, url, imageUrl }) {
  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'tp-detail-share-btn';
  shareBtn.textContent = '📤';
  shareBtn.title = 'Deal / Preis in Discord teilen';
  shareBtn.setAttribute('aria-label', 'Deal in Discord teilen');

  shareBtn.addEventListener('click', async e => {
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.tp-detail-share-btn').forEach(b => { b.disabled = true; });
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
        document.querySelectorAll('.tp-detail-share-btn').forEach(b => {
          b.disabled = false;
          if (stillFresh) b.classList.add('tp-share-done');
        });
      }
    });
  });
  return shareBtn;
}

export function renderDetailShareButton({ pid, currentPrice, priceBasis, stats, title, url, imageUrl }) {
  if (!(currentPrice > 0)) {
    document.querySelectorAll('#tp-detail-share-btn, .tp-detail-share-btn').forEach(el => el.remove());
    return;
  }

  const bellSelectors = [
    '.f_priceContainer .Plugin_NewInfoMailButton:not([data-templ="txt"]) a',
    '.f_priceContainerFixIE .Plugin_NewInfoMailButton:not([data-templ="txt"]) a',
    '.Plugin_PriceInformation.price_information_product ~ * .Plugin_NewInfoMailButton:not([data-templ="txt"]) a',
    '.Plugin_NewInfoMailButton.hoverBox a',
    '.f_showNewInfoMailFormDialog',
    '#mock-alarm-bell'
  ];
  const bellEls = [];
  for (const sel of bellSelectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest?.('[data-templ="txt"]') || el.getAttribute?.('data-templ') === 'txt') continue;
      if (!bellEls.includes(el)) bellEls.push(el);
    }
  }

  if (bellEls.length === 0) {
    const fallbackBell = document.querySelector('.Plugin_NewInfoMailButton, a.f_showNewInfoMailFormDialog, a[href*="infomail"]:not(.tp-review-search-btn)');
    if (fallbackBell) bellEls.push(fallbackBell);
    else {
      const priceFallback = document.querySelector('.Plugin_Price') || document.querySelector('.priceContainer');
      if (priceFallback) bellEls.push(priceFallback);
    }
  }

  const isShared = !!(pid && currentPrice > 0 && getSharedDeal(pid, priceToCents(currentPrice)));

  if (bellEls.length === 0) {
    let shareBtn = document.getElementById('tp-detail-share-btn');
    if (!shareBtn) {
      shareBtn = createDetailShareBtn({ pid, currentPrice, priceBasis, stats, title, url, imageUrl });
      shareBtn.id = 'tp-detail-share-btn';
      document.body?.appendChild(shareBtn);
    }
    shareBtn.classList.toggle('tp-share-done', isShared);
    return;
  }

  for (let i = 0; i < bellEls.length; i++) {
    const bellEl = bellEls[i];
    const anchor = bellEl.nextElementSibling?.classList?.contains('tp-alarm-cog')
      ? bellEl.nextElementSibling
      : bellEl;
    const parent = anchor.parentElement || bellEl.parentElement;
    let shareBtn = parent?.querySelector?.('.tp-detail-share-btn');
    if (!shareBtn) {
      shareBtn = createDetailShareBtn({ pid, currentPrice, priceBasis, stats, title, url, imageUrl });
      if (i === 0 && !document.getElementById('tp-detail-share-btn')) {
        shareBtn.id = 'tp-detail-share-btn';
      }
      if (anchor.after) anchor.after(shareBtn);
      else if (anchor.nextElementSibling) parent.insertBefore(shareBtn, anchor.nextElementSibling);
      else parent.appendChild(shareBtn);
    }
    shareBtn.classList.toggle('tp-share-done', isShared);
  }
}

export function renderDetailSparkline(pid, title, currentPrice, stats) {
  let sparkContainer = document.getElementById('tp-detail-sparkline');
  const baseSeries = fullSeries(stats) || stats?.timeSeries;
  const hasSeries = CONFIG.ENABLE_SPARKLINES !== false && Array.isArray(baseSeries) && baseSeries.length >= 2;
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

  const series = withLivePrice(baseSeries, currentPrice);
  sparkContainer._tpSeries = series;
  sparkContainer._tpTitle = title;

  if (!sparkContainer.dataset.tpPopoutBound) {
    sparkContainer.dataset.tpPopoutBound = 'true';
    const openPopout = () => {
      openSparklinePopout(sparkContainer._tpSeries, {
        title: sparkContainer._tpTitle || title,
        pid,
        directUrl: (typeof location !== 'undefined' ? location.href : '')
      });
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

  const headings = getDetailHeadings();
  if (headings.length === 0) { removeDetailDecorations(); return; }

  const { price: currentPrice, basis: priceBasis } = getDetailLowestPrice();
  if (!(currentPrice > 0)) { removeDetailDecorations(); return; }

  const primaryHeading = headings[0];
  const shareScope = primaryHeading?.closest?.('.Page_DetailProduct, .Page_Product, #page, main, [class*="Product"]') || primaryHeading;
  const shareData = extractShareData(shareScope);
  const title = shareData.title || primaryHeading.textContent?.trim() || '';
  const url = shareData.url || (typeof location !== 'undefined' ? location.href : '');
  const imageUrl = shareData.imageUrl || '';

  // Render Web Search / AI Review next to each H1 title
  for (const h of headings) {
    renderDetailReviewButton(h, title, currentPrice, null, pid);
  }

  let stats = getCardStats(pid, priceBasis);
  if (!stats) {
    await fetchSingleProductPriceStats(pid, 1, false, null, currentPrice, null, priceBasis);
    if (run !== detailRun || pid !== getDetailProductId()) {
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

    // Render Deal Subline
    renderDetailSubline(stats, currentPrice, priceBasis);

    // Render Discord Share Button next to price alarm bell
    renderDetailShareButton({ pid, currentPrice, priceBasis, stats, title, url, imageUrl });

    // Render Mini Sparkline below chart thumbnail
    renderDetailSparkline(pid, title, currentPrice, stats);

    // Update Web Search / AI review button with stats
    for (const h of headings) {
      renderDetailReviewButton(h, title, currentPrice, stats, pid);
    }
  } else {
    removeDetailDecorations();
  }
}
