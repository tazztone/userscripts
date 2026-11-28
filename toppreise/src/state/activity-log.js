/**
 * 200-entry in-memory activity log ring buffer + persistent 300-entry warn/error
 * ring buffer (GM_getValue/GM_setValue/GM_deleteValue with localStorage fallback
 * when GM_* APIs are unavailable) with secret redaction.
 */

import { CONFIG } from './config.js';

const ACTIVITY_LOG_MAX = 200;
const PERSISTENT_LOG_KEY = 'DIAG_PERSISTENT_LOG';
const PERSISTENT_LS_KEY = 'tp_suite_v2_DIAG_PERSISTENT_LOG';
const PERSISTENT_LOG_MAX = 300;
const activityBuffer = [];
const activityListeners = new Set();
let activitySeq = 0;

export function redactSecrets(value) {
  if (value == null) return '';
  return String(value)
    .replace(/(\/api\/webhooks\/\d+\/)[^/?#\s]+/gi, '$1[REDACTED]')
    .replace(/tvly-[A-Za-z0-9_-]+/g, 'tvly-[REDACTED]')
    .replace(/sk-or-[A-Za-z0-9_-]+/gi, 'sk-or-[REDACTED]')
    .replace(/(Bearer\s+)[^\s]+/gi, '$1[REDACTED]');
}

function notifyActivityListeners(entry) {
  for (const fn of activityListeners) {
    try {
      fn(entry);
    } catch {}
  }
}

function serializeDetail(detail) {
  if (typeof detail === 'string') return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function getScriptVersion() {
  return (typeof GM_info !== 'undefined' && GM_info?.script?.version) || 'dev';
}

function getSafePagePath() {
  return (typeof location !== 'undefined' && location?.pathname) ? redactSecrets(location.pathname) : '';
}

function sanitizePersistentList(raw) {
  let parsed = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const level = item.level === 'error' ? 'error' : item.level === 'warn' ? 'warn' : null;
    if (!level) continue;
    out.push({
      ts: Number(item.ts) || 0,
      level,
      source: String(item.source || 'app'),
      message: redactSecrets(item.message || ''),
      detail: item.detail == null ? null : redactSecrets(item.detail),
      ver: String(item.ver || 'dev'),
      page: String(item.page || ''),
      count: Number(item.count) > 0 ? Number(item.count) : 1,
    });
  }
  if (out.length > PERSISTENT_LOG_MAX) {
    out.splice(0, out.length - PERSISTENT_LOG_MAX);
  }
  return out;
}

let persistentCache = null;
let persistentCacheReader = null;

function readPersistentBuffer() {
  const reader = typeof GM_getValue === 'function'
    ? GM_getValue
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  if (persistentCache !== null && persistentCacheReader === reader) {
    return persistentCache;
  }
  persistentCacheReader = reader;
  try {
    if (typeof GM_getValue === 'function') {
      persistentCache = sanitizePersistentList(GM_getValue(PERSISTENT_LOG_KEY, []));
      return persistentCache;
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PERSISTENT_LS_KEY);
      persistentCache = raw ? sanitizePersistentList(raw) : [];
      return persistentCache;
    }
  } catch {}
  persistentCache = [];
  return persistentCache;
}

function writePersistentBuffer(entries) {
  const trimmed = Array.isArray(entries) ? entries.slice(-PERSISTENT_LOG_MAX) : [];
  persistentCache = trimmed;
  persistentCacheReader = typeof GM_getValue === 'function'
    ? GM_getValue
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  try {
    if (typeof GM_setValue === 'function') {
      GM_setValue(PERSISTENT_LOG_KEY, trimmed);
      return;
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PERSISTENT_LS_KEY, JSON.stringify(trimmed));
    }
  } catch {}
}

function appendPersistentEntry(entry) {
  if (entry.level !== 'warn' && entry.level !== 'error') return;
  const list = readPersistentBuffer().slice();
  const next = {
    ts: entry.ts,
    level: entry.level,
    source: entry.source,
    message: entry.message,
    detail: entry.detail,
    ver: getScriptVersion(),
    page: getSafePagePath(),
    count: 1,
  };
  const last = list[list.length - 1];
  if (
    last &&
    last.level === next.level &&
    last.source === next.source &&
    last.message === next.message &&
    last.detail === next.detail &&
    last.page === next.page &&
    last.ver === next.ver
  ) {
    last.ts = next.ts;
    last.count = (Number(last.count) > 0 ? Number(last.count) : 1) + 1;
  } else {
    list.push(next);
  }
  if (list.length > PERSISTENT_LOG_MAX) {
    list.splice(0, list.length - PERSISTENT_LOG_MAX);
  }
  writePersistentBuffer(list);
}

export function logActivity(level, source, message, detail = null) {
  const entry = {
    seq: ++activitySeq,
    ts: Date.now(),
    level: String(level || 'info'),
    source: String(source || 'app'),
    message: redactSecrets(message),
    detail: detail == null ? null : redactSecrets(serializeDetail(detail)),
  };

  activityBuffer.push(entry);
  if (activityBuffer.length > ACTIVITY_LOG_MAX) {
    activityBuffer.splice(0, activityBuffer.length - ACTIVITY_LOG_MAX);
  }

  appendPersistentEntry(entry);

  if (entry.level === 'error') {
    console.error(`[TP:${entry.source}] ${entry.message}`, entry.detail || '');
  } else if (entry.level === 'warn') {
    console.warn(`[TP:${entry.source}] ${entry.message}`, entry.detail || '');
  } else if (CONFIG?.DEBUG) {
    console.info(`[TP:${entry.source}] ${entry.message}`, entry.detail || '');
  }

  notifyActivityListeners(entry);
  return entry;
}

export function getActivityLog() {
  return activityBuffer.slice();
}

export function getPersistentActivityLog() {
  return readPersistentBuffer().slice();
}

export function clearActivityLog() {
  activityBuffer.length = 0;
  notifyActivityListeners(null);
}

export function clearPersistentActivityLog() {
  persistentCache = null;
  persistentCacheReader = null;
  try {
    if (typeof GM_deleteValue === 'function') {
      GM_deleteValue(PERSISTENT_LOG_KEY);
    } else if (typeof GM_setValue === 'function') {
      GM_setValue(PERSISTENT_LOG_KEY, []);
    }
  } catch {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(PERSISTENT_LOG_KEY, []);
      }
    } catch {}
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(PERSISTENT_LS_KEY);
    }
  } catch {}
  notifyActivityListeners(null);
}

export function subscribeActivityLog(fn) {
  if (typeof fn !== 'function') return () => {};
  activityListeners.add(fn);
  return () => {
    activityListeners.delete(fn);
  };
}

export function formatActivityLogText(snapshot = null, opts = {}) {
  const rows = Array.isArray(snapshot) ? snapshot : activityBuffer;
  const includeDate = Boolean(opts && opts.includeDate);
  return rows.map((e) => {
    const iso = new Date(Number.isFinite(e.ts) ? e.ts : 0).toISOString();
    const time = includeDate ? `${iso.slice(0, 10)} ${iso.slice(11, 23)}` : iso.slice(11, 23);
    const det = e.detail ? ` | ${e.detail}` : '';
    if (!includeDate) {
      return `[${time}] ${String(e.level || 'info').toUpperCase()} [${e.source}] ${e.message}${det}`;
    }
    const ctxParts = [];
    if (e.ver) ctxParts.push(`v${e.ver}`);
    if (e.page) ctxParts.push(e.page);
    const ctx = ctxParts.length ? ` (${ctxParts.join(' ')})` : '';
    const mult = Number(e.count) > 1 ? ` [×${Number(e.count)}]` : '';
    return `[${time}] ${String(e.level || 'info').toUpperCase()} [${e.source}]${ctx}${mult} ${e.message}${det}`;
  }).join('\n');
}
