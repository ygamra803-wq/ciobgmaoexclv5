import { Logger } from '../logger/LoggerService';

/**
 * خدمة الإشعارات الموحدة للتطبيق
 * @module NotificationService
 */
export class NotificationService {
  static #listeners = [];

  /**
   * إضافة مستمع للإشعارات
   * @param {Function} listener
   */
  static subscribe(listener) {
    this.#listeners.push(listener);
    return () => {
      this.#listeners = this.#listeners.filter(l => l !== listener);
    };
  }

  /**
   * إشعار المستخدم
   * @param {string} message - نص الإشعار
   * @param {'success'|'error'|'info'|'warning'} type - نوع الإشعار
   * @param {number} duration - المدة بالمللي ثانية
   */
  static notify(message, type = 'info', duration = 3000) {
    const notification = {
      id: Date.now() + Math.random(),
      message,
      type,
      duration,
      timestamp: new Date()
    };

    // إشعار جميع المستمعين
    this.#listeners.forEach(listener => listener(notification));

    // تسجيل عبر الـ Logger الموحد
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const formattedMessage = `${icons[type] || '📢'} ${message}`;

    if (type === 'error') {
      Logger.error(formattedMessage);
    } else if (type === 'warning') {
      Logger.warn(formattedMessage);
    } else {
      Logger.info(formattedMessage);
    }

    return notification;
  }

  static success(message, duration) {
    return this.notify(message, 'success', duration);
  }

  static error(message, duration) {
    return this.notify(message, 'error', duration);
  }

  static warning(message, duration) {
    return this.notify(message, 'warning', duration);
  }

  static info(message, duration) {
    return this.notify(message, 'info', duration);
  }
}

export const notify = NotificationService;
export default NotificationService;
