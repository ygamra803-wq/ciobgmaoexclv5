/**
 * @file FinanceView.tsx
 * @module presentation/pages/finance/FinanceView
 * @description
 * لوحة التحكم في تكاليف الصيانة والميزانية والأصول (Pilotage des Coûts & Budgets Maintenance) لـ GMAO.
 * تلتزم بمبدأ: Field Claim ≠ Coût Validé ≠ Écriture Comptable ERP.
 * تقرأ حصرياً من التدخلات والحركات المعتمدة دون أي قيم أصول افتراضية أو ميزانيات ديمو صامتة (FIN-P0).
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
  Search,
  ExternalLink,
} from 'lucide-react';
import { useCurrency } from '../../../utils/currencyService';
import { storageService } from '../../../utils/storageService';
import { DataGateway } from '../../../application/DataGateway';
import {
  FiscalBudgetConfig,
  HistoricalExchangeRate,
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

interface FinanceViewProps {
  machines?: any[];
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
  sortiesExterne?: any[];
  onNavigateToTab?: (tab: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function FinanceView({
  machines = [],
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveExecutions = [],
  sortiesExterne = [],
  onNavigateToTab,
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
  const [exchangeRates, setExchangeRates] = useState<HistoricalExchangeRate[]>(() => {
    const saved = storageService.getItem('gmao_historical_exchange_rates_v1');
    return Array.isArray(saved) && saved.length > 0 ? saved : INITIAL_EXCHANGE_RATES;
  });

  // Save budget changes via DataGateway with actor audit stamp
  const saveBudget = (updated: FiscalBudgetConfig) => {
    if (!canManage) return;
    const actor = user?.name || user?.nom || user?.username || user?.role || 'ADMIN';
    const saved = DataGateway.saveFinancialBudget(updated, actor);
    setBudget(saved);
    if (showToast) showToast('Allocations budgétaires enregistrées avec succès.', 'success');
  };

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<
    'budgets' | 'tco_assets' | 'inventory_procurement' | 'labor_subcontracting' | 'downtime_roi' | 'currency_matrix'
  >('budgets');

  // Search and filter states
  const [tcoSearch, setTcoSearch] = useState('');
  const [tcoStatusFilter, setTcoStatusFilter] = useState<'ALL' | MachineBerStatus>('ALL');
  const [stockSearch, setStockSearch] = useState('');

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
  }, [budget, exchangeRates, machines, stockItems, mouvements, correctiveInterventions, preventiveExecutions, sortiesExterne]);

  // Filtered Machines TCO
  const filteredTcoMachines = useMemo(() => {
    return synthesis.machinesTCO.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(tcoSearch.toLowerCase()) ||
        m.code.toLowerCase().includes(tcoSearch.toLowerCase()) ||
        m.zone.toLowerCase().includes(tcoSearch.toLowerCase());
      const matchStatus = tcoStatusFilter === 'ALL' || m.berStatus === tcoStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [synthesis.machinesTCO, tcoSearch, tcoStatusFilter]);

  // Filtered Stock Items for PMP
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

    return list
      .filter((i) => i.name.toLowerCase().includes(stockSearch.toLowerCase()) || i.ref.toLowerCase().includes(stockSearch.toLowerCase()))
      .sort((a, b) => b.totalHT - a.totalHT);
  }, [stockItems, stockSearch]);

  // Handle Export Excel
  const handleExportExcel = () => {
    try {
      FinancialExportService.exportFinancialSynthesisToExcel(synthesis, symbol);
      if (showToast) showToast('Rapport de pilotage des coûts exporté au format Excel (.xlsx)', 'success');
    } catch (e: any) {
      if (showToast) showToast(`Erreur d'exportation: ${e.message}`, 'error');
    }
  };

  return (
    <div className="w-full space-y-6 pb-16">
      {/* 1. Header & Executive Strip */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-900">
                  Pilotage des Coûts & Budgets Maintenance
                </h1>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                  ISO 4217 / {currencyCode}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                  Exercice {synthesis.fiscalYear}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Contrôle budgétaire, coûts opérationnels validés (Maker-Checker), valorisation PMP et TCO réel par machine.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Fiscal Year Selector */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="font-bold text-slate-600 mr-1.5">Exercice:</span>
              <select
                value={budget.fiscalYear}
                onChange={(e) => {
                  const nextYr = Number(e.target.value) || new Date().getFullYear();
                  setBudget((prev) => ({ ...prev, fiscalYear: nextYr }));
                }}
                aria-label="Exercice fiscal"
                className="bg-transparent font-mono font-black text-slate-900 focus:outline-hidden cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Currency Selector */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
              <span className="px-2 font-bold text-slate-600 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-slate-500" />
                Devise:
              </span>
              <button
                type="button"
                onClick={() => setCurrency('MAD')}
                className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                  currencyCode === 'MAD' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                MAD (DH)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('EUR')}
                className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                  currencyCode === 'EUR' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EUR (€)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                  currencyCode === 'USD' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                USD ($)
              </button>
            </div>

            {/* Excel Export Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Exporter Synthèse (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* 2. Top Metric KPI Strip (5 High-Density Cards) */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Budget Global */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold">Dépenses Validées ({synthesis.fiscalYear})</span>
              <span
                className={`text-[11px] font-black ${
                  synthesis.totalAllocated === 0
                    ? 'text-slate-500'
                    : synthesis.totalVariance >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-600'
                }`}
              >
                {synthesis.totalAllocated > 0 ? `${synthesis.totalBurnRate}%` : 'Non alloué'}
              </span>
            </div>
            <div className="mt-1 text-lg font-black text-slate-900 font-mono">
              {formatCurrency(synthesis.totalActual)}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>Budget alloué: {formatCurrency(synthesis.totalAllocated)}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  synthesis.totalBurnRate > 100
                    ? 'bg-rose-500'
                    : synthesis.totalBurnRate > 85
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, synthesis.totalBurnRate)}%` }}
              />
            </div>
          </div>

          {/* Card 2: Pertes d'Arrêt Production */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-4">
            <div className="flex items-center justify-between text-xs text-rose-800">
              <span className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Pertes d'Arrêt Confirmées
              </span>
              <span className="text-[11px] font-black font-mono">{synthesis.totalDowntimeHours}h arrêt</span>
            </div>
            <div className="mt-1 text-lg font-black text-rose-700 font-mono">
              {formatCurrency(synthesis.totalDowntimeLossMAD)}
            </div>
            <div className="mt-1.5 text-[11px] text-rose-600">
              Taux: {formatCurrency(synthesis.budget.productionDowntimeCostPerHour)} / heure
            </div>
          </div>

          {/* Card 3: Valorisation Stock PDR (PMP) */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
            <div className="flex items-center justify-between text-xs text-blue-800">
              <span className="font-bold">Valorisation Stock (PMP)</span>
              <span className="text-[11px] font-mono">{synthesis.stockItemsCount} art.</span>
            </div>
            <div className="mt-1 text-lg font-black text-blue-900 font-mono">
              {formatCurrency(synthesis.stockValuationPMP_MAD)}
            </div>
            <div className="mt-1.5 text-[11px] text-blue-700">
              TTC (TVA {synthesis.budget.defaultVatRate}%): {formatCurrency(synthesis.stockValuationWithVAT_MAD)}
            </div>
          </div>

          {/* Card 4: Main d'Œuvre Interne */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold">Main d'Œuvre Interne</span>
              <span className="text-[11px] font-mono">{synthesis.internalLaborHours}h</span>
            </div>
            <div className="mt-1 text-lg font-black text-slate-900 font-mono">
              {formatCurrency(synthesis.internalLaborCostMAD)}
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">
              Taux tech: {formatCurrency(synthesis.budget.technicianHourlyRate)} / h
            </div>
          </div>

          {/* Card 5: Actifs en Alerte BER (≥70%) */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between text-xs text-amber-800">
              <span className="font-bold flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                Alerte BER (≥{synthesis.budget.berThresholdPercent}%)
              </span>
              <span className="text-[11px] font-black">{synthesis.machinesBerCount} machine(s)</span>
            </div>
            <div className="mt-1 text-lg font-black text-amber-900 font-mono">
              {synthesis.machinesBerCount > 0 ? 'Remplacement conseillé' : '0 dépassement BER'}
            </div>
            <div className="mt-1.5 text-[11px] text-amber-700">
              {synthesis.machinesValuedCount} évaluée(s) · {synthesis.machinesUnvaluedCount} non évaluée(s)
            </div>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('budgets')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'budgets'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Budgets & Variances</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tco_assets')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'tco_assets'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>TCO & Coûts par Machine</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory_procurement')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'inventory_procurement'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Valorisation PDR & Multi-Devises</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('labor_subcontracting')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'labor_subcontracting'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Main d'Œuvre & Sous-traitance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('downtime_roi')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'downtime_roi'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Pertes d'Arrêt & Coûts par Zone</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('currency_matrix')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'currency_matrix'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Taux de Change & Paramètres</span>
        </button>
      </div>

      {/* 4. Tab 1: Maintenance Budgeting & Forecasting */}
      {activeTab === 'budgets' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Suivi Budgétaire & Analyse des Écarts (Exercice {synthesis.fiscalYear})
              </h2>
              <p className="text-xs text-slate-500">
                Comparaison entre les plafonds budgétaires alloués et les coûts réels validés (Maker-Checker) sur l'exercice {synthesis.fiscalYear}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {budget.updatedBy && budget.updatedBy !== 'FACTORY_RESET' && (
                <span className="text-[11px] text-slate-500 font-mono">
                  Mis à jour par: <strong className="text-slate-700">{budget.updatedBy}</strong>
                </span>
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
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>Configurer Plafonds Budgétaires</span>
                </button>
              )}
            </div>
          </div>

          {synthesis.totalAllocated === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-black text-amber-900">
                  Aucun plafond budgétaire alloué (Mode Usine Réelle — 0 {symbol})
                </div>
                <p className="text-[11px] text-amber-800">
                  Conformément à la règle Zero Silent Seed, aucun budget fictif n'est injecté par défaut. Définissez vos allocations annuelles pour suivre les taux de consommation.
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {synthesis.variances.map((item) => (
              <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">{item.labelFr}</h3>
                    <p className="text-[11px] text-slate-500">{item.labelAr}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
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
                        : item.burnRatePercent > 85
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, item.burnRatePercent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Variance Breakdown Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Tableau Récapitulatif Budgétaire & Statut de Clôture ({synthesis.fiscalYear})
              </span>
              <span className="text-xs text-slate-500">Monnaie : {symbol} ({currencyCode})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100/60 font-bold text-slate-700">
                  <tr>
                    <th className="px-5 py-3">Poste Budgétaire</th>
                    <th className="px-5 py-3 text-right">Budget Alloué</th>
                    <th className="px-5 py-3 text-right">Coûts Validés</th>
                    <th className="px-5 py-3 text-right">Écart Budgétaire</th>
                    <th className="px-5 py-3 text-right">Taux (%)</th>
                    <th className="px-5 py-3 text-center">Diagnostic Budgétaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {synthesis.variances.map((v) => (
                    <tr key={v.key} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{v.labelFr}</div>
                        <div className="text-[11px] text-slate-500">{v.labelAr}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-700">
                        {formatCurrency(v.allocated)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(v.actual)}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right font-mono font-bold ${
                          v.variance >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {v.variance >= 0 ? '+' : ''}
                        {formatCurrency(v.variance)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">
                        {v.allocated > 0 ? `${v.burnRatePercent}%` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
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
                            ? 'Sous Contrôle (>85%)'
                            : v.status === 'UNCONFIGURED'
                            ? 'Plafond non défini'
                            : 'Déficit / Dépassement'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/80 font-black text-slate-900 border-t border-slate-300">
                    <td className="px-5 py-4 uppercase">Total Général Usine</td>
                    <td className="px-5 py-4 text-right font-mono">{formatCurrency(synthesis.totalAllocated)}</td>
                    <td className="px-5 py-4 text-right font-mono">{formatCurrency(synthesis.totalActual)}</td>
                    <td
                      className={`px-5 py-4 text-right font-mono ${
                        synthesis.totalVariance >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {synthesis.totalVariance >= 0 ? '+' : ''}
                      {formatCurrency(synthesis.totalVariance)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono">
                      {synthesis.totalAllocated > 0 ? `${synthesis.totalBurnRate}%` : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-[11px] font-bold text-slate-700">
                        {synthesis.totalAllocated === 0 && synthesis.totalActual === 0
                          ? 'Plafond 0 DH'
                          : synthesis.totalVariance >= 0
                          ? 'Solde Positif'
                          : 'Dépassement Global'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab 2: Asset TCO & Depreciation (Zero Synthetic Valuation + Per-Machine Preventive Cost) */}
      {activeTab === 'tco_assets' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">
                TCO & Coûts Réels par Machine (Sans Hypothèses Synthétiques)
              </h2>
              <p className="text-xs text-slate-500">
                Le coût préventif et correctif suit strictement chaque machine (`machineCode`). Les machines sans `valeur_a_neuf` sont affichées « Non évalué ».
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher machine..."
                  value={tcoSearch}
                  onChange={(e) => setTcoSearch(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <select
                value={tcoStatusFilter}
                onChange={(e: any) => setTcoStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs focus:border-emerald-500 focus:outline-hidden"
              >
                <option value="ALL">Tous les statuts BER</option>
                <option value="OPTIMAL">Rentable (&lt;50%)</option>
                <option value="ATTENTION">Sous surveillance (50-70%)</option>
                <option value="REPLACE_RECOMMENDED">Remplacement Conseillé (≥70%)</option>
                <option value="NON_EVALUE">Valeur à neuf non renseignée</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100/60 font-bold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Machine & Zone</th>
                    <th className="px-4 py-3 text-right">Valeur à Neuf</th>
                    <th className="px-4 py-3 text-center">Mise en Service</th>
                    <th className="px-4 py-3 text-right">VNC Actuelle</th>
                    <th className="px-4 py-3 text-right">Coût Préventif</th>
                    <th className="px-4 py-3 text-right">Coût Correctif & Ext.</th>
                    <th className="px-4 py-3 text-right">Coût Maint. Cumulé</th>
                    <th className="px-4 py-3 text-right">Indice BER</th>
                    <th className="px-4 py-3 text-center">Décision / Fiche</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTcoMachines.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        Aucun équipement actif ne correspond aux filtres appliqués.
                      </td>
                    </tr>
                  ) : (
                    filteredTcoMachines.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 font-mono">{m.code}</div>
                          <div className="text-[11px] text-slate-600">{m.name}</div>
                          <div className="text-[10px] text-slate-400">{m.zone}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                          {m.valeurANeuf !== null ? (
                            formatCurrency(m.valeurANeuf)
                          ) : (
                            <span className="text-[11px] italic text-slate-400">Non évalué</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {m.anneeMiseEnService !== null ? (
                            <>
                              <div>{m.anneeMiseEnService}</div>
                              <div className="text-[10px] text-slate-500">{m.ageYears} an(s)</div>
                            </>
                          ) : (
                            <span className="text-[11px] italic text-slate-400">Non renseigné</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {m.valeurNetteComptable !== null ? (
                            formatCurrency(m.valeurNetteComptable)
                          ) : (
                            <span className="text-[11px] italic text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-indigo-700 font-bold">
                          {formatCurrency(m.preventiveCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-amber-800 font-bold">
                          {formatCurrency(m.correctiveCost + m.externalCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                          {formatCurrency(m.coutMaintenanceCumule)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black">
                          {m.berIndexPercent !== null ? (
                            <span
                              className={
                                m.berIndexPercent >= synthesis.budget.berThresholdPercent
                                  ? 'text-rose-600'
                                  : m.berIndexPercent >= synthesis.budget.berThresholdPercent * 0.7
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }
                            >
                              {m.berIndexPercent}%
                            </span>
                          ) : (
                            <span className="text-[11px] font-normal italic text-slate-400">Non évalué</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
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
                                ? 'Remplacement Conseillé (BER)'
                                : m.berStatus === 'ATTENTION'
                                ? 'Sous Surveillance'
                                : m.berStatus === 'NON_EVALUE'
                                ? 'À évaluer'
                                : 'Rentable'}
                            </span>
                            {onNavigateToTab && (
                              <button
                                type="button"
                                onClick={() => onNavigateToTab('machines')}
                                title={`Ouvrir la fiche machine ${m.code}`}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab 3: Spare Parts Inventory & Procurement (Multi-Currency) */}
      {activeTab === 'inventory_procurement' && (
        <div className="space-y-6">
          {/* Multi-Currency PO Calculator / Converter */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-emerald-600" />
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

          {/* Top Valued Stock Table (PMP) */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Valorisation du Stock PDR au Prix Moyen Pondéré (PMP)
                </h3>
                <p className="text-xs text-slate-500">
                  Articles valorisés selon le cours d'achat réel unitaire enregistré en magasin.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher article ou réf..."
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-100/60 font-bold text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Référence</th>
                      <th className="px-4 py-3">Désignation</th>
                      <th className="px-4 py-3">Famille / Type</th>
                      <th className="px-4 py-3 text-right">Stock Actuel</th>
                      <th className="px-4 py-3 text-right">PMP Unitaire ({symbol})</th>
                      <th className="px-4 py-3 text-right">Valeur Stock HT ({symbol})</th>
                      <th className="px-4 py-3 text-right">Valeur Stock TTC ({symbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topValuedStock.slice(0, 15).map((item, idx) => (
                      <tr key={`${item.ref}-${idx}`} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{item.ref}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">{item.name}</td>
                        <td className="px-4 py-2.5 text-slate-500">{item.type}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.stockActuel} {item.unit}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                          {formatCurrency(item.pmp)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(item.totalHT)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-black text-emerald-800">
                          {formatCurrency(item.totalHT * (1 + budget.defaultVatRate / 100))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Tab 4: Labor & Subcontracting Ledger */}
      {activeTab === 'labor_subcontracting' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Internal Labor by Tech */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Répartition Main d'Œuvre Interne ({synthesis.fiscalYear})
                </h3>
                <p className="text-xs text-slate-500">
                  Heures réelles validées × Taux horaire ({formatCurrency(budget.technicianHourlyRate)}/h).
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-700">
                {synthesis.internalLaborHours}h au total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Technicien</th>
                    <th className="px-3 py-2 text-center">Interventions</th>
                    <th className="px-3 py-2 text-right">Heures</th>
                    <th className="px-3 py-2 text-right">Coût Main d'Œuvre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {synthesis.technicianLaborBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                        Aucune heure d'intervention enregistrée sur l'exercice {synthesis.fiscalYear}.
                      </td>
                    </tr>
                  ) : (
                    synthesis.technicianLaborBreakdown.map((t) => (
                      <tr key={t.name} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-bold text-slate-900">{t.name}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-slate-600">
                          {t.interventionsCount}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-800">
                          {t.hours} h
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-800">
                          {formatCurrency(t.costMAD)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* External Services & Bobinage Ledger */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Sous-traitance & Bobinage Moteurs
                </h3>
                <p className="text-xs text-slate-500">
                  Suivi des travaux extérieurs et prestataires spécialisés (`sortiesExterne`).
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-700">
                {sortiesExterne.length} dossier(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Organe / Moteur</th>
                    <th className="px-3 py-2">Prestataire</th>
                    <th className="px-3 py-2 text-center">Statut</th>
                    <th className="px-3 py-2 text-right">Coût Engagé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortiesExterne.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                        Aucun dossier de sortie externe en cours.
                      </td>
                    </tr>
                  ) : (
                    sortiesExterne.slice(0, 10).map((se: any, idx: number) => {
                      const cost = Number(
                        se.cout_reel ?? se.cout_bobinage ?? se.prix_reparation ?? se.cout_estime ?? se.cout ?? 0
                      );
                      const organeLabel =
                        se.designation_moteur || se.designation || se.nom || se.code_moteur_reel || 'Moteur';
                      const machineLabel = se.id_machine || se.machine_cible || se.code_machine || 'Machine';
                      const supplierLabel =
                        se.fournisseur_externe || se.fournisseur || se.prestataire || se.atelier || 'Atelier Externe';
                      const statusLabel = se.etat || se.statut || 'En cours';
                      return (
                        <tr key={se.id || idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-slate-900">{organeLabel}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{machineLabel}</div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 font-medium">{supplierLabel}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(cost)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. Tab 5: Downtime Financial Impact & Zone Cost Breakdown */}
      {activeTab === 'downtime_roi' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
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

          {/* Zone Cost Breakdown Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-black text-slate-900">
              Répartition des Coûts de Maintenance par Zone / Atelier ({synthesis.fiscalYear})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100/60 font-bold text-slate-700">
                  <tr>
                    <th className="px-4 py-2.5">Zone / Atelier</th>
                    <th className="px-4 py-2.5 text-center">Machines Actives</th>
                    <th className="px-4 py-2.5 text-right">Coût Préventif</th>
                    <th className="px-4 py-2.5 text-right">Coût Correctif</th>
                    <th className="px-4 py-2.5 text-right">Sous-traitance</th>
                    <th className="px-4 py-2.5 text-right">Total Zone ({symbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {synthesis.zoneCostBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                        Aucune zone active enregistrée.
                      </td>
                    </tr>
                  ) : (
                    synthesis.zoneCostBreakdown.map((z) => (
                      <tr key={z.zone} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-2.5 font-bold text-slate-900">{z.zone}</td>
                        <td className="px-4 py-2.5 text-center font-mono text-slate-600">{z.machinesCount}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-indigo-700">
                          {formatCurrency(z.preventiveCost)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-800">
                          {formatCurrency(z.correctiveCost)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                          {formatCurrency(z.externalCost)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-black text-slate-900">
                          {formatCurrency(z.totalCost)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pareto of Most Expensive Machines */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-black text-slate-900">
              Classement des Machines par Coût de Maintenance Cumulé
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100/60 font-bold text-slate-700">
                  <tr>
                    <th className="px-4 py-2.5">Code Machine</th>
                    <th className="px-4 py-2.5">Désignation</th>
                    <th className="px-4 py-2.5 text-right">Coût Maint. Cumulé</th>
                    <th className="px-4 py-2.5 text-right">Valeur à Neuf</th>
                    <th className="px-4 py-2.5 text-right">Indice BER</th>
                    <th className="px-4 py-2.5 text-center">Recommandation Stratégique</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {synthesis.machinesTCO.slice(0, 8).map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{m.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(m.coutMaintenanceCumule)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {m.valeurANeuf !== null ? formatCurrency(m.valeurANeuf) : 'Non évalué'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                        {m.berIndexPercent !== null ? `${m.berIndexPercent}%` : 'Non évalué'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 9. Tab 6: Currency Matrix & Historical Rates */}
      {activeTab === 'currency_matrix' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
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
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Historique des Taux de Change Enregistrés
              </h3>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Paire de Devises</th>
                      <th className="px-4 py-2.5 text-right">Taux de Conversion</th>
                      <th className="px-4 py-2.5">Source / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exchangeRates.map((rate) => (
                      <tr key={rate.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-slate-600">{rate.date}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          {rate.sourceCurrency} → {rate.targetCurrency}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {rate.rate}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{rate.note || 'Taux standard'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. Edit Budget Allocations Modal (Strictly guarded by canManage) */}
      {isEditingBudget && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900">
                Configurer les Plafonds Budgétaires ({editBudgetDraft.fiscalYear})
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingBudget(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsEditingBudget(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
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
    </div>
  );
}
