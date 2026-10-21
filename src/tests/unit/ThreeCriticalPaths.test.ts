import { describe, it, expect, beforeEach } from 'vitest';
import { DataGateway } from '../../application/DataGateway';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import { loadCollection } from '../../infrastructure/persistence/migrateStorage';
import { syncMovementsToIndex, calculateStockItems } from '../../hooks/useAppCalculations';
import { stockIndexStore } from '../../application/StockIndexStore';
import { filterActiveMachines, getActiveMachineCodes } from '../../utils/activeMachines';
import seedStockItems from '../../data/stock/seedStockItems.json';
import seedMouvements from '../../data/movements/seedMouvements.json';
import seedCorrectiveInterventions from '../../data/corrective/seedCorrectiveInterventions.json';

describe('Five-Point Critical GMAO Verification Suite', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    DataGateway.clearAllForRealFactory();
  });

  // Path 1: stockInitial + entrées − sorties on seed sample & demo tour coherence
  it('1) computes stockActuel = stockInitial + entrées - sorties accurately on seed data and surfaces ALERTE & RUPTURE across 102 movements and 12 corrective interventions', () => {
    expect(seedMouvements.length).toBe(102);
    expect(seedCorrectiveInterventions.length).toBe(12);

    // Ensure no corrective intervention is mislabeled as "préventive"
    const mislabeled = seedCorrectiveInterventions.filter(
      (c: any) => String(c.travail_a_faire || '').toLowerCase() === 'préventive'
    );
    expect(mislabeled).toHaveLength(0);

    // Verify all movement refs and corrective pdr_refs exist in stock
    const stockRefSet = new Set(
      seedStockItems.map((s: any) => String(s.ref || '').trim().toUpperCase())
    );
    for (const mov of seedMouvements as any[]) {
      expect(stockRefSet.has(String(mov.ref || '').trim().toUpperCase())).toBe(true);
    }
    for (const corr of seedCorrectiveInterventions as any[]) {
      if (corr.pdr_ref) {
        expect(stockRefSet.has(String(corr.pdr_ref).trim().toUpperCase())).toBe(true);
      }
    }

    // Rebuild index and calculate stock items
    stockIndexStore.reset();
    syncMovementsToIndex(seedMouvements as any[]);
    const computedStock = calculateStockItems(seedStockItems as any[], seedMouvements as any[]);

    expect(computedStock.length).toBe(seedStockItems.length);

    // Verify mathematical equation: stockActuel === stockInitial + entrees - sorties on sample items
    const sampleRefs = ['Raccord01', 'Raccord03', 'Distributeur05', 'Courroie21', 'paliers01'];
    for (const ref of sampleRefs) {
      const item = computedStock.find(
        (s: any) => String(s.ref).trim().toUpperCase() === ref.toUpperCase()
      );
      expect(item).toBeDefined();
      expect(item.stockActuel).toBe(item.stockInitial + item.entrees - item.sorties);
    }

    const ruptures = computedStock.filter((s: any) => s.alerte === 'RUPTURE');
    const alertes = computedStock.filter((s: any) => s.alerte === 'ALERTE');
    expect(ruptures.length).toBeGreaterThan(0);
    expect(alertes.length).toBeGreaterThan(0);
  });

  // Path 2: clearAll -> canonical + legacy Preventive keys = empty (and stay empty after F5)
  it('2) clears all canonical and legacy Preventive keys on clearAllForRealFactory and keeps Preventive, Stock, Movements, and Corrective empty after F5', () => {
    // Load Demo first
    DataGateway.loadDemoData();
    // Simulate legacy preventive keys
    localStorage.setItem('gmao_preventive_tasks_v8', JSON.stringify([{ id: 'OLD-1' }]));
    localStorage.setItem('gmao_preventive_tasks', JSON.stringify([{ id: 'OLD-2' }]));
    localStorage.setItem('gmao_preventive_plans', JSON.stringify([{ id: 'OLD-PLAN' }]));

    // Clear all for real factory
    DataGateway.clearAllForRealFactory();

    // Canonical keys must be empty arrays []
    expect(storageService.getItem(STORAGE_KEYS.PREVENTIVE_TASKS, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.PREVENTIVE_ACTIONS, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.PREVENTIVE_GUIDES, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.PREVENTIVE_PLANS, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.RAW_STOCK, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.MOUVEMENTS, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, null)).toEqual([]);

    // Legacy keys must be completely removed (null)
    expect(localStorage.getItem('gmao_preventive_tasks_v8')).toBeNull();
    expect(localStorage.getItem('gmao_preventive_tasks')).toBeNull();
    expect(localStorage.getItem('gmao_preventive_plans')).toBeNull();

    // Simulate F5 reload via loadCollection with non-empty fallback seeds
    expect(loadCollection(STORAGE_KEYS.PREVENTIVE_TASKS, [{ id: 'SEED-1' }])).toEqual([]);
    expect(loadCollection(STORAGE_KEYS.RAW_STOCK, [{ ref: 'SEED-STOCK' }])).toEqual([]);
    expect(loadCollection(STORAGE_KEYS.MOUVEMENTS, [{ id: 'SEED-MOV' }])).toEqual([]);
    expect(loadCollection(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, [{ id: 'SEED-CORR' }])).toEqual([]);
  });

  // Path 3: Archived machine never appears in new task creation lists
  it('3) excludes archived and inactive machines from new task creation selectors', () => {
    const machines = [
      { id_machine_registered: 'DET-05', nom: 'Détecteur 05', statut: 'En service', is_active: true },
      { id_machine_registered: 'DET-08', nom: 'Détecteur 08 (Archivée)', statut: 'Archivée', is_active: true },
      { id_machine_registered: 'PCE-01', nom: 'Presse 01 (ARCHIVEE)', status: 'ARCHIVEE', is_active: true },
      { id_machine_registered: 'FRL-01', nom: 'FRL 01 (Inactive)', statut: 'En service', is_active: false },
      { id_machine_registered: 'FRL-02', nom: 'FRL 02 (Active)', statut: 'Opérationnelle', actif: true },
    ];

    const activeList = filterActiveMachines(machines);
    const activeCodes = getActiveMachineCodes(machines);

    expect(activeList).toHaveLength(2);
    expect(activeCodes).toEqual(['DET-05', 'FRL-02']);
    expect(activeCodes).not.toContain('DET-08');
    expect(activeCodes).not.toContain('PCE-01');
    expect(activeCodes).not.toContain('FRL-01');
  });

  // Path 4: Operational collections (Preventive Tasks, Corrective Interventions, Sorties Externe, Executions) never auto-fallback on startup
  it('4) enforces allowDemoFallback: false for operational slices (PREVENTIVE_TASKS, CORRECTIVE_INTERVENTIONS, SORTIE_EXTERNE, PREVENTIVE_EXECUTIONS) until explicit loadDemoData', () => {
    localStorage.clear();
    // Even if a stale DEMO_MODE=true flag exists in storage without actual collection data:
    storageService.setItem(STORAGE_KEYS.DEMO_MODE, true);
    storageService.setItem(STORAGE_KEYS.START_MODE, 'demo');

    expect(
      loadCollection(STORAGE_KEYS.PREVENTIVE_TASKS, { allowDemoFallback: false, demoSeed: [] })
    ).toEqual([]);
    expect(
      loadCollection(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, { allowDemoFallback: false, demoSeed: [] })
    ).toEqual([]);
    expect(
      loadCollection(STORAGE_KEYS.SORTIE_EXTERNE, { allowDemoFallback: false, demoSeed: [] })
    ).toEqual([]);
    expect(
      loadCollection(STORAGE_KEYS.PREVENTIVE_EXECUTIONS, { allowDemoFallback: false, demoSeed: [] })
    ).toEqual([]);
    expect(
      loadCollection(STORAGE_KEYS.BLUEPRINTS, { allowDemoFallback: false, demoSeed: [] })
    ).toEqual([]);

    // And when machines is empty, filterActiveMachines returns [] (no hardcoded FRM-01 / RCP-02 fallback)
    expect(filterActiveMachines([])).toEqual([]);
  });

  // Path 5: Idempotent Corrective BT Closure & Guarded FSM Transitions (FIX-1)
  it('5) enforces idempotent BT closure (zero duplicate stock movement on re-close) and supports EN_ATTENTE_PDR lifecycle transitions', async () => {
    const { useGmaoStore } = await import('../../store/useGmaoStore');
    const store = useGmaoStore.getState();

    // Create a new DI
    const di = store.handleAddDemandeIntervention({
      code_machine: 'DET-05',
      anomalie: 'Fuite vérin principal',
      type_panne: 'P',
      demandeur: 'Atelier',
    });
    expect(di.statut).toBe('DEMANDE');

    // Convert DI -> BT (EN_COURS)
    const bt = useGmaoStore.getState().handleConvertToBt(di.id, {
      num_bt: 'BT-9901',
      intervenant: 'Technicien Test',
      travail_a_faire: 'Remplacement joint torique',
    });
    expect(bt).not.toBeNull();
    expect(bt.statut).toBe('EN_COURS');

    // Suspend BT -> EN_ATTENTE_PDR, then resume -> EN_COURS
    useGmaoStore.getState().handleUpdateCorrectiveIntervention(di.id, { statut: 'EN_ATTENTE_PDR' });
    const suspended = useGmaoStore.getState().correctiveInterventions.find((i: any) => i.id === di.id);
    expect(suspended?.statut).toBe('EN_ATTENTE_PDR');

    useGmaoStore.getState().handleStartLiveIntervention(di.id);
    const resumed = useGmaoStore.getState().correctiveInterventions.find((i: any) => i.id === di.id);
    expect(resumed?.statut).toBe('EN_COURS');

    // Close BT with PDR consumption
    const recordedMovements: any[] = [];
    const firstClose = useGmaoStore.getState().handleClotureIntervention(
      di.id,
      {
        action_realisee: 'Remplacement joint torique effectué',
        pdr_ref: 'Raccord01',
        pdr_designation: 'Raccord pneumatique 8mm',
        pdr_quantite: 2,
        pdr_prix: 15,
      },
      (mvt: any) => recordedMovements.push(mvt)
    );

    expect(firstClose).not.toBeNull();
    expect(firstClose.statut).toBe('CLOTURE');
    expect(firstClose.action_fermee).toBe('OUI');
    expect(recordedMovements).toHaveLength(1);
    expect(recordedMovements[0].quantite).toBe(2);

    // Attempt to close the same BT a second time -> MUST be rejected (returns null, zero additional movement)
    const secondClose = useGmaoStore.getState().handleClotureIntervention(
      di.id,
      {
        action_realisee: 'Double clôture accidentelle',
        pdr_ref: 'Raccord01',
        pdr_quantite: 2,
      },
      (mvt: any) => recordedMovements.push(mvt)
    );

    expect(secondClose).toBeNull();
    expect(recordedMovements).toHaveLength(1);

    // Attempt to transition closed BT back to EN_COURS via handleUpdateCorrectiveIntervention -> MUST be blocked
    useGmaoStore.getState().handleUpdateCorrectiveIntervention(di.id, { statut: 'EN_COURS' });
    const afterInvalidUpdate = useGmaoStore.getState().correctiveInterventions.find((i: any) => i.id === di.id);
    expect(afterInvalidUpdate?.statut).toBe('CLOTURE');
  });

  // Path 6: Multi-PDR Consumption & Linked Warehouse Component Lifecycle on BT Closure (FIX-3)
  it('6) emits multiple Sortie movements for pieces_utilisees and updates linked warehouse component status on BT closure', async () => {
    const { useGmaoStore } = await import('../../store/useGmaoStore');

    // Seed a warehouse component mounted on TRP-01
    useGmaoStore.getState().setWarehouseItems([
      {
        id_warehouse_item: 'CMP-MOT-TRP01',
        designation: 'Moteur Broche 15kW',
        nature: 'COMPONENT',
        id_machine_registered: 'TRP-01',
        status: 'En service',
      },
    ]);

    const di = useGmaoStore.getState().handleAddDemandeIntervention({
      code_machine: 'TRP-01',
      id_composant: 'CMP-MOT-TRP01',
      anomalie: 'Vibration roulement moteur broche',
      type_panne: 'M',
      demandeur: 'Production',
    });

    useGmaoStore.getState().handleConvertToBt(di.id, {
      num_bt: 'BT-9902',
      intervenant: 'Technicien Senior',
      travail_a_faire: 'Remplacement roulements + courroie',
    });

    const multiMovements: any[] = [];
    const closedBt = useGmaoStore.getState().handleClotureIntervention(
      di.id,
      {
        action_realisee: 'Remplacement de 2 roulements et 1 courroie, dépose moteur en révision',
        id_composant: 'CMP-MOT-TRP01',
        statut_composant_cloture: 'En réparation',
        pieces_utilisees: [
          { ref: 'ROUL-6204', designation: 'Roulement 6204', quantite: 2, prix_unitaire: 45, unite: 'Pièce' },
          { ref: 'COUR-A42', designation: 'Courroie trapézoïdale A42', quantite: 1, prix_unitaire: 30, unite: 'Pièce' },
        ],
      },
      (mvt: any) => multiMovements.push(mvt)
    );

    expect(closedBt).not.toBeNull();
    expect(closedBt.statut).toBe('CLOTURE');
    expect(closedBt.pieces_utilisees).toHaveLength(2);
    expect(closedBt.cout_pdr).toBe(2 * 45 + 1 * 30); // 120
    expect(closedBt.pdr_ref).toBe('ROUL-6204');
    expect(closedBt.pdr_designation).toContain('(+1 réf.)');

    // Verify 2 distinct Sortie movements were emitted
    expect(multiMovements).toHaveLength(2);
    expect(multiMovements[0].ref).toBe('ROUL-6204');
    expect(multiMovements[0].quantite).toBe(2);
    expect(multiMovements[0].code_bon).toBe('BS-BT-BT-9902-1');
    expect(multiMovements[1].ref).toBe('COUR-A42');
    expect(multiMovements[1].quantite).toBe(1);
    expect(multiMovements[1].code_bon).toBe('BS-BT-BT-9902-2');

    // Verify linked warehouse component status was updated
    const updatedComp = useGmaoStore
      .getState()
      .warehouseItems.find((w: any) => w.id_warehouse_item === 'CMP-MOT-TRP01');
    expect(updatedComp?.status).toBe('En réparation');
    expect(updatedComp?.derniere_intervention_bt).toBe('BT-9902');
  });

  // Path 7: Predictive Bridge (Correctif -> Préventif) & Machine Hour-Counter Synchronization (FIX-4)
  it('7) detects recurring corrective anomalies (>=3), generates scheduled preventive tasks, and propagates compteur_releve to the machine and its tasks', async () => {
    const { useGmaoStore } = await import('../../store/useGmaoStore');
    const { CorrectiveCalculationService } = await import(
      '../../domain/corrective/services/CorrectiveCalculationService'
    );

    // 1. Register machine Presse-01
    useGmaoStore.getState().setMachines([
      {
        id_machine_registered: 'PRS-01',
        designation: 'Presse Hydraulique 200T',
        id_zone_default: 'Z-PRESSE',
        status: 'En service',
        compteur_heures: 1200,
      },
    ]);

    // 2. Simulate 3 recurring corrective failures on PRS-01
    const sampleInterventions = [
      { id: 'DI-1', code_machine: 'PRS-01', anomalie: 'surchauffe_huile', zone: 'Z-PRESSE' },
      { id: 'DI-2', code_machine: 'PRS-01', anomalie: 'surchauffe_huile', zone: 'Z-PRESSE' },
      { id: 'DI-3', code_machine: 'PRS-01', anomalie: 'surchauffe_huile', zone: 'Z-PRESSE' },
    ];
    const recs = CorrectiveCalculationService.detectPreventiveRecommendations(sampleInterventions);
    expect(recs).toHaveLength(1);
    expect(recs[0].machine).toBe('PRS-01');
    expect(recs[0].code_machine).toBe('PRS-01');
    expect(recs[0].anomalie).toBe('surchauffe_huile');
    expect(recs[0].count).toBe(3);

    // 3. Create 2 preventive tasks on PRS-01 via handleCreatePlanWithTasks
    const created = useGmaoStore.getState().handleCreatePlanWithTasks(
      {
        id_machine: 'PRS-01',
        nom_machine: 'Presse Hydraulique 200T',
        id_zone: 'Z-PRESSE',
        id_technicien: 'Tech-Hydrau',
        semaine_cible: 'S1',
      },
      [
        {
          composant: 'Contrôle surchauffe huile',
          action_code: 'C',
          frequence: 'Mensuel',
          duree_estimee: '20 min',
          priorite: 'Haute',
        },
        {
          composant: 'Filtre retour hydraulique',
          action_code: 'N',
          frequence: 'Trimestriel',
          duree_estimee: '30 min',
          priorite: 'Normale',
        },
      ]
    );

    expect(created.tasks).toHaveLength(2);
    const task1Id = created.tasks[0].id;
    const task2Id = created.tasks[1].id;

    // 4. Validate task 1 with a new hour-counter reading (compteur_releve: 1450)
    useGmaoStore.getState().handleMarkTaskDone(task1Id, {
      date_realisation: '2026-04-10',
      technicien: 'Tech-Hydrau',
      duree_reelle: '25 min',
      compteur_releve: 1450,
    });

    // Verify both tasks on PRS-01 and the PRS-01 machine record have synchronized counter = 1450
    const prsTasks = useGmaoStore
      .getState()
      .preventiveTasks.filter((t: any) => t.id_machine === 'PRS-01');
    const updatedTask1 = prsTasks.find((t: any) => t.id === task1Id);
    const updatedTask2 = prsTasks.find((t: any) => t.id === task2Id);
    expect(updatedTask1?.etat).toBe('Fait');
    expect(updatedTask1?.dernier_releve).toBe(1450);
    expect(updatedTask2?.dernier_releve).toBe(1450);

    const updatedMachine = useGmaoStore
      .getState()
      .machines.find((m: any) => m.id_machine_registered === 'PRS-01');
    expect(updatedMachine?.compteur_heures).toBe(1450);
    expect(updatedMachine?.dernier_releve_compteur).toBe(1450);
  });
});

