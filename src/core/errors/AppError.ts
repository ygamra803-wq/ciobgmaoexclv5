/**
 * AppError Class & Error Hierarchy
 * Enhanced Error Handling with TypeScript Support
 */
import { ApplicationError } from './ApplicationError';

export type ErrorCode =
  | 'GENERIC_ERROR'
  | 'STORAGE_SAVE_ERROR'
  | 'STORAGE_LOAD_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'CONFLICT'
  | 'INSUFFICIENT_STOCK'
  | 'NETWORK_OFFLINE'
  | 'PARSE_ERROR'
  | 'EXCEL_SYNC_ERROR';

export class AppError extends ApplicationError {
  constructor(message: string, code: ErrorCode = 'GENERIC_ERROR', details: Record<string, any> = {}) {
    super(message, code, 400, details);
    this.name = 'AppError';
    const errConst = Error as any;
    if (typeof errConst.captureStackTrace === 'function') {
      errConst.captureStackTrace(this, AppError);
    }
  }
}

export * from './ApplicationError';
