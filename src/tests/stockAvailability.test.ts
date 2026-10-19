import { describe, it, expect } from 'vitest';
import { stockAvailabilityService } from '../services/stockAvailabilityService';

describe('stockAvailabilityService Tests', () => {
  it('should validate availability correctly', () => {
    const article = { ref: 'TEST-AVAIL', stockInitial: 10, seuil: 2 };
    const movements = [];
    const res = stockAvailabilityService.checkAvailability('TEST-AVAIL', 5, article, movements);
    expect(res.available).toBe(true);
    expect(res.currentStock).toBe(10);
  });
});
