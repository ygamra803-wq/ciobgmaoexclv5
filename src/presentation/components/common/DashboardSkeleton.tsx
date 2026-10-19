import { memo } from 'react';

/**
 * DashboardSkeleton
 * Dedicated, pixel-matched, responsive skeleton for DashboardView.
 * Respects the exact layout, padding, borders, responsive breakpoints (sm, md, lg),
 * and column alignments of the actual operational dashboard:
 * 1. Top Executive Banner & Quick Action Buttons
 * 2. Primary KPI Metrics Grid (4 Cards: Catalog, Physical Stock, Alerts, Machines)
 * 3. Procurement & Purchase Orders Tracking Center (Commandes d'Achat)
 * 4. External Repairs Tracking Center (Bons de Sortie)
 * 5. GMAO Flux Intelligence (Left 1 col) & Critical Stock Watchlist (Right 2 cols)
 * 6. Recent Movements & Interventions Table
 */
function DashboardSkeletonComponent() {
  return (
    <div className="space-y-6 select-none font-sans w-full min-w-0" aria-hidden="true">
      {/* ─── 1. Top Executive Banner & Quick Action Buttons (Mirroring modern 3D Tactile Elevation) ─── */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative w-full">
          {/* 3D Elevated Page Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-blue-50/80 border border-blue-200/90 shadow-2xs flex items-center justify-center shrink-0">
            <div className="w-6 h-6 rounded-lg shimmer-wave" />
          </div>

          <div className="space-y-1.5 flex-1 max-w-3xl">
            {/* Badges row & Title */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="h-6 w-80 max-w-[75%] rounded-xl shimmer-wave" />
              <div className="h-5 w-32 rounded-full bg-emerald-50 border border-emerald-200/80 shimmer-wave" />
              <div className="h-5 w-24 rounded-full bg-blue-50 border border-blue-200/60 shimmer-wave" />
            </div>
            {/* Subtitle / Description */}
            <div className="h-3 w-full max-w-2xl rounded shimmer-wave" />
          </div>
        </div>

        {/* Action Buttons Placeholders (Circular 3D buttons: Formulas, Nouvelle Commande, Sortie Rapide, Exporter Excel) */}
        <div className="flex items-center gap-2.5 shrink-0 relative self-end md:self-auto">
          <div className="w-10 h-10 rounded-full border border-emerald-200 bg-emerald-50/60 shimmer-wave shrink-0" />
          <div className="w-10 h-10 rounded-full border border-amber-200 bg-amber-50/60 shimmer-wave shrink-0" />
          <div className="w-10 h-10 rounded-full border border-teal-200 bg-teal-50/60 shimmer-wave shrink-0" />
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 shimmer-wave shrink-0" />
        </div>
      </div>

      {/* ─── 2. Top Primary KPI Metrics Grid (Mirroring DashboardKPIs.jsx 4 Cards) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Articles au Catalogue */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-28 rounded shimmer-wave" />
            <div className="h-8 w-20 rounded-lg shimmer-wave" />
            <div className="h-3 w-32 rounded shimmer-wave" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <div className="w-6 h-6 rounded-lg shimmer-wave" />
          </div>
        </div>

        {/* KPI 2: Unités Physiques en Stock */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-28 rounded shimmer-wave" />
            <div className="h-8 w-24 rounded-lg shimmer-wave" />
            <div className="h-3 w-28 rounded shimmer-wave" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <div className="w-6 h-6 rounded-lg shimmer-wave" />
          </div>
        </div>

        {/* KPI 3: Seuils Critiques & Ruptures */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-32 rounded shimmer-wave" />
            <div className="h-8 w-16 rounded-lg shimmer-wave" />
            <div className="h-3 w-32 rounded shimmer-wave" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <div className="w-6 h-6 rounded-lg shimmer-wave" />
          </div>
        </div>

        {/* KPI 4: Disponibilité Parc Machines */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-32 rounded shimmer-wave" />
            <div className="h-8 w-20 rounded-lg shimmer-wave" />
            <div className="h-3 w-32 rounded shimmer-wave" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
            <div className="w-6 h-6 rounded-lg shimmer-wave" />
          </div>
        </div>
      </div>

      {/* ─── 3. Procurement & Purchase Orders Tracking Center (Lines 434-645) ─── */}
      <div className="bg-white rounded-3xl border border-amber-200 shadow-xs p-5 md:p-6 space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-200 flex items-center justify-center shrink-0">
              <div className="w-5 h-5 rounded shimmer-wave" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-60 rounded shimmer-wave" />
                <div className="h-5 w-24 rounded-full bg-amber-100 border border-amber-200 shimmer-wave" />
              </div>
              <div className="h-3 w-80 max-w-full rounded shimmer-wave" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-8 w-56 rounded-xl bg-slate-100 border border-slate-200 shimmer-wave" />
            <div className="h-8 w-32 rounded-xl bg-amber-500/20 border border-amber-300 shimmer-wave" />
          </div>
        </div>

        {/* 3 Orders Cards Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[...Array(3)].map((_, i) => (
            <div
              key={`dash-cmd-skel-${i}`}
              className="p-4 rounded-2xl border border-amber-200/80 bg-white shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                {/* Top Row: Ref + Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-16 rounded bg-slate-100 font-mono shimmer-wave" />
                    <div className="h-5 w-14 rounded-full bg-amber-50 shimmer-wave" />
                  </div>
                  <div className="h-5 w-20 rounded-full bg-amber-100 shimmer-wave" />
                </div>

                {/* Designation & Quantities */}
                <div className="space-y-1">
                  <div className="h-4 w-44 rounded shimmer-wave" />
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="h-3 w-24 rounded shimmer-wave" />
                    <div className="h-3 w-20 rounded shimmer-wave" />
                  </div>
                </div>

                {/* Info Pill */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="h-2.5 w-32 rounded shimmer-wave" />
                  <div className="h-2.5 w-28 rounded shimmer-wave" />
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-slate-100">
                <div className="h-8 w-full rounded-xl bg-emerald-500/20 border border-emerald-200 shimmer-wave" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 4. External Repairs Tracking Section (Lines 648-773) ─── */}
      <div className="bg-white rounded-3xl border border-purple-200 shadow-xs p-5 md:p-6 space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-purple-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-200 flex items-center justify-center shrink-0">
              <div className="w-5 h-5 rounded shimmer-wave" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-64 rounded shimmer-wave" />
                <div className="h-5 w-20 rounded-full bg-purple-100 border border-purple-200 shimmer-wave" />
              </div>
              <div className="h-3 w-80 max-w-full rounded shimmer-wave" />
            </div>
          </div>

          <div className="h-8 w-36 rounded-xl bg-purple-500/20 border border-purple-300 shimmer-wave" />
        </div>

        {/* 3 External Repairs Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[...Array(3)].map((_, i) => (
            <div
              key={`dash-rep-skel-${i}`}
              className="p-4 rounded-2xl border border-purple-200 bg-white shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-16 rounded bg-purple-50 font-mono shimmer-wave" />
                    <div className="h-5 w-16 rounded-full bg-purple-100 shimmer-wave" />
                  </div>
                  <div className="h-4 w-16 rounded shimmer-wave" />
                </div>

                <div className="space-y-1">
                  <div className="h-4 w-40 rounded shimmer-wave" />
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="h-3 w-20 rounded shimmer-wave" />
                    <div className="h-3 w-24 rounded shimmer-wave" />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="h-2.5 w-32 rounded shimmer-wave" />
                  <div className="h-2.5 w-24 rounded shimmer-wave" />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="h-8 w-full rounded-xl bg-purple-500/20 border border-purple-200 shimmer-wave" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 5. GMAO Flux Intelligence & Critical Stock Watchlist (Lines 776-880) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Col: Répartition des Interventions GMAO */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <div className="w-4 h-4 rounded shimmer-wave" />
              </div>
              <div className="space-y-1">
                <div className="h-4 w-36 rounded shimmer-wave" />
                <div className="h-2.5 w-24 rounded shimmer-wave" />
              </div>
            </div>
            <div className="h-5 w-16 rounded-full bg-slate-100 shimmer-wave" />
          </div>

          {/* 5 Progress Bars */}
          <div className="space-y-3 pt-1">
            {[
              { labelW: 'w-24', pctW: 'w-10', barW: 'w-3/4' },
              { labelW: 'w-28', pctW: 'w-8', barW: 'w-1/2' },
              { labelW: 'w-24', pctW: 'w-10', barW: 'w-1/3' },
              { labelW: 'w-20', pctW: 'w-8', barW: 'w-2/5' },
              { labelW: 'w-28', pctW: 'w-10', barW: 'w-3/5' },
            ].map((p, idx) => (
              <div key={`progress-skel-${idx}`} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className={`h-3 ${p.labelW} rounded shimmer-wave`} />
                  <div className={`h-3 ${p.pctW} rounded shimmer-wave`} />
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${p.barW} bg-slate-200 rounded-full shimmer-wave`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 2 Cols: Articles Sous Seuil Critique (Watchlist) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <div className="w-4 h-4 rounded shimmer-wave" />
              </div>
              <div className="space-y-1">
                <div className="h-4 w-48 rounded shimmer-wave" />
                <div className="h-2.5 w-36 rounded shimmer-wave" />
              </div>
            </div>
            <div className="h-5 w-24 rounded-full bg-rose-50 border border-rose-200 shimmer-wave" />
          </div>

          {/* Watchlist Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs border-collapse min-w-[550px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-16">
                    <div className="h-3 w-10 shimmer-wave rounded mx-auto" />
                  </th>
                  <th className="py-2.5 px-3">
                    <div className="h-3 w-24 shimmer-wave rounded" />
                  </th>
                  <th className="py-2.5 px-2 text-right">
                    <div className="h-3 w-12 shimmer-wave rounded ml-auto" />
                  </th>
                  <th className="py-2.5 px-2 text-right">
                    <div className="h-3 w-10 shimmer-wave rounded ml-auto" />
                  </th>
                  <th className="py-2.5 px-3 text-center">
                    <div className="h-3 w-14 shimmer-wave rounded mx-auto" />
                  </th>
                  <th className="py-2.5 px-3">
                    <div className="h-3 w-16 shimmer-wave rounded" />
                  </th>
                  <th className="py-2.5 px-3 text-center">
                    <div className="h-3 w-12 shimmer-wave rounded mx-auto" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(5)].map((_, rIdx) => (
                  <tr key={`watchlist-skel-row-${rIdx}`} className="even:bg-slate-50/50 odd:bg-white">
                    <td className="py-3 px-3">
                      <div className="h-4 w-14 shimmer-wave rounded font-mono" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-4 w-36 shimmer-wave rounded" />
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="h-4 w-8 shimmer-wave rounded ml-auto font-mono" />
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="h-4 w-8 shimmer-wave rounded ml-auto font-mono" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-5 w-16 shimmer-wave rounded-full mx-auto" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-4 w-14 shimmer-wave rounded" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-6 w-16 shimmer-wave rounded-lg mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── 6. Recent Movements & Interventions Table (Bottom Section) ─── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <div className="w-4 h-4 rounded shimmer-wave" />
            </div>
            <div className="space-y-1">
              <div className="h-4 w-56 rounded shimmer-wave" />
              <div className="h-2.5 w-36 rounded shimmer-wave" />
            </div>
          </div>
          <div className="h-5 w-20 rounded-full bg-slate-100 shimmer-wave" />
        </div>

        {/* Table Rows */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs border-collapse min-w-[650px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-28"><div className="h-3 w-16 shimmer-wave rounded" /></th>
                <th className="py-2.5 px-3 w-24"><div className="h-3 w-14 shimmer-wave rounded" /></th>
                <th className="py-2.5 px-3 w-24"><div className="h-3 w-16 shimmer-wave rounded" /></th>
                <th className="py-2.5 px-3 w-32"><div className="h-3 w-20 shimmer-wave rounded" /></th>
                <th className="py-2.5 px-3"><div className="h-3 w-28 shimmer-wave rounded" /></th>
                <th className="py-2.5 px-3 w-24 text-right"><div className="h-3 w-12 shimmer-wave rounded ml-auto" /></th>
                <th className="py-2.5 px-3 w-28"><div className="h-3 w-16 shimmer-wave rounded" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...Array(4)].map((_, idx) => (
                <tr key={`recent-mvt-skel-${idx}`} className="even:bg-slate-50/50 odd:bg-white">
                  <td className="py-3 px-3"><div className="h-4 w-20 shimmer-wave rounded font-mono" /></td>
                  <td className="py-3 px-3"><div className="h-4 w-16 shimmer-wave rounded font-mono" /></td>
                  <td className="py-3 px-3"><div className="h-5 w-20 shimmer-wave rounded-full" /></td>
                  <td className="py-3 px-3"><div className="h-4 w-24 shimmer-wave rounded font-mono" /></td>
                  <td className="py-3 px-3"><div className="h-4 w-40 shimmer-wave rounded" /></td>
                  <td className="py-3 px-3 text-right"><div className="h-4 w-10 shimmer-wave rounded ml-auto font-mono" /></td>
                  <td className="py-3 px-3"><div className="h-4 w-20 shimmer-wave rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export const DashboardSkeleton = memo(DashboardSkeletonComponent);
export default DashboardSkeleton;
