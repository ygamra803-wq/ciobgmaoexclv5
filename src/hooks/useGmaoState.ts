import { useEffect } from 'react';
import { BASELINE_STOCK_ITEMS } from '../utils/baselineStock';
import { migrateStorageOnce } from '../infrastructure/persistence/migrateStorage';
import {
  useGmaoStore,
  useStockSlice,
  useMachineSlice,
  useWarehouseSlice,
  useUserSlice,
  useMovementSlice,
  usePreventiveSlice,
  useSortieExterneSlice,
  useCorrectiveSlice,
} from '../store/useGmaoStore';
import { useGmaoPersistence } from './useGmaoPersistence';

// Re-export baseline stock items & Zustand store for consumers
export {
  BASELINE_STOCK_ITEMS,
  useGmaoStore,
  useStockSlice,
  useMachineSlice,
  useWarehouseSlice,
  useUserSlice,
  useMovementSlice,
  usePreventiveSlice,
  useSortieExterneSlice,
  useCorrectiveSlice,
};

/**
 * 🏛️ GMAO State Orchestrator Hook (Zustand Powered)
 * Provides 100% backward compatibility for existing consumers of useGmaoState(),
 * while delegating all state mutations, selective reactivity, and memory optimizations to the Zustand core store.
 */
export function useGmaoState() {
  // Ensure one-time legacy key migration has executed (idempotent)
  useEffect(() => {
    migrateStorageOnce();
  }, []);

  const store = useGmaoStore();

  // Persistence & Multi-tab synchronization connected directly to the Zustand store
  useGmaoPersistence({
    state: {
      types: store.types,
      designations: store.designations,
      rawStock: store.rawStock,
      families: store.families,
      templates: store.templates,
      blueprints: store.blueprints,
      machines: store.machines,
      zones: store.zones,
      machineElementsLedger: store.machineElementsLedger,
      warehouseItems: store.warehouseItems,
      entrepotComponents: store.entrepotComponents,
      compGroups: store.compGroups,
      compFamilies: store.compFamilies,
      compTemplates: store.compTemplates,
      partTypes: store.partTypes,
      partDesignations: store.partDesignations,
      users: store.users,
      technicians: store.technicians,
      operations: store.operations,
      mouvements: store.mouvements,
      preventiveTasks: store.preventiveTasks,
      preventiveActions: store.preventiveActions,
      preventiveGuides: store.preventiveGuides,
      preventivePlans: store.preventivePlans,
      preventiveExecutions: store.preventiveExecutions,
      sortiesExterne: store.sortiesExterne,
      correctiveInterventions: store.correctiveInterventions,
      correctiveActionsByPanne: store.correctiveActionsByPanne,
      correctivePanneCategories: store.correctivePanneCategories,
      correctiveTravauxAFaire: store.correctiveTravauxAFaire,
      correctiveIntervenants: store.correctiveIntervenants,
    },
    setters: {
      setTypes: store.setTypes,
      setDesignations: store.setDesignations,
      setRawStock: store.setRawStock,
      setFamilies: store.setFamilies,
      setTemplates: store.setTemplates,
      setBlueprints: store.setBlueprints,
      setMachines: store.setMachines,
      setZones: store.setZones,
      setMachineElementsLedger: store.setMachineElementsLedger,
      setWarehouseItems: store.setWarehouseItems,
      setEntrepotComponents: store.setEntrepotComponents,
      setCompGroups: store.setCompGroups,
      setCompFamilies: store.setCompFamilies,
      setCompTemplates: store.setCompTemplates,
      setPartTypes: store.setPartTypes,
      setPartDesignations: store.setPartDesignations,
      setTechnicians: store.setTechnicians,
      setOperations: store.setOperations,
      setUsers: store.setUsers,
      setMouvements: store.setMouvements,
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
      applyRemoteStateUpdate: store.applyRemoteStateUpdate,
    },
    validators: {
      isValidMachineFamilies: store.isValidMachineFamilies,
      isValidMachineTemplates: store.isValidMachineTemplates,
    },
    onStateChange: (newState) => {
      if (!newState || typeof newState !== 'object') return;
      // Propagate changes from multi-tab sync or auto-save into Zustand store
      store.applyRemoteStateUpdate(newState);
    },
  });

  return {
    // 1. Stock
    types: store.types,
    setTypes: store.setTypes,
    designations: store.designations,
    setDesignations: store.setDesignations,
    rawStock: store.rawStock,
    setRawStock: store.setRawStock,

    // 2. Machines
    families: store.families,
    setFamilies: store.setFamilies,
    templates: store.templates,
    setTemplates: store.setTemplates,
    blueprints: store.blueprints,
    setBlueprints: store.setBlueprints,
    machines: store.machines,
    setMachines: store.setMachines,
    zones: store.zones,
    setZones: store.setZones,
    machineElementsLedger: store.machineElementsLedger,
    setMachineElementsLedger: store.setMachineElementsLedger,
    addMachineElement: store.addMachineElement,
    updateMachineElement: store.updateMachineElement,
    deleteMachineElement: store.deleteMachineElement,
    duplicateBOMToTwins: store.duplicateBOMToTwins,
    isValidMachineFamilies: store.isValidMachineFamilies,
    isValidMachineTemplates: store.isValidMachineTemplates,

    // 3. Warehouse
    warehouseItems: store.warehouseItems,
    setWarehouseItems: store.setWarehouseItems,
    entrepotComponents: store.entrepotComponents,
    setEntrepotComponents: store.setEntrepotComponents,
    compGroups: store.compGroups,
    setCompGroups: store.setCompGroups,
    compFamilies: store.compFamilies,
    setCompFamilies: store.setCompFamilies,
    compTemplates: store.compTemplates,
    setCompTemplates: store.setCompTemplates,
    partTypes: store.partTypes,
    setPartTypes: store.setPartTypes,
    partDesignations: store.partDesignations,
    setPartDesignations: store.setPartDesignations,

    // 4. Users & Personnel
    users: store.users,
    setUsers: store.setUsers,
    technicians: store.technicians,
    setTechnicians: store.setTechnicians,
    operations: store.operations,
    setOperations: store.setOperations,

    // 5. Movements
    mouvements: store.mouvements,
    setMouvements: store.setMouvements,

    // 6. Preventive
    preventiveTasks: store.preventiveTasks,
    setPreventiveTasks: store.setPreventiveTasks,
    preventiveActions: store.preventiveActions,
    setPreventiveActions: store.setPreventiveActions,
    preventiveGuides: store.preventiveGuides,
    setPreventiveGuides: store.setPreventiveGuides,
    preventivePlans: store.preventivePlans,
    setPreventivePlans: store.setPreventivePlans,
    preventiveExecutions: store.preventiveExecutions,
    setPreventiveExecutions: store.setPreventiveExecutions,
    handleUpdateTask: store.handleUpdateTask,
    handleDeleteTask: store.handleDeleteTask,
    handleUpdateTaskCounter: store.handleUpdateTaskCounter,
    handleMarkTaskDone: store.handleMarkTaskDone,
    handleDeletePreventiveExecution: store.handleDeletePreventiveExecution,
    handleCreatePlanWithTasks: store.handleCreatePlanWithTasks,
    handleAddAction: store.handleAddAction,
    handleUpdateAction: store.handleUpdateAction,
    handleDeleteAction: store.handleDeleteAction,
    handleAddGuide: store.handleAddGuide,
    handleUpdateGuide: store.handleUpdateGuide,
    handleDeleteGuide: store.handleDeleteGuide,
    handleResetPreventiveToBaseline: store.handleResetPreventiveToBaseline,
    handleClearPreventiveForRealFactory: store.handleClearPreventiveForRealFactory,

    // 7. Sorties Externe
    sortiesExterne: store.sortiesExterne,
    setSortiesExterne: store.setSortiesExterne,
    handleAddSortieExterne: store.handleAddSortieExterne,
    handleUpdateSortieExterne: store.handleUpdateSortieExterne,
    handleDeleteSortieExterne: store.handleDeleteSortieExterne,
    handleMarkSortieReturned: store.handleMarkSortieReturned,
    handleMarkSortieMounted: store.handleMarkSortieMounted,
    handleClearSortiesForRealFactory: store.handleClearSortiesForRealFactory,
    handleResetSortiesToBaseline: store.handleResetSortiesToBaseline,

    // 8. Corrective Nexus
    correctiveInterventions: store.correctiveInterventions,
    setCorrectiveInterventions: store.setCorrectiveInterventions,
    correctiveActionsByPanne: store.correctiveActionsByPanne,
    setCorrectiveActionsByPanne: store.setCorrectiveActionsByPanne,
    correctivePanneCategories: store.correctivePanneCategories,
    setCorrectivePanneCategories: store.setCorrectivePanneCategories,
    correctiveTravauxAFaire: store.correctiveTravauxAFaire,
    setCorrectiveTravauxAFaire: store.setCorrectiveTravauxAFaire,
    correctiveIntervenants: store.correctiveIntervenants,
    setCorrectiveIntervenants: store.setCorrectiveIntervenants,
    handleGetCorrectiveActionsForPanne: store.handleGetCorrectiveActionsForPanne,
    handleAddCorrectiveActionForPanne: store.handleAddCorrectiveActionForPanne,
    handleUpdateCorrectiveActionForPanne: store.handleUpdateCorrectiveActionForPanne,
    handleDeleteCorrectiveActionForPanne: store.handleDeleteCorrectiveActionForPanne,
    handleAddPanne: store.handleAddPanne,
    handleUpdatePanne: store.handleUpdatePanne,
    handleDeletePanne: store.handleDeletePanne,
    handleAddTravail: store.handleAddTravail,
    handleUpdateTravail: store.handleUpdateTravail,
    handleDeleteTravail: store.handleDeleteTravail,
    handleResetCorrectiveActions: store.handleResetCorrectiveActions,
    handleForceSyncCorrectiveSeed: store.handleForceSyncCorrectiveSeed,
    activeLiveInterventionId: store.activeLiveInterventionId,
    correctiveKpis: store.correctiveKpis(),
    correctiveParetoAnomalies: store.correctiveParetoAnomalies(),
    correctiveParetoMachines: store.correctiveParetoMachines(),
    correctiveParetoTypes: store.correctiveParetoTypes(),
    correctivePreventiveRecommendations: store.correctivePreventiveRecommendations(),
    handleAddDemandeIntervention: store.handleAddDemandeIntervention,
    handleConvertToBt: store.handleConvertToBt,
    handleStartLiveIntervention: store.handleStartLiveIntervention,
    handleClotureIntervention: store.handleClotureIntervention,
    handleUpdateCorrectiveIntervention: store.handleUpdateCorrectiveIntervention,
    handleDeleteCorrectiveIntervention: store.handleDeleteCorrectiveIntervention,
    handleBulkImportCorrective: store.handleBulkImportCorrective,
    handleResetCorrectiveToSeed: store.handleResetCorrectiveToSeed,

    // 9. Derived Computations
    stockItems: store.stockItems(),
    effectiveDesignations: store.effectiveDesignations(),

    // 10. Global Operations
    handleLoadDemoData: store.handleLoadDemoData,
    handleClearAllForRealFactory: store.handleClearAllForRealFactory,
    handleLoadDemoSection: store.handleLoadDemoSection,
    handleClearDemoSection: store.handleClearDemoSection,
  };
}
