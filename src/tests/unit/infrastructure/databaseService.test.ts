import { describe, it, expect, beforeEach } from 'vitest';
import { errorRecoveryService } from '@/infrastructure/errorRecoveryService.js';
import { monitoringService } from '@/infrastructure/monitoringService.js';

describe('Database & Persistence Infrastructure Unit Tests', () => {
  beforeEach(() => {
    monitoringService.clear();
  });

  it('يجب قياس أداء عمليات التخزين والاسترجاع بنجاح', async () => {
    const fakeSaveOp = async () => {
      return { success: true, count: 100 };
    };

    const res = await monitoringService.measure('save_stock_batch', fakeSaveOp, { module: 'stock' });
    expect(res.success).toBe(true);

    const stats = monitoringService.getOperationStats('save_stock_batch');
    expect(stats).toBeDefined();
    expect(stats.count).toBe(1);
    expect(stats.errors).toBe(0);
  });

  it('يجب معالجة واسترجاع أخطاء التخزين بواسطة ErrorRecoveryService', async () => {
    const mockError = new Error('IndexedDB connection lost');
    mockError.name = 'InvalidStateError';

    const mockContext = {
      db: {
        close: async () => {},
        open: async () => {},
      },
    };

    const recovered = await errorRecoveryService.recover(mockError, mockContext);
    expect(recovered).toBe(true);

    const logs = errorRecoveryService.getErrorLog();
    expect(logs.length).toBeGreaterThan(0);
  });
});
