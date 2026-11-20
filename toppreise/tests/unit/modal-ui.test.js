import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMockNode } from './helpers.js';

describe('UI modal & controls', () => {
  it('bindDiagTrigger is idempotent on the same fabButton', async () => {
    const { bindDiagTrigger } = await import('../../src/ui/diag-modal.js');
    const fab = createMockNode('button');
    const shadow = createMockNode('div');
    bindDiagTrigger(fab, shadow);
    const countAfterFirst = (fab._listeners.click || []).length;
    bindDiagTrigger(fab, shadow);
    assert.equal((fab._listeners.click || []).length, countAfterFirst);
    assert.equal(fab.dataset.tpDiagBound, '1');
  });

  it('closeSharePreviewModal invokes previous onCancel idempotently', async () => {
    const { openSharePreviewModal, closeSharePreviewModal } = await import('../../src/ui/modal-share-preview.js');
    const prevDoc = globalThis.document;
    globalThis.document = {
      createElement: (tag) => createMockNode(tag),
      getElementById: () => null,
      body: createMockNode('body'),
      documentElement: createMockNode('html'),
      head: createMockNode('head'),
    };
    try {
      let cancelCount = 0;
      openSharePreviewModal({
        channels: [],
        onCancel: () => { cancelCount++; },
      });
      closeSharePreviewModal();
      closeSharePreviewModal();
      assert.equal(cancelCount, 1);
    } finally {
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });

  it('mini-toggle syncMiniToggle and paintCycleButton update button state', async () => {
    const { syncMiniToggle, paintCycleButton } = await import('../../src/ui/mini-toggle.js');
    const stateEl = createMockNode('span');
    stateEl.className = 'tp-mini-state';
    const label = createMockNode('label');
    label.className = 'tp-mini-switch';
    label.appendChild(stateEl);
    const input = createMockNode('input');
    input.closest = (sel) => (sel === '.tp-mini-switch' ? label : null);
    syncMiniToggle(input, true, 'Filter');
    assert.equal(input.checked, true);
    assert.equal(label.title, 'Filter AN');
    assert.equal(stateEl.textContent, 'ON');
    syncMiniToggle(input, false, 'Filter');
    assert.equal(input.checked, false);
    assert.equal(stateEl.textContent, 'OFF');

    const btn = createMockNode('button');
    paintCycleButton(btn, 'hide');
    assert.equal(btn.textContent, 'Verbergen');
    assert.equal(btn.classList.contains('tp-state-hide'), true);
    assert.equal(btn.classList.contains('tp-active'), true);
  });

  it('fresh-dismiss markFreshVerified, armFreshDismiss, and clearFresh manage scanState', async () => {
    const { markFreshVerified, armFreshDismiss, clearFresh } = await import('../../src/ui/fresh-dismiss.js');
    const { scanState } = await import('../../src/state/store.js');
    const card = createMockNode('div');
    card.classList.add('tp-deal-fresh');
    const prevDoc = globalThis.document;
    globalThis.document = {
      querySelectorAll: () => [card],
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    try {
      markFreshVerified('p-fresh-1');
      assert.equal(scanState.freshPids.has('p-fresh-1'), true);
      armFreshDismiss();
      assert.ok(scanState.freshUntil > 0);
      clearFresh();
      assert.equal(scanState.freshPids.size, 0);
      assert.equal(scanState.freshUntil, 0);
      assert.equal(card.classList.contains('tp-deal-fresh'), false);
    } finally {
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });
});
