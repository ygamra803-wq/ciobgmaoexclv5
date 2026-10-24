import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionService } from '../../application/services/preventive/ExecutionService';
import { TaskService } from '../../application/services/preventive/TaskService';
import { PlanService } from '../../application/services/preventive/PlanService';
import { PreventiveService } from '../../application/services/PreventiveService';
import {
  buildConsumablePdrInventory,
  applyBlueprintPlanToActiveMachines,
  rankStockItemsByMachineBom,
  buildUnifiedMachineNexusElements,
  buildLedgerEntriesFromBlueprint,
  applyReplacementMovementToLedger,
} from '../../core/domain';
import { buildConsumablePdrInventory as reExportedBuildConsumablePdrInventory } from '../../presentation/pages/preventive/components/TabMainView';
import { CorrectiveIntervention } from '../../domain/corrective/entities/CorrectiveIntervention';
import { storageService } from '../../utils/storageService';

describe('P0–P5 Core (alias Phase P7): Consumable PDR Truth, Organe FKs, Part Localization & Semi-Hierarchical BOM (ADR-09)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    storageService.clearCache?.();
  });

  it('P1: propagates id_composant, nom_composant, id_part, and nom_part from PreventiveTask to PreventiveExecutionRecord', () => {
    const taskWithComponentAndPart = {
      id: 'TASK-P7-001',
      code: 'PRV-DET01-MOT01',
      id_machine: 'DET-01',
      nom_machine: 'Détoureuse 01',
      id_zone: 'Détourage',
      composant: 'Moteur Asynchrone 10A (mot 01)',
      id_composant: 'mot 01',
      nom_composant: 'Moteur Asynchrone 10A (mot 01)',
      id_part: 'PART-PALIER-AV',
      nom_part: 'Palier Avant Broche',
      action_code: 'G',
      frequence: 'Mensuel',
      responsable: 'Rachid',
    };

    TaskService.saveTasks([taskWithComponentAndPart]);

    const updatedTasks = TaskService.markTaskAsDone('TASK-P7-001', {
      date_realisation: '2026-10-22',
      technicien: 'Rachid',
      durationMinutes: 30,
      laborRate: 40,
      usedPDR: [
        { ref: 'ROUL-6205-2RS', designation: 'Roulement SKF 6205-2RS', qty: 1, unitPrice: 28, unit: 'Pièce' },
      ],
    });

    const updatedTask = updatedTasks.find((t: any) => t.id === 'TASK-P7-001');
    expect(updatedTask).toBeDefined();
    expect(updatedTask.etat).toBe('Fait');
    expect(updatedTask.id_composant).toBe('mot 01');
    expect(updatedTask.nom_composant).toBe('Moteur Asynchrone 10A (mot 01)');
    expect(updatedTask.id_part).toBe('PART-PALIER-AV');
    expect(updatedTask.nom_part).toBe('Palier Avant Broche');

    const executions = ExecutionService.getExecutions();
    expect(executions.length).toBe(1);
    const exec = executions[0];
    expect(exec.taskId).toBe('TASK-P7-001');
    expect(exec.machineCode).toBe('DET-01');
    expect(exec.organe).toBe('Moteur Asynchrone 10A (mot 01)');
    expect(exec.id_composant).toBe('mot 01');
    expect(exec.nom_composant).toBe('Moteur Asynchrone 10A (mot 01)');
    expect(exec.id_part).toBe('PART-PALIER-AV');
    expect(exec.nom_part).toBe('Palier Avant Broche');
    expect(exec.sparesCost).toBe(28);
  });

  it('P1: preserves id_composant, id_part, and pdr_requises when generating tasks via PlanService.createPlanWithTasks', () => {
    const result = PlanService.createPlanWithTasks(
      {
        id_machine: 'PRH-02',
        nom_machine: 'Presse Hydraulique 02',
        id_zone: 'PRH',
        id_technicien: 'Karim',
        semaine_cible: 'S4',
      },
      [
        {
          composant: 'Pompe Hydraulique Principale',
          id_composant: 'COMP-PMP-02',
          nom_composant: 'Pompe Hydraulique Principale',
          id_part: 'PART-DISTRIB-01',
          nom_part: 'Distributeur Proportionnel',
          action_code: 'V',
          frequence: 'Trimestriel',
          duree_estimee: '45 min',
          pdr_requises: [
            { ref: 'KIT-JOINT-PRH', nom: 'Kit Joints Pompe PRH', quantite: 2 },
          ],
        },
      ]
    );

    expect(result.tasks.length).toBe(1);
    const createdTask = result.tasks[0];
    expect(createdTask.id_machine).toBe('PRH-02');
    expect(createdTask.id_composant).toBe('COMP-PMP-02');
    expect(createdTask.nom_composant).toBe('Pompe Hydraulique Principale');
    expect(createdTask.id_part).toBe('PART-DISTRIB-01');
    expect(createdTask.nom_part).toBe('Distributeur Proportionnel');
    expect(createdTask.pdr_requises).toEqual([
      {
        ref: 'KIT-JOINT-PRH',
        nom: 'Kit Joints Pompe PRH',
        designation: 'Kit Joints Pompe PRH',
        quantite: 2,
      },
    ]);
    expect(createdTask.pdr_ref).toBe('KIT-JOINT-PRH');
  });

  it('P5: prioritizes explicit task.pdr_requises in PreventiveService.getRecommendedPDRForAction', () => {
    const task = {
      id: 'TASK-P7-002',
      action_code: 'R',
      composant: 'Broche UGV',
      pdr_requises: [
        { ref: 'ROUL-7008-C', nom: 'Roulement Broche 7008C', quantite: 2, prix_unitaire: 120 },
      ],
    };

    const recommended = PreventiveService.getRecommendedPDRForAction('R', 'Broche UGV', task);
    expect(recommended.length).toBeGreaterThanOrEqual(1);
    expect(recommended[0].ref).toBe('ROUL-7008-C');
    expect(recommended[0].quantite).toBe(2);
    expect(recommended[0].prix_unitaire).toBe(120);
  });

  it('P0: strictly filters availableInventory to consumable PDR stockItems and excludes COMPONENT / PART items', () => {
    const mixedInput = [
      {
        ref: 'ROUL-6204',
        designation: 'Roulement 6204-2RS',
        stockActuel: 14,
        unite: 'pcs',
        prix_unitaire: 18.5,
      },
      {
        ref: 'COUR-SPA-1250',
        designation: 'Courroie Trapézoïdale SPA 1250',
        stockActuel: 6,
        unite: 'pcs',
        prix_unitaire: 32,
      },
      // Non-consumable rotatable component (must NEVER appear in consumable PDR deduction list)
      {
        id_warehouse_item: 'mot 01',
        ref: 'REF-10A111-NA',
        designation: 'Moteur Asynchrone 10A (mot 01)',
        nature: 'COMPONENT',
        stockActuel: 1,
      },
      // Non-consumable structural machine part (must NEVER appear in consumable PDR deduction list)
      {
        id_warehouse_item: 'PART-MANDRIN-01',
        ref: 'PART-MANDRIN-01',
        designation: 'Mandrin Hydraulique 3 Mors',
        nature: 'PART',
        stockActuel: 1,
      },
      // Legacy French category markers & warehouse item without explicit nature (must ALSO be excluded)
      {
        ref: 'LEG-COMP-01',
        designation: 'Réducteur Legacy',
        category: 'COMPOSANT',
        stockActuel: 1,
      },
      {
        id_warehouse_item: 'WH-NO-NATURE-01',
        ref: 'WH-NO-NATURE-01',
        designation: 'Élément Entrepôt Sans Nature',
        stockActuel: 1,
      },
    ];

    const consumableInventory = buildConsumablePdrInventory(mixedInput);
    expect(reExportedBuildConsumablePdrInventory).toBe(buildConsumablePdrInventory);

    expect(consumableInventory.length).toBe(2);
    expect(consumableInventory.map((i) => i.ref)).toEqual(['ROUL-6204', 'COUR-SPA-1250']);
    expect(consumableInventory.every((i) => i.source === 'PDR Magasin')).toBe(true);
    expect(consumableInventory.some((i) => i.ref === 'REF-10A111-NA')).toBe(false);
    expect(consumableInventory.some((i) => i.ref === 'PART-MANDRIN-01')).toBe(false);
    expect(consumableInventory.some((i) => i.ref === 'LEG-COMP-01')).toBe(false);
    expect(consumableInventory.some((i) => i.ref === 'WH-NO-NATURE-01')).toBe(false);
  });

  it('P2: rankStockItemsByMachineBom ranks Component BOM first, Machine/Blueprint BOM second, and general warehouse third without hiding items', () => {
    const stockItems = [
      { ref: 'GEN-VIS-M8', designation: 'Vis CHC M8', stockActuel: 100 },
      { ref: 'BP-COUR-HTD', designation: 'Courroie HTD 8M', stockActuel: 4 },
      { ref: 'COMP-ROUL-6306', designation: 'Roulement Broche 6306', stockActuel: 8 },
    ];
    const machines = [
      {
        id_machine_registered: 'CNC-01',
        code_machine: 'CNC-01',
        id_blueprint: 'BPT-CNC',
      },
    ];
    const blueprints = [
      {
        id_blueprint: 'BPT-CNC',
        pdr_theoriques: [
          { id_pdr: 'BP-COUR-HTD', libelle: 'Courroie HTD 8M', qte: 1 },
          {
            id_pdr: 'COMP-ROUL-6306',
            libelle: 'Roulement Broche 6306',
            qte: 2,
            parent_component_key: 'Broche Principale',
          },
        ],
      },
    ];

    const ranked = rankStockItemsByMachineBom(
      'CNC-01',
      stockItems,
      machines,
      blueprints,
      'Broche Principale'
    );

    expect(ranked.length).toBe(3);
    expect(ranked[0].ref).toBe('COMP-ROUL-6306');
    expect(ranked[0].bomPriority).toBe(1);
    expect(ranked[0].isBomRecommended).toBe(true);

    expect(ranked[1].ref).toBe('BP-COUR-HTD');
    expect(ranked[1].bomPriority).toBe(2);
    expect(ranked[1].isBomRecommended).toBe(true);

    expect(ranked[2].ref).toBe('GEN-VIS-M8');
    expect(ranked[2].bomPriority).toBe(3);
    expect(ranked[2].isBomRecommended).toBe(false);
  });

  it('P3: CorrectiveIntervention preserves both id_composant / nom_composant and structural localization id_part / nom_part', () => {
    const ci = new CorrectiveIntervention({
      id: 'DI-901',
      code_machine: 'TRR-11',
      id_composant: 'COMP-MOT-11',
      nom_composant: 'Moteur Broche 15kW',
      id_part: 'PART-POUPEE-FIXE',
      nom_part: 'Poupée Fixe',
      statut_composant_cloture: 'En service',
      anomalie: 'Échauffement palier',
      statut: 'CLOTURE',
      action_fermee: 'OUI',
    }).toJSON();

    expect(ci.id_composant).toBe('COMP-MOT-11');
    expect(ci.nom_composant).toBe('Moteur Broche 15kW');
    expect(ci.id_part).toBe('PART-POUPEE-FIXE');
    expect(ci.nom_part).toBe('Poupée Fixe');
    expect(ci.statut_composant_cloture).toBe('En service');
  });

  it('P4 & P5: applyBlueprintPlanToActiveMachines resolves installed id_composant from warehouseItems and inherits pdr_requises from semi-hierarchical BOM', () => {
    const blueprint = {
      id_blueprint: 'BPT-DET-100',
      libelle: 'Plan Détoureuse CNC',
      components_theoriques: [{ id_component: 'COMP-BROCHE', libelle: 'Broche Principale' }],
      pdr_theoriques: [
        {
          id_pdr: 'ROUL-7006',
          libelle: 'Roulement Céramique 7006',
          qte: 2,
          parent_component_key: 'Broche Principale',
        },
      ],
      preventivePlanItems: [
        {
          id: 'PM-ITEM-1',
          composant: 'Broche Principale',
          component_ref: 'Broche Principale',
          action_code: 'G',
          frequence: 'Mensuel',
          duree_min: 20,
          description: 'Graissage roulements broche',
        },
      ],
    };

    const machines = [
      {
        id_machine_registered: 'DET-01',
        code_machine: 'DET-01',
        designation: 'Détoureuse 01',
        id_blueprint: 'BPT-DET-100',
        statut: 'Opérationnelle',
      },
    ];

    const warehouseItems = [
      {
        id_warehouse_item: 'WH-COMP-BROCHE-01',
        designation: 'Broche Principale',
        nature: 'COMPONENT',
        id_machine_registered: 'DET-01',
        status: 'En service',
      },
    ];

    const res = applyBlueprintPlanToActiveMachines(blueprint, machines, [], warehouseItems);
    expect(res.addedCount).toBe(1);
    const generatedTask = res.addedTasks[0];
    expect(generatedTask.id_machine).toBe('DET-01');
    expect(generatedTask.id_composant).toBe('WH-COMP-BROCHE-01');
    expect(generatedTask.nom_composant).toBe('Broche Principale');
    expect(generatedTask.pdr_requises).toEqual([
      {
        ref: 'ROUL-7006',
        nom: 'Roulement Céramique 7006',
        designation: 'Roulement Céramique 7006',
        quantite: 2,
      },
    ]);
    expect(generatedTask.pdr_ref).toBe('ROUL-7006');
  });

  it('N1: rankStockItemsByMachineBom promotes consumable PDRs from machineElementsLedger (Nexus) and ignores non-PDR ledger entries', () => {
    const stockItems = [
      { ref: 'GEN-BOULON-M10', designation: 'Boulon M10', stockActuel: 50 },
      { ref: 'NEX-COURROIE-A42', designation: 'Courroie A42 Nexus', stockActuel: 5 },
      { ref: 'NEX-ROUL-PALIER', designation: 'Roulement Palier Broche', stockActuel: 3 },
      { ref: 'COMP-MOT-01', designation: 'Moteur Principal', stockActuel: 1 },
    ];
    const machines = [{ id_machine_registered: 'DET-01', code_machine: 'DET-01' }];
    const machineElementsLedger = [
      {
        id: 'BOM-1',
        id_machine_registered: 'DET-01',
        element_type: 'PDR',
        ref_element: 'NEX-COURROIE-A42',
        emplacement_machine: 'Transmission générale',
      },
      {
        id: 'BOM-2',
        id_machine_registered: 'DET-01',
        element_type: 'PDR',
        ref_element: 'NEX-ROUL-PALIER',
        emplacement_machine: 'Broche Principale',
      },
      {
        id: 'BOM-3',
        id_machine_registered: 'DET-01',
        element_type: 'COMPONENT',
        ref_element: 'COMP-MOT-01',
        emplacement_machine: 'Broche Principale',
      },
    ];

    const ranked = rankStockItemsByMachineBom(
      'DET-01',
      stockItems,
      machines,
      [],
      'Broche Principale',
      undefined,
      machineElementsLedger
    );

    expect(ranked[0].ref).toBe('NEX-ROUL-PALIER');
    expect(ranked[0].bomPriority).toBe(1);
    expect(ranked[0].isBomRecommended).toBe(true);

    expect(ranked[1].ref).toBe('NEX-COURROIE-A42');
    expect(ranked[1].bomPriority).toBe(2);
    expect(ranked[1].isBomRecommended).toBe(true);
    expect(ranked[1].bomSourceLabel).toBe('BOM Machine / Nexus');

    // COMPONENT entry in ledger is never promoted as consumable PDR
    const compItem = ranked.find((i) => i.ref === 'COMP-MOT-01');
    expect(compItem?.isBomRecommended).toBe(false);
    expect(compItem?.bomPriority).toBe(3);
  });

  it('N2: buildUnifiedMachineNexusElements combines ledger items with mounted warehouseItems (MONTE / En service) without duplicating refs or including reserve items', () => {
    const ledger = [
      {
        id: 'BOM-LEDGER-1',
        id_machine_registered: 'DET-01',
        element_type: 'PDR',
        ref_element: 'ROUL-6204',
        designation: 'Roulement SKF 6204',
        qte_montee: 2,
        statut: 'OPERATIONNEL',
      },
    ];
    const warehouseItems = [
      {
        id_warehouse_item: 'MOT-01',
        designation: 'Moteur Broche 10kW',
        nature: 'COMPONENT',
        rattachement_type: 'MACHINE',
        id_machine_registered: 'DET-01',
        status: 'En service',
        emplacement: 'Tête de coupe',
      },
      {
        id_warehouse_item: 'PART-MANDRIN-01',
        designation: 'Mandrin Pneumatique',
        nature: 'PART',
        rattachement_type: 'MACHINE',
        id_machine_registered: 'DET-01',
        status: 'MONTE',
      },
      // Unmounted / in-reserve item on same machine code must NOT appear in As-Built live view
      {
        id_warehouse_item: 'MOT-RESERVE-02',
        designation: 'Moteur de secours',
        nature: 'COMPONENT',
        id_machine_registered: 'DET-01',
        status: 'En stock réserve',
      },
      // Duplicate ref already in ledger must NOT produce a second row
      {
        id_warehouse_item: 'ROUL-6204',
        designation: 'Roulement SKF 6204 Duplicate',
        nature: 'PART',
        id_machine_registered: 'DET-01',
        status: 'En service',
      },
    ];

    const unified = buildUnifiedMachineNexusElements('DET-01', ledger, warehouseItems);
    expect(unified.length).toBe(3);
    expect(unified.map((u) => u.ref_element)).toEqual(['ROUL-6204', 'MOT-01', 'PART-MANDRIN-01']);

    const ledgerRow = unified.find((u) => u.ref_element === 'ROUL-6204');
    expect(ledgerRow?._source).toBe('LEDGER');

    const compRow = unified.find((u) => u.ref_element === 'MOT-01');
    expect(compRow?._source).toBe('ENTREPOT');
    expect(compRow?.element_type).toBe('COMPONENT');
    expect(compRow?.emplacement_machine).toBe('Tête de coupe');

    const partRow = unified.find((u) => u.ref_element === 'PART-MANDRIN-01');
    expect(partRow?._source).toBe('ENTREPOT');
    expect(partRow?.element_type).toBe('PART');
  });

  it('N3: buildLedgerEntriesFromBlueprint generates missing COMPONENT, PART, and PDR entries from Blueprint without duplicating existing machine+ref rows', () => {
    const machine = {
      id_machine_registered: 'CNC-01',
      code_machine: 'CNC-01',
      designation: 'Fraiseuse CNC 01',
      id_blueprint: 'BPT-CNC-01',
    };
    const blueprint = {
      id_blueprint: 'BPT-CNC-01',
      components_theoriques: [
        { id_component: 'COMP-BROCHE', libelle: 'Broche UGV 18k', qte: 1, criticite: 'Critique' },
      ],
      parts_theoriques: [
        { id_part: 'PART-BATI-Z', libelle: 'Colonne Axe Z', qte: 1 },
      ],
      pdr_theoriques: [
        {
          id_pdr: 'ROUL-7008C',
          libelle: 'Roulement Céramique 7008C',
          qte: 2,
          parent_component_key: 'Broche UGV 18k',
          duree_vie_heures: 4000,
        },
        {
          id_pdr: 'COUR-HTD-8M',
          libelle: 'Courroie Synchrone HTD 8M',
          qte: 1,
        },
      ],
    };

    const existingLedger = [
      {
        id: 'EXISTING-1',
        id_machine_registered: 'CNC-01',
        element_type: 'PDR' as const,
        ref_element: 'COUR-HTD-8M',
        designation: 'Courroie Synchrone HTD 8M',
        emplacement_machine: 'Axe Z',
        qte_montee: 1,
        date_installation: '2026-01-10',
        heures_actuelles: 1200,
        mtbf_cible_heures: 5000,
        statut: 'OPERATIONNEL' as const,
      },
    ];

    const res = buildLedgerEntriesFromBlueprint(machine, blueprint, existingLedger, []);
    expect(res.skippedCount).toBe(1);
    expect(res.addedEntries.length).toBe(3);
    expect(res.blueprintId).toBe('BPT-CNC-01');

    const compEntry = res.addedEntries.find((e) => e.ref_element === 'COMP-BROCHE');
    expect(compEntry?.element_type).toBe('COMPONENT');
    expect(compEntry?.designation).toBe('Broche UGV 18k');
    expect(compEntry?.id_machine_registered).toBe('CNC-01');

    const partEntry = res.addedEntries.find((e) => e.ref_element === 'PART-BATI-Z');
    expect(partEntry?.element_type).toBe('PART');

    const pdrEntry = res.addedEntries.find((e) => e.ref_element === 'ROUL-7008C');
    expect(pdrEntry?.element_type).toBe('PDR');
    expect(pdrEntry?.qte_montee).toBe(2);
    expect(pdrEntry?.parent_component_key).toBe('Broche UGV 18k');
    expect(pdrEntry?.emplacement_machine).toBe('Broche UGV 18k');
    expect(pdrEntry?.duree_vie_estimee_heures).toBe(5000);

    // Second invocation with merged ledger adds 0 entries
    const secondRun = buildLedgerEntriesFromBlueprint(
      machine,
      blueprint,
      [...existingLedger, ...res.addedEntries],
      []
    );
    expect(secondRun.addedEntries.length).toBe(0);
    expect(secondRun.skippedCount).toBe(4);
  });

  it('N4: applyReplacementMovementToLedger resets heures_actuelles, date_installation, and statut on matching machine PDR row after a Sortie movement', () => {
    const ledger = [
      {
        id: 'BOM-ROUL-01',
        id_machine_registered: 'CNC-01',
        element_type: 'PDR' as const,
        ref_element: 'ROUL-7008C',
        designation: 'Roulement Céramique 7008C',
        emplacement_machine: 'Broche UGV 18k',
        qte_montee: 2,
        date_installation: '2025-05-01',
        heures_actuelles: 3950,
        mtbf_cible_heures: 4000,
        statut: 'A_REMPLACER' as const,
      },
      {
        id: 'BOM-OTHER-MACHINE',
        id_machine_registered: 'CNC-02',
        element_type: 'PDR' as const,
        ref_element: 'ROUL-7008C',
        designation: 'Roulement Céramique 7008C',
        emplacement_machine: 'Broche UGV 18k',
        qte_montee: 2,
        date_installation: '2025-05-01',
        heures_actuelles: 1500,
        mtbf_cible_heures: 4000,
        statut: 'OPERATIONNEL' as const,
      },
    ];

    const res = applyReplacementMovementToLedger(ledger, {
      id_machine_registered: 'CNC-01',
      ref: 'roul-7008c',
      date: '2026-10-24',
      technicien: 'Karim',
    });

    expect(res.updatedElement?.id).toBe('BOM-ROUL-01');
    const updatedTarget = res.updatedLedger.find((e) => e.id === 'BOM-ROUL-01');
    expect(updatedTarget?.heures_actuelles).toBe(0);
    expect(updatedTarget?.date_installation).toBe('2026-10-24');
    expect(updatedTarget?.technicien).toBe('Karim');
    expect(updatedTarget?.statut).toBe('OPERATIONNEL');

    // Other machine's row remains untouched
    const otherMachineRow = res.updatedLedger.find((e) => e.id === 'BOM-OTHER-MACHINE');
    expect(otherMachineRow?.heures_actuelles).toBe(1500);
    expect(otherMachineRow?.date_installation).toBe('2025-05-01');
  });
});



