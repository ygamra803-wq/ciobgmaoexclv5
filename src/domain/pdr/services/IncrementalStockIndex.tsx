/**
 * Re-exports the single canonical IncrementalStockIndex from src/application/IncrementalStockIndex.ts
 * to eliminate split-brain instances and case-normalization discrepancies.
 */
export {
  IncrementalStockIndex,
  stockIndex,
  normalizeType,
  type MovementType,
  type StockTotals,
  type MovementDelta,
} from '../../../application/IncrementalStockIndex';
export { stockIndex as default } from '../../../application/IncrementalStockIndex';
