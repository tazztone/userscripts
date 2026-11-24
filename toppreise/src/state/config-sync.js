/**
 * Configuration UI Control Synchronization Layer
 * Synchronizes configuration state changes with modal and toolbar UI controls.
 */

import { uiShadowRoot } from '../ui/shell.js';
import { syncMiniToggle, paintCycleButton } from '../ui/mini-toggle.js';
import { updateComparePreview } from '../ui/modal-ai-section.js';
import { updateKeywordPreview } from '../ui/modal-bindings.js';
import { weightText, horizonText, horizonStoredToUi, DEFAULTS } from './config-store.js';
import { CONFIG, FILTER_CYCLE, paintMinPoints, notifyAlarmConfig, paintCycleButtons } from './config.js';
import { getPageProfileType, getPageProfileLabel } from '../page/adapter.js';

export function syncUiControl(key, val, opts = {}, shadowRoot = null) {
  // 1. Sync Settings Modal (Shadow DOM) if open/exists
  const doc = typeof document !== 'undefined' ? document : null;
  const shadow = shadowRoot ?? opts?.shadowRoot ?? uiShadowRoot ?? doc?.getElementById('tp-root')?.shadowRoot ?? null;
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
          break;
        }
        case 'REAL_DEAL_MIN_DISCOUNT': {
          const range = shadow.getElementById('tp-real-deal-min-range');
          const valEl = shadow.getElementById('tp-real-deal-min-val');
          if (range) range.value = val;
          if (valEl) valEl.value = val;
          break;
        }
        case 'REAL_DEAL_CACHE_HOURS': {
          const select = shadow.getElementById('tp-cache-ttl-select');
          if (select) select.value = String(val || 48);
          break;
        }
        case 'NEGATIVE_CACHE_HOURS': {
          const select = shadow.getElementById('tp-cache-neg-ttl-select');
          if (select) select.value = String(val || 2);
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
        case 'FILTER_REMEMBER_PER_PAGE_TYPE': {
          const toggle = shadow.getElementById('tp-filter-remember-per-page-type-toggle');
          if (toggle) toggle.checked = !!val;
          const badge = shadow.getElementById('tp-profile-active-badge');
          if (badge) {
            if (val) {
              const activeType = getPageProfileType();
              badge.textContent = getPageProfileLabel(activeType);
              badge.title = `Aktiver Seitentyp: ${activeType === 'neue' ? 'Neue Toppreise Feed' : 'Produktsuche & Katalog'}`;
              badge.style.opacity = '1';
            } else {
              badge.textContent = '🌐 Global (einheitlich)';
              badge.title = 'Profiltrennung inaktiv: Einstellungen gelten global';
              badge.style.opacity = '0.7';
            }
          }
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
          if (typeof document !== 'undefined') {
            const batchToggle = document.getElementById('tp-batch-dealer-autofetch');
            if (batchToggle && document.activeElement !== batchToggle) batchToggle.checked = !!val;
          }
          break;
        }
        case 'REVIEW_SEARCH_ENABLED': {
          const toggle = shadow.getElementById('tp-review-search-toggle');
          if (toggle) toggle.checked = !!val;
          break;
        }
        case 'REVIEW_SEARCH_KEYWORD': {
          const input = shadow.getElementById('tp-review-keyword-input');
          if (input) {
            input.value = val;
            updateKeywordPreview({
              reviewKeywordInput: input,
              reviewKeywordPreview: shadow.getElementById('tp-review-keyword-preview'),
              reviewKeywordPreviewNoPrice: shadow.getElementById('tp-review-keyword-preview-noprice'),
              reviewKeywordPreviewNoPriceRow: shadow.getElementById('tp-review-keyword-preview-noprice-row'),
              reviewKeywordPreviewWarn: shadow.getElementById('tp-review-keyword-preview-warn')
            });
          }
          break;
        }
        case 'BATCH_COMPARE_PROMPT': {
          const input = shadow.getElementById('tp-batch-compare-prompt-input');
          if (input) {
            input.value = val || DEFAULTS.BATCH_COMPARE_PROMPT;
            updateComparePreview({
              batchComparePromptInput: input,
              batchCompareItemInput: shadow.getElementById('tp-batch-compare-item-input'),
              batchComparePreview: shadow.getElementById('tp-batch-compare-preview'),
              batchComparePreviewWarn: shadow.getElementById('tp-batch-compare-preview-warn')
            });
          }
          break;
        }
        case 'BATCH_COMPARE_ITEM_TEMPLATE': {
          const input = shadow.getElementById('tp-batch-compare-item-input');
          if (input) {
            input.value = val || DEFAULTS.BATCH_COMPARE_ITEM_TEMPLATE;
            delete input.dataset.tpCursorReady;
            updateComparePreview({
              batchComparePromptInput: shadow.getElementById('tp-batch-compare-prompt-input'),
              batchCompareItemInput: input,
              batchComparePreview: shadow.getElementById('tp-batch-compare-preview'),
              batchComparePreviewWarn: shadow.getElementById('tp-batch-compare-preview-warn')
            });
          }
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
        case 'TAVILY_API_KEY': {
          const status = shadow.getElementById('tp-tavily-api-key-status');
          if (status) status.textContent = (val && String(val).trim()) ? '✅ Key hinterlegt' : 'Kein Key hinterlegt';
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
        case 'AI_SEARCH_PROVIDER': {
          const select = shadow.getElementById('tp-ai-provider-select');
          if (select) select.value = val || 'google';
          break;
        }
        case 'OPENROUTER_API_KEY': {
          const status = shadow.getElementById('tp-openrouter-api-key-status');
          if (status) status.textContent = (val && String(val).trim()) ? '✅ Key hinterlegt' : 'Kein Key hinterlegt';
          break;
        }
        case 'OPENROUTER_MODEL': {
          const input = shadow.getElementById('tp-openrouter-model-input');
          if (input) input.value = val || 'google/gemini-2.5-flash';
          break;
        }
        case 'OPENROUTER_SEARCH_ENGINE': {
          const select = shadow.getElementById('tp-openrouter-engine-select');
          if (select) select.value = val || 'auto';
          break;
        }
        case 'OPENROUTER_MAX_RESULTS': {
          const select = shadow.getElementById('tp-openrouter-max-results');
          if (select) select.value = String(val || 5);
          break;
        }
        case 'BATCH_AI_TARGET': {
          const select = shadow.getElementById('tp-batch-ai-target-select');
          if (select) select.value = val || 'google-ai';
          break;
        }
        case 'BATCH_CONFIRM_THRESHOLD': {
          const input = shadow.getElementById('tp-batch-confirm-threshold-input');
          if (input) input.value = String(val ?? 10);
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
        case 'DISCORD_LAYOUT': {
          const input = shadow.getElementById('tp-discord-layout-input');
          if (input) input.value = val;
          break;
        }
        case 'ALARM_ENABLED': {
          const toggle = shadow.getElementById('tp-alarm-enabled-toggle');
          if (toggle) toggle.checked = val !== false;
          break;
        }
        case 'ALARM_TARGET_PERCENT': {
          const pct = Math.round((Number.isFinite(val) ? val : 0.60) * 100);
          const range = shadow.getElementById('tp-alarm-target-range');
          const num = shadow.getElementById('tp-alarm-target-val');
          if (range) range.value = pct;
          if (num) num.value = pct;
          break;
        }
        case 'ALARM_DURATION_DAYS': {
          const radio = shadow.querySelector(`input[name="tp-alarm-duration"][value="${val}"]`);
          if (radio) radio.checked = true;
          break;
        }
        case 'ALARM_AUTO_SUBMIT': {
          const toggle = shadow.getElementById('tp-alarm-autosubmit-toggle');
          if (toggle) toggle.checked = val === true;
          break;
        }
      }
    } catch (err) {
      console.warn('[Toppreise-Suite] syncUiControl error', err);
    }
  }

  // Toolbar & alarm-listener sync runs even when Shadow DOM is not yet mounted.
  try {
    if (key === 'BESTPREISE_WEIGHT_RECORD' && doc) {
      const pct = Math.round((val ?? 0.5) * 100);
      const barRange = doc.getElementById('tp-bar-weight-range');
      if (barRange && doc.activeElement !== barRange) barRange.value = pct;
      const barLabel = doc.getElementById('tp-bar-weight-label');
      if (barLabel) {
        barLabel.textContent = `⚖️ ${weightText(val, 'short')}`;
        barLabel.title = weightText(val, 'title');
      }
    } else if (key === 'BESTPREISE_MIN_POINTS' && !shadow) {
      paintMinPoints(val, null);
    } else if (key === 'BESTPREISE_MEDIAN_HORIZON_DAYS' && doc) {
      const stored = val ?? 365;
      const barRange = doc.getElementById('tp-bar-horizon-range');
      if (barRange && doc.activeElement !== barRange) {
        barRange.value = horizonStoredToUi(stored);
      }
      const barLabel = doc.getElementById('tp-bar-horizon-label');
      if (barLabel) {
        barLabel.textContent = horizonText(stored);
        barLabel.title = horizonText(stored, 'title');
      }
    } else if (
      (key === 'ALARM_ENABLED' || key === 'ALARM_TARGET_PERCENT' || key === 'ALARM_DURATION_DAYS' || key === 'ALARM_AUTO_SUBMIT')
      && !opts.silent
    ) {
      notifyAlarmConfig();
    }
  } catch (err) {
    console.warn('[Toppreise-Suite] syncUiControl toolbar/alarm error', err);
  }

  // 2. Sync Inline Filter Bar if present
  if (typeof document !== 'undefined' || opts?.bar) {
    const bar = opts?.bar ?? (typeof document !== 'undefined' ? (document.getElementById('tp-suite-filter-bar') ?? document.getElementById('tp-inline-filter-bar')) : null);
    if (bar) {
      try {
        switch (key) {
          case 'NEGATIVE_TERMS': {
            const input = bar.querySelector('#tp-inline-negative-input');
            const clearBtn = bar.querySelector('#tp-clear-neg-btn');
            if (input && (typeof document === 'undefined' || document.activeElement !== input) && input.value !== val) {
              input.value = val || '';
            }
            if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
            break;
          }
          case 'FILTERS_ENABLED': {
            syncMiniToggle(bar.querySelector('#tp-bar-filters-toggle'), val !== false, 'Filter aktivieren oder pausieren.');
            const filterBtn = bar.querySelector('#tp-bar-filter-btn');
            if (filterBtn) {
              filterBtn.classList.toggle('tp-filters-paused', val === false);
            }
            break;
          }
          case 'HEATMAP_ENABLED': {
            const heatBtn = bar.querySelector('#tp-bar-heat-btn');
            if (heatBtn) {
              const isVerified = val === 'verified';
              const isActive = val !== false;
              heatBtn.classList.toggle('tp-active', isActive);
              heatBtn.classList.toggle('tp-heat-verified', isVerified);
              heatBtn.setAttribute('aria-pressed', String(isActive));
              heatBtn.setAttribute('data-heatmap-state', isVerified ? 'verified' : (isActive ? 'all' : 'off'));
              heatBtn.textContent = isVerified ? '🔥 Heatmap (Geprüft)' : '🔥 Heatmap';
              heatBtn.title = 'Deal-Intensität (Heatmap): Farbverlauf proportional zum Rabatt (Alle Deals · Nur verifizierte Deals · Aus).';
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
            if (bandRange && doc?.activeElement !== bandRange) bandRange.value = pct;
            const bandLabel = bar.querySelector('#tp-bar-outlier-band-label');
            if (bandLabel) bandLabel.textContent = `±${pct} %`;
            break;
          }
          case 'OUTLIER_MAX_GLITCH_HOURS': {
            const hrs = Math.min(168, Math.max(24, parseInt(val ?? 48, 10) || 48));
            const hoursRange = bar.querySelector('#tp-bar-outlier-hours-range');
            if (hoursRange && doc?.activeElement !== hoursRange) hoursRange.value = hrs;
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
            if (el && doc?.activeElement !== el) el.value = val > 0 ? val : '';
            break;
          }
          case 'FILTER_PRICE_MAX': {
            const el = bar.querySelector('#tp-price-max-input');
            if (el && doc?.activeElement !== el) el.value = val > 0 ? val : '';
            break;
          }
          case 'FILTER_SAVINGS_MIN': {
            const el = bar.querySelector('#tp-savings-min-input');
            if (el && doc?.activeElement !== el) el.value = val > 0 ? val : '';
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
            // Threshold lives in the floating CTA text input.
            const floatingThreshInput = doc?.getElementById('tp-floating-threshold-input');
            if (floatingThreshInput && doc?.activeElement !== floatingThreshInput) {
              floatingThreshInput.value = `≥${val}%`;
            }
            break;
          }
        }
      } catch (err) {
        console.warn('[Toppreise-Suite] syncUiControl bar error', err);
      }
    }
  }
}
