import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getScanState,
  setScanState
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

  it('returns a copy, not a live reference', () => {
    const state = getScanState();
    state.isBatchChecking = true;
    assert.equal(getScanState().isBatchChecking, false);
  });
});
