import { Logger } from '../core/logger/LoggerService';

/**
 * Central Error Tracker
 */
export class ErrorTracker {
  static captureException(error, context = {}) {
    Logger.error('[ErrorTracker Captured]:', 'ErrorTracker', { error, context });
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
