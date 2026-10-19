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

  static debug(message, data = {}) {
    if (this.currentLevel <= this.LOG_LEVELS.DEBUG) {
      console.log(`🔵 [DEBUG] ${message}`, data);
    }
  }

  static info(message, data = {}) {
    if (this.currentLevel <= this.LOG_LEVELS.INFO) {
      console.log(`🟢 [INFO] ${message}`, data);
    }
  }

  static warn(message, data = {}) {
    if (this.currentLevel <= this.LOG_LEVELS.WARN) {
      console.warn(`🟡 [WARN] ${message}`, data);
    }
  }

  static error(message, error = {}) {
    if (this.currentLevel <= this.LOG_LEVELS.ERROR) {
      console.error(`🔴 [ERROR] ${message}`, error);
    }
  }

  static fatal(message, error = {}) {
    if (this.currentLevel <= this.LOG_LEVELS.FATAL) {
      console.error(`⛔ [FATAL] ${message}`, error);
    }
  }

  static table(data) {
    if (this.currentLevel <= this.LOG_LEVELS.DEBUG) {
      console.table(data);
    }
  }
}
