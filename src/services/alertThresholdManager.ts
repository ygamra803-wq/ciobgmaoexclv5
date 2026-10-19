import { Logger } from '../core/logger/LoggerService';

/**
 * AlertThresholdManager
 * Configurable alert rules and real-time performance breach detector.
 */
export class AlertThresholdManager {
  static instance = null;

  constructor() {
    if (AlertThresholdManager.instance) {
      return AlertThresholdManager.instance;
    }

    this.rules = {
      fpsWarning: 30,
      fpsCritical: 15,
      memoryWarningRatio: 0.75,
      memoryCriticalRatio: 0.90,
      lagWarningMs: 100,
      lagCriticalMs: 300,
      formulaWarningMs: 20,
      formulaCriticalMs: 100,
      cacheMinHitRate: 40.0,
    };

    this.activeAlerts = [];
    this.alertHistory = [];
    this.maxHistorySize = 100;
    this.subscribers = new Set();

    AlertThresholdManager.instance = this;
  }

  /**
   * Evaluate metric snapshot against rules
   */
  evaluate(metrics) {
    if (!metrics) return [];

    const newAlerts = [];
    const timestamp = new Date().toLocaleTimeString('fr-FR');

    // 1. FPS Check
    if (metrics.fps <= this.rules.fpsCritical) {
      newAlerts.push({
        id: `fps-crit-${Date.now()}`,
        metric: 'FPS',
        severity: 'critical',
        message: `Chute critique de fluidité d'affichage : ${metrics.fps} FPS (Seuil < ${this.rules.fpsCritical})`,
        value: metrics.fps,
        timestamp,
      });
    } else if (metrics.fps <= this.rules.fpsWarning) {
      newAlerts.push({
        id: `fps-warn-${Date.now()}`,
        metric: 'FPS',
        severity: 'warning',
        message: `Baisse de fluidité d'affichage : ${metrics.fps} FPS (Seuil < ${this.rules.fpsWarning})`,
        value: metrics.fps,
        timestamp,
      });
    }

    // 2. Event Loop Lag Check
    if (metrics.eventLoopLagMs >= this.rules.lagCriticalMs) {
      newAlerts.push({
        id: `lag-crit-${Date.now()}`,
        metric: 'Lag',
        severity: 'critical',
        message: `Blocage critique du thread principal : ${metrics.eventLoopLagMs}ms (Seuil > ${this.rules.lagCriticalMs}ms)`,
        value: `${metrics.eventLoopLagMs}ms`,
        timestamp,
      });
    } else if (metrics.eventLoopLagMs >= this.rules.lagWarningMs) {
      newAlerts.push({
        id: `lag-warn-${Date.now()}`,
        metric: 'Lag',
        severity: 'warning',
        message: `Ralentissement du thread principal : ${metrics.eventLoopLagMs}ms (Seuil > ${this.rules.lagWarningMs}ms)`,
        value: `${metrics.eventLoopLagMs}ms`,
        timestamp,
      });
    }

    // 3. Formula Latency Check
    if (metrics.formulaAvgLatencyMs >= this.rules.formulaCriticalMs) {
      newAlerts.push({
        id: `formula-crit-${Date.now()}`,
        metric: 'Formules',
        severity: 'critical',
        message: `Latence critique du moteur de calcul : ${metrics.formulaAvgLatencyMs}ms (Seuil > ${this.rules.formulaCriticalMs}ms)`,
        value: `${metrics.formulaAvgLatencyMs}ms`,
        timestamp,
      });
    } else if (metrics.formulaAvgLatencyMs >= this.rules.formulaWarningMs) {
      newAlerts.push({
        id: `formula-warn-${Date.now()}`,
        metric: 'Formules',
        severity: 'warning',
        message: `Temps de calcul élevé : ${metrics.formulaAvgLatencyMs}ms (Seuil > ${this.rules.formulaWarningMs}ms)`,
        value: `${metrics.formulaAvgLatencyMs}ms`,
        timestamp,
      });
    }

    this.activeAlerts = newAlerts;

    if (newAlerts.length > 0) {
      for (const alert of newAlerts) {
        // Prevent duplicate spam in history within 5 seconds
        const isRecent = this.alertHistory.some(
          (h) => h.metric === alert.metric && h.severity === alert.severity && Date.now() - h.timeRaw < 5000
        );
        if (!isRecent) {
          this.alertHistory.unshift({ ...alert, timeRaw: Date.now() });
          if (this.alertHistory.length > this.maxHistorySize) {
            this.alertHistory.pop();
          }
          Logger.warn(`🚨 Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`, null, 'AlertThresholds');
        }
      }
    }

    this.notifySubscribers();
    return newAlerts;
  }

  /**
   * Subscribe to alert triggers
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.activeAlerts, this.alertHistory);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    for (const sub of this.subscribers) {
      try {
        sub(this.activeAlerts, this.alertHistory);
      } catch (err) {
        Logger.error('Alert subscriber error:', err, 'AlertThresholds');
      }
    }
  }

  clearHistory() {
    this.alertHistory = [];
    this.activeAlerts = [];
    this.notifySubscribers();
  }
}

export const alertThresholdManager = new AlertThresholdManager();
export default alertThresholdManager;
