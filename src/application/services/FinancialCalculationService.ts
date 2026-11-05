/**
 * @file FinancialCalculationService.ts
 * @module application/services/FinancialCalculationService
 * @description
 * محرك الحسابات المالية، التكلفة الإجمالية للملكية (TCO)، إهلاك الأصول، وتقييم المخزون متعدد العملات لـ GMAO.
 * يتوافق مع المعايير الدولية لإدارة أصول المنشآت الصناعية (ISO 55000 / IFRS / ISO 4217).
 */

import {
  FiscalBudgetConfig,
  HistoricalExchangeRate,
  DEFAULT_FISCAL_BUDGET,
} from '../../domain/finance/entities/FinancialBudget';
import { isUnapprovedFieldClaim } from './MonthlyReportCalculationService';
import { filterActiveMachines } from '../../utils/activeMachines';

export interface BudgetVarianceItem {
  key: string;
  labelFr: string;
  labelAr: string;
  allocated: number;
  actual: number;
  variance: number;         // allocated - actual (Positive = Under budget, Negative = Over budget)
  burnRatePercent: number;  // (actual / allocated) * 100
  status: 'FAVORABLE' | 'WARNING' | 'DEFICIT';
}

export interface MachineTCOCalculation {
  id: string;
  name: string;
  code: string;
  assetClass: string;
  zone: string;
  valeurANeuf: number;
  anneeMiseEnService: number;
  ageYears: number;
  dureeDeVieAns: number;
  tauxAmortissementAnnuel: number;
  amortissementCumule: number;
  valeurNetteComptable: number;
  correctiveCost: number;
  preventiveCost: number;
  externalCost: number;
  coutMaintenanceCumule: number;
  tco: number;               // Valeur à neuf + Coût maintenance cumulé
  berIndexPercent: number;   // (Coût maintenance cumulé / Valeur à neuf) * 100
  berStatus: 'OPTIMAL' | 'ATTENTION' | 'REPLACE_RECOMMENDED';
}

export interface FinancialSynthesis {
  fiscalYear: number;
  budget: FiscalBudgetConfig;
  variances: BudgetVarianceItem[];
  totalAllocated: number;
  totalActual: number;
  totalVariance: number;
  totalBurnRate: number;
  
  // Spend breakdown
  spendPreventive: number;
  spendCorrective: number;
  spendExternal: number;
  spendSparesConsumed: number;
  spendSparesPurchased: number;
  
  // Downtime financial loss
  totalDowntimeHours: number;
  totalDowntimeLossMAD: number;
  
  // Inventory valuation
  stockItemsCount: number;
  stockValuationPMP_MAD: number;
  stockValuationWithVAT_MAD: number;
  
  // Labor
  internalLaborHours: number;
  internalLaborCostMAD: number;
  technicianLaborBreakdown: Array<{
    name: string;
    hours: number;
    costMAD: number;
    interventionsCount: number;
  }>;
  
  // Assets TCO
  machinesTCO: MachineTCOCalculation[];
  machinesBerCount: number;
}

export function isUnapprovedFinancialRecord(record: any): boolean {
  if (!record) return true;
  if (isUnapprovedFieldClaim(record)) return true;
  const valStatus = String(record?.validation_status || '').trim().toUpperCase();
  const status = String(record?.statut || record?.etat || '').trim().toUpperCase();
  return (
    valStatus === 'EN_ATTENTE_VALIDATION' ||
    valStatus === 'PENDING_VALIDATION' ||
    valStatus === 'REJECTED' ||
    valStatus === 'REJETEE' ||
    status === 'EN_ATTENTE_VALIDATION' ||
    status === 'REJETEE' ||
    status === 'REJECTED'
  );
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
   * الحساب الشامل لكافة مؤشرات الإدارة والتقارير المالية للشركة
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
    const budget = params.budget || DEFAULT_FISCAL_BUDGET;
    const rates = params.exchangeRates || [];
    const activeMachines = filterActiveMachines(params.machines || []);
    const movements = params.mouvements || [];
    const correctiveList = params.correctiveInterventions || [];
    const executions = params.preventiveExecutions || [];
    const externalList = params.sortiesExterne || [];
    const stock = params.stockItems || [];

    const techRate = Math.max(0, budget.technicianHourlyRate || 55);
    const downtimeRatePerHour = Math.max(0, budget.productionDowntimeCostPerHour || 2500);
    const berThreshold = Math.max(10, budget.berThresholdPercent || 70);
    const currentYear = budget.fiscalYear || new Date().getFullYear();

    // 1. حساب مصاريف الصيانة الوقائية (Preventive Spend)
    let spendPreventive = 0;
    let preventiveMinutesTotal = 0;
    const techHoursMap: Record<string, { minutes: number; count: number }> = {};

    executions.forEach((ex) => {
      if (!ex || isUnapprovedFinancialRecord(ex)) return;
      const status = String(ex.statut || ex.etat || '').toUpperCase();
      if (status === 'REJETEE') return;

      const durMin = Number(ex.duree_minutes || ex.duree_execution || 0);
      preventiveMinutesTotal += durMin;

      const tech = String(ex.technicien || ex.executeur || 'Non assigné').trim();
      if (!techHoursMap[tech]) techHoursMap[tech] = { minutes: 0, count: 0 };
      techHoursMap[tech].minutes += durMin;
      techHoursMap[tech].count += 1;

      if (ex.cout_total !== undefined && Number(ex.cout_total) > 0) {
        spendPreventive += Number(ex.cout_total);
      } else {
        const partsCost = Number(ex.pieces_cout || ex.cout_pieces || 0);
        const laborCost = (durMin / 60) * techRate;
        spendPreventive += partsCost + laborCost;
      }
    });

    // 2. حساب مصاريف الصيانة التصحيحية والأعطال (Corrective Spend) & Downtime Loss
    let spendCorrective = 0;
    let correctiveDowntimeMinutes = 0;
    let correctiveMinutesTotal = 0;
    const machineCorrectiveCostMap: Record<string, number> = {};

    correctiveList.forEach((ci) => {
      if (!ci || isUnapprovedFinancialRecord(ci)) return;
      const mchId = String(ci.code_machine || ci.id_machine || '').trim().toUpperCase();

      // Downtime calculation
      const dtMin = Number(ci.duree_arret_minutes || ci.temps_arret_min || ci.duree_minutes || 0);
      correctiveDowntimeMinutes += dtMin;

      // Labor duration
      const durMin = Number(ci.duree_intervention_min || ci.duree_minutes || ci.duree || 0);
      correctiveMinutesTotal += durMin;

      const tech = String(ci.technicien || ci.intervenant || 'Non assigné').trim();
      if (!techHoursMap[tech]) techHoursMap[tech] = { minutes: 0, count: 0 };
      techHoursMap[tech].minutes += durMin;
      techHoursMap[tech].count += 1;

      let partsCost = 0;
      if (Array.isArray(ci.pieces_utilisees) && ci.pieces_utilisees.length > 0) {
        partsCost = ci.pieces_utilisees.reduce((sum: number, p: any) => {
          const q = Number(p.quantite || p.qte || 1);
          const pr = Number(p.prix_unitaire || p.prix || 0);
          return sum + q * pr;
        }, 0);
      } else if (ci.cout_pieces !== undefined) {
        partsCost = Number(ci.cout_pieces) || 0;
      }

      const laborCost = (durMin / 60) * techRate;
      const ciTotal = (ci.cout_total !== undefined && Number(ci.cout_total) > 0)
        ? Number(ci.cout_total)
        : partsCost + laborCost;

      spendCorrective += ciTotal;
      if (mchId) {
        machineCorrectiveCostMap[mchId] = (machineCorrectiveCostMap[mchId] || 0) + ciTotal;
      }
    });

    // 3. حساب مصاريف المقاولة والبوبيناج الخارجي (External Subcontracting Spend)
    let spendExternal = 0;
    const machineExternalCostMap: Record<string, number> = {};

    externalList.forEach((se) => {
      if (!se || isUnapprovedFinancialRecord(se)) return;
      const cost = Number(se.cout_reel || se.cout_estime || se.cout || 0);
      spendExternal += cost;
      const mchId = String(se.machine_cible || se.code_machine || se.id_machine || '').trim().toUpperCase();
      if (mchId) {
        machineExternalCostMap[mchId] = (machineExternalCostMap[mchId] || 0) + cost;
      }
    });

    // 4. تقييم حركة قطع الغيار (Entrées / Sorties & PMP)
    let spendSparesPurchased = 0;
    let spendSparesConsumed = 0;

    movements.forEach((mvt) => {
      if (!mvt || isUnapprovedFinancialRecord(mvt)) return;
      const type = String(mvt.type || '').toUpperCase();
      const qte = Math.abs(Number(mvt.quantite || 0));
      const unitPrice = Number(mvt.prix_unitaire || mvt.prix || 0);
      const total = qte * unitPrice;

      if (type === 'ENTREE' || type === 'RECEPTION' || type === 'ACHAT') {
        spendSparesPurchased += total;
      } else if (type === 'SORTIE' || type === 'CONSOMMATION') {
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
    const vatRate = Math.max(0, budget.defaultVatRate || 20);
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

    // 8. مؤشرات TCO والإهلاك للأصول (Asset TCO & Depreciation)
    let machinesBerCount = 0;
    const machinesTCO: MachineTCOCalculation[] = activeMachines.map((m) => {
      const code = String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase();
      const name = m.designation || m.nom || `Machine ${code}`;
      const assetClass = m.asset_class || m.famille || 'Standard';
      const zone = m.id_zone_default || m.id_zone || m.zone || 'Atelier';

      // Valeur à neuf: inspect real fields or give consistent benchmark
      const rawValeur = Number(m.valeur_a_neuf || m.prix_achat || m.valeur_acquisition || 0);
      const valeurANeuf = rawValeur > 0 ? rawValeur : 120000;

      const rawYear = Number(m.annee_mise_en_service || (m.date_mise_en_service ? new Date(m.date_mise_en_service).getFullYear() : 0));
      const anneeMiseEnService = rawYear > 1980 && rawYear <= currentYear ? rawYear : 2021;
      const dureeDeVieAns = Number(m.duree_vie_ans || m.duree_amortissement || 10);
      const ageYears = Math.max(1, currentYear - anneeMiseEnService);

      const tauxAmortissementAnnuel = Math.round((valeurANeuf / dureeDeVieAns) * 100) / 100;
      const amortissementCumule = Math.min(valeurANeuf, Math.round(tauxAmortissementAnnuel * ageYears * 100) / 100);
      const valeurNetteComptable = Math.max(0, Math.round((valeurANeuf - amortissementCumule) * 100) / 100);

      const correctiveCost = machineCorrectiveCostMap[code] || 0;
      const externalCost = machineExternalCostMap[code] || 0;
      // Preventive is distributed or tracked per machine
      const preventiveCost = Math.round((spendPreventive / Math.max(1, activeMachines.length)) * 100) / 100;

      const coutMaintenanceCumule = Math.round((correctiveCost + externalCost + preventiveCost) * 100) / 100;
      const tco = Math.round((valeurANeuf + coutMaintenanceCumule) * 100) / 100;
      const berIndexPercent = Math.round((coutMaintenanceCumule / Math.max(1, valeurANeuf)) * 1000) / 10;

      let berStatus: 'OPTIMAL' | 'ATTENTION' | 'REPLACE_RECOMMENDED' = 'OPTIMAL';
      if (berIndexPercent >= berThreshold) {
        berStatus = 'REPLACE_RECOMMENDED';
        machinesBerCount++;
      } else if (berIndexPercent >= berThreshold * 0.7) {
        berStatus = 'ATTENTION';
      }

      return {
        id: code,
        name,
        code,
        assetClass,
        zone,
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
        coutMaintenanceCumule,
        tco,
        berIndexPercent,
        berStatus,
      };
    }).sort((a, b) => b.coutMaintenanceCumule - a.coutMaintenanceCumule);

    // 9. مصفوفة مقارنة الميزانية مع المصاريف الفعلية (Budget Variances)
    const varianceItems: BudgetVarianceItem[] = [
      {
        key: 'preventive',
        labelFr: 'Maintenance Préventive',
        labelAr: 'الصيانة الوقائية والفحص الدوري',
        allocated: budget.allocatedPreventive,
        actual: Math.round(spendPreventive),
        variance: Math.round(budget.allocatedPreventive - spendPreventive),
        burnRatePercent: Math.round((spendPreventive / Math.max(1, budget.allocatedPreventive)) * 1000) / 10,
        status: spendPreventive > budget.allocatedPreventive
          ? 'DEFICIT'
          : spendPreventive > budget.allocatedPreventive * 0.85
          ? 'WARNING'
          : 'FAVORABLE',
      },
      {
        key: 'corrective',
        labelFr: 'Correctif & Pannes Urgentes',
        labelAr: 'الصيانة التصحيحية وحالات الطوارئ',
        allocated: budget.allocatedCorrective,
        actual: Math.round(spendCorrective),
        variance: Math.round(budget.allocatedCorrective - spendCorrective),
        burnRatePercent: Math.round((spendCorrective / Math.max(1, budget.allocatedCorrective)) * 1000) / 10,
        status: spendCorrective > budget.allocatedCorrective
          ? 'DEFICIT'
          : spendCorrective > budget.allocatedCorrective * 0.85
          ? 'WARNING'
          : 'FAVORABLE',
      },
      {
        key: 'external',
        labelFr: 'Sous-traitance & Bobinage',
        labelAr: 'المقاولات والبوبيناج الخارجي',
        allocated: budget.allocatedExternal,
        actual: Math.round(spendExternal),
        variance: Math.round(budget.allocatedExternal - spendExternal),
        burnRatePercent: Math.round((spendExternal / Math.max(1, budget.allocatedExternal)) * 1000) / 10,
        status: spendExternal > budget.allocatedExternal
          ? 'DEFICIT'
          : spendExternal > budget.allocatedExternal * 0.85
          ? 'WARNING'
          : 'FAVORABLE',
      },
      {
        key: 'spares',
        labelFr: 'Achats & Renouvellement PDR',
        labelAr: 'مشتريات وتجديد قطع الغيار',
        allocated: budget.allocatedSparesStock,
        actual: Math.round(spendSparesPurchased),
        variance: Math.round(budget.allocatedSparesStock - spendSparesPurchased),
        burnRatePercent: Math.round((spendSparesPurchased / Math.max(1, budget.allocatedSparesStock)) * 1000) / 10,
        status: spendSparesPurchased > budget.allocatedSparesStock
          ? 'DEFICIT'
          : spendSparesPurchased > budget.allocatedSparesStock * 0.85
          ? 'WARNING'
          : 'FAVORABLE',
      },
    ];

    const totalAllocated = budget.allocatedPreventive + budget.allocatedCorrective + budget.allocatedExternal + budget.allocatedSparesStock;
    const totalActual = Math.round(spendPreventive + spendCorrective + spendExternal + spendSparesPurchased);
    const totalVariance = totalAllocated - totalActual;
    const totalBurnRate = Math.round((totalActual / Math.max(1, totalAllocated)) * 1000) / 10;

    return {
      fiscalYear: currentYear,
      budget,
      variances: varianceItems,
      totalAllocated,
      totalActual,
      totalVariance,
      totalBurnRate,
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
    };
  }
}
