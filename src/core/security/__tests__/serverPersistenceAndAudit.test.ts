// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { createGmaoApiApp } from '../../../../server';
import { pbkdf2Sha256Hex, randomBytesHex } from '../nativeCrypto';
import { readRecentAuditEntries } from '../../../server/auditLogReader';
import { validateProjectedStockInvariant } from '../../../server/stockInvariantGuard';

function makePbkdf2Hash(plainPassword: string): string {
  const saltHex = randomBytesHex(16);
  const hashHex = pbkdf2Sha256Hex(plainPassword, saltHex, 1000, 32);
  return `pbkdf2:v1:${saltHex}:1000:${hashHex}`;
}

function sendHttpRequest(params: {
  port: number;
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<{ status: number; headers: http.IncomingHttpHeaders; json: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const bodyStr = params.body !== undefined ? JSON.stringify(params.body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: params.port,
        path: params.path,
        method: params.method,
        headers: {
          ...(bodyStr
            ? {
                'Content-Type': 'application/json',
                'Content-Length': String(Buffer.byteLength(bodyStr)),
              }
            : {}),
          ...(params.headers || {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let json: any = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            json,
            raw,
          });
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

describe('Server Hardening — Atomic Persistence Rollback, Bounded Audit Tail & Negative Stock Guard', () => {
  let tempDir = '';
  let server: http.Server | null = null;
  let cleanupApp: (() => void) | null = null;
  let port = 0;

  const ADMIN_PASS = 'Admin_S3cure_2026!';
  const TEST_SECRET = 'ciob-gmao-test-persistence-secret-0123456789abcdef';

  const startTestServer = async (initialState: Record<string, any>) => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmao-persist-audit-'));
    const instance = createGmaoApiApp({
      dataDir: tempDir,
      port: 0,
      isProduction: false,
      sessionSecret: TEST_SECRET,
      initialState,
    });
    cleanupApp = instance.cleanup;
    await new Promise<void>((resolve) => {
      server = instance.app.listen(0, '127.0.0.1', () => {
        const addr = server?.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
    return instance;
  };

  afterEach(async () => {
    if (cleanupApp) {
      cleanupApp();
      cleanupApp = null;
    }
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('readRecentAuditEntries reads bounded tail window without loading full large JSONL files', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmao-audit-tail-'));
    const auditFile = path.join(tempDir, 'gmao_audit.jsonl');

    const lines: string[] = [];
    for (let i = 1; i <= 400; i++) {
      lines.push(
        JSON.stringify({
          id: `aud_${i}`,
          seq: i,
          action: 'SYNC_STATE',
          padding: 'X'.repeat(120),
        })
      );
    }
    lines.push('{corrupted-json-line');
    lines.push(JSON.stringify({ id: 'aud_401', seq: 401, action: 'CREATE_ITEM' }));
    fs.writeFileSync(auditFile, lines.join('\n') + '\n', 'utf-8');

    // Read only last 4 KB (~18-22 lines) and request latest 5 entries
    const recent = await readRecentAuditEntries(auditFile, 5, 4096);
    expect(recent).toHaveLength(5);
    expect(recent.map((r) => r.seq)).toEqual([401, 400, 399, 398, 397]);

    const missing = await readRecentAuditEntries(path.join(tempDir, 'missing.jsonl'), 10);
    expect(missing).toEqual([]);
  });

  it('validateProjectedStockInvariant detects over-drawn SORTIE while permitting valid withdrawals', () => {
    const stock = [{ ref: 'PDR-001', stockInitial: 5 }];
    const okRes = validateProjectedStockInvariant({
      previousRawStock: stock,
      previousMouvements: [],
      nextRawStock: stock,
      nextMouvements: [{ id: 'M-1', ref: 'PDR-001', type: 'SORTIE', quantite: 3 }],
    });
    expect(okRes.valid).toBe(true);

    const badRes = validateProjectedStockInvariant({
      previousRawStock: stock,
      previousMouvements: [{ id: 'M-1', ref: 'PDR-001', type: 'SORTIE', quantite: 3 }],
      nextRawStock: stock,
      nextMouvements: [
        { id: 'M-1', ref: 'PDR-001', type: 'SORTIE', quantite: 3 },
        { id: 'M-2', ref: 'PDR-001', type: 'SORTIE', quantite: 4 },
      ],
    });
    expect(badRes.valid).toBe(false);
    expect(badRes.violations[0]).toMatchObject({
      ref: 'PDR-001',
      availableBefore: 2,
      projectedBalance: -2,
      deficit: 2,
    });
  });

  it('persistState failure returns HTTP 500, rolls back version & memory state, and keeps writeQueue healthy', async () => {
    const { dbState } = await startTestServer({
      users: [
        {
          id: 'USR-ADMIN',
          username: 'admin',
          nom: 'Admin',
          role: 'ADMIN',
          passwordHash: makePbkdf2Hash(ADMIN_PASS),
          is_active: true,
        },
      ],
      technicians: [],
      machines: [{ id: 'M-1', code: 'M-1' }],
    });

    const login = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/auth/login',
      body: { identifier: 'USR-ADMIN', password: ADMIN_PASS },
    });
    expect(login.status).toBe(200);
    const token = login.json.token;

    const initialVersion = dbState.version;
    // Block atomic rename(gmao_state.json.tmp -> gmao_state.json) by creating a directory at STATE_FILE
    const stateFilePath = path.join(tempDir, 'gmao_state.json');
    fs.mkdirSync(stateFilePath);

    const failedRes = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/machines',
      headers: { Authorization: `Bearer ${token}` },
      body: { id: 'M-FAIL', code: 'M-FAIL' },
    });
    expect(failedRes.status).toBe(500);
    expect(failedRes.json?.code).toBe('PERSISTENCE_FAILED');
    expect(dbState.version).toBe(initialVersion);
    expect(dbState.machines.some((m: any) => m.id === 'M-FAIL')).toBe(false);

    // Recover disk path and verify writeQueue was NOT poisoned
    fs.rmSync(stateFilePath, { recursive: true, force: true });
    const recoveredRes = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/machines',
      headers: { Authorization: `Bearer ${token}` },
      body: { id: 'M-OK', code: 'M-OK' },
    });
    expect(recoveredRes.status).toBe(201);
    expect(dbState.version).toBe(initialVersion + 1);
    expect(dbState.machines.some((m: any) => m.id === 'M-OK')).toBe(true);
  });

  it('blocks concurrent over-drawn SORTIE on POST /api/gmao/mouvements and POST /api/gmao/state with 409 STOCK_NEGATIVE_PREVENTED', async () => {
    const { dbState } = await startTestServer({
      users: [
        {
          id: 'USR-ADMIN',
          username: 'admin',
          nom: 'Admin',
          role: 'ADMIN',
          passwordHash: makePbkdf2Hash(ADMIN_PASS),
          is_active: true,
        },
      ],
      technicians: [],
      rawStock: [{ id: 'S-1', ref: 'ROUL-6205', designation: 'Roulement', stockInitial: 5 }],
      stock: [{ id: 'S-1', ref: 'ROUL-6205', designation: 'Roulement', stockInitial: 5 }],
      mouvements: [],
    });

    const login = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/auth/login',
      body: { identifier: 'USR-ADMIN', password: ADMIN_PASS },
    });
    const token = login.json.token;

    // Device A withdraws 3 -> OK (remaining = 2)
    const firstOut = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/mouvements',
      headers: { Authorization: `Bearer ${token}` },
      body: { id: 'MVT-1', ref: 'ROUL-6205', type: 'SORTIE', quantite: 3 },
    });
    expect(firstOut.status).toBe(201);
    expect(dbState.mouvements).toHaveLength(1);

    // Device B attempts to withdraw 4 via entity endpoint -> 409 Conflict
    const secondOut = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/mouvements',
      headers: { Authorization: `Bearer ${token}` },
      body: { id: 'MVT-2', ref: 'ROUL-6205', type: 'SORTIE', quantite: 4 },
    });
    expect(secondOut.status).toBe(409);
    expect(secondOut.json?.code).toBe('STOCK_NEGATIVE_PREVENTED');
    expect(dbState.mouvements).toHaveLength(1);

    // Offline client merges a stale state containing another SORTIE of 3 -> 409 Conflict
    const mergeConflict = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/state',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        merge: true,
        mouvements: [{ id: 'MVT-3', ref: 'ROUL-6205', type: 'SORTIE', quantite: 3 }],
      },
    });
    expect(mergeConflict.status).toBe(409);
    expect(mergeConflict.json?.code).toBe('STOCK_NEGATIVE_PREVENTED');
    expect(dbState.mouvements).toHaveLength(1);
  });

  it('blocks DELETE /api/gmao/mouvements/:id when removing an ENTREE drives stock negative, while allowing safe deletions', async () => {
    const { dbState } = await startTestServer({
      users: [
        {
          id: 'USR-ADMIN',
          username: 'admin',
          nom: 'Admin',
          role: 'ADMIN',
          passwordHash: makePbkdf2Hash(ADMIN_PASS),
          is_active: true,
        },
      ],
      technicians: [],
      rawStock: [{ id: 'S-2', ref: 'JOINT-SPI', designation: 'Joint', stockInitial: 0 }],
      stock: [{ id: 'S-2', ref: 'JOINT-SPI', designation: 'Joint', stockInitial: 0 }],
      mouvements: [
        { id: 'MVT-ENT-1', ref: 'JOINT-SPI', type: 'ENTREE', quantite: 5 },
        { id: 'MVT-SOR-1', ref: 'JOINT-SPI', type: 'SORTIE', quantite: 4 },
      ],
    });

    const login = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/auth/login',
      body: { identifier: 'USR-ADMIN', password: ADMIN_PASS },
    });
    const token = login.json.token;

    // Deleting MVT-ENT-1 leaves balance = 0 - 4 = -4 -> must reject 409 and keep state intact
    const blockedDelete = await sendHttpRequest({
      port,
      method: 'DELETE',
      path: '/api/gmao/mouvements/MVT-ENT-1',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(blockedDelete.status).toBe(409);
    expect(blockedDelete.json?.code).toBe('STOCK_NEGATIVE_PREVENTED');
    expect(dbState.mouvements).toHaveLength(2);

    // Deleting MVT-SOR-1 leaves balance = +5 (>= 0) -> must succeed (200)
    const allowedDelete = await sendHttpRequest({
      port,
      method: 'DELETE',
      path: '/api/gmao/mouvements/MVT-SOR-1',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(allowedDelete.status).toBe(200);
    expect(dbState.mouvements).toHaveLength(1);
    expect(dbState.mouvements[0].id).toBe('MVT-ENT-1');
  });
});
