import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDiscordWebhookUrl,
  formatDealMessage,
  forumRecipeFor,
  renderLayout,
  validateLayoutRecipe,
  renderDiscordMarkdownPreview,
  layoutOverLimitSuffix,
  DEFAULT_LAYOUT,
  resolveShareFields,
  sparklineText,
  withLivePrice,
  extractShareData,
  extractDealer,
  extractDealerUrl,
  parseJsonLdOffer,
  parseProductOffers,
  pickCheapestOffer,
  fetchProductInfo,
  renderSparklinePng,
  postDealToDiscord,
  postDealImageToDiscord,
  buildThreadName,
  isForumThreadError,
  discordForumFlagKey,
  fetchImageBlob,
  escapeDiscordMarkdown,
} from '../../src/features/share-discord.js';

const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abcDEF123_token-xyz';
const PRODUCT_URL = 'https://www.toppreise.ch/preisvergleich/Maeuse/x-p830749';
const DEALER_URL = 'https://www.toppreise.ch/ext_d-aUS0';

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
  it('sizes hierarchy: ## title link, # price, -# dealer, fused history, bare link last', () => {
    const msg = formatDealMessage({
      title: 'HyperX Pulsefire Fuse',
      url: PRODUCT_URL,
      priceText: 'CHF 31.90',
      dealer: 'Digitec',
      dealerUrl: 'https://www.toppreise.ch/ext_d-aUS0',
      offerCount: 3,
      spark: '█▁▁',
      prevLowText: 'CHF 44.95',
      prevLowPct: 29,
      medianText: 'Ø-Preis (1J): CHF 54.05',
      medianPct: 41
    });
    assert.deepEqual(msg.split('\n'), [
      `## [HyperX Pulsefire Fuse](${PRODUCT_URL})`,
      '# 💰 CHF 31.90',
      '# 🏬 [Digitec](https://www.toppreise.ch/ext_d-aUS0) +3',
      '📊 █▁▁',
      '📉 **CHF 44.95** **-29%**',
      '📈 Ø-Preis (1J): **CHF 54.05** **-41%**',
      PRODUCT_URL
    ]);
  });

  it('falls back to plain dealer name without dealerUrl', () => {
    const msg = formatDealMessage({ title: 'Belkin Test', url: PRODUCT_URL, priceText: 'CHF 16.95', dealer: 'Digitec', offerCount: 0, spark: '', prevLowText: '', medianText: '' });
    assert.ok(msg.includes('# 🏬 Digitec'));
    assert.ok(!msg.includes('[Digitec]('));
  });

  it('omits percentages at/above reference and empty rows, never truncates the link', () => {
    const msg = formatDealMessage({ title: 'Belkin Test', url: PRODUCT_URL, priceText: 'CHF 16.95', dealer: '', offerCount: 0, spark: '', prevLowText: 'CHF 10.00', prevLowPct: 0, medianText: '', medianPct: 0 });
    assert.ok(msg.includes('# 💰 CHF 16.95'));
    assert.ok(msg.includes('📉 **CHF 10.00**'));
    assert.ok(!msg.includes('%'));
  });

  it('omits empty rows and never truncates the link', () => {
    const msg = formatDealMessage({ title: 'x'.repeat(500), url: PRODUCT_URL, priceText: '', dealer: '', offerCount: 0, spark: '', prevLowText: '', medianText: '', suppressProductEmbed: true });
    assert.ok(!msg.includes('🔥'));
    assert.ok(msg.includes(`](${`<${PRODUCT_URL}>`})`));
    assert.ok(msg.length <= 2000);
    assert.equal(msg.split('\n').length, 1);
  });

  it('suppresses each link preview independently via angle brackets', () => {
    const base = { title: 'Belkin Test', url: PRODUCT_URL, priceText: 'CHF 16.95', dealer: 'Digitec', dealerUrl: DEALER_URL, offerCount: 0, spark: '', prevLowText: '', medianText: '' };
    const neither = formatDealMessage(base);
    assert.ok(neither.endsWith(PRODUCT_URL));
    assert.ok(neither.includes(`# 🏬 [Digitec](${DEALER_URL})`));
    assert.ok(!neither.includes('<'));
    const dealerOnly = formatDealMessage({ ...base, suppressDealerEmbed: true });
    assert.ok(dealerOnly.includes(`](<${DEALER_URL}>)`));
    assert.ok(dealerOnly.endsWith(PRODUCT_URL));
    const productOnly = formatDealMessage({ ...base, suppressProductEmbed: true });
    assert.ok(productOnly.includes(`## [Belkin Test](<${PRODUCT_URL}>)`));
    assert.ok(!productOnly.split('\n').some(l => l === PRODUCT_URL || l === `<${PRODUCT_URL}>`));
    assert.ok(productOnly.endsWith(`# 🏬 [Digitec](${DEALER_URL})`));
    const both = formatDealMessage({ ...base, suppressDealerEmbed: true, suppressProductEmbed: true });
    assert.ok(both.includes(`](<${DEALER_URL}>)`));
    assert.ok(both.includes(`## [Belkin Test](<${PRODUCT_URL}>)`));
    assert.ok(!both.split('\n').some(l => l === PRODUCT_URL || l === `<${PRODUCT_URL}>`));
    const long = formatDealMessage({ ...base, title: 'x'.repeat(500), suppressDealerEmbed: true, suppressProductEmbed: true });
    assert.ok(!long.split('\n').some(l => l === PRODUCT_URL || l === `<${PRODUCT_URL}>`));
    assert.ok(long.length <= 2000);
  });
});

describe('resolveShareFields', () => {
  // PHILIPS case from the deals channel: 271.38 vs Bisher 387.00 / Ø 403.00.
  const stats = { tiefstpreis: 271.38, previousLow: 387.00, isNewAllTimeLow: true, medianPrice: 403.00, horizonDays: 365 };

  it('maps record discount to Bisher and median discount to Ø-Preis (never swapped)', () => {
    assert.deepEqual(resolveShareFields(271.38, stats), {
      prevLowText: 'CHF 387.00',
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
      `## [PHILIPS 5000 Series 34E1C5600AM](${PRODUCT_URL})`,
      '# 💰 CHF 271.38',
      '# +4',
      '📉 **CHF 387.00** **-30%**',
      '📈 Ø-Preis (1J): **CHF 403.00** **-33%**',
      PRODUCT_URL
    ]);
  });

  it('posts five lines on the default caller path (both previews suppressed)', () => {
    const msg = formatDealMessage({
      title: 'Belkin Test',
      url: PRODUCT_URL,
      priceText: 'CHF 16.95',
      dealer: 'Digitec',
      dealerUrl: DEALER_URL,
      offerCount: 2,
      spark: '',
      prevLowText: 'CHF 10.00',
      prevLowPct: 5,
      medianText: 'Ø-Preis (1J): CHF 20.00',
      medianPct: 10,
      suppressDealerEmbed: true,
      suppressProductEmbed: true
    });
    assert.deepEqual(msg.split('\n'), [
      `## [Belkin Test](<${PRODUCT_URL}>)`,
      '# 💰 CHF 16.95',
      `# 🏬 [Digitec](<${DEALER_URL}>) +2`,
      '📉 **CHF 10.00** **-5%**',
      '📈 Ø-Preis (1J): **CHF 20.00** **-10%**'
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
    assert.deepEqual(extractShareData(null), { title: '', url: '', imageUrl: '' });
  });

  it('picks the card product image, empty when absent', () => {
    const card = stubCard();
    card.__set('.product-image img, .productImage img, .image_container img, .Plugin_Product img, img', { src: 'https://img/u.jpg' });
    assert.equal(extractShareData(card).imageUrl, 'https://img/u.jpg');
    assert.equal(extractShareData(stubCard()).imageUrl, '');
  });

  it('prefers data-src, absolutizes relative src, skips data: URLs', () => {
    globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise' };
    try {
      const lazy = stubCard();
      lazy.__set('.product-image img, .productImage img, .image_container img, .Plugin_Product img, img', { src: '', getAttribute: n => n === 'data-src' ? 'https://img/lazy.jpg' : null });
      assert.equal(extractShareData(lazy).imageUrl, 'https://img/lazy.jpg');
      const rel = stubCard();
      rel.__set('.product-image img, .productImage img, .image_container img, .Plugin_Product img, img', { src: '/images/u.jpg' });
      assert.equal(extractShareData(rel).imageUrl, 'https://www.toppreise.ch/images/u.jpg');
      const inline = stubCard();
      inline.__set('.product-image img, .productImage img, .image_container img, .Plugin_Product img, img', { src: 'data:image/gif;base64,R0lGOD' });
      assert.equal(extractShareData(inline).imageUrl, '');
    } finally {
      delete globalThis.location;
    }
  });

  it('reads the first dealer row title, empty when absent', () => {
    const card = stubCard();
    card.__set('.Plugin_DealerRelProdPriceInfo .title', { textContent: '\n Digitec \n' });
    assert.equal(extractDealer(card), 'Digitec');
    assert.equal(extractDealer(stubCard()), '');
  });

  it('reads the dealer row offer link, absolutized, empty when absent', () => {
    const card = stubCard();
    card.__set('.Plugin_DealerRelProdPriceInfo a[href]', { getAttribute: () => '/ext_de?pid=9&did=1&oid=11' });
    globalThis.location = { href: 'https://www.toppreise.ch/katalog/Maeuse' };
    assert.equal(extractDealerUrl(card), 'https://www.toppreise.ch/ext_de?pid=9&did=1&oid=11');
    delete globalThis.location;
    assert.equal(extractDealerUrl(stubCard()), '');
  });
  it('drops foreign product URLs and non-https dealer links', () => {
    const card = stubCard();
    card.__set('a[href*="/preisvergleich/"]', { getAttribute: () => 'https://evil.example/preisvergleich/x-p9' });
    assert.equal(extractShareData(card).url, '');
    const card2 = stubCard();
    card2.__set('a[href*="/preisvergleich/"]', { getAttribute: () => 'https://www.toppreise.ch/katalog/Maeuse' });
    assert.equal(extractShareData(card2).url, '');
    const d = stubCard();
    d.__set('.Plugin_DealerRelProdPriceInfo a[href]', { getAttribute: () => 'http://dealer.example/buy' });
    assert.equal(extractDealerUrl(d), '');
  });
});

describe('fetchProductInfo', () => {
  afterEach(() => {
    delete globalThis.fetch;
    delete globalThis.DOMParser;
  });

  it('returns empty info without fetch/DOM or for bad URLs', async () => {
    assert.deepEqual(await fetchProductInfo(PRODUCT_URL), { dealer: '', offers: 0, dealerUrl: '' });
    assert.deepEqual(await fetchProductInfo('not-a-url'), { dealer: '', offers: 0, dealerUrl: '' });
  });

  it('reads cheapest dealer + offer count from the product page', async () => {
    globalThis.fetch = async () => ({ ok: true, text: async () => '<html></html>' });
    globalThis.DOMParser = class {
      parseFromString() {
        return { querySelectorAll: () => [{ textContent: ' Digitec ' }, { textContent: 'Brack' }] };
      }
    };
    assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50), { dealer: 'Digitec', offers: 2, dealerUrl: '' });
  });

  it('returns empty info on HTTP errors', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    globalThis.DOMParser = class { parseFromString() { throw new Error('unreachable'); } };
    assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50), { dealer: '', offers: 0, dealerUrl: '' });
  });
});
describe('parseProductOffers / pickCheapestOffer', () => {
  const block = ({ dealer, product, shipping, href }) => ({
    querySelector: sel => {
      if (sel.startsWith('.Plugin_ShopLogo')) {
        return dealer ? { getAttribute: k => (k === 'alt' || k === 'title' ? dealer : null) } : null;
      }
      if (sel.includes('ext_de')) return href ? { getAttribute: () => href } : null;
      if (sel.includes('productPrice')) return product ? { textContent: ` CHF ${product} ` } : null;
      if (sel.includes('shippingPrice')) return shipping ? { textContent: ` CHF ${shipping} ` } : null;
      return null;
    }
  });
  const doc = blocks => ({ querySelectorAll: sel => (sel === '.Plugin_Offer' ? blocks : []) });

  it('reads dealer + both prices per block, drops empty rows', () => {
    const offers = parseProductOffers(doc([
      block({ dealer: 'Amazon.de', product: '15.23', shipping: '20.48', href: '/ext_de?pid=9&did=1&oid=11' }),
      block({ dealer: '', product: '', shipping: '' }),
    ]));
    assert.deepEqual(offers, [
      { dealer: 'Amazon.de', product: 15.23, shipping: 20.48, url: '/ext_de?pid=9&did=1&oid=11' },
    ]);
    assert.deepEqual(parseProductOffers(doc([])), []);
    assert.deepEqual(parseProductOffers(null), []);
  });

  it('picks the cheapest on the card price basis, order-independent', () => {
    const offers = [
      { dealer: 'Amazon.de', product: 15.23, shipping: 20.48, url: '/ext_de?pid=9&did=1&oid=11' },
      { dealer: 'Galaxus', product: 18.00, shipping: 19.00, url: '/ext_de?pid=9&did=2&oid=22' },
    ];
    assert.deepEqual(pickCheapestOffer(offers, false), { price: 15.23, dealer: 'Amazon.de', url: '/ext_de?pid=9&did=1&oid=11' });
    assert.deepEqual(pickCheapestOffer([...offers].reverse(), true), { price: 19.00, dealer: 'Galaxus', url: '/ext_de?pid=9&did=2&oid=22' });
    assert.deepEqual(pickCheapestOffer([], true), { price: 0, dealer: '', url: '' });
  });

  it('fetchProductInfo prefers offer blocks over JSON-LD, on card basis', async () => {
    const blocks = [
      block({ dealer: 'Amazon.de', product: '15.23', shipping: '20.48', href: '/ext_de?pid=9&did=1&oid=11' }),
      block({ dealer: 'Galaxus', product: '18.00', shipping: '19.00', href: '/ext_de?pid=9&did=2&oid=22' }),
    ];
    const ld = { textContent: JSON.stringify({ '@type': 'Product', offers: { '@type': 'AggregateOffer', offerCount: 9 } }) };
    globalThis.fetch = async () => ({ ok: true, text: async () => '<html></html>' });
    globalThis.DOMParser = class {
      parseFromString() {
        return { querySelectorAll: sel => (sel === '.Plugin_Offer' ? blocks : sel.startsWith('script') ? [ld] : []) };
      }
    };
    try {
      assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50, false), { dealer: 'Amazon.de', offers: 2, dealerUrl: 'https://www.toppreise.ch/ext_de?pid=9&did=1&oid=11' });
      assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50, true), { dealer: 'Galaxus', offers: 2, dealerUrl: 'https://www.toppreise.ch/ext_de?pid=9&did=2&oid=22' });
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
    assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50), { dealer: 'Digitec', offers: 2, dealerUrl: '' });
  });

  it('prefers DOM rows over JSON-LD', async () => {
    globalThis.fetch = async () => ({ ok: true, text: async () => '<html/>' });
    globalThis.DOMParser = class {
      parseFromString() { return docStub({ rows: [{ textContent: ' STEG ' }], scripts: [{ textContent: '{"@type":"Product","offers":[]}' }] }); }
    };
    assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50), { dealer: 'STEG', offers: 1, dealerUrl: '' });
  });

  it('survives corrupt JSON-LD without throwing', async () => {
    globalThis.fetch = async () => ({ ok: true, text: async () => '<html/>' });
    globalThis.DOMParser = class { parseFromString() { return docStub({ scripts: [{ textContent: 'kein json{{' }] }); } };
    const debug = console.debug;
    console.debug = () => {};
    try {
      assert.deepEqual(await fetchProductInfo(PRODUCT_URL, 50), { dealer: '', offers: 0, dealerUrl: '' });
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
    assert.deepEqual(JSON.parse(seen.opts.body), { content: '🔥 deal', allowed_mentions: { parse: [] } });
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

  it('sends content with mention-suppression flags', async () => {
    let seen = null;
    globalThis.fetch = async (url, opts) => {
      seen = { url, opts };
      return { ok: true, status: 204 };
    };
    await postDealToDiscord(HOOK, '🔥 deal');
    assert.deepEqual(JSON.parse(seen.opts.body), { content: '🔥 deal', allowed_mentions: { parse: [] } });
  });

  it('sends the product image as embed image when passed', async () => {
    let seen = null;
    globalThis.fetch = async (url, opts) => {
      seen = { url, opts };
      return { ok: true, status: 200 };
    };
    await postDealToDiscord(HOOK, 'hi', { productImageUrl: 'https://img/u.jpg' });
    assert.deepEqual(JSON.parse(seen.opts.body), { content: 'hi', allowed_mentions: { parse: [] }, embeds: [{ image: { url: 'https://img/u.jpg' } }] });
  });

  it('embeds and thread_name coexist', async () => {
    let seen = null;
    globalThis.fetch = async (url, opts) => {
      seen = { url, opts };
      return { ok: true, status: 200 };
    };
    await postDealToDiscord(HOOK, 'hi', { threadName: 'Deal X', productImageUrl: 'https://img/u.jpg' });
    assert.deepEqual(JSON.parse(seen.opts.body), { content: 'hi', allowed_mentions: { parse: [] }, embeds: [{ image: { url: 'https://img/u.jpg' } }], thread_name: 'Deal X' });
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
    const realFetch = globalThis.fetch;
    delete globalThis.fetch;
    try {
      await assert.rejects(postDealImageToDiscord(HOOK, 'hi', new Blob(['x'])), /Kein Multipart-Transport/);
    } finally {
      if (realFetch === undefined) delete globalThis.fetch; else globalThis.fetch = realFetch;
    }
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
    assert.deepEqual(JSON.parse(seen.data.get('payload_json')), { content: '🔥 deal', allowed_mentions: { parse: [] } });
    assert.ok(seen.data.get('file') instanceof Blob);
  });

  it('falls back to fetch multipart when GM is unavailable', async () => {
    delete globalThis.GM_xmlhttpRequest;
    const realFetch = globalThis.fetch;
    let seen = null;
    globalThis.fetch = async (url, opts) => { seen = { url, opts }; return { ok: true }; };
    try {
      await postDealImageToDiscord(HOOK, '🔥 deal', new Blob(['png'], { type: 'image/png' }));
    } finally {
      if (realFetch === undefined) delete globalThis.fetch; else globalThis.fetch = realFetch;
    }
    assert.equal(seen.url, HOOK);
    assert.equal(seen.opts.method, 'POST');
    assert.ok(seen.opts.body instanceof FormData);
  });


  it('rejects on Discord error status', async () => {
    globalThis.GM_xmlhttpRequest = ({ onload }) => onload({ status: 400 });
    await assert.rejects(postDealImageToDiscord(HOOK, 'hi', new Blob(['x'])), /Discord 400/);
  });

  it('sends payload_json with mention-suppression flags', async () => {
    let seen = null;
    globalThis.GM_xmlhttpRequest = opts => {
      seen = opts;
      opts.onload({ status: 200 });
    };
    await postDealImageToDiscord(HOOK, '🔥 deal', new Blob(['png'], { type: 'image/png' }));
    assert.deepEqual(JSON.parse(seen.data.get('payload_json')), { content: '🔥 deal', allowed_mentions: { parse: [] } });
    assert.ok(seen.data.get('file') instanceof Blob);
  });

  it('sends the product image as embed image when passed', async () => {
    let seen = null;
    globalThis.GM_xmlhttpRequest = opts => {
      seen = opts;
      opts.onload({ status: 200 });
    };
    await postDealImageToDiscord(HOOK, 'hi', new Blob(['png']), { productImageUrl: 'https://img/u.jpg' });
    assert.deepEqual(JSON.parse(seen.data.get('payload_json')), { content: 'hi', allowed_mentions: { parse: [] }, embeds: [{ image: { url: 'https://img/u.jpg' } }] });
  });

  it('embeds and thread_name coexist', async () => {
    let seen = null;
    globalThis.GM_xmlhttpRequest = opts => {
      seen = opts;
      opts.onload({ status: 200 });
    };
    await postDealImageToDiscord(HOOK, 'hi', new Blob(['png']), { threadName: 'Deal X', productImageUrl: 'https://img/u.jpg' });
    assert.deepEqual(JSON.parse(seen.data.get('payload_json')), { content: 'hi', allowed_mentions: { parse: [] }, embeds: [{ image: { url: 'https://img/u.jpg' } }], thread_name: 'Deal X' });
  });

  it('sends product bytes as first attachment with inline embeds in order', async () => {
    let seen = null;
    globalThis.GM_xmlhttpRequest = opts => {
      seen = opts;
      opts.onload({ status: 200 });
    };
    await postDealImageToDiscord(HOOK, 'hi', new Blob(['png']), { productImageBlob: new Blob(['product']) });
    assert.deepEqual(JSON.parse(seen.data.get('payload_json')), { content: 'hi', allowed_mentions: { parse: [] }, embeds: [{ image: { url: 'attachment://produkt.png' } }, { image: { url: 'attachment://preisverlauf.png' } }] });
    assert.ok(seen.data.get('files[0]') instanceof Blob);
    assert.ok(seen.data.get('files[1]') instanceof Blob);
    assert.equal(seen.data.get('file'), null);
  });

  it('ignores a non-Blob productImageBlob (single chart file as before)', async () => {
    let seen = null;
    globalThis.GM_xmlhttpRequest = opts => {
      seen = opts;
      opts.onload({ status: 200 });
    };
    await postDealImageToDiscord(HOOK, 'hi', new Blob(['png']), { productImageBlob: 'https://img/u.jpg' });
    assert.deepEqual(JSON.parse(seen.data.get('payload_json')), { content: 'hi', allowed_mentions: { parse: [] } });
    assert.ok(seen.data.get('file') instanceof Blob);
  });
});

describe('fetchImageBlob', () => {
  afterEach(() => {
    delete globalThis.GM_xmlhttpRequest;
  });

  it('resolves the downloaded bytes as Blob', async () => {
    globalThis.GM_xmlhttpRequest = opts => {
      assert.equal(opts.method, 'GET');
      assert.equal(opts.responseType, 'blob');
      opts.onload({ status: 200, response: new Blob(['img']) });
    };
    const blob = await fetchImageBlob('https://www.toppreise.ch/u.jpg');
    assert.ok(blob instanceof Blob);
  });

  it('rejects on bad URL, missing transport, and HTTP errors', async () => {
    await assert.rejects(fetchImageBlob('data:image/gif;base64,x'), /Ungültige Bild-URL/);
    await assert.rejects(fetchImageBlob('https://evil.example/u.jpg'), /Ungültige Bild-URL/);
    delete globalThis.GM_xmlhttpRequest;
    await assert.rejects(fetchImageBlob('https://www.toppreise.ch/u.jpg'), /Kein HTTP-Transport/);
    globalThis.GM_xmlhttpRequest = opts => opts.onload({ status: 404, response: null });
    await assert.rejects(fetchImageBlob('https://www.toppreise.ch/u.jpg'), /Bild-Download 404/);
  });

  it('rejects empty blobs', async () => {
    globalThis.GM_xmlhttpRequest = opts => opts.onload({ status: 200, response: new Blob([]) });
    await assert.rejects(fetchImageBlob('https://www.toppreise.ch/u.jpg'), /Leeres Bild/);
  });
  it('rejects oversized images', async () => {
    globalThis.GM_xmlhttpRequest = opts => opts.onload({ status: 200, response: new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]) });
    await assert.rejects(fetchImageBlob('https://www.toppreise.ch/u.jpg'), /Bild zu groß/);
  });

  it('rejects non-image MIME but accepts missing MIME', async () => {
    globalThis.GM_xmlhttpRequest = opts => opts.onload({ status: 200, response: new Blob(['x'], { type: 'text/plain' }) });
    await assert.rejects(fetchImageBlob('https://www.toppreise.ch/u.jpg'), /Ungültiges Bild/);
    globalThis.GM_xmlhttpRequest = opts => opts.onload({ status: 200, response: new Blob(['x'], { type: 'image/jpeg' }) });
    const blob = await fetchImageBlob('https://www.toppreise.ch/u.jpg');
    assert.ok(blob instanceof Blob);
  });
});

describe('buildThreadName', () => {
  it('collapses whitespace and trims', () => {
    assert.equal(buildThreadName('  Logitech   MX  Master  '), 'Logitech MX Master');
  });
  it('falls back on empty/null', () => {
    assert.equal(buildThreadName('   '), 'Toppreise-Deal');
    assert.equal(buildThreadName(null), 'Toppreise-Deal');
  });
  it('truncates to 100 chars', () => {
    assert.ok(buildThreadName('x'.repeat(150)).length <= 100);
  });
});

describe('isForumThreadError', () => {
  it('true only for Discord 400/405', () => {
    assert.equal(isForumThreadError(new Error('Discord 400')), true);
    assert.equal(isForumThreadError(new Error('Discord 405')), true);
    assert.equal(isForumThreadError(new Error('Discord 429')), false);
    assert.equal(isForumThreadError(new Error('Discord 401')), false);
    assert.equal(isForumThreadError(new Error('Netzwerkfehler')), false);
    assert.equal(isForumThreadError(new Error('Timeout')), false);
    assert.equal(isForumThreadError(null), false);
  });
});

describe('discordForumFlagKey', () => {
  it('deterministic, trimmed, URL-scoped, token-free', () => {
    const a = discordForumFlagKey(HOOK);
    assert.ok(a.startsWith('DISCORD_FORUM:'));
    assert.equal(a, discordForumFlagKey(`  ${HOOK}  `));
    assert.notEqual(a, discordForumFlagKey(HOOK.replace('123456789012345678', '999')));
    assert.equal(a.includes('abcDEF123'), false);
  });
});

describe('thread_name post paths', () => {
  afterEach(() => {
    delete globalThis.GM_xmlhttpRequest;
    delete globalThis.fetch;
  });
  it('postDealToDiscord sends thread_name when passed', async () => {
    let seen = null;
    globalThis.fetch = async (url, opts) => {
      seen = { url, opts };
      return { ok: true, status: 200 };
    };
    await postDealToDiscord(HOOK, 'hi', { threadName: 'Deal X' });
    assert.deepEqual(JSON.parse(seen.opts.body), { content: 'hi', allowed_mentions: { parse: [] }, thread_name: 'Deal X' });
  });

  it('postDealImageToDiscord sends thread_name when passed', async () => {
    let seen = null;
    globalThis.GM_xmlhttpRequest = opts => {
      seen = opts;
      opts.onload({ status: 200 });
    };
    await postDealImageToDiscord(HOOK, 'hi', new Blob(['png']), { threadName: 'Deal X' });
    assert.deepEqual(JSON.parse(seen.data.get('payload_json')), { content: 'hi', allowed_mentions: { parse: [] }, thread_name: 'Deal X' });
  });
  it('never auto-retries: 429 emits exactly one request', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return { ok: false, status: 429 }; };
    await assert.rejects(postDealToDiscord(HOOK, 'hi'), /Discord 429/);
    assert.equal(calls, 1);
  });
});

describe('layout recipe', () => {
  const base = {
    title: 'HyperX Pulsefire Fuse',
    url: PRODUCT_URL,
    priceText: 'CHF 31.90',
    dealer: 'Digitec',
    dealerUrl: DEALER_URL,
    offerCount: 3,
    spark: '█▁▁',
    prevLowText: 'CHF 44.95',
    prevLowPct: 29,
    medianText: 'Ø-Preis (1J): CHF 54.05',
    medianPct: 41
  };
  it('custom order puts the price line first', () => {
    const msg = renderLayout(base, '# {price}\n## {title}');
    assert.deepEqual(msg.split('\n'), ['# 💰 CHF 31.90', `## [HyperX Pulsefire Fuse](${PRODUCT_URL})`]);
  });
  it('split history yields two rows', () => {
    const msg = renderLayout(base, '{prevlow}\n{median}');
    assert.deepEqual(msg.split('\n'), ['📉 **CHF 44.95** **-29%**', '📈 Ø-Preis (1J): **CHF 54.05** **-41%**']);
  });
  it('escapes markdown in title and dealer, link wrapping intact', () => {
    assert.equal(escapeDiscordMarkdown('A *B* _C_'), 'A \\*B\\* \\_C\\_');
    const msg = renderLayout({ title: 'Deal *kracher* _neu_', url: PRODUCT_URL, dealer: 'Shop | Top', dealerUrl: DEALER_URL }, '## {title}\n# {dealer}');
    assert.ok(msg.includes('[Deal \\*kracher\\* \\_neu\\_]('));
    assert.ok(msg.includes('Shop \\| Top'));
  });
  it('unknown tokens vanish', () => {
    assert.ok(!renderLayout(base, 'X {foo} Y').includes('{foo}'));
  });
  it('· drops empty neighbors', () => {
    assert.equal(renderLayout({ ...base, dealer: '', dealerUrl: '' }, '-# {dealer} · {offers}'), '-# 🛒 3 Angebote');
  });
  it('+{offers} renders compact +N', () => {
    assert.equal(renderLayout(base, '# {dealer} +{offers}'), `# 🏬 [Digitec](${DEALER_URL}) +3`);
  });
  it('+{offers} vanishes without trace when offerCount is 0', () => {
    assert.equal(renderLayout({ ...base, offerCount: 0 }, '# {dealer} +{offers}'), `# 🏬 [Digitec](${DEALER_URL})`);
  });
  it('standalone {offers} keeps the long form', () => {
    assert.equal(renderLayout(base, '-# {offers}'), '-# 🛒 3 Angebote');
  });
  it('+{offers} survives an empty dealer', () => {
    assert.equal(renderLayout({ ...base, dealer: '', dealerUrl: '' }, '# {dealer} +{offers}'), '# +3');
  });
  it('marker-only lines drop when the token is empty', () => {
    assert.equal(renderLayout({ ...base, priceText: '' }, '# {price}\n## {title}'), `## [HyperX Pulsefire Fuse](${PRODUCT_URL})`);
  });
  it('blank recipe falls back to the default layout', () => {
    assert.equal(renderLayout(base, '   \n  '), renderLayout(base, DEFAULT_LAYOUT));
    assert.equal(formatDealMessage(base, ''), formatDealMessage(base));
  });
  it('truncation keeps the message within limits and the link intact', () => {
    const msg = formatDealMessage({ ...base, title: 'x'.repeat(500) }, '## {title}\n# {price}\n{prevlow}\n{median}');
    assert.ok(msg.length <= 2000);
    assert.ok(msg.includes(PRODUCT_URL));
  });
  it('config mirror stays in sync with DEFAULT_LAYOUT', async () => {
    const { DEFAULTS } = await import('../../src/state/config.js');
    assert.equal(DEFAULTS.DISCORD_LAYOUT, DEFAULT_LAYOUT);
    for (const line of DEFAULT_LAYOUT.split('\n').slice(1)) assert.match(line, /^[^ \t]/);
  });
});
describe('forum body', () => {
  const base = {
    title: 'HyperX Pulsefire Fuse',
    url: PRODUCT_URL,
    priceText: 'CHF 31.90',
    dealer: 'Digitec',
    dealerUrl: DEALER_URL,
    offerCount: 3,
    spark: '█▁▁',
    prevLowText: 'CHF 44.95',
    prevLowPct: 29,
    medianText: 'Ø-Preis (1J): CHF 54.05',
    medianPct: 41,
    suppressProductEmbed: true
  };
  const forumFields = { ...base, forceLink: true };
  it('default layout: no title, price first, bare link last', () => {
    const msg = formatDealMessage(forumFields, forumRecipeFor(DEFAULT_LAYOUT));
    assert.ok(!msg.includes('HyperX Pulsefire Fuse'));
    const lines = msg.split('\n');
    assert.equal(lines[0], '# 💰 CHF 31.90');
    assert.ok(lines.some(l => l.includes('Digitec')));
    assert.equal(lines[lines.length - 1], PRODUCT_URL);
  });
  it('custom recipe without {link} gains a trailing bare link', () => {
    const msg = formatDealMessage(forumFields, forumRecipeFor('# {price}'));
    assert.deepEqual(msg.split('\n'), ['# 💰 CHF 31.90', PRODUCT_URL]);
  });
  it('inline title keeps the rest of the line', () => {
    const msg = formatDealMessage(forumFields, forumRecipeFor('## {title} {price}'));
    assert.ok(msg.includes('CHF 31.90'));
    assert.ok(!msg.includes('HyperX Pulsefire Fuse'));
  });
  it('normal path still starts with the title link', () => {
    assert.ok(formatDealMessage(base).startsWith(`## [HyperX Pulsefire Fuse](<${PRODUCT_URL}>)`));
  });
});

describe('validateLayoutRecipe', () => {
  it('rejects blank recipes', () => {
    assert.equal(validateLayoutRecipe(''), 'Layout ist leer');
    assert.equal(validateLayoutRecipe('   \n  '), 'Layout ist leer');
  });
  it('dedupes unknown tokens', () => {
    assert.equal(validateLayoutRecipe('## {title}\n{foo} {foo} {bar}'), 'Unbekannte Tokens: {foo}, {bar}');
  });
  it('accepts the default layout', () => {
    assert.equal(validateLayoutRecipe(DEFAULT_LAYOUT), null);
  });
});

describe('renderDiscordMarkdownPreview', () => {
  it('escapes hostile titles', () => {
    const out = renderDiscordMarkdownPreview('## <img src=x onerror=alert(1)>');
    assert.ok(out.includes('&lt;img'));
    assert.ok(!out.includes('<img'));
  });
  it('renders headings, bold, links, bare URLs', () => {
    const out = renderDiscordMarkdownPreview('## [T](https://x.io/a?b=1)\n# **CHF 5**\nhttps://www.toppreise.ch/p');
    assert.ok(out.includes('tp-md-lg'));
    assert.ok(out.includes('<strong>CHF 5</strong>'));
    assert.ok(out.includes('tp-md-link'));
    assert.ok(out.includes('tp-md-url'));
    assert.ok(!out.includes('## ['));
  });
  it('renders suppression-bracket URLs once, without nesting', () => {
    const out = renderDiscordMarkdownPreview('<https://www.toppreise.ch/p>');
    assert.equal(out.match(/tp-md-url/g).length, 1);
  });
});

describe('layoutOverLimitSuffix', () => {
  it('returns empty below the limit', () => {
    assert.equal(layoutOverLimitSuffix(100, DEFAULT_LAYOUT), '');
  });
  it('names title-shrink when the recipe has {title}', () => {
    assert.equal(layoutOverLimitSuffix(2001, '## {title}\n# {price}'), ' — über Limit, Titel wird gekürzt');
  });
  it('names hard truncation without {title}', () => {
    assert.equal(layoutOverLimitSuffix(2001, '# {price}\n{link}'), ' — über Limit, wird hart auf 2000 gekürzt');
  });
});
