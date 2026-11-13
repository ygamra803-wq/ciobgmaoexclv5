/**
 * Logger Service
 * ✅ تسجيل جميع الأحداث والأخطاء
 */
export class Logger {
  static LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
  };

  static currentLevel = this.LOG_LEVELS.INFO;

  static setLevel(level) {
    this.currentLevel = this.LOG_LEVELS[level] || this.LOG_LEVELS.INFO;
  }

  private static resolveArgs(data: unknown = {}, context: unknown = ''): { resolvedData: unknown; resolvedContext: string } {
    if (typeof data === 'string' && context !== '' && typeof context !== 'string') {
      return { resolvedData: context, resolvedContext: data };
    }
    return {
      resolvedData: data,
      resolvedContext: typeof context === 'string' ? context : '',
    };
  }

  private static formatMessage(message: string | unknown): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) return message.message;
    return String(message ?? '');
  }

  static debug(message: string | unknown, data: unknown = {}, context: unknown = '') {
    if (this.currentLevel <= this.LOG_LEVELS.DEBUG) {
      const { resolvedData, resolvedContext } = this.resolveArgs(data, context);
      console.log(`🔵 [DEBUG] ${resolvedContext ? `[${resolvedContext}] ` : ''}${this.formatMessage(message)}`, resolvedData);
    }
  }

  static info(message: string | unknown, data: unknown = {}, context: unknown = '') {
    if (this.currentLevel <= this.LOG_LEVELS.INFO) {
      const { resolvedData, resolvedContext } = this.resolveArgs(data, context);
      console.log(`🟢 [INFO] ${resolvedContext ? `[${resolvedContext}] ` : ''}${this.formatMessage(message)}`, resolvedData);
    }
  }

  static warn(message: string | unknown, data: unknown = {}, context: unknown = '') {
    if (this.currentLevel <= this.LOG_LEVELS.WARN) {
      const { resolvedData, resolvedContext } = this.resolveArgs(data, context);
      console.warn(`🟡 [WARN] ${resolvedContext ? `[${resolvedContext}] ` : ''}${this.formatMessage(message)}`, resolvedData);
    }
  }

  static error(message: string | unknown, error: unknown = {}, context: unknown = '') {
    if (this.currentLevel <= this.LOG_LEVELS.ERROR) {
      const { resolvedData, resolvedContext } = this.resolveArgs(error, context);
      console.error(`🔴 [ERROR] ${resolvedContext ? `[${resolvedContext}] ` : ''}${this.formatMessage(message)}`, resolvedData);
    }
  }

  static fatal(message: string | unknown, error: unknown = {}, context: unknown = '') {
    if (this.currentLevel <= this.LOG_LEVELS.FATAL) {
      const { resolvedData, resolvedContext } = this.resolveArgs(error, context);
      console.error(`⛔ [FATAL] ${resolvedContext ? `[${resolvedContext}] ` : ''}${this.formatMessage(message)}`, resolvedData);
    }
  }

  static table(data: any, _context = '') {
    if (this.currentLevel <= this.LOG_LEVELS.DEBUG) {
      console.table(data);
    }
  }

  static group(label: string, context = '') {
    if (this.currentLevel <= this.LOG_LEVELS.DEBUG && typeof console.group === 'function') {
      console.group(`${context ? `[${context}] ` : ''}${label}`);
    }
  }

  static groupEnd() {
    if (this.currentLevel <= this.LOG_LEVELS.DEBUG && typeof console.groupEnd === 'function') {
      console.groupEnd();
    }
  }
}
