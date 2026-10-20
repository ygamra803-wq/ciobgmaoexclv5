import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { networkConfigService } from '../../services/networkConfigService';
import { serverSyncService } from '../../services/serverSyncService';

describe('Round 7 — LAN Host Architecture (P3.1..P3.4) & SettingsView Modular Refactoring (M-05)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    networkConfigService.setNodeMode('HOST');
    networkConfigService.setCustomHostIp('');
    vi.restoreAllMocks();
  });

  describe('M-05: SettingsView.tsx Modular Decomposition & Dead Code Cleanup', () => {
    it('reduces SettingsView.tsx from 4041 lines to a modular orchestrator using extracted tab components', () => {
      const settingsPath = path.resolve(process.cwd(), 'src/presentation/pages/settings/SettingsView.tsx');
      const content = fs.readFileSync(settingsPath, 'utf-8');
      const lineCount = content.split('\n').length;

      expect(lineCount).toBeLessThan(1750);
      expect(content).toContain("import SettingsNavTabs from './components/SettingsNavTabs'");
      expect(content).toContain("import SettingsOverviewTab from './components/SettingsOverviewTab'");
      expect(content).toContain("import SettingsMvtLogicTab from './components/SettingsMvtLogicTab'");
      expect(content).toContain("import SettingsInjectionTab from './components/SettingsInjectionTab'");
      expect(content).toContain("import SettingsMatchingTab from './components/SettingsMatchingTab'");
      expect(content).toContain("import SettingsDirectoryTab from './components/SettingsDirectoryTab'");
      expect(content).toContain("import SettingsJsonEditorTab from './components/SettingsJsonEditorTab'");
      expect(content).toContain("import SettingsBackupAuditTab from './components/SettingsBackupAuditTab'");
      expect(content).toContain("import SettingsAdminTab from './components/SettingsAdminTab'");
      expect(content).toContain("from './components/AuditModals'");
    });
  });

  describe('P3.1: Explicit Host Node vs LAN Client Mode & Dynamic API Routing', () => {
    it('defaults to HOST mode and resolves API paths relatively', () => {
      expect(networkConfigService.getNodeMode()).toBe('HOST');
      expect(networkConfigService.resolveApiUrl('/api/gmao/state')).toBe('/api/gmao/state');
    });

    it('switches to LAN_CLIENT mode, normalizes remote host URL, and routes serverSyncService calls to remote host', async () => {
      networkConfigService.setNodeMode('LAN_CLIENT');
      const normalized = networkConfigService.setRemoteHostUrl('192.168.1.50:3000/');
      expect(normalized).toBe('http://192.168.1.50:3000');
      expect(networkConfigService.getNodeMode()).toBe('LAN_CLIENT');
      expect(networkConfigService.resolveApiUrl('/api/gmao/state')).toBe(
        'http://192.168.1.50:3000/api/gmao/state'
      );

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          version: 7,
          data: {
            version: 7,
            updatedAt: '2026-10-20T10:00:00.000Z',
            machines: [{ id: 'M1', code: 'DET-01' }],
            rawStock: [],
          },
        }),
      } as Response);

      const res = await serverSyncService.fetchServerState();
      expect(res.online).toBe(true);
      expect(res.summary.version).toBe(7);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://192.168.1.50:3000/api/gmao/state',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('P3.2: LAN Discovery & Offline Deterministic QR Code Matrix Generation', () => {
    it('generates a deterministic 21x21 QR matrix with intact 7x7 finder patterns', () => {
      const url = 'http://192.168.1.100:3000/#mobile';
      const matrixA = networkConfigService.generateDeterministicQrMatrix(url);
      const matrixB = networkConfigService.generateDeterministicQrMatrix(url);

      expect(matrixA.length).toBe(21);
      expect(matrixA[0].length).toBe(21);
      expect(matrixA).toEqual(matrixB);

      // Top-left finder pattern outer corners and center (3,3) should be dark (true)
      expect(matrixA[0][0]).toBe(true);
      expect(matrixA[0][6]).toBe(true);
      expect(matrixA[6][0]).toBe(true);
      expect(matrixA[6][6]).toBe(true);
      expect(matrixA[3][3]).toBe(true);
      // Inner white ring at (1,1) should be false
      expect(matrixA[1][1]).toBe(false);
    });

    it('fetches LAN network host info from /api/network/info', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          hostname: 'FACTORY-HOST-01',
          port: 3000,
          primaryIp: '192.168.1.25',
          interfaces: [
            { name: 'Wi-Fi', address: '192.168.1.25', netmask: '255.255.255.0', family: 'IPv4' },
          ],
          version: 12,
          updatedAt: '2026-10-20T12:00:00.000Z',
        }),
      } as Response);

      const info = await networkConfigService.fetchHostNetworkInfo();
      expect(info).not.toBeNull();
      expect(info.primaryIp).toBe('192.168.1.25');
      expect(info.urls.mobile).toBe('http://192.168.1.25:3000/#mobile');
      expect(info.version).toBe(12);
    });
  });

  describe('P3.3 & P3.4: Server Revision Check & SSE Realtime Broadcast Endpoint', () => {
    it('checks lightweight server revision via /api/gmao/revision', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          version: 19,
          revision: 19,
          updatedAt: '2026-10-20T14:30:00.000Z',
        }),
      } as Response);

      const rev = await networkConfigService.checkServerRevision();
      expect(rev.online).toBe(true);
      expect(rev.version).toBe(19);
      expect(rev.updatedAt).toBe('2026-10-20T14:30:00.000Z');
    });

    it('verifies server.ts exposes /api/network/info, /api/gmao/revision, and /api/gmao/events with SSE broadcast', () => {
      const serverPath = path.resolve(process.cwd(), 'server.ts');
      const serverCode = fs.readFileSync(serverPath, 'utf-8');

      expect(serverCode).toContain("app.get('/api/network/info'");
      expect(serverCode).toContain("app.get('/api/gmao/revision'");
      expect(serverCode).toContain("app.get('/api/gmao/events'");
      expect(serverCode).toContain('broadcastSseEvent');
      expect(serverCode).toContain('os.networkInterfaces()');
    });
  });
});
