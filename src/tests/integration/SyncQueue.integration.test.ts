// ✅ ملف: src/tests/integration/SyncQueue.integration.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import SyncQueueService from '@/infrastructure/sync/SyncQueueService';

describe('SyncQueueService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should add operation to queue', async () => {
    const id = await SyncQueueService.addToQueue({
      type: 'ADD_MOVEMENT',
      data: { itemId: 'ITEM-1', quantity: 10 },
    });

    expect(id).toBeDefined();
    expect(SyncQueueService.getQueueStatus().queueLength).toBe(1);
  });

  it('should persist queue to localStorage', async () => {
    await SyncQueueService.addToQueue({
      type: 'ADD_MOVEMENT',
      data: { itemId: 'ITEM-1', quantity: 10 },
    });

    const saved = localStorage.getItem('syncQueue');
    expect(saved).toBeDefined();
    expect(JSON.parse(saved!).length).toBe(1);
  });

  it('should retry failed operations', async () => {
    await SyncQueueService.addToQueue({
      type: 'UNKNOWN_FAILING_OP',
      data: { itemId: 'ITEM-99' },
    });

    SyncQueueService.setOnlineStatus(true);
    await SyncQueueService.processQueue();

    const status = SyncQueueService.getQueueStatus();
    expect(status.queueLength).toBe(0);
  });

  it('should process valid queued operations when online', async () => {
    await SyncQueueService.addToQueue({
      type: 'ADD_MOVEMENT',
      data: { itemId: 'ITEM-2', quantity: 5 },
    });
    await SyncQueueService.addToQueue({
      type: 'UPDATE_MACHINE',
      data: { id: 'M-01', status: 'ACTIVE' },
    });

    expect(SyncQueueService.getQueueStatus().queueLength).toBe(2);

    SyncQueueService.setOnlineStatus(true);
    await SyncQueueService.processQueue();

    expect(SyncQueueService.getQueueStatus().queueLength).toBe(0);
  });

  it('should resolve conflicts using Last-Write-Wins strategy', () => {
    const olderRecord = { id: 'M-01', nom: 'Old Name', updatedAt: '2026-10-01T10:00:00Z' };
    const newerRecord = { id: 'M-01', nom: 'New Name', updatedAt: '2026-10-05T12:00:00Z' };

    const resolved = SyncQueueService.resolveConflict(olderRecord, newerRecord);
    expect(resolved.nom).toBe('New Name');
  });
});

