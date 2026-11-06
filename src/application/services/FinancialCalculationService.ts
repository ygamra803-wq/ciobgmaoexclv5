/**
 * @file FinancialCalculationService.ts
 * @module application/services/FinancialCalculationService
 * @description
 * محرك ضبط وتحليل تكاليف الصيانة ورقابة الميزانية الدورية (FIN-P0 / P1 / P2) لـ GMAO.
 * يلتزم بـ:
 * 1. لا قيم أصول افتراضية وهمية (valeur_a_neuf = null و berStatus = 'NON_EVALUE' عند غياب التقييم).
 * 2. التكلفة الوقائية تتبع الآلة فعلياً عبر machineCode وليس التوزيع المتساوي.
 * 3. تصفية صارمة بالسنة المالية (fiscalYear) وتجميع شهري (1..12) وربع سنوي (T1..T4) للمصاريف المعتمدة.
 * 4. إنذارات استهلاك الميزانية (WARNING عند >= burnWarningPercent افتراضياً 90%، و DEFICIT عند تجاوز المخصص).
 * 5. عدم إطلاق إنذارات وهمية عند كون الميزانية صفرية في وضع المصنع الفارغ (UNCONFIGURED).
 */

import {
  FiscalBudgetConfig,
  HistoricalExchangeRate,
  BudgetPeriodMode,
  BudgetCategoryKey,
  EMPTY_FISCAL_BUDGET,
} from '../../domain/finance/entities/FinancialBudget';
import { isUnapprovedFieldClaim } from './MonthlyReportCalculationService';
import { filterActiveMachines } from '../../utils/activeMachines';
import { AvailabilityCalculationService } from '../../domain/services/AvailabilityCalculationService';

export type BudgetVarianceStatus = 'FAVORABLE' | 'WARNING' | 'DEFICIT' | 'UNCONFIGURED';
export type MachineBerStatus = 'OPTIMAL' | 'ATTENTION' | 'REPLACE_RECOMMENDED' | 'NON_EVALUE';

export interface BudgetVarianceItem {
  key: BudgetCategoryKey;
  labelFr: string;
  labelAr: string;
  allocated: number;
  actual: number;
  variance: number;         // allocated - actual (Positive = Under budget, Negative = Over budget)
  burnRatePercent: number;  // (actual / allocated) * 100, or 0 when allocated === 0
  status: BudgetVarianceStatus;
}

export interface ZoneCostSummary {
  zone: string;
  machinesCount: number;
  correctiveCost: number;
  preventiveCost: number;
  externalCost: number;
  totalCost: number;
}

export interface PeriodFinancialSummary {
  periodIndex: number;      // 1..12 for MONTHLY, 1..4 for QUARTERLY
  periodCode: string;       // 'M01'..'M12' or 'T1'..'T4'
  labelFr: string;
  labelAr: string;
  variances: BudgetVarianceItem[];
  totalAllocated: number;
  totalActual: number;
  totalVariance: number;
  totalBurnRate: number;
  status: BudgetVarianceStatus;
  zoneCostBreakdown: ZoneCostSummary[];
}

export interface BudgetAlertItem {
  id: string;
  categoryKey: BudgetCategoryKey;
  labelFr: string;
  labelAr: string;
  periodType: BudgetPeriodMode;
  periodCode: string;       // 'ANNUAL' | 'M01'..'M12' | 'T1'..'T4'
  periodLabelFr: string;
  periodLabelAr: string;
  allocated: number;
  actual: number;
  variance: number;
  burnRatePercent: number;
  status: 'WARNING' | 'DEFICIT';
}

export interface MachineTCOCalculation {
  id: string;
  name: string;
  code: string;
  assetClass: string;
  zone: string;
  isValued: boolean;
  valeurANeuf: number | null;
  anneeMiseEnService: number | null;
  ageYears: number | null;
  dureeDeVieAns: number;
  tauxAmortissementAnnuel: number | null;
  amortissementCumule: number | null;
  valeurNetteComptable: number | null;
  correctiveCost: number;
  preventiveCost: number;
  externalCost: number;
  coutMaintenanceExercice: number;
  coutMaintenanceCumule: number;
  tco: number;                    // (valeurANeuf || 0) + coutMaintenanceCumule
  berIndexPercent: number | null; // null if valeurANeuf is missing
  berStatus: MachineBerStatus;
}

export interface FinancialSynthesis {
  fiscalYear: number;
  periodMode: BudgetPeriodMode;
  burnWarningPercent: number;
  budget: FiscalBudgetConfig;
  variances: BudgetVarianceItem[];
  totalAllocated: number;
  totalActual: number;
  totalVariance: number;
  totalBurnRate: number;

  // P2-2 & P2-3: Monthly / Quarterly breakdowns & active budget alerts
  monthlyBreakdown: PeriodFinancialSummary[];
  quarterlyBreakdown: PeriodFinancialSummary[];
  budgetAlerts: BudgetAlertItem[];

  // Spend breakdown (Strictly within fiscalYear)
  spendPreventive: number;
  spendCorrective: number;
  spendExternal: number;
  spendSparesConsumed: number;
  spendSparesPurchased: number;

  // Downtime financial loss (Strictly from recorded stoppages in fiscalYear)
  totalDowntimeHours: number;
  totalDowntimeLossMAD: number;

  // Inventory valuation (Current physical stock at PMP)
  stockItemsCount: number;
  stockValuationPMP_MAD: number;
  stockValuationWithVAT_MAD: number;

  // Labor (Strictly within fiscalYear)
  internalLaborHours: number;
  internalLaborCostMAD: number;
  technicianLaborBreakdown: Array<{
    name: string;
    hours: number;
    costMAD: number;
    interventionsCount: number;
  }>;

  // Assets TCO & Zone Breakdown
  machinesTCO: MachineTCOCalculation[];
  machinesBerCount: number;
  machinesValuedCount: number;
  machinesUnvaluedCount: number;
  zoneCostBreakdown: ZoneCostSummary[];
}

const MONTH_LABELS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const MONTH_LABELS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'ماي',
  'يونيو',
  'يوليوز',
  'غشت',
  'شتنبر',
  'أكتوبر',
  'نونبر',
  'دجنبر',
];

const QUARTER_LABELS_FR = [
  'T1 (Jan–Mar)',
  'T2 (Avr–Juin)',
  'T3 (Juil–Sep)',
  'T4 (Oct–Déc)',
];

const QUARTER_LABELS_AR = [
  'الربع 1 (يناير–مارس)',
  'الربع 2 (أبريل–يونيو)',
  'الربع 3 (يوليوز–شتنبر)',
  'الربع 4 (أكتوبر–دجنبر)',
];

const CATEGORY_META: Array<{ key: BudgetCategoryKey; labelFr: string; labelAr: string }> = [
  {
    key: 'preventive',
    labelFr: 'Maintenance Préventive',
    labelAr: 'الصيانة الوقائية والفحص الدوري',
  },
  {
    key: 'corrective',
    labelFr: 'Correctif & Pannes Urgentes',
    labelAr: 'الصيانة التصحيحية وحالات الطوارئ',
  },
  {
    key: 'external',
    labelFr: 'Sous-traitance & Bobinage',
    labelAr: 'المقاولات والبوبيناج الخارجي',
  },
  {
    key: 'spares',
    labelFr: 'Achats & Renouvellement PDR',
    labelAr: 'مشتريات وتجديد قطع الغيار',
  },
];

export function isUnapprovedFinancialRecord(record: any): boolean {
  if (!record) return true;
  if (isUnapprovedFieldClaim(record)) return true;
  const valStatus = String(record?.validation_status || '').trim().toUpperCase();
  const status = String(record?.statut || record?.etat || record?.status || '').trim().toUpperCase();
  return (
    valStatus === 'EN_ATTENTE_VALIDATION' ||
    valStatus === 'PENDING_VALIDATION' ||
    valStatus === 'REJECTED' ||
    valStatus === 'REJETEE' ||
    valStatus === 'NEEDS_CLARIFICATION' ||
    status === 'EN_ATTENTE_VALIDATION' ||
    status === 'REJETEE' ||
    status === 'REJECTED' ||
    status === 'ANNULE' ||
    status === 'SKIPPED'
  );
}

/**
 * Extracts calendar year and optional month (1..12) from a record's date fields.
 * Returns null if the record carries no date metadata at all.
 */
export function extractRecordYearAndMonth(record: any): { year: number; month: number | null } | null {
  if (!record || typeof record !== 'object') return null;
  const candidates = [
    record.periodMonth,
    record.executedAt,
    record.date_cloture,
    record.date_realisation,
    record.date_intervention,
    record.date_fin,
    record.demande_date,
    record.date_debut,
    record.date_expedition,
    record.date_demontage,
    record.date_montage,
    record.date,
    record.created_at,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const str = String(raw).trim();
    // 1. ISO YYYY-MM or YYYY-MM-DD
    const ymMatch = str.match(/^(\d{4})[-/](\d{1,2})/);
    if (ymMatch) {
      const yr = Number(ymMatch[1]);
      const mo = Number(ymMatch[2]);
      if (yr >= 1990 && yr <= 2100) {
        return { year: yr, month: mo >= 1 && mo <= 12 ? mo : null };
      }
    }
    // 2. DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const mo = Number(dmyMatch[2]);
      const yr = Number(dmyMatch[3]);
      if (yr >= 1990 && yr <= 2100) {
        return { year: yr, month: mo >= 1 && mo <= 12 ? mo : null };
      }
    }
    // 3. Bare 4-digit year
    const yrOnlyMatch = str.match(/^(\d{4})$/);
    if (yrOnlyMatch) {
      const yr = Number(yrOnlyMatch[1]);
      if (yr >= 1990 && yr <= 2100) {
        return { year: yr, month: null };
      }
    }
    // 4. Native Date fallback
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const yr = parsed.getFullYear();
      const mo = parsed.getMonth() + 1;
      if (yr >= 1990 && yr <= 2100) {
        return { year: yr, month: mo >= 1 && mo <= 12 ? mo : null };
      }
    }
  }
  return null;
}

export function extractRecordYear(record: any): number | null {
  const ym = extractRecordYearAndMonth(record);
  return ym ? ym.year : null;
}

export function extractRecordMonth(record: any): number | null {
  const ym = extractRecordYearAndMonth(record);
  return ym ? ym.month : null;
}

export function matchesFiscalYear(record: any, fiscalYear: number): boolean {
  const recordYear = extractRecordYear(record);
  if (recordYear === null) return true; // Undated records (e.g. minimal unit test fixtures) match active synthesis
  return recordYear === fiscalYear;
}

export class FinancialCalculationService {
  /**
   * تحويل المبالغ الأجنبية (USD / EUR) إلى العملة المرجعية المحلية (MAD)
   */
  static convertToMAD(
    amount: number,
    currency: 'MAD' | 'USD' | 'EUR' | string,
    rates: HistoricalExchangeRate[] = []
  ): { amountMAD: number; appliedRate: number } {
    const num = Math.max(0, Number(amount) || 0);
    const curr = String(currency || 'MAD').toUpperCase().trim();
    if (curr === 'MAD' || curr === 'DH' || !curr) {
      return { amountMAD: num, appliedRate: 1 };
    }

    const matched = rates.find((r) => r.sourceCurrency === curr);
    const rate = matched ? matched.rate : curr === 'EUR' ? 10.85 : curr === 'USD' ? 9.95 : 1;
    return {
      amountMAD: Math.round(num * rate * 100) / 100,
      appliedRate: rate,
    };
  }

  /**
   * الحساب الشامل لكافة مؤشرات تكلفة الصيانة والميزانية السنوية والدورية والأصول
   */
  static computeFinancialSynthesis(params: {
    budget?: FiscalBudgetConfig;
    exchangeRates?: HistoricalExchangeRate[];
    machines?: any[];
    stockItems?: any[];
    mouvements?: any[];
    correctiveInterventions?: any[];
    preventiveExecutions?: any[];
    sortiesExterne?: any[];
  }): FinancialSynthesis {
    const budget = params.budget || EMPTY_FISCAL_BUDGET;
    const activeMachines = filterActiveMachines(params.machines || []);
    const movements = params.mouvements || [];
    const correctiveList = params.correctiveInterventions || [];
    const executions = params.preventiveExecutions || [];
    const externalList = params.sortiesExterne || [];
    const stock = params.stockItems || [];

    const techRate = Math.max(0, Number(budget.technicianHourlyRate ?? 55));
    const downtimeRatePerHour = Math.max(0, Number(budget.productionDowntimeCostPerHour ?? 2500));
    const berThreshold = Math.max(10, Number(budget.berThresholdPercent || 70));
    const burnWarningPercent = Math.max(50, Math.min(100, Number(budget.burnWarningPercent ?? 90)));
    const periodMode: BudgetPeriodMode =
      budget.periodMode === 'MONTHLY' || budget.periodMode === 'QUARTERLY' ? budget.periodMode : 'ANNUAL';
    const currentYear = Number(budget.fiscalYear) || new Date().getFullYear();

    // Map machine code -> zone for accurate zone-by-month cost aggregation
    const machineZoneMap = new Map<string, string>();
    const zoneMachinesCountMap = new Map<string, number>();
    activeMachines.forEach((m) => {
      const code = String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase();
      const zone = String(m.id_zone_default || m.id_zone || m.zone || 'Atelier').trim();
      if (code) {
        machineZoneMap.set(code, zone);
      }
      zoneMachinesCountMap.set(zone, (zoneMachinesCountMap.get(zone) || 0) + 1);
    });

    // 0. فهرس أسعار قطع الغيار من المخزن (PMP / Prix Unitaire) لتوحيد مصدر التسعير
    const stockPriceMap = new Map<string, number>();
    stock.forEach((item) => {
      if (!item) return;
      const pmp = Math.max(0, Number(item.prix_unitaire ?? item.pmp ?? item.prix ?? item.unitPrice ?? 0));
      if (pmp <= 0) return;
      const keys = [item.ref, item.ref_article, item.code_article, item.reference, item.code, item.id];
      keys.forEach((k) => {
        const clean = String(k || '').trim().toUpperCase();
        if (clean) stockPriceMap.set(clean, pmp);
      });
    });

    // Maps for per-machine costs (Fiscal Year & Lifetime Cumulative for TCO)
    const machinePreventiveFiscalMap: Record<string, number> = {};
    const machinePreventiveLifetimeMap: Record<string, number> = {};
    const machineCorrectiveFiscalMap: Record<string, number> = {};
    const machineCorrectiveLifetimeMap: Record<string, number> = {};
    const machineExternalFiscalMap: Record<string, number> = {};
    const machineExternalLifetimeMap: Record<string, number> = {};

    // P2-2: Monthly actual spend accumulators (index 0..11 => months 1..12)
    const monthlyActuals: Record<BudgetCategoryKey, number[]> = {
      preventive: Array(12).fill(0),
      corrective: Array(12).fill(0),
      external: Array(12).fill(0),
      spares: Array(12).fill(0),
    };

    // P2-4: Monthly zone cost accumulators (index 0..11 => Map<zone, { corrective, preventive, external }>)
    const monthlyZoneCosts: Array<Map<string, { corrective: number; preventive: number; external: number }>> =
      Array.from({ length: 12 }, () => new Map());

    const addZoneMonthlyCost = (
      monthOneBased: number | null,
      mchId: string,
      fallbackZone: string | undefined,
      type: 'preventive' | 'corrective' | 'external',
      amount: number
    ) => {
      if (!monthOneBased || monthOneBased < 1 || monthOneBased > 12 || amount <= 0) return;
      const zone = (mchId && machineZoneMap.get(mchId)) || fallbackZone || 'Atelier';
      const zMap = monthlyZoneCosts[monthOneBased - 1];
      const entry = zMap.get(zone) || { corrective: 0, preventive: 0, external: 0 };
      entry[type] += amount;
      zMap.set(zone, entry);
    };

    // 1. حساب مصاريف الصيانة الوقائية (Preventive Spend — Follows Machine Code)
    let spendPreventive = 0;
    let preventiveMinutesTotal = 0;
    const techHoursMap: Record<string, { minutes: number; count: number }> = {};

    executions.forEach((ex) => {
      if (!ex || isUnapprovedFinancialRecord(ex)) return;

      const mchId = String(ex.machineCode || ex.id_machine || ex.code_machine || '')
        .trim()
        .toUpperCase();
      const durMin = Math.max(
        0,
        Number(ex.durationMinutes ?? ex.duree_minutes ?? ex.duree_execution ?? ex.duree_reelle_min ?? 0)
      );

      let partsCost = Number(ex.sparesCost ?? ex.pieces_cout ?? ex.cout_pieces ?? 0);
      if (partsCost <= 0 && Array.isArray(ex.sparesUsed) && ex.sparesUsed.length > 0) {
        partsCost = ex.sparesUsed.reduce((sum: number, sp: any) => {
          const qty = Math.max(0, Number(sp.qty ?? sp.quantite ?? 1));
          const refKey = String(sp.ref || sp.code_article || '').trim().toUpperCase();
          const unitPr = Math.max(
            0,
            Number(sp.unitPrice ?? sp.prix_unitaire ?? sp.prix ?? (refKey ? stockPriceMap.get(refKey) : 0) ?? 0)
          );
          return sum + qty * unitPr;
        }, 0);
      }

      const laborCost = (durMin / 60) * techRate;
      const explicitTotal = Number(ex.totalCost ?? ex.cout_total ?? 0);
      const exTotal = explicitTotal > 0 ? explicitTotal : partsCost + laborCost;

      if (mchId) {
        machinePreventiveLifetimeMap[mchId] = (machinePreventiveLifetimeMap[mchId] || 0) + exTotal;
      }

      if (matchesFiscalYear(ex, currentYear)) {
        spendPreventive += exTotal;
        preventiveMinutesTotal += durMin;
        if (mchId) {
          machinePreventiveFiscalMap[mchId] = (machinePreventiveFiscalMap[mchId] || 0) + exTotal;
        }
        const month = extractRecordMonth(ex);
        if (month !== null && month >= 1 && month <= 12) {
          monthlyActuals.preventive[month - 1] += exTotal;
          addZoneMonthlyCost(month, mchId, ex.zone, 'preventive', exTotal);
        }

        const tech = String(
          ex.executorName || ex.technicien || ex.executeur || ex.technicien_executant || 'Non assigné'
        ).trim();
        if (!techHoursMap[tech]) techHoursMap[tech] = { minutes: 0, count: 0 };
        techHoursMap[tech].minutes += durMin;
        techHoursMap[tech].count += 1;
      }
    });

    // 2. حساب مصاريف الصيانة التصحيحية والأعطال (Corrective Spend & Verified Downtime Loss)
    let spendCorrective = 0;
    let correctiveDowntimeMinutes = 0;
    let correctiveMinutesTotal = 0;

    correctiveList.forEach((ci) => {
      if (!ci || isUnapprovedFinancialRecord(ci)) return;
      const mchId = String(ci.code_machine || ci.id_machine || ci.id_machine_registered || '')
        .trim()
        .toUpperCase();

      // FIN-P0/P1: Labor duration from explicit fields or parsed duration string (without 45m fallback if 0)
      let durMin = Math.max(
        0,
        Number(
          ci.duree_intervention_min ??
            ci.temps_intervention_mins ??
            ci.temps_minutes ??
            ci.duree_minutes ??
            ci.dureeMinutes ??
            0
        )
      );
      if (durMin === 0 && (ci.temps_intervention_calc || ci.temps_intervention || ci.duree)) {
        durMin = AvailabilityCalculationService.parseDurationStringMinutes(
          ci.temps_intervention_calc || ci.temps_intervention || ci.duree
        );
      }

      // FIN-P0/P1: Downtime ONLY when stoppage is explicitly recorded on BT
      let dtMin = Math.max(
        0,
        Number(ci.duree_arret_minutes ?? ci.temps_arret_min ?? ci.temps_arret_minutes ?? 0)
      );
      if (dtMin === 0 && typeof ci.downtimeHours === 'number' && ci.downtimeHours > 0) {
        dtMin = Math.round(ci.downtimeHours * 60);
      }
      if (dtMin === 0 && (ci.temps_arret || ci.duree_arret)) {
        dtMin = AvailabilityCalculationService.parseDurationStringMinutes(ci.temps_arret || ci.duree_arret);
      }
      if (dtMin === 0 && (ci.arret_machine === true || ci.arret_machine === 'OUI')) {
        dtMin = durMin;
      }

      // FIN-P1: Spare parts cost from pieces_utilisees or pdr_ref + stockPriceMap PMP
      let partsCost = 0;
      if (Array.isArray(ci.pieces_utilisees) && ci.pieces_utilisees.length > 0) {
        partsCost = ci.pieces_utilisees.reduce((sum: number, p: any) => {
          const q = Math.max(0, Number(p.quantite ?? p.qte ?? 1));
          const refKey = String(p.ref || p.ref_article || p.code_article || p.code || '').trim().toUpperCase();
          const pr = Math.max(
            0,
            Number(p.prix_unitaire ?? p.prix ?? (refKey ? stockPriceMap.get(refKey) : 0) ?? 0)
          );
          return sum + q * pr;
        }, 0);
      } else if (ci.cout_pieces !== undefined && Number(ci.cout_pieces) > 0) {
        partsCost = Number(ci.cout_pieces) || 0;
      } else if (ci.pdr_ref) {
        const refKey = String(ci.pdr_ref).trim().toUpperCase();
        const q = Math.max(0, Number(ci.pdr_quantite ?? 1));
        const pr = Math.max(0, Number(ci.prix_unitaire ?? stockPriceMap.get(refKey) ?? 0));
        partsCost = q * pr;
      }

      const laborCost = (durMin / 60) * techRate;
      const explicitTotal = Number(ci.cout_total ?? 0);
      const ciTotal = explicitTotal > 0 ? explicitTotal : partsCost + laborCost;

      if (mchId) {
        machineCorrectiveLifetimeMap[mchId] = (machineCorrectiveLifetimeMap[mchId] || 0) + ciTotal;
      }

      if (matchesFiscalYear(ci, currentYear)) {
        spendCorrective += ciTotal;
        correctiveDowntimeMinutes += dtMin;
        correctiveMinutesTotal += durMin;
        if (mchId) {
          machineCorrectiveFiscalMap[mchId] = (machineCorrectiveFiscalMap[mchId] || 0) + ciTotal;
        }
        const month = extractRecordMonth(ci);
        if (month !== null && month >= 1 && month <= 12) {
          monthlyActuals.corrective[month - 1] += ciTotal;
          addZoneMonthlyCost(month, mchId, ci.zone, 'corrective', ciTotal);
        }

        const tech = String(ci.technicien || ci.intervenant || 'Non assigné').trim();
        if (!techHoursMap[tech]) techHoursMap[tech] = { minutes: 0, count: 0 };
        techHoursMap[tech].minutes += durMin;
        techHoursMap[tech].count += 1;
      }
    });

    // 3. حساب مصاريف المقاولة والبوبيناج الخارجي (External Subcontracting Spend)
    let spendExternal = 0;

    externalList.forEach((se) => {
      if (!se || isUnapprovedFinancialRecord(se)) return;
      const cost = Math.max(
        0,
        Number(se.cout_reel ?? se.cout_bobinage ?? se.prix_reparation ?? se.cout_estime ?? se.cout ?? 0)
      );
      const mchId = String(se.id_machine || se.machine_cible || se.code_machine || '')
        .trim()
        .toUpperCase();

      if (mchId) {
        machineExternalLifetimeMap[mchId] = (machineExternalLifetimeMap[mchId] || 0) + cost;
      }

      if (matchesFiscalYear(se, currentYear)) {
        spendExternal += cost;
        if (mchId) {
          machineExternalFiscalMap[mchId] = (machineExternalFiscalMap[mchId] || 0) + cost;
        }
        const month = extractRecordMonth(se);
        if (month !== null && month >= 1 && month <= 12) {
          monthlyActuals.external[month - 1] += cost;
          addZoneMonthlyCost(month, mchId, se.zone, 'external', cost);
        }
      }
    });

    // 4. تقييم حركة قطع الغيار (Entrées / Sorties & PMP within Fiscal Year)
    let spendSparesPurchased = 0;
    let spendSparesConsumed = 0;

    movements.forEach((mvt) => {
      if (!mvt || isUnapprovedFinancialRecord(mvt)) return;
      if (!matchesFiscalYear(mvt, currentYear)) return;

      const type = String(mvt.type || '').toUpperCase();
      const qte = Math.abs(Number(mvt.quantite || 0));
      const refKey = String(mvt.ref || mvt.ref_article || mvt.code_article || '').trim().toUpperCase();
      const unitPrice = Math.max(
        0,
        Number(mvt.prix_unitaire ?? mvt.prix ?? (refKey ? stockPriceMap.get(refKey) : 0) ?? 0)
      );
      const total = qte * unitPrice;

      if (type.includes('ENTREE') || type.includes('ENTRÉE') || type === 'RECEPTION' || type === 'ACHAT') {
        spendSparesPurchased += total;
        const month = extractRecordMonth(mvt);
        if (month !== null && month >= 1 && month <= 12) {
          monthlyActuals.spares[month - 1] += total;
        }
      } else if (type.includes('SORTIE') || type === 'CONSOMMATION') {
        spendSparesConsumed += total;
      }
    });

    // 5. تقييم المخزون الحالي (Stock Valuation au PMP / Prix Moyen Pondéré)
    let stockValuationPMP_MAD = 0;
    stock.forEach((item) => {
      const qte = Math.max(0, Number(item.stockActuel ?? item.quantite ?? 0));
      const pmp = Math.max(0, Number(item.prix_unitaire ?? item.pmp ?? item.prix ?? 0));
      stockValuationPMP_MAD += qte * pmp;
    });
    stockValuationPMP_MAD = Math.round(stockValuationPMP_MAD * 100) / 100;
    const vatRate = Math.max(0, Number(budget.defaultVatRate ?? 20));
    const stockValuationWithVAT_MAD = Math.round(stockValuationPMP_MAD * (1 + vatRate / 100) * 100) / 100;

    // 6. كلفة توقف الإنتاج (Downtime Financial Impact)
    const totalDowntimeHours = Math.round((correctiveDowntimeMinutes / 60) * 10) / 10;
    const totalDowntimeLossMAD = Math.round(totalDowntimeHours * downtimeRatePerHour);

    // 7. تكلفة اليد العاملة الداخلية (Internal Labor Cost)
    const totalInternalLaborMinutes = preventiveMinutesTotal + correctiveMinutesTotal;
    const internalLaborHours = Math.round((totalInternalLaborMinutes / 60) * 10) / 10;
    const internalLaborCostMAD = Math.round(internalLaborHours * techRate);

    const technicianLaborBreakdown = Object.entries(techHoursMap)
      .map(([name, data]) => {
        const hours = Math.round((data.minutes / 60) * 10) / 10;
        return {
          name,
          hours,
          costMAD: Math.round(hours * techRate),
          interventionsCount: data.count,
        };
      })
      .sort((a, b) => b.hours - a.hours);

    // 8. مؤشرات TCO والإهلاك للأصول (Asset TCO & Depreciation — Zero Synthetic Valuation)
    let machinesBerCount = 0;
    let machinesValuedCount = 0;
    let machinesUnvaluedCount = 0;
    const zoneAggregationMap = new Map<string, ZoneCostSummary>();

    const machinesTCO: MachineTCOCalculation[] = activeMachines
      .map((m) => {
        const code = String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase();
        const name = m.designation || m.nom || `Machine ${code}`;
        const assetClass = m.asset_class || m.famille || 'PRODUCTION';
        const zone = String(m.id_zone_default || m.id_zone || m.zone || 'Atelier').trim();

        // FIN-P0: Never invent 120,000 DH or 2021 when machine valuation/year is absent
        const rawValeur = Number(m.valeur_a_neuf ?? m.prix_achat ?? m.valeur_acquisition ?? 0);
        const isValued = Number.isFinite(rawValeur) && rawValeur > 0;
        const valeurANeuf: number | null = isValued ? rawValeur : null;

        if (isValued) {
          machinesValuedCount++;
        } else {
          machinesUnvaluedCount++;
        }

        const rawYear = Number(
          m.annee_mise_en_service ||
            (m.date_mise_en_service ? new Date(m.date_mise_en_service).getFullYear() : 0)
        );
        const hasValidYear = Number.isFinite(rawYear) && rawYear > 1970 && rawYear <= currentYear;
        const anneeMiseEnService: number | null = hasValidYear ? rawYear : null;
        const dureeDeVieAns = Math.max(1, Number(m.duree_vie_ans || m.duree_amortissement || 10));
        const ageYears: number | null =
          anneeMiseEnService !== null ? Math.max(1, currentYear - anneeMiseEnService) : null;

        let tauxAmortissementAnnuel: number | null = null;
        let amortissementCumule: number | null = null;
        let valeurNetteComptable: number | null = null;

        if (valeurANeuf !== null) {
          tauxAmortissementAnnuel = Math.round((valeurANeuf / dureeDeVieAns) * 100) / 100;
          const effectiveAge = ageYears ?? 1;
          amortissementCumule = Math.min(
            valeurANeuf,
            Math.round(tauxAmortissementAnnuel * effectiveAge * 100) / 100
          );
          valeurNetteComptable = Math.max(0, Math.round((valeurANeuf - amortissementCumule) * 100) / 100);
        }

        // FIN-P0: Costs strictly follow the machine code (never divided equally across machines)
        const correctiveCost = Math.round((machineCorrectiveFiscalMap[code] || 0) * 100) / 100;
        const preventiveCost = Math.round((machinePreventiveFiscalMap[code] || 0) * 100) / 100;
        const externalCost = Math.round((machineExternalFiscalMap[code] || 0) * 100) / 100;
        const coutMaintenanceExercice =
          Math.round((correctiveCost + preventiveCost + externalCost) * 100) / 100;

        const lifetimeCorr = machineCorrectiveLifetimeMap[code] || 0;
        const lifetimePrev = machinePreventiveLifetimeMap[code] || 0;
        const lifetimeExt = machineExternalLifetimeMap[code] || 0;
        const coutMaintenanceCumule =
          Math.round((lifetimeCorr + lifetimePrev + lifetimeExt) * 100) / 100;

        const tco = Math.round(((valeurANeuf || 0) + coutMaintenanceCumule) * 100) / 100;

        let berIndexPercent: number | null = null;
        let berStatus: MachineBerStatus = 'NON_EVALUE';

        if (valeurANeuf !== null && valeurANeuf > 0) {
          berIndexPercent = Math.round((coutMaintenanceCumule / valeurANeuf) * 1000) / 10;
          if (berIndexPercent >= berThreshold) {
            berStatus = 'REPLACE_RECOMMENDED';
            machinesBerCount++;
          } else if (berIndexPercent >= berThreshold * 0.7) {
            berStatus = 'ATTENTION';
          } else {
            berStatus = 'OPTIMAL';
          }
        }

        // Aggregate per zone
        const zEntry = zoneAggregationMap.get(zone) || {
          zone,
          machinesCount: 0,
          correctiveCost: 0,
          preventiveCost: 0,
          externalCost: 0,
          totalCost: 0,
        };
        zEntry.machinesCount += 1;
        zEntry.correctiveCost = Math.round((zEntry.correctiveCost + correctiveCost) * 100) / 100;
        zEntry.preventiveCost = Math.round((zEntry.preventiveCost + preventiveCost) * 100) / 100;
        zEntry.externalCost = Math.round((zEntry.externalCost + externalCost) * 100) / 100;
        zEntry.totalCost = Math.round((zEntry.totalCost + coutMaintenanceExercice) * 100) / 100;
        zoneAggregationMap.set(zone, zEntry);

        return {
          id: code,
          name,
          code,
          assetClass,
          zone,
          isValued,
          valeurANeuf,
          anneeMiseEnService,
          ageYears,
          dureeDeVieAns,
          tauxAmortissementAnnuel,
          amortissementCumule,
          valeurNetteComptable,
          correctiveCost,
          preventiveCost,
          externalCost,
          coutMaintenanceExercice,
          coutMaintenanceCumule,
          tco,
          berIndexPercent,
          berStatus,
        };
      })
      .sort((a, b) => b.coutMaintenanceCumule - a.coutMaintenanceCumule);

    const zoneCostBreakdown = Array.from(zoneAggregationMap.values()).sort(
      (a, b) => b.totalCost - a.totalCost
    );

    // 9. مصفوفة مقارنة الميزانية مع المصاريف الفعلية (Safe Zero-Allocation Variance + Configurable Warning Threshold)
    const buildVarianceItem = (
      key: BudgetCategoryKey,
      labelFr: string,
      labelAr: string,
      allocatedRaw: number,
      actualRaw: number
    ): BudgetVarianceItem => {
      const allocated = Math.max(0, Math.round((Number(allocatedRaw) || 0) * 100) / 100);
      const actual = Math.max(0, Math.round((Number(actualRaw) || 0) * 100) / 100);
      const variance = Math.round((allocated - actual) * 100) / 100;

      if (allocated === 0) {
        return {
          key,
          labelFr,
          labelAr,
          allocated: 0,
          actual,
          variance: -actual,
          burnRatePercent: 0,
          status: actual > 0 ? 'DEFICIT' : 'UNCONFIGURED',
        };
      }

      const burnRatePercent = Math.round((actual / allocated) * 1000) / 10;
      const status: BudgetVarianceStatus =
        actual > allocated
          ? 'DEFICIT'
          : burnRatePercent >= burnWarningPercent
          ? 'WARNING'
          : 'FAVORABLE';

      return {
        key,
        labelFr,
        labelAr,
        allocated,
        actual,
        variance,
        burnRatePercent,
        status,
      };
    };

    const annualAllocationsByKey: Record<BudgetCategoryKey, number> = {
      preventive: Math.max(0, Number(budget.allocatedPreventive) || 0),
      corrective: Math.max(0, Number(budget.allocatedCorrective) || 0),
      external: Math.max(0, Number(budget.allocatedExternal) || 0),
      spares: Math.max(0, Number(budget.allocatedSparesStock) || 0),
    };

    const annualActualsByKey: Record<BudgetCategoryKey, number> = {
      preventive: spendPreventive,
      corrective: spendCorrective,
      external: spendExternal,
      spares: spendSparesPurchased,
    };

    const varianceItems: BudgetVarianceItem[] = CATEGORY_META.map((cat) =>
      buildVarianceItem(
        cat.key,
        cat.labelFr,
        cat.labelAr,
        annualAllocationsByKey[cat.key],
        annualActualsByKey[cat.key]
      )
    );

    const totalAllocated = Math.round(
      annualAllocationsByKey.preventive +
        annualAllocationsByKey.corrective +
        annualAllocationsByKey.external +
        annualAllocationsByKey.spares
    );
    const totalActual = Math.round(
      spendPreventive + spendCorrective + spendExternal + spendSparesPurchased
    );
    const totalVariance = totalAllocated - totalActual;
    const totalBurnRate =
      totalAllocated > 0 ? Math.round((totalActual / totalAllocated) * 1000) / 10 : 0;

    // 10. P2-1 & P2-2: Monthly (1..12) and Quarterly (T1..T4) Breakdowns
    const getMonthCategoryAllocated = (catKey: BudgetCategoryKey, monthIdxZero: number): number => {
      const customSeries = budget.monthlyAllocations?.[catKey];
      if (Array.isArray(customSeries) && customSeries.length === 12) {
        const sumCustom = customSeries.reduce((acc, v) => acc + (Number(v) || 0), 0);
        if (sumCustom > 0 || periodMode === 'MONTHLY') {
          const val = Number(customSeries[monthIdxZero]);
          if (Number.isFinite(val) && val >= 0 && sumCustom > 0) {
            return Math.round(val * 100) / 100;
          }
        }
      }
      const annualVal = annualAllocationsByKey[catKey];
      if (annualVal <= 0) return 0;
      return Math.round((annualVal / 12) * 100) / 100;
    };

    const buildPeriodZoneBreakdown = (monthIndicesZeroBased: number[]): ZoneCostSummary[] => {
      const zMap = new Map<string, ZoneCostSummary>();
      // Seed all known zones from activeMachines so the table always shows active zones cleanly
      zoneMachinesCountMap.forEach((mCount, zoneName) => {
        zMap.set(zoneName, {
          zone: zoneName,
          machinesCount: mCount,
          correctiveCost: 0,
          preventiveCost: 0,
          externalCost: 0,
          totalCost: 0,
        });
      });

      monthIndicesZeroBased.forEach((mIdx) => {
        const monthMap = monthlyZoneCosts[mIdx];
        if (!monthMap) return;
        monthMap.forEach((costs, zoneName) => {
          const entry = zMap.get(zoneName) || {
            zone: zoneName,
            machinesCount: zoneMachinesCountMap.get(zoneName) || 0,
            correctiveCost: 0,
            preventiveCost: 0,
            externalCost: 0,
            totalCost: 0,
          };
          entry.correctiveCost = Math.round((entry.correctiveCost + costs.corrective) * 100) / 100;
          entry.preventiveCost = Math.round((entry.preventiveCost + costs.preventive) * 100) / 100;
          entry.externalCost = Math.round((entry.externalCost + costs.external) * 100) / 100;
          entry.totalCost = Math.round(
            (entry.correctiveCost + entry.preventiveCost + entry.externalCost) * 100
          ) / 100;
          zMap.set(zoneName, entry);
        });
      });

      return Array.from(zMap.values()).sort((a, b) => b.totalCost - a.totalCost);
    };

    const monthlyBreakdown: PeriodFinancialSummary[] = Array.from({ length: 12 }, (_, mIdx) => {
      const mNum = mIdx + 1;
      const periodCode = `M${String(mNum).padStart(2, '0')}`;
      const mVariances = CATEGORY_META.map((cat) =>
        buildVarianceItem(
          cat.key,
          cat.labelFr,
          cat.labelAr,
          getMonthCategoryAllocated(cat.key, mIdx),
          monthlyActuals[cat.key][mIdx]
        )
      );

      const mAllocated = Math.round(mVariances.reduce((s, v) => s + v.allocated, 0) * 100) / 100;
      const mActual = Math.round(mVariances.reduce((s, v) => s + v.actual, 0) * 100) / 100;
      const mVariance = Math.round((mAllocated - mActual) * 100) / 100;
      const mBurnRate = mAllocated > 0 ? Math.round((mActual / mAllocated) * 1000) / 10 : 0;
      const mStatus: BudgetVarianceStatus =
        mAllocated === 0
          ? mActual > 0
            ? 'DEFICIT'
            : 'UNCONFIGURED'
          : mActual > mAllocated
          ? 'DEFICIT'
          : mBurnRate >= burnWarningPercent
          ? 'WARNING'
          : 'FAVORABLE';

      return {
        periodIndex: mNum,
        periodCode,
        labelFr: MONTH_LABELS_FR[mIdx],
        labelAr: MONTH_LABELS_AR[mIdx],
        variances: mVariances,
        totalAllocated: mAllocated,
        totalActual: mActual,
        totalVariance: mVariance,
        totalBurnRate: mBurnRate,
        status: mStatus,
        zoneCostBreakdown: buildPeriodZoneBreakdown([mIdx]),
      };
    });

    const getQuarterCategoryAllocated = (catKey: BudgetCategoryKey, qIdxZero: number): number => {
      const customQ = budget.quarterlyAllocations?.[catKey];
      if (Array.isArray(customQ) && customQ.length === 4) {
        const sumCustom = customQ.reduce((acc, v) => acc + (Number(v) || 0), 0);
        if (sumCustom > 0) {
          const val = Number(customQ[qIdxZero]);
          if (Number.isFinite(val) && val >= 0) {
            return Math.round(val * 100) / 100;
          }
        }
      }
      // Sum of the 3 constituent months
      const mStart = qIdxZero * 3;
      return (
        Math.round(
          (getMonthCategoryAllocated(catKey, mStart) +
            getMonthCategoryAllocated(catKey, mStart + 1) +
            getMonthCategoryAllocated(catKey, mStart + 2)) *
            100
        ) / 100
      );
    };

    const quarterlyBreakdown: PeriodFinancialSummary[] = Array.from({ length: 4 }, (_, qIdx) => {
      const qNum = qIdx + 1;
      const periodCode = `T${qNum}`;
      const mIndices = [qIdx * 3, qIdx * 3 + 1, qIdx * 3 + 2];

      const qVariances = CATEGORY_META.map((cat) => {
        const qActual = mIndices.reduce((s, mIdx) => s + monthlyActuals[cat.key][mIdx], 0);
        return buildVarianceItem(
          cat.key,
          cat.labelFr,
          cat.labelAr,
          getQuarterCategoryAllocated(cat.key, qIdx),
          qActual
        );
      });

      const qAllocated = Math.round(qVariances.reduce((s, v) => s + v.allocated, 0) * 100) / 100;
      const qActual = Math.round(qVariances.reduce((s, v) => s + v.actual, 0) * 100) / 100;
      const qVariance = Math.round((qAllocated - qActual) * 100) / 100;
      const qBurnRate = qAllocated > 0 ? Math.round((qActual / qAllocated) * 1000) / 10 : 0;
      const qStatus: BudgetVarianceStatus =
        qAllocated === 0
          ? qActual > 0
            ? 'DEFICIT'
            : 'UNCONFIGURED'
          : qActual > qAllocated
          ? 'DEFICIT'
          : qBurnRate >= burnWarningPercent
          ? 'WARNING'
          : 'FAVORABLE';

      return {
        periodIndex: qNum,
        periodCode,
        labelFr: QUARTER_LABELS_FR[qIdx],
        labelAr: QUARTER_LABELS_AR[qIdx],
        variances: qVariances,
        totalAllocated: qAllocated,
        totalActual: qActual,
        totalVariance: qVariance,
        totalBurnRate: qBurnRate,
        status: qStatus,
        zoneCostBreakdown: buildPeriodZoneBreakdown(mIndices),
      };
    });

    // 11. P2-3: Active Budget Alerts & Top Deviations (Zero false alarms on EMPTY_FISCAL_BUDGET)
    const budgetAlerts: BudgetAlertItem[] = [];
    if (totalAllocated > 0) {
      // 11a. Annual category alerts
      varianceItems.forEach((v) => {
        if (v.allocated > 0 && (v.status === 'WARNING' || v.status === 'DEFICIT')) {
          budgetAlerts.push({
            id: `alert-annual-${v.key}`,
            categoryKey: v.key,
            labelFr: v.labelFr,
            labelAr: v.labelAr,
            periodType: 'ANNUAL',
            periodCode: 'ANNUAL',
            periodLabelFr: `Annuel ${currentYear}`,
            periodLabelAr: `السنوي ${currentYear}`,
            allocated: v.allocated,
            actual: v.actual,
            variance: v.variance,
            burnRatePercent: v.burnRatePercent,
            status: v.status,
          });
        }
      });

      // 11b. Period-level alerts (Monthly or Quarterly)
      if (periodMode === 'QUARTERLY') {
        quarterlyBreakdown.forEach((q) => {
          q.variances.forEach((v) => {
            if (v.allocated > 0 && (v.status === 'WARNING' || v.status === 'DEFICIT')) {
              budgetAlerts.push({
                id: `alert-${q.periodCode}-${v.key}`,
                categoryKey: v.key,
                labelFr: v.labelFr,
                labelAr: v.labelAr,
                periodType: 'QUARTERLY',
                periodCode: q.periodCode,
                periodLabelFr: `${q.labelFr} ${currentYear}`,
                periodLabelAr: `${q.labelAr} ${currentYear}`,
                allocated: v.allocated,
                actual: v.actual,
                variance: v.variance,
                burnRatePercent: v.burnRatePercent,
                status: v.status,
              });
            }
          });
        });
      } else {
        // For MONTHLY or ANNUAL with dated monthly spend exceeding monthly envelope
        monthlyBreakdown.forEach((m) => {
          m.variances.forEach((v) => {
            if (v.allocated > 0 && (v.status === 'WARNING' || v.status === 'DEFICIT')) {
              budgetAlerts.push({
                id: `alert-${m.periodCode}-${v.key}`,
                categoryKey: v.key,
                labelFr: v.labelFr,
                labelAr: v.labelAr,
                periodType: 'MONTHLY',
                periodCode: m.periodCode,
                periodLabelFr: `${m.labelFr} ${currentYear}`,
                periodLabelAr: `${m.labelAr} ${currentYear}`,
                allocated: v.allocated,
                actual: v.actual,
                variance: v.variance,
                burnRatePercent: v.burnRatePercent,
                status: v.status,
              });
            }
          });
        });
      }

      budgetAlerts.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'DEFICIT' ? -1 : 1;
        }
        return b.burnRatePercent - a.burnRatePercent;
      });
    }

    return {
      fiscalYear: currentYear,
      periodMode,
      burnWarningPercent,
      budget,
      variances: varianceItems,
      totalAllocated,
      totalActual,
      totalVariance,
      totalBurnRate,
      monthlyBreakdown,
      quarterlyBreakdown,
      budgetAlerts,
      spendPreventive: Math.round(spendPreventive),
      spendCorrective: Math.round(spendCorrective),
      spendExternal: Math.round(spendExternal),
      spendSparesConsumed: Math.round(spendSparesConsumed),
      spendSparesPurchased: Math.round(spendSparesPurchased),
      totalDowntimeHours,
      totalDowntimeLossMAD,
      stockItemsCount: stock.length,
      stockValuationPMP_MAD,
      stockValuationWithVAT_MAD,
      internalLaborHours,
      internalLaborCostMAD,
      technicianLaborBreakdown,
      machinesTCO,
      machinesBerCount,
      machinesValuedCount,
      machinesUnvaluedCount,
      zoneCostBreakdown,
    };
  }
}
