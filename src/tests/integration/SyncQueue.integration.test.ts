import { describe, it, expect, beforeEach } from 'vitest';
import { syncQueueService } from '@/services/syncQueueService';

describe('SyncQueueService (Live Production Service)', () => {
  beforeEach(async () => {
    await syncQueueService.clearQueue();
    syncQueueService.isOnline = false;
  });

  it('should add operation to queue when offline', async () => {
    const item = await syncQueueService.add(
      { type: 'ADD_MOVEMENT', data: { itemId: 'ITEM-1', quantity: 10 } },
      'high',
      { module: 'stock' }
    );

    expect(item.id).toBeDefined();
    expect(syncQueueService.getState().queueLength).toBe(1);
    expect(syncQueueService.getState().pendingCount).toBe(1);
  });

  it('should process queued callable operations when online', async () => {
    let executedCount = 0;
    await syncQueueService.add(async () => {
      executedCount += 1;
    }, 'high');
    await syncQueueService.add(async () => {
      executedCount += 10;
    }, 'normal');

    expect(syncQueueService.getState().queueLength).toBe(2);

    syncQueueService.isOnline = true;
    await syncQueueService.processQueue();

    expect(executedCount).toBe(11);
    expect(syncQueueService.getState().queueLength).toBe(0);
  });

  it('should track retries on failing operation and mark failed after maxRetries', async () => {
    await syncQueueService.add(async () => {
      throw new Error('Network timeout');
    });

    syncQueueService.isOnline = true;
    await syncQueueService.processQueue();
    expect(syncQueueService.getState().items[0]?.retries).toBe(1);

    await syncQueueService.processQueue();
    await syncQueueService.processQueue();
    expect(syncQueueService.getState().failedCount).toBe(1);
  });
});
