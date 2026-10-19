import { memo } from 'react';

/**
 * StockSkeletonView
 * Dedicated, pixel-matched, monochromatic skeleton for the Stock Actuel view.
 * Respects the exact layout, padding, borders, responsive breakpoints,
 * and column alignments of StockView using elegant slate/gray/white tones.
 */
function StockSkeletonViewComponent() {
  return (
    <div className="space-y-5 w-full min-w-0" aria-hidden="true">
      {/* ─── 1. Top Header Banner Skeleton (Mirroring BDR Light GMAO Header Card) ─── */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* Badge Icon (Package Placeholder) */}
          <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200/90 shadow-2xs flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded-lg shimmer-wave" />
          </div>

          <div className="space-y-2 flex-1 max-w-3xl">
            {/* Title */}
            <div className="h-6 w-80 max-w-[88%] rounded-lg shimmer-wave" />
            {/* Subtitle / Excel twin explanation lines */}
            <div className="space-y-1.5 pt-0.5">
              <div className="h-3 w-full max-w-2xl rounded shimmer-wave" />
              <div className="h-3 w-3/4 max-w-lg rounded shimmer-wave" />
            </div>
          </div>
        </div>

        {/* Right 3D Action Buttons (Formulas button & Add Article button placeholders) */}
        <div className="flex items-center gap-2.5 shrink-0 relative">
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shimmer-wave" />
          <div className="w-10 h-10 rounded-full border border-slate-300 bg-slate-100 flex items-center justify-center shimmer-wave" />
        </div>
      </div>

      {/* ─── 2. KPI Cards Bar Skeleton (Mirroring StockKPIBar 4 Responsive Cards) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Catalogue Global */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 rounded shimmer-wave" />
            <div className="h-7 w-16 rounded-md shimmer-wave" />
            <div className="h-3 w-32 rounded shimmer-wave" />
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded shimmer-wave" />
          </div>
        </div>

        {/* Card 2: Stock Conforme */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-28 rounded shimmer-wave" />
            <div className="h-7 w-14 rounded-md shimmer-wave" />
            <div className="h-3 w-32 rounded shimmer-wave" />
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded shimmer-wave" />
          </div>
        </div>

        {/* Card 3: Alerte Seuil Min */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-28 rounded shimmer-wave" />
            <div className="h-7 w-12 rounded-md shimmer-wave" />
            <div className="h-3 w-32 rounded shimmer-wave" />
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded shimmer-wave" />
          </div>
        </div>

        {/* Card 4: Rupture Totale */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 rounded shimmer-wave" />
            <div className="h-7 w-10 rounded-md shimmer-wave" />
            <div className="h-3 w-28 rounded shimmer-wave" />
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded shimmer-wave" />
          </div>
        </div>
      </div>

      {/* ─── 3. Filter & Search Bar Skeleton ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-48 rounded shimmer-wave" />
          </div>
          <div className="h-6 w-36 rounded-lg shimmer-wave" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
          {/* Field 1: Search */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 rounded shimmer-wave" />
              <div className="h-3 w-12 rounded shimmer-wave" />
            </div>
            <div className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>

          {/* Field 2: Type Filter */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded shimmer-wave" />
              <div className="h-3 w-12 rounded shimmer-wave" />
            </div>
            <div className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>

          {/* Field 3: Alerte Filter */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 rounded shimmer-wave" />
              <div className="h-3 w-12 rounded shimmer-wave" />
            </div>
            <div className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>

          {/* Field 4: Sort Filter */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded shimmer-wave" />
              <div className="h-3 w-12 rounded shimmer-wave" />
            </div>
            <div className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
        </div>
      </div>

      {/* ─── 4. Main Stock Twin Table Skeleton (12 Exact Columns, Full Capacity) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Table Top Info Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/70 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-60 rounded shimmer-wave" />
          </div>
          <div className="h-3 w-80 rounded hidden lg:block shimmer-wave" />
        </div>

        <div className="max-h-[62vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1020px]">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {/* 1. N° */}
                <th className="py-3 px-3 text-center w-12 bg-slate-200/60 border-r border-slate-200">
                  <div className="h-3 w-4 rounded mx-auto shimmer-wave" />
                </th>
                {/* 2. REF (B) */}
                <th className="py-3 px-3.5"><div className="h-3 w-16 rounded shimmer-wave" /></th>
                {/* 3. DÉSIGNATION (C) */}
                <th className="py-3 px-3.5 min-w-[220px]"><div className="h-3 w-32 rounded shimmer-wave" /></th>
                {/* 4. TYPE (D) */}
                <th className="py-3 px-3"><div className="h-3 w-16 rounded shimmer-wave" /></th>
                {/* 5. INITIAL (E) */}
                <th className="py-3 px-2.5 text-right"><div className="h-3 w-12 rounded ml-auto shimmer-wave" /></th>
                {/* 6. ENTRÉES (F) */}
                <th className="py-3 px-2.5 text-right"><div className="h-3 w-14 rounded ml-auto shimmer-wave" /></th>
                {/* 7. SORTIES (G) */}
                <th className="py-3 px-2.5 text-right"><div className="h-3 w-14 rounded ml-auto shimmer-wave" /></th>
                {/* 8. ACTUEL (H) */}
                <th className="py-3 px-2.5 text-right"><div className="h-3 w-16 rounded ml-auto shimmer-wave" /></th>
                {/* 9. SEUIL (I) */}
                <th className="py-3 px-2.5 text-right"><div className="h-3 w-12 rounded ml-auto shimmer-wave" /></th>
                {/* 10. ALERTE (J) */}
                <th className="py-3 px-3 text-center"><div className="h-3 w-14 rounded mx-auto shimmer-wave" /></th>
                {/* 11. EMPLACEMENT (K) */}
                <th className="py-3 px-3.5"><div className="h-3 w-20 rounded shimmer-wave" /></th>
                {/* 12. ACTIONS */}
                <th className="py-3 px-3.5 text-center min-w-[130px]"><div className="h-3 w-20 rounded mx-auto shimmer-wave" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { refW: 'w-28', desW: 'w-64', typW: 'w-20', alertW: 'w-16', locW: 'w-24' },
                { refW: 'w-32', desW: 'w-76', typW: 'w-22', alertW: 'w-18', locW: 'w-20' },
                { refW: 'w-24', desW: 'w-56', typW: 'w-20', alertW: 'w-16', locW: 'w-24' },
                { refW: 'w-30', desW: 'w-80', typW: 'w-24', alertW: 'w-20', locW: 'w-28' },
                { refW: 'w-28', desW: 'w-60', typW: 'w-18', alertW: 'w-16', locW: 'w-20' },
                { refW: 'w-34', desW: 'w-72', typW: 'w-22', alertW: 'w-18', locW: 'w-24' },
                { refW: 'w-26', desW: 'w-68', typW: 'w-20', alertW: 'w-16', locW: 'w-22' },
                { refW: 'w-30', desW: 'w-84', typW: 'w-24', alertW: 'w-20', locW: 'w-26' },
                { refW: 'w-28', desW: 'w-58', typW: 'w-18', alertW: 'w-16', locW: 'w-20' },
                { refW: 'w-32', desW: 'w-74', typW: 'w-22', alertW: 'w-18', locW: 'w-24' },
                { refW: 'w-24', desW: 'w-62', typW: 'w-20', alertW: 'w-16', locW: 'w-22' },
                { refW: 'w-30', desW: 'w-70', typW: 'w-22', alertW: 'w-18', locW: 'w-24' },
              ].map((row, idx) => (
                <tr key={`stock-skel-row-${idx}`} className="even:bg-slate-50/60 odd:bg-white">
                  {/* N° */}
                  <td className="py-2.5 px-3 bg-slate-50/40 border-r border-slate-100">
                    <div className="h-3.5 w-5 rounded mx-auto shimmer-wave" />
                  </td>
                  {/* Ref (B) */}
                  <td className="py-2.5 px-3.5">
                    <div className={`h-4 ${row.refW} rounded font-mono shimmer-wave`} />
                  </td>
                  {/* Designation (C) */}
                  <td className="py-2.5 px-3.5">
                    <div className={`h-4 ${row.desW} max-w-[92%] rounded shimmer-wave`} />
                  </td>
                  {/* Type (D) */}
                  <td className="py-2.5 px-3">
                    <div className={`h-5 ${row.typW} rounded-lg shimmer-wave`} />
                  </td>
                  {/* Initial (E) */}
                  <td className="py-2.5 px-2.5">
                    <div className="h-4 w-8 rounded ml-auto shimmer-wave" />
                  </td>
                  {/* Entrees (F) */}
                  <td className="py-2.5 px-2.5">
                    <div className="h-4 w-9 rounded ml-auto shimmer-wave" />
                  </td>
                  {/* Sorties (G) */}
                  <td className="py-2.5 px-2.5">
                    <div className="h-4 w-9 rounded ml-auto shimmer-wave" />
                  </td>
                  {/* Actuel (H) */}
                  <td className="py-2.5 px-2.5">
                    <div className="h-4 w-11 rounded ml-auto font-bold shimmer-wave" />
                  </td>
                  {/* Seuil (I) */}
                  <td className="py-2.5 px-2.5">
                    <div className="h-4 w-8 rounded ml-auto shimmer-wave" />
                  </td>
                  {/* Alerte (J) */}
                  <td className="py-2.5 px-3">
                    <div className={`h-5 ${row.alertW} rounded-full mx-auto shimmer-wave`} />
                  </td>
                  {/* Emplacement (K) */}
                  <td className="py-2.5 px-3.5">
                    <div className={`h-4.5 ${row.locW} rounded-md shimmer-wave`} />
                  </td>
                  {/* Actions & Flux */}
                  <td className="py-2.5 px-3.5">
                    <div className="h-6 w-22 rounded-lg mx-auto shimmer-wave" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer Pagination Skeleton */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="h-3.5 w-48 rounded shimmer-wave" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 rounded-lg shimmer-wave" />
            <div className="h-7 w-24 rounded-lg shimmer-wave" />
          </div>
        </div>
      </div>
    </div>
  );
}

export const StockSkeletonView = memo(StockSkeletonViewComponent);
export default StockSkeletonView;
