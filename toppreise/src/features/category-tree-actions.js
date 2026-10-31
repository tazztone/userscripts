/**
 * Category Tree Actions & Server Lifecycle
 * Handles server POST endpoints for category exclusion, restoration,
 * reset, AJAX bar updates, and bar MutationObserver wiring.
 */

import { triggerProcessListings } from '../page/adapter.js';
import { showToast } from '../ui/toast.js';
import {
  getStoredIdents, harvestExistingIdents, getDoc,
  loadNativeCategoryTree, ensureCategoryIdent, evictStoredIdent,
  parseCategoryIdentsFromText
} from './category-tree-model.js';
import { syncCategoryTreeIgnoredState } from './category-tree.js';

let ignoredBarObserver = null;

export function observeIgnoredCategoriesBar(activeDoc = (typeof document !== 'undefined' ? document : null)) {
  if (!activeDoc || typeof MutationObserver !== 'function') return;
  const doc = getDoc(activeDoc);
  const ignoredBar = doc?.querySelector?.('.Plugin_IgnoredCategories');
  if (ignoredBarObserver) {
    try { ignoredBarObserver.disconnect(); } catch {}
    ignoredBarObserver = null;
  }
  if (!ignoredBar) return;

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
        const chipCount = newBar.querySelectorAll('.ignoredCategory').length;
        newBar.setAttribute('data-ignored-count', String(chipCount));
        bar.replaceWith(newBar);
        harvestExistingIdents(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft') || newBar);
        if (typeof syncCategoryTreeIgnoredState === 'function') {
          syncCategoryTreeIgnoredState(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft'));
        }
        observeIgnoredCategoriesBar(activeDoc);
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
        if (typeof syncCategoryTreeIgnoredState === 'function') {
          syncCategoryTreeIgnoredState(activeDoc?.querySelector?.('.Plugin_CategoryMainSelectionLeft'));
        }
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

  const buildBody = token => new URLSearchParams({
    lang,
    aicat: token,
    aicatvc: vcatId,
    fp_ic_ch: contextHash
  });

  let ok = await postCategoryAction(ajaxUrl, buildBody(ident), bar, activeDoc, `Category ${isRestore ? 'restore' : 'exclusion'}`);
  if (!ok && !initialIdent) {
    // Stale cached ident may have been rejected by HMAC. Evict and retry once via fresh discovery.
    evictStoredIdent(vcatId);
    const tree = await loadNativeCategoryTree(activeDoc);
    const refreshed = await ensureCategoryIdent({ numericId: vcatId, vcatId }, tree, currentPath, activeDoc);
    if (refreshed && refreshed !== ident) {
      ok = await postCategoryAction(ajaxUrl, buildBody(refreshed), bar, activeDoc, `Category ${isRestore ? 'restore retry' : 'exclusion retry'}`);
    }
  }

  if (!ok) {
    showToast('Kategorie-Aktion fehlgeschlagen');
  }

  return ok;
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
