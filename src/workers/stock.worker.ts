import { StockCalculationService } from '../core/domain/services/StockCalculationService';

// Worker context: 'self' refers to the global scope of the worker
const ctx: Worker = self as any;

ctx.onmessage = (event: MessageEvent) => {
  const { action, articles, movements } = event.data;

  try {
    let result;
    switch (action) {
      case 'calculateAllStocks':
        result = StockCalculationService.calculateAllStocks(articles, movements);
        break;
      case 'getStockAlerts':
        const stocks = StockCalculationService.calculateAllStocks(articles, movements);
        result = StockCalculationService.getStockAlerts(stocks);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    ctx.postMessage({ success: true, result });
  } catch (error: any) {
    ctx.postMessage({ success: false, error: error.message });
  }
};
