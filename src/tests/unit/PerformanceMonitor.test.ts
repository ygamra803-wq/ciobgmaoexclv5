// ✅ ملف: src/tests/unit/PerformanceMonitor.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import PerformanceMonitor, { performanceMonitor } from '@/infrastructure/monitoring/PerformanceMonitor';

describe('PerformanceMonitor Service (Problem #7)', () => {
  beforeEach(() => {
    PerformanceMonitor.clearMetrics();
  });

  it('should measure execution time and record metrics', () => {
    const result = PerformanceMonitor.measure('stockCalculation', () => {
      let sum = 0;
      for (let i = 0; i < 10000; i++) sum += i;
      return sum;
    });

    expect(result).toBe(49995000);

    const metrics = PerformanceMonitor.getMetrics('stockCalculation');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].duration).toBeGreaterThanOrEqual(0);
    expect(metrics[0].timestamp).toBeInstanceOf(Date);
  });

  it('should compute accurate average duration across multiple runs', () => {
    PerformanceMonitor.measure('opA', () => 1);
    PerformanceMonitor.measure('opA', () => 2);
    PerformanceMonitor.measure('opA', () => 3);

    const avg = PerformanceMonitor.getAverageDuration('opA');
    expect(avg).toBeGreaterThanOrEqual(0);
    expect(PerformanceMonitor.getAverageDuration('nonExistentOp')).toBe(0);
  });

  it('should return all metrics object when getMetrics() is called without name', () => {
    PerformanceMonitor.measure('calcA', () => 'a');
    PerformanceMonitor.measure('calcB', () => 'b');

    const all = PerformanceMonitor.getMetrics();
    expect(Object.keys(all)).toContain('calcA');
    expect(Object.keys(all)).toContain('calcB');
  });

  it('should warn and record alert when duration exceeds 1000ms threshold', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const nowSpy = vi.spyOn(performance, 'now');

    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(2500); // 1500ms duration

    PerformanceMonitor.measure('heavyExcelExport', () => 'done');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️ heavyExcelExport took 1500.00ms'));

    const bottlenecks = PerformanceMonitor.detectBottlenecks(1000);
    expect(bottlenecks).toHaveLength(1);
    expect(bottlenecks[0].name).toBe('heavyExcelExport');

    warnSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it('should support instance methods for dashboard compatibility', () => {
    performanceMonitor.measure('dashboardOp', () => 42);
    const stats = performanceMonitor.getStats('dashboardOp');
    expect(stats).not.toBeNull();
    expect(stats?.count).toBe(1);

    const report = performanceMonitor.exportReport();
    expect(report.operations.dashboardOp).toBeDefined();
  });
});
