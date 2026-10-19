// ✅ ملف: src/tests/unit/ReactiveCalculationEngine.test.ts

import { describe, it, expect } from 'vitest';
import ReactiveCalculationEngine from '@/core/domain/services/ReactiveCalculationEngine';

describe('ReactiveCalculationEngine', () => {
  describe('calculateStock', () => {
    it('should calculate correct stock', () => {
      const result = ReactiveCalculationEngine.calculateStock(100, [
        { type: 'IN', quantity: 50 },
        { type: 'OUT', quantity: 30 },
        { type: 'OUT', quantity: 20 },
      ]);

      expect(result).toBe(100); // 100 + 50 - 30 - 20
    });

    it('should not allow negative stock', () => {
      const result = ReactiveCalculationEngine.calculateStock(10, [
        { type: 'OUT', quantity: 50 },
      ]);

      expect(result).toBe(0); // 10 - 50 = -40 → 0
    });
  });

  describe('calculateAlertStatus', () => {
    it('should detect rupture', () => {
      const result = ReactiveCalculationEngine.calculateAlertStatus(0, 10);
      expect(result).toBe('RUPTURE');
    });

    it('should detect alerte', () => {
      const result = ReactiveCalculationEngine.calculateAlertStatus(5, 10);
      expect(result).toBe('ALERTE');
    });

    it('should return OK', () => {
      const result = ReactiveCalculationEngine.calculateAlertStatus(50, 10);
      expect(result).toBe('OK');
    });
  });

  describe('calculateMTBF', () => {
    it('should calculate MTBF correctly', () => {
      const interventions = [
        { type: 'CORRECTIVE' as const, duration: 24 },
        { type: 'CORRECTIVE' as const, duration: 20 },
        { type: 'PREVENTIVE' as const, duration: 2 },
      ];

      const result = ReactiveCalculationEngine.calculateMTBF(interventions);
      expect(result).toBe(22); // (24 + 20) / 2
    });

    it('should return 0 when there are no corrective interventions', () => {
      const result = ReactiveCalculationEngine.calculateMTBF([
        { type: 'PREVENTIVE' as const, duration: 4 },
      ]);
      expect(result).toBe(0);
    });
  });

  describe('calculateMTTR', () => {
    it('should calculate MTTR correctly', () => {
      const interventions = [
        { type: 'CORRECTIVE' as const, duration: 10 },
        { type: 'CORRECTIVE' as const, duration: 20 },
        { type: 'PREVENTIVE' as const, duration: 5 },
      ];

      const result = ReactiveCalculationEngine.calculateMTTR(interventions);
      expect(result).toBe(15); // (10 + 20) / 2
    });
  });

  describe('calculateAvailability', () => {
    it('should calculate availability correctly', () => {
      const result = ReactiveCalculationEngine.calculateAvailability(100, 10);
      expect(result).toBeCloseTo(90.91, 1);
    });

    it('should return 100 if MTBF is 0', () => {
      const result = ReactiveCalculationEngine.calculateAvailability(0, 10);
      expect(result).toBe(100);
    });
  });

  describe('verifyCalculations', () => {
    it('should validate correct metrics', () => {
      const verification = ReactiveCalculationEngine.verifyCalculations({
        stock: 50,
        mtbf: 120,
        mttr: 4,
        availability: 96.77,
      });

      expect(verification.isValid).toBe(true);
      expect(verification.errors).toHaveLength(0);
    });

    it('should detect negative stock, negative MTBF/MTTR, and out-of-range availability', () => {
      const verification = ReactiveCalculationEngine.verifyCalculations({
        stock: -5,
        mtbf: -10,
        mttr: -2,
        availability: 105,
      });

      expect(verification.isValid).toBe(false);
      expect(verification.errors).toContain('Stock cannot be negative');
      expect(verification.errors).toContain('MTBF cannot be negative');
      expect(verification.errors).toContain('MTTR cannot be negative');
      expect(verification.errors).toContain('Availability must be 0-100');
    });
  });
});
