import { describe, it, expect, beforeEach } from 'vitest';
import { useGmaoStore } from '../../store/useGmaoStore';
import { evaluateComponentWearAndLifecycle } from '../../utils/componentHealthScore';
import {
  computeDynamicCump,
  buildItemLotsAndBins,
} from '../../domain/stock/stockLotValuationService';

describe('Phase B — Stock PDR & Entrepôt Engineering & Financial Depth', () => {
  beforeEach(() => {
    localStorage.clear();
    useGmaoStore.setState({
      rawStock: [],
      mouvements: [],
      replenishmentOrders: [],
      auditEvents: [],
      warehouseItems: [],
      sortiesExterne: [],
      machineElementsLedger: [],
    });
  });

  it('B1: handleReceiveReplenishmentOrder computes CUMP, updates rawStock price/bin, emits STOCK_PRICE_CHANGED & PO_RECEIVED audit events, and attaches Lot/Expiry/Bin to Entrée movement', async () => {
    const store = useGmaoStore.getState();

    // 1. Seed initial article: 10 units @ 100 DH = 1,000 DH
    store.setRawStock([
      {
        id: 'STK-RLM-6205',
        ref: 'RLM-6205',
        designation: 'Roulement SKF 6205-2RS',
        stockInitial: 10,
        seuil: 5,
        prixUnitaire: 100,
        prix_unitaire: 100,
        emplacement: '',
      },
    ]);

    // 2. Create PO for 10 units estimated at 100 DH
    const order = await useGmaoStore.getState().handleCreateReplenishmentOrder({
      fournisseur: 'SKF Maroc',
      cree_par: 'Magasinier',
      items: [
        {
          ref: 'RLM-6205',
          designation: 'Roulement SKF 6205-2RS',
          quantite_demandee: 10,
          quantite_recue: 0,
          prix_unitaire_estime: 100,
          stock_actuel_moment: 10,
          seuil_alerte: 5,
          unite: 'U',
        },
      ],
    });

    // 3. Receive 10 units at real invoice price 150 DH with Lot, Expiry, and Bin
    // Expected CUMP = (10 * 100 + 10 * 150) / 20 = 125.00 DH
    await useGmaoStore.getState().handleReceiveReplenishmentOrder(
      order.id,
      [
        {
          ref: 'RLM-6205',
          quantite_recue: 10,
          prix_unitaire_reel: 150,
          lot_number: 'LOT-SKF-2026-09',
          date_peremption: '2028-12-31',
          emplacement_reception: 'MAG-CENTRAL-B4',
        },
      ],
      'BR-2026-9901',
      'Chef Magasinier'
    );

    const nextState = useGmaoStore.getState();

    // Verify rawStock updated with CUMP (125 DH) and primary bin location
    const updatedStock = nextState.rawStock.find((s) => s.ref === 'RLM-6205');
    expect(updatedStock).toBeDefined();
    expect(updatedStock?.prixUnitaire).toBe(125);
    expect(updatedStock?.prix_unitaire).toBe(125);
    expect((updatedStock as Record<string, unknown>)?.dernier_prix_achat).toBe(150);
    expect(updatedStock?.emplacement).toBe('MAG-CENTRAL-B4');

    // Verify physical stock invariant: stockInitial (10) + Entrée (10) = 20
    const liveCalculated = nextState.stockItems().find((s) => s.ref === 'RLM-6205');
    expect(liveCalculated?.stockInitial).toBe(10);
    expect(liveCalculated?.entrees).toBe(10);
    expect(liveCalculated?.stockActuel).toBe(20);

    // Verify Entrée movement carries real invoice price, CUMP, lot, expiry, and bin
    const mvt = nextState.mouvements.find((m) => m.code_bon === 'BR-2026-9901');
    expect(mvt).toBeDefined();
    expect(mvt?.type).toBe('Entrée');
    expect(mvt?.quantite).toBe(10);
    expect(mvt?.prix_unitaire).toBe(150);
    expect(mvt?.lot_number).toBe('LOT-SKF-2026-09');
    expect(mvt?.date_peremption).toBe('2028-12-31');
    expect(mvt?.emplacement_reception).toBe('MAG-CENTRAL-B4');
    expect((mvt as Record<string, unknown>)?.cump_avant).toBe(100);
    expect((mvt as Record<string, unknown>)?.cump_apres).toBe(125);

    // Verify stockLotValuationService recognizes the new lot, expiry, bin, and CUMP
    const cumpValuation = computeDynamicCump(
      { ...updatedStock!, prixUnitaire: 100, prix_unitaire: 100 },
      nextState.mouvements
    );
    expect(cumpValuation.stockActuel).toBe(20);
    expect(cumpValuation.cump).toBe(125);
    const lotsAndBins = buildItemLotsAndBins(updatedStock!, nextState.mouvements);
    const receivedLot = lotsAndBins.lots.find((l) => l.lotNumber === 'LOT-SKF-2026-09');
    expect(receivedLot).toBeDefined();
    expect(receivedLot?.expiryDate).toBe('2028-12-31');
    expect(receivedLot?.binCode).toBe('MAG-CENTRAL-B4');
    expect(receivedLot?.unitPrice).toBe(150);

    // Verify Audit Ledger recorded both STOCK_PRICE_CHANGED and PO_RECEIVED
    const priceAudit = nextState.auditEvents.find((e) => e.actionType === 'STOCK_PRICE_CHANGED');
    expect(priceAudit).toBeDefined();
    expect(priceAudit?.before?.prix_unitaire).toBe(100);
    expect(priceAudit?.after?.prix_unitaire).toBe(125);

    const poAudit = nextState.auditEvents.find((e) => e.actionType === 'PO_RECEIVED');
    expect(poAudit).toBeDefined();
    expect(poAudit?.after?.montant_total_reel).toBe(1500);
  });

  it('B2: Entrepôt rotating component lifecycle syncs warehouseItems, machineElementsLedger, and deduplicates BER health score', () => {
    const store = useGmaoStore.getState();

    // 1. Seed a rotating motor in warehouseItems and on Machine BOM Ledger (with 4200 wear hours)
    store.setWarehouseItems([
      {
        id: 'WH-MOT-501',
        id_warehouse_item: 'MOT-EXT-501',
        code: 'MOT-EXT-501',
        ref: 'ABB-15KW-501',
        designation: 'Moteur Extrudeuse 15kW',
        nature: 'COMPONENT',
        rattachement_type: 'MACHINE',
        id_machine: 'EXT-01',
        id_machine_registered: 'EXT-01',
        status: 'En service',
        historique_bobinage: [],
      },
    ]);

    store.setMachineElementsLedger([
      {
        id: 'LED-EXT-01-MOT',
        id_machine_registered: 'EXT-01',
        element_type: 'COMPONENT',
        ref_element: 'MOT-EXT-501',
        ref: 'MOT-EXT-501',
        designation: 'Moteur Extrudeuse 15kW',
        qte_montee: 1,
        criticalite: 'CRITIQUE',
        statut: 'ALERTE',
        heures_actuelles: 4200,
        duree_vie_estimee_heures: 5000,
        date_installation: '2025-01-10',
      },
    ]);

    // 2. Send motor to external rewinding via handleAddSortieExterne
    const createdSortie = useGmaoStore.getState().handleAddSortieExterne({
      id_machine: 'EXT-01',
      designation_moteur: 'Moteur Extrudeuse 15kW',
      ref_moteur: 'ABB-15KW-501',
      code_moteur_reel: 'MOT-EXT-501',
      type_probleme: 'Court-circuit stator',
      fournisseur_externe: 'Atelier Bobinage Atlas',
      date_expedition: '2026-03-01',
      etat: 'En réparation externe',
      cout_bobinage: 1800,
    });

    let whItem = useGmaoStore.getState().warehouseItems[0];
    expect(whItem.status).toBe('En réparation externe');
    expect(whItem.historique_bobinage?.length).toBe(1);
    expect((whItem.historique_bobinage?.[0] as Record<string, unknown>)?.societe_bobinage).toBe(
      'Atelier Bobinage Atlas'
    );
    expect((whItem.historique_bobinage?.[0] as Record<string, unknown>)?.cause).toBe(
      'Court-circuit stator'
    );

    // 3. Mark motor as returned to stock
    useGmaoStore.getState().handleMarkSortieReturned(createdSortie.id, {
      date_arrivee_reelle: '2026-03-08',
      cout_bobinage: 2100,
      note: 'Rebobinage classe H terminé',
    });

    whItem = useGmaoStore.getState().warehouseItems[0];
    expect(whItem.status).toBe('Retourné OK');
    expect(whItem.rattachement_type).toBe('STOCK');
    expect((whItem.historique_bobinage?.[0] as Record<string, unknown>)?.cout_bobinage).toBe(2100);
    expect((whItem.historique_bobinage?.[0] as Record<string, unknown>)?.date_reception).toBe(
      '2026-03-08'
    );

    // 4. Remount motor onto machine EXT-01 -> must update warehouseItems AND reset machineElementsLedger wear hours
    useGmaoStore.getState().handleMarkSortieMounted(createdSortie.id, {
      date_montage: '2026-03-10',
      technicien_montage: 'Karim T.',
      id_machine: 'EXT-01',
    });

    whItem = useGmaoStore.getState().warehouseItems[0];
    expect(whItem.status).toBe('Actif');
    expect(whItem.rattachement_type).toBe('MACHINE');
    expect(whItem.id_machine_registered).toBe('EXT-01');

    const ledgerItem = useGmaoStore.getState().machineElementsLedger[0];
    expect(ledgerItem.heures_actuelles).toBe(0);
    expect(ledgerItem.statut).toBe('OPERATIONNEL');
    expect(ledgerItem.date_installation).toBe('2026-03-10');

    // 5. Verify evaluateComponentWearAndLifecycle does NOT double-count the synced bobinage
    const health = evaluateComponentWearAndLifecycle(whItem, {
      correctiveInterventions: [],
      preventiveExecutions: [],
      sortiesExterne: useGmaoStore.getState().sortiesExterne,
    });
    expect(health.bobinageCount).toBe(1);
    expect(health.externalCost).toBe(2100);
  });
});
