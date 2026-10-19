import { Package, Boxes, AlertTriangle, Factory, TrendingUp, TrendingDown, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function DashboardKPIs({
  stockKPIs = {
    totalArticles: 0,
    totalStockActuel: 0,
    totalEntrees: 0,
    totalSorties: 0,
    ruptures: 0,
    alertes: 0,
    ok: 0,
  },
  types = [],
  machineHealth = {
    total: 0,
    enService: 0,
    enMaintenance: 0,
    arret: 0,
  },
  onNavigateToStock,
  onNavigateToMachines,
}) {
  // Compute health rates
  const totalArts = Number(stockKPIs.totalArticles) || 1;
  const normalStockRate = Math.round(((Number(stockKPIs.ok) || 0) / totalArts) * 100);
  
  const totalMchs = Number(machineHealth.total) || 1;
  const machineAvailability = Math.round(((Number(machineHealth.enService) || 0) / totalMchs) * 100);

  const totalAlerts = (Number(stockKPIs.ruptures) || 0) + (Number(stockKPIs.alertes) || 0);

  return (
    <div id="dashboard-kpis-container" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Catalog Articles */}
      <div
        id="kpi-card-total-articles"
        onClick={onNavigateToStock}
        className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(59,130,246,0.12)] hover:-translate-y-1 hover:border-blue-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
      >
        {/* Ambient Hover Glow */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-blue-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
              Articles au Catalogue
            </span>
            <Package className="w-6 h-6 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-blue-600 transition-colors">
              {stockKPIs.totalArticles}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">réfs</span>
          </div>

          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-700">{types.length} catégories</span>
            <span>•</span>
            <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 font-mono">
              {stockKPIs.ok} normaux
            </span>
          </div>
        </div>

        {/* Mini Health Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Santé stock :</span>
          <span className="font-mono font-bold text-blue-700">{normalStockRate}% conforme</span>
        </div>
      </div>

      {/* 2. Physical Stock Balance */}
      <div
        id="kpi-card-stock-balance"
        onClick={onNavigateToStock}
        className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(16,185,129,0.12)] hover:-translate-y-1 hover:border-emerald-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
      >
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
              Unités Physiques en Stock
            </span>
            <Boxes className="w-6 h-6 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-emerald-600 transition-colors">
              {stockKPIs.totalStockActuel}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">pièces</span>
          </div>

          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 font-mono flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />+{stockKPIs.totalEntrees}
            </span>
            <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60 font-mono flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3" />-{stockKPIs.totalSorties}
            </span>
          </div>
        </div>

        {/* Live Balance Formula Cue */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Flux cumulés :</span>
          <span className="font-mono font-bold text-emerald-700">
            Net : {(Number(stockKPIs.totalEntrees) || 0) - (Number(stockKPIs.totalSorties) || 0)}
          </span>
        </div>
      </div>

      {/* 3. Critical Alerts & Ruptures */}
      <div
        id="kpi-card-critical-alerts"
        onClick={onNavigateToStock}
        className={`bg-white p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
          totalAlerts > 0
            ? 'border-rose-200/90 shadow-[0_4px_16px_-2px_rgba(244,63,94,0.08)] hover:shadow-[0_12px_28px_-4px_rgba(244,63,94,0.16)] hover:-translate-y-1 hover:border-rose-300'
            : 'border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-1 hover:border-slate-300'
        }`}
      >
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/10 transition-colors" />

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
              Seuils Critiques & Alertes
            </span>
            {totalAlerts > 0 ? (
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 animate-pulse group-hover:scale-110 transition-transform" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black font-mono tracking-tight transition-colors ${
              totalAlerts > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}>
              {totalAlerts}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">articles</span>
          </div>

          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] font-mono border border-rose-200/80">
              {stockKPIs.ruptures} Ruptures
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] font-mono border border-amber-200/80">
              {stockKPIs.alertes} Alertes
            </span>
          </div>
        </div>

        {/* Action Cue */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Réappro :</span>
          <span className="font-semibold text-rose-700 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            <span>Traiter les alertes</span>
            <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* 4. Machines & Asset Fleet */}
      <div
        id="kpi-card-machines-fleet"
        onClick={onNavigateToMachines}
        className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(168,85,247,0.12)] hover:-translate-y-1 hover:border-purple-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
      >
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-purple-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
              Parc Machines Actif
            </span>
            <Factory className="w-6 h-6 text-purple-600 shrink-0 group-hover:scale-110 transition-transform" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-purple-600 transition-colors">
              {machineHealth.total}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">équipements</span>
          </div>

          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 font-mono">
              {machineHealth.enService} en service
            </span>
            <span>•</span>
            <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 font-mono">
              {machineHealth.enMaintenance} en maint.
            </span>
          </div>
        </div>

        {/* Machine Availability Rate */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Disponibilité :</span>
          <span className="font-mono font-bold text-purple-700">{machineAvailability}% dispo</span>
        </div>
      </div>
    </div>
  );
}
