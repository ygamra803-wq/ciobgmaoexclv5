import { memo } from 'react';
import { SkeletonPageHeader, SkeletonKpiGrid } from './skeleton/GmaoSkeletonPrimitives';

/**
 * DashboardSkeleton
 * Dedicated, pixel-matched, strictly monochromatic (slate/gray/white) skeleton for DashboardView.
 * Mirrors the exact Mature Light Excel Cockpit hierarchy:
 * 1. Top Executive Banner & Quick Action Buttons (5 circular buttons)
 * 2. Compact Governance, LAN Sync & Validation Strip
 * 3. Primary KPI Metrics Grid (4 Cards: Catalog, Physical Stock, Alerts, Machines)
 * 4. Top Operational Hub: Accès Rapide aux Modules GMAO (7 cards) + Maintenance Corrective Nexus (5 stages)
 * 5. Critical Stock Watchlist (Left 2 cols) & Derniers Mouvements (Right 1 col)
 * 6. Side-by-Side Logistics: Suivi des Commandes & Réappro (Left) + Réparations Externes (Right)
 * 7. 3-Column GMAO Flux & Asset Intelligence (Répartition, Top 5 Pièces, Top Machines)
 */
function DashboardSkeletonComponent() {
  return (
    <div className="space-y-5 select-none font-sans w-full min-w-0" aria-hidden="true">
      {/* ─── 1. Top Executive Banner & Quick Action Buttons ─── */}
      <SkeletonPageHeader circleButtonsCount={5} titleBadgesCount={3} />

      {/* ─── 2. Compact Governance, LAN Sync & Validation Strip ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 shimmer-wave shrink-0" />
          <div className="h-4 w-44 rounded shimmer-wave" />
          <div className="h-5 w-28 rounded-full bg-slate-100 border border-slate-200/80 shimmer-wave" />
          <div className="hidden sm:block h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="h-5 w-24 rounded-md bg-slate-50 border border-slate-200/80 shimmer-wave" />
            <div className="h-5 w-20 rounded-md bg-slate-50 border border-slate-200/80 shimmer-wave" />
            <div className="h-5 w-24 rounded-md bg-slate-50 border border-slate-200/80 shimmer-wave" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
          <div className="h-8 w-24 rounded-xl bg-slate-100 border border-slate-200/80 shimmer-wave" />
          <div className="h-8 w-40 rounded-xl bg-slate-200/70 border border-slate-300/80 shimmer-wave" />
        </div>
      </div>

      {/* ─── 3. Top Primary KPI Metrics Grid (4-Tier GmaoKpiCard) ─── */}
      <SkeletonKpiGrid
        columns={4}
        cards={[
          { titleW: 'w-32', valueW: 'w-16', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-24', footerRightW: 'w-20' },
          { titleW: 'w-36', valueW: 'w-20', unitW: 'w-14', badgeW: 'w-32', footerLeftW: 'w-18', footerRightW: 'w-28' },
          { titleW: 'w-36', valueW: 'w-14', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-28', footerRightW: 'w-16' },
          { titleW: 'w-36', valueW: 'w-16', unitW: 'w-20', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-20' },
        ]}
      />

      {/* ─── 4A. Accès Rapide aux Modules GMAO (Placed at Top) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded shimmer-wave shrink-0" />
            <div className="h-4 w-52 rounded shimmer-wave" />
          </div>
          <div className="h-5 w-20 rounded-full bg-slate-100 border border-slate-200/80 shimmer-wave" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[...Array(7)].map((_, idx) => (
            <div
              key={`dash-shortcut-skel-${idx}`}
              className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/70 shimmer-wave" />
              <div className="h-3.5 w-24 max-w-full rounded shimmer-wave" />
              <div className="h-2.5 w-20 max-w-full rounded shimmer-wave" />
            </div>
          ))}
        </div>
      </div>

      {/* ─── 4B. Maintenance Corrective Nexus Hub ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 shimmer-wave shrink-0" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="h-4 w-48 rounded shimmer-wave" />
                <div className="h-5 w-20 rounded-full bg-slate-100 border border-slate-200/80 shimmer-wave" />
                <div className="h-5 w-24 rounded-full bg-slate-50 border border-slate-200/80 shimmer-wave" />
              </div>
              <div className="h-3 w-96 max-w-full rounded shimmer-wave" />
            </div>
          </div>
          <div className="h-9 w-40 rounded-xl bg-slate-200/70 border border-slate-300/80 shimmer-wave shrink-0" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-slate-100">
          {[...Array(5)].map((_, idx) => (
            <div
              key={`dash-nexus-step-skel-${idx}`}
              className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1.5"
            >
              <div className="h-2.5 w-20 rounded shimmer-wave" />
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-20 rounded shimmer-wave" />
                <div className="h-4 w-8 rounded bg-white border border-slate-200 font-mono shimmer-wave" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 5. Critical Watchlist (2/3) & Derniers Mouvements Live Feed (1/3) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Watchlist Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 shimmer-wave shrink-0" />
              <div className="space-y-1">
                <div className="h-4 w-52 rounded shimmer-wave" />
                <div className="h-2.5 w-40 rounded shimmer-wave" />
              </div>
            </div>
            <div className="h-4 w-28 rounded shimmer-wave" />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left text-xs border-collapse min-w-[550px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5"><div className="h-3 w-10 shimmer-wave rounded" /></th>
                  <th className="py-2.5 px-3.5"><div className="h-3 w-24 shimmer-wave rounded" /></th>
                  <th className="py-2.5 px-2 text-right"><div className="h-3 w-14 shimmer-wave rounded ml-auto" /></th>
                  <th className="py-2.5 px-2 text-right"><div className="h-3 w-10 shimmer-wave rounded ml-auto" /></th>
                  <th className="py-2.5 px-3 text-center"><div className="h-3 w-12 shimmer-wave rounded mx-auto" /></th>
                  <th className="py-2.5 px-3"><div className="h-3 w-18 shimmer-wave rounded" /></th>
                  <th className="py-2.5 px-3 text-center"><div className="h-3 w-16 shimmer-wave rounded mx-auto" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(5)].map((_, rIdx) => (
                  <tr key={`watchlist-skel-row-${rIdx}`} className="even:bg-slate-50/50 odd:bg-white">
                    <td className="py-3 px-3.5"><div className="h-4 w-16 shimmer-wave rounded font-mono" /></td>
                    <td className="py-3 px-3.5"><div className="h-4 w-36 shimmer-wave rounded" /></td>
                    <td className="py-3 px-2 text-right"><div className="h-4 w-8 shimmer-wave rounded ml-auto font-mono" /></td>
                    <td className="py-3 px-2 text-right"><div className="h-4 w-8 shimmer-wave rounded ml-auto font-mono" /></td>
                    <td className="py-3 px-3 text-center"><div className="h-5 w-16 shimmer-wave rounded-full mx-auto" /></td>
                    <td className="py-3 px-3"><div className="h-4 w-14 shimmer-wave rounded font-mono" /></td>
                    <td className="py-3 px-3 text-center"><div className="h-6 w-16 shimmer-wave rounded-lg mx-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Derniers Mouvements Feed (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 shimmer-wave shrink-0" />
              <div className="space-y-1">
                <div className="h-4 w-36 rounded shimmer-wave" />
                <div className="h-2.5 w-28 rounded shimmer-wave" />
              </div>
            </div>
            <div className="h-4 w-14 rounded shimmer-wave" />
          </div>

          <div className="space-y-2.5">
            {[...Array(5)].map((_, idx) => (
              <div
                key={`feed-skel-${idx}`}
                className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-14 rounded-full bg-slate-200/70 shimmer-wave" />
                    <div className="h-4 w-20 rounded font-mono shimmer-wave" />
                  </div>
                  <div className="h-3 w-36 rounded shimmer-wave" />
                  <div className="h-2.5 w-28 rounded shimmer-wave" />
                </div>
                <div className="h-5 w-10 rounded font-mono shimmer-wave" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 6. Side-by-Side Logistics: Commandes & Réappro (Left) + Réparations Externes (Right) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {[0, 1].map((colIdx) => (
          <div
            key={`dash-logistics-skel-${colIdx}`}
            className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 shimmer-wave shrink-0" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-48 rounded shimmer-wave" />
                    <div className="h-5 w-20 rounded-full bg-slate-100 border border-slate-200/80 shimmer-wave" />
                  </div>
                  <div className="h-2.5 w-60 max-w-full rounded shimmer-wave" />
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200/80 shimmer-wave shrink-0" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[0, 1].map((cardIdx) => (
                <div
                  key={`dash-log-card-${colIdx}-${cardIdx}`}
                  className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-20 rounded bg-white border border-slate-200 font-mono shimmer-wave" />
                    <div className="h-4 w-16 rounded-full bg-slate-200/70 shimmer-wave" />
                  </div>
                  <div className="h-3.5 w-36 rounded shimmer-wave" />
                  <div className="h-3 w-full rounded shimmer-wave" />
                  <div className="h-7 w-full rounded-lg bg-slate-200/70 shimmer-wave" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ─── 7. 3-Column GMAO Flux & Asset Intelligence ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Col 1: Répartition des Interventions */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 shimmer-wave shrink-0" />
              <div className="space-y-1">
                <div className="h-4 w-40 rounded shimmer-wave" />
                <div className="h-2.5 w-28 rounded shimmer-wave" />
              </div>
            </div>
            <div className="h-5 w-16 rounded-full bg-slate-100 shimmer-wave" />
          </div>
          <div className="space-y-3 pt-1">
            {[...Array(5)].map((_, idx) => (
              <div key={`progress-skel-${idx}`} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-28 rounded shimmer-wave" />
                  <div className="h-3 w-10 rounded shimmer-wave" />
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-slate-200 rounded-full shimmer-wave" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Col 2 & 3: Top 5 Pièces & Top Machines */}
        {[0, 1].map((colIdx) => (
          <div
            key={`dash-top-skel-${colIdx}`}
            className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 shimmer-wave shrink-0" />
                <div className="space-y-1">
                  <div className="h-4 w-40 rounded shimmer-wave" />
                  <div className="h-2.5 w-28 rounded shimmer-wave" />
                </div>
              </div>
              <div className="h-4 w-12 rounded shimmer-wave" />
            </div>
            <div className="space-y-2">
              {[...Array(4)].map((_, rIdx) => (
                <div
                  key={`top-item-skel-${colIdx}-${rIdx}`}
                  className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="h-3.5 w-28 rounded shimmer-wave" />
                    <div className="h-2.5 w-36 rounded shimmer-wave" />
                  </div>
                  <div className="h-5 w-16 rounded font-mono shimmer-wave" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const DashboardSkeleton = memo(DashboardSkeletonComponent);
export default DashboardSkeleton;

