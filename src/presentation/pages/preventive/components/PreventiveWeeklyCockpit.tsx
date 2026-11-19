import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ChevronDown,
  ChevronUp,
  Gauge,
  User,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  computeTaskCycleStatus,
  resolvePreventiveLaborRate,
  type TaskCycleEvaluation,
} from '../../../../domain/preventive/preventiveScheduleEngine';
import type { IMachine, ITechnician } from '../../../../types/domain';
import type { PreventiveTaskItem } from '../../../../types/store';

export interface CockpitTaskEntry {
  task: PreventiveTaskItem & { _isOrphan?: boolean };
  cycle: TaskCycleEvaluation;
  machineDesignation: string;
  liveMeter: number | undefined;
  isOverdue: boolean;
  isScheduledThisWeek: boolean;
  hasRequiredPdr: boolean;
}

export interface WeeklyCockpitSummary {
  currentWeekKey: string;
  overdueTasks: CockpitTaskEntry[];
  thisWeekTodoTasks: CockpitTaskEntry[];
  thisWeekDoneTasks: CockpitTaskEntry[];
  priorityQueue: CockpitTaskEntry[];
  weeklyTotalCount: number;
  weeklyCompletionRate: number;
}

export function buildWeeklyCockpitSummary(
  tasks: Array<PreventiveTaskItem & { _isOrphan?: boolean }>,
  machines: IMachine[],
  currentWeekNumber: number,
  referenceDate?: Date
): WeeklyCockpitSummary {
  const safeWeek = Math.min(52, Math.max(1, Number(currentWeekNumber) || 1));
  const currentWeekKey = `S${safeWeek}`;

  const machineMap = new Map<string, IMachine>();
  for (const m of machines || []) {
    const id = String(m?.id_machine_registered || m?.id || m?.code || '').trim();
    if (id) {
      machineMap.set(id, m);
      machineMap.set(id.toUpperCase(), m);
    }
  }

  const overdueTasks: CockpitTaskEntry[] = [];
  const thisWeekTodoTasks: CockpitTaskEntry[] = [];
  const thisWeekDoneTasks: CockpitTaskEntry[] = [];

  const todayIso = referenceDate
    ? typeof referenceDate === 'string'
      ? referenceDate
      : referenceDate.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  for (const task of tasks || []) {
    if (!task || task._isOrphan) continue;
    const mId = String(task.id_machine || '').trim();
    const mach = machineMap.get(mId) || machineMap.get(mId.toUpperCase());
    if (mach && String(mach.status || '').toUpperCase() === 'ARCHIVEE') continue;

    const rawMeter = mach?.compteur_heures ?? (mach as any)?.compteur_actuel;
    const liveMeter =
      rawMeter !== undefined && rawMeter !== null && Number.isFinite(Number(rawMeter))
        ? Number(rawMeter)
        : undefined;

    const cycle = computeTaskCycleStatus(task, {
      today: todayIso,
      machineCurrentMeter: liveMeter,
    });

    const isScheduledThisWeek = Boolean(task.planning && task.planning[currentWeekKey]);
    const isApproachingTrigger = cycle.triggerReason !== 'NONE';
    const hasRequiredPdr =
      Array.isArray((task as any).pieces_requises) && (task as any).pieces_requises.length > 0;

    const entry: CockpitTaskEntry = {
      task,
      cycle,
      machineDesignation:
        mach?.designation || (mach as any)?.nom_machine || task.nom_machine || mId,
      liveMeter,
      isOverdue: cycle.effectiveEtat === 'En retard',
      isScheduledThisWeek,
      hasRequiredPdr,
    };

    if (cycle.effectiveEtat === 'En retard') {
      overdueTasks.push(entry);
    } else if (
      cycle.effectiveEtat === 'À faire' &&
      (isScheduledThisWeek || isApproachingTrigger)
    ) {
      thisWeekTodoTasks.push(entry);
    } else if (
      (cycle.effectiveEtat === 'Fait' || cycle.effectiveEtat === 'En attente validation') &&
      (isScheduledThisWeek || cycle.isDoneThisCycle)
    ) {
      thisWeekDoneTasks.push(entry);
    }
  }

  // Sort overdue tasks: counter overdue first, then highest overdueDays
  overdueTasks.sort((a, b) => {
    const aCounterOver =
      a.cycle.triggerReason === 'METER' || a.cycle.triggerReason === 'BOTH' ? 1 : 0;
    const bCounterOver =
      b.cycle.triggerReason === 'METER' || b.cycle.triggerReason === 'BOTH' ? 1 : 0;
    if (aCounterOver !== bCounterOver) return bCounterOver - aCounterOver;
    return (b.cycle.overdueDays || 0) - (a.cycle.overdueDays || 0);
  });

  // Sort thisWeekTodoTasks: scheduled in S{currentWeek} first
  thisWeekTodoTasks.sort((a, b) => {
    if (a.isScheduledThisWeek !== b.isScheduledThisWeek) {
      return a.isScheduledThisWeek ? -1 : 1;
    }
    return String(a.task.prochaine_echeance || '').localeCompare(
      String(b.task.prochaine_echeance || '')
    );
  });

  const priorityQueue = [...overdueTasks, ...thisWeekTodoTasks];
  const weeklyTotalCount =
    overdueTasks.length + thisWeekTodoTasks.length + thisWeekDoneTasks.length;
  const weeklyCompletionRate =
    weeklyTotalCount > 0
      ? Math.round((thisWeekDoneTasks.length / weeklyTotalCount) * 100)
      : 100;

  return {
    currentWeekKey,
    overdueTasks,
    thisWeekTodoTasks,
    thisWeekDoneTasks,
    priorityQueue,
    weeklyTotalCount,
    weeklyCompletionRate,
  };
}

interface PreventiveWeeklyCockpitProps {
  tasks: Array<PreventiveTaskItem & { _isOrphan?: boolean }>;
  machines: IMachine[];
  technicians: Array<ITechnician | string>;
  currentWeekNumber: number;
  isTechUser: boolean;
  techDisplayName: string;
  canExecutePreventive: boolean;
  onOpenValidate?: ((task: PreventiveTaskItem) => void) | null;
  onQuickValidateTask?: ((task: PreventiveTaskItem, overrideTechName?: string) => void) | null;
  onOpenRoundModal?: (() => void) | null;
  onFilterOverdue?: (() => void) | null;
  onFilterThisWeek?: (() => void) | null;
}

export default function PreventiveWeeklyCockpit({
  tasks = [],
  machines = [],
  technicians = [],
  currentWeekNumber,
  isTechUser,
  techDisplayName,
  canExecutePreventive,
  onOpenValidate = null,
  onQuickValidateTask = null,
  onOpenRoundModal = null,
  onFilterOverdue = null,
  onFilterThisWeek = null,
}: PreventiveWeeklyCockpitProps) {
  const summary = useMemo(
    () => buildWeeklyCockpitSummary(tasks, machines, currentWeekNumber),
    [tasks, machines, currentWeekNumber]
  );

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedQuickTech, setSelectedQuickTech] = useState<string>('');

  const activeTechnicians = useMemo(() => {
    const list: Array<{ name: string; rate: number }> = [];
    const seen = new Set<string>();
    for (const t of technicians || []) {
      let name = '';
      if (typeof t === 'string') {
        name = t.trim();
      } else if (t && typeof t === 'object') {
        if (
          t.is_active === false ||
          t.actif === false ||
          String(t.statut || '').toUpperCase() === 'ARCHIVE'
        ) {
          continue;
        }
        name = t.nom
          ? `${t.nom} ${t.prenom || ''}`.trim()
          : String((t as any).nom_technicien || (t as any).name || t.id_technician || '').trim();
      }
      if (name && !seen.has(name.toUpperCase())) {
        seen.add(name.toUpperCase());
        list.push({
          name,
          rate: resolvePreventiveLaborRate(technicians, name),
        });
      }
    }
    return list;
  }, [technicians]);

  if (tasks.length === 0) return null;

  const hasUrgentWork =
    summary.overdueTasks.length > 0 || summary.thisWeekTodoTasks.length > 0;
  const displayedQueue = summary.priorityQueue.slice(0, 6);

  return (
    <div
      data-testid="preventive-weekly-cockpit"
      className={`rounded-2xl border transition-all overflow-hidden shadow-xs ${
        summary.overdueTasks.length > 0
          ? 'bg-gradient-to-r from-rose-50/90 via-white to-amber-50/70 border-rose-200'
          : hasUrgentWork
          ? 'bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/60 border-indigo-200'
          : 'bg-emerald-50/60 border-emerald-200'
      }`}
    >
      {/* Top Cockpit Bar */}
      <div className="px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black font-mono text-xs shadow-2xs ${
              summary.overdueTasks.length > 0
                ? 'bg-rose-600 text-white'
                : hasUrgentWork
                ? 'bg-indigo-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {summary.currentWeekKey}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                Cockpit Aujourd&apos;hui & Semaine {summary.currentWeekKey}
              </span>

              {/* Badge 1: En retard */}
              <button
                type="button"
                onClick={() => onFilterOverdue?.()}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black border flex items-center gap-1 cursor-pointer transition ${
                  summary.overdueTasks.length > 0
                    ? 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="Filtrer les tâches en retard"
              >
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>{summary.overdueTasks.length} En retard</span>
              </button>

              {/* Badge 2: À faire cette semaine */}
              <button
                type="button"
                onClick={() => onFilterThisWeek?.()}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 hover:bg-indigo-200 flex items-center gap-1 cursor-pointer transition"
                title={`Filtrer les tâches de la semaine ${summary.currentWeekKey}`}
              >
                <Clock className="w-3 h-3 text-indigo-700" />
                <span>
                  {summary.thisWeekTodoTasks.length} À faire ({summary.currentWeekKey})
                </span>
              </button>

              {/* Badge 3: Réalisées ce cycle */}
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                <span>
                  {summary.thisWeekDoneTasks.length} Fait ({summary.weeklyCompletionRate}%)
                </span>
              </span>
            </div>

            <p className="text-[11px] text-slate-600 mt-0.5">
              {summary.overdueTasks.length > 0
                ? `Priorité atelier : ${summary.overdueTasks.length} retard(s) critique(s) et ${summary.thisWeekTodoTasks.length} tâche(s) prévues sur ${summary.currentWeekKey}.`
                : summary.thisWeekTodoTasks.length > 0
                ? `Aucun retard critique. ${summary.thisWeekTodoTasks.length} intervention(s) programmée(s) cette semaine (${summary.currentWeekKey}).`
                : `Toutes les opérations préventives de la semaine ${summary.currentWeekKey} sont à jour.`}
            </p>
          </div>
        </div>

        {/* Right Controls: Single-PC Multi-Role Technician Selector + Ronde Rapide + Expand Toggle */}
        <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
          {!isTechUser && canExecutePreventive && activeTechnicians.length > 0 && (
            <div
              className="flex items-center gap-1.5 bg-white/90 border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs"
              title="Mode PC Atelier Partagé : choisissez le technicien exécutant pour la validation 1-clic"
            >
              <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-[10.5px] font-bold text-slate-500 hidden sm:inline">
                Exécutant (PC Partagé) :
              </span>
              <select
                value={selectedQuickTech}
                onChange={(e) => setSelectedQuickTech(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
              >
                <option value="">Responsable assigné (auto)</option>
                {activeTechnicians.map((tech) => (
                  <option key={tech.name} value={tech.name}>
                    {tech.name} ({tech.rate} DH/h)
                  </option>
                ))}
              </select>
            </div>
          )}

          {canExecutePreventive && onOpenRoundModal && (
            <button
              type="button"
              onClick={onOpenRoundModal}
              className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-2xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
              title="Ouvrir la Ronde d'Inspection Groupée (Système Général ou Semaine en cours)"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Ronde Rapide ({summary.priorityQueue.length})</span>
            </button>
          )}

          {summary.priorityQueue.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="h-8 px-2.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <span>{isExpanded ? 'Réduire' : `Voir (${summary.priorityQueue.length})`}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Priority Action Cards */}
      {isExpanded && displayedQueue.length > 0 && (
        <div className="px-4 pb-3.5 pt-2 border-t border-slate-200/70 bg-white/60">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {displayedQueue.map((item) => {
              const { task, cycle, isOverdue, hasRequiredPdr, liveMeter } = item;
              const isCounterTriggered =
                task.type_declencheur === 'COMPTEUR' ||
                task.type_declencheur === 'HYBRIDE' ||
                Number(task.compteur_seuil_intervalle || 0) > 0;
              const executorLabel =
                (!isTechUser && selectedQuickTech) ||
                (isTechUser && techDisplayName) ||
                task.responsable ||
                'Technicien';

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                    isOverdue
                      ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
                      : 'bg-white border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono font-black text-[11px] shrink-0 ${
                            isOverdue
                              ? 'bg-rose-600 text-white'
                              : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                          }`}
                        >
                          {task.id_machine}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {task.composant || 'Contrôle Général'}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black shrink-0 ${
                          isOverdue
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {isOverdue ? 'EN RETARD' : summary.currentWeekKey}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 line-clamp-1">
                      <b className="text-slate-800">[{task.action_code || 'C'}]</b>{' '}
                      {task.type_intervention || task.consigne || 'Opération préventive'}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-slate-500 pt-0.5">
                      {isCounterTriggered ? (
                        <span className="inline-flex items-center gap-1 text-cyan-800 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded font-bold">
                          <Gauge className="w-3 h-3" />
                          {liveMeter ?? task.compteur_actuel ?? 0} /{' '}
                          {task.compteur_prochain_declenchement ?? '—'}{' '}
                          {task.compteur_unite || 'h'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                          <CalendarCheck className="w-3 h-3 text-indigo-600" />
                          Éch: {task.prochaine_echeance || summary.currentWeekKey}
                          {cycle.overdueDays > 0 ? ` (+${cycle.overdueDays}j)` : ''}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[140px]">
                        <User className="w-3 h-3 text-slate-500" />
                        {executorLabel}
                      </span>
                    </div>
                  </div>

                  {/* Fast Execution Buttons */}
                  {canExecutePreventive && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/70">
                      {!hasRequiredPdr && onQuickValidateTask ? (
                        <button
                          type="button"
                          onClick={() =>
                            onQuickValidateTask(
                              task,
                              !isTechUser && selectedQuickTech ? selectedQuickTech : undefined
                            )
                          }
                          className="flex-1 h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer transition shadow-2xs active:scale-95"
                          title={`Valider immédiatement comme Conforme (Exécutant : ${executorLabel})`}
                        >
                          <Zap className="w-3 h-3" />
                          <span>Valider 1-Clic</span>
                        </button>
                      ) : null}

                      {onOpenValidate && (
                        <button
                          type="button"
                          onClick={() => onOpenValidate(task)}
                          className={`${
                            !hasRequiredPdr && onQuickValidateTask ? 'px-2.5' : 'flex-1'
                          } h-7 rounded-lg bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition`}
                          title="Ouvrir la fiche complète (pièces PDR, compteur, observations)"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>{hasRequiredPdr ? 'Valider avec PDR' : 'Détails / PDR'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
