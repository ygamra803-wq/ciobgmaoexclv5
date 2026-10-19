import { memo } from 'react';

/**
 * MachinesRegisteredSkeletonView
 * Dedicated, pixel-matched, monochromatic skeleton for the Machines Registered view.
 * Features 5 KPI Cards, 5-column filter bar, 9-column iconic Excel table structure, and pagination.
 */
function MachinesRegisteredSkeletonViewComponent() {
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
            <div className="h-3 w-full max-w-2xl rounded shimmer-wave" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shimmer-wave" />
          <div className="w-10 h-10 rounded-full border border-slate-300 bg-slate-100 flex items-center justify-center shimmer-wave" />
        </div>
      </div>

      {/* 2. 5 Machines KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[
          { labelW: 'w-20', valW: 'w-10' },
          { labelW: 'w-24', valW: 'w-8' },
          { labelW: 'w-28', valW: 'w-6' },
          { labelW: 'w-22', valW: 'w-6' },
          { labelW: 'w-24', valW: 'w-12' },
        ].map((kpi, idx) => (
          <div
            key={`mch-kpi-skel-${idx}`}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between"
          >
            <div className="space-y-1.5">
              <div className={`h-2.5 ${kpi.labelW} rounded shimmer-wave`} />
              <div className={`h-6.5 ${kpi.valW} rounded-md font-mono shimmer-wave`} />
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
              <div className="w-4 h-4 rounded shimmer-wave" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. 5-Column Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-52 rounded shimmer-wave" />
          </div>
          <div className="h-6 w-36 rounded-lg shimmer-wave" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
          {/* Search */}
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <div className="h-2.5 w-20 rounded shimmer-wave" />
            <div className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
          {/* Famille Filter */}
          <div className="space-y-1">
            <div className="h-2.5 w-24 rounded shimmer-wave" />
            <div className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
          {/* Template Filter */}
          <div className="space-y-1">
            <div className="h-2.5 w-28 rounded shimmer-wave" />
            <div className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
          {/* Zone Filter */}
          <div className="space-y-1">
            <div className="h-2.5 w-20 rounded shimmer-wave" />
            <div className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
          {/* Sort Menu */}
          <div className="space-y-1">
            <div className="h-2.5 w-20 rounded shimmer-wave" />
            <div className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
        </div>
      </div>

      {/* 4. Table Card (9 Columns) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/70 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-64 rounded shimmer-wave" />
          </div>
          <div className="h-3 w-80 rounded hidden lg:block shimmer-wave" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[980px]">
            <thead className="bg-slate-100 text-[10.5px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-center w-12 bg-slate-200/60 border-r border-slate-200 shrink-0">
                  <div className="h-3 w-4 rounded mx-auto shimmer-wave" />
                </th>
                <th className="py-3 px-3.5"><div className="h-3 w-28 rounded shimmer-wave" /></th>
                <th className="py-3 px-3.5 min-w-[200px]"><div className="h-3 w-32 rounded shimmer-wave" /></th>
                <th className="py-3 px-3.5 min-w-[200px]"><div className="h-3 w-40 rounded shimmer-wave" /></th>
                <th className="py-3 px-3.5 min-w-[170px]"><div className="h-3 w-24 rounded shimmer-wave" /></th>
                <th className="py-3 px-3.5 min-w-[210px]"><div className="h-3 w-36 rounded shimmer-wave" /></th>
                <th className="py-3 px-3 text-center w-24"><div className="h-3 w-16 mx-auto rounded shimmer-wave" /></th>
                <th className="py-3 px-3 text-right w-24"><div className="h-3 w-20 ml-auto rounded shimmer-wave" /></th>
                <th className="py-3 px-3.5 text-center min-w-[100px]"><div className="h-3 w-16 mx-auto rounded shimmer-wave" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { codeW: 'w-24', titleW: 'w-44', subW: 'w-32', famW: 'w-20', tmplW: 'w-24', bpW: 'w-20', zoneW: 'w-24', techW: 'w-20', statW: 'w-20', fluxW: 'w-8' },
                { codeW: 'w-20', titleW: 'w-52', subW: 'w-36', famW: 'w-24', tmplW: 'w-20', bpW: 'w-24', zoneW: 'w-20', techW: 'w-28', statW: 'w-24', fluxW: 'w-10' },
                { codeW: 'w-22', titleW: 'w-40', subW: 'w-28', famW: 'w-18', tmplW: 'w-24', bpW: 'w-18', zoneW: 'w-28', techW: 'w-20', statW: 'w-20', fluxW: 'w-6' },
                { codeW: 'w-26', titleW: 'w-48', subW: 'w-34', famW: 'w-22', tmplW: 'w-22', bpW: 'w-22', zoneW: 'w-22', techW: 'w-24', statW: 'w-22', fluxW: 'w-12' },
                { codeW: 'w-20', titleW: 'w-56', subW: 'w-40', famW: 'w-20', tmplW: 'w-28', bpW: 'w-20', zoneW: 'w-26', techW: 'w-22', statW: 'w-20', fluxW: 'w-8' },
                { codeW: 'w-24', titleW: 'w-44', subW: 'w-30', famW: 'w-24', tmplW: 'w-20', bpW: 'w-24', zoneW: 'w-20', techW: 'w-26', statW: 'w-24', fluxW: 'w-14' },
              ].map((row, idx) => (
                <tr key={`mch-skel-row-${idx}`} className="even:bg-slate-50/60 odd:bg-white">
                  <td className="py-3 px-3 text-center bg-slate-50/40 border-r border-slate-100 shrink-0">
                    <div className="h-3.5 w-5 rounded mx-auto shimmer-wave" />
                  </td>
                  <td className="py-3 px-3.5">
                    <div className={`h-5 ${row.codeW} rounded-md font-mono shimmer-wave`} />
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="space-y-1">
                      <div className={`h-3.5 ${row.titleW} rounded shimmer-wave`} />
                      <div className={`h-2.5 ${row.subW} rounded shimmer-wave`} />
                    </div>
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-5 ${row.famW} rounded-md shimmer-wave`} />
                      <div className={`h-5 ${row.tmplW} rounded-md shimmer-wave`} />
                    </div>
                  </td>
                  <td className="py-3 px-3.5">
                    <div className={`h-5 ${row.bpW} rounded-md shimmer-wave`} />
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-5 ${row.zoneW} rounded-md shimmer-wave`} />
                      <div className={`h-5 ${row.techW} rounded-md shimmer-wave`} />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className={`h-5 ${row.statW} rounded-full mx-auto shimmer-wave`} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className={`h-5 ${row.fluxW} rounded-md ml-auto font-mono shimmer-wave`} />
                  </td>
                  <td className="py-3 px-3.5 text-center">
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

      {/* 5. Pagination Footer */}
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

export const MachinesRegisteredSkeletonView = memo(MachinesRegisteredSkeletonViewComponent);
export default MachinesRegisteredSkeletonView;
