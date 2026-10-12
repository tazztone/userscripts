# Toppreise: 💎 sort-only in place + Filtern entfernt, Ansicht malt

## Context

Grill R1–R4 settled (2026-10-12). Kernpunkt: **Filtern entfernt** (`display:none`), **Ansicht malt** (Dimmen, Heatmap, Streifen, Glow — entfernt nie). Die alte `Anzeige` (Highlight/Dimmen/Verbergen als Filter-Outcome) ist gelöscht — sie war genau die vermischte Achse. End state: 💎 stays in `tp-group-deals` (relabeled `Sortieren`, feed-only, tooltip sort-only); labels `Filter`→`Filtergründe`, `Ansicht` stays (now honest); removal causes Negativ/Min-Angebote/Händler/Ungeprüfte/Fallback-ausgeschlossen apply on feed and search; verified markups (Schlechte Deals) never removed — badge + sort-last; `MODE` key deleted, `DIM_OPACITY` survives as Ansicht status-dimmer. Amends ADR-0006; GLOSSARY split (`Filtern`/`Filtergrund`/`Gefilterte` vs `Ansicht`).

## Approach

### Step 1 — Logic: Entfernen vs Malen trennen (`src/page/cards.js`, `src/ui/badges.js`, `src/ui/styles.js`, `src/state/config.js`)

- `applyCardFilters` (`cards.js:260-275`): delete `MODE_ACTIVE &&` AND the `isBadDeal` cause entirely — verified markups are never removed (badge marks, sort-last). Removal = `isNeg || isLowOffers || isDealerLoser || isUnchecked || vortiefExcluded` only.
- `badges.js`: cause classes on cause alone (`tp-unchecked-hidden` ~:433/:591, `tp-filtered` :223); delete `tp-baddeal-hidden` add/remove (~:374-382) — no markup hiding anywhere; keep `MODE_ACTIVE` branches that only choose badge text/heat richness.
- Deletion: `config.js` `MODE` key + `tp-mode-*` body classes + modal radio sync (`:243-244,254-258,493-494`) deleted; `DIM_OPACITY` kept as Ansicht slider (status-dim for Ungeprüfte/Fallback paint layer); `cards.js:310-312,328-330,349-351` `displayHidden` becomes plain removal predicate (no `MODE` read); `styles.js:93-96` hide rule becomes the removal rule on cause classes, dim/highlight outcome rules (`:97-112`) replaced by status-dim paint (never gates removal); `badges.js:891-898,933-946` empty-gate stays (real removal can empty the page) minus Anzeige-switch row; `tp-reveal-all` stays as transient peek for removed cards (no key).
- `sort.js:72-98` untouched (blend → Vortief → 0 → −100, then `dMed`, `initialOrder`); blend-vs-Vortief mixed unit accepted (ADR-0005).
- Language sweep: `(Ursache, folgt der Anzeige)` → `(Filtergrund entfernt)` in `toolbar.js:285,340` + `badges.js:914`; tooltips list 5 Gründe (Negativ/Min/Händler/Ungeprüfte/Fallback); `Anzeige` word removed from UI strings (→ `Filtern` or `Ansicht`).

### Step 2 — Scanner: Unchecked-D deadlock (`src/scanner/scanner.js:187-188`)

- Skip ignores unchecked cause only (`includeHiddenUnchecked:false` or cause mask); Negativ/Min-Angebote/Händler skips stay (perf). Verified-cause skips harmless (cache-hit path first).

### Step 3 — Toolbar: labels only, evacuation out (`src/ui/toolbar.js`)

- No new region, no DOM moves. Rename only: `tp-group-deals` aria `Tiefstpreise`→`Sortieren`, `tp-group-filter` →`Filtergründe`, `tp-group-view` keeps `Ansicht`; 💎 tooltip `filtern und sortieren`→`sortieren` (`:69,304`).
- Sliders ⚖️/Ø/Pkt stay FEED-bar (builders reused); hidden on SEARCH (modal-only there). Fallback-Tiefs toggle stays in deals group.
- Delete `ensureDealControlsPlacement` evacuation (`:47-81`); pre-build horizon wrapper at bar creation.
- 👁️ `Gefilterte (N)` stays as removal counter + transient peek-toggle (`:397-401` per-cause counts); no mode switch anywhere.
- Per-page: FEED all groups; SEARCH filter+ansicht; DETAIL no bar (`app.js:74-75,87`). Keep empty-group/divider collapse (`:472-488`).

### Step 4 — Modal: full 4-region remap, Ansicht ohne Entfernen (`src/ui/modal.js:22-299`)

- Keep section ids (`openSettingsAt` unbroken) + Preisalarm/Discord byte-identical:
  - `tp-section-display` (`🖥️ Ansicht`): Heatmap + Deckkraft (status-dim) + Intensität; Anzeige radios deleted; gives away Sortierung → sort, Versand + Sparklines → calc.
  - `tp-section-deals` → `💎 Sortieren`: 💎 toggle (copy sort-only: `modal.js:101,119` → `sortiert`) + Sortierung segmented; gives away Nur geprüfte + Fallback + Toleranz → filter, ⚖️/Ø/Pkt + Prüf-Vorauswahl → calc.
  - NEW `tp-section-filter` (`🧹 Filtern`): Nur geprüfte (entfernt), Fallback-Tiefs (Ausschluss entfernt), Preis-Toleranz (`MARGIN_PERCENT`) + hint Negativ/Min-Angebote in bar.
  - NEW `tp-section-calc` (`📐 Daten`): ⚖️ + Ø + Pkt (same save), Versand, Sparklines, Prüf-Vorauswahl, Händler-autoload.
  - `tp-section-data` → `💾 Cache & Wartung`: TTLs + actions + export/import; loses dealer-autoload.
- Same `updateConfig`/`syncUiControl` paths (move nodes only); mode sub-group show/hide (`:126,134,142,516-528,417-429`) toggles sort extras only.
- D3-rest dedup: Vortief canonical modal (bar mini `:112-122` removed); Heatmap canonical bar (`:300`, modal `:684` removed, intensity modal); Schwelle canonical modal (`:706`, CTA-popover display-only); `HIDE_UNCHECKED` canonical bar (modal `:701` link-only).

### Step 5 — Migration (`src/state/config.js`)

- `MODE` key deleted (former ADR-0001 no-rename yields to split — deletion is the clean cut); one-time toast for `hide`/`highlight`/`dim` users (`Filter entfernt jetzt, Ansicht dimmt nur`, `migrateLegacyDebug` pattern `:127-137`). `BESTPREISE_MODE_ACTIVE=true` → `💎 sortiert jetzt nur noch` toast + marker.

### Step 6 — Leftovers

- D5 empty-state: real removal can empty → box keeps [👁️ peek] + [Filter ausschalten] (+ conditional Tiefstpreise prüfen/ausschalten); CTA `tp-empty`-dimmen stays (`floating-cta.js:225-227`).
- D7 shop-losers stay removed + explained: 5th row `Händler` + `MARGIN_PERCENT` → `Preis-Toleranz im Shop-Vergleich` + README line.
- D8 preview = 👁️ peek per Filtergrund (cause classes exist `badges.js:194-195,207,379,433,591`): row click undims/reveals that cause transiently; `[alle]` = existing peek mechanic.

### Step 7 — Tests + Build

- Unit (`node --test toppreise/tests/unit/*.test.js`): `cards.test.js` — verified markup NEVER removed (mode on/off); at-low without blend removed iff `INCLUDE_VORTIEF=false`; no-stats removed iff `HIDE_UNCHECKED`; Neg/Min/Händler removal rows; export `applyCardFilters` if needed.
- E2E (`PLAYWRIGHT_BROWSERS_PATH=.../.playwright-browsers venv/bin/pytest -o addopts="--import-mode=importlib"`): feed relabeled groups, sliders 💎-independent; 💎 ON sorts deal-first, markups visible last with badge (zero `display:none` on markups); Neg/Min/Unchecked/Fallback removal rows gone with counter; 👁️ peek reveals transiently; modal 4 regions, no Anzeige radios.
- Rebuild + drift: `node toppreise/tools/build.js` then `--check`.

## Critical files & anchors

- `toppreise/src/ui/toolbar.js:270-312` bar markup; `:47-81` evacuation (delete); `:284,397-401` 👁️ counter+tooltip.
- `toppreise/src/page/cards.js:260-275` causes (`isBadDeal` delete); `:304-351` removal predicate; `:278` `dealerLoserFor`.
- `toppreise/src/scanner/scanner.js:187-188` scan-skip deadlock.
- `toppreise/src/ui/modal.js:22-299` sections; `:101,119` 💎 copy; MODE radios (delete); `:684,701,706` dedup.
- `toppreise/src/ui/badges.js:194-223` cause classes; `:374-382` baddeal-hide (delete); `:881-949` empty-state; `src/ui/styles.js:93-122` removal + status-dim paint; `src/state/config.js:52,184,243-264,493-494` MODE deletion.
- `toppreise/src/ui/floating-cta.js:33,157-168,225-227` threshold popover + empty contract (zero MODE branches).

## Verification

- Unit green (markup never removed, 5 removal causes, unchecked/fallback gating).
- E2E: markups always mounted last under 💎 ON; removals `display:none` with counter; peek transient; modal 4 regions, Ansicht paints only.
- `node toppreise/tools/build.js --check` passes.

## Assumptions & contingencies

- Schlechte Deals never removed (badge + sort-last); if feed gets noisy, do NOT re-add removal — add explicit filter toggle in a follow-up.
- Status-dim paint target (ungeprüfte/fallback de-emphasis) decided at implementation in `badges.js`/`styles.js`; never gates removal.
- If AJAX wipes race re-creation, re-attach builders in render, never move off-bar.
- Grep gate: one UI home per `BESTPREISE_HIDE_UNCHECKED|BESTPREISE_INCLUDE_VORTIEF|BESTPREISE_WEIGHT_RECORD|BESTPREISE_MIN_POINTS|BESTPREISE_MEDIAN_HORIZON_DAYS|HEATMAP_ENABLED|REAL_DEAL_MIN_DISCOUNT`, no `ensureDealControlsPlacement` rest; `tp-mode-|highlight-only|MODE` (Anzeige-key) → zero src hits; `Anzeige` in UI strings → zero (→ `Filtern`/`Ansicht`).
