// ✅ ملف: src/infrastructure/monitoring/PerformanceMonitor.ts

export interface MetricEntry {
  duration: number;
  timestamp: Date | string;
  memoryDelta?: number;
  status?: 'success' | 'error';
  error?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceAlert {
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  operationName: string;
  duration: number;
}

/**
 * 📊 PerformanceMonitor
 * ✅ مراقبة الأداء اللحظية (Real-time metrics)، كشف الاختناقات (Bottleneck detection)، والتنبيهات
 */
export class PerformanceMonitor {
  private static metrics: Map<string, MetricEntry[]> = new Map();
  private static alertsList: PerformanceAlert[] = [];
  private static thresholds = {
    slow: 1000,
    verySlow: 3000,
    critical: 5000,
  };

  /**
   * Static measure: يقيس زمن تنفيذ دالة متزامنة أو غير متزامنة ويسجل التنبيه عند تجاوز 1000ms
   */
  static measure(name: string, fn: () => any): any {
    const start = performance.now();
    const result = fn();

    if (result && typeof result.then === 'function') {
      return result.then((res: any) => {
        const duration = performance.now() - start;
        this.recordStaticMetric(name, duration);
        return res;
      });
    }

    const duration = performance.now() - start;
    this.recordStaticMetric(name, duration);
    return result;
  }

  private static recordStaticMetric(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const list = this.metrics.get(name)!;
    list.push({
      duration,
      status: 'success',
      timestamp: new Date(),
    });

    if (list.length > 1000) {
      list.shift();
    }

    if (duration > 1000) {
      const msg = `⚠️ ${name} took ${duration.toFixed(2)}ms`;
      console.warn(msg);
      this.alertsList.push({
        timestamp: new Date().toISOString(),
        severity: duration > this.thresholds.critical ? 'critical' : duration > this.thresholds.verySlow ? 'warning' : 'info',
        message: msg,
        operationName: name,
        duration,
      });
    }
  }

  static getMetrics(name?: string): any {
    if (name) {
      return this.metrics.get(name) || [];
    }
    return Object.fromEntries(this.metrics);
  }

  static getAverageDuration(name: string): number {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return 0;

    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / metrics.length;
  }

  static detectBottlenecks(thresholdMs: number = 1000): Array<{ name: string; averageDuration: number; count: number }> {
    const bottlenecks: Array<{ name: string; averageDuration: number; count: number }> = [];
    for (const [name, list] of this.metrics.entries()) {
      const avg = this.getAverageDuration(name);
      if (avg > thresholdMs) {
        bottlenecks.push({ name, averageDuration: avg, count: list.length });
      }
    }
    return bottlenecks;
  }

  static clearMetrics(): void {
    this.metrics.clear();
    this.alertsList = [];
  }

  // ============================================================================
  // Instance compatibility API (used by PerformanceDashboardView.jsx)
  // ============================================================================

  get metrics(): Map<string, MetricEntry[]> {
    return PerformanceMonitor.metrics;
  }

  get alerts(): PerformanceAlert[] {
    return PerformanceMonitor.alertsList;
  }

  measure(operationName: string, fn: () => any): any {
    return PerformanceMonitor.measure(operationName, fn);
  }

  getMetrics(name?: string) {
    return PerformanceMonitor.getMetrics(name);
  }

  getAverageDuration(name: string): number {
    return PerformanceMonitor.getAverageDuration(name);
  }

  getMemoryUsage(): number {
    const perf = performance as any;
    if (typeof performance !== 'undefined' && perf.memory) {
      return perf.memory.usedJSHeapSize / 1048576;
    }
    return 0;
  }

  getStats(operationName: string) {
    const metrics = PerformanceMonitor.metrics.get(operationName) || [];
    if (metrics.length === 0) return null;

    const durations = metrics.map((m) => m.duration);
    const sorted = [...durations].sort((a, b) => a - b);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    return {
      count: metrics.length,
      avg: avg.toFixed(2),
      median: median.toFixed(2),
      min: Math.min(...durations).toFixed(2),
      max: Math.max(...durations).toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2),
      errors: metrics.filter((m) => m.status === 'error').length,
    };
  }

  exportReport() {
    const report: Record<string, any> = {
      timestamp: new Date().toISOString(),
      operations: {},
      memory: {
        current: this.getMemoryUsage(),
        unit: 'MB',
      },
      alerts: PerformanceMonitor.alertsList.slice(-50),
    };

    for (const [name] of PerformanceMonitor.metrics) {
      report.operations[name] = this.getStats(name);
    }

    return report;
  }
}

export const performanceMonitor = new PerformanceMonitor();
export default PerformanceMonitor;
