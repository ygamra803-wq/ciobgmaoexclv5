import { Logger } from '../core/logger/LoggerService';

/**
 * Production Performance Monitor & Metrics Collector
 * Tracks operation durations, percentile latency, memory deltas, and dispatches alerts for slow ops.
 */
class ProductionPerformanceMonitor {
  constructor() {
    this.metrics = new Map(); // Map<operationName, MetricItem[]>
    this.thresholds = {
      slow: 1000,     // 1s
      verySlow: 3000, // 3s
      critical: 5000, // 5s
    };
    this.alerts = [];
    this.maxMetricsPerOp = 1000;
  }

  getMemoryUsageMb() {
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      return Number((window.performance.memory.usedJSHeapSize / 1048576).toFixed(2));
    }
    return 0;
  }

  /**
   * Measures duration and memory usage of any sync or async task.
   */
  async measure(operationName, fn, context = {}) {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsageMb();

    try {
      const result = await fn();
      const durationMs = Number((performance.now() - startTime).toFixed(2));
      const endMemory = this.getMemoryUsageMb();
      const memoryDeltaMb = Number((endMemory - startMemory).toFixed(2));

      this.recordMetric(operationName, {
        durationMs,
        memoryDeltaMb,
        status: 'success',
        timestamp: new Date().toISOString(),
        ...context,
      });

      this.evaluateThresholds(operationName, durationMs);
      return result;
    } catch (error) {
      const durationMs = Number((performance.now() - startTime).toFixed(2));
      this.recordMetric(operationName, {
        durationMs,
        status: 'error',
        error: error.message || String(error),
        timestamp: new Date().toISOString(),
        ...context,
      });

      Logger.error(`Performance monitor caught error in [${operationName}] after ${durationMs}ms`, error, 'PerfMonitor');
      throw error;
    }
  }

  recordMetric(name, metric) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const list = this.metrics.get(name);
    list.push(metric);
    if (list.length > this.maxMetricsPerOp) {
      list.shift();
    }
  }

  evaluateThresholds(operationName, durationMs) {
    let severity = null;
    let message = '';

    if (durationMs > this.thresholds.critical) {
      severity = 'critical';
      message = `🚨 Opération critique lente: [${operationName}] a pris ${durationMs}ms`;
    } else if (durationMs > this.thresholds.verySlow) {
      severity = 'warning';
      message = `⚠️ Opération très lente: [${operationName}] a pris ${durationMs}ms`;
    } else if (durationMs > this.thresholds.slow) {
      severity = 'info';
      message = `ℹ️ Opération lente: [${operationName}] a pris ${durationMs}ms`;
    }

    if (severity) {
      const alertEntry = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        operationName,
        durationMs,
        severity,
        message,
      };
      this.alerts.push(alertEntry);
      if (this.alerts.length > 200) this.alerts.shift();

      Logger.warn(message, alertEntry, 'PerfMonitor');
    }
  }

  getStats(operationName) {
    const list = this.metrics.get(operationName) || [];
    if (list.length === 0) return null;

    const successfulDurations = list
      .filter((m) => m.status === 'success')
      .map((m) => m.durationMs)
      .sort((a, b) => a - b);

    if (successfulDurations.length === 0) {
      return {
        count: list.length,
        errors: list.filter((m) => m.status === 'error').length,
        avg: '0.00',
        median: '0.00',
        min: '0.00',
        max: '0.00',
        p95: '0.00',
        p99: '0.00',
      };
    }

    const sum = successfulDurations.reduce((a, b) => a + b, 0);
    const avg = sum / successfulDurations.length;
    const median = successfulDurations[Math.floor(successfulDurations.length * 0.5)];
    const p95 = successfulDurations[Math.floor(successfulDurations.length * 0.95)];
    const p99 = successfulDurations[Math.floor(successfulDurations.length * 0.99)];
    const min = successfulDurations[0];
    const max = successfulDurations[successfulDurations.length - 1];

    return {
      count: list.length,
      errors: list.filter((m) => m.status === 'error').length,
      avg: avg.toFixed(2),
      median: median.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2),
    };
  }

  getAllMetricsSummary() {
    const summary = {};
    for (const opName of this.metrics.keys()) {
      summary[opName] = this.getStats(opName);
    }
    return summary;
  }

  getAlerts() {
    return this.alerts;
  }

  clear() {
    this.metrics.clear();
    this.alerts = [];
  }
}

export const productionPerformanceMonitor = new ProductionPerformanceMonitor();
export default productionPerformanceMonitor;
