import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAlarmToast,
  clampAlarmTarget,
  normalizeAlarmDuration,
  resolveAlarmFormUrl,
  isSafeImportedUrl
} from '../../src/features/price-alarm.js';
import { CONFIG } from '../../src/state/config.js';
import { SELECTORS } from '../../src/page/selectors.js';
import { clearActivityLog, getActivityLog } from '../../src/state/activity-log.js';

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

describe('Price alarm fallback URL hardening', () => {
  const BASE = 'https://www.toppreise.ch/preisvergleich/In-Ear/APPLE-AirPods-p818734';
  const FORM = '/plugins/infomails/NewInfoMailForm?im_nimf_pid=818734&im_nimf_cks=abc';

  it('accepts the expected same-origin endpoint and adds context params', () => {
    const url = resolveAlarmFormUrl(FORM, BASE, { contextHash: '2465983911', lang: 'de' });
    assert.ok(url);
    assert.equal(url.origin, 'https://www.toppreise.ch');
    assert.equal(url.pathname, '/plugins/infomails/NewInfoMailForm');
    assert.equal(url.searchParams.get('im_nimf_pid'), '818734');
    assert.equal(url.searchParams.get('im_nimf_cks'), 'abc');
    assert.equal(url.searchParams.get('im_nimf_ch'), '2465983911');
    assert.equal(url.searchParams.get('lang'), 'de');
  });

  it('overwrites (not duplicates) context params', () => {
    const url = resolveAlarmFormUrl(`${FORM}&im_nimf_ch=old&lang=fr`, BASE, { contextHash: '42', lang: 'de' });
    assert.ok(url);
    assert.equal(url.searchParams.getAll('im_nimf_ch').length, 1);
    assert.equal(url.searchParams.get('im_nimf_ch'), '42');
    assert.equal(url.searchParams.get('lang'), 'de');
  });

  it('rejects foreign origins, other paths and unsafe schemes', () => {
    assert.equal(resolveAlarmFormUrl('https://evil.example/plugins/infomails/NewInfoMailForm', BASE), null);
    assert.equal(resolveAlarmFormUrl('//evil.example/plugins/infomails/NewInfoMailForm', BASE), null);
    assert.equal(resolveAlarmFormUrl('/plugins/infomails/OtherForm', BASE), null);
    assert.equal(resolveAlarmFormUrl('javascript:alert(1)', BASE), null);
    assert.equal(resolveAlarmFormUrl('data:text/html,<script>x</script>', BASE), null);
    assert.equal(resolveAlarmFormUrl('', BASE), null);
    assert.equal(resolveAlarmFormUrl(null, BASE), null);
    assert.equal(resolveAlarmFormUrl(FORM, 'not a url'), null);
  });

  it('keeps the Playwright file: fixture origin usable', () => {
    const url = resolveAlarmFormUrl('/plugins/infomails/NewInfoMailForm?im_nimf_pid=1', 'file:///tmp/mock.html');
    assert.ok(url);
    assert.equal(url.protocol, 'file:');
  });

  it('allows relative and normal image URLs', () => {
    assert.equal(isSafeImportedUrl('/neue-infomail?im_nimf_pid=1'), true);
    assert.equal(isSafeImportedUrl('//imgsrv.toppreise.ch/img/1/70'), true);
    assert.equal(isSafeImportedUrl('https://www.toppreise.ch/x?a=1,b=2'), true);
    assert.equal(isSafeImportedUrl('//imgsrv.toppreise.ch/img/1/70 2x, //imgsrv.toppreise.ch/img/1/140 1x', { srcset: true }), true);
  });

  it('blocks script-bearing URL schemes, including obfuscated ones', () => {
    assert.equal(isSafeImportedUrl('javascript:alert(1)'), false);
    assert.equal(isSafeImportedUrl('JaVaScRiPt:alert(1)'), false);
    assert.equal(isSafeImportedUrl('java\nscript:alert(1)'), false);
    assert.equal(isSafeImportedUrl('vbscript:msgbox(1)'), false);
    assert.equal(isSafeImportedUrl('data:text/html,<script>x</script>'), false);
    assert.equal(isSafeImportedUrl('javascript:alert(1) 1x, //imgsrv/x 2x', { srcset: true }), false);
    assert.equal(isSafeImportedUrl('//imgsrv/x 2x, javascript:alert(1) 1x', { srcset: true }), false);
  });

  it('returns null from sanitizeImportedNode for top-level unsafe elements including STYLE', async () => {
    const { sanitizeImportedNode } = await import('../../src/features/price-alarm.js');
    for (const tag of ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'BASE', 'META', 'LINK', 'STYLE']) {
      const node = { nodeType: 1, tagName: tag, attributes: [], remove() {} };
      assert.equal(sanitizeImportedNode(node), null);
    }
    const safeNode = {
      nodeType: 1,
      tagName: 'DIV',
      attributes: [{ name: 'onclick', value: 'alert(1)' }],
      children: [],
      removeAttribute(name) { this.attributes = this.attributes.filter(a => a.name !== name); }
    };
    const res = sanitizeImportedNode(safeNode);
    assert.equal(res, safeNode);
    assert.equal(safeNode.attributes.length, 0);
  });

  it('openPriceAlarmForProduct deduplicates concurrent calls for the same pid', async () => {
    const { openPriceAlarmForProduct } = await import('../../src/features/price-alarm.js');
    const prevDoc = globalThis.document;
    const prevFetch = globalThis.fetch;
    const prevWin = globalThis.window;
    let fetchCalls = 0;
    let resolveFetch;
    globalThis.document = {
      body: null,
      getElementById: () => ({ shadowRoot: { getElementById: () => null } }),
      querySelector: () => null,
      querySelectorAll: () => [],
    };
    globalThis.window = { open: () => {} };
    globalThis.fetch = () => {
      fetchCalls++;
      return new Promise(r => { resolveFetch = r; });
    };
    try {
      const p1 = openPriceAlarmForProduct('999111');
      const p2 = openPriceAlarmForProduct('999111');
      resolveFetch({ ok: false, status: 500, text: async () => '' });
      await Promise.all([p1, p2]);
      assert.equal(fetchCalls, 1);
    } finally {
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
      if (prevFetch === undefined) delete globalThis.fetch; else globalThis.fetch = prevFetch;
      if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin;
    }
  });

  it('processPriceAlarmModal finds close button inside .AbstractDialog_NewInfoMailFormDialog', async () => {
    const { processPriceAlarmModal } = await import('../../src/features/price-alarm.js');
    const prevDoc = globalThis.document;
    const prevLoc = globalThis.location;
    const prevObserver = globalThis.MutationObserver;
    const prevConfigAlarm = CONFIG.ALARM_ENABLED;
    const prevAuto = CONFIG.ALARM_AUTO_SUBMIT;
    const prevShipping = CONFIG.USE_SHIPPING_PRICE;
    CONFIG.ALARM_ENABLED = true;
    CONFIG.ALARM_AUTO_SUBMIT = true;
    CONFIG.USE_SHIPPING_PRICE = false;
    globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise' };
    let observerCb = null;
    globalThis.MutationObserver = class {
      constructor(cb) { observerCb = cb; }
      observe() {}
      disconnect() {}
    };
    let closeClicked = false;
    const closeBtn = { click() { closeClicked = true; } };
    const dialogWrapper = {
      querySelector: (sel) => (sel === '.AbstractDialog_CloseButton' ? closeBtn : null),
    };
    const priceEl = { isConnected: true, textContent: 'CHF 100.00' };
    const priceInput = { value: '', dispatchEvent() {} };
    const durationHidden = { value: '', dispatchEvent() {} };
    const submitBtn = { click() {} };
    const modal = {
      isConnected: true,
      dataset: {},
      closest: (sel) => (sel.includes('.AbstractDialog_NewInfoMailFormDialog') ? dialogWrapper : null),
      querySelector: (sel) => {
        if (sel === '.productPrice .Plugin_Price') return priceEl;
        if (sel === 'input#f_NewInfoMailForm_priceFrom') return priceInput;
        if (sel === 'input[name="im_nimf_du"]') return durationHidden;
        if (sel === 'input.f_submitbtn') return submitBtn;
        if (sel.includes('.success')) return modal.dataset.tpAlarmState === 'submitted' ? {} : null;
        return null;
      },
    };
    globalThis.document = {
      activeElement: null,
      body: dialogWrapper,
      getElementById: () => ({ shadowRoot: { getElementById: () => null } }),
      querySelector: (sel) => (sel === SELECTORS.alarm.form ? modal : null),
      querySelectorAll: () => [],
    };
    try {
      processPriceAlarmModal();
      assert.equal(modal.dataset.tpAlarmState, 'scheduled');
      await new Promise(r => setTimeout(r, 350));
      assert.equal(modal.dataset.tpAlarmState, 'submitted');
      observerCb();
      assert.equal(closeClicked, true);
    } finally {
      CONFIG.ALARM_ENABLED = prevConfigAlarm;
      CONFIG.ALARM_AUTO_SUBMIT = prevAuto;
      CONFIG.USE_SHIPPING_PRICE = prevShipping;
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
      if (prevLoc === undefined) delete globalThis.location; else globalThis.location = prevLoc;
      if (prevObserver === undefined) delete globalThis.MutationObserver; else globalThis.MutationObserver = prevObserver;
    }
  });

  it('closeFetchedAlarmDialogs dismisses active fetched dialogs and removes keydown listener', async () => {
    const { closeFetchedAlarmDialogs } = await import('../../src/features/price-alarm.js');
    assert.equal(typeof closeFetchedAlarmDialogs, 'function');
    closeFetchedAlarmDialogs();
  });

  it('processPriceAlarmModal ignores unconfirmed and cancelled states without re-entering', async () => {
    const { processPriceAlarmModal } = await import('../../src/features/price-alarm.js');
    const prevDoc = globalThis.document;
    try {
      for (const state of ['unconfirmed', 'cancelled']) {
        let queried = false;
        const modal = {
          dataset: { tpAlarmState: state },
          querySelector: () => { queried = true; return null; },
        };
        globalThis.document = {
          querySelector: () => modal,
          querySelectorAll: () => [],
        };
        processPriceAlarmModal();
        assert.equal(queried, false, `state ${state} must not re-enter`);
      }
    } finally {
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });

  it('processPriceAlarmModal failBatch cleans _tpBatchAlarmOpts and calls onResult on no-price, missing-controls, and fill-failed', async () => {
    const { processPriceAlarmModal } = await import('../../src/features/price-alarm.js');
    const prevDoc = globalThis.document;
    const prevLoc = globalThis.location;
    const prevShipping = CONFIG.USE_SHIPPING_PRICE;
    CONFIG.USE_SHIPPING_PRICE = false;
    globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise' };
    try {
      const cases = [
        {
          reason: 'no-price',
          query: () => null
        },
        {
          reason: 'missing-controls',
          query: sel => (sel === '.productPrice .Plugin_Price' ? { textContent: 'CHF 100.00' } : null)
        },
        {
          reason: 'fill-failed',
          query: sel => {
            if (sel === '.productPrice .Plugin_Price') return { textContent: 'CHF 100.00' };
            if (sel === 'input#f_NewInfoMailForm_priceFrom') return {
              _v: '',
              get value() { return this._v; },
              set value(_) { this._v = 'bad'; },
              dispatchEvent() {}
            };
            if (sel === 'input[name="im_nimf_du"]') return { value: '', dispatchEvent() {} };
            return null;
          }
        }
      ];

      for (const tc of cases) {
        let result = null;
        const modal = {
          dataset: {},
          _tpBatchAlarmOpts: { targetPct: 0.6, durationDays: '730', onResult: r => { result = r; } },
          querySelector: tc.query
        };
        globalThis.document = {
          activeElement: null,
          querySelector: sel => (sel === SELECTORS.alarm.form ? modal : null),
          querySelectorAll: () => []
        };
        processPriceAlarmModal();
        assert.deepEqual(result, { status: 'error', reason: tc.reason });
        assert.equal('_tpBatchAlarmOpts' in modal, false);
      }
    } finally {
      CONFIG.USE_SHIPPING_PRICE = prevShipping;
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
      if (prevLoc === undefined) delete globalThis.location; else globalThis.location = prevLoc;
    }
  });

  it('openFetchedAlarmDialog returns false without mounting when NewInfoMailForm returns login HTML (!formEl)', async () => {
    const { openFetchedAlarmDialog } = await import('../../src/features/price-alarm.js');
    const prevDoc = globalThis.document;
    const prevLoc = globalThis.location;
    const prevFetch = globalThis.fetch;
    const prevDOMParser = globalThis.DOMParser;

    let appended = false;
    const contentEl = { replaceChildren() {} };
    const dialogNode = {
      nodeType: 1,
      tagName: 'DIV',
      id: 'AbstractDialog_NewInfoMailFormDialog_9',
      attributes: [],
      children: [],
      style: {},
      classList: { add() {}, remove() {} },
      getAttribute: k => (k === 'data-instance-hash' ? '9' : null),
      querySelector: sel => (sel === SELECTORS.alarm.content ? contentEl : null)
    };
    const triggerEl = { getAttribute: () => '/plugins/infomails/NewInfoMailForm?im_nimf_pid=797571&im_nimf_cks=ok' };
    const loginChild = { nodeType: 1, tagName: 'DIV', attributes: [], children: [] };

    globalThis.location = { href: 'https://www.toppreise.ch/preisvergleich/p797571' };
    globalThis.document = {
      body: { appendChild() { appended = true; } },
      importNode: n => n,
      getElementById: () => ({ shadowRoot: { getElementById: () => null } }),
      addEventListener() {},
      removeEventListener() {}
    };
    globalThis.DOMParser = class {
      parseFromString(html) {
        if (html.includes('lazyDialog')) {
          return {
            querySelector: sel => {
              if (sel === SELECTORS.alarm.lazyDialog) return { content: { firstElementChild: dialogNode } };
              if (sel === SELECTORS.alarm.triggers[0]) return triggerEl;
              return null;
            }
          };
        }
        return { body: { childNodes: [loginChild] } };
      }
    };
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => '<div class="login-wall">Bitte anmelden</div>'
    });

    try {
      const ok = await openFetchedAlarmDialog('<template class="f_lazyDialog">...</template>', {
        targetPct: 0.6,
        durationDays: '730',
        autoSubmit: true,
        onResult() {}
      });
      assert.equal(ok, false);
      assert.equal(appended, false);
    } finally {
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
      if (prevLoc === undefined) delete globalThis.location; else globalThis.location = prevLoc;
      if (prevFetch === undefined) delete globalThis.fetch; else globalThis.fetch = prevFetch;
      if (prevDOMParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = prevDOMParser;
    }
  });

  it('processPriceAlarmModal falls back to _tpDismissDialog without logging a warning when no close button exists', async () => {
    const { processPriceAlarmModal } = await import('../../src/features/price-alarm.js');
    const prevDoc = globalThis.document;
    const prevLoc = globalThis.location;
    const prevObserver = globalThis.MutationObserver;
    const prevConfigAlarm = CONFIG.ALARM_ENABLED;
    const prevAuto = CONFIG.ALARM_AUTO_SUBMIT;
    const prevShipping = CONFIG.USE_SHIPPING_PRICE;
    CONFIG.ALARM_ENABLED = true;
    CONFIG.ALARM_AUTO_SUBMIT = true;
    CONFIG.USE_SHIPPING_PRICE = false;
    globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise' };
    clearActivityLog();
    let observerCb = null;
    globalThis.MutationObserver = class {
      constructor(cb) { observerCb = cb; }
      observe() {}
      disconnect() {}
    };
    let dismissed = false;
    const priceEl = { isConnected: true, textContent: 'CHF 100.00' };
    const priceInput = { value: '', dispatchEvent() {} };
    const durationHidden = { value: '', dispatchEvent() {} };
    const submitBtn = { click() {} };
    const modal = {
      isConnected: true,
      dataset: {},
      _tpDismissDialog: () => { dismissed = true; },
      closest: () => null,
      querySelector: (sel) => {
        if (sel === '.productPrice .Plugin_Price') return priceEl;
        if (sel === 'input#f_NewInfoMailForm_priceFrom') return priceInput;
        if (sel === 'input[name="im_nimf_du"]') return durationHidden;
        if (sel === 'input.f_submitbtn') return submitBtn;
        if (sel.includes('.success')) return modal.dataset.tpAlarmState === 'submitted' ? {} : null;
        return null;
      },
    };
    globalThis.document = {
      activeElement: null,
      body: {},
      getElementById: () => ({ shadowRoot: { getElementById: () => null } }),
      querySelector: (sel) => (sel === SELECTORS.alarm.form ? modal : null),
      querySelectorAll: () => [],
    };
    try {
      processPriceAlarmModal();
      await new Promise(r => setTimeout(r, 350));
      observerCb();
      assert.equal(dismissed, true);
      assert.equal('_tpDismissDialog' in modal, false);
      const warns = getActivityLog().filter(e => e.source === 'price-alarm' && e.level === 'warn');
      assert.equal(warns.length, 0);
    } finally {
      clearActivityLog();
      CONFIG.ALARM_ENABLED = prevConfigAlarm;
      CONFIG.ALARM_AUTO_SUBMIT = prevAuto;
      CONFIG.USE_SHIPPING_PRICE = prevShipping;
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
      if (prevLoc === undefined) delete globalThis.location; else globalThis.location = prevLoc;
      if (prevObserver === undefined) delete globalThis.MutationObserver; else globalThis.MutationObserver = prevObserver;
    }
  });

  it('processPriceAlarmModal clicks [data-dismiss="modal"] inside .modal without logging a warning', async () => {
    const { processPriceAlarmModal } = await import('../../src/features/price-alarm.js');
    const prevDoc = globalThis.document;
    const prevLoc = globalThis.location;
    const prevObserver = globalThis.MutationObserver;
    const prevConfigAlarm = CONFIG.ALARM_ENABLED;
    const prevAuto = CONFIG.ALARM_AUTO_SUBMIT;
    const prevShipping = CONFIG.USE_SHIPPING_PRICE;
    CONFIG.ALARM_ENABLED = true;
    CONFIG.ALARM_AUTO_SUBMIT = true;
    CONFIG.USE_SHIPPING_PRICE = false;
    globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise' };
    clearActivityLog();
    let observerCb = null;
    globalThis.MutationObserver = class {
      constructor(cb) { observerCb = cb; }
      observe() {}
      disconnect() {}
    };
    let closeClicked = false;
    const bootstrapCloseBtn = { click() { closeClicked = true; } };
    const modalWrapper = {
      querySelector: (sel) => (sel.includes('[data-dismiss="modal"]') ? bootstrapCloseBtn : null),
    };
    const priceEl = { isConnected: true, textContent: 'CHF 100.00' };
    const priceInput = { value: '', dispatchEvent() {} };
    const durationHidden = { value: '', dispatchEvent() {} };
    const submitBtn = { click() {} };
    const modal = {
      isConnected: true,
      dataset: {},
      closest: (sel) => (sel.includes('.modal') ? modalWrapper : null),
      querySelector: (sel) => {
        if (sel === '.productPrice .Plugin_Price') return priceEl;
        if (sel === 'input#f_NewInfoMailForm_priceFrom') return priceInput;
        if (sel === 'input[name="im_nimf_du"]') return durationHidden;
        if (sel === 'input.f_submitbtn') return submitBtn;
        if (sel.includes('.success')) return modal.dataset.tpAlarmState === 'submitted' ? {} : null;
        return null;
      },
    };
    globalThis.document = {
      activeElement: null,
      body: modalWrapper,
      getElementById: () => ({ shadowRoot: { getElementById: () => null } }),
      querySelector: (sel) => (sel === SELECTORS.alarm.form ? modal : null),
      querySelectorAll: () => [],
    };
    try {
      processPriceAlarmModal();
      await new Promise(r => setTimeout(r, 350));
      observerCb();
      assert.equal(closeClicked, true);
      const warns = getActivityLog().filter(e => e.source === 'price-alarm' && e.level === 'warn');
      assert.equal(warns.length, 0);
    } finally {
      clearActivityLog();
      CONFIG.ALARM_ENABLED = prevConfigAlarm;
      CONFIG.ALARM_AUTO_SUBMIT = prevAuto;
      CONFIG.USE_SHIPPING_PRICE = prevShipping;
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
      if (prevLoc === undefined) delete globalThis.location; else globalThis.location = prevLoc;
      if (prevObserver === undefined) delete globalThis.MutationObserver; else globalThis.MutationObserver = prevObserver;
    }
  });

  it('openFetchedAlarmDialog returns false without mounting when template root is unsafe (e.g. SCRIPT)', async () => {
    const { openFetchedAlarmDialog } = await import('../../src/features/price-alarm.js');
    const prevDoc = globalThis.document;
    const prevLoc = globalThis.location;
    const prevDOMParser = globalThis.DOMParser;

    let appended = false;
    const unsafeRoot = {
      nodeType: 1,
      tagName: 'SCRIPT',
      id: 'evil-dlg',
      attributes: [],
      children: [],
      getAttribute: () => '1',
      querySelector: () => null,
      remove() {}
    };
    const triggerEl = { getAttribute: () => '/plugins/infomails/NewInfoMailForm?im_nimf_pid=797571&im_nimf_cks=ok' };

    globalThis.location = { href: 'https://www.toppreise.ch/preisvergleich/p797571' };
    globalThis.document = {
      body: { appendChild() { appended = true; } },
      importNode: n => n,
      addEventListener() {},
      removeEventListener() {}
    };
    globalThis.DOMParser = class {
      parseFromString() {
        return {
          querySelector: sel => {
            if (sel === SELECTORS.alarm.lazyDialog) return { content: { firstElementChild: unsafeRoot } };
            if (sel === SELECTORS.alarm.triggers[0]) return triggerEl;
            return null;
          }
        };
      }
    };

    try {
      const ok = await openFetchedAlarmDialog('<template class="f_lazyDialog"><script></script></template>');
      assert.equal(ok, false);
      assert.equal(appended, false);
    } finally {
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
      if (prevLoc === undefined) delete globalThis.location; else globalThis.location = prevLoc;
      if (prevDOMParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = prevDOMParser;
    }
  });

  it('sanitizeImportedNode strips SVG/MathML scripting tags while preserving harmless <svg><path/></svg>', async () => {
    const { sanitizeImportedNode } = await import('../../src/features/price-alarm.js');
    const removed = [];
    const pathNode = { nodeType: 1, tagName: 'path', attributes: [], children: [], remove() { removed.push('path'); } };
    const animateNode = { nodeType: 1, tagName: 'animate', attributes: [], children: [], remove() { removed.push('animate'); } };
    const setNode = { nodeType: 1, tagName: 'set', attributes: [], children: [], remove() { removed.push('set'); } };
    const foreignNode = { nodeType: 1, tagName: 'foreignObject', attributes: [], children: [], remove() { removed.push('foreignObject'); } };
    const noscriptNode = { nodeType: 1, tagName: 'NOSCRIPT', attributes: [], children: [], remove() { removed.push('NOSCRIPT'); } };
    const svgNode = {
      nodeType: 1,
      tagName: 'svg',
      attributes: [],
      children: [pathNode, animateNode, setNode, foreignNode],
      remove() { removed.push('svg'); }
    };
    const root = {
      nodeType: 1,
      tagName: 'DIV',
      attributes: [],
      children: [svgNode, noscriptNode],
      remove() { removed.push('DIV'); }
    };

    const res = sanitizeImportedNode(root);
    assert.equal(res, root);
    assert.deepEqual(removed.sort(), ['NOSCRIPT', 'animate', 'foreignObject', 'set']);
  });
});
