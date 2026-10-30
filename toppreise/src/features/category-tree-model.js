/**
 * Category Tree Model & Pure Data Layer
 * Handles storage keys, entity decoding, category hierarchy indexing,
 * virtual tree navigation, URL transforms, search filtering and token extraction.
 */

import { showToast } from '../ui/toast.js';

const IDENT_STORAGE_KEY = 'tp_vcat_ident_v1';
const EXPANDED_STORAGE_KEY = 'tp_cat_expanded_branches';

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

// Memory cache for the indexed category tree
let treeIndex = null;
let treeLoadingPromise = null;

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

export async function hydrateBranchIdents(feedUrl, branchEl) {
  if (!feedUrl || typeof fetch !== 'function') return;
  try {
    const resp = await fetch(feedUrl, { credentials: 'same-origin' });
    if (!resp.ok) return;
    const html = await resp.text();
    const stored = parseCategoryIdentsFromText(html);

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

  const timeoutSignal = (ms = 4000) => {
    try {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(ms);
      }
    } catch {}
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    } catch {
      return undefined;
    }
  };

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
        body: body.toString(),
        signal: timeoutSignal(4000)
      });
      if (resp.ok) {
        const text = await resp.text();
        const updatedStored = parseCategoryIdentsFromText(text);
        return !!updatedStored[vcatId];
      }
    } catch {}
    return false;
  };

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

  const candidateUrls = [];
  if (node.url) {
    candidateUrls.push(toFeedUrl(node.url, currentPath));
    candidateUrls.push(node.url);
  }

  if (node.parentID && tree.childrenOf?.has(node.parentID)) {
    const siblings = tree.childrenOf.get(node.parentID) || [];
    for (const sib of siblings) {
      if (sib.id !== node.id && sib.url) {
        candidateUrls.push(toFeedUrl(sib.url, currentPath));
        break;
      }
    }
  }

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

  const uniqueCandidateUrls = [...new Set(candidateUrls.filter(Boolean))].slice(0, 3);
  for (const targetUrl of uniqueCandidateUrls) {
    if (!targetUrl || typeof fetch !== 'function') continue;
    try {
      const fullUrl = targetUrl.startsWith('http') ? targetUrl : `${origin}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
      const resp = await fetch(fullUrl, {
        credentials: 'same-origin',
        headers: {
          'Accept': 'text/html, */*'
        },
        signal: timeoutSignal(4000)
      });
      if (resp.ok) {
        const text = await resp.text();
        const updatedStored = parseCategoryIdentsFromText(text);
        if (updatedStored[vcatId]) {
          item.ident = updatedStored[vcatId];
          return item.ident;
        }

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
