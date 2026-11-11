import type { IStockItem, PdrGroup, StockType } from '../../../types/domain';

export type PdrCatalogImportMode = 'MERGE' | 'REPLACE_CATALOG';

export interface PdrGroupExcelRow {
  id?: string;
  code: string;
  libelle: string;
  description: string;
  default_policy_tags: string;
  sort_order: number;
  is_active: boolean;
}

export interface PdrTypeExcelRow {
  code_type: string;
  libelle: string;
  group_code: string;
  is_active: boolean;
}

export interface PdrItemExcelRow {
  ref: string;
  designation: string;
  type_code_or_id: string;
  group_code: string;
  seuil: number;
  emplacement: string;
  stockInitial: number;
  prix_unitaire: number;
  policy_tags: string;
  stockActuel_info?: number;
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
  nextDesignations: Array<Record<string, unknown>>;
}

export interface PdrCatalogRawSheets {
  groups?: Record<string, unknown>[];
  types?: Record<string, unknown>[];
  items?: Record<string, unknown>[];
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
