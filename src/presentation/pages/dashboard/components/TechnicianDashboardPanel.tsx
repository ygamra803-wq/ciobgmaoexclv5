import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Plus,
  Wrench,
} from 'lucide-react';
import SortieEntreeIcon from '../../../components/common/SortieEntreeIcon';
import type { buildTechnicianDashboardScope } from '../../../../core/security/technicianScope';

export type TechnicianDashboardScope = ReturnType<typeof buildTechnicianDashboardScope>;

export interface TechnicianDashboardPanelProps {
  techScope: TechnicianDashboardScope;
  correctiveInterventions: Array<{ statut?: string }>;
  onNavigateToPreventive?: () => void;
  onNavigateToCorrective?: (tabId?: string) => void;
  onNavigateToSortie?: () => void;
  t: (key: string) => string;
}

export function TechnicianDashboardPanel({
  techScope,
  correctiveInterventions,
  onNavigateToPreventive,
  onNavigateToCorrective,
  onNavigateToSortie,
  t,
}: TechnicianDashboardPanelProps) {
  return (
    <div className="space-y-6">
      {/* Technician Shift KPIs (4 Scoped Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Mes Tâches Préventives */}
        <div
          onClick={onNavigateToPreventive}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(79,70,229,0.12)] hover:-translate-y-1 hover:border-indigo-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                {t('dashboard.tech.myPreventiveTasks')}
              </span>
              <Calendar className="w-6 h-6 text-indigo-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-indigo-600 transition-colors">
                {techScope.overdueTasks.length + techScope.todoTasks.length}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">
                {t('dashboard.tech.toProcess')}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] font-mono border border-rose-200/80">
                {techScope.overdueTasks.length} {t('dashboard.tech.overdue')}
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px] font-mono border border-indigo-200/80">
                {techScope.thisWeekTasks.length} {t('dashboard.tech.weekShort')} {techScope.currentWeekKey}
              </span>
              {techScope.needsClarificationPreventive?.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[10px] font-mono border border-rose-200 animate-pulse">
                  {techScope.needsClarificationPreventive.length} {t('dashboard.tech.toClarify')}
                </span>
              )}
              {techScope.pendingValidationPreventive?.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px] font-mono border border-purple-200">
                  {techScope.pendingValidationPreventive.length} {t('dashboard.tech.pendingValidation')}
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">{t('dashboard.tech.totalAssigned')}</span>
            <span className="font-mono font-bold text-indigo-700">
              {techScope.myPreventiveTasks.length} {t('dashboard.tech.tasksCount')} ({techScope.doneTasks.length}{' '}
              {t('dashboard.tech.doneCount')})
            </span>
          </div>
        </div>

        {/* 2. Mes Ordres de Travail Correctifs Ouverts */}
        <div
          onClick={() => onNavigateToCorrective?.('corrective_bt')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(245,158,11,0.12)] hover:-translate-y-1 hover:border-amber-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                {t('dashboard.tech.myOpenInterventions')}
              </span>
              <Wrench className="w-6 h-6 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-amber-600 transition-colors">
                {techScope.openCorrective.length}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">
                {t('dashboard.tech.openUnit')}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] font-mono border border-emerald-200/80">
                {techScope.liveCorrective.length} {t('dashboard.tech.inProgress')}
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[10px] font-mono border border-blue-200/80">
                {techScope.plannedBtCorrective.length} {t('dashboard.tech.plannedBt')}
              </span>
              {techScope.pendingValidationCorrective?.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px] font-mono border border-purple-200">
                  {techScope.pendingValidationCorrective.length} {t('dashboard.tech.pendingValidation')}
                </span>
              )}
              {techScope.needsClarificationCorrective?.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[10px] font-mono border border-rose-200 animate-pulse">
                  {techScope.needsClarificationCorrective.length} {t('dashboard.tech.toClarify')}
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">{t('dashboard.tech.closedByMe')}</span>
            <span className="font-mono font-bold text-amber-700">
              {techScope.closedCorrective.length} {t('dashboard.tech.reportsUnit')}
            </span>
          </div>
        </div>

        {/* 3. Mes Exécutions Préventives */}
        <div
          onClick={onNavigateToPreventive}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(16,185,129,0.12)] hover:-translate-y-1 hover:border-emerald-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                {t('dashboard.tech.myValidatedExecutions')}
              </span>
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-emerald-600 transition-colors">
                {techScope.myPreventiveExecutions.length}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">
                {t('dashboard.tech.historyUnit')}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px] font-mono border border-emerald-200/80">
                {techScope.doneTasks.length} {t('dashboard.tech.tasksMarkedDone')}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">{t('dashboard.tech.traceability')}</span>
            <span className="font-mono font-bold text-emerald-700">
              {t('dashboard.tech.personalRegistry')}
            </span>
          </div>
        </div>

        {/* 4. Mes Sorties PDR & Mouvements */}
        <div
          onClick={onNavigateToSortie}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(20,184,166,0.12)] hover:-translate-y-1 hover:border-teal-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                {t('dashboard.tech.myMovementsSpares')}
              </span>
              <SortieEntreeIcon className="w-6 h-6 text-teal-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-teal-600 transition-colors">
                {techScope.myMouvements.length}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">
                {t('dashboard.tech.validatedVouchers')}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 font-bold text-[10px] font-mono border border-rose-200/80">
                -{techScope.totalMySortiePieces} {t('dashboard.tech.piecesIssued')}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">{t('dashboard.tech.storeRegistry')}</span>
            <span className="font-mono font-bold text-teal-700">
              {t('dashboard.tech.viewMyVouchers')}
            </span>
          </div>
        </div>
      </div>

      {/* Scoped Maintenance Corrective Hub for Technician */}
      <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white rounded-3xl border border-amber-300/80 shadow-[0_8px_30px_rgba(245,158,11,0.08)] p-5 md:p-6 space-y-4 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  {t('dashboard.tech.fieldCorrectiveHub')} · {techScope.badgeLabel}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-white tracking-wider font-mono">
                  {t('dashboard.tech.myInterventionsBadge')}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {t('dashboard.tech.fieldCorrectiveDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => onNavigateToCorrective?.('corrective_bt')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/25 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{t('dashboard.tech.openMyBt')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-amber-200/60">
          <button
            onClick={() => onNavigateToCorrective?.('corrective_di')}
            className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase">
              {t('dashboard.tech.step1Requests')}
            </div>
            <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
              <span>{t('dashboard.tech.reportDi')}</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                {(correctiveInterventions || []).filter(
                  (i) =>
                    i.statut === 'DEMANDE' ||
                    i.statut === 'DEMANDE_CREEE' ||
                    i.statut === 'EN_ATTENTE_VALIDATION'
                ).length}
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavigateToCorrective?.('corrective_bt')}
            className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase">
              {t('dashboard.tech.step2MyBt')}
            </div>
            <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
              <span>{t('dashboard.tech.assignedBt')}</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {techScope.plannedBtCorrective.length}
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavigateToCorrective?.('corrective_live')}
            className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase">
              {t('dashboard.tech.step3LiveTimer')}
            </div>
            <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
              <span>{t('dashboard.tech.myLive')}</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {techScope.liveCorrective.length} {t('dashboard.tech.inProgress')}
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavigateToCorrective?.('corrective_cloture')}
            className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase">
              {t('dashboard.tech.step4MyReports')}
            </div>
            <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
              <span>{t('dashboard.tech.closedLabel')}</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {techScope.closedCorrective.length}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Two-Column Technician Operational Workboard: Preventive Tasks & Open Corrective WOs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Mes Tâches Préventives Prioritaires */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-6 h-6 text-indigo-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Mes Tâches Préventives (Retard · Sem. {techScope.currentWeekKey} · À faire)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Filtrées sur votre profil ({techScope.badgeLabel})
                </p>
              </div>
            </div>
            {onNavigateToPreventive && (
              <button
                onClick={onNavigateToPreventive}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Planning</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {techScope.priorityTasks.length > 0 ? (
            <div className="space-y-2.5">
              {techScope.priorityTasks.slice(0, 8).map((task, idx) => {
                const isClarify =
                  task.validation_status === 'NEEDS_CLARIFICATION' || task.etat === 'À clarifier';
                const isPendingVal =
                  task.validation_status === 'PENDING_VALIDATION' ||
                  task.etat === 'En attente validation';
                const isLate = task.etat === 'En retard';
                const isDone = task.etat === 'Fait';
                const isThisWeek =
                  !isDone &&
                  ((task.planning && Boolean(task.planning[techScope.currentWeekKey])) ||
                    String(task.semaine_cible || '').toUpperCase() === techScope.currentWeekKey);

                return (
                  <div
                    key={`tech-prv-${task.id ?? idx}`}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition ${
                      isClarify || isLate
                        ? 'bg-rose-50/40 border-rose-200/90'
                        : isPendingVal
                        ? 'bg-purple-50/40 border-purple-200/90'
                        : isThisWeek
                        ? 'bg-indigo-50/40 border-indigo-200/90'
                        : 'bg-slate-50/80 border-slate-200/80'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {task.id_machine || 'MACHINE'}
                        </span>
                        {isClarify ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300 animate-pulse">
                            À CLARIFIER
                          </span>
                        ) : isPendingVal ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                            À VALIDER
                          </span>
                        ) : isLate ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            En retard
                          </span>
                        ) : isThisWeek ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Semaine {techScope.currentWeekKey}
                          </span>
                        ) : isDone ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Fait
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            {task.etat || 'À faire'}
                          </span>
                        )}
                        {task.frequence && (
                          <span className="text-[10px] font-mono text-slate-500">
                            • {task.frequence}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-slate-800 truncate">
                        {task.composant || task.action_libelle || 'Contrôle préventif'}
                      </div>
                      {isClarify && task.validation_note && (
                        <div className="text-[10.5px] text-rose-700 font-semibold truncate">
                          Motif : « {task.validation_note} »
                        </div>
                      )}
                    </div>

                    {onNavigateToPreventive && (
                      <button
                        onClick={onNavigateToPreventive}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px] shrink-0 cursor-pointer transition"
                      >
                        {isClarify ? 'Corriger' : 'Traiter'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-center space-y-1.5">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="text-xs font-bold text-slate-800">Aucune tâche préventive assignée</div>
              <p className="text-[11px] text-slate-500">
                Votre liste de maintenance préventive est à jour pour {techScope.badgeLabel}.
              </p>
            </div>
          )}
        </div>

        {/* Right: Mes Ordres de Travail & Interventions Correctives Ouvertes */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Wrench className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Mes Bons de Travail & Interventions Ouvertes ({techScope.openCorrective.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ordres de travail en cours ou planifiés à votre nom
                </p>
              </div>
            </div>
            {onNavigateToCorrective && (
              <button
                onClick={() => onNavigateToCorrective('corrective_bt')}
                className="text-xs font-bold text-amber-600 hover:text-amber-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Voir BT</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {techScope.openCorrective.length > 0 ? (
            <div className="space-y-2.5">
              {techScope.openCorrective.slice(0, 8).map((bt, idx) => {
                const isLive = bt.statut === 'EN_COURS';
                const isPendingVal = bt.validation_status === 'PENDING_VALIDATION';
                const isClarif =
                  bt.validation_status === 'NEEDS_CLARIFICATION' ||
                  bt.validation_status === 'REJECTED';
                return (
                  <div
                    key={`tech-bt-${bt.id ?? idx}`}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition ${
                      isClarif
                        ? 'bg-rose-50/50 border-rose-300/90'
                        : isPendingVal
                        ? 'bg-purple-50/40 border-purple-200/90'
                        : isLive
                        ? 'bg-emerald-50/40 border-emerald-200/90'
                        : 'bg-slate-50/80 border-slate-200/80'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {bt.code_machine || 'MACHINE'}
                        </span>
                        {bt.num_bt && (
                          <span className="font-mono text-[10.5px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                            {bt.num_bt}
                          </span>
                        )}
                        {isClarif ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-100 text-rose-900 border border-rose-300">
                            {bt.validation_status === 'REJECTED' ? 'REJETÉ' : 'À CLARIFIER'}
                          </span>
                        ) : isPendingVal ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-100 text-purple-900 border border-purple-300">
                            À VALIDER
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              isLive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {bt.statut || 'OUVERT'}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-slate-800 truncate">
                        {bt.anomalie || bt.travail_a_faire || 'Intervention corrective'}
                      </div>
                      {isClarif && bt.validation_note && (
                        <div className="text-[11px] font-semibold text-rose-800 bg-white/80 px-2 py-1 rounded-lg border border-rose-200 mt-1">
                          Note responsable : {bt.validation_note}
                        </div>
                      )}
                    </div>

                    {onNavigateToCorrective && (
                      <button
                        onClick={() =>
                          onNavigateToCorrective(
                            isClarif || isLive ? 'corrective_live' : 'corrective_bt'
                          )
                        }
                        className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] shrink-0 cursor-pointer transition ${
                          isClarif
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-white hover:bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isClarif ? 'Corriger' : isLive ? 'Chrono Live' : 'Ouvrir BT'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-center space-y-1.5">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="text-xs font-bold text-slate-800">
                Aucune intervention corrective ouverte
              </div>
              <p className="text-[11px] text-slate-500">
                Aucun bon de travail en attente pour {techScope.badgeLabel}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Two-Column Technician Recent Activity: Executions & Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Mes Dernières Exécutions Préventives
                </h3>
                <p className="text-[11px] text-slate-500">
                  Historique d’exécution enregistré à votre matricule
                </p>
              </div>
            </div>
          </div>

          {techScope.myPreventiveExecutions.length > 0 ? (
            <div className="space-y-2">
              {techScope.myPreventiveExecutions.slice(0, 5).map((ex, idx) => (
                <div
                  key={`tech-ex-${ex.id ?? idx}`}
                  className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10.5px]">
                        {ex.id_machine || 'MACHINE'}
                      </span>
                      <span className="font-bold text-slate-800 truncate">
                        {ex.composant || ex.action_libelle || 'Exécution préventive'}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono">
                      {ex.date_execution || ex.date_realisation || ex.periodMonth || 'Date N/A'}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px] border border-emerald-200 shrink-0">
                    Validé
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-5">
              Aucune exécution préventive enregistrée pour votre profil.
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <SortieEntreeIcon className="w-5 h-5 text-teal-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Mes Derniers Mouvements Magasin
                </h3>
                <p className="text-[11px] text-slate-500">Vos sorties et mouvements PDR récents</p>
              </div>
            </div>
            {onNavigateToSortie && (
              <button
                onClick={onNavigateToSortie}
                className="text-xs font-bold text-teal-600 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Sortie</span>
              </button>
            )}
          </div>

          {techScope.myMouvements.length > 0 ? (
            <div className="space-y-2">
              {techScope.myMouvements.slice(0, 5).map((m, idx) => {
                const isSortie = String(m.type || '').toLowerCase().includes('sort');
                return (
                  <div
                    key={`tech-mvt-${m.id ?? idx}`}
                    className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.2 rounded-full font-mono ${
                            isSortie
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {m.type}
                        </span>
                        <span className="font-mono font-bold text-slate-900">{m.ref}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        {m.designation || 'Article'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {m.code_bon || 'Bon'} • {m.date}{' '}
                        {m.id_machine_registered ? `• ${m.id_machine_registered}` : ''}
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-sm shrink-0">
                      {isSortie ? (
                        <span className="text-rose-600">-{m.quantite}</span>
                      ) : (
                        <span className="text-emerald-600">+{m.quantite}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-5">
              Aucun mouvement de stock enregistré sous votre nom.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
