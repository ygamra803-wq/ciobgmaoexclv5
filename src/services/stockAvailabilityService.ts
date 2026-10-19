import { StockCalculationService } from '../domain/pdr/services/StockCalculationService';

export const stockAvailabilityService = {
  checkAvailability: StockCalculationService.checkAvailability.bind(StockCalculationService)
};
export default stockAvailabilityService;
