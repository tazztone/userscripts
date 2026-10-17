/**
 * Toolbar calc controls (split from ui/toolbar.js): weight/min-points/horizon/
 * outlier slider pairs, calc popover assembly + reset, live sync.
 * Sections re-query the live bar by ID (bar can be removed + recreated).
 */

import { CONFIG, updateConfig, updateConfigs, weightText, horizonText, horizonUiToStored, horizonStoredToUi, clampMinPoints, minPointsToIndex, minPointsFromIndex, MIN_POINTS_STEPS, paintMinPoints } from '../state/config.js';
import { recomputeCachedMedians } from '../scanner/cache.js';
import { triggerProcessListings } from '../page/adapter.js';
import { showToast } from './toast.js';
import { syncMiniToggle } from './mini-toggle.js';
import { buildCalcPreview, refreshCalcPreview } from './calc-preview.js';
import { setTextIfChanged } from './badges.js';

function pokePreviewFocus(kind) {
  const box = document.getElementById('tp-calc-preview');
  if (!box) return;
  box.dataset.focus = kind;
  clearTimeout(box._tpFocusT);
  box._tpFocusT = setTimeout(() => { if (box.dataset.focus === kind) delete box.dataset.focus; }, 600);
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
    pokePreviewFocus('weight');
    clearTimeout(deb);
    deb = setTimeout(() => {
      updateConfig('BESTPREISE_WEIGHT_RECORD', readWeight());
    }, 175);
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
    <span class="tp-stepper-label tp-glossary-term" title="Kombiniert Rekord-Tiefstpreis und Durchschnittsrabatt im gewählten Mix für Badge, Farbe und Platzierung.">Gewichtung</span>
    <span class="tp-weight-label" id="tp-bar-weight-label">⚖️ 50/50</span>
    <input type="range" id="tp-bar-weight-range" min="0" max="100" step="5" value="50" title="Gewichtung: links Ø-Schnäppchen, rechts Rekord-Jagd">`;
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
    deb = setTimeout(() => updateConfig('BESTPREISE_MIN_POINTS', readNum()), 175);
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
  wrapper.title = 'Ø-Vergleich erst ab so vielen Punkten (Punkte ≈ Tage). Darunter: Fallback-Tief.';
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
    return horizonUiToStored(raw);
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
    pokePreviewFocus('window');
    clearTimeout(deb);
    deb = setTimeout(() => {
      const v = readHorizon();
      recomputeCachedMedians(v);
      updateConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', v);
    }, 175);
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
  wrapper.title = 'Ø-Zeitraum für den Median (ändert auch die Modal-Einstellung).';
  wrapper.innerHTML = `
    <span class="tp-stepper-label">Ø-Zeitraum</span>
    <span class="tp-weight-label" id="tp-bar-horizon-label" title="${horizonText(cur, 'title')}">${horizonText(cur)}</span>
    <input type="range" id="tp-bar-horizon-range" min="30" max="760" step="30" value="${horizonStoredToUi(cur)}" title="${horizonText(cur, 'title')}">`;
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

export function paintOutlierDim() {
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
    return isNaN(raw) ? 50 : Math.min(50, Math.max(1, raw));
  };
  const paintBandLabel = () => { if (label) label.textContent = `±${readBandPct()} %`; };
  paintBandLabel();
  let deb;
  range.oninput = () => {
    paintBandLabel();
    pokePreviewFocus('band');
    clearTimeout(deb);
    deb = setTimeout(() => {
      const pct = readBandPct();
      updateConfig('OUTLIER_DEVIATION_BAND', pct / 100, { skipRender: true });
      recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      triggerProcessListings();
    }, 175);
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
  const cur = typeof CONFIG.OUTLIER_DEVIATION_BAND === 'number' ? Math.round(CONFIG.OUTLIER_DEVIATION_BAND * 100) : 50;
  const wrapper = document.createElement('div');
  wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
  wrapper.id = 'tp-bar-outlier-band-wrapper';
  wrapper.title = 'Glitch-Band: Abweichung ab der gefiltert wird';
  wrapper.innerHTML = `
    <span class="tp-stepper-label">Glitch-Band</span>
    <span class="tp-weight-label" id="tp-bar-outlier-band-label">±${cur} %</span>
    <input type="range" id="tp-bar-outlier-band-range" min="1" max="50" step="1" value="${cur}" title="Abweichung vom Median, ab der ein kurzer Sprung als Glitch gilt.">`;
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
    return isNaN(raw) ? 48 : Math.min(168, Math.max(24, raw));
  };
  const paintHoursLabel = () => { if (label) label.textContent = `${readHours()} h`; };
  paintHoursLabel();
  let deb;
  range.oninput = () => {
    paintHoursLabel();
    pokePreviewFocus('band');
    clearTimeout(deb);
    deb = setTimeout(() => {
      const hrs = readHours();
      updateConfig('OUTLIER_MAX_GLITCH_HOURS', hrs, { skipRender: true });
      recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
      triggerProcessListings();
    }, 175);
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
  wrapper.title = 'Glitch-Fenster: maximale Dauer eines Glitches';
  wrapper.innerHTML = `
    <span class="tp-stepper-label">Glitch-Fenster</span>
    <span class="tp-weight-label" id="tp-bar-outlier-hours-label">${cur} h</span>
    <input type="range" id="tp-bar-outlier-hours-range" min="24" max="168" step="24" value="${cur}" title="Maximale Dauer eines Preissprungs, der noch als Glitch verworfen wird.">`;
  bindOutlierHoursControls(wrapper);
  return wrapper;
}

export function buildCalcControls(popover, resetBtn) {
  if (!popover || !resetBtn) return;
  // Deal sliders built once via builders; reset button stays last in the popover.
  popover.insertBefore(buildWeightWrapper(), resetBtn);
  popover.insertBefore(buildHorizonWrapper(), resetBtn);
  popover.insertBefore(buildMinPointsWrapper(), resetBtn);
  popover.insertBefore(buildOutlierWrapper(), resetBtn);
  popover.insertBefore(buildOutlierBandWrapper(), resetBtn);
  popover.insertBefore(buildOutlierHoursWrapper(), resetBtn);
  popover.insertBefore(buildCalcPreview(), resetBtn);
  // Preview follows slider drags live (DOM values, not debounced CONFIG).
  for (const id of ['tp-bar-weight-range', 'tp-bar-horizon-range', 'tp-bar-minpoints-range', 'tp-bar-outlier-toggle', 'tp-bar-outlier-band-range', 'tp-bar-outlier-hours-range']) {
    const el = popover.querySelector('#' + id);
    if (!el) continue;
    el.addEventListener('input', refreshCalcPreview);
    el.addEventListener('change', refreshCalcPreview);
  }
  resetBtn.onclick = () => {
    updateConfigs({ BESTPREISE_WEIGHT_RECORD: 0.50, BESTPREISE_MEDIAN_HORIZON_DAYS: 365, BESTPREISE_MIN_POINTS: 5, OUTLIER_REJECTION_ENABLED: true, OUTLIER_DEVIATION_BAND: 0.50, OUTLIER_MAX_GLITCH_HOURS: 48 }, { skipRender: true });
    recomputeCachedMedians(365);
    triggerProcessListings();
    const previewSel = document.getElementById('tp-preview-preset-select');
    if (previewSel) previewSel.value = 's26';
    refreshCalcPreview();
    showToast('Berechnungsparameter zurückgesetzt');
  };
}

export function syncCalcControls() {
  syncMiniToggle(document.getElementById('tp-bar-outlier-toggle'), CONFIG.OUTLIER_REJECTION_ENABLED !== false, 'Ausreißer-Filter');
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
    horizonRange.value = horizonStoredToUi(curHorizon);
    const horizonLabel = document.getElementById('tp-bar-horizon-label');
    if (horizonLabel) {
      horizonLabel.textContent = horizonText(curHorizon);
      horizonLabel.title = horizonText(curHorizon, 'title');
    }
  }
  const curBand = typeof CONFIG.OUTLIER_DEVIATION_BAND === 'number' ? CONFIG.OUTLIER_DEVIATION_BAND : 0.50;
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
}
