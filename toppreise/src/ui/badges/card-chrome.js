/**
 * Card chrome (split from ui/badges.js): sparkline row, verified cue, share
 * button, dealer name, review button, fresh glow, empty state — plus the
 * renderCardEffects orchestrator (signature frozen, app.js untouched).
 */

import { CONFIG, updateConfig, updateConfigs, _getValue, _setValue, sanitizeReviewKeyword, realDealMinDiscount } from '../../state/config.js';
import { getDisplayDelta, getHeatInput, computeDealScore } from '../../domain/deal-score.js';
import { basisMatchesFor, extractCardData } from '../../page/cards.js';
import { getCachedDealer, setCachedDealer, lruSet, getSharedDeal, setSharedDeal, hasUsablePriceStats } from '../../scanner/cache.js';
import { priceToCents } from '../../domain/price.js';
import { isDiscordWebhookUrl, formatDealMessage, forumRecipeFor, resolveShareFields, extractShareData, extractDealer, extractDealerUrl, sparklineText, withLivePrice, fetchProductInfo, fetchImageBlob, renderSparklinePng, postDealImageToDiscord, postDealToDiscord, buildThreadName, isForumThreadError, isAttachmentRejection, discordForumFlagKey } from '../../features/share-discord.js';
import { showToast } from '../toast.js';
import { renderSparkline, openSparklinePopout } from '../sparkline.js';
import { isShippingPriceActive, scheduleProcessListings } from '../../page/adapter.js';
import { scanState } from '../../state/store.js';
import { startBatchCheck } from '../floating-cta.js';
import { setTextIfChanged, setTitleIfChanged } from './dom-helpers.js';
import { dealerCache, dealerPending, dealerHydrated, dealerAutoTried, renderHeat, renderFilterVerdict } from './deal-badge.js';
import { renderBadgeVerdict } from './deal-verdict.js';

// Mini price-trend sparkline + history strip (step 5).
export function renderSparklineRow(ctx) {
  const { card, cardPrice, cardPriceEl, stats } = ctx;
  // 5. Mini Price-Trend Sparkline + history strip (card-level bottom row:
  // pill spans from the share-button zone to the card's right edge, using
  // full card width instead of the narrow price-info column).
  const hasSeries = CONFIG.ENABLE_SPARKLINES && stats && Array.isArray(stats.timeSeries) && stats.timeSeries.length >= 2;
  let sparkContainer = hasSeries ? card.querySelector('.tp-sparkline-container') : null;
  if (hasSeries) {
    if (!sparkContainer) {
      sparkContainer = document.createElement('div');
      sparkContainer.className = 'tp-sparkline-container';
    }
    // Click pops the full Discord-style chart (same series incl. live price).
    sparkContainer._tpSeries = withLivePrice(stats.timeSeries, cardPrice);
    // Revision-aware: same length/price/median with refreshed points (new
    // fetch, recomputed median) must rebuild instead of showing stale art.
    const lastTs = stats.timeSeries.length ? +stats.timeSeries[stats.timeSeries.length - 1][0] || 0 : 0;
    const sig = [stats.timeSeries.length, priceToCents(cardPrice), priceToCents(stats.medianPrice ?? 0), stats.time || 0, lastTs].join(':');
    sparkContainer.style.cursor = 'pointer';
    sparkContainer.setAttribute('role', 'button');
    sparkContainer.setAttribute('tabindex', '0');
    sparkContainer.setAttribute('title', 'Preisverlauf vergrössern');
    if (!sparkContainer.dataset.tpPopoutBound) {
      sparkContainer.dataset.tpPopoutBound = 'true';
      sparkContainer.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        openSparklinePopout(sparkContainer._tpSeries);
      });
      sparkContainer.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          openSparklinePopout(sparkContainer._tpSeries);
        }
      });
    }
    if (sparkContainer.dataset.tpSparkSig !== sig) {
      sparkContainer.dataset.tpSparkSig = sig;
      const svg = renderSparkline(sparkContainer._tpSeries, 44, 13);
      if (svg) {
        sparkContainer.replaceChildren();
        sparkContainer.appendChild(svg);
      }
    }
  } else {
    card.querySelector('.tp-sparkline-container')?.remove();
  }
  const histPriceEl = card.querySelector('.tp-card-historical-price');
  if (histPriceEl) {
    let subRow = card.querySelector('.tp-card-subline-row');
    if (!subRow) {
      subRow = document.createElement('div');
      subRow.className = 'tp-card-subline-row';
      card.appendChild(subRow);
      subRow.appendChild(histPriceEl);
    } else if (histPriceEl.parentElement !== subRow) {
      subRow.insertBefore(histPriceEl, subRow.firstChild);
    }
    if (sparkContainer && sparkContainer.parentElement !== subRow) {
      subRow.appendChild(sparkContainer);
    }
  } else {
    card.querySelector('.tp-card-subline-row')?.remove();
    if (sparkContainer) {
      const priceContainer = card.querySelector('.Plugin_PriceInformation, .price_information_product') ||
                             cardPriceEl?.closest('.priceContainer, .Plugin_PriceInformation, .price_information_product') ||
                             cardPriceEl?.parentElement ||
                             card;
      if (sparkContainer.parentElement !== priceContainer) {
        priceContainer.appendChild(sparkContainer);
      }
    }
  }
}

// Badge verified/unverified cue (step 6).
export function applyVerifiedCue(ctx) {
  const { card, stats } = ctx;
  // 6. Badge geprüft/ungeprüft cue (always on): striped-gray ribbon when
  // unchecked, solid heat ribbon when verified. Loading badge gets neither.
  const badgeEl = card.querySelector('.badge-dif, [class*="badge-dif"]');
  if (badgeEl) {
    if (badgeEl.classList.contains('tp-deal-loading')) {
      badgeEl.classList.remove('tp-is-unverified', 'tp-is-verified');
    } else if (!hasUsablePriceStats(stats)) {
      // Negative markers ({unavailable:true}) and thin histories are not
      // verified — truthiness of the stats object must not imply quality.
      badgeEl.classList.add('tp-is-unverified');
      badgeEl.classList.remove('tp-is-verified');
    } else {
      badgeEl.classList.add('tp-is-verified');
      badgeEl.classList.remove('tp-is-unverified');
    }
  }
}

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
      shareBtn.title = 'Deal in Discord teilen';
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
          return cur.pid === snap.pid && cur.cardPriceBasis === snap.basis
            && priceToCents(cur.cardPrice) === snap.priceCents;
        };
        const abortStale = () => {
          showToast('Karte hat sich geändert – erneut prüfen');
          scheduleProcessListings();
        };
        shareBtn.disabled = true;
        try {
          try {
            const { title, url, imageUrl } = extractShareData(card);
            const productDl = imageUrl ? fetchImageBlob(imageUrl).catch(() => null) : null;
            const priceText = fresh.cardPrice > 0 ? `CHF ${fresh.cardPrice.toFixed(2)}` : '';
            let dealer = extractDealer(card);
            let dealerUrl = extractDealerUrl(card);
            let offers = fresh.offerCount || getCachedDealer(snap.pid, isShippingPriceActive(card))?.offers || 0;
            if ((!dealer || !dealerUrl || !offers) && url) {
              const info = await fetchProductInfo(url, undefined, isShippingPriceActive(card)).catch(() => null);
              if (!stillFresh()) { abortStale(); return; }
              if (info) { dealer = dealer || info.dealer; dealerUrl = dealerUrl || info.dealerUrl; offers = offers || info.offers; }
            }
            const png = await renderSparklinePng(withLivePrice(fresh.stats?.timeSeries, fresh.cardPrice)).catch(() => null);
            if (!stillFresh()) { abortStale(); return; }
            const fields = {
              title, url, priceText,
              dealer, dealerUrl, offerCount: offers,
              spark: sparklineText(withLivePrice(fresh.stats?.timeSeries, fresh.cardPrice)),
              ...resolveShareFields(fresh.cardPrice, fresh.stats),
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
            const productOpt = productBlob ? { productImageBlob: productBlob } : (imageUrl ? { productImageUrl: imageUrl } : null);
            const postText = withThread => postDealToDiscord(hook, withThread ? forumContent : content, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });
            const postImage = withThread => postDealImageToDiscord(hook, withThread ? forumContent : content, png, { ...(withThread ? { threadName } : null), ...(productOpt || {}) });
            const tryRound = async withThread => {
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
            if (!stillFresh()) { abortStale(); return; }
            showToast('📤 Deal in Discord geteilt');
            if (snap.pid && snap.priceCents > 0) { setSharedDeal(snap.pid, snap.priceCents); shareBtn.classList.add('tp-share-done'); }
          } catch (err) {
            if (err?.status === 429) showToast('⏳ Discord-Limit – später erneut versuchen');
            else if (!err?.status) showToast('⚠️ Übermittlung nicht bestätigt — bitte prüfen');
            else showToast('📤 Teilen fehlgeschlagen');
          }
        } finally {
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

// Dealer name left of price (step 8). Owns the loadDealer closure.
export function renderDealerName(ctx, filters) {
  const { card, pid, cardPriceEl, stats } = ctx;
  // 8. Händlername links neben dem Preis: nur geprüfte Karten (stats != null).
  // Katalog löst synchron aus extractDealer (kein Fetch); Feed ohne DOM-Zeile
  // bekommt einen 🏬-Button, der fetchProductInfo einmalig pro pid:Modus holt
  // (dealerCache + dealerPending-Guard) und danach neu rendert — oder bei
  // DEALER_AUTOFETCH denselben Loader ohne Klick (1×/Pageload, max. 3 parallel).
  // Der Name verlinkt direkt aufs Händlerangebot (/ext_de aus dem Fetch bzw.
  // Zeilenlink), Fallback ist die Produktseite — immer neuer Tab.
  const dealerEl = card.querySelector('.tp-dealer-name');
  if (!stats || !pid) {
    dealerEl?.remove();
  } else {
    const useShipping = isShippingPriceActive(card);
    const dKey = `${pid}:${useShipping ? 's' : 'p'}`;
    let dealer = extractDealer(card);
    if (!dealer && !dealerCache.has(dKey) && !dealerHydrated.has(dKey)) {
      if (dealerHydrated.size > 1000) dealerHydrated.clear();
      dealerHydrated.add(dKey);
      const stored = getCachedDealer(pid, useShipping);
      if (stored?.dealer) lruSet(dealerCache, dKey, stored);
    }
    const cached = dealerCache.get(dKey);
    if (!dealer && cached?.dealer) dealer = cached.dealer;
    const { url: productUrl } = extractShareData(card);
    const directUrl = cached?.url || (dealer ? extractDealerUrl(card) : '');
    const targetUrl = directUrl || productUrl || '';
    const hasUrl = /^https?:\/\//i.test(targetUrl);
    const anchor = (cardPriceEl?.parentElement?.contains(cardPriceEl) && cardPriceEl.parentElement) ||
      card.querySelector('.Plugin_PriceInformation, .price_information_product') || card;
    const place = el => {
      el.dataset.tpDealerPid = dKey;
      // Prepend: links vom "ab CHF"-Prefix. insertBefore(cardPriceEl) landete
      // dahinter (cardPriceEl ist nur die Zahl) und spaltete Prefix von Zahl.
      if (anchor !== card) anchor.insertBefore(el, anchor.firstChild);
      else anchor.appendChild(el);
    };
    if (dealer) {
      let el = dealerEl?.dataset.tpDealerPid === dKey ? dealerEl : null;
      if (el && ((el.tagName === 'A') !== hasUrl)) { el.remove(); el = null; }
      if (!el) {
        dealerEl?.remove();
        el = document.createElement(hasUrl ? 'a' : 'span');
        el.className = 'tp-dealer-name';
        if (hasUrl) { el.href = targetUrl; el.target = '_blank'; el.rel = 'noopener'; el.addEventListener('click', e => e.stopPropagation()); }
        place(el);
      } else if (el.tagName === 'A' && hasUrl && el.getAttribute('href') !== targetUrl) {
        el.href = targetUrl;
      }
      setTextIfChanged(el, `🏬 ${dealer}`);
      setTitleIfChanged(el, directUrl && hasUrl ? `Günstigster Händler: ${dealer} — direkt zum Angebot` : `Günstigster Händler: ${dealer}`);
    } else if (hasUrl && !dealerCache.has(dKey)) {
      // Ein Loader für Klick + Auto-Fetch: Produktseite einmalig pro pid:Modus
      // (dealerPending-Guard), Ergebnis in Memory + localStorage, danach Render.
      const loadDealer = async () => {
        if (dealerPending.has(dKey)) return;
        dealerPending.add(dKey);
        try {
          const info = await fetchProductInfo(productUrl, undefined, isShippingPriceActive(card)).catch(() => null);
          if (info?.dealer) { lruSet(dealerCache, dKey, { dealer: info.dealer, url: info.dealerUrl || '', offers: info.offers || 0 }); setCachedDealer(pid, useShipping, info.dealer, info.dealerUrl || '', undefined, info.offers || 0); }
        } finally {
          dealerPending.delete(dKey);
        }
        scheduleProcessListings();
      };
      let btn = dealerEl?.dataset.tpDealerPid === dKey && dealerEl.tagName === 'BUTTON' ? dealerEl : null;
      if (!btn) {
        dealerEl?.remove();
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tp-dealer-name tp-dealer-btn';
        btn.textContent = '🏬';
        btn.setAttribute('aria-label', 'Händler laden');
        btn.title = 'Günstigsten Händler laden (lädt die Produktseite einmalig)';
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          btn.disabled = true;
          loadDealer();
        });
        place(btn);
      } else if (!dealerPending.has(dKey) && btn.disabled) {
        btn.disabled = false;
      }
      // Opt-in (aus, Standard): Händler ohne Klick laden. Ein Versuch pro
      // pid:Modus und Pageload (Fehler → Button für manuellen Retry), max. 3
      // parallele Fetches — fertige lösen per triggerProcessListings die
      // nächste Staffel aus (Kaskade statt Request-Sturm).
      if (!filters?.isFiltered && CONFIG.DEALER_AUTOFETCH === true && !dealerAutoTried.has(dKey) && !dealerPending.has(dKey) && dealerPending.size < 3) {
        dealerAutoTried.add(dKey);
        btn.disabled = true;
        loadDealer();
      }
    } else {
      dealerEl?.remove();
    }
  }
}

// Review search on product name (step 9).
export function renderReviewButton(ctx) {
  const { card } = ctx;
  // 9. Review-Suche (🌐) am Produktnamen: Ansicht, immer wenn aktiviert.
  // Titelquelle ist extractShareData (single source of truth, kein 2. Parser).
  const reviewName = (extractShareData(card).title || '').replace(/\s+/g, ' ').trim();
  if (CONFIG.REVIEW_SEARCH_ENABLED !== false && reviewName) {
    const reviewKw = sanitizeReviewKeyword(CONFIG.REVIEW_SEARCH_KEYWORD);
    const aiMode = CONFIG.REVIEW_SEARCH_AI_MODE === true;
    let reviewBtn = card.querySelector('.tp-review-search-btn');
    if (!reviewBtn) {
      reviewBtn = document.createElement('a');
      reviewBtn.className = 'tp-review-search-btn';
      reviewBtn.textContent = '🌐';
      reviewBtn.target = '_blank';
      reviewBtn.rel = 'noopener';
      reviewBtn.addEventListener('click', e => e.stopPropagation());
    }
    reviewBtn.href = 'https://www.google.com/search?q=' + encodeURIComponent(`${reviewName} ${reviewKw}`) + (aiMode ? '&udm=50' : '');
    setTitleIfChanged(reviewBtn, `Google-Suche: ${reviewName} ${reviewKw}${aiMode ? ' (KI-Modus)' : ''}`);
    reviewBtn.setAttribute('aria-label', `Google-Suche: ${reviewName} ${reviewKw}${aiMode ? ' (KI-Modus)' : ''}`);
    const titleEl = card.querySelector('.product-name, .productDetails, .bold, a[title]');
    if (titleEl && titleEl.tagName !== 'A' && reviewBtn.parentElement !== titleEl) titleEl.appendChild(reviewBtn);
    else if (titleEl && titleEl.tagName === 'A') {
      // The variant deal pill owns the slot directly after the title
      // (.bold + .tp-deal-pill); park the review button behind it so the
      // two inserters settle instead of ping-ponging every render pass.
      const anchor = titleEl.nextElementSibling?.classList?.contains('tp-deal-pill') ? titleEl.nextElementSibling : titleEl;
      if (reviewBtn.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', reviewBtn);
    }
    else if (!titleEl && reviewBtn.parentElement !== card) card.appendChild(reviewBtn);
  } else {
    card.querySelector('.tp-review-search-btn')?.remove();
  }
}

// Fresh-deal glow for newly verified good deals.
export function applyFreshGlow(ctx) {
  const { card, pid, stats } = ctx;
  // Fresh-deal glow: only newly verified good deals pulse. The badge verdict
  // above is the single source of truth for "good deal" — no duplicate math.
  const freshBadge = card.querySelector('.tp-deal-new-record, .tp-deal-alltime-low');
  const isFresh = !!stats && scanState.freshPids.has(pid) && !!freshBadge;
  card.classList.toggle('tp-deal-fresh', isFresh);
}

export function renderEmptyState(cards, counts) {
  let emptyNotice = document.getElementById('tp-empty-state-notice');

  const totalHidden = counts.filteredCount || 0;

  // Filtern removes cards: empty state whenever all cards are removed.
  if (cards.length > 0 && totalHidden >= cards.length) {
    // Static notice: skip rebuild + listener re-bind when nothing changed
    const emptySig = `${cards.length}:${totalHidden}:${counts.uncheckedDeals || 0}:${realDealMinDiscount()}`;
    if (emptyNotice?.dataset.tpEmptySig === emptySig) return;
    if (!emptyNotice) {
      emptyNotice = document.createElement('div');
      emptyNotice.id = 'tp-empty-state-notice';
      emptyNotice.className = 'tp-empty-state-notice';
      const listParent = cards[0]?.parentElement;
      if (listParent) {
        listParent.insertBefore(emptyNotice, listParent.firstChild);
      }
    }
    const minDisc = realDealMinDiscount();
    emptyNotice.innerHTML = `
      <div>🚫 <strong>Alle ${cards.length} Angebote auf dieser Seite sind durch aktive Filter ausgeblendet.</strong></div>
      <div class="tp-empty-state-actions">
        ${counts.uncheckedDeals > 0 ? `<button class="tp-empty-state-btn" id="tp-empty-check-deals-btn" style="border-color: #3b82f6; color: #2563eb;" title="Prüft Differenzen ≥ ${minDisc}% (ungeprüft ≠ Tiefstpreis)">🔍 Tiefstpreise prüfen (≥${minDisc}%)</button>` : ''}
        ${(counts.uncheckedDeals || 0) > 0 || CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? `<button class="tp-empty-state-btn" id="tp-empty-hide-unchecked-btn" title="${CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? `✓ Ungeprüfte aktiv ausgeblendet (${counts.uncheckedHidden || 0}) – klicken zum Aufheben` : `Ungeprüfte ausblenden (${counts.uncheckedHidden || 0}) – entfernt sie aus der Liste`}">${CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? 'Alle anzeigen' : 'Ungeprüfte ausblenden'}</button>` : ''}
        <button class="tp-empty-state-btn" id="tp-empty-toggle-filters-btn">⚡ Filter ausschalten</button>
      </div>
    `;

    emptyNotice.dataset.tpEmptySig = emptySig;
    emptyNotice.querySelector('#tp-empty-check-deals-btn')?.addEventListener('click', () => {
      // Toolbar batch button removed: the floating CTA owns this action now.
      // startBatchCheck works even when the pill is collapsed or auto-hidden.
      startBatchCheck();
    });
    emptyNotice.querySelector('#tp-empty-hide-unchecked-btn')?.addEventListener('click', () => {
      const next = !CONFIG.BESTPREISE_HIDE_UNCHECKED;
      updateConfig('BESTPREISE_HIDE_UNCHECKED', next);
      showToast(next ? '✓ Ungeprüfte werden ausgeblendet (Filtergrund, entfernt)' : '✓ Ungeprüfte aus — alle werden wieder angezeigt');
    });

    emptyNotice.querySelector('#tp-empty-toggle-filters-btn')?.addEventListener('click', () => {
      updateConfigs({ FILTER_NEG_ENABLED: false, FILTER_MIN_ENABLED: false, BESTPREISE_HIDE_UNCHECKED: false, BESTPREISE_INCLUDE_VORTIEF: true, DEALER_MODE: 'dim' });
      showToast('⏸️ Alle Filter pausiert (alle Angebote sichtbar)');
    });
  } else if (emptyNotice) {
    emptyNotice.remove();
  }
}

// Orchestrator (signature frozen — app.js untouched): builds ctx once,
// paints heat + verdict, then chrome steps in the original order.
export function renderCardEffects(cd, filters, isNeueFeed, activeStores) {
  const { card, pid, cardPriceEl, cardPrice, cardPriceBasis, basisMatches, stats, diffVal } = cd;
  // Rejected verdicts (null) stay rejected: only an uncalculated verdict
  // (undefined, e.g. a partial struct) may compute — and only on a matching basis.
  const basisOk = basisMatches ?? basisMatchesFor(stats, cardPriceBasis);
  const displayDelta = cd.displayDelta ?? (basisOk ? getDisplayDelta(cardPrice, stats) : { kind: 'unknown' });
  const dealData = cd.dealScore === undefined && basisOk ? computeDealScore(stats, cardPrice) : (cd.dealScore ?? null);
  const heatMode = CONFIG.BESTPREISE_MODE_ACTIVE ? 'bestpreise' : 'browse';
  const heatInfo = getHeatInput(cardPrice, stats, diffVal, heatMode, dealData);
  const effectiveDiff = heatInfo.value;
  const ctx = { card, pid, cardPrice, cardPriceEl, stats, diffVal, dealData, displayDelta, heatInfo, effectiveDiff };
  renderHeat(ctx);
  renderFilterVerdict(ctx, filters, activeStores);
  renderBadgeVerdict(ctx, filters, isNeueFeed);
  renderSparklineRow(ctx);
  applyVerifiedCue(ctx);
  renderShareButton(ctx, cd);
  renderDealerName(ctx, filters);
  renderReviewButton(ctx);
  applyFreshGlow(ctx);
}
