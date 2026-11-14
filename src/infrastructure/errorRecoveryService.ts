import { Logger } from '../core/logger/LoggerService';

export type ErrorRecoveryCategory =
  | 'IndexedDBError'
  | 'NetworkError'
  | 'MemoryError'
  | 'QuotaExceededError'
  | 'UnknownError';

export interface RecoverableDbHandle {
  close?: () => Promise<unknown> | unknown;
  open?: () => Promise<unknown> | unknown;
  cleanOldData?: (retentionDays: number) => Promise<unknown> | unknown;
}

export interface ErrorRecoveryContext {
  db?: RecoverableDbHandle;
  cache?: { clear?: () => void };
  retryDelay?: number;
  fallbackToLocalStorage?: boolean;
  [key: string]: unknown;
}

export type ErrorRecoveryStrategy = (
  error: unknown,
  context: ErrorRecoveryContext
) => Promise<boolean>;

export interface LoggedErrorEntry {
  timestamp: string;
  type: ErrorRecoveryCategory;
  message: string;
  stack?: string;
  context: ErrorRecoveryContext;
}

export interface ErrorLogFilter {
  type?: ErrorRecoveryCategory | string;
  startDate?: string | number | Date;
}

interface WindowWithOptionalGc extends Window {
  gc?: () => void;
}

function toErrorObject(error: unknown): { name?: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (error && typeof error === 'object') {
    const rec = error as { name?: unknown; message?: unknown; stack?: unknown };
    return {
      name: typeof rec.name === 'string' ? rec.name : undefined,
      message: typeof rec.message === 'string' ? rec.message : String(error),
      stack: typeof rec.stack === 'string' ? rec.stack : undefined,
    };
  }
  return { message: String(error ?? '') };
}

/**
 * Automated resilience & recovery coordinator for storage/network/quota faults.
 * Implements deterministic fallback policies (e.g. IndexedDB reconnect -> LocalStorage flag)
 * and maintains a bounded ring-buffer of diagnostic entries for CSV audit export.
 */
class ErrorRecoveryService {
  recoveryStrategies: Map<string, ErrorRecoveryStrategy>;
  errorLog: LoggedErrorEntry[];
  maxErrors: number;

  constructor() {
    this.recoveryStrategies = new Map();
    this.errorLog = [];
    this.maxErrors = 1000;
    this.setupDefaultStrategies();
  }

  /** Registers built-in recovery policies for IndexedDB, network, memory pressure, and storage quota faults. */
  setupDefaultStrategies() {
    // IndexedDB reconnect policy; flags LocalStorage fallback if reopen fails
    this.registerStrategy('IndexedDBError', async (error: unknown, context: ErrorRecoveryContext) => {
      const errInfo = toErrorObject(error);
      Logger.warn('🔄 محاولة استرجاع IndexedDB...', errInfo.message);

      try {
        if (context.db && typeof context.db.close === 'function' && typeof context.db.open === 'function') {
          await context.db.close();
          await context.db.open();
          Logger.info('✅ تم استرجاع IndexedDB');
          return true;
        }
        return false;
      } catch (recoveryError) {
        Logger.error('❌ فشل استرجاع IndexedDB:', recoveryError);
        Logger.warn('⚠️ الرجوع إلى LocalStorage');
        context.fallbackToLocalStorage = true;
        return false;
      }
    });

    // Transient connectivity recovery check after configurable backoff
    this.registerStrategy('NetworkError', async (error: unknown, context: ErrorRecoveryContext) => {
      const errInfo = toErrorObject(error);
      Logger.warn('🔄 محاولة استرجاع الاتصال...', errInfo.message);

      await this.sleep(context.retryDelay || 3000);

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        Logger.info('✅ تم استرجاع الاتصال');
        return true;
      }

      Logger.warn('⚠️ لا يزال لا يوجد اتصال');
      return false;
    });

    // Releases volatile caches and invokes V8 manual GC if exposed in Chromium diagnostics
    this.registerStrategy('MemoryError', async (error: unknown, context: ErrorRecoveryContext) => {
      const errInfo = toErrorObject(error);
      Logger.warn('🔄 محاولة تحرير الذاكرة...', errInfo.message);

      if (context.cache && typeof context.cache.clear === 'function') {
        context.cache.clear();
      }

      if (typeof window !== 'undefined') {
        const win = window as WindowWithOptionalGc;
        if (typeof win.gc === 'function') {
          win.gc();
        }
      }

      Logger.info('✅ تم تحرير الذاكرة');
      return true;
    });

    // Purges aged records (>90 days) when browser quota limits are hit
    this.registerStrategy('QuotaExceededError', async (error: unknown, context: ErrorRecoveryContext) => {
      const errInfo = toErrorObject(error);
      Logger.warn('🔄 محاولة تحرير المساحة...', errInfo.message);

      if (context.db && typeof context.db.cleanOldData === 'function') {
        await context.db.cleanOldData(90);
      }

      Logger.info('✅ تم تحرير المساحة');
      return true;
    });
  }

  /** Registers or overrides a named recovery strategy handler. */
  registerStrategy(errorType: string, strategy: ErrorRecoveryStrategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /** Logs the fault, resolves its category, and runs the corresponding recovery handler safely. */
  async recover(error: unknown, context: ErrorRecoveryContext = {}): Promise<boolean> {
    this.logError(error, context);

    const errorType = this.getErrorType(error);
    const strategy = this.recoveryStrategies.get(errorType);

    if (!strategy) {
      Logger.error('❌ لا توجد استراتيجية استرجاع لـ:', errorType);
      return false;
    }

    try {
      const recovered = await strategy(error, context);

      if (recovered) {
        Logger.info('✅ تم الاسترجاع بنجاح لـ:', errorType);
      }

      return recovered;
    } catch (recoveryError) {
      Logger.error('❌ خطأ في الاسترجاع:', recoveryError);
      return false;
    }
  }

  /** Maps runtime DOM/Dexie/network exception shapes into canonical recovery categories. */
  getErrorType(error: unknown): ErrorRecoveryCategory {
    if (!error) return 'UnknownError';
    const errInfo = toErrorObject(error);

    if (errInfo.name === 'QuotaExceededError') {
      return 'QuotaExceededError';
    }

    if (
      errInfo.message.includes('Network') ||
      errInfo.message.includes('timeout') ||
      errInfo.message.includes('Failed to fetch')
    ) {
      return 'NetworkError';
    }

    if (errInfo.message.includes('memory') || errInfo.message.includes('Memory')) {
      return 'MemoryError';
    }

    if (
      errInfo.name === 'InvalidStateError' ||
      errInfo.name === 'NotFoundError' ||
      errInfo.name === 'DexieError'
    ) {
      return 'IndexedDBError';
    }

    return 'UnknownError';
  }

  /** Appends a bounded diagnostic entry (capped at `maxErrors` to avoid memory leaks). */
  logError(error: unknown, context: ErrorRecoveryContext = {}) {
    const errInfo = toErrorObject(error);
    const entry: LoggedErrorEntry = {
      timestamp: new Date().toISOString(),
      type: this.getErrorType(error),
      message: errInfo.message || String(error),
      stack: errInfo.stack,
      context,
    };

    this.errorLog.push(entry);

    if (this.errorLog.length > this.maxErrors) {
      this.errorLog.shift();
    }

    Logger.error('📋 خطأ مسجل:', entry);
  }

  /** Queries recorded error logs with optional category and start-date filters. */
  getErrorLog(filters: ErrorLogFilter = {}): LoggedErrorEntry[] {
    let results = this.errorLog;

    if (filters.type) {
      results = results.filter((e) => e.type === filters.type);
    }

    if (filters.startDate) {
      const minTs = new Date(filters.startDate);
      results = results.filter((e) => new Date(e.timestamp) >= minTs);
    }

    return results;
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Triggers browser download of the error ring-buffer as UTF-8 CSV. */
  exportErrorLog() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const csv = this.convertToCSV(this.errorLog);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-log-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Escapes diagnostic rows per RFC 4180 CSV quoting rules. */
  convertToCSV(logs: ReadonlyArray<LoggedErrorEntry>): string {
    const headers = ['التاريخ والوقت', 'النوع', 'الرسالة'];
    const rows = logs.map((log) => [log.timestamp, log.type, log.message]);

    return [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
  }
}

export const errorRecoveryService = new ErrorRecoveryService();
export default errorRecoveryService;
