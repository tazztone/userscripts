/**
 * Card Share Button
 * Discord 1-Click share button, click-time freshness validation, payload construction,
 * image/forum transport orchestration, and feedback toasts.
 */

import { CONFIG, _getValue, _setValue, getDiscordChannels } from '../../state/config.js';
import { getDisplayDelta } from '../../domain/deal-score.js';
import { basisMatchesFor, extractCardData } from '../../page/cards.js';
import { getCachedDealer, setCachedDealer, lruSet, getSharedDeal, setSharedDeal } from '../../scanner/cache.js';
import { dealerCache } from './deal-badge.js';
import { buildKeepaUrl } from '../sparkline.js';
import { priceToCents } from '../../domain/price.js';
import { openSharePreviewModal } from '../modal-share-preview.js';
import {
  isDiscordWebhookUrl,
  withLivePrice,
  renderSparklinePng,
  postDealImageToDiscord,
  postDealToDiscord,
  buildThreadName,
  isForumThreadError,
  isAttachmentRejection,
  discordForumFlagKey,
  fetchImageBlob
} from '../../features/share-discord.js';
import {
  formatDealMessage,
  forumRecipeFor,
  resolveShareFields
} from '../../features/discord-recipe.js';
import {
  extractShareData,
  extractDealer,
  extractDealerUrl,
  fetchProductInfo,
  resolveAmazonAsin
} from '../../page/product-offers.js';
import { showToast } from '../toast.js';
import { isShippingPriceActive, scheduleProcessListings, getDetailProductId } from '../../page/adapter.js';
import { buildTavilyQuery, fetchTavilySummary, getCachedTavily } from '../../features/tavily-search.js';

async function sendDealToChannel(channel, payload, stillFresh) {
  const hook = channel.url.trim();
  const flagKey = discordForumFlagKey(hook);
  const forum = _getValue(flagKey, false) === true;
  const { content, forumContent, threadName, png, productOpt } = payload;

  const postText = withThread => postDealToDiscord(hook, withThread ? forumContent : content, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });
  const postImage = withThread => postDealImageToDiscord(hook, withThread ? forumContent : content, png, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });

  const tryRound = async withThread => {
    if (!stillFresh()) throw Object.assign(new Error('stale-before-post'), { stale: true });
    if (png) {
      try {
        await postImage(withThread);
        return;
      } catch (imgErr) {
        if (isForumThreadError(imgErr)) {
          if (!withThread) throw imgErr;
        } else if (!isAttachmentRejection(imgErr)) {
          throw imgErr;
        }
      }
    }
    if (!stillFresh()) throw Object.assign(new Error('stale-before-post'), { stale: true });
    await postText(withThread);
  };

  for (const withThread of (forum ? [true, false] : [false, true])) {
    try {
      await tryRound(withThread);
      if (withThread !== forum) _setValue(flagKey, withThread);
      break;
    } catch (err) {
      if (!isForumThreadError(err) || withThread) throw err;
    }
  }
}

// Share dedupe surviving button re-renders: duplicate clicks for the same
// pid:basis:price post once (button disabled alone is not enough).
const shareInFlight = new Set();

/**
 * Shared Discord Deal Share Orchestrator
 * Works for both feed/search product cards and product detail pages.
 */
export async function triggerDiscordShare({
  card = null,
  pid: inputPid = null,
  cardPrice: inputPrice = 0,
  priceBasis: inputBasis = null,
  stats: inputStats = null,
  title: overrideTitle = '',
  url: overrideUrl = '',
  imageUrl: overrideImageUrl = '',
  dealer: overrideDealer = '',
  dealerUrl: overrideDealerUrl = '',
  offerCount: overrideOfferCount = 0,
  onDone = null,
  isDetailPage = false
} = {}) {
  const channels = getDiscordChannels().filter(c => isDiscordWebhookUrl(c.url));
  if (channels.length === 0) {
    showToast('Discord-Webhook fehlt – in den Einstellungen (⚙️) eintragen');
    onDone?.(false);
    return false;
  }

  let fresh = null;
  if (!isDetailPage && card) {
    fresh = extractCardData(card);
    const freshKind = fresh.displayDelta?.kind;
    if (!(fresh.dealScore || freshKind === 'new-low' || freshKind === 'at-low')) {
      showToast('Kein verifizierter Tiefstpreis mehr – Karte wird neu geprüft');
      scheduleProcessListings();
      onDone?.(false);
      return false;
    }
  }

  const pid = inputPid || fresh?.pid || (isDetailPage ? getDetailProductId() : null);
  const cardPrice = inputPrice || fresh?.cardPrice || 0;
  const cardPriceBasis = inputBasis || fresh?.cardPriceBasis || (isShippingPriceActive(card) ? 'shipping' : 'product');
  const stats = inputStats || fresh?.verifiedStats || null;
  const priceCents = priceToCents(cardPrice);

  const snap = { pid, priceCents, basis: cardPriceBasis };
  const stillFresh = () => {
    if (isDetailPage) {
      return !!(typeof document !== 'undefined' && getDetailProductId() === snap.pid);
    }
    if (!card || !card.isConnected) return false;
    const cur = extractCardData(card);
    if (cur.pid !== snap.pid || cur.cardPriceBasis !== snap.basis
      || priceToCents(cur.cardPrice) !== snap.priceCents) return false;
    const curKind = cur.displayDelta?.kind;
    return !!(cur.dealScore || curKind === 'new-low' || curKind === 'at-low');
  };

  const abortStale = () => {
    showToast(isDetailPage ? 'Produkt hat sich geändert – Seite wird aktualisiert' : 'Karte hat sich geändert – erneut prüfen');
    if (!isDetailPage) scheduleProcessListings();
  };

  const shareKey = `${snap.pid}:${snap.basis}:${snap.priceCents}`;
  if (shareInFlight.has(shareKey)) {
    showToast('Teilen läuft bereits');
    onDone?.(false);
    return false;
  }
  shareInFlight.add(shareKey);

  let preview = null;
  let readyPayload = null;
  let userComment = '';

  const shareData = extractShareData(card || document.body);
  const title = overrideTitle || shareData.title || '';
  const url = overrideUrl || shareData.url || (typeof location !== 'undefined' ? location.href : '');
  const imageUrl = overrideImageUrl || shareData.imageUrl || '';
  const priceText = cardPrice > 0 ? `CHF ${cardPrice.toFixed(2)}` : '';
  const useShipping = snap.basis ? snap.basis === 'shipping' : isShippingPriceActive(card);
  let dealer = overrideDealer || extractDealer(card || document.body, useShipping);
  let dealerUrl = overrideDealerUrl || extractDealerUrl(card || document.body, useShipping);
  const cachedDealer = getCachedDealer(snap.pid, useShipping);
  let loadedOffers = overrideOfferCount || fresh?.offerCount || cachedDealer?.offers || 0;
  let totalOffers = cachedDealer?.totalOffers || 0;
  let offers = totalOffers || loadedOffers;

  let currentFields = {
    title, url, priceText,
    dealer, dealerUrl, offerCount: offers,
    aiText: '',
    ...resolveShareFields(cardPrice, stats),
    suppressDealerEmbed: CONFIG.DISCORD_SUPPRESS_DEALER_EMBED !== false,
    suppressProductEmbed: CONFIG.DISCORD_SUPPRESS_PRODUCT_EMBED !== false
  };

  const onCommentChange = commentText => {
    userComment = commentText;
    return formatDealMessage({ ...currentFields, commentText }, CONFIG.DISCORD_LAYOUT);
  };

  const initialContent = formatDealMessage(currentFields, CONFIG.DISCORD_LAYOUT);

  const onCancel = () => {
    shareInFlight.delete(shareKey);
    onDone?.(false);
  };

  const onSend = async (targetChannel, controller, { comment } = {}) => {
    if (!readyPayload) return;
    const finalComment = comment ?? userComment;
    const finalFields = { ...currentFields, commentText: finalComment };
    const content = formatDealMessage(finalFields, CONFIG.DISCORD_LAYOUT);
    const forumContent = CONFIG.DISCORD_FORUM_TITLE ? content : formatDealMessage({ ...finalFields, forceLink: true }, forumRecipeFor(CONFIG.DISCORD_LAYOUT));
    const payloadToSend = {
      ...readyPayload,
      content,
      forumContent
    };
    try {
      await sendDealToChannel(targetChannel, payloadToSend, stillFresh);
      controller.close();
      shareInFlight.delete(shareKey);
      if (snap.pid && snap.priceCents > 0) setSharedDeal(snap.pid, snap.priceCents);
      showToast(`📤 Deal in #${targetChannel.name} geteilt`);
      onDone?.(stillFresh());
    } catch (err) {
      if (err?.stale) {
        controller.close();
        shareInFlight.delete(shareKey);
        onDone?.(false);
        abortStale();
      } else if (err?.status === 429) {
        controller.setError('⏳ Discord-Limit – später erneut versuchen');
      } else if (!err?.status) {
        controller.setError('⚠️ Übermittlung nicht bestätigt — bitte Verbindung prüfen');
      } else {
        controller.setError(err?.message ? `Fehler: ${err.message}` : 'Teilen fehlgeschlagen');
      }
    }
  };

  preview = openSharePreviewModal({
    channels,
    onSend,
    onCancel,
    onCommentChange,
    initialContent
  });

  // Background asset preparation runs in parallel with preview display
  (async () => {
    try {
      const productDl = imageUrl ? fetchImageBlob(imageUrl).catch(() => null) : null;
      let aiPromise = null;
      if (CONFIG.TAVILY_ENABLED && String(CONFIG.DISCORD_LAYOUT || '').includes('{ai}') && CONFIG.TAVILY_API_KEY && CONFIG.TAVILY_API_KEY.trim()) {
        const query = buildTavilyQuery(title, CONFIG.REVIEW_SEARCH_KEYWORD, priceText);
        const cached = getCachedTavily(query);
        if (cached?.answer) {
          aiPromise = Promise.resolve(cached.answer);
        } else {
          aiPromise = fetchTavilySummary(CONFIG.TAVILY_API_KEY, query, { timeoutMs: 4000 }).catch(() => '');
        }
      }
      if ((!dealer || !dealerUrl || !offers) && url) {
        const info = await fetchProductInfo(url, undefined, useShipping).catch(() => null);
        if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
        if (info) {
          dealer = dealer || info.dealer;
          dealerUrl = dealerUrl || info.dealerUrl;
          loadedOffers = loadedOffers || info.offers || 0;
          totalOffers = totalOffers || info.totalOffers || 0;
          offers = totalOffers || loadedOffers;
          if (info.dealer) {
            const dKey = `${snap.pid}:${useShipping ? 's' : 'p'}`;
            lruSet(dealerCache, dKey, { dealer: info.dealer, url: info.dealerUrl || '', offers: loadedOffers, totalOffers });
            setCachedDealer(snap.pid, useShipping, info.dealer, info.dealerUrl || '', undefined, loadedOffers, totalOffers);
          }
        }
      }
      const isAmazon = ((dealer && /amazon/i.test(dealer)) || (dealerUrl && /amazon\./i.test(dealerUrl))) && CONFIG.KEEPA_CHART_ENABLED !== false;
      let keepaDl = null;
      if (isAmazon) {
        keepaDl = (async () => {
          const asin = await resolveAmazonAsin(dealerUrl, snap.pid).catch(() => null);
          if (!asin) return null;
          const keepaUrl = buildKeepaUrl(asin);
          return keepaUrl ? fetchImageBlob(keepaUrl).catch(() => null) : null;
        })();
      }
      const series = stats?.timeSeries || [];
      const png = await renderSparklinePng(withLivePrice(series, cardPrice), 360, 100, title).catch(() => null);
      if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
      const keepaBlob = keepaDl ? await keepaDl : null;
      if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
      const aiText = aiPromise ? (await aiPromise) : '';
      if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
      currentFields = {
        ...currentFields,
        dealer, dealerUrl, offerCount: offers,
        aiText
      };
      const activeComment = preview?.getComment?.() ?? userComment;
      const content = formatDealMessage({ ...currentFields, commentText: activeComment }, CONFIG.DISCORD_LAYOUT);
      const forumContent = CONFIG.DISCORD_FORUM_TITLE ? content : formatDealMessage({ ...currentFields, commentText: activeComment, forceLink: true }, forumRecipeFor(CONFIG.DISCORD_LAYOUT));
      const threadName = buildThreadName(title);
      const productBlob = (png && productDl) ? await productDl : null;
      if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
      const productOpt = {
        ...(productBlob ? { productImageBlob: productBlob } : null),
        ...(imageUrl ? { productImageUrl: imageUrl } : null),
        ...(keepaBlob ? { keepaImageBlob: keepaBlob } : null)
      };
      readyPayload = {
        content,
        forumContent,
        threadName,
        png,
        productBlob,
        keepaBlob,
        productOpt
      };
      preview?.updateContent({
        formattedContent: content,
        chartBlob: png,
        productBlob,
        keepaBlob
      });
    } catch (err) {
      preview?.setError('Vorbereitung fehlgeschlagen');
    }
  })();

  return true;
}

// Discord 1-click share (step 7): verified lows only on cards.
export function renderShareButton(ctx, cd) {
  const { card } = ctx;
  const basisOk = cd?.basisMatches ?? basisMatchesFor(ctx.stats, cd?.cardPriceBasis);
  const kindNow = ctx.displayDelta?.kind ?? (basisOk ? getDisplayDelta(ctx.cardPrice, ctx.stats).kind : 'unknown');
  const isShareable = !!(ctx.dealData || kindNow === 'new-low' || kindNow === 'at-low');
  let shareBtn = card.querySelector(':scope > .tp-share-btn');
  if (isShareable) {
    if (!shareBtn) {
      shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'tp-share-btn';
      shareBtn.textContent = '📤';
      shareBtn.title = 'Tiefstpreis in Discord teilen';
      shareBtn.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();
        shareBtn.disabled = true;
        await triggerDiscordShare({
          card,
          onDone: stillFresh => {
            shareBtn.disabled = false;
            if (stillFresh) shareBtn.classList.add('tp-share-done');
          }
        });
      });
      if (card.style.position === '' && getComputedStyle(card).position === 'static') card.style.position = 'relative';
      card.appendChild(shareBtn);
    }
    shareBtn.style.display = '';
    shareBtn.classList.toggle('tp-share-done', !!(ctx.pid && ctx.cardPrice > 0 && getSharedDeal(ctx.pid, priceToCents(ctx.cardPrice))));
  } else {
    shareBtn?.remove();
  }
}
