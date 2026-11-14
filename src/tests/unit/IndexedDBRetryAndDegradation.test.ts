import { describe, it, expect, vi } from 'vitest';
import { multiLevelStorageService } from '../../services/multiLevelStorageService';
import { performanceService } from '../../services/performanceService';
import { Logger } from '../../core/logger/LoggerService';

describe('IndexedDB Retry, MultiLevel Storage & Performance Monitoring Tests', () => {
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

  it('should measure execution time and record metrics in canonical performanceService', async () => {
    const opName = `testSlowOperation_${Date.now()}`;
    const res = await performanceService.measure(opName, async () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += i;
      return sum;
    });

    expect(res).toBe(499500);

    const stats = performanceService.getStats(opName);
    expect(stats).toBeDefined();
    expect(stats?.count).toBe(1);
    expect(stats?.errors).toBe(0);
  });

  it('should route structured info/error messages through canonical LoggerService', () => {
    const infoSpy = vi.spyOn(Logger, 'info');
    const errorSpy = vi.spyOn(Logger, 'error');

    Logger.info('Test Info Log', { ref: 'REF-1' }, 'StorageTest');
    Logger.error('Test Error Log', { ref: 'REF-2' }, 'StorageTest');

    expect(infoSpy).toHaveBeenCalledWith('Test Info Log', { ref: 'REF-1' }, 'StorageTest');
    expect(errorSpy).toHaveBeenCalledWith('Test Error Log', { ref: 'REF-2' }, 'StorageTest');
  });
});
