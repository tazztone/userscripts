/**
 * Shared AI & Web-Search Launcher Popover (#tp-ai-launcher-popover)
 * Unified launcher for Google (speed) and OpenRouter (detailed research)
 * with one-time per-launch model selection (never mutates persistent settings).
 */

import { CONFIG, DEFAULT_OPENROUTER_MODEL } from '../state/config.js';
import {
  hasOpenRouterKey,
  hasTavilyKey,
  getCachedConfiguredAiSummary
} from '../features/openrouter-search.js';
import { openSettingsAt } from './modal.js';
import { showToast } from './toast.js';

export const AI_LAUNCHER_POPOVER_ID = 'tp-ai-launcher-popover';
export const CUSTOM_MODEL_SENTINEL = '__custom__';

export function openSearchTab(url, { active = true } = {}) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (typeof GM_openInTab === 'function') {
    try {
      GM_openInTab(url, { active: !!active, insert: true });
      return true;
    } catch { /* fallback below */ }
  }
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      const w = window.open(url, '_blank', 'noopener');
      return !!w;
    } catch {
      return false;
    }
  }
  return false;
}

let activeCleanup = null;

export function buildLauncherModelOptions(cfg = CONFIG) {
  const options = [];
  const seen = new Set();
  const add = (value, label) => {
    const v = String(value || '').trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    options.push({ value: v, label });
  };

  const defaultModel = String(cfg?.OPENROUTER_MODEL || '').trim() || DEFAULT_OPENROUTER_MODEL;
  const paidModel = String(cfg?.OPENROUTER_PAID_MODEL || '').trim();

  if (defaultModel !== DEFAULT_OPENROUTER_MODEL) {
    add(defaultModel, `${defaultModel} (Standard)`);
  }
  add(DEFAULT_OPENROUTER_MODEL, `${DEFAULT_OPENROUTER_MODEL} (Kostenlos)`);
  if (paidModel) {
    add(paidModel, `${paidModel} (Schnell / Paid)`);
  }

  return { options, selectedValue: defaultModel };
}

export function closeAiLauncherPopover() {
  if (typeof activeCleanup === 'function') {
    const fn = activeCleanup;
    activeCleanup = null;
    fn();
    return;
  }
  if (typeof document !== 'undefined') {
    document.getElementById(AI_LAUNCHER_POPOVER_ID)?.remove();
  }
}

function positionLauncher(el, anchorEl) {
  if (!el || typeof window === 'undefined') return;
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  const margin = 8;
  const rect = el.getBoundingClientRect();
  const w = rect.width || 304;
  const h = rect.height || 260;

  let left = Math.round((vw - w) / 2);
  let top = Math.round((vh - h) / 2);

  const aRect = anchorEl?.getBoundingClientRect?.();
  if (aRect && (aRect.width > 0 || aRect.height > 0)) {
    left = aRect.left;
    const spaceBelow = vh - aRect.bottom - margin;
    const spaceAbove = aRect.top - margin;
    if (spaceBelow >= h || spaceBelow >= spaceAbove) {
      top = aRect.bottom + 6;
    } else {
      top = aRect.top - h - 6;
    }
  }

  left = Math.max(margin, Math.min(vw - w - margin, left));
  top = Math.max(margin, Math.min(vh - h - margin, top));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

export function openAiLauncherPopover(opts = {}) {
  if (typeof document === 'undefined') return null;
  closeAiLauncherPopover();

  const {
    mode = 'single',
    anchorEl = null,
    title = '',
    priceText = '',
    itemCount = 1,
    onLaunch = null
  } = opts;

  const isBatch = mode !== 'single';
  const prevFocus = document.activeElement;

  const el = document.createElement('div');
  el.id = AI_LAUNCHER_POPOVER_ID;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Suche & KI-Analyse');

  const headerTitle = mode === 'batch-compare'
    ? '🤖 KI-Vergleich starten'
    : mode === 'batch-single'
      ? '🔍 Einzeln KI-Suchen'
      : '🌐 Suche & KI-Analyse';

  const subtitleText = isBatch
    ? `${itemCount} ${itemCount === 1 ? 'Angebot' : 'Angebote'} im Scope`
    : (priceText ? `${title} · ${priceText}` : title);

  const { options: modelOpts, selectedValue } = buildLauncherModelOptions(CONFIG);
  const hasOrKey = hasOpenRouterKey(CONFIG);
  const showTavily = mode === 'single' && hasTavilyKey(CONFIG);
  const threshold = Number.isFinite(CONFIG?.BATCH_CONFIRM_THRESHOLD) ? CONFIG.BATCH_CONFIRM_THRESHOLD : 10;
  const showWarn = isBatch && itemCount >= threshold;

  const header = document.createElement('div');
  header.className = 'tp-launcher-head';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'tp-launcher-title-wrap';
  const titleEl = document.createElement('div');
  titleEl.className = 'tp-launcher-title';
  titleEl.textContent = headerTitle;
  titleWrap.appendChild(titleEl);

  if (subtitleText) {
    const subEl = document.createElement('div');
    subEl.className = 'tp-launcher-sub';
    subEl.textContent = subtitleText;
    subEl.title = subtitleText;
    titleWrap.appendChild(subEl);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.id = 'tp-launcher-close-btn';
  closeBtn.className = 'tp-bp-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Schliessen');
  header.append(titleWrap, closeBtn);
  el.appendChild(header);

  // Batch limit + threshold warning
  let limitInput = null;
  if (isBatch && itemCount > 1) {
    if (showWarn) {
      const warn = document.createElement('div');
      warn.className = 'tp-batch-dialog-warn tp-launcher-warn';
      warn.textContent = `⚠️ Hinweis: Ab ${threshold} Karten fragt Batch vor mehreren Tabs oder API-Aufrufen nach.`;
      el.appendChild(warn);
    }
    const limRow = document.createElement('div');
    limRow.className = 'tp-launcher-limit-row';
    const limLbl = document.createElement('label');
    limLbl.htmlFor = 'tp-launcher-limit-input';
    limLbl.textContent = 'Nur erste N verarbeiten:';
    limitInput = document.createElement('input');
    limitInput.type = 'number';
    limitInput.id = 'tp-launcher-limit-input';
    limitInput.min = '1';
    limitInput.max = String(itemCount);
    limitInput.value = String(itemCount);
    limRow.append(limLbl, limitInput);
    el.appendChild(limRow);
  }

  const currentLimit = () => (limitInput
    ? Math.max(1, Math.min(itemCount, parseInt(limitInput.value, 10) || itemCount))
    : itemCount);

  // Speed section: Google Search + Google AI
  const speedGroup = document.createElement('div');
  speedGroup.className = 'tp-launcher-group';
  const speedLabel = document.createElement('div');
  speedLabel.className = 'tp-bp-group-label';
  speedLabel.textContent = '⚡ Schnell — Google';
  const speedRow = document.createElement('div');
  speedRow.className = 'tp-launcher-speed-row';

  const googleBtn = document.createElement('button');
  googleBtn.type = 'button';
  googleBtn.id = 'tp-launcher-google-btn';
  googleBtn.className = 'tp-launcher-btn';
  googleBtn.textContent = '🔍 Google Suche';

  const googleAiBtn = document.createElement('button');
  googleAiBtn.type = 'button';
  googleAiBtn.id = 'tp-launcher-google-ai-btn';
  googleAiBtn.className = 'tp-launcher-btn';
  googleAiBtn.textContent = '✨ Google AI';

  speedRow.append(googleBtn, googleAiBtn);
  speedGroup.append(speedLabel, speedRow);
  el.appendChild(speedGroup);

  // Research section: OpenRouter + model picker
  const orGroup = document.createElement('div');
  orGroup.className = 'tp-launcher-group tp-launcher-or-box';
  const orHead = document.createElement('div');
  orHead.className = 'tp-launcher-or-head';
  const orLabel = document.createElement('span');
  orLabel.className = 'tp-bp-group-label';
  orLabel.textContent = '🔬 Gründlich — OpenRouter';
  const cacheBadge = document.createElement('span');
  cacheBadge.id = 'tp-launcher-cache-badge';
  cacheBadge.className = 'tp-launcher-cache-badge';
  cacheBadge.textContent = '⚡ Gecacht';
  cacheBadge.hidden = true;
  orHead.append(orLabel, cacheBadge);
  orGroup.appendChild(orHead);

  const modelSelect = document.createElement('select');
  modelSelect.id = 'tp-launcher-or-model';
  modelSelect.className = 'tp-launcher-select';
  modelSelect.setAttribute('aria-label', 'OpenRouter Modell für diesen Start');
  for (const opt of modelOpts) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    modelSelect.appendChild(o);
  }
  const customOpt = document.createElement('option');
  customOpt.value = CUSTOM_MODEL_SENTINEL;
  customOpt.textContent = '✏️ Einmaliges Modell…';
  modelSelect.appendChild(customOpt);
  modelSelect.value = selectedValue;
  orGroup.appendChild(modelSelect);

  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.id = 'tp-launcher-or-custom';
  customInput.className = 'tp-launcher-input';
  customInput.placeholder = 'z.B. openai/gpt-4.1-mini';
  customInput.spellcheck = false;
  customInput.hidden = true;
  orGroup.appendChild(customInput);

  const resolveModel = () => (modelSelect.value === CUSTOM_MODEL_SENTINEL
    ? String(customInput.value || '').trim()
    : String(modelSelect.value || '').trim() || DEFAULT_OPENROUTER_MODEL);

  const refreshCacheBadge = () => {
    if (mode !== 'single' || !hasOrKey) {
      cacheBadge.hidden = true;
      return;
    }
    const m = resolveModel();
    if (!m) {
      cacheBadge.hidden = true;
      return;
    }
    const hit = getCachedConfiguredAiSummary(title, CONFIG.REVIEW_SEARCH_KEYWORD, priceText, {
      provider: 'openrouter',
      model: m
    });
    cacheBadge.hidden = !hit?.answer;
  };

  modelSelect.addEventListener('change', () => {
    const isCustom = modelSelect.value === CUSTOM_MODEL_SENTINEL;
    customInput.hidden = !isCustom;
    if (isCustom) customInput.focus();
    refreshCacheBadge();
  });
  customInput.addEventListener('input', refreshCacheBadge);

  if (hasOrKey) {
    const orBtn = document.createElement('button');
    orBtn.type = 'button';
    orBtn.id = 'tp-launcher-or-btn';
    orBtn.className = 'tp-launcher-btn tp-launcher-btn-primary';
    orBtn.textContent = '🤖 Mit OpenRouter starten';
    orBtn.addEventListener('click', () => {
      const m = resolveModel();
      if (!m) {
        showToast('Bitte eine OpenRouter Modell-ID eingeben');
        customInput.focus();
        return;
      }
      const limit = currentLimit();
      closeAiLauncherPopover();
      onLaunch?.({ engine: 'openrouter', model: m, googleAiMode: false, limit });
    });
    orGroup.appendChild(orBtn);
  } else {
    const setupBtn = document.createElement('button');
    setupBtn.type = 'button';
    setupBtn.id = 'tp-launcher-or-setup-btn';
    setupBtn.className = 'tp-launcher-btn tp-launcher-btn-setup';
    setupBtn.textContent = '🔑 OpenRouter Key einrichten →';
    setupBtn.addEventListener('click', () => {
      closeAiLauncherPopover();
      openSettingsAt('tp-section-review');
      const shadow = document.getElementById('tp-root')?.shadowRoot;
      const orBlock = shadow?.getElementById('tp-ai-openrouter-block');
      if (orBlock) orBlock.open = true;
    });
    orGroup.appendChild(setupBtn);
  }
  el.appendChild(orGroup);

  // Secondary options
  if (showTavily) {
    const secRow = document.createElement('div');
    secRow.className = 'tp-launcher-sec-row';
    const tavBtn = document.createElement('button');
    tavBtn.type = 'button';
    tavBtn.id = 'tp-launcher-tavily-btn';
    tavBtn.className = 'tp-launcher-btn tp-launcher-btn-subtle';
    tavBtn.textContent = '🧠 Tavily Direktfazit';
    tavBtn.addEventListener('click', () => {
      closeAiLauncherPopover();
      onLaunch?.({ engine: 'tavily', model: '', googleAiMode: false, limit: 1 });
    });
    secRow.appendChild(tavBtn);
    el.appendChild(secRow);
  } else if (mode === 'batch-compare') {
    const extGroup = document.createElement('div');
    extGroup.className = 'tp-launcher-group';
    const extLabel = document.createElement('div');
    extLabel.className = 'tp-bp-group-label';
    extLabel.textContent = 'Externe KI-Plattformen';
    const extRow = document.createElement('div');
    extRow.className = 'tp-launcher-ext-row';
    for (const [id, label] of [['chatgpt', 'ChatGPT'], ['perplexity', 'Perplexity'], ['claude', 'Claude']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tp-launcher-pill';
      b.dataset.target = id;
      b.textContent = label;
      b.addEventListener('click', () => {
        const limit = currentLimit();
        closeAiLauncherPopover();
        onLaunch?.({ engine: id, model: '', googleAiMode: false, limit });
      });
      extRow.appendChild(b);
    }
    extGroup.append(extLabel, extRow);
    el.appendChild(extGroup);
  }

  googleBtn.addEventListener('click', () => {
    const limit = currentLimit();
    closeAiLauncherPopover();
    onLaunch?.({ engine: 'google', model: '', googleAiMode: false, limit });
  });
  googleAiBtn.addEventListener('click', () => {
    const limit = currentLimit();
    closeAiLauncherPopover();
    onLaunch?.({ engine: 'google-ai', model: '', googleAiMode: true, limit });
  });
  closeBtn.addEventListener('click', closeAiLauncherPopover);

  let closed = false;
  const onDocClick = (e) => {
    if (closed) return;
    if (el.contains(e.target) || anchorEl?.contains?.(e.target)) return;
    closeAiLauncherPopover();
  };
  const onDocKeydown = (e) => {
    if (!closed && e.key === 'Escape') {
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      closeAiLauncherPopover();
    }
  };

  activeCleanup = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onDocKeydown, true);
    el.remove();
    try {
      if (prevFocus && prevFocus.isConnected !== false) prevFocus.focus?.();
    } catch {}
  };

  document.body.appendChild(el);
  refreshCacheBadge();
  positionLauncher(el, anchorEl);

  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onDocKeydown, true);
  closeBtn.focus?.();
  return el;
}
