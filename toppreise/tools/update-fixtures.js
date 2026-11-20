#!/usr/bin/env node
/**
 * Automated Live Fixture Fetcher & Mock Synthesizer for Toppreise.ch
 *
 * Usage:
 *   node toppreise/tools/update-fixtures.js            # Update all fixtures & mock_toppreise.html
 *   node toppreise/tools/update-fixtures.js --check    # Audit live DOM selectors for drift (dry run)
 *   node toppreise/tools/update-fixtures.js --target=neue  # Update specific fixture
 */

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const TOPPREISE_DIR = join(REPO_ROOT, 'toppreise');
const TESTS_DIR = join(TOPPREISE_DIR, 'tests');
const FIXTURES_DIR = join(TESTS_DIR, 'fixtures');
const ASSETS_DIR = join(FIXTURES_DIR, 'assets');
const MANIFEST_PATH = join(FIXTURES_DIR, 'manifest.json');
const MOCK_HTML_PATH = join(TESTS_DIR, 'mock_toppreise.html');
const TEST_CARDS_PATH = join(FIXTURES_DIR, 'mock_test_cards.html');
const CAPTURE_VIEW_SCRIPT = join(__dirname, 'capture-view-fixtures.py');
const VENV_PYTHON = join(REPO_ROOT, 'venv', 'bin', 'python');
const LAZY_LOAD_SVG_DATA_URI = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22/%3E';

const TARGETS = {
  neue: {
    name: 'live_neue_toppreise.html',
    url: 'https://www.toppreise.ch/neue-toppreise',
    requiredSelectors: [
      '.Plugin_Product.medium-box',
      '.product-name',
      '.Plugin_PriceInformation',
      '.badge-dif',
      '.relevanceHint',
      '.fillUpSeparator'
    ]
  },
  category: {
    name: 'live_category_browsing.html',
    url: 'https://www.toppreise.ch/produktsuche/HiFi-Audio/Kopfhoerer-Headsets/Over-On-Ear-Kopfhoerer-c3308',
    requiredSelectors: [
      '.standardList.list',
      '.Plugin_ListView',
      '.Plugin_Product, .Plugin_ProductCollItem',
      '.product-name',
      '.Plugin_PriceInformation',
      '.action'
    ]
  },
  categoryBox: {
    name: 'live_category_box.html',
    url: 'https://www.toppreise.ch/produktsuche/HiFi-Audio/Kopfhoerer-Headsets/Over-On-Ear-Kopfhoerer-c3308',
    viewMode: 'box',
    requiredSelectors: [
      '.standardList.box',
      '.Plugin_ListView',
      '.Plugin_Product, .Plugin_ProductCollItem',
      '.product-name',
      '.Plugin_PriceInformation',
      '.action'
    ]
  },
  categoryExpert: {
    name: 'live_category_expert.html',
    url: 'https://www.toppreise.ch/produktsuche/HiFi-Audio/Kopfhoerer-Headsets/Over-On-Ear-Kopfhoerer-c3308',
    viewMode: 'expe',
    requiredSelectors: [
      '.standardList.expert',
      '.Plugin_ListView',
      '.Plugin_Product, .Plugin_ProductCollItem',
      '.product-name',
      '.Plugin_PriceInformation',
      '.action'
    ]
  },
  product: {
    name: 'live_product_detail.html',
    url: 'https://www.toppreise.ch/preisvergleich/Kopfhoerer/APPLE-AirPods-Pro-3-mit-MagSafe-Ladecase-MFHP4ZM-A-p818734?selsort=rd',
    requiredSelectors: [
      '.Plugin_PriceInformation, .priceContainer',
      '.product-name, h1, .Plugin_ProductHeading',
      '.Plugin_PriceRating, .priceRating'
    ]
  }
};

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';

/**
 * Fetch a URL using curl for maximum environment & proxy resilience
 */
function fetchUrl(url) {
  try {
    const output = execFileSync('curl', [
      '-sSL',
      '--compressed',
      '-H', `User-Agent: ${USER_AGENT}`,
      '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '-H', 'Accept-Language: de-CH,de;q=0.9,en;q=0.8',
      url
    ], {
      encoding: 'utf-8',
      maxBuffer: 15 * 1024 * 1024
    });
    return output;
  } catch (err) {
    throw new Error(`Failed to fetch ${url}: ${err.message}`);
  }
}

/**
 * Resolve relative or protocol-relative asset URLs against Toppreise origin
 */
function resolveToppreiseUrl(href) {
  if (!href) return null;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) return `https://www.toppreise.ch${href}`;
  return `https://www.toppreise.ch/${href}`;
}

/**
 * Extract active non-print CSS stylesheet hrefs (standard.css / page_product.css)
 */
function extractStylesheetHrefs(html) {
  const hrefs = {};
  const linkRe = /<link\b[^>]*>/gi;
  let match;
  while ((match = linkRe.exec(html)) !== null) {
    const tag = match[0];
    if (!/\brel=["'][^"']*stylesheet[^"']*["']/i.test(tag)) continue;
    if (/\bmedia=["']print["']/i.test(tag)) continue;
    const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (/\/standard\.css(?:\?|$)/i.test(href) && !hrefs['standard.css']) {
      hrefs['standard.css'] = resolveToppreiseUrl(href);
    } else if (/\/page_product\.css(?:\?|$)/i.test(href) && !hrefs['page_product.css']) {
      hrefs['page_product.css'] = resolveToppreiseUrl(href);
    }
  }
  return hrefs;
}

/**
 * Sanitize fetched CSS for offline Playwright rendering
 */
function sanitizeCss(css) {
  return css
    .replace(/@import\s+url\([^)]*\)\s*;?/gi, '')
    .replace(/url\(["']?https?:\/\/fonts\.(?:googleapis|gstatic)\.com[^)"']*["']?\)/gi, 'url("")');
}

/**
 * Extract Plugin_ListView data-idf from category HTML
 */
function extractListViewIdf(html) {
  const idfMatch = html.match(/Plugin_ListView[^>]*\bdata-idf=["']([^"']+)["']/i) ||
    html.match(/\bdata-idf=["']([^"']+)["'][^>]*Plugin_ListView/i);
  return idfMatch ? idfMatch[1] : null;
}

/**
 * Check if HTML contains the expected category view layout class
 */
function hasViewLayout(html, viewMode) {
  const layoutClass = viewMode === 'box' ? 'box' : 'expert';
  const hasContainer = new RegExp(`class=["'][^"']*\\bstandardList\\b[^"']*\\b${layoutClass}\\b`, 'i').test(html);
  const hasCard = /Plugin_Product|Plugin_ProductCollItem/.test(html);
  return hasContainer && hasCard;
}

/**
 * Capture category view via query param first, falling back to Playwright helper
 */
function fetchCategoryView(target, baseCategoryHtml) {
  const idf = baseCategoryHtml ? extractListViewIdf(baseCategoryHtml) : null;
  if (idf) {
    const sep = target.url.includes('?') ? '&' : '?';
    const paramUrl = `${target.url}${sep}${encodeURIComponent(idf)}_view=${encodeURIComponent(target.viewMode)}`;
    try {
      const html = fetchUrl(paramUrl);
      if (hasViewLayout(html, target.viewMode)) {
        return html;
      }
      console.log(`  • Query param ${idf}_view=${target.viewMode} did not switch layout; falling back to Playwright...`);
    } catch (err) {
      console.log(`  • Query param fetch failed (${err.message}); falling back to Playwright...`);
    }
  } else {
    console.log('  • Could not find Plugin_ListView data-idf; falling back to Playwright...');
  }

  return execFileSync(VENV_PYTHON, [CAPTURE_VIEW_SCRIPT, target.url, target.viewMode], {
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024
  });
}

/**
 * Sanitize live HTML for offline browser testing safety
 */
function sanitizeLiveHtml(html) {
  let sanitized = html;

  // 1. Remove all external tracking scripts, analytics, and inline navigation observers
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, (match) => {
    // Keep only JSON-LD structured data (AggregateOffer tests depend on this)
    if (/type=["']application\/ld\+json["']/i.test(match)) {
      return match;
    }
    return '';
  });

  // 2. Remove tracking iframes and noscript blocks
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

  // 3. Remove cookie / consent banners & modals
  sanitized = sanitized.replace(/<div\b[^>]*\b(?:fc-consent-root|fc-dialog|cookie-banner|consentModal)[^>]*>[\s\S]*?<\/div>/gi, '');

  // 4. Remove print stylesheets and rewrite standard.css / page_product.css to local assets/
  sanitized = sanitized.replace(/<link\b[^>]*\bmedia=["']print["'][^>]*>/gi, '');
  sanitized = sanitized.replace(
    /(<link\b[^>]*\bhref=["'])[^"']*\/(standard\.css|page_product\.css)(?:\?[^"']*)?(["'][^>]*>)/gi,
    '$1assets/$2$3'
  );

  // 5. Replace lazy-load.svg placeholders with inline 1x1 SVG so thumbnails keep dimensions offline
  sanitized = sanitized.replace(
    /(\bsrc=["'])(?:https?:\/\/www\.toppreise\.ch)?\/files-[^"']*\/lazy-load\.svg(?:\?[^"']*)?(["'])/gi,
    `$1${LAZY_LOAD_SVG_DATA_URI}$2`
  );

  // 6. Rewrite remaining relative asset URLs to absolute Toppreise origin
  sanitized = sanitized.replace(/(href|src)=["']\/(files-[^"']+)["']/gi, '$1="https://www.toppreise.ch/$2"');

  // 7. Clean up duplicate empty lines
  sanitized = sanitized.replace(/\n\s*\n\s*\n/g, '\n\n');

  return sanitized;
}

/**
 * Extract category browsing snippet for <template id="mock-category-browsing-template">
 */
function extractCategoryBrowsingSnippet(categoryHtml) {
  const pageBrowsingStart = categoryHtml.indexOf('class="Page_Browsing"');
  if (pageBrowsingStart === -1) {
    return null;
  }
  const tagStart = categoryHtml.lastIndexOf('<div', pageBrowsingStart);
  if (tagStart === -1) return null;

  // Extract from container
  const browsingListIndex = categoryHtml.indexOf('class="Plugin_MixedBrowsingList', tagStart);
  if (browsingListIndex === -1) return null;
  const listStart = categoryHtml.lastIndexOf('<div', browsingListIndex);

  // Take the snippet up to 2 cards
  const snippetEnd = categoryHtml.indexOf('</div>\n    </div>\n  </div>', listStart + 1000);
  if (snippetEnd !== -1) {
    return categoryHtml.substring(tagStart, snippetEnd + 21);
  }
  return null;
}

/**
 * Audit live HTML against required CSS selectors
 */
function auditHtmlSelectors(html, targetKey) {
  const target = TARGETS[targetKey];
  const results = [];

  for (const selector of target.requiredSelectors) {
    // Split selector on ',' into alternatives; require EVERY .className in at least one alternative
    const alternatives = selector.split(',').map((s) => s.trim()).filter(Boolean);
    let matched = false;
    for (const alt of alternatives) {
      const classes = alt.match(/\.[a-zA-Z0-9_-]+/g) || [];
      if (classes.length > 0 && classes.every((cls) => html.includes(cls.slice(1)))) {
        matched = true;
        break;
      }
    }
    results.push({ selector, ok: matched });
  }

  return results;
}

/**
 * Assemble mock_toppreise.html from live neue-toppreise shell and test fixtures
 */
function buildMockToppreiseHtml(liveNeueHtml, cardsPartialHtml, existingMockHtml) {
  let mockHtml = liveNeueHtml;

  // Comprehensive mock styles ensuring robust offline rendering in Playwright
  const mockStyles = `
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #fff; color: #0f172a; }
    .container { width: 100%; max-width: 1400px; margin: 0 auto; padding: 0 15px; }
    .row { display: flex; flex-wrap: wrap; margin-right: -10px; margin-left: -10px; }
    .no-gutters { margin-right: 0; margin-left: 0; }
    .col-auto { flex: 0 0 auto; width: auto; max-width: 100%; }
    .col-12 { flex: 0 0 100%; max-width: 100%; padding: 0 10px; }
    .col-sm-6 { flex: 0 0 50%; max-width: 50%; padding: 0 10px; }
    .col-md-6 { flex: 0 0 50%; max-width: 50%; padding: 0 10px; }
    .col-lg-4 { flex: 0 0 33.333333%; max-width: 33.333333%; padding: 0 10px; }
    .col-lg-3 { flex: 0 0 25%; max-width: 25%; padding: 0 10px; }
    .col-xl { flex-basis: 0; flex-grow: 1; max-width: 100%; padding: 0 10px; }
    .col-xxxl-3 { flex: 0 0 25%; max-width: 25%; padding: 0 10px; }
    .p-0 { padding: 0 !important; }
    .pr-md-3 { padding-right: 1rem !important; }

    .Plugin_Product {
      display: block;
      text-decoration: none;
      color: inherit;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 16px;
      margin-bottom: 16px;
      border-radius: 8px;
      position: relative;
    }
    .product-name { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #0f172a; }
    .priceContainer { display: flex; gap: 4px; font-size: 14px; }
    .Plugin_Price { font-weight: 700; color: #10b981; }
    .badge { position: absolute; top: 10px; right: 10px; border-radius: 50%; width: 50px; height: 50px; text-align: center; }
    .badge-dif { background: #dc2626; color: #fff; }
    .badge-dif .text { font-size: 9px; line-height: 12px; margin-top: 10px; }
    .badge-dif p { margin: 0; font-size: 13px; font-weight: bold; }
    .Plugin_DealerRelProdPriceInfo { display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px; color: #64748b; }
    .offersCount { font-size: 11px; color: #64748b; margin-top: 2px; }
    .hideCategoryTrigger { position: absolute; top: 0; right: 0; z-index: 3; cursor: pointer; opacity: 0; padding: 5px; line-height: 1; color: #64748b; transition: opacity 0.2s, color 0.2s; }
    .Plugin_Product:hover .hideCategoryTrigger { opacity: 0.65; }
    .Plugin_Product .hideCategoryTrigger:hover { color: #f43f5e; opacity: 1; }
    .Plugin_Product.hasHideTrigger .product-name { padding-right: 22px; }
    .tp-card-marked-hidden { opacity: 0.25 !important; }

    .sidebar-container { min-width: 220px; }
    .sidebar-title { font-weight: bold; margin-bottom: 10px; }
    .category-tree { list-style: none; padding-left: 0; }
    .tabbedContainer { display: flex; gap: 10px; margin-bottom: 15px; }
    .tab { padding: 8px 16px; background: #e2e8f0; border-radius: 4px; cursor: pointer; }
    .tab.active { background: #2563eb; color: #fff; }
    .timeframe-row { display: flex; gap: 8px; align-items: center; margin-bottom: 20px; }
    .time-btn { padding: 4px 10px; background: #e2e8f0; border-radius: 4px; cursor: pointer; }
    .time-btn.active { background: #2563eb; color: #fff; }
    .h-100 { height: 100% !important; }
    .d-flex { display: flex !important; }
    .flex-column { flex-direction: column !important; }
    .justify-content-between { justify-content: space-between !important; }
    .align-items-center { align-items: center !important; }

    /* Ignored categories & sidebar styles */
    .Plugin_CategoryMainSelectionLeft { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
    .Plugin_CategoryMainSelectionLeft .label.bold { font-weight: 700; margin-bottom: 8px; }
    .Plugin_CategoryMainSelectionLeft .label.bold a { color: #0f172a; text-decoration: none; }
    .Plugin_CategoryMainSelectionLeft ul { list-style: none; padding-left: 0; margin: 0 0 10px 0; }
    .Plugin_CategoryMainSelectionLeft li { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .Plugin_CategoryMainSelectionLeft li a { color: #64748b; text-decoration: none; flex: 1; }
    .Plugin_CategoryMainSelectionLeft li.ignoredCategoryEntry > a { opacity: 0.45; text-decoration: line-through; }
    .Plugin_IgnoredCategories.ignoredCategoriesBar,
    .Plugin_IgnoredCategories .ignoredCategoriesBar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 4px; margin: 8px 0; font-size: 13px; }
    .Plugin_IgnoredCategories .label { padding: 4px; font-weight: 600; color: #64748b; }
    .Plugin_IgnoredCategories .ignoreCategoryHint { display: inline-block; padding: 5px 4px; color: #64748b; font-size: 12px; }
    .Plugin_IgnoredCategories .ignoredCategory { display: inline-flex; align-items: center; cursor: pointer; background: #f1f5f9; border: 1px solid #475569; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 12px; color: #0f172a; gap: 4px; }
    .Plugin_IgnoredCategories .resetAll { display: inline-block; cursor: pointer; white-space: nowrap; margin-left: auto; background: #f1f5f9; border: 1px solid #475569; padding: 0.25rem 0.5rem; border-radius: 4px; color: #f43f5e; font-size: 12px; text-decoration: none; }
    .availabilityInformationIcon, .TPIcons-avail_1 { display: inline-block; width: 16px; height: 16px; background: #10b981; border-radius: 50%; }
    .col { flex-basis: 0; flex-grow: 1; min-width: 0; max-width: 100%; }
    .col-md { flex-basis: 0; flex-grow: 1; min-width: 0; max-width: 100%; }
    .col-sm-auto { flex: 0 0 auto; width: auto; max-width: 100%; }
    .col-lg-auto { flex: 0 0 auto; width: auto; max-width: 100%; }
    .col-xl-auto { flex: 0 0 auto; width: auto; max-width: 100%; }
    .col-xxl-auto { flex: 0 0 auto; width: auto; max-width: 100%; }
    .flex-row { flex-direction: row !important; }
    .align-items-end { align-items: flex-end !important; }
    .align-self-center { align-self: center !important; }
    .align-self-start { align-self: flex-start !important; }
    .align-self-end { align-self: flex-end !important; }
    .justify-content-end { justify-content: flex-end !important; }
    .w-100 { width: 100% !important; }
    .ml-auto { margin-left: auto !important; }
    .text-right { text-align: right !important; }
    .bold { font-weight: 700; color: #0f172a; text-decoration: none; }
    .product-features { font-size: 13px; color: #64748b; text-decoration: none; }
    .Page_Browsing a { color: #0f172a; text-decoration: none; }

    /* Collection and Subcards */
    .Plugin_ProductCollItem {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .Plugin_ProductCollItem .product-name {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .Plugin_ProductCollectionRelProductsList {
      margin-top: 12px;
      border-top: 1px solid #e2e8f0;
      padding-left: 0;
    }
    .Plugin_ProductCollectionRelProductsList .f_item {
      border-bottom: 1px solid #e2e8f0;
      padding: 0;
    }
    .Plugin_ProductCollectionRelProductsList .f_item:last-child {
      border-bottom: none;
    }
    .Plugin_Product.f_collection {
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 10px 0 !important;
      margin-bottom: 0 !important;
      box-shadow: none !important;
    }
    .Plugin_Product.f_collection .action,
    .Plugin_Product.f_collection .hoverBox {
      display: none !important;
    }
    .priceContainer.shippingPrice { font-size: 14px; font-weight: 700; }
    .priceContainer.shippingPrice .Plugin_Price { font-size: 17px; color: #f59e0b; }
    .priceContainer.productPrice { font-size: 12px; color: #64748b; }
    .shippingText { font-size: 11px; color: #64748b; }
    .offersContainer { font-size: 12px; color: #64748b; }
    #mock-site-dropdown { position: absolute; width: 220px; height: 64px; background: #fff; border: 1px solid #0f172a; z-index: 31; display: none; }
  </style>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Product","name":"Mock Product","offers":{"@type":"AggregateOffer","lowPrice":"16.95","highPrice":"82.00","offerCount":6,"priceCurrency":"CHF"}}
  </script>`;

  mockHtml = mockHtml.replace('</head>', `${mockStyles}\n</head>`);

  // Replace live product card list with deterministic test cards
  // Find container: Plugin_TopPriceReductionProductListFull
  const listPos = mockHtml.indexOf('Plugin_TopPriceReductionProductListFull');
  if (listPos !== -1) {
    const containerStart = mockHtml.indexOf('<div', listPos);
    // Find closing before FrameContentEnd or next major section
    const nextSectionPos = mockHtml.indexOf('id="FrameContentEnd"', listPos);
    if (containerStart !== -1 && nextSectionPos !== -1) {
      const closingPos = mockHtml.lastIndexOf('</div>', nextSectionPos);
      mockHtml = mockHtml.substring(0, containerStart) +
        `<div id="Plugin_TopPriceReductionProductListFull_mock" class="Plugin_TopPriceReductionProductListFull standardListWithoutBorder">\n` +
        cardsPartialHtml +
        `\n</div>` +
        mockHtml.substring(closingPos + 6);
    }
  }

  // Preserve test layout landmarks & classes for layout fidelity tests
  mockHtml = mockHtml.replace(/class="filterBoxContainer[^"]*"/g, 'class="filterBoxContainer col-auto p-0 pr-md-3 sidebar-container" id="sidebar-categories"');
  mockHtml = mockHtml.replace(/<div class="contentBox col-12 col-xl">/, '<div class="contentBox col-12 col-xl main-content-col" id="main-content">');
  mockHtml = mockHtml.replace(/<div class="tabbedContainer row">/, '<div class="tabbedContainer row tabs-row" id="feed-tabs">');
  mockHtml = mockHtml.replace(/id="Plugin_TimePeriod_\d+"/, 'id="timeframe-filter"');
  mockHtml = mockHtml.replace(/class="Plugin_Breadcrumbs/g, 'class="Plugin_Breadcrumbs breadcrumb');
  mockHtml = mockHtml.replace(/class="category_level_0\s+showExpandedOnly"/g, 'class="category_level_0 showExpandedOnly" style="display: none;"');

  // Preserve test interactive elements & dialogs
  const testInteractiveElements = `
  <!-- Site dropdown mock for stacking tests -->
  <div id="mock-site-dropdown" aria-hidden="true">Site-Navigation</div>

  <!-- Native bell trigger mock -->
  <div id="Plugin_NewInfoMailButton_mock" data-context-hash="mock" data-ajax-url="/plugins/infomails/NewInfoMailButton" data-prod-id="797571" data-templ="btn" class="Plugin_NewInfoMailButton hoverBox">
    <a id="mock-alarm-bell" href="/neue-infomail?im_nimf_pid=797571" rel="nofollow noindex" class="f_showNewInfoMailFormDialog d-inline-block" title="Preisalarm"><i class="TPIcons-alarm">🔔</i></a>
  </div>
  <div data-context-hash="mock2" data-ajax-url="/plugins/infomails/NewInfoMailButton" data-prod-id="797572" data-templ="btn" class="Plugin_NewInfoMailButton hoverBox">
    <a href="/neue-infomail?im_nimf_pid=797572" rel="nofollow noindex" class="f_showNewInfoMailFormDialog d-inline-block" title="Preisalarm"><i class="TPIcons-alarm">🔔</i></a>
  </div>

  <!-- Price Alarm Modal Markup -->
  <div class="AbstractDialog AbstractDialog_NewInfoMailFormDialog" style="display: none;" id="mock-alarm-dialog">
    <div class="AbstractDialog_CloseButton">✕</div>
    <div class="Plugin_NewInfoMailForm">
      <div class="shippingPrice"><span class="currency">CHF </span><span class="Plugin_Price">1000.00</span></div>
      <div class="productPrice"><span class="currency">CHF </span><span class="Plugin_Price">1000.00</span></div>
      <input type="text" id="f_NewInfoMailForm_priceFrom" name="im_nimf_pvf" value="" />
      <input type="hidden" name="im_nimf_du" value="" />
      <ul>
        <li data-value="90">3 Monate</li>
        <li data-value="180">6 Monate</li>
        <li data-value="365">1 Jahr</li>
        <li data-value="730">2 Jahre</li>
      </ul>
      <input type="checkbox" id="im_nimf_prtrm" />
      <input type="submit" class="f_submitbtn" value="Speichern" />
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const closeBtn = document.querySelector('#mock-alarm-dialog .AbstractDialog_CloseButton');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          document.querySelector('#mock-alarm-dialog').style.display = 'none';
          document.querySelector('#mock-alarm-dialog').dataset.dialogClosed = 'true';
        });
      }
      const submitBtn = document.querySelector('#mock-alarm-dialog input.f_submitbtn');
      if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
          e.preventDefault();
          document.querySelector('#mock-alarm-dialog').dataset.submitted = 'true';
          document.querySelector('#mock-alarm-dialog').dataset.submittedAt = Date.now();
          setTimeout(() => {
            submitBtn.remove();
            if (window.__tpMockAlarmSuccess !== false) {
              document.querySelector('#mock-alarm-dialog .Plugin_NewInfoMailForm')?.insertAdjacentHTML('beforeend', '<div class="success">Preisalarm gespeichert</div>');
            }
          }, 200);
        });
      }
      // Seed category menu cache in mock fixture
      try {
        const catMenu = document.querySelector('.Plugin_CategoryMenu');
        const hash = catMenu?.getAttribute('data-hash') || 'bbd886';
        if (!localStorage.getItem('c_cm_data_de')) {
          localStorage.setItem('c_cm_hash_de', hash);
          localStorage.setItem('c_cm_data_de', JSON.stringify([
            {
              id: 'c200',
              title: 'Computer &amp; Zubehör',
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
                },
                {
                  id: 'c9',
                  title: 'PC-Komponenten',
                  url: '/produktsuche/Computer-Zubehoer/PC-Komponenten-c9',
                  parentID: 'c200',
                  hasChildren: false
                }
              ]
            },
            {
              id: 'c900',
              title: 'Videogames',
              url: '/produktsuche/Videogames-c900',
              parentID: '',
              hasChildren: false
            }
          ]));
        }
      } catch (e) {}

      // Native category sidebar show more / less
      const showMoreBtn = document.querySelector('.f_showMoreCatDetails');
      const hideMoreBtn = document.querySelector('.f_hideMoreCatDetails');
      if (showMoreBtn && hideMoreBtn) {
        showMoreBtn.addEventListener('click', (e) => {
          e.preventDefault();
          document.querySelectorAll('.Plugin_CategoryMainSelectionLeft li.showExpandedOnly').forEach(el => el.style.display = 'flex');
          showMoreBtn.style.display = 'none';
          hideMoreBtn.style.display = 'block';
        });
        hideMoreBtn.addEventListener('click', (e) => {
          e.preventDefault();
          document.querySelectorAll('.Plugin_CategoryMainSelectionLeft li.showExpandedOnly').forEach(el => el.style.display = 'none');
          showMoreBtn.style.display = 'block';
          hideMoreBtn.style.display = 'none';
        });
      }

      // Native category hide / show chip handlers
      document.body.addEventListener('click', (e) => {
        const hideTrigger = e.target.closest('.f_IgnoredCategories_Hide');
        if (hideTrigger) {
          e.preventDefault();
          e.stopPropagation();
          const vcatId = hideTrigger.getAttribute('data-vcat-id');
          const li = hideTrigger.closest('li') || hideTrigger.closest('.tp-cat-result-item');
          const catName = li ? (li.querySelector('.tp-cat-res-title') || li.querySelector('a'))?.textContent?.trim() : 'Kategorie';
          const bar = document.querySelector('.Plugin_IgnoredCategories');
          if (bar) {
            let barContainer = bar.querySelector('.ignoredCategoriesBar');
            if (barContainer) {
              if (vcatId && barContainer.querySelector(\`.ignoredCategory[data-vcat-id="\${vcatId}"]\`)) return;
              const hint = barContainer.querySelector('.ignoreCategoryHint');
              if (hint) hint.remove();
              let label = barContainer.querySelector('.label');
              if (!label) {
                label = document.createElement('span');
                label.className = 'label';
                label.textContent = 'Ausgeblendet:';
                barContainer.prepend(label);
              }
              const chip = document.createElement('span');
              chip.className = 'ignoredCategory f_IgnoredCategories_Show';
              chip.setAttribute('data-vcat-id', vcatId || '');
              chip.setAttribute('title', 'Wieder einblenden');
              chip.innerHTML = \`\${catName} <span class="removeFilter"><i class="TPIcons-cross">✕</i></span>\`;
              barContainer.appendChild(chip);

              let resetBtn = barContainer.querySelector('.resetAll');
              if (!resetBtn) {
                resetBtn = document.createElement('a');
                resetBtn.className = 'resetAll f_IgnoredCategories_Reset';
                resetBtn.textContent = 'Alle einblenden';
                barContainer.appendChild(resetBtn);
              }
              const count = barContainer.querySelectorAll('.ignoredCategory').length;
              bar.setAttribute('data-ignored-count', String(count));
              if (li) li.classList.add('ignoredCategoryEntry');
            }
          }
        }

        const showTrigger = e.target.closest('.f_IgnoredCategories_Show');
        if (showTrigger) {
          e.preventDefault();
          e.stopPropagation();
          const vcatId = showTrigger.getAttribute('data-vcat-id');
          const chip = showTrigger.closest('.Plugin_IgnoredCategories')
            ? showTrigger
            : document.querySelector(\`.Plugin_IgnoredCategories .ignoredCategory[data-vcat-id="\${vcatId}"]\`);
          if (chip) chip.remove();
          const bar = document.querySelector('.Plugin_IgnoredCategories');
          if (bar) {
            const barContainer = bar.querySelector('.ignoredCategoriesBar');
            const chips = barContainer ? barContainer.querySelectorAll('.ignoredCategory') : [];
            bar.setAttribute('data-ignored-count', String(chips.length));
            if (chips.length === 0 && barContainer) {
              barContainer.innerHTML = '<span class="ignoreCategoryHint">Kategorien, die Sie nicht interessieren, können Sie über das × aus diesen Listen ausblenden.</span>';
            }
          }
          if (vcatId) {
            const sidebarLi = document.querySelector(\`.Plugin_CategoryMainSelectionLeft [data-vcat-id="\${vcatId}"]\`)?.closest('li');
            if (sidebarLi) sidebarLi.classList.remove('ignoredCategoryEntry');
          }
        }

        const resetBtn = e.target.closest('.f_IgnoredCategories_Reset');
        if (resetBtn) {
          e.preventDefault();
          e.stopPropagation();
          const bar = document.querySelector('.Plugin_IgnoredCategories');
          if (bar) {
            bar.setAttribute('data-ignored-count', '0');
            const barContainer = bar.querySelector('.ignoredCategoriesBar');
            if (barContainer) {
              barContainer.innerHTML = '<span class="ignoreCategoryHint">Kategorien, die Sie nicht interessieren, können Sie über das × aus diesen Listen ausblenden.</span>';
            }
          }
          document.querySelectorAll('.Plugin_CategoryMainSelectionLeft li.ignoredCategoryEntry').forEach(li => li.classList.remove('ignoredCategoryEntry'));
        }
      });
    });
  </script>`;

  // Extract category template from existing mock if present
  let categoryTemplate = '';
  const tmplStart = existingMockHtml.indexOf('<template id="mock-category-browsing-template">');
  if (tmplStart !== -1) {
    const tmplEnd = existingMockHtml.indexOf('</template>', tmplStart);
    categoryTemplate = existingMockHtml.substring(tmplStart, tmplEnd + 11);
  }

  // Insert interactive elements and category browsing template before closing body
  mockHtml = mockHtml.replace('</body>', `${testInteractiveElements}\n${categoryTemplate}\n</body>`);

  return mockHtml;
}

/**
 * Count product cards in HTML for manifest reporting
 */
function countProductCards(html) {
  const matches = html.match(/class=["'][^"']*\bPlugin_Product\b[^"']*["']/g);
  return matches ? matches.length : 0;
}

/**
 * Check manifest.json staleness (> 30 days) and local CSS assets
 */
function checkLocalAssetsAndManifest() {
  let ok = true;
  for (const cssFile of ['standard.css', 'page_product.css']) {
    const cssPath = join(ASSETS_DIR, cssFile);
    if (!existsSync(cssPath)) {
      console.error(`  ✖ Missing vendored CSS: ${cssPath}`);
      ok = false;
    } else {
      const css = readFileSync(cssPath, 'utf-8');
      if (cssFile === 'standard.css' && (!css.includes('.standardList') || !css.includes('.Plugin_Product'))) {
        console.error(`  ✖ ${cssFile} missing expected selectors (.standardList / .Plugin_Product)`);
        ok = false;
      } else {
        console.log(`  ✔ CSS asset OK: ${cssFile} (${(css.length / 1024).toFixed(1)} KB)`);
      }
    }
  }

  if (existsSync(MANIFEST_PATH)) {
    try {
      const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
      const ageDays = (Date.now() - Date.parse(manifest.captured_at)) / (1000 * 60 * 60 * 24);
      if (Number.isFinite(ageDays) && ageDays > 30) {
        console.warn(`  ⚠ manifest.json is ${ageDays.toFixed(1)} days old (> 30 days). Consider running npm run fixtures:update.`);
      } else {
        console.log(`  ✔ manifest.json age: ${ageDays.toFixed(1)} days`);
      }
    } catch (err) {
      console.warn(`  ⚠ Could not parse manifest.json: ${err.message}`);
    }
  } else {
    console.warn('  ⚠ manifest.json not found yet (run npm run fixtures:update).');
  }
  return ok;
}

/**
 * Main execution routine
 */
async function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const targetArg = args.find(a => a.startsWith('--target='));
  const selectedTarget = targetArg ? targetArg.split('=')[1] : null;

  if (!existsSync(FIXTURES_DIR)) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  }
  if (!existsSync(ASSETS_DIR)) {
    mkdirSync(ASSETS_DIR, { recursive: true });
  }

  console.log(`[Toppreise Fixture Engine] Running in ${isCheck ? 'AUDIT (--check)' : 'UPDATE'} mode...`);

  const targetsToRun = selectedTarget ? [selectedTarget] : Object.keys(TARGETS);
  let hasFailure = false;
  const fetchedHtmls = {};
  const cssHrefs = {};
  const manifestTargets = {};

  for (const key of targetsToRun) {
    const target = TARGETS[key];
    if (!target) {
      console.error(`[Error] Unknown target: ${key}`);
      process.exit(1);
    }

    console.log(`\nFetching ${key} (${target.url}${target.viewMode ? ` [${target.viewMode}]` : ''})...`);
    try {
      const rawHtml = target.viewMode
        ? fetchCategoryView(target, fetchedHtmls.category)
        : fetchUrl(target.url);
      fetchedHtmls[key] = rawHtml;
      Object.assign(cssHrefs, extractStylesheetHrefs(rawHtml));

      console.log(`  • Fetched: ${(rawHtml.length / 1024).toFixed(1)} KB`);

      const auditResults = auditHtmlSelectors(rawHtml, key);
      for (const res of auditResults) {
        if (res.ok) {
          console.log(`  ✔ Selector matched: ${res.selector}`);
        } else {
          console.error(`  ✖ SELECTOR DRIFT DETECTED: ${res.selector}`);
          hasFailure = true;
        }
      }

      manifestTargets[key] = {
        file: target.name,
        url: target.url,
        viewMode: target.viewMode || null,
        cardCount: countProductCards(rawHtml)
      };

      if (!isCheck) {
        const sanitized = sanitizeLiveHtml(rawHtml);
        const fixturePath = join(FIXTURES_DIR, target.name);
        writeFileSync(fixturePath, sanitized, 'utf-8');
        console.log(`  💾 Saved sanitized snapshot: ${target.name} (${(sanitized.length / 1024).toFixed(1)} KB)`);
      }
    } catch (err) {
      console.error(`  ✖ Failed to process ${key}: ${err.message}`);
      hasFailure = true;
    }
  }

  if (!isCheck) {
    const manifestAssets = {};
    for (const [cssName, cssUrl] of Object.entries(cssHrefs)) {
      try {
        console.log(`\nFetching CSS ${cssName} (${cssUrl})...`);
        const rawCss = fetchUrl(cssUrl);
        const cleanCss = sanitizeCss(rawCss);
        const cssPath = join(ASSETS_DIR, cssName);
        writeFileSync(cssPath, cleanCss, 'utf-8');
        const sha256 = createHash('sha256').update(cleanCss).digest('hex');
        manifestAssets[cssName] = { href: cssUrl, sha256, bytes: Buffer.byteLength(cleanCss, 'utf-8') };
        console.log(`  💾 Saved assets/${cssName} (${(cleanCss.length / 1024).toFixed(1)} KB, sha256:${sha256.slice(0, 12)})`);
      } catch (err) {
        console.error(`  ✖ Failed to fetch CSS ${cssName}: ${err.message}`);
        hasFailure = true;
      }
    }

    const manifest = {
      captured_at: new Date().toISOString(),
      targets: manifestTargets,
      assets: manifestAssets
    };
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    console.log(`\n  💾 Wrote manifest.json`);
  }

  // If updating and 'neue' was processed, rebuild mock_toppreise.html
  if (!isCheck && fetchedHtmls.neue && existsSync(TEST_CARDS_PATH)) {
    console.log('\nSynthesizing refreshed toppreise/tests/mock_toppreise.html...');
    const cardsPartial = readFileSync(TEST_CARDS_PATH, 'utf-8');
    const existingMock = existsSync(MOCK_HTML_PATH) ? readFileSync(MOCK_HTML_PATH, 'utf-8') : '';
    const sanitizedNeue = sanitizeLiveHtml(fetchedHtmls.neue);

    const freshMock = buildMockToppreiseHtml(sanitizedNeue, cardsPartial, existingMock);
    writeFileSync(MOCK_HTML_PATH, freshMock, 'utf-8');
    console.log(`  💾 Wrote mock_toppreise.html (${(freshMock.length / 1024).toFixed(1)} KB)`);
  }

  if (isCheck) {
    console.log('\nChecking local CSS assets & manifest...');
    if (!checkLocalAssetsAndManifest()) {
      hasFailure = true;
    }
    if (hasFailure) {
      console.error('\n[Check Gate] FAILED: Live site selector drift or missing assets detected.');
      process.exit(1);
    } else {
      console.log('\n[Check Gate] PASSED: All live site selectors and assets match.');
      process.exit(0);
    }
  }

  if (hasFailure) {
    console.warn('\n[Warning] Fixtures updated with some warnings.');
  } else {
    console.log('\n[Success] All fixtures and mock_toppreise.html updated cleanly.');
  }
}

main().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
