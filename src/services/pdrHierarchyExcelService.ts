/**
 * PDR 3-Sheet Hierarchical Excel Catalog Service (`PDR_GROUPS`, `PDR_TYPES`, `PDR_ITEMS`)
 * Facade module re-exporting modularized parsers, workbook builders, and validators from `src/services/pdr/`.
 */

export {
  PDR_EXCEL_SHEETS,
  type PdrCatalogImportCounts,
  type PdrCatalogImportError,
  type PdrCatalogImportMode,
  type PdrCatalogImportReport,
  type PdrCatalogRawSheets,
  type PdrCatalogValidationOptions,
  type PdrGroupExcelRow,
  type PdrItemExcelRow,
  type PdrTypeExcelRow,
} from './pdr/types/pdrExcelTypes';

export {
  derivePdrGroupId,
  parseExcelBoolean,
  parsePdrCatalogWorkbookBuffer,
  parsePdrExcelPolicyTags,
} from './pdr/pdrExcelParsers';

export {
  buildPdrCatalogRows,
  buildPdrCatalogWorkbook,
  downloadPdrCatalogWorkbook,
} from './pdr/pdrExcelBuilder';

export {
  applyPdrCatalogImportToStore,
  validateAndReconcilePdrCatalogImport,
} from './pdr/pdrExcelValidator';
