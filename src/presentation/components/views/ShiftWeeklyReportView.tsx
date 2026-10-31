import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Printer,
  Download,
  Wrench,
  ShieldCheck,
  PackageCheck,
  AlertTriangle,
  Activity,
  Factory,
  Flame,
  ArrowRight,
  CheckCircle2,
  Filter,
  Users,
  Info,
} from 'lucide-react';
import {
  buildShiftOrWeeklyReport,
  buildShiftWeeklyReportCsv,
  buildShiftWeeklyReportJson,
  type ReportAssetClassFilter,
} from '../../../application/services/MonthlyReportCalculationService';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { isTechnicianRole } from '../../../core/security/technicianScope';

export type PeriodPreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_12_MONTHS' | 'CUSTOM';

interface ShiftWeeklyReportViewProps {
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveTasks?: any[];
  preventiveExecutions?: any[];
  sortieDemands?: any[];
  sortiesExterne?: any[];
  machines?: any[];
  onNavigateToTab?: (tab: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

function getYMDWithOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ShiftWeeklyReportView({
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveTasks = [],
  preventiveExecutions = [],
  sortieDemands: propSortieDemands,
  sortiesExterne: propSortiesExterne,
  machines = [],
  onNavigateToTab,
  showToast,
}: ShiftWeeklyReportViewProps) {
  const { user: currentUser } = useAuth();
  const storeSortieDemands = useGmaoStore((s) => s.sortieDemands);
  const storeSortiesExterne = useGmaoStore((s) => s.sortiesExterne);
  const sortieDemands = propSortieDemands ?? storeSortieDemands ?? [];
  const sortiesExterne = propSortiesExterne ?? storeSortiesExterne ?? [];

  // Default period: LAST_7_DAYS (last 7 calendar days inclusive: [today - 6 days .. today])
  const [preset, setPreset] = useState<PeriodPreset>('LAST_7_DAYS');
  const [customFrom, setCustomFrom] = useState<string>(() => getYMDWithOffset(-6));
  const [customTo, setCustomTo] = useState<string>(() => getYMDWithOffset(0));
  const [assetClass, setAssetClass] = useState<ReportAssetClassFilter>('ALL');

  const isAllowed =
    !isTechnicianRole(currentUser) &&
    (!currentUser || AuthorizationService.canAccessTab(currentUser, 'shift_weekly_report'));

  const { activeFrom, activeTo, periodLabel } = useMemo(() => {
    const today = getYMDWithOffset(0);
    const yesterday = getYMDWithOffset(-1);
    const sevenDaysAgo = getYMDWithOffset(-6);
    const twelveMonthsAgo = getYMDWithOffset(-364);

    if (preset === 'TODAY') {
      return {
        activeFrom: today,
        activeTo: today,
        periodLabel: `Aujourd'hui (${today})`,
      };
    }
    if (preset === 'YESTERDAY') {
      return {
        activeFrom: yesterday,
        activeTo: yesterday,
        periodLabel: `Hier (${yesterday})`,
      };
    }
    if (preset === 'LAST_7_DAYS') {
      return {
        activeFrom: sevenDaysAgo,
        activeTo: today,
        periodLabel: `7 derniers jours (${sevenDaysAgo} → ${today})`,
      };
    }
    if (preset === 'LAST_12_MONTHS') {
      return {
        activeFrom: twelveMonthsAgo,
        activeTo: today,
        periodLabel: `12 derniers mois (${twelveMonthsAgo} → ${today})`,
      };
    }
    return {
      activeFrom: customFrom || sevenDaysAgo,
      activeTo: customTo || today,
      periodLabel: `Période (${customFrom || sevenDaysAgo} → ${customTo || today})`,
    };
  }, [preset, customFrom, customTo]);

  const report = useMemo(() => {
    return buildShiftOrWeeklyReport({
      from: activeFrom,
      to: activeTo,
      assetClass,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveTasks,
      preventiveExecutions,
      sortieDemands,
      sortiesExterne,
      machines,
    });
  }, [
    activeFrom,
    activeTo,
    assetClass,
    stockItems,
    mouvements,
    correctiveInterventions,
    preventiveTasks,
    preventiveExecutions,
    sortieDemands,
    sortiesExterne,
    machines,
  ]);

  const handleSelectPreset = (nextPreset: PeriodPreset) => {
    setPreset(nextPreset);
    if (nextPreset === 'TODAY') {
      const t = getYMDWithOffset(0);
      setCustomFrom(t);
      setCustomTo(t);
    } else if (nextPreset === 'YESTERDAY') {
      const y = getYMDWithOffset(-1);
      setCustomFrom(y);
      setCustomTo(y);
    } else if (nextPreset === 'LAST_7_DAYS') {
      setCustomFrom(getYMDWithOffset(-6));
      setCustomTo(getYMDWithOffset(0));
    } else if (nextPreset === 'LAST_12_MONTHS') {
      setCustomFrom(getYMDWithOffset(-364));
      setCustomTo(getYMDWithOffset(0));
    }
  };

  const handleExportCsv = () => {
    try {
      const csvContent = buildShiftWeeklyReportCsv(report);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rapport_Exploitation_${report.fromYMD}_${report.toYMD}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast?.('Rapport (KPIs + Coûts Machines + Mouvements validés) exporté en CSV', 'success');
    } catch (err) {
      console.error('Failed to export shift/weekly CSV:', err);
      showToast?.("Erreur lors de l'export CSV", 'error');
    }
  };

  const handleExportJson = () => {
    try {
      const jsonContent = buildShiftWeeklyReportJson(report);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rapport_Couts_Mouvements_${report.fromYMD}_${report.toYMD}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast?.('Synthèse des coûts officiels & mouvements validés exportée en JSON', 'success');
    } catch (err) {
      console.error('Failed to export shift/weekly JSON:', err);
      showToast?.("Erreur lors de l'export JSON", 'error');
    }
  };

  if (!isAllowed) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl bg-white border border-amber-200 shadow-lg text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
        <h2 className="text-lg font-black text-slate-900">Accès Réservé à l’Encadrement</h2>
        <p className="text-xs text-slate-600">
          Le rapport d’exploitation (Vacation / Hebdo) est réservé aux profils Responsable Maintenance, Responsable Magasin et Administrateur.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[2200px] mx-auto pb-14 print:p-0 print:space-y-4">
      {/* Top Operational Header & Filter Controls */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.08)] flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 print:shadow-none print:border-b-2 print:border-slate-900 print:rounded-none">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 print:hidden">
            <Clock className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Rapport de Vacation / Hebdo — Vue Exploitation
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                {periodLabel} ({report.daysCount} j)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Classe :{' '}
                {assetClass === 'ALL'
                  ? 'Toutes classes'
                  : assetClass === 'PRODUCTION'
                  ? 'Production uniquement'
                  : 'Système Général uniquement'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Synthèse opérationnelle courte durée basée exclusivement sur les interventions et mouvements validés (Maker-Checker respecté).
            </p>
          </div>
        </div>

        {/* Controls: Period Presets + Custom Dates + Asset Class Filter + Export/Print */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {/* Period Preset Selector */}
          <div
            className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200"
            role="group"
            aria-label="Sélecteur de période"
          >
            <button
              type="button"
              onClick={() => handleSelectPreset('TODAY')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                preset === 'TODAY'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Aujourd&apos;hui
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('YESTERDAY')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                preset === 'YESTERDAY'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Hier
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('LAST_7_DAYS')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                preset === 'LAST_7_DAYS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              7 derniers jours
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('LAST_12_MONTHS')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                preset === 'LAST_12_MONTHS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              12 mois
            </button>
            <button
              type="button"
              onClick={() => setPreset('CUSTOM')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                preset === 'CUSTOM'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Personnalisé
            </button>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-500 ml-2" />
            <input
              type="date"
              value={activeFrom}
              onChange={(e) => {
                setPreset('CUSTOM');
                setCustomFrom(e.target.value);
              }}
              aria-label="Date de début"
              className="bg-white px-2 py-1 rounded-lg text-xs font-mono font-bold text-slate-800 border border-slate-200 focus:outline-none focus:border-emerald-600"
            />
            <span className="text-xs font-bold text-slate-400">→</span>
            <input
              type="date"
              value={activeTo}
              onChange={(e) => {
                setPreset('CUSTOM');
                setCustomTo(e.target.value);
              }}
              aria-label="Date de fin"
              className="bg-white px-2 py-1 rounded-lg text-xs font-mono font-bold text-slate-800 border border-slate-200 focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Asset Class Filter */}
          <div
            className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200"
            role="group"
            aria-label="Filtre Classe d'Équipement"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5" />
            {(
              [
                { id: 'ALL', label: 'Toutes classes' },
                { id: 'PRODUCTION', label: 'Production' },
                { id: 'SYSTEM_GENERAL', label: 'Système Général' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAssetClass(opt.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  assetClass === opt.id
                    ? opt.id === 'SYSTEM_GENERAL'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            title="Exporter KPIs, coûts machines officiels et mouvements validés en CSV"
            className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            title="Exporter synthèse des coûts officiels par machine et mouvements validés en JSON"
            className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* Mandatory Honesty Banner: En attente de validation (Exclu des totaux officiels) */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 ${
          report.makerCheckerQueue.totalPendingCount > 0 ||
          report.makerCheckerQueue.totalClarificationCount > 0
            ? 'bg-amber-50/90 border-amber-300/90'
            : 'bg-slate-50 border-slate-200/90'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              report.makerCheckerQueue.totalPendingCount > 0
                ? 'bg-amber-100 border-amber-300 text-amber-800'
                : 'bg-emerald-100 border-emerald-200 text-emerald-700'
            }`}
          >
            {report.makerCheckerQueue.totalPendingCount > 0 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black text-slate-900">
                En attente de validation (Maker-Checker) — Non inclus dans les totaux officiels
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-white border border-amber-300 text-amber-900">
                File actuelle : {report.makerCheckerQueue.totalPendingCount} à valider
                {report.makerCheckerQueue.totalClarificationCount > 0
                  ? ` + ${report.makerCheckerQueue.totalClarificationCount} à clarifier`
                  : ''}
              </span>
              {report.excludedUnapprovedInPeriod.totalExcludedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-100 border border-rose-200 text-rose-800">
                  {report.excludedUnapprovedInPeriod.totalExcludedCount} déclaration(s) non validée(s) sur cette période exclue(s)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Conformément au contrat Maker-Checker, les rapports terrain en statut{' '}
              <code className="px-1 py-0.5 rounded bg-white/80 font-mono text-[11px]">PENDING_VALIDATION</code> ou{' '}
              <code className="px-1 py-0.5 rounded bg-white/80 font-mono text-[11px]">NEEDS_CLARIFICATION</code> ne sont comptabilisés ni dans les clôtures ni dans la consommation PDR avant validation.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-bold text-slate-800">
              <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 font-mono">
                Correctif en attente :{' '}
                <strong className="text-rose-700">{report.makerCheckerQueue.pendingCorrectiveCount}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 font-mono">
                Préventif en attente :{' '}
                <strong className="text-indigo-700">{report.makerCheckerQueue.pendingPreventiveCount}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 font-mono">
                Demandes Sortie PDR :{' '}
                <strong className="text-amber-700">{report.makerCheckerQueue.pendingSortieDemandsCount}</strong>
              </span>
              {report.makerCheckerQueue.totalReservedUnits > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 font-mono text-slate-600">
                  PDR réservées (lecture seule) :{' '}
                  <strong>
                    {report.makerCheckerQueue.totalReservedUnits} u. ({report.makerCheckerQueue.reservedRefsCount} réf.)
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {onNavigateToTab && (
          <button
            type="button"
            onClick={() => onNavigateToTab('validation_center')}
            className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold inline-flex items-center gap-2 shrink-0 cursor-pointer transition shadow-xs print:hidden"
          >
            <span>Ouvrir le Centre de Validation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 4 Primary Exploitation KPI Cards (Approved Only) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Correctif Approuvé */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              1. Correctif (Approuvé)
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono">
                {report.correctiveClosedInPeriodCount}
              </span>
              <span className="text-xs font-bold text-slate-500">
                clôturé(s) sur {report.correctiveTotalInPeriodCount} BT dans la période
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold">
                Ouverts (snapshot) : {report.correctiveOpenSnapshotCount}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-semibold">
                Arrêt : {report.totalDowntimeHours} h
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Coût PDR validé :</span>
            <span className="font-mono font-bold text-slate-800">
              {report.correctiveSparesCost.toLocaleString('fr-FR')} €
            </span>
          </div>
        </div>

        {/* Card 2: Préventif & Discipline */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              2. Préventif (Approuvé)
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono">
                {report.preventiveExecutedInPeriodCount}
              </span>
              <span className="text-xs font-bold text-slate-500">
                exécution(s) validée(s) ({report.preventiveLaborHours} h)
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold">
                À temps (ON_TIME) : {report.pmCompliance.onTimeComplianceRate}% ({report.pmCompliance.onTimeCount}/{report.pmCompliance.totalEligibleCount})
              </span>
              {report.pmCompliance.lateCompletedCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold">
                  Fait en retard (LATE) : {report.pmCompliance.lateCompletedCount}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-md font-mono font-bold border ${
                  report.pmCompliance.overdueCount > 0
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title={report.overdueSnapshotDefinition}
              >
                OVERDUE : {report.pmCompliance.overdueCount}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Coût PDR préventif validé :</span>
            <span className="font-mono font-bold text-slate-800">
              {report.preventiveTotalCost.toLocaleString('fr-FR')} €
            </span>
          </div>
        </div>

        {/* Card 3: Magasin & Sorties Validées */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              3. Magasin (Mouvements Validés)
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono">
                {report.sortiesCount}
              </span>
              <span className="text-xs font-bold text-slate-500">
                sortie(s) officielle(s) ({report.sortiesTotalQuantity} pcs)
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-900 border border-cyan-200 font-mono font-bold">
                Consommation : {report.consumptionCost.toLocaleString('fr-FR')} €
              </span>
              {report.pendingSortieDemandsWarningCount > 0 ? (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-mono font-bold">
                  ⚠️ {report.pendingSortieDemandsWarningCount} demande(s) en attente (non déduites)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                  0 demande en attente
                </span>
              )}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Entrées stock sur la période :</span>
            <span className="font-mono font-bold text-slate-800">
              {report.entreesCount} ({report.entriesCost.toLocaleString('fr-FR')} €)
            </span>
          </div>
        </div>

        {/* Card 4: Fiabilité Production & Système Général */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              4. Fiabilité Prod. & Sys. Général
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono">
                {report.availabilityRate}%
              </span>
              <span className="text-xs font-bold text-slate-500">
                disponibilité ({report.productionMachinesCount} mach. PRODUCTION)
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold">
                MTBF Prod : {report.mtbfHours} h
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold">
                MTTR Prod : {report.mttrFormatted}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Activité Système Général (période) :</span>
            <span className="font-mono font-bold text-amber-800">
              {report.systemGeneralSummary.correctiveInPeriodCount} BT /{' '}
              {report.systemGeneralSummary.preventiveInPeriodCount} PM
            </span>
          </div>
        </div>
      </div>

      {/* Main Operational Grid: Top Failing Machines + Overdue Preventive Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1 Detail: Top Machines / Arrêts Correctifs & Coûts Officiels (C1) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Factory className="w-4 h-4 text-amber-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Équipements Sollicités & Coûts Officiels par Machine (C1)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Uniquement BT approuvés, exécutions PM validées et bobinage externe officiel (hors PENDING/rejetés)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-mono font-black">
                Total Officiel : {report.totalOfficialMaintenanceCost} €
              </span>
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab('corrective')}
                  className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer print:hidden"
                >
                  <span>Correctif Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="p-5 flex-1">
            {report.machineCostBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Aucune intervention ou dépense officielle enregistrée sur la période sélectionnée.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500">
                      <th className="py-2 pr-2">Code</th>
                      <th className="py-2 px-2">Équipement</th>
                      <th className="py-2 px-2 text-right">BT / Arrêt</th>
                      <th className="py-2 px-2 text-right">Coût BT</th>
                      <th className="py-2 px-2 text-right">Coût PM</th>
                      <th className="py-2 px-2 text-right">Externe</th>
                      <th className="py-2 pl-2 text-right">Total Officiel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.machineCostBreakdown.slice(0, 12).map((m) => (
                      <tr key={m.machineCode} className="hover:bg-slate-50/80">
                        <td className="py-2.5 pr-2 font-mono font-bold text-slate-900">
                          {m.machineCode}
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-slate-700">
                          <div className="truncate max-w-[160px]" title={m.machineName}>
                            {m.machineName}
                          </div>
                          <span
                            className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${
                              m.assetClass === 'SYSTEM_GENERAL'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {m.assetClass === 'SYSTEM_GENERAL' ? 'SYS. GÉNÉRAL' : 'PRODUCTION'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                          <span className="font-bold text-slate-900">{m.failureCount}</span> BT
                          {m.totalDowntimeHours > 0 && (
                            <span className="block text-[10px] font-bold text-rose-700">
                              {m.totalDowntimeHours} h
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                          {m.correctivePdrCost} €
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                          {m.preventiveCost} €
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                          {m.externalBobinageCost} €
                        </td>
                        <td className="py-2.5 pl-2 text-right font-mono font-black text-emerald-800">
                          {m.totalOfficialCost} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-mono text-xs font-black text-slate-900">
                      <td colSpan={3} className="py-2.5 pr-2">
                        TOTAL PÉRIODE ({report.machineCostBreakdown.length} machine(s))
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {Math.round(
                          report.machineCostBreakdown.reduce((s, r) => s + r.correctivePdrCost, 0) * 100
                        ) / 100}{' '}
                        €
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {Math.round(
                          report.machineCostBreakdown.reduce((s, r) => s + r.preventiveCost, 0) * 100
                        ) / 100}{' '}
                        €
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {Math.round(
                          report.machineCostBreakdown.reduce((s, r) => s + r.externalBobinageCost, 0) * 100
                        ) / 100}{' '}
                        €
                      </td>
                      <td className="py-2.5 pl-2 text-right text-emerald-800">
                        {report.totalOfficialMaintenanceCost} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Section 2 Detail: Préventif & Snapshot des Tâches en Retard */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900">
                Conformité Temporelle Préventive (B3) & Tâches en Retard ({report.pmCompliance.overdueCount})
              </h3>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('preventive')}
                className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Planning Préventif</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-5 space-y-3 flex-1" data-testid="b3-pm-compliance-section">
            {/* B3 Temporal Compliance Summary Strip: ON_TIME | LATE | OVERDUE */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
                <div className="text-[10px] font-extrabold uppercase text-emerald-800">À temps (ON_TIME)</div>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="text-lg font-black font-mono text-emerald-900">{report.pmCompliance.onTimeCount}</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-700">{report.pmCompliance.onTimeComplianceRate}%</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200">
                <div className="text-[10px] font-extrabold uppercase text-amber-800">Fait en retard (LATE)</div>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="text-lg font-black font-mono text-amber-900">{report.pmCompliance.lateCompletedCount}</span>
                  <span className="text-[10px] font-mono text-amber-700">Validé &gt; échéance</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200">
                <div className="text-[10px] font-extrabold uppercase text-rose-800">En retard (OVERDUE)</div>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="text-lg font-black font-mono text-rose-900">{report.pmCompliance.overdueCount}</span>
                  <span className="text-[10px] font-mono text-rose-700">Non validé</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-extrabold uppercase text-slate-600">Dénominateur actif</div>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="text-lg font-black font-mono text-slate-900">{report.pmCompliance.totalEligibleCount}</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Réalisé: {report.pmCompliance.overallCompletionRate}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-[11px] text-slate-600">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>
                  <strong>Règle B3 (Vérité Validée) :</strong> Seules les exécutions <strong>approuvées</strong> (hors{' '}
                  <code className="font-mono">PENDING_VALIDATION</code> / <code className="font-mono">REJECTED</code>) comptent comme réalisées (
                  <code className="font-mono font-bold text-emerald-800">ON_TIME</code> si date réalisation ≤ échéance,{' '}
                  <code className="font-mono font-bold text-amber-800">LATE</code> si &gt; échéance). Les tâches et machines archivées / inactives sont exclues du dénominateur.
                </p>
                {(report.pmCompliance.pendingClaimsExcludedCount > 0 || report.pmCompliance.archivedExcludedCount > 0) && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 font-mono text-[10px]">
                    {report.pmCompliance.pendingClaimsExcludedCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                        {report.pmCompliance.pendingClaimsExcludedCount} déclaration(s) PENDING non comptée(s) comme réalisée(s)
                      </span>
                    )}
                    {report.pmCompliance.archivedExcludedCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                        {report.pmCompliance.archivedExcludedCount} tâche(s)/machine(s) archivée(s) hors dénominateur
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {report.overdueTasksSample.length === 0 ? (
              <div className="py-6 text-center text-xs text-emerald-700 font-semibold">
                Aucune tâche préventive en retard sur ce périmètre.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500">
                      <th className="py-2 pr-3">Équipement</th>
                      <th className="py-2 px-3">Tâche préventive</th>
                      <th className="py-2 px-3">Responsable</th>
                      <th className="py-2 pl-3 text-right">Échéance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.overdueTasksSample.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80">
                        <td className="py-2 pr-3 font-mono font-bold text-slate-900">
                          {t.machineCode}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-700">{t.taskName}</td>
                        <td className="py-2 px-3 text-slate-600">{t.assignedTo}</td>
                        <td className="py-2 pl-3 text-right font-mono font-bold text-rose-700">
                          {t.dueDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Magasin Consommations + Système Général & Charge Équipe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 3 Detail: Magasin & Top Pièces Consommées */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PackageCheck className="w-4 h-4 text-cyan-600" />
              <h3 className="text-sm font-black text-slate-900">
                Top PDR Consommées (Mouvements Sortie Officiels)
              </h3>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('sortie')}
                className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer print:hidden"
              >
                <span>Mouvements Stock</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-5 flex-1 space-y-4">
            {/* C3 — Compact Stock Reorder Alert Strip (Rupture / Sous Seuil / Risque après réservation) */}
            <div
              className={`p-3.5 rounded-xl border ${
                report.stockReorderAlerts.totalAlertCount > 0
                  ? 'bg-amber-50/80 border-amber-200'
                  : 'bg-emerald-50/60 border-emerald-200'
              }`}
              data-testid="c3-report-reorder-alert-section"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 ${
                      report.stockReorderAlerts.totalAlertCount > 0
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  />
                  <span className="text-xs font-black text-slate-900">
                    Alerte Réapprovisionnement (C3) : {report.stockReorderAlerts.totalAlertCount} article(s)
                  </span>
                  {report.stockReorderAlerts.ruptureCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-200">
                      {report.stockReorderAlerts.ruptureCount} rupture
                    </span>
                  )}
                  {report.stockReorderAlerts.sousSeuilCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      {report.stockReorderAlerts.sousSeuilCount} sous seuil
                    </span>
                  )}
                  {report.stockReorderAlerts.reservationRiskCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-900 border border-purple-200">
                      {report.stockReorderAlerts.reservationRiskCount} après réservation
                    </span>
                  )}
                </div>
                {onNavigateToTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('stock')}
                    className="text-[11px] font-bold text-amber-900 hover:underline inline-flex items-center gap-1 cursor-pointer print:hidden"
                  >
                    <span>Catalogue Stock</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {report.stockReorderAlerts.items.length > 0 && (
                <div className="mt-2.5 overflow-x-auto bg-white rounded-lg border border-amber-200/80">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-500">
                        <th className="py-1.5 px-2.5">Réf</th>
                        <th className="py-1.5 px-2.5">Désignation</th>
                        <th className="py-1.5 px-2.5 text-right">Actuel</th>
                        <th className="py-1.5 px-2.5 text-right">Net Dispo</th>
                        <th className="py-1.5 px-2.5 text-right">Seuil</th>
                        <th className="py-1.5 px-2.5 text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.stockReorderAlerts.items.slice(0, 5).map((it) => (
                        <tr key={it.ref}>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900">{it.ref}</td>
                          <td className="py-1.5 px-2.5 text-slate-700 truncate max-w-[140px]">
                            {it.designation}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                            {it.stockActuel}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold text-rose-700">
                            {it.netAvailable}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono text-slate-600">
                            {it.seuil}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold text-amber-900">
                            {it.statusLabelFr}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {report.topConsumedParts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Aucun mouvement de sortie officiel enregistré sur cette période.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500">
                      <th className="py-2 pr-3">Référence</th>
                      <th className="py-2 px-3">Désignation</th>
                      <th className="py-2 px-3 text-right">Qté Sortie</th>
                      <th className="py-2 pl-3 text-right">Coût Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.topConsumedParts.map((part) => (
                      <tr key={part.ref} className="hover:bg-slate-50/80">
                        <td className="py-2 pr-3 font-mono font-bold text-slate-900">{part.ref}</td>
                        <td className="py-2 px-3 font-semibold text-slate-700">
                          {part.designation}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {part.quantity} {part.unit}
                        </td>
                        <td className="py-2 pl-3 text-right font-mono font-bold text-cyan-800">
                          {part.totalCost.toLocaleString('fr-FR')} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Section 5 Detail: Système Général (Sécurité / Utilités) & Charge Techniciens */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Flame className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-black text-slate-900">
                Exploitation Système Général & Activité Équipe
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
              {report.systemGeneralSummary.totalAssetsCount} équipement(s) SYS. GÉNÉRAL
            </span>
          </div>

          <div className="p-5 space-y-4 flex-1">
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-[11px] text-amber-950">
              Les équipements <strong>Système Général</strong> (sécurité incendie, air comprimé, utilités) sont suivis séparément et n&apos;altèrent jamais le calcul du <strong>MTBF Production</strong> ({report.mtbfHours} h).
            </div>

            {report.systemGeneralSummary.bySystemType.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {report.systemGeneralSummary.bySystemType.map((st) => (
                  <div
                    key={st.systemTypeCode}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90"
                  >
                    <div className="text-[11px] font-mono font-extrabold text-slate-900">
                      {st.systemTypeCode}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {st.assetsCount} actif(s) •{' '}
                      <strong className="text-slate-800">{st.correctiveCount} BT</strong> •{' '}
                      <strong className="text-indigo-700">{st.preventiveCount} PM</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Technician Breakdown */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 mb-2">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Répartition Intervenants (Travaux Approuvés sur la Période)</span>
              </div>
              {report.technicianBreakdown.length === 0 ? (
                <div className="text-xs text-slate-500 py-2">
                  Aucune intervention approuvée enregistrée sur la période.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {report.technicianBreakdown.slice(0, 6).map((tech) => (
                    <div
                      key={tech.name}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-2"
                    >
                      <span className="font-bold text-slate-900">{tech.name}</span>
                      <span className="font-mono text-[11px] text-slate-600">
                        {tech.correctiveCount} BT • {tech.preventiveCount} PM ({tech.totalHours}h)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
