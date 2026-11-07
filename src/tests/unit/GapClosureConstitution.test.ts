import { describe, it, expect, beforeEach } from 'vitest';
import { useGmaoStore } from '../../store/useGmaoStore';
import { DataGateway } from '../../application/DataGateway';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { canRoleMutateEntity } from '../../core/security/serverRbacPolicy';
import { AuthorizationService } from '../../core/security/AuthorizationService';
import { filterActiveMachines } from '../../utils/activeMachines';
import {
  wouldCreateHierarchyCycle,
  sanitizeMachinesHierarchy,
  resolveMachineHierarchyContext,
  evaluateParentArchivePolicy,
  computeParentCorrectiveRollup,
} from '../../utils/assetHierarchy';
import { stockIndexStore } from '../../application/StockIndexStore';

describe('Gap Closure Constitution (Batches A, B, C, D, E)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    DataGateway.clearAllForRealFactory();
    useGmaoStore.setState({
      machines: [],
      rawStock: [],
      mouvements: [],
      preventiveTasks: [],
      meterReadings: [],
      replenishmentOrders: [],
      auditEvents: [],
    });
  });

  // =========================================================================
  // BATCH A: AUDIT-LEDGER-P0 (Append-Only Institutional Audit Trail)
  // =========================================================================
  describe('Batch A — AUDIT-LEDGER-P0 (Append-Only Audit Events)', () => {
    it('records before/after audit events when archiving and restoring a machine', () => {
      const store = useGmaoStore.getState();
      store.setMachines([
        {
          id_machine_registered: 'MCH-AUD-01',
          designation: 'Compresseur Audit',
          id_family: 'FAM-01',
          id_templates: 'TPL-01',
          id_zone_default: 'Z-01',
          status: 'En Service',
          is_active: true,
        },
      ]);

      // Archive the machine
      useGmaoStore.getState().setMachines([
        {
          id_machine_registered: 'MCH-AUD-01',
          designation: 'Compresseur Audit',
          id_family: 'FAM-01',
          id_templates: 'TPL-01',
          id_zone_default: 'Z-01',
          status: 'ARCHIVEE',
          lifecycle_status: 'ARCHIVED',
          is_active: false,
          archived: true,
          archive_reason: 'Fin de vie',
        },
      ]);

      const eventsAfterArchive = useGmaoStore.getState().auditEvents;
      const archiveEvt = eventsAfterArchive.find(
        (e) => e.actionType === 'MACHINE_ARCHIVED' && e.entityId === 'MCH-AUD-01'
      );
      expect(archiveEvt).toBeDefined();
      expect(archiveEvt?.entityType).toBe('MACHINE');
      expect(archiveEvt?.before?.is_active).toBe(true);
      expect(archiveEvt?.after?.is_active).toBe(false);
      expect(archiveEvt?.after?.status).toBe('ARCHIVEE');

      // Restore the machine
      useGmaoStore.getState().setMachines([
        {
          id_machine_registered: 'MCH-AUD-01',
          designation: 'Compresseur Audit',
          id_family: 'FAM-01',
          id_templates: 'TPL-01',
          id_zone_default: 'Z-01',
          status: 'En Service',
          lifecycle_status: 'ACTIVE',
          is_active: true,
          archived: false,
        },
      ]);

      const restoreEvt = useGmaoStore
        .getState()
        .auditEvents.find(
          (e) => e.actionType === 'MACHINE_RESTORED' && e.entityId === 'MCH-AUD-01'
        );
      expect(restoreEvt).toBeDefined();
      expect(restoreEvt?.before?.is_active).toBe(false);
      expect(restoreEvt?.after?.is_active).toBe(true);
    });

    it('records before/after audit events when stockInitial or unit price is modified', () => {
      const store = useGmaoStore.getState();
      store.setRawStock([
        {
          id: 'STK-1',
          ref: 'ROUL-6205',
          designation: 'Roulement 6205',
          stockInitial: 10,
          prixUnitaire: 50,
          seuil: 2,
        },
      ]);

      // Modify stockInitial and prixUnitaire
      useGmaoStore.getState().setRawStock([
        {
          id: 'STK-1',
          ref: 'ROUL-6205',
          designation: 'Roulement 6205',
          stockInitial: 25,
          prixUnitaire: 65,
          seuil: 2,
        },
      ]);

      const events = useGmaoStore.getState().auditEvents;
      const stockEvt = events.find((e) => e.entityId === 'ROUL-6205');
      expect(stockEvt).toBeDefined();
      expect(stockEvt?.entityType).toBe('STOCK_ITEM');
      expect(stockEvt?.actionType).toBe('STOCK_INITIAL_AND_PRICE_CHANGED');
      expect(stockEvt?.before?.stockInitial).toBe(10);
      expect(stockEvt?.after?.stockInitial).toBe(25);
      expect(stockEvt?.before?.prix_unitaire).toBe(50);
      expect(stockEvt?.after?.prix_unitaire).toBe(65);
    });

    it('enforces append-only immutability (frozen events, no update/delete API, server RBAC blocks PUT/DELETE)', () => {
      const store = useGmaoStore.getState() as Record<string, unknown>;
      expect(store.updateAuditEvent).toBeUndefined();
      expect(store.deleteAuditEvent).toBeUndefined();
      expect(store.removeAuditEvent).toBeUndefined();

      const created = useGmaoStore.getState().appendAuditEvent({
        actionType: 'STOCK_INITIAL_CHANGED',
        entityType: 'STOCK_ITEM',
        entityId: 'PDR-IMMUTABLE',
        before: { stockInitial: 5 },
        after: { stockInitial: 8 },
      });

      expect(Object.isFrozen(created)).toBe(true);
      expect(() => {
        (created as any).entityId = 'TAMPERED';
      }).toThrow();

      // Server RBAC allows POST on auditEvents for authenticated roles, but strictly blocks PUT/DELETE even for ADMIN
      expect(canRoleMutateEntity('TECHNICIEN', 'auditEvents', 'POST').allowed).toBe(true);
      expect(canRoleMutateEntity('ADMIN', 'auditEvents', 'PUT').allowed).toBe(false);
      expect(canRoleMutateEntity('ADMIN', 'auditEvents', 'DELETE').allowed).toBe(false);
    });
  });

  // =========================================================================
  // BATCH B: ASSET-HIERARCHY-P0 (Practical Industrial Asset Hierarchy)
  // =========================================================================
  describe('Batch B — ASSET-HIERARCHY-P0 (Hierarchy, Cycle Immunity, Archive Policy, Rollup)', () => {
    it('prevents self-parenting and multi-node cycles (A -> B -> A)', () => {
      const machines = [
        { id_machine_registered: 'LINE-01', designation: 'Ligne 1', asset_level: 'LINE', parent_id: null },
        { id_machine_registered: 'MCH-A', designation: 'Machine A', asset_level: 'MACHINE', parent_id: 'LINE-01' },
        { id_machine_registered: 'MCH-B', designation: 'Machine B', asset_level: 'SUB_SYSTEM', parent_id: 'MCH-A' },
      ];

      // Self-cycle check
      expect(wouldCreateHierarchyCycle(machines, 'MCH-A', 'MCH-A')).toBe(true);
      // Direct cycle: LINE-01 -> MCH-A -> LINE-01
      expect(wouldCreateHierarchyCycle(machines, 'LINE-01', 'MCH-A')).toBe(true);
      // Transitive cycle: LINE-01 -> MCH-A -> MCH-B -> LINE-01
      expect(wouldCreateHierarchyCycle(machines, 'LINE-01', 'MCH-B')).toBe(true);
      // Valid non-cyclic assignment
      expect(wouldCreateHierarchyCycle(machines, 'MCH-B', 'LINE-01')).toBe(false);

      // Sanitizer automatically strips cyclic parent_id if injected
      const cyclicList = [
        { id_machine_registered: 'A', designation: 'A', parent_id: 'B' },
        { id_machine_registered: 'B', designation: 'B', parent_id: 'A' },
      ];
      const sanitized = sanitizeMachinesHierarchy(cyclicList);
      const hasCycleAfterSanitize =
        sanitized[0].parent_id === 'B' && sanitized[1].parent_id === 'A';
      expect(hasCycleAfterSanitize).toBe(false);
    });

    it('resolves operational parent line context without inheriting Zone/Blueprint and preserves legacy machines', () => {
      const machines = [
        {
          id_machine_registered: 'LINE-EXT',
          designation: 'Ligne Extrusion',
          asset_level: 'LINE',
          id_zone_default: 'ZONE-EXT',
          id_family: 'FAM-EXT',
          id_blueprint: 'BP-LINE-DEFAULT',
          status: 'En Service',
        },
        {
          id_machine_registered: 'DET-01',
          designation: 'Extrudeuse DET-01',
          asset_level: 'SUB_SYSTEM', // legacy/invalid level must normalize to MACHINE
          parent_id: 'LINE-EXT',
          id_zone_default: 'ZONE-ATELIER-A',
          id_family: 'FAM-DET',
          id_blueprint: 'BP-DET-V1',
          status: 'En Service',
        },
        {
          id_machine_registered: 'DET-02',
          designation: 'Extrudeuse DET-02',
          asset_level: 'MACHINE',
          parent_id: 'LINE-EXT',
          id_zone_default: '',
          id_family: 'FAM-DET',
          id_blueprint: 'BP-DET-V2',
          status: 'En Service',
        },
        {
          id_machine_registered: 'LEGACY-MCH-99',
          designation: 'Ancienne Presse Sans Parent',
          id_zone_default: 'ZONE-PRESSE',
          id_family: 'FAM-PRS',
          status: 'En Service',
        },
      ];

      const det1Ctx = resolveMachineHierarchyContext(machines[1], machines);
      expect(det1Ctx.level).toBe('MACHINE'); // SUB_SYSTEM normalized to MACHINE
      expect(det1Ctx.parentId).toBe('LINE-EXT');
      expect(det1Ctx.parentDesignation).toBe('Ligne Extrusion');
      expect(det1Ctx.breadcrumbIds).toEqual(['LINE-EXT', 'DET-01']);
      expect(det1Ctx.ownZone).toBe('ZONE-ATELIER-A');
      expect(det1Ctx.ownBlueprint).toBe('BP-DET-V1');

      // DET-02 has its own Blueprint (BP-DET-V2) and empty Zone -> must NOT inherit ZONE-EXT from LINE-EXT
      const det2Ctx = resolveMachineHierarchyContext(machines[2], machines);
      expect(det2Ctx.parentId).toBe('LINE-EXT');
      expect(det2Ctx.ownZone).toBe('');
      expect(det2Ctx.ownBlueprint).toBe('BP-DET-V2');

      const legacyCtx = resolveMachineHierarchyContext(machines[3], machines);
      expect(legacyCtx.isRoot).toBe(true);
      expect(legacyCtx.parentId).toBeNull();
      expect(legacyCtx.level).toBe('MACHINE');
      expect(legacyCtx.breadcrumbIds).toEqual(['LEGACY-MCH-99']);

      // filterActiveMachines must return all 4 active machines unbroken
      expect(filterActiveMachines(machines)).toHaveLength(4);
    });

    it('enforces safe parent archive policy (warns and detaches active children while preserving previous_parent_id)', () => {
      const store = useGmaoStore.getState();
      store.setMachines([
        {
          id_machine_registered: 'LINE-PACK-01',
          designation: 'Ligne Conditionnement 01',
          asset_level: 'LINE',
          status: 'En Service',
          is_active: true,
        },
        {
          id_machine_registered: 'MCH-ENS-01',
          designation: 'Ensacheuse 01',
          asset_level: 'MACHINE',
          parent_id: 'LINE-PACK-01',
          status: 'En Service',
          is_active: true,
        },
      ]);

      const policyEval = evaluateParentArchivePolicy(
        'LINE-PACK-01',
        useGmaoStore.getState().machines
      );
      expect(policyEval.hasActiveChildren).toBe(true);
      expect(policyEval.activeChildrenIds).toEqual(['MCH-ENS-01']);
      expect(policyEval.warningMessage).toContain('MCH-ENS-01');

      // Archive parent LINE-PACK-01
      useGmaoStore.getState().setMachines(
        useGmaoStore.getState().machines.map((m) =>
          m.id_machine_registered === 'LINE-PACK-01'
            ? { ...m, status: 'ARCHIVEE', is_active: false, archived: true }
            : m
        )
      );

      const updatedMachines = useGmaoStore.getState().machines;
      const activeList = filterActiveMachines(updatedMachines);
      // Child remains active and is not broken
      expect(activeList.map((m) => m.id_machine_registered)).toEqual(['MCH-ENS-01']);

      const childAfterArchive = updatedMachines.find(
        (m) => m.id_machine_registered === 'MCH-ENS-01'
      );
      expect(childAfterArchive?.parent_id).toBeNull();
      expect(childAfterArchive?.previous_parent_id).toBe('LINE-PACK-01');
    });

    it('computes parent corrective rollup strictly from APPROVED/CLOSED child interventions', () => {
      const machines = [
        { id_machine_registered: 'LINE-01', designation: 'Ligne 01', asset_level: 'LINE' },
        { id_machine_registered: 'MCH-01', designation: 'Machine 01', parent_id: 'LINE-01' },
        { id_machine_registered: 'MCH-02', designation: 'Machine 02', parent_id: 'LINE-01' },
      ];
      const correctiveInterventions = [
        {
          id: 'BT-1',
          id_machine: 'MCH-01',
          validation_status: 'APPROVED',
          statut: 'CLOTURE',
          temps_arret_machine_min: 120,
          duree_intervention_min: 60,
        },
        {
          id: 'BT-2',
          id_machine: 'MCH-02',
          validation_status: 'APPROVED',
          statut: 'CLOTURE',
          temps_arret_machine_min: 180,
          duree_intervention_min: 180,
        },
        {
          id: 'BT-PENDING',
          id_machine: 'MCH-01',
          validation_status: 'PENDING_APPROVAL',
          statut: 'EN_COURS',
          temps_arret_machine_min: 600,
          duree_intervention_min: 600,
        },
        {
          id: 'BT-REJECTED',
          id_machine: 'MCH-02',
          validation_status: 'REJECTED',
          statut: 'CLOTURE',
          temps_arret_machine_min: 500,
          duree_intervention_min: 500,
        },
      ];

      const rollup = computeParentCorrectiveRollup('LINE-01', machines, correctiveInterventions);
      expect(rollup.descendantCount).toBe(2);
      expect(rollup.approvedFailuresCount).toBe(2);
      expect(rollup.totalDowntimeHours).toBe(5); // (120 + 180) / 60 = 5h
      expect(rollup.totalRepairHours).toBe(4); // (60 + 180) / 60 = 4h
      expect(rollup.mttrHours).toBe(2); // 4h / 2 = 2h
      expect(rollup.mtbfHours).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // BATCH C & E: METER + PO + FACTORY RESET SMOKE VERIFICATION
  // =========================================================================
  describe('Batch C & E — Meter Trigger Persistence, PO Clamping/RBAC, & Factory Reset', () => {
    it('Meter reading persists compteur_statut_declenchement (WARNING / OVERDUE) and compteur_restant on preventive tasks', async () => {
      const store = useGmaoStore.getState();
      store.setMachines([
        {
          id_machine_registered: 'MCH-MTR-01',
          designation: 'Presse Hydraulique',
          id_family: 'FAM-01',
          id_templates: 'TPL-01',
          id_zone_default: 'Z-01',
          status: 'En Service',
          compteur_heures: 400,
        },
      ]);
      store.setPreventiveTasks([
        {
          id: 'PM-MTR-01',
          id_machine: 'MCH-MTR-01',
          description: 'Vidange huile hydraulique 500h',
          etat: 'Planifié',
          type_declencheur: 'COMPTEUR',
          compteur_unite: 'Heures',
          compteur_seuil_intervalle: 500,
          compteur_dernier_declenchement: 0,
          compteur_prochain_declenchement: 500,
          compteur_marge_alerte: 50,
        },
      ]);

      // 1. Reading at 460h (within 50h alert margin of 500h) -> WARNING
      await useGmaoStore.getState().handleRecordMeterReading({
        machineId: 'MCH-MTR-01',
        valeur: 460,
        unite: 'Heures',
        releve_par: 'TECH-01',
        source: 'MANUEL',
      });
      const taskAfterWarn = useGmaoStore.getState().preventiveTasks[0];
      expect(taskAfterWarn.compteur_statut_declenchement).toBe('WARNING');
      expect(taskAfterWarn.compteur_restant).toBe(40);

      // 2. Reading at 515h (>= 500h) -> OVERDUE + etat: 'En retard'
      await useGmaoStore.getState().handleRecordMeterReading({
        machineId: 'MCH-MTR-01',
        valeur: 515,
        unite: 'Heures',
        releve_par: 'TECH-01',
        source: 'MANUEL',
      });
      const taskAfterOverdue = useGmaoStore.getState().preventiveTasks[0];
      expect(taskAfterOverdue.compteur_statut_declenchement).toBe('OVERDUE');
      expect(taskAfterOverdue.compteur_restant).toBe(0);
      expect(taskAfterOverdue.etat).toBe('En retard');
    });

    it('PO lifecycle: partial -> full receipt, Entrée movements, stock index update, clamping, no double receipt, RBAC', async () => {
      // Verify UI/Client & Server RBAC for PO creation/reception
      expect(AuthorizationService.hasPermission({ role: 'ADMIN' }, 'stock.edit')).toBe(true);
      expect(AuthorizationService.hasPermission({ role: 'RESPONSABLE_MAGASIN' }, 'stock.edit')).toBe(true);
      expect(AuthorizationService.hasPermission({ role: 'TECHNICIEN' }, 'stock.edit')).toBe(false);
      expect(AuthorizationService.hasPermission({ role: 'OPERATEUR' }, 'stock.edit')).toBe(false);
      expect(canRoleMutateEntity('RESPONSABLE_MAGASIN', 'replenishmentOrders', 'POST').allowed).toBe(true);
      expect(canRoleMutateEntity('TECHNICIEN', 'replenishmentOrders', 'POST').allowed).toBe(false);

      const store = useGmaoStore.getState();
      store.setRawStock([
        {
          id: 'STK-PO-1',
          ref: 'FILT-HUILE-01',
          designation: 'Filtre à huile haute pression',
          stockInitial: 2,
          seuil: 5,
          prixUnitaire: 120,
        },
      ]);

      const newOrder = await useGmaoStore.getState().handleCreateReplenishmentOrder({
        fournisseur: 'Fournisseur Industriel SA',
        demandeur: 'MAGASINIER-01',
        priorite: 'HAUTE',
        items: [
          {
            ref: 'FILT-HUILE-01',
            designation: 'Filtre à huile haute pression',
            quantite_demandee: 10,
            quantite_recue: 0,
            prix_unitaire_estime: 120,
            stock_actuel_moment: 2,
            seuil_alerte: 5,
          },
        ],
        montant_total_estime: 1200,
      });
      expect(newOrder.id).toBeDefined();

      // Partial receipt: 4 units
      await useGmaoStore
        .getState()
        .handleReceiveReplenishmentOrder(
          newOrder.id,
          [{ ref: 'FILT-HUILE-01', quantite_recue: 4 }],
          'BL-001',
          'MAGASINIER-01'
        );
      expect(useGmaoStore.getState().replenishmentOrders[0].statut).toBe('RECEPTION_PARTIELLE');
      expect(stockIndexStore.index.getTotals('FILT-HUILE-01').entrees).toBe(4);

      // Full receipt with excess quantity (attempting 99 when only 6 remain needed -> clamped to 6, total 10)
      await useGmaoStore
        .getState()
        .handleReceiveReplenishmentOrder(
          newOrder.id,
          [{ ref: 'FILT-HUILE-01', quantite_recue: 99 }],
          'BL-002',
          'MAGASINIER-01'
        );
      expect(useGmaoStore.getState().replenishmentOrders[0].statut).toBe('RECU_CONFORME');
      expect(useGmaoStore.getState().replenishmentOrders[0].items[0].quantite_recue).toBe(10);
      expect(stockIndexStore.index.getTotals('FILT-HUILE-01').entrees).toBe(10);

      // Double receipt on RECU_CONFORME must be ignored/rejected
      await useGmaoStore
        .getState()
        .handleReceiveReplenishmentOrder(
          newOrder.id,
          [{ ref: 'FILT-HUILE-01', quantite_recue: 5 }],
          'BL-DUPLICATE',
          'MAGASINIER-01'
        );
      expect(stockIndexStore.index.getTotals('FILT-HUILE-01').entrees).toBe(10);
    });

    it('clearAllForRealFactory zeroes meterReadings, replenishmentOrders, and auditEvents in store and STORAGE_KEYS', async () => {
      const store = useGmaoStore.getState();
      store.setMachines([
        {
          id_machine_registered: 'MCH-CLR-01',
          designation: 'Machine Test Clear',
          id_family: 'F1',
          id_templates: 'T1',
          id_zone_default: 'Z1',
          status: 'En Service',
        },
      ]);
      await store.handleRecordMeterReading({
        machineId: 'MCH-CLR-01',
        valeur: 120,
        unite: 'Heures',
        releve_par: 'TECH',
      });
      await store.handleCreateReplenishmentOrder({
        fournisseur: 'Test Supplier',
        demandeur: 'MAGASINIER',
        priorite: 'NORMALE',
        items: [
          {
            ref: 'REF-1',
            designation: 'Art 1',
            quantite_demandee: 5,
            quantite_recue: 0,
            prix_unitaire_estime: 10,
            stock_actuel_moment: 0,
            seuil_alerte: 2,
          },
        ],
        montant_total_estime: 50,
      });
      store.appendAuditEvent({
        actionType: 'STOCK_INITIAL_CHANGED',
        entityType: 'STOCK_ITEM',
        entityId: 'REF-1',
        before: { stockInitial: 0 },
        after: { stockInitial: 5 },
      });

      expect(useGmaoStore.getState().meterReadings.length).toBeGreaterThan(0);
      expect(useGmaoStore.getState().replenishmentOrders.length).toBeGreaterThan(0);
      expect(useGmaoStore.getState().auditEvents.length).toBeGreaterThan(0);

      // Execute factory reset via DataGateway & Store
      DataGateway.clearAllForRealFactory();
      await useGmaoStore.getState().handleClearAllForRealFactory();

      expect(useGmaoStore.getState().meterReadings).toEqual([]);
      expect(useGmaoStore.getState().replenishmentOrders).toEqual([]);
      expect(useGmaoStore.getState().auditEvents).toEqual([]);
      expect(DataGateway.getAuditEvents()).toEqual([]);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.METER_READINGS) || '[]')).toEqual([]);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.REPLENISHMENT_ORDERS) || '[]')).toEqual([]);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_EVENTS) || '[]')).toEqual([]);
    });
  });
});
