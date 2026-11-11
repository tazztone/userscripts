# Repository Guidelines

## Project Overview

Violentmonkey/Tampermonkey userscripts, one directory per script. `toppreise/` is flagship (Toppreise.ch deals); `huggingface/`, `perplexity/` are single-file scripts; `fastlog-watcher/` is research-only. User docs: `toppreise/README.md`.

## Architecture & Data Flow

Card-centric pipeline in `toppreise/src/app.js` (`processListings()`): extract → price/score → verify history → decorate. Only modular script: `toppreise/src/` → `tools/build.js` → committed bundle `toppreise/toppreise.user.js` (edits in `src/`, never the bundle). Settings in `state/config.js`, session in `state/store.js`, chrome on `#tp-root` Shadow host.

## Key Directories

```text
toppreise/src/{app.js,state,page,domain,scanner,ui}/  # source; header in app.js
toppreise/tests/{unit/,test_*.py,mock_toppreise.html} # node unit + Playwright suite
docs/agent-guide.md                        # repo-wide agent workflows (gates, testing, patterns)
toppreise/docs/{adr/,filter-ansicht-plan.md}, GLOSSARY.md  # decisions, vocabulary
scratch/                                              # exploration (gitignored)
```

## Development Commands

Build-then-test; detail: `docs/agent-guide.md` (§Gates, §Testing, §Live Browser Loop).

```bash
npm run dev:chrome:tp                  # 1-line: sync daemon + Chrome on target site
npm run dev:firefox:tp                 # 1-line: sync daemon + Firefox on target site
npm run dev:firefox:tp:install         # 1-line: one-time Dev Loader stub install in Firefox
npm run dev:chrome:tp:install          # 1-line: one-time Dev Loader stub install in Chrome
npm run dev                            # sync daemon only at http://127.0.0.1:8765
node toppreise/tools/build.js --check  # drift gate, run pre/post src/ edit
venv/bin/pytest toppreise/tests/test_ui_modal.py
```

`package.json` scripts mirror the node commands. Stage only intended files.

## Live Browser & MCP Loop

Active browser sessions connect to the agent via DevTools MCP (`userscript-bridge_firefox-devtools` / `chrome-devtools`):
- **Observe live**: Use `evaluate_script` to read `#tp-root` `data-tp-diag` (version, cards, counts, `lastError`) and computed element styles.
- **Inspect visuals**: Use `take_snapshot` and `screenshot_page` / `screenshot_by_uid` directly. Never ask the user for screenshots or manual DOM checks when MCP is available.
- **Hands-free reload**: Dev server SSE auto-reloads connected tabs on `src/` file saves in <50ms.
- **Setup**: `npm run dev:firefox:tp` (daily) or `npm run dev:firefox:tp:install` (one-time stub install). Details: `docs/agent-guide.md` (§Live Browser Loop).

## Code Conventions & Common Patterns

DOM via `page/selectors.js`; `domain/` pure and Node-tested; async bounded (`scanner/cache.js`). Snippets and mock rules: `docs/agent-guide.md` (§Patterns).

## Important Files

- `toppreise/src/app.js` — pipeline entry, header source
- `docs/agent-guide.md` — gates, testing, patterns, header, UI invariants
- `toppreise/GLOSSARY.md`, `toppreise/docs/adr/` — binding UI vocabulary and decisions

## Runtime/Tooling Preferences

Stock `node` for build/unit, `venv/bin/pytest` for browser tests; versions in `tests/requirements.txt`. Both conftest files auto-configure local `.playwright-browsers`; importlib mode and `-n 4` parallelization are configured in `pytest.ini`.

## Testing & QA

Targeted-first: narrowest `unit/<name>.test.js` or `test_<name>.py`. Full workflow: `docs/agent-guide.md` (§Testing).
