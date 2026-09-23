import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SELECTORS } from '../../src/page/selectors.js';

describe('Central Selector Registry', () => {
  it('is deeply immutable', () => {
    assert.ok(Object.isFrozen(SELECTORS));
    assert.ok(Object.isFrozen(SELECTORS.cards));
    assert.ok(Object.isFrozen(SELECTORS.price));
    assert.ok(Object.isFrozen(SELECTORS.layout));
    assert.ok(Object.isFrozen(SELECTORS.layout.containers));
  });

  it('contains expected card selectors', () => {
    assert.ok(typeof SELECTORS.cards.standard === 'string' && SELECTORS.cards.standard.length > 0);
    assert.ok(typeof SELECTORS.cards.collections === 'string');
    assert.ok(typeof SELECTORS.cards.dealerRows === 'string');
    assert.ok(typeof SELECTORS.cards.diffBadge === 'string');
  });

  it('contains expected price selectors', () => {
    assert.ok(typeof SELECTORS.price.mainInfo === 'string');
    assert.ok(typeof SELECTORS.price.shipping === 'string');
    assert.ok(typeof SELECTORS.price.product === 'string');
  });

  it('contains layout container list', () => {
    assert.ok(Array.isArray(SELECTORS.layout.containers));
    assert.ok(SELECTORS.layout.containers.length > 0);
  });
});
