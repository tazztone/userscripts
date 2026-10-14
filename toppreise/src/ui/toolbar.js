/**
 * Suite Filter Toolbar Component
 * Manages the inline/floating contextual filter bar, quick filters,
 * deal thresholds, and scan progress.
 */

import { SELECTORS } from "../page/selectors.js";
import { CONFIG, updateConfig, updateConfigs, weightText, horizonText, clampMinPoints, minPointsToIndex, minPointsFromIndex, MIN_POINTS_STEPS, paintMinPoints } from "../state/config.js";
import { recomputeCachedMedians } from "../scanner/cache.js";
import { triggerProcessListings } from "../page/adapter.js";
import { showToast } from "./toast.js";
import { buildCalcPreview, refreshCalcPreview } from "./calc-preview.js";
import { setTextIfChanged } from "./badges.js";
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
    <span class="tp-stepper-label">Gewichtung</span>
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
    <span class="tp-stepper-label">Mindestpunkte</span>
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

function bindOutlierControls(wrapper) {
  const toggle = wrapper.querySelector('#tp-bar-outlier-toggle');
  if (!toggle) return;
  syncMiniToggle(toggle, CONFIG.OUTLIER_REJECTION_ENABLED !== false, 'Ausreißer-Filter');
  paintOutlierDim();
  toggle.onchange = () => {
    const v = toggle.checked;
    updateConfig('OUTLIER_REJECTION_ENABLED', v, { skipRender: true });
    recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
    triggerProcessListings();
    syncMiniToggle(toggle, toggle.checked, 'Ausreißer-Filter');
    paintOutlierDim();
    showToast(toggle.checked ? 'Ausreißer-Filter AN — Glitches werden ignoriert' : 'Ausreißer-Filter AUS — Rohhistorie wird verwendet');
  };
}

function buildOutlierWrapper() {
  const wrapper = document.createElement('div');
  wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
  wrapper.id = 'tp-bar-outlier-wrapper';
  wrapper.title = 'Kurze Preissprünge (Band und Fenster unten einstellbar) als Feed-Glitches ignorieren. AUS = Rohhistorie verwenden.';
  wrapper.innerHTML = `
    <label class="tp-mini-switch" title="Ausreißer-Filter">
      <input type="checkbox" id="tp-bar-outlier-toggle" ${CONFIG.OUTLIER_REJECTION_ENABLED !== false ? 'checked' : ''}>
      <span class="tp-mini-slider"></span>
    </label>
    <span class="tp-weight-label" id="tp-bar-outlier-label">🧹 Ausreißer filtern</span>`;
  bindOutlierControls(wrapper);
  return wrapper;
}

function paintOutlierDim() {
  const dim = CONFIG.OUTLIER_REJECTION_ENABLED === false;
  for (const id of ['tp-bar-outlier-band-wrapper', 'tp-bar-outlier-hours-wrapper']) {
    const wrap = document.getElementById(id);
    if (wrap) wrap.classList.toggle('tp-tool-dim', dim);
  }
}

function bindOutlierBandControls(wrapper) {
  if (!wrapper) return;
  const range = wrapper.querySelector('#tp-bar-outlier-band-range');
  const label = wrapper.querySelector('#tp-bar-outlier-band-label');
  if (!range) return;
  const readBandPct = () => {
    const raw = parseInt(range.value, 10);
    return isNaN(raw) ? 60 : Math.min(90, Math.max(20, raw));
  };
  const paintBandLabel = () => { if (label) label.textContent = `±${readBandPct()} %`; };
  paintBandLabel();
  let deb;
  range.oninput = () => {
    paintBandLabel();
    clearTimeout(deb);
    deb = setTimeout(() => {
      const pct = readBandPct();
      updateConfig('OUTLIER_DEVIATION_BAND', pct / 100, { skipRender: true });
      recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      triggerProcessListings();
    }, 1000);
  };
  range.onchange = () => {
    clearTimeout(deb);
    const pct = readBandPct();
    paintBandLabel();
    updateConfig('OUTLIER_DEVIATION_BAND', pct / 100, { skipRender: true });
    recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
    triggerProcessListings();
    showToast(`Ausreißer-Band: ±${pct} % — live aktualisiert`);
  };
}

function buildOutlierBandWrapper() {
  const cur = typeof CONFIG.OUTLIER_DEVIATION_BAND === 'number' ? Math.round(CONFIG.OUTLIER_DEVIATION_BAND * 100) : 60;
  const wrapper = document.createElement('div');
  wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
  wrapper.id = 'tp-bar-outlier-band-wrapper';
  wrapper.title = 'Abweichung vom Median, ab der ein kurzer Sprung als Glitch gilt.';
  wrapper.innerHTML = `
    <span class="tp-stepper-label">Glitch-Band</span>
    <span class="tp-weight-label" id="tp-bar-outlier-band-label">±${cur} %</span>
    <input type="range" id="tp-bar-outlier-band-range" min="20" max="90" step="5" value="${cur}" title="Abweichung vom Median, ab der ein kurzer Sprung als Glitch gilt.">`;
  bindOutlierBandControls(wrapper);
  return wrapper;
}

function bindOutlierHoursControls(wrapper) {
  if (!wrapper) return;
  const range = wrapper.querySelector('#tp-bar-outlier-hours-range');
  const label = wrapper.querySelector('#tp-bar-outlier-hours-label');
  if (!range) return;
  const readHours = () => {
    const raw = parseInt(range.value, 10);
    return isNaN(raw) ? 48 : Math.min(168, Math.max(12, raw));
  };
  const paintHoursLabel = () => { if (label) label.textContent = `${readHours()} h`; };
  paintHoursLabel();
  let deb;
  range.oninput = () => {
    paintHoursLabel();
    clearTimeout(deb);
    deb = setTimeout(() => {
      const hrs = readHours();
      updateConfig('OUTLIER_MAX_GLITCH_HOURS', hrs, { skipRender: true });
      recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      triggerProcessListings();
    }, 1000);
  };
  range.onchange = () => {
    clearTimeout(deb);
    const hrs = readHours();
    paintHoursLabel();
    updateConfig('OUTLIER_MAX_GLITCH_HOURS', hrs, { skipRender: true });
    recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
    triggerProcessListings();
    showToast(`Glitch-Fenster: ${hrs} h — live aktualisiert`);
  };
}

function buildOutlierHoursWrapper() {
  const cur = typeof CONFIG.OUTLIER_MAX_GLITCH_HOURS === 'number' ? CONFIG.OUTLIER_MAX_GLITCH_HOURS : 48;
  const wrapper = document.createElement('div');
  wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
  wrapper.id = 'tp-bar-outlier-hours-wrapper';
  wrapper.title = 'Maximale Dauer eines Preissprungs, der noch als Glitch verworfen wird.';
  wrapper.innerHTML = `
    <span class="tp-stepper-label">Glitch-Fenster</span>
    <span class="tp-weight-label" id="tp-bar-outlier-hours-label">${cur} h</span>
    <input type="range" id="tp-bar-outlier-hours-range" min="12" max="168" step="12" value="${cur}" title="Maximale Dauer eines Preissprungs, der noch als Glitch verworfen wird.">`;
  bindOutlierHoursControls(wrapper);
  return wrapper;
}


function placeBar(bar, placement) {
  if (placement.reference && placement.reference.parentElement === placement.container && placement.reference !== bar) {
    placement.container.insertBefore(bar, placement.reference);
  } else {
    placement.container.appendChild(bar);
  }
}

export function renderSuiteFilterBar(counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, vortief: 0, uncheckedHidden: 0, dealer: 0, dealerActive: false, filteredCount: 0, dimmed: 0 }, pageHasOffers = false, isDealFeed = false) {
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
      <div class="tp-group tp-group-filter" role="group" aria-label="Filter">
        <div class="tp-calc-wrap">
          <button class="tp-bar-btn" id="tp-bar-filter-btn" aria-expanded="false" aria-haspopup="true" title="Filter – Verbergen oder Dimmen je Ursache"><span class="tp-btn-label">🧹 Filter</span><span class="tp-count-badge" id="tp-filter-count" style="display: none;"></span><span id="tp-filter-dim-count" style="display: none;"></span> ▾</button>
          <div class="tp-calc-popover" id="tp-bar-filter-popover" role="group" aria-label="Filter">
            <div class="tp-filter-row" data-filter-row="neg">
              <label class="tp-mini-switch" title="Negativ-Filter (Text) ${CONFIG.FILTER_NEG_ENABLED ? 'AN' : 'AUS'}">
                <input type="checkbox" id="tp-toggle-neg" ${CONFIG.FILTER_NEG_ENABLED ? 'checked' : ''}>
                <span class="tp-mini-slider"></span>
              </label>
              <span class="tp-filter-label" title="Negativ-Begriffe im Produktnamen filtern (Wortgrenzen)">Negativ-Begriffe</span>
              <div class="tp-input-field-box">
                <input type="text" id="tp-inline-negative-input" aria-label="Negativ-Filter (Text)" placeholder="Wörter ausschließen..." value="">
                <button id="tp-clear-neg-btn" title="Text leeren" style="display: ${CONFIG.NEGATIVE_TERMS ? 'block' : 'none'};">✕</button>
              </div>
              <span class="tp-count-badge" data-row-count="neg" style="display: ${negHidden > 0 ? 'inline-flex' : 'none'};">${negHidden > 0 ? negHidden : ''}</span>
              <button class="tp-filter-mode-btn tp-active" data-mode-key="FILTER_NEG_MODE" title="${CONFIG.FILTER_NEG_MODE === 'dim' ? 'Modus: Dimmen — klicken für Verbergen' : 'Modus: Verbergen — klicken für Dimmen'}">${CONFIG.FILTER_NEG_MODE === 'dim' ? 'Dimmen' : 'Verbergen'}</button>
            </div>
            <div class="tp-filter-row" data-filter-row="min" style="display: ${pageHasOffers ? 'flex' : 'none'};">
              <label class="tp-mini-switch" title="Min-Angebote-Filter ${CONFIG.FILTER_MIN_ENABLED ? 'AN' : 'AUS'}" aria-label="Min-Angebote-Filter">
                <input type="checkbox" id="tp-toggle-min" ${CONFIG.FILTER_MIN_ENABLED ? 'checked' : ''}>
                <span class="tp-mini-slider"></span>
              </label>
              <span class="tp-filter-label" title="Produkte mit weniger als N Angeboten filtern">Min-Angebote</span>
              <div class="tp-bar-stepper-group" id="tp-bar-min-offers-group" style="display: flex;">
                <button class="tp-stepper-btn" id="tp-bar-min-minus">-</button>
                <span id="tp-bar-min-val" style="min-width: 14px; text-align: center;">${CONFIG.MIN_OFFERS}</span>
                <button class="tp-stepper-btn" id="tp-bar-min-plus">+</button>
              </div>
              <span class="tp-count-badge" data-row-count="min" style="display: ${minHidden > 0 ? 'inline-flex' : 'none'};">${minHidden > 0 ? minHidden : ''}</span>
              <button class="tp-filter-mode-btn tp-active" data-mode-key="FILTER_MIN_MODE" title="${CONFIG.FILTER_MIN_MODE === 'dim' ? 'Modus: Dimmen — klicken für Verbergen' : 'Modus: Verbergen — klicken für Dimmen'}">${CONFIG.FILTER_MIN_MODE === 'dim' ? 'Dimmen' : 'Verbergen'}</button>
            </div>
            <div class="tp-filter-row" data-filter-row="unchecked" style="display: ${isDealFeed ? 'flex' : 'none'};">
              <label class="tp-mini-switch" title="Nur geprüfte">
                <input type="checkbox" id="tp-toggle-unchecked" ${CONFIG.BESTPREISE_HIDE_UNCHECKED ? 'checked' : ''}>
                <span class="tp-mini-slider"></span>
              </label>
              <span class="tp-filter-label" title="Ungeprüfte Deals ohne verifizierten Tiefstpreis filtern">Nur geprüfte</span>
              <span class="tp-count-badge" data-row-count="unchecked" style="display: ${uncheckedHiddenCount > 0 ? 'inline-flex' : 'none'};">${uncheckedHiddenCount > 0 ? uncheckedHiddenCount : ''}</span>
              <button class="tp-filter-mode-btn tp-active" data-mode-key="HIDE_UNCHECKED_MODE" title="${CONFIG.HIDE_UNCHECKED_MODE === 'dim' ? 'Modus: Dimmen — klicken für Verbergen' : 'Modus: Verbergen — klicken für Dimmen'}">${CONFIG.HIDE_UNCHECKED_MODE === 'dim' ? 'Dimmen' : 'Verbergen'}</button>
            </div>
            <div class="tp-filter-row" data-filter-row="vortief" style="display: ${isDealFeed ? 'flex' : 'none'};">
              <label class="tp-mini-switch" title="An = Fallback-Tiefs dimmen/verbergen; Aus = Fallback-Tiefs zeigen">
                <input type="checkbox" id="tp-toggle-vortief" ${CONFIG.BESTPREISE_INCLUDE_VORTIEF === false ? 'checked' : ''}>
                <span class="tp-mini-slider"></span>
              </label>
              <span class="tp-filter-label" title="An = Fallback-Tiefs dimmen/verbergen; Aus = Fallback-Tiefs zeigen">Fallback-Tiefs filtern</span>
              <span class="tp-count-badge tp-count-warn" data-row-count="vortief" style="display: ${CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && vortiefHidden > 0 ? 'inline-flex' : 'none'};">${CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && vortiefHidden > 0 ? vortiefHidden : ''}</span>
              <button class="tp-filter-mode-btn tp-active" data-mode-key="VORTIEF_MODE" title="${CONFIG.VORTIEF_MODE === 'dim' ? 'Modus: Dimmen — klicken für Verbergen' : 'Modus: Verbergen — klicken für Dimmen'}">${CONFIG.VORTIEF_MODE === 'dim' ? 'Dimmen' : 'Verbergen'}</button>
            </div>
            <div class="tp-filter-row" data-filter-row="dealer">
              <span class="tp-filter-label" title="Produkte des gewählten Händlers filtern">Händler</span>
              <span class="tp-filter-note" data-dealer-note>greift bei gewähltem Händler</span>
              <span class="tp-count-badge" data-row-count="dealer" style="display: ${dealerHidden > 0 ? 'inline-flex' : 'none'};">${dealerHidden > 0 ? dealerHidden : ''}</span>
              <button class="tp-filter-mode-btn tp-active" data-mode-key="DEALER_MODE" title="${CONFIG.DEALER_MODE === 'dim' ? 'Modus: Dimmen — klicken für Verbergen' : 'Modus: Verbergen — klicken für Dimmen'}">${CONFIG.DEALER_MODE === 'dim' ? 'Dimmen' : 'Verbergen'}</button>
            </div>
            <button class="tp-bar-btn tp-calc-reset" id="tp-filter-reset">Zurücksetzen</button>
          </div>
        </div>
       </div>
       <span class="tp-divider" aria-hidden="true"></span>
      <div class="tp-group tp-group-view" role="group" aria-label="Ansicht – entfernt nichts">
        <button class="tp-bar-btn ${CONFIG.HEATMAP_ENABLED ? 'tp-active' : ''}" id="tp-bar-heat-btn" aria-pressed="${CONFIG.HEATMAP_ENABLED !== false}" title="Heatmap: Karten- und Badge-Farbe folgt stets der angezeigten Badge-% — Tiefrot = grosser Tiefstpreis, Grau = kein Rabatt. Grau gestreift = ungeprüft (Differenz)." style="display: flex;">🔥 Heatmap</button>
       </div>
       <span class="tp-divider" aria-hidden="true"></span>
      <div class="tp-group tp-group-deals" role="group" aria-label="Sortieren">
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'tp-bestpreise-active' : ''}" id="tp-bar-bestpreise-btn" title="Neue Tiefstpreise: sortiert nach Gewichteter Differenz – filtert nichts" style="display: ${isDealFeed ? 'flex' : 'none'};">
          💎 Neue Tiefstpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline-flex' : 'none'};">${bestpreiseDeals > 0 ? bestpreiseDeals : ''}</span>
        </button>
        <div class="tp-calc-wrap" id="tp-bar-calc-wrap">
          <button class="tp-bar-btn" id="tp-bar-calc-btn" aria-expanded="false" aria-haspopup="true" title="Berechnungsparameter — Sortierung + Farb-Emphase, filtert nichts">⚖️ <span id="tp-bar-calc-summary">50/50 · 1J · 5 Pkt</span> ▾</button>
          <div class="tp-calc-popover" id="tp-bar-calc-popover" role="group" aria-label="Berechnungsparameter">
            <div class="tp-calc-head">Berechnungsparameter<span>Sortierung + Farb-Emphase — filtert nichts</span></div>
            <button class="tp-bar-btn tp-calc-reset" id="tp-bar-calc-reset">Zurücksetzen</button>
          </div>
        </div>
       </div>
      </div>
    `;
    // Deal sliders built once via builders; reset button stays last in the popover.
    {
      const popover = bar.querySelector('#tp-bar-calc-popover');
      const resetBtn = bar.querySelector('#tp-bar-calc-reset');
      const weight = buildWeightWrapper();
      const horizon = buildHorizonWrapper();
      const minpoints = buildMinPointsWrapper();
      const outlier = buildOutlierWrapper();
      const outlierBand = buildOutlierBandWrapper();
      const outlierHours = buildOutlierHoursWrapper();
      if (popover && resetBtn) popover.insertBefore(weight, resetBtn);
      if (popover && resetBtn) popover.insertBefore(horizon, resetBtn);
      if (popover && resetBtn) popover.insertBefore(minpoints, resetBtn);
      if (popover && resetBtn) popover.insertBefore(outlier, resetBtn);
      if (popover && resetBtn) popover.insertBefore(outlierBand, resetBtn);
      if (popover && resetBtn) popover.insertBefore(outlierHours, resetBtn);
      if (popover && resetBtn) popover.insertBefore(buildCalcPreview(), resetBtn);
    }
    // Preview follows slider drags live (DOM values, not debounced CONFIG).
    {
      for (const id of ['tp-bar-weight-range', 'tp-bar-horizon-range', 'tp-bar-minpoints-range', 'tp-bar-outlier-toggle', 'tp-bar-outlier-band-range', 'tp-bar-outlier-hours-range']) {
        const el = bar.querySelector('#' + id);
        if (!el) continue;
        el.addEventListener('input', refreshCalcPreview);
        el.addEventListener('change', refreshCalcPreview);
      }
    }

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
      updateConfig('FILTER_NEG_ENABLED', e.target.value.trim() !== '');
    };

    clearBtn.onclick = () => {
      updateConfig('NEGATIVE_TERMS', '');
      updateConfig('FILTER_NEG_ENABLED', false);
    };

    const filterBtn = bar.querySelector('#tp-bar-filter-btn');
    const filterPopover = bar.querySelector('#tp-bar-filter-popover');
    if (filterBtn && filterPopover) {
      filterBtn.onclick = e => {
        e.stopPropagation();
        const calcPop = bar.querySelector('#tp-bar-calc-popover');
        if (calcPop) calcPop.classList.remove('tp-show');
        const calcBtnEl = bar.querySelector('#tp-bar-calc-btn');
        if (calcBtnEl) calcBtnEl.setAttribute('aria-expanded', 'false');
        const open = filterPopover.classList.toggle('tp-show');
        filterBtn.setAttribute('aria-expanded', String(open));
      };
      filterPopover.onclick = e => {
        const btn = e.target?.closest?.('.tp-filter-mode-btn');
        if (!btn) return;
        updateConfig(btn.dataset.modeKey, CONFIG[btn.dataset.modeKey] === 'dim' ? 'hide' : 'dim');
      };
      const resetBtn = bar.querySelector('#tp-filter-reset');
      if (resetBtn) {
        resetBtn.onclick = () => {
          updateConfigs({ FILTER_NEG_MODE: 'dim', FILTER_MIN_MODE: 'dim', HIDE_UNCHECKED_MODE: 'dim', VORTIEF_MODE: 'dim', DEALER_MODE: 'dim', FILTER_NEG_ENABLED: false, FILTER_MIN_ENABLED: false, BESTPREISE_HIDE_UNCHECKED: false, BESTPREISE_INCLUDE_VORTIEF: true, MIN_OFFERS: 0, NEGATIVE_TERMS: '' });
          showToast('Filter zurückgesetzt');
        };
      }
      const uncheckedToggle = bar.querySelector('#tp-toggle-unchecked');
      if (uncheckedToggle) {
        uncheckedToggle.onchange = () => {
          updateConfig('BESTPREISE_HIDE_UNCHECKED', uncheckedToggle.checked);
          showToast(uncheckedToggle.checked ? '✓ Nur geprüfte filtern aktiv (Filtergrund, entfernt)' : '✓ Nur geprüfte aus — ungeprüfte werden wieder angezeigt');
        };
      }
      const vortiefToggle = bar.querySelector('#tp-toggle-vortief');
      if (vortiefToggle) {
        vortiefToggle.onchange = () => {
          updateConfig('BESTPREISE_INCLUDE_VORTIEF', !vortiefToggle.checked);
          showToast(vortiefToggle.checked ? 'Fallback-Tiefs ausgeschlossen (Filtergrund)' : 'Fallback-Tiefs eingeschlossen');
        };
      }
    }

    bar.querySelector('#tp-bar-heat-btn').onclick = () => {
      const nextState = !CONFIG.HEATMAP_ENABLED;
      updateConfig('HEATMAP_ENABLED', nextState);
    };

    const bestpreiseToggleBtn = bar.querySelector('#tp-bar-bestpreise-btn');
    if (bestpreiseToggleBtn) bindBestpreiseBtn(bestpreiseToggleBtn);

    // Calc popover: toggles .tp-show, closes on outside click / Escape.
    const calcBtn = bar.querySelector('#tp-bar-calc-btn');
    const calcPopover = bar.querySelector('#tp-bar-calc-popover');
    // ponytail: document listeners registered once per page (bar can be removed + recreated);
    // handlers re-query by ID so they always hit the live bar, never a detached one.
    if (!window._tpBarCalcDocBound) {
      window._tpBarCalcDocBound = true;
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (!e.target || !e.target.closest || !e.target.closest('#tp-suite-filter-bar')) return;
        for (const [popId, btnId] of [['tp-bar-calc-popover', 'tp-bar-calc-btn'], ['tp-bar-filter-popover', 'tp-bar-filter-btn']]) {
          const pop = document.getElementById(popId);
          if (!pop || !pop.classList.contains('tp-show')) continue;
          pop.classList.remove('tp-show');
          const btn = document.getElementById(btnId);
          if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
        }
      });
      document.addEventListener('click', e => {
        if (e.target && e.target.closest && e.target.closest('#tp-suite-filter-bar')) return;
        for (const [popId, btnId] of [['tp-bar-calc-popover', 'tp-bar-calc-btn'], ['tp-bar-filter-popover', 'tp-bar-filter-btn']]) {
          const pop = document.getElementById(popId);
          if (!pop || !pop.classList.contains('tp-show')) continue;
          pop.classList.remove('tp-show');
          const btn = document.getElementById(btnId);
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });
    }
    if (calcBtn && calcPopover) {
      calcBtn.onclick = e => {
        e.stopPropagation();
        const filterPop = bar.querySelector('#tp-bar-filter-popover');
        if (filterPop) filterPop.classList.remove('tp-show');
        const filterBtnEl = bar.querySelector('#tp-bar-filter-btn');
        if (filterBtnEl) filterBtnEl.setAttribute('aria-expanded', 'false');
        const open = calcPopover.classList.toggle('tp-show');
        calcBtn.setAttribute('aria-expanded', String(open));
      };
      const resetBtn = bar.querySelector('#tp-bar-calc-reset');
      if (resetBtn) {
        resetBtn.onclick = () => {
          updateConfigs({ BESTPREISE_WEIGHT_RECORD: 0.50, BESTPREISE_MEDIAN_HORIZON_DAYS: 365, BESTPREISE_MIN_POINTS: 5, OUTLIER_REJECTION_ENABLED: true, OUTLIER_DEVIATION_BAND: 0.60, OUTLIER_MAX_GLITCH_HOURS: 48 }, { skipRender: true });
          recomputeCachedMedians(365);
          triggerProcessListings();
          const previewSel = document.getElementById('tp-preview-preset-select');
          if (previewSel) previewSel.value = 's26';
          refreshCalcPreview();
          showToast('Berechnungsparameter zurückgesetzt');
        };
      }
    }

    const updateMinOffers = delta => {
      const next = Math.max(0, CONFIG.MIN_OFFERS + delta);
      if (next !== CONFIG.MIN_OFFERS) {
        updateConfig('MIN_OFFERS', next);
        updateConfig('FILTER_MIN_ENABLED', next > 0);
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
  const heatBtn = bar.querySelector('#tp-bar-heat-btn');
  if (heatBtn) {
    heatBtn.classList.toggle('tp-active', CONFIG.HEATMAP_ENABLED !== false);
    heatBtn.setAttribute('aria-pressed', String(CONFIG.HEATMAP_ENABLED !== false));
  }
  const dimmedTotal = counts.dimmed || 0;
  const filterBtn = bar.querySelector('#tp-bar-filter-btn');
  if (filterBtn) {
    const filterCount = bar.querySelector('#tp-filter-count');
    if (filterCount) {
      setTextIfChanged(filterCount, hiddenTotal > 0 ? String(hiddenTotal) : '');
      filterCount.style.display = hiddenTotal > 0 ? 'inline-flex' : 'none';
    }
    const dimCount = bar.querySelector('#tp-filter-dim-count');
    if (dimCount) {
      setTextIfChanged(dimCount, dimmedTotal > 0 ? `+${dimmedTotal} gedimmt` : '');
      dimCount.style.display = dimmedTotal > 0 ? 'inline' : 'none';
    }
    filterBtn.classList.toggle('tp-tool-dim', hiddenTotal === 0 && dimmedTotal === 0);
    filterBtn.title = `Filter – Verbergen (${hiddenTotal}) + Gedimmt (${dimmedTotal}) — Neg:${negHidden} Min:${minHidden} Händler:${dealerHidden} Fallback:${vortiefHidden} Ungeprüft:${uncheckedHiddenCount}`;
  }
  const setRowCount = (name, n, show) => {
    const badge = bar.querySelector(`[data-row-count="${name}"]`);
    if (!badge) return;
    setTextIfChanged(badge, show ? String(n) : '');
    badge.style.display = show ? 'inline-flex' : 'none';
  };
  setRowCount('neg', negHidden, negHidden > 0);
  setRowCount('min', minHidden, minHidden > 0);
  setRowCount('unchecked', uncheckedHiddenCount, uncheckedHiddenCount > 0);
  setRowCount('vortief', vortiefHidden, CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && vortiefHidden > 0);
  setRowCount('dealer', dealerHidden, dealerHidden > 0);
  for (const key of ['FILTER_NEG_MODE', 'FILTER_MIN_MODE', 'HIDE_UNCHECKED_MODE', 'VORTIEF_MODE', 'DEALER_MODE']) {
    const mode = CONFIG[key] === 'dim' ? 'dim' : 'hide';
    bar.querySelectorAll(`[data-mode-key="${key}"]`).forEach(btn => {
      btn.classList.toggle('tp-active', true);
      setTextIfChanged(btn, mode === 'dim' ? 'Dimmen' : 'Verbergen');
      btn.title = mode === 'dim' ? 'Modus: Dimmen — klicken für Verbergen' : 'Modus: Verbergen — klicken für Dimmen';
    });
  }
  const uncheckedToggle = bar.querySelector('#tp-toggle-unchecked');
  if (uncheckedToggle) uncheckedToggle.checked = CONFIG.BESTPREISE_HIDE_UNCHECKED === true;
  const vortiefToggle = bar.querySelector('#tp-toggle-vortief');
  if (vortiefToggle) vortiefToggle.checked = CONFIG.BESTPREISE_INCLUDE_VORTIEF === false;
  const uncheckedRow = bar.querySelector('[data-filter-row="unchecked"]');
  if (uncheckedRow) uncheckedRow.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
  const vortiefRow = bar.querySelector('[data-filter-row="vortief"]');
  if (vortiefRow) {
    vortiefRow.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
    vortiefRow.classList.toggle('tp-row-inactive', CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false);
    const vortiefBtn = vortiefRow.querySelector('[data-mode-key="VORTIEF_MODE"]');
    if (vortiefBtn) vortiefBtn.disabled = CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false;
  }
  const dealerActive = counts.dealerActive === true;
  const dealerRow = bar.querySelector('[data-filter-row="dealer"]');
  if (dealerRow) {
    dealerRow.classList.toggle('tp-row-inactive', !dealerActive);
    const note = dealerRow.querySelector('[data-dealer-note]');
    if (note) setTextIfChanged(note, dealerActive ? 'greift bei gewähltem Händler' : 'inaktiv – kein Händler gewählt');
    const dealerBtn = dealerRow.querySelector('[data-mode-key="DEALER_MODE"]');
    if (dealerBtn) dealerBtn.disabled = !dealerActive;
  }


  const bestpreiseBtn = document.getElementById('tp-bar-bestpreise-btn');
  if (bestpreiseBtn) {
    bestpreiseBtn.classList.toggle('tp-bestpreise-active', CONFIG.BESTPREISE_MODE_ACTIVE === true);
    bestpreiseBtn.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
    const bpCount = bestpreiseBtn.querySelector('#tp-bar-bestpreise-count');
    if (bpCount) {
      setTextIfChanged(bpCount, bestpreiseDeals > 0 ? String(bestpreiseDeals) : '');
      bpCount.style.display = bestpreiseDeals > 0 ? 'inline-flex' : 'none';
    }
  }

  syncMiniToggle(bar.querySelector('#tp-toggle-neg'), CONFIG.FILTER_NEG_ENABLED, 'Negativ-Filter (Text)');
  syncMiniToggle(bar.querySelector('#tp-toggle-min'), CONFIG.FILTER_MIN_ENABLED, 'Min-Angebote-Filter');
  syncMiniToggle(bar.querySelector('#tp-bar-outlier-toggle'), CONFIG.OUTLIER_REJECTION_ENABLED !== false, 'Ausreißer-Filter');
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
  paintMinPoints();
  const horizonRange = document.getElementById('tp-bar-horizon-range');
  const curHorizon = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365;
  if (horizonRange && document.activeElement !== horizonRange) {
    horizonRange.value = curHorizon === 0 ? 760 : curHorizon;
    const horizonLabel = document.getElementById('tp-bar-horizon-label');
    if (horizonLabel) {
      horizonLabel.textContent = horizonText(curHorizon);
      horizonLabel.title = horizonText(curHorizon, 'title');
    }
  }
  const curBand = typeof CONFIG.OUTLIER_DEVIATION_BAND === 'number' ? CONFIG.OUTLIER_DEVIATION_BAND : 0.60;
  const bandRange = document.getElementById('tp-bar-outlier-band-range');
  if (bandRange && document.activeElement !== bandRange) {
    bandRange.value = Math.round(curBand * 100);
    const bandLabel = document.getElementById('tp-bar-outlier-band-label');
    if (bandLabel) bandLabel.textContent = `±${Math.round(curBand * 100)} %`;
  }
  const curHours = typeof CONFIG.OUTLIER_MAX_GLITCH_HOURS === 'number' ? CONFIG.OUTLIER_MAX_GLITCH_HOURS : 48;
  const hoursRange = document.getElementById('tp-bar-outlier-hours-range');
  if (hoursRange && document.activeElement !== hoursRange) {
    hoursRange.value = curHours;
    const hoursLabel = document.getElementById('tp-bar-outlier-hours-label');
    if (hoursLabel) hoursLabel.textContent = `${curHours} h`;
  }
  paintOutlierDim();
  const calcSummary = document.getElementById('tp-bar-calc-summary');
  if (calcSummary) {
    setTextIfChanged(calcSummary, `${weightText(curWeight, 'short')} · ${horizonText(curHorizon)} · ${clampMinPoints(CONFIG.BESTPREISE_MIN_POINTS)} Pkt`);
  }
  // Berechnungsparameter shape browse heat too — always visible; mode only drives sort + scan.
  const calcWrapEl = document.getElementById('tp-bar-calc-wrap');
  if (calcWrapEl) calcWrapEl.style.setProperty('display', 'inline-flex', 'important');
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

  const minRow = bar.querySelector('[data-filter-row="min"]');
  if (minRow) minRow.style.setProperty('display', pageHasOffers ? 'flex' : 'none', 'important');
  const minVal = bar.querySelector('#tp-bar-min-val');
  if (minVal) minVal.textContent = CONFIG.MIN_OFFERS;
  if (document.getElementById('tp-preview-svg')) refreshCalcPreview();
}
