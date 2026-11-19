import { beforeEach, describe, expect, it } from 'vitest';
import {
  AuditRepo,
  CorrectiveRepo,
  FinanceRepo,
  MachineRepo,
  PersonnelRepo,
  PreventiveRepo,
  StockRepo,
  WarehouseRepo,
  type CorrectiveInterventionRefLike,
  type PreventiveTaskRefLike,
} from '../index';
import { DataGateway } from '../../DataGateway';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { storageService } from '../../../utils/storageService';
import { buildEffectivePiecesList } from '../../../presentation/pages/corrective/hooks/useInterventionLiveController';

describe('Domain Repositories & DataGateway Delegation (Phase 3)', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(STORAGE_KEYS).forEach((key) => {
      storageService.removeItem(key);
    });
  });

  it('MachineRepo normalizes hierarchy/asset_level and DataGateway delegates saveMachines cleanly', () => {
    const saved = DataGateway.saveMachines([
      {
        id: 'M-LINE-1',
        id_machine_registered: 'M-LINE-1',
        designation: 'Ligne Extrusion 1',
        asset_level: 'LINE',
      } as any,
      {
        id: 'M-001',
        id_machine_registered: 'M-001',
        designation: 'Extrudeuse Principale',
        parent_id: 'M-LINE-1',
        asset_level: 'MACHINE',
      } as any,
    ]);

    expect(saved).toHaveLength(2);
    expect(saved[0].asset_level).toBe('LINE');
    expect(saved[1].parent_id).toBe('M-LINE-1');
    const persisted = storageService.getItem<Array<{ id: string }>>(STORAGE_KEYS.MACHINES, []);
    expect(persisted.map((m) => m.id)).toEqual(['M-LINE-1', 'M-001']);
  });

  it('StockRepo persists stock, builds initialStockMap, and filters orphan refs in strict saveMouvements', () => {
    const stock = StockRepo.saveStock([
      { ref: 'PDR-001', designation: 'Roulement SKF 6204', stockInitial: 10 } as any,
    ]);
    expect(stock).toHaveLength(1);
    const persisted = storageService.getItem<Array<{ ref: string }>>(STORAGE_KEYS.RAW_STOCK, []);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].ref).toBe('PDR-001');

    const savedMvts = StockRepo.saveMouvements(
      [
        { id: 'M-1', ref: 'PDR-001', type: 'SORTIE', quantite: 2 },
        { id: 'M-ORPHAN', ref: 'PDR-999', type: 'SORTIE', quantite: 1 },
      ],
      { stock, strict: true }
    );
    expect(savedMvts.map((m) => m.id)).toEqual(['M-1']);
  });

  it('PreventiveRepo and CorrectiveRepo tag orphan machine refs and filter them out in strict mode', () => {
    const machines = MachineRepo.saveMachines([
      { id: 'M-001', id_machine_registered: 'M-001', designation: 'Presse 1' } as any,
    ]);

    const pmInputs: PreventiveTaskRefLike[] = [
      { id: 'PM-1', code_machine: 'M-001', action: 'Graissage' },
      { id: 'PM-ORPHAN', code_machine: 'M-999', action: 'Contrôle' },
    ];
    const pmResult = PreventiveRepo.savePreventiveTasks(pmInputs, { machines });
    expect(pmResult.orphanCount).toBe(1);
    expect(pmResult.saved.find((t) => t.id === 'PM-1')?._isOrphan).toBe(false);
    expect(pmResult.saved.find((t) => t.id === 'PM-ORPHAN')?._isOrphan).toBe(true);

    const pmStrict = PreventiveRepo.savePreventiveTasks(
      [
        { id: 'PM-1', code_machine: 'M-001', action: 'Graissage' },
        { id: 'PM-BAD', code_machine: 'M-999', action: 'Contrôle' },
      ] as PreventiveTaskRefLike[],
      { machines, strict: true }
    );
    expect(pmStrict.orphanCount).toBe(1);
    expect(pmStrict.saved.map((t) => t.id)).toEqual(['PM-1']);

    const cmInputs: CorrectiveInterventionRefLike[] = [
      { id: 'BT-1', code_machine: 'M-001', anomalie: 'Fuite' },
      { id: 'BT-ORPHAN', code_machine: 'M-999', anomalie: 'Bruit' },
    ];
    const cmResult = CorrectiveRepo.saveCorrectiveInterventions(cmInputs, { machines });
    expect(cmResult.orphanCount).toBe(1);
    expect(cmResult.saved.find((i) => i.id === 'BT-1')?._isOrphan).toBe(false);
    expect(cmResult.saved.find((i) => i.id === 'BT-ORPHAN')?._isOrphan).toBe(true);
  });

  it('AuditRepo persists append-only frozen events and FinanceRepo records budget audit events', () => {
    const updated = FinanceRepo.saveFinancialBudget(
      {
        fiscalYear: 2026,
        allocatedPreventive: 50000,
        allocatedCorrective: 75000,
        allocatedSparesStock: 40000,
        allocatedExternal: 15000,
      },
      'ADMIN_TEST'
    );

    expect(updated.fiscalYear).toBe(2026);
    expect(
      updated.allocatedPreventive +
        updated.allocatedCorrective +
        updated.allocatedSparesStock +
        updated.allocatedExternal
    ).toBe(180000);

    const { event } = AuditRepo.appendAuditEvent({
      actorName: 'ADMIN_TEST',
      actionType: 'FINANCIAL_BUDGET_UPDATED',
      entityType: 'FINANCIAL_BUDGET',
      entityId: 'FY-2026',
      before: null,
      after: { totalAllocated: 180000 },
    });

    expect(Object.isFrozen(event)).toBe(true);
    expect(event.actionType).toBe('FINANCIAL_BUDGET_UPDATED');
    expect(DataGateway.getAuditEvents().length).toBeGreaterThanOrEqual(1);
  });

  it('WarehouseRepo and PersonnelRepo persist cleanly with zero silent seed reinjection', () => {
    expect(storageService.getItem(STORAGE_KEYS.WAREHOUSE_ITEMS, [])).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.TECHNICIANS, [])).toEqual([]);

    WarehouseRepo.saveWarehouseItems([
      { id_warehouse_item: 'CMP-1', designation: 'Moteur 15kW', item_type: 'COMPOSANT' } as any,
    ]);
    PersonnelRepo.saveTechnicians([
      { id: 'TECH-1', nom: 'Karim', specialite: 'Mécanique' } as any,
    ]);

    expect(storageService.getItem(STORAGE_KEYS.WAREHOUSE_ITEMS, [])).toHaveLength(1);
    expect(storageService.getItem(STORAGE_KEYS.TECHNICIANS, [])).toHaveLength(1);
  });

  it('buildEffectivePiecesList merges pending single PDR input with multi-PDR list without losing quantities', () => {
    const merged = buildEffectivePiecesList({
      travail_a_faire: '',
      action_realisee: '',
      intervention_nature: 'REPLACE',
      pdr_ref: 'PDR-6204',
      pdr_designation: 'Roulement 6204',
      pdr_quantite: 2,
      pdr_prix: 120,
      pdr_unite: 'Pièce',
      marque: 'SKF',
      etat_piece: 'Neuve',
      arret_machine: true,
      temps_arret: '',
      pieces_utilisees: [
        { ref: 'PDR-6204', designation: 'Roulement 6204', quantite: 1, prix_unitaire: 120 },
        { ref: 'PDR-COUR-1', designation: 'Courroie trapézoïdale', quantite: 3, prix_unitaire: 45 },
      ],
      num_bon_saisi_par_tech: '',
      id_composant: '',
      nom_composant: '',
      id_part: '',
      nom_part: '',
      statut_composant_cloture: 'En service',
    });

    expect(merged).toHaveLength(2);
    expect(merged.find((p) => p.ref === 'PDR-6204')?.quantite).toBe(3);
    expect(merged.find((p) => p.ref === 'PDR-COUR-1')?.quantite).toBe(3);
  });
});
