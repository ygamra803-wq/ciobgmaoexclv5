import { memo } from 'react';

/**
 * DesignationSkeletonView
 * Dedicated, pixel-matched, monochromatic skeleton for the Désignations d'Articles PDR view.
 * Respects the exact layout, padding, borders, responsive breakpoints,
 * and column alignments of DesignationView using elegant slate/gray/white tones.
 */
function DesignationSkeletonViewComponent() {
  return (
    <div className="space-y-4 w-full min-w-0" aria-hidden="true">
      {/* ─── 1. Top Header Banner Skeleton (Mirroring BDR Light GMAO Header Card) ─── */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* Badge Icon (BadgeCheck Placeholder) */}
          <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200/90 shadow-2xs flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded-lg shimmer-wave" />
          </div>

          <div className="space-y-2 flex-1 max-w-3xl">
            {/* Title */}
            <div className="h-6 w-72 max-w-[85%] rounded-lg shimmer-wave" />
            {/* Subtitle */}
            <div className="space-y-1.5 pt-0.5">
              <div className="h-3 w-full max-w-2xl rounded shimmer-wave" />
            </div>
          </div>
        </div>

        {/* Right 3D Action Buttons (Formulas button & Add Designation button placeholders) */}
        <div className="flex items-center gap-2.5 shrink-0 relative">
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shimmer-wave" />
          <div className="w-10 h-10 rounded-full border border-slate-300 bg-slate-100 flex items-center justify-center shimmer-wave" />
        </div>
      </div>

      {/* ─── 2. Filter & Search Bar Skeleton ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-48 rounded shimmer-wave" />
          </div>
          <div className="h-6 w-36 rounded-lg shimmer-wave" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          {/* Field 1: Search */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded shimmer-wave" />
              <div className="h-3 w-14 rounded shimmer-wave" />
            </div>
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>

          {/* Field 2: Type Parente Filter */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 rounded shimmer-wave" />
              <div className="h-3 w-12 rounded shimmer-wave" />
            </div>
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>

          {/* Field 3: Sort Dropdown */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-36 rounded shimmer-wave" />
              <div className="h-3 w-14 rounded shimmer-wave" />
            </div>
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
        </div>
      </div>

      {/* ─── 3. Main Désignations Table Skeleton (8 Exact Columns) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Top Info Header Bar inside Card */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/70 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-64 rounded shimmer-wave" />
          </div>
          <div className="h-3 w-80 rounded hidden lg:block shimmer-wave" />
        </div>

        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 text-[10.5px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <tr>
                {/* 1. N° */}
                <th className="py-2.5 px-3 text-center w-12 bg-slate-200/60 border-r border-slate-200 shrink-0">
                  <div className="h-3 w-4 rounded mx-auto shimmer-wave" />
                </th>
                {/* 2. REF / ID (B) */}
                <th className="py-2.5 px-4"><div className="h-3 w-20 rounded shimmer-wave" /></th>
                {/* 3. DÉSIGNATION (C) primary */}
                <th className="py-2.5 px-4 min-w-[220px]"><div className="h-3 w-36 rounded shimmer-wave" /></th>
                {/* 4. TYPE (D) */}
                <th className="py-2.5 px-4"><div className="h-3 w-16 rounded shimmer-wave" /></th>
                {/* 5. STOCK ACTUEL (E) */}
                <th className="py-2.5 px-3 text-right"><div className="h-3 w-20 rounded ml-auto shimmer-wave" /></th>
                {/* 6. ÉTAT (F) */}
                <th className="py-2.5 px-3 text-center"><div className="h-3 w-14 rounded mx-auto shimmer-wave" /></th>
                {/* 7. EMPLACEMENT (G) */}
                <th className="py-2.5 px-4"><div className="h-3 w-24 rounded shimmer-wave" /></th>
                {/* 8. Action */}
                <th className="py-2.5 px-4 text-center"><div className="h-3 w-14 rounded mx-auto shimmer-wave" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { refW: 'w-24', desW: 'w-64', typW: 'w-20', stockW: 'w-8', alertW: 'w-14', locW: 'w-20' },
                { refW: 'w-28', desW: 'w-72', typW: 'w-24', stockW: 'w-10', alertW: 'w-16', locW: 'w-18' },
                { refW: 'w-22', desW: 'w-56', typW: 'w-18', stockW: 'w-8', alertW: 'w-14', locW: 'w-22' },
                { refW: 'w-26', desW: 'w-80', typW: 'w-22', stockW: 'w-12', alertW: 'w-16', locW: 'w-24' },
                { refW: 'w-24', desW: 'w-60', typW: 'w-20', stockW: 'w-8', alertW: 'w-14', locW: 'w-20' },
                { refW: 'w-30', desW: 'w-68', typW: 'w-24', stockW: 'w-10', alertW: 'w-16', locW: 'w-22' },
                { refW: 'w-22', desW: 'w-52', typW: 'w-18', stockW: 'w-8', alertW: 'w-14', locW: 'w-18' },
                { refW: 'w-28', desW: 'w-76', typW: 'w-22', stockW: 'w-10', alertW: 'w-16', locW: 'w-24' },
                { refW: 'w-24', desW: 'w-58', typW: 'w-20', stockW: 'w-8', alertW: 'w-14', locW: 'w-20' },
                { refW: 'w-26', desW: 'w-70', typW: 'w-22', stockW: 'w-12', alertW: 'w-16', locW: 'w-22' },
                { refW: 'w-22', desW: 'w-64', typW: 'w-18', stockW: 'w-8', alertW: 'w-14', locW: 'w-18' },
                { refW: 'w-28', desW: 'w-74', typW: 'w-24', stockW: 'w-10', alertW: 'w-16', locW: 'w-24' },
              ].map((row, idx) => (
                <tr key={`desig-skel-row-${idx}`} className="even:bg-slate-50/60 odd:bg-white">
                  {/* N° */}
                  <td className="py-3 px-3 text-center bg-slate-50/40 border-r border-slate-100 shrink-0">
                    <div className="h-3.5 w-5 rounded mx-auto shimmer-wave" />
                  </td>
                  {/* REF / ID (B) */}
                  <td className="py-3 px-4">
                    <div className={`h-5 ${row.refW} rounded-full font-mono shimmer-wave`} />
                  </td>
                  {/* DÉSIGNATION (C) */}
                  <td className="py-3 px-4">
                    <div className={`h-4 ${row.desW} max-w-[92%] rounded shimmer-wave`} />
                  </td>
                  {/* TYPE (D) */}
                  <td className="py-3 px-4">
                    <div className={`h-5 ${row.typW} rounded-full shimmer-wave`} />
                  </td>
                  {/* STOCK ACTUEL (E) */}
                  <td className="py-3 px-3 text-right">
                    <div className={`h-4 ${row.stockW} rounded ml-auto shimmer-wave`} />
                  </td>
                  {/* ÉTAT (F) */}
                  <td className="py-3 px-3 text-center">
                    <div className={`h-5 ${row.alertW} rounded-full mx-auto shimmer-wave`} />
                  </td>
                  {/* EMPLACEMENT (G) */}
                  <td className="py-3 px-4">
                    <div className={`h-4.5 ${row.locW} rounded-md shimmer-wave`} />
                  </td>
                  {/* Action */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center gap-1.5">
                      <div className="w-7 h-7 rounded-md shimmer-wave" />
                      <div className="w-7 h-7 rounded-md shimmer-wave" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 4. Table Pagination Footer Skeleton ─── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
        <div className="flex items-center gap-3">
          <div className="h-3.5 w-28 rounded shimmer-wave" />
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 gap-1">
            <div className="h-6 w-10 rounded-md shimmer-wave" />
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
    </div>
  );
}

export const DesignationSkeletonView = memo(DesignationSkeletonViewComponent);
export default DesignationSkeletonView;
