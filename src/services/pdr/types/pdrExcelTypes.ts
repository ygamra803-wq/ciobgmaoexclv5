import type {
  IPartDesignation,
  IStockItem,
  MaterialPolicyTag,
  PdrGroup,
  StockType,
} from '../../../types/domain';

export type PdrCatalogImportMode = 'MERGE' | 'REPLACE_CATALOG';

export interface PdrGroupExcelRow {
  id?: string;
  code: string;
  libelle: string;
  description: string;
  domaine_technique?: string;
  default_policy_tags: string | MaterialPolicyTag[];
  sort_order: number;
  is_active: boolean;
  [key: string]: unknown;
}

export interface PdrTypeExcelRow {
  code_type: string;
  libelle: string;
  group_code: string;
  domaine_technique?: string;
  is_active: boolean;
  [key: string]: unknown;
}

export interface PdrItemExcelRow {
  ref: string;
  designation: string;
  type_code_or_id: string;
  group_code: string;
  unite_mesure?: string;
  criticite?: string;
  ref_constructeur?: string;
  code_equivalents?: string;
  delai_appro_jours?: number;
  domaine_technique?: string;
  seuil: number;
  emplacement: string;
  stockInitial: number;
  prix_unitaire: number;
  policy_tags: string | MaterialPolicyTag[];
  stockActuel_info?: number;
  [key: string]: unknown;
}

export interface PdrCatalogImportError {
  sheet: 'PDR_GROUPS' | 'PDR_TYPES' | 'PDR_ITEMS' | 'GLOBAL';
  row: number;
  identifier?: string;
  message: string;
}

export interface PdrCatalogImportCounts {
  groups: number;
  types: number;
  items: number;
  total: number;
}

export interface PdrCatalogImportReport {
  success: boolean;
  mode: PdrCatalogImportMode;
  created: PdrCatalogImportCounts;
  updated: PdrCatalogImportCounts;
  skipped: PdrCatalogImportCounts;
  errors: PdrCatalogImportError[];
  nextGroups: PdrGroup[];
  nextTypes: StockType[];
  nextStock: IStockItem[];
  nextDesignations: IPartDesignation[];
}

export interface PdrCatalogRawSheets {
  groups?: Array<PdrGroupExcelRow | Record<string, unknown>>;
  types?: Array<PdrTypeExcelRow | Record<string, unknown>>;
  items?: Array<PdrItemExcelRow | Record<string, unknown>>;
}

export interface PdrCatalogValidationOptions {
  mode?: PdrCatalogImportMode;
  actorRole?: string;
  hasStockEditPermission?: boolean;
  existingGroups?: ReadonlyArray<PdrGroup>;
  existingTypes?: ReadonlyArray<StockType>;
  existingStock?: ReadonlyArray<IStockItem>;
  existingMouvements?: ReadonlyArray<Record<string, unknown>>;
}

export const PDR_EXCEL_SHEETS = {
  GROUPS: 'PDR_GROUPS',
  TYPES: 'PDR_TYPES',
  ITEMS: 'PDR_ITEMS',
} as const;
