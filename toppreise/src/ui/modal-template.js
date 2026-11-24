/**
 * Modal template (split from ui/modal.js): settings section HTML + collapse state.
 */

import { DEFAULTS, minPointsToIndex, MIN_POINTS_STEPS } from '../state/config.js';
import { renderDiscordSection, renderDataSection, renderAboutSection } from './modal-template-sections.js';
import { renderReviewSection } from './modal-ai-section.js';

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
        <div class="tp-group-head-row">
          <span>Anzeige, Heatmap &amp; Diagramme</span>
          <button type="button" class="tp-btn-group-reset" data-reset-group="display" title="Ansicht auf Standard zurücksetzen" aria-label="Ansicht auf Standard zurücksetzen">↺</button>
        </div>
        <div class="tp-settings-group" id="tp-dim-opacity-group">
          <label title="Deckkraft gedimmter Karten (Filter-Modus Dimmen)">Deckkraft / Dimmung (Gedimmt &amp; Gefiltert)</label>
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
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label>Mini-Preiskurven (Sparklines) anzeigen</label>
            <span class="tp-switch-desc">Erfordert zusätzliche Server-Abfragen pro Produkt</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-sparklines-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label>Amazon Keepa-Verlauf im Preisverlauf</label>
            <span class="tp-switch-desc">Zeigt bei Amazon.de-Deals den detaillierten Keepa-Verlauf (Buy Box, Amazon, Neu) im Preisverlauf-Diagramm an</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-keepa-chart-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
</div>
      </section>
      <section id="tp-section-deals" class="tp-section-card tp-section-deals">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-deals-body" data-collapse="tp-section-deals"><span class="tp-section-title">💎 Deals &amp; Sortieren</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-deals-body">
        <details class="tp-subsection" data-sub="deals-sort" open>
          <summary class="tp-subsection-header">📊 Sortierung &amp; Deals</summary>
          <div class="tp-subsection-body">
        <div class="tp-group-head-row">
          <span>Sortierung &amp; Deals</span>
          <button type="button" class="tp-btn-group-reset" data-reset-group="deals" title="Sortieren auf Standard zurücksetzen" aria-label="Sortieren auf Standard zurücksetzen">↺</button>
        </div>
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
        </details>
        <details class="tp-subsection" data-sub="deals-weights">
          <summary class="tp-subsection-header">⚖️ Berechnungsparameter &amp; Prüfung</summary>
          <div class="tp-subsection-body">
        <div class="tp-group-head-row">
          <span>Berechnungsparameter &amp; Analyse</span>
          <button type="button" class="tp-btn-group-reset" data-reset-group="weights" title="Berechnungsparameter auf Standard zurücksetzen" aria-label="Berechnungsparameter auf Standard zurücksetzen">↺</button>
        </div>
        <div class="tp-settings-group">
          <span class="tp-switch-desc tp-field-hint">Ausreisser-Filter (Glitch-Erkennung): siehe ⚖️-Popover in der Filterleiste.</span>
        </div>
        <div class="tp-settings-group" id="tp-bestpreise-weight-group">
          <label><span class="tp-glossary-term" title="Kombiniert Rekord-Tiefstpreis und Durchschnittsrabatt im gewählten Mix für Badge, Farbe und Platzierung.">Gewichtete Differenz</span>: Sortierung + Farb-Emphase (Rekord vs Ø)</label>
          <div class="tp-range-container tp-purple">
            <input type="range" id="tp-bestpreise-weight-range" min="0" max="100" step="5" value="50">
            <input type="number" id="tp-bestpreise-weight-val" min="0" max="100" step="5" value="50">
          </div>
          <span class="tp-switch-desc tp-field-hint" id="tp-bestpreise-weight-desc">50% Rekord / 50% Ø-Preis (Sortierung + Farb-Emphase) · z.B. Rek −10% + Ø −25% → Gewichtete Differenz 18</span>
        </div>
        <div class="tp-settings-group" id="tp-bestpreise-minpoints-group">
          <label title="Ø-Vergleich erst ab so vielen Punkten (Punkte ≈ Tage). Darunter: Fallback-Tief.">Mindestanzahl Datenpunkte in der Preishistorie</label>
          <div class="tp-range-container tp-purple">
            <input type="range" id="tp-bestpreise-minpoints-range" min="0" max="${MIN_POINTS_STEPS.length - 1}" step="1" value="${minPointsToIndex(DEFAULTS.BESTPREISE_MIN_POINTS)}">
            <input type="number" id="tp-bestpreise-minpoints-val" min="1" max="100" step="1" value="5">
          </div>
          <span class="tp-switch-desc tp-field-hint">Nur Historien ab dieser Punktzahl bekommen einen gewichteten Ø-Vergleich (⚖️/💎). Darunter: <span class="tp-glossary-term" title="Verifizierter Tiefstpreis mit zu wenigen Datenpunkten für einen Ø-Vergleich. Zeigt ersatzweise den Abstand zum Vortief.">Fallback-Tief</span> (Abstand zum Vortief, ohne Ø-Vergleich).</span>
        </div>
        <div class="tp-settings-group" id="tp-bestpreise-horizon-group">
          <label title="Zeitraum für den Ø-Preis-Vergleich">Median-Berechnungszeitraum (Ø-Preis)</label>
          <div class="tp-range-container tp-purple">
            <input type="range" id="tp-bestpreise-horizon-range" min="30" max="760" step="5" value="365">
            <input type="number" id="tp-bestpreise-horizon-val" min="0" max="3650" step="1" value="365">
          </div>
          <span class="tp-switch-desc tp-field-hint" id="tp-bestpreise-horizon-desc">Ø-Vergleich: 1J (0 = gesamte Historie / Lifetime, Vorgabe: 1J). Bestimmt den Vergleichszeitraum für den durchschnittlichen Marktpreis.</span>
        </div>
        <div class="tp-settings-group">
          <label title="Nur Differenzen ab diesem Wert automatisch prüfen">Prüf-Vorauswahl: Mindest-Differenz für Batch-Check (%)</label>
          <div class="tp-range-container">
            <input type="range" id="tp-real-deal-min-range" min="10" max="70" step="5" value="30">
            <input type="number" id="tp-real-deal-min-val" min="0" max="90" step="5" value="30">
          </div>
          <span class="tp-switch-desc tp-field-hint">Nur Differenzen ab diesem Wert (ungeprüft) werden automatisch geprüft. Die Prüfung ersetzt sie durch den echten Rabatt.</span>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label"><label title="Versandkosten in den Preisvergleich einrechnen.">inkl. Versand</label></div>
          <label class="tp-switch">
            <input type="checkbox" id="tp-shipping-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
          </div>
        </details>
</div>
      </section>
      <section id="tp-section-filter" class="tp-section-card tp-section-filter">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-filter-body" data-collapse="tp-section-filter"><span class="tp-section-title">🧹 Filtern</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-filter-body">
        <div class="tp-group-head-row">
          <span>Filter &amp; Profile</span>
          <button type="button" class="tp-btn-group-reset" data-reset-group="filter" title="Filter auf Standard zurücksetzen" aria-label="Filter auf Standard zurücksetzen">↺</button>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Merkt sich Filter, Heatmap und Sortierung getrennt für Neue Toppreise vs. Suche &amp; Katalog.">Einstellungen pro Seitentyp merken</label>
            <span class="tp-switch-desc">Eigene Filter, Heatmap und Sortierung für Neue Toppreise vs. Suche/Katalog</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-filter-remember-per-page-type-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group tp-profile-indicator-group">
          <span class="tp-switch-desc tp-field-hint">Aktives Profil: <span id="tp-profile-active-badge" class="tp-profile-pill">⚡ Neue Toppreise</span></span>
        </div>
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
      ${renderReviewSection()}
      <section id="tp-section-alarm" class="tp-section-card tp-section-alarm">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-alarm-body" data-collapse="tp-section-alarm"><span class="tp-section-title">🔔 Preisalarm</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-alarm-body">
        <div class="tp-group-head-row">
          <span>Preisalarm Parameter</span>
          <button type="button" class="tp-btn-group-reset" data-reset-group="alarm" title="Preisalarm auf Standard zurücksetzen" aria-label="Preisalarm auf Standard zurücksetzen">↺</button>
        </div>
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
            <label title="Alarmformular sofort einreichen und schliessen">Automatisch Absenden &amp; Schliessen</label>
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
      ${renderAboutSection()}

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
export const COLLAPSE_IDS = ['tp-section-display', 'tp-section-deals', 'tp-section-filter', 'tp-section-review', 'tp-section-alarm', 'tp-section-discord', 'tp-section-data', 'tp-section-about'];
export const SUB_OPEN_KEY = 'tp_modal_sub_open';
const SUB_DEFAULT_OPEN = ['deals-sort'];

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
export function readOpenSubs() {
  try {
    if (typeof GM_getValue !== 'undefined') {
      const gv = GM_getValue('tp_suite_v2_' + SUB_OPEN_KEY);
      if (Array.isArray(gv)) return gv.map(String);
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('tp_suite_v2_' + SUB_OPEN_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String);
      }
    }
  } catch {}
  return [...SUB_DEFAULT_OPEN];
}
export function writeOpenSubs(ids) {
  const clean = [...new Set(ids.map(String))];
  try { if (typeof GM_setValue !== 'undefined') GM_setValue('tp_suite_v2_' + SUB_OPEN_KEY, clean); } catch {}
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('tp_suite_v2_' + SUB_OPEN_KEY, JSON.stringify(clean)); } catch {}
}
export function clearCollapsedState() {
  try { if (typeof GM_deleteValue !== 'undefined') GM_deleteValue('tp_suite_v2_' + COLLAPSE_KEY); } catch {}
  try { if (typeof GM_deleteValue !== 'undefined') GM_deleteValue(COLLAPSE_KEY); } catch {}
  try { if (typeof GM_deleteValue !== 'undefined') GM_deleteValue('tp_suite_v2_' + SUB_OPEN_KEY); } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('tp_suite_v2_' + COLLAPSE_KEY);
      localStorage.removeItem(COLLAPSE_KEY);
      localStorage.removeItem('tp_suite_v2_' + SUB_OPEN_KEY);
    }
  } catch {}
}
export function applyCollapsed(shadow) {
    for (const id of readCollapsed()) {
      const card = shadow.getElementById(id);
      if (!card) continue;
      card.classList.add('tp-collapsed');
      card.querySelector('[data-collapse]')?.setAttribute('aria-expanded', 'false');
    }
    const openSubs = new Set(readOpenSubs());
    shadow.querySelectorAll('details.tp-subsection[data-sub]').forEach(det => {
      det.open = openSubs.has(det.dataset.sub);
    });
  };

export function syncCollapseAllBtn(shadow) {
  const btn = shadow?.getElementById('tp-btn-collapse-all');
  const sectionsEl = shadow?.getElementById('tp-settings-sections');
  if (!btn || !sectionsEl) return;
  const cards = [...sectionsEl.querySelectorAll('section.tp-section-card')];
  const anyCollapsed = cards.some(c => c.classList.contains('tp-collapsed'));
  btn.textContent = anyCollapsed ? 'Alle ausklappen' : 'Alle einklappen';
}

export function initCollapse(shadow) {
  applyCollapsed(shadow);
  syncCollapseAllBtn(shadow);
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
      syncCollapseAllBtn(shadow);
    });
    sectionsEl.addEventListener('toggle', (e) => {
      const det = e.target;
      if (!det?.matches?.('details.tp-subsection[data-sub]')) return;
      writeOpenSubs([...sectionsEl.querySelectorAll('details.tp-subsection[data-sub][open]')].map(d => d.dataset.sub));
    }, true);
  }
  const collapseAllBtn = shadow.getElementById('tp-btn-collapse-all');
  if (collapseAllBtn && !collapseAllBtn.dataset.bound) {
    collapseAllBtn.dataset.bound = '1';
    collapseAllBtn.addEventListener('click', () => {
      if (!sectionsEl) return;
      const cards = [...sectionsEl.querySelectorAll('section.tp-section-card')];
      const shouldExpand = cards.some(c => c.classList.contains('tp-collapsed'));
      for (const card of cards) {
        card.classList.toggle('tp-collapsed', !shouldExpand);
        card.querySelector('[data-collapse]')?.setAttribute('aria-expanded', String(shouldExpand));
      }
      writeCollapsed(shouldExpand ? [] : cards.map(c => c.id));
      syncCollapseAllBtn(shadow);
    });
  }
}
