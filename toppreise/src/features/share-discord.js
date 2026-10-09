/**
 * Discord Deal-Sharing
 * 1-Klick-Share verifizierter Tiefstpreise in einen Discord-Channel via
 * user-eigenem Webhook (GM-privat gespeichert, nie im Repo/Export/localStorage).
 */

import { SELECTORS } from '../page/selectors.js';
import { priceToCents, recordRefForPrice } from '../domain/price.js';
import { getDisplayDelta, getLevelPct, medianHorizonLabel } from '../domain/deal-score.js';
import { renderSparkline } from '../ui/sparkline.js';
export const isDiscordWebhookUrl = url =>
  typeof url === 'string' &&
  /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/.+/.test(url.trim());

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
// Preischart als PNG für Discord: vorhandenes SVG groß rendern, rastern, als
// Webhook-Attachment hochladen. Reine Browser-APIs — ohne DOM kein Bild (null).
export function renderSparklinePng(timeSeries, width = 360, height = 100) {
  return new Promise(resolve => {
    try {
      if (typeof document === 'undefined') return resolve(null);
      const svg = renderSparkline(timeSeries, width, height, { axes: true });
      if (!svg) return resolve(null);
      const NS = 'http://www.w3.org/2000/svg';
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('width', String(width));
      bg.setAttribute('height', String(height));
      bg.setAttribute('rx', '8');
      bg.setAttribute('fill', '#1e293b');
      svg.insertBefore(bg, svg.firstChild);
      svg.querySelector('polyline')?.setAttribute('stroke-width', '2.5');
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
export function postDealImageToDiscord(webhookUrl, content, pngBlob) {
  return new Promise((resolve, reject) => {
    try {
      if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
      if (!(pngBlob instanceof Blob)) return reject(new Error('Ungültige Bilddaten'));
      if (typeof GM_xmlhttpRequest === 'undefined' || typeof FormData === 'undefined') return reject(new Error('Kein Multipart-Transport'));
      const form = new FormData();
      form.append('payload_json', JSON.stringify({ content }));
      form.append('file', pngBlob, 'preisverlauf.png');
      GM_xmlhttpRequest({
        method: 'POST',
        url: webhookUrl.trim(),
        data: form,
        timeout: 20000,
        onload: res => (res.status >= 200 && res.status < 300 ? resolve() : reject(new Error(`Discord ${res.status}`))),
        onerror: () => reject(new Error('Netzwerkfehler')),
        ontimeout: () => reject(new Error('Timeout'))
      });
    } catch { reject(new Error('Upload fehlgeschlagen')); }
  });
}

// Ein Wert pro Zeile (scannbar, Zahlen fett): Link zuerst (unantastbar), dann
// Titel, Preis, Händler, Verlauf. Rabatte stehen je Referenzzeile (Bisher /
// Ø-Preis), nicht gebündelt in der Preiszeile.
const boldNumbers = s => (s || '').replace(/(CHF [\d.'’]+|-?\d+(?:[.,]\d+)?\s*%)/g, '**$1**');
const withPct = (text, pct) => pct > 0 ? `${text} -${pct}%` : text;
export function formatDealMessage({ title, url, priceText, dealer, offerCount, spark, prevLowText, prevLowPct, medianText, medianPct }) {
  const link = (url || '').trim();
  let cleanTitle = (title || 'Toppreise-Deal').replace(/\s+/g, ' ').trim();
  const rest = [
    priceText ? `💰 ${boldNumbers(priceText)}` : '',
    dealer ? `🏬 Händler: **${dealer}**` : '',
    offerCount ? `🛒 Angebote: **${offerCount}**` : '',
    spark ? `📊 ${spark}` : '',
    prevLowText ? `📉 ${boldNumbers(withPct(prevLowText, prevLowPct))}` : '',
    medianText ? `📈 ${boldNumbers(withPct(medianText, medianPct))}` : ''
  ].filter(Boolean).join('\n');
  const maxTitle = Math.max(20, 2000 - link.length - rest.length - 32);
  cleanTitle = cleanTitle.slice(0, maxTitle);
  return [link, `🔥 **${cleanTitle}**`, rest].filter(Boolean).join('\n').slice(0, 2000);
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
    prevLowText: prevLowShown ? `Bisher: CHF ${prevLow.toFixed(2)}` : '',
    prevLowPct: prevLowShown ? (getDisplayDelta(cardPrice, stats).dRecord || 0) : 0,
    medianText: medianShown ? `Ø-Preis (${medianHorizonLabel(stats)}): CHF ${medianVal.toFixed(2)}` : '',
    medianPct: medianShown ? (getLevelPct(cardPrice, stats) || 0) : 0
  };
}

// Titel + Produktlink aus der Karte ziehen (alles tolerant, Layout-wechsel-sicher).
export function extractShareData(card) {
  if (!card?.querySelector) return { title: '', url: '' };
  const titleEl = card.querySelector('.product-name, .productDetails, .bold, a[title]');
  const title = titleEl?.textContent?.trim() || titleEl?.getAttribute?.('title') || '';
  const linkEl = card.querySelector('a[href*="/preisvergleich/"]')
    || (card.tagName?.toLowerCase() === 'a' ? card : null);
  let url = linkEl?.getAttribute?.('href') || linkEl?.href || '';
  if (url && !/^https?:\/\//i.test(url)) {
    try { url = new URL(url, location.href).href; } catch { /* relativ lassen */ }
  }
  return { title, url };
}

// Angezeigten Händler (günstigste Zeile zuerst) als Klartext.
export function extractDealer(card) {
  const el = card?.querySelector?.(`${SELECTORS.cards.dealerRows} .title`);
  return el?.textContent?.replace(/\s+/g, ' ').trim() || '';
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

// Feed-Karten tragen keine Händlerzeilen: Produktseite nachladen (nur bei Klick,
// same-origin, kein CORS-Problem). Erste Zeile = günstigstes Angebot, sonst JSON-LD.
export async function fetchProductInfo(productUrl, timeoutMs = 10000) {
  const out = { dealer: '', offers: 0 };
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
    const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of scripts) {
      try {
        const found = parseJsonLdOffer(JSON.parse(s.textContent));
        if (found.dealer || found.offers) return found;
      } catch { /* Block einzeln ignorieren */ }
    }
    console.debug('[Toppreise-Suite] Händler-Fallback leer', { htmlBytes: html.length, rowCount: titles.length, jsonLdBlocks: scripts.length });
  } catch { /* Händler unbekannt: Zeile entfällt */ }
  return out;
}

// GM_xmlhttpRequest umgeht CORS (Violentmonkey), fetch ist Fallback.
export function postDealToDiscord(webhookUrl, content) {
  return new Promise((resolve, reject) => {
    if (!isDiscordWebhookUrl(webhookUrl)) return reject(new Error('Ungültige Webhook-URL'));
    const url = webhookUrl.trim();
    const payload = JSON.stringify({ content });
    if (typeof GM_xmlhttpRequest !== 'undefined') {
      GM_xmlhttpRequest({
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        data: payload,
        timeout: 15000,
        onload: res => (res.status >= 200 && res.status < 300 ? resolve() : reject(new Error(`Discord ${res.status}`))),
        onerror: () => reject(new Error('Netzwerkfehler')),
        ontimeout: () => reject(new Error('Timeout'))
      });
    } else if (typeof fetch !== 'undefined') {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
        .then(res => (res.ok ? resolve() : reject(new Error(`Discord ${res.status}`))))
        .catch(() => reject(new Error('Netzwerkfehler')));
    } else {
      reject(new Error('Kein HTTP-Transport verfügbar'));
    }
  });
}
