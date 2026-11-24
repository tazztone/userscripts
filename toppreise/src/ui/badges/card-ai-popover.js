/**
 * On-Card AI Verdict Popover Component
 * Renders an accessible floating modal (#tp-ai-popout) displaying a synthesized
 * Tavily test report verdict and quick-action buttons (Google, Copy, Discord).
 */

import { CONFIG, DEFAULT_OPENROUTER_MODEL, effectiveAiProvider } from '../../state/config.js';
import { buildTavilyQuery } from '../../features/tavily-search.js';
import { getCachedConfiguredAiSummary, fetchConfiguredAiSummary } from '../../features/openrouter-search.js';
import { buildLauncherModelOptions, CUSTOM_MODEL_SENTINEL } from '../ai-launcher-popover.js';
import { createPopoutDialog } from '../popout-dialog.js';
import { showToast } from '../toast.js';

export function formatVerdictHtml(text) {
  if (!text) return '';
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return escaped
    .replace(/^#{1,3}[ \t]+(.+)$/gm, '<strong class="tp-ai-h">$1</strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|\n)[ \t]*[-*][ \t]+/g, '$1• ');
}

// Error text is transport-owned (today always a fixed string), but it must
// never be trusted as HTML. Build nodes so future error sources stay inert.
export function renderAiError(el, msg, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!el || !doc) return;
  const warn = doc.createElement('span');
  warn.className = 'tp-ai-error-msg';
  warn.textContent = `⚠️ ${msg}`;

  const help = doc.createElement('span');
  help.className = 'tp-ai-error-help';
  help.textContent = 'Du kannst stattdessen direkt die Google-Suche öffnen.';

  el.replaceChildren(warn, doc.createElement('br'), help);
}

let activeAiPopoverCleanup = null;

export function closeAiPopover() {
  if (typeof activeAiPopoverCleanup === 'function') {
    const fn = activeAiPopoverCleanup;
    activeAiPopoverCleanup = null;
    fn();
    return;
  }
  const el = typeof document !== 'undefined' ? document.getElementById('tp-ai-popout') : null;
  el?.remove();
}

export function openAiPopover(options = {}) {
  if (typeof document === 'undefined') return null;
  closeAiPopover();

  const { title = '', priceText = '', googleUrl = '', card = null, provider = null, model = '' } = options;

  const activeProv = (provider === 'openrouter' || provider === 'tavily')
    ? provider
    : (effectiveAiProvider(CONFIG) === 'openrouter' ? 'openrouter' : 'tavily');
  let activeModel = (model && String(model).trim()) || CONFIG.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const query = buildTavilyQuery(title, CONFIG.REVIEW_SEARCH_KEYWORD, priceText);
  const initialCached = getCachedConfiguredAiSummary(title, CONFIG.REVIEW_SEARCH_KEYWORD, priceText, {
    provider: activeProv,
    model: activeModel
  });

  let statusTimers = [];
  let activeAbort = null;
  const clearTimers = () => {
    statusTimers.forEach(t => clearTimeout(t));
    statusTimers = [];
  };
  const abortFetch = () => {
    if (activeAbort) {
      try { activeAbort.abort(); } catch {}
      activeAbort = null;
    }
  };

  const { backdrop, panel, mount, close } = createPopoutDialog({
    id: 'tp-ai-popout',
    label: 'KI-Fazit und Preiseinschätzung',
    title: '🤖 KI-Kurzfazit & Preiseinschätzung',
    panelClass: 'tp-ai-panel',
    onClose: () => {
      clearTimers();
      abortFetch();
      activeAiPopoverCleanup = null;
    }
  });
  activeAiPopoverCleanup = close;

  // Subheader: Product title & price
  const subheader = document.createElement('div');
  subheader.className = 'tp-ai-sub';

  const prodName = document.createElement('div');
  prodName.className = 'tp-ai-prod';
  prodName.textContent = title;
  prodName.title = title;

  subheader.appendChild(prodName);
  if (priceText) {
    const priceBadge = document.createElement('span');
    priceBadge.className = 'tp-ai-price';
    priceBadge.textContent = priceText;
    subheader.appendChild(priceBadge);
  }
  panel.appendChild(subheader);

  let modelBarSelect = null;
  let modelBarCustom = null;
  if (activeProv === 'openrouter') {
    const modelBar = document.createElement('div');
    modelBar.className = 'tp-ai-model-bar';
    const lbl = document.createElement('label');
    lbl.htmlFor = 'tp-ai-popout-model-select';
    lbl.textContent = 'Modell:';

    modelBarSelect = document.createElement('select');
    modelBarSelect.id = 'tp-ai-popout-model-select';
    const { options: mOpts } = buildLauncherModelOptions(CONFIG);
    const hasActive = mOpts.some(o => o.value === activeModel);
    if (!hasActive && activeModel) {
      const customActive = document.createElement('option');
      customActive.value = activeModel;
      customActive.textContent = `${activeModel} (Einmalig)`;
      modelBarSelect.appendChild(customActive);
    }
    for (const o of mOpts) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      modelBarSelect.appendChild(opt);
    }
    const custOpt = document.createElement('option');
    custOpt.value = CUSTOM_MODEL_SENTINEL;
    custOpt.textContent = '✏️ Einmaliges Modell…';
    modelBarSelect.appendChild(custOpt);
    modelBarSelect.value = activeModel;

    modelBarCustom = document.createElement('input');
    modelBarCustom.type = 'text';
    modelBarCustom.id = 'tp-ai-popout-model-custom';
    modelBarCustom.placeholder = 'provider/model-id + Enter';
    modelBarCustom.spellcheck = false;
    modelBarCustom.hidden = true;

    modelBar.append(lbl, modelBarSelect, modelBarCustom);
    panel.appendChild(modelBar);
  }

  // Body content: loading / result / error
  const contentEl = document.createElement('div');
  contentEl.className = 'tp-ai-body';

  let currentVerdict = '';

  const renderVerdict = (text, citations = []) => {
    clearTimers();
    currentVerdict = text;
    contentEl.className = 'tp-ai-body';
    contentEl.innerHTML = formatVerdictHtml(text);
    if (Array.isArray(citations) && citations.length > 0) {
      const citeWrap = document.createElement('div');
      citeWrap.className = 'tp-ai-citations';
      const lbl = document.createElement('span');
      lbl.className = 'tp-ai-citations-label';
      lbl.textContent = 'Quellen:';
      citeWrap.appendChild(lbl);
      for (const c of citations) {
        if (!c?.url || !/^https?:\/\//i.test(c.url)) continue;
        const a = document.createElement('a');
        a.className = 'tp-ai-citation-link';
        a.href = c.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = c.title || c.url;
        citeWrap.appendChild(a);
      }
      contentEl.appendChild(citeWrap);
    }
    copyBtn.disabled = false;
    retryBtn.hidden = true;
  };

  const renderError = (msg) => {
    clearTimers();
    contentEl.className = 'tp-ai-body tp-ai-error';
    renderAiError(contentEl, msg);
    copyBtn.disabled = true;
    retryBtn.hidden = false;
  };

  // Footer action buttons
  const footer = document.createElement('div');
  footer.className = 'tp-popout-footer';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'tp-popout-btn';
  retryBtn.hidden = true;
  retryBtn.textContent = '🔄 Erneut versuchen';

  const fetchSummary = () => {
    clearTimers();
    abortFetch();
    currentVerdict = '';
    copyBtn.disabled = true;
    retryBtn.hidden = true;
    contentEl.className = 'tp-ai-body';
    contentEl.innerHTML = '<span class="tp-ai-status">🤖 Analysiere Testberichte & Preiseinschätzung...</span>';

    statusTimers.push(setTimeout(() => {
      if (backdrop.isConnected && !currentVerdict) {
        contentEl.innerHTML = '<span class="tp-ai-status tp-ai-status-delayed">🤖 Websuche läuft noch (Testberichte werden analysiert)...</span>';
      }
    }, 5000));

    statusTimers.push(setTimeout(() => {
      if (backdrop.isConnected && !currentVerdict) {
        contentEl.innerHTML = '<span class="tp-ai-status tp-ai-status-delayed">⏳ Synthese dauert etwas länger, läuft im Hintergrund weiter...<br><span class="tp-ai-status-sub">Antwort erscheint hier automatisch sobald fertig.</span></span>';
      }
    }, 12000));

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    activeAbort = controller;

    fetchConfiguredAiSummary(title, CONFIG.REVIEW_SEARCH_KEYWORD, priceText, {
      timeoutMs: 60000,
      provider: activeProv,
      model: activeModel,
      signal: controller?.signal
    })
      .then(result => {
        if (activeAbort === controller) activeAbort = null;
        if (backdrop.isConnected) {
          renderVerdict(result?.answer || '', result?.citations || []);
        }
      })
      .catch(err => {
        if (activeAbort === controller) activeAbort = null;
        if (err?.cancelled) return;
        if (backdrop.isConnected) {
          renderError(err?.message || 'Fehler beim Laden des Fazits');
        }
      });
  };

  const switchModel = (nextModel) => {
    const clean = String(nextModel || '').trim();
    if (!clean) return;
    activeModel = clean;
    const hit = getCachedConfiguredAiSummary(title, CONFIG.REVIEW_SEARCH_KEYWORD, priceText, {
      provider: 'openrouter',
      model: activeModel
    });
    if (hit?.answer) {
      abortFetch();
      renderVerdict(hit.answer, hit.citations || []);
    } else {
      fetchSummary();
    }
  };

  if (modelBarSelect) {
    modelBarSelect.addEventListener('change', () => {
      if (modelBarSelect.value === CUSTOM_MODEL_SENTINEL) {
        modelBarCustom.hidden = false;
        modelBarCustom.focus();
      } else {
        modelBarCustom.hidden = true;
        switchModel(modelBarSelect.value);
      }
    });
    modelBarCustom.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = String(modelBarCustom.value || '').trim();
        if (val) switchModel(val);
      }
    });
  }

  retryBtn.addEventListener('click', fetchSummary);

  const googleBtn = document.createElement('a');
  googleBtn.href = googleUrl || ('https://www.google.com/search?q=' + encodeURIComponent(query));
  googleBtn.target = '_blank';
  googleBtn.rel = 'noopener';
  googleBtn.className = 'tp-popout-btn';
  googleBtn.textContent = '↗ Google-Suche';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'tp-popout-btn';
  copyBtn.textContent = '📋 Fazit kopieren';
  copyBtn.disabled = !initialCached?.answer;

  copyBtn.addEventListener('click', () => {
    if (!currentVerdict) return;
    if (typeof navigator?.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(currentVerdict).then(() => {
        copyBtn.textContent = '✅ Kopiert!';
        setTimeout(() => { copyBtn.textContent = '📋 Fazit kopieren'; }, 1800);
      }).catch(() => {
        showToast('Kopieren fehlgeschlagen');
      });
    }
  });

  const discordBtn = document.createElement('button');
  discordBtn.type = 'button';
  discordBtn.className = 'tp-popout-btn';
  discordBtn.textContent = '📤 In Discord teilen';

  discordBtn.addEventListener('click', () => {
    const shareBtn = card?.querySelector('.tp-share-btn');
    if (shareBtn && typeof shareBtn.click === 'function') {
      close();
      shareBtn.click();
    } else {
      showToast('Deals können nur bei verifizierten Tiefstpreisen geteilt werden');
    }
  });

  if (initialCached?.answer) {
    renderVerdict(initialCached.answer, initialCached.citations || []);
  } else {
    contentEl.innerHTML = '<span style="opacity:0.75;">🤖 Analysiere Testberichte & Preiseinschätzung...</span>';
  }
  panel.appendChild(contentEl);

  footer.appendChild(retryBtn);
  footer.appendChild(googleBtn);
  footer.appendChild(copyBtn);
  footer.appendChild(discordBtn);
  panel.appendChild(footer);

  mount();

  // If not cached, trigger fetch now
  if (!initialCached?.answer) {
    fetchSummary();
  }

  return backdrop;
}
