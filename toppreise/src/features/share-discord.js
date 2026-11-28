/**
 * Discord Deal-Sharing
 * 1-Klick-Share verifizierter Tiefstpreise in einen Discord-Channel via
 * user-eigenem Webhook (GM-privat gespeichert, nie im Repo/Export/localStorage).
 */

import { renderDiscordChart, rasterizeSvgToPngBlob } from '../ui/sparkline.js';
import { priceToCents } from '../domain/price.js';
import { fetchWithTimeout, gmRequestWithTimeout, parseRetryHeaderMs } from '../state/net.js';

export const isDiscordWebhookUrl = url =>
  typeof url === 'string' &&
  /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/[\w-]+(?:\?[^\s#]*)?$/.test(url.trim());

// Forum-/Media-Channel brauchen thread_name (sonst 405/400, nichts erstellt).
// Thread-/Channel-Namen: 1-100 Zeichen (Discord Channel-Doku).
export const buildThreadName = title => ((title || '').replace(/\s+/g, ' ').trim() || 'Toppreise-Deal').slice(0, 100);
export function isForumThreadError(err) {
  if (!err) return false;
  const msg = err.message || '';
  if (err.status === 405 || msg === 'Discord 405') return true;
  if (err.status === 400 || msg === 'Discord 400') {
    const body = typeof err.body === 'string' ? err.body.trim() : '';
    return !body || /"code"\s*:\s*22000[13]\b|thread_name|forum/i.test(body);
  }
  return false;
}

// Definite attachment rejections: the file itself was refused — text fallback
// is safe. Anything else (429/timeout/network) must never auto-post text.
export const isAttachmentRejection = err => err?.status === 400 || err?.status === 413 || err?.status === 415;

export function discordForumFlagKey(webhookUrl) {
  let h = 5381;
  const s = String(webhookUrl || '').trim();
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `DISCORD_FORUM:${h.toString(16).padStart(8, '0')}`;
}

// Historie endet am letzten Sample, nicht am Live-Kartenpreis (kann seitdem
// gefallen sein). Für den PNG-Chart den Livepreis anhängen, damit Linie und
// Endpunkt-Markierung am aktuellen Preis enden. Reine Funktion, nie mutierend.
export function withLivePrice(timeSeries, price) {
  if (!Array.isArray(timeSeries) || timeSeries.length === 0) return timeSeries;
  if (!(price > 0)) return timeSeries;
  const last = timeSeries[timeSeries.length - 1];
  if (Array.isArray(last) && priceToCents(last[1]) === priceToCents(price)) return timeSeries;
  return [...timeSeries, [Date.now(), price]];
}

// Preischart als PNG für Discord: vorhandenes SVG gross rendern, rastern, als
// Webhook-Attachment hochladen. Reine Browser-APIs — ohne DOM kein Bild (null).
export function renderSparklinePng(timeSeries, width = 360, height = 100, title = '') {
  if (typeof document === 'undefined' || !Number.isFinite(width) || !(width > 0) || !Number.isFinite(height) || !(height > 0)) {
    return Promise.resolve(null);
  }
  try {
    const svg = renderDiscordChart(timeSeries, width, height, title);
    if (!svg) return Promise.resolve(null);
    return rasterizeSvgToPngBlob(svg, width, height);
  } catch {
    return Promise.resolve(null);
  }
}

const validateImageBlob = blob => {
  if (!blob?.size) throw new Error('Leeres Bild');
  if (blob.size > 8 * 1024 * 1024) throw new Error('Bild zu gross');
  if (blob.type && !blob.type.startsWith('image/')) throw new Error('Ungültiges Bild');
  return blob;
};

// PNG als Attachment (multipart mit payload_json). Scheitert der Upload,
// postet der Caller ohne Bild nach (Text-Sparkline trägt den Trend).
//
// Produkt-Bytes für den Upload holen (same-origin via GM-Transport, kein CORS-
// Problem). URL-Embeds verlieren gegen Inline-Attachments in der Thread-
// Vorschau — darum wird das Produkt als erste Attachment-Datei mitgeschickt.
export function fetchImageBlob(imageUrl, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof imageUrl !== 'string' || !/^https?:\/\//i.test(imageUrl.trim())) return reject(new Error('Ungültige Bild-URL'));
      try {
        const h = new URL(imageUrl.trim()).hostname.toLowerCase();
        const own = (typeof location !== 'undefined' && location.hostname ? location.hostname : 'www.toppreise.ch').toLowerCase();
        const isAllowedHost = h === own || h === 'toppreise.ch' || h.endsWith('.toppreise.ch') || h === 'graph.keepa.com' || h.endsWith('.keepa.com');
        if (!isAllowedHost) return reject(new Error('Ungültige Bild-URL'));
      } catch { return reject(new Error('Ungültige Bild-URL')); }
      const url = imageUrl.trim();
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        gmRequestWithTimeout({ method: 'GET', url, responseType: 'blob' }, { timeoutMs, source: 'discord', label: 'image' })
          .then(res => {
            if (res.status >= 200 && res.status < 300 && res?.response) {
              const blob = res.response instanceof Blob ? res.response : new Blob([res.response]);
              resolve(validateImageBlob(blob));
            } else {
              reject(new Error(`Bild-Download ${res.status}`));
            }
          })
          .catch(err => reject(err?.message?.includes('Bild') ? err : new Error(err?.timeout ? 'Timeout' : 'Netzwerkfehler')));
      } else if (typeof fetch !== 'undefined') {
        fetchWithTimeout(url, {}, { timeoutMs, source: 'discord', label: 'image', readAs: 'blob' })
          .then(({ res, body: blob }) => {
            if (res.status >= 200 && res.status < 300) resolve(validateImageBlob(blob));
            else reject(new Error(`Bild-Download ${res.status}`));
          })
          .catch(err => reject(err?.message?.includes('Bild') ? err : new Error(err?.timeout ? 'Timeout' : 'Netzwerkfehler')));
      } else {
        reject(new Error('Kein HTTP-Transport verfügbar'));
      }
    } catch (err) { reject(err); }
  });
}

// Enriched rejection: {status, body, retryAfterMs} let the caller tell a
// definite attachment refusal (safe text fallback) from an ambiguous
// transport failure (429/timeout/network — never auto-repost, could duplicate).
const discordBodyExcerpt = body => (typeof body === 'string' ? body : '')?.slice(0, 500) || '';
const discordHeaderVal = (headers, name) => {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const m = String(headers).match(new RegExp(`^${name}:\\s*(.+)$`, 'im'));
  return m ? m[1].trim() : null;
};
const discordRetryAfterMs = headers => {
  const ra = parseRetryHeaderMs(discordHeaderVal(headers, 'Retry-After'));
  if (ra != null) return ra;
  const resetAfter = Number(discordHeaderVal(headers, 'X-RateLimit-Reset-After'));
  if (Number.isFinite(resetAfter)) return Math.max(0, Math.min(60000, resetAfter * 1000));
  return 0;
};
const discordError = (status, body, headers) =>
  Object.assign(new Error(status ? `Discord ${status}` : 'Netzwerkfehler'), {
    status: status ?? 0,
    body: discordBodyExcerpt(body),
    retryAfterMs: (status === 429 || status === 503) ? discordRetryAfterMs(headers) : 0
  });

const withWaitQuery = url => {
  try {
    const u = new URL(url.trim());
    u.searchParams.set('wait', 'true');
    return u.toString();
  } catch {
    return `${url.trim()}${url.includes('?') ? '&' : '?'}wait=true`;
  }
};
const parseDiscordJson = res => {
  try { return JSON.parse(res?.responseText || '{}'); } catch { return {}; }
};

function discordPost({ url, data, headers, timeoutMs, label = 'post', parseJson = true }) {
  if (typeof GM_xmlhttpRequest !== 'undefined') {
    return gmRequestWithTimeout({
      method: 'POST',
      url,
      ...(headers ? { headers } : {}),
      data,
    }, { timeoutMs, source: 'discord', label }).then(
      res => {
        if (res.status >= 200 && res.status < 300) return parseJson ? parseDiscordJson(res) : undefined;
        throw discordError(res.status, res?.responseText, res?.responseHeaders);
      },
      err => {
        throw Object.assign(new Error(err?.timeout ? 'Timeout' : 'Netzwerkfehler'), { status: 0, retryAfterMs: 0 });
      }
    );
  }
  if (typeof fetch !== 'undefined') {
    return fetchWithTimeout(
      url,
      { method: 'POST', ...(headers ? { headers } : {}), body: data },
      { timeoutMs, source: 'discord', label }
    ).then(
      async res => {
        if (res.ok) {
          if (!parseJson) return undefined;
          return typeof res.json === 'function' ? await res.json().catch(() => ({})) : {};
        }
        throw discordError(res.status, await res.text().catch(() => ''), res.headers);
      },
      err => {
        throw Object.assign(new Error(err?.timeout ? 'Timeout' : 'Netzwerkfehler'), { status: 0, retryAfterMs: 0 });
      }
    );
  }
  return Promise.reject(new Error('Kein HTTP-Transport verfügbar'));
}

export function postDealImageToDiscord(webhookUrl, content, pngBlob, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
      if (!(pngBlob instanceof Blob)) return reject(new Error('Ungültige Bilddaten'));
      if (typeof FormData === 'undefined') return reject(new Error('Kein Multipart-Transport'));
      const form = new FormData();
      const body = { content, allowed_mentions: { parse: [] } };
      const productBlob = options.productImageBlob instanceof Blob ? options.productImageBlob : null;
      const keepaBlob = options.keepaImageBlob instanceof Blob ? options.keepaImageBlob : null;

      const files = [];
      if (productBlob) files.push({ name: 'produkt.png', blob: productBlob });
      files.push({ name: 'preisverlauf.png', blob: pngBlob });
      if (keepaBlob) files.push({ name: 'keepa.png', blob: keepaBlob });

      if (files.length > 1) {
        body.embeds = files.map(f => ({ image: { url: `attachment://${f.name}` } }));
      } else if (typeof options.productImageUrl === 'string' && options.productImageUrl) {
        body.embeds = [{ image: { url: options.productImageUrl } }];
      }
      if (typeof options.threadName === 'string' && options.threadName) body.thread_name = options.threadName;
      form.append('payload_json', JSON.stringify(body));
      if (files.length > 1) {
        files.forEach((f, idx) => form.append(`files[${idx}]`, f.blob, f.name));
      } else {
        form.append('file', pngBlob, 'preisverlauf.png');
      }
      discordPost({ url: withWaitQuery(webhookUrl), data: form, timeoutMs: 20000, label: 'multipart' })
        .then(resolve, err => reject(err?.message === 'Kein HTTP-Transport verfügbar' ? new Error('Kein Multipart-Transport') : err));
    } catch { reject(new Error('Upload fehlgeschlagen')); }
  });
}

export function postDealToDiscord(webhookUrl, content, options = {}) {
  if (!isDiscordWebhookUrl(webhookUrl)) return Promise.reject(new Error('Ungültige Webhook-URL'));
  const body = { content, allowed_mentions: { parse: [] } };
  if (typeof options.productImageUrl === 'string' && options.productImageUrl) body.embeds = [{ image: { url: options.productImageUrl } }];
  if (typeof options.threadName === 'string' && options.threadName) body.thread_name = options.threadName;
  return discordPost({
    url: withWaitQuery(webhookUrl),
    data: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    timeoutMs: 15000
  });
}

export function postFollowUp(webhookUrl, threadId, text) {
  if (!isDiscordWebhookUrl(webhookUrl)) return Promise.reject(new Error('Ungültige Webhook-URL'));
  const base = webhookUrl.trim();
  let url = base;
  if (threadId) {
    try {
      const u = new URL(base);
      u.searchParams.set('thread_id', String(threadId));
      url = u.toString();
    } catch {
      url = `${base}${base.includes('?') ? '&' : '?'}thread_id=${encodeURIComponent(threadId)}`;
    }
  }
  return discordPost({
    url,
    data: JSON.stringify({ content: text, allowed_mentions: { parse: [] } }),
    headers: { 'Content-Type': 'application/json' },
    timeoutMs: 15000,
    parseJson: false
  });
}
