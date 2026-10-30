/**
 * Category Tree & Sidebar Expansion Feature
 * Loads native category hierarchy (c_cm_data_de / /plugins/category/categorymenu),
 * provides in-sidebar fan-out (▸/▾) for #Plugin_CategoryMainSelectionLeft,
 * instant subcategory search, and lazy hydration of native ✕/＋ exclusion tokens.
 */

import { isNeueToppreisePage, triggerProcessListings } from '../page/adapter.js';
import { showToast } from '../ui/toast.js';
export * from './category-tree-model.js';
import {
  getStoredIdents, getExpandedBranches, saveExpandedBranches,
  toFeedUrl, harvestExistingIdents, isCategoryIgnored, getIgnoredVcatIds,
  getDoc, loadNativeCategoryTree, hydrateBranchIdents, ensureCategoryIdent,
  parseCategoryIdentsFromText, searchCategoryTree
} from './category-tree-model.js';

export function updateIgnoredCategoriesBarWithServerHtml(html, bar, doc = null) {
  if (!html || !bar) return;
  const activeDoc = getDoc(doc || bar.ownerDocument);
  parseCategoryIdentsFromText(html);
  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(html, 'text/html');
      const newBar = parsed.querySelector('.Plugin_IgnoredCategories');
      const newContainer = parsed.querySelector('.ignoredCategoriesBar');
      if (newBar) {
        const chipCount = newBar.querySelectorAll('.ignoredCategory').length;
        newBar.setAttribute('data-ignored-count', String(chipCount));
        bar.replaceWith(newBar);
        harvestExistingIdents(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft') || newBar);
        syncCategoryTreeIgnoredState(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft'));
      } else if (newContainer) {
        const curContainer = bar.querySelector('.ignoredCategoriesBar');
        if (curContainer) {
          curContainer.replaceWith(newContainer);
        } else {
          bar.appendChild(newContainer);
        }
        const chipCount = bar.querySelectorAll('.ignoredCategory').length;
        bar.setAttribute('data-ignored-count', String(chipCount));
        harvestExistingIdents(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft') || bar);
        syncCategoryTreeIgnoredState(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft'));
      }
    }
  } catch {}
}

export async function refreshProductFeed(doc = (typeof document !== 'undefined' ? document : null)) {
  if (typeof location === 'undefined' || !/toppreise\.ch$/i.test(location.hostname || '')) return;
  const activeDoc = getDoc(doc);
  const container = activeDoc?.querySelector?.('.Plugin_TopPriceReductionProductListFull') ||
                    activeDoc?.querySelector?.('.standardList');
  if (!container || typeof fetch !== 'function') return;

  try {
    const resp = await fetch(location.href, { credentials: 'same-origin', cache: 'no-cache' });
    if (!resp.ok) return;
    const html = await resp.text();
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(html, 'text/html');
      const newContainer = parsedDoc.querySelector('.Plugin_TopPriceReductionProductListFull') ||
                           parsedDoc.querySelector('.standardList');
      if (newContainer && container) {
        container.innerHTML = newContainer.innerHTML;
        triggerProcessListings();
      }
    }
  } catch (err) {
    console.error('[Toppreise-Suite] Feed refresh error:', err);
  }
}

export async function executeServerCategoryToggle(vcatId, initialIdent = '', doc = null, isRestore = false) {
  if (typeof location === 'undefined' || !/toppreise\.ch$/i.test(location.hostname || '')) return true;

  const activeDoc = getDoc(doc);
  const bar = activeDoc?.querySelector?.('.Plugin_IgnoredCategories');
  const ajaxUrl = bar?.getAttribute?.('data-ajax-url') || '/plugins/filter/IgnoredCategories';
  const menuEl = activeDoc?.querySelector?.('.Plugin_CategoryMenu');
  const lang = menuEl?.getAttribute?.('data-lang') || 'de';
  const contextHash = bar?.getAttribute?.('data-context-hash') ||
                      activeDoc?.querySelector?.('[data-context-hash]')?.getAttribute?.('data-context-hash') || '';

  if (typeof fetch !== 'function' || !ajaxUrl) return false;

  const currentPath = typeof location !== 'undefined' ? location.pathname : '';
  let ident = initialIdent ||
              (isRestore ? activeDoc?.querySelector?.(`.Plugin_IgnoredCategories .ignoredCategory[data-vcat-id="${vcatId}"]`)?.getAttribute?.('data-ident') : '') ||
              getStoredIdents()[vcatId] || '';

  if (!ident) {
    const tree = await loadNativeCategoryTree(activeDoc);
    ident = await ensureCategoryIdent({ numericId: vcatId, vcatId, ident }, tree, currentPath, activeDoc);
  }

  if (!ident) {
    console.info(`[Toppreise-Suite] aicat token unavailable on server for ${isRestore ? 'restoring ' : ''}category`, vcatId);
    showToast('Kategorie-Token konnte nicht geladen werden');
    return false;
  }

  const body = new URLSearchParams({
    lang,
    aicat: ident,
    aicatvc: vcatId,
    fp_ic_ch: contextHash
  });

  return postCategoryAction(ajaxUrl, body, bar, activeDoc, `Category ${isRestore ? 'restore' : 'exclusion'}`);
}

async function postCategoryAction(ajaxUrl, body, bar, activeDoc, contextName) {
  try {
    const resp = await fetch(ajaxUrl, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      credentials: 'same-origin',
      body: body.toString()
    });
    if (resp.ok) {
      const html = await resp.text();
      const match = html.match(/data-context-hash="([^"]+)"/);
      if (match && match[1] && bar) {
        bar.setAttribute('data-context-hash', match[1]);
      }
      if (html.includes('Plugin_IgnoredCategories') || html.includes('ignoredCategoriesBar') || html.includes('ignoredCategory') || html.includes('ignoreCategoryHint')) {
        updateIgnoredCategoriesBarWithServerHtml(html, bar, activeDoc);
      }
      await refreshProductFeed(activeDoc);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[Toppreise-Suite] ${contextName} error:`, err);
    return false;
  }
}

export function executeServerCategoryExclusion(vcatId, initialIdent = '', doc = (typeof document !== 'undefined' ? document : null)) {
  return executeServerCategoryToggle(vcatId, initialIdent, doc, false);
}

export function executeServerCategoryRestore(vcatId, initialIdent = '', doc = (typeof document !== 'undefined' ? document : null)) {
  return executeServerCategoryToggle(vcatId, initialIdent, doc, true);
}

export async function executeServerCategoryReset(doc = (typeof document !== 'undefined' ? document : null)) {
  if (typeof location === 'undefined' || !/toppreise\.ch$/i.test(location.hostname || '')) return true;

  const activeDoc = getDoc(doc);
  const bar = activeDoc?.querySelector?.('.Plugin_IgnoredCategories');
  const ajaxUrl = bar?.getAttribute?.('data-ajax-url') || '/plugins/filter/IgnoredCategories';
  const menuEl = activeDoc?.querySelector?.('.Plugin_CategoryMenu');
  const lang = menuEl?.getAttribute?.('data-lang') || 'de';
  const contextHash = bar?.getAttribute?.('data-context-hash') ||
                      activeDoc?.querySelector?.('[data-context-hash]')?.getAttribute?.('data-context-hash') || '';

  if (typeof fetch !== 'function' || !ajaxUrl) return false;

  const resetIdent = activeDoc?.querySelector?.('.f_IgnoredCategories_ResetConfirm[data-ident], .f_IgnoredCategories_Reset[data-ident]')?.getAttribute?.('data-ident') || 'all';

  const body = new URLSearchParams({
    aicatrs: resetIdent,
    fp_ic_ch: contextHash,
    f_ic_ch: contextHash,
    p_ic_ch: contextHash,
    ic_ch: contextHash,
    lang
  });

  return postCategoryAction(ajaxUrl, body, bar, activeDoc, 'Category reset');
}

export function syncSearchResultsIgnoredState(resultsBox, doc = null) {
  if (!resultsBox?.querySelectorAll) return;
  const activeDoc = getDoc(doc || resultsBox?.ownerDocument);
  const ignoredIds = getIgnoredVcatIds(activeDoc);

  resultsBox.querySelectorAll('.tp-cat-result-item[data-vcat-id]').forEach(item => {
    const vcatId = item.getAttribute('data-vcat-id');
    if (!vcatId) return;

    const isIgnored = ignoredIds.has(String(vcatId).trim());
    const span = item.querySelector('.ignoreCategory[data-vcat-id]');
    if (!span) return;

    if (isIgnored) {
      item.classList.add('ignoredCategoryEntry');
      span.classList.remove('f_IgnoredCategories_Hide');
      span.classList.add('f_IgnoredCategories_Show');
      span.setAttribute('title', 'Kategorie einblenden');
      const icon = span.querySelector('i');
      if (icon) icon.className = 'TPIcons-plus';
    } else {
      item.classList.remove('ignoredCategoryEntry');
      span.classList.remove('f_IgnoredCategories_Show');
      span.classList.add('f_IgnoredCategories_Hide');
      span.setAttribute('title', 'Kategorie ausblenden');
      const icon = span.querySelector('i');
      if (icon) icon.className = 'TPIcons-cross';
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

    const isIgnored = ignoredIds.has(String(vcatId).trim());
    const toggle = row.querySelector?.('.tp-cat-toggle');

    if (isIgnored) {
      li.classList.add('ignoredCategoryEntry');
      span.classList.remove('f_IgnoredCategories_Hide');
      span.classList.add('f_IgnoredCategories_Show');
      span.setAttribute('title', 'Kategorie einblenden');
      const icon = span.querySelector('i');
      if (icon) {
        icon.className = 'TPIcons-plus';
      }
      if (toggle) {
        toggle.disabled = true;
        toggle.setAttribute('aria-disabled', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '▸';
        li.querySelector(':scope > .tp-cat-sublist')?.remove();
      }
    } else {
      li.classList.remove('ignoredCategoryEntry');
      span.classList.remove('f_IgnoredCategories_Show');
      span.classList.add('f_IgnoredCategories_Hide');
      span.setAttribute('title', 'Kategorie ausblenden');
      const icon = span.querySelector('i');
      if (icon) {
        icon.className = 'TPIcons-cross';
      }
      if (toggle) {
        toggle.disabled = false;
        toggle.removeAttribute?.('aria-disabled');
      }
    }
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
      if (hydrateUrl) hydrateBranchIdents(hydrateUrl, li);
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
      const span = document.createElement('span');
      span.className = `ignoreCategory ${isIgnored ? 'f_IgnoredCategories_Show' : 'f_IgnoredCategories_Hide'}`;
      span.setAttribute('data-vcat-id', child.numericId);
      const ident = storedIdents[child.numericId];
      if (ident) span.setAttribute('data-ident', ident);
      span.setAttribute('title', isIgnored ? 'Kategorie einblenden' : 'Kategorie ausblenden');
      const icon = document.createElement('i');
      icon.className = isIgnored ? 'TPIcons-plus' : 'TPIcons-cross';
      span.appendChild(icon);
      row.appendChild(span);
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
          const actionBtn = document.createElement('span');
          actionBtn.className = `ignoreCategory ${isIgnored ? 'f_IgnoredCategories_Show' : 'f_IgnoredCategories_Hide'}`;
          actionBtn.setAttribute('data-vcat-id', vcatId);
          if (ident) actionBtn.setAttribute('data-ident', ident);
          actionBtn.title = isIgnored ? 'Kategorie einblenden' : 'Kategorie ausblenden';

          const icon = document.createElement('i');
          icon.className = isIgnored ? 'TPIcons-plus' : 'TPIcons-cross';
          actionBtn.appendChild(icon);
          item.appendChild(actionBtn);
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
  if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
    const ignoredBar = document.querySelector('.Plugin_IgnoredCategories');
    if (ignoredBar) {
      const observer = new MutationObserver(() => {
        syncCategoryTreeIgnoredState(sidebar);
      });
      observer.observe(ignoredBar, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ignored-count'] });
    }
  }

  // 4. Listen for category hide/show/reset to collapse/restore tree branches and sync chips
  if (typeof document !== 'undefined' && document.body?.addEventListener) {
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

      const resetBtn = e.target?.closest?.('.f_IgnoredCategories_Reset');
      if (resetBtn) {
        if (isLiveSite) {
          executeServerCategoryReset(document);
        }
      }
    }, { capture: true });
  }

  // 5. Observe native IgnoredCategoriesMenu to harvest authentic breadcrumb tokens
  if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
    const flyoutObserver = new MutationObserver(mutations => {
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
