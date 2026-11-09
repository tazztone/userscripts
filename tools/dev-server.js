#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const child = spawn(
  process.execPath,
  [path.join(__dirname, 'dev-server.mjs'), ...process.argv.slice(2)],
  { stdio: 'inherit' }
);

child.on('exit', (code) => {
  process.exit(code !== null ? code : 0);
});
