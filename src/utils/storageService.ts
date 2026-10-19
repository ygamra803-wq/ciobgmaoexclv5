import CryptoJS from 'crypto-js';
import { Logger } from '../core/logger/LoggerService';
import { indexedDBService } from '../infrastructure/database/IndexedDBService';
import { STORAGE_KEYS, ALL_LEGACY_KEYS } from '../infrastructure/persistence/storageKeys';

// Cache configuration
const MAX_CACHE_SIZE = 50;
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Map for memory cache with access timestamp
let memoryCache = new Map();
let lastCleanupTime = Date.now();

// Function to clean up stale cache entries
function cleanupCache() {
  const now = Date.now();
  const keysToDelete = [];

  // Remove entries not accessed for more than 10 minutes
  for (const [key, value] of memoryCache) {
    if (value && value._lastAccessed && (now - value._lastAccessed) > 10 * 60 * 1000) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => memoryCache.delete(key));

  // If cache still exceeds limit, evict the oldest 20%
  if (memoryCache.size > MAX_CACHE_SIZE) {
    const keys = Array.from(memoryCache.keys());
    const keysToRemove = keys.slice(0, Math.floor(keys.length * 0.2));
    keysToRemove.forEach(key => memoryCache.delete(key));
  }

  lastCleanupTime = now;
}

// CacheManager class to prevent interval memory leaks and control lifecycle
class CacheManager {
  constructor() {
    this.timerId = null;
    this.isActive = false;
  }

  startCleanup() {
    if (this.isActive) return;
    this.isActive = true;
    this.timerId = setInterval(() => {
      if (Date.now() - lastCleanupTime > CACHE_CLEANUP_INTERVAL) {
        cleanupCache();
      }
    }, CACHE_CLEANUP_INTERVAL);
    if (this.timerId && typeof this.timerId.unref === 'function') {
      this.timerId.unref();
    }
  }

  stopCleanup() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      this.isActive = false;
    }
  }

  destroy() {
    this.stopCleanup();
  }
}

export const cacheManager = new CacheManager();

// Periodic cleanup initialization
if (typeof window !== 'undefined' && (typeof process === 'undefined' || process.env?.NODE_ENV !== 'test')) {
  cacheManager.startCleanup();
}

// Legacy keys for migration only (secure salt via environment variables)
const ENV_CRYPTO_KEY = import.meta.env.VITE_CRYPTO_KEY;

function getLegacyPersistenceSecret() {
  if (ENV_CRYPTO_KEY) return ENV_CRYPTO_KEY;
  if (import.meta.env.PROD || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')) {
    console.error(
      '[storageService] VITE_CRYPTO_KEY is required in production. Refusing hardcoded fallback.'
    );
    return null;
  }
  console.warn(
    '[storageService] VITE_CRYPTO_KEY missing — dev-only insecure fallback.'
  );
  return 'CIOB_GMAO_CLIENT_PERSISTENCE_SALT_KEY_987654321!';
}

const KEY_STORE_NAME = 'gmao_crypto_keys';
const KEY_ID = 'main_aes_gcm_key';

let webCryptoKey = null;

// Stale / Legacy keys that can be safely purged when localStorage faces quota pressure (after one-time migration)
const OBSOLETE_OR_DUPLICATE_KEYS = ALL_LEGACY_KEYS;

/**
 * Safely purges obsolete keys and stale snapshots when quota limit is approached
 */
function purgeObsoleteStorageKeys() {
  if (typeof localStorage === 'undefined') return 0;
  // Only purge legacy keys if one-time migration has already run
  const migrated = localStorage.getItem(STORAGE_KEYS.STORAGE_MIGRATED);
  let freedCount = 0;

  if (migrated === 'true' || migrated === '"true"') {
    for (const obsoleteKey of OBSOLETE_OR_DUPLICATE_KEYS) {
      if (localStorage.getItem(obsoleteKey) !== null) {
        localStorage.removeItem(obsoleteKey);
        memoryCache.delete(obsoleteKey);
        freedCount++;
      }
    }
  }

  // 2. Remove old snapshot histories if quota is still critical
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('gmao_snapshot_') || k.startsWith('gmao_backup_temp_') || k.includes('_legacy_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      localStorage.removeItem(k);
      freedCount++;
    });
  } catch {}

  return freedCount;
}

// Pre-populate memoryCache from localStorage safely on startup
try {
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gmao_')) {
        const item = localStorage.getItem(k);
        if (item && !item.startsWith('WC:') && !item.startsWith('U2FsdGVkX1')) {
          try {
            const parsed = JSON.parse(item);
            memoryCache.set(k, { data: parsed, _lastAccessed: Date.now() });
          } catch {
            memoryCache.set(k, { data: item, _lastAccessed: Date.now() });
          }
        }
      }
    }
  }
} catch (e) {
  Logger.warn('Initial localStorage read error:', e, 'storageService');
}

// Resilient IDB helper with strict timeout to prevent hangs in iframes
const idbKeyStore = {
  get(key) {
    return new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const timer = setTimeout(() => resolve(null), 300);
        const request = indexedDB.open('GMAO_Crypto_Store', 1);
        request.onupgradeneeded = (e) => {
          try {
            e.target.result.createObjectStore(KEY_STORE_NAME);
          } catch {}
        };
        request.onsuccess = (e) => {
          clearTimeout(timer);
          try {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(KEY_STORE_NAME)) return resolve(null);
            const tx = db.transaction(KEY_STORE_NAME, 'readonly');
            const store = tx.objectStore(KEY_STORE_NAME);
            const getReq = store.get(key);
            getReq.onsuccess = () => resolve(getReq.result || null);
            getReq.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        };
        request.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
        request.onblocked = () => {
          clearTimeout(timer);
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  },
  set(key, val) {
    return new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve();
        const timer = setTimeout(() => resolve(), 300);
        const request = indexedDB.open('GMAO_Crypto_Store', 1);
        request.onupgradeneeded = (e) => {
          try {
            e.target.result.createObjectStore(KEY_STORE_NAME);
          } catch {}
        };
        request.onsuccess = (e) => {
          clearTimeout(timer);
          try {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(KEY_STORE_NAME)) return resolve();
            const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
            const store = tx.objectStore(KEY_STORE_NAME);
            store.put(val, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch {
            resolve();
          }
        };
        request.onerror = () => {
          clearTimeout(timer);
          resolve();
        };
        request.onblocked = () => {
          clearTimeout(timer);
          resolve();
        };
      } catch {
        resolve();
      }
    });
  },
};

const base64ToArrayBuffer = (base64) => {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
  return bytes.buffer;
};

export const storageService = {
  _isInitializing: false,

  /**
   * Safe asynchronous initialization for legacy migration without blocking UI
   */
  async init() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    if (this._isInitializing) return;
    this._isInitializing = true;

    try {
      // 1. Safe WebCrypto key check if legacy WC: items exist
      let hasWcItems = false;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('gmao_')) {
            const val = localStorage.getItem(k);
            if (val && val.startsWith('WC:')) {
              hasWcItems = true;
              break;
            }
          }
        }
      } catch (e) {
        Logger.warn('Error checking localStorage:', e, 'storageService');
      }

      if (hasWcItems && typeof crypto !== 'undefined' && crypto.subtle) {
        try {
          let key = await idbKeyStore.get(KEY_ID);
          if (key) {
            webCryptoKey = key;
          }
        } catch (e) {
          Logger.warn('Error getting WebCrypto key:', e, 'storageService');
        }
      }

      // 2. Migrate legacy encrypted items to clean JSON
      // Note: Keys managed by SecurityService.saveSecure/getSecure (like gmao_auth_accounts_v2)
      // use SecurityService.SECRET_KEY (_gmao_sec_instance_key) and must NOT be decrypted
      // or overwritten into plain JSON by storageService.
      const SECURITY_MANAGED_KEYS = new Set([
        'gmao_auth_accounts_v2',
        'gmao_security_audit_log_v1',
        'gmao_security_audit_head_v1',
      ]);
      const migratedKeys = new Set();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('gmao_')) continue;
        if (SECURITY_MANAGED_KEYS.has(k) || k.startsWith('gmao_auth_') || k.startsWith('gmao_security_')) continue;
        if (migratedKeys.has(k)) continue;

        try {
          const item = localStorage.getItem(k);
          if (!item) continue;

          let decryptedObj = null;

          if (item.startsWith('WC:') && webCryptoKey) {
            try {
              const parts = item.split(':');
              if (parts.length < 3) continue;
              const iv = base64ToArrayBuffer(parts[1]);
              const cipher = base64ToArrayBuffer(parts[2]);
              const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(iv) },
                webCryptoKey,
                cipher
              );
              const dec = new TextDecoder();
              decryptedObj = JSON.parse(dec.decode(decryptedBuffer));
            } catch (e) {
              Logger.warn(`WC migration skipped for ${k}:`, e, 'storageService');
            }
          } else if (item.startsWith('U2FsdGVkX1')) {
            const legacySecret = getLegacyPersistenceSecret();
            if (legacySecret) {
              try {
                const bytes = CryptoJS.AES.decrypt(item, legacySecret);
                const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
                if (decryptedText) decryptedObj = JSON.parse(decryptedText);
              } catch (e) {
                Logger.warn(`Legacy AES migration skipped for ${k}:`, e, 'storageService');
              }
            } else {
              Logger.warn(
                `Legacy AES migration skipped for ${k}: VITE_CRYPTO_KEY missing in production.`,
                null,
                'storageService'
              );
            }
          }

          // If decrypted successfully, update memory cache and save clean JSON in localStorage
          if (decryptedObj !== null) {
            memoryCache.set(k, { data: decryptedObj, _lastAccessed: Date.now() });
            migratedKeys.add(k);
            try {
              localStorage.setItem(k, JSON.stringify(decryptedObj));
            } catch {}
          }
        } catch (e) {
          Logger.warn(`Error migrating key ${k}:`, e, 'storageService');
        }
      }
    } catch (e) {
      Logger.warn('Safe background init completed with notice:', e, 'storageService');
    } finally {
      this._isInitializing = false;
    }
  },

  /**
   * Synchronous retrieval with memory cache and localStorage fallback
   */
  getItem(key, fallback = null) {
    const cached = memoryCache.get(key);
    if (cached !== undefined) {
      // True LRU: Re-insert to make it the most recently used
      memoryCache.delete(key);
      memoryCache.set(key, cached);
      if (cached && typeof cached === 'object') {
        cached._lastAccessed = Date.now();
        return cached.data !== undefined ? cached.data : cached;
      }
      return cached;
    }

    try {
      if (typeof localStorage === 'undefined') return fallback;
      const item = localStorage.getItem(key);
      if (item === null || item === undefined) return fallback;

      // If it's a legacy encrypted token waiting for migration, return fallback safely
      if (typeof item === 'string' && (item.startsWith('WC:') || item.startsWith('U2FsdGVkX1'))) {
        return fallback;
      }

      try {
        const parsed = JSON.parse(item);
        const cachedEntry = { data: parsed, _lastAccessed: Date.now() };
        memoryCache.set(key, cachedEntry);
        return parsed;
      } catch {
        const cachedEntry = { data: item, _lastAccessed: Date.now() };
        memoryCache.set(key, cachedEntry);
        return item;
      }
    } catch {
      return fallback;
    }
  },

  /**
   * Synchronous storage with immediate persistence to localStorage and memoryCache
   */
  setItem(key, value) {
    const cachedEntry = { data: value, _lastAccessed: Date.now() };
    if (memoryCache.has(key)) {
      memoryCache.delete(key);
    }
    memoryCache.set(key, cachedEntry);

    // Evict oldest entries if exceeding capacity (strict LRU policy)
    if (memoryCache.size > MAX_CACHE_SIZE) {
      const keys = Array.from(memoryCache.keys());
      const numToRemove = memoryCache.size - MAX_CACHE_SIZE;
      for (let i = 0; i < numToRemove; i++) {
        memoryCache.delete(keys[i]);
      }
    }

    try {
      if (typeof localStorage !== 'undefined') {
        if (value === null || value === undefined) {
          localStorage.removeItem(key);
          memoryCache.delete(key);
        } else {
          const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
          try {
            localStorage.setItem(key, serialized);
          } catch (writeErr) {
            // If quota exceeded, purge stale keys and retry once
            const isQuotaError =
              writeErr?.name === 'QuotaExceededError' ||
              writeErr?.code === 22 ||
              writeErr?.code === 1014 ||
              writeErr?.message?.includes('quota') ||
              writeErr?.message?.includes('exceeded');

            if (isQuotaError) {
              const purged = purgeObsoleteStorageKeys();
              if (purged > 0) {
                try {
                  localStorage.setItem(key, serialized);
                  return true;
                } catch {
                  // Fallback safely to memoryCache
                }
              }
            }
            // Retain data in memoryCache so application works uninterrupted
            Logger.info(`[StorageService] Active memory retention for '${key}' (Storage quota protected)`);
          }
        }
      }
    } catch (e) {
      Logger.warn(`localStorage unexpected error for ${key}:`, e, 'storageService');
    }

    // L3 Master Storage Sync: Mirror automatically to IndexedDB in background
    if (key.startsWith('gmao_')) {
      try {
        if (value === null || value === undefined) {
          indexedDBService.removeItem(key).catch(() => {});
        } else {
          indexedDBService.setItem(key, value).catch(() => {});
        }
      } catch {}
    }

    return true;
  },

  /**
   * Asynchronous setItem that awaits IndexedDB completion in addition to synchronous memoryCache + localStorage write.
   * Prevents L2 -> L1 hydration races during factory clear/reset operations.
   */
  async setItemAsync(key, value) {
    this.setItem(key, value);
    if (key.startsWith('gmao_')) {
      try {
        if (value === null || value === undefined) {
          await indexedDBService.removeItem(key);
        } else {
          await indexedDBService.setItem(key, value);
        }
      } catch {}
    }
    return true;
  },

  /**
   * Remove item from memory cache, localStorage, and IndexedDB
   */
  removeItem(key) {
    memoryCache.delete(key);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {}

    if (key.startsWith('gmao_')) {
      try {
        indexedDBService.removeItem(key).catch(() => {});
      } catch {}
    }

    return true;
  },

  /**
   * Asynchronous removeItem that awaits IndexedDB removal completion.
   */
  async removeItemAsync(key) {
    this.removeItem(key);
    if (key.startsWith('gmao_')) {
      try {
        await indexedDBService.removeItem(key);
      } catch {}
    }
    return true;
  },

  /**
   * Synchronously and asynchronously purges a batch of keys from memoryCache, localStorage, and IndexedDB.
   */
  async removeItemsBatchAsync(keys = []) {
    if (!Array.isArray(keys) || keys.length === 0) return true;
    for (const k of keys) {
      if (!k) continue;
      memoryCache.delete(k);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(k);
        }
      } catch {}
    }
    try {
      await Promise.all(
        keys.filter(Boolean).map((k) => indexedDBService.removeItem(k).catch(() => false))
      );
    } catch {}
    return true;
  },

  /**
   * Hydrate a key from IndexedDB if not found or evicted in localStorage.
   * Implements guarded L3 -> L2 -> L1 healing flow:
   * - Never overwrites an explicit empty factory state (START_MODE === 'empty' or DEMO_MODE === false).
   * - Never overwrites a key that already has an authoritative array/object in localStorage.
   */
  async hydrateFromIndexedDB(key, fallback = null) {
    try {
      const startMode = this.getItem(STORAGE_KEYS.START_MODE);
      const demoFlag = this.getItem(STORAGE_KEYS.DEMO_MODE);
      if (startMode === 'empty' || demoFlag === false || demoFlag === 'false') {
        const current = this.getItem(key, undefined);
        if (current !== undefined && current !== null) {
          return current;
        }
        return fallback;
      }

      const existing = this.getItem(key, undefined);
      if (Array.isArray(existing) && existing.length > 0) {
        return existing;
      }

      const idbVal = await indexedDBService.getItem(key, null);
      if (idbVal !== null && idbVal !== undefined) {
        this.setItem(key, idbVal);
        return idbVal;
      }
    } catch (err) {
      Logger.warn(`[StorageService] Hydrate error for ${key}:`, err);
    }
    return fallback;
  },

  /**
   * Clear entire memory cache
   */
  clearCache() {
    memoryCache.clear();
  },

  /**
   * Get current cache size
   */
  getCacheSize() {
    return memoryCache.size;
  },

  /**
   * Convenience method to save updated stock articles
   */
  saveArticles(articles) {
    return this.setItem(STORAGE_KEYS.RAW_STOCK, articles);
  },

  /**
   * Hash PIN code using SHA-256 (synchronous helper for legacy callers)
   */
  hashPin(pin) {
    return CryptoJS.SHA256(String(pin || '').trim()).toString();
  },

  /**
   * Verify input PIN against stored sha256 hash without writing to localStorage
   */
  verifyPin(inputPin, storedValue) {
    if (!storedValue) return false;
    const cleanInput = String(inputPin || '').trim();
    if (storedValue.length === 64 && /^[0-9a-f]+$/i.test(storedValue)) {
      return CryptoJS.SHA256(cleanInput).toString() === storedValue;
    }
    return cleanInput === String(storedValue).trim();
  },
};
