import { describe, it, expect } from 'vitest';
import { MachineEntity } from '../../domain/machines/entities/MachineEntity';
import { SparePartEntity } from '../../domain/pdr/entities/SparePartEntity';
import { TaskEntity } from '../../domain/maintenance/entities/TaskEntity';
import {
  Operation,
  Diagnostic,
  PartType,
  PartDesignation,
  isComponentNature,
  isPartNature,
  isWarehouseComponent,
  isWarehousePart,
} from '../../core/domain';

describe('Domain Entities Unit Tests', () => {
  describe('Operation', () => {
    it('should identify operator and chef profile correctly', () => {
      const op = new Operation({ id_operation: 'OP-01', nom: 'Opérateur Découpe', type_profil: 'OPERATEUR' });
      const chef = new Operation({ id_operation: 'CHEF-01', nom: 'Chef Équipe', type_profil: 'CHEF' });

      expect(op.isOperator()).toBe(true);
      expect(op.isChef()).toBe(false);
      expect(chef.isChef()).toBe(true);
      expect(chef.isOperator()).toBe(false);
    });

    it('should calculate total pieces consumed in sorties', () => {
      const op = new Operation({ id_operation: 'OP-02', nom: 'Opérateur Tour' });
      const mouvements = [
        { operation: 'OP-02', type: 'Sortie Interne', quantite: 3 },
        { operation: 'OP-02', type: 'Sortie', quantite: 2 },
        { operation: 'OP-02', type: 'Entrée', quantite: 10 },
        { operation: 'Autre', type: 'Sortie', quantite: 5 },
      ];

      expect(op.getTotalPiecesConsommees(mouvements)).toBe(5);
    });
  });

  describe('Diagnostic', () => {
    it('should find matching type and stock item', () => {
      const diag = new Diagnostic({
        id_diag: 'DIAG-01',
        ref: 'ROUL-6204',
        designation: 'Roulement 6204',
        id_type: 'ROUL',
      });

      const types = [{ id_type: 'ROUL', nom: 'Roulements' }];
      const stockItems = [{ ref: 'ROUL-6204', stockActuel: 12 }];

      expect(diag.getType(types)?.nom).toBe('Roulements');
      expect(diag.getMatchingStockItem(stockItems)?.stockActuel).toBe(12);
    });

    it('should check if referenced in blueprints', () => {
      const diag = new Diagnostic({ ref: 'COURR-B42' });
      const blueprints = [
        {
          id_blueprint: 'BPT-01',
          pdr_theoriques: [{ id_pdr: 'COURR-B42' }],
        },
      ];

      expect(diag.isReferencedInBlueprints(blueprints)).toBe(true);
      expect(diag.isReferencedInBlueprints([{ pdr_theoriques: [] }])).toBe(false);
    });
  });

  describe('PartType & PartDesignation', () => {
    it('should link part types and designations', () => {
      const partType = new PartType({ id_type: 'ELEC', nom: 'Électrique' });
      const partDesig = new PartDesignation({
        id_designation: 'DESIG-01',
        id_type: 'ELEC',
        nom: 'Contacteur 24V',
      });

      expect(partType.getDesignations([partDesig]).length).toBe(1);
      expect(partDesig.getType([partType])?.nom).toBe('Électrique');
    });
  });

  describe('MachineEntity', () => {

    it('should construct a MachineEntity with valid attributes', () => {
      const machine = new MachineEntity({
        id: 'MCH-01',
        id_machine_registered: 'MCH-01',
        designation: 'Tour Parallèle 01',
        id_family: 'USI',
        id_templates: 'TPL-TRP',
        id_zone_default: 'ZONE-01',
        status: 'En service',
      });

      expect(machine.id).toBe('MCH-01');
      expect(machine.id_machine_registered).toBe('MCH-01');
      expect(machine.designation).toBe('Tour Parallèle 01');
      expect(machine.status).toBe('En service');
    });

    it('should validate status default or custom property', () => {
      const machine = new MachineEntity({
        id: 'MCH-02',
        status: 'En maintenance',
      });
      expect(machine.status).toBe('En maintenance');
    });
  });

  describe('SparePartEntity', () => {
    it('should construct a SparePartEntity and calculate alert status correctly', () => {
      const part = new SparePartEntity({
        id: 'SP-01',
        ref: 'ROUL-6204',
        designation: 'Roulement 6204',
        stockInitial: 10,
        entrees: 0,
        sorties: 8,
        seuil: 5,
        emplacement: 'A1-R2',
      });

      expect(part.ref).toBe('ROUL-6204');
      expect(part.stockActuel).toBe(2);
      expect(part.alerte).toBe('ALERTE');
      expect(part.isLowStock()).toBe(true);
    });

    it('should return RUPTURE when stockActuel <= 0', () => {
      const part = new SparePartEntity({
        stockInitial: 5,
        sorties: 5,
        seuil: 2,
      });
      expect(part.stockActuel).toBe(0);
      expect(part.calculateAlert()).toBe('RUPTURE');
    });
  });

  describe('TaskEntity', () => {
    it('should construct a TaskEntity with action and code_bon', () => {
      const task = new TaskEntity({
        id: 'TSK-01',
        code_bon: 'Bon-001',
        ref: 'ROUL-6204',
        type: 'Sortie Interne',
        action_id: 'CORRECTIVE',
        quantite: 2,
        technicien: 'Rachid',
      });

      expect(task.id).toBe('TSK-01');
      expect(task.code_bon).toBe('Bon-001');
      expect(task.quantite).toBe(2);
      expect(task.action_id).toBe('CORRECTIVE');
    });
  });

  describe('Blueprint (BP-1 & BP-2 Preventive Plan)', () => {
    it('defaults preventivePlanItems to [] for legacy records without breaking them', async () => {
      const { Blueprint } = await import('../../core/domain');
      const legacyBp = new Blueprint({
        id_blueprint: 'BPT-TOURPARA',
        id_family: 'FAM-USI',
        id_templates: 'TPL-TOURPARA',
      });
      expect(legacyBp.id).toBe('BPT-TOURPARA');
      expect(legacyBp.preventivePlanItems).toEqual([]);
    });

    it('applies preventivePlanItems only to active machines linked to the blueprint', async () => {
      const { applyBlueprintPlanToActiveMachines } = await import('../../core/domain');
      const blueprint = {
        id_blueprint: 'BPT-TOURPARA',
        libelle: 'Plan Tour Parallèle',
        preventivePlanItems: [
          {
            id: 'BPP-1',
            composant: 'Broche principale',
            action_code: 'G',
            frequence: 'Mensuel',
            duree_min: 20,
            description: 'Graissage palier broche',
          },
          {
            id: 'BPP-2',
            composant: 'Courroie',
            action_code: 'C',
            frequence: 'Hebdo',
            duree_min: 10,
            description: 'Contrôle tension courroie',
          },
        ],
      };

      const machines = [
        {
          id_machine_registered: 'TRP-01',
          designation: 'Tour Parallèle 01',
          id_blueprint: 'BPT-TOURPARA',
          id_zone_default: 'AFM',
          technician: 'Youssef',
          status: 'En service',
        },
        {
          id_machine_registered: 'TRP-02-ARCH',
          designation: 'Tour Parallèle Archivé',
          id_blueprint: 'BPT-TOURPARA',
          id_zone_default: 'AFM',
          status: 'ARCHIVEE',
        },
        {
          id_machine_registered: 'FRM-01',
          designation: 'Fraiseuse 01',
          id_blueprint: 'BPT-FRAISEUSE',
          id_zone_default: 'AFM',
          status: 'En service',
        },
      ];

      const { addedTasks, updatedTasks, targetMachinesCount } = applyBlueprintPlanToActiveMachines(
        blueprint,
        machines,
        []
      );

      // Only TRP-01 is active and linked to BPT-TOURPARA
      expect(targetMachinesCount).toBe(1);
      expect(addedTasks.length).toBe(2);
      expect(updatedTasks.length).toBe(2);
      expect(addedTasks.every((t) => t.id_machine === 'TRP-01')).toBe(true);
      expect(addedTasks[0].composant).toBe('Broche principale');
      expect(addedTasks[0].action_code).toBe('G');
      expect(addedTasks[0].duree_min).toBe(20);
      expect(addedTasks[0].duree_estimee).toBe('20 min');

      // Re-applying same items does not duplicate existing tasks
      const secondRun = applyBlueprintPlanToActiveMachines(blueprint, machines, updatedTasks);
      expect(secondRun.addedTasks.length).toBe(0);
      expect(secondRun.updatedTasks.length).toBe(2);
    });

    it('filters preventive tasks by blueprint (BP-4: direct task.id_blueprint and fallback via machine.id_blueprint)', async () => {
      const { doesTaskMatchBlueprint, filterTasksByBlueprint } = await import('../../core/domain');

      const machines = [
        {
          id_machine_registered: 'TRP-01',
          id_blueprint: 'BPT-TOURPARA',
          status: 'En service',
        },
        {
          id_machine_registered: 'FRM-01',
          id_blueprint: 'BPT-FRAISEUSE',
          status: 'En service',
        },
      ];

      const tasks = [
        // 1) Task with explicit id_blueprint
        {
          id: 'TSK-BP-1',
          id_machine: 'TRP-01',
          id_blueprint: 'BPT-TOURPARA',
          composant: 'Broche',
        },
        // 2) Legacy task without id_blueprint on task, but machine TRP-01 is linked to BPT-TOURPARA
        {
          id: 'TSK-LEGACY-2',
          id_machine: 'TRP-01',
          composant: 'Glissières',
        },
        // 3) Task belonging to another blueprint
        {
          id: 'TSK-OTHER-3',
          id_machine: 'FRM-01',
          id_blueprint: 'BPT-FRAISEUSE',
          composant: 'Table',
        },
      ];

      expect(doesTaskMatchBlueprint(tasks[0], 'BPT-TOURPARA', machines)).toBe(true);
      expect(doesTaskMatchBlueprint(tasks[1], 'BPT-TOURPARA', machines)).toBe(true);
      expect(doesTaskMatchBlueprint(tasks[2], 'BPT-TOURPARA', machines)).toBe(false);

      const filteredTour = filterTasksByBlueprint(tasks, 'BPT-TOURPARA', machines);
      expect(filteredTour.map((t) => t.id)).toEqual(['TSK-BP-1', 'TSK-LEGACY-2']);

      const filteredFraiseuse = filterTasksByBlueprint(tasks, 'BPT-FRAISEUSE', machines);
      expect(filteredFraiseuse.map((t) => t.id)).toEqual(['TSK-OTHER-3']);

      const filteredAll = filterTasksByBlueprint(tasks, 'ALL', machines);
      expect(filteredAll.length).toBe(3);
    });

    it('defaults commonFailures to [] for legacy records and resolves commonFailures for active linked machines (BP-5)', async () => {
      const { Blueprint, getBlueprintCommonFailuresForMachine } = await import('../../core/domain');

      const legacyBp = new Blueprint({
        id_blueprint: 'BPT-TOURPARA',
        id_family: 'FAM-USI',
        id_templates: 'TPL-TOURPARA',
      });
      expect(legacyBp.commonFailures).toEqual([]);

      const blueprints = [
        {
          id_blueprint: 'BPT-TOURPARA',
          libelle: 'Plan Tour Parallèle',
          commonFailures: [
            {
              id: 'BPF-1',
              title: 'Échauffement palier broche',
              type_panne: 'M',
              urgence: 'HAUTE',
              recommended_action: 'Contrôler jeu et remplacer roulement',
              pdr_ref: 'ROUL-6204',
            },
          ],
        },
        {
          id_blueprint: 'BPT-FRAISEUSE',
          libelle: 'Plan Fraiseuse',
        },
      ];

      const machines = [
        {
          id_machine_registered: 'TRP-01',
          id_blueprint: 'BPT-TOURPARA',
          status: 'En service',
        },
        {
          id_machine_registered: 'TRP-02-ARCH',
          id_blueprint: 'BPT-TOURPARA',
          status: 'ARCHIVEE',
        },
        {
          id_machine_registered: 'MCH-NO-BP',
          status: 'En service',
        },
        {
          id_machine_registered: 'FRM-01',
          id_blueprint: 'BPT-FRAISEUSE',
          status: 'En service',
        },
      ];

      // Active machine linked to BPT-TOURPARA -> returns commonFailures
      const trpFailures = getBlueprintCommonFailuresForMachine('TRP-01', machines, blueprints);
      expect(trpFailures.length).toBe(1);
      expect(trpFailures[0].title).toBe('Échauffement palier broche');
      expect(trpFailures[0].type_panne).toBe('M');
      expect(trpFailures[0].urgence).toBe('HAUTE');

      // Machine without blueprint -> []
      expect(getBlueprintCommonFailuresForMachine('MCH-NO-BP', machines, blueprints)).toEqual([]);

      // Machine linked to blueprint with no commonFailures -> []
      expect(getBlueprintCommonFailuresForMachine('FRM-01', machines, blueprints)).toEqual([]);

      // Archived machine -> [] (excluded via filterActiveMachines)
      expect(getBlueprintCommonFailuresForMachine('TRP-02-ARCH', machines, blueprints)).toEqual([]);
    });
  });

  describe('EntrepotItem Nature & Taxonomy Classification (FIX-2)', () => {
    it('should accurately classify COMPONENT and PART natures across canonical and legacy French tags without inversion', () => {
      expect(isComponentNature('COMPONENT')).toBe(true);
      expect(isComponentNature('COMPOSANT')).toBe(true);
      expect(isComponentNature('PART')).toBe(false);
      expect(isComponentNature('PARTIE')).toBe(false);

      expect(isPartNature('PART')).toBe(true);
      expect(isPartNature('PARTIE')).toBe(true);
      expect(isPartNature('ORGANE')).toBe(true);
      expect(isPartNature('COMPONENT')).toBe(false);
      expect(isPartNature('COMPOSANT')).toBe(false);
    });

    it('should classify warehouse items uniformly via isWarehouseComponent and isWarehousePart', () => {
      const canonicalComp = { id_item: 'CMP-1', nature: 'COMPONENT', machine_id: 'TRP-01' };
      const legacyComp = { id_item: 'CMP-2', category: 'COMPOSANT', machine_id: 'TRP-01' };
      const templateComp = { id_item: 'CMP-3', id_comp_template: 'CT-MOT-15KW', machine_id: 'TRP-01' };

      const canonicalPart = { id_item: 'PRT-1', nature: 'PART', machine_id: 'TRP-01' };
      const legacyPart = { id_item: 'PRT-2', nature: 'PARTIE', machine_id: 'TRP-01' };
      const designationPart = { id_item: 'PRT-3', id_designation: 'PD-BROCHE-01', machine_id: 'TRP-01' };

      expect(isWarehouseComponent(canonicalComp)).toBe(true);
      expect(isWarehouseComponent(legacyComp)).toBe(true);
      expect(isWarehouseComponent(templateComp)).toBe(true);
      expect(isWarehouseComponent(canonicalPart)).toBe(false);

      expect(isWarehousePart(canonicalPart)).toBe(true);
      expect(isWarehousePart(legacyPart)).toBe(true);
      expect(isWarehousePart(designationPart)).toBe(true);
      expect(isWarehousePart(canonicalComp)).toBe(false);
    });
  });
});


