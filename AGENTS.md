# Repository Guidelines

## Project Overview

Violentmonkey/Tampermonkey userscripts, one directory per script. `toppreise/` is flagship (Toppreise.ch deals: Tiefstpreis verification, heatmap, filtering, batch scanner, sparklines, alarms, Discord share). `huggingface/`, `perplexity/` are single-file scripts. `fastlog-watcher/` is research-only. User docs live in `toppreise/README.md`; UI vocabulary binds to `toppreise/GLOSSARY.md`.

## Architecture & Data Flow

Toppreise is the only modular script: `toppreise/src/` → `tools/build.js` → committed bundle `toppreise/toppreise.user.js` (regenerate via build, keep edits in `src/`).

Card-centric pipeline in `src/app.js` (`processListings()`): `page/cards.js` extracts → `domain/` prices/scores → `scanner/` verifies history → `ui/` decorates. `processListings()` re-runs after scan batches via debounced `MutationObserver`. Persistent settings live in `state/config.js` (`CONFIG`); session progress in `state/store.js`. Injected chrome mounts on `#tp-root` Shadow host (`ui/shell.js`) with a native `dialog` modal.

## Key Directories

```text
toppreise/src/{app.js,state,page,domain,scanner,ui}/  # source; header lives in app.js
toppreise/tests/{unit/,test_*.py,mock_toppreise.html} # node unit + Playwright browser suite
toppreise/{tools/build.js,docs/adr/,GLOSSARY.md}      # bundler, decisions, vocabulary
huggingface/ perplexity/                              # single .user.js + tests/test_userscript.py
scratch/                                              # exploration (gitignored)
```

## Development Commands

Build-then-test: rebuild before any browser test or commit.

```bash
node toppreise/tools/build.js          # rebuild bundle
node toppreise/tools/build.js --check  # drift gate, run pre/post src/ edit
node --test toppreise/tests/unit/*.test.js
```

Targeted-first Playwright (full list of `test_*.py` files is one glob away):

```bash
PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest toppreise/tests/test_ui_modal.py -o addopts="--import-mode=importlib"
PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest -o addopts="--import-mode=importlib"  # all
```

`package.json` scripts mirror the node commands. Commits run `bump_version_precommit.py` (rebuild, `--check`, unit tests, `@version` patch-bump); a failing gate aborts. When deleting files, clear the gate: `rg '<deleted-name>' bump_version_precommit.py <script>/tools/ AGENTS.md`. Stage only intended files (`git status` first). Branch testing: point `@updateURL/@downloadURL` at the branch raw URL, then open it in Firefox to trigger the Violentmonkey update:
`firefox "https://raw.githubusercontent.com/tazztone/userscripts/<branch>/<script>/<script>.user.js"`.

## Code Conventions & Common Patterns

- Route DOM queries through the frozen registry in `page/selectors.js`.
- Keep `domain/` pure and Node-tested (`parsePrice`, `analyzePriceTimeSeries`, `computeDealScore`).
- Bound async work: `scanner/cache.js` LRU + TTL localStorage, `activeFetches` dedup, 429 backoff.
- Build `fetch()` URLs with an origin fallback so `file://` mock pages resolve:
  ```javascript
  const baseUrl = (location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
  ```
- Fulfill mocked routes with `headers={'access-control-allow-origin': '*'}`.
- Treat switches as checkbox state: assert `is_checked()`, click `.tp-slider`; null-check dual range+number inputs before binding.
- Keep the settings modal single-page with grouped sections; keep filter-bar controls out of the modal; render heat as a continuous scale around parity; write UI strings per `GLOSSARY.md` while leaving code identifiers and storage keys stable. Header fields (`@updateURL`, `@version`) follow `src/app.js`.

## Important Files

- `toppreise/src/app.js` — pipeline entry, header source, `window.ToppreiseSuite` debug handle
- `toppreise/GLOSSARY.md`, `docs/adr/` — binding vocabulary and contextual-placement decisions
- `bump_version_precommit.py`, `pytest.ini`, `toppreise/tests/conftest.py` — gates, runner defaults, bundle-injection fixture

## Runtime/Tooling Preferences

Stock `node` for build/unit, `venv/bin/pytest` for browser tests; dependency versions live in `tests/requirements.txt`. Point `PLAYWRIGHT_BROWSERS_PATH` at repo-local `.playwright-browsers/` and override the ini channel with `-o addopts="--import-mode=importlib"` on every run.

## Testing & QA

Targeted-first: narrowest `unit/<name>.test.js` or single `test_<name>.py` (`::test_name` for one case), `--test-name-pattern` for one node case. Fast layer is `node:test` with `unit/helpers.js:withConfig`; browser layer injects the built bundle into `file://mock_*.html` and seeds state via `page.evaluate`. Mocks stay hand-rolled (stub objects + `Map` storage in JS, `page.route` in Python). Keep exploration in `scratch/` and suites free of placeholders; graduating a feature sweeps `README.md`, UI strings, comments, and `_beta_` test names.
