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

let isRefreshing = false;

export function isFeedRefreshing() {
  return isRefreshing;
}

export async function fetchFeedHtml(url, customFetch = (typeof fetch !== 'undefined' ? fetch : null)) {
  if (!customFetch) {
    throw new Error('Fetch API nicht verfügbar');
  }
  const res = await customFetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.text();
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
      const inPrice = inCard.querySelector(SELECTORS.price.genericPriceMatch)?.textContent?.trim();
      const livePrice = existing.querySelector(SELECTORS.price.genericPriceMatch)?.textContent?.trim();
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

export async function refreshFeed({ onStart, onEnd, customFetch } = {}) {
  if (isRefreshing) {
    showToast('Feed wird bereits aktualisiert');
    return;
  }
  if (scanState?.isBatchChecking) {
    showToast('Batch-Prüfung läuft · Bitte warten oder abbrechen');
    return;
  }

  isRefreshing = true;
  onStart?.();

  try {
    const url = (typeof location !== 'undefined' && location.href) ? location.href : '';
    const html = await fetchFeedHtml(url, customFetch);
    const parser = new (typeof DOMParser !== 'undefined' ? DOMParser : null)();
    if (!parser) throw new Error('DOMParser nicht verfügbar');
    const doc = parser.parseFromString(html, 'text/html');
    const { added, updated } = reconcileFeedCards(doc, document);

    if (added > 0 || updated > 0) {
      triggerProcessListings();
      const msg = added > 0
        ? (added === 1 ? '✨ 1 neuer Deal geladen' : `✨ ${added} neue Deals geladen`)
        : (updated === 1 ? '1 Deal aktualisiert' : `${updated} Deals aktualisiert`);
      showToast(msg);
    } else {
      showToast('Keine neuen Deals gefunden');
    }
  } catch (err) {
    showToast(`Aktualisierung fehlgeschlagen (${err.message || 'Fehler'})`);
  } finally {
    isRefreshing = false;
    onEnd?.();
  }
}
