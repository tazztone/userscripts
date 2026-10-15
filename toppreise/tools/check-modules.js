#!/usr/bin/env node
/**
 * Zero-dependency module-boundary gate for the Toppreise Suite.
 * (a) Every JS file under src must appear in tools/build.js MODULES —
 *     catches silently-dropped modules (bundle is concat-IIFE, no resolver).
 * (b) Cross-module call check: a `foo(` call in ui/badges.js or
 *     features/price-alarm.js must resolve to a local binding, an import,
 *     or a known global — else it only works via IIFE leakage. Implemented
 *     via the exporting module's export map (crude but precise: no
 *     false positives from function-local bindings).
 *
 * Usage: node tools/check-modules.js (also `npm run lint`)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Entry (app.js) and raw-loaded styles are consumed directly by build.js,
// never via MODULES — exempt by design, not by accident.
const MODULE_EXEMPT = new Set(['app.js', 'ui/styles.js']);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOPPREISE_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(TOPPREISE_DIR, 'src');

const listSrcFiles = dir => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listSrcFiles(p));
    else if (e.name.endsWith('.js')) out.push(path.relative(SRC_DIR, p).replace(/\\/g, '/'));
  }
  return out.sort();
};

const readModules = () => {
  const src = fs.readFileSync(path.join(TOPPREISE_DIR, 'tools', 'build.js'), 'utf-8');
  const grab = name => src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))?.[1] ?? '';
  const names = block => [...block.matchAll(/['"]([^'"]+\.js)['"]/g)].map(m => m[1]);
  return [...names(grab('MODULES')), ...names(grab('STYLE_PARTS'))];
};

const failures = [];
const srcFiles = listSrcFiles(SRC_DIR);
const inModules = new Set(readModules());
for (const f of srcFiles) {
  if (!inModules.has(f) && !MODULE_EXEMPT.has(f)) failures.push(`src/${f} missing from tools/build.js MODULES`);
}
for (const m of inModules) {
  if (!srcFiles.includes(m)) failures.push(`tools/build.js MODULES lists missing file src/${m}`);
}

// Export map: file -> exported top-level names.
const exportOf = code => {
  const names = new Set();
  for (const m of code.matchAll(/^export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of code.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of code.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const alias = part.trim().match(/(?:as\s+)?([A-Za-z_$][\w$]*)$/);
      if (alias) names.add(alias[1]);
    }
  }
  return names;
};
const importedIn = code => {
  const names = new Set();
  for (const m of code.matchAll(/^import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?/gm)) {
    if (m[1]) names.add(m[1]);
    for (const part of (m[2] ?? '').split(',')) {
      const alias = part.trim().match(/(?:as\s+)?([A-Za-z_$][\w$]*)$/);
      if (alias) names.add(alias[1]);
    }
  }
  return names;
};
const localIn = code => {
  const names = new Set(importedIn(code));
  for (const m of code.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of code.matchAll(/^(?:export\s+)?(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  return names;
};

const GLOBALS = new Set([
  'console', 'document', 'window', 'self', 'location', 'navigator', 'localStorage',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'fetch', 'Request', 'Response', 'Headers', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
  'AbortController', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
  'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'Image', 'DOMParser', 'XMLSerializer',
  'JSON', 'Math', 'Number', 'String', 'Array', 'Object', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Date', 'RegExp', 'Error', 'Symbol', 'BigInt',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_xmlhttpRequest', 'GM_info',
  'process', 'require', 'module', 'exports', '__dirname', '__filename'
]);

const providedBy = new Map(); // name -> [files]
for (const f of srcFiles) {
  const code = fs.readFileSync(path.join(SRC_DIR, f), 'utf-8');
  for (const n of exportOf(code)) {
    if (!providedBy.has(n)) providedBy.set(n, []);
    providedBy.get(n).push(f);
  }
}

for (const target of ['ui/badges.js', 'features/price-alarm.js']) {
  const code = fs.readFileSync(path.join(SRC_DIR, target), 'utf-8');
  const local = localIn(code);
  const seen = new Set();
  for (const m of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (seen.has(name) || local.has(name) || GLOBALS.has(name)) continue;
    seen.add(name);
    const owners = providedBy.get(name) ?? [];
    if (owners.length > 0) {
      failures.push(`${target}: ${name}( provided by ${owners.join(', ')} but never imported (IIFE leakage)`);
    }
  }
}

if (failures.length) {
  console.error(`check-modules: ${failures.length} failure(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`check-modules: ok (${srcFiles.length} modules, boundaries clean)`);
