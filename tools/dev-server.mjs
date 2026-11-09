#!/usr/bin/env node
/**
 * Zero-dependency Sync Daemon & Local Development Server
 *
 * Serves repo userscripts with zero-cache headers, generates in-memory dev-loader
 * stubs, and watches source directories for instant rebuilds.
 *
 * Usage:
 *   node tools/dev-server.js
 *   node tools/dev-server.js --port 8765
 *   node tools/dev-server.js --self-test
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULT_PORT = 8765;

const SCRIPTS = {
  toppreise: {
    name: 'Toppreise.ch Suite',
    dir: 'toppreise',
    bundleFile: 'toppreise/toppreise.user.js',
    srcDir: 'toppreise/src',
    buildCmd: () => {
      execFileSync('node', ['tools/build.js'], { cwd: path.join(REPO_ROOT, 'toppreise'), stdio: 'pipe' });
    }
  },
  huggingface: {
    name: 'Hugging Face Inline Liking',
    dir: 'huggingface',
    bundleFile: 'huggingface/huggingface-heart.user.js'
  },
  perplexity: {
    name: 'Perplexity Enhancements',
    dir: 'perplexity',
    bundleFile: 'perplexity/perplexity-enhancements.user.js'
  }
};

let lastBuildTimestamps = {};
for (const key of Object.keys(SCRIPTS)) {
  lastBuildTimestamps[key] = Date.now();
}

export function generateDevLoaderStub(scriptKey, hostUrl) {
  const meta = SCRIPTS[scriptKey];
  if (!meta) return null;

  const fullBundlePath = path.join(REPO_ROOT, meta.bundleFile);
  if (!fs.existsSync(fullBundlePath)) return null;

  const content = fs.readFileSync(fullBundlePath, 'utf-8');
  const headerMatch = content.match(/(\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==)/);
  if (!headerMatch) return null;

  const baseHeader = headerMatch[1];
  const bundleFilename = path.basename(meta.bundleFile);
  const targetScriptUrl = `${hostUrl}/${meta.dir}/${bundleFilename}`;

  // Dev header modification: adjust name and version, preserve match/grants/connects
  const devHeader = baseHeader
    .replace(/(@name\s+)([^\n]+)/, '$1[DEV] $2')
    .replace(/(@version\s+)([^\n]+)/, '$1$2.dev');

  return `${devHeader}

// ─── LOCAL DEV LOADER (Auto-Generated) ───────────────────────────────────────
// Injected into Violentmonkey / Tampermonkey. Dynamically pulls the freshest
// local build on every page navigation without caching.
// ─────────────────────────────────────────────────────────────────────────────
(function() {
  'use strict';
  const targetUrl = ${JSON.stringify(targetScriptUrl)} + '?t=' + Date.now();
  console.log('[userscript-dev] Fetching latest build from:', targetUrl);

  function executeCode(sourceCode) {
    try {
      const runner = new Function(sourceCode);
      runner();
    } catch (err) {
      console.error('[userscript-dev] Runtime execution failure:', err);
    }
  }

  if (typeof GM_xmlhttpRequest !== 'undefined') {
    GM_xmlhttpRequest({
      method: 'GET',
      url: targetUrl,
      nocache: true,
      headers: { 'Cache-Control': 'no-cache, no-store' },
      onload: function(res) {
        if (res.status >= 200 && res.status < 300) {
          executeCode(res.responseText);
        } else {
          console.error('[userscript-dev] HTTP error:', res.status, res.statusText);
        }
      },
      onerror: function(err) {
        console.error('[userscript-dev] Failed to fetch script from dev server:', err);
      }
    });
  } else {
    fetch(targetUrl, { cache: 'no-store' })
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(executeCode)
      .catch(function(err) {
        console.error('[userscript-dev] Fetch error:', err);
      });
  }
})();
`;
}

export function createDevServer(options = {}) {
  const host = options.host || '127.0.0.1';
  const port = options.port || DEFAULT_PORT;

  const server = http.createServer((req, res) => {
    // Enable CORS for localhost access across ports
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const hostHeader = req.headers.host || `${host}:${port}`;
    const hostUrl = `http://${hostHeader}`;
    const urlObj = new URL(req.url, hostUrl);
    const pathname = urlObj.pathname;

    // Zero-cache headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Dashboard
    if (pathname === '/' || pathname === '/index.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Userscript Development Sync Server</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.5; color: #1e293b; background: #f8fafc; }
    h1 { font-size: 1.5rem; border-bottom: 2px solid #cbd5e1; padding-bottom: 12px; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .title { font-size: 1.15rem; font-weight: bold; margin-bottom: 6px; }
    .links a { display: inline-block; margin-right: 12px; margin-top: 8px; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.9rem; font-weight: 500; }
    .btn-track { background: #0284c7; color: white; }
    .btn-dev { background: #0f172a; color: white; }
    .meta { font-size: 0.82rem; color: #64748b; margin-top: 8px; }
    .doc-box { background: #f1f5f9; border-left: 4px solid #0284c7; padding: 12px; font-size: 0.88rem; margin-top: 24px; border-radius: 4px; }
    code { font-family: monospace; background: #e2e8f0; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>⚡ Userscript Development Sync Server</h1>
  <p>Live session bridge active on <code>${hostUrl}</code>. Changes to source files rebuild instantly.</p>

  ${Object.entries(SCRIPTS).map(([key, meta]) => {
    const filename = path.basename(meta.bundleFile);
    return `
    <div class="card">
      <div class="title">${meta.name}</div>
      <div class="meta">Bundle: <code>${meta.bundleFile}</code></div>
      <div class="links">
        <a class="btn-track" href="/${meta.dir}/${filename}">1. Native Track External Edits (${filename})</a>
        <a class="btn-dev" href="/${meta.dir}/${meta.dir}.dev.user.js">2. Dev Loader Stub (${meta.dir}.dev.user.js)</a>
      </div>
      <div class="meta">
        Option 1: In Violentmonkey, open file URL and click "Track external edits".<br>
        Option 2: Install Dev Loader once; fetches fresh code on every navigation.
      </div>
    </div>`;
  }).join('')}

  <div class="doc-box">
    <strong>Agentic Workflow:</strong><br>
    The CLI coding agent edits files in <code>src/</code>. This server auto-rebuilds and serves fresh bundles without cache.<br>
    Target browser tab reloads via MCP (<code>chrome-devtools-mcp</code> or <code>@mozilla/firefox-devtools-mcp</code>).
  </div>
</body>
</html>`;
      res.writeHead(200);
      res.end(html);
      return;
    }

    // Dev loader stubs: /<dir>/<script>.dev.user.js
    const devStubMatch = pathname.match(/^\/([^/]+)\/([^/]+)\.dev\.user\.js$/);
    if (devStubMatch) {
      const scriptKey = devStubMatch[1];
      const stub = generateDevLoaderStub(scriptKey, hostUrl);
      if (!stub) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Userscript '${scriptKey}' not found.`);
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'ETag': `dev-stub-${lastBuildTimestamps[scriptKey] || Date.now()}`
      });
      res.end(stub);
      return;
    }

    // Direct userscript bundles: /<dir>/<filename>.user.js
    const scriptMatch = pathname.match(/^\/([^/]+)\/([^/]+\.user\.js)$/);
    if (scriptMatch) {
      const scriptDir = scriptMatch[1];
      const filename = scriptMatch[2];
      const relPath = path.join(scriptDir, filename);
      const fullPath = path.join(REPO_ROOT, relPath);

      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'ETag': `file-${fs.statSync(fullPath).mtimeMs}`
        });
        res.end(content);
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  return server;
}

export function setupWatchers(onRebuild) {
  const watchers = [];

  // Watch Toppreise src/
  const toppreiseSrc = path.join(REPO_ROOT, SCRIPTS.toppreise.srcDir);
  if (fs.existsSync(toppreiseSrc)) {
    let debounceTimer = null;
    const watcher = fs.watch(toppreiseSrc, { recursive: true }, (eventType, filename) => {
      if (!filename || filename.endsWith('.tmp') || filename.includes('~')) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          console.log(`🔨 [watcher] Change detected in toppreise/src/${filename}, rebuilding...`);
          SCRIPTS.toppreise.buildCmd();
          lastBuildTimestamps.toppreise = Date.now();
          console.log('✅ [watcher] Toppreise rebuild complete.');
          if (onRebuild) onRebuild('toppreise');
        } catch (err) {
          console.error('❌ [watcher] Build error:', err.message);
        }
      }, 50);
    });
    watchers.push(watcher);
  }

  return watchers;
}

async function runSelfTest() {
  console.log('🧪 Starting Sync Server self-test...');
  const testPort = 8766;
  const server = createDevServer({ host: '127.0.0.1', port: testPort });

  await new Promise((resolve, reject) => {
    server.listen(testPort, '127.0.0.1', resolve);
    server.on('error', reject);
  });

  const fetchUrl = async (urlPath) => {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${testPort}${urlPath}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }).on('error', reject);
    });
  };

  try {
    // 1. Dashboard
    const indexRes = await fetchUrl('/');
    if (indexRes.status !== 200 || !indexRes.body.includes('Userscript Development Sync Server')) {
      throw new Error(`Dashboard self-test failed (status ${indexRes.status})`);
    }
    if (indexRes.headers['cache-control'] !== 'no-store, no-cache, must-revalidate, max-age=0') {
      throw new Error(`Cache-Control header mismatch: ${indexRes.headers['cache-control']}`);
    }

    // 2. Direct bundle
    const bundleRes = await fetchUrl('/toppreise/toppreise.user.js');
    if (bundleRes.status !== 200 || !bundleRes.body.includes('// ==UserScript==')) {
      throw new Error(`Bundle self-test failed (status ${bundleRes.status})`);
    }

    // 3. Dev loader stub
    const stubRes = await fetchUrl('/toppreise/toppreise.dev.user.js');
    if (stubRes.status !== 200 || !stubRes.body.includes('[DEV] Toppreise.ch Suite')) {
      throw new Error(`Dev stub self-test failed (status ${stubRes.status})`);
    }
    if (!stubRes.body.includes('http://127.0.0.1:8766/toppreise/toppreise.user.js')) {
      throw new Error('Dev stub target URL mismatch');
    }

    // 4. Test rebuild execution
    SCRIPTS.toppreise.buildCmd();

    console.log('✅ All self-test assertions passed successfully.');
  } finally {
    server.close();
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    runSelfTest()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('❌ Self-test failed:', err);
        process.exit(1);
      });
    return;
  }

  let port = DEFAULT_PORT;
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1], 10) || DEFAULT_PORT;
  }

  const server = createDevServer({ host: '127.0.0.1', port });
  server.listen(port, '127.0.0.1', () => {
    console.log(`⚡ Userscript Sync Server running at http://127.0.0.1:${port}/`);
    console.log(`📁 Tracking source changes across toppreise/src/ ...`);
  });

  setupWatchers();

  process.on('SIGINT', () => {
    console.log('\nStopping Sync Server...');
    server.close();
    process.exit(0);
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
