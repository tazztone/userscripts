/**
 * Modal Template Sub-Sections
 * Extracted from modal-template.js to respect module size limits.
 */

import { DEFAULTS, minPointsToIndex, MIN_POINTS_STEPS } from '../state/config.js';

export function renderDiscordSection() {
  return `
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
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{ai}">KI-Fazit {ai}</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{link}">Link {link}</button>
          </div>
          <textarea id="tp-discord-layout-input" class="tp-field-dark" rows="7" style="font-family:monospace" spellcheck="false"></textarea>
          <span class="tp-switch-desc tp-field-hint">Je Zeile ein Baustein. Tokens: {title} {price} {dealer} {offers} {prevlow} {median} {ai} {link}. Grösse via # / ## / -# am Zeilenanfang. · / + blenden leere Nachbarn aus. Preischarts werden als Bild angehängt.</span>
          <pre id="tp-discord-layout-preview"></pre>
          <span id="tp-discord-layout-count" class="tp-switch-desc"></span>
          <span id="tp-discord-layout-error" class="tp-switch-desc"></span>
          <button type="button" id="tp-discord-layout-reset" class="tp-btn tp-btn-secondary" title="Layout auf Standard zurücksetzen">Layout zurücksetzen</button>
        </div>
</div>
      </section>
  `;
}

export function renderDataSection() {
  return `
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
  `;
}
