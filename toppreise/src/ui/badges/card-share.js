/**
 * Card Share Button
 * Discord 1-Click share button, click-time freshness validation, payload construction,
 * image/forum transport orchestration, and feedback toasts.
 */

import { CONFIG, _getValue, _setValue } from '../../state/config.js';
import { getDisplayDelta } from '../../domain/deal-score.js';
import { basisMatchesFor, extractCardData } from '../../page/cards.js';
import { getCachedDealer, getSharedDeal, setSharedDeal } from '../../scanner/cache.js';
import { priceToCents } from '../../domain/price.js';
import {
  isDiscordWebhookUrl,
  formatDealMessage,
  forumRecipeFor,
  resolveShareFields,
  sparklineText,
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
        const hook = (CONFIG.DISCORD_WEBHOOK_URL || '').trim();
        if (!isDiscordWebhookUrl(hook)) {
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
        try {
          try {
            const { title, url, imageUrl } = extractShareData(card);
            const productDl = imageUrl ? fetchImageBlob(imageUrl).catch(() => null) : null;
            const priceText = fresh.cardPrice > 0 ? `CHF ${fresh.cardPrice.toFixed(2)}` : '';
            let dealer = extractDealer(card, isShippingPriceActive(card));
            let dealerUrl = extractDealerUrl(card, isShippingPriceActive(card));
            // Geladen (page-1) vs. total (JSON-LD-Aggregat): Anzeige/Share
            // nutzen das Total, fällts zurück auf die geladene Anzahl.
            const cachedDealer = getCachedDealer(snap.pid, isShippingPriceActive(card));
            let loadedOffers = fresh.offerCount || cachedDealer?.offers || 0;
            let totalOffers = cachedDealer?.totalOffers || 0;
            let offers = totalOffers || loadedOffers;
            if ((!dealer || !dealerUrl || !offers) && url) {
              const info = await fetchProductInfo(url, undefined, isShippingPriceActive(card)).catch(() => null);
              if (!stillFresh()) { abortStale(); return; }
              if (info) {
                dealer = dealer || info.dealer;
                dealerUrl = dealerUrl || info.dealerUrl;
                loadedOffers = loadedOffers || info.offers || 0;
                totalOffers = totalOffers || info.totalOffers || 0;
                offers = totalOffers || loadedOffers;
              }
            }
            const png = await renderSparklinePng(withLivePrice(fresh.verifiedStats?.timeSeries, fresh.cardPrice)).catch(() => null);
            if (!stillFresh()) { abortStale(); return; }
            const fields = {
              title, url, priceText,
              dealer, dealerUrl, offerCount: offers,
              spark: sparklineText(withLivePrice(fresh.verifiedStats?.timeSeries, fresh.cardPrice)),
              ...resolveShareFields(fresh.cardPrice, fresh.verifiedStats),
              suppressDealerEmbed: CONFIG.DISCORD_SUPPRESS_DEALER_EMBED !== false,
              suppressProductEmbed: CONFIG.DISCORD_SUPPRESS_PRODUCT_EMBED !== false
            };
            const content = formatDealMessage(fields, CONFIG.DISCORD_LAYOUT);
            const forumContent = CONFIG.DISCORD_FORUM_TITLE ? content : formatDealMessage({ ...fields, forceLink: true }, forumRecipeFor(CONFIG.DISCORD_LAYOUT));
            const threadName = buildThreadName(title);
            const flagKey = discordForumFlagKey(hook);
            const forum = _getValue(flagKey, false) === true;
            // Produkt-Bytes laufen parallel zu Händlerfetch + Chart-Render (oben
            // gestartet): gelingt der Download nicht, bleibt das URL-Embed als Fallback.
            const productBlob = (png && productDl) ? await productDl : null;
            if (!stillFresh()) { abortStale(); return; }
            const productOpt = {
              ...(productBlob ? { productImageBlob: productBlob } : null),
              ...(imageUrl ? { productImageUrl: imageUrl } : null)
            };
            const postText = withThread => postDealToDiscord(hook, withThread ? forumContent : content, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });
            const postImage = withThread => postDealImageToDiscord(hook, withThread ? forumContent : content, png, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });
            const tryRound = async withThread => {
              // Never post for a changed card: the snapshot price/dealer
              // would no longer match what the user clicked.
              if (!stillFresh()) throw Object.assign(new Error('stale-before-post'), { stale: true });
              if (png) {
                try { await postImage(withThread); return; }
                catch (imgErr) {
                  if (isForumThreadError(imgErr)) {
                    if (!withThread) throw imgErr; // plain image hit forum: skip plain text, outer handler goes threaded
                    /* threaded image rejected: fall through to threaded text */
                  } else if (!isAttachmentRejection(imgErr)) {
                    throw imgErr; // ambiguous (429/timeout/network): never auto-post text — could duplicate
                  }
                  /* definite attachment rejection: fall through to text, same round */
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
                // plain round hit forum → loop continues threaded
              }
            }
            // Delivery happened: record the snapshot and toast success even
            // if the card changed mid-post — only the green paint is gated.
            if (snap.pid && snap.priceCents > 0) setSharedDeal(snap.pid, snap.priceCents);
            showToast('📤 Deal in Discord geteilt');
            if (stillFresh()) shareBtn.classList.add('tp-share-done');
            else { showToast('📤 Deal geteilt – Karte hat sich danach geändert'); scheduleProcessListings(); }
          } catch (err) {
            if (err?.stale) { abortStale(); }
            else if (err?.status === 429) showToast('⏳ Discord-Limit – später erneut versuchen');
            else if (!err?.status) showToast('⚠️ Übermittlung nicht bestätigt — bitte prüfen');
            else showToast('📤 Teilen fehlgeschlagen');
          }
        } finally {
          shareInFlight.delete(shareKey);
          shareBtn.disabled = false;
        }
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
