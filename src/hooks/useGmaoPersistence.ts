import { useEffect, useRef } from 'react';
import { useAutoSave } from './useAutoSave';
import { useStateSync } from './useStateSync';
import { useEnterpriseDbSync } from './useEnterpriseDbSync';
import { indexedDBService } from '../infrastructure/database/IndexedDBService';
import { storageService } from '../utils/storageService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { serverSyncService } from '../services/serverSyncService';

/**
 * Handles persistence, debounced storage, multi-tab sync, and Enterprise database sync
 * Modularized and composed of useAutoSave, useStateSync, and useEnterpriseDbSync
 */
export function useGmaoPersistence({
  state,
  setters,
  validators,
  onStateChange,
}) {
  const hydratedFromIdb = useRef(false);

  // 0. L2 -> L1 Self-Healing Hydration from IndexedDB & Server-Authoritative Sync on initial mount
  useEffect(() => {
    if (hydratedFromIdb.current) return;
    hydratedFromIdb.current = true;

    const demoFlag = storageService.getItem(STORAGE_KEYS.DEMO_MODE);
    const startMode = storageService.getItem(STORAGE_KEYS.START_MODE);
    if (startMode === 'empty' || demoFlag === false || demoFlag === 'false') {
      return;
    }

    (async () => {
      try {
        // First check if Server has authoritative persisted state
        const serverCheck = await serverSyncService.fetchServerState();
        if (serverCheck.online && serverCheck.state && serverCheck.summary.totalItems > 0) {
          const lastSyncAt = serverSyncService.getLastSyncAt();
          const localModifiedAt = serverSyncService.getLocalModifiedAt();
          const serverTime = serverCheck.summary.updatedAt
            ? new Date(serverCheck.summary.updatedAt).getTime()
            : 0;
          const localTime = localModifiedAt ? new Date(localModifiedAt).getTime() : 0;

          // If never synced on this browser OR server state is newer than local modifications, pull cleanly
          if (!lastSyncAt || serverTime >= localTime) {
            await serverSyncService.pullFromServer({ force: true, setters });
            return;
          }
        }

        const idbSnap = await indexedDBService.getItem(STORAGE_KEYS.FULL_STATE_SNAPSHOT);
        if (!idbSnap || typeof idbSnap !== 'object') return;

        const patch = {};
        const arrayFields = [
          'pdrGroups',
          'types',
          'designations',
          'rawStock',
          'families',
          'templates',
          'blueprints',
          'machines',
          'zones',
          'warehouseItems',
          'entrepotComponents',
          'compGroups',
          'compFamilies',
          'compTemplates',
          'partGroups',
          'partTypes',
          'partDesignations',
          'users',
          'technicians',
          'operations',
          'mouvements',
          'preventiveTasks',
          'preventiveActions',
          'preventiveGuides',
          'preventivePlans',
          'preventiveExecutions',
          'sortiesExterne',
          'correctiveInterventions',
          'correctiveTravauxAFaire',
          'correctiveIntervenants',
        ];

        for (const field of arrayFields) {
          const currentVal = state?.[field];
          const idbVal = idbSnap[field];
          if ((!Array.isArray(currentVal) || currentVal.length === 0) && Array.isArray(idbVal) && idbVal.length > 0) {
            patch[field] = idbVal;
          }
        }

        if (Object.keys(patch).length > 0 && setters?.applyRemoteStateUpdate) {
          setters.applyRemoteStateUpdate(patch);
        }
      } catch {
        // Ignore IndexedDB or network read errors in restricted environments
      }
    })();
  }, []);

  // Synchronize external preventive_tasks_updated events (e.g. Excel / JSON import) with Zustand store
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleTasksUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail) && typeof setters?.setPreventiveTasks === 'function') {
        setters.setPreventiveTasks(e.detail);
      }
    };
    const handleExecutionsUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail) && typeof setters?.setPreventiveExecutions === 'function') {
        setters.setPreventiveExecutions(e.detail);
      }
    };
    window.addEventListener('preventive_tasks_updated', handleTasksUpdated);
    window.addEventListener('preventive_executions_updated', handleExecutionsUpdated);
    return () => {
      window.removeEventListener('preventive_tasks_updated', handleTasksUpdated);
      window.removeEventListener('preventive_executions_updated', handleExecutionsUpdated);
    };
  }, [setters]);

  // 0.5 Periodic Network Polling controlled by SettingsDirectoryTab (gmao_polling_interval: 'off' | '5s' | '10s' | '30s')
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const parseIntervalMs = (raw: string | null): number => {
      const val = String(raw || '10s').trim().toLowerCase();
      if (val === 'off' || val === 'manual') return 0;
      if (val === '5s') return 5000;
      if (val === '30s') return 30000;
      return 10000; // default 10s
    };

    const setupPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      const ms = parseIntervalMs(localStorage.getItem('gmao_polling_interval'));
      if (ms <= 0) return;

      intervalId = setInterval(async () => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        const startMode = storageService.getItem(STORAGE_KEYS.START_MODE);
        if (startMode === 'empty') return;
        try {
          const check = await serverSyncService.fetchServerState();
          if (!check.online || !check.state) return;
          const serverVersion = Number(check.state.version || 0);
          const localVersion = Number(serverSyncService.getLastServerVersion() || 0);
          if (serverVersion > 0 && serverVersion > localVersion) {
            await serverSyncService.pullFromServer({ force: false, setters });
          }
        } catch {
          // Silent background check
        }
      }, ms);
    };

    setupPolling();
    window.addEventListener('gmao:sync_settings_updated', setupPolling);
    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('gmao:sync_settings_updated', setupPolling);
    };
  }, [setters]);

  // 1. Debounced auto-save to LocalStorage and IndexedDB batch writes
  const { saveAllState } = useAutoSave(state, 1000, onStateChange);

  // 2. Real-time Multi-Window / Multi-Tab Synchronization via storage events
  useStateSync(setters, validators);

  // 3. Enterprise Domain Repositories synchronization with IndexedDB
  const { syncEnterpriseDb } = useEnterpriseDbSync(state);
  // Manual sync function is now exposed
  const manualSyncToIdb = syncEnterpriseDb;

  return { saveAllState, manualSyncToIdb };
}
