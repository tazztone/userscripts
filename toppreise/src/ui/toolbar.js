/**
 * Suite Filter Toolbar Component
 * Manages the inline/floating contextual filter bar, quick filters,
 * deal thresholds, and scan progress.
 */

import { SELECTORS } from "../page/selectors.js";
import { CONFIG, FILTER_CYCLE, cycleStateOf, updateConfig, updateConfigs, weightText, horizonText, clampMinPoints, minPointsToIndex, minPointsFromIndex, MIN_POINTS_STEPS, paintMinPoints } from "../state/config.js";
import { recomputeCachedMedians } from "../scanner/cache.js";
import { triggerProcessListings } from "../page/adapter.js";
import { showToast } from "./toast.js";
import { buildCalcPreview, refreshCalcPreview } from "./calc-preview.js";
import { setTextIfChanged } from "./badges.js";
import { syncMiniToggle } from "./mini-toggle.js";
import { buildCalcControls, syncCalcControls } from './toolbar-calc.js';
import { wireFilterPopover, syncFilterRow } from './toolbar-filter.js';

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
    showToast(next ? '💎 Tiefstpreis-Sortierung aktiviert' : 'Tiefstpreis-Sortierung deaktiviert');
  };
}




function placeBar(bar, placement) {
  if (placement.reference && placement.reference.parentElement === placement.container && placement.reference !== bar) {
    placement.container.insertBefore(bar, placement.reference);
  } else {
    placement.container.appendChild(bar);
  }
}

export function renderSuiteFilterBar(counts = { neg: 0, min: 0, uncheckedDeals: 0, bestpreiseDeals: 0, vortief: 0, uncheckedHidden: 0, dealer: 0, dealerActive: false, filteredCount: 0, dimmed: 0 }, pageHasOffers = false, isDealFeed = false, isSortPage = isDealFeed) {
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
              <span class="tp-filter-label" title="Namen mit diesen Wörtern dimmen/verbergen (kommagetrennt, Wortgrenzen)">Negativ-Begriffe</span>
              <div class="tp-input-field-box">
                <input type="text" id="tp-inline-negative-input" aria-label="Negativ-Filter (Text)" placeholder="Wörter ausschließen..." value="">
                <button id="tp-clear-neg-btn" title="Text leeren" style="display: ${CONFIG.NEGATIVE_TERMS ? 'block' : 'none'};">✕</button>
              </div>
              <span class="tp-count-badge" data-row-count="neg" style="display: ${negHidden > 0 ? 'inline-flex' : 'none'};">${negHidden > 0 ? negHidden : ''}</span>
              <button class="tp-filter-mode-btn" data-mode-key="FILTER_NEG_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="min" style="display: ${pageHasOffers ? 'flex' : 'none'};">
              <span class="tp-filter-label" title="Karten mit weniger als N Angeboten dimmen/verbergen">Min-Angebote</span>
              <div class="tp-bar-stepper-group" id="tp-bar-min-offers-group" style="display: flex;">
                <button class="tp-stepper-btn" id="tp-bar-min-minus">-</button>
                <span id="tp-bar-min-val" style="min-width: 14px; text-align: center;">${CONFIG.MIN_OFFERS}</span>
                <button class="tp-stepper-btn" id="tp-bar-min-plus">+</button>
              </div>
              <span class="tp-count-badge" data-row-count="min" style="display: ${minHidden > 0 ? 'inline-flex' : 'none'};">${minHidden > 0 ? minHidden : ''}</span>
              <button class="tp-filter-mode-btn" data-mode-key="FILTER_MIN_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="unchecked" style="display: ${isDealFeed ? 'flex' : 'none'};">
              <span class="tp-filter-label" title="Karten ohne verifizierten Tiefstpreis dimmen/verbergen (grau gestreift, nur Site-%) — Normal = zeigen">Ungeprüfte</span>
              <span class="tp-count-badge" data-row-count="unchecked" style="display: ${uncheckedHiddenCount > 0 ? 'inline-flex' : 'none'};">${uncheckedHiddenCount > 0 ? uncheckedHiddenCount : ''}</span>
              <button class="tp-filter-mode-btn" data-mode-key="HIDE_UNCHECKED_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="vortief" style="display: ${isDealFeed ? 'flex' : 'none'};">
              <span class="tp-filter-label" title="Verifizierte Tiefs ohne Ø-Vergleich (< Mindestpunkte, nur Vortief-Abstand) dimmen/verbergen — Normal = zeigen">Fallback-Tiefs</span>
              <span class="tp-count-badge tp-count-warn" data-row-count="vortief" style="display: ${vortiefHidden > 0 ? 'inline-flex' : 'none'};">${vortiefHidden > 0 ? vortiefHidden : ''}</span>
              <button class="tp-filter-mode-btn" data-mode-key="VORTIEF_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="dealer">
              <span class="tp-filter-label" title="Karten, deren günstigstes Angebot nicht vom gewählten Händler kommt, dimmen/verbergen — nur aktiv wenn Händler gewählt">Händler</span>
              <span class="tp-filter-note" data-dealer-note>greift bei gewähltem Händler</span>
              <span class="tp-count-badge" data-row-count="dealer" style="display: ${dealerHidden > 0 ? 'inline-flex' : 'none'};">${dealerHidden > 0 ? dealerHidden : ''}</span>
              <button class="tp-filter-mode-btn tp-active" data-mode-key="DEALER_MODE">Normal</button>
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
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'tp-bestpreise-active' : ''}" id="tp-bar-bestpreise-btn" title="Tiefstpreis-Sortierung: sortiert nach Gewichteter Differenz – filtert nichts" style="display: ${isSortPage ? 'flex' : 'none'};">
          💎 Tiefstpreis-Sortierung <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline-flex' : 'none'};">${bestpreiseDeals > 0 ? bestpreiseDeals : ''}</span>
        </button>
        <div class="tp-calc-wrap" id="tp-bar-calc-wrap">
          <button class="tp-bar-btn" id="tp-bar-calc-btn" aria-expanded="false" aria-haspopup="true" title="Berechnungsparameter — nur Anzeige, filtert nichts">⚖️ <span id="tp-bar-calc-summary">50/50 · 1J · 5 Pkt</span> ▾</button>
          <div class="tp-calc-popover" id="tp-bar-calc-popover" role="group" aria-label="Berechnungsparameter">
            <div class="tp-calc-head">Berechnungsparameter<span>Nur Anzeige — filtert nichts</span></div>
            <button class="tp-bar-btn tp-calc-reset" id="tp-bar-calc-reset">Zurücksetzen</button>
          </div>
        </div>
       </div>
      </div>
    `;
    // Calc sliders + live preview listeners + reset live in toolbar-calc.js.
    buildCalcControls(bar.querySelector('#tp-bar-calc-popover'), bar.querySelector('#tp-bar-calc-reset'));

    placeBar(bar, placement);

    wireFilterPopover(bar);

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
        for (const [popId, btnId] of [['tp-bar-calc-popover', 'tp-bar-calc-btn'], ['tp-bar-filter-popover', 'tp-bar-filter-btn'], ['tp-floating-threshold-popover', 'tp-floating-threshold-btn']]) {
          const pop = document.getElementById(popId);
          if (!pop || !pop.classList.contains('tp-show')) continue;
          pop.classList.remove('tp-show');
          const btn = document.getElementById(btnId);
          if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
        }
      });
      document.addEventListener('click', e => {
        if (!e.isTrusted) return; // Synthetic clicks (price-alarm auto-submit) must not dismiss the popover.
        if (e.target && e.target.closest && e.target.closest('#tp-suite-filter-bar')) return;
        for (const [popId, btnId] of [['tp-bar-calc-popover', 'tp-bar-calc-btn'], ['tp-bar-filter-popover', 'tp-bar-filter-btn'], ['tp-floating-threshold-popover', 'tp-floating-threshold-btn']]) {
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
        if (open) refreshCalcPreview();
      };
      // Calc reset lives in toolbar-calc.js (wired by buildCalcControls).
    }

  } else if (bar.parentElement !== placement.container || (bar.nextSibling !== placement.reference && placement.reference !== bar)) {
    placeBar(bar, placement);
  }

  bar.style.display = 'flex';
  bar.classList.toggle('tp-bestpreise-bar', CONFIG.BESTPREISE_MODE_ACTIVE === true);

  syncFilterRow(bar, counts, { isDealFeed, pageHasOffers });


  const bestpreiseBtn = document.getElementById('tp-bar-bestpreise-btn');
  if (bestpreiseBtn) {
    bestpreiseBtn.classList.toggle('tp-bestpreise-active', CONFIG.BESTPREISE_MODE_ACTIVE === true);
    bestpreiseBtn.style.setProperty('display', isSortPage ? 'flex' : 'none', 'important');
    const bpCount = bestpreiseBtn.querySelector('#tp-bar-bestpreise-count');
    if (bpCount) {
      setTextIfChanged(bpCount, bestpreiseDeals > 0 ? String(bestpreiseDeals) : '');
      bpCount.style.display = bestpreiseDeals > 0 ? 'inline-flex' : 'none';
    }
  }

  syncCalcControls();
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

  if (document.getElementById('tp-bar-calc-popover')?.classList.contains('tp-show')) refreshCalcPreview();
}
