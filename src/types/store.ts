/**
 * TypeScript Type Definitions for GMAO Zustand Global Store
 * Enforces strict typing for domain slices, actions, and derived calculations.
 */

import type {
  IStockItem,
  IMachine,
  IMouvement,
  IZone,
  IOperation,
  ITechnician,
} from './domain';

export interface MachineElement {
  id: string;
  id_machine_registered: string;
  ref_element?: string;
  designation?: string;
  date_installation?: string;
  heures_actuelles?: number;
  [key: string]: any;
}

export interface PreventiveTaskItem {
  id: string | number;
  machine_id?: string;
  id_machine_registered?: string;
  titre?: string;
  periodicite?: string;
  dernier_releve?: number;
  updated_at?: string;
  [key: string]: any;
}

export interface SortieExterneItem {
  id: string | number;
  statut?: string;
  date_sortie?: string;
  date_retour_prevue?: string;
  date_retour_reelle?: string;
  [key: string]: any;
}

export interface CorrectiveInterventionItem {
  id: string | number;
  code_machine?: string;
  anomalie?: string;
  statut?: string;
  demande_date?: string;
  demande_heure?: string;
  date_debut?: string;
  heure_debut?: string;
  date_fin?: string;
  heure_fin?: string;
  temps_intervention?: string;
  temps_intervention_mins?: number;
  num_bt?: string;
  pdr_ref?: string;
  pdr_quantite?: number;
  [key: string]: any;
}

export interface GmaoStoreState {
  // ==========================================
  // 1. Stock Slice
  // ==========================================
  types: any[];
  rawStock: IStockItem[];
  designations: any[];
  setTypes: (types: any[] | ((prev: any[]) => any[])) => void;
  setRawStock: (rawStock: IStockItem[] | ((prev: IStockItem[]) => IStockItem[])) => void;
  setDesignations: (designations: any[] | ((prev: any[]) => any[])) => void;

  // ==========================================
  // 2. Machines & Topology Slice
  // ==========================================
  families: any[];
  templates: any[];
  blueprints: any[];
  machines: IMachine[];
  zones: IZone[];
  machineElementsLedger: MachineElement[];
  setFamilies: (families: any[] | ((prev: any[]) => any[])) => void;
  setTemplates: (templates: any[] | ((prev: any[]) => any[])) => void;
  setBlueprints: (blueprints: any[] | ((prev: any[]) => any[])) => void;
  setMachines: (machines: IMachine[] | ((prev: IMachine[]) => IMachine[])) => void;
  setZones: (zones: IZone[] | ((prev: IZone[]) => IZone[])) => void;
  setMachineElementsLedger: (ledger: MachineElement[] | ((prev: MachineElement[]) => MachineElement[])) => void;
  addMachineElement: (element: Partial<MachineElement>) => void;
  updateMachineElement: (id: string, updates: Partial<MachineElement>) => void;
  deleteMachineElement: (id: string) => void;
  duplicateBOMToTwins: (sourceMachineId: string, targetMachineIds: string[]) => void;
  isValidMachineFamilies: (arr: any[]) => boolean;
  isValidMachineTemplates: (arr: any[]) => boolean;

  // ==========================================
  // 3. Warehouse / Entrepôt Slice
  // ==========================================
  warehouseItems: any[];
  entrepotComponents: any[];
  compGroups: any[];
  compFamilies: any[];
  compTemplates: any[];
  partTypes: any[];
  partDesignations: any[];
  setWarehouseItems: (items: any[] | ((prev: any[]) => any[])) => void;
  setEntrepotComponents: (comps: any[] | ((prev: any[]) => any[])) => void;
  setCompGroups: (groups: any[] | ((prev: any[]) => any[])) => void;
  setCompFamilies: (families: any[] | ((prev: any[]) => any[])) => void;
  setCompTemplates: (templates: any[] | ((prev: any[]) => any[])) => void;
  setPartTypes: (types: any[] | ((prev: any[]) => any[])) => void;
  setPartDesignations: (designations: any[] | ((prev: any[]) => any[])) => void;

  // ==========================================
  // 4. Personnel & Users Slice
  // ==========================================
  users: any[];
  technicians: ITechnician[];
  operations: IOperation[];
  setUsers: (users: any[] | ((prev: any[]) => any[])) => void;
  setTechnicians: (techs: ITechnician[] | ((prev: ITechnician[]) => ITechnician[])) => void;
  setOperations: (ops: IOperation[] | ((prev: IOperation[]) => IOperation[])) => void;

  // ==========================================
  // 5. Movements Slice
  // ==========================================
  mouvements: IMouvement[];
  setMouvements: (movements: IMouvement[] | ((prev: IMouvement[]) => IMouvement[])) => void;

  // ==========================================
  // 6. Preventive Maintenance Slice
  // ==========================================
  preventiveTasks: PreventiveTaskItem[];
  preventiveActions: any[];
  preventiveGuides: any[];
  preventivePlans: any[];
  preventiveExecutions: any[];
  setPreventiveTasks: (tasks: PreventiveTaskItem[] | ((prev: PreventiveTaskItem[]) => PreventiveTaskItem[])) => void;
  setPreventiveActions: (actions: any[] | ((prev: any[]) => any[])) => void;
  setPreventiveGuides: (guides: any[] | ((prev: any[]) => any[])) => void;
  setPreventivePlans: (plans: any[] | ((prev: any[]) => any[])) => void;
  setPreventiveExecutions: (executions: any[] | ((prev: any[]) => any[])) => void;
  handleUpdateTask: (id: string | number, updates: any) => void;
  handleDeleteTask: (id: string | number) => void;
  handleUpdateTaskCounter: (id: string | number, newCounterValue: number | string) => void;
  handleMarkTaskDone: (id: string | number, validationData: any) => void;
  handleDeletePreventiveExecution: (id: string) => void;
  handleCreatePlanWithTasks: (planData: any, taskItems: any[]) => any;
  handleAddAction: (actionData: any) => any;
  handleUpdateAction: (id: string | number, actionData: any) => any;
  handleDeleteAction: (id: string | number) => any;
  handleAddGuide: (guideData: any) => any;
  handleUpdateGuide: (id: string | number, guideData: any) => any;
  handleDeleteGuide: (id: string | number) => any;
  handleResetPreventiveToBaseline: (ctx?: any) => Promise<any>;
  handleClearPreventiveForRealFactory: (ctx?: any) => any;

  // ==========================================
  // 7. Sorties Externe Slice
  // ==========================================
  sortiesExterne: SortieExterneItem[];
  setSortiesExterne: (sorties: SortieExterneItem[] | ((prev: SortieExterneItem[]) => SortieExterneItem[])) => void;
  handleAddSortieExterne: (sortieData: any) => any;
  handleUpdateSortieExterne: (id: string | number, sortieData: any) => any;
  handleDeleteSortieExterne: (id: string | number) => void;
  handleMarkSortieReturned: (id: string | number, returnData: any) => any;
  handleMarkSortieMounted: (id: string | number, mountData: any) => any;
  handleClearSortiesForRealFactory: () => any;
  handleResetSortiesToBaseline: () => any;

  // ==========================================
  // 8. Corrective Nexus Slice
  // ==========================================
  correctiveInterventions: CorrectiveInterventionItem[];
  setCorrectiveInterventions: (interventions: CorrectiveInterventionItem[] | ((prev: CorrectiveInterventionItem[]) => CorrectiveInterventionItem[])) => void;
  correctiveActionsByPanne: Record<string, string[]>;
  setCorrectiveActionsByPanne: (actions: any | ((prev: any) => any)) => void;
  correctivePanneCategories: Record<string, string[]>;
  setCorrectivePanneCategories: (categories: any | ((prev: any) => any)) => void;
  correctiveTravauxAFaire: string[];
  setCorrectiveTravauxAFaire: (travaux: string[] | ((prev: string[]) => string[])) => void;
  correctiveIntervenants: string[];
  setCorrectiveIntervenants: (intervenants: string[] | ((prev: string[]) => string[])) => void;
  activeLiveInterventionId: string | number | null;
  setActiveLiveInterventionId: (id: string | number | null) => void;
  handleGetCorrectiveActionsForPanne: (anomalie: string) => string[];
  handleAddCorrectiveActionForPanne: (panneKey: string, actionText: string) => void;
  handleUpdateCorrectiveActionForPanne: (panneKey: string, actionIndex: number, newActionText: string) => void;
  handleDeleteCorrectiveActionForPanne: (panneKey: string, actionIndex: number) => void;
  handleAddPanne: (category: string, panneCode: string) => void;
  handleUpdatePanne: (category: string, oldCode: string, newCode: string) => void;
  handleDeletePanne: (category: string, panneCode: string) => void;
  handleAddTravail: (travailText: string) => void;
  handleUpdateTravail: (oldText: string, newText: string) => void;
  handleDeleteTravail: (travailText: string) => void;
  handleResetCorrectiveActions: () => Promise<void>;
  handleForceSyncCorrectiveSeed: () => Promise<any>;
  handleAddDemandeIntervention: (data: any) => any;
  handleConvertToBt: (id: string | number, btDetails?: any) => any;
  handleStartLiveIntervention: (id: string | number) => void;
  handleClotureIntervention: (id: string | number, clotureData?: any, onAddMouvement?: any) => any;
  handleUpdateCorrectiveIntervention: (id: string | number, patch?: any) => void;
  handleDeleteCorrectiveIntervention: (id: string | number) => void;
  handleBulkImportCorrective: (importedItems: any[]) => void;
  handleResetCorrectiveToSeed: (ctx?: any) => Promise<any>;

  // Derived Corrective KPIs
  correctiveKpis: () => any;
  correctiveParetoAnomalies: () => any[];
  correctiveParetoMachines: () => any[];
  correctiveParetoTypes: () => any[];
  correctivePreventiveRecommendations: () => any[];

  // ==========================================
  // 9. Derived State Getters (Zero unnecessary re-renders)
  // ==========================================
  stockItems: () => any[];
  effectiveDesignations: () => any[];

  // ==========================================
  // 10. Global Data Operations
  // ==========================================
  handleLoadDemoData: () => any;
  handleClearAllForRealFactory: () => any;
  handleLoadDemoSection: (sectionId: string) => any;
  handleClearDemoSection: (sectionId: string) => any;

  // ==========================================
  // 11. Multi-Tab State Synchronization
  // ==========================================
  applyRemoteStateUpdate: (remoteState: Record<string, any>) => void;
}
