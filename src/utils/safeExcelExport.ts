import * as XLSX from 'xlsx';

/**
 * Neutralizes spreadsheet formula injection (CSV/Excel DDE / formula prefixes)
 * on untrusted string cells while preserving numeric and boolean values.
 */
export function sanitizeExcelCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;

  const str = String(value);
  if (str.length === 0) return '';

  // Neutralize leading formula triggers (=, +, -, @, TAB, CR) per OWASP CSV/Excel Injection guidance
  let idx = 0;
  while (idx < str.length) {
    const code = str.charCodeAt(idx);
    // Skip leading ASCII control characters except TAB (9), LF (10), CR (13)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      idx++;
    } else {
      break;
    }
  }
  const firstSignificant = str.slice(idx);
  if (/^[=+\-@\t\r]/.test(firstSignificant)) {
    return `'${str}`;
  }
  return str;
}

export function sanitizeAoaRows(rows: unknown[][]): Array<Array<string | number | boolean>> {
  return rows.map((row) => row.map((cell) => sanitizeExcelCell(cell)));
}

export function sanitizeJsonRecords(
  records: Array<Record<string, unknown>>
): Array<Record<string, string | number | boolean>> {
  return records.map((rec) => {
    const clean: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(rec || {})) {
      clean[k] = sanitizeExcelCell(v);
    }
    return clean;
  });
}

export interface TypeBExcelSheetSpec {
  name: string;
  headers?: string[];
  rows?: unknown[][];
  jsonRows?: Array<Record<string, unknown>>;
}

export interface TypeBExcelExportOptions {
  filename: string;
  screenName: string;
  sheets: TypeBExcelSheetSpec[];
}

/**
 * Exports a sanitized Type B operational Excel workbook (.xlsx)
 * with formula-injection protection and the canonical `README_TYPE_B` marker sheet
 * so `UnifiedImportPipeline` / guarded imports cleanly identify it as non-reimportable.
 */
export function exportTypeBWorkbook({
  filename,
  screenName,
  sheets,
}: TypeBExcelExportOptions): void {
  const wb = XLSX.utils.book_new();
  const generatedAt = new Date().toISOString();

  for (const spec of sheets) {
    const safeSheetName = String(spec.name || 'Export').slice(0, 31);
    let ws: XLSX.WorkSheet;
    if (Array.isArray(spec.jsonRows)) {
      ws = XLSX.utils.json_to_sheet(sanitizeJsonRecords(spec.jsonRows));
    } else {
      const aoa: unknown[][] = [];
      if (Array.isArray(spec.headers) && spec.headers.length > 0) {
        aoa.push(spec.headers);
      }
      if (Array.isArray(spec.rows)) {
        aoa.push(...spec.rows);
      }
      ws = XLSX.utils.aoa_to_sheet(sanitizeAoaRows(aoa));
    }
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  }

  // Canonical Type B metadata sheet (AGENTS.md §1.2)
  const readmeRows = [
    ['EXPORT_TYPE', 'TYPE_B_OPERATIONAL_NON_REIMPORTABLE'],
    ['SOURCE_SCREEN', sanitizeExcelCell(screenName)],
    ['GENERATED_AT', generatedAt],
    [
      'WARNING',
      'Export opérationnel (Type B) destiné au reporting / impression uniquement. Non réimportable dans le GMAO.',
    ],
  ];
  const readmeWs = XLSX.utils.aoa_to_sheet(readmeRows);
  XLSX.utils.book_append_sheet(wb, readmeWs, 'README_TYPE_B');

  XLSX.writeFile(wb, filename);
}
