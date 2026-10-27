import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toFeedUrl,
  indexCategoryData,
  searchCategoryTree,
  getStoredIdents,
  saveStoredIdents,
  getExpandedBranches,
  saveExpandedBranches,
  isCategoryIgnored,
  enhanceCategorySidebar
} from '../../src/features/category-tree.js';

test('toFeedUrl transforms catalog URLs to feed URLs', () => {
  assert.equal(
    toFeedUrl('/produktsuche/Computer-Zubehoer/Komplettsysteme/Komplettsysteme-c2847'),
    '/neue-toppreise/Computer-Zubehoer/Komplettsysteme/Komplettsysteme-c2847'
  );
  assert.equal(
    toFeedUrl('/katalog/Auto-Motorrad-c651'),
    '/neue-toppreise/Auto-Motorrad-c651'
  );
  assert.equal(
    toFeedUrl('/produktsuche/Videogames-c900', '/new-best-prices'),
    '/new-best-prices/Videogames-c900'
  );
  assert.equal(
    toFeedUrl('/produktsuche/TV-c654', '/nouveaux-meilleurs-prix/TV-c654'),
    '/nouveaux-meilleurs-prix/TV-c654'
  );
  assert.equal(toFeedUrl(''), '/neue-toppreise');
});

test('indexCategoryData maps hierarchy, numeric IDs and breadcrumbs', () => {
  const sample = [
    {
      id: 'c200',
      title: 'Computer &amp; Zubeh&ouml;r',
      url: '/produktsuche/Computer-Zubehoer-c200',
      parentID: '',
      hasChildren: true,
      children: [
        {
          id: 'c8',
          title: 'Komplettsysteme',
          url: '/produktsuche/Computer-Zubehoer/Komplettsysteme-c8',
          parentID: 'c200',
          hasChildren: true,
          children: [
            {
              id: 'c2847',
              title: 'Komplettsysteme',
              url: '/produktsuche/Computer-Zubehoer/Komplettsysteme/Komplettsysteme-c2847',
              parentID: 'c8',
              hasChildren: false
            }
          ]
        }
      ]
    }
  ];

  const indexed = indexCategoryData(sample);
  assert.equal(indexed.byId.size, 3);
  assert.equal(indexed.allNodes.length, 3);

  const root = indexed.byId.get('c200');
  assert.equal(root.numericId, '200');
  assert.equal(root.title, 'Computer & Zubehör');
  assert.equal(root.breadcrumb, 'Computer & Zubehör');

  const l1 = indexed.byId.get('c8');
  assert.equal(l1.numericId, '8');
  assert.equal(l1.parentID, 'c200');
  assert.equal(l1.breadcrumb, 'Computer & Zubehör › Komplettsysteme');

  const l2 = indexed.byId.get('c2847');
  assert.equal(l2.numericId, '2847');
  assert.equal(l2.parentID, 'c8');
  assert.equal(l2.breadcrumb, 'Computer & Zubehör › Komplettsysteme › Komplettsysteme');

  const childrenOfRoot = indexed.childrenOf.get('c200');
  assert.equal(childrenOfRoot.length, 1);
  assert.equal(childrenOfRoot[0].id, 'c8');
});

test('indexCategoryData deduplicates nodes present in both flat root and parent children', () => {
  const sample = [
    {
      id: 'c200',
      title: 'Computer & Zubehör',
      url: '/produktsuche/Computer-Zubehoer-c200',
      parentID: '',
      hasChildren: true,
      children: [
        {
          id: 'c8',
          title: 'Komplettsysteme',
          url: '/produktsuche/Computer-Zubehoer/Komplettsysteme-c8',
          parentID: 'c200',
          hasChildren: false
        }
      ]
    },
    {
      id: 'c8',
      title: 'Komplettsysteme',
      url: '/produktsuche/Computer-Zubehoer/Komplettsysteme-c8',
      parentID: 'c200',
      hasChildren: false
    }
  ];

  const indexed = indexCategoryData(sample);
  assert.equal(indexed.byId.size, 2);
  assert.equal(indexed.allNodes.length, 2);
  const childrenOfRoot = indexed.childrenOf.get('c200');
  assert.equal(childrenOfRoot.length, 1);
  assert.equal(childrenOfRoot[0].id, 'c8');
});

test('isCategoryIgnored detects ignored classes and show triggers', () => {
  const activeLi = createMockElement('li');
  assert.equal(isCategoryIgnored(activeLi), false);

  const ignoredLi = createMockElement('li', { className: 'ignoredCategoryEntry' });
  assert.equal(isCategoryIgnored(ignoredLi), true);

  const showLi = createMockElement('li');
  const showSpan = createMockElement('span', { className: 'f_IgnoredCategories_Show' });
  showLi.appendChild(showSpan);
  assert.equal(isCategoryIgnored(showLi), true);
});

test('searchCategoryTree matches title and URL keywords', () => {
  const sample = [
    {
      id: 'c200',
      title: 'Computer & Zubehör',
      url: '/produktsuche/Computer-Zubehoer-c200',
      parentID: '',
      children: [
        {
          id: 'c8',
          title: 'Komplettsysteme',
          url: '/produktsuche/Computer-Zubehoer/Komplettsysteme-c8',
          parentID: 'c200'
        },
        {
          id: 'c900',
          title: 'Videogames',
          url: '/produktsuche/Videogames-c900',
          parentID: ''
        }
      ]
    }
  ];
  const indexed = indexCategoryData(sample);

  const res1 = searchCategoryTree(indexed, 'komplett');
  assert.equal(res1.length, 1);
  assert.equal(res1[0].id, 'c8');

  const res2 = searchCategoryTree(indexed, 'video');
  assert.equal(res2.length, 1);
  assert.equal(res2[0].id, 'c900');

  const resEmpty = searchCategoryTree(indexed, 'nonexistent');
  assert.equal(resEmpty.length, 0);

  const resBlank = searchCategoryTree(indexed, '   ');
  assert.equal(resBlank.length, 0);
});

test('stored idents and expanded branches storage wrappers', () => {
  const storage = {};
  globalThis.localStorage = {
    getItem: k => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); }
  };
  const session = {};
  globalThis.sessionStorage = {
    getItem: k => session[k] || null,
    setItem: (k, v) => { session[k] = String(v); }
  };

  saveStoredIdents({ '200': 'token123' });
  assert.deepEqual(getStoredIdents(), { '200': 'token123' });

  saveExpandedBranches(new Set(['c200', 'c8']));
  assert.deepEqual(Array.from(getExpandedBranches()), ['c200', 'c8']);
});

function createMockElement(tag, attrs = {}) {
  const children = [];
  const classList = new Set((attrs.className || '').split(/\s+/).filter(Boolean));
  const el = {
    tagName: tag.toUpperCase(),
    dataset: {},
    style: {},
    className: attrs.className || '',
    classList: {
      add: c => { classList.add(c); el.className = Array.from(classList).join(' '); },
      remove: c => { classList.delete(c); el.className = Array.from(classList).join(' '); },
      contains: c => classList.has(c)
    },
    attributes: { ...attrs },
    getAttribute: a => el.attributes[a] ?? null,
    setAttribute: (a, v) => { el.attributes[a] = String(v); },
    addEventListener: () => {},
    get firstChild() { return children[0] || null; },
    appendChild: child => {
      if (child.parentElement?.removeChild) child.parentElement.removeChild(child);
      children.push(child);
      child.parentElement = el;
      return child;
    },
    prepend: child => {
      if (child.parentElement?.removeChild) child.parentElement.removeChild(child);
      children.unshift(child);
      child.parentElement = el;
      return child;
    },
    removeChild: child => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
        child.parentElement = null;
        return child;
      }
      return null;
    },
    remove: () => {
      if (el.parentElement?.removeChild) el.parentElement.removeChild(el);
    },
    after: next => {
      if (el.parentElement) el.parentElement.appendChild(next);
    },
    querySelector: sel => {
      for (const ch of children) {
        if (ch.matches && ch.matches(sel)) return ch;
        const sub = ch.querySelector?.(sel);
        if (sub) return sub;
      }
      return null;
    },
    querySelectorAll: sel => {
      const res = [];
      for (const ch of children) {
        if (ch.matches && ch.matches(sel)) res.push(ch);
        if (ch.querySelectorAll) res.push(...ch.querySelectorAll(sel));
      }
      return res;
    },
    matches: sel => {
      const part = sel.split(/[\s>]+/).pop().trim();
      if (part.startsWith('.')) return classList.has(part.slice(1));
      if (part.startsWith('a')) return el.tagName === 'A';
      if (part.startsWith('li')) return el.tagName === 'LI';
      if (part.startsWith('ul')) return el.tagName === 'UL';
      if (part.startsWith('div')) return el.tagName === 'DIV';
      if (part.startsWith('span')) return el.tagName === 'SPAN';
      if (part.startsWith('button')) return el.tagName === 'BUTTON';
      return false;
    }
  };
  return el;
}

test('enhanceCategorySidebar injects search box and chevrons on feed sidebar', () => {
  const prevDoc = globalThis.document;
  const prevLoc = globalThis.location;
  saveExpandedBranches(new Set());

  try {
    const sidebar = createMockElement('div', { className: 'Plugin_CategoryMainSelectionLeft' });
    const label = createMockElement('div', { className: 'label bold' });
    sidebar.appendChild(label);

    const ul = createMockElement('ul');
    const li1 = createMockElement('li');
    const a1 = createMockElement('a', { href: '/neue-toppreise/Computer-Zubehoer-c200' });
    li1.appendChild(a1);
    ul.appendChild(li1);

    const li2 = createMockElement('li');
    const a2 = createMockElement('a', { href: '/neue-toppreise/Videogames-c900' });
    li2.appendChild(a2);
    ul.appendChild(li2);

    sidebar.appendChild(ul);

    globalThis.document = {
      body: {
        classList: { contains: c => c === 'Page_ListTopPriceReductionProducts' },
        getAttribute: a => (a === 'data-current_url' ? '/neue-toppreise' : null)
      },
      querySelector: sel => {
        if (sel.includes('Plugin_CategoryMainSelectionLeft')) return sidebar;
        return null;
      },
      createElement: tag => createMockElement(tag)
    };
    globalThis.location = { href: 'https://www.toppreise.ch/neue-toppreise', pathname: '/neue-toppreise' };

    enhanceCategorySidebar();

    assert.ok(sidebar.classList.contains('tp-tree-enhanced'));
    assert.equal(li1.dataset.catId, 'c200');
    assert.equal(li2.dataset.catId, 'c900');
  } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    if (prevLoc === undefined) delete globalThis.location; else globalThis.location = prevLoc;
  }
});
