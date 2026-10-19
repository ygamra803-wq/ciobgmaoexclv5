/**
 * Stock Calculations Domain Functions
 */
import { StockCalculationService } from './pdr/services/StockCalculationService';
import { calculateStockStatus } from '../utils/formulaEngine';

export function calculateCurrentStock(initialStock = 0, entries = 0, exits = 0) {
  const init = Number(initialStock) || 0;
  const inQty = Number(entries) || 0;
  const outQty = Number(exits) || 0;
  return init + inQty - outQty;
}

export function getStockStatus(stock = 0, minStock = 0) {
  const current = Number(stock) || 0;
  const min = Number(minStock) || 0;

  if (current <= 0) return 'RUPTURE';
  if (min > 0 && current <= min) return 'ALERTE';
  return 'OPTIMAL';
}

export { StockCalculationService, calculateStockStatus };
