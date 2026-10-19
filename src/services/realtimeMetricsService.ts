import { MemoryOptimizer } from './memoryOptimizer';
import { multiLevelCacheManager } from '../core/cache/MultiLevelCacheManager';
import { Logger } from '../core/logger/LoggerService';

/**
 * RealtimeMetricsService
 * Collects live application performance metrics: FPS, Event Loop Lag, Memory Heap, Cache Hit Rate, Formula Latency.
 */
export class RealtimeMetricsService {
  static instance = null;

  constructor() {
    if (RealtimeMetricsService.instance) {
      return RealtimeMetricsService.instance;
    }

    this.subscribers = new Set();
    this.currentMetrics = {
      fps: 60,
      eventLoopLagMs: 0,
      usedMemoryMB: 0,
      memoryPercentage: '0%',
      cacheHitRate: '100.0%',
      totalCacheHits: 0,
      cacheTotalSavedMs: 0,
      formulaAvgLatencyMs: 0.8,
      timestamp: Date.now(),
    };

    this.frameCount = 0;
    this.lastFpsCheckTime = performance.now();
    this.isMonitoring = false;

    RealtimeMetricsService.instance = this;
  }

  /**
   * Start collecting real-time metrics (FPS loop and Event loop lag)
   */
  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // 1. FPS Tracker loop
    const measureFps = () => {
      if (!this.isMonitoring) return;
      this.frameCount++;
      const now = performance.now();
      const elapsed = now - this.lastFpsCheckTime;

      if (elapsed >= 1000) {
        this.currentMetrics.fps = Math.min(60, Math.round((this.frameCount * 1000) / elapsed));
        this.frameCount = 0;
        this.lastFpsCheckTime = now;
        this.updateAndNotify();
      }

      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(measureFps);
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(measureFps);
    }

    // 2. Event Loop Lag Tracker (Measures main-thread blocking)
    let lastTick = performance.now();
    this.lagInterval = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick - 500; // Expected 500ms
      this.currentMetrics.eventLoopLagMs = Math.max(0, Number(delta.toFixed(1)));
      lastTick = now;
    }, 500);

    Logger.info('📊 Realtime Metrics Service started', null, 'RealtimeMetrics');
  }

  /**
   * Stop collecting real-time metrics
   */
  stop() {
    this.isMonitoring = false;
    if (this.lagInterval) {
      clearInterval(this.lagInterval);
    }
  }

  /**
   * Update internal metrics and notify subscribers
   */
  updateAndNotify() {
    const mem = MemoryOptimizer.getMemoryInfo();
    const cacheMetrics = multiLevelCacheManager.getMetrics();

    this.currentMetrics = {
      ...this.currentMetrics,
      usedMemoryMB: mem.usedMB,
      memoryPercentage: mem.usagePercentage,
      cacheHitRate: cacheMetrics.hitRate,
      totalCacheHits: cacheMetrics.totalHits,
      cacheTotalSavedMs: cacheMetrics.totalSavedMs,
      timestamp: Date.now(),
    };

    for (const sub of this.subscribers) {
      try {
        sub(this.currentMetrics);
      } catch (err) {
        Logger.error('Metric subscriber error:', err, 'RealtimeMetrics');
      }
    }
  }

  /**
   * Record formula latency sample
   */
  recordFormulaLatency(ms) {
    this.currentMetrics.formulaAvgLatencyMs = Number(
      ((this.currentMetrics.formulaAvgLatencyMs * 0.8) + (ms * 0.2)).toFixed(2)
    );
  }

  /**
   * Subscribe to metrics updates
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.currentMetrics);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Get current metric snapshot
   */
  getSnapshot() {
    return { ...this.currentMetrics };
  }
}

export const realtimeMetricsService = new RealtimeMetricsService();
export default realtimeMetricsService;
