import { describe, it, expect, beforeEach } from 'vitest';
import { useGmaoStore } from '../../store/useGmaoStore';
import { DataGateway } from '../../application/DataGateway';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { computeMachineHealthPassport } from '../../application/services/MachineHealthPassportService';
import { IReplenishmentOrder } from '../../types/replenishment';
import { canRoleMutateEntity } from '../../core/security/serverRbacPolicy';
import { stockIndexStore } from '../../application/StockIndexStore';

describe('المحور 3 & المحور 4 — Machine Passport 360° & Smart Replenishment Engine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('المحور 3 — Machine Health & 360° Passport Calculations', () => {
    it('computes complete 360° health passport metrics (TCO, Downtime, BER alert)', () => {
      const mockMachine = {
        id_machine_registered: 'M-TEST-01',
        designation: 'Ligne Ensacheuse Principale',
        compteur_heures: 4500,
        unite_compteur: 'HEURES',
      };

      const mockCorrective = [
        {
          id: 'BT-01',
          code_machine: 'M-TEST-01',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          duree_arret_heures: 3.5,
          cout_pdr: 1200,
          nom_composant: 'Palier Roulement',
          date_cloture: '2026-10-15',
        },
        {
          id: 'BT-02',
          code_machine: 'M-TEST-01',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          duree_arret_heures: 2.0,
          cout_pdr: 800,
          nom_composant: 'Palier Roulement',
          date_cloture: '2026-10-20',
        },
        {
          id: 'BT-03',
          code_machine: 'M-TEST-01',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          duree_arret_heures: 1.5,
          cout_pdr: 600,
          nom_composant: 'Palier Roulement',
          date_cloture: '2026-10-25',
        },
      ];

      const mockPreventiveExecs = [
        {
          id: 'EXEC-01',
          machineCode: 'M-TEST-01',
          validation_status: 'APPROVED',
          totalCost: 350,
          executedAt: '2026-10-10',
        },
      ];

      const passport = computeMachineHealthPassport({
        machine: mockMachine,
        correctiveInterventions: mockCorrective,
        preventiveExecutions: mockPreventiveExecs,
        recurrenceThreshold: 3,
      });

      expect(passport.machineCode).toBe('M-TEST-01');
      expect(passport.correctiveCount12m).toBe(3);
      expect(passport.preventiveCount12m).toBe(1);
      // TCO = Corrective PDR (1200+800+600=2600) + Preventive (350) = 2950
      expect(passport.correctivePdrCost12m).toBe(2600);
      expect(passport.preventiveTotalCost12m).toBe(350);
      expect(passport.totalMaintenanceCost12m).toBe(2950);
      // Downtime = (3.5+2.0+1.5)*60 = 420 mins = 7 hours
      expect(passport.totalDowntimeHours12m).toBe(7);
      // Recurrent organ alert triggered for Palier Roulement (3 >= 3)
      expect(passport.recurrentOrganAlerts.length).toBe(1);
      expect(passport.recurrentOrganAlerts[0].organLabel).toBe('Palier Roulement');
      expect(passport.healthStatus).toBe('CRITIQUE_BER');
    });
  });

  describe('المحور 4 — Smart Replenishment Engine & Stock Invariant Integrity', () => {
    it('creates, transitions and receives replenishment order generating Entrée movement and maintaining stock math', async () => {
      const store = useGmaoStore.getState();

      const orderPayload: Partial<IReplenishmentOrder> = {
        fournisseur: 'SKF Industrie Maroc',
        cree_par: 'Magasinier Test',
        items: [
          {
            ref: 'ROUL-6204-2RS',
            designation: 'Roulement à billes SKF',
            quantite_demandee: 10,
            quantite_recue: 0,
            prix_unitaire_estime: 85,
            stock_actuel_moment: 2,
            seuil_alerte: 5,
            unite: 'U',
          },
        ],
        montant_total_estime: 850,
      };

      // 1. Create order
      const newOrder = await store.handleCreateReplenishmentOrder(orderPayload);
      expect(newOrder.id).toBeDefined();
      expect(newOrder.statut).toBe('BROUILLON');
      expect(newOrder.numero_commande).toMatch(/^BC-\d+-\d+$/);

      // 2. Transition to COMMANDE
      await store.handleUpdateReplenishmentOrderStatus(newOrder.id, 'COMMANDE');
      const ordersAfterSend = useGmaoStore.getState().replenishmentOrders;
      const orderSent = ordersAfterSend.find((o) => o.id === newOrder.id);
      expect(orderSent?.statut).toBe('COMMANDE');
      expect(orderSent?.date_commande).toBeDefined();

      // Initial movement count
      const initialMvtCount = (useGmaoStore.getState().mouvements || []).length;

      // 3. Receive order (confirm goods receipt BR) — also test over-receipt clamping (attempting 15 when 10 requested)
      await store.handleReceiveReplenishmentOrder(
        newOrder.id,
        [{ ref: 'ROUL-6204-2RS', quantite_recue: 15 }],
        'BR-20261107-TEST',
        'Chef Magasin'
      );

      const stateAfterReceipt = useGmaoStore.getState();
      const orderCompleted = stateAfterReceipt.replenishmentOrders.find((o) => o.id === newOrder.id);

      // Verify order status updated to RECU_CONFORME and clamped to 10
      expect(orderCompleted?.statut).toBe('RECU_CONFORME');
      expect(orderCompleted?.items[0].quantite_recue).toBe(10);
      expect(orderCompleted?.numero_bon_reception).toBe('BR-20261107-TEST');

      // Verify Entrée movement was automatically created with action_id: 'reapprovisionnement'
      const updatedMouvements = stateAfterReceipt.mouvements;
      expect(updatedMouvements.length).toBe(initialMvtCount + 1);

      const createdMvt = updatedMouvements[0];
      expect(createdMvt.type).toBe('Entrée');
      expect(createdMvt.action_id).toBe('reapprovisionnement');
      expect(createdMvt.ref).toBe('ROUL-6204-2RS');
      expect(createdMvt.quantite).toBe(10);
      expect(createdMvt.code_bon).toBe('BR-20261107-TEST');

      // Verify IncrementalStockIndex via stockIndexStore reflects the new Entrée immediately
      expect(stockIndexStore.index.getTotals('ROUL-6204-2RS').entrees).toBeGreaterThanOrEqual(10);

      // 4. Verify terminal state guard prevents double-receipt or cancellation after RECU_CONFORME
      await store.handleReceiveReplenishmentOrder(
        newOrder.id,
        [{ ref: 'ROUL-6204-2RS', quantite_recue: 10 }],
        'BR-DUPLICATE',
        'Chef Magasin'
      );
      expect(useGmaoStore.getState().mouvements.length).toBe(initialMvtCount + 1);

      await store.handleUpdateReplenishmentOrderStatus(newOrder.id, 'ANNULE');
      const orderStillCompleted = useGmaoStore.getState().replenishmentOrders.find((o) => o.id === newOrder.id);
      expect(orderStillCompleted?.statut).toBe('RECU_CONFORME');
    });

    it('factory wipe clears replenishment orders and meter readings obeying Zero Silent Seed Invariant', () => {
      DataGateway.saveReplenishmentOrders([
        {
          id: 'PO-DUMMY',
          numero_commande: 'BC-DUMMY-001',
          date_creation: '2026-11-01',
          fournisseur: 'Test',
          statut: 'COMMANDE',
          cree_par: 'Admin',
          items: [],
          montant_total_estime: 0,
        },
      ]);
      DataGateway.saveMeterReadings([
        {
          id: 'REL-DUMMY',
          machineId: 'M-01',
          valeur: 100,
          valeur_precedente: 0,
          delta: 100,
          unite: 'Heures',
          date_releve: '2026-11-01',
          releve_par: 'Tech',
          source: 'MANUEL',
          createdAt: '2026-11-01T00:00:00Z',
        },
      ]);

      DataGateway.clearAllForRealFactory();

      expect(localStorage.getItem(STORAGE_KEYS.REPLENISHMENT_ORDERS)).toBe('[]');
      expect(localStorage.getItem(STORAGE_KEYS.METER_READINGS)).toBe('[]');
      expect(localStorage.getItem(STORAGE_KEYS.SORTIE_DEMANDS)).toBe('[]');
    });

    it('enforces LAN RBAC policy for replenishmentOrders and meterReadings', () => {
      // TECHNICIEN and OPERATEUR cannot mutate replenishmentOrders (stock ledger protection)
      expect(canRoleMutateEntity('TECHNICIEN', 'replenishmentOrders', 'POST').allowed).toBe(false);
      expect(canRoleMutateEntity('OPERATEUR', 'replenishmentOrders', 'POST').allowed).toBe(false);
      // RESPONSABLE_MAGASIN and RESPONSABLE can mutate replenishmentOrders
      expect(canRoleMutateEntity('RESPONSABLE_MAGASIN', 'replenishmentOrders', 'POST').allowed).toBe(true);
      expect(canRoleMutateEntity('RESPONSABLE', 'replenishmentOrders', 'POST').allowed).toBe(true);
      // TECHNICIEN and OPERATEUR can record meterReadings in the field
      expect(canRoleMutateEntity('TECHNICIEN', 'meterReadings', 'POST').allowed).toBe(true);
      expect(canRoleMutateEntity('OPERATEUR', 'meterReadings', 'POST').allowed).toBe(true);
    });
  });
});
