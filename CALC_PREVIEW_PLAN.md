# Live-Vorschau der Berechnungsparameter (Reale Preishistorien im ⚖️-Popover)

## Context & Motivation

Der ⚖️-Popover (`Berechnungsparameter`) steuert sechs zentrale Stellschrauben für Sortierung und visuelle Deal-Emphase:
1. **Gewichtung** (`BESTPREISE_WEIGHT_RECORD`): Balance zwischen Ø-Preis-Rabatt und Rekord-Abstand (0 % bis 100 % Rekord).
2. **Ø-Zeitraum** (`BESTPREISE_MEDIAN_HORIZON_DAYS`): Betrachtungsfenster für den Vergleichsmedian (30 T bis 720 T / Lifetime).
3. **Mindestpunkte** (`BESTPREISE_MIN_POINTS`): Qualifikationshürde (1 bis 100 Datenpunkte ≈ Tage).
4. **Ausreißer-Filter Toggle** (`OUTLIER_REJECTION_ENABLED`): An/Aus für Glitch-Verwerfung.
5. **Glitch-Band** (`OUTLIER_DEVIATION_BAND`): Abweichungstoleranz vom Median (±20 % bis ±90 %).
6. **Glitch-Fenster** (`OUTLIER_MAX_GLITCH_HOURS`): Maximale Dauer eines Preissprungs (12 h bis 168 h).

Bislang fehlte jeder optische Bezug zu echten Marktverläufen. Anstelle rein synthetischer Dummy-Kurven binden wir **drei reale, repräsentative Preishistorien direkt von Toppreise.ch** ein, zwischen denen der Nutzer per Schnellauswahl umschalten kann:
- **📱 Samsung Galaxy S26 Ultra 512 GB** (`p839149`): Typischer Smartphone-Launchverlauf (230 Tage, 847–1249 CHF).
- **📷 Canon EOS R5 Body** (`p616604`): Reifer 6-Jahre-Kamerazyklus (2139 Tage, 1386–4528 CHF) mit massiver Horizont-Spreizung und realen Glitches bei straffem Band.
- **💾 Samsung 990 PRO NVMe SSD 2 TB** (`p702884`): Extremer 4-Jahre-Speicherzyklus (1499 Tage, 99.95–311.45 CHF, historischer Tiefstpreis mit nachfolgender Rallye).
- **🧪 Glitch-Demo (Synthetisch)**: 23-Punkte-Extremfall (Dip 150 CHF, Spike 2500 CHF) für gezielte Schwellwert-Demonstrationen.

### Kern-Invarianten
- **Keine neuen CONFIG-Keys**: Aktives Vorschau-Preset bleibt lokaler Session-State des Popovers.
- **Unverändertes Summary-Format**: `#tp-bar-calc-summary` bleibt exakt `50/50 · 1J · 5 Pkt`.
- **Zero-Lag Interaktivität (60 fps)**: Reagiert live beim Ziehen aller 6 Regler sowie beim Wechseln des Presets.
- **Kompakter Bundle-Footprint**: Verlustfreie Run-Length-Kodierung (RLE) hält alle drei realen Verläufe zusammen unter 12 KB.
- **Bundler-Konformität**: Registrierung in `toppreise/tools/build.js` vor `ui/toolbar.js`; Drift-Gate `--check` bleibt grün.

---

## UI Blueprint & Popover-Aufbau

```text
┌────────────────────────────────────────────────────────┐
│ ⚖️ Berechnungsparameter                                │
│ Sortierung + Farb-Emphase — filtert nichts             │
├────────────────────────────────────────────────────────┤
│ ⚖️ 50/50               [───●───────]  (Gewichtung)     │
│ Ø-Zeitraum 1J          [──────●────]  (Horizont)       │
│ 📊 5 Pkt               [──●────────]  (Mindestpunkte)  │
│ [X] 🧹 Ausreißer filtern                               │
│ Glitch-Band ±60 %      [─────●─────]                   │
│ Glitch-Fenster 48 h    [──●────────]                   │
├────────────────────────────────────────────────────────┤ ◄── Trennlinie (border-top)
│ Live-Vorschau       [ 📷 Canon EOS R5 (6J) ▾ ]         │ ◄── Preset-Selektor
│ ┌────────────────────────────────────────────────────┐ │
│ │ 4.5k ──┐                                           │ │
│ │        │  ┌────── Glitch-Band (±60%) ──────┐       │ │
│ │ 2648 ──┼──┴────────────────────────────────┴─ Ø    │ │
│ │        │                                           │ │
│ │ 1299 ──┴─────────────────────────────────────● 1299│ │
│ └────────────────────────────────────────────────────┘ │
│ 0 Glitches gefiltert (2139 Punkte aktiv)               │ ◄── #tp-preview-legend
│ Ø −51% · Rek −6% → Badge −29% (50% Rek)                │ ◄── #tp-preview-blend
│ Ø (1J) 2648 · 365 Pkt im Fenster · 2139/5 Pkt ✓        │ ◄── #tp-preview-status
├────────────────────────────────────────────────────────┤
│                                      [ Zurücksetzen ]  │ ◄── #tp-bar-calc-reset
└────────────────────────────────────────────────────────┘
```

---

## Die vier Vorschau-Profile im Detail

| Preset-ID | Produkt / Quelle | Datenpunkte | Reale Preisspanne | Demo-Dealpreis | Didaktischer Fokus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `s26` *(Default)* | **Samsung Galaxy S26 Ultra 512 GB**<br>([p839149](https://www.toppreise.ch/preisvergleich/Smartphones/SAMSUNG-Galaxy-S26-Ultra-512-GB-Schwarz-SM-S948-p839149)) | 230 Tage | 847 – 1249 CHF | **799 CHF** | **Junges Produkt (< 1J)**: Rascher Preisabfall nach Launch. Zeigt Stabilität bei Horizonten > 230 T (wo Fenster = Historie). |
| `r5` | **Canon EOS R5 Body**<br>([p616604](https://www.toppreise.ch/preisvergleich/Digitalkameras/CANON-EOS-R5-Body-3-Jahre-Premium-Garantie-4147C026-p616604)) | 2139 Tage | 1386.75 – 4528 CHF | **1299 CHF** | **Reifer Langzeitzyklus (6 Jahre)**: Drastische Horizont-Wirkung (30T: 2495 CHF, 1J: 2648 CHF, Lifetime: 3298 CHF!). Filtert bei Band ±40 % drei reale Händler-Dips. |
| `ssd990` | **Samsung 990 PRO 2 TB SSD**<br>([p702884](https://www.toppreise.ch/preisvergleich/Solid-State-Drives-SSD/SAMSUNG-990-PRO-NVMe-M-2-SSD-2-TB-MZ-V9P2T0BW-p702884?posf=1)) | 1499 Tage | 99.95 – 311.45 CHF | **89.95 CHF** | **Flash-Speicher-Zyklus**: Tiefstpreis 99 CHF mit anschließender Rallye auf > 310 CHF. Zeigt den extremen Unterschied zwischen Ø-Median (242 CHF) und Rekord (99 CHF). |
| `synthetic` | **Glitch-Demo** (Synthetisch) | 23 Punkte | 150 – 2500 CHF | **400 CHF** | **Isolierter Filter-Grenzfall**: Enthält 150 CHF Dip und 2500 CHF Spike. Beweist sofort, wie ein Fake-Dip ohne Filter den Tiefstpreis-Status blockiert. |

---

## Technische Architektur

### 1. Modul `toppreise/src/ui/calc-preview.js`

#### A. Verlustfreie RLE-Kompression der Verläufe
Tägliche Preishistorien verharren oft wochenlang auf identischen Niveaus. Ein flaches `[count, price, count, price, ...]`-Format schrumpft die Daten drastisch:
- `PRESET_DATA_S26`: 302 Zahlen (~1.2 KB)
- `PRESET_DATA_R5`: 714 Zahlen (~2.7 KB)
- `PRESET_DATA_SSD990`: 1864 Zahlen (~7.8 KB)
- `PRESET_DATA_SYNTHETIC`: 46 Zahlen (~0.2 KB)

Helper-Funktion zur Rekonstruktion:
```javascript
export function expandRleSeries(flat, now = Date.now()) {
  const prices = [];
  for (let i = 0; i < flat.length; i += 2) {
    const count = flat[i];
    const price = flat[i + 1];
    for (let c = 0; c < count; c++) prices.push(price);
  }
  const n = prices.length;
  // Chronologische Tagesstempel endend bei `now`
  return prices.map((price, idx) => [now - (n - 1 - idx) * 86400000, price]);
}
```

#### B. Preset-Definitionen
```javascript
export const PRESETS = {
  s26: {
    id: 's26',
    label: '📱 Galaxy S26 Ultra (230d)',
    cardPrice: 799,
    rle: PRESET_DATA_S26
  },
  r5: {
    id: 'r5',
    label: '📷 Canon EOS R5 (6J)',
    cardPrice: 1299,
    rle: PRESET_DATA_R5
  },
  ssd990: {
    id: 'ssd990',
    label: '💾 Samsung 990 PRO (4J)',
    cardPrice: 89.95,
    rle: PRESET_DATA_SSD990
  },
  synthetic: {
    id: 'synthetic',
    label: '🧪 Glitch-Demo (23 Pkt)',
    cardPrice: 400,
    rle: PRESET_DATA_SYNTHETIC
  }
};
```

#### C. Reine Rechen- & Koordinatenfunktionen
- `export function previewMarking(series, band, hours, enabled, now = Date.now())`:
  - Führt `sanitizeTimeSeries(series, band, hours)` aus (sofern `enabled !== false`).
  - Liefert `{ series, cleanPoints, droppedTs: Set(timestamps) }`.
- `export function previewCoords(marking, medianPrice, band, w = 296, h = 110, margin = { top: 8, right: 10, bottom: 16, left: 34 })`:
  - Projiziert die Zeitreihe sauber in die SVG-Viewbox (`296x110`).
  - Y-Achse nutzt Min- und Max-Preis der jeweiligen Serie (mit 5 % Padding).
  - Skaliert Polyline über die inneren Bounds, sodass Achsenticks links (`34px`) und Endpunkte rechts nie abgeschnitten werden.

#### D. SVG-Rendering für hochaufgelöste Verläufe
- **Glitch-Band**: `rect` von `bandTopY` bis `bandBottomY` in sanftem Blau (`rgba(59, 130, 246, 0.08)`).
- **Median-Linie**: Gestrichelt (`#64748b`) mit Label `Ø ${fmtPrice(median)}`.
- **Polyline**: Durchgezogene Linie (`#3b82f6`, `stroke-width="1.5"`).
- **Glitch-Markierungen**: Nur verworfene Punkte erhalten ein deutliches rotes `×` (`#dc2626`).
- **Anker-Kartenpreis**: Markanter Endpunkt mit Ring bei `[0, cardPrice]`.
- **Y-Skala**: 3 saubere Ticks links (Min, Median, Max).

#### E. DOM-Assembly & Live-Update
- `export function buildCalcPreview()`:
  - Header: `Live-Vorschau` links + `<select id="tp-preview-preset-select" class="tp-preview-select">` rechts.
  - SVG: `<svg id="tp-preview-svg" viewBox="0 0 296 110" preserveAspectRatio="none">`.
  - 3 Zeilen: `#tp-preview-legend`, `#tp-preview-blend`, `#tp-preview-status`.
- `export function refreshCalcPreview()`:
  - Ermittelt aktives Preset aus `#tp-preview-preset-select.value` (Fallback: `'s26'`).
  - Liest alle sechs Regler live aus dem DOM (Zero-Lag beim Draggen).
  - Berechnet `sanitizeTimeSeries`, Median im gewählten Horizont und Deal-Score zum `cardPrice` des Presets.
  - Schreibt SVG und aktualisiert alle Textzeilen synchron.

---

### 2. Bundler-Registrierung in `toppreise/tools/build.js`

In `toppreise/tools/build.js` wird `'ui/calc-preview.js'` in `MODULES` vor `'ui/toolbar.js'` platziert:
```javascript
  const MODULES = [
    // ...
    'ui/toast.js',
    'ui/calc-preview.js', // ◄── HIER REGISTRIEREN
    'ui/toolbar.js',
    // ...
  ];
```

---

### 3. Toolbar-Integration in `toppreise/src/ui/toolbar.js`

1. **Import**: `import { buildCalcPreview, refreshCalcPreview } from './calc-preview.js';`
2. **Mounting**: Vor dem `#tp-bar-calc-reset`-Button einhängen.
3. **Synchrones Event-Binding**:
   - `select.onchange = () => refreshCalcPreview();` am Preset-Selektor.
   - `refreshCalcPreview()` wird synchron in `oninput` und `onchange` aller 6 Regler aufgerufen.
   - `refreshCalcPreview()` wird im Reset-Handler und im bar-render-Sync aufgerufen.

---

### 4. Styles in `toppreise/src/ui/styles.js`

- `#tp-bar-calc-popover`: `max-height: min(70vh, 560px) !important; overflow-y: auto !important;` (verhindert Viewport-Überlauf).
- `.tp-preview-select`: Kompakter, unaufdringlicher Select im Header (`font-size: 11px`, native Optik mit dezentem Rand).
- `#tp-calc-preview`: Trennlinie oben, flexible vertikale Anordnung der Zeilen.

---

## Verifizierte Erwartungswerte der realen Presets

### 1. Samsung Galaxy S26 Ultra (p839149, Demo-Preis 799 CHF)
- **Standard (±60%, 48h, 50/50, 1J, 5 Pkt)**:
  - 0 Glitches gefiltert (230 Punkte aktiv)
  - Median: `935.18 CHF`, Tiefstpreis: `847 CHF`
  - Rabatte: `dMedian = 15 %`, `dRecord = 6 %` → **Badge −11 %**
  - Blend: `Ø −15% · Rek −6% → Badge −11% (50% Rek)`
  - Status: `Ø (1J) 935.18 · 230 Pkt im Fenster · 230/5 Pkt ✓`
- **Gewichtung 100 % Rek**: Badge springt sofort auf **−6 %**.
- **Gewichtung 0 % Rek (100% Ø)**: Badge springt sofort auf **−15 %**.

### 2. Canon EOS R5 (p616604, Demo-Preis 1299 CHF)
- **Standard (±60%, 48h, 50/50, 1J, 5 Pkt)**:
  - 0 Glitches gefiltert (2139 Punkte aktiv)
  - Median (1J): `2648.00 CHF`, Tiefstpreis: `1386.75 CHF`
  - Rabatte: `dMedian = 51 %`, `dRecord = 6 %` → **Badge −29 %**
  - Blend: `Ø −51% · Rek −6% → Badge −29% (50% Rek)`
  - Status: `Ø (1J) 2648 · 365 Pkt im Fenster · 2139/5 Pkt ✓`
- **Glitch-Band ±40 %**: Filtert **3 echte Ausreißer-Dips** (`1899 CHF`, `1799 CHF`, `1649.95 CHF`). Legende: `3 Glitches gefiltert (2136 Punkte aktiv)`.
- **Horizont Lifetime**: Median klettert auf `3298 CHF` → `dMedian = 61 %` → **Badge −34 %**.
- **Horizont 30 T**: Median sinkt auf `2495.50 CHF` → `dMedian = 48 %` → **Badge −27 %**.

### 3. Samsung 990 PRO 2 TB SSD (p702884, Demo-Preis 89.95 CHF)
- **Standard (±60%, 48h, 50/50, 1J, 5 Pkt)**:
  - 0 Glitches gefiltert (1499 Punkte aktiv)
  - Median (1J): `242.80 CHF`, Tiefstpreis: `99.95 CHF`
  - Rabatte: `dMedian = 63 %`, `dRecord = 10 %` → **Badge −37 %**
  - Blend: `Ø −63% · Rek −10% → Badge −37% (50% Rek)`
  - Status: `Ø (1J) 242.80 · 365 Pkt im Fenster · 1499/5 Pkt ✓`
- **Glitch-Band ±20 %**: Filtert **4 Ausreißer** (kurze Dips um 99–121 CHF). Legende: `4 Glitches gefiltert (1495 Punkte aktiv)`.
- **Horizont Lifetime**: Durch die frühe Niedrigpreisphase fällt der Median auf `155.63 CHF` → `dMedian` sinkt drastisch auf 42 % → **Badge −26 %**.
- **Horizont 30 T**: In der aktuellen Hochpreisphase liegt der Median bei `299.00 CHF` → `dMedian` steigt auf 70 % → **Badge −40 %**.

---

## Test & QA-Plan

### 1. Unit-Tests: `toppreise/tests/unit/calc-preview.test.js`
- **RLE-Dekodierung**: Prüft verlustfreie Expansion für alle Presets (exakte Längen 230, 2139, 1499).
- **Preset-Kennzahlen**:
  - `s26`: Verifiziert Median 935.18, Tiefstpreis 847, Badge 11 %.
  - `r5`: Verifiziert Horizont-Sprung 2648 (1J) vs 3298 (Lifetime) sowie 3 gefilterte Glitches bei Band 0.40.
  - `ssd990`: Verifiziert Horizont-Sprung 242.80 (1J) vs 155.63 (Lifetime).
- **Preset-Wechsel**: Prüft, dass die Wechsel-Funktion die korrekten Serien und Kartenpreise zurückgibt.
- **SVG-Koordinaten**: Prüft, dass X/Y-Projektionen für 2000+ Punkte fehlerfrei und innerhalb der Bounds berechnet werden.

### 2. Playwright-Integration: `toppreise/tests/test_catalog_layout.py`
Neuer Test `test_calc_preview_live_in_calc_popover(page: Page)`:
1. Öffnet Popover, verifiziert `#tp-calc-preview` und `#tp-preview-preset-select`.
2. Default-Prüfung (`s26`): Blend enthält `11%`, Status enthält `230/5 Pkt ✓`.
3. Preset-Wechsel auf `r5`:
   - Blend wechselt sofort auf `29%`, Status auf `2648`.
   - Band-Slider auf `40 %` schieben → Legende meldet sofort `3 Glitches gefiltert`.
4. Preset-Wechsel auf `ssd990`:
   - Blend wechselt auf `37%`.
   - Horizont auf `Lifetime` schieben → Median wechselt auf `155.63`.
5. Klick auf `#tp-bar-calc-reset`:
   - Stellt alle 6 Regler sowie das Preset auf Standard zurück.

---

## Verifikations-Befehle

```bash
# 1. Bundler- & Drift-Gate
node toppreise/tools/build.js
node toppreise/tools/build.js --check

# 2. Unit-Tests ausführen
node --test toppreise/tests/unit/calc-preview.test.js
node --test toppreise/tests/unit/*.test.js

# 3. Playwright-Browser-Tests
PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest "toppreise/tests/test_catalog_layout.py::test_calc_preview_live_in_calc_popover" "toppreise/tests/test_catalog_layout.py::test_calc_popover_open_close_and_reset" -o addopts="--import-mode=importlib" -q

# 4. Manueller Browser-Check
# Im ⚖️-Popover das Dropdown öffnen, zwischen S26, R5 und 990 PRO umschalten:
# - Die Kurve wechselt sofort zwischen Smartphone-, Kamera- und SSD-Verlauf.
# - Reglerbewegungen (Band, Horizont, Gewichtung) spiegeln sich live in den realen Daten.
```
