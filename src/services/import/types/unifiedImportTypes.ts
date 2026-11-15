import type {
  AssetClass,
  IGeneralSystemType,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IMouvement,
  IPartDesignation,
  IStockItem,
  ITechnician,
  IUserRecord,
  IWarehouseItem,
  IZone,
  MachineStatus,
  PdrGroup,
  StockType,
} from '../../../types/domain';
import type { CorrectiveInterventionItem, PreventiveTaskItem } from '../../../types/store';

export type PipelineBundleType = 'REF_PARC' | 'ASSETS_MACHINES' | 'REF_PDR';

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
  | '04_PDR';

export type ImportIssueCode =
  | 'MISSING_REQUIRED'
  | 'DUPLICATE_KEY'
  | 'BROKEN_FK'
  | 'TEMPLATE_FAMILY_MISMATCH'
  | 'CIRCULAR_HIERARCHY'
  | 'REFERENCED_BY_ACTIVE_RECORDS'
  | 'ARCHIVED_MACHINE_REF'
  | 'NEGATIVE_STOCK_BALANCE'
  | 'INVALID_FSM_STATE'
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
// 2. ASSETS_MACHINES BUNDLE SCHEMAS (Level 1 Live Assets Layer)
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
// 3. REF_PDR BUNDLE SCHEMAS (Level 2 Stock Catalog Layer via pdrExcelValidator)
// ============================================================================

export interface RefPdrBundleInput {
  bundleType?: 'REF_PDR';
  groups?: Array<Record<string, unknown>>;
  types?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface RefPdrStagingResult {
  nextGroups: PdrGroup[];
  nextTypes: StockType[];
  nextStock: IStockItem[];
  nextDesignations: IPartDesignation[];
}

// ============================================================================
// 4. PIPELINE OPTIONS & CONTEXT
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
  existingUsers?: IUserRecord[];
  existingPdrGroups?: PdrGroup[];
  existingStockTypes?: StockType[];
  existingStock?: IStockItem[];
  existingMouvements?: IMouvement[];
  existingPreventiveTasks?: PreventiveTaskItem[];
  existingCorrectiveInterventions?: CorrectiveInterventionItem[];
  existingWarehouseItems?: IWarehouseItem[];
}
