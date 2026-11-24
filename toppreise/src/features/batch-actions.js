/**
 * Batch Actions: Scoped Card Extraction, Specs & Export Formatters
 * Pure / DOM-light module (Node unit-testable).
 */

import { CONFIG, DEFAULTS } from '../state/config.js';
import { getProductCards, extractCardData, isCardFilteredOut } from '../page/cards.js';
import { extractShareData, extractDealer, extractDealerUrl } from '../page/product-offers.js';
import { isShippingPriceActive } from '../page/adapter.js';
import { getCachedDealer, hasUsablePriceStats } from '../scanner/cache.js';
import { resolveShareFields } from './discord-recipe.js';

const COMPARISON_BTN_SEL = '.Plugin_AddToProductComparisonButton';

export function extractCardSpecs(card) {
  if (!card?.querySelector) return '';
  const el = card.querySelector('.product-features')
    || card.closest?.('.Plugin_ProductCollItem')?.querySelector?.(':scope > .row .product-features, .product-features');
  if (!el) return '';
  const items = el.querySelectorAll ? Array.from(el.querySelectorAll('li')) : [];
  if (items.length > 0) {
    return items
      .map(li => (li.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' · ');
  }
  return (el.textContent || '')
    .replace(/[•·|]+/g, ' · ')
    .replace(/\s+/g, ' ')
    .replace(/^ · | · $/g, '')
    .trim();
}

export function isComparisonButtonActive(btn) {
  if (!btn) return false;
  const raw = btn.getAttribute?.('data-ser-plgn-data') || '';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.pc_atpcbc_action === 'rm') return true;
      if (parsed?.pc_atpcbc_action === 'ad') return false;
    } catch { /* fallback to icon class */ }
  }
  const icon = btn.querySelector?.('.TPIcons-diff');
  if (icon?.classList) {
    if (icon.classList.contains('active')) return true;
    if (icon.classList.contains('inactive')) return false;
  }
  return btn.classList?.contains('active') || false;
}

function buildItemFromCard(card, cd, useShipping) {
  const { title, url, imageUrl } = extractShareData(card);
  const priceText = cd.cardPrice > 0 ? `CHF ${cd.cardPrice.toFixed(2)}` : '';
  const cachedD = cd.pid ? getCachedDealer(cd.pid, useShipping) : null;
  const dealer = extractDealer(card, useShipping) || cachedD?.dealer || '';
  const dealerUrl = extractDealerUrl(card, useShipping) || cachedD?.url || '';
  const offerCount = cd.offerCount || cachedD?.totalOffers || cachedD?.offers || 0;

  let discountText = '';
  let lowText = '';
  let medianText = '';
  const vStats = cd.verifiedStats;
  if (cd.cardPrice > 0 && hasUsablePriceStats(vStats)) {
    const fields = resolveShareFields(cd.cardPrice, vStats);
    lowText = fields.prevLowText || (vStats.minPrice > 0 ? `CHF ${vStats.minPrice.toFixed(2)}` : '');
    medianText = fields.medianText || (vStats.medianPrice > 0 ? `CHF ${vStats.medianPrice.toFixed(2)}` : '');
    if (cd.dealScore?.weightedDiff > 0) {
      discountText = `-${Math.round(cd.dealScore.weightedDiff)}%`;
    } else if (fields.prevLowPct > 0) {
      discountText = `-${Math.round(fields.prevLowPct)}%`;
    } else if (fields.medianPct > 0) {
      discountText = `-${Math.round(fields.medianPct)}%`;
    }
  } else if (cd.discountVal > 0) {
    discountText = `-${Math.round(cd.discountVal)}%`;
  }

  const isVerifiedDeal = Boolean(
    cd.dealScore ||
    cd.displayDelta?.kind === 'new-low' ||
    cd.displayDelta?.kind === 'at-low'
  );
  const compBtn = card.querySelector?.(COMPARISON_BTN_SEL) || null;

  return {
    card,
    pid: cd.pid || '',
    title: title || `Produkt ${cd.pid || ''}`.trim(),
    url,
    imageUrl,
    cardPrice: cd.cardPrice || 0,
    cardPriceBasis: cd.cardPriceBasis || 'product',
    priceText,
    specs: extractCardSpecs(card),
    dealer,
    dealerUrl,
    offerCount,
    discountText,
    lowText,
    medianText,
    isVerifiedDeal,
    hasComparisonBtn: !!compBtn,
    comparisonActive: isComparisonButtonActive(compBtn)
  };
}

export function collectScopedCards(scope = 'non-dimmed', root = undefined) {
  const cards = getProductCards(root);
  const useShipping = isShippingPriceActive();
  const out = [];
  for (const card of cards) {
    if (isCardFilteredOut(card)) continue;
    if (scope === 'non-dimmed' && card.classList?.contains('tp-dimmed')) continue;
    const cd = extractCardData(card);
    const isDeal = Boolean(
      cd.dealScore ||
      cd.displayDelta?.kind === 'new-low' ||
      cd.displayDelta?.kind === 'at-low'
    );
    if (scope === 'deals' && !isDeal) continue;
    out.push(buildItemFromCard(card, cd, useShipping));
  }
  return out;
}

export function getBatchScopeCounts(root = undefined) {
  const cards = getProductCards(root);
  let nonDimmed = 0;
  let visible = 0;
  let deals = 0;
  for (const card of cards) {
    if (isCardFilteredOut(card)) continue;
    visible++;
    if (!card.classList?.contains('tp-dimmed')) nonDimmed++;
    const cd = extractCardData(card);
    if (cd.dealScore || cd.displayDelta?.kind === 'new-low' || cd.displayDelta?.kind === 'at-low') {
      deals++;
    }
  }
  return { 'non-dimmed': nonDimmed, visible, deals };
}

export function neutralizeFormulaCell(raw) {
  const s = String(raw ?? '');
  if (!s) return '';
  // Preserve pure negative numbers / percentages like "-35%" or "-12.50"
  if (/^-?\d+(?:[.,]\d+)?%?$/.test(s)) return s;
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

export function formatBatchMarkdown(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const hasSpecs = items.some(it => it.specs);
  const hasHistory = items.some(it => it.discountText || it.lowText || it.medianText);

  const headers = ['#', 'Produkt', 'Preis'];
  if (hasHistory) headers.push('Rabatt / Historie');
  headers.push('Händler');
  if (hasSpecs) headers.push('Specs');
  headers.push('Link');

  const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`
  ];

  items.forEach((it, idx) => {
    const histParts = [it.discountText, it.lowText ? `Tief: ${it.lowText}` : '', it.medianText].filter(Boolean);
    const dealerStr = it.dealer
      ? (it.offerCount > 1 ? `${it.dealer} (+${it.offerCount - 1})` : it.dealer)
      : (it.offerCount > 0 ? `${it.offerCount} Angebote` : '—');
    const row = [
      String(idx + 1),
      esc(it.title),
      esc(it.priceText || '—')
    ];
    if (hasHistory) row.push(esc(histParts.join(' · ') || '—'));
    row.push(esc(dealerStr));
    if (hasSpecs) row.push(esc(it.specs || '—'));
    row.push(it.url ? `[Toppreise](${it.url.replace(/\(/g, '%28').replace(/\)/g, '%29')})` : '—');
    lines.push(`| ${row.join(' | ')} |`);
  });

  return lines.join('\n');
}

function buildSpreadsheetRows(items) {
  const headers = ['Titel', 'Preis', 'Rabatt', 'Tiefstpreis', 'Median', 'Händler', 'Angebote', 'Specs', 'URL'];
  const rows = [headers];
  for (const it of items) {
    rows.push([
      it.title || '',
      it.priceText || '',
      it.discountText || '',
      it.lowText || '',
      it.medianText || '',
      it.dealer || '',
      it.offerCount > 0 ? String(it.offerCount) : '',
      it.specs || '',
      it.url || ''
    ]);
  }
  return rows;
}

export function formatBatchTsv(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return buildSpreadsheetRows(items)
    .map(row => row.map(cell => neutralizeFormulaCell(String(cell ?? '').replace(/[\t\r\n]+/g, ' ').trim())).join('\t'))
    .join('\n');
}

export function formatBatchCsv(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const escCsv = val => {
    const safe = neutralizeFormulaCell(String(val ?? '').replace(/\r?\n/g, ' ').trim());
    if (/[",]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
    return safe;
  };
  return buildSpreadsheetRows(items)
    .map(row => row.map(escCsv).join(','))
    .join('\r\n');
}

const FALLBACK_COMPARE_PROMPT =
  'Vergleiche folgende {anzahl} Angebote von Toppreise.ch (Preise in CHF) und bewerte Preis-Leistung, Stärken/Schwächen sowie welches Angebot der beste Deal ist (kurz auf Deutsch):';
const FALLBACK_COMPARE_ITEM_TEMPLATE =
  '{nr}. {titel} | Preis: {preis} | Rabatt: {rabatt} | Bisheriges Tief: {tief} | {median} | Händler: {haendler} | Specs: {specs}';

export const COMPARE_PROMPT_TOKENS = Object.freeze(['anzahl', 'angebote']);
export const COMPARE_ITEM_TOKENS = Object.freeze(['nr', 'titel', 'preis', 'rabatt', 'tief', 'median', 'haendler', 'offerten', 'specs', 'url']);

const ITEM_TOKEN_RE = /\{(nr|titel|preis|rabatt|tief|median|haendler|offerten|specs|url)\}/gi;

export function findUnknownPromptTokens(template, allowedTokens) {
  const allowed = allowedTokens instanceof Set ? allowedTokens : new Set(allowedTokens || []);
  const text = String(template || '');
  const seen = new Set();
  const out = [];
  for (const m of text.matchAll(/\{([^{}\s]+)\}/g)) {
    const key = m[1].toLowerCase();
    if (!allowed.has(key) && !seen.has(m[0])) {
      seen.add(m[0]);
      out.push(m[0]);
    }
  }
  return out;
}

function resolveCompareTemplate(promptTemplate) {
  const custom = String(promptTemplate ?? CONFIG?.BATCH_COMPARE_PROMPT ?? '').trim();
  const def = String(DEFAULTS?.BATCH_COMPARE_PROMPT || FALLBACK_COMPARE_PROMPT).trim();
  return custom || def;
}

function resolveCompareItemTemplate(itemTemplate) {
  const custom = String(itemTemplate ?? CONFIG?.BATCH_COMPARE_ITEM_TEMPLATE ?? '').trim();
  const def = String(DEFAULTS?.BATCH_COMPARE_ITEM_TEMPLATE || FALLBACK_COMPARE_ITEM_TEMPLATE).trim();
  return custom || def;
}

function getEnabledItemTokens(itemTemplate) {
  const tpl = resolveCompareItemTemplate(itemTemplate);
  const active = new Set();
  for (const m of tpl.matchAll(ITEM_TOKEN_RE)) {
    active.add(m[1].toLowerCase());
  }
  return active;
}

export function formatComparisonItemLine(it, idx, itemTemplate, { titleMaxLen = Infinity, specMaxLen = Infinity } = {}) {
  const tpl = resolveCompareItemTemplate(itemTemplate);
  const values = {
    nr: String(idx + 1),
    titel: trimCompact(it?.title, titleMaxLen),
    preis: String(it?.priceText || '').trim(),
    rabatt: String(it?.discountText || '').trim(),
    tief: String(it?.lowText || '').trim(),
    median: String(it?.medianText || '').trim(),
    haendler: String(it?.dealer || '').trim(),
    offerten: it?.offerCount > 0 ? String(it.offerCount) : '',
    specs: trimCompact(it?.specs, specMaxLen),
    url: String(it?.url || '').trim()
  };
  const outLines = [];
  for (const line of tpl.split(/\r?\n/)) {
    const outSegs = [];
    for (const seg of line.split('|')) {
      const matches = [...seg.matchAll(ITEM_TOKEN_RE)];
      if (matches.length > 0 && !matches.some(m => Boolean(values[m[1].toLowerCase()]))) {
        continue;
      }
      const rendered = seg
        .replace(ITEM_TOKEN_RE, (_, key) => values[key.toLowerCase()] || '')
        .replace(/\(\s*[,·]+\s*/g, '(')
        .replace(/\s*[,·]+\s*\)/g, ')')
        .replace(/,\s*,+/g, ',')
        .replace(/\(\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (rendered) outSegs.push(rendered);
    }
    const joined = outSegs.join(' | ');
    if (joined) outLines.push(joined);
  }
  return outLines.join('\n');
}

function formatComparisonPromptText(items, itemLines, { promptTemplate, shortHeader = false } = {}) {
  const tpl = shortHeader
    ? `Vergleiche ${items.length} Toppreise-Deals (CHF, bester Deal?):`
    : resolveCompareTemplate(promptTemplate).replace(/\{anzahl\}/gi, () => String(items.length));
  const body = itemLines.join('\n');
  if (/\{angebote\}/i.test(tpl)) {
    return tpl.replace(/\{angebote\}/gi, () => body).trim();
  }
  return `${tpl}\n\n${body}`;
}

export function buildComparisonPrompt(items, opts = {}) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const itemLines = items
    .map((it, idx) => formatComparisonItemLine(it, idx, opts.itemTemplate, opts))
    .filter(Boolean);
  if (itemLines.length === 0) return '';
  return formatComparisonPromptText(items, itemLines, opts);
}

const MAX_AI_URL_QUERY_ENCODED = 1850;

function trimCompact(str, maxLen) {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  if (!Number.isFinite(maxLen) || s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

export function buildCompactComparisonPrompt(items, {
  minimal = false,
  titleMaxLen = 96,
  specMaxLen = Infinity,
  shortHeader = false,
  promptTemplate,
  itemTemplate
} = {}) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const tokens = getEnabledItemTokens(itemTemplate);
  const itemLines = [];
  items.forEach((it, idx) => {
    const tMax = minimal ? Math.min(titleMaxLen, 60) : titleMaxLen;
    const nrPart = tokens.has('nr') ? `${idx + 1}. ` : '';
    const title = tokens.has('titel') ? trimCompact(it.title, tMax) : '';
    const meta = [
      tokens.has('preis') ? it.priceText : '',
      tokens.has('rabatt') ? it.discountText : ''
    ].filter(Boolean);
    if (!minimal && tokens.has('tief') && it.lowText) meta.push(`Tief ${it.lowText}`);
    if (!minimal && tokens.has('offerten') && it.offerCount > 0) meta.push(`${it.offerCount} Ang.`);
    const priceBit = meta.length ? `(${meta.join(', ')})` : '';
    const specBit = (!minimal && tokens.has('specs') && it.specs) ? ` | ${trimCompact(it.specs, specMaxLen)}` : '';
    const urlBit = (!minimal && tokens.has('url') && it.url) ? ` | ${it.url}` : '';
    const head = [nrPart + title, priceBit].filter(Boolean).join(' ').trim();
    const line = `${head}${specBit}${urlBit}`.trim();
    if (line) itemLines.push(line);
  });
  if (itemLines.length === 0) return '';
  return formatComparisonPromptText(items, itemLines, { promptTemplate, shortHeader });
}

export function selectExternalComparisonQuery(items, fullPrompt = buildComparisonPrompt(items), opts = {}) {
  const full = String(fullPrompt || '').trim();
  if (!full) return { query: '', needsPaste: false };
  if (encodeURIComponent(full).length <= MAX_AI_URL_QUERY_ENCODED) {
    return { query: full, needsPaste: false };
  }
  if (Array.isArray(items) && items.length > 0) {
    const tpl = resolveCompareTemplate(opts.promptTemplate);
    const def = String(DEFAULTS?.BATCH_COMPARE_PROMPT || FALLBACK_COMPARE_PROMPT).trim();
    const isCustom = tpl !== def;
    const itemTpl = resolveCompareItemTemplate(opts.itemTemplate);
    const defItemTpl = String(DEFAULTS?.BATCH_COMPARE_ITEM_TEMPLATE || FALLBACK_COMPARE_ITEM_TEMPLATE).trim();
    const isCustomItem = itemTpl !== defItemTpl;

    const fits = candidate => (candidate && encodeURIComponent(candidate).length <= MAX_AI_URL_QUERY_ENCODED ? candidate : '');

    if (isCustomItem) {
      for (const specMaxLen of [Infinity, 140, 90, 52]) {
        const hit = fits(buildComparisonPrompt(items, {
          promptTemplate: opts.promptTemplate,
          itemTemplate: opts.itemTemplate,
          titleMaxLen: 96,
          specMaxLen
        }));
        if (hit) return { query: hit, needsPaste: false };
      }
    }

    const tryFit = (cfg) => fits(buildCompactComparisonPrompt(items, {
      ...cfg,
      promptTemplate: opts.promptTemplate,
      itemTemplate: opts.itemTemplate
    }));

    for (const specMaxLen of [Infinity, 140, 90, 52]) {
      const hit = tryFit({ titleMaxLen: 96, specMaxLen, shortHeader: false });
      if (hit) return { query: hit, needsPaste: false };
    }
    if (!isCustom) {
      for (const specMaxLen of [Infinity, 120, 72, 48]) {
        const hit = tryFit({ titleMaxLen: 88, specMaxLen, shortHeader: true });
        if (hit) return { query: hit, needsPaste: false };
      }
    }
    for (const titleMaxLen of [64, 44]) {
      const hit = tryFit({ minimal: true, titleMaxLen, shortHeader: !isCustom });
      if (hit) return { query: hit, needsPaste: false };
    }
  }
  return { query: '', needsPaste: true };
}

export function buildExternalAiUrl(target, prompt) {
  const text = String(prompt || '').trim();
  const encoded = encodeURIComponent(text);
  const needsPaste = encoded.length > MAX_AI_URL_QUERY_ENCODED;
  switch (target) {
    case 'chatgpt':
      return { url: needsPaste ? 'https://chatgpt.com/' : `https://chatgpt.com/?q=${encoded}`, needsPaste };
    case 'perplexity':
      return { url: needsPaste ? 'https://www.perplexity.ai/' : `https://www.perplexity.ai/search?q=${encoded}`, needsPaste };
    case 'claude':
      return { url: needsPaste ? 'https://claude.ai/new' : `https://claude.ai/new?q=${encoded}`, needsPaste };
    case 'google-ai':
    default:
      return { url: needsPaste ? 'https://www.google.com/search?udm=50' : `https://www.google.com/search?q=${encoded}&udm=50`, needsPaste };
  }
}

export async function copyTextToClipboard(text) {
  if (!text) return false;
  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fallback below */ }
  }
  if (typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch {
      return false;
    }
  }
  return false;
}

export function downloadCsvFile(filename, csvText) {
  if (typeof document === 'undefined' || !csvText) return false;
  const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `toppreise-batch-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function isBatchConfirmRequired(count, alwaysConfirm = false) {
  if (alwaysConfirm) return true;
  const threshold = Number.isFinite(CONFIG?.BATCH_CONFIRM_THRESHOLD) ? CONFIG.BATCH_CONFIRM_THRESHOLD : 10;
  return count >= threshold;
}
