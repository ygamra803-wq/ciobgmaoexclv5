/**
 * نظام Logging موحد لتطبيق GMAO
 * @module Logger
 */
export class Logger {
  static #enabled = true;
  static #levels = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    SILENT: 4
  };
  static #currentLevel = this.#levels.INFO;

  /**
   * تفعيل/تعطيل نظام Logging
   * @param {boolean} enabled - حالة التفعيل
   */
  static setEnabled(enabled) {
    this.#enabled = enabled;
  }

  /**
   * ضبط مستوى السجلات
   * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'|'SILENT'} level
   */
  static setLevel(level) {
    this.#currentLevel = this.#levels[level] || this.#levels.INFO;
  }

  /**
   * تسجيل رسالة Debug
   * @param {string} message - الرسالة
   * @param {*} data - البيانات الإضافية
   * @param {string} context - السياق (مثال: 'StockService')
   */
  static debug(message, data = null, context = '') {
    if (!this.#enabled || this.#currentLevel > this.#levels.DEBUG) return;
    console.log(`[DEBUG] ${context ? `[${context}]` : ''} ${message}`, data || '');
  }

  /**
   * تسجيل رسالة Info
   */
  static info(message, data = null, context = '') {
    if (!this.#enabled || this.#currentLevel > this.#levels.INFO) return;
    console.log(`[INFO] ${context ? `[${context}]` : ''} ${message}`, data || '');
  }

  /**
   * تسجيل تحذير
   */
  static warn(message, data = null, context = '') {
    if (!this.#enabled || this.#currentLevel > this.#levels.WARN) return;
    console.warn(`[WARN] ${context ? `[${context}]` : ''} ${message}`, data || '');
  }

  /**
   * تسجيل خطأ
   */
  static error(message, error = null, context = '') {
    if (!this.#enabled || this.#currentLevel > this.#levels.ERROR) return;
    console.error(`[ERROR] ${context ? `[${context}]` : ''} ${message}`, error || '');
  }
}

// تصدير مثيل عالمي
export const logger = Logger;
export default Logger;
