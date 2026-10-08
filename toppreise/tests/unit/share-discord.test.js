import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDiscordWebhookUrl,
  formatDealMessage,
  sparklineText,
  extractShareData,
  extractDealer,
  postDealToDiscord
} from '../../src/features/share-discord.js';

const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abcDEF123_token-xyz';

describe('isDiscordWebhookUrl', () => {
  it('accepts standard + ptb/canary webhook URLs', () => {
    assert.equal(isDiscordWebhookUrl(HOOK), true);
    assert.equal(isDiscordWebhookUrl('https://ptb.discord.com/api/webhooks/1/tok'), true);
    assert.equal(isDiscordWebhookUrl('https://canary.discord.com/api/webhooks/1/tok'), true);
  });

  it('rejects garbage, wrong hosts and non-strings', () => {
    assert.equal(isDiscordWebhookUrl(''), false);
    assert.equal(isDiscordWebhookUrl('https://discord.com/channels/1/2'), false);
    assert.equal(isDiscordWebhookUrl('http://discord.com/api/webhooks/1/tok'), false);
    assert.equal(isDiscordWebhookUrl('https://evil.com/api/webhooks/1/tok'), false);
    assert.equal(isDiscordWebhookUrl(null), false);
    assert.equal(isDiscordWebhookUrl(undefined), false);
  });
});

describe('sparklineText', () => {
  it('maps [t, price] pairs to block chars, newest last', () => {
    assert.equal(sparklineText([[1, 100], [2, 50], [3, 100]]), '█▁█');
  });

  it('returns empty for short/invalid series', () => {
    assert.equal(sparklineText([[1, 100]]), '');
    assert.equal(sparklineText(null), '');
    assert.equal(sparklineText('x'), '');
  });
});

describe('formatDealMessage', () => {
  it('puts the product link first, facts and dealer/prices below', () => {
    const msg = formatDealMessage({
      title: 'RTX 5070',
      url: 'https://www.toppreise.ch/preisvergleich/Grafikkarten/x-p123',
      priceText: 'CHF 499.00',
      badgeText: 'Tiefstpreis -21% (Rekord)',
      dealer: 'Digitec',
      offerCount: 12,
      spark: '▁▂█',
      prevLowText: "Bisher: CHF 649.00",
      medianText: 'Ø-Preis (1J): CHF 599.00'
    });
    const lines = msg.split('\n');
    assert.equal(lines[0], 'https://www.toppreise.ch/preisvergleich/Grafikkarten/x-p123');
    assert.ok(lines[1].includes('🔥 **RTX 5070** – CHF 499.00 · Tiefstpreis -21% (Rekord)'));
    assert.ok(msg.includes('Händler: Digitec · Angebote: 12'));
    assert.ok(msg.includes('▁▂█ · Bisher: CHF 649.00 · Ø-Preis (1J): CHF 599.00'));
  });

  it('omits empty rows and never truncates the link', () => {
    const url = 'https://www.toppreise.ch/preisvergleich/X/x-p1';
    const msg = formatDealMessage({ title: 'x'.repeat(500), url, priceText: '', badgeText: '', dealer: '', offerCount: 0, spark: '', prevLowText: '', medianText: '' });
    assert.ok(msg.startsWith(url + '\n'));
    assert.ok(msg.length <= 2000);
    assert.equal(msg.split('\n').length, 2);
  });
});

describe('extractShareData / extractDealer', () => {
  const stubCard = () => {
    const els = {};
    return {
      tagName: 'DIV',
      querySelector: sel => els[sel] || null,
      __set: (sel, el) => { els[sel] = el; }
    };
  };

  it('reads title, absolutizes relative links, tolerates missing nodes', () => {
    const card = stubCard();
    card.__set('.product-name, .productDetails, .bold, a[title]', { textContent: '  Beamer  ' });
    card.__set('a[href*="/preisvergleich/"]', { getAttribute: () => '/preisvergleich/Beamer/x-p9' });
    globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise' };
    const { title, url } = extractShareData(card);
    assert.equal(title, 'Beamer');
    assert.equal(url, 'https://www.toppreise.ch/preisvergleich/Beamer/x-p9');
    delete globalThis.location;
    assert.deepEqual(extractShareData(null), { title: '', url: '' });
  });

  it('reads the first dealer row title, empty when absent', () => {
    const card = stubCard();
    card.__set('.Plugin_DealerRelProdPriceInfo .title', { textContent: '\n Digitec \n' });
    assert.equal(extractDealer(card), 'Digitec');
    assert.equal(extractDealer(stubCard()), '');
  });
});

describe('postDealToDiscord', () => {
  afterEach(() => {
    delete globalThis.GM_xmlhttpRequest;
    delete globalThis.fetch;
  });

  it('rejects invalid webhook URLs without any network call', async () => {
    let called = false;
    globalThis.fetch = async () => { called = true; throw new Error('must not be called'); };
    await assert.rejects(postDealToDiscord('not-a-webhook', 'hi'), /Ungültige Webhook-URL/);
    assert.equal(called, false);
  });

  it('POSTs JSON via fetch fallback and resolves on 2xx', async () => {
    let seen = null;
    globalThis.fetch = async (url, opts) => {
      seen = { url, opts };
      return { ok: true, status: 204 };
    };
    await postDealToDiscord(HOOK, '🔥 deal');
    assert.equal(seen.url, HOOK);
    assert.equal(seen.opts.method, 'POST');
    assert.deepEqual(JSON.parse(seen.opts.body), { content: '🔥 deal' });
  });

  it('rejects on Discord error status', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(postDealToDiscord(HOOK, 'hi'), /Discord 429/);
  });

  it('prefers GM_xmlhttpRequest (CORS-Bypass) when available', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; return { ok: true }; };
    globalThis.GM_xmlhttpRequest = ({ onload }) => onload({ status: 200 });
    await postDealToDiscord(HOOK, 'hi');
    assert.equal(fetchCalled, false);
  });

  it('surfaces GM network errors and timeouts', async () => {
    globalThis.GM_xmlhttpRequest = ({ onerror }) => onerror();
    await assert.rejects(postDealToDiscord(HOOK, 'hi'), /Netzwerkfehler/);
    globalThis.GM_xmlhttpRequest = ({ ontimeout }) => ontimeout();
    await assert.rejects(postDealToDiscord(HOOK, 'hi'), /Timeout/);
  });

  it('rejects without any transport', async () => {
    delete globalThis.GM_xmlhttpRequest;
    const realFetch = globalThis.fetch;
    delete globalThis.fetch;
    try {
      await assert.rejects(postDealToDiscord(HOOK, 'hi'), /Kein HTTP-Transport/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
