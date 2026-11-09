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

import React, { useState, useMemo, useEffect } from 'react';
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
  History,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Wallet,
  X,
  Cpu,
  Building2,
  Boxes,
  FileText,
  Package,
  Tag,
  Activity,
  MapPin,
  User,
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
} from '../../../application/services/FinancialCalculationService';
import { FinancialExportService } from '../../../services/financialExportService';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import GmaoKpiCard, { GmaoKpiGrid } from '../../components/common/GmaoKpiCard';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import TablePaginationCard from '../../components/common/TablePaginationCard';

interface FinanceViewProps {
  machines?: any[];
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
  sortiesExterne?: any[];
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
    const handleBudgetUpdated = (e: any) => {
      if (e?.detail) {
        setBudget(e.detail);
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
    } catch (e: any) {
      if (showToast) showToast(`Erreur d'exportation: ${e.message}`, 'error');
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
  const tcoColumns = useMemo(
    () => [
      {
        key: 'code',
        label: 'Machine & Zone',
        colLetter: 'A',
        icon: Cpu,
        sortable: true,
        width: '200px',
        render: (m: any) => (
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
        render: (m: any) => (
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
        render: (m: any) => (
          <span className="font-mono text-slate-700">
            {m.ageAnnees !== null ? `${m.ageAnnees} an(s)` : <span className="text-slate-400 italic">—</span>}
          </span>
        ),
      },
      {
        key: 'valeurNetteComptable',
        label: 'VNC Actuelle',
        colLetter: 'D',
        icon: Landmark,
        sortable: true,
        align: 'right' as const,
        render: (m: any) => (
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
        render: (m: any) => (
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
        render: (m: any) => (
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
        render: (m: any) => (
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
        render: (m: any) => (
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
        render: (m: any) => (
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

  const pmpColumns = useMemo(
    () => [
      {
        key: 'ref',
        label: 'Référence Article',
        colLetter: 'A',
        icon: Hash,
        sortable: true,
        width: '150px',
        render: (item: any) => (
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
        render: (item: any) => (
          <span className="font-semibold text-slate-900">{item.name}</span>
        ),
      },
      {
        key: 'type',
        label: 'Famille / Type',
        colLetter: 'C',
        icon: Tag,
        render: (item: any) => (
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
        render: (item: any) => (
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
        render: (item: any) => (
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
        render: (item: any) => (
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
        render: (item: any) => (
          <span className="font-mono font-black text-emerald-800">
            {formatCurrency(item.totalHT * (1 + budget.defaultVatRate / 100))}
          </span>
        ),
      },
    ],
    [budget.defaultVatRate, formatCurrency, symbol]
  );

  const varianceColumns = useMemo(
    () => [
      {
        key: 'poste',
        label: 'Poste Budgétaire',
        colLetter: 'A',
        icon: Layers,
        render: (v: any) => (
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
        render: (v: any) => (
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
        render: (v: any) => (
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
        render: (v: any) => (
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
        render: (v: any) => (
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
        render: (v: any) => (
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

  const monthlyMatrixColumns = useMemo(
    () => [
      {
        key: 'periodCode',
        label: 'Période',
        colLetter: 'A',
        icon: Calendar,
        render: (p: any) => (
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
        render: (p: any) => (
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
        render: (p: any) => (
          <span className="font-mono text-indigo-700 font-medium">
            {formatCurrency(p.variances.find((v: any) => v.key === 'preventive')?.actual || 0)}
          </span>
        ),
      },
      {
        key: 'corr',
        label: 'Correctif',
        colLetter: 'D',
        icon: Wrench,
        align: 'right' as const,
        render: (p: any) => (
          <span className="font-mono text-amber-800 font-medium">
            {formatCurrency(p.variances.find((v: any) => v.key === 'corrective')?.actual || 0)}
          </span>
        ),
      },
      {
        key: 'ext',
        label: 'Externe',
        colLetter: 'E',
        icon: ExternalLink,
        align: 'right' as const,
        render: (p: any) => (
          <span className="font-mono text-slate-700 font-medium">
            {formatCurrency(p.variances.find((v: any) => v.key === 'external')?.actual || 0)}
          </span>
        ),
      },
      {
        key: 'spares',
        label: 'Achats PDR',
        colLetter: 'F',
        icon: Boxes,
        align: 'right' as const,
        render: (p: any) => (
          <span className="font-mono text-sky-700 font-medium">
            {formatCurrency(p.variances.find((v: any) => v.key === 'spares')?.actual || 0)}
          </span>
        ),
      },
      {
        key: 'totalActual',
        label: 'Total Réel',
        colLetter: 'G',
        icon: Receipt,
        align: 'right' as const,
        render: (p: any) => (
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
        render: (p: any) => (
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
        render: (p: any) => (
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

  const technicianLaborColumns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Technicien Référent',
        colLetter: 'A',
        icon: User,
        render: (t: any) => (
          <span className="font-bold text-slate-900">{t.name}</span>
        ),
      },
      {
        key: 'interventionsCount',
        label: 'Interventions',
        colLetter: 'B',
        icon: Wrench,
        align: 'center' as const,
        render: (t: any) => (
          <span className="font-mono text-slate-600">{t.interventionsCount}</span>
        ),
      },
      {
        key: 'hours',
        label: 'Heures Validées',
        colLetter: 'C',
        icon: Clock,
        align: 'right' as const,
        render: (t: any) => (
          <span className="font-mono font-medium text-slate-800">{t.hours} h</span>
        ),
      },
      {
        key: 'costMAD',
        label: `Coût Main d'Œuvre (${symbol})`,
        colLetter: 'D',
        icon: Receipt,
        align: 'right' as const,
        render: (t: any) => (
          <span className="font-mono font-bold text-emerald-800">
            {formatCurrency(t.costMAD)}
          </span>
        ),
      },
    ],
    [formatCurrency, symbol]
  );

  const externalServicesColumns = useMemo(
    () => [
      {
        key: 'organe',
        label: 'Organe / Machine',
        colLetter: 'A',
        icon: Cpu,
        render: (se: any) => {
          const organeLabel =
            se.designation_moteur || se.designation || se.nom || se.code_moteur_reel || 'Moteur / Organe';
          const machineLabel = se.id_machine || se.machine_cible || se.code_machine || 'Machine';
          return (
            <div>
              <div className="font-bold text-slate-900">{organeLabel}</div>
              <button
                type="button"
                onClick={() => handleOpenMachineCard(machineLabel)}
                className="text-[10px] text-emerald-700 hover:underline font-mono cursor-pointer"
              >
                {machineLabel}
              </button>
            </div>
          );
        },
      },
      {
        key: 'prestataire',
        label: 'Prestataire Externe',
        colLetter: 'B',
        icon: Building2,
        render: (se: any) => (
          <span className="text-slate-700 font-medium">
            {se.fournisseur_externe || se.fournisseur || se.prestataire || se.atelier || 'Atelier Externe'}
          </span>
        ),
      },
      {
        key: 'statut',
        label: 'Statut du Dossier',
        colLetter: 'C',
        icon: CheckCircle2,
        align: 'center' as const,
        render: (se: any) => (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            {se.etat || se.statut || 'En cours'}
          </span>
        ),
      },
      {
        key: 'cout',
        label: `Coût Engagé (${symbol})`,
        colLetter: 'D',
        icon: Coins,
        align: 'right' as const,
        render: (se: any) => {
          const cost = Number(
            se.cout_reel ?? se.cout_bobinage ?? se.prix_reparation ?? se.cout_estime ?? se.cout ?? 0
          );
          return (
            <span className="font-mono font-bold text-slate-900">
              {formatCurrency(cost)}
            </span>
          );
        },
      },
    ],
    [formatCurrency, symbol]
  );

  const zoneBreakdownColumns = useMemo(
    () => [
      {
        key: 'zone',
        label: 'Zone / Atelier',
        colLetter: 'A',
        icon: MapPin,
        render: (z: any) => (
          <span className="font-bold text-slate-900">{z.zone}</span>
        ),
      },
      {
        key: 'machinesCount',
        label: 'Machines Actives',
        colLetter: 'B',
        icon: Cpu,
        align: 'center' as const,
        render: (z: any) => (
          <span className="font-mono text-slate-600">{z.machinesCount}</span>
        ),
      },
      {
        key: 'preventiveCost',
        label: 'Coût Préventif',
        colLetter: 'C',
        icon: Clock,
        align: 'right' as const,
        render: (z: any) => (
          <span className="font-mono text-indigo-700 font-medium">
            {formatCurrency(z.preventiveCost)}
          </span>
        ),
      },
      {
        key: 'correctiveCost',
        label: 'Coût Correctif',
        colLetter: 'D',
        icon: Wrench,
        align: 'right' as const,
        render: (z: any) => (
          <span className="font-mono text-amber-800 font-medium">
            {formatCurrency(z.correctiveCost)}
          </span>
        ),
      },
      {
        key: 'externalCost',
        label: 'Sous-traitance',
        colLetter: 'E',
        icon: ExternalLink,
        align: 'right' as const,
        render: (z: any) => (
          <span className="font-mono text-slate-700 font-medium">
            {formatCurrency(z.externalCost)}
          </span>
        ),
      },
      {
        key: 'totalCost',
        label: `Total Zone (${symbol})`,
        colLetter: 'F',
        icon: Receipt,
        align: 'right' as const,
        render: (z: any) => (
          <span className="font-mono font-black text-slate-900">
            {formatCurrency(z.totalCost)}
          </span>
        ),
      },
    ],
    [formatCurrency, symbol]
  );

  const paretoMachinesColumns = useMemo(
    () => [
      {
        key: 'code',
        label: 'Code Machine',
        colLetter: 'A',
        icon: Cpu,
        render: (m: any) => (
          <button
            type="button"
            onClick={() => handleOpenMachineCard(m.code)}
            className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-emerald-800 hover:bg-emerald-50 inline-flex items-center gap-1 cursor-pointer font-mono font-bold"
          >
            <span>{m.code}</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        ),
      },
      {
        key: 'name',
        label: 'Désignation',
        colLetter: 'B',
        icon: FileText,
        render: (m: any) => (
          <span className="font-medium text-slate-800">{m.name}</span>
        ),
      },
      {
        key: 'coutMaintenanceCumule',
        label: 'Coût Maint. Cumulé',
        colLetter: 'C',
        icon: Receipt,
        align: 'right' as const,
        render: (m: any) => (
          <span className="font-mono font-bold text-slate-900">
            {formatCurrency(m.coutMaintenanceCumule)}
          </span>
        ),
      },
      {
        key: 'valeurANeuf',
        label: 'Valeur à Neuf',
        colLetter: 'D',
        icon: Coins,
        align: 'right' as const,
        render: (m: any) => (
          <span className="font-mono text-slate-600">
            {m.valeurANeuf !== null ? formatCurrency(m.valeurANeuf) : 'Non évalué'}
          </span>
        ),
      },
      {
        key: 'berIndexPercent',
        label: 'Indice BER',
        colLetter: 'E',
        icon: AlertTriangle,
        align: 'right' as const,
        render: (m: any) => (
          <span className="font-mono font-black text-slate-900">
            {m.berIndexPercent !== null ? `${m.berIndexPercent}%` : 'Non évalué'}
          </span>
        ),
      },
      {
        key: 'berStatus',
        label: 'Recommandation Stratégique',
        colLetter: 'F',
        icon: ShieldAlert,
        align: 'center' as const,
        render: (m: any) => (
          <span
            className={`rounded-md px-2.5 py-0.5 text-[10px] font-black ${
              m.berStatus === 'REPLACE_RECOMMENDED'
                ? 'bg-rose-100 text-rose-800'
                : m.berStatus === 'ATTENTION'
                ? 'bg-amber-100 text-amber-800'
                : m.berStatus === 'NON_EVALUE'
                ? 'bg-slate-100 text-slate-600'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {m.berStatus === 'REPLACE_RECOMMENDED'
              ? 'Investissement Remplacement Requis'
              : m.berStatus === 'ATTENTION'
              ? 'Renforcer Maintenance Préventive'
              : m.berStatus === 'NON_EVALUE'
              ? 'Renseigner Valeur à Neuf sur Fiche Machine'
              : 'Maintien Opérationnel Rentable'}
          </span>
        ),
      },
    ],
    [formatCurrency]
  );

  const exchangeRatesColumns = useMemo(
    () => [
      {
        key: 'date',
        label: 'Date d\'Enregistrement',
        colLetter: 'A',
        icon: Calendar,
        render: (rate: any) => (
          <span className="font-mono text-slate-600">{rate.date}</span>
        ),
      },
      {
        key: 'paire',
        label: 'Paire de Devises',
        colLetter: 'B',
        icon: Coins,
        render: (rate: any) => (
          <span className="font-bold text-slate-900">
            {rate.sourceCurrency} → {rate.targetCurrency}
          </span>
        ),
      },
      {
        key: 'rate',
        label: 'Taux de Conversion',
        colLetter: 'C',
        icon: Activity,
        align: 'right' as const,
        render: (rate: any) => (
          <span className="font-mono font-bold text-slate-900">{rate.rate}</span>
        ),
      },
      {
        key: 'note',
        label: 'Source / Note',
        colLetter: 'D',
        icon: FileText,
        render: (rate: any) => (
          <span className="text-slate-600">{rate.note || 'Taux standard'}</span>
        ),
      },
    ],
    []
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
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Suivi Budgétaire & Contrôle Périodique (Exercice {synthesis.fiscalYear})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Suivi annuel, mensuel (12 mois) ou trimestriel (T1–T4). Seuil d'alerte burn configuré à{' '}
                <strong className="text-slate-700">{synthesis.burnWarningPercent}%</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* P2-3: Period Mode Selector (Annuel | Mensuel | Trimestriel) */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 ml-1.5 mr-1" />
                <button
                  type="button"
                  onClick={() => setViewPeriodMode('ANNUAL')}
                  className={`rounded-lg px-2.5 py-1 font-extrabold transition cursor-pointer ${
                    viewPeriodMode === 'ANNUAL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Annuel
                </button>
                <button
                  type="button"
                  onClick={() => setViewPeriodMode('MONTHLY')}
                  className={`rounded-lg px-2.5 py-1 font-extrabold transition cursor-pointer ${
                    viewPeriodMode === 'MONTHLY'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mensuel (12M)
                </button>
                <button
                  type="button"
                  onClick={() => setViewPeriodMode('QUARTERLY')}
                  className={`rounded-lg px-2.5 py-1 font-extrabold transition cursor-pointer ${
                    viewPeriodMode === 'QUARTERLY'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Trimestriel (T1-T4)
                </button>
              </div>

              {/* Specific Month or Quarter Dropdown when MONTHLY / QUARTERLY */}
              {viewPeriodMode === 'MONTHLY' && (
                <select
                  value={selectedMonthIdx}
                  onChange={(e) => setSelectedMonthIdx(Number(e.target.value) || 1)}
                  aria-label="Mois sélectionné"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden"
                >
                  {synthesis.monthlyBreakdown.map((m) => (
                    <option key={m.periodCode} value={m.periodIndex}>
                      {m.periodCode} — {m.labelFr} ({m.totalBurnRate}%)
                    </option>
                  ))}
                </select>
              )}

              {viewPeriodMode === 'QUARTERLY' && (
                <select
                  value={selectedQuarterIdx}
                  onChange={(e) => setSelectedQuarterIdx(Number(e.target.value) || 1)}
                  aria-label="Trimestre sélectionné"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden"
                >
                  {synthesis.quarterlyBreakdown.map((q) => (
                    <option key={q.periodCode} value={q.periodIndex}>
                      {q.labelFr} ({q.totalBurnRate}%)
                    </option>
                  ))}
                </select>
              )}

              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setEditBudgetDraft(budget);
                    setIsEditingBudget(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Configurer Plafonds & Périodicité</span>
                </button>
              )}
            </div>
          </div>

          {/* Empty Factory Notice (Zero false alarms on EMPTY_FISCAL_BUDGET) */}
          {synthesis.totalAllocated === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-black text-amber-900">
                  Aucun plafond budgétaire alloué (Mode Usine Réelle — 0 {symbol})
                </div>
                <p className="text-[11px] text-amber-800">
                  Conformément à la règle Zero Silent Seed, aucune alerte fictive n'est déclenchée tant que le budget est à 0. Définissez vos allocations pour activer la surveillance mensuelle et annuelle.
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setEditBudgetDraft(budget);
                    setIsEditingBudget(true);
                  }}
                  className="shrink-0 rounded-xl bg-amber-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-800 transition cursor-pointer"
                >
                  Définir le Budget {synthesis.fiscalYear}
                </button>
              )}
            </div>
          )}

          {/* P2-3: Active Budget Alerts & Top Deviations Banner */}
          {synthesis.totalAllocated > 0 && synthesis.budgetAlerts.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs font-black text-rose-950 uppercase tracking-wider">
                    Alertes de Consommation Budgétaire & Top Écarts ({synthesis.fiscalYear})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  {deficitAlertsCount > 0 && (
                    <span className="rounded-md bg-rose-600 px-2.5 py-0.5 text-white">
                      {deficitAlertsCount} Dépassement(s) (DEFICIT)
                    </span>
                  )}
                  {warningAlertsCount > 0 && (
                    <span className="rounded-md bg-amber-500 px-2.5 py-0.5 text-slate-950">
                      {warningAlertsCount} Alerte(s) Burn (≥{synthesis.burnWarningPercent}%)
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {synthesis.budgetAlerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-xl border p-3 bg-white shadow-2xs ${
                      alert.status === 'DEFICIT' ? 'border-rose-300' : 'border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-black text-slate-900 truncate">{alert.labelFr}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-black font-mono ${
                          alert.status === 'DEFICIT'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {alert.burnRatePercent}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-bold text-slate-700">{alert.periodLabelFr}</span>
                      <span className="font-mono text-rose-600 font-bold">
                        Écart: {formatCurrency(alert.variance)}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 font-mono">
                      Réel: {formatCurrency(alert.actual)} / Plafond: {formatCurrency(alert.allocated)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4 Category Cards (Dynamically scoped to Annual, Selected Month, or Selected Quarter) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {displayedVariances.map((item) => (
              <div key={item.key} className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
                <div
                  className={`h-1 w-full ${
                    item.status === 'DEFICIT'
                      ? 'bg-rose-500'
                      : item.status === 'WARNING'
                      ? 'bg-amber-500'
                      : item.status === 'UNCONFIGURED'
                      ? 'bg-slate-300'
                      : 'bg-emerald-500'
                  }`}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">{item.labelFr}</h3>
                      <p className="text-[11px] text-slate-500">
                        {activePeriodSummary ? `${activePeriodSummary.labelFr} ${synthesis.fiscalYear}` : item.labelAr}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-black ${
                        item.status === 'FAVORABLE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'WARNING'
                          ? 'bg-amber-100 text-amber-800'
                          : item.status === 'UNCONFIGURED'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.allocated > 0 ? `${item.burnRatePercent}%` : 'Non alloué'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Coût validé :</span>
                      <span className="text-base font-black text-slate-900 font-mono">
                        {formatCurrency(item.actual)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs text-slate-500">
                      <span>Budget alloué :</span>
                      <span className="font-mono">{formatCurrency(item.allocated)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-slate-500">Écart budgétaire :</span>
                      <span
                        className={`font-mono font-bold ${
                          item.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {item.variance >= 0 ? '+' : ''}
                        {formatCurrency(item.variance)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.burnRatePercent > 100
                          ? 'bg-rose-500'
                          : item.burnRatePercent >= synthesis.burnWarningPercent
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, item.burnRatePercent)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Variance Breakdown Table with GmaoIndustrialDataGrid */}
          <div className="space-y-3">
            <GmaoIndustrialDataGrid
              title={`Tableau Récapitulatif Budgétaire — ${
                activePeriodSummary
                  ? `${activePeriodSummary.periodCode} (${activePeriodSummary.labelFr} ${synthesis.fiscalYear})`
                  : `Exercice Annuel ${synthesis.fiscalYear}`
              }`}
              icon={<Receipt className="w-4 h-4 text-emerald-600" />}
              excelMapping="poste (A) | budget (B) | reel (C) | ecart (D) | taux (E) | diagnostic (F)"
              bannerColor="emerald"
              columns={varianceColumns}
              data={displayedVariances}
              showRowNumber={true}
              headerRight={
                <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-mono font-bold text-slate-700">
                  Monnaie : {symbol} ({currencyCode})
                </span>
              }
            />

            {/* Total Période Summary Bar */}
            <div className="bg-slate-100/90 border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs font-mono font-bold">
              <div className="flex items-center gap-2 text-slate-900 uppercase font-black">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Total Période ({activePeriodSummary ? activePeriodSummary.labelFr : `Exercice ${synthesis.fiscalYear}`})</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div>Budget: <span className="text-slate-800 font-black">{formatCurrency(displayedTotalAllocated)}</span></div>
                <div>Coûts Réels: <span className="text-slate-900 font-black">{formatCurrency(displayedTotalActual)}</span></div>
                <div>Écart: <span className={`font-black ${displayedTotalVariance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{displayedTotalVariance >= 0 ? '+' : ''}{formatCurrency(displayedTotalVariance)}</span></div>
                <div>Taux: <span className="text-slate-800 font-black">{displayedTotalAllocated > 0 ? `${displayedTotalBurnRate}%` : '—'}</span></div>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${displayedTotalVariance >= 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                  {displayedTotalAllocated === 0 && displayedTotalActual === 0 ? 'Plafond 0 DH' : displayedTotalVariance >= 0 ? 'Solde Positif' : 'Dépassement Période'}
                </span>
              </div>
            </div>
          </div>

          {/* P2-2: Full 12-Month or 4-Quarter Matrix Overview */}
          <GmaoIndustrialDataGrid
            title={
              viewPeriodMode === 'QUARTERLY'
                ? `Matrice d'Exécution Trimestrielle (T1–T4 ${synthesis.fiscalYear})`
                : `Matrice d'Exécution Mensuelle (12 Mois — ${synthesis.fiscalYear})`
            }
            icon={<Calendar className="w-4 h-4 text-indigo-600" />}
            excelMapping="periode (A) | plafond (B) | prev (C) | corr (D) | ext (E) | pdr (F) | total (G) | burn (H) | statut (I)"
            bannerColor="indigo"
            columns={monthlyMatrixColumns}
            data={viewPeriodMode === 'QUARTERLY' ? synthesis.quarterlyBreakdown : synthesis.monthlyBreakdown}
            showRowNumber={true}
            headerRight={
              <span className="text-[11px] text-slate-500 font-medium">
                Périodes {synthesis.fiscalYear}
              </span>
            }
          />

          {/* P2-5: Lightweight Budget Audit Log (Last 5 Modifications) */}
          {Array.isArray(budget.budgetChangeLog) && budget.budgetChangeLog.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  Journal d'Audit des Allocations Budgétaires (5 dernières modifications)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Dernier auteur: <strong className="text-slate-800">{budget.updatedBy}</strong>
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {budget.budgetChangeLog.map((entry) => (
                  <div key={entry.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                        {entry.updatedBy}
                      </span>
                      <span className="text-slate-700 font-medium">{entry.summary}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(entry.timestamp).toLocaleString('fr-FR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
                  {[
                    { id: 'ALL', label: 'Toutes' },
                    { id: 'OPTIMAL', label: 'Rentable (<50%)' },
                    { id: 'ATTENTION', label: 'Surveillance (50-70%)' },
                    { id: 'REPLACE_RECOMMENDED', label: 'Remplacement (≥70%)' },
                    { id: 'NON_EVALUE', label: 'Non évalué' },
                  ].map((pill) => {
                    const isSelected = tcoStatusFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => {
                          setTcoStatusFilter(pill.id as any);
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
                    onChange={(e: any) => setSimCurrency(e.target.value)}
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Internal Labor by Tech */}
          <GmaoIndustrialDataGrid
            title={`Répartition Main d'Œuvre Interne (${synthesis.fiscalYear})`}
            icon={<Clock className="w-4 h-4 text-indigo-600" />}
            excelMapping="technicien (A) | interventions (B) | heures (C) | cout_mo (D)"
            bannerColor="indigo"
            columns={technicianLaborColumns}
            data={synthesis.technicianLaborBreakdown}
            showRowNumber={true}
            headerRight={
              <span className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-mono font-bold text-indigo-800 shadow-2xs">
                {synthesis.internalLaborHours}h au total · {formatCurrency(budget.technicianHourlyRate)}/h
              </span>
            }
            emptyMessage={`Aucune heure d'intervention enregistrée sur l'exercice ${synthesis.fiscalYear}.`}
          />

          {/* External Services & Bobinage Ledger */}
          <GmaoIndustrialDataGrid
            title="Sous-traitance & Bobinage Moteurs"
            icon={<Wrench className="w-4 h-4 text-amber-600" />}
            excelMapping="organe (A) | prestataire (B) | statut (C) | cout (D)"
            bannerColor="amber"
            columns={externalServicesColumns}
            data={sortiesExterne}
            showRowNumber={true}
            headerRight={
              <span className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-mono font-bold text-amber-900 shadow-2xs">
                {sortiesExterne.length} dossier(s)
              </span>
            }
            emptyMessage="Aucun dossier de sortie externe en cours."
          />
        </div>
      )}

      {/* 8. Tab 5: Downtime Financial Impact & Zone Cost Breakdown (P2-4 Period Zone Costs + Machine Links) */}
      {activeTab === 'downtime_roi' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="max-w-3xl">
              <h2 className="text-base font-black text-slate-900">
                Pertes d'Arrêt Confirmées & Coûts par Zone ({synthesis.fiscalYear})
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Seuls les Bons de Travail (BT) comportant une durée d'arrêt déclarée et validée sont comptabilisés au taux de{' '}
                <span className="font-bold text-slate-900 font-mono">
                  {formatCurrency(budget.productionDowntimeCostPerHour)}
                </span>{' '}
                par heure.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-bold text-slate-600">Heures d'Arrêt Validées</span>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {synthesis.totalDowntimeHours} h
                </div>
                <span className="text-[11px] text-slate-500">Sur les BT avec arrêt confirmé ({synthesis.fiscalYear})</span>
              </div>

              <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
                <span className="text-xs font-bold text-rose-800">Impact Financier des Arrêts</span>
                <div className="text-2xl font-black text-rose-700 font-mono mt-1">
                  {formatCurrency(synthesis.totalDowntimeLossMAD)}
                </div>
                <span className="text-[11px] text-rose-600">Pertes directes de disponibilité</span>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <span className="text-xs font-bold text-emerald-800">Coût Maintenance Direct ({synthesis.fiscalYear})</span>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                  {formatCurrency(synthesis.spendPreventive + synthesis.spendCorrective + synthesis.spendExternal)}
                </div>
                <span className="text-[11px] text-emerald-600">Préventif + Correctif + Sous-traitance</span>
              </div>
            </div>
          </div>

          {/* P2-4: Zone Cost Breakdown Table (Annual vs Current Selected Period) */}
          {/* Cost Breakdown by Zone with GmaoIndustrialDataGrid */}
          <GmaoIndustrialDataGrid
            title="Répartition des Coûts de Maintenance par Zone / Atelier"
            icon={<MapPin className="w-4 h-4 text-emerald-600" />}
            excelMapping="zone (A) | machines (B) | prev (C) | corr (D) | ext (E) | total (F)"
            bannerColor="emerald"
            columns={zoneBreakdownColumns}
            data={displayedZoneBreakdown}
            showRowNumber={true}
            headerRight={
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setZoneScopeMode('ANNUAL')}
                    className={`rounded-lg px-2.5 py-1 font-extrabold transition cursor-pointer ${
                      zoneScopeMode === 'ANNUAL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Exercice {synthesis.fiscalYear}
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoneScopeMode('CURRENT_PERIOD')}
                    className={`rounded-lg px-2.5 py-1 font-extrabold transition cursor-pointer ${
                      zoneScopeMode === 'CURRENT_PERIOD'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Mois (M{String(selectedMonthIdx).padStart(2, '0')})
                  </button>
                </div>
                {zoneScopeMode === 'CURRENT_PERIOD' && (
                  <select
                    value={selectedMonthIdx}
                    onChange={(e) => setSelectedMonthIdx(Number(e.target.value) || 1)}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900"
                  >
                    {synthesis.monthlyBreakdown.map((m) => (
                      <option key={m.periodCode} value={m.periodIndex}>
                        {m.periodCode} — {m.labelFr}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            }
            emptyMessage="Aucune zone active enregistrée."
          />

          {/* Pareto of Most Expensive Machines */}
          <GmaoIndustrialDataGrid
            title="Classement Pareto des Machines par Coût de Maintenance Cumulé"
            icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
            excelMapping="code (A) | designation (B) | cout_cumule (C) | valeurANeuf (D) | ber (E) | strategie (F)"
            bannerColor="rose"
            columns={paretoMachinesColumns}
            data={synthesis.machinesTCO.slice(0, 12)}
            showRowNumber={true}
            emptyMessage="Aucune machine évaluée."
          />
        </div>
      )}

      {/* 9. Tab 6: Currency Matrix & Historical Rates */}
      {activeTab === 'currency_matrix' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)]">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Matrice des Taux de Change & Paramètres de Valorisation
                </h2>
                <p className="text-xs text-slate-500">
                  Configuration des cours de devises (Bank Al-Maghrib) et des taux horaires de valorisation industrielle.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
                  <span className="text-xs font-bold text-slate-700">Devise de Référence Usine</span>
                  <div className="text-lg font-black text-slate-900">MAD - الدرهم المغربي</div>
                  <p className="text-[11px] text-slate-500">Symbole officiel d'affichage : {symbol}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
                  <span className="text-xs font-bold text-slate-700">Taux EUR / MAD Appliqué</span>
                  <div className="text-lg font-black text-slate-900 font-mono">
                    1 EUR = {exchangeRates.find((r) => r.sourceCurrency === 'EUR')?.rate || 10.85} MAD
                  </div>
                  <p className="text-[11px] text-slate-500">Mise à jour pour valorisation PDR import</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
                  <span className="text-xs font-bold text-slate-700">Taux USD / MAD Appliqué</span>
                  <div className="text-lg font-black text-slate-900 font-mono">
                    1 USD = {exchangeRates.find((r) => r.sourceCurrency === 'USD')?.rate || 9.95} MAD
                  </div>
                  <p className="text-[11px] text-slate-500">Mise à jour pour valorisation PDR import</p>
                </div>
              </div>

              {/* Historical Rates Ledger */}
              <div className="mt-4 space-y-2">
                <GmaoIndustrialDataGrid
                  title="Historique des Taux de Change Enregistrés"
                  icon={<Coins className="w-4 h-4 text-purple-600" />}
                  excelMapping="date (A) | paire (B) | taux (C) | note (D)"
                  bannerColor="purple"
                  columns={exchangeRatesColumns}
                  data={exchangeRates}
                  showRowNumber={true}
                  emptyMessage="Aucun taux de change enregistré."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. Edit Budget Allocations & Periodicity Modal (Strictly guarded by canManage) */}
      {isEditingBudget && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Configurer les Plafonds & le Suivi Budgétaire ({editBudgetDraft.fiscalYear})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Les allocations mensuelles (1/12) ou trimestrielles (1/4) sont calculées automatiquement à partir des plafonds annuels.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingBudget(false)}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mode de Pilotage Périodique (P2-1)
                </label>
                <select
                  value={editBudgetDraft.periodMode || 'ANNUAL'}
                  onChange={(e) =>
                    setEditBudgetDraft({
                      ...editBudgetDraft,
                      periodMode: e.target.value as BudgetPeriodMode,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:outline-hidden"
                >
                  <option value="ANNUAL">Annuel (Synthèse Exercice)</option>
                  <option value="MONTHLY">Mensuel (12 Mois — 1/12 du plafond)</option>
                  <option value="QUARTERLY">Trimestriel (4 Trimestres T1–T4)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seuil d'Alerte Consommation Burn (%) (P2-2)
                </label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={editBudgetDraft.burnWarningPercent ?? 90}
                  onChange={(e) =>
                    setEditBudgetDraft({
                      ...editBudgetDraft,
                      burnWarningPercent: Math.max(50, Math.min(100, Number(e.target.value) || 90)),
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Budget Maintenance Préventive ({symbol})
                </label>
                <input
                  type="number"
                  min="0"
                  value={editBudgetDraft.allocatedPreventive}
                  onChange={(e) =>
                    setEditBudgetDraft({
                      ...editBudgetDraft,
                      allocatedPreventive: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Budget Correctif & Pannes ({symbol})
                </label>
                <input
                  type="number"
                  min="0"
                  value={editBudgetDraft.allocatedCorrective}
                  onChange={(e) =>
                    setEditBudgetDraft({
                      ...editBudgetDraft,
                      allocatedCorrective: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Budget Sous-traitance & Bobinage ({symbol})
                </label>
                <input
                  type="number"
                  min="0"
                  value={editBudgetDraft.allocatedExternal}
                  onChange={(e) =>
                    setEditBudgetDraft({
                      ...editBudgetDraft,
                      allocatedExternal: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Budget Achats & Stock PDR ({symbol})
                </label>
                <input
                  type="number"
                  min="0"
                  value={editBudgetDraft.allocatedSparesStock}
                  onChange={(e) =>
                    setEditBudgetDraft({
                      ...editBudgetDraft,
                      allocatedSparesStock: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Taux Horaire Technicien ({symbol}/h)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editBudgetDraft.technicianHourlyRate}
                  onChange={(e) =>
                    setEditBudgetDraft({
                      ...editBudgetDraft,
                      technicianHourlyRate: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Coût Horaire Arrêt Usine ({symbol}/h)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editBudgetDraft.productionDowntimeCostPerHour}
                  onChange={(e) =>
                    setEditBudgetDraft({
                      ...editBudgetDraft,
                      productionDowntimeCostPerHour: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsEditingBudget(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  saveBudget({
                    ...editBudgetDraft,
                    updatedAt: new Date().toISOString(),
                  });
                  setIsEditingBudget(false);
                }}
                className="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer"
              >
                Enregistrer Allocations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulas Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Formules & Règles — Pilotage Coûts & Budgets
                  </h3>
                  <p className="text-xs text-slate-500">
                    TCO, VNC, taux BER de vétusté, valorisation PMP et calcul de burn rate budgétaire
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
              {financeFormulas.map((f) => (
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
