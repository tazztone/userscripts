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
import { execFileSync, spawn } from 'node:child_process';

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

const sseClients = new Set();

export function broadcastReload(scriptKey) {
  const payload = JSON.stringify({ script: scriptKey, ts: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`event: reload\ndata: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
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
  const devStubUrl = `${hostUrl}/${meta.dir}/${meta.dir}.dev.user.js`;

  // Dev header modification: adjust name and version, ensure local connect permissions,
  // strip upstream @updateURL and point @downloadURL to the local dev stub
  let devHeader = baseHeader
    .replace(/(@name\s+)([^\n]+)/, '$1[DEV] $2')
    .replace(/(@version\s+)([^\n]+)/, '$1$2.dev')
    .replace(/\/\/\s*@updateURL[^\n]*\n?/g, '');

  if (/@downloadURL\s+/.test(devHeader)) {
    devHeader = devHeader.replace(/\/\/\s*@downloadURL[^\n]*/g, `// @downloadURL  ${devStubUrl}`);
  } else {
    devHeader = devHeader.replace(/\/\/ ==\/UserScript==/, `// @downloadURL  ${devStubUrl}\n// ==/UserScript==`);
  }

  if (!devHeader.includes('@connect 127.0.0.1')) {
    devHeader = devHeader.replace(/\/\/ ==\/UserScript==/, '// @connect      127.0.0.1\n// @connect      localhost\n// ==/UserScript==');
  }
  if (!devHeader.includes('@grant GM_xmlhttpRequest')) {
    devHeader = devHeader.replace(/\/\/ ==\/UserScript==/, '// @grant        GM_xmlhttpRequest\n// ==/UserScript==');
  }

  return `${devHeader}

// ─── LOCAL DEV LOADER (Auto-Generated) ───────────────────────────────────────
// Injected into Violentmonkey / Tampermonkey. Dynamically pulls the freshest
// local build on every page navigation without caching and connects to live
// server-sent events for hands-free auto-reload on source rebuilds.
// ─────────────────────────────────────────────────────────────────────────────
(function() {
  'use strict';
  const targetUrl = ${JSON.stringify(targetScriptUrl)} + '?t=' + Date.now();
  const eventsUrl = ${JSON.stringify(`${hostUrl}/events`)};
  const versionUrl = ${JSON.stringify(`${hostUrl}/version/${scriptKey}`)};
  console.log('[userscript-dev] Dev loader active for ${meta.name}.');

  let initialVersionTs = null;
  let esErrorCount = 0;
  let pollInterval = null;

  function startPollingFallback() {
    if (pollInterval || typeof GM_xmlhttpRequest === 'undefined') return;
    console.log('[userscript-dev] Starting GM_xmlhttpRequest polling fallback on ' + versionUrl);
    pollInterval = setInterval(function() {
      GM_xmlhttpRequest({
        method: 'GET',
        url: versionUrl + '?t=' + Date.now(),
        nocache: true,
        headers: { 'Cache-Control': 'no-cache, no-store' },
        onload: function(res) {
          if (res.status >= 200 && res.status < 300) {
            try {
              const data = JSON.parse(res.responseText);
              if (initialVersionTs === null) {
                initialVersionTs = data.ts;
              } else if (data.ts > initialVersionTs) {
                console.log('[userscript-dev] Version update detected via polling:', data);
                window.location.reload();
              }
            } catch {}
          }
        }
      });
    }, 1500);
  }

  // Live SSE auto-reload on source rebuilds
  if (typeof EventSource !== 'undefined') {
    try {
      const es = new EventSource(eventsUrl);
      es.addEventListener('reload', function(e) {
        console.log('[userscript-dev] Rebuild event received:', e.data);
        if (!e.data) {
          window.location.reload();
          return;
        }
        try {
          const payload = JSON.parse(e.data);
          if (!payload.script || payload.script === ${JSON.stringify(scriptKey)}) {
            window.location.reload();
          }
        } catch {
          window.location.reload();
        }
      });
      es.onerror = function() {
        esErrorCount++;
        if (esErrorCount >= 3) {
          try { es.close(); } catch {}
          startPollingFallback();
        }
      };
    } catch (err) {
      console.warn('[userscript-dev] EventSource init failed:', err);
      startPollingFallback();
    }
  } else {
    startPollingFallback();
  }

  function executeCode(sourceCode) {
    try {
      // Map stack traces to target script filename via sourceURL
      const mappedSource = sourceCode + '\n//# sourceURL=' + ${JSON.stringify(targetScriptUrl)};
      eval(mappedSource);
    } catch (err) {
      const msg = (err && err.stack) ? err.stack : ((err && err.message) ? err.message : JSON.stringify(err));
      console.error('\\x1b[31m❌ [userscript-dev] Runtime Exception in ${meta.name}:\\x1b[0m\\n' + msg);
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
          console.error('[userscript-dev] HTTP error loading bundle:', res.status, res.statusText);
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
        console.error('[userscript-dev] Fetch error loading bundle:', err);
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
    .btn-setup { background: #047857; color: white; }
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
        <a class="btn-setup" href="/setup/${key}">1. Guided Setup (/setup/${key})</a>
        <a class="btn-dev" href="/${meta.dir}/${meta.dir}.dev.user.js">2. Dev Loader Stub (${meta.dir}.dev.user.js)</a>
        <a class="btn-track" href="/${meta.dir}/${filename}">3. Track External Edits (${filename})</a>
      </div>
      <div class="meta">
        Option 1: Guided 1-click install page for the dev stub.<br>
        Option 2: Direct dev loader stub; fetches fresh code on every navigation.<br>
        Option 3: In Violentmonkey, open file URL and click "Track external edits".
      </div>
    </div>`;
  }).join('')}

  <div class="doc-box">
    <strong>Agentic Workflow:</strong><br>
    The CLI coding agent edits files in <code>src/</code>. This server auto-rebuilds and serves fresh bundles without cache.<br>
    Target browser tab reloads via MCP (<code>chrome-devtools</code> or <code>firefox-devtools</code>).
  </div>
</body>
</html>`;
      res.writeHead(200);
      res.end(html);
      return;
    }

    // Server-Sent Events (SSE) live-reload endpoint
    if (pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write('retry: 2000\n\n');
      sseClients.add(res);
      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // Version polling endpoint for CSP-safe fallback: /version/:script
    const versionMatch = pathname.match(/^\/version\/([^/]+)$/);
    if (versionMatch) {
      const aliasMap = { tp: 'toppreise', hf: 'huggingface', px: 'perplexity' };
      const rawKey = versionMatch[1];
      const scriptKey = aliasMap[rawKey] || rawKey;
      const meta = SCRIPTS[scriptKey];
      if (!meta) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: `Script '${rawKey}' not found` }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      });
      res.end(JSON.stringify({ script: scriptKey, ts: lastBuildTimestamps[scriptKey] || Date.now() }));
      return;
    }

    // Guided setup landing page: /setup/:script
    const setupMatch = pathname.match(/^\/setup\/([^/]+)$/);
    if (setupMatch) {
      const aliasMap = { tp: 'toppreise', hf: 'huggingface', px: 'perplexity' };
      const rawKey = setupMatch[1];
      const scriptKey = aliasMap[rawKey] || rawKey;
      const meta = SCRIPTS[scriptKey];
      if (!meta) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Script '${rawKey}' not found.`);
        return;
      }
      const devStubUrl = `/${meta.dir}/${meta.dir}.dev.user.js`;
      const targetSites = {
        toppreise: 'https://www.toppreise.ch/',
        huggingface: 'https://huggingface.co/models',
        perplexity: 'https://www.perplexity.ai/'
      };
      const siteUrl = targetSites[scriptKey] || 'https://www.toppreise.ch/';
      const amoUrl = 'https://addons.mozilla.org/firefox/addon/violentmonkey/';

      const setupHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Setup [DEV] ${meta.name}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; color: #0f172a; background: #f8fafc; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07); }
    h1 { font-size: 1.4rem; margin-top: 0; margin-bottom: 8px; }
    p { font-size: 0.95rem; color: #475569; margin: 8px 0 20px; line-height: 1.5; }
    .btn { display: inline-block; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem; transition: background 0.15s; }
    .btn-primary { background: #0284c7; color: white; margin-right: 10px; }
    .btn-primary:hover { background: #0369a1; }
    .btn-secondary { background: #e2e8f0; color: #1e293b; }
    .btn-secondary:hover { background: #cbd5e1; }
    .step-box { background: #f1f5f9; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 0.9rem; }
    .step-box ol { margin: 6px 0; padding-left: 20px; }
    .step-box li { margin-bottom: 6px; }
    .note { font-size: 0.82rem; color: #64748b; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Setup [DEV] ${meta.name}</h1>
    <p>Welcome to the isolated userscript dev session. Follow these simple steps:</p>
    <div class="step-box">
      <ol>
        <li>Ensure Violentmonkey is installed (<a href="${amoUrl}" target="_blank">Install from AMO</a> if missing).</li>
        <li>Click below to install the live auto-reloading <strong>[DEV] Stub</strong>.</li>
        <li>Open the target site to start testing!</li>
      </ol>
    </div>
    <div style="margin-top: 24px;">
      <a class="btn btn-primary" href="${devStubUrl}">1. Install [DEV] Stub</a>
      <a class="btn btn-secondary" href="${siteUrl}" target="_blank">2. Open Target Site ↗</a>
    </div>
    <p class="note">Once installed, any changes you save to <code>src/</code> will rebuild and reload target pages automatically.</p>
  </div>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.writeHead(200);
      res.end(setupHtml);
      return;
    }

    // Dev loader stubs: /<dir>/<script>.dev.user.js or /loader/<script>.user.js
    const devStubMatch = pathname.match(/^\/([^/]+)\/([^/]+)\.dev\.user\.js$/) || pathname.match(/^\/loader\/([^/]+)\.user\.js$/);
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
          broadcastReload('toppreise');
          if (onRebuild) onRebuild('toppreise');
        } catch (err) {
          console.error('❌ [watcher] Build error:', err.message);
        }
      }, 50);
    });
    watchers.push(watcher);
  }

  // Watch single-file scripts: huggingface & perplexity
  const singleFileScripts = ['huggingface', 'perplexity'];
  for (const scriptKey of singleFileScripts) {
    const meta = SCRIPTS[scriptKey];
    const scriptPath = path.join(REPO_ROOT, meta.bundleFile);
    const scriptDir = path.dirname(scriptPath);
    const targetFilename = path.basename(scriptPath);
    if (fs.existsSync(scriptDir)) {
      let debounceTimer = null;
      const watcher = fs.watch(scriptDir, (eventType, filename) => {
        if (!filename || filename !== targetFilename || filename.endsWith('.tmp') || filename.includes('~')) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          lastBuildTimestamps[scriptKey] = Date.now();
          console.log(`✅ [watcher] ${meta.name} changed: ${meta.bundleFile}`);
          broadcastReload(scriptKey);
          if (onRebuild) onRebuild(scriptKey);
        }, 50);
      });
      watchers.push(watcher);
    }
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
    if (!stubRes.body.includes(`http://127.0.0.1:${testPort}/toppreise/toppreise.user.js`)) {
      throw new Error('Dev stub target URL mismatch');
    }
    if (stubRes.body.includes('@updateURL')) {
      throw new Error('Dev stub must not contain @updateURL');
    }
    if (!stubRes.body.includes(`@downloadURL  http://127.0.0.1:${testPort}/toppreise/toppreise.dev.user.js`)) {
      throw new Error('Dev stub @downloadURL mismatch');
    }

    // 4. Setup and version endpoints
    const setupRes = await fetchUrl('/setup/toppreise');
    if (setupRes.status !== 200 || !setupRes.body.includes('Setup [DEV] Toppreise.ch Suite')) {
      throw new Error(`Setup route self-test failed (status ${setupRes.status})`);
    }

    const versionRes = await fetchUrl('/version/toppreise');
    if (versionRes.status !== 200) {
      throw new Error(`Version route self-test failed (status ${versionRes.status})`);
    }
    const versionJson = JSON.parse(versionRes.body);
    if (versionJson.script !== 'toppreise' || typeof versionJson.ts !== 'number') {
      throw new Error(`Version route payload invalid: ${versionRes.body}`);
    }

    // 5. SSE events endpoint
    await new Promise((resolve, reject) => {
      const sseReq = http.get(`http://127.0.0.1:${testPort}/events`, (res) => {
        if (res.statusCode !== 200 || res.headers['content-type'] !== 'text/event-stream') {
          reject(new Error(`SSE endpoint failed: status ${res.statusCode}, type ${res.headers['content-type']}`));
          return;
        }
        res.destroy();
        resolve();
      });
      sseReq.on('error', reject);
    });

    // 6. Test rebuild execution
    SCRIPTS.toppreise.buildCmd();

    // 7. Test launcher resolution logic
    const launcherPath = path.join(REPO_ROOT, 'tools', 'launch-browser.sh');
    if (!fs.existsSync(launcherPath)) {
      throw new Error('launch-browser.sh does not exist');
    }

    console.log('✅ All self-test assertions passed successfully.');
  } finally {
    server.close();
  }
}

function parseCliArgs(args) {
  let port = DEFAULT_PORT;
  let browser = null;
  let targetScript = 'toppreise';
  let installRequested = false;
  let cleanProfileRequested = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--chrome') {
      browser = 'chrome';
    } else if (arg === '--firefox') {
      browser = 'firefox';
    } else if (arg === '--browser' && args[i + 1]) {
      browser = args[++i];
    } else if (arg === '--port' && args[i + 1]) {
      port = parseInt(args[++i], 10) || DEFAULT_PORT;
    } else if (arg === '--install') {
      installRequested = true;
    } else if (arg === '--clean-profile') {
      cleanProfileRequested = true;
    } else if (!arg.startsWith('-')) {
      const aliasMap = { tp: 'toppreise', hf: 'huggingface', px: 'perplexity' };
      const resolved = aliasMap[arg] || arg;
      if (SCRIPTS[resolved]) {
        targetScript = resolved;
      }
    }
  }

  return { port, browser, targetScript, installRequested, cleanProfileRequested };
}

export { parseCliArgs };

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

  const { port, browser, targetScript, installRequested, cleanProfileRequested } = parseCliArgs(args);

  const server = createDevServer({ host: '127.0.0.1', port });
  let browserChild = null;

  server.listen(port, '127.0.0.1', () => {
    console.log(`⚡ Userscript Sync Server running at http://127.0.0.1:${port}/`);
    if (targetScript === 'toppreise') {
      console.log(`📁 Tracking source changes across toppreise/src/ ...`);
    } else {
      console.log(`📁 Tracking source changes in ${SCRIPTS[targetScript].bundleFile} ...`);
    }

    if (browser) {
      const launcherScript = path.join(REPO_ROOT, 'tools', 'launch-browser.sh');
      console.log(`🌐 Launching ${browser} for '${targetScript}'...`);
      const launcherArgs = [launcherScript, browser, targetScript];
      if (installRequested) {
        launcherArgs.push('--install');
      }
      if (cleanProfileRequested) {
        launcherArgs.push('--clean-profile');
      }
      browserChild = spawn('bash', launcherArgs, {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        env: { ...process.env, DEV_SERVER_PORT: String(port) }
      });
      browserChild.on('error', (err) => {
        console.error(`❌ Failed to launch browser:`, err.message);
      });
      browserChild.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`\x1b[31m❌ Browser process exited with code ${code}\x1b[0m`);
          console.error(`💡 Troubleshooting:`);
          console.error(`   • Ensure ${browser} is installed and executable.`);
          console.error(`   • Check port collisions (e.g. Chrome vs Firefox BiDi port 9222).`);
          console.error(`   • Try launching directly: bash tools/launch-browser.sh ${browser} ${targetScript}`);
        }
      });
    }
  });

  setupWatchers();

  const shutdown = () => {
    console.log('\nStopping Sync Server...');
    if (browserChild && !browserChild.killed) {
      try {
        browserChild.kill('SIGTERM');
      } catch {}
    }
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
