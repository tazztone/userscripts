/**
 * Settings Modal: OpenRouter Web Search & Batch Settings Section
 * Extracted to keep modal-template.js, modal-bindings.js & modal-actions.js < 25 KB.
 */

import { CONFIG, DEFAULTS, effectiveAiProvider } from '../state/config.js';
import {
  buildComparisonPrompt,
  findUnknownPromptTokens,
  COMPARE_PROMPT_TOKENS,
  COMPARE_ITEM_TOKENS
} from '../features/batch-actions.js';
import { bindSecretReveal, trackTextareaCursor, insertTokenAtTextareaCursor } from './modal-template-sections.js';

const COMPARE_PREVIEW_SAMPLE = Object.freeze([
  {
    title: 'ASUS Prime B840M-K',
    priceText: 'CHF 79.62',
    discountText: '-12%',
    lowText: 'CHF 88.90',
    medianText: 'Ø-Preis (1J): CHF 95.00',
    dealer: 'Digitec',
    offerCount: 9,
    specs: 'AM5 · micro ATX · DDR5',
    url: 'https://www.toppreise.ch/preisvergleich/p123'
  },
  {
    title: 'GIGABYTE B550 X',
    priceText: 'CHF 87.90',
    discountText: '-5%',
    lowText: '',
    medianText: 'Ø-Preis (1J): CHF 92.50',
    dealer: 'Galaxus',
    offerCount: 4,
    specs: 'AM4 · ATX · DDR4',
    url: 'https://www.toppreise.ch/preisvergleich/p456'
  }
]);

export function renderAiProviderTopMarkup() {
  return `
        <div class="tp-settings-subhead">KI-Anbieter (Direkt-Fazit, Discord &amp; Batch)</div>
        <div class="tp-settings-group">
          <label for="tp-ai-provider-select" title="Wähle, ob 🌐 auf der Karte direkt ein KI-Fazit via OpenRouter/Tavily lädt oder Google-Suche öffnet.">Aktiver KI-Anbieter</label>
          <select id="tp-ai-provider-select" class="tp-select tp-field-dark">
            <option value="google">Google Web-Suche (Standard, kein Key)</option>
            <option value="openrouter">OpenRouter (openrouter:web_search + Quellen)</option>
            <option value="tavily">Tavily (Legacy-Direktfazit)</option>
          </select>
        </div>

        <details id="tp-ai-openrouter-block" class="tp-subsection tp-ai-provider-block" data-sub="review-openrouter">
          <summary class="tp-subsection-header">🤖 OpenRouter Web-Suche</summary>
          <div class="tp-subsection-body">
          <div class="tp-settings-group">
            <label title="OpenRouter API-Key (openrouter.ai). Ermöglicht openrouter:web_search mit Quellenlinks auf Karte, Discord {ai} und Batch-KI.">OpenRouter API-Schlüssel</label>
            <div id="tp-openrouter-api-key-collapsed">
              <span id="tp-openrouter-api-key-status" class="tp-switch-desc"></span>
              <button type="button" id="tp-openrouter-api-key-reveal" class="tp-btn tp-btn-secondary" aria-expanded="false" aria-controls="tp-openrouter-api-key-editor">🔑 Key ersetzen / entfernen</button>
            </div>
            <div id="tp-openrouter-api-key-editor" style="display: none;">
              <input type="password" id="tp-openrouter-api-key-input" class="tp-field-dark" placeholder="sk-or-v1-…" autocomplete="new-password" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true">
              <span class="tp-switch-desc tp-field-hint">Key von <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai</a>. Bleibt lokal &amp; GM-privat im Browser.</span>
            </div>
          </div>
          <div class="tp-settings-group">
            <label for="tp-openrouter-model-input" title="OpenRouter Modell-ID für Web-Suche &amp; Batch-Vergleich.">OpenRouter Modell</label>
            <input type="text" id="tp-openrouter-model-input" class="tp-field-dark" placeholder="google/gemini-2.5-flash" spellcheck="false">
          </div>
          <div class="tp-settings-group tp-ai-split-row">
            <div class="tp-ai-split-col">
              <label for="tp-openrouter-engine-select" title="Web-Search Engine für openrouter:web_search.">Such-Engine</label>
              <select id="tp-openrouter-engine-select" class="tp-select tp-field-dark">
                <option value="auto">Auto (Standard)</option>
                <option value="native">Native</option>
                <option value="exa">Exa</option>
                <option value="parallel">Parallel</option>
                <option value="perplexity">Perplexity</option>
                <option value="firecrawl">Firecrawl</option>
              </select>
            </div>
            <div class="tp-ai-split-col">
              <label for="tp-openrouter-max-results" title="Maximale Web-Quellen pro OpenRouter-Anfrage.">Max. Quellen</label>
              <select id="tp-openrouter-max-results" class="tp-select tp-field-dark">
                <option value="3">3 Quellen</option>
                <option value="5" selected>5 Quellen (Standard)</option>
                <option value="8">8 Quellen</option>
                <option value="10">10 Quellen</option>
              </select>
            </div>
          </div>
          </div>
        </details>`;
}

export function renderAiBatchSettingsMarkup() {
  return `
        <details class="tp-subsection" data-sub="review-batch">
          <summary class="tp-subsection-header">⚡ Batch-Aktionen</summary>
          <div class="tp-subsection-body">
        <div class="tp-group-head-row">
          <span>Batch-Konfiguration</span>
          <button type="button" class="tp-btn-group-reset" data-reset-group="batch" title="Batch-Aktionen auf Standard zurücksetzen" aria-label="Batch-Aktionen auf Standard zurücksetzen">↺</button>
        </div>
        <div class="tp-settings-group tp-ai-split-row">
          <div class="tp-ai-split-col-wide">
            <label for="tp-batch-ai-target-select" title="Ziel-Plattform für 🤖 KI-Vergleich im Batch-Menü.">Batch KI-Vergleich Ziel</label>
            <select id="tp-batch-ai-target-select" class="tp-select tp-field-dark">
              <option value="google-ai">Google AI-Modus (&amp;udm=50)</option>
              <option value="openrouter">OpenRouter (In-Page)</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="perplexity">Perplexity</option>
              <option value="claude">Claude</option>
            </select>
          </div>
          <div class="tp-ai-split-col">
            <label for="tp-batch-confirm-threshold-input" title="Ab dieser Anzahl Karten fragt Batch vor Tabs, Händler-Laden oder API-Calls nach (1–100).">Bestätigung ab N Karten</label>
            <input type="number" id="tp-batch-confirm-threshold-input" class="tp-field-dark" min="1" max="100" step="1" value="10">
          </div>
        </div>
          </div>
        </details>`;
}

export function renderReviewSection() {
  return `
      <section id="tp-section-review" class="tp-section-card tp-section-review">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-review-body" data-collapse="tp-section-review"><span class="tp-section-title">🌐 Web-Suche</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-review-body">
        <div class="tp-group-head-row">
          <span>Web- &amp; KI-Suche</span>
          <button type="button" class="tp-btn-group-reset" data-reset-group="review" title="Web-Suche auf Standard zurücksetzen" aria-label="Web-Suche auf Standard zurücksetzen">↺</button>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Hängt ans Ende jedes Produktnamens ein 🌐-Icon für die Web-Suche.">Web-Suche (🌐) anzeigen</label>
            <span class="tp-switch-desc">Zeigt auf jeder Produktkarte ein Icon für die externe Web- und KI-Suche</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-review-search-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group">
          <label for="tp-review-keyword-input" title="Dieser Prompt wird für Karte 🌐 und Batch Einzelsuche verwendet.">Einzel-Suche Prompt (🌐 Karte &amp; Batch-Einzelsuche)</label>
          <div class="tp-prompt-row">
            <textarea id="tp-review-keyword-input" class="tp-field-dark tp-prompt-textarea" rows="2" maxlength="500" placeholder="Suchbegriff eingeben…" spellcheck="false" autocomplete="off">Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.</textarea>
            <button type="button" id="tp-review-keyword-reset" class="tp-btn tp-btn-secondary tp-prompt-reset-btn" title="Auf Standard-Suchbegriff zurücksetzen">↺ Standard</button>
          </div>
          <span class="tp-switch-desc tp-field-hint">Platzhalter: <code>[Produkt]</code> (wird sonst vorangestellt) und <code>{preis}</code> (ohne Preisdaten automatisch entfernt).</span>
          <div class="tp-search-preview-box">
            <div class="tp-search-preview-title">Live-Vorschau (Beispiel: Sony WH-1000XM5)</div>
            <div class="tp-search-preview-row">
              <span class="tp-search-preview-badge">Mit Deal-Preis:</span>
              <span id="tp-review-keyword-preview" class="tp-search-preview-text"></span>
            </div>
            <div class="tp-search-preview-row" id="tp-review-keyword-preview-noprice-row">
              <span class="tp-search-preview-badge">Ohne Preis:</span>
              <span id="tp-review-keyword-preview-noprice" class="tp-search-preview-text tp-muted"></span>
            </div>
            <div id="tp-review-keyword-preview-warn" class="tp-preview-warn" hidden></div>
          </div>
        </div>
        <div class="tp-settings-group">
          <label for="tp-batch-compare-prompt-input" title="Dieser Prompt wird für 🤖 KI-Vergleich im Batch-Menü verwendet.">KI-Vergleich Prompt (🤖 Batch)</label>
          <div class="tp-prompt-row">
            <textarea id="tp-batch-compare-prompt-input" class="tp-field-dark tp-prompt-textarea" rows="2" maxlength="500" placeholder="Vergleichs-Prompt eingeben…" spellcheck="false" autocomplete="off"></textarea>
            <button type="button" id="tp-batch-compare-prompt-reset" class="tp-btn tp-btn-secondary tp-prompt-reset-btn" title="Auf Standard-Prompt zurücksetzen">↺ Standard</button>
          </div>
          <span class="tp-switch-desc tp-field-hint">Platzhalter: <code>{anzahl}</code> und optional <code>{angebote}</code> (sonst automatisch angehängt). OpenRouter erhält alle Daten ungekürzt; URL-Ziele passen Specs adaptiv ans URL-Limit (~1850 Zeichen) an.</span>
          <label for="tp-batch-compare-item-input" title="Format pro Angebot hinter dem Prompt (leere Felder &amp; Segmente entfallen automatisch).">Produktdaten pro Angebot (Payload)</label>
          <div id="tp-batch-compare-item-chips" class="tp-token-chips">
            ${COMPARE_ITEM_TOKENS.map(t => `<button type="button" class="tp-btn tp-btn-secondary tp-token-chip" data-token="{${t}}">{${t}}</button>`).join('')}
          </div>
          <div class="tp-prompt-row">
            <textarea id="tp-batch-compare-item-input" class="tp-field-dark tp-prompt-textarea" rows="2" maxlength="500" placeholder="Format pro Angebot…" spellcheck="false" autocomplete="off"></textarea>
            <button type="button" id="tp-batch-compare-item-reset" class="tp-btn tp-btn-secondary tp-prompt-reset-btn" title="Auf Standard-Produktformat zurücksetzen">↺ Standard</button>
          </div>
          <span class="tp-switch-desc tp-field-hint">Segmente mit <code>|</code> trennen — fehlende Felder werden sauber ausgeblendet.</span>
          <div id="tp-batch-compare-preview-box" class="tp-search-preview-box">
            <div class="tp-search-preview-title">Live-Vorschau KI-Vergleich (Beispiel: 2 Angebote)</div>
            <div id="tp-batch-compare-preview" class="tp-search-preview-text tp-preview-pre"></div>
            <div id="tp-batch-compare-preview-warn" class="tp-preview-warn" hidden></div>
          </div>
        </div>
        <details class="tp-subsection" data-sub="review-google">
          <summary class="tp-subsection-header">🔍 Google-Suche</summary>
          <div class="tp-subsection-body">
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Öffnet die Suche in Googles KI-Modus (Parameter &amp;udm=50).">Im Google KI-Modus öffnen</label>
            <span class="tp-switch-desc">Google AI Overview Modus (&amp;udm=50) statt klassischer Trefferliste</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-review-ai-mode-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
          </div>
        </details>

${renderAiProviderTopMarkup()}
        <details id="tp-ai-tavily-block" class="tp-subsection tp-ai-provider-block" data-sub="review-tavily">
          <summary class="tp-subsection-header">🧠 Tavily KI-Suche (Legacy-Direktfazit &amp; Discord)</summary>
          <div class="tp-subsection-body">
          <div class="tp-settings-group tp-switch-container">
            <div class="tp-switch-label">
              <label title="Aktiviert Tavily KI-Zusammenfassungen für Direkt-Fazit auf der Karte und {ai} in Discord.">Tavily KI-Suche aktivieren</label>
              <span class="tp-switch-desc">AUS = 🌐 öffnet Websuche direkt, kein KI-Fazit auf Karte &amp; in Discord</span>
            </div>
            <label class="tp-switch tp-purple">
              <input type="checkbox" id="tp-tavily-enabled-toggle">
              <span class="tp-slider"></span>
            </label>
          </div>
          <div class="tp-settings-group">
            <label title="Kostenloser Tavily API Key (tavily.com, 1'000 Anfragen/Monat). Ermöglicht KI-Kurzfazit direkt auf der Karte (🌐) und im Discord-Share ({ai}).">API-Schlüssel</label>
            <div id="tp-tavily-api-key-collapsed">
              <span id="tp-tavily-api-key-status" class="tp-switch-desc"></span>
              <button type="button" id="tp-tavily-api-key-reveal" class="tp-btn tp-btn-secondary" aria-expanded="false" aria-controls="tp-tavily-api-key-editor">🔑 Key ersetzen / entfernen</button>
            </div>
            <div id="tp-tavily-api-key-editor" style="display: none;">
              <input type="password" id="tp-tavily-api-key-input" class="tp-field-dark" placeholder="tvly-…" autocomplete="new-password" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true">
              <span class="tp-switch-desc tp-field-hint">Kostenloser Key von <a href="https://tavily.com" target="_blank" rel="noopener">tavily.com</a> (1'000 Anfragen/Monat). Ermöglicht KI-Kurzfazit per 1-Klick auf der Karte und <code>{ai}</code> im Discord-Post. Bleibt lokal im Browser.</span>
            </div>
          </div>
          <div class="tp-settings-group tp-ai-split-row">
            <div class="tp-ai-split-col">
              <label title="Suchtiefe: Basic ist schnell (~1-2s). Advanced durchsucht mehr Webquellen (~2-4s).">Tavily Suchtiefe</label>
              <select id="tp-tavily-search-depth" class="tp-select tp-field-dark">
                <option value="basic">Basic (schnell, Standard)</option>
                <option value="advanced">Advanced (gründlich)</option>
              </select>
            </div>
            <div class="tp-ai-split-col">
              <label title="Anzahl der Webseiten, die Tavily für die Antwort analysiert.">Max. Quellen (Ergebnisse)</label>
              <select id="tp-tavily-max-results" class="tp-select tp-field-dark">
                <option value="3">3 Quellen</option>
                <option value="5" selected>5 Quellen (Standard)</option>
                <option value="8">8 Quellen</option>
                <option value="10">10 Quellen</option>
              </select>
            </div>
          </div>
          </div>
        </details>
${renderAiBatchSettingsMarkup()}
</div>
      </section>`;
}

export function collectAiSectionElements(shadow) {
  return {
    batchComparePromptInput: shadow.getElementById('tp-batch-compare-prompt-input'),
    batchComparePromptReset: shadow.getElementById('tp-batch-compare-prompt-reset'),
    batchCompareItemInput: shadow.getElementById('tp-batch-compare-item-input'),
    batchCompareItemReset: shadow.getElementById('tp-batch-compare-item-reset'),
    batchCompareItemChips: shadow.getElementById('tp-batch-compare-item-chips'),
    batchComparePreview: shadow.getElementById('tp-batch-compare-preview'),
    batchComparePreviewWarn: shadow.getElementById('tp-batch-compare-preview-warn'),
    aiProviderSelect: shadow.getElementById('tp-ai-provider-select'),
    openrouterBlock: shadow.getElementById('tp-ai-openrouter-block'),
    tavilyBlock: shadow.getElementById('tp-ai-tavily-block'),
    openrouterApiKeyInput: shadow.getElementById('tp-openrouter-api-key-input'),
    openrouterApiKeyReveal: shadow.getElementById('tp-openrouter-api-key-reveal'),
    openrouterApiKeyEditor: shadow.getElementById('tp-openrouter-api-key-editor'),
    openrouterApiKeyStatus: shadow.getElementById('tp-openrouter-api-key-status'),
    openrouterModelInput: shadow.getElementById('tp-openrouter-model-input'),
    openrouterEngineSelect: shadow.getElementById('tp-openrouter-engine-select'),
    openrouterMaxResults: shadow.getElementById('tp-openrouter-max-results'),
    batchAiTargetSelect: shadow.getElementById('tp-batch-ai-target-select'),
    batchConfirmThresholdInput: shadow.getElementById('tp-batch-confirm-threshold-input')
  };
}

export function updateComparePreview(els) {
  if (!els.batchComparePreview) return;
  const promptTpl = String(els.batchComparePromptInput?.value || '').trim() || DEFAULTS.BATCH_COMPARE_PROMPT;
  const itemTpl = String(els.batchCompareItemInput?.value || '').trim() || DEFAULTS.BATCH_COMPARE_ITEM_TEMPLATE;
  els.batchComparePreview.textContent = buildComparisonPrompt(COMPARE_PREVIEW_SAMPLE, {
    promptTemplate: promptTpl,
    itemTemplate: itemTpl
  });
  if (els.batchComparePreviewWarn) {
    const badPrompt = findUnknownPromptTokens(promptTpl, COMPARE_PROMPT_TOKENS);
    const badItem = findUnknownPromptTokens(itemTpl, COMPARE_ITEM_TOKENS);
    const allBad = [...new Set([...badPrompt, ...badItem])];
    if (allBad.length > 0) {
      els.batchComparePreviewWarn.textContent = `Hinweis: Unbekannte(r) Platzhalter ${allBad.join(', ')}`;
      els.batchComparePreviewWarn.hidden = false;
    } else {
      els.batchComparePreviewWarn.textContent = '';
      els.batchComparePreviewWarn.hidden = true;
    }
  }
}

function syncProviderBlockDimming(els) {
  const prov = els.aiProviderSelect?.value || effectiveAiProvider(CONFIG);
  if (els.openrouterBlock) els.openrouterBlock.classList.toggle('tp-provider-dimmed', prov !== 'openrouter');
  if (els.tavilyBlock) els.tavilyBlock.classList.toggle('tp-provider-dimmed', prov !== 'tavily');
}

function revealSelectedProviderBlock(els, prov) {
  if (prov === 'openrouter' && els.openrouterBlock) els.openrouterBlock.open = true;
  if (prov === 'tavily' && els.tavilyBlock) els.tavilyBlock.open = true;
}

export function syncAiSectionFromConfig(els) {
  const prov = effectiveAiProvider(CONFIG);
  if (els.batchComparePromptInput) els.batchComparePromptInput.value = CONFIG.BATCH_COMPARE_PROMPT || DEFAULTS.BATCH_COMPARE_PROMPT;
  if (els.batchCompareItemInput) {
    els.batchCompareItemInput.value = CONFIG.BATCH_COMPARE_ITEM_TEMPLATE || DEFAULTS.BATCH_COMPARE_ITEM_TEMPLATE;
    delete els.batchCompareItemInput.dataset.tpCursorReady;
  }
  if (els.aiProviderSelect) els.aiProviderSelect.value = prov;
  if (els.openrouterApiKeyInput) els.openrouterApiKeyInput.value = '';
  if (els.openrouterApiKeyEditor) els.openrouterApiKeyEditor.style.display = 'none';
  if (els.openrouterApiKeyReveal) {
    els.openrouterApiKeyReveal.style.display = '';
    els.openrouterApiKeyReveal.setAttribute('aria-expanded', 'false');
  }
  if (els.openrouterApiKeyStatus) {
    els.openrouterApiKeyStatus.textContent = (CONFIG.OPENROUTER_API_KEY && String(CONFIG.OPENROUTER_API_KEY).trim())
      ? '✅ Key hinterlegt'
      : 'Kein Key hinterlegt';
  }
  if (els.openrouterModelInput) els.openrouterModelInput.value = CONFIG.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  if (els.openrouterEngineSelect) els.openrouterEngineSelect.value = CONFIG.OPENROUTER_SEARCH_ENGINE || 'auto';
  if (els.openrouterMaxResults) els.openrouterMaxResults.value = String(CONFIG.OPENROUTER_MAX_RESULTS || 5);
  if (els.batchAiTargetSelect) els.batchAiTargetSelect.value = CONFIG.BATCH_AI_TARGET || 'google-ai';
  if (els.batchConfirmThresholdInput) els.batchConfirmThresholdInput.value = String(CONFIG.BATCH_CONFIRM_THRESHOLD ?? 10);
  updateComparePreview(els);
  syncProviderBlockDimming(els);
  revealSelectedProviderBlock(els, prov);
}

export function bindAiSectionEvents(els) {
  els.batchComparePromptInput?.addEventListener('input', () => updateComparePreview(els));
  els.batchCompareItemInput?.addEventListener('input', () => updateComparePreview(els));
  trackTextareaCursor(els.batchCompareItemInput);

  els.batchComparePromptReset?.addEventListener('click', () => {
    if (els.batchComparePromptInput) {
      els.batchComparePromptInput.value = DEFAULTS.BATCH_COMPARE_PROMPT;
      updateComparePreview(els);
      els.batchComparePromptInput.focus();
    }
  });

  els.batchCompareItemReset?.addEventListener('click', () => {
    if (els.batchCompareItemInput) {
      els.batchCompareItemInput.value = DEFAULTS.BATCH_COMPARE_ITEM_TEMPLATE;
      updateComparePreview(els);
      els.batchCompareItemInput.focus();
    }
  });

  els.batchCompareItemChips?.addEventListener('click', e => {
    const token = e.target?.closest?.('button')?.dataset?.token;
    const ta = els.batchCompareItemInput;
    if (!token || !ta) return;
    insertTokenAtTextareaCursor(ta, token, { separator: ' | ' });
    updateComparePreview(els);
  });

  bindSecretReveal(els.openrouterApiKeyReveal, els.openrouterApiKeyEditor, els.openrouterApiKeyInput);

  els.aiProviderSelect?.addEventListener('change', () => {
    const val = els.aiProviderSelect.value;
    if (els.tavilyEnabledToggle) {
      els.tavilyEnabledToggle.checked = val === 'tavily';
    }
    syncProviderBlockDimming(els);
    revealSelectedProviderBlock(els, val);
  });

  els.tavilyEnabledToggle?.addEventListener('change', () => {
    if (!els.aiProviderSelect) return;
    if (els.tavilyEnabledToggle.checked) {
      els.aiProviderSelect.value = 'tavily';
    } else if (els.aiProviderSelect.value === 'tavily') {
      els.aiProviderSelect.value = 'google';
    }
    syncProviderBlockDimming(els);
    revealSelectedProviderBlock(els, els.aiProviderSelect.value);
  });
}

export function collectAiSectionUpdates(els, updates) {
  if (els.batchComparePromptInput) {
    const raw = String(els.batchComparePromptInput.value || '').trim();
    updates.BATCH_COMPARE_PROMPT = raw || DEFAULTS.BATCH_COMPARE_PROMPT;
  }
  if (els.batchCompareItemInput) {
    const rawItem = String(els.batchCompareItemInput.value || '').trim();
    updates.BATCH_COMPARE_ITEM_TEMPLATE = rawItem || DEFAULTS.BATCH_COMPARE_ITEM_TEMPLATE;
  }
  if (els.aiProviderSelect) {
    const prov = els.aiProviderSelect.value;
    updates.AI_SEARCH_PROVIDER = (prov === 'openrouter' || prov === 'tavily') ? prov : 'google';
  }
  if (els.openrouterApiKeyInput && els.openrouterApiKeyEditor && els.openrouterApiKeyEditor.style.display !== 'none') {
    updates.OPENROUTER_API_KEY = String(els.openrouterApiKeyInput.value || '').trim();
  }
  if (els.openrouterModelInput) {
    const m = String(els.openrouterModelInput.value || '').trim();
    updates.OPENROUTER_MODEL = m || 'google/gemini-2.5-flash';
  }
  if (els.openrouterEngineSelect) {
    updates.OPENROUTER_SEARCH_ENGINE = els.openrouterEngineSelect.value || 'auto';
  }
  if (els.openrouterMaxResults) {
    const rawMax = parseInt(els.openrouterMaxResults.value, 10);
    updates.OPENROUTER_MAX_RESULTS = Number.isFinite(rawMax) ? Math.max(1, Math.min(10, rawMax)) : 5;
  }
  if (els.batchAiTargetSelect) {
    updates.BATCH_AI_TARGET = els.batchAiTargetSelect.value || 'google-ai';
  }
  if (els.batchConfirmThresholdInput) {
    const rawThr = parseInt(els.batchConfirmThresholdInput.value, 10);
    updates.BATCH_CONFIRM_THRESHOLD = Number.isFinite(rawThr) ? Math.max(1, Math.min(100, rawThr)) : 10;
  }
}
