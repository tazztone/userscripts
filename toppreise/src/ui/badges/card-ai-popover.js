/**
 * On-Card AI Verdict Popover Component
 * Renders an accessible floating modal (#tp-ai-popout) displaying a synthesized
 * Tavily test report verdict and quick-action buttons (Google, Copy, Discord).
 */

import { CONFIG } from '../../state/config.js';
import { buildTavilyQuery, fetchTavilySummary, getCachedTavily } from '../../features/tavily-search.js';
import { showToast } from '../toast.js';

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
  const prevFocus = typeof document.activeElement !== 'undefined' ? document.activeElement : null;

  const query = buildTavilyQuery(title, CONFIG.REVIEW_SEARCH_KEYWORD, priceText);
  const cached = getCachedTavily(query);

  const backdrop = document.createElement('div');
  backdrop.id = 'tp-ai-popout';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'KI-Fazit und Preiseinschätzung');
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.45);backdrop-filter:blur(2px);padding:16px;box-sizing:border-box;';

  const panel = document.createElement('div');
  panel.style.cssText = 'background:var(--tp-bg, #1e293b);color:var(--tp-txt, #f8fafc);border:1px solid var(--tp-line-soft, #334155);border-radius:var(--tp-r-lg, 12px);padding:18px 20px;max-width:min(520px,94vw);box-shadow:0 20px 60px rgba(0,0,0,0.5);box-sizing:border-box;display:flex;flex-direction:column;gap:12px;';

  // Header row
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--tp-line-soft, #334155);padding-bottom:10px;';

  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:var(--tp-txt-mid, #cbd5e1);';
  titleRow.innerHTML = '<span>🤖 KI-Kurzfazit & Preiseinschätzung</span>';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Schliessen');
  closeBtn.style.cssText = 'background:transparent;border:0;color:var(--tp-mut, #94a3b8);font-size:16px;cursor:pointer;padding:4px 8px;border-radius:4px;line-height:1;';
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#fff'; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = 'var(--tp-mut, #94a3b8)'; });

  header.appendChild(titleRow);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Subheader: Product title & price
  const subheader = document.createElement('div');
  subheader.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:10px;';

  const prodName = document.createElement('div');
  prodName.style.cssText = 'font-size:14px;font-weight:600;color:var(--tp-txt, #f8fafc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
  prodName.textContent = title;
  prodName.title = title;

  subheader.appendChild(prodName);
  if (priceText) {
    const priceBadge = document.createElement('span');
    priceBadge.style.cssText = 'font-size:13px;font-weight:700;color:#10b981;white-space:nowrap;background:rgba(16,185,129,0.12);padding:2px 6px;border-radius:4px;';
    priceBadge.textContent = priceText;
    subheader.appendChild(priceBadge);
  }
  panel.appendChild(subheader);

  // Body content: loading / result / error
  const contentEl = document.createElement('div');
  contentEl.style.cssText = 'font-size:13px;line-height:1.55;color:var(--tp-txt-mid, #cbd5e1);min-height:56px;background:rgba(0,0,0,0.18);padding:12px;border-radius:8px;border-left:3px solid #5865f2;';

  let currentVerdict = '';

  const renderVerdict = (text) => {
    currentVerdict = text;
    contentEl.textContent = text;
    copyBtn.disabled = false;
  };

  const renderError = (msg) => {
    contentEl.style.borderLeftColor = '#ef4444';
    contentEl.innerHTML = `<span style="color:#ef4444;font-weight:600;">⚠️ ${msg}</span><br><span style="font-size:12px;opacity:0.85;margin-top:4px;display:inline-block;">Du kannst stattdessen direkt die Google-Suche öffnen.</span>`;
    copyBtn.disabled = true;
  };

  if (cached?.answer) {
    renderVerdict(cached.answer);
  } else {
    contentEl.innerHTML = '<span style="opacity:0.75;">🤖 Analysiere Testberichte & Preiseinschätzung...</span>';
  }
  panel.appendChild(contentEl);

  // Footer action buttons
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:4px;';

  const googleBtn = document.createElement('a');
  googleBtn.href = googleUrl || ('https://www.google.com/search?q=' + encodeURIComponent(query));
  googleBtn.target = '_blank';
  googleBtn.rel = 'noopener';
  googleBtn.className = 'tp-btn tp-btn-secondary';
  googleBtn.style.cssText = 'padding:6px 12px;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;border-radius:6px;';
  googleBtn.textContent = '↗ Google-Suche';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'tp-btn tp-btn-secondary';
  copyBtn.style.cssText = 'padding:6px 12px;font-size:12px;display:inline-flex;align-items:center;gap:4px;border-radius:6px;cursor:pointer;';
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
  discordBtn.className = 'tp-btn tp-btn-secondary';
  discordBtn.style.cssText = 'padding:6px 12px;font-size:12px;display:inline-flex;align-items:center;gap:4px;border-radius:6px;cursor:pointer;';
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

  footer.appendChild(googleBtn);
  footer.appendChild(copyBtn);
  footer.appendChild(discordBtn);
  panel.appendChild(footer);

  // Close handlers
  const onKey = e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      close();
    }
  };

  function close() {
    document.removeEventListener('keydown', onKey);
    activeAiPopoverCleanup = null;
    backdrop.remove();
    try { prevFocus?.focus?.(); } catch {}
  }

  activeAiPopoverCleanup = close;
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) close();
  });

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  closeBtn.focus?.();

  // If not cached, trigger fetch now
  if (!cached?.answer) {
    fetchTavilySummary(CONFIG.TAVILY_API_KEY, query, { timeoutMs: 7500 })
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
  }

  return backdrop;
}
