/* global __dirname, clearInterval, process, require, setInterval */
/* eslint-disable @typescript-eslint/no-require-imports */

const { spawn } = require('node:child_process');
const path = require('node:path');
const electronBinary = require('electron');
const devPort = Number(process.env.MIND_MAP_PORT || '5181');
const devServerUrl = `http://127.0.0.1:${devPort}`;

function createChildEnv(overrides = {}) {
  const env = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('=') && typeof value === 'string') {
      env[key] = value;
    }
  }

  delete env.ELECTRON_RUN_AS_NODE;

  return {
    ...env,
    ...overrides,
  };
}

const child = spawn(electronBinary, ['.'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: createChildEnv({
    VITE_DEV_SERVER_URL: devServerUrl,
  }),
});

const keepAlive = setInterval(() => {}, 1000);
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  clearInterval(keepAlive);

  if (!child.killed) {
    try {
      child.kill('SIGTERM');
    } catch {
      // Ignore cleanup errors during shutdown.
    }
  }

  process.exit(exitCode);
}

child.on('error', () => {
  shutdown(1);
});

child.on('exit', (code) => {
  if (shuttingDown) {
    return;
  }

  if (typeof code === 'number' && code !== 0) {
    shutdown(code);
  }
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
