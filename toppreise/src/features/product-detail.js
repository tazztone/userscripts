/**
 * Product Detail Page Feature
 * Injects 1-click Discord share, inline Web/AI search, deal subline,
 * and mini sparkline with interactive modal.
 */

import { getDetailProductId, getDetailLowestPrice, isShippingPriceActive, extractNativePriceRating } from '../page/adapter.js';
import { SELECTORS } from '../page/selectors.js';
import { getCardStats } from '../page/cards.js';
import { getDisplayDelta, medianHorizonLabel, vortiefDropPct, getLevelPct } from '../domain/deal-score.js';
import { fetchSingleProductPriceStats } from '../scanner/scanner.js';
import { pctDrop, pctRise, priceToCents, recordRefForPrice } from '../domain/price.js';
import { withLivePrice } from './share-discord.js';
import { CONFIG, sanitizeReviewKeyword } from '../state/config.js';
import { formatSearchQuery, formatReviewTooltip } from './tavily-search.js';
import { openAiPopover } from '../ui/badges/card-ai-popover.js';
import { openAiLauncherPopover, openSearchTab } from '../ui/ai-launcher-popover.js';
import { openSparklinePopout, renderSparkline } from '../ui/sparkline.js';
import { extractShareData, parseProductOffers, pickCheapestOffer } from '../page/product-offers.js';
import { triggerDiscordShare } from '../ui/badges/card-share.js';
import { getSharedDeal, fullSeries } from '../scanner/cache.js';
import { setHtmlIfChanged, setTextIfChanged, setTitleIfChanged } from '../ui/badges/dom-helpers.js';

let detailRun = 0;

export const removeDetailDecorations = () => {
  document.querySelectorAll('#tp-detail-subline, .tp-detail-subline').forEach(el => el.remove());
  document.querySelectorAll('#tp-detail-share-btn, .tp-detail-share-btn').forEach(el => el.remove());
  document.querySelectorAll('#tp-detail-sparkline, .tp-detail-sparkline').forEach(el => el.remove());
  document.querySelectorAll('.tp-detail-review-btn').forEach(el => el.remove());
};

export function getDetailHeadings() {
  const specific = [
    '.Plugin_ProductDetailsInfo h1',
    'h1.product-name',
    '.Plugin_ProductHeading h1',
    '.productHeading h1',
    '.product_title h1',
    'h1.productTitle'
  ];
  const unique = [];
  for (const sel of specific) {
    for (const el of document.querySelectorAll(sel)) {
      if (el && !unique.includes(el)) unique.push(el);
    }
  }
  if (unique.length === 0) {
    for (const el of document.querySelectorAll('h1')) {
      if (el && !el.closest?.('.fc-dialog-container, .fc-consent-root, header, nav, footer') && !unique.includes(el)) {
        unique.push(el);
      }
    }
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
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      const payload = btn._tpReviewPayload || { title, priceText, pid };
      const q = formatSearchQuery(payload.title, sanitizeReviewKeyword(CONFIG.REVIEW_SEARCH_KEYWORD), payload.priceText);
      const baseGoogle = 'https://www.google.com/search?q=' + encodeURIComponent(q);
      openAiLauncherPopover({
        mode: 'single',
        anchorEl: btn,
        title: payload.title,
        priceText: payload.priceText,
        onLaunch: ({ engine, model }) => {
          if (engine === 'google') {
            openSearchTab(baseGoogle);
          } else if (engine === 'google-ai') {
            openSearchTab(`${baseGoogle}&udm=50`);
          } else if (engine === 'openrouter' || engine === 'tavily') {
            openAiPopover({
              title: payload.title,
              priceText: payload.priceText,
              googleUrl: btn.href,
              card: headingEl,
              pid: payload.pid,
              provider: engine,
              model
            });
          }
        }
      });
    });
    headingEl.appendChild(btn);
  }
  btn._tpReviewPayload = { title, priceText, pid };
  btn.href = 'https://www.google.com/search?q=' + encodeURIComponent(fullQuery) + (aiMode ? '&udm=50' : '');
  const { title: tipTitle, ariaLabel } = formatReviewTooltip(fullQuery, { hasTavily: true, aiMode });
  setTitleIfChanged(btn, tipTitle);
  btn.setAttribute('aria-label', ariaLabel);
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
    const shippingNodes = block.querySelectorAll('.shippingText');
    if (shippingNodes && shippingNodes.length > 0) {
      for (const st of shippingNodes) {
        if (!targets.includes(st)) targets.push(st);
      }
    } else {
      const pcNodes = block.querySelectorAll('.priceContainer');
      if (pcNodes && pcNodes.length > 0) {
        for (const pc of pcNodes) {
          if (!targets.includes(pc)) targets.push(pc);
        }
      } else {
        targets.push(block);
      }
    }
  }
  if (targets.length === 0) {
    const fallbacks = document.querySelectorAll('.shippingText, .priceContainer, .Plugin_PriceInformation, .Plugin_Price');
    for (const fb of fallbacks) {
      if (fb.closest?.(SELECTORS.cards.excludedParents)) continue;
      if (!targets.includes(fb)) targets.push(fb);
    }
  }

  const displayKind = getDisplayDelta(currentPrice, stats).kind;
  const isAllTimeLow = (displayKind === 'new-low' || displayKind === 'at-low');
  const prevLow = recordRefForPrice(stats, currentPrice).previousLow;
  const showPrevLow = !!(prevLow && priceToCents(prevLow) > priceToCents(currentPrice));
  const showMedian = !!(stats.medianPrice && stats.medianPrice > currentPrice);
  const horizon = medianHorizonLabel(stats);

  let sublineHtml = '';
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
      parts.push(`📊 (Ø: ${horizon}): CHF ${stats.medianPrice.toFixed(2)}${dMed > 0 ? ` (-${dMed}%)` : ''}`);
    }
    if (parts.length === 0) {
      parts.push('Allzeit-Tiefstpreis bestätigt');
    }
    sublineHtml = parts.map(text => `<span class="tp-subline-pill">${text}</span>`).join('');
    sublineTitle = 'Allzeit-Tiefstpreis! Historischer Tiefstwert für dieses Produkt.';
  } else {
    sublineClass = 'tp-detail-subline tp-is-markup';
    const markupPct = pctRise(stats.tiefstpreis, currentPrice);
    const parts = [`⚠️ Tiefstpreis: CHF ${stats.tiefstpreis.toFixed(2)} (+${markupPct}% Aufschlag)`];
    if (stats.medianPrice) {
      parts.push(`📊 (Ø: ${horizon}): CHF ${stats.medianPrice.toFixed(2)}`);
    }
    sublineHtml = parts.map(text => `<span class="tp-subline-pill">${text}</span>`).join('');
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
    setHtmlIfChanged(subline, sublineHtml);
    setTitleIfChanged(subline, sublineTitle);
    return;
  }

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const parent = target.parentElement || target;
    let subline = (target.nextElementSibling?.classList?.contains('tp-detail-subline') ? target.nextElementSibling : null)
      || parent.querySelector?.('.tp-detail-subline');
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
    setHtmlIfChanged(subline, sublineHtml);
    setTitleIfChanged(subline, sublineTitle);
  }
}

function createDetailShareBtn(payload) {
  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'tp-detail-share-btn';
  shareBtn.textContent = '📤';
  shareBtn.title = 'Deal / Preis in Discord teilen';
  shareBtn.setAttribute('aria-label', 'Deal in Discord teilen');
  shareBtn._tpSharePayload = payload;

  shareBtn.addEventListener('click', async e => {
    e.preventDefault();
    e.stopPropagation();
    if (shareBtn.disabled) return;
    const { pid, currentPrice, priceBasis, stats, title, url, imageUrl, nativeRating } = shareBtn._tpSharePayload || {};
    document.querySelectorAll('.tp-detail-share-btn').forEach(b => {
      b.disabled = true;
      b.classList.add('tp-share-loading');
    });
    let doneCalled = false;
    try {
      await triggerDiscordShare({
        pid,
        cardPrice: currentPrice,
        priceBasis,
        stats,
        title,
        url,
        imageUrl,
        nativeRating,
        isDetailPage: true,
        onDone: stillFresh => {
          doneCalled = true;
          document.querySelectorAll('.tp-detail-share-btn').forEach(b => {
            b.disabled = false;
            b.classList.remove('tp-share-loading');
            if (stillFresh) b.classList.add('tp-share-done');
          });
        }
      });
    } finally {
      if (!doneCalled) {
        document.querySelectorAll('.tp-detail-share-btn').forEach(b => {
          b.disabled = false;
          b.classList.remove('tp-share-loading');
        });
      }
    }
  });
  return shareBtn;
}

export function renderDetailShareButton({ pid, currentPrice, priceBasis, stats, title, url, imageUrl, nativeRating = null }) {
  if (!(currentPrice > 0)) {
    document.querySelectorAll('#tp-detail-share-btn, .tp-detail-share-btn').forEach(el => el.remove());
    return;
  }

  const payload = { pid, currentPrice, priceBasis, stats, title, url, imageUrl, nativeRating };

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
      shareBtn = createDetailShareBtn(payload);
      shareBtn.id = 'tp-detail-share-btn';
      document.body?.appendChild(shareBtn);
    } else {
      shareBtn._tpSharePayload = payload;
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
      shareBtn = createDetailShareBtn(payload);
      if (i === 0 && !document.getElementById('tp-detail-share-btn')) {
        shareBtn.id = 'tp-detail-share-btn';
      }
      if (anchor.after) anchor.after(shareBtn);
      else if (anchor.nextElementSibling) parent.insertBefore(shareBtn, anchor.nextElementSibling);
      else parent.appendChild(shareBtn);
    } else {
      shareBtn._tpSharePayload = payload;
    }
    shareBtn.classList.toggle('tp-share-done', isShared);
  }
}

export function renderDetailSparkline(pid, title, currentPrice, stats, priceBasis = null) {
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
  const useShipping = priceBasis ? priceBasis === 'shipping' : isShippingPriceActive();
  sparkContainer._tpSeries = series;
  sparkContainer._tpTitle = title;
  sparkContainer._tpPid = pid;

  const baseLastTs = baseSeries.length ? (+baseSeries[baseSeries.length - 1][0] || 0) : 0;
  const lastPriceCents = priceToCents(currentPrice);
  const sig = [
    baseSeries.length,
    lastPriceCents,
    priceToCents(stats?.medianPrice ?? 0),
    priceToCents(stats?.tiefstpreis ?? 0),
    stats?.time || 0,
    baseLastTs
  ].join(':');
  if (sparkContainer.dataset.tpSparkSig === sig) {
    return;
  }
  sparkContainer.dataset.tpSparkSig = sig;

  const best = pickCheapestOffer(parseProductOffers(document), useShipping);
  const pageUrl = typeof location !== 'undefined' ? location.href : '';
  let resolvedDirectUrl = pageUrl;
  if (best?.url) {
    try {
      resolvedDirectUrl = pageUrl ? new URL(best.url, pageUrl).href : best.url;
    } catch {
      resolvedDirectUrl = best.url;
    }
  }
  sparkContainer._tpDealer = best?.dealer || '';
  sparkContainer._tpDirectUrl = resolvedDirectUrl;

  if (!sparkContainer.dataset.tpPopoutBound) {
    sparkContainer.dataset.tpPopoutBound = 'true';
    const openPopout = () => {
      openSparklinePopout(sparkContainer._tpSeries, {
        title: sparkContainer._tpTitle || title,
        pid: sparkContainer._tpPid ?? pid,
        dealer: sparkContainer._tpDealer || '',
        directUrl: sparkContainer._tpDirectUrl || (typeof location !== 'undefined' ? location.href : '')
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

  const svg = renderSparkline(series, 76, 22);
  if (svg) {
    sparkContainer.replaceChildren(svg);
  }
}

export async function processProductDetailPage(domLock = fn => fn(), retryDepth = 0) {
  const run = ++detailRun;
  const pid = getDetailProductId();
  if (!pid) { domLock(removeDetailDecorations); return; }

  const headings = getDetailHeadings();
  if (headings.length === 0) { domLock(removeDetailDecorations); return; }

  const { price: currentPrice, basis: priceBasis } = getDetailLowestPrice();
  if (!(currentPrice > 0)) { domLock(removeDetailDecorations); return; }

  const primaryHeading = headings[0];
  const shareScope = primaryHeading?.closest?.('.Page_DetailProduct, .Page_Product, #page, main, [class*="Product"]') || primaryHeading;
  const shareData = extractShareData(shareScope);
  const title = shareData.title || primaryHeading.textContent?.trim() || '';
  const url = shareData.url || (typeof location !== 'undefined' ? location.href : '');
  const imageUrl = shareData.imageUrl || '';

  // Render Web Search / AI Review next to each H1 title
  domLock(() => {
    for (const h of headings) {
      renderDetailReviewButton(h, title, currentPrice, null, pid);
    }
  });

  let stats = getCardStats(pid, priceBasis);
  if (!stats) {
    await fetchSingleProductPriceStats(pid, 1, false, null, currentPrice, null, priceBasis);
    if (run !== detailRun) return;
    if (pid !== getDetailProductId()) {
      domLock(removeDetailDecorations);
      return;
    }
    const fresh = getDetailLowestPrice();
    if (fresh.price !== currentPrice || fresh.basis !== priceBasis) {
      if (retryDepth < 2) return processProductDetailPage(domLock, retryDepth + 1);
      return;
    }
    stats = getCardStats(pid, priceBasis);
  }

  domLock(() => {
    const nativeRating = extractNativePriceRating(document);

    if (stats && stats.tiefstpreis > 0) {
      if (typeof stats.isShippingPrice === 'boolean' && stats.isShippingPrice !== (priceBasis === 'shipping')) {
        removeDetailDecorations();
        return;
      }

      // Render Deal Subline
      renderDetailSubline(stats, currentPrice, priceBasis);

      // Render Discord Share Button next to price alarm bell
      renderDetailShareButton({ pid, currentPrice, priceBasis, stats, title, url, imageUrl, nativeRating });

      // Render Mini Sparkline below chart thumbnail
      renderDetailSparkline(pid, title, currentPrice, stats, priceBasis);

      // Update Web Search / AI review button with stats
      for (const h of headings) {
        renderDetailReviewButton(h, title, currentPrice, stats, pid);
      }
    } else {
      removeDetailDecorations();
    }

    // Live Session Bridge Telemetry (MCP evaluate_script)
    const rootEl = document.getElementById('tp-root');
    if (rootEl) {
      const isAllTimeLow = !!(stats && stats.tiefstpreis > 0 && priceToCents(currentPrice) <= priceToCents(stats.tiefstpreis));
      rootEl.setAttribute('data-tp-diag', JSON.stringify({
        version: typeof GM_info !== 'undefined' ? (GM_info.script?.version || 'dev') : 'dev',
        pageType: 'detail',
        pid,
        currentPrice,
        priceBasis,
        isAllTimeLow,
        nativeRating: nativeRating ? (({ ranges, ...rest }) => rest)(nativeRating) : null,
        ts: Date.now()
      }));
    }
  });
}
