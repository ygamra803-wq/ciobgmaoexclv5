// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import {
  resolveEffectiveServerRole,
  evaluateBootstrapWriteAllowance,
  isLoopbackRemoteAddress,
  isAllowedCorsOrigin,
} from '../serverRbacPolicy';
import {
  signServerSession,
  verifyServerSession,
  verifyAccountCredentials,
  stripSensitiveAccountFields,
} from '../serverSession';
import { pbkdf2Sha256Hex, randomBytesHex } from '../nativeCrypto';
import { createGmaoApiApp } from '../../../../server';

function makePbkdf2Hash(plainPassword: string): string {
  const saltHex = randomBytesHex(16);
  const hashHex = pbkdf2Sha256Hex(plainPassword, saltHex, 1000, 32);
  return `pbkdf2:v1:${saltHex}:1000:${hashHex}`;
}

const ADMIN_PASS = 'Admin_S3cure_2026!';
const MAG_PASS = 'Mag_S3cure_2026!';
const TECH_PASS = 'Tech_S3cure_2026!';

const SAMPLE_DB_USERS = [
  {
    id: 'USR-ADMIN-1',
    code: 'ADM-01',
    username: 'admin.ciob',
    nom: 'Admin Principal',
    role: 'ADMIN',
    passwordHash: makePbkdf2Hash(ADMIN_PASS),
    is_active: true,
  },
  {
    id: 'USR-MAG-1',
    code: 'RMG-01',
    username: 'magasin.ciob',
    nom: 'Responsable Magasin',
    role: 'RESPONSABLE_MAGASIN',
    passwordHash: makePbkdf2Hash(MAG_PASS),
    is_active: true,
  },
  {
    id: 'USR-ARCH-1',
    username: 'ancien.admin',
    nom: 'Ancien Admin',
    role: 'ADMIN',
    passwordHash: makePbkdf2Hash(ADMIN_PASS),
    is_active: false,
    statut: 'ARCHIVE',
  },
];

const SAMPLE_DB_TECHS = [
  {
    id_technician: 'TECH-01',
    nom: 'Rachid Maintenance',
    id_zone: 'FM',
    passwordHash: makePbkdf2Hash(TECH_PASS),
    // intentionally omit .role to verify default TECHNICIEN mapping
    is_active: true,
  },
  {
    id_technician: 'TECH-ARCH-02',
    nom: 'Tech Archive',
    role: 'TECHNICIEN',
    passwordHash: makePbkdf2Hash(TECH_PASS),
    actif: false,
  },
];

const SAMPLE_AUTH_ACCOUNTS = [
  {
    id: 'admin',
    code: 'admin',
    username: 'admin',
    name: 'Administrateur',
    role: 'ADMIN',
    personnelId: null,
    passwordHash: makePbkdf2Hash(ADMIN_PASS),
    isActive: true,
  },
  {
    id: 'magasinier',
    code: 'magasinier',
    username: 'magasinier',
    name: 'Responsable Magasin',
    role: 'RESPONSABLE_MAGASIN',
    personnelId: 'RESP-04',
    passwordHash: makePbkdf2Hash(MAG_PASS),
    isActive: true,
  },
  {
    id: 'viewer',
    code: 'viewer',
    username: 'viewer',
    name: 'Observateur',
    role: 'VIEWER',
    personnelId: null,
    passwordHash: makePbkdf2Hash('Viewer_S3cure_2026!'),
    isActive: true,
  },
];

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

describe('SEC-LAN-P0 + SEC-LAN-P1 — Fail-Closed Server RBAC & Server-Issued HMAC Session Proof', () => {
  describe('1. resolveEffectiveServerRole Fail-Closed Matrix (T1–T6)', () => {
    it('T1: downgrades unknown actorId (ghost-99) claiming ADMIN to VIEWER with identityStatus=UNKNOWN and roleSpoofDetected=true', () => {
      const res = resolveEffectiveServerRole(
        {
          'x-gmao-role': 'ADMIN',
          'x-gmao-actor-id': 'ghost-99',
          'x-gmao-actor': 'Ghost Operator',
        },
        SAMPLE_DB_USERS,
        SAMPLE_DB_TECHS,
        SAMPLE_AUTH_ACCOUNTS
      );

      expect(res.effectiveRole).toBe('VIEWER');
      expect(res.identityStatus).toBe('UNKNOWN');
      expect(res.roleSpoofDetected).toBe(true);
      expect(res.isArchivedActor).toBe(false);
    });

    it('T1b: prevents name-fallback impersonation when an unrecognized actorId is paired with a real ADMIN display name', () => {
      const res = resolveEffectiveServerRole(
        {
          'x-gmao-role': 'ADMIN',
          'x-gmao-actor-id': 'ghost-99',
          'x-gmao-actor': 'Admin Principal',
        },
        SAMPLE_DB_USERS,
        SAMPLE_DB_TECHS
      );

      expect(res.effectiveRole).toBe('VIEWER');
      expect(res.identityStatus).toBe('UNKNOWN');
      expect(res.roleSpoofDetected).toBe(true);
    });

    it('T2: clamps registered active TECHNICIEN claiming ADMIN to TECHNICIEN with identityStatus=VERIFIED and roleSpoofDetected=true', () => {
      const res = resolveEffectiveServerRole(
        {
          'x-gmao-role': 'ADMIN',
          'x-gmao-actor-id': 'TECH-01',
          'x-gmao-actor': 'Rachid Maintenance',
        },
        SAMPLE_DB_USERS,
        SAMPLE_DB_TECHS
      );

      expect(res.effectiveRole).toBe('TECHNICIEN');
      expect(res.identityStatus).toBe('VERIFIED');
      expect(res.roleSpoofDetected).toBe(true);
      expect(res.isArchivedActor).toBe(false);
    });

    it('T3: verifies active registered ADMIN and gateway accounts (admin, RESP-04) via dbUsers & dbAuthAccounts', () => {
      const res = resolveEffectiveServerRole(
        {
          'x-gmao-role': 'ADMIN',
          'x-gmao-actor-id': 'USR-ADMIN-1',
          'x-gmao-actor': 'Admin Principal',
        },
        SAMPLE_DB_USERS,
        SAMPLE_DB_TECHS,
        SAMPLE_AUTH_ACCOUNTS
      );
      expect(res.effectiveRole).toBe('ADMIN');
      expect(res.identityStatus).toBe('VERIFIED');
      expect(res.roleSpoofDetected).toBe(false);

      const gatewayMag = resolveEffectiveServerRole(
        {
          'x-gmao-role': 'RESPONSABLE_MAGASIN',
          'x-gmao-actor-id': 'RESP-04',
        },
        SAMPLE_DB_USERS,
        SAMPLE_DB_TECHS,
        SAMPLE_AUTH_ACCOUNTS
      );
      expect(gatewayMag.effectiveRole).toBe('RESPONSABLE_MAGASIN');
      expect(gatewayMag.identityStatus).toBe('VERIFIED');
      expect(gatewayMag.roleSpoofDetected).toBe(false);
    });

    it('T4: blocks archived user claiming ADMIN or TECHNICIEN with VIEWER, identityStatus=ARCHIVED, isArchivedActor=true', () => {
      const archivedAdmin = resolveEffectiveServerRole(
        {
          'x-gmao-role': 'ADMIN',
          'x-gmao-actor-id': 'USR-ARCH-1',
        },
        SAMPLE_DB_USERS,
        SAMPLE_DB_TECHS
      );
      expect(archivedAdmin.effectiveRole).toBe('VIEWER');
      expect(archivedAdmin.identityStatus).toBe('ARCHIVED');
      expect(archivedAdmin.isArchivedActor).toBe(true);

      const archivedTech = resolveEffectiveServerRole(
        {
          'x-gmao-role': 'TECHNICIEN',
          'x-gmao-actor-id': 'TECH-ARCH-02',
        },
        SAMPLE_DB_USERS,
        SAMPLE_DB_TECHS
      );
      expect(archivedTech.effectiveRole).toBe('VIEWER');
      expect(archivedTech.identityStatus).toBe('ARCHIVED');
      expect(archivedTech.isArchivedActor).toBe(true);
    });

    it('T5: resolves missing or generic actor identities (GUEST/ANONYMOUS/WEB-OPERATOR) to VIEWER with identityStatus=ANONYMOUS', () => {
      const missingActor = resolveEffectiveServerRole({ 'x-gmao-role': 'ADMIN' }, SAMPLE_DB_USERS, SAMPLE_DB_TECHS);
      expect(missingActor.effectiveRole).toBe('VIEWER');
      expect(missingActor.identityStatus).toBe('ANONYMOUS');
      expect(missingActor.roleSpoofDetected).toBe(true);

      for (const genericName of ['GUEST', 'ANONYMOUS', 'UNKNOWN', 'web-operator']) {
        const res = resolveEffectiveServerRole(
          { 'x-gmao-role': 'ADMIN', 'x-gmao-actor': genericName },
          SAMPLE_DB_USERS,
          SAMPLE_DB_TECHS
        );
        expect(res.effectiveRole).toBe('VIEWER');
        expect(res.identityStatus).toBe('ANONYMOUS');
        expect(res.roleSpoofDetected).toBe(true);
      }
    });

    it('T6: returns VIEWER + UNKNOWN on empty registry and restricts Bootstrap to POST users/state/authAccounts with loopback or strong token', () => {
      const resolvedEmpty = resolveEffectiveServerRole(
        { 'x-gmao-role': 'ADMIN', 'x-gmao-actor-id': 'init-admin' },
        [],
        []
      );
      expect(resolvedEmpty.effectiveRole).toBe('VIEWER');
      expect(resolvedEmpty.identityStatus).toBe('UNKNOWN');
      expect(resolvedEmpty.roleSpoofDetected).toBe(true);

      expect(
        evaluateBootstrapWriteAllowance({
          method: 'POST',
          targetEntity: 'state',
          dbUsers: [],
          dbTechnicians: [],
          remoteAddress: '192.168.1.45',
          providedToken: undefined,
          expectedToken: '',
          isProduction: false,
        }).allowed
      ).toBe(false);

      expect(
        evaluateBootstrapWriteAllowance({
          method: 'POST',
          targetEntity: 'machines',
          dbUsers: [],
          dbTechnicians: [],
          remoteAddress: '127.0.0.1',
          providedToken: undefined,
          expectedToken: '',
          isProduction: false,
        }).allowed
      ).toBe(false);

      expect(
        evaluateBootstrapWriteAllowance({
          method: 'POST',
          targetEntity: 'users',
          dbUsers: [],
          dbTechnicians: [],
          remoteAddress: '::ffff:127.0.0.1',
          providedToken: undefined,
          expectedToken: '',
          isProduction: false,
        }).allowed
      ).toBe(true);

      expect(
        evaluateBootstrapWriteAllowance({
          method: 'POST',
          targetEntity: 'state',
          dbUsers: [],
          dbTechnicians: [],
          remoteAddress: '127.0.0.1',
          providedToken: undefined,
          expectedToken: '',
          isProduction: true,
        }).allowed
      ).toBe(false);

      expect(
        evaluateBootstrapWriteAllowance({
          method: 'POST',
          targetEntity: 'state',
          dbUsers: [],
          dbTechnicians: [],
          remoteAddress: '192.168.1.10',
          providedToken: 'Strong_Bootstrap_Token_2026!',
          expectedToken: 'Strong_Bootstrap_Token_2026!',
          isProduction: true,
        }).allowed
      ).toBe(true);

      expect(
        evaluateBootstrapWriteAllowance({
          method: 'POST',
          targetEntity: 'users',
          dbUsers: SAMPLE_DB_USERS,
          dbTechnicians: [],
          remoteAddress: '127.0.0.1',
          providedToken: 'Strong_Bootstrap_Token_2026!',
          expectedToken: 'Strong_Bootstrap_Token_2026!',
          isProduction: true,
        }).allowed
      ).toBe(false);
    });
  });

  describe('2. Server Session Cryptography, Credentials & CORS Helpers', () => {
    it('signs, verifies, rejects tampered/expired/revoked tokens, and strips passwordHash on transport', () => {
      const secret = 'server-session-test-secret-0123456789abcdef';
      const now = 1_700_000_000;
      const issued = signServerSession(
        { sub: 'USR-ADMIN-1', role: 'ADMIN', name: 'Admin Principal', ttlSeconds: 3600 },
        secret,
        now
      );

      expect(verifyServerSession(issued.token, secret, { nowSec: now + 100 }).valid).toBe(true);
      expect(verifyServerSession(issued.token, secret, { nowSec: now + 3601 }).reason).toBe('EXPIRED');

      const tampered = issued.token.slice(0, -4) + 'dead';
      expect(verifyServerSession(tampered, secret, { nowSec: now + 10 }).reason).toBe('INVALID_SIGNATURE');

      const revoked = new Set<string>([issued.payload.sid]);
      expect(verifyServerSession(issued.token, secret, { nowSec: now + 10, revokedSessionIds: revoked }).reason).toBe(
        'REVOKED'
      );

      const stripped = stripSensitiveAccountFields('authAccounts', SAMPLE_AUTH_ACCOUNTS);
      expect(stripped[0].passwordHash).toBeUndefined();
      expect(stripped[0].username).toBe('admin');

      const devSeedAccount = {
        id: 'admin',
        passwordHash: 'pbkdf2:v1:7a9f8c6b5d4e3f2a1b0c:100000:admin_init_seed',
      };
      expect(verifyAccountCredentials(devSeedAccount, 'admin', false).valid).toBe(true);
      expect(verifyAccountCredentials(devSeedAccount, 'admin', true).valid).toBe(false);
    });

    it('allows localhost/host-LAN origins and blocks arbitrary external origins', () => {
      const hostIps = new Set(['192.168.1.50']);
      const extra = new Set(['http://gmao.factory.local:3000']);

      expect(isAllowedCorsOrigin(undefined, extra, hostIps, 3000)).toBe(true);
      expect(isAllowedCorsOrigin('http://localhost:3000', extra, hostIps, 3000)).toBe(true);
      expect(isAllowedCorsOrigin('http://127.0.0.1:5173', extra, hostIps, 3000)).toBe(true);
      expect(isAllowedCorsOrigin('http://192.168.1.50:3000', extra, hostIps, 3000)).toBe(true);
      expect(isAllowedCorsOrigin('http://gmao.factory.local:3000', extra, hostIps, 3000)).toBe(true);

      expect(isAllowedCorsOrigin('https://evil.attacker.com', extra, hostIps, 3000)).toBe(false);
      expect(isAllowedCorsOrigin('http://192.168.1.99:3000', extra, hostIps, 3000)).toBe(false);
      expect(isAllowedCorsOrigin('null', extra, hostIps, 3000)).toBe(false);

      expect(isLoopbackRemoteAddress('127.0.0.1')).toBe(true);
      expect(isLoopbackRemoteAddress('::1')).toBe(true);
      expect(isLoopbackRemoteAddress('::ffff:127.0.0.1')).toBe(true);
      expect(isLoopbackRemoteAddress('192.168.1.22')).toBe(false);
    });
  });

  describe('3. Real Express Server HTTP Integration Checks (SEC-LAN-P1 U1–U6 & P0)', () => {
    let tempDir = '';
    let server: http.Server | null = null;
    let cleanupApp: (() => void) | null = null;
    let port = 0;
    const TEST_SESSION_SECRET = 'ciob-gmao-test-session-secret-0123456789abcdef';

    const startTestServer = async (opts: {
      isProduction?: boolean;
      initialState?: Record<string, any>;
      sessionSecret?: string;
    } = {}) => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmao-sec-p1-'));
      const instance = createGmaoApiApp({
        dataDir: tempDir,
        port: 0,
        isProduction: opts.isProduction ?? false,
        initialState: opts.initialState,
        sessionSecret: opts.sessionSecret ?? TEST_SESSION_SECRET,
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

    const loginOnServer = async (
      identifier: string,
      password: string,
      apiToken?: string
    ): Promise<{ status: number; json: any; token: string }> => {
      const res = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/auth/login',
        headers: {
          'x-gmao-client-origin': 'gmao-web-client',
          ...(apiToken ? { 'x-gmao-api-token': apiToken } : {}),
        },
        body: { identifier, password },
      });
      return { status: res.status, json: res.json, token: String(res.json?.token || '') };
    };

    beforeEach(() => {
      delete process.env.GMAO_API_TOKEN;
      delete process.env.GMAO_SESSION_SECRET;
      delete process.env.GMAO_ENABLE_SWAGGER;
    });

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

    it('U1: rejects registered ADMIN (USR-ADMIN-1) WITH valid GMAO_API_TOKEN but WITHOUT server session token (403)', async () => {
      process.env.GMAO_API_TOKEN = 'Strong_Prod_LAN_Secret_2026!';
      const { dbState } = await startTestServer({
        isProduction: true,
        initialState: {
          users: SAMPLE_DB_USERS,
          technicians: SAMPLE_DB_TECHS,
          authAccounts: SAMPLE_AUTH_ACCOUNTS,
          machines: [{ id: 'M-1', code: 'DET-01' }],
        },
      });

      const spoofedWrite = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/machines',
        headers: {
          'x-gmao-api-token': 'Strong_Prod_LAN_Secret_2026!',
          'x-gmao-client-origin': 'gmao-web-client',
          'x-gmao-actor-id': 'USR-ADMIN-1',
          'x-gmao-actor': 'Admin Principal',
          'x-gmao-role': 'ADMIN',
        },
        body: { id: 'M-HACK', code: 'HACK-01' },
      });
      expect(spoofedWrite.status).toBe(403);
      expect(spoofedWrite.json?.code).toBe('SERVER_SESSION_REQUIRED');
      expect(dbState.machines).toHaveLength(1);

      const headerOnlyStatePush = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/state',
        headers: {
          'x-gmao-api-token': 'Strong_Prod_LAN_Secret_2026!',
          'x-gmao-client-origin': 'gmao-web-client',
          'x-gmao-actor-id': 'USR-ADMIN-1',
          'x-gmao-role': 'ADMIN',
        },
        body: { machines: [{ id: 'M-HACK', code: 'HACK-01' }] },
      });
      expect(headerOnlyStatePush.status).toBe(403);
      expect(dbState.machines).toHaveLength(1);

      // Sensitive reads also require verified server session when registry is non-empty
      const sensitiveNet = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/network/info',
        headers: {
          'x-gmao-api-token': 'Strong_Prod_LAN_Secret_2026!',
          'x-gmao-client-origin': 'gmao-web-client',
          'x-gmao-actor-id': 'USR-ADMIN-1',
          'x-gmao-role': 'ADMIN',
        },
      });
      expect(sensitiveNet.status).toBe(403);
    });

    it('U2: valid server login issues signed session token allowing authorized writes and stripping passwordHash on reads', async () => {
      process.env.GMAO_API_TOKEN = 'Strong_Prod_LAN_Secret_2026!';
      const { dbState } = await startTestServer({
        isProduction: true,
        initialState: {
          users: SAMPLE_DB_USERS,
          technicians: SAMPLE_DB_TECHS,
          authAccounts: SAMPLE_AUTH_ACCOUNTS,
          machines: [{ id: 'M-1', code: 'DET-01' }],
        },
      });

      const badLogin = await loginOnServer('USR-ADMIN-1', 'WrongPassword!', 'Strong_Prod_LAN_Secret_2026!');
      expect(badLogin.status).toBe(401);

      const okLogin = await loginOnServer('USR-ADMIN-1', ADMIN_PASS, 'Strong_Prod_LAN_Secret_2026!');
      expect(okLogin.status).toBe(200);
      expect(okLogin.token).toMatch(/^GMAO1\./);
      expect(okLogin.json?.actor?.sub).toBe('USR-ADMIN-1');
      expect(okLogin.json?.actor?.role).toBe('ADMIN');

      // Authorized write with Bearer server session token -> 201 Created
      const adminWrite = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/machines',
        headers: {
          'x-gmao-api-token': 'Strong_Prod_LAN_Secret_2026!',
          'x-gmao-client-origin': 'gmao-web-client',
          Authorization: `Bearer ${okLogin.token}`,
        },
        body: { id: 'M-2', code: 'DET-02' },
      });
      expect(adminWrite.status).toBe(201);
      expect(dbState.machines).toHaveLength(2);

      // Gateway account (`admin`) also logs in cleanly via authAccounts
      const gatewayLogin = await loginOnServer('admin', ADMIN_PASS, 'Strong_Prod_LAN_Secret_2026!');
      expect(gatewayLogin.status).toBe(200);
      expect(gatewayLogin.json?.actor?.sub).toBe('admin');

      // GET /api/gmao/users and /api/gmao/state MUST strip passwordHash
      const usersRes = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/gmao/users',
        headers: {
          'x-gmao-api-token': 'Strong_Prod_LAN_Secret_2026!',
          Authorization: `Bearer ${okLogin.token}`,
        },
      });
      expect(usersRes.status).toBe(200);
      expect(usersRes.json?.data[0]?.passwordHash).toBeUndefined();

      const stateRes = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/gmao/state',
        headers: {
          'x-gmao-api-token': 'Strong_Prod_LAN_Secret_2026!',
          Authorization: `Bearer ${okLogin.token}`,
        },
      });
      expect(stateRes.status).toBe(200);
      expect(stateRes.json?.data?.authAccounts[0]?.passwordHash).toBeUndefined();
      expect(stateRes.json?.data?.users[0]?.passwordHash).toBeUndefined();

      // Sensitive /api/network/info succeeds with valid session token
      const validNet = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/network/info',
        headers: {
          'x-gmao-api-token': 'Strong_Prod_LAN_Secret_2026!',
          Authorization: `Bearer ${okLogin.token}`,
        },
      });
      expect(validNet.status).toBe(200);
      expect(validNet.json?.primaryIp).toBeDefined();
      expect(validNet.json?.platform).toBeUndefined();
    });

    it('U3: rejects expired, tampered-signature, and revoked (logged-out) server session tokens with 403', async () => {
      const { dbState } = await startTestServer({
        initialState: {
          users: SAMPLE_DB_USERS,
          technicians: SAMPLE_DB_TECHS,
          authAccounts: SAMPLE_AUTH_ACCOUNTS,
          machines: [],
        },
      });

      const login = await loginOnServer('USR-ADMIN-1', ADMIN_PASS);
      expect(login.status).toBe(200);

      // Tampered signature
      const tamperedToken = login.token.slice(0, -4) + 'cafe';
      const tamperedRes = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/machines',
        headers: { Authorization: `Bearer ${tamperedToken}` },
        body: { id: 'M-TAMP', code: 'TAMP-01' },
      });
      expect(tamperedRes.status).toBe(403);
      expect(tamperedRes.json?.code).toBe('SERVER_SESSION_INVALID');

      // Expired token
      const expired = signServerSession(
        { sub: 'USR-ADMIN-1', role: 'ADMIN', name: 'Admin Principal', ttlSeconds: 60 },
        TEST_SESSION_SECRET,
        Math.floor(Date.now() / 1000) - 120
      );
      const expiredRes = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/machines',
        headers: { 'X-GMAO-SESSION': expired.token },
        body: { id: 'M-EXP', code: 'EXP-01' },
      });
      expect(expiredRes.status).toBe(403);
      expect(expiredRes.json?.reason).toBe('EXPIRED');

      // Revoked via logout
      const logoutRes = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/auth/logout',
        headers: { Authorization: `Bearer ${login.token}` },
      });
      expect(logoutRes.status).toBe(200);

      const postLogoutWrite = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/machines',
        headers: { Authorization: `Bearer ${login.token}` },
        body: { id: 'M-REV', code: 'REV-01' },
      });
      expect(postLogoutWrite.status).toBe(403);
      expect(postLogoutWrite.json?.reason).toBe('REVOKED');
      expect(dbState.machines).toHaveLength(0);
    });

    it('U4: valid TECH-01 session cannot escalate to ADMIN via x-gmao-role: ADMIN or conflicting x-gmao-actor-id: USR-ADMIN-1', async () => {
      const { dbState } = await startTestServer({
        initialState: {
          users: SAMPLE_DB_USERS,
          technicians: SAMPLE_DB_TECHS,
          machines: [{ id: 'M-1', code: 'DET-01' }],
          correctiveInterventions: [],
        },
      });

      const techLogin = await loginOnServer('TECH-01', TECH_PASS);
      expect(techLogin.status).toBe(200);
      expect(techLogin.json?.actor?.role).toBe('TECHNICIEN');

      // Attempt admin write with spoofed x-gmao-role and x-gmao-actor-id -> 403
      const techUsersRes = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/users',
        headers: {
          Authorization: `Bearer ${techLogin.token}`,
          'x-gmao-actor-id': 'USR-ADMIN-1',
          'x-gmao-role': 'ADMIN',
        },
        body: { id: 'USR-FAKE', role: 'ADMIN' },
      });
      expect(techUsersRes.status).toBe(403);

      const techDeleteRes = await sendHttpRequest({
        port,
        method: 'DELETE',
        path: '/api/gmao/machines/M-1',
        headers: {
          Authorization: `Bearer ${techLogin.token}`,
          'x-gmao-actor-id': 'USR-ADMIN-1',
          'x-gmao-role': 'ADMIN',
        },
      });
      expect(techDeleteRes.status).toBe(403);
      expect(dbState.machines).toHaveLength(1);

      // Legitimate technician field write (with attempted ADMIN bulk keys + self-approval) stays clamped to TECHNICIEN + Maker-Checker!
      const techFieldState = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/state',
        headers: {
          Authorization: `Bearer ${techLogin.token}`,
          'x-gmao-actor-id': 'USR-ADMIN-1',
          'x-gmao-role': 'ADMIN',
        },
        body: {
          users: [{ id: 'USR-EVIL', role: 'ADMIN' }],
          correctiveInterventions: [
            {
              id: 'BT-TECH-1',
              code_bon: 'BT-TECH-1',
              statut: 'CLOTURE',
              validation_status: 'APPROVED',
              stock_deducted: true,
            },
          ],
        },
      });
      expect(techFieldState.status).toBe(200);
      expect(dbState.users.some((u: any) => u.id === 'USR-EVIL')).toBe(false);
      expect(dbState.correctiveInterventions[0].validation_status).toBe('PENDING_VALIDATION');
      expect(dbState.correctiveInterventions[0].stock_deducted).toBe(false);
    });

    it('U5: no P0 regression — ghost-99 and archived actors remain blocked on all reads/writes, CORS & prod Swagger stay hardened', async () => {
      await startTestServer({
        isProduction: true,
        initialState: {
          users: SAMPLE_DB_USERS,
          technicians: SAMPLE_DB_TECHS,
          machines: [],
        },
      });
      process.env.GMAO_API_TOKEN = 'Strong_Prod_LAN_Secret_2026!';

      const ghostState = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/state',
        headers: {
          'x-gmao-api-token': 'Strong_Prod_LAN_Secret_2026!',
          'x-gmao-client-origin': 'gmao-web-client',
          'x-gmao-actor-id': 'ghost-99',
          'x-gmao-role': 'ADMIN',
        },
        body: { machines: [{ id: 'M-HACK' }] },
      });
      expect(ghostState.status).toBe(403);

      const ghostNet = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/network/info',
        headers: {
          'x-gmao-api-token': 'Strong_Prod_LAN_Secret_2026!',
          'x-gmao-client-origin': 'gmao-web-client',
          'x-gmao-actor-id': 'ghost-99',
          'x-gmao-role': 'ADMIN',
        },
      });
      expect(ghostNet.status).toBe(403);

      // Archived actor login rejected with 403
      const archivedLogin = await loginOnServer('USR-ARCH-1', ADMIN_PASS, 'Strong_Prod_LAN_Secret_2026!');
      expect(archivedLogin.status).toBe(403);

      // Swagger disabled in production
      const docsProd = await sendHttpRequest({ port, method: 'GET', path: '/api/docs.json' });
      expect(docsProd.status).toBe(404);

      // CORS blocks external origin while allowing localhost
      const evilCors = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/health',
        headers: { Origin: 'https://evil.attacker.com' },
      });
      expect(evilCors.headers['access-control-allow-origin']).toBeUndefined();

      const localCors = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/health',
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(localCors.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('U6: empty-DB Bootstrap remains strictly bounded to initial user creation and enforces session token immediately afterwards', async () => {
      const { dbState } = await startTestServer({
        isProduction: false,
        initialState: {
          users: [],
          technicians: [],
          authAccounts: [],
        },
      });

      const firstBoot = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/users',
        headers: {
          'x-gmao-actor-id': 'init-setup',
          'x-gmao-role': 'ADMIN',
        },
        body: {
          id: 'USR-ADMIN-1',
          nom: 'Admin Principal',
          role: 'ADMIN',
          passwordHash: makePbkdf2Hash(ADMIN_PASS),
          is_active: true,
        },
      });
      expect(firstBoot.status).toBe(201);
      expect(dbState.users).toHaveLength(1);

      // Immediately afterwards, header-only writes (both ghost-99 AND USR-ADMIN-1 without session) are rejected with 403!
      const secondGhost = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/users',
        headers: {
          'x-gmao-actor-id': 'ghost-99',
          'x-gmao-role': 'ADMIN',
        },
        body: { id: 'USR-EVIL', role: 'ADMIN' },
      });
      expect(secondGhost.status).toBe(403);

      const headerOnlyAdmin = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/machines',
        headers: {
          'x-gmao-actor-id': 'USR-ADMIN-1',
          'x-gmao-role': 'ADMIN',
        },
        body: { id: 'M-1', code: 'DET-01' },
      });
      expect(headerOnlyAdmin.status).toBe(403);

      // Now log in with the bootstrapped admin to obtain a session token and write
      const bootLogin = await loginOnServer('USR-ADMIN-1', ADMIN_PASS);
      expect(bootLogin.status).toBe(200);
      const authedWrite = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/machines',
        headers: { Authorization: `Bearer ${bootLogin.token}` },
        body: { id: 'M-1', code: 'DET-01' },
      });
      expect(authedWrite.status).toBe(201);
    });
  });
});
