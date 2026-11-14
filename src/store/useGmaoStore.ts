import { create } from 'zustand';
import type { GmaoStoreState } from '../types/store';
import type { IAuditEvent } from '../types/audit';
import { DataGateway } from '../application/DataGateway';
import { movementRepository } from '../application/MovementRepository';
import { migrateStorageOnce } from '../infrastructure/persistence/migrateStorage';
import {
  buildInitialStockMapFromList,
  normalizeMachinesList,
  deriveTechnicians,
  deriveOperations,
  isRealPersonnelUser,
  resolveActiveActorContext,
} from './slices/storeBootstrapSlice';
import { createStockSlice } from './slices/stockSlice';
import { createAssetNexusSlice } from './slices/assetNexusSlice';
import { createPreventiveSlice } from './slices/preventiveSlice';
import { createCorrectiveSlice } from './slices/correctiveSlice';

export const useGmaoStore = create<GmaoStoreState>((set, get) => {
  migrateStorageOnce();

  return {
    // ==========================================
    // Modular Domain Slices (SSOT Composition)
    // ==========================================
    ...createStockSlice(set, get),
    ...createAssetNexusSlice(set, get),
    ...createPreventiveSlice(set, get),
    ...createCorrectiveSlice(set, get),

    // ==========================================
    // Global Data Operations (Demo & Real Factory)
    // ==========================================
    handleLoadDemoData: () =>
      DataGateway.loadDemoData({
        setPdrGroups: get().setPdrGroups,
        setTypes: get().setTypes,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setGeneralSystemTypes: get().setGeneralSystemTypes,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartGroups: get().setPartGroups,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setSortieDemands: get().setSortieDemands,
        setReplenishmentOrders: get().setReplenishmentOrders,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setMeterReadings: get().setMeterReadings,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
        setWorkshopOrders: get().setWorkshopOrders,
        setAuditEvents: (events: IAuditEvent[]) => set({ auditEvents: events }),
      }),

    handleClearAllForRealFactory: () =>
      DataGateway.clearAllForRealFactory({
        setTypes: get().setTypes,
        setPdrGroups: get().setPdrGroups,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setGeneralSystemTypes: get().setGeneralSystemTypes,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartGroups: get().setPartGroups,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setSortieDemands: get().setSortieDemands,
        setReplenishmentOrders: get().setReplenishmentOrders,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setMeterReadings: get().setMeterReadings,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
        setWorkshopOrders: get().setWorkshopOrders,
        setAuditEvents: (events: IAuditEvent[]) => set({ auditEvents: events }),
      }),

    handleLoadDemoSection: (sectionId: string) =>
      DataGateway.loadDemoSection(sectionId, {
        setPdrGroups: get().setPdrGroups,
        setTypes: get().setTypes,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setGeneralSystemTypes: get().setGeneralSystemTypes,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartGroups: get().setPartGroups,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setSortieDemands: get().setSortieDemands,
        setReplenishmentOrders: get().setReplenishmentOrders,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setMeterReadings: get().setMeterReadings,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
      }),

    handleClearDemoSection: (sectionId: string) =>
      DataGateway.clearDemoSection(sectionId, {
        setPdrGroups: get().setPdrGroups,
        setTypes: get().setTypes,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setGeneralSystemTypes: get().setGeneralSystemTypes,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartGroups: get().setPartGroups,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setSortieDemands: get().setSortieDemands,
        setReplenishmentOrders: get().setReplenishmentOrders,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setMeterReadings: get().setMeterReadings,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
      }),

    // ==========================================
    // Append-Only Enterprise Audit Ledger (AUDIT-LEDGER-P0)
    // ==========================================
    auditEvents: DataGateway.getAuditEvents(),

    appendAuditEvent: (payload) => {
      const actor = resolveActiveActorContext();
      const { event, list } = DataGateway.appendAuditEvent({
        ...payload,
        actorId: payload.actorId || actor.actorId,
        actorName: payload.actorName || actor.actorName,
        actorRole: payload.actorRole || actor.actorRole,
      });
      set({ auditEvents: list });
      return event;
    },

    /** Synchronizes state slices from an authoritative server/remote snapshot without overriding unsynced local actors. */
    applyRemoteStateUpdate: (remoteState: Record<string, unknown>) => {
      if (!remoteState || typeof remoteState !== 'object') return;
      const updates: Record<string, unknown> = {};

      // Stock
      if (Array.isArray(remoteState.pdrGroups)) updates.pdrGroups = remoteState.pdrGroups;
      if (Array.isArray(remoteState.types)) updates.types = remoteState.types;
      if (Array.isArray(remoteState.rawStock)) updates.rawStock = remoteState.rawStock;
      if (Array.isArray(remoteState.designations)) updates.designations = remoteState.designations;

      // Machines
      if (Array.isArray(remoteState.families)) updates.families = remoteState.families;
      if (Array.isArray(remoteState.templates)) updates.templates = remoteState.templates;
      if (Array.isArray(remoteState.blueprints)) updates.blueprints = remoteState.blueprints;
      if (Array.isArray(remoteState.machines)) updates.machines = normalizeMachinesList(remoteState.machines);
      if (Array.isArray(remoteState.generalSystemTypes)) updates.generalSystemTypes = remoteState.generalSystemTypes;
      if (Array.isArray(remoteState.zones)) updates.zones = remoteState.zones;
      if (Array.isArray(remoteState.machineElementsLedger)) updates.machineElementsLedger = remoteState.machineElementsLedger;

      // Warehouse
      if (Array.isArray(remoteState.warehouseItems)) updates.warehouseItems = remoteState.warehouseItems;
      if (Array.isArray(remoteState.entrepotComponents)) updates.entrepotComponents = remoteState.entrepotComponents;
      if (Array.isArray(remoteState.compGroups)) updates.compGroups = remoteState.compGroups;
      if (Array.isArray(remoteState.compFamilies)) updates.compFamilies = remoteState.compFamilies;
      if (Array.isArray(remoteState.compTemplates)) updates.compTemplates = remoteState.compTemplates;
      if (Array.isArray(remoteState.partGroups)) updates.partGroups = remoteState.partGroups;
      if (Array.isArray(remoteState.partTypes)) updates.partTypes = remoteState.partTypes;
      if (Array.isArray(remoteState.partDesignations)) updates.partDesignations = remoteState.partDesignations;

      // Users (strictly filter out gateway/auth-only accounts from HR personnel state)
      if (Array.isArray(remoteState.users)) {
        const cleanPersonnelUsers = remoteState.users.filter(isRealPersonnelUser);
        updates.users = cleanPersonnelUsers;
        updates.technicians = deriveTechnicians(cleanPersonnelUsers);
        updates.operations = deriveOperations(cleanPersonnelUsers);
      }
      if (Array.isArray(remoteState.technicians)) updates.technicians = remoteState.technicians;
      if (Array.isArray(remoteState.operations)) updates.operations = remoteState.operations;

      // Movements & Replenishment
      if (Array.isArray(remoteState.mouvements)) updates.mouvements = remoteState.mouvements;
      if (Array.isArray(remoteState.sortieDemands)) updates.sortieDemands = remoteState.sortieDemands;
      if (Array.isArray(remoteState.replenishmentOrders)) updates.replenishmentOrders = remoteState.replenishmentOrders;

      // Preventive
      if (Array.isArray(remoteState.preventiveTasks)) updates.preventiveTasks = remoteState.preventiveTasks;
      if (Array.isArray(remoteState.preventiveActions)) updates.preventiveActions = remoteState.preventiveActions;
      if (Array.isArray(remoteState.preventiveGuides)) updates.preventiveGuides = remoteState.preventiveGuides;
      if (Array.isArray(remoteState.preventivePlans)) updates.preventivePlans = remoteState.preventivePlans;
      if (Array.isArray(remoteState.preventiveExecutions)) updates.preventiveExecutions = remoteState.preventiveExecutions;
      if (Array.isArray(remoteState.meterReadings)) updates.meterReadings = remoteState.meterReadings;

      // Sortie Externe
      if (Array.isArray(remoteState.sortiesExterne)) updates.sortiesExterne = remoteState.sortiesExterne;

      // Audit Events
      if (Array.isArray(remoteState.auditEvents)) updates.auditEvents = remoteState.auditEvents;

      // Corrective
      if (Array.isArray(remoteState.correctiveInterventions)) updates.correctiveInterventions = remoteState.correctiveInterventions;
      if (remoteState.correctiveActionsByPanne && typeof remoteState.correctiveActionsByPanne === 'object') {
        updates.correctiveActionsByPanne = remoteState.correctiveActionsByPanne;
        updates.actionsByPanne = remoteState.correctiveActionsByPanne;
      }
      if (remoteState.correctivePanneCategories && typeof remoteState.correctivePanneCategories === 'object') {
        updates.correctivePanneCategories = remoteState.correctivePanneCategories;
        updates.panneCategories = remoteState.correctivePanneCategories;
      }
      if (Array.isArray(remoteState.correctiveTravauxAFaire)) {
        updates.correctiveTravauxAFaire = remoteState.correctiveTravauxAFaire;
        updates.travauxAFaire = remoteState.correctiveTravauxAFaire;
      }
      if (Array.isArray(remoteState.correctiveIntervenants)) {
        updates.correctiveIntervenants = remoteState.correctiveIntervenants;
        updates.intervenants = remoteState.correctiveIntervenants;
      }
      if (Array.isArray(remoteState.workshopOrders)) {
        updates.workshopOrders = remoteState.workshopOrders;
      }
      if (Array.isArray(remoteState.needRequests)) {
        updates.needRequests = remoteState.needRequests;
      }

      if (Object.keys(updates).length > 0) {
        set(updates);
      }

      if (Array.isArray(remoteState.mouvements) || Array.isArray(remoteState.rawStock)) {
        const effectiveMovements = Array.isArray(remoteState.mouvements)
          ? (remoteState.mouvements as import('../application/MovementRepository').MovementEntity[])
          : get().mouvements || [];
        const effectiveRawStock = Array.isArray(remoteState.rawStock)
          ? (remoteState.rawStock as import('../types/domain').IStockItem[])
          : get().rawStock || [];
        movementRepository.bulkReplace(
          effectiveMovements,
          buildInitialStockMapFromList(effectiveRawStock)
        );
      }
    },
  };
});

if (typeof window !== 'undefined') {
  window.addEventListener('gmao_audit_event_appended', ((e: CustomEvent) => {
    if (Array.isArray(e?.detail?.list)) {
      useGmaoStore.setState({ auditEvents: e.detail.list });
    }
  }) as EventListener);
  window.addEventListener('gmao_audit_events_synced', ((e: CustomEvent) => {
    if (Array.isArray(e?.detail?.list)) {
      useGmaoStore.setState({ auditEvents: e.detail.list });
    }
  }) as EventListener);
}

// Fine-grained slice hooks for optimal re-rendering
export const useStockSlice = () =>
  useGmaoStore((state) => ({
    types: state.types,
    setTypes: state.setTypes,
    pdrGroups: state.pdrGroups,
    setPdrGroups: state.setPdrGroups,
    designations: state.designations,
    setDesignations: state.setDesignations,
    rawStock: state.rawStock,
    setRawStock: state.setRawStock,
  }));

export const useMachineSlice = () =>
  useGmaoStore((state) => ({
    families: state.families,
    setFamilies: state.setFamilies,
    templates: state.templates,
    setTemplates: state.setTemplates,
    blueprints: state.blueprints,
    setBlueprints: state.setBlueprints,
    machines: state.machines,
    setMachines: state.setMachines,
    generalSystemTypes: state.generalSystemTypes,
    setGeneralSystemTypes: state.setGeneralSystemTypes,
    handleAddGeneralSystemType: state.handleAddGeneralSystemType,
    handleToggleGeneralSystemType: state.handleToggleGeneralSystemType,
    zones: state.zones,
    setZones: state.setZones,
    machineElementsLedger: state.machineElementsLedger,
    setMachineElementsLedger: state.setMachineElementsLedger,
    addMachineElement: state.addMachineElement,
    updateMachineElement: state.updateMachineElement,
    deleteMachineElement: state.deleteMachineElement,
    duplicateBOMToTwins: state.duplicateBOMToTwins,
    isValidMachineFamilies: state.isValidMachineFamilies,
    isValidMachineTemplates: state.isValidMachineTemplates,
  }));

export const useWarehouseSlice = () =>
  useGmaoStore((state) => ({
    warehouseItems: state.warehouseItems,
    setWarehouseItems: state.setWarehouseItems,
    entrepotComponents: state.entrepotComponents,
    setEntrepotComponents: state.setEntrepotComponents,
    compGroups: state.compGroups,
    setCompGroups: state.setCompGroups,
    compFamilies: state.compFamilies,
    setCompFamilies: state.setCompFamilies,
    compTemplates: state.compTemplates,
    setCompTemplates: state.setCompTemplates,
    partGroups: state.partGroups,
    setPartGroups: state.setPartGroups,
    partTypes: state.partTypes,
    setPartTypes: state.setPartTypes,
    partDesignations: state.partDesignations,
    setPartDesignations: state.setPartDesignations,
  }));

export const useUserSlice = () =>
  useGmaoStore((state) => ({
    users: state.users,
    setUsers: state.setUsers,
    technicians: state.technicians,
    setTechnicians: state.setTechnicians,
    operations: state.operations,
    setOperations: state.setOperations,
  }));

export const useMovementSlice = () =>
  useGmaoStore((state) => ({
    mouvements: state.mouvements,
    setMouvements: state.setMouvements,
    sortieDemands: state.sortieDemands,
    setSortieDemands: state.setSortieDemands,
    replenishmentOrders: state.replenishmentOrders,
    setReplenishmentOrders: state.setReplenishmentOrders,
    handleCreateReplenishmentOrder: state.handleCreateReplenishmentOrder,
    handleUpdateReplenishmentOrderStatus: state.handleUpdateReplenishmentOrderStatus,
    handleReceiveReplenishmentOrder: state.handleReceiveReplenishmentOrder,
    handleSubmitSortieDemand: state.handleSubmitSortieDemand,
    handleReviewSortieDemandValidation: state.handleReviewSortieDemandValidation,
  }));

export const usePreventiveSlice = () =>
  useGmaoStore((state) => ({
    preventiveTasks: state.preventiveTasks,
    setPreventiveTasks: state.setPreventiveTasks,
    preventiveActions: state.preventiveActions,
    setPreventiveActions: state.setPreventiveActions,
    preventiveGuides: state.preventiveGuides,
    setPreventiveGuides: state.setPreventiveGuides,
    preventivePlans: state.preventivePlans,
    setPreventivePlans: state.setPreventivePlans,
    preventiveExecutions: state.preventiveExecutions,
    setPreventiveExecutions: state.setPreventiveExecutions,
    meterReadings: state.meterReadings,
    setMeterReadings: state.setMeterReadings,
    handleRecordMeterReading: state.handleRecordMeterReading,
    handleBatchRecordMeterReadings: state.handleBatchRecordMeterReadings,
    handleUpdateTask: state.handleUpdateTask,
    handleDeleteTask: state.handleDeleteTask,
    handleUpdateTaskCounter: state.handleUpdateTaskCounter,
    handleMarkTaskDone: state.handleMarkTaskDone,
    handleReviewPreventiveExecutionValidation: state.handleReviewPreventiveExecutionValidation,
    handleDeletePreventiveExecution: state.handleDeletePreventiveExecution,
    handleCreatePlanWithTasks: state.handleCreatePlanWithTasks,
    handleAddAction: state.handleAddAction,
    handleUpdateAction: state.handleUpdateAction,
    handleDeleteAction: state.handleDeleteAction,
    handleAddGuide: state.handleAddGuide,
    handleUpdateGuide: state.handleUpdateGuide,
    handleDeleteGuide: state.handleDeleteGuide,
    handleResetPreventiveToBaseline: state.handleResetPreventiveToBaseline,
    handleClearPreventiveForRealFactory: state.handleClearPreventiveForRealFactory,
  }));

export const useSortieExterneSlice = () =>
  useGmaoStore((state) => ({
    sortiesExterne: state.sortiesExterne,
    setSortiesExterne: state.setSortiesExterne,
    handleAddSortieExterne: state.handleAddSortieExterne,
    handleUpdateSortieExterne: state.handleUpdateSortieExterne,
    handleDeleteSortieExterne: state.handleDeleteSortieExterne,
    handleMarkSortieReturned: state.handleMarkSortieReturned,
    handleMarkSortieMounted: state.handleMarkSortieMounted,
    handleClearSortiesForRealFactory: state.handleClearSortiesForRealFactory,
    handleResetSortiesToBaseline: state.handleResetSortiesToBaseline,
  }));

export const useCorrectiveSlice = () =>
  useGmaoStore((state) => ({
    correctiveInterventions: state.correctiveInterventions,
    setCorrectiveInterventions: state.setCorrectiveInterventions,
    correctiveActionsByPanne: state.correctiveActionsByPanne,
    setCorrectiveActionsByPanne: state.setCorrectiveActionsByPanne,
    correctivePanneCategories: state.correctivePanneCategories,
    setCorrectivePanneCategories: state.setCorrectivePanneCategories,
    correctiveTravauxAFaire: state.correctiveTravauxAFaire,
    setCorrectiveTravauxAFaire: state.setCorrectiveTravauxAFaire,
    correctiveIntervenants: state.correctiveIntervenants,
    setCorrectiveIntervenants: state.setCorrectiveIntervenants,
    activeLiveInterventionId: state.activeLiveInterventionId,
    setActiveLiveInterventionId: state.setActiveLiveInterventionId,
    handleGetCorrectiveActionsForPanne: state.handleGetCorrectiveActionsForPanne,
    handleAddCorrectiveActionForPanne: state.handleAddCorrectiveActionForPanne,
    handleUpdateCorrectiveActionForPanne: state.handleUpdateCorrectiveActionForPanne,
    handleDeleteCorrectiveActionForPanne: state.handleDeleteCorrectiveActionForPanne,
    handleAddPanne: state.handleAddPanne,
    handleUpdatePanne: state.handleUpdatePanne,
    handleDeletePanne: state.handleDeletePanne,
    handleAddTravail: state.handleAddTravail,
    handleUpdateTravail: state.handleUpdateTravail,
    handleDeleteTravail: state.handleDeleteTravail,
    handleResetCorrectiveActions: state.handleResetCorrectiveActions,
    handleForceSyncCorrectiveSeed: state.handleForceSyncCorrectiveSeed,
    handleAddDemandeIntervention: state.handleAddDemandeIntervention,
    handleConvertToBt: state.handleConvertToBt,
    handleStartLiveIntervention: state.handleStartLiveIntervention,
    handleSubmitInterventionForValidation: state.handleSubmitInterventionForValidation,
    handleReviewInterventionValidation: state.handleReviewInterventionValidation,
    handleClotureIntervention: state.handleClotureIntervention,
    handleUpdateCorrectiveIntervention: state.handleUpdateCorrectiveIntervention,
    handleDeleteCorrectiveIntervention: state.handleDeleteCorrectiveIntervention,
    handleBulkImportCorrective: state.handleBulkImportCorrective,
    handleResetCorrectiveToSeed: state.handleResetCorrectiveToSeed,
    correctiveKpis: state.correctiveKpis,
    correctiveParetoAnomalies: state.correctiveParetoAnomalies,
    correctiveParetoMachines: state.correctiveParetoMachines,
    correctiveParetoTypes: state.correctiveParetoTypes,
    correctivePreventiveRecommendations: state.correctivePreventiveRecommendations,
  }));
