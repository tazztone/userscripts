/**
 * OpenRouter Web Search Client & Unified AI Summary Facade
 * Uses OpenRouter Chat Completions with `openrouter:web_search` server tool
 * and dispatches between OpenRouter and legacy Tavily for card/Discord/batch AI.
 */

import { CONFIG, DEFAULT_OPENROUTER_MODEL, effectiveAiProvider } from '../state/config.js';
import { fetchWithTimeout, gmRequestWithTimeout } from '../state/net.js';
import { createPersistentAiCache } from '../utils/ai-cache.js';
import {
  buildTavilyQuery,
  fetchTavilySummary,
  getCachedTavily
} from './tavily-search.js';

export const OPENROUTER_API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_CACHE_KEY_PREFIX = 'tp_suite_v2_or_';
export const OPENROUTER_CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48h

const orCache = createPersistentAiCache({
  prefix: OPENROUTER_CACHE_KEY_PREFIX,
  ttlMs: OPENROUTER_CACHE_TTL_MS,
  normalizeEntry: p => ({
    answer: p.answer,
    citations: Array.isArray(p.citations) ? p.citations : [],
    timestamp: p.timestamp
  })
});
const orInFlight = new Map();

function hashCacheStr(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function normalizeOpenRouterPrompt(prompt) {
  return String(prompt ?? '').replace(/\s+/g, ' ').trim();
}

export function openRouterCacheKey(prompt, model, engine, maxResults, searchContextSize = 'medium') {
  const norm = normalizeOpenRouterPrompt(prompt).toLowerCase();
  if (!norm) return '';
  return `${model || DEFAULT_OPENROUTER_MODEL}::${engine || 'auto'}::${maxResults || 5}::${searchContextSize || 'medium'}::${hashCacheStr(norm)}`;
}

export function extractOpenRouterCitations(annotations) {
  if (!Array.isArray(annotations)) return [];
  const seen = new Set();
  const out = [];
  for (const ann of annotations) {
    if (!ann || (ann.type ? ann.type !== 'url_citation' : !ann.url_citation)) continue;
    const raw = ann.url_citation || ann;
    const url = typeof raw.url === 'string' ? raw.url.trim() : '';
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : url;
    out.push({ url, title });
  }
  return out;
}

export function getCachedOpenRouter(cacheKey) {
  return orCache.get(cacheKey);
}

export function pruneOpenRouterCache(maxEntries = 100, storage = null) {
  return orCache.prune(maxEntries, storage);
}

export function setCachedOpenRouter(cacheKey, result, storage = null) {
  if (!cacheKey || !result || typeof result.answer !== 'string') return;
  orCache.set(cacheKey, {
    answer: result.answer.trim(),
    citations: Array.isArray(result.citations) ? result.citations : [],
    timestamp: Date.now()
  }, storage);
}

export function clearOpenRouterCache() {
  orCache.clear();
}

function mapOpenRouterHttpError(status) {
  if (status === 401 || status === 403) return 'OpenRouter API-Key ungültig';
  if (status === 402) return 'OpenRouter Guthaben erschöpft (402)';
  if (status === 429) return 'OpenRouter Rate-Limit erreicht (429)';
  return `OpenRouter HTTP-Fehler ${status}`;
}

function raceOpenRouterSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(Object.assign(new Error('Abgebrochen'), { cancelled: true }));
  return new Promise((resolve, reject) => {
    let done = false;
    const onAbort = () => {
      if (done) return;
      done = true;
      reject(Object.assign(new Error('Abgebrochen'), { cancelled: true }));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      v => { if (!done) { done = true; signal.removeEventListener('abort', onAbort); resolve(v); } },
      e => { if (!done) { done = true; signal.removeEventListener('abort', onAbort); reject(e); } }
    );
  });
}

export function fetchOpenRouterWebSearch(apiKey, prompt, options = {}) {
  const trimmedKey = String(apiKey || '').trim();
  if (!trimmedKey) return Promise.reject(new Error('OpenRouter API-Key fehlt'));

  const normalized = normalizeOpenRouterPrompt(prompt);
  if (!normalized) return Promise.reject(new Error('Suchanfrage ist leer'));

  const callerSignal = options?.signal;
  if (callerSignal?.aborted) {
    return Promise.reject(Object.assign(new Error('Abgebrochen'), { cancelled: true }));
  }

  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 60000;
  const model = String(options.model || CONFIG?.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL).trim() || DEFAULT_OPENROUTER_MODEL;
  const engine = String(options.engine || CONFIG?.OPENROUTER_SEARCH_ENGINE || 'auto').trim() || 'auto';
  const maxResults = typeof options.maxResults === 'number'
    ? options.maxResults
    : (CONFIG?.OPENROUTER_MAX_RESULTS || 5);
  const searchContextSize = options.searchContextSize || 'medium';

  const cacheKey = openRouterCacheKey(normalized, model, engine, maxResults, searchContextSize);
  const cached = getCachedOpenRouter(cacheKey);
  if (cached?.answer) {
    return Promise.resolve({ answer: cached.answer, citations: cached.citations || [] });
  }

  const flightKey = `${trimmedKey}:${cacheKey}`;
  let entry = orInFlight.get(flightKey);
  if (!entry || entry.timeoutMs < timeoutMs) {
    const abortCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const transportPromise = new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model,
        messages: [{ role: 'user', content: normalized }],
        tools: [{
          type: 'openrouter:web_search',
          parameters: {
            engine,
            max_results: maxResults,
            search_context_size: searchContextSize
          }
        }]
      });

      const handleSuccess = (rawText) => {
        try {
          const data = JSON.parse(rawText || '{}');
          const msg = data?.choices?.[0]?.message;
          const rawContent = msg?.content;
          const answer = (typeof rawContent === 'string'
            ? rawContent
            : Array.isArray(rawContent)
              ? rawContent.map(p => (typeof p === 'string' ? p : p?.text || '')).join('')
              : ''
          ).trim();
          if (!answer) {
            reject(new Error('Kein Fazit von OpenRouter erhalten'));
            return;
          }
          const citations = extractOpenRouterCitations(msg?.annotations);
          const result = { answer, citations };
          setCachedOpenRouter(cacheKey, result);
          resolve(result);
        } catch {
          reject(new Error('Antwort von OpenRouter konnte nicht gelesen werden'));
        }
      };

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${trimmedKey}`,
        'HTTP-Referer': 'https://www.toppreise.ch',
        'X-Title': 'Toppreise.ch Suite'
      };
      const transportSignal = abortCtrl?.signal;

      if (typeof GM_xmlhttpRequest !== 'undefined') {
        gmRequestWithTimeout({
          method: 'POST',
          url: OPENROUTER_API_ENDPOINT,
          headers,
          data: payload,
        }, { timeoutMs, signal: transportSignal, source: 'openrouter', label: 'web_search' })
          .then((res) => {
            if (res.status >= 200 && res.status < 300) handleSuccess(res.responseText);
            else reject(new Error(mapOpenRouterHttpError(res.status)));
          })
          .catch((err) => {
            if (err?.cancelled) reject(Object.assign(new Error('Abgebrochen'), { cancelled: true }));
            else reject(new Error(err?.timeout ? 'Zeitüberschreitung bei OpenRouter' : 'Netzwerkfehler bei Verbindung zu OpenRouter'));
          });
      } else if (typeof fetch !== 'undefined') {
        fetchWithTimeout(OPENROUTER_API_ENDPOINT, {
          method: 'POST',
          headers,
          body: payload,
        }, { timeoutMs, signal: transportSignal, source: 'openrouter', label: 'web_search', readAs: 'text' })
          .then(({ res, body }) => {
            if (res.ok) handleSuccess(body);
            else reject(new Error(mapOpenRouterHttpError(res.status)));
          })
          .catch((err) => {
            if (err?.cancelled) reject(Object.assign(new Error('Abgebrochen'), { cancelled: true }));
            else reject(new Error(err?.timeout ? 'Zeitüberschreitung bei OpenRouter' : 'Netzwerkfehler bei Verbindung zu OpenRouter'));
          });
      } else {
        reject(new Error('Kein HTTP-Transport für OpenRouter verfügbar'));
      }
    }).finally(() => {
      if (orInFlight.get(flightKey)?.promise === transportPromise) {
        orInFlight.delete(flightKey);
      }
    });

    entry = { promise: transportPromise, timeoutMs, abortCtrl, refs: 0 };
    orInFlight.set(flightKey, entry);
  }

  entry.refs++;
  const cleanupConsumer = () => {
    if (--entry.refs === 0) {
      try { entry.abortCtrl?.abort(); } catch {}
      if (orInFlight.get(flightKey) === entry) orInFlight.delete(flightKey);
    }
  };
  return raceOpenRouterSignal(entry.promise, callerSignal).finally(cleanupConsumer);
}

export function hasOpenRouterKey(cfg = CONFIG) {
  return !!(cfg?.OPENROUTER_API_KEY && String(cfg.OPENROUTER_API_KEY).trim());
}

export function hasTavilyKey(cfg = CONFIG) {
  return !!(cfg?.TAVILY_API_KEY && String(cfg.TAVILY_API_KEY).trim());
}

export function isConfiguredAiActive(cfg = CONFIG) {
  const provider = effectiveAiProvider(cfg);
  if (provider === 'openrouter') return hasOpenRouterKey(cfg);
  if (provider === 'tavily') return hasTavilyKey(cfg);
  return false;
}

export function getCachedConfiguredAiSummary(title, keyword = '', priceText = '', opts = {}) {
  const cfg = opts.config || CONFIG;
  const provider = opts.provider || effectiveAiProvider(cfg);
  const query = buildTavilyQuery(title, keyword, priceText);
  if (!query) return null;
  if (provider === 'openrouter') {
    const model = opts.model || cfg?.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
    const engine = opts.engine || cfg?.OPENROUTER_SEARCH_ENGINE || 'auto';
    const maxResults = opts.maxResults || cfg?.OPENROUTER_MAX_RESULTS || 5;
    return getCachedOpenRouter(openRouterCacheKey(query, model, engine, maxResults, opts.searchContextSize || 'medium'));
  }
  if (provider === 'tavily') {
    const depth = opts.searchDepth || cfg?.TAVILY_SEARCH_DEPTH || 'basic';
    const maxResults = opts.maxResults || cfg?.TAVILY_MAX_RESULTS || 5;
    const cacheKey = (depth === 'basic' && maxResults === 5) ? query : `${query}::${depth}::${maxResults}`;
    const cached = getCachedTavily(cacheKey);
    return cached?.answer ? { answer: cached.answer, citations: [] } : null;
  }
  return null;
}

export function fetchConfiguredAiSummary(title, keyword = '', priceText = '', opts = {}) {
  const cfg = opts.config || CONFIG;
  const provider = opts.provider || effectiveAiProvider(cfg);
  const query = buildTavilyQuery(title, keyword, priceText);
  if (provider === 'openrouter') {
    return fetchOpenRouterWebSearch(cfg?.OPENROUTER_API_KEY, query, {
      timeoutMs: opts.timeoutMs ?? 60000,
      model: opts.model || cfg?.OPENROUTER_MODEL,
      engine: opts.engine || cfg?.OPENROUTER_SEARCH_ENGINE,
      maxResults: opts.maxResults ?? cfg?.OPENROUTER_MAX_RESULTS,
      searchContextSize: opts.searchContextSize || 'medium',
      signal: opts.signal
    });
  }
  if (provider === 'tavily') {
    return fetchTavilySummary(cfg?.TAVILY_API_KEY, query, {
      timeoutMs: opts.timeoutMs ?? 60000,
      searchDepth: opts.searchDepth || cfg?.TAVILY_SEARCH_DEPTH,
      maxResults: opts.maxResults ?? cfg?.TAVILY_MAX_RESULTS
    }).then(answer => ({ answer, citations: [] }));
  }
  return Promise.reject(new Error('Kein KI-Anbieter aktiviert'));
}
