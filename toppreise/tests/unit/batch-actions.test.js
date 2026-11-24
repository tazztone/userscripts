import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCardSpecs,
  isComparisonButtonActive,
  collectScopedCards,
  getBatchScopeCounts,
  neutralizeFormulaCell,
  formatBatchMarkdown,
  formatBatchTsv,
  formatBatchCsv,
  buildComparisonPrompt,
  formatComparisonItemLine,
  findUnknownPromptTokens,
  findUnknownSingleSearchTokens,
  COMPARE_PROMPT_TOKENS,
  COMPARE_ITEM_TOKENS,
  buildCompactComparisonPrompt,
  selectExternalComparisonQuery,
  buildExternalAiUrl,
  isBatchConfirmRequired
} from '../../src/features/batch-actions.js';
import { CONFIG } from '../../src/state/config.js';

describe('batch-actions: extractCardSpecs', () => {
  it('extracts .product-features directly on card', () => {
    const feat = {
      querySelectorAll: sel => (sel === 'li' ? [{ textContent: '16 GB RAM' }, { textContent: '512 GB SSD' }] : [])
    };
    const card = {
      querySelector: sel => (sel === '.product-features' ? feat : null)
    };
    assert.equal(extractCardSpecs(card), '16 GB RAM · 512 GB SSD');
  });

  it('falls back to parent .Plugin_ProductCollItem .product-features for collection variants', () => {
    const feat = {
      querySelectorAll: () => [],
      textContent: '27 Zoll • 240 Hz • OLED'
    };
    const collItem = {
      querySelector: sel => (sel.includes('.product-features') ? feat : null)
    };
    const card = {
      querySelector: () => null,
      closest: sel => (sel === '.Plugin_ProductCollItem' ? collItem : null)
    };
    assert.equal(extractCardSpecs(card), '27 Zoll · 240 Hz · OLED');
  });
});

describe('batch-actions: comparison button state', () => {
  it('detects inactive vs active comparison button from data-ser-plgn-data and icon class', () => {
    const mkBtn = (action, iconClass) => ({
      getAttribute: k => (k === 'data-ser-plgn-data' ? JSON.stringify({ pc_atpcbc_action: action }) : null),
      querySelector: () => ({ classList: { contains: c => c === iconClass } }),
      classList: { contains: () => false }
    });
    assert.equal(isComparisonButtonActive(mkBtn('ad', 'inactive')), false);
    assert.equal(isComparisonButtonActive(mkBtn('rm', 'active')), true);
  });
});

describe('batch-actions: export formatters & formula safety', () => {
  const items = [
    {
      title: 'Sony WH-1000XM5',
      priceText: 'CHF 249.00',
      discountText: '-35%',
      lowText: 'CHF 269.00',
      medianText: 'Ø-Preis (1J): CHF 319.00',
      dealer: 'Digitec',
      offerCount: 12,
      specs: 'ANC · 30h Akku',
      url: 'https://www.toppreise.ch/preisvergleich/Kopfhoerer/Sony-WH-1000XM5-p12345'
    },
    {
      title: '=SUM(A1:A2) Gadget',
      priceText: 'CHF 99.00',
      discountText: '',
      lowText: '',
      medianText: '',
      dealer: 'Galaxus',
      offerCount: 1,
      specs: '',
      url: 'https://www.toppreise.ch/preisvergleich/Gadget/G-p999'
    }
  ];

  it('neutralizes spreadsheet formula prefixes while keeping pure negative numbers', () => {
    assert.equal(neutralizeFormulaCell('-35%'), '-35%');
    assert.equal(neutralizeFormulaCell('-12.50'), '-12.50');
    assert.equal(neutralizeFormulaCell("-1+cmd|'/C calc'!A0"), "'-1+cmd|'/C calc'!A0");
    assert.equal(neutralizeFormulaCell('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
    assert.equal(neutralizeFormulaCell('@SUM(A1)'), '\'@SUM(A1)');
    assert.equal(neutralizeFormulaCell('+cmd'), '\'+cmd');
  });

  it('formats Markdown table including Specs column and escapes URL parentheses', () => {
    const md = formatBatchMarkdown([
      ...items,
      {
        title: 'Monitor 27',
        priceText: 'CHF 399.00',
        dealer: 'Digitec',
        offerCount: 1,
        url: 'https://www.toppreise.ch/preisvergleich/Monitor-(27)-p123'
      }
    ]);
    assert.match(md, /\| # \| Produkt \| Preis \| Rabatt \/ Historie \| Händler \| Specs \| Link \|/);
    assert.match(md, /Sony WH-1000XM5/);
    assert.match(md, /ANC · 30h Akku/);
    assert.match(md, /Digitec \(\+11\)/);
    assert.match(md, /\[Toppreise\]\(https:\/\/www\.toppreise\.ch\/preisvergleich\/Monitor-%2827%29-p123\)/);
  });

  it('formats TSV and RFC-4180 CSV with formula neutralization', () => {
    const tsv = formatBatchTsv(items);
    assert.match(tsv, /\t-35%\t/);
    assert.match(tsv, /'=SUM\(A1:A2\) Gadget/);

    const csv = formatBatchCsv(items);
    assert.match(csv, /^Titel,Preis,Rabatt,/);
    assert.match(csv, /'=SUM\(A1:A2\) Gadget,/);
    assert.match(csv, /,-35%,/);
  });

  it('builds comparison prompt & external AI URLs with needsPaste flag', () => {
    const prompt = buildComparisonPrompt(items);
    assert.match(prompt, /Vergleiche folgende 2 Angebote/);
    assert.match(prompt, /Sony WH-1000XM5 \| Preis: CHF 249\.00/);

    const shortG = buildExternalAiUrl('google-ai', 'short prompt');
    assert.equal(shortG.needsPaste, false);
    assert.match(shortG.url, /udm=50/);

    const longPrompt = 'x'.repeat(1900);
    const longC = buildExternalAiUrl('chatgpt', longPrompt);
    assert.equal(longC.needsPaste, true);
    assert.equal(longC.url, 'https://chatgpt.com/');

    const longG = buildExternalAiUrl('google-ai', longPrompt);
    assert.equal(longG.needsPaste, true);
    assert.equal(longG.url, 'https://www.google.com/search?udm=50');

    // Realistic 10-item list exceeds full prompt budget (>1850 encoded) yet compacts cleanly for URL ?q=
    const tenItems = Array.from({ length: 10 }, (_, i) => ({
      title: `Samsung Galaxy Monitor ${i + 1} 27 Zoll`,
      priceText: `CHF ${200 + i}.00`,
      discountText: '-30%',
      lowText: `CHF ${220 + i}.00`,
      medianText: 'Ø-Preis (1J): CHF 299.00',
      dealer: 'Digitec',
      specs: '27 Zoll · 240 Hz · IPS · HDMI 2.1'
    }));
    const fullTen = buildComparisonPrompt(tenItems);
    assert.ok(encodeURIComponent(fullTen).length > 1850);
    const selectedTen = selectExternalComparisonQuery(tenItems, fullTen);
    assert.equal(selectedTen.needsPaste, false);
    assert.ok(encodeURIComponent(selectedTen.query).length <= 1850);
    assert.match(selectedTen.query, /Samsung Galaxy Monitor 10/);
    const urlTen = buildExternalAiUrl('google-ai', selectedTen.query);
    assert.equal(urlTen.needsPaste, false);
    assert.match(urlTen.url, /\?q=.*&udm=50$/);

    // 45 items exceeds even minimal compact URL budget -> paste fallback
    const hugeItems = Array.from({ length: 45 }, (_, i) => ({
      title: `Apple MacBook Pro M4 24GB 1TB Modell ${i + 1}`,
      priceText: `CHF ${1800 + i}.00`,
      discountText: '-20%'
    }));
    assert.equal(selectExternalComparisonQuery(hugeItems).needsPaste, true);
    assert.ok(buildCompactComparisonPrompt(tenItems, { minimal: true }).length < buildCompactComparisonPrompt(tenItems).length);

    // Adaptive spec budget: 6 cards with ~100-char specs retain full specs (not clipped at 52 chars)
    const sixBoards = Array.from({ length: 6 }, (_, i) => ({
      title: `ASUS Prime B840M-${i + 1}`,
      priceText: `CHF ${80 + i}.00`,
      discountText: '-12%',
      lowText: 'CHF 88.90',
      medianText: 'Ø-Preis (1J): CHF 99.00',
      dealer: 'Digitec',
      specs: 'AMD Sockel AM5, micro ATX · Dual Channel DDR5 (5200 MHz), PCIe 5.0'
    }));
    const fullSix = buildComparisonPrompt(sixBoards);
    const selSix = selectExternalComparisonQuery(sixBoards, fullSix);
    assert.equal(selSix.needsPaste, false);
    assert.ok(encodeURIComponent(selSix.query).length <= 1850);
    assert.match(selSix.query, /Dual Channel DDR5 \(5200 MHz\), PCIe 5\.0/);

    // Custom BATCH_COMPARE_PROMPT with {anzahl} and {angebote} applies cleanly
    const prevPrompt = CONFIG.BATCH_COMPARE_PROMPT;
    CONFIG.BATCH_COMPARE_PROMPT = 'Fokus AM5 ({anzahl} Boards):\n{angebote}\nEnde als Tabelle.';
    try {
      const customFull = buildComparisonPrompt(sixBoards);
      assert.match(customFull, /^Fokus AM5 \(6 Boards\):/);
      assert.match(customFull, /Ende als Tabelle\.$/);
      const customSel = selectExternalComparisonQuery(sixBoards, customFull);
      assert.match(customSel.query, /^Fokus AM5 \(6 Boards\):/);
      assert.match(customSel.query, /PCIe 5\.0/);
    } finally {
      CONFIG.BATCH_COMPARE_PROMPT = prevPrompt;
    }

    const shortP = buildExternalAiUrl('perplexity', 'short prompt');
    assert.equal(shortP.needsPaste, false);
    assert.match(shortP.url, /^https:\/\/www\.perplexity\.ai\/search\?q=/);

    const longP = buildExternalAiUrl('perplexity', longPrompt);
    assert.equal(longP.needsPaste, true);
    assert.equal(longP.url, 'https://www.perplexity.ai/');

    const shortCl = buildExternalAiUrl('claude', 'short prompt');
    assert.equal(shortCl.needsPaste, false);
    assert.match(shortCl.url, /^https:\/\/claude\.ai\/new\?q=/);

    const longCl = buildExternalAiUrl('claude', longPrompt);
    assert.equal(longCl.needsPaste, true);
    assert.equal(longCl.url, 'https://claude.ai/new');
  });

  it('formats per-product payload templates, omits empty segments cleanly & respects excluded fields in compact URLs', () => {
    const items = [
      {
        title: 'Board A',
        priceText: 'CHF 80.00',
        discountText: '-12%',
        lowText: '',
        medianText: '',
        dealer: 'Digitec',
        offerCount: 7,
        specs: 'AM5 · DDR5 · PCIe 5.0',
        url: 'https://www.toppreise.ch/p1'
      },
      {
        title: 'Board B',
        priceText: 'CHF 95.00',
        discountText: '',
        lowText: 'CHF 90.00',
        medianText: 'Ø CHF 105.00',
        dealer: '',
        offerCount: 0,
        specs: 'AM4 · DDR4',
        url: 'https://www.toppreise.ch/p2'
      }
    ];

    // Custom item template skips empty tokens/segments and keeps negative discount intact inside parens
    const customLine1 = formatComparisonItemLine(items[0], 0, '{nr}. {titel} ({preis}, {rabatt}) | Shops: {offerten} | {url}');
    assert.equal(customLine1, '1. Board A (CHF 80.00, -12%) | Shops: 7 | https://www.toppreise.ch/p1');
    const customLine2 = formatComparisonItemLine(items[1], 1, '{nr}. {titel} ({preis}, {rabatt}) | Shops: {offerten} | {url}');
    assert.equal(customLine2, '2. Board B (CHF 95.00) | https://www.toppreise.ch/p2');

    // Empty paren segment disappears entirely when all tokens inside it are empty
    assert.equal(
      formatComparisonItemLine({ title: 'Bare', priceText: '', discountText: '' }, 0, '{nr}. {titel} | ({preis}, {rabatt}) | Händler: {haendler}'),
      '1. Bare'
    );

    // Compact URL query preserves excluded fields (no dealer/rabatt/tief leakage) and includes enabled {url}/{offerten}
    const prevItemTpl = CONFIG.BATCH_COMPARE_ITEM_TEMPLATE;
    CONFIG.BATCH_COMPARE_ITEM_TEMPLATE = '{nr}. {titel} | {preis} | {specs} | {url}';
    try {
      const twelveBoards = Array.from({ length: 12 }, (_, i) => ({
        title: `OLED Monitor Ultra ${i + 1}`,
        priceText: `CHF ${400 + i}.00`,
        discountText: '-30%',
        lowText: 'CHF 420.00',
        dealer: 'ShopSecret',
        specs: '27 Zoll · 240 Hz · OLED · USB-C · DisplayHDR 400 True Black',
        url: `https://www.toppreise.ch/p${i + 1}`
      }));
      const full = buildComparisonPrompt(twelveBoards);
      assert.doesNotMatch(full, /ShopSecret/);
      assert.doesNotMatch(full, /-30%/);
      const compactSel = selectExternalComparisonQuery(twelveBoards, full);
      assert.equal(compactSel.needsPaste, false);
      assert.ok(encodeURIComponent(compactSel.query).length <= 1850);
      assert.doesNotMatch(compactSel.query, /ShopSecret/);
      assert.doesNotMatch(compactSel.query, /-30%/);
      assert.doesNotMatch(compactSel.query, /Tief CHF/);
    } finally {
      CONFIG.BATCH_COMPARE_ITEM_TEMPLATE = prevItemTpl;
    }

    // Typo detector catches unknown tokens in both templates
    assert.deepEqual(findUnknownPromptTokens('Vergleiche {anzhal} Deals: {angebote} {preis}', COMPARE_PROMPT_TOKENS), ['{anzhal}', '{preis}']);
    assert.deepEqual(findUnknownPromptTokens('{nr}. {titel} | {pries} | {url}', COMPARE_ITEM_TOKENS), ['{pries}']);
    assert.deepEqual(findUnknownPromptTokens('{nr}. {titel} | {preis}', COMPARE_ITEM_TOKENS), []);

    // specMaxLen: 0 drops {specs} cleanly instead of emitting "X…"
    assert.equal(
      formatComparisonItemLine(items[0], 0, '{nr}. {titel} | Specs: {specs} | {url}', { specMaxLen: 0 }),
      '1. Board A | https://www.toppreise.ch/p1'
    );

    // Custom template drops {specs} via specMaxLen: 0 before falling back to compact mode
    CONFIG.BATCH_COMPARE_ITEM_TEMPLATE = '{nr}. {titel} | {median} | Händler: {haendler} | Specs: {specs}';
    try {
      const longSpecItems = Array.from({ length: 14 }, (_, i) => ({
        title: `Custom Board ${i + 1}`,
        priceText: `CHF ${100 + i}.00`,
        medianText: 'Ø CHF 120.00',
        dealer: 'Digitec',
        specs: 'A'.repeat(160)
      }));
      const fullCustom = buildComparisonPrompt(longSpecItems);
      const selCustom = selectExternalComparisonQuery(longSpecItems, fullCustom);
      assert.equal(selCustom.needsPaste, false);
      assert.match(selCustom.query, /Händler: Digitec/);
      assert.match(selCustom.query, /Ø CHF 120\.00/);
      assert.doesNotMatch(selCustom.query, /Specs:/);
    } finally {
      CONFIG.BATCH_COMPARE_ITEM_TEMPLATE = prevItemTpl;
    }

    // buildCompactComparisonPrompt honors {median} & {haendler}, including minimal fallback
    const compactMedianDealer = buildCompactComparisonPrompt(
      [{ title: 'Deal X', priceText: 'CHF 50.00', medianText: 'Ø CHF 70.00', dealer: 'Galaxus' }],
      { itemTemplate: '{nr}. {titel} | {preis} | {median} | {haendler}' }
    );
    assert.match(compactMedianDealer, /Ø CHF 70\.00/);
    assert.match(compactMedianDealer, /Galaxus/);

    const minimalNoPrice = buildCompactComparisonPrompt(
      [{ title: 'Deal Y', priceText: 'CHF 50.00', medianText: 'Ø CHF 70.00', dealer: 'Brack' }],
      { minimal: true, itemTemplate: '{nr}. {titel} | {haendler}' }
    );
    assert.match(minimalNoPrice, /\(Brack\)/);
    assert.doesNotMatch(minimalNoPrice, /CHF 50\.00/);

    // findUnknownSingleSearchTokens allows [Produkt], {produkt}, {preis} and flags typos
    assert.deepEqual(findUnknownSingleSearchTokens('Test [Produkt] {preis}'), []);
    assert.deepEqual(findUnknownSingleSearchTokens('Test {produkt} {price} [Preis]'), ['{price}', '[Preis]']);
  });
});

describe('batch-actions: collectScopedCards & getBatchScopeCounts', () => {
  const mkCard = ({ pid, title, price, classes = [], isDeal = false }) => {
    const classSet = new Set(classes);
    const linkEl = {
      tagName: 'a',
      getAttribute: k => (k === 'href' ? `/preisvergleich/Prod/${title.replace(/\s+/g, '-')}-p${pid}` : null),
      href: `https://www.toppreise.ch/preisvergleich/Prod/${title.replace(/\s+/g, '-')}-p${pid}`,
      textContent: title,
      closest: () => null
    };
    const priceEl = { textContent: price };
    const card = {
      dataset: {
        entityId: pid,
        tpOfferCount: '2',
        ...(isDeal ? { tpDealBadge: '1' } : {})
      },
      classList: {
        contains: c => classSet.has(c)
      },
      hidden: false,
      textContent: `${title} ${price} 2 Angebote`,
      closest: () => null,
      querySelector: sel => {
        if (sel.includes('Plugin_Price') || sel.includes('price')) return priceEl;
        if (sel.includes('product-name') || sel.includes('bold') || sel.includes('Heading')) return linkEl;
        if (sel.includes('a[href]')) return linkEl;
        if (sel.includes('tp-deal') && isDeal) return { dataset: { tpKind: 'new-low' } };
        return null;
      },
      querySelectorAll: sel => {
        if (sel === 'a[href]') return [linkEl];
        return [];
      }
    };
    if (isDeal) {
      card._tpDealScore = { weightedDiff: 25 };
      card.dataset.tpDealScore = '25';
    }
    return card;
  };

  it('excludes filtered cards in all scopes and .tp-dimmed only in non-dimmed', () => {
    const cNormal = mkCard({ pid: '101', title: 'Normal Prod', price: 'CHF 100.00' });
    const cDimmed = mkCard({ pid: '102', title: 'Dimmed Prod', price: 'CHF 200.00', classes: ['tp-dimmed'] });
    const cFiltered = mkCard({ pid: '103', title: 'Filtered Prod', price: 'CHF 50.00', classes: ['tp-negative-filtered'] });
    const cDeal = mkCard({ pid: '104', title: 'Deal Prod', price: 'CHF 80.00', isDeal: true });
    cDeal.querySelector = sel => {
      if (sel.includes('Plugin_Price') || sel.includes('price')) return { textContent: 'CHF 80.00' };
      if (sel.includes('a[href]')) return {
        tagName: 'a',
        getAttribute: () => '/preisvergleich/Prod/Deal-Prod-p104',
        href: 'https://www.toppreise.ch/preisvergleich/Prod/Deal-Prod-p104',
        textContent: 'Deal Prod',
        closest: () => null
      };
      return null;
    };

    const allCards = [cNormal, cDimmed, cFiltered, cDeal];
    const root = {
      querySelectorAll: sel => (sel.includes('Plugin_Product') ? allCards : []),
      querySelector: () => null
    };

    const prevFilters = CONFIG.FILTERS_ENABLED;
    const prevMinOffers = CONFIG.MIN_OFFERS;
    const prevNeg = CONFIG.NEGATIVE_TERMS;
    const prevNegMode = CONFIG.FILTER_NEG_MODE;
    CONFIG.FILTERS_ENABLED = true;
    CONFIG.MIN_OFFERS = 1;
    CONFIG.NEGATIVE_TERMS = '';
    CONFIG.FILTER_NEG_MODE = 'hide';
    try {
      const counts = getBatchScopeCounts(root);
      assert.equal(counts.visible, 3);
      assert.equal(counts['non-dimmed'], 2);

      const nonDimmed = collectScopedCards('non-dimmed', root);
      assert.deepEqual(nonDimmed.map(i => i.pid), ['101', '104']);

      const visible = collectScopedCards('visible', root);
      assert.deepEqual(visible.map(i => i.pid), ['101', '102', '104']);

      const deals = collectScopedCards('deals', root);
      assert.equal(deals.length, counts.deals);
      assert.equal(deals.some(i => i.pid === '103'), false);
    } finally {
      CONFIG.FILTERS_ENABLED = prevFilters;
      CONFIG.MIN_OFFERS = prevMinOffers;
      CONFIG.NEGATIVE_TERMS = prevNeg;
      CONFIG.FILTER_NEG_MODE = prevNegMode;
    }
  });
});

describe('batch-actions: isBatchConfirmRequired', () => {
  it('respects threshold boundaries and alwaysConfirm flag', () => {
    const prevThreshold = CONFIG.BATCH_CONFIRM_THRESHOLD;
    CONFIG.BATCH_CONFIRM_THRESHOLD = 10;
    try {
      assert.equal(isBatchConfirmRequired(9, false), false);
      assert.equal(isBatchConfirmRequired(10, false), true);
      assert.equal(isBatchConfirmRequired(1, true), true);
    } finally {
      CONFIG.BATCH_CONFIRM_THRESHOLD = prevThreshold;
    }
  });
});
