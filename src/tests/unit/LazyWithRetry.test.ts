import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importWithRetry } from '../../utils/lazyWithRetry';

describe('importWithRetry resilience', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('retries transient "Failed to fetch dynamically imported module" errors and succeeds', async () => {
    const factory = vi
      .fn<() => Promise<{ default: string }>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module: https://example.com/src/AuthenticatedApp.tsx'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module: https://example.com/src/AuthenticatedApp.tsx'))
      .mockResolvedValueOnce({ default: 'LoadedApp' });

    const mod = await importWithRetry(factory, 'AuthenticatedApp');
    expect(mod.default).toBe('LoadedApp');
    expect(factory).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-chunk runtime syntax/reference errors', async () => {
    const factory = vi
      .fn<() => Promise<{ default: string }>>()
      .mockRejectedValueOnce(new ReferenceError('Unexpected initialization error'));

    await expect(importWithRetry(factory, 'BrokenModule')).rejects.toThrow(
      'Unexpected initialization error'
    );
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
