/**
 * Feed Reconciliation & In-Place Refresh Engine
 * Fetches current page listings in the background and merges newly
 * arrived cards and updated prices without requiring a full page reload (F5).
 */

import { getProductCards, getCardProductId } from './cards.js';
import { getCardSortableUnit } from './sort.js';
import { clearCardCache, triggerProcessListings } from './adapter.js';
import { SELECTORS } from './selectors.js';
import { showToast } from '../ui/toast.js';
import { scanState } from '../state/store.js';
import { fetchWithTimeout } from '../state/net.js';
import { logActivity } from '../state/activity-log.js';

let isRefreshing = false;
let refreshController = null;
const refreshState = {
  active: false,
  stage: 'idle',
  startedAt: 0,
  elapsedSec: 0,
  lastOutcome: null,
  lastError: null,
  lastUrl: null,
};

export function isFeedRefreshing() {
  return isRefreshing;
}

export function getFeedRefreshState() {
  return { ...refreshState };
}

export function cancelFeedRefresh() {
  if (!isRefreshing || !refreshController) return false;
  refreshController.abort();
  logActivity('info', 'feed-refresh', 'Feed-Aktualisierung abgebrochen');
  return true;
}

export async function fetchFeedHtml(url, customFetch = undefined, { signal = null, timeoutMs = 15000 } = {}) {
  if (customFetch === null || (customFetch === undefined && typeof globalThis.fetch !== 'function')) {
    throw new Error('Fetch API nicht verfügbar');
  }
  const { res, body } = await fetchWithTimeout(
    url,
    { cache: 'no-cache', credentials: 'same-origin' },
    { timeoutMs, source: 'feed-refresh', label: 'feed', readAs: 'text', customFetch, signal }
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return body;
}

function queryLivePriceText(card) {
  const cleanPlugin = card.querySelector('.Plugin_Price:not([class*="tp-"])');
  if (cleanPlugin) return cleanPlugin.textContent?.trim() || '';
  return card.querySelector(SELECTORS.price.genericPriceMatch)?.textContent?.trim() || '';
}

export function reconcileFeedCards(incomingDoc, targetDoc = (typeof document !== 'undefined' ? document : null)) {
  if (!incomingDoc || !targetDoc) {
    return { added: 0, updated: 0 };
  }

  const incomingCards = getProductCards(incomingDoc);
  if (incomingCards.length === 0) {
    return { added: 0, updated: 0 };
  }

  const liveCards = getProductCards(targetDoc);
  const liveMap = new Map();
  for (const card of liveCards) {
    const pid = getCardProductId(card);
    if (pid) liveMap.set(pid, card);
  }

  // Find destination container in live document
  let container = null;
  if (liveCards.length > 0) {
    container = getCardSortableUnit(liveCards[0])?.parentElement || null;
  }
  if (!container) {
    for (const sel of SELECTORS.layout.containers) {
      const el = targetDoc.querySelector(sel);
      if (el) {
        container = el;
        break;
      }
    }
  }
  if (!container) {
    return { added: 0, updated: 0 };
  }

  let added = 0;
  let updated = 0;
  const originalAnchor = container.firstElementChild;

  for (let i = 0; i < incomingCards.length; i++) {
    const inCard = incomingCards[i];
    const pid = getCardProductId(inCard);
    if (!pid) continue;

    const existing = liveMap.get(pid);
    if (existing) {
      const inPrice = queryLivePriceText(inCard);
      const livePrice = queryLivePriceText(existing);
      if (inPrice && livePrice && inPrice !== livePrice) {
        const inContainer = inCard.querySelector(SELECTORS.price.mainInfo) || inCard.querySelector('.priceContainer');
        const liveContainer = existing.querySelector(SELECTORS.price.mainInfo) || existing.querySelector('.priceContainer');
        if (inContainer && liveContainer) {
          liveContainer.innerHTML = inContainer.innerHTML;
          clearCardCache(existing);
          updated++;
        }
      }
    } else {
      const inUnit = getCardSortableUnit(inCard);
      if (!inUnit) continue;
      const adopted = targetDoc.importNode(inUnit, true);
      adopted.classList.add('tp-fresh-arrival');

      if (originalAnchor && originalAnchor.parentElement === container) {
        container.insertBefore(adopted, originalAnchor);
      } else {
        container.appendChild(adopted);
      }
      added++;
    }
  }

  return { added, updated };
}

export async function refreshFeed({ onStart, onEnd, onProgress, customFetch, timeoutMs = 15000 } = {}) {
  if (isRefreshing) {
    showToast('Feed wird bereits aktualisiert');
    return;
  }
  if (scanState?.isBatchChecking) {
    showToast('Batch-Prüfung läuft · Bitte warten oder abbrechen');
    return;
  }

  isRefreshing = true;
  refreshController = new AbortController();
  refreshState.active = true;
  refreshState.stage = 'fetching';
  refreshState.startedAt = Date.now();
  refreshState.elapsedSec = 0;
  refreshState.lastError = null;

  const url = (typeof location !== 'undefined' && location.href) ? location.href : '';
  refreshState.lastUrl = url;
  logActivity('info', 'feed-refresh', 'Feed-Aktualisierung gestartet');

  const emitProgress = (stage) => {
    refreshState.stage = stage;
    refreshState.elapsedSec = Math.floor((Date.now() - refreshState.startedAt) / 1000);
    onProgress?.({ stage: refreshState.stage, elapsedSec: refreshState.elapsedSec });
  };

  const ticker = setInterval(() => {
    if (!isRefreshing) return;
    const elapsed = Math.floor((Date.now() - refreshState.startedAt) / 1000);
    if (elapsed >= 1 && elapsed !== refreshState.elapsedSec) {
      refreshState.elapsedSec = elapsed;
      onProgress?.({ stage: refreshState.stage, elapsedSec: elapsed });
    }
  }, 1000);

  onStart?.();
  showToast('🔄 Suche nach neuen Deals...');

  try {
    const html = await fetchFeedHtml(url, customFetch, { signal: refreshController.signal, timeoutMs });
    if (typeof DOMParser !== 'function') {
      throw new Error('DOMParser nicht verfügbar');
    }
    emitProgress('parsing');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const incomingCount = getProductCards(doc).length;
    if (incomingCount === 0) {
      refreshState.lastOutcome = 'empty';
      logActivity('warn', 'feed-refresh', 'Antwort enthielt keine Produktkarten (Login-Wall/Captcha?)');
      showToast('Aktualisierung fehlgeschlagen (keine Produkte in Antwort)');
      return;
    }

    emitProgress('reconciling');
    const { added, updated } = reconcileFeedCards(doc, document);
    refreshState.lastOutcome = added > 0 || updated > 0 ? 'updated' : 'no-change';
    logActivity('info', 'feed-refresh', `Abgleich abgeschlossen: +${added} neu, ${updated} aktualisiert (${incomingCount} Karten)`);

    if (added > 0 || updated > 0) {
      triggerProcessListings();
      const msg = added > 0
        ? (added === 1 ? '✨ 1 neuer Deal gefunden' : `✨ ${added} neue Deals gefunden`)
        : (updated === 1 ? '1 Deal aktualisiert' : `${updated} Deals aktualisiert`);
      showToast(msg);
    } else {
      showToast('Keine neuen Deals gefunden');
    }
  } catch (err) {
    if (err?.cancelled) {
      refreshState.lastOutcome = 'cancelled';
    } else {
      refreshState.lastOutcome = err?.timeout ? 'timeout' : 'error';
      refreshState.lastError = err?.message || 'Fehler';
      logActivity('warn', 'feed-refresh', `Feed-Aktualisierung fehlgeschlagen: ${refreshState.lastError}`);
      showToast(`Aktualisierung fehlgeschlagen (${refreshState.lastError})`);
    }
  } finally {
    clearInterval(ticker);
    isRefreshing = false;
    refreshController = null;
    refreshState.active = false;
    refreshState.stage = 'idle';
    onEnd?.();
  }
}
