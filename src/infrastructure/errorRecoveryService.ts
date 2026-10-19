/**
 * خدمة استرجاع الأخطاء الشاملة - GMAO Nexus Error Recovery Service
 */
class ErrorRecoveryService {
  constructor() {
    this.recoveryStrategies = new Map();
    this.errorLog = [];
    this.maxErrors = 1000;
    this.setupDefaultStrategies();
  }

  /**
   * إعداد استراتيجيات الاسترجاع الافتراضية
   */
  setupDefaultStrategies() {
    // استراتيجية IndexedDB
    this.registerStrategy('IndexedDBError', async (error, context) => {
      console.warn('🔄 محاولة استرجاع IndexedDB...', error?.message);
      
      try {
        if (context.db && typeof context.db.close === 'function' && typeof context.db.open === 'function') {
          // إغلاق وإعادة فتح قاعدة البيانات
          await context.db.close();
          await context.db.open();
          console.log('✅ تم استرجاع IndexedDB');
          return true;
        }
        return false;
      } catch (recoveryError) {
        console.error('❌ فشل استرجاع IndexedDB:', recoveryError);
        
        // الرجوع إلى LocalStorage
        console.warn('⚠️ الرجوع إلى LocalStorage');
        context.fallbackToLocalStorage = true;
        return false;
      }
    });

    // استراتيجية Network
    this.registerStrategy('NetworkError', async (error, context) => {
      console.warn('🔄 محاولة استرجاع الاتصال...', error?.message);
      
      // انتظر قبل المحاولة التالية
      await this.sleep(context.retryDelay || 3000);
      
      // تحقق من الاتصال
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        console.log('✅ تم استرجاع الاتصال');
        return true;
      }
      
      console.warn('⚠️ لا يزال لا يوجد اتصال');
      return false;
    });

    // استراتيجية Memory
    this.registerStrategy('MemoryError', async (error, context) => {
      console.warn('🔄 محاولة تحرير الذاكرة...', error?.message);
      
      // مسح الـ Cache
      if (context.cache && typeof context.cache.clear === 'function') {
        context.cache.clear();
      }
      
      // إجبار Garbage Collection (إن أمكن)
      if (typeof window !== 'undefined' && window.gc) {
        window.gc();
      }
      
      console.log('✅ تم تحرير الذاكرة');
      return true;
    });

    // استراتيجية Quota
    this.registerStrategy('QuotaExceededError', async (error, context) => {
      console.warn('🔄 محاولة تحرير المساحة...', error?.message);
      
      // حذف البيانات القديمة
      if (context.db && typeof context.db.cleanOldData === 'function') {
        await context.db.cleanOldData(90); // احذف البيانات القديمة أكثر من 90 يوم
      }
      
      console.log('✅ تم تحرير المساحة');
      return true;
    });
  }

  /**
   * تسجيل استراتيجية مخصصة
   */
  registerStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * محاولة الاسترجاع
   */
  async recover(error, context = {}) {
    // تسجيل الخطأ
    this.logError(error, context);

    // تحديد نوع الخطأ
    const errorType = this.getErrorType(error);

    // الحصول على الاستراتيجية
    const strategy = this.recoveryStrategies.get(errorType);

    if (!strategy) {
      console.error('❌ لا توجد استراتيجية استرجاع لـ:', errorType);
      return false;
    }

    try {
      // محاولة الاسترجاع
      const recovered = await strategy(error, context);
      
      if (recovered) {
        console.log('✅ تم الاسترجاع بنجاح لـ:', errorType);
      }
      
      return recovered;
    } catch (recoveryError) {
      console.error('❌ خطأ في الاسترجاع:', recoveryError);
      return false;
    }
  }

  /**
   * تحديد نوع الخطأ
   */
  getErrorType(error) {
    if (!error) return 'UnknownError';

    if (error.name === 'QuotaExceededError') {
      return 'QuotaExceededError';
    }

    const msg = String(error.message || '');
    if (msg.includes('Network') || msg.includes('timeout') || msg.includes('Failed to fetch')) {
      return 'NetworkError';
    }

    if (msg.includes('memory') || msg.includes('Memory')) {
      return 'MemoryError';
    }

    if (error.name === 'InvalidStateError' || error.name === 'NotFoundError' || error.name === 'DexieError') {
      return 'IndexedDBError';
    }

    return 'UnknownError';
  }

  /**
   * تسجيل الخطأ
   */
  logError(error, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: this.getErrorType(error),
      message: error?.message || String(error),
      stack: error?.stack,
      context
    };

    this.errorLog.push(entry);

    if (this.errorLog.length > this.maxErrors) {
      this.errorLog.shift();
    }

    console.error('📋 خطأ مسجل:', entry);
  }

  /**
   * الحصول على سجل الأخطاء
   */
  getErrorLog(filters = {}) {
    let results = this.errorLog;

    if (filters.type) {
      results = results.filter(e => e.type === filters.type);
    }

    if (filters.startDate) {
      results = results.filter(
        e => new Date(e.timestamp) >= new Date(filters.startDate)
      );
    }

    return results;
  }

  /**
   * انتظر
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * تصدير السجل
   */
  exportErrorLog() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const csv = this.convertToCSV(this.errorLog);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-log-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * تحويل إلى CSV
   */
  convertToCSV(logs) {
    const headers = ['التاريخ والوقت', 'النوع', 'الرسالة'];
    const rows = logs.map(log => [
      log.timestamp,
      log.type,
      log.message
    ]);

    return [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');
  }
}

export const errorRecoveryService = new ErrorRecoveryService();
export default errorRecoveryService;
