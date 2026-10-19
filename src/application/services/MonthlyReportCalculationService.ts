import { normalizeDateToYMD, getMonthFromDate } from '../../utils/datePeriodUtils';
import type { PreventiveExecutionRecord } from '../../types/preventive';

export interface ConsumedPartSummary {
  ref: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  unit: string;
}

export interface FailingMachineSummary {
  machineCode: string;
  machineName: string;
  failureCount: number;
  totalDowntimeHours: number;
}

export interface MonthlyFactoryReportData {
  periodMonth: string; // 'YYYY-MM'
  
  // 1. Inventory & Valuation
  stockValuationTotal: number;
  stockItemsCount: number;
  ruptureCount: number;
  alerteCount: number;
  ruptureItems: Array<{ ref: string; designation: string; stockActuel: number; seuil: number; prixUnitaire: number }>;

  // 2. Monthly Movements & Consumptions
  monthSortiesCount: number;
  monthEntreesCount: number;
  monthConsumptionCost: number;
  monthEntriesCost: number;
  topConsumedParts: ConsumedPartSummary[];

  // 3. Corrective Maintenance & Failures
  correctiveCount: number;
  correctiveClosedCount: number;
  correctiveInProgressCount: number;
  totalDowntimeHours: number;
  correctiveSparesCost: number;
  topFailingMachines: FailingMachineSummary[];

  // 4. Preventive Maintenance Discipline
  preventiveScheduledCount: number;
  preventiveExecutedCount: number;
  preventiveDisciplineRate: number; // percentage 0-100%
  preventiveTotalCost: number;
  preventiveLaborHours: number;
}

export interface MonthOverMonthDelta {
  diff: number;
  percent: number; // Percentage change (positive or negative)
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface MonthOverMonthComparison {
  currentMonth: string;
  previousMonth: string;
  currentReport: MonthlyFactoryReportData;
  previousReport: MonthlyFactoryReportData;
  consumptionCostDelta: MonthOverMonthDelta;
  correctiveCountDelta: MonthOverMonthDelta;
  downtimeHoursDelta: MonthOverMonthDelta;
  preventiveDisciplineDelta: MonthOverMonthDelta;
  stockValuationDelta: MonthOverMonthDelta;
}

export class MonthlyReportCalculationService {
  /**
   * Computes the complete factory executive report for a given month (YYYY-MM)
   */
  static calculateMonthlyReport({
    month,
    stockItems = [],
    mouvements = [],
    correctiveInterventions = [],
    preventiveTasks = [],
    preventiveExecutions = [],
  }: {
    month: string;
    stockItems?: any[];
    mouvements?: any[];
    correctiveInterventions?: any[];
    preventiveTasks?: any[];
    preventiveExecutions?: PreventiveExecutionRecord[];
  }): MonthlyFactoryReportData {
    const targetMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);

    // =========================================================================
    // 1. Inventory Valuation & Alerts
    // =========================================================================
    let stockValuationTotal = 0;
    let ruptureCount = 0;
    let alerteCount = 0;
    const ruptureItems: MonthlyFactoryReportData['ruptureItems'] = [];

    (stockItems || []).forEach((item) => {
      const stock = Number(item.stockActuel ?? item.stock ?? item.stockInitial ?? 0);
      const seuil = Number(item.seuil ?? item.stockMin ?? 5);
      const price = Number(item.prix_unitaire ?? item.prix_achat_ht ?? item.prix ?? item.unitPrice ?? 0);

      stockValuationTotal += Math.max(0, stock) * (price > 0 ? price : 0);

      if (stock <= 0) {
        ruptureCount++;
        ruptureItems.push({
          ref: String(item.ref || item.reference || item.code_article || 'REF').trim(),
          designation: String(item.designation || item.nom || 'Article').trim(),
          stockActuel: stock,
          seuil,
          prixUnitaire: price,
        });
      } else if (stock <= seuil) {
        alerteCount++;
      }
    });

    // =========================================================================
    // 2. Monthly Movements & Consumptions
    // =========================================================================
    let monthSortiesCount = 0;
    let monthEntreesCount = 0;
    let monthConsumptionCost = 0;
    let monthEntriesCost = 0;
    const consumedPartsMap = new Map<string, ConsumedPartSummary>();

    (mouvements || []).forEach((m) => {
      const mDate = normalizeDateToYMD(m.date);
      if (!mDate || !mDate.startsWith(targetMonth)) return;

      const typeStr = String(m.type || '').trim().toLowerCase();
      const qty = Math.abs(Number(m.quantite || 1));
      const price = Number(m.prix_unitaire ?? m.prix_achat_ht ?? m.prix ?? 0);
      const cost = qty * (price > 0 ? price : 0);

      const isSortie = typeStr.includes('sortie') || typeStr === 'out';
      const isEntree = typeStr.includes('entrée') || typeStr.includes('entree') || typeStr === 'in';

      if (isSortie) {
        monthSortiesCount++;
        monthConsumptionCost += cost;

        const ref = String(m.ref || m.reference || m.id_article || 'PDR').trim();
        const existing = consumedPartsMap.get(ref);
        if (existing) {
          existing.quantity += qty;
          existing.totalCost += cost;
        } else {
          consumedPartsMap.set(ref, {
            ref,
            designation: String(m.designation || ref).trim(),
            quantity: qty,
            unitPrice: price,
            totalCost: cost,
            unit: String(m.unit || m.unite || 'pcs'),
          });
        }
      } else if (isEntree) {
        monthEntreesCount++;
        monthEntriesCost += cost;
      }
    });

    const topConsumedParts = Array.from(consumedPartsMap.values())
      .sort((a, b) => b.totalCost - a.totalCost || b.quantity - a.quantity)
      .slice(0, 5);

    // =========================================================================
    // 3. Corrective Maintenance & Failures
    // =========================================================================
    let correctiveCount = 0;
    let correctiveClosedCount = 0;
    let correctiveInProgressCount = 0;
    let totalDowntimeHours = 0;
    let correctiveSparesCost = 0;
    const machineFailuresMap = new Map<string, FailingMachineSummary>();

    (correctiveInterventions || []).forEach((ci) => {
      const ciDate = normalizeDateToYMD(ci.date_demande || ci.date || ci.date_cloture || ci.created_at);
      if (!ciDate || !ciDate.startsWith(targetMonth)) return;

      correctiveCount++;
      const status = String(ci.statut || ci.etat || '').toUpperCase();
      if (status === 'CLOTURE' || status === 'FERME' || status === 'TERMINE') {
        correctiveClosedCount++;
      } else {
        correctiveInProgressCount++;
      }

      // Downtime calculation: supports downtimeHours or temps_arret_minutes
      const dtHours = Number(
        ci.downtimeHours ??
        (ci.temps_arret_minutes ? Number(ci.temps_arret_minutes) / 60 : 0) ??
        ci.duree_arret ??
        0
      );
      if (Number.isFinite(dtHours) && dtHours > 0) {
        totalDowntimeHours += dtHours;
      }

      // Spares cost calculation
      const pdrCost = Number(ci.pdr_cost ?? ci.cout_pdr ?? (Number(ci.quantite || 1) * Number(ci.prix_unitaire || 0)) ?? 0);
      if (Number.isFinite(pdrCost) && pdrCost > 0) {
        correctiveSparesCost += pdrCost;
      }

      // Track failing machines
      const mCode = String(ci.code_machine || ci.id_machine || 'GLOBAL').trim().toUpperCase();
      const existingM = machineFailuresMap.get(mCode);
      if (existingM) {
        existingM.failureCount++;
        existingM.totalDowntimeHours += dtHours > 0 ? dtHours : 0;
      } else {
        machineFailuresMap.set(mCode, {
          machineCode: mCode,
          machineName: String(ci.nom_machine || mCode),
          failureCount: 1,
          totalDowntimeHours: dtHours > 0 ? dtHours : 0,
        });
      }
    });

    const topFailingMachines = Array.from(machineFailuresMap.values())
      .sort((a, b) => b.failureCount - a.failureCount || b.totalDowntimeHours - a.totalDowntimeHours)
      .slice(0, 3);

    // =========================================================================
    // 4. Preventive Maintenance Discipline
    // =========================================================================
    // Executed items in month
    const monthExecutions = (preventiveExecutions || []).filter((e) => {
      const eDate = normalizeDateToYMD(e.executedAt);
      return (e.periodMonth && e.periodMonth === targetMonth) || (eDate && eDate.startsWith(targetMonth));
    });

    const preventiveExecutedCount = monthExecutions.length;
    const preventiveTotalCost = monthExecutions.reduce((sum, e) => sum + (Number(e.totalCost) || 0), 0);
    const totalMinutes = monthExecutions.reduce((sum, e) => sum + (Number(e.durationMinutes) || 0), 0);
    const preventiveLaborHours = Number((totalMinutes / 60).toFixed(1));

    // Scheduled tasks for month: active tasks in preventiveTasks that have recurrence in this month
    const totalActiveTasks = (preventiveTasks || []).length;
    // An industrial plant schedules monthly tasks for each active routine. If 0 tasks, scheduled is 0.
    const preventiveScheduledCount = Math.max(preventiveExecutedCount, totalActiveTasks);

    const preventiveDisciplineRate = preventiveScheduledCount > 0
      ? Math.min(100, Math.round((preventiveExecutedCount / preventiveScheduledCount) * 100))
      : 100;

    return {
      periodMonth: targetMonth,
      stockValuationTotal: Number(stockValuationTotal.toFixed(2)),
      stockItemsCount: (stockItems || []).length,
      ruptureCount,
      alerteCount,
      ruptureItems: ruptureItems.slice(0, 10),

      monthSortiesCount,
      monthEntreesCount,
      monthConsumptionCost: Number(monthConsumptionCost.toFixed(2)),
      monthEntriesCost: Number(monthEntriesCost.toFixed(2)),
      topConsumedParts,

      correctiveCount,
      correctiveClosedCount,
      correctiveInProgressCount,
      totalDowntimeHours: Number(totalDowntimeHours.toFixed(1)),
      correctiveSparesCost: Number(correctiveSparesCost.toFixed(2)),
      topFailingMachines,

      preventiveScheduledCount,
      preventiveExecutedCount,
      preventiveDisciplineRate,
      preventiveTotalCost: Number(preventiveTotalCost.toFixed(2)),
      preventiveLaborHours,
    };
  }

  /**
   * Returns the previous calendar month in 'YYYY-MM' format
   */
  static getPreviousMonth(ym: string): string {
    const match = String(ym || '').trim().match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      const now = new Date();
      now.setMonth(now.getMonth() - 1);
      return now.toISOString().slice(0, 7);
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const d = new Date(year, month - 2, 1);
    const prevYear = d.getFullYear();
    const prevMonth = String(d.getMonth() + 1).padStart(2, '0');
    return `${prevYear}-${prevMonth}`;
  }

  /**
   * Helper to compute delta and trend between two numeric values
   */
  static calculateDelta(current: number, previous: number): MonthOverMonthDelta {
    const curr = Number(current) || 0;
    const prev = Number(previous) || 0;
    const diff = Number((curr - prev).toFixed(2));

    if (prev === 0) {
      if (curr === 0) {
        return { diff: 0, percent: 0, trend: 'STABLE' };
      }
      return { diff, percent: 100, trend: 'UP' };
    }

    const percent = Number(((diff / Math.abs(prev)) * 100).toFixed(1));
    const trend = diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : 'STABLE';
    return { diff, percent, trend };
  }

  /**
   * Computes Month-over-Month comparison (currentMonth vs previousMonth)
   */
  static calculateMonthOverMonthComparison(params: {
    month: string;
    stockItems?: any[];
    mouvements?: any[];
    correctiveInterventions?: any[];
    preventiveTasks?: any[];
    preventiveExecutions?: PreventiveExecutionRecord[];
  }): MonthOverMonthComparison {
    const currentMonth = params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : new Date().toISOString().slice(0, 7);
    const previousMonth = this.getPreviousMonth(currentMonth);

    const currentReport = this.calculateMonthlyReport({
      ...params,
      month: currentMonth,
    });

    const previousReport = this.calculateMonthlyReport({
      ...params,
      month: previousMonth,
    });

    return {
      currentMonth,
      previousMonth,
      currentReport,
      previousReport,
      consumptionCostDelta: this.calculateDelta(
        currentReport.monthConsumptionCost,
        previousReport.monthConsumptionCost
      ),
      correctiveCountDelta: this.calculateDelta(
        currentReport.correctiveCount,
        previousReport.correctiveCount
      ),
      downtimeHoursDelta: this.calculateDelta(
        currentReport.totalDowntimeHours,
        previousReport.totalDowntimeHours
      ),
      preventiveDisciplineDelta: this.calculateDelta(
        currentReport.preventiveDisciplineRate,
        previousReport.preventiveDisciplineRate
      ),
      stockValuationDelta: this.calculateDelta(
        currentReport.stockValuationTotal,
        previousReport.stockValuationTotal
      ),
    };
  }
}

export default MonthlyReportCalculationService;

