import { useMemo } from 'react';
import {
  Activity,
  DollarSign,
  MapPin,
  Wrench,
  Clock,
  AlertTriangle,
  Package,
  Factory,
  CheckCircle2,
  Scale,
} from 'lucide-react';
import { computePreventiveAnalytics } from '../../../../domain/preventive/preventiveAnalyticsEngine';
import type { PreventiveExecutionRecord } from '../../../../types/preventive';

interface PreventiveAnalyticsViewProps {
  tasks: any[];
  executions?: PreventiveExecutionRecord[];
  machines?: any[];
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  onDeleteExecution?: (id: string) => void;
  zones?: any[];
  actions?: Array<{ code: string; libelle?: string }>;
}

export default function PreventiveAnalyticsView({
  tasks = [],
  executions = [],
  machines = [],
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  zones = [],
  actions = [],
}: PreventiveAnalyticsViewProps) {
  const report = useMemo(
    () =>
      computePreventiveAnalytics({
        tasks,
        executions,
        machines,
        stockItems,
        mouvements,
        correctiveInterventions,
        actions,
        zones,
      }),
    [tasks, executions, machines, stockItems, mouvements, correctiveInterventions, actions, zones]
  );

  const { overview, punctuality, costs, pmCmBalance, zonesStats, actionsStats, machineRiskStats, pdrReadinessRisks } =
    report;

  const topMachines = machineRiskStats.slice(0, 8);
  const totalHours = (costs.totalDurationMinutes / 60).toFixed(1);

  return (
    <div className="space-y-5">
      {/* EXECUTIVE KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Dynamic Cycle Compliance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Conformité Cycle Actuel
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {overview.doneCount}/{overview.totalTasks}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900">
              {overview.dynamicComplianceRate}%
            </span>
            {overview.overdueCount > 0 ? (
              <span className="text-[11px] font-bold text-rose-600">
                {overview.overdueCount} en retard
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-600">0 retard</span>
            )}
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${overview.dynamicComplianceRate}%` }}
            />
          </div>
          <div className="mt-1.5 text-[10.5px] text-slate-500 flex items-center justify-between">
            <span>À faire : {overview.todoCount}</span>
            {overview.pendingValidationCount > 0 && (
              <span className="text-purple-700 font-semibold">
                À valider : {overview.pendingValidationCount}
              </span>
            )}
          </div>
        </div>

        {/* 2. Schedule Punctuality (OTCR) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Ponctualité (OTCR)
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              {punctuality.approvedExecutionsCount} exéc.
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900">
              {punctuality.onTimeComplianceRate !== null
                ? `${punctuality.onTimeComplianceRate}%`
                : '—'}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {punctuality.evaluatedCount > 0
                ? `${punctuality.onTimeCount} à l'heure / ${punctuality.lateCount} en retard`
                : 'Aucune échéance comparée'}
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all"
              style={{ width: `${punctuality.onTimeComplianceRate ?? 0}%` }}
            />
          </div>
          <div className="mt-1.5 text-[10.5px] text-slate-500 flex items-center justify-between">
            <span>
              Dérive moy. retards :{' '}
              <b className="font-mono text-slate-700">
                {punctuality.lateCount > 0 ? `+${punctuality.avgDelayDays} j` : '0 j'}
              </b>
            </span>
            {punctuality.pendingExecutionsCount > 0 && (
              <span className="text-purple-700 font-semibold">
                {punctuality.pendingExecutionsCount} en attente
              </span>
            )}
          </div>
        </div>

        {/* 3. True Approved Cost Split (MO vs PDR) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-600" />
              Coût Réel Approuvé
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
              {totalHours} h MO
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-slate-900">
              {costs.totalCost.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-500">DH</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
            <div
              className="bg-indigo-500 h-full"
              style={{ width: `${costs.laborSharePct}%` }}
              title={`Main d'œuvre : ${costs.totalLaborCost.toFixed(2)} DH`}
            />
            <div
              className="bg-amber-500 h-full"
              style={{ width: `${costs.sparesSharePct}%` }}
              title={`Pièces PDR : ${costs.totalSparesCost.toFixed(2)} DH`}
            />
          </div>
          <div className="mt-1.5 text-[10.5px] text-slate-600 flex items-center justify-between font-mono">
            <span>
              MO : <b className="text-indigo-700">{costs.totalLaborCost.toFixed(0)} DH</b> ({costs.laborSharePct}%)
            </span>
            <span>
              PDR : <b className="text-amber-700">{costs.totalSparesCost.toFixed(0)} DH</b> ({costs.sparesSharePct}%)
            </span>
          </div>
        </div>

        {/* 4. PM vs CM Balance Ratio */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-teal-600" />
              Ratio Préventif / Curatif
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
              Cible ≥ 70%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900">
              {pmCmBalance.pmRatioPct !== null ? `${pmCmBalance.pmRatioPct}%` : '—'}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {pmCmBalance.pmRatioPct === null
                ? 'Pas encore de données'
                : pmCmBalance.pmRatioPct >= 70
                ? 'Proactif'
                : pmCmBalance.pmRatioPct >= 40
                ? 'En transition'
                : 'Réactif (subi)'}
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (pmCmBalance.pmRatioPct ?? 0) >= 70
                  ? 'bg-emerald-500'
                  : (pmCmBalance.pmRatioPct ?? 0) >= 40
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${pmCmBalance.pmRatioPct ?? 0}%` }}
            />
          </div>
          <div className="mt-1.5 text-[10.5px] text-slate-500 flex items-center justify-between font-mono">
            <span>PM approuvés : {pmCmBalance.pmCount}</span>
            <span>CM actifs : {pmCmBalance.cmCount}</span>
          </div>
        </div>
      </div>

      {/* UPCOMING PDR STOCK READINESS ALERT */}
      {pdrReadinessRisks.length > 0 && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-rose-900 uppercase tracking-wider">
              <Package className="w-4 h-4 text-rose-600" />
              <span>
                Préparation PDR — Pièces en Rupture / Stock Insuffisant pour Tâches à Venir ({pdrReadinessRisks.length})
              </span>
            </div>
            <span className="text-[10.5px] font-semibold text-rose-700">
              À commander avant l&apos;échéance pour éviter le report du préventif
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {pdrReadinessRisks.slice(0, 9).map((item) => (
              <div
                key={item.ref}
                className="p-3 rounded-xl bg-white border border-rose-200/90 text-xs flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono font-black text-slate-900 truncate">{item.ref}</div>
                    <div className="text-[11px] text-slate-600 truncate">{item.designation}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-mono font-black shrink-0 ${
                      item.status === 'RUPTURE'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : item.status === 'NON_REFERENCE'
                        ? 'bg-slate-100 text-slate-700 border border-slate-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {item.status === 'RUPTURE'
                      ? 'RUPTURE'
                      : item.status === 'NON_REFERENCE'
                      ? 'HORS STOCK'
                      : 'INSUFFISANT'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-slate-100">
                  <span className="text-slate-600">
                    Requis: <b className="text-slate-900">{item.requiredQty}</b> | Stock:{' '}
                    <b className="text-rose-700">{item.availableStock}</b>
                  </span>
                  <span className="text-rose-700 font-black">-{item.shortageQty}</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {item.impactedTaskCount} tâche(s) • {item.impactedMachines.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Zone Health & Realization */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Conformité Dynamique par Zone Industrielle
            </h3>
            <span className="text-[11px] font-mono text-slate-500">{zonesStats.length} zone(s)</span>
          </div>
          {zonesStats.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Aucune tâche préventive dans le filtre actuel.
            </div>
          ) : (
            <div className="space-y-3">
              {zonesStats.map((z) => (
                <div key={z.zone} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-bold text-slate-800 truncate">{z.zone}</span>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                      {z.overdue > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                          {z.overdue} retard
                        </span>
                      )}
                      <span className="font-bold text-emerald-700">
                        {z.done}/{z.total} ({z.complianceRate}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${z.total > 0 ? (z.done / z.total) * 100 : 0}%` }}
                      title={`Fait: ${z.done}`}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{ width: `${z.total > 0 ? (z.overdue / z.total) * 100 : 0}%` }}
                      title={`En retard: ${z.overdue}`}
                    />
                    <div
                      className="bg-purple-400 h-full transition-all"
                      style={{ width: `${z.total > 0 ? (z.pending / z.total) * 100 : 0}%` }}
                      title={`À valider / clarifier: ${z.pending}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. True Cost Breakdown by Action Family (MO vs PDR) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wider">
              <Wrench className="w-4 h-4 text-amber-600" />
              Coûts Approuvés par Famille d&apos;Action (MO vs PDR)
            </h3>
            <span className="text-[11px] font-mono font-bold text-slate-600">
              {costs.totalCost.toFixed(2)} DH
            </span>
          </div>
          {actionsStats.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Aucune donnée d&apos;action disponible.
            </div>
          ) : (
            <div className="space-y-3">
              {actionsStats.map((a) => (
                <div key={a.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 font-mono font-black text-slate-800 flex items-center justify-center shrink-0">
                        {a.code}
                      </span>
                      <span className="font-bold text-slate-800 truncate">{a.libelle}</span>
                      <span className="text-[10.5px] font-mono text-slate-400 shrink-0">
                        ({a.approvedExecCount} exéc. / {a.taskCount} tâches)
                      </span>
                    </div>
                    <span className="font-mono font-black text-slate-900 shrink-0">
                      {a.totalCost.toFixed(2)} DH
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-500 pl-8">
                    <span>
                      Main d&apos;œuvre : <b className="text-indigo-700">{a.laborCost.toFixed(2)} DH</b>
                    </span>
                    <span>
                      PDR : <b className="text-amber-700">{a.sparesCost.toFixed(2)} DH</b>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-indigo-500 h-full"
                      style={{
                        width: `${
                          costs.totalCost > 0 ? Math.min(100, (a.laborCost / costs.totalCost) * 100) : 0
                        }%`,
                      }}
                    />
                    <div
                      className="bg-amber-500 h-full"
                      style={{
                        width: `${
                          costs.totalCost > 0 ? Math.min(100, (a.sparesCost / costs.totalCost) * 100) : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TOP RISK MACHINES TABLE (OVERDUE & COST) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wider">
            <Factory className="w-4 h-4 text-indigo-600" />
            Priorités Parc Machines (Retards & Coût Préventif Réalisé)
          </h3>
          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            Trié par retards puis coût total approuvé
          </span>
        </div>

        {topMachines.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Aucune machine planifiée dans ce périmètre.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] uppercase font-bold text-slate-500">
                <tr>
                  <th className="py-2.5 px-4">Machine</th>
                  <th className="py-2.5 px-4">Zone</th>
                  <th className="py-2.5 px-4 text-center">Conformité</th>
                  <th className="py-2.5 px-4 text-center">Retards</th>
                  <th className="py-2.5 px-4 text-center">Exécutions</th>
                  <th className="py-2.5 px-4 text-right">Coût MO</th>
                  <th className="py-2.5 px-4 text-right">Coût PDR</th>
                  <th className="py-2.5 px-4 text-right">Total Réalisé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topMachines.map((m) => (
                  <tr
                    key={m.machineCode}
                    className={m.overdueTasks > 0 ? 'bg-rose-50/30 hover:bg-rose-50/60' : 'hover:bg-slate-50'}
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-mono font-black text-slate-900">{m.machineCode}</div>
                      <div className="text-[10.5px] text-slate-500 truncate max-w-[180px]">
                        {m.machineName}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 font-medium">{m.zone}</td>
                    <td className="py-2.5 px-4 text-center font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          m.complianceRate >= 80
                            ? 'bg-emerald-50 text-emerald-700'
                            : m.complianceRate >= 50
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {m.doneTasks}/{m.totalTasks} ({m.complianceRate}%)
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono">
                      {m.overdueTasks > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black">
                          <AlertTriangle className="w-3 h-3" />
                          {m.overdueTasks}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-bold">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-700">
                      {m.approvedExecs}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-indigo-700">
                      {m.laborCost.toFixed(2)} DH
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-amber-700">
                      {m.sparesCost.toFixed(2)} DH
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900">
                      {m.totalCost.toFixed(2)} DH
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
