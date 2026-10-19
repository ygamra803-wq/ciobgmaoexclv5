import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { AppError as CoreAppError } from '../../core/errors/AppError';
import {
  AppError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  PermissionError,
  OfflineError,
} from '@/infrastructure/errors/AppError';
import { ErrorBoundary } from '@/presentation/components/ErrorBoundary';
import { retry } from '../../utils/retry';

describe('Phase 1: AppError, Error Hierarchy, ErrorBoundary & Retry Utility', () => {
  describe('Core AppError', () => {
    it('should create a CoreAppError with code, message, and serialized structure', () => {
      const err = new CoreAppError('Stock item missing', 'NOT_FOUND', { ref: 'ROUL-6204' });
      expect(err.name).toBe('AppError');
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Stock item missing');
      expect(err.details).toEqual({ ref: 'ROUL-6204' });

      const json = err.toJSON();
      expect(json.code).toBe('NOT_FOUND');
      expect(json.statusCode).toBe(400);
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('Infrastructure Error Hierarchy (AppError.ts)', () => {
    it('should serialize AppError properly with default statusCode 500', () => {
      const err = new AppError('System failure', 'SYS_ERR');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.toJSON().code).toBe('SYS_ERR');
    });

    it('should create DatabaseError (500), ValidationError (400), NotFoundError (404), PermissionError (403), and OfflineError (0)', () => {
      const dbErr = new DatabaseError('IndexedDB locked', { table: 'stock' });
      expect(dbErr.name).toBe('DatabaseError');
      expect(dbErr.code).toBe('DB_ERROR');
      expect(dbErr.statusCode).toBe(500);

      const valErr = new ValidationError('Invalid quantity', [{ field: 'qty' }]);
      expect(valErr.name).toBe('ValidationError');
      expect(valErr.code).toBe('VALIDATION_ERROR');
      expect(valErr.statusCode).toBe(400);
      expect(valErr.details.errors).toHaveLength(1);

      const nfErr = new NotFoundError('Machine not found', 'Machine');
      expect(nfErr.name).toBe('NotFoundError');
      expect(nfErr.code).toBe('NOT_FOUND');
      expect(nfErr.statusCode).toBe(404);
      expect(nfErr.details.resource).toBe('Machine');

      const permErr = new PermissionError('Access denied', 'stock.delete');
      expect(permErr.name).toBe('PermissionError');
      expect(permErr.code).toBe('PERMISSION_DENIED');
      expect(permErr.statusCode).toBe(403);
      expect(permErr.details.permission).toBe('stock.delete');

      const offErr = new OfflineError();
      expect(offErr.name).toBe('OfflineError');
      expect(offErr.code).toBe('OFFLINE');
      expect(offErr.statusCode).toBe(0);
      expect(offErr.message).toBe('No internet connection');
    });
  });

  describe('ErrorBoundary Component', () => {
    it('should derive error state and support handleReset', () => {
      const testError = new Error('Render crash');
      const derived = ErrorBoundary.getDerivedStateFromError(testError);
      expect(derived.error).toBe(testError);

      const boundary = new ErrorBoundary({ children: React.createElement('div', null, 'Safe content') });
      expect(boundary.state.error).toBeNull();

      boundary.state = { error: testError, errorInfo: null, errorCount: 1 };
      const fallbackElement = boundary.render() as React.ReactElement;
      expect(fallbackElement).toBeDefined();

      boundary.setState = (updater: any) => {
        const next = typeof updater === 'function' ? updater(boundary.state) : updater;
        boundary.state = { ...boundary.state, ...next };
      };
      boundary.handleReset();
      expect(boundary.state.error).toBeNull();
    });
  });

  describe('retry utility', () => {
    it('should resolve immediately if operation succeeds', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn, { retries: 3, delay: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and resolve if subsequent attempt succeeds', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return 'recovered';
      });

      const result = await retry(fn, { retries: 3, delay: 10, backoff: 1 });
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw last error if max retries exceeded', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Persistent error'));
      await expect(retry(fn, { retries: 2, delay: 10, backoff: 1 })).rejects.toThrow('Persistent error');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
