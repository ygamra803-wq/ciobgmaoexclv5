import { describe, it, expect } from 'vitest';
import { multiLevelStorageService } from '../../services/multiLevelStorageService';
import { healthCheckService } from '../../services/healthCheckService';
import { productionPerformanceMonitor } from '../../services/productionPerformanceMonitor';
import { productionLoggerService } from '../../services/productionLoggerService';

describe('IndexedDB Retry, MultiLevel Storage & Health Check Tests', () => {
  it('should read and write using multiLevelStorageService gracefully', async () => {
    const key = `test_key_${Date.now()}`;
    const value = { name: 'Pompe Hydraulique', ref: 'HYD-100' };

    const setRes = await multiLevelStorageService.setItem(key, value);
    expect(setRes).toBe(true);

    const getRes = await multiLevelStorageService.getItem(key);
    expect(getRes).toEqual(value);

    const info = multiLevelStorageService.getStorageInfo();
    expect(info.available).toBe(true);

    await multiLevelStorageService.removeItem(key);
  });

  it('should execute health check service and report overall health status', async () => {
    const report = await healthCheckService.runAllChecks();
    expect(report).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(report.overall);
    expect(report.checks.storage).toBeDefined();
    expect(report.checks.memory).toBeDefined();
  });

  it('should measure execution time and record alerts in productionPerformanceMonitor', async () => {
    const res = await productionPerformanceMonitor.measure('testSlowOperation', async () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += i;
      return sum;
    });

    expect(res).toBe(499500);

    const stats = productionPerformanceMonitor.getStats('testSlowOperation');
    expect(stats).toBeDefined();
    expect(stats.count).toBe(1);
    expect(stats.errors).toBe(0);
  });

  it('should record, query, and export logs in productionLoggerService', async () => {
    productionLoggerService.info('Test Info Log', { ref: 'REF-1' });
    productionLoggerService.error('Test Error Log', { ref: 'REF-2' });

    const logs = await productionLoggerService.getLogs({ level: 'ERROR' });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].message).toBe('Test Error Log');

    const csv = await productionLoggerService.exportLogsAsCSV();
    expect(csv).toContain('Timestamp');
    expect(csv).toContain('Test Error Log');
  });
});
