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

    const longPrompt = 'x'.repeat(1600);
    const longC = buildExternalAiUrl('chatgpt', longPrompt);
    assert.equal(longC.needsPaste, true);
    assert.equal(longC.url, 'https://chatgpt.com/');

    const longG = buildExternalAiUrl('google-ai', longPrompt);
    assert.equal(longG.needsPaste, true);
    assert.equal(longG.url, 'https://www.google.com/search?udm=50');

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
