import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDiscordWebhookUrl,
  formatDealMessage,
  sparklineText,
  extractShareData,
  extractDealer,
  fetchProductInfo,
  renderSparklinePng,
  postDealToDiscord,
  postDealImageToDiscord
} from '../../src/features/share-discord.js';

const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abcDEF123_token-xyz';
const PRODUCT_URL = 'https://www.toppreise.ch/preisvergleich/Maeuse/x-p830749';

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

  it('samples evenly across full history instead of the last window', () => {
    const series = Array.from({ length: 100 }, (_, i) => [i, i < 80 ? 100 : 50]);
    assert.equal(sparklineText(series, 20)[0], '█');
    assert.equal(sparklineText(series, 20).slice(-1), '▁');
  });

  it('returns empty for short/invalid series', () => {
    assert.equal(sparklineText([[1, 100]]), '');
    assert.equal(sparklineText(null), '');
    assert.equal(sparklineText('x'), '');
  });
});

describe('formatDealMessage', () => {
  it('puts one value per line: link, title, price, dealer, history', () => {
    const msg = formatDealMessage({
      title: 'HyperX Pulsefire Fuse',
      url: PRODUCT_URL,
      priceText: 'CHF 31.90',
      badgeText: 'Tiefstpreis -41% (Ø-Preis)',
      dealer: 'Digitec',
      offerCount: 3,
      spark: '█▁▁',
      prevLowText: 'Bisher: CHF 44.95',
      medianText: 'Ø-Preis (1J): CHF 54.05'
    });
    assert.deepEqual(msg.split('\n'), [
      PRODUCT_URL,
      '🔥 **HyperX Pulsefire Fuse**',
      '💰 CHF 31.90 · Tiefstpreis -41% (Ø-Preis)',
      '🏬 Händler: Digitec',
      '🛒 Angebote: 3',
      '📊 █▁▁',
      '📉 Bisher: CHF 44.95',
      '📈 Ø-Preis (1J): CHF 54.05'
    ]);
  });

  it('omits empty rows and never truncates the link', () => {
    const msg = formatDealMessage({ title: 'x'.repeat(500), url: PRODUCT_URL, priceText: '', badgeText: '', dealer: '', offerCount: 0, spark: '', prevLowText: '', medianText: '' });
    assert.ok(msg.startsWith(PRODUCT_URL + '\n🔥'));
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

describe('fetchProductInfo', () => {
  afterEach(() => {
    delete globalThis.fetch;
    delete globalThis.DOMParser;
  });

  it('returns empty info without fetch/DOM or for bad URLs', async () => {
    assert.deepEqual(await fetchProductInfo(PRODUCT_URL), { dealer: '', offers: 0 });
    assert.deepEqual(await fetchProductInfo('not-a-url'), { dealer: '', offers: 0 });
  });

  it('reads cheapest dealer + offer count from the product page', async () => {
    globalThis.fetch = async () => ({ ok: true, text: async () => '<html></html>' });
    globalThis.DOMParser = class {
      parseFromString() {
        return { querySelectorAll: () => [{ textContent: ' Digitec ' }, { textContent: 'Brack' }] };
      }
    };
    assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50), { dealer: 'Digitec', offers: 2 });
  });

  it('returns empty info on HTTP errors', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    globalThis.DOMParser = class { parseFromString() { throw new Error('unreachable'); } };
    assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50), { dealer: '', offers: 0 });
  });
});

describe('renderSparklinePng', () => {
  it('returns null without DOM', async () => {
    assert.equal(await renderSparklinePng([[1, 100], [2, 50]]), null);
    assert.equal(await renderSparklinePng(null), null);
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

describe('postDealImageToDiscord', () => {
  afterEach(() => {
    delete globalThis.GM_xmlhttpRequest;
  });

  it('rejects invalid input without network', async () => {
    await assert.rejects(postDealImageToDiscord('nope', 'hi', new Blob(['x'])), /Ungültige Webhook-URL/);
    await assert.rejects(postDealImageToDiscord(HOOK, 'hi', null), /Ungültige Bilddaten/);
  });

  it('rejects without multipart transport', async () => {
    delete globalThis.GM_xmlhttpRequest;
    await assert.rejects(postDealImageToDiscord(HOOK, 'hi', new Blob(['x'])), /Kein Multipart-Transport/);
  });

  it('uploads payload_json + file via GM and resolves on 2xx', async () => {
    let seen = null;
    globalThis.GM_xmlhttpRequest = opts => {
      seen = opts;
      opts.onload({ status: 200 });
    };
    await postDealImageToDiscord(HOOK, '🔥 deal', new Blob(['png'], { type: 'image/png' }));
    assert.equal(seen.method, 'POST');
    assert.equal(seen.url, HOOK);
    assert.ok(seen.data instanceof FormData);
    assert.deepEqual(JSON.parse(seen.data.get('payload_json')), { content: '🔥 deal' });
    assert.ok(seen.data.get('file') instanceof Blob);
  });

  it('rejects on Discord error status', async () => {
    globalThis.GM_xmlhttpRequest = ({ onload }) => onload({ status: 400 });
    await assert.rejects(postDealImageToDiscord(HOOK, 'hi', new Blob(['x'])), /Discord 400/);
  });
});
