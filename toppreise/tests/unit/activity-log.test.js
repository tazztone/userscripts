import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  redactSecrets,
  logActivity,
  getActivityLog,
  clearActivityLog,
  subscribeActivityLog,
  formatActivityLogText,
} from '../../src/state/activity-log.js';
import { fetchWithTimeout, gmRequestWithTimeout } from '../../src/state/net.js';

describe('activity-log', () => {
  beforeEach(() => {
    clearActivityLog();
  });

  it('caps the ring buffer at 200 entries', () => {
    for (let i = 1; i <= 215; i++) {
      logActivity('info', 'test', `msg-${i}`);
    }
    const entries = getActivityLog();
    assert.equal(entries.length, 200);
    assert.equal(entries[0].message, 'msg-16');
    assert.equal(entries[199].message, 'msg-215');
  });

  it('redacts Discord webhooks, Tavily/OpenRouter keys, and Bearer tokens', () => {
    const raw = 'https://discord.com/api/webhooks/123456789/superSecretToken?wait=true tvly-dev-AbCdEf123456 sk-or-v1-XyZ987Secret Authorization: Bearer mySecretJwt999';
    const clean = redactSecrets(raw);
    assert.ok(!clean.includes('superSecretToken'));
    assert.ok(!clean.includes('AbCdEf123456'));
    assert.ok(!clean.includes('XyZ987Secret'));
    assert.ok(!clean.includes('mySecretJwt999'));
    assert.ok(clean.includes('/api/webhooks/123456789/[REDACTED]'));
    assert.ok(clean.includes('tvly-[REDACTED]'));
    assert.ok(clean.includes('sk-or-[REDACTED]'));
    assert.ok(clean.includes('Bearer [REDACTED]'));
  });

  it('notifies subscribers and supports unsubscribe', () => {
    const seen = [];
    const unsub = subscribeActivityLog((entry) => seen.push(entry));
    logActivity('info', 'sub', 'first');
    unsub();
    logActivity('info', 'sub', 'second');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].message, 'first');
  });

  it('formats log entries into readable text', () => {
    logActivity('warn', 'net', 'slow', '1200ms');
    const txt = formatActivityLogText();
    assert.ok(txt.includes('WARN [net] slow | 1200ms'));
  });
});

describe('net helpers', () => {
  let origFetch;
  let origGm;

  beforeEach(() => {
    clearActivityLog();
    origFetch = globalThis.fetch;
    origGm = globalThis.GM_xmlhttpRequest;
  });

  afterEach(() => {
    if (origFetch === undefined) delete globalThis.fetch; else globalThis.fetch = origFetch;
    if (origGm === undefined) delete globalThis.GM_xmlhttpRequest; else globalThis.GM_xmlhttpRequest = origGm;
  });

  it('resolves globalThis.fetch dynamically per call', async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => 'one' });
    const r1 = await fetchWithTimeout('https://example.com/1', {}, { readAs: 'text' });
    assert.equal(r1.body, 'one');

    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => 'two' });
    const r2 = await fetchWithTimeout('https://example.com/2', {}, { readAs: 'text' });
    assert.equal(r2.body, 'two');
  });

  it('times out during body read under the same AbortController', async () => {
    globalThis.fetch = async (_url, opts) => ({
      ok: true,
      status: 200,
      text: () => new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }),
    });

    await assert.rejects(
      () => fetchWithTimeout('https://example.com/slow-body', {}, { timeoutMs: 25, readAs: 'text', source: 'test' }),
      (err) => err.timeout === true
    );
  });

  it('propagates external AbortSignal as cancelled error', async () => {
    const ac = new AbortController();
    globalThis.fetch = async (_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });

    const p = fetchWithTimeout('https://example.com/abort', {}, { timeoutMs: 5000, signal: ac.signal });
    setTimeout(() => ac.abort(), 15);
    await assert.rejects(() => p, (err) => err.cancelled === true);
  });

  it('wraps GM_xmlhttpRequest with timeout and logging', async () => {
    globalThis.GM_xmlhttpRequest = (opts) => {
      setTimeout(() => opts.onload({ status: 204, responseText: '' }), 10);
    };
    const res = await gmRequestWithTimeout({ url: 'https://discord.com/api/webhooks/1/secretTok', method: 'POST' }, { source: 'discord' });
    assert.equal(res.status, 204);
    const logs = getActivityLog();
    assert.ok(logs.some((e) => e.message.includes('/api/webhooks/1/[REDACTED]')));
  });

  it('rejects gmRequestWithTimeout on timeout', async () => {
    globalThis.GM_xmlhttpRequest = () => {};
    await assert.rejects(
      () => gmRequestWithTimeout({ url: 'https://example.com/gm-hang' }, { timeoutMs: 25 }),
      (err) => err.timeout === true
    );
  });

  it('aborts the GM handle when the watchdog fires', async () => {
    let aborted = false;
    globalThis.GM_xmlhttpRequest = () => ({
      abort() { aborted = true; }
    });
    await assert.rejects(
      () => gmRequestWithTimeout({ url: 'https://example.com/gm-abort' }, { timeoutMs: 20 }),
      (err) => err.timeout === true
    );
    assert.equal(aborted, true);
  });

  it('ignores a late GM response after the watchdog settled', async () => {
    let lateOnload;
    globalThis.GM_xmlhttpRequest = (opts) => {
      lateOnload = opts.onload;
      return { abort() {} };
    };
    await assert.rejects(
      () => gmRequestWithTimeout({ url: 'https://example.com/gm-late' }, { timeoutMs: 20 }),
      (err) => err.timeout === true
    );
    const entriesAfterTimeout = getActivityLog().length;

    lateOnload({ status: 200 });
    assert.equal(getActivityLog().length, entriesAfterTimeout);
  });

  it('does not double-settle when abort triggers onerror synchronously', async () => {
    globalThis.GM_xmlhttpRequest = (opts) => ({
      abort() { opts.onerror?.({ error: 'aborted' }); }
    });
    await assert.rejects(
      () => gmRequestWithTimeout({ url: 'https://example.com/gm-sync' }, { timeoutMs: 20 }),
      (err) => err.timeout === true
    );
    const errors = getActivityLog().filter((entry) => entry.message.includes('GM error'));
    assert.equal(errors.length, 0);
  });

  it('gmRequestWithTimeout rejects with cancelled:true on onabort', async () => {
    globalThis.GM_xmlhttpRequest = (opts) => {
      setTimeout(() => opts.onabort(), 10);
      return { abort() {} };
    };
    await assert.rejects(
      () => gmRequestWithTimeout({ url: 'https://example.com/abort', method: 'GET' }, { timeoutMs: 1000 }),
      (err) => err?.cancelled === true
    );
  });

  it('logActivity safely serializes circular objects and BigInt detail without throwing', () => {
    const circ = { a: 1 };
    circ.self = circ;
    assert.doesNotThrow(() => logActivity('info', 'test', 'circular', circ));
    assert.doesNotThrow(() => logActivity('info', 'test', 'bigint', { id: 123n }));
  });

  it('fetchWithTimeout reports cancelled:true when external signal aborts before timeout', async () => {
    const ac = new AbortController();
    globalThis.fetch = (_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
    setTimeout(() => ac.abort(), 5);
    await assert.rejects(
      () => fetchWithTimeout('https://example.com/race', {}, { signal: ac.signal, timeoutMs: 500 }),
      (err) => err?.cancelled === true && !err?.timeout
    );
  });
});
