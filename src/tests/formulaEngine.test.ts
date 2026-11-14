import { describe, it, expect } from 'vitest';
import { safeNum, calculateStockStatus } from '../utils/formulaEngine';

describe('formulaEngine Tests', () => {
  it('should calculate safe numbers correctly', () => {
    expect(safeNum(5)).toBe(5);
    expect(safeNum('10')).toBe(10);
    expect(safeNum(null, 0)).toBe(0);
    expect(safeNum(undefined, 0)).toBe(0);
  });

  it('should calculate stock status correctly', () => {
    const status = calculateStockStatus(10, 5, 3, 5);
    expect(status.stockActuel).toBe(12);
    expect(status.alerte).toBe('OK');
  });
});
