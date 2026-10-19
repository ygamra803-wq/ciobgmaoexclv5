import { Logger } from '../core/logger/LoggerService';
import { multiLevelCacheManager } from '../core/cache/MultiLevelCacheManager';

/**
 * DataLoaderOptimizer
 * Handles chunked non-blocking data processing, request deduplication, and prefetching.
 */
export class DataLoaderOptimizer {
  static inFlightRequests = new Map();

  /**
   * Process large datasets in non-blocking chunks using requestAnimationFrame / idle callbacks.
   * Prevents UI stutter and main thread freeze when rendering/transforming large lists.
   */
  static async loadInChunks(data = [], processFn, options = {}) {
    const { chunkSize = 200, onProgress = null } = options;

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const results = [];
    const total = data.length;

    for (let i = 0; i < total; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const processedChunk = chunk.map(processFn);
      results.push(...processedChunk);

      if (onProgress) {
        onProgress(Math.min(100, Math.round(((i + chunk.length) / total) * 100)));
      }

      // Yield main thread to allow browser UI frame render
      await new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });
    }

    return results;
  }

  /**
   * Request deduplication (Deduplicates concurrent identical requests / computations)
   */
  static dedupRequest(key, fetcherFn) {
    if (this.inFlightRequests.has(key)) {
      Logger.debug(`🔁 Request deduplicated for key [${key}]`, null, 'DataLoaderOptimizer');
      return this.inFlightRequests.get(key);
    }

    const promise = (async () => {
      try {
        const res = await fetcherFn();
        return res;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  /**
   * Pre-fetches and caches dataset into MultiLevelCache in background
   */
  static async prefetchAndCache(cacheKey, loaderFn, ttl = 5 * 60 * 1000, tags = []) {
    const cached = await multiLevelCacheManager.get(cacheKey);
    if (cached) return cached;

    return this.dedupRequest(cacheKey, async () => {
      const data = await loaderFn();
      await multiLevelCacheManager.set(cacheKey, data, { ttl, tags, persist: true });
      return data;
    });
  }
}

export default DataLoaderOptimizer;
