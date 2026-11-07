import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor, monitor } from '@/utils/PerformanceMonitor';

describe('PerformanceMonitor Service (Live Production Monitor)', () => {
  let perf: PerformanceMonitor;

  beforeEach(() => {
    perf = new PerformanceMonitor();
  });

  it('should measure execution time and record metrics', async () => {
    const result = await perf.measure('stockCalculation', () => {
      let sum = 0;
      for (let i = 0; i < 10000; i++) sum += i;
      return sum;
    });

    expect(result).toBe(49995000);

    const stats = perf.getStats('stockCalculation');
    expect(stats).not.toBeNull();
    expect(stats?.count).toBe(1);
    expect(stats?.avg).toBeGreaterThanOrEqual(0);
  });

  it('should compute accurate average, min, and max duration across multiple runs', async () => {
    perf.recordMetric('opA', 10, 'success');
    perf.recordMetric('opA', 20, 'success');
    perf.recordMetric('opA', 30, 'success');

    const stats = perf.getStats('opA');
    expect(stats).toEqual({
      avg: 20,
      min: 10,
      max: 30,
      count: 3,
    });
    expect(perf.getStats('nonExistentOp')).toBeNull();
  });

  it('should expose singleton monitor instance used by App.tsx', async () => {
    const res = await monitor.measure('singletonCheck', () => 42);
    expect(res).toBe(42);
    expect(monitor.getStats('singletonCheck')?.count).toBeGreaterThanOrEqual(1);
  });
});
