/**
 * Product Offers & Dealer Extraction
 * DOM and JSON-LD scrapers for product offers, dealers, and shop links on toppreise.ch.
 */

import { SELECTORS } from './selectors.js';
import { parsePrice } from '../domain/price.js';
import { getCachedAsin, setCachedAsin } from '../scanner/cache.js';

const isToppreiseProductUrl = u => {
  try {
    const parsed = new URL(u);
    if (parsed.hostname !== 'toppreise.ch' && parsed.hostname !== 'www.toppreise.ch') return false;
    return parsed.pathname.startsWith('/preisvergleich/');
  } catch { return false; }
};

// Titel + Produktlink aus der Karte ziehen (alles tolerant, Layout-wechsel-sicher).
export function extractShareData(card) {
  if (!card?.querySelector) return { title: '', url: '', imageUrl: '' };
  const titleEl = card.querySelector('.product-name, .productDetails, .bold, a[title]');
  // Review-Button (Schritt 9) hängt im Titel-Element: für Titelzwecke ausblenden,
  // sonst frisst sich sein Emoji bei jedem Re-Render in Titel, Query und Share-Text.
  let title = '';
  if (titleEl) {
    const clone = typeof titleEl.cloneNode === 'function' ? titleEl.cloneNode(true) : null;
    clone?.querySelectorAll?.('.tp-review-search-btn')?.forEach(el => el.remove());
    title = (clone?.textContent ?? titleEl.textContent)?.trim() || titleEl.getAttribute?.('title') || '';
  }
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
  if (url && !isToppreiseProductUrl(url)) url = '';
  return { title, url, imageUrl };
}

// Günstigste Händlerzeile auf Karten-Basis (Name + Link aus derselben Zeile):
// ohne parsebaren Basispreis gewinnt die erste Zeile (bisheriges Verhalten).
export function extractCheapestDealerRow(card, useShipping = false) {
  const rows = Array.from(card?.querySelectorAll?.(SELECTORS.cards.dealerRows) || []);
  if (!rows.length) return null;
  const priceSel = useShipping ? '.shippingPrice .Plugin_Price' : '.productPrice .Plugin_Price';
  let best = null;
  for (const row of rows) {
    const price = parsePrice(row.querySelector?.(priceSel)?.textContent);
    if (!(price > 0)) continue;
    if (!best || price < best.price) best = { row, price };
  }
  return best ? best.row : rows[0];
}

// Angezeigten Händler (günstigste Zeile zuerst) als Klartext.
export function extractDealer(card, useShipping = false) {
  const row = extractCheapestDealerRow(card, useShipping);
  return row?.querySelector?.('.title')?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

// Direktlink zum Händlerangebot aus der Händlerzeile (Katalog), falls verlinkt.
export function extractDealerUrl(card, useShipping = false) {
  const a = extractCheapestDealerRow(card, useShipping)?.querySelector?.('a[href]');
  let url = a?.getAttribute?.('href') || a?.href || '';
  if (url && !/^https?:\/\//i.test(url)) {
    try { url = new URL(url, location.href).href; } catch { /* relativ lassen */ }
  }
  return /^https:/i.test(url) ? url : '';
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
      const agg = list.length === 1 && list[0]?.['@type'] === 'AggregateOffer' ? list[0] : null;
      if (agg) {
        // Nested offer objects beat a bare count: recurse into them so the
        // dealer comes from real rows, not an ID list.
        if (Array.isArray(agg.offers) && agg.offers.length) {
          const nested = parseJsonLdOffer({ '@type': 'Product', offers: agg.offers });
          if (nested.dealer || nested.offers) {
            if (!nested.totalOffers) { const t = Number(agg.offerCount); if (Number.isFinite(t) && t > 0) nested.totalOffers = Math.round(t); }
            return nested;
          }
        }
        // Count-only: no loaded rows (offers 0), but a real total.
        const n = +agg.offerCount;
        return { dealer: '', offers: 0, totalOffers: Number.isFinite(n) && n > 0 ? Math.round(n) : 0 };
      }
      let best = null;
      for (const o of list) {
        // Strict: +null/+'' coerce to 0 and must never win as "cheapest".
        const price = Number(o?.price);
        if (!Number.isFinite(price) || !(price > 0)) continue;
        if (!best || price < best.price) best = { price, dealer: typeof o.seller === 'object' ? (o.seller?.name || '') : (o.seller || '') };
      }
      if (best) return { dealer: best.dealer, offers: list.length, totalOffers: 0 };
    }
  }
  return { dealer: '', offers: 0, totalOffers: 0 };
}

// Aggregate total independent of loaded rows: page-1 rows and the JSON-LD
// offerCount coexist, so the row path must not skip the count scan.
export function jsonLdOfferTotal(doc) {
  let total = 0;
  for (const s of Array.from(doc?.querySelectorAll?.('script[type="application/ld+json"]') || [])) {
    try {
      const found = parseJsonLdOffer(JSON.parse(s.textContent));
      if (Number.isFinite(found?.totalOffers) && found.totalOffers > total) total = Math.round(found.totalOffers);
    } catch { /* Block einzeln ignorieren */ }
  }
  return total;
}

// Produktseiten listen Angebote als .Plugin_Offer-Blöcke (Preis-aufsteigend,
// statisch im HTML, live verifiziert 2026-10-09): Shopname im Logo-alt, je ein
// Produkt-/Versandpreis. Günstigstes Angebot auf Karten-Basis wählen (Min statt
// erste Zeile: robust gegen fremde Sortier-Cookies; nur Seite 1 geparst).
// Feed-Format zusätzlich als .Plugin_DealerRelProdPriceInfo-Zeilen (.title +
// je ein Produkt-/Versandpreis): gleiches Offer-Shape, gleiche strikte Wahl.
export function parseDealerRows(doc) {
  const rows = Array.from(doc?.querySelectorAll?.(`${SELECTORS.cards.dealerRows}`) || []);
  return rows.map(row => {
    const dealer = row.querySelector?.('.title')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const product = parsePrice(row.querySelector?.('.productPrice .Plugin_Price')?.textContent);
    const shipping = parsePrice(row.querySelector?.('.shippingPrice .Plugin_Price')?.textContent);
    const link = row.querySelector?.('a[href*="ext_de"]');
    const url = link?.getAttribute?.('href') || link?.href || '';
    return { dealer, product: product || 0, shipping: shipping || 0, url: url || '' };
  }).filter(o => o.dealer || o.product > 0 || o.shipping > 0);
}

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
    // Basis-strict: no cross-basis fallback — a product-only price must never
    // stand in for shipping-inclusive history (or vice versa).
    const price = useShipping ? (o.shipping || 0) : (o.product || 0);
    if (!(price > 0)) continue;
    if (!best || price < best.price) best = { price, dealer: o.dealer || '', url: o.url || '' };
  }
  return best;
}

// Feed-Karten tragen keine Händlerzeilen: Produktseite nachladen (nur bei Klick,
// same-origin, kein CORS-Problem). Katalog-Zeilen → .Plugin_Offer-Blöcke (inkl.
// /ext_de-Direktlink zum günstigsten Angebot) → JSON-LD (nur Count). Händler
// immer auf Karten-Preisbasis (Versand/Produkt).
export async function fetchProductInfo(productUrl, timeoutMs = 10000, useShipping = false) {
  // offers = loaded page-1 rows; totalOffers = JSON-LD AggregateOffer count
  // when present (0 otherwise). Callers keep reading `offers` — no migration.
  const out = { dealer: '', offers: 0, dealerUrl: '', totalOffers: 0 };
  try {
    if (typeof fetch === 'undefined' || typeof DOMParser === 'undefined') return out;
    if (!/^https?:\/\//i.test(productUrl || '')) return out;
    if (!isToppreiseProductUrl(productUrl)) return out;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    let res;
    let html;
    try {
      res = await fetch(productUrl, { signal: ctrl?.signal });
      if (!res.ok) return out;
      html = await res.text();
    } finally {
      clearTimeout(timer);
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Single dealer policy: dealer rows first (feed shape), then .Plugin_Offer
    // blocks — both through basis-strict cheapest (row order may follow
    // foreign sort cookies). Basis-strict: no parseable price on the card
    // basis means unknown dealer — never the opposite-basis name.
    const dealerRows = parseDealerRows(doc);
    const offers = dealerRows.length ? dealerRows : parseProductOffers(doc);
    if (offers.length) {
      out.offers = offers.length;
      out.totalOffers = jsonLdOfferTotal(doc);
      const best = pickCheapestOffer(offers, useShipping);
      out.dealer = best ? best.dealer : '';
      if (best?.url) {
        try { out.dealerUrl = new URL(best.url, productUrl).href; } catch { out.dealerUrl = best.url; }
      }
      return out;
    }
    const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of scripts) {
      try {
        const found = parseJsonLdOffer(JSON.parse(s.textContent));
        if (found.dealer || found.offers || found.totalOffers) {
          // Count-only unter Versandbasis: unbekannter Versandpreis kann nie
          // einen Delivered-Preis-Sieger küren — nur die Anzahl übernehmen.
          if (useShipping) return { dealer: '', offers: found.offers, dealerUrl: '', totalOffers: found.totalOffers || 0 };
          return { dealer: found.dealer, offers: found.offers, dealerUrl: '', totalOffers: found.totalOffers || 0 };
        }
      } catch { /* Block einzeln ignorieren */ }
    }
    console.debug('[Toppreise-Suite] Händler-Fallback leer', { htmlBytes: html.length, rowCount: offers.length, jsonLdBlocks: scripts.length });
  } catch { /* Händler unbekannt: Zeile entfällt */ }
  return out;
}

// Amazon ASIN parser: captures from standard /dp/, /gp/product/, or query parameters.
export function parseAmazonAsin(url) {
  if (!url || typeof url !== 'string') return null;
  const dpMatch = url.match(/(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})(?:[/?#]|$)/i);
  if (dpMatch) return dpMatch[1].toUpperCase();
  const qMatch = url.match(/[?&](?:creativeASIN|asin)=([A-Z0-9]{10})(?:[&/?#]|$)/i);
  if (qMatch) return qMatch[1].toUpperCase();
  return null;
}

// In-memory ASIN cache for active session
const memoryAsinCache = new Map();

export function clearMemoryAsinCache() {
  memoryAsinCache.clear();
}

// Resolves the Amazon ASIN from a direct dealer link or /ext_de redirect URL.
// Caches persistently per productId in localStorage and memory.
export async function resolveAmazonAsin(directUrl, productId = null, storage = null, fetchFn = null) {
  if (productId) {
    if (memoryAsinCache.has(productId)) return memoryAsinCache.get(productId);
    const cached = getCachedAsin(productId, storage);
    if (cached) {
      memoryAsinCache.set(productId, cached);
      return cached;
    }
  }

  const inlineAsin = parseAmazonAsin(directUrl);
  if (inlineAsin) {
    if (productId) {
      memoryAsinCache.set(productId, inlineAsin);
      setCachedAsin(productId, inlineAsin, storage);
    }
    return inlineAsin;
  }

  if (!directUrl || typeof directUrl !== 'string') return null;
  const target = directUrl.startsWith('http')
    ? directUrl
    : `${(typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch'}${directUrl}`;

  try {
    const urlObj = new URL(target);
    const host = urlObj.hostname.toLowerCase();
    const isToppreise = host === 'toppreise.ch' || host.endsWith('.toppreise.ch');
    const isAmazon = host === 'amazon.de' || host.endsWith('.amazon.de') || host === 'amazon.com' || host.endsWith('.amazon.com');
    if (!isToppreise && !isAmazon) return null;
  } catch {
    return null;
  }

  if (fetchFn) {
    try {
      const res = await fetchFn(target);
      const asin = parseAmazonAsin(res?.url || res?.location || (typeof res === 'string' ? res : ''));
      if (asin && productId) {
        memoryAsinCache.set(productId, asin);
        setCachedAsin(productId, asin, storage);
      }
      return asin || null;
    } catch {
      return null;
    }
  }

  return new Promise(resolve => {
    try {
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'HEAD',
          url: target,
          headers: { 'Referer': (typeof location !== 'undefined' && location.href) ? location.href : 'https://www.toppreise.ch/' },
          timeout: 6000,
          onload: res => {
            const loc = res.finalUrl || res.responseHeaders?.match(/(?:^|\r?\n)location:\s*([^\r\n]+)/i)?.[1] || '';
            const asin = parseAmazonAsin(loc);
            if (asin && productId) {
              memoryAsinCache.set(productId, asin);
              setCachedAsin(productId, asin, storage);
            }
            resolve(asin || null);
          },
          onerror: () => resolve(null),
          ontimeout: () => resolve(null)
        });
      } else if (typeof fetch !== 'undefined') {
        fetch(target, { method: 'HEAD', redirect: 'follow' })
          .then(res => {
            const asin = parseAmazonAsin(res.url);
            if (asin && productId) {
              memoryAsinCache.set(productId, asin);
              setCachedAsin(productId, asin, storage);
            }
            resolve(asin || null);
          })
          .catch(() => resolve(null));
      } else {
        resolve(null);
      }
    } catch {
      resolve(null);
    }
  });
}
