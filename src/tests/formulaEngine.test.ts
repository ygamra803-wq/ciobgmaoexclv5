import { describe, it, expect } from 'vitest';
import { formulaEngine } from '../services/formulaEngineWithErrorHandling';

describe('formulaEngineWithErrorHandling Tests', () => {
  it('should calculate safe numbers correctly', () => {
    expect(formulaEngine.safeNum(5)).toBe(5);
    expect(formulaEngine.safeNum('10')).toBe(10);
    expect(formulaEngine.safeNum(null, 0)).toBe(0);
    expect(formulaEngine.safeNum(undefined, 0)).toBe(0);
  });

  it('should calculate stock status correctly', () => {
    const status = formulaEngine.calculateStockStatus(10, 5, 3, 5);
    expect(status.stockActuel).toBe(12);
    expect(status.alerte).toBe('OK');
  });
});
