/**
 * Batch Action Confirmation & AI Result Dialogs
 * Built on createPopoutDialog (#tp-batch-confirm-popout, #tp-batch-ai-popout).
 */

import { CONFIG, getDiscordChannels } from '../state/config.js';
import { createPopoutDialog } from './popout-dialog.js';
import { formatVerdictHtml } from './badges/card-ai-popover.js';
import { copyTextToClipboard } from '../features/batch-actions.js';
import { showToast } from './toast.js';

let activeConfirmCleanup = null;
let activeAiPopoutCleanup = null;

export function closeBatchDialogs() {
  if (typeof activeConfirmCleanup === 'function') {
    const fn = activeConfirmCleanup;
    activeConfirmCleanup = null;
    fn();
  } else if (typeof document !== 'undefined') {
    document.getElementById('tp-batch-confirm-popout')?.remove();
  }
  if (typeof activeAiPopoutCleanup === 'function') {
    const fn = activeAiPopoutCleanup;
    activeAiPopoutCleanup = null;
    fn();
  } else if (typeof document !== 'undefined') {
    document.getElementById('tp-batch-ai-popout')?.remove();
  }
}

export function openBatchConfirmDialog(opts = {}) {
  if (typeof document === 'undefined') return null;
  if (typeof activeConfirmCleanup === 'function') activeConfirmCleanup();

  const {
    title = 'Batch-Aktion bestätigen',
    actionLabel = 'Ausführen',
    count = 0,
    isThresholdWarn = false,
    mode = 'generic',
    items = [],
    qualifiedCount = count,
    onConfirm = null
  } = opts;

  const { backdrop, panel, mount, close } = createPopoutDialog({
    id: 'tp-batch-confirm-popout',
    label: title,
    title,
    panelClass: 'tp-batch-dialog-panel',
    onClose: () => { activeConfirmCleanup = null; }
  });
  activeConfirmCleanup = close;

  const body = document.createElement('div');
  body.className = 'tp-batch-dialog-body';

  const summary = document.createElement('p');
  summary.className = 'tp-batch-dialog-summary';
  summary.textContent = `${count} ${count === 1 ? 'Angebot' : 'Angebote'} im aktuellen Scope ausgewählt.`;
  body.appendChild(summary);

  if (isThresholdWarn) {
    const warn = document.createElement('div');
    warn.className = 'tp-batch-dialog-warn';
    warn.textContent = `⚠️ Hinweis: Ab ${CONFIG.BATCH_CONFIRM_THRESHOLD ?? 10} Karten fragt Batch vor mehreren Tabs oder API-Aufrufen nach.`;
    body.appendChild(warn);
  }

  let limitInput = null;
  if (count > 1) {
    const limitRow = document.createElement('div');
    limitRow.className = 'tp-batch-dialog-row';
    const lbl = document.createElement('label');
    lbl.htmlFor = 'tp-batch-limit-input';
    lbl.textContent = 'Nur erste N verarbeiten:';
    limitInput = document.createElement('input');
    limitInput.type = 'number';
    limitInput.id = 'tp-batch-limit-input';
    limitInput.min = '1';
    limitInput.max = String(count);
    limitInput.value = String(count);
    limitRow.append(lbl, limitInput);
    body.appendChild(limitRow);
  }

  let pctInput = null;
  let selectedDuration = String(CONFIG.ALARM_DURATION_DAYS || '730');
  if (mode === 'alarms') {
    const pctRow = document.createElement('div');
    pctRow.className = 'tp-batch-dialog-row';
    const pctLbl = document.createElement('label');
    pctLbl.htmlFor = 'tp-batch-alarm-pct';
    pctLbl.textContent = 'Zielpreis (% vom aktuellen Preis):';
    pctInput = document.createElement('input');
    pctInput.type = 'number';
    pctInput.id = 'tp-batch-alarm-pct';
    pctInput.min = '5';
    pctInput.max = '99';
    pctInput.value = String(Math.round((Number.isFinite(CONFIG.ALARM_TARGET_PERCENT) ? CONFIG.ALARM_TARGET_PERCENT : 0.6) * 100));
    pctRow.append(pctLbl, pctInput);
    body.appendChild(pctRow);

    const durRow = document.createElement('div');
    durRow.className = 'tp-batch-dialog-row';
    const durLbl = document.createElement('span');
    durLbl.textContent = 'Laufzeit:';
    const pills = document.createElement('div');
    pills.className = 'tp-batch-dur-pills';
    const durations = [
      ['90', '3M'],
      ['180', '6M'],
      ['365', '1J'],
      ['730', '2J']
    ];
    for (const [val, label] of durations) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tp-batch-pill' + (val === selectedDuration ? ' tp-active' : '');
      btn.textContent = label;
      btn.dataset.dur = val;
      btn.addEventListener('click', () => {
        selectedDuration = val;
        pills.querySelectorAll('.tp-batch-pill').forEach(b => b.classList.toggle('tp-active', b.dataset.dur === val));
      });
      pills.appendChild(btn);
    }
    durRow.append(durLbl, pills);
    body.appendChild(durRow);

    const samplePrice = items.find(it => it.cardPrice > 0)?.cardPrice || 0;
    if (samplePrice > 0) {
      const sampleEl = document.createElement('div');
      sampleEl.className = 'tp-batch-dialog-hint';
      const updateSample = () => {
        const p = Math.max(5, Math.min(99, parseInt(pctInput.value, 10) || 60));
        sampleEl.textContent = `Beispiel (1. Produkt): CHF ${samplePrice.toFixed(2)} → Ziel CHF ${(samplePrice * (p / 100)).toFixed(2)}`;
      };
      updateSample();
      pctInput.addEventListener('input', updateSample);
      body.appendChild(sampleEl);
    }
  }

  let channelSelect = null;
  if (mode === 'discord') {
    const channels = getDiscordChannels(CONFIG);
    const chRow = document.createElement('div');
    chRow.className = 'tp-batch-dialog-row';
    const chLbl = document.createElement('label');
    chLbl.htmlFor = 'tp-batch-discord-channel';
    chLbl.textContent = 'Discord-Kanal:';
    channelSelect = document.createElement('select');
    channelSelect.id = 'tp-batch-discord-channel';
    for (const ch of channels) {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = ch.name || ch.id;
      channelSelect.appendChild(opt);
    }
    chRow.append(chLbl, channelSelect);
    body.appendChild(chRow);

    const note = document.createElement('div');
    note.className = 'tp-batch-dialog-hint';
    note.textContent = `${qualifiedCount} verifizierte, noch nicht geteilte Deals qualifizieren sich für Discord.`;
    body.appendChild(note);
  }

  panel.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'tp-popout-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'tp-popout-btn';
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.addEventListener('click', close);

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.id = 'tp-batch-confirm-go';
  confirmBtn.className = 'tp-popout-btn tp-batch-btn-primary';
  confirmBtn.textContent = actionLabel;
  confirmBtn.addEventListener('click', () => {
    const limit = limitInput
      ? Math.max(1, Math.min(count, parseInt(limitInput.value, 10) || count))
      : count;
    const targetPct = pctInput
      ? Math.max(5, Math.min(99, parseInt(pctInput.value, 10) || 60)) / 100
      : undefined;
    const channels = getDiscordChannels(CONFIG);
    const channel = channelSelect
      ? (channels.find(c => c.id === channelSelect.value) || channels[0] || null)
      : undefined;
    close();
    onConfirm?.({ limit, targetPct, durationDays: selectedDuration, channel });
  });

  footer.append(cancelBtn, confirmBtn);
  panel.appendChild(footer);
  mount();
  return backdrop;
}

function appendCitations(container, citations) {
  if (!Array.isArray(citations) || citations.length === 0) return;
  const wrap = document.createElement('div');
  wrap.className = 'tp-batch-citations';
  const lbl = document.createElement('span');
  lbl.textContent = 'Quellen: ';
  wrap.appendChild(lbl);
  for (const c of citations) {
    if (!c?.url || !/^https?:\/\//i.test(c.url)) continue;
    const a = document.createElement('a');
    a.href = c.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = c.title || c.url;
    wrap.appendChild(a);
  }
  container.appendChild(wrap);
}

export function openBatchAiPopout(opts = {}) {
  if (typeof document === 'undefined') return null;
  if (typeof activeAiPopoutCleanup === 'function') activeAiPopoutCleanup();

  const {
    title = '🤖 KI-Ergebnis',
    mode = 'comparison',
    answer = '',
    citations = [],
    results = [],
    blockedItems = []
  } = opts;

  const { backdrop, panel, mount, close } = createPopoutDialog({
    id: 'tp-batch-ai-popout',
    label: title,
    title,
    panelClass: 'tp-ai-panel tp-batch-ai-panel',
    onClose: () => { activeAiPopoutCleanup = null; }
  });
  activeAiPopoutCleanup = close;

  const body = document.createElement('div');
  body.className = 'tp-ai-body tp-batch-ai-body';

  let copyText = answer || '';

  if (mode === 'blocked') {
    const warn = document.createElement('p');
    warn.className = 'tp-batch-dialog-warn';
    warn.textContent = `⚠️ ${blockedItems.length} Tabs wurden vom Popup-Blocker blockiert. Hier einzeln öffnen:`;
    body.appendChild(warn);
    const list = document.createElement('ul');
    list.className = 'tp-batch-blocked-list';
    for (const it of blockedItems) {
      if (!it?.url || !/^https?:\/\//i.test(it.url)) continue;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = it.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = it.title || it.url;
      li.appendChild(a);
      list.appendChild(li);
    }
    body.appendChild(list);
  } else if (mode === 'individual') {
    const parts = [];
    for (const r of results) {
      const card = document.createElement('div');
      card.className = 'tp-batch-ai-item';
      const h = document.createElement('div');
      h.className = 'tp-batch-ai-item-title';
      h.textContent = `${r.item?.title || 'Produkt'}${r.item?.priceText ? ` (${r.item.priceText})` : ''}`;
      card.appendChild(h);

      const txt = document.createElement('div');
      if (r.error) {
        txt.className = 'tp-ai-error-msg';
        txt.textContent = `⚠️ ${r.error}`;
      } else {
        txt.innerHTML = formatVerdictHtml(r.answer || '');
        parts.push(`### ${r.item?.title || ''}\n${r.answer || ''}`);
      }
      card.appendChild(txt);
      appendCitations(card, r.citations);
      body.appendChild(card);
    }
    copyText = parts.join('\n\n');
  } else {
    body.innerHTML = formatVerdictHtml(answer);
    appendCitations(body, citations);
  }

  panel.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'tp-popout-footer';
  if (copyText) {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'tp-popout-btn';
    copyBtn.textContent = '📋 Alle kopieren';
    copyBtn.addEventListener('click', async () => {
      const ok = await copyTextToClipboard(copyText);
      showToast(ok ? '✅ KI-Antwort kopiert' : 'Kopieren fehlgeschlagen');
    });
    footer.appendChild(copyBtn);
  }
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'tp-popout-btn';
  closeBtn.textContent = 'Schliessen';
  closeBtn.addEventListener('click', close);
  footer.appendChild(closeBtn);
  panel.appendChild(footer);

  mount();
  return backdrop;
}
