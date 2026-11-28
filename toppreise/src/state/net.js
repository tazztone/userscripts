/**
 * Unified timeout + activity-logging transport wrappers for fetch & GM_xmlhttpRequest.
 * Resolves globalThis.fetch / globalThis.GM_xmlhttpRequest dynamically at call time.
 */

import { logActivity, redactSecrets } from './activity-log.js';

let originCooldownUntil = 0;
export function getOriginCooldownUntil() { return originCooldownUntil; }
export function setOriginCooldownUntil(untilMs) {
  if (Number.isFinite(untilMs) && untilMs > originCooldownUntil) {
    originCooldownUntil = untilMs;
  }
}
export function resetOriginCooldown() { originCooldownUntil = 0; }

export const backoffMs = (attempt, baseDelayMs = 400) =>
  Math.min(8000, baseDelayMs * 2 ** attempt) + Math.random() * 250;

export const parseRetryHeaderMs = header => {
  if (header == null) return null;
  const trimmed = String(header).trim();
  if (trimmed === '') return null;
  const secs = Number(trimmed);
  if (Number.isFinite(secs)) return Math.max(0, Math.min(60000, secs * 1000));
  const at = Date.parse(trimmed);
  if (Number.isFinite(at)) return Math.max(0, Math.min(60000, at - Date.now()));
  return null;
};

export const parseRetryAfterMs = (header, baseDelayMs = 400, attempt = 0) =>
  parseRetryHeaderMs(header) ?? backoffMs(attempt, baseDelayMs);

function makeTypedError(message, props = {}) {
  const err = new Error(message);
  Object.assign(err, props);
  return err;
}

export async function fetchWithTimeout(url, fetchOpts = {}, opts = {}) {
  const {
    timeoutMs = 10000,
    source = 'net',
    label = '',
    readAs = null,
    customFetch = null,
    signal = null,
    isOk = null,
  } = opts || {};

  const fetchFn = customFetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    throw makeTypedError('fetch is not available', { network: true });
  }

  const controller = new AbortController();
  let timedOut = false;
  let externalAborted = false;

  const onExternalAbort = () => {
    externalAborted = true;
    if (timer !== null) clearTimeout(timer);
    controller.abort(signal?.reason);
  };

  if (signal) {
    if (signal.aborted) {
      throw makeTypedError('Request aborted', { cancelled: true });
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timer = timeoutMs > 0
    ? setTimeout(() => {
        timedOut = true;
        controller.abort(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs)
    : null;

  const startedAt = Date.now();
  const safeUrl = redactSecrets(url);
  const tag = label ? `${label} ` : '';

  try {
    const res = await fetchFn(url, {
      ...fetchOpts,
      signal: controller.signal,
    });

    const ok = typeof isOk === 'function' ? Boolean(isOk(res)) : Boolean(res?.ok);

    if (readAs === 'text' || readAs === 'json' || readAs === 'blob') {
      let body = null;
      if (typeof res?.[readAs] === 'function') {
        if (readAs === 'json' && !res.ok) {
          try {
            body = await res.json();
          } catch (err) {
            if (externalAborted || timedOut || err?.name === 'AbortError') throw err;
            body = null;
          }
        } else {
          body = await res[readAs]();
        }
      }
      const elapsed = Date.now() - startedAt;
      const bytes = typeof body === 'string'
        ? body.length
        : (body && typeof body.size === 'number' ? body.size : null);
      logActivity(
        ok ? 'debug' : 'warn',
        source,
        `${tag}${res.status} ${safeUrl} (${elapsed}ms${bytes != null ? `, ${bytes}B` : ''})`
      );
      return { res, body };
    }

    const elapsed = Date.now() - startedAt;
    logActivity(ok ? 'debug' : 'warn', source, `${tag}${res.status} ${safeUrl} (${elapsed}ms)`);
    return res;
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    if (externalAborted) {
      logActivity('info', source, `${tag}aborted (${elapsed}ms): ${safeUrl}`);
      throw makeTypedError('Request aborted', { cancelled: true, cause: err });
    }
    if (timedOut) {
      logActivity('warn', source, `${tag}timeout after ${timeoutMs}ms: ${safeUrl}`);
      throw makeTypedError(`Timeout after ${timeoutMs}ms`, { timeout: true, cause: err });
    }
    if (err?.name === 'AbortError') {
      logActivity('info', source, `${tag}aborted (${elapsed}ms): ${safeUrl}`);
      throw makeTypedError('Request aborted', { cancelled: true, cause: err });
    }
    logActivity('warn', source, `${tag}network error (${elapsed}ms): ${safeUrl}`, err?.message || String(err));
    throw err;
  } finally {
    if (timer !== null) clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}

export function gmRequestWithTimeout(gmOpts = {}, opts = {}) {
  const {
    timeoutMs = 10000,
    signal = null,
    source = 'net',
    label = '',
    isOk = null,
  } = opts || {};

  const gmFn = globalThis.GM_xmlhttpRequest;
  if (typeof gmFn !== 'function') {
    return Promise.reject(makeTypedError('GM_xmlhttpRequest is not available', { network: true }));
  }
  if (signal?.aborted) {
    return Promise.reject(makeTypedError('GM_xmlhttpRequest aborted', { cancelled: true }));
  }

  const startedAt = Date.now();
  const safeUrl = redactSecrets(gmOpts.url || '');
  const tag = label ? `${label} ` : '';

  return new Promise((resolve, reject) => {
    let settled = false;
    let handle = null;
    // Watchdog abort: settling alone would leave the manager request running
    // after we reported a timeout (a late success could still post a message).
    const abortHandle = () => {
      try { handle?.abort?.(); } catch {}
    };
    const timer = timeoutMs > 0
      ? setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          abortHandle();
          logActivity('warn', source, `${tag}GM timeout after ${timeoutMs}ms: ${safeUrl}`);
          reject(makeTypedError(`GM timeout after ${timeoutMs}ms`, { timeout: true }));
        }, timeoutMs)
      : null;

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      abortHandle();
      logActivity('debug', source, `${tag}GM aborted: ${safeUrl}`);
      reject(makeTypedError('GM_xmlhttpRequest aborted', { cancelled: true }));
    };

    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    try {
      handle = gmFn({
        ...gmOpts,
        ...(timeoutMs > 0 ? { timeout: timeoutMs } : {}),
        onload: (res) => {
          if (settled) return;
          settled = true;
          cleanup();
          const elapsed = Date.now() - startedAt;
          const ok = typeof isOk === 'function'
            ? Boolean(isOk(res))
            : Boolean(res && res.status >= 200 && res.status < 300);
          logActivity(ok ? 'debug' : 'warn', source, `${tag}GM ${res?.status ?? '?'} ${safeUrl} (${elapsed}ms)`);
          resolve(res);
        },
        onerror(err) {
          if (settled) return;
          settled = true;
          cleanup();
          const elapsed = Date.now() - startedAt;
          logActivity('warn', source, `${tag}GM error (${elapsed}ms): ${safeUrl}`, err?.error || err?.statusText || '');
          reject(makeTypedError('GM_xmlhttpRequest error', { network: true, cause: err }));
        },
        ontimeout() {
          if (settled) return;
          settled = true;
          cleanup();
          logActivity('warn', source, `${tag}GM timeout after ${timeoutMs}ms: ${safeUrl}`);
          reject(makeTypedError(`GM timeout after ${timeoutMs}ms`, { timeout: true }));
        },
        onabort() {
          if (settled) return;
          settled = true;
          cleanup();
          reject(makeTypedError('GM_xmlhttpRequest aborted', { cancelled: true }));
        },
      });
      } catch (err) {
      if (!settled) {
        settled = true;
        cleanup();
        logActivity('error', source, `${tag}GM throw: ${safeUrl}`, err?.message || String(err));
        reject(err);
      }
    }
  });
}

export function postJsonTransport({ url, headers, body, timeoutMs = 60000, signal = null, source = 'net', label = '' }) {
  if (typeof GM_xmlhttpRequest !== 'undefined') {
    return gmRequestWithTimeout({
      method: 'POST',
      url,
      headers,
      data: body,
    }, { timeoutMs, signal, source, label }).then(res => ({
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      text: res.responseText,
    }));
  }
  if (typeof fetch !== 'undefined') {
    return fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body,
    }, { timeoutMs, signal, source, label, readAs: 'text' }).then(({ res, body: text }) => ({
      status: res.status,
      ok: Boolean(res?.ok),
      text,
    }));
  }
  return Promise.reject(makeTypedError('Kein HTTP-Transport verfügbar', { network: true, noTransport: true }));
}
