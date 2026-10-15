# Agent Guide: Toppreise Workflows

Procedural detail behind `AGENTS.md`. Two branches: test runs → §Testing; code changes → §Patterns, §Header, §Gates.

## Gates

```bash
node toppreise/tools/build.js          # rebuild bundle after src/ edits, before test/commit
node toppreise/tools/build.js --check  # drift gate, run pre/post src/ edit
```

Commits run `bump_version_precommit.py` (rebuild, `--check`, unit tests, `@version` patch-bump); a failing gate aborts. When deleting files, clear the gate: `rg '<deleted-name>' bump_version_precommit.py <script>/tools/ AGENTS.md`. `git status` first; stage only intended files.

## Graph

Project `home-tazztone-_coding-userscripts`, indexed `moderate` (filtered+semantic; `full` would pull gitignored `.playwright-browsers`/`venv`). Structural questions first: `search_graph` to find, `trace_path` for callers/callees, `get_code_snippet` to read. Bare names are ambiguous (src + built bundle `toppreise.user.js`); trace with the qualified name. Re-index via `index_repository(mode="moderate")` after moves/renames.
Zero-degree hits are candidates only: re-check with `rg`/LSP before deleting. The graph misses callback references (`forEach(scheduleApproval)`), listener args (`addEventListener('abort', onAbort)`), Proxy traps (`get:`), Tampermonkey wiring, and pytest entries — all falsified live in Oct 2026; only `batchSignal` was truly dead.

## Testing

```bash
node --test toppreise/tests/unit/*.test.js  # fast layer (<100ms); single file: tests/unit/<name>.test.js
node --test --test-name-pattern="<name>" toppreise/tests/unit/<f>.test.js  # one case
PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest toppreise/tests/test_ui_modal.py -o addopts="--import-mode=importlib"
PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest -o addopts="--import-mode=importlib"  # all
venv/bin/pytest toppreise/tests/test_catalog_layout.py::test_name -o addopts="--import-mode=importlib"  # one case
node --test huggingface/tests/test_logic.js  # HF gate
bash toppreise/tools/refresh-screenshot.sh
```

Same `PLAYWRIGHT_BROWSERS_PATH` + `-o addopts` pattern for `test_feed_scanner.py`, `test_catalog_layout.py`, `test_price_logic.py`, `test_floating_cta.py`, `test_heatmap_contrast.py`. Fixture: `page.evaluate(bundle)` on `file://mock_*.html` (see `toppreise/tests/conftest.py`); mocks hand-rolled (`page.route`, stub objects). Suites stay placeholder-free; exploration goes in `scratch/`.

## Patterns

- DOM queries through `page/selectors.js`; `domain/` stays pure and Node-tested.
- `fetch()` URLs carry an origin fallback so `file://` mocks resolve:
  ```javascript
  const baseUrl = (location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.toppreise.ch';
  ```
- Mocked routes fulfill with `headers={'access-control-allow-origin': '*'}`.
- Switches: assert `is_checked()`, click `.tp-slider`; null-check dual range+number inputs before binding.

## Header

Header source of truth is `toppreise/src/app.js`. Branch testing: point `@updateURL/@downloadURL` at the branch raw URL, then `firefox "https://raw.githubusercontent.com/tazztone/userscripts/<branch>/<script>/<script>.user.js"`.

## UI Invariants

Single-page settings modal; no filter-bar controls duplicated in the modal; continuous heat scale around parity; UI strings per `toppreise/GLOSSARY.md`, code identifiers and storage keys stable. Graduating a feature sweeps `README.md`, UI strings, comments, `_beta_` test names.
