/**
 * Toolbar filter row (split from ui/toolbar.js): cycle buttons, negative-input/
 * stepper wiring, filter popover, row-count badges, dealer-row paint.
 */

import { CONFIG, updateConfig, updateConfigs, FILTER_CYCLE, cycleStateOf, paintCycleModeButton } from '../state/config.js';
import { showToast } from './toast.js';
import { setTextIfChanged } from './badges.js';
import { paintCycleButton, syncMiniToggle } from './mini-toggle.js';

const CYCLE_TOASTS = {
  FILTER_NEG_MODE: { dim: '📝 Begriffe: Dimmen', hide: '📝 Begriffe: Verbergen', highlight: '📝 Begriffe: Hervorheben', off: '📝 Begriffe: Normal' },
  FILTER_MIN_MODE: { dim: '🔢 Min-Angebote: Dimmen', hide: '🔢 Min-Angebote: Verbergen', highlight: '🔢 Min-Angebote: Hervorheben', off: '🔢 Min-Angebote: Normal' },
  FILTER_PRICE_MODE: { dim: '💵 Preis: Dimmen', hide: '💵 Preis: Verbergen', highlight: '💵 Preis: Hervorheben', off: '💵 Preis: Normal' },
  FILTER_DEAL_DISCOUNT_MODE: { dim: '📉 Min-Rabatt: Dimmen', hide: '📉 Min-Rabatt: Verbergen', highlight: '📉 Min-Rabatt: Hervorheben', off: '📉 Min-Rabatt: Normal' },
  FILTER_SAVINGS_MODE: { dim: '💰 Min-Ersparnis: Dimmen', hide: '💰 Min-Ersparnis: Verbergen', highlight: '💰 Min-Ersparnis: Hervorheben', off: '💰 Min-Ersparnis: Normal' },
  HIDE_UNCHECKED_MODE: { dim: '✓ Ungeprüfte: Dimmen', hide: '✓ Ungeprüfte: Verbergen', highlight: '✓ Ungeprüfte: Hervorheben', off: '✓ Ungeprüfte: Normal — alle werden angezeigt' },
  VORTIEF_MODE: { dim: 'Fallback-Tiefs werden gedimmt', hide: 'Fallback-Tiefs ausgeschlossen (Filtergrund)', highlight: 'Fallback-Tiefs werden hervorgehoben', off: 'Fallback-Tiefs eingeschlossen' },
};
function cycleFilter(modeKey) {
  const pair = FILTER_CYCLE[modeKey];
  if (!pair) return;
  const toasts = CYCLE_TOASTS[modeKey];
  const s = cycleStateOf(modeKey);
  if (s === 'off') {
    updateConfigs({ [pair.enable]: pair.on, [modeKey]: 'dim' });
    showToast(toasts.dim);
  } else if (s === 'dim') {
    updateConfig(modeKey, 'hide');
    showToast(toasts.hide);
  } else if (s === 'hide') {
    updateConfig(modeKey, 'highlight');
    showToast(toasts.highlight);
  } else {
    updateConfig(pair.enable, !pair.on);
    showToast(toasts.off);
  }
}

export function wireFilterPopover(bar) {
  const input = bar.querySelector('#tp-inline-negative-input');
  const clearBtn = bar.querySelector('#tp-clear-neg-btn');

  input.onkeydown = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      input.blur();
    }
  };

  let negDeb;
  input.oninput = e => {
    const val = e.target.value;
    clearTimeout(negDeb);
    negDeb = setTimeout(() => {
      updateConfigs({ NEGATIVE_TERMS: val, FILTER_NEG_ENABLED: val.trim() !== '' });
    }, 150);
  };
  clearBtn.onclick = () => {
    clearTimeout(negDeb);
    updateConfigs({ NEGATIVE_TERMS: '', FILTER_NEG_ENABLED: false });
  };

  const filterBtn = bar.querySelector('#tp-bar-filter-btn');
  const filterPopover = bar.querySelector('#tp-bar-filter-popover');
  const filtersToggle = bar.querySelector('#tp-bar-filters-toggle');
  if (filtersToggle) {
    filtersToggle.onchange = e => {
      updateConfig('FILTERS_ENABLED', e.target.checked);
    };
  }
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
      const modeKey = btn.dataset.modeKey;
      if (modeKey in FILTER_CYCLE) {
        cycleFilter(modeKey);
        return;
      }
      const cur = CONFIG[modeKey] || 'dim';
      const next = cur === 'dim' ? 'hide' : cur === 'hide' ? 'highlight' : 'dim';
      updateConfig(modeKey, next);
    };
    const resetBtn = bar.querySelector('#tp-filter-reset');
    if (resetBtn) {
      resetBtn.onclick = () => {
        updateConfigs({
          FILTER_NEG_MODE: 'dim',
          FILTER_MIN_MODE: 'dim',
          FILTER_DEAL_DISCOUNT_MODE: 'dim',
          FILTER_PRICE_MODE: 'dim',
          FILTER_SAVINGS_MODE: 'dim',
          HIDE_UNCHECKED_MODE: 'dim',
          VORTIEF_MODE: 'dim',
          DEALER_MODE: 'dim',
          FILTER_NEG_ENABLED: false,
          FILTER_MIN_ENABLED: false,
          FILTER_DEAL_DISCOUNT_ENABLED: false,
          FILTER_PRICE_ENABLED: false,
          FILTER_SAVINGS_ENABLED: false,
          BESTPREISE_HIDE_UNCHECKED: false,
          BESTPREISE_INCLUDE_VORTIEF: true,
          MIN_OFFERS: 0,
          MIN_DEAL_DISCOUNT: 0,
          FILTER_PRICE_MIN: 0,
          FILTER_PRICE_MAX: 0,
          FILTER_SAVINGS_MIN: 0,
          NEGATIVE_TERMS: '',
          FILTERS_ENABLED: true
        });
        const pMin = bar.querySelector('#tp-price-min-input');
        if (pMin) pMin.value = '';
        const pMax = bar.querySelector('#tp-price-max-input');
        if (pMax) pMax.value = '';
        const sMin = bar.querySelector('#tp-savings-min-input');
        if (sMin) sMin.value = '';
        showToast('Filter zurückgesetzt');
      };
    }
  }

  let priceDeb;
  const priceMinInput = bar.querySelector('#tp-price-min-input');
  const priceMaxInput = bar.querySelector('#tp-price-max-input');
  const onPriceChange = () => {
    clearTimeout(priceDeb);
    priceDeb = setTimeout(() => {
      const min = Math.max(0, parseFloat(priceMinInput?.value) || 0);
      const max = Math.max(0, parseFloat(priceMaxInput?.value) || 0);
      updateConfigs({
        FILTER_PRICE_MIN: min,
        FILTER_PRICE_MAX: max,
        FILTER_PRICE_ENABLED: (min > 0 || max > 0)
      });
    }, 150);
  };
  priceMinInput?.addEventListener('input', onPriceChange);
  priceMaxInput?.addEventListener('input', onPriceChange);

  let savingsDeb;
  const savingsMinInput = bar.querySelector('#tp-savings-min-input');
  const onSavingsChange = () => {
    clearTimeout(savingsDeb);
    savingsDeb = setTimeout(() => {
      const min = Math.max(0, parseFloat(savingsMinInput?.value) || 0);
      updateConfigs({
        FILTER_SAVINGS_MIN: min,
        FILTER_SAVINGS_ENABLED: min > 0
      });
    }, 150);
  };
  savingsMinInput?.addEventListener('input', onSavingsChange);

  const updateMinOffers = delta => {
    const next = Math.max(0, CONFIG.MIN_OFFERS + delta);
    if (next !== CONFIG.MIN_OFFERS) {
      updateConfigs({ MIN_OFFERS: next, FILTER_MIN_ENABLED: next > 0 });
    }
  };

  bar.querySelector('#tp-bar-min-minus').onclick = () => updateMinOffers(-1);
  bar.querySelector('#tp-bar-min-plus').onclick = () => updateMinOffers(1);

  const updateMinDiscount = delta => {
    const next = Math.max(0, Math.min(50, CONFIG.MIN_DEAL_DISCOUNT + delta));
    if (next !== CONFIG.MIN_DEAL_DISCOUNT) {
      updateConfigs({ MIN_DEAL_DISCOUNT: next, FILTER_DEAL_DISCOUNT_ENABLED: next > 0 });
    }
  };

  bar.querySelector('#tp-bar-deal-disc-minus')?.addEventListener('click', () => updateMinDiscount(-5));
  bar.querySelector('#tp-bar-deal-disc-plus')?.addEventListener('click', () => updateMinDiscount(5));
}

export function syncFilterRow(bar, counts, flags) {
  const { isDealFeed = false, pageHasOffers = false } = flags || {};
  const negHidden = counts.neg || 0;
  const minHidden = counts.min || 0;
  const priceHidden = counts.price || 0;
  const dealDiscHidden = counts.dealDisc || 0;
  const savingsHidden = counts.savings || 0;
  const vortiefHidden = counts.vortief || 0;
  const uncheckedHiddenCount = counts.uncheckedHidden || 0;
  const dealerHidden = counts.dealer || 0;

  const input = bar.querySelector('#tp-inline-negative-input');
  const clearBtn = bar.querySelector('#tp-clear-neg-btn');
  if (input && document.activeElement !== input) {
    input.value = CONFIG.NEGATIVE_TERMS || '';
    if (clearBtn) clearBtn.style.display = CONFIG.NEGATIVE_TERMS ? 'block' : 'none';
  }

  const pMin = bar.querySelector('#tp-price-min-input');
  if (pMin && document.activeElement !== pMin) {
    pMin.value = CONFIG.FILTER_PRICE_MIN > 0 ? CONFIG.FILTER_PRICE_MIN : '';
  }
  const pMax = bar.querySelector('#tp-price-max-input');
  if (pMax && document.activeElement !== pMax) {
    pMax.value = CONFIG.FILTER_PRICE_MAX > 0 ? CONFIG.FILTER_PRICE_MAX : '';
  }
  const sMin = bar.querySelector('#tp-savings-min-input');
  if (sMin && document.activeElement !== sMin) {
    sMin.value = CONFIG.FILTER_SAVINGS_MIN > 0 ? CONFIG.FILTER_SAVINGS_MIN : '';
  }

  const filtersToggle = bar.querySelector('#tp-bar-filters-toggle');
  if (filtersToggle) {
    syncMiniToggle(filtersToggle, CONFIG.FILTERS_ENABLED !== false, 'Filter');
  }

  const isPaused = CONFIG.FILTERS_ENABLED === false;
  const hiddenTotal = isPaused ? (counts.potentialFiltered || 0) : (counts.filteredCount || 0);
  const dimmedTotal = isPaused ? (counts.potentialDimmed || 0) : (counts.dimmed || 0);
  const highlightedTotal = isPaused ? (counts.potentialHighlighted || 0) : (counts.highlighted || 0);
  const filterBtn = bar.querySelector('#tp-bar-filter-btn');
  if (filterBtn) {
    const filterCount = bar.querySelector('#tp-filter-count');
    if (filterCount) {
      setTextIfChanged(filterCount, hiddenTotal > 0 ? String(hiddenTotal) : '');
      filterCount.style.display = hiddenTotal > 0 ? 'inline-flex' : 'none';
    }
    const dimCount = bar.querySelector('#tp-filter-dim-count');
    if (dimCount) {
      setTextIfChanged(dimCount, dimmedTotal > 0 ? String(dimmedTotal) : '');
      dimCount.style.display = dimmedTotal > 0 ? 'inline-flex' : 'none';
    }
    const hlCount = bar.querySelector('#tp-filter-hl-count');
    if (hlCount) {
      setTextIfChanged(hlCount, highlightedTotal > 0 ? String(highlightedTotal) : '');
      hlCount.style.display = highlightedTotal > 0 ? 'inline-flex' : 'none';
    }
    filterBtn.classList.toggle('tp-filters-paused', isPaused);
    filterBtn.classList.toggle('tp-tool-dim', !isPaused && hiddenTotal === 0 && dimmedTotal === 0 && highlightedTotal === 0);
    const hlText = highlightedTotal > 0 ? ` + Hervorgehoben (${highlightedTotal})` : '';
    const prefix = isPaused ? 'Filter (pausiert)' : 'Filter';
    filterBtn.title = `${prefix} – Verbergen (${hiddenTotal}) + Gedimmt (${dimmedTotal})${hlText} — Neg:${negHidden} Min:${minHidden} Preis:${priceHidden} Rabatt:${dealDiscHidden} Ersparnis:${savingsHidden} Händler:${dealerHidden} Fallback:${vortiefHidden} Ungeprüft:${uncheckedHiddenCount}`;
  }
  const setRowCount = (name, n, show) => {
    const badge = bar.querySelector(`[data-row-count="${name}"]`);
    if (!badge) return;
    setTextIfChanged(badge, show ? String(n) : '');
    badge.style.display = show ? 'inline-flex' : 'none';
  };
  setRowCount('neg', negHidden, negHidden > 0);
  setRowCount('min', minHidden, minHidden > 0);
  setRowCount('price', priceHidden, priceHidden > 0);
  setRowCount('deal-disc', dealDiscHidden, dealDiscHidden > 0);
  setRowCount('savings', savingsHidden, savingsHidden > 0);
  setRowCount('unchecked', uncheckedHiddenCount, uncheckedHiddenCount > 0);
  setRowCount('vortief', vortiefHidden, vortiefHidden > 0);
  setRowCount('dealer', dealerHidden, dealerHidden > 0);
  for (const key of ['FILTER_NEG_MODE', 'FILTER_MIN_MODE', 'FILTER_PRICE_MODE', 'FILTER_DEAL_DISCOUNT_MODE', 'FILTER_SAVINGS_MODE', 'HIDE_UNCHECKED_MODE', 'VORTIEF_MODE']) {
    bar.querySelectorAll(`[data-mode-key="${key}"]`).forEach(btn => paintCycleModeButton(btn, key));
  }
  {
    const dealerActive = counts.dealerActive === true;
    const mode = CONFIG.DEALER_MODE || 'dim';
    bar.querySelectorAll('[data-mode-key="DEALER_MODE"]').forEach(btn => {
      paintCycleButton(btn, dealerActive ? mode : 'off');
      btn.title = !dealerActive
        ? 'Filter: Normal — kein Händler gewählt'
        : mode === 'dim'
          ? 'Modus: Dimmen — klicken für Verbergen'
          : mode === 'hide'
            ? 'Modus: Verbergen — klicken für Hervorheben'
            : 'Modus: Hervorheben — klicken für Dimmen';
    });
  }
  const dealerRow = bar.querySelector('[data-filter-row="dealer"]');
  if (dealerRow) {
    dealerRow.classList.toggle('tp-row-inactive', !(counts.dealerActive === true));
    const note = dealerRow.querySelector('[data-dealer-note]');
    if (note) setTextIfChanged(note, counts.dealerActive === true ? 'greift bei gewähltem Händler' : 'inaktiv – kein Händler gewählt');
    const dealerBtn = dealerRow.querySelector('[data-mode-key="DEALER_MODE"]');
    if (dealerBtn) dealerBtn.disabled = !(counts.dealerActive === true);
  }

  const minRow = bar.querySelector('[data-filter-row="min"]');
  if (minRow) {
    minRow.classList.toggle('tp-row-inactive', !pageHasOffers);
    const note = minRow.querySelector('[data-min-note]');
    const stepper = minRow.querySelector('#tp-bar-min-offers-group');
    if (note) setTextIfChanged(note, pageHasOffers ? '' : 'inaktiv – keine Angebote auf Seite');
    if (stepper) stepper.style.display = pageHasOffers ? 'inline-flex' : 'none';
    minRow.querySelectorAll('button').forEach(btn => { btn.disabled = !pageHasOffers; });
  }

  bar.querySelector('.tp-input-field-box')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_NEG_ENABLED);
  bar.querySelector('#tp-bar-min-offers-group')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_MIN_ENABLED);
  bar.querySelector('#tp-bar-price-group')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_PRICE_ENABLED);
  bar.querySelector('#tp-bar-deal-disc-group')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_DEAL_DISCOUNT_ENABLED);
  bar.querySelector('#tp-bar-savings-group')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_SAVINGS_ENABLED);

  const minVal = bar.querySelector('#tp-bar-min-val');
  if (minVal) minVal.textContent = CONFIG.MIN_OFFERS;
  const dealDiscVal = bar.querySelector('#tp-bar-deal-disc-val');
  if (dealDiscVal) dealDiscVal.textContent = `${CONFIG.MIN_DEAL_DISCOUNT}%`;
}
