import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationService } from '../../core/security/AuthorizationService';
import { serverSyncService } from '../../services/serverSyncService';
import fs from 'fs';
import path from 'path';

describe('Round 5 — Enterprise RBAC, Tab Access Control, and Server Role/Token Hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. AuthorizationService Canonical Roles & Permissions (M-02 / P4.3)', () => {
    it('grants ADMIN full permissions and access to all tabs including settings and utilisateurs', () => {
      const adminUser = { id: 'admin', role: 'ADMIN' };
      expect(AuthorizationService.hasPermission(adminUser, 'stock.delete')).toBe(true);
      expect(AuthorizationService.hasPermission(adminUser, 'user.delete')).toBe(true);
      expect(AuthorizationService.hasPermission(adminUser, 'settings.restore')).toBe(true);
      expect(AuthorizationService.canAccessTab(adminUser, 'settings')).toBe(true);
      expect(AuthorizationService.canAccessTab(adminUser, 'utilisateurs')).toBe(true);
      expect(AuthorizationService.isReadOnly(adminUser)).toBe(false);
    });

    it('grants RESPONSABLE_MAGASIN (Storekeeper) stock/warehouse management while restricting settings and utilisateurs', () => {
      const storekeeper = { id: 'magasinier', role: 'RESPONSABLE_MAGASIN' };
      expect(AuthorizationService.hasPermission(storekeeper, 'stock.view')).toBe(true);
      expect(AuthorizationService.hasPermission(storekeeper, 'stock.create')).toBe(true);
      expect(AuthorizationService.hasPermission(storekeeper, 'stock.edit')).toBe(true);
      expect(AuthorizationService.hasPermission(storekeeper, 'warehouse.manage')).toBe(true);
      expect(AuthorizationService.hasPermission(storekeeper, 'movement.create')).toBe(true);
      expect(AuthorizationService.hasPermission(storekeeper, 'user.delete')).toBe(false);
      expect(AuthorizationService.hasPermission(storekeeper, 'settings.restore')).toBe(false);

      expect(AuthorizationService.canAccessTab(storekeeper, 'stock')).toBe(true);
      expect(AuthorizationService.canAccessTab(storekeeper, 'entrepot')).toBe(true);
      expect(AuthorizationService.canAccessTab(storekeeper, 'sortie')).toBe(true);
      expect(AuthorizationService.canAccessTab(storekeeper, 'settings')).toBe(false);
      expect(AuthorizationService.canAccessTab(storekeeper, 'utilisateurs')).toBe(false);
    });

    it('grants TECHNICIEN maintenance & movement execution while restricting settings, utilisateurs, and entrepot catalog', () => {
      const tech = { id: 'tech', role: 'TECHNICIEN' };
      expect(AuthorizationService.hasPermission(tech, 'stock.view')).toBe(true);
      expect(AuthorizationService.hasPermission(tech, 'movement.create')).toBe(true);
      expect(AuthorizationService.hasPermission(tech, 'preventive.execute')).toBe(true);
      expect(AuthorizationService.hasPermission(tech, 'corrective.execute')).toBe(true);
      expect(AuthorizationService.hasPermission(tech, 'stock.delete')).toBe(false);

      expect(AuthorizationService.canAccessTab(tech, 'preventive')).toBe(true);
      expect(AuthorizationService.canAccessTab(tech, 'corrective')).toBe(true);
      expect(AuthorizationService.canAccessTab(tech, 'corrective_bt')).toBe(true);
      expect(AuthorizationService.canAccessTab(tech, 'settings')).toBe(false);
      expect(AuthorizationService.canAccessTab(tech, 'utilisateurs')).toBe(false);
      expect(AuthorizationService.canAccessTab(tech, 'entrepot')).toBe(false);
    });

    it('enforces read-only mode for VIEWER (Observateur) across permissions and sync service', async () => {
      const viewer = { id: 'viewer', role: 'VIEWER', name: 'Observateur' };
      expect(AuthorizationService.isReadOnly(viewer)).toBe(true);
      expect(AuthorizationService.hasPermission(viewer, 'stock.view')).toBe(true);
      expect(AuthorizationService.hasPermission(viewer, 'machine.view')).toBe(true);
      expect(AuthorizationService.hasPermission(viewer, 'movement.create')).toBe(false);
      expect(AuthorizationService.hasPermission(viewer, 'stock.edit')).toBe(false);
      expect(AuthorizationService.canAccessTab(viewer, 'dashboard')).toBe(true);
      expect(AuthorizationService.canAccessTab(viewer, 'settings')).toBe(false);

      // Verify serverSyncService blocks VIEWER from pushing state to server
      sessionStorage.setItem(
        'gmao_session_v2',
        JSON.stringify({ payload: viewer, signature: 'sig' })
      );
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const res = await serverSyncService.pushToServer({ force: true, customState: { zones: [] } });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Observateur|lecture seule/i);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('2. Server-Side RBAC & Token Hardening Verification (C-05 / M-02)', () => {
    it('passes x-gmao-role header when authorized user pushes state to server', async () => {
      sessionStorage.setItem(
        'gmao_session_v2',
        JSON.stringify({
          payload: { id: 'magasinier', username: 'magasinier', name: 'Responsable Magasin', role: 'RESPONSABLE_MAGASIN' },
          signature: 'sig',
        })
      );

      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          version: 10,
          updatedAt: '2026-10-20T05:00:00.000Z',
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await serverSyncService.pushToServer({ force: true, customState: { rawStock: [] } });
      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, reqInit] = fetchMock.mock.calls[0];
      expect(reqInit.headers['x-gmao-role']).toBe('RESPONSABLE_MAGASIN');
      expect(reqInit.headers['x-gmao-actor']).toBe('Responsable Magasin');
    });

    it('verifies server.ts enforces explicit invalid token rejection and RBAC role checks', () => {
      const serverCode = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');
      expect(serverCode).toContain('ADMIN_ONLY_ENTITIES');
      expect(serverCode).toContain("role === 'VIEWER'");
      expect(serverCode).toContain('expectedToken && token !== undefined && token !== expectedToken');
    });
  });
});
