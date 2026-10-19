import { Logger } from '../logger/LoggerService';

/**
 * @file CacheService.js
 * @module core/cache/CacheService
 * @description
 * خدمة التخزين المؤقت في الذاكرة (In-Memory TTL Caching Engine) لتحسين استجابة التطبيق وتسريع حسابات GMAO.
 * 
 * الميزات الرئيسية:
 * - ⏱️ التجديد التلقائي وانتهاء الصلاحية المحسوبة بالميلي ثانية (Time-To-Live TTL).
 * - 🏷️ إلغاء ومسح الكاش الموجه عبر الوسوم الرقمية (Tag-Based Invalidation).
 * - 📊 إحصائيات دقيقة لمعدل النجاح/الإخفاق (Hit/Miss Ratio & Memory Usage).
 * -  Singleton Pattern لضمان مشاركة نفس المخرجات عبر مكونات النظام.
 */
export class CacheService {
  /** @type {CacheService|null} */
  static instance = null;

  /**
   * إنشاء خادم التخزين المؤقت مع تكوين الخيارات المحددة
   * 
   * @param {Object} [options={}] - خيارات التكوين
   * @param {number} [options.ttl=300000] - الصلاحية الافتراضية بالميلي ثانية (5 دقائق)
   */
  constructor(options = {}) {
    if (CacheService.instance) {
      return CacheService.instance;
    }

    /** @type {Map<string, {value: any, expiresAt: number, tags: string[], createdAt: number, size: number}>} */
    this.cache = new Map();
    /** @type {number} */
    this.ttl = options.ttl || 5 * 60 * 1000;
    /** @type {Map<string, Set<string>>} */
    this.tags = new Map();
    /** @type {{hits: number, misses: number, sets: number, deletes: number, invalidations: number}} */
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      invalidations: 0
    };

    CacheService.instance = this;
    Logger.info('✅ CacheService initialized');
  }

  /**
   * تخزين قيمة في الكاش مع تحديد وسم أو عمر الصلاحية
   * 
   * @param {string} key - مفتاح التخزين
   * @param {any} value - القيمة المراد حفظها
   * @param {number} [ttl=this.ttl] - الصلاحية بالميلي ثانية
   * @param {Array<string>} [tags=[]] - وسوم التصنيف لعمليات الإلغاء الجماعي
   */
  set(key, value, ttl = this.ttl, tags = []) {
    try {
      const expiresAt = Date.now() + ttl;
      
      this.cache.set(key, {
        value,
        expiresAt,
        tags,
        createdAt: Date.now(),
        size: JSON.stringify(value).length
      });

      // تسجيل الوسوم
      tags.forEach(tag => {
        if (!this.tags.has(tag)) {
          this.tags.set(tag, new Set());
        }
        this.tags.get(tag).add(key);
      });

      this.stats.sets++;
      Logger.debug(`💾 Cache SET: ${key}`, { ttl, tags });
    } catch (error) {
      Logger.error('❌ Cache set failed', error);
    }
  }

  /**
   * استرجاع قيمة محفوظة في الكاش بشرط سريان صلاحيتها
   * 
   * @param {string} key - مفتاح الكائن
   * @returns {any|null} القيمة المخزنة أو null عند الإخفاق/انتهاء الصلاحية
   */
  get(key) {
    try {
      const item = this.cache.get(key);

      if (!item) {
        this.stats.misses++;
        return null;
      }

      if (Date.now() > item.expiresAt) {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      Logger.debug(`✅ Cache HIT: ${key}`);
      return item.value;
    } catch (error) {
      Logger.error('❌ Cache get failed', error);
      return null;
    }
  }

  /**
   * Check if key exists
   */
  has(key) {
    try {
      const item = this.cache.get(key);
      if (!item) return false;
      if (Date.now() > item.expiresAt) {
        this.cache.delete(key);
        return false;
      }
      return true;
    } catch (error) {
      Logger.error('❌ Cache has check failed', error);
      return false;
    }
  }

  /**
   * Delete cache value
   */
  delete(key) {
    try {
      const item = this.cache.get(key);
      if (item) {
        item.tags.forEach(tag => {
          this.tags.get(tag)?.delete(key);
        });
      }
      this.cache.delete(key);
      this.stats.deletes++;
      Logger.debug(`🗑️ Cache DELETE: ${key}`);
    } catch (error) {
      Logger.error('❌ Cache delete failed', error);
    }
  }

  /**
   * Invalidate cache by tag
   */
  invalidateByTag(tag) {
    try {
      const keys = this.tags.get(tag) || new Set();
      const count = keys.size;
      
      keys.forEach(key => this.delete(key));
      
      this.stats.invalidations++;
      Logger.debug(`🔄 Cache INVALIDATE TAG: ${tag}`, { count });
    } catch (error) {
      Logger.error('❌ Cache invalidation failed', error);
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    try {
      this.cache.clear();
      this.tags.clear();
      Logger.info('🧹 Cache CLEARED');
    } catch (error) {
      Logger.error('❌ Cache clear failed', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    try {
      const hitRate = this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
        : 0;

      let totalSize = 0;
      for (const item of this.cache.values()) {
        totalSize += item.size;
      }

      return {
        ...this.stats,
        hitRate: `${hitRate}%`,
        size: this.cache.size,
        tags: this.tags.size,
        totalSize: `${(totalSize / 1024).toFixed(2)} KB`
      };
    } catch (error) {
      Logger.error('❌ Failed to get cache stats', error);
      return null;
    }
  }

  // ==========================================
  // Static Delegation Methods
  // ==========================================

  static getInstance(options) {
    if (!CacheService.instance) {
      new CacheService(options);
    }
    return CacheService.instance;
  }

  static get(key) {
    return CacheService.getInstance().get(key);
  }

  static set(key, value, ttl, tagsOrPersist) {
    const tags = Array.isArray(tagsOrPersist) ? tagsOrPersist : [];
    return CacheService.getInstance().set(key, value, ttl, tags);
  }

  static has(key) {
    return CacheService.getInstance().has(key);
  }

  static delete(key) {
    return CacheService.getInstance().delete(key);
  }

  static clear() {
    return CacheService.getInstance().clear();
  }

  static getStats() {
    return CacheService.getInstance().getStats();
  }

  static invalidateByTag(tag) {
    return CacheService.getInstance().invalidateByTag(tag);
  }
}

export const cache = CacheService;
export default CacheService;
