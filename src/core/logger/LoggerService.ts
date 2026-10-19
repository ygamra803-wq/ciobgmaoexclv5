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

  static debug(message: string, data: any = {}, context = '') {
    if (this.currentLevel <= this.LOG_LEVELS.DEBUG) {
      console.log(`🔵 [DEBUG] ${context ? `[${context}] ` : ''}${message}`, data);
    }
  }

  static info(message: string, data: any = {}, context = '') {
    if (this.currentLevel <= this.LOG_LEVELS.INFO) {
      console.log(`🟢 [INFO] ${context ? `[${context}] ` : ''}${message}`, data);
    }
  }

  static warn(message: string, data: any = {}, context = '') {
    if (this.currentLevel <= this.LOG_LEVELS.WARN) {
      console.warn(`🟡 [WARN] ${context ? `[${context}] ` : ''}${message}`, data);
    }
  }

  static error(message: string, error: any = {}, context = '') {
    if (this.currentLevel <= this.LOG_LEVELS.ERROR) {
      console.error(`🔴 [ERROR] ${context ? `[${context}] ` : ''}${message}`, error);
    }
  }

  static fatal(message: string, error: any = {}, context = '') {
    if (this.currentLevel <= this.LOG_LEVELS.FATAL) {
      console.error(`⛔ [FATAL] ${context ? `[${context}] ` : ''}${message}`, error);
    }
  }

  static table(data) {
    if (this.currentLevel <= this.LOG_LEVELS.DEBUG) {
      console.table(data);
    }
  }
}
