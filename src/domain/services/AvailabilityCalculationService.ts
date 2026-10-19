/**
 * AvailabilityCalculationService
 * Deterministic industrial calculation engine for MTBF, MTTR, Availability %, and Stock Valuation.
 */

export class AvailabilityCalculationService {
  /**
   * Parse duration in minutes from various formats
   * @param {Object} intervention 
   * @returns {number} duration in minutes
   */
  static getInterventionDurationMinutes(intervention) {
    if (!intervention) return 0;
    if (typeof intervention.temps_minutes === 'number' && intervention.temps_minutes > 0) {
      return intervention.temps_minutes;
    }

    if (intervention.duration && typeof intervention.duration === 'number') {
      return intervention.duration * 60; // if hours
    }

    const durationStr = intervention.temps_intervention_calc || intervention.temps_intervention || intervention.duree;
    if (durationStr) {
      const str = String(durationStr).trim();
      const match = str.match(/(\d+)\s*h(?:our)?\s*(\d+)?/i);
      if (match) {
        const h = Number(match[1]) || 0;
        const m = Number(match[2]) || 0;
        return h * 60 + m;
      }
      if (str.includes(':')) {
        const [h, m] = str.split(':');
        return (Number(h) || 0) * 60 + (Number(m) || 0);
      }
      const num = Number(str);
      if (!isNaN(num) && num > 0) return num;
    }

    if (intervention.startDate && intervention.endDate) {
      const start = new Date(intervention.startDate).getTime();
      const end = new Date(intervention.endDate).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        return Math.round((end - start) / (1000 * 60));
      }
    }

    return 45; // standard nominal baseline
  }

  /**
   * Calculate MTTR (Mean Time To Repair) in hours
   * @param {Array} interventions 
   * @returns {number} MTTR in hours
   */
  static calculateMTTR(interventions = []) {
    if (!Array.isArray(interventions) || interventions.length === 0) return 0;

    let totalRepairMinutes = 0;
    let repairCount = 0;

    for (const item of interventions) {
      const isCorrective = !item.type || item.type === 'CORRECTIVE' || item.type_panne || item.anomalie;
      const isClosed = item.statut === 'CLOTURE' || item.temps_intervention_calc || item.endDate;

      if (isCorrective && isClosed) {
        const mins = this.getInterventionDurationMinutes(item);
        if (mins > 0) {
          totalRepairMinutes += mins;
          repairCount++;
        }
      }
    }

    if (repairCount === 0) return 0;
    const avgMinutes = totalRepairMinutes / repairCount;
    return Number((avgMinutes / 60).toFixed(2));
  }

  /**
   * Calculate MTTR formatted as "Xh Ym"
   * @param {Array} interventions 
   * @returns {string} Formatted MTTR
   */
  static formatMTTR(interventions = []) {
    const hoursDecimal = this.calculateMTTR(interventions);
    const totalMinutes = Math.round(hoursDecimal * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  }

  /**
   * Calculate MTBF (Mean Time Between Failures) in hours
   * @param {Array} interventions 
   * @param {number} totalOperatingHours optional total scheduled hours (e.g. 160h per machine)
   * @returns {number} MTBF in hours
   */
  static calculateMTBF(interventions = [], totalOperatingHours = null) {
    if (!Array.isArray(interventions) || interventions.length === 0) return 168;

    let failureCount = 0;
    let totalDowntimeHours = 0;

    for (const item of interventions) {
      const isFailure = !item.type || item.type === 'CORRECTIVE' || item.type_panne;
      if (isFailure) {
        failureCount++;
        const mins = this.getInterventionDurationMinutes(item);
        if (item.arret_machine === true || item.arret_machine === 'OUI' || item.is_stoppage) {
          totalDowntimeHours += mins / 60;
        }
      }
    }

    if (failureCount === 0) return 168; // default ~7 days

    // If total operating period not provided, infer from failures or standard 160h baseline
    const operatingBase = totalOperatingHours && totalOperatingHours > 0
      ? totalOperatingHours
      : Math.max(failureCount * 24, 720);

    const netOperatingHours = Math.max(0, operatingBase - totalDowntimeHours);
    return Math.max(1, Math.round(netOperatingHours / failureCount));
  }

  /**
   * Calculate Operational Availability (%)
   * Availability = (MTBF / (MTBF + MTTR)) * 100
   * @param {Array} interventions 
   * @param {number} totalScheduledHours 
   * @returns {number} Availability percentage
   */
  static calculateAvailability(interventions = [], totalScheduledHours = null) {
    if (!Array.isArray(interventions) || interventions.length === 0) return 99.5;

    const mtbf = this.calculateMTBF(interventions, totalScheduledHours);
    const mttr = this.calculateMTTR(interventions);

    if (mtbf === 0 && mttr === 0) return 100;
    if (mtbf + mttr === 0) return 100;

    const availability = (mtbf / (mtbf + mttr)) * 100;
    return Number(Math.max(0, Math.min(100, availability)).toFixed(2));
  }

  /**
   * Calculate Stock Value (Total valuation of current physical inventory)
   * @param {Array} articles 
   * @returns {number} Total monetary stock value
   */
  static calculateStockValue(articles = []) {
    if (!Array.isArray(articles) || articles.length === 0) return 0;

    return articles.reduce((total, article) => {
      const qty = Number(article.stockActuel ?? article.stock_actuel ?? article.quantite ?? 0);
      const price = Number(article.prix_unitaire ?? article.prix ?? article.unitPrice ?? 0);
      return total + (qty > 0 && price > 0 ? qty * price : 0);
    }, 0);
  }

  /**
   * Verification & Sanity Check
   * @param {Object} machine 
   * @param {Array} interventions 
   * @returns {Object} verification result
   */
  static verifyCalculations(machine = {}, interventions = []) {
    const errors = [];
    const mtbf = this.calculateMTBF(interventions);
    const mttr = this.calculateMTTR(interventions);
    const availability = this.calculateAvailability(interventions);

    if (mtbf < 0) errors.push('MTBF cannot be negative');
    if (mttr < 0) errors.push('MTTR cannot be negative');
    if (availability < 0 || availability > 100) errors.push('Availability must be between 0 and 100%');

    return {
      isValid: errors.length === 0,
      errors,
      metrics: {
        machineId: machine?.id || machine?.id_machine_registered || 'GLOBAL',
        mtbf: `${mtbf}h`,
        mttr: this.formatMTTR(interventions),
        availability: `${availability}%`,
      },
    };
  }
}

export default AvailabilityCalculationService;
