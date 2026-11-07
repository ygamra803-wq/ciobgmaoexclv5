import { describe, it, expect } from 'vitest';
import {
  ZoneEntity,
  MovementEntity,
} from '../../domain';

describe('New Domain Entities & Services (TypeScript + Clean Architecture)', () => {

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
