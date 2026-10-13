/**
 * Bounded Price History Cache Contract
 * Provides in-memory LRU cache (capped at MAX_MEMORY_CACHE_ITEMS = 500)
 * backed by localStorage with configurable TTL and auto-pruning.
 */

import { analyzePriceTimeSeries } from '../domain/price.js';
import { CONFIG } from '../state/config.js';
import { isShippingPriceActive } from '../page/adapter.js';

export const STATS_CACHE_PREFIX = 'tp_hist_v1_';
export const DEALER_CACHE_PREFIX = 'tp_dealer_v1_';
export const SHARED_CACHE_PREFIX = 'tp_shared_v1_';
// Janitor-Funktionen (prune/count/clear) betreuen alle Prefixe: Händlerdaten
// und Geteilt-Markierungen sind abgeleitete Produktdaten mit derselben TTL
// wie die Preishistorie.
const CACHE_PREFIXES = [STATS_CACHE_PREFIX, DEALER_CACHE_PREFIX, SHARED_CACHE_PREFIX];
export const MAX_MEMORY_CACHE_ITEMS = 500;

export function lruSet(map, key, val, cap = MAX_MEMORY_CACHE_ITEMS) {
  map.delete(key);
  map.set(key, val);
  if (map.size > cap) map.delete(map.keys().next().value);
}

export const memoryCache = new Map();

let statsWriteCount = 0;
export function isCacheEntryFresh(parsed, ignoreNegativeCache = false) {
  if (!parsed) return false;
  const ageMs = Date.now() - (parsed.time || 0);

  if (parsed.unavailable) {
    if (ignoreNegativeCache) return false;
    const negHours = CONFIG.NEGATIVE_CACHE_HOURS;
    const negTtlMs = (negHours || 2) * 3600 * 1000;
    return ageMs < negTtlMs;
  }

  const realHours = CONFIG.REAL_DEAL_CACHE_HOURS;
  const ttlMs = (realHours || 48) * 3600 * 1000;
  return ageMs < ttlMs;
}

export function prunePriceStatsCache(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return;
  try {
    const now = Date.now();
    const maxAgeMs = 14 * 24 * 3600 * 1000;
    const entries = [];
    const keysToRemove = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && CACHE_PREFIXES.some(p => key.startsWith(p))) {
        try {
          const val = JSON.parse(storage.getItem(key) || '{}');
          const age = now - (val.time || 0);
          if (!val.time || age > maxAgeMs) {
            keysToRemove.push(key);
          } else {
            entries.push({ key, time: val.time });
          }
        } catch (e) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(k => storage.removeItem(k));

    if (entries.length > 300) {
      entries.sort((a, b) => a.time - b.time);
      entries.slice(0, entries.length - 250).forEach(e => storage.removeItem(e.key));
    }
  } catch (e) {}
}

export function getCachedPriceStats(productId, ignoreNegativeCache = false, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!productId) return null;
  // Mode guard: the series is picked per shipping mode at fetch time and the
  // key is bare, so a cross-mode entry would compare the wrong baseline
  // (same wrong-"Bisher" class as a stale series anchor). Legacy entries
  // without the flag pass through; explicit mismatches read as a miss and
  // self-heal via refetch on the next scan.
  const isModeMatch = entry => {
    if (typeof entry?.isShippingPrice !== 'boolean') return true;
    try {
      return entry.isShippingPrice === isShippingPriceActive();
    } catch (e) { return true; }
  };
  try {
    if (memoryCache.has(productId)) {
      const memData = memoryCache.get(productId);
      if (isCacheEntryFresh(memData, ignoreNegativeCache)) {
        if (!isModeMatch(memData)) {
          memoryCache.delete(productId);
        } else {
          // LRU update
          lruSet(memoryCache, productId, memData);
          return memData;
        }
      } else {
        memoryCache.delete(productId);
      }
    }

    const raw = storage?.getItem(STATS_CACHE_PREFIX + productId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (isCacheEntryFresh(parsed, ignoreNegativeCache)) {
      // Cross-mode stale entry: evict from storage too, else every render
      // re-parses localStorage for an entry that always misses.
      if (!isModeMatch(parsed)) { try { storage?.removeItem(STATS_CACHE_PREFIX + productId); } catch (e) {} return null; }
      lruSet(memoryCache, productId, parsed);
      return parsed;
    }
  } catch (e) {}
  return null;
}

export function setCachedPriceStats(productId, stats, isUnavailable = false, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!productId) return;
  // Upgrade-only: never replace median-bearing stats with median-less
  // fallback stats. A refresh that lands on the HTML fallback (tiefstpreis
  // only) must not regress a full analysis — the badge would keep its old %
  // while the heat goes neutral. Unavailable-markers keep current semantics.
  if (!isUnavailable && stats && !stats.medianPrice && memoryCache.has(productId)) {
    const prev = memoryCache.get(productId);
    if (prev && !prev.unavailable && prev.medianPrice) return;
  }
  const payload = isUnavailable
    ? { unavailable: true, time: Date.now() }
    : { ...stats, time: Date.now() };

  lruSet(memoryCache, productId, payload);

  try {
    statsWriteCount++;
    if (statsWriteCount % 25 === 1) prunePriceStatsCache(storage);
    storage?.setItem(STATS_CACHE_PREFIX + productId, JSON.stringify(payload));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      try { prunePriceStatsCache(storage); storage?.setItem(STATS_CACHE_PREFIX + productId, JSON.stringify(payload)); } catch (_) {}
    }
  }
}

export function countCachedPriceStats(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  let count = 0;
  try {
    if (storage) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        // Geteilt-Markierungen sind keine gecachten Preise: Label zählt nur Historie + Händler.
        if (key && [STATS_CACHE_PREFIX, DEALER_CACHE_PREFIX].some(p => key.startsWith(p))) {
          count++;
        }
      }
    }
  } catch (e) {}
  return count;
}


export function clearPriceStatsCache(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  memoryCache.clear();
  let count = 0;
  try {
    if (storage) {
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && CACHE_PREFIXES.some(p => key.startsWith(p))) {
          keysToRemove.push(key);
        }
      }
      count = keysToRemove.length;
      keysToRemove.forEach(k => storage.removeItem(k));
    }
  } catch (e) {}
  return count;
}

// Horizon-Wechsel ohne Netz: jede gecachte Analyse trägt ihre Rohserie
// (timeSeries) — der Median wird lokal für den neuen Horizont neu gerechnet.
// `time` bleibt unangetastet, Einträge bleiben fresh, kein Refetch.
// Serienlose Einträge (Fallback/negativ) werden übersprungen.
export function recomputeCachedMedians(horizonDays, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  let count = 0;
  const rewrite = entry => {
    // Cross-mode entries are left alone (not reinserted); their key slot is
    // evicted on next read, so a stale basis never recomputes into memory.
    if (typeof entry?.isShippingPrice === 'boolean') {
      try { if (entry.isShippingPrice !== isShippingPriceActive()) return null; } catch (e) {}
    }
    const src = Array.isArray(entry?.rawTimeSeries) ? entry.rawTimeSeries : entry?.timeSeries;
    if (!Array.isArray(src)) return null;
    const fresh = analyzePriceTimeSeries(src, null, horizonDays);
    if (!fresh) return null;
    return { ...entry, ...fresh, ...(entry.rawTimeSeries && fresh.rawTimeSeries === undefined ? { rawTimeSeries: entry.rawTimeSeries } : {}) };
  };
  const seen = new Set();
  for (const [productId, entry] of memoryCache) {
    const next = rewrite(entry);
    if (!next) continue;
    memoryCache.set(productId, next);
    seen.add(productId);
    try { storage?.setItem(STATS_CACHE_PREFIX + productId, JSON.stringify(next)); } catch (e) {}
    count++;
  }
  try {
    if (storage) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key || !key.startsWith(STATS_CACHE_PREFIX)) continue;
        const productId = key.slice(STATS_CACHE_PREFIX.length);
        if (seen.has(productId)) continue;
        let entry = null;
        try { entry = JSON.parse(storage.getItem(key) || 'null'); } catch (e) { continue; }
        const next = rewrite(entry);
        if (!next) continue;
        memoryCache.set(productId, next);
        try { storage.setItem(key, JSON.stringify(next)); } catch (e) {}
        count++;
      }
    }
  } catch (e) {}
  return count;
}

// Händlername + Angebotslink pro Produkt, je Preisbasis (p/s-Slot): wird beim
// 🏬-Klick zusammen mit dem Produktseiten-Fetch geschrieben und überlebt so
// Reloads — gleiche TTL wie die Preishistorie (REAL_DEAL_CACHE_HOURS).
export function getCachedDealer(productId, useShipping, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!productId) return null;
  try {
    const raw = storage?.getItem(DEALER_CACHE_PREFIX + productId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isCacheEntryFresh(parsed)) return null;
    const entry = useShipping ? parsed?.s : parsed?.p;
    if (!entry?.dealer) return null;
    return { dealer: entry.dealer, url: entry.url || '', offers: entry.offers || 0 };
  } catch (e) {}
  return null;
}

export function setCachedDealer(productId, useShipping, dealer, url, storage = (typeof window !== 'undefined' ? window.localStorage : null), offers = 0) {
  if (!productId || !dealer) return;
  try {
    let prev = {};
    try { prev = JSON.parse(storage?.getItem(DEALER_CACHE_PREFIX + productId) || '{}'); } catch (e) { /* korrupt: neu schreiben */ }
    const next = { ...prev, time: Date.now(), [useShipping ? 's' : 'p']: { dealer, url: url || '', offers: Number.isFinite(+offers) ? Math.round(+offers) : 0 } };
    storage?.setItem(DEALER_CACHE_PREFIX + productId, JSON.stringify(next));
  } catch (e) {}
}

// Geteilt-Markierung pro Produkt+Preis: pid + Preis-Cents als Identität, damit
// eine Preisänderung die Markierung löst und der Deal neu scharf wird.
// TTL via isCacheEntryFresh (REAL_DEAL_CACHE_HOURS); clear/prune laufen über
// CACHE_PREFIXES mit — kein eigener Lifecycle.
export function getSharedDeal(productId, priceCents, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!productId) return false;
  try {
    const raw = storage?.getItem(SHARED_CACHE_PREFIX + productId);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return isCacheEntryFresh(parsed) && parsed.priceCents === priceCents;
  } catch (e) {}
  return false;
}

export function setSharedDeal(productId, priceCents, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!productId || priceCents == null) return;
  try {
    storage?.setItem(SHARED_CACHE_PREFIX + productId, JSON.stringify({ priceCents, time: Date.now() }));
  } catch (e) {}
}
