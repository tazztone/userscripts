import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchFeedHtml,
  reconcileFeedCards,
  isFeedRefreshing
} from '../../src/page/feed-refresh.js';

describe('Feed Refresh Engine (feed-refresh.js)', () => {
  describe('isFeedRefreshing', () => {
    it('is false by default', () => {
      assert.equal(isFeedRefreshing(), false);
    });
  });

  describe('fetchFeedHtml', () => {
    it('throws when fetch is unavailable', async () => {
      await assert.rejects(
        () => fetchFeedHtml('https://example.com', null),
        /Fetch API/
      );
    });

    it('returns text when fetch succeeds with 200 OK', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        text: async () => '<html><body>mock</body></html>'
      });
      const html = await fetchFeedHtml('https://example.com/angebote', mockFetch);
      assert.equal(html, '<html><body>mock</body></html>');
    });

    it('throws with status code when fetch returns HTTP error', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      });
      await assert.rejects(
        () => fetchFeedHtml('https://example.com/angebote', mockFetch),
        /HTTP 404/
      );
    });
  });

  describe('reconcileFeedCards', () => {
    it('handles null/undefined inputs gracefully', () => {
      assert.deepEqual(reconcileFeedCards(null, null), { added: 0, updated: 0 });
      assert.deepEqual(reconcileFeedCards({}, null), { added: 0, updated: 0 });
    });

    const createMockCard = (pid, priceText) => {
      const priceSpan = {
        classList: { contains: () => false },
        textContent: priceText,
        matches: () => false,
        closest: () => null
      };
      const priceContainer = {
        innerHTML: `<span class="Plugin_Price">${priceText}</span>`,
        querySelector: (sel) => sel.includes('Price') ? priceSpan : null
      };
      const link = {
        getAttribute: (attr) => attr === 'href' ? `/preisvergleich/Product-p${pid}` : null,
        href: `/preisvergleich/Product-p${pid}`,
        closest: () => null
      };
      const card = {
        tagName: 'A',
        getAttribute: (attr) => attr === 'href' ? `/preisvergleich/Product-p${pid}` : null,
        href: `/preisvergleich/Product-p${pid}`,
        dataset: { entityId: String(pid) },
        classList: {
          classes: new Set(['Plugin_Product']),
          add(c) { this.classes.add(c); },
          contains(c) { return this.classes.has(c); }
        },
        querySelectorAll: (sel) => {
          if (sel.includes('dealerRows')) return [];
          if (sel.includes('productLinks') || sel.includes('a[href]')) return [link];
          if (sel.includes('genericPriceMatch') || sel.includes('Price')) return [priceSpan];
          return [];
        },
        querySelector: (sel) => {
          if (sel.includes('mainInfo') || sel.includes('priceContainer')) return priceContainer;
          if (sel.includes('Price') || sel.includes('genericPriceMatch')) return priceSpan;
          if (sel.includes('nestedCards')) return null;
          return null;
        },
        closest: () => null,
        matches: (sel) => sel.includes('Plugin_Product'),
        parentElement: null
      };
      return card;
    };

    const createMockContainer = (children = []) => {
      const container = {
        children: [...children],
        get firstElementChild() { return this.children[0] || null; },
        parentElement: null,
        matches: (sel) => sel.includes('FrameContent') || sel.includes('standardList'),
        appendChild(node) {
          node.parentElement = this;
          this.children.push(node);
        },
        insertBefore(node, ref) {
          node.parentElement = this;
          const idx = this.children.indexOf(ref);
          if (idx >= 0) {
            this.children.splice(idx, 0, node);
          } else {
            this.children.push(node);
          }
        }
      };
      children.forEach(c => { c.parentElement = container; });
      return container;
    };

    const createMockDoc = (container, cards) => {
      return {
        body: container,
        querySelectorAll: (sel) => {
          if (sel.includes('Plugin_Product')) return cards;
          return [];
        },
        querySelector: (sel) => {
          if (sel.includes('FrameContent') || sel.includes('content') || sel.includes('main')) return container;
          return null;
        },
        importNode: (node) => {
          // Clone mock node
          const clone = { ...node, classList: { ...node.classList, classes: new Set(node.classList.classes) } };
          clone.classList.add = function(c) { this.classes.add(c); };
          clone.classList.contains = function(c) { return this.classes.has(c); };
          return clone;
        }
      };
    };

    it('returns { added: 0, updated: 0 } when incoming doc has no cards', () => {
      const incomingDoc = { querySelectorAll: () => [] };
      const liveDoc = { querySelectorAll: () => [] };
      assert.deepEqual(reconcileFeedCards(incomingDoc, liveDoc), { added: 0, updated: 0 });
    });

    it('returns { added: 0, updated: 0 } when incoming cards are identical to live cards', () => {
      const liveCard = createMockCard('101', '149.00');
      const liveContainer = createMockContainer([liveCard]);
      const liveDoc = createMockDoc(liveContainer, [liveCard]);

      const inCard = createMockCard('101', '149.00');
      const inContainer = createMockContainer([inCard]);
      const inDoc = createMockDoc(inContainer, [inCard]);

      const result = reconcileFeedCards(inDoc, liveDoc);
      assert.deepEqual(result, { added: 0, updated: 0 });
      assert.equal(liveContainer.children.length, 1);
    });

    it('prepends new cards with tp-fresh-arrival class', () => {
      const liveCard = createMockCard('101', '149.00');
      const liveContainer = createMockContainer([liveCard]);
      const liveDoc = createMockDoc(liveContainer, [liveCard]);

      const inCardNew = createMockCard('202', '89.00');
      const inCardOld = createMockCard('101', '149.00');
      const inContainer = createMockContainer([inCardNew, inCardOld]);
      const inDoc = createMockDoc(inContainer, [inCardNew, inCardOld]);

      const result = reconcileFeedCards(inDoc, liveDoc);
      assert.deepEqual(result, { added: 1, updated: 0 });
      assert.equal(liveContainer.children.length, 2);
      // New card should be first
      assert.equal(liveContainer.children[0].dataset.entityId, '202');
      assert.ok(liveContainer.children[0].classList.contains('tp-fresh-arrival'));
      // Existing card should be second
      assert.equal(liveContainer.children[1].dataset.entityId, '101');
    });

    it('updates price and clears cache when an existing card has a changed price', () => {
      const liveCard = createMockCard('101', '149.00');
      liveCard._tpPriceInfo = { cached: true };
      const liveContainer = createMockContainer([liveCard]);
      const liveDoc = createMockDoc(liveContainer, [liveCard]);

      const inCard = createMockCard('101', '119.00');
      const inContainer = createMockContainer([inCard]);
      const inDoc = createMockDoc(inContainer, [inCard]);

      const result = reconcileFeedCards(inDoc, liveDoc);
      assert.deepEqual(result, { added: 0, updated: 1 });
      assert.equal(liveCard._tpPriceInfo, undefined);
    });
  });
});
