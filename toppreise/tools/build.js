#!/usr/bin/env node
/**
 * Zero-dependency Bundler for Toppreise.ch Suite Userscript
 * Compiles modular sources from src/ into the distributable toppreise.user.js artifact.
 *
 * Usage:
 *   node tools/build.js          # Build toppreise.user.js
 *   node tools/build.js --check  # Verify toppreise.user.js matches build output (CI check)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOPPREISE_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(TOPPREISE_DIR, 'src');
const OUTPUT_FILE = path.join(TOPPREISE_DIR, 'toppreise.user.js');
const DEMO_BUNDLE_FILE = path.join(TOPPREISE_DIR, 'site', 'demo', 'toppreise.user.js');

function stripModuleSyntax(code) {
  return code
    // Remove top-level import statements (single or multiline)
    .replace(/^import\s+[^;]+;\s*$/gm, '')
    // Remove export default class/function name
    .replace(/^export\s+default\s+(async\s+)?(function|class)\s+/gm, '$1$2 ')
    // Remove export default expression / identifier / object
    .replace(/^export\s+default\s+[^;]+;\s*$/gm, '')
    // Replace export const / let / var / function / class / async function
    .replace(/^export\s+(async\s+)?(const|let|var|function|class)\s+/gm, '$1$2 ')
    // Remove export * from ... / export * as foo from ...
    .replace(/^export\s*\*\s*(?:as\s+[A-Za-z_$][\w$]*\s+)?from\s+[^;]+;\s*$/gm, '')
    // Remove export { ... } [from '...']
    .replace(/^export\s*\{[^}]*\}\s*(?:from\s+[^;]+)?;\s*$/gm, '')
    .trim();
}

export { stripModuleSyntax };

export function buildBundle() {
  // Styles assemble from parts in order (barrel composes STYLES at runtime;
  // its import/export lines strip out, leaving `const STYLES = …`).
  const STYLE_PARTS = ['ui/styles/tokens.js', 'ui/styles/cards.js', 'ui/styles/chrome.js', 'ui/styles/overlays.js', 'ui/styles.js', 'ui/styles/shadow-modal.js'];
  const stylesCode = STYLE_PARTS.map(rel => stripModuleSyntax(fs.readFileSync(path.join(SRC_DIR, rel), 'utf-8'))).join('\n\n');
  // Relpaths in load-bearing bundle order.
  const MODULES = [
    'page/selectors.js',
    'domain/price.js',
    'domain/deal-score.js',
    'scanner/cache.js',
    'ui/mini-toggle.js',
    'state/config-store.js',
    'state/config-migrate.js',
    'state/config.js',
    'state/config-sync.js',
    'state/store.js',
    'page/adapter.js',
    'page/cards.js',
    'page/product-offers.js',
    'features/category-tree-model.js',
    'features/category-tree.js',
    'ui/sparkline.js',
    'features/discord-recipe.js',
    'features/tavily-search.js',
    'features/share-discord.js',
    'page/sort.js',
    'scanner/scanner.js',
    'ui/fresh-dismiss.js',
    'ui/badges/dom-helpers.js',
    'ui/badges/deal-badge.js',
    'ui/badges/deal-verdict.js',
    'ui/badges/card-share.js',
    'ui/badges/card-ai-popover.js',
    'ui/badges/card-chrome.js',
    'ui/badges.js',
    'ui/shell.js',
    'ui/modal-template-sections.js',
    'ui/modal-template.js',
    'ui/modal-bindings.js',
    'ui/modal-actions.js',
    'ui/modal.js',
    'ui/modal-share-preview.js',
    'ui/toast.js',
    'ui/calc-preset-data.js',
    'ui/calc-preview.js',
    'ui/toolbar-calc.js',
    'ui/toolbar-filter.js',
    'ui/toolbar.js',
    'ui/floating-cta.js',
    'features/price-alarm.js',
    'features/product-detail.js',
  ];
  const banner = r => `// ─── MODULE: src/${r} `.padEnd(79, '─');
  const modulesBlock = MODULES.map(rel => {
    const code = stripModuleSyntax(fs.readFileSync(path.join(SRC_DIR, rel), 'utf-8'));
    const padded = code.split('\n').map(line => line.trim() ? `  ${line}` : line).join('\n');
    return `  ${banner(rel)}\n${padded}`;
  }).join('\n\n');
  const rawAppCode = fs.readFileSync(path.join(SRC_DIR, 'app.js'), 'utf-8');

  // Strip top imports from app.js
  const appCodeClean = stripModuleSyntax(rawAppCode);

  // Extract Userscript metadata header
  const headerMatch = appCodeClean.match(/(\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==)/);
  if (!headerMatch) {
    throw new Error('UserScript metadata header not found in src/app.js');
  }
  const header = headerMatch[1];

  // Version single-source: the @version header is authoritative; the runtime
  // fallback literal in the IIFE body must match it or --check fails.
  const headerVersion = (header.match(/@version\s+(\S+)/) || [])[1];
  const fallbackVersion = (appCodeClean.match(/\|\|\s*'(\d+\.\d+\.\d+)'/) || [])[1];
  if (!headerVersion) throw new Error('No @version found in src/app.js header');
  if (fallbackVersion !== headerVersion) {
    throw new Error(`Version drift: header @version ${headerVersion} but runtime fallback '${fallbackVersion}'. Sync the fallback literal in src/app.js.`);
  }

  // Extract everything after metadata header up to (() => { 'use strict';
  const afterHeader = appCodeClean.slice(headerMatch.index + headerMatch[0].length);
  const iifeIndex = afterHeader.indexOf("(() => {");
  if (iifeIndex === -1) {
    throw new Error("Could not find '(() => {' in src/app.js");
  }

  const topDeclarations = afterHeader.slice(0, iifeIndex).trim();
  const restOfIife = afterHeader.slice(iifeIndex);

  // restOfIife starts with (() => { ... find 'use strict';
  const strictMatch = restOfIife.match(/\(\(\)\s*=>\s*\{\s*['"]use strict['"];?/);
  if (!strictMatch) {
    throw new Error("Could not find 'use strict' inside IIFE");
  }

  const iifeBody = restOfIife.slice(strictMatch.index + strictMatch[0].length).trim();

  // Assemble the bundle
  const bundle = `${header}

// ─── GENERATED BUNDLE - DO NOT EDIT DIRECTLY ─────────────────────────────────
// Source modules are located in src/.
// Built with: node tools/build.js
// ─────────────────────────────────────────────────────────────────────────────

${topDeclarations}

// ─── STYLES ──────────────────────────────────────────────────────────────────
${stylesCode}

(() => {
  'use strict';

${modulesBlock}

  // ─── APPLICATION & LIFECYCLE LOGIC ──────────────────────────────────────────
${iifeBody}
`;

  return bundle;
}

function main() {
  const isCheckMode = process.argv.includes('--check');

  console.log('🔨 Assembling Toppreise Userscript bundle...');
  const bundle = buildBundle();

  // Syntax validation (no execution, no tmp file, no child process).
  try {
    new vm.Script(bundle, { filename: 'toppreise.user.js' });
  } catch (err) {
    console.error('❌ Syntax validation failed on generated bundle:');
    console.error(err.message);
    process.exit(1);
  }

  const bundleSizeKb = (Buffer.byteLength(bundle, 'utf-8') / 1024).toFixed(2);
  const bundleLines = bundle.split('\n').length;

  if (isCheckMode) {
    if (!fs.existsSync(OUTPUT_FILE)) {
      console.error(`❌ Output file ${OUTPUT_FILE} does not exist.`);
      process.exit(1);
    }
    const currentOnDisk = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    if (currentOnDisk !== bundle) {
      console.error('❌ Drift detected! toppreise.user.js does not match src/ modules.');
      console.error('Run "node tools/build.js" to regenerate the bundle.');
      process.exit(1);
    }
    if (fs.existsSync(DEMO_BUNDLE_FILE)) {
      const demoOnDisk = fs.readFileSync(DEMO_BUNDLE_FILE, 'utf-8');
      if (demoOnDisk !== bundle) {
        console.error('❌ Drift detected! site/demo/toppreise.user.js does not match bundle.');
        console.error('Run "node tools/build.js" to regenerate the bundle.');
        process.exit(1);
      }
    }
    console.log(`✅ Build check passed! toppreise.user.js is up-to-date (${bundleLines} lines, ${bundleSizeKb} KB).`);
    return;
  }

  const tmpFile = `${OUTPUT_FILE}.tmp.${process.pid}.${Date.now()}`;
  try {
    fs.writeFileSync(tmpFile, bundle, 'utf-8');
    fs.renameSync(tmpFile, OUTPUT_FILE);
    if (fs.existsSync(path.dirname(DEMO_BUNDLE_FILE))) {
      fs.writeFileSync(DEMO_BUNDLE_FILE, bundle, 'utf-8');
    }
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch {}
    throw err;
  }
  console.log(`✅ Successfully generated ${path.relative(process.cwd(), OUTPUT_FILE)}:`);
  console.log(`   • Size : ${bundleSizeKb} KB`);
  console.log(`   • Lines: ${bundleLines}`);
}

main();
