![Toppreise.ch Suite banner](banner.jpg)

# Toppreise.ch Suite: Power-Filter & Preisalarm-Autofill

**[🇬🇧 English Version](README.md)** · **Deutsche Version**

Umfassende Userscript-Suite (`v2.18.314`) für **Toppreise.ch**: Verifiziert echte historische Tiefstpreise gegen vollständige Preisverläufe, entlarvt Schein-Rabatte (*Aufschläge*), färbt Angebote mit einer kontinuierlichen Rabatt-Heatmap, bietet 4-stufige Begriffs-, Händler- und Angebotsfilter und automatisiert Preisalarme sowie das Teilen von Deals via Discord. Kategorie-Ausschlüsse verbleiben nativ bei Toppreise (`Plugin_IgnoredCategories`: Menü pro Karte, Seitenleiste, Kopfzeile).

![Toolbar: alle Filter, Heatmap, Batch-CTA](docs/shots/01-toolbar.webp)
![Feed-Karten: Heat-Deal, Aufschlag-Morph, Fallback-Tief, Share-Hover](docs/shots/02-feed-cards.webp)
![Such-Karten: Inline-Pill, Pruefen-Pill, guenstigste Variante](docs/shots/03-search-cards.webp)
![Einstellungen: alle Bereiche auf einer Seite](docs/shots/04-settings-modal.webp)

---

## 🚀 Installation

Erfordert einen Userscript-Manager als Browser-Erweiterung:
- [Violentmonkey](https://violentmonkey.github.io/) (empfohlen: [Firefox](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/) · [Chrome / Brave](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag))
- [Tampermonkey](https://www.tampermonkey.net/)

### 👉 [**HIER KLICKEN ZUR INSTALLATION (v2.18.314)**](https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js)

> [!NOTE]
> Das Skript enthält `@updateURL`- und `@downloadURL`-Metadaten. Dein Userscript-Manager prüft GitHub automatisch im Hintergrund und hält die Installation aktuell.

---

## ✨ Hauptfunktionen

### 🔍 Tiefstpreis-Prüfung & Gewichtete Differenz

* **Prüfung auf Abruf & Batch-Checker:** Klicke auf das Differenz-Badge (`🔍`) einer Karte oder nutze den schwebenden **Batch-Checker** (unten links), um alle sichtbaren Deals ab dem Schwellenwert (`≥20%–60%`) nacheinander abzufragen (mit Live-Zähler und Abbruch-Option).
* **Gewichtete Differenz (`⚖️`):** Verifizierte Tiefstpreise werden anhand einer frei wählbaren Mischung aus **Median-Rabatt (`Ø-Preis`)** und **Rekordmarge (`Rekord`)** bewertet. Diese Kennzahl steuert Badge-Prozentwert, Heatmap-Farbe und Feed-Reihenfolge.
* **Rollierender Median-Zeithorizont (30–730 Tage + Lifetime):** Verhindert verzerrte Marktpreise bei älteren Produkten (z. B. 2 Jahre alte Grafikkarten mit hoher Launch-UVP). Ein Wechsel rechnet alle gecachten Mediane sofort lokal neu — ohne erneute Netzabfrage.
* **Multi-Pass Preisfehler- & Ausreißer-Filter:** Erkennt und ignoriert automatisch kurzzeitige Fehllistings (z. B. ein CHF 15 Handy-Case, das versehentlich unter einem CHF 1'200 Smartphone gelistet war) mittels rollierendem ±15-Punkte-Lokalmedian (konfigurierbares Glitch-Band `±1%–50%`, Glitch-Fenster `24h–168h`), mit interaktiver Live-SVG-Vorschau im `⚖️`-Popover.
* **Entlarvung von Schein-Rabatten:** Produkte über ihrem historischen Tief erhalten ein auffälliges `Aufschlag (+XX%)`-Badge mit durchgestrichener ungeprüfter Differenz (`~~-YY%~~`) und Anzeige des echten Tiefstpreises unter dem Preis.
* **Transparente Subline & Günstigster Händler (`🏬`):** Zeigt die Aufschlüsselung (`📉 CHF 2'399.00 (-X%) · Ø (1J) CHF 2'450.00 (-Y%)`) und den günstigsten Händlernamen mit Direktlink zum Angebot, optional mit automatischem Nachladen im Hintergrund (`max. 3 parallel`).
* **Versandkosten-Basis (`inkl. Versand`):** Preishistorien ohne (`_p`) und mit Versand (`_s`) werden getrennt gecacht und ausgewertet, sodass Preisbasen niemals vermischt werden.

### 🔥 Visuelle Signale, Sparklines & Karten-Design

* **Kontinuierliche Heatmap (Grau→Rot-Skala):** Verifizierte Deals leuchten proportional zur Gewichteten Differenz (neutrales Grau bei geringem Rabatt → warmes Bernstein → tiefes Rubinrot bei Rekord-Deals). Ungeprüfte Karten tragen ein grau gestreiftes Badge mit vorläufiger Kartenwärme.
* **Fallback-Tiefs:** Verifizierte Tiefstpreise ohne qualifizierten Median-Vergleich (unterhalb der konfigurierbaren `📊` Mindest-Datenpunkte-Schwelle, 1–100) erhalten einen dezenten Außen-Glow ohne Median-Mischung.
* **Neu-Geprüft-Glow (*Neu*-Puls):** Frisch verifizierte Tiefstpreise pulsieren mindestens 5s lang mit Kontur und `Neu`-Markierung bis zur nächsten Nutzerinteraktion.
* **Interaktive SVG-Sparklines:** Kompakte Mini-Preiskurve direkt auf geprüften Karten. Klick auf die Sparkline öffnet den großen interaktiven Chart-Dialog mit Preis- und Monatsachsen.
* **1-Klick Review-Suche (`🌐`):** Such-Icon am Produkttitel öffnet Google mit `<Produktname> Testbericht` (oder Wunschbegriff) in neuem Tab, optional mit **Google-KI-Modus (`&udm=50`)**.

### 🧹 Sticky Filterleiste & Grid-Sortierung

* **Kontextsensitive Leiste:** Passt sich automatisch an Deal-Feeds (`/neue-toppreise`), Suchseiten (`/produktsuche/...`) und Produktseiten an.
* **4-stufiger Filter pro Ursache:** Jeder Filtergrund kann unabhängig geschaltet werden zwischen **Normal**, **Dimmen** (einstellbare Deckkraft), **Verbergen** und **Hervorheben** (gepunkteter Rahmen):
  * **Negativer Textfilter:** Unerwünschte Begriffe ausschließen (Komma/Semikolon/Zeilenumbruch; lange Begriffe `>3` Zeichen als Teilstring, kurze Begriffe `≤3` Zeichen wortgenau).
  * **Mindest-Angebote:** Marktplatz-Einträge mit weniger als $N$ Händlern filtern.
  * **Ungeprüfte:** Unverifizierte Angebote im Feed ausblenden oder dimmen.
  * **Fallback-Tiefs:** Sichtbarkeit von Tiefstpreisen mit dünner Historie steuern.
  * **Händler-Bestpreis-Prüfung:** Hebt Karten mit grünem Rahmen und `Toppreis`-Badge hervor, wenn der gefilterte Shop das beste Angebot hält (innerhalb einer Toleranz von `0%–50%`).
* **Live-Grid-Sortierung:** Sortiert Angebote direkt im Raster nach **Gewichteter Differenz (`Tiefstpreis-Sortierung`)**, **Rabatt (`% Rabatt ⬇`)** oder **Händleranzahl (`Meiste ⬇` / `Wenigste ⬆`)** — stellt beim Deaktivieren die exakte Ursprungsreihenfolge wieder her.
* **Leere-Feed-Hinweis (Empty State):** Sind alle Produkte ausgeblendet, bietet ein Hinweis 1-Klick-Aktionen zur Wiederherstellung (`[ ⚡ Filter ausschalten ]`, `[ 🔍 Tiefstpreise prüfen ]`).

### 🔔 Preisalarm Auto-Filler

* **Sofortiges Ausfüllen:** Klick auf Toppreises Alarm-Glocke setzt Zielpreis (`5%–99%`, Standard `60%`) und Laufzeit (`3`, `6`, `12` oder `24` Monate), passend zum Schweizer Währungsformat (`CHF 1'299.–`).
* **Modi:** **Nur Ausfüllen** (Standard: manuell prüfen und absenden) oder **Auto-Submit** (akzeptiert AGB und sendet direkt ab; schließt erst nach bestätigter Server-Übermittlung).

### 💬 1-Klick Discord Deal-Sharing (`📤`)

* **Webhook-Integration:** Verifizierte Tiefstpreis-Karten zeigen bei Hover einen `📤`-Button, der den Deal via Webhook in Discord-Kanäle oder Foren-Threads postet. Bereits geteilte Karten bleiben markiert.
* **High-DPI Chart & Produktbild:** Rendert den Preisverlauf mit Achsenraster als PNG und hängt ihn zusammen mit dem Produktbild an (dient in Foren-Kanälen als Thread-Vorschau).
* **Layout-Baukasten:** Eigene Nachrichtenstruktur mit Tokens (`{title}`, `{price}`, `{dealer}`, `{offers}`, `{prevlow}`, `{median}`, `{link}`), Presets (*Kompakt*, *Ausführlich*, *Minimal*), Live-Markdown-Vorschau und getrennten Embed-Schaltern.

---

## 🧭 Schnellübersicht Bedienung

| Element / Icon | Ort | Aktion |
| --- | --- | --- |
| **Sticky Filterleiste** | Oberhalb der Produktliste | Negativ-Begriffe, Mindestangebote und Filtergründe einstellen; Heatmap und Tiefstpreis-Sortierung umschalten; `⚖️`-Berechnungspopover öffnen. |
| **Batch-Checker-CTA** | Schwebend unten links | Alle sichtbaren Deals ab Mindestdifferenz (`≥X%`) mit einem Klick prüfen; Schalter für automatisches Händlerladen (`🏬`). |
| **Differenz-Badge (`🔍` / `⚖️`)** | Oben rechts auf Karte | Einzelprodukt prüfen oder Historie aktualisieren. |
| **Günstigster Händler (`🏬`)** | Neben Preis auf Karte | Direktlink zum Händlershop im neuen Tab; bei Hover Händler im Feed nachladen. |
| **Mini-Sparkline** | Unten auf geprüfter Karte | Klick öffnet den großen interaktiven Preishistorien-Chart. |
| **Share-Button (`📤`)** | Unten links auf Deal-Karte | Postet Deal, Text-Übersicht und PNG-Chart an den Discord-Webhook. |
| **Review-Suche (`🌐`)** | Hinter dem Produkttitel | Öffnet Google-Suche nach Testberichten in neuem Tab (optional mit KI-Modus `&udm=50`). |
| **Einstellungen-Button (`⚙️`)** | Schwebend unten rechts | Öffnet das gekapselte Shadow-DOM-Einstellungsmenü. |

### ⌨️ Tastatur-Shortcuts

| Taste | Kontext | Aktion |
| --- | --- | --- |
| `/` | Beliebig auf Listenseiten | Fokussiert sofort das Texteingabefeld des Negativ-Filters (inaktiv bei Texteingabe). |
| `Escape` | Einstellungsdialog oder Filter | Schließt das Einstellungsmenü bzw. hebt den Filter-Fokus auf. |

---

## 📑 Seitenkontexte & Variantenschutz

Das Skript passt seine Oberfläche automatisch an den jeweiligen Seitentyp an:

* **Tiefstpreis-Feeds (`/neue-toppreise`):** Zeigt die vollständige Toolbar mit konsolidiertem Filter-Button (`🧹 Filter (N)`), Heatmap, `💎 Tiefstpreis-Sortierung`, Batch-Scanner und Berechnungsparametern (`⚖️`).
* **Katalog- & Suchergebnisse (`/produktsuche/...`):** Kompakte Leiste mit vollständigem Schutz für Produktvarianten-Serien (`.Plugin_ProductCollItem`). Gruppierte Produktfamilien (z. B. AirPods mit oder ohne Ladecase) bleiben stets als geschlossene Einheit erhalten; das Bootstrap-Layout wird nie zerrissen. Platzsparende 1-Zeilen-Pills (`.tp-deal-pill`) sitzen sauber über den Preisen.
* **Produkt-Detailseiten (`/preisvergleich/...-p...`):** Filterleiste wird ausgeblendet; ein dezentes Tiefstpreis-Badge wird direkt neben dem Haupttitel und Hauptpreis eingebettet.

---

## ⚙️ Einstellungen & Konfiguration

Klick auf das **Zahnrad-Symbol (`⚙️`)** unten rechts öffnet das Einstellungsmenü (`#tp-root`). Dank gekapseltem Shadow DOM und nativem HTML5 `<dialog>` (`showModal()`) im Top Layer des Browsers ist es immun gegen CSS- und z-Index-Konflikte der Hauptseite:

1. **🖥️ Anzeige:** Filterdarstellung (`Hervorheben`, `Dimmen`, `Verbergen`), Preistoleranz (%), Deckkraft-Regler für gedimmte Karten, Versandkosten-Vergleich und Standard-Sortierung (`Meiste ⬇`, `Wenigste ⬆`, `% Rabatt ⬇`).
2. **💎 Deals & Tiefstpreise:** Heatmap an/aus und Intensität (20%–100%), Schieberegler für Gewichtete Differenz (Median vs. Rekord), Mindest-Datenpunkte (1–100), Analyse-Zeithorizont (30–730 Tage oder Lifetime) und Prüf-Vorauswahl für den Scanner.
3. **🔔 Preisalarm:** Zielpreis-Prozentsatz (Standard 60%), Laufzeit (3 bis 24 Monate) und Auto-Submit-Schalter.
4. **💬 Discord Share:** Webhook-URL, Layout-Baukasten mit Tokens, Live-Markdown-Vorschau, Presets und Embed-Unterdrückung für Links.
5. **💾 Daten & Cache:** Sparklines an/aus, Händler-Autoload, Cache-Dauer (24h bis 14 Tage), Negativ-Cache (1h bis 24h), Live-Zähler, Cache leeren (`🗑️`), Daten zurücksetzen (`🧨`) sowie JSON-Konfigurations-Export und -Import.

---

## 🔒 Datenschutz, Speicherung & Berechtigungen

* **Lokaler Cache:** Preishistorien (`tp_hist_v1_*`), Händlerdaten (`tp_dealer_v1_*`) und Deal-Marker (`tp_shared_v1_*`) liegen in `localStorage` mit einem 500-Einträge-LRU-Speicher im Arbeitsspeicher und werden per TTL bereinigt (48h für gültige Daten, 2h für nicht verfügbare Charts).
* **2-Ebenen-Persistenz:** Einstellungen und Negativfilter nutzen ein ausfallsicheres System (`GM_setValue` / `GM_getValue` mit automatischem `localStorage`-Backup), das Skript-Neuinstallationen übersteht.
* **Sicherheit des Discord-Webhooks:** Die Webhook-URL wird ausschließlich im privaten Userscript-Manager-Speicher (`GM_setValue`) gehalten. Sie gelangt **niemals** in das seitenlesbare `localStorage` und wird bei JSON-Exporten automatisch entfernt.
* **Erforderliche Berechtigungen:**
  * `GM_getValue` / `GM_setValue` / `GM_deleteValue`: Isolierte Speicherung der Einstellungen.
  * `GM_xmlhttpRequest` (`@connect toppreise.ch`, `@connect discord.com`): Ausschließlich für den Download von Produktbildern für Deal-Anhänge und das Senden an den konfigurierten Discord-Webhook.

---

## 🛠️ Architektur & Entwicklung

Der Quellcode ist modular in 45 ESM-Dateien unter `src/` gegliedert (jede `<25 KB`) und wird durch `tools/build.js` in exakter Ladereihenfolge gebündelt:

```text
src/
├── domain/       # Reine Preisberechnung, Ausreißer-Filter, Median & Deal-Scoring
├── scanner/      # LRU/localStorage-Cache & ratenbegrenzter Batch-Scanner
├── page/         # DOM-Selektoren, Seiten-Adapter, Extraktion & Grid-Sortierung
├── state/        # Konfigurationsschema, Migrationen, GM/Storage-Sync & Scan-Store
├── ui/           # Styles, Shadow DOM, Modal, Filterleiste, Badges & SVG-Sparklines
├── features/     # Discord-Webhook, Preisalarm-Autofill & Detailseiten-Logik
└── app.js        # Pipeline-Einstiegspunkt, MutationObserver & Lebenszyklus
```

### Build-Pipeline & Quality-Gates

```bash
# Erzeugt toppreise.user.js aus src/
node toppreise/tools/build.js

# Prüft Bundle-Integrität gegen Drift (CI-Gate)
node toppreise/tools/build.js --check

# Prüft Modulgrößen (25 KB Richtwert)
node toppreise/tools/check-modules.js

# Überprüft die JavaScript-Syntax des Bundles
node --check toppreise/toppreise.user.js
```

### 🧪 Testausführung

```bash
# Schnelle Unit-Tests (~40ms, ohne Browser-Overhead)
node --test toppreise/tests/unit/*.test.js

# Gezielte Logik-Tests via pytest
venv/bin/pytest toppreise/tests/test_price_logic.py

# Playwright Browser-Regressionstests (~40s)
venv/bin/pytest toppreise/tests/test_catalog_layout.py
```
