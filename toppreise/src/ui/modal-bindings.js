/**
 * Modal bindings (split from ui/modal.js): element table, layout preview,
 * field sync, dual control pairs. The els record replaces closure locals.
 */

import { CONFIG, syncUiControl, weightText, horizonText, clampMinPoints, minPointsToIndex, minPointsFromIndex, MIN_POINTS_STEPS } from '../state/config.js';
import { renderLayout, validateLayoutRecipe, renderDiscordMarkdownPreview, layoutOverLimitSuffix } from '../features/share-discord.js';
import { countCachedPriceStats } from '../scanner/cache.js';

// Element-lookup table: one record, shared by sync/bind/actions.
export function collectModalElements(shadow) {
  const dialog = shadow.getElementById('tp-settings-dialog');
  const fabButton = shadow.getElementById('tp-settings-fab');
  const btnClose = shadow.getElementById('tp-btn-close');
  const btnSave = shadow.getElementById('tp-btn-save');

  const marginRange = shadow.getElementById('tp-margin-range');
  const marginVal = shadow.getElementById('tp-margin-val');
  const opacityRange = shadow.getElementById('tp-opacity-range');
  const opacityVal = shadow.getElementById('tp-opacity-val');
  const shippingToggle = shadow.getElementById('tp-shipping-toggle');
  const sortNone = shadow.getElementById('tp-sort-none');
  const sortDesc = shadow.getElementById('tp-sort-desc');
  const sortAsc = shadow.getElementById('tp-sort-asc');
  const sortDiscount = shadow.getElementById('tp-sort-discount');
  const alarmEnabledToggle = shadow.getElementById('tp-alarm-enabled-toggle');
  const alarmTargetRange = shadow.getElementById('tp-alarm-target-range');
  const alarmTargetVal = shadow.getElementById('tp-alarm-target-val');
  const alarmAutoSubmitToggle = shadow.getElementById('tp-alarm-autosubmit-toggle');
  const heatmapIntensityRange = shadow.getElementById('tp-heatmap-intensity-range');
  const heatmapIntensityVal = shadow.getElementById('tp-heatmap-intensity-val');
  const bestpreiseModeToggle = shadow.getElementById('tp-bestpreise-mode-toggle');
  const bestpreiseWeightRange = shadow.getElementById('tp-bestpreise-weight-range');
  const bestpreiseWeightVal = shadow.getElementById('tp-bestpreise-weight-val');
  const bestpreiseWeightDesc = shadow.getElementById('tp-bestpreise-weight-desc');
  const bestpreiseMinPointsRange = shadow.getElementById('tp-bestpreise-minpoints-range');
  const bestpreiseMinPointsVal = shadow.getElementById('tp-bestpreise-minpoints-val');
  const bestpreiseHorizonRange = shadow.getElementById('tp-bestpreise-horizon-range');
  const bestpreiseHorizonVal = shadow.getElementById('tp-bestpreise-horizon-val');
  const bestpreiseHorizonDesc = shadow.getElementById('tp-bestpreise-horizon-desc');
  const cacheTtlSelect = shadow.getElementById('tp-cache-ttl-select');
  const cacheNegTtlSelect = shadow.getElementById('tp-cache-neg-ttl-select');
  const cacheStatsLabel = shadow.getElementById('tp-cache-stats-label');
  const cacheClearBtn = shadow.getElementById('tp-cache-clear-btn');
  const dataResetBtn = shadow.getElementById('tp-data-reset-btn');
  const realDealMinRange = shadow.getElementById('tp-real-deal-min-range');
  const realDealMinVal = shadow.getElementById('tp-real-deal-min-val');
  const sparklinesToggle = shadow.getElementById('tp-sparklines-toggle');
  const reviewSearchToggle = shadow.getElementById('tp-review-search-toggle');
  const reviewKeywordInput = shadow.getElementById('tp-review-keyword-input');
  const reviewAiModeToggle = shadow.getElementById('tp-review-ai-mode-toggle');
  const dealerAutofetchToggle = shadow.getElementById('tp-dealer-autofetch-toggle');
  const discordWebhookInput = shadow.getElementById('tp-discord-webhook-input');
  const discordWebhookReveal = shadow.getElementById('tp-discord-webhook-reveal');
  const discordWebhookEditor = shadow.getElementById('tp-discord-webhook-editor');
  const discordWebhookStatus = shadow.getElementById('tp-discord-webhook-status');
  const discordDealerEmbedToggle = shadow.getElementById('tp-discord-dealer-embed-toggle');
  const discordProductEmbedToggle = shadow.getElementById('tp-discord-product-embed-toggle');
  const discordForumTitleToggle = shadow.getElementById('tp-discord-forum-title-toggle');
  const discordLayoutInput = shadow.getElementById('tp-discord-layout-input');
  const discordLayoutPreview = shadow.getElementById('tp-discord-layout-preview');
  const discordLayoutCount = shadow.getElementById('tp-discord-layout-count');
  const discordLayoutError = shadow.getElementById('tp-discord-layout-error');
  const discordLayoutReset = shadow.getElementById('tp-discord-layout-reset');
  const exportBtn = shadow.getElementById('tp-export-config-btn');
  const importBtn = shadow.getElementById('tp-import-config-btn');
  const importFile = shadow.getElementById('tp-import-config-file');
  return { shadow, dialog, fabButton, btnClose, btnSave, marginRange, marginVal, opacityRange, opacityVal, shippingToggle, sortNone, sortDesc, sortAsc, sortDiscount, alarmEnabledToggle, alarmTargetRange, alarmTargetVal, alarmAutoSubmitToggle, heatmapIntensityRange, heatmapIntensityVal, bestpreiseModeToggle, bestpreiseWeightRange, bestpreiseWeightVal, bestpreiseWeightDesc, bestpreiseMinPointsRange, bestpreiseMinPointsVal, bestpreiseHorizonRange, bestpreiseHorizonVal, bestpreiseHorizonDesc, cacheTtlSelect, cacheNegTtlSelect, cacheStatsLabel, cacheClearBtn, dataResetBtn, realDealMinRange, realDealMinVal, sparklinesToggle, reviewSearchToggle, reviewKeywordInput, reviewAiModeToggle, dealerAutofetchToggle, discordWebhookInput, discordWebhookReveal, discordWebhookEditor, discordWebhookStatus, discordDealerEmbedToggle, discordProductEmbedToggle, discordForumTitleToggle, discordLayoutInput, discordLayoutPreview, discordLayoutCount, discordLayoutError, discordLayoutReset, exportBtn, importBtn, importFile, layoutTimer: 0 };
}

// Built lazily (was setupUI-local): kompakt reads DEFAULT_LAYOUT, which
// initializes later in bundle concat order (features/share-discord.js).
export function getLayoutPresets() {
  return {
    kompakt: DEFAULT_LAYOUT,
    ausfuehrlich: '## {title}\n# {price}\n-# {dealer}\n-# {offers}\n{spark}\n{prevlow}\n{median}\n{link}',
    minimal: '## {title}\n# {price}\n{link}'
  };
}
const LAYOUT_SAMPLE = { title: 'URBANISTA Porto, Cloud White', url: 'https://www.toppreise.ch/preisvergleich/x-p802723', priceText: 'CHF 16.85', dealer: 'Amazon.de', dealerUrl: 'https://www.toppreise.ch/ext_de?pid=802723', offerCount: 25, spark: '▁▂▃▄▅▆▇', prevLowText: 'CHF 29.70', prevLowPct: 43, medianText: 'Ø-Preis (90T): CHF 42.90', medianPct: 61 };
function renderLayoutPreview(els) {
    if (!els.discordLayoutInput || !els.discordLayoutPreview) return;
    const recipe = els.discordLayoutInput.value;
    if (els.discordLayoutError) els.discordLayoutError.textContent = validateLayoutRecipe(recipe) || '';
    const rendered = renderLayout({
      ...LAYOUT_SAMPLE,
      suppressDealerEmbed: els.discordDealerEmbedToggle ? !els.discordDealerEmbedToggle.checked : true,
      suppressProductEmbed: els.discordProductEmbedToggle ? !els.discordProductEmbedToggle.checked : true
    }, recipe);
    els.discordLayoutPreview.innerHTML = renderDiscordMarkdownPreview(rendered);
    if (els.discordLayoutCount) els.discordLayoutCount.textContent = `Rezept ${recipe.length} Zeichen · Nachricht ${rendered.length}/2000${layoutOverLimitSuffix(rendered.length, recipe)}`;
}
export function scheduleLayoutPreview(els) { clearTimeout(els.layoutTimer); els.layoutTimer = setTimeout(() => renderLayoutPreview(els), 150); }

export function syncFieldsFromConfig(els) {
    // Every key syncUiControl covers (radios, toggles, weight, min-points,
    // threshold, shipping, sparklines, dealer-autofetch, embeds, alarm) syncs
    // through it — toolbar mirrors included. Only modal-only controls below.
    for (const k of Object.keys(CONFIG)) syncUiControl(k, CONFIG[k], { silent: true });

    els.marginRange.value = CONFIG.MARGIN_PERCENT;
    els.marginVal.value = CONFIG.MARGIN_PERCENT;

    if (CONFIG.SORT_BY_OFFERS === 'desc') els.sortDesc.checked = true;
    else if (CONFIG.SORT_BY_OFFERS === 'asc') els.sortAsc.checked = true;
    else if (CONFIG.SORT_BY_OFFERS === 'discount-desc') els.sortDiscount.checked = true;
    else els.sortNone.checked = true;

    const heatIntensityPct = Math.round((CONFIG.HEATMAP_INTENSITY ?? 1.0) * 100);
    els.heatmapIntensityRange.value = heatIntensityPct;
    els.heatmapIntensityVal.value = heatIntensityPct;

    // Berechnungsparameter shape browse heat too — always visible; mode only drives sort + scan.
    {
      const stored = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365;
      if (els.bestpreiseHorizonRange) els.bestpreiseHorizonRange.value = stored === 0 ? 760 : stored;
      if (els.bestpreiseHorizonVal) els.bestpreiseHorizonVal.value = stored;
      if (els.bestpreiseHorizonDesc) els.bestpreiseHorizonDesc.textContent = `Ø-Vergleich: ${horizonText(stored)} — Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis`;
    }

    if (els.cacheTtlSelect) els.cacheTtlSelect.value = String(CONFIG.REAL_DEAL_CACHE_HOURS || 48);
    if (els.cacheNegTtlSelect) els.cacheNegTtlSelect.value = String(CONFIG.NEGATIVE_CACHE_HOURS || 2);
    if (els.cacheStatsLabel) {
      const count = countCachedPriceStats();
      els.cacheStatsLabel.textContent = `Lokaler Cache: ${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`;
    }

    if (els.discordWebhookInput) els.discordWebhookInput.value = '';
    if (els.discordWebhookEditor) els.discordWebhookEditor.style.display = 'none';
    if (els.discordWebhookReveal) { els.discordWebhookReveal.style.display = ''; els.discordWebhookReveal.setAttribute('aria-expanded', 'false'); }
    if (els.discordWebhookStatus) els.discordWebhookStatus.textContent = CONFIG.DISCORD_WEBHOOK_URL ? '✅ Webhook hinterlegt' : 'Kein Webhook hinterlegt';
    if (els.discordDealerEmbedToggle) els.discordDealerEmbedToggle.checked = CONFIG.DISCORD_SUPPRESS_DEALER_EMBED === false;
    if (els.discordProductEmbedToggle) els.discordProductEmbedToggle.checked = CONFIG.DISCORD_SUPPRESS_PRODUCT_EMBED === false;
    if (els.discordForumTitleToggle) els.discordForumTitleToggle.checked = CONFIG.DISCORD_FORUM_TITLE === true;
    if (els.discordLayoutInput) els.discordLayoutInput.value = CONFIG.DISCORD_LAYOUT;
    renderLayoutPreview(els);
}

export function bindDual(rangeEl, numEl, onInput = null) {
    if (!rangeEl || !numEl) return;
    rangeEl.addEventListener('input', e => {
      numEl.value = e.target.value;
      onInput?.(parseFloat(e.target.value));
    });
    numEl.addEventListener('input', e => {
      // Clamp typed values into the slider's range so the pair can't desync.
      const min = parseFloat(rangeEl.min);
      const max = parseFloat(rangeEl.max);
      const typed = parseFloat(e.target.value);
      if (!isNaN(min) && !isNaN(max) && !isNaN(typed)) {
        rangeEl.value = Math.min(max, Math.max(min, typed));
      } else {
        rangeEl.value = e.target.value;
      }
      onInput?.(parseFloat(e.target.value));
    });
}

export function updateWeightDesc(els, val) {
  if (els.bestpreiseWeightDesc) {
    els.bestpreiseWeightDesc.textContent = weightText(val / 100, 'desc');
  }
}

export function bindControlPairs(els) {
  bindDual(els.marginRange, els.marginVal);
  if (els.opacityRange && els.opacityVal) {
    els.opacityRange.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      els.opacityVal.value = Math.round(v * 100);
      document.documentElement.style.setProperty('--tp-dim-opacity', v);
    });
    els.opacityVal.addEventListener('input', e => {
      const v = Math.min(0.95, Math.max(0.05, (parseFloat(e.target.value) || 0) / 100));
      els.opacityRange.value = v;
      document.documentElement.style.setProperty('--tp-dim-opacity', v);
    });
  }
  bindDual(els.alarmTargetRange, els.alarmTargetVal);
  bindDual(els.heatmapIntensityRange, els.heatmapIntensityVal);
  bindDual(els.realDealMinRange, els.realDealMinVal);

  bindDual(els.bestpreiseWeightRange, els.bestpreiseWeightVal, v => updateWeightDesc(els, v));
  bindDual(els.bestpreiseHorizonRange, els.bestpreiseHorizonVal, (raw) => {
    const v = isNaN(raw) ? 365 : (raw > 730 ? 0 : raw);
    if (els.bestpreiseHorizonDesc) els.bestpreiseHorizonDesc.textContent = `Ø-Vergleich: ${horizonText(v)} — Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis`;
    if (v === 0) {
      if (els.bestpreiseHorizonRange) els.bestpreiseHorizonRange.value = 760;
      if (els.bestpreiseHorizonVal && raw > 730) els.bestpreiseHorizonVal.value = 0;
    }
  });
  if (els.bestpreiseMinPointsRange && els.bestpreiseMinPointsVal) {
    els.bestpreiseMinPointsRange.addEventListener('input', e => {
      els.bestpreiseMinPointsVal.value = minPointsFromIndex(e.target.value);
    });
    els.bestpreiseMinPointsVal.addEventListener('input', e => {
      const typed = parseFloat(e.target.value);
      if (!isNaN(typed)) els.bestpreiseMinPointsRange.value = minPointsToIndex(clampMinPoints(typed));
    });
  }
}
