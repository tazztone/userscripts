/**
 * Tavily AI Search Client & Persistent Cache
 * Fast 1-credit basic web search with synthesized verdict (include_answer: true).
 * 48h persistent cache to conserve the 1,000 monthly free tier credits.
 */

import { CONFIG } from '../state/config.js';
import { postJsonTransport } from '../state/net.js';
import { createPersistentAiCache } from '../utils/ai-cache.js';

export const TAVILY_API_ENDPOINT = 'https://api.tavily.com/search';
export const TAVILY_CACHE_KEY_PREFIX = 'tp_suite_v2_tavily_';
export const TAVILY_CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48h

const tavilyCache = createPersistentAiCache({
  prefix: TAVILY_CACHE_KEY_PREFIX,
  ttlMs: TAVILY_CACHE_TTL_MS
});
const inFlight = new Map();

export function normalizeTavilyQuery(query) {
  return String(query ?? '').replace(/\s+/g, ' ').trim();
}

export function tavilyCacheKey(query) {
  return normalizeTavilyQuery(query).toLowerCase();
}

export function getCachedTavily(query) {
  return tavilyCache.get(tavilyCacheKey(query));
}

export function pruneTavilyCache(maxEntries = 100, storage = null) {
  return tavilyCache.prune(maxEntries, storage);
}

export function setCachedTavily(query, answer, storage = null) {
  const key = tavilyCacheKey(query);
  if (!key || typeof answer !== 'string') return;
  tavilyCache.set(key, { answer: answer.trim(), timestamp: Date.now() }, storage);
}

export function clearTavilyCache() {
  tavilyCache.clear();
}

export function expandKeywordWithPrice(keyword, priceText = '') {
  let kw = String(keyword || '').replace(/\s+/g, ' ').trim();
  if (!/\{preis\}/i.test(kw)) return kw;

  if (priceText) {
    return kw.replace(/\{preis\}/gi, () => priceText).replace(/\s+/g, ' ').trim();
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

  const signal = options.signal || null;
  if (signal?.aborted) {
    return Promise.reject(Object.assign(new Error('Abgebrochen'), { cancelled: true }));
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
  if (existing && existing.timeoutMs >= timeoutMs && !signal) {
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
        const fallbackSnippet = Array.isArray(data.results) && data.results.length > 0
          ? String(data.results[0]?.content || '').trim()
          : '';
        if (answer) {
          setCachedTavily(cacheQueryKey, answer);
          resolve(answer);
        } else if (fallbackSnippet) {
          setCachedTavily(cacheQueryKey, fallbackSnippet);
          resolve(fallbackSnippet);
        } else {
          reject(new Error('Kein Fazit erhalten'));
        }
      } catch (err) {
        reject(new Error('Antwort von Tavily konnte nicht gelesen werden'));
      }
    };

    postJsonTransport({
      url: TAVILY_API_ENDPOINT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${trimmedKey}`
      },
      body: payload,
      timeoutMs,
      signal,
      source: 'tavily',
      label: 'search'
    })
      .then(({ status, ok, text }) => {
        if (ok) handleSuccess(text);
        else if (status === 401 || status === 403) reject(new Error('Tavily API-Key ungültig'));
        else if (status === 429) reject(new Error('Tavily Monatslimit oder Rate-Limit erreicht'));
        else reject(new Error(`Tavily HTTP-Fehler ${status}`));
      })
      .catch((err) => {
        if (err?.noTransport) reject(new Error('Kein HTTP-Transport für Tavily verfügbar'));
        else if (err?.cancelled) reject(Object.assign(new Error('Abgebrochen'), { cancelled: true }));
        else reject(new Error(err?.timeout ? 'Zeitüberschreitung bei Tavily' : 'Netzwerkfehler bei Verbindung zu Tavily'));
      });
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
