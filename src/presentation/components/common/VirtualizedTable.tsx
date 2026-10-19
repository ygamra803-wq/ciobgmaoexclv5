import React, { useMemo, useRef } from 'react';
import { List } from 'react-window';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * مكون جدول ذكي افتراضي (Virtualized Table) لتحمل عشرات آلاف السجلات بسلاسة 60fps
 * يدعم محركين:
 * - `@tanstack/react-virtual` (عند `useTanStack = true` أو `VITE_USE_TANSTACK_VIRTUAL = 'true'`) مع دعم التمرير الأفقي والعمودي الذكي
 * - `react-window` v2 (`rowCount`, `rowHeight`, `rowComponent`, `rowProps`) للتوافق القياسي
 */
export function VirtualizedTable({
  items,
  data,
  columns = [],
  itemHeight = 48,
  rowHeight,
  renderRow,
  header = null,
  maxHeight = 600,
  height,
  startIndex = 0,
  showRowNumber = false,
  onRowClick,
  emptyMessage = 'Aucun enregistrement trouvé',
  className = '',
  useTanStack,
  overscanCount = 6,
}: any) {
  const dataset = useMemo(() => items || data || [], [items, data]);
  const effectiveRowHeight = Number(rowHeight || itemHeight || 48);
  const effectiveMaxHeight = Number(height || maxHeight || 560);
  const parentRef = useRef<HTMLDivElement | null>(null);

  const shouldUseTanStack = useMemo(() => {
    if (typeof useTanStack === 'boolean') return useTanStack;
    try {
      return import.meta.env?.VITE_USE_TANSTACK_VIRTUAL === 'true';
    } catch {
      return false;
    }
  }, [useTanStack]);

  const calculatedHeight = useMemo(() => {
    if (!dataset.length) return 150;
    return Math.min(Math.max(dataset.length * effectiveRowHeight, 120), effectiveMaxHeight);
  }, [dataset.length, effectiveRowHeight, effectiveMaxHeight]);

  const rowVirtualizer = useVirtualizer({
    count: dataset.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => effectiveRowHeight,
    overscan: overscanCount,
    enabled: shouldUseTanStack && dataset.length > 0,
  });

  const renderSingleRowContent = (item: any, index: number, style: React.CSSProperties = {}, ariaAttributes: Record<string, any> = {}) => {
    if (!item) return null;
    const rowNumber = startIndex + index + 1;

    if (typeof renderRow === 'function') {
      const rendered = renderRow({ item, index, style, rowNumber });
      if (React.isValidElement(rendered) && rendered.type === 'tr') {
        const renderedProps = rendered.props as any;
        const childrenArray = React.Children.toArray(renderedProps.children);
        return (
          <div
            {...ariaAttributes}
            style={style}
            onClick={renderedProps.onClick}
            onContextMenu={renderedProps.onContextMenu}
            className={`flex items-center w-full box-border ${renderedProps.className || 'border-b border-slate-100'}`}
          >
            {childrenArray.map((tdChild: any, cIdx: number) => {
              if (!React.isValidElement(tdChild)) return tdChild;
              const tdProps = tdChild.props as any;
              const colSpan = tdProps.colSpan;
              const isRowNumCell = showRowNumber && cIdx === 0;
              const colDef = showRowNumber ? columns[cIdx - 1] : columns[cIdx];
              const flexStyle = isRowNumCell
                ? { width: 48, flexShrink: 0 }
                : colSpan && colSpan > 1
                ? { flex: colSpan }
                : colDef?.width
                ? { width: colDef.width, flexShrink: 0 }
                : { flex: 1, minWidth: 0 };

              return (
                <div
                  key={tdChild.key || cIdx}
                  style={flexStyle}
                  className={`truncate ${tdProps.className || 'px-3 py-2 text-xs'}`}
                  title={tdProps.title}
                >
                  {tdProps.children}
                </div>
              );
            })}
          </div>
        );
      }
      return (
        <div {...ariaAttributes} style={style} className="w-full box-border">
          {rendered}
        </div>
      );
    }

    const isEven = index % 2 === 0;
    return (
      <div
        {...ariaAttributes}
        style={style}
        onClick={() => onRowClick && onRowClick(item)}
        className={`flex items-center border-b border-slate-100 transition-colors text-xs ${
          onRowClick ? 'cursor-pointer hover:bg-indigo-50/40' : ''
        } ${isEven ? 'bg-white' : 'bg-slate-50/60'}`}
      >
        {showRowNumber && (
          <div className="w-12 py-2.5 px-3 text-center text-slate-400 font-mono text-[10px] bg-slate-50/40 border-r border-slate-100 shrink-0 select-none">
            {rowNumber}
          </div>
        )}
        {columns.length > 0 ? (
          columns.map((col: any, cIdx: number) => {
            const cellContent =
              typeof col.render === 'function'
                ? col.render(item, index, rowNumber)
                : item[col.key] !== undefined && item[col.key] !== null
                ? String(item[col.key])
                : '—';

            const alignClass =
              col.align === 'center'
                ? 'justify-center text-center'
                : col.align === 'right'
                ? 'justify-end text-right'
                : 'justify-start text-left';

            return (
              <div
                key={col.key || cIdx}
                style={{
                  width: col.width || `${100 / columns.length}%`,
                  minWidth: 0,
                }}
                className={`px-3.5 py-2.5 truncate flex items-center ${alignClass} ${col.cellClassName || ''}`}
              >
                {cellContent}
              </div>
            );
          })
        ) : (
          <div className="px-4 py-2 truncate text-slate-700">{JSON.stringify(item)}</div>
        )}
      </div>
    );
  };

  // Row renderer compatible with react-window v2
  const RowComponent = ({ index, style, ariaAttributes }: any) => {
    const item = dataset[index];
    return renderSingleRowContent(item, index, style, ariaAttributes);
  };

  if (!dataset || dataset.length === 0) {
    return (
      <div className={`w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs ${className}`}>
        {header}
        <div className="py-12 text-center text-slate-400 font-medium text-xs">
          {emptyMessage}
        </div>
      </div>
    );
  }

  if (shouldUseTanStack) {
    return (
      <div className={`w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs ${className}`}>
        {header && <div className="border-b border-slate-200 bg-slate-100">{header}</div>}
        <div
          ref={parentRef}
          style={{ height: calculatedHeight, overflow: 'auto' }}
          className="w-full"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = dataset[virtualRow.index];
              const rowStyle: React.CSSProperties = {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              };
              return (
                <React.Fragment key={virtualRow.key}>
                  {renderSingleRowContent(item, virtualRow.index, rowStyle)}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs ${className}`}>
      {header && <div className="border-b border-slate-200 bg-slate-100">{header}</div>}
      <div className="w-full overflow-x-auto">
        <List
          rowComponent={RowComponent}
          rowCount={dataset.length}
          rowHeight={effectiveRowHeight}
          rowProps={{}}
          overscanCount={overscanCount}
          defaultHeight={calculatedHeight}
          style={{ height: calculatedHeight, width: '100%' }}
        />
      </div>
    </div>
  );
}

export default VirtualizedTable;
