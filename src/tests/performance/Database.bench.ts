import { describe, it, expect } from 'vitest';
import { DatabaseService } from '../../core/database/DatabaseService';

describe('Database Service Benchmarks', () => {
  const db = new DatabaseService();
  db.close();
  const testDb = new DatabaseService();

  it('Sequential save of 100 intervention records (< 500ms)', async () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await testDb.save('interventions', {
        id: `DI-BENCH-${i}`,
        code_machine: 'PRESS-A',
        statut: 'DEMANDE',
        anomalie: `Vibration excessive ${i}`,
      });
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(500);
  });

  it('Bulk read of all saved intervention records (< 100ms)', async () => {
    const start = performance.now();
    const all = await testDb.getAll('interventions');
    const duration = performance.now() - start;
    expect(Array.isArray(all)).toBe(true);
    expect(duration).toBeLessThan(100);
  });

  it('Query item by specific ID from database (< 50ms)', async () => {
    const start = performance.now();
    await testDb.getById('interventions', 'DI-BENCH-50');
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });
});

