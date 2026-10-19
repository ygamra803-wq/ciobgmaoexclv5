// ✅ ملف: src/tests/performance/IncrementalStockIndex.bench.ts

import { describe, it, expect } from 'vitest';
import IncrementalStockIndex from '@/core/domain/services/IncrementalStockIndex';

describe('IncrementalStockIndex - Performance', () => {
  it('should handle 10,000 items with 100,000 movements in < 500ms', () => {
    const index = new IncrementalStockIndex();

    // إنشاء بيانات اختبار
    const initialStocks = new Map<string, number>();
    for (let i = 0; i < 10000; i++) {
      initialStocks.set(`ITEM-${i}`, Math.floor(Math.random() * 1000));
    }

    const movements = [];
    for (let i = 0; i < 100000; i++) {
      movements.push({
        itemId: `ITEM-${Math.floor(Math.random() * 10000)}`,
        type: Math.random() > 0.5 ? 'IN' : 'OUT',
        quantity: Math.floor(Math.random() * 100) + 1,
      });
    }

    const start = performance.now();
    index.buildIndex(movements, initialStocks);
    const duration = performance.now() - start;

    console.log(`✅ Built index for 10,000 items with 100,000 movements in ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(500);
  });

  it('should get stock in O(1) time', () => {
    const index = new IncrementalStockIndex();
    const initialStocks = new Map([['ITEM-1', 100]]);
    index.buildIndex([], initialStocks);

    const start = performance.now();
    for (let i = 0; i < 1000000; i++) {
      index.getStock('ITEM-1');
    }
    const duration = performance.now() - start;

    console.log(`✅ 1,000,000 lookups in ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(500);
  });

  it('should perform O(1) incremental movement additions', () => {
    const index = new IncrementalStockIndex();
    const initialStocks = new Map([['ITEM-A', 50]]);
    index.buildIndex([], initialStocks);

    index.addMovement({ itemId: 'ITEM-A', type: 'IN', quantity: 25 });
    expect(index.getStock('ITEM-A')).toBe(75);

    index.addMovement({ itemId: 'ITEM-A', type: 'OUT', quantity: 15 });
    expect(index.getStock('ITEM-A')).toBe(60);

    expect(index.getMovements('ITEM-A')).toHaveLength(2);
  });
});
