/**
 * TypeScript Type Definitions for GMAO Zustand Global Store
 * Enforces strict typing for domain slices, actions, and derived calculations.
 */

import type {
  IStockItem,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IBlueprint,
  IGeneralSystemType,
  IMouvement,
  ISortieDemand,
  ISortieDemandItem,
  IZone,
  IOperation,
  ITechnician,
  IUserRecord,
  IType,
  IPartGroup,
  IPartType,
  IPartDesignation,
  ICompGroup,
  ICompFamily,
  ICompTemplate,
  IEntrepotComponent,
  IWarehouseItem,
  ValidationWorkflowStatus,
  PdrGroup,
} from './domain';
import type {
  PreventiveExecutionRecord,
  PreventiveExecutionSpareItem,
  PreventiveRequiredPdrItem,
} from './preventive';
import type { IMeterReading, MeterReadingSource, MeterUnit } from './meter';
import type { IReplenishmentOrder, ReplenishmentOrderStatus } from './replenishment';
import type { IAuditEvent } from './audit';
import type { IWorkshopOrder, WorkshopOrderStatus, WorkshopOrderType } from '../domain/corrective/workshopOrderService';
import type {
  INeedRequest,
  NeedRequestStatus,
  NeedApproChannel,
  CreateNeedRequestInput,
} from '../domain/corrective/needRequestService';
import type {
  ILotoPermit,
  LotoStatus,
  LotoConsignPayload,
  LotoDeconsignPayload,
} from '../domain/corrective/lotoService';

export type StateUpdater<T> = T | ((prev: T) => T);

export interface MachineElement {
  id: string;
  id_element?: string;
  id_machine_registered?: string;
  element_type?: 'COMPONENT' | 'PART' | 'PDR' | string;
  ref_element?: string;
  ref?: string;
  code_element?: string;
  designation?: string;
  nom_element?: string;
  nature?: string;
  qte_montee?: number;
  unite?: string;
  criticalite?: string;
  duree_vie_estimee_heures?: number;
  heures_actuelles?: number;
  date_installation?: string;
  technicien?: string;
  statut?: string;
  emplacement_machine?: string;
  parent_component_key?: string;
  remarques?: string;
  _source?: string;
  [key: string]: unknown;
}

export interface PreventiveTaskItem {
  id: string | number;
  code?: string;
  code_tache?: string;
  machine_id?: string;
  id_machine?: string;
  id_machine_registered?: string;
  machine_nom?: string;
  id_zone?: string;
  zone?: string;
  composant?: string;
  id_composant?: string;
  nom_composant?: string;
  id_part?: string;
  nom_part?: string;
  pdr_ref?: string;
  pdr_requises?: PreventiveRequiredPdrItem[];
  titre?: string;
  description?: string;
  action_code?: string;
  periodicite?: string;
  frequence?: string;
  statut?: string;
  priorite?: string;
  responsable?: string;
  is_active?: boolean;
  date_echeance?: string;
  prochaine_echeance?: string;
  derniere_execution?: string;
  dernier_releve?: number;
  compteur_actuel?: number;
  compteur_seuil_intervalle?: number;
  compteur_prochain_declenchement?: number;
  compteur_unite?: MeterUnit | string;
  type_declencheur?: 'CALENDRIER' | 'COMPTEUR' | 'HYBRIDE' | string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface IPreventiveActionCatalogItem {
  id: string | number;
  code: string;
  ref?: string;
  libelle: string;
  description?: string;
  couleur?: string;
  icone?: string;
  duree_standard?: number | string;
  outils?: string[] | string;
  created_at?: string;
  [key: string]: unknown;
}

export interface IPreventiveGuideCatalogItem {
  id: string | number;
  code: string;
  ref?: string;
  composant_nom: string;
  famille?: string;
  actions_liees?: string[];
  pieces_rechange?: Array<Record<string, unknown>>;
  fiches_actions?: Record<string, unknown> | Array<Record<string, unknown>>;
  consignes_securite?: string[] | string;
  criticite?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface IPreventivePlanCatalogItem {
  id?: string | number;
  id_plan?: string;
  code?: string;
  code_plan?: string;
  ref?: string;
  titre?: string;
  id_machine?: string;
  nom_machine?: string;
  machine_designation?: string;
  id_zone?: string;
  id_technicien?: string;
  technicien_responsable?: string;
  date_creation?: string;
  is_groupee?: boolean;
  semaine_cible?: string;
  description?: string;
  nb_taches?: number;
  created_at?: string;
  [key: string]: unknown;
}

export interface SortieExterneItem {
  id: string | number;
  code?: string;
  id_corrective?: string;
  id_machine_registered?: string;
  machine_designation?: string;
  designation_organe?: string;
  nature_travail?: string;
  type_probleme?: string;
  fournisseur_externe?: string;
  cout_bobinage?: number;
  cout_atelier?: number;
  statut?: string;
  etat?: string;
  date_sortie?: string;
  date_retour_prevue?: string;
  date_retour_reelle?: string;
  date_remontage?: string;
  technicien_sortie?: string;
  technicien_retour?: string;
  remarques?: string;
  [key: string]: unknown;
}

export interface SortieMountedPayload {
  date_montage: string;
  id_machine_cible: string;
  note: string;
  technicien_montage: string;
  [key: string]: unknown;
}

export interface CorrectivePdrConsumedItem {
  ref: string;
  designation?: string;
  quantite: number;
  unit?: string;
  prix_unitaire?: number;
  num_bon_saisi_par_tech?: string;
  [key: string]: unknown;
}

export interface CorrectiveInterventionItem {
  id?: string;
  num_bt?: string;
  code_machine?: string;
  id_machine?: string;
  id_machine_registered?: string;
  machine?: string;
  nom_machine?: string;
  zone?: string;
  id_zone?: string;
  id_composant?: string;
  id_part?: string;
  demandeur?: string;
  intervenant?: string;
  technicien_matricule?: string;
  anomalie?: string;
  panne?: string;
  type_panne?: string;
  priorite?: string;
  travail_a_faire?: string;
  action_realisee?: string;
  intervention_nature?: 'REPLACE' | 'ATELIER' | 'REPAIR' | 'CLEAN' | 'ADJUST' | 'INSPECT' | 'OTHER' | string;
  stock_effect?: string;
  statut?: string;
  status?: string;
  action_fermee?: 'OUI' | 'NON' | string;
  arret_machine?: 'OUI' | 'NON' | boolean | string;
  temps_arret?: string | number;
  date?: string;
  demande_date?: string;
  date_demande?: string;
  demande_heure?: string;
  heure_demande?: string;
  date_debut?: string;
  heure_debut?: string;
  date_fin?: string;
  heure_fin?: string;
  date_fin_proposee?: string;
  heure_fin_proposee?: string;
  date_cloture?: string;
  temps_intervention?: string;
  temps_intervention_propose?: string;
  temps_intervention_mins?: number;
  pdr_ref?: string;
  pdr_designation?: string;
  pdr_quantite?: number;
  pdr_utilisees?: CorrectivePdrConsumedItem[];
  pdr_proposees?: CorrectivePdrConsumedItem[];
  pieces_utilisees?: CorrectivePdrConsumedItem[];
  pieces_proposees?: CorrectivePdrConsumedItem[];
  pieces_claimed?: CorrectivePdrConsumedItem[];
  num_bon_saisi_par_tech?: string;
  marque?: string;
  etat_piece?: string;
  rapport_redige?: string;
  id_sortie_atelier?: string;
  code_sortie_atelier?: string;
  id_bon_atelier?: string;
  code_bon_atelier?: string;
  cout_pdr?: number;
  cout_atelier?: number;
  cout_total?: number;
  nature_travail_atelier?: string;
  prestataire_atelier?: string;
  validation_status?: ValidationWorkflowStatus | string;
  previous_validation_status?: ValidationWorkflowStatus | string;
  previous_validation_note?: string;
  resubmitted_count?: number;
  submitted_by_id?: string;
  submitted_by_name?: string;
  submitted_at?: string;
  validated_by_id?: string;
  validated_by_name?: string;
  validated_at?: string;
  validation_note?: string;
  validated_with_edits?: boolean;
  stock_deducted?: boolean;
  emitted_movement_ids?: string[];
  requires_loto?: boolean;
  loto_status?: LotoStatus;
  loto?: ILotoPermit;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type CorrectiveIntervenantEntry =
  | string
  | {
      id?: string;
      nom: string;
      role?: string;
      specialite?: string;
      [key: string]: unknown;
    };

export interface CorrectiveKpiComputedSummary {
  totalInterventions: number;
  cloturesCount: number;
  enCoursCount: number;
  totalDowntimeMinutes: number;
  mttrMinutes: string;
  tauxResolution: number;
}

export interface CorrectiveParetoItem {
  name: string;
  count: number;
  percentage: number;
  cumulativePercentage: number;
}

export interface CorrectivePreventiveRecommendationItem {
  machine: string;
  code_machine: string;
  count: number;
  repetitionCount: number;
  anomalie: string;
  zone: string;
  suggestedIntervalDays: number;
  recommendedAction: string;
  recommendation: string;
}

export interface ValidationReviewDecisionPayload {
  decision?: 'APPROVED' | 'REJECTED' | 'NEEDS_CLARIFICATION' | string;
  code_bon_magasin?: string;
  mergeWithMovementId?: string | null;
  approvedItems?: ISortieDemandItem[];
  sparesUsed?: PreventiveExecutionSpareItem[];
  sparesProposed?: PreventiveExecutionSpareItem[];
  approvedSpares?: PreventiveExecutionSpareItem[];
  validation_note?: string;
  notes?: string;
  validated_by_id?: string;
  validated_by_name?: string;
  date_fin?: string;
  heure_fin?: string;
  temps_intervention?: string;
  temps_intervention_mins?: number;
  action_realisee?: string;
  intervention_nature?: string;
  [key: string]: unknown;
}

export interface MeterReadingRecordPayload {
  machineId: string;
  valeur: number;
  unite?: MeterUnit;
  date_releve?: string;
  releve_par?: string;
  source?: MeterReadingSource;
  commentaire?: string;
}

export interface GmaoStoreState {
  // ==========================================
  // 1. Stock Slice
  // ==========================================
  pdrGroups: PdrGroup[];
  types: IType[];
  rawStock: IStockItem[];
  designations: IPartDesignation[];
  setPdrGroups: (groups: StateUpdater<PdrGroup[]>) => void;
  setTypes: (types: StateUpdater<IType[]>) => void;
  setRawStock: (rawStock: StateUpdater<IStockItem[]>) => void;
  setDesignations: (designations: StateUpdater<IPartDesignation[]>) => void;

  // ==========================================
  // 2. Machines & Topology Slice
  // ==========================================
  families: IMachineFamily[];
  templates: IMachineTemplate[];
  blueprints: IBlueprint[];
  machines: IMachine[];
  generalSystemTypes: IGeneralSystemType[];
  zones: IZone[];
  machineElementsLedger: MachineElement[];
  setFamilies: (families: StateUpdater<IMachineFamily[]>) => void;
  setTemplates: (templates: StateUpdater<IMachineTemplate[]>) => void;
  setBlueprints: (blueprints: StateUpdater<IBlueprint[]>) => void;
  setMachines: (machines: StateUpdater<IMachine[]>) => void;
  setGeneralSystemTypes: (types: StateUpdater<IGeneralSystemType[]>) => void;
  handleAddGeneralSystemType: (payload: { name: string; code?: string; id?: string }) => IGeneralSystemType | null;
  handleToggleGeneralSystemType: (id: string, isActive?: boolean) => void;
  setZones: (zones: StateUpdater<IZone[]>) => void;
  setMachineElementsLedger: (ledger: StateUpdater<MachineElement[]>) => void;
  addMachineElement: (element: Partial<MachineElement>) => void;
  updateMachineElement: (id: string, updates: Partial<MachineElement>) => void;
  deleteMachineElement: (id: string) => void;
  duplicateBOMToTwins: (sourceMachineId: string, targetMachineIds: string[]) => void;
  isValidMachineFamilies: (arr: IMachineFamily[]) => boolean;
  isValidMachineTemplates: (arr: IMachineTemplate[]) => boolean;

  // ==========================================
  // 3. Warehouse / Entrepôt Slice
  // ==========================================
  warehouseItems: IWarehouseItem[];
  entrepotComponents: IEntrepotComponent[];
  compGroups: ICompGroup[];
  compFamilies: ICompFamily[];
  compTemplates: ICompTemplate[];
  partGroups: IPartGroup[];
  partTypes: IPartType[];
  partDesignations: IPartDesignation[];
  setWarehouseItems: (items: StateUpdater<IWarehouseItem[]>) => void;
  setEntrepotComponents: (comps: StateUpdater<IEntrepotComponent[]>) => void;
  setCompGroups: (groups: StateUpdater<ICompGroup[]>) => void;
  setCompFamilies: (families: StateUpdater<ICompFamily[]>) => void;
  setCompTemplates: (templates: StateUpdater<ICompTemplate[]>) => void;
  setPartGroups: (groups: StateUpdater<IPartGroup[]>) => void;
  setPartTypes: (types: StateUpdater<IPartType[]>) => void;
  setPartDesignations: (designations: StateUpdater<IPartDesignation[]>) => void;

  // ==========================================
  // 4. Personnel & Users Slice
  // ==========================================
  users: IUserRecord[];
  technicians: ITechnician[];
  operations: IOperation[];
  setUsers: (users: StateUpdater<IUserRecord[]>) => void;
  setTechnicians: (techs: StateUpdater<ITechnician[]>) => void;
  setOperations: (ops: StateUpdater<IOperation[]>) => void;

  // ==========================================
  // 5. Movements Slice & V3/V4 Sortie Demands
  // ==========================================
  mouvements: IMouvement[];
  setMouvements: (movements: StateUpdater<IMouvement[]>) => void;
  sortieDemands: ISortieDemand[];
  setSortieDemands: (demands: StateUpdater<ISortieDemand[]>) => void;
  handleSubmitSortieDemand: (demandPayload: Partial<ISortieDemand> & Record<string, unknown>) => ISortieDemand | null;
  handleReviewSortieDemandValidation: (
    demandId: string,
    decisionData?: ValidationReviewDecisionPayload,
    onAddMouvement?: ((mvt: IMouvement) => void) | null
  ) => ISortieDemand | null;

  // ==========================================
  // 5b. Replenishment & Purchase Orders Slice (المحور 4)
  // ==========================================
  replenishmentOrders: IReplenishmentOrder[];
  setReplenishmentOrders: (orders: StateUpdater<IReplenishmentOrder[]>) => void;
  handleCreateReplenishmentOrder: (orderData: Partial<IReplenishmentOrder>) => Promise<IReplenishmentOrder>;
  handleUpdateReplenishmentOrderStatus: (
    orderId: string,
    status: ReplenishmentOrderStatus,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  handleReceiveReplenishmentOrder: (
    orderId: string,
    receivedItems: { ref: string; quantite_recue: number }[],
    numBonReception?: string,
    recepteur?: string
  ) => Promise<void>;

  // ==========================================
  // 6. Preventive Maintenance Slice
  // ==========================================
  preventiveTasks: PreventiveTaskItem[];
  preventiveActions: IPreventiveActionCatalogItem[];
  preventiveGuides: IPreventiveGuideCatalogItem[];
  preventivePlans: IPreventivePlanCatalogItem[];
  preventiveExecutions: PreventiveExecutionRecord[];
  meterReadings: IMeterReading[];
  setPreventiveTasks: (tasks: StateUpdater<PreventiveTaskItem[]>) => void;
  setPreventiveActions: (actions: StateUpdater<IPreventiveActionCatalogItem[]>) => void;
  setPreventiveGuides: (guides: StateUpdater<IPreventiveGuideCatalogItem[]>) => void;
  setPreventivePlans: (plans: StateUpdater<IPreventivePlanCatalogItem[]>) => void;
  setPreventiveExecutions: (executions: StateUpdater<PreventiveExecutionRecord[]>) => void;
  setMeterReadings: (readings: StateUpdater<IMeterReading[]>) => void;
  handleRecordMeterReading: (payload: MeterReadingRecordPayload) => IMeterReading | null;
  handleBatchRecordMeterReadings: (readingsPayload: MeterReadingRecordPayload[]) => IMeterReading[];
  handleUpdateTask: (id: string | number, updates: Partial<PreventiveTaskItem> & Record<string, unknown>) => void;
  handleDeleteTask: (id: string | number) => void;
  handleUpdateTaskCounter: (id: string | number, newCounterValue: number | string) => void;
  handleMarkTaskDone: (
    id: string | number,
    validationData?: Record<string, unknown>
  ) => PreventiveExecutionRecord | null | void;
  handleReviewPreventiveExecutionValidation: (
    executionId: string,
    decisionData?: ValidationReviewDecisionPayload,
    onAddMouvement?: ((mvt: IMouvement) => void) | null
  ) => PreventiveExecutionRecord | null;
  handleDeletePreventiveExecution: (id: string) => void;
  handleCreatePlanWithTasks: (
    planData: Partial<IPreventivePlanCatalogItem> & Record<string, unknown>,
    taskItems: Array<Partial<PreventiveTaskItem> & Record<string, unknown>>
  ) => { plan: IPreventivePlanCatalogItem; tasks: PreventiveTaskItem[] };
  handleAddAction: (
    actionData: Partial<IPreventiveActionCatalogItem> & Record<string, unknown>
  ) => IPreventiveActionCatalogItem[];
  handleUpdateAction: (
    id: string | number,
    actionData: Partial<IPreventiveActionCatalogItem> & Record<string, unknown>
  ) => IPreventiveActionCatalogItem[];
  handleDeleteAction: (id: string | number) => IPreventiveActionCatalogItem[];
  handleAddGuide: (
    guideData: Partial<IPreventiveGuideCatalogItem> & Record<string, unknown>
  ) => IPreventiveGuideCatalogItem[];
  handleUpdateGuide: (
    id: string | number,
    guideData: Partial<IPreventiveGuideCatalogItem> & Record<string, unknown>
  ) => IPreventiveGuideCatalogItem[];
  handleDeleteGuide: (id: string | number) => IPreventiveGuideCatalogItem[];
  handleResetPreventiveToBaseline: (
    ctx?: Record<string, unknown>
  ) => Promise<{ cancelled: boolean; restoredCount?: number; orphanCountAfter?: number }>;
  handleClearPreventiveForRealFactory: (
    ctx?: Record<string, unknown>
  ) => Promise<{ cancelled: boolean; clearedCount?: number }>;

  // ==========================================
  // 7. Sorties Externe Slice
  // ==========================================
  sortiesExterne: SortieExterneItem[];
  setSortiesExterne: (sorties: StateUpdater<SortieExterneItem[]>) => void;
  handleAddSortieExterne: (sortieData: Partial<SortieExterneItem> & Record<string, unknown>) => SortieExterneItem;
  handleUpdateSortieExterne: (
    id: string | number,
    sortieData: Partial<SortieExterneItem> & Record<string, unknown>
  ) => SortieExterneItem | null;
  handleDeleteSortieExterne: (id: string | number) => void;
  handleMarkSortieReturned: (
    id: string | number,
    returnData?: number | Record<string, unknown>
  ) => SortieExterneItem | null;
  handleMarkSortieMounted: (
    id: string | number,
    mountData: SortieMountedPayload
  ) => SortieExterneItem | null;
  handleClearSortiesForRealFactory: () => Promise<{ cancelled: boolean; clearedCount?: number }>;
  handleResetSortiesToBaseline: () => { cancelled: boolean; count: number };

  // ==========================================
  // 8. Corrective Nexus Slice
  // ==========================================
  correctiveInterventions: CorrectiveInterventionItem[];
  setCorrectiveInterventions: (interventions: StateUpdater<CorrectiveInterventionItem[]>) => void;
  correctiveActionsByPanne: Record<string, string[]>;
  setCorrectiveActionsByPanne: (actions: StateUpdater<Record<string, string[]>>) => void;
  correctivePanneCategories: Record<string, string[]>;
  setCorrectivePanneCategories: (categories: StateUpdater<Record<string, string[]>>) => void;
  correctiveTravauxAFaire: string[];
  setCorrectiveTravauxAFaire: (travaux: StateUpdater<string[]>) => void;
  correctiveIntervenants: CorrectiveIntervenantEntry[];
  setCorrectiveIntervenants: (intervenants: StateUpdater<CorrectiveIntervenantEntry[]>) => void;
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
  handleForceSyncCorrectiveSeed: () => Promise<{
    interventionsCount: number;
    pannesCount?: number | unknown;
    categoriesCount?: number;
    travauxCount?: number;
    actionsCount?: number;
    intervenantsCount?: number;
  }>;
  handleAddDemandeIntervention: (
    data: Partial<CorrectiveInterventionItem> & Record<string, unknown>
  ) => CorrectiveInterventionItem;
  handleConvertToBt: (
    id: string | number,
    btDetails?: Record<string, unknown>
  ) => CorrectiveInterventionItem | null;
  handleStartLiveIntervention: (id: string | number) => void;
  handleSubmitInterventionForValidation: (
    id: string | number,
    submissionData?: Partial<CorrectiveInterventionItem> & Record<string, unknown>
  ) => CorrectiveInterventionItem | null;
  handleReviewInterventionValidation: (
    id: string | number,
    decisionData?: ValidationReviewDecisionPayload,
    onAddMouvement?: ((mvt: IMouvement) => void) | null
  ) => CorrectiveInterventionItem | null;
  handleClotureIntervention: (
    id: string | number,
    clotureData?: Partial<CorrectiveInterventionItem> & Record<string, unknown>,
    onAddMouvement?: ((mvt: IMouvement) => void) | null
  ) => CorrectiveInterventionItem | null;
  handleUpdateCorrectiveIntervention: (
    id: string | number,
    patch?: Partial<CorrectiveInterventionItem> & Record<string, unknown>
  ) => void;
  handleDeleteCorrectiveIntervention: (id: string | number) => void;
  handleBulkImportCorrective: (importedItems: CorrectiveInterventionItem[]) => void;
  handleResetCorrectiveToSeed: (
    ctx?: Record<string, unknown>
  ) => Promise<{ cancelled: boolean; restoredCount?: number; orphanCountAfter?: number }>;
  handleConsignInterventionLoto: (
    id: string | number,
    payload: Partial<LotoConsignPayload> & { actorRole?: string }
  ) => { valid: boolean; reason?: string; intervention?: CorrectiveInterventionItem };
  handleDeconsignInterventionLoto: (
    id: string | number,
    payload?: Partial<LotoDeconsignPayload> & { actorRole?: string }
  ) => { valid: boolean; reason?: string; intervention?: CorrectiveInterventionItem };

  // ==========================================
  // 8b. Mechanical Workshop Orders (COR-ATELIER-P0)
  // ==========================================
  workshopOrders: IWorkshopOrder[];
  setWorkshopOrders: (orders: StateUpdater<IWorkshopOrder[]>) => void;
  handleCreateWorkshopOrder: (
    payload: Partial<IWorkshopOrder> & { id_machine: string; description_travaux: string }
  ) => IWorkshopOrder | null;
  handleTransitionWorkshopOrderStatus: (
    orderId: string,
    nextStatus: WorkshopOrderStatus,
    observation?: string
  ) => { valid: boolean; reason?: string; order?: IWorkshopOrder };

  // ==========================================
  // 8c. Need Requests & Field Handoff (COR-HANDOFF-P0)
  // ==========================================
  needRequests: INeedRequest[];
  setNeedRequests: (requests: StateUpdater<INeedRequest[]>) => void;
  handleCreateNeedRequest: (payload: CreateNeedRequestInput) => INeedRequest | null;
  handleReviewNeedRequest: (
    needId: string,
    decisionPayload: {
      decision:
        | 'APPROVISIONNEMENT'
        | 'REVUE_SUPERVISEUR'
        | 'CLARIFICATION'
        | 'REJETE'
        | 'ANNULE';
      canal_appro?: NeedApproChannel | null;
      notes_superviseur?: string;
      motif_rejet?: string;
      workshopOrderType?: WorkshopOrderType;
      id_sortie_demand?: string | null;
      actorRole?: string;
      actorId?: string;
      actorName?: string;
    }
  ) => {
    valid: boolean;
    reason?: string;
    needRequest?: INeedRequest;
    workshopOrder?: IWorkshopOrder | null;
  };
  handleTransitionNeedRequestStatus: (
    needId: string,
    nextStatus: NeedRequestStatus,
    context?: {
      observation_pose_essai?: string;
      notes_superviseur?: string;
      motif_rejet?: string;
      actorRole?: string;
      isTechnician?: boolean;
      actorId?: string;
      actorName?: string;
    }
  ) => { valid: boolean; reason?: string; needRequest?: INeedRequest };

  // Derived Corrective KPIs
  correctiveKpis: () => CorrectiveKpiComputedSummary;
  correctiveParetoAnomalies: () => CorrectiveParetoItem[];
  correctiveParetoMachines: () => CorrectiveParetoItem[];
  correctiveParetoTypes: () => CorrectiveParetoItem[];
  correctivePreventiveRecommendations: () => CorrectivePreventiveRecommendationItem[];

  // ==========================================
  // 9. Derived State Getters (Zero unnecessary re-renders)
  // ==========================================
  stockItems: () => IStockItem[];
  effectiveDesignations: () => IPartDesignation[];

  // ==========================================
  // 10. Global Data Operations
  // ==========================================
  handleLoadDemoData: () => unknown;
  handleClearAllForRealFactory: () => unknown;
  handleLoadDemoSection: (sectionId: string) => unknown;
  handleClearDemoSection: (sectionId: string) => unknown;

  // ==========================================
  // 11. Multi-Tab State Synchronization
  // ==========================================
  applyRemoteStateUpdate: (remoteState: Record<string, unknown>) => void;

  // ==========================================
  // 12. Append-Only Enterprise Audit Ledger (AUDIT-LEDGER-P0)
  // ==========================================
  auditEvents: ReadonlyArray<IAuditEvent>;
  appendAuditEvent: (
    payload: Omit<IAuditEvent, 'id' | 'ts' | 'actorId' | 'actorName' | 'actorRole'> &
      Partial<Pick<IAuditEvent, 'id' | 'ts' | 'actorId' | 'actorName' | 'actorRole'>>
  ) => IAuditEvent;
  [key: string]: unknown;
}

/**
 * Optional store setter subset passed to `DataGateway` lifecycle operations (`initRealStock`,
 * `loadDemoData`, `clearAllForRealFactory`, `loadDemoSection`, `clearDemoSection`).
 * Setters take concrete `T[]` values (never updater functions); by parameter contravariance,
 * both full Zustand `StateUpdater<T[]>` setters and narrow unit-test stubs satisfy this contract.
 */
export interface GmaoStoreSetters {
  setPdrGroups?: (groups: PdrGroup[]) => void;
  setRawStock?: (stock: IStockItem[]) => void;
  setTypes?: (types: IType[]) => void;
  setDesignations?: (designations: IPartDesignation[]) => void;
  setMachines?: (machines: IMachine[]) => void;
  setGeneralSystemTypes?: (types: IGeneralSystemType[]) => void;
  setFamilies?: (families: IMachineFamily[]) => void;
  setTemplates?: (templates: IMachineTemplate[]) => void;
  setBlueprints?: (blueprints: IBlueprint[]) => void;
  setZones?: (zones: IZone[]) => void;
  setMachineElementsLedger?: (ledger: MachineElement[]) => void;
  setWarehouseItems?: (items: IWarehouseItem[]) => void;
  setEntrepotComponents?: (comps: IEntrepotComponent[]) => void;
  setCompGroups?: (groups: ICompGroup[]) => void;
  setCompFamilies?: (families: ICompFamily[]) => void;
  setCompTemplates?: (templates: ICompTemplate[]) => void;
  setPartGroups?: (groups: IPartGroup[]) => void;
  setPartTypes?: (types: IPartType[]) => void;
  setPartDesignations?: (designations: IPartDesignation[]) => void;
  setUsers?: (users: IUserRecord[]) => void;
  setTechnicians?: (techs: ITechnician[]) => void;
  setOperations?: (ops: IOperation[]) => void;
  setMouvements?: (movements: IMouvement[]) => void;
  setSortieDemands?: (demands: ISortieDemand[]) => void;
  setReplenishmentOrders?: (orders: IReplenishmentOrder[]) => void;
  setSortiesExterne?: (sorties: SortieExterneItem[]) => void;
  setPreventiveTasks?: (tasks: PreventiveTaskItem[]) => void;
  setPreventiveActions?: (actions: IPreventiveActionCatalogItem[]) => void;
  setPreventiveGuides?: (guides: IPreventiveGuideCatalogItem[]) => void;
  setPreventivePlans?: (plans: IPreventivePlanCatalogItem[]) => void;
  setPreventiveExecutions?: (executions: PreventiveExecutionRecord[]) => void;
  setMeterReadings?: (readings: IMeterReading[]) => void;
  setAuditEvents?: (events: IAuditEvent[]) => void;
  setCorrectiveInterventions?: (interventions: CorrectiveInterventionItem[]) => void;
  setCorrectiveActionsByPanne?: (actions: Record<string, string[]>) => void;
  setCorrectivePanneCategories?: (categories: Record<string, string[]>) => void;
  setCorrectiveTravauxAFaire?: (travaux: string[]) => void;
  setCorrectiveIntervenants?: (intervenants: CorrectiveIntervenantEntry[]) => void;
  setWorkshopOrders?: (orders: IWorkshopOrder[]) => void;
  setNeedRequests?: (requests: INeedRequest[]) => void;
  applyRemoteStateUpdate?: (remoteState: Record<string, unknown>) => void;
  [key: string]: unknown;
}
