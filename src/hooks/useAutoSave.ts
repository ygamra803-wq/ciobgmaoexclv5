import { useEffect, useRef, useCallback } from 'react';
import { storageService } from '../utils/storageService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { indexedDBService } from '../utils/indexedDBService';
import { Logger } from '../core/logger/LoggerService';
import { AutoBackupService } from '../core/backup/AutoBackupService';
import { tabSyncService } from '../services/TabSyncService';

/**
 * High-Performance Hook to manage debounced auto-saving of GMAO application state to LocalStorage and IndexedDB,
 * with storage quota checks, persistent storage protection, and instant BroadcastChannel multi-tab broadcasting.
 * Writes exclusively to canonical STORAGE_KEYS.
 */
export function useAutoSave(state, debounceMs = 1000, onStateChange = null) {
  const {
    types,
    designations,
    families,
    templates,
    blueprints,
    compGroups,
    compFamilies,
    compTemplates,
    partTypes,
    partDesignations,
    machines,
    warehouseItems,
    entrepotComponents,
    zones,
    users,
    technicians,
    operations,
    mouvements,
    rawStock,
    preventiveTasks,
    preventiveActions,
    preventiveGuides,
    preventivePlans,
    preventiveExecutions,
    sortiesExterne,
    correctiveInterventions,
    correctiveActionsByPanne,
    correctivePanneCategories,
    correctiveTravauxAFaire,
    correctiveIntervenants,
  } = state;

  const saveTimer = useRef(null);
  const lastSavedState = useRef(null);

  // Request persistent storage protection on mount
  useEffect(() => {
    AutoBackupService.requestPersistentStorage();
  }, []);

  const saveAllState = useCallback(() => {
    const fullState = {
      types,
      designations,
      families,
      templates,
      blueprints,
      compGroups,
      compFamilies,
      compTemplates,
      partTypes,
      partDesignations,
      machines,
      warehouseItems,
      entrepotComponents,
      zones,
      users,
      technicians,
      operations,
      mouvements,
      rawStock,
      preventiveTasks,
      preventiveActions,
      preventiveGuides,
      preventivePlans,
      preventiveExecutions,
      sortiesExterne,
      correctiveInterventions,
      correctiveActionsByPanne,
      correctivePanneCategories,
      correctiveTravauxAFaire,
      correctiveIntervenants,
    };

    const currentStateStr = JSON.stringify(fullState);
    const currentStateLength = currentStateStr.length;
    if (lastSavedState.current === currentStateLength) {
      return;
    }
    lastSavedState.current = currentStateLength;

    try {
      AutoBackupService.checkStorageQuota();

      // Write strictly to canonical STORAGE_KEYS FIRST before the large full-state snapshot
      // so individual tables never get evicted if localStorage nears its 5MB ceiling
      if (users !== undefined) storageService.setItem(STORAGE_KEYS.PERSONNEL, users);
      if (technicians !== undefined) storageService.setItem(STORAGE_KEYS.TECHNICIANS, technicians);
      if (operations !== undefined) storageService.setItem(STORAGE_KEYS.OPERATIONS, operations);
      if (machines !== undefined) storageService.setItem(STORAGE_KEYS.MACHINES, machines);
      if (families !== undefined) storageService.setItem(STORAGE_KEYS.FAMILIES, families);
      if (templates !== undefined) storageService.setItem(STORAGE_KEYS.TEMPLATES, templates);
      if (blueprints !== undefined) storageService.setItem(STORAGE_KEYS.BLUEPRINTS, blueprints);
      if (zones !== undefined) storageService.setItem(STORAGE_KEYS.ZONES, zones);
      if (rawStock !== undefined) storageService.setItem(STORAGE_KEYS.RAW_STOCK, rawStock);
      if (types !== undefined) storageService.setItem(STORAGE_KEYS.STOCK_TYPES, types);
      if (designations !== undefined) storageService.setItem(STORAGE_KEYS.DESIGNATIONS, designations);
      if (mouvements !== undefined) storageService.setItem(STORAGE_KEYS.MOUVEMENTS, mouvements);
      if (warehouseItems !== undefined) storageService.setItem(STORAGE_KEYS.WAREHOUSE_ITEMS, warehouseItems);
      if (entrepotComponents !== undefined) storageService.setItem(STORAGE_KEYS.ENTREPOT_COMPONENTS, entrepotComponents);
      if (compGroups !== undefined) storageService.setItem(STORAGE_KEYS.COMP_GROUPS, compGroups);
      if (compFamilies !== undefined) storageService.setItem(STORAGE_KEYS.COMP_FAMILIES, compFamilies);
      if (compTemplates !== undefined) storageService.setItem(STORAGE_KEYS.COMP_TEMPLATES, compTemplates);
      if (partTypes !== undefined) storageService.setItem(STORAGE_KEYS.PART_TYPES, partTypes);
      if (partDesignations !== undefined) storageService.setItem(STORAGE_KEYS.PART_DESIGNATIONS, partDesignations);
      if (preventiveTasks !== undefined) storageService.setItem(STORAGE_KEYS.PREVENTIVE_TASKS, preventiveTasks);
      if (preventiveActions !== undefined) storageService.setItem(STORAGE_KEYS.PREVENTIVE_ACTIONS, preventiveActions);
      if (preventiveGuides !== undefined) storageService.setItem(STORAGE_KEYS.PREVENTIVE_GUIDES, preventiveGuides);
      if (preventivePlans !== undefined) storageService.setItem(STORAGE_KEYS.PREVENTIVE_PLANS, preventivePlans);
      if (preventiveExecutions !== undefined) storageService.setItem(STORAGE_KEYS.PREVENTIVE_EXECUTIONS, preventiveExecutions);
      if (sortiesExterne !== undefined) storageService.setItem(STORAGE_KEYS.SORTIE_EXTERNE, sortiesExterne);
      if (correctiveInterventions !== undefined) storageService.setItem(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, correctiveInterventions);
      if (correctiveActionsByPanne !== undefined) storageService.setItem(STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE, correctiveActionsByPanne);
      if (correctivePanneCategories !== undefined) storageService.setItem(STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES, correctivePanneCategories);
      if (correctiveTravauxAFaire !== undefined) storageService.setItem(STORAGE_KEYS.CORRECTIVE_TRAVAUX, correctiveTravauxAFaire);
      if (correctiveIntervenants !== undefined) storageService.setItem(STORAGE_KEYS.CORRECTIVE_INTERVENANTS, correctiveIntervenants);

      // Save unified snapshot for export/restore & multi-tab sync
      storageService.setItem(STORAGE_KEYS.FULL_STATE_SNAPSHOT, fullState);

      // High performance single-transaction batch save to IndexedDB (L2) using ALL canonical keys
      indexedDBService.setItemsBatch({
        [STORAGE_KEYS.FULL_STATE_SNAPSHOT]: fullState,
        [STORAGE_KEYS.PERSONNEL]: users || [],
        [STORAGE_KEYS.TECHNICIANS]: technicians || [],
        [STORAGE_KEYS.OPERATIONS]: operations || [],
        [STORAGE_KEYS.MACHINES]: machines || [],
        [STORAGE_KEYS.FAMILIES]: families || [],
        [STORAGE_KEYS.TEMPLATES]: templates || [],
        [STORAGE_KEYS.BLUEPRINTS]: blueprints || [],
        [STORAGE_KEYS.ZONES]: zones || [],
        [STORAGE_KEYS.RAW_STOCK]: rawStock || [],
        [STORAGE_KEYS.STOCK_TYPES]: types || [],
        [STORAGE_KEYS.DESIGNATIONS]: designations || [],
        [STORAGE_KEYS.MOUVEMENTS]: mouvements || [],
        [STORAGE_KEYS.WAREHOUSE_ITEMS]: warehouseItems || [],
        [STORAGE_KEYS.ENTREPOT_COMPONENTS]: entrepotComponents || [],
        [STORAGE_KEYS.COMP_GROUPS]: compGroups || [],
        [STORAGE_KEYS.COMP_FAMILIES]: compFamilies || [],
        [STORAGE_KEYS.COMP_TEMPLATES]: compTemplates || [],
        [STORAGE_KEYS.PART_TYPES]: partTypes || [],
        [STORAGE_KEYS.PART_DESIGNATIONS]: partDesignations || [],
        [STORAGE_KEYS.PREVENTIVE_TASKS]: preventiveTasks || [],
        [STORAGE_KEYS.PREVENTIVE_ACTIONS]: preventiveActions || [],
        [STORAGE_KEYS.PREVENTIVE_GUIDES]: preventiveGuides || [],
        [STORAGE_KEYS.PREVENTIVE_PLANS]: preventivePlans || [],
        [STORAGE_KEYS.PREVENTIVE_EXECUTIONS]: preventiveExecutions || [],
        [STORAGE_KEYS.SORTIE_EXTERNE]: sortiesExterne || [],
        [STORAGE_KEYS.CORRECTIVE_INTERVENTIONS]: correctiveInterventions || [],
        [STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE]: correctiveActionsByPanne || {},
        [STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES]: correctivePanneCategories || {},
        [STORAGE_KEYS.CORRECTIVE_TRAVAUX]: correctiveTravauxAFaire || [],
        [STORAGE_KEYS.CORRECTIVE_INTERVENANTS]: correctiveIntervenants || [],
      });

      // Broadcast state update instantly to other open browser tabs
      tabSyncService.broadcastState(fullState);

      window.dispatchEvent(new CustomEvent('gmao:state_saved', { detail: { timestamp: Date.now() } }));
      if (typeof onStateChange === 'function') {
        onStateChange(fullState);
      }
    } catch (err) {
      Logger.error('Failed to auto-save state:', err, 'useAutoSave');
    }
  }, [
    types,
    designations,
    families,
    templates,
    blueprints,
    compGroups,
    compFamilies,
    compTemplates,
    partTypes,
    partDesignations,
    machines,
    warehouseItems,
    entrepotComponents,
    zones,
    users,
    technicians,
    operations,
    mouvements,
    rawStock,
    preventiveTasks,
    preventiveActions,
    preventiveGuides,
    preventivePlans,
    preventiveExecutions,
    sortiesExterne,
    correctiveInterventions,
    correctiveActionsByPanne,
    correctivePanneCategories,
    correctiveTravauxAFaire,
    correctiveIntervenants,
    onStateChange,
  ]);

  // Debounce saving
  useEffect(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    window.dispatchEvent(new CustomEvent('gmao:state_saving'));

    saveTimer.current = setTimeout(() => {
      saveAllState();
    }, debounceMs);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [saveAllState, debounceMs]);

  return { saveAllState };
}
