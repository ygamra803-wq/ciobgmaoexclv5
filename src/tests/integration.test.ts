import { describe, it, expect } from 'vitest';
import { StockCalculationService } from '../domain/pdr/services/StockCalculationService';

describe('Integration Tests', () => {
  it('should integrate formula engine and stock services smoothly', () => {
    const article = { ref: 'INT-REF', stockInitial: 30, seuil: 10 };
    const movements = [
      { ref: 'INT-REF', type: 'Entrée', quantite: 20 },
      { ref: 'INT-REF', type: 'Sortie', quantite: 15 }
    ];

    const currentStock = StockCalculationService.calculateStockActuel(article, movements);
    expect(currentStock).toBe(35);

    const check = StockCalculationService.checkAvailability('INT-REF', 10, article, movements);
    expect(check.available).toBe(true);
    expect(check.currentStock).toBe(35);
  });
});
