/**
 * Discord Deal-Sharing
 * 1-Klick-Share verifizierter Tiefstpreise in einen Discord-Channel via
 * user-eigenem Webhook (GM-privat gespeichert, nie im Repo/Export/localStorage).
 */

import { SELECTORS } from '../page/selectors.js';
import { parsePrice, priceToCents, recordRefForPrice } from '../domain/price.js';
import { getDisplayDelta, getLevelPct, medianHorizonLabel } from '../domain/deal-score.js';
import { renderDiscordChart } from '../ui/sparkline.js';
export const isDiscordWebhookUrl = url =>
  typeof url === 'string' &&
  /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/.+/.test(url.trim());
// Forum-/Media-Channel brauchen thread_name (sonst 405/400, nichts erstellt).
// Thread-/Channel-Namen: 1-100 Zeichen (Discord Channel-Doku).
export const buildThreadName = title => ((title || '').replace(/\s+/g, ' ').trim() || 'Toppreise-Deal').slice(0, 100);
export const isForumThreadError = err => /^Discord (400|405)$/.test(err?.message || '');
export function discordForumFlagKey(webhookUrl) {
  let h = 5381;
  const s = String(webhookUrl || '').trim();
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `DISCORD_FORUM:${h.toString(16).padStart(8, '0')}`;
}

// Geprüfte Preishistorie als Text-Sparkline (SVG geht nicht nach Discord).
const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
export function sparklineText(timeSeries, width = 20) {
  if (!Array.isArray(timeSeries)) return '';
  const all = timeSeries.map(p => (Array.isArray(p) ? +p[1] : 0)).filter(p => p > 0);
  if (all.length < 2) return '';
  // Gleichmäßig über die gesamte Historie, nicht nur das letzte Fenster
  // (ein lange stabiler Tiefpreis sähe sonst fälschlich flach aus).
  const prices = all.length <= width ? all : Array.from({ length: width }, (_, i) => all[Math.floor((i * all.length) / width)]);
  const min = Math.min(...prices);
  const range = Math.max(...prices) - min || 1;
  return prices.map(p => SPARK_CHARS[Math.min(7, Math.floor(((p - min) / range) * 8))]).join('');
}
// Historie endet am letzten Sample, nicht am Live-Kartenpreis (kann seitdem
// gefallen sein). Für den PNG-Chart den Livepreis anhängen, damit Linie und
// Endpunkt-Markierung am aktuellen Preis enden. Reine Funktion, nie mutierend.
export function withLivePrice(timeSeries, price) {
  if (!Array.isArray(timeSeries) || timeSeries.length === 0) return timeSeries;
  if (!(price > 0)) return timeSeries;
  const last = timeSeries[timeSeries.length - 1];
  if (Array.isArray(last) && +last[1] === price) return timeSeries;
  return [...timeSeries, [Date.now(), price]];
}
// Preischart als PNG für Discord: vorhandenes SVG groß rendern, rastern, als
// Webhook-Attachment hochladen. Reine Browser-APIs — ohne DOM kein Bild (null).
export function renderSparklinePng(timeSeries, width = 360, height = 100) {
  return new Promise(resolve => {
    try {
      if (typeof document === 'undefined') return resolve(null);
      const svg = renderDiscordChart(timeSeries, width, height);
      if (!svg) return resolve(null);
      const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width * 2;
          canvas.height = height * 2;
          canvas.getContext('2d').drawImage(img, 0, 0, width * 2, height * 2);
          URL.revokeObjectURL(svgUrl);
          canvas.toBlob(b => resolve(b), 'image/png');
        } catch { resolve(null); }
      };
      img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(null); };
      img.src = svgUrl;
    } catch { resolve(null); }
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
      if (typeof GM_xmlhttpRequest === 'undefined') return reject(new Error('Kein HTTP-Transport verfügbar'));
      GM_xmlhttpRequest({
        method: 'GET',
        url: imageUrl.trim(),
        responseType: 'blob',
        timeout: timeoutMs,
        onload: res => {
          const data = res?.response;
          if (res.status >= 200 && res.status < 300 && data) {
            const blob = data instanceof Blob ? data : new Blob([data]);
            if (!blob.size) return reject(new Error('Leeres Bild'));
            if (blob.type && !blob.type.startsWith('image/')) return reject(new Error('Ungültiges Bild'));
            resolve(blob);
          } else reject(new Error(`Bild-Download ${res.status}`));
        },
        onerror: () => reject(new Error('Netzwerkfehler')),
        ontimeout: () => reject(new Error('Timeout'))
      });
    } catch (err) { reject(err); }
  });
}

function gmPost({ url, data, headers, timeoutMs }) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'POST',
      url,
      ...(headers ? { headers } : {}),
      data,
      timeout: timeoutMs,
      onload: res => (res.status >= 200 && res.status < 300 ? resolve() : reject(new Error(`Discord ${res.status}`))),
      onerror: () => reject(new Error('Netzwerkfehler')),
      ontimeout: () => reject(new Error('Timeout'))
    });
  });
}

export function postDealImageToDiscord(webhookUrl, content, pngBlob, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
      if (!(pngBlob instanceof Blob)) return reject(new Error('Ungültige Bilddaten'));
      if (typeof FormData === 'undefined') return reject(new Error('Kein Multipart-Transport'));
      const form = new FormData();
      const body = { content };
      const productBlob = options.productImageBlob instanceof Blob ? options.productImageBlob : null;
      if (productBlob) {
        body.embeds = [{ image: { url: 'attachment://produkt.png' } }, { image: { url: 'attachment://preisverlauf.png' } }];
      } else if (typeof options.productImageUrl === 'string' && options.productImageUrl) {
        body.embeds = [{ image: { url: options.productImageUrl } }];
      }
      if (typeof options.threadName === 'string' && options.threadName) body.thread_name = options.threadName;
      form.append('payload_json', JSON.stringify(body));
      if (productBlob) {
        form.append('files[0]', productBlob, 'produkt.png');
        form.append('files[1]', pngBlob, 'preisverlauf.png');
      } else {
        form.append('file', pngBlob, 'preisverlauf.png');
      }
      const url = webhookUrl.trim();
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        gmPost({ url, data: form, timeoutMs: 20000 }).then(resolve, reject);
      } else if (typeof fetch !== 'undefined') {
        fetch(url, { method: 'POST', body: form })
          .then(res => (res.ok ? resolve() : reject(new Error(`Discord ${res.status}`))))
          .catch(() => reject(new Error('Netzwerkfehler')));
      } else {
        reject(new Error('Kein Multipart-Transport'));
      }
    } catch { reject(new Error('Upload fehlgeschlagen')); }
  });
}

// Baukasten-Layout: je Zeile ein Baustein, Größe via # / ## / -# am
// Zeilenanfang. · blendet leere Nachbarn aus, +{offers} rendert kompakt +N (leer bei 0). {link} nur bei aktivem Embed.
export const DEFAULT_LAYOUT = '## {title}\n# {price}\n# {dealer} +{offers}\n{spark}\n{prevlow}\n{median}\n{link}';
export const LAYOUT_TOKENS = new Set(['title', 'price', 'dealer', 'offers', 'spark', 'prevlow', 'median', 'link']);
export function validateLayoutRecipe(recipe) {
  const value = String(recipe ?? '');
  if (!value.trim()) return 'Layout ist leer';
  const unknown = [...new Set([...value.matchAll(/\{([^}]*)\}/g)].map(m => m[1]))].filter(n => !LAYOUT_TOKENS.has(n));
  return unknown.length ? `Unbekannte Tokens: ${unknown.map(n => `{${n}}`).join(', ')}` : null;
}

export function layoutOverLimitSuffix(renderedLength, recipe) {
  if (renderedLength <= 2000) return '';
  return String(recipe ?? '').includes('{title}') ? ' — über Limit, Titel wird gekürzt' : ' — über Limit, wird hart auf 2000 gekürzt';
}
const escapePreviewHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mdInlineText = text => text
  .replace(/(?<!&lt;)https?:\/\/[^\s<]+?(?=&gt;|[\s<]|$)/g, '<span class="tp-md-url">$&</span>')
  .replace(/&lt;(https?:\/\/\S+?)&gt;/g, '<span class="tp-md-url">$1</span>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
export function renderDiscordMarkdownPreview(markdown) {
  return String(markdown ?? '').replace(/\r/g, '').split('\n').map(rawLine => {
    let line = rawLine;
    let cls = '';
    const prefix = line.match(/^(##|#|-#)\s?/);
    if (prefix) {
      cls = prefix[1] === '##' ? 'tp-md-lg' : prefix[1] === '#' ? 'tp-md-md' : 'tp-md-sm';
      line = line.slice(prefix[0].length);
    }
    const parts = escapePreviewHtml(line).split(/\[([^\]]*)\]\(([^)]+)\)/g);
    let html = '';
    for (let i = 0; i < parts.length; i += 3) {
      html += mdInlineText(parts[i]);
      if (i + 2 < parts.length) html += `<span class="tp-md-link">${parts[i + 1]}</span> <span class="tp-md-url">${parts[i + 2].replace(/^&lt;|&gt;$/g, '')}</span>`;
    }
    return cls ? `<span class="${cls}">${html}</span>` : html;
  }).join('<br>');
}
const boldNumbers = s => (s || '').replace(/(CHF [\d.'’]+|-?\d+(?:[.,]\d+)?\s*%)/g, '**$1**');
const withPct = (text, pct) => pct > 0 ? `${text} -${pct}%` : text;
const cleanTitleOf = title => (title || 'Toppreise-Deal').replace(/\s+/g, ' ').trim();
function tokenText(name, ctx) {
  switch (name) {
    case 'title': return ctx.link ? `[${ctx.cleanTitle}](${ctx.titleTarget})` : ctx.cleanTitle;
    case 'price': return ctx.priceText ? `💰 ${ctx.priceText}` : '';
    case 'dealer': return ctx.dealer ? (ctx.dealerTarget ? `🏬 [${ctx.dealer}](${ctx.dealerTarget})` : `🏬 ${ctx.dealer}`) : '';
    case 'offers': return ctx.offerCount ? `🛒 ${ctx.offerCount} Angebote` : '';
    case 'spark': return ctx.spark ? `📊 ${ctx.spark}` : '';
    case 'prevlow': return ctx.prevLowText ? `📉 ${boldNumbers(withPct(ctx.prevLowText, ctx.prevLowPct))}` : '';
    case 'median': return ctx.medianText ? `📈 ${boldNumbers(withPct(ctx.medianText, ctx.medianPct))}` : '';
    case 'link': return (ctx.link && !ctx.suppressProductEmbed) ? ctx.link : '';
    default: return '';
  }
}
export function renderLayout(fields = {}, recipe = DEFAULT_LAYOUT) {
  recipe = String(recipe || '').replace(/\r/g, '');
  if (!recipe.trim()) recipe = DEFAULT_LAYOUT;
  const link = ((fields || {}).url || '').trim();
  const dealerUrl = (fields || {}).dealerUrl || '';
  const ctx = {
    cleanTitle: cleanTitleOf((fields || {}).title),
    link,
    titleTarget: link ? (((fields || {}).suppressProductEmbed && link) ? `<${link}>` : link) : '',
    priceText: (fields || {}).priceText || '',
    dealer: (fields || {}).dealer || '',
    dealerTarget: dealerUrl ? ((fields || {}).suppressDealerEmbed ? `<${dealerUrl}>` : dealerUrl) : '',
    offerCount: (fields || {}).offerCount || 0,
    spark: (fields || {}).spark || '',
    prevLowText: (fields || {}).prevLowText || '',
    prevLowPct: (fields || {}).prevLowPct || 0,
    medianText: (fields || {}).medianText || '',
    medianPct: (fields || {}).medianPct || 0,
    suppressProductEmbed: (fields || {}).suppressProductEmbed === true,
  };
  const out = [];
  for (const rawLine of recipe.split('\n')) {
    const line = rawLine.replace(/\s*\+\{offers\}/g, ctx.offerCount ? ` +${ctx.offerCount}` : '').replace(/\{([a-z]+)\}/g, (m, name) => LAYOUT_TOKENS.has(name) ? tokenText(name, ctx) : '').replace(/\s*·\s*·\s*/g, ' · ').replace(/^([#-]+)\s*·\s*/g, '$1 ').replace(/^\s*·\s*|\s*·\s*$/g, '').replace(/^([#-]+)\s+/g, '$1 ').replace(/\s\+(?!\d)\s*$/g, '');
    if (line.replace(/^[#\s-]+/, '').trim() === '') continue;
    out.push(line);
  }
  return out.join('\n');
}
export function formatDealMessage(fields = {}, recipe = DEFAULT_LAYOUT) {
  const full = renderLayout(fields, recipe);
  if (full.length <= 2000) return full;
  const cleanTitle = cleanTitleOf((fields || {}).title);
  const over = full.length - 2000;
  const shrunk = cleanTitle.slice(0, Math.max(20, cleanTitle.length - over));
  return renderLayout({ ...(fields || {}), title: shrunk }, recipe).slice(0, 2000);
}

// Reine Abbildung Kartenpreis + Stats → Discord-Referenzzeilen (Bisher / Ø-Preis
// je mit eigenem Rabatt-%). Einzeln testbar, damit vertauschte % auffallen;
// der Click-Handler in ui/badges.js nutzt nur diese eine Quelle.
export function resolveShareFields(cardPrice, stats) {
  const prevLow = recordRefForPrice(stats, cardPrice).previousLow;
  const medianVal = stats?.medianPrice;
  const prevLowShown = prevLow && priceToCents(prevLow) > priceToCents(cardPrice);
  const medianShown = medianVal && priceToCents(medianVal) > priceToCents(cardPrice);
  return {
    prevLowText: prevLowShown ? `CHF ${prevLow.toFixed(2)}` : '',
    prevLowPct: prevLowShown ? (getDisplayDelta(cardPrice, stats).dRecord || 0) : 0,
    medianText: medianShown ? `Ø-Preis (${medianHorizonLabel(stats)}): CHF ${medianVal.toFixed(2)}` : '',
    medianPct: medianShown ? (getLevelPct(cardPrice, stats) || 0) : 0
  };
}

// Titel + Produktlink aus der Karte ziehen (alles tolerant, Layout-wechsel-sicher).
export function extractShareData(card) {
  if (!card?.querySelector) return { title: '', url: '', imageUrl: '' };
  const titleEl = card.querySelector('.product-name, .productDetails, .bold, a[title]');
  const title = titleEl?.textContent?.trim() || titleEl?.getAttribute?.('title') || '';
  const linkEl = card.querySelector('a[href*="/preisvergleich/"]')
    || (card.tagName?.toLowerCase() === 'a' ? card : null);
  let url = linkEl?.getAttribute?.('href') || linkEl?.href || '';
  if (url && !/^https?:\/\//i.test(url)) {
    try { url = new URL(url, location.href).href; } catch { /* relativ lassen */ }
  }
  const imgEl = card.querySelector('.product-image img, .productImage img, .image_container img, .Plugin_Product img, img');
  let imageUrl = imgEl?.currentSrc || imgEl?.src
    || imgEl?.getAttribute?.('data-src') || imgEl?.getAttribute?.('data-original') || '';
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    if (/^\s*data:/i.test(imageUrl)) imageUrl = '';
    else try { imageUrl = new URL(imageUrl, location.href).href; } catch { imageUrl = ''; }
  }
  if (!/^https?:\/\//i.test(imageUrl)) imageUrl = '';
  return { title, url, imageUrl };
}

// Angezeigten Händler (günstigste Zeile zuerst) als Klartext.
export function extractDealer(card) {
  const el = card?.querySelector?.(`${SELECTORS.cards.dealerRows} .title`);
  return el?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

// Direktlink zum Händlerangebot aus der Händlerzeile (Katalog), falls verlinkt.
export function extractDealerUrl(card) {
  const a = card?.querySelector?.(`${SELECTORS.cards.dealerRows} a[href]`);
  let url = a?.getAttribute?.('href') || a?.href || '';
  if (url && !/^https?:\/\//i.test(url)) {
    try { url = new URL(url, location.href).href; } catch { /* relativ lassen */ }
  }
  return url;
}

// Schema.org-JSON-LD aus statischem HTML lesen: Händlerzeilen sind AJAX-gerendert
// und fehlen im Fetch-HTML, `offers` steht dagegen schon in der Rohseite.
export function parseJsonLdOffer(json) {
  const roots = Array.isArray(json) ? json : [json];
  for (const root of roots) {
    const items = Array.isArray(root?.['@graph']) ? root['@graph'] : [root];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      if (!types.includes('Product')) continue;
      const list = Array.isArray(item.offers) ? item.offers : (item.offers ? [item.offers] : null);
      if (!list) continue;
      if (list.length === 1 && list[0]?.['@type'] === 'AggregateOffer' && !Array.isArray(list[0].offers)) {
        const n = +list[0].offerCount; // kein Verkäufer, aber echte Angebotszahl
        return { dealer: '', offers: Number.isFinite(n) ? Math.round(n) : 0 };
      }
      let best = null;
      for (const o of list) {
        const price = +o?.price;
        if (!Number.isFinite(price)) continue; // fehlendes price: Angebot überspringen
        if (!best || price < best.price) best = { price, dealer: typeof o.seller === 'object' ? (o.seller?.name || '') : (o.seller || '') };
      }
      if (best) return { dealer: best.dealer, offers: list.length };
    }
  }
  return { dealer: '', offers: 0 };
}

// Produktseiten listen Angebote als .Plugin_Offer-Blöcke (Preis-aufsteigend,
// statisch im HTML, live verifiziert 2026-10-09): Shopname im Logo-alt, je ein
// Produkt-/Versandpreis. Günstigstes Angebot auf Karten-Basis wählen (Min statt
// erste Zeile: robust gegen fremde Sortier-Cookies; nur Seite 1 geparst).
export function parseProductOffers(doc) {
  const blocks = Array.from(doc?.querySelectorAll?.('.Plugin_Offer') || []);
  return blocks.map(block => {
    const logo = block.querySelector?.('.Plugin_ShopLogo img[alt], .Plugin_ShopLogo img[title]');
    const dealer = logo?.getAttribute?.('alt') || logo?.getAttribute?.('title') || '';
    const product = parsePrice(block.querySelector?.(SELECTORS.price.fallbackProduct)?.textContent);
    const shipping = parsePrice(block.querySelector?.(SELECTORS.price.fallbackShipping)?.textContent);
    const link = block.querySelector?.('a[href*="ext_de"]');
    const url = link?.getAttribute?.('href') || link?.href || '';
    return { dealer: dealer.replace(/\s+/g, ' ').trim(), product: product || 0, shipping: shipping || 0, url: url || '' };
  }).filter(o => o.dealer || o.product > 0 || o.shipping > 0);
}

export function pickCheapestOffer(offers, useShipping = false) {
  let best = null;
  for (const o of offers || []) {
    const price = useShipping ? (o.shipping || o.product) : (o.product || o.shipping);
    if (!(price > 0)) continue;
    if (!best || price < best.price) best = { price, dealer: o.dealer || '', url: o.url || '' };
  }
  return best || { price: 0, dealer: '', url: '' };
}

// Feed-Karten tragen keine Händlerzeilen: Produktseite nachladen (nur bei Klick,
// same-origin, kein CORS-Problem). Katalog-Zeilen → .Plugin_Offer-Blöcke (inkl.
// /ext_de-Direktlink zum günstigsten Angebot) → JSON-LD (nur Count). Händler
// immer auf Karten-Preisbasis (Versand/Produkt).
export async function fetchProductInfo(productUrl, timeoutMs = 10000, useShipping = false) {
  const out = { dealer: '', offers: 0, dealerUrl: '' };
  try {
    if (typeof fetch === 'undefined' || typeof DOMParser === 'undefined') return out;
    if (!/^https?:\/\//i.test(productUrl || '')) return out;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    const res = await fetch(productUrl, { signal: ctrl?.signal });
    clearTimeout(timer);
    if (!res.ok) return out;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const titles = Array.from(doc.querySelectorAll(`${SELECTORS.cards.dealerRows} .title`));
    // ponytail: first row is the cheapest offer on Toppreise listings
    out.dealer = titles[0]?.textContent?.replace(/\s+/g, ' ').trim() || '';
    out.offers = titles.length;
    if (out.dealer || out.offers) return out;
    const offers = parseProductOffers(doc);
    if (offers.length) {
      out.offers = offers.length;
      const best = pickCheapestOffer(offers, useShipping);
      out.dealer = best.dealer;
      if (best.url) {
        try { out.dealerUrl = new URL(best.url, productUrl).href; } catch { out.dealerUrl = best.url; }
      }
      return out;
    }
    const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of scripts) {
      try {
        const found = parseJsonLdOffer(JSON.parse(s.textContent));
        if (found.dealer || found.offers) return { dealer: found.dealer, offers: found.offers, dealerUrl: '' };
      } catch { /* Block einzeln ignorieren */ }
    }
    console.debug('[Toppreise-Suite] Händler-Fallback leer', { htmlBytes: html.length, rowCount: titles.length, jsonLdBlocks: scripts.length });
  } catch { /* Händler unbekannt: Zeile entfällt */ }
  return out;
}
export function postDealToDiscord(webhookUrl, content, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
    const url = webhookUrl.trim();
    const body = { content };
    if (typeof options.productImageUrl === 'string' && options.productImageUrl) body.embeds = [{ image: { url: options.productImageUrl } }];
    if (typeof options.threadName === 'string' && options.threadName) body.thread_name = options.threadName;
    const payload = JSON.stringify(body);
    if (typeof GM_xmlhttpRequest !== 'undefined') {
      gmPost({ url, data: payload, headers: { 'Content-Type': 'application/json' }, timeoutMs: 15000 }).then(resolve, reject);
    } else if (typeof fetch !== 'undefined') {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
        .then(res => (res.ok ? resolve() : reject(new Error(`Discord ${res.status}`))))
        .catch(() => reject(new Error('Netzwerkfehler')));
    } else {
      reject(new Error('Kein HTTP-Transport verfügbar'));
    }
  });
}
