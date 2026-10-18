/**
 * Bounded Price History Cache Contract
 * Provides in-memory LRU cache (capped at MAX_MEMORY_CACHE_ITEMS = 500)
 * backed by localStorage with configurable TTL and auto-pruning.
 */

import { analyzePriceTimeSeries } from '../domain/price.js';
import { CONFIG } from '../state/config.js';
import { isShippingPriceActive } from '../page/adapter.js';

export const STATS_CACHE_PREFIX = 'tp_hist_v1_';
export const statsKey = (productId, useShippingOverride) => {
  try { const s = typeof useShippingOverride === 'boolean' ? useShippingOverride : isShippingPriceActive(); return `${STATS_CACHE_PREFIX}${productId}_${s ? 's' : 'p'}`; }
  catch { return `${STATS_CACHE_PREFIX}${productId}_p`; }
};
export const DEALER_CACHE_PREFIX = 'tp_dealer_v1_';
export const SHARED_CACHE_PREFIX = 'tp_shared_v1_';
// Janitor-Funktionen (prune/count/clear) betreuen alle Prefixe: Händlerdaten
// und Geteilt-Markierungen sind abgeleitete Produktdaten mit derselben TTL
// wie die Preishistorie.
const CACHE_PREFIXES = [STATS_CACHE_PREFIX, DEALER_CACHE_PREFIX, SHARED_CACHE_PREFIX];
export const MAX_MEMORY_CACHE_ITEMS = 500;

export function lruSet(map, key, val, cap = (CONFIG?.CACHE_MEMORY_LIMIT ?? MAX_MEMORY_CACHE_ITEMS)) {
  map.delete(key);
  map.set(key, val);
  while (map.size > cap) map.delete(map.keys().next().value);
}

export const memoryCache = new Map();
// Default-arg `window.localStorage` access itself can throw (blocked
// third-party storage); resolve lazily inside a guard so persistence
// absence only disables disk, never the in-memory LRU.
const resolveStorage = s => { try { return s ?? (typeof window !== 'undefined' ? window.localStorage : null); } catch { return null; } };

let statsWriteCount = 0;
// Stale-write guard: every clear/reset/route invalidation bumps the
// generation; in-flight fetches capture it before network I/O and their
// writes no-op when a clear landed mid-flight (reset-during-pending).
let cacheGeneration = 0;
export const currentCacheGen = () => cacheGeneration;
export const bumpCacheGeneration = () => { cacheGeneration++; };
export function currentMedianSig(horizonDays = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS) {
  return `${horizonDays}|${CONFIG.OUTLIER_REJECTION_ENABLED ? 1 : 0}|${CONFIG.OUTLIER_DEVIATION_BAND}|${CONFIG.OUTLIER_MAX_GLITCH_HOURS}`;
}
export function ensureFreshAnalysis(entry) {
  if (!entry || entry.unavailable || entry.medianSig === currentMedianSig()) return entry;
  const src = fullSeries(entry);
  if (!Array.isArray(src)) return entry;
  try {
    const fresh = analyzePriceTimeSeries(src, entry.anchorPrice ?? null, CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
    if (fresh) return { ...entry, ...fresh, time: entry.time, medianSig: currentMedianSig() };
  } catch {}
  return entry;
}
export function fullSeries(entry) {
  if (!entry) return null;
  if (Array.isArray(entry.rawTimeSeries)) return entry.rawTimeSeries;
  const base = entry.timeSeries;
  if (!Array.isArray(base)) return null;
  const extra = Array.isArray(entry.filteredOutliers) ? entry.filteredOutliers.map(o => [o.timestamp, o.price]) : [];
  if (!extra.length) return base;
  return [...base, ...extra].sort((a, b) => a[0] - b[0]);
}
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
export const hasUsablePriceStats = stats => !!stats && !stats.unavailable && (Number.isFinite(stats?.tiefstpreis) ? stats.tiefstpreis > 0 : Number.isFinite(stats?.medianPrice) && stats.medianPrice > 0);

export function prunePriceStatsCache(storage = null, forceEvict = false) {
  storage = resolveStorage(storage);
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
          const raw = storage.getItem(key) || '';
          const fastTime = raw.match(/^\{"time":(\d+)/);
          const itemTime = fastTime ? Number(fastTime[1]) : (JSON.parse(raw || '{}').time || 0);
          const age = now - itemTime;
          if (!itemTime || age > maxAgeMs) {
            keysToRemove.push(key);
          } else {
            entries.push({ key, time: itemTime });
          }
        } catch (e) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(k => storage.removeItem(k));

    if (forceEvict && entries.length > 0) {
      entries.sort((a, b) => a.time - b.time);
      const evictCount = Math.max(1, Math.ceil(entries.length * 0.25));
      entries.slice(0, evictCount).forEach(e => storage.removeItem(e.key));
    } else {
      const diskLimit = CONFIG?.CACHE_DISK_LIMIT ?? 300;
      if (entries.length > diskLimit) {
        entries.sort((a, b) => a.time - b.time);
        const target = Math.max(50, Math.round(diskLimit * 0.8));
        entries.slice(0, Math.max(0, entries.length - target)).forEach(e => storage.removeItem(e.key));
      }
    }
  } catch (e) {}
}

export function getCachedPriceStats(productId, ignoreNegativeCache = false, storage = null, useShippingOverride = null) {
  if (!productId) return null;
  storage = resolveStorage(storage);
  const targetShipping = typeof useShippingOverride === 'boolean'
    ? useShippingOverride
    : (typeof useShippingOverride === 'string' ? useShippingOverride === 'shipping' : isShippingPriceActive());
  // Mode guard: the series is picked per shipping mode at fetch time and the
  // key is bare, so a cross-mode entry would compare the wrong baseline
  // (same wrong-"Bisher" class as a stale series anchor). Legacy entries
  // without the flag pass through; explicit mismatches read as a miss and
  // self-heal via refetch on the next scan.
  const isModeMatch = entry => {
    if (typeof entry?.isShippingPrice !== 'boolean') return true;
    try {
      return entry.isShippingPrice === targetShipping;
    } catch (e) { return true; }
  };
  try {
    const key = statsKey(productId, targetShipping);
    if (memoryCache.has(key)) {
      const memData = memoryCache.get(key);
      if (isCacheEntryFresh(memData, ignoreNegativeCache)) {
        if (!isModeMatch(memData)) {
          memoryCache.delete(key);
        } else {
          const fresh = ensureFreshAnalysis(memData);
          // LRU update
          lruSet(memoryCache, key, fresh);
          return fresh;
        }
      } else {
        memoryCache.delete(key);
      }
    }

    let raw = storage?.getItem(key);
    if (!raw) {
      // Upgrade migration (one read, no refetch storm): pre-suffix entries
      // adopt the current slot when fresh and mode-matching; stale ones go,
      // mode-mismatched ones wait for their mode's next miss.
      try {
        const legacyKey = STATS_CACHE_PREFIX + productId;
        const legacy = storage?.getItem(legacyKey);
        if (legacy) {
          let parsedLegacy = null;
          try { parsedLegacy = JSON.parse(legacy); } catch {}
          if (parsedLegacy && isCacheEntryFresh(parsedLegacy, ignoreNegativeCache) && isModeMatch(parsedLegacy)) { raw = legacy; try { storage?.removeItem(legacyKey); } catch {} }
          else if (!parsedLegacy || !isCacheEntryFresh(parsedLegacy, ignoreNegativeCache)) try { storage?.removeItem(legacyKey); } catch {}
        }
      } catch {}
    }
    if (!raw) return null;
    let parsed = JSON.parse(raw);

    if (isCacheEntryFresh(parsed, ignoreNegativeCache)) {
      // Cross-mode stale entry: evict from storage too, else every render
      // re-parses localStorage for an entry that always misses.
      if (!isModeMatch(parsed)) { try { storage?.removeItem(key); } catch (e) {} return null; }
      // Lazy cold-entry recompute: horizon/outlier change stamps medianSig;
      // stale-sig entries with a series recompute synchronously, no refetch.
      parsed = ensureFreshAnalysis(parsed);
      lruSet(memoryCache, key, parsed);
      try {
        const repersist = (parsed.timeSeries && parsed.rawTimeSeries) ? { ...parsed, rawTimeSeries: undefined } : parsed;
        storage?.setItem(key, JSON.stringify(repersist));
      } catch (e) {}
      return parsed;
    }
  } catch (e) {}
  return null;
}

export function setCachedPriceStats(productId, stats, isUnavailable = false, storage = null, useShippingOverride, expectedGen = null) {
  if (!productId) return;
  if (expectedGen !== null && expectedGen !== cacheGeneration) return;
  storage = resolveStorage(storage);
  const key = statsKey(productId, useShippingOverride);
  // Upgrade-only: never replace median-bearing stats with median-less
  // fallback stats. A refresh that lands on the HTML fallback (tiefstpreis
  // only) must not regress a full analysis — the badge would keep its old %
  // while the heat goes neutral. Unavailable-markers keep current semantics.
  if (!isUnavailable && stats && !stats.medianPrice && memoryCache.has(key)) {
    const prev = memoryCache.get(key);
    if (prev && !prev.unavailable && prev.medianPrice) return;
  }
  const s = typeof useShippingOverride === 'boolean' ? useShippingOverride : isShippingPriceActive();
  const payload = isUnavailable
    ? { time: Date.now(), unavailable: true, isShippingPrice: s }
    : { time: Date.now(), medianSig: currentMedianSig(), ...stats };

  lruSet(memoryCache, key, payload);

  // Persist stripped: rawTimeSeries duplicates timeSeries bytes on disk;
  // memory keeps the full object for recompute.
  const persistPayload = (!isUnavailable && payload.timeSeries && payload.rawTimeSeries)
    ? { ...payload, rawTimeSeries: undefined }
    : payload;
  try {
    statsWriteCount++;
    if (statsWriteCount % 25 === 1) prunePriceStatsCache(storage);
    storage?.setItem(key, JSON.stringify(persistPayload));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      try { prunePriceStatsCache(storage, true); storage?.setItem(key, JSON.stringify(persistPayload)); } catch (_) {}
    }
  }
}

export function countCachedPriceStats(storage = null) {
  let count = 0;
  storage = resolveStorage(storage);
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


export function clearPriceStatsCache(storage = null, onlyPrefixes = null) {
  const prefixes = Array.isArray(onlyPrefixes) && onlyPrefixes.length > 0 ? onlyPrefixes : CACHE_PREFIXES;
  cacheGeneration++;
  storage = resolveStorage(storage);
  memoryCache.clear();
  let count = 0;
  try {
    if (storage) {
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && prefixes.some(p => key.startsWith(p))) {
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
export function recomputeCachedMedians(horizonDays, storage = null) {
  let count = 0;
  storage = resolveStorage(storage);
  const sig = currentMedianSig(horizonDays);
  const rewrite = entry => {
    const src = fullSeries(entry);
    if (!Array.isArray(src)) return null;
    const fresh = analyzePriceTimeSeries(src, entry?.anchorPrice ?? null, horizonDays);
    if (!fresh) return null;
    return { ...entry, ...fresh, time: entry.time, medianSig: sig, ...(entry.rawTimeSeries && fresh.rawTimeSeries === undefined ? { rawTimeSeries: entry.rawTimeSeries } : {}) };
  };
  for (const [cacheKey, entry] of memoryCache) {
    const next = rewrite(entry);
    if (!next) continue;
    memoryCache.set(cacheKey, next);
    // Write-through for rewritten entries only (no storage sweep): reloads
    // and other tabs see the new window without a refetch.
    try {
      const persist = (next.timeSeries && next.rawTimeSeries) ? { ...next, rawTimeSeries: undefined } : next;
      storage?.setItem(cacheKey, JSON.stringify(persist));
    } catch (e) {}
    count++;
  }
  return count;
}

// Händlername + Angebotslink pro Produkt, je Preisbasis (p/s-Slot): wird beim
// 🏬-Klick zusammen mit dem Produktseiten-Fetch geschrieben und überlebt so
// Reloads — gleiche TTL wie die Preishistorie (REAL_DEAL_CACHE_HOURS).
export function getCachedDealer(productId, useShipping, storage = null) {
  if (!productId) return null;
  storage = resolveStorage(storage);
  try {
    const raw = storage?.getItem(DEALER_CACHE_PREFIX + productId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const entry = useShipping ? parsed?.s : parsed?.p;
    if (!entry?.dealer) return null;
    // Per-slot expiry; legacy entries carry top-level time only.
    const slotTime = entry.time ?? parsed?.time ?? 0;
    if (!isCacheEntryFresh({ time: slotTime })) return null;
    return { dealer: entry.dealer, url: entry.url || '', offers: entry.offers || 0, totalOffers: entry.totalOffers || 0 };
  } catch (e) {}
  return null;
}

export function setCachedDealer(productId, useShipping, dealer, url, storage = null, offers = 0, totalOffers = 0) {
  if (!productId || !dealer) return;
  storage = resolveStorage(storage);
  try {
    let prev = {};
    try { prev = JSON.parse(storage?.getItem(DEALER_CACHE_PREFIX + productId) || '{}'); } catch (e) { /* korrupt: neu schreiben */ }
    const slot = useShipping ? 's' : 'p';
    const prevSlot = (prev && typeof prev[slot] === 'object' && prev[slot] !== null) ? prev[slot] : {};
    const now = Date.now();
    const next = { ...prev, time: now, [slot]: { ...prevSlot, dealer, url: url || '', offers: Number.isFinite(+offers) ? Math.round(+offers) : 0, totalOffers: Number.isFinite(+totalOffers) ? Math.round(+totalOffers) : 0, time: now } };
    storage?.setItem(DEALER_CACHE_PREFIX + productId, JSON.stringify(next));
  } catch (e) {}
}

// Geteilt-Markierung pro Produkt+Preis: pid + Preis-Cents als Identität, damit
// eine Preisänderung die Markierung löst und der Deal neu scharf wird.
// TTL via isCacheEntryFresh (REAL_DEAL_CACHE_HOURS); clear/prune laufen über
// CACHE_PREFIXES mit — kein eigener Lifecycle.
export function getSharedDeal(productId, priceCents, storage = null) {
  if (!productId) return false;
  storage = resolveStorage(storage);
  try {
    const raw = storage?.getItem(SHARED_CACHE_PREFIX + productId);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return isCacheEntryFresh(parsed) && parsed.priceCents === priceCents;
  } catch (e) {}
  return false;
}

export function setSharedDeal(productId, priceCents, storage = null) {
  if (!productId || priceCents == null) return;
  storage = resolveStorage(storage);
  try {
    storage?.setItem(SHARED_CACHE_PREFIX + productId, JSON.stringify({ priceCents, time: Date.now() }));
  } catch (e) {}
}
