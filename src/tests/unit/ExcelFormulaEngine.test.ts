// ✅ ملف: src/tests/unit/ExcelFormulaEngine.test.ts

import { describe, it, expect } from 'vitest';
import ExcelFormulaEngine from '../../core/domain/services/ExcelFormulaEngine';

describe('ExcelFormulaEngine', () => {
  describe('SUMIFS', () => {
    it('should calculate sum with multiple criteria', () => {
      const data = [
        { ref: 'ROUL-6204', type: 'Entrée', quantite: 50 },
        { ref: 'ROUL-6204', type: 'Sortie', quantite: 30 },
        { ref: 'ROUL-6204', type: 'Sortie', quantite: 20 },
        { ref: 'OTHER', type: 'Entrée', quantite: 100 }
      ];

      const result = ExcelFormulaEngine.sumifs(
        data,
        'quantite',
        'ref',
        'ROUL-6204',
        'type',
        'Sortie'
      );

      expect(result).toBe(50); // 30 + 20
    });

    it('should return 0 for empty data', () => {
      const result = ExcelFormulaEngine.sumifs([], 'quantite', 'ref', 'ROUL-6204', 'type', 'Sortie');
      expect(result).toBe(0);
    });

    it('should handle non-matching criteria', () => {
      const data = [{ ref: 'ROUL-6204', type: 'Entrée', quantite: 50 }];
      const result = ExcelFormulaEngine.sumifs(data, 'quantite', 'ref', 'ROUL-6204', 'type', 'Sortie');
      expect(result).toBe(0);
    });
  });

  describe('calculateStockActuel', () => {
    it('should calculate correct stock', () => {
      const article = {
        ref: 'ROUL-6204',
        designation: 'Bearing',
        stockInitial: 100,
        seuil: 10
      };

      const movements = [
        { ref: 'ROUL-6204', type: 'Entrée', quantite: 50 },
        { ref: 'ROUL-6204', type: 'Sortie', quantite: 30 },
        { ref: 'ROUL-6204', type: 'Sortie', quantite: 20 }
      ];

      const result = ExcelFormulaEngine.calculateStockActuel(article, movements);

      expect(result.stockActuel).toBe(100); // 100 + 50 - 30 - 20
      expect(result.alerte).toBe('OK');
    });

    it('should detect rupture', () => {
      const article = {
        ref: 'ROUL-6204',
        stockInitial: 10,
        seuil: 10
      };

      const movements = [
        { ref: 'ROUL-6204', type: 'Sortie', quantite: 15 }
      ];

      const result = ExcelFormulaEngine.calculateStockActuel(article, movements);

      expect(result.stockActuel).toBe(0);
      expect(result.alerte).toBe('RUPTURE');
    });

    it('should detect alerte', () => {
      const article = {
        ref: 'ROUL-6204',
        stockInitial: 100,
        seuil: 20
      };

      const movements = [
        { ref: 'ROUL-6204', type: 'Sortie', quantite: 85 }
      ];

      const result = ExcelFormulaEngine.calculateStockActuel(article, movements);

      expect(result.stockActuel).toBe(15);
      expect(result.alerte).toBe('ALERTE');
    });
  });

  describe('verifyCalculations', () => {
    it('should detect calculation errors', () => {
      const articles = [
        {
          ref: 'ROUL-6204',
          stockInitial: 100,
          seuil: 10,
          stockActuel: 50, // خطأ
          alerte: 'OK'
        }
      ];

      const movements: any[] = [];

      const result = ExcelFormulaEngine.verifyCalculations(articles, movements);

      expect(result.isValid).toBe(false);
      expect(result.errorCount).toBe(1);
    });
  });
});
