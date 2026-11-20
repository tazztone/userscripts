const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '../huggingface-heart.user.js');
const scriptCode = fs.readFileSync(scriptPath, 'utf8');

function loadHfExports() {
  const noop = () => {};
  const makeEl = (tag = 'div') => ({
    tagName: tag.toUpperCase(),
    className: '',
    dataset: {},
    style: {},
    children: [],
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop,
    getAttribute: () => null,
    appendChild: noop,
    replaceChildren: noop,
    addEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
  });
  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval: noop,
    URL,
    RegExp,
    Array,
    Object,
    Set,
    Map,
    Math,
    Date,
    JSON,
    Promise,
    GM_getValue: (_k, d) => d,
    GM_setValue: noop,
    GM_registerMenuCommand: noop,
    GM_addStyle: noop,
    localStorage: { getItem: () => null, setItem: noop },
    location: { href: 'https://huggingface.co/models', pathname: '/models', search: '' },
    MutationObserver: class { observe() {} disconnect() {} },
    document: {
      head: makeEl('head'),
      body: makeEl('body'),
      documentElement: makeEl('html'),
      readyState: 'complete',
      createElement: makeEl,
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: noop,
    },
    window: {
      __HF_HEART_TEST_HOOK__: true,
      location: { href: 'https://huggingface.co/models', pathname: '/models', search: '' },
      addEventListener: noop,
    },
  };
  ctx.globalThis = ctx;
  ctx.self = ctx;
  vm.runInNewContext(scriptCode, ctx, { filename: scriptPath });
  return ctx.window.__HF_HEART_EXPORTS__;
}

const { parseNegativeFilter, isCardExcludedByText, findHeartSvg } = loadHfExports();

describe('huggingface-heart.user.js real logic', () => {
  it('parseNegativeFilter strips /g and /y flags so regexes are stateless across cards', () => {
    const matchers = parseNegativeFilter('/gguf/gi; lora');
    assert.equal(matchers.length, 2);
    assert.equal(matchers[0].type, 'regex');
    assert.equal(matchers[0].value.global, false);
    assert.equal(matchers[0].value.sticky, false);
    // Repeatedly test against multiple cards
    assert.equal(isCardExcludedByText({ textContent: 'Model GGUF' }, 'org/model', matchers), true);
    assert.equal(isCardExcludedByText({ textContent: 'Model GGUF' }, 'org/model', matchers), true);
    assert.equal(isCardExcludedByText({ textContent: 'Model LoRA' }, 'org/model', matchers), true);
    assert.equal(isCardExcludedByText({ textContent: 'Model FP16' }, 'org/model', matchers), false);
  });

  it('findHeartSvg handles markedContainer that is itself an <svg>', () => {
    const svgEl = {
      tagName: 'svg',
      getAttribute: (k) => (k === 'viewBox' ? '0 0 24 24' : null),
      querySelector: () => ({ getAttribute: () => 'M22.5 4c-2 0-4 2-4 4' }),
      querySelectorAll: () => [{ getAttribute: () => 'M22.5 4c-2 0-4 2-4 4' }],
      closest: () => null,
    };
    const card = {
      querySelector: () => svgEl,
      querySelectorAll: () => [],
    };
    assert.equal(findHeartSvg(card), svgEl);
  });
});
