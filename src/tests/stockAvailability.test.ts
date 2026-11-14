import { describe, it, expect } from 'vitest';
import { StockCalculationService } from '../domain/pdr/services/StockCalculationService';

describe('StockCalculationService availability checks', () => {
  it('should validate availability correctly', () => {
    const article = { ref: 'TEST-AVAIL', stockInitial: 10, seuil: 2 };
    const movements = [];
    const res = StockCalculationService.checkAvailability('TEST-AVAIL', 5, article, movements);
    expect(res.available).toBe(true);
    expect(res.currentStock).toBe(10);
  });
});
