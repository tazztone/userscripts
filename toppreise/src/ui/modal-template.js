/**
 * Modal template (split from ui/modal.js): settings section HTML + collapse state.
 */

import { DEFAULTS, minPointsToIndex, MIN_POINTS_STEPS } from '../state/config.js';

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
            <label title="Hängt ans Ende jedes Produktnamens ein 🌐-Icon. Klick öffnet eine Google-Suche nach dem Produkt in einem neuen Tab.">Web-Suche (🌐) anzeigen</label>
            <span class="tp-switch-desc">Google-Suche pro Produktname in neuem Tab</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-review-search-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group">
          <label title="Dieser Begriff wird an den Produktnamen angehängt.">Suchbegriff</label>
          <div id="tp-search-keyword-chips">
            <button type="button" class="tp-btn tp-btn-secondary" data-preset="Testbericht">Testbericht</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-preset="Erfahrungen">Erfahrungen</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-preset="Preiseinschätzung {preis}">Preiseinschätzung</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{preis}">Preis {preis}</button>
          </div>
          <input type="text" id="tp-review-keyword-input" class="tp-field-dark" value="Testbericht" maxlength="40" placeholder="Testbericht" spellcheck="false" autocomplete="off">
          <span class="tp-switch-desc tp-field-hint">Wird an den Produktnamen angehängt, z. B. „Testbericht“ oder „Erfahrungen“. Leer = Standard (Testbericht). „{preis}“ fügt den aktuellen Kartenpreis ein (CHF, nur bei geprüften historischen Daten), z. B. „Preiseinschätzung {preis}“.</span>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Öffnet die Suche in Googles KI-Modus (Parameter &udm=50).">Im KI-Modus suchen</label>
            <span class="tp-switch-desc">Google AI Mode statt klassischer Trefferliste</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-review-ai-mode-toggle">
            <span class="tp-slider"></span>
          </label>
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
      <section id="tp-section-discord" class="tp-section-card tp-section-discord">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-discord-body" data-collapse="tp-section-discord"><span class="tp-section-title">💬 Discord Share</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-discord-body">
        <div class="tp-settings-group">
          <label title="Webhook-URL deines Discord-Channels (Kanal-Einstellungen → Integrationen → Webhook). Nur lokal gespeichert, nie committet.">📤 Discord Webhook (1-Klick Deals-Share)</label>
          <div id="tp-discord-webhook-collapsed">
            <span id="tp-discord-webhook-status" class="tp-switch-desc"></span>
            <button type="button" id="tp-discord-webhook-reveal" class="tp-btn tp-btn-secondary" aria-expanded="false" aria-controls="tp-discord-webhook-editor">🔑 Webhook ersetzen / entfernen</button>
          </div>
          <div id="tp-discord-webhook-editor" style="display: none;">
            <input type="password" id="tp-discord-webhook-input" class="tp-field-dark" placeholder="https://discord.com/api/webhooks/…" autocomplete="new-password" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true">
            <span class="tp-switch-desc tp-field-hint">Ermöglicht den 📤-Button auf verifizierten Tiefstpreis-Karten. Leer = Button meldet fehlende URL.</span>
          </div>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Unterdrückt die automatische Händler-Link-Vorschau (Embed) unter Discord-Posts.">Händler-Link Embed</label>
            <span class="tp-switch-desc">AUS = keine Händler-Vorschau</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-discord-dealer-embed-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Unterdrückt die automatische Produkt-Link-Vorschau (Embed) unter Discord-Posts. Das Preisverlauf-Bild wird weiterhin angehängt.">Toppreise-Link Embed</label>
            <span class="tp-switch-desc">AUS = keine Produkt-Vorschau (Bild bleibt)</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-discord-product-embed-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Zeigt den Deal-Titel auch im Body von Forenposts (sonst nur als Thread-Titel).">Titel im Foren-Body</label>
            <span class="tp-switch-desc">AN = Titel auch im Foren-Body</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-discord-forum-title-toggle">
            <span class="tp-slider"></span>
          </label>
        </div>
        <div class="tp-settings-group">
          <label for="tp-discord-layout-input" title="Aufbau der Discord-Nachricht (eine Zeile je Baustein)">Nachrichten-Layout (Baukasten)</label>
          <div>
            <button type="button" id="tp-discord-layout-preset-kompakt" class="tp-btn tp-btn-secondary" title="Layout: kompakt einsetzen">Kompakt</button>
            <button type="button" id="tp-discord-layout-preset-ausfuehrlich" class="tp-btn tp-btn-secondary" title="Layout: ausführlich einsetzen">Ausführlich</button>
            <button type="button" id="tp-discord-layout-preset-minimal" class="tp-btn tp-btn-secondary" title="Layout: minimal einsetzen">Minimal</button>
          </div>
          <div id="tp-discord-layout-chips">
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{title}">Titel {title}</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{price}">Preis {price}</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{dealer}">Händler {dealer}</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{offers}">Angebote {offers}</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{prevlow}">Bisher {prevlow}</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{median}">Ø-Preis {median}</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{link}">Link {link}</button>
          </div>
          <textarea id="tp-discord-layout-input" class="tp-field-dark" rows="7" style="font-family:monospace" spellcheck="false"></textarea>
          <span class="tp-switch-desc tp-field-hint">Je Zeile ein Baustein. Tokens: {title} {price} {dealer} {offers} {prevlow} {median} {link}. Grösse via # / ## / -# am Zeilenanfang. · / + blenden leere Nachbarn aus. Preischarts werden als Bild angehängt.</span>
          <pre id="tp-discord-layout-preview"></pre>
          <span id="tp-discord-layout-count" class="tp-switch-desc"></span>
          <span id="tp-discord-layout-error" class="tp-switch-desc"></span>
          <button type="button" id="tp-discord-layout-reset" class="tp-btn tp-btn-secondary" title="Layout auf Standard zurücksetzen">Layout zurücksetzen</button>
        </div>
</div>
      </section>
      <section id="tp-section-data" class="tp-section-card tp-section-data">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-data-body" data-collapse="tp-section-data"><span class="tp-section-title">💾 Daten & Cache</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-data-body">
        <div class="tp-settings-group">
          <span class="tp-switch-desc tp-field-hint">Ausreisser-Filter (Glitch-Erkennung): siehe ⚖️-Popover in der Filterleiste.</span>
        </div>
        <div class="tp-settings-group tp-switch-container">
          <div class="tp-switch-label">
            <label title="Lädt den günstigsten Händler für Deals ab Schwelle automatisch (statt per 🏬-Klick).">Händler automatisch laden</label>
            <span class="tp-switch-desc">Erfordert zusätzliche Produktseiten-Abfragen (max. 3 parallel)</span>
          </div>
          <label class="tp-switch tp-purple">
            <input type="checkbox" id="tp-dealer-autofetch-toggle">
            <span class="tp-slider"></span>
          </label>
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
            <input type="range" id="tp-bestpreise-horizon-range" min="30" max="760" step="30" value="365">
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
        <div class="tp-settings-group tp-cache-row">
          <div id="tp-cache-stats-label">Lokaler Cache: 0 Einträge</div>
          <button type="button" id="tp-cache-clear-btn" class="tp-btn tp-btn-secondary">🗑️ Cache leeren</button>
        </div>
        <div class="tp-settings-group">
          <label title="Maximale Anzahl an Preishistorien im Arbeitsspeicher (LRU)">RAM-Cache Limit (Einträge)</label>
          <div class="tp-range-container">
            <input type="range" id="tp-cache-memory-range" min="100" max="2000" step="50" value="500">
            <input type="number" id="tp-cache-memory-val" min="100" max="2000" step="50" value="500">
          </div>
          <span class="tp-switch-desc tp-field-hint">Hält bis zu N Einträge im Arbeitsspeicher (Standard: 500). Ältere Einträge weichen per LRU.</span>
        </div>
        <div class="tp-settings-group">
          <label title="Maximale Anzahl an Preishistorien im Browser-Speicher (localStorage)">Festplatten-Cache Limit (Einträge)</label>
          <div class="tp-range-container">
            <input type="range" id="tp-cache-disk-range" min="100" max="1000" step="50" value="300">
            <input type="number" id="tp-cache-disk-val" min="100" max="1000" step="50" value="300">
          </div>
          <span class="tp-switch-desc tp-field-hint">Maximaler lokaler Browser-Speicher (Standard: 300). Bei Überschreitung wird auf 80% bereinigt.</span>
        </div>
        <div class="tp-settings-group tp-danger-zone">
          <span class="tp-switch-desc">Gefahrenzone: löscht Cache und setzt alle Einstellungen zurück.</span>
          <button type="button" id="tp-data-reset-btn" class="tp-btn tp-btn-danger" title="Löscht Preis- und Händler-Cache und setzt ALLE Einstellungen (inkl. Discord-Webhook) auf Standard zurück.">🧨 Alle Daten löschen</button>
        </div>
        <div class="tp-settings-group">
          <label title="So lange bleiben Preisdaten lokal gespeichert">Cache-Dauer für Preishistorie (Gültige Daten)</label>
          <select id="tp-cache-ttl-select" class="tp-select tp-field-dark">
            <option value="24">24 Stunden (1 Tag)</option>
            <option value="48">48 Stunden (2 Tage) [Standard]</option>
            <option value="72">72 Stunden (3 Tage)</option>
            <option value="168">7 Tage (1 Woche)</option>
            <option value="336">14 Tage (2 Wochen)</option>
          </select>
          <span class="tp-switch-desc tp-field-hint">Bestimmt, wie lange abgefragte Preisstatistiken lokal gespeichert bleiben</span>
        </div>
        <div class="tp-settings-group">
          <label title="So lange werden leere Ergebnisse zwischengespeichert">Negativ-Cache Dauer (Nicht verfügbare Daten)</label>
          <select id="tp-cache-neg-ttl-select" class="tp-select tp-field-dark">
            <option value="1">1 Stunde</option>
            <option value="2">2 Stunden [Standard]</option>
            <option value="6">6 Stunden</option>
            <option value="12">12 Stunden</option>
            <option value="24">24 Stunden</option>
          </select>
          <span class="tp-switch-desc tp-field-hint">Verhindert wiederholte Server-Anfragen bei Produkten ohne Preiskurve</span>
        </div>
        <div class="tp-settings-group tp-btn-row">
          <button type="button" id="tp-export-config-btn" title="Einstellungen als JSON-Datei sichern." class="tp-btn tp-btn-secondary">📥 Export (JSON)</button>
          <button type="button" id="tp-import-config-btn" title="Einstellungen aus einer JSON-Datei wiederherstellen." class="tp-btn tp-btn-secondary">📤 Import (JSON)</button>
          <input type="file" id="tp-import-config-file" accept=".json">
        </div>
</div>
      </section>

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
