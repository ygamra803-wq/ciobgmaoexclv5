import { indexedDBService } from '../utils/indexedDBService';
import { Logger } from '../core/logger/LoggerService';

/**
 * Multi-Level Storage Service with Graceful Degradation
 * Level 1: IndexedDB (high capacity, async)
 * Level 2: LocalStorage (medium capacity, sync fallback)
 * Level 3: In-Memory Map (unlimited transient memory)
 */
class MultiLevelStorageService {
  constructor() {
    this.memoryCache = new Map();
    this.activeStorageLevel = 'unknown'; // 'indexeddb' | 'localstorage' | 'memory'
    this.initPromise = this.initStorageLevel();
  }

  /**
   * Initializes and tests available storage engines to determine current storage level.
   */
  async initStorageLevel() {
    // 1. Try IndexedDB
    try {
      const testKey = '__storage_test_idb__';
      const testVal = { ok: true, ts: Date.now() };
      const idbSuccess = await indexedDBService.setItem(testKey, testVal);
      if (idbSuccess) {
        await indexedDBService.removeItem(testKey);
        this.activeStorageLevel = 'indexeddb';
        Logger.info('✅ MultiLevelStorage active level: IndexedDB', null, 'StorageService');
        return 'indexeddb';
      }
    } catch (e) {
      Logger.warn('IndexedDB initial test failed:', e, 'StorageService');
    }

    // 2. Try LocalStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const testKey = '__storage_test_ls__';
        localStorage.setItem(testKey, 'ok');
        localStorage.removeItem(testKey);
        this.activeStorageLevel = 'localstorage';
        Logger.warn('⚠️ MultiLevelStorage fallback level: LocalStorage', null, 'StorageService');
        return 'localstorage';
      }
    } catch (e) {
      Logger.warn('LocalStorage initial test failed:', e, 'StorageService');
    }

    // 3. Fallback to Memory Cache
    this.activeStorageLevel = 'memory';
    Logger.warn('⚠️⚠️ MultiLevelStorage fallback level: In-Memory Cache only', null, 'StorageService');
    return 'memory';
  }

  /**
   * Gets current storage status metadata.
   */
  getStorageInfo() {
    return {
      level: this.activeStorageLevel,
      available: this.activeStorageLevel !== 'unknown',
      memorySize: this.memoryCache.size,
      description: {
        indexeddb: '✅ Stockage IndexedDB haute performance actif',
        localstorage: '⚠️ Stockage LocalStorage actif (Capacité limitée)',
        memory: '⚠️⚠️ Stockage Mémoire uniquement (Données volatiles)',
        unknown: '❌ Analyse du stockage en cours'
      }[this.activeStorageLevel] || 'Inconnu'
    };
  }

  /**
   * Set item with multi-level fallback
   */
  async setItem(key, value) {
    await this.initPromise;

    // Always mirror in memory for fast sync access if needed
    this.memoryCache.set(key, value);

    if (this.activeStorageLevel === 'indexeddb') {
      const success = await indexedDBService.setItem(key, value);
      if (success) return true;

      // Failover to LocalStorage
      Logger.warn(`IDB setItem failed for key [${key}], failing over to LocalStorage`, null, 'StorageService');
      this.activeStorageLevel = 'localstorage';
    }

    if (this.activeStorageLevel === 'localstorage') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        Logger.warn(`LocalStorage setItem failed for key [${key}], failing over to Memory`, e, 'StorageService');
        this.activeStorageLevel = 'memory';
      }
    }

    // Memory fallback
    return true;
  }

  /**
   * Get item with multi-level fallback
   */
  async getItem(key, fallback = null) {
    await this.initPromise;

    if (this.activeStorageLevel === 'indexeddb') {
      const val = await indexedDBService.getItem(key, undefined);
      if (val !== undefined) return val;
    }

    if (this.activeStorageLevel === 'localstorage' || this.activeStorageLevel === 'indexeddb') {
      try {
        const item = localStorage.getItem(key);
        if (item !== null) {
          try {
            return JSON.parse(item);
          } catch {
            return item;
          }
        }
      } catch (e) {
        Logger.warn(`LocalStorage getItem error for key [${key}]:`, e, 'StorageService');
      }
    }

    // Memory fallback
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    return fallback;
  }

  /**
   * Remove item from all levels
   */
  async removeItem(key) {
    await this.initPromise;

    this.memoryCache.delete(key);

    try {
      localStorage.removeItem(key);
    } catch {}

    try {
      await indexedDBService.removeItem(key);
    } catch {}

    return true;
  }

  /**
   * Clear items from all storage engines
   */
  async clear() {
    await this.initPromise;

    this.memoryCache.clear();

    try {
      localStorage.clear();
    } catch {}

    try {
      await indexedDBService.clear();
    } catch {}

    return true;
  }
}

export const multiLevelStorageService = new MultiLevelStorageService();
export default multiLevelStorageService;
