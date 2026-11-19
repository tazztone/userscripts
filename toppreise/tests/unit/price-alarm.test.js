import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAlarmToast,
  clampAlarmTarget,
  normalizeAlarmDuration,
  resolveAlarmFormUrl,
  isSafeImportedUrl
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

  it('returns null from sanitizeImportedNode for top-level unsafe elements', async () => {
    const { sanitizeImportedNode } = await import('../../src/features/price-alarm.js');
    for (const tag of ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'BASE', 'META', 'LINK']) {
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
});
