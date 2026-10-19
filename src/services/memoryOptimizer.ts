import { Logger } from '../core/logger/LoggerService';
import { multiLevelCacheManager } from '../core/cache/MultiLevelCacheManager';
import { FormulaEngineOptimizer } from '../utils/formulaEngineOptimizer';

/**
 * MemoryOptimizer
 * Monitors heap memory footprint, manages automatic LRU eviction, and prevents memory leaks.
 */
export class MemoryOptimizer {
  static checkIntervalId = null;
  static maxMemoryThresholdRatio = 0.75; // 75% heap limit

  /**
   * Gets current memory usage stats from window.performance.memory (if available)
   */
  static getMemoryInfo() {
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      const mem = window.performance.memory;
      const usedMB = (mem.usedJSHeapSize / (1024 * 1024)).toFixed(1);
      const totalMB = (mem.totalJSHeapSize / (1024 * 1024)).toFixed(1);
      const limitMB = (mem.jsHeapSizeLimit / (1024 * 1024)).toFixed(1);
      const ratio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;

      return {
        usedMB: Number(usedMB),
        totalMB: Number(totalMB),
        limitMB: Number(limitMB),
        usageRatio: Number(ratio.toFixed(2)),
        usagePercentage: `${(ratio * 100).toFixed(1)}%`,
        supported: true,
      };
    }

    return {
      usedMB: 0,
      totalMB: 0,
      limitMB: 0,
      usageRatio: 0,
      usagePercentage: 'N/A',
      supported: false,
    };
  }

  /**
   * Triggers proactive memory cleanup (evicts L1/L3 caches and formula memoization)
   */
  static purgeMemory() {
    Logger.info('🧹 Memory purge executed: Cleaning caches...', null, 'MemoryOptimizer');
    FormulaEngineOptimizer.clearMemoCache();
    multiLevelCacheManager.invalidateByTag('transient');
  }

  /**
   * Starts periodic memory health monitoring
   */
  static startMonitoring(intervalMs = 15000, onMemoryAlert = null) {
    if (this.checkIntervalId) return;

    this.checkIntervalId = setInterval(() => {
      const mem = this.getMemoryInfo();
      if (mem.supported && mem.usageRatio >= this.maxMemoryThresholdRatio) {
        Logger.warn(`⚠️ High memory footprint detected: ${mem.usagePercentage} (${mem.usedMB} MB)`, null, 'MemoryOptimizer');
        this.purgeMemory();

        if (onMemoryAlert) {
          onMemoryAlert(mem);
        }
      }
    }, intervalMs);

    Logger.info('⚡ Memory Monitoring active', null, 'MemoryOptimizer');
  }

  /**
   * Stops periodic memory monitoring
   */
  static stopMonitoring() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }
}

export default MemoryOptimizer;
