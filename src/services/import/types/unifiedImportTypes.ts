import type {
  AssetClass,
  IGeneralSystemType,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IMouvement,
  IOperation,
  IPartDesignation,
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
import type { CorrectiveInterventionItem, PreventiveTaskItem } from '../../../types/store';

export type PipelineBundleType = 'REF_PARC' | 'REF_PERSONNEL' | 'ASSETS_MACHINES' | 'REF_PDR';

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
  | '04_PDR_ITEMS';

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
  status?: MachineStatus | string;
  is_active?: boolean;
  serial_number?: string;
  commissioning_date?: string;
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
// 5. PIPELINE OPTIONS & CONTEXT
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
  existingPreventiveTasks?: PreventiveTaskItem[];
  existingCorrectiveInterventions?: CorrectiveInterventionItem[];
  existingWarehouseItems?: IWarehouseItem[];
}

