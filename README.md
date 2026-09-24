# Userscripts

A collection of production-grade browser userscripts (compatible with Violentmonkey/Tampermonkey) designed for high reliability and maintainability across modern SPAs.

## Prerequisites

Requires Violentmonkey (or a compatible userscript manager):
- [Violentmonkey for Firefox](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/)
- [Violentmonkey for Chrome](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag)

## Standard Project Structure

Every userscript resides in its own subdirectory:

- **`RESEARCH_LOG.md`**: Rigorous documentation of the target site's DOM structure, robust selectors, and visual heuristics. Used to ensure longevity against UI updates.
- **`[name].user.js`**: The source code following a strict component separation (CONFIG, STYLES, UTILITIES, LOGIC, ORCHESTRATION).
- **`README.md`**: User guide containing configuration mapping and quick-install links.
- **`tests/`** (Optional): Testing infrastructure (e.g., Playwright) to verify logic against mock environments.

---

## Directory Inventory

| Userscript | Description | Direct Install |
| :--- | :--- | :---: |
| [**Toppreise Suite**](./toppreise) | Best price highlighting, discount heatmap, negative text filter, hierarchical category exclusion, and price alarm automation. | [⚡ **Install**](https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js) |
| [**Perplexity Enhancements**](./perplexity) | Keeps preferred model active, auto-approves action cards, and enables GitHub connector. | [⚡ **Install**](https://raw.githubusercontent.com/tazztone/userscripts/main/perplexity/perplexity-enhancements.user.js) |
| [**Hugging Face Heart & Filter**](./huggingface) | Filter models/datasets by last modified date, auto-unheart/heart toggle, non-blocking toasts. | [⚡ **Install**](https://raw.githubusercontent.com/tazztone/userscripts/main/huggingface/huggingface-heart.user.js) |
| [**Fastlog Watcher**](./fastlog-watcher) | Real-time event and log stream monitor. | *(In development)* |

---

## Shared Tooling

- **`bump_version_precommit.py`**: Universal pre-commit hook script that automatically increments `@version` patch numbers for any staged `*.user.js` file and syncs adjacent `README.md` install links before committing.
- **`venv/`**: A shared Python virtual environment utilized by individual projects for automated extraction (agent-assisted) and end-to-end validation.
