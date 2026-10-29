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
  const priceHidden = counts.price || 0;
  const dealDiscHidden = counts.dealDisc || 0;
  const savingsHidden = counts.savings || 0;
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
          <button class="tp-bar-btn" id="tp-bar-filter-btn" aria-expanded="false" aria-haspopup="true" title="Filter – Verbergen oder Dimmen je Ursache"><span class="tp-btn-label">🧹 Filter</span><span class="tp-count-badge tp-pill tp-pill-hide" id="tp-filter-count" style="display: none;"></span><span class="tp-count-badge tp-pill tp-pill-dim" id="tp-filter-dim-count" style="display: none;"></span><span class="tp-count-badge tp-pill tp-pill-hl" id="tp-filter-hl-count" style="display: none;"></span> ▾</button>
          <div class="tp-calc-popover" id="tp-bar-filter-popover" role="group" aria-label="Filter">
            <div class="tp-filter-row" data-filter-row="neg">
              <span class="tp-filter-label" title="Namen mit diesen Wörtern dimmen/verbergen (kommagetrennt, Wortgrenzen)">Begriffe</span>
              <div class="tp-input-field-box">
                <input type="text" id="tp-inline-negative-input" aria-label="Negativ-Filter (Text)" placeholder="Wörter ausschliessen..." value="">
                <button id="tp-clear-neg-btn" title="Text leeren" style="display: ${CONFIG.NEGATIVE_TERMS ? 'block' : 'none'};">✕</button>
              </div>
              <span class="tp-count-badge" data-row-count="neg" style="display: ${negHidden > 0 ? 'inline-flex' : 'none'};">${negHidden > 0 ? negHidden : ''}</span>
              <button class="tp-filter-mode-btn" data-mode-key="FILTER_NEG_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="min">
              <span class="tp-filter-label" title="Karten mit weniger als N Angeboten dimmen/verbergen">Min-Angebote</span>
              <span class="tp-filter-note" data-min-note></span>
              <div class="tp-bar-stepper-group" id="tp-bar-min-offers-group" style="display: flex;">
                <button class="tp-stepper-btn" id="tp-bar-min-minus" title="Weniger Angebote fordern">-</button>
                <span id="tp-bar-min-val" style="min-width: 14px; text-align: center;">${CONFIG.MIN_OFFERS}</span>
                <button class="tp-stepper-btn" id="tp-bar-min-plus" title="Mehr Angebote fordern">+</button>
              </div>
              <span class="tp-count-badge" data-row-count="min" style="display: ${minHidden > 0 ? 'inline-flex' : 'none'};">${minHidden > 0 ? minHidden : ''}</span>
              <button class="tp-filter-mode-btn" data-mode-key="FILTER_MIN_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="unchecked">
              <span class="tp-filter-label tp-glossary-term" title="Angebote ohne geprüfte Preishistorie. Der Rabatt basiert nur auf UVP oder Toppreis.">Ungeprüfte</span>
              <span class="tp-count-badge" data-row-count="unchecked" style="display: ${uncheckedHiddenCount > 0 ? 'inline-flex' : 'none'};">${uncheckedHiddenCount > 0 ? uncheckedHiddenCount : ''}</span>
              <button class="tp-filter-mode-btn" data-mode-key="HIDE_UNCHECKED_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="vortief">
              <span class="tp-filter-label tp-glossary-term" title="Verifizierter Tiefstpreis mit zu wenigen Datenpunkten für einen Ø-Vergleich. Zeigt ersatzweise den Abstand zum Vortief.">Fallback-Tiefs</span>
              <span class="tp-count-badge" data-row-count="vortief" style="display: ${vortiefHidden > 0 ? 'inline-flex' : 'none'};">${vortiefHidden > 0 ? vortiefHidden : ''}</span>
              <button class="tp-filter-mode-btn" data-mode-key="VORTIEF_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="price">
              <span class="tp-filter-label tp-glossary-term" title="Preisbereich in CHF. Angebote ausserhalb des Bereichs werden gefiltert.">Preis (CHF)</span>
              <div class="tp-range-group" id="tp-bar-price-group">
                <input type="number" id="tp-price-min-input" class="tp-range-input" placeholder="Min" min="0" step="any" value="${CONFIG.FILTER_PRICE_MIN > 0 ? CONFIG.FILTER_PRICE_MIN : ''}">
                <span class="tp-range-sep">–</span>
                <input type="number" id="tp-price-max-input" class="tp-range-input" placeholder="Max" min="0" step="any" value="${CONFIG.FILTER_PRICE_MAX > 0 ? CONFIG.FILTER_PRICE_MAX : ''}">
              </div>
              <span class="tp-count-badge" data-row-count="price" style="display: ${priceHidden > 0 ? 'inline-flex' : 'none'};">${priceHidden > 0 ? priceHidden : ''}</span>
              <button class="tp-filter-mode-btn" data-mode-key="FILTER_PRICE_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="deal-disc">
              <span class="tp-filter-label tp-glossary-term" title="Mindest-Rabatt in Prozent. Geprüfte Angebote mit weniger Rabatt oder Aufschlägen werden gefiltert; ungeprüfte bleiben sichtbar.">Min-Rabatt</span>
              <div class="tp-bar-stepper-group" id="tp-bar-deal-disc-group">
                <button class="tp-stepper-btn" id="tp-bar-deal-disc-minus" title="Geringeren Rabatt fordern">-</button>
                <span id="tp-bar-deal-disc-val" style="min-width: 28px; text-align: center;">${CONFIG.MIN_DEAL_DISCOUNT}%</span>
                <button class="tp-stepper-btn" id="tp-bar-deal-disc-plus" title="Höheren Rabatt fordern">+</button>
              </div>
              <span class="tp-count-badge" data-row-count="deal-disc" style="display: none;"></span>
              <button class="tp-filter-mode-btn" data-mode-key="FILTER_DEAL_DISCOUNT_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="savings">
              <span class="tp-filter-label tp-glossary-term" title="Mindest- und Höchst-Ersparnis in CHF. Geprüfte Angebote mit Ersparnis ausserhalb des Bereichs werden gefiltert; ungeprüfte bleiben sichtbar.">Ersparnis</span>
              <div class="tp-range-group" id="tp-bar-savings-group">
                <input type="number" id="tp-savings-min-input" class="tp-range-input" placeholder="Min" min="0" step="any" value="${CONFIG.FILTER_SAVINGS_MIN > 0 ? CONFIG.FILTER_SAVINGS_MIN : ''}">
                <span class="tp-range-sep">–</span>
                <input type="number" id="tp-savings-max-input" class="tp-range-input" placeholder="Max" min="0" step="any" value="${CONFIG.FILTER_SAVINGS_MAX > 0 ? CONFIG.FILTER_SAVINGS_MAX : ''}">
              </div>
              <span class="tp-count-badge" data-row-count="savings" style="display: ${savingsHidden > 0 ? 'inline-flex' : 'none'};">${savingsHidden > 0 ? savingsHidden : ''}</span>
              <button class="tp-filter-mode-btn" data-mode-key="FILTER_SAVINGS_MODE">Normal</button>
            </div>
            <div class="tp-filter-row" data-filter-row="dealer">
              <span class="tp-filter-label" title="Karten, deren günstigstes Angebot nicht vom gewählten Händler kommt, dimmen/verbergen — nur aktiv wenn Händler gewählt">Händler</span>
              <span class="tp-filter-note" data-dealer-note>greift bei gewähltem Händler</span>
              <span class="tp-count-badge" data-row-count="dealer" style="display: ${dealerHidden > 0 ? 'inline-flex' : 'none'};">${dealerHidden > 0 ? dealerHidden : ''}</span>
              <button class="tp-filter-mode-btn tp-active" data-mode-key="DEALER_MODE">Normal</button>
            </div>
            <button class="tp-bar-btn tp-calc-reset" id="tp-filter-reset" title="Filter zurücksetzen">Zurücksetzen</button>
          </div>
        </div>
        <label class="tp-mini-switch" id="tp-bar-filters-toggle-label" title="Filter ${CONFIG.FILTERS_ENABLED !== false ? 'AN' : 'AUS'}">
          <input type="checkbox" id="tp-bar-filters-toggle" ${CONFIG.FILTERS_ENABLED !== false ? 'checked' : ''}>
          <span class="tp-mini-slider"></span>
        </label>
       </div>
       <span class="tp-divider" aria-hidden="true"></span>
      <div class="tp-group tp-group-view" role="group" aria-label="Ansicht – entfernt nichts">
        <button class="tp-bar-btn ${CONFIG.HEATMAP_ENABLED ? 'tp-active' : ''}" id="tp-bar-heat-btn" aria-pressed="${CONFIG.HEATMAP_ENABLED !== false}" title="Deal-Intensität (Heatmap): Farbe folgt dem Rabatt (bernstein bis tiefrot = Ersparnis, farblos = kein Rabatt/Aufschlag, gestreift = ungeprüft)" style="display: flex;">🔥 Heatmap</button>
       </div>
       <span class="tp-divider" aria-hidden="true"></span>
      <div class="tp-group tp-group-deals" role="group" aria-label="Sortieren">
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'tp-bestpreise-active' : ''}" id="tp-bar-bestpreise-btn" title="Sortiert Angebote nach echter Tiefstpreis-Qualität (Gewichtete Differenz). Entfernt keine Angebote." style="display: ${isSortPage ? 'flex' : 'none'};">
          💎 <span class="tp-glossary-term" title="Sortiert Angebote nach echter Tiefstpreis-Qualität (Gewichtete Differenz). Entfernt keine Angebote.">Tiefstpreis-Sortierung</span> <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline-flex' : 'none'};">${bestpreiseDeals > 0 ? bestpreiseDeals : ''}</span>
        </button>
        <div class="tp-calc-wrap" id="tp-bar-calc-wrap">
          <button class="tp-bar-btn" id="tp-bar-calc-btn" aria-expanded="false" aria-haspopup="true" title="Regler für Gewichtung, Zeitraum und Mindestdaten zur Berechnung der Gewichteten Differenz. Filtert nichts.">⚖️ <span id="tp-bar-calc-summary">50/50 · 1J · 5 Pkt</span> ▾</button>
          <div class="tp-calc-popover" id="tp-bar-calc-popover" role="group" aria-label="Berechnungsparameter">
            <div class="tp-calc-head"><span class="tp-glossary-term" title="Regler für Gewichtung, Zeitraum und Mindestdaten zur Berechnung der Gewichteten Differenz. Filtert nichts.">Berechnungsparameter</span><span>Formel für Deal-Score & Preishistorie</span></div>
            <button class="tp-bar-btn tp-calc-reset" id="tp-bar-calc-reset" title="Berechnungsparameter zurücksetzen">Zurücksetzen</button>
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
        for (const [popId, btnId] of [['tp-bar-calc-popover', 'tp-bar-calc-btn'], ['tp-bar-filter-popover', 'tp-bar-filter-btn'], ['tp-floating-threshold-popover', 'tp-floating-threshold-btn']]) {
          const pop = document.getElementById(popId);
          if (!pop || !pop.classList.contains('tp-show')) continue;
          const btn = document.getElementById(btnId);
          if (pop.contains(e.target) || btn?.contains(e.target)) continue;
          pop.classList.remove('tp-show');
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
