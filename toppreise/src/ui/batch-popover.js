/**
 * Upward Batch Actions Popover (#tp-batch-popover)
 * Anchored to #tp-floating-check-cta.
 */

import { CONFIG, updateConfig, getDiscordChannels } from '../state/config.js';
import { priceToCents } from '../domain/price.js';
import { getSharedDeal } from '../scanner/cache.js';
import { triggerProcessListings } from '../page/adapter.js';
import { showToast } from './toast.js';
import {
  collectScopedCards,
  getBatchScopeCounts,
  formatBatchMarkdown,
  formatBatchTsv,
  formatBatchCsv,
  copyTextToClipboard,
  downloadCsvFile,
  isBatchConfirmRequired
} from '../features/batch-actions.js';
import {
  getActiveBatchJob,
  startBatchJob,
  cancelActiveBatchJob,
  runBatchDealerFetch,
  runBatchPriceAlarms,
  runBatchAiIndividual,
  runBatchComparisonAi,
  runBatchOpenTabs,
  runBatchDiscordShare,
  runBatchNativeCompare
} from '../features/batch-runners.js';
import { openBatchConfirmDialog, openBatchAiPopout } from './batch-dialogs.js';

export const BATCH_POPOVER_ID = 'tp-batch-popover';

let isOpen = false;
let currentScope = null;
let outsideListenersBound = false;

function activeScope() {
  return currentScope || CONFIG.BATCH_SCOPE_DEFAULT || 'non-dimmed';
}

function getScopedItems() {
  return collectScopedCards(activeScope());
}

function withConfirmGate(opts, runner) {
  const items = getScopedItems();
  if (items.length === 0) {
    showToast('Keine passenden Angebote im aktuellen Scope');
    return;
  }
  const always = !!opts.alwaysConfirm;
  const needConfirm = isBatchConfirmRequired(items.length, always);
  if (!needConfirm) {
    runner(items, {});
    return;
  }
  const qualifiedCount = opts.mode === 'discord'
    ? items.filter(it => it.isVerifiedDeal && it.pid && it.cardPrice > 0 && !getSharedDeal(it.pid, priceToCents(it.cardPrice))).length
    : items.length;
  openBatchConfirmDialog({
    title: opts.title,
    actionLabel: opts.actionLabel,
    count: items.length,
    isThresholdWarn: items.length >= (CONFIG.BATCH_CONFIRM_THRESHOLD ?? 10),
    mode: opts.mode || 'generic',
    items,
    qualifiedCount,
    onConfirm: (cfg) => {
      const sliced = cfg.limit && cfg.limit < items.length ? items.slice(0, cfg.limit) : items;
      runner(sliced, cfg);
    }
  });
}

function bindOutsideHandlers() {
  if (outsideListenersBound || typeof document === 'undefined') return;
  outsideListenersBound = true;
  document.addEventListener('click', (e) => {
    if (!isOpen || !e.isTrusted) return;
    const pop = document.getElementById(BATCH_POPOVER_ID);
    const btn = document.getElementById('tp-floating-batch-btn');
    if (pop?.contains(e.target) || btn?.contains(e.target)) return;
    closeBatchPopover();
  });
  document.addEventListener('keydown', (e) => {
    if (isOpen && e.key === 'Escape') {
      closeBatchPopover();
    }
  });
}

export function ensureBatchPopover() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(BATCH_POPOVER_ID);
  if (el) return el;

  el = document.createElement('div');
  el.id = BATCH_POPOVER_ID;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Batch-Aktionen');
  el.innerHTML = `
    <div class="tp-bp-header">
      <span class="tp-bp-title">⚡ Batch-Aktionen</span>
      <div class="tp-bp-scopes" role="tablist" aria-label="Ziel-Scope">
        <button type="button" class="tp-bp-scope" data-scope="non-dimmed">Ohne Gedimmte (<span id="tp-batch-scope-non-dimmed">0</span>)</button>
        <button type="button" class="tp-bp-scope" data-scope="visible">Alle (<span id="tp-batch-scope-visible">0</span>)</button>
        <button type="button" class="tp-bp-scope" data-scope="deals">Deals (<span id="tp-batch-scope-deals">0</span>)</button>
      </div>
    </div>

    <div class="tp-bp-group">
      <div class="tp-bp-group-label">Export & KI</div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-copy-btn" class="tp-bp-btn">📋 Kopieren</button>
        <button type="button" id="tp-batch-copy-fmt-btn" class="tp-bp-mini-btn" title="Format umschalten (Markdown / TSV)">MD</button>
        <button type="button" id="tp-batch-csv-btn" class="tp-bp-mini-btn" title="Als CSV herunterladen">⬇️ CSV</button>
      </div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-ai-compare-btn" class="tp-bp-btn">🤖 KI-Vergleich</button>
        <button type="button" id="tp-batch-ai-single-btn" class="tp-bp-btn">🔍 Einzeln KI-Suchen</button>
      </div>
    </div>

    <div class="tp-bp-group">
      <div class="tp-bp-group-label">Aktionen</div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-alarms-btn" class="tp-bp-btn">🔔 Preisalarme…</button>
        <button type="button" id="tp-batch-tabs-btn" class="tp-bp-btn">↗ Tabs öffnen</button>
      </div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-dealers-btn" class="tp-bp-btn">🏬 Händler laden</button>
        <label class="tp-bp-auto-label" title="Günstigste Händler beim Tiefstpreis-Prüfen automatisch mitladen">
          <input type="checkbox" id="tp-batch-dealer-autofetch">
          <span>Auto</span>
        </label>
      </div>
      <div class="tp-bp-row" id="tp-batch-extra-row">
        <button type="button" id="tp-batch-discord-btn" class="tp-bp-btn">📤 Discord-Share…</button>
        <button type="button" id="tp-batch-compare-btn" class="tp-bp-btn">⭐ Vergleich (max. 4)</button>
      </div>
    </div>

    <div id="tp-batch-progress-row" class="tp-bp-progress" hidden>
      <span id="tp-batch-progress-text">⏳ 0/0</span>
      <button type="button" id="tp-batch-cancel-btn" class="tp-bp-mini-btn">Abbrechen</button>
    </div>
  `;

  el.querySelectorAll('.tp-bp-scope').forEach(btn => {
    btn.addEventListener('click', () => {
      currentScope = btn.dataset.scope;
      updateConfig('BATCH_SCOPE_DEFAULT', currentScope);
      syncBatchPopover();
    });
  });

  el.querySelector('#tp-batch-copy-fmt-btn').addEventListener('click', () => {
    const next = CONFIG.BATCH_COPY_FORMAT === 'tsv' ? 'markdown' : 'tsv';
    updateConfig('BATCH_COPY_FORMAT', next);
    syncBatchPopover();
  });

  el.querySelector('#tp-batch-copy-btn').addEventListener('click', async () => {
    const items = getScopedItems();
    if (!items.length) return showToast('Keine passenden Angebote im aktuellen Scope');
    const isTsv = CONFIG.BATCH_COPY_FORMAT === 'tsv';
    const txt = isTsv ? formatBatchTsv(items) : formatBatchMarkdown(items);
    const ok = await copyTextToClipboard(txt);
    showToast(ok ? `✅ ${items.length} Angebote als ${isTsv ? 'TSV' : 'Markdown'} kopiert` : 'Kopieren fehlgeschlagen');
  });

  el.querySelector('#tp-batch-csv-btn').addEventListener('click', () => {
    const items = getScopedItems();
    if (!items.length) return showToast('Keine passenden Angebote im aktuellen Scope');
    const csv = formatBatchCsv(items);
    downloadCsvFile(`toppreise-batch-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    showToast(`✅ ${items.length} Angebote als CSV exportiert`);
  });

  el.querySelector('#tp-batch-ai-compare-btn').addEventListener('click', () => {
    const target = CONFIG.BATCH_AI_TARGET || 'google-ai';
    const isOr = target === 'openrouter';
    withConfirmGate({
      title: '🤖 KI-Vergleich starten',
      actionLabel: 'Vergleich starten'
    }, async (items) => {
      const job = startBatchJob('KI-Vergleich', items.length);
      syncBatchPopover();
      try {
        const res = await runBatchComparisonAi(items, { target, signal: job.signal });
        if (res.mode === 'openrouter') {
          openBatchAiPopout({
            title: `🤖 KI-Vergleich (${items.length} Angebote)`,
            mode: 'comparison',
            answer: res.answer,
            citations: res.citations
          });
        } else if (res.mode === 'external') {
          if (!res.opened) {
            openBatchAiPopout({
              title: '🤖 KI-Vergleich öffnen',
              mode: 'blocked',
              blockedItems: [{ title: `Vergleich (${res.target})`, url: res.url }]
            });
          } else if (res.needsPaste) {
            showToast('📋 Prompt kopiert (zu lang für URL) — im Tab einfügen (Strg+V)');
          } else {
            showToast(`🤖 KI-Vergleich geöffnet (${res.target})`);
          }
        }
      } catch (err) {
        if (!err?.cancelled) showToast(`⚠️ ${err?.message || 'KI-Vergleich fehlgeschlagen'}`);
      } finally {
        job.finish();
        syncBatchPopover();
      }
    });
  });

  el.querySelector('#tp-batch-ai-single-btn').addEventListener('click', () => {
    const provider = CONFIG.AI_SEARCH_PROVIDER === 'openrouter' ? 'openrouter' : 'google';
    withConfirmGate({
      title: provider === 'openrouter' ? '🔍 OpenRouter Einzelsuche' : '🔍 Google AI Einzelsuche',
      actionLabel: `${provider === 'openrouter' ? 'Abfragen' : 'Tabs öffnen'}`
    }, async (items) => {
      const job = startBatchJob('Einzeln KI-Suchen', items.length);
      syncBatchPopover();
      try {
        const res = await runBatchAiIndividual(items, {
          provider,
          signal: job.signal,
          onProgress: (done, total, failed) => {
            job.updateProgress(done, failed);
            syncBatchPopover();
          }
        });
        if (res.mode === 'google') {
          if (res.blockedItems.length > 0) {
            openBatchAiPopout({ title: '🔍 Blockierte Google AI Tabs', mode: 'blocked', blockedItems: res.blockedItems });
          } else {
            showToast(`🔍 ${res.opened} Google AI Tabs geöffnet`);
          }
        } else if (!res.cancelled) {
          openBatchAiPopout({
            title: `🔍 OpenRouter Einzelsuche (${res.results.length})`,
            mode: 'individual',
            results: res.results
          });
        }
      } finally {
        job.finish();
        syncBatchPopover();
      }
    });
  });

  el.querySelector('#tp-batch-alarms-btn').addEventListener('click', () => {
    withConfirmGate({
      title: '🔔 Batch-Preisalarme setzen',
      actionLabel: 'Alarme setzen',
      mode: 'alarms',
      alwaysConfirm: true
    }, async (items, cfg) => {
      const job = startBatchJob('Preisalarme', items.length);
      syncBatchPopover();
      try {
        const res = await runBatchPriceAlarms(items, {
          targetPct: cfg.targetPct,
          durationDays: cfg.durationDays,
          signal: job.signal,
          onProgress: (done, total, failed) => {
            job.updateProgress(done, failed);
            syncBatchPopover();
          }
        });
        if (res.abortedEarly) {
          showToast(`⚠️ Preisalarme nach 3 Fehlern gestoppt (${res.confirmed} gesetzt — eingeloggt?)`);
        } else if (res.cancelled) {
          showToast(`Preisalarme abgebrochen (${res.confirmed} gesetzt)`);
        } else {
          showToast(`🔔 ${res.confirmed} Preisalarme gesetzt${res.failed ? ` · ${res.failed} fehlgeschlagen` : ''}`);
        }
      } finally {
        job.finish();
        syncBatchPopover();
      }
    });
  });

  el.querySelector('#tp-batch-dealers-btn').addEventListener('click', () => {
    withConfirmGate({
      title: '🏬 Händler für Scope laden',
      actionLabel: 'Händler laden'
    }, async (items) => {
      const job = startBatchJob('Händler laden', items.length);
      syncBatchPopover();
      try {
        const res = await runBatchDealerFetch(items, {
          signal: job.signal,
          onProgress: (done, total, failed) => {
            job.updateProgress(done, failed);
            syncBatchPopover();
          }
        });
        triggerProcessListings();
        if (res.stoppedByCooldown) showToast(`⏳ Cooldown erreicht (${res.loaded} Händler geladen)`);
        else if (res.total === 0) showToast('🏬 Alle Händler bereits geladen');
        else showToast(`🏬 ${res.loaded} Händler geladen`);
      } finally {
        job.finish();
        syncBatchPopover();
      }
    });
  });

  el.querySelector('#tp-batch-dealer-autofetch').addEventListener('change', (e) => {
    const next = e.target.checked;
    updateConfig('DEALER_AUTOFETCH', next);
    showToast(next ? '🏬 Händler werden beim Prüfen automatisch geladen' : '🏬 Händler nur noch per Klick laden');
  });

  el.querySelector('#tp-batch-tabs-btn').addEventListener('click', () => {
    withConfirmGate({
      title: '↗ Tabs öffnen',
      actionLabel: 'Tabs öffnen'
    }, (items) => {
      const res = runBatchOpenTabs(items);
      if (res.blockedItems.length > 0) {
        openBatchAiPopout({ title: '↗ Blockierte Produkt-Tabs', mode: 'blocked', blockedItems: res.blockedItems });
      } else {
        showToast(`↗ ${res.opened} Tabs geöffnet`);
      }
    });
  });

  el.querySelector('#tp-batch-discord-btn').addEventListener('click', () => {
    withConfirmGate({
      title: '📤 Discord Batch-Share',
      actionLabel: 'Deals teilen',
      mode: 'discord',
      alwaysConfirm: true
    }, async (items, cfg) => {
      const job = startBatchJob('Discord-Share', items.length);
      syncBatchPopover();
      try {
        const res = await runBatchDiscordShare(items, cfg.channel, {
          signal: job.signal,
          onProgress: (done, total, failed) => {
            job.updateProgress(done, failed);
            syncBatchPopover();
          }
        });
        triggerProcessListings();
        showToast(`📤 ${res.shared} geteilt${res.skippedDuplicates ? ` · ${res.skippedDuplicates} übersprungen` : ''}${res.failed ? ` · ${res.failed} Fehler` : ''}`);
      } finally {
        job.finish();
        syncBatchPopover();
      }
    });
  });

  el.querySelector('#tp-batch-compare-btn').addEventListener('click', () => {
    const items = getScopedItems();
    if (!items.length) return showToast('Keine passenden Angebote im aktuellen Scope');
    const res = runBatchNativeCompare(items);
    if (res.clicked > 0) {
      showToast(`⭐ ${res.clicked} zum Toppreise-Vergleich hinzugefügt (${res.activeCount}/4)`);
    } else if (res.alreadyActive >= 4) {
      showToast('⭐ Toppreise-Vergleich bereits voll (4/4)');
    } else {
      showToast('⭐ Keine weiteren Vergleichs-Buttons im Scope');
    }
  });

  el.querySelector('#tp-batch-cancel-btn').addEventListener('click', () => {
    if (cancelActiveBatchJob()) {
      showToast('Batch-Aktion abgebrochen');
      syncBatchPopover();
    }
  });

  document.body.appendChild(el);
  bindOutsideHandlers();
  return el;
}

export function syncBatchPopover() {
  if (typeof document === 'undefined') return;
  const pop = document.getElementById(BATCH_POPOVER_ID);
  const btn = document.getElementById('tp-floating-batch-btn');
  if (btn) btn.setAttribute('aria-expanded', String(isOpen));
  if (!pop) return;

  pop.classList.toggle('tp-open', isOpen);
  const scope = activeScope();
  pop.querySelectorAll('.tp-bp-scope').forEach(b => b.classList.toggle('tp-active', b.dataset.scope === scope));

  const counts = getBatchScopeCounts();
  const cNonDim = pop.querySelector('#tp-batch-scope-non-dimmed');
  const cVis = pop.querySelector('#tp-batch-scope-visible');
  const cDeals = pop.querySelector('#tp-batch-scope-deals');
  if (cNonDim) cNonDim.textContent = String(counts['non-dimmed']);
  if (cVis) cVis.textContent = String(counts.visible);
  if (cDeals) cDeals.textContent = String(counts.deals);

  const fmtBtn = pop.querySelector('#tp-batch-copy-fmt-btn');
  if (fmtBtn) fmtBtn.textContent = CONFIG.BATCH_COPY_FORMAT === 'tsv' ? 'TSV' : 'MD';

  const autoToggle = pop.querySelector('#tp-batch-dealer-autofetch');
  if (autoToggle && document.activeElement !== autoToggle) {
    autoToggle.checked = CONFIG.DEALER_AUTOFETCH === true;
  }

  const discordBtn = pop.querySelector('#tp-batch-discord-btn');
  if (discordBtn) discordBtn.hidden = getDiscordChannels(CONFIG).length === 0;

  const compareBtn = pop.querySelector('#tp-batch-compare-btn');
  if (compareBtn) compareBtn.hidden = !document.querySelector('.Plugin_AddToProductComparisonButton');

  const job = getActiveBatchJob();
  const progRow = pop.querySelector('#tp-batch-progress-row');
  const progTxt = pop.querySelector('#tp-batch-progress-text');
  if (progRow && progTxt) {
    progRow.hidden = !job;
    if (job) progTxt.textContent = `⏳ ${job.label}: ${job.done}/${job.total}`;
  }
}

export function toggleBatchPopover() {
  ensureBatchPopover();
  isOpen = !isOpen;
  syncBatchPopover();
}

export function closeBatchPopover() {
  if (!isOpen) return;
  isOpen = false;
  syncBatchPopover();
}
