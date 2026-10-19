import { describe, it, expect } from 'vitest';
import { calculateCurrentStock, getStockStatus } from '@/domain/stockCalculations';
import { ValidationService } from '@/domain/validators/index.js';

describe('Stock Movement Integration Flow', () => {
  it('يجب محاكاة حركة صرف مع التحقق من الرصيد والبيانات', () => {
    // 1. Initial State
    let stockItem = {
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
    const updatedQty = calculateCurrentStock(stockItem.quantity, 0, movement.quantity);
    stockItem.quantity = updatedQty;

    expect(stockItem.quantity).toBe(35);
    expect(getStockStatus(stockItem.quantity, stockItem.minStock)).toBe('OPTIMAL');

    // 4. Perform Critical OUT
    const bigMovement = {
      date: new Date().toISOString(),
      type: 'OUT',
      quantity: 30,
      stockCode: 'ROUL-6204',
      user: 'Technicien Ali',
    };

    stockItem.quantity = calculateCurrentStock(stockItem.quantity, 0, bigMovement.quantity);
    expect(stockItem.quantity).toBe(5);
    expect(getStockStatus(stockItem.quantity, stockItem.minStock)).toBe('ALERTE');
  });
});
