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
import { priceToCents } from '../../domain/price.js';
import { openSharePreviewModal } from '../modal-share-preview.js';
import {
  isDiscordWebhookUrl,
  formatDealMessage,
  forumRecipeFor,
  resolveShareFields,
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
  extractShareData,
  extractDealer,
  extractDealerUrl,
  fetchProductInfo
} from '../../page/product-offers.js';
import { showToast } from '../toast.js';
import { isShippingPriceActive, scheduleProcessListings } from '../../page/adapter.js';
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

// Discord 1-click share (step 7): verified lows only.
export function renderShareButton(ctx, cd) {
  const { card } = ctx;
  // 7. Discord 1-Klick-Share (nur verifizierte Tiefstpreise, nie Schein-Rabatte).
  // Render-time gate from the basis-guarded ctx; the click handler below
  // re-resolves everything from the live card — never from this closure.
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
        const channels = getDiscordChannels().filter(c => isDiscordWebhookUrl(c.url));
        if (channels.length === 0) {
          showToast('Discord-Webhook fehlt – in den Einstellungen (⚙️) eintragen');
          return;
        }
        // Click-time resolve: the card may have been reused or repainted
        // since render — shareability is re-derived from the live card.
        const fresh = extractCardData(card);
        const freshKind = fresh.displayDelta?.kind;
        if (!(fresh.dealScore || freshKind === 'new-low' || freshKind === 'at-low')) {
          showToast('Kein verifizierter Tiefstpreis mehr – Karte wird neu geprüft');
          scheduleProcessListings();
          return;
        }
        const snap = { pid: fresh.pid, priceCents: priceToCents(fresh.cardPrice), basis: fresh.cardPriceBasis };
        const stillFresh = () => {
          if (!card.isConnected) return false;
          const cur = extractCardData(card);
          if (cur.pid !== snap.pid || cur.cardPriceBasis !== snap.basis
            || priceToCents(cur.cardPrice) !== snap.priceCents) return false;
          // Shareability can lapse while price/pid/basis hold (cache
          // eviction): re-derive the click-time verdict so the green paint
          // never rewards a deal that is no longer verifiable.
          const curKind = cur.displayDelta?.kind;
          return !!(cur.dealScore || curKind === 'new-low' || curKind === 'at-low');
        };
        const abortStale = () => {
          showToast('Karte hat sich geändert – erneut prüfen');
          scheduleProcessListings();
        };
        const shareKey = `${snap.pid}:${snap.basis}:${snap.priceCents}`;
        if (shareInFlight.has(shareKey)) { showToast('Teilen läuft bereits'); return; }
        shareInFlight.add(shareKey);
        shareBtn.disabled = true;

        let preview = null;
        let readyPayload = null;

        const onCancel = () => {
          shareInFlight.delete(shareKey);
          shareBtn.disabled = false;
        };

        const onSend = async (targetChannel, controller) => {
          if (!readyPayload) return;
          try {
            await sendDealToChannel(targetChannel, readyPayload, stillFresh);
            controller.close();
            shareInFlight.delete(shareKey);
            shareBtn.disabled = false;
            if (snap.pid && snap.priceCents > 0) setSharedDeal(snap.pid, snap.priceCents);
            showToast(`📤 Deal in #${targetChannel.name} geteilt`);
            if (stillFresh()) shareBtn.classList.add('tp-share-done');
            else { showToast('📤 Deal geteilt – Karte hat sich danach geändert'); scheduleProcessListings(); }
          } catch (err) {
            if (err?.stale) {
              controller.close();
              shareInFlight.delete(shareKey);
              shareBtn.disabled = false;
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

        const { title, url, imageUrl } = extractShareData(card);
        const priceText = fresh.cardPrice > 0 ? `CHF ${fresh.cardPrice.toFixed(2)}` : '';

        preview = openSharePreviewModal({
          channels,
          onSend,
          onCancel
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
            const useShipping = snap.basis ? snap.basis === 'shipping' : isShippingPriceActive(card);
            let dealer = extractDealer(card, useShipping);
            let dealerUrl = extractDealerUrl(card, useShipping);
            const cachedDealer = getCachedDealer(snap.pid, useShipping);
            let loadedOffers = fresh.offerCount || cachedDealer?.offers || 0;
            let totalOffers = cachedDealer?.totalOffers || 0;
            let offers = totalOffers || loadedOffers;
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
            const png = await renderSparklinePng(withLivePrice(fresh.verifiedStats?.timeSeries, fresh.cardPrice), 360, 100, title).catch(() => null);
            if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
            const aiText = aiPromise ? (await aiPromise) : '';
            if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
            const fields = {
              title, url, priceText,
              dealer, dealerUrl, offerCount: offers,
              aiText,
              ...resolveShareFields(fresh.cardPrice, fresh.verifiedStats),
              suppressDealerEmbed: CONFIG.DISCORD_SUPPRESS_DEALER_EMBED !== false,
              suppressProductEmbed: CONFIG.DISCORD_SUPPRESS_PRODUCT_EMBED !== false
            };
            const content = formatDealMessage(fields, CONFIG.DISCORD_LAYOUT);
            const forumContent = CONFIG.DISCORD_FORUM_TITLE ? content : formatDealMessage({ ...fields, forceLink: true }, forumRecipeFor(CONFIG.DISCORD_LAYOUT));
            const threadName = buildThreadName(title);
            const productBlob = (png && productDl) ? await productDl : null;
            if (!stillFresh()) { abortStale(); preview?.close(); onCancel(); return; }
            const productOpt = {
              ...(productBlob ? { productImageBlob: productBlob } : null),
              ...(imageUrl ? { productImageUrl: imageUrl } : null)
            };
            readyPayload = {
              content,
              forumContent,
              threadName,
              png,
              productBlob,
              productOpt
            };
            preview?.updateContent({
              formattedContent: content,
              chartBlob: png,
              productBlob
            });
          } catch (err) {
            preview?.setError('Vorbereitung fehlgeschlagen');
          }
        })();
      });
      // Eigener Positioning-Kontext: Host-CSS garantiert kein relative (ausser .tp-is-cheapest).
      if (card.style.position === '' && getComputedStyle(card).position === 'static') card.style.position = 'relative';
      card.appendChild(shareBtn);
    }
    shareBtn.style.display = '';
    shareBtn.classList.toggle('tp-share-done', !!(ctx.pid && ctx.cardPrice > 0 && getSharedDeal(ctx.pid, priceToCents(ctx.cardPrice))));
  } else {
    shareBtn?.remove();
  }
}
