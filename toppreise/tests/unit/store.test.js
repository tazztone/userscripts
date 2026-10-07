import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scanState } from '../../src/state/store.js';

describe('Runtime State Store', () => {
  it('reads and writes scan state as a shared mutable object', () => {
    Object.assign(scanState, { isBatchChecking: true, currentlyScanningPid: '99999' });
    assert.equal(scanState.isBatchChecking, true);
    assert.equal(scanState.currentlyScanningPid, '99999');

    // Reset
    Object.assign(scanState, { isBatchChecking: false, currentlyScanningPid: null });
    assert.equal(scanState.isBatchChecking, false);
  });
});
