/**
 * Unified Industrial IndexedDB Service - GMAO Architecture
 * Single Source of Truth for client-side high-capacity persistence.
 *
 * Capabilities:
 * 1. Key-Value Store ('app_data'): High performance getItem/setItem/setItemsBatch for state & snapshots.
 * 2. Relational Entity Stores: Structured collections with indexes (machines, articles, warehouse_items, etc.).
 * 3. Safe Fallback: Graceful degradation to In-Memory Map in SSR/Node/Vitest environments without hangs or retries.
 * 4. Exponential Backoff & Retry: Resilient execution for browser environment quirks.
 */

import { Logger } from '../../core/logger/LoggerService';

const DB_NAME = 'CIOB_GMAO_INDUSTRIAL_DB';
const DB_VERSION = 3;

class IndexedDBService {
  constructor(dbName = DB_NAME, version = DB_VERSION) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.retries = 3;
    this.initPromise = null;
    // Fast in-memory fallback store when IndexedDB is unavailable (e.g. Node/Vitest test environment)
    this.fallbackMemoryStore = new Map();
  }

  isSupported() {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined' && window.indexedDB !== null;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Initializes and opens the IndexedDB database.
   * In non-browser/test environments, immediately resolves to null without retries.
   */
  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    if (!this.isSupported()) {
      return null;
    }

    this.initPromise = (async () => {
      for (let attempt = 1; attempt <= this.retries; attempt++) {
        try {
          this.db = await this._openDB();
          await this.requestPersistentStorage();
          Logger.info(`✅ IndexedDB [${this.dbName} v${this.version}] initialized successfully`);
          return this.db;
        } catch (error) {
          Logger.warn(`⚠️ IndexedDB open retry ${attempt}/${this.retries}: ${error?.message || error}`);
          if (attempt === this.retries) {
            Logger.error('❌ Failed to open IndexedDB after retries:', error);
            return null;
          }
          await this.delay(100 * Math.pow(2, attempt - 1));
        }
      }
      return null;
    })();

    return this.initPromise;
  }

  /**
   * Requests browser persistent storage protection so OS/browser never auto-evicts GMAO IndexedDB data.
   */
  async requestPersistentStorage() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
          await navigator.storage.persist();
        }
      }
    } catch {
      // Ignore in unsupported environments
    }
  }

  /**
   * Returns high-capacity storage quota & usage metrics (Allocated 1GB industrial ceiling by default).
   */
  async getStorageQuotaInfo(allocatedCeilingMB = 1024) {
    const allocatedBytes = allocatedCeilingMB * 1024 * 1024;
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const isPersisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        const usageBytes = estimate.usage || 0;
        const browserQuotaBytes = estimate.quota || allocatedBytes;
        return {
          usageBytes,
          usageMB: (usageBytes / (1024 * 1024)).toFixed(2),
          usageKB: (usageBytes / 1024).toFixed(1),
          allocatedCeilingMB,
          allocatedBytes,
          browserQuotaGB: (browserQuotaBytes / (1024 * 1024 * 1024)).toFixed(1),
          percentage: Math.min(100, (usageBytes / allocatedBytes) * 100).toFixed(2),
          isPersisted,
        };
      }
    } catch {
      // Fallback below
    }
    return {
      usageBytes: 0,
      usageMB: '0.00',
      usageKB: '0.0',
      allocatedCeilingMB,
      allocatedBytes,
      browserQuotaGB: '1.0',
      percentage: '0.00',
      isPersisted: false,
    };
  }

  _openDB() {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        return resolve(null);
      }

      const request = window.indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error || new Error('Erreur d\'ouverture IndexedDB'));

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const tx = event.target.transaction;
        this._createStores(db, tx);
      };
    });
  }

  _createStores(db, tx = null) {
    // 1. Primary Key-Value Store for app state, settings, backups, snapshots
    if (!db.objectStoreNames.contains('app_data')) {
      db.createObjectStore('app_data');
    }

    // 2. Structured Domain Stores
    const entityStores = [
      {
        name: 'machines',
        keyPath: 'id_machine_registered',
        indexes: [
          { name: 'id', keyPath: 'id', unique: false },
          { name: 'id_zone', keyPath: 'id_zone', unique: false },
          { name: 'famille', keyPath: 'famille', unique: false },
          { name: 'statut', keyPath: 'statut', unique: false },
        ],
      },
      {
        name: 'articles',
        keyPath: 'ref',
        indexes: [
          { name: 'type', keyPath: 'type', unique: false },
          { name: 'zone', keyPath: 'zone', unique: false },
          { name: 'alerte', keyPath: 'alerte', unique: false },
        ],
      },
      {
        name: 'warehouse_items',
        keyPath: 'id_warehouse_item',
        indexes: [
          { name: 'id_machine_registered', keyPath: 'id_machine_registered', unique: false },
          { name: 'category', keyPath: 'category', unique: false },
          { name: 'part_type', keyPath: 'part_type', unique: false },
          { name: 'status', keyPath: 'status', unique: false },
        ],
      },
      {
        name: 'movements',
        keyPath: 'id',
        indexes: [
          { name: 'ref', keyPath: 'ref', unique: false },
          { name: 'date', keyPath: 'date', unique: false },
          { name: 'type', keyPath: 'type', unique: false },
        ],
      },
      {
        name: 'interventions',
        keyPath: 'id',
        indexes: [
          { name: 'code_machine', keyPath: 'code_machine', unique: false },
          { name: 'statut', keyPath: 'statut', unique: false },
          { name: 'type_panne', keyPath: 'type_panne', unique: false },
          { name: 'zone', keyPath: 'zone', unique: false },
        ],
      },
      {
        name: 'preventive',
        keyPath: 'id',
        indexes: [
          { name: 'code_machine', keyPath: 'code_machine', unique: false },
          { name: 'statut', keyPath: 'statut', unique: false },
          { name: 'frequence', keyPath: 'frequence', unique: false },
        ],
      },
      {
        name: 'users',
        keyPath: 'id',
        indexes: [
          { name: 'username', keyPath: 'username', unique: false },
          { name: 'role', keyPath: 'role', unique: false },
        ],
      },
      {
        name: 'bom_ledger',
        keyPath: 'id',
        indexes: [
          { name: 'id_machine_registered', keyPath: 'id_machine_registered', unique: false },
          { name: 'ref_element', keyPath: 'ref_element', unique: false },
          { name: 'element_type', keyPath: 'element_type', unique: false },
        ],
      },
    ];

    for (const s of entityStores) {
      let objectStore;
      if (!db.objectStoreNames.contains(s.name)) {
        objectStore = db.createObjectStore(s.name, { keyPath: s.keyPath });
      } else {
        objectStore = tx ? tx.objectStore(s.name) : null;
      }

      if (objectStore && s.indexes) {
        for (const idx of s.indexes) {
          if (!objectStore.indexNames.contains(idx.name)) {
            objectStore.createIndex(idx.name, idx.keyPath, { unique: idx.unique || false });
          }
        }
      }
    }
  }

  // ==========================================
  // SECTION 1: Key-Value API (Store: 'app_data')
  // ==========================================

  /**
   * Retrieves an item from 'app_data' store with fallback.
   */
  async getItem(key, fallback = null) {
    if (!this.isSupported()) {
      return this.fallbackMemoryStore.has(key) ? this.fallbackMemoryStore.get(key) : fallback;
    }

    try {
      const db = await this.init();
      if (!db) {
        return this.fallbackMemoryStore.has(key) ? this.fallbackMemoryStore.get(key) : fallback;
      }

      return new Promise((resolve) => {
        try {
          const tx = db.transaction('app_data', 'readonly');
          const store = tx.objectStore('app_data');
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result !== undefined ? req.result : fallback);
          req.onerror = () => resolve(fallback);
        } catch {
          resolve(fallback);
        }
      });
    } catch {
      return fallback;
    }
  }

  /**
   * Sets a single item in 'app_data' store.
   */
  async setItem(key, value) {
    this.fallbackMemoryStore.set(key, value);

    if (!this.isSupported()) {
      return true;
    }

    try {
      const db = await this.init();
      if (!db) return true;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction('app_data', 'readwrite');
          const store = tx.objectStore('app_data');
          store.put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  }

  /**
   * Batch write multiple key-value pairs to 'app_data' in a single transaction.
   */
  async setItemsBatch(itemsMap = {}) {
    if (!itemsMap || typeof itemsMap !== 'object') return false;

    // Update fallback memory
    for (const [key, value] of Object.entries(itemsMap)) {
      this.fallbackMemoryStore.set(key, value);
    }

    if (!this.isSupported()) {
      return true;
    }

    try {
      const db = await this.init();
      if (!db) return true;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction('app_data', 'readwrite');
          const store = tx.objectStore('app_data');
          for (const [key, value] of Object.entries(itemsMap)) {
            store.put(value, key);
          }
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  }

  /**
   * Removes an item from 'app_data' store.
   */
  async removeItem(key) {
    this.fallbackMemoryStore.delete(key);

    if (!this.isSupported()) {
      return true;
    }

    try {
      const db = await this.init();
      if (!db) return true;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction('app_data', 'readwrite');
          const store = tx.objectStore('app_data');
          store.delete(key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  }

  /**
   * Alias for removeItem
   */
  async deleteItem(key) {
    return this.removeItem(key);
  }

  // ==========================================
  // SECTION 2: Entity Stores API
  // ==========================================

  async getStore(storeName, mode = 'readonly') {
    const db = await this.init();
    if (!db || !db.objectStoreNames.contains(storeName)) return null;
    const tx = db.transaction([storeName], mode);
    return tx.objectStore(storeName);
  }

  /**
   * Retrieves all items from a given store.
   */
  async getAll(storeName = 'app_data') {
    if (!this.isSupported()) {
      if (storeName === 'app_data') {
        const obj = {};
        for (const [k, v] of this.fallbackMemoryStore.entries()) {
          obj[k] = v;
        }
        return obj;
      }
      return [];
    }

    try {
      const store = await this.getStore(storeName, 'readonly');
      if (!store) return storeName === 'app_data' ? {} : [];

      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || (storeName === 'app_data' ? {} : []));
        request.onerror = () => resolve(storeName === 'app_data' ? {} : []);
      });
    } catch (err) {
      Logger.warn(`IndexedDB getAll [${storeName}] error:`, err);
      return storeName === 'app_data' ? {} : [];
    }
  }

  /**
   * Polymorphic get:
   * - If 1 argument: get(key) from 'app_data'
   * - If 2 arguments: get(storeName, key)
   */
  async get(storeNameOrKey, key = null) {
    if (key === null) {
      return this.getItem(storeNameOrKey);
    }

    const storeName = storeNameOrKey;
    if (!this.isSupported()) return null;

    try {
      const store = await this.getStore(storeName, 'readonly');
      if (!store) return null;

      return new Promise((resolve) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Puts a record into an entity store.
   */
  async put(storeName, data) {
    if (!this.isSupported()) return true;

    try {
      const store = await this.getStore(storeName, 'readwrite');
      if (!store) return false;

      return new Promise((resolve) => {
        const request = store.put(data);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  /**
   * Bulk puts multiple items into an entity store in a single transaction.
   */
  async bulkPut(storeName, items = []) {
    if (!items || items.length === 0) return true;
    if (!this.isSupported()) return true;

    try {
      const db = await this.init();
      if (!db || !db.objectStoreNames.contains(storeName)) return false;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction([storeName], 'readwrite');
          const store = tx.objectStore(storeName);
          for (const item of items) {
            store.put(item);
          }
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  }

  /**
   * Deletes a record from an entity store by key.
   */
  async delete(storeName, key) {
    if (!this.isSupported()) return true;

    try {
      const store = await this.getStore(storeName, 'readwrite');
      if (!store) return false;

      return new Promise((resolve) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  /**
   * Clears a store completely (defaults to 'app_data').
   */
  async clear(storeName = 'app_data') {
    if (storeName === 'app_data') {
      this.fallbackMemoryStore.clear();
    }

    if (!this.isSupported()) return true;

    try {
      const store = await this.getStore(storeName, 'readwrite');
      if (!store) return false;

      return new Promise((resolve) => {
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  /**
   * Executes an indexed query on an entity store.
   */
  async query(storeName, indexName, value) {
    if (!this.isSupported()) return [];

    try {
      const store = await this.getStore(storeName, 'readonly');
      if (!store || !store.indexNames.contains(indexName)) return [];
      const index = store.index(indexName);

      return new Promise((resolve) => {
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }
}

export const indexedDBService = new IndexedDBService();
export default indexedDBService;
export { IndexedDBService };
