import { normalizeDateToYMD } from '../../../utils/datePeriodUtils';

const UNAPPROVED_STATUSES = new Set([
  'PENDING_VALIDATION',
  'NEEDS_CLARIFICATION',
  'REJECTED',
]);

function isOfficialIntervention(item: any): boolean {
  if (!item) return false;
  const valStatus = String(item.validation_status || '').trim().toUpperCase();
  const wfStatus = String(item.statut || item.etat || '').trim().toUpperCase();
  if (UNAPPROVED_STATUSES.has(valStatus)) return false;
  if (wfStatus === 'EN_ATTENTE_VALIDATION' || wfStatus === 'ANNULE' || wfStatus === 'REJECTED') {
    return false;
  }
  return true;
}

export function isMachineStoppageFlag(item: any): boolean {
  if (!item) return false;
  if (item.arret_machine === true || item.is_stoppage === true) return true;
  const str = String(item.arret_machine ?? '').trim().toUpperCase();
  return str === 'OUI' || str === 'TRUE' || str === '1' || str === 'YES';
}

/**
 * Factory shift windows in minutes from local midnight (00:00):
 * - Working days: Monday (1) through Saturday (6); Sunday (0) is non-working.
 * - Morning shift: 08:00 (480) -> 13:15 (795) = 315 min
 * - Lunch break:   13:15 -> 14:00 (45 min automatically excluded)
 * - Afternoon:     14:00 (840) -> 17:00 (1020) = 180 min
 * Total standard shift = 495 min/day (8h 15m).
 */
export const FACTORY_SHIFT_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [8 * 60, 13 * 60 + 15],
  [14 * 60, 17 * 60],
];

export const FACTORY_SHIFT_MINUTES_PER_DAY = 495; // 8.25h
export const FACTORY_SHIFT_HOURS_PER_DAY = 8.25;

const MAX_SHIFT_SCAN_DAYS = 366;

function parseLocalDateTimeParts(
  dateStr: string,
  timeStr: string
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const ymd = normalizeDateToYMD(dateStr);
  if (!ymd) return null;
  const [yStr, mStr, dStr] = ymd.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const cleanTime = String(timeStr || '').trim();
  const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? Math.min(23, Math.max(0, Number(timeMatch[1]))) : 8;
  const minute = timeMatch ? Math.min(59, Math.max(0, Number(timeMatch[2]))) : 0;

  const check = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    Number.isNaN(check.getTime()) ||
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day, hour, minute };
}

export interface WorkingTimeResult {
  minutes: number;
  formatted: string;
  dureeMinutes: number;
  dureeHeures: string;
  isOvertime?: boolean;
}

export class CorrectiveCalculationService {
  static minutesToTimeString(minutes: number): string {
    const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
    const hrs = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  static formatDurationHuman(minutes: number): string {
    const safe = Math.max(0, Math.round(Number(minutes) || 0));
    const hrs = Math.floor(safe / 60);
    const mins = safe % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  }

  static timeStringToMinutes(timeStr: unknown): number {
    if (typeof timeStr === 'number' && Number.isFinite(timeStr)) {
      return Math.max(0, Math.round(timeStr));
    }
    if (!timeStr) return 0;
    const str = String(timeStr).trim();
    if (!str) return 0;

    if (str.includes(':')) {
      const parts = str.split(':');
      const h = Number(parts[0]) || 0;
      const m = Number(parts[1]) || 0;
      return Math.max(0, h * 60 + m);
    }

    const hmMatch = str.match(/(\d+)\s*h(?:our|eure)?s?\s*(\d+)?/i);
    if (hmMatch) {
      const h = Number(hmMatch[1]) || 0;
      const m = Number(hmMatch[2]) || 0;
      return Math.max(0, h * 60 + m);
    }

    const minMatch = str.match(/^(\d+(?:\.\d+)?)\s*m(?:in)?/i);
    if (minMatch) {
      return Math.max(0, Math.round(Number(minMatch[1]) || 0));
    }

    const num = Number(str);
    return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
  }

  /**
   * Computes real factory working minutes between `(dDebut, hDebut)` and `(dFin, hFin)`:
   * - Intersects `[start, end]` with Mon-Sat shift windows `[08:00-13:15]` and `[14:00-17:00]`.
   * - Automatically excludes the 45-minute lunch break (`13:15-14:00`), overnight non-shift hours,
   *   and Sundays (`day === 0`).
   * - Never fabricates a default 60-minute duration on 0-minute or invalid ranges.
   * - If an emergency intervention starts and finishes entirely on the same calendar day outside
   *   normal shift hours (e.g., Sunday or night overtime <= 8h), records actual elapsed minutes
   *   with `isOvertime: true` so real emergency overtime work is not erased to 0.
   */
  static calculateWorkingTime(
    dDebut: string,
    hDebut: string,
    dFin: string,
    hFin: string
  ): WorkingTimeResult {
    const zeroResult: WorkingTimeResult = {
      minutes: 0,
      formatted: '0m',
      dureeMinutes: 0,
      dureeHeures: '0.0',
      isOvertime: false,
    };

    try {
      const startParts = parseLocalDateTimeParts(dDebut, hDebut || '08:00');
      const endParts = parseLocalDateTimeParts(dFin, hFin || '17:00');
      if (!startParts || !endParts) {
        return zeroResult;
      }

      const startMs = new Date(
        startParts.year,
        startParts.month - 1,
        startParts.day,
        startParts.hour,
        startParts.minute,
        0,
        0
      ).getTime();
      const endMs = new Date(
        endParts.year,
        endParts.month - 1,
        endParts.day,
        endParts.hour,
        endParts.minute,
        0,
        0
      ).getTime();

      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return zeroResult;
      }

      const startDayCursor = new Date(startParts.year, startParts.month - 1, startParts.day, 0, 0, 0, 0);
      const endDayMidnight = new Date(endParts.year, endParts.month - 1, endParts.day, 0, 0, 0, 0);

      let workingMinutes = 0;
      let scannedDays = 0;
      const cursor = new Date(startDayCursor.getTime());

      while (cursor.getTime() <= endDayMidnight.getTime() && scannedDays < MAX_SHIFT_SCAN_DAYS) {
        scannedDays++;
        const dayOfWeek = cursor.getDay(); // 0 = Sunday (non-working)
        if (dayOfWeek !== 0) {
          const y = cursor.getFullYear();
          const m = cursor.getMonth();
          const d = cursor.getDate();

          for (const [winStartMin, winEndMin] of FACTORY_SHIFT_WINDOWS) {
            const winStartMs = new Date(
              y,
              m,
              d,
              Math.floor(winStartMin / 60),
              winStartMin % 60,
              0,
              0
            ).getTime();
            const winEndMs = new Date(
              y,
              m,
              d,
              Math.floor(winEndMin / 60),
              winEndMin % 60,
              0,
              0
            ).getTime();

            const overlapStart = Math.max(startMs, winStartMs);
            const overlapEnd = Math.min(endMs, winEndMs);
            if (overlapEnd > overlapStart) {
              workingMinutes += Math.round((overlapEnd - overlapStart) / 60000);
            }
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      const sameCalendarDay =
        startParts.year === endParts.year &&
        startParts.month === endParts.month &&
        startParts.day === endParts.day;
      const rawElapsedMins = Math.round((endMs - startMs) / 60000);

      let isOvertime = false;
      if (workingMinutes === 0 && sameCalendarDay && rawElapsedMins > 0 && rawElapsedMins <= 480) {
        // Same-day emergency overtime intervention (e.g., Sunday or post-17:00 shift)
        workingMinutes = rawElapsedMins;
        isOvertime = true;
      }

      const safeMinutes = Math.max(0, workingMinutes);
      return {
        minutes: safeMinutes,
        formatted: this.formatDurationHuman(safeMinutes),
        dureeMinutes: safeMinutes,
        dureeHeures: (safeMinutes / 60).toFixed(1),
        isOvertime,
      };
    } catch {
      return zeroResult;
    }
  }

  /**
   * Resolves explicit machine stoppage downtime in minutes.
   * Returns 0 whenever `arret_machine` is false and no explicit stoppage duration was entered.
   */
  static resolveDowntimeMinutes(item: any): number {
    if (!item) return 0;
    const explicitArretMins =
      Number(item.temps_arret_minutes) ||
      this.timeStringToMinutes(item.temps_arret || item.duree_arret);
    if (explicitArretMins > 0) {
      return explicitArretMins;
    }
    if (!isMachineStoppageFlag(item)) {
      return 0;
    }
    // Machine was stopped but technician did not enter a separate stoppage duration -> fallback to repair duration
    return (
      Number(item.temps_intervention_mins) ||
      Number(item.temps_minutes) ||
      Number(item.dureeMinutes) ||
      this.timeStringToMinutes(item.temps_intervention_calc || item.temps_intervention) ||
      0
    );
  }

  static computeKpis(interventions: any[] = []) {
    const list = (interventions || []).filter(isOfficialIntervention);
    const total = list.length;
    const closedItems = list.filter((i) => i.statut === 'CLOTURE');
    const clotures = closedItems.length;
    const enCours = list.filter((i) => i.statut === 'EN_COURS').length;

    let totalDowntimeMinutes = 0;
    let totalRepairMinutes = 0;
    let closedWithDurationCount = 0;

    for (const i of list) {
      totalDowntimeMinutes += this.resolveDowntimeMinutes(i);

      if (i.statut === 'CLOTURE') {
        const repairMins =
          Number(i.temps_intervention_mins) ||
          Number(i.temps_minutes) ||
          Number(i.dureeMinutes) ||
          this.timeStringToMinutes(i.temps_intervention_calc || i.temps_intervention) ||
          Number(i.temps_arret_minutes) ||
          this.timeStringToMinutes(i.temps_arret) ||
          0;
        if (repairMins > 0) {
          totalRepairMinutes += repairMins;
          closedWithDurationCount++;
        }
      }
    }

    const mttr =
      closedWithDurationCount > 0 ? (totalRepairMinutes / closedWithDurationCount).toFixed(1) : '0';

    return {
      totalInterventions: total,
      cloturesCount: clotures,
      enCoursCount: enCours,
      totalDowntimeMinutes,
      totalRepairMinutes,
      mttrMinutes: mttr,
      tauxResolution: total > 0 ? Math.round((clotures / total) * 100) : 100,
    };
  }

  static computePareto(interventions: any[] = [], field: string) {
    const counts: Record<string, number> = {};
    for (const item of (interventions || []).filter(isOfficialIntervention)) {
      const val = item[field] || item.panne || item.machine || 'AUTRE';
      counts[val] = (counts[val] || 0) + 1;
    }
    const sorted = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const total = sorted.reduce((sum, item) => sum + item.count, 0);
    let cumulative = 0;
    return sorted.map((item) => {
      cumulative += item.count;
      return {
        ...item,
        percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
        cumulativePercentage: total > 0 ? Math.round((cumulative / total) * 100) : 0,
      };
    });
  }

  /**
   * Detects recurring failures per `(machine, anomaly)` inside a rolling time window (default 90 days)
   * so obsolete 2-year-old incidents never spam false preventive recommendations forever.
   */
  static detectPreventiveRecommendations(
    interventions: any[] = [],
    options: { windowDays?: number; minRecurrences?: number; referenceDate?: Date } = {}
  ) {
    const windowDays = options.windowDays ?? 90;
    const minRecurrences = options.minRecurrences ?? 3;
    const refDate = options.referenceDate || new Date();
    const cutoffMs =
      windowDays > 0 ? refDate.getTime() - windowDays * 24 * 60 * 60 * 1000 : -Infinity;

    const byMachine: Record<
      string,
      { count: number; anomalies: Record<string, number>; zone?: string; typePanne?: string }
    > = {};

    for (const item of (interventions || []).filter(isOfficialIntervention)) {
      const mId = String(item.code_machine || item.id_machine_registered || item.machine || '').trim();
      if (!mId) continue;

      if (windowDays > 0) {
        const ymd = normalizeDateToYMD(
          item.date_cloture || item.date_fin || item.date_demande || item.demande_date || item.date || item.created_at
        );
        if (ymd) {
          const itemMs = new Date(`${ymd}T12:00:00`).getTime();
          if (Number.isFinite(itemMs) && itemMs < cutoffMs) {
            continue;
          }
        }
      }

      if (!byMachine[mId]) {
        byMachine[mId] = { count: 0, anomalies: {}, zone: item.zone, typePanne: item.type_panne };
      }
      byMachine[mId].count += 1;
      const anom = String(item.anomalie || item.panne || 'inspection_generale').trim();
      if (anom) {
        byMachine[mId].anomalies[anom] = (byMachine[mId].anomalies[anom] || 0) + 1;
      }
    }

    return Object.entries(byMachine)
      .filter(([_, data]) => data.count >= minRecurrences)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([machine, data]) => {
        const topAnomalie =
          Object.entries(data.anomalies).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          'inspection_generale';
        const cleanLabel = topAnomalie.replace(/_/g, ' ');
        const suggestedIntervalDays = data.count >= 5 ? 7 : 30;
        const typeLabel =
          data.typePanne === 'E'
            ? 'contrôle électrique / serrage borniers'
            : data.typePanne === 'H'
            ? 'contrôle circuit hydraulique / étanchéité & pression'
            : data.typePanne === 'P'
            ? 'contrôle réseau pneumatique / FRL & électrovannes'
            : 'inspection mécanique ciblée / alignement & usure';

        return {
          machine,
          code_machine: machine,
          count: data.count,
          repetitionCount: data.count,
          anomalie: topAnomalie,
          zone: data.zone || 'Atelier',
          suggestedIntervalDays,
          recommendedAction: `Planifier un ${typeLabel} (${cleanLabel}) tous les ${suggestedIntervalDays} jours sur ${machine}.`,
          recommendation: `Créer une inspection préventive ciblée sur ${machine} suite à ${data.count} pannes récentes (${cleanLabel}) sur les ${windowDays} derniers jours.`,
        };
      });
  }
}

export default CorrectiveCalculationService;
