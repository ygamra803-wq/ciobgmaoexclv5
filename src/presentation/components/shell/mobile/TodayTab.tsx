import { useState } from 'react';
import {
  Calendar,
  Wrench,
  QrCode,
  AlertTriangle,
  ArrowRight,
  Plus,
  Play,
  Send,
  CheckCircle2,
  Clock,
  Cpu,
} from 'lucide-react';

interface TodayTabProps {
  techScope: any;
  activeMachines: any[];
  activeLiveInterventionId?: string | null;
  onOpenQrScanner: () => void;
  onOpenMachineQrModal?: (machineId: string) => void;
  onNavigateToPreventive: (filter?: 'TODO' | 'OVERDUE' | 'CLARIFY' | 'PENDING' | 'DONE' | 'ALL', taskToExecute?: any) => void;
  onNavigateToCorrective: (
    filter?: 'ACTIVE' | 'CLARIFY' | 'PENDING' | 'ALL',
    options?: { openNewDi?: boolean; btToSubmit?: any }
  ) => void;
  onStartLiveIntervention: (id: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

export default function TodayTab({
  techScope,
  activeMachines = [],
  activeLiveInterventionId,
  onOpenQrScanner,
  onOpenMachineQrModal,
  onNavigateToPreventive,
  onNavigateToCorrective,
  onStartLiveIntervention,
  showToast,
}: TodayTabProps) {
  const [selectedQuickMachine, setSelectedQuickMachine] = useState('');

  const overdueTasks = techScope?.overdueTasks || [];
  const thisWeekTasks = techScope?.thisWeekTasks || [];
  const todoTasks = techScope?.todoTasks || [];
  const needsClarificationPrev = techScope?.needsClarificationPreventive || [];
  const pendingValidationPrev = techScope?.pendingValidationPreventive || [];

  const openCorrective = techScope?.openCorrective || [];
  const liveCorrective = techScope?.liveCorrective || [];
  const needsClarificationCorr = techScope?.needsClarificationCorrective || [];
  const pendingValidationCorr = techScope?.pendingValidationCorrective || [];

  const totalClarifyCount = needsClarificationPrev.length + needsClarificationCorr.length;
  const totalTodoPreventive = overdueTasks.length + todoTasks.length;

  const priorityPrevList = [...overdueTasks, ...thisWeekTasks, ...todoTasks]
    .filter((task, idx, arr) => arr.findIndex((t) => String(t.id) === String(task.id)) === idx)
    .slice(0, 4);

  return (
    <div data-testid="mobile-tab-today" className="space-y-4">
      {/* 1. HIGH-PRIORITY CLARIFICATION BANNER (Maker-Checker Feedback Loop) */}
      {totalClarifyCount > 0 && (
        <div
          data-testid="today-clarification-alert"
          className="bg-rose-950 text-white rounded-2xl p-4 border border-rose-700 shadow-md space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-rose-200">
                  À clarifier ({totalClarifyCount})
                </div>
                <div className="text-[11px] text-rose-100/90">
                  Le responsable a demandé une précision sur vos rapports
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {needsClarificationPrev.map((task: any) => (
              <div
                key={`clarify-prev-${task.id}`}
                className="p-3 rounded-xl bg-rose-900/70 border border-rose-700/80 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-mono text-[9px] font-bold">
                      PRÉVENTIF
                    </span>
                    <span className="font-mono text-xs font-black text-white">
                      {task.id_machine || task.machine}
                    </span>
                  </div>
                  <div className="text-xs text-rose-100 truncate">
                    {task.tache || task.intitule || task.organe || 'Inspection préventive'}
                  </div>
                  {task.validation_note && (
                    <div className="text-[11px] text-amber-200 font-medium">
                      Note : « {task.validation_note} »
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToPreventive('CLARIFY', task)}
                  className="px-3 py-2 rounded-xl bg-white text-rose-950 font-black text-xs shrink-0 cursor-pointer"
                >
                  Corriger
                </button>
              </div>
            ))}

            {needsClarificationCorr.map((bt: any) => (
              <div
                key={`clarify-corr-${bt.id}`}
                className="p-3 rounded-xl bg-rose-900/70 border border-rose-700/80 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 font-mono text-[9px] font-bold">
                      {bt.num_bt || 'BT'}
                    </span>
                    <span className="font-mono text-xs font-black text-white">
                      {bt.code_machine || bt.id_machine_registered}
                    </span>
                  </div>
                  <div className="text-xs text-rose-100 truncate">
                    {bt.anomalie || bt.travail_a_faire || 'Intervention corrective'}
                  </div>
                  {bt.validation_note && (
                    <div className="text-[11px] text-amber-200 font-medium">
                      Note : « {bt.validation_note} »
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToCorrective('CLARIFY', { btToSubmit: bt })}
                  className="px-3 py-2 rounded-xl bg-white text-rose-950 font-black text-xs shrink-0 cursor-pointer"
                >
                  Corriger
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. HERO SUMMARY & FIELD QR / FICHE TERRAIN ACCESS */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Semaine {techScope?.currentWeekKey || 'Actuelle'}
            </span>
            <h2 className="text-base font-black text-slate-900 mt-1">
              Ma Journée de Terrain
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenQrScanner}
            data-testid="today-scan-qr-btn"
            className="px-3.5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 text-xs font-bold shadow-xs cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Scanner QR</span>
          </button>
        </div>

        {/* 2x2 Big Touch Summary Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateToPreventive(overdueTasks.length > 0 ? 'OVERDUE' : 'TODO')}
            className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-left space-y-1 transition active:scale-98 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-indigo-900">
                Préventif à faire
              </span>
              <Calendar className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black font-mono text-indigo-950">
              {totalTodoPreventive}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
              {overdueTasks.length > 0 ? (
                <span className="text-rose-700 font-bold">
                  {overdueTasks.length} en retard
                </span>
              ) : (
                <span className="text-indigo-700">
                  {thisWeekTasks.length} cette sem.
                </span>
              )}
              {pendingValidationPrev.length > 0 && (
                <span className="text-purple-700">
                  • {pendingValidationPrev.length} att. val.
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToCorrective('ACTIVE')}
            className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-left space-y-1 transition active:scale-98 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-amber-900">
                Correctif Ouvert
              </span>
              <Wrench className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-950">
              {openCorrective.length}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono text-amber-800">
              <span>{liveCorrective.length} EN_COURS</span>
              {pendingValidationCorr.length > 0 && (
                <span className="text-purple-800 font-bold">
                  • {pendingValidationCorr.length} att. val.
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Quick Machine Fiche Terrain Access (Without needing camera) */}
        {onOpenMachineQrModal && activeMachines.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <select
                aria-label="Accès rapide Fiche Terrain Machine"
                value={selectedQuickMachine}
                onChange={(e) => setSelectedQuickMachine(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800"
              >
                <option value="">Fiche Terrain rapide (?machine_qr)...</option>
                {activeMachines.map((m: any) => {
                  const code = m.id_machine_registered || m.id || m.code;
                  const label = m.designation || m.nom || code;
                  return (
                    <option key={code} value={code}>
                      {code} — {label}
                    </option>
                  );
                })}
              </select>
            </div>
            <button
              type="button"
              disabled={!selectedQuickMachine}
              onClick={() => {
                if (selectedQuickMachine) {
                  onOpenMachineQrModal(selectedQuickMachine);
                }
              }}
              className="px-3 py-2 rounded-xl bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Ouvrir</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. URGENCES PRÉVENTIVES (1-Tap Execution) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Préventif Prioritaire</span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigateToPreventive('TODO')}
            className="text-xs font-bold text-indigo-600 flex items-center gap-1 cursor-pointer"
          >
            <span>Tout voir ({totalTodoPreventive})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {priorityPrevList.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 text-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
            <div className="text-xs font-bold text-slate-700">
              Aucune tâche préventive en attente
            </div>
            <div className="text-[11px] text-slate-500">
              Toutes vos tâches assignées de la semaine sont à jour.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {priorityPrevList.map((task: any) => {
              const isOverdue = overdueTasks.some((o: any) => String(o.id) === String(task.id));
              const isThisWeek = thisWeekTasks.some((w: any) => String(w.id) === String(task.id));
              return (
                <div
                  key={task.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-black text-slate-900">
                        {task.id_machine || task.machine}
                      </span>
                      {isOverdue && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[9px] font-bold">
                          EN RETARD
                        </span>
                      )}
                      {!isOverdue && isThisWeek && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono text-[9px] font-bold">
                          CETTE SEMAINE
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {task.tache || task.intitule || task.organe || 'Inspection préventive'}
                    </div>
                    {task.prochaine_echeance && (
                      <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Échéance : {task.prochaine_echeance}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToPreventive('TODO', task)}
                    className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
                  >
                    Valider
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. BONS DE TRAVAIL (BT) ACTIFS & DÉCLARATION RAPIDE DI */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-amber-600" />
            <span>Bons de Travail (BT) en cours</span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigateToCorrective('ACTIVE', { openNewDi: true })}
            data-testid="today-new-di-btn"
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle DI</span>
          </button>
        </div>

        {openCorrective.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 text-center space-y-1">
            <div className="text-xs font-bold text-slate-700">
              Aucun Bon de Travail (BT) actif
            </div>
            <div className="text-[11px] text-slate-500">
              Utilisez « Nouvelle DI » pour signaler une panne sur le terrain.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {openCorrective.slice(0, 4).map((bt: any) => {
              const status = String(bt.statut || 'DEMANDE').toUpperCase();
              const isLive =
                status === 'EN_COURS' ||
                (activeLiveInterventionId && String(activeLiveInterventionId) === String(bt.id));
              return (
                <div
                  key={bt.id}
                  className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-black text-slate-900">
                        {bt.code_machine || bt.id_machine_registered}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[9px] font-bold">
                        {bt.num_bt || status}
                      </span>
                      {isLive && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[9px] font-black">
                          EN_COURS
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {bt.anomalie || bt.travail_a_faire || 'Anomalie signalée'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(status === 'DEMANDE' || status === 'BT_PLANIFIE') && (
                      <button
                        type="button"
                        onClick={() => {
                          onStartLiveIntervention(bt.id);
                          showToast?.('Intervention démarrée (EN_COURS).', 'info');
                        }}
                        className="px-2.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Démarrer Live"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigateToCorrective('ACTIVE', { btToSubmit: bt })}
                      className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Rapport</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
