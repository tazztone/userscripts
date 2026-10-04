/**
 * Suite Filter Toolbar Component
 * Manages the inline/floating contextual filter bar, quick filters,
 * deal thresholds, and scan progress.
 */

import { SELECTORS } from "../page/selectors.js";
import { CONFIG, updateConfig } from "../state/config.js";
import {
  cancelBestpreiseScan
} from "../scanner/scanner.js";
import { getScanState } from "../state/store.js";
import { showToast } from "./toast.js";
import { triggerProcessListings } from "../page/adapter.js";

export function getSuiteBarPlacement() {
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

export function renderSuiteFilterBar(counts = { neg: 0, min: 0, nonBest: 0, uncheckedDeals: 0, bestpreiseDeals: 0 }, pageHasOffers = false, isDealFeed = false) {
  const placement = getSuiteBarPlacement();
  if (!placement?.container) return;

  let bar = document.getElementById('tp-suite-filter-bar');
  const isRevealed = document.body.classList.contains('tp-reveal-filtered');
  const totalHidden = (counts.neg || 0) + (counts.min || 0) + (counts.nonBest || 0) + (counts.bestpreiseHidden || 0);
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
        <button class="tp-bar-btn ${CONFIG.HEATMAP_ENABLED ? 'tp-active' : ''}" id="tp-bar-heat-btn" title="Heatmap: Karten- und Badge-Farbe folgt stets der angezeigten Badge-% — Tiefrot = grosser Tiefstpreis, Grau = kein Rabatt. Blasse Farben = ungeprüft (Differenz)." style="display: flex;">🔥 Heatmap</button>
       </div>
       <span class="tp-divider" aria-hidden="true"></span>
       <div class="tp-group tp-group-deals" role="group" aria-label="Tiefstpreise">
        <span class="tp-group-label" aria-hidden="true">Tiefstpreise</span>
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'tp-bestpreise-active' : ''}" id="tp-bar-bestpreise-btn" title="Neue Tiefstpreise Modus: Verifizierte Tiefstpreise nach echtem Rabatt filtern und sortieren" style="display: ${isDealFeed ? 'flex' : 'none'};">
          💎 Neue Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>
        </button>
        <div class="tp-threshold-wrapper" id="tp-bar-weight-wrapper" style="display: ${isDealFeed && CONFIG.BESTPREISE_MODE_ACTIVE ? 'inline-flex' : 'none'};">
          <button class="tp-threshold-btn" id="tp-bar-weight-btn" title="Gewichtung für den Tiefstpreise-Feed (Reihenfolge + Farb-Emphase: Rekord- oder Ø-Rabatt — Badge zeigt stets beide Zahlen)" style="border-left: 1px solid rgba(255, 255, 255, 0.12) !important; border-radius: 8px !important;">
            ⚖️ 50/50 ▾
          </button>
          <div class="tp-threshold-popover" id="tp-weight-popover" style="min-width: 210px;">
            <div class="tp-threshold-hint">Reihenfolge + Farb-Emphase — Badge zeigt Rekord & Ø.</div>
            <button class="tp-threshold-option" data-weight="0.50" title="Rekord-Rabatt und Ø-Ersparnis zählen je zur Hälfte">⚖️ Ausgewogen (je 50%)</button>
            <button class="tp-threshold-option" data-weight="1.00" title="Frisch gefallene Preise stehen zuerst, egal wie gross die Ø-Ersparnis ist">🔥 Rekord-Jagd (frische Tiefs zuerst)</button>
            <button class="tp-threshold-option" data-weight="0.70" title="Neue Tiefs stehen weiter oben (70% Rekord / 30% Ø-Preis)">📈 Rekord-lastig (70/30)</button>
            <button class="tp-threshold-option" data-weight="0.30" title="Grösste Ersparnis vs üblich steht weiter oben (30% Rekord / 70% Ø-Preis)">📉 Ø-lastig (30/70)</button>
            <button class="tp-threshold-option" data-weight="0.00" title="Grösste Ersparnis gegenüber dem üblichen Preis steht zuerst">💎 Ø-Schnäppchen (grösstes Ø-Minus zuerst)</button>
          </div>
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


    const weightBtn = bar.querySelector('#tp-bar-weight-btn');
    const weightPopover = bar.querySelector('#tp-weight-popover');

    if (weightBtn && weightPopover) {
      weightBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = weightPopover.classList.toggle('tp-show');
        weightBtn.classList.toggle('tp-open', isOpen);
      };

      weightPopover.querySelectorAll('.tp-threshold-option').forEach(opt => {
        opt.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          const w = parseFloat(opt.dataset.weight);
          if (!isNaN(w)) {
            weightPopover.classList.remove('tp-show');
            weightBtn.classList.remove('tp-open');
            updateConfig('BESTPREISE_WEIGHT_RECORD', w);
            showToast(`Sortier-Gewichtung: ${Math.round((1 - w) * 100)}% Ø-Preis / ${Math.round(w * 100)}% Rekord (nur Feed-Reihenfolge)`);
          }
        };
      });
    }

    if (!window._tpDocClickBound) {
      window._tpDocClickBound = true;
      document.addEventListener('click', () => {
        document.getElementById('tp-weight-popover')?.classList.remove('tp-show');
        document.getElementById('tp-bar-weight-btn')?.classList.remove('tp-open');
      });
    }

    const updateMinOffers = delta => {
      const next = Math.max(0, CONFIG.MIN_OFFERS + delta);
      if (next !== CONFIG.MIN_OFFERS) {
        updateConfig('MIN_OFFERS', next);
      }
    };

    bar.querySelector('#tp-bar-min-minus').onclick = () => updateMinOffers(-1);
    bar.querySelector('#tp-bar-min-plus').onclick = () => updateMinOffers(1);
    const syncMiniToggle = (input, enabled, titleBase) => {
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
    };
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
    if (getScanState().isBestpreiseScanning) {
      // Leave dynamic text during scan
    } else if (CONFIG.BESTPREISE_MODE_ACTIVE) {
      bestpreiseBtn.innerHTML = `💎 Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>`;
    } else {
      bestpreiseBtn.innerHTML = `💎 Neue Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>`;
    }
  }

  const syncBarMiniToggle = (id, enabled, titleBase) => {
    const el = bar.querySelector('#' + id);
    if (!el) return;
    el.checked = !!enabled;
    const title = `${titleBase} ${enabled ? 'AN' : 'AUS'}`;
    const label = el.closest?.('.tp-mini-switch');
    if (label) label.title = title;
    const state = label?.querySelector('.tp-mini-state');
    if (state) state.textContent = enabled ? 'ON' : 'OFF';
    const scope = el.closest?.('.tp-bar-stepper-group, .tp-threshold-wrapper, .tp-input-wrapper, .tp-group');
    const caption = scope?.querySelector('.tp-mini-caption');
    if (caption) caption.title = title;
    // OFF dims the tool the toggle belongs to (input/stepper stay editable).
    const dimTargets = DIM_TARGETS_BY_TOGGLE[id] || [];
    for (const sel of dimTargets) {
      scope?.querySelectorAll(sel).forEach(node => node.classList.toggle('tp-tool-dim', !enabled));
    }
  };
  syncBarMiniToggle('tp-toggle-neg', CONFIG.FILTER_NEG_ENABLED, 'Negativ-Filter (Text)');
  syncBarMiniToggle('tp-toggle-min', CONFIG.FILTER_MIN_ENABLED, 'Min-Angebote-Filter');
  // Strictness lives in the Tiefstpreise mode now — no separate toggle to sync.

  const threshWrapper = bar.querySelector('#tp-bar-threshold-wrapper');
  if (threshWrapper) {
    threshWrapper.style.setProperty('display', 'inline-flex', 'important');
  }

  const curWeight = typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number' ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50;
  let curWeightShort = '50/50';
  if (Math.abs(curWeight - 1.0) < 0.05) curWeightShort = '100% Rek';
  else if (Math.abs(curWeight - 0.70) < 0.05) curWeightShort = '70/30';
  else if (Math.abs(curWeight - 0.50) < 0.05) curWeightShort = '50/50';
  else if (Math.abs(curWeight - 0.30) < 0.05) curWeightShort = '30/70';
  else if (Math.abs(curWeight - 0.0) < 0.05) curWeightShort = '100% Med';
  else curWeightShort = `${Math.round(curWeight * 100)}% Rek`;

  const weightBtn = bar.querySelector('#tp-bar-weight-btn');
  if (weightBtn) {
    weightBtn.textContent = `⚖️ ${curWeightShort} ▾`;
    weightBtn.title = `Gewichtung für den Tiefstpreise-Feed (Reihenfolge + Farb-Emphase, aktuell: ${Math.round((1 - curWeight) * 100)}% Ø-Preis / ${Math.round(curWeight * 100)}% Rekord — Badge zeigt stets beide Zahlen)`;
  }
  const weightPopover = bar.querySelector('#tp-weight-popover');
  if (weightPopover) {
    weightPopover.querySelectorAll('.tp-threshold-option').forEach(opt => {
      const w = parseFloat(opt.dataset.weight);
      opt.classList.toggle('tp-selected', Math.abs(w - curWeight) < 0.05);
    });
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
