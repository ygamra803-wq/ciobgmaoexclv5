import { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  Gauge,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Cpu,
  Clock,
  TrendingUp,
  TrendingDown,
  LineChart,
  Play,
  Layers,
} from 'lucide-react';

import { realtimeMetricsService } from '../../../services/realtimeMetricsService';
import { multiLevelCacheManager } from '../../../core/cache/MultiLevelCacheManager';
import { alertThresholdManager } from '../../../services/alertThresholdManager';
import { trendAnalysisService } from '../../../services/trendAnalysisService';
import { MemoryOptimizer } from '../../../services/memoryOptimizer';
import { FormulaEngineOptimizer } from '../../../utils/formulaEngineOptimizer';
import { confirmAction } from '../../../utils/confirmAction';
import { StockCalculationService } from '../../../domain/pdr/services/StockCalculationService';
import SyncButtons from '../common/SyncButtons';
import {
  SettingsSectionCard,
  SETTINGS_BUTTON_STYLES,
} from '../../pages/settings/components/settingsUi';

export default function PerformanceDashboardPanel({
  rawStock = [],
  mouvements = [],
  showToast,
}) {
  const [metrics, setMetrics] = useState(() => realtimeMetricsService.getSnapshot());
  const [alerts, setAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [trendReport, setTrendReport] = useState(() => trendAnalysisService.getReport());
  const [cacheMetrics, setCacheMetrics] = useState(() => multiLevelCacheManager.getMetrics());
  const [isWarming, setIsWarming] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState(null);

  // Start real-time metrics tracking on mount
  useEffect(() => {
    realtimeMetricsService.start();

    const unsubMetrics = realtimeMetricsService.subscribe((newMetrics) => {
      setMetrics(newMetrics);
      // Record snapshot into trend analysis and alert threshold manager
      trendAnalysisService.record(newMetrics);
      alertThresholdManager.evaluate(newMetrics);
      setCacheMetrics(multiLevelCacheManager.getMetrics());
    });

    const unsubAlerts = alertThresholdManager.subscribe((active, history) => {
      setAlerts(active);
      setAlertHistory(history);
    });

    const unsubTrends = trendAnalysisService.subscribe((report) => {
      setTrendReport(report);
    });

    return () => {
      unsubMetrics();
      unsubAlerts();
      unsubTrends();
    };
  }, []);

  // Handle Cache Warming
  const handleCacheWarming = async () => {
    setIsWarming(true);
    try {
      const res = await multiLevelCacheManager.warmUpCache(rawStock, mouvements);
      setCacheMetrics(multiLevelCacheManager.getMetrics());
      showToast?.(
        `🔥 Cache Warming terminé : ${res.warmedEntries} entrées pré-calculées en ${res.durationMs}ms !`,
        'success'
      );
    } catch {
      showToast?.('Erreur lors du Cache Warming', 'error');
    } finally {
      setIsWarming(false);
    }
  };

  // Handle Cache Invalidation by Tag
  const handleInvalidateTag = async (tag) => {
    await multiLevelCacheManager.invalidateByTag(tag);
    setCacheMetrics(multiLevelCacheManager.getMetrics());
    showToast?.(`Tag de cache [${tag}] invalidé avec succès.`, 'info');
  };

  // Handle Clear All Caches
  const handleClearAllCaches = async () => {
    if (
      await confirmAction({
        title: 'Réinitialiser les caches',
        message: 'Voulez-vous réinitialiser tous les niveaux de cache (L1, L2, L3) ?',
        variant: 'warning',
      })
    ) {
      await multiLevelCacheManager.clearAll();
      StockCalculationService.clearCache();
      FormulaEngineOptimizer.clearMemoCache();
      setCacheMetrics(multiLevelCacheManager.getMetrics());
      showToast?.('Tous les niveaux de cache ont été réinitialisés.', 'info');
    }
  };

  // Handle Memory Purge
  const handlePurgeMemory = () => {
    MemoryOptimizer.purgeMemory();
    setCacheMetrics(multiLevelCacheManager.getMetrics());
    showToast?.('Purge mémoire effectuée avec succès.', 'success');
  };

  // Run Formula Engine Live Benchmark
  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkResult(null);

    setTimeout(() => {
      const start = performance.now();
      const count = 1000;

      // Execute 1,000 formula calculations
      for (let i = 0; i < count; i++) {
        const art = rawStock[i % Math.max(1, rawStock.length)] || { stockInitial: 10, seuil: 2 };
        StockCalculationService.calculateStockActuel(art, mouvements);
      }

      const duration = performance.now() - start;
      const opsPerSec = Math.round((count / duration) * 1000);
      const avgLatency = (duration / count).toFixed(3);

      realtimeMetricsService.recordFormulaLatency(Number(avgLatency));

      setBenchmarkResult({
        totalCalculations: count,
        totalTimeMs: Number(duration.toFixed(2)),
        opsPerSec,
        avgLatencyMs: avgLatency,
      });

      setIsBenchmarking(false);
      showToast?.(`Benchmark terminé : ${opsPerSec.toLocaleString()} ops/sec !`, 'success');
    }, 50);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner (Light Industrial Card) */}
      <SettingsSectionCard
        title={
          <span className="flex items-center gap-2 flex-wrap">
            <span>Supervision des Performances &amp; Cache Multi-Niveaux</span>
            <span className="text-[10px] bg-slate-100 text-sky-900 font-mono font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
              Moteur Temps Réel
            </span>
          </span>
        }
        description="Supervision en temps réel du Caching Multi-Niveaux (L1/L2/L3), de la latence du moteur de formules et de la mémoire vive."
        icon={<Activity />}
        headerRight={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCacheWarming}
              disabled={isWarming}
              className={SETTINGS_BUTTON_STYLES.warning}
            >
              <Flame className={`w-4 h-4 text-amber-600 ${isWarming ? 'animate-spin' : ''}`} />
              <span>{isWarming ? 'Warming...' : 'Pré-chauffer Cache'}</span>
            </button>

            <button
              type="button"
              onClick={handlePurgeMemory}
              className={SETTINGS_BUTTON_STYLES.dangerSoft}
            >
              <Trash2 className="w-4 h-4" />
              <span>Purge Mémoire</span>
            </button>
          </div>
        }
      >
        <SyncButtons showToast={showToast} />
      </SettingsSectionCard>

      {/* Real-time Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: FPS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-emerald-600" /> Fluidité Affichage (FPS)
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                metrics.fps >= 45
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : metrics.fps >= 30
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {metrics.fps >= 45 ? 'Optimal' : metrics.fps >= 30 ? 'Moyen' : 'Critique'}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
              {metrics.fps} <span className="text-xs font-normal text-slate-500">FPS</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">Cible: 60 FPS</div>
          </div>
        </div>

        {/* Metric 2: Event Loop Lag */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" /> Lag Thread Principal
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                metrics.eventLoopLagMs <= 50
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : metrics.eventLoopLagMs <= 150
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {metrics.eventLoopLagMs <= 50 ? 'Fluide' : 'Latence'}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
              {metrics.eventLoopLagMs} <span className="text-xs font-normal text-slate-500">ms</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">P95: {trendReport.lagTrend.p95}ms</div>
          </div>
        </div>

        {/* Metric 3: Cache Hit Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-sky-700" /> Taux de Succès Cache
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-sky-900 border border-slate-200">
              L1/L2/L3 Active
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
              {cacheMetrics.hitRate}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Hits: {cacheMetrics.totalHits}
            </div>
          </div>
        </div>

        {/* Metric 4: Formula Latency */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-600" /> Latence Calcul Formules
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
              O(1) Indexed
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
              {metrics.formulaAvgLatencyMs} <span className="text-xs font-normal text-slate-500">ms</span>
            </div>
            <div className="text-xs text-emerald-600 font-mono font-bold">
              +{cacheMetrics.totalSavedMs}ms sauvés
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Caching Strategy Manager */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-600" />
              Stratégie de Caching Multi-Niveaux (L1 / L2 / L3)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestion de la mémoire vive (L1), du stockage persistant (L2) et du cache de formules de calcul (L3).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleInvalidateTag('stock')}
              className={SETTINGS_BUTTON_STYLES.secondary}
            >
              Invalider Tag Stock
            </button>
            <button
              type="button"
              onClick={() => handleInvalidateTag('formula')}
              className={SETTINGS_BUTTON_STYLES.secondary}
            >
              Invalider Tag Formules
            </button>
            <button
              type="button"
              onClick={handleClearAllCaches}
              className={SETTINGS_BUTTON_STYLES.dangerSoft}
            >
              Vider Tout le Cache
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* L1 Memory Cache Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">L1 - Memory Cache</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold">
                RAM Fast
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>Entrées actives:</span>
                <span className="font-bold text-slate-900">{cacheMetrics.l1Size}</span>
              </div>
              <div className="flex justify-between">
                <span>Succès (Hits):</span>
                <span className="font-bold text-emerald-600">{cacheMetrics.l1Hits}</span>
              </div>
            </div>
          </div>

          {/* L2 Persistent Storage Cache Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">L2 - Storage Persistent</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-white text-sky-800 border border-slate-200 rounded-md font-bold">
                IndexedDB
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>Stratégie fallback:</span>
                <span className="font-bold text-slate-900">{cacheMetrics.l2Info?.activeTier || 'IndexedDB'}</span>
              </div>
              <div className="flex justify-between">
                <span>Succès (Hits):</span>
                <span className="font-bold text-sky-800">{cacheMetrics.l2Hits}</span>
              </div>
            </div>
          </div>

          {/* L3 Formula Calculation Cache Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">L3 - Formula Engine</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-sky-900 border border-slate-200 rounded-md font-bold">
                Formula Map
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>Formules en Cache:</span>
                <span className="font-bold text-slate-900">{cacheMetrics.l3Size}</span>
              </div>
              <div className="flex justify-between">
                <span>Entrées Pré-chauffées:</span>
                <span className="font-bold text-sky-800">{cacheMetrics.warmedEntriesCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Optimization & Benchmark */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Formula Engine Live Benchmark */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-600" />
                Benchmark Moteur de Formules
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Test de charge direct (1 000 iterations de calculs de stock twin).
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunBenchmark}
              disabled={isBenchmarking}
              className={SETTINGS_BUTTON_STYLES.primary}
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isBenchmarking ? 'Calcul...' : 'Lancer Benchmark'}</span>
            </button>
          </div>

          {benchmarkResult ? (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/70 text-xs space-y-2">
              <div className="flex justify-between font-bold text-emerald-900">
                <span>Vitesse d'exécution:</span>
                <span className="font-mono text-sm">{benchmarkResult.opsPerSec.toLocaleString()} ops/sec</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-mono">
                <span>Temps total (1000 ops):</span>
                <span>{benchmarkResult.totalTimeMs} ms</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-mono">
                <span>Latence moyenne / calcul:</span>
                <span>{benchmarkResult.avgLatencyMs} ms</span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-slate-200/60">
              Cliquez sur "Lancer Benchmark" pour évaluer la vitesse de calcul en ops/sec.
            </div>
          )}
        </div>

        {/* Real-time Alert System */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Alertes & Seuils de Performance ({alerts.length})
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Surveillance automatique des dépassements de seuils (FPS, Lag, Formules).
              </p>
            </div>
            {alertHistory.length > 0 && (
              <button
                onClick={() => alertThresholdManager.clearHistory()}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Vider Journal
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {alerts.length === 0 && alertHistory.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-emerald-700 border border-emerald-200/60 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Aucune alerte active. Tous les métriques sont dans les seuils normaux.
              </div>
            ) : (
              (alerts.length > 0 ? alerts : alertHistory.slice(0, 5)).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                    alert.severity === 'critical'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        alert.severity === 'critical' ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    />
                    <span className="font-medium">{alert.message}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0">{alert.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Trend Analysis */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LineChart className="w-4 h-4 text-sky-700" />
              Analyse des Tendances Temporelles (Trend Analysis)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Évolution et moyennes mobiles sur les 60 derniers points de mesure.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            {trendReport.snapshotCount} snapshots enregistrés
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="text-[11px] text-slate-500 font-medium">Tendance FPS</div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold font-mono text-slate-900">
                Moy: {trendReport.fpsTrend.avg} FPS
              </span>
              <span
                className={`flex items-center text-xs font-bold ${
                  trendReport.fpsTrend.direction === 'improving'
                    ? 'text-emerald-600'
                    : trendReport.fpsTrend.direction === 'degrading'
                    ? 'text-rose-600'
                    : 'text-slate-500'
                }`}
              >
                {trendReport.fpsTrend.direction === 'improving' ? (
                  <TrendingUp className="w-3.5 h-3.5 mr-1" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 mr-1" />
                )}
                {trendReport.fpsTrend.direction}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Min: {trendReport.fpsTrend.min} | Max: {trendReport.fpsTrend.max}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="text-[11px] text-slate-500 font-medium">Tendance Lag Thread</div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold font-mono text-slate-900">
                Moy: {trendReport.lagTrend.avg} ms
              </span>
              <span className="text-xs font-mono text-slate-500">
                P95: {trendReport.lagTrend.p95} ms
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Min: {trendReport.lagTrend.min}ms | Max: {trendReport.lagTrend.max}ms
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="text-[11px] text-slate-500 font-medium">Tendance Latence Formules</div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold font-mono text-slate-900">
                Moy: {trendReport.formulaTrend.avg} ms
              </span>
              <span className="text-xs font-mono text-emerald-600 font-bold">
                O(1)
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Min: {trendReport.formulaTrend.min}ms | Max: {trendReport.formulaTrend.max}ms
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
