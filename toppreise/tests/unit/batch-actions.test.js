import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCardSpecs,
  isComparisonButtonActive,
  neutralizeFormulaCell,
  formatBatchMarkdown,
  formatBatchTsv,
  formatBatchCsv,
  buildComparisonPrompt,
  buildExternalAiUrl
} from '../../src/features/batch-actions.js';

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
  });
});
