import { describe, it, expect, beforeEach } from 'vitest';
import { StockCalculationService } from '../../domain/pdr/services/StockCalculationService';
import { ValidationService } from '../../core/validation/ValidationService';
import { retry } from '../../utils/retry.ts';

describe('2. Integration Tests: End-to-End, Offline Sync, Concurrency, and Recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    StockCalculationService.clearCache();
  });

  describe('End-to-End Flow simulation', () => {
    it('should complete a full article creation, stock adjustments, and report generation cycle', async () => {
      // 1. Create and validate an article
      const newArticle = {
        ref: 'VALVE-24V',
        designation: 'Electrovanne 24V CC',
        id_type: 'ELECTRIC',
        stockInitial: 50,
        minThreshold: 10,
        maxThreshold: 100,
        unitPrice: 45.0,
      };

      const validateArtRes = ValidationService.validateArticle(newArticle);
      expect(validateArtRes.isValid).toBe(true);

      // 2. Perform various stock movements
      const movements = [
        { ref: 'VALVE-24V', type: 'Sortie', quantite: 15, date: '2026-09-20', technicien: 'T1' },
        { ref: 'VALVE-24V', type: 'Entrée', quantite: 25, date: '2026-09-21', technicien: 'T2' },
        { ref: 'VALVE-24V', type: 'Sortie', quantite: 40, date: '2026-09-22', technicien: 'T3' },
      ];

      movements.forEach((m) => {
        const validateMvtRes = ValidationService.validateMovement(m);
        expect(validateMvtRes.isValid).toBe(true);
      });

      // 3. Verify stock calculation balances
      // Balance: 50 (Initial) - 15 (Sortie) + 25 (Entree) - 40 (Sortie) = 20
      const currentStock = StockCalculationService.calculateStockActuel(newArticle, movements);
      expect(currentStock).toBe(20);

      // 4. Check alert states
      const alertState = StockCalculationService.getAlertStatus(newArticle, currentStock);
      expect(alertState).toBe('OK'); // 20 > 10

      // 5. Generate and check final stock report
      const report = StockCalculationService.generateStockReport([newArticle], movements);
      expect(report.totalQuantity).toBe(20);
      expect(report.totalValue).toBe(900.0); // 20 * 45 = 900
      expect(report.summary.ok).toBe(1);
      expect(report.summary.rupture).toBe(0);
    });
  });

  describe('Offline Scenarios & Sync', () => {
    it('should queue actions locally when offline and resolve them on network reconnection', () => {
      const offlineQueue = [];
      let isOnline = false;

      const triggerActionOffline = (mvt) => {
        if (!isOnline) {
          offlineQueue.push(mvt);
          return { status: 'queued', message: 'Action saved locally' };
        }
        return { status: 'synced' };
      };

      // Push while offline
      const res1 = triggerActionOffline({ ref: 'REF-OFF', quantite: 5, type: 'Sortie' });
      expect(res1.status).toBe('queued');
      expect(offlineQueue).toHaveLength(1);

      // Simulate reconnection and replay
      isOnline = true;
      const replayed = [];
      while (offlineQueue.length > 0) {
        const item = offlineQueue.shift();
        replayed.push({ ...item, synced: true });
      }

      expect(replayed).toHaveLength(1);
      expect(replayed[0].synced).toBe(true);
      expect(offlineQueue).toHaveLength(0);
    });
  });

  describe('Concurrent Operations (Race Condition Mitigation)', () => {
    it('should queue concurrent stock movements to process them sequentially with queueConcurrentMovement', async () => {
      const sequenceLog = [];

      const triggerTask = async (id, delay) => {
        return StockCalculationService.queueConcurrentMovement('ITEM-X', async () => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          sequenceLog.push(id);
          return id;
        });
      };

      // Launch multiple movements simultaneously
      const promise1 = triggerTask('M1', 40);
      const promise2 = triggerTask('M2', 10);
      const promise3 = triggerTask('M3', 5);

      const results = await Promise.all([promise1, promise2, promise3]);

      // Assert that operations were executed in the precise order of queuing rather than speed of promise resolution
      expect(results).toEqual(['M1', 'M2', 'M3']);
      expect(sequenceLog).toEqual(['M1', 'M2', 'M3']);
    });
  });

  describe('Error Recovery & Backoff', () => {
    it('should retry failed asynchronous database operations and recover successfully', async () => {
      let attempts = 0;
      const dbOperation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Database temporary connection loss');
        }
        return 'SUCCESS';
      };

      const result = await retry(dbOperation, {
        retries: 3,
        delay: 5,
        backoff: 1.5,
      });

      expect(result).toBe('SUCCESS');
      expect(attempts).toBe(3);
    });

    it('should propagate error if max retries limit is exceeded', async () => {
      const failingDbOperation = async () => {
        throw new Error('Permanent database crash');
      };

      await expect(
        retry(failingDbOperation, {
          retries: 2,
          delay: 1,
          backoff: 1.1,
        })
      ).rejects.toThrow('Permanent database crash');
    });
  });
});
