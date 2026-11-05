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
  Filter,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import {
  MonthlyReportCalculationService,
  type MonthOverMonthDelta,
  type ReportAssetClassFilter,
} from '../../../application/services/MonthlyReportCalculationService';
import { MonthlyReportExportService } from '../../../services/monthlyReportExportService';
import { normalizeDateToYMD } from '../../../utils/datePeriodUtils';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { useCurrency } from '../../../utils/currencyService';

interface MonthlyExecutiveReportViewProps {
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveTasks?: any[];
  preventiveExecutions?: any[];
  sortiesExterne?: any[];
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
  sortiesExterne: propSortiesExterne,
  machines: propMachines,
  onNavigateToTab,
  showToast,
}: MonthlyExecutiveReportViewProps) {
  const { user } = useAuth();
  const { formatCurrency, currencySymbol } = useCurrency();
  const canViewReport =
    Boolean(user) && AuthorizationService.canAccessTab(user, 'executive_report');
  const canExportReport =
    Boolean(user) && AuthorizationService.hasPermission(user, 'report.export');

  const storeSortiesExterne = useGmaoStore((s) => s.sortiesExterne || []);
  const storeMachines = useGmaoStore((s) => s.machines || []);
  const sortiesExterne = propSortiesExterne ?? storeSortiesExterne;
  const machines = propMachines && propMachines.length > 0 ? propMachines : storeMachines;

  const [assetClass, setAssetClass] = useState<ReportAssetClassFilter>('ALL');

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
      assetClass,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveTasks,
      preventiveExecutions,
      sortiesExterne,
      machines,
    });
  }, [
    selectedMonth,
    assetClass,
    stockItems,
    mouvements,
    correctiveInterventions,
    preventiveTasks,
    preventiveExecutions,
    sortiesExterne,
    machines,
  ]);

  const { currentReport, previousMonth } = comparison;

  const handleExportExcel = () => {
    if (!canExportReport) return;
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

  if (!canViewReport) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-rose-200 text-center space-y-3 max-w-lg mx-auto mt-10">
        <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
        <h2 className="text-lg font-black text-slate-900">Accès Restreint</h2>
        <p className="text-xs text-slate-600">
          Le Rapport Mensuel Exécutif est réservé aux profils Direction, Responsables et Observateurs autorisés.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[2200px] mx-auto pb-14 print:p-0 print:space-y-4">
      {/* Top Executive Header & Controls */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.08)] space-y-4 print:shadow-none print:border-b-2 print:border-slate-900 print:rounded-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
                Synthèse financière du stock, coûts officiels (BT + PM + Bobinage), discipline préventive, fiabilité Production (MTBF/MTTR/OEE) et liste d’achat prioritaire.
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

            {canExportReport && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel Mensuel (6 Feuilles)</span>
              </button>
            )}
          </div>
        </div>

        {/* Asset Class Filter Strip */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
            {(
              [
                { id: 'ALL', label: 'Tous les actifs' },
                { id: 'PRODUCTION', label: 'Production uniquement' },
                { id: 'SYSTEM_GENERAL', label: 'Système Général' },
              ] as Array<{ id: ReportAssetClassFilter; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAssetClass(opt.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  assetClass === opt.id
                    ? opt.id === 'SYSTEM_GENERAL'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
            <span>
              Coût Total Maintenance Officiel ({selectedMonth}) :{' '}
              <strong className="text-slate-900 font-black">
                {formatCurrency(currentReport.totalOfficialMaintenanceCost)}
              </strong>
            </span>
            {comparison.totalOfficialCostDelta && (
              <DeltaBadge
                delta={comparison.totalOfficialCostDelta}
                invertGoodBad={true}
                unit={` ${currencySymbol}`}
              />
            )}
          </div>
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
                {formatCurrency(currentReport.stockValuationTotal)}
              </span>
              <span className="text-xs font-bold font-mono text-slate-400">(Stock Actuel)</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Consommation du mois :</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(currentReport.monthConsumptionCost)}
                </span>
                <DeltaBadge
                  delta={comparison.consumptionCostDelta}
                  invertGoodBad={true}
                  unit={` ${currencySymbol}`}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Commandes ouvertes ({currentReport.openOrdersCount}) :</span>
              <span className="font-mono font-bold text-indigo-700">
                {formatCurrency(currentReport.openOrdersValue)}
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
                {formatCurrency(currentReport.preventiveTotalCost)}
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
                    <th className="py-2 px-2 text-right">P.U ({currencySymbol})</th>
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
                        {formatCurrency(part.unitPrice)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-black text-indigo-700">
                        {formatCurrency(part.totalCost)}
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
                {formatCurrency(currentReport.correctiveSparesCost)}
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

      {/* Section C1: Official Machine Cost Breakdown (BT + PM + Bobinage Externe) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-emerald-700" />
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Ventilation des Coûts Officiels par Équipement (C1 : BT + PM + Bobinage Externe)
              </h2>
              <p className="text-[11px] text-slate-500">
                Synthèse financière mensuelle consolidée par machine active (hors déclarations terrain non validées).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-mono font-black">
              Total C1 ({selectedMonth}) : {formatCurrency(currentReport.totalOfficialMaintenanceCost ?? 0)}
            </span>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('machines')}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Parc Machines</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {!currentReport.machineCostBreakdown || currentReport.machineCostBreakdown.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Aucun coût officiel (BT approuvé, exécution PM validée ou bobinage externe) enregistré sur {selectedMonth}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-500">
                  <th className="py-2 px-2">Code</th>
                  <th className="py-2 px-2">Désignation Équipement</th>
                  <th className="py-2 px-2">Classe</th>
                  <th className="py-2 px-2 text-right">BT / Arrêt</th>
                  <th className="py-2 px-2 text-right">Coût PDR BT</th>
                  <th className="py-2 px-2 text-right">Coût PM</th>
                  <th className="py-2 px-2 text-right">Bobinage Ext.</th>
                  <th className="py-2 px-2 text-right">Total Officiel (C1)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentReport.machineCostBreakdown.slice(0, 12).map((m) => (
                  <tr key={m.machineCode} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono font-bold text-slate-900">{m.machineCode}</td>
                    <td className="py-2 px-2 font-semibold text-slate-700 truncate max-w-[220px]" title={m.machineName}>
                      {m.machineName}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                          m.assetClass === 'SYSTEM_GENERAL'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {m.assetClass === 'SYSTEM_GENERAL' ? 'SYS. GÉNÉRAL' : 'PRODUCTION'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-700">
                      <span className="font-bold text-slate-900">{m.failureCount}</span> BT
                      {m.totalDowntimeHours > 0 ? ` (${m.totalDowntimeHours}h)` : ''}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-700">
                      {formatCurrency(m.correctivePdrCost)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-700">
                      {formatCurrency(m.preventiveCost)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-700">
                      {formatCurrency(m.externalBobinageCost)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-black text-emerald-800">
                      {formatCurrency(m.totalOfficialCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-mono text-xs font-black text-slate-900">
                  <td colSpan={4} className="py-2.5 px-2">
                    TOTAL CONSOLIDÉ ({currentReport.machineCostBreakdown.length} équipement(s))
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {formatCurrency(currentReport.correctiveSparesCost)}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {formatCurrency(currentReport.preventiveTotalCost)}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {formatCurrency(currentReport.externalBobinageTotalCost ?? 0)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-emerald-800">
                    {formatCurrency(currentReport.totalOfficialMaintenanceCost ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
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
