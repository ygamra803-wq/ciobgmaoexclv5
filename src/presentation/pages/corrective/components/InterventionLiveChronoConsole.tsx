import type { Dispatch, SetStateAction } from 'react';
import { Timer, ShieldCheck } from 'lucide-react';
import type { CorrectiveInterventionItem } from '../../../../types/store';
import type {
  LiveInterventionFormState,
  LiveShiftStatus,
} from '../hooks/useInterventionLiveController';

interface InterventionLiveChronoConsoleProps {
  title: string;
  activeIntervention: CorrectiveInterventionItem;
  liveWorkingTime: { formatted: string; minutes: number };
  shiftStatus: LiveShiftStatus;
  smartAnomalyActions: string[];
  setFormState: Dispatch<SetStateAction<LiveInterventionFormState>>;
}

export function InterventionLiveChronoConsole({
  title,
  activeIntervention,
  liveWorkingTime,
  shiftStatus,
  smartAnomalyActions,
  setFormState,
}: InterventionLiveChronoConsoleProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-5 relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-xs">
            <Timer className="w-6 h-6 text-amber-700 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-black text-slate-900 tracking-tight">{title}</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                EN DIRECT
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Machine : <b className="text-slate-800">{activeIntervention.code_machine}</b> • BT :{' '}
              <b className="text-blue-700">
                {activeIntervention.num_bt ||
                  `BT-${String(activeIntervention.id || '').slice(-4) || 'N/A'}`}
              </b>{' '}
              • Intervenant :{' '}
              <b className="text-slate-800">{activeIntervention.intervenant || 'Non assigné'}</b>
            </p>
          </div>
        </div>

        {/* Shift status badge */}
        <div
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 self-start md:self-auto ${shiftStatus.color}`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{shiftStatus.label}</span>
        </div>
      </div>

      {/* Big Digital Stopwatch Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-gradient-to-br from-slate-950 to-slate-900 text-white rounded-2xl p-6 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-800">
          <div className="space-y-1 text-center sm:text-left">
            <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 justify-center sm:justify-start">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>Temps Réel Ouvré Payé (Excel)</span>
            </div>
            <div className="text-4xl sm:text-5xl font-mono font-black tracking-tight text-white drop-shadow-md">
              {liveWorkingTime.formatted}
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {liveWorkingTime.minutes} minutes effectives (Pauses déduites)
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 text-xs font-mono space-y-1.5 text-slate-300 w-full sm:w-auto">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Début :</span>
              <span className="font-bold text-white">
                {activeIntervention.date_debut ||
                  activeIntervention.date_demande ||
                  activeIntervention.demande_date ||
                  new Date().toISOString().split('T')[0]}{' '}
                à{' '}
                {activeIntervention.heure_debut ||
                  activeIntervention.heure_demande ||
                  activeIntervention.demande_heure ||
                  '08:00'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Pause Midi :</span>
              <span className="text-amber-400 font-bold">-00h 45m</span>
            </div>
            <div className="flex justify-between gap-4 pt-1 border-t border-slate-700">
              <span className="text-slate-400">Plage usine :</span>
              <span className="text-emerald-400 font-bold">08:00 - 17:00</span>
            </div>
          </div>
        </div>

        <div className="bg-amber-50/80 rounded-2xl p-5 border border-amber-200/80 flex flex-col justify-between space-y-3">
          <div>
            <span className="text-[10.5px] font-extrabold text-amber-950 uppercase tracking-wider block">
              Anomalie Constatée (Col J)
            </span>
            <p className="font-black text-slate-900 text-sm mt-1 font-mono">
              {activeIntervention.anomalie || 'Non spécifiée'}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-800">
              <span className="font-bold">Type :</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-200/60 font-mono font-bold">
                {activeIntervention.type_panne || '—'}
              </span>
            </div>
          </div>

          {smartAnomalyActions.length > 0 && (
            <div className="pt-2 border-t border-amber-200 text-[11px]">
              <span className="font-bold text-amber-900 block mb-1">Actions Fréquentes Liées :</span>
              <div className="flex flex-wrap gap-1">
                {smartAnomalyActions.slice(0, 2).map((act, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFormState((p) => ({ ...p, action_realisee: act }))}
                    className="px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-medium text-[10px] cursor-pointer transition shadow-2xs"
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
