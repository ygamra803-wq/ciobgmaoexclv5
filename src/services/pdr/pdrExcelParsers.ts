import * as XLSX from 'xlsx';
import type { MaterialPolicyTag } from '../../types/domain';
import { PDR_EXCEL_SHEETS, type PdrCatalogRawSheets } from './types/pdrExcelTypes';

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
 * Enforces the PDR invariant: empty or non-valid tags default to ['REPLACING'].
 */
export function parsePdrExcelPolicyTags(raw: unknown): MaterialPolicyTag[] {
  if (Array.isArray(raw)) {
    const valid = raw
      .map((t) => String(t ?? '').trim().toUpperCase())
      .filter((t): t is MaterialPolicyTag =>
        ['REPLACING', 'REPAIRABLE', 'MODIFYING'].includes(t as MaterialPolicyTag)
      );
    return valid.length > 0 ? valid : ['REPLACING'];
  }
  const str = String(raw ?? '').trim();
  if (!str) return ['REPLACING'];
  const tokens = str
    .split(/[|;,]/)
    .map((s) => s.trim().toUpperCase())
    .filter((t): t is MaterialPolicyTag =>
      ['REPLACING', 'REPAIRABLE', 'MODIFYING'].includes(t as MaterialPolicyTag)
    );
  return tokens.length > 0 ? tokens : ['REPLACING'];
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
    groups: wsGroups ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wsGroups, { defval: '' }) : [],
    types: wsTypes ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wsTypes, { defval: '' }) : [],
    items: wsItems ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wsItems, { defval: '' }) : [],
  };
}
