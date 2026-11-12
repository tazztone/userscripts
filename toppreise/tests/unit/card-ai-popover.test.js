import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatVerdictHtml, openAiPopover, closeAiPopover } from '../../src/ui/badges/card-ai-popover.js';

describe('card-ai-popover: formatVerdictHtml', () => {
  it('handles null, undefined and empty input', () => {
    assert.equal(formatVerdictHtml(null), '');
    assert.equal(formatVerdictHtml(undefined), '');
    assert.equal(formatVerdictHtml(''), '');
  });

  it('escapes dangerous HTML characters to prevent XSS', () => {
    const raw = '<script>alert("xss")</script> & <b>test</b>';
    const formatted = formatVerdictHtml(raw);
    assert.ok(!formatted.includes('<script>'));
    assert.ok(formatted.includes('&lt;script&gt;'));
    assert.ok(formatted.includes('&amp;'));
    assert.ok(formatted.includes('&lt;b&gt;'));
  });

  it('formats markdown bold into strong tags', () => {
    const input = 'Das Fazit ist **sehr gut** und __empfehlenswert__.';
    const expected = 'Das Fazit ist <strong>sehr gut</strong> und <strong>empfehlenswert</strong>.';
    assert.equal(formatVerdictHtml(input), expected);
  });

  it('formats hyphen and asterisk bullet points into unicode bullets', () => {
    const input = 'Vorteile:\n- Starker Akku\n* Schnelles Laden\n  - Tolles Display';
    const formatted = formatVerdictHtml(input);
    assert.ok(formatted.includes('• Starker Akku'));
    assert.ok(formatted.includes('• Schnelles Laden'));
    assert.ok(formatted.includes('• Tolles Display'));
  });

  it('preserves clean multi-line text structure', () => {
    const input = '**Fazit:**\n- Top Preis\n- Schneller Versand';
    const formatted = formatVerdictHtml(input);
    assert.equal(formatted, '<strong>Fazit:</strong>\n• Top Preis\n• Schneller Versand');
  });
});

describe('card-ai-popover: lifecycle and closeAiPopover', () => {
  it('opens and closes popover gracefully', () => {
    const created = [];
    const origDoc = globalThis.document;
    globalThis.document = {
      body: {
        appendChild(el) { created.push(el); return el; }
      },
      addEventListener() {},
      removeEventListener() {},
      createElement(tag) {
        return {
          tagName: tag.toUpperCase(),
          id: '',
          style: {},
          children: [],
          appendChild(ch) { this.children.push(ch); return ch; },
          setAttribute() {},
          getAttribute() { return null; },
          addEventListener() {},
          removeEventListener() {},
          remove() {
            const idx = created.indexOf(this);
            if (idx >= 0) created.splice(idx, 1);
          }
        };
      },
      getElementById(id) {
        return created.find(c => c.id === id) || null;
      }
    };

    try {
      const popover = openAiPopover({ title: 'Test Smartphone', priceText: 'CHF 499' });
      assert.ok(popover);
      assert.equal(created.includes(popover), true);

      closeAiPopover();
      assert.equal(created.includes(popover), false);
    } finally {
      globalThis.document = origDoc;
    }
  });
});
