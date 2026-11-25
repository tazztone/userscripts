/**
 * Discord Deal-Sharing
 * 1-Klick-Share verifizierter Tiefstpreise in einen Discord-Channel via
 * user-eigenem Webhook (GM-privat gespeichert, nie im Repo/Export/localStorage).
 */

import { renderDiscordChart } from '../ui/sparkline.js';
import { priceToCents } from '../domain/price.js';
import { fetchWithTimeout, gmRequestWithTimeout } from '../state/net.js';

export const isDiscordWebhookUrl = url =>
  typeof url === 'string' &&
  /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/[\w-]+(?:\?[^\s#]*)?$/.test(url.trim());

// Forum-/Media-Channel brauchen thread_name (sonst 405/400, nichts erstellt).
// Thread-/Channel-Namen: 1-100 Zeichen (Discord Channel-Doku).
export const buildThreadName = title => ((title || '').replace(/\s+/g, ' ').trim() || 'Toppreise-Deal').slice(0, 100);
export function isForumThreadError(err) {
  if (!err) return false;
  if (err.status === 405 || /^Discord 405$/.test(err.message || '')) return true;
  if (err.status === 400 || /^Discord 400$/.test(err.message || '')) {
    const body = typeof err.body === 'string' ? err.body.trim() : '';
    if (!body) return true;
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed.code === 'number') {
        if (parsed.code === 220001 || parsed.code === 220003) return true;
        return /thread_name|forum/i.test(body);
      }
    } catch {}
    return /thread_name|forum/i.test(body);
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
  return new Promise(resolve => {
    let done = false;
    let svgUrl = null;
    const finish = v => { if (!done) { done = true; clearTimeout(timer); if (svgUrl) try { URL.revokeObjectURL(svgUrl); } catch {} resolve(v); } };
    const timer = setTimeout(() => finish(null), 3000);
    try {
      if (typeof document === 'undefined') return finish(null);
      const svg = renderDiscordChart(timeSeries, width, height, title);
      if (!svg) return finish(null);
      const svgText = new XMLSerializer().serializeToString(svg);
      svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      const rasterize = source => () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width * 2;
          canvas.height = height * 2;
          canvas.getContext('2d').drawImage(source, 0, 0, width * 2, height * 2);
          canvas.toBlob(b => finish(b || null), 'image/png');
        } catch { finish(null); }
      };
      img.onload = rasterize(img);
      // blob:-URL gescheitert (CSP): data-URI als Rastervorlage retryen.
      img.onerror = () => {
        const retry = new Image();
        retry.onload = rasterize(retry);
        retry.onerror = () => finish(null);
        retry.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      };
      img.src = svgUrl;
    } catch { finish(null); }
  });
}

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
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        gmRequestWithTimeout({
          method: 'GET',
          url: imageUrl.trim(),
          responseType: 'blob',
        }, { timeoutMs, source: 'discord', label: 'image' })
          .then(res => {
            const data = res?.response;
            if (res.status >= 200 && res.status < 300 && data) {
              const blob = data instanceof Blob ? data : new Blob([data]);
              if (!blob.size) return reject(new Error('Leeres Bild'));
              if (blob.size > 8 * 1024 * 1024) return reject(new Error('Bild zu gross'));
              if (blob.type && !blob.type.startsWith('image/')) return reject(new Error('Ungültiges Bild'));
              resolve(blob);
            } else reject(new Error(`Bild-Download ${res.status}`));
          })
          .catch(err => reject(new Error(err?.timeout ? 'Timeout' : 'Netzwerkfehler')));
      } else if (typeof fetch !== 'undefined') {
        fetchWithTimeout(imageUrl.trim(), {}, { timeoutMs, source: 'discord', label: 'image', readAs: 'blob' })
          .then(({ res, body: blob }) => {
            if (res.status >= 200 && res.status < 300) {
              if (!blob.size) return reject(new Error('Leeres Bild'));
              if (blob.size > 8 * 1024 * 1024) return reject(new Error('Bild zu gross'));
              if (blob.type && !blob.type.startsWith('image/')) return reject(new Error('Ungültiges Bild'));
              resolve(blob);
            } else reject(new Error(`Bild-Download ${res.status}`));
          })
          .catch(err => reject(new Error(err?.timeout ? 'Timeout' : 'Netzwerkfehler')));
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
  const ra = discordHeaderVal(headers, 'Retry-After');
  if (ra != null && ra !== '') {
    const secs = Number(ra);
    if (Number.isFinite(secs)) return Math.max(0, Math.min(60000, secs * 1000));
    const at = Date.parse(ra);
    if (Number.isFinite(at)) return Math.max(0, Math.min(60000, at - Date.now()));
  }
  const resetAfter = Number(discordHeaderVal(headers, 'X-RateLimit-Reset-After'));
  if (Number.isFinite(resetAfter)) return Math.max(0, Math.min(60000, resetAfter * 1000));
  return 0;
};
const discordError = (status, body, headers) =>
  Object.assign(new Error(status ? `Discord ${status}` : 'Netzwerkfehler'),
    { status: status ?? 0, body: discordBodyExcerpt(body), retryAfterMs: discordRetryAfterMs(headers) });

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

function gmPost({ url, data, headers, timeoutMs }) {
  return gmRequestWithTimeout({
    method: 'POST',
    url,
    ...(headers ? { headers } : {}),
    data,
  }, { timeoutMs, source: 'discord', label: 'post' })
    .then(
      (res) => {
        if (res.status >= 200 && res.status < 300) return res;
        throw discordError(res.status, res?.responseText, res?.responseHeaders);
      },
      (err) => {
        throw Object.assign(new Error(err?.timeout ? 'Timeout' : 'Netzwerkfehler'), { status: 0, retryAfterMs: 0 });
      }
    );
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
        files.forEach((f, idx) => {
          form.append(`files[${idx}]`, f.blob, f.name);
        });
      } else {
        form.append('file', pngBlob, 'preisverlauf.png');
      }
      const url = withWaitQuery(webhookUrl);
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        gmPost({ url, data: form, timeoutMs: 20000 }).then(res => resolve(parseDiscordJson(res)), reject);
      } else if (typeof fetch !== 'undefined') {
        fetchWithTimeout(url, { method: 'POST', body: form }, { timeoutMs: 20000, source: 'discord', label: 'multipart' })
          .then(async res => {
            if (res.ok) return resolve(typeof res.json === 'function' ? await res.json().catch(() => ({})) : {});
            reject(discordError(res.status, await res.text().catch(() => ''), res.headers));
          })
          .catch(err => reject(Object.assign(new Error(err?.timeout ? 'Timeout' : 'Netzwerkfehler'), { status: 0, retryAfterMs: 0 })));
      } else {
        reject(new Error('Kein Multipart-Transport'));
      }
    } catch { reject(new Error('Upload fehlgeschlagen')); }
  });
}

export function postDealToDiscord(webhookUrl, content, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
    const url = withWaitQuery(webhookUrl);
    const body = { content, allowed_mentions: { parse: [] } };
    if (typeof options.productImageUrl === 'string' && options.productImageUrl) body.embeds = [{ image: { url: options.productImageUrl } }];
    if (typeof options.threadName === 'string' && options.threadName) body.thread_name = options.threadName;
    const payload = JSON.stringify(body);
    if (typeof GM_xmlhttpRequest !== 'undefined') {
      gmPost({ url, data: payload, headers: { 'Content-Type': 'application/json' }, timeoutMs: 15000 }).then(res => resolve(parseDiscordJson(res)), reject);
    } else if (typeof fetch !== 'undefined') {
      fetchWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }, { timeoutMs: 15000, source: 'discord', label: 'post' })
        .then(async res => {
          if (res.ok) return resolve(typeof res.json === 'function' ? await res.json().catch(() => ({})) : {});
          reject(discordError(res.status, await res.text().catch(() => ''), res.headers));
        })
        .catch(err => reject(Object.assign(new Error(err?.timeout ? 'Timeout' : 'Netzwerkfehler'), { status: 0, retryAfterMs: 0 })));
    } else {
      reject(new Error('Kein HTTP-Transport verfügbar'));
    }
  });
}

export function postFollowUp(webhookUrl, threadId, text) {
  return new Promise((resolve, reject) => {
    if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
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
    const payload = JSON.stringify({ content: text, allowed_mentions: { parse: [] } });
    if (typeof GM_xmlhttpRequest !== 'undefined') {
      gmPost({ url, data: payload, headers: { 'Content-Type': 'application/json' }, timeoutMs: 15000 }).then(() => resolve(), reject);
    } else if (typeof fetch !== 'undefined') {
      fetchWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }, { timeoutMs: 15000, source: 'discord', label: 'post' })
        .then(async res => {
          if (res.ok) return resolve();
          reject(discordError(res.status, await res.text().catch(() => ''), res.headers));
        })
        .catch(err => reject(Object.assign(new Error(err?.timeout ? 'Timeout' : 'Netzwerkfehler'), { status: 0, retryAfterMs: 0 })));
    } else {
      reject(new Error('Kein HTTP-Transport verfügbar'));
    }
  });
}
