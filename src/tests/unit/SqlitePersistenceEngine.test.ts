// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';
import { createGmaoApiApp } from '../../../server';
import { pbkdf2Sha256Hex, randomBytesHex } from '../../core/security/nativeCrypto';
import {
  createSqliteStateStore,
  isUncNetworkPath,
} from '../../server/persistence/sqliteStateStore';

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

describe('Phase 2 — Single-File SQLite Persistence Engine (ciob_gmao.db)', () => {
  let tempDir = '';
  let server: http.Server | null = null;
  let cleanupApp: (() => void) | null = null;
  let port = 0;

  const ADMIN_PASS = 'Admin_Sql1te_2026!';
  const TECH_PASS = 'Tech_Sql1te_2026!';
  const TEST_SECRET = 'ciob-gmao-sqlite-test-secret-0123456789abcdef';

  const startInstance = async (opts: {
    dataDir: string;
    dbFile?: string;
    initialState?: Record<string, any>;
    backupRetention?: number;
  }) => {
    const instance = createGmaoApiApp({
      dataDir: opts.dataDir,
      dbFile: opts.dbFile,
      port: 0,
      isProduction: false,
      sessionSecret: TEST_SECRET,
      initialState: opts.initialState,
      backupRetention: opts.backupRetention,
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

  const stopInstance = async () => {
    if (cleanupApp) {
      cleanupApp();
      cleanupApp = null;
    }
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  };

  afterEach(async () => {
    await stopInstance();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('persists CRUD state & audit log into a single ciob_gmao.db file and survives full process restart', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmao-sqlite-restart-'));
    const customDbFile = path.join(tempDir, 'factory_main.db');

    const adminUser = {
      id: 'USR-ADMIN',
      username: 'admin',
      nom: 'Directeur Usine',
      role: 'ADMIN',
      passwordHash: makePbkdf2Hash(ADMIN_PASS),
      is_active: true,
    };

    // 1. Start fresh server on custom SQLite file & bootstrap admin user
    const first = await startInstance({ dataDir: tempDir, dbFile: customDbFile });
    expect(first.storageEngine).toBe('sqlite');
    expect(first.dbFile).toBe(customDbFile);

    const health = await sendHttpRequest({ port, method: 'GET', path: '/api/health' });
    expect(health.status).toBe(200);
    expect(health.json.storageEngine).toBe('sqlite');
    expect(health.json.journalMode).toBe('WAL');

    const bootstrapRes = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/users',
      body: adminUser,
    });
    expect(bootstrapRes.status).toBe(201);

    const loginRes = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/auth/login',
      body: { identifier: 'USR-ADMIN', password: ADMIN_PASS },
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.json.token;

    // Create machine, stock item, and movement
    const mRes = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/machines',
      headers: { Authorization: `Bearer ${token}` },
      body: { id: 'M-SQL-01', code: 'EXT-01', nom: 'Extrudeuse Principale' },
    });
    expect(mRes.status).toBe(201);

    const sRes = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/rawStock',
      headers: { Authorization: `Bearer ${token}` },
      body: { id: 'S-SQL-01', ref: 'ROUL-6308', designation: 'Roulement SKF', stockInitial: 10 },
    });
    expect(sRes.status).toBe(201);

    const mvtRes = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/mouvements',
      headers: { Authorization: `Bearer ${token}` },
      body: { id: 'MVT-SQL-01', ref: 'ROUL-6308', type: 'SORTIE', quantite: 4 },
    });
    expect(mvtRes.status).toBe(201);
    const persistedVersion = mvtRes.json.version;
    expect(fs.existsSync(customDbFile)).toBe(true);

    // 2. Stop completely and restart WITHOUT initialState (must hydrate from factory_main.db)
    await stopInstance();
    const second = await startInstance({ dataDir: tempDir, dbFile: customDbFile });
    expect(second.dbState.version).toBe(persistedVersion);
    expect(second.dbState.machines).toHaveLength(1);
    expect(second.dbState.machines[0].code).toBe('EXT-01');
    expect(second.dbState.rawStock).toHaveLength(1);
    expect(second.dbState.mouvements).toHaveLength(1);

    // Login again against hydrated user record and verify indexed SQLite audit log
    const login2 = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/auth/login',
      body: { identifier: 'USR-ADMIN', password: ADMIN_PASS },
    });
    expect(login2.status).toBe(200);
    const token2 = login2.json.token;

    const auditRes = await sendHttpRequest({
      port,
      method: 'GET',
      path: '/api/gmao/audit?limit=10',
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(auditRes.status).toBe(200);
    expect(auditRes.json.data.length).toBeGreaterThanOrEqual(4);
    expect(auditRes.json.data[0].entity).toBe('mouvements');
    expect(auditRes.json.data[0].action).toBe('CREATE_ITEM');
  });

  it('automatically migrates legacy gmao_state.json and gmao_audit.jsonl into ciob_gmao.db without data loss', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmao-sqlite-migrate-'));
    const legacyStatePath = path.join(tempDir, 'gmao_state.json');
    const legacyAuditPath = path.join(tempDir, 'gmao_audit.jsonl');

    const legacyState = {
      version: 17,
      updatedAt: '2026-04-01T08:00:00.000Z',
      users: [
        {
          id: 'USR-ADMIN',
          username: 'admin',
          nom: 'Admin Legacy',
          role: 'ADMIN',
          passwordHash: makePbkdf2Hash(ADMIN_PASS),
          is_active: true,
        },
      ],
      machines: [{ id: 'M-LEG-1', code: 'PRESSE-09', nom: 'Presse Hydraulique' }],
      rawStock: [{ id: 'P-1', ref: 'COUR-A42', designation: 'Courroie', stockInitial: 12 }],
      stock: [{ id: 'P-1', ref: 'COUR-A42', designation: 'Courroie', stockInitial: 12 }],
      mouvements: [],
      financialBudgets: { fiscalYear: 2026, allocatedPreventive: 75000 },
    };
    fs.writeFileSync(legacyStatePath, JSON.stringify(legacyState, null, 2), 'utf-8');
    fs.writeFileSync(
      legacyAuditPath,
      [
        JSON.stringify({
          id: 'aud_leg_1',
          timestamp: '2026-04-01T07:50:00.000Z',
          version: 16,
          actor: 'Admin Legacy',
          action: 'CREATE_ITEM',
          entity: 'machines',
          summary: 'Migrated machine entry',
        }),
        '{malformed-line-ignored',
        JSON.stringify({
          id: 'aud_leg_2',
          timestamp: '2026-04-01T08:00:00.000Z',
          version: 17,
          actor: 'Admin Legacy',
          action: 'SYNC_STATE',
          entity: 'state',
          summary: 'Last JSON snapshot',
        }),
      ].join('\n') + '\n',
      'utf-8'
    );

    const instance = await startInstance({ dataDir: tempDir });
    expect(instance.dbState.version).toBe(17);
    expect(instance.dbState.machines[0].code).toBe('PRESSE-09');
    expect(instance.dbState.financialBudgets).toMatchObject({ fiscalYear: 2026, allocatedPreventive: 75000 });

    const login = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/auth/login',
      body: { identifier: 'USR-ADMIN', password: ADMIN_PASS },
    });
    expect(login.status).toBe(200);
    const token = login.json.token;

    const infoRes = await sendHttpRequest({
      port,
      method: 'GET',
      path: '/api/gmao/db/info',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(infoRes.status).toBe(200);
    expect(infoRes.json.data.engine).toBe('sqlite');
    expect(infoRes.json.data.migratedFromJsonAt).toBeTruthy();
    expect(infoRes.json.data.auditCount).toBe(2);

    const auditRes = await sendHttpRequest({
      port,
      method: 'GET',
      path: '/api/gmao/audit?limit=10',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(auditRes.status).toBe(200);
    expect(auditRes.json.data.map((r: any) => r.id)).toEqual(['aud_leg_2', 'aud_leg_1']);

    // Legacy JSON file remains untouched as read-only safety copy
    expect(fs.existsSync(legacyStatePath)).toBe(true);
  });

  it('enforces RBAC on /api/gmao/db/info and /api/gmao/db/backup and creates valid restorable VACUUM INTO snapshots with retention', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmao-sqlite-backup-'));

    await startInstance({
      dataDir: tempDir,
      backupRetention: 2,
      initialState: {
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
        technicians: [
          {
            id: 'TECH-1',
            username: 'tech1',
            nom: 'Tech',
            role: 'TECHNICIEN',
            passwordHash: makePbkdf2Hash(TECH_PASS),
            is_active: true,
          },
        ],
        machines: [{ id: 'M-BKP-1', code: 'COMP-01', nom: 'Compresseur Air' }],
      },
    });

    const adminLogin = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/auth/login',
      body: { identifier: 'USR-ADMIN', password: ADMIN_PASS },
    });
    const adminToken = adminLogin.json.token;

    const techLogin = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/auth/login',
      body: { identifier: 'TECH-1', password: TECH_PASS },
    });
    const techToken = techLogin.json.token;

    // TECHNICIEN must be blocked with 403 on both DB info and DB backup
    const techInfo = await sendHttpRequest({
      port,
      method: 'GET',
      path: '/api/gmao/db/info',
      headers: { Authorization: `Bearer ${techToken}` },
    });
    expect(techInfo.status).toBe(403);

    const techBackup = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/db/backup',
      headers: { Authorization: `Bearer ${techToken}` },
    });
    expect(techBackup.status).toBe(403);

    // ADMIN triggers 3 hot backups; retention=2 must keep only the 2 newest snapshots
    const b1 = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/db/backup',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(b1.status).toBe(201);
    expect(b1.json.data.sizeBytes).toBeGreaterThan(0);

    await new Promise((r) => setTimeout(r, 25));
    const b2 = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/db/backup',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(b2.status).toBe(201);

    await new Promise((r) => setTimeout(r, 25));
    const b3 = await sendHttpRequest({
      port,
      method: 'POST',
      path: '/api/gmao/db/backup',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(b3.status).toBe(201);
    expect(b3.json.data.retainedBackups).toBe(2);

    const backupFile = b3.json.data.backupFile;
    expect(fs.existsSync(backupFile)).toBe(true);

    // Verify the backup file is a genuinely readable standalone SQLite DB containing our machine
    const snapshotDb = new DatabaseSync(backupFile, { readOnly: true });
    try {
      const row = snapshotDb
        .prepare("SELECT payload_json FROM gmao_entities WHERE entity_key = 'machines'")
        .get() as { payload_json: string } | undefined;
      expect(row).toBeDefined();
      const machines = JSON.parse(row!.payload_json);
      expect(machines).toEqual([{ id: 'M-BKP-1', code: 'COMP-01', nom: 'Compresseur Air' }]);
    } finally {
      snapshotDb.close();
    }
  });

  it('rolls back memory state and version cleanly if SQLite persist fails (closed handle) and detects UNC network paths', async () => {
    expect(isUncNetworkPath('\\\\192.168.1.50\\GMAO\\ciob_gmao.db')).toBe(true);
    expect(isUncNetworkPath('//NAS-USINE/shared/ciob_gmao.db')).toBe(true);
    expect(isUncNetworkPath('C:\\Users\\Usine\\AppData\\Local\\CIOB-GMAO\\ciob_gmao.db')).toBe(false);
    expect(isUncNetworkPath('/var/lib/ciob-gmao/ciob_gmao.db')).toBe(false);

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmao-sqlite-rollback-'));
    const store = createSqliteStateStore({
      dbFile: path.join(tempDir, 'rollback_test.db'),
      journalMode: 'DELETE',
    });
    expect(store.journalMode).toBe('DELETE');

    store.dbState.machines.push({ id: 'M-1', code: 'M-1' });
    await store.persistState({ actor: 'admin', action: 'CREATE', entity: 'machines', summary: 'ok' });
    const committedVersion = store.dbState.version;
    expect(committedVersion).toBe(2);

    // Close DB to force persistence error and verify rollback hook runs cleanly
    store.close();
    const prevMachines = [...store.dbState.machines];
    store.dbState.machines.push({ id: 'M-FAIL', code: 'M-FAIL' });

    await expect(
      store.persistState(
        { actor: 'admin', action: 'CREATE', entity: 'machines', summary: 'should fail' },
        () => {
          store.dbState.machines = prevMachines;
        }
      )
    ).rejects.toThrow(/closed/i);

    expect(store.dbState.version).toBe(committedVersion);
    expect(store.dbState.machines.some((m) => m.id === 'M-FAIL')).toBe(false);
  });
});
