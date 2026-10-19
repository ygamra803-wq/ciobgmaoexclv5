import {
  Activity,
  DollarSign,
  BarChart3,
} from 'lucide-react';
import ViewSwitchButtonGroup from './ViewSwitchButtonGroup';

/**
 * PreventiveAnalyticsView - Dedicated Component for Preventive KPIs & Distribution (Vue Analytique & Santé)
 */
export default function PreventiveAnalyticsView({
  tasks = [],
  zones = [],
  actions = [],
  onSwitchView = () => {},
}) {
  const zoneList = Array.isArray(zones)
    ? zones.map((z) => (typeof z === 'string' ? z : z?.nom_zone || z?.id_zone || z?.code_zone || ''))
    : [];

  return (
    <div className="space-y-4 animate-view-transition">
      {/* Top Analytics Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.08)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shadow-2xs shrink-0">
            <BarChart3 className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-[13px]">
                Tableau de Bord & Statistiques (Santé & Coûts Préventifs)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200">
                KPIs & Ratios Analytiques
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
              Analyses des taux de conformité, répartition par zone et valorisation des coûts préventifs
            </p>
          </div>
        </div>

        {/* 3D Circular Switch Buttons on the RIGHT */}
        <ViewSwitchButtonGroup
          currentView="analytics"
          onSwitchView={onSwitchView}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
          <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            <span>Taux de Réalisation Préventif par Zone</span>
          </h3>
          <div className="space-y-3">
            {zoneList
              .filter((z) => z && z !== 'ALL')
              .map((z) => {
                const zTasks = tasks.filter((t) => t.id_zone === z || t.zone === z);
                const zDone = zTasks.filter((t) => t.etat === 'Fait').length;
                const zRate = zTasks.length > 0 ? Math.round((zDone / zTasks.length) * 100) : 0;

                return (
                  <div key={z} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>Zone {z}</span>
                      <span>{zRate}% ({zDone}/{zTasks.length})</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${zRate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
          <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-600" />
            <span>Répartition des Dépenses PDR par Famille d'Action</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {actions.map((act) => {
              const actTasks = tasks.filter((t) => t.action_code === act.code);
              const actCost = actTasks.reduce((acc, curr) => acc + Number(curr.cout_cumule || 0), 0);

              return (
                <div key={act.code} className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{act.code} - {act.libelle}</span>
                  </div>
                  <p className="font-mono font-black text-slate-900 text-sm">{actCost.toFixed(2)} DT</p>
                  <span className="text-[10px] text-slate-400">{actTasks.length} intervention(s)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
