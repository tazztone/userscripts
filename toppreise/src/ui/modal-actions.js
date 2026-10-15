/**
 * Modal actions (split from ui/modal.js): cache/webhook/layout/data/export/
 * import/open-close/save handlers + openSettingsAt entry point.
 */

import { showToast } from './toast.js';
import { CONFIG, DEFAULTS, saveConfigKey, updateConfigs, updateBodyClasses, clampIntensity01, sanitizeReviewKeyword, sanitizeConfigValue } from '../state/config.js';
import { clearPriceStatsCache, recomputeCachedMedians, STATS_CACHE_PREFIX } from '../scanner/cache.js';
import { clearDealerMemory } from './badges.js';
import { triggerProcessListings, clearCardCache } from '../page/adapter.js';
import { getProductCards } from '../page/cards.js';
import { DEFAULT_LAYOUT, validateLayoutRecipe, discordForumFlagKey } from '../features/share-discord.js';
import { syncFieldsFromConfig, scheduleLayoutPreview, getLayoutPresets } from './modal-bindings.js';
import { ensureSkeleton } from './shell.js';
import { writeCollapsed } from './modal-template.js';

export function wireModalActions(els) {
  els.cacheClearBtn?.addEventListener('click', () => {
    const removed = clearPriceStatsCache();
    clearDealerMemory();
    if (els.cacheStatsLabel) els.cacheStatsLabel.textContent = 'Lokaler Cache: 0 Einträge';
    triggerProcessListings();
    showToast(`Cache geleert (${removed} Produkte entfernt)`);
  });

  els.discordWebhookReveal?.addEventListener('click', () => {
    if (!els.discordWebhookEditor || !els.discordWebhookInput) return;
    els.discordWebhookInput.value = CONFIG.DISCORD_WEBHOOK_URL || '';
    els.discordWebhookEditor.style.display = '';
    els.discordWebhookReveal.style.display = 'none';
    els.discordWebhookReveal.setAttribute('aria-expanded', 'true');
    els.discordWebhookInput.focus();
  });

  els.discordLayoutInput?.addEventListener('input', () => scheduleLayoutPreview(els));
  els.discordDealerEmbedToggle?.addEventListener('change', () => scheduleLayoutPreview(els));
  els.discordProductEmbedToggle?.addEventListener('change', () => scheduleLayoutPreview(els));
  for (const [name, recipe] of Object.entries(getLayoutPresets())) {
    els.shadow.getElementById(`tp-discord-layout-preset-${name}`)?.addEventListener('click', () => {
      if (!els.discordLayoutInput) return;
      const current = els.discordLayoutInput.value;
      if (!Object.values(getLayoutPresets()).includes(current) && !window.confirm('Layout ersetzen?')) return;
      els.discordLayoutInput.value = recipe;
      scheduleLayoutPreview(els);
    });
  }
  els.shadow.getElementById('tp-discord-layout-chips')?.addEventListener('click', e => {
    const token = e.target?.closest?.('button')?.dataset?.token;
    if (!token || !els.discordLayoutInput) return;
    const { selectionStart = els.discordLayoutInput.value.length, selectionEnd = els.discordLayoutInput.value.length } = els.discordLayoutInput;
    els.discordLayoutInput.value = els.discordLayoutInput.value.slice(0, selectionStart) + token + els.discordLayoutInput.value.slice(selectionEnd);
    els.discordLayoutInput.focus();
    scheduleLayoutPreview(els);
  });
  els.discordLayoutReset?.addEventListener('click', () => {
    if (!els.discordLayoutInput) return;
    els.discordLayoutInput.value = DEFAULT_LAYOUT;
    scheduleLayoutPreview(els);
  });

  els.dataResetBtn?.addEventListener('click', () => {
    if (!window.confirm('Wirklich ALLE Suite-Daten löschen? Preis-/Händler-Cache und sämtliche Einstellungen (inkl. Discord-Webhook) werden auf Standard zurückgesetzt.')) return;
    const removed = clearPriceStatsCache();
    clearDealerMemory();
    getProductCards().forEach(clearCardCache);
    try {
      const dead = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.includes('DISCORD_FORUM:')) dead.push(k);
      }
      dead.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    try {
      const hook = (CONFIG.DISCORD_WEBHOOK_URL || '').trim();
      if (hook && typeof GM_deleteValue !== 'undefined') GM_deleteValue(discordForumFlagKey(hook));
    } catch (e) {}
    updateConfigs({ ...DEFAULTS });
    updateBodyClasses();
    syncFieldsFromConfig(els);
    if (els.cacheStatsLabel) els.cacheStatsLabel.textContent = 'Lokaler Cache: 0 Einträge';
    showToast(`Alle Daten gelöscht (${removed} Cache-Einträge, Einstellungen zurückgesetzt)`);
  });

  els.exportBtn?.addEventListener('click', () => {
    const exportData = {
      _meta: {
        version: (typeof GM_info !== 'undefined' && GM_info?.script?.version) || 'dev',
        exported: new Date().toISOString()
      },
      // Bearer-Secret nie exportieren (JSON.stringify droppt undefined).
      config: { ...CONFIG, DISCORD_WEBHOOK_URL: undefined },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toppreise-suite-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Einstellungen exportiert');
  });

  els.importBtn?.addEventListener('click', () => {
    els.importFile?.click();
  });

  els.importFile?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const importConfig = data.config || data;
        const prevShipping = CONFIG.USE_SHIPPING_PRICE;
        const prevHorizon = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS;
        const prevOutlierOn = CONFIG.OUTLIER_REJECTION_ENABLED;
        const prevOutlierBand = CONFIG.OUTLIER_DEVIATION_BAND;
        const prevOutlierHours = CONFIG.OUTLIER_MAX_GLITCH_HOURS;
        let count = 0;
        for (const [key, val] of Object.entries(importConfig)) {
          if (!(key in DEFAULTS) || key === 'DEBUG' || key === 'DISCORD_WEBHOOK_URL') continue;
          // Single schema: sanitize each imported key, drop unknowns/invalid.
          if (key === 'DISCORD_LAYOUT' && validateLayoutRecipe(String(val))) continue;
          const clean = sanitizeConfigValue(key, val);
          if (clean === undefined) continue;
          saveConfigKey(key, clean);
          count++;
        }
        if (CONFIG.USE_SHIPPING_PRICE !== prevShipping) { clearPriceStatsCache(undefined, [STATS_CACHE_PREFIX]); clearDealerMemory(); getProductCards().forEach(clearCardCache); }
        if (CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS !== prevHorizon || CONFIG.OUTLIER_REJECTION_ENABLED !== prevOutlierOn || CONFIG.OUTLIER_DEVIATION_BAND !== prevOutlierBand || CONFIG.OUTLIER_MAX_GLITCH_HOURS !== prevOutlierHours) recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
        updateBodyClasses();
        triggerProcessListings();
        syncFieldsFromConfig(els);
        showToast(`${count} Einstellungen importiert`);
      } catch (err) {
        showToast('Import fehlgeschlagen: Ungültige JSON-Datei');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  const openModal = () => {
    syncFieldsFromConfig(els);
    if (typeof els.dialog.showModal === 'function') els.dialog.showModal();
    else els.dialog.setAttribute('open', '');
  };

  const closeModal = () => {
    document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
    if (typeof els.dialog.close === 'function') els.dialog.close();
    else els.dialog.removeAttribute('open');
  };

  els.fabButton.addEventListener('click', openModal);
  els.btnClose.addEventListener('click', closeModal);
  els.dialog.addEventListener('click', e => { if (e.target === els.dialog) closeModal(); });
  // Native `close` (Escape on backdrop/frame, cancel event) bypasses both
  // closeModal and the els.shadow keydown handler — reset the preview anyway.
  els.dialog.addEventListener('close', () => document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY));

  els.btnSave.addEventListener('click', () => {
    const updates = {};

    updates.MARGIN_PERCENT = Math.max(0, Math.min(50, parseFloat(els.marginVal.value) || 0));
    updates.DIM_OPACITY = Math.max(0.05, Math.min(1, parseFloat(els.opacityRange.value) || 0.25));
    // Cached price stats are shipping-mode specific (product vs shipping series
    // share one cache key), so a mode change must invalidate them.
    const shippingChanged = !!els.shippingToggle && CONFIG.USE_SHIPPING_PRICE !== els.shippingToggle.checked;
    if (els.shippingToggle) updates.USE_SHIPPING_PRICE = els.shippingToggle.checked;
    // Cached analyses bake in the median horizon — recompute them locally
    // from the retained series (no network) before the single repaint below.
    const rawHorizon = els.bestpreiseHorizonVal ? parseInt(els.bestpreiseHorizonVal.value, 10)
      : (els.bestpreiseHorizonRange ? parseInt(els.bestpreiseHorizonRange.value, 10) : NaN);
    const newHorizon = isNaN(rawHorizon) ? 365 : (rawHorizon <= 0 || rawHorizon > 730 ? 0 : Math.min(730, Math.max(30, rawHorizon)));
    const horizonChanged = !!(els.bestpreiseHorizonVal || els.bestpreiseHorizonRange) && CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS !== newHorizon;
    const checkedSort = els.shadow.querySelector('input[name="tp-sort-offers"]:checked');
    if (checkedSort) updates.SORT_BY_OFFERS = checkedSort.value;

    updates.ALARM_ENABLED = els.alarmEnabledToggle.checked;
    updates.ALARM_TARGET_PERCENT = Math.max(0.05, Math.min(0.99, (parseInt(els.alarmTargetVal.value) || 60) / 100));

    const checkedDur = els.shadow.querySelector('input[name="tp-alarm-duration"]:checked');
    if (checkedDur) updates.ALARM_DURATION_DAYS = String(parseInt(checkedDur.value, 10) || 730);

    updates.ALARM_AUTO_SUBMIT = els.alarmAutoSubmitToggle.checked;
    updates.HEATMAP_INTENSITY = clampIntensity01((parseInt(els.heatmapIntensityVal.value) || 100) / 100);

    if (els.bestpreiseModeToggle) updates.BESTPREISE_MODE_ACTIVE = els.bestpreiseModeToggle.checked;
    if (els.bestpreiseWeightVal) {
      const rawW = parseInt(els.bestpreiseWeightVal.value, 10);
      const weightNum = isNaN(rawW) ? 50 : rawW;
      updates.BESTPREISE_WEIGHT_RECORD = Math.max(0, Math.min(1.0, weightNum / 100));
    }
    if (els.bestpreiseHorizonVal || els.bestpreiseHorizonRange) {
      updates.BESTPREISE_MEDIAN_HORIZON_DAYS = newHorizon;
    }
    if (els.bestpreiseMinPointsVal) {
      updates.BESTPREISE_MIN_POINTS = clampMinPoints(els.bestpreiseMinPointsVal.value);
    }
    if (els.cacheTtlSelect) { const rawC = parseInt(els.cacheTtlSelect.value, 10); updates.REAL_DEAL_CACHE_HOURS = isNaN(rawC) ? 48 : rawC; }
    if (els.cacheNegTtlSelect) { const rawN = parseFloat(els.cacheNegTtlSelect.value); updates.NEGATIVE_CACHE_HOURS = isNaN(rawN) ? 2 : rawN; }
    if (els.realDealMinVal) updates.REAL_DEAL_MIN_DISCOUNT = Math.max(0, Math.min(90, parseInt(els.realDealMinVal.value) || 30));
    if (els.sparklinesToggle) updates.ENABLE_SPARKLINES = els.sparklinesToggle.checked;
    if (els.dealerAutofetchToggle) updates.DEALER_AUTOFETCH = els.dealerAutofetchToggle.checked;
    if (els.reviewSearchToggle) updates.REVIEW_SEARCH_ENABLED = els.reviewSearchToggle.checked;
    if (els.reviewKeywordInput) updates.REVIEW_SEARCH_KEYWORD = sanitizeReviewKeyword(els.reviewKeywordInput.value);
    if (els.reviewAiModeToggle) updates.REVIEW_SEARCH_AI_MODE = els.reviewAiModeToggle.checked;
    if (els.discordWebhookInput && els.discordWebhookEditor && els.discordWebhookEditor.style.display !== 'none') updates.DISCORD_WEBHOOK_URL = String(els.discordWebhookInput.value || '').trim();
    if (els.discordDealerEmbedToggle) updates.DISCORD_SUPPRESS_DEALER_EMBED = !els.discordDealerEmbedToggle.checked;
    if (els.discordProductEmbedToggle) updates.DISCORD_SUPPRESS_PRODUCT_EMBED = !els.discordProductEmbedToggle.checked;
    if (els.discordForumTitleToggle) updates.DISCORD_FORUM_TITLE = els.discordForumTitleToggle.checked;
    if (els.discordLayoutInput) {
      const value = String(els.discordLayoutInput.value || '');
      const err = validateLayoutRecipe(value);
      if (err) {
        if (els.discordLayoutError) els.discordLayoutError.textContent = err;
        els.shadow.getElementById('tp-section-discord')?.classList.remove('tp-collapsed');
        els.shadow.querySelector('#tp-section-discord [data-collapse]')?.setAttribute('aria-expanded', 'true');
        els.discordLayoutInput.focus();
        return;
      }
      updates.DISCORD_LAYOUT = value;
    }
    if (shippingChanged) { clearPriceStatsCache(undefined, [STATS_CACHE_PREFIX]); clearDealerMemory(); getProductCards().forEach(clearCardCache); }
    if (horizonChanged) recomputeCachedMedians(newHorizon);
    updateConfigs(updates);
    showToast('Toppreise Suite Einstellungen gespeichert');
    closeModal();
  });
}

// Bell-cog entry point: opens settings via the FAB path (identical sync +
// show behavior), then scrolls to the requested section with a one-shot
// flash.
export function openSettingsAt(sectionId) {
  const { shadow } = ensureSkeleton();
  shadow.getElementById('tp-settings-fab')?.click();
  const anchor = shadow.getElementById(sectionId);
  if (!anchor) return;
  if (anchor.classList.contains('tp-collapsed')) {
    anchor.classList.remove('tp-collapsed');
    anchor.querySelector('[data-collapse]')?.setAttribute('aria-expanded', 'true');
    const current = [...shadow.querySelectorAll('#tp-settings-sections section.tp-collapsed')].map(s => s.id);
    writeCollapsed(current);
  }
  anchor.scrollIntoView({ block: 'start' });
  anchor.classList.add('tp-flash');
  setTimeout(() => anchor.classList.remove('tp-flash'), 2000);
}
