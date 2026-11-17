/**
 * On-Card AI Verdict Popover Component
 * Renders an accessible floating modal (#tp-ai-popout) displaying a synthesized
 * Tavily test report verdict and quick-action buttons (Google, Copy, Discord).
 */

import { CONFIG } from '../../state/config.js';
import { buildTavilyQuery, fetchTavilySummary, getCachedTavily } from '../../features/tavily-search.js';
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

  const { title = '', priceText = '', googleUrl = '', card = null } = options;

  const query = buildTavilyQuery(title, CONFIG.REVIEW_SEARCH_KEYWORD, priceText);
  const cached = getCachedTavily(query);

  let statusTimers = [];
  const clearTimers = () => {
    statusTimers.forEach(t => clearTimeout(t));
    statusTimers = [];
  };

  const { backdrop, panel, mount, close } = createPopoutDialog({
    id: 'tp-ai-popout',
    label: 'KI-Fazit und Preiseinschätzung',
    title: '🤖 KI-Kurzfazit & Preiseinschätzung',
    panelClass: 'tp-ai-panel',
    onClose: () => {
      clearTimers();
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

  // Body content: loading / result / error
  const contentEl = document.createElement('div');
  contentEl.className = 'tp-ai-body';

  let currentVerdict = '';

  const renderVerdict = (text) => {
    clearTimers();
    currentVerdict = text;
    contentEl.className = 'tp-ai-body';
    contentEl.innerHTML = formatVerdictHtml(text);
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
    retryBtn.hidden = true;
    contentEl.className = 'tp-ai-body';
    contentEl.innerHTML = '<span style="opacity:0.75;">🤖 Analysiere Testberichte & Preiseinschätzung...</span>';

    statusTimers.push(setTimeout(() => {
      if (backdrop.isConnected && !currentVerdict) {
        contentEl.innerHTML = '<span style="opacity:0.85;">🤖 Websuche läuft noch (Testberichte werden analysiert)...</span>';
      }
    }, 5000));

    statusTimers.push(setTimeout(() => {
      if (backdrop.isConnected && !currentVerdict) {
        contentEl.innerHTML = '<span style="opacity:0.85;">⏳ Synthese dauert etwas länger, läuft im Hintergrund weiter...<br><span style="font-size:12px;opacity:0.75;margin-top:4px;display:inline-block;">Antwort erscheint hier automatisch sobald fertig.</span></span>';
      }
    }, 12000));

    fetchTavilySummary(CONFIG.TAVILY_API_KEY, query, {
      timeoutMs: 60000,
      searchDepth: CONFIG.TAVILY_SEARCH_DEPTH,
      maxResults: CONFIG.TAVILY_MAX_RESULTS
    })
      .then(answer => {
        if (backdrop.isConnected) {
          renderVerdict(answer);
        }
      })
      .catch(err => {
        if (backdrop.isConnected) {
          renderError(err?.message || 'Fehler beim Laden des Fazits');
        }
      });
  };

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
  copyBtn.disabled = !cached?.answer;

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

  if (cached?.answer) {
    renderVerdict(cached.answer);
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
  if (!cached?.answer) {
    fetchSummary();
  }

  return backdrop;
}
