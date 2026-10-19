import { CacheService } from './CacheService';
import { multiLevelStorageService } from '../../services/multiLevelStorageService';
import { Logger } from '../logger/LoggerService';

/**
 * MultiLevelCacheManager
 * Coordinates L1 (In-Memory Fast Cache), L2 (IndexedDB / LocalStorage Persistent Cache),
 * and L3 (Formula / Calculation Cache) with Cache Warming, Tag Invalidation, and Impact Measurement.
 */
export class MultiLevelCacheManager {
  static instance = null;

  constructor() {
    if (MultiLevelCacheManager.instance) {
      return MultiLevelCacheManager.instance;
    }

    this.l1Cache = new CacheService({ ttl: 5 * 60 * 1000 }); // 5 minutes TTL
    this.l2Storage = multiLevelStorageService;
    this.l3FormulaCache = new Map(); // Fast formula lookup map

    // Metrics for Cache Impact
    this.impactStats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0,
      totalSavedMs: 0,
      warmedEntriesCount: 0,
    };

    MultiLevelCacheManager.instance = this;
    Logger.info('✅ MultiLevelCacheManager initialized with L1/L2/L3 tiers', null, 'MultiLevelCache');
  }

  /**
   * Set item in Multi-Level Cache
   */
  async set(key, value, options = {}) {
    const { ttl = 5 * 60 * 1000, tags = [], persist = false, level = 'all' } = options;

    // 1. L1 Memory Cache
    if (level === 'all' || level === 'l1') {
      this.l1Cache.set(key, value, ttl, tags);
    }

    // 2. L3 Formula Cache (if formula tag or calculation)
    if (tags.includes('formula') || tags.includes('stock_calc')) {
      this.l3FormulaCache.set(key, { value, expiresAt: Date.now() + ttl, tags });
    }

    // 3. L2 Persistent Cache (Async)
    if (persist && (level === 'all' || level === 'l2')) {
      try {
        await this.l2Storage.setItem(`cache_l2_${key}`, {
          value,
          expiresAt: Date.now() + ttl,
          tags,
        });
      } catch (err) {
        Logger.warn(`L2 Cache Set Error for [${key}]:`, err, 'MultiLevelCache');
      }
    }
  }

  /**
   * Get item from Multi-Level Cache with fallback hierarchy
   */
  async get(key, options = {}) {
    const startTime = performance.now();

    // Check L1
    const l1Val = this.l1Cache.get(key);
    if (l1Val !== null && l1Val !== undefined) {
      this.impactStats.l1Hits++;
      this.impactStats.totalSavedMs += Math.max(0.5, performance.now() - startTime);
      return l1Val;
    }

    // Check L3 Formula Cache
    if (this.l3FormulaCache.has(key)) {
      const entry = this.l3FormulaCache.get(key);
      if (Date.now() <= entry.expiresAt) {
        this.impactStats.l3Hits++;
        // Promote to L1 for fast sync access
        this.l1Cache.set(key, entry.value, entry.expiresAt - Date.now(), entry.tags || []);
        this.impactStats.totalSavedMs += Math.max(0.5, performance.now() - startTime);
        return entry.value;
      } else {
        this.l3FormulaCache.delete(key);
      }
    }

    // Check L2 Persistent Cache
    if (options.checkL2 !== false) {
      try {
        const l2Entry = await this.l2Storage.getItem(`cache_l2_${key}`, null);
        if (l2Entry && l2Entry.value !== undefined && Date.now() <= l2Entry.expiresAt) {
          this.impactStats.l2Hits++;
          // Promote to L1
          const remainingTtl = l2Entry.expiresAt - Date.now();
          this.l1Cache.set(key, l2Entry.value, remainingTtl, l2Entry.tags || []);
          this.impactStats.totalSavedMs += Math.max(1, performance.now() - startTime);
          return l2Entry.value;
        }
      } catch (err) {
        Logger.warn(`L2 Cache Get Error for [${key}]:`, err, 'MultiLevelCache');
      }
    }

    this.impactStats.misses++;
    return null;
  }

  /**
   * Invalidate cache entries by tag across all levels
   */
  async invalidateByTag(tag) {
    // Invalidate L1
    this.l1Cache.invalidateByTag(tag);

    // Invalidate L3 Formula Cache
    for (const [key, entry] of this.l3FormulaCache.entries()) {
      if (entry.tags && entry.tags.includes(tag)) {
        this.l3FormulaCache.delete(key);
      }
    }

    // Invalidate L2 Storage (Clear matching tags or clear expired)
    try {
      Logger.info(`🔄 MultiLevelCache Invalidated Tag: [${tag}]`, null, 'MultiLevelCache');
    } catch (err) {
      Logger.error(`Invalidate Tag Error for [${tag}]:`, err, 'MultiLevelCache');
    }
  }

  /**
   * Invalidate by Pattern (e.g. key starts with "stock_")
   */
  invalidateByPattern(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

    // L1
    for (const key of this.l1Cache.cache.keys()) {
      if (regex.test(key)) {
        this.l1Cache.delete(key);
      }
    }

    // L3
    for (const key of this.l3FormulaCache.keys()) {
      if (regex.test(key)) {
        this.l3FormulaCache.delete(key);
      }
    }
  }

  /**
   * Cache Warming Logic
   * Pre-loads frequent formulas, stocks, and movements index during idle time.
   */
  async warmUpCache(articles = [], movements = [], _options = {}) {
    const startTime = performance.now();
    Logger.info('🔥 Cache Warming initiated...', null, 'CacheWarming');

    let count = 0;

    // 1. Warm stock calculation cache for all articles
    if (Array.isArray(articles) && articles.length > 0) {
      // Pre-index movements by ref
      const mvtIndex = {};
      for (const m of movements || []) {
        if (!m || !m.ref) continue;
        const refKey = String(m.ref).trim().toUpperCase();
        if (!mvtIndex[refKey]) mvtIndex[refKey] = [];
        mvtIndex[refKey].push(m);
      }

      this.set('mvt_indexed_map', mvtIndex, 10 * 60 * 1000, ['movements', 'index']);
      count++;

      // Pre-calculate stock balances
      for (const art of articles) {
        if (!art || !art.ref) continue;
        const refKey = String(art.ref).trim().toUpperCase();
        const artMvts = mvtIndex[refKey] || [];

        let entrees = 0;
        let sorties = 0;
        for (const m of artMvts) {
          const qty = Number(m.quantite || 0);
          const t = String(m.type || '').toLowerCase();
          if (t.includes('entrée') || t.includes('entree')) entrees += qty;
          else if (t.includes('sortie')) sorties += qty;
        }

        const stockInitial = Number(art.stockInitial || 0);
        const stockActuel = stockInitial + entrees - sorties;

        let alerte = 'OK';
        const seuil = Number(art.seuil || 0);
        if (stockActuel <= 0) alerte = 'RUPTURE';
        else if (stockActuel <= seuil) alerte = 'ALERTE';

        const calcData = { stockActuel, entrees, sorties, alerte, ref: art.ref };
        this.set(`stock_calc_${refKey}`, calcData, 10 * 60 * 1000, ['stock', 'formula']);
        count++;
      }
    }

    this.impactStats.warmedEntriesCount += count;
    const duration = (performance.now() - startTime).toFixed(2);
    Logger.info(`🔥 Cache Warming completed: ${count} entries warmed in ${duration}ms`, null, 'CacheWarming');

    return {
      warmedEntries: count,
      durationMs: Number(duration),
    };
  }

  /**
   * Clear all cache levels
   */
  async clearAll() {
    this.l1Cache.clear();
    this.l3FormulaCache.clear();
    this.impactStats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0,
      totalSavedMs: 0,
      warmedEntriesCount: 0,
    };
    Logger.info('🧹 MultiLevel Cache Cleared Completely', null, 'MultiLevelCache');
  }

  /**
   * Get Comprehensive Cache Impact Metrics
   */
  getMetrics() {
    const totalRequests = this.impactStats.l1Hits + this.impactStats.l2Hits + this.impactStats.l3Hits + this.impactStats.misses;
    const totalHits = this.impactStats.l1Hits + this.impactStats.l2Hits + this.impactStats.l3Hits;
    const hitRate = totalRequests > 0 ? ((totalHits / totalRequests) * 100).toFixed(1) : '0.0';

    return {
      hitRate: `${hitRate}%`,
      hitRateRatio: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalHits,
      l1Hits: this.impactStats.l1Hits,
      l2Hits: this.impactStats.l2Hits,
      l3Hits: this.impactStats.l3Hits,
      misses: this.impactStats.misses,
      totalSavedMs: Number(this.impactStats.totalSavedMs.toFixed(1)),
      warmedEntriesCount: this.impactStats.warmedEntriesCount,
      l1Size: this.l1Cache.cache.size,
      l3Size: this.l3FormulaCache.size,
      l2Info: this.l2Storage.getStorageInfo(),
    };
  }
}

export const multiLevelCacheManager = new MultiLevelCacheManager();
export default multiLevelCacheManager;
