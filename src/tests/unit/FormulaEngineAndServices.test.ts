import { describe, it, expect, beforeEach } from 'vitest';
import {
  safeNum,
  calculateStockStatus,
  sumIfs,
  countIfs,
} from '../../utils/formulaEngine';
import { StockCalculationService } from '../../domain/pdr/services/StockCalculationService';
import { ValidationService } from '../../core/validation/ValidationService';

describe('1. Unit Tests: Formula Engine, Stock Services, & Validation', () => {
  beforeEach(() => {
    StockCalculationService.clearCache();
  });

  describe('formulaEngine.js Tests', () => {
    it('should safely convert inputs to numeric values via safeNum', () => {
      expect(safeNum(42)).toBe(42);
      expect(safeNum('100.5')).toBe(100.5);
      expect(safeNum(null, 10)).toBe(10);
      expect(safeNum(undefined, -1)).toBe(-1);
      expect(safeNum('', 0)).toBe(0);
      expect(safeNum('not-a-number', 99)).toBe(99);
      expect(safeNum(NaN, 5)).toBe(5);
      expect(safeNum(Infinity, 0)).toBe(0);
    });

    it('should calculate stock status and set alert levels via calculateStockStatus', () => {
      // Normal stock, no alerts
      const res1 = calculateStockStatus(50, 20, 10, 5);
      expect(res1.stockActuel).toBe(60); // 50 + 20 - 10
      expect(res1.alerte).toBe('OK');

      // Low stock trigger ALERTE status (<= threshold)
      const res2 = calculateStockStatus(10, 5, 12, 5);
      expect(res2.stockActuel).toBe(3); // 10 + 5 - 12
      expect(res2.alerte).toBe('ALERTE');

      // Out of stock trigger RUPTURE status (<= 0)
      const res3 = calculateStockStatus(10, 0, 15, 5);
      expect(res3.stockActuel).toBe(0); // Display clamped to 0
      expect(res3.stockActuelRaw).toBe(-5); // Raw negative retained
      expect(res3.alerte).toBe('RUPTURE');

      // Single purchase (isAchatUnique) ignores standard threshold alerts
      const res4 = calculateStockStatus(10, 0, 10, 5, true);
      expect(res4.stockActuel).toBe(0);
      expect(res4.alerte).toBe('OK');
    });

    it('should support Excel equivalents: sumIfs and countIfs', () => {
      const data = [
        { ref: 'A', type: 'Entrée', val: 10 },
        { ref: 'A', type: 'Sortie', val: 5 },
        { ref: 'B', type: 'Entrée', val: 25 },
        { ref: 'A', type: 'Entrée', val: 15 },
        null, // safe handling of null
      ];

      // sumIfs
      expect(sumIfs(data, 'val', 'ref', 'A')).toBe(30);
      expect(sumIfs(data, 'val', 'ref', 'A', 'type', 'Entrée')).toBe(25);
      expect(sumIfs(data, 'val', 'ref', 'C')).toBe(0);

      // countIfs
      expect(countIfs(data, 'ref', 'A')).toBe(3);
      expect(countIfs(data, 'ref', 'A', 'type', 'Entrée')).toBe(2);
      expect(countIfs(data, 'type', 'Sortie')).toBe(1);
    });
  });

  describe('StockCalculationService Tests', () => {
    const sampleArticles = [
      { ref: 'ART-01', designation: 'Valve', stockInitial: 20, seuil: 5, unitPrice: 10 },
      { ref: 'ART-02', designation: 'Hose', stockInitial: 5, seuil: 8, unitPrice: 5 },
    ];

    const sampleMovements = [
      { ref: 'ART-01', type: 'Entrée', quantite: 10 },
      { ref: 'ART-01', type: 'Sortie Interne', quantite: 15 },
      { ref: 'ART-02', type: 'Entrée Externe', quantite: 10 },
      { ref: 'ART-02', type: 'Sortie Externe', quantite: 4 },
    ];

    it('should calculate total entrees and sorties accurately with internal cache', () => {
      const ent1 = StockCalculationService.calculateEntrees('ART-01', sampleMovements);
      const sor1 = StockCalculationService.calculateSorties('ART-01', sampleMovements);
      expect(ent1).toBe(10);
      expect(sor1).toBe(15);

      const ent2 = StockCalculationService.calculateEntrees('ART-02', sampleMovements);
      const sor2 = StockCalculationService.calculateSorties('ART-02', sampleMovements);
      expect(ent2).toBe(10);
      expect(sor2).toBe(4);
    });

    it('should compute actual current stock and alerts', () => {
      const stock1 = StockCalculationService.calculateStockActuel(sampleArticles[0], sampleMovements);
      expect(stock1).toBe(15); // 20 + 10 - 15
      expect(StockCalculationService.getAlertStatus(sampleArticles[0], stock1)).toBe('OK'); // 15 > 5

      const stock2 = StockCalculationService.calculateStockActuel(sampleArticles[1], sampleMovements);
      expect(stock2).toBe(11); // 5 + 10 - 4
      expect(StockCalculationService.getAlertStatus(sampleArticles[1], stock2)).toBe('OK'); // 11 > 8
    });

    it('should generate detailed stock reports and verify discrepancies', async () => {
      const report = StockCalculationService.generateStockReport(sampleArticles, sampleMovements);
      expect(report.totalArticles).toBe(2);
      expect(report.totalQuantity).toBe(26); // 15 + 11
      expect(report.totalValue).toBe(205); // (15 * 10) + (11 * 5) = 150 + 55

      // verifyCalculations helper
      const verification = await StockCalculationService.verifyCalculations(sampleArticles, sampleMovements);
      expect(verification.isValid).toBe(true);
    });
  });

  describe('StockAvailabilityService Tests (checkAvailability)', () => {
    const article = { ref: 'REF-AVAIL', stockInitial: 10, seuil: 2 };
    const movements = [
      { ref: 'REF-AVAIL', type: 'Entrée', quantite: 5 },
      { ref: 'REF-AVAIL', type: 'Sortie', quantite: 3 },
    ]; // Current Stock = 10 + 5 - 3 = 12

    it('should approve requests when current stock is sufficient', () => {
      const res = StockCalculationService.checkAvailability('REF-AVAIL', 8, article, movements);
      expect(res.available).toBe(true);
      expect(res.currentStock).toBe(12);
      expect(res.shortage).toBe(0);
      expect(res.message).toContain('suffisant');
    });

    it('should reject requests exceeding current stock levels', () => {
      const res = StockCalculationService.checkAvailability('REF-AVAIL', 15, article, movements);
      expect(res.available).toBe(false);
      expect(res.currentStock).toBe(12);
      expect(res.shortage).toBe(3);
      expect(res.message).toContain('Stock insuffisant');
    });

    it('should reject invalid or negative quantity requests safely', () => {
      const res = StockCalculationService.checkAvailability('REF-AVAIL', -5, article, movements);
      expect(res.available).toBe(false);
      expect(res.currentStock).toBe(0);
      expect(res.requestedQty).toBe(-5);
    });
  });

  describe('ValidationService Tests', () => {
    it('should validate articles correctly through schemas', () => {
      const validArticle = {
        ref: 'REF-001',
        designation: 'Moteur asynchrone',
        id_type: 'MOTEUR',
        stockInitial: 5,
        minThreshold: 2,
        maxThreshold: 10,
        unitPrice: 250,
      };

      const res = ValidationService.validateArticle(validArticle);
      expect(res.isValid).toBe(true);
      expect(res.data).toBeDefined();

      const invalidArticle = {
        ref: '', // invalid
        designation: 'Moteur',
        id_type: 'MOTEUR',
        stockInitial: -5, // invalid
        minThreshold: 2,
        maxThreshold: 10,
        unitPrice: 250,
      };

      const resErr = ValidationService.validateArticle(invalidArticle);
      expect(resErr.isValid).toBe(false);
    });

    it('should validate movement schemas correctly', () => {
      const validMvt = {
        ref: 'REF-001',
        quantite: 10,
        type: 'Entrée',
        date: '2026-09-20',
        technicien: 'TECH-01',
      };

      const res = ValidationService.validateMovement(validMvt);
      expect(res.isValid).toBe(true);

      const invalidMvt = {
        ref: 'REF-001',
        quantite: 0, // invalid (must be > 0)
        type: 'Transfert', // invalid type enum
        date: '',
        technicien: '',
      };

      const resErr = ValidationService.validateMovement(invalidMvt);
      expect(resErr.isValid).toBe(false);
    });

    it('should validate user data schemas correctly', () => {
      const validUser = {
        username: 'achraf',
        email: 'achraf@gmail.com',
        password: 'securePassword123',
        role: 'ADMIN',
      };

      const res = ValidationService.validateUser(validUser);
      expect(res.isValid).toBe(true);

      const invalidUser = {
        username: 'ac', // too short
        email: 'invalid-email', // bad pattern
        password: '123', // too short
        role: 'SUPERADMIN', // not in enum
      };

      const resErr = ValidationService.validateUser(invalidUser);
      expect(resErr.isValid).toBe(false);
    });
  });
});
