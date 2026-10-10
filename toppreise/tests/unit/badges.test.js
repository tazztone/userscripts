import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setTextIfChanged, renderEmptyState } from '../../src/ui/badges.js';
import { CONFIG } from '../../src/state/config.js';
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

describe('renderEmptyState signature skip', () => {
  let realDocument, realMode;

  const fakeDoc = (notice, created) => {
    globalThis.document = {
      getElementById: id => (id === 'tp-empty-state-notice' ? notice : null),
      createElement: () => {
        const el = { dataset: {}, querySelector: () => null };
        created.push(el);
        return el;
      },
      body: { classList: { contains: () => false } }
    };
  };

  // Two cards, both hidden, MODE=hide → sig '2:2:false:0:30:false:false'.
  const setup = () => {
    CONFIG.MODE = 'hide';
    return {
      cards: [{ parentElement: { insertBefore: () => {} } }, {}],
      counts: { bestpreiseDeals: 0, filteredCount: 2, uncheckedHidden: 0, uncheckedDeals: 0 }
    };
  };

  beforeEach(() => {
    realMode = CONFIG.MODE;
    realDocument = globalThis.document;
  });

  afterEach(() => {
    CONFIG.MODE = realMode;
    if (realDocument === undefined) delete globalThis.document; else globalThis.document = realDocument;
  });

  it('skips rebuild when signature matches', () => {
    const { cards, counts } = setup();
    const notice = { dataset: { tpEmptySig: '2:2:false:0:30:false:false' } };
    const created = [];
    fakeDoc(notice, created);
    renderEmptyState(cards, counts);
    assert.equal(created.length, 0);
    assert.equal(notice.dataset.tpEmptySig, '2:2:false:0:30:false:false');
  });

  it('builds notice and stamps signature on first render', () => {
    const { cards, counts } = setup();
    const created = [];
    fakeDoc(null, created);
    renderEmptyState(cards, counts);
    assert.equal(created.length, 1);
    assert.equal(created[0].dataset.tpEmptySig, '2:2:false:0:30:false:false');
  });
});
