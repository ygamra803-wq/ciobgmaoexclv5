import { normalizeDateToYMD } from '../../utils/datePeriodUtils';
import { AvailabilityCalculationService } from '../../domain/services/AvailabilityCalculationService';
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
    machines = [],
  }: {
    month: string;
    stockItems?: any[];
    mouvements?: any[];
    correctiveInterventions?: any[];
    preventiveTasks?: any[];
    preventiveExecutions?: PreventiveExecutionRecord[];
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

    const activeMachinesCount = Math.max(1, (machines || []).length || machineFailuresMap.size || 1);
    const scheduledPlantHours = activeMachinesCount * 160;
    const mttrHours = AvailabilityCalculationService.calculateMTTR(monthCorrectiveList);
    const mttrFormatted = AvailabilityCalculationService.formatMTTR(monthCorrectiveList);
    const mtbfHours = AvailabilityCalculationService.calculateMTBF(monthCorrectiveList, scheduledPlantHours);
    const availabilityRate = AvailabilityCalculationService.calculateAvailability(monthCorrectiveList, scheduledPlantHours);

    // =========================================================================
    // 4. Preventive Maintenance Discipline & Technician Distribution
    // =========================================================================
    const monthExecutions = (preventiveExecutions || []).filter((e) => {
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

    const totalActiveTasks = (preventiveTasks || []).length;
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

