/**
 * Toolbar filter row (split from ui/toolbar.js): cycle buttons, negative-input/
 * stepper wiring, filter popover, row-count badges, dealer-row paint.
 */

import { CONFIG, updateConfig, updateConfigs, FILTER_CYCLE, cycleStateOf } from '../state/config.js';
import { showToast } from './toast.js';
import { setTextIfChanged } from './badges.js';
import { paintCycleButton } from './mini-toggle.js';

const CYCLE_TITLE = {
  off: 'Filter: Normal — klicken für Dimmen',
  dim: 'Filter: Dimmen — klicken für Verbergen',
  hide: 'Filter: Verbergen — klicken für Hervorheben',
  highlight: 'Filter: Hervorheben — klicken für Normal'
};
const CYCLE_TOASTS = {
  FILTER_NEG_MODE: { dim: '📝 Begriffe: Dimmen', hide: '📝 Begriffe: Verbergen', highlight: '📝 Begriffe: Hervorheben', off: '📝 Begriffe: Normal' },
  FILTER_MIN_MODE: { dim: '🔢 Min-Angebote: Dimmen', hide: '🔢 Min-Angebote: Verbergen', highlight: '🔢 Min-Angebote: Hervorheben', off: '🔢 Min-Angebote: Normal' },
  HIDE_UNCHECKED_MODE: { dim: '✓ Ungeprüfte: Dimmen', hide: '✓ Ungeprüfte: Verbergen', highlight: '✓ Ungeprüfte: Hervorheben', off: '✓ Ungeprüfte: Normal — alle werden angezeigt' },
  VORTIEF_MODE: { dim: 'Fallback-Tiefs werden gedimmt', hide: 'Fallback-Tiefs ausgeschlossen (Filtergrund)', highlight: 'Fallback-Tiefs werden hervorgehoben', off: 'Fallback-Tiefs eingeschlossen' },
};
function paintCycleModeButton(btn, modeKey) {
  const s = cycleStateOf(modeKey);
  paintCycleButton(btn, s);
  btn.title = CYCLE_TITLE[s];
}
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
        updateConfigs({ FILTER_NEG_MODE: 'dim', FILTER_MIN_MODE: 'dim', HIDE_UNCHECKED_MODE: 'dim', VORTIEF_MODE: 'dim', DEALER_MODE: 'dim', FILTER_NEG_ENABLED: false, FILTER_MIN_ENABLED: false, BESTPREISE_HIDE_UNCHECKED: false, BESTPREISE_INCLUDE_VORTIEF: true, MIN_OFFERS: 0, NEGATIVE_TERMS: '' });
        showToast('Filter zurückgesetzt');
      };
    }
  }

  const updateMinOffers = delta => {
    const next = Math.max(0, CONFIG.MIN_OFFERS + delta);
    if (next !== CONFIG.MIN_OFFERS) {
      updateConfigs({ MIN_OFFERS: next, FILTER_MIN_ENABLED: next > 0 });
    }
  };

  bar.querySelector('#tp-bar-min-minus').onclick = () => updateMinOffers(-1);
  bar.querySelector('#tp-bar-min-plus').onclick = () => updateMinOffers(1);
}

export function syncFilterRow(bar, counts, flags) {
  const { isDealFeed = false, pageHasOffers = false } = flags || {};
  const negHidden = counts.neg || 0;
  const minHidden = counts.min || 0;
  const vortiefHidden = counts.vortief || 0;
  const uncheckedHiddenCount = counts.uncheckedHidden || 0;
  const dealerHidden = counts.dealer || 0;

  const input = bar.querySelector('#tp-inline-negative-input');
  const clearBtn = bar.querySelector('#tp-clear-neg-btn');
  if (input && document.activeElement !== input) {
    input.value = CONFIG.NEGATIVE_TERMS || '';
    if (clearBtn) clearBtn.style.display = CONFIG.NEGATIVE_TERMS ? 'block' : 'none';
  }

  const hiddenTotal = counts.filteredCount || 0;
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
    const highlightedTotal = counts.highlighted || 0;
    filterBtn.classList.toggle('tp-tool-dim', hiddenTotal === 0 && dimmedTotal === 0 && highlightedTotal === 0);
    const hlText = highlightedTotal > 0 ? ` + Hervorgehoben (${highlightedTotal})` : '';
    filterBtn.title = `Filter – Verbergen (${hiddenTotal}) + Gedimmt (${dimmedTotal})${hlText} — Neg:${negHidden} Min:${minHidden} Händler:${dealerHidden} Fallback:${vortiefHidden} Ungeprüft:${uncheckedHiddenCount}`;
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
  setRowCount('vortief', vortiefHidden, vortiefHidden > 0);
  setRowCount('dealer', dealerHidden, dealerHidden > 0);
  for (const key of ['FILTER_NEG_MODE', 'FILTER_MIN_MODE', 'HIDE_UNCHECKED_MODE', 'VORTIEF_MODE']) {
    bar.querySelectorAll(`[data-mode-key="${key}"]`).forEach(btn => paintCycleModeButton(btn, key));
  }
  {
    const dealerActive = counts.dealerActive === true;
    const mode = CONFIG.DEALER_MODE || 'dim';
    bar.querySelectorAll('[data-mode-key="DEALER_MODE"]').forEach(btn => {
      if (!dealerActive) {
        btn.classList.toggle('tp-active', false);
        btn.classList.toggle('tp-state-highlight', false);
        setTextIfChanged(btn, 'Normal');
        btn.title = 'Filter: Normal — kein Händler gewählt';
      } else {
        btn.classList.toggle('tp-active', true);
        btn.classList.toggle('tp-state-highlight', mode === 'highlight');
        setTextIfChanged(btn, mode === 'highlight' ? 'Hervorheben' : mode === 'dim' ? 'Dimmen' : 'Verbergen');
        btn.title = mode === 'dim'
          ? 'Modus: Dimmen — klicken für Verbergen'
          : mode === 'hide'
            ? 'Modus: Verbergen — klicken für Hervorheben'
            : 'Modus: Hervorheben — klicken für Dimmen';
      }
    });
  }
  const uncheckedRow = bar.querySelector('[data-filter-row="unchecked"]');
  if (uncheckedRow) uncheckedRow.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
  const vortiefRow = bar.querySelector('[data-filter-row="vortief"]');
  if (vortiefRow) vortiefRow.style.setProperty('display', isDealFeed ? 'flex' : 'none', 'important');
  const dealerRow = bar.querySelector('[data-filter-row="dealer"]');
  if (dealerRow) {
    dealerRow.classList.toggle('tp-row-inactive', !(counts.dealerActive === true));
    const note = dealerRow.querySelector('[data-dealer-note]');
    if (note) setTextIfChanged(note, counts.dealerActive === true ? 'greift bei gewähltem Händler' : 'inaktiv – kein Händler gewählt');
    const dealerBtn = dealerRow.querySelector('[data-mode-key="DEALER_MODE"]');
    if (dealerBtn) dealerBtn.disabled = !(counts.dealerActive === true);
  }

  bar.querySelector('.tp-input-field-box')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_NEG_ENABLED);
  bar.querySelector('#tp-bar-min-offers-group')?.classList.toggle('tp-tool-dim', !CONFIG.FILTER_MIN_ENABLED);

  const minRow = bar.querySelector('[data-filter-row="min"]');
  if (minRow) minRow.style.setProperty('display', pageHasOffers ? 'flex' : 'none', 'important');
  const minVal = bar.querySelector('#tp-bar-min-val');
  if (minVal) minVal.textContent = CONFIG.MIN_OFFERS;
}
