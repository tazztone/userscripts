![Toppreise.ch Suite banner](banner.webp)

# Toppreise.ch Suite: Power-Filter & Preisalarm-Autofill

**[🇬🇧 English Version](README.md)** · **Deutsche Version**

Umfassende Userscript-Suite (`v2.18.341`) für **Toppreise.ch**: Verifiziert echte historische Tiefstpreise gegen vollständige Preisverläufe, entlarvt Schein-Rabatte (*Aufschläge*), färbt Angebote mit einer kontinuierlichen Rabatt-Heatmap, bietet 4-stufige Begriffs-, Händler- und Angebotsfilter und automatisiert Preisalarme sowie das Teilen von Deals via Discord. Kategorie-Ausschlüsse verbleiben nativ bei Toppreise (`Plugin_IgnoredCategories`: Menü pro Karte, Seitenleiste, Kopfzeile).

![Deal-Karten im Überblick: Toolbar-Aktionen, Rabatt-Heatmap, Schein-Rabatt-Erkennung, Fallback-Tief und 1-Klick-Share](docs/shots/02-feed-cards.webp)

| # | Signal / Funktion | Beschreibung |
|---|---|---|
| ① | **Heatmap-Umschalter** | Schaltet das proportionale Farbglühen der Karten in der Sticky-Leiste ein oder aus. |
| ② | **Tiefstpreis-Sortierung** | Sortiert Angebote im Raster nach authentischem gewichtetem Deal-Score (`💎 Tiefstpreis-Sortierung`). |
| ③ | **Single-Hue Deal-Heatmap** | Proportionales Leuchten nach Deal-Tiefe (tiefes Rubinrot bei Rekord-Tiefstpreisen, warmes Bernstein bei soliden Rabatten). |
| ④ | **Fallback-Tief** | Verifizierter Tiefstpreis bei wenigen Datenpunkten (< minPoints): Zeigt den Abstand zum vorherigen Tiefstpreis. |
| ⑤ | **Schein-Rabatt entlarvt** | Deckt Fake-Rabatte auf: Streicht die angebliche Ersparnis durch und hebt den echten Aufschlag (+XX%) über dem Tief hervor. |
| ⑥ | **1-Klick Discord-Share** | Erscheint bei Hover zum direkten Teilen von Deal-Details, Chart-PNG und Händlerlink via Webhook. |
| ⑦ | **Transparente Deal-Subline** | Zeigt den Vortief-Abstand in % sowie den 1-Jahres-Ø mit prozentualem Abstand. |
| ⑧ | **Günstigster Händler (`🏬`)** | Direktsprung zum günstigsten Anbieter ohne zwischengeschaltete Tracking-Umwege. |
| ⑨ | **Mini-Trend Sparkline** | Kompakte 30-Tage-Preiskurve; Klick öffnet den interaktiven Vollbild-Chart. |
| ⑩ | **1-Klick Review-Suche (`🌐`)** | Erscheint bei Hover am Produkttitel; öffnet eine Google-Suche nach Testberichten in neuem Tab. |

> [!NOTE]
> **Deal-Score-Berechnung (Karte 1, Callout ③):** −65% = 50/50-Mix aus −60% (vs. Vortief) und −70% (vs. 1-Jahres-Ø).

---

## 🎬 Video-Demos & Interaktive Showcase

[![Toppreise Suite Video Demos ansehen](docs/shots/poster-explainer.webp)](https://tazztone.github.io/userscripts/)

> 🌐 **Interaktiver Web-Player:** Schaue dir die Video-Demos mit sofortiger Sprachumschaltung (DE/EN), Kurzdemos und Feature-Walkthroughs direkt auf unserer **[Dokumentationsseite](https://tazztone.github.io/userscripts/)** an.

### Direkte Video-Downloads & Mirrors
| Demo-Clip | Dauer | Format | Sprache | Direkter Download |
|---|---|---|---|---|
| **Kurzübersicht** | 1 Min | 9:16 Vertikales MP4 | 🇩🇪 Deutsch | [⬇️ `short_DE.mp4` herunterladen](https://github.com/tazztone/userscripts/releases/download/media-v1/short_DE.mp4) |
| **Quick Demo** | 1 Min | 9:16 Vertikales MP4 | 🇬🇧 English | [⬇️ `short.mp4` herunterladen](https://github.com/tazztone/userscripts/releases/download/media-v1/short.mp4) |
| **Ausführliche Erklärung** | 7 Min | 16:9 HD MP4 | 🇩🇪 Deutsch | [⬇️ `explainer_DE.mp4` herunterladen](https://github.com/tazztone/userscripts/releases/download/media-v1/explainer_DE.mp4) |
| **Full Walkthrough** | 7 Min | 16:9 HD MP4 | 🇬🇧 English | [⬇️ `explainer.mp4` herunterladen](https://github.com/tazztone/userscripts/releases/download/media-v1/explainer.mp4) |

---

## 🚀 Installation

Erfordert einen Userscript-Manager als Browser-Erweiterung:
- [Violentmonkey](https://violentmonkey.github.io/) (empfohlen: [Firefox](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/) · [Chrome / Brave](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag))
- [Tampermonkey](https://www.tampermonkey.net/)

### 👉 [**HIER KLICKEN ZUR INSTALLATION (v2.18.345)**](https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js)

> [!NOTE]
> Das Skript enthält `@updateURL`- und `@downloadURL`-Metadaten. Dein Userscript-Manager prüft GitHub automatisch im Hintergrund und hält die Installation aktuell.

---

## ✨ Hauptfunktionen

### 🔍 Tiefstpreis-Prüfung & Gewichtete Differenz

![Berechnungsparameter & Glitch-Erkennung](docs/shots/01b-calc-popover.webp)

| # | Parameter / Element | Beschreibung |
|---|---|---|
| ① | **Gewichtung Median / Rekord** | Schieberegler zur Abstimmung zwischen Rekord-Durchbruch und Ersparnis gegenüber dem Median. |
| ② | **Ø-Zeitraum (Median-Horizont)** | Einstellbares Zeitfenster (30 bis 730 Tage oder Lifetime), um veraltete Launch-Preise auszublenden. |
| ③ | **Mindestpunkte** | Erforderliche Anzahl historischer Datenpunkte für die qualifizierte Deal-Bewertung. |
| ④ | **Ausreisser filtern** | Aktiviert die automatische Erkennung und Verwerfung von Preissprüngen. |
| ⑤ | **Glitch-Band** | Einstellbares Toleranzband (±1%–50%) um den Median. |
| ⑥ | **Glitch-Fenster** | Maximale Dauer eines Preissprungs (24h–168h), der als Glitch verworfen wird. |
| ⑦ | **Glitch-Vorschau (Live-Chart)** | Interaktive SVG-Vorschau mit dynamischem Zeitachsen-Raster und Stichtag, Ø-Preis, Allzeit-Rekord, Glitch-Band und erkannten Glitches (rote ✕-Marker). |

* **Prüfung auf Abruf & Batch-Checker:** Klicke auf das Differenz-Badge (`🔍`) einer Karte oder nutze den schwebenden **Batch-Checker** (unten links), um alle sichtbaren Deals ab dem Schwellenwert (`≥20%–60%`) nacheinander abzufragen (mit Live-Zähler und Abbruch-Option).
* **Gewichtete Differenz (`⚖️`):** Verifizierte Tiefstpreise werden anhand einer frei wählbaren Mischung aus **Median-Rabatt (`Ø-Preis`)** und **Rekordmarge (`Rekord`)** bewertet. Diese Kennzahl steuert Badge-Prozentwert, Heatmap-Farbe und Feed-Reihenfolge.
* **Rollierender Median-Zeithorizont (30–730 Tage + Lifetime):** Verhindert verzerrte Marktpreise bei älteren Produkten (z. B. 2 Jahre alte Grafikkarten mit hoher Launch-UVP). Ein Wechsel rechnet alle gecachten Mediane sofort lokal neu — ohne erneute Netzabfrage.
* **Multi-Pass Preisfehler- & Ausreisser-Filter:** Erkennt und ignoriert automatisch kurzzeitige Fehllistings (z. B. ein CHF 15 Handy-Case, das versehentlich unter einem CHF 1'200 Smartphone gelistet war) mittels rollierendem ±15-Punkte-Lokalmedian (konfigurierbares Glitch-Band `±1%–50%`, Glitch-Fenster `24h–168h`), mit interaktiver Live-SVG-Vorschau im `⚖️`-Popover.
* **Entlarvung von Schein-Rabatten:** Produkte über ihrem historischen Tief erhalten ein auffälliges `Aufschlag (+XX%)`-Badge mit durchgestrichener ungeprüfter Differenz (`~~-YY%~~`) und Anzeige des echten Tiefstpreises unter dem Preis.
* **Transparente Subline & Günstigster Händler (`🏬`):** Zeigt die Aufschlüsselung (`📉 CHF 2'399.00 (-X%) · Ø (1J) CHF 2'450.00 (-Y%)`) und den günstigsten Händlernamen mit Direktlink zum Angebot, optional mit automatischem Nachladen im Hintergrund (`max. 3 parallel`).
* **Versandkosten-Basis (`inkl. Versand`):** Preishistorien ohne (`_p`) und mit Versand (`_s`) werden getrennt gecacht und ausgewertet, sodass Preisbasen niemals vermischt werden.

### 🔥 Visuelle Signale, Sparklines & Karten-Design

* **Kontinuierliche Heatmap (Grau→Rot-Skala):** Verifizierte Deals leuchten proportional zur Gewichteten Differenz (neutrales Grau bei geringem Rabatt → warmes Bernstein → tiefes Rubinrot bei Rekord-Deals). Ungeprüfte Karten tragen ein grau gestreiftes Badge mit vorläufiger Kartenwärme.
* **Fallback-Tiefs:** Verifizierte Tiefstpreise ohne qualifizierten Median (zu wenige Datenpunkte `< minPoints`, HTML-Fallback ohne Zeitreihe oder flache Kurve `< 2%`). Zeigen den Vortief-Abstand statt des Blends (ohne `⚖️`) und lassen sich separat filtern (Normal/Dimmen/Verbergen). Qualifizierte Deals mit 0% Ersparnis tragen ein neutral-graues 0%-Badge.
* **Neu-Geprüft-Glow (*Neu*-Puls):** Frisch verifizierte Tiefstpreise pulsieren mindestens 5s lang mit Kontur und `Neu`-Markierung bis zur nächsten Nutzerinteraktion.
* **Interaktive SVG-Sparklines:** Kompakte Mini-Preiskurve direkt auf geprüften Karten. Klick auf die Sparkline öffnet den grossen interaktiven Chart-Dialog mit Preis- und Monatsachsen.
* **1-Klick Review-Suche (`🌐`):** Such-Icon bei Hover am Produkttitel öffnet Google mit `<Produktname> Testbericht` (oder Wunschbegriff) in neuem Tab, optional mit **Google-KI-Modus (`&udm=50`)**.

### 🧹 Sticky Filterleiste

![Sticky Filterleiste](docs/shots/01a-toolbar.webp)

| # | Steuerelement | Beschreibung |
|---|---|---|
| ① | **Filter-Button** | Öffnet die 4-stufigen Filterregler; der Button zeigt farbige Zähler-Pills (Bernstein für verbergen, Gelb für dimmen, Grün für hervorheben). |
| ② | **Begriffe (Negativ-Filter)** | Sofortiger Ausschluss unerwünschter Begriffe mit wortgenauer Erkennung. |
| ③ | **Min-Angebote** | Filtert Angebote mit weniger als **N** Händlern aus (nur auf Seiten mit Händlerzeilen aktiv). |
| ④ | **Ungeprüfte Angebote** | Blendet Angebote ohne verifizierte Preishistorie aus oder dimmt sie. |
| ⑤ | **Fallback-Tiefs** | Steuert die Sichtbarkeit von Angeboten mit geringer Datenpunktdichte. |
| ⑥ | **Min-Rabatt** | Filtert geprüfte Angebote mit weniger als **X%** Rabatt aus (ungeprüfte bleiben sichtbar). |
| ⑦ | **Batch-Scanner CTA** | 1-Klick Batch-Prüfung aller sichtbaren Angebote ab dem gewählten Rabatt (`🔍 Tiefstpreise prüfen`). |

* **Kontextsensitive Leiste:** Passt sich automatisch an Deal-Feeds (`/neue-toppreise`), Suchseiten (`/produktsuche/...`) und Produktseiten an.
* **4-stufiger Filter pro Ursache:** Jeder Filtergrund kann unabhängig geschaltet werden zwischen **Normal**, **Dimmen** (einstellbare Deckkraft), **Verbergen** und **Hervorheben** (gepunkteter Rahmen):
  * **Negativer Textfilter:** Unerwünschte Begriffe ausschliessen (Komma/Semikolon/Zeilenumbruch; lange Begriffe `>3` Zeichen als Teilstring, kurze Begriffe `≤3` Zeichen wortgenau).
  * **Mindest-Angebote:** Marktplatz-Einträge mit weniger als **N** Händlern filtern.
  * **Ungeprüfte:** Unverifizierte Angebote im Feed ausblenden oder dimmen.
  * **Fallback-Tiefs:** Sichtbarkeit von Tiefstpreisen mit dünner Historie steuern.
  * **Händler-Bestpreis-Prüfung:** Hebt Karten mit grünem Rahmen und `Toppreis`-Badge hervor, wenn der gefilterte Shop das beste Angebot hält (innerhalb einer Toleranz von `0%–50%`).
* **Live-Grid-Sortierung:** Sortiert Angebote direkt im Raster nach **Gewichteter Differenz (`Tiefstpreis-Sortierung`)** (geordnet nach Tiers: verifizierte Deals inkl. 0%-Deals > Fallback-Tiefs > Ungeprüfte > Aufschläge), **Rabatt (`% Rabatt ⬇`)** oder **Händleranzahl (`Meiste ⬇` / `Wenigste ⬆`)** — stellt beim Deaktivieren die exakte Ursprungsreihenfolge wieder her.
* **Leere-Feed-Hinweis (Empty State):** Sind alle Produkte ausgeblendet, bietet ein Hinweis 1-Klick-Aktionen zur Wiederherstellung (`[ ⚡ Filter ausschalten ]`, `[ 🔍 Tiefstpreise prüfen ]` oder `[ Ungeprüfte einblenden ]`).

### 🔔 Preisalarm Auto-Filler

* **Sofortiges Ausfüllen:** Klick auf Toppreises Alarm-Glocke setzt Zielpreis (`5%–99%`, Standard `60%`) und Laufzeit (`3`, `6`, `12` oder `24` Monate), passend zum Schweizer Währungsformat (`CHF 1'299.–`).
* **Modi:** **Nur Ausfüllen** (Standard: manuell prüfen und absenden) oder **Auto-Submit** (akzeptiert AGB und sendet direkt ab; schliesst erst nach bestätigter Server-Übermittlung).

### 💬 1-Klick Discord Deal-Sharing (`📤`)

* **Webhook-Integration:** Verifizierte Tiefstpreis-Karten zeigen bei Hover einen `📤`-Button, der den Deal via Webhook in Discord-Kanäle oder Foren-Threads postet. Bereits geteilte Karten bleiben markiert.
* **High-DPI Chart & Produktbild:** Rendert den Preisverlauf mit Achsenraster als PNG und hängt ihn zusammen mit dem Produktbild an (dient in Foren-Kanälen als Thread-Vorschau).
* **Layout-Baukasten:** Eigene Nachrichtenstruktur mit Tokens (`{title}`, `{price}`, `{dealer}`, `{offers}`, `{prevlow}`, `{median}`, `{ai}`, `{link}`), Presets (*Kompakt*, *Ausführlich*, *Minimal*), Live-Markdown-Vorschau und getrennten Embed-Schaltern.

---

## 🧭 Schnellübersicht Bedienung

| Element / Icon | Ort | Aktion |
| --- | --- | --- |
| **Sticky Filterleiste** | Oberhalb der Produktliste | Negativ-Begriffe, Mindestangebote und Filtergründe einstellen; Heatmap und Tiefstpreis-Sortierung umschalten; `⚖️`-Berechnungspopover öffnen. |
| **Batch-Checker-CTA** | Schwebend unten links | Alle sichtbaren Deals ab Mindestdifferenz (`≥X%`) mit einem Klick prüfen; Schalter für automatisches Händlerladen (`🏬`). |
| **Differenz-Badge (`🔍` / `⚖️`)** | Oben rechts auf Karte | Einzelprodukt prüfen oder Historie aktualisieren. |
| **Günstigster Händler (`🏬`)** | Neben Preis auf Karte | Direktlink zum Händlershop im neuen Tab; bei Hover Händler im Feed nachladen. |
| **Mini-Sparkline** | Unten auf geprüfter Karte | Klick öffnet den grossen interaktiven Preishistorien-Chart. |
| **Share-Button (`📤`)** | Unten links auf Deal-Karte | Postet Deal, Text-Übersicht und PNG-Chart an den Discord-Webhook. |
| **Web-Suche & KI-Fazit (`🌐`)** | Hover am Produkttitel | Klick öffnet KI-Kurzfazit auf der Karte (mit Tavily Key) oder Google-Suche in neuem Tab. |
| **Einstellungen-Button (`⚙️`)** | Schwebend unten rechts | Öffnet das gekapselte Shadow-DOM-Einstellungsmenü. |

### ⌨️ Tastatur-Shortcuts

| Taste | Kontext | Aktion |
| --- | --- | --- |
| `/` | Beliebig auf Listenseiten | Fokussiert sofort das Texteingabefeld des Negativ-Filters (inaktiv bei Texteingabe). |
| `Escape` | Einstellungsdialog oder Filter | Schliesst das Einstellungsmenü bzw. hebt den Filter-Fokus auf. |

---

## 📑 Seitenkontexte & Variantenschutz

Das Skript passt seine Oberfläche automatisch an den jeweiligen Seitentyp an:

![Variantengruppierung und Inline-Pills in der Produktsuche](docs/shots/03-search-cards.webp)

| # | Element | Beschreibung |
|---|---|---|
| ① | **Verifizierte Rabatt-Pill** | Kompakte einzeilige Pill neben dem Produkttitel für geprüfte Tiefstpreise. |
| ② | **Ungeprüft-Pill** | Gestreiftes Hinweissignal für noch nicht geprüfte Varianten (Klick startet Prüfung). |

* **Tiefstpreis-Feeds (`/neue-toppreise`):** Zeigt die vollständige Toolbar mit konsolidiertem Filter-Button (`🧹 Filter (N)`), Heatmap, `💎 Tiefstpreis-Sortierung`, Batch-Scanner und Berechnungsparametern (`⚖️`).
* **Katalog- & Suchergebnisse (`/produktsuche/...`):** Kompakte Leiste mit vollständigem Schutz für Produktvarianten-Serien (`.Plugin_ProductCollItem`). Gruppierte Produktfamilien (z. B. AirPods mit oder ohne Ladecase) bleiben stets als geschlossene Einheit erhalten; das Bootstrap-Layout wird nie zerrissen. Platzsparende 1-Zeilen-Pills (`.tp-deal-pill`) sitzen sauber neben den Produkttiteln.
* **Produkt-Detailseiten (`/preisvergleich/...-p...`):** Filterleiste wird ausgeblendet; ein dezentes Tiefstpreis-Badge wird direkt neben dem Haupttitel und Hauptpreis eingebettet.

---

## ⚙️ Einstellungen & Konfiguration

Klick auf das **Zahnrad-Symbol (`⚙️`)** unten rechts öffnet das Einstellungsmenü (`#tp-root`). Dank gekapseltem Shadow DOM und nativem HTML5 `<dialog>` (`showModal()`) im Top Layer des Browsers ist es immun gegen CSS- und z-Index-Konflikte der Hauptseite. Gegliedert in Basis- und Erweiterte Einstellungen:

### Basis-Einstellungen (Bereiche 1–5: Ansicht, Review-Suche, Sortieren, Filtern, Preisalarm)

![Shadow DOM Einstellungen: Basis-Bereiche](docs/shots/04a-settings-core.webp)

| # | Einstellung / Bereich | Beschreibung |
|---|---|---|
| ① | **Dimmungs-Deckkraft** | Regelt die Transparenz gedimmter und ausgefilterter Angebote im Raster. |
| ② | **Review-Suche (🌐)** | Konfiguriert die Google-Suche mit optionalem KI-Modus (`&udm=50`). |
| ③ | **Tiefstpreis-Sortierung** | Aktiviert die Sortierung nach authentischem gewichtetem Deal-Score (`💎`). |
| ④ | **Preis-Toleranz (%)** | Erlaubter Aufschlag gegenüber dem Bestpreis für den bevorzugten Händler. |
| ⑤ | **Preisalarm Auto-Fill** | Automatische Vorbelegung von Zielpreis in Prozent (5%–99%) und Alarmdauer. |

### Erweiterte Einstellungen (Bereiche 6–7: Discord Share & Daten/Cache)

![Shadow DOM Einstellungen: Erweiterte Bereiche](docs/shots/04b-settings-advanced.webp)

| # | Einstellung / Bereich | Beschreibung |
|---|---|---|
| ① | **Discord Webhook** | Vertrauliche Webhook-URL für das 1-Klick Teilen verifizierter Deals. |
| ② | **Layout-Baukasten** | Frei anpassbare Bausteine mit variablen Tokens (`{title}`, `{price}`, `{dealer}`, etc.). |
| ③ | **Live-Markdown-Vorschau** | Sofortige Vorschau der generierten Discord-Nachricht. |
| ④ | **Händler-Autoload** | Lädt den günstigsten Händler für Deals ab Schwelle automatisch im Hintergrund nach (max. 3 parallel). |
| ⑤ | **Daten- & Cache-Verwaltung** | Cache leeren (`🗑️`), Daten zurücksetzen (`🧨`), Cache-TTL und Konfigurations-Export. |

1. **🖥️ Ansicht:** Deckkraft für gedimmte Karten, Werbeplätze/Banner ausblenden (entfernt leere Werbeflächen oben und im Layout) und Deal-Intensität / Heatmap-Stärke (20%–100%).
2. **🌐 Web-Suche & KI-Fazit:** Schalter für Suche (`🌐`) am Produktnamen, anpassbarer Suchbegriff (inkl. `{preis}`), Google-KI-Modus (`&udm=50`) und Tavily API-Key (ermöglicht 1-Klick KI-Fazit direkt auf der Karte und `{ai}` im Discord-Share; 48h gecached).
3. **💎 Sortieren:** Tiefstpreis-Sortierung nach Gewichteter Differenz (`💎`) und Angebots-/Rabatt-Sortierung (`Standard`, `Meiste ⬇`, `Wenigste ⬆`, `% Rabatt ⬇`).
4. **🧹 Filtern:** Preis-Toleranz (%) für Händler-Bestpreis; Verweis auf Negativ-Begriffe, Min-Angebote, Ungeprüfte und Fallback-Tiefs im Filterleisten-Popover.
5. **🔔 Preisalarm:** Zielpreis-Prozentsatz (5%–99%, Standard 60%), Laufzeit (3, 6, 12, 24 Monate) und automatisches Absenden & Schliessen.
6. **💬 Discord Share:** Webhook-URL (nur lokal in `GM_setValue`), Embed-Unterdrückung, Layout-Baukasten mit Tokens (`{title}`, `{price}`, `{ai}`, etc.), Presets und Live-Markdown-Vorschau.
7. **💾 Daten & Cache:** Händler-Autoload, Gewichtete Differenz (Sortierung + Farb-Emphase), Mindest-Datenpunkte, Median-Berechnungszeitraum, Prüf-Vorauswahl für Batch-Check, Versandkosten-Basis (`inkl. Versand`), Sparklines, Cache-TTL, Cache leeren (`🗑️`), Daten zurücksetzen (`🧨`) und Konfigurations-Export/Import.

---

## 🔒 Datenschutz, Speicherung & Berechtigungen

* **Lokaler Cache:** Preishistorien (`tp_hist_v1_*`), Händlerdaten (`tp_dealer_v1_*`) und Deal-Marker (`tp_shared_v1_*`) liegen in `localStorage` mit einem 500-Einträge-LRU-Speicher im Arbeitsspeicher und werden per TTL bereinigt (48h für gültige Daten, 2h für nicht verfügbare Charts).
* **2-Ebenen-Persistenz:** Einstellungen und Negativfilter nutzen ein ausfallsicheres System (`GM_setValue` / `GM_getValue` mit automatischem `localStorage`-Backup), das Skript-Neuinstallationen übersteht.
* **Sicherheit vertraulicher Keys:** Webhook-URL und Tavily API-Key werden ausschliesslich im privaten Userscript-Manager-Speicher (`GM_setValue`) gehalten. Sie gelangen **niemals** in das seitenlesbare `localStorage` und werden bei JSON-Exporten automatisch entfernt.
* **Erforderliche Berechtigungen:**
  * `GM_getValue` / `GM_setValue` / `GM_deleteValue`: Isolierte Speicherung der Einstellungen.
  * `GM_xmlhttpRequest` (`@connect toppreise.ch`, `@connect discord.com`, `@connect api.tavily.com`): Für Produktbilder, Discord-Webhooks und Tavily Web-Synthese.

---

## 🛠️ Architektur & Entwicklung

Der Quellcode ist modular in 45 ESM-Dateien unter `src/` gegliedert (jede `<25 KB`) und wird durch `tools/build.js` in exakter Ladereihenfolge gebündelt:

```text
src/
├── domain/       # Reine Preisberechnung, Ausreisser-Filter, Median & Deal-Scoring
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

# Prüft Modulgrössen (25 KB Richtwert)
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
