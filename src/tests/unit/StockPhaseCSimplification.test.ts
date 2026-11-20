import { describe, it, expect, beforeEach } from 'vitest';
import { computeStockCockpitMetrics } from '../../domain/stock/stockCockpitService';
import { useGmaoStore } from '../../store/useGmaoStore';
import { StockCalculationService } from '../../core/domain/services/StockCalculationService';
import type { IMouvement, ISortieDemand, IStockItem } from '../../types/domain';
import type { IReplenishmentOrder } from '../../types/replenishment';

describe('Phase C — Small Factory Stock Simplification (Cockpit, Batch Inventory, Shared PC)', () => {
  beforeEach(() => {
    localStorage.clear();
    useGmaoStore.setState({
      rawStock: [],
      mouvements: [],
      sortieDemands: [],
      replenishmentOrders: [],
      auditEvents: [],
    });
  });

  it('C1: computeStockCockpitMetrics accurately computes Classe A ruptures, Dead Stock > 90j (MAD), pending sortie demands, and active POs', () => {
    const referenceDate = new Date('2026-06-01T12:00:00.000Z');

    const stockItems: IStockItem[] = [
      // 1. Classe A in rupture -> counted in classeARupturesCount, NOT in dead stock (stock = 0)
      {
        ref: 'RLM-A-01',
        designation: 'Roulement Broche Classe A',
        stockInitial: 0,
        stockActuel: 0,
        seuil: 2,
        criticite: 'A',
        alerte: 'RUPTURE',
        prixUnitaire: 500,
      },
      // 2. Classe A archived -> MUST be excluded from all metrics
      {
        ref: 'RLM-A-ARCH',
        designation: 'Ancien Roulement Archivé',
        stockInitial: 0,
        stockActuel: 0,
        criticite: 'A',
        alerte: 'RUPTURE',
        is_active: false,
      },
      // 3. Classe B in rupture -> NOT counted in Classe A ruptures
      {
        ref: 'VISS-B-01',
        designation: 'Vis M8 Classe B',
        stockInitial: 0,
        stockActuel: 0,
        criticite: 'B',
        alerte: 'RUPTURE',
        prixUnitaire: 10,
      },
      // 4. Dead Stock > 90 days (only old Sortie 120d ago, stockActuel = 5 @ 200 DH = 1,000 DH)
      {
        ref: 'MOT-DEAD-01',
        designation: 'Variateur Dormant',
        stockInitial: 6,
        stockActuel: 5,
        criticite: 'B',
        prixUnitaire: 200,
      },
      // 5. Dead Stock > 90 days (no Sortie at all, stockActuel = 2 @ 150 DH = 300 DH)
      {
        ref: 'COUR-DEAD-02',
        designation: 'Courroie Dormante',
        stockInitial: 2,
        stockActuel: 2,
        criticite: 'C',
        prix_unitaire: 150,
      },
      // 6. Active moving part (Sortie 15 days ago) -> NOT dead stock
      {
        ref: 'FIL-ACT-01',
        designation: 'Filtre Actif',
        stockInitial: 10,
        stockActuel: 8,
        criticite: 'A',
        prixUnitaire: 100,
      },
    ];

    const mouvements: IMouvement[] = [
      {
        id: 'MVT-OLD',
        code_bon: 'Bon-001',
        date: '2026-01-15',
        ref: 'MOT-DEAD-01',
        quantite: 1,
        type: 'Sortie Interne',
      },
      {
        id: 'MVT-RECENT',
        code_bon: 'Bon-002',
        date: '2026-05-15',
        ref: 'FIL-ACT-01',
        quantite: 2,
        type: 'Sortie',
      },
      // Entrée does NOT reset dead-stock consumption clock
      {
        id: 'MVT-ENTREE-RECENT',
        code_bon: 'BR-001',
        date: '2026-05-20',
        ref: 'COUR-DEAD-02',
        quantite: 1,
        type: 'Entrée',
      },
    ];

    const sortieDemands: ISortieDemand[] = [
      {
        id: 'SD-1',
        code_bon_tech: 'BS-01',
        date: '2026-05-30',
        type: 'Sortie Interne',
        items: [],
        validation_status: 'PENDING_VALIDATION',
      },
      {
        id: 'SD-2',
        code_bon_tech: 'BS-02',
        date: '2026-05-30',
        type: 'Sortie Interne',
        items: [],
        validation_status: 'NEEDS_CLARIFICATION',
      },
      {
        id: 'SD-3',
        code_bon_tech: 'BS-03',
        date: '2026-05-28',
        type: 'Sortie Interne',
        items: [],
        validation_status: 'APPROVED',
      },
    ];

    const replenishmentOrders: IReplenishmentOrder[] = [
      {
        id: 'PO-1',
        numero_commande: 'BC-2026-001',
        date_creation: '2026-05-20',
        fournisseur: 'SKF',
        statut: 'COMMANDE',
        cree_par: 'Magasinier',
        items: [],
        montant_total_estime: 1000,
      },
      {
        id: 'PO-2',
        numero_commande: 'BC-2026-002',
        date_creation: '2026-05-25',
        fournisseur: 'Festo',
        statut: 'RECEPTION_PARTIELLE',
        cree_par: 'Magasinier',
        items: [],
        montant_total_estime: 500,
      },
      {
        id: 'PO-3',
        numero_commande: 'BC-2026-003',
        date_creation: '2026-05-01',
        fournisseur: 'ABB',
        statut: 'RECU_CONFORME',
        cree_par: 'Magasinier',
        items: [],
        montant_total_estime: 2000,
      },
      {
        id: 'PO-4',
        numero_commande: 'BC-2026-004',
        date_creation: '2026-05-02',
        fournisseur: 'ABB',
        statut: 'ANNULE',
        cree_par: 'Magasinier',
        items: [],
        montant_total_estime: 300,
      },
    ];

    const metrics = computeStockCockpitMetrics({
      stockItems,
      mouvements,
      sortieDemands,
      replenishmentOrders,
      referenceDate,
      deadStockWindowDays: 90,
    });

    expect(metrics.classeARupturesCount).toBe(1);
    expect(metrics.classeARuptureRefs.has('RLM-A-01')).toBe(true);
    expect(metrics.classeARuptureRefs.has('RLM-A-ARCH')).toBe(false);
    expect(metrics.classeARuptureRefs.has('VISS-B-01')).toBe(false);

    expect(metrics.deadStock90dCount).toBe(2);
    expect(metrics.deadStock90dRefs.has('MOT-DEAD-01')).toBe(true);
    expect(metrics.deadStock90dRefs.has('COUR-DEAD-02')).toBe(true);
    expect(metrics.deadStock90dRefs.has('FIL-ACT-01')).toBe(false);
    expect(metrics.deadStock90dValueMad).toBe(1300);

    expect(metrics.pendingSortieDemandsCount).toBe(2);
    expect(metrics.activePoCount).toBe(2);
  });

  it('C2: handleBatchPhysicalInventory enforces RBAC, emits Entrée/Sortie INVENTAIRE movements without mutating stockInitial, and logs INVENTORY_BATCH_ADJUSTED', () => {
    const store = useGmaoStore.getState();

    store.setRawStock([
      {
        id: 'STK-1',
        ref: 'PDR-POS',
        designation: 'Roulement SKF 6204',
        stockInitial: 10,
        seuil: 4,
        prixUnitaire: 50,
        emplacement: 'A1-01',
      },
      {
        id: 'STK-2',
        ref: 'PDR-NEG',
        designation: 'Joint Spi Viton',
        stockInitial: 8,
        seuil: 3,
        prixUnitaire: 20,
        emplacement: 'A1-02',
      },
      {
        id: 'STK-3',
        ref: 'PDR-ZERO',
        designation: 'Fusible 10A',
        stockInitial: 5,
        seuil: 2,
        prixUnitaire: 15,
        emplacement: 'A2-01',
      },
    ]);

    // 1. RBAC: TECHNICIEN cannot commit physical inventory adjustments
    const denied = useGmaoStore.getState().handleBatchPhysicalInventory({
      entries: [{ ref: 'PDR-POS', countedQty: 14 }],
      reason: 'Tentative non autorisée',
      actorRole: 'TECHNICIEN',
      actorName: 'Ali Tech',
    });
    expect(denied.success).toBe(false);
    expect(useGmaoStore.getState().mouvements.length).toBe(0);

    // 2. Magasinier commits batch inventory:
    // PDR-POS: 10 -> 14 (+4 => +200 DH, Entrée)
    // PDR-NEG: 8 -> 5 (-3 => -60 DH, Sortie)
    // PDR-ZERO: 5 -> 5 (0 => skipped)
    // Negative countedQty -> ignored safely
    const result = useGmaoStore.getState().handleBatchPhysicalInventory({
      entries: [
        { ref: 'PDR-POS', countedQty: 14 },
        { ref: 'PDR-NEG', countedQty: 5 },
        { ref: 'PDR-ZERO', countedQty: 5 },
        { ref: 'PDR-POS', countedQty: 14 }, // deduplicated
        { ref: 'PDR-NEG', countedQty: -2 }, // invalid negative ignored
      ],
      reason: 'Inventaire tournant Zone A',
      actorRole: 'RESPONSABLE_MAGASIN',
      actorId: 'USR-MAG-01',
      actorName: 'Hassan Magasinier',
    });

    expect(result.success).toBe(true);
    expect(result.adjustedCount).toBe(2);
    expect(result.netEcartUnits).toBe(1); // +4 - 3
    expect(result.netEcartValueMad).toBe(140); // +200 - 60

    const state = useGmaoStore.getState();
    // Stock Math Invariant: stockInitial remains untouched!
    expect(state.rawStock.find((s) => s.ref === 'PDR-POS')?.stockInitial).toBe(10);
    expect(state.rawStock.find((s) => s.ref === 'PDR-NEG')?.stockInitial).toBe(8);

    // Recomputed stockActuel matches physical count exactly
    const posStock = StockCalculationService.calculateStockActuel(
      state.rawStock.find((s) => s.ref === 'PDR-POS')!,
      state.mouvements
    );
    const negStock = StockCalculationService.calculateStockActuel(
      state.rawStock.find((s) => s.ref === 'PDR-NEG')!,
      state.mouvements
    );
    const zeroStock = StockCalculationService.calculateStockActuel(
      state.rawStock.find((s) => s.ref === 'PDR-ZERO')!,
      state.mouvements
    );
    expect(posStock).toBe(14);
    expect(negStock).toBe(5);
    expect(zeroStock).toBe(5);

    // Movements have type 'Entrée' / 'Sortie' and action_id 'INVENTAIRE'
    const mvtPos = state.mouvements.find((m) => m.ref === 'PDR-POS');
    const mvtNeg = state.mouvements.find((m) => m.ref === 'PDR-NEG');
    expect(mvtPos?.type).toBe('Entrée');
    expect(mvtPos?.action_id).toBe('INVENTAIRE');
    expect(mvtPos?.quantite).toBe(4);
    expect(mvtNeg?.type).toBe('Sortie');
    expect(mvtNeg?.action_id).toBe('INVENTAIRE');
    expect(mvtNeg?.quantite).toBe(3);

    // Audit trail event recorded
    const audit = state.auditEvents.find((ev) => ev.actionType === 'INVENTORY_BATCH_ADJUSTED');
    expect(audit).toBeDefined();
    expect(audit?.actorName).toBe('Hassan Magasinier');
    expect(audit?.after?.reason).toBe('Inventaire tournant Zone A');
    expect(audit?.after?.adjustedCount).toBe(2);
    expect(audit?.after?.netEcartValueMad).toBe(140);
  });
});
