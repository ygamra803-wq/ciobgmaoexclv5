import StockSkeletonView from '../../pages/stock/components/StockSkeletonView';
import TypeSkeletonView from '../../pages/referentiel/components/TypeSkeletonView';
import DesignationSkeletonView from '../../pages/referentiel/components/DesignationSkeletonView';
import UtilisateurSkeletonView from '../../pages/utilisateurs/components/UtilisateurSkeletonView';
import ZonesSkeletonView from '../../pages/referentiel/components/ZonesSkeletonView';
import EntrepotSkeletonView from '../../pages/warehouse/components/EntrepotSkeletonView';
import PartTypeSkeletonView from '../../pages/referentiel/components/PartTypeSkeletonView';
import PartDesignationSkeletonView from '../../pages/referentiel/components/PartDesignationSkeletonView';
import CompFamilySkeletonView from '../../pages/referentiel/components/CompFamilySkeletonView';
import CompTemplateSkeletonView from '../../pages/referentiel/components/CompTemplateSkeletonView';
import MachinesRegisteredSkeletonView from '../../pages/machines/components/MachinesRegisteredSkeletonView';
import FamilySkeletonView from '../../pages/machines/components/FamilySkeletonView';
import TemplatesSkeletonView from '../../pages/machines/components/TemplatesSkeletonView';
import BlueprintMachineSkeletonView from '../../pages/machines/components/BlueprintMachineSkeletonView';

// 1. Stock Actuel View Skeleton (Dedicated pixel-matched monochromatic layout)
export const StockSkeleton = StockSkeletonView;

// 1b. Types PDR View Skeleton (Dedicated pixel-matched monochromatic layout)
export const TypeSkeleton = TypeSkeletonView;

// 1c. Désignations PDR View Skeleton (Dedicated pixel-matched monochromatic layout)
export const DesignationSkeleton = DesignationSkeletonView;

// 1d. Utilisateurs & Membres View Skeleton (Dedicated pixel-matched monochromatic layout)
export const UtilisateurSkeleton = UtilisateurSkeletonView;

// 1e. Zones & Secteurs View Skeleton (Dedicated pixel-matched monochromatic layout)
export const ZonesSkeleton = ZonesSkeletonView;

// 1f. Entrepôt Warehouse View Skeleton (Dedicated pixel-matched monochromatic layout)
export const EntrepotSkeleton = EntrepotSkeletonView;

// 1g. Part Types View Skeleton (Dedicated pixel-matched monochromatic layout)
export const PartTypeSkeleton = PartTypeSkeletonView;

// 1h. Part Designations View Skeleton (Dedicated pixel-matched monochromatic layout)
export const PartDesignationSkeleton = PartDesignationSkeletonView;

// 1i. Component Families View Skeleton (Dedicated pixel-matched monochromatic layout)
export const CompFamilySkeleton = CompFamilySkeletonView;

// 1j. Component Templates View Skeleton (Dedicated pixel-matched monochromatic layout)
export const CompTemplateSkeleton = CompTemplateSkeletonView;

// 1k. Machines Registered View Skeleton (Dedicated pixel-matched monochromatic layout)
export const MachinesRegisteredSkeleton = MachinesRegisteredSkeletonView;

// 1l. Machine Families View Skeleton (Dedicated pixel-matched monochromatic layout)
export const FamilySkeleton = FamilySkeletonView;

// 1m. Machine Templates View Skeleton (Dedicated pixel-matched monochromatic layout)
export const TemplatesSkeleton = TemplatesSkeletonView;

// 1n. Blueprint Machine View Skeleton (Dedicated pixel-matched monochromatic layout)
export const BlueprintSkeleton = BlueprintMachineSkeletonView;



import SortieRapideSkeletonView from '../../pages/movements/components/SortieRapideSkeletonView';

// 2. Sortie Rapide / Saisie Mouvement View Skeleton
export function SortieRapideSkeleton() {
  return <SortieRapideSkeletonView />;
}

// 4. Operations & Users View Skeleton
export function OperationsSkeleton() {
  return (
    <div className="space-y-4">
      {/* 3 Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { wave: 'shimmer-wave-indigo', w: 'w-28' },
          { wave: 'shimmer-wave-emerald', w: 'w-24' },
          { wave: 'shimmer-wave-amber', w: 'w-20' },
        ].map((kpi, idx) => (
          <div
            key={`op-kpi-${idx}`}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between"
          >
            <div className="space-y-1.5">
              <div className={`h-3 ${kpi.w} rounded shimmer-wave`} />
              <div className={`h-6 w-14 rounded font-mono ${kpi.wave}`} />
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-100">
              <div className="w-4 h-4 rounded shimmer-wave" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter Header & Actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-9 w-48 rounded-xl border border-slate-200 shimmer-wave" />
          <div className="h-9 w-64 rounded-xl border border-slate-200 shimmer-wave" />
          <div className="h-9 w-36 rounded-xl border border-slate-200 shimmer-wave" />
        </div>
        <div className="h-9 w-40 rounded-xl shrink-0 shimmer-wave-purple" />
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={`op-skel-row-${i}`}
              className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="h-4 w-6 rounded font-mono shimmer-wave" />
                <div className="h-6 w-20 rounded-lg font-mono shimmer-wave-purple" />
                <div className="h-4 w-40 rounded shimmer-wave" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-5 w-24 rounded-full shimmer-wave" />
                <div className="h-6 w-20 rounded-full shimmer-wave-amber" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 5. Basic Generic Table View Skeleton
export function GenericTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Top Banner stats / Actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-5 w-36 rounded shimmer-wave-purple" />
          <div className="h-3.5 w-64 rounded shimmer-wave" />
        </div>
        <div className="h-9 w-36 rounded-xl shimmer-wave-purple" />
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <div className="h-8 w-64 rounded-xl border border-slate-200 shimmer-wave" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={`generic-skel-${i}`}
              className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="h-6 w-16 rounded-lg font-mono shimmer-wave-purple" />
                <div className="h-4 w-48 rounded shimmer-wave" />
              </div>
              <div className="flex gap-2">
                <div className="h-7 w-7 rounded-lg shimmer-wave" />
                <div className="h-7 w-7 rounded-lg shimmer-wave" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 6. Types & Designations View Skeleton (Formula Guidance Cards Layout)
export function GuidanceCardsTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded shrink-0 shimmer-wave-cyan" />
            <div className="h-6 w-56 rounded shimmer-wave" />
          </div>
          <div className="h-3.5 w-96 rounded shimmer-wave" />
        </div>
        <div className="h-9 w-40 rounded-xl shrink-0 shimmer-wave-indigo" />
      </div>

      {/* Excel Formula Guidance Cards (3 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { wave: 'shimmer-wave-cyan', line1: 'w-24', line2: 'w-32' },
          { wave: 'shimmer-wave-indigo', line1: 'w-32', line2: 'w-48' },
          { wave: 'shimmer-wave-emerald', line1: 'w-28', line2: 'w-40' },
        ].map((card, idx) => (
          <div
            key={`form-guide-${idx}`}
            className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between"
          >
            <div className="space-y-2">
              <div className={`h-2.5 ${card.line1} rounded shimmer-wave`} />
              <div className={`h-3 ${card.line2} rounded shimmer-wave`} />
            </div>
            <div className={`h-5 w-16 rounded-md ${card.wave} shrink-0`} />
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="h-9 w-full max-w-sm rounded-xl border border-slate-200 shimmer-wave" />
          <div className="h-9 w-52 rounded-xl border border-slate-200 hidden sm:block shimmer-wave" />
        </div>
        <div className="h-4 w-32 rounded self-end sm:self-auto shimmer-wave" />
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="h-4 w-64 rounded shimmer-wave" />
          <div className="h-3 w-48 rounded hidden lg:block shimmer-wave" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-12 border-r border-slate-200"><div className="h-3 w-6 rounded mx-auto shimmer-wave" /></th>
                <th className="py-2.5 px-3"><div className="h-3 w-20 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-3"><div className="h-3 w-32 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-3"><div className="h-3 w-24 rounded shimmer-wave" /></th>
                <th className="py-2.5 px-3 w-24"><div className="h-3 w-12 rounded mx-auto shimmer-wave" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...Array(6)].map((_, i) => (
                <tr key={`td-table-row-${i}`} className="bg-white">
                  <td className="py-2.5 px-3 border-r border-slate-100"><div className="h-4 w-5 rounded mx-auto shimmer-wave" /></td>
                  <td className="py-3 px-3"><div className="h-4 w-24 rounded font-mono shimmer-wave-indigo" /></td>
                  <td className="py-3 px-3"><div className="h-4 w-48 rounded shimmer-wave" /></td>
                  <td className="py-3 px-3"><div className="h-6 w-20 rounded-full shimmer-wave-cyan" /></td>
                  <td className="py-3 px-3"><div className="h-6 w-16 rounded-full mx-auto shimmer-wave-emerald" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 8. Settings View Skeleton
export function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-6 w-48 rounded shimmer-wave-amber" />
          <div className="h-3.5 w-80 rounded shimmer-wave" />
        </div>
        <div className="h-9 w-32 rounded-xl shimmer-wave-amber" />
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[...Array(4)].map((_, idx) => (
          <div
            key={`setting-card-${idx}`}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                <div className="w-4 h-4 rounded shimmer-wave-amber" />
              </div>
              <div className="space-y-1">
                <div className="h-4 w-36 rounded shimmer-wave" />
                <div className="h-3 w-56 rounded shimmer-wave" />
              </div>
            </div>
            <div className="h-10 w-full rounded-xl border border-slate-100 shimmer-wave" />
          </div>
        ))}
      </div>
    </div>
  );
}

