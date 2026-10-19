/**
 * Re-exports the single canonical StockCalculationService from src/domain/pdr/services/StockCalculationService.ts
 * so all callers (including Web Workers and integration tests) share identical ref/type normalization.
 */
export {
  StockCalculationService,
  type StockCalculationResult,
} from '../../../domain/pdr/services/StockCalculationService';
export { StockCalculationService as default } from '../../../domain/pdr/services/StockCalculationService';
