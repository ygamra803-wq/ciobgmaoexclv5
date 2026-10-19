import { Logger } from '../core/logger/LoggerService';

/**
 * Central Error Tracker
 */
export class ErrorTracker {
  static captureException(error: any, context: any = {}) {
    Logger.error('[ErrorTracker Captured]:', { error, context }, 'ErrorTracker');
    try {
      const errors = JSON.parse(localStorage.getItem('gmao_error_reports') || '[]');
      errors.push({
        message: error.message || String(error),
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
      });
      if (errors.length > 50) errors.shift();
      localStorage.setItem('gmao_error_reports', JSON.stringify(errors));
    } catch {
      // fallback
    }
  }
}
