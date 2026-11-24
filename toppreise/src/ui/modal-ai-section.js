/**
 * Settings Modal: OpenRouter Web Search & Batch Settings Section
 * Extracted to keep modal-template.js, modal-bindings.js & modal-actions.js < 25 KB.
 */

import { CONFIG, effectiveAiProvider } from '../state/config.js';

export function renderAiBatchSettingsMarkup() {
  return `
        <div class="tp-settings-subhead">KI-Anbieter (Direkt-Fazit, Discord & Batch)</div>
        <div class="tp-settings-group">
          <label for="tp-ai-provider-select" title="Wähle, ob 🌐 auf der Karte direkt ein KI-Fazit via OpenRouter/Tavily lädt oder Google-Suche öffnet.">Aktiver KI-Anbieter</label>
          <select id="tp-ai-provider-select" class="tp-select tp-field-dark">
            <option value="google">Google Web-Suche (Standard, kein Key)</option>
            <option value="openrouter">OpenRouter (openrouter:web_search + Quellen)</option>
            <option value="tavily">Tavily (Legacy-Direktfazit)</option>
          </select>
        </div>

        <div class="tp-settings-subhead">OpenRouter Web-Suche</div>
        <div class="tp-settings-group">
          <label title="OpenRouter API-Key (openrouter.ai). Ermöglicht openrouter:web_search mit Quellenlinks auf Karte, Discord {ai} und Batch-KI.">OpenRouter API-Schlüssel</label>
          <div id="tp-openrouter-api-key-collapsed">
            <span id="tp-openrouter-api-key-status" class="tp-switch-desc"></span>
            <button type="button" id="tp-openrouter-api-key-reveal" class="tp-btn tp-btn-secondary" aria-expanded="false" aria-controls="tp-openrouter-api-key-editor">🔑 Key ersetzen / entfernen</button>
          </div>
          <div id="tp-openrouter-api-key-editor" style="display: none;">
            <input type="password" id="tp-openrouter-api-key-input" class="tp-field-dark" placeholder="sk-or-v1-…" autocomplete="new-password" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true">
            <span class="tp-switch-desc tp-field-hint">Key von <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai</a>. Bleibt lokal & GM-privat im Browser.</span>
          </div>
        </div>
        <div class="tp-settings-group">
          <label for="tp-openrouter-model-input" title="OpenRouter Modell-ID für Web-Suche & Batch-Vergleich.">OpenRouter Modell</label>
          <input type="text" id="tp-openrouter-model-input" class="tp-field-dark" placeholder="google/gemini-2.5-flash" spellcheck="false">
        </div>
        <div class="tp-settings-group" style="display:flex;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:140px;">
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
          <div style="flex:1;min-width:140px;">
            <label for="tp-openrouter-max-results" title="Maximale Web-Quellen pro OpenRouter-Anfrage.">Max. Quellen</label>
            <select id="tp-openrouter-max-results" class="tp-select tp-field-dark">
              <option value="3">3 Quellen</option>
              <option value="5" selected>5 Quellen (Standard)</option>
              <option value="8">8 Quellen</option>
              <option value="10">10 Quellen</option>
            </select>
          </div>
        </div>

        <div class="tp-settings-subhead">Batch-Aktionen</div>
        <div class="tp-settings-group" style="display:flex;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:150px;">
            <label for="tp-batch-ai-target-select" title="Ziel-Plattform für 🤖 KI-Vergleich im Batch-Menü.">Batch KI-Vergleich Ziel</label>
            <select id="tp-batch-ai-target-select" class="tp-select tp-field-dark">
              <option value="google-ai">Google AI-Modus (&udm=50)</option>
              <option value="openrouter">OpenRouter (In-Page)</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="perplexity">Perplexity</option>
              <option value="claude">Claude</option>
            </select>
          </div>
          <div style="flex:1;min-width:140px;">
            <label for="tp-batch-confirm-threshold-input" title="Ab dieser Anzahl Karten fragt Batch vor Tabs, Händler-Laden oder API-Calls nach (1–100).">Bestätigung ab N Karten</label>
            <input type="number" id="tp-batch-confirm-threshold-input" class="tp-field-dark" min="1" max="100" step="1" value="10">
          </div>
        </div>`;
}

export function collectAiSectionElements(shadow) {
  return {
    aiProviderSelect: shadow.getElementById('tp-ai-provider-select'),
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

export function syncAiSectionFromConfig(els) {
  if (els.aiProviderSelect) els.aiProviderSelect.value = effectiveAiProvider(CONFIG);
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
}

export function bindAiSectionEvents(els) {
  els.openrouterApiKeyReveal?.addEventListener('click', e => {
    if (e && !e.isTrusted) return;
    if (!els.openrouterApiKeyEditor || !els.openrouterApiKeyInput) return;
    els.openrouterApiKeyInput.value = '';
    els.openrouterApiKeyEditor.style.display = '';
    els.openrouterApiKeyReveal.style.display = 'none';
    els.openrouterApiKeyReveal.setAttribute('aria-expanded', 'true');
    els.openrouterApiKeyInput.focus();
  });

  els.aiProviderSelect?.addEventListener('change', () => {
    const val = els.aiProviderSelect.value;
    if (els.tavilyEnabledToggle) {
      els.tavilyEnabledToggle.checked = val === 'tavily';
    }
  });

  els.tavilyEnabledToggle?.addEventListener('change', () => {
    if (!els.aiProviderSelect) return;
    if (els.tavilyEnabledToggle.checked) {
      els.aiProviderSelect.value = 'tavily';
    } else if (els.aiProviderSelect.value === 'tavily') {
      els.aiProviderSelect.value = 'google';
    }
  });
}

export function collectAiSectionUpdates(els, updates) {
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
