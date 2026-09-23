/**
 * Grid Sorting Engine
 * Handles flex column reparenting and sorting by offer count, discount percent,
 * and continuous deal score, with 100% natural DOM order restoration.
 */

import { CONFIG } from '../state/config.js';
import {
  getCardSortableUnit,
  extractCardData,
  extractCardDiscount,
  extractOfferCount
} from './cards.js';
import { computeDealScore } from '../domain/deal-score.js';

export function applySorting(cards, pageHasOffers) {
  if (!cards || cards.length <= 1) return;

  const isCustomSortActive = CONFIG.BESTPREISE_MODE_ACTIVE ||
                             CONFIG.SORT_BY_OFFERS === 'discount-desc' ||
                             (pageHasOffers && CONFIG.SORT_BY_OFFERS !== 'none');

  if (!isCustomSortActive) {
    const wasCustomSorted = cards.some(c => {
      const u = getCardSortableUnit(c);
      return u?.style.order || u?.dataset.tpOrigParentId;
    });
    if (!wasCustomSorted) return;
  }

  // Ensure initial order and original parent IDs are recorded on all cards/columns
  cards.forEach((c, idx) => {
    if (!c.dataset.tpInitialOrder) {
      c.dataset.tpInitialOrder = String(idx);
    }
    const item = getCardSortableUnit(c);
    if (item && !item.dataset.tpInitialOrder) {
      item.dataset.tpInitialOrder = String(idx);
      const parent = item.parentElement;
      if (parent) {
        if (!parent.id && !parent.dataset.tpParentId) {
          parent.dataset.tpParentId = 'tp-p-' + Math.random().toString(36).slice(2, 9);
        }
        item.dataset.tpOrigParentId = parent.id || parent.dataset.tpParentId;
      }
    }
  });

  // Find all rows that actually contain product cards (strictly scopes to product rows, never sidebar/tabs/header)
  const productRows = Array.from(new Set(cards.map(c => getCardSortableUnit(c)?.parentElement).filter(r => r && !r.closest('header, nav, footer, .breadcrumb, #tp-suite-filter-bar, .Plugin_ProductHistoryDropdown, .AbstractDropDown, #Plugin_MainHead, .DropDownMenuList'))));
  if (productRows.length === 0) return;

  const primaryRow = productRows[0];

  if (isCustomSortActive) {
    let sortedEntries = [];

    if (CONFIG.BESTPREISE_MODE_ACTIVE) {
      const scored = cards.map(c => {
        const cd = extractCardData(c);
        const dealData = computeDealScore(cd.stats, cd.cardPrice);
        let score = -100;
        if (dealData) {
          score = dealData.score;
        } else if (!cd.stats) {
          score = 0;
        }
        return {
          card: c,
          item: getCardSortableUnit(c),
          score,
          initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
        };
      });
      scored.sort((a, b) => (b.score - a.score) || (a.initialOrder - b.initialOrder));
      sortedEntries = scored;
    } else if (CONFIG.SORT_BY_OFFERS === 'discount-desc') {
      const scored = cards.map(c => ({
        card: c,
        item: getCardSortableUnit(c),
        disc: extractCardDiscount(c) ?? -1,
        initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
      }));
      scored.sort((a, b) => (b.disc - a.disc) || (a.initialOrder - b.initialOrder));
      sortedEntries = scored;
    } else if (pageHasOffers && CONFIG.SORT_BY_OFFERS !== 'none') {
      const scored = cards.map(c => ({
        card: c,
        item: getCardSortableUnit(c),
        count: extractOfferCount(c),
        initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
      }));
      scored.sort((a, b) => CONFIG.SORT_BY_OFFERS === 'desc' ? (b.count - a.count) : (a.count - b.count));
      sortedEntries = scored;
    }

    // Deduplicate by item so grouped collection items appearing for multiple child cards are only moved once
    const seenItems = new Set();
    const uniqueEntries = [];
    for (const entry of sortedEntries) {
      if (entry.item && !seenItems.has(entry.item)) {
        seenItems.add(entry.item);
        uniqueEntries.push(entry);
      }
    }
    sortedEntries = uniqueEntries;

    // Move sortable items into primaryRow and apply CSS flex order
    sortedEntries.forEach((entry, rank) => {
      const item = entry.item;
      if (item) {
        if (item.parentElement !== primaryRow) {
          primaryRow.appendChild(item);
        }
        if (item.style.order !== String(rank)) {
          item.style.setProperty('order', String(rank), 'important');
        }
      }
    });

    // Ensure DOM order inside primaryRow matches sortedEntries order without unnecessary detach/re-attach
    const currentChildren = Array.from(primaryRow.children);
    const targetItems = sortedEntries.map(e => e.item).filter(Boolean);
    let domOrderMatches = true;
    for (let i = 0; i < targetItems.length; i++) {
      if (currentChildren[i] !== targetItems[i]) {
        domOrderMatches = false;
        break;
      }
    }
    if (!domOrderMatches) {
      targetItems.forEach((item, idx) => {
        if (primaryRow.children[idx] !== item) {
          primaryRow.insertBefore(item, primaryRow.children[idx] || null);
        }
      });
    }

    // Hide empty secondary product rows
    if (productRows.length > 1) {
      productRows.slice(1).forEach(r => {
        if (!r.querySelector('.Plugin_Product, .mixedBrowsingListProduct')) {
          r.style.setProperty('display', 'none', 'important');
          r.classList.add('tp-empty-product-row-hidden');
        }
      });
    }
  } else {
    // Natural order restoration: return items to original parents in initial order
    const itemsToRestore = cards.map(c => {
      const item = getCardSortableUnit(c);
      return {
        card: c,
        item,
        initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10),
        origParentId: item?.dataset.tpOrigParentId
      };
    });

    itemsToRestore.sort((a, b) => a.initialOrder - b.initialOrder);

    const allOrigParents = Array.from(new Set(itemsToRestore.map(entry => {
      if (!entry.origParentId) return entry.item?.parentElement;
      return document.getElementById(entry.origParentId) ||
             document.querySelector(`[data-tp-parent-id="${entry.origParentId}"]`) ||
             entry.item?.parentElement;
    }).filter(Boolean)));

    itemsToRestore.forEach(entry => {
      const item = entry.item;
      if (!item) return;
      if (item.style.order) {
        item.style.removeProperty('order');
      }

      if (entry.origParentId) {
        let origParent = document.getElementById(entry.origParentId) ||
                         document.querySelector(`[data-tp-parent-id="${entry.origParentId}"]`);
        if (origParent && item.parentElement !== origParent) {
          origParent.appendChild(item);
        }
      }
    });

    // Ensure each product row has its children in initial order and unhide without redundant re-appends
    allOrigParents.forEach(row => {
      const children = Array.from(row.children).filter(ch => ch.dataset.tpInitialOrder !== undefined);
      const isAlreadySorted = children.every((ch, i) => i === 0 || parseInt(ch.dataset.tpInitialOrder || '0', 10) >= parseInt(children[i - 1].dataset.tpInitialOrder || '0', 10));
      if (!isAlreadySorted) {
        children.sort((a, b) => parseInt(a.dataset.tpInitialOrder || '0', 10) - parseInt(b.dataset.tpInitialOrder || '0', 10));
        children.forEach((ch, idx) => {
          if (row.children[idx] !== ch) {
            row.insertBefore(ch, row.children[idx] || null);
          }
        });
      }
      if (row.style.display === 'none') {
        row.style.removeProperty('display');
      }
      row.classList.remove('tp-empty-product-row-hidden');
    });
  }
}

