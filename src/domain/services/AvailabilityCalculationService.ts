import {
  FACTORY_SHIFT_HOURS_PER_DAY,
  CorrectiveCalculationService,
  isMachineStoppageFlag,
} from '../corrective/services/CorrectiveCalculationService';
import {
  getPeriodBoundaries,
  normalizeDateToYMD,
  type PeriodFilterState,
} from '../../utils/datePeriodUtils';

/**
 * AvailabilityCalculationService
 * Deterministic industrial reliability engine for MTBF, MTTR, Operational Availability %, and Stock Valuation.
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
  validation_status?: string;
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
  date_demande?: string;
  demande_date?: string;
  date_cloture?: string;
  date?: string;
  created_at?: string;
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

const EXCLUDED_VALIDATION_STATUSES = new Set([
  'PENDING_VALIDATION',
  'NEEDS_CLARIFICATION',
  'REJECTED',
]);

function isExcludedRecord(item: InterventionTimingLike | null | undefined): boolean {
  if (!item) return true;
  const status = String(item.statut || item.etat || '').trim().toUpperCase();
  if (status === 'ANNULE' || status === 'CANCELLED' || status === 'REJECTED') return true;
  const valStatus = String(item.validation_status || '').trim().toUpperCase();
  if (EXCLUDED_VALIDATION_STATUSES.has(valStatus)) return true;
  return false;
}

/** Counts Mon-Sat working days inclusive between two YYYY-MM-DD dates. */
export function countWorkingDaysBetween(startYmd: string, endYmd: string): number {
  const s = normalizeDateToYMD(startYmd);
  const e = normalizeDateToYMD(endYmd);
  if (!s || !e || e < s) return 0;

  const [sy, sm, sd] = s.split('-').map(Number);
  const [ey, em, ed] = e.split('-').map(Number);
  const cursor = new Date(sy, sm - 1, sd, 12, 0, 0, 0);
  const end = new Date(ey, em - 1, ed, 12, 0, 0, 0);

  let workingDays = 0;
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 3660) {
    guard++;
    if (cursor.getDay() !== 0) {
      workingDays++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return workingDays;
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
   * Resolves actual repair duration in minutes across canonical and legacy intervention fields.
   * Returns 0 (NEVER a fabricated 45-minute fallback) when no duration or timestamp exists.
   */
  static getInterventionDurationMinutes(
    intervention: InterventionTimingLike | null | undefined
  ): number {
    if (!intervention) return 0;

    const explicitMins =
      Number(intervention.temps_intervention_mins) ||
      Number(intervention.temps_minutes) ||
      Number(intervention.dureeMinutes) ||
      0;
    if (explicitMins > 0) {
      return explicitMins;
    }

    if (typeof intervention.duration === 'number' && intervention.duration > 0) {
      return Math.round(intervention.duration * 60);
    }

    const parsedFromIntervention = this.parseDurationStringMinutes(
      intervention.temps_intervention_calc ||
        intervention.temps_intervention ||
        intervention.duree
    );
    if (parsedFromIntervention > 0) {
      return parsedFromIntervention;
    }

    if (intervention.date_debut && intervention.date_fin) {
      const timing = CorrectiveCalculationService.calculateWorkingTime(
        String(intervention.date_debut),
        String(intervention.heure_debut || '08:00'),
        String(intervention.date_fin),
        String(intervention.heure_fin || '17:00')
      );
      if (timing.minutes > 0) {
        return timing.minutes;
      }
    }

    if (intervention.startDate && intervention.endDate) {
      const start = new Date(intervention.startDate).getTime();
      const end = new Date(intervention.endDate).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        return Math.round((end - start) / (1000 * 60));
      }
    }

    // Legacy fallback if only stoppage duration was stored on a closed stoppage record
    if (typeof intervention.temps_arret_minutes === 'number' && intervention.temps_arret_minutes > 0) {
      return intervention.temps_arret_minutes;
    }
    if (typeof intervention.downtimeHours === 'number' && intervention.downtimeHours > 0) {
      return Math.round(intervention.downtimeHours * 60);
    }
    const parsedArret = this.parseDurationStringMinutes(intervention.temps_arret);
    if (parsedArret > 0) {
      return parsedArret;
    }

    return 0;
  }

  /**
   * Parses actual machine stoppage / production downtime in minutes.
   * Returns 0 when `arret_machine === false` and no explicit stoppage duration was provided.
   */
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

    // Strictly respect non-stoppage work orders so running-machine maintenance does not inflate downtime
    if (
      intervention.arret_machine === false ||
      String(intervention.arret_machine ?? '').trim().toUpperCase() === 'NON'
    ) {
      return 0;
    }

    if (isMachineStoppageFlag(intervention)) {
      return this.getInterventionDurationMinutes(intervention);
    }

    return 0;
  }

  /**
   * Computes true scheduled operating hours for a given period filter and active machine count,
   * using real Mon-Sat working days × 8.25h/day (08:00-13:15 + 14:00-17:00).
   */
  static calculateScheduledHoursForPeriod(
    machineCount: number,
    periodFilter: PeriodFilterState | null | undefined,
    interventions: InterventionTimingLike[] = []
  ): { scheduledHours: number; workingDays: number; startDate: string | null; endDate: string | null } {
    const safeMachines = Math.max(1, Math.round(Number(machineCount) || 1));
    const todayYmd = new Date().toISOString().slice(0, 10);

    let start: string | null = null;
    let end: string | null = null;

    if (periodFilter && periodFilter.preset !== 'ALL') {
      const bounds = getPeriodBoundaries(periodFilter);
      start = bounds.start;
      // Cap end date at today for ongoing periods (THIS_MONTH / THIS_QUARTER / THIS_YEAR) so future days aren't counted
      end = bounds.end && bounds.end > todayYmd ? todayYmd : bounds.end;
    }

    if (!start || !end) {
      // Infer actual observation window from intervention dates
      let minDate: string | null = null;
      let maxDate: string | null = null;
      for (const item of interventions || []) {
        if (isExcludedRecord(item)) continue;
        const ymd = normalizeDateToYMD(
          item.date_demande || item.demande_date || item.date_debut || item.date_cloture || item.date || item.created_at
        );
        if (!ymd) continue;
        if (!minDate || ymd < minDate) minDate = ymd;
        if (!maxDate || ymd > maxDate) maxDate = ymd;
      }
      if (minDate && maxDate) {
        start = minDate;
        end = maxDate > todayYmd ? maxDate : todayYmd;
      } else {
        // Default 1 standard industrial month (26 working days × 8.25h) when empty
        const workingDays = 26;
        return {
          scheduledHours: Math.round(safeMachines * workingDays * FACTORY_SHIFT_HOURS_PER_DAY),
          workingDays,
          startDate: null,
          endDate: null,
        };
      }
    }

    const workingDays = Math.max(1, countWorkingDaysBetween(start, end));
    const scheduledHours = Math.max(1, Math.round(safeMachines * workingDays * FACTORY_SHIFT_HOURS_PER_DAY));
    return {
      scheduledHours,
      workingDays,
      startDate: start,
      endDate: end,
    };
  }

  /** Computes MTTR (Mean Time To Repair) in hours across officially closed corrective interventions. */
  static calculateMTTR(interventions: InterventionTimingLike[] = []): number {
    if (!Array.isArray(interventions) || interventions.length === 0) return 0;

    let totalRepairMinutes = 0;
    let repairCount = 0;

    for (const item of interventions) {
      if (isExcludedRecord(item)) continue;

      const isCorrective =
        !item.type ||
        item.type === 'CORRECTIVE' ||
        item.type_panne ||
        item.anomalie ||
        item.code_machine;
      const status = String(item.statut || item.etat || '').trim().toUpperCase();
      const isClosed =
        status === 'CLOTURE' ||
        status === 'CLÔTURÉ' ||
        status === 'FERME' ||
        status === 'TERMINE' ||
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
   * `(Total Scheduled Operating Hours - Total Real Downtime Hours) / Failure Count`.
   * Excludes cancelled, rejected, and unapproved declarations.
   */
  static calculateMTBF(
    interventions: InterventionTimingLike[] = [],
    totalOperatingHours: number | null = null
  ): number {
    const validRecords = (interventions || []).filter((item) => !isExcludedRecord(item));
    if (validRecords.length === 0) {
      return totalOperatingHours && totalOperatingHours > 0 ? Math.round(totalOperatingHours) : 0;
    }

    let failureCount = 0;
    let totalDowntimeHours = 0;

    for (const item of validRecords) {
      const status = String(item.statut || item.etat || '').trim().toUpperCase();
      // Ignore unstarted raw requests without stoppage when counting real failures
      const isStoppage =
        isMachineStoppageFlag(item) ||
        typeof item.downtimeHours === 'number' ||
        Number(item.temps_arret_minutes) > 0 ||
        Boolean(item.temps_arret);
      if (status === 'DEMANDE' && !isStoppage) continue;

      const isFailure =
        !item.type || item.type === 'CORRECTIVE' || item.type_panne || item.code_machine;
      if (isFailure) {
        failureCount++;
        if (isStoppage) {
          const mins = this.getDowntimeMinutes(item);
          totalDowntimeHours += mins / 60;
        }
      }
    }

    if (failureCount === 0) {
      return totalOperatingHours && totalOperatingHours > 0 ? Math.round(totalOperatingHours) : 0;
    }

    const distinctMachines = Math.max(
      1,
      new Set(
        validRecords
          .map((i) => i.code_machine || i.id_machine_registered || i.machine)
          .filter(Boolean)
      ).size
    );
    const inferred = this.calculateScheduledHoursForPeriod(distinctMachines, { preset: 'ALL' }, validRecords);
    const operatingBase =
      totalOperatingHours && totalOperatingHours > 0
        ? totalOperatingHours
        : inferred.scheduledHours;

    const netOperatingHours = Math.max(0, operatingBase - totalDowntimeHours);
    const rawMtbf = netOperatingHours / failureCount;
    return rawMtbf >= 10 ? Math.round(rawMtbf) : Number(rawMtbf.toFixed(1));
  }

  /**
   * Computes true operational availability percentage (ISO / AFNOR NF X 60-010):
   * - When `totalScheduledHours` is provided: `((Scheduled - RealDowntime) / Scheduled) * 100`.
   * - Otherwise falls back to intrinsic availability `(MTBF / (MTBF + MTTR)) * 100`.
   */
  static calculateAvailability(
    interventions: InterventionTimingLike[] = [],
    totalScheduledHours: number | null = null
  ): number {
    const validRecords = (interventions || []).filter((item) => !isExcludedRecord(item));
    if (validRecords.length === 0) return 100;

    if (totalScheduledHours && totalScheduledHours > 0) {
      let totalDowntimeMinutes = 0;
      for (const item of validRecords) {
        totalDowntimeMinutes += this.getDowntimeMinutes(item);
      }
      const downtimeHours = totalDowntimeMinutes / 60;
      const availability = ((totalScheduledHours - downtimeHours) / totalScheduledHours) * 100;
      return Number(Math.max(0, Math.min(100, availability)).toFixed(2));
    }

    const mtbf = this.calculateMTBF(validRecords, null);
    const mttr = this.calculateMTTR(validRecords);

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
