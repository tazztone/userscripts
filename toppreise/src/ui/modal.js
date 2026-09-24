/**
 * Settings Modal & Shadow DOM Component
 * Manages the floating action button, multi-tab settings dialog,
 * dual-binding input controls, theme selection, import/export, and cache controls.
 */

import { SHADOW_MODAL_STYLES } from "./styles.js";
import { showToast } from "./toast.js";

export let uiShadowRoot = null;
export function getUiShadowRoot() {
  return uiShadowRoot;
}

export function ensureSkeleton() {
  let host = document.getElementById('tp-root');
  if (!host) {
    host = document.createElement('div');
    host.id = 'tp-root';
    document.body.appendChild(host);
  }
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  uiShadowRoot = shadow;

  if (!shadow.getElementById('tp-settings-fab')) {
    shadow.innerHTML = `
      <style>${SHADOW_MODAL_STYLES}</style>
      <button id="tp-settings-fab" type="button" title="Toppreise Suite Einstellungen öffnen" aria-label="Toppreise Suite Einstellungen">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      <dialog id="tp-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="tp-settings-title">
        <h3 id="tp-settings-title">Toppreise Suite Einstellungen</h3>
        <div id="tp-settings-sections"></div>
        <div class="tp-modal-actions">
          <button type="button" class="tp-btn tp-btn-secondary" id="tp-btn-close">Abbrechen</button>
          <button type="button" class="tp-btn tp-btn-primary" id="tp-btn-save">Speichern</button>
        </div>
      </dialog>
      <div id="tp-toast-container"></div>
    `;
  }
  return { shadow };
}

export function setupUI() {
  const { shadow } = ensureSkeleton();
  let section = shadow.getElementById('tp-section-unified-suite');
  if (!section) {
    const sectionsHolder = shadow.getElementById('tp-settings-sections');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = `
      <div id="tp-section-unified-suite">
        <div class="tp-section-header">1. Händler Bestpreis Highlights & Sortierung</div>
        <div class="tp-settings-group">
          <label>Filter Modus</label>
          <div class="tp-segmented-control">
            <input type="radio" id="tp-mode-highlight-only" name="tp-mode" value="highlight-only">
            <label for="tp-mode-highlight-only">Highlight</label>
            <input type="radio" id="tp-mode-dim" name="tp-mode" value="dim">
            <label for="tp-mode-dim">Dimmen</label>
            <input type="radio" id="tp-mode-hide" name="tp-mode" value="hide">
            <label for="tp-mode-hide">Verbergen</label>
          </div>
        </div>
        <div class="tp-settings-group">
          <label>Preis-Toleranz (%)</label>
          <div class="tp-range-container">
            <input type="range" id="tp-margin-range" min="0" max="15" step="0.5" value="0">
            <input type="number" id="tp-margin-val" min="0" max="100" step="0.1" value="0">
          </div>
        </div>
        <div class="tp-settings-group" id="tp-dim-opacity-group">
          <label>Deckkraft / Dimmung (Gedimmt & Gefiltert)</label>
          <div class="tp-range-container">
            <input type="range" id="tp-opacity-range" min="0.05" max="0.95" step="0.05" value="0.25">
            <input type="number" id="tp-opacity-val" min="5" max="95" step="5" value="25">
          </div>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label"><label>inkl. Versandkosten vergleichen</label></div>
          <label class="tp-switch">
            <input type="checkbox" id="tp-shipping-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group">
          <label>Sortierung nach Angeboten / Rabatt</label>
          <div class="tp-segmented-control">
            <input type="radio" id="tp-sort-none" name="tp-sort-offers" value="none">
            <label for="tp-sort-none">Standard</label>
            <input type="radio" id="tp-sort-desc" name="tp-sort-offers" value="desc">
            <label for="tp-sort-desc">Meiste ⬇</label>
            <input type="radio" id="tp-sort-asc" name="tp-sort-offers" value="asc">
            <label for="tp-sort-asc">Wenigste ⬆</label>
            <input type="radio" id="tp-sort-discount" name="tp-sort-offers" value="discount-desc">
            <label for="tp-sort-discount">% Rabatt ⬇</label>
          </div>
        </div>
        <div class="tp-section-header" style="color: #f43f5e;">2. Rabatt-Heatmap & Deals</div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label>Rabatt-Heatmap aktivieren</label>
            <span class="tp-switch-desc">Färbt Karten kontinuierlich (-100% Rot / Heiß bis +100% Blau / Kalt)</span>
          </div>
          <label class="tp-switch tp-rose">
            <input type="checkbox" id="tp-heatmap-enabled-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group">
          <label>Heatmap-Intensität (%)</label>
          <div class="tp-range-container tp-rose">
            <input type="range" id="tp-heatmap-intensity-range" min="20" max="100" step="5" value="100">
            <input type="number" id="tp-heatmap-intensity-val" min="20" max="100" step="5" value="100">
          </div>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label>💎 Neue Bestpreise Modus</label>
            <span class="tp-switch-desc">Auto-Scan + Deal-Score Ranking auf der Deal-Feed-Seite</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-bestpreise-mode-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group" id="tp-bestpreise-weight-group" style="display: none;">
          <label>Deal-Score Gewichtung (Median ↔ Neuer Rekord)</label>
          <div class="tp-range-container tp-purple">
            <input type="range" id="tp-bestpreise-weight-range" min="0" max="100" step="5" value="50">
            <input type="number" id="tp-bestpreise-weight-val" min="0" max="100" step="5" value="50">
          </div>
          <span class="tp-switch-desc" id="tp-bestpreise-weight-desc" style="display: block; margin-top: 4px; font-size: 11px; opacity: 0.85;">50% Median / 50% Neuer Rekord</span>
        </div>
        <div class="tp-settings-group" id="tp-bestpreise-horizon-group" style="display: none;">
          <label>Median-Berechnungszeitraum (Ø-Preis)</label>
          <select id="tp-bestpreise-horizon-select" class="tp-select tp-purple" style="width: 100%; background: #1e293b; color: #f8fafc; border: 1px solid #475569; border-radius: 6px; padding: 6px 10px; font-size: 13px; margin-top: 4px; box-sizing: border-box;">
            <option value="365">1 Jahr (365 Tage) [Empfohlen]</option>
            <option value="180">6 Monate (180 Tage)</option>
            <option value="90">3 Monate (90 Tage)</option>
            <option value="0">Gesamte Historie (Lifetime)</option>
          </select>
          <span class="tp-switch-desc" style="display: block; margin-top: 4px; font-size: 11px; opacity: 0.85;">Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis</span>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label>Nur echte Tiefstpreise filtern</label>
            <span class="tp-switch-desc">Verifizierte Nicht-Bestpreise im Feed ausblenden</span>
          </div>
          <label class="tp-switch">
            <input type="checkbox" id="tp-real-deal-filter-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group">
          <label>Mindest-Rabatt für Batch-Check (%)</label>
          <div class="tp-range-container">
            <input type="range" id="tp-real-deal-min-range" min="10" max="70" step="5" value="30">
            <input type="number" id="tp-real-deal-min-val" min="5" max="95" step="5" value="30">
          </div>
        </div>
        <div class="tp-section-header" style="color: #3b82f6;">3. Preisalarm Auto-Filler</div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label>Preisalarm Auto-Fill aktivieren</label>
            <span class="tp-switch-desc">Beim Klick auf die Glocke Formular automatisch ausfüllen</span>
          </div>
          <label class="tp-switch tp-blue">
            <input type="checkbox" id="tp-alarm-enabled-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group">
          <label>Zielpreis (% vom aktuellen Preis)</label>
          <div class="tp-range-container tp-blue">
            <input type="range" id="tp-alarm-target-range" min="10" max="95" step="5" value="60">
            <input type="number" id="tp-alarm-target-val" min="1" max="99" step="1" value="60">
          </div>
        </div>
        <div class="tp-settings-group">
          <label>Laufzeit Dauer</label>
          <div class="tp-segmented-control tp-segmented-control-blue">
            <input type="radio" id="tp-dur-90" name="tp-alarm-duration" value="90"><label for="tp-dur-90">3 Monate</label>
            <input type="radio" id="tp-dur-180" name="tp-alarm-duration" value="180"><label for="tp-dur-180">6 Monate</label>
            <input type="radio" id="tp-dur-365" name="tp-alarm-duration" value="365"><label for="tp-dur-365">1 Jahr</label>
            <input type="radio" id="tp-dur-730" name="tp-alarm-duration" value="730"><label for="tp-dur-730">2 Jahre</label>
          </div>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label>Automatisch Absenden & Schließen</label>
            <span class="tp-switch-desc">Formular direkt einreichen und Dialog schließen</span>
          </div>
          <label class="tp-switch tp-blue">
            <input type="checkbox" id="tp-alarm-autosubmit-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group" id="tp-alarm-delays-group">
          <label>Submit-Verzögerung (ms)</label>
          <div class="tp-range-container tp-blue">
            <input type="range" id="tp-alarm-submit-delay-range" min="0" max="2000" step="50" value="300">
            <input type="number" id="tp-alarm-submit-delay-val" min="0" max="5000" step="50" value="300">
          </div>
          <label style="margin-top: 8px;">Schließ-Verzögerung nach Submit (ms)</label>
          <div class="tp-range-container tp-blue">
            <input type="range" id="tp-alarm-close-delay-range" min="0" max="3000" step="50" value="800">
            <input type="number" id="tp-alarm-close-delay-val" min="0" max="10000" step="50" value="800">
          </div>
        </div>
        <div class="tp-section-header" style="color: #06b6d4;">4. Performance, Cache & Preiskurven</div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label>Mini-Preiskurven (Sparklines) anzeigen</label>
            <span class="tp-switch-desc">Erfordert zusätzliche Server-Abfragen pro Produkt</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-sparklines-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group">
          <label>Cache-Dauer für Preishistorie (Gültige Daten)</label>
          <select id="tp-cache-ttl-select" class="tp-select" style="width: 100%; background: #1e293b; color: #f8fafc; border: 1px solid #475569; border-radius: 6px; padding: 6px 10px; font-size: 13px; margin-top: 4px; box-sizing: border-box;">
            <option value="24">24 Stunden (1 Tag)</option>
            <option value="48">48 Stunden (2 Tage) [Standard]</option>
            <option value="72">72 Stunden (3 Tage)</option>
            <option value="168">7 Tage (1 Woche)</option>
            <option value="336">14 Tage (2 Wochen)</option>
          </select>
          <span class="tp-switch-desc" style="display: block; margin-top: 4px; font-size: 11px; opacity: 0.85;">Bestimmt, wie lange abgefragte Preisstatistiken lokal gespeichert bleiben</span>
        </div>
        <div class="tp-settings-group">
          <label>Negativ-Cache Dauer (Nicht verfügbare Daten)</label>
          <select id="tp-cache-neg-ttl-select" class="tp-select" style="width: 100%; background: #1e293b; color: #f8fafc; border: 1px solid #475569; border-radius: 6px; padding: 6px 10px; font-size: 13px; margin-top: 4px; box-sizing: border-box;">
            <option value="1">1 Stunde</option>
            <option value="2">2 Stunden [Standard]</option>
            <option value="6">6 Stunden</option>
            <option value="12">12 Stunden</option>
            <option value="24">24 Stunden</option>
          </select>
          <span class="tp-switch-desc" style="display: block; margin-top: 4px; font-size: 11px; opacity: 0.85;">Verhindert wiederholte Server-Anfragen bei Produkten ohne Preiskurve</span>
        </div>
        <div class="tp-settings-group" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px;">
          <div style="font-size: 12px; opacity: 0.85;" id="tp-cache-stats-label">Lokaler Cache: 0 Einträge</div>
          <button type="button" id="tp-cache-clear-btn" class="tp-btn tp-btn-secondary" style="padding: 4px 10px; font-size: 12px;">🗑️ Cache leeren</button>
        </div>
        <div class="tp-section-header" style="color: #6366f1;">5. Backup & Übertragen</div>
        <div class="tp-settings-group" style="display: flex; flex-direction: row; gap: 8px;">
          <button type="button" id="tp-export-config-btn" class="tp-btn tp-btn-secondary" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;">📥 Export (JSON)</button>
          <button type="button" id="tp-import-config-btn" class="tp-btn tp-btn-secondary" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;">📤 Import (JSON)</button>
          <input type="file" id="tp-import-config-file" accept=".json" style="display: none;">
        </div>
      </div>
    `;
    section = tempDiv.firstElementChild;
    sectionsHolder.appendChild(section);
  }

  const dialog = shadow.getElementById('tp-settings-dialog');
  const fabButton = shadow.getElementById('tp-settings-fab');
  const btnClose = shadow.getElementById('tp-btn-close');
  const btnSave = shadow.getElementById('tp-btn-save');

  const modeHighlight = shadow.getElementById('tp-mode-highlight-only');
  const modeDim = shadow.getElementById('tp-mode-dim');
  const modeHide = shadow.getElementById('tp-mode-hide');
  const marginRange = shadow.getElementById('tp-margin-range');
  const marginVal = shadow.getElementById('tp-margin-val');
  const opacityRange = shadow.getElementById('tp-opacity-range');
  const opacityVal = shadow.getElementById('tp-opacity-val');
  const shippingToggle = shadow.getElementById('tp-shipping-toggle');
  const negTermsInput = shadow.getElementById('tp-negative-terms-input');
  const minOffersRange = shadow.getElementById('tp-min-offers-range');
  const minOffersVal = shadow.getElementById('tp-min-offers-val');
  const sortNone = shadow.getElementById('tp-sort-none');
  const sortDesc = shadow.getElementById('tp-sort-desc');
  const sortAsc = shadow.getElementById('tp-sort-asc');
  const sortDiscount = shadow.getElementById('tp-sort-discount');
  const alarmEnabledToggle = shadow.getElementById('tp-alarm-enabled-toggle');
  const alarmTargetRange = shadow.getElementById('tp-alarm-target-range');
  const alarmTargetVal = shadow.getElementById('tp-alarm-target-val');
  const alarmAutoSubmitToggle = shadow.getElementById('tp-alarm-autosubmit-toggle');
  const alarmSubmitDelayRange = shadow.getElementById('tp-alarm-submit-delay-range');
  const alarmSubmitDelayVal = shadow.getElementById('tp-alarm-submit-delay-val');
  const alarmCloseDelayRange = shadow.getElementById('tp-alarm-close-delay-range');
  const alarmCloseDelayVal = shadow.getElementById('tp-alarm-close-delay-val');
  const alarmDelaysGroup = shadow.getElementById('tp-alarm-delays-group');
  const heatmapEnabledToggle = shadow.getElementById('tp-heatmap-enabled-toggle');
  const heatmapIntensityRange = shadow.getElementById('tp-heatmap-intensity-range');
  const heatmapIntensityVal = shadow.getElementById('tp-heatmap-intensity-val');
  const realDealFilterToggle = shadow.getElementById('tp-real-deal-filter-toggle');
  const bestpreiseModeToggle = shadow.getElementById('tp-bestpreise-mode-toggle');
  const bestpreiseWeightGroup = shadow.getElementById('tp-bestpreise-weight-group');
  const bestpreiseWeightRange = shadow.getElementById('tp-bestpreise-weight-range');
  const bestpreiseWeightVal = shadow.getElementById('tp-bestpreise-weight-val');
  const bestpreiseWeightDesc = shadow.getElementById('tp-bestpreise-weight-desc');
  const bestpreiseHorizonGroup = shadow.getElementById('tp-bestpreise-horizon-group');
  const bestpreiseHorizonSelect = shadow.getElementById('tp-bestpreise-horizon-select');
  const cacheTtlSelect = shadow.getElementById('tp-cache-ttl-select');
  const cacheNegTtlSelect = shadow.getElementById('tp-cache-neg-ttl-select');
  const cacheStatsLabel = shadow.getElementById('tp-cache-stats-label');
  const cacheClearBtn = shadow.getElementById('tp-cache-clear-btn');
  const realDealMinRange = shadow.getElementById('tp-real-deal-min-range');
  const realDealMinVal = shadow.getElementById('tp-real-deal-min-val');
  const sparklinesToggle = shadow.getElementById('tp-sparklines-toggle');
  const dur90 = shadow.getElementById('tp-dur-90');
  const dur180 = shadow.getElementById('tp-dur-180');
  const dur365 = shadow.getElementById('tp-dur-365');
  const dur730 = shadow.getElementById('tp-dur-730');

  const exportBtn = shadow.getElementById('tp-export-config-btn');
  const importBtn = shadow.getElementById('tp-import-config-btn');
  const importFile = shadow.getElementById('tp-import-config-file');

  function syncFieldsFromConfig() {
    if (CONFIG.MODE === 'highlight-only') modeHighlight.checked = true;
    else if (CONFIG.MODE === 'hide') modeHide.checked = true;
    else modeDim.checked = true;

    marginRange.value = CONFIG.MARGIN_PERCENT;
    marginVal.value = CONFIG.MARGIN_PERCENT;
    opacityRange.value = CONFIG.DIM_OPACITY;
    opacityVal.value = Math.round(CONFIG.DIM_OPACITY * 100);
    if (shippingToggle) shippingToggle.checked = CONFIG.USE_SHIPPING_PRICE;
    if (negTermsInput) negTermsInput.value = CONFIG.NEGATIVE_TERMS || '';
    if (minOffersRange) minOffersRange.value = CONFIG.MIN_OFFERS || 0;
    if (minOffersVal) minOffersVal.value = CONFIG.MIN_OFFERS || 0;

    if (CONFIG.SORT_BY_OFFERS === 'desc') sortDesc.checked = true;
    else if (CONFIG.SORT_BY_OFFERS === 'asc') sortAsc.checked = true;
    else if (CONFIG.SORT_BY_OFFERS === 'discount-desc') sortDiscount.checked = true;
    else sortNone.checked = true;

    alarmEnabledToggle.checked = CONFIG.ALARM_ENABLED !== false;
    const targetPct = Math.round(CONFIG.ALARM_TARGET_PERCENT * 100);
    alarmTargetRange.value = targetPct;
    alarmTargetVal.value = targetPct;

    const dur = String(CONFIG.ALARM_DURATION_DAYS);
    if (dur === '90') dur90.checked = true;
    else if (dur === '180') dur180.checked = true;
    else if (dur === '365') dur365.checked = true;
    else dur730.checked = true;

    alarmAutoSubmitToggle.checked = CONFIG.ALARM_AUTO_SUBMIT !== false;
    if (alarmSubmitDelayRange && alarmSubmitDelayVal) {
      alarmSubmitDelayRange.value = CONFIG.ALARM_SUBMIT_DELAY_MS ?? 300;
      alarmSubmitDelayVal.value = CONFIG.ALARM_SUBMIT_DELAY_MS ?? 300;
    }
    if (alarmCloseDelayRange && alarmCloseDelayVal) {
      alarmCloseDelayRange.value = CONFIG.ALARM_CLOSE_DELAY_MS ?? 800;
      alarmCloseDelayVal.value = CONFIG.ALARM_CLOSE_DELAY_MS ?? 800;
    }
    if (alarmDelaysGroup) {
      alarmDelaysGroup.style.display = alarmAutoSubmitToggle.checked ? 'block' : 'none';
    }

    heatmapEnabledToggle.checked = CONFIG.HEATMAP_ENABLED !== false;
    const heatIntensityPct = Math.round((CONFIG.HEATMAP_INTENSITY ?? 1.0) * 100);
    heatmapIntensityRange.value = heatIntensityPct;
    heatmapIntensityVal.value = heatIntensityPct;

    if (bestpreiseModeToggle) bestpreiseModeToggle.checked = CONFIG.BESTPREISE_MODE_ACTIVE === true;
    if (bestpreiseWeightGroup) {
      bestpreiseWeightGroup.style.display = (CONFIG.BESTPREISE_MODE_ACTIVE === true) ? 'block' : 'none';
    }
    if (bestpreiseHorizonGroup) {
      bestpreiseHorizonGroup.style.display = (CONFIG.BESTPREISE_MODE_ACTIVE === true) ? 'block' : 'none';
    }
    if (bestpreiseHorizonSelect) {
      bestpreiseHorizonSelect.value = String(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365);
    }
    const weightPct = Math.round((CONFIG.BESTPREISE_WEIGHT_RECORD ?? 0.50) * 100);
    if (bestpreiseWeightRange) bestpreiseWeightRange.value = weightPct;
    if (bestpreiseWeightVal) bestpreiseWeightVal.value = weightPct;
    if (bestpreiseWeightDesc) {
      bestpreiseWeightDesc.textContent = `${100 - weightPct}% Median / ${weightPct}% Neuer Rekord`;
    }

    if (cacheTtlSelect) cacheTtlSelect.value = String(CONFIG.REAL_DEAL_CACHE_HOURS || 48);
    if (cacheNegTtlSelect) cacheNegTtlSelect.value = String(CONFIG.NEGATIVE_CACHE_HOURS || 2);
    if (cacheStatsLabel) {
      const count = getCachedProductCount();
      cacheStatsLabel.textContent = `Lokaler Cache: ${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`;
    }

    if (realDealFilterToggle) realDealFilterToggle.checked = CONFIG.REAL_DEAL_FILTER_ACTIVE === true;
    if (realDealMinRange) realDealMinRange.value = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
    if (realDealMinVal) realDealMinVal.value = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
    if (sparklinesToggle) sparklinesToggle.checked = CONFIG.ENABLE_SPARKLINES === true;
  }

  const bindDual = (rangeEl, numEl, scale = 1, onInput = null) => {
    if (!rangeEl || !numEl) return;
    rangeEl.addEventListener('input', e => {
      numEl.value = Math.round(parseFloat(e.target.value) * scale);
      onInput?.(parseFloat(e.target.value));
    });
    numEl.addEventListener('input', e => {
      const val = (parseFloat(e.target.value) || 0) / scale;
      rangeEl.value = val;
      onInput?.(val);
    });
  };

  bindDual(marginRange, marginVal, 1);
  bindDual(opacityRange, opacityVal, 100, val => document.documentElement.style.setProperty('--tp-dim-opacity', val));
  bindDual(minOffersRange, minOffersVal, 1);
  bindDual(alarmTargetRange, alarmTargetVal, 1);
  bindDual(alarmSubmitDelayRange, alarmSubmitDelayVal, 1);
  bindDual(alarmCloseDelayRange, alarmCloseDelayVal, 1);
  bindDual(heatmapIntensityRange, heatmapIntensityVal, 1);
  bindDual(realDealMinRange, realDealMinVal, 1);

  const updateWeightDesc = (val) => {
    const pct = Math.round(val);
    if (bestpreiseWeightDesc) {
      bestpreiseWeightDesc.textContent = `${100 - pct}% Median / ${pct}% Neuer Rekord`;
    }
  };
  bindDual(bestpreiseWeightRange, bestpreiseWeightVal, 1, updateWeightDesc);

  bestpreiseModeToggle?.addEventListener('change', () => {
    if (bestpreiseWeightGroup) {
      bestpreiseWeightGroup.style.display = bestpreiseModeToggle.checked ? 'block' : 'none';
    }
    if (bestpreiseHorizonGroup) {
      bestpreiseHorizonGroup.style.display = bestpreiseModeToggle.checked ? 'block' : 'none';
    }
  });

  alarmAutoSubmitToggle?.addEventListener('change', () => {
    if (alarmDelaysGroup) {
      alarmDelaysGroup.style.display = alarmAutoSubmitToggle.checked ? 'block' : 'none';
    }
  });

  cacheClearBtn?.addEventListener('click', () => {
    const removed = clearPriceStatsCache();
    if (cacheStatsLabel) cacheStatsLabel.textContent = 'Lokaler Cache: 0 Einträge';
    processListings();
    showToast(`Cache geleert (${removed} Produkte entfernt)`);
  });

  exportBtn?.addEventListener('click', () => {
    const exportData = {
      _meta: {
        version: (typeof GM_info !== 'undefined' && GM_info?.script?.version) || '2.18.20',
        exported: new Date().toISOString()
      },
      config: { ...CONFIG }
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

  importBtn?.addEventListener('click', () => {
    importFile?.click();
  });

  importFile?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const importConfig = data.config || data;
        let count = 0;
        for (const [key, val] of Object.entries(importConfig)) {
          if (key in DEFAULTS && key !== 'DEBUG') {
            saveConfigKey(key, val);
            count++;
          }
        }
        updateBodyClasses();
        processListings();
        syncFieldsFromConfig();
        showToast(`${count} Einstellungen importiert`);
      } catch (err) {
        showToast('Import fehlgeschlagen: Ungültige JSON-Datei');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  const openModal = () => {
    syncFieldsFromConfig();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const closeModal = () => {
    document.documentElement.style.setProperty('--tp-dim-opacity', CONFIG.DIM_OPACITY);
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  };

  fabButton.addEventListener('click', openModal);
  btnClose.addEventListener('click', closeModal);
  shadow.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  btnSave.addEventListener('click', () => {
    const updates = {};
    const checkedModeEl = shadow.querySelector('input[name="tp-mode"]:checked');
    if (checkedModeEl) updates.MODE = checkedModeEl.value;

    updates.MARGIN_PERCENT = Math.max(0, Math.min(100, parseFloat(marginVal.value) || 0));
    updates.DIM_OPACITY = Math.max(0.05, Math.min(0.95, parseFloat(opacityRange.value) || 0.25));
    if (shippingToggle) updates.USE_SHIPPING_PRICE = shippingToggle.checked;
    if (negTermsInput) updates.NEGATIVE_TERMS = negTermsInput.value.trim();
    if (minOffersVal) updates.MIN_OFFERS = Math.max(0, parseInt(minOffersVal.value) || 0);

    const checkedSort = shadow.querySelector('input[name="tp-sort-offers"]:checked');
    if (checkedSort) updates.SORT_BY_OFFERS = checkedSort.value;

    updates.ALARM_ENABLED = alarmEnabledToggle.checked;
    updates.ALARM_TARGET_PERCENT = Math.max(0.05, Math.min(0.99, (parseInt(alarmTargetVal.value) || 60) / 100));

    const checkedDur = shadow.querySelector('input[name="tp-alarm-duration"]:checked');
    if (checkedDur) updates.ALARM_DURATION_DAYS = checkedDur.value;

    updates.ALARM_AUTO_SUBMIT = alarmAutoSubmitToggle.checked;
    if (alarmSubmitDelayVal) {
      updates.ALARM_SUBMIT_DELAY_MS = Math.max(0, parseInt(alarmSubmitDelayVal.value) ?? 300);
    }
    if (alarmCloseDelayVal) {
      updates.ALARM_CLOSE_DELAY_MS = Math.max(0, parseInt(alarmCloseDelayVal.value) ?? 800);
    }
    updates.HEATMAP_ENABLED = heatmapEnabledToggle.checked;
    updates.HEATMAP_INTENSITY = Math.max(0.2, Math.min(1.0, (parseInt(heatmapIntensityVal.value) || 100) / 100));

    if (bestpreiseModeToggle) {
      updates.BESTPREISE_MODE_ACTIVE = bestpreiseModeToggle.checked;
      if (bestpreiseWeightVal) {
        const rawW = parseInt(bestpreiseWeightVal.value, 10);
        const weightNum = isNaN(rawW) ? 50 : rawW;
        updates.BESTPREISE_WEIGHT_RECORD = Math.max(0, Math.min(1.0, weightNum / 100));
      }
      if (bestpreiseHorizonSelect) {
        updates.BESTPREISE_MEDIAN_HORIZON_DAYS = parseInt(bestpreiseHorizonSelect.value, 10) || 0;
      }
    }
    if (cacheTtlSelect) updates.REAL_DEAL_CACHE_HOURS = parseInt(cacheTtlSelect.value, 10) || 48;
    if (cacheNegTtlSelect) updates.NEGATIVE_CACHE_HOURS = parseInt(cacheNegTtlSelect.value, 10) || 2;

    if (realDealFilterToggle) updates.REAL_DEAL_FILTER_ACTIVE = realDealFilterToggle.checked;
    if (realDealMinVal) updates.REAL_DEAL_MIN_DISCOUNT = Math.max(5, Math.min(95, parseInt(realDealMinVal.value) || 30));
    if (sparklinesToggle) updates.ENABLE_SPARKLINES = sparklinesToggle.checked;

    updateConfigs(updates);
    showToast('Toppreise Suite Einstellungen gespeichert');
    closeModal();
  });
}

