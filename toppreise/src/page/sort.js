/**
 * Grid Sorting Engine
 * Handles flex column reparenting and sorting by offer count, discount percent,
 * and continuous weighted difference, with 100% natural DOM order restoration.
 */

import { CONFIG } from '../state/config.js';
import {
  basisMatchesFor,
  extractCardData,
  extractOfferCount,
  getCardEffectiveDiscount
} from './cards.js';
import { getDisplayDelta, getLevelPct } from '../domain/deal-score.js';
import { hasUsablePriceStats } from '../scanner/cache.js';

// Original placement (no synthetic ids on host parents): item → {parent, placeholder}.
// The placeholder comment marks the exact pre-sort position; restore inserts
// before it when still connected, else appends, then re-sorts by tpInitialOrder.
const origPlacement = new WeakMap();
export function getCardSortableUnit(card) {
  if (!card) return null;
  const collItem = card.closest('.Plugin_ProductCollItem');
  if (collItem) return collItem;
  const parent = card.parentElement;
  if (parent && parent !== document.body && parent.id !== 'product-list' && parent.id !== 'main-content' && !parent.classList?.contains('main-content-col') && !parent.classList?.contains('product-grid') && !parent.classList?.contains('row')) {
    if (Array.from(parent.classList || []).some(c => c.startsWith('col-') || c === 'cell')) {
      return parent;
    }
  }
  return card;
}

let nextInitialOrder = 0;

export function applySorting(cards, pageHasOffers, cardDataList = null) {
  const list = cards || [];

  const isCustomSortActive = CONFIG.BESTPREISE_MODE_ACTIVE ||
                             CONFIG.SORT_BY_OFFERS === 'discount-desc' ||
                             (pageHasOffers && CONFIG.SORT_BY_OFFERS !== 'none');

  if (isCustomSortActive) {
    // Ordering needs 2+ visible cards; restore below must run regardless.
    if (list.length <= 1) return;
  } else {
    // Restore must run even with zero visible cards: getProductCards filters
    // hidden rows, so staging can hide every sorted card at disable time.
    const wasCustomSorted = list.some(c => {
      const u = getCardSortableUnit(c);
      return u?.style.order || (u && origPlacement.has(u));
    }) || (typeof document?.querySelector === 'function' && !!document.querySelector('.tp-empty-product-row-hidden, [data-tp-initial-order]'));
    if (!wasCustomSorted) return;
  }

  // Record initial order on every card plus the original placement of every
  // sortable item — independent of item identity (item === card included).
  list.forEach(c => {
    if (!c.dataset.tpInitialOrder) {
      c.dataset.tpInitialOrder = String(nextInitialOrder++);
    }
    const item = getCardSortableUnit(c);
    if (item) {
      if (!item.dataset.tpInitialOrder) item.dataset.tpInitialOrder = c.dataset.tpInitialOrder;
      if (!origPlacement.has(item) && item.parentElement) {
        // Non-DOM harnesses (unit tests) have no Comment nodes: record the
        // parent anyway; restore falls back to appendChild order.
        const placeholder = typeof document?.createComment === 'function' ? document.createComment('tp-orig') : null;
        if (placeholder) item.after(placeholder);
        origPlacement.set(item, { parent: item.parentElement, placeholder });
      }
    }
  });

  if (isCustomSortActive) {
    // Rows derive from visible cards — active sort only; restore below re-derives instead.
    const productRows = Array.from(new Set(list.map(c => getCardSortableUnit(c)?.parentElement).filter(r => r && !r.closest('header, nav, footer, .breadcrumb, #tp-suite-filter-bar, .Plugin_ProductHistoryDropdown, .AbstractDropDown, #Plugin_MainHead, .DropDownMenuList'))));
    if (productRows.length === 0) return;

    const primaryRow = productRows[0];

    let sortedEntries = [];

    const byCard = cardDataList ? new Map(cardDataList.map(cd => [cd.card, cd])) : null;
    const cdFor = c => byCard?.get(c) || extractCardData(c);
    if (CONFIG.BESTPREISE_MODE_ACTIVE) {
      const scored = list.map(c => {
        const cd = cdFor(c);
        const sortBasisOk = cd.basisMatches ?? basisMatchesFor(cd.stats, cd.cardPriceBasis);
        const vStats = cd.verifiedStats ?? (sortBasisOk ? cd.stats : null);
        const usable = hasUsablePriceStats(vStats);
        const displayDelta = cd.displayDelta ?? (vStats ? getDisplayDelta(cd.cardPrice, vStats) : null);
        const isDeal = !!cd.dealScore || (usable && (displayDelta?.kind === 'at-low' || displayDelta?.kind === 'new-low'));
        const tier = isDeal ? 2 : (usable ? 0 : 1);
        return {
          card: c,
          item: getCardSortableUnit(c),
          tier,
          badgePct: getCardEffectiveDiscount(cd),
          initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
        };
      });
      scored.sort((a, b) => (b.tier - a.tier) || (b.badgePct - a.badgePct) || (a.initialOrder - b.initialOrder));
      sortedEntries = scored;
    } else if (CONFIG.SORT_BY_OFFERS === 'discount-desc') {
      // Verified level (vs Ø-Preis) first; fallback-tief / unverified site Differenz fallback.
      const scored = list.map(c => {
        const cd = cdFor(c);
        const level = getLevelPct(cd.cardPrice, cd.verifiedStats !== undefined ? cd.verifiedStats : cd.stats, true);
        return {
          card: c,
          item: getCardSortableUnit(c),
          disc: level !== null ? -level : getCardEffectiveDiscount(cd),
          initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
        };
      });
      scored.sort((a, b) => (b.disc - a.disc) || (a.initialOrder - b.initialOrder));
      sortedEntries = scored;
    } else if (pageHasOffers && CONFIG.SORT_BY_OFFERS !== 'none') {
      const scored = list.map(c => ({
        card: c,
        item: getCardSortableUnit(c),
        count: extractOfferCount(c),
        initialOrder: parseInt(c.dataset.tpInitialOrder || '0', 10)
      }));
      scored.sort((a, b) => (CONFIG.SORT_BY_OFFERS === 'desc' ? (b.count - a.count) : (a.count - b.count)) || (a.initialOrder - b.initialOrder));
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
    const trailingAnchor = primaryRow.querySelector?.('.Plugin_ProductOfferSeparator, .Plugin_Offer') || null;
    sortedEntries.forEach((entry, rank) => {
      const item = entry.item;
      if (item) {
        if (item.parentElement !== primaryRow) {
          primaryRow.insertBefore(item, trailingAnchor);
        }
        const flexOrder = String(rank - sortedEntries.length);
        if (item.style.order !== flexOrder) {
          item.style.setProperty('order', flexOrder, 'important');
        }
      }
    });

    // Ensure DOM order inside primaryRow matches sortedEntries order without unnecessary detach/re-attach
    const currentChildren = Array.from(primaryRow.children);
    const targetItems = sortedEntries.map(e => e.item).filter(Boolean);
    const cardIndices = currentChildren.map((c, i) => targetItems.includes(c) ? i : -1).filter(i => i !== -1);
    let domOrderMatches = cardIndices.length === targetItems.length;
    if (domOrderMatches) {
      for (let i = 0; i < targetItems.length; i++) {
        if (currentChildren[cardIndices[i]] !== targetItems[i]) {
          domOrderMatches = false;
          break;
        }
      }
    }
    if (!domOrderMatches) {
      targetItems.forEach((item, idx) => {
        const targetPos = cardIndices[idx];
        if (primaryRow.children[targetPos] !== item) {
          primaryRow.insertBefore(item, primaryRow.children[targetPos] || null);
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
    const itemsToRestore = list.map(c => {
      const item = getCardSortableUnit(c);
      return {
        card: c,
        item,
        initialOrder: parseInt(c.dataset.tpInitialOrder || item?.dataset.tpInitialOrder || '0', 10)
      };
    });
    // cards skips hidden rows (getProductCards filters them), so re-derive
    // hidden previously-sorted units via their tpInitialOrder marker.
    const seenUnits = new Set(itemsToRestore.map(entry => entry.item).filter(Boolean));
    const markedNodes = typeof document?.querySelectorAll === 'function' ? document.querySelectorAll('[data-tp-initial-order]') : [];
    markedNodes.forEach(node => {
      const unit = node.matches?.('.Plugin_Product') ? getCardSortableUnit(node) : node;
      if (!unit || seenUnits.has(unit) || !origPlacement.has(unit)) return;
      seenUnits.add(unit);
      const card = unit.matches?.('.Plugin_Product') ? unit : unit.querySelector?.('.Plugin_Product');
      itemsToRestore.push({
        card: card || node,
        item: unit,
        initialOrder: parseInt(card?.dataset.tpInitialOrder || unit.dataset.tpInitialOrder || '0', 10)
      });
    });

    itemsToRestore.sort((a, b) => a.initialOrder - b.initialOrder);

    const hiddenRows = typeof document?.querySelectorAll === 'function' ? Array.from(document.querySelectorAll('.tp-empty-product-row-hidden')) : [];
    const allOrigParents = Array.from(new Set([...itemsToRestore.map(entry => {
      const saved = entry.item ? origPlacement.get(entry.item) : null;
      return (saved?.parent?.isConnected ? saved.parent : null) || entry.item?.parentElement;
    }), ...hiddenRows.filter(r => r.isConnected)].filter(Boolean)));

    itemsToRestore.forEach(entry => {
      const item = entry.item;
      if (!item) return;
      if (item.style.order) {
        item.style.removeProperty('order');
      }

      const saved = origPlacement.get(item);
      const target = (saved?.parent?.isConnected ? saved.parent : null) || item.parentElement;
      if (target && item.parentElement !== target) {
        if (saved?.placeholder?.isConnected) target.insertBefore(item, saved.placeholder);
        else target.appendChild(item);
      }
    });

    // Ensure each product row has its children in initial order and unhide without redundant re-appends
    allOrigParents.forEach(row => {
      const children = Array.from(row.children).filter(ch => ch.dataset.tpInitialOrder !== undefined);
      const isAlreadySorted = children.every((ch, i) => i === 0 || parseInt(ch.dataset.tpInitialOrder || '0', 10) >= parseInt(children[i - 1].dataset.tpInitialOrder || '0', 10));
      if (!isAlreadySorted) {
        children.sort((a, b) => parseInt(a.dataset.tpInitialOrder || '0', 10) - parseInt(b.dataset.tpInitialOrder || '0', 10));
        const cardIndices = Array.from(row.children).map((c, i) => children.includes(c) ? i : -1).filter(i => i !== -1);
        children.forEach((ch, idx) => {
          const saved = origPlacement.get(ch);
          if (saved?.placeholder?.isConnected && saved.placeholder.parentElement === row) {
            row.insertBefore(ch, saved.placeholder);
          } else {
            const targetPos = cardIndices[idx];
            if (targetPos !== undefined && row.children[targetPos] && row.children[targetPos] !== ch) {
              row.insertBefore(ch, row.children[targetPos]);
            } else {
              row.appendChild(ch);
            }
          }
        });
      }
      // Unhide only script-hidden rows: other inline display:none belongs to the host.
      if (row.classList.contains('tp-empty-product-row-hidden')) {
        row.classList.remove('tp-empty-product-row-hidden');
        row.style.removeProperty('display');
      }
    });
  }
}

