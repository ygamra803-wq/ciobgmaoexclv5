/**
 * @module core/domain/services/StockCalculationService
 * @description
 * Canonical barrel re-exporting {@link StockCalculationService} and {@link StockCalculationResult}
 * from `src/domain/pdr/services/StockCalculationService.ts` so all callers (including Web Workers,
 * application services, and integration tests) share identical reference and movement-type normalization.
 */
export {
  StockCalculationService,
  type StockCalculationResult,
} from '../../../domain/pdr/services/StockCalculationService';
export { StockCalculationService as default } from '../../../domain/pdr/services/StockCalculationService';

