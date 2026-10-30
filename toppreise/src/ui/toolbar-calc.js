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

function bindDebouncedSlider(wrapper, { rangeId, labelId, read, paint, onCommit, focus }) {
  if (!wrapper) return;
  const range = wrapper.querySelector(rangeId);
  const label = wrapper.querySelector(labelId);
  if (!range) return;
  const doPaint = () => { if (label) paint(label, read(range)); };
  doPaint();
  let deb;
  range.oninput = () => {
    doPaint();
    if (focus) pokePreviewFocus(focus);
    clearTimeout(deb);
    deb = setTimeout(() => onCommit(read(range), false), 175);
  };
  range.onchange = () => {
    clearTimeout(deb);
    const v = read(range);
    doPaint();
    onCommit(v, true);
  };
}

function createSliderWrapper({ id, extraClass = '', title, labelTitle, labelText, labelId, rangeId, min, max, step, value, rangeTitle, sliderConfig }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tp-threshold-wrapper' + (extraClass ? ` ${extraClass}` : '');
  wrapper.id = id;
  wrapper.title = title;
  const labelAttr = labelTitle ? ` class="tp-stepper-label tp-glossary-term" title="${labelTitle}"` : ' class="tp-stepper-label"';
  wrapper.innerHTML = `
    <span${labelAttr}>${labelText}</span>
    <span class="tp-weight-label" id="${labelId.replace('#', '')}"></span>
    <input type="range" id="${rangeId.replace('#', '')}" min="${min}" max="${max}" step="${step}" value="${value}" title="${rangeTitle}">`;
  bindDebouncedSlider(wrapper, { rangeId, labelId, ...sliderConfig });
  return wrapper;
}

function buildWeightWrapper() {
  const readWeight = range => Math.max(0, Math.min(1, (parseInt(range.value, 10) || 0) / 100));
  return createSliderWrapper({
    id: 'tp-bar-weight-wrapper',
    title: 'Reihenfolge + Farb-Emphase — Badge zeigt die Gewichtete Differenz.',
    labelTitle: 'Kombiniert Rekord-Tiefstpreis und Durchschnittsrabatt im gewählten Mix für Badge, Farbe und Platzierung.',
    labelText: 'Gewichtung',
    labelId: '#tp-bar-weight-label',
    rangeId: '#tp-bar-weight-range',
    min: 0, max: 100, step: 5, value: 50,
    rangeTitle: 'Gewichtung: links Ø-Schnäppchen, rechts Rekord-Jagd',
    sliderConfig: {
      read: readWeight,
      paint: (lbl, w) => {
        lbl.textContent = `⚖️ ${weightText(w, 'short')}`;
        lbl.title = weightText(w, 'title');
      },
      focus: 'weight',
      onCommit: (w, isChange) => {
        updateConfig('BESTPREISE_WEIGHT_RECORD', w);
        if (isChange) showToast(`Sortier-Gewichtung: ${Math.round((1 - w) * 100)}% Ø-Preis / ${Math.round(w * 100)}% Rekord (Reihenfolge + Farb-Emphase)`);
      }
    }
  });
}

function buildMinPointsWrapper() {
  const cur = clampMinPoints(CONFIG.BESTPREISE_MIN_POINTS);
  const readNum = range => minPointsFromIndex(range.value);
  return createSliderWrapper({
    id: 'tp-bar-minpoints-wrapper',
    extraClass: 'tp-deals-sep',
    title: 'Ø-Vergleich erst ab so vielen Punkten (Punkte ≈ Tage). Darunter: Fallback-Tief.',
    labelText: 'Mindestpunkte',
    labelId: '#tp-bar-minpoints-label',
    rangeId: '#tp-bar-minpoints-range',
    min: 0, max: MIN_POINTS_STEPS.length - 1, step: 1, value: minPointsToIndex(cur),
    rangeTitle: 'Mindestanzahl Datenpunkte: 1–5 fein, dann 10er-Schritte bis 100',
    sliderConfig: {
      read: readNum,
      paint: (lbl, n) => { lbl.textContent = `📊 ${n} Pkt`; },
      onCommit: (n, isChange) => {
        updateConfig('BESTPREISE_MIN_POINTS', n);
        if (isChange) showToast(`Mindestanzahl Datenpunkte in der Preishistorie: ${n} (≈ Tage)`);
      }
    }
  });
}

function buildHorizonWrapper() {
  const cur = CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS ?? 365;
  const readHorizon = range => horizonUiToStored(parseInt(range.value, 10));
  return createSliderWrapper({
    id: 'tp-bar-horizon-wrapper',
    extraClass: 'tp-deals-sep',
    title: 'Ø-Zeitraum für den Median (ändert auch die Modal-Einstellung).',
    labelText: 'Ø-Zeitraum',
    labelId: '#tp-bar-horizon-label',
    rangeId: '#tp-bar-horizon-range',
    min: 30, max: 760, step: 30, value: horizonStoredToUi(cur),
    rangeTitle: horizonText(cur, 'title'),
    sliderConfig: {
      read: readHorizon,
      paint: (lbl, v) => {
        lbl.textContent = horizonText(v);
        lbl.title = horizonText(v, 'title');
      },
      focus: 'window',
      onCommit: (v, isChange) => {
        recomputeCachedMedians(v);
        updateConfig('BESTPREISE_MEDIAN_HORIZON_DAYS', v);
        if (isChange) showToast(`Ø-Vergleichszeitraum: ${horizonText(v)} — live aktualisiert`);
      }
    }
  });
}

function bindOutlierControls(wrapper) {
  const toggle = wrapper.querySelector('#tp-bar-outlier-toggle');
  if (!toggle) return;
  syncMiniToggle(toggle, CONFIG.OUTLIER_REJECTION_ENABLED !== false, 'Ausreisser-Filter');
  paintOutlierDim();
  toggle.onchange = () => {
    const v = toggle.checked;
    updateConfig('OUTLIER_REJECTION_ENABLED', v, { skipRender: true });
    recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
    triggerProcessListings();
    syncMiniToggle(toggle, toggle.checked, 'Ausreisser-Filter');
    paintOutlierDim();
    showToast(toggle.checked ? 'Ausreisser-Filter AN — Glitches werden ignoriert' : 'Ausreisser-Filter AUS — Rohhistorie wird verwendet');
  };
}

function buildOutlierWrapper() {
  const wrapper = document.createElement('div');
  wrapper.className = 'tp-threshold-wrapper tp-deals-sep';
  wrapper.id = 'tp-bar-outlier-wrapper';
  wrapper.title = 'Kurze Preissprünge (Band und Fenster unten einstellbar) als Feed-Glitches ignorieren. AUS = Rohhistorie verwenden.';
  wrapper.innerHTML = `
    <label class="tp-mini-switch" title="Ausreisser-Filter">
      <input type="checkbox" id="tp-bar-outlier-toggle" ${CONFIG.OUTLIER_REJECTION_ENABLED !== false ? 'checked' : ''}>
      <span class="tp-mini-slider"></span>
    </label>
    <span class="tp-weight-label" id="tp-bar-outlier-label">🧹 Ausreisser filtern</span>`;
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

function buildOutlierBandWrapper() {
  const cur = typeof CONFIG.OUTLIER_DEVIATION_BAND === 'number' ? Math.round(CONFIG.OUTLIER_DEVIATION_BAND * 100) : 50;
  const readBandPct = range => {
    const raw = parseInt(range.value, 10);
    return isNaN(raw) ? 50 : Math.min(50, Math.max(1, raw));
  };
  return createSliderWrapper({
    id: 'tp-bar-outlier-band-wrapper',
    extraClass: 'tp-deals-sep',
    title: 'Glitch-Band: Abweichung ab der gefiltert wird',
    labelText: 'Glitch-Band',
    labelId: '#tp-bar-outlier-band-label',
    rangeId: '#tp-bar-outlier-band-range',
    min: 1, max: 50, step: 1, value: cur,
    rangeTitle: 'Abweichung vom Median, ab der ein kurzer Sprung als Glitch gilt.',
    sliderConfig: {
      read: readBandPct,
      paint: (lbl, pct) => { lbl.textContent = `±${pct} %`; },
      focus: 'band',
      onCommit: (pct, isChange) => {
        updateConfig('OUTLIER_DEVIATION_BAND', pct / 100, { skipRender: true });
        recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
        triggerProcessListings();
        if (isChange) showToast(`Ausreisser-Band: ±${pct} % — live aktualisiert`);
      }
    }
  });
}

function buildOutlierHoursWrapper() {
  const cur = typeof CONFIG.OUTLIER_MAX_GLITCH_HOURS === 'number' ? CONFIG.OUTLIER_MAX_GLITCH_HOURS : 48;
  const readHours = range => {
    const raw = parseInt(range.value, 10);
    return isNaN(raw) ? 48 : Math.min(168, Math.max(24, raw));
  };
  return createSliderWrapper({
    id: 'tp-bar-outlier-hours-wrapper',
    extraClass: 'tp-deals-sep',
    title: 'Glitch-Fenster: maximale Dauer eines Glitches',
    labelText: 'Glitch-Fenster',
    labelId: '#tp-bar-outlier-hours-label',
    rangeId: '#tp-bar-outlier-hours-range',
    min: 24, max: 168, step: 24, value: cur,
    rangeTitle: 'Maximale Dauer eines Preissprungs, der noch als Glitch verworfen wird.',
    sliderConfig: {
      read: readHours,
      paint: (lbl, hrs) => { lbl.textContent = `${hrs} h`; },
      focus: 'band',
      onCommit: (hrs, isChange) => {
        updateConfig('OUTLIER_MAX_GLITCH_HOURS', hrs, { skipRender: true });
        recomputeCachedMedians(CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS);
        triggerProcessListings();
        if (isChange) showToast(`Glitch-Fenster: ${hrs} h — live aktualisiert`);
      }
    }
  });
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
  syncMiniToggle(document.getElementById('tp-bar-outlier-toggle'), CONFIG.OUTLIER_REJECTION_ENABLED !== false, 'Ausreisser-Filter');
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
