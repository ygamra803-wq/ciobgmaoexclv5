import { normalizeDateToYMD } from '../../utils/datePeriodUtils';
import { AvailabilityCalculationService } from '../../domain/services/AvailabilityCalculationService';
import {
  filterActiveMachines,
  filterProductionMachines,
  getMachineAssetClass,
} from '../../utils/activeMachines';
import {
  selectValidationCenterQueues,
  computeStockReorderAlerts,
  type StockReorderAlertsSummary,
} from '../../core/security/validationReconciliation';
import type { PreventiveExecutionRecord } from '../../types/preventive';

/** Validation statuses excluded from official financial, reliability, and stock calculations (Maker-Checker contract). */
const UNAPPROVED_VALIDATION_STATUSES = new Set([
  'PENDING_VALIDATION',
  'REJECTED',
  'NEEDS_CLARIFICATION',
]);

export interface UnapprovedClaimLike {
  validation_status?: unknown;
  statut?: unknown;
  etat?: unknown;
  [key: string]: unknown;
}

export interface ReportStockItemLike {
  ref?: string;
  reference?: string;
  code_article?: string;
  designation?: string;
  nom?: string;
  stockActuel?: number;
  stock?: number;
  stockInitial?: number;
  seuil?: number;
  stockMin?: number;
  prix_unitaire?: number;
  prixUnitaire?: number;
  prix_achat_ht?: number;
  prix?: number;
  unitPrice?: number;
  [key: string]: unknown;
}

export interface ReportMovementLike {
  id?: string;
  type?: string;
  ref?: string;
  reference?: string;
  id_article?: string;
  designation?: string;
  quantite?: number;
  prix_unitaire?: number;
  prix_achat_ht?: number;
  prix?: number;
  unit?: string;
  unite?: string;
  date?: string;
  action_id?: string;
  tags?: string[];
  code_bon?: string;
  num_bon?: string;
  num_bon_saisi_par_tech?: string;
  validation_status?: string;
  statut?: string;
  etat?: string;
  asset_class?: string;
  id_machine_registered?: string;
  code_machine?: string;
  id_machine?: string;
  machineCode?: string;
  machine?: string;
  nom_machine?: string;
  machineName?: string;
  system_type_code?: string;
  [key: string]: unknown;
}

export interface ReportCorrectivePieceLike {
  ref?: string;
  code_article?: string;
  quantite?: number;
  qte?: number;
  qty?: number;
  prix_unitaire?: number;
  prix?: number;
  unitPrice?: number;
  [key: string]: unknown;
}

export interface ReportCorrectiveLike {
  id?: string | number;
  statut?: string;
  etat?: string;
  validation_status?: string;
  asset_class?: string;
  code_machine?: string;
  id_machine?: string;
  machineCode?: string;
  id_machine_registered?: string;
  machine?: string;
  nom_machine?: string;
  machineName?: string;
  system_type_code?: string;
  date_cloture?: string;
  date_fin?: string;
  validated_at?: string;
  date_demande?: string;
  demande_date?: string;
  date?: string;
  date_debut?: string;
  created_at?: string;
  downtimeHours?: number;
  temps_arret_minutes?: number;
  duree_arret?: number;
  temps_arret?: number | string;
  temps_intervention_mins?: number;
  temps_minutes?: number;
  temps_intervention?: string;
  temps_intervention_calc?: number | string;
  pdr_cost?: number;
  cout_pdr?: number;
  cout_total?: number;
  pieces_utilisees?: ReportCorrectivePieceLike[];
  pdr_ref?: string;
  pdr?: string;
  pdr_quantite?: number;
  quantite?: number;
  pdr_prix?: number;
  prix_unitaire?: number;
  intervenant?: string;
  [key: string]: unknown;
}

export interface ReportPreventiveTaskLike {
  id?: string | number;
  code_tache?: string;
  active?: boolean;
  is_active?: boolean;
  actif?: boolean;
  archived?: boolean;
  isArchived?: boolean;
  statut?: string;
  status?: string;
  etat?: string;
  validation_status?: string;
  periodMonth?: string;
  nextDueDate?: string;
  prochaine_echeance?: string;
  date_prevue?: string;
  date_planifiee?: string;
  dueDate?: string;
  scheduledDueDate?: string;
  echeance_precedente?: string;
  derniere_realisation?: string;
  date_realisation?: string;
  executedAt?: string;
  tache?: string;
  designation?: string;
  organe?: string;
  responsable?: string;
  technicien?: string;
  asset_class?: string;
  code_machine?: string;
  id_machine?: string;
  machineCode?: string;
  id_machine_registered?: string;
  machine?: string;
  nom_machine?: string;
  machineName?: string;
  system_type_code?: string;
  [key: string]: unknown;
}

export type ReportPreventiveExecutionLike = Omit<PreventiveExecutionRecord, 'id'> & {
  id?: string;
  date?: string;
  echeance?: string;
  dueDate?: string;
  created_at?: string;
  asset_class?: string;
  code_machine?: string;
  id_machine?: string;
  id_machine_registered?: string;
  machine?: string;
  nom_machine?: string;
  id_tache?: string;
  system_type_code?: string;
  [key: string]: unknown;
};

export interface ReportSortieExterneLike {
  id?: string | number;
  statut?: string;
  etat?: string;
  validation_status?: string;
  date_montage?: string;
  date_arrivee_reelle?: string;
  date_retour?: string;
  date_expedition?: string;
  date_sortie?: string;
  date_demontage?: string;
  date?: string;
  created_at?: string;
  id_machine?: string;
  code_machine?: string;
  id_machine_registered?: string;
  machine?: string;
  nom_machine?: string;
  machineName?: string;
  asset_class?: string;
  system_type_code?: string;
  cout_bobinage?: number;
  cout_reparation?: number;
  cout?: number;
  montant?: number;
  [key: string]: unknown;
}

export interface ReportSortieDemandLike {
  id?: string | number;
  validation_status?: string;
  statut?: string;
  etat?: string;
  created_at?: string;
  date?: string;
  submitted_at?: string;
  id_machine_registered?: string;
  code_machine?: string;
  id_machine?: string;
  asset_class?: string;
  [key: string]: unknown;
}

export interface ReportMachineLike {
  id?: string;
  id_machine_registered?: string;
  code?: string;
  id_machine?: string;
  code_machine?: string;
  nom?: string;
  designation?: string;
  name?: string;
  asset_class?: string;
  system_type_code?: string;
  status?: string;
  statut?: string;
  is_active?: boolean;
  archived?: boolean;
  [key: string]: unknown;
}

export interface ReportAssetMetaSource {
  asset_class?: unknown;
  code_machine?: unknown;
  id_machine?: unknown;
  machineCode?: unknown;
  id_machine_registered?: unknown;
  machine?: unknown;
  nom_machine?: unknown;
  machineName?: unknown;
  system_type_code?: unknown;
  [key: string]: unknown;
}

/** Returns true when a field claim or intervention is still unapproved in the Maker-Checker workflow. */
export function isUnapprovedFieldClaim(record: UnapprovedClaimLike | null | undefined): boolean {
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
  assetClassFilter?: ReportAssetClassFilter;
  
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
  topFailingMachines: Array<FailingMachineSummary & { assetClass?: 'PRODUCTION' | 'SYSTEM_GENERAL' }>;

  // 4. Preventive Maintenance Discipline & Technician Breakdown
  preventiveScheduledCount: number;
  preventiveExecutedCount: number;
  preventiveDisciplineRate: number; // percentage 0-100%
  preventiveTotalCost: number;
  preventiveLaborHours: number;
  technicianBreakdown: TechnicianMonthlySummary[];

  // 5. External Subcontracting / Bobinage (Sorties Externe) & C1 Total Official Maintenance Cost
  externalBobinageCount: number;
  externalBobinageCost: number;
  totalOfficialMaintenanceCost: number;
  machineCostBreakdown: MachineOfficialCostRow[];
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
  totalOfficialCostDelta?: MonthOverMonthDelta;
}

export class MonthlyReportCalculationService {
  /**
   * Computes the complete factory executive report for a given month (`YYYY-MM`).
   * Excludes unapproved Maker-Checker claims from official costs and isolates
   * `PRODUCTION` assets from `SYSTEM_GENERAL` assets during MTBF/MTTR reliability calculations.
   */
  static calculateMonthlyReport({
    month,
    assetClass = 'ALL',
    stockItems = [],
    mouvements = [],
    correctiveInterventions = [],
    preventiveTasks = [],
    preventiveExecutions = [],
    sortiesExterne = [],
    machines = [],
  }: {
    month: string;
    assetClass?: ReportAssetClassFilter;
    stockItems?: ReportStockItemLike[];
    mouvements?: ReportMovementLike[];
    correctiveInterventions?: ReportCorrectiveLike[];
    preventiveTasks?: ReportPreventiveTaskLike[];
    preventiveExecutions?: ReportPreventiveExecutionLike[];
    sortiesExterne?: ReportSortieExterneLike[];
    machines?: ReportMachineLike[];
  }): MonthlyFactoryReportData {
    const targetMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);

    // Build Machine Lookup Map from SSOT
    const activeMachinesList = filterActiveMachines(machines || []);
    const activeProductionMachines = filterProductionMachines(machines || []);
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
      { code: string; name: string; assetClass: 'PRODUCTION' | 'SYSTEM_GENERAL'; isActive: boolean }
    >();

    (machines || []).forEach((m) => {
      if (!m) return;
      const rawCodes = [m.id_machine_registered, m.id, m.code, m.id_machine, m.code_machine]
        .map((c) => String(c || '').trim().toUpperCase())
        .filter(Boolean);
      if (rawCodes.length === 0) return;
      const mClass = getMachineAssetClass(m);
      const mName = String(m.nom || m.designation || m.name || rawCodes[0]).trim();
      const isAct = rawCodes.some((c) => activeMachineCodes.has(c));
      rawCodes.forEach((c) => {
        allRegisteredMachineCodes.add(c);
        machineInfoMap.set(c, { code: rawCodes[0], name: mName, assetClass: mClass, isActive: isAct });
      });
    });

    const resolveRecordAssetMeta = (record: ReportAssetMetaSource, primaryField?: string) => {
      const explicitClass = String(record?.asset_class || '').trim().toUpperCase();
      const rawCode = String(
        (primaryField ? record?.[primaryField] : '') ||
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
      const isArchived =
        allRegisteredMachineCodes.size > 0 &&
        Boolean(rawCode && allRegisteredMachineCodes.has(rawCode) && !activeMachineCodes.has(rawCode));

      return {
        assetClass: resolvedClass,
        machineCode: info?.code || rawCode || 'GLOBAL',
        machineName: String(info?.name || record?.nom_machine || record?.machineName || rawCode || 'GLOBAL'),
        isArchived,
      };
    };

    const matchesClassFilter = (recClass: 'PRODUCTION' | 'SYSTEM_GENERAL'): boolean => {
      if (!assetClass || assetClass === 'ALL') return true;
      return recClass === assetClass;
    };

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
      const price = Number(item.prix_unitaire ?? item.prixUnitaire ?? item.prix_achat_ht ?? item.prix ?? item.unitPrice ?? 0);

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
      if (!m || isUnapprovedFieldClaim(m)) return;
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

      const meta = resolveRecordAssetMeta(m, 'id_machine_registered');
      if (!matchesClassFilter(meta.assetClass)) return;

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
    const machineFailuresMap = new Map<
      string,
      FailingMachineSummary & { assetClass?: 'PRODUCTION' | 'SYSTEM_GENERAL' }
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
    const productionCorrectiveList: ReportCorrectiveLike[] = [];

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
      const status = String(ci.statut || ci.etat || '').toUpperCase();
      const isClosed = status === 'CLOTURE' || status === 'FERME' || status === 'TERMINE';
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
      if (!ciDate || !ciDate.startsWith(targetMonth)) return;

      const meta = resolveRecordAssetMeta(ci, 'code_machine');

      // Isolate active PRODUCTION interventions for MTBF / MTTR / Availability
      if (meta.assetClass === 'PRODUCTION' && !meta.isArchived) {
        productionCorrectiveList.push(ci);
      }

      if (!matchesClassFilter(meta.assetClass)) return;

      correctiveCount++;
      if (isClosed) {
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
      let btOfficialCost = 0;
      const explicitCost = Number(ci.pdr_cost ?? ci.cout_pdr ?? ci.cout_total ?? 0);
      if (Number.isFinite(explicitCost) && explicitCost > 0) {
        btOfficialCost = explicitCost;
      } else if (Array.isArray(ci.pieces_utilisees) && ci.pieces_utilisees.length > 0) {
        ci.pieces_utilisees.forEach((p: ReportCorrectivePieceLike) => {
          const pRef = String(p?.ref || p?.code_article || '').trim().toUpperCase();
          const pQty = Number(p?.quantite ?? p?.qte ?? 0);
          const pPrice =
            Number(p?.prix_unitaire ?? p?.prix ?? 0) ||
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

      if (!meta.isArchived) {
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
      }

      // Track technician corrective workload
      if (ci.intervenant) {
        const tEntry = ensureTech(ci.intervenant);
        tEntry.correctiveCount++;
        const workMins = Number(ci.temps_intervention_mins || ci.temps_minutes || 0) || Math.round(dtHours * 60);
        tEntry.totalHours = Number((tEntry.totalHours + workMins / 60).toFixed(1));
      }

      // Track failing machines (excluding archived machines)
      if (!meta.isArchived) {
        const existingM = machineFailuresMap.get(meta.machineCode);
        if (existingM) {
          existingM.failureCount++;
          existingM.totalDowntimeHours = Number((existingM.totalDowntimeHours + (dtHours > 0 ? dtHours : 0)).toFixed(1));
        } else {
          machineFailuresMap.set(meta.machineCode, {
            machineCode: meta.machineCode,
            machineName: meta.machineName,
            assetClass: meta.assetClass,
            failureCount: 1,
            totalDowntimeHours: Number((dtHours > 0 ? dtHours : 0).toFixed(1)),
          });
        }
      }
    });

    const topFailingMachines = Array.from(machineFailuresMap.values())
      .sort((a, b) => b.failureCount - a.failureCount || b.totalDowntimeHours - a.totalDowntimeHours)
      .slice(0, 3);

    const activeMachinesCount = Math.max(
      1,
      activeProductionMachines.length || activeMachinesList.length || machineFailuresMap.size || 1
    );
    const scheduledPlantHours = activeMachinesCount * 160;
    const mttrHours = AvailabilityCalculationService.calculateMTTR(productionCorrectiveList);
    const mttrFormatted = AvailabilityCalculationService.formatMTTR(productionCorrectiveList);
    const mtbfHours = AvailabilityCalculationService.calculateMTBF(productionCorrectiveList, scheduledPlantHours);
    const availabilityRate = AvailabilityCalculationService.calculateAvailability(productionCorrectiveList, scheduledPlantHours);

    // =========================================================================
    // 4. Preventive Maintenance Discipline & Technician Distribution
    // =========================================================================
    const monthExecutions = (preventiveExecutions || []).filter((e) => {
      if (!e || isUnapprovedFieldClaim(e)) return false;
      const meta = resolveRecordAssetMeta(e, 'machineCode');
      if (!matchesClassFilter(meta.assetClass)) return false;
      const eDate = normalizeDateToYMD(e.executedAt);
      return (e.periodMonth && e.periodMonth === targetMonth) || (eDate && eDate.startsWith(targetMonth));
    });

    monthExecutions.forEach((exec) => {
      const meta = resolveRecordAssetMeta(exec, 'machineCode');
      const exOfficialCost = Number(exec.totalCost ?? exec.sparesCost ?? 0) || 0;
      if (!meta.isArchived) {
        const costRow = ensureMachineCostRow(meta);
        costRow.preventiveCount++;
        costRow.preventiveCost = Number((costRow.preventiveCost + exOfficialCost).toFixed(2));
        costRow.totalOfficialCost = Number(
          (costRow.correctiveCost + costRow.preventiveCost + costRow.externalBobinageCost).toFixed(2)
        );
      }
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

    const hasRegisteredMachines = (machines || []).length > 0;

    const scheduledTasksForMonth = (preventiveTasks || []).filter((t) => {
      if (!t) return false;
      if (t.active === false || t.is_active === false) return false;
      const st = String(t.statut || t.status || '').trim().toUpperCase();
      if (st === 'ARCHIVE' || st === 'ARCHIVEE' || st === 'INACTIF' || st === 'ANNULE') return false;

      const meta = resolveRecordAssetMeta(t, 'code_machine');
      if (!matchesClassFilter(meta.assetClass)) return false;

      if (hasRegisteredMachines && meta.isArchived) {
        return false;
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
      if (seDate && seDate.startsWith(targetMonth)) {
        const meta = resolveRecordAssetMeta(se, 'id_machine');
        if (!matchesClassFilter(meta.assetClass)) return;
        const extCost =
          Number(se.cout_bobinage ?? se.cout_reparation ?? se.cout ?? se.montant ?? 0) || 0;
        externalBobinageCount++;
        externalBobinageCost += extCost;
        if (!meta.isArchived) {
          const costRow = ensureMachineCostRow(meta);
          costRow.externalBobinageCount++;
          costRow.externalBobinageCost = Number((costRow.externalBobinageCost + extCost).toFixed(2));
          costRow.totalOfficialCost = Number(
            (costRow.correctiveCost + costRow.preventiveCost + costRow.externalBobinageCost).toFixed(2)
          );
        }
      }
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
      periodMonth: targetMonth,
      assetClassFilter: assetClass,
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
      totalOfficialMaintenanceCost,
      machineCostBreakdown,
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

  /** Computes Month-over-Month comparison (`currentMonth` vs `previousMonth`). */
  static calculateMonthOverMonthComparison(params: {
    month: string;
    assetClass?: ReportAssetClassFilter;
    stockItems?: ReportStockItemLike[];
    mouvements?: ReportMovementLike[];
    correctiveInterventions?: ReportCorrectiveLike[];
    preventiveTasks?: ReportPreventiveTaskLike[];
    preventiveExecutions?: ReportPreventiveExecutionLike[];
    sortiesExterne?: ReportSortieExterneLike[];
    machines?: ReportMachineLike[];
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
      totalOfficialCostDelta: this.calculateDelta(
        currentReport.totalOfficialMaintenanceCost,
        previousReport.totalOfficialMaintenanceCost
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

import {
  buildShiftOrWeeklyReport,
  buildShiftWeeklyReportCsv,
  buildShiftWeeklyReportExportRows,
  buildShiftWeeklyReportJson,
  computePmWindowCompliance,
  type MachineOfficialCostRow,
  type OfficialMovementExportRow,
  type OverduePreventiveTaskSnapshotItem,
  type PmComplianceStatus,
  type PmComplianceTaskItem,
  type PmWindowComplianceSummary,
  type ReportAssetClassFilter,
  type ShiftOrWeeklyReportData,
  type ShiftOrWeeklyReportParams,
  type SystemGeneralTypeBreakdown,
} from './ShiftWeeklyReportEngine';

export {
  buildShiftOrWeeklyReport,
  buildShiftWeeklyReportCsv,
  buildShiftWeeklyReportExportRows,
  buildShiftWeeklyReportJson,
  computePmWindowCompliance,
  type MachineOfficialCostRow,
  type OfficialMovementExportRow,
  type OverduePreventiveTaskSnapshotItem,
  type PmComplianceStatus,
  type PmComplianceTaskItem,
  type PmWindowComplianceSummary,
  type ReportAssetClassFilter,
  type ShiftOrWeeklyReportData,
  type ShiftOrWeeklyReportParams,
  type SystemGeneralTypeBreakdown,
};

export default MonthlyReportCalculationService;



