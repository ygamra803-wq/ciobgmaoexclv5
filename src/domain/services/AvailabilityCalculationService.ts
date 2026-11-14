/**
 * AvailabilityCalculationService
 * Deterministic industrial reliability engine for MTBF, MTTR, Availability %, and Stock Valuation.
 */

export interface InterventionTimingLike {
  type?: string;
  type_panne?: string;
  anomalie?: string;
  code_machine?: string;
  id_machine_registered?: string;
  machine?: string;
  statut?: string;
  etat?: string;
  temps_intervention_mins?: number | string;
  temps_minutes?: number | string;
  dureeMinutes?: number | string;
  temps_arret_minutes?: number | string;
  duration?: number;
  downtimeHours?: number;
  temps_intervention_calc?: number | string;
  temps_intervention?: number | string;
  duree?: number | string;
  temps_arret?: number | string;
  duree_arret?: number | string;
  date_debut?: string;
  date_fin?: string;
  heure_debut?: string;
  heure_fin?: string;
  startDate?: string;
  endDate?: string;
  arret_machine?: boolean | string;
  is_stoppage?: boolean;
  [key: string]: unknown;
}

export interface StockArticleValuationLike {
  stockActuel?: number;
  stock_actuel?: number;
  quantite?: number;
  prix_unitaire?: number;
  prix?: number;
  unitPrice?: number;
  [key: string]: unknown;
}

export interface MachineAvailabilityRefLike {
  id?: string;
  id_machine_registered?: string;
  [key: string]: unknown;
}

export class AvailabilityCalculationService {
  /** Parses duration strings (`2h 30m`, `01:45`, `90 min`, or raw numeric minutes) into minutes. */
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
   * Resolves repair duration in minutes across canonical and legacy intervention fields,
   * falling back to 45 minutes only when no explicit timestamp or duration metadata exists.
   */
  static getInterventionDurationMinutes(
    intervention: InterventionTimingLike | null | undefined
  ): number {
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

    return 45;
  }

  /** Parses machine stoppage / downtime duration in minutes. */
  static getDowntimeMinutes(intervention: InterventionTimingLike | null | undefined): number {
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

  /** Computes MTTR (Mean Time To Repair) in hours across closed corrective interventions. */
  static calculateMTTR(interventions: InterventionTimingLike[] = []): number {
    if (!Array.isArray(interventions) || interventions.length === 0) return 0;

    let totalRepairMinutes = 0;
    let repairCount = 0;

    for (const item of interventions) {
      const isCorrective =
        !item.type ||
        item.type === 'CORRECTIVE' ||
        item.type_panne ||
        item.anomalie ||
        item.code_machine;
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

  /** Formats MTTR as zero-padded `HHh MMm`. */
  static formatMTTR(interventions: InterventionTimingLike[] = []): string {
    const hoursDecimal = this.calculateMTTR(interventions);
    const totalMinutes = Math.round(hoursDecimal * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  }

  /**
   * Computes MTBF (Mean Time Between Failures) in hours:
   * `(Total Operating Time - Total Downtime) / Failure Count`.
   */
  static calculateMTBF(
    interventions: InterventionTimingLike[] = [],
    totalOperatingHours: number | null = null
  ): number {
    if (!Array.isArray(interventions) || interventions.length === 0) {
      return totalOperatingHours && totalOperatingHours > 0 ? Math.round(totalOperatingHours) : 168;
    }

    let failureCount = 0;
    let totalDowntimeHours = 0;

    for (const item of interventions) {
      const status = String(item.statut || item.etat || '').toUpperCase();
      if (status === 'ANNULE') continue;

      const isFailure =
        !item.type || item.type === 'CORRECTIVE' || item.type_panne || item.code_machine;
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

  /** Computes operational availability percentage: `(MTBF / (MTBF + MTTR)) * 100`. */
  static calculateAvailability(
    interventions: InterventionTimingLike[] = [],
    totalScheduledHours: number | null = null
  ): number {
    if (!Array.isArray(interventions) || interventions.length === 0) return 100;

    const mtbf = this.calculateMTBF(interventions, totalScheduledHours);
    const mttr = this.calculateMTTR(interventions);

    if (mtbf === 0 && mttr === 0) return 100;
    if (mtbf + mttr === 0) return 100;

    const availability = (mtbf / (mtbf + mttr)) * 100;
    return Number(Math.max(0, Math.min(100, availability)).toFixed(2));
  }

  /** Computes total monetary valuation across positive stock quantities and unit prices. */
  static calculateStockValue(articles: StockArticleValuationLike[] = []): number {
    if (!Array.isArray(articles) || articles.length === 0) return 0;

    return articles.reduce((total, article) => {
      const qty = Number(article.stockActuel ?? article.stock_actuel ?? article.quantite ?? 0);
      const price = Number(article.prix_unitaire ?? article.prix ?? article.unitPrice ?? 0);
      return total + (qty > 0 && price > 0 ? qty * price : 0);
    }, 0);
  }

  /** Sanity-checks MTBF, MTTR, and Availability bounds against physical non-negativity invariants. */
  static verifyCalculations(
    machine: MachineAvailabilityRefLike = {},
    interventions: InterventionTimingLike[] = []
  ): {
    isValid: boolean;
    errors: string[];
    metrics: {
      machineId: string;
      mtbf: string;
      mttr: string;
      availability: string;
    };
  } {
    const errors: string[] = [];
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
        machineId: String(machine?.id || machine?.id_machine_registered || 'GLOBAL'),
        mtbf: `${mtbf}h`,
        mttr: this.formatMTTR(interventions),
        availability: `${availability}%`,
      },
    };
  }
}

export default AvailabilityCalculationService;
