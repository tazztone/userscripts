/**
 * Category Tree & Sidebar Expansion Feature
 * Loads native category hierarchy (c_cm_data_de / /plugins/category/categorymenu),
 * provides in-sidebar fan-out (▸/▾) for #Plugin_CategoryMainSelectionLeft,
 * instant subcategory search, and lazy hydration of native ✕/＋ exclusion tokens.
 */

import { isNeueToppreisePage } from '../page/adapter.js';

const IDENT_STORAGE_KEY = 'tp_vcat_ident_v1';
const EXPANDED_STORAGE_KEY = 'tp_cat_expanded_branches';

// Memory cache for the indexed category tree
let treeIndex = null;
let treeLoadingPromise = null;

export function getStoredIdents() {
  try {
    const raw = localStorage.getItem(IDENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStoredIdents(map) {
  try {
    localStorage.setItem(IDENT_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function getExpandedBranches() {
  try {
    const raw = sessionStorage.getItem(EXPANDED_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveExpandedBranches(set) {
  try {
    sessionStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function toFeedUrl(catalogUrl, currentFeedPath = '') {
  if (!catalogUrl) return '/neue-toppreise';
  const prefix = currentFeedPath && /(?:new-best-prices|nouveaux-meilleurs-prix)/i.test(currentFeedPath)
    ? currentFeedPath.match(/^\/(?:new-best-prices|nouveaux-meilleurs-prix)/i)[0]
    : '/neue-toppreise';
  return catalogUrl.replace(/^\/(?:produktsuche|katalog|productsearch|recherche-produits)/i, prefix);
}

export function indexCategoryData(categories) {
  const byId = new Map();
  const childrenOf = new Map(); // parentID -> array of nodes
  const allNodes = [];

  const visit = (node, parentId = '') => {
    if (!node || !node.id) return;
    const cleanId = String(node.id).trim();
    if (byId.has(cleanId)) return;

    const pid = parentId || String(node.parentID || '').trim() || 'root';
    const entry = {
      id: cleanId,
      numericId: cleanId.replace(/^c/i, ''),
      parentID: pid,
      title: (node.title || '').replace(/&amp;/g, '&').replace(/&ouml;/g, 'ö').replace(/&auml;/g, 'ä').replace(/&uuml;/g, 'ü'),
      url: node.url || '',
      hasChildren: !!node.hasChildren || (Array.isArray(node.children) && node.children.length > 0)
    };
    byId.set(cleanId, entry);
    allNodes.push(entry);
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid).push(entry);

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child, cleanId);
      }
    }
  };

  if (Array.isArray(categories)) {
    for (const item of categories) visit(item, String(item.parentID || '').trim());
  }

  // Build breadcrumbs for search
  for (const node of allNodes) {
    const parts = [node.title];
    let curr = node;
    while (curr && curr.parentID && curr.parentID !== 'root' && curr.parentID !== 'start') {
      const p = byId.get(curr.parentID);
      if (p && p.title) {
        parts.unshift(p.title);
        curr = p;
      } else {
        break;
      }
    }
    node.breadcrumb = parts.join(' › ');
  }

  return { byId, childrenOf, allNodes };
}

export async function loadNativeCategoryTree(doc = (typeof document !== 'undefined' ? document : null)) {
  if (treeIndex) return treeIndex;
  if (treeLoadingPromise) return treeLoadingPromise;

  treeLoadingPromise = (async () => {
    try {
      const menuEl = doc?.querySelector?.('.Plugin_CategoryMenu');
      const lang = menuEl?.getAttribute('data-lang') || 'de';
      const hash = menuEl?.getAttribute('data-hash') || '';

      // Check native Toppreise localStorage cache
      const cachedHash = localStorage.getItem(`c_cm_hash_${lang}`);
      const cachedDataRaw = localStorage.getItem(`c_cm_data_${lang}`);
      if (cachedDataRaw && (!hash || cachedHash === hash)) {
        try {
          const parsed = JSON.parse(cachedDataRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            treeIndex = indexCategoryData(parsed);
            return treeIndex;
          }
        } catch {}
      }

      // Fetch from native endpoint if element exists
      if (menuEl && typeof fetch === 'function') {
        const ajaxUrl = menuEl.getAttribute('data-ajax-url') || '/plugins/category/categorymenu';
        const contextHash = menuEl.getAttribute('data-context-hash') || '';
        const body = new URLSearchParams({
          c_cm_ch: contextHash,
          c_cm_la: lang,
          lang
        });
        const resp = await fetch(ajaxUrl, {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          body: body.toString()
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json?.categories) {
            try {
              localStorage.setItem(`c_cm_data_${lang}`, JSON.stringify(json.categories));
              if (json.hash) localStorage.setItem(`c_cm_hash_${lang}`, json.hash);
            } catch {}
            treeIndex = indexCategoryData(json.categories);
            return treeIndex;
          }
        }
      }
    } catch (err) {
      // Graceful fallback: return empty index
    }
    treeIndex = indexCategoryData([]);
    return treeIndex;
  })();

  return treeLoadingPromise;
}

export function searchCategoryTree(tree, query, maxResults = 12) {
  if (!tree || !query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results = [];
  for (const node of tree.allNodes) {
    if (!node.title || node.id === 'start' || node.id === 'root') continue;
    const titleLower = node.title.toLowerCase();
    const urlLower = node.url.toLowerCase();
    if (titleLower.includes(q) || urlLower.includes(q)) {
      results.push(node);
      if (results.length >= maxResults) break;
    }
  }
  return results;
}

export async function hydrateBranchIdents(feedUrl, branchEl) {
  if (!feedUrl || typeof fetch !== 'function') return;
  try {
    const resp = await fetch(feedUrl, { credentials: 'same-origin' });
    if (!resp.ok) return;
    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const triggers = doc.querySelectorAll('.Plugin_CategoryMainSelectionLeft .ignoreCategory[data-vcat-id][data-ident]');
    if (triggers.length === 0) return;

    const stored = getStoredIdents();
    let changed = false;
    triggers.forEach(tr => {
      const vcatId = tr.getAttribute('data-vcat-id');
      const ident = tr.getAttribute('data-ident');
      if (vcatId && ident && stored[vcatId] !== ident) {
        stored[vcatId] = ident;
        changed = true;
      }
    });
    if (changed) saveStoredIdents(stored);

    // Update rendered spans in this branch if present
    if (branchEl) {
      branchEl.querySelectorAll?.('.ignoreCategory[data-vcat-id]').forEach(span => {
        const vcatId = span.getAttribute('data-vcat-id');
        if (vcatId && stored[vcatId] && !span.getAttribute('data-ident')) {
          span.setAttribute('data-ident', stored[vcatId]);
        }
      });
    }
  } catch {}
}

export function isCategoryIgnored(li) {
  if (!li) return false;
  return li.classList?.contains?.('ignoredCategoryEntry') ||
         !!li.querySelector?.('.f_IgnoredCategories_Show') ||
         !!li.querySelector?.('.ignoreCategory i.TPIcons-plus');
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

  for (const child of children) {
    const li = document.createElement('li');
    li.className = 'category_level_sub tp-cat-item tp-cat-node';
    li.dataset.catId = child.id;

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
      toggle.onclick = async e => {
        e.preventDefault();
        e.stopPropagation();
        const tree = await loadNativeCategoryTree();
        const subChildren = tree.childrenOf.get(child.id) || [];
        const isExp = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!isExp));
        toggle.textContent = isExp ? '▸' : '▾';
        if (isExp) {
          expandedBranches.delete(child.id);
          saveExpandedBranches(expandedBranches);
          li.querySelector(':scope > .tp-cat-sublist')?.remove();
        } else {
          expandedBranches.add(child.id);
          saveExpandedBranches(expandedBranches);
          renderChildList(subChildren, li, currentPath, expandedBranches);
          hydrateBranchIdents(feedUrl, li);
        }
      };
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

    // Native mute/unmute button (empty <i> so icon font renders single cross)
    if (child.numericId) {
      const span = document.createElement('span');
      span.className = 'ignoreCategory f_IgnoredCategories_Hide';
      span.setAttribute('data-vcat-id', child.numericId);
      const ident = storedIdents[child.numericId];
      if (ident) span.setAttribute('data-ident', ident);
      span.setAttribute('title', 'Kategorie ausblenden');
      const icon = document.createElement('i');
      icon.className = 'TPIcons-cross';
      span.appendChild(icon);
      row.appendChild(span);
    }

    li.appendChild(row);
    sublist.appendChild(li);

    // Reopen if previously expanded in session
    if (child.hasChildren && expandedBranches.has(child.id)) {
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

    input.addEventListener('input', async () => {
      const val = input.value.trim();
      clearBtn.style.display = val ? 'block' : 'none';
      if (!val) {
        resultsBox.style.display = 'none';
        if (ulList) ulList.style.display = '';
        return;
      }
      const tree = await loadNativeCategoryTree();
      const hits = searchCategoryTree(tree, val, 15);
      if (hits.length === 0) {
        resultsBox.innerHTML = '<div class="tp-cat-no-results">Keine Kategorie gefunden</div>';
      } else {
        resultsBox.innerHTML = hits.map(hit => `
          <a class="tp-cat-result-item" href="${toFeedUrl(hit.url, currentPath)}">
            <span class="tp-cat-res-title">${hit.title}</span>
            <span class="tp-cat-res-path">${hit.breadcrumb || ''}</span>
          </a>
        `).join('');
      }
      resultsBox.style.display = 'block';
      if (ulList) ulList.style.display = 'none';
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
        hydrateBranchIdents(link.href || href, li);
      }
    };

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

  // 3. Listen for category hide/show to collapse/re-enable tree branches
  if (typeof document !== 'undefined' && document.body?.addEventListener) {
    document.body.addEventListener('click', e => {
      const hideBtn = e.target?.closest?.('.f_IgnoredCategories_Hide');
      if (hideBtn) {
        const targetLi = hideBtn.closest('li');
        if (targetLi) {
          const catId = targetLi.dataset?.catId;
          if (catId) {
            expandedBranches.delete(catId);
            saveExpandedBranches(expandedBranches);
          }
          targetLi.querySelector(':scope > .tp-cat-sublist')?.remove();
          const toggle = targetLi.querySelector('.tp-cat-toggle');
          if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            toggle.textContent = '▸';
            toggle.disabled = true;
            toggle.setAttribute('aria-disabled', 'true');
          }
        }
        return;
      }

      const showBtn = e.target?.closest?.('.f_IgnoredCategories_Show');
      if (showBtn) {
        const vcatId = showBtn.getAttribute?.('data-vcat-id');
        const targetLi = showBtn.closest('li') || (vcatId ? sidebar.querySelector(`[data-vcat-id="${vcatId}"]`)?.closest('li') : null);
        if (targetLi) {
          const toggle = targetLi.querySelector('.tp-cat-toggle');
          if (toggle) {
            toggle.disabled = false;
            toggle.removeAttribute('aria-disabled');
          }
        }
        return;
      }

      const resetBtn = e.target?.closest?.('.f_IgnoredCategories_Reset');
      if (resetBtn) {
        sidebar.querySelectorAll('.tp-cat-toggle').forEach(t => {
          t.disabled = false;
          t.removeAttribute('aria-disabled');
        });
      }
    });
  }
}
