import { isValidElement, useState, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox, Zap } from 'lucide-react';
import { List } from 'react-window';
import { useVirtualizer } from '@tanstack/react-virtual';
import TableSkeletonRows from './TableSkeletonRows';
import TablePaginationCard from './TablePaginationCard';
import { useI18n } from '../../../i18n/I18nContext';

/**
 * 🏛️ GMAO Industrial Data Grid (Unified Master Table Component)
 * Conforme à la Constitution GMAO : Composant unifié pour toutes les grilles
 * de données industrielles (Stock, Machines, Entrepôt, Référentiel, Interventions).
 * 
 * Garantit:
 * 1. Présentation 3D unifiée avec ombrage et bordures industrielles
 * 2. Bandeau d'information et mappage officiel des colonnes Excel (A → Z)
 * 3. En-tête figé (Sticky thead) avec tri dynamique et numérotation des lignes
 * 4. Gestion automatique du chargement (Skeletons) et de l'état vide
 * 5. Intégration transparente de la carte de pagination (TablePaginationCard)
 * 6. Virtual Scrolling (Windowing) haute performance (60fps) pour 10 000+ enregistrements
 * 7. Support triple moteur : '@tanstack/react-virtual' + 'table-window' natif + 'react-window' optionnel
 */
export default function GmaoIndustrialDataGrid({
  title = '',
  icon = null,
  excelMapping = '',
  bannerColor = 'slate',
  headerRight = null,
  columns = [],
  data = [],
  isLoading = false,
  loadingRowsCount = 8,
  sortField = '',
  sortOrder = 'asc',
  onSort = null,
  renderSortIcon = null,
  startIndex = 0,
  showRowNumber = true,
  minWidth = 'min-w-[980px]',
  maxHeight = 'max-h-[62vh]',
  emptyMessage = '',
  emptyIcon = null,
  emptyAction = null,
  renderRow = null,
  pagination = null,
  tableClassName = '',
  containerClassName = '',
  virtualized,
  virtualThreshold = 35,
  rowHeight = 52,
  overscanCount = 8,
  useReactWindow = false,
  useTanStack,
}) {
  const { t } = useI18n();
  const scrollContainerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(500);

  // Automatic or explicit virtualization activation for large datasets (> virtualThreshold rows)
  const isVirtualized = useMemo(() => {
    if (typeof virtualized === 'boolean') return virtualized;
    return Array.isArray(data) && data.length > virtualThreshold;
  }, [virtualized, data, virtualThreshold]);

  const shouldUseTanStack = useMemo(() => {
    if (typeof useTanStack === 'boolean') return useTanStack;
    try {
      return import.meta.env?.VITE_USE_TANSTACK_VIRTUAL !== 'false';
    } catch {
      return true;
    }
  }, [useTanStack]);

  const effectiveRowHeight = typeof rowHeight === 'number' ? rowHeight : 52;

  const tanstackVirtualizer = useVirtualizer({
    count: Array.isArray(data) ? data.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => effectiveRowHeight,
    overscan: overscanCount,
    enabled: Boolean(isVirtualized && shouldUseTanStack && !useReactWindow),
  });

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !isVirtualized) return;

    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setViewportHeight(el.clientHeight);
      }
    };
    updateHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [isVirtualized, data?.length]);

  // Reset scroll offset on page, sort, or data reset
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [startIndex, sortField, sortOrder]);

  const handleScroll = (e) => {
    if (isVirtualized && !shouldUseTanStack) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  };

  // Calculate visible window slice + top/bottom spacer heights (via TanStack Virtual or fallback slice)
  const virtualWindow = useMemo(() => {
    const totalCount = Array.isArray(data) ? data.length : 0;
    if (!isVirtualized || totalCount === 0 || useReactWindow) {
      return {
        visibleData: data || [],
        startOffsetIndex: 0,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }

    if (shouldUseTanStack) {
      const virtualItems = tanstackVirtualizer.getVirtualItems();
      if (virtualItems.length > 0) {
        const firstItem = virtualItems[0];
        const lastItem = virtualItems[virtualItems.length - 1];
        const startOffsetIndex = firstItem.index;
        const endOffsetIndex = lastItem.index + 1;
        const topSpacerHeight = firstItem.start;
        const bottomSpacerHeight = Math.max(0, tanstackVirtualizer.getTotalSize() - lastItem.end);

        return {
          visibleData: data.slice(startOffsetIndex, endOffsetIndex),
          startOffsetIndex,
          topSpacerHeight,
          bottomSpacerHeight,
        };
      }
    }

    const rawStart = Math.floor(scrollTop / effectiveRowHeight);
    const visibleCount = Math.ceil(viewportHeight / effectiveRowHeight);
    const startOffsetIndex = Math.max(0, rawStart - overscanCount);
    const endOffsetIndex = Math.min(totalCount, rawStart + visibleCount + overscanCount);

    const topSpacerHeight = startOffsetIndex * effectiveRowHeight;
    const bottomSpacerHeight = Math.max(0, (totalCount - endOffsetIndex) * effectiveRowHeight);

    return {
      visibleData: data.slice(startOffsetIndex, endOffsetIndex),
      startOffsetIndex,
      topSpacerHeight,
      bottomSpacerHeight,
    };
  }, [
    isVirtualized,
    data,
    scrollTop,
    viewportHeight,
    effectiveRowHeight,
    overscanCount,
    useReactWindow,
    shouldUseTanStack,
    tanstackVirtualizer,
  ]);

  const bannerColorStyles = {
    indigo: 'bg-indigo-50/40 text-indigo-950 text-slate-500 border-indigo-100/60',
    blue: 'bg-blue-50/40 text-blue-950 text-slate-500 border-blue-100/60',
    emerald: 'bg-emerald-50/40 text-emerald-950 text-slate-500 border-emerald-100/60',
    amber: 'bg-amber-50/40 text-amber-950 text-slate-500 border-amber-100/60',
    purple: 'bg-purple-50/40 text-purple-950 text-slate-500 border-purple-100/60',
    slate: 'bg-slate-50/80 text-slate-800 text-slate-500 border-slate-200/80',
  };

  const defaultRenderSortIcon = (field) => {
    if (!field || sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-600 font-bold shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600 font-bold shrink-0" />
    );
  };

  const sortIconRenderer = renderSortIcon || defaultRenderSortIcon;

  const renderBannerIcon = (ic) => {
    if (!ic) return null;
    if (isValidElement(ic)) return ic;
    const IconComponent = ic;
    return <IconComponent className="w-4 h-4 text-current shrink-0" />;
  };

  const renderColumnIcon = (ic) => {
    if (!ic) return null;
    if (isValidElement(ic)) return ic;
    const IconComponent = ic;
    return <IconComponent className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  const totalCols = columns.length + (showRowNumber ? 1 : 0);
  const resolvedEmptyMessage = emptyMessage || t('common.empty_message', 'Aucun enregistrement trouvé');

  // React-Window Row Component when useReactWindow is activated
  const ReactWindowRow = ({ index, style, ariaAttributes }) => {
    const item = data[index];
    if (!item) return null;
    const rowNumber = startIndex + index + 1;

    if (typeof renderRow === 'function') {
      const rendered = renderRow(item, index, rowNumber);
      return (
        <div {...ariaAttributes} style={style} className="w-full flex items-center box-border">
          {rendered}
        </div>
      );
    }

    const rowKey = item.id || item.ref || item.id_warehouse_item || item.code || index;
    return (
      <div
        {...ariaAttributes}
        key={rowKey}
        style={style}
        className="flex items-center w-full border-b border-slate-100 hover:bg-slate-50/80 transition-colors duration-150 text-xs box-border"
      >
        {showRowNumber && (
          <div className="w-12 py-3 px-3 text-center text-slate-400 font-mono text-[10px] bg-slate-50/40 border-r border-slate-100 shrink-0 select-none">
            {rowNumber}
          </div>
        )}
        {columns.map((col) => {
          const colStyle = col.width ? { width: col.width, flexShrink: 0 } : { flex: 1, minWidth: 0 };
          return (
            <div
              key={col.key}
              style={colStyle}
              className={`py-3 px-3.5 truncate ${
                col.align === 'center'
                  ? 'text-center'
                  : col.align === 'right'
                  ? 'text-right'
                  : 'text-left'
              } ${col.cellClassName || ''}`}
            >
              {typeof col.render === 'function' ? col.render(item, index, rowNumber) : item[col.key]}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`space-y-4 animate-view-transition ${containerClassName}`}>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out">
        {/* Top Header / Info Banner */}
        {(title || excelMapping || headerRight) && (
          <div
            className={`px-5 py-3 border-b flex flex-wrap items-center justify-between text-xs gap-3 ${
              bannerColorStyles[bannerColor] || bannerColorStyles.slate
            }`}
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              {renderBannerIcon(icon)}
              {title && <span className="font-bold tracking-tight">{title}</span>}
              {excelMapping && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700 shadow-2xs font-semibold">
                  {excelMapping}
                </span>
              )}
              {isVirtualized && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                  <Zap className="w-3 h-3 text-emerald-600" />
                  <span>Virtual 60fps</span>
                </span>
              )}
            </div>

            {headerRight && (
              <div className="flex items-center gap-2 ml-auto text-xs">{headerRight}</div>
            )}
          </div>
        )}

        {/* Scrollable Table Viewport */}
        {useReactWindow && isVirtualized && !isLoading && data.length > 0 ? (
          <div className={`${maxHeight} overflow-x-auto`}>
            {/* Sticky Column Headers for react-window mode */}
            <div className={`sticky top-0 bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 z-10 shadow-2xs select-none flex items-center ${minWidth}`}>
              {showRowNumber && (
                <div className="py-3 px-3 text-center w-12 text-slate-500 font-mono text-[10px] bg-slate-200/60 border-r border-slate-200 shrink-0 select-none">
                  N°
                </div>
              )}
              {columns.map((col) => {
                const isSortable = Boolean(col.sortable && onSort);
                const colStyle = col.width ? { width: col.width, flexShrink: 0 } : { flex: 1, minWidth: 0 };
                const HeaderIcon = col.icon;
                return (
                  <div
                    key={col.key}
                    style={colStyle}
                    onClick={() => isSortable && onSort(col.key)}
                    className={`py-3 px-3.5 select-none transition ${isSortable ? 'cursor-pointer hover:bg-slate-200/80 group' : ''} ${col.headerClassName || ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {renderColumnIcon(HeaderIcon)}
                      <span>{col.label}</span>
                      {col.colLetter && (
                        <span className="text-slate-400 font-normal text-[10px]">({col.colLetter})</span>
                      )}
                      {isSortable && sortIconRenderer(col.key)}
                    </div>
                  </div>
                );
              })}
            </div>

            <List
              rowCount={data.length}
              rowHeight={effectiveRowHeight}
              rowComponent={ReactWindowRow}
              rowProps={{ data, columns, renderRow, startIndex, showRowNumber }}
              style={{ height: Math.min(viewportHeight, 520), width: '100%' }}
            />
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={`${maxHeight} overflow-y-auto overflow-x-auto`}
          >
            <table className={`w-full text-left text-xs border-collapse ${minWidth} ${tableClassName}`}>
              {/* Sticky Table Header */}
              <thead className="sticky top-0 bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 z-10 shadow-2xs select-none">
                <tr>
                  {showRowNumber && (
                    <th className="py-3 px-3 text-center w-12 text-slate-500 font-mono text-[10px] bg-slate-200/60 border-r border-slate-200 shrink-0 select-none">
                      N°
                    </th>
                  )}

                  {columns.map((col) => {
                    const isSortable = Boolean(col.sortable && onSort);
                    const alignmentClass =
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                        ? 'text-right'
                        : 'text-left';

                    const justifyClass =
                      col.align === 'center'
                        ? 'justify-center'
                        : col.align === 'right'
                        ? 'justify-end'
                        : 'justify-start';

                    const HeaderIcon = col.icon;

                    return (
                      <th
                        key={col.key}
                        onClick={() => isSortable && onSort(col.key)}
                        className={`py-3 px-3.5 select-none transition ${alignmentClass} ${
                          isSortable ? 'cursor-pointer hover:bg-slate-200/80 group' : ''
                        } ${col.headerClassName || ''}`}
                        title={isSortable ? `${t('common.filters.sort_by', 'Trier par')} ${typeof col.label === 'string' ? col.label : col.key}` : undefined}
                      >
                        <div className={`flex items-center gap-1.5 ${justifyClass}`}>
                          {renderColumnIcon(HeaderIcon)}
                          <span>{col.label}</span>
                          {col.colLetter && (
                            <span className="text-slate-400 font-normal text-[10px]">
                              ({col.colLetter})
                            </span>
                          )}
                          {isSortable && sortIconRenderer(col.key)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <TableSkeletonRows rows={loadingRowsCount} columnsCount={totalCols} />
                ) : !data || data.length === 0 ? (
                  <tr>
                    <td colSpan={totalCols} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        {emptyIcon || <Inbox className="w-8 h-8 text-slate-300 stroke-1" />}
                        <span className="font-semibold text-xs text-slate-500">{resolvedEmptyMessage}</span>
                        {emptyAction}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Top Spacer Row */}
                    {isVirtualized && virtualWindow.topSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: virtualWindow.topSpacerHeight }} className="border-0 p-0 m-0 select-none">
                        <td colSpan={totalCols} style={{ height: virtualWindow.topSpacerHeight, padding: 0, border: 0, margin: 0, lineHeight: 0 }} />
                      </tr>
                    )}

                    {virtualWindow.visibleData.map((item, localIdx) => {
                      const index = virtualWindow.startOffsetIndex + localIdx;
                      const rowNumber = startIndex + index + 1;
                      if (typeof renderRow === 'function') {
                        return renderRow(item, index, rowNumber);
                      }

                      const rowKey = item.id || item.ref || item.id_warehouse_item || item.code || index;

                      return (
                        <tr
                          key={rowKey}
                          className="hover:bg-slate-50/80 transition-colors duration-150 group"
                        >
                          {showRowNumber && (
                            <td className="py-3 px-3 text-center text-slate-400 font-mono text-[10px] bg-slate-50/40 border-r border-slate-100 shrink-0 select-none">
                              {rowNumber}
                            </td>
                          )}
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className={`py-3 px-3.5 ${
                                col.align === 'center'
                                  ? 'text-center'
                                  : col.align === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              } ${col.cellClassName || ''}`}
                            >
                              {typeof col.render === 'function'
                                ? col.render(item, index, rowNumber)
                                : item[col.key]}
                            </td>
                          ))}
                        </tr>
                      );
                    })}

                    {/* Bottom Spacer Row */}
                    {isVirtualized && virtualWindow.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: virtualWindow.bottomSpacerHeight }} className="border-0 p-0 m-0 select-none">
                        <td colSpan={totalCols} style={{ height: virtualWindow.bottomSpacerHeight, padding: 0, border: 0, margin: 0, lineHeight: 0 }} />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Built-in Table Pagination Footer */}
      {pagination && (
        <TablePaginationCard
          currentPage={pagination.currentPage}
          setCurrentPage={pagination.setCurrentPage}
          pageSize={pagination.pageSize}
          setPageSize={pagination.setPageSize}
          totalItems={pagination.totalItems}
          pageSizeOptions={pagination.pageSizeOptions || [25, 50, 100, 200, 0]}
          color={pagination.color || bannerColor}
          itemLabel={pagination.itemLabel || 'enregistrements'}
        />
      )}
    </div>
  );
}

export function VirtualizedIndustrialDataGrid(props) {
  return <GmaoIndustrialDataGrid {...props} virtualized={true} useReactWindow={true} />;
}

GmaoIndustrialDataGrid.propTypes = {
  title: PropTypes.node,
  icon: PropTypes.node,
  excelMapping: PropTypes.string,
  bannerColor: PropTypes.oneOf(['indigo', 'blue', 'emerald', 'amber', 'purple', 'slate']),
  headerRight: PropTypes.node,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      colLetter: PropTypes.string,
      icon: PropTypes.oneOfType([PropTypes.elementType, PropTypes.node]),
      sortable: PropTypes.bool,
      align: PropTypes.oneOf(['left', 'center', 'right']),
      headerClassName: PropTypes.string,
      cellClassName: PropTypes.string,
      render: PropTypes.func,
    })
  ).isRequired,
  data: PropTypes.array,
  isLoading: PropTypes.bool,
  loadingRowsCount: PropTypes.number,
  sortField: PropTypes.string,
  sortOrder: PropTypes.string,
  onSort: PropTypes.func,
  renderSortIcon: PropTypes.func,
  startIndex: PropTypes.number,
  showRowNumber: PropTypes.bool,
  minWidth: PropTypes.string,
  maxHeight: PropTypes.string,
  emptyMessage: PropTypes.string,
  emptyIcon: PropTypes.node,
  emptyAction: PropTypes.node,
  renderRow: PropTypes.func,
  pagination: PropTypes.shape({
    currentPage: PropTypes.number.isRequired,
    setCurrentPage: PropTypes.func.isRequired,
    pageSize: PropTypes.number.isRequired,
    setPageSize: PropTypes.func.isRequired,
    totalItems: PropTypes.number.isRequired,
    pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
    color: PropTypes.string,
    itemLabel: PropTypes.string,
  }),
  tableClassName: PropTypes.string,
  containerClassName: PropTypes.string,
  virtualized: PropTypes.bool,
  virtualThreshold: PropTypes.number,
  rowHeight: PropTypes.number,
  overscanCount: PropTypes.number,
  useReactWindow: PropTypes.bool,
};
