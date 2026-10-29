/**
 * Configuration UI Control Synchronization Layer
 * Synchronizes configuration state changes with modal and toolbar UI controls.
 */

import { uiShadowRoot } from '../ui/shell.js';
import { syncMiniToggle, paintCycleButton } from '../ui/mini-toggle.js';
import { weightText, horizonText, horizonStoredToUi } from './config-store.js';
import { CONFIG, FILTER_CYCLE, paintMinPoints, notifyAlarmConfig, paintCycleButtons } from './config.js';

export function syncUiControl(key, val, opts = {}, shadowRoot = null) {
  // 1. Sync Settings Modal (Shadow DOM) if open/exists
  const shadow = shadowRoot ?? opts?.shadowRoot ?? uiShadowRoot ?? (typeof document !== 'undefined' ? document.getElementById('tp-root')?.shadowRoot : null);
  if (shadow) {
    try {
      switch (key) {
        case 'DIM_OPACITY': {
          const range = shadow.getElementById('tp-opacity-range');
          const label = shadow.getElementById('tp-opacity-val');
          if (range) range.value = val;
          if (label) label.value = Math.round(val * 100);
          break;
        }
        case 'HEATMAP_INTENSITY': {
          const range = shadow.getElementById('tp-heatmap-intensity-range');
          const valEl = shadow.getElementById('tp-heatmap-intensity-val');
          const pct = Math.round((val ?? 1.0) * 100);
          if (range) range.value = pct;
          if (valEl) valEl.value = pct;
          break;
        }
        case 'MARGIN_PERCENT': {
          const range = shadow.getElementById('tp-margin-range');
          const valEl = shadow.getElementById('tp-margin-val');
          if (range) range.value = val;
          if (valEl) valEl.value = val;
          break;
        }
        case 'SORT_BY_OFFERS': {
          const radio = shadow.querySelector(`input[name="tp-sort-offers"][value="${val}"]`);
          if (radio) radio.checked = true;
          break;
        }
        case 'BESTPREISE_MODE_ACTIVE': {
          const toggle = shadow.getElementById('tp-bestpreise-mode-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'BESTPREISE_WEIGHT_RECORD': {
          const range = shadow.getElementById('tp-bestpreise-weight-range');
          const valEl = shadow.getElementById('tp-bestpreise-weight-val');
          const descEl = shadow.getElementById('tp-bestpreise-weight-desc');
          const pct = Math.round((val ?? 0.5) * 100);
          if (range) range.value = pct;
          if (valEl) valEl.value = pct;
          if (descEl) {
            descEl.textContent = weightText(val, 'desc');
          }
          // Toolbar slider mirrors the modal control (skip while dragging).
          if (typeof document !== 'undefined') {
            const barRange = document.getElementById('tp-bar-weight-range');
            if (barRange && document.activeElement !== barRange) barRange.value = pct;
            const barLabel = document.getElementById('tp-bar-weight-label');
            if (barLabel) {
              barLabel.textContent = `⚖️ ${weightText(val, 'short')}`;
              barLabel.title = weightText(val, 'title');
            }
          }
          break;
        }
        case 'BESTPREISE_MIN_POINTS': {
          paintMinPoints(val, shadow);
          break;
        }
        case 'BESTPREISE_MEDIAN_HORIZON_DAYS': {
          const stored = val ?? 365;
          const horizonRange = shadow.getElementById('tp-bestpreise-horizon-range');
          if (horizonRange) horizonRange.value = horizonStoredToUi(stored);
          const horizonVal = shadow.getElementById('tp-bestpreise-horizon-val');
          if (horizonVal) horizonVal.value = stored;
          const horizonDesc = shadow.getElementById('tp-bestpreise-horizon-desc');
          if (horizonDesc) horizonDesc.textContent = `Ø-Vergleich: ${horizonText(stored)} (0 = gesamte Historie / Lifetime, Vorgabe: 1J). Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis.`;
          // Toolbar range mirrors the modal control (skip while interacting).
          if (typeof document !== 'undefined') {
            const barRange = document.getElementById('tp-bar-horizon-range');
            if (barRange && document.activeElement !== barRange) {
              barRange.value = horizonStoredToUi(stored);
              const barLabel = document.getElementById('tp-bar-horizon-label');
              if (barLabel) {
                barLabel.textContent = horizonText(stored);
                barLabel.title = horizonText(stored, 'title');
              }
            }
          }
          break;
        }
        case 'REAL_DEAL_MIN_DISCOUNT': {
          const range = shadow.getElementById('tp-real-deal-min-range');
          const valEl = shadow.getElementById('tp-real-deal-min-val');
          if (range) range.value = val;
          if (valEl) valEl.value = val;
          break;
        }
        case 'CACHE_MEMORY_LIMIT': {
          const range = shadow.getElementById('tp-cache-memory-range');
          const valEl = shadow.getElementById('tp-cache-memory-val');
          if (range) range.value = val;
          if (valEl) valEl.value = val;
          break;
        }
        case 'CACHE_DISK_LIMIT': {
          const range = shadow.getElementById('tp-cache-disk-range');
          const valEl = shadow.getElementById('tp-cache-disk-val');
          if (range) range.value = val;
          if (valEl) valEl.value = val;
          break;
        }
        case 'USE_SHIPPING_PRICE': {
          const toggle = shadow.getElementById('tp-shipping-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'HIDE_ADS': {
          const toggle = shadow.getElementById('tp-hide-ads-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'ENABLE_SPARKLINES': {
          const toggle = shadow.getElementById('tp-sparklines-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'KEEPA_CHART_ENABLED': {
          const toggle = shadow.getElementById('tp-keepa-chart-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'DEALER_AUTOFETCH': {
          const toggle = shadow.getElementById('tp-dealer-autofetch-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'REVIEW_SEARCH_ENABLED': {
          const toggle = shadow.getElementById('tp-review-search-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'REVIEW_SEARCH_KEYWORD': {
          const input = shadow.getElementById('tp-review-keyword-input');
          if (input) input.value = val;
          break;
        }
        case 'REVIEW_SEARCH_AI_MODE': {
          const toggle = shadow.getElementById('tp-review-ai-mode-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'TAVILY_ENABLED': {
          const toggle = shadow.getElementById('tp-tavily-enabled-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'TAVILY_SEARCH_DEPTH': {
          const select = shadow.getElementById('tp-tavily-search-depth');
          if (select) select.value = val || 'basic';
          break;
        }
        case 'TAVILY_MAX_RESULTS': {
          const select = shadow.getElementById('tp-tavily-max-results');
          if (select) select.value = String(val || 5);
          break;
        }
        case 'DISCORD_SUPPRESS_DEALER_EMBED': {
          const toggle = shadow.getElementById('tp-discord-dealer-embed-toggle');
          if (toggle) toggle.checked = val === false;
          break;
        }
        case 'DISCORD_SUPPRESS_PRODUCT_EMBED': {
          const toggle = shadow.getElementById('tp-discord-product-embed-toggle');
          if (toggle) toggle.checked = val === false;
          break;
        }
        case 'DISCORD_FORUM_TITLE': {
          const toggle = shadow.getElementById('tp-discord-forum-title-toggle');
          if (toggle) toggle.checked = val === true;
          break;
        }
        case 'ALARM_ENABLED': {
          const toggle = shadow.getElementById('tp-alarm-enabled-toggle');
          if (toggle) toggle.checked = val !== false;
          if (!opts.silent) notifyAlarmConfig();
          break;
        }
        case 'ALARM_TARGET_PERCENT': {
          const pct = Math.round((Number.isFinite(val) ? val : 0.60) * 100);
          const range = shadow.getElementById('tp-alarm-target-range');
          const num = shadow.getElementById('tp-alarm-target-val');
          if (range) range.value = pct;
          if (num) num.value = pct;
          if (!opts.silent) notifyAlarmConfig();
          break;
        }
        case 'ALARM_DURATION_DAYS': {
          const radio = shadow.querySelector(`input[name="tp-alarm-duration"][value="${val}"]`);
          if (radio) radio.checked = true;
          if (!opts.silent) notifyAlarmConfig();
          break;
        }
        case 'ALARM_AUTO_SUBMIT': {
          const toggle = shadow.getElementById('tp-alarm-autosubmit-toggle');
          if (toggle) toggle.checked = val !== false;
          if (!opts.silent) notifyAlarmConfig();
          break;
        }
      }
    } catch (err) {
      console.warn('[Toppreise-Suite] syncUiControl error', err);
    }
  }

  // 2. Sync Inline Filter Bar if present
  if (typeof document !== 'undefined') {
    const bar = document.getElementById('tp-suite-filter-bar') || document.getElementById('tp-inline-filter-bar');
    if (bar) {
      try {
        switch (key) {
          case 'NEGATIVE_TERMS': {
            const input = bar.querySelector('#tp-inline-negative-input');
            const clearBtn = bar.querySelector('#tp-clear-neg-btn');
            if (input && document.activeElement !== input && input.value !== val) {
              input.value = val || '';
            }
            if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
            break;
          }
          case 'HEATMAP_ENABLED': {
            const heatBtn = bar.querySelector('#tp-bar-heat-btn');
            if (heatBtn) {
              heatBtn.classList.toggle('tp-active', val !== false);
              heatBtn.setAttribute('aria-pressed', String(val !== false));
            }
            break;
          }
          case 'BESTPREISE_MODE_ACTIVE': {
            const bpBtn = bar.querySelector('#tp-bar-bestpreise-btn');
            if (bpBtn) bpBtn.classList.toggle('tp-bestpreise-active', val === true);
            bar.classList.toggle('tp-bestpreise-bar', val === true);
            break;
          }
          case 'BESTPREISE_HIDE_UNCHECKED': {
            paintCycleButtons(bar, 'HIDE_UNCHECKED_MODE');
            break;
          }
          case 'BESTPREISE_INCLUDE_VORTIEF': {
            paintCycleButtons(bar, 'VORTIEF_MODE');
            break;
          }
          case 'OUTLIER_REJECTION_ENABLED': {
            syncMiniToggle(bar.querySelector('#tp-bar-outlier-toggle'), val !== false, 'Ausreisser-Filter');
            const dim = val === false;
            for (const id of ['tp-bar-outlier-band-wrapper', 'tp-bar-outlier-hours-wrapper']) {
              const wrap = bar.querySelector('#' + id);
              if (wrap) wrap.classList.toggle('tp-tool-dim', dim);
            }
            break;
          }
          case 'OUTLIER_DEVIATION_BAND': {
            const pct = Math.min(50, Math.max(1, Math.round((val ?? 0.5) * 100)));
            const bandRange = bar.querySelector('#tp-bar-outlier-band-range');
            if (bandRange && document.activeElement !== bandRange) bandRange.value = pct;
            const bandLabel = bar.querySelector('#tp-bar-outlier-band-label');
            if (bandLabel) bandLabel.textContent = `±${pct} %`;
            break;
          }
          case 'OUTLIER_MAX_GLITCH_HOURS': {
            const hrs = Math.min(168, Math.max(24, parseInt(val ?? 48, 10) || 48));
            const hoursRange = bar.querySelector('#tp-bar-outlier-hours-range');
            if (hoursRange && document.activeElement !== hoursRange) hoursRange.value = hrs;
            const hoursLabel = bar.querySelector('#tp-bar-outlier-hours-label');
            if (hoursLabel) hoursLabel.textContent = `${hrs} h`;
            break;
          }
          case 'FILTER_NEG_MODE':
          case 'FILTER_MIN_MODE':
          case 'FILTER_DEAL_DISCOUNT_MODE':
          case 'FILTER_PRICE_MODE':
          case 'FILTER_SAVINGS_MODE':
          case 'HIDE_UNCHECKED_MODE':
          case 'VORTIEF_MODE': {
            paintCycleButtons(bar, key);
            break;
          }
          case 'DEALER_MODE': {
            const mode = (val === 'dim' || val === 'highlight') ? val : 'hide';
            bar.querySelectorAll(`[data-mode-key="${key}"]`).forEach(btn => {
              paintCycleButton(btn, mode);
            });
            break;
          }
          case 'FILTER_NEG_ENABLED': {
            paintCycleButtons(bar, 'FILTER_NEG_MODE');
            bar.querySelector('.tp-input-field-box')?.classList.toggle('tp-tool-dim', !val);
            break;
          }
          case 'FILTER_MIN_ENABLED': {
            paintCycleButtons(bar, 'FILTER_MIN_MODE');
            bar.querySelector('#tp-bar-min-offers-group')?.classList.toggle('tp-tool-dim', !val);
            break;
          }
          case 'FILTER_DEAL_DISCOUNT_ENABLED': {
            paintCycleButtons(bar, 'FILTER_DEAL_DISCOUNT_MODE');
            bar.querySelector('#tp-bar-deal-disc-group')?.classList.toggle('tp-tool-dim', !val);
            break;
          }
          case 'FILTER_PRICE_ENABLED': {
            paintCycleButtons(bar, 'FILTER_PRICE_MODE');
            bar.querySelector('#tp-bar-price-group')?.classList.toggle('tp-tool-dim', !val);
            break;
          }
          case 'FILTER_SAVINGS_ENABLED': {
            paintCycleButtons(bar, 'FILTER_SAVINGS_MODE');
            bar.querySelector('#tp-bar-savings-group')?.classList.toggle('tp-tool-dim', !val);
            break;
          }
          case 'FILTER_PRICE_MIN': {
            const el = bar.querySelector('#tp-price-min-input');
            if (el && document.activeElement !== el) el.value = val > 0 ? val : '';
            break;
          }
          case 'FILTER_PRICE_MAX': {
            const el = bar.querySelector('#tp-price-max-input');
            if (el && document.activeElement !== el) el.value = val > 0 ? val : '';
            break;
          }
          case 'FILTER_SAVINGS_MIN': {
            const el = bar.querySelector('#tp-savings-min-input');
            if (el && document.activeElement !== el) el.value = val > 0 ? val : '';
            break;
          }
          case 'FILTER_SAVINGS_MAX': {
            const el = bar.querySelector('#tp-savings-max-input');
            if (el && document.activeElement !== el) el.value = val > 0 ? val : '';
            break;
          }
          case 'MIN_OFFERS': {
            const minVal = bar.querySelector('#tp-bar-min-val');
            if (minVal) minVal.textContent = val;
            break;
          }
          case 'MIN_DEAL_DISCOUNT': {
            const discVal = bar.querySelector('#tp-bar-deal-disc-val');
            if (discVal) discVal.textContent = `${val}%`;
            break;
          }
          case 'REAL_DEAL_MIN_DISCOUNT': {
            // Threshold lives only in the floating CTA (toolbar copy removed).
            const floatingThresh = document.getElementById('tp-floating-threshold-btn');
            if (floatingThresh) floatingThresh.textContent = `≥${val}% ▾`;
            document.querySelectorAll('#tp-floating-threshold-popover .tp-floating-option').forEach(btn => {
              btn.classList.toggle('tp-selected', parseInt(btn.dataset.val, 10) === val);
            });
            break;
          }
        }
      } catch (err) {
        console.warn('[Toppreise-Suite] syncUiControl bar error', err);
      }
    }
  }
}
