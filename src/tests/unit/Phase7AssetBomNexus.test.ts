import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionService } from '../../application/services/preventive/ExecutionService';
import { TaskService } from '../../application/services/preventive/TaskService';
import { PlanService } from '../../application/services/preventive/PlanService';
import { PreventiveService } from '../../application/services/PreventiveService';
import { buildConsumablePdrInventory } from '../../presentation/pages/preventive/components/TabMainView';
import { storageService } from '../../utils/storageService';

describe('Phase P7.1: Canonical Organe FKs & Strict Consumable PDR Separation (ADR-09)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    storageService.clearCache?.();
  });

  it('propagates id_composant, nom_composant, id_part, and nom_part from PreventiveTask to PreventiveExecutionRecord', () => {
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

  it('preserves id_composant, id_part, and pdr_requises when generating tasks via PlanService.createPlanWithTasks', () => {
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

  it('prioritizes explicit task.pdr_requises in PreventiveService.getRecommendedPDRForAction', () => {
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

  it('strictly filters availableInventory to consumable PDR stockItems and excludes COMPONENT / PART items', () => {
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
    ];

    const consumableInventory = buildConsumablePdrInventory(mixedInput);

    expect(consumableInventory.length).toBe(2);
    expect(consumableInventory.map((i) => i.ref)).toEqual(['ROUL-6204', 'COUR-SPA-1250']);
    expect(consumableInventory.every((i) => i.source === 'PDR Magasin')).toBe(true);
    expect(consumableInventory.some((i) => i.ref === 'REF-10A111-NA')).toBe(false);
    expect(consumableInventory.some((i) => i.ref === 'PART-MANDRIN-01')).toBe(false);
  });
});
