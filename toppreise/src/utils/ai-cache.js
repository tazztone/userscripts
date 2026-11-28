/**
 * Persistent AI Search Cache Factory
 * Bounded in-memory LRU + TTL localStorage store shared by Tavily & OpenRouter clients.
 */

import { lruSet } from '../scanner/cache.js';

export function createPersistentAiCache({
  prefix,
  ttlMs,
  maxMem = 200,
  maxDisk = 100,
  normalizeEntry = parsed => parsed
}) {
  const memCache = new Map();
  let writeCount = 0;
  const keysWithPrefix = store => {
    const keys = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    return keys;
  };

  const get = (key) => {
    if (!key) return null;
    const now = Date.now();
    const mem = memCache.get(key);
    if (mem) {
      if (now - mem.timestamp < ttlMs) return mem;
      memCache.delete(key);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(prefix + key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const entry = parsed && typeof parsed.answer === 'string' ? normalizeEntry(parsed) : null;
          if (entry && (now - (entry.timestamp || 0) < ttlMs)) {
            lruSet(memCache, key, entry, maxMem);
            return entry;
          }
          localStorage.removeItem(prefix + key);
        }
      } catch { /* ignore storage read error */ }
    }
    return null;
  };

  const prune = (maxEntries = maxDisk, storage = null) => {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return 0;
    let removed = 0;
    try {
      const now = Date.now();
      const valid = [];
      for (const k of keysWithPrefix(store)) {
        try {
          const raw = store.getItem(k);
          const parsed = raw ? JSON.parse(raw) : null;
          if (
            !parsed ||
            typeof parsed.answer !== 'string' ||
            !Number.isFinite(parsed.timestamp) ||
            (now - parsed.timestamp >= ttlMs)
          ) {
            store.removeItem(k);
            removed++;
          } else {
            valid.push({ key: k, timestamp: parsed.timestamp });
          }
        } catch {
          store.removeItem(k);
          removed++;
        }
      }
      if (Number.isFinite(maxEntries) && maxEntries >= 0 && valid.length > maxEntries) {
        valid.sort((a, b) => a.timestamp - b.timestamp);
        const excess = valid.length - maxEntries;
        for (let i = 0; i < excess; i++) {
          store.removeItem(valid[i].key);
          removed++;
        }
      }
    } catch { /* ignore storage access error */ }
    return removed;
  };

  const set = (key, entry, storage = null) => {
    if (!key || !entry || typeof entry.answer !== 'string') return;
    lruSet(memCache, key, entry, maxMem);
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      const payload = JSON.stringify(entry);
      try {
        store.setItem(prefix + key, payload);
        if (++writeCount % 10 === 0 || store.length > maxDisk) prune(maxDisk, store);
      } catch {
        prune(Math.min(50, Math.floor(maxDisk / 2)), store);
        try {
          store.setItem(prefix + key, payload);
        } catch { /* ignore storage full or quota errors */ }
      }
    }
  };

  const clear = () => {
    memCache.clear();
    if (typeof localStorage !== 'undefined') {
      try {
        for (const k of keysWithPrefix(localStorage)) localStorage.removeItem(k);
      } catch { /* ignore storage access error */ }
    }
  };

  return { get, set, prune, clear };
}
