/**
 * Suite Filter Toolbar Component
 * Manages the inline/floating contextual filter bar, quick filters,
 * deal thresholds, chips, category filters, and scan progress.
 */

import { SELECTORS } from "../page/selectors.js";
import { getGroupEmoji, extractCategoryDisplay } from "../domain/category.js";
import { showToast } from "./toast.js";

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

export function renderSuiteFilterBar(counts = { neg: 0, cat: 0, min: 0, nonBest: 0, uncheckedDeals: 0, bestpreiseDeals: 0 }, pageHasOffers = false, isDealFeed = false) {
  const placement = getSuiteBarPlacement();
  if (!placement?.container) return;

  let bar = document.getElementById('tp-suite-filter-bar');
  const excluded = CONFIG.EXCLUDED_CATEGORIES || [];
  const isRevealed = document.body.classList.contains('tp-reveal-filtered');
  const totalHidden = (counts.neg || 0) + (counts.cat || 0) + (counts.min || 0) + (counts.nonBest || 0) + (counts.bestpreiseHidden || 0);
  const uncheckedDeals = counts.uncheckedDeals || 0;
  const bestpreiseDeals = counts.bestpreiseDeals || 0;

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'tp-suite-filter-bar';
    if (CONFIG.BESTPREISE_MODE_ACTIVE) bar.classList.add('tp-bestpreise-bar');
    bar.innerHTML = `
      <div class="tp-filter-main-row">
        <div class="tp-input-wrapper" title="Kommagetrennte Begriffe eingeben">
          <span class="tp-filter-badge" title="Toppreise Power Filter">⚡</span>
          <span class="tp-input-label-inline">🚫 Negativ-Filter:</span>
          <div class="tp-input-field-box">
            <input type="text" id="tp-inline-negative-input" placeholder="Wörter ausschließen..." value="${CONFIG.NEGATIVE_TERMS || ''}">
            <button id="tp-clear-neg-btn" title="Text leeren" style="display: ${CONFIG.NEGATIVE_TERMS ? 'block' : 'none'};">✕</button>
          </div>
        </div>
        <button class="tp-bar-btn ${isRevealed ? 'tp-active' : ''}" id="tp-bar-reveal-btn" title="Ausgeblendete Produkte anzeigen/verbergen">
          👁️ <span id="tp-bar-reveal-count">${totalHidden}</span>
        </button>
        <button class="tp-bar-btn ${CONFIG.HEATMAP_ENABLED ? 'tp-active' : ''}" id="tp-bar-heat-btn" title="Rabatt-Heatmap ein-/ausschalten" style="display: flex;">🔥 Heatmap</button>
        <button class="tp-bar-btn ${CONFIG.BESTPREISE_MODE_ACTIVE ? 'tp-bestpreise-active' : ''}" id="tp-bar-bestpreise-btn" title="Neue Bestpreise Modus: Verifizierte Bestpreise nach echtem Rabatt filtern und sortieren" style="display: ${isDealFeed ? 'flex' : 'none'};">
          💎 Neue Bestpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>
        </button>
        <div class="tp-threshold-wrapper" id="tp-bar-weight-wrapper" style="display: ${isDealFeed && CONFIG.BESTPREISE_MODE_ACTIVE ? 'inline-flex' : 'none'};">
          <button class="tp-threshold-btn" id="tp-bar-weight-btn" title="Deal-Score Gewichtung wählen" style="border-left: 1px solid rgba(255, 255, 255, 0.12) !important; border-radius: 8px !important;">
            ⚖️ 50/50 ▾
          </button>
          <div class="tp-threshold-popover" id="tp-weight-popover" style="min-width: 170px;">
            <button class="tp-threshold-option" data-weight="0.50">⚖️ 50/50 (Ausgewogen)</button>
            <button class="tp-threshold-option" data-weight="1.00">🌟 100% Rekord (Nur Rekorde)</button>
            <button class="tp-threshold-option" data-weight="0.70">🔥 70% Rekord / 30% Median</button>
            <button class="tp-threshold-option" data-weight="0.30">💎 30% Rekord / 70% Median</button>
            <button class="tp-threshold-option" data-weight="0.00">📊 100% Median (Marktpreis)</button>
          </div>
        </div>
        <div class="tp-threshold-wrapper" id="tp-bar-threshold-wrapper" style="display: inline-flex;">
          <button class="tp-bar-btn ${isBatchChecking ? 'tp-batch-active' : ''}" id="tp-bar-batch-check-btn" data-unchecked-count="${uncheckedDeals}" title="${isDealFeed ? (uncheckedDeals > 0 ? `Tiefstpreise für ${uncheckedDeals} Deals ab ${CONFIG.REAL_DEAL_MIN_DISCOUNT || 30}% Rabatt prüfen` : `Keine ungeprüften Deals ab ${CONFIG.REAL_DEAL_MIN_DISCOUNT || 30}% Rabatt vorhanden`) : (uncheckedDeals > 0 ? `Tiefstpreise für ${uncheckedDeals} Produkte prüfen` : `Alle sichtbaren Produkte bereits geprüft`)}" style="${isDealFeed ? 'border-top-right-radius: 0 !important; border-bottom-right-radius: 0 !important; border-right: none !important;' : 'border-radius: 8px !important;'}">
            ${isBatchChecking ? '⏳ Prüfen...' : `🔍 Check Deals (${uncheckedDeals})`}
          </button>
          <button class="tp-threshold-btn" id="tp-bar-threshold-btn" style="display: ${isDealFeed ? 'block' : 'none'};" title="Mindest-Rabatt für Deal-Check wählen (aktuell ≥${CONFIG.REAL_DEAL_MIN_DISCOUNT || 30}%)">≥${CONFIG.REAL_DEAL_MIN_DISCOUNT || 30}% ▾</button>
          <div class="tp-threshold-popover" id="tp-threshold-popover">
            <button class="tp-threshold-option ${(CONFIG.REAL_DEAL_MIN_DISCOUNT || 30) === 20 ? 'tp-selected' : ''}" data-val="20">≥ 20%</button>
            <button class="tp-threshold-option ${(CONFIG.REAL_DEAL_MIN_DISCOUNT || 30) === 30 ? 'tp-selected' : ''}" data-val="30">≥ 30%</button>
            <button class="tp-threshold-option ${(CONFIG.REAL_DEAL_MIN_DISCOUNT || 30) === 40 ? 'tp-selected' : ''}" data-val="40">≥ 40%</button>
            <button class="tp-threshold-option ${(CONFIG.REAL_DEAL_MIN_DISCOUNT || 30) === 50 ? 'tp-selected' : ''}" data-val="50">≥ 50%</button>
            <button class="tp-threshold-option ${(CONFIG.REAL_DEAL_MIN_DISCOUNT || 30) === 60 ? 'tp-selected' : ''}" data-val="60">≥ 60%</button>
          </div>
        </div>
        <button class="tp-bar-btn ${isBlockedCatsOpen ? 'tp-active' : ''}" id="tp-bar-cats-toggle" style="display: ${excluded.length > 0 ? 'flex' : 'none'};" title="Ausgeblendete Kategorien anzeigen/verbergen">
          🚫 <span id="tp-bar-cats-count">${excluded.length}</span> ${isBlockedCatsOpen ? '▴' : '▾'}
        </button>
        <div class="tp-bar-stepper-group" id="tp-bar-min-offers-group" style="display: ${pageHasOffers ? 'flex' : 'none'};">
          <span>Min:</span>
          <button class="tp-stepper-btn" id="tp-bar-min-minus">-</button>
          <span id="tp-bar-min-val" style="min-width: 14px; text-align: center;">${CONFIG.MIN_OFFERS}</span>
          <button class="tp-stepper-btn" id="tp-bar-min-plus">+</button>
        </div>
        <div class="tp-filter-toggles-group" style="display: flex; gap: 4px; margin-left: auto;">
          <button class="tp-bar-btn tp-filter-toggle-btn ${CONFIG.FILTER_NEG_ENABLED ? 'tp-active' : 'tp-filter-off'}" id="tp-toggle-neg" title="Negativ-Filter (Text) ${CONFIG.FILTER_NEG_ENABLED ? 'AN' : 'AUS'}">
            📝
          </button>
          <button class="tp-bar-btn tp-filter-toggle-btn ${CONFIG.FILTER_CAT_ENABLED ? 'tp-active' : 'tp-filter-off'}" id="tp-toggle-cat" title="Kategorien-Filter ${CONFIG.FILTER_CAT_ENABLED ? 'AN' : 'AUS'}">
            🚫
          </button>
          <button class="tp-bar-btn tp-filter-toggle-btn ${CONFIG.FILTER_MIN_ENABLED ? 'tp-active' : 'tp-filter-off'}" id="tp-toggle-min" title="Min-Angebote-Filter ${CONFIG.FILTER_MIN_ENABLED ? 'AN' : 'AUS'}">
            🔢
          </button>
          <button class="tp-bar-btn tp-filter-toggle-btn ${CONFIG.FILTER_BESTPREIS_ENABLED ? 'tp-active' : 'tp-filter-off'}" id="tp-toggle-bestpreis" title="Deal-Filter ${CONFIG.FILTER_BESTPREIS_ENABLED ? 'AN' : 'AUS'}">
            💎
          </button>
        </div>
      </div>
      <div id="tp-blocked-cats-container" class="tp-blocked-cats-row" style="display: ${excluded.length > 0 && isBlockedCatsOpen ? 'flex' : 'none'};">
        <span class="tp-blocked-cats-label">🚫 Ausgeblendet (${excluded.length}):</span>
        <div id="tp-blocked-chips-list" style="display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center;"></div>
        <button class="tp-blocked-clear-all" id="tp-blocked-clear-all-btn">Alle freigeben</button>
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
      processListings();
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
        showToast(next ? '💎 Neue Bestpreise-Modus aktiviert' : 'Bestpreise-Modus deaktiviert');
      };
    }


    const batchBtn = bar.querySelector('#tp-bar-batch-check-btn');
    if (batchBtn) {
      batchBtn.onclick = () => {
        if (isBatchChecking) {
          cancelBatchDealCheck();
          const curCount = parseInt(batchBtn.dataset.uncheckedCount || '0', 10);
          batchBtn.innerHTML = `🔍 Check Deals (${curCount})`;
          batchBtn.classList.remove('tp-batch-active');
          showToast('Batch-Prüfung abgebrochen');
          return;
        }
        const curCount = parseInt(batchBtn.dataset.uncheckedCount || '0', 10);
        if (curCount === 0) {
          showToast('Keine ungeprüften Deals vorhanden');
          return;
        }
        batchBtn.classList.add('tp-batch-active');
        batchBtn.innerHTML = '⏳ Starte...';
        runBatchDealCheck(
          CONFIG.REAL_DEAL_MIN_DISCOUNT || 30,
          (curr, total) => {
            if (batchBtn) {
              batchBtn.innerHTML = `⏳ Prüfe (${curr}/${total}) <span title="Abbrechen" style="font-weight:700;margin-left:4px;">✕</span>`;
            }
          },
          (completed, total) => {
            if (batchBtn) {
              batchBtn.classList.remove('tp-batch-active');
              if (total > 0) {
                batchBtn.innerHTML = `✅ ${completed}/${total} geprüft`;
                setTimeout(() => {
                  if (batchBtn && !isBatchChecking) {
                    processListings();
                  }
                }, 3000);
                showToast(`${completed} Deal-Tiefstpreise verifiziert`);
              } else {
                processListings();
                showToast('Keine ungeprüften Deals vorhanden');
              }
            }
          },
          statusText => {
            if (batchBtn) {
              batchBtn.innerHTML = `${statusText} <span title="Abbrechen" style="font-weight:700;margin-left:4px;">✕</span>`;
            }
          }
        );
      };
    }

    const threshBtn = bar.querySelector('#tp-bar-threshold-btn');
    const threshPopover = bar.querySelector('#tp-threshold-popover');
    const weightBtn = bar.querySelector('#tp-bar-weight-btn');
    const weightPopover = bar.querySelector('#tp-weight-popover');

    if (threshBtn && threshPopover) {
      threshBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        weightPopover?.classList.remove('tp-show');
        weightBtn?.classList.remove('tp-open');
        const isOpen = threshPopover.classList.toggle('tp-show');
        threshBtn.classList.toggle('tp-open', isOpen);
      };

      threshPopover.querySelectorAll('.tp-threshold-option').forEach(opt => {
        opt.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          const val = parseInt(opt.dataset.val, 10);
          if (!isNaN(val)) {
            threshPopover.classList.remove('tp-show');
            threshBtn.classList.remove('tp-open');
            updateConfig('REAL_DEAL_MIN_DISCOUNT', val);
            showToast(`Mindest-Rabatt für Deals auf ${val}% gesetzt`);
          }
        };
      });
    }

    if (weightBtn && weightPopover) {
      weightBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        threshPopover?.classList.remove('tp-show');
        threshBtn?.classList.remove('tp-open');
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
            showToast(`Deal-Score Gewichtung: ${Math.round((1 - w) * 100)}% Median / ${Math.round(w * 100)}% Rekord`);
          }
        };
      });
    }

    if (!window._tpDocClickBound) {
      window._tpDocClickBound = true;
      document.addEventListener('click', () => {
        document.getElementById('tp-threshold-popover')?.classList.remove('tp-show');
        document.getElementById('tp-bar-threshold-btn')?.classList.remove('tp-open');
        document.getElementById('tp-weight-popover')?.classList.remove('tp-show');
        document.getElementById('tp-bar-weight-btn')?.classList.remove('tp-open');
      });
    }

    bar.querySelector('#tp-bar-cats-toggle').onclick = () => {
      isBlockedCatsOpen = !isBlockedCatsOpen;
      processListings();
    };

    const updateMinOffers = delta => {
      const next = Math.max(0, CONFIG.MIN_OFFERS + delta);
      if (next !== CONFIG.MIN_OFFERS) {
        updateConfig('MIN_OFFERS', next);
      }
    };

    bar.querySelector('#tp-bar-min-minus').onclick = () => updateMinOffers(-1);
    bar.querySelector('#tp-bar-min-plus').onclick = () => updateMinOffers(1);
    bar.querySelector('#tp-toggle-neg').onclick = () => {
      const next = !CONFIG.FILTER_NEG_ENABLED;
      updateConfig('FILTER_NEG_ENABLED', next);
      showToast(next ? '📝 Negativ-Filter AN' : '📝 Negativ-Filter AUS');
    };
    bar.querySelector('#tp-toggle-cat').onclick = () => {
      const next = !CONFIG.FILTER_CAT_ENABLED;
      updateConfig('FILTER_CAT_ENABLED', next);
      showToast(next ? '🚫 Kategorien-Filter AN' : '🚫 Kategorien-Filter AUS');
    };
    bar.querySelector('#tp-toggle-min').onclick = () => {
      const next = !CONFIG.FILTER_MIN_ENABLED;
      updateConfig('FILTER_MIN_ENABLED', next);
      showToast(next ? '🔢 Min-Angebote-Filter AN' : '🔢 Min-Angebote-Filter AUS');
    };
    bar.querySelector('#tp-toggle-bestpreis').onclick = () => {
      const next = !CONFIG.FILTER_BESTPREIS_ENABLED;
      updateConfig('FILTER_BESTPREIS_ENABLED', next);
      showToast(next ? '💎 Deal-Filter AN' : '💎 Deal-Filter AUS');
    };
    bar.querySelector('#tp-blocked-clear-all-btn').onclick = () => {
      const prevCats = [...(CONFIG.EXCLUDED_CATEGORIES || [])];
      updateConfig('EXCLUDED_CATEGORIES', []);
      showToast('Alle blockierten Kategorien freigegeben', 5000, 'Rückgängig', () => {
        updateConfig('EXCLUDED_CATEGORIES', prevCats);
        showToast('Blockierte Kategorien wiederhergestellt');
      });
    };
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
    if (isBestpreiseScanning) {
      // Leave dynamic text during scan
    } else if (CONFIG.BESTPREISE_MODE_ACTIVE) {
      bestpreiseBtn.innerHTML = `💎 Bestpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals} Deals)</span>`;
    } else {
      bestpreiseBtn.innerHTML = `💎 Neue Bestpreise <span id="tp-bar-bestpreise-count" style="display: ${bestpreiseDeals > 0 ? 'inline' : 'none'}; font-size: 10px; opacity: 0.85;">(${bestpreiseDeals})</span>`;
    }
  }

  const toggleNeg = bar.querySelector('#tp-toggle-neg');
  if (toggleNeg) {
    toggleNeg.classList.toggle('tp-active', CONFIG.FILTER_NEG_ENABLED);
    toggleNeg.classList.toggle('tp-filter-off', !CONFIG.FILTER_NEG_ENABLED);
    toggleNeg.title = `Negativ-Filter (Text) ${CONFIG.FILTER_NEG_ENABLED ? 'AN' : 'AUS'}`;
  }
  const toggleCat = bar.querySelector('#tp-toggle-cat');
  if (toggleCat) {
    toggleCat.classList.toggle('tp-active', CONFIG.FILTER_CAT_ENABLED);
    toggleCat.classList.toggle('tp-filter-off', !CONFIG.FILTER_CAT_ENABLED);
    toggleCat.title = `Kategorien-Filter ${CONFIG.FILTER_CAT_ENABLED ? 'AN' : 'AUS'}`;
  }
  const toggleMin = bar.querySelector('#tp-toggle-min');
  if (toggleMin) {
    toggleMin.classList.toggle('tp-active', CONFIG.FILTER_MIN_ENABLED);
    toggleMin.classList.toggle('tp-filter-off', !CONFIG.FILTER_MIN_ENABLED);
    toggleMin.title = `Min-Angebote-Filter ${CONFIG.FILTER_MIN_ENABLED ? 'AN' : 'AUS'}`;
  }
  const toggleBestpreis = bar.querySelector('#tp-toggle-bestpreis');
  if (toggleBestpreis) {
    toggleBestpreis.classList.toggle('tp-active', CONFIG.FILTER_BESTPREIS_ENABLED);
    toggleBestpreis.classList.toggle('tp-filter-off', !CONFIG.FILTER_BESTPREIS_ENABLED);
    toggleBestpreis.title = `Deal-Filter ${CONFIG.FILTER_BESTPREIS_ENABLED ? 'AN' : 'AUS'}`;
  }

  const batchBtn = bar.querySelector('#tp-bar-batch-check-btn');
  if (batchBtn && !isBatchChecking) {
    batchBtn.dataset.uncheckedCount = String(uncheckedDeals);
    batchBtn.classList.remove('tp-disabled');
    const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
    batchBtn.title = isDealFeed
      ? (uncheckedDeals > 0 ? `Tiefstpreise für ${uncheckedDeals} Deals ab ${minDisc}% Rabatt prüfen` : `Keine ungeprüften Deals ab ${minDisc}% Rabatt vorhanden`)
      : (uncheckedDeals > 0 ? `Tiefstpreise für ${uncheckedDeals} Produkte prüfen` : `Alle sichtbaren Produkte bereits geprüft`);
    batchBtn.innerHTML = `🔍 Check Deals (${uncheckedDeals})`;
    batchBtn.classList.remove('tp-batch-active');
    batchBtn.style.setProperty('border-top-right-radius', isDealFeed ? '0' : '8px', 'important');
    batchBtn.style.setProperty('border-bottom-right-radius', isDealFeed ? '0' : '8px', 'important');
    batchBtn.style.setProperty('border-right', isDealFeed ? 'none' : '1px solid rgba(255,255,255,0.15)', 'important');
  }

  const threshBtn = bar.querySelector('#tp-bar-threshold-btn');
  if (threshBtn) {
    const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
    threshBtn.textContent = `≥${minDisc}% ▾`;
    threshBtn.title = `Mindest-Rabatt für Deal-Check wählen (aktuell ≥${minDisc}%)`;
    threshBtn.style.setProperty('display', isDealFeed ? 'block' : 'none', 'important');
  }
  const threshPopover = bar.querySelector('#tp-threshold-popover');
  if (threshPopover) {
    const minDisc = CONFIG.REAL_DEAL_MIN_DISCOUNT || 30;
    threshPopover.querySelectorAll('.tp-threshold-option').forEach(opt => {
      opt.classList.toggle('tp-selected', parseInt(opt.dataset.val, 10) === minDisc);
    });
  }

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
    weightBtn.title = `Deal-Score Gewichtung wählen (aktuell: ${Math.round((1 - curWeight) * 100)}% Median / ${Math.round(curWeight * 100)}% Neuer Rekord)`;
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

  const catsToggleBtn = bar.querySelector('#tp-bar-cats-toggle');
  if (catsToggleBtn) {
    catsToggleBtn.style.display = excluded.length > 0 ? 'flex' : 'none';
    catsToggleBtn.classList.toggle('tp-active', isBlockedCatsOpen);
    catsToggleBtn.innerHTML = `🚫 <span id="tp-bar-cats-count">${excluded.length}</span> ${isBlockedCatsOpen ? '▴' : '▾'}`;
  }

  const minGroup = bar.querySelector('#tp-bar-min-offers-group');
  if (minGroup) minGroup.style.display = pageHasOffers ? 'flex' : 'none';
  const minVal = bar.querySelector('#tp-bar-min-val');
  if (minVal) minVal.textContent = CONFIG.MIN_OFFERS;

  const blockedContainer = bar.querySelector('#tp-blocked-cats-container');
  const chipsList = bar.querySelector('#tp-blocked-chips-list');
  if (blockedContainer && chipsList) {
    const showDrawer = excluded.length > 0 && isBlockedCatsOpen;
    blockedContainer.classList.toggle('tp-expanded', showDrawer);
    blockedContainer.classList.toggle('tp-collapsed', !showDrawer);
    blockedContainer.style.setProperty('display', showDrawer ? 'flex' : 'none', 'important');

    if (excluded.length > 0) {
      chipsList.replaceChildren();
      const labelEl = blockedContainer.querySelector('.tp-blocked-cats-label');
      if (labelEl) labelEl.textContent = `🚫 Ausgeblendet (${excluded.length}):`;

      excluded.forEach(key => {
        const info = extractCategoryDisplay(key);
        const chip = document.createElement('span');
        chip.className = 'tp-blocked-chip';
        chip.textContent = `${getGroupEmoji(info.group)} `;
        const chipLabel = document.createElement('span');
        chipLabel.textContent = info.label;
        const chipRemove = document.createElement('span');
        chipRemove.className = 'tp-blocked-chip-remove';
        chipRemove.title = 'Wieder einblenden';
        chipRemove.textContent = '✕';
        chip.append(chipLabel, ' ', chipRemove);
        chip.querySelector('.tp-blocked-chip-remove').onclick = e => {
          e.stopPropagation();
          saveConfigKey('EXCLUDED_CATEGORIES', (CONFIG.EXCLUDED_CATEGORIES || []).filter(c => c !== key));
          processListings();
          showToast(`Kategorie "${info.label}" wieder eingeblendet`);
        };
        chipsList.appendChild(chip);
      });
    } else {
      chipsList.replaceChildren();
    }
  }
}
