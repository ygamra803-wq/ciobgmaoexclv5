import { memo } from 'react';

/**
 * UtilisateurSkeletonView
 * Dedicated, pixel-matched, monochromatic skeleton for the Utilisateurs & Membres view.
 * Respects the exact layout, padding, borders, responsive breakpoints,
 * 4 KPI cards, 4-column filter controls, and 7-column table structure.
 */
function UtilisateurSkeletonViewComponent() {
  return (
    <div className="space-y-5 w-full min-w-0" aria-hidden="true">
      {/* ─── 1. Top Header Banner Skeleton ─── */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200/90 shadow-2xs flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded-lg shimmer-wave" />
          </div>

          <div className="space-y-2 flex-1 max-w-3xl">
            {/* Title */}
            <div className="h-6 w-80 max-w-[85%] rounded-lg shimmer-wave" />
            {/* Subtitle */}
            <div className="space-y-1.5 pt-0.5">
              <div className="h-3 w-full max-w-2xl rounded shimmer-wave" />
            </div>
          </div>
        </div>

        {/* Right 3D Action Buttons (Formulas button & Add User button) */}
        <div className="flex items-center gap-2.5 shrink-0 relative">
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shimmer-wave" />
          <div className="w-10 h-10 rounded-full border border-slate-300 bg-slate-100 flex items-center justify-center shimmer-wave" />
        </div>
      </div>

      {/* ─── 2. 4 Quick KPI Stats Cards Skeleton ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { labelW: 'w-24', countW: 'w-12', subW: 'w-28' },
          { labelW: 'w-28', countW: 'w-10', subW: 'w-24' },
          { labelW: 'w-26', countW: 'w-10', subW: 'w-26' },
          { labelW: 'w-30', countW: 'w-8', subW: 'w-32' },
        ].map((kpi, idx) => (
          <div
            key={`user-kpi-skel-${idx}`}
            className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-2xs flex items-center justify-between"
          >
            <div className="space-y-1.5">
              <div className={`h-2.5 ${kpi.labelW} rounded shimmer-wave`} />
              <div className={`h-7 ${kpi.countW} rounded-lg font-mono shimmer-wave`} />
              <div className={`h-2.5 ${kpi.subW} rounded shimmer-wave`} />
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
              <div className="w-4 h-4 rounded shimmer-wave" />
            </div>
          </div>
        ))}
      </div>

      {/* ─── 3. Filter & Search Controls Bar Skeleton (4 Columns) ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-48 rounded shimmer-wave" />
          </div>
          <div className="h-6 w-36 rounded-lg shimmer-wave" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Field 1: Search */}
          <div className="w-full space-y-1.5">
            <div className="h-3 w-24 rounded shimmer-wave" />
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>

          {/* Field 2: Role / Profil */}
          <div className="w-full space-y-1.5">
            <div className="h-3 w-28 rounded shimmer-wave" />
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>

          {/* Field 3: Zone d'Affectation */}
          <div className="w-full space-y-1.5">
            <div className="h-3 w-32 rounded shimmer-wave" />
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>

          {/* Field 4: Tri des enregistrements */}
          <div className="w-full space-y-1.5">
            <div className="h-3 w-36 rounded shimmer-wave" />
            <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 shimmer-wave" />
          </div>
        </div>
      </div>

      {/* ─── 4. Main Users Table Skeleton (7 Exact Columns) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Top Info Header Bar inside Card */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/70 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded shimmer-wave" />
            <div className="h-3.5 w-64 rounded shimmer-wave" />
          </div>
          <div className="h-3 w-80 rounded hidden lg:block shimmer-wave" />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[850px] w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-[10.5px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <tr>
                {/* 1. N° */}
                <th className="py-2.5 px-3 text-center w-12 bg-slate-200/60 border-r border-slate-200 shrink-0">
                  <div className="h-3 w-4 rounded mx-auto shimmer-wave" />
                </th>
                {/* 2. IDENTIFIANT (B) */}
                <th className="py-2.5 px-4"><div className="h-3 w-24 rounded shimmer-wave" /></th>
                {/* 3. NOM COMPLET (C) */}
                <th className="py-2.5 px-4"><div className="h-3 w-32 rounded shimmer-wave" /></th>
                {/* 4. PROFIL & RÔLE (D) */}
                <th className="py-2.5 px-4"><div className="h-3 w-28 rounded shimmer-wave" /></th>
                {/* 5. ZONE(S) D'AFFECTATION (E) */}
                <th className="py-2.5 px-4"><div className="h-3 w-36 rounded shimmer-wave" /></th>
                {/* 6. SPÉCIALITÉ / DOMAINE (F) */}
                <th className="py-2.5 px-4"><div className="h-3 w-36 rounded shimmer-wave" /></th>
                {/* 7. ACTIONS (•••) */}
                <th className="py-2.5 px-4 text-center w-20"><div className="h-3 w-8 rounded mx-auto shimmer-wave" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { idW: 'w-20', nomW: 'w-44', subNomW: 'w-28', roleW: 'w-28', zoneW: 'w-32', specW: 'w-48' },
                { idW: 'w-18', nomW: 'w-52', subNomW: 'w-32', roleW: 'w-36', zoneW: 'w-24', specW: 'w-40' },
                { idW: 'w-22', nomW: 'w-40', subNomW: 'w-26', roleW: 'w-26', zoneW: 'w-36', specW: 'w-52' },
                { idW: 'w-20', nomW: 'w-48', subNomW: 'w-30', roleW: 'w-32', zoneW: 'w-28', specW: 'w-36' },
                { idW: 'w-24', nomW: 'w-56', subNomW: 'w-34', roleW: 'w-30', zoneW: 'w-40', specW: 'w-44' },
                { idW: 'w-18', nomW: 'w-42', subNomW: 'w-28', roleW: 'w-28', zoneW: 'w-24', specW: 'w-48' },
                { idW: 'w-22', nomW: 'w-50', subNomW: 'w-32', roleW: 'w-34', zoneW: 'w-32', specW: 'w-40' },
                { idW: 'w-20', nomW: 'w-46', subNomW: 'w-28', roleW: 'w-26', zoneW: 'w-36', specW: 'w-50' },
              ].map((row, idx) => (
                <tr key={`usr-skel-row-${idx}`} className="even:bg-slate-50/60 odd:bg-white">
                  {/* N° */}
                  <td className="py-3 px-3 text-center bg-slate-50/40 border-r border-slate-100 shrink-0">
                    <div className="h-3.5 w-5 rounded mx-auto shimmer-wave" />
                  </td>
                  {/* IDENTIFIANT (B) */}
                  <td className="py-3 px-4">
                    <div className={`h-5 ${row.idW} rounded-lg font-mono shimmer-wave`} />
                  </td>
                  {/* NOM COMPLET (C) */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg shimmer-wave shrink-0" />
                      <div className="space-y-1">
                        <div className={`h-3.5 ${row.nomW} rounded shimmer-wave`} />
                        <div className={`h-2.5 ${row.subNomW} rounded shimmer-wave`} />
                      </div>
                    </div>
                  </td>
                  {/* PROFIL & RÔLE (D) */}
                  <td className="py-3 px-4">
                    <div className={`h-5 ${row.roleW} rounded-full shimmer-wave`} />
                  </td>
                  {/* ZONE(S) D'AFFECTATION (E) */}
                  <td className="py-3 px-4">
                    <div className={`h-5 ${row.zoneW} rounded-md shimmer-wave`} />
                  </td>
                  {/* SPÉCIALITÉ / DOMAINE (F) */}
                  <td className="py-3 px-4">
                    <div className={`h-3.5 ${row.specW} rounded shimmer-wave`} />
                  </td>
                  {/* ACTIONS */}
                  <td className="py-3 px-4 text-center">
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

      {/* ─── 5. Pagination Footer Skeleton ─── */}
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

export const UtilisateurSkeletonView = memo(UtilisateurSkeletonViewComponent);
export default UtilisateurSkeletonView;
