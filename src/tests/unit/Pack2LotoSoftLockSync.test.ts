import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkOrderStateMachine } from '../../domain/corrective/services/WorkOrderStateMachine';
import {
  canStartWorkWithLoto,
  canCloseWorkOrderWithLoto,
  validateLotoConsignation,
  validateLotoDeconsignation,
} from '../../domain/corrective/lotoService';
import { StockCalculationService } from '../../domain/pdr/services/StockCalculationService';
import { computeReservedStockMap } from '../../core/security/validationReconciliation';
import { useGmaoStore } from '../../store/useGmaoStore';
import { syncQueueService } from '../../services/syncQueueService';
import {
  serverSyncService,
  PUSH_SERVER_STATE_OP,
  registerServerSyncQueueHandler,
} from '../../services/serverSyncService';
import { storageService } from '../../utils/storageService';

describe('Pack 2 — LOTO FSM, Stock Réservé Soft-Lock & Offline SyncQueue Replay', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    await syncQueueService.clearQueue();
    syncQueueService.isOnline = false;
    useGmaoStore.setState({
      correctiveInterventions: [],
      auditEvents: [],
      sortieDemands: [],
      preventiveExecutions: [],
      mouvements: [],
      rawStock: [],
    });
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await syncQueueService.clearQueue();
    syncQueueService.unregisterOperationHandler('CUSTOM_TEST_REPLAY');
    registerServerSyncQueueHandler();
  });

  // =========================================================================
  // 1. LOTO (Lockout / Tagout — Permis de Consignation) & WorkOrderStateMachine
  // =========================================================================
  describe('LOTO Safety Permit & WorkOrderStateMachine Enforcement', () => {
    it('blocks EN_COURS when requires_loto is true and status !== CONSIGNE', () => {
      const bt = {
        id: 'BT-LOTO-1',
        num_bt: 'BT-2026-001',
        code_machine: 'PRESS-01',
        statut: 'BT_PLANIFIE',
        requires_loto: true,
        loto_status: 'ATTENTE_CONSIGNATION',
      };

      const checkStart = canStartWorkWithLoto(bt);
      expect(checkStart.valid).toBe(false);
      expect(checkStart.status).toBe('ATTENTE_CONSIGNATION');

      const fsmBlocked = WorkOrderStateMachine.validateTransition(bt, 'EN_COURS');
      expect(fsmBlocked.valid).toBe(false);
      expect(fsmBlocked.reason).toContain('LOTO');
    });

    it('allows EN_COURS once CONSIGNE, but blocks CLOTURE until DECONSIGNE', () => {
      const consignCheck = validateLotoConsignation(undefined, {
        num_cadenas: 'CAD-7788',
        energy_types: ['ELECTRIQUE', 'HYDRAULIQUE'],
        vat_verified: true,
        consignateur_id: 'TECH-01',
        consignateur_name: 'Karim B.',
      });
      expect(consignCheck.valid).toBe(true);
      expect(consignCheck.permit?.status).toBe('CONSIGNE');

      const btConsigned = {
        id: 'BT-LOTO-2',
        num_bt: 'BT-2026-002',
        code_machine: 'PRESS-02',
        statut: 'EN_COURS',
        action_realisee: 'Remplacement distributeur hydraulique',
        requires_loto: true,
        loto_status: consignCheck.permit?.status,
        loto: consignCheck.permit,
      };

      // Can start work when CONSIGNE
      expect(WorkOrderStateMachine.validateTransition(btConsigned, 'EN_COURS').valid).toBe(true);

      // Cannot close while still CONSIGNE (padlock still mounted)
      const fsmCloseBlocked = WorkOrderStateMachine.validateTransition(btConsigned, 'CLOTURE');
      expect(fsmCloseBlocked.valid).toBe(false);
      expect(fsmCloseBlocked.reason).toContain('déconsign');
      expect(canCloseWorkOrderWithLoto(btConsigned).valid).toBe(false);

      // Deconsign requires cleared zone & CONSIGNE state
      const blockedZone = validateLotoDeconsignation(btConsigned.loto, { zone_cleared: false });
      expect(blockedZone.valid).toBe(false);

      const deconsignCheck = validateLotoDeconsignation(btConsigned.loto, {
        deconsignateur_id: 'SUP-01',
        deconsignateur_name: 'Nadia K.',
        zone_cleared: true,
      });
      expect(deconsignCheck.valid).toBe(true);
      expect(deconsignCheck.permit?.status).toBe('DECONSIGNE');

      // Cannot restart work after DECONSIGNE without re-locking
      const btDeconsigned = {
        ...btConsigned,
        loto_status: deconsignCheck.permit?.status,
        loto: deconsignCheck.permit,
      };
      expect(canStartWorkWithLoto(btDeconsigned).valid).toBe(false);
      expect(WorkOrderStateMachine.validateTransition(btDeconsigned, 'CLOTURE').valid).toBe(true);
    });

    it('leaves non-LOTO Work Orders completely unaffected', () => {
      const normalBt = {
        id: 'BT-STD-1',
        num_bt: 'BT-2026-099',
        code_machine: 'CONV-04',
        statut: 'BT_PLANIFIE',
        action_realisee: 'Réglage capteur',
      };
      expect(WorkOrderStateMachine.validateTransition(normalBt, 'EN_COURS').valid).toBe(true);
      expect(WorkOrderStateMachine.validateTransition(normalBt, 'CLOTURE').valid).toBe(true);
    });

    it('enforces store LOTO lifecycle, RBAC guard, live start block, and audit logging', () => {
      storageService.setItem('gmao_active_user', {
        id: 'TECH-09',
        nom: 'Yassine T.',
        role: 'TECHNICIAN',
      });

      useGmaoStore.setState({
        correctiveInterventions: [
          {
            id: 'BT-STORE-LOTO',
            num_bt: 'BT-LOTO-500',
            code_machine: 'COMP-01',
            statut: 'BT_PLANIFIE',
            requires_loto: true,
            loto_status: 'ATTENTE_CONSIGNATION',
          } as any,
        ],
      });

      // Live intervention start must be blocked before consignation
      useGmaoStore.getState().handleStartLiveIntervention('BT-STORE-LOTO');
      expect(useGmaoStore.getState().correctiveInterventions[0].statut).toBe('BT_PLANIFIE');

      // VIEWER role must be refused
      const viewerDenied = useGmaoStore.getState().handleConsignInterventionLoto('BT-STORE-LOTO', {
        num_cadenas: 'CAD-01',
        energy_types: ['ELECTRIQUE'],
        vat_verified: true,
        actorRole: 'VIEWER',
      });
      expect(viewerDenied.valid).toBe(false);

      // Missing VAT test must be refused
      const vatDenied = useGmaoStore.getState().handleConsignInterventionLoto('BT-STORE-LOTO', {
        num_cadenas: 'CAD-01',
        energy_types: ['ELECTRIQUE'],
        vat_verified: false,
      });
      expect(vatDenied.valid).toBe(false);

      // Valid consignation
      const consigned = useGmaoStore.getState().handleConsignInterventionLoto('BT-STORE-LOTO', {
        num_cadenas: 'CAD-9012',
        energy_types: ['ELECTRIQUE', 'PNEUMATIQUE'],
        vat_verified: true,
      });
      expect(consigned.valid).toBe(true);
      expect(useGmaoStore.getState().correctiveInterventions[0].loto_status).toBe('CONSIGNE');

      // Live intervention now allowed to move to EN_COURS
      useGmaoStore.getState().handleStartLiveIntervention('BT-STORE-LOTO');
      expect(useGmaoStore.getState().correctiveInterventions[0].statut).toBe('EN_COURS');

      // Valid deconsignation
      const deconsigned = useGmaoStore.getState().handleDeconsignInterventionLoto('BT-STORE-LOTO', {
        zone_cleared: true,
      });
      expect(deconsigned.valid).toBe(true);
      expect(useGmaoStore.getState().correctiveInterventions[0].loto_status).toBe('DECONSIGNE');

      const auditActions = useGmaoStore.getState().auditEvents.map((e) => e.actionType);
      expect(auditActions).toContain('LOTO_CONSIGNED');
      expect(auditActions).toContain('LOTO_DECONSIGNED');
    });
  });

  // =========================================================================
  // 2. Stock Réservé Soft-Lock Enforcement
  // =========================================================================
  describe('Stock Réservé Soft-Lock (checkNetAvailability & computeReservedStockMap)', () => {
    it('subtracts Maker-Checker pending reservations from physical stock and prevents overselling', () => {
      const article = {
        ref: 'RLT-6205-2RS',
        designation: 'Roulement 6205 2RS SKF',
        stockInitial: 10,
        seuil: 2,
      };
      const movements = [{ id: 'MVT-1', ref: 'RLT-6205-2RS', type: 'SORTIE', quantite: 2 }]; // Physical = 8

      const reservedMap = computeReservedStockMap({
        correctiveInterventions: [
          {
            id: 'BT-10',
            validation_status: 'PENDING_VALIDATION',
            pieces_proposees: [{ ref: 'RLT-6205-2RS', quantite: 3 }],
          },
        ],
        sortieDemands: [
          {
            id: 'DEM-22',
            validation_status: 'PENDING_VALIDATION',
            items: [{ ref: 'RLT-6205-2RS', quantite: 2 }],
          },
        ],
      });

      const totalReserved = reservedMap.get('RLT-6205-2RS')?.reservedQty || 0;
      expect(totalReserved).toBe(5); // 3 (BT) + 2 (SortieDemand)

      // Net available = 8 - 5 = 3; requesting 4 should be rejected with shortage 1
      const denied = StockCalculationService.checkNetAvailability(
        'RLT-6205-2RS',
        4,
        article,
        movements,
        totalReserved
      );
      expect(denied.available).toBe(false);
      expect(denied.currentStock).toBe(8);
      expect(denied.reservedQty).toBe(5);
      expect(denied.netAvailable).toBe(3);
      expect(denied.shortage).toBe(1);

      // Editing DEM-22 itself (excludeClaimReservedQty = 2): effectiveReserved = 3, netAvailable = 5
      const editAllowed = StockCalculationService.checkNetAvailability(
        'RLT-6205-2RS',
        4,
        article,
        movements,
        totalReserved,
        2
      );
      expect(editAllowed.available).toBe(true);
      expect(editAllowed.reservedQty).toBe(3);
      expect(editAllowed.netAvailable).toBe(5);
    });
  });

  // =========================================================================
  // 3. Offline SyncQueue Persistent Handler Replay & serverSyncService Wiring
  // =========================================================================
  describe('Offline SyncQueue Persistent Replay & ServerSync Integration', () => {
    it('replays serializable registered handlers even after inMemoryOperations cleared (simulated reload)', async () => {
      const replayedPayloads: any[] = [];
      syncQueueService.registerOperationHandler('CUSTOM_TEST_REPLAY', async (op) => {
        replayedPayloads.push(op.payload);
      });

      syncQueueService.isOnline = false;
      await syncQueueService.add(
        { type: 'CUSTOM_TEST_REPLAY', payload: { btId: 'BT-777', action: 'SYNC' } },
        'high',
        { source: 'unit-test' }
      );

      // Simulate page reload clearing closure map
      syncQueueService.inMemoryOperations.clear();
      syncQueueService.isOnline = true;
      await syncQueueService.processQueue();

      expect(replayedPayloads).toHaveLength(1);
      expect(replayedPayloads[0]).toEqual({ btId: 'BT-777', action: 'SYNC' });
      expect(syncQueueService.getState().queueLength).toBe(0);
    });

    it('fails explicitly (instead of silent deletion) when an orphaned FUNCTION_CALL has no handler after reload', async () => {
      syncQueueService.isOnline = false;
      await syncQueueService.add(async () => 'ephemeral closure', 'normal');
      expect(syncQueueService.getState().queueLength).toBe(1);

      // Simulate reload wiping closures
      syncQueueService.inMemoryOperations.clear();
      syncQueueService.isOnline = true;

      await syncQueueService.processQueue();
      expect(syncQueueService.getState().items[0]?.retries).toBe(1);
      expect(syncQueueService.getState().items[0]?.error).toContain('non rejouable');
      expect(syncQueueService.getState().queueLength).toBe(1);
    });

    it('coalesces duplicate PUSH_SERVER_STATE entries and replays queued offline push when back online', async () => {
      storageService.setItem('gmao_active_user', { nom: 'Admin Test', role: 'ADMIN' });

      // First push fails (network offline) -> enqueues single PUSH_SERVER_STATE operation
      const offlineFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
      global.fetch = offlineFetch as any;

      const failedRes = await serverSyncService.pushToServer({ force: false });
      expect(failedRes.success).toBe(false);
      expect(failedRes.queued).toBe(true);
      expect(syncQueueService.getState().pendingCount).toBe(1);

      // Second failed push should coalesce instead of duplicating
      const failedRes2 = await serverSyncService.pushToServer({ force: false });
      expect(failedRes2.queued).toBe(true);
      expect(syncQueueService.getState().pendingCount).toBe(1);
      expect(syncQueueService.getState().items[0]?.operation?.type).toBe(PUSH_SERVER_STATE_OP);

      // Network recovers -> processQueue invokes registered PUSH_SERVER_STATE handler
      const onlineFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          merged: true,
          version: 12,
          updatedAt: '2026-11-13T12:00:00.000Z',
        }),
      });
      global.fetch = onlineFetch as any;

      syncQueueService.isOnline = true;
      await syncQueueService.processQueue();

      expect(onlineFetch).toHaveBeenCalledTimes(1);
      expect(syncQueueService.getState().queueLength).toBe(0);
      expect(serverSyncService.getLastServerVersion()).toBe(12);
    });
  });
});
