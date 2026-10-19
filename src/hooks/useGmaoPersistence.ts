import { useEffect, useRef } from 'react';
import { useAutoSave } from './useAutoSave';
import { useStateSync } from './useStateSync';
import { useEnterpriseDbSync } from './useEnterpriseDbSync';
import { indexedDBService } from '../infrastructure/database/IndexedDBService';
import { storageService } from '../utils/storageService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';

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

  // 0. L2 -> L1 Self-Healing Hydration from IndexedDB on initial mount
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
        const idbSnap = await indexedDBService.getItem(STORAGE_KEYS.FULL_STATE_SNAPSHOT);
        if (!idbSnap || typeof idbSnap !== 'object') return;

        const patch = {};
        const arrayFields = [
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
        // Ignore IndexedDB read errors in restricted environments
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
