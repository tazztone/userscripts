#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const child = spawn(
  process.execPath,
  [path.join(__dirname, 'dev-server.mjs'), ...process.argv.slice(2)],
  { stdio: 'inherit' }
);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) {
      try { child.kill(sig); } catch {}
    }
  });
}

child.on('error', (err) => {
  console.error('Failed to start dev-server.mjs:', err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code !== null ? code : 0);
});
