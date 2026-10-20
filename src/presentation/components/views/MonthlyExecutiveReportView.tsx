import React, { useState, useMemo } from 'react';
import {
  FileBarChart2,
  Printer,
  FileSpreadsheet,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  ShieldCheck,
  Wrench,
  AlertTriangle,
  Activity,
  Clock,
  ArrowRight,
  PackageCheck,
  Users,
  Factory,
} from 'lucide-react';
import {
  MonthlyReportCalculationService,
  type MonthOverMonthDelta,
} from '../../../application/services/MonthlyReportCalculationService';
import { MonthlyReportExportService } from '../../../services/monthlyReportExportService';
import { normalizeDateToYMD } from '../../../utils/datePeriodUtils';

interface MonthlyExecutiveReportViewProps {
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveTasks?: any[];
  preventiveExecutions?: any[];
  machines?: any[];
  onNavigateToTab?: (tab: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

function DeltaBadge({
  delta,
  invertGoodBad = false,
  unit = '',
}: {
  delta: MonthOverMonthDelta;
  invertGoodBad?: boolean;
  unit?: string;
}) {
  if (!delta || delta.trend === 'STABLE' || delta.diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
        <Minus className="w-3 h-3" />
        <span>Stable (0%)</span>
      </span>
    );
  }

  const isUp = delta.trend === 'UP';
  // For costs, failures, and downtime, UP is bad (rose) and DOWN is good (emerald)
  const isPositiveOutcome = invertGoodBad ? !isUp : isUp;

  const badgeColors = isPositiveOutcome
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : 'bg-rose-50 text-rose-800 border-rose-200';

  const Icon = isUp ? TrendingUp : TrendingDown;
  const sign = delta.diff > 0 ? '+' : '';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeColors}`}
      title={`Écart par rapport au mois précédent : ${sign}${delta.diff}${unit} (${sign}${delta.percent}%)`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>
        {isUp ? '▲' : '▼'} {sign}
        {delta.percent}%
      </span>
    </span>
  );
}

export default function MonthlyExecutiveReportView({
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveTasks = [],
  preventiveExecutions = [],
  machines = [],
  onNavigateToTab,
  showToast,
}: MonthlyExecutiveReportViewProps) {
  // Detect most recent active data month or default to current YYYY-MM
  const detectedActiveMonths = useMemo(() => {
    const months = new Set<string>();
    const currentYm = new Date().toISOString().slice(0, 7);
    months.add(currentYm);
    months.add(MonthlyReportCalculationService.getPreviousMonth(currentYm));

    (mouvements || []).forEach((m) => {
      const ymd = normalizeDateToYMD(m.date);
      if (ymd && ymd.length >= 7) months.add(ymd.slice(0, 7));
    });
    (correctiveInterventions || []).forEach((ci) => {
      const ymd = normalizeDateToYMD(
        ci.date_demande || ci.demande_date || ci.date || ci.date_fin || ci.created_at
      );
      if (ymd && ymd.length >= 7) months.add(ymd.slice(0, 7));
    });
    (preventiveExecutions || []).forEach((ex) => {
      if (ex.periodMonth) months.add(ex.periodMonth);
      else {
        const ymd = normalizeDateToYMD(ex.executedAt);
        if (ymd && ymd.length >= 7) months.add(ymd.slice(0, 7));
      }
    });

    return Array.from(months).sort().reverse();
  }, [mouvements, correctiveInterventions, preventiveExecutions]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const currentYm = new Date().toISOString().slice(0, 7);
    return currentYm;
  });

  const comparison = useMemo(() => {
    return MonthlyReportCalculationService.calculateMonthOverMonthComparison({
      month: selectedMonth,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveTasks,
      preventiveExecutions,
    });
  }, [
    selectedMonth,
    stockItems,
    mouvements,
    correctiveInterventions,
    preventiveTasks,
    preventiveExecutions,
  ]);

  const { currentReport, previousMonth } = comparison;

  const handleExportExcel = () => {
    try {
      const file = MonthlyReportExportService.exportMonthlyReportToExcel(comparison, {
        mouvements,
        correctiveInterventions,
        preventiveExecutions,
      });
      showToast?.(`Rapport mensuel exporté vers Excel (${file})`, 'success');
    } catch (err) {
      console.error('Failed to export monthly executive report:', err);
      showToast?.("Erreur lors de l'export Excel du rapport mensuel", 'error');
    }
  };

  const handlePrintPdf = () => {
    MonthlyReportExportService.triggerMonthlyReportPrint();
  };

  const criticalShortages = useMemo(() => {
    const ruptures = (currentReport.ruptureItems || []).map((it) => ({
      ...it,
      status: 'RUPTURE',
      reorderQty: Math.max(5, it.seuil * 2 - it.stockActuel),
    }));
    const alertes = (currentReport.alerteItems || []).map((it) => ({
      ...it,
      status: 'ALERTE',
      reorderQty: Math.max(2, it.seuil * 2 - it.stockActuel),
    }));
    return [...ruptures, ...alertes].slice(0, 10);
  }, [currentReport]);

  return (
    <div className="space-y-6 max-w-[2200px] mx-auto pb-14 print:p-0 print:space-y-4">
      {/* Top Executive Header & Controls */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.08)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 print:shadow-none print:border-b-2 print:border-slate-900 print:rounded-none">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 print:hidden">
            <FileBarChart2 className="w-6 h-6 text-indigo-700" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Rapport Mensuel Exécutif — Direction d’Usine
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                Période : {selectedMonth}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Comparé à {previousMonth}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Synthèse financière du stock, discipline préventive, fiabilité (MTBF/MTTR/OEE) et liste d’achat prioritaire.
            </p>
          </div>
        </div>

        {/* Period Picker + Print PDF + Export Excel */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500 ml-2" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              aria-label="Mois du rapport"
              className="bg-white px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-500"
            />
            {detectedActiveMonths.slice(0, 3).map((ym) => (
              <button
                key={ym}
                type="button"
                onClick={() => setSelectedMonth(ym)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                  selectedMonth === ym
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {ym}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer / PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel Mensuel (5 Feuilles)</span>
          </button>
        </div>
      </div>

      {/* 4 Executive Summary Pillar KPI Cards (P2.1 & P2.3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Budget & Inventory Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                1. Budget & Valorisation Stock
              </span>
              <Wallet className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900">
                {currentReport.stockValuationTotal.toLocaleString()}
              </span>
              <span className="text-xs font-bold font-mono text-slate-400">DT (Stock Actuel)</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Consommation du mois :</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900">
                  {currentReport.monthConsumptionCost.toLocaleString()} DT
                </span>
                <DeltaBadge
                  delta={comparison.consumptionCostDelta}
                  invertGoodBad={true}
                  unit=" DT"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Commandes ouvertes ({currentReport.openOrdersCount}) :</span>
              <span className="font-mono font-bold text-indigo-700">
                {currentReport.openOrdersValue.toLocaleString()} DT
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Preventive Maintenance Discipline */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                2. Discipline Préventive
              </span>
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-emerald-600">
                  {currentReport.preventiveDisciplineRate}%
                </span>
                <span className="text-xs font-bold font-mono text-slate-400">
                  ({currentReport.preventiveExecutedCount}/{currentReport.preventiveScheduledCount} tâches)
                </span>
              </div>
              <DeltaBadge
                delta={comparison.preventiveDisciplineDelta}
                invertGoodBad={false}
                unit="%"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Heures Main-d’œuvre PM :</span>
              <span className="font-mono font-bold text-slate-800">
                {currentReport.preventiveLaborHours} h
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Coût Préventif du mois :</span>
              <span className="font-mono font-bold text-emerald-700">
                {currentReport.preventiveTotalCost.toLocaleString()} DT
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Corrective Failures, Downtime & MTTR/MTBF */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                3. Pannes & Arrêts (MTBF / MTTR)
              </span>
              <Wrench className="w-5 h-5 text-amber-600" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-amber-600">
                  {currentReport.correctiveCount}
                </span>
                <span className="text-xs font-bold font-mono text-slate-400">
                  pannes ({currentReport.totalDowntimeHours}h arrêt)
                </span>
              </div>
              <DeltaBadge
                delta={comparison.correctiveCountDelta}
                invertGoodBad={true}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Fiabilité MTBF / MTTR :</span>
              <span className="font-mono font-bold text-blue-700">
                {currentReport.mtbfHours}h / {currentReport.mttrFormatted}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Disponibilité Usine (OEE) :</span>
              <span className="font-mono font-bold text-emerald-700">
                {currentReport.availabilityRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Critical Stock Shortages (RUPTURE / ALERTE) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                4. Urgences Réapprovisionnement
              </span>
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <div>
                <span className="text-2xl font-black font-mono text-rose-600">
                  {currentReport.ruptureCount}
                </span>
                <span className="text-xs font-bold text-rose-700 ml-1">Ruptures</span>
              </div>
              <span className="text-slate-300">|</span>
              <div>
                <span className="text-xl font-black font-mono text-amber-600">
                  {currentReport.alerteCount}
                </span>
                <span className="text-xs font-bold text-amber-700 ml-1">Alertes</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Articles référencés :</span>
              <span className="font-mono font-bold text-slate-800">
                {currentReport.stockItemsCount} références
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Mouvements du mois :</span>
              <span className="font-mono font-bold text-slate-800">
                {currentReport.monthSortiesCount} sorties · {currentReport.monthEntreesCount} entrées
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Executive Grids (2x2 Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Top 5 Consumed Spare Parts in Selected Month */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Top 5 Pièces Consommées du Mois ({selectedMonth})
              </h2>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('sortie')}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Journal Mouvements</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {currentReport.topConsumedParts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Aucune sortie de pièce enregistrée sur la période {selectedMonth}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-500">
                    <th className="py-2 px-2">Référence</th>
                    <th className="py-2 px-2">Désignation</th>
                    <th className="py-2 px-2 text-right">Quantité</th>
                    <th className="py-2 px-2 text-right">P.U (DT)</th>
                    <th className="py-2 px-2 text-right">Coût Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentReport.topConsumedParts.map((part) => (
                    <tr key={part.ref} className="hover:bg-slate-50">
                      <td className="py-2 px-2 font-mono font-bold text-indigo-900">{part.ref}</td>
                      <td className="py-2 px-2 text-slate-700 truncate max-w-[200px]">{part.designation}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                        {part.quantity} {part.unit}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500">
                        {part.unitPrice.toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-black text-indigo-700">
                        {part.totalCost.toLocaleString()} DT
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: Top 3 Failing Machines & Reliability Impact */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Top 3 Machines Critiques & Temps d’Arrêt ({selectedMonth})
              </h2>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('corrective_analyse')}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Analyse Pareto</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {currentReport.topFailingMachines.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Aucune panne machine enregistrée sur la période {selectedMonth} (Disponibilité 100%).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-500">
                    <th className="py-2 px-2">Code Machine</th>
                    <th className="py-2 px-2">Équipement</th>
                    <th className="py-2 px-2 text-right">Nombre Pannes</th>
                    <th className="py-2 px-2 text-right">Heures d’Arrêt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentReport.topFailingMachines.map((m) => (
                    <tr key={m.machineCode} className="hover:bg-slate-50">
                      <td className="py-2 px-2 font-mono font-black text-amber-900">{m.machineCode}</td>
                      <td className="py-2 px-2 text-slate-700">{m.machineName}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-rose-700">
                        {m.failureCount} panne(s)
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-black text-slate-900">
                        {m.totalDowntimeHours} h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-bold text-slate-400 uppercase">MTBF Parc</div>
              <div className="text-sm font-black font-mono text-blue-700">{currentReport.mtbfHours}h</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-bold text-slate-400 uppercase">MTTR Moyen</div>
              <div className="text-sm font-black font-mono text-amber-700">{currentReport.mttrFormatted}</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Coût PDR Pannes</div>
              <div className="text-sm font-black font-mono text-purple-700">
                {currentReport.correctiveSparesCost.toLocaleString()} DT
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Technician Execution Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Répartition des Interventions par Technicien ({selectedMonth})
              </h2>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('preventive')}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Planning Préventif</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {currentReport.technicianBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Aucune intervention préventive ou corrective enregistrée sur {selectedMonth}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-500">
                    <th className="py-2 px-2">Intervenant / Technicien</th>
                    <th className="py-2 px-2 text-right">Préventif (PM)</th>
                    <th className="py-2 px-2 text-right">Correctif (BT)</th>
                    <th className="py-2 px-2 text-right">Volume Heures</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentReport.technicianBreakdown.slice(0, 6).map((tech) => (
                    <tr key={tech.name} className="hover:bg-slate-50">
                      <td className="py-2 px-2 font-bold text-slate-800">{tech.name}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">
                        {tech.preventiveCount}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-amber-700">
                        {tech.correctiveCount}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-black text-slate-900">
                        {tech.totalHours} h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 4: Critical Shortages Requiring Purchase (RUPTURE / ALERTE) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Liste d’Achat Prioritaire — Ruptures & Alertes Stock
              </h2>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('stock')}
                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Gérer le Stock</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {criticalShortages.length === 0 ? (
            <div className="py-8 text-center text-xs text-emerald-700 font-semibold">
              Aucune rupture ni alerte critique — tous les stocks sont au-dessus du seuil de sécurité.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-500">
                    <th className="py-2 px-2">Statut</th>
                    <th className="py-2 px-2">Réf PDR</th>
                    <th className="py-2 px-2">Désignation</th>
                    <th className="py-2 px-2 text-right">Stock / Seuil</th>
                    <th className="py-2 px-2 text-right">Qté Conseillée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {criticalShortages.map((item) => (
                    <tr key={item.ref} className="hover:bg-slate-50">
                      <td className="py-2 px-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            item.status === 'RUPTURE'
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono font-bold text-slate-900">{item.ref}</td>
                      <td className="py-2 px-2 text-slate-700 truncate max-w-[180px]">{item.designation}</td>
                      <td className="py-2 px-2 text-right font-mono">
                        <span className="font-black text-rose-700">{item.stockActuel}</span>
                        <span className="text-slate-400"> / {item.seuil}</span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-indigo-700">
                        +{item.reorderQty} pcs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Print-Only Official Signature Block (P2.2) */}
      <div className="hidden print:grid grid-cols-3 gap-8 pt-8 border-t-2 border-slate-300 text-xs text-slate-700">
        <div>
          <div className="font-bold uppercase">Responsable Maintenance</div>
          <div className="mt-10 border-t border-slate-400 pt-1 text-[10px]">Date & Signature</div>
        </div>
        <div>
          <div className="font-bold uppercase">Responsable Magasin PDR</div>
          <div className="mt-10 border-t border-slate-400 pt-1 text-[10px]">Date & Signature</div>
        </div>
        <div>
          <div className="font-bold uppercase">Direction Générale d’Usine</div>
          <div className="mt-10 border-t border-slate-400 pt-1 text-[10px]">Validation & Cachet</div>
        </div>
      </div>
    </div>
  );
}
