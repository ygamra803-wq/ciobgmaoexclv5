import { describe, it, expect } from 'vitest';
import { errorRecoveryService } from '@/infrastructure/errorRecoveryService.js';

describe('Error Recovery E2E Scenarios Test', () => {
  it('يجب معالجة خطأ امتلاء الذاكرة وتفريغ الكاش', async () => {
    const memError = new Error('Out of memory');
    
    let cacheCleared = false;
    const context = {
      cache: {
        clear: () => {
          cacheCleared = true;
        },
      },
    };

    const recovered = await errorRecoveryService.recover(memError, context);
    expect(recovered).toBe(true);
    expect(cacheCleared).toBe(true);
  });

  it('يجب معالجة تجاوز حصة التخزين QuotaExceededError', async () => {
    const quotaError = new Error('Quota exceeded');
    quotaError.name = 'QuotaExceededError';

    let cleaned = false;
    const context = {
      db: {
        cleanOldData: async () => {
          cleaned = true;
        },
      },
    };

    const recovered = await errorRecoveryService.recover(quotaError, context);
    expect(recovered).toBe(true);
    expect(cleaned).toBe(true);
  });
});
