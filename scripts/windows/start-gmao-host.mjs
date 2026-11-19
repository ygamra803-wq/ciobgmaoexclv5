#!/usr/bin/env node
/**
 * CIOB GMAO Nexus — Local Windows Desktop & Wi-Fi LAN Host Launcher
 *
 * Runs the compiled production frontend (`dist/`) and the Single-File ACID SQLite
 * backend (`ciob_gmao.db`) on a single factory PC with zero external cloud servers.
 *
 * Usage:
 *   node scripts/windows/start-gmao-host.mjs
 *   node scripts/windows/start-gmao-host.mjs --db-file "D:\\UsineData\\ciob_gmao.db" --port 3000
 *   node scripts/windows/start-gmao-host.mjs --no-browser
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? String(process.argv[idx + 1]).trim() : null;
}

const noBrowser = process.argv.includes('--no-browser');
const port = Number(readArg('--port') || process.env.GMAO_PORT || 3000);

const defaultBaseDir =
  process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'CIOB-GMAO')
    : path.join(os.homedir(), '.ciob-gmao');

const explicitDbFile = readArg('--db-file') || process.env.GMAO_DB_FILE || '';
const explicitDataDir = readArg('--data-dir') || process.env.GMAO_DATA_DIR || '';
const dataDir = explicitDataDir
  ? path.resolve(explicitDataDir)
  : explicitDbFile
  ? path.dirname(path.resolve(explicitDbFile))
  : defaultBaseDir;
const dbFile = explicitDbFile ? path.resolve(explicitDbFile) : path.join(dataDir, 'ciob_gmao.db');

fs.mkdirSync(dataDir, { recursive: true });

// Ensure dist/ production bundle exists before launching
const distIndex = path.join(projectRoot, 'dist', 'index.html');
if (!fs.existsSync(distIndex)) {
  console.error(
    '[CIOB-GMAO] Production build not found (dist/index.html missing). Run "npm run build" first.'
  );
  process.exit(1);
}

// Auto-provision persistent strong local host secrets in user dataDir (never stored inside repo)
const secretsPath = path.join(dataDir, 'host-secrets.json');
let hostSecrets = {};
if (fs.existsSync(secretsPath)) {
  try {
    hostSecrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
  } catch {
    hostSecrets = {};
  }
}

let secretsDirty = false;
if (!hostSecrets.apiToken || String(hostSecrets.apiToken).length < 16) {
  hostSecrets.apiToken = crypto.randomBytes(24).toString('hex');
  secretsDirty = true;
}
if (!hostSecrets.sessionSecret || String(hostSecrets.sessionSecret).length < 32) {
  hostSecrets.sessionSecret = crypto.randomBytes(32).toString('hex');
  secretsDirty = true;
}
if (secretsDirty) {
  fs.writeFileSync(secretsPath, JSON.stringify(hostSecrets, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

function getPrimaryLanIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const list of Object.values(nets)) {
    if (!Array.isArray(list)) continue;
    for (const net of list) {
      const isV4 = net.family === 'IPv4' || net.family === 4;
      if (isV4 && !net.internal && net.address) {
        candidates.push(net.address);
      }
    }
  }
  return (
    candidates.find(
      (ip) =>
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    ) ||
    candidates[0] ||
    '127.0.0.1'
  );
}

function openDesktopWindow(url) {
  if (noBrowser || process.platform !== 'win32') return;
  const edgePaths = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter((p) => p && fs.existsSync(p));

  if (edgePaths.length > 0) {
    spawn(edgePaths[0], [`--app=${url}`, '--window-size=1440,900'], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }

  spawn('cmd', ['/c', 'start', '', url], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

const lanIp = getPrimaryLanIp();
const localUrl = `http://localhost:${port}`;
const lanUrl = `http://${lanIp}:${port}`;

console.log('==============================================================');
console.log('  CIOB GMAO Nexus — Local Windows & Wi-Fi LAN Host');
console.log('==============================================================');
console.log(`  SQLite Database : ${dbFile}`);
console.log(`  Backups Folder  : ${path.join(dataDir, 'backups')}`);
console.log(`  This PC (Local) : ${localUrl}`);
console.log(`  LAN PCs (Wi-Fi) : ${lanUrl}`);
console.log(`  Mobile Consult  : ${lanUrl}/#mobile`);
console.log('==============================================================');

const child = spawn(
  process.execPath,
  [path.join(projectRoot, 'server.ts'), '--port', String(port), '--data-dir', dataDir, '--db-file', dbFile],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      GMAO_PORT: String(port),
      GMAO_DATA_DIR: dataDir,
      GMAO_DB_FILE: dbFile,
      GMAO_STORAGE_ENGINE: 'sqlite',
      GMAO_API_TOKEN: process.env.GMAO_API_TOKEN || hostSecrets.apiToken,
      GMAO_SESSION_SECRET: process.env.GMAO_SESSION_SECRET || hostSecrets.sessionSecret,
    },
  }
);

setTimeout(() => openDesktopWindow(localUrl), 1500);

const forwardSignal = (signal) => {
  try {
    child.kill(signal);
  } catch {
    // ignore
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
