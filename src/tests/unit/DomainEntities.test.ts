import { describe, it, expect } from 'vitest';
import { MachineEntity } from '../../domain/machines/entities/MachineEntity';
import { SparePartEntity } from '../../domain/pdr/entities/SparePartEntity';
import { TaskEntity } from '../../domain/maintenance/entities/TaskEntity';
import {
  Operation,
  Diagnostic,
  PartType,
  PartDesignation,
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
});
