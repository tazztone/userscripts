import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAlarmToast,
  clampAlarmTarget,
  normalizeAlarmDuration
} from '../../src/features/price-alarm.js';

describe('Price Alarm logic & toast formatting', () => {
  it('formats toast with price and duration', () => {
    assert.equal(
      formatAlarmToast('57.49', '730'),
      '🔔 Preisalarm gesetzt: CHF 57.49 (2 Jahre)'
    );
    assert.equal(
      formatAlarmToast(600, '90'),
      '🔔 Preisalarm gesetzt: CHF 600.00 (3 Monate)'
    );
    assert.equal(
      formatAlarmToast('129.90', '180'),
      '🔔 Preisalarm gesetzt: CHF 129.90 (6 Monate)'
    );
    assert.equal(
      formatAlarmToast('85.00', '365'),
      '🔔 Preisalarm gesetzt: CHF 85.00 (1 Jahr)'
    );
  });

  it('normalizes target price input in toast', () => {
    assert.equal(
      formatAlarmToast('CHF 57.49', '730'),
      '🔔 Preisalarm gesetzt: CHF 57.49 (2 Jahre)'
    );
    assert.equal(
      formatAlarmToast(57.4912, '730'),
      '🔔 Preisalarm gesetzt: CHF 57.49 (2 Jahre)'
    );
  });

  it('handles missing or partial parameters gracefully', () => {
    assert.equal(
      formatAlarmToast('57.49', null),
      '🔔 Preisalarm gesetzt: CHF 57.49'
    );
    assert.equal(
      formatAlarmToast(null, '730'),
      '🔔 Preisalarm gesetzt (2 Jahre)'
    );
    assert.equal(
      formatAlarmToast(null, null),
      '🔔 Preisalarm gesetzt'
    );
    assert.equal(
      formatAlarmToast('', ''),
      '🔔 Preisalarm gesetzt'
    );
  });

  it('clamps alarm target percentages safely', () => {
    assert.equal(clampAlarmTarget(0.60), 0.60);
    assert.equal(clampAlarmTarget(0.01), 0.05);
    assert.equal(clampAlarmTarget(1.50), 0.99);
    assert.equal(clampAlarmTarget(NaN), 0.60);
    assert.equal(clampAlarmTarget(null), 0.60);
  });

  it('normalizes alarm duration days', () => {
    assert.equal(normalizeAlarmDuration('90'), '90');
    assert.equal(normalizeAlarmDuration(180), '180');
    assert.equal(normalizeAlarmDuration('365'), '365');
    assert.equal(normalizeAlarmDuration('730'), '730');
    assert.equal(normalizeAlarmDuration('999'), '730');
    assert.equal(normalizeAlarmDuration(null), '730');
  });
});
