import { Logger } from '../core/logger/LoggerService';

/**
 * TrendAnalysisService
 * Time-series analytics for application performance metrics over time.
 * Calculates moving averages, degradation trends, and performance stability ratios.
 */
export class TrendAnalysisService {
  static instance = null;

  constructor() {
    if (TrendAnalysisService.instance) {
      return TrendAnalysisService.instance;
    }

    this.history = []; // Array of metric snapshots
    this.maxSnapshots = 60; // Keep last 60 data points (~2 to 5 minutes of metrics)
    this.subscribers = new Set();

    TrendAnalysisService.instance = this;
  }

  /**
   * Record a metric snapshot into history
   */
  record(snapshot) {
    if (!snapshot) return;

    this.history.push({
      ...snapshot,
      timestampMs: snapshot.timestamp || Date.now(),
      timeFormatted: new Date(snapshot.timestamp || Date.now()).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    });

    if (this.history.length > this.maxSnapshots) {
      this.history.shift();
    }

    this.notifySubscribers();
  }

  /**
   * Calculate summary statistics and trends for a specific metric key (e.g. 'fps', 'eventLoopLagMs')
   */
  getTrend(metricKey) {
    if (this.history.length === 0) {
      return {
        avg: 0,
        min: 0,
        max: 0,
        p95: 0,
        direction: 'stable',
        percentChange: 0,
        dataPoints: 0,
      };
    }

    const values = this.history.map((h) => Number(h[metricKey]) || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = Number((sum / values.length).toFixed(1));
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate P95
    const sorted = [...values].sort((a, b) => a - b);
    const p95Idx = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Idx] || max;

    // Compare first half vs second half to determine trend direction
    let direction = 'stable';
    let percentChange = 0;

    if (values.length >= 6) {
      const mid = Math.floor(values.length / 2);
      const firstHalf = values.slice(0, mid);
      const secondHalf = values.slice(mid);

      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (avgFirst > 0) {
        percentChange = Number((((avgSecond - avgFirst) / avgFirst) * 100).toFixed(1));
      }

      if (metricKey === 'fps' || metricKey === 'cacheHitRate') {
        if (percentChange > 5) direction = 'improving';
        else if (percentChange < -5) direction = 'degrading';
      } else {
        // For lag / latency, lower is better
        if (percentChange < -5) direction = 'improving';
        else if (percentChange > 5) direction = 'degrading';
      }
    }

    return {
      avg,
      min,
      max,
      p95,
      direction,
      percentChange,
      dataPoints: values.length,
    };
  }

  /**
   * Get full performance report
   */
  getReport() {
    return {
      fpsTrend: this.getTrend('fps'),
      lagTrend: this.getTrend('eventLoopLagMs'),
      memoryTrend: this.getTrend('usedMemoryMB'),
      formulaTrend: this.getTrend('formulaAvgLatencyMs'),
      history: [...this.history],
      snapshotCount: this.history.length,
    };
  }

  /**
   * Subscribe to trend updates
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getReport());
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    const report = this.getReport();
    for (const sub of this.subscribers) {
      try {
        sub(report);
      } catch (err) {
        Logger.error('Trend subscriber error:', err, 'TrendAnalysis');
      }
    }
  }

  clear() {
    this.history = [];
    this.notifySubscribers();
  }
}

export const trendAnalysisService = new TrendAnalysisService();
export default trendAnalysisService;
