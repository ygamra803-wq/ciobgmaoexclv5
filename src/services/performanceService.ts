import { Logger } from '../core/logger/LoggerService';

/**
 * Service de Surveillance et Mesure des Performances (Performance Monitoring)
 * Permet d'analyser le temps d'exécution des calculs Excel Twin, la consommation mémoire et la latence UI.
 */
class PerformanceService {
  constructor() {
    this.metrics = new Map();
    this.thresholds = {
      slow: 1000, // 1 seconde
      verySlow: 3000, // 3 secondes
    };
  }

  /**
   * Mesure la durée et l'impact mémoire d'une fonction asynchrone ou synchrone
   */
  async measure(name, fn, options = {}) {
    const start = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = await fn();
      const duration = performance.now() - start;
      const endMemory = this.getMemoryUsage();
      const memoryDelta = endMemory - startMemory;

      this.recordMetric(name, {
        duration,
        memoryDelta,
        status: 'success',
        timestamp: new Date().toISOString(),
        options,
      });

      // Avertissements en cas de dépassement de seuil
      if (duration > this.thresholds.verySlow) {
        Logger.error(`⚠️ Opération très lente: ${name} a pris ${duration.toFixed(2)}ms`, null, 'Performance');
      } else if (duration > this.thresholds.slow) {
        Logger.warn(`⚠️ Opération lente: ${name} a pris ${duration.toFixed(2)}ms`, null, 'Performance');
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(name, {
        duration,
        status: 'error',
        error: error?.message || 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Enregistrement d'un point métrique
   */
  recordMetric(name, metric) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const list = this.metrics.get(name);
    list.push(metric);

    // Conserver les 100 dernières mesures par opération
    if (list.length > 100) {
      list.shift();
    }
  }

  /**
   * Calcul des statistiques descriptives pour une opération
   */
  getStats(name) {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return null;

    const durations = metrics
      .filter((m) => m.status === 'success')
      .map((m) => m.duration);

    if (durations.length === 0) return null;

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const p95 = this.percentile(durations, 0.95);
    const p99 = this.percentile(durations, 0.99);

    return {
      count: metrics.length,
      avg: Number(avg.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      p99: Number(p99.toFixed(2)),
      errors: metrics.filter((m) => m.status === 'error').length,
    };
  }

  /**
   * Calcul du percentile
   */
  percentile(arr, p) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Obtention de la mémoire Heap JS en Mo (si disponible)
   */
  getMemoryUsage() {
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      return window.performance.memory.usedJSHeapSize / (1024 * 1024);
    }
    return 0;
  }

  /**
   * Affichage console du rapport global
   */
  printReport() {
    Logger.group('📊 Rapport de Performance CIOB GMAO', 'Performance');

    const data = Array.from(this.metrics.entries()).map(([name]) => {
      const stats = this.getStats(name);
      return {
        'Opération': name,
        'Moyenne (ms)': stats?.avg ?? 'N/A',
        'Min (ms)': stats?.min ?? 'N/A',
        'Max (ms)': stats?.max ?? 'N/A',
        'P95 (ms)': stats?.p95 ?? 'N/A',
        'Échantillons': stats?.count ?? 0,
        'Erreurs': stats?.errors ?? 0,
      };
    });

    Logger.table(data, 'Performance');
    Logger.groupEnd();
  }

  /**
   * Export du rapport au format CSV téléchargeable
   */
  exportReport() {
    if (typeof window === 'undefined') return;

    const report = Array.from(this.metrics.entries()).map(([name, metrics]) => ({
      name,
      stats: this.getStats(name),
      metrics,
    }));

    const csv = this.convertToCSV(report);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gmao-performance-report-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Conversion des données en CSV
   */
  convertToCSV(data) {
    const headers = ['Opération', 'Moyenne (ms)', 'Min (ms)', 'Max (ms)', 'P95 (ms)', 'Échantillons', 'Erreurs'];
    const rows = data.map((item) => [
      `"${item.name}"`,
      item.stats?.avg ?? 'N/A',
      item.stats?.min ?? 'N/A',
      item.stats?.max ?? 'N/A',
      item.stats?.p95 ?? 'N/A',
      item.stats?.count ?? 0,
      item.stats?.errors ?? 0,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Réinitialiser les métriques
   */
  clear() {
    this.metrics.clear();
  }
}

export const performanceService = new PerformanceService();
export default performanceService;
