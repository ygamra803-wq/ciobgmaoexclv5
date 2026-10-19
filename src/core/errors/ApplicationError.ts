/**
 * Base Application Error Class
 * ✅ جميع الأخطاء ترث من هذا الـ Class
 */
export class ApplicationError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Database Error
 */
export class DatabaseError extends ApplicationError {
  constructor(message, details = {}) {
    super(message, 'DB_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

/**
 * Validation Error
 */
export class ValidationError extends ApplicationError {
  constructor(message, errors = []) {
    super(message, 'VALIDATION_ERROR', 400, { errors });
    this.name = 'ValidationError';
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends ApplicationError {
  constructor(message, resource) {
    super(message, 'NOT_FOUND', 404, { resource });
    this.name = 'NotFoundError';
  }
}

/**
 * Permission Error
 */
export class PermissionError extends ApplicationError {
  constructor(message, permission) {
    super(message, 'PERMISSION_DENIED', 403, { permission });
    this.name = 'PermissionError';
  }
}

/**
 * Conflict Error
 */
export class ConflictError extends ApplicationError {
  constructor(message, conflict) {
    super(message, 'CONFLICT', 409, { conflict });
    this.name = 'ConflictError';
  }
}

/**
 * Insufficient Stock Error
 */
export class InsufficientStockError extends ApplicationError {
  constructor(ref, available, requested) {
    super(
      `المخزون غير كافي: ${ref}. المتاح: ${available}, المطلوب: ${requested}`,
      'INSUFFICIENT_STOCK',
      400,
      { ref, available, requested }
    );
    this.name = 'InsufficientStockError';
  }
}

/**
 * Authentication Error
 */
export class AuthenticationError extends ApplicationError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}
