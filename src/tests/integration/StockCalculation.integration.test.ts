// ✅ ملف: src/tests/integration/StockCalculation.integration.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import ExcelFormulaEngine from '../../core/domain/services/ExcelFormulaEngine';
import StockCalculationService from '../../core/domain/services/StockCalculationService';

describe('Stock Calculation Integration', () => {
  let articles: any[];
  let movements: any[];

  beforeEach(() => {
    // Test data
    articles = [
      {
        ref: 'ROUL-6204',
        designation: 'Bearing',
        stockInitial: 100,
        seuil: 10
      },
      {
        ref: 'ROUL-6205',
        designation: 'Seal',
        stockInitial: 50,
        seuil: 5
      }
    ];

    movements = [
      { ref: 'ROUL-6204', type: 'Entrée', quantite: 50 },
      { ref: 'ROUL-6204', type: 'Sortie', quantite: 30 },
      { ref: 'ROUL-6204', type: 'Sortie', quantite: 20 },
      { ref: 'ROUL-6205', type: 'Entrée', quantite: 25 },
      { ref: 'ROUL-6205', type: 'Sortie', quantite: 10 }
    ];
  });

  it('should calculate all stocks correctly', () => {
    const results = StockCalculationService.calculateAllStocks(articles, movements);

    expect(results).toHaveLength(2);
    expect(results[0].stockActuel).toBe(100); // 100 + 50 - 30 - 20
    expect(results[0].alerte).toBe('OK');
    expect(results[1].stockActuel).toBe(65); // 50 + 25 - 10
    expect(results[1].alerte).toBe('OK');
  });

  it('should detect rupture correctly', () => {
    articles[0].stockInitial = 10;
    movements.push({ ref: 'ROUL-6204', type: 'Sortie', quantite: 50 });

    const results = StockCalculationService.calculateAllStocks(articles, movements);

    expect(results[0].stockActuel).toBe(0);
    expect(results[0].alerte).toBe('RUPTURE');
  });

  it('should detect alerte correctly', () => {
    articles[0].seuil = 50;
    movements.push({ ref: 'ROUL-6204', type: 'Sortie', quantite: 80 });

    const results = StockCalculationService.calculateAllStocks(articles, movements);

    expect(results[0].alerte).toBe('ALERTE');
  });

  it('should get stock alerts correctly', () => {
    // Rupture logic: stockActuel = stockInitial + entrees - sorties.
    // Articles: 5 + 0 - 0 = 5. Not rupture (5 <= 10).
    // The previous test setup didn't trigger rupture correctly.
    // Let's force a rupture by adding a large sortie.
    movements.push({ ref: 'ROUL-6204', type: 'Sortie', quantite: 100 });
    movements.push({ ref: 'ROUL-6205', type: 'Sortie', quantite: 100 });

    const results = StockCalculationService.calculateAllStocks(articles, movements);
    const alerts = StockCalculationService.getStockAlerts(results);

    expect(alerts.rupture.length).toBeGreaterThan(0);
  });

  it('should calculate statistics correctly', () => {
    const results = StockCalculationService.calculateAllStocks(articles, movements);
    const stats = StockCalculationService.getStockStatistics(results);

    expect(stats.totalArticles).toBe(2);
    expect(stats.articlesOK).toBe(2);
    expect(stats.articlesInRupture).toBe(0);
  });

  it('should handle large datasets efficiently', () => {
    // إنشاء بيانات كبيرة
    const largeArticles = Array.from({ length: 10000 }, (_, i) => ({
      ref: `ROUL-${String(i).padStart(5, '0')}`,
      designation: `Article ${i}`,
      stockInitial: Math.floor(Math.random() * 1000),
      seuil: Math.floor(Math.random() * 50)
    }));

    const largeMovements = Array.from({ length: 100000 }, (_, i) => ({
      ref: `ROUL-${String(Math.floor(Math.random() * 10000)).padStart(5, '0')}`,
      type: Math.random() > 0.5 ? 'Entrée' : 'Sortie',
      quantite: Math.floor(Math.random() * 100) + 1
    }));

    const start = performance.now();
    const results = StockCalculationService.calculateAllStocks(largeArticles, largeMovements);
    const end = performance.now();

    const duration = end - start;

    console.log(`✅ Performance: ${duration.toFixed(2)}ms for 10,000 articles`);
    expect(duration).toBeLessThan(500); // يجب أن يكون أسرع من 500ms
    expect(results).toHaveLength(10000);
  });
});
