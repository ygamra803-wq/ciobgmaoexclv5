import { describe, it, expect } from 'vitest';
import {
  OperationEntity,
  DiagnosticEntity,
  ZoneEntity,
  MovementEntity,
  OperationService,
  DiagnosticService,
} from '../../domain';

describe('New Domain Entities & Services (TypeScript + Clean Architecture)', () => {
  describe('OperationEntity', () => {
    it('should initialize with defaults and determine role helpers', () => {
      const chef = new OperationEntity({
        id_operation: 'CHEF-01',
        nom: 'Chef Equipe Alpha',
        type_profil: 'CHEF',
      });
      expect(chef.isChef()).toBe(true);
      expect(chef.isOperateur()).toBe(false);
      expect(chef.getDisplayName()).toBe('CHEF-01 - Chef Equipe Alpha');

      const op = new OperationEntity({
        id_operation: 'OP-05',
        nom: 'Operateur Machine',
        type_profil: 'OPERATEUR',
      });
      expect(op.isChef()).toBe(false);
      expect(op.isOperateur()).toBe(true);
    });

    it('should calculate next ID correctly in OperationService', () => {
      const service = new OperationService({} as any);
      const ops = [
        new OperationEntity({ id_operation: 'OP-01', type_profil: 'OPERATEUR' }),
        new OperationEntity({ id_operation: 'OP-02', type_profil: 'OPERATEUR' }),
        new OperationEntity({ id_operation: 'CHEF-01', type_profil: 'CHEF' }),
      ];

      expect(service.calculateNextId(ops, 'OPERATEUR')).toBe('OP-03');
      expect(service.calculateNextId(ops, 'CHEF')).toBe('CHEF-02');
    });
  });

  describe('DiagnosticEntity', () => {
    it('should match search query against ref, diag id, and designation', () => {
      const diag = new DiagnosticEntity({
        id_diag: 'DIAG-01',
        ref: 'ROUL-6204',
        designation: 'Roulement à billes SKF',
        description: 'Vibration anormale palier 2',
      });

      expect(diag.matches('ROUL')).toBe(true);
      expect(diag.matches('skf')).toBe(true);
      expect(diag.matches('vibration')).toBe(true);
      expect(diag.matches('pneumatique')).toBe(false);
    });
  });

  describe('ZoneEntity', () => {
    it('should format display name and match search queries', () => {
      const zone = new ZoneEntity({
        code: 'ZONE-01',
        libelle: 'Atelier Usinage',
        description: 'Ligne CNC et Tours',
      });

      expect(zone.getDisplayName()).toBe('ZONE-01 - Atelier Usinage');
      expect(zone.matches('usinage')).toBe(true);
      expect(zone.matches('ZONE-01')).toBe(true);
      expect(zone.matches('peinture')).toBe(false);
    });
  });

  describe('MovementEntity', () => {
    it('should identify movement types correctly', () => {
      const mvt1 = new MovementEntity({
        type: 'Sortie',
        action_id: 'CORRECTIVE',
        ref: 'ROUL-6204',
        quantite: 2,
      });
      expect(mvt1.isExit()).toBe(true);
      expect(mvt1.isEntry()).toBe(false);
      expect(mvt1.isCorrective()).toBe(true);
      expect(mvt1.isUsage()).toBe(false);

      const mvt2 = new MovementEntity({
        type: 'Entrée',
        action_id: 'USAGE',
        ref: 'HUILE-VG46',
        quantite: 50,
      });
      expect(mvt2.isEntry()).toBe(true);
      expect(mvt2.isExit()).toBe(false);
      expect(mvt2.isUsage()).toBe(true);
    });
  });
});
