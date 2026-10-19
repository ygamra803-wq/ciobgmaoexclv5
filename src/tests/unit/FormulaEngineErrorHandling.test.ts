import { describe, it, expect } from 'vitest';
import {
  safeNum,
  calculateStockStatus,
  validateMouvement,
  validateMovementWithContext,
  updateLookups,
  sumIfs,
  countIfs,
} from '../../utils/formulaEngine';

describe('FormulaEngine Error Handling & Reliability Tests', () => {
  it('should handle invalid numeric inputs safely in safeNum()', () => {
    expect(safeNum(10)).toBe(10);
    expect(safeNum('25.5')).toBe(25.5);
    expect(safeNum(null, 0)).toBe(0);
    expect(safeNum(undefined, 0)).toBe(0);
    expect(safeNum('', 5)).toBe(5);
    expect(safeNum('abc', 0)).toBe(0);
    expect(safeNum(NaN, 0)).toBe(0);
    expect(safeNum(Infinity, 0)).toBe(0);
  });

  it('should calculate stock status safely with null/undefined values', () => {
    const result = calculateStockStatus(null, undefined, 'abc', null);
    expect(result.isValid).toBe(true);
    expect(result.stockActuel).toBe(0);
    expect(result.alerte).toBe('RUPTURE');
  });

  it('should accurately set ALERTE and RUPTURE statuses', () => {
    const r1 = calculateStockStatus(10, 0, 5, 10);
    expect(r1.stockActuel).toBe(5);
    expect(r1.alerte).toBe('ALERTE');

    const r2 = calculateStockStatus(10, 0, 15, 5);
    expect(r2.stockActuel).toBe(0);
    expect(r2.alerte).toBe('RUPTURE');
  });

  it('should handle validateMouvement errors without throwing', () => {
    const res1 = validateMouvement(null);
    expect(res1.valid).toBe(false);

    const res2 = validateMouvement({ ref: '', quantite: -5 });
    expect(res2.valid).toBe(false);
    expect(res2.errors.length).toBeGreaterThan(0);
  });

  it('should validate context safely in validateMovementWithContext', () => {
    updateLookups(null); // Should not throw
    const context = {
      stock: [{ ref: 'PDR-001', stockActuel: 10 }],
      warehouseItems: [],
      zones: [{ id_zone: 'Z1' }],
      machines: [{ id_machine_registered: 'M1' }],
    };

    const invalidMvt = {
      code_bon: 'BON-001',
      ref: 'PDR-001',
      quantite: 50, // Exceeds available 10
      type: 'Sortie Interne',
      date: '2026-09-20',
      id_zone: 'Z1',
      id_machine_registered: 'M1',
    };

    const val = validateMovementWithContext(invalidMvt, context);
    expect(val.valid).toBe(false);
    expect(val.errors.some((e) => e.includes('Stock insuffisant'))).toBe(true);
  });

  it('should perform sumIfs and countIfs without crashing on corrupt records', () => {
    const records = [
      { type: 'Entrée', ref: 'A', qty: 10 },
      null,
      { type: 'Sortie', ref: 'A', qty: 5 },
      { type: 'Entrée', ref: 'A', qty: 15 },
    ];

    const sum = sumIfs(records, 'qty', 'type', 'Entrée', 'ref', 'A');
    expect(sum).toBe(25);

    const count = countIfs(records, 'type', 'Entrée');
    expect(count).toBe(2);
  });
});
