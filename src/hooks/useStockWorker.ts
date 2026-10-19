import { useEffect, useRef, useState } from 'react';
import StockWorker from '../workers/stock.worker?worker';

export function useStockWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    workerRef.current = new StockWorker();
    setIsInitialized(true);

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const worker = workerRef.current;

  const calculateAllStocks = (articles: any[], movements: any[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        worker.removeEventListener('message', handleMessage);
        if (event.data.success) resolve(event.data.result);
        else reject(new Error(event.data.error));
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({ articles, movements, action: 'calculateAllStocks' });
    });
  };

  const getStockAlerts = (articles: any[], movements: any[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        worker.removeEventListener('message', handleMessage);
        if (event.data.success) resolve(event.data.result);
        else reject(new Error(event.data.error));
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({ articles, movements, action: 'getStockAlerts' });
    });
  };

  return { calculateAllStocks, getStockAlerts, isInitialized };
}

export default useStockWorker;
