/**
 * Error Logger
 * ✅ تسجيل الأخطاء
 */
class ErrorLogger {
  private static logs: any[] = [];
  private static maxLogs = 1000;

  static error(message: string, data: any = {}) {
    const logEntry = {
      level: 'ERROR',
      message,
      data,
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    };

    console.error(`🔴 [ERROR] ${message}`, data);
    this.addLog(logEntry);
    this.sendToServer(logEntry);
  }

  static warn(message: string, data: any = {}) {
    const logEntry = {
      level: 'WARN',
      message,
      data,
      timestamp: new Date()
    };

    console.warn(`🟡 [WARN] ${message}`, data);
    this.addLog(logEntry);
  }

  static info(message: string, data: any = {}) {
    const logEntry = {
      level: 'INFO',
      message,
      data,
      timestamp: new Date()
    };

    console.log(`🟢 [INFO] ${message}`, data);
    this.addLog(logEntry);
  }

  private static addLog(logEntry: any) {
    this.logs.push(logEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // حفظ في localStorage
    try {
      localStorage.setItem('errorLogs', JSON.stringify(this.logs));
    } catch (error) {
      console.warn('Failed to save logs to localStorage');
    }
  }

  private static sendToServer(logEntry: any) {
    // إرسال الخطأ إلى الخادم (مستقبلاً)
    // fetch('/api/logs', { method: 'POST', body: JSON.stringify(logEntry) });
  }

  static getLogs() {
    return this.logs;
  }

  static clearLogs() {
    this.logs = [];
    localStorage.removeItem('errorLogs');
  }
}

export default ErrorLogger;
