/**
 * OpenRouter Web Search Client & Unified AI Summary Facade
 * Uses OpenRouter Chat Completions with `openrouter:web_search` server tool
 * and dispatches between OpenRouter and legacy Tavily for card/Discord/batch AI.
 */

import { lruSet } from '../scanner/cache.js';
import { CONFIG, effectiveAiProvider } from '../state/config.js';
import { fetchWithTimeout, gmRequestWithTimeout } from '../state/net.js';
import {
  buildTavilyQuery,
  fetchTavilySummary,
  getCachedTavily
} from './tavily-search.js';

export const OPENROUTER_API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_CACHE_KEY_PREFIX = 'tp_suite_v2_or_';
export const OPENROUTER_CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48h

const orMemCache = new Map();
const orInFlight = new Map();

export function normalizeOpenRouterPrompt(prompt) {
  return String(prompt ?? '').replace(/\s+/g, ' ').trim();
}

export function openRouterCacheKey(prompt, model, engine, maxResults) {
  const norm = normalizeOpenRouterPrompt(prompt).toLowerCase();
  if (!norm) return '';
  return `${model || 'google/gemini-2.5-flash'}::${engine || 'auto'}::${maxResults || 5}::${norm}`;
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
  if (!cacheKey) return null;
  const now = Date.now();
  const mem = orMemCache.get(cacheKey);
  if (mem && (now - mem.timestamp < OPENROUTER_CACHE_TTL_MS)) {
    return mem;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(OPENROUTER_CACHE_KEY_PREFIX + cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.answer === 'string' && (now - (parsed.timestamp || 0) < OPENROUTER_CACHE_TTL_MS)) {
          const entry = {
            answer: parsed.answer,
            citations: Array.isArray(parsed.citations) ? parsed.citations : [],
            timestamp: parsed.timestamp
          };
          lruSet(orMemCache, cacheKey, entry, 200);
          return entry;
        }
        localStorage.removeItem(OPENROUTER_CACHE_KEY_PREFIX + cacheKey);
      }
    } catch { /* ignore storage read error */ }
  }
  return null;
}

export function pruneOpenRouterCache(maxEntries = 100, storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return 0;
  let removed = 0;
  try {
    const now = Date.now();
    const valid = [];
    const keys = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(OPENROUTER_CACHE_KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      try {
        const raw = store.getItem(k);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed.answer !== 'string' || !Number.isFinite(parsed.timestamp) || (now - parsed.timestamp >= OPENROUTER_CACHE_TTL_MS)) {
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
  } catch { /* ignore */ }
  return removed;
}

export function setCachedOpenRouter(cacheKey, result, storage = null) {
  if (!cacheKey || !result || typeof result.answer !== 'string') return;
  const entry = {
    answer: result.answer.trim(),
    citations: Array.isArray(result.citations) ? result.citations : [],
    timestamp: Date.now()
  };
  lruSet(orMemCache, cacheKey, entry, 200);
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (store) {
    const payload = JSON.stringify(entry);
    try {
      store.setItem(OPENROUTER_CACHE_KEY_PREFIX + cacheKey, payload);
      pruneOpenRouterCache(100, store);
    } catch {
      pruneOpenRouterCache(50, store);
      try {
        store.setItem(OPENROUTER_CACHE_KEY_PREFIX + cacheKey, payload);
      } catch { /* ignore */ }
    }
  }
}

export function clearOpenRouterCache() {
  orMemCache.clear();
  if (typeof localStorage !== 'undefined') {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(OPENROUTER_CACHE_KEY_PREFIX)) keys.push(k);
      }
      for (const k of keys) localStorage.removeItem(k);
    } catch { /* ignore */ }
  }
}

function mapOpenRouterHttpError(status) {
  if (status === 401 || status === 403) return 'OpenRouter API-Key ungültig';
  if (status === 402) return 'OpenRouter Guthaben erschöpft (402)';
  if (status === 429) return 'OpenRouter Rate-Limit erreicht (429)';
  return `OpenRouter HTTP-Fehler ${status}`;
}

export function fetchOpenRouterWebSearch(apiKey, prompt, options = {}) {
  const trimmedKey = String(apiKey || '').trim();
  if (!trimmedKey) return Promise.reject(new Error('OpenRouter API-Key fehlt'));

  const normalized = normalizeOpenRouterPrompt(prompt);
  if (!normalized) return Promise.reject(new Error('Suchanfrage ist leer'));

  if (options.signal?.aborted) {
    return Promise.reject(Object.assign(new Error('Abgebrochen'), { cancelled: true }));
  }

  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 60000;
  const model = String(options.model || CONFIG?.OPENROUTER_MODEL || 'google/gemini-2.5-flash').trim() || 'google/gemini-2.5-flash';
  const engine = String(options.engine || CONFIG?.OPENROUTER_SEARCH_ENGINE || 'auto').trim() || 'auto';
  const maxResults = typeof options.maxResults === 'number'
    ? options.maxResults
    : (CONFIG?.OPENROUTER_MAX_RESULTS || 5);
  const searchContextSize = options.searchContextSize || 'medium';

  const cacheKey = openRouterCacheKey(normalized, model, engine, maxResults);
  const cached = getCachedOpenRouter(cacheKey);
  if (cached?.answer) {
    return Promise.resolve({ answer: cached.answer, citations: cached.citations || [] });
  }

  const flightKey = `${trimmedKey}:${cacheKey}`;
  const existing = orInFlight.get(flightKey);
  if (existing && existing.timeoutMs >= timeoutMs && !options.signal) {
    return existing.promise;
  }

  const promise = new Promise((resolve, reject) => {
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

    if (typeof GM_xmlhttpRequest !== 'undefined') {
      gmRequestWithTimeout({
        method: 'POST',
        url: OPENROUTER_API_ENDPOINT,
        headers,
        data: payload,
      }, { timeoutMs, signal: options.signal, source: 'openrouter', label: 'web_search' })
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
      }, { timeoutMs, signal: options.signal, source: 'openrouter', label: 'web_search', readAs: 'text' })
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
    if (orInFlight.get(flightKey)?.promise === promise) {
      orInFlight.delete(flightKey);
    }
  });

  if (!options.signal) {
    orInFlight.set(flightKey, { promise, timeoutMs });
  }
  return promise;
}

export function isConfiguredAiActive(cfg = CONFIG) {
  const provider = effectiveAiProvider(cfg);
  if (provider === 'openrouter') return !!(cfg?.OPENROUTER_API_KEY && String(cfg.OPENROUTER_API_KEY).trim());
  if (provider === 'tavily') return !!(cfg?.TAVILY_API_KEY && String(cfg.TAVILY_API_KEY).trim());
  return false;
}

export function getCachedConfiguredAiSummary(title, keyword = '', priceText = '', opts = {}) {
  const cfg = opts.config || CONFIG;
  const provider = opts.provider || effectiveAiProvider(cfg);
  const query = buildTavilyQuery(title, keyword, priceText);
  if (!query) return null;
  if (provider === 'openrouter') {
    const model = opts.model || cfg?.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
    const engine = opts.engine || cfg?.OPENROUTER_SEARCH_ENGINE || 'auto';
    const maxResults = opts.maxResults || cfg?.OPENROUTER_MAX_RESULTS || 5;
    return getCachedOpenRouter(openRouterCacheKey(query, model, engine, maxResults));
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
