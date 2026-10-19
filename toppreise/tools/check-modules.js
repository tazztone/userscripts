#!/usr/bin/env node
/**
 * Zero-dependency module-boundary gate for the Toppreise Suite.
 * (a) Every JS file under src must appear in tools/build.js MODULES —
 *     catches silently-dropped modules (bundle is concat-IIFE, no resolver).
 * (b) Cross-module call check (full tree): a `foo(` call in any src file
 *     must resolve to a local binding, an import, or a known global — else
 *     it only works via IIFE leakage. Provided-but-never-imported is a
 *     failure; ownerless names are warn-only (console.warn, exit stays 0).
 *     String/comment/regex literals are stripped before scanning so copy
 *     text never fires the gate.
 *
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
// Strip comments, strings, template bodies (preserving ${...} code) and regex
// literals so UI copy and patterns like /-p(\d+)/ never fire the call scan.
// Uses a context stack to handle arbitrary nesting of template literals.
const stripCode = code => {
  let out = '', i = 0;
  const n = code.length;
  const stack = ['code'];
  const braceDepth = [0];
  const isRegex = () => /(\b(?:return|yield|case|typeof|delete|void|default|throw)|[(,=:[!&|?{};>~^%*+-])\s*$/.test(out);

  while (i < n) {
    const ctx = stack[stack.length - 1];
    const c = code[i], nx = code[i + 1] ?? '';

    if (ctx === 'template') {
      if (c === '\\') { i += 2; continue; }
      if (c === '$' && nx === '{') {
        out += ' '; i += 2;
        stack.push('code'); braceDepth.push(1);
        continue;
      }
      if (c === '`') { out += ' '; i++; stack.pop(); continue; }
      if (c === '\n') out += '\n';
      i++;
      continue;
    }

    if (c === '/' && nx === '/') { while (i < n && code[i] !== '\n') i++; continue; }
    if (c === '/' && nx === '*') {
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) { if (code[i] === '\n') out += '\n'; i++; }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < n && code[i] !== '\n') {
        if (code[i] === '\\') i++;
        else if (code[i] === q) { i++; break; }
        i++;
      }
      out += ' ';
      continue;
    }
    if (c === '`') { out += ' '; i++; stack.push('template'); continue; }
    if (c === '/' && isRegex() && nx !== '/' && nx !== '*') {
      i++;
      while (i < n && code[i] !== '\n') {
        if (code[i] === '\\') i++;
        else if (code[i] === '[') { while (i < n && code[i] !== ']' && code[i] !== '\n') { if (code[i] === '\\') i++; i++; } }
        else if (code[i] === '/') { i++; while (i < n && /[\w$]/.test(code[i])) i++; break; }
        i++;
      }
      out += ' ';
      continue;
    }
    if (c === '{') { braceDepth[braceDepth.length - 1]++; out += '{'; i++; continue; }
    if (c === '}') {
      braceDepth[braceDepth.length - 1]--;
      if (stack.length > 1 && braceDepth[braceDepth.length - 1] === 0) {
        stack.pop(); braceDepth.pop(); out += ' '; i++; continue;
      }
      out += '}'; i++; continue;
    }
    out += c; i++;
  }
  return out;
};
const localIn = code => {
  const names = new Set(importedIn(code));
  for (const m of code.matchAll(/(?:^|[;{}()\s])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of code.matchAll(/(?:const|let|var)\s+([^;=\n]+)/g)) {
    for (const part of m[1].split(',')) {
      const id = part.trim().match(/^[A-Za-z_$][\w$]*/);
      if (id) names.add(id[0]);
    }
  }
  for (const m of code.matchAll(/class\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of code.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
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
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'Proxy',
  'GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_xmlhttpRequest', 'GM_info',
  'process', 'require', 'module', 'exports', '__dirname', '__filename'
]);
// Language keywords that match the `name(` shape (`if (`, `for (`) — never calls.
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'await', 'async', 'yield', 'function', 'class', 'new', 'typeof', 'void', 'delete', 'throw', 'in', 'of', 'instanceof']);
// Triaged unresolved names: intent, not leakage. Each entry names why the
// bare call is correct without an import.
const UNRESOLVED_EXCEPTIONS = new Set([
  // typeof-guarded cross-entry late binding: app.js defines it, page/config
  // call it only when the bundle entry already installed it.
  'processListings', 'processProductDetailPage', 'processPriceAlarmModal',
  // Destructured runProductScanner options with defaults — params, not imports.
  'filterFn', 'shouldCancelFn', 'onProgress',
  // Promise executor callbacks (resolve/reject) inside Promise callbacks or helper methods
  'resolve', 'reject',
  // Helper / callbacks passed as options or arguments
  'makeRequest', 'onComplete',
]);

const providedBy = new Map(); // name -> [files]
for (const f of srcFiles) {
  const code = fs.readFileSync(path.join(SRC_DIR, f), 'utf-8');
  for (const n of exportOf(code)) {
    if (!providedBy.has(n)) providedBy.set(n, []);
    providedBy.get(n).push(f);
  }
}

for (const target of srcFiles) {
  const raw = fs.readFileSync(path.join(SRC_DIR, target), 'utf-8');
  const code = stripCode(raw);
  const local = localIn(code);
  const seen = new Set();
  for (const m of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (seen.has(name) || local.has(name) || GLOBALS.has(name) || KEYWORDS.has(name) || UNRESOLVED_EXCEPTIONS.has(name)) continue;
    seen.add(name);
    const owners = providedBy.get(name) ?? [];
    if (owners.length > 0 && !owners.includes(target)) {
      failures.push(`${target}: ${name}( provided by ${owners.join(', ')} but never imported (IIFE leakage)`);
    } else if (owners.length === 0) {
      console.warn(`check-modules: unresolved-name warning: ${target}: ${name}( possibly unresolved`);
    }
  }
}

if (failures.length) {
  console.error(`check-modules: ${failures.length} failure(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`check-modules: ok (${srcFiles.length} modules, boundaries clean)`);
// Size advisory (warning-only, never fails): every src module SHOULD stay
// under 25 KB so the tree never silently regrows past the split budget.
const SIZE_WARN_BYTES = 25 * 1024;
for (const f of srcFiles) {
  const bytes = fs.statSync(path.join(SRC_DIR, f)).size;
  if (bytes > SIZE_WARN_BYTES) console.warn(`check-modules: warning: src/${f} is ${(bytes / 1024).toFixed(1)} KB (>25 KB) — consider splitting it into cohesive modules`);
}
