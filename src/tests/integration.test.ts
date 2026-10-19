import { describe, it, expect } from 'vitest';
import { stockCalculationService } from '../services/stockCalculationService';
import { stockAvailabilityService } from '../services/stockAvailabilityService';

describe('Integration Tests', () => {
  it('should integrate formula engine and stock services smoothly', () => {
    const article = { ref: 'INT-REF', stockInitial: 30, seuil: 10 };
    const movements = [
      { ref: 'INT-REF', type: 'Entrée', quantite: 20 },
      { ref: 'INT-REF', type: 'Sortie', quantite: 15 }
    ];

    const currentStock = stockCalculationService.calculateStockActuel(article, movements);
    expect(currentStock).toBe(35);

    const check = stockAvailabilityService.checkAvailability('INT-REF', 10, article, movements);
    expect(check.available).toBe(true);
    expect(check.currentStock).toBe(35);
  });
});
