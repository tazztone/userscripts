import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDistinctProductIds, extractCardDiff, extractCardDiscount, getHeatmapStyles, getBadgeHeatStyle } from '../../src/page/cards.js';

describe('Page & Card Layer - Container Defense & Heatmap', () => {
  describe('getDistinctProductIds', () => {
    it('returns empty array for invalid inputs', () => {
      assert.deepStrictEqual(getDistinctProductIds(null), []);
      assert.deepStrictEqual(getDistinctProductIds({}), []);
    });

    it('extracts single product ID across duplicate links on the same card', () => {
      const card = {
        tagName: 'DIV',
        querySelectorAll: () => [
          { getAttribute: () => '/preisvergleich/Test-Product-p12345', href: '/preisvergleich/Test-Product-p12345', closest: () => null },
          { getAttribute: () => '/preisvergleich/Test-Product-p12345', href: '/preisvergleich/Test-Product-p12345', closest: () => null }
        ]
      };
      const ids = getDistinctProductIds(card);
      assert.deepStrictEqual(ids, ['12345']);
    });

    it('detects multiple distinct product IDs in container element', () => {
      const container = {
        tagName: 'DIV',
        querySelectorAll: () => [
          { getAttribute: () => '/preisvergleich/Prod-A-p100', href: '/preisvergleich/Prod-A-p100', closest: () => null },
          { getAttribute: () => '/preisvergleich/Prod-B-p200', href: '/preisvergleich/Prod-B-p200', closest: () => null }
        ]
      };
      const ids = getDistinctProductIds(container);
      assert.strictEqual(ids.length, 2);
      assert.ok(ids.includes('100'));
      assert.ok(ids.includes('200'));
    });
  });

  describe('extractCardDiff & extractCardDiscount', () => {
    it('parses negative percentage as discount', () => {
      const card = {
        dataset: {},
        querySelector: () => ({ textContent: '-42%' }),
        textContent: '-42%'
      };
      assert.strictEqual(extractCardDiff(card), -42);
      assert.strictEqual(extractCardDiscount(card), 42);
    });

    it('parses positive percentage as markup and normalizes zero', () => {
      const card1 = {
        dataset: {},
        querySelector: () => ({ textContent: '+15%' }),
        textContent: '+15%'
      };
      assert.strictEqual(extractCardDiff(card1), 15);
      assert.strictEqual(extractCardDiscount(card1), -15);

      const card2 = {
        dataset: {},
        querySelector: () => ({ textContent: '0%' }),
        textContent: '0%'
      };
      assert.strictEqual(extractCardDiff(card2), 0);
      assert.strictEqual(extractCardDiscount(card2), 0);
      assert.strictEqual(Object.is(extractCardDiff(card2), -0), false);
    });
  });

  describe('getHeatmapStyles continuous spectrum', () => {
    it('returns red heat for deep discount (-100% or more)', () => {
      const styles = getHeatmapStyles(-100);
      assert.ok(styles.bg.includes('linear-gradient'));
      assert.ok(styles.border.includes('rgba'));
      assert.ok(styles.glow !== 'none');
    });

    it('renders neutral gray for markups and parity (no cold blue)', () => {
      const markup = getHeatmapStyles(100);
      const parity = getHeatmapStyles(0);
      assert.ok(markup.bg.includes('linear-gradient'));
      assert.strictEqual(markup.bg, parity.bg);
      assert.strictEqual(markup.glow, 'none');
    });

    it('returns neutral slate for parity (0%)', () => {
      const styles = getHeatmapStyles(0);
      assert.ok(styles.bg.includes('linear-gradient'));
      assert.strictEqual(styles.glow, 'none');
    });

    it('clamps beyond -100 to max red and beyond +100 to neutral gray', () => {
      const styles1 = getHeatmapStyles(-150);
      const styles2 = getHeatmapStyles(-100);
      assert.strictEqual(styles1.bg, styles2.bg);

      const styles3 = getHeatmapStyles(200);
      const styles4 = getHeatmapStyles(0);
      assert.strictEqual(styles3.bg, styles4.bg);
    });

    it('renders visibly distinct shades for distinct deal sizes (PIMAX vs TRUST)', () => {
      const pim = getHeatmapStyles(-58, 1.0);
      const tru = getHeatmapStyles(-52, 1.0);
      assert.notEqual(pim.bg, tru.bg);
      assert.notEqual(pim.border, tru.border);
    });
  });

  describe('getBadgeHeatStyle (badge reuses the card ramp)', () => {
    it('returns a solid swatch matching the card heat', () => {
      const badge = getBadgeHeatStyle(-58);
      assert.ok(badge.background.startsWith('rgba('));
      assert.ok(!badge.background.includes('gradient'));
      assert.ok(badge.border.startsWith('rgba('));
    });

    it('steps visibly with deal size', () => {
      assert.notEqual(getBadgeHeatStyle(-58).background, getBadgeHeatStyle(-8).background);
    });

    it('renders provisional deals paler', () => {
      assert.notEqual(getBadgeHeatStyle(-58, true).background, getBadgeHeatStyle(-58, false).background);
    });
  });
});
