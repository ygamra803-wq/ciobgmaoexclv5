import { safeNum, calculateStockStatus, sumIfs, countIfs } from '../utils/formulaEngine';
import { FormulaEngineOptimizer } from '../utils/formulaEngineOptimizer';

export const formulaEngine = {
  safeNum,
  calculateStockStatus,
  sumIfs,
  countIfs,
  clearMemoCache: FormulaEngineOptimizer.clearMemoCache
};

export default formulaEngine;
