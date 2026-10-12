# Toppreise: 💎 sort-only in place + dim-only Anzeige + globales Filtern

## Context

Grill R1–R3 settled (2026-10-12). Toolbar packs ~9 controls into legacy groups (`Filter / Ansicht / Tiefstpreise`) while 💎 mixes filtering with sorting (`isBadDeal = MODE_ACTIVE && …`, `src/page/cards.js:271`), so search never filters verified markups; `Ansicht` mislabels `Anzeige`; `Tiefstpreise` group reads as filter though 💎 is the only sort. End state: 💎 stays in `tp-group-deals` (relabeled `Sortieren`, feed-only, tooltip sort-only — no new SORTING region); labels `Filter`→`Filtergründe`, `Ansicht`→`Anzeige`; Anzeige is dim-only (`MODE` freezes to `dim`, highlight/hide + `tp-reveal-all` deleted); sliders ⚖️/Ø/Pkt stay FEED-bar; filter causes apply on feed and search, always dimmed. No key renamed; `MODE` stays `dim` (writes ignored), `BESTPREISE_MODE_ACTIVE` stays `false`. Amends ADR-0006; GLOSSARY `Anzeige` shrunk, `Filtergrund` added.

## Approach

### Step 1 — Logic: globale Filtergründe, 💎 sort-only, dim-only (`src/page/cards.js`, `src/ui/badges.js`, `src/ui/styles.js`, `src/state/config.js`)

- `applyCardFilters` (`cards.js:260-275`): delete `MODE_ACTIVE &&` from `isBadDeal` → `stats && !dealScore && (vortiefExcluded || kind not at-low/new-low)`; other causes byte-identical.
- `badges.js`: cause classes (`tp-baddeal-hidden` ~:374-382, `tp-unchecked-hidden` ~:433/:591, `tp-filtered` :223) on cause alone, never `MODE_ACTIVE`; keep `MODE_ACTIVE` branches that only choose badge text/heat richness.
- Dim-only deletion (scout inventory): `config.js:243-244,254-258,493-494` freeze to `tp-mode-dim` (drop `MODE` sync arm, keep `DIM_OPACITY`); `cards.js:310-312,328-330,349-351` `displayHidden` → always false, delete call sites; `styles.js:93-96` hide + `:108-112` highlight rules deleted, dim `:97-103` + hover kept; `badges.js:891-892,896,898,933-934,942-946` reveal/empty-hide gate deleted (empty page via filters impossible); modal 3-radio Anzeige picker deleted, opacity slider kept.
- `sort.js:72-98` keys/tiebreaks untouched (blend → Vortief → 0 → −100, then `dMed`, `initialOrder`); blend-vs-Vortief mixed unit accepted (ADR-0005).
- Language sweep (D6a): `(Ursache, folgt der Anzeige)` → `(Filtergrund, folgt der Anzeige)` in `toolbar.js:285,340` + `badges.js:914`; tooltips list all 6 Gründe.

### Step 2 — Scanner: Unchecked-D deadlock (`src/scanner/scanner.js:187-188`)

- Skip ignores unchecked cause only (`includeHiddenUnchecked:false` or cause mask); Negativ/Min-Angebote/Händler skips stay (perf). Verified-cause skips harmless (cache-hit path first).

### Step 3 — Toolbar: labels only, evacuation out (`src/ui/toolbar.js`)

- No new region, no DOM moves. Rename only: `tp-group-deals` aria `Tiefstpreise`→`Sortieren`, `tp-group-filter` →`Filtergründe`, `tp-group-view` →`Anzeige`; 💎 tooltip `filtern und sortieren`→`sortieren` (`:69,304`).
- Sliders ⚖️/Ø/Pkt stay FEED-bar (builders reused); hidden on SEARCH (modal-only there). Fallback-Tiefs toggle stays in deals group (no move).
- Delete `ensureDealControlsPlacement` evacuation (`:47-81`); pre-build horizon wrapper at bar creation like weight/vortief/minpoints.
- 👁️ becomes counter-only: keep `Gefilterte (N)` + per-cause tooltip counts (`:397-401`), delete toggle + `tp-reveal-all` override. No Anzeige chips (single-dim needs no switch).
- Per-page: FEED all groups; SEARCH filter+anzeige(heatmap); DETAIL no bar (`app.js:74-75,87`). Keep empty-group/divider collapse (`:472-488`).

### Step 4 — Modal: full 4-region remap, no Anzeige switch (`src/ui/modal.js:22-299`)

- Keep section ids (`openSettingsAt` unbroken) + Preisalarm/Discord byte-identical. Full move (user call Q7):
  - `tp-section-display` (`🖥️ Anzeige`): keeps Heatmap + Deckkraft + Intensität; Anzeige radios deleted (dim-only); gives away Sortierung → sort section, Versand + Sparklines → calc section.
  - `tp-section-deals` → `💎 Sortieren`: keeps 💎 toggle (copy fixed to sort-only: `modal.js:101,119` `versteckt/ausblenden` → `sortiert`) + Sortierung segmented (moved in); gives away Nur geprüfte + Fallback + Toleranz → filter, ⚖️/Ø/Pkt + Prüf-Vorauswahl → calc.
  - NEW `tp-section-filter` (`🧹 Filtern`): Nur geprüfte, Fallback-Tiefs, Preis-Toleranz (`MARGIN_PERCENT`) + hint Negativ/Min-Angebote live in bar.
  - NEW `tp-section-calc` (`📐 Daten`): ⚖️ + Ø + Pkt (same save incl. `clampMinPoints`, horizon normalize, `recomputeCachedMedians`), Versand, Sparklines, Prüf-Vorauswahl, Händler-autoload (from Daten & Cache).
  - `tp-section-data` → `💾 Cache & Wartung`: keeps TTLs + actions + export/import; loses dealer-autoload.
- All `updateConfig`/`syncUiControl` key paths identical (move nodes, never rewrite save mapping); mode toggle sub-group show/hide (`:126,134,142,516-528,417-429`) toggles only sort extras.
- D3-rest dedup: Vortief canonical modal (bar mini-switch `:112-122` removed); Heatmap canonical bar (`:300`, modal `:684` removed, intensity stays modal); Schwelle (`REAL_DEAL_MIN_DISCOUNT`) canonical modal (`:706`, CTA-popover `THRESHOLD_OPTIONS` `floating-cta.js:33,157-168` display-only); `HIDE_UNCHECKED` canonical bar (modal `:701` link-only).

### Step 5 — Migration freeze (`src/state/config.js`)

- No key renamed (ADR-0001). `MODE` freezes to `dim` (writes ignored, body always `tp-mode-dim`); one-time toast for `hide`/`highlight` users → dim, `migrateLegacyDebug` pattern (`:127-137`). `BESTPREISE_MODE_ACTIVE=true` users get `💎 sortiert jetzt nur noch — Gefilterte dimmen immer` toast + marker.

### Step 6 — Dimmen leftovers in scope

- D5 empty-state: hide-gate gone, box shrinks to filter-off only (+ conditional Tiefstpreise prüfen/ausschalten); CTA `tp-empty`-dimmen stays (`floating-cta.js:225-227`).
- D7 shop-losers stay + explained: `.tp-filtered` via `dealerLoserFor` (`cards.js:278`) dims under native shop pills; 5th panel row `Händler` + sharpened `MARGIN_PERCENT` label (`Preis-Toleranz im Shop-Vergleich`) + README line.
- D8 preview simplified: `👁️` counter rows per Filtergrund (counts exist `:401`) + transient undim-that-cause (`opacity:1` override on cause class, no `tp-preview-*` outline, no `[alle]` — nothing hidden).

### Step 7 — Tests + Build

- Unit (`node --test toppreise/tests/unit/*.test.js`): `cards.test.js` rows — verified markup bad-deal with mode OFF; at-low without blend fallback, excluded iff `INCLUDE_VORTIEF=false`; no-stats unchecked-cause iff `HIDE_UNCHECKED`; `displayHidden` always false; export `applyCardFilters` if needed (pure, no caller change).
- E2E (`PLAYWRIGHT_BROWSERS_PATH=.../.playwright-browsers venv/bin/pytest -o addopts="--import-mode=importlib"`): `test_catalog_layout.py` style — feed shows relabeled groups + sliders independent of 💎; search filter+view only; 💎 ON sorts deal-first, zero `display:none`; verified markup dims; 👁️ is counter-only (no toggle); modal has 4 regions, no Anzeige radios.
- Rebuild + drift: `node toppreise/tools/build.js` then `--check` (version bump at commit, not planned).

## Critical files & anchors

- `toppreise/src/ui/toolbar.js:270-312` bar markup; `:47-81` evacuation; `:112-122` vortief mini-switch; `:284,397-401` reveal counter+tooltip.
- `toppreise/src/page/cards.js:260-275` causes; `:304-351` `displayHidden` (delete); `:278` `dealerLoserFor`.
- `toppreise/src/scanner/scanner.js:187-188` scan-skip deadlock.
- `toppreise/src/ui/modal.js:22-299` sections; `:101,119` 💎 copy; `:659-660` MODE radios (delete); `:684,701,706` dedup.
- `toppreise/src/ui/badges.js:194-223` cause classes; `:881-949` empty-state; `src/ui/styles.js:93-122` Anzeige rules; `src/state/config.js:52,184,243-264,493-494` MODE paths.
- `toppreise/src/ui/floating-cta.js:33,157-168,225-227` threshold popover + empty contract (zero MODE branches — untouched).

## Verification

- Unit green incl. new rows (bad-deal global, fallback exclusion, unchecked gating, never-hidden).
- E2E: feed relabeled groups, 💎 ON deal-first zero removals; search verified-markup dims; modal 4 regions, radios gone, `syncUiControl` mirror for opacity only.
- `node toppreise/tools/build.js --check` passes.

## Assumptions & contingencies

- Single Anzeige dim (Q6): no per-mode switch anywhere; if hidden-strict users complain, do NOT re-add key — point to dim + counter.
- Sparklines + dealer-autofetch count as Daten (fetch triggers); if reviewer insists View, move node only, keys identical.
- If AJAX wipes race home-group re-creation, re-attach builders in render, never move off-bar.
- Grep gate: `BESTPREISE_HIDE_UNCHECKED|BESTPREISE_INCLUDE_VORTIEF|BESTPREISE_WEIGHT_RECORD|BESTPREISE_MIN_POINTS|BESTPREISE_MEDIAN_HORIZON_DAYS|HEATMAP_ENABLED|REAL_DEAL_MIN_DISCOUNT` → one UI home each, no `ensureDealControlsPlacement` rest; `tp-mode-hide|highlight-only|tp-reveal-all` → zero src hits (tests updated).
