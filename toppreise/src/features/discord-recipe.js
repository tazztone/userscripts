/**
 * Discord Deal Recipe & Layout Formatter
 * Baukasten-Layout engine, tokens, and markdown preview rendering for Discord deal shares.
 */

import { priceToCents, recordRefForPrice } from '../domain/price.js';
import { getDisplayDelta, getLevelPct, medianHorizonLabel } from '../domain/deal-score.js';

// Baukasten-Layout: je Zeile ein Baustein, Grösse via # / ## / -# am
// Zeilenanfang. · blendet leere Nachbarn aus, +{offers} rendert kompakt +N (leer bei 0). {link} nur bei aktivem Embed.
export const DEFAULT_LAYOUT = '## {title}\n# {price}\n# {dealer} +{offers}\n{prevlow}\n{median}\n{ai}\n{comment}\n{link}';
export const LAYOUT_TOKENS = new Set(['title', 'price', 'dealer', 'offers', 'spark', 'prevlow', 'median', 'ai', 'comment', 'rating', 'link']);

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
    } else {
      const quote = line.match(/^>\s?/);
      if (quote) {
        cls = 'tp-md-quote';
        line = line.slice(quote[0].length);
      }
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

const TRACKING_PARAMS = new Set([
  'srsltid', 'fbclid', 'gclid', 'gbraid', 'wbraid',
  'mc_cid', 'mc_eid', 'yclid', 'igshid', '_hsenc', '_hsmi',
]);

const escapeUrlParens = u => String(u || '').replace(/\(/g, '%28').replace(/\)/g, '%29');

export function cleanCommentUrl(rawUrl) {
  const raw = String(rawUrl || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || /^utm_/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return escapeUrlParens(url.toString());
  } catch {
    return escapeUrlParens(raw);
  }
}

function domainLabelFor(urlStr) {
  try {
    return new URL(urlStr).hostname.replace(/^www\./i, '') || 'link';
  } catch {
    return 'link';
  }
}

function splitTrailingUrlPunct(raw) {
  let url = raw;
  let trailing = '';
  while (url.length > 0) {
    const last = url[url.length - 1];
    if (/[.,;:!?]/.test(last)) {
      trailing = last + trailing;
      url = url.slice(0, -1);
    } else if (last === ')') {
      const opens = (url.match(/\(/g) || []).length;
      const closes = (url.match(/\)/g) || []).length;
      if (closes > opens) {
        trailing = last + trailing;
        url = url.slice(0, -1);
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return { url, trailing };
}

export function formatCommentLinks(text) {
  const str = String(text ?? '');
  if (!str) return '';
  const pattern = /\[([^\]]*)\]\s*\(\s*<?(https?:\/\/(?:[^\s()<>]+|\([^\s()<>]*\))+)>?\s*\)|<?(https?:\/\/[^\s<>]+)>?/g;
  return str.replace(pattern, (match, label, mdUrl, bareUrl) => {
    if (mdUrl !== undefined) {
      const cleaned = cleanCommentUrl(mdUrl);
      const cleanLabel = String(label || '').trim() || domainLabelFor(cleaned);
      return `[${cleanLabel}](<${cleaned}>)`;
    }
    const isWrapped = match.startsWith('<') && match.endsWith('>');
    const { url, trailing } = isWrapped ? { url: bareUrl, trailing: '' } : splitTrailingUrlPunct(bareUrl);
    const cleaned = cleanCommentUrl(url);
    return `[${domainLabelFor(cleaned)}](<${cleaned}>)${trailing}`;
  });
}

export function formatCommentPrefix(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return '';
  const formatted = formatCommentLinks(trimmed);
  const hasPrefix = /^([^\p{L}\p{N}\s]|>|-)/u.test(formatted);
  return hasPrefix ? formatted : `💬 ${formatted}`;
}

export function splitDiscordChunks(text, maxLen = 2000) {
  const str = String(text ?? '');
  if (!str) return [];
  if (str.length <= maxLen) return [str];

  const linkSpans = [];
  const linkRe = /\[[^\]]*\]\(<https?:\/\/[^>\s]+>\)/g;
  let m;
  while ((m = linkRe.exec(str)) !== null) {
    linkSpans.push({ start: m.index, end: m.index + m[0].length });
  }
  const insideLink = idx => linkSpans.some(s => s.start < idx && idx < s.end);

  const chunks = [];
  let pos = 0;
  while (pos < str.length) {
    if (str.length - pos <= maxLen) {
      chunks.push(str.slice(pos));
      break;
    }
    let end = pos + maxLen;
    const prevCode = str.charCodeAt(end - 1);
    if (prevCode >= 0xD800 && prevCode <= 0xDBFF) end--;

    const spanning = linkSpans.find(s => s.start < end && end < s.end);
    if (spanning && spanning.start > pos) {
      end = spanning.start;
    }

    let cut = -1;
    const slice = str.slice(pos, end);
    const paraIdx = slice.lastIndexOf('\n\n');
    if (paraIdx > 0) {
      cut = pos + paraIdx;
    } else {
      const lineIdx = slice.lastIndexOf('\n');
      if (lineIdx > 0) {
        cut = pos + lineIdx;
      } else {
        let spaceIdx = slice.lastIndexOf(' ');
        while (spaceIdx > 0 && insideLink(pos + spaceIdx)) {
          spaceIdx = slice.lastIndexOf(' ', spaceIdx - 1);
        }
        if (spaceIdx > 0) cut = pos + spaceIdx;
      }
    }

    if (cut <= pos) cut = end;
    const chunk = str.slice(pos, cut).trimEnd();
    if (chunk) chunks.push(chunk);
    pos = cut;
    while (pos < str.length && (str[pos] === ' ' || str[pos] === '\n')) pos++;
  }
  return chunks;
}

function tokenText(name, ctx) {
  switch (name) {
    case 'title': return ctx.link ? `[${ctx.cleanTitle}](${ctx.titleTarget})` : ctx.cleanTitle;
    case 'price': return ctx.priceText ? `💰 ${ctx.priceText}` : '';
    case 'dealer': return ctx.dealer ? (ctx.dealerTarget ? `🏬 [${ctx.dealer}](${ctx.dealerTarget})` : `🏬 ${ctx.dealer}`) : '';
    case 'offers': return ctx.offerCount ? `🛒 ${ctx.offerCount} Angebote` : '';
    case 'prevlow': return ctx.prevLowText ? `📉 ${boldNumbers(withPct(ctx.prevLowText, ctx.prevLowPct))}` : '';
    case 'median': return ctx.medianText ? `📈 ${boldNumbers(withPct(ctx.medianText, ctx.medianPct))}` : '';
    case 'ai': return ctx.aiText ? ctx.aiText.split('\n').map((l, i) => (i === 0 ? `> 💡 ${l}` : `> ${l}`)).join('\n') : '';
    case 'comment':
      return formatCommentPrefix(ctx.commentText);
    case 'rating': {
      if (!ctx.ratingText) return '';
      const emoji = ['🟢', '🟢', '⚪', '🟠', '🔴'][ctx.ratingLevel] ?? '📊';
      return `${emoji} ${ctx.ratingText}`;
    }
    case 'link': return (ctx.link && (!ctx.suppressProductEmbed || ctx.forceLink)) ? ctx.link : '';
    default: return '';
  }
}

export function renderLayout(fields = {}, recipe = DEFAULT_LAYOUT) {
  recipe = String(recipe || '').replace(/\r/g, '');
  if (!recipe.trim()) recipe = DEFAULT_LAYOUT;
  if (fields?.commentText && !recipe.includes('{comment}')) {
    const lines = recipe.split('\n');
    const linkIdx = lines.findIndex(l => l.includes('{link}'));
    if (linkIdx !== -1) {
      lines.splice(linkIdx, 0, '{comment}');
      recipe = lines.join('\n');
    } else {
      recipe = `${recipe.trimEnd()}\n{comment}`;
    }
  }
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
    aiText: (fields || {}).aiText || '',
    ratingText: (fields || {}).ratingText || '',
    ratingLevel: (fields || {}).ratingLevel ?? null,
    commentText: String((fields || {}).commentText || '').trim(),
    suppressProductEmbed: (fields || {}).suppressProductEmbed === true,
    forceLink: (fields || {}).forceLink === true,
  };
  const out = [];
  for (const rawLine of recipe.split('\n')) {
    const line = rawLine.replace(/\s*\+\{offers\}/g, ctx.offerCount ? ` +${ctx.offerCount}` : '').replace(/\{([a-z]+)\}/g, (m, name) => LAYOUT_TOKENS.has(name) ? tokenText(name, ctx) : '').replace(/\s*·\s*·\s*/g, ' · ').replace(/^([#-]+)\s*·\s*/g, '$1 ').replace(/^\s*·\s*|\s*·\s*$/g, '').replace(/^([#-]+)\s+/g, '$1 ');
    if (line.replace(/^[#> \s-]+/, '').trim() === '') continue;
    out.push(line);
  }
  return out.join('\n');
}

export function forumRecipeFor(recipe = DEFAULT_LAYOUT) {
  const base = String(recipe || '').trim() ? String(recipe) : DEFAULT_LAYOUT;
  const stripped = base.replace(/\{title\}/g, '');
  return /\{link\}/.test(stripped) ? stripped : `${stripped.replace(/\s+$/, '')}\n{link}`;
}

const safeSliceDiscord = (str, max) => {
  if (str.length <= max) return str;
  const code = str.charCodeAt(max - 1);
  return (code >= 0xD800 && code <= 0xDBFF) ? str.slice(0, max - 1) : str.slice(0, max);
};

function fitDealMessage(fields = {}, recipe = DEFAULT_LAYOUT) {
  const full = renderLayout(fields, recipe);
  if (full.length <= 2000) return full;
  const baseFields = { ...(fields || {}) };
  const cleanTitle = cleanTitleOf(baseFields.title);
  let shrunkTitle = safeSliceDiscord(cleanTitle, Math.max(20, cleanTitle.length - (full.length - 2000)));
  let rendered = renderLayout({ ...baseFields, title: shrunkTitle }, recipe);
  if (rendered.length > 2000 && shrunkTitle.length > 20) {
    shrunkTitle = safeSliceDiscord(shrunkTitle, Math.max(20, shrunkTitle.length - (rendered.length - 2000)));
    rendered = renderLayout({ ...baseFields, title: shrunkTitle }, recipe);
  }
  if (rendered.length > 2000 && baseFields.aiText) {
    const ai = String(baseFields.aiText);
    const keepAi = Math.max(40, ai.length - (rendered.length - 2000) - 1);
    const trimmedAi = keepAi < ai.length ? `${safeSliceDiscord(ai, keepAi).trimEnd()}…` : ai;
    rendered = renderLayout({ ...baseFields, title: shrunkTitle, aiText: trimmedAi }, recipe);
    if (rendered.length > 2000 && trimmedAi.length > 41) {
      const keepAi2 = Math.max(40, trimmedAi.length - (rendered.length - 2000) - 2);
      const trimmedAi2 = `${safeSliceDiscord(ai, keepAi2).trimEnd()}…`;
      rendered = renderLayout({ ...baseFields, title: shrunkTitle, aiText: trimmedAi2 }, recipe);
    }
  }
  return rendered;
}

export function commentOverflows(fields = {}, recipe = DEFAULT_LAYOUT) {
  if (!String(fields?.commentText || '').trim()) return false;
  const withComment = renderLayout(fields, recipe);
  if (withComment.length <= 2000) return false;
  const without = renderLayout({ ...fields, commentText: '' }, recipe);
  if (without.length <= 2000) return true;
  if (fields?.aiText || fitDealMessage(fields, recipe).length > 2000) {
    return fitDealMessage({ ...fields, commentText: '' }, recipe).length <= 2000;
  }
  return false;
}

export function formatDealMessage(fields = {}, recipe = DEFAULT_LAYOUT) {
  return safeSliceDiscord(fitDealMessage(fields, recipe), 2000);
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
