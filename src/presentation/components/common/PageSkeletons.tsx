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
import SortieRapideSkeletonView from '../../pages/movements/components/SortieRapideSkeletonView';
import {
  SkeletonL1Page,
  SkeletonL2Page,
  SkeletonPageHeader,
  SkeletonKpiGrid,
  SkeletonFilterCard,
  SkeletonDataGrid,
} from './skeleton/GmaoSkeletonPrimitives';

// ─── L1 Dedicated Page Skeletons ───
export const StockSkeleton = StockSkeletonView;
export const UtilisateurSkeleton = UtilisateurSkeletonView;
export const ZonesSkeleton = ZonesSkeletonView;
export const EntrepotSkeleton = EntrepotSkeletonView;
export const MachinesRegisteredSkeleton = MachinesRegisteredSkeletonView;

/**
 * L1: Planning Préventif (PreventiveView) Skeleton
 * - Header with 5 circular action buttons + cycle badge
 * - 5-Card Mature Light Excel KPI Grid (with progress bar on card 3)
 * - 5-Column IndustrialFilterCard with Asset Class Segmented Bar
 * - 6 View-Mode Switcher Tabs + Matrix/Task Table Grid
 */
export function PreventiveSkeleton() {
  return (
    <SkeletonL1Page
      header={{
        circleButtonsCount: 5,
        titleBadgesCount: 1,
      }}
      kpiColumns={5}
      filter={{
        columns: 5,
        hasAssetClassBar: true,
        hasExportButton: true,
      }}
      grid={{
        topTabsCount: 6,
        minWidth: 'min-w-[1020px]',
        rowsCount: 8,
        hasPagination: true,
        columns: [
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-36', type: 'double', colClass: 'min-w-[200px]' },
          { headerW: 'w-32', type: 'double', colClass: 'min-w-[180px]' },
          { headerW: 'w-20', type: 'badge', align: 'center', colClass: 'w-28' },
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-24', type: 'badge', align: 'center', colClass: 'w-32' },
          { headerW: 'w-20', type: 'number', align: 'right', colClass: 'w-28' },
          { headerW: 'w-16', type: 'actions', align: 'center', colClass: 'w-24' },
        ],
      }}
    />
  );
}

/**
 * L1: Maintenance Corrective (CorrectiveView - DI / BT / Clôture) Skeleton
 * - Header with 4 circular action buttons on top + 5 sub-tabs stacked below
 * - 4-Card Mature Light Excel KPI Grid
 * - 4-Column IndustrialFilterCard (with Period Bar when on BT)
 * - 9-Column Corrective Interventions Table + Pagination
 */
export function CorrectiveSkeleton({ subTab = 'corrective_di' }: { subTab?: string }) {
  const isLive = subTab === 'corrective_live';
  const isAnalyse = subTab === 'corrective_analyse';

  if (isLive) {
    return (
      <div className="space-y-6 w-full min-w-0 select-none" aria-hidden="true">
        <SkeletonPageHeader
          circleButtonsCount={4}
          titleBadgesCount={2}
          subTabsCount={5}
          stackSubTabsBelowActions={true}
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="h-5 w-48 rounded shimmer-wave" />
            <div className="h-32 w-full rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-3">
              <div className="h-10 w-44 rounded-xl font-mono shimmer-wave" />
              <div className="h-4 w-32 rounded shimmer-wave" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-11 rounded-xl shimmer-wave" />
              <div className="h-11 rounded-xl shimmer-wave" />
            </div>
          </div>
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="h-5 w-56 rounded shimmer-wave" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-10 rounded-xl shimmer-wave" />
              <div className="h-10 rounded-xl shimmer-wave" />
              <div className="h-24 sm:col-span-2 rounded-xl shimmer-wave" />
              <div className="h-16 sm:col-span-2 rounded-xl shimmer-wave" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAnalyse) {
    return (
      <div className="space-y-6 w-full min-w-0 select-none" aria-hidden="true">
        <SkeletonPageHeader
          circleButtonsCount={4}
          titleBadgesCount={2}
          subTabsCount={5}
          stackSubTabsBelowActions={true}
        />
        <SkeletonKpiGrid columns={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="h-5 w-56 rounded shimmer-wave" />
            <div className="h-64 w-full rounded-xl shimmer-wave" />
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="h-5 w-56 rounded shimmer-wave" />
            <div className="h-64 w-full rounded-xl shimmer-wave" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <SkeletonL1Page
      header={{
        circleButtonsCount: 4,
        titleBadgesCount: 2,
        subTabsCount: 5,
        stackSubTabsBelowActions: true,
      }}
      kpiColumns={4}
      filter={{
        columns: 4,
        hasPeriodBar: subTab === 'corrective_bt',
        hasExportButton: true,
      }}
      grid={{
        minWidth: 'min-w-[1020px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-20', type: 'code', colClass: 'w-28' },
          { headerW: 'w-28', type: 'double', colClass: 'min-w-[170px]' },
          { headerW: 'w-24', type: 'double', colClass: 'w-32' },
          { headerW: 'w-28', type: 'badge', colClass: 'w-36' },
          { headerW: 'w-40', type: 'double', colClass: 'min-w-[200px]' },
          { headerW: 'w-24', type: 'avatar-double', colClass: 'min-w-[160px]' },
          { headerW: 'w-20', type: 'badge', align: 'center', colClass: 'w-28' },
          { headerW: 'w-20', type: 'badge', align: 'center', colClass: 'w-28' },
          { headerW: 'w-16', type: 'actions', align: 'center', colClass: 'w-24' },
        ],
      }}
    />
  );
}

// ─── L2 Dedicated Page Skeletons ───
export const TypeSkeleton = TypeSkeletonView;
export const DesignationSkeleton = DesignationSkeletonView;
export const PartTypeSkeleton = PartTypeSkeletonView;
export const PartDesignationSkeleton = PartDesignationSkeletonView;
export const CompFamilySkeleton = CompFamilySkeletonView;
export const CompTemplateSkeleton = CompTemplateSkeletonView;
export const FamilySkeleton = FamilySkeletonView;
export const TemplatesSkeleton = TemplatesSkeletonView;
export const BlueprintSkeleton = BlueprintMachineSkeletonView;

/**
 * L2: Groupes d'Organes (CompGroupView) Skeleton
 */
export function CompGroupSkeleton() {
  return (
    <SkeletonL2Page
      header={{
        circleButtonsCount: 2,
        titleBadgesCount: 1,
      }}
      filter={{
        columns: 2,
        hasExportButton: true,
      }}
      grid={{
        minWidth: 'min-w-[850px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-44', type: 'double', colClass: 'min-w-[220px]' },
          { headerW: 'w-28', type: 'badge', colClass: 'w-36' },
          { headerW: 'w-28', type: 'badge', colClass: 'w-36' },
          { headerW: 'w-28', type: 'badge', colClass: 'w-36' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

/**
 * L2: Ingénierie & Référentiel Préventif (PreventiveSecondaryView) Skeleton
 */
export function PreventiveReferentielSkeleton() {
  return (
    <SkeletonL2Page
      header={{
        circleButtonsCount: 1,
        titleBadgesCount: 1,
        subTabsCount: 3,
      }}
      filter={{
        columns: 3,
        hasExportButton: true,
      }}
      grid={{
        minWidth: 'min-w-[880px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-44', type: 'double', colClass: 'min-w-[220px]' },
          { headerW: 'w-28', type: 'badge', colClass: 'w-36' },
          { headerW: 'w-28', type: 'dual-badge', colClass: 'min-w-[160px]' },
          { headerW: 'w-20', type: 'number', align: 'right', colClass: 'w-28' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

/**
 * L2: Catalogue & Données GMAO (CatalogueDonneesView) Skeleton
 */
export function CatalogueDonneesSkeleton() {
  return (
    <SkeletonL2Page
      header={{
        circleButtonsCount: 2,
        titleBadgesCount: 2,
        subTabsCount: 4,
        stackSubTabsBelowActions: true,
      }}
      filter={{
        columns: 2,
        hasExportButton: true,
      }}
      grid={{
        minWidth: 'min-w-[850px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-28', type: 'badge', colClass: 'w-40' },
          { headerW: 'w-48', type: 'double', colClass: 'min-w-[240px]' },
          { headerW: 'w-36', type: 'dual-badge', colClass: 'min-w-[180px]' },
          { headerW: 'w-24', type: 'badge', align: 'center', colClass: 'w-32' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

/**
 * L2 Operational Tool: Sortie & Entrée Rapide (SortieRapideView) Skeleton
 */
export function SortieRapideSkeleton() {
  return <SortieRapideSkeletonView />;
}

// ─── Special Pages Dedicated Skeletons ───

/**
 * Special: Centre de Validation Maker-Checker (ValidationCenterView) Skeleton
 */
export function ValidationCenterSkeleton() {
  return (
    <div className="space-y-5 w-full min-w-0 select-none" aria-hidden="true">
      <SkeletonPageHeader circleButtonsCount={1} titleBadgesCount={2} />
      <SkeletonKpiGrid
        columns={4}
        cards={[
          { titleW: 'w-32', valueW: 'w-12', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-16' },
          { titleW: 'w-32', valueW: 'w-10', unitW: 'w-14', badgeW: 'w-24', footerLeftW: 'w-20', footerRightW: 'w-20' },
          { titleW: 'w-32', valueW: 'w-10', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-16' },
          { titleW: 'w-32', valueW: 'w-10', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-24', footerRightW: 'w-16' },
        ]}
      />
      <SkeletonFilterCard columns={2} hasExportButton={false} />
      <SkeletonDataGrid
        minWidth="min-w-[920px]"
        rowsCount={6}
        hasPagination={false}
        columns={[
          { headerW: 'w-24', type: 'badge', colClass: 'w-32' },
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-40', type: 'double', colClass: 'min-w-[220px]' },
          { headerW: 'w-28', type: 'avatar-double', colClass: 'min-w-[160px]' },
          { headerW: 'w-32', type: 'dual-badge', colClass: 'min-w-[160px]' },
          { headerW: 'w-24', type: 'actions', align: 'right', colClass: 'w-32' },
        ]}
      />
    </div>
  );
}

/**
 * Special: Rapports Exécutifs & Exploitation (ShiftWeeklyReportView & MonthlyExecutiveReportView) Skeleton
 */
export function ExecutiveReportSkeleton() {
  return (
    <div className="space-y-6 w-full min-w-0 select-none" aria-hidden="true">
      {/* Header with Period/Month Selector & Print/Export Buttons */}
      <SkeletonPageHeader circleButtonsCount={2} titleBadgesCount={2} subTabsCount={4} />

      {/* 4 Executive KPI Cards */}
      <SkeletonKpiGrid
        columns={4}
        cards={[
          { titleW: 'w-32', valueW: 'w-20', unitW: 'w-12', badgeW: 'w-24', footerLeftW: 'w-24', footerRightW: 'w-16' },
          { titleW: 'w-36', valueW: 'w-16', unitW: 'w-14', badgeW: 'w-24', footerLeftW: 'w-20', footerRightW: 'w-20', hasProgressBar: true },
          { titleW: 'w-32', valueW: 'w-16', unitW: 'w-16', badgeW: 'w-24', footerLeftW: 'w-24', footerRightW: 'w-16' },
          { titleW: 'w-36', valueW: 'w-14', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-16' },
        ]}
      />

      {/* 2-Column Analytical Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((cardIdx) => (
          <div
            key={`rep-breakdown-${cardIdx}`}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="h-4 w-48 rounded shimmer-wave" />
                <div className="h-2.5 w-64 rounded shimmer-wave" />
              </div>
              <div className="h-6 w-20 rounded-full shimmer-wave" />
            </div>
            <div className="space-y-2.5">
              {[0, 1, 2, 3].map((r) => (
                <div
                  key={`rep-row-${cardIdx}-${r}`}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="h-3.5 w-36 rounded shimmer-wave" />
                    <div className="h-2.5 w-24 rounded shimmer-wave" />
                  </div>
                  <div className="h-6 w-16 rounded-lg font-mono shimmer-wave" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Detailed Machine / Activity Table */}
      <SkeletonDataGrid
        minWidth="min-w-[900px]"
        rowsCount={5}
        hasPagination={false}
        columns={[
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-40', type: 'double', colClass: 'min-w-[200px]' },
          { headerW: 'w-20', type: 'number', align: 'right', colClass: 'w-28' },
          { headerW: 'w-20', type: 'number', align: 'right', colClass: 'w-28' },
          { headerW: 'w-24', type: 'badge', align: 'center', colClass: 'w-32' },
          { headerW: 'w-24', type: 'number', align: 'right', colClass: 'w-32' },
        ]}
      />
    </div>
  );
}

// 4. Operations & Users View Skeleton (Legacy alias)
export const OperationsSkeleton = UtilisateurSkeletonView;

// 5. Generic Table View Skeleton (Guide / Nexus fallback)
export function GenericTableSkeleton() {
  return (
    <SkeletonL2Page
      header={{
        circleButtonsCount: 1,
        titleBadgesCount: 1,
      }}
      filter={{
        columns: 2,
        hasExportButton: false,
      }}
      grid={{
        minWidth: 'min-w-[800px]',
        rowsCount: 6,
        hasPagination: false,
        columns: [
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-48', type: 'double', colClass: 'min-w-[240px]' },
          { headerW: 'w-32', type: 'badge', colClass: 'w-40' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

// 6. Guidance Cards Table Skeleton
export const GuidanceCardsTableSkeleton = DesignationSkeletonView;

// 8. Settings View Skeleton
export function SettingsSkeleton() {
  return (
    <div className="space-y-5 w-full min-w-0 select-none" aria-hidden="true">
      <SkeletonPageHeader circleButtonsCount={2} titleBadgesCount={1} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[...Array(4)].map((_, idx) => (
          <div
            key={`setting-card-${idx}`}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <div className="w-4 h-4 rounded shimmer-wave" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="h-4 w-40 rounded shimmer-wave" />
                <div className="h-3 w-60 max-w-full rounded shimmer-wave" />
              </div>
            </div>
            <div className="h-10 w-full rounded-xl border border-slate-100 shimmer-wave" />
            <div className="h-10 w-full rounded-xl border border-slate-100 shimmer-wave" />
          </div>
        ))}
      </div>
    </div>
  );
}
