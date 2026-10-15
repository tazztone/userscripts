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

function stripModuleSyntax(code) {
  return code
    // Remove top-level import statements
    .replace(/^import\s+[^;]+;\s*$/gm, '')
    // Replace export function / export const / export let / export var / export class / export async function
    .replace(/^export\s+(async\s+)?(const|let|var|function|class)\s+/gm, '$1$2 ')
    // Remove export default / export { ... }
    .replace(/^export\s+default\s+[^;]+;\s*$/gm, '')
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    .trim();
}


export function buildBundle() {
  const stylesCode = stripModuleSyntax(fs.readFileSync(path.join(SRC_DIR, 'ui', 'styles.js'), 'utf-8'));
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
    'state/store.js',
    'page/adapter.js',
    'page/cards.js',
    'ui/sparkline.js',
    'page/sort.js',
    'scanner/scanner.js',
    'ui/fresh-dismiss.js',
    'ui/badges.js',
    'ui/shell.js',
    'ui/modal.js',
    'ui/toast.js',
    'ui/calc-preview.js',
    'ui/toolbar.js',
    'ui/floating-cta.js',
    'features/share-discord.js',
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
    console.log(`✅ Build check passed! toppreise.user.js is up-to-date (${bundleLines} lines, ${bundleSizeKb} KB).`);
    return;
  }

  fs.writeFileSync(OUTPUT_FILE, bundle, 'utf-8');
  console.log(`✅ Successfully generated ${path.relative(process.cwd(), OUTPUT_FILE)}:`);
  console.log(`   • Size : ${bundleSizeKb} KB`);
  console.log(`   • Lines: ${bundleLines}`);
}

main();
