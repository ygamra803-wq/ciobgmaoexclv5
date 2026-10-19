/**
 * App Error Classes
 * ✅ معالجة الأخطاء بشكل منظم
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details: any = {}
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: new Date()
    };
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details: any = {}) {
    super(message, 'DB_ERROR', 500, details);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, errors: any[] = []) {
    super(message, 'VALIDATION_ERROR', 400, { errors });
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, resource: string) {
    super(message, 'NOT_FOUND', 404, { resource });
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class PermissionError extends AppError {
  constructor(message: string, permission: string) {
    super(message, 'PERMISSION_DENIED', 403, { permission });
    this.name = 'PermissionError';
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

export class OfflineError extends AppError {
  constructor(message: string = 'No internet connection') {
    super(message, 'OFFLINE', 0, {});
    this.name = 'OfflineError';
    Object.setPrototypeOf(this, OfflineError.prototype);
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = 'Operation timeout') {
    super(message, 'TIMEOUT', 408, {});
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
