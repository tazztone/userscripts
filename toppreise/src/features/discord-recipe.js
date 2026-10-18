/**
 * Discord Deal Recipe & Layout Formatter
 * Baukasten-Layout engine, tokens, and markdown preview rendering for Discord deal shares.
 */

import { priceToCents, recordRefForPrice } from '../domain/price.js';
import { getDisplayDelta, getLevelPct, medianHorizonLabel } from '../domain/deal-score.js';

// Baukasten-Layout: je Zeile ein Baustein, Grösse via # / ## / -# am
// Zeilenanfang. · blendet leere Nachbarn aus, +{offers} rendert kompakt +N (leer bei 0). {link} nur bei aktivem Embed.
export const DEFAULT_LAYOUT = '## {title}\n# {price}\n# {dealer} +{offers}\n{prevlow}\n{median}\n{link}';
export const LAYOUT_TOKENS = new Set(['title', 'price', 'dealer', 'offers', 'spark', 'prevlow', 'median', 'link']);

export function validateLayoutRecipe(recipe) {
  const value = String(recipe ?? '');
  if (!value.trim()) return 'Layout ist leer';
  const unknown = [...new Set([...value.matchAll(/\{([^}]*)\}/g)].map(m => m[1]))].filter(n => !LAYOUT_TOKENS.has(n));
  return unknown.length ? `Unbekannte Tokens: ${unknown.map(n => `{${n}}`).join(', ')}` : null;
}

export function getLayoutRecipeNotice(recipe) {
  const value = String(recipe ?? '');
  if (value.includes('{spark}')) {
    return '⚠️ {spark} ist veraltet: Preischart wird automatisch als Bild-Anhang angehängt.';
  }
  return null;
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
const cleanTitleOf = title => (title || 'Toppreise-Deal').replace(/\s+/g, ' ').trim().replace(/\[/g, '(').replace(/\]/g, ')');

export function escapeDiscordMarkdown(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/[`*_~|>]/g, '\\$&');
}

function tokenText(name, ctx) {
  switch (name) {
    case 'title': return ctx.link ? `[${ctx.cleanTitle}](${ctx.titleTarget})` : ctx.cleanTitle;
    case 'price': return ctx.priceText ? `💰 ${ctx.priceText}` : '';
    case 'dealer': return ctx.dealer ? (ctx.dealerTarget ? `🏬 [${ctx.dealer}](${ctx.dealerTarget})` : `🏬 ${ctx.dealer}`) : '';
    case 'offers': return ctx.offerCount ? `🛒 ${ctx.offerCount} Angebote` : '';
    case 'prevlow': return ctx.prevLowText ? `📉 ${boldNumbers(withPct(ctx.prevLowText, ctx.prevLowPct))}` : '';
    case 'median': return ctx.medianText ? `📈 ${boldNumbers(withPct(ctx.medianText, ctx.medianPct))}` : '';
    case 'link': return (ctx.link && (!ctx.suppressProductEmbed || ctx.forceLink)) ? ctx.link : '';
    default: return '';
  }
}

export function renderLayout(fields = {}, recipe = DEFAULT_LAYOUT) {
  recipe = String(recipe || '').replace(/\r/g, '');
  if (!recipe.trim()) recipe = DEFAULT_LAYOUT;
  const escapeUrlParens = u => String(u || '').replace(/\(/g, '%28').replace(/\)/g, '%29');
  const link = escapeUrlParens(((fields || {}).url || '').trim());
  const dealerUrl = escapeUrlParens((fields || {}).dealerUrl || '');
  const ctx = {
    cleanTitle: escapeDiscordMarkdown(cleanTitleOf((fields || {}).title)),
    link,
    titleTarget: link ? (((fields || {}).suppressProductEmbed && link) ? `<${link}>` : link) : '',
    priceText: (fields || {}).priceText || '',
    dealer: escapeDiscordMarkdown(String((fields || {}).dealer || '').replace(/\[/g, '(').replace(/\]/g, ')')),
    dealerTarget: dealerUrl ? ((fields || {}).suppressDealerEmbed ? `<${dealerUrl}>` : dealerUrl) : '',
    offerCount: (fields || {}).offerCount || 0,
    prevLowText: (fields || {}).prevLowText || '',
    prevLowPct: (fields || {}).prevLowPct || 0,
    medianText: (fields || {}).medianText || '',
    medianPct: (fields || {}).medianPct || 0,
    suppressProductEmbed: (fields || {}).suppressProductEmbed === true,
    forceLink: (fields || {}).forceLink === true,
  };
  const out = [];
  for (const rawLine of recipe.split('\n')) {
    const line = rawLine.replace(/\s*\+\{offers\}/g, ctx.offerCount ? ` +${ctx.offerCount}` : '').replace(/\{([a-z]+)\}/g, (m, name) => LAYOUT_TOKENS.has(name) ? tokenText(name, ctx) : '').replace(/\s*·\s*·\s*/g, ' · ').replace(/^([#-]+)\s*·\s*/g, '$1 ').replace(/^\s*·\s*|\s*·\s*$/g, '').replace(/^([#-]+)\s+/g, '$1 ').replace(/\s\+(?!\d)\s*$/g, '');
    if (line.replace(/^[#\s-]+/, '').trim() === '') continue;
    out.push(line);
  }
  return out.join('\n');
}

export function forumRecipeFor(recipe = DEFAULT_LAYOUT) {
  const base = String(recipe || '').trim() ? String(recipe) : DEFAULT_LAYOUT;
  const stripped = base.replace(/\{title\}/g, '');
  return /\{link\}/.test(stripped) ? stripped : `${stripped.replace(/\s+$/, '')}\n{link}`;
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
// der Click-Handler nutzt nur diese eine Quelle.
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
