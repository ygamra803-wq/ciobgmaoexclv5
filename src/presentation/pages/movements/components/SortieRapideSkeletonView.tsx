import { memo } from 'react';

/**
 * SortieRapideSkeletonView
 * Dedicated, pixel-matched, responsive skeleton for SortieRapideView (Gestion des Mouvements & Bons Industriels).
 * Respects the exact layout, padding, borders, responsive breakpoints (sm, md, lg),
 * and column alignments of both the 5-Flux Form (5 cols) and the MouvementsJournalTable (7 cols):
 * 1. Top BDR Light GMAO Header Card with Sub-Tab Switcher & Formula Button
 * 2. Main 12-Column Responsive Grid:
 *    - Left 5 Cols: Unified 3-Bons Generator Form (Code picker, 5 flow buttons, item source, inputs, CTA)
 *    - Right 7 Cols: Movements History & Excel Twin (Search bar, date filter presets, journal table)
 */
function SortieRapideSkeletonViewComponent() {
  return (
    <div className="space-y-4 select-none font-sans w-full min-w-0" aria-hidden="true">
      {/* ─── 1. Top GMAO Header Banner (Mirroring lines 1228-1296) ─── */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* 3D Elevated Page Badge Icon Placeholder */}
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200/90 shadow-2xs flex items-center justify-center shrink-0">
            <div className="w-6 h-6 rounded-lg shimmer-wave" />
          </div>
          <div className="space-y-1.5 flex-1 max-w-3xl">
            {/* Title */}
            <div className="h-6 w-96 max-w-[85%] rounded-lg shimmer-wave" />
            {/* Subtitle with 3 categories & 5 flux explanation */}
            <div className="h-3 w-full max-w-xl rounded shimmer-wave" />
          </div>
        </div>

        {/* Right Controls: Formulas Modal Button + Sub-Tab Switcher */}
        <div className="flex items-center gap-2 self-stretch md:self-auto overflow-x-auto shrink-0">
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 shimmer-wave" />

          {/* 3 Sub-Tabs Pill (Journal & Saisie | Commandes | Réparation Externe) */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <div className="h-7 w-32 rounded-lg bg-white border border-slate-200/60 shadow-2xs shimmer-wave" />
            <div className="h-7 w-40 rounded-lg bg-slate-200/60 shimmer-wave" />
            <div className="h-7 w-44 rounded-lg bg-slate-200/60 shimmer-wave" />
          </div>
        </div>
      </div>

      {/* ─── 2. Main 12-Column Responsive Layout: Form (5 cols) & Journal Table (7 cols) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ─── Left Form: Unified 3-Bons Generator (5 Cols on large screens) ─── */}
        <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          {/* Header Bar + SequentialCodePicker */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div className="space-y-1">
              <div className="h-4 w-44 rounded shimmer-wave" />
              <div className="h-3 w-56 rounded shimmer-wave" />
            </div>
            {/* SequentialCodePicker placeholder */}
            <div className="w-full sm:w-56 h-11 rounded-xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-between shrink-0">
              <div className="h-4 w-20 rounded bg-indigo-50 font-mono shimmer-wave" />
              <div className="h-6 w-14 rounded-lg bg-slate-200 shimmer-wave" />
            </div>
          </div>

          <div className="space-y-4">
            {/* 1. FLOW TYPE SELECTOR (5 Operational Flows) */}
            <div className="space-y-2">
              <div className="h-3 w-36 rounded shimmer-wave" />

              <div className="grid grid-cols-2 gap-1.5">
                {/* 1. Sortie Interne */}
                <div className="p-2.5 rounded-xl border border-rose-300 bg-rose-50/40 space-y-1.5 flex flex-col justify-between h-15">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-24 rounded bg-rose-200 shimmer-wave" />
                    <div className="h-3.5 w-12 rounded bg-rose-200 shimmer-wave" />
                  </div>
                  <div className="h-2 w-32 rounded bg-rose-100 shimmer-wave" />
                </div>

                {/* 2. Entrée Interne */}
                <div className="p-2.5 rounded-xl border border-cyan-200 bg-cyan-50/30 space-y-1.5 flex flex-col justify-between h-15">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-24 rounded bg-cyan-200 shimmer-wave" />
                    <div className="h-3.5 w-12 rounded bg-cyan-200 shimmer-wave" />
                  </div>
                  <div className="h-2 w-32 rounded bg-cyan-100 shimmer-wave" />
                </div>

                {/* 3. Bon de Sortie (Réparation Externe) */}
                <div className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/30 space-y-1.5 flex flex-col justify-between h-15">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-24 rounded bg-purple-200 shimmer-wave" />
                    <div className="h-3.5 w-12 rounded bg-purple-200 shimmer-wave" />
                  </div>
                  <div className="h-2 w-36 rounded bg-purple-100 shimmer-wave" />
                </div>

                {/* 4. Entrée Externe */}
                <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-1.5 flex flex-col justify-between h-15">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-24 rounded bg-emerald-200 shimmer-wave" />
                    <div className="h-3.5 w-12 rounded bg-emerald-200 shimmer-wave" />
                  </div>
                  <div className="h-2 w-36 rounded bg-emerald-100 shimmer-wave" />
                </div>

                {/* 5. Commande / Demandes d'Achat */}
                <div className="col-span-2 p-2.5 rounded-xl border border-amber-200 bg-amber-50/30 space-y-1.5 flex flex-col justify-between h-15">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-52 rounded bg-amber-200 shimmer-wave" />
                    <div className="h-3.5 w-12 rounded bg-amber-200 shimmer-wave" />
                  </div>
                  <div className="h-2 w-48 rounded bg-amber-100 shimmer-wave" />
                </div>
              </div>
            </div>

            {/* 2. ITEM SOURCE SELECTOR (PDR, Parties, Composants) */}
            <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 space-y-2">
              <div className="h-3 w-36 rounded shimmer-wave" />
              <div className="grid grid-cols-3 gap-1.5">
                <div className="h-9 rounded-xl border border-emerald-300 bg-emerald-50/50 flex items-center justify-center shimmer-wave" />
                <div className="h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center shimmer-wave" />
                <div className="h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center shimmer-wave" />
              </div>
            </div>

            {/* 3. DATE & CATEGORY ROW */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="h-3 w-16 rounded shimmer-wave" />
                <div className="h-10 rounded-xl bg-slate-50 border border-slate-200 shimmer-wave" />
              </div>
              <div className="space-y-1">
                <div className="h-3 w-24 rounded shimmer-wave" />
                <div className="h-10 rounded-xl bg-slate-50 border border-slate-200 shimmer-wave" />
              </div>
            </div>

            {/* 4. ARTICLE PICKER FIELD */}
            <div className="space-y-1">
              <div className="h-3 w-36 rounded shimmer-wave" />
              <div className="h-11 rounded-xl bg-slate-50 border border-slate-200 p-2.5 flex items-center justify-between shimmer-wave">
                <div className="h-4 w-40 rounded bg-slate-200/80 shimmer-wave" />
                <div className="h-6 w-16 rounded-lg bg-indigo-100 shimmer-wave" />
              </div>
            </div>

            {/* 5. QUANTITÉ & UNITÉ */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="h-3 w-20 rounded shimmer-wave" />
                <div className="h-10 rounded-xl bg-slate-50 border border-slate-200 shimmer-wave" />
              </div>
              <div className="space-y-1">
                <div className="h-3 w-16 rounded shimmer-wave" />
                <div className="h-10 rounded-xl bg-slate-50 border border-slate-200 shimmer-wave" />
              </div>
            </div>

            {/* 6. MACHINE & ZONE */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="h-3 w-28 rounded shimmer-wave" />
                <div className="h-10 rounded-xl bg-slate-50 border border-slate-200 shimmer-wave" />
              </div>
              <div className="space-y-1">
                <div className="h-3 w-20 rounded shimmer-wave" />
                <div className="h-10 rounded-xl bg-slate-50 border border-slate-200 shimmer-wave" />
              </div>
            </div>

            {/* 7. DEMANDEUR / TECHNICIEN */}
            <div className="space-y-1">
              <div className="h-3 w-36 rounded shimmer-wave" />
              <div className="h-10 rounded-xl bg-slate-50 border border-slate-200 shimmer-wave" />
            </div>

            {/* 8. COMMENTAIRE */}
            <div className="space-y-1">
              <div className="h-3 w-28 rounded shimmer-wave" />
              <div className="h-14 rounded-xl bg-slate-50 border border-slate-200 shimmer-wave" />
            </div>

            {/* 9. SUBMIT CTA BUTTON */}
            <div className="pt-2">
              <div className="h-12 w-full rounded-xl bg-rose-600/30 border border-rose-300 shadow-2xs shimmer-wave" />
            </div>
          </div>
        </div>

        {/* ─── Right Table: Movements History & Excel Twin (7 Cols on large screens) ─── */}
        <div className="lg:col-span-7 space-y-4">
          {/* Top Filter and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="h-10 w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
              <div className="flex items-center gap-2">
                <div className="h-9 w-44 rounded-xl bg-slate-100 border border-slate-200 shimmer-wave" />
                <div className="h-9 w-28 rounded-xl bg-white border border-slate-200 shimmer-wave" />
              </div>
            </div>

            {/* Quick Date Presets Bar */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
              <div className="h-4 w-12 rounded shimmer-wave mr-1" />
              <div className="h-7 w-20 rounded-lg bg-slate-900/20 shimmer-wave" />
              <div className="h-7 w-20 rounded-lg bg-slate-100 shimmer-wave" />
              <div className="h-7 w-24 rounded-lg bg-slate-100 shimmer-wave" />
              <div className="h-7 w-20 rounded-lg bg-slate-100 shimmer-wave" />
            </div>
          </div>

          {/* Mouvements Journal Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Top Table Info Bar */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="h-4 w-60 rounded shimmer-wave" />
              <div className="h-3 w-72 rounded bg-slate-200 hidden lg:block shimmer-wave" />
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-100/80 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <div className="h-3 w-4 rounded mx-auto shimmer-wave" />
                    </th>
                    <th className="py-2.5 px-3 w-32">
                      <div className="h-3 w-20 rounded shimmer-wave" />
                    </th>
                    <th className="py-2.5 px-3 w-28">
                      <div className="h-3 w-20 rounded shimmer-wave" />
                    </th>
                    <th className="py-2.5 px-3 w-24">
                      <div className="h-3 w-16 rounded shimmer-wave" />
                    </th>
                    <th className="py-2.5 px-3 w-20">
                      <div className="h-3 w-14 rounded shimmer-wave" />
                    </th>
                    <th className="py-2.5 px-3">
                      <div className="h-3 w-28 rounded shimmer-wave" />
                    </th>
                    <th className="py-2.5 px-3 w-28 text-center">
                      <div className="h-3 w-20 rounded mx-auto shimmer-wave" />
                    </th>
                    <th className="py-2.5 px-3 w-28">
                      <div className="h-3 w-20 rounded shimmer-wave" />
                    </th>
                    <th className="py-2.5 px-3 w-14 text-center">
                      <div className="h-3 w-8 rounded mx-auto shimmer-wave" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...Array(7)].map((_, idx) => (
                    <tr key={`mvt-skel-row-${idx}`} className="even:bg-slate-50/60 odd:bg-white">
                      {/* Index */}
                      <td className="py-3 px-3 text-center">
                        <div className="h-3.5 w-4 rounded mx-auto font-mono shimmer-wave" />
                      </td>
                      {/* Date / Bon / Heure */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="h-4 w-18 rounded bg-indigo-50 font-mono shimmer-wave" />
                          <div className="h-3 w-20 rounded font-mono shimmer-wave" />
                          <div className="h-2.5 w-12 rounded font-mono shimmer-wave" />
                        </div>
                      </td>
                      {/* N° OT / Commande */}
                      <td className="py-3 px-3">
                        <div className="h-4 w-20 rounded font-mono shimmer-wave" />
                      </td>
                      {/* Flux Badge */}
                      <td className="py-3 px-3">
                        <div className={`h-5 w-24 rounded-full ${idx % 2 === 0 ? 'bg-rose-50' : 'bg-cyan-50'} shimmer-wave`} />
                      </td>
                      {/* Source */}
                      <td className="py-3 px-3">
                        <div className="h-4 w-16 rounded shimmer-wave" />
                      </td>
                      {/* Article & Ref */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="h-4 w-28 rounded font-mono shimmer-wave" />
                          <div className="h-3 w-40 rounded shimmer-wave" />
                        </div>
                      </td>
                      {/* Quantité & Equation */}
                      <td className="py-3 px-3 text-center">
                        <div className="h-4 w-20 rounded mx-auto font-mono shimmer-wave" />
                      </td>
                      {/* Destination / Machine */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="h-3.5 w-20 rounded shimmer-wave" />
                          <div className="h-3 w-16 rounded font-mono shimmer-wave" />
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="h-6 w-8 rounded-lg mx-auto bg-slate-100 shimmer-wave" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const SortieRapideSkeletonView = memo(SortieRapideSkeletonViewComponent);
export default SortieRapideSkeletonView;
