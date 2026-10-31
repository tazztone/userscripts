/** Category tree sidebar styles (split from ui/styles/chrome.js). */

export const STYLES_CATEGORY_TREE = `
  /* Sidebar Search Box */
  .tp-cat-search-box { position: relative !important; margin: 6px 0 10px !important; width: 100% !important; box-sizing: border-box !important; }
  .tp-cat-search-input {
    width: 100% !important; height: 28px !important; padding: 3px 22px 3px 8px !important;
    font: 500 12px var(--tp-font) !important; border-radius: var(--tp-r-sm) !important;
    border: 1px solid var(--tp-line-soft) !important; background: rgba(255, 255, 255, 0.08) !important;
    color: inherit !important; box-sizing: border-box !important; outline: none !important;
  }
  .tp-cat-search-input:focus { border-color: var(--tp-blue-soft) !important; background: rgba(255, 255, 255, 0.14) !important; }
  .tp-cat-search-clear {
    position: absolute !important; right: 6px !important; top: 50% !important; transform: translateY(-50%) !important;
    background: transparent !important; border: none !important; cursor: pointer !important; font-size: 11px !important;
    color: var(--tp-txt-dim) !important; padding: 0 !important; line-height: 1 !important;
  }
  .tp-cat-search-results {
    max-height: 260px !important; overflow-y: auto !important; background: var(--tp-panel, #1e293b) !important;
    border: 1px solid var(--tp-line-soft) !important; border-radius: var(--tp-r-sm) !important; margin-top: 4px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25) !important; position: absolute !important; top: 100% !important; left: 0 !important; right: 0 !important; z-index: 100 !important;
  }
  .tp-cat-result-item {
    display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important;
    padding: 3px 6px 3px 8px !important; text-decoration: none !important; border-bottom: 1px solid var(--tp-line, rgba(255,255,255,0.06)) !important;
    transition: background 0.15s ease !important;
  }
  .tp-cat-result-item:hover { background: rgba(59, 130, 246, 0.1) !important; }
  .tp-cat-result-link { display: flex !important; flex-direction: column !important; flex: 1 1 auto !important; min-width: 0 !important; padding: 3px 0 !important; text-decoration: none !important; color: inherit !important; }
  .tp-cat-res-title { font-size: 12px !important; font-weight: 600 !important; color: inherit !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
  .tp-cat-res-path { font-size: 10.5px !important; color: var(--tp-txt-dim, #94a3b8) !important; opacity: 0.7 !important; margin-top: 1px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
  .tp-cat-no-results { padding: 8px !important; font-size: 11.5px !important; color: var(--tp-txt-dim) !important; text-align: center !important; }

  /* Tree Nodes & Row Layout */
  .Plugin_CategoryMainSelectionLeft li.tp-cat-node,
  .tp-cat-sublist li.tp-cat-node {
    display: flex !important; flex-direction: column !important; align-items: stretch !important; justify-content: flex-start !important;
    width: 100% !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important;
  }
  .Plugin_CategoryMainSelectionLeft li:is(.ignoredCategoryEntry, :has(> .tp-cat-row > .f_IgnoredCategories_Show, > .f_IgnoredCategories_Show)) > .tp-cat-sublist { display: none !important; }
  .Plugin_CategoryMainSelectionLeft li:is(.ignoredCategoryEntry, :has(> .tp-cat-row > .f_IgnoredCategories_Show, > .f_IgnoredCategories_Show)) > .tp-cat-row .tp-cat-toggle { opacity: 0.25 !important; pointer-events: none !important; cursor: default !important; }

  .tp-cat-row {
    display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important;
    width: 100% !important; min-height: 22px !important; padding: 2px 0 !important; box-sizing: border-box !important;
  }
  .tp-cat-row > a {
    flex: 1 1 auto !important; min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important;
    white-space: nowrap !important; text-decoration: none !important; color: inherit !important; font-size: 12px !important; line-height: 1.3 !important;
  }
  .tp-cat-row > a:hover { color: var(--tp-blue-soft, #38bdf8) !important; }

  .tp-cat-toggle {
    background: transparent !important; border: none !important; cursor: pointer !important; padding: 0 !important;
    margin: 0 3px 0 0 !important; font-size: 9px !important; color: inherit !important; opacity: 0.45 !important;
    width: 14px !important; height: 14px !important; line-height: 14px !important; text-align: center !important; flex: 0 0 14px !important;
    transition: opacity 0.15s ease, transform 0.15s ease !important;
  }
  .tp-cat-toggle:hover { opacity: 0.9 !important; color: var(--tp-blue-soft, #38bdf8) !important; }
  .tp-cat-spacer { display: inline-block !important; width: 14px !important; height: 14px !important; margin: 0 3px 0 0 !important; flex: 0 0 14px !important; }

  /* Shared Mute/Restore Controls (Vanilla: hidden until hover, subtle plus when ignored) */
  .tp-cat-row .ignoreCategory,
  .tp-cat-result-item .ignoreCategory {
    flex: 0 0 auto !important; cursor: pointer !important; font-size: 11px !important; line-height: 1 !important;
    border-radius: 3px !important; transition: opacity 0.15s ease, color 0.15s ease !important;
  }
  .tp-cat-row .ignoreCategory { margin-left: 4px !important; padding: 1px 4px !important; }
  .tp-cat-result-item .ignoreCategory { margin-left: 8px !important; padding: 2px 6px !important; }

  .Plugin_CategoryMainSelectionLeft .ignoreCategory.f_IgnoredCategories_Hide,
  .tp-cat-result-item .ignoreCategory.f_IgnoredCategories_Hide {
    opacity: 0 !important; pointer-events: none !important; color: inherit !important;
  }
  .Plugin_CategoryMainSelectionLeft .tp-cat-row:hover .ignoreCategory.f_IgnoredCategories_Hide,
  .Plugin_CategoryMainSelectionLeft li:hover > .ignoreCategory.f_IgnoredCategories_Hide,
  .tp-cat-result-item:hover .ignoreCategory.f_IgnoredCategories_Hide {
    opacity: 0.5 !important; pointer-events: auto !important;
  }
  .Plugin_CategoryMainSelectionLeft .ignoreCategory.f_IgnoredCategories_Hide:hover,
  .tp-cat-result-item .ignoreCategory.f_IgnoredCategories_Hide:hover {
    opacity: 1 !important; color: var(--tp-rose, #f43f5e) !important;
  }

  .Plugin_CategoryMainSelectionLeft li:is(.ignoredCategoryEntry, :has(> .tp-cat-row > .f_IgnoredCategories_Show, > .f_IgnoredCategories_Show)) > .tp-cat-row > a,
  .tp-cat-result-item.ignoredCategoryEntry {
    opacity: 0.45 !important;
  }
  .Plugin_CategoryMainSelectionLeft .ignoreCategory.f_IgnoredCategories_Show,
  .tp-cat-result-item.ignoredCategoryEntry .ignoreCategory.f_IgnoredCategories_Show {
    opacity: 0.55 !important; color: inherit !important;
  }
  .Plugin_CategoryMainSelectionLeft .ignoreCategory.f_IgnoredCategories_Show:hover,
  .tp-cat-result-item.ignoredCategoryEntry .ignoreCategory.f_IgnoredCategories_Show:hover {
    opacity: 1 !important; color: var(--tp-acc, #10b981) !important;
  }

  /* Sublist & Loading */
  .tp-cat-sublist {
    list-style: none !important; margin: 1px 0 2px 6px !important; padding: 0 0 0 5px !important;
    border-left: 1px solid rgba(148, 163, 184, 0.2) !important; width: calc(100% - 6px) !important; box-sizing: border-box !important;
  }
  .tp-cat-sublist .tp-cat-row > a { font-size: 11.5px !important; opacity: 0.85 !important; }
  .tp-cat-sublist .tp-cat-row > a:hover { opacity: 1 !important; color: var(--tp-blue-soft, #38bdf8) !important; }
  .tp-cat-row.tp-cat-loading,
  .tp-cat-result-item.tp-cat-loading { opacity: 0.4 !important; pointer-events: none !important; transition: opacity 0.2s ease !important; }
`;
