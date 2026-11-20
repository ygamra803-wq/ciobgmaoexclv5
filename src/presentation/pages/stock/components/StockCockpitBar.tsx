import { AlertOctagon, Archive, ClipboardCheck, ShoppingBag } from 'lucide-react';
import type { StockCockpitMetrics } from '../../../../domain/stock/stockCockpitService';

interface StockCockpitBarProps {
  metrics: StockCockpitMetrics;
  activeKpiFilter: string;
  canEditStock: boolean;
  onFilterClasseARuptures: () => void;
  onFilterDeadStock90d: () => void;
  onNavigatePendingDemands: () => void;
  onOpenActivePOs: () => void;
}

export function StockCockpitBar({
  metrics,
  activeKpiFilter,
  canEditStock,
  onFilterClasseARuptures,
  onFilterDeadStock90d,
  onNavigatePendingDemands,
  onOpenActivePOs,
}: StockCockpitBarProps) {
  const isClasseAActive = activeKpiFilter === 'RUPTURE_CLASS_A';
  const isDeadActive = activeKpiFilter === 'DEAD_STOCK_90D';

  return (
    <div
      data-testid="stock-storekeeper-cockpit"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
    >
      {/* 1. Ruptures Classe A / Critique */}
      <button
        type="button"
        onClick={onFilterClasseARuptures}
        data-testid="cockpit-btn-classe-a-rupture"
        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
          isClasseAActive
            ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-300'
            : metrics.classeARupturesCount > 0
              ? 'bg-rose-50/90 hover:bg-rose-100/80 border-rose-200 text-rose-950 shadow-2xs'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isClasseAActive
                ? 'bg-rose-500 text-white'
                : metrics.classeARupturesCount > 0
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div
              className={`text-[10px] font-black uppercase tracking-wider truncate ${
                isClasseAActive ? 'text-rose-100' : 'text-slate-500'
              }`}
            >
              Ruptures Classe A / Critique
            </div>
            <div className="text-lg font-black font-mono leading-tight">
              {metrics.classeARupturesCount}{' '}
              <span className="text-[11px] font-semibold">réf(s)</span>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
            isClasseAActive
              ? 'bg-white/20 text-white'
              : metrics.classeARupturesCount > 0
                ? 'bg-rose-200/80 text-rose-900'
                : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {isClasseAActive ? 'Filtré' : metrics.classeARupturesCount > 0 ? 'Filtrer' : 'RAS'}
        </span>
      </button>

      {/* 2. Capital Immobilisé (Dead Stock > 90j) */}
      <button
        type="button"
        onClick={onFilterDeadStock90d}
        data-testid="cockpit-btn-dead-stock"
        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
          isDeadActive
            ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300'
            : 'bg-white hover:bg-amber-50/60 border-slate-200 text-slate-900 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isDeadActive
                ? 'bg-amber-500 text-white'
                : metrics.deadStock90dCount > 0
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Archive className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div
              className={`text-[10px] font-black uppercase tracking-wider truncate ${
                isDeadActive ? 'text-amber-100' : 'text-slate-500'
              }`}
            >
              Dead Stock &gt; 90j (Immobilisé)
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-black font-mono leading-tight">
                {metrics.deadStock90dValueMad.toLocaleString('fr-FR', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{' '}
                DH
              </span>
              <span
                className={`text-[10.5px] font-mono font-bold ${
                  isDeadActive ? 'text-amber-100' : 'text-slate-500'
                }`}
              >
                ({metrics.deadStock90dCount} réf)
              </span>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
            isDeadActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {isDeadActive ? 'Filtré' : 'Voir'}
        </span>
      </button>

      {/* 3. Demandes Sortie Terrain en attente */}
      <button
        type="button"
        onClick={onNavigatePendingDemands}
        data-testid="cockpit-btn-pending-demands"
        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
          metrics.pendingSortieDemandsCount > 0
            ? 'bg-purple-50/90 hover:bg-purple-100/80 border-purple-200 text-purple-950 shadow-2xs'
            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              metrics.pendingSortieDemandsCount > 0
                ? 'bg-purple-700 text-white'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
              Demandes Sortie en attente
            </div>
            <div className="text-lg font-black font-mono leading-tight">
              {metrics.pendingSortieDemandsCount}{' '}
              <span className="text-[11px] font-semibold">demande(s)</span>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
            metrics.pendingSortieDemandsCount > 0
              ? 'bg-purple-200/80 text-purple-950'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          Valider →
        </span>
      </button>

      {/* 4. Commandes PO en cours de réception */}
      <button
        type="button"
        onClick={canEditStock ? onOpenActivePOs : undefined}
        disabled={!canEditStock}
        data-testid="cockpit-btn-active-pos"
        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
          canEditStock ? 'cursor-pointer' : 'cursor-default opacity-80'
        } ${
          metrics.activePoCount > 0
            ? 'bg-cyan-50/90 hover:bg-cyan-100/80 border-cyan-200 text-cyan-950 shadow-2xs'
            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              metrics.activePoCount > 0
                ? 'bg-cyan-700 text-white'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
              PO en cours / Réception
            </div>
            <div className="text-lg font-black font-mono leading-tight">
              {metrics.activePoCount}{' '}
              <span className="text-[11px] font-semibold">commande(s)</span>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
            metrics.activePoCount > 0
              ? 'bg-cyan-200/80 text-cyan-950'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {canEditStock ? 'Suivi PO →' : 'Lecture'}
        </span>
      </button>
    </div>
  );
}
