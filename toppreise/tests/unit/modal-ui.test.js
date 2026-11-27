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

  it('openSharePreviewModal.setError keeps channel buttons disabled before updateContent and re-enables after', async () => {
    const { openSharePreviewModal, closeSharePreviewModal } = await import('../../src/ui/modal-share-preview.js');
    const prevDoc = globalThis.document;
    const body = createMockNode('body');
    const head = createMockNode('head');
    const docEl = createMockNode('html');
    const elementsById = new Map();
    const makeEl = (tag) => {
      const node = createMockNode(tag);
      let realId = '';
      Object.defineProperty(node, 'id', {
        get: () => realId,
        set: v => {
          if (realId) elementsById.delete(realId);
          realId = v;
          if (v) elementsById.set(v, node);
        }
      });
      return node;
    };
    globalThis.document = {
      createElement: makeEl,
      getElementById: id => elementsById.get(id) || null,
      body,
      documentElement: docEl,
      head,
    };
    try {
      const loadingEl = createMockNode('div');
      loadingEl.id = 'tp-share-preview-loading';
      const errorEl = createMockNode('div');
      errorEl.id = 'tp-share-preview-error';
      const btn = createMockNode('button');
      btn.className = 'tp-share-channel-btn';
      btn.dataset.channelId = 'c1';
      btn.disabled = true;

      const origCreate = globalThis.document.createElement;
      globalThis.document.createElement = (tag) => {
        const node = origCreate(tag);
        if (tag === 'dialog') {
          node.querySelector = (sel) => {
            if (sel === '#tp-share-preview-loading') return loadingEl;
            if (sel === '#tp-share-preview-error') return errorEl;
            return null;
          };
          node.querySelectorAll = (sel) => (sel === '.tp-share-channel-btn' ? [btn] : []);
        }
        return node;
      };

      const controller = openSharePreviewModal({
        channels: [{ id: 'c1', name: 'Deals' }]
      });
      assert.ok(controller);

      controller.setError('Prep failed');
      assert.equal(loadingEl.style.display, 'none');
      assert.equal(errorEl.textContent, 'Prep failed');
      assert.equal(btn.disabled, true);

      controller.updateContent({ formattedContent: 'Deal ready' });
      assert.equal(btn.disabled, false);

      controller.setError('Send failed');
      assert.equal(btn.disabled, false);
    } finally {
      closeSharePreviewModal();
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

  it('fresh-glow keeps marked pids for the tab session', async () => {
    const { markFreshVerified } = await import('../../src/ui/fresh-glow.js');
    const { scanState } = await import('../../src/state/store.js');
    scanState.freshPids.clear();
    markFreshVerified('p-fresh-1');
    markFreshVerified('p-fresh-2');
    markFreshVerified('p-fresh-1');
    assert.deepEqual([...scanState.freshPids].sort(), ['p-fresh-1', 'p-fresh-2']);
    scanState.freshPids.clear();
  });
});
