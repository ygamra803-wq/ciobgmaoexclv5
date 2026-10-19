import PropTypes from 'prop-types';
import {
  SlidersHorizontal,
  RotateCcw,
  FileSpreadsheet,
  Search,
  X,
  Radio,
  Tag,
} from 'lucide-react';
import { useTranslation } from '../../../i18n/I18nContext';

const COLOR_MAP = {
  emerald: {
    iconBg: 'bg-emerald-500/10',
    iconBorder: 'border-emerald-200/80',
    iconText: 'text-emerald-700',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    btnBg: 'bg-emerald-50 hover:bg-emerald-100',
    btnText: 'text-emerald-900',
    btnBorder: 'border-emerald-300/90',
  },
  teal: {
    iconBg: 'bg-teal-500/10',
    iconBorder: 'border-teal-200/80',
    iconText: 'text-teal-700',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-200',
    btnBg: 'bg-teal-50 hover:bg-teal-100',
    btnText: 'text-teal-900',
    btnBorder: 'border-teal-300/90',
  },
  cyan: {
    iconBg: 'bg-cyan-500/10',
    iconBorder: 'border-cyan-200/80',
    iconText: 'text-cyan-700',
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-800',
    badgeBorder: 'border-cyan-200',
    btnBg: 'bg-cyan-50 hover:bg-cyan-100',
    btnText: 'text-cyan-900',
    btnBorder: 'border-cyan-300/90',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10',
    iconBorder: 'border-indigo-200/80',
    iconText: 'text-indigo-700',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-200',
    btnBg: 'bg-indigo-50 hover:bg-indigo-100',
    btnText: 'text-indigo-900',
    btnBorder: 'border-indigo-300/90',
  },
  purple: {
    iconBg: 'bg-purple-500/10',
    iconBorder: 'border-purple-200/80',
    iconText: 'text-purple-700',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
    btnBg: 'bg-purple-50 hover:bg-purple-100',
    btnText: 'text-purple-900',
    btnBorder: 'border-purple-300/90',
  },
  amber: {
    iconBg: 'bg-amber-500/10',
    iconBorder: 'border-amber-200/80',
    iconText: 'text-amber-700',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    btnBg: 'bg-amber-50 hover:bg-amber-100',
    btnText: 'text-amber-900',
    btnBorder: 'border-amber-300/90',
  },
  rose: {
    iconBg: 'bg-rose-500/10',
    iconBorder: 'border-rose-200/80',
    iconText: 'text-rose-700',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200',
    btnBg: 'bg-rose-50 hover:bg-rose-100',
    btnText: 'text-rose-900',
    btnBorder: 'border-rose-300/90',
  },
  slate: {
    iconBg: 'bg-slate-500/10',
    iconBorder: 'border-slate-200/80',
    iconText: 'text-slate-700',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-200',
    btnBg: 'bg-slate-100 hover:bg-slate-200',
    btnText: 'text-slate-900',
    btnBorder: 'border-slate-300',
  },
};

/**
 * Standard Industrial Filter Field wrapper
 */
export function FilterField({
  label,
  colBadge,
  colBadgeColor = 'slate',
  children,
  className = '',
}) {
  const badgeClasses = {
    slate: 'bg-slate-100 text-slate-600 border-slate-200/80',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
    teal: 'bg-teal-50 text-teal-700 border-teal-200/80',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/80',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    rose: 'bg-rose-50 text-rose-700 border-rose-200/80',
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-800">
        <span className="truncate">{label}</span>
        {colBadge && (
          <span
            className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold border shrink-0 ${
              badgeClasses[colBadgeColor] || badgeClasses.slate
            }`}
          >
            {colBadge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

FilterField.propTypes = {
  label: PropTypes.node.isRequired,
  colBadge: PropTypes.string,
  colBadgeColor: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

/**
 * Standard Omni Search Field for filter grid
 */
export function FilterSearchInput({
  value = '',
  onChange,
  onClear,
  placeholder,
  label,
  colBadge = 'Omni',
  colBadgeColor = 'slate',
  focusRingColor = 'focus:ring-cyan-500',
  className = '',
}) {
  const { t } = useTranslation();
  const effectiveLabel = label || t('common.filters.search');
  const effectivePlaceholder = placeholder || t('common.filters.search_placeholder');

  return (
    <FilterField
      label={effectiveLabel}
      colBadge={colBadge}
      colBadgeColor={colBadgeColor}
      className={className}
    >
      <div className="relative">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs pointer-events-none">
          <Search className="w-3 h-3" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          placeholder={effectivePlaceholder}
          className={`w-full h-9 pl-9 pr-7 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 ${focusRingColor} transition-colors`}
        />
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 cursor-pointer p-0.5 rounded transition"
            title={t('common.filters.reset')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </FilterField>
  );
}

FilterSearchInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onClear: PropTypes.func,
  placeholder: PropTypes.string,
  label: PropTypes.node,
  colBadge: PropTypes.string,
  colBadgeColor: PropTypes.string,
  focusRingColor: PropTypes.string,
  className: PropTypes.string,
};

/**
 * Central Unified Industrial Filter & Search Card Component
 */
export default function IndustrialFilterCard({
  title,
  subtitle,
  icon: Icon = SlidersHorizontal,
  color = 'cyan',
  filteredCount,
  totalCount,
  countBadge,
  hasActiveFilters = false,
  onReset,
  resetTooltip,
  onExportExcel,
  exportLabel,
  headerActions,
  presets = [],
  presetsLabel,
  presetsIcon: PresetsIcon = Radio,
  activeFilters = [],
  onClearAll,
  children,
  className = '',
}) {
  const { t } = useTranslation();
  const theme = COLOR_MAP[color] || COLOR_MAP.cyan;

  const effectiveTitle = title || t('common.filters.title');
  const effectiveResetTooltip = resetTooltip || t('common.filters.reset_tooltip');
  const effectiveExportLabel = exportLabel || t('common.filters.export_excel');
  const effectivePresetsLabel = presetsLabel || t('common.filters.status');

  return (
    <div
      className={`relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4 ${className}`}
    >
      {/* 1. Header Toolbar inside Filter Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl ${theme.iconBg} border ${theme.iconBorder} flex items-center justify-center ${theme.iconText} shadow-2xs shrink-0`}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                {effectiveTitle}
              </span>

              {/* Counter Badge */}
              {countBadge ? (
                countBadge
              ) : filteredCount !== undefined && totalCount !== undefined ? (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}
                >
                  {filteredCount} / {totalCount}
                </span>
              ) : null}
            </div>
            {subtitle && (
              <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {headerActions}

          {/* Optional Excel Export */}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className={`h-8 px-3 rounded-xl border ${theme.btnBorder} ${theme.btnBg} ${theme.btnText} text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95`}
              title={effectiveExportLabel}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">{effectiveExportLabel}</span>
            </button>
          )}

          {/* Quick Reset Circular Button */}
          {hasActiveFilters && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in"
              title={effectiveResetTooltip}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Quick Status Presets Row */}
      {presets && presets.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <PresetsIcon className="w-3 h-3 text-slate-400" /> {effectivePresetsLabel}
          </span>
          {presets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={preset.onClick}
              className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                preset.isActive
                  ? preset.activeBg || 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {preset.colorDot && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${preset.colorDot} ${
                    preset.isActive ? 'ring-2 ring-white/50' : ''
                  }`}
                />
              )}
              <span>{preset.label}</span>
              {preset.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                    preset.isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-slate-600 border border-slate-200/60'
                  }`}
                >
                  {preset.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 3. Filter Grid Inputs (Children) */}
      {children}

      {/* 4. Active Filters Chips Row */}
      {activeFilters && activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Tag className="w-3 h-3 text-slate-400" />
            {t('common.filters.active_filters')}
          </span>
          {activeFilters.map((af) => (
            <span
              key={af.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200"
            >
              <span>{af.label}</span>
              {af.onRemove && (
                <button
                  type="button"
                  onClick={af.onRemove}
                  className="hover:text-rose-600 cursor-pointer p-0.5 rounded transition"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}

          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-slate-400 hover:text-rose-600 font-semibold text-[11px] transition cursor-pointer flex items-center gap-1 ml-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('common.filters.reset_all')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

IndustrialFilterCard.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  icon: PropTypes.elementType,
  color: PropTypes.oneOf([
    'emerald',
    'teal',
    'cyan',
    'indigo',
    'purple',
    'amber',
    'rose',
    'slate',
  ]),
  filteredCount: PropTypes.number,
  totalCount: PropTypes.number,
  countBadge: PropTypes.node,
  hasActiveFilters: PropTypes.bool,
  onReset: PropTypes.func,
  resetTooltip: PropTypes.string,
  onExportExcel: PropTypes.func,
  exportLabel: PropTypes.string,
  headerActions: PropTypes.node,
  presets: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      count: PropTypes.number,
      colorDot: PropTypes.string,
      isActive: PropTypes.bool,
      onClick: PropTypes.func,
      activeBg: PropTypes.string,
    })
  ),
  presetsLabel: PropTypes.node,
  presetsIcon: PropTypes.elementType,
  activeFilters: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      onRemove: PropTypes.func,
    })
  ),
  onClearAll: PropTypes.func,
  children: PropTypes.node,
  className: PropTypes.string,
};
