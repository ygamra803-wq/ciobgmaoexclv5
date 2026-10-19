import { describe, it, expect, beforeEach } from 'vitest';
import { stockCalculationService } from '../services/stockCalculationService';

describe('stockCalculationService Tests', () => {
  beforeEach(() => {
    stockCalculationService.clearCache();
  });

  it('should calculate correct stock current balance', () => {
    const article = { ref: 'TEST-REF', stockInitial: 20, seuil: 5 };
    const movements = [
      { ref: 'TEST-REF', type: 'Entrée', quantite: 10 },
      { ref: 'TEST-REF', type: 'Sortie', quantite: 5 }
    ];
    const balance = stockCalculationService.calculateStockActuel(article, movements);
    expect(balance).toBe(25);
  });
});
