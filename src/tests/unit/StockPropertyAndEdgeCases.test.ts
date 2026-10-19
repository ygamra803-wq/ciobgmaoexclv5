import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { StockCalculationService } from '../../domain/pdr/services/StockCalculationService';
import { calculateCurrentStock, getStockStatus } from '../../domain/stockCalculations';
import { calculateStockStatus } from '../../utils/formulaEngine';

// Arbitraries for Property-Based Testing
const stockItemArb = fc.record({
  ref: fc.constantFrom('PDR-001', 'PDR-002', 'PDR-003', 'ROUL-10', 'COURR-05'),
  designation: fc.string({ minLength: 1, maxLength: 60 }),
  stockInitial: fc.integer({ min: 0, max: 10000 }),
  seuil: fc.integer({ min: 0, max: 500 }),
  unitPrice: fc.double({ min: 0, max: 5000, noNaN: true }),
  isAchatUnique: fc.boolean(),
});

const mouvementArb = fc.record({
  id: fc.uuid(),
  ref: fc.constantFrom('PDR-001', 'PDR-002', 'PDR-003', 'ROUL-10', 'COURR-05'),
  type: fc.constantFrom('Entrée', 'Sortie', 'Sortie Interne', 'Sortie Externe', 'Bon de Sortie', 'entree', 'sortie'),
  quantite: fc.integer({ min: 0, max: 2000 }),
  date: fc.constant('2026-10-08'),
});

/**
 * Helper to validate structural and mathematical integrity of stock calculation results
 */
function isValidStockResult(report: ReturnType<typeof StockCalculationService.generateStockReport>): boolean {
  if (!report || typeof report.totalArticles !== 'number') return false;
  if (report.totalQuantity < 0 || report.totalValue < 0 || Number.isNaN(report.totalValue)) return false;
  const sumStatuses = report.summary.rupture + report.summary.alerte + report.summary.ok;
  return sumStatuses === report.totalArticles;
}

describe('6.A — Property-Based Testing & Critical Edge Cases for Stock Calculation', () => {
  beforeEach(() => {
    StockCalculationService.clearCache();
  });

  // =========================================================================
  // 1. Property-Based Testing (fast-check)
  // =========================================================================
  describe('Property-Based Testing (fast-check)', () => {
    it('Stock calculation report invariants should hold across 1000 randomized runs', () => {
      fc.assert(
        fc.property(
          fc.array(stockItemArb, { maxLength: 25 }),
          fc.array(mouvementArb, { maxLength: 50 }),
          (stock, mouvements) => {
            const result = StockCalculationService.generateStockReport(stock, mouvements);
            return isValidStockResult(result);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('Property: Stock balance equals max(0, initial + sum(entrees) - sum(sorties)) for any random sequence', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5000 }),
          fc.array(
            fc.record({
              type: fc.constantFrom('Entrée', 'Sortie'),
              quantite: fc.integer({ min: 0, max: 500 }),
            }),
            { maxLength: 40 }
          ),
          (initial, mvtList) => {
            StockCalculationService.clearCache();
            const article = { ref: 'PDR-PBT', stockInitial: initial, seuil: 10 };
            const movements = mvtList.map((m, i) => ({
              id: `m-${i}`,
              ref: 'PDR-PBT',
              type: m.type,
              quantite: m.quantite,
            }));

            const expectedEntrees = movements
              .filter((m) => m.type === 'Entrée')
              .reduce((acc, m) => acc + m.quantite, 0);
            const expectedSorties = movements
              .filter((m) => m.type === 'Sortie')
              .reduce((acc, m) => acc + m.quantite, 0);
            const expectedStock = initial + expectedEntrees - expectedSorties;

            const actualStock = StockCalculationService.calculateStockActuel(article, movements);
            return actualStock === expectedStock;
          }
        ),
        { numRuns: 500 }
      );
    });

    it('Property: Adding an Entrée of Q followed by a Sortie of Q preserves stock balance (when stock >= Q)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10000 }),
          fc.integer({ min: 1, max: 100 }),
          (initial, delta) => {
            StockCalculationService.clearCache();
            const article = { ref: 'PDR-INV', stockInitial: initial, seuil: 5 };
            const movements = [
              { id: '1', ref: 'PDR-INV', type: 'Entrée', quantite: delta },
              { id: '2', ref: 'PDR-INV', type: 'Sortie', quantite: delta },
            ];
            return StockCalculationService.calculateStockActuel(article, movements) === initial;
          }
        ),
        { numRuns: 300 }
      );
    });
  });

  // =========================================================================
  // 2. Critical Edge Cases (الحالات الحرجية)
  // =========================================================================
  describe('Stock Calculation Edge Cases', () => {
    it('Empty arrays: handles empty stock and empty movements gracefully', () => {
      const report = StockCalculationService.generateStockReport([], []);
      expect(report.totalArticles).toBe(0);
      expect(report.totalQuantity).toBe(0);
      expect(report.totalValue).toBe(0);
      expect(report.summary).toEqual({ rupture: 0, alerte: 0, ok: 0 });

      expect(StockCalculationService.calculateEntrees('PDR-001', [])).toBe(0);
      expect(StockCalculationService.calculateSorties('PDR-001', [])).toBe(0);
      expect(StockCalculationService.calculateStockActuel(null, [])).toBe(0);
    });

    it('Negative quantities & excess exits: preserves negative physical stock for deficit tracking', () => {
      // Exits exceeding initial + entries
      expect(calculateCurrentStock(10, 5, 50)).toBe(-35);

      const article = { ref: 'PDR-NEG', stockInitial: 10, seuil: 5 };
      const movements = [{ id: 'm1', ref: 'PDR-NEG', type: 'Sortie', quantite: 25 }];
      const stockActuel = StockCalculationService.calculateStockActuel(article, movements);
      expect(stockActuel).toBe(-15);
      expect(StockCalculationService.getAlertStatus(article, stockActuel)).toBe('RUPTURE');

      // Negative requested quantity on availability check
      const checkNeg = StockCalculationService.checkAvailability('PDR-NEG', -5, article, []);
      expect(checkNeg.available).toBe(false);
    });

    it('Very large numbers: handles high industrial volumes without overflow or precision loss', () => {
      const largeInit = 1_000_000_000;
      const largeIn = 500_000_000;
      const largeOut = 250_000_000;

      const stock = calculateCurrentStock(largeInit, largeIn, largeOut);
      expect(stock).toBe(1_250_000_000);

      const article = {
        ref: 'PDR-LARGE',
        stockInitial: largeInit,
        seuil: 1000,
        unitPrice: 10,
      };
      const movements = [
        { id: 'L1', ref: 'PDR-LARGE', type: 'Entrée', quantite: largeIn },
        { id: 'L2', ref: 'PDR-LARGE', type: 'Sortie', quantite: largeOut },
      ];
      expect(StockCalculationService.calculateStockActuel(article, movements)).toBe(1_250_000_000);
    });

    it('Special characters in strings: handles Arabic, French accents, symbols, and whitespace in references and designations', () => {
      const specialRef = '  PDR-#001/α-بيلي_Été  ';
      const article = {
        ref: specialRef,
        designation: 'رولمان بلي عالي الحرارة — Roulement Ø50×110 <Spécial>',
        stockInitial: 15,
        seuil: 5,
      };
      const movements = [
        { id: 'S1', ref: 'pdr-#001/α-بيلي_été', type: 'Entrée', quantite: 10 },
        { id: 'S2', ref: 'PDR-#001/α-بيلي_ÉTÉ', type: 'Sortie', quantite: 5 },
      ];

      const balance = StockCalculationService.calculateStockActuel(article, movements);
      expect(balance).toBe(20);
    });

    it('Null, undefined, and NaN inputs: sanitizes corrupted records without throwing', () => {
      const corruptedArticle = {
        ref: 'PDR-CORRUPT',
        stockInitial: 'not-a-number',
        seuil: null,
        unitPrice: undefined,
      };
      const corruptedMovements = [
        null,
        undefined,
        { ref: 'PDR-CORRUPT', type: 'Entrée', quantite: 'NaN' },
        { ref: 'PDR-CORRUPT', type: 'Entrée', quantite: '15' },
        { ref: null, type: 'Sortie', quantite: 10 },
      ];

      const balance = StockCalculationService.calculateStockActuel(
        corruptedArticle as any,
        corruptedMovements as any
      );
      expect(balance).toBe(15);
      expect(getStockStatus(NaN, undefined)).toBe('RUPTURE');
      expect(calculateStockStatus(NaN, 'abc' as any, null as any, undefined as any).stockActuel).toBe(0);
    });
  });
});
