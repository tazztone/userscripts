/**
 * Modal Template Sub-Sections
 * Extracted from modal-template.js to respect module size limits.
 */

export function renderDiscordSection() {
  return `
      <section id="tp-section-discord" class="tp-section-card tp-section-discord">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-discord-body" data-collapse="tp-section-discord"><span class="tp-section-title">💬 Discord Share</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-discord-body">
        <div class="tp-group-head-row">
          <span>Kanäle &amp; Webhooks</span>
          <button type="button" class="tp-btn-group-reset" data-reset-group="discord" title="Discord-Optionen auf Standard zurücksetzen" aria-label="Discord-Optionen auf Standard zurücksetzen">↺</button>
        </div>
        <div class="tp-settings-group">
          <label title="Webhooks deiner Discord-Kanäle (Kanal-Einstellungen → Integrationen → Webhook). Nur lokal gespeichert, nie exportiert.">📤 Discord Kanäle &amp; Webhooks (Deals-Share)</label>
          <div id="tp-discord-channels-list" class="tp-discord-channels-list">
            <div class="tp-discord-channel-card" data-channel-id="default">
              <div class="tp-discord-channel-header">
                <input type="text" id="tp-discord-primary-name" class="tp-field-dark tp-discord-channel-name" value="Standard" placeholder="Kanalname (z.B. Standard)" title="Name des Discord-Kanals">
              </div>
              <div id="tp-discord-webhook-collapsed">
                <span id="tp-discord-webhook-status" class="tp-switch-desc"></span>
                <button type="button" id="tp-discord-webhook-reveal" class="tp-btn tp-btn-secondary" aria-expanded="false" aria-controls="tp-discord-webhook-editor">🔑 Webhook ersetzen / entfernen</button>
              </div>
              <div id="tp-discord-webhook-editor" style="display: none;">
                <input type="password" id="tp-discord-webhook-input" class="tp-field-dark" placeholder="https://discord.com/api/webhooks/…" autocomplete="new-password" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true">
                <span class="tp-switch-desc tp-field-hint">Ermöglicht den 📤-Button auf verifizierten Tiefstpreis-Karten. Leer = Webhook entfernen.</span>
              </div>
            </div>
            <div id="tp-discord-extra-channels"></div>
          </div>
          <button type="button" id="tp-discord-add-channel-btn" class="tp-btn tp-btn-secondary" style="margin-top: 6px;">➕ Weiteren Kanal hinzufügen</button>
        </div>
        <details class="tp-subsection" data-sub="discord-embeds">
          <summary class="tp-subsection-header">🖼️ Embed- &amp; Foren-Optionen</summary>
          <div class="tp-subsection-body">
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
          </div>
        </details>
        <details class="tp-subsection" data-sub="discord-layout">
          <summary class="tp-subsection-header">🧩 Nachrichten-Layout (Baukasten)</summary>
          <div class="tp-subsection-body">
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
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{rating}">Bewertung {rating}</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{comment}">Kommentar {comment}</button>
            <button type="button" class="tp-btn tp-btn-secondary" data-token="{link}">Link {link}</button>
          </div>
          <textarea id="tp-discord-layout-input" class="tp-field-dark" rows="7" style="font-family:monospace" spellcheck="false"></textarea>
          <span class="tp-switch-desc tp-field-hint">Je Zeile ein Baustein. Tokens: {title} {price} {dealer} {offers} {prevlow} {median} {ai} {rating} {comment} {link}. Grösse via # / ## / -# am Zeilenanfang. · / + blenden leere Nachbarn aus. Preischarts werden als Bild angehängt.</span>
          <pre id="tp-discord-layout-preview"></pre>
          <span id="tp-discord-layout-count" class="tp-switch-desc"></span>
          <span id="tp-discord-layout-error" class="tp-switch-desc"></span>
          <button type="button" id="tp-discord-layout-reset" class="tp-btn tp-btn-secondary" title="Layout auf Standard zurücksetzen">Layout zurücksetzen</button>
        </div>
          </div>
        </details>
</div>
      </section>
  `;
}

export function renderDataSection() {
  return `
      <section id="tp-section-data" class="tp-section-card tp-section-data">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-data-body" data-collapse="tp-section-data"><span class="tp-section-title">💾 Daten &amp; Cache</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-data-body">
        <details class="tp-subsection" data-sub="data-cache">
          <summary class="tp-subsection-header">🗄️ Cache, Abruf &amp; Limits</summary>
          <div class="tp-subsection-body">
        <div class="tp-group-head-row">
          <span>Cache &amp; Speicher-Limits</span>
          <button type="button" class="tp-btn-group-reset" data-reset-group="cache" title="Cache-Einstellungen auf Standard zurücksetzen" aria-label="Cache-Einstellungen auf Standard zurücksetzen">↺</button>
        </div>
        <div class="tp-settings-group tp-cache-row">
          <div id="tp-cache-stats-label">Lokaler Cache: 0 Einträge</div>
          <button type="button" id="tp-cache-clear-btn" class="tp-btn tp-btn-secondary">🗑️ Cache leeren</button>
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
          </div>
        </details>
        <details class="tp-subsection" data-sub="data-backup">
          <summary class="tp-subsection-header">📦 Sicherung (Export / Import)</summary>
          <div class="tp-subsection-body">
        <div class="tp-settings-group tp-btn-row">
          <button type="button" id="tp-export-config-btn" title="Einstellungen als JSON-Datei sichern." class="tp-btn tp-btn-secondary">📥 Export (JSON)</button>
          <button type="button" id="tp-import-config-btn" title="Einstellungen aus einer JSON-Datei wiederherstellen." class="tp-btn tp-btn-secondary">📤 Import (JSON)</button>
          <input type="file" id="tp-import-config-file" accept=".json">
        </div>
          </div>
        </details>
        <details class="tp-subsection tp-subsection-danger" data-sub="data-danger">
          <summary class="tp-subsection-header">⚠️ Gefahrenzone</summary>
          <div class="tp-subsection-body">
        <div class="tp-settings-group tp-danger-zone">
          <span class="tp-switch-desc">Gefahrenzone: löscht Cache und setzt alle Einstellungen zurück.</span>
          <button type="button" id="tp-data-reset-btn" class="tp-btn tp-btn-danger" title="Löscht Preis- und Händler-Cache und setzt ALLE Einstellungen (inkl. Discord-Webhook) auf Standard zurück.">🧨 Alle Daten löschen</button>
        </div>
          </div>
        </details>
</div>
      </section>
  `;
}

export function renderAboutSection() {
  return `
      <section id="tp-section-about" class="tp-section-card tp-section-about">
<button type="button" class="tp-section-header" aria-expanded="true" aria-controls="tp-section-about-body" data-collapse="tp-section-about"><span class="tp-section-title">ℹ️ Über &amp; Hilfe</span><span class="tp-chevron" aria-hidden="true"></span></button>
<div class="tp-section-body" id="tp-section-about-body">
        <div class="tp-about-meta">
          <div class="tp-about-title-row">
            <span class="tp-about-name">Toppreise.ch Suite</span>
            <span id="tp-about-version" class="tp-about-version-pill">vdev</span>
          </div>
          <div class="tp-about-facts">
            <span>Handler: <strong id="tp-about-handler">Browser</strong></span>
            <span>Autor: <strong>tazztone</strong></span>
            <span>Lizenz: <strong>MIT</strong></span>
          </div>
        </div>
        <div class="tp-about-links">
          <a href="https://github.com/tazztone/userscripts" target="_blank" rel="noopener noreferrer" class="tp-about-link"><span>📦 GitHub Repository</span><span class="tp-about-link-arrow" aria-hidden="true">↗</span></a>
          <a href="https://tazztone.github.io/userscripts/" target="_blank" rel="noopener noreferrer" class="tp-about-link"><span>📖 Doku &amp; Video-Demos</span><span class="tp-about-link-arrow" aria-hidden="true">↗</span></a>
          <a href="https://github.com/tazztone/userscripts/issues" target="_blank" rel="noopener noreferrer" class="tp-about-link"><span>🐛 Bug melden / Issues</span><span class="tp-about-link-arrow" aria-hidden="true">↗</span></a>
          <a href="https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js" target="_blank" rel="noopener noreferrer" class="tp-about-link"><span>🔄 Userscript / Update</span><span class="tp-about-link-arrow" aria-hidden="true">↗</span></a>
        </div>
        <div class="tp-about-diag-row">
          <button type="button" id="tp-about-open-diag-btn" class="tp-btn tp-btn-secondary">🛠️ Dev-Diagnose-Log öffnen</button>
          <span class="tp-switch-desc">Tipp: Shift+Klick oder gedrückt halten auf ⚙️ öffnet das Log direkt.</span>
        </div>
</div>
      </section>
  `;
}
