/**
 * Suite Filter Toolbar Component
 * Manages the inline/floating contextual filter bar, quick filters,
 * deal thresholds, and scan progress.
 */

import { SELECTORS } from "../page/selectors.js";
import { CONFIG, updateConfig, updateConfigs, weightText, horizonText, clampMinPoints, minPointsToIndex, minPointsFromIndex, MIN_POINTS_STEPS, paintMinPoints } from "../state/config.js";
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
      <div class="tp-group tp-group-filter" role="group" aria-label="Filter – blendet aus">
        <div class="tp-input-wrapper" title="Kommagetrennte Begriffe eingeben">
          <div class="tp-input-field-box">
            <input type="text" id="tp-inline-negative-input" aria-label="Negativ-Filter (Text)" placeholder="Wörter ausschließen..." value="">
            <button id="tp-clear-neg-btn" title="Text leeren" style="display: ${CONFIG.NEGATIVE_TERMS ? 'block' : 'none'};">✕</button>
          </div>
          <label class="tp-mini-switch" title="Negativ-Filter (Text) ${CONFIG.FILTER_NEG_ENABLED ? 'AN' : 'AUS'}">
            <input type="checkbox" id="tp-toggle-neg" ${CONFIG.FILTER_NEG_ENABLED ? 'checked' : ''}>
            <span class="tp-mini-slider"></span>
          </label>
        </div>
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_HIDE_UNCHECKED ? 'tp-active' : ''}" id="tp-bar-unchecked-btn" aria-pressed="${CONFIG.BESTPREISE_HIDE_UNCHECKED === true}" style="display: ${isDealFeed ? 'flex' : 'none'};" title="${CONFIG.BESTPREISE_HIDE_UNCHECKED ? `✓ Nur geprüfte aktiv (${uncheckedHiddenCount} ausgeblendet) – klicken zum Aufheben` : `Ungeprüfte ausblenden (${uncheckedHiddenCount}) – entfernt sie aus der Liste`}"><span class="tp-btn-label">Nur geprüfte</span><span class="tp-count-badge" id="tp-bar-unchecked-count" style="display: ${uncheckedHiddenCount > 0 ? 'inline-flex' : 'none'};">${uncheckedHiddenCount > 0 ? uncheckedHiddenCount : ''}</span></button>
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false ? 'tp-active' : ''}" id="tp-bar-fallback-btn" aria-pressed="${CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false}" style="display: ${isDealFeed ? 'flex' : 'none'};" title="${CONFIG.BESTPREISE_INCLUDE_VORTIEF === false ? `Fallback-Tiefs ausgeblendet (${vortiefHidden}) – klicken zum Einblenden` : `Fallback-Tiefs werden gezeigt – klicken zum Ausblenden (entfernt aktuell ${vortiefHidden})`}"><span class="tp-btn-label">Fallback-Tiefs</span><span class="tp-count-badge tp-count-warn" id="tp-bar-fallback-count" style="display: ${CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && vortiefHidden > 0 ? 'inline-flex' : 'none'};">${CONFIG.BESTPREISE_INCLUDE_VORTIEF === false && vortiefHidden > 0 ? vortiefHidden : ''}</span></button>
        <div class="tp-bar-stepper-group" id="tp-bar-min-offers-group" style="display: ${pageHasOffers ? 'flex' : 'none'};" title="Produkte mit weniger als N Angeboten filtern (entfernt)">
          <span class="tp-stepper-label">Min-Angebote:</span>
          <button class="tp-stepper-btn" id="tp-bar-min-minus">-</button>
          <span id="tp-bar-min-val" style="min-width: 14px; text-align: center;">${CONFIG.MIN_OFFERS}</span>
          <button class="tp-stepper-btn" id="tp-bar-min-plus">+</button>
          <label class="tp-mini-switch" title="Min-Angebote-Filter ${CONFIG.FILTER_MIN_ENABLED ? 'AN' : 'AUS'}" aria-label="Min-Angebote-Filter">
            <input type="checkbox" id="tp-toggle-min" ${CONFIG.FILTER_MIN_ENABLED ? 'checked' : ''}>
            <span class="tp-mini-slider"></span>
          </label>
        </div>
       </div>
       <span class="tp-divider" aria-hidden="true"></span>
      <div class="tp-group tp-group-view" role="group" aria-label="Ansicht – entfernt nichts">
        <button class="tp-bar-btn ${CONFIG.HEATMAP_ENABLED ? 'tp-active' : ''}" id="tp-bar-heat-btn" aria-pressed="${CONFIG.HEATMAP_ENABLED !== false}" title="Heatmap: Karten- und Badge-Farbe folgt stets der angezeigten Badge-% — Tiefrot = grosser Tiefstpreis, Grau = kein Rabatt. Grau gestreift = ungeprüft (Differenz)." style="display: flex;">🔥 Heatmap</button>
        <button class="tp-bar-btn" id="tp-bar-reveal-all" title="Einblenden, entfernt nichts: Gefilterte (0) — Neg:0 Min:0 Händler:0 Fallback:0 Ungeprüft:0 — klicken zum Ein-/Ausblenden"><span class="tp-btn-label">👁️ Gefilterte einblenden</span><span class="tp-count-badge" id="tp-bar-reveal-count" style="display: none;"></span></button>
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
      if (popover && resetBtn) popover.insertBefore(weight, resetBtn);
      if (popover && resetBtn) popover.insertBefore(horizon, resetBtn);
      if (popover && resetBtn) popover.insertBefore(minpoints, resetBtn);
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
    bar.querySelector('#tp-bar-fallback-btn').onclick = () => {
      const next = CONFIG.BESTPREISE_INCLUDE_VORTIEF === false;
      updateConfig('BESTPREISE_INCLUDE_VORTIEF', next);
      showToast(next ? 'Fallback-Tiefs eingeschlossen' : 'Fallback-Tiefs ausgeschlossen (Filtergrund, entfernt)');
    };

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
        const pop = document.getElementById('tp-bar-calc-popover');
        if (!pop || !pop.classList.contains('tp-show')) return;
        if (!e.target || !e.target.closest || !e.target.closest('#tp-suite-filter-bar')) return;
        pop.classList.remove('tp-show');
        const btn = document.getElementById('tp-bar-calc-btn');
        if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      });
      document.addEventListener('click', e => {
        const pop = document.getElementById('tp-bar-calc-popover');
        if (!pop || !pop.classList.contains('tp-show')) return;
        if (e.target && e.target.closest && e.target.closest('#tp-suite-filter-bar')) return;
        pop.classList.remove('tp-show');
        const btn = document.getElementById('tp-bar-calc-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    }
    if (calcBtn && calcPopover) {
      calcBtn.onclick = e => {
        e.stopPropagation();
        const open = calcPopover.classList.toggle('tp-show');
        calcBtn.setAttribute('aria-expanded', String(open));
      };
      const resetBtn = bar.querySelector('#tp-bar-calc-reset');
      if (resetBtn) {
        resetBtn.onclick = () => {
          updateConfigs({ BESTPREISE_WEIGHT_RECORD: 0.50, BESTPREISE_MEDIAN_HORIZON_DAYS: 365, BESTPREISE_MIN_POINTS: 5 });
          showToast('Berechnungsparameter zurückgesetzt');
        };
      }
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
  const revealAllBtn = bar.querySelector('#tp-bar-reveal-all');
  if (revealAllBtn) {
    const revealCount = bar.querySelector('#tp-bar-reveal-count');
    if (revealCount) {
      setTextIfChanged(revealCount, hiddenTotal > 0 ? String(hiddenTotal) : '');
      revealCount.style.display = hiddenTotal > 0 ? 'inline-flex' : 'none';
    }
    revealAllBtn.classList.toggle('tp-active', document.body.classList.contains('tp-reveal-all'));
    revealAllBtn.setAttribute('aria-pressed', String(document.body.classList.contains('tp-reveal-all')));
    revealAllBtn.classList.toggle('tp-tool-dim', hiddenTotal === 0);
    revealAllBtn.title = `Einblenden, entfernt nichts: Gefilterte (${hiddenTotal}) — Neg:${negHidden} Min:${minHidden} Händler:${dealerHidden} Fallback:${vortiefHidden} Ungeprüft:${uncheckedHiddenCount} — klicken zum Ein-/Ausblenden`;
  }
  const uncheckedBtn = bar.querySelector('#tp-bar-unchecked-btn');
  if (uncheckedBtn) {
    const uncheckedCount = bar.querySelector('#tp-bar-unchecked-count');
    if (uncheckedCount) {
      setTextIfChanged(uncheckedCount, uncheckedHiddenCount > 0 ? String(uncheckedHiddenCount) : '');
      uncheckedCount.style.display = uncheckedHiddenCount > 0 ? 'inline-flex' : 'none';
    }
    uncheckedBtn.classList.toggle('tp-active', CONFIG.BESTPREISE_HIDE_UNCHECKED === true);
    uncheckedBtn.setAttribute('aria-pressed', String(CONFIG.BESTPREISE_HIDE_UNCHECKED === true));
    uncheckedBtn.title = CONFIG.BESTPREISE_HIDE_UNCHECKED === true ? `✓ Nur geprüfte aktiv (${uncheckedHiddenCount} ausgeblendet) – klicken zum Aufheben` : `Ungeprüfte ausblenden (${uncheckedHiddenCount}) – entfernt sie aus der Liste`;
    uncheckedBtn.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
  }
  const fallbackBtn = bar.querySelector('#tp-bar-fallback-btn');
  if (fallbackBtn) {
    const included = CONFIG.BESTPREISE_INCLUDE_VORTIEF !== false;
    const fallbackCount = bar.querySelector('#tp-bar-fallback-count');
    if (fallbackCount) {
      const showBadge = !included && vortiefHidden > 0;
      setTextIfChanged(fallbackCount, showBadge ? String(vortiefHidden) : '');
      fallbackCount.style.display = showBadge ? 'inline-flex' : 'none';
    }
    fallbackBtn.classList.toggle('tp-active', included);
    fallbackBtn.classList.toggle('tp-tool-dim', !included);
    fallbackBtn.setAttribute('aria-pressed', String(included));
    fallbackBtn.title = !included ? `Fallback-Tiefs ausgeblendet (${vortiefHidden}) – klicken zum Einblenden` : `Fallback-Tiefs werden gezeigt – klicken zum Ausblenden (entfernt aktuell ${vortiefHidden})`;
    fallbackBtn.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
  }


  const bestpreiseBtn = document.getElementById('tp-bar-bestpreise-btn');
  if (bestpreiseBtn) {
    bestpreiseBtn.classList.toggle('tp-bestpreise-active', CONFIG.BESTPREISE_MODE_ACTIVE === true);
    bestpreiseBtn.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
    if (!scanState.isBestpreiseScanning) {
      const bpCount = bestpreiseBtn.querySelector('#tp-bar-bestpreise-count');
      if (bpCount) {
        setTextIfChanged(bpCount, bestpreiseDeals > 0 ? String(bestpreiseDeals) : '');
        bpCount.style.display = bestpreiseDeals > 0 ? 'inline-flex' : 'none';
      }
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
  const calcSummary = document.getElementById('tp-bar-calc-summary');
  if (calcSummary) {
    setTextIfChanged(calcSummary, `${weightText(curWeight, 'short')} · ${horizonText(curHorizon)} · ${clampMinPoints(CONFIG.BESTPREISE_MIN_POINTS)} Pkt`);
  }
  // Berechnungsparameter shape browse heat too — catalog listings always show
  // them; the feed keeps the mode gate.
  const showCalc = isDealFeed ? CONFIG.BESTPREISE_MODE_ACTIVE === true : true;
  const calcWrapEl = document.getElementById('tp-bar-calc-wrap');
  if (calcWrapEl) {
    calcWrapEl.style.setProperty('display', showCalc ? 'inline-flex' : 'none', 'important');
    if (!showCalc) {
      const pop = document.getElementById('tp-bar-calc-popover');
      if (pop) pop.classList.remove('tp-show');
      const btn = document.getElementById('tp-bar-calc-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
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
