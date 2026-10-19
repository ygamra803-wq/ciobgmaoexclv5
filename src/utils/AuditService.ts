import { Logger } from '../core/logger/LoggerService';

/**
 * خدمة تسجيل التدقيق (Audit Trail)
 */
export class AuditService {
  constructor() {
    this.auditLog = [];
  }

  /**
   * تسجيل عملية
   * @param {string} action - نوع العملية
   * @param {string} entity - نوع الكيان (Stock, Movement, Machine)
   * @param {string} entityId - معرف الكيان
   * @param {Object} changes - التغييرات
   * @param {string} userId - معرف المستخدم
   */
  log(action, entity, entityId, changes, userId = 'unknown') {
    const auditEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      action, // CREATE, READ, UPDATE, DELETE
      entity,
      entityId,
      changes,
      userId,
      userAgent: navigator ? navigator.userAgent : 'Unknown',
      ipAddress: 'N/A', // في بيئة الإنتاج، احصل على IP من الخادم
    };

    this.auditLog.push(auditEntry);

    // حفظ في IndexedDB
    this.saveToIndexedDB(auditEntry);
  }

  /**
   * حفظ في IndexedDB
   */
  async saveToIndexedDB(entry) {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['auditLog'], 'readwrite');
      const store = tx.objectStore('auditLog');
      store.add(entry);
    } catch (error) {
      Logger.error('خطأ في حفظ سجل التدقيق:', error, 'AuditService');
    }
  }

  /**
   * الحصول على قاعدة البيانات
   */
  async getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('GMAO_Audit', 1);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('auditLog')) {
          const store = db.createObjectStore('auditLog', {
            keyPath: 'id',
          });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('userId', 'userId');
          store.createIndex('entity', 'entity');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * الحصول على السجل
   */
  async getLog(filters = {}) {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['auditLog'], 'readonly');
      const store = tx.objectStore('auditLog');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          let results = request.result;

          // تطبيق الفلاتر
          if (filters.userId) {
            results = results.filter((r) => r.userId === filters.userId);
          }
          if (filters.entity) {
            results = results.filter((r) => r.entity === filters.entity);
          }
          if (filters.startDate) {
            results = results.filter((r) => new Date(r.timestamp) >= filters.startDate);
          }
          if (filters.endDate) {
            results = results.filter((r) => new Date(r.timestamp) <= filters.endDate);
          }

          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      Logger.error('خطأ في جلب السجل:', error, 'AuditService');
      return [];
    }
  }
}

export const auditService = new AuditService();
