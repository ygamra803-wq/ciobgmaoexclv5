/**
 * Pure Domain Engine for Preventive Maintenance Scheduling, Recurring Cycle Evaluation,
 * Labor Costing, and Safe CSV Serialization (GMAO / CMMS).
 *
 * Keeps recurring calendar + meter lifecycle rules deterministic and side-effect free
 * so UI views, services, and store slices share a single source of truth.
 */

import type { IMachine, ITechnician } from '../../types/domain';
import type { PreventiveExecutionRecord } from '../../types/preventive';
import { MeterService } from '../../application/services/meter/MeterService';

export type EffectiveTaskEtat =
  | 'En attente validation'
  | 'À clarifier'
  | 'Rejeté'
  | 'En retard'
  | 'À faire'
  | 'Fait';

export interface TaskCycleEvaluation {
  effectiveEtat: EffectiveTaskEtat;
  isDueThisCycle: boolean;
  isOverdue: boolean;
  overdueDays: number;
  isDoneThisCycle: boolean;
  triggerReason: 'CALENDAR' | 'METER' | 'BOTH' | 'NONE';
}

export const DEFAULT_PREVENTIVE_LABOR_RATE_MAD = 35;

/**
 * Returns the canonical interval in days for a preventive frequency label.
 */
export function resolveFrequencyDays(frequence?: string): number {
  const f = String(frequence || 'Mensuel').trim().toLowerCase();
  if (f.includes('jour') || f.includes('quotid') || f === '1j') return 1;
  if ((f.includes('bi') && f.includes('hebdo')) || f.includes('bimensuel') || f === '14j' || f === '2s') return 14;
  if (f.includes('hebdo') || f === '7j' || f === '1s') return 7;
  if (f.includes('trimestr') || f === '3m' || f === '90j') return 90;
  if (f.includes('semestr') || f === '6m' || f === '180j') return 180;
  if (f.includes('annuel') || f === '1a' || f === '12m' || f === '365j') return 365;
  return 30;
}

/**
 * Number of days before `prochaine_echeance` when a previously-completed recurring task
 * automatically re-opens to `'À faire'` for its next scheduled cycle.
 */
export function computeFrequencyLeadDays(frequence?: string): number {
  const days = resolveFrequencyDays(frequence);
  if (days <= 1) return 0;
  if (days <= 7) return 2;
  if (days <= 14) return 3;
  if (days <= 31) return 7;
  if (days <= 95) return 10;
  if (days <= 185) return 14;
  return 21;
}

function toUtcDayMs(dateStr?: string | null): number | null {
  const clean = String(dateStr || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const parsed = Date.parse(`${clean}T00:00:00Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

function addDaysUtc(dateStr: string, days: number): string {
  const ms = toUtcDayMs(dateStr);
  if (ms === null) return dateStr;
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Computes the next scheduled due date honoring FIXE vs GLISSANT recurrence mode:
 * - GLISSANT (default): advances from the actual execution date.
 * - FIXE: advances from the scheduled due date in fixed increments until strictly after execution date.
 */
export function computeNextDueDateForMode(
  dateRealisation: string,
  frequence?: string,
  modeCalcul?: string,
  previousDueDate?: string
): string {
  const execStr = String(dateRealisation || '').trim().slice(0, 10);
  const execMs = toUtcDayMs(execStr);
  if (execMs === null) return dateRealisation;

  const stepDays = resolveFrequencyDays(frequence);
  const mode = String(modeCalcul || 'GLISSANT').trim().toUpperCase();

  if (mode === 'FIXE' && previousDueDate) {
    const prevStr = String(previousDueDate).trim().slice(0, 10);
    let candidateMs = toUtcDayMs(prevStr);
    if (candidateMs !== null) {
      let candidateStr = prevStr;
      let guard = 0;
      while (candidateMs <= execMs && guard < 1000) {
        candidateStr = addDaysUtc(candidateStr, stepDays);
        candidateMs = toUtcDayMs(candidateStr) ?? execMs + stepDays * 86400000;
        guard += 1;
      }
      return candidateStr;
    }
  }

  return addDaysUtc(execStr, stepDays);
}

/**
 * Evaluates a preventive task's effective cycle status dynamically against today's date
 * and the machine's live operating counter, solving the permanent "One-Shot Fait" freeze.
 */
export function computeTaskCycleStatus(
  task: Record<string, any> | null | undefined,
  options: {
    today?: string;
    machineCurrentMeter?: number;
  } = {}
): TaskCycleEvaluation {
  const rawEtat = String(task?.etat || 'À faire').trim();
  const valStatus = String(task?.validation_status || '').trim().toUpperCase();

  if (valStatus === 'PENDING_VALIDATION' || rawEtat === 'En attente validation') {
    return {
      effectiveEtat: 'En attente validation',
      isDueThisCycle: true,
      isOverdue: false,
      overdueDays: 0,
      isDoneThisCycle: false,
      triggerReason: 'NONE',
    };
  }
  if (valStatus === 'NEEDS_CLARIFICATION' || rawEtat === 'À clarifier') {
    return {
      effectiveEtat: 'À clarifier',
      isDueThisCycle: true,
      isOverdue: false,
      overdueDays: 0,
      isDoneThisCycle: false,
      triggerReason: 'NONE',
    };
  }
  if (valStatus === 'REJECTED' || rawEtat === 'Rejeté') {
    return {
      effectiveEtat: 'Rejeté',
      isDueThisCycle: true,
      isOverdue: false,
      overdueDays: 0,
      isDoneThisCycle: false,
      triggerReason: 'NONE',
    };
  }

  const todayStr = (options.today || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const todayMs = toUtcDayMs(todayStr) ?? Date.now();

  const triggerType = String(task?.type_declencheur || 'CALENDRIER').trim().toUpperCase();
  const isCounterOnly = triggerType === 'COMPTEUR';
  const isCounterBased =
    triggerType === 'COMPTEUR' ||
    triggerType === 'HYBRIDE' ||
    Number(task?.compteur_seuil_intervalle || 0) > 0;

  let meterOverdue = false;
  let meterWarning = false;
  if (isCounterBased) {
    const evalMeter = MeterService.evaluateTaskTrigger(task || {}, options.machineCurrentMeter);
    meterOverdue = evalMeter.isOverdue;
    meterWarning = evalMeter.isWarning;
  }

  let calendarOverdue = false;
  let calendarDueWindow = false;
  let overdueDays = 0;

  if (!isCounterOnly) {
    const dueStr = String(
      task?.prochaine_echeance || task?.nextDueDate || task?.date_echeance || ''
    )
      .trim()
      .slice(0, 10);
    const dueMs = toUtcDayMs(dueStr);
    if (dueMs !== null) {
      const diffDays = Math.round((dueMs - todayMs) / 86400000);
      const leadDays = computeFrequencyLeadDays(task?.frequence || task?.periodicite);
      if (diffDays < 0) {
        calendarOverdue = true;
        overdueDays = Math.abs(diffDays);
      } else if (diffDays <= leadDays) {
        calendarDueWindow = true;
      }
    }
  }

  const isOverdue = meterOverdue || calendarOverdue;
  let triggerReason: TaskCycleEvaluation['triggerReason'] = 'NONE';
  if (meterOverdue && calendarOverdue) triggerReason = 'BOTH';
  else if (meterOverdue) triggerReason = 'METER';
  else if (calendarOverdue) triggerReason = 'CALENDAR';
  else if (meterWarning && calendarDueWindow) triggerReason = 'BOTH';
  else if (meterWarning) triggerReason = 'METER';
  else if (calendarDueWindow) triggerReason = 'CALENDAR';

  if (isOverdue) {
    return {
      effectiveEtat: 'En retard',
      isDueThisCycle: true,
      isOverdue: true,
      overdueDays,
      isDoneThisCycle: false,
      triggerReason,
    };
  }

  // If task was marked Fait, check if it has entered the next due/warning window
  const storedIsFait = rawEtat.toLowerCase() === 'fait';
  if (storedIsFait) {
    const lastDoneStr = String(
      task?.derniere_realisation || task?.lastExecutedAt || task?.derniere_execution || ''
    )
      .trim()
      .slice(0, 10);
    const lastDoneMs = toUtcDayMs(lastDoneStr);
    // Keep 'Fait' if executed today (avoid immediate flip on Quotidien tasks completed today)
    const executedToday = lastDoneMs !== null && lastDoneMs >= todayMs;

    if (!executedToday && (meterWarning || calendarDueWindow)) {
      return {
        effectiveEtat: 'À faire',
        isDueThisCycle: true,
        isOverdue: false,
        overdueDays: 0,
        isDoneThisCycle: false,
        triggerReason,
      };
    }

    return {
      effectiveEtat: 'Fait',
      isDueThisCycle: false,
      isOverdue: false,
      overdueDays: 0,
      isDoneThisCycle: true,
      triggerReason: 'NONE',
    };
  }

  return {
    effectiveEtat: 'À faire',
    isDueThisCycle: true,
    isOverdue: false,
    overdueDays: 0,
    isDoneThisCycle: false,
    triggerReason,
  };
}

/**
 * Refreshes an array of preventive tasks so recurring tasks whose next cycle or meter threshold
 * has arrived automatically re-open from `'Fait'` to `'À faire'` or `'En retard'`.
 */
export function refreshRecurringTasksState<T extends Record<string, any>>(
  tasks: T[],
  machines: Array<Partial<IMachine> & Record<string, any>> = [],
  todayStr?: string
): T[] {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  const machineMeterMap = new Map<string, number>();
  for (const m of machines || []) {
    const code = String(m?.id_machine_registered || m?.code || m?.id || '')
      .trim()
      .toUpperCase();
    if (!code) continue;
    const meter = Number(m?.compteur_heures ?? m?.dernier_releve_compteur ?? 0);
    if (Number.isFinite(meter) && meter >= 0) {
      machineMeterMap.set(code, meter);
    }
  }

  return tasks.map((task) => {
    if (!task) return task;
    const mCode = String(task.id_machine || task.machine || '')
      .trim()
      .toUpperCase();
    const machineMeter = mCode && machineMeterMap.has(mCode) ? machineMeterMap.get(mCode) : undefined;
    const evalRes = computeTaskCycleStatus(task, {
      today: todayStr,
      machineCurrentMeter: machineMeter,
    });
    if (evalRes.effectiveEtat === task.etat) return task;
    return {
      ...task,
      etat: evalRes.effectiveEtat,
    };
  });
}

/**
 * Checks whether a specific task has an APPROVED (non-skipped) execution recorded
 * for a given date (YYYY-MM-DD) or ISO week / month period.
 */
export function hasApprovedExecutionInPeriod(
  taskId: string | number,
  targetDateStr: string,
  targetWeekKey: string,
  executions: PreventiveExecutionRecord[] = []
): boolean {
  const cleanTaskId = String(taskId || '').trim();
  if (!cleanTaskId || !Array.isArray(executions) || executions.length === 0) return false;
  const targetDay = String(targetDateStr || '').trim().slice(0, 10);
  const targetMonth = targetDay.slice(0, 7);
  const targetWeek = String(targetWeekKey || '').trim().toUpperCase();

  return executions.some((ex) => {
    if (!ex || String(ex.taskId || '').trim() !== cleanTaskId) return false;
    const valStatus = String(ex.validation_status || 'APPROVED').trim().toUpperCase();
    if (valStatus !== 'APPROVED' && valStatus !== 'NONE' && valStatus !== '') return false;
    if (ex.status === 'SKIPPED') return false;

    const exDate = String(ex.executedAt || '').trim().slice(0, 10);
    if (targetDay && exDate === targetDay) return true;
    const exMonth = String(ex.periodMonth || exDate.slice(0, 7)).trim();
    const exWeek = String(ex.periodWeek || '').trim().toUpperCase();
    if (targetWeek && exWeek === targetWeek && (!targetMonth || !exMonth || exMonth === targetMonth)) {
      return true;
    }
    return false;
  });
}

/**
 * Resolves the real hourly labor rate (MAD/h) from the registered `technicians` catalog.
 * Priority: explicit positive rate > matched technician `taux_horaire` > fallback default (35 MAD/h).
 */
export function resolvePreventiveLaborRate(
  technicians: Array<Partial<ITechnician> & Record<string, any>> = [],
  executorNameOrId?: unknown,
  explicitRate?: unknown,
  fallbackRate = DEFAULT_PREVENTIVE_LABOR_RATE_MAD
): number {
  const explicitNum = Number(explicitRate);
  if (Number.isFinite(explicitNum) && explicitNum > 0) {
    return explicitNum;
  }

  const key = String(executorNameOrId || '').trim().toUpperCase();
  if (key && Array.isArray(technicians) && technicians.length > 0) {
    const matched = technicians.find((t) => {
      if (!t) return false;
      const fullName = t.nom && t.prenom ? `${t.nom} ${t.prenom}`.trim() : undefined;
      const candidates = [
        t.id,
        t.id_technician,
        t.code,
        t.nom,
        t.prenom,
        fullName,
        t.nom_technicien,
        t.name,
        t.username,
      ]
        .filter(Boolean)
        .map((v) => String(v).trim().toUpperCase());
      return candidates.includes(key);
    });
    const techRate = Number(
      matched?.taux_horaire ?? matched?.tauxHoraire ?? matched?.hourly_rate ?? 0
    );
    if (Number.isFinite(techRate) && techRate > 0) {
      return techRate;
    }
  }

  return fallbackRate;
}

/**
 * Sanitizes any cell value before CSV export to neutralize spreadsheet formula injection
 * (`=`, `+`, `-`, `@`, `\t`, `\r` prefixes) and escape double quotes safely.
 */
export function sanitizeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const trimmedStart = raw.replace(/^[\s\uFEFF]+/, '');
  const needsPrefix = /^[=+\-@\t\r]/.test(trimmedStart);
  const safe = needsPrefix ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
