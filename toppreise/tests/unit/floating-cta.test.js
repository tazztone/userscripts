import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ctaStateFor,
  batchCompletionToast,
  THRESHOLD_OPTIONS,
  FLOATING_CTA_ID
} from '../../src/ui/floating-cta.js';

describe('Floating CTA label state machine (pure, no DOM)', () => {
  it('idle state counts unchecked Tiefstpreise with singular/plural', () => {
    assert.deepEqual(ctaStateFor({ unchecked: 11 }), {
      mode: 'idle',
      mainLabel: '🔍 11 Tiefstpreise prüfen',
      subLabel: 'Echte Tiefstpreise verifizieren'
    });
    assert.equal(ctaStateFor({ unchecked: 1 }).mainLabel, '🔍 1 Tiefstpreis prüfen');
  });

  it('scanning state shows live progress and cancel hint', () => {
    assert.deepEqual(ctaStateFor({ unchecked: 8, isScanning: true, completed: 3, total: 11 }), {
      mode: 'scanning',
      mainLabel: '⏳ Prüfe (3/11)',
      subLabel: 'Klicken = Abbrechen'
    });
  });

  it('scanning without totals omits the counter', () => {
    assert.equal(ctaStateFor({ isScanning: true }).mainLabel, '⏳ Prüfe');
  });

  it('done state keeps the CTA visible with a dimmed 0 count', () => {
    assert.deepEqual(ctaStateFor({ unchecked: 0 }), {
      mode: 'done',
      mainLabel: '🔍 0 Tiefstpreise prüfen',
      subLabel: 'Alle geprüft'
    });
  });

  it('scanning takes precedence over the unchecked count', () => {
    assert.equal(ctaStateFor({ unchecked: 5, isScanning: true, completed: 1, total: 5 }).mode, 'scanning');
  });

  it('exposes a stable DOM id and the documented threshold steps', () => {
    assert.equal(FLOATING_CTA_ID, 'tp-floating-check-cta');
    assert.deepEqual(THRESHOLD_OPTIONS, [20, 30, 40, 50, 60]);
  });
});

describe('Batch completion toast message (pure, no DOM)', () => {
  it('formats verified and rejected counts when some are rejected', () => {
    assert.equal(
      batchCompletionToast({ completed: 12, total: 12, fresh: 9, checked: 12 }),
      '9 verifiziert · 3 verworfen'
    );
    assert.equal(
      batchCompletionToast({ completed: 3, total: 3, fresh: 1, checked: 3 }),
      '1 verifiziert · 2 verworfen'
    );
  });

  it('formats plural and singular when all scanned products are verified', () => {
    assert.equal(
      batchCompletionToast({ completed: 12, total: 12, fresh: 12, checked: 12 }),
      '12 Tiefstpreise verifiziert'
    );
    assert.equal(
      batchCompletionToast({ completed: 1, total: 1, fresh: 1, checked: 1 }),
      '1 Tiefstpreis verifiziert'
    );
  });

  it('formats rejected count when none are verified', () => {
    assert.equal(
      batchCompletionToast({ completed: 4, total: 4, fresh: 0, checked: 4 }),
      'Keine Tiefstpreise dabei · 4 verworfen'
    );
    assert.equal(
      batchCompletionToast({ completed: 4, total: 4, fresh: 0, checked: 0 }),
      'Keine Prüfung möglich'
    );
  });

  it('uses completed count on early scan termination', () => {
    assert.equal(
      batchCompletionToast({ completed: 5, total: 12, fresh: 3, checked: 5 }),
      '3 verifiziert · 2 verworfen'
    );
  });

  it('formats empty states when total is zero', () => {
    assert.equal(
      batchCompletionToast({ total: 0, unchecked: 5, minDisc: 30 }),
      'Keine Deals ab ≥30% zum Prüfen'
    );
    assert.equal(
      batchCompletionToast({ total: 0, unchecked: 0 }),
      'Keine ungeprüften Deals vorhanden'
    );
  });
});
