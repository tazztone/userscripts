# Repository Guidelines

## Project Overview

Violentmonkey/Tampermonkey userscripts, one directory per script. `toppreise/` is flagship (Toppreise.ch deal suite: Tiefstpreis verification, discount heatmap, filtering, batch price-history scanner, sparklines, price alarms, Discord share). `huggingface/`, `perplexity/` are single-file scripts. `fastlog-watcher/` is research-only (`RESEARCH_LOG.md`).

## Architecture & Data Flow

Toppreise only modular script: `toppreise/src/` (~21 ES modules) → `node toppreise/tools/build.js` → committed bundle `toppreise/toppreise.user.js` (~359 KB, do not hand-edit).

Pipeline in `toppreise/src/app.js` (`processListings()`): Extract → Filter → Render → Sort → chrome. Card-centric: `page/cards.js` extracts per-card data → `domain/` pure price/deal math → `scanner/` fetches + verifies history (fetch → `cache.js` → re-render) → `ui/` decorates cards + filter bar + CTA. Re-entry via `processListings()` after every scan batch, filtered + debounced `MutationObserver`, `navigation.navigatesuccess` hook.

State split: `state/config.js` = persistent settings (live `CONFIG` object, GM + localStorage mirror); `state/store.js` = ephemeral `scanState` session flags/progress. No framework, modules import `CONFIG` directly. UI shell: `#tp-root` Shadow DOM host (`ui/shell.js`), native top-layer `dialog` modal (`ui/modal.js`).

## Key Directories

```text
toppreise/src/{state,page,domain,scanner,ui}/  # modular source
toppreise/src/app.js                            # IIFE entry, header source of truth
toppreise/tools/build.js                        # zero-dep bundler
toppreise/tests/unit/*.test.js                  # 14 files, 1:1 vs src modules
toppreise/tests/test_*.py + mock_toppreise.html # Playwright suite (68 KB fixture)
toppreise/docs/adr/ + GLOSSARY.md               # binding UI vocabulary, ADRs
huggingface/ perplexity/                        # single .user.js + tests/test_userscript.py + mock_*.html
scratch/                                        # exploratory scripts (gitignored)
.playwright-browsers/ venv/                     # vendored browsers + Python env (gitignored)
```

## Development Commands

```bash
node toppreise/tools/build.js          # rebuild bundle after src/ edits (required before test/commit)
node toppreise/tools/build.js --check  # drift gate, must pass pre/post edit
node --test toppreise/tests/unit/*.test.js
npm run build | npm run check | npm run test:unit  # same, cwd toppreise/
PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest toppreise/tests/test_ui_modal.py -o addopts="--import-mode=importlib"
# same pattern for test_feed_scanner.py, test_catalog_layout.py, test_price_logic.py, test_floating_cta.py, test_heatmap_contrast.py
PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest -o addopts="--import-mode=importlib"  # all
node --test huggingface/tests/test_logic.js  # HF gate
bash toppreise/tools/refresh-screenshot.sh
firefox "https://raw.githubusercontent.com/tazztone/userscripts/<branch>/<script>/<script>.user.js"  # Violentmonkey install/update
```

Pre-commit hook (`.git/hooks/pre-commit` → `bump_version_precommit.py`) rebuilds bundle, runs `--check` + unit tests, patch-bumps `@version` in `*.user.js` + `src/app.js` + `package.json` + `README.md (v…)`. Fail = commit aborts. Deletion checklist: `rg '<deleted-name>' bump_version_precommit.py <script>/tools/ AGENTS.md`. Commit hygiene: review full `git status`, never stage unrelated changes or home dotfiles.

## Code Conventions & Common Patterns

- Frozen `SELECTORS` registry: all DOM queries via `toppreise/src/page/selectors.js`, never inline selectors.
- Pure `domain/`: `price.js` (`parsePrice` CH formats, `analyzePriceTimeSeries` outlier sanitize), `deal-score.js` (`computeDealScore`, `weightedDiff`, heat deadband). Keep pure, unit-tested in Node.
- Bounded async cache: `scanner/cache.js` in-memory LRU (cap 500) + localStorage (`tp_hist/dealer/shared_v1_`, 48h/2h TTL, 14-day prune, upgrade-only writes). Dedup via `activeFetches` map, 429 backoff in `scanner.js`.
- `fetch()` origin fallback (required for `file://` tests): `const baseUrl = (location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';`
- Playwright `route.fulfill(..., headers={'access-control-allow-origin': '*'})` for `file://` CORS.
- Styled switches: zero-opacity `input` + visible `.tp-slider`; assert `locator('input').is_checked()`, click `.tp-slider`.
- Defensive Shadow DOM binding: null-check dual range+number inputs before listener attach (`state/config.js`, `ui/modal.js`).
- UI invariants: single scrollable settings page (no tabs); no controls duplicated between filter bar and modal; continuous heat scale (neutral ±5%); `GLOSSARY.md` binds UI strings, code identifiers stay legacy, storage keys never renamed without migration.
- Userscript header source of truth: `toppreise/src/app.js:47-62`; `@namespace https://github.com/tazztone/userscripts`, `@updateURL/@downloadURL` = `https://raw.githubusercontent.com/tazztone/userscripts/main/<script>/<script>.user.js`. Branch testing: point at branch raw URL.

## Important Files

- `toppreise/src/app.js` — entry, pipeline, header, `window.ToppreiseSuite` debug handle
- `toppreise/src/state/config.js`, `state/store.js` — persistent vs ephemeral state
- `toppreise/src/page/cards.js`, `adapter.js`, `sort.js` — host-DOM boundary
- `toppreise/src/scanner/scanner.js`, `cache.js` — I/O + cache
- `toppreise/src/ui/shell.js`, `modal.js`, `toolbar.js`, `badges.js`, `floating-cta.js`, `sparkline.js`, `styles.js` — injected chrome
- `toppreise/tools/build.js`, `toppreise/package.json`, `bump_version_precommit.py`, `.git/hooks/pre-commit`, `pytest.ini`
- `toppreise/GLOSSARY.md`, `toppreise/docs/adr/0001-*.md`, `toppreise/docs/filter-ansicht-plan.md`, `toppreise/README.md`

## Runtime/Tooling Preferences

Stock `node` (bundler via `node:vm` syntax check + `node --test`), `venv/bin/python|pytest` (CPython 3.14, `toppreise/tests/requirements.txt`: `pytest>=8`, `pytest-playwright>=0.5`, `playwright>=1.40`). No root `package.json`, no lockfiles, no bun/npm deps, no ESLint/Prettier/Husky. `PLAYWRIGHT_BROWSERS_PATH` must point at repo-local `.playwright-browsers/`; always override `pytest.ini --browser-channel=chrome` with `-o addopts="--import-mode=importlib"`. `perplexity/tests/conftest.py` self-sets the browsers path.

## Testing & QA

> Prefer targeted testing: most specific file first; `--check` before/after every `src/` edit.

- Fast layer: `node --test tests/unit/<name>.test.js` (<100ms, `node:test` + `node:assert/strict`, `unit/helpers.js` `withConfig`), plus pytest→node bridge `test_price_logic.py`.
- Browser layer: `pytest` + `pytest-playwright`, real Chromium on `file://mock_*.html` + `page.evaluate(bundle)`. Single test: `venv/bin/pytest toppreise/tests/test_catalog_layout.py::test_name -o addopts="--import-mode=importlib"`. Single node case: `node --test --test-name-pattern="<name>" tests/unit/<f>.test.js`.
- Mocks hand-rolled, no mock lib: JS stub objects with `querySelector` lambdas + `Map` storage; Python `page.route('**/plugins/product/pricechart*', …)` + `localStorage`/`ToppreiseSuite` seeding via `page.evaluate`.
- Hygiene: never placeholder files in `tests/`; exploration in `scratch/`. Feature graduation: sweep `README.md`, UI strings, comments, test names (`_beta_`). Terminology per `GLOSSARY.md` (Tiefstpreis vs Differenz (ungeprüft)).
