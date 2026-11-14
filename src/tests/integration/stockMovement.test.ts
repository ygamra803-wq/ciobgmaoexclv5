import { describe, it, expect } from 'vitest';
import { StockCalculationService } from '@/domain/pdr/services/StockCalculationService';
import { calculateStockStatus } from '@/utils/formulaEngine';
import { ValidationService } from '@/domain/validators/index.js';

describe('Stock Movement Integration Flow', () => {
  it('يجب محاكاة حركة صرف مع التحقق من الرصيد والبيانات', () => {
    // 1. Initial State
    const stockItem = {
      code: 'ROUL-6204',
      designation: 'Roulement 6204',
      quantity: 50,
      minStock: 10,
      unit: 'U',
    };

    expect(ValidationService.validateStockItem(stockItem).valid).toBe(true);

    // 2. Perform Movement OUT
    const movement = {
      date: new Date().toISOString(),
      type: 'OUT',
      quantity: 15,
      stockCode: 'ROUL-6204',
      user: 'Technicien Ali',
    };

    expect(ValidationService.validateMouvement(movement).valid).toBe(true);

    // 3. Update Stock
    const updatedQty = StockCalculationService.calculateStockActuel(
      { ref: 'ROUL-6204', stockInitial: stockItem.quantity, seuil: stockItem.minStock },
      [{ ref: 'ROUL-6204', type: 'Sortie', quantite: movement.quantity }]
    );
    stockItem.quantity = updatedQty;

    expect(stockItem.quantity).toBe(35);
    expect(calculateStockStatus(stockItem.quantity, 0, 0, stockItem.minStock).alerte).toBe('OK');

    // 4. Perform Critical OUT
    const bigMovement = {
      date: new Date().toISOString(),
      type: 'OUT',
      quantity: 30,
      stockCode: 'ROUL-6204',
      user: 'Technicien Ali',
    };

    stockItem.quantity = StockCalculationService.calculateStockActuel(
      { ref: 'ROUL-6204', stockInitial: stockItem.quantity, seuil: stockItem.minStock },
      [{ ref: 'ROUL-6204', type: 'Sortie', quantite: bigMovement.quantity }]
    );
    expect(stockItem.quantity).toBe(5);
    expect(calculateStockStatus(stockItem.quantity, 0, 0, stockItem.minStock).alerte).toBe('ALERTE');
  });
});
