import { describe, it, expect } from 'vitest';
import { safeNum, calculateStockStatus, validateMouvement } from './formulaEngine';

describe('formulaEngine', () => {
  describe('safeNum', () => {
    it('returns the number if valid', () => {
      expect(safeNum(5)).toBe(5);
      expect(safeNum('10')).toBe(10);
      expect(safeNum(-3.5)).toBe(-3.5);
    });

    it('returns default value if invalid', () => {
      expect(safeNum(null, 0)).toBe(0);
      expect(safeNum(undefined, NaN)).toBeNaN();
      expect(safeNum('', 0)).toBe(0);
      expect(safeNum('abc', 10)).toBe(10);
    });
  });

  describe('calculateStockStatus', () => {
    it('calculates correctly and sets OK status', () => {
      const result = calculateStockStatus(10, 5, 2, 5);
      expect(result.stockActuel).toBe(13);
      expect(result.alerte).toBe('OK');
    });

    it('sets RUPTURE when stock is <= 0', () => {
      const result = calculateStockStatus(10, 0, 10, 5);
      expect(result.stockActuel).toBe(0);
      expect(result.alerte).toBe('RUPTURE');
    });

    it('sets ALERTE when stock is <= threshold but > 0', () => {
      const result = calculateStockStatus(5, 0, 1, 5);
      expect(result.stockActuel).toBe(4);
      expect(result.alerte).toBe('ALERTE');
    });
  });

  describe('validateMouvement', () => {
    it('returns error if required fields are missing', () => {
      const result = validateMouvement({ type: 'Entrée' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns valid for a correct Sortie', () => {
      const mvt = {
        code_bon: 'BON-1',
        date: '2026-08-30',
        ref: 'REF-1',
        quantite: 5,
        type: 'Sortie',
        action_id: 'CORRECTIVE',
        technicien: 'Tech 1',
        id_zone: 'ZONE-1',
        id_machine_registered: 'MACH-1',
      };
      const result = validateMouvement(mvt);
      expect(result.valid).toBe(true);
    });
  });
});
