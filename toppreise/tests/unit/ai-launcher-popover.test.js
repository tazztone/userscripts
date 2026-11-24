import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_OPENROUTER_MODEL } from '../../src/state/config.js';
import { buildLauncherModelOptions } from '../../src/ui/ai-launcher-popover.js';

describe('ai-launcher-popover: buildLauncherModelOptions', () => {
  it('defaults to openrouter/free when no custom or paid model is configured', () => {
    const { options, selectedValue } = buildLauncherModelOptions({
      OPENROUTER_MODEL: '',
      OPENROUTER_PAID_MODEL: ''
    });
    assert.equal(selectedValue, DEFAULT_OPENROUTER_MODEL);
    assert.equal(DEFAULT_OPENROUTER_MODEL, 'openrouter/free');
    assert.deepEqual(options, [
      { value: 'openrouter/free', label: 'openrouter/free (Kostenlos)' }
    ]);
  });

  it('includes custom default first, then openrouter/free, then optional paid model without duplicates', () => {
    const { options, selectedValue } = buildLauncherModelOptions({
      OPENROUTER_MODEL: 'anthropic/claude-sonnet-4',
      OPENROUTER_PAID_MODEL: 'openai/gpt-4.1-mini'
    });
    assert.equal(selectedValue, 'anthropic/claude-sonnet-4');
    assert.deepEqual(options, [
      { value: 'anthropic/claude-sonnet-4', label: 'anthropic/claude-sonnet-4 (Standard)' },
      { value: 'openrouter/free', label: 'openrouter/free (Kostenlos)' },
      { value: 'openai/gpt-4.1-mini', label: 'openai/gpt-4.1-mini (Schnell / Paid)' }
    ]);
  });

  it('deduplicates paid model when it matches default model', () => {
    const { options } = buildLauncherModelOptions({
      OPENROUTER_MODEL: 'openai/gpt-4.1-mini',
      OPENROUTER_PAID_MODEL: 'openai/gpt-4.1-mini'
    });
    assert.equal(options.length, 2);
    assert.equal(options[0].value, 'openai/gpt-4.1-mini');
    assert.equal(options[1].value, 'openrouter/free');
  });
});
