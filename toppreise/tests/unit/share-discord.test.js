import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDiscordWebhookUrl,
  formatDealMessage,
  resolveShareFields,
  sparklineText,
  withLivePrice,
  extractShareData,
  extractDealer,
  parseJsonLdOffer,
  parseProductOffers,
  pickCheapestOffer,
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
describe('withLivePrice', () => {
  it('appends the live card price as the final point', () => {
    const ts = [[1700000000, 25.90], [1700100000, 40.00]];
    const out = withLivePrice(ts, 18.59);
    assert.equal(out.length, 3);
    assert.equal(out[2][1], 18.59);
    assert.equal(ts.length, 2); // never mutates
  });

  it('passes through invalid, empty, or unchanged series', () => {
    assert.equal(withLivePrice(null, 18.59), null);
    assert.deepEqual(withLivePrice([], 18.59), []);
    const ts0 = [[1, 10]];
    assert.equal(withLivePrice(ts0, 0), ts0);
    assert.equal(withLivePrice(ts0, -5), ts0);
    const ts = [[1700000000, 18.59]];
    assert.equal(withLivePrice(ts, 18.59), ts); // already current, no duplicate
  });
});

describe('formatDealMessage', () => {
  it('puts one value per line: link, title, price, dealer, history', () => {
    const msg = formatDealMessage({
      title: 'HyperX Pulsefire Fuse',
      url: PRODUCT_URL,
      priceText: 'CHF 31.90',
      dealer: 'Digitec',
      offerCount: 3,
      spark: '█▁▁',
      prevLowText: 'Bisher: CHF 44.95',
      prevLowPct: 29,
      medianText: 'Ø-Preis (1J): CHF 54.05',
      medianPct: 41
    });
    assert.deepEqual(msg.split('\n'), [
      PRODUCT_URL,
      '🔥 **HyperX Pulsefire Fuse**',
      '💰 **CHF 31.90**',
      '🏬 Händler: **Digitec**',
      '🛒 Angebote: **3**',
      '📊 █▁▁',
      '📉 Bisher: **CHF 44.95** **-29%**',
      '📈 Ø-Preis (1J): **CHF 54.05** **-41%**'
    ]);
  });

  it('omits percentages at/above reference and empty rows, never truncates the link', () => {
    const msg = formatDealMessage({ title: 'Belkin Test', url: PRODUCT_URL, priceText: 'CHF 16.95', dealer: '', offerCount: 0, spark: '', prevLowText: 'Bisher: CHF 10.00', prevLowPct: 0, medianText: '', medianPct: 0 });
    assert.ok(msg.includes('💰 **CHF 16.95**'));
    assert.ok(msg.includes('📉 Bisher: **CHF 10.00**'));
    assert.ok(!msg.includes('%'));
  });

  it('omits empty rows and never truncates the link', () => {
    const msg = formatDealMessage({ title: 'x'.repeat(500), url: PRODUCT_URL, priceText: '', dealer: '', offerCount: 0, spark: '', prevLowText: '', medianText: '' });
    assert.ok(msg.startsWith(PRODUCT_URL + '\n🔥'));
    assert.ok(msg.length <= 2000);
    assert.equal(msg.split('\n').length, 2);
  });
});

describe('resolveShareFields', () => {
  // PHILIPS case from the deals channel: 271.38 vs Bisher 387.00 / Ø 403.00.
  const stats = { tiefstpreis: 271.38, previousLow: 387.00, isNewAllTimeLow: true, medianPrice: 403.00, horizonDays: 365 };

  it('maps record discount to Bisher and median discount to Ø-Preis (never swapped)', () => {
    assert.deepEqual(resolveShareFields(271.38, stats), {
      prevLowText: 'Bisher: CHF 387.00',
      prevLowPct: 30,
      medianText: 'Ø-Preis (1J): CHF 403.00',
      medianPct: 33
    });
  });

  it('renders end to end with one percentage per reference line', () => {
    const msg = formatDealMessage({
      title: 'PHILIPS 5000 Series 34E1C5600AM',
      url: PRODUCT_URL,
      priceText: 'CHF 271.38',
      dealer: '',
      offerCount: 4,
      spark: '',
      ...resolveShareFields(271.38, stats)
    });
    assert.deepEqual(msg.split('\n'), [
      PRODUCT_URL,
      '🔥 **PHILIPS 5000 Series 34E1C5600AM**',
      '💰 **CHF 271.38**',
      '🛒 Angebote: **4**',
      '📉 Bisher: **CHF 387.00** **-30%**',
      '📈 Ø-Preis (1J): **CHF 403.00** **-33%**'
    ]);
  });

  it('hides reference lines at/above the card price', () => {
    assert.deepEqual(resolveShareFields(500, stats), {
      prevLowText: '',
      prevLowPct: 0,
      medianText: '',
      medianPct: 0
    });
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
describe('parseProductOffers / pickCheapestOffer', () => {
  const block = ({ dealer, product, shipping }) => ({
    querySelector: sel => {
      if (sel.startsWith('.Plugin_ShopLogo')) {
        return dealer ? { getAttribute: k => (k === 'alt' || k === 'title' ? dealer : null) } : null;
      }
      if (sel.includes('productPrice')) return product ? { textContent: ` CHF ${product} ` } : null;
      if (sel.includes('shippingPrice')) return shipping ? { textContent: ` CHF ${shipping} ` } : null;
      return null;
    }
  });
  const doc = blocks => ({ querySelectorAll: sel => (sel === '.Plugin_Offer' ? blocks : []) });

  it('reads dealer + both prices per block, drops empty rows', () => {
    const offers = parseProductOffers(doc([
      block({ dealer: 'Amazon.de', product: '15.23', shipping: '20.48' }),
      block({ dealer: '', product: '', shipping: '' }),
    ]));
    assert.deepEqual(offers, [
      { dealer: 'Amazon.de', product: 15.23, shipping: 20.48 },
    ]);
    assert.deepEqual(parseProductOffers(doc([])), []);
    assert.deepEqual(parseProductOffers(null), []);
  });

  it('picks the cheapest on the card price basis, order-independent', () => {
    const offers = [
      { dealer: 'Amazon.de', product: 15.23, shipping: 20.48 },
      { dealer: 'Galaxus', product: 18.00, shipping: 19.00 },
    ];
    assert.deepEqual(pickCheapestOffer(offers, false), { price: 15.23, dealer: 'Amazon.de' });
    assert.deepEqual(pickCheapestOffer([...offers].reverse(), true), { price: 19.00, dealer: 'Galaxus' });
    assert.deepEqual(pickCheapestOffer([], true), { price: 0, dealer: '' });
  });

  it('fetchProductInfo prefers offer blocks over JSON-LD, on card basis', async () => {
    const blocks = [
      block({ dealer: 'Amazon.de', product: '15.23', shipping: '20.48' }),
      block({ dealer: 'Galaxus', product: '18.00', shipping: '19.00' }),
    ];
    const ld = { textContent: JSON.stringify({ '@type': 'Product', offers: { '@type': 'AggregateOffer', offerCount: 9 } }) };
    globalThis.fetch = async () => ({ ok: true, text: async () => '<html></html>' });
    globalThis.DOMParser = class {
      parseFromString() {
        return { querySelectorAll: sel => (sel === '.Plugin_Offer' ? blocks : sel.startsWith('script') ? [ld] : []) };
      }
    };
    try {
      assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50, false), { dealer: 'Amazon.de', offers: 2 });
      assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50, true), { dealer: 'Galaxus', offers: 2 });
    } finally {
      delete globalThis.fetch;
      delete globalThis.DOMParser;
    }
  });
});

describe('parseJsonLdOffer', () => {
  const product = offers => ({ '@context': 'https://schema.org', '@type': 'Product', name: 'x', offers });

  it('picks the cheapest offer seller + count', () => {
    assert.deepEqual(parseJsonLdOffer(product([
      { '@type': 'Offer', price: 44.95, seller: { name: 'Brack' } },
      { '@type': 'Offer', price: 31.90, seller: { name: 'Digitec' } }
    ])), { dealer: 'Digitec', offers: 2 });
  });

  it('finds products inside @graph and wraps single offers', () => {
    assert.deepEqual(
      parseJsonLdOffer({ '@graph': [{ '@type': 'WebSite' }, product({ '@type': 'Offer', price: 10, seller: 'Galaxus' })] }),
      { dealer: 'Galaxus', offers: 1 });
  });

  it('takes the count from AggregateOffer (no sellers), ignores garbage', () => {
    assert.deepEqual(parseJsonLdOffer(product({ '@type': 'AggregateOffer', lowPrice: 5, offerCount: 6 })), { dealer: '', offers: 6 });
    assert.deepEqual(parseJsonLdOffer({ '@type': 'Product' }), { dealer: '', offers: 0 });
    assert.deepEqual(parseJsonLdOffer(null), { dealer: '', offers: 0 });
    assert.deepEqual(parseJsonLdOffer([{ '@type': 'Offer', seller: { name: 'x' } }]), { dealer: '', offers: 0 });
  });
});

describe('fetchProductInfo JSON-LD fallback', () => {
  afterEach(() => {
    delete globalThis.fetch;
    delete globalThis.DOMParser;
  });

  const docStub = ({ rows = [], scripts = [] }) => ({
    querySelectorAll: sel => (sel.startsWith('script') ? scripts : rows)
  });

  it('uses JSON-LD when dealer rows are absent (AJAX-rendered)', async () => {
    const ld = { '@type': 'Product', offers: [
      { price: 44.95, seller: { name: 'Brack' } },
      { price: 31.90, seller: { name: 'Digitec' } }
    ] };
    globalThis.fetch = async () => ({ ok: true, text: async () => '<html/>-x' });
    globalThis.DOMParser = class { parseFromString() { return docStub({ scripts: [{ textContent: JSON.stringify(ld) }] }); } };
    assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50), { dealer: 'Digitec', offers: 2 });
  });

  it('prefers DOM rows over JSON-LD', async () => {
    globalThis.fetch = async () => ({ ok: true, text: async () => '<html/>' });
    globalThis.DOMParser = class {
      parseFromString() { return docStub({ rows: [{ textContent: ' STEG ' }], scripts: [{ textContent: '{"@type":"Product","offers":[]}' }] }); }
    };
    assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50), { dealer: 'STEG', offers: 1 });
  });

  it('survives corrupt JSON-LD without throwing', async () => {
    globalThis.fetch = async () => ({ ok: true, text: async () => '<html/>' });
    globalThis.DOMParser = class { parseFromString() { return docStub({ scripts: [{ textContent: 'kein json{{' }] }); } };
    const debug = console.debug;
    console.debug = () => {};
    try {
      assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50), { dealer: '', offers: 0 });
    } finally { console.debug = debug; }
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
