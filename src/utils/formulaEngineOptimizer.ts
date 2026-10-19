import { safeNum } from './formulaEngine';
import { multiLevelCacheManager } from '../core/cache/MultiLevelCacheManager';
import { Logger } from '../core/logger/LoggerService';

/**
 * Formula Engine Optimizer
 * High-performance memoization, indexed batch evaluation, and formula execution optimizer.
 */
export class FormulaEngineOptimizer {
  static memoCache = new Map();
  static maxMemoEntries = 5000;

  /**
   * Memoizes a formula evaluation function with automatic cache key generation and cache size limits.
   */
  static memoize(fn, namespace = 'global') {
    return (...args) => {
      const key = `${namespace}_${JSON.stringify(args)}`;
      if (this.memoCache.has(key)) {
        return this.memoCache.get(key);
      }

      const result = fn(...args);

      if (this.memoCache.size >= this.maxMemoEntries) {
        // LRU purge half
        const keys = Array.from(this.memoCache.keys());
        for (let i = 0; i < Math.floor(keys.length / 2); i++) {
          this.memoCache.delete(keys[i]);
        }
      }

      this.memoCache.set(key, result);
      return result;
    };
  }

  /**
   * High-speed batch SUMIFS calculation across a dataset with single-pass indexing
   */
  static batchSumIfs(records = [], sumField, groupKeys = []) {
    const startTime = performance.now();
    const totals = new Map();

    if (!Array.isArray(records) || records.length === 0) {
      return totals;
    }

    for (let i = 0; i < records.length; i++) {
      const item = records[i];
      if (!item) continue;

      const groupVal = groupKeys.map((k) => String(item[k] || '').toLowerCase().trim()).join(':::');
      const qty = safeNum(item[sumField], 0);

      totals.set(groupVal, (totals.get(groupVal) || 0) + qty);
    }

    const duration = performance.now() - startTime;
    Logger.debug(`⚡ Batch SUMIFS evaluated ${records.length} records in ${duration.toFixed(2)}ms`, null, 'FormulaOptimizer');

    return totals;
  }

  /**
   * Batch VLOOKUP over a collection
   */
  static batchVLookup(sourceArray = [], targetKey, lookupKey, returnField) {
    const lookupMap = new Map();
    for (const item of sourceArray) {
      if (!item) continue;
      const key = String(item[lookupKey] || '').toLowerCase().trim();
      if (key) {
        lookupMap.set(key, item[returnField]);
      }
    }
    return lookupMap;
  }

  /**
   * Clears internal formula memoization cache
   */
  static clearMemoCache() {
    this.memoCache.clear();
    multiLevelCacheManager.invalidateByTag('formula');
    Logger.info('🧹 Formula Engine memo cache cleared', null, 'FormulaOptimizer');
  }
}

export default FormulaEngineOptimizer;
