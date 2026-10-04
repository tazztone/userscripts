import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ctaStateFor,
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
      subLabel: 'Alle Deals verifiziert'
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
