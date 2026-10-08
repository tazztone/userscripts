/**
 * Discord Deal-Sharing
 * 1-Klick-Share verifizierter Tiefstpreise in einen Discord-Channel via
 * user-eigenem Webhook (GM-privat gespeichert, nie im Repo/Export/localStorage).
 */

import { SELECTORS } from '../page/selectors.js';

export const isDiscordWebhookUrl = url =>
  typeof url === 'string' &&
  /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/.+/.test(url.trim());

// Geprüfte Preishistorie als Text-Sparkline (SVG geht nicht nach Discord).
const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
export function sparklineText(timeSeries, width = 20) {
  if (!Array.isArray(timeSeries)) return '';
  const prices = timeSeries.map(p => (Array.isArray(p) ? +p[1] : 0)).filter(p => p > 0).slice(-width);
  if (prices.length < 2) return '';
  const min = Math.min(...prices);
  const range = Math.max(...prices) - min || 1;
  return prices.map(p => SPARK_CHARS[Math.min(7, Math.floor(((p - min) / range) * 8))]).join('');
}

// Link zuerst (unantastbar), darunter Titel/Fakten, Händler, Preisinfos.
// Der Titel schrumpft bei Bedarf — der Link wird nie angeschnitten.
export function formatDealMessage({ title, url, priceText, badgeText, dealer, offerCount, spark, prevLowText, medianText }) {
  const link = (url || '').trim();
  let cleanTitle = (title || 'Toppreise-Deal').replace(/\s+/g, ' ').trim();
  const facts = [priceText, badgeText].filter(Boolean).join(' · ');
  const meta = [dealer ? `Händler: ${dealer}` : '', offerCount ? `Angebote: ${offerCount}` : ''].filter(Boolean).join(' · ');
  const history = [spark, prevLowText, medianText].filter(Boolean).join(' · ');
  const rest = [meta, history].filter(Boolean).join('\n');
  const maxTitle = Math.max(20, 2000 - link.length - facts.length - rest.length - 16);
  cleanTitle = cleanTitle.slice(0, maxTitle);
  const head = `🔥 **${cleanTitle}**` + (facts ? ` – ${facts}` : '');
  return [link, head, rest].filter(Boolean).join('\n').slice(0, 2000);
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
