/**
 * Modal template (split from ui/modal.js): settings section HTML + collapse state.
 */

import { renderDiscordSection, renderDataSection } from './modal-template-sections.js';

// Injects the settings sections on first open; later calls are a no-op.
export function ensureModalSection(shadow) {
  let section = shadow.getElementById('tp-section-unified-suite');
  if (!section) {
    const sectionsHolder = shadow.getElementById('tp-settings-sections');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = `
      <div id="tp-section-unified-suite">
      <section id="tp-section-display" class="tp-section-card tp-section-display">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-display-body" data-collapse="tp-section-display"><span class="tp-section-title">🖥️ Ansicht</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-display-body">
        <div class="tp-settings-group" id="tp-dim-opacity-group">
          <label title="Deckkraft gedimmter Karten (Filter-Modus Dimmen)">Deckkraft / Dimmung (Gedimmt & Gefiltert)</label>
          <div class="tp-range-container">
            <input type="range" id="tp-opacity-range" min="0.05" max="1" step="0.05" value="0.25">
            <input type="number" id="tp-opacity-val" min="5" max="100" step="5" value="25">
          </div>
        </div>
        <div class="tp-settings-group">
          <label title="Stärke der Karten- und Badge-Farbe (subtil bei kleinen Rabatten, intensiv bei Top-Deals; 0% und Aufschläge bleiben farblos)">Deal-Intensität / Heatmap (%)</label>
          <div class="tp-range-container tp-rose">
            <input type="range" id="tp-heatmap-intensity-range" min="20" max="100" step="5" value="100">
            <input type="number" id="tp-heatmap-intensity-val" min="20" max="100" step="5" value="100">
          </div>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Entfernt leere Werbeflächen und Banner oben und im Layout">Werbeplätze / Banner ausblenden</label>
            <span class="tp-switch-desc">Entfernt leeren Platz über der Kopfzeile und Werbebanner</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-hide-ads-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
</div>
      </section>
      <section id="tp-section-review" class="tp-section-card tp-section-review">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-review-body" data-collapse="tp-section-review"><span class="tp-section-title">🌐 Web-Suche</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-review-body">
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
          <label title="Dieser Begriff wird an den Produktnamen angehängt.">Suchbegriff</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" id="tp-review-keyword-input" class="tp-field-dark" value="Testbericht Erfahrungen. Ist der Preis von {preis} ein guter Deal?" maxlength="100" placeholder="Suchbegriff eingeben…" spellcheck="false" autocomplete="off" style="flex:1;margin-top:0;">
            <button type="button" id="tp-review-keyword-reset" class="tp-btn tp-btn-secondary" style="padding:6px 10px;font-size:var(--tp-fs-sm);height:32px;white-space:nowrap;" title="Auf Standard-Suchbegriff zurücksetzen">↺ Standard</button>
          </div>
          <span class="tp-switch-desc tp-field-hint">Wird an den Produktnamen angehängt. Platzhalter <code>{preis}</code> setzt den Deal-Preis ein (ohne Preisdaten wird der Preisteil automatisch weggelassen).</span>
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
          </div>
        </div>

        <div class="tp-settings-subhead">Google-Suche</div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Öffnet die Suche in Googles KI-Modus (Parameter &udm=50).">Im Google KI-Modus öffnen</label>
            <span class="tp-switch-desc">Google AI Overview Modus (&udm=50) statt klassischer Trefferliste</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-review-ai-mode-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>

        <div class="tp-settings-subhead">Tavily KI-Suche (Direkt-Fazit & Discord)</div>
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
        <div class="tp-settings-group" style="display:flex;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:140px;">
            <label title="Suchtiefe: Basic ist schnell (~1-2s). Advanced durchsucht mehr Webquellen (~2-4s).">Tavily Suchtiefe</label>
            <select id="tp-tavily-search-depth" class="tp-select tp-field-dark">
              <option value="basic">Basic (schnell, Standard)</option>
              <option value="advanced">Advanced (gründlich)</option>
            </select>
          </div>
          <div style="flex:1;min-width:140px;">
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
      </section>
      <section id="tp-section-deals" class="tp-section-card tp-section-deals">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-deals-body" data-collapse="tp-section-deals"><span class="tp-section-title">💎 Sortieren</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-deals-body">
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label><span class="tp-glossary-term" title="Sortiert Angebote nach echter Tiefstpreis-Qualität (Gewichtete Differenz). Entfernt keine Angebote.">Tiefstpreis-Sortierung</span></label>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-bestpreise-mode-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group">
          <label title="Angebotsanzahl- oder Rabatt-Sortierung (Toppreise-Liste)">Sortierung nach Angeboten / Rabatt</label>
          <div class="tp-segmented-control">
            <input type="radio" id="tp-sort-none" name="tp-sort-offers" value="none">
            <label for="tp-sort-none">Standard</label>
            <input type="radio" id="tp-sort-desc" name="tp-sort-offers" value="desc">
            <label for="tp-sort-desc">Meiste ⬇</label>
            <input type="radio" id="tp-sort-asc" name="tp-sort-offers" value="asc">
            <label for="tp-sort-asc">Wenigste ⬆</label>
            <input type="radio" id="tp-sort-discount" name="tp-sort-offers" value="discount-desc">
            <label for="tp-sort-discount">% Rabatt ⬇</label>
          </div>
        </div>
</div>
      </section>
      <section id="tp-section-filter" class="tp-section-card tp-section-filter">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-filter-body" data-collapse="tp-section-filter"><span class="tp-section-title">🧹 Filtern</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-filter-body">
        <div class="tp-settings-group">
          <span class="tp-switch-desc tp-field-hint">Negativ-Terme, Min-Angebote, <span class="tp-glossary-term" title="Angebote ohne geprüfte Preishistorie. Der Rabatt basiert nur auf UVP oder Toppreis.">Ungeprüfte</span>, <span class="tp-glossary-term" title="Verifizierter Tiefstpreis mit zu wenigen Datenpunkten für einen Ø-Vergleich. Zeigt ersatzweise den Abstand zum Vortief.">Fallback-Tiefs</span> und Händler stehen im Filter-Popover der Filterleiste.</span>
        </div>
        <div class="tp-settings-group">
          <label title="So viel teurer darf der gewählte Händler als der Bestpreis sein">Preis-Toleranz (%)</label>
          <div class="tp-range-container">
            <input type="range" id="tp-margin-range" min="0" max="50" step="0.5" value="0">
            <input type="number" id="tp-margin-val" min="0" max="50" step="0.1" value="0">
          </div>
        </div>
</div>
      </section>
      <section id="tp-section-alarm" class="tp-section-card tp-section-alarm">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-alarm-body" data-collapse="tp-section-alarm"><span class="tp-section-title">🔔 Preisalarm</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-alarm-body">
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Füllt beim Klick auf die Glocke das Preisalarm-Formular automatisch aus.">Preisalarm auto-fill</label>
          </div>
          <label class="tp-switch tp-blue">
            <input type="checkbox" id="tp-alarm-enabled-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group">
          <label title="Zielpreis als Prozent des aktuellen Preises für den Preisalarm.">Preisalarm Zielpreis (%)</label>
          <div class="tp-range-container tp-blue">
            <input type="range" id="tp-alarm-target-range" min="5" max="99" step="5" value="60">
            <input type="number" id="tp-alarm-target-val" min="5" max="99" step="1" value="60">
          </div>
        </div>
        <div class="tp-settings-group">
          <label title="Laufzeit des Preisalarms">Laufzeit</label>
          <div class="tp-segmented-control tp-segmented-control-blue">
            <input type="radio" id="tp-dur-90" name="tp-alarm-duration" value="90"><label for="tp-dur-90">3 Monate</label>
            <input type="radio" id="tp-dur-180" name="tp-alarm-duration" value="180"><label for="tp-dur-180">6 Monate</label>
            <input type="radio" id="tp-dur-365" name="tp-alarm-duration" value="365"><label for="tp-dur-365">1 Jahr</label>
            <input type="radio" id="tp-dur-730" name="tp-alarm-duration" value="730"><label for="tp-dur-730">2 Jahre</label>
          </div>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Alarmformular sofort einreichen und schliessen">Automatisch Absenden & Schliessen</label>
            <span class="tp-switch-desc">Formular direkt einreichen und Dialog schliessen</span>
          </div>
          <label class="tp-switch tp-blue">
            <input type="checkbox" id="tp-alarm-autosubmit-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
</div>
      </section>
      ${renderDiscordSection()}
      ${renderDataSection()}

      </div>
    `;
    section = tempDiv.firstElementChild;
    sectionsHolder.appendChild(section);
  }
  return section;
}

// Independent per-section collapse, remembered outside CONFIG so it never
// leaks into export/import/reset. GM primary, localStorage mirror.
export const COLLAPSE_KEY = 'tp_modal_collapsed';
export const COLLAPSE_IDS = ['tp-section-display', 'tp-section-review', 'tp-section-deals', 'tp-section-filter', 'tp-section-alarm', 'tp-section-discord', 'tp-section-data'];
export function readCollapsed() {
    try {
      if (typeof GM_getValue !== 'undefined') {
        const gv = GM_getValue('tp_suite_v2_' + COLLAPSE_KEY);
        if (Array.isArray(gv)) return gv.filter(id => COLLAPSE_IDS.includes(id));
      }
    } catch {}
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tp_suite_v2_' + COLLAPSE_KEY);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.filter(id => COLLAPSE_IDS.includes(id));
        }
      }
    } catch {}
    return [];
  };
export function writeCollapsed(ids) {
    const clean = ids.filter(id => COLLAPSE_IDS.includes(id));
    try { if (typeof GM_setValue !== 'undefined') GM_setValue('tp_suite_v2_' + COLLAPSE_KEY, clean); } catch {}
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('tp_suite_v2_' + COLLAPSE_KEY, JSON.stringify(clean)); } catch {}
  };
export function applyCollapsed(shadow) {
    for (const id of readCollapsed()) {
      const card = shadow.getElementById(id);
      if (!card) continue;
      card.classList.add('tp-collapsed');
      card.querySelector('[data-collapse]')?.setAttribute('aria-expanded', 'false');
    }
  };

export function initCollapse(shadow) {
  applyCollapsed(shadow);
  const sectionsEl = shadow.getElementById('tp-settings-sections');
  if (sectionsEl && !sectionsEl.dataset.collapseBound) {
    sectionsEl.dataset.collapseBound = '1';
    sectionsEl.addEventListener('click', (e) => {
      const header = e.target?.closest?.('[data-collapse]');
      if (!header || !sectionsEl.contains(header)) return;
      const card = shadow.getElementById(header.dataset.collapse);
      if (!card) return;
      const collapsed = card.classList.toggle('tp-collapsed');
      header.setAttribute('aria-expanded', String(!collapsed));
      writeCollapsed([...sectionsEl.querySelectorAll('section.tp-collapsed')].map(s => s.id));
    });
  }
}
