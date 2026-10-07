/**
 * Suite Filter Toolbar Component
 * Manages the inline/floating contextual filter bar, quick filters,
 * deal thresholds, and scan progress.
 */

import { SELECTORS } from "../page/selectors.js";
import { CONFIG, updateConfig, weightText } from "../state/config.js";
import {
  cancelBestpreiseScan
} from "../scanner/scanner.js";
import { scanState } from "../state/store.js";
import { showToast } from "./toast.js";
import { triggerProcessListings } from "../page/adapter.js";

function getSuiteBarPlacement() {
  const bar = document.getElementById('tp-suite-filter-bar');
  const isSafe = el => el && !el.closest('.header, [class*="MainTopHead"], [class*="MainHead"], .f_filter_plugin, .filters, .filterBox, #tp-root, dialog');
  const targets = ['#Page_ListTopPriceReductionProducts', '#Page_ListTop100Products', '[id^="Page_List"]', '#Page_Browsing', '.f_browsingListContainer', '#Plugin_MixedBrowsingList', '.standardList', '#product-list'];
  for (const sel of targets) {
    const el = document.querySelector(sel);
    if (el?.parentElement && isSafe(el.parentElement) && el !== bar) return { container: el.parentElement, reference: el };
  }
  const containers = SELECTORS.layout.containers.map(sel => document.querySelector(sel)).filter(Boolean);
  for (const c of containers) {
    if (c && isSafe(c) && c !== bar) {
      let ref = c.firstElementChild;
      while (ref && (ref === bar || !isSafe(ref))) ref = ref.nextElementSibling;
      return { container: c, reference: ref || null };
    }
  }
  return { container: document.body, reference: document.body.firstElementChild };
}

// Tools dimmed when their mini-toggle is OFF (the toggle itself stays bright).
const DIM_TARGETS_BY_TOGGLE = {
  'tp-toggle-neg': ['.tp-input-field-box'],
  'tp-toggle-min': ['.tp-stepper-btn', '#tp-bar-min-val', '.tp-stepper-label'],
};
function syncMiniToggle(input, enabled, titleBase) {
  if (!input) return;
  input.checked = !!enabled;
  const label = input.closest?.('.tp-mini-switch');
  const title = `${titleBase} ${enabled ? 'AN' : 'AUS'}`;
  if (label) label.title = title;
  const state = label?.querySelector('.tp-mini-state');
  if (state) state.textContent = enabled ? 'ON' : 'OFF';
  const scope = input.closest?.('.tp-bar-stepper-group, .tp-threshold-wrapper, .tp-input-wrapper, .tp-group');
  const caption = scope?.querySelector('.tp-mini-caption');
  if (caption) caption.title = title;
  for (const sel of (DIM_TARGETS_BY_TOGGLE[input.id] || [])) {
    scope?.querySelectorAll(sel).forEach(node => node.classList.toggle('tp-tool-dim', !enabled));
  }
}


export function renderSuiteFilterBar(counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, bestpreiseHidden: 0 }, pageHasOffers = false, isDealFeed = false) {
  const placement = getSuiteBarPlacement();
  if (!placement?.container) return;

  let bar = document.getElementById('tp-suite-filter-bar');
  const isRevealed = document.body.classList.contains('tp-reveal-filtered');
  const totalHidden = (counts.neg || 0) + (counts.min || 0) + (counts.bestpreiseHidden || 0);
  const bestpreiseDeals = counts.bestpreiseDeals || 0;

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'tp-suite-filter-bar';
    if (CONFIG.BESTPREISE_MODE_ACTIVE) bar.classList.add('tp-bestpreise-bar');
    bar.innerHTML = `
      <div class="tp-filter-main-row">
       <div class="tp-group tp-group-filter" role="group" aria-label="Filter">
        <span class="tp-group-label" aria-hidden="true">Filter</span>
        <div class="tp-input-wrapper" title="Kommagetrennte Begriffe eingeben">
          <span class="tp-input-label-inline">🚫 Negativ-Filter:</span>
          <div class="tp-input-field-box">
            <input type="text" id="tp-inline-negative-input" placeholder="Wörter ausschließen..." value="${CONFIG.NEGATIVE_TERMS || ''}">
            <button id="tp-clear-neg-btn" title="Text leeren" style="display: ${CONFIG.NEGATIVE_TERMS ? 'block' : 'none'};">✕</button>
          </div>
          <label class="tp-mini-switch" title="Negativ-Filter (Text) ${CONFIG.FILTER_NEG_ENABLED ? 'AN' : 'AUS'}">
            <input type="checkbox" id="tp-toggle-neg" ${CONFIG.FILTER_NEG_ENABLED ? 'checked' : ''}>
            <span class="tp-mini-slider"></span>
            <span class="tp-mini-state">${CONFIG.FILTER_NEG_ENABLED ? 'ON' : 'OFF'}</span>
          </label>
        </div>
        <div class="tp-bar-stepper-group" id="tp-bar-min-offers-group" style="display: ${pageHasOffers ? 'flex' : 'none'};" title="Produkte mit weniger als N Angeboten ausblenden">
          <span class="tp-stepper-label">Min-Angebote:</span>
          <button class="tp-stepper-btn" id="tp-bar-min-minus">-</button>
          <span id="tp-bar-min-val" style="min-width: 14px; text-align: center;">${CONFIG.MIN_OFFERS}</span>
          <button class="tp-stepper-btn" id="tp-bar-min-plus">+</button>
          <span class="tp-mini-caption" title="Min-Angebote-Filter ${CONFIG.FILTER_MIN_ENABLED ? 'AN' : 'AUS'}">Aktiv</span>
          <label class="tp-mini-switch" title="Min-Angebote-Filter ${CONFIG.FILTER_MIN_ENABLED ? 'AN' : 'AUS'}">
            <input type="checkbox" id="tp-toggle-min" ${CONFIG.FILTER_MIN_ENABLED ? 'checked' : ''}>
            <span class="tp-mini-slider"></span>
            <span class="tp-mini-state">${CONFIG.FILTER_MIN_ENABLED ? 'ON' : 'OFF'}</span>
          </label>
        </div>
       </div>
       <span class="tp-divider" aria-hidden="true"></span>
       <div class="tp-group tp-group-view" role="group" aria-label="Ansicht">
        <span class="tp-group-label" aria-hidden="true">Ansicht</span>
        <button class="tp-bar-btn ${isRevealed ? 'tp-active' : ''}" id="tp-bar-reveal-btn" title="Durch Suite-Filter ausgeblendete Produkte anzeigen/verbergen (native Kategorie-Ausschlüsse bleiben aktiv)">
          👁️ <span id="tp-bar-reveal-count">${totalHidden}</span> <span class="tp-btn-sub">versteckt</span>
        </button>
        <button class="tp-bar-btn ${CONFIG.HEATMAP_ENABLED ? 'tp-active' : ''}" id="tp-bar-heat-btn" title="Heatmap: Karten- und Badge-Farbe folgt stets der angezeigten Badge-% — Tiefrot = grosser Tiefstpreis, Grau = kein Rabatt. Grau gestreift = ungeprüft (Differenz)." style="display: flex;">🔥 Heatmap</button>
       </div>
       <span class="tp-divider" aria-hidden="true"></span>
       <div class="tp-group tp-group-deals" role="group" aria-label="Tiefstpreise">
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'tp-bestpreise-active' : ''}" id="tp-bar-bestpreise-btn" title="Neue Tiefstpreise Modus: Verifizierte Tiefstpreise nach echtem Rabatt filtern und sortieren" style="display: ${isDealFeed ? 'flex' : 'none'};">
          💎 Neue Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>
        </button>
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_HIDE_UNCHECKED ? 'tp-active' : ''}" id="tp-bar-hide-unchecked-btn" title="Nur geprüfte anzeigen (ungeprüfte ausblenden)" style="display: flex;">👁️ Nur geprüfte</button>
        <div class="tp-threshold-wrapper" id="tp-bar-weight-wrapper" style="display: ${isDealFeed && CONFIG.BESTPREISE_MODE_ACTIVE ? 'inline-flex' : 'none'};" title="Reihenfolge + Farb-Emphase — Badge zeigt Rekord & Ø.">
          <span class="tp-weight-label" id="tp-bar-weight-label">⚖️ 50/50</span>
          <input type="range" id="tp-bar-weight-range" min="0" max="100" step="5" value="50" list="tp-bar-weight-ticks" title="Tiefstpreis-Gewichtung stufenlos: links Ø-Schnäppchen, rechts Rekord-Jagd">
          <datalist id="tp-bar-weight-ticks">
            <option value="0" label="Ø"></option>
            <option value="30"></option>
            <option value="50"></option>
            <option value="70"></option>
            <option value="100" label="Rek"></option>
          </datalist>
        </div>
       </div>
      </div>
    `;

    if (placement.reference && placement.reference.parentElement === placement.container && placement.reference !== bar) {
      placement.container.insertBefore(bar, placement.reference);
    } else {
      placement.container.appendChild(bar);
    }

    const input = bar.querySelector('#tp-inline-negative-input');
    const clearBtn = bar.querySelector('#tp-clear-neg-btn');

    input.onkeydown = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        input.blur();
      }
    };

    input.oninput = e => {
      updateConfig('NEGATIVE_TERMS', e.target.value);
    };

    clearBtn.onclick = () => {
      updateConfig('NEGATIVE_TERMS', '');
    };

    bar.querySelector('#tp-bar-reveal-btn').onclick = () => {
      document.body.classList.toggle('tp-reveal-filtered');
      triggerProcessListings();
    };

    bar.querySelector('#tp-bar-heat-btn').onclick = () => {
      const nextState = !CONFIG.HEATMAP_ENABLED;
      updateConfig('HEATMAP_ENABLED', nextState);
    };

    const bestpreiseToggleBtn = bar.querySelector('#tp-bar-bestpreise-btn');
    if (bestpreiseToggleBtn) {
      bestpreiseToggleBtn.onclick = () => {
        const next = !CONFIG.BESTPREISE_MODE_ACTIVE;
        cancelBestpreiseScan();
        updateConfig('BESTPREISE_MODE_ACTIVE', next);
        showToast(next ? '💎 Neue Tiefstpreise-Modus aktiviert' : 'Tiefstpreise-Modus deaktiviert');
      };
    }
    const hideUncheckedBtn = bar.querySelector('#tp-bar-hide-unchecked-btn');
    if (hideUncheckedBtn) {
      hideUncheckedBtn.onclick = () => {
        const next = !CONFIG.BESTPREISE_HIDE_UNCHECKED;
        updateConfig('BESTPREISE_HIDE_UNCHECKED', next);
        showToast(next ? '👁️ Nur geprüfte Deals werden angezeigt' : '👁️ Ungeprüfte Deals werden wieder angezeigt');
      };
    }


    // Weight slider: live label on drag, debounced config write (each write
    // re-sorts the feed), immediate flush + toast on release.
    const weightRange = bar.querySelector('#tp-bar-weight-range');
    const weightLabel = bar.querySelector('#tp-bar-weight-label');
    const readWeight = () => Math.max(0, Math.min(1, (parseInt(weightRange.value, 10) || 0) / 100));
    const paintWeightLabel = () => {
      if (!weightLabel) return;
      const w = readWeight();
      weightLabel.textContent = `⚖️ ${weightText(w, 'short')}`;
      weightLabel.title = weightText(w, 'title');
    };
    if (weightRange) {
      paintWeightLabel();
      weightRange.oninput = () => {
        paintWeightLabel();
        clearTimeout(window._tpWeightDeb);
        window._tpWeightDeb = setTimeout(() => {
          updateConfig('BESTPREISE_WEIGHT_RECORD', readWeight());
        }, 150);
      };
      weightRange.onchange = () => {
        clearTimeout(window._tpWeightDeb);
        const w = readWeight();
        paintWeightLabel();
        updateConfig('BESTPREISE_WEIGHT_RECORD', w);
        showToast(`Sortier-Gewichtung: ${Math.round((1 - w) * 100)}% Ø-Preis / ${Math.round(w * 100)}% Rekord (nur Feed-Reihenfolge)`);
      };
    }

    const updateMinOffers = delta => {
      const next = Math.max(0, CONFIG.MIN_OFFERS + delta);
      if (next !== CONFIG.MIN_OFFERS) {
        updateConfig('MIN_OFFERS', next);
      }
    };

    bar.querySelector('#tp-bar-min-minus').onclick = () => updateMinOffers(-1);
    bar.querySelector('#tp-bar-min-plus').onclick = () => updateMinOffers(1);
    const bindMiniToggle = (id, key, titleBase, onMsg, offMsg) => {
      const el = bar.querySelector('#' + id);
      if (!el) return;
      syncMiniToggle(el, CONFIG[key], titleBase);
      el.onchange = () => {
        updateConfig(key, el.checked);
        syncMiniToggle(el, el.checked, titleBase);
        showToast(el.checked ? onMsg : offMsg);
      };
    };
    bindMiniToggle('tp-toggle-neg', 'FILTER_NEG_ENABLED', 'Negativ-Filter (Text)', '📝 Negativ-Filter AN', '📝 Negativ-Filter AUS');
    bindMiniToggle('tp-toggle-min', 'FILTER_MIN_ENABLED', 'Min-Angebote-Filter', '🔢 Min-Angebote-Filter AN', '🔢 Min-Angebote-Filter AUS');
  } else if (bar.parentElement !== placement.container || (bar.nextSibling !== placement.reference && placement.reference !== bar)) {
    if (placement.reference && placement.reference.parentElement === placement.container && placement.reference !== bar) {
      placement.container.insertBefore(bar, placement.reference);
    } else {
      placement.container.appendChild(bar);
    }
  }

  bar.style.display = 'flex';
  bar.classList.toggle('tp-bestpreise-bar', CONFIG.BESTPREISE_MODE_ACTIVE === true);

  const input = bar.querySelector('#tp-inline-negative-input');
  const clearBtn = bar.querySelector('#tp-clear-neg-btn');
  if (input && document.activeElement !== input) {
    input.value = CONFIG.NEGATIVE_TERMS || '';
    if (clearBtn) clearBtn.style.display = CONFIG.NEGATIVE_TERMS ? 'block' : 'none';
  }

  bar.querySelector('#tp-bar-reveal-btn')?.classList.toggle('tp-active', isRevealed);
  const revealCount = bar.querySelector('#tp-bar-reveal-count');
  if (revealCount) revealCount.textContent = totalHidden > 0 ? `${totalHidden}` : '0';

  const heatBtn = bar.querySelector('#tp-bar-heat-btn');
  if (heatBtn) {
    heatBtn.classList.toggle('tp-active', CONFIG.HEATMAP_ENABLED !== false);
    heatBtn.style.setProperty('display', 'flex', 'important');
  }

  const bestpreiseBtn = bar.querySelector('#tp-bar-bestpreise-btn');
  if (bestpreiseBtn) {
    bestpreiseBtn.classList.toggle('tp-bestpreise-active', CONFIG.BESTPREISE_MODE_ACTIVE === true);
    bestpreiseBtn.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
    if (scanState.isBestpreiseScanning) {
      // Leave dynamic text during scan
    } else if (CONFIG.BESTPREISE_MODE_ACTIVE) {
      bestpreiseBtn.innerHTML = `💎 Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>`;
    } else {
      bestpreiseBtn.innerHTML = `💎 Neue Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>`;
    }
  }

  syncMiniToggle(bar.querySelector('#tp-toggle-neg'), CONFIG.FILTER_NEG_ENABLED, 'Negativ-Filter (Text)');
  syncMiniToggle(bar.querySelector('#tp-toggle-min'), CONFIG.FILTER_MIN_ENABLED, 'Min-Angebote-Filter');
  // Strictness lives in the Tiefstpreise mode now — no separate toggle to sync.

  const curWeight = typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number' ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50;
  const weightRange = bar.querySelector('#tp-bar-weight-range');
  // Skip while dragging: the input handler owns the label mid-drag.
  if (weightRange && document.activeElement !== weightRange) {
    weightRange.value = Math.round(curWeight * 100);
  }
  const weightLabel = bar.querySelector('#tp-bar-weight-label');
  if (weightLabel) {
    weightLabel.textContent = `⚖️ ${weightText(curWeight, 'short')}`;
    weightLabel.title = weightText(curWeight, 'title');
  }
  const weightWrapper = bar.querySelector('#tp-bar-weight-wrapper');
  if (weightWrapper) {
    weightWrapper.style.setProperty('display', (isDealFeed && CONFIG.BESTPREISE_MODE_ACTIVE) ? 'inline-flex' : 'none', 'important');
  }

  const minGroup = bar.querySelector('#tp-bar-min-offers-group');
  if (minGroup) minGroup.style.display = pageHasOffers ? 'flex' : 'none';
  const minVal = bar.querySelector('#tp-bar-min-val');
  if (minVal) minVal.textContent = CONFIG.MIN_OFFERS;
}
