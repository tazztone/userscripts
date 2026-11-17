# Suggestions & Backlog

## What's Next
- Run `npm run dev:firefox:tp`, click **1. Install [DEV] Stub** on `http://127.0.0.1:8765/setup/toppreise` once, and confirm `#tp-root` + `firefox-devtools` MCP attachment on live `https://www.toppreise.ch/`.
- Manual smoke check on live Toppreise feed page (`npm run dev:firefox:tp`) hiding/restoring a nested subcategory to confirm amber `▸`/`▾` visibility against live dark/light themes.

## Issues & Room for Improvement
- `tools/launch-browser.sh` lacks automated shell unit tests (currently verified by `bash -n` and live runs; e.g. runtime-detection branches could be unit-tested with mocked `PATH`/`flatpak`).

## Reusable Takeaways
- Flatpak `org.mozilla.firefox` (160.0+) stores profiles under `~/.var/app/org.mozilla.firefox/config/mozilla/firefox/` (`XDG_CONFIG_HOME`, mounted at the identical path inside the sandbox), not `~/.mozilla/firefox`.
- Firefox WebDriver BiDi `--remote-debugging-port` returns `200` on `/` and `404` on `/status`; probe `/json/version` first to distinguish Chrome CDP before probing `/` for an active Firefox session.
- Firefox deletes sideloaded `.xpi` files at startup unless the filename matches `manifest.json` `browser_specific_settings.gecko.id` (Violentmonkey: `{aecec67f-0d10-4fa7-b7c7-609a2db280cf}`).
- Watch parent directories rather than individual file inodes with `fs.watch()` so atomic temp-write + rename saves keep triggering reloads.
- `createMockElement` in `toppreise/tests/unit/category-tree.test.js` omits `classList.toggle(cls, force)` and `tag.class` selector matching (e.g. `li.ignoredCategoryEntry`); use explicit `classList.add`/`remove` and class-only selectors (`.ignoredCategoryEntry`) in `category-tree.js` so unit tests stay compatible.
- `toppreise/tests/test_catalog_layout.py` contains exact duplicate assertion pairs; include surrounding context lines in `edit_file` targets to avoid multi-match duplication.
