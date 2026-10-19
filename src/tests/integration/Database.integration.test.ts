
import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseService } from '../../core/database/DatabaseService';

describe('DatabaseService Integration', () => {
  let db;

  beforeAll(async () => {
    db = new DatabaseService();
  });

  it('should store and retrieve data correctly', async () => {
    const testData = { id: 'test-1', value: 'Hello DB' };
    await db.save('testTable', testData);
    
    const retrieved = await db.getById('testTable', 'test-1');
    expect(retrieved).toEqual(testData);
  });
});
