import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setTextIfChanged } from '../../src/ui/badges.js';

describe('Badges helpers', () => {
  describe('setTextIfChanged', () => {
    it('sets text when different', () => {
      const el = { textContent: 'old' };
      setTextIfChanged(el, 'new');
      assert.equal(el.textContent, 'new');
    });

    it('skips the write when text is identical', () => {
      let writes = 0;
      const el = {};
      Object.defineProperty(el, 'textContent', {
        get: () => 'same',
        set: () => { writes++; },
        configurable: true
      });
      setTextIfChanged(el, 'same');
      assert.equal(writes, 0);
    });

    it('ignores null element', () => {
      assert.doesNotThrow(() => setTextIfChanged(null, 'x'));
    });
  });
});
