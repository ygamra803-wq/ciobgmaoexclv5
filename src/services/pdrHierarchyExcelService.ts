import * as XLSX from 'xlsx';
import type { IStockItem, MaterialPolicyTag, PdrGroup, StockType } from '../types/domain';
import { DataGateway } from '../application/DataGateway';
import { useGmaoStore } from '../store/useGmaoStore';
import { getEffectivePdrPolicyTags, resolvePdrHierarchy } from '../domain/stock/pdrHierarchyService';

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
  nextDesignations: any[];
}

export interface PdrCatalogRawSheets {
  groups?: Record<string, any>[];
  types?: Record<string, any>[];
  items?: Record<string, any>[];
}

export interface PdrCatalogValidationOptions {
  mode?: PdrCatalogImportMode;
  actorRole?: string;
  hasStockEditPermission?: boolean;
  existingGroups?: ReadonlyArray<PdrGroup>;
  existingTypes?: ReadonlyArray<StockType>;
  existingStock?: ReadonlyArray<IStockItem>;
  existingMouvements?: ReadonlyArray<any>;
}

export const PDR_EXCEL_SHEETS = {
  GROUPS: 'PDR_GROUPS',
  TYPES: 'PDR_TYPES',
  ITEMS: 'PDR_ITEMS',
} as const;

/**
 * Parses boolean flags from Excel cells (true/false, 1/0, OUI/NON, YES/NO).
 */
export function parseExcelBoolean(val: unknown, defaultValue = true): boolean {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const norm = String(val).trim().toUpperCase();
  if (['FALSE', '0', 'NON', 'NO', 'INACTIF', 'N'].includes(norm)) return false;
  if (['TRUE', '1', 'OUI', 'YES', 'ACTIF', 'Y'].includes(norm)) return true;
  return defaultValue;
}

/**
 * Parses pipe/semicolon/comma-delimited policy_tags for PDR items or groups.
 * Enforces the PDR invariant: empty or non-REPLACING tags default to ['REPLACING'].
 */
export function parsePdrExcelPolicyTags(raw: unknown): MaterialPolicyTag[] {
  if (Array.isArray(raw)) {
    const hasReplacing = raw.some((t) => String(t || '').trim().toUpperCase() === 'REPLACING');
    return hasReplacing ? ['REPLACING'] : ['REPLACING'];
  }
  const str = String(raw ?? '').trim();
  if (!str) return ['REPLACING'];
  const tokens = str
    .split(/[|;,]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (tokens.includes('REPLACING')) {
    return ['REPLACING'];
  }
  return ['REPLACING'];
}

/**
 * Derives a deterministic canonical group ID (`GRP-{CODE}`) when `id` is not explicitly provided.
 */
export function derivePdrGroupId(code: string, explicitId?: string): string {
  const cleanExplicit = String(explicitId || '').trim();
  if (cleanExplicit) return cleanExplicit;
  const cleanCode = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  return cleanCode.startsWith('GRP-') ? cleanCode : `GRP-${cleanCode}`;
}

/**
 * Builds canonical export rows for the 3-sheet PDR catalog workbook (`PDR_GROUPS`, `PDR_TYPES`, `PDR_ITEMS`)
 * from live store state (`pdrGroups`, `types`, `rawStock`).
 */
export function buildPdrCatalogRows(state: {
  pdrGroups?: ReadonlyArray<PdrGroup>;
  types?: ReadonlyArray<StockType>;
  rawStock?: ReadonlyArray<IStockItem>;
}): {
  groupRows: PdrGroupExcelRow[];
  typeRows: PdrTypeExcelRow[];
  itemRows: PdrItemExcelRow[];
} {
  const groups = Array.isArray(state.pdrGroups) ? state.pdrGroups : [];
  const types = Array.isArray(state.types) ? state.types : [];
  const stock = Array.isArray(state.rawStock) ? state.rawStock : [];

  const groupById = new Map<string, PdrGroup>();
  for (const g of groups) {
    if (g && g.id) {
      groupById.set(String(g.id).trim().toUpperCase(), g);
      if (g.code) {
        groupById.set(String(g.code).trim().toUpperCase(), g);
      }
    }
  }

  const groupRows: PdrGroupExcelRow[] = [...groups]
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .map((g, idx) => ({
      id: g.id,
      code: g.code || String(g.id).replace(/^GRP-/i, ''),
      libelle: g.libelle || g.code || g.id,
      description: g.description || '',
      default_policy_tags: (g.default_policy_tags && g.default_policy_tags.length > 0
        ? g.default_policy_tags
        : ['REPLACING']
      ).join('|'),
      sort_order: typeof g.sort_order === 'number' ? g.sort_order : (idx + 1) * 10,
      is_active: g.is_active !== false,
    }));

  const typeRows: PdrTypeExcelRow[] = types.map((t) => {
    const matchedGrp = t.id_group ? groupById.get(String(t.id_group).trim().toUpperCase()) : undefined;
    return {
      code_type: t.id_type,
      libelle: t.libelle || t.id_type,
      group_code: matchedGrp ? matchedGrp.code : t.id_group || '',
      is_active: t.is_active !== false,
    };
  });

  const itemRows: PdrItemExcelRow[] = stock.map((item) => {
    const resolved = resolvePdrHierarchy(item, groups, types);
    const effectiveTags = getEffectivePdrPolicyTags(item, resolved.group);
    return {
      ref: item.ref,
      designation: item.designation || '',
      type_code_or_id: resolved.type?.id_type || item.id_type || item.type || '',
      group_code: resolved.group?.code || item.id_group || '',
      seuil: Number(item.seuil ?? 0),
      emplacement: item.emplacement || '',
      stockInitial: Number(item.stockInitial ?? 0),
      prix_unitaire: Number(item.prix_unitaire ?? 0),
      policy_tags: effectiveTags.join('|'),
      stockActuel_info: Number(
        item.stockActuel ??
          Number(item.stockInitial || 0) + Number(item.entrees || 0) - Number(item.sorties || 0)
      ),
    };
  });

  return { groupRows, typeRows, itemRows };
}

/**
 * Builds an in-memory multi-sheet `XLSX.WorkBook` containing `PDR_GROUPS`, `PDR_TYPES`, and `PDR_ITEMS`.
 */
export function buildPdrCatalogWorkbook(state: {
  pdrGroups?: ReadonlyArray<PdrGroup>;
  types?: ReadonlyArray<StockType>;
  rawStock?: ReadonlyArray<IStockItem>;
}): XLSX.WorkBook {
  const { groupRows, typeRows, itemRows } = buildPdrCatalogRows(state);
  const wb = XLSX.utils.book_new();

  const wsGroups = XLSX.utils.json_to_sheet(
    groupRows.length > 0
      ? groupRows
      : [
          {
            id: 'GRP-ROUL',
            code: 'ROUL',
            libelle: 'Roulements & Paliers',
            description: 'Exemple de groupe PDR',
            default_policy_tags: 'REPLACING',
            sort_order: 10,
            is_active: true,
          },
        ]
  );
  wsGroups['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 28 },
    { wch: 45 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
  ];

  const wsTypes = XLSX.utils.json_to_sheet(
    typeRows.length > 0
      ? typeRows
      : [
          {
            code_type: 'TYP-RLM-BILLE',
            libelle: 'Roulement à billes',
            group_code: 'ROUL',
            is_active: true,
          },
        ]
  );
  wsTypes['!cols'] = [{ wch: 20 }, { wch: 34 }, { wch: 16 }, { wch: 12 }];

  const wsItems = XLSX.utils.json_to_sheet(
    itemRows.length > 0
      ? itemRows
      : [
          {
            ref: 'RLM-6205',
            designation: 'Roulement rigide à billes 6205-2RS',
            type_code_or_id: 'TYP-RLM-BILLE',
            group_code: 'ROUL',
            seuil: 5,
            emplacement: 'MAG-A-01',
            stockInitial: 10,
            prix_unitaire: 14.5,
            policy_tags: 'REPLACING',
            stockActuel_info: 10,
          },
        ]
  );
  wsItems['!cols'] = [
    { wch: 18 },
    { wch: 38 },
    { wch: 20 },
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, wsGroups, PDR_EXCEL_SHEETS.GROUPS);
  XLSX.utils.book_append_sheet(wb, wsTypes, PDR_EXCEL_SHEETS.TYPES);
  XLSX.utils.book_append_sheet(wb, wsItems, PDR_EXCEL_SHEETS.ITEMS);

  return wb;
}

/**
 * Triggers a browser download of the 3-sheet `.xlsx` PDR Catalog workbook from live store state.
 */
export function downloadPdrCatalogWorkbook(
  state: {
    pdrGroups?: ReadonlyArray<PdrGroup>;
    types?: ReadonlyArray<StockType>;
    rawStock?: ReadonlyArray<IStockItem>;
  },
  fileNamePrefix = 'GMAO_Catalogue_PDR_Hierarchique'
): string {
  const wb = buildPdrCatalogWorkbook(state);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `${fileNamePrefix}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}

/**
 * Parses an `.xlsx` ArrayBuffer into raw sheet arrays (`groups`, `types`, `items`).
 */
export function parsePdrCatalogWorkbookBuffer(buffer: ArrayBuffer): PdrCatalogRawSheets {
  const wb = XLSX.read(buffer, { type: 'array' });
  const findSheet = (candidates: string[]): XLSX.WorkSheet | undefined => {
    for (const name of wb.SheetNames) {
      const upper = name.trim().toUpperCase();
      if (candidates.some((c) => c.toUpperCase() === upper)) {
        return wb.Sheets[name];
      }
    }
    return undefined;
  };

  const wsGroups = findSheet([PDR_EXCEL_SHEETS.GROUPS, 'GROUPS', 'GROUPES_PDR', 'GROUPES']);
  const wsTypes = findSheet([PDR_EXCEL_SHEETS.TYPES, 'TYPES', 'TYPES_PDR', 'STOCK_TYPES']);
  const wsItems = findSheet([PDR_EXCEL_SHEETS.ITEMS, 'ITEMS', 'ARTICLES_PDR', 'PDR_ARTICLES', 'ARTICLES']);

  return {
    groups: wsGroups ? XLSX.utils.sheet_to_json<Record<string, any>>(wsGroups, { defval: '' }) : [],
    types: wsTypes ? XLSX.utils.sheet_to_json<Record<string, any>>(wsTypes, { defval: '' }) : [],
    items: wsItems ? XLSX.utils.sheet_to_json<Record<string, any>>(wsItems, { defval: '' }) : [],
  };
}

/**
 * Validates and reconciles 3-tier PDR catalog sheets (`Groups -> Types -> Items`)
 * under either `MERGE` (default) or `REPLACE_CATALOG` (ADMIN only + movement FK protection).
 *
 * Architectural Guarantees:
 * 1. Ordered validation: `1) Groups -> 2) Types -> 3) Items`.
 * 2. Orphan `group_code` on a Type produces an explicit row error (never silent).
 * 3. Duplicate `ref` in `PDR_ITEMS` or `code` in `PDR_GROUPS` or `code_type` in `PDR_TYPES` produces a row error.
 * 4. `item.group !== type.group` produces an explicit row error.
 * 5. Empty `policy_tags` deterministically defaults to `['REPLACING']`.
 * 6. `stockActuel` / `stockActuel_info` in the sheet is ignored for operational stock math (`stockInitial` + movements remain SSOT).
 * 7. In `REPLACE_CATALOG`, if any existing `rawStock` item absent from the import has linked `mouvements`,
 *    deletion is refused with a critical error so movement foreign keys are never broken.
 */
export function validateAndReconcilePdrCatalogImport(
  rawSheets: PdrCatalogRawSheets,
  options: PdrCatalogValidationOptions = {}
): PdrCatalogImportReport {
  const mode: PdrCatalogImportMode = options.mode === 'REPLACE_CATALOG' ? 'REPLACE_CATALOG' : 'MERGE';
  const actorRole = String(options.actorRole || 'ADMIN').trim().toUpperCase();
  const hasStockEdit = options.hasStockEditPermission !== false;

  const existingGroups = Array.isArray(options.existingGroups) ? [...options.existingGroups] : [];
  const existingTypes = Array.isArray(options.existingTypes) ? [...options.existingTypes] : [];
  const existingStock = Array.isArray(options.existingStock) ? [...options.existingStock] : [];
  const existingMouvements = Array.isArray(options.existingMouvements) ? options.existingMouvements : [];

  const errors: PdrCatalogImportError[] = [];
  const created: PdrCatalogImportCounts = { groups: 0, types: 0, items: 0, total: 0 };
  const updated: PdrCatalogImportCounts = { groups: 0, types: 0, items: 0, total: 0 };
  const skipped: PdrCatalogImportCounts = { groups: 0, types: 0, items: 0, total: 0 };

  const emptyFailure = (): PdrCatalogImportReport => ({
    success: false,
    mode,
    created,
    updated,
    skipped,
    errors,
    nextGroups: existingGroups,
    nextTypes: existingTypes,
    nextStock: existingStock,
    nextDesignations: [],
  });

  // RBAC Guard
  if (mode === 'REPLACE_CATALOG' && actorRole !== 'ADMIN') {
    errors.push({
      sheet: 'GLOBAL',
      row: 0,
      message: 'Accès refusé : le mode REPLACE_CATALOG est strictement réservé au rôle ADMIN.',
    });
    return emptyFailure();
  }

  if (!hasStockEdit && actorRole !== 'ADMIN') {
    errors.push({
      sheet: 'GLOBAL',
      row: 0,
      message: 'Accès refusé : permission stock.edit ou rôle ADMIN requis pour importer le catalogue PDR.',
    });
    return emptyFailure();
  }

  const rawGroups = Array.isArray(rawSheets?.groups) ? rawSheets.groups : [];
  const rawTypes = Array.isArray(rawSheets?.types) ? rawSheets.types : [];
  const rawItems = Array.isArray(rawSheets?.items) ? rawSheets.items : [];

  if (rawGroups.length === 0 && rawTypes.length === 0 && rawItems.length === 0) {
    errors.push({
      sheet: 'GLOBAL',
      row: 0,
      message: 'Aucune donnée trouvée dans les feuilles PDR_GROUPS, PDR_TYPES ou PDR_ITEMS.',
    });
    return emptyFailure();
  }

  // =========================================================================
  // STEP 1: GROUPS (PDR_GROUPS)
  // =========================================================================
  // Map of valid groups by uppercase ID and uppercase CODE
  const workingGroupsById = new Map<string, PdrGroup>();
  const workingGroupsByCode = new Map<string, PdrGroup>();

  if (mode === 'MERGE') {
    for (const g of existingGroups) {
      if (!g || !g.id) continue;
      workingGroupsById.set(String(g.id).trim().toUpperCase(), { ...g });
      if (g.code) {
        workingGroupsByCode.set(String(g.code).trim().toUpperCase(), { ...g });
      }
    }
  }

  const seenFileGroupCodes = new Set<string>();
  const seenFileGroupIds = new Set<string>();

  rawGroups.forEach((row, idx) => {
    const excelRowNum = idx + 2; // Row 1 is header
    const rawCode = String(row.code ?? row.CODE ?? '').trim().toUpperCase();
    const rawLibelle = String(row.libelle ?? row.LIBELLE ?? '').trim();
    const rawId = String(row.id ?? row.ID ?? '').trim();

    if (!rawCode && !rawLibelle && !rawId) {
      skipped.groups++;
      return;
    }

    if (!rawCode) {
      errors.push({
        sheet: 'PDR_GROUPS',
        row: excelRowNum,
        identifier: rawId || rawLibelle,
        message: `Ligne ${excelRowNum} (PDR_GROUPS) : le champ 'code' est obligatoire.`,
      });
      skipped.groups++;
      return;
    }

    if (!rawLibelle) {
      errors.push({
        sheet: 'PDR_GROUPS',
        row: excelRowNum,
        identifier: rawCode,
        message: `Ligne ${excelRowNum} (PDR_GROUPS) : le champ 'libelle' est obligatoire pour le groupe '${rawCode}'.`,
      });
      skipped.groups++;
      return;
    }

    const derivedId = derivePdrGroupId(rawCode, rawId);
    const normId = derivedId.toUpperCase();

    if (seenFileGroupCodes.has(rawCode) || seenFileGroupIds.has(normId)) {
      errors.push({
        sheet: 'PDR_GROUPS',
        row: excelRowNum,
        identifier: rawCode,
        message: `Ligne ${excelRowNum} (PDR_GROUPS) : code groupe dupliqué '${rawCode}' dans le fichier.`,
      });
      skipped.groups++;
      return;
    }
    seenFileGroupCodes.add(rawCode);
    seenFileGroupIds.add(normId);

    const existingMatch =
      workingGroupsByCode.get(rawCode) || workingGroupsById.get(normId) || null;

    const canonicalId = existingMatch ? existingMatch.id : derivedId;
    const sortOrderNum = Number(row.sort_order ?? row.SORT_ORDER);
    const groupRecord: PdrGroup = {
      id: canonicalId,
      code: rawCode,
      libelle: rawLibelle,
      description: String(row.description ?? row.DESCRIPTION ?? existingMatch?.description ?? '').trim(),
      default_policy_tags: parsePdrExcelPolicyTags(
        row.default_policy_tags ?? row.DEFAULT_POLICY_TAGS ?? existingMatch?.default_policy_tags
      ),
      sort_order: Number.isFinite(sortOrderNum) && sortOrderNum > 0 ? sortOrderNum : (idx + 1) * 10,
      is_active: parseExcelBoolean(row.is_active ?? row.IS_ACTIVE, true),
    };

    if (existingMatch) {
      updated.groups++;
    } else {
      created.groups++;
    }

    workingGroupsById.set(String(canonicalId).trim().toUpperCase(), groupRecord);
    workingGroupsByCode.set(rawCode, groupRecord);
  });

  // Helper to resolve a group reference (by code like 'ROUL' or id like 'GRP-ROUL')
  const resolveGroupRef = (groupRefRaw: string): PdrGroup | null => {
    const key = String(groupRefRaw || '').trim().toUpperCase();
    if (!key) return null;
    return (
      workingGroupsByCode.get(key) ||
      workingGroupsById.get(key) ||
      workingGroupsById.get(`GRP-${key}`) ||
      null
    );
  };

  // =========================================================================
  // STEP 2: TYPES (PDR_TYPES)
  // =========================================================================
  const workingTypesById = new Map<string, StockType>();
  const workingTypesByLabel = new Map<string, StockType>();

  if (mode === 'MERGE') {
    for (const t of existingTypes) {
      if (!t || !t.id_type) continue;
      workingTypesById.set(String(t.id_type).trim().toUpperCase(), { ...t });
      if (t.libelle) {
        workingTypesByLabel.set(String(t.libelle).trim().toUpperCase(), { ...t });
      }
    }
  }

  const seenFileTypeCodes = new Set<string>();

  rawTypes.forEach((row, idx) => {
    const excelRowNum = idx + 2;
    const rawCodeType = String(
      row.code_type ?? row.id_type ?? row.CODE_TYPE ?? row.ID_TYPE ?? ''
    ).trim();
    const rawLibelle = String(row.libelle ?? row.LIBELLE ?? '').trim();
    const rawGroupCode = String(
      row.group_code ?? row.id_group ?? row.GROUP_CODE ?? row.ID_GROUP ?? ''
    ).trim();

    if (!rawCodeType && !rawLibelle && !rawGroupCode) {
      skipped.types++;
      return;
    }

    if (!rawCodeType) {
      errors.push({
        sheet: 'PDR_TYPES',
        row: excelRowNum,
        identifier: rawLibelle,
        message: `Ligne ${excelRowNum} (PDR_TYPES) : le champ 'code_type' est obligatoire.`,
      });
      skipped.types++;
      return;
    }

    const normTypeCode = rawCodeType.toUpperCase();
    if (seenFileTypeCodes.has(normTypeCode)) {
      errors.push({
        sheet: 'PDR_TYPES',
        row: excelRowNum,
        identifier: rawCodeType,
        message: `Ligne ${excelRowNum} (PDR_TYPES) : 'code_type' dupliqué '${rawCodeType}' dans le fichier.`,
      });
      skipped.types++;
      return;
    }
    seenFileTypeCodes.add(normTypeCode);

    if (!rawGroupCode) {
      errors.push({
        sheet: 'PDR_TYPES',
        row: excelRowNum,
        identifier: rawCodeType,
        message: `Ligne ${excelRowNum} (PDR_TYPES) : 'group_code' manquant pour le type '${rawCodeType}'.`,
      });
      skipped.types++;
      return;
    }

    const targetGroup = resolveGroupRef(rawGroupCode);
    if (!targetGroup) {
      errors.push({
        sheet: 'PDR_TYPES',
        row: excelRowNum,
        identifier: rawCodeType,
        message: `Ligne ${excelRowNum} (PDR_TYPES) : 'group_code' introuvable ('${rawGroupCode}') pour le type '${rawCodeType}'.`,
      });
      skipped.types++;
      return;
    }

    const existingType = workingTypesById.get(normTypeCode) || null;
    const typeRecord: StockType = {
      id_type: existingType ? existingType.id_type : rawCodeType,
      libelle: rawLibelle || existingType?.libelle || rawCodeType,
      id_group: targetGroup.id,
      is_active: parseExcelBoolean(row.is_active ?? row.IS_ACTIVE, true),
    };

    if (existingType) {
      updated.types++;
    } else {
      created.types++;
    }

    workingTypesById.set(String(typeRecord.id_type).trim().toUpperCase(), typeRecord);
    if (typeRecord.libelle) {
      workingTypesByLabel.set(String(typeRecord.libelle).trim().toUpperCase(), typeRecord);
    }
  });

  // Helper to resolve a type reference (by code_type / id_type or libelle)
  const resolveTypeRef = (typeRefRaw: string): StockType | null => {
    const key = String(typeRefRaw || '').trim().toUpperCase();
    if (!key) return null;
    return workingTypesById.get(key) || workingTypesByLabel.get(key) || null;
  };

  // =========================================================================
  // STEP 3: ITEMS (PDR_ITEMS)
  // =========================================================================
  const existingStockByRef = new Map<string, IStockItem>();
  for (const item of existingStock) {
    if (!item || !item.ref) continue;
    existingStockByRef.set(String(item.ref).trim().toUpperCase(), item);
  }

  const workingStockByRef = new Map<string, IStockItem>();
  if (mode === 'MERGE') {
    for (const [k, v] of existingStockByRef.entries()) {
      workingStockByRef.set(k, { ...v });
    }
  }

  const seenFileRefs = new Set<string>();
  let nextNumericId =
    existingStock.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;

  rawItems.forEach((row, idx) => {
    const excelRowNum = idx + 2;
    const rawRef = String(row.ref ?? row.REF ?? '').trim();
    const rawDesignation = String(row.designation ?? row.DESIGNATION ?? '').trim();
    const rawTypeRef = String(
      row.type_code_or_id ?? row.id_type ?? row.type ?? row.TYPE_CODE_OR_ID ?? row.ID_TYPE ?? ''
    ).trim();
    const rawGroupRef = String(
      row.group_code ?? row.id_group ?? row.GROUP_CODE ?? row.ID_GROUP ?? ''
    ).trim();

    if (!rawRef && !rawDesignation && !rawTypeRef && !rawGroupRef) {
      skipped.items++;
      return;
    }

    if (!rawRef) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawDesignation || `Row-${excelRowNum}`,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : le champ 'ref' est obligatoire.`,
      });
      skipped.items++;
      return;
    }

    const normRef = rawRef.toUpperCase();
    if (seenFileRefs.has(normRef)) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawRef,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : référence 'ref' dupliquée ('${rawRef}') dans le fichier.`,
      });
      skipped.items++;
      return;
    }
    seenFileRefs.add(normRef);

    if (!rawDesignation) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawRef,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : 'designation' obligatoire pour l'article '${rawRef}'.`,
      });
      skipped.items++;
      return;
    }

    if (!rawTypeRef) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawRef,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : 'type_code_or_id' obligatoire pour l'article '${rawRef}'.`,
      });
      skipped.items++;
      return;
    }

    const matchedType = resolveTypeRef(rawTypeRef);
    if (!matchedType) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawRef,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : type '${rawTypeRef}' introuvable pour l'article '${rawRef}'.`,
      });
      skipped.items++;
      return;
    }

    const typeGroup = matchedType.id_group ? resolveGroupRef(matchedType.id_group) : null;
    if (!typeGroup) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawRef,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : le type '${matchedType.id_type}' n'est rattaché à aucun groupe valide.`,
      });
      skipped.items++;
      return;
    }

    if (rawGroupRef) {
      const explicitGroup = resolveGroupRef(rawGroupRef);
      if (!explicitGroup) {
        errors.push({
          sheet: 'PDR_ITEMS',
          row: excelRowNum,
          identifier: rawRef,
          message: `Ligne ${excelRowNum} (PDR_ITEMS) : 'group_code' ('${rawGroupRef}') introuvable pour l'article '${rawRef}'.`,
        });
        skipped.items++;
        return;
      }
      if (String(explicitGroup.id).toUpperCase() !== String(typeGroup.id).toUpperCase()) {
        errors.push({
          sheet: 'PDR_ITEMS',
          row: excelRowNum,
          identifier: rawRef,
          message: `Ligne ${excelRowNum} (PDR_ITEMS) : incohérence hiérarchique pour '${rawRef}' — le groupe de l'article ('${explicitGroup.code}') diffère du groupe du type '${matchedType.id_type}' ('${typeGroup.code}').`,
        });
        skipped.items++;
        return;
      }
    }

    const existingItem = existingStockByRef.get(normRef) || null;
    const stockInitialVal = Math.max(0, Number(row.stockInitial ?? existingItem?.stockInitial ?? 0) || 0);
    const seuilVal = Math.max(0, Number(row.seuil ?? existingItem?.seuil ?? 0) || 0);
    const prixVal = Math.max(0, Number(row.prix_unitaire ?? existingItem?.prix_unitaire ?? 0) || 0);
    const emplacementVal =
      String(row.emplacement ?? existingItem?.emplacement ?? 'Magasin PDR').trim() || 'Magasin PDR';

    const policyTags = parsePdrExcelPolicyTags(row.policy_tags ?? row.POLICY_TAGS);

    // Note: stockActuel in Excel is strictly informational and NEVER overrides movement math
    const entreesPreserve = Number(existingItem?.entrees ?? 0);
    const sortiesPreserve = Number(existingItem?.sorties ?? 0);
    const computedActuel = stockInitialVal + entreesPreserve - sortiesPreserve;

    const itemRecord: IStockItem = {
      ...(existingItem || {}),
      id: existingItem?.id ?? nextNumericId++,
      ref: existingItem ? existingItem.ref : rawRef,
      designation: rawDesignation,
      id_group: typeGroup.id,
      id_type: matchedType.id_type,
      type: matchedType.libelle || matchedType.id_type,
      stockInitial: stockInitialVal,
      entrees: entreesPreserve,
      sorties: sortiesPreserve,
      stockActuel: computedActuel,
      seuil: seuilVal,
      emplacement: emplacementVal,
      prix_unitaire: prixVal,
      policy_tags: policyTags,
    };

    if (existingItem) {
      updated.items++;
    } else {
      created.items++;
    }

    workingStockByRef.set(normRef, itemRecord);
  });

  // =========================================================================
  // STEP 4: REPLACE_CATALOG MOVEMENT FK GUARD
  // =========================================================================
  if (mode === 'REPLACE_CATALOG') {
    const movRefs = new Set<string>();
    for (const mov of existingMouvements) {
      const r = String(mov?.ref || '').trim().toUpperCase();
      if (r) movRefs.add(r);
    }

    const orphanedMovRefs: string[] = [];
    for (const [normRef, oldItem] of existingStockByRef.entries()) {
      if (!workingStockByRef.has(normRef) && movRefs.has(normRef)) {
        orphanedMovRefs.push(oldItem.ref);
      }
    }

    if (orphanedMovRefs.length > 0) {
      errors.push({
        sheet: 'GLOBAL',
        row: 0,
        identifier: orphanedMovRefs.join(', '),
        message: `Remplacement refusé (Protection FK Mouvements) : ${orphanedMovRefs.length} référence(s) supprimée(s) du catalogue possèdent des mouvements historiques (${orphanedMovRefs.slice(0, 5).join(', ')}). Utilisez le mode MERGE ou conservez ces références.`,
      });
      return emptyFailure();
    }
  }

  created.total = created.groups + created.types + created.items;
  updated.total = updated.groups + updated.types + updated.items;
  skipped.total = skipped.groups + skipped.types + skipped.items;

  // If critical errors prevented any record from being created/updated, mark success = false
  const hasAnyValidMutation = created.total > 0 || updated.total > 0;
  const success = errors.length === 0 && hasAnyValidMutation;

  if (!success && !hasAnyValidMutation) {
    return emptyFailure();
  }

  const nextGroups = Array.from(workingGroupsById.values()).sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
  );
  const nextTypes = Array.from(workingTypesById.values());
  const nextStock = Array.from(workingStockByRef.values());
  const nextDesignations = nextStock.map((s) => ({
    id: s.id || s.ref,
    ref: s.ref,
    designation: s.designation,
    id_group: s.id_group || null,
    id_type: s.id_type || s.type,
    type: s.type,
    stockInitial: s.stockInitial,
    seuil: s.seuil,
    emplacement: s.emplacement,
  }));

  return {
    success: errors.length === 0,
    mode,
    created,
    updated,
    skipped,
    errors,
    nextGroups,
    nextTypes,
    nextStock,
    nextDesignations,
  };
}

/**
 * Commits a validated PDR catalog import report to `DataGateway` and `useGmaoStore`
 * in strict `Groups -> Types -> Items` order without invoking `loadDemoData` or changing `START_MODE`.
 */
export function applyPdrCatalogImportToStore(report: PdrCatalogImportReport): boolean {
  if (!report || (report.created.total === 0 && report.updated.total === 0)) {
    return false;
  }

  // Persist in strict hierarchy order: Groups -> Types -> Items -> Designations
  DataGateway.savePdrGroups(report.nextGroups);
  DataGateway.saveStockTypes(report.nextTypes);
  DataGateway.saveStock(report.nextStock);
  DataGateway.saveDesignations(report.nextDesignations);

  const store = useGmaoStore.getState();
  store.setPdrGroups(report.nextGroups);
  store.setTypes(report.nextTypes);
  store.setRawStock(report.nextStock);
  store.setDesignations(report.nextDesignations);

  return true;
}
