import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getScanState,
  setScanState,
  getFilterCounts,
  setFilterCounts,
  subscribe
} from '../../src/state/store.js';

describe('Runtime State Store', () => {
  it('updates and retrieves scan state patch correctly', () => {
    setScanState({ isBatchChecking: true, currentlyScanningPid: '99999' });
    const state = getScanState();
    assert.equal(state.isBatchChecking, true);
    assert.equal(state.currentlyScanningPid, '99999');

    // Reset
    setScanState({ isBatchChecking: false, currentlyScanningPid: null });
    assert.equal(getScanState().isBatchChecking, false);
  });

  it('updates and retrieves filter counts', () => {
    setFilterCounts({ neg: 5, cat: 2, uncheckedDeals: 10 });
    const counts = getFilterCounts();
    assert.equal(counts.neg, 5);
    assert.equal(counts.cat, 2);
    assert.equal(counts.uncheckedDeals, 10);
  });

  it('notifies subscribers on state mutations', () => {
    const events = [];
    const unsubscribe = subscribe((event, data) => {
      events.push({ event, data });
    });

    setScanState({ isBestpreiseScanning: true });
    assert.ok(events.some(e => e.event === 'scan-state-changed'));

    setFilterCounts({ min: 3 });
    assert.ok(events.some(e => e.event === 'filter-counts-changed'));

    // Unsubscribe
    unsubscribe();
    const countBefore = events.length;
    setScanState({ isBestpreiseScanning: false });
    assert.equal(events.length, countBefore);
  });
});
