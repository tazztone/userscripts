/**
 * Bounded Price History Cache Contract
 * Provides in-memory LRU cache (capped at MAX_MEMORY_CACHE_ITEMS = 500)
 * backed by localStorage with configurable TTL and auto-pruning.
 */

export const STATS_CACHE_PREFIX = 'tp_hist_v1_';
export const MAX_MEMORY_CACHE_ITEMS = 500;

export const memoryCache = new Map();
let lastPruneTimestamp = 0;

export function isCacheEntryFresh(parsed, ignoreNegative = false, options = {}) {
  if (!parsed) return false;
  const now = options.now || Date.now();
  const ageMs = now - (parsed.time || 0);

  if (parsed.unavailable) {
    if (ignoreNegative) return false;
    const negHours = options.negativeCacheHours ?? (typeof CONFIG !== 'undefined' ? CONFIG.NEGATIVE_CACHE_HOURS : 2);
    const negTtlMs = (negHours || 2) * 3600 * 1000;
    return ageMs < negTtlMs;
  }

  const realHours = options.realDealCacheHours ?? (typeof CONFIG !== 'undefined' ? CONFIG.REAL_DEAL_CACHE_HOURS : 48);
  const ttlMs = (realHours || 48) * 3600 * 1000;
  return ageMs < ttlMs;
}

export function prunePriceStatsCache(force = false, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return;
  const now = Date.now();
  if (!force && now - lastPruneTimestamp < 10 * 60 * 1000) return;
  lastPruneTimestamp = now;

  try {
    const maxAgeMs = 14 * 24 * 3600 * 1000;
    const entries = [];
    const keysToRemove = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(STATS_CACHE_PREFIX)) {
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

export function getCachedPriceStats(productId, ignoreNegative = false, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!productId) return null;
  try {
    if (memoryCache.has(productId)) {
      const memData = memoryCache.get(productId);
      if (isCacheEntryFresh(memData, ignoreNegative)) {
        // LRU update
        memoryCache.delete(productId);
        memoryCache.set(productId, memData);
        return memData;
      } else {
        memoryCache.delete(productId);
      }
    }

    const raw = storage?.getItem(STATS_CACHE_PREFIX + productId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (isCacheEntryFresh(parsed, ignoreNegative)) {
      memoryCache.set(productId, parsed);
      if (memoryCache.size > MAX_MEMORY_CACHE_ITEMS) {
        const firstKey = memoryCache.keys().next().value;
        memoryCache.delete(firstKey);
      }
      return parsed;
    }
  } catch (e) {}
  return null;
}

export function setCachedPriceStats(productId, stats, isUnavailable = false, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!productId) return;
  const payload = isUnavailable
    ? { unavailable: true, time: Date.now() }
    : { ...stats, time: Date.now() };

  memoryCache.set(productId, payload);
  if (memoryCache.size > MAX_MEMORY_CACHE_ITEMS) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }

  try {
    prunePriceStatsCache(false, storage);
    storage?.setItem(STATS_CACHE_PREFIX + productId, JSON.stringify(payload));
  } catch (e) {}
}

export function countCachedPriceStats(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  let count = 0;
  try {
    if (storage) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(STATS_CACHE_PREFIX)) {
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
        if (key && key.startsWith(STATS_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      count = keysToRemove.length;
      keysToRemove.forEach(k => storage.removeItem(k));
    }
  } catch (e) {}
  return count;
}

export const getCachedProductCount = countCachedPriceStats;
