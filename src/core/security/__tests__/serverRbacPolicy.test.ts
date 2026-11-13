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
import { createGmaoApiApp } from '../../../../server';

const SAMPLE_DB_USERS = [
  {
    id: 'USR-ADMIN-1',
    code: 'ADM-01',
    username: 'admin.ciob',
    nom: 'Admin Principal',
    role: 'ADMIN',
    is_active: true,
  },
  {
    id: 'USR-MAG-1',
    code: 'RMG-01',
    username: 'magasin.ciob',
    nom: 'Responsable Magasin',
    role: 'RESPONSABLE_MAGASIN',
    is_active: true,
  },
  {
    id: 'USR-ARCH-1',
    username: 'ancien.admin',
    nom: 'Ancien Admin',
    role: 'ADMIN',
    is_active: false,
    statut: 'ARCHIVE',
  },
];

const SAMPLE_DB_TECHS = [
  {
    id_technician: 'TECH-01',
    nom: 'Rachid Maintenance',
    id_zone: 'FM',
    // intentionally omit .role to verify default TECHNICIEN mapping
    is_active: true,
  },
  {
    id_technician: 'TECH-ARCH-02',
    nom: 'Tech Archive',
    role: 'TECHNICIEN',
    actif: false,
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
          ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(bodyStr)) } : {}),
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

describe('SEC-LAN-P0 — Fail-Closed Server RBAC, Bootstrap Policy & Endpoint Hardening', () => {
  describe('1. resolveEffectiveServerRole Fail-Closed Matrix (T1–T6)', () => {
    it('T1: downgrades unknown actorId (ghost-99) claiming ADMIN to VIEWER with identityStatus=UNKNOWN and roleSpoofDetected=true', () => {
      const res = resolveEffectiveServerRole(
        {
          'x-gmao-role': 'ADMIN',
          'x-gmao-actor-id': 'ghost-99',
          'x-gmao-actor': 'Ghost Operator',
        },
        SAMPLE_DB_USERS,
        SAMPLE_DB_TECHS
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

    it('T3: verifies active registered ADMIN claiming ADMIN with identityStatus=VERIFIED and roleSpoofDetected=false', () => {
      const res = resolveEffectiveServerRole(
        {
          'x-gmao-role': 'ADMIN',
          'x-gmao-actor-id': 'USR-ADMIN-1',
          'x-gmao-actor': 'Admin Principal',
        },
        SAMPLE_DB_USERS,
        SAMPLE_DB_TECHS
      );

      expect(res.effectiveRole).toBe('ADMIN');
      expect(res.identityStatus).toBe('VERIFIED');
      expect(res.roleSpoofDetected).toBe(false);
      expect(res.isArchivedActor).toBe(false);
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

    it('T6: returns VIEWER + UNKNOWN when dbUsers & dbTechnicians are empty and restricts Bootstrap to POST users/state with loopback or strong token', () => {
      const resolvedEmpty = resolveEffectiveServerRole(
        { 'x-gmao-role': 'ADMIN', 'x-gmao-actor-id': 'init-admin' },
        [],
        []
      );
      expect(resolvedEmpty.effectiveRole).toBe('VIEWER');
      expect(resolvedEmpty.identityStatus).toBe('UNKNOWN');
      expect(resolvedEmpty.roleSpoofDetected).toBe(true);

      // Remote LAN device without strong token -> rejected even on empty DB
      const remoteUnauth = evaluateBootstrapWriteAllowance({
        method: 'POST',
        targetEntity: 'state',
        dbUsers: [],
        dbTechnicians: [],
        remoteAddress: '192.168.1.45',
        providedToken: undefined,
        expectedToken: '',
        isProduction: false,
      });
      expect(remoteUnauth.allowed).toBe(false);

      // Loopback disallowed for non-bootstrap entities or DELETE
      const loopbackMachines = evaluateBootstrapWriteAllowance({
        method: 'POST',
        targetEntity: 'machines',
        dbUsers: [],
        dbTechnicians: [],
        remoteAddress: '127.0.0.1',
        providedToken: undefined,
        expectedToken: '',
        isProduction: false,
      });
      expect(loopbackMachines.allowed).toBe(false);

      // Loopback allowed ONLY for POST on users/state in dev when DB is empty
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

      // Production requires strong token for bootstrap even on loopback
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

      // Once at least one user exists, bootstrap closes permanently
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

  describe('2. CORS & Loopback Helpers', () => {
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

  describe('3. Real Express Server HTTP Integration Checks (SEC-LAN-P0)', () => {
    let tempDir = '';
    let server: http.Server | null = null;
    let cleanupApp: (() => void) | null = null;
    let port = 0;

    const startTestServer = async (opts: {
      isProduction?: boolean;
      initialState?: Record<string, any>;
    } = {}) => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmao-sec-p0-'));
      const instance = createGmaoApiApp({
        dataDir: tempDir,
        port: 0,
        isProduction: opts.isProduction ?? false,
        initialState: opts.initialState,
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

    beforeEach(() => {
      delete process.env.GMAO_API_TOKEN;
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

    it('rejects POST /api/gmao/state and POST /api/gmao/machines with 403 when actorId=ghost-99 claims ADMIN (no state mutation)', async () => {
      const { dbState } = await startTestServer({
        initialState: {
          users: SAMPLE_DB_USERS,
          technicians: SAMPLE_DB_TECHS,
          machines: [],
        },
      });

      const stateAttempt = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/state',
        headers: {
          'x-gmao-client-origin': 'gmao-web-client',
          'x-gmao-actor-id': 'ghost-99',
          'x-gmao-actor': 'Ghost',
          'x-gmao-role': 'ADMIN',
        },
        body: {
          machines: [{ id: 'M-HACK', code: 'HACK-01' }],
        },
      });
      expect(stateAttempt.status).toBe(403);
      expect(stateAttempt.json?.success).toBe(false);
      expect(dbState.machines).toHaveLength(0);

      const entityAttempt = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/machines',
        headers: {
          'x-gmao-client-origin': 'gmao-web-client',
          'x-gmao-actor-id': 'ghost-99',
          'x-gmao-role': 'ADMIN',
        },
        body: { id: 'M-HACK', code: 'HACK-01' },
      });
      expect(entityAttempt.status).toBe(403);
      expect(dbState.machines).toHaveLength(0);
    });

    it('blocks spoofed ADMIN on registered TECHNICIEN (TECH-01), allows verified ADMIN writes, and blocks archived actors', async () => {
      const { dbState } = await startTestServer({
        initialState: {
          users: SAMPLE_DB_USERS,
          technicians: SAMPLE_DB_TECHS,
          machines: [{ id: 'M-1', code: 'DET-01' }],
        },
      });

      // Registered TECHNICIEN spoofing ADMIN cannot mutate users or delete machines
      const techUsersRes = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/users',
        headers: {
          'x-gmao-actor-id': 'TECH-01',
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
          'x-gmao-actor-id': 'TECH-01',
          'x-gmao-role': 'ADMIN',
        },
      });
      expect(techDeleteRes.status).toBe(403);
      expect(dbState.machines).toHaveLength(1);

      // Archived admin -> 403
      const archivedRes = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/machines',
        headers: {
          'x-gmao-actor-id': 'USR-ARCH-1',
          'x-gmao-role': 'ADMIN',
        },
        body: { id: 'M-2', code: 'DET-02' },
      });
      expect(archivedRes.status).toBe(403);

      // Verified active ADMIN -> 201 Created
      const adminRes = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/machines',
        headers: {
          'x-gmao-actor-id': 'USR-ADMIN-1',
          'x-gmao-actor': 'Admin Principal',
          'x-gmao-role': 'ADMIN',
        },
        body: { id: 'M-2', code: 'DET-02' },
      });
      expect(adminRes.status).toBe(201);
      expect(dbState.machines).toHaveLength(2);
    });

    it('protects /api/network/info, disables /api/docs in production, and blocks disallowed CORS origins', async () => {
      await startTestServer({
        isProduction: true,
        initialState: {
          users: SAMPLE_DB_USERS,
          technicians: SAMPLE_DB_TECHS,
        },
      });
      process.env.GMAO_API_TOKEN = 'Strong_Prod_LAN_Secret_2026!';

      // Unauthenticated GET /api/network/info -> 401
      const noHeaderNet = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/network/info',
      });
      expect(noHeaderNet.status).toBe(401);

      // Missing API token in production -> 401
      const noTokenNet = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/network/info',
        headers: {
          'x-gmao-client-origin': 'gmao-web-client',
          'x-gmao-actor-id': 'ghost-99',
          'x-gmao-role': 'ADMIN',
        },
      });
      expect(noTokenNet.status).toBe(401);

      // Even WITH valid API token, unknown ghost-99 actor on /api/network/info -> 403
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

      // Verified ADMIN with valid token -> 200 and no OS platform leak
      const validNet = await sendHttpRequest({
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
      expect(validNet.status).toBe(200);
      expect(validNet.json?.primaryIp).toBeDefined();
      expect(validNet.json?.platform).toBeUndefined();

      // Swagger disabled in production -> 404
      const docsProd = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/docs.json',
      });
      expect(docsProd.status).toBe(404);

      // CORS blocks external origin while allowing localhost
      const evilCors = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/health',
        headers: {
          Origin: 'https://evil.attacker.com',
        },
      });
      expect(evilCors.headers['access-control-allow-origin']).toBeUndefined();

      const localCors = await sendHttpRequest({
        port,
        method: 'GET',
        path: '/api/health',
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(localCors.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('closes Bootstrap automatically right after initial user registration', async () => {
      const { dbState } = await startTestServer({
        isProduction: false,
        initialState: {
          users: [],
          technicians: [],
        },
      });

      // Empty DB + loopback -> POST /api/gmao/users succeeds once
      const firstBoot = await sendHttpRequest({
        port,
        method: 'POST',
        path: '/api/gmao/users',
        headers: {
          'x-gmao-actor-id': 'init-setup',
          'x-gmao-role': 'ADMIN',
        },
        body: { id: 'USR-ADMIN-1', nom: 'Admin Principal', role: 'ADMIN', is_active: true },
      });
      expect(firstBoot.status).toBe(201);
      expect(dbState.users).toHaveLength(1);

      // Immediately after first user exists, ghost-99 is rejected with 403!
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
      expect(dbState.users).toHaveLength(1);
    });
  });
});
