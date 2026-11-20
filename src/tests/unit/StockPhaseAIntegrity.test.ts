import { describe, it, expect, beforeEach } from 'vitest';
import { useGmaoStore } from '../../store/useGmaoStore';
import { StockCalculationService } from '../../domain/pdr/services/StockCalculationService';
import { isArchivedStockArticle } from '../../presentation/pages/stock/hooks/useStockViewController';
import { buildUnifiedMovementSearchCatalog } from '../../presentation/pages/movements/components/MovementFlowSelectorSection';
import { calculateWarehouseItems, syncMovementsToIndex } from '../../hooks/useAppCalculations';

describe('Stock PDR & Entrepôt — Phase A (RBAC, Stock Sufficiency Guard, Cache Hash & Valuation)', () => {
  beforeEach(() => {
    localStorage.clear();
    StockCalculationService.clearCache();
    useGmaoStore.setState({
      rawStock: [
        {
          id: 'STK-1',
          ref: 'ROUL-6205-2RS',
          designation: 'Roulement SKF 6205-2RS',
          stockInitial: 1,
          seuil: 1,
          prix_unitaire: 145,
          emplacement: 'A1-R2',
        } as any,
        {
          id: 'STK-2',
          ref: 'COUR-SPB-1800',
          designation: 'Courroie SPB 1800',
          stockInitial: 5,
          seuil: 2,
          prix_unitaire: 210,
          emplacement: 'B2-R1',
        } as any,
      ],
      mouvements: [],
      sortieDemands: [],
      replenishmentOrders: [],
      auditEvents: [],
    });
  });

  it('enforces store-level RBAC guards on SortieDemand review and Replenishment PO actions', async () => {
    const store = useGmaoStore.getState();

    // VIEWER cannot submit a SortieDemand
    const viewerSubmit = store.handleSubmitSortieDemand({
      actorRole: 'VIEWER',
      code_bon_tech: 'BS-VIEW-01',
      items: [{ ref: 'COUR-SPB-1800', designation: 'Courroie SPB 1800', quantite: 1 }],
    });
    expect(viewerSubmit).toBeNull();

    // TECHNICIEN can submit a SortieDemand
    const techDemand = store.handleSubmitSortieDemand({
      actorRole: 'TECHNICIEN',
      code_bon_tech: 'BS-TECH-01',
      technicien: 'Karim Tech',
      items: [{ ref: 'COUR-SPB-1800', designation: 'Courroie SPB 1800', quantite: 2 }],
    });
    expect(techDemand).not.toBeNull();
    expect(techDemand?.validation_status).toBe('PENDING_VALIDATION');

    // TECHNICIEN and OPERATEUR cannot self-approve a SortieDemand (Maker-Checker violation blocked)
    const techSelfApprove = useGmaoStore
      .getState()
      .handleReviewSortieDemandValidation(techDemand!.id, {
        actorRole: 'TECHNICIEN',
        decision: 'APPROVED',
      });
    expect(techSelfApprove).toBeNull();
    expect(useGmaoStore.getState().mouvements).toHaveLength(0);

    const opApprove = useGmaoStore
      .getState()
      .handleReviewSortieDemandValidation(techDemand!.id, {
        actorRole: 'OPERATEUR',
        decision: 'APPROVED',
      });
    expect(opApprove).toBeNull();

    // RESPONSABLE_MAGASIN can approve the SortieDemand
    const magApprove = useGmaoStore
      .getState()
      .handleReviewSortieDemandValidation(techDemand!.id, {
        actorRole: 'RESPONSABLE_MAGASIN',
        decision: 'APPROVED',
        validated_by_name: 'Hassan Magasinier',
      });
    expect(magApprove).not.toBeNull();
    expect(magApprove?.validation_status).toBe('APPROVED');
    expect(useGmaoStore.getState().mouvements).toHaveLength(1);

    // TECHNICIEN cannot create a supplier Purchase Order (PO)
    await expect(
      useGmaoStore.getState().handleCreateReplenishmentOrder({
        fournisseur: 'SKF Maroc',
        items: [],
        actorRole: 'TECHNICIEN',
      } as any)
    ).rejects.toThrow(/Permission refusée/);
  });

  it('prevents concurrent SortieDemand approvals from driving physical stock negative', () => {
    const store = useGmaoStore.getState();

    // Two technicians submit competing SortieDemands for the last bearing (stockInitial = 1)
    const demand1 = store.handleSubmitSortieDemand({
      id: 'SD-RACE-1',
      code_bon_tech: 'BS-RACE-1',
      technicien: 'Tech A',
      id_machine_registered: 'M-01',
      items: [{ ref: 'ROUL-6205-2RS', designation: 'Roulement SKF 6205-2RS', quantite: 1 }],
    });
    const demand2 = store.handleSubmitSortieDemand({
      id: 'SD-RACE-2',
      code_bon_tech: 'BS-RACE-2',
      technicien: 'Tech B',
      id_machine_registered: 'M-02',
      items: [{ ref: 'ROUL-6205-2RS', designation: 'Roulement SKF 6205-2RS', quantite: 1 }],
    });

    expect(demand1).not.toBeNull();
    expect(demand2).not.toBeNull();

    // Approving demand1 succeeds and consumes the 1 available unit
    const approved1 = useGmaoStore
      .getState()
      .handleReviewSortieDemandValidation(demand1!.id, {
        actorRole: 'RESPONSABLE_MAGASIN',
        decision: 'APPROVED',
      });
    expect(approved1?.validation_status).toBe('APPROVED');
    expect(useGmaoStore.getState().mouvements).toHaveLength(1);

    const remainingStock = StockCalculationService.calculateStockActuel(
      useGmaoStore.getState().rawStock[0],
      useGmaoStore.getState().mouvements
    );
    expect(remainingStock).toBe(0);

    // Approving demand2 when physical stock is now 0 must be blocked atomically!
    const blocked2 = useGmaoStore
      .getState()
      .handleReviewSortieDemandValidation(demand2!.id, {
        actorRole: 'RESPONSABLE_MAGASIN',
        decision: 'APPROVED',
      });
    expect(blocked2).toBeNull();
    expect(useGmaoStore.getState().mouvements).toHaveLength(1);
    const demand2State = useGmaoStore
      .getState()
      .sortieDemands.find((d) => d.id === demand2!.id);
    expect(demand2State?.validation_status).toBe('PENDING_VALIDATION');
  });

  it('invalidates L1 cache when any intermediate movement is edited and computes real financial value in getStockStatistics', () => {
    const articles = [
      { ref: 'ROUL-6205-2RS', designation: 'Roulement', stockInitial: 10, seuil: 2, prix_unitaire: 150 },
      { ref: 'COUR-SPB-1800', designation: 'Courroie', stockInitial: 4, seuil: 1, prix_unitaire: 250 },
    ];
    const movements = [
      { id: 'M-1', ref: 'ROUL-6205-2RS', type: 'Entrée', quantite: 5 },
      { id: 'M-2', ref: 'ROUL-6205-2RS', type: 'Sortie', quantite: 2 }, // index 1 (neither first=0, mid=2, nor last=4)
      { id: 'M-3', ref: 'COUR-SPB-1800', type: 'Entrée', quantite: 1 },
      { id: 'M-4', ref: 'ROUL-6205-2RS', type: 'Sortie', quantite: 1 },
      { id: 'M-5', ref: 'COUR-SPB-1800', type: 'Sortie', quantite: 1 },
    ];

    // First calculation populates L1 cache: 10 + 5 - (2 + 1) = 12
    const balanceBefore = StockCalculationService.calculateStockActuel(articles[0], movements);
    expect(balanceBefore).toBe(12);

    // Edit movement at index 1 (M-2) from quantite: 2 to quantite: 6 without changing first, mid (index 2), or last (index 4)
    const editedMovements = movements.map((m, idx) =>
      idx === 1 ? { ...m, quantite: 6 } : m
    );

    // Must immediately return 10 + 5 - (6 + 1) = 8 without stale cache collision!
    const balanceAfter = StockCalculationService.calculateStockActuel(articles[0], editedMovements);
    expect(balanceAfter).toBe(8);

    // Financial valuation in getStockStatistics must use real unit prices:
    // ROUL-6205-2RS: 8 * 150 = 1200; COUR-SPB-1800: 4 * 250 = 1000 -> totalValue = 2200
    const allStocks = StockCalculationService.calculateAllStocks(articles, editedMovements);
    const stats = StockCalculationService.getStockStatistics(allStocks);
    expect(stats.totalArticles).toBe(2);
    expect(stats.totalValue).toBe(2200);
  });

  it('excludes soft-archived articles from active stock and unified movement search catalog while preserving Entrepôt SSOT stockActuel', () => {
    const stockList = [
      { ref: 'ACTIVE-01', designation: 'Joint Actif', stockInitial: 5, stockActuel: 5, is_active: true },
      { ref: 'ARCH-01', designation: 'Joint Archivé', stockInitial: 3, stockActuel: 3, is_active: false, statut: 'ARCHIVE' },
    ];

    expect(isArchivedStockArticle(stockList[0] as any)).toBe(false);
    expect(isArchivedStockArticle(stockList[1] as any)).toBe(true);

    // Entrepôt item with 1 initial + 1 Entrée movement = 2 stockActuel (even if legacy quantite is 1)
    syncMovementsToIndex([{ ref: 'PART-AXE-01', type: 'Entrée Interne', quantite: 1 }]);
    const computedWh = calculateWarehouseItems([
      {
        id: 'WH-1',
        id_warehouse_item: 'PART-AXE-01',
        designation: 'Axe Acier 42CrMo4',
        nature: 'PART',
        category: 'PARTIE',
        stockInitial: 1,
        quantite: 1,
      } as any,
    ]);

    expect(computedWh[0].stockActuel).toBe(2);

    const catalog = buildUnifiedMovementSearchCatalog(stockList as any, computedWh as any);
    expect(catalog.map((c) => c.ref)).toContain('ACTIVE-01');
    expect(catalog.map((c) => c.ref)).not.toContain('ARCH-01');
    const whCatalogEntry = catalog.find((c) => c.ref === 'PART-AXE-01');
    expect(whCatalogEntry?.stockActuel).toBe(2);
  });
});
