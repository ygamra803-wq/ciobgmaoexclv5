import { Logger } from '../logger/LoggerService';
import { indexedDBService } from '../../utils/indexedDBService';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';

export const BACKUP_STORAGE_KEY = 'gmao_snapshots_history';
export const MAX_SNAPSHOTS = 12;

export const MASTER_REFERENTIAL_KEYS = [
  STORAGE_KEYS.MACHINES,
  STORAGE_KEYS.ZONES,
  STORAGE_KEYS.FAMILIES,
  STORAGE_KEYS.TEMPLATES,
  STORAGE_KEYS.BLUEPRINTS,
  STORAGE_KEYS.MACHINE_BOM,
  STORAGE_KEYS.STOCK_TYPES,
  STORAGE_KEYS.DESIGNATIONS,
  STORAGE_KEYS.PERSONNEL,
  STORAGE_KEYS.TECHNICIANS,
  STORAGE_KEYS.OPERATIONS,
  STORAGE_KEYS.COMP_GROUPS,
  STORAGE_KEYS.COMP_FAMILIES,
  STORAGE_KEYS.COMP_TEMPLATES,
  STORAGE_KEYS.PART_TYPES,
  STORAGE_KEYS.PART_DESIGNATIONS,
  STORAGE_KEYS.PREVENTIVE_ACTIONS,
  STORAGE_KEYS.PREVENTIVE_GUIDES,
  STORAGE_KEYS.PREVENTIVE_PLANS,
  STORAGE_KEYS.RAW_STOCK,
  STORAGE_KEYS.WAREHOUSE_ITEMS,
  STORAGE_KEYS.ENTREPOT_COMPONENTS,
];

export const OPERATIONS_HISTORY_KEYS = [
  STORAGE_KEYS.CORRECTIVE_INTERVENTIONS,
  STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE,
  STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES,
  STORAGE_KEYS.CORRECTIVE_TRAVAUX,
  STORAGE_KEYS.CORRECTIVE_INTERVENANTS,
  STORAGE_KEYS.MOUVEMENTS,
  STORAGE_KEYS.PREVENTIVE_TASKS,
  STORAGE_KEYS.SORTIE_EXTERNE,
  'gmao_access_logs',
];

const CRITICAL_KEYS = Array.from(new Set([
  STORAGE_KEYS.FULL_STATE_SNAPSHOT,
  ...MASTER_REFERENTIAL_KEYS,
  ...OPERATIONS_HISTORY_KEYS,
]));

// In-memory cache for fast, synchronous retrieval of recent snapshot payloads
const snapshotDataCache = new Map();

/**
 * High-Capacity, Quota-Safe AutoBackupService.
 * Stores lightweight metadata in localStorage (<2KB) and full snapshot dumps in IndexedDB.
 */
export class AutoBackupService {
  static changeCounter = 0;
  static autoIntervalId = null;
  static isSanitized = false;

  /**
   * Request persistent storage to prevent automatic browser deletion of IndexedDB / LocalStorage
   * @returns {Promise<boolean>}
   */
  static async requestPersistentStorage() {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
          const granted = await navigator.storage.persist();
          Logger.info(`[AutoBackupService] Persistent storage requested. Granted: ${granted}`);
          return granted;
        }
        return isPersisted;
      } catch (err) {
        Logger.warn('[AutoBackupService] Persistent storage request error:', err);
      }
    }
    return false;
  }

  /**
   * Check storage quota using navigator.storage.estimate().
   * Creates an emergency restore snapshot if quota usage exceeds 80%.
   * @returns {Promise<{ usage: number, quota: number, percentage: number, isCritical: boolean }>}
   */
  static async checkStorageQuota() {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 1;
        const percentage = Math.min(100, Number(((usage / quota) * 100).toFixed(2)));
        const isCritical = percentage >= 80;

        if (isCritical) {
          Logger.warn(`[AutoBackupService] CRITICAL Storage Quota Warning: ${percentage}% used (${(usage/1024/1024).toFixed(1)}MB / ${(quota/1024/1024).toFixed(1)}MB)`);
          this.createSnapshot('Sauvegarde d\'urgence - Quota stockage > 80%', false);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gmao:storage_quota_critical', {
              detail: { usage, quota, percentage }
            }));
          }
        }

        return { usage, quota, percentage, isCritical };
      } catch (err) {
        Logger.warn('[AutoBackupService] Storage estimate error:', err);
      }
    }
    return { usage: 0, quota: 0, percentage: 0, isCritical: false };
  }

  /**
   * Direct export using File System Access API (showSaveFilePicker) with blob download fallback
   * @param {object} payloadData
   * @param {string} suggestedName
   */
  static async exportBackupToFileSystem(payloadData, suggestedName = '') {
    const defaultName = suggestedName || `CIOB_GMAO_Enterprise_Backup_${new Date().toISOString().split('T')[0]}.json`;
    const jsonStr = JSON.stringify(payloadData, null, 2);

    if (typeof window !== 'undefined' && window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: 'Fichier de sauvegarde GMAO (JSON)',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        Logger.info('[AutoBackupService] Backup written directly to file system via File System Access API');
        return true;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          return false; // User cancelled dialog
        }
        Logger.warn('[AutoBackupService] File System Access API error, falling back to standard download', err);
      }
    }

    // Fallback standard browser download
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * Safely writes a key to localStorage with automatic quota management
   * @param {string} key
   * @param {string} value
   */
  static safeSetLocalStorage(key, value) {
    try {
      const parsedVal = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return value; } })() : value;
      return storageService.setItem(key, parsedVal);
    } catch (e) {
      Logger.warn(`[AutoBackupService] LocalStorage quota pressure on '${key}'. Purging legacy history...`, e);
      try {
        const rawHistory = storageService.getItem(BACKUP_STORAGE_KEY, []);
        if (Array.isArray(rawHistory)) {
          const stripped = rawHistory.map((s) => ({
            id: s.id,
            timestamp: s.timestamp,
            dateStr: s.dateStr,
            reason: s.reason,
            isManual: s.isManual,
            counts: s.counts,
            version: s.version || '3.0.0',
          }));
          storageService.setItem(BACKUP_STORAGE_KEY, stripped.slice(0, 5));
        }
        return storageService.setItem(key, value);
      } catch (retryErr) {
        Logger.warn('[AutoBackupService] LocalStorage write failed after recovery attempt', retryErr);
        return false;
      }
    }
  }

  /**
   * Cleans up legacy localStorage snapshots that contain large nested data objects
   */
  static sanitizeLegacyStorage() {
    if (this.isSanitized) return;
    this.isSanitized = true;

    try {
      const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
      if (!raw) return;

      const history = JSON.parse(raw);
      if (!Array.isArray(history)) return;

      let hasHeavyPayloads = false;
      const cleanMetadataList = [];

      for (const item of history) {
        if (!item || !item.id) continue;

        if (item.data) {
          hasHeavyPayloads = true;
          snapshotDataCache.set(item.id, item);
          indexedDBService.setItem(`gmao_snap_${item.id}`, item).catch(() => {});
        }

        cleanMetadataList.push({
          id: item.id,
          timestamp: item.timestamp || Date.now(),
          dateStr: item.dateStr || new Date().toLocaleString('fr-FR'),
          reason: item.reason || 'Sauvegarde',
          isManual: Boolean(item.isManual),
          counts: item.counts || {},
          version: item.version || '3.0.0',
        });
      }

      if (hasHeavyPayloads) {
        const trimmed = cleanMetadataList.slice(0, MAX_SNAPSHOTS);
        this.safeSetLocalStorage(BACKUP_STORAGE_KEY, JSON.stringify(trimmed));
        Logger.info(`[AutoBackupService] Successfully sanitized ${history.length} snapshots in localStorage`);
      }
    } catch (err) {
      Logger.warn('[AutoBackupService] Sanitization warning', err);
    }
  }

  /**
   * Captures the current snapshot of all application data
   * @param {string} reason - Cause of snapshot
   * @param {boolean} isManual - Whether triggered manually
   * @returns {object} The created snapshot metadata object
   */
  static createSnapshot(reason = 'Point de restauration automatique', isManual = false) {
    try {
      this.sanitizeLegacyStorage();
      this.requestPersistentStorage();

      const data = {};
      const counts = {};

      for (const key of CRITICAL_KEYS) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            data[key] = parsed;
            if (Array.isArray(parsed)) {
              counts[key.replace('gmao_', '')] = parsed.length;
            }
          }
        } catch {
          // ignore corrupted single key
        }
      }

      const timestamp = Date.now();
      const dateStr = new Date(timestamp).toLocaleString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const snapshotId = `snap-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;

      const fullSnapshot = {
        id: snapshotId,
        timestamp,
        dateStr,
        reason,
        isManual,
        counts,
        data,
        version: '3.0.0',
      };

      snapshotDataCache.set(snapshotId, fullSnapshot);

      if (indexedDBService && typeof indexedDBService.setItem === 'function') {
        indexedDBService.setItem(`gmao_snap_${snapshotId}`, fullSnapshot).catch((idbErr) => {
          Logger.warn('[AutoBackupService] IndexedDB snapshot persistence warning', idbErr);
        });
      }

      const metadata = {
        id: snapshotId,
        timestamp,
        dateStr,
        reason,
        isManual,
        counts,
        version: '3.0.0',
      };

      const history = this.listSnapshots();
      const filtered = history.filter((s) => s.id !== snapshotId);
      filtered.unshift(metadata);

      const trimmedHistory = filtered.slice(0, MAX_SNAPSHOTS);
      this.safeSetLocalStorage(BACKUP_STORAGE_KEY, JSON.stringify(trimmedHistory));

      this.changeCounter = 0;
      Logger.info(`[AutoBackupService] Snapshot created: ${snapshotId} (${reason})`, { counts });
      return fullSnapshot;
    } catch (err) {
      Logger.error('[AutoBackupService] Failed to create snapshot', err);
      return null;
    }
  }

  /**
   * List all stored snapshots sorted by most recent first
   * @returns {Array} List of snapshot headers/metadata items
   */
  static listSnapshots() {
    try {
      this.sanitizeLegacyStorage();
      const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      Logger.warn('[AutoBackupService] Could not parse snapshot history', err);
      return [];
    }
  }

  /**
   * Get a specific snapshot (with data payload) by ID
   * @param {string} snapshotId 
   * @returns {Promise<object|null>}
   */
  static async getSnapshotAsync(snapshotId) {
    if (snapshotDataCache.has(snapshotId)) {
      return snapshotDataCache.get(snapshotId);
    }

    try {
      if (indexedDBService && typeof indexedDBService.getItem === 'function') {
        const fromIDB = await indexedDBService.getItem(`gmao_snap_${snapshotId}`);
        if (fromIDB && fromIDB.data) {
          snapshotDataCache.set(snapshotId, fromIDB);
          return fromIDB;
        }
      }
    } catch (e) {
      Logger.warn(`[AutoBackupService] IDB read failed for ${snapshotId}`, e);
    }

    const list = this.listSnapshots();
    const found = list.find((s) => s.id === snapshotId);
    if (found && found.data) {
      snapshotDataCache.set(snapshotId, found);
      return found;
    }

    return found || null;
  }

  /**
   * Synchronous getSnapshot (checks cache and legacy storage)
   * @param {string} snapshotId 
   * @returns {object|null}
   */
  static getSnapshot(snapshotId) {
    if (snapshotDataCache.has(snapshotId)) {
      return snapshotDataCache.get(snapshotId);
    }
    const list = this.listSnapshots();
    return list.find((s) => s.id === snapshotId) || null;
  }

  /**
   * Restore state from a specific snapshot
   * @param {string} snapshotId 
   * @returns {Promise<boolean>}
   */
  static async restoreSnapshot(snapshotId) {
    try {
      let snapshot = snapshotDataCache.get(snapshotId);

      if (!snapshot || !snapshot.data) {
        snapshot = await this.getSnapshotAsync(snapshotId);
      }

      if (!snapshot || !snapshot.data) {
        throw new Error(`Snapshot ${snapshotId} not found or has no restorable data`);
      }

      this.createSnapshot('Sauvegarde de sécurité avant restauration', false);

      for (const [key, value] of Object.entries(snapshot.data)) {
        if (value !== undefined && value !== null) {
          try {
            storageService.setItem(key, value);
          } catch (storageErr) {
            Logger.warn(`[AutoBackupService] Could not write ${key} to storageService`, storageErr);
          }
        }
      }

      try {
        if (indexedDBService && typeof indexedDBService.setItemsBatch === 'function') {
          await indexedDBService.setItemsBatch(snapshot.data);
        }
      } catch (idbErr) {
        Logger.warn('[AutoBackupService] IDB batch sync warning on restore', idbErr);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gmao:state_synced', { detail: snapshot.data }));
      }

      Logger.info(`[AutoBackupService] Successfully restored snapshot: ${snapshotId}`);
      return true;
    } catch (err) {
      Logger.error(`[AutoBackupService] Restore failed for ${snapshotId}`, err);
      return false;
    }
  }

  /**
   * Delete a specific snapshot
   * @param {string} snapshotId 
   * @returns {boolean}
   */
  static deleteSnapshot(snapshotId) {
    try {
      snapshotDataCache.delete(snapshotId);
      if (indexedDBService && typeof indexedDBService.deleteItem === 'function') {
        indexedDBService.deleteItem(`gmao_snap_${snapshotId}`).catch(() => {});
      }

      const history = this.listSnapshots();
      const filtered = history.filter((s) => s.id !== snapshotId);
      this.safeSetLocalStorage(BACKUP_STORAGE_KEY, JSON.stringify(filtered));

      Logger.info(`[AutoBackupService] Deleted snapshot: ${snapshotId}`);
      return true;
    } catch (err) {
      Logger.error(`[AutoBackupService] Failed to delete snapshot ${snapshotId}`, err);
      return false;
    }
  }

  /**
   * Export all current data as a standalone JSON backup file
   */
  static exportFullBackupJSON() {
    this.exportPartitionJSON('full');
  }

  /**
   * Export specific partition
   * @param {'master'|'operations'|'full'} partitionType
   */
  static exportPartitionJSON(partitionType = 'full') {
    let targetKeys = CRITICAL_KEYS;
    let label = 'Full';

    if (partitionType === 'master') {
      targetKeys = MASTER_REFERENTIAL_KEYS;
      label = 'Referentiel_Master';
    } else if (partitionType === 'operations') {
      targetKeys = OPERATIONS_HISTORY_KEYS;
      label = 'Historique_Operations';
    }

    const data = {};
    for (const key of targetKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) data[key] = JSON.parse(raw);
      } catch {
        // pass
      }
    }

    const payload = {
      app: 'CIOB GMAO Enterprise',
      partition: partitionType,
      exportDate: new Date().toISOString(),
      version: '3.0.0',
      data,
    };

    const fileName = `CIOB_GMAO_${label}_${new Date().toISOString().split('T')[0]}.json`;
    this.exportBackupToFileSystem(payload, fileName);
  }

  /**
   * Import data from a JSON backup file
   * @param {string} jsonText 
   * @returns {boolean}
   */
  static importFullBackupJSON(jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      const data = parsed.data || parsed;
      const partition = parsed.partition || 'full';

      this.createSnapshot(`Sauvegarde avant import ${partition}`, false);

      for (const [key, value] of Object.entries(data)) {
        if (CRITICAL_KEYS.includes(key)) {
          this.safeSetLocalStorage(key, JSON.stringify(value));
        }
      }

      indexedDBService.setItemsBatch(data).catch(() => {});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gmao:state_synced', { detail: data }));
      }

      Logger.info(`[AutoBackupService] Backup imported successfully (${partition})`);
      return true;
    } catch (err) {
      Logger.error('[AutoBackupService] Failed to import JSON backup', err);
      return false;
    }
  }

  /**
   * Safely purge operations history partition while preserving 100% of Master Referential
   * @returns {boolean}
   */
  static resetOperationsHistory() {
    try {
      this.createSnapshot('Sauvegarde avant réinitialisation des opérations', false);

      for (const key of OPERATIONS_HISTORY_KEYS) {
        try {
          localStorage.removeItem(key);
        } catch {
          // pass
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gmao:state_synced', { detail: { action: 'reset_operations' } }));
      }

      Logger.info('[AutoBackupService] Operations history partition reset successfully');
      return true;
    } catch (err) {
      Logger.error('[AutoBackupService] Failed to reset operations partition', err);
      return false;
    }
  }

  /**
   * Notify that data was modified; triggers an auto-snapshot every N changes
   * @param {number} threshold - Number of changes before auto-snapshot
   */
  static recordChange(threshold = 10) {
    this.changeCounter++;
    if (this.changeCounter >= threshold) {
      this.createSnapshot('Sauvegarde automatique après modifications', false);
    }
  }
}

// Automatically trigger persistent storage & sanitization on startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    AutoBackupService.sanitizeLegacyStorage();
    AutoBackupService.requestPersistentStorage();
  }, 100);
}
