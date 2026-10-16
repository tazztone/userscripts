import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { showToast, getLastToastMessage } from '../../src/ui/toast.js';

describe('Toast message recorder', () => {
  it('records last shown toast message', () => {
    showToast('Erster Toast');
    assert.equal(getLastToastMessage(), 'Erster Toast');

    showToast('Zweiter Toast mit Spezialzeichen: 120T & Ø');
    assert.equal(getLastToastMessage(), 'Zweiter Toast mit Spezialzeichen: 120T & Ø');
  });
});
