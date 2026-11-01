import React, { memo } from 'react';

export interface SkeletonColumnSpec {
  /** Header placeholder width class, e.g. 'w-24' */
  headerW?: string;
  /** Column min-width or width class, e.g. 'min-w-[180px]' or 'w-24' */
  colClass?: string;
  /** Alignment of header and cell content */
  align?: 'left' | 'center' | 'right';
  /** Visual archetype of the cell in the Light Excel table */
  type?: 'code' | 'double' | 'triple' | 'badge' | 'dual-badge' | 'number' | 'text' | 'avatar-double' | 'actions';
  /** Custom row widths cycled across rows */
  rowWidths?: string[];
  /** Secondary line widths for 'double' / 'triple' / 'avatar-double' */
  subWidths?: string[];
}

export interface SkeletonPageHeaderProps {
  /** Number of 3D circular action buttons on the right (default 2: Formulas + Add) */
  circleButtonsCount?: number;
  /** Number of inline header status/excel badges next to the title */
  titleBadgesCount?: number;
  /** Optional sub-tab switcher pills on the right (e.g. Corrective 5 tabs, Sortie 3 tabs, Preventive Secondary 3 tabs) */
  subTabsCount?: number;
  /** Whether sub-tabs are stacked below the action buttons (like CorrectiveView) */
  stackSubTabsBelowActions?: boolean;
  /** Whether subtitle has 2 lines (like StockView) */
  twoLineSubtitle?: boolean;
}

/**
 * 1. Shared Page Header Banner Skeleton
 * Mirrors the exact BDR Light Excel Header Card with free PageHeaderIcon (w-7 h-7),
 * title + badges, subtitle, 3D circular action buttons, and optional sub-tab pills.
 */
export const SkeletonPageHeader = memo(function SkeletonPageHeader({
  circleButtonsCount = 2,
  titleBadgesCount = 1,
  subTabsCount = 0,
  stackSubTabsBelowActions = false,
  twoLineSubtitle = false,
}: SkeletonPageHeaderProps) {
  const tabWidths = ['w-28', 'w-32', 'w-28', 'w-32', 'w-24'];

  return (
    <div
      className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 relative overflow-hidden"
      aria-hidden="true"
    >
      {/* Left: Free PageHeaderIcon (w-7 h-7) + Title & Subtitle */}
      <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative w-full">
        <div className="w-7 h-7 rounded-lg shimmer-wave shrink-0" />

        <div className="space-y-1.5 flex-1 max-w-3xl min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="h-6 w-64 sm:w-80 max-w-[80%] rounded-lg shimmer-wave" />
            {Array.from({ length: titleBadgesCount }).map((_, idx) => (
              <div
                key={`hdr-badge-${idx}`}
                className={`h-5 ${idx === 0 ? 'w-28' : 'w-24'} rounded-full bg-slate-100 border border-slate-200/80 shimmer-wave`}
              />
            ))}
          </div>
          <div className="space-y-1 pt-0.5">
            <div className="h-3 w-full max-w-2xl rounded shimmer-wave" />
            {twoLineSubtitle && <div className="h-3 w-3/4 max-w-lg rounded shimmer-wave" />}
          </div>
        </div>
      </div>

      {/* Right: 3D Circular Buttons & Optional Sub-Tabs */}
      <div
        className={`flex ${
          stackSubTabsBelowActions
            ? 'flex-col items-stretch sm:items-end gap-2.5'
            : 'items-center flex-wrap gap-2.5 self-end xl:self-auto'
        } shrink-0 relative`}
      >
        <div className="flex items-center justify-end gap-2">
          {Array.from({ length: circleButtonsCount }).map((_, idx) => (
            <div
              key={`hdr-circle-btn-${idx}`}
              className="w-10 h-10 rounded-full border border-slate-200/90 bg-slate-50 shimmer-wave shrink-0"
            />
          ))}
        </div>

        {subTabsCount > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
            {Array.from({ length: subTabsCount }).map((_, idx) => (
              <div
                key={`hdr-subtab-${idx}`}
                className={`h-8 ${tabWidths[idx % tabWidths.length]} rounded-lg shrink-0 ${
                  idx === 0
                    ? 'bg-white border border-slate-200/80 shadow-2xs shimmer-wave'
                    : 'bg-slate-200/50 shimmer-wave'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export interface SkeletonKpiCardProps {
  titleW?: string;
  valueW?: string;
  unitW?: string;
  badgeW?: string;
  footerLeftW?: string;
  footerRightW?: string;
  hasProgressBar?: boolean;
  className?: string;
}

/**
 * 2. Shared 4-Tier Mature Light Excel KPI Card Skeleton
 * Pixel-matched to <GmaoKpiCard />:
 * - Tier 1: Uppercase Title (left) + Free w-6 h-6 Icon (right, no box)
 * - Tier 2: 3xl Monospace Number + Unit
 * - Tier 3: Contextual Light Excel Badge Pill
 * - Tier 4: Divided Footer (border-t border-slate-100) + Optional Progress Bar
 */
export const SkeletonKpiCard = memo(function SkeletonKpiCard({
  titleW = 'w-28',
  valueW = 'w-16',
  unitW = 'w-14',
  badgeW = 'w-28',
  footerLeftW = 'w-20',
  footerRightW = 'w-16',
  hasProgressBar = false,
  className = '',
}: SkeletonKpiCardProps) {
  return (
    <div
      className={`bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between ${className}`}
      aria-hidden="true"
    >
      <div>
        {/* Tier 1: Title & Free Icon (w-6 h-6) */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className={`h-3 ${titleW} max-w-[75%] rounded shimmer-wave`} />
          <div className="w-6 h-6 rounded-md shimmer-wave shrink-0" />
        </div>

        {/* Tier 2: 3xl Monospace Value + Unit */}
        <div className="flex items-baseline gap-2">
          <div className={`h-8 ${valueW} rounded-lg font-mono shimmer-wave`} />
          <div className={`h-3.5 ${unitW} rounded shimmer-wave`} />
        </div>

        {/* Tier 3: Contextual Light Excel Badge */}
        <div className="mt-2 flex items-center gap-1.5">
          <div className={`h-5 ${badgeW} rounded border border-slate-200/80 bg-slate-50 shimmer-wave`} />
        </div>
      </div>

      {/* Tier 4: Divided Analytical Footer */}
      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className={`h-3 ${footerLeftW} rounded shimmer-wave`} />
          <div className={`h-3 ${footerRightW} rounded shimmer-wave`} />
        </div>
        {hasProgressBar && (
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="w-2/3 h-full rounded-full shimmer-wave" />
          </div>
        )}
      </div>
    </div>
  );
});

export interface SkeletonKpiGridProps {
  columns?: 4 | 5;
  cards?: SkeletonKpiCardProps[];
}

/**
 * 3. Shared Flexible KPI Grid Skeleton (4 or 5 Columns)
 * Pixel-matched to <GmaoKpiGrid columns={4 | 5} />
 */
export const SkeletonKpiGrid = memo(function SkeletonKpiGrid({
  columns = 4,
  cards,
}: SkeletonKpiGridProps) {
  const defaultCards: SkeletonKpiCardProps[] =
    columns === 5
      ? [
          { titleW: 'w-28', valueW: 'w-14', unitW: 'w-12', badgeW: 'w-16', footerLeftW: 'w-20', footerRightW: 'w-16' },
          { titleW: 'w-24', valueW: 'w-12', unitW: 'w-12', badgeW: 'w-20', footerLeftW: 'w-14', footerRightW: 'w-24' },
          { titleW: 'w-28', valueW: 'w-14', unitW: 'w-14', badgeW: 'w-24', footerLeftW: 'w-24', footerRightW: 'w-10', hasProgressBar: true },
          { titleW: 'w-24', valueW: 'w-10', unitW: 'w-12', badgeW: 'w-24', footerLeftW: 'w-16', footerRightW: 'w-24' },
          { titleW: 'w-32', valueW: 'w-20', unitW: 'w-8', badgeW: 'w-16', footerLeftW: 'w-20', footerRightW: 'w-28', className: 'col-span-2 lg:col-span-1' },
        ]
      : [
          { titleW: 'w-28', valueW: 'w-16', unitW: 'w-14', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-16' },
          { titleW: 'w-32', valueW: 'w-14', unitW: 'w-16', badgeW: 'w-24', footerLeftW: 'w-24', footerRightW: 'w-14' },
          { titleW: 'w-28', valueW: 'w-12', unitW: 'w-14', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-16' },
          { titleW: 'w-30', valueW: 'w-14', unitW: 'w-12', badgeW: 'w-24', footerLeftW: 'w-18', footerRightW: 'w-20' },
        ];

  const items = cards && cards.length > 0 ? cards : defaultCards;
  const gridColsClass =
    columns === 5
      ? 'grid-cols-2 lg:grid-cols-5 gap-3.5'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4';

  return (
    <div className={`grid ${gridColsClass}`} aria-hidden="true">
      {items.map((card, idx) => (
        <SkeletonKpiCard key={`skel-kpi-card-${idx}`} {...card} />
      ))}
    </div>
  );
});

export interface SkeletonFilterCardProps {
  /** Number of filter input columns in the responsive grid (1 to 5) */
  columns?: 1 | 2 | 3 | 4 | 5;
  /** Optional top segmented asset class bar (e.g. Machines / Preventive: Tous | Production | Systèmes Généraux) */
  hasAssetClassBar?: boolean;
  /** Optional PeriodFilterBar strip (e.g. Bons de Travail) */
  hasPeriodBar?: boolean;
  /** Show Excel export button in filter header */
  hasExportButton?: boolean;
}

/**
 * 4. Shared Industrial Filter Card Skeleton
 * Pixel-matched to <IndustrialFilterCard />:
 * - Header bar with w-8 h-8 icon, title, count badge (e.g. 25 / 25), subtitle, Excel button & reset circle
 * - Responsive filter fields with label + Excel column badge + h-10 input box
 */
export const SkeletonFilterCard = memo(function SkeletonFilterCard({
  columns = 4,
  hasAssetClassBar = false,
  hasPeriodBar = false,
  hasExportButton = true,
}: SkeletonFilterCardProps) {
  const gridClassMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
  };

  const labelWidths = ['w-28', 'w-24', 'w-32', 'w-24', 'w-28'];

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] space-y-4"
      aria-hidden="true"
    >
      {/* Top Header Row inside Filter Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
            <div className="w-4 h-4 rounded shimmer-wave" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="h-3.5 w-44 rounded shimmer-wave" />
              <div className="h-5 w-16 rounded-lg bg-slate-100 border border-slate-200/70 font-mono shimmer-wave" />
            </div>
            <div className="h-2.5 w-64 max-w-full rounded shimmer-wave" />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {hasExportButton && (
            <div className="h-8 w-24 rounded-xl bg-slate-100 border border-slate-200 shimmer-wave" />
          )}
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 shimmer-wave shrink-0" />
        </div>
      </div>

      {/* Optional Asset Class Segmented Switch Bar */}
      {hasAssetClassBar && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <div className="h-7 w-28 rounded-lg bg-white border border-slate-200/70 shadow-2xs shimmer-wave" />
            <div className="h-7 w-36 rounded-lg bg-slate-200/50 shimmer-wave" />
            <div className="h-7 w-36 rounded-lg bg-slate-200/50 shimmer-wave" />
          </div>
          <div className="h-7 w-32 rounded-xl bg-slate-50 border border-slate-200 shimmer-wave" />
        </div>
      )}

      {/* Optional Period Filter Bar */}
      {hasPeriodBar && (
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
          <div className="h-7 w-20 rounded-lg bg-slate-100 shimmer-wave" />
          <div className="h-7 w-24 rounded-lg bg-slate-100 shimmer-wave" />
          <div className="h-7 w-28 rounded-lg bg-slate-100 shimmer-wave" />
          <div className="h-7 w-24 rounded-lg bg-slate-100 shimmer-wave" />
        </div>
      )}

      {/* Responsive Filter Inputs Grid */}
      <div className={`grid ${gridClassMap[columns] || gridClassMap[4]} gap-3.5 items-end`}>
        {Array.from({ length: columns }).map((_, idx) => (
          <div
            key={`filter-field-skel-${idx}`}
            className={`w-full space-y-1.5 ${
              columns === 5 && idx === 0 ? 'sm:col-span-2 lg:col-span-1' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`h-3 ${labelWidths[idx % labelWidths.length]} rounded shimmer-wave`} />
              <div className="h-3.5 w-12 rounded bg-slate-100 border border-slate-200/60 shimmer-wave" />
            </div>
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 shimmer-wave" />
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * 5. Shared Table Pagination Footer Skeleton
 * Pixel-matched to <TablePaginationCard />
 */
export const SkeletonPaginationCard = memo(function SkeletonPaginationCard() {
  return (
    <div
      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4 mt-4"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <div className="h-3.5 w-28 rounded shimmer-wave" />
        <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 gap-1">
          <div className="h-6 w-10 rounded-md shimmer-wave" />
          <div className="h-6 w-10 rounded-md shimmer-wave" />
          <div className="h-6 w-10 rounded-md shimmer-wave" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-20 rounded-xl shimmer-wave" />
        <div className="h-3.5 w-24 rounded shimmer-wave" />
        <div className="h-8 w-20 rounded-xl shimmer-wave" />
      </div>
    </div>
  );
});

export interface SkeletonDataGridProps {
  columns: SkeletonColumnSpec[];
  rowsCount?: number;
  minWidth?: string;
  hasPagination?: boolean;
  hasRowNumber?: boolean;
  /** Optional top view-mode bar inside or above the table (e.g. Entrepot Components/Parts tabs or Preventive Matrix/List tabs) */
  topTabsCount?: number;
}

/**
 * 6. Shared Industrial DataGrid Skeleton
 * Pixel-matched to <GmaoIndustrialDataGrid />:
 * - Top Excel mapping info header (px-5 py-3 bg-slate-50/70 border-b)
 * - Exact column headers & cell archetypes
 * - Integrated <SkeletonPaginationCard />
 */
export const SkeletonDataGrid = memo(function SkeletonDataGrid({
  columns,
  rowsCount = 7,
  minWidth = 'min-w-[900px]',
  hasPagination = true,
  hasRowNumber = true,
  topTabsCount = 0,
}: SkeletonDataGridProps) {
  const defaultCodeWidths = ['w-20', 'w-24', 'w-18', 'w-22', 'w-24', 'w-20', 'w-26', 'w-22'];
  const defaultTextWidths = ['w-44', 'w-52', 'w-40', 'w-48', 'w-56', 'w-44', 'w-50', 'w-46'];
  const defaultSubWidths = ['w-28', 'w-36', 'w-24', 'w-32', 'w-30', 'w-28', 'w-34', 'w-26'];
  const defaultBadgeWidths = ['w-20', 'w-24', 'w-16', 'w-22', 'w-20', 'w-24', 'w-18', 'w-22'];
  const defaultNumWidths = ['w-10', 'w-12', 'w-8', 'w-14', 'w-10', 'w-8', 'w-12', 'w-10'];

  return (
    <div className="space-y-4 w-full min-w-0" aria-hidden="true">
      {topTabsCount > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 overflow-x-auto">
            {Array.from({ length: topTabsCount }).map((_, idx) => (
              <div
                key={`grid-toptab-${idx}`}
                className={`h-8 ${idx === 0 ? 'w-40' : 'w-36'} rounded-xl shrink-0 ${
                  idx === 0
                    ? 'bg-slate-800/10 border border-slate-300 shimmer-wave'
                    : 'bg-slate-100 shimmer-wave'
                }`}
              />
            ))}
          </div>
          <div className="h-6 w-40 rounded-lg shimmer-wave hidden sm:block" />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Table Top Info Header (Excel Mapping Banner) */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/70 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-60 rounded shimmer-wave" />
          </div>
          <div className="h-3 w-72 rounded hidden lg:block shimmer-wave" />
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs border-collapse ${minWidth}`}>
            <thead className="bg-slate-100 text-[10.5px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <tr>
                {hasRowNumber && (
                  <th className="py-3 px-3 text-center w-12 bg-slate-200/60 border-r border-slate-200 shrink-0">
                    <div className="h-3 w-4 rounded mx-auto shimmer-wave" />
                  </th>
                )}
                {columns.map((col, cIdx) => {
                  const alignClass =
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                        ? 'text-right'
                        : 'text-left';
                  const innerAlign =
                    col.align === 'center'
                      ? 'mx-auto'
                      : col.align === 'right'
                        ? 'ml-auto'
                        : '';
                  return (
                    <th
                      key={`skel-th-${cIdx}`}
                      className={`py-3 px-3.5 ${alignClass} ${col.colClass || ''}`}
                    >
                      <div className={`h-3 ${col.headerW || 'w-24'} rounded shimmer-wave ${innerAlign}`} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: rowsCount }).map((_, rIdx) => (
                <tr key={`skel-tr-${rIdx}`} className="even:bg-slate-50/60 odd:bg-white">
                  {hasRowNumber && (
                    <td className="py-3 px-3 text-center bg-slate-50/40 border-r border-slate-100 shrink-0">
                      <div className="h-3.5 w-5 rounded mx-auto shimmer-wave" />
                    </td>
                  )}
                  {columns.map((col, cIdx) => {
                    const primaryW =
                      col.rowWidths?.[rIdx % col.rowWidths.length] ||
                      (col.type === 'code'
                        ? defaultCodeWidths[rIdx % defaultCodeWidths.length]
                        : col.type === 'badge' || col.type === 'dual-badge'
                          ? defaultBadgeWidths[rIdx % defaultBadgeWidths.length]
                          : col.type === 'number'
                            ? defaultNumWidths[rIdx % defaultNumWidths.length]
                            : defaultTextWidths[rIdx % defaultTextWidths.length]);

                    const subW =
                      col.subWidths?.[rIdx % col.subWidths.length] ||
                      defaultSubWidths[rIdx % defaultSubWidths.length];

                    const alignClass =
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                          ? 'text-right'
                          : 'text-left';
                    const blockAlign =
                      col.align === 'center'
                        ? 'mx-auto'
                        : col.align === 'right'
                          ? 'ml-auto'
                          : '';

                    return (
                      <td key={`skel-td-${rIdx}-${cIdx}`} className={`py-3 px-3.5 ${alignClass}`}>
                        {col.type === 'code' && (
                          <div className={`h-5 ${primaryW} rounded-md font-mono shimmer-wave ${blockAlign}`} />
                        )}
                        {col.type === 'badge' && (
                          <div className={`h-5.5 ${primaryW} rounded-full shimmer-wave ${blockAlign}`} />
                        )}
                        {col.type === 'dual-badge' && (
                          <div className={`flex items-center gap-1.5 flex-wrap ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}>
                            <div className={`h-5 ${primaryW} rounded-md shimmer-wave`} />
                            <div className={`h-5 ${subW} rounded-md shimmer-wave`} />
                          </div>
                        )}
                        {col.type === 'number' && (
                          <div className={`h-5 ${primaryW} rounded-md font-mono shimmer-wave ${blockAlign}`} />
                        )}
                        {col.type === 'double' && (
                          <div className="space-y-1.5">
                            <div className={`h-3.5 ${primaryW} max-w-[92%] rounded shimmer-wave ${blockAlign}`} />
                            <div className={`h-2.5 ${subW} max-w-[75%] rounded shimmer-wave ${blockAlign}`} />
                          </div>
                        )}
                        {col.type === 'triple' && (
                          <div className="space-y-1.5">
                            <div className={`h-3.5 ${primaryW} max-w-[92%] rounded shimmer-wave ${blockAlign}`} />
                            <div className={`h-2.5 ${subW} max-w-[75%] rounded shimmer-wave ${blockAlign}`} />
                            <div className={`h-4 w-16 rounded-full shimmer-wave ${blockAlign}`} />
                          </div>
                        )}
                        {col.type === 'avatar-double' && (
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg shimmer-wave shrink-0" />
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className={`h-3.5 ${primaryW} max-w-[90%] rounded shimmer-wave`} />
                              <div className={`h-2.5 ${subW} max-w-[70%] rounded shimmer-wave`} />
                            </div>
                          </div>
                        )}
                        {col.type === 'actions' && (
                          <div
                            className={`flex items-center gap-1.5 ${
                              col.align === 'right'
                                ? 'justify-end'
                                : col.align === 'center'
                                  ? 'justify-center'
                                  : 'justify-start'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-lg shimmer-wave shrink-0" />
                            <div className="w-7 h-7 rounded-lg shimmer-wave shrink-0" />
                          </div>
                        )}
                        {(!col.type || col.type === 'text') && (
                          <div className={`h-4 ${primaryW} max-w-[90%] rounded shimmer-wave ${blockAlign}`} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {hasPagination && <SkeletonPaginationCard />}
    </div>
  );
});

export interface SkeletonL1PageProps {
  header?: SkeletonPageHeaderProps;
  kpiColumns?: 4 | 5;
  kpiCards?: SkeletonKpiCardProps[];
  filter?: SkeletonFilterCardProps;
  grid: SkeletonDataGridProps;
}

/**
 * 7. Complete L1 Operational Page Skeleton Package
 * Combines: Header + 4/5-Card Mature Light Excel KPI Grid + Industrial Filter Card + Industrial DataGrid
 */
export const SkeletonL1Page = memo(function SkeletonL1Page({
  header,
  kpiColumns = 4,
  kpiCards,
  filter,
  grid,
}: SkeletonL1PageProps) {
  return (
    <div className="space-y-5 w-full min-w-0 select-none" aria-hidden="true">
      <SkeletonPageHeader {...header} />
      <SkeletonKpiGrid columns={kpiColumns} cards={kpiCards} />
      <SkeletonFilterCard {...filter} />
      <SkeletonDataGrid {...grid} />
    </div>
  );
});

export interface SkeletonL2PageProps {
  header?: SkeletonPageHeaderProps;
  /** Optional KPI Grid for L2 pages that include summary cards (e.g. BlueprintMachineView) */
  kpiColumns?: 4 | 5;
  kpiCards?: SkeletonKpiCardProps[];
  filter?: SkeletonFilterCardProps;
  grid: SkeletonDataGridProps;
}

/**
 * 8. Complete L2 Referentiel / Engineering Page Skeleton Package
 * Combines: Header + (Optional KPI Grid) + Industrial Filter Card + Industrial DataGrid
 */
export const SkeletonL2Page = memo(function SkeletonL2Page({
  header,
  kpiColumns,
  kpiCards,
  filter,
  grid,
}: SkeletonL2PageProps) {
  return (
    <div className="space-y-4 w-full min-w-0 select-none" aria-hidden="true">
      <SkeletonPageHeader {...header} />
      {kpiColumns && <SkeletonKpiGrid columns={kpiColumns} cards={kpiCards} />}
      <SkeletonFilterCard {...filter} />
      <SkeletonDataGrid {...grid} />
    </div>
  );
});
