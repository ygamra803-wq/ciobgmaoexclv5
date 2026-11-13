import * as XLSX from 'xlsx';
import type { IStockItem, PdrGroup, StockType } from '../../types/domain';
import { getEffectivePdrPolicyTags, resolvePdrHierarchy } from '../../domain/stock/pdrHierarchyService';
import {
  PDR_EXCEL_SHEETS,
  type PdrGroupExcelRow,
  type PdrItemExcelRow,
  type PdrTypeExcelRow,
} from './types/pdrExcelTypes';

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
      domaine_technique: g.domaine_technique || '',
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
      domaine_technique: t.domaine_technique || matchedGrp?.domaine_technique || '',
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
      unite_mesure: String(item.unite_mesure || item.unite || 'PCS').trim().toUpperCase(),
      criticite: String(item.criticite || 'B').trim().toUpperCase(),
      ref_constructeur: item.ref_constructeur || '',
      code_equivalents: item.code_equivalents || item.equivalences || '',
      delai_appro_jours: Number(item.delai_appro_jours ?? 0),
      domaine_technique:
        item.domaine_technique ||
        resolved.type?.domaine_technique ||
        resolved.group?.domaine_technique ||
        '',
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
            unite_mesure: 'PCS',
            criticite: 'A',
            ref_constructeur: 'SKF 6205-2RSH/C3',
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
    { wch: 12 },
    { wch: 10 },
    { wch: 24 },
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
