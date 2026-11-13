import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { serverSyncService } from '../../../services/serverSyncService';
import { networkConfigService } from '../../../services/networkConfigService';
import { SERVER_SESSION_STORAGE_KEY, signServerSession } from '../serverSession';
import { ensureFreshServerSession, refreshServerSession } from '../serverSessionClient';

describe('SEC-LAN-P1 + SEC-LAN-P2 — Client Server Session Token Lifecycle & Silent Refresh', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('stores server-issued HMAC token in sessionStorage and attaches Authorization Bearer + X-GMAO-SESSION on sync and network calls', async () => {
    sessionStorage.setItem(
      'gmao_session_v2',
      JSON.stringify({
        payload: { id: 'admin', code: 'admin', username: 'admin', name: 'Administrateur', role: 'ADMIN' },
        signature: 'sig',
      })
    );

    const mockFetch = vi
      .fn()
      // 1. POST /api/gmao/auth/login
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          token: 'GMAO1.eyJzdWIiOiJhZG1pbiJ9.abcdef',
          expiresAt: '2026-11-13T05:00:00.000Z',
          actor: { sub: 'admin', role: 'ADMIN', name: 'Administrateur' },
        }),
      })
      // 2. GET /api/network/info
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          primaryIp: '192.168.1.15',
          port: 3000,
          interfaces: [],
          version: 2,
        }),
      })
      // 3. POST /api/gmao/state
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          version: 3,
          updatedAt: '2026-11-12T18:00:00.000Z',
        }),
      });

    global.fetch = mockFetch as any;

    const authRes = await serverSyncService.authenticateServerSession('admin', 'Str0ngPass!2026');
    expect(authRes.success).toBe(true);
    expect(sessionStorage.getItem(SERVER_SESSION_STORAGE_KEY)).toBe('GMAO1.eyJzdWIiOiJhZG1pbiJ9.abcdef');

    await networkConfigService.fetchNetworkHostInfo();
    const netHeaders = mockFetch.mock.calls[1][1].headers;
    expect(netHeaders.Authorization).toBe('Bearer GMAO1.eyJzdWIiOiJhZG1pbiJ9.abcdef');
    expect(netHeaders['X-GMAO-SESSION']).toBe('GMAO1.eyJzdWIiOiJhZG1pbiJ9.abcdef');

    const pushRes = await serverSyncService.pushToServer({
      force: true,
      customState: { machines: [] },
    });
    expect(pushRes.success).toBe(true);
    const pushHeaders = mockFetch.mock.calls[2][1].headers;
    expect(pushHeaders.Authorization).toBe('Bearer GMAO1.eyJzdWIiOiJhZG1pbiJ9.abcdef');
    expect(pushHeaders['X-GMAO-SESSION']).toBe('GMAO1.eyJzdWIiOiJhZG1pbiJ9.abcdef');
    expect(pushHeaders['x-gmao-actor-id']).toBe('admin');
  });

  it('does NOT fall back to header-only ADMIN when server login returns 401/403 and clears invalid token on 403 SERVER_SESSION_INVALID', async () => {
    sessionStorage.setItem(
      'gmao_session_v2',
      JSON.stringify({
        payload: { id: 'admin', code: 'admin', username: 'admin', name: 'Administrateur', role: 'ADMIN' },
        signature: 'sig',
      })
    );
    serverSyncService.setServerSessionToken('GMAO1.stale.token');

    const rejectedSpy = vi.fn();
    const expiredSpy = vi.fn();
    window.addEventListener('gmao:server_session_rejected', rejectedSpy);
    window.addEventListener('gmao:server_session_expired', expiredSpy);

    const mockFetch = vi
      .fn()
      // 1. Login rejected (401)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Identifiant ou mot de passe incorrect.',
        }),
      })
      // 2. Push with forged/stale session rejected (403 SERVER_SESSION_INVALID)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          code: 'SERVER_SESSION_INVALID',
          message: 'Server session token is invalid, expired, or revoked.',
        }),
      });

    global.fetch = mockFetch as any;

    const failedAuth = await serverSyncService.authenticateServerSession('admin', 'wrongpass');
    expect(failedAuth.success).toBe(false);
    expect(failedAuth.offline).toBe(false);
    expect(failedAuth.status).toBe(401);
    expect(serverSyncService.getServerSessionToken()).toBe('');
    expect(rejectedSpy).toHaveBeenCalledTimes(1);

    serverSyncService.setServerSessionToken('GMAO1.expired.token');
    const pushRes = await serverSyncService.pushToServer({
      force: true,
      customState: { machines: [] },
    });
    expect(pushRes.success).toBe(false);
    expect(serverSyncService.getServerSessionToken()).toBe('');
    expect(expiredSpy).toHaveBeenCalledTimes(1);
    // Must not retry without session token
    expect(mockFetch).toHaveBeenCalledTimes(2);

    window.removeEventListener('gmao:server_session_rejected', rejectedSpy);
    window.removeEventListener('gmao:server_session_expired', expiredSpy);
  });

  it('silently refreshes token within expiry margin and clears session without header fallback if /auth/refresh rejects (403)', async () => {
    const secret = 'test-client-refresh-secret-0123456789abcdef';
    const nowSec = Math.floor(Date.now() / 1000);
    // Token expiring in 10 minutes (within 25 min refresh threshold)
    const expiringSoon = signServerSession(
      { sub: 'admin', role: 'ADMIN', name: 'Admin', ttlSeconds: 600 },
      secret,
      nowSec
    );
    const rotated = signServerSession(
      { sub: 'admin', role: 'ADMIN', name: 'Admin', ttlSeconds: 36000 },
      secret,
      nowSec + 5
    );

    serverSyncService.setServerSessionToken(expiringSoon.token);

    const expiredSpy = vi.fn();
    window.addEventListener('gmao:server_session_expired', expiredSpy);

    const mockFetch = vi
      .fn()
      // 1. Successful silent refresh
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          token: rotated.token,
          expiresAt: new Date(rotated.payload.exp * 1000).toISOString(),
          actor: { sub: 'admin', role: 'ADMIN', name: 'Admin' },
        }),
      })
      // 2. Subsequent failed refresh (revoked/role changed -> 403)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          code: 'SERVER_SESSION_ROLE_CHANGED',
          message: 'User registry role changed.',
        }),
      });
    global.fetch = mockFetch as any;

    const refreshOk = await ensureFreshServerSession(25 * 60, nowSec);
    expect(refreshOk?.success).toBe(true);
    expect(serverSyncService.getServerSessionToken()).toBe(rotated.token);

    // Since rotated token has 10h remaining, ensureFreshServerSession does NOT call fetch unnecessarily
    const noOpCheck = await ensureFreshServerSession(25 * 60, nowSec);
    expect(noOpCheck?.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Explicit refresh rejection -> clears token and emits gmao:server_session_expired
    const refreshFail = await refreshServerSession();
    expect(refreshFail.success).toBe(false);
    expect(refreshFail.status).toBe(403);
    expect(serverSyncService.getServerSessionToken()).toBe('');
    expect(expiredSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener('gmao:server_session_expired', expiredSpy);
  });

  it('revokes token on server via /api/gmao/auth/logout and clears sessionStorage', async () => {
    serverSyncService.setServerSessionToken('GMAO1.active.token');
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch as any;

    await serverSyncService.revokeServerSession();
    expect(serverSyncService.getServerSessionToken()).toBe('');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/gmao/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer GMAO1.active.token',
        }),
      })
    );
  });
});
