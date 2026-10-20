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
  static parseDurationStringMinutes(durationStr: unknown): number {
    if (!durationStr) return 0;
    const str = String(durationStr).trim();
    if (!str) return 0;

    const match = str.match(/(\d+)\s*h(?:our|eure)?s?\s*(\d+)?/i);
    if (match) {
      const h = Number(match[1]) || 0;
      const m = Number(match[2]) || 0;
      return h * 60 + m;
    }
    if (str.includes(':')) {
      const [h, m] = str.split(':');
      return (Number(h) || 0) * 60 + (Number(m) || 0);
    }
    const minMatch = str.match(/^(\d+(?:\.\d+)?)\s*m(?:in)?/i);
    if (minMatch) {
      return Math.round(Number(minMatch[1]) || 0);
    }
    const num = Number(str);
    if (!isNaN(num) && num > 0) return num;
    return 0;
  }

  /**
   * Parse repair duration in minutes from all canonical & legacy intervention fields
   * @param {Object} intervention 
   * @returns {number} duration in minutes
   */
  static getInterventionDurationMinutes(intervention: any): number {
    if (!intervention) return 0;

    const explicitMins =
      Number(intervention.temps_intervention_mins) ||
      Number(intervention.temps_minutes) ||
      Number(intervention.dureeMinutes) ||
      Number(intervention.temps_arret_minutes) ||
      0;
    if (explicitMins > 0) {
      return explicitMins;
    }

    if (typeof intervention.duration === 'number' && intervention.duration > 0) {
      return Math.round(intervention.duration * 60);
    }
    if (typeof intervention.downtimeHours === 'number' && intervention.downtimeHours > 0) {
      return Math.round(intervention.downtimeHours * 60);
    }

    const parsedFromIntervention = this.parseDurationStringMinutes(
      intervention.temps_intervention_calc ||
      intervention.temps_intervention ||
      intervention.duree ||
      intervention.temps_arret
    );
    if (parsedFromIntervention > 0) {
      return parsedFromIntervention;
    }

    if (intervention.date_debut && intervention.date_fin) {
      const hDebut = intervention.heure_debut || '08:00';
      const hFin = intervention.heure_fin || '09:00';
      const start = new Date(`${intervention.date_debut}T${hDebut}`).getTime();
      const end = new Date(`${intervention.date_fin}T${hFin}`).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        return Math.round((end - start) / (1000 * 60));
      }
    }

    if (intervention.startDate && intervention.endDate) {
      const start = new Date(intervention.startDate).getTime();
      const end = new Date(intervention.endDate).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        return Math.round((end - start) / (1000 * 60));
      }
    }

    return 45; // standard nominal fallback only when no time field exists
  }

  /**
   * Parse machine stoppage / downtime duration in minutes
   */
  static getDowntimeMinutes(intervention: any): number {
    if (!intervention) return 0;
    if (typeof intervention.downtimeHours === 'number' && intervention.downtimeHours > 0) {
      return Math.round(intervention.downtimeHours * 60);
    }
    if (typeof intervention.temps_arret_minutes === 'number' && intervention.temps_arret_minutes > 0) {
      return intervention.temps_arret_minutes;
    }
    const parsedArret = this.parseDurationStringMinutes(
      intervention.temps_arret || intervention.duree_arret
    );
    if (parsedArret > 0) {
      return parsedArret;
    }
    return this.getInterventionDurationMinutes(intervention);
  }

  /**
   * Calculate MTTR (Mean Time To Repair) in hours
   * @param {Array} interventions 
   * @returns {number} MTTR in hours
   */
  static calculateMTTR(interventions: any[] = []): number {
    if (!Array.isArray(interventions) || interventions.length === 0) return 0;

    let totalRepairMinutes = 0;
    let repairCount = 0;

    for (const item of interventions) {
      const isCorrective = !item.type || item.type === 'CORRECTIVE' || item.type_panne || item.anomalie || item.code_machine;
      const status = String(item.statut || item.etat || '').toUpperCase();
      const isClosed =
        status === 'CLOTURE' ||
        status === 'FERME' ||
        status === 'TERMINE' ||
        Boolean(item.temps_intervention_mins) ||
        Boolean(item.temps_intervention_calc) ||
        Boolean(item.endDate);

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
  static formatMTTR(interventions: any[] = []): string {
    const hoursDecimal = this.calculateMTTR(interventions);
    const totalMinutes = Math.round(hoursDecimal * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  }

  /**
   * Calculate MTBF (Mean Time Between Failures) in hours
   * Formula: (Total Operating Time - Total Downtime) / Number of Failures
   * @param {Array} interventions 
   * @param {number} totalOperatingHours optional total scheduled hours (e.g. 160h per machine)
   * @returns {number} MTBF in hours
   */
  static calculateMTBF(interventions: any[] = [], totalOperatingHours: number | null = null): number {
    if (!Array.isArray(interventions) || interventions.length === 0) {
      return totalOperatingHours && totalOperatingHours > 0 ? Math.round(totalOperatingHours) : 168;
    }

    let failureCount = 0;
    let totalDowntimeHours = 0;

    for (const item of interventions) {
      const status = String(item.statut || item.etat || '').toUpperCase();
      if (status === 'ANNULE') continue;

      const isFailure = !item.type || item.type === 'CORRECTIVE' || item.type_panne || item.code_machine;
      if (isFailure) {
        failureCount++;
        const isStoppage =
          item.arret_machine === true ||
          item.arret_machine === 'OUI' ||
          item.is_stoppage ||
          typeof item.downtimeHours === 'number' ||
          Boolean(item.temps_arret);
        if (isStoppage) {
          const mins = this.getDowntimeMinutes(item);
          totalDowntimeHours += mins / 60;
        }
      }
    }

    if (failureCount === 0) {
      return totalOperatingHours && totalOperatingHours > 0 ? Math.round(totalOperatingHours) : 168;
    }

    // If total operating period not provided, infer from distinct machines (160h monthly shift per machine) or 720h baseline
    const distinctMachines = new Set(
      interventions
        .map((i) => i.code_machine || i.id_machine_registered || i.machine)
        .filter(Boolean)
    ).size;
    const inferredBase = Math.max(distinctMachines * 160, failureCount * 24, 160);
    const operatingBase =
      totalOperatingHours && totalOperatingHours > 0 ? totalOperatingHours : inferredBase;

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
  static calculateAvailability(interventions: any[] = [], totalScheduledHours: number | null = null): number {
    if (!Array.isArray(interventions) || interventions.length === 0) return 100;

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
