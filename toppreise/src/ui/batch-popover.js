/**
 * Upward Batch Actions Popover (#tp-batch-popover)
 * Anchored to #tp-floating-check-cta.
 */

import { CONFIG, updateConfig, getDiscordChannels, effectiveAiProvider } from '../state/config.js';
import { priceToCents } from '../domain/price.js';
import { getSharedDeal } from '../scanner/cache.js';
import { isDiscordWebhookUrl } from '../features/share-discord.js';
import { triggerProcessListings } from '../page/adapter.js';
import { openSettingsAt } from './modal.js';
import { showToast } from './toast.js';
import {
  collectScopedCards,
  getBatchScopeCounts,
  formatBatchMarkdown,
  formatBatchTsv,
  formatBatchCsv,
  copyTextToClipboard,
  downloadCsvFile,
  isBatchConfirmRequired,
  isComparisonButtonActive
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
import { openAiLauncherPopover, AI_LAUNCHER_POPOVER_ID } from './ai-launcher-popover.js';

export const BATCH_POPOVER_ID = 'tp-batch-popover';

let isOpen = false;
let outsideListenersBound = false;

const AI_TARGET_LABELS = {
  google: 'Google',
  'google-ai': 'Google AI',
  openrouter: 'OpenRouter',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  claude: 'Claude'
};

function plural(n, sg, pl) {
  return `${n} ${n === 1 ? sg : pl}`;
}

function activeScope() {
  return CONFIG.BATCH_SCOPE_DEFAULT || 'non-dimmed';
}

function getScopedItems() {
  return collectScopedCards(activeScope());
}

function hasOpenBatchDialog() {
  if (typeof document === 'undefined') return false;
  return !!(
    document.getElementById('tp-batch-confirm-popout') ||
    document.getElementById('tp-batch-ai-popout') ||
    document.getElementById(AI_LAUNCHER_POPOVER_ID)
  );
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
  const qualifiedItems = opts.mode === 'discord'
    ? items.filter(it => it.isVerifiedDeal && it.pid && it.cardPrice > 0 && !getSharedDeal(it.pid, priceToCents(it.cardPrice)))
    : items;
  const qualifiedCount = qualifiedItems.length;
  openBatchConfirmDialog({
    title: opts.title,
    actionLabel: opts.actionLabel,
    count: items.length,
    isThresholdWarn: items.length >= (CONFIG.BATCH_CONFIRM_THRESHOLD ?? 10),
    mode: opts.mode || 'generic',
    items,
    qualifiedCount,
    onConfirm: (cfg) => {
      const base = opts.mode === 'discord' ? qualifiedItems : items;
      const sliced = cfg.limit && cfg.limit < base.length ? base.slice(0, cfg.limit) : base;
      runner(sliced, cfg);
    }
  });
}

function bindOutsideHandlers() {
  if (outsideListenersBound || typeof document === 'undefined') return;
  outsideListenersBound = true;
  document.addEventListener('click', (e) => {
    if (!isOpen || !e.isTrusted || hasOpenBatchDialog()) return;
    if (!e.target?.isConnected) return;
    const pop = document.getElementById(BATCH_POPOVER_ID);
    const btn = document.getElementById('tp-floating-batch-btn');
    if (pop?.contains(e.target) || btn?.contains(e.target)) return;
    closeBatchPopover();
  });
  document.addEventListener('keydown', (e) => {
    if (isOpen && e.key === 'Escape' && !hasOpenBatchDialog()) {
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
      <div class="tp-bp-title-row">
        <span class="tp-bp-title">⚡ Batch-Aktionen</span>
        <button type="button" id="tp-batch-close-btn" class="tp-bp-close" aria-label="Schliessen" title="Schliessen">✕</button>
      </div>
      <div class="tp-bp-scopes" role="tablist" aria-label="Ziel-Scope">
        <button type="button" class="tp-bp-scope" data-scope="non-dimmed">Ohne Gedimmte (<span id="tp-batch-scope-non-dimmed">0</span>)</button>
        <button type="button" class="tp-bp-scope" data-scope="visible">Alle (<span id="tp-batch-scope-visible">0</span>)</button>
        <button type="button" class="tp-bp-scope" data-scope="deals">Deals (<span id="tp-batch-scope-deals">0</span>)</button>
      </div>
    </div>

    <div class="tp-bp-group">
      <div class="tp-bp-group-label">Export</div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-copy-btn" class="tp-bp-item">
          <span class="tp-bp-item-main">📋 Liste kopieren</span>
        </button>
        <button type="button" id="tp-batch-copy-fmt-btn" class="tp-bp-mini-btn" title="Format umschalten (Markdown / TSV)">MD</button>
      </div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-csv-btn" class="tp-bp-item" title="Als CSV herunterladen">
          <span class="tp-bp-item-main">⬇️ Als CSV herunterladen</span>
          <span class="tp-bp-meta">Excel / Sheets</span>
        </button>
      </div>
    </div>

    <div class="tp-bp-group">
      <div class="tp-bp-group-label">KI-Analyse</div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-ai-compare-btn" class="tp-bp-item">
          <span class="tp-bp-item-main">🤖 KI-Vergleich</span>
          <span class="tp-bp-meta" id="tp-batch-ai-compare-meta">Google AI</span>
        </button>
      </div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-ai-single-btn" class="tp-bp-item">
          <span class="tp-bp-item-main">🔍 Einzeln KI-Suchen</span>
          <span class="tp-bp-meta" id="tp-batch-ai-single-meta">Google AI</span>
        </button>
      </div>
    </div>

    <div class="tp-bp-group">
      <div class="tp-bp-group-label">Aktionen</div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-alarms-btn" class="tp-bp-item">
          <span class="tp-bp-item-main">🔔 Preisalarme setzen…</span>
          <span class="tp-bp-meta" id="tp-batch-alarms-meta">60% · 2J ›</span>
        </button>
      </div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-dealers-btn" class="tp-bp-item">
          <span class="tp-bp-item-main">🏬 Händler laden</span>
        </button>
        <label class="tp-bp-auto-label" title="Günstigste Händler beim Tiefstpreis-Prüfen automatisch mitladen">
          <input type="checkbox" id="tp-batch-dealer-autofetch">
          <span>Auto</span>
        </label>
      </div>
      <div class="tp-bp-row">
        <button type="button" id="tp-batch-tabs-btn" class="tp-bp-item">
          <span class="tp-bp-item-main">↗ Produkt-Tabs öffnen</span>
          <span class="tp-bp-meta" id="tp-batch-tabs-meta">0 Tabs</span>
        </button>
      </div>
      <div class="tp-bp-row" id="tp-batch-discord-row">
        <button type="button" id="tp-batch-discord-btn" class="tp-bp-item">
          <span class="tp-bp-item-main">📤 In Discord teilen…</span>
          <span class="tp-bp-meta" id="tp-batch-discord-meta">0 neu ›</span>
        </button>
      </div>
      <div class="tp-bp-row" id="tp-batch-compare-row">
        <button type="button" id="tp-batch-compare-btn" class="tp-bp-item">
          <span class="tp-bp-item-main">⭐ Toppreise-Vergleich</span>
          <span class="tp-bp-meta" id="tp-batch-compare-meta">0/4</span>
        </button>
      </div>
    </div>

    <div id="tp-batch-footer-row" class="tp-bp-footer">
      <span id="tp-batch-footer-note">Bestätigung ab ≥10 Karten</span>
      <button type="button" id="tp-batch-settings-btn" class="tp-bp-settings-btn" title="Batch- & KI-Einstellungen öffnen" aria-label="Einstellungen öffnen">⚙️</button>
    </div>

    <div id="tp-batch-progress-row" class="tp-bp-progress" hidden>
      <div class="tp-bp-progress-head">
        <span id="tp-batch-progress-text">⏳ 0/0</span>
        <button type="button" id="tp-batch-cancel-btn" class="tp-bp-mini-btn">Abbrechen</button>
      </div>
      <div class="tp-bp-progress-track">
        <div id="tp-batch-progress-fill" class="tp-bp-progress-fill"></div>
      </div>
    </div>
  `;

  el.querySelector('#tp-batch-close-btn').addEventListener('click', () => closeBatchPopover());

  el.querySelectorAll('.tp-bp-scope').forEach(btn => {
    btn.addEventListener('click', () => {
      updateConfig('BATCH_SCOPE_DEFAULT', btn.dataset.scope);
      syncBatchPopover();
    });
  });

  el.querySelector('#tp-batch-settings-btn').addEventListener('click', () => {
    closeBatchPopover();
    openSettingsAt('tp-section-review');
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
    showToast(ok ? `✅ ${plural(items.length, 'Angebot', 'Angebote')} als ${isTsv ? 'TSV' : 'Markdown'} kopiert` : 'Kopieren fehlgeschlagen');
  });

  el.querySelector('#tp-batch-csv-btn').addEventListener('click', () => {
    const items = getScopedItems();
    if (!items.length) return showToast('Keine passenden Angebote im aktuellen Scope');
    const csv = formatBatchCsv(items);
    downloadCsvFile(`toppreise-batch-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    showToast(`✅ ${plural(items.length, 'Angebot', 'Angebote')} als CSV exportiert`);
  });

  const aiCompareBtn = el.querySelector('#tp-batch-ai-compare-btn');
  aiCompareBtn.addEventListener('click', () => {
    const allItems = getScopedItems();
    if (allItems.length === 0) {
      showToast('Keine passenden Angebote im aktuellen Scope');
      return;
    }
    openAiLauncherPopover({
      mode: 'batch-compare',
      anchorEl: aiCompareBtn,
      itemCount: allItems.length,
      onLaunch: async ({ engine, model, limit }) => {
        const items = limit && limit < allItems.length ? allItems.slice(0, limit) : allItems;
        const target = engine;
        const job = startBatchJob('KI-Vergleich', items.length);
        syncBatchPopover();
        try {
          const res = await runBatchComparisonAi(items, { target, model, signal: job.signal });
          if (res.mode === 'missing-key') {
            showToast('⚠️ OpenRouter API-Key fehlt — bitte in ⚙️ Einstellungen hinterlegen');
          } else if (res.mode === 'openrouter') {
            openBatchAiPopout({
              title: `🤖 KI-Vergleich (${plural(items.length, 'Angebot', 'Angebote')})`,
              mode: 'comparison',
              answer: res.answer,
              citations: res.citations
            });
          } else if (res.mode === 'external') {
            if (res.needsPaste) {
              const label = AI_TARGET_LABELS[res.target] || res.target;
              openBatchAiPopout({
                title: `🤖 KI-Vergleich (${plural(items.length, 'Angebot', 'Angebote')})`,
                mode: 'paste',
                answer: res.prompt,
                externalUrl: res.url,
                externalLabel: label,
                copied: res.copied
              });
            } else if (!res.opened) {
              openBatchAiPopout({
                title: '🤖 KI-Vergleich öffnen',
                mode: 'blocked',
                blockedItems: [{ title: `Vergleich (${res.target})`, url: res.url }]
              });
            } else {
              showToast(`🤖 KI-Vergleich geöffnet (${AI_TARGET_LABELS[res.target] || res.target})`);
            }
          }
        } catch (err) {
          if (!err?.cancelled) showToast(`⚠️ ${err?.message || 'KI-Vergleich fehlgeschlagen'}`);
        } finally {
          job.finish();
          syncBatchPopover();
        }
      }
    });
  });

  const aiSingleBtn = el.querySelector('#tp-batch-ai-single-btn');
  aiSingleBtn.addEventListener('click', () => {
    const allItems = getScopedItems();
    if (allItems.length === 0) {
      showToast('Keine passenden Angebote im aktuellen Scope');
      return;
    }
    openAiLauncherPopover({
      mode: 'batch-single',
      anchorEl: aiSingleBtn,
      itemCount: allItems.length,
      onLaunch: async ({ engine, model, googleAiMode, limit }) => {
        const items = limit && limit < allItems.length ? allItems.slice(0, limit) : allItems;
        const provider = engine === 'openrouter' ? 'openrouter' : 'google';
        const job = startBatchJob('Einzeln KI-Suchen', items.length);
        syncBatchPopover();
        try {
          const res = await runBatchAiIndividual(items, {
            provider,
            model,
            googleAiMode,
            signal: job.signal,
            onProgress: (done, total, failed) => {
              job.updateProgress(done, failed, total);
              syncBatchPopover();
            }
          });
          if (res.mode === 'google') {
            if (res.blockedItems.length > 0) {
              openBatchAiPopout({ title: '🔍 Blockierte Google Tabs', mode: 'blocked', blockedItems: res.blockedItems });
            } else {
              showToast(`🔍 ${plural(res.opened, 'Google Tab', 'Google Tabs')} geöffnet`);
            }
          } else if (!res.cancelled) {
            openBatchAiPopout({
              title: `🔍 OpenRouter Einzelsuche (${res.results.length})`,
              mode: 'individual',
              results: res.results
            });
          }
        } catch (err) {
          if (!err?.cancelled) showToast(`⚠️ ${err?.message || 'Einzelsuche fehlgeschlagen'}`);
        } finally {
          job.finish();
          syncBatchPopover();
        }
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
            job.updateProgress(done, failed, total);
            syncBatchPopover();
          }
        });
        if (res.abortedEarly) {
          showToast(`⚠️ Preisalarme nach 3 Fehlern gestoppt (${res.confirmed} gesetzt — eingeloggt?)`);
        } else if (res.cancelled) {
          showToast(`Preisalarme abgebrochen (${res.confirmed} gesetzt)`);
        } else {
          showToast(`🔔 ${plural(res.confirmed, 'Preisalarm', 'Preisalarme')} gesetzt${res.failed ? ` · ${res.failed} fehlgeschlagen` : ''}`);
        }
      } catch (err) {
        if (!err?.cancelled) showToast(`⚠️ ${err?.message || 'Preisalarme fehlgeschlagen'}`);
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
            job.updateProgress(done, failed, total);
            syncBatchPopover();
          }
        });
        triggerProcessListings();
        if (res.stoppedByCooldown) showToast(`⏳ Cooldown erreicht (${plural(res.loaded, 'Händler', 'Händler')} geladen)`);
        else if (res.total === 0) showToast('🏬 Alle Händler bereits geladen');
        else showToast(`🏬 ${plural(res.loaded, 'Händler', 'Händler')} geladen`);
      } catch (err) {
        if (!err?.cancelled) showToast(`⚠️ ${err?.message || 'Händler-Abruf fehlgeschlagen'}`);
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
        showToast(`↗ ${plural(res.opened, 'Tab', 'Tabs')} geöffnet`);
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
            job.updateProgress(done, failed, total);
            syncBatchPopover();
          }
        });
        triggerProcessListings();
        showToast(`📤 ${res.shared} geteilt${res.skippedDuplicates ? ` · ${res.skippedDuplicates} übersprungen` : ''}${res.failed ? ` · ${res.failed} Fehler` : ''}`);
      } catch (err) {
        if (!err?.cancelled) showToast(`⚠️ ${err?.message || 'Discord-Share fehlgeschlagen'}`);
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
      syncBatchPopover();
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

export function syncBatchPopover(precomputedCounts = null) {
  if (typeof document === 'undefined') return;
  const pop = document.getElementById(BATCH_POPOVER_ID);
  const btn = document.getElementById('tp-floating-batch-btn');
  const job = getActiveBatchJob();
  const scope = activeScope();
  const wasRunning = !!btn?.classList.contains('tp-batch-running');
  if (btn) {
    btn.setAttribute('aria-expanded', String(isOpen));
    btn.classList.toggle('tp-batch-running', !!job);
  }
  const counts = precomputedCounts || ((isOpen || job || wasRunning) ? getBatchScopeCounts() : null);
  const scopeCount = counts ? (counts[scope] ?? 0) : 0;
  const pillCountEl = document.getElementById('tp-floating-batch-count');
  if (pillCountEl && (job || wasRunning || counts)) {
    pillCountEl.textContent = job ? `⏳ ${job.done}/${job.total}` : String(scopeCount);
  }
  if (!pop) return;

  pop.classList.toggle('tp-open', isOpen);
  if (!isOpen && !job) return;

  pop.querySelectorAll('.tp-bp-scope').forEach(b => b.classList.toggle('tp-active', b.dataset.scope === scope));

  const cNonDim = pop.querySelector('#tp-batch-scope-non-dimmed');
  const cVis = pop.querySelector('#tp-batch-scope-visible');
  const cDeals = pop.querySelector('#tp-batch-scope-deals');
  if (cNonDim) cNonDim.textContent = String(counts['non-dimmed']);
  if (cVis) cVis.textContent = String(counts.visible);
  if (cDeals) cDeals.textContent = String(counts.deals);

  const disableActions = scopeCount === 0 || !!job;
  pop.querySelectorAll('.tp-bp-item, #tp-batch-copy-fmt-btn').forEach(b => { b.disabled = disableActions; });

  const fmtBtn = pop.querySelector('#tp-batch-copy-fmt-btn');
  if (fmtBtn) fmtBtn.textContent = CONFIG.BATCH_COPY_FORMAT === 'tsv' ? 'TSV' : 'MD';

  const autoToggle = pop.querySelector('#tp-batch-dealer-autofetch');
  if (autoToggle && document.activeElement !== autoToggle) {
    autoToggle.checked = CONFIG.DEALER_AUTOFETCH === true;
  }

  const aiCmpMeta = pop.querySelector('#tp-batch-ai-compare-meta');
  if (aiCmpMeta) aiCmpMeta.textContent = 'Wählen ›';

  const aiSglMeta = pop.querySelector('#tp-batch-ai-single-meta');
  if (aiSglMeta) aiSglMeta.textContent = 'Wählen ›';

  const alarmsMeta = pop.querySelector('#tp-batch-alarms-meta');
  if (alarmsMeta) {
    const pct = Math.round((Number.isFinite(CONFIG.ALARM_TARGET_PERCENT) ? CONFIG.ALARM_TARGET_PERCENT : 0.6) * 100);
    const durMap = { 90: '3M', 180: '6M', 365: '1J', 730: '2J' };
    const dur = durMap[Number(CONFIG.ALARM_DURATION_DAYS) || 730] || '2J';
    alarmsMeta.textContent = `${pct}% · ${dur} ›`;
  }

  const tabsMeta = pop.querySelector('#tp-batch-tabs-meta');
  if (tabsMeta) tabsMeta.textContent = plural(scopeCount, 'Tab', 'Tabs');

  const hasValidWebhook = getDiscordChannels(CONFIG).some(c => isDiscordWebhookUrl(c.url));
  const discordRow = pop.querySelector('#tp-batch-discord-row');
  const discordBtn = pop.querySelector('#tp-batch-discord-btn');
  if (discordRow) discordRow.hidden = !hasValidWebhook;
  if (discordBtn) discordBtn.hidden = !hasValidWebhook;
  if (isOpen && hasValidWebhook) {
    const discordMeta = pop.querySelector('#tp-batch-discord-meta');
    if (discordMeta) {
      const unsharedCount = collectScopedCards(scope).filter(
        it => it.isVerifiedDeal && it.pid && it.cardPrice > 0 && !getSharedDeal(it.pid, priceToCents(it.cardPrice))
      ).length;
      discordMeta.textContent = `${unsharedCount} neu ›`;
    }
  }

  const compBtns = Array.from(document.querySelectorAll('.Plugin_AddToProductComparisonButton'));
  const hasCompare = compBtns.length > 0;
  const compareRow = pop.querySelector('#tp-batch-compare-row');
  const compareBtn = pop.querySelector('#tp-batch-compare-btn');
  if (compareRow) compareRow.hidden = !hasCompare;
  if (compareBtn) compareBtn.hidden = !hasCompare;
  if (hasCompare) {
    const compareMeta = pop.querySelector('#tp-batch-compare-meta');
    if (compareMeta) compareMeta.textContent = `${compBtns.filter(isComparisonButtonActive).length}/4`;
  }

  const footerRow = pop.querySelector('#tp-batch-footer-row');
  const footerNote = pop.querySelector('#tp-batch-footer-note');
  if (footerRow) footerRow.hidden = !!job;
  if (footerNote) footerNote.textContent = `Bestätigung ab ≥${CONFIG.BATCH_CONFIRM_THRESHOLD ?? 10} Karten`;

  const progRow = pop.querySelector('#tp-batch-progress-row');
  const progTxt = pop.querySelector('#tp-batch-progress-text');
  const progFill = pop.querySelector('#tp-batch-progress-fill');
  if (progRow && progTxt) {
    progRow.hidden = !job;
    if (job) {
      progTxt.textContent = `⏳ ${job.label}: ${job.done}/${job.total}`;
      if (progFill) {
        const pct = job.total > 0 ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0;
        progFill.style.width = `${pct}%`;
      }
    }
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
