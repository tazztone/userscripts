/**
 * Bounded Price History Cache Contract
 * Provides in-memory LRU cache (capped at MAX_MEMORY_CACHE_ITEMS = 500)
 * backed by localStorage with configurable TTL and auto-pruning.
 */

import { analyzePriceTimeSeries, medianOf, pctDrop } from '../domain/price.js';
import { CONFIG } from '../state/config.js';
import { isShippingPriceActive } from '../page/adapter.js';

export const STATS_CACHE_PREFIX = 'tp_hist_v1_';
const STATS_DAY_MS = 86400000;
export const MAX_CACHE_BYTES = Math.round(2.5 * 1024 * 1024);

export function encodeTimeSeries(pts) {
  if (!Array.isArray(pts) || pts.length < 4) return pts;
  const t0 = pts[0]?.[0];
  if (!Number.isFinite(t0)) return pts;
  const s = [];
  let prevTs = t0 - STATS_DAY_MS;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const ts = p?.[0];
    const price = p?.[1];
    if (!Number.isFinite(ts) || !Number.isFinite(price)) return pts;
    const dt = ts - prevTs;
    const last = s[s.length - 1];
    if (dt === STATS_DAY_MS) {
      if (typeof last === 'number' && last === price) {
        s[s.length - 1] = [price, 2];
      } else if (Array.isArray(last) && last.length === 2 && last[0] === price) {
        last[1]++;
      } else {
        s.push(price);
      }
    } else {
      s.push([price, 1, dt]);
    }
    prevTs = ts;
  }
  return { rle: 1, t0, s };
}

export function decodeTimeSeries(stored) {
  if (!stored || Array.isArray(stored)) return stored;
  if (stored.rle !== 1 || !Number.isFinite(stored.t0) || !Array.isArray(stored.s)) return stored;
  let ts = stored.t0 - STATS_DAY_MS;
  const out = [];
  for (const item of stored.s) {
    if (typeof item === 'number') {
      ts += STATS_DAY_MS;
      out.push([ts, item]);
    } else if (Array.isArray(item)) {
      if (item.length === 2) {
        for (let k = 0; k < item[1]; k++) { ts += STATS_DAY_MS; out.push([ts, item[0]]); }
      } else if (item.length >= 3) {
        ts += item[2];
        out.push([ts, item[0]]);
      }
    }
  }
  return out;
}
export const statsKey = (productId, useShippingOverride) => {
  try { const s = typeof useShippingOverride === 'boolean' ? useShippingOverride : isShippingPriceActive(); return `${STATS_CACHE_PREFIX}${productId}_${s ? 's' : 'p'}`; }
  catch { return `${STATS_CACHE_PREFIX}${productId}_p`; }
};
export const DEALER_CACHE_PREFIX = 'tp_dealer_v1_';
export const SHARED_CACHE_PREFIX = 'tp_shared_v1_';
export const ASIN_CACHE_PREFIX = 'tp_asin_v1_';
// Janitor-Funktionen (prune/count/clear) betreuen alle Prefixe: Händlerdaten,
// ASIN-Zuordnungen und Geteilt-Markierungen sind abgeleitete Produktdaten mit
// derselben TTL wie die Preishistorie.
const CACHE_PREFIXES = [STATS_CACHE_PREFIX, DEALER_CACHE_PREFIX, SHARED_CACHE_PREFIX, ASIN_CACHE_PREFIX];
export const MAX_MEMORY_CACHE_ITEMS = 500;

export function lruSet(map, key, val, cap = (CONFIG?.CACHE_MEMORY_LIMIT ?? MAX_MEMORY_CACHE_ITEMS)) {
  map.delete(key);
  map.set(key, val);
  const limit = Math.max(0, Number.isFinite(cap) ? cap : MAX_MEMORY_CACHE_ITEMS);
  while (map.size > limit && map.size > 0) map.delete(map.keys().next().value);
}

export function trimMemoryCache(cap = (CONFIG?.CACHE_MEMORY_LIMIT ?? MAX_MEMORY_CACHE_ITEMS)) {
  const limit = Math.max(0, Number.isFinite(cap) ? cap : MAX_MEMORY_CACHE_ITEMS);
  while (memoryCache.size > limit && memoryCache.size > 0) {
    memoryCache.delete(memoryCache.keys().next().value);
  }
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
  const decoded = decodeTimeSeries(entry.timeSeries);
  const base = Array.isArray(decoded) ? decoded : null;
  if (!base) return null;
  const extra = Array.isArray(entry.filteredOutliers)
    ? entry.filteredOutliers
        .map(o => (Array.isArray(o) ? o : [o?.timestamp ?? o?.[0], o?.price ?? o?.[1]]))
        .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    : [];
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

function serializeStatsForDisk(entry) {
  if (!entry || entry.unavailable) return entry;
  const encodedSeries = Array.isArray(entry.timeSeries) ? encodeTimeSeries(entry.timeSeries) : entry.timeSeries;
  return {
    ...entry,
    ...(encodedSeries !== undefined ? { timeSeries: encodedSeries } : {}),
    rawTimeSeries: undefined
  };
}

export function safeStorageSet(storage, key, val) {
  if (!storage) return false;
  try {
    storage.setItem(key, val);
    return true;
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      try {
        prunePriceStatsCache(storage, true);
        storage.setItem(key, val);
        return true;
      } catch {}
    }
    return false;
  }
}

export function prunePriceStatsCache(storage = null, forceEvict = false) {
  storage = resolveStorage(storage);
  if (!storage) return;
  try {
    const now = Date.now();
    const maxAgeMs = 14 * 24 * 3600 * 1000;
    const realTtlMs = (CONFIG?.REAL_DEAL_CACHE_HOURS || 48) * 3600 * 1000;
    const diskLimit = CONFIG?.CACHE_DISK_LIMIT ?? 300;
    const negTtlMs = (CONFIG?.NEGATIVE_CACHE_HOURS || 2) * 3600 * 1000;
    const entries = [];
    const keysToRemove = [];
    let totalBytes = 0;

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && CACHE_PREFIXES.some(p => key.startsWith(p))) {
        try {
          const raw = storage.getItem(key) || '';
          const fastTime = raw.match(/^\{"time":(\d+)/);
          const itemTime = fastTime ? Number(fastTime[1]) : (JSON.parse(raw || '{}').time || 0);
          const age = now - itemTime;
          const isUnavailable = raw.includes('"unavailable":true');
          if (!itemTime || age > maxAgeMs || (isUnavailable && age > negTtlMs)) {
            keysToRemove.push(key);
          } else {
            const bytes = (key.length + raw.length) * 2;
            totalBytes += bytes;
            entries.push({ key, time: itemTime, age, bytes, isShared: key.startsWith(SHARED_CACHE_PREFIX) });
          }
        } catch (e) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(k => storage.removeItem(k));

    let active = entries;
    if (totalBytes > MAX_CACHE_BYTES && active.length > 0) {
      const targetBytes = Math.round(MAX_CACHE_BYTES * 0.8);
      const evicted = new Set();
      // 1) Evict non-shared entries past REAL_DEAL_CACHE_HOURS oldest-first
      const stale = active.filter(e => !e.isShared && e.age > realTtlMs).sort((a, b) => a.time - b.time);
      for (const e of stale) {
        if (totalBytes <= targetBytes) break;
        storage.removeItem(e.key);
        evicted.add(e.key);
        totalBytes -= e.bytes;
      }
      // 2) If still over ceiling, evict oldest entries regardless of age
      if (totalBytes > targetBytes) {
        const rest = active.filter(e => !evicted.has(e.key)).sort((a, b) => a.time - b.time);
        for (const e of rest) {
          if (totalBytes <= targetBytes) break;
          storage.removeItem(e.key);
          evicted.add(e.key);
          totalBytes -= e.bytes;
        }
      }
      if (evicted.size > 0) active = active.filter(e => !evicted.has(e.key));
    }

    if (forceEvict && active.length > 0) {
      active.sort((a, b) => a.time - b.time);
      const evictCount = Math.max(1, Math.ceil(active.length * 0.25));
      active.slice(0, evictCount).forEach(e => storage.removeItem(e.key));
    } else if (active.length > diskLimit) {
      active.sort((a, b) => a.time - b.time);
      const target = Math.max(50, Math.round(diskLimit * 0.8));
      active.slice(0, Math.max(0, active.length - target)).forEach(e => storage.removeItem(e.key));
    }
  } catch (e) {}
}

export function getCachedPriceStats(productId, ignoreNegativeCache = false, storage = null, useShippingOverride = null) {
  if (!productId) return null;
  storage = resolveStorage(storage);
  const targetShipping = typeof useShippingOverride === 'boolean'
    ? useShippingOverride
    : (typeof useShippingOverride === 'string' ? useShippingOverride === 'shipping' : isShippingPriceActive());
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
          lruSet(memoryCache, key, fresh);
          return fresh;
        }
      } else {
        memoryCache.delete(key);
      }
    }

    let raw = storage?.getItem(key);
    let migratedLegacy = false;
    if (!raw) {
      try {
        const legacyKey = STATS_CACHE_PREFIX + productId;
        const legacy = storage?.getItem(legacyKey);
        if (legacy) {
          let parsedLegacy = null;
          try { parsedLegacy = JSON.parse(legacy); } catch {}
          if (parsedLegacy && isCacheEntryFresh(parsedLegacy, ignoreNegativeCache) && isModeMatch(parsedLegacy)) {
            raw = legacy;
            migratedLegacy = true;
            try { storage?.removeItem(legacyKey); } catch {}
          } else if (!parsedLegacy || !isCacheEntryFresh(parsedLegacy, ignoreNegativeCache)) {
            try { storage?.removeItem(legacyKey); } catch {}
          }
        }
      } catch {}
    }
    if (!raw) return null;
    let parsed = JSON.parse(raw);
    if (parsed?.timeSeries && !Array.isArray(parsed.timeSeries)) {
      parsed.timeSeries = decodeTimeSeries(parsed.timeSeries);
    }

    if (isCacheEntryFresh(parsed, ignoreNegativeCache)) {
      if (!isModeMatch(parsed)) { try { storage?.removeItem(key); } catch (e) {} return null; }
      const prevSig = parsed.medianSig;
      parsed = ensureFreshAnalysis(parsed);
      lruSet(memoryCache, key, parsed);
      if (migratedLegacy || parsed.medianSig !== prevSig) {
        safeStorageSet(storage, key, JSON.stringify(serializeStatsForDisk(parsed)));
      }
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
  if (!isUnavailable && stats && !stats.medianPrice) {
    if (memoryCache.has(key)) {
      const prev = memoryCache.get(key);
      if (prev && !prev.unavailable && prev.medianPrice) return;
    } else if (storage) {
      try {
        const raw = storage.getItem(key);
        if (raw) {
          const prev = JSON.parse(raw);
          if (prev && !prev.unavailable && prev.medianPrice && isCacheEntryFresh(prev)) {
            return;
          }
        }
      } catch {}
    }
  }
  const s = typeof useShippingOverride === 'boolean' ? useShippingOverride : isShippingPriceActive();
  const { time: _t, medianSig: _m, ...rest } = stats || {};
  const payload = isUnavailable
    ? { time: Date.now(), unavailable: true, isShippingPrice: s }
    : { time: Date.now(), medianSig: currentMedianSig(), ...rest };

  lruSet(memoryCache, key, payload);

  const persistPayload = serializeStatsForDisk(payload);
  statsWriteCount++;
  const diskLimit = CONFIG?.CACHE_DISK_LIMIT ?? 300;
  if (statsWriteCount === 1 || (statsWriteCount % 25 === 0 && (storage?.length ?? 0) > Math.min(diskLimit * 0.8, 20))) {
    prunePriceStatsCache(storage);
  }
  safeStorageSet(storage, key, JSON.stringify(persistPayload));
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
  if (prefixes.includes(STATS_CACHE_PREFIX)) {
    cacheGeneration++;
    memoryCache.clear();
  }
  storage = resolveStorage(storage);
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
export function recomputeCachedMedians(horizonDays, storage = null, { horizonOnly = false } = {}) {
  let count = 0;
  storage = resolveStorage(storage);
  const sig = currentMedianSig(horizonDays);
  const nowMs = Date.now();
  const hDays = typeof horizonDays === 'number' ? horizonDays : (typeof CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS === 'number' ? CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS : 365);

  const rewriteHorizonOnly = entry => {
    const pts = decodeTimeSeries(entry?.timeSeries);
    if (!Array.isArray(pts) || pts.length === 0) return null;
    let windowPrices;
    let medianFallback = false;
    if (hDays > 0) {
      const cutoff = nowMs - hDays * STATS_DAY_MS;
      const wp = pts.filter(p => p[0] >= cutoff);
      if (wp.length >= 3) {
        windowPrices = wp.map(p => p[1]);
      } else {
        windowPrices = pts.map(p => p[1]);
        medianFallback = true;
      }
    } else {
      windowPrices = pts.map(p => p[1]);
    }
    const sorted = windowPrices.sort((a, b) => a - b);
    const medianPrice = Math.round(medianOf(sorted) * 100) / 100;
    const curr = (typeof entry.anchorPrice === 'number' && entry.anchorPrice > 0) ? entry.anchorPrice : pts[pts.length - 1][1];
    const realDiscountVsMedian = (medianPrice > curr) ? pctDrop(medianPrice, curr) : 0;
    return { ...entry, medianPrice, medianFallback, horizonDays: hDays, realDiscountVsMedian, time: entry.time, medianSig: sig };
  };

  const rewrite = entry => {
    if (horizonOnly) return rewriteHorizonOnly(entry);
    const src = fullSeries(entry);
    if (!Array.isArray(src)) return null;
    const fresh = analyzePriceTimeSeries(src, entry?.anchorPrice ?? null, hDays);
    if (!fresh) return null;
    return { ...entry, ...fresh, time: entry.time, medianSig: sig, ...(entry.rawTimeSeries && fresh.rawTimeSeries === undefined ? { rawTimeSeries: entry.rawTimeSeries } : {}) };
  };

  for (const [cacheKey, entry] of memoryCache) {
    const next = rewrite(entry);
    if (!next) continue;
    memoryCache.set(cacheKey, next);
    safeStorageSet(storage, cacheKey, JSON.stringify(serializeStatsForDisk(next)));
    count++;
  }
  return count;
}

// Händlername + Angebotslink pro Produkt, je Preisbasis (p/s-Slot): wird beim
// 🏬-Klick zusammen mit dem Produktseiten-Fetch geschrieben und überlebt so
// Reloads — gleiche TTL wie die Preishistorie (REAL_DEAL_CACHE_HOURS).
let dealerCacheInvalidateListener = null;
export function setDealerCacheInvalidateListener(fn) {
  dealerCacheInvalidateListener = typeof fn === 'function' ? fn : null;
}

export function deleteCachedDealer(productId, storage = null) {
  if (!productId) return;
  storage = resolveStorage(storage);
  try { storage?.removeItem(DEALER_CACHE_PREFIX + productId); } catch {}
  try { dealerCacheInvalidateListener?.(String(productId)); } catch {}
}

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
    safeStorageSet(storage, DEALER_CACHE_PREFIX + productId, JSON.stringify(next));
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
  safeStorageSet(storage, SHARED_CACHE_PREFIX + productId, JSON.stringify({ priceCents, time: Date.now() }));
}

export function getCachedAsin(productId, storage = null) {
  if (!productId) return null;
  storage = resolveStorage(storage);
  try {
    const raw = storage?.getItem(ASIN_CACHE_PREFIX + productId);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry?.asin) return null;
    if (!isCacheEntryFresh({ time: entry.time ?? 0 })) return null;
    return entry.asin;
  } catch (e) {}
  return null;
}

export function setCachedAsin(productId, asin, storage = null) {
  if (!productId || !asin) return;
  storage = resolveStorage(storage);
  safeStorageSet(storage, ASIN_CACHE_PREFIX + productId, JSON.stringify({ asin: String(asin).toUpperCase(), time: Date.now() }));
}
