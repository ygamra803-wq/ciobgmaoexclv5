import type {
  AssetClass,
  ComponentDefaultRepairMode,
  ICompFamily,
  ICompGroup,
  ICompTemplate,
  IEntrepotComponent,
  IGeneralSystemType,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IMouvement,
  IOperation,
  IPartDesignation,
  IPartGroup,
  IPartType,
  IStockItem,
  ITechnician,
  IUserRecord,
  IWarehouseItem,
  IZone,
  MachineStatus,
  MaterialPolicyTag,
  PdrGroup,
  ProfileType,
  StockType,
} from '../../../types/domain';
import type {
  CorrectiveInterventionItem,
  IPreventiveActionCatalogItem,
  IPreventiveGuideCatalogItem,
  MachineElement,
  PreventiveTaskItem,
} from '../../../types/store';
import type { PreventiveExecutionRecord } from '../../../types/preventive';

export type PipelineBundleType =
  | 'REF_PARC'
  | 'REF_PERSONNEL'
  | 'ASSETS_MACHINES'
  | 'REF_PDR'
  | 'PM_CATALOG'
  | 'ENTREPOT_BOM'
  | 'CM_CATALOG'
  | 'DEMO_BUNDLE';

export type ImportSourceOrigin = 'EXCEL' | 'JSON_BUNDLE' | 'DEMO_BUNDLE';

export type ImportMode = 'MERGE' | 'REPLACE_CATALOG';

export type ImportCommitPolicy = 'ATOMIC' | 'STAGE_ISOLATED';

export type PipelineStageId =
  | '01_ZONES'
  | '02_PERSONNEL'
  | '03_FAMILIES'
  | '03_TEMPLATES'
  | '03_GENERAL_SYSTEM_TYPES'
  | '03_MACHINES'
  | '04_PDR_GROUPS'
  | '04_PDR_TYPES'
  | '04_PDR_ITEMS'
  | '05_PM_ACTIONS'
  | '05_PM_GUIDES'
  | '06_COMP_GROUPS'
  | '06_COMP_FAMILIES'
  | '06_COMP_TEMPLATES'
  | '06_PART_GROUPS'
  | '06_PART_TYPES'
  | '06_PART_DESIGNATIONS'
  | '07_PANNE_CATEGORIES'
  | '07_PANNE_ACTIONS';

export type ImportIssueCode =
  | 'MISSING_REQUIRED'
  | 'DUPLICATE_KEY'
  | 'BROKEN_FK'
  | 'TEMPLATE_FAMILY_MISMATCH'
  | 'CIRCULAR_HIERARCHY'
  | 'REFERENCED_BY_ACTIVE_RECORDS'
  | 'ARCHIVED_MACHINE_REF'
  | 'LEGACY_ZONE_NORMALIZED'
  | 'RBAC_DENIED'
  | 'SCHEMA_MISMATCH'
  | 'FORBIDDEN_BUNDLE_FIELD';

export interface ImportIssue {
  stage: PipelineStageId;
  entity: string;
  row: number;
  identifier?: string;
  code: ImportIssueCode;
  message: string;
  blocking: boolean;
  referencedCount?: number;
  referenceBreakdown?: Record<string, number>;
}

export interface AcceptedStageRecord {
  stage: PipelineStageId;
  entity: string;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
}

export interface ImportReport<TStaging = Record<string, unknown>> {
  bundleType: PipelineBundleType;
  success: boolean;
  dryRun: boolean;
  origin: ImportSourceOrigin;
  mode: ImportMode;
  commitPolicy: ImportCommitPolicy;
  committed: boolean;
  accepted: AcceptedStageRecord[];
  rejected: ImportIssue[];
  warnings: ImportIssue[];
  durationMs: number;
  staging: TStaging;
}

// ============================================================================
// 1. REF_PARC BUNDLE SCHEMAS (Level 2 Reference Layer)
// ============================================================================

export interface RefParcZoneRow {
  code_zone: string;
  libelle?: string;
  nom?: string;
  description?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface RefParcFamilyRow {
  code_family: string;
  libelle?: string;
  nom?: string;
  description?: string;
  [key: string]: unknown;
}

export interface RefParcTemplateRow {
  code_template: string;
  libelle?: string;
  nom?: string;
  code_family: string;
  constructeur?: string;
  puissance?: string;
  vitesse?: string;
  description?: string;
  [key: string]: unknown;
}

export interface RefParcGeneralSystemTypeRow {
  code_system_type?: string;
  id_system_type?: string;
  code?: string;
  libelle?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface RefParcBundleInput {
  bundleType?: 'REF_PARC';
  zones?: RefParcZoneRow[];
  families?: RefParcFamilyRow[];
  templates?: RefParcTemplateRow[];
  generalSystemTypes?: RefParcGeneralSystemTypeRow[];
  [key: string]: unknown;
}

export interface RefParcStagingResult {
  nextZones: IZone[];
  nextFamilies: IMachineFamily[];
  nextTemplates: IMachineTemplate[];
  nextGeneralSystemTypes: IGeneralSystemType[];
}

// ============================================================================
// 2. REF_PERSONNEL BUNDLE SCHEMAS (Level 2 Operational Personnel Layer)
// ============================================================================

export interface RefPersonnelTechnicianRow {
  code_technician: string;
  nom: string;
  prenom?: string;
  code_zone?: string | null;
  specialite?: string;
  is_active?: boolean;
  statut?: string;
  [key: string]: unknown;
}

export interface RefPersonnelOperationRow {
  code_operation: string;
  nom: string;
  prenom?: string;
  code_zone?: string | null;
  type_profil?: ProfileType | string;
  specialite?: string;
  is_active?: boolean;
  statut?: string;
  [key: string]: unknown;
}

export interface RefPersonnelBundleInput {
  bundleType?: 'REF_PERSONNEL';
  technicians?: RefPersonnelTechnicianRow[];
  operations?: RefPersonnelOperationRow[];
  [key: string]: unknown;
}

export interface RefPersonnelStagingResult {
  nextTechnicians: ITechnician[];
  nextOperations: IOperation[];
  nextUsers: IUserRecord[];
}

// ============================================================================
// 3. ASSETS_MACHINES BUNDLE SCHEMAS (Level 1 Live Assets Layer)
// ============================================================================

export interface AssetsMachineRow {
  code_machine: string;
  designation?: string;
  nom?: string;
  code_zone: string;
  asset_class?: AssetClass | string;
  code_family?: string | null;
  code_template?: string | null;
  code_system_type?: string | null;
  code_technician?: string | null;
  parent_code_machine?: string | null;
  asset_level?: 'MACHINE' | 'LINE' | string;
  id_blueprint?: string | null;
  status?: MachineStatus | string;
  is_active?: boolean;
  serial_number?: string;
  commissioning_date?: string;
  compteur_actuel?: number;
  compteur_heures?: number;
  unite_compteur?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface AssetsMachinesBundleInput {
  bundleType?: 'ASSETS_MACHINES';
  machines: AssetsMachineRow[];
  [key: string]: unknown;
}

export interface AssetsMachinesStagingResult {
  nextMachines: IMachine[];
}

// ============================================================================
// 4. REF_PDR BUNDLE SCHEMAS (Level 2 PDR Catalog Layer — 04_PDR)
// ============================================================================

export interface RefPdrGroupRow {
  code_group: string;
  code?: string;
  id?: string;
  libelle: string;
  description?: string;
  domaine_technique?: string;
  default_policy_tags?: string | MaterialPolicyTag[];
  sort_order?: number;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface RefPdrTypeRow {
  code_type: string;
  code_group: string;
  group_code?: string;
  libelle: string;
  domaine_technique?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface RefPdrItemRow {
  ref: string;
  code_article?: string;
  designation: string;
  code_type: string;
  code_group?: string;
  seuil?: number;
  emplacement?: string;
  stockInitial?: number | null;
  prix_unitaire?: number;
  unite_mesure?: string;
  criticite?: string;
  ref_constructeur?: string;
  code_equivalents?: string;
  delai_appro_jours?: number;
  domaine_technique?: string;
  policy_tags?: string | MaterialPolicyTag[];
  [key: string]: unknown;
}

export interface RefPdrBundleInput {
  bundleType?: 'REF_PDR';
  groups?: RefPdrGroupRow[];
  types?: RefPdrTypeRow[];
  items?: RefPdrItemRow[];
  [key: string]: unknown;
}

export interface RefPdrStagingResult {
  nextGroups: PdrGroup[];
  nextTypes: StockType[];
  nextStock: IStockItem[];
  nextDesignations: IPartDesignation[];
}

// ============================================================================
// 5. PM_CATALOG BUNDLE SCHEMAS (Level 2 Preventive Catalog Layer — 05_PM_CATALOG)
// ============================================================================

export interface PmCatalogActionRow {
  code_action: string;
  code?: string;
  libelle: string;
  ref?: string;
  description?: string;
  type_maintenance?: string;
  frequence_defaut?: string;
  duree_standard?: string | number;
  duree_estimee_min?: number;
  outils?: string | string[];
  couleur?: string;
  icone?: string;
  symbole?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface PmCatalogGuidePieceRow {
  ref?: string;
  reference?: string;
  designation?: string;
  quantite?: number;
  unite?: string;
  prix_unitaire?: number;
  [key: string]: unknown;
}

export interface PmCatalogGuideRow {
  code_guide: string;
  code?: string;
  composant_nom: string;
  famille?: string;
  ref?: string;
  actions_liees: string[];
  pieces_rechange?: PmCatalogGuidePieceRow[];
  fiches_actions?: Record<string, Record<string, unknown>>;
  consignes_securite?: string | string[];
  criticite?: string;
  periodicite_suggeree?: string;
  outillage_requis?: string[];
  points_de_controle?: string[];
  is_active?: boolean;
  [key: string]: unknown;
}

export interface PmCatalogBundleInput {
  bundleType?: 'PM_CATALOG';
  actions?: PmCatalogActionRow[];
  guides?: PmCatalogGuideRow[];
  [key: string]: unknown;
}

export interface PmCatalogStagingResult {
  nextActions: IPreventiveActionCatalogItem[];
  nextGuides: IPreventiveGuideCatalogItem[];
}

// ============================================================================
// 6. ENTREPOT_BOM BUNDLE SCHEMAS (Level 2 Components & Parts BOM Layer — 06_ENTREPOT_BOM)
// ============================================================================

export interface EntrepotBomCompGroupRow {
  code_comp_group: string;
  code?: string;
  libelle: string;
  ref?: string;
  description?: string;
  domaine_technique?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface EntrepotBomCompFamilyRow {
  code_comp_family: string;
  code_comp_group: string;
  code?: string;
  libelle: string;
  type?: string;
  ref?: string;
  description?: string;
  [key: string]: unknown;
}

export interface EntrepotBomCompTemplateRow {
  code_comp_template: string;
  code_comp_family: string;
  code_comp_group?: string;
  code?: string;
  ref?: string;
  libelle: string;
  type?: string;
  mode_reparation_defaut?: ComponentDefaultRepairMode | string;
  tension_nominale?: string;
  courant_nominal_a?: number | string;
  indice_protection?: string;
  type_fixation?: string;
  specs?: Record<string, unknown>;
  description?: string;
  [key: string]: unknown;
}

export interface EntrepotBomPartGroupRow {
  code_part_group: string;
  code?: string;
  libelle: string;
  description?: string;
  domaine_technique?: string;
  default_policy_tags?: string | MaterialPolicyTag[];
  sort_order?: number;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface EntrepotBomPartTypeRow {
  code_part_type: string;
  code_part_group: string;
  libelle: string;
  description?: string;
  domaine_technique?: string;
  [key: string]: unknown;
}

export interface EntrepotBomPartDesignationRow {
  ref: string;
  code_part_type: string;
  code_part_group?: string;
  designation: string;
  libelle?: string;
  id_diag?: string;
  seuil?: number;
  emplacement?: string;
  matiere_nuance?: string;
  ref_plan?: string;
  dimensions_brut?: string;
  traitement_thermique?: string;
  policy_tags?: string | MaterialPolicyTag[];
  [key: string]: unknown;
}

export interface EntrepotBomBundleInput {
  bundleType?: 'ENTREPOT_BOM';
  compGroups?: EntrepotBomCompGroupRow[];
  compFamilies?: EntrepotBomCompFamilyRow[];
  compTemplates?: EntrepotBomCompTemplateRow[];
  partGroups?: EntrepotBomPartGroupRow[];
  partTypes?: EntrepotBomPartTypeRow[];
  partDesignations?: EntrepotBomPartDesignationRow[];
  [key: string]: unknown;
}

export interface EntrepotBomStagingResult {
  nextCompGroups: ICompGroup[];
  nextCompFamilies: ICompFamily[];
  nextCompTemplates: ICompTemplate[];
  nextPartGroups: IPartGroup[];
  nextPartTypes: IPartType[];
  nextPartDesignations: IPartDesignation[];
}

// ============================================================================
// 7. CM_CATALOG BUNDLE SCHEMAS (Level 2 Fault & Action Catalog — 07_CM_CATALOG)
// ============================================================================

export interface CmCatalogCategoryRow {
  code_category: string;
  libelle?: string;
  [key: string]: unknown;
}

export interface CmCatalogFaultRow {
  code_fault: string;
  code_category: string;
  panne: string;
  actions?: string[];
  [key: string]: unknown;
}

export interface CmCatalogBundleInput {
  bundleType?: 'CM_CATALOG';
  categories?: CmCatalogCategoryRow[];
  faults?: CmCatalogFaultRow[];
  [key: string]: unknown;
}

export interface CmCatalogStagingResult {
  nextPanneCategories: Record<string, string[]>;
  nextActionsByPanne: Record<string, string[]>;
}

// ============================================================================
// 8. DEMO_BUNDLE SCHEMAS (Unified Multi-Stage Demo Hydration — Mode C)
// ============================================================================

export interface DemoBundleInput {
  bundleType?: 'DEMO_BUNDLE';
  refParc: RefParcBundleInput;
  refPersonnel: RefPersonnelBundleInput;
  assetsMachines: AssetsMachinesBundleInput;
  refPdr: RefPdrBundleInput;
  pmCatalog: PmCatalogBundleInput;
  entrepotBom?: EntrepotBomBundleInput;
  cmCatalog?: CmCatalogBundleInput;
}

export interface DemoBundleStagingResult {
  nextZones: IZone[];
  nextFamilies: IMachineFamily[];
  nextTemplates: IMachineTemplate[];
  nextGeneralSystemTypes: IGeneralSystemType[];
  nextTechnicians: ITechnician[];
  nextOperations: IOperation[];
  nextUsers: IUserRecord[];
  nextMachines: IMachine[];
  nextGroups: PdrGroup[];
  nextTypes: StockType[];
  nextStock: IStockItem[];
  nextDesignations: IPartDesignation[];
  nextActions: IPreventiveActionCatalogItem[];
  nextGuides: IPreventiveGuideCatalogItem[];
  nextCompGroups?: ICompGroup[];
  nextCompFamilies?: ICompFamily[];
  nextCompTemplates?: ICompTemplate[];
  nextPartGroups?: IPartGroup[];
  nextPartTypes?: IPartType[];
  nextPartDesignations?: IPartDesignation[];
  nextPanneCategories?: Record<string, string[]>;
  nextActionsByPanne?: Record<string, string[]>;
}

// ============================================================================
// 9. PIPELINE OPTIONS & CONTEXT
// ============================================================================

export interface UnifiedImportOptions {
  mode?: ImportMode;
  origin?: ImportSourceOrigin;
  commitPolicy?: ImportCommitPolicy;
  dryRun?: boolean;
  actorRole?: string;
  actorId?: string;
  actorName?: string;
  strictTechnicianCheck?: boolean;
  strictPdrCheck?: boolean;

  // Optional injected state snapshots (defaults to live useGmaoStore state)
  existingZones?: IZone[];
  existingFamilies?: IMachineFamily[];
  existingTemplates?: IMachineTemplate[];
  existingGeneralSystemTypes?: IGeneralSystemType[];
  existingMachines?: IMachine[];
  existingTechnicians?: ITechnician[];
  existingOperations?: IOperation[];
  existingUsers?: IUserRecord[];
  existingPdrGroups?: PdrGroup[];
  existingStockTypes?: StockType[];
  existingStock?: IStockItem[];
  existingMouvements?: IMouvement[];
  existingPreventiveActions?: IPreventiveActionCatalogItem[];
  existingPreventiveGuides?: IPreventiveGuideCatalogItem[];
  existingPreventiveTasks?: PreventiveTaskItem[];
  existingPreventiveExecutions?: PreventiveExecutionRecord[];
  existingCorrectiveInterventions?: CorrectiveInterventionItem[];
  existingWarehouseItems?: IWarehouseItem[];
  existingCompGroups?: ICompGroup[];
  existingCompFamilies?: ICompFamily[];
  existingCompTemplates?: ICompTemplate[];
  existingPartGroups?: IPartGroup[];
  existingPartTypes?: IPartType[];
  existingPartDesignations?: IPartDesignation[];
  existingEntrepotComponents?: IEntrepotComponent[];
  existingMachineElementsLedger?: MachineElement[];
  existingPanneCategories?: Record<string, string[]>;
  existingActionsByPanne?: Record<string, string[]>;
}

