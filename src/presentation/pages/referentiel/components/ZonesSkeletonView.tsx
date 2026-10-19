import { memo } from 'react';

/**
 * ZonesSkeletonView
 * Dedicated, pixel-matched, monochromatic skeleton for the Zones & Secteurs view.
 * Matches header, 2-column filter bar, 6-column table structure, and pagination footer.
 */
function ZonesSkeletonViewComponent() {
  return (
    <div className="space-y-5 w-full min-w-0" aria-hidden="true">
      {/* 1. Top Header Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200/90 flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded-lg shimmer-wave" />
          </div>
          <div className="space-y-2 flex-1 max-w-3xl">
            <div className="h-6 w-72 max-w-[80%] rounded-lg shimmer-wave" />
            <div className="h-3 w-full max-w-xl rounded shimmer-wave" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shimmer-wave" />
          <div className="w-10 h-10 rounded-full border border-slate-300 bg-slate-100 flex items-center justify-center shimmer-wave" />
        </div>
      </div>

      {/* 2. Filter Bar (2 Columns: Search + Sort) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-44 rounded shimmer-wave" />
          </div>
          <div className="h-6 w-28 rounded-lg shimmer-wave" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          {/* Search */}
          <div className="w-full space-y-1.5">
            <div className="h-3 w-20 rounded shimmer-wave" />
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>

          {/* Sort */}
          <div className="w-full space-y-1.5">
            <div className="h-3 w-32 rounded shimmer-wave" />
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
        </div>
      </div>

      {/* 3. Table Card (6 Columns) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/70 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-60 rounded shimmer-wave" />
          </div>
          <div className="h-3 w-72 rounded hidden lg:block shimmer-wave" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
            <thead className="bg-slate-100 text-[10.5px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-center w-12 bg-slate-200/60 border-r border-slate-200 shrink-0">
                  <div className="h-3 w-4 rounded mx-auto shimmer-wave" />
                </th>
                <th className="py-2.5 px-3 min-w-[160px]"><div className="h-3 w-32 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-4 min-w-[240px]"><div className="h-3 w-40 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-3 min-w-[200px]"><div className="h-3 w-36 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-3 min-w-[130px]"><div className="h-3 w-20 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-3 text-center w-20"><div className="h-3 w-10 rounded mx-auto shimmer-wave" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { codeW: 'w-20', idW: 'w-16', titleW: 'w-48', subW: 'w-36', typeW: 'w-16', techW: 'w-24', opW: 'w-24', mchW: 'w-24' },
                { codeW: 'w-18', idW: 'w-20', titleW: 'w-56', subW: 'w-40', typeW: 'w-20', techW: 'w-20', opW: 'w-28', mchW: 'w-20' },
                { codeW: 'w-22', idW: 'w-18', titleW: 'w-40', subW: 'w-32', typeW: 'w-16', techW: 'w-24', opW: 'w-20', mchW: 'w-28' },
                { codeW: 'w-20', idW: 'w-20', titleW: 'w-52', subW: 'w-44', typeW: 'w-18', techW: 'w-28', opW: 'w-24', mchW: 'w-22' },
                { codeW: 'w-24', idW: 'w-16', titleW: 'w-44', subW: 'w-36', typeW: 'w-20', techW: 'w-20', opW: 'w-28', mchW: 'w-26' },
                { codeW: 'w-18', idW: 'w-22', titleW: 'w-60', subW: 'w-48', typeW: 'w-16', techW: 'w-24', opW: 'w-22', mchW: 'w-24' },
              ].map((row, idx) => (
                <tr key={`zone-skel-row-${idx}`} className="even:bg-slate-50/60 odd:bg-white">
                  <td className="py-3 px-3 text-center bg-slate-50/40 border-r border-slate-100 shrink-0">
                    <div className="h-3.5 w-5 rounded mx-auto shimmer-wave" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-1.5">
                      <div className={`h-4.5 ${row.codeW} rounded shimmer-wave`} />
                      <div className={`h-4.5 ${row.idW} rounded shimmer-wave`} />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1.5">
                      <div className={`h-4 ${row.titleW} rounded shimmer-wave`} />
                      <div className={`h-3 ${row.subW} rounded shimmer-wave`} />
                      <div className={`h-4 ${row.typeW} rounded-full shimmer-wave`} />
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1.5">
                      <div className={`h-6 ${row.techW} rounded-lg shimmer-wave`} />
                      <div className={`h-6 ${row.opW} rounded-lg shimmer-wave`} />
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className={`h-6 ${row.mchW} rounded-lg shimmer-wave`} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex justify-center gap-1.5">
                      <div className="w-7 h-7 rounded-lg shimmer-wave" />
                      <div className="w-7 h-7 rounded-lg shimmer-wave" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Pagination Footer */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
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
    </div>
  );
}

export const ZonesSkeletonView = memo(ZonesSkeletonViewComponent);
export default ZonesSkeletonView;
