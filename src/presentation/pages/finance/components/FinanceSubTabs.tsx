import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  ExternalLink,
  FileText,
  History,
  MapPin,
  Receipt,
  ShieldAlert,
  Sliders,
  User,
  Wallet,
  Wrench,
} from 'lucide-react';
import GmaoIndustrialDataGrid, { type GmaoColumn } from '../../../components/common/GmaoIndustrialDataGrid';
import type {
  BudgetPeriodMode,
  FiscalBudgetConfig,
  HistoricalExchangeRate,
} from '../../../../domain/finance/entities/FinancialBudget';
import type {
  BudgetVarianceItem,
  FinancialSynthesis,
  MachineTCOCalculation,
  PeriodFinancialSummary,
  ZoneCostSummary,
} from '../../../../application/services/FinancialCalculationService';

export interface FinanceExternalServiceRow {
  id?: string;
  designation_moteur?: string;
  designation?: string;
  nom?: string;
  code_moteur_reel?: string;
  id_machine?: string;
  machine_cible?: string;
  code_machine?: string;
  fournisseur_externe?: string;
  fournisseur?: string;
  prestataire?: string;
  atelier?: string;
  etat?: string;
  statut?: string;
  cout_reel?: number | string;
  cout_bobinage?: number | string;
  prix_reparation?: number | string;
  cout_estime?: number | string;
  cout?: number | string;
  [key: string]: unknown;
}

export interface FinanceTechnicianLaborRow {
  name: string;
  hours: number;
  costMAD: number;
  interventionsCount: number;
}

export interface FinanceValuedStockRow {
  ref: string;
  name: string;
  type: string;
  stockActuel: number;
  unit: string;
  pmp: number;
  totalHT: number;
}

export interface FinanceBudgetsSubTabProps {
  synthesis: FinancialSynthesis;
  budget: FiscalBudgetConfig;
  viewPeriodMode: BudgetPeriodMode;
  setViewPeriodMode: (mode: BudgetPeriodMode) => void;
  selectedMonthIdx: number;
  setSelectedMonthIdx: (idx: number) => void;
  selectedQuarterIdx: number;
  setSelectedQuarterIdx: (idx: number) => void;
  canManage: boolean;
  onOpenEditBudget: () => void;
  symbol: string;
  currencyCode: string;
  formatCurrency: (val: number) => string;
  deficitAlertsCount: number;
  warningAlertsCount: number;
  displayedVariances: BudgetVarianceItem[];
  activePeriodSummary: PeriodFinancialSummary | null;
  displayedTotalAllocated: number;
  displayedTotalActual: number;
  displayedTotalVariance: number;
  displayedTotalBurnRate: number;
  varianceColumns: GmaoColumn<BudgetVarianceItem>[];
  monthlyMatrixColumns: GmaoColumn<PeriodFinancialSummary>[];
}

export function FinanceBudgetsSubTab({
  synthesis,
  budget,
  viewPeriodMode,
  setViewPeriodMode,
  selectedMonthIdx,
  setSelectedMonthIdx,
  selectedQuarterIdx,
  setSelectedQuarterIdx,
  canManage,
  onOpenEditBudget,
  symbol,
  currencyCode,
  formatCurrency,
  deficitAlertsCount,
  warningAlertsCount,
  displayedVariances,
  activePeriodSummary,
  displayedTotalAllocated,
  displayedTotalActual,
  displayedTotalVariance,
  displayedTotalBurnRate,
  varianceColumns,
  monthlyMatrixColumns,
}: FinanceBudgetsSubTabProps): ReactNode {
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
            Suivi Budgétaire &amp; Contrôle Périodique (Exercice {synthesis.fiscalYear})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivi annuel, mensuel (12 mois) ou trimestriel (T1–T4). Seuil d&apos;alerte burn configuré à{' '}
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
              onClick={onOpenEditBudget}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>Configurer Plafonds &amp; Périodicité</span>
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
              Conformément à la règle Zero Silent Seed, aucune alerte fictive n&apos;est déclenchée tant que le budget est à 0. Définissez vos allocations pour activer la surveillance mensuelle et annuelle.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={onOpenEditBudget}
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
                Alertes de Consommation Budgétaire &amp; Top Écarts ({synthesis.fiscalYear})
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
              Journal d&apos;Audit des Allocations Budgétaires (5 dernières modifications)
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
  );
}

export interface FinanceLaborSubcontractingSubTabProps {
  synthesis: FinancialSynthesis;
  budget: FiscalBudgetConfig;
  sortiesExterne: FinanceExternalServiceRow[];
  formatCurrency: (val: number) => string;
  symbol: string;
  onOpenMachineCard: (machineCode: string) => void;
}

export function FinanceLaborSubcontractingSubTab({
  synthesis,
  budget,
  sortiesExterne,
  formatCurrency,
  symbol,
  onOpenMachineCard,
}: FinanceLaborSubcontractingSubTabProps): ReactNode {
  const technicianLaborColumns: GmaoColumn<FinanceTechnicianLaborRow>[] = [
    {
      key: 'name',
      label: 'Technicien Référent',
      colLetter: 'A',
      icon: User,
      render: (t: FinanceTechnicianLaborRow) => (
        <span className="font-bold text-slate-900">{t.name}</span>
      ),
    },
    {
      key: 'interventionsCount',
      label: 'Interventions',
      colLetter: 'B',
      icon: Wrench,
      align: 'center',
      render: (t: FinanceTechnicianLaborRow) => (
        <span className="font-mono text-slate-600">{t.interventionsCount}</span>
      ),
    },
    {
      key: 'hours',
      label: 'Heures Validées',
      colLetter: 'C',
      icon: Clock,
      align: 'right',
      render: (t: FinanceTechnicianLaborRow) => (
        <span className="font-mono font-medium text-slate-800">{t.hours} h</span>
      ),
    },
    {
      key: 'costMAD',
      label: `Coût Main d'Œuvre (${symbol})`,
      colLetter: 'D',
      icon: Receipt,
      align: 'right',
      render: (t: FinanceTechnicianLaborRow) => (
        <span className="font-mono font-bold text-emerald-800">
          {formatCurrency(t.costMAD)}
        </span>
      ),
    },
  ];

  const externalServicesColumns: GmaoColumn<FinanceExternalServiceRow>[] = [
    {
      key: 'organe',
      label: 'Organe / Machine',
      colLetter: 'A',
      icon: Cpu,
      render: (se: FinanceExternalServiceRow) => {
        const organeLabel =
          se.designation_moteur || se.designation || se.nom || se.code_moteur_reel || 'Moteur / Organe';
        const machineLabel = String(se.id_machine || se.machine_cible || se.code_machine || 'Machine');
        return (
          <div>
            <div className="font-bold text-slate-900">{String(organeLabel)}</div>
            <button
              type="button"
              onClick={() => onOpenMachineCard(machineLabel)}
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
      render: (se: FinanceExternalServiceRow) => (
        <span className="text-slate-700 font-medium">
          {String(se.fournisseur_externe || se.fournisseur || se.prestataire || se.atelier || 'Atelier Externe')}
        </span>
      ),
    },
    {
      key: 'statut',
      label: 'Statut du Dossier',
      colLetter: 'C',
      icon: CheckCircle2,
      align: 'center',
      render: (se: FinanceExternalServiceRow) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          {String(se.etat || se.statut || 'En cours')}
        </span>
      ),
    },
    {
      key: 'cout',
      label: `Coût Engagé (${symbol})`,
      colLetter: 'D',
      icon: Coins,
      align: 'right',
      render: (se: FinanceExternalServiceRow) => {
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
  ];

  return (
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
  );
}

export interface FinanceDowntimeRoiSubTabProps {
  synthesis: FinancialSynthesis;
  budget: FiscalBudgetConfig;
  displayedZoneBreakdown: ZoneCostSummary[];
  zoneScopeMode: 'ANNUAL' | 'CURRENT_PERIOD';
  setZoneScopeMode: (mode: 'ANNUAL' | 'CURRENT_PERIOD') => void;
  selectedMonthIdx: number;
  setSelectedMonthIdx: (idx: number) => void;
  formatCurrency: (val: number) => string;
  symbol: string;
  onOpenMachineCard: (machineCode: string) => void;
}

export function FinanceDowntimeRoiSubTab({
  synthesis,
  budget,
  displayedZoneBreakdown,
  zoneScopeMode,
  setZoneScopeMode,
  selectedMonthIdx,
  setSelectedMonthIdx,
  formatCurrency,
  symbol,
  onOpenMachineCard,
}: FinanceDowntimeRoiSubTabProps): ReactNode {
  const zoneBreakdownColumns: GmaoColumn<ZoneCostSummary>[] = [
    {
      key: 'zone',
      label: 'Zone / Atelier',
      colLetter: 'A',
      icon: MapPin,
      render: (z: ZoneCostSummary) => (
        <span className="font-bold text-slate-900">{z.zone}</span>
      ),
    },
    {
      key: 'machinesCount',
      label: 'Machines Actives',
      colLetter: 'B',
      icon: Cpu,
      align: 'center',
      render: (z: ZoneCostSummary) => (
        <span className="font-mono text-slate-600">{z.machinesCount}</span>
      ),
    },
    {
      key: 'preventiveCost',
      label: 'Coût Préventif',
      colLetter: 'C',
      icon: Clock,
      align: 'right',
      render: (z: ZoneCostSummary) => (
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
      align: 'right',
      render: (z: ZoneCostSummary) => (
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
      align: 'right',
      render: (z: ZoneCostSummary) => (
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
      align: 'right',
      render: (z: ZoneCostSummary) => (
        <span className="font-mono font-black text-slate-900">
          {formatCurrency(z.totalCost)}
        </span>
      ),
    },
  ];

  const paretoMachinesColumns: GmaoColumn<MachineTCOCalculation>[] = [
    {
      key: 'code',
      label: 'Code Machine',
      colLetter: 'A',
      icon: Cpu,
      render: (m: MachineTCOCalculation) => (
        <button
          type="button"
          onClick={() => onOpenMachineCard(m.code)}
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
      render: (m: MachineTCOCalculation) => (
        <span className="font-medium text-slate-800">{m.name}</span>
      ),
    },
    {
      key: 'coutMaintenanceCumule',
      label: 'Coût Maint. Cumulé',
      colLetter: 'C',
      icon: Receipt,
      align: 'right',
      render: (m: MachineTCOCalculation) => (
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
      align: 'right',
      render: (m: MachineTCOCalculation) => (
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
      align: 'right',
      render: (m: MachineTCOCalculation) => (
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
      align: 'center',
      render: (m: MachineTCOCalculation) => (
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
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="max-w-3xl">
          <h2 className="text-base font-black text-slate-900">
            Pertes d&apos;Arrêt Confirmées &amp; Coûts par Zone ({synthesis.fiscalYear})
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Seuls les Bons de Travail (BT) comportant une durée d&apos;arrêt déclarée et validée sont comptabilisés au taux de{' '}
            <span className="font-bold text-slate-900 font-mono">
              {formatCurrency(budget.productionDowntimeCostPerHour)}
            </span>{' '}
            par heure.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-xs font-bold text-slate-600">Heures d&apos;Arrêt Validées</span>
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
  );
}

export interface FinanceCurrencyMatrixSubTabProps {
  exchangeRates: HistoricalExchangeRate[];
  symbol: string;
}

export function FinanceCurrencyMatrixSubTab({
  exchangeRates,
  symbol,
}: FinanceCurrencyMatrixSubTabProps): ReactNode {
  const exchangeRatesColumns: GmaoColumn<HistoricalExchangeRate>[] = [
    {
      key: 'date',
      label: "Date d'Enregistrement",
      colLetter: 'A',
      icon: Calendar,
      render: (rate: HistoricalExchangeRate) => (
        <span className="font-mono text-slate-600">{rate.date}</span>
      ),
    },
    {
      key: 'paire',
      label: 'Paire de Devises',
      colLetter: 'B',
      icon: Coins,
      render: (rate: HistoricalExchangeRate) => (
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
      align: 'right',
      render: (rate: HistoricalExchangeRate) => (
        <span className="font-mono font-bold text-slate-900">{rate.rate}</span>
      ),
    },
    {
      key: 'note',
      label: 'Source / Note',
      colLetter: 'D',
      icon: FileText,
      render: (rate: HistoricalExchangeRate) => (
        <span className="text-slate-600">{rate.note || 'Taux standard'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)]">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Matrice des Taux de Change &amp; Paramètres de Valorisation
            </h2>
            <p className="text-xs text-slate-500">
              Configuration des cours de devises (Bank Al-Maghrib) et des taux horaires de valorisation industrielle.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <span className="text-xs font-bold text-slate-700">Devise de Référence Usine</span>
              <div className="text-lg font-black text-slate-900">MAD - الدرهم المغربي</div>
              <p className="text-[11px] text-slate-500">Symbole officiel d&apos;affichage : {symbol}</p>
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
  );
}
