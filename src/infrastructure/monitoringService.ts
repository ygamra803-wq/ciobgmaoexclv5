/**
 * خدمة المراقبة والتحليلات - GMAO Nexus Monitoring & Analytics Service
 */
class MonitoringService {
  constructor() {
    this.metrics = new Map();
    this.events = [];
    this.maxEvents = 10000;
    this.thresholds = {
      slowOperation: 1000,
      verySlowOperation: 3000,
      criticalOperation: 5000
    };
  }

  /**
   * قياس العملية
   */
  async measure(operationName, fn, metadata = {}) {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = await fn();
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const duration = endTime - startTime;
      const endMemory = this.getMemoryUsage();

      this.recordMetric(operationName, {
        duration,
        memoryDelta: endMemory - startMemory,
        status: 'success',
        timestamp: new Date().toISOString(),
        metadata
      });

      // التحقق من الحدود
      this.checkThresholds(operationName, duration);

      return result;
    } catch (error) {
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const duration = endTime - startTime;

      this.recordMetric(operationName, {
        duration,
        status: 'error',
        error: error?.message || String(error),
        timestamp: new Date().toISOString(),
        metadata
      });

      throw error;
    }
  }

  /**
   * تسجيل الحدث
   */
  recordEvent(eventName, data = {}) {
    const event = {
      name: eventName,
      timestamp: new Date().toISOString(),
      data,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Unknown',
      url: typeof window !== 'undefined' && window.location ? window.location.href : ''
    };

    this.events.push(event);

    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    console.log('📊 حدث مسجل:', event);
  }

  /**
   * تسجيل المقياس
   */
  recordMetric(name, metric) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name);
    metrics.push(metric);

    // الاحتفاظ بآخر 1000 قياس فقط
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  /**
   * التحقق من الحدود
   */
  checkThresholds(operationName, duration) {
    let severity = 'normal';
    let message = '';

    if (duration > this.thresholds.criticalOperation) {
      severity = 'critical';
      message = `🚨 عملية حرجة البطء: ${operationName} استغرقت ${duration.toFixed(2)}ms`;
    } else if (duration > this.thresholds.verySlowOperation) {
      severity = 'warning';
      message = `⚠️ عملية بطيئة جداً: ${operationName} استغرقت ${duration.toFixed(2)}ms`;
    } else if (duration > this.thresholds.slowOperation) {
      severity = 'info';
      message = `ℹ️ عملية بطيئة: ${operationName} استغرقت ${duration.toFixed(2)}ms`;
    }

    if (severity !== 'normal') {
      console.warn(message);
      this.recordEvent('performance_threshold_exceeded', {
        operationName,
        duration,
        severity,
        message
      });
    }
  }

  /**
   * الحصول على إحصائيات العملية
   */
  getOperationStats(operationName) {
    const metrics = this.metrics.get(operationName) || [];
    if (metrics.length === 0) return null;

    const durations = metrics
      .filter(m => m.status === 'success')
      .map(m => m.duration);

    if (durations.length === 0) return null;

    const sorted = [...durations].sort((a, b) => a - b);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      count: metrics.length,
      avg: avg.toFixed(2),
      median: median.toFixed(2),
      min: Math.min(...durations).toFixed(2),
      max: Math.max(...durations).toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2),
      errors: metrics.filter(m => m.status === 'error').length
    };
  }

  /**
   * الحصول على استخدام الذاكرة
   */
  getMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize / 1048576; // MB
    }
    return 0;
  }

  /**
   * الحصول على تقرير الأداء
   */
  getPerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      operations: {},
      memory: {
        current: this.getMemoryUsage(),
        unit: 'MB'
      },
      events: this.events.slice(-100)
    };

    for (const [name] of this.metrics) {
      report.operations[name] = this.getOperationStats(name);
    }

    return report;
  }

  /**
   * طباعة التقرير
   */
  printReport() {
    const report = this.getPerformanceReport();
    console.group('📊 تقرير الأداء');
    console.table(report.operations);
    console.log('💾 الذاكرة:', report.memory);
    console.groupEnd();
  }

  /**
   * تصدير التقرير
   */
  exportReport() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const report = this.getPerformanceReport();
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-report-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * تصدير الأحداث
   */
  exportEvents() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const csv = this.convertEventsToCSV(this.events);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * تحويل الأحداث إلى CSV
   */
  convertEventsToCSV(events) {
    const headers = ['التاريخ والوقت', 'الحدث', 'البيانات'];
    const rows = events.map(event => [
      event.timestamp,
      event.name,
      JSON.stringify(event.data)
    ]);

    return [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');
  }

  /**
   * مسح البيانات
   */
  clear() {
    this.metrics.clear();
    this.events = [];
  }
}

export const monitoringService = new MonitoringService();
export default monitoringService;
