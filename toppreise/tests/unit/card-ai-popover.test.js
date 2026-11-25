import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatVerdictHtml, renderAiError, openAiPopover, closeAiPopover } from '../../src/ui/badges/card-ai-popover.js';

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

  it('formats #, ##, ### markdown headings as strong.tp-ai-h with escaped HTML', () => {
    const input = '# Titel\n## Bewertung\n### <script>alert(1)</script> Fazit';
    const formatted = formatVerdictHtml(input);
    assert.equal(
      formatted,
      '<strong class="tp-ai-h">Titel</strong>\n<strong class="tp-ai-h">Bewertung</strong>\n<strong class="tp-ai-h">&lt;script&gt;alert(1)&lt;/script&gt; Fazit</strong>'
    );
  });
});

describe('card-ai-popover: renderAiError', () => {
  const makeFakeDoc = () => {
    const createElement = tag => ({
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      children: [],
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren(...children) { this.children = children; }
    });
    return { createElement };
  };

  it('renders an error message as literal text, never as markup', () => {
    const doc = makeFakeDoc();
    const host = doc.createElement('div');
    const payload = '<img src=x onerror="globalThis.__tpPwned=1">';

    renderAiError(host, payload, doc);

    assert.equal(host.children.length, 3);
    const [warn, br, help] = host.children;
    assert.equal(warn.tagName, 'SPAN');
    assert.equal(warn.className, 'tp-ai-error-msg');
    assert.equal(warn.textContent, `⚠️ ${payload}`);
    assert.equal(br.tagName, 'BR');
    assert.equal(help.className, 'tp-ai-error-help');
    assert.equal(help.textContent, 'Du kannst stattdessen direkt die Google-Suche öffnen.');
    assert.equal('innerHTML' in host, false);
  });

  it('is a no-op without a host or document', () => {
    assert.doesNotThrow(() => renderAiError(null, 'boom'));
    assert.doesNotThrow(() => renderAiError({ replaceChildren() { throw new Error('must not run'); } }, 'boom', null));
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
          className: '',
          style: {},
          attributes: {},
          children: [],
          appendChild(ch) { this.children.push(ch); return ch; },
          setAttribute(k, v) { this.attributes[k] = v; },
          getAttribute(k) { return this.attributes[k] ?? null; },
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
      assert.equal(popover.getAttribute('role'), 'dialog');
      assert.equal(popover.getAttribute('aria-modal'), 'true');
      const panel = popover.children[0];
      assert.ok(panel.className.includes('tp-popout-panel'));
      const closeBtn = panel.children[0].children[1].children[0];
      assert.equal(closeBtn.className, 'tp-popout-close');
      const footer = panel.children[3];
      const retryBtn = footer.children[0];
      assert.equal(retryBtn.hidden, true);
      assert.ok(footer.children.every(b => b.className === 'tp-popout-btn'));

      closeAiPopover();
      assert.equal(created.includes(popover), false);
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('renders async fetch failures through DOM nodes, not the error innerHTML path', async () => {
    const created = [];
    const origDoc = globalThis.document;
    globalThis.document = {
      body: {
        appendChild(el) {
          el.isConnected = true;
          created.push(el);
          return el;
        }
      },
      addEventListener() {},
      removeEventListener() {},
      createElement(tag) {
        return {
          tagName: tag.toUpperCase(),
          id: '',
          className: '',
          style: {},
          attributes: {},
          children: [],
          appendChild(ch) { this.children.push(ch); return ch; },
          replaceChildren(...children) { this.children = children; },
          setAttribute(k, v) { this.attributes[k] = v; },
          getAttribute(k) { return this.attributes[k] ?? null; },
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
      const popover = openAiPopover({ title: 'Test Smartphone' });
      // No API key: fetchTavilySummary rejects on the next microtask.
      await new Promise(resolve => setTimeout(resolve, 0));
      const content = popover.children[0].children[2];
      assert.equal(content.className, 'tp-ai-body tp-ai-error');
      assert.equal(content.children.length, 3);
      assert.equal(content.children[0].className, 'tp-ai-error-msg');
      assert.match(content.children[0].textContent, /^⚠️ Tavily API-Key fehlt$/);
      assert.equal(content.children[1].tagName, 'BR');
      assert.equal(content.children[2].className, 'tp-ai-error-help');
    } finally {
      closeAiPopover();
      globalThis.document = origDoc;
    }
  });

  it('ignores stale model responses on rapid switch and clicks detail share button fallback', async () => {
    const { CONFIG } = await import('../../src/state/config.js');
    const prevKey = CONFIG.OPENROUTER_API_KEY;
    const prevDoc = globalThis.document;
    const prevFetch = globalThis.fetch;
    const prevGM = globalThis.GM_xmlhttpRequest;
    delete globalThis.GM_xmlhttpRequest;
    CONFIG.OPENROUTER_API_KEY = 'sk-test-123';

    const byId = new Map();
    const created = [];
    const makeEl = (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        _id: '',
        get id() { return this._id; },
        set id(v) { this._id = v; if (v) byId.set(v, this); },
        className: '',
        style: {},
        attributes: {},
        children: [],
        listeners: {},
        _innerHTML: '',
        set innerHTML(v) { this._innerHTML = v; },
        get innerHTML() { return this._innerHTML; },
        appendChild(ch) { this.children.push(ch); return ch; },
        append(...args) { this.children.push(...args); },
        replaceChildren(...args) { this.children = args; },
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k] ?? null; },
        addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
        removeEventListener() {},
        dispatch(type) { (this.listeners[type] || []).forEach(fn => fn({ target: this, preventDefault() {}, stopPropagation() {} })); },
        remove() {
          const idx = created.indexOf(this);
          if (idx >= 0) created.splice(idx, 1);
        }
      };
      return el;
    };

    let detailShareClicked = false;
    const detailShareBtn = { click() { detailShareClicked = true; } };
    byId.set('tp-detail-share-btn', detailShareBtn);

    globalThis.document = {
      body: {
        appendChild(el) { el.isConnected = true; created.push(el); return el; }
      },
      addEventListener() {},
      removeEventListener() {},
      createElement: makeEl,
      getElementById: id => byId.get(id) || null
    };

    const resolvers = [];
    globalThis.fetch = () => new Promise(resolve => { resolvers.push(resolve); });

    try {
      const headingCard = { matches: () => false, querySelector: () => null };
      openAiPopover({
        title: 'Race Test Product',
        priceText: 'CHF 99.00',
        card: headingCard,
        provider: 'openrouter',
        model: 'model-a'
      });

      const modelSelect = byId.get('tp-ai-popout-model-select');
      assert.ok(modelSelect);
      // Add option for model-b and switch before model-a resolves
      modelSelect.value = 'model-b';
      modelSelect.dispatch('change');

      assert.equal(resolvers.length, 2);
      // Resolve model-b first, then stale model-a second
      resolvers[1]({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: 'Ergebnis Modell B' } }] })
      });
      await new Promise(r => setTimeout(r, 10));
      resolvers[0]({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: 'Veraltetes Modell A' } }] })
      });
      await new Promise(r => setTimeout(r, 10));

      const popout = byId.get('tp-ai-popout');
      const bodyEl = popout.children[0].children.find(c => c.className === 'tp-ai-body');
      assert.ok(bodyEl.innerHTML.includes('Ergebnis Modell B'));
      assert.ok(!bodyEl.innerHTML.includes('Veraltetes Modell A'));

      const footer = popout.children[0].children.find(c => c.className === 'tp-popout-footer');
      const discordBtn = footer.children.find(b => b.textContent === '📤 In Discord teilen');
      discordBtn.dispatch('click');
      assert.equal(detailShareClicked, true);
    } finally {
      closeAiPopover();
      CONFIG.OPENROUTER_API_KEY = prevKey;
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
      if (prevFetch === undefined) delete globalThis.fetch; else globalThis.fetch = prevFetch;
      if (prevGM !== undefined) globalThis.GM_xmlhttpRequest = prevGM;
    }
  });
});
