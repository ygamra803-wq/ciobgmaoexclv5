import { normalizeDateToYMD } from '../../utils/datePeriodUtils';
import { AvailabilityCalculationService } from '../../domain/services/AvailabilityCalculationService';
import {
  filterActiveMachines,
  filterProductionMachines,
  getMachineAssetClass,
} from '../../utils/activeMachines';
import { selectValidationCenterQueues } from '../../core/security/validationReconciliation';
import type { PreventiveExecutionRecord } from '../../types/preventive';

const UNAPPROVED_VALIDATION_STATUSES = new Set([
  'PENDING_VALIDATION',
  'REJECTED',
  'NEEDS_CLARIFICATION',
]);

export function isUnapprovedFieldClaim(record: any): boolean {
  const status = String(record?.validation_status || '').trim().toUpperCase();
  const wfStatus = String(record?.statut || record?.etat || '').trim().toUpperCase();
  return UNAPPROVED_VALIDATION_STATUSES.has(status) || wfStatus === 'EN_ATTENTE_VALIDATION';
}

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

export interface TechnicianMonthlySummary {
  name: string;
  preventiveCount: number;
  correctiveCount: number;
  totalHours: number;
}

export interface MonthlyFactoryReportData {
  periodMonth: string; // 'YYYY-MM'
  
  // 1. Inventory & Valuation
  stockValuationTotal: number;
  stockItemsCount: number;
  ruptureCount: number;
  alerteCount: number;
  ruptureItems: Array<{ ref: string; designation: string; stockActuel: number; seuil: number; prixUnitaire: number }>;
  alerteItems: Array<{ ref: string; designation: string; stockActuel: number; seuil: number; prixUnitaire: number }>;
  openOrdersCount: number;
  openOrdersValue: number;

  // 2. Monthly Movements & Consumptions
  monthSortiesCount: number;
  monthEntreesCount: number;
  monthConsumptionCost: number;
  monthEntriesCost: number;
  topConsumedParts: ConsumedPartSummary[];

  // 3. Corrective Maintenance, Failures & Reliability (MTTR / MTBF / OEE)
  correctiveCount: number;
  correctiveClosedCount: number;
  correctiveInProgressCount: number;
  totalDowntimeHours: number;
  correctiveSparesCost: number;
  mttrHours: number;
  mttrFormatted: string;
  mtbfHours: number;
  availabilityRate: number;
  topFailingMachines: FailingMachineSummary[];

  // 4. Preventive Maintenance Discipline & Technician Breakdown
  preventiveScheduledCount: number;
  preventiveExecutedCount: number;
  preventiveDisciplineRate: number; // percentage 0-100%
  preventiveTotalCost: number;
  preventiveLaborHours: number;
  technicianBreakdown: TechnicianMonthlySummary[];

  // 5. External Subcontracting / Bobinage (Sorties Externe)
  externalBobinageCount?: number;
  externalBobinageCost?: number;
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
    sortiesExterne = [],
    machines = [],
  }: {
    month: string;
    stockItems?: any[];
    mouvements?: any[];
    correctiveInterventions?: any[];
    preventiveTasks?: any[];
    preventiveExecutions?: PreventiveExecutionRecord[];
    sortiesExterne?: any[];
    machines?: any[];
  }): MonthlyFactoryReportData {
    const targetMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);

    // =========================================================================
    // 1. Inventory Valuation & Alerts
    // =========================================================================
    let stockValuationTotal = 0;
    let ruptureCount = 0;
    let alerteCount = 0;
    const ruptureItems: MonthlyFactoryReportData['ruptureItems'] = [];
    const alerteItems: MonthlyFactoryReportData['alerteItems'] = [];
    const stockPriceMap = new Map<string, number>();

    (stockItems || []).forEach((item) => {
      const ref = String(item.ref || item.reference || item.code_article || 'REF').trim();
      const stock = Number(item.stockActuel ?? item.stock ?? item.stockInitial ?? 0);
      const seuil = Number(item.seuil ?? item.stockMin ?? 5);
      const price = Number(item.prix_unitaire ?? item.prix_achat_ht ?? item.prix ?? item.unitPrice ?? 0);

      if (ref && price > 0) {
        stockPriceMap.set(ref.toUpperCase(), price);
      }

      stockValuationTotal += Math.max(0, stock) * (price > 0 ? price : 0);

      if (stock <= 0) {
        ruptureCount++;
        ruptureItems.push({
          ref,
          designation: String(item.designation || item.nom || 'Article').trim(),
          stockActuel: stock,
          seuil,
          prixUnitaire: price,
        });
      } else if (stock <= seuil) {
        alerteCount++;
        alerteItems.push({
          ref,
          designation: String(item.designation || item.nom || 'Article').trim(),
          stockActuel: stock,
          seuil,
          prixUnitaire: price,
        });
      }
    });

    // =========================================================================
    // 2. Monthly Movements, Open Orders & Consumptions
    // =========================================================================
    let monthSortiesCount = 0;
    let monthEntreesCount = 0;
    let monthConsumptionCost = 0;
    let monthEntriesCost = 0;
    let openOrdersCount = 0;
    let openOrdersValue = 0;
    const consumedPartsMap = new Map<string, ConsumedPartSummary>();

    (mouvements || []).forEach((m) => {
      const typeStr = String(m.type || '').trim().toLowerCase();
      const ref = String(m.ref || m.reference || m.id_article || 'PDR').trim();
      const fallbackPrice = stockPriceMap.get(ref.toUpperCase()) || 0;
      const qty = Math.abs(Number(m.quantite || 1));
      const price = Number(m.prix_unitaire ?? m.prix_achat_ht ?? m.prix ?? 0) || fallbackPrice;
      const cost = qty * (price > 0 ? price : 0);

      // Check open purchase orders (Commandes en attente)
      const isOrder =
        typeStr === 'commande' ||
        String(m.action_id || '').toUpperCase() === 'COMMANDE' ||
        (Array.isArray(m.tags) && m.tags.includes('#COMMANDE_EN_ATTENTE'));
      const isOrderReceived = Array.isArray(m.tags) && m.tags.includes('#RECEPTION_VALIDE');
      if (isOrder && !isOrderReceived) {
        openOrdersCount++;
        openOrdersValue += cost;
      }

      const mDate = normalizeDateToYMD(m.date);
      if (!mDate || !mDate.startsWith(targetMonth)) return;

      const isSortie = typeStr.includes('sortie') || typeStr === 'out';
      const isEntree = typeStr.includes('entrée') || typeStr.includes('entree') || typeStr === 'in';

      if (isSortie) {
        monthSortiesCount++;
        monthConsumptionCost += cost;

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
    // 3. Corrective Maintenance, Downtime & Reliability (MTTR / MTBF / OEE)
    // =========================================================================
    let correctiveCount = 0;
    let correctiveClosedCount = 0;
    let correctiveInProgressCount = 0;
    let totalDowntimeHours = 0;
    let correctiveSparesCost = 0;
    const machineFailuresMap = new Map<string, FailingMachineSummary>();
    const techMap = new Map<string, TechnicianMonthlySummary>();
    const monthCorrectiveList: any[] = [];

    const ensureTech = (rawName: unknown): TechnicianMonthlySummary => {
      const name = String(rawName || 'Non assigné').trim() || 'Non assigné';
      let entry = techMap.get(name);
      if (!entry) {
        entry = { name, preventiveCount: 0, correctiveCount: 0, totalHours: 0 };
        techMap.set(name, entry);
      }
      return entry;
    };

    (correctiveInterventions || []).forEach((ci) => {
      if (!ci || isUnapprovedFieldClaim(ci)) return;
      const ciDate = normalizeDateToYMD(
        ci.date_demande ||
        ci.demande_date ||
        ci.date ||
        ci.date_cloture ||
        ci.date_fin ||
        ci.date_debut ||
        ci.created_at
      );
      if (!ciDate || !ciDate.startsWith(targetMonth)) return;

      monthCorrectiveList.push(ci);
      correctiveCount++;
      const status = String(ci.statut || ci.etat || '').toUpperCase();
      if (status === 'CLOTURE' || status === 'FERME' || status === 'TERMINE') {
        correctiveClosedCount++;
      } else {
        correctiveInProgressCount++;
      }

      // Downtime calculation: supports downtimeHours, temps_arret_minutes, temps_arret (HH:MM), temps_intervention_mins
      let dtHours = 0;
      if (typeof ci.downtimeHours === 'number' && ci.downtimeHours > 0) {
        dtHours = ci.downtimeHours;
      } else if (Number(ci.temps_arret_minutes) > 0) {
        dtHours = Number(ci.temps_arret_minutes) / 60;
      } else if (Number(ci.duree_arret) > 0) {
        dtHours = Number(ci.duree_arret);
      } else {
        const parsedMins = AvailabilityCalculationService.getDowntimeMinutes(ci);
        // Only count parsed fallback if it had explicit time fields or machine stoppage
        const hasTimeField = Boolean(
          ci.temps_arret ||
          ci.temps_intervention_mins ||
          ci.temps_minutes ||
          ci.temps_intervention ||
          ci.temps_intervention_calc
        );
        if (hasTimeField && parsedMins > 0) {
          dtHours = parsedMins / 60;
        }
      }

      if (Number.isFinite(dtHours) && dtHours > 0) {
        totalDowntimeHours += dtHours;
      }

      // Spares cost calculation (supports explicit cost, multi-PDR pieces_utilisees, or single pdr_ref)
      const explicitCost = Number(ci.pdr_cost ?? ci.cout_pdr ?? ci.cout_total ?? 0);
      if (Number.isFinite(explicitCost) && explicitCost > 0) {
        correctiveSparesCost += explicitCost;
      } else if (Array.isArray(ci.pieces_utilisees) && ci.pieces_utilisees.length > 0) {
        ci.pieces_utilisees.forEach((p: any) => {
          const pRef = String(p?.ref || p?.code_article || '').trim().toUpperCase();
          const pQty = Number(p?.quantite ?? p?.qte ?? 0);
          const pPrice =
            Number(p?.prix_unitaire ?? p?.prix ?? 0) ||
            (pRef ? stockPriceMap.get(pRef) || 0 : 0);
          if (pQty > 0 && pPrice > 0) {
            correctiveSparesCost += pQty * pPrice;
          }
        });
      } else {
        const pdrRef = String(ci.pdr_ref || ci.pdr || '').trim().toUpperCase();
        const qty = Number(ci.pdr_quantite ?? ci.quantite ?? (pdrRef ? 1 : 0));
        const unitPrice =
          Number(ci.pdr_prix ?? ci.prix_unitaire ?? 0) ||
          (pdrRef ? stockPriceMap.get(pdrRef) || 0 : 0);
        if (qty > 0 && unitPrice > 0) {
          correctiveSparesCost += qty * unitPrice;
        }
      }

      // Track technician corrective workload
      if (ci.intervenant) {
        const tEntry = ensureTech(ci.intervenant);
        tEntry.correctiveCount++;
        const workMins = Number(ci.temps_intervention_mins || ci.temps_minutes || 0) || Math.round(dtHours * 60);
        tEntry.totalHours = Number((tEntry.totalHours + workMins / 60).toFixed(1));
      }

      // Track failing machines
      const mCode = String(ci.code_machine || ci.id_machine || 'GLOBAL').trim().toUpperCase();
      const existingM = machineFailuresMap.get(mCode);
      if (existingM) {
        existingM.failureCount++;
        existingM.totalDowntimeHours = Number((existingM.totalDowntimeHours + (dtHours > 0 ? dtHours : 0)).toFixed(1));
      } else {
        machineFailuresMap.set(mCode, {
          machineCode: mCode,
          machineName: String(ci.nom_machine || mCode),
          failureCount: 1,
          totalDowntimeHours: Number((dtHours > 0 ? dtHours : 0).toFixed(1)),
        });
      }
    });

    const topFailingMachines = Array.from(machineFailuresMap.values())
      .sort((a, b) => b.failureCount - a.failureCount || b.totalDowntimeHours - a.totalDowntimeHours)
      .slice(0, 3);

    const activeProductionMachines = filterProductionMachines(machines || []);
    const activeMachinesList = filterActiveMachines(machines || []);
    const activeMachinesCount = Math.max(
      1,
      activeProductionMachines.length || activeMachinesList.length || machineFailuresMap.size || 1
    );
    const scheduledPlantHours = activeMachinesCount * 160;
    const mttrHours = AvailabilityCalculationService.calculateMTTR(monthCorrectiveList);
    const mttrFormatted = AvailabilityCalculationService.formatMTTR(monthCorrectiveList);
    const mtbfHours = AvailabilityCalculationService.calculateMTBF(monthCorrectiveList, scheduledPlantHours);
    const availabilityRate = AvailabilityCalculationService.calculateAvailability(monthCorrectiveList, scheduledPlantHours);

    // =========================================================================
    // 4. Preventive Maintenance Discipline & Technician Distribution
    // =========================================================================
    const monthExecutions = (preventiveExecutions || []).filter((e) => {
      if (!e || isUnapprovedFieldClaim(e)) return false;
      const eDate = normalizeDateToYMD(e.executedAt);
      return (e.periodMonth && e.periodMonth === targetMonth) || (eDate && eDate.startsWith(targetMonth));
    });

    monthExecutions.forEach((exec) => {
      const tEntry = ensureTech(exec.executorName || 'Technicien');
      tEntry.preventiveCount++;
      tEntry.totalHours = Number((tEntry.totalHours + (Number(exec.durationMinutes) || 30) / 60).toFixed(1));
    });

    const technicianBreakdown = Array.from(techMap.values()).sort(
      (a, b) => b.preventiveCount + b.correctiveCount - (a.preventiveCount + a.correctiveCount)
    );

    const preventiveExecutedCount = monthExecutions.length;
    const preventiveTotalCost = monthExecutions.reduce((sum, e) => sum + (Number(e.totalCost) || 0), 0);
    const totalMinutes = monthExecutions.reduce((sum, e) => sum + (Number(e.durationMinutes) || 0), 0);
    const preventiveLaborHours = Number((totalMinutes / 60).toFixed(1));

    const activeMachineCodes = new Set(
      activeMachinesList
        .map((m) => String(m?.id_machine_registered || m?.id || m?.code_machine || '').trim().toUpperCase())
        .filter(Boolean)
    );
    const hasRegisteredMachines = (machines || []).length > 0;

    const scheduledTasksForMonth = (preventiveTasks || []).filter((t) => {
      if (!t) return false;
      if (t.active === false || t.is_active === false) return false;
      const st = String(t.statut || t.status || '').trim().toUpperCase();
      if (st === 'ARCHIVE' || st === 'ARCHIVEE' || st === 'INACTIF' || st === 'ANNULE') return false;

      if (hasRegisteredMachines) {
        const mCode = String(t.code_machine || t.id_machine || t.machineCode || '').trim().toUpperCase();
        if (mCode && !activeMachineCodes.has(mCode)) {
          const existsInAll = (machines || []).some(
            (m) => String(m?.id_machine_registered || m?.id || m?.code_machine || '').trim().toUpperCase() === mCode
          );
          if (existsInAll) return false;
        }
      }

      if (t.periodMonth && String(t.periodMonth).trim() !== targetMonth) {
        return false;
      }

      const rawDue =
        t.nextDueDate ||
        t.prochaine_echeance ||
        t.date_prevue ||
        t.date_planifiee ||
        t.dueDate;
      const dueYMD = normalizeDateToYMD(rawDue);
      if (dueYMD) {
        const dueMonth = dueYMD.slice(0, 7);
        if (dueMonth > targetMonth) return false;
      }
      return true;
    });

    const totalActiveTasks = scheduledTasksForMonth.length;
    const preventiveScheduledCount = Math.max(preventiveExecutedCount, totalActiveTasks);

    const preventiveDisciplineRate = preventiveScheduledCount > 0
      ? Math.min(100, Math.round((preventiveExecutedCount / preventiveScheduledCount) * 100))
      : 100;

    let externalBobinageCount = 0;
    let externalBobinageCost = 0;
    (sortiesExterne || []).forEach((se) => {
      if (!se) return;
      const seDate = normalizeDateToYMD(
        se.date_montage || se.date_arrivee_reelle || se.date_expedition || se.date_demontage || se.created_at
      );
      if (seDate && seDate.startsWith(targetMonth)) {
        externalBobinageCount++;
        externalBobinageCost += Number(se.cout_bobinage || 0) || 0;
      }
    });

    return {
      periodMonth: targetMonth,
      stockValuationTotal: Number(stockValuationTotal.toFixed(2)),
      stockItemsCount: (stockItems || []).length,
      ruptureCount,
      alerteCount,
      ruptureItems: ruptureItems.slice(0, 10),
      alerteItems: alerteItems.slice(0, 10),
      openOrdersCount,
      openOrdersValue: Number(openOrdersValue.toFixed(2)),

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
      mttrHours,
      mttrFormatted,
      mtbfHours,
      availabilityRate,
      topFailingMachines,

      preventiveScheduledCount,
      preventiveExecutedCount,
      preventiveDisciplineRate,
      preventiveTotalCost: Number(preventiveTotalCost.toFixed(2)),
      preventiveLaborHours,
      technicianBreakdown,

      externalBobinageCount,
      externalBobinageCost: Number(externalBobinageCost.toFixed(2)),
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
    machines?: any[];
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

  /**
   * Computes a shift/daily/weekly operational report (Vue exploitation)
   * over an explicit [from, to] YMD range with optional asset_class filtering.
   */
  static buildShiftOrWeeklyReport(params: ShiftOrWeeklyReportParams): ShiftOrWeeklyReportData {
    return buildShiftOrWeeklyReport(params);
  }
}

export type ReportAssetClassFilter = 'ALL' | 'PRODUCTION' | 'SYSTEM_GENERAL';

export interface ShiftOrWeeklyReportParams {
  from: string; // 'YYYY-MM-DD'
  to: string; // 'YYYY-MM-DD'
  assetClass?: ReportAssetClassFilter;
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveTasks?: any[];
  preventiveExecutions?: PreventiveExecutionRecord[];
  sortieDemands?: any[];
  sortiesExterne?: any[];
  machines?: any[];
}

export interface OverduePreventiveTaskSnapshotItem {
  id: string;
  taskName: string;
  machineCode: string;
  machineName: string;
  assetClass: 'PRODUCTION' | 'SYSTEM_GENERAL';
  dueDate: string;
  assignedTo: string;
}

export interface SystemGeneralTypeBreakdown {
  systemTypeCode: string;
  assetsCount: number;
  correctiveCount: number;
  preventiveCount: number;
}

export interface ShiftOrWeeklyReportData {
  fromYMD: string;
  toYMD: string;
  daysCount: number;
  assetClassFilter: ReportAssetClassFilter;

  // 1. Correctif (Approved only)
  correctiveTotalInPeriodCount: number;
  correctiveClosedInPeriodCount: number;
  correctiveInProgressInPeriodCount: number;
  correctiveOpenSnapshotCount: number; // Currently open BTs/DIs (EN_COURS / EN_ATTENTE_PDR / DEMANDE)
  totalDowntimeHours: number;
  correctiveSparesCost: number;
  topFailingMachines: Array<FailingMachineSummary & { assetClass: 'PRODUCTION' | 'SYSTEM_GENERAL' }>;

  // Production-only reliability (never mixes SYSTEM_GENERAL assets into MTBF)
  productionMachinesCount: number;
  scheduledProductionHours: number;
  mttrHours: number;
  mttrFormatted: string;
  mtbfHours: number;
  availabilityRate: number;

  // 2. Préventif (Approved only) & B3 Conformité Temporelle (ON_TIME | LATE | OVERDUE)
  preventiveExecutedInPeriodCount: number;
  preventiveDueInWindowCount: number;
  preventiveDisciplineRate: number;
  preventiveOverdueSnapshotCount: number;
  overdueSnapshotDefinition: string;
  overdueTasksSample: OverduePreventiveTaskSnapshotItem[];
  preventiveTotalCost: number;
  preventiveLaborHours: number;
  pmCompliance: PmWindowComplianceSummary;

  // 3. Magasin (Official mouvements vs Pending SortieDemands)
  sortiesCount: number;
  sortiesTotalQuantity: number;
  entreesCount: number;
  consumptionCost: number;
  entriesCost: number;
  topConsumedParts: ConsumedPartSummary[];
  pendingSortieDemandsWarningCount: number;

  // 4. File d'attente Maker-Checker (Live Snapshot + Period Unapproved Excluded)
  makerCheckerQueue: {
    pendingCorrectiveCount: number;
    clarificationCorrectiveCount: number;
    pendingPreventiveCount: number;
    clarificationPreventiveCount: number;
    pendingSortieDemandsCount: number;
    clarificationSortieDemandsCount: number;
    totalPendingCount: number;
    totalClarificationCount: number;
    reservedRefsCount: number;
    totalReservedUnits: number;
  };
  excludedUnapprovedInPeriod: {
    correctiveCount: number;
    preventiveCount: number;
    sortieDemandsCount: number;
    totalExcludedCount: number;
  };

  // 5. Système Général (Dedicated operational view)
  systemGeneralSummary: {
    totalAssetsCount: number;
    correctiveInPeriodCount: number;
    correctiveClosedInPeriodCount: number;
    preventiveInPeriodCount: number;
    bySystemType: SystemGeneralTypeBreakdown[];
  };

  // Technician workload in period (Approved only)
  technicianBreakdown: TechnicianMonthlySummary[];

  // External Subcontracting / Bobinage in period
  externalBobinageCount?: number;
  externalBobinageCost?: number;

  // C1 — Official Machine Cost Summary (Approved BT + Approved PM + External Bobinage)
  totalOfficialMaintenanceCost: number;
  machineCostBreakdown: MachineOfficialCostRow[];

  // C2 — Official Validated Movements in Period (for CSV / JSON practical export)
  officialMovementsInPeriod: OfficialMovementExportRow[];
}

export interface MachineOfficialCostRow {
  machineCode: string;
  machineName: string;
  assetClass: 'PRODUCTION' | 'SYSTEM_GENERAL';
  failureCount: number;
  correctiveCount: number;
  correctiveCost: number;
  correctivePdrCost: number;
  preventiveCount: number;
  preventiveCost: number;
  externalBobinageCount: number;
  externalBobinageCost: number;
  totalOfficialCost: number;
  totalDowntimeHours: number;
}

export interface OfficialMovementExportRow {
  id: string;
  date: string;
  codeBon: string;
  type: string;
  machineCode: string;
  ref: string;
  designation: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
}

export type PmComplianceStatus = 'ON_TIME' | 'LATE' | 'OVERDUE';

export interface PmComplianceTaskItem {
  taskId: string;
  taskName: string;
  machineCode: string;
  machineName: string;
  assetClass: 'PRODUCTION' | 'SYSTEM_GENERAL';
  dueDate: string;
  approvedExecutedAt?: string;
  status: PmComplianceStatus;
  statusLabelFr: 'À temps' | 'Fait en retard' | 'En retard (Non réalisé)';
  assignedTo: string;
  hasPendingClaim?: boolean;
}

export interface PmWindowComplianceSummary {
  onTimeCount: number;
  lateCompletedCount: number;
  overdueCount: number;
  completedTotalCount: number;
  totalEligibleCount: number;
  onTimeComplianceRate: number;
  overallCompletionRate: number;
  pendingClaimsExcludedCount: number;
  archivedExcludedCount: number;
  items: PmComplianceTaskItem[];
}

export function computePmWindowCompliance({
  fromYMD,
  toYMD,
  assetClass = 'ALL',
  preventiveTasks = [],
  preventiveExecutions = [],
  machines = [],
}: {
  fromYMD: string;
  toYMD: string;
  assetClass?: ReportAssetClassFilter;
  preventiveTasks?: any[];
  preventiveExecutions?: any[];
  machines?: any[];
}): PmWindowComplianceSummary {
  const activeMachinesList = filterActiveMachines(machines || []);
  const activeMachineCodes = new Set<string>();
  activeMachinesList.forEach((m) => {
    [m?.id_machine_registered, m?.id, m?.code, m?.id_machine, m?.code_machine]
      .map((c) => String(c || '').trim().toUpperCase())
      .filter(Boolean)
      .forEach((code) => activeMachineCodes.add(code));
  });

  const allRegisteredMachineCodes = new Set<string>();
  const machineInfoMap = new Map<
    string,
    { code: string; name: string; assetClass: 'PRODUCTION' | 'SYSTEM_GENERAL' }
  >();
  (machines || []).forEach((m) => {
    if (!m) return;
    const rawCodes = [m.id_machine_registered, m.id, m.code, m.id_machine, m.code_machine]
      .map((c) => String(c || '').trim().toUpperCase())
      .filter(Boolean);
    if (rawCodes.length === 0) return;
    const mClass = getMachineAssetClass(m);
    const mName = String(m.nom || m.designation || m.name || rawCodes[0]).trim();
    rawCodes.forEach((c) => {
      allRegisteredMachineCodes.add(c);
      machineInfoMap.set(c, { code: rawCodes[0], name: mName, assetClass: mClass });
    });
  });

  const resolveTaskAssetMeta = (record: any) => {
    const explicitClass = String(record?.asset_class || '').trim().toUpperCase();
    const rawCode = String(
      record?.code_machine ||
        record?.id_machine ||
        record?.machineCode ||
        record?.id_machine_registered ||
        record?.machine ||
        ''
    )
      .trim()
      .toUpperCase();
    const info = rawCode ? machineInfoMap.get(rawCode) : undefined;
    const resolvedClass: 'PRODUCTION' | 'SYSTEM_GENERAL' =
      explicitClass === 'SYSTEM_GENERAL'
        ? 'SYSTEM_GENERAL'
        : explicitClass === 'PRODUCTION'
        ? 'PRODUCTION'
        : info?.assetClass || 'PRODUCTION';
    return {
      assetClass: resolvedClass,
      machineCode: info?.code || rawCode || 'GLOBAL',
      rawCode,
      machineName: String(record?.nom_machine || record?.machineName || info?.name || rawCode || 'GLOBAL'),
    };
  };

  const matchesClassFilter = (recClass: 'PRODUCTION' | 'SYSTEM_GENERAL'): boolean => {
    if (!assetClass || assetClass === 'ALL') return true;
    return recClass === assetClass;
  };

  const isTaskArchivedOrInactive = (t: any): boolean => {
    if (!t) return true;
    if (t.active === false || t.is_active === false || t.actif === false) return true;
    if (t.archived === true || t.isArchived === true) return true;
    const st = String(t.statut || t.status || t.etat || '').trim().toUpperCase();
    if (
      st === 'ARCHIVE' ||
      st === 'ARCHIVEE' ||
      st === 'ARCHIVÉE' ||
      st === 'ARCHIVED' ||
      st === 'INACTIF' ||
      st === 'ANNULE' ||
      st === 'SUSPENDU' ||
      st === 'SUSPENDUE'
    ) {
      return true;
    }
    return false;
  };

  const isMachineArchivedOrInactive = (rawCode: string, canonicalCode: string): boolean => {
    if (allRegisteredMachineCodes.size === 0) return false;
    const candidates = [rawCode, canonicalCode].filter((c) => c && c !== 'GLOBAL');
    if (candidates.length === 0) return false;
    const existsInRegistered = candidates.some((c) => allRegisteredMachineCodes.has(c));
    if (!existsInRegistered) return false;
    const isActive = candidates.some((c) => activeMachineCodes.has(c));
    return !isActive;
  };

  const isWithinWindow = (ymd: string | null | undefined): boolean => {
    if (!ymd) return false;
    return ymd >= fromYMD && ymd <= toYMD;
  };

  let archivedExcludedCount = 0;
  let pendingClaimsExcludedCount = 0;
  const activeTaskById = new Map<string, any>();

  (preventiveTasks || []).forEach((t) => {
    if (!t) return;
    const meta = resolveTaskAssetMeta(t);
    if (!matchesClassFilter(meta.assetClass)) return;

    if (isTaskArchivedOrInactive(t) || isMachineArchivedOrInactive(meta.rawCode, meta.machineCode)) {
      archivedExcludedCount++;
      return;
    }

    const tid = String(t.id || t.code_tache || '').trim();
    if (tid) {
      activeTaskById.set(tid, t);
    }
  });

  // Group executions in window by taskId
  const approvedExecByTask = new Map<string, any>();
  const pendingClaimTaskIds = new Set<string>();

  (preventiveExecutions || []).forEach((ex) => {
    if (!ex) return;
    const statusUpper = String(ex.status || '').trim().toUpperCase();
    if (statusUpper === 'SKIPPED') return;

    const tid = String(ex.taskId || ex.id_tache || ex.id || '').trim();
    const linkedTask = tid ? (preventiveTasks || []).find((pt) => String(pt?.id || pt?.code_tache || '').trim() === tid) : null;

    const meta = resolveTaskAssetMeta(linkedTask || ex);
    if (!matchesClassFilter(meta.assetClass)) return;

    // Exclude executions linked to archived tasks or archived machines from denominator
    if (
      (linkedTask && isTaskArchivedOrInactive(linkedTask)) ||
      isMachineArchivedOrInactive(meta.rawCode, meta.machineCode)
    ) {
      return;
    }

    const execYMD = normalizeDateToYMD(ex.executedAt || ex.date || ex.created_at);
    if (!isWithinWindow(execYMD)) return;

    if (isUnapprovedFieldClaim(ex)) {
      if (tid) pendingClaimTaskIds.add(tid);
      pendingClaimsExcludedCount++;
      return;
    }

    const key = tid || `EXEC-${String(ex.id || approvedExecByTask.size + 1)}`;
    const prev = approvedExecByTask.get(key);
    if (!prev) {
      approvedExecByTask.set(key, ex);
    } else {
      const prevYMD = normalizeDateToYMD(prev.executedAt || prev.date) || '';
      if ((execYMD || '') >= prevYMD) {
        approvedExecByTask.set(key, ex);
      }
    }
  });

  const items: PmComplianceTaskItem[] = [];
  const handledTaskIds = new Set<string>();

  // 1) Process approved executions in window -> ON_TIME vs LATE
  approvedExecByTask.forEach((ex, key) => {
    const linkedTask = activeTaskById.get(key);
    if (linkedTask) {
      handledTaskIds.add(key);
    }

    const meta = resolveTaskAssetMeta(linkedTask || ex);
    const execYMD = normalizeDateToYMD(ex.executedAt || ex.date || ex.created_at) || toYMD;

    const rawScheduledDue =
      ex.scheduledDueDate ||
      ex.dueDate ||
      ex.echeance ||
      linkedTask?.echeance_precedente ||
      linkedTask?.scheduledDueDate ||
      linkedTask?.date_prevue ||
      linkedTask?.date_planifiee ||
      linkedTask?.dueDate;
    let dueYMD = normalizeDateToYMD(rawScheduledDue);

    if (!dueYMD && linkedTask) {
      const candidateNext = normalizeDateToYMD(linkedTask.prochaine_echeance || linkedTask.nextDueDate);
      if (candidateNext && candidateNext <= toYMD) {
        dueYMD = candidateNext;
      }
    }

    const isLateCompletion = Boolean(dueYMD && execYMD > dueYMD);
    const status: PmComplianceStatus = isLateCompletion ? 'LATE' : 'ON_TIME';

    items.push({
      taskId: key,
      taskName: String(
        ex.taskName || linkedTask?.tache || linkedTask?.designation || linkedTask?.organe || 'Tâche préventive'
      ),
      machineCode: meta.machineCode,
      machineName: meta.machineName,
      assetClass: meta.assetClass,
      dueDate: dueYMD || execYMD,
      approvedExecutedAt: execYMD,
      status,
      statusLabelFr: status === 'ON_TIME' ? 'À temps' : 'Fait en retard',
      assignedTo: String(ex.executorName || linkedTask?.responsable || linkedTask?.technicien || 'Technicien'),
    });
  });

  // 2) Process remaining active tasks in activeTaskById
  activeTaskById.forEach((t, tid) => {
    if (handledTaskIds.has(tid)) return;

    const meta = resolveTaskAssetMeta(t);
    const etatNorm = String(t.etat || t.statut || '').trim().toUpperCase();
    const isTaskMarkedDone = etatNorm === 'FAIT' || etatNorm === 'TERMINE' || etatNorm === 'EXECUTE';
    const isTaskUnapprovedClaim = isUnapprovedFieldClaim(t);

    if (isTaskUnapprovedClaim && !pendingClaimTaskIds.has(tid)) {
      pendingClaimTaskIds.add(tid);
      pendingClaimsExcludedCount++;
    }

    const rawDue =
      t.scheduledDueDate ||
      t.echeance_precedente ||
      t.nextDueDate ||
      t.prochaine_echeance ||
      t.date_prevue ||
      t.date_planifiee ||
      t.dueDate;
    const dueYMD = normalizeDateToYMD(rawDue);
    const lastRealizedYMD = normalizeDateToYMD(t.derniere_realisation || t.date_realisation || t.executedAt);

    // Support direct approved task completion within window when no separate PreventiveExecutionRecord was pushed
    if (isTaskMarkedDone && !isTaskUnapprovedClaim && isWithinWindow(lastRealizedYMD)) {
      const effectiveDue =
        normalizeDateToYMD(t.echeance_precedente || t.scheduledDueDate || t.date_prevue || t.date_planifiee || t.dueDate) ||
        (dueYMD && dueYMD <= toYMD ? dueYMD : null);
      const isLate = Boolean(effectiveDue && lastRealizedYMD! > effectiveDue);
      const status: PmComplianceStatus = isLate ? 'LATE' : 'ON_TIME';
      items.push({
        taskId: tid,
        taskName: String(t.tache || t.designation || t.organe || 'Tâche préventive'),
        machineCode: meta.machineCode,
        machineName: meta.machineName,
        assetClass: meta.assetClass,
        dueDate: effectiveDue || lastRealizedYMD!,
        approvedExecutedAt: lastRealizedYMD!,
        status,
        statusLabelFr: status === 'ON_TIME' ? 'À temps' : 'Fait en retard',
        assignedTo: String(t.responsable || t.technicien || 'Technicien'),
      });
      return;
    }

    // If task is already approved-done and its next due date is in the future (> toYMD), it's not due in this window
    if (isTaskMarkedDone && !isTaskUnapprovedClaim && (!dueYMD || dueYMD > toYMD)) {
      return;
    }

    const isExplicitLate = etatNorm.includes('RETARD');
    const isDueByEndOfWindow = Boolean(dueYMD && dueYMD <= toYMD);

    if (isExplicitLate || isDueByEndOfWindow) {
      items.push({
        taskId: tid,
        taskName: String(t.tache || t.designation || t.organe || 'Tâche préventive'),
        machineCode: meta.machineCode,
        machineName: meta.machineName,
        assetClass: meta.assetClass,
        dueDate: dueYMD || toYMD,
        status: 'OVERDUE',
        statusLabelFr: 'En retard (Non réalisé)',
        assignedTo: String(t.responsable || t.technicien || 'Non assigné'),
        hasPendingClaim: isTaskUnapprovedClaim || pendingClaimTaskIds.has(tid),
      });
    }
  });

  const onTimeCount = items.filter((i) => i.status === 'ON_TIME').length;
  const lateCompletedCount = items.filter((i) => i.status === 'LATE').length;
  const overdueCount = items.filter((i) => i.status === 'OVERDUE').length;
  const completedTotalCount = onTimeCount + lateCompletedCount;
  const totalEligibleCount = onTimeCount + lateCompletedCount + overdueCount;

  const onTimeComplianceRate =
    totalEligibleCount > 0 ? Math.min(100, Math.round((onTimeCount / totalEligibleCount) * 100)) : 100;
  const overallCompletionRate =
    totalEligibleCount > 0 ? Math.min(100, Math.round((completedTotalCount / totalEligibleCount) * 100)) : 100;

  return {
    onTimeCount,
    lateCompletedCount,
    overdueCount,
    completedTotalCount,
    totalEligibleCount,
    onTimeComplianceRate,
    overallCompletionRate,
    pendingClaimsExcludedCount,
    archivedExcludedCount,
    items,
  };
}

export function buildShiftOrWeeklyReport({
  from,
  to,
  assetClass = 'ALL',
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveTasks = [],
  preventiveExecutions = [],
  sortieDemands = [],
  sortiesExterne = [],
  machines = [],
}: ShiftOrWeeklyReportParams): ShiftOrWeeklyReportData {
  const todayYMD = new Date().toISOString().slice(0, 10);
  const rawFrom = normalizeDateToYMD(from) || todayYMD;
  const rawTo = normalizeDateToYMD(to) || todayYMD;
  const [fromYMD, toYMD] = rawFrom <= rawTo ? [rawFrom, rawTo] : [rawTo, rawFrom];

  const startMs = new Date(`${fromYMD}T00:00:00Z`).getTime();
  const endMs = new Date(`${toYMD}T00:00:00Z`).getTime();
  const daysCount =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
      ? Math.max(1, Math.round((endMs - startMs) / 86400000) + 1)
      : 1;

  const isWithinRange = (ymd: string | null | undefined): boolean => {
    if (!ymd) return false;
    return ymd >= fromYMD && ymd <= toYMD;
  };

  // Build machine lookup map (code -> asset_class, system_type_code, name)
  const activeMachinesList = filterActiveMachines(machines || []);
  const activeProductionMachines = filterProductionMachines(machines || []);

  const machineInfoMap = new Map<
    string,
    {
      code: string;
      name: string;
      assetClass: 'PRODUCTION' | 'SYSTEM_GENERAL';
      systemTypeCode: string;
    }
  >();

  (machines || []).forEach((m) => {
    if (!m) return;
    const rawCodes = [
      m.id_machine_registered,
      m.id,
      m.code,
      m.id_machine,
      m.code_machine,
    ]
      .map((c) => String(c || '').trim().toUpperCase())
      .filter(Boolean);
    if (rawCodes.length === 0) return;

    const mClass = getMachineAssetClass(m);
    const sysType = String(m.system_type_code || (mClass === 'SYSTEM_GENERAL' ? 'SYS-AUTRE' : '')).trim().toUpperCase();
    const mName = String(m.nom || m.designation || m.name || rawCodes[0]).trim();

    for (const c of rawCodes) {
      machineInfoMap.set(c, {
        code: rawCodes[0],
        name: mName,
        assetClass: mClass,
        systemTypeCode: sysType,
      });
    }
  });

  const resolveRecordAssetClass = (
    record: any,
    primaryMachineField?: string
  ): {
    assetClass: 'PRODUCTION' | 'SYSTEM_GENERAL';
    machineCode: string;
    machineName: string;
    systemTypeCode: string;
  } => {
    const explicitClass = String(record?.asset_class || '').trim().toUpperCase();
    const rawCode = String(
      (primaryMachineField ? record?.[primaryMachineField] : '') ||
        record?.code_machine ||
        record?.id_machine ||
        record?.machineCode ||
        record?.id_machine_registered ||
        record?.machine ||
        ''
    )
      .trim()
      .toUpperCase();

    const info = rawCode ? machineInfoMap.get(rawCode) : undefined;
    const resolvedClass: 'PRODUCTION' | 'SYSTEM_GENERAL' =
      explicitClass === 'SYSTEM_GENERAL'
        ? 'SYSTEM_GENERAL'
        : explicitClass === 'PRODUCTION'
        ? 'PRODUCTION'
        : info?.assetClass || 'PRODUCTION';

    const sysType =
      String(record?.system_type_code || info?.systemTypeCode || (resolvedClass === 'SYSTEM_GENERAL' ? 'SYS-AUTRE' : ''))
        .trim()
        .toUpperCase();

    return {
      assetClass: resolvedClass,
      machineCode: info?.code || rawCode || 'GLOBAL',
      machineName: String(record?.nom_machine || record?.machineName || info?.name || rawCode || 'GLOBAL'),
      systemTypeCode: sysType,
    };
  };

  const matchesClassFilter = (recClass: 'PRODUCTION' | 'SYSTEM_GENERAL'): boolean => {
    if (!assetClass || assetClass === 'ALL') return true;
    return recClass === assetClass;
  };

  // Stock price lookup
  const stockPriceMap = new Map<string, number>();
  (stockItems || []).forEach((item) => {
    const ref = String(item?.ref || item?.reference || item?.code_article || '').trim().toUpperCase();
    const price = Number(
      item?.prix_unitaire ?? item?.prixUnitaire ?? item?.prix_achat_ht ?? item?.prix ?? item?.unitPrice ?? 0
    );
    if (ref && price > 0) {
      stockPriceMap.set(ref, price);
    }
  });

  // System General aggregation map
  const sysGenTypeMap = new Map<string, SystemGeneralTypeBreakdown>();
  const ensureSysGenBucket = (sysCode: string): SystemGeneralTypeBreakdown => {
    const key = sysCode || 'SYS-AUTRE';
    let b = sysGenTypeMap.get(key);
    if (!b) {
      b = { systemTypeCode: key, assetsCount: 0, correctiveCount: 0, preventiveCount: 0 };
      sysGenTypeMap.set(key, b);
    }
    return b;
  };

  let totalSystemGeneralAssetsCount = 0;
  activeMachinesList.forEach((m) => {
    if (getMachineAssetClass(m) === 'SYSTEM_GENERAL') {
      totalSystemGeneralAssetsCount++;
      const st = String(m.system_type_code || 'SYS-AUTRE').trim().toUpperCase();
      ensureSysGenBucket(st).assetsCount++;
    }
  });

  // =========================================================================
  // 1. Corrective Maintenance (Approved Only vs Unapproved Excluded)
  // =========================================================================
  let correctiveTotalInPeriodCount = 0;
  let correctiveClosedInPeriodCount = 0;
  let correctiveInProgressInPeriodCount = 0;
  let correctiveOpenSnapshotCount = 0;
  let totalDowntimeHours = 0;
  let correctiveSparesCost = 0;

  let systemGeneralCorrectiveInPeriod = 0;
  let systemGeneralCorrectiveClosedInPeriod = 0;
  let excludedUnapprovedCorrectiveInPeriod = 0;

  const machineFailuresMap = new Map<
    string,
    FailingMachineSummary & { assetClass: 'PRODUCTION' | 'SYSTEM_GENERAL' }
  >();
  const machineCostMap = new Map<string, MachineOfficialCostRow>();
  const ensureMachineCostRow = (meta: {
    machineCode: string;
    machineName: string;
    assetClass: 'PRODUCTION' | 'SYSTEM_GENERAL';
  }): MachineOfficialCostRow => {
    const code = meta.machineCode || 'GLOBAL';
    let row = machineCostMap.get(code);
    if (!row) {
      row = {
        machineCode: code,
        machineName: meta.machineName || code,
        assetClass: meta.assetClass,
        failureCount: 0,
        correctiveCount: 0,
        correctiveCost: 0,
        correctivePdrCost: 0,
        preventiveCount: 0,
        preventiveCost: 0,
        externalBobinageCount: 0,
        externalBobinageCost: 0,
        totalOfficialCost: 0,
        totalDowntimeHours: 0,
      };
      machineCostMap.set(code, row);
    }
    return row;
  };
  const techMap = new Map<string, TechnicianMonthlySummary>();
  const productionCorrectiveInPeriod: any[] = [];

  const ensureTech = (rawName: unknown): TechnicianMonthlySummary => {
    const name = String(rawName || 'Non assigné').trim() || 'Non assigné';
    let entry = techMap.get(name);
    if (!entry) {
      entry = { name, preventiveCount: 0, correctiveCount: 0, totalHours: 0 };
      techMap.set(name, entry);
    }
    return entry;
  };

  (correctiveInterventions || []).forEach((ci) => {
    if (!ci) return;
    const meta = resolveRecordAssetClass(ci, 'code_machine');
    const status = String(ci.statut || ci.etat || '').trim().toUpperCase();
    const isClosed = status === 'CLOTURE' || status === 'FERME' || status === 'TERMINE';

    // Choose best date for period attribution (prefer closure/validation date when closed)
    const ciDate = normalizeDateToYMD(
      (isClosed ? ci.date_cloture || ci.date_fin || ci.validated_at : '') ||
        ci.date_demande ||
        ci.demande_date ||
        ci.date ||
        ci.date_cloture ||
        ci.date_fin ||
        ci.date_debut ||
        ci.created_at
    );

    if (isUnapprovedFieldClaim(ci)) {
      if (isWithinRange(ciDate) && matchesClassFilter(meta.assetClass)) {
        excludedUnapprovedCorrectiveInPeriod++;
      }
      return;
    }

    // Snapshot of currently open BTs/DIs (approved/official workflow, not closed/cancelled)
    if (!isClosed && status !== 'ANNULE' && status !== 'REJECTED' && matchesClassFilter(meta.assetClass)) {
      correctiveOpenSnapshotCount++;
    }

    if (!isWithinRange(ciDate)) return;

    // System General tracking (always tracked on SYSTEM_GENERAL assets in the period)
    if (meta.assetClass === 'SYSTEM_GENERAL') {
      systemGeneralCorrectiveInPeriod++;
      if (isClosed) systemGeneralCorrectiveClosedInPeriod++;
      ensureSysGenBucket(meta.systemTypeCode).correctiveCount++;
    } else {
      productionCorrectiveInPeriod.push(ci);
    }

    if (!matchesClassFilter(meta.assetClass)) return;

    correctiveTotalInPeriodCount++;
    if (isClosed) {
      correctiveClosedInPeriodCount++;
    } else {
      correctiveInProgressInPeriodCount++;
    }

    // Downtime calculation
    let dtHours = 0;
    if (typeof ci.downtimeHours === 'number' && ci.downtimeHours > 0) {
      dtHours = ci.downtimeHours;
    } else if (Number(ci.temps_arret_minutes) > 0) {
      dtHours = Number(ci.temps_arret_minutes) / 60;
    } else if (Number(ci.duree_arret) > 0) {
      dtHours = Number(ci.duree_arret);
    } else {
      const parsedMins = AvailabilityCalculationService.getDowntimeMinutes(ci);
      const hasTimeField = Boolean(
        ci.temps_arret ||
          ci.temps_intervention_mins ||
          ci.temps_minutes ||
          ci.temps_intervention ||
          ci.temps_intervention_calc
      );
      if (hasTimeField && parsedMins > 0) {
        dtHours = parsedMins / 60;
      }
    }

    if (Number.isFinite(dtHours) && dtHours > 0) {
      totalDowntimeHours += dtHours;
    }

    // Approved spares cost (strictly pieces_utilisees / pdr_cost, never pieces_proposees)
    let btOfficialCost = 0;
    const explicitCost = Number(ci.pdr_cost ?? ci.cout_pdr ?? ci.cout_total ?? 0);
    if (Number.isFinite(explicitCost) && explicitCost > 0) {
      btOfficialCost = explicitCost;
    } else if (Array.isArray(ci.pieces_utilisees) && ci.pieces_utilisees.length > 0) {
      ci.pieces_utilisees.forEach((p: any) => {
        const pRef = String(p?.ref || p?.code_article || '').trim().toUpperCase();
        const pQty = Number(p?.quantite ?? p?.qte ?? p?.qty ?? 0);
        const pPrice =
          Number(p?.prix_unitaire ?? p?.prix ?? p?.unitPrice ?? 0) ||
          (pRef ? stockPriceMap.get(pRef) || 0 : 0);
        if (pQty > 0 && pPrice > 0) {
          btOfficialCost += pQty * pPrice;
        }
      });
    } else {
      const pdrRef = String(ci.pdr_ref || ci.pdr || '').trim().toUpperCase();
      const qty = Number(ci.pdr_quantite ?? ci.quantite ?? (pdrRef ? 1 : 0));
      const unitPrice =
        Number(ci.pdr_prix ?? ci.prix_unitaire ?? 0) ||
        (pdrRef ? stockPriceMap.get(pdrRef) || 0 : 0);
      if (qty > 0 && unitPrice > 0) {
        btOfficialCost = qty * unitPrice;
      }
    }
    correctiveSparesCost += btOfficialCost;

    const costRow = ensureMachineCostRow(meta);
    costRow.failureCount++;
    costRow.correctiveCount++;
    costRow.correctiveCost = Number((costRow.correctiveCost + btOfficialCost).toFixed(2));
    costRow.correctivePdrCost = costRow.correctiveCost;
    costRow.totalDowntimeHours = Number(
      (costRow.totalDowntimeHours + (dtHours > 0 ? dtHours : 0)).toFixed(1)
    );
    costRow.totalOfficialCost = Number(
      (costRow.correctiveCost + costRow.preventiveCost + costRow.externalBobinageCost).toFixed(2)
    );

    if (ci.intervenant) {
      const tEntry = ensureTech(ci.intervenant);
      tEntry.correctiveCount++;
      const workMins =
        Number(ci.temps_intervention_mins || ci.temps_minutes || 0) || Math.round(dtHours * 60);
      tEntry.totalHours = Number((tEntry.totalHours + workMins / 60).toFixed(1));
    }

    const existingM = machineFailuresMap.get(meta.machineCode);
    if (existingM) {
      existingM.failureCount++;
      existingM.totalDowntimeHours = Number(
        (existingM.totalDowntimeHours + (dtHours > 0 ? dtHours : 0)).toFixed(1)
      );
    } else {
      machineFailuresMap.set(meta.machineCode, {
        machineCode: meta.machineCode,
        machineName: meta.machineName,
        assetClass: meta.assetClass,
        failureCount: 1,
        totalDowntimeHours: Number((dtHours > 0 ? dtHours : 0).toFixed(1)),
      });
    }
  });

  const topFailingMachines = Array.from(machineFailuresMap.values())
    .sort((a, b) => b.failureCount - a.failureCount || b.totalDowntimeHours - a.totalDowntimeHours)
    .slice(0, 5);

  // Reliability strictly on PRODUCTION machines (never diluted by fire extinguishers / SYSTEM_GENERAL)
  const productionMachinesCount = Math.max(1, activeProductionMachines.length || 1);
  const scheduledProductionHours = productionMachinesCount * daysCount * 8; // 8h standard shift/day per production machine
  const mttrHours = AvailabilityCalculationService.calculateMTTR(productionCorrectiveInPeriod);
  const mttrFormatted = AvailabilityCalculationService.formatMTTR(productionCorrectiveInPeriod);
  const mtbfHours = AvailabilityCalculationService.calculateMTBF(
    productionCorrectiveInPeriod,
    scheduledProductionHours
  );
  const availabilityRate = AvailabilityCalculationService.calculateAvailability(
    productionCorrectiveInPeriod,
    scheduledProductionHours
  );

  // =========================================================================
  // 2. Preventive Maintenance (Approved Executions, Overdue Snapshot & Discipline)
  // =========================================================================
  let preventiveExecutedInPeriodCount = 0;
  let preventiveTotalCost = 0;
  let totalPreventiveMinutes = 0;
  let systemGeneralPreventiveInPeriod = 0;
  let excludedUnapprovedPreventiveInPeriod = 0;

  (preventiveExecutions || []).forEach((ex) => {
    if (!ex) return;
    const meta = resolveRecordAssetClass(ex, 'machineCode');
    const eDate = normalizeDateToYMD(ex.executedAt || (ex as any).date);

    if (isUnapprovedFieldClaim(ex)) {
      if (isWithinRange(eDate) && matchesClassFilter(meta.assetClass)) {
        excludedUnapprovedPreventiveInPeriod++;
      }
      return;
    }

    if (!isWithinRange(eDate)) return;

    if (meta.assetClass === 'SYSTEM_GENERAL') {
      systemGeneralPreventiveInPeriod++;
      ensureSysGenBucket(meta.systemTypeCode).preventiveCount++;
    }

    if (!matchesClassFilter(meta.assetClass)) return;

    const exOfficialCost = Number(ex.totalCost ?? ex.sparesCost ?? 0) || 0;
    preventiveExecutedInPeriodCount++;
    preventiveTotalCost += exOfficialCost;
    totalPreventiveMinutes += Number(ex.durationMinutes) || 0;

    const costRow = ensureMachineCostRow(meta);
    costRow.preventiveCount++;
    costRow.preventiveCost = Number((costRow.preventiveCost + exOfficialCost).toFixed(2));
    costRow.totalOfficialCost = Number(
      (costRow.correctiveCost + costRow.preventiveCost + costRow.externalBobinageCost).toFixed(2)
    );

    const tEntry = ensureTech(ex.executorName || 'Technicien');
    tEntry.preventiveCount++;
    tEntry.totalHours = Number(
      (tEntry.totalHours + (Number(ex.durationMinutes) || 30) / 60).toFixed(1)
    );
  });

  const preventiveLaborHours = Number((totalPreventiveMinutes / 60).toFixed(1));

  // Overdue snapshot & due tasks in window
  const activeMachineCodes = new Set(
    activeMachinesList
      .map((m) => String(m?.id_machine_registered || m?.id || m?.code_machine || '').trim().toUpperCase())
      .filter(Boolean)
  );
  const hasRegisteredMachines = (machines || []).length > 0;

  const overdueTasksList: OverduePreventiveTaskSnapshotItem[] = [];
  let dueInWindowTasksCount = 0;

  (preventiveTasks || []).forEach((t) => {
    if (!t) return;
    if (t.active === false || t.is_active === false) return;
    const st = String(t.statut || t.status || '').trim().toUpperCase();
    if (st === 'ARCHIVE' || st === 'ARCHIVEE' || st === 'INACTIF' || st === 'ANNULE') return;

    const meta = resolveRecordAssetClass(t, 'code_machine');
    if (!matchesClassFilter(meta.assetClass)) return;

    if (hasRegisteredMachines && meta.machineCode !== 'GLOBAL') {
      if (!activeMachineCodes.has(meta.machineCode)) {
        const existsInAll = (machines || []).some(
          (m) =>
            String(m?.id_machine_registered || m?.id || m?.code_machine || '').trim().toUpperCase() ===
            meta.machineCode
        );
        if (existsInAll) return;
      }
    }

    const etatNorm = String(t.etat || t.statut || '').trim().toUpperCase();
    const isAlreadyDone = etatNorm === 'FAIT' || etatNorm === 'TERMINE' || etatNorm === 'EXECUTE';
    const isPendingValidation = isUnapprovedFieldClaim(t);

    const rawDue =
      t.nextDueDate ||
      t.prochaine_echeance ||
      t.date_prevue ||
      t.date_planifiee ||
      t.dueDate;
    const dueYMD = normalizeDateToYMD(rawDue);

    const isExplicitLate = etatNorm.includes('RETARD');
    const isDateLate = Boolean(dueYMD && dueYMD < toYMD && !isAlreadyDone && !isPendingValidation);

    if ((isExplicitLate || isDateLate) && !isPendingValidation) {
      overdueTasksList.push({
        id: String(t.id || t.code_tache || `PM-${overdueTasksList.length + 1}`),
        taskName: String(t.tache || t.designation || t.organe || 'Tâche préventive'),
        machineCode: meta.machineCode,
        machineName: meta.machineName,
        assetClass: meta.assetClass,
        dueDate: dueYMD || toYMD,
        assignedTo: String(t.responsable || t.technicien || 'Non assigné'),
      });
    }

    // Count tasks due up to end of period (excluding annual/future tasks beyond toYMD)
    if (isExplicitLate || isDateLate || (dueYMD && dueYMD >= fromYMD && dueYMD <= toYMD)) {
      dueInWindowTasksCount++;
    }
  });

  const pmCompliance = computePmWindowCompliance({
    fromYMD,
    toYMD,
    assetClass,
    preventiveTasks,
    preventiveExecutions,
    machines,
  });

  const preventiveOverdueSnapshotCount = overdueTasksList.length;
  const preventiveDueInWindowCount =
    pmCompliance.totalEligibleCount > 0
      ? pmCompliance.totalEligibleCount
      : Math.max(preventiveExecutedInPeriodCount + preventiveOverdueSnapshotCount, dueInWindowTasksCount);
  const preventiveDisciplineRate =
    preventiveDueInWindowCount > 0
      ? Math.min(100, Math.round((preventiveExecutedInPeriodCount / preventiveDueInWindowCount) * 100))
      : 100;

  // =========================================================================
  // 3. Magasin (Official mouvements in period vs Pending SortieDemands)
  // =========================================================================
  let sortiesCount = 0;
  let sortiesTotalQuantity = 0;
  let entreesCount = 0;
  let consumptionCost = 0;
  let entriesCost = 0;
  const consumedPartsMap = new Map<string, ConsumedPartSummary>();
  const officialMovementsInPeriod: OfficialMovementExportRow[] = [];

  (mouvements || []).forEach((m) => {
    if (!m || isUnapprovedFieldClaim(m)) return;
    const mDate = normalizeDateToYMD(m.date);
    if (!isWithinRange(mDate)) return;

    const meta = resolveRecordAssetClass(m, 'id_machine_registered');
    if (!matchesClassFilter(meta.assetClass)) return;

    const typeStr = String(m.type || '').trim().toLowerCase();
    const isSortie = typeStr.includes('sortie') || typeStr === 'out';
    const isEntree = typeStr.includes('entrée') || typeStr.includes('entree') || typeStr === 'in';

    const ref = String(m.ref || m.reference || m.id_article || 'PDR').trim();
    const fallbackPrice = stockPriceMap.get(ref.toUpperCase()) || 0;
    const qty = Math.abs(Number(m.quantite || 1));
    const price = Number(m.prix_unitaire ?? m.prix_achat_ht ?? m.prix ?? 0) || fallbackPrice;
    const cost = qty * (price > 0 ? price : 0);

    officialMovementsInPeriod.push({
      id: String(m.id || `MVT-${officialMovementsInPeriod.length + 1}`),
      date: mDate || fromYMD,
      codeBon: String(m.code_bon || m.num_bon || m.num_bon_saisi_par_tech || m.id || 'BON'),
      type: isSortie ? 'SORTIE' : isEntree ? 'ENTREE' : String(m.type || 'MVT').toUpperCase(),
      machineCode: meta.machineCode,
      ref,
      designation: String(m.designation || ref).trim(),
      quantity: qty,
      unit: String(m.unit || m.unite || 'pcs'),
      unitPrice: Number(price.toFixed(2)),
      totalCost: Number(cost.toFixed(2)),
    });

    if (isSortie) {
      sortiesCount++;
      sortiesTotalQuantity += qty;
      consumptionCost += cost;

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
      entreesCount++;
      entriesCost += cost;
    }
  });

  const topConsumedParts = Array.from(consumedPartsMap.values())
    .sort((a, b) => b.totalCost - a.totalCost || b.quantity - a.quantity)
    .slice(0, 5);

  let excludedUnapprovedSortieDemandsInPeriod = 0;
  (sortieDemands || []).forEach((dem) => {
    if (!dem || !isUnapprovedFieldClaim(dem)) return;
    const dDate = normalizeDateToYMD(dem.created_at || dem.date || dem.submitted_at);
    const meta = resolveRecordAssetClass(dem, 'id_machine_registered');
    if (isWithinRange(dDate) && matchesClassFilter(meta.assetClass)) {
      excludedUnapprovedSortieDemandsInPeriod++;
    }
  });

  // =========================================================================
  // 4. File d'attente Maker-Checker (Live Snapshot)
  // =========================================================================
  const queues = selectValidationCenterQueues({
    correctiveInterventions,
    preventiveExecutions,
    sortieDemands,
  });

  const technicianBreakdown = Array.from(techMap.values()).sort(
    (a, b) => b.preventiveCount + b.correctiveCount - (a.preventiveCount + a.correctiveCount)
  );

  const bySystemType = Array.from(sysGenTypeMap.values()).sort(
    (a, b) =>
      b.correctiveCount + b.preventiveCount - (a.correctiveCount + a.preventiveCount) ||
      b.assetsCount - a.assetsCount
  );

  let externalBobinageCount = 0;
  let externalBobinageCost = 0;
  (sortiesExterne || []).forEach((se) => {
    if (!se || isUnapprovedFieldClaim(se)) return;
    const seDate = normalizeDateToYMD(
      se.date_montage ||
        se.date_arrivee_reelle ||
        se.date_retour ||
        se.date_expedition ||
        se.date_sortie ||
        se.date_demontage ||
        se.date ||
        se.created_at
    );
    if (!isWithinRange(seDate)) return;
    const meta = resolveRecordAssetClass(se, 'id_machine');
    if (!matchesClassFilter(meta.assetClass)) return;
    const extCost =
      Number(se.cout_bobinage ?? se.cout_reparation ?? se.cout ?? se.montant ?? 0) || 0;
    externalBobinageCount++;
    externalBobinageCost += extCost;

    const costRow = ensureMachineCostRow(meta);
    costRow.externalBobinageCount++;
    costRow.externalBobinageCost = Number((costRow.externalBobinageCost + extCost).toFixed(2));
    costRow.totalOfficialCost = Number(
      (costRow.correctiveCost + costRow.preventiveCost + costRow.externalBobinageCost).toFixed(2)
    );
  });

  const machineCostBreakdown = Array.from(machineCostMap.values()).sort(
    (a, b) =>
      b.totalOfficialCost - a.totalOfficialCost ||
      b.correctiveCount + b.preventiveCount + b.externalBobinageCount -
        (a.correctiveCount + a.preventiveCount + a.externalBobinageCount) ||
      b.totalDowntimeHours - a.totalDowntimeHours
  );

  const totalOfficialMaintenanceCost = Number(
    (correctiveSparesCost + preventiveTotalCost + externalBobinageCost).toFixed(2)
  );

  return {
    fromYMD,
    toYMD,
    daysCount,
    assetClassFilter: assetClass,

    correctiveTotalInPeriodCount,
    correctiveClosedInPeriodCount,
    correctiveInProgressInPeriodCount,
    correctiveOpenSnapshotCount,
    totalDowntimeHours: Number(totalDowntimeHours.toFixed(1)),
    correctiveSparesCost: Number(correctiveSparesCost.toFixed(2)),
    topFailingMachines,

    productionMachinesCount,
    scheduledProductionHours,
    mttrHours,
    mttrFormatted,
    mtbfHours,
    availabilityRate,

    preventiveExecutedInPeriodCount,
    preventiveDueInWindowCount,
    preventiveDisciplineRate,
    preventiveOverdueSnapshotCount,
    overdueSnapshotDefinition:
      "Snapshot des tâches préventives actives ayant le statut « En retard » ou une date d'échéance antérieure à la fin de période et non clôturées.",
    overdueTasksSample: overdueTasksList.slice(0, 5),
    preventiveTotalCost: Number(preventiveTotalCost.toFixed(2)),
    preventiveLaborHours,
    pmCompliance,

    sortiesCount,
    sortiesTotalQuantity,
    entreesCount,
    consumptionCost: Number(consumptionCost.toFixed(2)),
    entriesCost: Number(entriesCost.toFixed(2)),
    topConsumedParts,
    pendingSortieDemandsWarningCount: queues.pendingSortieDemands.length,

    makerCheckerQueue: {
      pendingCorrectiveCount: queues.pendingCorrective.length,
      clarificationCorrectiveCount: queues.clarificationCorrective.length,
      pendingPreventiveCount: queues.pendingPreventive.length,
      clarificationPreventiveCount: queues.clarificationPreventive.length,
      pendingSortieDemandsCount: queues.pendingSortieDemands.length,
      clarificationSortieDemandsCount: queues.clarificationSortieDemands.length,
      totalPendingCount: queues.totalPending,
      totalClarificationCount: queues.totalClarification,
      reservedRefsCount: queues.reservedRefsCount,
      totalReservedUnits: queues.totalReservedUnits,
    },
    excludedUnapprovedInPeriod: {
      correctiveCount: excludedUnapprovedCorrectiveInPeriod,
      preventiveCount: excludedUnapprovedPreventiveInPeriod,
      sortieDemandsCount: excludedUnapprovedSortieDemandsInPeriod,
      totalExcludedCount:
        excludedUnapprovedCorrectiveInPeriod +
        excludedUnapprovedPreventiveInPeriod +
        excludedUnapprovedSortieDemandsInPeriod,
    },

    systemGeneralSummary: {
      totalAssetsCount: totalSystemGeneralAssetsCount,
      correctiveInPeriodCount: systemGeneralCorrectiveInPeriod,
      correctiveClosedInPeriodCount: systemGeneralCorrectiveClosedInPeriod,
      preventiveInPeriodCount: systemGeneralPreventiveInPeriod,
      bySystemType,
    },

    technicianBreakdown,
    externalBobinageCount,
    externalBobinageCost: Number(externalBobinageCost.toFixed(2)),
    totalOfficialMaintenanceCost,
    machineCostBreakdown,
    officialMovementsInPeriod,
  };
}

/**
 * C2 — Builds the structured CSV rows for the Shift / Weekly / 12m Operational Report,
 * extending the KPI summary with:
 * - C1 Official Maintenance Cost Summary rows (per machine: BT + PM + External Bobinage + Total)
 * - C2 Official Validated Stock Movements rows in the selected period
 * Never includes unapproved (PENDING_VALIDATION / REJECTED) claims or secrets.
 */
export function buildShiftWeeklyReportExportRows(report: ShiftOrWeeklyReportData): string[][] {
  const rows: string[][] = [
    ['Indicateur', 'Valeur', 'Unite / Detail', 'Perimetre'],
    ['Periode Debut', report.fromYMD, `${report.daysCount} jour(s)`, report.assetClassFilter],
    ['Periode Fin', report.toYMD, '', report.assetClassFilter],
    ['Correctif Clotures (Approuves)', String(report.correctiveClosedInPeriodCount), 'BT', report.assetClassFilter],
    ['Correctif Total Periode (Approuves)', String(report.correctiveTotalInPeriodCount), 'BT', report.assetClassFilter],
    ['Correctif Ouverts (Snapshot)', String(report.correctiveOpenSnapshotCount), 'BT en cours', report.assetClassFilter],
    ['Temps Arret Correctif', String(report.totalDowntimeHours), 'heures', report.assetClassFilter],
    ['Cout PDR Correctif (Approuve)', String(report.correctiveSparesCost), 'EUR', report.assetClassFilter],
    ['Preventif Executes (Approuves)', String(report.preventiveExecutedInPeriodCount), 'executions', report.assetClassFilter],
    ['Cout Preventif (Approuve)', String(report.preventiveTotalCost), 'EUR', report.assetClassFilter],
    ['Bobinage / Sous-traitance Externe (Approuve)', String(report.externalBobinageCount || 0), 'dossiers', report.assetClassFilter],
    ['Cout Bobinage Externe (Approuve)', String(report.externalBobinageCost || 0), 'EUR', report.assetClassFilter],
    ['Cout Total Maintenance Officiel (C1: BT + PM + Externe)', String(report.totalOfficialMaintenanceCost), 'EUR', report.assetClassFilter],
    ['Preventif A Temps (ON_TIME)', String(report.pmCompliance.onTimeCount), 'taches', report.assetClassFilter],
    ['Preventif Fait En Retard (LATE)', String(report.pmCompliance.lateCompletedCount), 'taches', report.assetClassFilter],
    ['Preventif Non Realise / En Retard (OVERDUE)', String(report.pmCompliance.overdueCount), 'taches', report.assetClassFilter],
    ['Preventif Denominateur Actif (Hors Archivees)', String(report.pmCompliance.totalEligibleCount), 'taches', report.assetClassFilter],
    ['Taux Conformite A Temps (ON_TIME %)', String(report.pmCompliance.onTimeComplianceRate), '%', report.assetClassFilter],
    ['Discipline Preventive Globale', String(report.preventiveDisciplineRate), '%', report.assetClassFilter],
    ['Preventif En Retard (Snapshot)', String(report.preventiveOverdueSnapshotCount), 'taches', report.assetClassFilter],
    ['Magasin Sorties Validees', String(report.sortiesCount), `${report.sortiesTotalQuantity} pcs`, report.assetClassFilter],
    ['Magasin Cout Consommation', String(report.consumptionCost), 'EUR', report.assetClassFilter],
    ['Magasin Demandes Sortie En Attente (Non deduites)', String(report.pendingSortieDemandsWarningCount), 'demandes', 'GLOBAL'],
    ['Maker-Checker En Attente Total', String(report.makerCheckerQueue.totalPendingCount), 'elements', 'GLOBAL'],
    ['Systeme General Interventions Periode (Approuvees)', String(report.systemGeneralSummary.correctiveInPeriodCount), 'BT', 'SYSTEM_GENERAL'],
    ['Systeme General Preventif Periode (Approuvees)', String(report.systemGeneralSummary.preventiveInPeriodCount), 'executions', 'SYSTEM_GENERAL'],
  ];

  // Section C1: Official Machine Cost Breakdown (BT + PM + External Bobinage)
  rows.push([]);
  rows.push([
    'SECTION_COUTS_MACHINES',
    'Code Machine',
    'Equipement',
    'Classe',
    'Cout BT Approuve (EUR)',
    'Cout PM Approuve (EUR)',
    'Cout Externe Bobinage (EUR)',
    'Cout Total Officiel (EUR)',
    'Arret (h)',
  ]);
  for (const m of report.machineCostBreakdown || []) {
    rows.push([
      'COUT_MACHINE_OFFICIEL',
      m.machineCode,
      m.machineName,
      m.assetClass,
      String(m.correctiveCost),
      String(m.preventiveCost),
      String(m.externalBobinageCost),
      String(m.totalOfficialCost),
      String(m.totalDowntimeHours),
    ]);
  }

  // Section C2: Official Validated Movements in Period
  rows.push([]);
  rows.push([
    'SECTION_MOUVEMENTS_VALIDES',
    'Date',
    'Bon / Ref',
    'Type',
    'Machine',
    'Reference PDR',
    'Designation',
    'Quantite',
    'Cout Total (EUR)',
  ]);
  for (const mvt of report.officialMovementsInPeriod || []) {
    rows.push([
      'MOUVEMENT_VALIDE',
      mvt.date,
      mvt.codeBon,
      mvt.type,
      mvt.machineCode,
      mvt.ref,
      mvt.designation,
      `${mvt.quantity} ${mvt.unit}`,
      String(mvt.totalCost),
    ]);
  }

  return rows;
}

export function buildShiftWeeklyReportCsv(report: ShiftOrWeeklyReportData): string {
  const rows = buildShiftWeeklyReportExportRows(report);
  return (
    '\uFEFF' +
    rows
      .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n')
  );
}

/**
 * C2 — Builds a secret-free, non-technical JSON export payload of official costs & validated movements
 * for the selected report period (`fromYMD` -> `toYMD` or 12 months).
 */
export function buildShiftWeeklyReportJson(report: ShiftOrWeeklyReportData): string {
  const summary = {
    correctiveSparesCost: report.correctiveSparesCost,
    preventiveTotalCost: report.preventiveTotalCost,
    externalBobinageCost: report.externalBobinageCost || 0,
    totalOfficialMaintenanceCost: report.totalOfficialMaintenanceCost,
    storeConsumptionCost: report.consumptionCost,
    excludedUnapprovedClaimsInPeriod: report.excludedUnapprovedInPeriod,
  };
  return JSON.stringify(
    {
      schemaVersion: 'CIOB-REPORT-EXPORT-V1',
      exportedAt: new Date().toISOString(),
      period: {
        from: report.fromYMD,
        to: report.toYMD,
        daysCount: report.daysCount,
        assetClassFilter: report.assetClassFilter,
      },
      summary,
      officialCostsSummary: summary,
      machineCostBreakdown: (report.machineCostBreakdown || []).map((m) => ({
        machineCode: m.machineCode,
        machineName: m.machineName,
        assetClass: m.assetClass,
        failureCount: m.failureCount,
        correctiveCount: m.correctiveCount,
        correctiveCost: m.correctiveCost,
        correctivePdrCost: m.correctivePdrCost,
        preventiveCount: m.preventiveCount,
        preventiveCost: m.preventiveCost,
        externalBobinageCount: m.externalBobinageCount,
        externalBobinageCost: m.externalBobinageCost,
        totalOfficialCost: m.totalOfficialCost,
        totalDowntimeHours: m.totalDowntimeHours,
      })),
      officialMovementsInPeriod: (report.officialMovementsInPeriod || []).map((mvt) => ({
        id: mvt.id,
        date: mvt.date,
        codeBon: mvt.codeBon,
        type: mvt.type,
        machineCode: mvt.machineCode,
        ref: mvt.ref,
        designation: mvt.designation,
        quantity: mvt.quantity,
        unit: mvt.unit,
        unitPrice: mvt.unitPrice,
        totalCost: mvt.totalCost,
      })),
    },
    null,
    2
  );
}

export default MonthlyReportCalculationService;



