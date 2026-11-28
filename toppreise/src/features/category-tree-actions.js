/**
 * Category Tree Actions & Server Lifecycle
 * Handles server POST endpoints for category exclusion, restoration,
 * reset, AJAX bar updates, and bar MutationObserver wiring.
 */

import { triggerProcessListings } from '../page/adapter.js';
import { sanitizeImportedNode } from '../page/sanitize.js';
import { showToast } from '../ui/toast.js';
import {
  getStoredIdents, harvestExistingIdents, getDoc,
  loadNativeCategoryTree, ensureCategoryIdent, evictStoredIdent,
  parseCategoryIdentsFromText, getCategoryAjaxContext
} from './category-tree-model.js';
import { syncCategoryTreeIgnoredState } from './category-tree.js';
import { fetchWithTimeout } from '../state/net.js';
import { logActivity } from '../state/activity-log.js';

let ignoredBarObserver = null;
let observedIgnoredBar = null;

export function disconnectIgnoredBarObserver() {
  if (ignoredBarObserver) {
    try { ignoredBarObserver.disconnect(); } catch {}
    ignoredBarObserver = null;
  }
  observedIgnoredBar = null;
}

export function observeIgnoredCategoriesBar(activeDoc = (typeof document !== 'undefined' ? document : null)) {
  if (!activeDoc || typeof MutationObserver !== 'function') return;
  const doc = getDoc(activeDoc);
  const ignoredBar = doc?.querySelector?.('.Plugin_IgnoredCategories');
  if (ignoredBar && ignoredBar === observedIgnoredBar && ignoredBar.isConnected !== false && ignoredBarObserver) {
    return;
  }
  disconnectIgnoredBarObserver();
  if (!ignoredBar) return;

  observedIgnoredBar = ignoredBar;
  ignoredBarObserver = new MutationObserver(() => {
    const sidebar = doc?.querySelector?.('.Plugin_CategoryMainSelectionLeft');
    if (sidebar && typeof syncCategoryTreeIgnoredState === 'function') {
      syncCategoryTreeIgnoredState(sidebar);
    }
  });
  ignoredBarObserver.observe(ignoredBar, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ignored-count'] });
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
        const liveBar = bar?.isConnected ? bar : activeDoc?.querySelector?.('.Plugin_IgnoredCategories');
        if (!liveBar) return;
        const importedBar = activeDoc?.importNode ? activeDoc.importNode(newBar, true) : newBar;
        const cleanBar = sanitizeImportedNode(importedBar);
        if (!cleanBar) return;
        const chipCount = cleanBar.querySelectorAll('.ignoredCategory').length;
        cleanBar.setAttribute('data-ignored-count', String(chipCount));
        liveBar.replaceWith(cleanBar);
        harvestExistingIdents(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft') || cleanBar);
        if (typeof syncCategoryTreeIgnoredState === 'function') {
          syncCategoryTreeIgnoredState(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft'));
        }
        observeIgnoredCategoriesBar(activeDoc);
      } else if (newContainer) {
        const liveBar = bar?.isConnected ? bar : activeDoc?.querySelector?.('.Plugin_IgnoredCategories');
        if (!liveBar) return;
        const importedContainer = activeDoc?.importNode ? activeDoc.importNode(newContainer, true) : newContainer;
        const cleanContainer = sanitizeImportedNode(importedContainer);
        if (!cleanContainer) return;
        const curContainer = liveBar.querySelector('.ignoredCategoriesBar');
        if (curContainer) {
          curContainer.replaceWith(cleanContainer);
        } else {
          liveBar.appendChild(cleanContainer);
        }
        const chipCount = liveBar.querySelectorAll('.ignoredCategory').length;
        liveBar.setAttribute('data-ignored-count', String(chipCount));
        harvestExistingIdents(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft') || liveBar);
        if (typeof syncCategoryTreeIgnoredState === 'function') {
          syncCategoryTreeIgnoredState(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft'));
        }
      }
    }
  } catch {}
}

let feedRefreshSeq = 0;

export async function refreshProductFeed(doc = (typeof document !== 'undefined' ? document : null)) {
  if (typeof location === 'undefined' || !/(?:^|\.)toppreise\.ch$/i.test(location.hostname || '')) return;
  const seq = ++feedRefreshSeq;
  const requestedHref = location.href;
  const activeDoc = getDoc(doc);
  const container = activeDoc?.querySelector?.('.Plugin_TopPriceReductionProductListFull') ||
                    activeDoc?.querySelector?.('.standardList');
  if (!container || typeof fetch !== 'function') return;

  try {
    const { res: resp, body: html } = await fetchWithTimeout(
      requestedHref,
      { credentials: 'same-origin', cache: 'no-cache' },
      { timeoutMs: 10000, source: 'category-tree', label: 'refresh-feed', readAs: 'text' }
    );
    if (!resp.ok || seq !== feedRefreshSeq || location.href !== requestedHref) return;
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(html, 'text/html');
      const newContainer = parsedDoc.querySelector('.Plugin_TopPriceReductionProductListFull') ||
                           parsedDoc.querySelector('.standardList');
      const targetContainer = (container && container.isConnected !== false)
        ? container
        : (activeDoc?.querySelector?.('.Plugin_TopPriceReductionProductListFull') || activeDoc?.querySelector?.('.standardList'));
      if (newContainer && targetContainer) {
        if (typeof targetContainer.replaceChildren === 'function') {
          const nodes = Array.from(newContainer.childNodes || [])
            .map(n => (activeDoc?.importNode ? activeDoc.importNode(n, true) : n))
            .map(n => (n.nodeType === 1 ? sanitizeImportedNode(n) : n))
            .filter(Boolean);
          targetContainer.replaceChildren(...nodes);
        } else {
          sanitizeImportedNode(newContainer);
          targetContainer.innerHTML = newContainer.innerHTML;
        }
        triggerProcessListings();
      }
    }
  } catch (err) {
    logActivity('error', 'category-tree', 'Feed refresh error', err?.message || String(err));
  }
}

export async function executeServerCategoryToggle(vcatId, initialIdent = '', doc = null, isRestore = false) {
  if (typeof location === 'undefined' || !/(?:^|\.)toppreise\.ch$/i.test(location.hostname || '')) return true;

  const activeDoc = getDoc(doc);
  const { bar, ajaxUrl, lang, contextHash } = getCategoryAjaxContext(activeDoc);

  if (typeof fetch !== 'function' || !ajaxUrl) return false;

  const currentPath = typeof location !== 'undefined' ? location.pathname : '';
  const safeVcatId = String(vcatId).replace(/["\\]/g, '\\$&');
  let ident = initialIdent ||
              (isRestore ? activeDoc?.querySelector?.(`.Plugin_IgnoredCategories .ignoredCategory[data-vcat-id="${safeVcatId}"]`)?.getAttribute?.('data-ident') : '') ||
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

  const buildBody = token => new URLSearchParams({
    lang,
    aicat: token,
    aicatvc: vcatId,
    fp_ic_ch: contextHash
  });

  let ok = await postCategoryAction(ajaxUrl, buildBody(ident), bar, activeDoc, `Category ${isRestore ? 'restore' : 'exclusion'}`);
  if (!ok) {
    // Stale cached ident may have been rejected by HMAC. Evict and retry once via fresh discovery.
    evictStoredIdent(vcatId);
    const tree = await loadNativeCategoryTree(activeDoc);
    const refreshed = await ensureCategoryIdent({ numericId: vcatId, vcatId }, tree, currentPath, activeDoc, ident);
    if (refreshed && refreshed !== ident) {
      const liveBar = bar?.isConnected ? bar : activeDoc?.querySelector?.('.Plugin_IgnoredCategories');
      ok = await postCategoryAction(ajaxUrl, buildBody(refreshed), liveBar, activeDoc, `Category ${isRestore ? 'restore retry' : 'exclusion retry'}`);
    }
  }

  if (!ok) {
    showToast('Kategorie-Aktion fehlgeschlagen');
  }

  return ok;
}

async function postCategoryAction(ajaxUrl, body, bar, activeDoc, contextName) {
  try {
    const { res: resp, body: html } = await fetchWithTimeout(ajaxUrl, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      credentials: 'same-origin',
      body: body.toString()
    }, { timeoutMs: 8000, source: 'category-tree', label: contextName || 'action', readAs: 'text' });
    if (resp.ok) {
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
    logActivity('error', 'category-tree', `${contextName} error`, err?.message || String(err));
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
  if (typeof location === 'undefined' || !/(?:^|\.)toppreise\.ch$/i.test(location.hostname || '')) return true;

  const activeDoc = getDoc(doc);
  const { bar, ajaxUrl, lang, contextHash } = getCategoryAjaxContext(activeDoc);

  if (typeof fetch !== 'function' || !ajaxUrl) return false;

  const resetIdent = activeDoc?.querySelector?.('.f_IgnoredCategories_ResetConfirm[data-ident], .f_IgnoredCategories_Reset[data-ident]')?.getAttribute?.('data-ident');
  if (!resetIdent) return false;

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
