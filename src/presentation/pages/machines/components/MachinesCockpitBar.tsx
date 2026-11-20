import { AlertOctagon, Flame, Wrench, ClipboardList } from 'lucide-react';
import type {
  MachinesCockpitFilter,
  MachinesCockpitMetrics,
} from '../../../../domain/machines/machinesCockpitService';

interface MachinesCockpitBarProps {
  metrics: MachinesCockpitMetrics;
  statusFilter: string;
  cockpitFilter: MachinesCockpitFilter;
  onToggleStopped: () => void;
  onToggleBadActors: () => void;
  onToggleMaintDue: () => void;
  onToggleIncompleteSetup: () => void;
}

export function MachinesCockpitBar({
  metrics,
  statusFilter,
  cockpitFilter,
  onToggleStopped,
  onToggleBadActors,
  onToggleMaintDue,
  onToggleIncompleteSetup,
}: MachinesCockpitBarProps) {
  const isStoppedActive =
    cockpitFilter === 'STOPPED_OR_MAINT' || statusFilter === 'STOPPED_OR_MAINT';
  const isBadActorsActive = cockpitFilter === 'BAD_ACTORS';
  const isMaintDueActive = cockpitFilter === 'MAINT_DUE';
  const isIncompleteActive = cockpitFilter === 'INCOMPLETE_SETUP';

  return (
    <div
      data-testid="machines-owner-cockpit"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
    >
      {/* 1. Machines à l'Arrêt / Perte Horaire */}
      <button
        type="button"
        onClick={onToggleStopped}
        data-testid="machines-cockpit-stopped"
        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
          isStoppedActive
            ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-300'
            : metrics.stoppedMachinesCount > 0
              ? 'bg-rose-50/90 hover:bg-rose-100/80 border-rose-200 text-rose-950 shadow-2xs'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isStoppedActive
                ? 'bg-rose-500 text-white'
                : metrics.stoppedMachinesCount > 0
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div
              className={`text-[10px] font-black uppercase tracking-wider truncate ${
                isStoppedActive ? 'text-rose-100' : 'text-slate-500'
              }`}
            >
              Arrêts / Maintenance Actifs
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-black font-mono leading-tight">
                {metrics.stoppedMachinesCount}
              </span>
              <span
                className={`text-[10.5px] font-mono font-bold ${
                  isStoppedActive ? 'text-rose-100' : 'text-rose-700'
                }`}
              >
                {metrics.activeHourlyLossDh > 0
                  ? `(${metrics.activeHourlyLossDh.toLocaleString('fr-FR')} DH/h)`
                  : 'équip.'}
              </span>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
            isStoppedActive
              ? 'bg-white/20 text-white'
              : metrics.stoppedMachinesCount > 0
                ? 'bg-rose-200/80 text-rose-900'
                : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {isStoppedActive ? 'Filtré' : metrics.stoppedMachinesCount > 0 ? 'Filtrer' : 'RAS'}
        </span>
      </button>

      {/* 2. Bad Actors & Alertes BER */}
      <button
        type="button"
        onClick={onToggleBadActors}
        data-testid="machines-cockpit-bad-actors"
        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
          isBadActorsActive
            ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300'
            : metrics.badActorsCount > 0
              ? 'bg-amber-50/90 hover:bg-amber-100/80 border-amber-200 text-amber-950 shadow-2xs'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isBadActorsActive
                ? 'bg-amber-500 text-white'
                : metrics.badActorsCount > 0
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Flame className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div
              className={`text-[10px] font-black uppercase tracking-wider truncate ${
                isBadActorsActive ? 'text-amber-100' : 'text-slate-500'
              }`}
            >
              Bad Actors &amp; Alertes BER
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-black font-mono leading-tight">
                {metrics.badActorsCount}
              </span>
              <span
                className={`text-[10.5px] font-mono font-bold ${
                  isBadActorsActive ? 'text-amber-100' : 'text-slate-600'
                }`}
              >
                (
                {metrics.badActorsEconomicImpact12m > 0
                  ? `${metrics.badActorsEconomicImpact12m.toLocaleString('fr-FR', {
                      maximumFractionDigits: 0,
                    })} DH`
                  : 'TCO 12m'}
                )
              </span>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
            isBadActorsActive
              ? 'bg-white/20 text-white'
              : metrics.badActorsCount > 0
                ? 'bg-amber-200/80 text-amber-950'
                : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {isBadActorsActive ? 'Filtré' : metrics.badActorsCount > 0 ? 'Analyser' : 'Sain'}
        </span>
      </button>

      {/* 3. BT Ouverts & Préventif à Exécuter */}
      <button
        type="button"
        onClick={onToggleMaintDue}
        data-testid="machines-cockpit-maint-due"
        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
          isMaintDueActive
            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-300'
            : metrics.maintDueMachinesCount > 0
              ? 'bg-indigo-50/90 hover:bg-indigo-100/80 border-indigo-200 text-indigo-950 shadow-2xs'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isMaintDueActive
                ? 'bg-indigo-500 text-white'
                : metrics.maintDueMachinesCount > 0
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Wrench className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div
              className={`text-[10px] font-black uppercase tracking-wider truncate ${
                isMaintDueActive ? 'text-indigo-100' : 'text-slate-500'
              }`}
            >
              BT Ouverts / PM en Cours
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-black font-mono leading-tight">
                {metrics.maintDueMachinesCount}
              </span>
              <span
                className={`text-[10.5px] font-mono font-bold ${
                  isMaintDueActive ? 'text-indigo-100' : 'text-slate-600'
                }`}
              >
                ({metrics.totalOpenBtsCount} BT ouverts)
              </span>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
            isMaintDueActive
              ? 'bg-white/20 text-white'
              : metrics.maintDueMachinesCount > 0
                ? 'bg-indigo-200/80 text-indigo-950'
                : 'bg-slate-100 text-slate-600'
          }`}
        >
          {isMaintDueActive ? 'Filtré' : 'Suivre'}
        </span>
      </button>

      {/* 4. Fiches Incomplètes (Onboarding Usine) */}
      <button
        type="button"
        onClick={onToggleIncompleteSetup}
        data-testid="machines-cockpit-incomplete"
        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
          isIncompleteActive
            ? 'bg-cyan-700 text-white border-cyan-800 shadow-md ring-2 ring-cyan-300'
            : metrics.incompleteSetupCount > 0
              ? 'bg-cyan-50/90 hover:bg-cyan-100/80 border-cyan-200 text-cyan-950 shadow-2xs'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isIncompleteActive
                ? 'bg-cyan-600 text-white'
                : metrics.incompleteSetupCount > 0
                  ? 'bg-cyan-700 text-white'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div
              className={`text-[10px] font-black uppercase tracking-wider truncate ${
                isIncompleteActive ? 'text-cyan-100' : 'text-slate-500'
              }`}
            >
              Fiches à Compléter (Zone/Coût)
            </div>
            <div className="text-lg font-black font-mono leading-tight">
              {metrics.incompleteSetupCount}{' '}
              <span className="text-[11px] font-semibold">machine(s)</span>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
            isIncompleteActive
              ? 'bg-white/20 text-white'
              : metrics.incompleteSetupCount > 0
                ? 'bg-cyan-200/80 text-cyan-950'
                : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {isIncompleteActive ? 'Filtré' : metrics.incompleteSetupCount > 0 ? 'Compléter' : '100%'}
        </span>
      </button>
    </div>
  );
}
