/**
 * Shared accessible modal shell for light-DOM card/chart popouts (#tp-sparkline-popout, #tp-ai-popout).
 * Uses plain className/hidden properties and guards querySelectorAll so Node DOM mocks work cleanly.
 */

const FOCUSABLE_SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function visibleFocusables(panel) {
  if (typeof panel?.querySelectorAll !== 'function') return [];
  return Array.from(panel.querySelectorAll(FOCUSABLE_SEL)).filter(el => {
    if (!el || el.hidden || el.disabled) return false;
    if (el.getAttribute?.('aria-hidden') === 'true') return false;
    return typeof el.getClientRects !== 'function' || el.getClientRects().length > 0;
  });
}

export function createPopoutDialog({ id, label, title = '', panelClass = '', closeLabel = 'Schliessen', actions = [], onClose = null } = {}) {
  const rawActive = typeof document.activeElement !== 'undefined' ? document.activeElement : null;
  const prevFocus = rawActive?.shadowRoot?.activeElement || rawActive;

  const backdrop = document.createElement('div');
  if (id) backdrop.id = id;
  backdrop.className = 'tp-popout-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  if (label) backdrop.setAttribute('aria-label', label);

  const panel = document.createElement('div');
  panel.className = panelClass ? `tp-popout-panel ${panelClass}` : 'tp-popout-panel';

  const header = document.createElement('div');
  header.className = 'tp-popout-header';

  const titleEl = document.createElement('div');
  titleEl.className = 'tp-popout-title';
  titleEl.textContent = title;
  if (title) titleEl.title = title;

  const headerActions = document.createElement('div');
  headerActions.className = 'tp-popout-actions';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'tp-popout-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', closeLabel);

  for (const act of actions) headerActions.appendChild(act);
  headerActions.appendChild(closeBtn);
  header.appendChild(titleEl);
  header.appendChild(headerActions);
  panel.appendChild(header);
  backdrop.appendChild(panel);

  let closed = false;
  let backdropMousedown = false;
  const onKey = e => {
    if (backdrop.isConnected === false) {
      close();
      return;
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = visibleFocusables(panel);
    if (!focusables.length) {
      e.preventDefault();
      closeBtn.focus?.();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !panel.contains?.(active))) {
      e.preventDefault();
      last.focus?.();
    } else if (!e.shiftKey && (active === last || !panel.contains?.(active))) {
      e.preventDefault();
      first.focus?.();
    }
  };

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    try { onClose?.(); } catch {}
    backdrop.remove();
    try {
      if (prevFocus && prevFocus.isConnected !== false) prevFocus.focus?.();
    } catch {}
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('mousedown', e => {
    backdropMousedown = e.target === backdrop;
  });
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop && backdropMousedown) close();
    backdropMousedown = false;
  });

  function mount() {
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(backdrop);
    closeBtn.focus?.();
    return backdrop;
  }

  return { backdrop, panel, header, titleEl, headerActions, closeBtn, mount, close };
}
