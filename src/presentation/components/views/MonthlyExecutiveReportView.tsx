import React, { useState, useMemo } from 'react';
import { Logger } from '../../../core/logger/LoggerService';
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
  ShieldAlert,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Hash,
  Tag,
  Layers,
  Calculator,
  X,
  RotateCcw,
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
import AnimatedPage from '../common/AnimatedPage';
import PageHeaderIcon from '../common/PageHeaderIcon';
import Action3DButton from '../common/Action3DButton';
import FormulasModalButton from '../common/FormulasModalButton';
import GmaoKpiCard, { GmaoKpiGrid } from '../common/GmaoKpiCard';
import TablePaginationCard from '../common/TablePaginationCard';

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

type C1SortKey =
  | 'totalOfficialCost'
  | 'correctivePdrCost'
  | 'preventiveCost'
  | 'externalBobinageCost'
  | 'failureCount'
  | 'machineCode';

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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${badgeColors}`}
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
  const [focusedPillar, setFocusedPillar] = useState<string | null>(null);
  const [showFormulasModal, setShowFormulasModal] = useState(false);

  // C1 Table Filter, Sort & Pagination State
  const [c1Search, setC1Search] = useState('');
  const [c1SortKey, setC1SortKey] = useState<C1SortKey>('totalOfficialCost');
  const [c1SortDir, setC1SortDir] = useState<'asc' | 'desc'>('desc');
  const [c1Page, setC1Page] = useState(1);
  const [c1PageSize, setC1PageSize] = useState(10);

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
      Logger.error('Failed to export monthly executive report:', err);
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

  // Filtered & sorted C1 Machine Cost Breakdown
  const filteredAndSortedC1 = useMemo(() => {
    const raw = currentReport.machineCostBreakdown || [];
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
  }, [currentReport.machineCostBreakdown, c1Search, c1SortKey, c1SortDir]);

  const paginatedC1 = useMemo(() => {
    if (c1PageSize === 0) return filteredAndSortedC1;
    const start = (c1Page - 1) * c1PageSize;
    return filteredAndSortedC1.slice(start, start + c1PageSize);
  }, [filteredAndSortedC1, c1Page, c1PageSize]);

  const handleC1Sort = (key: C1SortKey) => {
    if (c1SortKey === key) {
      setC1SortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setC1SortKey(key);
      setC1SortDir(key === 'machineCode' ? 'asc' : 'desc');
    }
    setC1Page(1);
  };

  const renderSortIcon = (key: C1SortKey) => {
    if (c1SortKey !== key) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    return c1SortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-600" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600" />
    );
  };

  const executiveFormulas = useMemo(
    () => [
      {
        title: '1. Coût Officiel Consolidé C1 (Vérité Validée)',
        formula: 'Coût Officiel (C1) = Coût PDR Correctif (BT Approuvés) + Coût PDR Préventif (PM Validés) + Coût Bobinage/Prestation Externe',
        description:
          'Exclut strictement les déclarations terrain en statut PENDING_VALIDATION ou REJECTED (contrat Maker-Checker).',
      },
      {
        title: '2. Valorisation Stock & Consommation Mensuelle',
        formula: 'Valeur Stock = ∑ (Stock Actuel × PMP)  |  Conso Mois = ∑ (Sorties Validées du Mois × PMP)',
        description:
          'Mesure l’immobilisation financière actuelle au magasin PDR et la valeur des pièces officiellement sorties sur le mois sélectionné.',
      },
      {
        title: '3. Fiabilité Production (MTBF, MTTR & Disponibilité OEE)',
        formula: 'MTBF = Heures Ouverture Parc / Nb Pannes  |  MTTR = ∑ Durées Réparation / Nb Pannes  |  Dispo = MTBF / (MTBF + MTTR)',
        description:
          'Calculé sur le parc Production actif. Les équipements Système Général (utilités, incendie, air comprimé) sont isolés pour ne jamais fausser le MTBF Production.',
      },
      {
        title: '4. Discipline Préventive Mensuelle',
        formula: 'Taux Discipline PM (%) = (Exécutions PM Approuvées sur le Mois / Tâches Planifiées Actives) × 100',
        description:
          'Évalue le respect du calendrier préventif officiel validé par le responsable maintenance.',
      },
      {
        title: '5. Comparaison Mensuelle (M vs M-1)',
        formula: 'Écart (%) = ((Valeur Mois M − Valeur Mois M-1) / Valeur Mois M-1) × 100',
        description:
          'Pour les coûts, pannes et heures d’arrêt, une baisse (▼) est positive (vert) et une hausse (▲) est signalée en alerte (rouge).',
      },
    ],
    []
  );

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
    <AnimatedPage className="space-y-5 max-w-[2200px] mx-auto pb-14 print:p-0 print:space-y-4">
      {/* 1. Clean Single-Row Floating Executive Header Card (matching UtilisateursView & EquipmentView) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex items-center justify-between gap-3 sm:gap-4 w-full relative overflow-hidden group/header print:shadow-none print:border-b-2 print:border-slate-900 print:rounded-none">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500 print:hidden" />

        <div className="flex items-center gap-3.5 min-w-0 relative z-10">
          <div className="print:hidden">
            <PageHeaderIcon icon={FileBarChart2} colorClass="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                Rapport Mensuel Exécutif — Direction d’Usine
              </h1>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                Période : {selectedMonth}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Comparé à {previousMonth}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Synthèse financière du stock, coûts officiels (BT + PM + Bobinage), discipline préventive, fiabilité Production (MTBF/MTTR/OEE) et liste d’achat prioritaire.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative z-10 print:hidden">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title="Formules & Règles — Rapport Mensuel Direction"
          />

          {canExportReport && (
            <Action3DButton
              variant="circle"
              color="emerald"
              icon={FileSpreadsheet}
              title="Exporter le rapport mensuel vers Excel (6 feuilles)"
              ariaLabel="Excel Mensuel (6 Feuilles)"
              onClick={handleExportExcel}
            />
          )}

          <Action3DButton
            variant="circle"
            color="slate"
            icon={Printer}
            title="Imprimer / Télécharger en PDF"
            ariaLabel="Imprimer"
            onClick={handlePrintPdf}
          />
        </div>
      </div>

      {/* 2. 4-Tier Executive KPI Cards (P2.1 & P2.3) */}
      <GmaoKpiGrid columns={4}>
        <GmaoKpiCard
          title="1. Budget & Valorisation Stock"
          value={formatCurrency(currentReport.stockValuationTotal)}
          unit="Stock Actuel"
          icon={Wallet}
          color="indigo"
          badgeText={`Conso: ${formatCurrency(currentReport.monthConsumptionCost)}`}
          footerLabel={`Commandes ouvertes (${currentReport.openOrdersCount})`}
          footerValue={formatCurrency(currentReport.openOrdersValue)}
          isActive={focusedPillar === 'STOCK'}
          onClick={() => setFocusedPillar(focusedPillar === 'STOCK' ? null : 'STOCK')}
        />
        <GmaoKpiCard
          title="2. Discipline Préventive"
          value={currentReport.preventiveDisciplineRate}
          unit={`% (${currentReport.preventiveExecutedCount}/${currentReport.preventiveScheduledCount} tâches)`}
          icon={ShieldCheck}
          color="emerald"
          badgeText={`${currentReport.preventiveLaborHours}h Main-d'œuvre PM`}
          footerLabel="Coût Préventif du mois"
          footerValue={formatCurrency(currentReport.preventiveTotalCost)}
          isActive={focusedPillar === 'PM'}
          onClick={() => setFocusedPillar(focusedPillar === 'PM' ? null : 'PM')}
        />
        <GmaoKpiCard
          title="3. Pannes & Arrêts (MTBF / MTTR)"
          value={currentReport.correctiveCount}
          unit={`pannes (${currentReport.totalDowntimeHours}h arrêt)`}
          icon={Wrench}
          color="amber"
          badgeText={`Dispo Usine (OEE): ${currentReport.availabilityRate}%`}
          footerLabel="Fiabilité MTBF / MTTR"
          footerValue={`${currentReport.mtbfHours}h / ${currentReport.mttrFormatted}`}
          isActive={focusedPillar === 'RELIABILITY'}
          onClick={() => setFocusedPillar(focusedPillar === 'RELIABILITY' ? null : 'RELIABILITY')}
        />
        <GmaoKpiCard
          title="4. Urgences Réapprovisionnement"
          value={currentReport.ruptureCount}
          unit={`Ruptures | ${currentReport.alerteCount} Alertes`}
          icon={AlertTriangle}
          color="rose"
          badgeText={`${currentReport.stockItemsCount} articles référencés`}
          footerLabel="Mouvements du mois"
          footerValue={`${currentReport.monthSortiesCount} sorties · ${currentReport.monthEntreesCount} entrées`}
          isActive={focusedPillar === 'SHORTAGE'}
          onClick={() => setFocusedPillar(focusedPillar === 'SHORTAGE' ? null : 'SHORTAGE')}
        />
      </GmaoKpiGrid>

      {/* Month-over-Month Executive Delta Strip */}
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-black text-slate-700 uppercase tracking-wider text-[11px]">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span>Écarts Mensuels ({selectedMonth} vs {previousMonth})</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Consommation PDR :</span>
            <DeltaBadge
              delta={comparison.consumptionCostDelta}
              invertGoodBad={true}
              unit={` ${currencySymbol}`}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Discipline PM :</span>
            <DeltaBadge
              delta={comparison.preventiveDisciplineDelta}
              invertGoodBad={false}
              unit="%"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Volume Pannes BT :</span>
            <DeltaBadge delta={comparison.correctiveCountDelta} invertGoodBad={true} />
          </div>
          {focusedPillar && (
            <button
              type="button"
              onClick={() => setFocusedPillar(null)}
              className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <span>Focus actif : {focusedPillar}</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 2B. Dedicated Elevated Filter & Period Card (matching UtilisateursView & EquipmentView) */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4 print:hidden">
        {/* Header Toolbar: SlidersHorizontal + Title + Selected Month + Live C1 Cost Badge + Circular Reset */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Filtres & Période d&apos;Analyse Mensuelle
                </span>
                <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-amber-200/70 shadow-2xs font-mono">
                  Mois : {selectedMonth} (vs {previousMonth})
                </span>
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-slate-200 font-mono">
                  {assetClass === 'ALL'
                    ? 'Toutes classes'
                    : assetClass === 'PRODUCTION'
                    ? 'Production uniquement'
                    : 'Système Général'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Sélection du mois de synthèse, comparaison M vs M-1 et périmètre d&apos;équipements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {/* Live Official C1 Cost Counter */}
            <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
              <span className="text-slate-600 font-medium">Coût Officiel :</span>
              <strong className="text-slate-900 font-black">
                {formatCurrency(currentReport.totalOfficialMaintenanceCost)}
              </strong>
              {comparison.totalOfficialCostDelta && (
                <DeltaBadge
                  delta={comparison.totalOfficialCostDelta}
                  invertGoodBad={true}
                  unit={` ${currencySymbol}`}
                />
              )}
            </div>

            {/* Circular Reset Button */}
            {(selectedMonth !== (detectedActiveMonths[0] || new Date().toISOString().slice(0, 7)) ||
              assetClass !== 'ALL' ||
              focusedPillar) && (
              <button
                type="button"
                onClick={() => {
                  if (detectedActiveMonths[0]) setSelectedMonth(detectedActiveMonths[0]);
                  setAssetClass('ALL');
                  setFocusedPillar(null);
                  setC1Page(1);
                }}
                title="Réinitialiser la période et les filtres"
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Structured Filter Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-end">
          {/* 1. Month Picker + Quick Month Pills */}
          <div className="xl:col-span-7">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                Mois d&apos;Analyse Exécutive
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                Calendrier M vs M-1
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80 min-h-10">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded-lg border border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedMonth(e.target.value);
                      setC1Page(1);
                    }
                  }}
                  aria-label="Mois du rapport"
                  className="bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>

              {detectedActiveMonths.slice(0, 4).map((ym) => (
                <button
                  key={ym}
                  type="button"
                  onClick={() => {
                    setSelectedMonth(ym);
                    setC1Page(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                    selectedMonth === ym
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
                >
                  {ym}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Asset Class Filter */}
          <div className="xl:col-span-5">
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

      {/* 3. Detailed Executive Grids (2x2 Layout with Framed Excel Headers) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Top 5 Consumed Spare Parts in Selected Month */}
        <div
          className={`bg-white rounded-2xl border transition-all duration-300 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col ${
            focusedPillar === 'STOCK'
              ? 'border-indigo-400 ring-2 ring-indigo-500/20'
              : 'border-slate-200/90'
          }`}
        >
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600" />
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-2 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                <PackageCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Top 5 Pièces Consommées du Mois ({selectedMonth})
                </h2>
                <p className="text-[10px] text-slate-500 font-medium">
                  Classement par valeur financière des sorties validées
                </p>
              </div>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('sortie')}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-indigo-700 border border-indigo-200 flex items-center gap-1 cursor-pointer transition print:hidden"
              >
                <span>Journal Mouvements</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex-1">
            {currentReport.topConsumedParts.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Aucune sortie de pièce enregistrée sur la période {selectedMonth}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700">
                            Col A
                          </span>
                          <span>Référence</span>
                        </div>
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700">
                            Col B
                          </span>
                          <span>Désignation</span>
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700 mr-1">
                          Col C
                        </span>
                        Quantité
                      </th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200/80">
                        P.U ({currencySymbol})
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <span className="px-1 py-0.2 rounded bg-indigo-100 text-[9px] font-mono text-indigo-800 mr-1">
                          Col E
                        </span>
                        Coût Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {currentReport.topConsumedParts.map((part) => (
                      <tr key={part.ref} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-2.5 px-3 border-r border-slate-100">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-[11px]">
                            {part.ref}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-semibold truncate max-w-[200px] border-r border-slate-100">
                          {part.designation}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-100">
                          {part.quantity} {part.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500 border-r border-slate-100">
                          {formatCurrency(part.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-indigo-700">
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

        {/* Section 2: Top 3 Failing Machines & Reliability Impact */}
        <div
          className={`bg-white rounded-2xl border transition-all duration-300 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col justify-between ${
            focusedPillar === 'RELIABILITY'
              ? 'border-amber-400 ring-2 ring-amber-500/20'
              : 'border-slate-200/90'
          }`}
        >
          <div>
            <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-2 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                  <Factory className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Top 3 Machines Critiques & Temps d’Arrêt ({selectedMonth})
                  </h2>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Équipements les plus sollicités en maintenance corrective
                  </p>
                </div>
              </div>
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab('corrective_analyse')}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-[11px] font-bold text-amber-800 border border-amber-200 flex items-center gap-1 cursor-pointer transition print:hidden"
                >
                  <span>Analyse Pareto</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {currentReport.topFailingMachines.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Aucune panne machine enregistrée sur la période {selectedMonth} (Disponibilité 100%).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700 mr-1">
                          Col A
                        </span>
                        Code Machine
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700 mr-1">
                          Col B
                        </span>
                        Équipement
                      </th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700 mr-1">
                          Col C
                        </span>
                        Nombre Pannes
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <span className="px-1 py-0.2 rounded bg-amber-100 text-[9px] font-mono text-amber-900 mr-1">
                          Col D
                        </span>
                        Heures d’Arrêt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {currentReport.topFailingMachines.map((m) => (
                      <tr key={m.machineCode} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-2.5 px-3 border-r border-slate-100">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono font-black text-[11px]">
                            {m.machineCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 border-r border-slate-100">
                          {m.machineName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 border-r border-slate-100">
                          {m.failureCount} panne(s)
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                          {m.totalDowntimeHours} h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5 p-4 border-t border-slate-200/80 bg-slate-50/60 text-center">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">MTBF Parc</div>
              <div className="text-sm font-black font-mono text-blue-700 mt-0.5">
                {currentReport.mtbfHours}h
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">MTTR Moyen</div>
              <div className="text-sm font-black font-mono text-amber-700 mt-0.5">
                {currentReport.mttrFormatted}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">Coût PDR Pannes</div>
              <div className="text-sm font-black font-mono text-purple-700 mt-0.5">
                {formatCurrency(currentReport.correctiveSparesCost)}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Technician Execution Breakdown */}
        <div
          className={`bg-white rounded-2xl border transition-all duration-300 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col ${
            focusedPillar === 'PM'
              ? 'border-emerald-400 ring-2 ring-emerald-500/20'
              : 'border-slate-200/90'
          }`}
        >
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-2 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Répartition des Interventions par Technicien ({selectedMonth})
                </h2>
                <p className="text-[10px] text-slate-500 font-medium">
                  Volume d’interventions préventives et correctives approuvées
                </p>
              </div>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('preventive')}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[11px] font-bold text-emerald-800 border border-emerald-200 flex items-center gap-1 cursor-pointer transition print:hidden"
              >
                <span>Planning Préventif</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex-1">
            {currentReport.technicianBreakdown.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Aucune intervention préventive ou corrective enregistrée sur {selectedMonth}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700 mr-1">
                          Col A
                        </span>
                        Intervenant / Technicien
                      </th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700 mr-1">
                          Col B
                        </span>
                        Préventif (PM)
                      </th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700 mr-1">
                          Col C
                        </span>
                        Correctif (BT)
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <span className="px-1 py-0.2 rounded bg-emerald-100 text-[9px] font-mono text-emerald-900 mr-1">
                          Col D
                        </span>
                        Volume Heures
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {currentReport.technicianBreakdown.slice(0, 8).map((tech) => (
                      <tr key={tech.name} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-100">
                          {tech.name}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 border-r border-slate-100">
                          {tech.preventiveCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700 border-r border-slate-100">
                          {tech.correctiveCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                          {tech.totalHours} h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Critical Shortages Requiring Purchase (RUPTURE / ALERTE) */}
        <div
          className={`bg-white rounded-2xl border transition-all duration-300 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col ${
            focusedPillar === 'SHORTAGE'
              ? 'border-rose-400 ring-2 ring-rose-500/20'
              : 'border-slate-200/90'
          }`}
        >
          <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-red-500 to-rose-600" />
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-2 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Liste d’Achat Prioritaire — Ruptures & Alertes Stock
                </h2>
                <p className="text-[10px] text-slate-500 font-medium">
                  Articles sous seuil de sécurité nécessitant un réapprovisionnement
                </p>
              </div>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('stock')}
                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-[11px] font-bold text-rose-800 border border-rose-200 flex items-center gap-1 cursor-pointer transition print:hidden"
              >
                <span>Gérer le Stock</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex-1">
            {criticalShortages.length === 0 ? (
              <div className="py-10 text-center text-xs text-emerald-700 font-semibold">
                Aucune rupture ni alerte critique — tous les stocks sont au-dessus du seuil de sécurité.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700 mr-1">
                          Col A
                        </span>
                        Statut
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700 mr-1">
                          Col B
                        </span>
                        Réf PDR
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200/80">
                        <span className="px-1 py-0.2 rounded bg-slate-200/80 text-[9px] font-mono text-slate-700 mr-1">
                          Col C
                        </span>
                        Désignation
                      </th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200/80">
                        Stock / Seuil
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <span className="px-1 py-0.2 rounded bg-rose-100 text-[9px] font-mono text-rose-900 mr-1">
                          Col E
                        </span>
                        Qté Conseillée
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {criticalShortages.map((item) => (
                      <tr key={item.ref} className="hover:bg-rose-50/30 transition-colors">
                        <td className="py-2.5 px-3 border-r border-slate-100">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                              item.status === 'RUPTURE'
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-100">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-[11px]">
                            {item.ref}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-semibold truncate max-w-[180px] border-r border-slate-100">
                          {item.designation}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono border-r border-slate-100">
                          <span className="font-black text-rose-700">{item.stockActuel}</span>
                          <span className="text-slate-400"> / {item.seuil}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
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
      </div>

      {/* 4. Section C1: Official Machine Cost Breakdown (Excel Grid + Filter + Sort + Pagination) */}
      <div className="space-y-4">
        {/* Elevated Filter & Sort Bar for C1 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Grille C1 — Ventilation des Coûts Officiels par Équipement
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-mono font-bold text-emerald-800">
                    {filteredAndSortedC1.length} / {(currentReport.machineCostBreakdown || []).length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  BT approuvés + Exécutions PM validées + Bobinage externe officiel (hors déclarations non validées)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box with Col. A-B Badge */}
            <div className="relative min-w-[240px]">
              <div className="w-6 h-6 rounded-md bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={c1Search}
                onChange={(e) => {
                  setC1Search(e.target.value);
                  setC1Page(1);
                }}
                placeholder="Rechercher code, équipement..."
                className="w-full h-9 pl-10 pr-16 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-200/80 text-[9px] font-mono font-bold text-slate-600">
                Col. A-B
              </span>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 pl-2">Tri :</span>
              <select
                value={c1SortKey}
                onChange={(e) => {
                  setC1SortKey(e.target.value as C1SortKey);
                  setC1Page(1);
                }}
                aria-label="Trier les coûts équipements"
                className="bg-white px-2.5 py-1 rounded-lg text-xs font-bold text-slate-800 border border-slate-200 focus:outline-none"
              >
                <option value="totalOfficialCost">Total Officiel (C1)</option>
                <option value="correctivePdrCost">Coût PDR BT</option>
                <option value="preventiveCost">Coût PM</option>
                <option value="externalBobinageCost">Bobinage Externe</option>
                <option value="failureCount">Nombre BT / Arrêt</option>
                <option value="machineCode">Code Équipement</option>
              </select>
              <button
                type="button"
                onClick={() => setC1SortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 cursor-pointer"
                title={c1SortDir === 'asc' ? 'Tri croissant' : 'Tri décroissant'}
              >
                {c1SortDir === 'asc' ? (
                  <ArrowUp className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5 text-emerald-700" />
                )}
              </button>
            </div>

            {c1Search && (
              <button
                type="button"
                onClick={() => {
                  setC1Search('');
                  setC1Page(1);
                }}
                className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 cursor-pointer transition"
                title="Réinitialiser la recherche"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-mono font-black">
              Total C1 ({selectedMonth}) : {formatCurrency(currentReport.totalOfficialMaintenanceCost ?? 0)}
            </span>

            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('machines')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1 cursor-pointer transition"
              >
                <span>Parc Machines</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* C1 Industrial Excel Grid */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600" />

          {!currentReport.machineCostBreakdown || currentReport.machineCostBreakdown.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Aucun coût officiel (BT approuvé, exécution PM validée ou bobinage externe) enregistré sur {selectedMonth}.
            </div>
          ) : filteredAndSortedC1.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Aucun équipement ne correspond au filtre « {c1Search} ».
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/95 border-b-2 border-slate-200 text-[10px] font-black uppercase text-slate-700">
                    <th
                      onClick={() => handleC1Sort('machineCode')}
                      className="py-3 px-3 border-r border-slate-200/80 cursor-pointer hover:bg-slate-200/60 select-none"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[9px] font-mono text-slate-700">
                            Col A
                          </span>
                          <Hash className="w-3.5 h-3.5 text-slate-500" />
                          <span>Code</span>
                        </div>
                        {renderSortIcon('machineCode')}
                      </div>
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200/80">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[9px] font-mono text-slate-700">
                          Col B
                        </span>
                        <Tag className="w-3.5 h-3.5 text-slate-500" />
                        <span>Désignation Équipement</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200/80">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[9px] font-mono text-slate-700">
                          Col C
                        </span>
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        <span>Classe</span>
                      </div>
                    </th>
                    <th
                      onClick={() => handleC1Sort('failureCount')}
                      className="py-3 px-3 text-right border-r border-slate-200/80 cursor-pointer hover:bg-slate-200/60 select-none"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[9px] font-mono text-slate-700">
                          Col D
                        </span>
                        <span>BT / Arrêt</span>
                        {renderSortIcon('failureCount')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleC1Sort('correctivePdrCost')}
                      className="py-3 px-3 text-right border-r border-slate-200/80 cursor-pointer hover:bg-slate-200/60 select-none"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[9px] font-mono text-slate-700">
                          Col E
                        </span>
                        <span>Coût PDR BT</span>
                        {renderSortIcon('correctivePdrCost')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleC1Sort('preventiveCost')}
                      className="py-3 px-3 text-right border-r border-slate-200/80 cursor-pointer hover:bg-slate-200/60 select-none"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[9px] font-mono text-slate-700">
                          Col F
                        </span>
                        <span>Coût PM</span>
                        {renderSortIcon('preventiveCost')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleC1Sort('externalBobinageCost')}
                      className="py-3 px-3 text-right border-r border-slate-200/80 cursor-pointer hover:bg-slate-200/60 select-none"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[9px] font-mono text-slate-700">
                          Col G
                        </span>
                        <span>Bobinage Ext.</span>
                        {renderSortIcon('externalBobinageCost')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleC1Sort('totalOfficialCost')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-emerald-100/50 select-none bg-emerald-50/40"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[9px] font-mono text-emerald-900">
                          Col H
                        </span>
                        <span className="text-emerald-950">Total Officiel (C1)</span>
                        {renderSortIcon('totalOfficialCost')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {paginatedC1.map((m) => (
                    <tr key={m.machineCode} className="hover:bg-emerald-50/25 transition-colors">
                      <td className="py-2.5 px-3 border-r border-slate-100">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-[11px]">
                          {m.machineCode}
                        </span>
                      </td>
                      <td
                        className="py-2.5 px-3 font-semibold text-slate-800 truncate max-w-[240px] border-r border-slate-100"
                        title={m.machineName}
                      >
                        {m.machineName}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-100">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                            m.assetClass === 'SYSTEM_GENERAL'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {m.assetClass === 'SYSTEM_GENERAL' ? 'SYS. GÉNÉRAL' : 'PRODUCTION'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 border-r border-slate-100">
                        <span className="font-bold text-slate-900">{m.failureCount}</span> BT
                        {m.totalDowntimeHours > 0 ? ` (${m.totalDowntimeHours}h)` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 border-r border-slate-100">
                        {formatCurrency(m.correctivePdrCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 border-r border-slate-100">
                        {formatCurrency(m.preventiveCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 border-r border-slate-100">
                        {formatCurrency(m.externalBobinageCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800 bg-emerald-50/20">
                        {formatCurrency(m.totalOfficialCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-mono text-xs font-black text-slate-900">
                    <td colSpan={4} className="py-3 px-3 border-r border-slate-200">
                      TOTAL CONSOLIDÉ ({currentReport.machineCostBreakdown.length} équipement(s))
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {formatCurrency(currentReport.correctiveSparesCost)}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {formatCurrency(currentReport.preventiveTotalCost)}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {formatCurrency(currentReport.externalBobinageCost ?? 0)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-800 bg-emerald-50/50">
                      {formatCurrency(currentReport.totalOfficialMaintenanceCost ?? 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* TablePaginationCard for Section C1 */}
        {(currentReport.machineCostBreakdown || []).length > 0 && (
          <div className="print:hidden">
            <TablePaginationCard
              currentPage={c1Page}
              setCurrentPage={setC1Page}
              pageSize={c1PageSize}
              setPageSize={setC1PageSize}
              totalItems={filteredAndSortedC1.length}
              pageSizeOptions={[10, 25, 50, 100, 0]}
              itemLabel="équipements"
            />
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

      {/* Formulas Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Formules & Règles — Rapport Mensuel Direction
                  </h3>
                  <p className="text-xs text-slate-500">
                    Coûts officiels C1, valorisation stock PMP, MTBF/MTTR et discipline préventive
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
              {executiveFormulas.map((f) => (
                <div
                  key={f.title}
                  className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 space-y-1.5"
                >
                  <div className="text-xs font-black text-slate-800">{f.title}</div>
                  <div className="font-mono text-xs text-indigo-900 font-bold bg-white p-2 rounded-lg border border-indigo-100">
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
