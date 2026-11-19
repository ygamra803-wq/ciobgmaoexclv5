/**
 * Pure Domain Analytics & Readiness Engine for Preventive Maintenance (`preventive`).
 * Computes dynamic cycle KPIs, On-Time Compliance Rate (OTCR), true Labor vs PDR cost split,
 * PM/CM balance ratio, zone health, top risk machines, and upcoming PDR stock shortages.
 */

import {
  computeTaskCycleStatus,
  type TaskCycleEvaluation,
} from './preventiveScheduleEngine';
import { StockCalculationService } from '../pdr/services/StockCalculationService';
import type { PreventiveExecutionRecord } from '../../types/preventive';

export interface PreventiveAnalyticsInput {
  tasks?: any[];
  executions?: PreventiveExecutionRecord[];
  machines?: any[];
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  actions?: Array<{ code: string; libelle?: string }>;
  zones?: any[];
  today?: string;
}

export interface ZoneHealthStat {
  zone: string;
  total: number;
  done: number;
  todo: number;
  overdue: number;
  pending: number;
  complianceRate: number;
}

export interface ActionCostStat {
  code: string;
  libelle: string;
  taskCount: number;
  approvedExecCount: number;
  laborCost: number;
  sparesCost: number;
  totalCost: number;
  sharePct: number;
}

export interface MachineRiskStat {
  machineCode: string;
  machineName: string;
  zone: string;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  pendingTasks: number;
  approvedExecs: number;
  laborCost: number;
  sparesCost: number;
  totalCost: number;
  complianceRate: number;
}

export interface UpcomingPdrRiskItem {
  ref: string;
  designation: string;
  requiredQty: number;
  availableStock: number;
  shortageQty: number;
  status: 'RUPTURE' | 'INSUFFISANT' | 'NON_REFERENCE';
  impactedTaskCount: number;
  impactedMachines: string[];
}

export interface PreventiveAnalyticsReport {
  today: string;
  overview: {
    totalTasks: number;
    doneCount: number;
    todoCount: number;
    overdueCount: number;
    pendingValidationCount: number;
    clarificationCount: number;
    dynamicComplianceRate: number;
  };
  punctuality: {
    approvedExecutionsCount: number;
    pendingExecutionsCount: number;
    clarificationExecutionsCount: number;
    rejectedExecutionsCount: number;
    evaluatedCount: number;
    onTimeCount: number;
    lateCount: number;
    onTimeComplianceRate: number | null;
    avgDelayDays: number;
  };
  costs: {
    totalLaborCost: number;
    totalSparesCost: number;
    totalCost: number;
    totalDurationMinutes: number;
    laborSharePct: number;
    sparesSharePct: number;
  };
  pmCmBalance: {
    pmCount: number;
    cmCount: number;
    pmRatioPct: number | null;
  };
  zonesStats: ZoneHealthStat[];
  actionsStats: ActionCostStat[];
  machineRiskStats: MachineRiskStat[];
  pdrReadinessRisks: UpcomingPdrRiskItem[];
  evaluatedTasks: Array<{ task: any; cycle: TaskCycleEvaluation }>;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function parseIsoDateUtc(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const clean = String(dateStr).trim().slice(0, 10);
  if (!ISO_DATE_RE.test(clean)) return null;
  const [y, m, d] = clean.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  return Number.isFinite(utc) ? utc : null;
}

export function isApprovedPreventiveExecution(
  exec: PreventiveExecutionRecord | null | undefined
): boolean {
  if (!exec) return false;
  const valStatus = String(exec.validation_status || 'APPROVED').trim().toUpperCase();
  if (
    valStatus === 'PENDING_VALIDATION' ||
    valStatus === 'NEEDS_CLARIFICATION' ||
    valStatus === 'REJECTED'
  ) {
    return false;
  }
  return String(exec.status || 'DONE').trim().toUpperCase() !== 'SKIPPED';
}

export function computeExecutionDelayDays(
  exec: PreventiveExecutionRecord | null | undefined
): number | null {
  if (!exec) return null;
  const dueMs = parseIsoDateUtc(exec.scheduledDueDate);
  const execMs = parseIsoDateUtc(exec.executedAt);
  if (dueMs === null || execMs === null) return null;
  return Math.round((execMs - dueMs) / 86_400_000);
}

export function buildMachineMeterMap(machines: any[] = []): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(machines)) return map;
  for (const m of machines) {
    if (!m) continue;
    const rawVal = m.compteur_heures ?? m.compteur_actuel ?? m.heures_marche;
    const numeric = Number(rawVal);
    if (!Number.isFinite(numeric) || numeric < 0) continue;
    const keys = [m.id_machine_registered, m.code_machine, m.code, m.id_machine, m.id]
      .filter((k) => typeof k === 'string' && k.trim().length > 0)
      .map((k) => String(k).trim().toUpperCase());
    for (const k of keys) {
      map.set(k, numeric);
    }
  }
  return map;
}

export function getMachineCurrentMeter(
  machineCode: string | undefined | null,
  machineMeterMap: Map<string, number>
): number | undefined {
  if (!machineCode) return undefined;
  const key = String(machineCode).trim().toUpperCase();
  return machineMeterMap.has(key) ? machineMeterMap.get(key) : undefined;
}

function buildLiveStockMap(
  stockItems: any[] = [],
  mouvements: any[] = []
): Map<string, { ref: string; designation: string; stockActuel: number }> {
  const map = new Map<string, { ref: string; designation: string; stockActuel: number }>();
  if (!Array.isArray(stockItems) || stockItems.length === 0) return map;

  const hasMovementsOrInitial =
    (Array.isArray(mouvements) && mouvements.length > 0) ||
    stockItems.some((s) => s && (s.stockInitial !== undefined || s.stock_initial !== undefined));

  if (hasMovementsOrInitial) {
    const calculated = StockCalculationService.calculateAllStocks(stockItems, mouvements || []);
    for (const item of calculated) {
      const key = String(item.ref || '').trim().toUpperCase();
      if (!key) continue;
      map.set(key, {
        ref: item.ref,
        designation: item.designation || item.ref,
        stockActuel: Math.max(0, Number(item.stockActuel || 0)),
      });
    }
    return map;
  }

  for (const item of stockItems) {
    if (!item) continue;
    const ref = String(item.ref || item.reference || '').trim();
    const key = ref.toUpperCase();
    if (!key) continue;
    map.set(key, {
      ref,
      designation: String(item.designation || item.nom || ref),
      stockActuel: Math.max(0, Number(item.stockActuel ?? item.stock_actuel ?? 0)),
    });
  }
  return map;
}

export function computePreventiveAnalytics(
  input: PreventiveAnalyticsInput
): PreventiveAnalyticsReport {
  const today = input.today || getTodayIso();
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const executions = Array.isArray(input.executions) ? input.executions : [];
  const machines = Array.isArray(input.machines) ? input.machines : [];
  const stockItems = Array.isArray(input.stockItems) ? input.stockItems : [];
  const mouvements = Array.isArray(input.mouvements) ? input.mouvements : [];
  const correctiveInterventions = Array.isArray(input.correctiveInterventions)
    ? input.correctiveInterventions
    : [];
  const actions = Array.isArray(input.actions) ? input.actions : [];

  const machineMeterMap = buildMachineMeterMap(machines);
  const machineMetaMap = new Map<string, { name: string; zone: string }>();
  for (const m of machines) {
    if (!m) continue;
    const code = String(m.id_machine_registered || m.code_machine || m.id || '')
      .trim()
      .toUpperCase();
    if (!code) continue;
    machineMetaMap.set(code, {
      name: String(m.designation || m.nom_machine || m.nom || code),
      zone: String(m.id_zone_default || m.id_zone || m.zone || 'Non assignée'),
    });
  }

  // 1. Dynamic Task Cycle Evaluation
  let doneCount = 0;
  let todoCount = 0;
  let overdueCount = 0;
  let pendingValidationCount = 0;
  let clarificationCount = 0;

  const evaluatedTasks = tasks.map((task) => {
    const machineCurrentMeter = getMachineCurrentMeter(task?.id_machine, machineMeterMap);
    const cycle = computeTaskCycleStatus(task, { today, machineCurrentMeter });
    if (cycle.effectiveEtat === 'Fait') doneCount += 1;
    else if (cycle.effectiveEtat === 'En retard') overdueCount += 1;
    else if (cycle.effectiveEtat === 'En attente validation') pendingValidationCount += 1;
    else if (cycle.effectiveEtat === 'À clarifier') clarificationCount += 1;
    else todoCount += 1;
    return { task, cycle };
  });

  const totalTasks = tasks.length;
  const dynamicComplianceRate =
    totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  // 2. Execution Punctuality (OTCR) & Realized Costs (Strictly from APPROVED executions)
  const taskIdSet = new Set(tasks.map((t) => String(t?.id || '')).filter(Boolean));
  const taskMachineSet = new Set(
    tasks.map((t) => String(t?.id_machine || '').trim().toUpperCase()).filter(Boolean)
  );
  const relevantExecutions =
    tasks.length > 0
      ? executions.filter((ex) => {
          if (ex.taskId && taskIdSet.has(String(ex.taskId))) return true;
          const mach = String(ex.machineCode || '').trim().toUpperCase();
          return Boolean(mach && taskMachineSet.has(mach));
        })
      : executions;

  let approvedExecutionsCount = 0;
  let pendingExecutionsCount = 0;
  let clarificationExecutionsCount = 0;
  let rejectedExecutionsCount = 0;
  let evaluatedCount = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let totalPositiveDelayDays = 0;

  let totalLaborCost = 0;
  let totalSparesCost = 0;
  let totalCost = 0;
  let totalDurationMinutes = 0;

  const actionExecAgg = new Map<
    string,
    { count: number; laborCost: number; sparesCost: number; totalCost: number }
  >();
  const machineExecAgg = new Map<
    string,
    { count: number; laborCost: number; sparesCost: number; totalCost: number }
  >();

  for (const ex of relevantExecutions) {
    const valStatus = String(ex.validation_status || 'APPROVED').trim().toUpperCase();
    if (valStatus === 'PENDING_VALIDATION') {
      pendingExecutionsCount += 1;
      continue;
    }
    if (valStatus === 'NEEDS_CLARIFICATION') {
      clarificationExecutionsCount += 1;
      continue;
    }
    if (valStatus === 'REJECTED') {
      rejectedExecutionsCount += 1;
      continue;
    }
    if (String(ex.status || 'DONE').trim().toUpperCase() === 'SKIPPED') {
      continue;
    }

    approvedExecutionsCount += 1;

    const delay = computeExecutionDelayDays(ex);
    if (delay !== null) {
      evaluatedCount += 1;
      if (delay <= 0) {
        onTimeCount += 1;
      } else {
        lateCount += 1;
        totalPositiveDelayDays += delay;
      }
    }

    const sparesCost = Math.max(0, Number(ex.sparesCost || 0));
    const rawTotal = Math.max(0, Number(ex.totalCost || 0));
    const explicitLabor =
      ex.laborCost !== undefined && ex.laborCost !== null
        ? Math.max(0, Number(ex.laborCost))
        : Math.max(0, rawTotal - sparesCost);
    const effectiveTotal = rawTotal > 0 ? rawTotal : explicitLabor + sparesCost;

    totalLaborCost += explicitLabor;
    totalSparesCost += sparesCost;
    totalCost += effectiveTotal;
    totalDurationMinutes += Math.max(0, Number(ex.durationMinutes || 0));

    const actCode = String(ex.actionCode || 'C').trim().toUpperCase();
    const actEntry = actionExecAgg.get(actCode) || {
      count: 0,
      laborCost: 0,
      sparesCost: 0,
      totalCost: 0,
    };
    actEntry.count += 1;
    actEntry.laborCost += explicitLabor;
    actEntry.sparesCost += sparesCost;
    actEntry.totalCost += effectiveTotal;
    actionExecAgg.set(actCode, actEntry);

    const machCode = String(ex.machineCode || '').trim().toUpperCase();
    if (machCode) {
      const mEntry = machineExecAgg.get(machCode) || {
        count: 0,
        laborCost: 0,
        sparesCost: 0,
        totalCost: 0,
      };
      mEntry.count += 1;
      mEntry.laborCost += explicitLabor;
      mEntry.sparesCost += sparesCost;
      mEntry.totalCost += effectiveTotal;
      machineExecAgg.set(machCode, mEntry);
    }
  }

  const onTimeComplianceRate =
    evaluatedCount > 0 ? Math.round((onTimeCount / evaluatedCount) * 100) : null;
  const avgDelayDays =
    lateCount > 0 ? round2(totalPositiveDelayDays / lateCount) : 0;

  const laborSharePct = totalCost > 0 ? Math.round((totalLaborCost / totalCost) * 100) : 0;
  const sparesSharePct = totalCost > 0 ? Math.round((totalSparesCost / totalCost) * 100) : 0;

  // 3. PM vs CM Balance Ratio
  const activeCmCount = correctiveInterventions.filter((ci) => {
    if (!ci) return false;
    const st = String(ci.statut || ci.status || '').trim().toUpperCase();
    if (st === 'ANNULEE' || st === 'ANNULÉE' || st === 'CANCELLED') return false;
    if (taskMachineSet.size > 0 && tasks.length > 0) {
      const cmMach = String(ci.id_machine || ci.code_machine || ci.machine || '')
        .trim()
        .toUpperCase();
      if (cmMach && !taskMachineSet.has(cmMach)) return false;
    }
    return true;
  }).length;
  const pmCmTotal = approvedExecutionsCount + activeCmCount;
  const pmRatioPct =
    pmCmTotal > 0 ? Math.round((approvedExecutionsCount / pmCmTotal) * 100) : null;

  // 4. Zone Health Breakdown
  const zoneMap = new Map<
    string,
    { total: number; done: number; todo: number; overdue: number; pending: number }
  >();
  for (const { task, cycle } of evaluatedTasks) {
    const machCode = String(task?.id_machine || '').trim().toUpperCase();
    const zoneName =
      machineMetaMap.get(machCode)?.zone ||
      String(task?.id_zone || 'Non assignée').trim() ||
      'Non assignée';
    const entry = zoneMap.get(zoneName) || {
      total: 0,
      done: 0,
      todo: 0,
      overdue: 0,
      pending: 0,
    };
    entry.total += 1;
    if (cycle.effectiveEtat === 'Fait') entry.done += 1;
    else if (cycle.effectiveEtat === 'En retard') entry.overdue += 1;
    else if (
      cycle.effectiveEtat === 'En attente validation' ||
      cycle.effectiveEtat === 'À clarifier'
    ) {
      entry.pending += 1;
    } else {
      entry.todo += 1;
    }
    zoneMap.set(zoneName, entry);
  }

  const zonesStats: ZoneHealthStat[] = Array.from(zoneMap.entries())
    .map(([zone, st]) => ({
      zone,
      total: st.total,
      done: st.done,
      todo: st.todo,
      overdue: st.overdue,
      pending: st.pending,
      complianceRate: st.total > 0 ? Math.round((st.done / st.total) * 100) : 0,
    }))
    .sort((a, b) => b.overdue - a.overdue || b.total - a.total);

  // 5. Action Family Cost Breakdown
  const actionLabelMap = new Map<string, string>();
  for (const act of actions) {
    if (act?.code) {
      actionLabelMap.set(String(act.code).trim().toUpperCase(), act.libelle || act.code);
    }
  }
  const actionTaskCounts = new Map<string, number>();
  for (const task of tasks) {
    const code = String(task?.action_code || 'C').trim().toUpperCase();
    actionTaskCounts.set(code, (actionTaskCounts.get(code) || 0) + 1);
  }
  const allActionCodes = new Set<string>([
    ...actionTaskCounts.keys(),
    ...actionExecAgg.keys(),
  ]);
  const actionsStats: ActionCostStat[] = Array.from(allActionCodes)
    .map((code) => {
      const exAgg = actionExecAgg.get(code) || {
        count: 0,
        laborCost: 0,
        sparesCost: 0,
        totalCost: 0,
      };
      return {
        code,
        libelle: actionLabelMap.get(code) || code,
        taskCount: actionTaskCounts.get(code) || 0,
        approvedExecCount: exAgg.count,
        laborCost: round2(exAgg.laborCost),
        sparesCost: round2(exAgg.sparesCost),
        totalCost: round2(exAgg.totalCost),
        sharePct: totalCost > 0 ? Math.round((exAgg.totalCost / totalCost) * 100) : 0,
      };
    })
    .filter((a) => a.taskCount > 0 || a.approvedExecCount > 0)
    .sort((a, b) => b.totalCost - a.totalCost || b.taskCount - a.taskCount);

  // 6. Top Risk Machines (Overdue & Cost)
  const machineAgg = new Map<
    string,
    {
      machineCode: string;
      machineName: string;
      zone: string;
      totalTasks: number;
      doneTasks: number;
      overdueTasks: number;
      pendingTasks: number;
    }
  >();

  for (const { task, cycle } of evaluatedTasks) {
    const code = String(task?.id_machine || '').trim().toUpperCase();
    if (!code) continue;
    const meta = machineMetaMap.get(code);
    const entry = machineAgg.get(code) || {
      machineCode: String(task?.id_machine || code),
      machineName: meta?.name || String(task?.nom_machine || code),
      zone: meta?.zone || String(task?.id_zone || 'Non assignée'),
      totalTasks: 0,
      doneTasks: 0,
      overdueTasks: 0,
      pendingTasks: 0,
    };
    entry.totalTasks += 1;
    if (cycle.effectiveEtat === 'Fait') entry.doneTasks += 1;
    else if (cycle.effectiveEtat === 'En retard') entry.overdueTasks += 1;
    else if (
      cycle.effectiveEtat === 'En attente validation' ||
      cycle.effectiveEtat === 'À clarifier'
    ) {
      entry.pendingTasks += 1;
    }
    machineAgg.set(code, entry);
  }

  const machineRiskStats: MachineRiskStat[] = Array.from(machineAgg.entries())
    .map(([code, m]) => {
      const exAgg = machineExecAgg.get(code) || {
        count: 0,
        laborCost: 0,
        sparesCost: 0,
        totalCost: 0,
      };
      return {
        ...m,
        approvedExecs: exAgg.count,
        laborCost: round2(exAgg.laborCost),
        sparesCost: round2(exAgg.sparesCost),
        totalCost: round2(exAgg.totalCost),
        complianceRate:
          m.totalTasks > 0 ? Math.round((m.doneTasks / m.totalTasks) * 100) : 0,
      };
    })
    .sort(
      (a, b) =>
        b.overdueTasks - a.overdueTasks ||
        b.totalCost - a.totalCost ||
        a.complianceRate - b.complianceRate
    );

  // 7. Upcoming PDR Stock Readiness / Rupture Risks
  const liveStockMap = buildLiveStockMap(stockItems, mouvements);
  const pdrDemandAgg = new Map<
    string,
    {
      ref: string;
      designation: string;
      requiredQty: number;
      impactedTaskCount: number;
      machines: Set<string>;
    }
  >();

  for (const { task, cycle } of evaluatedTasks) {
    // Only check parts needed for open / overdue / clarification tasks
    if (cycle.effectiveEtat === 'Fait' || cycle.effectiveEtat === 'En attente validation') {
      continue;
    }
    const explicitParts: Array<{ ref: string; designation: string; qty: number }> = [];
    if (Array.isArray(task?.pdr_requises) && task.pdr_requises.length > 0) {
      for (const p of task.pdr_requises) {
        const ref = String(p?.ref || p?.reference || p?.code || '').trim();
        if (!ref) continue;
        explicitParts.push({
          ref,
          designation: String(p?.designation || p?.nom || ref).trim(),
          qty: Math.max(1, Number(p?.quantite ?? p?.qty ?? 1) || 1),
        });
      }
    } else if (task?.pdr_ref && String(task.pdr_ref).trim()) {
      const ref = String(task.pdr_ref).trim();
      explicitParts.push({
        ref,
        designation: String(task.pdr_designation || ref).trim(),
        qty: Math.max(1, Number(task.pdr_quantite || 1) || 1),
      });
    }

    for (const part of explicitParts) {
      const key = part.ref.toUpperCase();
      const entry = pdrDemandAgg.get(key) || {
        ref: part.ref,
        designation: part.designation,
        requiredQty: 0,
        impactedTaskCount: 0,
        machines: new Set<string>(),
      };
      entry.requiredQty += part.qty;
      entry.impactedTaskCount += 1;
      if (task?.id_machine) {
        entry.machines.add(String(task.id_machine));
      }
      pdrDemandAgg.set(key, entry);
    }
  }

  const pdrReadinessRisks: UpcomingPdrRiskItem[] = [];
  for (const [key, demand] of pdrDemandAgg.entries()) {
    const stockMatch = liveStockMap.get(key);
    if (!stockMatch) {
      pdrReadinessRisks.push({
        ref: demand.ref,
        designation: demand.designation,
        requiredQty: demand.requiredQty,
        availableStock: 0,
        shortageQty: demand.requiredQty,
        status: 'NON_REFERENCE',
        impactedTaskCount: demand.impactedTaskCount,
        impactedMachines: Array.from(demand.machines).sort(),
      });
      continue;
    }

    if (stockMatch.stockActuel <= 0 || stockMatch.stockActuel < demand.requiredQty) {
      pdrReadinessRisks.push({
        ref: stockMatch.ref || demand.ref,
        designation: stockMatch.designation || demand.designation,
        requiredQty: demand.requiredQty,
        availableStock: stockMatch.stockActuel,
        shortageQty: Math.max(0, demand.requiredQty - stockMatch.stockActuel),
        status: stockMatch.stockActuel <= 0 ? 'RUPTURE' : 'INSUFFISANT',
        impactedTaskCount: demand.impactedTaskCount,
        impactedMachines: Array.from(demand.machines).sort(),
      });
    }
  }

  pdrReadinessRisks.sort(
    (a, b) => b.shortageQty - a.shortageQty || b.impactedTaskCount - a.impactedTaskCount
  );

  return {
    today,
    overview: {
      totalTasks,
      doneCount,
      todoCount,
      overdueCount,
      pendingValidationCount,
      clarificationCount,
      dynamicComplianceRate,
    },
    punctuality: {
      approvedExecutionsCount,
      pendingExecutionsCount,
      clarificationExecutionsCount,
      rejectedExecutionsCount,
      evaluatedCount,
      onTimeCount,
      lateCount,
      onTimeComplianceRate,
      avgDelayDays,
    },
    costs: {
      totalLaborCost: round2(totalLaborCost),
      totalSparesCost: round2(totalSparesCost),
      totalCost: round2(totalCost),
      totalDurationMinutes,
      laborSharePct,
      sparesSharePct,
    },
    pmCmBalance: {
      pmCount: approvedExecutionsCount,
      cmCount: activeCmCount,
      pmRatioPct,
    },
    zonesStats,
    actionsStats,
    machineRiskStats,
    pdrReadinessRisks,
    evaluatedTasks,
  };
}
