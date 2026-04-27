/* global __dirname, console, process, require, setTimeout */
/* eslint-disable @typescript-eslint/no-require-imports */

const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const electronBinary = require('electron');
const viteCli = path.join(path.dirname(require.resolve('vite')), '..', '..', 'bin', 'vite.js');
const tscCli = path.join(path.dirname(require.resolve('typescript')), '..', 'bin', 'tsc');

const host = '127.0.0.1';
const port = Number(process.env.MIND_MAP_PORT || '5181');
const devServerUrl = `http://${host}:${port}`;
const nodeBinary = process.execPath;
const rootDir = path.resolve(__dirname, '..');

let rendererChild = null;
let electronChild = null;
let isShuttingDown = false;

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

function spawnCommand(command, args, options = {}) {
  return spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: createChildEnv(),
    ...options,
  });
}

function isPortFree(targetPort, targetHost) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(targetPort, targetHost);
  });
}

function requestRoot(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body,
        });
      });
    });

    request.on('error', reject);
    request.setTimeout(2500, () => {
      request.destroy(new Error('Timed out'));
    });
  });
}

async function isMindMapRenderer(url) {
  try {
    const response = await requestRoot(url);
    return response.statusCode >= 200 && response.statusCode < 400 && response.body.includes('<title>Mind Map</title>');
  } catch {
    return false;
  }
}

async function waitForRenderer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isMindMapRenderer(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Renderer did not become ready at ${url} within ${timeoutMs}ms.`);
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Process exited with code ${code ?? 'unknown'}.`));
    });
  });
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (electronChild && !electronChild.killed) {
    try {
      electronChild.kill('SIGTERM');
    } catch {
      // Ignore cleanup failures on shutdown.
    }
  }

  if (rendererChild && !rendererChild.killed) {
    try {
      rendererChild.kill('SIGTERM');
    } catch {
      // Ignore cleanup failures on shutdown.
    }
  }

  process.exit(exitCode);
}

async function main() {
  const portFree = await isPortFree(port, host);

  if (portFree) {
    rendererChild = spawnCommand(nodeBinary, [viteCli, '--host', host, '--port', String(port), '--strictPort']);
    rendererChild.once('exit', (code) => {
      if (!isShuttingDown && typeof code === 'number' && code !== 0) {
        shutdown(code);
      }
    });

    await waitForRenderer(devServerUrl);
  } else if (!(await isMindMapRenderer(devServerUrl))) {
    throw new Error(`Port ${port} is already in use by another app. Set MIND_MAP_PORT to a free port and run npm run dev again.`);
  }

  const buildChild = spawnCommand(nodeBinary, [tscCli, '-p', 'tsconfig.electron.json']);
  await waitForExit(buildChild);

  electronChild = spawn(electronBinary, ['.'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: createChildEnv({
      VITE_DEV_SERVER_URL: devServerUrl,
      MIND_MAP_PORT: String(port),
    }),
  });

  electronChild.once('error', () => shutdown(1));
  electronChild.once('exit', (code) => shutdown(typeof code === 'number' ? code : 0));
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
});
