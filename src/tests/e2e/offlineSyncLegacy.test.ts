import { describe, it, expect, beforeEach } from 'vitest';

describe('Offline Sync E2E simulation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should store and retrieve offline items correctly', () => {
    const testItem = { id: 1, ref: 'TEST-01', designation: 'Test Article' };
    localStorage.setItem('gmao_offline_sync', JSON.stringify([testItem]));

    const retrieved = JSON.parse(localStorage.getItem('gmao_offline_sync'));
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].ref).toBe('TEST-01');
  });
});
