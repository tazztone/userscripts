/**
 * Batch Execution Runners & Single-Flight Job Controller
 * Handles bounded concurrent dealer fetches, sequential price alarms,
 * Google AI / OpenRouter searches, tab opening, Discord batch share,
 * and Toppreise native comparison (max 4, toggle-safe).
 */

import { CONFIG } from '../state/config.js';
import { getOriginCooldownUntil, fetchWithTimeout } from '../state/net.js';
import { SELECTORS } from '../page/selectors.js';
import { isShippingPriceActive } from '../page/adapter.js';
import { fetchProductInfo, extractDealer } from '../page/product-offers.js';
import { getCachedDealer, setCachedDealer, getCachedPriceStats, getSharedDeal, setSharedDeal, fullSeries } from '../scanner/cache.js';
import { priceToCents } from '../domain/price.js';
import { formatDealMessage, forumRecipeFor, resolveShareFields } from './discord-recipe.js';
import { withLivePrice, renderSparklinePng, fetchImageBlob, buildThreadName } from './share-discord.js';
import { sendDealToChannel } from '../ui/badges/card-share.js';
import { formatSearchQuery, buildTavilyQuery } from './tavily-search.js';
import { fetchOpenRouterWebSearch } from './openrouter-search.js';
import { ensureDealerInfo } from '../ui/badges/card-dealer.js';
import { openFetchedAlarmDialog, closeFetchedAlarmDialogs, processPriceAlarmModal } from './price-alarm.js';
import { buildComparisonPrompt, buildExternalAiUrl, copyTextToClipboard, isComparisonButtonActive } from './batch-actions.js';

export async function runSingleBatchAlarm(pid, card = null, { targetPct, durationDays, signal } = {}) {
  if (!pid || signal?.aborted) return { status: 'cancelled' };
  const pidKey = String(pid);

  return new Promise(async (resolve) => {
    let settled = false;
    const finish = (res) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.('abort', onAbort);
      closeFetchedAlarmDialogs();
      resolve(res);
    };
    const onAbort = () => finish({ status: 'cancelled' });
    signal?.addEventListener?.('abort', onAbort, { once: true });

    const batchOpts = {
      targetPct,
      durationDays,
      autoSubmit: true,
      onResult: (res) => finish(res)
    };

    try {
      const mockDialog = document.querySelector('#mock-alarm-dialog');
      if (mockDialog) {
        const formEl = mockDialog.querySelector?.(SELECTORS.alarm.form);
        if (formEl) {
          formEl.querySelectorAll('.success, .confirmation, .tp-alarm-status').forEach(n => n.remove());
          formEl._tpBatchAlarmOpts = batchOpts;
          delete formEl.dataset.tpAlarmProcessed;
          delete formEl.dataset.tpAlarmState;
        }
        mockDialog.style.display = 'block';
        processPriceAlarmModal();
        return;
      }

      const postBody = new URLSearchParams({
        im_nimb_ch: '1',
        im_nimb_pid: pidKey,
        im_nimb_tmpl: 'btn',
        lang: 'de'
      });
      const { res, body: html } = await fetchWithTimeout('/plugins/infomails/NewInfoMailButton', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: postBody
      }, { timeoutMs: 8000, source: 'price-alarm', label: 'batch-open', readAs: 'text' });
      if (signal?.aborted) return finish({ status: 'cancelled' });
      if (!res.ok || !(await openFetchedAlarmDialog(html, batchOpts))) {
        finish({ status: 'error', reason: 'fetch-failed' });
      }
    } catch {
      finish({ status: 'error', reason: 'network' });
    }
  });
}

let activeJob = null;
let jobSeq = 0;

export function getActiveBatchJob() {
  return activeJob;
}

export function startBatchJob(label, total = 0) {
  cancelActiveBatchJob();
  const controller = new AbortController();
  const job = { id: ++jobSeq, label, total, done: 0, failed: 0, controller };
  activeJob = job;
  return {
    job,
    signal: controller.signal,
    updateProgress: (done, failed = job.failed) => {
      if (activeJob?.id === job.id) {
        job.done = done;
        job.failed = failed;
      }
    },
    finish: () => {
      if (activeJob?.id === job.id) activeJob = null;
    }
  };
}

export function cancelActiveBatchJob() {
  if (!activeJob) return false;
  const job = activeJob;
  activeJob = null;
  try { job.controller.abort(); } catch { /* ignore */ }
  return true;
}

export function openTabUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (typeof GM_openInTab === 'function') {
    try {
      GM_openInTab(url, { active: false, insert: true });
      return true;
    } catch { /* fallback below */ }
  }
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      const w = window.open(url, '_blank', 'noopener');
      return !!w;
    } catch {
      return false;
    }
  }
  return false;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function runBatchDealerFetch(items, { onProgress, signal, fetchFn = ensureDealerInfo } = {}) {
  const useShipping = isShippingPriceActive();
  const pending = items.filter(it => {
    if (!it?.pid || !it?.card) return false;
    if (extractDealer(it.card, useShipping)) return false;
    const cached = getCachedDealer(it.pid, useShipping);
    return !cached?.dealer;
  });

  const total = pending.length;
  let done = 0;
  let loaded = 0;
  let failed = 0;
  let stoppedByCooldown = false;

  if (total === 0) return { total: 0, done: 0, loaded: 0, failed: 0, stoppedByCooldown: false };

  let cursor = 0;
  const concurrency = Math.min(3, total);
  const worker = async () => {
    while (cursor < total) {
      if (signal?.aborted) return;
      if (Date.now() < getOriginCooldownUntil()) {
        stoppedByCooldown = true;
        return;
      }
      const it = pending[cursor++];
      try {
        const res = await fetchFn(it.card, it.pid, useShipping);
        if (res?.dealer) loaded++;
      } catch {
        failed++;
      } finally {
        done++;
        onProgress?.(done, total, failed);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { total, done, loaded, failed, stoppedByCooldown, cancelled: !!signal?.aborted };
}

export async function runBatchPriceAlarms(items, { targetPct, durationDays, onProgress, signal, alarmFn = runSingleBatchAlarm } = {}) {
  const eligible = items.filter(it => !!it?.pid);
  const total = eligible.length;
  let done = 0;
  let confirmed = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  let abortedEarly = false;

  for (let i = 0; i < eligible.length; i++) {
    if (signal?.aborted) break;
    const it = eligible[i];
    const res = await alarmFn(it.pid, it.card, { targetPct, durationDays, signal });
    done++;
    if (res?.status === 'confirmed') {
      confirmed++;
      consecutiveFailures = 0;
    } else if (res?.status === 'cancelled' && signal?.aborted) {
      break;
    } else {
      failed++;
      consecutiveFailures++;
    }
    onProgress?.(done, total, failed);
    if (consecutiveFailures >= 3) {
      abortedEarly = true;
      break;
    }
    if (i < eligible.length - 1 && !signal?.aborted) {
      await sleep(250);
    }
  }

  return { total, done, confirmed, failed, abortedEarly, cancelled: !!signal?.aborted };
}

export async function runBatchAiIndividual(items, { provider = 'google', onProgress, signal, openTabFn = openTabUrl, searchFn = fetchOpenRouterWebSearch } = {}) {
  const total = items.length;
  if (provider !== 'openrouter') {
    let opened = 0;
    const blockedItems = [];
    items.forEach((it, idx) => {
      const q = formatSearchQuery(it.title, CONFIG.REVIEW_SEARCH_KEYWORD, it.priceText);
      const url = 'https://www.google.com/search?q=' + encodeURIComponent(q) + '&udm=50';
      if (openTabFn(url)) opened++;
      else blockedItems.push({ title: it.title, url });
      onProgress?.(idx + 1, total, blockedItems.length);
    });
    return { mode: 'google', total, opened, blockedItems };
  }

  const results = new Array(total);
  let cursor = 0;
  let done = 0;
  let failed = 0;
  const concurrency = Math.min(3, Math.max(1, total));
  const worker = async () => {
    while (cursor < total) {
      if (signal?.aborted) return;
      const idx = cursor++;
      const it = items[idx];
      const prompt = buildTavilyQuery(it.title, CONFIG.REVIEW_SEARCH_KEYWORD, it.priceText);
      try {
        const res = await searchFn(CONFIG.OPENROUTER_API_KEY, prompt, {
          model: CONFIG.OPENROUTER_MODEL,
          engine: CONFIG.OPENROUTER_SEARCH_ENGINE,
          maxResults: CONFIG.OPENROUTER_MAX_RESULTS,
          signal
        });
        results[idx] = { item: it, answer: res.answer, citations: res.citations || [], error: null };
      } catch (err) {
        if (err?.cancelled) return;
        failed++;
        results[idx] = { item: it, answer: '', citations: [], error: err?.message || 'Fehler' };
      } finally {
        done++;
        onProgress?.(done, total, failed);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { mode: 'openrouter', total, done, failed, results: results.filter(Boolean), cancelled: !!signal?.aborted };
}

export async function runBatchComparisonAi(items, { target = 'google-ai', signal, openTabFn = openTabUrl, searchFn = fetchOpenRouterWebSearch } = {}) {
  const prompt = buildComparisonPrompt(items);
  if (!prompt) return { mode: 'empty' };
  if (target === 'openrouter' && CONFIG.OPENROUTER_API_KEY && String(CONFIG.OPENROUTER_API_KEY).trim()) {
    const res = await searchFn(CONFIG.OPENROUTER_API_KEY, prompt, {
      model: CONFIG.OPENROUTER_MODEL,
      engine: CONFIG.OPENROUTER_SEARCH_ENGINE,
      maxResults: CONFIG.OPENROUTER_MAX_RESULTS,
      searchContextSize: 'high',
      signal
    });
    return { mode: 'openrouter', prompt, answer: res.answer, citations: res.citations || [] };
  }
  const copied = await copyTextToClipboard(prompt);
  const ext = buildExternalAiUrl(target, prompt);
  const opened = openTabFn(ext.url);
  return { mode: 'external', target, url: ext.url, opened, copied, needsPaste: ext.needsPaste, prompt };
}

export function runBatchOpenTabs(items, { openTabFn = openTabUrl } = {}) {
  let opened = 0;
  const blockedItems = [];
  for (const it of items) {
    const url = it.dealerUrl || it.url;
    if (!url) continue;
    if (openTabFn(url)) opened++;
    else blockedItems.push({ title: it.title, url });
  }
  return { opened, blockedItems };
}

export async function runBatchDiscordShare(items, channel, { onProgress, signal } = {}) {
  if (!channel?.url) return { total: 0, shared: 0, skippedDuplicates: 0, failed: 0 };
  const useShipping = isShippingPriceActive();
  const eligible = [];
  let skippedDuplicates = 0;
  for (const it of items) {
    if (!it.isVerifiedDeal || !it.pid || !(it.cardPrice > 0)) continue;
    const priceCents = priceToCents(it.cardPrice);
    if (getSharedDeal(it.pid, priceCents)) {
      skippedDuplicates++;
      continue;
    }
    eligible.push({ it, priceCents });
  }

  const total = eligible.length;
  let shared = 0;
  let failed = 0;
  const hook = channel.url.trim();

  for (let i = 0; i < eligible.length; i++) {
    if (signal?.aborted) break;
    const { it, priceCents } = eligible[i];
    try {
      let dealer = it.dealer;
      let dealerUrl = it.dealerUrl;
      let offers = it.offerCount;
      if ((!dealer || !dealerUrl || !offers) && it.url) {
        const info = await fetchProductInfo(it.url, undefined, useShipping).catch(() => null);
        if (info?.dealer) {
          dealer = dealer || info.dealer;
          dealerUrl = dealerUrl || info.dealerUrl;
          offers = offers || info.totalOffers || info.offers || 0;
          setCachedDealer(it.pid, useShipping, info.dealer, info.dealerUrl || '', undefined, info.offers || 0, info.totalOffers || 0);
        }
      }
      const stats = getCachedPriceStats(it.pid, true, undefined, useShipping);
      const resolved = stats ? resolveShareFields(it.cardPrice, stats) : {};
      const fields = {
        title: it.title,
        priceText: it.priceText,
        dealer,
        dealerUrl,
        offerCount: offers,
        url: it.url,
        prevLowText: resolved.prevLowText || '',
        prevLowPct: resolved.prevLowPct || 0,
        medianText: resolved.medianText || '',
        medianPct: resolved.medianPct || 0,
        suppressDealerEmbed: CONFIG.DISCORD_SUPPRESS_DEALER_EMBED !== false,
        suppressProductEmbed: CONFIG.DISCORD_SUPPRESS_PRODUCT_EMBED !== false
      };
      const content = formatDealMessage(fields, CONFIG.DISCORD_LAYOUT);
      const forumContent = CONFIG.DISCORD_FORUM_TITLE
        ? content
        : formatDealMessage({ ...fields, forceLink: true }, forumRecipeFor(CONFIG.DISCORD_LAYOUT));
      const threadName = buildThreadName(it.title);
      const rawSeries = stats ? fullSeries(stats) : null;
      const chartSeries = rawSeries ? withLivePrice(rawSeries, it.cardPrice) : null;
      const png = chartSeries ? await renderSparklinePng(chartSeries, 360, 100, it.title).catch(() => null) : null;
      const productBlob = it.imageUrl ? await fetchImageBlob(it.imageUrl).catch(() => null) : null;
      const productOpt = {
        ...(productBlob ? { productImageBlob: productBlob } : null),
        ...(it.imageUrl ? { productImageUrl: it.imageUrl } : null)
      };
      const payload = { content, forumContent, threadName, png, productOpt };
      const stillFresh = () => !signal?.aborted;

      try {
        await sendDealToChannel(channel, payload, stillFresh);
      } catch (err) {
        if (err?.retryAfterMs) {
          await sleep(Math.min(5000, Math.max(500, err.retryAfterMs)));
          if (signal?.aborted) break;
          await sendDealToChannel(channel, payload, stillFresh);
        } else {
          throw err;
        }
      }

      setSharedDeal(it.pid, priceCents);
      shared++;
    } catch {
      failed++;
    }
    onProgress?.(i + 1, total, failed);
    if (i < eligible.length - 1 && !signal?.aborted) await sleep(600);
  }

  return { total, shared, skippedDuplicates, failed, cancelled: !!signal?.aborted };
}

export function runBatchNativeCompare(items, doc = (typeof document !== 'undefined' ? document : null)) {
  const allBtns = doc ? Array.from(doc.querySelectorAll('.Plugin_AddToProductComparisonButton')) : [];
  let activeCount = allBtns.filter(isComparisonButtonActive).length;
  const alreadyActive = activeCount;
  let clicked = 0;

  for (const it of items) {
    if (activeCount >= 4) break;
    const btn = it?.card?.querySelector?.('.Plugin_AddToProductComparisonButton');
    if (!btn || isComparisonButtonActive(btn)) continue;
    btn.click();
    clicked++;
    activeCount++;
  }

  return { clicked, alreadyActive, activeCount, cappedAt4: activeCount >= 4 };
}
