/**
 * Suite Filter Toolbar Component
 * Manages the inline/floating contextual filter bar, quick filters,
 * deal thresholds, and scan progress.
 */

import { SELECTORS } from "../page/selectors.js";
import { CONFIG, updateConfig, weightText, horizonText, clampMinPoints, minPointsToIndex, minPointsFromIndex, MIN_POINTS_STEPS, paintMinPoints } from "../state/config.js";
import {
  cancelBestpreiseScan
} from "../scanner/scanner.js";
import { recomputeCachedMedians } from "../scanner/cache.js";
import { scanState } from "../state/store.js";
import { showToast } from "./toast.js";
import { setTextIfChanged } from "./badges.js";
import { triggerProcessListings } from "../page/adapter.js";
import { syncMiniToggle } from "./mini-toggle.js";

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

function bindBestpreiseBtn(btn) {
  btn.onclick = () => {
    const next = !CONFIG.BESTPREISE_MODE_ACTIVE;
    cancelBestpreiseScan();
    updateConfig('BESTPREISE_MODE_ACTIVE', next);
    showToast(next ? '💎 Neue Tiefstpreise-Modus aktiviert' : 'Tiefstpreise-Modus deaktiviert');
  };
}


function bindWeightControls(wrapper) {
  const weightRange = wrapper.querySelector('#tp-bar-weight-range');
  const weightLabel = wrapper.querySelector('#tp-bar-weight-label');
  if (!weightRange) return;
  const readWeight = () => Math.max(0, Math.min(1, (parseInt(weightRange.value, 10) || 0) / 100));
  const paintWeightLabel = () => {
    if (!weightLabel) return;
    const w = readWeight();
    weightLabel.textContent = `⚖️ ${weightText(w, 'short')}`;
    weightLabel.title = weightText(w, 'title');
  };
  paintWeightLabel();
  let deb;
  weightRange.oninput = () => {
    paintWeightLabel();
    clearTimeout(deb);
    deb = setTimeout(() => {
      updateConfig('BESTPREISE_WEIGHT_RECORD', readWeight());
    }, 1000);
  };
  weightRange.onchange = () => {
    clearTimeout(deb);
    const w = readWeight();
    paintWeightLabel();
    updateConfig('BESTPREISE_WEIGHT_RECORD', w);
    showToast(`Sortier-Gewichtung: ${Math.round((1 - w) * 100)}% Ø-Preis / ${Math.round(w * 100)}% Rekord (Reihenfolge + Farb-Emphase)`);
  };
}


function buildWeightWrapper() {
  const wrapper = document.createElement('div');
  wrapper.className = 'tp-threshold-wrapper';
  wrapper.id = 'tp-bar-weight-wrapper';
  wrapper.title = 'Reihenfolge + Farb-Emphase — Badge zeigt die Gewichtete Differenz.';
  wrapper.innerHTML = `
    <span class="tp-weight-label" id="tp-bar-weight-label">⚖️ 50/50</span>
    <input type="range" id="tp-bar-weight-range" min="0" max="100" step="5" value="50" list="tp-bar-weight-ticks" title="Tiefstpreis-Gewichtung stufenlos: links Ø-Schnäppchen, rechts Rekord-Jagd">
    <datalist id="tp-bar-weight-ticks">
      <option value="0" label="Ø"></option>
      <option value="30"></option>
      <option value="50"></option>
      <option value="70"></option>
      <option value="100" label="Rek"></option>
    </datalist>`;
  bindWeightControls(wrapper);
  return wrapper;
}

function bindMinPointsControls(wrapper) {
  if (!wrapper) return;
  const range = wrapper.querySelector('#tp-bar-minpoints-range');
  const label = wrapper.querySelector('#tp-bar-minpoints-label');
  if (!range) return;
  const readNum = () => minPointsFromIndex(range.value);
  const paint = () => { if (label) label.textContent = `📊 ${readNum()} Pkt`; };
  paint();
  let deb;
  range.oninput = () => {
    paint();
    clearTimeout(deb);
    deb = setTimeout(() => updateConfig('BESTPREISE_MIN_POINTS', readNum()), 1000);
  };
  range.onchange = () => {
    clearTimeout(deb);
    const n = readNum();
    paint();
    updateConfig('BESTPREISE_MIN_POINTS', n);
    showToast(`Mindestanzahl Datenpunkte in der Preishistorie: ${n} (≈ Tage)`);
  };
}

function buildMinPointsWrapper() {
  const cur = clampMinPoints(CONFIG.BESTPREISE_MIN_POINTS);
  const wrapper = document.createElement('div');
  wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
  wrapper.id = 'tp-bar-minpoints-wrapper';
  wrapper.title = 'Mindestanzahl Datenpunkte in der Preishistorie für den Ø-Vergleich (Punkte ≈ Tage). Darunter kein Blend — Karte wird Fallback-Tief.';
  wrapper.innerHTML = `
    <span class="tp-weight-label" id="tp-bar-minpoints-label">📊 ${cur} Pkt</span>
    <input type="range" id="tp-bar-minpoints-range" min="0" max="${MIN_POINTS_STEPS.length - 1}" step="1" value="${minPointsToIndex(cur)}" title="Mindestanzahl Datenpunkte: 1–5 fein, dann 10er-Schritte bis 100">`;
  bindMinPointsControls(wrapper);
  return wrapper;
}

function bindHorizonControls(wrapper) {
  if (!wrapper) return;
  const range = wrapper.querySelector('#tp-bar-horizon-range');
  const label = wrapper.querySelector('#tp-bar-horizon-label');
  if (!range) return;
  const readHorizon = () => {
    const raw = parseInt(range.value, 10);
    return isNaN(raw) ? 365 : (raw > 730 ? 0 : raw);
  };
  const paintHorizonLabel = () => {
    if (!label) return;
    const v = readHorizon();
    label.textContent = horizonText(v);
    label.title = horizonText(v, 'title');
  };
  paintHorizonLabel();
  let deb;
  range.oninput = () => {
    paintHorizonLabel();
    clearTimeout(deb);
    deb = setTimeout(() => {
      const v = readHorizon();
      recomputeCachedMedians(v);
      updateConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', v);
    }, 1000);
  };
  range.onchange = () => {
    clearTimeout(deb);
    const v = readHorizon();
    paintHorizonLabel();
    recomputeCachedMedians(v);
    updateConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', v);
    showToast(`Ø-Vergleichszeitraum: ${horizonText(v)} — live aktualisiert`);
  };
}

function buildHorizonWrapper() {
  const cur = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365;
  const wrapper = document.createElement('div');
  wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
  wrapper.id = 'tp-bar-horizon-wrapper';
  wrapper.title = 'Median-Berechnungszeitraum für den Ø-Preis (Duplikat der Modal-Einstellung). Wechsel rechnet gecachte Mediane lokal neu — ohne Netz.';
  wrapper.innerHTML = `
    <span class="tp-stepper-label">Ø-Zeitraum</span>
    <span class="tp-weight-label" id="tp-bar-horizon-label" title="${horizonText(cur, 'title')}">${horizonText(cur)}</span>
    <input type="range" id="tp-bar-horizon-range" min="30" max="760" step="30" value="${cur === 0 ? 760 : cur}" title="${horizonText(cur, 'title')}">`;
  bindHorizonControls(wrapper);
  return wrapper;
}


function placeBar(bar, placement) {
  if (placement.reference && placement.reference.parentElement === placement.container && placement.reference !== bar) {
    placement.container.insertBefore(bar, placement.reference);
  } else {
    placement.container.appendChild(bar);
  }
}

export function renderSuiteFilterBar(counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, vortief: 0, uncheckedHidden: 0, dealer: 0, filteredCount: 0 }, pageHasOffers = false, isDealFeed = false) {
  const placement = getSuiteBarPlacement();
  if (!placement?.container) return;

  let bar = document.getElementById('tp-suite-filter-bar');
  const bestpreiseDeals = counts.bestpreiseDeals || 0;
  const negHidden = counts.neg || 0;
  const minHidden = counts.min || 0;
  const vortiefHidden = counts.vortief || 0;
  const uncheckedHiddenCount = counts.uncheckedHidden || 0;
  const dealerHidden = counts.dealer || 0;

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'tp-suite-filter-bar';
    if (CONFIG.BESTPREISE_MODE_ACTIVE) bar.classList.add('tp-bestpreise-bar');
    bar.innerHTML = `
      <div class="tp-filter-main-row">
      <div class="tp-group tp-group-filter" role="group" aria-label="Filtergründe">
        <div class="tp-input-wrapper" title="Kommagetrennte Begriffe eingeben">
          <div class="tp-input-field-box">
            <input type="text" id="tp-inline-negative-input" aria-label="Negativ-Filter" placeholder="Wörter ausschließen..." value="">
            <button id="tp-clear-neg-btn" title="Text leeren" style="display: ${CONFIG.NEGATIVE_TERMS ? 'block' : 'none'};">✕</button>
          </div>
          <label class="tp-mini-switch" title="Negativ-Filter (Text) ${CONFIG.FILTER_NEG_ENABLED ? 'AN' : 'AUS'}">
            <input type="checkbox" id="tp-toggle-neg" ${CONFIG.FILTER_NEG_ENABLED ? 'checked' : ''}>
            <span class="tp-mini-slider"></span>
            <span class="tp-mini-state">${CONFIG.FILTER_NEG_ENABLED ? 'ON' : 'OFF'}</span>
          </label>
        </div>
        <button class="tp-bar-btn" id="tp-bar-reveal-all" title="Gefilterte anzeigen — klicken zum Ein-/Ausblenden">👁️ Gefilterte (0)</button>
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_HIDE_UNCHECKED ? 'tp-active' : ''}" id="tp-bar-unchecked-btn" title="✓ Nur geprüfte: ungeprüfte filtern (Filtergrund, entfernt)">✓ Nur geprüfte</button>
        <div class="tp-bar-stepper-group" id="tp-bar-min-offers-group" style="display: ${pageHasOffers ? 'flex' : 'none'};" title="Produkte mit weniger als N Angeboten filtern (entfernt)">
          <span class="tp-stepper-label">Min-Angebote:</span>
          <button class="tp-stepper-btn" id="tp-bar-min-minus">-</button>
          <span id="tp-bar-min-val" style="min-width: 14px; text-align: center;">${CONFIG.MIN_OFFERS}</span>
          <button class="tp-stepper-btn" id="tp-bar-min-plus">+</button>
          <label class="tp-mini-switch" title="Min-Angebote-Filter ${CONFIG.FILTER_MIN_ENABLED ? 'AN' : 'AUS'}">
            <input type="checkbox" id="tp-toggle-min" ${CONFIG.FILTER_MIN_ENABLED ? 'checked' : ''}>
            <span class="tp-mini-slider"></span>
            <span class="tp-mini-state">${CONFIG.FILTER_MIN_ENABLED ? 'ON' : 'OFF'}</span>
          </label>
        </div>
       </div>
       <span class="tp-divider" aria-hidden="true"></span>
      <div class="tp-group tp-group-view" role="group" aria-label="Ansicht">
        <button class="tp-bar-btn ${CONFIG.HEATMAP_ENABLED ? 'tp-active' : ''}" id="tp-bar-heat-btn" title="Heatmap: Karten- und Badge-Farbe folgt stets der angezeigten Badge-% — Tiefrot = grosser Tiefstpreis, Grau = kein Rabatt. Grau gestreift = ungeprüft (Differenz)." style="display: flex;">🔥 Heatmap</button>
       </div>
       <span class="tp-divider" aria-hidden="true"></span>
      <div class="tp-group tp-group-deals" role="group" aria-label="Sortieren">
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'tp-bestpreise-active' : ''}" id="tp-bar-bestpreise-btn" title="Neue Tiefstpreise Modus: Verifizierte Tiefstpreise nach echtem Rabatt sortieren (filtert nichts)" style="display: ${isDealFeed ? 'flex' : 'none'};">
          💎 Neue Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>
        </button>
       </div>
      </div>
    `;
    // Deal sliders built once via builders below (no duplicated markup).
    bar.querySelector('.tp-group-deals')?.append(buildWeightWrapper(), buildHorizonWrapper(), buildMinPointsWrapper());

    placeBar(bar, placement);

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

    bar.querySelector('#tp-bar-reveal-all').onclick = () => {
      document.body.classList.toggle('tp-reveal-all');
      triggerProcessListings();
    };
    bar.querySelector('#tp-bar-unchecked-btn').onclick = () => {
      const next = CONFIG.BESTPREISE_HIDE_UNCHECKED !== true;
      updateConfig('BESTPREISE_HIDE_UNCHECKED', next);
      showToast(next ? '✓ Nur geprüfte filtern aktiv (Filtergrund, entfernt)' : '✓ Nur geprüfte aus — ungeprüfte werden wieder angezeigt');
};

    bar.querySelector('#tp-bar-heat-btn').onclick = () => {
      const nextState = !CONFIG.HEATMAP_ENABLED;
      updateConfig('HEATMAP_ENABLED', nextState);
    };

    const bestpreiseToggleBtn = bar.querySelector('#tp-bar-bestpreise-btn');
    if (bestpreiseToggleBtn) bindBestpreiseBtn(bestpreiseToggleBtn);


    // Weight slider: live label on drag, debounced config write (each write
    // re-sorts the feed), immediate flush + toast on release.
    const weightWrapperInit = bar.querySelector('#tp-bar-weight-wrapper');
    if (weightWrapperInit) bindWeightControls(weightWrapperInit);

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
    bindMinPointsControls(bar.querySelector('#tp-bar-minpoints-wrapper'));
  } else if (bar.parentElement !== placement.container || (bar.nextSibling !== placement.reference && placement.reference !== bar)) {
    placeBar(bar, placement);
  }

  bar.style.display = 'flex';
  bar.classList.toggle('tp-bestpreise-bar', CONFIG.BESTPREISE_MODE_ACTIVE === true);

  const input = bar.querySelector('#tp-inline-negative-input');
  const clearBtn = bar.querySelector('#tp-clear-neg-btn');
  if (input && document.activeElement !== input) {
    input.value = CONFIG.NEGATIVE_TERMS || '';
    if (clearBtn) clearBtn.style.display = CONFIG.NEGATIVE_TERMS ? 'block' : 'none';
  }

  const hiddenTotal = counts.filteredCount || 0;
  const revealAllBtn = bar.querySelector('#tp-bar-reveal-all');
  if (revealAllBtn) {
    setTextIfChanged(revealAllBtn, `👁️ Gefilterte (${hiddenTotal})`);
    revealAllBtn.classList.toggle('tp-active', document.body.classList.contains('tp-reveal-all'));
    revealAllBtn.setAttribute('aria-pressed', String(document.body.classList.contains('tp-reveal-all')));
    revealAllBtn.classList.toggle('tp-tool-dim', hiddenTotal === 0);
    revealAllBtn.title = `Gefilterte (${hiddenTotal}) — Neg:${negHidden} Min:${minHidden} Händler:${dealerHidden} Fallback:${vortiefHidden} Ungeprüft:${uncheckedHiddenCount} — klicken zum Ein-/Ausblenden`;
  }

  const heatBtn = bar.querySelector('#tp-bar-heat-btn');
  if (heatBtn) {
    heatBtn.classList.toggle('tp-active', CONFIG.HEATMAP_ENABLED !== false);
    heatBtn.setAttribute('aria-pressed', String(CONFIG.HEATMAP_ENABLED !== false));
    heatBtn.style.setProperty('display', 'flex', 'important');
  }
  const uncheckedBtn = bar.querySelector('#tp-bar-unchecked-btn');
  if (uncheckedBtn) {
    uncheckedBtn.classList.toggle('tp-active', CONFIG.BESTPREISE_HIDE_UNCHECKED === true);
    uncheckedBtn.setAttribute('aria-pressed', String(CONFIG.BESTPREISE_HIDE_UNCHECKED === true));
    uncheckedBtn.title = CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? '✓ Nur geprüfte aktiv — klicken zum Aufheben (Filtergrund, entfernt)' : '✓ Nur geprüfte: ungeprüfte filtern (Filtergrund, entfernt)';
  }


  const bestpreiseBtn = document.getElementById('tp-bar-bestpreise-btn');
  if (bestpreiseBtn) {
    bestpreiseBtn.classList.toggle('tp-bestpreise-active', CONFIG.BESTPREISE_MODE_ACTIVE === true);
    bestpreiseBtn.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
    if (!scanState.isBestpreiseScanning) {
      bestpreiseBtn.innerHTML = `💎 ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'Tiefstpreise' : 'Neue Tiefstpreise'} <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>`;
    }
  }

  syncMiniToggle(bar.querySelector('#tp-toggle-neg'), CONFIG.FILTER_NEG_ENABLED, 'Negativ-Filter (Text)');
  syncMiniToggle(bar.querySelector('#tp-toggle-min'), CONFIG.FILTER_MIN_ENABLED, 'Min-Angebote-Filter');
  // Strictness lives in the Tiefstpreise mode now — no separate toggle to sync.

  const curWeight = typeof CONFIG.BESTPREISE_WEIGHT_RECORD === 'number' ? CONFIG.BESTPREISE_WEIGHT_RECORD : 0.50;
  const weightRange = document.getElementById('tp-bar-weight-range');
  // Skip while dragging: the input handler owns the label mid-drag.
  if (weightRange && document.activeElement !== weightRange) {
    weightRange.value = Math.round(curWeight * 100);
  }
  const weightLabel = document.getElementById('tp-bar-weight-label');
  if (weightLabel) {
    weightLabel.textContent = `⚖️ ${weightText(curWeight, 'short')}`;
    weightLabel.title = weightText(curWeight, 'title');
  }
  const weightWrapper = document.getElementById('tp-bar-weight-wrapper');
  if (weightWrapper) {
    weightWrapper.style.setProperty('display', (isDealFeed && CONFIG.BESTPREISE_MODE_ACTIVE) ? 'inline-flex' : 'none', 'important');
  }
  paintMinPoints();
  const minPointsWrapper = document.getElementById('tp-bar-minpoints-wrapper');
  if (minPointsWrapper) {
    minPointsWrapper.style.setProperty('display', (isDealFeed && CONFIG.BESTPREISE_MODE_ACTIVE) ? 'inline-flex' : 'none', 'important');
  }
  const horizonRange = document.getElementById('tp-bar-horizon-range');
  if (horizonRange && document.activeElement !== horizonRange) {
    const stored = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365;
    horizonRange.value = stored === 0 ? 760 : stored;
    const horizonLabel = document.getElementById('tp-bar-horizon-label');
    if (horizonLabel) {
      horizonLabel.textContent = horizonText(stored);
      horizonLabel.title = horizonText(stored, 'title');
    }
  }
  const horizonWrapper = document.getElementById('tp-bar-horizon-wrapper');
  if (horizonWrapper) {
    horizonWrapper.style.setProperty('display', (isDealFeed && CONFIG.BESTPREISE_MODE_ACTIVE) ? 'inline-flex' : 'none', 'important');
  }
  // A group left without visible children (option-less groups on catalog pages) hides; a divider shows only between two visible groups.
  for (const group of bar.querySelectorAll('.tp-group')) {
    const hasVisibleChild = [...group.children].some(el => el.style.display !== 'none');
    // Plain inline style loses to .tp-group{display:inline-flex !important} — use priority.
    if (hasVisibleChild) group.style.display = '';
    else group.style.setProperty('display', 'none', 'important');
  }
  for (const sep of bar.querySelectorAll('.tp-divider')) {
    let prev = sep.previousElementSibling;
    while (prev && !prev.classList.contains('tp-group')) prev = prev.previousElementSibling;
    let next = sep.nextElementSibling;
    while (next && !next.classList.contains('tp-group')) next = next.nextElementSibling;
    const between = !!prev && !!next && prev.style.display !== 'none' && next.style.display !== 'none';
    sep.style.display = between ? '' : 'none';
  }

  const minGroup = bar.querySelector('#tp-bar-min-offers-group');
  if (minGroup) minGroup.style.display = pageHasOffers ? 'flex' : 'none';
  const minVal = bar.querySelector('#tp-bar-min-val');
  if (minVal) minVal.textContent = CONFIG.MIN_OFFERS;
}
