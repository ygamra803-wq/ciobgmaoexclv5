import { memo } from 'react';

/**
 * PartDesignationSkeletonView
 * Dedicated, pixel-matched, monochromatic skeleton for the Part Designations view (Entrepôt).
 * Matches header banner, 2-column filter bar, 8-column table structure, and pagination.
 */
function PartDesignationSkeletonViewComponent() {
  return (
    <div className="space-y-5 w-full min-w-0" aria-hidden="true">
      {/* 1. Top Header Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200/90 flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded-lg shimmer-wave" />
          </div>
          <div className="space-y-2 flex-1 max-w-3xl">
            <div className="h-6 w-80 max-w-[85%] rounded-lg shimmer-wave" />
            <div className="h-3 w-full max-w-xl rounded shimmer-wave" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shimmer-wave" />
          <div className="w-10 h-10 rounded-full border border-slate-300 bg-slate-100 flex items-center justify-center shimmer-wave" />
        </div>
      </div>

      {/* 2. Filter Bar (Search + Part Type Select) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-48 rounded shimmer-wave" />
          </div>
          <div className="h-6 w-36 rounded-lg shimmer-wave" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          <div className="md:col-span-8">
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
          <div className="md:col-span-4">
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
        </div>
      </div>

      {/* 3. Table Card (8 Columns) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/70 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-64 rounded shimmer-wave" />
          </div>
          <div className="h-3 w-80 rounded hidden lg:block shimmer-wave" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[920px]">
            <thead className="bg-slate-100 text-[10.5px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-center w-12 bg-slate-200/60 border-r border-slate-200 shrink-0">
                  <div className="h-3 w-4 rounded mx-auto shimmer-wave" />
                </th>
                <th className="py-2.5 px-4"><div className="h-3 w-28 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-4 min-w-[200px]"><div className="h-3 w-44 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-4"><div className="h-3 w-36 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-4"><div className="h-3 w-24 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-4"><div className="h-3 w-28 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-4"><div className="h-3 w-36 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-4 text-right"><div className="h-3 w-16 ml-auto rounded shimmer-wave" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { refW: 'w-24', desigW: 'w-52', typeW: 'w-28', seuilW: 'w-10', empW: 'w-24', whW: 'w-24' },
                { refW: 'w-28', desigW: 'w-44', typeW: 'w-32', seuilW: 'w-8', empW: 'w-28', whW: 'w-28' },
                { refW: 'w-20', desigW: 'w-60', typeW: 'w-24', seuilW: 'w-12', empW: 'w-20', whW: 'w-20' },
                { refW: 'w-26', desigW: 'w-48', typeW: 'w-28', seuilW: 'w-10', empW: 'w-26', whW: 'w-24' },
                { refW: 'w-22', desigW: 'w-56', typeW: 'w-30', seuilW: 'w-8', empW: 'w-24', whW: 'w-26' },
                { refW: 'w-28', desigW: 'w-40', typeW: 'w-26', seuilW: 'w-14', empW: 'w-30', whW: 'w-22' },
              ].map((row, idx) => (
                <tr key={`part-desig-skel-${idx}`} className="even:bg-slate-50/60 odd:bg-white">
                  <td className="py-3 px-3 text-center bg-slate-50/40 border-r border-slate-100 shrink-0">
                    <div className="h-3.5 w-5 rounded mx-auto shimmer-wave" />
                  </td>
                  <td className="py-3 px-4">
                    <div className={`h-5 ${row.refW} rounded-md font-mono shimmer-wave`} />
                  </td>
                  <td className="py-3 px-4">
                    <div className={`h-4 ${row.desigW} rounded shimmer-wave`} />
                  </td>
                  <td className="py-3 px-4">
                    <div className={`h-6 ${row.typeW} rounded-lg shimmer-wave`} />
                  </td>
                  <td className="py-3 px-4">
                    <div className={`h-5 ${row.seuilW} rounded-md font-mono shimmer-wave`} />
                  </td>
                  <td className="py-3 px-4">
                    <div className={`h-5 ${row.empW} rounded-md shimmer-wave`} />
                  </td>
                  <td className="py-3 px-4">
                    <div className={`h-6 ${row.whW} rounded-lg shimmer-wave`} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-1.5">
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

export const PartDesignationSkeletonView = memo(PartDesignationSkeletonViewComponent);
export default PartDesignationSkeletonView;
