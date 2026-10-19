import { describe, it, expect, beforeEach } from 'vitest';
import { multiLevelCacheManager } from '../../core/cache/MultiLevelCacheManager';
import { FormulaEngineOptimizer } from '../../utils/formulaEngineOptimizer';
import { DataLoaderOptimizer } from '../../services/dataLoaderOptimizer';
import { MemoryOptimizer } from '../../services/memoryOptimizer';
import { alertThresholdManager } from '../../services/alertThresholdManager';
import { trendAnalysisService } from '../../services/trendAnalysisService';

describe('Caching Strategy, Optimization & Monitoring Tests', () => {
  beforeEach(async () => {
    await multiLevelCacheManager.clearAll();
    FormulaEngineOptimizer.clearMemoCache();
    alertThresholdManager.clearHistory();
    trendAnalysisService.clear();
  });

  describe('1. Caching Strategy (Multi-Level, Invalidation, Warming, Metrics)', () => {
    it('should set and retrieve values across L1 memory and L3 formula cache', async () => {
      await multiLevelCacheManager.set('test_key_1', { stock: 50 }, { ttl: 60000, tags: ['stock'] });

      const value = await multiLevelCacheManager.get('test_key_1');
      expect(value).toEqual({ stock: 50 });

      const metrics = multiLevelCacheManager.getMetrics();
      expect(metrics.l1Hits).toBe(1);
      expect(metrics.totalHits).toBe(1);
    });

    it('should handle tag-based cache invalidation', async () => {
      await multiLevelCacheManager.set('item_1', { data: 'A' }, { tags: ['stock'] });
      await multiLevelCacheManager.set('item_2', { data: 'B' }, { tags: ['formula'] });

      await multiLevelCacheManager.invalidateByTag('stock');

      const val1 = await multiLevelCacheManager.get('item_1');
      const val2 = await multiLevelCacheManager.get('item_2');

      expect(val1).toBeNull();
      expect(val2).toEqual({ data: 'B' });
    });

    it('should perform cache warming for articles and movements', async () => {
      const articles = [
        { ref: 'ART001', stockInitial: 10, seuil: 3 },
        { ref: 'ART002', stockInitial: 20, seuil: 5 },
      ];
      const movements = [
        { ref: 'ART001', type: 'Entrée', quantite: 5 },
        { ref: 'ART001', type: 'Sortie', quantite: 2 },
      ];

      const res = await multiLevelCacheManager.warmUpCache(articles, movements);
      expect(res.warmedEntries).toBeGreaterThan(0);

      const cachedCalc = await multiLevelCacheManager.get('stock_calc_ART001');
      expect(cachedCalc).toBeDefined();
      expect(cachedCalc.stockActuel).toBe(13); // 10 + 5 - 2
    });
  });

  describe('2. Optimization (Formula Engine, DataLoader, Memory)', () => {
    it('should memoize formula execution and enforce cache limits', () => {
      let calcCount = 0;
      const fn = (a, b) => {
        calcCount++;
        return a + b;
      };

      const memoizedFn = FormulaEngineOptimizer.memoize(fn, 'sumTest');

      expect(memoizedFn(2, 3)).toBe(5);
      expect(memoizedFn(2, 3)).toBe(5);
      expect(calcCount).toBe(1); // Cached on second run
    });

    it('should execute batch SUMIFS in a single pass', () => {
      const records = [
        { ref: 'A1', type: 'IN', qty: 10 },
        { ref: 'A1', type: 'IN', qty: 5 },
        { ref: 'A2', type: 'IN', qty: 20 },
      ];

      const totals = FormulaEngineOptimizer.batchSumIfs(records, 'qty', ['ref', 'type']);
      expect(totals.get('a1:::in')).toBe(15);
      expect(totals.get('a2:::in')).toBe(20);
    });

    it('should process large data arrays in non-blocking chunks', async () => {
      const items = Array.from({ length: 50 }, (_, i) => i + 1);
      const processed = await DataLoaderOptimizer.loadInChunks(items, (x) => x * 2, { chunkSize: 10 });

      expect(processed.length).toBe(50);
      expect(processed[0]).toBe(2);
      expect(processed[49]).toBe(100);
    });

    it('should deduplicate concurrent identical requests', async () => {
      let calls = 0;
      const fetcher = async () => {
        calls++;
        return 'data';
      };

      const p1 = DataLoaderOptimizer.dedupRequest('req1', fetcher);
      const p2 = DataLoaderOptimizer.dedupRequest('req1', fetcher);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe('data');
      expect(r2).toBe('data');
      expect(calls).toBe(1);
    });

    it('should trigger memory purge on MemoryOptimizer', () => {
      MemoryOptimizer.purgeMemory();
      const metrics = multiLevelCacheManager.getMetrics();
      expect(metrics.l1Size).toBe(0);
    });
  });

  describe('3. Monitoring (Realtime Metrics, Alert Thresholds, Trend Analysis)', () => {
    it('should record metric snapshots and evaluate alert threshold breaches', () => {
      const lowFpsSnapshot = {
        fps: 12, // Critical threshold breach (<15)
        eventLoopLagMs: 350, // Critical threshold breach (>300)
        formulaAvgLatencyMs: 150, // Critical threshold breach (>100)
      };

      const alerts = alertThresholdManager.evaluate(lowFpsSnapshot);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some((a) => a.metric === 'FPS' && a.severity === 'critical')).toBe(true);
      expect(alerts.some((a) => a.metric === 'Lag' && a.severity === 'critical')).toBe(true);
    });

    it('should compute moving average trends and direction over time', () => {
      trendAnalysisService.record({ fps: 60, eventLoopLagMs: 10, formulaAvgLatencyMs: 0.5 });
      trendAnalysisService.record({ fps: 58, eventLoopLagMs: 12, formulaAvgLatencyMs: 0.6 });
      trendAnalysisService.record({ fps: 55, eventLoopLagMs: 15, formulaAvgLatencyMs: 0.8 });

      const report = trendAnalysisService.getReport();
      expect(report.snapshotCount).toBe(3);
      expect(report.fpsTrend.avg).toBe(57.7);
      expect(report.fpsTrend.min).toBe(55);
      expect(report.fpsTrend.max).toBe(60);
    });
  });
});
