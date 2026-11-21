/**
 * @file spreadsheetSanitize.ts
 * @module utils/spreadsheetSanitize
 * @description
 * Neutralizes spreadsheet formula injection triggers (=, +, -, @, \t, \r)
 * on string cells before exporting CSV or XLSX worksheets, while preserving
 * native numeric and boolean cell types for spreadsheet aggregations.
 */

const FORMULA_TRIGGER_REGEX = /^(?:[\t\r]|[ ]*[=+\-@])/;

/**
 * Sanitizes a single spreadsheet cell value.
 * - Numbers and booleans are preserved natively (preventing numeric sum breakage).
 * - Null/undefined normalize to empty string `''`.
 * - Single standalone dash `'-'` is preserved as a visual empty marker.
 * - Strings starting with `=`, `+`, `-`, `@`, `\t`, `\r` (or spaces followed by `=`, `+`, `-`, `@`)
 *   are prefixed with a single quote `'` so Excel / LibreOffice / Google Sheets treat them strictly as text.
 */
export function sanitizeSpreadsheetCell<T>(value: T): T | string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const str = String(value);
  if (str === '-' || str === '—') return str;
  if (FORMULA_TRIGGER_REGEX.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Sanitizes a 2D array of rows prior to `XLSX.utils.aoa_to_sheet` or CSV serialization.
 */
export function sanitizeSpreadsheetRows<T extends readonly (readonly unknown[])[]>(rows: T): unknown[][] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) =>
    Array.isArray(row) ? row.map((cell) => sanitizeSpreadsheetCell(cell)) : []
  );
}

/**
 * Formats and escapes a single cell for CSV output with formula-injection neutralization.
 */
export function sanitizeCsvCell(value: unknown): string {
  const safe = sanitizeSpreadsheetCell(value);
  return `"${String(safe ?? '').replace(/"/g, '""')}"`;
}
