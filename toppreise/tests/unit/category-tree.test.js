import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toFeedUrl,
  indexCategoryData,
  hasIgnoredAncestor,
  searchCategoryTree,
  getStoredIdents,
  saveStoredIdents,
  getExpandedBranches,
  saveExpandedBranches,
  isCategoryIgnored,
  getIgnoredVcatIds,
  syncCategoryTreeIgnoredState,
  syncSearchResultsIgnoredState,
  harvestExistingIdents,
  renderChildList,
  enhanceCategorySidebar,
  addIgnoredCategoryChip,
  removeIgnoredCategoryChip,
  resetAllIgnoredCategoryChips,
  ensureCategoryIdent
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
  const showRow = createMockElement('div', { className: 'tp-cat-row' });
  const showSpan = createMockElement('span', { className: 'f_IgnoredCategories_Show' });
  showRow.appendChild(showSpan);
  showLi.appendChild(showRow);
  assert.equal(isCategoryIgnored(showLi), true);

  // Parent LI should NOT be considered ignored when only its child LI is ignored
  const parentLi = createMockElement('li');
  const parentRow = createMockElement('div', { className: 'tp-cat-row' });
  const parentHideSpan = createMockElement('span', { className: 'f_IgnoredCategories_Hide' });
  parentRow.appendChild(parentHideSpan);
  parentLi.appendChild(parentRow);

  const sublist = createMockElement('ul', { className: 'tp-cat-sublist' });
  const childLi = createMockElement('li', { className: 'ignoredCategoryEntry' });
  const childRow = createMockElement('div', { className: 'tp-cat-row' });
  const childShowSpan = createMockElement('span', { className: 'f_IgnoredCategories_Show' });
  childRow.appendChild(childShowSpan);
  childLi.appendChild(childRow);
  sublist.appendChild(childLi);
  parentLi.appendChild(sublist);

  assert.equal(isCategoryIgnored(parentLi), false);
  assert.equal(isCategoryIgnored(childLi), true);
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

  // When parent 'c200' is ignored, child 'c8' must be omitted from search results
  const resWithIgnoredParent = searchCategoryTree(indexed, 'komplett', 12, new Set(['200']));
  assert.equal(resWithIgnoredParent.length, 0);

  // But the ignored parent itself should still be matchable (so it can be re-enabled)
  const resParentMatch = searchCategoryTree(indexed, 'computer', 12, new Set(['200']));
  assert.equal(resParentMatch.length, 1);
  assert.equal(resParentMatch[0].id, 'c200');
});

test('hasIgnoredAncestor checks parent and grandparent hierarchy against ignored sets', () => {
  const sample = [
    {
      id: 'c200',
      title: 'Computer & Zubehör',
      url: '/c200',
      parentID: '',
      children: [
        {
          id: 'c8',
          title: 'Komplettsysteme',
          url: '/c8',
          parentID: 'c200',
          children: [
            {
              id: 'c100',
              title: 'Gaming PCs',
              url: '/c100',
              parentID: 'c8'
            }
          ]
        }
      ]
    }
  ];
  const tree = indexCategoryData(sample);
  const rootNode = tree.byId.get('c200');
  const childNode = tree.byId.get('c8');
  const grandchildNode = tree.byId.get('c100');

  // Empty or unrelated ignored sets
  assert.equal(hasIgnoredAncestor(rootNode, tree, new Set()), false);
  assert.equal(hasIgnoredAncestor(childNode, tree, new Set(['999'])), false);

  // Root node itself has no ancestor
  assert.equal(hasIgnoredAncestor(rootNode, tree, new Set(['200'])), false);

  // Child node has ignored parent (numeric or 'c' prefixed)
  assert.equal(hasIgnoredAncestor(childNode, tree, new Set(['200'])), true);
  assert.equal(hasIgnoredAncestor(childNode, tree, new Set(['c200'])), true);

  // Grandchild has ignored grandparent
  assert.equal(hasIgnoredAncestor(grandchildNode, tree, new Set(['200'])), true);
  // Grandchild has ignored immediate parent
  assert.equal(hasIgnoredAncestor(grandchildNode, tree, new Set(['8'])), true);
  // When grandchild itself is in ignored set, hasIgnoredAncestor is false (it is not its own ancestor)
  assert.equal(hasIgnoredAncestor(grandchildNode, tree, new Set(['100'])), false);
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
  let classNameVal = attrs.className || '';
  const el = {
    tagName: tag.toUpperCase(),
    dataset: {},
    style: {},
    get className() { return classNameVal; },
    set className(val) {
      classNameVal = val || '';
      classList.clear();
      (val || '').split(/\s+/).filter(Boolean).forEach(c => classList.add(c));
    },
    classList: {
      add: c => { classList.add(c); classNameVal = Array.from(classList).join(' '); },
      remove: c => { classList.delete(c); classNameVal = Array.from(classList).join(' '); },
      contains: c => classList.has(c)
    },
    attributes: { ...attrs },
    getAttribute: a => el.attributes[a] ?? null,
    setAttribute: (a, v) => { el.attributes[a] = String(v); },
    removeAttribute: a => { delete el.attributes[a]; },
    addEventListener: () => {},
    get firstChild() { return children[0] || null; },
    get firstElementChild() { return children[0] || null; },
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
    closest: sel => {
      let cur = el;
      while (cur) {
        if (cur.matches?.(sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    remove: () => {
      if (el.parentElement?.removeChild) el.parentElement.removeChild(el);
    },
    replaceWith: newEl => {
      if (el.parentElement) {
        const p = el.parentElement;
        el.remove();
        p.appendChild(newEl);
      }
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
      const part = sel.replace(/:scope/g, '').split(/[\s>]+/).pop().trim();
      if (!part) return true;
      if (part.includes('[') && part.includes(']')) {
        const attrMatch = part.match(/\[([^=\]]+)(?:="?([^"\]]*)"?)?\]/);
        if (attrMatch) {
          const attr = attrMatch[1];
          const val = attrMatch[2];
          const actualVal = el.getAttribute ? el.getAttribute(attr) : el.attributes?.[attr];
          if (actualVal === null || actualVal === undefined) return false;
          if (val !== undefined && String(actualVal) !== String(val)) return false;
        }
      }
      const tagOrClass = part.replace(/\[.*\]/, '');
      if (tagOrClass.startsWith('.')) {
        return tagOrClass.split('.').filter(Boolean).every(c => classList.has(c));
      }
      if (tagOrClass.startsWith('a')) return el.tagName === 'A';
      if (tagOrClass.startsWith('li')) return el.tagName === 'LI';
      if (tagOrClass.startsWith('ul')) return el.tagName === 'UL';
      if (tagOrClass.startsWith('div')) return el.tagName === 'DIV';
      if (tagOrClass.startsWith('span')) return el.tagName === 'SPAN';
      if (tagOrClass.startsWith('button')) return el.tagName === 'BUTTON';
      if (tagOrClass.startsWith('i')) return el.tagName === 'I';
      return part.includes('[') && part.includes(']');
    }
  };
  return el;
}

test('getIgnoredVcatIds extracts active chips from .Plugin_IgnoredCategories', () => {
  const doc = createMockElement('div');
  const bar = createMockElement('div', { className: 'Plugin_IgnoredCategories' });
  const chip1 = createMockElement('span', { className: 'ignoredCategory' });
  chip1.setAttribute('data-vcat-id', '200');
  const chip2 = createMockElement('span', { className: 'ignoredCategory' });
  chip2.setAttribute('data-vcat-id', '35');
  bar.appendChild(chip1);
  bar.appendChild(chip2);
  doc.appendChild(bar);

  const ignored = getIgnoredVcatIds(doc);
  assert.equal(ignored.size, 2);
  assert.ok(ignored.has('200'));
  assert.ok(ignored.has('35'));
  assert.ok(!ignored.has('999'));
});

test('renderChildList marks ignored categories with ignoredCategoryEntry and plus icon', () => {
  const prevDoc = globalThis.document;
  try {
    const parentLi = createMockElement('li');
    const docRoot = createMockElement('div');
    const bar = createMockElement('div', { className: 'Plugin_IgnoredCategories' });
    const chip = createMockElement('span', { className: 'ignoredCategory' });
    chip.setAttribute('data-vcat-id', '35');
    bar.appendChild(chip);
    docRoot.appendChild(bar);
    docRoot.appendChild(parentLi);

    globalThis.document = {
      createElement: tag => createMockElement(tag),
      querySelectorAll: sel => docRoot.querySelectorAll(sel),
      querySelector: sel => docRoot.querySelector(sel)
    };

    const children = [
      { id: 'c35', numericId: '35', title: 'Software', url: '/produktsuche/Software-c35', hasChildren: true },
      { id: 'c40', numericId: '40', title: 'Hardware', url: '/produktsuche/Hardware-c40', hasChildren: false }
    ];

    renderChildList(children, parentLi, '/neue-toppreise', new Set());

    const sublist = parentLi.querySelector('.tp-cat-sublist');
    assert.ok(sublist);

    const items = sublist.querySelectorAll('li');
    assert.equal(items.length, 2);

    // c35 (Software) is ignored
    const softwareLi = items[0];
    assert.ok(softwareLi.classList.contains('ignoredCategoryEntry'));
    const swSpan = softwareLi.querySelector('.ignoreCategory');
    assert.ok(swSpan.classList.contains('f_IgnoredCategories_Show'));
    assert.equal(swSpan.getAttribute('title'), 'Kategorie einblenden');
    const swIcon = swSpan.querySelector('i');
    assert.ok(swIcon.classList.contains('TPIcons-plus'));
    const swToggle = softwareLi.querySelector('.tp-cat-toggle');
    assert.equal(swToggle.disabled, true);

    // c40 (Hardware) is active
    const hardwareLi = items[1];
    assert.ok(!hardwareLi.classList.contains('ignoredCategoryEntry'));
    const hwSpan = hardwareLi.querySelector('.ignoreCategory');
    assert.ok(hwSpan.classList.contains('f_IgnoredCategories_Hide'));
    assert.equal(hwSpan.getAttribute('title'), 'Kategorie ausblenden');
    const hwIcon = hwSpan.querySelector('i');
    assert.ok(hwIcon.classList.contains('TPIcons-cross'));
  } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
  }
});

test('syncCategoryTreeIgnoredState updates existing rows when ignored chips change', () => {
  const prevDoc = globalThis.document;
  try {
    const sidebar = createMockElement('div', { className: 'Plugin_CategoryMainSelectionLeft' });
    const ul = createMockElement('ul');
    const li = createMockElement('li', { className: 'tp-cat-node' });
    const row = createMockElement('div', { className: 'tp-cat-row' });
    const toggle = createMockElement('button', { className: 'tp-cat-toggle' });
    const span = createMockElement('span', { className: 'ignoreCategory f_IgnoredCategories_Hide' });
    span.setAttribute('data-vcat-id', '35');
    const icon = createMockElement('i', { className: 'TPIcons-cross' });
    span.appendChild(icon);
    row.appendChild(toggle);
    row.appendChild(span);
    li.appendChild(row);
    ul.appendChild(li);
    sidebar.appendChild(ul);

    const bar = createMockElement('div', { className: 'Plugin_IgnoredCategories' });
    const root = createMockElement('div');
    root.appendChild(sidebar);
    root.appendChild(bar);

    globalThis.document = {
      querySelectorAll: sel => root.querySelectorAll(sel),
      querySelector: sel => root.querySelector(sel),
      createElement: tag => createMockElement(tag)
    };

    // Before: active
    assert.ok(!li.classList.contains('ignoredCategoryEntry'));
    assert.ok(span.classList.contains('f_IgnoredCategories_Hide'));

    // Add chip for 35 and sync
    const chip = createMockElement('span', { className: 'ignoredCategory' });
    chip.setAttribute('data-vcat-id', '35');
    bar.appendChild(chip);

    syncCategoryTreeIgnoredState(sidebar);

    // After: ignored
    assert.ok(li.classList.contains('ignoredCategoryEntry'));
    assert.ok(span.classList.contains('f_IgnoredCategories_Show'));
    assert.ok(icon.classList.contains('TPIcons-plus'));
    assert.equal(toggle.disabled, true);

    // Remove chip and sync
    chip.remove();
    syncCategoryTreeIgnoredState(sidebar);

    // Restored: active
    assert.ok(!li.classList.contains('ignoredCategoryEntry'));
    assert.ok(span.classList.contains('f_IgnoredCategories_Hide'));
    assert.ok(icon.classList.contains('TPIcons-cross'));
    assert.equal(toggle.disabled, false);
  } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
  }
});

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

test('harvestExistingIdents extracts and caches tokens from sidebar elements', () => {
  saveStoredIdents({});
  const sidebar = createMockElement('div', { className: 'Plugin_CategoryMainSelectionLeft' });
  const span1 = createMockElement('span', { className: 'ignoreCategory' });
  span1.setAttribute('data-vcat-id', '200');
  span1.setAttribute('data-ident', 'ident200');
  sidebar.appendChild(span1);

  const span2 = createMockElement('span', { className: 'ignoreCategory' });
  span2.setAttribute('data-vcat-id', '900');
  span2.setAttribute('data-ident', 'ident900');
  sidebar.appendChild(span2);

  harvestExistingIdents(sidebar);

  const idents = getStoredIdents();
  assert.equal(idents['200'], 'ident200');
  assert.equal(idents['900'], 'ident900');
});

test('syncSearchResultsIgnoredState synchronizes hit items with active ignored chips', () => {
  const prevDoc = globalThis.document;
  try {
    const resultsBox = createMockElement('div', { className: 'tp-cat-search-results' });
    const item = createMockElement('div', { className: 'tp-cat-result-item' });
    item.setAttribute('data-vcat-id', '200');
    const span = createMockElement('span', { className: 'ignoreCategory f_IgnoredCategories_Hide' });
    span.setAttribute('data-vcat-id', '200');
    const icon = createMockElement('i', { className: 'TPIcons-cross' });
    span.appendChild(icon);
    item.appendChild(span);
    resultsBox.appendChild(item);

    const bar = createMockElement('div', { className: 'Plugin_IgnoredCategories' });
    const root = createMockElement('div');
    root.appendChild(resultsBox);
    root.appendChild(bar);

    globalThis.document = {
      querySelectorAll: sel => root.querySelectorAll(sel),
      querySelector: sel => root.querySelector(sel),
      createElement: tag => createMockElement(tag)
    };

    // Active
    assert.ok(!item.classList.contains('ignoredCategoryEntry'));
    assert.ok(span.classList.contains('f_IgnoredCategories_Hide'));

    // Chip added
    const chip = createMockElement('span', { className: 'ignoredCategory' });
    chip.setAttribute('data-vcat-id', '200');
    bar.appendChild(chip);

    syncSearchResultsIgnoredState(resultsBox);

    const showSpan = item.querySelector('.ignoreCategory.f_IgnoredCategories_Show');
    assert.ok(item.classList.contains('ignoredCategoryEntry'));
    assert.ok(showSpan);
    assert.equal(showSpan.getAttribute('title'), 'Kategorie einblenden');
    assert.ok(showSpan.querySelector('i')?.classList?.contains('TPIcons-plus'));

    // Chip removed
    chip.remove();
    syncSearchResultsIgnoredState(resultsBox);

    const hideSpan = item.querySelector('.ignoreCategory.f_IgnoredCategories_Hide');
    assert.ok(!item.classList.contains('ignoredCategoryEntry'));
    assert.ok(hideSpan);
    assert.equal(hideSpan.getAttribute('title'), 'Kategorie ausblenden');
    assert.ok(hideSpan.querySelector('i')?.classList?.contains('TPIcons-cross'));
  } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
  }
});

test('addIgnoredCategoryChip, removeIgnoredCategoryChip, and resetAllIgnoredCategoryChips manage chip lifecycle', () => {
  const prevDoc = globalThis.document;
  try {
    const root = createMockElement('div');
    const bar = createMockElement('div', { className: 'Plugin_IgnoredCategories' });
    const barContainer = createMockElement('div', { className: 'ignoredCategoriesBar' });
    const hint = createMockElement('span', { className: 'ignoreCategoryHint' });
    hint.textContent = 'Hint';
    barContainer.appendChild(hint);
    bar.appendChild(barContainer);
    root.appendChild(bar);

    globalThis.document = {
      createElement: tag => createMockElement(tag),
      querySelector: sel => root.querySelector(sel),
      querySelectorAll: sel => root.querySelectorAll(sel)
    };

    // 1. Add first chip
    addIgnoredCategoryChip('200', 'Computer & Zubehör', 'ident200', globalThis.document);
    assert.equal(bar.getAttribute('data-ignored-count'), '1');
    assert.equal(barContainer.querySelector('.ignoreCategoryHint'), null);
    assert.ok(barContainer.querySelector('.label'));
    assert.ok(barContainer.querySelector('.resetAll'));
    const chip200 = barContainer.querySelector('.ignoredCategory[data-vcat-id="200"]');
    assert.ok(chip200);
    assert.equal(chip200.getAttribute('data-ident'), 'ident200');

    // 2. Add duplicate chip (should be no-op)
    addIgnoredCategoryChip('200', 'Computer & Zubehör', 'ident200', globalThis.document);
    assert.equal(bar.getAttribute('data-ignored-count'), '1');

    // 3. Add second chip
    addIgnoredCategoryChip('900', 'Videogames', 'ident900', globalThis.document);
    assert.equal(bar.getAttribute('data-ignored-count'), '2');
    const chip900 = barContainer.querySelector('.ignoredCategory[data-vcat-id="900"]');
    assert.ok(chip900);

    // 4. Remove one chip
    removeIgnoredCategoryChip('200', globalThis.document);
    assert.equal(bar.getAttribute('data-ignored-count'), '1');
    assert.equal(barContainer.querySelector('.ignoredCategory[data-vcat-id="200"]'), null);
    assert.ok(barContainer.querySelector('.ignoredCategory[data-vcat-id="900"]'));

    // 5. Remove remaining chip -> restores hint
    removeIgnoredCategoryChip('900', globalThis.document);
    assert.equal(bar.getAttribute('data-ignored-count'), '0');
    assert.ok(barContainer.querySelector('.ignoreCategoryHint'));
    assert.equal(barContainer.querySelector('.label'), null);
    assert.equal(barContainer.querySelector('.resetAll'), null);

    // 6. Reset all clears chips and restores hint
    addIgnoredCategoryChip('200', 'Computer & Zubehör', 'ident200', globalThis.document);
    addIgnoredCategoryChip('900', 'Videogames', 'ident900', globalThis.document);
    assert.equal(bar.getAttribute('data-ignored-count'), '2');
    resetAllIgnoredCategoryChips(globalThis.document);
    assert.equal(bar.getAttribute('data-ignored-count'), '0');
    assert.ok(barContainer.querySelector('.ignoreCategoryHint'));
  } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
  }
});

test('ensureCategoryIdent returns cached token or resolves from parent page', async () => {
  saveStoredIdents({ '500': 'token500' });

  // 1. Existing stored token
  const resCached = await ensureCategoryIdent({ vcatId: '500' });
  assert.equal(resCached, 'token500');

  // 2. Fetch from parent page
  const prevFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      assert.ok(url.includes('Computer-Zubehoer-c200'));
      return {
        ok: true,
        text: async () => `
          <span class="ignoreCategory f_IgnoredCategories_Hide" data-vcat-id="600" data-ident="token600">✕</span>
        `
      };
    };

    const tree = {
      byId: new Map([
        ['c600', { id: 'c600', numericId: '600', parentID: 'c200' }],
        ['c200', { id: 'c200', numericId: '200', url: '/produktsuche/Computer-Zubehoer-c200' }]
      ])
    };

    const resFetched = await ensureCategoryIdent({ vcatId: '600' }, tree);
    assert.equal(resFetched, 'token600');
    assert.equal(getStoredIdents()['600'], 'token600');
  } finally {
    if (prevFetch === undefined) delete globalThis.fetch; else globalThis.fetch = prevFetch;
  }
});
