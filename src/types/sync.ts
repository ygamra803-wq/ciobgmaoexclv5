/**
 * Offline Sync, Queue & Performance Types
 */

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_IMPORT' | 'STOCK_ADJUSTMENT';

export type SyncStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CONFLICT';

export interface ISyncQueueItem<T = any> {
  id: string;
  operation: {
    type: SyncOperationType;
    collection: string;
    payload: T;
    entityId?: string;
  };
  timestamp: string | number | Date;
  retries: number;
  maxRetries: number;
  status: SyncStatus;
  error?: string;
}

export interface IPerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date | number;
  metadata?: Record<string, any>;
}

export interface IIndexBenchmarkResult {
  operationCount: number;
  durationMs: number;
  opsPerSecond: number;
  memoryEstimateKb?: number;
}
