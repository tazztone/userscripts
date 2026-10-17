![Toppreise.ch Suite banner](banner.jpg)

# Toppreise.ch Suite: Power Filter & Price Alarm Auto-Filler

**English Version** · **[🇩🇪 Deutsche Version](README.de.md)**

An all-in-one userscript suite (`v2.18.314`) for **Toppreise.ch** that verifies authentic all-time low prices (*Tiefstpreise*) against complete historical price series, exposes deceptive markups (*Aufschläge*), applies a continuous discount heatmap, provides multi-mode negative/offer/dealer filtering, and automates price alarms and Discord deal sharing. Category blocking is left to Toppreise's native server-side exclusions (`Plugin_IgnoredCategories`: per-card menu, sidebar, top bar).

![Toolbar: alle Filter, Heatmap, Batch-CTA](docs/shots/01-toolbar.webp)
![Feed-Karten: Heat-Deal, Aufschlag-Morph, Fallback-Tief, Share-Hover](docs/shots/02-feed-cards.webp)
![Such-Karten: Inline-Pill, Pruefen-Pill, guenstigste Variante](docs/shots/03-search-cards.webp)
![Einstellungen: alle Bereiche auf einer Seite](docs/shots/04-settings-modal.webp)

---

## 🚀 Quick Install

Requires a userscript manager browser extension:
- [Violentmonkey](https://violentmonkey.github.io/) (recommended: [Firefox](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/) · [Chrome / Brave](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag))
- [Tampermonkey](https://www.tampermonkey.net/)

### 👉 [**CLICK HERE TO INSTALL USERSCRIPT (v2.18.315)**](https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js)

> [!NOTE]
> The userscript includes embedded `@updateURL` and `@downloadURL` metadata headers. Your userscript manager will automatically check GitHub in the background and keep your installation up to date.

---

## ✨ Key Features

### 🔍 Real Deal Verification & Weighted Deal Score (*Gewichtete Differenz*)

* **On-Demand & Batch Verification:** Click any product's Differenz badge (`🔍`) or use the floating **Batch-Check CTA** (bottom-left) to fetch full historical price series for all visible deals meeting your discount threshold (`≥20%–60%`), with a live progress counter and cancel button.
* **Weighted Deal Score (`⚖️`):** Verified all-time lows are scored using a customizable blend between **discount vs. rolling median (`Ø-Preis`)** and **breakthrough margin vs. the previous all-time low (`Rekord`)**. This produces a single metric that drives the badge percentage, card heat color, and feed ranking.
* **Rolling Median Time Horizon (30–730 Days + Lifetime):** Prevents distorted baseline prices on aging tech (e.g. 2-year-old GPUs or TVs with obsolete launch MSRPs). Adjusting the horizon immediately recomputes all cached mediane locally without network requests.
* **Glitch & Outlier Rejection:** Multi-pass filter automatically sanitizes short-lived mislistings (e.g. a CHF 15 smartphone case mistakenly indexed under a CHF 1'200 flagship) using a rolling ±15-point local median window (configurable band `±1%–50%`, max glitch duration `24h–168h`), with an interactive live SVG preview inside the toolbar's `⚖️` popover.
* **Deceptive Discount Detection:** Products priced above their historical low are flagged with an `Aufschlag (+XX%)` badge and a strikethrough of the unverified site discount (`~~-YY%~~`), showing the true historical low below the price.
* **Detailed Deal Subline & Cheapest Dealer (`🏬`):** Cards display the exact price breakdown (`📉 CHF 2'399.00 (-X%) · Ø (1J) CHF 2'450.00 (-Y%)`) along with the cheapest dealer name and direct offer link, with optional background auto-fetching (`max. 3 parallel`).
* **Shipping-Basis Aware (`inkl. Versand`):** Separately caches and evaluates product-only (`_p`) and shipping-inclusive (`_s`) price histories so comparisons never mix price bases.

### 🔥 Visual Signals, Sparklines & Card Enhancements

* **Single-Hue Deal Heatmap (Grau→Rot):** Verified deals glow with a customizable inset color ramp proportional to deal depth (neutral gray for small or zero discounts → warm amber → deep ruby for major discounts). Unverified cards show a striped-gray badge with provisional card warmth.
* **Fallback Lows (*Fallback-Tiefs*):** Verified lows lacking a qualified median (insufficient data points `< minPoints`, HTML scrape without time series, or flat history `< 2%`). Display the Vortief-Abstand instead of a blend (no `⚖️`) and can be filtered independently (Normal/Dim/Hide). Qualified deals with 0% savings display a neutral-gray 0% badge.
* **Newly Verified Glow (*Neu*-Puls):** Freshly verified deals pulse with an emerald outline and `Neu` indicator for ≥5s until the next user interaction (click, scroll, keypress).
* **Interactive SVG Sparklines:** Renders a compact mini price-trend chart on verified product cards. Clicking the sparkline opens a full-resolution modal chart with price and date axes.
* **1-Click Google Review Search (`🌐`):** Appends a quick-search icon to product titles that opens a Google search for `<Product> Testbericht` (or custom keyword) in a new tab, with optional **Google AI Mode (`&udm=50`)**.

### 🧹 Sticky Filter Bar & Grid Sorting

* **Context-Aware Toolbar:** Automatically adapts to deal feeds (`/neue-toppreise`), search listings (`/produktsuche/...`), and detail pages without UI clutter.
* **4-State Per-Cause Filtering:** Every filter rule can be independently cycled between **Normal**, **Dimmen** (adjustable opacity), **Verbergen** (hide), and **Hervorheben** (highlight outline):
  * **Negative Keywords:** Exclude unwanted terms (comma/semicolon/newline lists; long terms `>3` chars match as substrings, short terms `≤3` chars enforce word boundaries).
  * **Minimum Offer Count:** Filter out marketplace listings with fewer than $N$ merchants.
  * **Unverified (*Ungeprüfte*):** Dim or hide unverified offers on deal feeds.
  * **Fallback Lows (*Fallback-Tiefs*):** Control visibility of low-history verified offers.
  * **Selected Dealer Best-Price Check:** Highlights cards with an emerald border and `Toppreis` badge when your active dealer filter holds the cheapest offer (within a configurable `0%–50%` price tolerance margin).
* **Live Grid Sorting:** Sort listings in-place by **Weighted Deal Score (`Tiefstpreis-Sortierung`)**, **% Discount (`% Rabatt ⬇`)**, or **Offer Count (`Meiste ⬇` / `Wenigste ⬆`)**, with clean restoration to natural DOM order when disabled.
* **Empty State Recovery:** If all products are hidden by active filters, an interactive prompt provides instant one-click recovery buttons (`[ ⚡ Filter ausschalten ]`, `[ 🔍 Tiefstpreise prüfen ]`).

### 🔔 Price Alarm Auto-Filler

* **Instant Prefill:** Clicking Toppreise's price alarm bell automatically populates target price (`5%–99%`, default `60%`) and duration (`3`, `6`, `12`, or `24` months), with full support for Swiss currency formats (`CHF 1'299.–`).
* **Modes:** Supports **Fill-only** (default: inspect and submit manually) and **Auto-Submit** (ticks terms and submits on click, closing the dialog only after server confirmation).

### 💬 1-Click Discord Deal Sharing (`📤`)

* **One-Click Webhook Sharing:** Verified all-time low cards display a `📤` button on hover that posts the deal directly to your Discord channel or Forum thread via webhook. Shared cards retain an illuminated share icon.
* **High-DPI Chart & Product Image Upload:** Rasterizes the price history chart to PNG and attaches it alongside the product image (used as thread preview in Discord forum channels).
* **Customizable Template Engine (*Baukasten*):** Tailor your Discord message layout with tokens (`{title}`, `{price}`, `{dealer}`, `{offers}`, `{prevlow}`, `{median}`, `{link}`), layout presets (*Kompakt*, *Ausführlich*, *Minimal*), live Markdown preview, and independent link embed suppression toggles.

---

## 🧭 Quick-Reference Usage Guide

| Control / Icon | Location | Action |
| --- | --- | --- |
| **Sticky Filter Bar** | Top of product listings | Filter by negative keywords, minimum offers, and per-cause modes; toggle Heatmap and Tiefstpreis-Sortierung; open the `⚖️` calculation popover. |
| **Floating Check CTA** | Bottom-left floating pill | One-click batch verification of all visible deals meeting the discount threshold (`≥X%`), with an inline `🏬` dealer auto-fetch toggle. |
| **Differenz Badge (`🔍` / `⚖️`)** | Top-right of product card | Click to verify or refresh a single product's price history and all-time low status. |
| **Cheapest Dealer (`🏬`)** | Next to price on verified card | Click to jump directly to the merchant offer in a new tab; hover to load dealer on feed cards. |
| **Mini Sparkline** | Bottom of verified card | Click to open the large interactive price history chart modal. |
| **Share Button (`📤`)** | Bottom-left of verified card | Posts the deal, ASCII sparkline, and rendered PNG chart to your Discord webhook. |
| **Review Search (`🌐`)** | Next to product title | Opens a Google review search in a new tab with optional AI overview (`&udm=50`). |
| **Settings FAB (`⚙️`)** | Bottom-right floating button | Opens the encapsulated Shadow DOM settings modal. |

### ⌨️ Keyboard Shortcuts

| Shortcut | Context | Action |
| --- | --- | --- |
| `/` | Anywhere on listing page | Instantly focuses and selects text in the Negative Keyword filter input (ignored during active text input). |
| `Escape` | Modal or active filter | Closes the Settings modal or removes focus from the filter input. |

---

## 📑 Page Contexts & Variant Protection

The userscript dynamically tailors its UI to the current page type:

* **Deal Feeds (`/neue-toppreise`):** Displays the full suite: consolidated filter button (`🧹 Filter (N)`), continuous heatmap toggle, `💎 Tiefstpreis-Sortierung`, floating batch scanner, and calculation popover (`⚖️`).
* **Catalog & Search Listings (`/produktsuche/...`):** Streamlined toolbar with complete protection for grouped product families (`.Plugin_ProductCollItem`). Grouped variants (such as AirPods with or without wireless charging case) remain locked in their native collection containers, preserving Bootstrap grid integrity without splitting cards. Inline deal pills (`.tp-deal-pill`) sit neatly above prices.
* **Product Detail Pages (`/preisvergleich/...-p...`):** Hides the top filter bar and embeds a dedicated Tiefstpreis badge next to the main product title and price.

---

## ⚙️ Configuration & Modal Settings

Click the floating **gear icon (`⚙️`)** in the bottom-right corner to open the Shadow DOM settings dialog (`#tp-root`). Elevated via native HTML5 `<dialog>` (`showModal()`) to the browser Top Layer, it avoids z-index collisions with host site elements:

1. **🖥️ Display (*Anzeige*):** Filter representation mode (`Hervorheben`, `Dimmen`, `Verbergen`), price tolerance margin (%), dimmer opacity slider, shipping-basis toggle, and default secondary sort order (`Meiste ⬇`, `Wenigste ⬆`, `% Rabatt ⬇`).
2. **💎 Deals & Tiefstpreise:** Heatmap toggle and intensity slider (20%–100%), weighted deal blend slider (median vs. record low), minimum history data points threshold (1–100), analysis horizon slider (30–730 days or Lifetime), and batch scan discount threshold.
3. **🔔 Price Alarm:** Target price percentage (default 60%), alarm duration (3 to 24 months), and Auto-Submit toggle.
4. **💬 Discord Share:** Webhook URL, layout template builder, Markdown live preview, preset selector, and merchant/product link embed suppression switches.
5. **💾 Data & Cache:** Mini sparkline display toggle, dealer autoload toggle, price cache TTL (24h to 14 days), negative cache TTL (1h to 24h), live entry counters, one-click cache purge (`🗑️ Cache leeren`), full data reset (`🧨 Alle Daten löschen`), and JSON configuration import/export.

---

## 🔒 Privacy, Storage & Permissions

* **Local-First Caching:** Price series (`tp_hist_v1_*`), merchant metadata (`tp_dealer_v1_*`), and shared-deal markers (`tp_shared_v1_*`) are stored in `localStorage` backed by an in-memory 500-item LRU cache and automatically pruned by TTL (48h for valid data, 2h for unavailable charts).
* **Two-Layer Persistence:** Preferences and negative filters use a resilient 2-layer storage architecture (`GM_setValue` / `GM_getValue` with domain `localStorage` auto-healing backup) that survives userscript reinstalls.
* **Webhook Confidentiality:** Your `DISCORD_WEBHOOK_URL` is saved exclusively in private userscript manager storage (`GM_setValue`). It is **never** mirrored to page-accessible `localStorage` and is automatically stripped from JSON configuration exports.
* **Granted Permissions:**
  * `GM_getValue` / `GM_setValue` / `GM_deleteValue`: Isolated persistent configuration storage.
  * `GM_xmlhttpRequest` (`@connect toppreise.ch`, `@connect discord.com`): Strictly used to fetch same-origin product images for Discord attachments and dispatch deal payloads to your configured Discord webhook.

---

## 🛠️ Architecture & Development

The source code is modularized into 45 ESM modules under `src/` (each `<25 KB`), bundled in strict load-bearing order by `tools/build.js`:

```text
src/
├── domain/       # Pure price parsing, outlier sanitization, median & deal scoring math
├── scanner/      # Bounded LRU/localStorage cache & rate-limit-aware batch scanner
├── page/         # DOM selectors, page adapter, card/offer extraction & flex grid sorting
├── state/        # Config schema, migrations, GM/localStorage sync & runtime scan store
├── ui/           # Styles, Shadow DOM shell, settings modal, toolbar, badges & SVG sparklines
├── features/     # Discord webhook/recipe engine, price alarm auto-filler & detail page logic
└── app.js        # Pipeline entry point, mutation observers, lifecycle orchestration
```

### Build Pipeline & Quality Gates

```bash
# Compile modular sources from src/ into toppreise.user.js
node toppreise/tools/build.js

# Verify bundle integrity and detect drift (CI gate)
node toppreise/tools/build.js --check

# Check module size boundaries (25 KB advisory)
node toppreise/tools/check-modules.js

# Verify JavaScript syntax of the generated bundle
node --check toppreise/toppreise.user.js
```

### 🧪 Test Execution

```bash
# Fast unit tests (~40ms, zero-browser overhead)
node --test toppreise/tests/unit/*.test.js

# Targeted domain logic tests via pytest
venv/bin/pytest toppreise/tests/test_price_logic.py

# Playwright browser regression test suite (~40s)
venv/bin/pytest toppreise/tests/test_catalog_layout.py
```
