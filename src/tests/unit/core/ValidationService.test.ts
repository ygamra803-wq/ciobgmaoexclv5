import { describe, it, expect } from 'vitest';
import { ValidationService } from '../../../core/validation/ValidationService';

describe('ValidationService', () => {
  it('should validate valid stock item', () => {
    const item = { ref: 'R1', designation: 'Item 1', stockInitial: 10 };
    const result = ValidationService.validateStockItem(item);
    expect(result.isValid).toBe(true);
  });

  it('should fail invalid stock item', () => {
    const item = { ref: '', designation: '' };
    const result = ValidationService.validateStockItem(item);
    expect(result.isValid).toBe(false);
  });

  it('should validate valid user', () => {
    const user = { username: 'testuser', role: 'ADMIN' };
    const result = ValidationService.validateUser(user);
    expect(result.isValid).toBe(true);
  });
});
