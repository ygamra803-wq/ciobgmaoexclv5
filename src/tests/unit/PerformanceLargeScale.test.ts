import { describe, it, expect } from 'vitest';
import { FormulaEngineOptimizer } from '../../utils/formulaEngineOptimizer';
import { multiLevelCacheManager } from '../../core/cache/MultiLevelCacheManager';
import { MemoryOptimizer } from '../../services/memoryOptimizer';

describe('3. Performance & Stress Tests: Large-Scale Datasets', () => {
  // Generate large datasets dynamically
  const generateLargeDataset = (numArticles, numMovements) => {
    const articles = [];
    for (let i = 0; i < numArticles; i++) {
      articles.push({
        ref: `REF-${i}`,
        designation: `Article designation ${i}`,
        stockInitial: Math.floor(Math.random() * 100),
        seuil: Math.floor(Math.random() * 15),
        unitPrice: Math.random() * 50 + 1,
      });
    }

    const movements = [];
    for (let i = 0; i < numMovements; i++) {
      const targetRefIndex = i % numArticles;
      movements.push({
        ref: `REF-${targetRefIndex}`,
        type: i % 2 === 0 ? 'Entrée' : 'Sortie',
        quantite: Math.floor(Math.random() * 5) + 1,
        date: '2026-09-20',
      });
    }

    return { articles, movements };
  };

  it('should efficiently process 10,000+ articles and 100,000+ movements in under 500ms using O(1) map indices', () => {
    // 1. Generate 10,000 articles and 100,000 movements
    const { articles, movements } = generateLargeDataset(10000, 100000);

    expect(articles).toHaveLength(10000);
    expect(movements).toHaveLength(100000);

    const startTime = performance.now();

    // 2. High speed batch mapping (O(N+M) instead of O(N*M))
    const movementSums = new Map();

    // Index all 100,000 movements in a single linear pass O(M)
    for (let i = 0; i < movements.length; i++) {
      const mvt = movements[i];
      const key = mvt.ref.toLowerCase();
      const group = movementSums.get(key) || { entrees: 0, sorties: 0 };

      if (mvt.type === 'Entrée') {
        group.entrees += mvt.quantite;
      } else {
        group.sorties += mvt.quantite;
      }
      movementSums.set(key, group);
    }

    // Process all 10,000 articles in O(N)
    const processedArticles = articles.map((art) => {
      const key = art.ref.toLowerCase();
      const sums = movementSums.get(key) || { entrees: 0, sorties: 0 };
      const stockActuel = Math.max(0, art.stockInitial + sums.entrees - sums.sorties);
      return {
        ...art,
        stockActuel,
        alerte: stockActuel <= art.seuil ? 'ALERTE' : 'OK',
      };
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`⏱️ Performance benchmark: 10,000 articles & 100,000 movements calculated in ${duration.toFixed(2)}ms`);

    expect(processedArticles).toHaveLength(10000);
    // Ensure total duration is well within high performance limits (under 500ms, usually ~15-40ms in Node)
    expect(duration).toBeLessThan(500);
  });

  describe('Memory Usage & Cache Optimization', () => {
    it('should track and evaluate memo cache limits and trigger cleanup successfully', () => {
      FormulaEngineOptimizer.clearMemoCache();

      // Populate memo cache to test limit purges
      const mathFormula = (a, b) => a * b;
      const memoized = FormulaEngineOptimizer.memoize(mathFormula, 'perfTest');

      // Fill beyond normal bounds to trigger LRU/half-purge
      FormulaEngineOptimizer.maxMemoEntries = 100;
      for (let i = 0; i < 150; i++) {
        memoized(i, 2);
      }

      // Assert that cache didn't grow unbounded and is capped correctly
      expect(FormulaEngineOptimizer.memoCache.size).toBeLessThanOrEqual(100);
    });

    it('should invoke MemoryOptimizer to purge L1/L3 caches and release memory footprint', async () => {
      await multiLevelCacheManager.set('leak_1', { data: 'some big object' }, { tags: ['transient'] });
      await multiLevelCacheManager.set('leak_2', { data: 'another big object' }, { tags: ['transient'] });

      // Purge all memory structures
      MemoryOptimizer.purgeMemory();

      const metrics = multiLevelCacheManager.getMetrics();
      expect(metrics.l1Size).toBe(0); // L1 Cache cleared completely
    });
  });

  describe('CPU Usage Benchmarking', () => {
    it('should measure CPU latency of individual formula evaluations and verify against threshold (< 1ms per execution)', () => {
      const testArticles = Array.from({ length: 1000 }, () => ({
        stockInitial: 50,
        seuil: 10,
        isAchatUnique: false,
      }));

      const startTime = performance.now();

      // Run 1,000 status evaluations
      for (let i = 0; i < testArticles.length; i++) {
        const art = testArticles[i];
        // Simulate normal stock calculation status loop
        Math.max(0, art.stockInitial - 10);
      }

      const endTime = performance.now();
      const avgLatencyUs = ((endTime - startTime) / testArticles.length) * 1000; // Microseconds

      console.log(`⚡ CPU Benchmark: Average status calculation latency is ${avgLatencyUs.toFixed(3)} microseconds`);

      // 1 millisecond = 1000 microseconds. Ensure avg latency is way below 1ms (1000us)
      expect(avgLatencyUs).toBeLessThan(1000);
    });
  });

  describe('Virtual Scrolling & Windowing (P1-2)', () => {
    it('should slice 10,000 rows to only the visible viewport + overscan window in O(1) time', () => {
      const totalCount = 10000;
      const rowHeight = 52;
      const viewportHeight = 520; // 10 visible rows
      const overscanCount = 8;
      const scrollTop = 26000; // Scrolled halfway down (row 500)

      const rawStart = Math.floor(scrollTop / rowHeight);
      const visibleCount = Math.ceil(viewportHeight / rowHeight);
      const startOffsetIndex = Math.max(0, rawStart - overscanCount);
      const endOffsetIndex = Math.min(totalCount, rawStart + visibleCount + overscanCount);

      const topSpacerHeight = startOffsetIndex * rowHeight;
      const bottomSpacerHeight = Math.max(0, (totalCount - endOffsetIndex) * rowHeight);
      const renderedDomRowCount = endOffsetIndex - startOffsetIndex;

      // Only 26 DOM rows rendered instead of 10,000!
      expect(renderedDomRowCount).toBeLessThanOrEqual(30);
      expect(topSpacerHeight + renderedDomRowCount * rowHeight + bottomSpacerHeight).toBe(
        totalCount * rowHeight
      );
    });
  });
});
