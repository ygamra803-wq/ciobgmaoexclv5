import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Printer,
  Download,
  FileSpreadsheet,
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
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
  Calculator,
  X,
} from 'lucide-react';
import {
  buildShiftOrWeeklyReport,
  buildShiftWeeklyReportCsv,
  buildShiftWeeklyReportJson,
  type ReportAssetClassFilter,
} from '../../../application/services/MonthlyReportCalculationService';
import { MonthlyReportExportService } from '../../../services/monthlyReportExportService';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { isTechnicianRole } from '../../../core/security/technicianScope';
import { useCurrency } from '../../../utils/currencyService';
import AnimatedPage from '../common/AnimatedPage';
import PageHeaderIcon from '../common/PageHeaderIcon';
import Action3DButton from '../common/Action3DButton';
import FormulasModalButton from '../common/FormulasModalButton';
import GmaoKpiCard, { GmaoKpiGrid } from '../common/GmaoKpiCard';
import TablePaginationCard from '../common/TablePaginationCard';

export type PeriodPreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_12_MONTHS' | 'CUSTOM';

type ShiftC1SortKey =
  | 'totalOfficialCost'
  | 'correctivePdrCost'
  | 'preventiveCost'
  | 'externalBobinageCost'
  | 'failureCount'
  | 'machineCode';

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
  const { formatCurrency } = useCurrency();
  const storeSortieDemands = useGmaoStore((s) => s.sortieDemands);
  const storeSortiesExterne = useGmaoStore((s) => s.sortiesExterne);
  const sortieDemands = propSortieDemands ?? storeSortieDemands ?? [];
  const sortiesExterne = propSortiesExterne ?? storeSortiesExterne ?? [];

  // Default period: LAST_7_DAYS (last 7 calendar days inclusive: [today - 6 days .. today])
  const [preset, setPreset] = useState<PeriodPreset>('LAST_7_DAYS');
  const [customFrom, setCustomFrom] = useState<string>(() => getYMDWithOffset(-6));
  const [customTo, setCustomTo] = useState<string>(() => getYMDWithOffset(0));
  const [assetClass, setAssetClass] = useState<ReportAssetClassFilter>('ALL');
  const [focusedKpi, setFocusedKpi] = useState<string | null>(null);
  const [showFormulasModal, setShowFormulasModal] = useState(false);

  // C1 Table Search, Sort & Pagination State
  const [c1Search, setC1Search] = useState('');
  const [c1SortKey, setC1SortKey] = useState<ShiftC1SortKey>('totalOfficialCost');
  const [c1SortDir, setC1SortDir] = useState<'asc' | 'desc'>('desc');
  const [c1Page, setC1Page] = useState(1);
  const [c1PageSize, setC1PageSize] = useState(8);

  const isAllowed =
    Boolean(currentUser) &&
    !isTechnicianRole(currentUser) &&
    AuthorizationService.canAccessTab(currentUser, 'shift_weekly_report');

  const canExportReport =
    Boolean(currentUser) && AuthorizationService.hasPermission(currentUser, 'report.export');

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

  // Filtered & sorted C1 Machine Cost Breakdown
  const filteredAndSortedC1 = useMemo(() => {
    const raw = report.machineCostBreakdown || [];
    const q = c1Search.trim().toLowerCase();
    const filtered = q
      ? raw.filter(
          (m) =>
            String(m.machineCode || '').toLowerCase().includes(q) ||
            String(m.machineName || '').toLowerCase().includes(q) ||
            String(m.assetClass || '').toLowerCase().includes(q)
        )
      : raw;

    return [...filtered].sort((a, b) => {
      if (c1SortKey === 'machineCode') {
        const cmp = String(a.machineCode || '').localeCompare(String(b.machineCode || ''));
        return c1SortDir === 'asc' ? cmp : -cmp;
      }
      const valA = Number(a[c1SortKey] || 0);
      const valB = Number(b[c1SortKey] || 0);
      return c1SortDir === 'asc' ? valA - valB : valB - valA;
    });
  }, [report.machineCostBreakdown, c1Search, c1SortKey, c1SortDir]);

  const paginatedC1 = useMemo(() => {
    if (c1PageSize === 0) return filteredAndSortedC1;
    const start = (c1Page - 1) * c1PageSize;
    return filteredAndSortedC1.slice(start, start + c1PageSize);
  }, [filteredAndSortedC1, c1Page, c1PageSize]);

  const handleC1Sort = (key: ShiftC1SortKey) => {
    if (c1SortKey === key) {
      setC1SortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setC1SortKey(key);
      setC1SortDir(key === 'machineCode' ? 'asc' : 'desc');
    }
    setC1Page(1);
  };

  const renderSortIcon = (key: ShiftC1SortKey) => {
    if (c1SortKey !== key) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    return c1SortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-700" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-700" />
    );
  };

  const handleSelectPreset = (nextPreset: PeriodPreset) => {
    setPreset(nextPreset);
    setC1Page(1);
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

  const handleExportExcel = () => {
    if (!canExportReport) return;
    try {
      const fileName = MonthlyReportExportService.exportShiftWeeklyReportToExcel(report);
      showToast?.(`Rapport d'exploitation multi-feuilles exporté : ${fileName}`, 'success');
    } catch (err) {
      console.error('Failed to export shift/weekly Excel:', err);
      showToast?.("Erreur lors de l'export Excel (.xlsx)", 'error');
    }
  };

  const handleExportCsv = () => {
    if (!canExportReport) return;
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
    if (!canExportReport) return;
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

  const shiftFormulas = useMemo(
    () => [
      {
        title: '1. Contrat Maker-Checker (Vérité Validée Uniquement)',
        formula: 'Totaux Officiels = ∑ (BT Approuvés + PM Validés + Sorties Magasin Validées)',
        description:
          'Toute déclaration terrain en statut PENDING_VALIDATION, NEEDS_CLARIFICATION ou REJECTED est strictement exclue des clôtures et de la consommation PDR.',
      },
      {
        title: '2. Conformité Temporelle Préventive (Règle B3)',
        formula: 'ON_TIME : Date Exécution ≤ Échéance  |  LATE : Date Exécution > Échéance  |  OVERDUE : Échéance Dépassée Non Validée',
        description:
          'Seules les exécutions approuvées comptent comme réalisées. Les tâches et machines archivées sont exclues du dénominateur actif.',
      },
      {
        title: '3. Ventilation Officielle des Coûts par Machine (C1)',
        formula: 'Coût Machine (C1) = Coût PDR BT + Coût PDR PM + Coût Bobinage/Prestation Externe',
        description:
          'Agrège les dépenses officielles validées sur la fenêtre temporelle [Du → Au] sélectionnée.',
      },
      {
        title: '4. Alerte Réapprovisionnement & Risque Réservation (C3)',
        formula: 'Net Disponible = Stock Actuel Physique − Quantités Réservées (PENDING_VALIDATION)',
        description:
          'Détecte les articles en RUPTURE (≤ 0), SOUS SEUIL (≤ Seuil) ou en RISQUE APRÈS RÉSERVATION (Net Disponible ≤ Seuil) sans altérer le stock physique.',
      },
      {
        title: '5. Isolation Fiabilité Production vs Système Général',
        formula: 'MTBF Production = Heures Ouverture Parc Production / Pannes Production',
        description:
          'Les interventions sur les utilités (Système Général) sont suivies dans un panneau dédié pour préserver l’intégrité du MTBF/OEE des lignes de production.',
      },
    ],
    []
  );

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
    <AnimatedPage className="space-y-5 max-w-[2200px] mx-auto pb-14 print:p-0 print:space-y-4">
      {/* 1. Clean Single-Row Floating Header Card (matching UtilisateursView & EquipmentView) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex items-center justify-between gap-3 sm:gap-4 w-full relative overflow-hidden group/header print:shadow-none print:border-b-2 print:border-slate-900 print:rounded-none">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-emerald-500/10 transition-colors duration-500 print:hidden" />

        <div className="flex items-center gap-3.5 min-w-0 relative z-10">
          <div className="print:hidden">
            <PageHeaderIcon icon={Clock} colorClass="text-emerald-700" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                Rapport de Vacation / Hebdo — Vue Exploitation
              </h1>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                {periodLabel} ({report.daysCount} j)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Synthèse opérationnelle courte durée basée exclusivement sur les interventions et mouvements validés (Maker-Checker respecté).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative z-10 print:hidden">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title="Formules & Règles — Rapport Vacation / Hebdo"
          />

          {canExportReport && (
            <Action3DButton
              variant="circle"
              color="emerald"
              icon={FileSpreadsheet}
              title="Exporter le rapport d'exploitation vers Excel (.xlsx)"
              ariaLabel="Excel (.xlsx)"
              onClick={handleExportExcel}
            />
          )}

          <Action3DButton
            variant="circle"
            color="slate"
            icon={Printer}
            title="Imprimer le rapport d'exploitation"
            ariaLabel="Imprimer"
            onClick={() => window.print()}
          />
        </div>
      </div>

      {/* 2. Mandatory Honesty Banner: En attente de validation (Exclu des totaux officiels) */}
      <div
        className={`rounded-2xl border overflow-hidden shadow-xs transition-all ${
          report.makerCheckerQueue.totalPendingCount > 0 ||
          report.makerCheckerQueue.totalClarificationCount > 0
            ? 'bg-amber-50/90 border-amber-300/90'
            : 'bg-white border-slate-200/90'
        }`}
      >
        <div
          className={`h-1 w-full ${
            report.makerCheckerQueue.totalPendingCount > 0 ||
            report.makerCheckerQueue.totalClarificationCount > 0
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500'
          }`}
        />
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
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
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-slate-900">
                  En attente de validation (Maker-Checker) — Non inclus dans les totaux officiels
                </h2>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-extrabold bg-white border border-amber-300 text-amber-900">
                  File actuelle : {report.makerCheckerQueue.totalPendingCount} à valider
                  {report.makerCheckerQueue.totalClarificationCount > 0
                    ? ` + ${report.makerCheckerQueue.totalClarificationCount} à clarifier`
                    : ''}
                </span>
                {report.excludedUnapprovedInPeriod.totalExcludedCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-rose-100 border border-rose-200 text-rose-800">
                    {report.excludedUnapprovedInPeriod.totalExcludedCount} déclaration(s) non validée(s) sur cette période exclue(s)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Conformément au contrat Maker-Checker, les rapports terrain en statut{' '}
                <code className="px-1 py-0.5 rounded bg-white/80 font-mono text-[11px]">PENDING_VALIDATION</code> ou{' '}
                <code className="px-1 py-0.5 rounded bg-white/80 font-mono text-[11px]">NEEDS_CLARIFICATION</code> ne sont comptabilisés ni dans les clôtures ni dans la consommation PDR avant validation.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs font-bold text-slate-800">
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 font-mono shadow-2xs">
                  Correctif en attente :{' '}
                  <strong className="text-rose-700">{report.makerCheckerQueue.pendingCorrectiveCount}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 font-mono shadow-2xs">
                  Préventif en attente :{' '}
                  <strong className="text-indigo-700">{report.makerCheckerQueue.pendingPreventiveCount}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 font-mono shadow-2xs">
                  Demandes Sortie PDR :{' '}
                  <strong className="text-amber-700">{report.makerCheckerQueue.pendingSortieDemandsCount}</strong>
                </span>
                {report.makerCheckerQueue.totalReservedUnits > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 font-mono text-slate-600 shadow-2xs">
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
      </div>

      {/* 3. 4-Tier Primary Exploitation KPI Cards (Approved Only) */}
      <GmaoKpiGrid columns={4}>
        <GmaoKpiCard
          title="1. Correctif (Approuvé)"
          value={report.correctiveClosedInPeriodCount}
          unit={`clôturé(s) / ${report.correctiveTotalInPeriodCount} BT`}
          icon={Wrench}
          color="amber"
          badgeText={`Ouverts: ${report.correctiveOpenSnapshotCount} · Arrêt: ${report.totalDowntimeHours}h`}
          footerLabel="Coût PDR validé"
          footerValue={formatCurrency(report.correctiveSparesCost)}
          isActive={focusedKpi === 'CORRECTIVE'}
          onClick={() => setFocusedKpi(focusedKpi === 'CORRECTIVE' ? null : 'CORRECTIVE')}
        />
        <GmaoKpiCard
          title="2. Préventif (Approuvé)"
          value={report.preventiveExecutedInPeriodCount}
          unit={`exécution(s) (${report.preventiveLaborHours} h)`}
          icon={ShieldCheck}
          color="indigo"
          badgeText={`À temps (ON_TIME): ${report.pmCompliance.onTimeComplianceRate}% (${report.pmCompliance.onTimeCount}/${report.pmCompliance.totalEligibleCount})`}
          footerLabel="Coût PDR préventif validé"
          footerValue={formatCurrency(report.preventiveTotalCost)}
          isActive={focusedKpi === 'PREVENTIVE'}
          onClick={() => setFocusedKpi(focusedKpi === 'PREVENTIVE' ? null : 'PREVENTIVE')}
        />
        <GmaoKpiCard
          title="3. Magasin (Mouvements Validés)"
          value={report.sortiesCount}
          unit={`sortie(s) officielle(s) (${report.sortiesTotalQuantity} pcs)`}
          icon={PackageCheck}
          color="cyan"
          badgeText={`Consommation: ${formatCurrency(report.consumptionCost)}`}
          footerLabel="Entrées stock sur la période"
          footerValue={`${report.entreesCount} (${formatCurrency(report.entriesCost)})`}
          isActive={focusedKpi === 'MAGASIN'}
          onClick={() => setFocusedKpi(focusedKpi === 'MAGASIN' ? null : 'MAGASIN')}
        />
        <GmaoKpiCard
          title="4. Fiabilité Prod. & Sys. Général"
          value={report.availabilityRate}
          unit={`% dispo (${report.productionMachinesCount} mach. PROD)`}
          icon={Activity}
          color="emerald"
          badgeText={`MTBF Prod: ${report.mtbfHours}h · MTTR: ${report.mttrFormatted}`}
          footerLabel="Activité Système Général"
          footerValue={`${report.systemGeneralSummary.correctiveInPeriodCount} BT / ${report.systemGeneralSummary.preventiveInPeriodCount} PM`}
          isActive={focusedKpi === 'RELIABILITY'}
          onClick={() => setFocusedKpi(focusedKpi === 'RELIABILITY' ? null : 'RELIABILITY')}
        />
      </GmaoKpiGrid>

      {/* 3B. Dedicated Elevated Filter & Period Card (matching UtilisateursView & EquipmentView) */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4 print:hidden">
        {/* Header Toolbar: Icon + Title + Period Badge + Export Buttons + Circular Reset */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Filtres & Période d&apos;Exploitation
                </span>
                <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-amber-200/70 shadow-2xs font-mono">
                  {activeFrom} → {activeTo} ({report.daysCount} j)
                </span>
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-slate-200 font-mono">
                  {assetClass === 'ALL'
                    ? 'Toutes classes'
                    : assetClass === 'PRODUCTION'
                    ? 'Parc Production'
                    : 'Système Général'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Sélection de la fenêtre temporelle de vacation/hebdo, bornes Du → Au et périmètre d&apos;équipements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {canExportReport && (
              <>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  title="Exporter le rapport multi-feuilles vers Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="h-8 px-3 rounded-xl border border-cyan-200/80 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  title="Exporter la synthèse en CSV"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-600" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="h-8 px-3 rounded-xl border border-indigo-200/80 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  title="Exporter la synthèse en JSON"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>JSON</span>
                </button>
              </>
            )}

            {(preset !== 'LAST_7_DAYS' || assetClass !== 'ALL' || focusedKpi) && (
              <button
                type="button"
                onClick={() => {
                  handleSelectPreset('LAST_7_DAYS');
                  setAssetClass('ALL');
                  setFocusedKpi(null);
                }}
                title="Réinitialiser la période (7 derniers jours) et le périmètre"
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 3-Column Structured Filter Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-end">
          {/* 1. Period Preset Selector */}
          <div className="xl:col-span-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                Fenêtre Temporelle Rapide
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                Vacation / Hebdo
              </span>
            </div>
            <div
              className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 min-h-10"
              role="group"
              aria-label="Sélecteur de période"
            >
              {(
                [
                  { id: 'TODAY', label: "Aujourd'hui" },
                  { id: 'YESTERDAY', label: 'Hier' },
                  { id: 'LAST_7_DAYS', label: '7 derniers jours' },
                  { id: 'LAST_12_MONTHS', label: '12 mois' },
                  { id: 'CUSTOM', label: 'Personnalisé' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    item.id === 'CUSTOM' ? setPreset('CUSTOM') : handleSelectPreset(item.id)
                  }
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    preset === item.id
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Date Range Inputs (Du -> Au) */}
          <div className="xl:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                Plage de Dates (Du → Au)
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                Calendrier
              </span>
            </div>
            <div className="flex items-center gap-1.5 h-10 px-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                <Calendar className="w-3 h-3" />
              </span>
              <input
                type="date"
                value={activeFrom}
                onChange={(e) => {
                  setPreset('CUSTOM');
                  setCustomFrom(e.target.value);
                  setC1Page(1);
                }}
                aria-label="Date de début"
                className="flex-1 min-w-0 bg-white px-2 py-1 rounded-lg text-xs font-mono font-bold text-slate-800 border border-slate-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-xs font-bold text-slate-400 shrink-0">→</span>
              <input
                type="date"
                value={activeTo}
                onChange={(e) => {
                  setPreset('CUSTOM');
                  setCustomTo(e.target.value);
                  setC1Page(1);
                }}
                aria-label="Date de fin"
                className="flex-1 min-w-0 bg-white px-2 py-1 rounded-lg text-xs font-mono font-bold text-slate-800 border border-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* 3. Asset Class Filter */}
          <div className="xl:col-span-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                Périmètre Parc Machines
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                Col. B
              </span>
            </div>
            <div
              className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 h-10"
              role="group"
              aria-label="Filtre Classe d'Équipement"
            >
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
                  onClick={() => {
                    setAssetClass(opt.id);
                    setC1Page(1);
                  }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer truncate ${
                    assetClass === opt.id
                      ? opt.id === 'SYSTEM_GENERAL'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Operational Badges Bar (Preserves exact operational telemetry & warnings) */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold">
            Ouverts (snapshot) : {report.correctiveOpenSnapshotCount}
          </span>
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

        {focusedKpi && (
          <button
            type="button"
            onClick={() => setFocusedKpi(null)}
            className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <span>Focus : {focusedKpi}</span>
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 4. Main Operational Grid: Top Failing Machines (C1) + Overdue Preventive Snapshot (B3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1 Detail: Top Machines / Arrêts Correctifs & Coûts Officiels (C1) */}
        <div
          className={`bg-white rounded-2xl border transition-all duration-300 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col ${
            focusedKpi === 'CORRECTIVE'
              ? 'border-amber-400 ring-2 ring-amber-500/20'
              : 'border-slate-200/90'
          }`}
        >
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-600" />
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-2 flex-wrap bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <Factory className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Équipements Sollicités & Coûts Officiels par Machine (C1)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Uniquement BT approuvés, exécutions PM validées et bobinage externe officiel (hors PENDING/rejetés)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-mono font-black">
                Total Officiel : {formatCurrency(report.totalOfficialMaintenanceCost)}
              </span>
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab('corrective')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 cursor-pointer print:hidden"
                >
                  <span>Correctif Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Inline Excel Filter & Sort Strip for C1 */}
          {report.machineCostBreakdown.length > 0 && (
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 print:hidden">
              <div className="relative flex-1 min-w-[180px]">
                <div className="w-5 h-5 rounded bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Search className="w-3 h-3" />
                </div>
                <input
                  type="text"
                  value={c1Search}
                  onChange={(e) => {
                    setC1Search(e.target.value);
                    setC1Page(1);
                  }}
                  placeholder="Filtrer code ou équipement..."
                  className="w-full h-8 pl-8 pr-14 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1 py-0.2 rounded bg-slate-100 text-[9px] font-mono font-bold text-slate-500">
                  Col A-B
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={c1SortKey}
                  onChange={(e) => {
                    setC1SortKey(e.target.value as ShiftC1SortKey);
                    setC1Page(1);
                  }}
                  aria-label="Trier les équipements sollicités"
                  className="h-8 px-2 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 focus:outline-none"
                >
                  <option value="totalOfficialCost">Tri: Total Officiel</option>
                  <option value="correctivePdrCost">Tri: Coût BT</option>
                  <option value="preventiveCost">Tri: Coût PM</option>
                  <option value="externalBobinageCost">Tri: Externe</option>
                  <option value="failureCount">Tri: BT / Arrêt</option>
                  <option value="machineCode">Tri: Code</option>
                </select>
                <button
                  type="button"
                  onClick={() => setC1SortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title={c1SortDir === 'asc' ? 'Croissant' : 'Décroissant'}
                >
                  {c1SortDir === 'asc' ? (
                    <ArrowUp className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-700" />
                  )}
                </button>
                {c1Search && (
                  <button
                    type="button"
                    onClick={() => {
                      setC1Search('');
                      setC1Page(1);
                    }}
                    className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 cursor-pointer"
                    title="Réinitialiser"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col justify-between">
            {report.machineCostBreakdown.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Aucune intervention ou dépense officielle enregistrée sur la période sélectionnée.
              </div>
            ) : filteredAndSortedC1.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Aucun équipement trouvé pour « {c1Search} ».
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                      <th
                        onClick={() => handleC1Sort('machineCode')}
                        className="py-2.5 px-2.5 border-r border-slate-200/80 cursor-pointer hover:bg-slate-200/50"
                      >
                        <div className="flex items-center gap-1">
                          <span className="px-1 py-0.2 rounded bg-slate-200 text-[8px] font-mono">
                            Col A
                          </span>
                          <span>Code</span>
                          {renderSortIcon('machineCode')}
                        </div>
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200 text-[8px] font-mono mr-1">
                          Col B
                        </span>
                        Équipement
                      </th>
                      <th
                        onClick={() => handleC1Sort('failureCount')}
                        className="py-2.5 px-2.5 text-right border-r border-slate-200/80 cursor-pointer hover:bg-slate-200/50"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>BT / Arrêt</span>
                          {renderSortIcon('failureCount')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleC1Sort('correctivePdrCost')}
                        className="py-2.5 px-2.5 text-right border-r border-slate-200/80 cursor-pointer hover:bg-slate-200/50"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Coût BT</span>
                          {renderSortIcon('correctivePdrCost')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleC1Sort('preventiveCost')}
                        className="py-2.5 px-2.5 text-right border-r border-slate-200/80 cursor-pointer hover:bg-slate-200/50"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Coût PM</span>
                          {renderSortIcon('preventiveCost')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleC1Sort('externalBobinageCost')}
                        className="py-2.5 px-2.5 text-right border-r border-slate-200/80 cursor-pointer hover:bg-slate-200/50"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Externe</span>
                          {renderSortIcon('externalBobinageCost')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleC1Sort('totalOfficialCost')}
                        className="py-2.5 px-2.5 text-right bg-emerald-50/40 cursor-pointer hover:bg-emerald-100/50"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span className="px-1 py-0.2 rounded bg-emerald-100 text-[8px] font-mono text-emerald-900">
                            Col G
                          </span>
                          <span>Total Officiel</span>
                          {renderSortIcon('totalOfficialCost')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {paginatedC1.map((m) => (
                      <tr key={m.machineCode} className="hover:bg-emerald-50/20 transition-colors">
                        <td className="py-2.5 px-2.5 border-r border-slate-100">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-[11px]">
                            {m.machineCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 font-semibold text-slate-700 border-r border-slate-100">
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
                        <td className="py-2.5 px-2.5 text-right font-mono text-slate-700 border-r border-slate-100">
                          <span className="font-bold text-slate-900">{m.failureCount}</span> BT
                          {m.totalDowntimeHours > 0 && (
                            <span className="block text-[10px] font-bold text-rose-700">
                              {m.totalDowntimeHours} h
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-slate-700 border-r border-slate-100">
                          {formatCurrency(m.correctivePdrCost)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-slate-700 border-r border-slate-100">
                          {formatCurrency(m.preventiveCost)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-slate-700 border-r border-slate-100">
                          {formatCurrency(m.externalBobinageCost)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-black text-emerald-800 bg-emerald-50/20">
                          {formatCurrency(m.totalOfficialCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-mono text-xs font-black text-slate-900">
                      <td colSpan={3} className="py-2.5 px-2.5 border-r border-slate-200">
                        TOTAL PÉRIODE ({report.machineCostBreakdown.length} machine(s))
                      </td>
                      <td className="py-2.5 px-2.5 text-right border-r border-slate-200">
                        {formatCurrency(
                          Math.round(
                            report.machineCostBreakdown.reduce((s, r) => s + r.correctivePdrCost, 0) * 100
                          ) / 100
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-right border-r border-slate-200">
                        {formatCurrency(
                          Math.round(
                            report.machineCostBreakdown.reduce((s, r) => s + r.preventiveCost, 0) * 100
                          ) / 100
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-right border-r border-slate-200">
                        {formatCurrency(
                          Math.round(
                            report.machineCostBreakdown.reduce((s, r) => s + r.externalBobinageCost, 0) * 100
                          ) / 100
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-emerald-800 bg-emerald-50/50">
                        {formatCurrency(report.totalOfficialMaintenanceCost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {report.machineCostBreakdown.length > 0 && (
              <div className="p-3 bg-slate-50/60 border-t border-slate-200/80 print:hidden">
                <TablePaginationCard
                  currentPage={c1Page}
                  setCurrentPage={setC1Page}
                  pageSize={c1PageSize}
                  setPageSize={setC1PageSize}
                  totalItems={filteredAndSortedC1.length}
                  pageSizeOptions={[8, 15, 30, 0]}
                  itemLabel="machines"
                  className="mt-0 shadow-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 2 Detail: Préventif & Snapshot des Tâches en Retard */}
        <div
          className={`bg-white rounded-2xl border transition-all duration-300 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col ${
            focusedKpi === 'PREVENTIVE'
              ? 'border-indigo-400 ring-2 ring-indigo-500/20'
              : 'border-slate-200/90'
          }`}
        >
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600" />
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Conformité Temporelle Préventive (B3) & Tâches en Retard ({report.pmCompliance.overdueCount})
              </h3>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('preventive')}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-800 border border-indigo-200 inline-flex items-center gap-1 cursor-pointer print:hidden"
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
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200 text-[8px] font-mono mr-1">
                          Col A
                        </span>
                        Équipement
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200 text-[8px] font-mono mr-1">
                          Col B
                        </span>
                        Tâche préventive
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200 text-[8px] font-mono mr-1">
                          Col C
                        </span>
                        Responsable
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <span className="px-1 py-0.2 rounded bg-rose-100 text-[8px] font-mono text-rose-900 mr-1">
                          Col D
                        </span>
                        Échéance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {report.overdueTasksSample.map((t) => (
                      <tr key={t.id} className="hover:bg-rose-50/20">
                        <td className="py-2 px-3 border-r border-slate-100">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-[11px]">
                            {t.machineCode}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-700 border-r border-slate-100">
                          {t.taskName}
                        </td>
                        <td className="py-2 px-3 text-slate-600 border-r border-slate-100">
                          {t.assignedTo}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
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

      {/* 5. Bottom Grid: Magasin Consommations + Système Général & Charge Équipe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 3 Detail: Magasin & Top Pièces Consommées */}
        <div
          className={`bg-white rounded-2xl border transition-all duration-300 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col ${
            focusedKpi === 'MAGASIN'
              ? 'border-cyan-400 ring-2 ring-cyan-500/20'
              : 'border-slate-200/90'
          }`}
        >
          <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600" />
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
                <PackageCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Top PDR Consommées (Mouvements Sortie Officiels)
              </h3>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('sortie')}
                className="px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-xs font-bold text-cyan-900 border border-cyan-200 inline-flex items-center gap-1 cursor-pointer print:hidden"
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
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-200">
                      {report.stockReorderAlerts.ruptureCount} rupture
                    </span>
                  )}
                  {report.stockReorderAlerts.sousSeuilCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      {report.stockReorderAlerts.sousSeuilCount} sous seuil
                    </span>
                  )}
                  {report.stockReorderAlerts.reservationRiskCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-100 text-purple-900 border border-purple-200">
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
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-600">
                        <th className="py-1.5 px-2.5 border-r border-slate-200/70">Réf</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-200/70">Désignation</th>
                        <th className="py-1.5 px-2.5 text-right border-r border-slate-200/70">Actuel</th>
                        <th className="py-1.5 px-2.5 text-right border-r border-slate-200/70">Net Dispo</th>
                        <th className="py-1.5 px-2.5 text-right border-r border-slate-200/70">Seuil</th>
                        <th className="py-1.5 px-2.5 text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.stockReorderAlerts.items.slice(0, 5).map((it) => (
                        <tr key={it.ref}>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900 border-r border-slate-100">
                            {it.ref}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-700 truncate max-w-[140px] border-r border-slate-100">
                            {it.designation}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-100">
                            {it.stockActuel}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold text-rose-700 border-r border-slate-100">
                            {it.netAvailable}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono text-slate-600 border-r border-slate-100">
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
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200 text-[8px] font-mono mr-1">
                          Col A
                        </span>
                        Référence
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200 text-[8px] font-mono mr-1">
                          Col B
                        </span>
                        Désignation
                      </th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200 text-[8px] font-mono mr-1">
                          Col C
                        </span>
                        Qté Sortie
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <span className="px-1 py-0.2 rounded bg-cyan-100 text-[8px] font-mono text-cyan-900 mr-1">
                          Col D
                        </span>
                        Coût Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {report.topConsumedParts.map((part) => (
                      <tr key={part.ref} className="hover:bg-cyan-50/20">
                        <td className="py-2 px-3 border-r border-slate-100">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-[11px]">
                            {part.ref}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-700 border-r border-slate-100">
                          {part.designation}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-100">
                          {part.quantity} {part.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-cyan-800">
                          {formatCurrency(part.totalCost)}
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
        <div
          className={`bg-white rounded-2xl border transition-all duration-300 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col ${
            focusedKpi === 'RELIABILITY'
              ? 'border-emerald-400 ring-2 ring-emerald-500/20'
              : 'border-slate-200/90'
          }`}
        >
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-600" />
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Exploitation Système Général & Activité Équipe
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
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
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs"
                  >
                    <div className="text-[11px] font-mono font-extrabold text-slate-900">
                      {st.systemTypeCode}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
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
                  {report.technicianBreakdown.slice(0, 8).map((tech) => (
                    <div
                      key={tech.name}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-2 shadow-2xs"
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

      {/* Formulas Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Formules & Règles — Rapport Vacation / Hebdo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Contrat Maker-Checker, conformité temporelle B3, coûts officiels C1 et risque stock C3
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
              {shiftFormulas.map((f) => (
                <div
                  key={f.title}
                  className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 space-y-1.5"
                >
                  <div className="text-xs font-black text-slate-800">{f.title}</div>
                  <div className="font-mono text-xs text-emerald-900 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                    {f.formula}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
