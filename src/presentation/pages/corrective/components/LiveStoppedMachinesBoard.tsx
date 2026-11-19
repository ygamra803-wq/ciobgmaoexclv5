import { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Play,
  Flame,
  User,
  Coins,
} from 'lucide-react';
import { isMachineStoppageFlag } from '../../../../domain/corrective/services/CorrectiveCalculationService';
import type { IMachine } from '../../../../types/domain';
import type { CorrectiveInterventionItem } from '../../../../types/store';

export interface LiveStoppedMachinesBoardProps {
  interventions: CorrectiveInterventionItem[];
  machines?: IMachine[];
  onOpenLive: (item: CorrectiveInterventionItem) => void;
  onOpenDi?: (item: CorrectiveInterventionItem) => void;
  /** Optional clock override for deterministic tests */
  nowMs?: number;
}

function parseStartTimestampMs(item: CorrectiveInterventionItem): number | null {
  const datePart = String(
    item.date_debut || item.date_demande || item.demande_date || item.date || ''
  )
    .trim()
    .slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const fallbackIso = String(item.created_at || item.updated_at || '').trim();
    if (!fallbackIso) return null;
    const parsedFallback = Date.parse(fallbackIso);
    return Number.isFinite(parsedFallback) ? parsedFallback : null;
  }
  const timePart = String(
    item.heure_debut || item.heure_demande || item.demande_heure || item.heure || '08:00'
  )
    .trim()
    .slice(0, 5);
  const safeTime = /^\d{2}:\d{2}$/.test(timePart) ? timePart : '08:00';
  const parsed = Date.parse(`${datePart}T${safeTime}:00`);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatElapsedDuration(elapsedMinutes: number): string {
  const mins = Math.max(0, Math.round(elapsedMinutes));
  if (mins < 1) return '< 1 min';
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const remMins = mins % 60;
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${String(remMins).padStart(2, '0')}m`;
  return `${remMins} min`;
}

const PRIORITY_RANK: Record<string, number> = {
  HAUTE: 0,
  CRITIQUE: 0,
  URGENTE: 0,
  MOYENNE: 1,
  BASSE: 2,
};

export function LiveStoppedMachinesBoard({
  interventions = [],
  machines = [],
  onOpenLive,
  onOpenDi,
  nowMs,
}: LiveStoppedMachinesBoardProps) {
  const [tickMs, setTickMs] = useState<number>(() => nowMs ?? Date.now());

  useEffect(() => {
    if (typeof nowMs === 'number') {
      setTickMs(nowMs);
      return;
    }
    const interval = setInterval(() => setTickMs(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [nowMs]);

  const machineMap = useMemo(() => {
    const map = new Map<string, IMachine>();
    for (const m of machines || []) {
      const candidates = [m.id_machine_registered, m.id, (m as any).code]
        .map((v) => String(v || '').trim().toUpperCase())
        .filter(Boolean);
      for (const k of candidates) {
        map.set(k, m);
      }
    }
    return map;
  }, [machines]);

  const stoppedEntries = useMemo(() => {
    const activeStopped = (interventions || []).filter((item) => {
      if (!item) return false;
      const st = String(item.statut || '').trim().toUpperCase();
      if (st === 'CLOTURE' || st === 'ANNULE') return false;
      if (String(item.action_fermee || '').trim().toUpperCase() === 'OUI') return false;
      return isMachineStoppageFlag(item);
    });

    return activeStopped
      .map((item) => {
        const mKey = String(item.code_machine || item.id_machine_registered || '')
          .trim()
          .toUpperCase();
        const machine = mKey ? machineMap.get(mKey) : undefined;
        const startMs = parseStartTimestampMs(item);
        const elapsedMinutes =
          startMs !== null ? Math.max(0, Math.round((tickMs - startMs) / 60_000)) : 0;
        const hourlyRate =
          Number(item.cout_arret_horaire ?? machine?.cout_arret_horaire ?? 0) || 0;
        const estimatedLoss =
          hourlyRate > 0 ? Number(((elapsedMinutes / 60) * hourlyRate).toFixed(0)) : 0;
        const prioKey = String(item.priorite || 'MOYENNE').trim().toUpperCase();
        const prioRank = PRIORITY_RANK[prioKey] ?? 1;

        return {
          item,
          machine,
          elapsedMinutes,
          hourlyRate,
          estimatedLoss,
          prioRank,
        };
      })
      .sort((a, b) => {
        if (a.prioRank !== b.prioRank) return a.prioRank - b.prioRank;
        return b.elapsedMinutes - a.elapsedMinutes;
      });
  }, [interventions, machineMap, tickMs]);

  const totalEstimatedLoss = useMemo(
    () => stoppedEntries.reduce((sum, entry) => sum + entry.estimatedLoss, 0),
    [stoppedEntries]
  );

  if (stoppedEntries.length === 0) {
    return (
      <div
        data-testid="live-stopped-board-ok"
        className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 text-emerald-950 shadow-2xs"
      >
        <div className="flex items-center gap-2.5 text-xs font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Production nominale — 0 machine à l’arrêt actuellement</span>
        </div>
        <span className="text-[10.5px] font-mono font-bold text-emerald-700 bg-white/80 px-2.5 py-0.5 rounded-lg border border-emerald-200 hidden sm:inline-block">
          LIVE STOPPED BOARD · OK
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="live-stopped-board"
      className="rounded-2xl bg-rose-50/90 border-2 border-rose-300 p-4 shadow-sm space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-600 text-white text-xs font-black uppercase tracking-wider shadow-xs">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>
              {stoppedEntries.length}{' '}
              {stoppedEntries.length > 1 ? 'Machines à l’arrêt' : 'Machine à l’arrêt'}
            </span>
          </span>
          <span className="text-xs font-semibold text-rose-900">
            Tableau temps réel Direction & Maintenance — Priorité remise en production
          </span>
        </div>

        {totalEstimatedLoss > 0 && (
          <div
            data-testid="live-stopped-total-loss"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-rose-300 text-rose-900 text-xs font-mono font-black shadow-2xs self-start sm:self-auto"
          >
            <Coins className="w-3.5 h-3.5 text-rose-600" />
            <span>Perte prod. estimée : {totalEstimatedLoss.toLocaleString()} DH</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {stoppedEntries.map(({ item, machine, elapsedMinutes, hourlyRate, estimatedLoss }) => {
          const hasBt = Boolean(item.num_bt);
          const prio = String(item.priorite || 'MOYENNE').trim().toUpperCase();
          const zoneLabel =
            machine?.id_zone_default || machine?.id_zone || item.zone || '';
          const machineLabel =
            machine?.designation && machine.designation !== item.code_machine
              ? machine.designation
              : '';

          return (
            <div
              key={String(item.id || item.num_bt || item.code_machine)}
              data-testid={`stopped-machine-card-${item.code_machine || item.id}`}
              className="bg-white rounded-xl border border-rose-200 p-3 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-rose-400 transition"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white font-mono font-black text-xs shrink-0">
                      {item.code_machine || 'MACHINE'}
                    </span>
                    {item.num_bt ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold text-[10px] truncate">
                        {item.num_bt}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 font-mono font-bold text-[10px]">
                        DI EN ATTENTE
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md font-mono font-black text-[10px] shrink-0 ${
                      prio === 'HAUTE' || prio === 'CRITIQUE'
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {prio}
                  </span>
                </div>

                {(machineLabel || zoneLabel) && (
                  <div className="text-[11px] text-slate-500 font-medium truncate">
                    {machineLabel}
                    {machineLabel && zoneLabel ? ' · ' : ''}
                    {zoneLabel ? `Zone ${zoneLabel}` : ''}
                  </div>
                )}

                <div className="text-xs font-bold text-slate-900 line-clamp-2">
                  {item.anomalie || item.travail_a_faire || 'Arrêt non qualifié'}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-700 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    <Clock className="w-3 h-3" />
                    <span>{formatElapsedDuration(elapsedMinutes)}</span>
                  </span>
                  {item.intervenant && (
                    <span className="inline-flex items-center gap-1 text-slate-600 font-sans font-semibold">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[110px]">{item.intervenant}</span>
                    </span>
                  )}
                  {hourlyRate > 0 && (
                    <span className="text-[10.5px] font-black text-rose-800">
                      ~{estimatedLoss.toLocaleString()} DH
                    </span>
                  )}
                </div>

                {hasBt ? (
                  <button
                    type="button"
                    data-testid={`stopped-open-live-${item.id || item.num_bt}`}
                    onClick={() => onOpenLive(item)}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition shadow-2xs shrink-0"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Ouvrir Live</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid={`stopped-open-di-${item.id}`}
                    onClick={() => (onOpenDi ? onOpenDi(item) : onOpenLive(item))}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition shadow-2xs shrink-0"
                  >
                    <Flame className="w-3 h-3" />
                    <span>Traiter DI</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LiveStoppedMachinesBoard;
