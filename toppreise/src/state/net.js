/**
 * Unified timeout + activity-logging transport wrappers for fetch & GM_xmlhttpRequest.
 * Resolves globalThis.fetch / globalThis.GM_xmlhttpRequest dynamically at call time.
 */

import { logActivity, redactSecrets } from './activity-log.js';

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

    if (readAs === 'text' || readAs === 'json' || readAs === 'blob') {
      const body = await res[readAs]();
      const elapsed = Date.now() - startedAt;
      const bytes = typeof body === 'string'
        ? body.length
        : (body && typeof body.size === 'number' ? body.size : null);
      logActivity(
        res.ok ? 'debug' : 'warn',
        source,
        `${tag}${res.status} ${safeUrl} (${elapsed}ms${bytes != null ? `, ${bytes}B` : ''})`
      );
      return { res, body };
    }

    const elapsed = Date.now() - startedAt;
    logActivity(res.ok ? 'debug' : 'warn', source, `${tag}${res.status} ${safeUrl} (${elapsed}ms)`);
    return res;
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    if (timedOut) {
      logActivity('warn', source, `${tag}timeout after ${timeoutMs}ms: ${safeUrl}`);
      throw makeTypedError(`Timeout after ${timeoutMs}ms`, { timeout: true, cause: err });
    }
    if (externalAborted || err?.name === 'AbortError') {
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
    source = 'net',
    label = '',
  } = opts || {};

  const gmFn = globalThis.GM_xmlhttpRequest;
  if (typeof gmFn !== 'function') {
    return Promise.reject(makeTypedError('GM_xmlhttpRequest is not available', { network: true }));
  }

  const startedAt = Date.now();
  const safeUrl = redactSecrets(gmOpts.url || '');
  const tag = label ? `${label} ` : '';

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = timeoutMs > 0
      ? setTimeout(() => {
          if (settled) return;
          settled = true;
          logActivity('warn', source, `${tag}GM timeout after ${timeoutMs}ms: ${safeUrl}`);
          reject(makeTypedError(`GM timeout after ${timeoutMs}ms`, { timeout: true }));
        }, timeoutMs)
      : null;

    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
    };

    try {
      gmFn({
        ...gmOpts,
        timeout: timeoutMs,
        onload(res) {
          if (settled) return;
          settled = true;
          cleanup();
          const elapsed = Date.now() - startedAt;
          const ok = res && res.status >= 200 && res.status < 300;
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
