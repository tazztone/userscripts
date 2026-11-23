/**
 * Tavily AI Search Client & Persistent Cache
 * Fast 1-credit basic web search with synthesized verdict (include_answer: true).
 * 48h persistent cache to conserve the 1,000 monthly free tier credits.
 */

import { lruSet } from '../scanner/cache.js';
import { CONFIG } from '../state/config.js';
import { fetchWithTimeout, gmRequestWithTimeout } from '../state/net.js';

export const TAVILY_API_ENDPOINT = 'https://api.tavily.com/search';
export const TAVILY_CACHE_KEY_PREFIX = 'tp_suite_v2_tavily_';
export const TAVILY_CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48h

const memCache = new Map();
const inFlight = new Map();

export function normalizeTavilyQuery(query) {
  return String(query ?? '').replace(/\s+/g, ' ').trim();
}

export function tavilyCacheKey(query) {
  return normalizeTavilyQuery(query).toLowerCase();
}

export function getCachedTavily(query) {
  const key = tavilyCacheKey(query);
  if (!key) return null;

  const now = Date.now();
  const mem = memCache.get(key);
  if (mem && (now - mem.timestamp < TAVILY_CACHE_TTL_MS)) {
    return mem;
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(TAVILY_CACHE_KEY_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.answer === 'string' && (now - (parsed.timestamp || 0) < TAVILY_CACHE_TTL_MS)) {
          lruSet(memCache, key, parsed, 200);
          return parsed;
        }
        localStorage.removeItem(TAVILY_CACHE_KEY_PREFIX + key);
      }
    } catch {
      /* ignore storage read error */
    }
  }

  return null;
}

export function pruneTavilyCache(maxEntries = 100, storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return 0;

  let removed = 0;
  try {
    const now = Date.now();
    const valid = [];
    const keys = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(TAVILY_CACHE_KEY_PREFIX)) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      try {
        const raw = store.getItem(k);
        const parsed = raw ? JSON.parse(raw) : null;
        if (
          !parsed ||
          typeof parsed.answer !== 'string' ||
          !Number.isFinite(parsed.timestamp) ||
          (now - parsed.timestamp >= TAVILY_CACHE_TTL_MS)
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
  } catch {
    /* ignore storage access error */
  }
  return removed;
}

export function setCachedTavily(query, answer, storage = null) {
  const key = tavilyCacheKey(query);
  if (!key || typeof answer !== 'string') return;

  const entry = { answer: answer.trim(), timestamp: Date.now() };
  lruSet(memCache, key, entry, 200);

  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (store) {
    const payload = JSON.stringify(entry);
    try {
      store.setItem(TAVILY_CACHE_KEY_PREFIX + key, payload);
      pruneTavilyCache(100, store);
    } catch {
      pruneTavilyCache(50, store);
      try {
        store.setItem(TAVILY_CACHE_KEY_PREFIX + key, payload);
      } catch {
        /* ignore storage full or quota errors */
      }
    }
  }
}

export function clearTavilyCache() {
  memCache.clear();
  if (typeof localStorage !== 'undefined') {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(TAVILY_CACHE_KEY_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {
      /* ignore storage access error */
    }
  }
}

export function expandKeywordWithPrice(keyword, priceText = '') {
  let kw = String(keyword || '').replace(/\s+/g, ' ').trim();
  if (!kw.includes('{preis}')) return kw;

  if (priceText) {
    return kw.replace(/\{preis\}/g, () => priceText).replace(/\s+/g, ' ').trim();
  }

  // Gracefully drop sentence or clause asking about {preis} when no price is available
  return kw
    .replace(/(?:[.,;]\s+)(?:(?:Ist\s+(?:der\s+)?|zum\s+)?(?:Preis(?:\s*von|\s*:)?\s*)?|Ist\s+)?\{preis\}(?:\s*(?:ein\s+guter\s+Deal|angemessen|günstig)\??)?(?:\.|\?|;)(?=\s+\S)/gi, '.')
    .replace(/(?:[.,;]?\s*)?(?:(?:Ist\s+(?:der\s+)?|zum\s+)?(?:Preis(?:\s*von|\s*:)?\s*)?|Ist\s+)?\{preis\}(?:\s*(?:ein\s+guter\s+Deal|angemessen|günstig)\??)?[.,;]?/gi, '')
    .replace(/\s*\.\s*\./g, '.')
    .replace(/^\.\s*/, '')
    .replace(/\s*-\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatSearchQuery(productTitle, keyword, priceText = '') {
  const cleanTitle = String(productTitle || '').replace(/\s+/g, ' ').trim();
  let kw = expandKeywordWithPrice(keyword, priceText);
  if (/\{produkt\}|\[produkt\]/i.test(kw)) {
    return kw.replace(/\{produkt\}|\[produkt\]/gi, () => cleanTitle).replace(/\s+/g, ' ').trim();
  }
  return `${cleanTitle} ${kw}`.replace(/\s+/g, ' ').trim();
}

export function buildTavilyQuery(title, keyword = '', priceText = '') {
  let full = formatSearchQuery(title, keyword, priceText);
  if (!/deutsch/i.test(full)) {
    full = `${full} Kurzes Fazit auf Deutsch.`;
  }

  return normalizeTavilyQuery(full);
}

export function fetchTavilySummary(apiKey, query, options = {}) {
  const trimmedKey = String(apiKey || '').trim();
  if (!trimmedKey) {
    return Promise.reject(new Error('Tavily API-Key fehlt'));
  }

  const normalized = normalizeTavilyQuery(query);
  if (!normalized) {
    return Promise.reject(new Error('Suchanfrage ist leer'));
  }

  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 60000;
  const searchDepth = options.searchDepth || (typeof CONFIG !== 'undefined' ? CONFIG.TAVILY_SEARCH_DEPTH : 'basic') || 'basic';
  const maxResults = typeof options.maxResults === 'number'
    ? options.maxResults
    : ((typeof CONFIG !== 'undefined' ? CONFIG.TAVILY_MAX_RESULTS : 5) || 5);
  const cacheQueryKey = (searchDepth === 'basic' && maxResults === 5)
    ? normalized
    : `${normalized}::${searchDepth}::${maxResults}`;

  // 1. Check persistent/memory cache
  const cached = getCachedTavily(cacheQueryKey);
  if (cached?.answer) {
    return Promise.resolve(cached.answer);
  }

  // 2. In-flight request deduplication
  const flightKey = `${trimmedKey}:${normalized.toLowerCase()}:${searchDepth}:${maxResults}`;
  const existing = inFlight.get(flightKey);
  if (existing && existing.timeoutMs >= timeoutMs) {
    return existing.promise;
  }

  const promise = new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      query: normalized,
      search_depth: searchDepth,
      include_answer: true,
      language: 'de',
      max_results: maxResults
    });

    const handleSuccess = (rawText) => {
      try {
        const data = JSON.parse(rawText || '{}');
        const answer = (data.answer || '').trim();
        if (answer) {
          setCachedTavily(cacheQueryKey, answer);
          resolve(answer);
        } else if (Array.isArray(data.results) && data.results.length > 0 && data.results[0].content) {
          const fallbackSnippet = data.results[0].content.trim();
          setCachedTavily(cacheQueryKey, fallbackSnippet);
          resolve(fallbackSnippet);
        } else {
          reject(new Error('Kein Fazit erhalten'));
        }
      } catch (err) {
        reject(new Error('Antwort von Tavily konnte nicht gelesen werden'));
      }
    };

    if (typeof GM_xmlhttpRequest !== 'undefined') {
      gmRequestWithTimeout({
        method: 'POST',
        url: TAVILY_API_ENDPOINT,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${trimmedKey}`
        },
        data: payload,
      }, { timeoutMs, source: 'tavily', label: 'search' })
        .then((res) => {
          if (res.status >= 200 && res.status < 300) {
            handleSuccess(res.responseText);
          } else if (res.status === 401 || res.status === 403) {
            reject(new Error('Tavily API-Key ungültig'));
          } else if (res.status === 429) {
            reject(new Error('Tavily Monatslimit oder Rate-Limit erreicht'));
          } else {
            reject(new Error(`Tavily HTTP-Fehler ${res.status}`));
          }
        })
        .catch((err) => {
          reject(new Error(err?.timeout ? 'Zeitüberschreitung bei Tavily' : 'Netzwerkfehler bei Verbindung zu Tavily'));
        });
    } else if (typeof fetch !== 'undefined') {
      fetchWithTimeout(TAVILY_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${trimmedKey}`
        },
        body: payload,
      }, { timeoutMs, source: 'tavily', label: 'search', readAs: 'text' })
        .then(({ res, body }) => {
          if (res.ok) {
            handleSuccess(body);
          } else if (res.status === 401 || res.status === 403) {
            reject(new Error('Tavily API-Key ungültig'));
          } else if (res.status === 429) {
            reject(new Error('Tavily Monatslimit oder Rate-Limit erreicht'));
          } else {
            reject(new Error(`Tavily HTTP-Fehler ${res.status}`));
          }
        })
        .catch((err) => {
          reject(new Error(err?.timeout ? 'Zeitüberschreitung bei Tavily' : 'Netzwerkfehler bei Verbindung zu Tavily'));
        });
    } else {
      reject(new Error('Kein HTTP-Transport für Tavily verfügbar'));
    }
  }).finally(() => {
    if (inFlight.get(flightKey)?.promise === promise) {
      inFlight.delete(flightKey);
    }
  });

  inFlight.set(flightKey, { promise, timeoutMs });
  return promise;
}

export function formatReviewTooltip(fullQuery, { hasTavily = false, aiMode = false, maxQueryLen = 90 } = {}) {
  const q = normalizeTavilyQuery(fullQuery);
  const prefix = hasTavily ? 'KI-Fazit & Google-Suche: ' : 'Google-Suche: ';
  const suffix = !hasTavily && aiMode ? ' (KI-Modus)' : '';
  const shortQ = q.length > maxQueryLen ? `${q.slice(0, Math.max(1, maxQueryLen - 1)).trimEnd()}…` : q;
  return {
    title: `${prefix}${shortQ}${suffix}`,
    ariaLabel: `${prefix}${q}${suffix}`,
  };
}
