import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCliArgs, createDevServer } from '../dev-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAUNCH_SCRIPT = path.resolve(__dirname, '../launch-browser.sh');

describe('dev-server.mjs', () => {
  it('parseCliArgs parses browser, script aliases, and flags', () => {
    const parsed = parseCliArgs(['--chrome', 'tp', '--install', '--clean-profile', '--port', '9999']);
    assert.equal(parsed.browser, 'chrome');
    assert.equal(parsed.targetScript, 'toppreise');
    assert.equal(parsed.installRequested, true);
    assert.equal(parsed.cleanProfileRequested, true);
    assert.equal(parsed.port, 9999);

    assert.equal(parseCliArgs(['--firefox', 'hf']).targetScript, 'huggingface');
    assert.equal(parseCliArgs(['--firefox', 'px']).targetScript, 'perplexity');
  });

  it('createDevServer returns 404 on unknown route, 400 on malformed Host, and 404 on directory .user.js', async () => {
    const server = createDevServer({ host: '127.0.0.1', port: 0 });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
      const r404 = await fetch(`http://127.0.0.1:${port}/nonexistent-route`);
      assert.equal(r404.status, 404);

      const rDir = await fetch(`http://127.0.0.1:${port}/toppreise/src.user.js`);
      assert.equal(rDir.status, 404);

      const rBad = await new Promise((resolve, reject) => {
        const req = http.request({
          host: '127.0.0.1',
          port,
          path: '/',
          headers: { Host: 'bad host name' },
        }, (res) => resolve(res.statusCode));
        req.on('error', reject);
        req.end();
      });
      assert.equal(rBad, 400);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe('launch-browser.sh', () => {
  it('aborts Chrome --clean-profile when an active Chrome debug session is running', () => {
    const tmpBin = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-curl-'));
    const mockCurl = path.join(tmpBin, 'curl');
    fs.writeFileSync(mockCurl, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    try {
      const res = spawnSync('bash', [LAUNCH_SCRIPT, 'chrome', 'https://www.toppreise.ch', '--clean-profile'], {
        env: { ...process.env, PATH: `${tmpBin}:${process.env.PATH}` },
        encoding: 'utf8',
      });
      assert.notEqual(res.status, 0);
      assert.ok(res.stderr.includes('Cannot clean profile while an active Chrome session is running'));
    } finally {
      fs.rmSync(tmpBin, { recursive: true, force: true });
    }
  });
});
