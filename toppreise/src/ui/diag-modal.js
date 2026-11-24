/**
 * Dev Diagnostic Log Modal
 * Triggered by 600ms long-press or Shift+Click on #tp-settings-fab, or ToppreiseSuite.openDiagLog().
 * Displays live runtime snapshot and secret-redacted in-memory activity log.
 */

import { CONFIG, updateConfig } from '../state/config.js';
import { getPageProfileType } from '../page/adapter.js';
import { scanState } from '../state/store.js';
import { getFeedRefreshState } from '../page/feed-refresh.js';
import { activeFetches } from '../scanner/scanner.js';
import { getActivityLog, clearActivityLog, getPersistentActivityLog, clearPersistentActivityLog, formatActivityLogText, subscribeActivityLog } from '../state/activity-log.js';
import { showToast } from './toast.js';

let suppressNextFabClick = false;

export function openDiagModal(shadow) {
  if (!shadow) return;
  let dialog = shadow.getElementById('tp-diag-dialog');
  let unsub = null;

  const getState = () => {
    if (!dialog._tpState) {
      dialog._tpState = { activeTab: 'session', sessionWarnOnly: false };
    }
    return dialog._tpState;
  };

  const renderSnapshotAndLog = () => {
    if (!dialog) return;
    const state = getState();
    const snapEl = dialog.querySelector('#tp-diag-snapshot');
    const preEl = dialog.querySelector('#tp-diag-log-pre');
    const debugToggle = dialog.querySelector('#tp-diag-debug-toggle');
    const warnFilter = dialog.querySelector('#tp-diag-warn-filter');
    const sessionTabBtn = dialog.querySelector('#tp-diag-tab-session');
    const persistentTabBtn = dialog.querySelector('#tp-diag-tab-persistent');
    if (debugToggle) debugToggle.checked = CONFIG.DEBUG === true;

    const persistent = getPersistentActivityLog();
    if (sessionTabBtn) {
      const isSession = state.activeTab === 'session';
      sessionTabBtn.classList.toggle('tp-diag-tab-active', isSession);
      sessionTabBtn.setAttribute('aria-pressed', String(isSession));
    }
    if (persistentTabBtn) {
      const isPersistent = state.activeTab === 'persistent';
      persistentTabBtn.textContent = `Langzeit (${persistent.length})`;
      persistentTabBtn.classList.toggle('tp-diag-tab-active', isPersistent);
      persistentTabBtn.setAttribute('aria-pressed', String(isPersistent));
    }

    const refresh = getFeedRefreshState();
    const version = (typeof GM_info !== 'undefined' && GM_info?.script?.version) || 'dev';
    const snapLines = [
      `v${version} | page=${getPageProfileType()} | DEBUG=${!!CONFIG.DEBUG} | persistentWarns=${persistent.length}`,
      `scan: active=${scanState.isBatchChecking} (${scanState.progress?.completed || 0}/${scanState.progress?.total || 0}) | activeFetches=${activeFetches.size}`,
      `refresh: active=${refresh.active} stage=${refresh.stage} last=${refresh.lastOutcome || '-'}${refresh.lastError ? ` err=${refresh.lastError}` : ''}`,
    ];
    if (snapEl) snapEl.textContent = snapLines.join('\n');

    let formatted = '';
    if (state.activeTab === 'persistent') {
      if (warnFilter) {
        warnFilter.checked = true;
        warnFilter.disabled = true;
      }
      formatted = persistent.length > 0 ? formatActivityLogText(persistent, { includeDate: true }) : '';
    } else {
      if (warnFilter) {
        warnFilter.disabled = false;
        warnFilter.checked = state.sessionWarnOnly;
      }
      const entries = getActivityLog();
      const filtered = state.sessionWarnOnly
        ? entries.filter((e) => e.level === 'warn' || e.level === 'error')
        : entries;
      formatted = filtered.length > 0 ? formatActivityLogText(filtered) : '';
    }
    if (preEl) {
      preEl.textContent = formatted || '(keine Einträge)';
      preEl.scrollTop = preEl.scrollHeight;
    }
  };

  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'tp-diag-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'tp-diag-title');
    dialog.innerHTML = `
      <div class="tp-diag-head">
        <strong id="tp-diag-title">🛠️ Toppreise Dev-Diagnose-Log</strong>
        <button type="button" id="tp-diag-close-btn" class="tp-btn tp-btn-secondary">Schliessen</button>
      </div>
      <pre id="tp-diag-snapshot"></pre>
      <div class="tp-diag-tabs" role="tablist">
        <button type="button" id="tp-diag-tab-session" class="tp-btn tp-btn-secondary tp-diag-tab tp-diag-tab-active" aria-pressed="true">Sitzung</button>
        <button type="button" id="tp-diag-tab-persistent" class="tp-btn tp-btn-secondary tp-diag-tab" aria-pressed="false">Langzeit (0)</button>
      </div>
      <div class="tp-diag-toolbar">
        <label><input type="checkbox" id="tp-diag-warn-filter"> Nur Warn+Err</label>
        <label><input type="checkbox" id="tp-diag-debug-toggle"> Debug-Konsole</label>
        <button type="button" id="tp-diag-refresh-btn" class="tp-btn tp-btn-secondary">Aktualisieren</button>
        <button type="button" id="tp-diag-copy-btn" class="tp-btn tp-btn-secondary">Kopieren</button>
        <button type="button" id="tp-diag-clear-btn" class="tp-btn tp-btn-secondary">Leeren</button>
      </div>
      <pre id="tp-diag-log-pre"></pre>
    `;
    shadow.appendChild(dialog);

    dialog.querySelector('#tp-diag-close-btn').addEventListener('click', () => dialog.close());
    dialog.querySelector('#tp-diag-tab-session').addEventListener('click', () => {
      getState().activeTab = 'session';
      renderSnapshotAndLog();
    });
    dialog.querySelector('#tp-diag-tab-persistent').addEventListener('click', () => {
      getState().activeTab = 'persistent';
      renderSnapshotAndLog();
    });
    dialog.querySelector('#tp-diag-refresh-btn').addEventListener('click', renderSnapshotAndLog);
    dialog.querySelector('#tp-diag-clear-btn').addEventListener('click', () => {
      if (getState().activeTab === 'persistent') {
        if (!window.confirm('Langzeit-Diagnose-Log (Warn+Err) wirklich leeren?')) return;
        clearPersistentActivityLog();
      } else {
        clearActivityLog();
      }
      renderSnapshotAndLog();
    });
    dialog.querySelector('#tp-diag-warn-filter').addEventListener('change', (e) => {
      const state = getState();
      if (state.activeTab === 'session') {
        state.sessionWarnOnly = !!e.target.checked;
      }
      renderSnapshotAndLog();
    });
    dialog.querySelector('#tp-diag-debug-toggle').addEventListener('change', (e) => {
      const next = !!e.target.checked;
      updateConfig('DEBUG', next);
      showToast(next ? 'Debug-Konsole AN' : 'Debug-Konsole AUS');
      renderSnapshotAndLog();
    });
    dialog.querySelector('#tp-diag-copy-btn').addEventListener('click', async () => {
      const isPersistent = getState().activeTab === 'persistent';
      const header = isPersistent ? '[Langzeit]\n' : '';
      const txt = `${header}${dialog.querySelector('#tp-diag-snapshot')?.textContent || ''}\n\n${dialog.querySelector('#tp-diag-log-pre')?.textContent || ''}`;
      try {
        await navigator.clipboard?.writeText(txt);
        showToast(isPersistent ? 'Langzeit-Log kopiert' : 'Diagnose-Log kopiert');
      } catch {
        showToast('Kopieren fehlgeschlagen');
      }
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  renderSnapshotAndLog();
  dialog._tpUnsub?.();
  unsub = subscribeActivityLog(() => {
    if (dialog.open) renderSnapshotAndLog();
  });
  dialog._tpUnsub = () => {
    if (unsub) {
      unsub();
      unsub = null;
    }
  };
  dialog.addEventListener('close', () => {
    dialog._tpUnsub?.();
  }, { once: true });

  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
}

export function bindDiagTrigger(fabButton, shadow) {
  if (!fabButton || !shadow || fabButton.dataset?.tpDiagBound) return;
  if (fabButton.dataset) fabButton.dataset.tpDiagBound = '1';
  fabButton.title = 'Toppreise Suite Einstellungen öffnen (Gedrückt halten / Shift+Klick = Dev-Log)';

  let pressTimer = null;
  let startX = 0;
  let startY = 0;

  const clearPress = () => {
    if (pressTimer !== null) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  fabButton.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressNextFabClick = false;
    clearPress();
    startX = e.clientX;
    startY = e.clientY;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      suppressNextFabClick = true;
      setTimeout(() => { suppressNextFabClick = false; }, 400);
      openDiagModal(shadow);
    }, 600);
  });

  fabButton.addEventListener('pointermove', (e) => {
    if (pressTimer === null) return;
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) {
      clearPress();
    }
  });

  fabButton.addEventListener('pointerup', clearPress);
  fabButton.addEventListener('pointerleave', clearPress);
  fabButton.addEventListener('pointercancel', clearPress);

  fabButton.addEventListener('click', (e) => {
    if (suppressNextFabClick || e.shiftKey) {
      suppressNextFabClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.shiftKey) openDiagModal(shadow);
    }
  });
}
