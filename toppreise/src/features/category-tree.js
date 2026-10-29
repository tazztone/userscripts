/**
 * Category Tree & Sidebar Expansion Feature
 * Loads native category hierarchy (c_cm_data_de / /plugins/category/categorymenu),
 * provides in-sidebar fan-out (▸/▾) for #Plugin_CategoryMainSelectionLeft,
 * instant subcategory search, and lazy hydration of native ✕/＋ exclusion tokens.
 */

import { isNeueToppreisePage, triggerProcessListings } from '../page/adapter.js';
import { showToast } from '../ui/toast.js';

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
  if (!catalogUrl || typeof catalogUrl !== 'string') return '/neue-toppreise';
  const trimmed = catalogUrl.trim();
  if (!/^\/(?!\/)/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return '/neue-toppreise';
  }
  const prefix = currentFeedPath && /(?:new-best-prices|nouveaux-meilleurs-prix)/i.test(currentFeedPath)
    ? currentFeedPath.match(/^\/(?:new-best-prices|nouveaux-meilleurs-prix)/i)[0]
    : '/neue-toppreise';
  return trimmed.replace(/^\/(?:produktsuche|katalog|productsearch|recherche-produits)/i, prefix);
}

const ENTITY_MAP = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ouml: 'ö', Ouml: 'Ö', auml: 'ä', Auml: 'Ä', uuml: 'ü', Uuml: 'Ü',
  eacute: 'é', Eacute: 'É', egrave: 'è', Egrave: 'È', ecirc: 'ê', Ecirc: 'Ê',
  agrave: 'à', Agrave: 'À', acirc: 'â', Acirc: 'Â', ccedil: 'ç', Ccedil: 'Ç',
  icirc: 'î', Icirc: 'Î', iuml: 'ï', Iuml: 'Ï',
  ocirc: 'ô', Ocirc: 'Ô',
  ucirc: 'û', Ucirc: 'Û', ugrave: 'ù', Ugrave: 'Ù',
  szlig: 'ß', deg: '°', euro: '€', copy: '©', reg: '®'
};

export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string' || !str.includes('&')) return str || '';
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITY_MAP[entity] ?? match;
  });
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
      title: decodeHtmlEntities(node.title || ''),
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

export function hasIgnoredAncestor(node, tree, ignoredIds) {
  if (!node || !tree?.byId || !ignoredIds) return false;
  const ignoredSet = (ignoredIds instanceof Set) ? ignoredIds : new Set(ignoredIds);
  if (ignoredSet.size === 0) return false;

  let curr = node;
  let depth = 0;
  while (curr && curr.parentID && curr.parentID !== 'root' && curr.parentID !== 'start' && depth < 20) {
    depth++;
    const pid = String(curr.parentID).trim();
    const parentNode = tree.byId.get(pid) ||
                       tree.byId.get(`c${pid}`) ||
                       tree.byId.get(pid.replace(/^c/i, ''));
    if (!parentNode) break;

    const parentNumeric = String(parentNode.numericId || parentNode.id.replace(/^c/i, '')).trim();
    const parentId = String(parentNode.id).trim();

    if (ignoredSet.has(parentNumeric) || ignoredSet.has(parentId) || ignoredSet.has(`c${parentNumeric}`)) {
      return true;
    }
    curr = parentNode;
  }
  return false;
}

export function searchCategoryTree(tree, query, maxResults = 12, ignoredIds = null) {
  if (!tree || !query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results = [];
  const hasIgnoredFilter = ignoredIds && ((ignoredIds instanceof Set && ignoredIds.size > 0) || (Array.isArray(ignoredIds) && ignoredIds.length > 0));

  for (const node of tree.allNodes) {
    if (!node.title || node.id === 'start' || node.id === 'root') continue;
    if (hasIgnoredFilter && hasIgnoredAncestor(node, tree, ignoredIds)) continue;

    const titleLower = node.title.toLowerCase();
    const urlLower = node.url.toLowerCase();
    if (titleLower.includes(q) || urlLower.includes(q)) {
      results.push(node);
      if (results.length >= maxResults) break;
    }
  }
  return results;
}

export function parseCategoryIdentsFromText(text, targetMap = null) {
  const map = targetMap || getStoredIdents();
  if (!text) return map;

  let content = text;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'string') content = parsed;
    else if (parsed && typeof parsed === 'object') {
      content = parsed.html || parsed.content || parsed.menu || text;
    }
  } catch {}

  const regex = /(?:data-vcat-id=\\?["'\\]*(\d+)\\?["'\\]*[^>]*?data-ident=\\?["'\\]*([^"'\\\s>]+)\\?["'\\]*|data-ident=\\?["'\\]*([^"'\\\s>]+)\\?["'\\]*[^>]*?data-vcat-id=\\?["'\\]*(\d+)\\?["'\\]*)/gi;
  let match;
  let changed = false;
  while ((match = regex.exec(content)) !== null) {
    const vid = match[1] || match[4];
    const idn = match[2] || match[3];
    if (vid && idn && map[vid] !== idn) {
      map[vid] = idn;
      changed = true;
    }
  }
  if (changed) saveStoredIdents(map);
  return map;
}

export async function hydrateBranchIdents(feedUrl, branchEl) {
  if (!feedUrl || typeof fetch !== 'function') return;
  try {
    const resp = await fetch(feedUrl, { credentials: 'same-origin' });
    if (!resp.ok) return;
    const html = await resp.text();
    const stored = parseCategoryIdentsFromText(html);

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

export function harvestExistingIdents(sidebar = (typeof document !== 'undefined' ? document?.querySelector?.('.Plugin_CategoryMainSelectionLeft') : null)) {
  const doc = sidebar?.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const searchRoot = doc?.querySelectorAll ? doc : (sidebar?.querySelectorAll ? sidebar : null);
  if (!searchRoot?.querySelectorAll) return;
  const triggers = searchRoot.querySelectorAll('.ignoreCategory[data-vcat-id][data-ident], .Plugin_IgnoredCategories .ignoredCategory[data-vcat-id][data-ident], .ignoredCategory[data-vcat-id][data-ident]');
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
}

export function isCategoryIgnored(li) {
  if (!li) return false;
  if (li.classList?.contains?.('ignoredCategoryEntry')) return true;
  const row = li.querySelector?.(':scope > .tp-cat-row') || li.firstElementChild || li;
  const showBtn = row?.querySelector?.('.f_IgnoredCategories_Show') ||
                  row?.querySelector?.('.ignoreCategory i.TPIcons-plus');
  return !!(showBtn && (!showBtn.closest || showBtn.closest('li') === li));
}

export function getIgnoredVcatIds(doc = (typeof document !== 'undefined' ? document : null)) {
  const set = new Set();
  const activeDoc = getDoc(doc);
  if (!activeDoc?.querySelectorAll) return set;
  const chips = activeDoc.querySelectorAll('.Plugin_IgnoredCategories .ignoredCategory[data-vcat-id]');
  chips.forEach(chip => {
    const vcatId = chip.getAttribute('data-vcat-id');
    if (vcatId) set.add(String(vcatId).trim());
  });
  return set;
}

export function getDoc(doc = null) {
  if (doc) return doc;
  if (typeof document !== 'undefined') return document;
  if (typeof globalThis !== 'undefined' && globalThis.document) return globalThis.document;
  return null;
}

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

export async function ensureCategoryIdent(item, tree = null, currentPath = '', doc = null) {
  if (!item) return '';
  const vcatId = String(item.numericId || item.vcatId || '').trim();
  if (!vcatId) return '';
  if (item.ident) return item.ident;

  const stored = getStoredIdents();
  if (stored[vcatId]) {
    item.ident = stored[vcatId];
    return item.ident;
  }

  const activeDoc = getDoc(doc);
  // Check active DOM first (chips, sidebar triggers, open menus)
  const domToken = activeDoc?.querySelector?.(`[data-vcat-id="${vcatId}"][data-ident]`)?.getAttribute?.('data-ident');
  if (domToken) {
    stored[vcatId] = domToken;
    saveStoredIdents(stored);
    item.ident = domToken;
    return item.ident;
  }

  if (!tree) {
    tree = await loadNativeCategoryTree(activeDoc);
  }
  if (!tree?.byId) return '';

  const catId = item.id || `c${vcatId}`;
  const node = tree.byId.get(catId) || tree.byId.get(vcatId) || tree.byId.get(`c${vcatId}`);
  if (!node) return '';

  // Helper to query /plugins/filter/IgnoredCategories with product ID (aicatpr)
  const fetchMenuIdents = async (pid) => {
    if (!pid || typeof fetch !== 'function') return false;
    const bar = activeDoc?.querySelector?.('.Plugin_IgnoredCategories');
    const ajaxUrl = bar?.getAttribute?.('data-ajax-url') || '/plugins/filter/IgnoredCategories';
    const menuEl = activeDoc?.querySelector?.('.Plugin_CategoryMenu');
    const lang = menuEl?.getAttribute?.('data-lang') || 'de';
    const contextHash = bar?.getAttribute?.('data-context-hash') ||
                        activeDoc?.querySelector?.('[data-context-hash]')?.getAttribute?.('data-context-hash') || '';

    const body = new URLSearchParams({
      aicatpr: pid,
      fp_ic_ch: contextHash,
      f_ic_ch: contextHash,
      p_ic_ch: contextHash,
      ic_ch: contextHash,
      lang
    });

    try {
      const resp = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': '*/*'
        },
        credentials: 'same-origin',
        body: body.toString()
      });
      if (resp.ok) {
        const text = await resp.text();
        const updatedStored = parseCategoryIdentsFromText(text);
        return !!updatedStored[vcatId];
      }
    } catch {}
    return false;
  };

  // 1. Check in-page cards for matching category slug
  const slug = node.url ? (node.url.split('/').pop()?.replace(/-c\d+$/, '') || '') : '';
  if (slug && activeDoc?.querySelectorAll) {
    const matchingCard = activeDoc.querySelector(`.Plugin_Product[href*="/${slug}/"]`);
    if (matchingCard) {
      const pid = matchingCard.getAttribute('data-entity-id') ||
                  (matchingCard.getAttribute('href') || '').match(/-p(\d+)/)?.[1] || '';
      if (pid) {
        await fetchMenuIdents(pid);
        const updatedStored = getStoredIdents();
        if (updatedStored[vcatId]) {
          item.ident = updatedStored[vcatId];
          return item.ident;
        }
      }
    }
  }

  // 2. Candidate URLs (catalog, feeds, siblings and ancestors)
  const candidateUrls = [];
  if (node.url) {
    candidateUrls.push(toFeedUrl(node.url, currentPath));
    candidateUrls.push(node.url);
  }

  // Sibling feed URL: on any sibling's feed page, Toppreise renders node's ident in sidebar
  if (node.parentID && tree.childrenOf?.has(node.parentID)) {
    const siblings = tree.childrenOf.get(node.parentID) || [];
    for (const sib of siblings) {
      if (sib.id !== node.id && sib.url) {
        candidateUrls.push(toFeedUrl(sib.url, currentPath));
        break;
      }
    }
  }

  // First child URL if intermediate node
  if (node.hasChildren && tree.childrenOf?.has(node.id)) {
    const firstChild = tree.childrenOf.get(node.id)?.[0];
    if (firstChild?.url) {
      candidateUrls.push(firstChild.url);
      candidateUrls.push(toFeedUrl(firstChild.url, currentPath));
    }
  }

  let curr = node;
  let depth = 0;
  while (curr && curr.parentID && curr.parentID !== 'root' && curr.parentID !== 'start' && depth < 10) {
    depth++;
    const pid = String(curr.parentID).trim();
    const parentNode = tree.byId.get(pid) ||
                       tree.byId.get(`c${pid}`) ||
                       tree.byId.get(pid.replace(/^c/i, ''));
    if (parentNode?.url) {
      candidateUrls.push(toFeedUrl(parentNode.url, currentPath));
      candidateUrls.push(parentNode.url);
    }
    curr = parentNode;
  }

  if (candidateUrls.length === 0) {
    candidateUrls.push(currentPath || '/neue-toppreise');
  }

  const origin = (typeof location !== 'undefined' && location.origin && /^https?:/.test(location.origin))
    ? location.origin
    : 'https://www.toppreise.ch';

  for (const targetUrl of candidateUrls) {
    if (!targetUrl || typeof fetch !== 'function') continue;
    try {
      const fullUrl = targetUrl.startsWith('http') ? targetUrl : `${origin}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
      // Note: Do NOT send 'X-Requested-With' on full page GETs - Toppreise returns 403 Forbidden
      const resp = await fetch(fullUrl, {
        credentials: 'same-origin',
        headers: {
          'Accept': 'text/html, */*'
        }
      });
      if (resp.ok) {
        const text = await resp.text();
        const updatedStored = parseCategoryIdentsFromText(text);
        if (updatedStored[vcatId]) {
          item.ident = updatedStored[vcatId];
          return item.ident;
        }

        // Extract a product PID from the page
        const pidMatch = text.match(/(?:data-entity-id="(\d+)"|href="[^"]*?-p(\d+)")/);
        const discoveredPid = pidMatch ? (pidMatch[1] || pidMatch[2]) : '';
        if (discoveredPid) {
          await fetchMenuIdents(discoveredPid);
          const finalStored = getStoredIdents();
          if (finalStored[vcatId]) {
            item.ident = finalStored[vcatId];
            return item.ident;
          }
        }
      }
    } catch {}
  }

  return item.ident || '';
}

export async function executeServerCategoryExclusion(vcatId, initialIdent = '', doc = (typeof document !== 'undefined' ? document : null)) {
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
  let ident = initialIdent || getStoredIdents()[vcatId] || '';
  if (!ident) {
    const tree = await loadNativeCategoryTree(activeDoc);
    ident = await ensureCategoryIdent({ numericId: vcatId, vcatId, ident }, tree, currentPath, activeDoc);
  }

  if (!ident) {
    console.info('[Toppreise-Suite] aicat token unavailable on server for category', vcatId);
    showToast('Kategorie-Token konnte nicht geladen werden');
    return false;
  }

  const body = new URLSearchParams({
    lang,
    aicat: ident,
    aicatvc: vcatId,
    fp_ic_ch: contextHash
  });

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
      if (html.includes('Plugin_IgnoredCategories') || html.includes('ignoredCategoriesBar') || html.includes('ignoredCategory')) {
        updateIgnoredCategoriesBarWithServerHtml(html, bar, activeDoc);
      }
      await refreshProductFeed(activeDoc);
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error('[Toppreise-Suite] Category exclusion error:', err);
    return false;
  }
}

export async function executeServerCategoryRestore(vcatId, initialIdent = '', doc = (typeof document !== 'undefined' ? document : null)) {
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
              activeDoc?.querySelector?.(`.Plugin_IgnoredCategories .ignoredCategory[data-vcat-id="${vcatId}"]`)?.getAttribute?.('data-ident') ||
              getStoredIdents()[vcatId] || '';

  if (!ident) {
    const tree = await loadNativeCategoryTree(activeDoc);
    ident = await ensureCategoryIdent({ numericId: vcatId, vcatId, ident }, tree, currentPath, activeDoc);
  }

  if (!ident) {
    console.info('[Toppreise-Suite] aicat token unavailable on server for restoring category', vcatId);
    showToast('Kategorie-Token konnte nicht geladen werden');
    return false;
  }

  const body = new URLSearchParams({
    lang,
    aicat: ident,
    aicatvc: vcatId,
    fp_ic_ch: contextHash
  });

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
    console.error('[Toppreise-Suite] Category restore error:', err);
    return false;
  }
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
      if (html.includes('Plugin_IgnoredCategories') || html.includes('ignoredCategoriesBar') || html.includes('ignoreCategoryHint')) {
        updateIgnoredCategoriesBarWithServerHtml(html, bar, activeDoc);
      }
      await refreshProductFeed(activeDoc);
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Toppreise-Suite] Category reset error:', err);
    return false;
  }
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
      const hideBtn = e.target?.closest?.('.f_IgnoredCategories_Hide');
      if (hideBtn) {
        const vcatId = hideBtn.getAttribute?.('data-vcat-id');
        if (!vcatId) return;

        const isSubOrSearch = !!hideBtn.closest?.('.tp-cat-sublist, .tp-cat-search-results, .category_level_sub');
        if (isLiveSite && isSubOrSearch) {
          e.preventDefault?.();
          e.stopPropagation?.();
          e.stopImmediatePropagation?.();
        }

        const cleanVcatId = String(vcatId).trim();
        const ident = hideBtn.getAttribute?.('data-ident') || getStoredIdents()[cleanVcatId] || '';
        const rowEl = hideBtn.closest?.('.tp-cat-row, .tp-cat-result-item') || hideBtn;

        if (isLiveSite && isSubOrSearch) {
          rowEl.classList?.add?.('tp-cat-loading');
          try {
            await executeServerCategoryExclusion(cleanVcatId, ident, document);
          } finally {
            rowEl.classList?.remove?.('tp-cat-loading');
          }
        }
        return;
      }

      const showBtn = e.target?.closest?.('.f_IgnoredCategories_Show');
      if (showBtn) {
        const vcatId = showBtn.getAttribute?.('data-vcat-id');
        if (!vcatId) return;

        const isSubOrSearch = !!showBtn.closest?.('.tp-cat-sublist, .tp-cat-search-results, .category_level_sub');
        if (isLiveSite && isSubOrSearch) {
          e.preventDefault?.();
          e.stopPropagation?.();
          e.stopImmediatePropagation?.();
        }

        const cleanVcatId = String(vcatId).trim();
        const ident = showBtn.getAttribute?.('data-ident') || getStoredIdents()[cleanVcatId] || '';
        const rowEl = showBtn.closest?.('.tp-cat-row, .tp-cat-result-item') || showBtn;

        if (isLiveSite && isSubOrSearch) {
          rowEl.classList?.add?.('tp-cat-loading');
          try {
            await executeServerCategoryRestore(cleanVcatId, ident, document);
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
