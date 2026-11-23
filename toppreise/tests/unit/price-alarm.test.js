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
});
