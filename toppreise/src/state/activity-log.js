/**
 * Pure in-memory 200-entry activity log ring buffer with secret redaction.
 * Zero localStorage / GM_setValue writes.
 */

import { CONFIG } from './config.js';

const ACTIVITY_LOG_MAX = 200;
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

export function clearActivityLog() {
  activityBuffer.length = 0;
  notifyActivityListeners(null);
}

export function subscribeActivityLog(fn) {
  if (typeof fn !== 'function') return () => {};
  activityListeners.add(fn);
  return () => {
    activityListeners.delete(fn);
  };
}

export function formatActivityLogText(snapshot = null) {
  const rows = Array.isArray(snapshot) ? snapshot : activityBuffer;
  return rows.map((e) => {
    const time = new Date(e.ts).toISOString().slice(11, 23);
    const det = e.detail ? ` | ${e.detail}` : '';
    return `[${time}] ${e.level.toUpperCase()} [${e.source}] ${e.message}${det}`;
  }).join('\n');
}
