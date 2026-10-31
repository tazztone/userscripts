/**
 * Category Tree & Sidebar Expansion Feature
 * Loads native category hierarchy (c_cm_data_de / /plugins/category/categorymenu),
 * provides in-sidebar fan-out (▸/▾) for #Plugin_CategoryMainSelectionLeft,
 * instant subcategory search, and lazy hydration of native ✕/＋ exclusion tokens.
 */

import { isNeueToppreisePage, triggerProcessListings } from '../page/adapter.js';
import { showToast } from '../ui/toast.js';
export * from './category-tree-model.js';
export * from './category-tree-actions.js';
import {
  getStoredIdents, getExpandedBranches, saveExpandedBranches,
  toFeedUrl, harvestExistingIdents, isCategoryIgnored, getIgnoredVcatIds,
  getDoc, loadNativeCategoryTree, hydrateBranchIdents, ensureCategoryIdent,
  evictStoredIdent, parseCategoryIdentsFromText, searchCategoryTree
} from './category-tree-model.js';
import {
  observeIgnoredCategoriesBar, updateIgnoredCategoriesBarWithServerHtml,
  refreshProductFeed, executeServerCategoryToggle,
  executeServerCategoryExclusion, executeServerCategoryRestore,
  executeServerCategoryReset
} from './category-tree-actions.js';

let flyoutObserver = null;
let boundBody = null;

function applyIgnoredElementState(targetEl, span, isIgnored, toggle = null) {
  if (isIgnored) {
    targetEl.classList.add('ignoredCategoryEntry');
    span.classList.remove('f_IgnoredCategories_Hide');
    span.classList.add('f_IgnoredCategories_Show');
    span.setAttribute('title', 'Kategorie einblenden');
    const icon = span.querySelector('i');
    if (icon) icon.className = 'TPIcons-plus';
    if (toggle) {
      toggle.disabled = true;
      toggle.setAttribute('aria-disabled', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '▸';
      targetEl.querySelector(':scope > .tp-cat-sublist')?.remove();
    }
  } else {
    targetEl.classList.remove('ignoredCategoryEntry');
    span.classList.remove('f_IgnoredCategories_Show');
    span.classList.add('f_IgnoredCategories_Hide');
    span.setAttribute('title', 'Kategorie ausblenden');
    const icon = span.querySelector('i');
    if (icon) icon.className = 'TPIcons-cross';
    if (toggle) {
      toggle.disabled = false;
      toggle.removeAttribute?.('aria-disabled');
    }
  }
}

export function createIgnoreCategoryBtn(vcatId, isIgnored, ident = '') {
  const span = document.createElement('span');
  span.className = `ignoreCategory ${isIgnored ? 'f_IgnoredCategories_Show' : 'f_IgnoredCategories_Hide'}`;
  span.setAttribute('data-vcat-id', vcatId);
  if (ident) span.setAttribute('data-ident', ident);
  span.setAttribute('title', isIgnored ? 'Kategorie einblenden' : 'Kategorie ausblenden');
  const icon = document.createElement('i');
  icon.className = isIgnored ? 'TPIcons-plus' : 'TPIcons-cross';
  span.appendChild(icon);
  return span;
}

export function syncSearchResultsIgnoredState(resultsBox, doc = null) {
  if (!resultsBox?.querySelectorAll) return;
  const activeDoc = getDoc(doc || resultsBox?.ownerDocument);
  const ignoredIds = getIgnoredVcatIds(activeDoc);

  resultsBox.querySelectorAll('.tp-cat-result-item[data-vcat-id]').forEach(item => {
    const vcatId = item.getAttribute('data-vcat-id');
    const span = item.querySelector('.ignoreCategory[data-vcat-id]');
    if (vcatId && span) {
      applyIgnoredElementState(item, span, ignoredIds.has(String(vcatId).trim()));
    }
  });
}

export function syncCategoryTreeIgnoredState(sidebar = (typeof document !== 'undefined' ? document?.querySelector?.('.Plugin_CategoryMainSelectionLeft') : null)) {
  if (!sidebar?.querySelectorAll) return;
  const doc = sidebar.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const ignoredIds = getIgnoredVcatIds(doc);

  sidebar.querySelectorAll('li.tp-cat-node').forEach(li => {
    const row = li.querySelector?.(':scope > .tp-cat-row') || li.firstElementChild || li;
    const span = row?.querySelector?.('.ignoreCategory[data-vcat-id]');
    if (!span || (span.closest && span.closest('li') !== li)) return;
    const vcatId = span.getAttribute('data-vcat-id');
    if (!vcatId) return;

    applyIgnoredElementState(li, span, ignoredIds.has(String(vcatId).trim()), row.querySelector?.('.tp-cat-toggle'));
  });

  const resultsBox = sidebar.querySelector('.tp-cat-search-results');
  if (resultsBox) {
    syncSearchResultsIgnoredState(resultsBox, doc);
  }
}

function bindTreeBranchToggle(toggle, catId, li, currentPath, expandedBranches, hydrateUrl = null) {
  toggle.onclick = async e => {
    e.preventDefault();
    e.stopPropagation();
    const tree = await loadNativeCategoryTree();
    const children = tree.childrenOf.get(catId) || [];
    const isExp = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isExp));
    toggle.textContent = isExp ? '▸' : '▾';
    if (isExp) {
      expandedBranches.delete(catId);
      saveExpandedBranches(expandedBranches);
      li.querySelector(':scope > .tp-cat-sublist')?.remove();
    } else {
      expandedBranches.add(catId);
      saveExpandedBranches(expandedBranches);
      renderChildList(children, li, currentPath, expandedBranches);
      if (hydrateUrl) {
        const stored = getStoredIdents();
        const needsHydration = children.some(c => {
          const numId = String(c.numericId || c.id || '').replace(/^c/i, '').trim();
          return numId && !stored[numId];
        });
        if (needsHydration) {
          hydrateBranchIdents(hydrateUrl, li);
        }
      }
    }
  };
}

export function renderChildList(children, parentEl, currentPath, expandedBranches) {
  let sublist = parentEl.querySelector(':scope > .tp-cat-sublist');
  if (sublist) {
    sublist.remove();
    return;
  }

  sublist = document.createElement('ul');
  sublist.className = 'tp-cat-sublist';
  const storedIdents = getStoredIdents();
  const doc = parentEl?.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const ignoredIds = getIgnoredVcatIds(doc);

  for (const child of children) {
    const li = document.createElement('li');
    li.className = 'category_level_sub tp-cat-item tp-cat-node';
    li.dataset.catId = child.id;

    const isIgnored = !!(child.numericId && ignoredIds.has(String(child.numericId).trim()));
    if (isIgnored) {
      li.classList.add('ignoredCategoryEntry');
    }

    const row = document.createElement('div');
    row.className = 'tp-cat-row';

    const feedUrl = toFeedUrl(child.url, currentPath);

    // Expand toggle if child has subchildren
    if (child.hasChildren) {
      const toggle = document.createElement('button');
      toggle.className = 'tp-cat-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '▸';
      toggle.title = 'Unterkategorien anzeigen';
      if (isIgnored) {
        toggle.disabled = true;
        toggle.setAttribute('aria-disabled', 'true');
      }
      bindTreeBranchToggle(toggle, child.id, li, currentPath, expandedBranches, feedUrl);
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'tp-cat-spacer';
      row.appendChild(spacer);
    }

    const a = document.createElement('a');
    a.href = feedUrl;
    a.textContent = child.title;
    a.title = child.title;
    row.appendChild(a);

    // Native mute/unmute button (empty <i> so icon font renders single cross or plus)
    if (child.numericId) {
      row.appendChild(createIgnoreCategoryBtn(child.numericId, isIgnored, storedIdents[child.numericId] || ''));
    }

    li.appendChild(row);
    sublist.appendChild(li);

    // Reopen if previously expanded in session (and not ignored)
    if (child.hasChildren && expandedBranches.has(child.id) && !isIgnored) {
      setTimeout(async () => {
        if (typeof document === 'undefined') return;
        const tree = await loadNativeCategoryTree();
        const subChildren = tree.childrenOf.get(child.id) || [];
        const toggle = row.querySelector('.tp-cat-toggle');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'true');
          toggle.textContent = '▾';
          renderChildList(subChildren, li, currentPath, expandedBranches);
        }
      }, 0);
    }
  }

  parentEl.appendChild(sublist);
}

export function enhanceCategorySidebar() {
  if (!isNeueToppreisePage()) return;
  const sidebar = document.querySelector('.Plugin_CategoryMainSelectionLeft');
  if (!sidebar || sidebar.classList.contains('tp-tree-enhanced')) return;
  sidebar.classList.add('tp-tree-enhanced');

  // One-time cleanup of obsolete client persistence key if present
  try {
    localStorage.removeItem('tp_cat_ignored_subcategories');
  } catch {}

  harvestExistingIdents(sidebar);

  const currentPath = typeof location !== 'undefined' ? location.pathname : '';
  const expandedBranches = getExpandedBranches();

  // 1. Search Box
  const labelDiv = sidebar.querySelector('.label.bold');
  if (labelDiv) {
    const searchBox = document.createElement('div');
    searchBox.className = 'tp-cat-search-box';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tp-cat-search-input';
    input.placeholder = '🔍 Kategorie suchen...';
    input.setAttribute('aria-label', 'Kategorie filtern');
    searchBox.appendChild(input);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'tp-cat-search-clear';
    clearBtn.style.display = 'none';
    clearBtn.title = 'Suche leeren';
    clearBtn.textContent = '✕';
    searchBox.appendChild(clearBtn);

    const resultsBox = document.createElement('div');
    resultsBox.className = 'tp-cat-search-results';
    resultsBox.style.display = 'none';
    searchBox.appendChild(resultsBox);

    const ulList = sidebar.querySelector('ul');

    const renderSearchResults = async () => {
      const val = input.value.trim();
      clearBtn.style.display = val ? 'block' : 'none';

      if (!val) {
        resultsBox.style.display = 'none';
        if (ulList) ulList.style.display = '';
        return;
      }

      const storedIdents = getStoredIdents();
      const doc = sidebar.ownerDocument || (typeof document !== 'undefined' ? document : null);
      const ignoredIds = getIgnoredVcatIds(doc);

      const tree = await loadNativeCategoryTree();
      const hits = searchCategoryTree(tree, val, 15, ignoredIds);

      if (ulList) ulList.style.display = 'none';
      resultsBox.style.display = 'block';

      if (resultsBox.replaceChildren) {
        resultsBox.replaceChildren();
      } else {
        while (resultsBox.firstChild) resultsBox.removeChild(resultsBox.firstChild);
      }

      if (hits.length === 0) {
        const noRes = document.createElement('div');
        noRes.className = 'tp-cat-no-results';
        noRes.textContent = 'Keine Kategorie gefunden';
        resultsBox.appendChild(noRes);
        return;
      }

      const frag = document.createDocumentFragment ? document.createDocumentFragment() : document.createElement('div');
      for (const hit of hits) {
        const vcatId = String(hit.numericId || '').trim();
        const isIgnored = !!(vcatId && ignoredIds.has(vcatId));
        const ident = vcatId ? (storedIdents[vcatId] || '') : '';

        const item = document.createElement('div');
        item.className = `tp-cat-result-item${isIgnored ? ' ignoredCategoryEntry' : ''}`;
        if (hit.id) item.setAttribute('data-cat-id', hit.id);
        if (vcatId) item.setAttribute('data-vcat-id', vcatId);

        const link = document.createElement('a');
        link.className = 'tp-cat-result-link';
        link.href = toFeedUrl(hit.url, currentPath);
        if (hit.title) link.title = hit.title;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'tp-cat-res-title';
        titleSpan.textContent = hit.title || '';

        const pathSpan = document.createElement('span');
        pathSpan.className = 'tp-cat-res-path';
        pathSpan.textContent = hit.breadcrumb || '';

        link.appendChild(titleSpan);
        link.appendChild(pathSpan);
        item.appendChild(link);

        if (vcatId) {
          item.appendChild(createIgnoreCategoryBtn(vcatId, isIgnored, ident));
        }

        frag.appendChild(item);
      }
      resultsBox.appendChild(frag);
    };

    input.addEventListener('input', () => {
      renderSearchResults();
    });

    input.addEventListener('focus', () => {
      if (input.value.trim()) {
        renderSearchResults();
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      resultsBox.style.display = 'none';
      if (ulList) ulList.style.display = '';
      input.focus();
    });

    labelDiv.after(searchBox);
  }

  // 2. Attach toggles to existing root li elements
  const rootLis = sidebar.querySelectorAll('ul > li');
  rootLis.forEach(li => {
    const link = li.querySelector('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    const match = href.match(/-c(\d+)/i);
    const catId = match ? `c${match[1]}` : '';

    if (!catId) return;
    li.dataset.catId = catId;
    li.classList.add('tp-cat-node');

    // Wrap existing content in .tp-cat-row so nested .tp-cat-sublist renders below it
    let row = li.querySelector(':scope > .tp-cat-row') || li.querySelector('.tp-cat-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'tp-cat-row';
      while (li.firstChild) {
        row.appendChild(li.firstChild);
      }
      li.appendChild(row);
    }

    const toggle = document.createElement('button');
    toggle.className = 'tp-cat-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '▸';
    toggle.title = 'Unterkategorien anzeigen';

    bindTreeBranchToggle(toggle, catId, li, currentPath, expandedBranches, link.href || href);

    if (isCategoryIgnored(li)) {
      toggle.disabled = true;
      toggle.setAttribute('aria-disabled', 'true');
    }

    row.prepend(toggle);

    // Auto-expand if active in session (and not ignored)
    if (expandedBranches.has(catId) && !isCategoryIgnored(li)) {
      setTimeout(async () => {
        if (typeof document === 'undefined') return;
        const tree = await loadNativeCategoryTree();
        const children = tree.childrenOf.get(catId) || [];
        toggle.setAttribute('aria-expanded', 'true');
        toggle.textContent = '▾';
        renderChildList(children, li, currentPath, expandedBranches);
      }, 0);
    }
  });

  // Align any pre-rendered ignored states in sidebar with active chips
  syncCategoryTreeIgnoredState(sidebar);

  // 3. MutationObserver on .Plugin_IgnoredCategories for dynamic sync
  observeIgnoredCategoriesBar(document);

  // 4. Listen for category hide/show/reset to collapse/restore tree branches and sync chips
  if (typeof document !== 'undefined' && document.body?.addEventListener) {
    if (boundBody !== document.body) {
      boundBody = document.body;
      const isLiveSite = typeof location !== 'undefined' && /toppreise\.ch$/i.test(location.hostname || '');

      document.body.addEventListener('click', async e => {
        const toggleBtn = e.target?.closest?.('.f_IgnoredCategories_Hide, .f_IgnoredCategories_Show');
        if (toggleBtn) {
          const isShow = toggleBtn.classList.contains('f_IgnoredCategories_Show');
          const vcatId = toggleBtn.getAttribute?.('data-vcat-id');
          if (!vcatId) return;

          const isSubOrSearch = !!toggleBtn.closest?.('.tp-cat-sublist, .tp-cat-search-results, .category_level_sub');
          if (isLiveSite && isSubOrSearch) {
            e.preventDefault?.();
            e.stopPropagation?.();
            e.stopImmediatePropagation?.();
          }

          const cleanVcatId = String(vcatId).trim();
          const ident = toggleBtn.getAttribute?.('data-ident') || getStoredIdents()[cleanVcatId] || '';
          const rowEl = toggleBtn.closest?.('.tp-cat-row, .tp-cat-result-item') || toggleBtn;

          if (isLiveSite && isSubOrSearch) {
            rowEl.classList?.add?.('tp-cat-loading');
            try {
              await executeServerCategoryToggle(cleanVcatId, ident, document, isShow);
            } finally {
              rowEl.classList?.remove?.('tp-cat-loading');
            }
          }
          return;
        }

        const resetBtn = e.target?.closest?.('.f_IgnoredCategories_ResetConfirm, .f_IgnoredCategories_Reset');
        if (resetBtn && isLiveSite) {
          const resetIdent = resetBtn.getAttribute?.('data-ident') ||
            document.querySelector?.('.f_IgnoredCategories_ResetConfirm[data-ident], .f_IgnoredCategories_Reset[data-ident]')?.getAttribute?.('data-ident');
          if (resetIdent) {
            e.preventDefault?.();
            e.stopPropagation?.();
            e.stopImmediatePropagation?.();
            executeServerCategoryReset(document);
          }
        }
      }, { capture: true });

      // 5. Observe native IgnoredCategoriesMenu to harvest authentic breadcrumb tokens
      if (typeof MutationObserver === 'function') {
        if (flyoutObserver) {
          try { flyoutObserver.disconnect(); } catch {}
        }
        flyoutObserver = new MutationObserver(mutations => {
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node.nodeType === 1) {
                const menu = node.classList?.contains('IgnoredCategoriesMenu')
                  ? node
                  : node.querySelector?.('.IgnoredCategoriesMenu');
                if (menu) {
                  parseCategoryIdentsFromText(menu.outerHTML);
                }
              }
            }
          }
        });
        flyoutObserver.observe(document.body, { childList: true, subtree: true });
      }
    }
  }
}
