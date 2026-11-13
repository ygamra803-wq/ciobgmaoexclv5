/**
 * @file FinanceView.tsx
 * @module presentation/pages/finance/FinanceView
 * @description
 * لوحة التحكم في تكاليف الصيانة ورقابة الميزانية الدورية والأصول (Pilotage des Coûts & Budgets Maintenance) لـ GMAO.
 * تلتزم بمبدأ: Field Claim ≠ Coût Validé ≠ Écriture Comptable ERP.
 * تضم ترقيات FIN-P0 / P1 / P2 + DESIGN_SYSTEM_UI_UX v4.1.0:
 * - هيدر عائم مع PageHeaderIcon و FormulasModalButton و Action3DButton.
 * - شبكة مؤشرات تفاعلية (GmaoKpiGrid × 5) تنقل المستخدم مباشرة للتبويب المختص.
 * - بطاقات فلاتر إكسيل مرتفعة وجداول قابلة للفرز والترقيم (TablePaginationCard) دون اقتطاع صامت للبيانات.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Coins,
  Landmark,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Calculator,
  Wrench,
  Clock,
  ArrowRightLeft,
  Receipt,
  Sliders,
  SlidersHorizontal,
  Search,
  ExternalLink,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Wallet,
  X,
  Cpu,
  Boxes,
  Package,
  Tag,
  Activity,
  MapPin,
  Hash,
  ShieldAlert,
} from 'lucide-react';
import { useCurrency } from '../../../utils/currencyService';
import { storageService } from '../../../utils/storageService';
import { DataGateway } from '../../../application/DataGateway';
import {
  FiscalBudgetConfig,
  HistoricalExchangeRate,
  BudgetPeriodMode,
  INITIAL_EXCHANGE_RATES,
} from '../../../domain/finance/entities/FinancialBudget';
import {
  FinancialCalculationService,
  FinancialSynthesis,
  MachineBerStatus,
  MachineTCOCalculation,
  BudgetVarianceItem,
  PeriodFinancialSummary,
} from '../../../application/services/FinancialCalculationService';
import { FinancialExportService } from '../../../services/financialExportService';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import GmaoKpiCard, { GmaoKpiGrid } from '../../components/common/GmaoKpiCard';
import GmaoIndustrialDataGrid, { type GmaoColumn } from '../../components/common/GmaoIndustrialDataGrid';
import {
  FinanceBudgetEditModal,
  FinanceFormulasModal,
} from './components/FinanceModals';
import {
  FinanceBudgetsSubTab,
  FinanceLaborSubcontractingSubTab,
  FinanceDowntimeRoiSubTab,
  FinanceCurrencyMatrixSubTab,
  type FinanceExternalServiceRow,
  type FinanceValuedStockRow,
} from './components/FinanceSubTabs';

export interface FinanceStockItemInput {
  id?: string;
  ref?: string;
  ref_article?: string;
  reference?: string;
  code?: string;
  designation?: string;
  nom?: string;
  type?: string;
  categorie?: string;
  stockActuel?: number | string;
  quantite?: number | string;
  unite?: string;
  prix_unitaire?: number | string;
  pmp?: number | string;
  prix?: number | string;
  [key: string]: unknown;
}

export interface FinanceViewProps {
  machines?: Record<string, unknown>[];
  stockItems?: FinanceStockItemInput[];
  mouvements?: Record<string, unknown>[];
  correctiveInterventions?: Record<string, unknown>[];
  preventiveExecutions?: Record<string, unknown>[];
  sortiesExterne?: FinanceExternalServiceRow[];
  onNavigateToTab?: (tab: string) => void;
  onNavigateToMachine?: (machineCode: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

type TcoSortKey =
  | 'coutMaintenanceCumule'
  | 'berIndexPercent'
  | 'valeurANeuf'
  | 'valeurNetteComptable'
  | 'preventiveCost'
  | 'correctiveAndExternal'
  | 'code';

type PmpSortKey = 'totalHT' | 'pmp' | 'stockActuel' | 'ref';

const TCO_FILTER_PILLS: ReadonlyArray<{ id: 'ALL' | MachineBerStatus; label: string }> = [
  { id: 'ALL', label: 'Toutes' },
  { id: 'OPTIMAL', label: 'Rentable (<50%)' },
  { id: 'ATTENTION', label: 'Surveillance (50-70%)' },
  { id: 'REPLACE_RECOMMENDED', label: 'Remplacement (≥70%)' },
  { id: 'NON_EVALUE', label: 'Non évalué' },
];

export default function FinanceView({
  machines = [],
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveExecutions = [],
  sortiesExterne = [],
  onNavigateToTab,
  onNavigateToMachine,
  showToast,
}: FinanceViewProps) {
  const { user } = useAuth();
  const { formatCurrency, currencyCode, symbol, setCurrency } = useCurrency();
  const canManage =
    Boolean(user) &&
    !AuthorizationService.isReadOnly(user) &&
    AuthorizationService.hasPermission(user, 'finance.manage');

  // 1. Budget State via DataGateway (FIN-P0: 0 allocations in empty factory mode)
  const [budget, setBudget] = useState<FiscalBudgetConfig>(() => {
    return DataGateway.getFinancialBudget();
  });

  useEffect(() => {
    const handleBudgetUpdated = (e: Event) => {
      const customEvt = e as CustomEvent<FiscalBudgetConfig>;
      if (customEvt?.detail) {
        setBudget(customEvt.detail);
      } else {
        setBudget(DataGateway.getFinancialBudget());
      }
    };
    window.addEventListener('gmao_financial_budget_updated', handleBudgetUpdated);
    return () => window.removeEventListener('gmao_financial_budget_updated', handleBudgetUpdated);
  }, []);

  // 2. Exchange Rates State
  const [exchangeRates] = useState<HistoricalExchangeRate[]>(() => {
    const saved = storageService.getItem('gmao_historical_exchange_rates_v1');
    return Array.isArray(saved) && saved.length > 0 ? saved : INITIAL_EXCHANGE_RATES;
  });

  // P2-1 / P2-3: Period inspection mode & selected month/quarter
  const [viewPeriodMode, setViewPeriodMode] = useState<BudgetPeriodMode>(
    () => budget.periodMode || 'ANNUAL'
  );
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(() => new Date().getMonth() + 1); // 1..12
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState<number>(
    () => Math.floor(new Date().getMonth() / 3) + 1 // 1..4
  );

  useEffect(() => {
    if (budget.periodMode) {
      setViewPeriodMode(budget.periodMode);
    }
  }, [budget.periodMode]);

  // Save budget changes via DataGateway with actor audit stamp (P2-5)
  const saveBudget = (updated: FiscalBudgetConfig) => {
    if (!canManage) return;
    const actor = user?.name || user?.nom || user?.username || user?.role || 'ADMIN';
    const saved = DataGateway.saveFinancialBudget(updated, actor);
    setBudget(saved);
    if (saved.periodMode) {
      setViewPeriodMode(saved.periodMode);
    }
    if (showToast) showToast('Allocations budgétaires et paramètres de suivi enregistrés.', 'success');
  };

  // Navigate directly to a machine card (P2-4)
  const handleOpenMachineCard = (machineCode: string) => {
    if (onNavigateToMachine) {
      onNavigateToMachine(machineCode);
    } else if (onNavigateToTab) {
      onNavigateToTab('machines');
    }
  };

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<
    'budgets' | 'tco_assets' | 'inventory_procurement' | 'labor_subcontracting' | 'downtime_roi' | 'currency_matrix'
  >('budgets');

  // Search, sort, and pagination states for TCO & PMP tables
  const [tcoSearch, setTcoSearch] = useState('');
  const [tcoStatusFilter, setTcoStatusFilter] = useState<'ALL' | MachineBerStatus>('ALL');
  const [tcoSortKey, setTcoSortKey] = useState<TcoSortKey>('coutMaintenanceCumule');
  const [tcoSortDir, setTcoSortDir] = useState<'asc' | 'desc'>('desc');
  const [tcoPage, setTcoPage] = useState(1);
  const [tcoPageSize, setTcoPageSize] = useState(15);
  const [showFormulasModal, setShowFormulasModal] = useState(false);

  const [stockSearch, setStockSearch] = useState('');
  const [pmpSortKey, setPmpSortKey] = useState<PmpSortKey>('totalHT');
  const [pmpSortDir, setPmpSortDir] = useState<'asc' | 'desc'>('desc');
  const [pmpPage, setPmpPage] = useState(1);
  const [pmpPageSize, setPmpPageSize] = useState(15);

  const [zoneScopeMode, setZoneScopeMode] = useState<'ANNUAL' | 'CURRENT_PERIOD'>('ANNUAL');

  // Multi-Currency Simulator State
  const [simCurrency, setSimCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [simForeignPrice, setSimForeignPrice] = useState<number>(250);
  const [simQuantity, setSimQuantity] = useState<number>(4);
  const [simCustomRate, setSimCustomRate] = useState<number>(() => {
    const r = exchangeRates.find((x) => x.sourceCurrency === 'EUR');
    return r ? r.rate : 10.85;
  });

  useEffect(() => {
    const r = exchangeRates.find((x) => x.sourceCurrency === simCurrency);
    if (r) setSimCustomRate(r.rate);
    else setSimCustomRate(simCurrency === 'EUR' ? 10.85 : 9.95);
  }, [simCurrency, exchangeRates]);

  // Edit budget modal state
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editBudgetDraft, setEditBudgetDraft] = useState<FiscalBudgetConfig>(budget);

  // Compute Full Financial Synthesis
  const synthesis: FinancialSynthesis = useMemo(() => {
    return FinancialCalculationService.computeFinancialSynthesis({
      budget,
      exchangeRates,
      machines,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortiesExterne,
    });
  }, [
    budget,
    exchangeRates,
    machines,
    stockItems,
    mouvements,
    correctiveInterventions,
    preventiveExecutions,
    sortiesExterne,
  ]);

  // Active period summary for MONTHLY or QUARTERLY view
  const activePeriodSummary = useMemo(() => {
    if (viewPeriodMode === 'MONTHLY') {
      return (
        synthesis.monthlyBreakdown.find((m) => m.periodIndex === selectedMonthIdx) ||
        synthesis.monthlyBreakdown[0]
      );
    }
    if (viewPeriodMode === 'QUARTERLY') {
      return (
        synthesis.quarterlyBreakdown.find((q) => q.periodIndex === selectedQuarterIdx) ||
        synthesis.quarterlyBreakdown[0]
      );
    }
    return null;
  }, [viewPeriodMode, selectedMonthIdx, selectedQuarterIdx, synthesis]);

  const displayedVariances = activePeriodSummary ? activePeriodSummary.variances : synthesis.variances;
  const displayedTotalAllocated = activePeriodSummary
    ? activePeriodSummary.totalAllocated
    : synthesis.totalAllocated;
  const displayedTotalActual = activePeriodSummary
    ? activePeriodSummary.totalActual
    : synthesis.totalActual;
  const displayedTotalVariance = activePeriodSummary
    ? activePeriodSummary.totalVariance
    : synthesis.totalVariance;
  const displayedTotalBurnRate = activePeriodSummary
    ? activePeriodSummary.totalBurnRate
    : synthesis.totalBurnRate;

  // Displayed Zone Cost Breakdown (Annual vs Current Selected Period)
  const displayedZoneBreakdown = useMemo(() => {
    if (zoneScopeMode === 'CURRENT_PERIOD') {
      if (viewPeriodMode === 'QUARTERLY') {
        const q = synthesis.quarterlyBreakdown.find((x) => x.periodIndex === selectedQuarterIdx);
        if (q) return q.zoneCostBreakdown;
      }
      const m = synthesis.monthlyBreakdown.find((x) => x.periodIndex === selectedMonthIdx);
      if (m) return m.zoneCostBreakdown;
    }
    return synthesis.zoneCostBreakdown;
  }, [zoneScopeMode, viewPeriodMode, selectedMonthIdx, selectedQuarterIdx, synthesis]);

  // Filtered & Sorted Machines TCO
  const filteredTcoMachines = useMemo(() => {
    const filtered = synthesis.machinesTCO.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(tcoSearch.toLowerCase()) ||
        m.code.toLowerCase().includes(tcoSearch.toLowerCase()) ||
        m.zone.toLowerCase().includes(tcoSearch.toLowerCase());
      const matchStatus = tcoStatusFilter === 'ALL' || m.berStatus === tcoStatusFilter;
      return matchSearch && matchStatus;
    });

    return [...filtered].sort((a, b) => {
      if (tcoSortKey === 'code') {
        const cmp = String(a.code || '').localeCompare(String(b.code || ''));
        return tcoSortDir === 'asc' ? cmp : -cmp;
      }
      if (tcoSortKey === 'correctiveAndExternal') {
        const vA = Number(a.correctiveCost || 0) + Number(a.externalCost || 0);
        const vB = Number(b.correctiveCost || 0) + Number(b.externalCost || 0);
        return tcoSortDir === 'asc' ? vA - vB : vB - vA;
      }
      const vA = Number(a[tcoSortKey] ?? -1);
      const vB = Number(b[tcoSortKey] ?? -1);
      return tcoSortDir === 'asc' ? vA - vB : vB - vA;
    });
  }, [synthesis.machinesTCO, tcoSearch, tcoStatusFilter, tcoSortKey, tcoSortDir]);

  const paginatedTcoMachines = useMemo(() => {
    if (tcoPageSize === 0) return filteredTcoMachines;
    const start = (tcoPage - 1) * tcoPageSize;
    return filteredTcoMachines.slice(start, start + tcoPageSize);
  }, [filteredTcoMachines, tcoPage, tcoPageSize]);

  const handleTcoSort = (key: TcoSortKey) => {
    if (tcoSortKey === key) {
      setTcoSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setTcoSortKey(key);
      setTcoSortDir(key === 'code' ? 'asc' : 'desc');
    }
    setTcoPage(1);
  };

  const renderTcoSortIcon = (key: TcoSortKey) => {
    if (tcoSortKey !== key) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    return tcoSortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-700" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-700" />
    );
  };

  // Filtered & Sorted Stock Items for PMP
  const topValuedStock = useMemo(() => {
    const list = stockItems.map((item) => {
      const qte = Math.max(0, Number(item.stockActuel ?? item.quantite ?? 0));
      const pmp = Math.max(0, Number(item.prix_unitaire ?? item.pmp ?? item.prix ?? 0));
      const totalHT = qte * pmp;
      return {
        ref: String(item.ref || item.ref_article || item.reference || item.code || item.id || ''),
        name: String(item.designation || item.nom || 'Article sans nom'),
        type: String(item.type || item.categorie || 'PDR'),
        stockActuel: qte,
        unit: item.unite || 'U',
        pmp,
        totalHT,
      };
    });

    const filtered = list.filter(
      (i) =>
        i.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
        i.ref.toLowerCase().includes(stockSearch.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      if (pmpSortKey === 'ref') {
        const cmp = a.ref.localeCompare(b.ref);
        return pmpSortDir === 'asc' ? cmp : -cmp;
      }
      const vA = Number(a[pmpSortKey] || 0);
      const vB = Number(b[pmpSortKey] || 0);
      return pmpSortDir === 'asc' ? vA - vB : vB - vA;
    });
  }, [stockItems, stockSearch, pmpSortKey, pmpSortDir]);

  const paginatedPmpStock = useMemo(() => {
    if (pmpPageSize === 0) return topValuedStock;
    const start = (pmpPage - 1) * pmpPageSize;
    return topValuedStock.slice(start, start + pmpPageSize);
  }, [topValuedStock, pmpPage, pmpPageSize]);

  const handlePmpSort = (key: PmpSortKey) => {
    if (pmpSortKey === key) {
      setPmpSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setPmpSortKey(key);
      setPmpSortDir(key === 'ref' ? 'asc' : 'desc');
    }
    setPmpPage(1);
  };

  const renderPmpSortIcon = (key: PmpSortKey) => {
    if (pmpSortKey !== key) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    return pmpSortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-700" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-700" />
    );
  };

  // Handle Export Excel
  const handleExportExcel = () => {
    try {
      FinancialExportService.exportFinancialSynthesisToExcel(synthesis, symbol);
      if (showToast) showToast('Rapport de pilotage des coûts exporté au format Excel (.xlsx)', 'success');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (showToast) showToast(`Erreur d'exportation: ${errMsg}`, 'error');
    }
  };

  const deficitAlertsCount = synthesis.budgetAlerts.filter((a) => a.status === 'DEFICIT').length;
  const warningAlertsCount = synthesis.budgetAlerts.filter((a) => a.status === 'WARNING').length;

  const financeFormulas = useMemo(
    () => [
      {
        title: '1. Vérité Comptable GMAO (Maker-Checker)',
        formula: 'Coût Validé = BT Approuvés + PM Validés + Sorties Externes Validées + Achats PDR',
        description:
          'Séparation stricte : Field Claim (déclaration terrain en attente) ≠ Coût Validé GMAO ≠ Écriture Comptable ERP. Aucune hypothèse synthétique n’est injectée.',
      },
      {
        title: '2. Coût Total de Possession (TCO) & VNC par Machine',
        formula: 'VNC = Valeur à Neuf × (1 − Taux Amortissement × Âge)  |  Coût Maint. Cumulé = ∑ (PM + BT + Externe)',
        description:
          'Chaque dépense préventive et corrective est rattachée à sa machine réelle (machineCode) sans répartition forfaitaire.',
      },
      {
        title: '3. Indice BER (Beyond Economic Repair — Seuil Remplacement)',
        formula: 'Indice BER (%) = (Coût Maintenance Cumulé / Valeur à Neuf) × 100',
        description:
          `Lorsque l'indice BER atteint ou dépasse le seuil configuré (${synthesis.budget.berThresholdPercent}%), un arbitrage de remplacement ou rétrofit est recommandé.`,
      },
      {
        title: '4. Valorisation du Stock au Prix Moyen Pondéré (PMP)',
        formula: 'Valeur Stock HT = ∑ (Stock Actuel × PMP Unitaire)  |  Valeur TTC = Valeur HT × (1 + TVA)',
        description:
          'Calcule l’immobilisation financière du magasin PDR avec simulateur multi-devises (EUR / USD → MAD).',
      },
      {
        title: '5. Contrôle Budgétaire Périodique (Annuel, Mensuel 1/12, Trimestriel 1/4)',
        formula: 'Burn Rate (%) = (Dépenses Validées Période / Plafond Alloué Période) × 100',
        description:
          `Déclenche une alerte WARNING dès ${synthesis.burnWarningPercent}% et DEFICIT au-delà de 100% (uniquement si un plafond > 0 est défini).`,
      },
    ],
    [synthesis.budget.berThresholdPercent, synthesis.burnWarningPercent]
  );

  // 🏛️ Unified Column Definitions for GmaoIndustrialDataGrid
  const tcoColumns = useMemo<GmaoColumn<MachineTCOCalculation>[]>(
    () => [
      {
        key: 'code',
        label: 'Machine & Zone',
        colLetter: 'A',
        icon: Cpu,
        sortable: true,
        width: '200px',
        render: (m: MachineTCOCalculation) => (
          <div>
            <button
              type="button"
              onClick={() => handleOpenMachineCard(m.code)}
              className="font-mono font-bold text-slate-900 hover:text-emerald-700 flex items-center gap-1.5 cursor-pointer text-left group"
            >
              <span>{m.code}</span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 transition" />
            </button>
            <div className="text-[11px] font-semibold text-slate-700 truncate max-w-[180px]">{m.name}</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-slate-400" />
              <span>{m.zone}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'valeurANeuf',
        label: 'Valeur à Neuf',
        colLetter: 'B',
        icon: Coins,
        sortable: true,
        align: 'right' as const,
        render: (m: MachineTCOCalculation) => (
          <span className="font-mono font-bold text-slate-800">
            {m.valeurANeuf !== null ? formatCurrency(m.valeurANeuf) : <span className="text-slate-400 font-normal italic">Non évalué</span>}
          </span>
        ),
      },
      {
        key: 'ageAnnees',
        label: 'Âge',
        colLetter: 'C',
        icon: Clock,
        align: 'center' as const,
        render: (m: MachineTCOCalculation & { ageAnnees?: number | null }) => {
          const age = m.ageAnnees ?? m.ageYears;
          return (
            <span className="font-mono text-slate-700">
              {age !== null && age !== undefined ? `${age} an(s)` : <span className="text-slate-400 italic">—</span>}
            </span>
          );
        },
      },
      {
        key: 'valeurNetteComptable',
        label: 'VNC Actuelle',
        colLetter: 'D',
        icon: Landmark,
        sortable: true,
        align: 'right' as const,
        render: (m: MachineTCOCalculation) => (
          <span className="font-mono font-bold text-slate-900">
            {m.valeurNetteComptable !== null ? formatCurrency(m.valeurNetteComptable) : <span className="text-slate-400 font-normal italic">—</span>}
          </span>
        ),
      },
      {
        key: 'preventiveCost',
        label: 'Coût Préventif',
        colLetter: 'E',
        icon: Calendar,
        sortable: true,
        align: 'right' as const,
        render: (m: MachineTCOCalculation) => (
          <span className="font-mono text-indigo-700 font-bold">
            {formatCurrency(m.preventiveCost)}
          </span>
        ),
      },
      {
        key: 'correctiveAndExternal',
        label: 'Correctif & Ext.',
        colLetter: 'F',
        icon: Wrench,
        sortable: true,
        align: 'right' as const,
        render: (m: MachineTCOCalculation) => (
          <span className="font-mono text-amber-800 font-bold">
            {formatCurrency(m.correctiveCost + m.externalCost)}
          </span>
        ),
      },
      {
        key: 'coutMaintenanceCumule',
        label: 'Coût Maint. Cumulé',
        colLetter: 'G',
        icon: Receipt,
        sortable: true,
        align: 'right' as const,
        render: (m: MachineTCOCalculation) => (
          <span className="font-mono font-black text-slate-900">
            {formatCurrency(m.coutMaintenanceCumule)}
          </span>
        ),
      },
      {
        key: 'berIndexPercent',
        label: 'Indice BER (%)',
        colLetter: 'H',
        icon: AlertTriangle,
        sortable: true,
        align: 'right' as const,
        render: (m: MachineTCOCalculation) => (
          <span className="font-mono font-black">
            {m.berIndexPercent !== null ? (
              <span
                className={
                  m.berIndexPercent >= synthesis.budget.berThresholdPercent
                    ? 'text-rose-600 font-black'
                    : m.berIndexPercent >= synthesis.budget.berThresholdPercent * 0.7
                      ? 'text-amber-600 font-bold'
                      : 'text-emerald-600 font-bold'
                }
              >
                {m.berIndexPercent}%
              </span>
            ) : (
              <span className="text-slate-400 font-normal italic">Non évalué</span>
            )}
          </span>
        ),
      },
      {
        key: 'berStatus',
        label: 'Diagnostic BER',
        colLetter: 'I',
        icon: ShieldAlert,
        align: 'center' as const,
        render: (m: MachineTCOCalculation) => (
          <div className="inline-flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[10px] font-bold ${
                m.berStatus === 'REPLACE_RECOMMENDED'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : m.berStatus === 'ATTENTION'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : m.berStatus === 'NON_EVALUE'
                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {m.berStatus === 'REPLACE_RECOMMENDED'
                ? 'Remplacement (BER)'
                : m.berStatus === 'ATTENTION'
                  ? 'Sous Surveillance'
                  : m.berStatus === 'NON_EVALUE'
                    ? 'Non évalué'
                    : 'Rentable'}
            </span>
            <button
              type="button"
              onClick={() => handleOpenMachineCard(m.code)}
              title={`Ouvrir la fiche machine ${m.code}`}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-emerald-700 hover:border-emerald-300 transition cursor-pointer shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [synthesis.budget.berThresholdPercent, formatCurrency]
  );

  const pmpColumns = useMemo<GmaoColumn<FinanceValuedStockRow>[]>(
    () => [
      {
        key: 'ref',
        label: 'Référence Article',
        colLetter: 'A',
        icon: Hash,
        sortable: true,
        width: '150px',
        render: (item: FinanceValuedStockRow) => (
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-[11px]">
            {item.ref}
          </span>
        ),
      },
      {
        key: 'name',
        label: 'Désignation',
        colLetter: 'B',
        icon: Package,
        render: (item: FinanceValuedStockRow) => (
          <span className="font-semibold text-slate-900">{item.name}</span>
        ),
      },
      {
        key: 'type',
        label: 'Famille / Type',
        colLetter: 'C',
        icon: Tag,
        render: (item: FinanceValuedStockRow) => (
          <span className="text-slate-500 font-medium">{item.type}</span>
        ),
      },
      {
        key: 'stockActuel',
        label: 'Stock Actuel',
        colLetter: 'D',
        icon: Boxes,
        sortable: true,
        align: 'right' as const,
        render: (item: FinanceValuedStockRow) => (
          <span className="font-mono font-bold text-slate-900">
            {item.stockActuel} {item.unit}
          </span>
        ),
      },
      {
        key: 'pmp',
        label: `PMP Unitaire (${symbol})`,
        colLetter: 'E',
        icon: Coins,
        sortable: true,
        align: 'right' as const,
        render: (item: FinanceValuedStockRow) => (
          <span className="font-mono text-slate-700">
            {formatCurrency(item.pmp)}
          </span>
        ),
      },
      {
        key: 'totalHT',
        label: `Valeur Stock HT (${symbol})`,
        colLetter: 'F',
        icon: Wallet,
        sortable: true,
        align: 'right' as const,
        render: (item: FinanceValuedStockRow) => (
          <span className="font-mono font-bold text-slate-900">
            {formatCurrency(item.totalHT)}
          </span>
        ),
      },
      {
        key: 'totalTTC',
        label: `Valeur Stock TTC (${symbol})`,
        colLetter: 'G',
        icon: Receipt,
        align: 'right' as const,
        render: (item: FinanceValuedStockRow) => (
          <span className="font-mono font-black text-emerald-800">
            {formatCurrency(item.totalHT * (1 + budget.defaultVatRate / 100))}
          </span>
        ),
      },
    ],
    [budget.defaultVatRate, formatCurrency, symbol]
  );

  const varianceColumns = useMemo<GmaoColumn<BudgetVarianceItem>[]>(
    () => [
      {
        key: 'poste',
        label: 'Poste Budgétaire',
        colLetter: 'A',
        icon: Layers,
        render: (v: BudgetVarianceItem) => (
          <div>
            <div className="font-bold text-slate-900">{v.labelFr}</div>
            <div className="text-[11px] text-slate-500">{v.labelAr}</div>
          </div>
        ),
      },
      {
        key: 'allocated',
        label: 'Budget Alloué',
        colLetter: 'B',
        icon: Wallet,
        align: 'right' as const,
        render: (v: BudgetVarianceItem) => (
          <span className="font-mono font-medium text-slate-700">
            {formatCurrency(v.allocated)}
          </span>
        ),
      },
      {
        key: 'actual',
        label: 'Coûts Validés',
        colLetter: 'C',
        icon: Receipt,
        align: 'right' as const,
        render: (v: BudgetVarianceItem) => (
          <span className="font-mono font-bold text-slate-900">
            {formatCurrency(v.actual)}
          </span>
        ),
      },
      {
        key: 'variance',
        label: 'Écart Budgétaire',
        colLetter: 'D',
        icon: ArrowUpDown,
        align: 'right' as const,
        render: (v: BudgetVarianceItem) => (
          <span
            className={`font-mono font-bold ${
              v.variance >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {v.variance >= 0 ? '+' : ''}
            {formatCurrency(v.variance)}
          </span>
        ),
      },
      {
        key: 'burnRate',
        label: 'Taux (%)',
        colLetter: 'E',
        icon: Activity,
        align: 'right' as const,
        render: (v: BudgetVarianceItem) => (
          <span className="font-mono font-bold text-slate-800">
            {v.allocated > 0 ? `${v.burnRatePercent}%` : '—'}
          </span>
        ),
      },
      {
        key: 'diagnostic',
        label: 'Diagnostic Budgétaire',
        colLetter: 'F',
        icon: CheckCircle2,
        align: 'center' as const,
        render: (v: BudgetVarianceItem) => (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-bold ${
              v.status === 'FAVORABLE'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : v.status === 'WARNING'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : v.status === 'UNCONFIGURED'
                    ? 'bg-slate-100 text-slate-600 border border-slate-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {v.status === 'FAVORABLE' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
            {v.status === 'WARNING' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
            {v.status === 'DEFICIT' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
            {v.status === 'FAVORABLE'
              ? 'Favorable'
              : v.status === 'WARNING'
                ? `Alerte Burn (≥${synthesis.burnWarningPercent}%)`
                : v.status === 'UNCONFIGURED'
                  ? 'Plafond non défini'
                  : 'Déficit / Dépassement'}
          </span>
        ),
      },
    ],
    [formatCurrency, synthesis.burnWarningPercent]
  );

  const monthlyMatrixColumns = useMemo<GmaoColumn<PeriodFinancialSummary>[]>(
    () => [
      {
        key: 'periodCode',
        label: 'Période',
        colLetter: 'A',
        icon: Calendar,
        render: (p: PeriodFinancialSummary) => (
          <span className="font-mono text-slate-900 font-bold flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800">
              {p.periodCode}
            </span>
            <span>{p.labelFr}</span>
          </span>
        ),
      },
      {
        key: 'totalAllocated',
        label: 'Plafond Alloué',
        colLetter: 'B',
        icon: Wallet,
        align: 'right' as const,
        render: (p: PeriodFinancialSummary) => (
          <span className="font-mono text-slate-600">
            {formatCurrency(p.totalAllocated)}
          </span>
        ),
      },
      {
        key: 'prev',
        label: 'Préventif',
        colLetter: 'C',
        icon: Clock,
        align: 'right' as const,
        render: (p: PeriodFinancialSummary) => (
          <span className="font-mono text-indigo-700 font-medium">
            {formatCurrency(p.variances.find((v) => v.key === 'preventive')?.actual || 0)}
          </span>
        ),
      },
      {
        key: 'corr',
        label: 'Correctif',
        colLetter: 'D',
        icon: Wrench,
        align: 'right' as const,
        render: (p: PeriodFinancialSummary) => (
          <span className="font-mono text-amber-800 font-medium">
            {formatCurrency(p.variances.find((v) => v.key === 'corrective')?.actual || 0)}
          </span>
        ),
      },
      {
        key: 'ext',
        label: 'Externe',
        colLetter: 'E',
        icon: ExternalLink,
        align: 'right' as const,
        render: (p: PeriodFinancialSummary) => (
          <span className="font-mono text-slate-700 font-medium">
            {formatCurrency(p.variances.find((v) => v.key === 'external')?.actual || 0)}
          </span>
        ),
      },
      {
        key: 'spares',
        label: 'Achats PDR',
        colLetter: 'F',
        icon: Boxes,
        align: 'right' as const,
        render: (p: PeriodFinancialSummary) => (
          <span className="font-mono text-sky-700 font-medium">
            {formatCurrency(p.variances.find((v) => v.key === 'spares')?.actual || 0)}
          </span>
        ),
      },
      {
        key: 'totalActual',
        label: 'Total Réel',
        colLetter: 'G',
        icon: Receipt,
        align: 'right' as const,
        render: (p: PeriodFinancialSummary) => (
          <span className="font-mono font-black text-slate-900">
            {formatCurrency(p.totalActual)}
          </span>
        ),
      },
      {
        key: 'totalBurnRate',
        label: 'Burn (%)',
        colLetter: 'H',
        icon: Activity,
        align: 'right' as const,
        render: (p: PeriodFinancialSummary) => (
          <span className="font-mono font-bold text-slate-800">
            {p.totalAllocated > 0 ? `${p.totalBurnRate}%` : '—'}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Statut',
        colLetter: 'I',
        icon: CheckCircle2,
        align: 'center' as const,
        render: (p: PeriodFinancialSummary) => (
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-black ${
              p.status === 'FAVORABLE'
                ? 'bg-emerald-100 text-emerald-800'
                : p.status === 'WARNING'
                  ? 'bg-amber-100 text-amber-800'
                  : p.status === 'UNCONFIGURED'
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-rose-100 text-rose-800'
            }`}
          >
            {p.status}
          </span>
        ),
      },
    ],
    [formatCurrency]
  );

  return (
    <AnimatedPage className="w-full space-y-5 pb-16">
      {/* 1. Clean Single-Row Floating Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex items-center justify-between gap-3 sm:gap-4 w-full relative overflow-hidden group/header">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-emerald-500/10 transition-colors duration-500" />

        <div className="flex items-center gap-3.5 min-w-0 relative z-10">
          <PageHeaderIcon icon={Landmark} colorClass="text-emerald-700" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-900">
                Pilotage des Coûts & Budgets Maintenance
              </h1>
              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-800">
                ISO 4217 / {currencyCode}
              </span>
              <span className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-slate-700">
                Exercice {synthesis.fiscalYear} · Mode {synthesis.periodMode}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Contrôle budgétaire périodique, coûts opérationnels validés (Maker-Checker), valorisation PMP et TCO réel par machine.
            </p>
          </div>
        </div>

        {/* Circular 3D Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title="Formules & Règles — Pilotage Coûts & Budgets"
          />

          {canManage && (
            <Action3DButton
              variant="circle"
              color="indigo"
              icon={Sliders}
              title="Configurer les Plafonds Budgétaires"
              ariaLabel="Plafonds Budgétaires"
              onClick={() => {
                setEditBudgetDraft(budget);
                setIsEditingBudget(true);
              }}
            />
          )}

          <Action3DButton
            variant="circle"
            color="emerald"
            icon={FileSpreadsheet}
            title="Exporter la synthèse financière multi-feuilles vers Excel (.xlsx)"
            ariaLabel="Exporter Synthèse (.xlsx)"
            onClick={handleExportExcel}
          />
        </div>
      </div>

      {/* 2. Interactive 5-Card Executive KPI Grid (Click to switch tab) */}
      <GmaoKpiGrid columns={5}>
        <GmaoKpiCard
          title={`Dépenses Validées (${synthesis.fiscalYear})`}
          value={formatCurrency(synthesis.totalActual)}
          unit={synthesis.totalAllocated > 0 ? `${synthesis.totalBurnRate}%` : 'Non alloué'}
          icon={Receipt}
          color="emerald"
          badgeText={
            synthesis.totalAllocated === 0
              ? 'Plafond 0 DH'
              : synthesis.totalVariance >= 0
              ? `Solde: +${formatCurrency(synthesis.totalVariance)}`
              : `Déficit: ${formatCurrency(synthesis.totalVariance)}`
          }
          footerLabel="Budget alloué"
          footerValue={formatCurrency(synthesis.totalAllocated)}
          isActive={activeTab === 'budgets'}
          onClick={() => setActiveTab('budgets')}
        />
        <GmaoKpiCard
          title="Pertes d'Arrêt Confirmées"
          value={formatCurrency(synthesis.totalDowntimeLossMAD)}
          unit={`${synthesis.totalDowntimeHours}h arrêt`}
          icon={AlertTriangle}
          color="rose"
          badgeText={`Taux: ${formatCurrency(synthesis.budget.productionDowntimeCostPerHour)}/h`}
          footerLabel="Zones actives"
          footerValue={`${synthesis.zoneCostBreakdown.length} zone(s)`}
          isActive={activeTab === 'downtime_roi'}
          onClick={() => setActiveTab('downtime_roi')}
        />
        <GmaoKpiCard
          title="Valorisation Stock (PMP)"
          value={formatCurrency(synthesis.stockValuationPMP_MAD)}
          unit={`${synthesis.stockItemsCount} art.`}
          icon={Wallet}
          color="blue"
          badgeText={`TVA ${synthesis.budget.defaultVatRate}%`}
          footerLabel="Valeur TTC"
          footerValue={formatCurrency(synthesis.stockValuationWithVAT_MAD)}
          isActive={activeTab === 'inventory_procurement'}
          onClick={() => setActiveTab('inventory_procurement')}
        />
        <GmaoKpiCard
          title="Main d'Œuvre Interne"
          value={formatCurrency(synthesis.internalLaborCostMAD)}
          unit={`${synthesis.internalLaborHours}h`}
          icon={Clock}
          color="indigo"
          badgeText={`Taux tech: ${formatCurrency(synthesis.budget.technicianHourlyRate)}/h`}
          footerLabel="Dossiers externes"
          footerValue={`${sortiesExterne.length} dossier(s)`}
          isActive={activeTab === 'labor_subcontracting'}
          onClick={() => setActiveTab('labor_subcontracting')}
        />
        <GmaoKpiCard
          title={`Alerte BER (≥${synthesis.budget.berThresholdPercent}%)`}
          value={synthesis.machinesBerCount}
          unit="machine(s)"
          icon={Wrench}
          color="amber"
          badgeText={
            synthesis.machinesBerCount > 0 ? 'Remplacement conseillé' : '0 dépassement BER'
          }
          footerLabel="Parc évalué"
          footerValue={`${synthesis.machinesValuedCount} éval. · ${synthesis.machinesUnvaluedCount} non éval.`}
          isActive={activeTab === 'tco_assets'}
          onClick={() => setActiveTab('tco_assets')}
        />
      </GmaoKpiGrid>

      {/* 2B. Dedicated Elevated Financial Settings & Period Card */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Header Toolbar: Icon + Title + Badges + Reset Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Paramètres d&apos;Exercice & Devise de Référence
                </span>
                <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-amber-200/70 shadow-2xs font-mono">
                  Exercice : {synthesis.fiscalYear}
                </span>
                <span className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-emerald-200/70 shadow-2xs font-mono">
                  Devise : {currencyCode}
                </span>
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-slate-200 font-mono">
                  {synthesis.machinesTCO.length} machines évaluées
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Sélection de l&apos;exercice fiscal budgétaire, conversion dynamique de devise (ISO 4217) et seuils d&apos;alerte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {/* Live Burn Rate Badge */}
            <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
              <span className="text-slate-600 font-medium">Consommation Globale :</span>
              <strong className="text-slate-900 font-black">
                {formatCurrency(synthesis.totalActual)}
              </strong>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {synthesis.totalAllocated > 0 ? `${synthesis.totalBurnRate}%` : 'Non alloué'}
              </span>
            </div>

            {/* Circular Reset Button */}
            {(currencyCode !== 'MAD' || budget.fiscalYear !== new Date().getFullYear()) && (
              <button
                type="button"
                onClick={() => {
                  setCurrency('MAD');
                  setBudget((prev) => ({ ...prev, fiscalYear: new Date().getFullYear() }));
                }}
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
                title="Rétablir la devise MAD et l'exercice en cours"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Structured Filter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* 1. Fiscal Year Selector */}
          <div className="md:col-span-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                Exercice Fiscal Budgétaire
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                Année Fiscale
              </span>
            </div>
            <div className="flex items-center gap-2 h-10 px-3 bg-slate-50 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <select
                value={budget.fiscalYear}
                onChange={(e) => {
                  const nextYr = Number(e.target.value) || new Date().getFullYear();
                  setBudget((prev) => ({ ...prev, fiscalYear: nextYr }));
                }}
                aria-label="Exercice fiscal"
                className="w-full bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr}>
                    Exercice {yr} {yr === new Date().getFullYear() ? '(Année en cours)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Quick Currency Selector (ISO 4217) */}
          <div className="md:col-span-7">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                Devise d&apos;Affichage &amp; Taux de Change (ISO 4217)
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                MAD • EUR • USD
              </span>
            </div>
            <div
              className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 h-10"
              role="group"
              aria-label="Sélecteur de devise"
            >
              <span className="px-2 font-bold text-slate-600 flex items-center gap-1 text-xs shrink-0">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>Devise :</span>
              </span>
              <button
                type="button"
                onClick={() => setCurrency('MAD')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  currencyCode === 'MAD'
                    ? 'bg-white text-emerald-900 shadow-2xs border border-slate-200/60 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                MAD (Dirham DH)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('EUR')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  currencyCode === 'EUR'
                    ? 'bg-white text-emerald-900 shadow-2xs border border-slate-200/60 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EUR (€ Euro)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  currencyCode === 'USD'
                    ? 'bg-white text-emerald-900 shadow-2xs border border-slate-200/60 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                USD ($ Dollar)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Framed Segmented Navigation Tabs */}
      <div className="bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300/80 shadow-inner flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('budgets')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'budgets'
              ? 'bg-white text-emerald-900 shadow-[0_6px_16px_-3px_rgba(0,0,0,0.12)] border border-slate-200/80 -translate-y-0.5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Receipt className={`w-4 h-4 ${activeTab === 'budgets' ? 'text-emerald-600' : 'text-slate-500'}`} />
          <span>Budgets & Suivi Périodique</span>
          {synthesis.budgetAlerts.length > 0 && (
            <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white">
              {synthesis.budgetAlerts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tco_assets')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'tco_assets'
              ? 'bg-white text-emerald-900 shadow-[0_6px_16px_-3px_rgba(0,0,0,0.12)] border border-slate-200/80 -translate-y-0.5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Layers className={`w-4 h-4 ${activeTab === 'tco_assets' ? 'text-emerald-600' : 'text-slate-500'}`} />
          <span>TCO & Coûts par Machine</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-mono text-slate-700 border border-slate-200">
            {synthesis.machinesTCO.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory_procurement')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'inventory_procurement'
              ? 'bg-white text-emerald-900 shadow-[0_6px_16px_-3px_rgba(0,0,0,0.12)] border border-slate-200/80 -translate-y-0.5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <ArrowRightLeft className={`w-4 h-4 ${activeTab === 'inventory_procurement' ? 'text-emerald-600' : 'text-slate-500'}`} />
          <span>Valorisation PDR & Multi-Devises</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('labor_subcontracting')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'labor_subcontracting'
              ? 'bg-white text-emerald-900 shadow-[0_6px_16px_-3px_rgba(0,0,0,0.12)] border border-slate-200/80 -translate-y-0.5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Clock className={`w-4 h-4 ${activeTab === 'labor_subcontracting' ? 'text-emerald-600' : 'text-slate-500'}`} />
          <span>Main d'Œuvre & Sous-traitance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('downtime_roi')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'downtime_roi'
              ? 'bg-white text-emerald-900 shadow-[0_6px_16px_-3px_rgba(0,0,0,0.12)] border border-slate-200/80 -translate-y-0.5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Calculator className={`w-4 h-4 ${activeTab === 'downtime_roi' ? 'text-emerald-600' : 'text-slate-500'}`} />
          <span>Pertes d'Arrêt & Coûts par Zone</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('currency_matrix')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'currency_matrix'
              ? 'bg-white text-emerald-900 shadow-[0_6px_16px_-3px_rgba(0,0,0,0.12)] border border-slate-200/80 -translate-y-0.5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Sliders className={`w-4 h-4 ${activeTab === 'currency_matrix' ? 'text-emerald-600' : 'text-slate-500'}`} />
          <span>Taux de Change & Paramètres</span>
        </button>
      </div>

      {/* 4. Tab 1: Maintenance Budgeting, Period Tracking & Alerts (FIN-P2) */}
      {activeTab === 'budgets' && (
        <FinanceBudgetsSubTab
          synthesis={synthesis}
          budget={budget}
          viewPeriodMode={viewPeriodMode}
          setViewPeriodMode={setViewPeriodMode}
          selectedMonthIdx={selectedMonthIdx}
          setSelectedMonthIdx={setSelectedMonthIdx}
          selectedQuarterIdx={selectedQuarterIdx}
          setSelectedQuarterIdx={setSelectedQuarterIdx}
          canManage={canManage}
          onOpenEditBudget={() => {
            setEditBudgetDraft(budget);
            setIsEditingBudget(true);
          }}
          symbol={symbol}
          currencyCode={currencyCode}
          formatCurrency={formatCurrency}
          deficitAlertsCount={deficitAlertsCount}
          warningAlertsCount={warningAlertsCount}
          displayedVariances={displayedVariances}
          activePeriodSummary={activePeriodSummary}
          displayedTotalAllocated={displayedTotalAllocated}
          displayedTotalActual={displayedTotalActual}
          displayedTotalVariance={displayedTotalVariance}
          displayedTotalBurnRate={displayedTotalBurnRate}
          varianceColumns={varianceColumns}
          monthlyMatrixColumns={monthlyMatrixColumns}
        />
      )}

      {/* 5. Tab 2: Asset TCO & Depreciation (Elevated Excel Filter Card + Sortable/Paginated Grid) */}
      {activeTab === 'tco_assets' && (
        <div className="space-y-4">
          {/* Elevated Excel Filter Card for TCO */}
          <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
            {/* Header Toolbar: Icon + Title + Count Badge + Status Pills + Reset Knob */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shadow-2xs shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Filtres &amp; Analyse TCO par Machine
                    </span>
                    <span className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-emerald-200/70 shadow-2xs font-mono">
                      {filteredTcoMachines.length} / {synthesis.machinesTCO.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Dépenses réelles ventilées sans hypothèses synthétiques · Surveillance des seuils BER
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* BER Status Filter Pills */}
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
                  {TCO_FILTER_PILLS.map((pill) => {
                    const isSelected = tcoStatusFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => {
                          setTcoStatusFilter(pill.id);
                          setTcoPage(1);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200/60'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>{pill.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Circular Reset Button */}
                {(tcoSearch || tcoStatusFilter !== 'ALL' || tcoSortKey !== 'coutMaintenanceCumule' || tcoSortDir !== 'desc') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTcoSearch('');
                      setTcoStatusFilter('ALL');
                      setTcoSortKey('coutMaintenanceCumule');
                      setTcoSortDir('desc');
                      setTcoPage(1);
                    }}
                    title="Réinitialiser tous les filtres TCO"
                    className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Search & Sort Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-7">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Recherche Machine ou Zone
                  </label>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                    Col. A
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    placeholder="Rechercher par code machine, nom ou zone géographique..."
                    value={tcoSearch}
                    onChange={(e) => {
                      setTcoSearch(e.target.value);
                      setTcoPage(1);
                    }}
                    className="w-full h-10 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-2xs"
                  />
                  {tcoSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setTcoSearch('');
                        setTcoPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="md:col-span-5">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Critère de Tri Financier
                  </label>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                    {tcoSortDir === 'asc' ? 'Croissant ▲' : 'Décroissant ▼'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 h-10 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <select
                    value={tcoSortKey}
                    onChange={(e) => {
                      setTcoSortKey(e.target.value as TcoSortKey);
                      setTcoPage(1);
                    }}
                    aria-label="Trier le tableau TCO"
                    className="w-full bg-white px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 border border-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="coutMaintenanceCumule">Coût Maint. Cumulé (Col. G)</option>
                    <option value="berIndexPercent">Indice BER (%) (Col. H)</option>
                    <option value="valeurANeuf">Valeur à Neuf (Col. B)</option>
                    <option value="valeurNetteComptable">VNC Actuelle (Col. D)</option>
                    <option value="preventiveCost">Coût Préventif (Col. E)</option>
                    <option value="correctiveAndExternal">Coût Correctif &amp; Ext. (Col. F)</option>
                    <option value="code">Code Machine (Col. A)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setTcoSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0 shadow-2xs"
                    title={tcoSortDir === 'asc' ? 'Tri croissant' : 'Tri décroissant'}
                  >
                    {tcoSortDir === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-emerald-700" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Unified GmaoIndustrialDataGrid with Integrated TablePaginationCard */}
          <GmaoIndustrialDataGrid
            title="Registre TCO & Amortissement par Machine"
            icon={<Layers className="w-4 h-4 text-emerald-600" />}
            excelMapping="code (A) | valeurANeuf (B) | age (C) | vnc (D) | prev (E) | corr_ext (F) | cout_cumule (G) | ber_percent (H) | statut (I)"
            bannerColor="emerald"
            columns={tcoColumns}
            data={paginatedTcoMachines}
            sortField={tcoSortKey}
            sortOrder={tcoSortDir}
            onSort={handleTcoSort}
            renderSortIcon={renderTcoSortIcon}
            startIndex={(tcoPage - 1) * (tcoPageSize || filteredTcoMachines.length)}
            showRowNumber={true}
            emptyIcon={<Layers className="w-8 h-8 text-slate-300" />}
            emptyMessage="Aucune machine ne correspond aux critères de recherche ou de statut BER."
            pagination={{
              currentPage: tcoPage,
              setCurrentPage: setTcoPage,
              pageSize: tcoPageSize,
              setPageSize: setTcoPageSize,
              totalItems: filteredTcoMachines.length,
              pageSizeOptions: [10, 15, 30, 50, 0],
              color: 'emerald',
              itemLabel: 'machines',
            }}
          />
        </div>
      )}

      {/* 6. Tab 3: Spare Parts Inventory & Procurement (Multi-Currency + Paginated PMP Grid) */}
      {activeTab === 'inventory_procurement' && (
        <div className="space-y-5">
          {/* Multi-Currency PO Calculator / Converter */}
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)]">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <div className="p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Simulateur de Commande Fournisseur Multi-Devises (EUR / USD → {currencyCode})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Conversion selon le cours historique ou appliqué, avec calcul de TVA ({budget.defaultVatRate}%).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Devise Fournisseur</label>
                  <select
                    value={simCurrency}
                    onChange={(e) => setSimCurrency(e.target.value as 'EUR' | 'USD')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-900 focus:outline-hidden"
                  >
                    <option value="EUR">Euro (€ - EUR)</option>
                    <option value="USD">Dollar ($ - USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Prix Unitaire Devise</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={simForeignPrice}
                    onChange={(e) => setSimForeignPrice(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Quantité</label>
                  <input
                    type="number"
                    min="1"
                    value={simQuantity}
                    onChange={(e) => setSimQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Taux de Change (1 {simCurrency} = X MAD)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={simCustomRate}
                    onChange={(e) => setSimCustomRate(Number(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                  />
                </div>

                {/* Conversion Result Box */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Total Converti TTC (MAD)
                  </span>
                  <span className="text-base font-black text-emerald-900 font-mono mt-0.5">
                    {formatCurrency(
                      Math.round(simForeignPrice * simQuantity * simCustomRate * (1 + budget.defaultVatRate / 100) * 100) /
                        100
                    )}
                  </span>
                  <span className="text-[10px] text-emerald-700">
                    HT: {formatCurrency(Math.round(simForeignPrice * simQuantity * simCustomRate * 100) / 100)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Elevated Filter Bar for PMP Stock Table */}
          <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-200/80 flex items-center justify-center text-blue-700 shadow-2xs shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Filtres &amp; Valorisation PMP du Stock
                    </span>
                    <span className="bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-blue-200/70 shadow-2xs font-mono">
                      {topValuedStock.length} / {stockItems.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Articles valorisés selon le cours d'achat réel unitaire enregistré en magasin
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(stockSearch || pmpSortKey !== 'totalHT' || pmpSortDir !== 'desc') && (
                  <button
                    type="button"
                    onClick={() => {
                      setStockSearch('');
                      setPmpSortKey('totalHT');
                      setPmpSortDir('desc');
                      setPmpPage(1);
                    }}
                    title="Réinitialiser les filtres stock PMP"
                    className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-7">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Recherche Article ou Référence
                  </label>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                    Col. A+B
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    placeholder="Rechercher par référence, désignation..."
                    value={stockSearch}
                    onChange={(e) => {
                      setStockSearch(e.target.value);
                      setPmpPage(1);
                    }}
                    className="w-full h-10 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all shadow-2xs"
                  />
                  {stockSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setStockSearch('');
                        setPmpPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="md:col-span-5">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Critère de Tri de Valorisation
                  </label>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                    {pmpSortDir === 'asc' ? 'Croissant ▲' : 'Décroissant ▼'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 h-10 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <select
                    value={pmpSortKey}
                    onChange={(e) => {
                      setPmpSortKey(e.target.value as PmpSortKey);
                      setPmpPage(1);
                    }}
                    aria-label="Trier la valorisation stock PMP"
                    className="w-full bg-white px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 border border-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="totalHT">Valeur Stock HT (Col. F)</option>
                    <option value="pmp">PMP Unitaire (Col. E)</option>
                    <option value="stockActuel">Stock Actuel (Col. D)</option>
                    <option value="ref">Référence Article (Col. A)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setPmpSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0 shadow-2xs"
                    title={pmpSortDir === 'asc' ? 'Tri croissant' : 'Tri décroissant'}
                  >
                    {pmpSortDir === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-blue-700" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Unified GmaoIndustrialDataGrid with Integrated TablePaginationCard */}
          <GmaoIndustrialDataGrid
            title="Valorisation du Stock PDR au Coût Moyen Pondéré (PMP)"
            icon={<Wallet className="w-4 h-4 text-blue-600" />}
            excelMapping="ref (A) | designation (B) | type (C) | stockActuel (D) | pmp (E) | totalHT (F) | totalTTC (G)"
            bannerColor="blue"
            columns={pmpColumns}
            data={paginatedPmpStock}
            sortField={pmpSortKey}
            sortOrder={pmpSortDir}
            onSort={handlePmpSort}
            renderSortIcon={renderPmpSortIcon}
            startIndex={(pmpPage - 1) * (pmpPageSize || topValuedStock.length)}
            showRowNumber={true}
            emptyIcon={<Wallet className="w-8 h-8 text-slate-300" />}
            emptyMessage="Aucun article de stock ne correspond à votre recherche."
            pagination={{
              currentPage: pmpPage,
              setCurrentPage: setPmpPage,
              pageSize: pmpPageSize,
              setPageSize: setPmpPageSize,
              totalItems: topValuedStock.length,
              pageSizeOptions: [15, 30, 50, 100, 0],
              color: 'blue',
              itemLabel: 'articles PDR',
            }}
          />
        </div>
      )}

      {/* 7. Tab 4: Labor & Subcontracting Ledger */}
      {activeTab === 'labor_subcontracting' && (
        <FinanceLaborSubcontractingSubTab
          synthesis={synthesis}
          budget={budget}
          sortiesExterne={sortiesExterne}
          formatCurrency={formatCurrency}
          symbol={symbol}
          onOpenMachineCard={handleOpenMachineCard}
        />
      )}

      {/* 8. Tab 5: Downtime Financial Impact & Zone Cost Breakdown (P2-4 Period Zone Costs + Machine Links) */}
      {activeTab === 'downtime_roi' && (
        <FinanceDowntimeRoiSubTab
          synthesis={synthesis}
          budget={budget}
          displayedZoneBreakdown={displayedZoneBreakdown}
          zoneScopeMode={zoneScopeMode}
          setZoneScopeMode={setZoneScopeMode}
          selectedMonthIdx={selectedMonthIdx}
          setSelectedMonthIdx={setSelectedMonthIdx}
          formatCurrency={formatCurrency}
          symbol={symbol}
          onOpenMachineCard={handleOpenMachineCard}
        />
      )}

      {/* 9. Tab 6: Currency Matrix & Historical Rates */}
      {activeTab === 'currency_matrix' && (
        <FinanceCurrencyMatrixSubTab
          exchangeRates={exchangeRates}
          symbol={symbol}
        />
      )}

      {/* 10. Edit Budget Allocations & Periodicity Modal (Strictly guarded by canManage) */}
      <FinanceBudgetEditModal
        open={isEditingBudget}
        canManage={canManage}
        editBudgetDraft={editBudgetDraft}
        setEditBudgetDraft={setEditBudgetDraft}
        symbol={symbol}
        onClose={() => setIsEditingBudget(false)}
        onSave={saveBudget}
      />

      {/* Formulas Modal */}
      <FinanceFormulasModal
        open={showFormulasModal}
        onClose={() => setShowFormulasModal(false)}
        formulas={financeFormulas}
      />
    </AnimatedPage>
  );
}
