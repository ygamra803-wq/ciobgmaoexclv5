import { indexedDBService } from '../utils/indexedDBService';

/**
 * Production Logger Service & Alert System
 * Manages persistent logging, log rotation, CSV export, and alert monitoring.
 */
class ProductionLoggerService {
  namespace: string;
  memoryLogs: any[];
  maxMemoryLogs: number;
  logLevel: string;
  dbStoreKey: string;

  constructor(namespace = 'GMAO') {
    this.namespace = namespace;
    this.memoryLogs = [];
    this.maxMemoryLogs = 2000;
    this.logLevel = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';
    this.dbStoreKey = 'production_logs_archive';
  }

  setLevel(level: string) {
    this.logLevel = level;
  }

  shouldLog(level: string) {
    const levels: Record<string, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    const currentWeight = levels[this.logLevel] ?? 0;
    const targetWeight = levels[level] ?? 1;
    return targetWeight >= currentWeight;
  }

  async log(level: string, message: string, data: any = null, context: any = {}) {
    if (!this.shouldLog(level)) return;

    const entry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      level,
      namespace: this.namespace,
      message,
      data: data ? (typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : String(data)) : null,
      context: {
        url: typeof window !== 'undefined' ? window.location.href : 'SSR',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node',
        ...context,
      },
    };

    // Store in memory buffer
    this.memoryLogs.push(entry);
    if (this.memoryLogs.length > this.maxMemoryLogs) {
      this.memoryLogs.shift();
    }

    // Console output styling
    this.printToConsole(entry);

    // Persist WARN & ERROR logs to IndexedDB asynchronously
    if (level === 'ERROR' || level === 'WARN') {
      this.persistLogEntry(entry).catch(() => {});
    }
  }

  debug(message: string, data?: any, context?: any) {
    this.log('DEBUG', message, data, context);
  }

  info(message: string, data?: any, context?: any) {
    this.log('INFO', message, data, context);
  }

  warn(message: string, data?: any, context?: any) {
    this.log('WARN', message, data, context);
  }

  error(message: string, data?: any, context?: any) {
    this.log('ERROR', message, data, context);
  }

  async persistLogEntry(entry: any) {
    try {
      const existing = (await indexedDBService.getItem(this.dbStoreKey, [])) || [];
      existing.push(entry);
      // Keep last 1000 persisted logs
      if (existing.length > 1000) existing.shift();
      await indexedDBService.setItem(this.dbStoreKey, existing);
    } catch {}
  }

  printToConsole(entry: any) {
    const styles: Record<string, string> = {
      ERROR: 'color: #ef4444; font-weight: bold;',
      WARN: 'color: #f59e0b; font-weight: bold;',
      INFO: 'color: #3b82f6;',
      DEBUG: 'color: #6b7280;',
    };
    const style = styles[entry.level] || '';
    const prefix = `[${entry.timestamp}] [${entry.namespace}] [${entry.level}]: ${entry.message}`;

    if (entry.level === 'ERROR') {
      console.error(prefix, entry.data || '');
    } else if (entry.level === 'WARN') {
      console.warn(prefix, entry.data || '');
    } else {
      console.log(`%c${prefix}`, style, entry.data || '');
    }
  }

  async getLogs(filters: any = {}) {
    let logs: any[] = [...this.memoryLogs];

    try {
      const persisted = await indexedDBService.getItem(this.dbStoreKey, []);
      if (Array.isArray(persisted) && persisted.length > 0) {
        // Merge without duplicates by id
        const map = new Map();
        [...persisted, ...logs].forEach((l: any) => map.set(l.id, l));
        logs = Array.from(map.values()).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
    } catch {}

    if (filters.level) {
      logs = logs.filter((l: any) => l.level === filters.level);
    }
    if (filters.search) {
      const q = String(filters.search).toLowerCase();
      logs = logs.filter((l: any) => l.message.toLowerCase().includes(q) || JSON.stringify(l.data).toLowerCase().includes(q));
    }

    return logs;
  }

  async exportLogsAsCSV() {
    const logs = await this.getLogs();
    const headers = ['Timestamp', 'Level', 'Namespace', 'Message', 'Data'];
    const rows = logs.map((l: any) => [
      l.timestamp,
      l.level,
      l.namespace,
      `"${String(l.message).replace(/"/g, '""')}"`,
      `"${JSON.stringify(l.data || {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return csvContent;
  }

  async clearLogs() {
    this.memoryLogs = [];
    try {
      await indexedDBService.removeItem(this.dbStoreKey);
    } catch {}
  }
}

export const productionLoggerService = new ProductionLoggerService('GMAO');
export default productionLoggerService;
