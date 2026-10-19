import { useState, useMemo } from 'react';
import {
  Clock,
  Wrench,
  CheckCircle2,
  Trash2,
  Package,
  DollarSign,
  AlertCircle,
  Search,
} from 'lucide-react';
import type { PreventiveExecutionRecord } from '../../../../types/preventive';
import PeriodFilterBar from '../../../components/common/PeriodFilterBar';
import { type PeriodFilterState, isDateInPeriod } from '../../../../utils/datePeriodUtils';
import { useI18n } from '../../../../i18n/I18nContext';

interface PreventiveExecutionsHistoryViewProps {
  executions: PreventiveExecutionRecord[];
  onDeleteExecution?: (id: string) => void;
  onNavigateToMachine?: (code: string) => void;
}

export default function PreventiveExecutionsHistoryView({
  executions = [],
  onDeleteExecution,
  onNavigateToMachine,
}: PreventiveExecutionsHistoryViewProps) {
  const { language } = useI18n();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>({ preset: 'ALL' });
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const availableDates = useMemo(() => {
    return executions.map((e) => e.executedAt);
  }, [executions]);

  const filteredExecutions = useMemo(() => {
    return executions.filter((item) => {
      // 1. Period Filter
      if (!isDateInPeriod(item.executedAt, periodFilter)) {
        return false;
      }
      // 2. Text Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (item.taskCode || '').toLowerCase().includes(q) ||
          (item.machineCode || '').toLowerCase().includes(q) ||
          (item.machineName || '').toLowerCase().includes(q) ||
          (item.executorName || '').toLowerCase().includes(q) ||
          (item.organe || '').toLowerCase().includes(q) ||
          (item.notes || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [executions, periodFilter, search]);

  // Aggregate metrics for filtered period
  const metrics = useMemo(() => {
    const totalExecs = filteredExecutions.length;
    const totalMinutes = filteredExecutions.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
    const totalSparesCost = filteredExecutions.reduce((sum, e) => sum + (e.sparesCost || 0), 0);
    const totalCost = filteredExecutions.reduce((sum, e) => sum + (e.totalCost || 0), 0);
    const hours = (totalMinutes / 60).toFixed(1);
    return { totalExecs, totalMinutes, hours, totalSparesCost, totalCost };
  }, [filteredExecutions]);

  const handleDelete = (id: string) => {
    if (window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف سجل التنفيذ هذا؟' : 'Supprimer cet enregistrement d\'exécution ?')) {
      onDeleteExecution?.(id);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4" dir="ltr">
      {/* Header and Period Filter */}
      <div className="flex flex-col gap-3">
        <PeriodFilterBar
          value={periodFilter}
          onChange={setPeriodFilter}
          availableDates={availableDates}
          filteredCount={filteredExecutions.length}
          totalCount={executions.length}
        />

        {/* Quick Search and Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'ar' ? 'التنفيذات المنجزة' : 'Interventions Réalisées'}</span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
              {metrics.totalExecs}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>{language === 'ar' ? 'ساعات العمل' : 'Temps Passé'}</span>
            </div>
            <div className="text-xl font-extrabold text-indigo-600 mt-1 font-mono">
              {metrics.hours} <span className="text-xs font-normal text-slate-500">h</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span>{language === 'ar' ? 'تكلفة قطع الغيار' : 'Coût PDR Consommée'}</span>
            </div>
            <div className="text-xl font-extrabold text-amber-600 mt-1 font-mono">
              {metrics.totalSparesCost.toFixed(2)} <span className="text-xs font-normal text-slate-500">DT</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'ar' ? 'التكلفة الإجمالية' : 'Coût Total Préventif'}</span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
              {metrics.totalCost.toFixed(2)} <span className="text-xs font-normal text-slate-500">DT</span>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              language === 'ar'
                ? 'بحث بالآلة أو الفني أو الكود أو الملاحظات...'
                : 'Rechercher par machine, technicien, organe, code...'
            }
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">{language === 'ar' ? 'التاريخ' : 'Date & Période'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'الآلة' : 'Machine'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'المهمة والعنصر' : 'Composant & Action'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'الفني المنفذ' : 'Technicien'}</th>
                <th className="py-3 px-4 text-center">{language === 'ar' ? 'المدة' : 'Durée'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'القطع المستهلكة' : 'PDR Consommée'}</th>
                <th className="py-3 px-4 text-right">{language === 'ar' ? 'التكلفة' : 'Coût Total'}</th>
                <th className="py-3 px-4 text-right">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExecutions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6 text-slate-300" />
                      <span>
                        {language === 'ar'
                          ? 'لا توجد سجلات تنفيذ مسجلة لهذه الفترة'
                          : 'Aucun enregistrement d\'exécution pour cette période'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExecutions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900">{exec.executedAt}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {exec.periodMonth} • {exec.periodWeek}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onNavigateToMachine?.(exec.machineCode)}
                        className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{exec.machineCode}</span>
                      </button>
                      <div className="text-[10.5px] text-slate-500 truncate max-w-[140px]">
                        {exec.machineName}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {exec.actionCode}
                        </span>
                        <span className="font-semibold text-slate-800">{exec.organe}</span>
                      </div>
                      {exec.notes && (
                        <div className="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-[200px]" title={exec.notes}>
                          « {exec.notes} »
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700 text-[11px]">
                        {exec.executorName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap font-mono font-medium text-slate-700">
                      {exec.durationMinutes} min
                    </td>
                    <td className="py-3 px-4">
                      {exec.sparesUsed && exec.sparesUsed.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {exec.sparesUsed.map((pdr, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-mono font-bold"
                              title={`${pdr.designation} (${pdr.qty} ${pdr.unit})`}
                            >
                              {pdr.ref || pdr.designation} x{pdr.qty}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-extrabold text-slate-900">
                      {exec.totalCost.toFixed(2)} DT
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {onDeleteExecution && (
                        <button
                          type="button"
                          onClick={() => handleDelete(exec.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title={language === 'ar' ? 'حذف السجل' : 'Supprimer'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
