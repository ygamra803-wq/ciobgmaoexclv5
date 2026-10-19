import { multiLevelStorageService } from './multiLevelStorageService';
import { Logger } from '../core/logger/LoggerService';

/**
 * Health Check System for CIOB GMAO Light
 * Continuously monitors storage systems, memory heap usage, and runtime environment.
 */
class HealthCheckService {
  constructor() {
    this.registeredChecks = new Map();
    this.lastCheckResult = null;
    this.checkIntervalMs = 60 * 1000; // 1 minute interval
    this.timer = null;

    // Register core default health checks
    this.registerDefaultChecks();
  }

  registerCheck(name, checkFn) {
    this.registeredChecks.set(name, checkFn);
  }

  registerDefaultChecks() {
    // 1. Storage Health Check
    this.registerCheck('storage', async () => {
      const storageInfo = multiLevelStorageService.getStorageInfo();
      const isOk = storageInfo.available && storageInfo.level !== 'memory';
      return {
        status: isOk ? 'healthy' : storageInfo.level === 'memory' ? 'degraded' : 'unhealthy',
        details: storageInfo,
      };
    });

    // 2. Memory Heap Check
    this.registerCheck('memory', async () => {
      if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
        const mem = window.performance.memory;
        const usedMb = Math.round(mem.usedJSHeapSize / 1048576);
        const limitMb = Math.round(mem.jsHeapSizeLimit / 1048576);
        const percent = Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100);

        let status = 'healthy';
        if (percent > 90) status = 'unhealthy';
        else if (percent > 75) status = 'degraded';

        return {
          status,
          details: { usedMb, limitMb, percent: `${percent}%` },
        };
      }
      return {
        status: 'healthy',
        details: { note: 'Memory API unavailable in this browser environment' },
      };
    });

    // 3. Online Status Check
    this.registerCheck('network', async () => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      return {
        status: 'healthy',
        details: { mode: isOnline ? 'Online' : 'Offline PWA Active' },
      };
    });
  }

  async runAllChecks() {
    const results = {};
    let overall = 'healthy';

    for (const [name, checkFn] of this.registeredChecks.entries()) {
      try {
        const checkResult = await checkFn();
        results[name] = checkResult;

        if (checkResult.status === 'unhealthy') {
          overall = 'unhealthy';
        } else if (checkResult.status === 'degraded' && overall !== 'unhealthy') {
          overall = 'degraded';
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message || 'Error running check',
        };
        overall = 'unhealthy';
      }
    }

    this.lastCheckResult = {
      overall,
      timestamp: new Date().toISOString(),
      checks: results,
    };

    if (overall !== 'healthy') {
      Logger.warn(`🏥 System Health status: [${overall.toUpperCase()}]`, this.lastCheckResult, 'HealthCheck');
    } else {
      Logger.info(`🏥 System Health status: [HEALTHY]`, null, 'HealthCheck');
    }

    return this.lastCheckResult;
  }

  startAutoCheck(intervalMs = this.checkIntervalMs) {
    if (this.timer) clearInterval(this.timer);
    this.checkIntervalMs = intervalMs;
    this.timer = setInterval(() => {
      this.runAllChecks().catch((err) => Logger.error('Auto healthcheck failed:', err, 'HealthCheck'));
    }, this.checkIntervalMs);
  }

  stopAutoCheck() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getLastResult() {
    return this.lastCheckResult;
  }
}

export const healthCheckService = new HealthCheckService();
export default healthCheckService;
