import { Logger } from '../logger/LoggerService';
import { indexedDBService } from '../../utils/indexedDBService';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { DataGateway } from '../../application/DataGateway';
import { useGmaoStore } from '../../store/useGmaoStore';

export const BACKUP_STORAGE_KEY = 'gmao_snapshots_history';
export const MAX_SNAPSHOTS = 12;

export const MASTER_REFERENTIAL_KEYS = [
  STORAGE_KEYS.MACHINES,
  STORAGE_KEYS.GENERAL_SYSTEM_TYPES,
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
  STORAGE_KEYS.SORTIE_DEMANDS,
  STORAGE_KEYS.PREVENTIVE_TASKS,
  STORAGE_KEYS.PREVENTIVE_EXECUTIONS,
  STORAGE_KEYS.SORTIE_EXTERNE,
  'gmao_access_logs',
];

const CRITICAL_KEYS = Array.from(new Set([
  STORAGE_KEYS.FULL_STATE_SNAPSHOT,
  ...MASTER_REFERENTIAL_KEYS,
  ...OPERATIONS_HISTORY_KEYS,
]));

const CANONICAL_PROP_TO_STORAGE_KEY: Record<string, string> = {
  machines: STORAGE_KEYS.MACHINES,
  generalSystemTypes: STORAGE_KEYS.GENERAL_SYSTEM_TYPES,
  zones: STORAGE_KEYS.ZONES,
  families: STORAGE_KEYS.FAMILIES,
  templates: STORAGE_KEYS.TEMPLATES,
  blueprints: STORAGE_KEYS.BLUEPRINTS,
  machineElementsLedger: STORAGE_KEYS.MACHINE_BOM,
  types: STORAGE_KEYS.STOCK_TYPES,
  designations: STORAGE_KEYS.DESIGNATIONS,
  users: STORAGE_KEYS.PERSONNEL,
  technicians: STORAGE_KEYS.TECHNICIANS,
  operations: STORAGE_KEYS.OPERATIONS,
  compGroups: STORAGE_KEYS.COMP_GROUPS,
  compFamilies: STORAGE_KEYS.COMP_FAMILIES,
  compTemplates: STORAGE_KEYS.COMP_TEMPLATES,
  partTypes: STORAGE_KEYS.PART_TYPES,
  partDesignations: STORAGE_KEYS.PART_DESIGNATIONS,
  preventiveActions: STORAGE_KEYS.PREVENTIVE_ACTIONS,
  preventiveGuides: STORAGE_KEYS.PREVENTIVE_GUIDES,
  preventivePlans: STORAGE_KEYS.PREVENTIVE_PLANS,
  rawStock: STORAGE_KEYS.RAW_STOCK,
  warehouseItems: STORAGE_KEYS.WAREHOUSE_ITEMS,
  entrepotComponents: STORAGE_KEYS.ENTREPOT_COMPONENTS,
  correctiveInterventions: STORAGE_KEYS.CORRECTIVE_INTERVENTIONS,
  correctiveActionsByPanne: STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE,
  correctivePanneCategories: STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES,
  correctiveTravauxAFaire: STORAGE_KEYS.CORRECTIVE_TRAVAUX,
  correctiveIntervenants: STORAGE_KEYS.CORRECTIVE_INTERVENANTS,
  mouvements: STORAGE_KEYS.MOUVEMENTS,
  sortieDemands: STORAGE_KEYS.SORTIE_DEMANDS,
  preventiveTasks: STORAGE_KEYS.PREVENTIVE_TASKS,
  preventiveExecutions: STORAGE_KEYS.PREVENTIVE_EXECUTIONS,
  sortiesExterne: STORAGE_KEYS.SORTIE_EXTERNE,
};

const STORAGE_KEY_TO_CANONICAL_PROP: Record<string, string> = Object.entries(
  CANONICAL_PROP_TO_STORAGE_KEY
).reduce((acc, [prop, storageKey]) => {
  acc[storageKey] = prop;
  return acc;
}, {} as Record<string, string>);

const FORBIDDEN_SECRET_FIELD_NAMES = new Set([
  'password',
  'passwordHash',
  'pinHash',
  'masterPin',
  'apiToken',
  'apiKey',
  'secret',
  'privateKey',
  'X-GMAO-API-TOKEN',
]);

function stripSecretsDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripSecretsDeep);
  }
  if (value && typeof value === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_SECRET_FIELD_NAMES.has(k)) continue;
      cleaned[k] = stripSecretsDeep(v);
    }
    return cleaned;
  }
  return value;
}

function hydrateStoreFromStorageMap(storageMap: Record<string, any>) {
  const serverState: Record<string, any> = {};
  for (const [key, val] of Object.entries(storageMap)) {
    const canonicalProp = STORAGE_KEY_TO_CANONICAL_PROP[key];
    if (canonicalProp) {
      serverState[canonicalProp] = val;
    } else if (CANONICAL_PROP_TO_STORAGE_KEY[key]) {
      serverState[key] = val;
    }
  }
  if (Object.keys(serverState).length === 0) return;

  try {
    const store = useGmaoStore.getState();
    DataGateway.loadFullServerState(serverState, {
      applyRemoteStateUpdate: store.applyRemoteStateUpdate,
      setTypes: store.setTypes,
      setDesignations: store.setDesignations,
      setRawStock: store.setRawStock,
      setFamilies: store.setFamilies,
      setTemplates: store.setTemplates,
      setBlueprints: store.setBlueprints,
      setMachines: store.setMachines,
      setGeneralSystemTypes: store.setGeneralSystemTypes,
      setZones: store.setZones,
      setMachineElementsLedger: store.setMachineElementsLedger,
      setWarehouseItems: store.setWarehouseItems,
      setEntrepotComponents: store.setEntrepotComponents,
      setCompGroups: store.setCompGroups,
      setCompFamilies: store.setCompFamilies,
      setCompTemplates: store.setCompTemplates,
      setPartTypes: store.setPartTypes,
      setPartDesignations: store.setPartDesignations,
      setUsers: store.setUsers,
      setTechnicians: store.setTechnicians,
      setOperations: store.setOperations,
      setMouvements: store.setMouvements,
      setSortieDemands: store.setSortieDemands,
      setPreventiveTasks: store.setPreventiveTasks,
      setPreventiveActions: store.setPreventiveActions,
      setPreventiveGuides: store.setPreventiveGuides,
      setPreventivePlans: store.setPreventivePlans,
      setPreventiveExecutions: store.setPreventiveExecutions,
      setSortiesExterne: store.setSortiesExterne,
      setCorrectiveInterventions: store.setCorrectiveInterventions,
      setCorrectiveActionsByPanne: store.setCorrectiveActionsByPanne,
      setCorrectivePanneCategories: store.setCorrectivePanneCategories,
      setCorrectiveTravauxAFaire: store.setCorrectiveTravauxAFaire,
      setCorrectiveIntervenants: store.setCorrectiveIntervenants,
    });
  } catch (err) {
    Logger.warn('[AutoBackupService] Store hydration warning on restore', err);
  }
}

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
   * Collects sanitized canonical storage data for target keys from localStorage and live Zustand store.
   */
  static collectStorageDataForKeys(targetKeys = CRITICAL_KEYS) {
    const data: Record<string, any> = {};
    let storeState: Record<string, any> = {};
    try {
      storeState = (useGmaoStore.getState() as unknown as Record<string, any>) || {};
    } catch {
      storeState = {};
    }

    for (const key of targetKeys) {
      try {
        let value: any = undefined;
        const raw = localStorage.getItem(key);
        if (raw) {
          value = JSON.parse(raw);
        }
        const canonicalProp = STORAGE_KEY_TO_CANONICAL_PROP[key];
        if (
          canonicalProp &&
          storeState[canonicalProp] !== undefined &&
          (value === undefined ||
            (Array.isArray(value) &&
              value.length === 0 &&
              Array.isArray(storeState[canonicalProp]) &&
              storeState[canonicalProp].length > 0))
        ) {
          value = storeState[canonicalProp];
        }
        if (value !== undefined) {
          data[key] = stripSecretsDeep(value);
        }
      } catch {
        // ignore corrupted single key
      }
    }
    return data;
  }

  /**
   * Computes normalized entity counts from a storage or canonical state map.
   */
  static summarizeCounts(rawMap: Record<string, any> = {}) {
    const counts: Record<string, number> = {};
    for (const [key, val] of Object.entries(rawMap)) {
      if (Array.isArray(val)) {
        counts[key.replace('gmao_', '')] = val.length;
      }
    }
    const getLen = (storageKey: string, propName: string) => {
      if (Array.isArray(rawMap[storageKey])) return rawMap[storageKey].length;
      if (Array.isArray(rawMap[propName])) return rawMap[propName].length;
      return 0;
    };
    counts.machines = getLen(STORAGE_KEYS.MACHINES, 'machines');
    counts.spare_parts = getLen(STORAGE_KEYS.RAW_STOCK, 'rawStock');
    counts.movements = getLen(STORAGE_KEYS.MOUVEMENTS, 'mouvements');
    counts.corrective = getLen(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, 'correctiveInterventions');
    counts.preventive = getLen(STORAGE_KEYS.PREVENTIVE_TASKS, 'preventiveTasks');
    counts.preventive_executions = getLen(STORAGE_KEYS.PREVENTIVE_EXECUTIONS, 'preventiveExecutions');
    counts.sortie_demands = getLen(STORAGE_KEYS.SORTIE_DEMANDS, 'sortieDemands');
    return counts;
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

      const data = this.collectStorageDataForKeys(CRITICAL_KEYS);
      const counts = this.summarizeCounts(data);

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
        version: '4.0.0',
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
        version: '4.0.0',
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

      hydrateStoreFromStorageMap(snapshot.data);

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
   * Builds the operational JSON backup payload (without secrets or session tokens).
   */
  static buildOperationalSnapshotPayload(partitionType: 'master' | 'operations' | 'full' = 'full') {
    let targetKeys = CRITICAL_KEYS;
    if (partitionType === 'master') {
      targetKeys = MASTER_REFERENTIAL_KEYS;
    } else if (partitionType === 'operations') {
      targetKeys = OPERATIONS_HISTORY_KEYS;
    }

    const data = this.collectStorageDataForKeys(targetKeys);
    const counts = this.summarizeCounts(data);

    return {
      app: 'CIOB GMAO Enterprise',
      partition: partitionType,
      exportDate: new Date().toISOString(),
      version: '4.0.0',
      counts,
      data,
    };
  }

  /**
   * Export all current data as a standalone JSON backup file
   */
  static exportFullBackupJSON() {
    return this.exportPartitionJSON('full');
  }

  /**
   * Export specific partition
   * @param {'master'|'operations'|'full'} partitionType
   */
  static exportPartitionJSON(partitionType: 'master' | 'operations' | 'full' = 'full') {
    let label = 'Full';
    if (partitionType === 'master') {
      label = 'Referentiel_Master';
    } else if (partitionType === 'operations') {
      label = 'Historique_Operations';
    }

    const payload = this.buildOperationalSnapshotPayload(partitionType);
    const fileName = `CIOB_GMAO_${label}_${new Date().toISOString().split('T')[0]}.json`;
    this.exportBackupToFileSystem(payload, fileName);
    return payload;
  }

  /**
   * Normalize any valid backup JSON (AutoBackupService format or gmao_state.json format)
   * into a sanitized map of canonical STORAGE_KEYS.
   */
  static parseAndNormalizeBackupJSON(jsonText: string): {
    valid: boolean;
    partition: string;
    exportDate: string | null;
    storageMap: Record<string, any>;
    counts: Record<string, number>;
    error?: string;
  } {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          valid: false,
          partition: 'full',
          exportDate: null,
          storageMap: {},
          counts: {},
          error: 'Structure JSON invalide.',
        };
      }

      const rawData =
        parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
          ? parsed.data
          : parsed;
      const partition = typeof parsed.partition === 'string' ? parsed.partition : 'full';
      const exportDate =
        typeof parsed.exportDate === 'string'
          ? parsed.exportDate
          : typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : null;

      const storageMap: Record<string, any> = {};
      for (const [key, value] of Object.entries(rawData)) {
        if (value === undefined) continue;
        if (CRITICAL_KEYS.includes(key)) {
          storageMap[key] = stripSecretsDeep(value);
        } else if (CANONICAL_PROP_TO_STORAGE_KEY[key]) {
          storageMap[CANONICAL_PROP_TO_STORAGE_KEY[key]] = stripSecretsDeep(value);
        }
      }

      const recognizedCount = Object.keys(storageMap).length;
      if (recognizedCount === 0) {
        return {
          valid: false,
          partition,
          exportDate,
          storageMap: {},
          counts: {},
          error: 'Aucune entité GMAO reconnue dans ce fichier JSON.',
        };
      }

      const counts = this.summarizeCounts(storageMap);
      return {
        valid: true,
        partition,
        exportDate,
        storageMap,
        counts,
      };
    } catch {
      return {
        valid: false,
        partition: 'full',
        exportDate: null,
        storageMap: {},
        counts: {},
        error: 'Fichier JSON illisible ou corrompu.',
      };
    }
  }

  /**
   * Import data from a JSON backup file
   * @param {string} jsonText 
   * @returns {boolean}
   */
  static importFullBackupJSON(jsonText) {
    try {
      const normalized = this.parseAndNormalizeBackupJSON(jsonText);
      if (!normalized.valid) {
        Logger.warn('[AutoBackupService] Rejected invalid backup JSON:', normalized.error);
        return false;
      }

      const { storageMap, partition } = normalized;
      this.createSnapshot(`Sauvegarde avant import ${partition}`, false);

      for (const [key, value] of Object.entries(storageMap)) {
        if (CRITICAL_KEYS.includes(key)) {
          this.safeSetLocalStorage(key, JSON.stringify(value));
        }
      }

      hydrateStoreFromStorageMap(storageMap);

      if (indexedDBService && typeof indexedDBService.setItemsBatch === 'function') {
        indexedDBService.setItemsBatch(storageMap).catch(() => {});
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gmao:state_synced', { detail: storageMap }));
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

      const emptyOpsMap: Record<string, any> = {};
      for (const key of OPERATIONS_HISTORY_KEYS) {
        try {
          localStorage.removeItem(key);
          if (
            key === STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE ||
            key === STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES
          ) {
            emptyOpsMap[key] = {};
          } else if (key !== 'gmao_access_logs') {
            emptyOpsMap[key] = [];
          }
        } catch {
          // pass
        }
      }

      hydrateStoreFromStorageMap(emptyOpsMap);

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
