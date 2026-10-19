/**
 * Error Handling Architecture - Custom Exceptions & Error Classes
 */

export class AppError extends Error {
  constructor(message, code = 'APP_ERROR', statusCode = 500, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

export class DatabaseError extends AppError {
  constructor(message, details = {}) {
    super(message, 'DB_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 'VALIDATION_ERROR', 400, { errors });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message, resource = '') {
    super(message, 'NOT_FOUND', 404, { resource });
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends AppError {
  constructor(message, permission = '') {
    super(message, 'PERMISSION_DENIED', 403, { permission });
    this.name = 'PermissionError';
  }
}

export class OfflineError extends AppError {
  constructor(message = 'Aucune connexion réseau disponible') {
    super(message, 'OFFLINE', 0, {});
    this.name = 'OfflineError';
  }
}
