import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serverSyncService } from '../../services/serverSyncService';
import { storageService } from '../../utils/storageService';

describe('Round 4 — Server-Authoritative Persistence, Version Concurrency & Audit Trail (C-01, H-04)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('C-01a: should detect SERVER_NEWER conflict when server version is greater than lastKnownVersion', () => {
    serverSyncService.setLastSyncAt('2026-10-20T01:00:00.000Z');
    serverSyncService.setLastServerVersion(3);

    const localData = {
      machines: [{ id: 'M1', name: 'Press 1' }],
      rawStock: [{ id: 'S1', ref: 'REF-01', stockInitial: 10 }],
    };

    const serverData = {
      version: 4,
      updatedAt: '2026-10-20T01:00:00.000Z',
      machines: [{ id: 'M1', name: 'Press 1' }],
      rawStock: [{ id: 'S1', ref: 'REF-01', stockInitial: 10 }],
    };

    const result = serverSyncService.detectConflict(localData, serverData, 'push');
    expect(result.hasConflict).toBe(true);
    expect(result.reason).toBe('SERVER_NEWER');
    expect(result.serverSummary.version).toBe(4);
  });

  it('C-01b: should handle HTTP 409 Conflict from POST /api/gmao/state without overwriting', async () => {
    serverSyncService.setLastServerVersion(2);

    const mockFetch = vi.fn()
      // 1st call: GET /api/gmao/state pre-check
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          version: 2,
          data: { version: 2, machines: [], rawStock: [] },
        }),
      })
      // 2nd call: POST /api/gmao/state returns 409 because another operator saved version 3 in the meantime
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: 'Conflict',
          version: 3,
          data: {
            version: 3,
            updatedAt: '2026-10-20T02:15:00.000Z',
            machines: [{ id: 'M-NEW', name: 'CNC Router' }],
            rawStock: [],
          },
        }),
      });

    global.fetch = mockFetch as any;

    const res = await serverSyncService.pushToServer({
      force: false,
      customState: {
        machines: [{ id: 'M-LOCAL', name: 'Local Lathe' }],
        rawStock: [],
      },
    });

    expect(res.success).toBe(false);
    expect(res.conflict).toBeDefined();
    expect(res.conflict?.hasConflict).toBe(true);
    expect(res.conflict?.reason).toBe('SERVER_NEWER');
    expect(res.conflict?.serverSummary.version).toBe(3);
  });

  it('C-01c & H-04: should persist updated version on successful pushToServer and fetch server audit logs', async () => {
    storageService.setItem('gmao_active_user', { nom: 'Ing. Karim', role: 'admin' });

    const mockFetch = vi.fn()
      // 1st call: GET /api/gmao/state
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          version: 5,
          data: { version: 5, machines: [], rawStock: [] },
        }),
      })
      // 2nd call: POST /api/gmao/state
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          version: 6,
          updatedAt: '2026-10-20T02:20:00.000Z',
          acceptedKeys: ['machines', 'rawStock'],
        }),
      })
      // 3rd call: GET /api/gmao/audit
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'aud_1',
              timestamp: '2026-10-20T02:20:00.000Z',
              version: 6,
              actor: 'Ing. Karim',
              action: 'SYNC_STATE',
              entity: 'state',
              summary: 'Updated 2 collections',
            },
          ],
        }),
      });

    global.fetch = mockFetch as any;

    const pushRes = await serverSyncService.pushToServer({
      force: false,
      customState: {
        machines: [{ id: 'M1', name: 'Compressor' }],
        rawStock: [],
      },
    });

    expect(pushRes.success).toBe(true);
    expect(pushRes.version).toBe(6);
    expect(serverSyncService.getLastServerVersion()).toBe(6);

    // Verify x-gmao-actor header and expectedVersion were sent in POST request
    const postCall = mockFetch.mock.calls[1];
    expect(postCall[0]).toBe('/api/gmao/state');
    expect(postCall[1].headers['x-gmao-actor']).toBe('Ing. Karim');
    const sentBody = JSON.parse(postCall[1].body);
    expect(sentBody.expectedVersion).toBe(5);

    const auditLogs = await serverSyncService.fetchAuditLogs(20);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].actor).toBe('Ing. Karim');
    expect(auditLogs[0].version).toBe(6);
  });

  it('Vulnerability 1 Fix: mergeGmaoStateSnapshot preserves concurrent Mobile & Desktop records without Lost Updates', async () => {
    const { mergeGmaoStateSnapshot } = await import('../../services/lanStateMergeService');

    // Server already received BT-205 and SortieDemand SRT-10 from Technician A's Mobile phone
    const serverState: Record<string, any> = {
      correctiveInterventions: [
        {
          id: 'BT-100',
          code_bon: 'BT-100',
          statut: 'EN_COURS',
          validation_status: 'PENDING_VALIDATION',
          updated_at: '2026-10-29T10:00:00.000Z',
        },
        {
          id: 'BT-205',
          code_bon: 'BT-205',
          code_machine: 'COMP-01',
          statut: 'EN_COURS',
          validation_status: 'PENDING_VALIDATION',
          submitted_at: '2026-10-29T10:05:00.000Z',
        },
      ],
      sortieDemands: [
        {
          id: 'SRT-10',
          ref: 'PDR-01',
          quantite: 2,
          validation_status: 'PENDING',
          created_at: '2026-10-29T10:05:30.000Z',
        },
      ],
    };

    // Supervisor B on Desktop (whose snapshot was taken at 10:00:00 before BT-205 & SRT-10 existed)
    // approves BT-100 at 10:06:00 and syncs
    const incomingDesktopState: Record<string, any> = {
      correctiveInterventions: [
        {
          id: 'BT-100',
          code_bon: 'BT-100',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          validated_at: '2026-10-29T10:06:00.000Z',
          updated_at: '2026-10-29T10:06:00.000Z',
        },
      ],
      sortieDemands: [],
    };

    mergeGmaoStateSnapshot(
      serverState,
      incomingDesktopState,
      ['correctiveInterventions', 'sortieDemands'],
      new Set(),
      { preserveServerOnlyItems: true }
    );

    // Both BT-100 (now APPROVED/CLOTURE) AND Technician A's BT-205 must exist!
    expect(serverState.correctiveInterventions).toHaveLength(2);
    const bt100 = serverState.correctiveInterventions.find((x: any) => x.id === 'BT-100');
    const bt205 = serverState.correctiveInterventions.find((x: any) => x.id === 'BT-205');
    expect(bt100?.validation_status).toBe('APPROVED');
    expect(bt100?.statut).toBe('CLOTURE');
    expect(bt205?.code_machine).toBe('COMP-01');

    // Technician A's SortieDemand SRT-10 must also be preserved!
    expect(serverState.sortieDemands).toHaveLength(1);
    expect(serverState.sortieDemands[0].id).toBe('SRT-10');
  });

  it('Vulnerability 1 Fix: mergeSingleRecord prevents stale snapshot from regressing an approved/closed record', async () => {
    const { mergeSingleRecord } = await import('../../services/lanStateMergeService');

    const serverApprovedBt = {
      id: 'BT-300',
      statut: 'CLOTURE',
      validation_status: 'APPROVED',
      stock_deducted: true,
      validated_at: '2026-10-29T12:00:00.000Z',
    };

    const staleClientBt = {
      id: 'BT-300',
      statut: 'EN_COURS',
      validation_status: 'PENDING_VALIDATION',
      submitted_at: '2026-10-29T11:30:00.000Z',
    };

    const merged = mergeSingleRecord(serverApprovedBt, staleClientBt);
    expect(merged.validation_status).toBe('APPROVED');
    expect(merged.statut).toBe('CLOTURE');
    expect(merged.stock_deducted).toBe(true);
  });
});
