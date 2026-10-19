import { useState, useMemo } from 'react';
import { Calendar, ChevronDown, Filter, X, Clock } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import {
  type PeriodFilterState,
  extractAvailableMonths,
  getPeriodBoundaries,
} from '../../../utils/datePeriodUtils';

interface PeriodFilterBarProps {
  value: PeriodFilterState;
  onChange: (nextState: PeriodFilterState) => void;
  availableDates?: (string | null | undefined)[];
  filteredCount?: number;
  totalCount?: number;
  className?: string;
}

export default function PeriodFilterBar({
  value,
  onChange,
  availableDates = [],
  filteredCount,
  totalCount,
  className = '',
}: PeriodFilterBarProps) {
  const { t, language } = useI18n();
  const [showCustomRange, setShowCustomRange] = useState(value.preset === 'CUSTOM_RANGE');

  const monthsList = useMemo(() => {
    return extractAvailableMonths(availableDates);
  }, [availableDates]);

  const boundaries = useMemo(() => {
    return getPeriodBoundaries(value);
  }, [value]);

  const handlePresetClick = (preset: PeriodFilterState['preset']) => {
    if (preset === 'CUSTOM_RANGE') {
      setShowCustomRange(true);
      onChange({
        ...value,
        preset: 'CUSTOM_RANGE',
        startDate: value.startDate || boundaries.start || new Date().toISOString().split('T')[0],
        endDate: value.endDate || boundaries.end || new Date().toISOString().split('T')[0],
      });
      return;
    }

    setShowCustomRange(false);
    if (preset === 'CUSTOM_MONTH') {
      onChange({
        ...value,
        preset: 'CUSTOM_MONTH',
        selectedMonth: value.selectedMonth || monthsList[0] || new Date().toISOString().slice(0, 7),
      });
      return;
    }

    onChange({
      preset,
      selectedMonth: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  };

  const isFiltered = value.preset !== 'ALL';

  // Format month for display (e.g. 'Octobre 2026')
  const formatMonthLabel = (ym: string) => {
    try {
      const [year, month] = ym.split('-').map(Number);
      const d = new Date(year, month - 1, 1);
      const locale = language === 'ar' ? 'ar-MA' : language === 'en' ? 'en-US' : 'fr-FR';
      return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    } catch {
      return ym;
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs space-y-2 select-none ${className}`}
      dir="ltr"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Preset Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">
              {t('common.period', language === 'ar' ? 'الفترة :' : language === 'en' ? 'Period:' : 'Période :')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handlePresetClick('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              value.preset === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {t('common.all', language === 'ar' ? 'الكل' : language === 'en' ? 'All' : 'Tout')}
          </button>

          <button
            type="button"
            onClick={() => handlePresetClick('THIS_MONTH')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              value.preset === 'THIS_MONTH'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {t('period.this_month', language === 'ar' ? 'هذا الشهر' : language === 'en' ? 'This Month' : 'Ce mois')}
          </button>

          <button
            type="button"
            onClick={() => handlePresetClick('LAST_MONTH')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              value.preset === 'LAST_MONTH'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {t('period.last_month', language === 'ar' ? 'الشهر الماضي' : language === 'en' ? 'Last Month' : 'Mois dernier')}
          </button>

          <button
            type="button"
            onClick={() => handlePresetClick('THIS_QUARTER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              value.preset === 'THIS_QUARTER'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {t('period.quarter', language === 'ar' ? 'ربع سنوي' : language === 'en' ? 'Quarter' : 'Trimestre')}
          </button>

          {/* Month Selector Dropdown */}
          <div className="relative inline-flex items-center">
            <select
              value={value.preset === 'CUSTOM_MONTH' ? value.selectedMonth || '' : ''}
              onChange={(e) => {
                if (e.target.value) {
                  onChange({
                    preset: 'CUSTOM_MONTH',
                    selectedMonth: e.target.value,
                  });
                  setShowCustomRange(false);
                }
              }}
              className={`h-8 pl-3 pr-7 rounded-xl text-xs font-bold border transition cursor-pointer appearance-none ${
                value.preset === 'CUSTOM_MONTH'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-extrabold ring-1 ring-indigo-400'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
            >
              <option value="" disabled>
                {t('period.choose_month', language === 'ar' ? 'اختر شهراً...' : language === 'en' ? 'Choose Month...' : 'Mois spécifique...')}
              </option>
              {monthsList.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)} ({m})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => handlePresetClick('CUSTOM_RANGE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              value.preset === 'CUSTOM_RANGE'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {t('period.custom_range', language === 'ar' ? 'فترة مخصصة' : language === 'en' ? 'Custom Range' : 'Plage libre')}
          </button>
        </div>

        {/* Counter Badge & Reset Button */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          {filteredCount !== undefined && totalCount !== undefined && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200/80 text-[11px] font-mono font-bold text-slate-700">
              <span className="text-indigo-600 font-extrabold">{filteredCount}</span>
              <span className="text-slate-400">/</span>
              <span>{totalCount}</span>
              <span className="text-slate-400 font-sans text-[10px]">
                {language === 'ar' ? 'سجل' : language === 'en' ? 'items' : 'lignes'}
              </span>
            </div>
          )}

          {isFiltered && (
            <button
              type="button"
              onClick={() => handlePresetClick('ALL')}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title={t('common.reset_filter', language === 'ar' ? 'إلغاء التصفية' : language === 'en' ? 'Reset filter' : 'Réinitialiser le filtre')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Custom Range Drawer (Visible when preset is CUSTOM_RANGE) */}
      {showCustomRange && value.preset === 'CUSTOM_RANGE' && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-xs animate-in fade-in duration-150">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>{language === 'ar' ? 'من تاريخ :' : language === 'en' ? 'From:' : 'Du :'}</span>
          </span>
          <input
            type="date"
            value={value.startDate || ''}
            onChange={(e) =>
              onChange({
                ...value,
                startDate: e.target.value,
              })
            }
            className="h-8 px-2.5 rounded-xl border border-slate-300 text-xs font-mono font-semibold text-slate-800 bg-white"
          />
          <span className="text-slate-500 font-semibold">
            {language === 'ar' ? 'إلى تاريخ :' : language === 'en' ? 'To:' : 'Au :'}
          </span>
          <input
            type="date"
            value={value.endDate || ''}
            onChange={(e) =>
              onChange({
                ...value,
                endDate: e.target.value,
              })
            }
            className="h-8 px-2.5 rounded-xl border border-slate-300 text-xs font-mono font-semibold text-slate-800 bg-white"
          />
        </div>
      )}
    </div>
  );
}
