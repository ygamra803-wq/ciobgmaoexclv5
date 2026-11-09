import { memo } from 'react';

/**
 * TableSkeletonRows
 * Monochromatic, pure slate/gray/white skeleton rows for table bodies.
 * Provides a serene, calm loading skeleton matching real table column alignments.
 */
function TableSkeletonRowsComponent({
  cols = 12,
  columnsCount,
  rows = 8,
}: {
  cols?: number;
  columnsCount?: number;
  rows?: number;
  color?: string;
  [key: string]: any;
}) {
  const effectiveCols = columnsCount ?? cols;
  const shimmerClass = 'shimmer-wave';
  const textWidths = ['w-28', 'w-36', 'w-44', 'w-32', 'w-40'];

  if (effectiveCols === 7) {
    return (
      <>
        {[...Array(rows)].map((_, rIdx) => (
          <tr
            key={`table-skel-row-7-${rIdx}`}
            className="even:bg-slate-50/60 odd:bg-white transition-opacity duration-300 border-b border-slate-100"
          >
            {/* Ref */}
            <td className="py-3 px-3.5">
              <div className={`h-4 w-20 rounded font-mono ${shimmerClass}`} />
            </td>
            {/* Désignation */}
            <td className="py-3 px-3.5">
              <div
                className={`h-4 ${textWidths[rIdx % textWidths.length]} max-w-[90%] rounded ${shimmerClass}`}
              />
            </td>
            {/* Stock Actuel */}
            <td className="py-3 px-2 text-right">
              <div className={`h-4 w-8 rounded ml-auto font-mono ${shimmerClass}`} />
            </td>
            {/* Seuil */}
            <td className="py-3 px-2 text-right">
              <div className={`h-4 w-8 rounded ml-auto font-mono ${shimmerClass}`} />
            </td>
            {/* État */}
            <td className="py-3 px-3 text-center">
              <div className={`h-5 w-16 rounded-full mx-auto ${shimmerClass}`} />
            </td>
            {/* Emplacement */}
            <td className="py-3 px-3">
              <div className={`h-4 w-14 rounded font-mono ${shimmerClass}`} />
            </td>
            {/* Actions Rapides */}
            <td className="py-3 px-3 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <div className={`w-7 h-7 rounded-full ${shimmerClass}`} />
                <div className={`h-6 w-14 rounded-lg ${shimmerClass}`} />
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <>
      {[...Array(rows)].map((_, rIdx) => (
        <tr
          key={`table-skel-row-${rIdx}`}
          className="even:bg-slate-50/60 odd:bg-white transition-opacity duration-300 border-b border-slate-100"
        >
          {/* Row index / N° column */}
          <td className="py-2.5 px-3 text-center border-r border-slate-100 bg-slate-50/40 w-12">
            <div className={`h-3 w-5 mx-auto rounded ${shimmerClass}`} />
          </td>

          {/* Ref column */}
          <td className="py-2.5 px-3.5">
            <div className={`h-4 w-24 rounded ${shimmerClass}`} />
          </td>

          {/* Designation column */}
          <td className="py-2.5 px-3.5 min-w-[180px]">
            <div
              className={`h-4 ${textWidths[rIdx % textWidths.length]} max-w-[90%] rounded ${shimmerClass}`}
            />
          </td>

          {/* Type column (Pill) */}
          <td className="py-2.5 px-3">
            <div className={`h-5 w-20 rounded-lg ${shimmerClass}`} />
          </td>

          {/* Initial (E) */}
          <td className="py-2.5 px-2.5 text-right">
            <div className={`h-4 w-8 rounded ml-auto ${shimmerClass}`} />
          </td>

          {/* Entrées (F) */}
          <td className="py-2.5 px-2.5 text-right">
            <div className={`h-4 w-8 rounded ml-auto ${shimmerClass}`} />
          </td>

          {/* Sorties (G) */}
          <td className="py-2.5 px-2.5 text-right">
            <div className={`h-4 w-8 rounded ml-auto ${shimmerClass}`} />
          </td>

          {/* Actuel (H) */}
          <td className="py-2.5 px-2.5 text-right">
            <div className={`h-4 w-10 rounded ml-auto ${shimmerClass}`} />
          </td>

          {/* Seuil (I) */}
          <td className="py-2.5 px-2.5 text-right">
            <div className={`h-4 w-8 rounded ml-auto ${shimmerClass}`} />
          </td>

          {/* Alerte (J - Pill) */}
          <td className="py-2.5 px-3 text-center">
            <div className={`h-5 w-16 rounded-full mx-auto ${shimmerClass}`} />
          </td>

          {/* Emplacement (K) */}
          <td className="py-2.5 px-3.5">
            <div className={`h-4 w-16 rounded ${shimmerClass}`} />
          </td>

          {/* Actions & Flux */}
          <td className="py-2.5 px-3.5 text-center min-w-[130px]">
            <div className={`h-6 w-20 rounded-lg mx-auto ${shimmerClass}`} />
          </td>
        </tr>
      ))}
    </>
  );
}

export const TableSkeletonRows = memo(TableSkeletonRowsComponent);
export default TableSkeletonRows;

