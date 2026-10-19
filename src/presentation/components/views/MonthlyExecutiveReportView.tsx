import React, { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Package,
  Wrench,
  Clock,
  DollarSign,
  Factory,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import {
  MonthlyReportCalculationService,
  type MonthOverMonthComparison,
  type MonthOverMonthDelta,
} from '../../../application/services/MonthlyReportCalculationService';
import { MonthlyReportExportService } from '../../../services/monthlyReportExportService';
import type { PreventiveExecutionRecord } from '../../../types/preventive';

interface MonthlyExecutiveReportViewProps {
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveTasks?: any[];
  preventiveExecutions?: PreventiveExecutionRecord[];
  machines?: any[];
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToStock?: () => void;
  onNavigateToCorrective?: () => void;
  onNavigateToPreventive?: () => void;
}

export default function MonthlyExecutiveReportView({
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveTasks = [],
  preventiveExecutions = [],
  machines: _machines = [],
  showToast,
  onNavigateToStock,
  onNavigateToCorrective,
  onNavigateToPreventive,
}: MonthlyExecutiveReportViewProps) {
  const { t, language } = useI18n();

  // Selected month in YYYY-MM format (defaults to current system month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Month-over-Month calculation
  const comparison: MonthOverMonthComparison = useMemo(() => {
    return MonthlyReportCalculationService.calculateMonthOverMonthComparison({
      month: selectedMonth,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveTasks,
      preventiveExecutions,
    });
  }, [selectedMonth, stockItems, mouvements, correctiveInterventions, preventiveTasks, preventiveExecutions]);

  const report = comparison.currentReport;
  const previousReport = comparison.previousReport;

  // Format month for display
  const formatMonthTitle = useCallback(
    (ym: string) => {
      try {
        const [year, month] = ym.split('-').map(Number);
        const d = new Date(year, month - 1, 1);
        const locale = language === 'ar' ? 'ar-MA' : language === 'en' ? 'en-US' : 'fr-FR';
        return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      } catch {
        return ym;
      }
    },
    [language]
  );

  // Quick month navigators
  const handlePrevMonth = () => {
    setSelectedMonth(MonthlyReportCalculationService.getPreviousMonth(selectedMonth));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    const nextY = d.getFullYear();
    const nextM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${nextY}-${nextM}`);
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(new Date().toISOString().slice(0, 7));
  };

  // Export Excel handler
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await MonthlyReportExportService.exportMonthlyReportToExcel({
        comparison,
        mouvements,
        correctiveInterventions,
        preventiveExecutions,
        stockItems,
      });
      showToast?.(
        language === 'ar'
          ? 'تم تصدير ملف الإكسل التنفيذي للشهر بنجاح'
          : 'Rapport mensuel Excel généré avec succès',
        'success'
      );
    } catch (err: any) {
      showToast?.(
        language === 'ar'
          ? `فشل تصدير الإكسل: ${err?.message || ''}`
          : `Erreur d'export Excel : ${err?.message || ''}`,
        'error'
      );
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Print PDF handler
  const handlePrintPdf = () => {
    window.print();
  };

  // Helper badge for MoM trends
  const renderDeltaBadge = (
    delta: MonthOverMonthDelta,
    options: { invertColors?: boolean; unit?: string } = {}
  ) => {
    const { invertColors = false, unit = '%' } = options;
    const isUp = delta.trend === 'UP';
    const isDown = delta.trend === 'DOWN';

    // Invert colors: for cost/downtime/failures, UP is worse (red), DOWN is better (green)
    const isPositiveGood = !invertColors;
    const badgeColor =
      delta.trend === 'STABLE'
        ? 'bg-slate-100 text-slate-700 border-slate-200'
        : isUp
        ? isPositiveGood
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-rose-50 text-rose-700 border-rose-200'
        : isPositiveGood
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border font-mono ${badgeColor}`}
        title={`Diff: ${delta.diff > 0 ? '+' : ''}${delta.diff}`}
      >
        {isUp && <TrendingUp className="w-3 h-3" />}
        {isDown && <TrendingDown className="w-3 h-3" />}
        {!isUp && !isDown && <Minus className="w-3 h-3" />}
        <span>
          {delta.percent > 0 ? '+' : ''}
          {delta.percent}
          {unit}
        </span>
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12 select-none" dir="ltr">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CONTROLS (Screen Only) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {t('executive_report.title', 'Rapport Mensuel Exécutif Direction')}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {t(
                  'executive_report.subtitle',
                  "Synthèse stratégique, financière et opérationnelle du mois pour les décideurs de l'usine"
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Month Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Stepper */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-1 gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCurrentMonth}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
          >
            {language === 'ar' ? 'هذا الشهر' : language === 'en' ? 'Current Month' : 'Ce Mois'}
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-bold transition-all shadow-xs active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            {isExportingExcel ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{t('executive_report.export_excel', 'Exporter Excel Mensuel')}</span>
          </button>

          {/* Print PDF Button */}
          <button
            type="button"
            onClick={handlePrintPdf}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('executive_report.print_pdf', 'Imprimer / PDF Officiel')}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PRINT OFFICIAL FACTORY HEADER (Print Only) */}
      {/* ========================================================================= */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center font-black text-xl rounded-lg">
              CIOB
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                RAPPORT MENSUEL EXÉCUTIF DIRECTION — GMAO
              </h1>
              <p className="text-xs text-slate-600 font-semibold">
                Usine de Production Industrielle • Période : {formatMonthTitle(selectedMonth)} ({selectedMonth})
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono space-y-0.5">
            <div>Réf : RAP-DIR-{selectedMonth}</div>
            <div>Édité le : {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR')}</div>
          </div>
        </div>
      </div>

      {/* Period Banner indicator */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-extrabold tracking-widest text-indigo-300">
            {t('executive_report.period_label', "Période d'analyse :")}
          </div>
          <div className="text-2xl font-black tracking-tight mt-0.5">
            {formatMonthTitle(selectedMonth)}
          </div>
          <div className="text-xs text-slate-300 mt-1 font-mono">
            {t('executive_report.reference_doc', 'Réf. Document : RAP-DIR-{{month}}', {
              month: selectedMonth,
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-white/10">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
              {language === 'ar' ? 'المقارنة مع' : 'Comparé à'}
            </span>
            <span className="font-bold text-indigo-200">
              {formatMonthTitle(comparison.previousMonth)}
            </span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
              {language === 'ar' ? 'حالة المصنع' : 'Disponibilité'}
            </span>
            <span className="font-bold text-emerald-400">
              {report.correctiveCount === 0 ? 'Excellente (0 Panne)' : `${report.totalDowntimeHours}h arrêt`}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. FOUR MASTER EXECUTIVE CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: BUDGET & VALORISATION STOCK */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>{t('executive_report.kpi_consumption', 'Consommation PDR du Mois')}</span>
            </span>
            {renderDeltaBadge(comparison.consumptionCostDelta, { invertColors: true })}
          </div>

          <div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {report.monthConsumptionCost.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-sm font-sans font-bold text-slate-400">DT</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{language === 'ar' ? 'الشهر السابق:' : 'Mois préc.:'} {previousReport.monthConsumptionCost.toLocaleString('fr-FR')} DT</span>
              <span className="font-bold text-slate-700">{report.monthSortiesCount} sorties</span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>{t('executive_report.kpi_valuation', 'Valorisation Stock :')}</span>
            <span className="font-mono font-extrabold text-slate-900">
              {report.stockValuationTotal.toLocaleString('fr-FR')} DT
            </span>
          </div>
        </div>

        {/* CARD 2: DISCIPLINE PRÉVENTIVE */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>{t('executive_report.kpi_preventive', 'Discipline Préventive')}</span>
            </span>
            {renderDeltaBadge(comparison.preventiveDisciplineDelta, { invertColors: false, unit: '%' })}
          </div>

          <div>
            <div className="text-2xl font-black text-indigo-700 font-mono">
              {report.preventiveDisciplineRate}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>
                {report.preventiveExecutedCount} / {report.preventiveScheduledCount} exécutés
              </span>
              <span className="font-mono font-bold text-slate-700">
                {report.preventiveLaborHours} h MO
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>{language === 'ar' ? 'التكلفة الإجمالية:' : 'Dépenses préventif :'}</span>
            <span className="font-mono font-extrabold text-slate-900">
              {report.preventiveTotalCost.toLocaleString('fr-FR')} DT
            </span>
          </div>
        </div>

        {/* CARD 3: PANNES & ARRÊTS (CORRECTIF) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-amber-600" />
              <span>{t('executive_report.kpi_corrective', 'Pannes & Disponibilité')}</span>
            </span>
            {renderDeltaBadge(comparison.correctiveCountDelta, { invertColors: true })}
          </div>

          <div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {report.correctiveCount}{' '}
              <span className="text-sm font-sans font-bold text-slate-400">
                {report.correctiveCount > 1 ? 'pannes' : 'panne'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>
                {report.correctiveClosedCount} clôturés • {report.correctiveInProgressCount} en cours
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>{language === 'ar' ? 'ساعات التوقف:' : "Total temps d'arrêt :"}</span>
            <span className="font-mono font-extrabold text-amber-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {report.totalDowntimeHours} h
            </span>
          </div>
        </div>

        {/* CARD 4: RUPTURES & ALERTES ACHATS */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{t('executive_report.urgent_purchases', "Besoins d'Achats & Alertes")}</span>
            </span>
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
              {report.ruptureCount + report.alerteCount} alertes
            </span>
          </div>

          <div>
            <div className="text-2xl font-black text-rose-700 font-mono">
              {report.ruptureCount}{' '}
              <span className="text-sm font-sans font-bold text-rose-500">
                {t('executive_report.ruptures_count', 'Ruptures')}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{report.alerteCount} sous seuil minimal</span>
              <span className="font-bold text-slate-700">{report.stockItemsCount} articles</span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>{language === 'ar' ? 'إجراء سريع:' : 'Action recommandée :'}</span>
            <button
              type="button"
              onClick={onNavigateToStock}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 text-xs cursor-pointer print:hidden"
            >
              <span>{language === 'ar' ? 'فتح المخزون' : 'Voir Stock'}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DETAIL TABLES: TOP CONSUMED PARTS & TOP FAILING MACHINES */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOP 5 CONSUMED SPARES */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              <span>{t('executive_report.top_consumed_title', 'Top 5 Pièces Consommées sur le Mois')}</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total : {report.monthConsumptionCost.toFixed(2)} DT
            </span>
          </div>

          {report.topConsumedParts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              {language === 'ar' ? 'لا توجد حركات صرف مسجلة في هذا الشهر.' : 'Aucune consommation enregistrée sur cette période.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
                    <th className="py-2 font-mono">Réf</th>
                    <th className="py-2">Désignation</th>
                    <th className="py-2 text-right">Quantité</th>
                    <th className="py-2 text-right">P.U (DT)</th>
                    <th className="py-2 text-right font-bold text-slate-700">Total (DT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.topConsumedParts.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 font-mono font-bold text-slate-900">{item.ref}</td>
                      <td className="py-2.5 text-slate-700 font-medium">{item.designation}</td>
                      <td className="py-2.5 text-right font-mono text-slate-700">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-500">
                        {item.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-extrabold text-emerald-700">
                        {item.totalCost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TOP 3 FAILING MACHINES */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Factory className="w-4 h-4 text-amber-600" />
              <span>{t('executive_report.top_failing_title', 'Top 3 Machines les Plus Pénalisantes')}</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total Arrêt : {report.totalDowntimeHours} h
            </span>
          </div>

          {report.topFailingMachines.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              {language === 'ar' ? 'لا توجد أعطال مسجلة في هذا الشهر. الآلات مستقرة بنسبة 100%.' : 'Aucune panne déclarée sur cette période. Fiabilité totale.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
                    <th className="py-2 font-mono">Code</th>
                    <th className="py-2">Nom Machine</th>
                    <th className="py-2 text-right">Nb Pannes</th>
                    <th className="py-2 text-right font-bold text-amber-700">Arrêt Total</th>
                    <th className="py-2 text-right">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.topFailingMachines.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 font-mono font-bold text-slate-900">{m.machineCode}</td>
                      <td className="py-2.5 text-slate-700 font-medium">{m.machineName}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-800">
                        {m.failureCount}
                      </td>
                      <td className="py-2.5 text-right font-mono font-extrabold text-amber-700">
                        {m.totalDowntimeHours.toFixed(1)} h
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {m.totalDowntimeHours > 5 ? 'Critique' : 'Modéré'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. CRITICAL INVENTORY PURCHASES & REPLENISHMENT NEEDS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-black text-slate-900">
              {t('executive_report.urgent_purchases', "Besoins d'Achats Urgents & Alertes")}
            </h3>
          </div>
          <span className="text-xs text-rose-700 font-bold font-mono">
            {report.ruptureItems.length} article(s) à approvisionner d'urgence
          </span>
        </div>

        {report.ruptureItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-emerald-600 font-bold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{language === 'ar' ? 'المخزون مؤمّن بالكامل دون أي حالة نفاد.' : 'Sécurité de stock garantie : aucune rupture active.'}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
                  <th className="py-2 font-mono">Référence</th>
                  <th className="py-2">Désignation</th>
                  <th className="py-2 text-right">Stock Actuel</th>
                  <th className="py-2 text-right">Seuil Min</th>
                  <th className="py-2 text-right">Prix Unitaire</th>
                  <th className="py-2 text-right font-bold text-rose-700">Qté Recommandée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.ruptureItems.map((item, idx) => {
                  const qteToOrder = Math.max(1, item.seuil * 2 - Math.max(0, item.stockActuel));
                  return (
                    <tr key={idx} className="hover:bg-rose-50/40 transition-colors">
                      <td className="py-2.5 font-mono font-bold text-rose-700">{item.ref}</td>
                      <td className="py-2.5 text-slate-800 font-medium">{item.designation}</td>
                      <td className="py-2.5 text-right font-mono font-black text-rose-600">
                        {item.stockActuel}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-500">{item.seuil}</td>
                      <td className="py-2.5 text-right font-mono text-slate-600">
                        {item.prixUnitaire.toFixed(2)} DT
                      </td>
                      <td className="py-2.5 text-right font-mono font-black text-slate-900">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          +{qteToOrder} pcs
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. OFFICIAL SIGN-OFF BLOCK (Print / Formal Executive View) */}
      {/* ========================================================================= */}
      <div className="bg-slate-50/80 rounded-3xl border border-slate-200 p-6 space-y-4 print:mt-12">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {language === 'ar' ? 'التأشيرات والاعتماد الرسمي' : 'Validation & Signatures Officielles'}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 h-32 flex flex-col justify-between">
            <div className="text-xs font-black text-slate-900">
              {t('executive_report.visa_maintenance', 'Visa Responsable Maintenance')}
            </div>
            <div className="text-[11px] text-slate-400 italic">
              {t('executive_report.date_signature', 'Date & Cachet :')}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 h-32 flex flex-col justify-between">
            <div className="text-xs font-black text-slate-900">
              {t('executive_report.visa_direction', "Visa Direction de l'Usine")}
            </div>
            <div className="text-[11px] text-slate-400 italic">
              {t('executive_report.date_signature', 'Date & Cachet :')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
