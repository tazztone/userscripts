# Userscripts Agent Guidelines

## Testing & Verification

> [!IMPORTANT]
> **Prefer targeted testing!** Always run the most specific/targeted test command for the area you are working on.

- **Fast Node & Domain Unit Tests (<100ms):**
  ```bash
  node toppreise/tools/build.js --check
  node --test toppreise/tests/unit/*.test.js
  python3 toppreise/tools/verify_category_map.py
  ```

- **Targeted Userscript Playwright Tests:**
  ```bash
  PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest toppreise/tests/test_ui_modal.py -o addopts="--import-mode=importlib"
  PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest toppreise/tests/test_feed_scanner.py -o addopts="--import-mode=importlib"
  PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest toppreise/tests/test_catalog_layout.py -o addopts="--import-mode=importlib"
  PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest toppreise/tests/test_price_logic.py -o addopts="--import-mode=importlib"
  ```

- **All Playwright Tests:**
  ```bash
  PLAYWRIGHT_BROWSERS_PATH=/home/tazztone/_coding/userscripts/.playwright-browsers venv/bin/pytest -o addopts="--import-mode=importlib"
  ```

---

## Userscript Bundling & Development

- **Building Bundles:**
  When editing modular code in `<script>/src/`, compile the bundled artifact before testing or committing:
  ```bash
  node toppreise/tools/build.js
  ```
- **Verifying Bundles (CI Quality Check):**
  ```bash
  node toppreise/tools/build.js --check
  ```
- **Pre-commit Quality Gates:**
  The repository pre-commit hook automatically executes unit tests, taxonomy verification, and increments the bundle version patch level upon commit.
  > [!NOTE]
  > When executing `git commit` via agent commands, `BypassSandbox: true` is required to allow write access to `.git/index.lock` and permit the pre-commit script to update bundle versions.

---

## Development & Mock Testing Patterns

- **AJAX Absolute URL Fallback:**
  Always construct userscript `fetch()` URLs with an origin fallback so requests don't fail with `Failed to fetch` on `file://` Playwright test pages:
  ```javascript
  const baseUrl = (location.origin && location.origin.startsWith('http')) ? location.origin : 'https://www.target-domain.com';
  const url = `${baseUrl}/endpoint`;
  ```
- **Playwright Mock Route CORS:**
  Always pass `headers={'access-control-allow-origin': '*'}` in `route.fulfill(...)` when intercepting userscript network calls from `file://` test origins.
- **Styled Switch Assertions:**
  Zero-opacity `<input type="checkbox">` elements inside custom toggle switches fail `is_visible()`. Assert state with `locator('input').is_checked()` and trigger clicks on the visible `.tp-slider` label.
- **Defensive Shadow DOM Binding:**
  Helper functions attaching event listeners to dual/linked inputs (e.g. range + number input) must null-check elements before binding to keep modal initialization resilient against template changes.

---

## Userscript UI/UX & Architecture Invariants

- **No Redundant Controls:** Avoid duplicating controls that are already directly accessible in the top filter bar (such as negative terms or min-offers steppers) inside the settings modal.
- **Single-Page Visibility over Tabs:** Keep settings modals on a single scrollable page with colored section groupings rather than multi-tab layouts that conceal options.
- **Continuous Scales:** When rendering heatmaps or relative price differences, prefer a continuous scale (e.g., -100% hot to +100% cold with neutral parity at 0%) over fragmented discrete tiers.
- **Feature Graduation:** When moving a feature out of Beta, sweep across `README.md`, UI strings, comments, and test names (`_beta_`) to keep terminology consistent.
- **Test & Scratch Hygiene:** Never leave empty or untracked placeholder files in test suites (e.g., `tests/unit/`). Place exploratory scripts in `scratch/`.

---

## Violentmonkey & Firefox Testing

- **Branch Testing URLs:**
  When testing changes on a branch other than `main` (e.g. `testing`), ensure `@updateURL` and `@downloadURL` in `src/app.js` point to the raw GitHub branch URL.
- **Dispatching Updates to Firefox:**
  To prompt Violentmonkey to install or update the script in Firefox:
  ```bash
  firefox "https://raw.githubusercontent.com/tazztone/userscripts/<branch>/<script>/<script>.user.js"
  ```
