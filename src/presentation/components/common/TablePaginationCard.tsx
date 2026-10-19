import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../i18n/I18nContext';

const COLOR_CLASSES = {
  emerald: 'text-emerald-800',
  indigo: 'text-indigo-800',
  cyan: 'text-cyan-800',
  amber: 'text-amber-800',
  purple: 'text-purple-800',
  blue: 'text-blue-800',
  rose: 'text-rose-800',
  slate: 'text-slate-800',
};

export default function TablePaginationCard({
  currentPage = 1,
  setCurrentPage,
  pageSize = 25,
  setPageSize,
  totalItems = 0,
  pageSizeOptions = [25, 50, 100, 200, 0],
  color = 'cyan',
  itemLabel = '',
  className = '',
}) {
  const { t } = useTranslation();
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalItems / pageSize);
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;

  const activeColorClass = COLOR_CLASSES[color] || COLOR_CLASSES.cyan;

  return (
    <div
      className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-center justify-between gap-4 mt-4 ${className}`}
    >
      {/* Rows per page selection */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-600">
          {t('common.pagination.rows_per_page')}
        </span>
        <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
          {pageSizeOptions.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => {
                if (setPageSize) setPageSize(size);
                if (setCurrentPage) setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                pageSize === size
                  ? `bg-white ${activeColorClass} shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out border border-slate-200/50`
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              {size === 0 ? t('common.pagination.all') : size}
            </button>
          ))}
        </div>
      </div>

        {/* Counter & Navigation Controls */}
        <div className="flex items-center gap-4">
          <div className="text-xs font-semibold text-slate-500">
            {t('common.pagination.showing')} <b className="text-slate-900">{totalItems === 0 ? 0 : startIndex + 1}</b> {t('common.pagination.to')}{' '}
            <b className="text-slate-900">{Math.min(startIndex + effectivePageSize, totalItems)}</b>{' '}
            {t('common.pagination.of')} <b className="text-slate-900">{totalItems}</b> {itemLabel ? (typeof itemLabel === 'string' && itemLabel.includes('.') ? t(itemLabel) : itemLabel) : ''}
          </div>

          {/* Navigation Controls: Always consistently visible across all pages for unified UX */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage && setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || pageSize === 0 || totalPages <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer shadow-2xs"
              title={t('common.pagination.previous')}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('common.pagination.previous')}</span>
            </button>

            <span className="px-2.5 py-1 font-mono text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg select-none">
              {pageSize === 0 ? '1 / 1' : `${currentPage} / ${totalPages || 1}`}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage && setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSize === 0 || totalPages <= 1 || currentPage >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer shadow-2xs"
              title={t('common.pagination.next')}
            >
              <span className="hidden sm:inline">{t('common.pagination.next')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
    </div>
  );
}
