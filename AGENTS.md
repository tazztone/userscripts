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

Build-then-test; detail: `docs/agent-guide.md` (§Gates, §Testing).

```bash
node toppreise/tools/build.js --check  # drift gate, run pre/post src/ edit
PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest toppreise/tests/test_ui_modal.py -o addopts="--import-mode=importlib"
```

`package.json` scripts mirror the node commands. Stage only intended files.

## Code Conventions & Common Patterns

DOM via `page/selectors.js`; `domain/` pure and Node-tested; async bounded (`scanner/cache.js`). Snippets and mock rules: `docs/agent-guide.md` (§Patterns).

## Important Files

- `toppreise/src/app.js` — pipeline entry, header source
- `docs/agent-guide.md` — gates, testing, patterns, header, UI invariants
- `toppreise/GLOSSARY.md`, `toppreise/docs/adr/` — binding UI vocabulary and decisions

## Runtime/Tooling Preferences

Stock `node` for build/unit, `venv/bin/pytest` for browser tests; versions in `tests/requirements.txt`. Every pytest run needs the browsers-path env plus `-o addopts="--import-mode=importlib"` (see §Development Commands).

## Testing & QA

Targeted-first: narrowest `unit/<name>.test.js` or `test_<name>.py`. Full workflow: `docs/agent-guide.md` (§Testing).
